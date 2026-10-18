'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Robot, PaperPlaneRight, Microphone, SpeakerHigh, Sparkle,
  CheckCircle, WarningCircle, Graph, ShieldCheck, Storefront, Cpu,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { formatPKR, isRealSale } from '@/lib/financial';
import { revenueSeries, useBusinessToday } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import TrendChart from '@/components/charts/TrendChart';
import { speakText } from '@/lib/ai/elevenlabs';
import type { MunshiResponse } from '@/lib/ai/munshi';
import type { TabPFNDemandForecast, TabPFNAnomalyReport } from '@/lib/ai/tabpfn';
import type { WholesaleRate } from '@/lib/ai/serpapi';
import PageHeader from '@/components/common/PageHeader';

interface MunshiApiResponse {
  success: boolean;
  data?: MunshiResponse;
  error?: string;
}

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: 'کم اسٹاک', prompt: 'کم اسٹاک کون سی اشیاء کی ہے؟' },
  { label: 'آج کی سیل', prompt: 'آج کی سیل کتنی ہوئی؟' },
  { label: 'ادھار', prompt: 'کل بقایا ادھار کتنا ہے؟' },
  { label: 'منڈی ریٹ', prompt: 'آج آٹا اور چینی کا منڈی ریٹ کیا ہے؟' },
  { label: 'اسٹاک پیش گوئی', prompt: 'اگلے سات دن میں کیا منگوانا چاہیے؟' },
  { label: 'بے ضابطگی', prompt: 'کیش کلوزنگ میں کوئی فرق یا بے ضابطگی ہے؟' },
];

