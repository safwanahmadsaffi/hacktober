import type { Paise, CartItem } from '@/types';

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function formatPKR(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return 'Rs. ' + rupees.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAmount(paise: Paise): string {
  return paiseToRupees(paise).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function lineTotal(quantity: number, unitPricePaise: Paise): Paise {
  return Math.round(quantity * unitPricePaise);
}

export function cartSubtotal(items: CartItem[]): Paise {
  return items.reduce((acc, item) => acc + lineTotal(item.quantity, item.unitPricePaise), 0);
}

export function expectedDrawer(
  openingCash: Paise,
  cashSales: Paise,
  cashRepayments: Paise,
  cashExpenses: Paise,
): Paise {
  return openingCash + cashSales + cashRepayments - cashExpenses;
}

export function addPaise(...values: Paise[]): Paise {
  return values.reduce((acc, v) => acc + Math.round(v), 0);
}

export function drawerDifference(physicalCash: Paise, expectedCash: Paise): Paise {
  return physicalCash - expectedCash;
}

export function parseRupeeInput(input: string): Paise | null {
  // Reject negatives explicitly — stripping non-numerics would otherwise turn "-5" into 5.
  if (input.includes('-')) return null;
  // Drop currency markers, thousands separators, and spaces; keep the decimal point.
  const cleaned = input.replace(/rs\.?|pkr|₨|₹|\s|,/gi, '');
  if (cleaned === '' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return rupeesToPaise(value);
}

/**
 * A customer's udhaar repayment is stored as a sale-shaped receipt so it appears
 * in the transactions ledger — but it is **not** new revenue and has no cost of
 * goods. Every revenue / COGS / sales-history computation must exclude it.
 */
export const UDHAAR_REPAYMENT_PRODUCT_ID = 'udhaar-repay';

export function isUdhaarRepayment(t: { items: Array<{ productId: string }> }): boolean {
  return t.items.some(i => i.productId === UDHAAR_REPAYMENT_PRODUCT_ID);
}

/** A real counter sale: `type === 'sale'` and not an udhaar repayment receipt. */
export function isRealSale(t: { type: string; items: Array<{ productId: string }> }): boolean {
  return t.type === 'sale' && !isUdhaarRepayment(t);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Deterministic "18 Oct 2026" formatting from a YYYY-MM-DD business date.
 * Avoids timezone/ICU drift so the ledger renders identically on every device.
 */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
