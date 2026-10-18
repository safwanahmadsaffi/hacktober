import type {
  Product, Customer, Transaction, Expense, CashClosing,
} from '@/types';

const DB_NAME = 'dukaanvoice';
const DB_VERSION = 1;

type StoreName = 'products' | 'customers' | 'transactions' | 'expenses' | 'cashClosings' | 'settings';

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const stores: StoreName[] = ['products', 'customers', 'transactions', 'expenses', 'cashClosings', 'settings'];
      stores.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    request.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result;
      resolve(_db!);
    };
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

function getAll<T>(storeName: StoreName): Promise<T[]> {
  return openDB().then(
    (db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    }),
  );
}

function putOne<T extends { id: string }>(storeName: StoreName, item: T): Promise<T> {
  return openDB().then(
    (db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    }),
  );
}

function getOne<T>(storeName: StoreName, id: string): Promise<T | null> {
  return openDB().then(
    (db) => new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    }),
  );
}

export const db = {
  getProducts: () => getAll<Product>('products'),
  saveProduct: (p: Product) => putOne('products', p),

  getCustomers: () => getAll<Customer>('customers'),
  saveCustomer: (c: Customer) => putOne('customers', c),

  getTransactions: () => getAll<Transaction>('transactions'),
  saveTransaction: (t: Transaction) => putOne('transactions', t),
  getTransaction: (id: string) => getOne<Transaction>('transactions', id),

  getExpenses: () => getAll<Expense>('expenses'),
  saveExpense: (e: Expense) => putOne('expenses', e),

  getCashClosings: () => getAll<CashClosing>('cashClosings'),
  saveCashClosing: (c: CashClosing) => putOne('cashClosings', c),

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await getOne<{ id: string; value: T }>('settings', key);
    return row?.value ?? fallback;
  },
  setSetting<T>(key: string, value: T) {
    return putOne('settings', { id: key, value });
  },
};

export default db;
