import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '@/lib/store';
import QuickSalePage from '@/app/page';
import { SEED_CUSTOMERS, SEED_PRODUCTS } from '@/lib/seed';
import { formatPKR } from '@/lib/financial';
import type { Customer, Product } from '@/types';

// ─── Mocked persistence layer that records what would be written ────────────
const dbMock = vi.hoisted(() => {
  const saved = {
    products: [] as Array<{ id: string; stock: number; [k: string]: unknown }>,
    customers: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
  };
  return {
    saved,
    getProducts: vi.fn(async () => []),
    getCustomers: vi.fn(async () => []),
    getTransactions: vi.fn(async () => []),
    getExpenses: vi.fn(async () => []),
    getCashClosings: vi.fn(async () => []),
    getSetting: vi.fn(async (_key: string, fallback: unknown) => fallback),
    saveProduct: vi.fn(async (p: (typeof saved.products)[number]) => { saved.products.push(p); return p; }),
    saveCustomer: vi.fn(async (c: Record<string, unknown>) => { saved.customers.push(c); return c; }),
    saveTransaction: vi.fn(async (t: Record<string, unknown>) => { saved.transactions.push(t); return t; }),
    saveExpense: vi.fn(async (e: unknown) => e),
    saveCashClosing: vi.fn(async (c: unknown) => c),
    setSetting: vi.fn(async () => undefined),
  };
});

vi.mock('@/lib/db', () => ({ default: dbMock }));

// ─── Data-driven fixtures ───────────────────────────────────────────────────
// Derived from the seed data at runtime so the suite keeps passing when the
// catalog/customers/currency presentation change.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const product: Product = SEED_PRODUCTS.find(p => p.isActive) ?? SEED_PRODUCTS[0];
const searchProbe: string = product.sku ?? product.name.split(' ')[0];
const productRe = new RegExp(escapeRegExp(product.name), 'i');
const customer: Customer = SEED_CUSTOMERS[0];
const subtotalPaise = product.sellingPricePaise; // one unit added to the cart
const money = formatPKR(subtotalPaise);
const zeroMoney = formatPKR(0);

async function renderQuickSale() {
  render(
    <AppProvider>
      <QuickSalePage />
    </AppProvider>,
  );
  // wait until the store finished loading (empty-cart state only renders after)
  await screen.findByText(/no items in cart/i, {}, { timeout: 5000 });
}

async function addProductToCart() {
  const search = await screen.findByLabelText('Search products');
  fireEvent.change(search, { target: { value: searchProbe } });
  const option = await screen.findByRole('option', { name: productRe }, { timeout: 5000 });
  fireEvent.click(option);
  await screen.findByText(productRe);
}

beforeEach(() => {
  dbMock.saved.products.length = 0;
  dbMock.saved.customers.length = 0;
  dbMock.saved.transactions.length = 0;
});

