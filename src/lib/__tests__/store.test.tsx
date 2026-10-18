import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { AppProvider, SUPPORTED_LANGUAGES, useApp, useCart } from '@/lib/store';
import { SEED_CUSTOMERS, SEED_PRODUCTS, SEED_EXPENSES } from '@/lib/seed';
import { cartSubtotal, rupeesToPaise } from '@/lib/financial';
import type { Product } from '@/types';

// ─── In-memory stand-in for the IndexedDB layer ─────────────────────────────
vi.mock('@/lib/db', () => {
  const store: Record<string, unknown[]> = {
    products: [],
    customers: [],
    transactions: [],
    expenses: [],
    cashClosings: [],
    settings: [],
  };
  return {
    default: {
      getProducts: vi.fn(async () => [...store.products]),
      saveProduct: vi.fn(async (p: Product) => { store.products.push(p); return p; }),
      getCustomers: vi.fn(async () => [...store.customers]),
      saveCustomer: vi.fn(async (c: unknown) => { store.customers.push(c); return c; }),
      getTransactions: vi.fn(async () => [...store.transactions]),
      saveTransaction: vi.fn(async (t: unknown) => { store.transactions.push(t); return t; }),
      getExpenses: vi.fn(async () => [...store.expenses]),
      saveExpense: vi.fn(async (e: unknown) => { store.expenses.push(e); return e; }),
      getCashClosings: vi.fn(async () => [...store.cashClosings]),
      saveCashClosing: vi.fn(async (c: unknown) => { store.cashClosings.push(c); return c; }),
      getSetting: vi.fn(async <T,>(_key: string, fallback: T) => fallback),
      setSetting: vi.fn(async (key: string, value: unknown) => ({ id: key, value })),
    },
    __store: store,
  };
});

// ─── Harness component that exposes the store to tests ─────────────────────
let latest: ReturnType<typeof useApp> | null = null;

function Probe() {
  const ctx = useApp();
  const { subtotal } = useCart();
  // Capture the latest context in an effect (assigning during render is a side effect).
  useEffect(() => {
    latest = ctx;
  }, [ctx]);
  return (
    <div>
      <span data-testid="loading">{String(ctx.state.isLoading)}</span>
      <span data-testid="product-count">{ctx.state.products.length}</span>
      <span data-testid="customer-count">{ctx.state.customers.length}</span>
      <span data-testid="expense-count">{ctx.state.expenses.length}</span>
      <span data-testid="cart-items">{ctx.state.cart.items.length}</span>
      <span data-testid="cart-subtotal">{subtotal}</span>
      <span data-testid="payment">{ctx.state.cart.paymentMethod}</span>
      <span data-testid="customer">{ctx.state.cart.customerName ?? ''}</span>
      <span data-testid="language">{ctx.state.selectedLanguage.code}</span>
    </div>
  );
}

function renderStore() {
  return render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
}

async function waitForLoaded() {
  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
}

beforeEach(() => {
  latest = null;
});

describe('initial data load', () => {
  test('seeds products, customers, and expenses when the DB is empty', async () => {
    renderStore();
    await waitForLoaded();

    expect(screen.getByTestId('product-count').textContent).toBe(String(SEED_PRODUCTS.length));
    expect(screen.getByTestId('customer-count').textContent).toBe(String(SEED_CUSTOMERS.length));
    expect(screen.getByTestId('expense-count').textContent).toBe(String(SEED_EXPENSES.length));
    expect(screen.getByTestId('language').textContent).toBe('ur');
  });

  test('starts with an empty cash cart', async () => {
    renderStore();
    await waitForLoaded();

    expect(screen.getByTestId('cart-items').textContent).toBe('0');
    expect(screen.getByTestId('cart-subtotal').textContent).toBe('0');
    expect(screen.getByTestId('payment').textContent).toBe('cash');
  });
});

