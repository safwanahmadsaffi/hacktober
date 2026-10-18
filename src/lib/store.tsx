'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AppState, AppAction, Cart, SupportedLanguage, Product } from '@/types';
import db from '@/lib/db';
import { cartSubtotal } from '@/lib/financial';
import { SEED_PRODUCTS, SEED_CUSTOMERS, SEED_EXPENSES } from '@/lib/seed';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pa', name: 'Punjabi (Shahmukhi)', nativeName: 'پنجابی' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
];

const emptyCart: Cart = { items: [], paymentMethod: 'cash' };

const initialState: AppState = {
  cart: emptyCart,
  selectedLanguage: SUPPORTED_LANGUAGES[0],
  products: [],
  customers: [],
  transactions: [],
  expenses: [],
  cashClosings: [],
  isLoading: true,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PRODUCTS':       return { ...state, products: action.payload };
    case 'ADD_PRODUCT':        return { ...state, products: [...state.products, action.payload] };
    case 'UPDATE_PRODUCT':     return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'SET_CUSTOMERS':      return { ...state, customers: action.payload };
    case 'ADD_CUSTOMER':       return { ...state, customers: [...state.customers, action.payload] };
    case 'UPDATE_CUSTOMER':    return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'SET_TRANSACTIONS':   return { ...state, transactions: action.payload };
    case 'ADD_TRANSACTION':    return { ...state, transactions: [...state.transactions, action.payload] };
    case 'UPDATE_TRANSACTION': return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'SET_EXPENSES':       return { ...state, expenses: action.payload };
    case 'ADD_EXPENSE':        return { ...state, expenses: [...state.expenses, action.payload] };
    case 'UPDATE_EXPENSE':     return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'SET_CASH_CLOSINGS':  return { ...state, cashClosings: action.payload };
    case 'ADD_CASH_CLOSING':   return { ...state, cashClosings: [...state.cashClosings, action.payload] };
    case 'UPDATE_CASH_CLOSING':return { ...state, cashClosings: state.cashClosings.map(c => c.id === action.payload.id ? action.payload : c) };

    case 'ADD_TO_CART': {
      const { product, quantity } = action.payload;
      const existing = state.cart.items.find(i => i.product.id === product.id);
      const items = existing
        ? state.cart.items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i)
        : [...state.cart.items, { product, quantity, unitPricePaise: product.sellingPricePaise }];
      return { ...state, cart: { ...state.cart, items } };
    }

    case 'UPDATE_CART_ITEM': {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        return { ...state, cart: { ...state.cart, items: state.cart.items.filter(i => i.product.id !== productId) } };
      }
      return { ...state, cart: { ...state.cart, items: state.cart.items.map(i => i.product.id === productId ? { ...i, quantity } : i) } };
    }

    case 'REMOVE_FROM_CART':
      return { ...state, cart: { ...state.cart, items: state.cart.items.filter(i => i.product.id !== action.payload.productId) } };

    case 'CLEAR_CART':
      return { ...state, cart: emptyCart };

    case 'SET_PAYMENT_METHOD':
      return { ...state, cart: { ...state.cart, paymentMethod: action.payload } };

    case 'SET_CART_CUSTOMER':
      if (action.payload === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { customerId: _a, customerName: _b, ...rest } = state.cart;
        return { ...state, cart: rest };
      }
      return { ...state, cart: { ...state.cart, customerId: action.payload.customerId, customerName: action.payload.customerName } };

    case 'SET_LANGUAGE':
      return { ...state, selectedLanguage: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function load() {
      try {
        const [initialProducts, initialCustomers, transactions, initialExpenses, cashClosings] = await Promise.all([
          db.getProducts(),
          db.getCustomers(),
          db.getTransactions(),
          db.getExpenses(),
          db.getCashClosings(),
        ]);
        const langCode = await db.getSetting<string>('language', 'ur');

        const hasOldIndianSeed = initialProducts.some(p => p.name.includes('Aashirvaad') || p.name.includes('Amul') || p.name.includes('Parle-G'));
        let products = initialProducts;
        let customers = initialCustomers;
        let expenses = initialExpenses;
        if (initialProducts.length === 0 || hasOldIndianSeed) {
          await Promise.all([
            ...SEED_PRODUCTS.map(p => db.saveProduct(p)),
            ...SEED_CUSTOMERS.map(c => db.saveCustomer(c)),
            ...SEED_EXPENSES.map(e => db.saveExpense(e)),
          ]);
          products = SEED_PRODUCTS;
          customers = SEED_CUSTOMERS;
          expenses = SEED_EXPENSES;
        }

        dispatch({ type: 'SET_PRODUCTS', payload: products });
        dispatch({ type: 'SET_CUSTOMERS', payload: customers });
        dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
        dispatch({ type: 'SET_EXPENSES', payload: expenses });
        dispatch({ type: 'SET_CASH_CLOSINGS', payload: cashClosings });
        const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode) || SUPPORTED_LANGUAGES[0];
        dispatch({ type: 'SET_LANGUAGE', payload: lang });
      } catch (err) {
        console.error('Failed to load from IndexedDB:', err);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    load();
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useCart() {
  const { state, dispatch } = useApp();
  const subtotal = cartSubtotal(state.cart.items);
  return { cart: state.cart, subtotal, dispatch };
}
