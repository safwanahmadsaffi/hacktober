import { describe, test, expect, vi, afterEach } from 'vitest';
import { runTabPFNDemandForecast } from '@/lib/ai/tabpfn';

const products = [
  { id: 'p1', name: 'Atta 5kg', stock: 24, unit: 'pack', lowStockThreshold: 5, sellingPricePaise: 65000 },
  { id: 'p2', name: 'Milk 1L', stock: 13, unit: 'litre', lowStockThreshold: 6, sellingPricePaise: 29000 },
  { id: 'p3', name: 'Sugar 1kg', stock: 3, unit: 'kg', lowStockThreshold: 8, sellingPricePaise: 15500 },
];

const today = new Date().toISOString().slice(0, 10);
const salesHistory = [
  { productId: 'p1', quantity: 2, businessDate: today },
  { productId: 'p2', quantity: 4, businessDate: today },
];

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TABPFN_API_KEY;
});

describe('runTabPFNDemandForecast', () => {
  test('falls back to the on-device engine when no API key is set', async () => {
    delete process.env.TABPFN_API_KEY;
    const out = await runTabPFNDemandForecast(products, salesHistory);

    expect(out).toHaveLength(3);
    expect(out.every(f => f.source === 'on-device')).toBe(true);
    // Sugar is at/below its threshold, so it must always be flagged high risk.
    const sugar = out.find(f => f.productId === 'p3')!;
    expect(sugar.stockoutRisk).toBe('high');
    expect(sugar.recommendedReorderQty).toBeGreaterThan(0);
  });

  test('uses the live TabPFN API when a key is set, and sends CSV headers', async () => {
    process.env.TABPFN_API_KEY = 'test-key';

    const putBodies: string[] = [];
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? 'GET';

      if (method === 'PUT') {
        putBodies.push(String(init?.body ?? ''));
        return new Response('', { status: 200 });
      }
      if (href.endsWith('/tabpfn/prepare_train_set_upload')) {
        return json({
          train_set_upload_id: 'train-1',
          x_train_info: { signed_urls: ['https://upload.test/x'], required_headers: { 'Content-Type': 'text/csv', Host: 'storage.googleapis.com' } },
          y_train_info: { signed_urls: ['https://upload.test/y'], required_headers: { 'Content-Type': 'text/csv' } },
        });
      }
      if (href.endsWith('/tabpfn/fit')) return json({ fitted_train_set_id: 'fit-1' });
      if (href.endsWith('/tabpfn/prepare_test_set_upload')) {
        return json({
          test_set_upload_id: 'test-1',
          x_test_info: { signed_urls: ['https://upload.test/xt'], required_headers: { 'Content-Type': 'text/csv' } },
        });
      }
      if (href.endsWith('/tabpfn/predict')) {
        return json({ prediction: [7, 5, 3], metadata: { billing_model_version: 'v3.5' } });
      }
      return new Response('unexpected', { status: 500 });
    }));

    const out = await runTabPFNDemandForecast(products, salesHistory);

    expect(out.every(f => f.source === 'TabPFN-API')).toBe(true);
    expect(out.map(f => f.predictedDemand7Days)).toEqual([7, 5, 3]);
    expect(out.every(f => f.forecastConfidence === 0.9)).toBe(true);

    // Every uploaded CSV must carry a header row, or the API treats row 1 as column names.
    expect(putBodies.length).toBe(3);
    for (const body of putBodies) {
      expect(body.split('\n')[0]).toMatch(/prev_week_units|target/);
    }
  });

  test('falls back cleanly when the API call fails', async () => {
    process.env.TABPFN_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const out = await runTabPFNDemandForecast(
      products.map(p => ({ ...p, id: `${p.id}-fail` })),
      salesHistory.map(s => ({ ...s, productId: `${s.productId}-fail` })),
    );

    expect(out).toHaveLength(3);
    expect(out.every(f => f.source === 'on-device')).toBe(true);
  });
});
