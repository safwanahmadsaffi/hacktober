// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  classifyIntent,
  deriveSalesHistory,
  matchProducts,
  parseModelEntities,
  runMunshi,
  salesSummaryTool,
  type ShopContext,
} from '@/lib/ai/munshi';
import { SEED_CUSTOMERS, SEED_EXPENSES, SEED_PRODUCTS } from '@/lib/seed';
import type { Transaction } from '@/types';
import { rupeesToPaise } from '@/lib/financial';

function ctx(overrides: Partial<ShopContext> = {}): ShopContext {
  return {
    products: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    transactions: [],
    expenses: SEED_EXPENSES,
    cashClosings: [],
    ...overrides,
  };
}

describe('intent classification (multilingual)', () => {
  test.each<[string, string]>([
    ['kam stock batao', 'low_stock'],
    ['aaj ki sale kitni hui', 'sales_summary'],
    ['kitna udhaar baqi hai', 'udhaar_query'],
    ['mandi rate kya hai aaj', 'mandi_rates'],
    ['kya mangwana chahiye', 'demand_forecast'],
    ['cash drawer mein farq hai', 'anomaly_scan'],
    ['2 kg atta add karo', 'add_order'],
    ['salam', 'help'],
  ])('"%s" → %s', (input, expected) => {
    expect(classifyIntent(input)).toBe(expected);
  });
});

describe('deterministic product matching', () => {
  test('matches by catalog tokens and sku', () => {
    const byName = matchProducts('atta', SEED_PRODUCTS);
    expect(byName[0].product.id).toBe('prod-atta');
    const bySku = matchProducts('SUNRIDGE-5KG', SEED_PRODUCTS);
    expect(bySku[0].product.id).toBe('prod-atta');
  });

  test('returns nothing for unrelated input', () => {
    expect(matchProducts('zzzzz', SEED_PRODUCTS)).toHaveLength(0);
  });

  test('understands Roman-Urdu shop words', () => {
    expect(matchProducts('doodh', SEED_PRODUCTS)[0].product.id).toBe('prod-milk');
    expect(matchProducts('cheeni', SEED_PRODUCTS)[0].product.id).toBe('prod-sugar');
  });
});

describe('sales summary', () => {
  test('excludes udhaar repayment receipts from revenue', () => {
    const day = new Date().toISOString().slice(0, 10);
    const receipt = (id: string, productId: string, amount: number): Transaction => ({
      id, type: 'sale', status: 'confirmed', paymentMethod: 'cash',
      items: [{ productId, productName: productId, unit: 'piece', quantity: 1, unitPricePaise: amount, totalPaise: amount }],
      subtotalPaise: amount, totalPaise: amount, businessDate: day, createdAt: day,
    });

    const out = salesSummaryTool(ctx({
      transactions: [receipt('t1', 'prod-atta', 65000), receipt('t2', 'udhaar-repay', 318500)],
    }));

    expect(out.en).toContain('Rs. 650.00'); // the real sale is counted
    expect(out.en).not.toContain('3,185');  // the repayment is not revenue
  });
});

describe('model entity parsing', () => {
  test('recovers items from a ```json fenced reply (real model output)', () => {
    const raw = '```json\n{\n  "intent": "sale",\n  "items": [\n    {"name": "atta", "quantity": 2},\n    {"name": "doodh", "quantity": 1}\n  ]\n}\n```';
    const parsed = parseModelEntities(raw);
    expect(parsed?.items).toEqual([
      { name: 'atta', quantity: 2 },
      { name: 'doodh', quantity: 1 },
    ]);
  });

  test('tolerates prose around the JSON and coerces quantities', () => {
    const raw = 'Sure! Here is the bill: {"intent":"sale","items":[{"name":"milk","quantity":"3"}]} hope that helps';
    expect(parseModelEntities(raw)?.items).toEqual([{ name: 'milk', quantity: 3 }]);
  });

  test('returns null for junk or empty items', () => {
    expect(parseModelEntities('I did not understand')).toBeNull();
    expect(parseModelEntities('{"intent":"sale","items":[]}')).toBeNull();
  });
});

describe('sales history derivation', () => {
  test('only confirmed sales count, flattened per line item', () => {
    const txns: Transaction[] = [
      {
        id: 't1', type: 'sale', status: 'confirmed', paymentMethod: 'cash',
        items: [{ productId: 'prod-atta', productName: 'Atta', unit: 'pack', quantity: 2, unitPricePaise: 65000, totalPaise: 130000 }],
        subtotalPaise: 130000, totalPaise: 130000, businessDate: '2026-10-18', createdAt: '2026-10-18T09:00:00Z',
      },
      {
        id: 't2', type: 'sale', status: 'draft', paymentMethod: 'cash',
        items: [{ productId: 'prod-milk', productName: 'Milk', unit: 'litre', quantity: 5, unitPricePaise: 29000, totalPaise: 145000 }],
        subtotalPaise: 145000, totalPaise: 145000, businessDate: '2026-10-18', createdAt: '2026-10-18T10:00:00Z',
      },
    ];
    const rows = deriveSalesHistory(txns);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'prod-atta', quantity: 2 });
  });
});

describe('runMunshi agent (deterministic / offline mode)', () => {
  test('low-stock query returns a traced, bilingual answer', async () => {
    const res = await runMunshi('kam stock batao', ctx(), { useModel: false });
    expect(res.intent).toBe('low_stock');
    expect(res.toolCalls[0].tool).toBe('inventory_query');
    expect(res.reply.ur.length).toBeGreaterThan(0);
    expect(res.reply.en.length).toBeGreaterThan(0);
    expect(res.traceId).toBeTruthy();
    expect(res.spans.length).toBeGreaterThan(0);
    // sugar is seeded below threshold
    expect(res.reply.en).toMatch(/low/i);
  });

  test('udhaar query sums outstanding balances', async () => {
    const res = await runMunshi('udhaar', ctx(), { useModel: false });
    expect(res.intent).toBe('udhaar_query');
    const expected = SEED_CUSTOMERS.reduce((s, c) => s + Math.max(0, c.balancePaise), 0);
    expect(res.reply.en).toContain((expected / 100).toLocaleString('en-PK'));
  });

  test('add_order produces a confirmable proposal at the selling price', async () => {
    const res = await runMunshi('atta add karo', ctx(), { useModel: false });
    expect(res.intent).toBe('add_order');
    expect(res.proposal).not.toBeNull();
    expect(res.proposal!.requiresConfirmation).toBe(true);
    expect(res.proposal!.items[0].productId).toBe('prod-atta');
    expect(res.proposal!.totalPaise).toBe(rupeesToPaise(650));
  });

  test('unknown input falls back to help and never throws', async () => {
    const res = await runMunshi('salam alaikum', ctx(), { useModel: false });
    expect(res.intent).toBe('help');
    expect(res.toolCalls[0].tool).toBe('help');
  });
});
