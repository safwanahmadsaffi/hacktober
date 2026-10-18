/**
 * DukaanVoice PK — "Munshi AI" shop agent
 *
 * The Munshi is the accountant every kiryana shop wishes it had: it understands
 * Urdu / Roman-Urdu / English, answers with *real tool calls* over the shop
 * ledger, forecasts stockouts, flags cash anomalies, and grounds pricing advice
 * in live wholesale rates — all on a laptop, with no data leaving the shop.
 *
 * Design principles
 *  - Open-weight model (Gemma via local Ollama) proposes intent + entities; the
 *    deterministic engine disposes. Ledger math never depends on the model.
 *  - Every step is traced (see ./telemetry) so the agent is debuggable.
 *  - Everything degrades gracefully offline: no key, no Ollama, no network →
 *    deterministic heuristics still produce a correct, useful answer.
 */

import type { Product, Customer, Transaction, Expense, CashClosing } from '@/types';
import { queryGemma } from '@/lib/ai/gemma';
import { getWholesaleMandiRates, type WholesaleRate } from '@/lib/ai/serpapi';
import { runTabPFNDemandForecast, type TabPFNDemandForecast, type TabPFNAnomalyReport, runTabPFNAnomalyScan } from '@/lib/ai/tabpfn';
import { startTrace, endTrace, withSpan, addSpan, type AgentSpan } from '@/lib/ai/telemetry';
import { cartSubtotal, formatPKR, isRealSale } from '@/lib/financial';

// ── Public types ────────────────────────────────────────────────────────────

export interface ShopContext {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  expenses: Expense[];
  cashClosings: CashClosing[];
}

export type MunshiIntent =
  | 'low_stock'
  | 'sales_summary'
  | 'udhaar_query'
  | 'mandi_rates'
  | 'demand_forecast'
  | 'anomaly_scan'
  | 'add_order'
  | 'help';

export interface ProposedLine {
  productId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
}

export interface MunshiProposal {
  items: ProposedLine[];
  totalPaise: number;
  /** Financial/inventory-changing actions always require explicit approval. */
  requiresConfirmation: true;
}

export interface MunshiToolCall {
  tool: string;
  input: Record<string, string | number>;
  ok: boolean;
  durationMs: number;
  summary: string;
}

export interface MunshiResponse {
  traceId: string;
  intent: MunshiIntent;
  reply: { ur: string; en: string };
  toolCalls: MunshiToolCall[];
  proposal: MunshiProposal | null;
  model: string;
  /** True when the answer was produced without any external inference/network. */
  offline: boolean;
  latencyMs: number;
  spans: AgentSpan[];
}

export interface MunshiOptions {
  /** When false, skip the LLM entirely (deterministic only). Used in tests. */
  useModel?: boolean;
}

// ── Intent classification (offline-first, multilingual) ─────────────────────

const INTENT_KEYWORDS: Record<MunshiIntent, string[]> = {
  low_stock: ['low stock', 'kam stock', 'out of stock', 'کم اسٹاک', 'ختم', 'تھوڑا مال', 'گهٽ اسٽاڪ', 'کم مال', 'kam', 'khatam'],
  sales_summary: ['sale', 'sales', 'sold', 'revenue', 'today sales', 'aaj ki sale', 'فروخت', 'سیل', 'وڪرو', 'پلور', 'دکانداری'],
  udhaar_query: ['udhaar', 'udhar', 'credit', 'balance', 'outstanding', 'ادھار', 'قرض', 'بaki', 'بقایا', 'bakaya'],
  mandi_rates: ['mandi', 'wholesale', 'rate', 'price today', 'بھاؤ', 'ریٹ', 'منڈی', 'تھوک'],
  demand_forecast: ['forecast', 'reorder', 'restock', 'mangwana', 'predict', 'منگوانا', 'پیش گوئی', 'order karna', 'stock out kab'],
  anomaly_scan: ['anomaly', 'discrepancy', 'short', 'surplus', 'فرق', 'گڑبڑ', 'cash short', 'drawer'],
  add_order: ['add', 'bill banao', 'make bill', 'add karo', 'شامل کرو', 'بل بناؤ', 'chahiye', 'چاہیے'],
  help: [],
};

export function classifyIntent(input: string): MunshiIntent {
  const q = input.toLowerCase();
  let best: MunshiIntent = 'help';
  let bestScore = 0;
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS) as [MunshiIntent, string[]][]) {
    let score = 0;
    for (const w of words) if (q.includes(w)) score += w.length;
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return best;
}

