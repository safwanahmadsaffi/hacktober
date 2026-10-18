'use client';

import { useEffect, useState } from 'react';
import type {
  Cart, Customer, Expense, ExpenseCategory, Product, Transaction,
} from '@/types';
import { todayISO } from '@/lib/financial';

/**
 * Pure data selectors that turn shop state into chart-ready series.
 * Kept free of React so they can be unit-tested directly (see
 * src/lib/__tests__/charts.test.ts) and reused across pages.
 */

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface DailyPoint {
  date: string;
  label: string;   // short display label, e.g. "Mon 12"
  sales: number;   // confirmed sale paise
  purchases: number; // confirmed purchase paise
}

/** Palette strikingly distinct on both light/dark app surfaces. */
export const CHART_PALETTE = [
  'var(--accent)',      // blue
  'var(--success)',     // green
  'var(--warning)',     // amber
  'var(--danger)',      // red
  'var(--accent-deep)', // deep blue
];

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${names[d.getDay()]} ${date.slice(8, 10)}`;
}

/** Last `days` dates ending at `today`, oldest first (YYYY-MM-DD). */
export function lastDays(days: number, today: string): string[] {
  const out: string[] = [];
  if (!today) return out;
  const end = new Date(`${today}T12:00:00`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Confirmed sales and purchases per business day for the last `days` days,
 * including zero days so trends show flat lines instead of gaps.
 */
export function dailySeries(
  transactions: Transaction[],
  days: number,
  today: string,
): DailyPoint[] {
  return lastDays(days, today).map(date => {
    const ofDay = transactions.filter(t => t.status === 'confirmed' && t.businessDate === date);
    return {
      date,
      label: dayLabel(date),
      sales: ofDay.filter(t => t.type === 'sale').reduce((s, t) => s + t.totalPaise, 0),
      purchases: ofDay.filter(t => t.type === 'purchase').reduce((s, t) => s + t.totalPaise, 0),
    };
  });
}

/** Sales revenue per day for trend/line charts. */
export function revenueSeries(
  transactions: Transaction[],
  days: number,
  today: string,
): Array<{ label: string; value: number; title: string }> {
  return dailySeries(transactions, days, today).map(p => ({
    label: p.label,
    value: p.sales,
    title: p.date,
  }));
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'var(--success)',
  wallet: 'var(--accent)',
  udhaar: 'var(--warning)',
  bank: 'var(--accent-deep)',
};

/** Total received per payment method across confirmed sales. */
export function paymentMix(transactions: Transaction[]): ChartDatum[] {
  const confirmed = transactions.filter(t => t.status === 'confirmed' && t.type === 'sale');
  return (['cash', 'wallet', 'udhaar', 'bank'] as const)
    .map(method => ({
      label: method === 'wallet' ? 'JazzCash/EasyPaisa' : method === 'cash' ? 'Cash' : method === 'udhaar' ? 'Udhaar' : 'Bank',
      value: confirmed.filter(t => t.paymentMethod === method).reduce((s, t) => s + t.totalPaise, 0),
      color: PAYMENT_COLORS[method],
    }))
    .filter(d => d.value > 0);
}

/** Share of each product line in the current open bill. */
export function cartMix(cart: Cart): ChartDatum[] {
  return cart.items.map(item => ({
    label: item.product.name,
    value: item.quantity * item.unitPricePaise,
  })).sort((a, b) => b.value - a.value);
}

const EXPENSE_COLORS: Record<ExpenseCategory, string> = {
  rent: 'var(--accent)',
  electricity: 'var(--warning)',
  transport: 'var(--accent-deep)',
  wages: 'var(--success)',
  packaging: 'var(--info)',
  maintenance: 'var(--danger)',
  miscellaneous: 'var(--text-muted)',
};

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  transport: 'Transport',
  wages: 'Wages',
  packaging: 'Packaging',
  maintenance: 'Maintenance',
  miscellaneous: 'Miscellaneous',
};

/** Non-reversed expenses grouped by category (paise). */
export function expensesByCategory(expenses: Expense[]): ChartDatum[] {
  return (Object.keys(EXPENSE_LABELS) as ExpenseCategory[])
    .map(cat => ({
      label: EXPENSE_LABELS[cat],
      value: expenses.filter(e => !e.reversed && e.category === cat).reduce((s, e) => s + e.amountPaise, 0),
      color: EXPENSE_COLORS[cat],
    }))
    .filter(d => d.value > 0);
}

/** Customers with the largest outstanding balances. */
export function topDebtors(customers: Customer[], n = 5): ChartDatum[] {
  return [...customers]
    .filter(c => c.balancePaise > 0)
    .sort((a, b) => b.balancePaise - a.balancePaise)
    .slice(0, n)
    .map((c, i) => ({
      label: c.name,
      value: c.balancePaise,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
}

/** Products closest to (or below) their low-stock threshold. */
export function lowestStock(products: Product[], n = 6): ChartDatum[] {
  return [...products]
    .filter(p => p.isActive)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, n)
    .map((p, i) => ({
      label: `${p.name} (${p.stock <= p.lowStockThreshold ? 'low' : 'ok'})`,
      value: p.stock,
      color: p.stock <= p.lowStockThreshold ? 'var(--danger)' : CHART_PALETTE[i % CHART_PALETTE.length],
    }));
}

/** Stock value at purchase cost per category. */
export function stockValueByCategory(products: Product[]): ChartDatum[] {
  const active = products.filter(p => p.isActive);
  const cats = [...new Set(active.map(p => p.category))];
  return cats
    .map((cat, i) => ({
      label: cat,
      value: active.filter(p => p.category === cat).reduce((s, p) => s + p.purchasePricePaise * p.stock, 0),
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

export interface CashPoint { label: string; expected: number; physical: number }

/** Last `n` cash closings (newest first → chart-ready oldest first). */
export function cashSeries(
  closings: Array<{ businessDate: string; expectedDrawerPaise: number; physicalCashPaise: number }>,
  n = 7,
): CashPoint[] {
  return [...closings]
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .slice(0, n)
    .reverse()
    .map(c => ({ label: dayLabel(c.businessDate), expected: c.expectedDrawerPaise, physical: c.physicalCashPaise }));
}

export interface MoneySplit { label: string; value: number; color: string }

/** Where the money goes: COGS, expenses and net for reports. */
export function moneySplit(grossSales: number, cogs: number, expenses: number): MoneySplit[] {
  const net = Math.max(0, grossSales - cogs - expenses);
  return [
    { label: 'Cost of goods (COGS)', value: cogs, color: 'var(--warning)' },
    { label: 'Operating expenses', value: expenses, color: 'var(--danger)' },
    { label: 'Net earnings', value: net, color: 'var(--success)' },
  ].filter(d => d.value > 0);
}

/**
 * The local YYYY-MM-DD "today", resolved on the client only (Next.js Cache
 * Components rejects date-dependent values during prerender — reports page
 * sets the precedent).
 */
export function useBusinessToday(): string {
  const [today, setToday] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayISO());
  }, []);
  return today;
}
