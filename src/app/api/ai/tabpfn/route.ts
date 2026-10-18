import { NextResponse } from 'next/server';
import { runTabPFNDemandForecast, runTabPFNAnomalyScan } from '@/lib/ai/tabpfn';

export async function POST(req: Request) {
  try {
    const { action, products = [], salesHistory = [], closings = [], expenses = [] } = await req.json();

    if (action === 'forecast') {
      const forecast = await runTabPFNDemandForecast(products, salesHistory);
      const liveApi = forecast.some(f => f.source === 'TabPFN-API');
      return NextResponse.json({
        success: true,
        engine: liveApi ? 'priorlabs-tabpfn-api' : 'on-device-heuristic',
        model: liveApi ? 'PriorLabs TabPFN-3.5 (live REST API)' : 'DukaanVoice on-device heuristic',
        forecast,
      });
    }

    if (action === 'anomalies') {
      const anomalies = await runTabPFNAnomalyScan(closings, expenses);
      return NextResponse.json({
        success: true,
        engine: 'deterministic-scan',
        model: 'DukaanVoice deterministic anomaly scan',
        anomalies,
      });
    }

    return NextResponse.json({ error: 'Valid action required: "forecast" or "anomalies"' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TabPFN error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
