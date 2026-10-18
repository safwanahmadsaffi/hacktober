// All monetary values stored as integer paise (1 PKR = 100 paise)
export type Paise = number;

export type Unit = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'dozen' | 'pack' | 'box';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  unit: Unit;
  stock: number;
  purchasePricePaise: Paise;
  sellingPricePaise: Paise;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'sale' | 'purchase';
export type TransactionStatus = 'draft' | 'confirmed' | 'reversed';
export type PaymentMethod = 'cash' | 'wallet' | 'udhaar' | 'bank';

export type TransactionEventType =
  | 'receipt_created'
  | 'receipt_confirmed'
  | 'stock_deducted'
  | 'stock_restored'
  | 'udhaar_added'
  | 'reversed';

export interface TransactionLogEntry {
  id: string;
  at: string;
  event: TransactionEventType;
  message: string;
}

export interface TransactionLineItem {
  productId: string;
  productName: string;
  unit: Unit;
  quantity: number;
  unitPricePaise: Paise;
  totalPaise: Paise;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  items: TransactionLineItem[];
  subtotalPaise: Paise;
  totalPaise: Paise;
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
  notes?: string;
  reversalOfId?: string;
  reversedById?: string;
  businessDate: string;
  createdAt: string;
  confirmedAt?: string;
  /** Activity log: every change this receipt caused, in chronological order. */
  log?: TransactionLogEntry[];
}

export type LedgerEntryType = 'credit_sale' | 'repayment';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amountPaise: Paise;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  note?: string;
  date: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  balancePaise: Paise;
  ledger: LedgerEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'transport'
  | 'wages'
  | 'packaging'
  | 'maintenance'
  | 'miscellaneous';

export interface Expense {
  id: string;
  amountPaise: Paise;
  category: ExpenseCategory;
  paymentMode: PaymentMethod;
  date: string;
  note?: string;
  reversed: boolean;
  reversedAt?: string;
  createdAt: string;
}

export type ClosingStatus = 'draft' | 'finalized';

export interface CashClosing {
  id: string;
  businessDate: string;
  openingCashPaise: Paise;
  cashSalesPaise: Paise;
  cashRepaymentsPaise: Paise;
  cashExpensesPaise: Paise;
  expectedDrawerPaise: Paise;
  physicalCashPaise: Paise;
  differencePaise: Paise;
  notes?: string;
  status: ClosingStatus;
  createdAt: string;
  finalizedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPricePaise: Paise;
}

export interface Cart {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export interface AppState {
  cart: Cart;
  selectedLanguage: SupportedLanguage;
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  expenses: Expense[];
  cashClosings: CashClosing[];
  isLoading: boolean;
}

export type AppAction =
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'SET_CUSTOMERS'; payload: Customer[] }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'SET_EXPENSES'; payload: Expense[] }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'SET_CASH_CLOSINGS'; payload: CashClosing[] }
  | { type: 'ADD_CASH_CLOSING'; payload: CashClosing }
  | { type: 'UPDATE_CASH_CLOSING'; payload: CashClosing }
  | { type: 'ADD_TO_CART'; payload: { product: Product; quantity: number } }
  | { type: 'UPDATE_CART_ITEM'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_FROM_CART'; payload: { productId: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'SET_CART_CUSTOMER'; payload: { customerId: string; customerName: string } | null }
  | { type: 'SET_LANGUAGE'; payload: SupportedLanguage }
  | { type: 'SET_LOADING'; payload: boolean };
