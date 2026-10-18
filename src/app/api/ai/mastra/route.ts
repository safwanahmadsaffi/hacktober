import { NextResponse } from 'next/server';
import type { ShopContext } from '@/lib/ai/munshi';
import { runMunshiViaMastra, DEFAULT_MASTRA_MODEL } from '@/lib/ai/mastra-agent';

/**
 * POST /api/ai/mastra
 *
 * Runs the Munshi through the open-source **Mastra** agent framework, which
 * handles the tool-calling loop against an open-weight model (defaults to
 * `ollama-cloud/gemma4:31b` when OLLAMA_API_KEY is set, else a local Ollama
 * `ollama/gemma2:2b`).
 *
 * The same shop tools are exposed here as in the built-in agent. If no model is
 * reachable the response is tagged `via: "fallback"` and contains the
 * deterministic agent's answer, so the shopkeeper is never blocked.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      context?: Partial<ShopContext>;
      model?: string;
    };
    const prompt = (body.prompt ?? '').trim();
    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    const ctx: ShopContext = {
      products: body.context?.products ?? [],
      customers: body.context?.customers ?? [],
      transactions: body.context?.transactions ?? [],
      expenses: body.context?.expenses ?? [],
      cashClosings: body.context?.cashClosings ?? [],
    };

    const result = await runMunshiViaMastra(prompt, ctx, body.model || DEFAULT_MASTRA_MODEL);
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mastra agent error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