// ── Deterministic product matching (used to validate model-extracted entities)

export interface ProductMatch {
  product: Product;
  score: number;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(t => t.length > 1);
}

/**
 * The Urdu / Roman-Urdu words a shopkeeper actually says, mapped to the English
 * keywords in the catalog — so "doodh" finds "Olper's Full Cream Milk".
 */
const SHOP_SYNONYMS: Record<string, string> = {
  doodh: 'milk', dudh: 'milk',
  cheeni: 'sugar', chini: 'sugar', shakkar: 'sugar',
  chawal: 'rice', chaawal: 'rice',
  ata: 'atta', maida: 'flour', sooji: 'flour',
  tel: 'oil', tail: 'oil',
  daal: 'dal', dal: 'dal',
  namak: 'salt',
  chai: 'tea', patti: 'tea',
  mirch: 'chilli',
  anda: 'egg', anday: 'egg',
  sabun: 'soap', surf: 'detergent',
  ghree: 'ghee',
  biscut: 'biscuit', bisquits: 'biscuit',
  mithai: 'sweet',
};

function canonicalTokens(s: string): string[] {
  return tokenize(s).map(t => SHOP_SYNONYMS[t] ?? t);
}

export function matchProducts(query: string, products: Product[], limit = 3): ProductMatch[] {
  const qTokens = canonicalTokens(query);
  if (qTokens.length === 0) return [];
  const qPhrase = qTokens.join(' ');
  const scored: ProductMatch[] = [];
  for (const product of products) {
    if (!product.isActive) continue;
    const pTokens = canonicalTokens(product.name);
    const sku = (product.sku ?? '').toLowerCase();
    let score = 0;
    if (sku && query.toLowerCase().includes(sku)) score += 100;
    if (pTokens.join(' ').includes(qPhrase)) score += 50;
    const pSet = new Set(pTokens);
    for (const t of qTokens) if (pSet.has(t)) score += 10;
    if (score > 0) scored.push({ product, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Ledger derivations ──────────────────────────────────────────────────────

export interface SalesHistoryRow {
  productId: string;
  quantity: number;
  businessDate: string;
}

export function deriveSalesHistory(transactions: Transaction[]): SalesHistoryRow[] {
  const rows: SalesHistoryRow[] = [];
  for (const tx of transactions) {
    if (tx.type !== 'sale' || tx.status !== 'confirmed') continue;
    for (const item of tx.items) {
      rows.push({ productId: item.productId, quantity: item.quantity, businessDate: tx.businessDate });
    }
  }
  return rows;
}

function todaysRange(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Model-assisted entity extraction for free-text orders ───────────────────

interface GemmaEntities {
  intent?: string;
  items?: Array<{ name: string; quantity?: number }>;
}

/**
 * Small models love to answer with prose or ```json fences, so pull the first
 * JSON object out of the reply instead of trusting JSON.parse on raw text
 * (which silently failed and dropped every order to the keyword matcher).
 */
export function parseModelEntities(raw: string): GemmaEntities | null {
  if (!raw) return null;
  const unfenced = raw.replace(/```(?:json)?/gi, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1)) as GemmaEntities;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter(i => i && typeof i.name === 'string' && i.name.trim().length > 0)
      .map(i => ({ name: i.name.trim(), quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1 }));
    if (items.length === 0) return null;
    return { intent: parsed.intent, items };
  } catch {
    return null;
  }
}

async function extractOrderWithModel(input: string): Promise<GemmaEntities | null> {
  const system = [
    'You are the Munshi (accountant) parser for a Pakistani kiryana shop POS.',
    'Extract the items and quantities the shopkeeper wants to bill.',
    'Reply with STRICT JSON only: {"intent":"sale","items":[{"name":"...","quantity":1}]}',
    'Understand Urdu, Roman Urdu, and English.',
  ].join(' ');
  try {
    return parseModelEntities(await queryGemma(input, system));
  } catch {
    return null;
  }
}

// ── Tool implementations ────────────────────────────────────────────────────

export interface ToolOutcome {
  tool: string;
  input: Record<string, string | number>;
  summary: string;
  ur: string;
  en: string;
  proposal?: MunshiProposal;
}

export function lowStockTool(ctx: ShopContext): ToolOutcome {
  const low = ctx.products
    .filter(p => p.isActive && p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
  const names = low.slice(0, 5).map(p => `${p.name.split('(')[0].trim()} (${p.stock} ${p.unit})`);
  return {
    tool: 'inventory_query',
    input: { filter: 'low_stock' },
    summary: `${low.length} low-stock item(s)`,
    ur: low.length === 0
      ? 'کوئی بھی سامان کم اسٹاک پر نہیں ہے۔ تمام اشیاء وافر مقدار میں ہیں۔'
      : `${low.length} اشیاء کا اسٹاک کم ہے: ${names.join('، ')}${low.length > 5 ? '…' : ''}`,
    en: low.length === 0
      ? 'No items are below their low-stock threshold — shelves are healthy.'
      : `${low.length} item(s) are low: ${names.join(', ')}${low.length > 5 ? '…' : ''}`,
  };
}

export function salesSummaryTool(ctx: ShopContext): ToolOutcome {
  const today = todaysRange();
  const confirmed = ctx.transactions.filter(t => t.status === 'confirmed' && isRealSale(t));
  const todaySales = confirmed.filter(t => t.businessDate === today);
  const todayTotal = todaySales.reduce((s, t) => s + t.totalPaise, 0);
  const allTotal = confirmed.reduce((s, t) => s + t.totalPaise, 0);
  const cashTotal = confirmed.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.totalPaise, 0);
  return {
    tool: 'sales_summary',
    input: { range: 'today' },
    summary: `today=${todaySales.length} txns, ${formatPKR(todayTotal)}`,
    ur: `آج کی تصدیق شدہ فروخت: ${formatPKR(todayTotal)} (${todaySales.length} رسیدیں)۔ کل نقد فروخت: ${formatPKR(cashTotal)}۔`,
    en: `Today's confirmed sales: ${formatPKR(todayTotal)} across ${todaySales.length} bill(s). All-time confirmed: ${formatPKR(allTotal)}.`,
  };
}

export function udhaarTool(ctx: ShopContext): ToolOutcome {
  const owing = ctx.customers.filter(c => c.balancePaise > 0).sort((a, b) => b.balancePaise - a.balancePaise);
  const total = owing.reduce((s, c) => s + c.balancePaise, 0);
  const top = owing.slice(0, 3).map(c => `${c.name.split('(')[0].trim()} ${formatPKR(c.balancePaise)}`);
  return {
    tool: 'udhaar_query',
    input: { filter: 'outstanding' },
    summary: `outstanding=${formatPKR(total)} across ${owing.length} customers`,
    ur: `کل بقایا ادھار: ${formatPKR(total)} (${owing.length} گاہک)۔ ${top.length ? 'نمایاں: ' + top.join('، ') : ''}`,
    en: `Total outstanding Udhaar: ${formatPKR(total)} across ${owing.length} customer(s).${top.length ? ' Top: ' + top.join(', ') : ''}`,
  };
}

export async function mandiTool(input: string): Promise<ToolOutcome> {
  const rates: WholesaleRate[] = await getWholesaleMandiRates(input);
  const lines = rates.slice(0, 4).map(r => `${r.urduName} — ${formatPKR(r.marketRateRs * 100)}/${r.wholesaleUnit}`);
  const linesEn = rates.slice(0, 4).map(r => `${r.commodity} — Rs. ${r.marketRateRs.toLocaleString('en-PK')}/${r.wholesaleUnit} (${r.trend})`);
  const liveRows = rates.filter(r => r.source === 'benchmark+live').length;
  const provenance = liveRows > 0
    ? `${liveRows} with today's SerpApi evidence`
    : 'verified benchmark index';
  return {
    tool: 'mandi_rates',
    input: { query: input || 'all' },
    summary: `${rates.length} wholesale rate(s), ${provenance}`,
    ur: `تازہ تھوک منڈی ریٹ: ${lines.join('، ')}`,
    en: `Wholesale rates (${provenance}): ${linesEn.join('; ')}.`,
  };
}

export async function forecastTool(ctx: ShopContext): Promise<ToolOutcome> {
  const history = deriveSalesHistory(ctx.transactions);
  const forecasts: TabPFNDemandForecast[] = await runTabPFNDemandForecast(
    ctx.products.map(p => ({
      id: p.id, name: p.name, stock: p.stock, unit: p.unit,
      lowStockThreshold: p.lowStockThreshold, sellingPricePaise: p.sellingPricePaise,
    })),
    history,
  );
  const urgent = forecasts
    .filter(f => f.stockoutRisk !== 'low')
    .sort((a, b) => (a.stockoutRisk === 'high' ? -1 : 1) - (b.stockoutRisk === 'high' ? -1 : 1))
    .slice(0, 5);
  const engine: 'TabPFN-API' | 'on-device' =
    forecasts.some(f => f.source === 'TabPFN-API') ? 'TabPFN-API' : 'on-device';
  const engineLabel = engine === 'TabPFN-API' ? 'TabPFN live API' : 'on-device fallback';
  const lines = urgent.map(f => `${f.productName.split('(')[0].trim()}: منگوا کر ${f.recommendedReorderQty} ${f.unit}`);
  const linesEn = urgent.map(f => `${f.productName.split('(')[0].trim()}: reorder ${f.recommendedReorderQty} ${f.unit} (risk ${f.stockoutRisk}, 7-day demand ≈ ${f.predictedDemand7Days})`);
  return {
    tool: 'demand_forecast',
    input: { horizon_days: 7, engine },
    summary: `${urgent.length} products need restocking within 7 days (${engineLabel})`,
    ur: urgent.length === 0
      ? 'اگلے سات دنوں میں کسی سامان کے اسٹاک ختم ہونے کا خطرہ نہیں۔'
      : `TabPFN پیش گوئی: اگلے 7 دنوں میں ان اشیاء کا اسٹاک ختم ہو سکتا ہے — ${lines.join('، ')}`,
    en: urgent.length === 0
      ? 'No stockouts are predicted in the next 7 days.'
      : `TabPFN forecast: these items risk stocking out within 7 days — ${linesEn.join('; ')}.`,
  };
}

export async function anomalyTool(ctx: ShopContext): Promise<ToolOutcome> {
  const reports: TabPFNAnomalyReport[] = await runTabPFNAnomalyScan(
    ctx.cashClosings.map(c => ({
      businessDate: c.businessDate, expectedDrawerPaise: c.expectedDrawerPaise,
      physicalCashPaise: c.physicalCashPaise, differencePaise: c.differencePaise, notes: c.notes,
    })),
    ctx.expenses.map(e => ({ date: e.date, amountPaise: e.amountPaise, category: e.category, paymentMode: e.paymentMode, note: e.note })),
  );
  const flagged = reports.filter(r => r.type !== 'normal');
  return {
    tool: 'anomaly_scan',
    input: { scope: 'cash+expenses' },
    summary: `${flagged.length} anomaly(ies) flagged`,
    ur: flagged.length === 0
      ? 'کیش کلوزنگ اور اخراجات میں کوئی غیر معمولی بات نہیں ملی۔'
      : `TabPFN نے ${flagged.length} غیر معمولی بات پکڑی: ${flagged.slice(0, 3).map(r => r.description).join(' ')}`,
    en: flagged.length === 0
      ? 'No anomalies found in cash closings or expenses.'
      : `TabPFN flagged ${flagged.length} anomaly(ies): ${flagged.slice(0, 3).map(r => r.description).join(' ')}`,
  };
}

export async function addOrderTool(input: string, ctx: ShopContext, useModel: boolean): Promise<ToolOutcome> {
  // 1. Try the open-weight model for entity extraction, else deterministic match.
  let requested: Array<{ name: string; quantity: number }> = [];
  if (useModel) {
    const entities = await extractOrderWithModel(input);
    if (entities?.items) {
      requested = entities.items.map(i => ({ name: i.name, quantity: i.quantity && i.quantity > 0 ? i.quantity : 1 }));
    }
  }
  if (requested.length === 0) {
    // Deterministic fallback: match each meaningful token phrase against catalog.
    const matches = matchProducts(input, ctx.products, 3);
    requested = matches.map(m => ({ name: m.product.name, quantity: 1 }));
  }

  const lines: ProposedLine[] = [];
  for (const req of requested) {
    const best = matchProducts(req.name, ctx.products, 1)[0];
    if (!best) continue;
    const existing = lines.find(l => l.productId === best.product.id);
    if (existing) existing.quantity += req.quantity;
    else lines.push({
      productId: best.product.id,
      name: best.product.name,
      quantity: req.quantity,
      unitPricePaise: best.product.sellingPricePaise,
    });
  }

  const total = cartSubtotal(lines.map(l => ({ product: ctx.products.find(p => p.id === l.productId)!, quantity: l.quantity, unitPricePaise: l.unitPricePaise })));
  const names = lines.map(l => `${l.name.split('(')[0].trim()} ×${l.quantity}`);
  const proposal: MunshiProposal = { items: lines, totalPaise: total, requiresConfirmation: true };
  return {
    tool: 'draft_bill',
    input: { items: lines.length },
    summary: `${lines.length} line(s) proposed, ${formatPKR(total)}`,
    ur: lines.length === 0
      ? 'کوئی چیز نہیں ملی۔ براہ کرم پروڈکٹ کا نام یا بارکوڈ بتائیں۔'
      : `بل کا مسودہ تیار ہے: ${names.join('، ')} — کل ${formatPKR(total)}۔ تصدیق کے لیے "شامل کریں" دبائیں۔`,
    en: lines.length === 0
      ? 'No matching products found. Please give a product name or barcode.'
      : `Bill draft ready: ${names.join(', ')} — total ${formatPKR(total)}. Confirm before it is added.`,
    proposal: lines.length > 0 ? proposal : undefined,
  };
}

function helpTool(): ToolOutcome {
  return {
    tool: 'help',
    input: {},
    summary: 'help',
    ur: 'میں کم اسٹاک بتا سکتا ہوں، آج کی سیل، ادھار، منڈی ریٹ، اسٹاک کی پیش گوئی، اور بل تیار کر سکتا ہوں۔',
    en: 'I can report low stock, today\'s sales, Udhaar balances, live mandi rates, stock forecasts, and draft a bill for you.',
  };
}

// ── Agent loop ──────────────────────────────────────────────────────────────

/** Honest label for the configured LLM, or the deterministic engine alone. */
function describeEngine(): string {
  const name = process.env.GEMMA_MODEL_NAME;
  const where = process.env.OLLAMA_API_KEY ? 'Ollama Cloud' : 'local Ollama';
  if (!name && !process.env.OLLAMA_API_URL && !process.env.OLLAMA_API_KEY) return 'deterministic engine';
  return `${name ?? 'gemma2:2b'} (${where}) + deterministic engine`;
}

export async function runMunshi(input: string, ctx: ShopContext, options: MunshiOptions = {}): Promise<MunshiResponse> {
  const useModel = options.useModel ?? true;
  const trace = startTrace('munshi.run');
  const started = Date.now();
  const toolCalls: MunshiToolCall[] = [];

  const intentStart = Date.now();
  const intent = classifyIntent(input);
  addSpan(trace, 'classify_intent', 'intent', Date.now() - intentStart, { intent, input_len: input.length });

  const runTool = async (name: string, toolInput: Record<string, string | number>, fn: () => Promise<ToolOutcome> | ToolOutcome): Promise<ToolOutcome> => {
    const t0 = Date.now();
    try {
      const outcome = await withSpan(trace, name, 'tool', fn, { attributes: toolInput });
      toolCalls.push({ tool: outcome.tool, input: toolInput, ok: true, durationMs: Date.now() - t0, summary: outcome.summary });
      return outcome;
    } catch (err) {
      toolCalls.push({ tool: name, input: toolInput, ok: false, durationMs: Date.now() - t0, summary: err instanceof Error ? err.message : 'tool failed' });
      throw err;
    }
  };

  let outcome: ToolOutcome;
  let offline = !useModel;
  try {
    switch (intent) {
      case 'low_stock': outcome = await runTool('inventory_query', { filter: 'low_stock' }, () => lowStockTool(ctx)); break;
      case 'sales_summary': outcome = await runTool('sales_summary', { range: 'today' }, () => salesSummaryTool(ctx)); break;
      case 'udhaar_query': outcome = await runTool('udhaar_query', { filter: 'outstanding' }, () => udhaarTool(ctx)); break;
      case 'mandi_rates': offline = true; outcome = await runTool('mandi_rates', { query: input }, () => mandiTool(input)); break;
      case 'demand_forecast': offline = true; outcome = await runTool('demand_forecast', { horizon_days: 7 }, () => forecastTool(ctx)); break;
      case 'anomaly_scan': offline = true; outcome = await runTool('anomaly_scan', { scope: 'cash+expenses' }, () => anomalyTool(ctx)); break;
      case 'add_order': outcome = await runTool('draft_bill', { source: 'model+match' }, () => addOrderTool(input, ctx, useModel)); break;
      default: outcome = await runTool('help', {}, () => helpTool());
    }
  } catch {
    outcome = helpTool();
  }

  endTrace(trace, 'ok');

  return {
    traceId: trace.id,
    intent,
    reply: { ur: outcome.ur, en: outcome.en },
    toolCalls,
    proposal: outcome.proposal ?? null,
    model: useModel ? describeEngine() : 'deterministic engine',
    offline,
    latencyMs: Date.now() - started,
    spans: trace.spans,
  };
}