export default function MunshiPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const today = useBusinessToday();
  const pulse = useMemo(() => revenueSeries(state.transactions, 7, today), [state.transactions, today]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MunshiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const [forecast, setForecast] = useState<TabPFNDemandForecast[] | null>(null);
  const [anomalies, setAnomalies] = useState<TabPFNAnomalyReport[] | null>(null);
  const [rates, setRates] = useState<WholesaleRate[] | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const isUrdu = state.selectedLanguage.code === 'ur';

  const ask = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const res = await fetch('/api/ai/munshi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: q,
          context: {
            products: state.products,
            customers: state.customers,
            transactions: state.transactions,
            expenses: state.expenses,
            cashClosings: state.cashClosings,
          },
        }),
      });
      const json = (await res.json()) as MunshiApiResponse;
      if (!json.success || !json.data) throw new Error(json.error ?? 'Agent error');
      setResult(json.data);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent error');
    } finally {
      setBusy(false);
    }
  }, [state.products, state.customers, state.transactions, state.expenses, state.cashClosings]);

  const loadInsights = useCallback(async () => {
    setInsightsBusy(true);
    try {
      const [f, a, r] = await Promise.all([
        fetch('/api/ai/tabpfn', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'forecast',
            products: state.products.map(p => ({ id: p.id, name: p.name, stock: p.stock, unit: p.unit, lowStockThreshold: p.lowStockThreshold, sellingPricePaise: p.sellingPricePaise })),
            salesHistory: state.transactions.filter(t => t.status === 'confirmed' && isRealSale(t)).flatMap(t => t.items.map(i => ({ productId: i.productId, quantity: i.quantity, businessDate: t.businessDate }))),
          }),
        }).then(res => res.json()),
        fetch('/api/ai/tabpfn', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'anomalies',
            closings: state.cashClosings.map(c => ({ businessDate: c.businessDate, expectedDrawerPaise: c.expectedDrawerPaise, physicalCashPaise: c.physicalCashPaise, differencePaise: c.differencePaise })),
            expenses: state.expenses.map(e => ({ date: e.date, amountPaise: e.amountPaise, category: e.category, paymentMode: e.paymentMode })),
          }),
        }).then(res => res.json()),
        fetch('/api/ai/mandi-rates').then(res => res.json()),
      ]);
      if (f.success) setForecast(f.forecast as TabPFNDemandForecast[]);
      if (a.success) setAnomalies(a.anomalies as TabPFNAnomalyReport[]);
      if (r.success) setRates(r.data as WholesaleRate[]);
    } catch {
      setError('Could not load shop intelligence.');
    } finally {
      setInsightsBusy(false);
    }
  }, [state.products, state.transactions, state.cashClosings, state.expenses]);

  function toggleMic() {
    type SR = new () => { lang: string; interimResults: boolean; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void };
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setPrompt('کم اسٹاک کون سی اشیا کی ہے؟');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = isUrdu ? 'ur-PK' : 'en-PK';
    rec.interimResults = false;
    rec.onresult = e => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      setPrompt(transcript);
      void ask(transcript);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function addProposalToBill() {
    if (!result?.proposal) return;
    let count = 0;
    for (const line of result.proposal.items) {
      const product = state.products.find(p => p.id === line.productId);
      if (product) {
        dispatch({ type: 'ADD_TO_CART', payload: { product, quantity: line.quantity } });
        count += 1;
      }
    }
    setAdded(`${count} item(s) added to the current bill.`);
    setTimeout(() => router.push('/'), 900);
  }

  return (
    <div>
      <PageHeader
        icon={<Robot weight="fill" />}
        title="Munshi AI"
        subtitle={
          <>
            On-device open-source AI accountant — سوال پوچھیں، منشی جواب دے گا۔ Powered by Gemma, TabPFN, SerpApi &amp; ElevenLabs.
          </>
        }
        related={[
          { href: '/products', label: 'Products', hint: 'Answers about stock come from here' },
          { href: '/transactions', label: 'Transactions', hint: 'Sales answers come from this ledger' },
          { href: '/udhaar', label: 'Udhaar Khata', hint: 'Credit balances live here' },
          { href: '/reports', label: 'Reports', hint: 'Forecasts and anomalies' },
        ]}
      />

      {/* Shop pulse — instant visual context for whatever the merchant asks */}
      <ChartCard
        title="Shop pulse — sales, last 7 days"
        hint="A quick visual so the day's trading pattern is clear before you query the numbers"
        style={{ marginBottom: '1rem' }}
      >
        <TrendChart
          series={pulse}
          formatValue={formatPKR}
          ariaLabel="Daily sales trend for the last seven days"
          emptyMessage="Confirm a sale to start the trend"
        />
      </ChartCard>

      {/* Provider / capability chips */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' }}>
        <span className="badge badge-info"><Cpu size={14} /> Gemma (open-weights)</span>
        <span className="badge badge-info"><Graph size={14} /> TabPFN forecast</span>
        <span className="badge badge-info"><Storefront size={14} /> SerpApi mandi rates</span>
        <span className="badge badge-info"><SpeakerHigh size={14} /> ElevenLabs voice</span>
        <span className="badge badge-neutral"><ShieldCheck size={14} /> Sentry traced</span>
        <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Local &amp; Offline capable</span>
      </div>

      {/* Ask panel */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.875rem' }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.prompt} className="btn btn-secondary btn-sm" onClick={() => ask(a.prompt)} disabled={busy}>
              <Sparkle size={14} /> {a.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'stretch' }}>
          <input
            id="munshi-input"
            type="text"
            className="form-control"
            style={{ flex: 1 }}
            placeholder={isUrdu ? 'منشی سے پوچھیں… مثلاً "کم اسٹاک" یا "2 کلو آٹا بل میں ڈالو"' : 'Ask the Munshi… e.g. "low stock" or "add 2 kg atta"'}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(prompt)}
            aria-label="Ask Munshi AI"
          />
          <button
            className={`btn btn-secondary${listening ? ' recording' : ''}`}
            onClick={toggleMic}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            title="Voice input"
          >
            <Microphone weight={listening ? 'fill' : 'regular'} size={18} />
          </button>
          <button className="btn btn-primary" onClick={() => ask(prompt)} disabled={busy || !prompt.trim()}>
            <PaperPlaneRight weight="fill" size={16} /> {busy ? 'Soch raha hai…' : 'Ask'}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: '.75rem', color: 'var(--danger)', fontSize: '.875rem' }}>
            <WarningCircle weight="fill" size={16} /> {error}
          </div>
        )}
      </div>

      {/* Answer */}
      {result && (
        <div className="card" style={{ marginBottom: '1rem' }} role="status" aria-live="polite">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <h2 className="card-title" style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <Robot weight="fill" /> Answer
            </h2>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-info">{result.intent.replace('_', ' ')}</span>
              <span className="badge badge-neutral">{result.latencyMs} ms</span>
              <span className="badge badge-neutral">{result.model}</span>
            </div>
          </div>

          <div dir="rtl" lang="ur" style={{ fontSize: '1.05rem', lineHeight: 1.9, marginBottom: '.75rem' }}>
            {result.reply.ur}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '.925rem', marginBottom: '.875rem' }}>
            {result.reply.en}
          </div>

          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.875rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => speakText(result.reply.ur, 'ur')}>
              <SpeakerHigh size={16} /> اردو میں سنیں
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => speakText(result.reply.en, 'en')}>
              <SpeakerHigh size={16} /> Listen (English)
            </button>
          </div>

          {result.proposal && (
            <div style={{ border: '1px solid var(--accent-tint)', background: 'var(--surface-blue)', borderRadius: 'var(--radius)', padding: '.875rem', marginBottom: '.875rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '.5rem' }}>
                Proposed bill (needs your confirmation) — تجویز کردہ بل
              </div>
              <table className="data-table" style={{ marginBottom: '.625rem' }}>
                <thead>
                  <tr><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th></tr>
                </thead>
                <tbody>
                  {result.proposal.items.map(l => (
                    <tr key={l.productId}>
                      <td>{l.name}</td>
                      <td className="text-right amount">{l.quantity}</td>
                      <td className="text-right amount">{formatPKR(l.unitPricePaise * l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <strong>Total: {formatPKR(result.proposal.totalPaise)}</strong>
                <button className="btn btn-primary btn-sm" onClick={addProposalToBill}>
                  <CheckCircle weight="fill" size={16} /> Add to current bill
                </button>
              </div>
              {added && <p role="status" style={{ color: 'var(--success)', fontSize: '.85rem', marginTop: '.5rem' }}>{added}</p>}
            </div>
          )}

          {/* Tool calls + trace */}
          <details open>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '.5rem' }}>
              Agent trace ({result.toolCalls.length} tool call{result.toolCalls.length === 1 ? '' : 's'})
            </summary>
            <table className="data-table">
              <thead>
                <tr><th>Tool</th><th>Status</th><th style={{ textAlign: 'right' }}>Latency</th><th>Summary</th></tr>
              </thead>
              <tbody>
                {result.toolCalls.map((c, i) => (
                  <tr key={i}>
                    <td className="num">{c.tool}</td>
                    <td>{c.ok ? <span className="badge badge-success">ok</span> : <span className="badge badge-danger">error</span>}</td>
                    <td className="text-right amount">{c.durationMs} ms</td>
                    <td className="text-muted text-small">{c.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      {/* Shop intelligence */}
      <div className="card">
        <div className="card-header" style={{ alignItems: 'center' }}>
          <h2 className="card-title" style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <Graph weight="fill" /> Shop Intelligence <span className="text-muted text-small">(TabPFN + SerpApi)</span>
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={loadInsights} disabled={insightsBusy}>
            {insightsBusy ? 'Analysing…' : 'Run analysis'}
          </button>
        </div>

        {forecast && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '.5rem', display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
              7-day demand &amp; stockout forecast
              <span className={`badge ${forecast.some(f => f.source === 'TabPFN-API') ? 'badge-success' : 'badge-neutral'}`}>
                {forecast.some(f => f.source === 'TabPFN-API') ? 'TabPFN live API' : 'on-device model'}
              </span>
            </h3>
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>7-day demand</th><th>Risk</th><th style={{ textAlign: 'right' }}>Reorder</th></tr>
              </thead>
              <tbody>
                {forecast
                  .slice()
                  .sort((a, b) => (a.stockoutRisk === 'high' ? -1 : 1) - (b.stockoutRisk === 'high' ? -1 : 1))
                  .slice(0, 8)
                  .map(f => (
                    <tr key={f.productId}>
                      <td>{f.productName.split('(')[0].trim()}</td>
                      <td className="text-right amount">{f.currentStock} {f.unit}</td>
                      <td className="text-right amount">{f.predictedDemand7Days}</td>
                      <td>
                        <span className={`badge ${f.stockoutRisk === 'high' ? 'badge-danger' : f.stockoutRisk === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                          {f.stockoutRisk}
                        </span>
                      </td>
                      <td className="text-right amount">{f.recommendedReorderQty}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {anomalies && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '.5rem' }}>Cash &amp; expense anomalies</h3>
            {anomalies.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.5rem 0', borderBottom: '1px solid var(--line)' }}>
                <span className={`badge ${a.type === 'normal' ? 'badge-success' : 'badge-warning'}`}>{a.type.replace('_', ' ')}</span>
                <span className="text-small">{a.description} <span className="text-muted">(score {a.anomalyScore})</span></span>
              </div>
            ))}
          </div>
        )}

        {rates && (
          <div>
            <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '.5rem' }}>Wholesale mandi rates (verified index + SerpApi grounding)</h3>
            <table className="data-table">
              <thead>
                <tr><th>Commodity</th><th style={{ textAlign: 'right' }}>Wholesale</th><th style={{ textAlign: 'right' }}>Retail /kg</th><th>Trend</th><th>Source</th></tr>
              </thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.commodity}>
                    <td>{r.commodity}</td>
                    <td className="text-right amount">{formatPKR(r.marketRateRs * 100)} / {r.wholesaleUnit}</td>
                    <td className="text-right amount">{formatPKR(r.retailBenchmarkRs * 100)}</td>
                    <td><span className={`badge ${r.trend === 'up' ? 'badge-danger' : r.trend === 'down' ? 'badge-success' : 'badge-neutral'}`}>{r.trend}</span></td>
                    <td className="text-muted text-small">
                      {r.marketSource}
                      {r.source === 'benchmark+live' && (
                        <>
                          {' '}
                          <span
                            className="badge badge-info"
                            title={(r.liveQuotes ?? []).map(q => `${q.title}${q.priceRs ? ` — Rs. ${q.priceRs}` : ''}`).join('\n')}
                          >
                            live
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!forecast && !anomalies && !rates && (
          <p className="text-muted text-small">
            Run the analysis to forecast stockouts, scan for cash anomalies, and pull live mandi rates. Works offline with the embedded model.
          </p>
        )}
      </div>
    </div>
  );
}
