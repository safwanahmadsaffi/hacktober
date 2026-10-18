// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { SEED_CUSTOMERS, SEED_EXPENSES, SEED_PRODUCTS } from '@/lib/seed';

describe('seed product catalog', () => {
  test('has unique, stable ids and SKUs', () => {
    const ids = SEED_PRODUCTS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const skus = SEED_PRODUCTS.map(p => p.sku).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
  });

  test('all stock and price values are non-negative and money is integer paise', () => {
    for (const p of SEED_PRODUCTS) {
      expect(p.stock).toBeGreaterThanOrEqual(0);
      expect(p.lowStockThreshold).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(p.sellingPricePaise)).toBe(true);
      expect(Number.isInteger(p.purchasePricePaise)).toBe(true);
      expect(p.sellingPricePaise).toBeGreaterThan(0);
      expect(p.purchasePricePaise).toBeGreaterThan(0);
    }
  });

  test('selling price never falls below purchase price (no loss-making seed)', () => {
    for (const p of SEED_PRODUCTS) {
      expect(p.sellingPricePaise).toBeGreaterThanOrEqual(p.purchasePricePaise);
    }
  });

  test('includes at least one low-stock item to exercise the warning state', () => {
    expect(SEED_PRODUCTS.some(p => p.stock <= p.lowStockThreshold)).toBe(true);
  });
});

describe('seed customers and credit ledger', () => {
  test('balancePaise reconciles exactly with the ledger entries', () => {
    for (const c of SEED_CUSTOMERS) {
      const credits = c.ledger
        .filter(e => e.type === 'credit_sale')
        .reduce((sum, e) => sum + e.amountPaise, 0);
      const repayments = c.ledger
        .filter(e => e.type === 'repayment')
        .reduce((sum, e) => sum + e.amountPaise, 0);
      expect(c.balancePaise).toBe(credits - repayments);
    }
  });

  test('never ships a negative customer balance', () => {
    for (const c of SEED_CUSTOMERS) {
      expect(c.balancePaise).toBeGreaterThanOrEqual(0);
    }
  });

  test('ledger entry ids are unique within each customer', () => {
    for (const c of SEED_CUSTOMERS) {
      const ids = c.ledger.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('includes a fully-repaid customer (Fatima) to cover the settled path', () => {
    const fatima = SEED_CUSTOMERS.find(c => c.id === 'cust-fatima');
    expect(fatima).toBeDefined();
    expect(fatima!.balancePaise).toBe(0);
    expect(fatima!.ledger.some(e => e.type === 'repayment')).toBe(true);
  });
});

describe('seed expenses', () => {
  test('amounts are positive integer paise with valid category and payment mode', () => {
    for (const e of SEED_EXPENSES) {
      expect(Number.isInteger(e.amountPaise)).toBe(true);
      expect(e.amountPaise).toBeGreaterThan(0);
      expect(['rent', 'electricity', 'transport', 'wages', 'packaging', 'maintenance', 'miscellaneous']).toContain(e.category);
      expect(['cash', 'wallet', 'udhaar', 'bank']).toContain(e.paymentMode);
      expect(e.reversed).toBe(false);
    }
  });
});
