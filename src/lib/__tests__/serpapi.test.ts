// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearMandiRatesCache, extractPriceRs, getWholesaleMandiRates } from '@/lib/ai/serpapi';

const realFetch = globalThis.fetch;

beforeEach(() => {
  clearMandiRatesCache();
});

afterEach(() => {
  clearMandiRatesCache();
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
});

describe('extractPriceRs', () => {
  test.each<[string, number | null]>([
    ['Rs. 2,450 per 20kg bag', 2450],
    ['PKR 15500 wholesale', 15500],
    ['price is ₨ 148.50 today', 148.5],
    ['rupees 9,200 for the bag', 9200],
    ['no price mentioned here', null],
    ['Rs. 5 (too small to be a rate)', null],
  ])('%s → %s', (text, expected) => {
    expect(extractPriceRs(text)).toBe(expected);
  });
});

describe('getWholesaleMandiRates', () => {
  test('without a key it returns only the verified benchmark index', async () => {
    vi.stubEnv('SERPAPI_API_KEY', '');
    const rates = await getWholesaleMandiRates();
    expect(rates).toHaveLength(5);
    expect(rates.every(r => r.source === 'benchmark')).toBe(true);
    expect(rates.every(r => r.liveQuotes === undefined)).toBe(true);
  });

  test('with a key it attaches live evidence only to matching commodities', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'test-key');
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          organic_results: [
            { title: 'Chakki atta wholesale rate today', snippet: 'The 20kg bag is Rs. 2,380 in Akbari Mandi.', link: 'https://example.com/atta' },
            { title: 'Sugar market update', snippet: 'Sugar selling at PKR 6,950 per 50kg bag.', link: 'https://example.com/sugar' },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const rates = await getWholesaleMandiRates();
    const atta = rates.find(r => r.commodity.includes('Atta'))!;
    const sugar = rates.find(r => r.commodity.includes('Sugar'))!;
    const oil = rates.find(r => r.commodity.includes('Cooking Oil'))!;

    expect(atta.source).toBe('benchmark+live');
    expect(atta.liveQuotes?.[0].priceRs).toBe(2380);
    expect(atta.marketRateRs).toBe(2200); // benchmark preserved — snippet units are ambiguous
    expect(sugar.source).toBe('benchmark+live');
    expect(oil.source).toBe('benchmark'); // no matching snippet → not labelled live
  });

  test('caches lookups so the free SerpApi tier is not burned per page view', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'test-key');
    const spy = vi.fn(async () => new Response(JSON.stringify({ organic_results: [] }), { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    await getWholesaleMandiRates();
    await getWholesaleMandiRates();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('a failing SerpApi call never breaks the response', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'test-key');
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const rates = await getWholesaleMandiRates();
    expect(rates).toHaveLength(5);
    expect(rates.every(r => r.source === 'benchmark')).toBe(true);
  });
});
