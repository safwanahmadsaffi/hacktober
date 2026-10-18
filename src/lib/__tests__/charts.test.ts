import { describe, expect, test } from 'vitest';
import {
  lastDays, dailySeries, revenueSeries, paymentMix, cartMix,
  expensesByCategory, topDebtors, lowestStock, stockValueByCategory,
  cashSeries, moneySplit,
} from '@/lib/charts';

import type { Transaction, Customer, Product, Expense, Cart } from '@/types';

const TODAY = '2026-10-18';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'sale', status: 'confirmed', items: [],
    subtotalPaise: 0, totalPaise: 0, paymentMethod: 'cash',
    businessDate: TODAY, createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('lastDays', () => {
  test('returns N dates ending today, oldest first', () => {
    expect(lastDays(3, TODAY)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18']);
  });
  test('returns nothing before client hydration (empty today)', () => {
    expect(lastDays(7, '')).toEqual([]);
  });
});

describe('dailySeries / revenueSeries', () => {
  test('includes zero-value days so trends show quiet days', () => {
    const series = dailySeries([
      tx({ businessDate: '2026-10-18', totalPaise: 5000 }),
      tx({ businessDate: '2026-10-16', type: 'purchase', totalPaise: 2000 }),
      tx({ businessDate: '2026-10-17', type: 'sale', status: 'draft', totalPaise: 999 }),
    ], 3, TODAY);
    expect(series.map(p => p.sales)).toEqual([0, 0, 5000]);
    expect(series.map(p => p.purchases)).toEqual([2000, 0, 0]);
  });
  test('revenueSeries exposes only sales', () => {
    const s = revenueSeries([tx({ totalPaise: 700 })], 1, TODAY);
    expect(s).toHaveLength(1);
    expect(s[0].value).toBe(700);
  });
});

describe('paymentMix', () => {
  test('counts confirmed sales per method only, dropping empty methods', () => {
    const mix = paymentMix([
      tx({ paymentMethod: 'cash', totalPaise: 1000 }),
      tx({ paymentMethod: 'cash', totalPaise: 500 }),
      tx({ paymentMethod: 'udhaar', status: 'draft', totalPaise: 500 }),
      tx({ type: 'purchase', paymentMethod: 'wallet', totalPaise: 500 }),
    ]);
    expect(mix).toEqual([{ label: 'Cash', value: 1500, color: 'var(--success)' }]);
  });
});

describe('cartMix', () => {
  test('shares bill value per line item, sorted largest first', () => {
    const cart: Cart = {
      items: [
        { product: {} as Product, quantity: 2, unitPricePaise: 500 },
        { product: {} as Product, quantity: 1, unitPricePaise: 1500 },
      ],
      paymentMethod: 'cash',
    };
    expect(cartMix(cart).map(d => d.value)).toEqual([1500, 1000]);
  });
});

describe('expensesByCategory', () => {
  test('skips reversed expenses and groups the rest', () => {
    const e = (over: Partial<Expense>): Expense => ({
      id: Math.random().toString(36).slice(2), amountPaise: 0,
      category: 'rent', paymentMode: 'cash', date: TODAY,
      reversed: false, createdAt: TODAY,
      ...over,
    });
    const cats = expensesByCategory([
      e({ category: 'rent', amountPaise: 1000 }),
      e({ category: 'rent', amountPaise: 1000, reversed: true }),
      e({ category: 'wages', amountPaise: 250 }),
    ]);
    expect(cats).toEqual([
      { label: 'Rent', value: 1000, color: 'var(--accent)' },
      { label: 'Wages', value: 250, color: 'var(--success)' },
    ]);
  });
});

describe('topDebtors / lowestStock / stockValueByCategory', () => {
  const c = (over: Partial<Customer>): Customer => ({
    id: Math.random().toString(36).slice(2), name: 'x', balancePaise: 0,
    ledger: [], createdAt: TODAY, updatedAt: TODAY, ...over,
  });

  test('topDebtors sorts by balance and slices, dropping zeros', () => {
    const debtors = topDebtors([
      c({ name: 'a', balancePaise: 100 }),
      c({ name: 'b', balancePaise: 900 }),
      c({ name: 'z', balancePaise: 0 }),
      c({ name: 'c', balancePaise: 500 }),
    ], 2);
    expect(debtors.map(d => d.label)).toEqual(['b', 'c']);
    expect(debtors.map(d => d.value)).toEqual([900, 500]);
  });

  test('lowestStock puts the scarcest items first, low ones in red', () => {
    const p = (over: Partial<Product>): Product => ({
      id: Math.random().toString(36).slice(2), name: 'x', category: 'Groceries',
      unit: 'piece', stock: 5, purchasePricePaise: 100, sellingPricePaise: 200,
      lowStockThreshold: 3, isActive: true, createdAt: TODAY, updatedAt: TODAY,
      ...over,
    });
    const bars = lowestStock([p({ name: 'rich', stock: 50 }), p({ name: 'poor', stock: 2 })], 2);
    expect(bars[0].label).toBe('poor (low)');
    expect(bars[0].color).toBe('var(--danger)');
    expect(bars[1].label).toBe('rich (ok)');
  });

  test('stockValueByCategory sums cost×stock per category', () => {
    const p = (over: Partial<Product>): Product => ({
      id: Math.random().toString(36).slice(2), name: 'x', category: 'Groceries',
      unit: 'piece', stock: 0, purchasePricePaise: 100, sellingPricePaise: 200,
      lowStockThreshold: 3, isActive: true, createdAt: TODAY, updatedAt: TODAY,
      ...over,
    });
    const cats = stockValueByCategory([
      p({ category: 'Groceries', stock: 10, purchasePricePaise: 100 }), // 1000
      p({ category: 'Dairy', stock: 4, purchasePricePaise: 250 }),      // 1000
      p({ category: 'Dairy', stock: 1, isActive: false }),              // ignored
    ]);
    expect(cats.map(d => d.value).sort()).toEqual([1000, 1000]);
  });
});

describe('cashSeries', () => {
  test('takes the newest closings and returns them oldest-first', () => {
    const s = cashSeries([
      { businessDate: '2026-10-18', expectedDrawerPaise: 300, physicalCashPaise: 290 },
      { businessDate: '2026-10-16', expectedDrawerPaise: 100, physicalCashPaise: 100 },
      { businessDate: '2026-10-17', expectedDrawerPaise: 200, physicalCashPaise: 180 },
    ]);
    expect(s.map(p => p.expected)).toEqual([100, 200, 300]);
    expect(s.map(p => p.physical)).toEqual([100, 180, 290]);
  });
});

describe('moneySplit', () => {
  test('solves the where-did-it-go arithmetic', () => {
    const split = moneySplit(10_000, 6_000, 2_000);
    expect(split.map(d => d.value)).toEqual([6000, 2000, 2000]);
    expect(split[2].label).toBe('Net earnings');
  });
  test('clamps negative net at zero and drops zero slices', () => {
    expect(moneySplit(1_000, 900, 500).map(d => d.label)).toEqual([
      'Cost of goods (COGS)', 'Operating expenses',
    ]);
  });
});
