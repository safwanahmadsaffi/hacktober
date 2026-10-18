import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '@/lib/store';
import QuickSalePage from '@/app/page';
import DashboardPage from '@/app/dashboard/page';
import ProductsPage from '@/app/products/page';
import TransactionsPage from '@/app/transactions/page';
import UdhaarPage from '@/app/udhaar/page';
import ExpensesPage from '@/app/expenses/page';
import CashClosingPage from '@/app/cash-closing/page';
import ReportsPage from '@/app/reports/page';
import MunshiPage from '@/app/munshi/page';

// Empty in-memory persistence: pages should still render their shell,
// heading, and empty states when there is no stored data yet.
vi.mock('@/lib/db', () => ({
  default: {
    getProducts: vi.fn(async () => []),
    saveProduct: vi.fn(async (p: unknown) => p),
    getCustomers: vi.fn(async () => []),
    saveCustomer: vi.fn(async (c: unknown) => c),
    getTransactions: vi.fn(async () => []),
    saveTransaction: vi.fn(async (t: unknown) => t),
    getTransaction: vi.fn(async () => null),
    getExpenses: vi.fn(async () => []),
    saveExpense: vi.fn(async (e: unknown) => e),
    getCashClosings: vi.fn(async () => []),
    saveCashClosing: vi.fn(async (c: unknown) => c),
    getSetting: vi.fn(async <T,>(_key: string, fallback: T) => fallback),
    setSetting: vi.fn(async (key: string, value: unknown) => ({ id: key, value })),
  },
}));

// Several pages navigate (e.g. Dashboard uses useRouter); provide a minimal
// app-router context so rendering does not throw outside a Next.js runtime.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

type PageDef = { route: string; Component: () => React.JSX.Element; heading: RegExp };

const PAGES: PageDef[] = [
  { route: '/', Component: QuickSalePage, heading: /quick sale/i },
  { route: '/munshi', Component: MunshiPage, heading: /munshi ai/i },
  { route: '/dashboard', Component: DashboardPage, heading: /dashboard/i },
  { route: '/products', Component: ProductsPage, heading: /products/i },
  { route: '/transactions', Component: TransactionsPage, heading: /transactions/i },
  { route: '/udhaar', Component: UdhaarPage, heading: /udhaar khata/i },
  { route: '/expenses', Component: ExpensesPage, heading: /operating expenses/i },
  { route: '/cash-closing', Component: CashClosingPage, heading: /cash drawer closing/i },
  { route: '/reports', Component: ReportsPage, heading: /business reports/i },
];

describe('navigation areas render (PRD: all nine areas have a working shell)', () => {
  for (const { route, Component, heading } of PAGES) {
    test(`${route} renders its primary heading and main controls`, async () => {
      render(
        <AppProvider>
          <Component />
        </AppProvider>,
      );

      const headingEl = await screen.findByRole('heading', { name: heading }, { timeout: 5000 });
      expect(headingEl).toBeTruthy();

      // every area offers at least one interactive control (button/input/select/link)
      const controls =
        screen.queryAllByRole('button').length +
        screen.queryAllByRole('textbox').length +
        screen.queryAllByRole('combobox').length +
        screen.queryAllByRole('link').length;
      expect(controls).toBeGreaterThan(0);
    });
  }
});
