/**
 * Mastra orchestration adapter for the Munshi AI agent.
 *
 * Mastra is an open-source agent framework: it takes tool definitions and a model
 * and runs the tool-calling loop for you. Here we expose the *same* shop tools
 * (stock, sales, udhaar, mandi rates, forecast, anomalies, draft bill) to Mastra
 * so the Munshi can be driven by any open-weight model through Mastra's model
 * router (e.g. a local Ollama Gemma, or Backboard, or any provider).
 *
 * Two deliberate design choices:
 *  - Mastra/zod are imported at **runtime**, so the register compiles and runs
 *    even on a laptop where the packages (or a model) are not available.
 *  - If the model cannot be reached, we transparently fall back to the built-in
 *    deterministic agent, so the shopkeeper always gets an answer.
 */

import { runMunshi, lowStockTool, salesSummaryTool, udhaarTool, mandiTool, forecastTool, anomalyTool, addOrderTool, type MunshiResponse, type ShopContext } from './munshi';

const runtimeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<Record<string, unknown>>;

type ToolFactory = (config: Record<string, unknown>) => unknown;
type ZodString = { optional: () => unknown };
type ZodLike = { object: (shape: Record<string, unknown>) => unknown; string: () => ZodString };
type AgentLike = { generate: (prompt: string) => Promise<Record<string, unknown>> };
type AgentCtor = new (config: Record<string, unknown>) => AgentLike;

/**
 * Mastra model-router string, e.g. 'ollama-cloud/gemma4:31b' or 'openai/gpt-4o-mini'.
 * Defaults to Ollama Cloud when an OLLAMA_API_KEY is present (no local install
 * needed), otherwise the local Ollama daemon.
 */
export const DEFAULT_MASTRA_MODEL =
  process.env.MASTRA_MODEL ?? (process.env.OLLAMA_API_KEY ? 'ollama-cloud/gemma4:31b' : 'ollama/gemma2:2b');

export type MastraRunResult =
  | { ok: true; via: 'mastra'; model: string; text: string; toolCalls: string[] }
  | { ok: false; via: 'fallback'; reason: string; data: MunshiResponse };

/**
 * Run the Munshi through Mastra. Returns a tagged union so callers can tell
 * whether the open-source orchestrator handled it or the deterministic engine did.
 */
export async function runMunshiViaMastra(
  prompt: string,
  ctx: ShopContext,
  model: string = DEFAULT_MASTRA_MODEL,
): Promise<MastraRunResult> {
  try {
    const toolsMod = await runtimeImport('@mastra/core/tools');
    const agentMod = await runtimeImport('@mastra/core/agent');
    const zodMod = await runtimeImport('zod');

    const createTool = toolsMod.createTool as ToolFactory | undefined;
    const Agent = agentMod.Agent as AgentCtor | undefined;
    const z = zodMod.z as ZodLike | undefined;
    if (!createTool || !Agent || !z) throw new Error('Mastra or zod not available');

    // The same tools the deterministic agent uses — now exposed to the model.
    const tools = {
      low_stock: createTool({
        id: 'low_stock',
        description: 'List products at or below their low-stock threshold.',
        inputSchema: z.object({}),
        execute: async () => {
          const o = lowStockTool(ctx);
          return { ur: o.ur, en: o.en };
        },
      }),
      sales_summary: createTool({
        id: 'sales_summary',
        description: "Today's and all-time confirmed sales totals.",
        inputSchema: z.object({}),
        execute: async () => {
          const o = salesSummaryTool(ctx);
          return { ur: o.ur, en: o.en };
        },
      }),
      udhaar_query: createTool({
        id: 'udhaar_query',
        description: 'Outstanding customer credit (udhaar) balances.',
        inputSchema: z.object({}),
        execute: async () => {
          const o = udhaarTool(ctx);
          return { ur: o.ur, en: o.en };
        },
      }),
      mandi_rates: createTool({
        id: 'mandi_rates',
        description: 'Live wholesale commodity (mandi) rates.',
        inputSchema: z.object({ query: z.string().optional() }),
        execute: async (input: Record<string, unknown>) => {
          const o = await mandiTool(typeof input?.query === 'string' ? input.query : '');
          return { ur: o.ur, en: o.en };
        },
      }),
      demand_forecast: createTool({
        id: 'demand_forecast',
        description: 'Seven-day demand forecast and reorder quantity per product.',
        inputSchema: z.object({}),
        execute: async () => {
          const o = await forecastTool(ctx);
          return { ur: o.ur, en: o.en };
        },
      }),
      anomaly_scan: createTool({
        id: 'anomaly_scan',
        description: 'Flag cash-drawer and expense anomalies.',
        inputSchema: z.object({}),
        execute: async () => {
          const o = await anomalyTool(ctx);
          return { ur: o.ur, en: o.en };
        },
      }),
      draft_bill: createTool({
        id: 'draft_bill',
        description: 'Turn a free-text order (e.g. "2 kg atta") into proposed bill lines.',
        inputSchema: z.object({ request: z.string() }),
        execute: async (input: Record<string, unknown>) => {
          const o = await addOrderTool(typeof input?.request === 'string' ? input.request : '', ctx, true);
          return { ur: o.ur, en: o.en, lines: o.proposal?.items.length ?? 0 };
        },
      }),
    };

    const agent = new Agent({
      id: 'munshi',
      name: 'Munshi AI',
      instructions: [
        'You are Munshi, the Urdu/English accountant for a Pakistani kiryana shop.',
        'Use the available tools to answer about stock, sales, udhaar, mandi rates,',
        'forecasts and anomalies. Never invent numbers — always call a tool.',
        'Reply in the language the shopkeeper used (Urdu, Roman Urdu, or English).',
      ].join(' '),
      model,
      tools,
    });

    const res = await agent.generate(prompt);
    const text = typeof res.text === 'string' ? res.text : '';
    const rawCalls = Array.isArray(res.toolCalls) ? (res.toolCalls as Array<Record<string, unknown>>) : [];
    // Mastra/AI-SDK versions nest the tool name differently — be tolerant.
    const nameOf = (c: Record<string, unknown>): string => {
      const direct = c.toolName ?? c.name ?? c.tool;
      if (typeof direct === 'string' && direct) return direct;
      const payload = c.payload as Record<string, unknown> | undefined;
      const nested = payload?.toolName ?? payload?.name ?? payload?.tool;
      if (typeof nested === 'string' && nested) return nested;
      return 'tool';
    };
    const toolCalls = rawCalls.map(nameOf);

    if (!text) throw new Error('Mastra returned an empty response');
    return { ok: true, via: 'mastra', model, text, toolCalls };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Mastra unavailable';
    return { ok: false, via: 'fallback', reason, data: await runMunshi(prompt, ctx, { useModel: true }) };
  }
}
