// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  addPaise,
  cartSubtotal,
  drawerDifference,
  expectedDrawer,
  formatAmount,
  formatDate,
  formatDateTime,
  formatPKR,
  generateId,
  isRealSale,
  isUdhaarRepayment,
  lineTotal,
  parseRupeeInput,
  paiseToRupees,
  rupeesToPaise,
  todayISO,
} from '@/lib/financial';
import type { CartItem, Product } from '@/types';

describe('udhaar repayment vs revenue', () => {
  const repayment = { type: 'sale', items: [{ productId: 'udhaar-repay' }] };
  const sale = { type: 'sale', items: [{ productId: 'prod-atta' }] };
  const purchase = { type: 'purchase', items: [{ productId: 'prod-atta' }] };

  test('detects repayment receipts', () => {
    expect(isUdhaarRepayment(repayment)).toBe(true);
    expect(isUdhaarRepayment(sale)).toBe(false);
  });

  test('isRealSale excludes repayments and purchases', () => {
    expect(isRealSale(sale)).toBe(true);
    expect(isRealSale(repayment)).toBe(false);
    expect(isRealSale(purchase)).toBe(false);
  });
});

function makeItem(quantity: number, unitPricePaise: number): CartItem {
  const product: Product = {
    id: `p-${quantity}-${unitPricePaise}`,
    name: 'Test Product',
    category: 'Test',
    unit: 'piece',
    stock: 10,
    purchasePricePaise: 0,
    sellingPricePaise: unitPricePaise,
    lowStockThreshold: 1,
    isActive: true,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
  return { product, quantity, unitPricePaise };
}

describe('paise ↔ rupees conversion', () => {
  test('round-trips whole and fractional rupees without float drift', () => {
    expect(rupeesToPaise(1)).toBe(100);
    expect(rupeesToPaise(245.5)).toBe(24550);
    expect(rupeesToPaise(0.1) + rupeesToPaise(0.2)).toBe(30); // 0.1*100 rounds to 10
    expect(paiseToRupees(12345)).toBe(123.45);
    expect(paiseToRupees(rupeesToPaise(999.99))).toBe(999.99);
  });

  test('handles zero and negative amounts (refunds/adjustments)', () => {
    expect(rupeesToPaise(0)).toBe(0);
    expect(rupeesToPaise(-50)).toBe(-5000);
    expect(paiseToRupees(0)).toBe(0);
  });
});

describe('formatting', () => {
  test('formatPKR renders Pakistani rupee currency with 2 decimals', () => {
    expect(formatPKR(12345)).toBe('Rs. 123.45');
    expect(formatPKR(100000)).toBe('Rs. 1,000.00');
    expect(formatPKR(123456789)).toBe('Rs. 1,234,567.89'); // western 3-digit grouping
    expect(formatPKR(0)).toBe('Rs. 0.00');
  });

  test('formatAmount omits the currency symbol but keeps grouping', () => {
    expect(formatAmount(123456789)).toBe('1,234,567.89');
  });

  test('formatDate and formatDateTime produce stable en-PK output', () => {
    // en-PK renders as "18-Oct-2026"; tolerate separator churn
    expect(formatDate('2026-10-18')).toMatch(/^\d{2}[- ]\w{3}[- ]\d{4}$/);
    expect(formatDateTime('2026-10-18T09:05:00.000Z')).toContain('2026');
  });

  test('todayISO returns YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('cart math', () => {
  test('lineTotal rounds fractional quantities to whole paise', () => {
    expect(lineTotal(3, 24500)).toBe(73500);
    expect(lineTotal(0.5, 99)).toBe(50); // 49.5 rounds to 50
    expect(lineTotal(0, 100)).toBe(0);
  });

  test('cartSubtotal sums every line exactly once', () => {
    const items = [makeItem(2, 24500), makeItem(1, 5600), makeItem(3, 5000)];
    // 49000 + 5600 + 15000
    expect(cartSubtotal(items)).toBe(69600);
    expect(cartSubtotal([])).toBe(0);
  });

  test('addPaise is commutative and ignores ordering', () => {
    expect(addPaise(100, 200, 300)).toBe(600);
    expect(addPaise(300, 100, 200)).toBe(600);
    expect(addPaise()).toBe(0);
  });
});

describe('cash drawer reconciliation', () => {
  test('expectedDrawer = opening + cash sales + cash repayments − cash expenses', () => {
    // Rs.5000 opening + Rs.12000 cash sales + Rs.1450 udhaar repayments − Rs.470 cash expenses
    expect(expectedDrawer(500000, 1200000, 145000, 47000)).toBe(1798000);
  });

  test('UPI/bank money never enters the drawer formula (callers pass 0)', () => {
    const withDigital = expectedDrawer(0, 0, 0, 0);
    expect(withDigital).toBe(0);
  });

  test('drawerDifference is signed: shortage negative, surplus positive', () => {
    expect(drawerDifference(1798000, 1798000)).toBe(0);
    expect(drawerDifference(1790000, 1798000)).toBe(-8000); // shortage
    expect(drawerDifference(1800000, 1798000)).toBe(2000); // surplus
  });
});

describe('parseRupeeInput', () => {
  test('accepts currency symbols, commas, and spaces', () => {
    expect(parseRupeeInput('Rs.1,234.50')).toBe(123450);
    expect(parseRupeeInput(' 45 ')).toBe(4500);
    expect(parseRupeeInput('45.5')).toBe(4550);
  });

  test('rejects negative, empty, and non-numeric input', () => {
    expect(parseRupeeInput('-5')).toBeNull();
    expect(parseRupeeInput('')).toBeNull();
    expect(parseRupeeInput('abc')).toBeNull();
    expect(parseRupeeInput('Rs.')).toBeNull();
  });

  test('accepts zero', () => {
    expect(parseRupeeInput('0')).toBe(0);
  });
});

describe('generateId', () => {
  test('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    expect(ids.size).toBe(500);
  });
});
