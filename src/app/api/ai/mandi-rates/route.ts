import { NextResponse } from 'next/server';
import { getWholesaleMandiRates } from '@/lib/ai/serpapi';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || undefined;

    const rates = await getWholesaleMandiRates(query);
    const liveRows = rates.filter(r => r.source === 'benchmark+live').length;
    return NextResponse.json({
      success: true,
      provider: 'SerpApi / Wholesale Mandi Intelligence',
      engine: liveRows > 0 ? 'serpapi-live-evidence' : 'mandi-benchmark-index',
      liveRows,
      data: rates,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mandi rates error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