describe('cart reducer', () => {
  test('ADD_TO_CART adds a line at the selling price and merges repeats', async () => {
    renderStore();
    await waitForLoaded();
    const { dispatch } = latest!;
    const [first, second] = SEED_PRODUCTS;

    act(() => dispatch({ type: 'ADD_TO_CART', payload: { product: first, quantity: 1 } }));
    expect(screen.getByTestId('cart-items').textContent).toBe('1');
    expect(screen.getByTestId('cart-subtotal').textContent).toBe(String(first.sellingPricePaise));

    // same product again → quantity merges, no second line
    act(() => dispatch({ type: 'ADD_TO_CART', payload: { product: first, quantity: 2 } }));
    expect(screen.getByTestId('cart-items').textContent).toBe('1');

    // different product → new line
    act(() => dispatch({ type: 'ADD_TO_CART', payload: { product: second, quantity: 1 } }));
    expect(screen.getByTestId('cart-items').textContent).toBe('2');

    const expected = cartSubtotal([
      { product: first, quantity: 3, unitPricePaise: first.sellingPricePaise },
      { product: second, quantity: 1, unitPricePaise: second.sellingPricePaise },
    ]);
    expect(screen.getByTestId('cart-subtotal').textContent).toBe(String(expected));
  });

  test('UPDATE_CART_ITEM sets quantity and removes the line at ≤ 0', async () => {
    renderStore();
    await waitForLoaded();
    const { dispatch } = latest!;
    const product = SEED_PRODUCTS[0];

    act(() => dispatch({ type: 'ADD_TO_CART', payload: { product, quantity: 1 } }));
    act(() => dispatch({ type: 'UPDATE_CART_ITEM', payload: { productId: product.id, quantity: 5 } }));
    expect(screen.getByTestId('cart-subtotal').textContent).toBe(
      String(product.sellingPricePaise * 5),
    );

    act(() => dispatch({ type: 'UPDATE_CART_ITEM', payload: { productId: product.id, quantity: 0 } }));
    expect(screen.getByTestId('cart-items').textContent).toBe('0');
  });

  test('REMOVE_FROM_CART and CLEAR_CART empty exactly the targeted lines', async () => {
    renderStore();
    await waitForLoaded();
    const { dispatch } = latest!;
    const [a, b, c] = SEED_PRODUCTS;

    act(() => {
      dispatch({ type: 'ADD_TO_CART', payload: { product: a, quantity: 1 } });
      dispatch({ type: 'ADD_TO_CART', payload: { product: b, quantity: 1 } });
      dispatch({ type: 'ADD_TO_CART', payload: { product: c, quantity: 1 } });
    });
    expect(screen.getByTestId('cart-items').textContent).toBe('3');

    act(() => dispatch({ type: 'REMOVE_FROM_CART', payload: { productId: b.id } }));
    expect(screen.getByTestId('cart-items').textContent).toBe('2');

    act(() => dispatch({ type: 'CLEAR_CART' }));
    expect(screen.getByTestId('cart-items').textContent).toBe('0');
    expect(screen.getByTestId('cart-subtotal').textContent).toBe('0');
  });

  test('SET_PAYMENT_METHOD and SET_CART_CUSTOMER drive the checkout state', async () => {
    renderStore();
    await waitForLoaded();
    const { dispatch } = latest!;
    const customer = SEED_CUSTOMERS[0];

    act(() => dispatch({ type: 'SET_PAYMENT_METHOD', payload: 'udhaar' }));
    expect(screen.getByTestId('payment').textContent).toBe('udhaar');

    act(() =>
      dispatch({
        type: 'SET_CART_CUSTOMER',
        payload: { customerId: customer.id, customerName: customer.name },
      }),
    );
    expect(screen.getByTestId('customer').textContent).toBe(customer.name);

    // clearing the customer removes the fields entirely (not just visually)
    act(() => dispatch({ type: 'SET_CART_CUSTOMER', payload: null }));
    expect(screen.getByTestId('customer').textContent).toBe('');
    expect(latest!.state.cart.customerId).toBeUndefined();
    expect(latest!.state.cart.customerName).toBeUndefined();
  });
});

describe('language selection', () => {
  test('SET_LANGUAGE switches to a supported language', async () => {
    renderStore();
    await waitForLoaded();
    const { dispatch } = latest!;
    const punjabi = SUPPORTED_LANGUAGES.find(l => l.code === 'pa')!;

    act(() => dispatch({ type: 'SET_LANGUAGE', payload: punjabi }));
    expect(screen.getByTestId('language').textContent).toBe('pa');
  });

  test('exposes a documented supported-language list', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(5);
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toContain('en');
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toContain('ur');
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang.name.length).toBeGreaterThan(0);
      expect(lang.nativeName.length).toBeGreaterThan(0);
    }
  });
});

describe('stock/price invariants used by the cart', () => {
  test('seed products keep integer, non-negative money values', () => {
    for (const p of SEED_PRODUCTS) {
      expect(Number.isInteger(p.sellingPricePaise)).toBe(true);
      expect(Number.isInteger(p.purchasePricePaise)).toBe(true);
      expect(p.sellingPricePaise).toBeGreaterThanOrEqual(0);
      expect(p.purchasePricePaise).toBeGreaterThanOrEqual(0);
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
    expect(SEED_PRODUCTS.some(p => p.stock <= p.lowStockThreshold)).toBe(true); // sugar
  });

  test('a typical bill totals correctly end-to-end', () => {
    const atta = SEED_PRODUCTS.find(p => p.id === 'prod-atta')!; // Rs.650 / pack
    const milk = SEED_PRODUCTS.find(p => p.id === 'prod-milk')!; // Rs.290 / litre
    const subtotal = cartSubtotal([
      { product: atta, quantity: 2, unitPricePaise: atta.sellingPricePaise }, // Rs.1300
      { product: milk, quantity: 3, unitPricePaise: milk.sellingPricePaise }, // Rs.870
    ]);
    expect(subtotal).toBe(rupeesToPaise(2170));
  });
});