describe('Quick Sale — workspace', () => {
  test('renders heading, search, cart, and bill summary with an empty-cart state', async () => {
    await renderQuickSale();

    expect(screen.getByRole('heading', { level: 1, name: /quick sale/i })).toBeTruthy();
    expect(screen.getByLabelText('Search products')).toBeTruthy();
    expect((screen.getByRole('button', { name: /review & confirm bill/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(zeroMoney).length).toBeGreaterThan(0);
  });

  test('search finds a product by name and adds it to the cart with correct totals', async () => {
    await renderQuickSale();
    await addProductToCart();

    expect(screen.getByText('Current Bill / Cart (1)')).toBeTruthy();
    expect(screen.getByLabelText(`Quantity for ${product.name}`)).toBeTruthy();
    // unit price shows in bill summary as both subtotal and grand total
    expect(screen.getAllByText(money).length).toBeGreaterThanOrEqual(2);
    expect((screen.getByRole('button', { name: /review & confirm bill/i }) as HTMLButtonElement).disabled).toBe(false);

    // no-results state for an unknown query
    const search = screen.getByLabelText('Search products');
    fireEvent.change(search, { target: { value: 'zzz-not-a-product' } });
    expect(await screen.findByText(/no products found/i)).toBeTruthy();
  });
});

describe('Quick Sale — confirmation (cash)', () => {
  test('confirms exactly once, persists the transaction, decrements stock, clears cart', async () => {
    await renderQuickSale();
    await addProductToCart();

    fireEvent.click(screen.getByRole('button', { name: /review & confirm bill/i }));
    const dialog = await screen.findByRole('dialog', { name: /review and confirm sale/i });
    expect(dialog).toBeTruthy();
    expect(screen.getAllByText(money).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /confirm sale/i }));

    const status = await screen.findByRole('status', {}, { timeout: 5000 });
    expect(status.textContent).toMatch(/sale confirmed/i);
    expect(status.textContent).toContain(money);
    expect(status.textContent).toMatch(/cash/i);

    // persisted exactly once with a correct, reproducible ledger record
    expect(dbMock.saved.transactions).toHaveLength(1);
    const tx = dbMock.saved.transactions[0];
    expect(tx.type).toBe('sale');
    expect(tx.status).toBe('confirmed');
    expect(tx.paymentMethod).toBe('cash');
    expect(tx.totalPaise).toBe(subtotalPaise);
    expect(tx.subtotalPaise).toBe(subtotalPaise);
    expect((tx.items as unknown[]).length).toBe(1);
    expect(tx.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // stock decremented exactly once
    const productWrites = dbMock.saved.products.filter(p => p.id === product.id);
    expect(productWrites.length).toBeGreaterThan(0);
    expect(productWrites[productWrites.length - 1].stock).toBe(product.stock - 1);

    // cart cleared after success
    await screen.findByText(/no items in cart/i);
  });
});

describe('Quick Sale — Udhaar guardrails', () => {
  test('blocks review until a customer is selected for Udhaar', async () => {
    await renderQuickSale();
    await addProductToCart();

    fireEvent.click(screen.getByRole('button', { name: /udhaar/i }));
    expect((screen.getByRole('button', { name: /review & confirm bill/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText(/customer \(required for udhaar\)/i)).toBeTruthy();

    const select = screen.getByLabelText(/customer \(required for udhaar\)/i);
    fireEvent.change(select, { target: { value: customer.id } });
    expect((screen.getByRole('button', { name: /review & confirm bill/i }) as HTMLButtonElement).disabled).toBe(false);

    // review shows the chosen customer (scoped to the dialog, not the <select>)
    fireEvent.click(screen.getByRole('button', { name: /review & confirm bill/i }));
    const dialog = await screen.findByRole('dialog', { name: /review and confirm sale/i });
    expect(within(dialog).getByText(new RegExp(escapeRegExp(customer.name), 'i'))).toBeTruthy();
  });

  test('confirmed Udhaar sale raises the customer balance and ledger exactly once', async () => {
    await renderQuickSale();
    await addProductToCart();

    fireEvent.click(screen.getByRole('button', { name: /udhaar/i }));
    fireEvent.change(screen.getByLabelText(/customer \(required for udhaar\)/i), {
      target: { value: customer.id },
    });
    fireEvent.click(screen.getByRole('button', { name: /review & confirm bill/i }));
    await screen.findByRole('dialog', { name: /review and confirm sale/i });
    fireEvent.click(screen.getByRole('button', { name: /confirm sale/i }));

    const status = await screen.findByRole('status', {}, { timeout: 5000 });
    expect(status.textContent).toMatch(/sale confirmed/i);

    // transaction recorded as udhaar credit for this customer
    expect(dbMock.saved.transactions).toHaveLength(1);
    expect(dbMock.saved.transactions[0].paymentMethod).toBe('udhaar');
    expect(dbMock.saved.transactions[0].customerId).toBe(customer.id);

    // balance rises by exactly the bill amount; ledger gains exactly one entry
    const customerWrites = dbMock.saved.customers.filter(c => c.id === customer.id);
    const updated = customerWrites[customerWrites.length - 1];
    expect(updated.balancePaise).toBe(customer.balancePaise + subtotalPaise);
    const ledger = updated.ledger as Array<{ type: string; amountPaise: number }>;
    expect(ledger).toHaveLength(customer.ledger.length + 1);
    expect(ledger[ledger.length - 1]).toMatchObject({ type: 'credit_sale', amountPaise: subtotalPaise });
  });
});

describe('Quick Sale — failure path', () => {
  test('a failed save keeps the cart and reports the sale was not confirmed', async () => {
    await renderQuickSale();
    await addProductToCart();

    dbMock.saveTransaction.mockRejectedValueOnce(new Error('storage unavailable'));

    fireEvent.click(screen.getByRole('button', { name: /review & confirm bill/i }));
    await screen.findByRole('dialog', { name: /review and confirm sale/i });
    fireEvent.click(screen.getByRole('button', { name: /confirm sale/i }));

    const status = await screen.findByRole('status', {}, { timeout: 5000 });
    expect(status.textContent).toMatch(/could not be confirmed/i);

    // cart preserved + nothing persisted
    expect(dbMock.saved.transactions).toHaveLength(0);
    expect(screen.getByText('Current Bill / Cart (1)')).toBeTruthy();

    // dialog remains open so the user can retry
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /review and confirm sale/i })).toBeTruthy(),
    );
  });
});
