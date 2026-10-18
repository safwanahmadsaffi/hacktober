import { NextResponse } from 'next/server';
import { runMunshi, type ShopContext } from '@/lib/ai/munshi';

/**
 * POST /api/ai/munshi
 *
 * The shop register is offline-first (IndexedDB), so the client sends its current
 * ledger snapshot as `context`. The agent then answers using real tool calls.
 * Nothing is persisted here — proposals are returned for the user to confirm.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: string; context?: Partial<ShopContext> };
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

    const data = await runMunshi(prompt, ctx, { useModel: true });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Munshi agent error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
