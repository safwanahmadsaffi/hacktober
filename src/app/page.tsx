'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Lightning, MagnifyingGlass, Plus, Trash, ArrowRight, X, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import PageHeader from '@/components/common/PageHeader';
import { useApp } from '@/lib/store';
import { formatPKR, lineTotal, cartSubtotal, generateId, todayISO } from '@/lib/financial';
import { cartMix } from '@/lib/charts';
import DonutChart from '@/components/charts/DonutChart';
import type { Product, Transaction, TransactionLineItem } from '@/types';
import { logEvent } from '@/lib/txlog';
import db from '@/lib/db';

export default function QuickSalePage() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  // True while the pointer is over the results dropdown; prevents the input's
  // blur handler from hiding (and unmounting) the dropdown mid-tap, which used
  // to cancel the option's click and silently drop the product from the cart.
  const dropdownHover = useRef(false);

  const cart = state.cart;
  const subtotal = cartSubtotal(cart.items);

  // Search results are derived during render — no effect required.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return state.products
      .filter(p =>
        p.isActive && (
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [searchQuery, state.products]);

  function addToCart(product: Product) {
    dispatch({ type: 'ADD_TO_CART', payload: { product, quantity: 1 } });
    setSearchQuery('');
    setShowResults(false);
    searchRef.current?.focus();
  }  function updateQty(productId: string, qty: number) {
    dispatch({ type: 'UPDATE_CART_ITEM', payload: { productId, quantity: qty } });
  }

  function removeItem(productId: string) {
    dispatch({ type: 'REMOVE_FROM_CART', payload: { productId } });
  }

  async function confirmSale() {
    if (cart.items.length === 0) return;
    if (cart.paymentMethod === 'udhaar' && !cart.customerId) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const items: TransactionLineItem[] = cart.items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        unit: i.product.unit,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        totalPaise: lineTotal(i.quantity, i.unitPricePaise),
      }));

      const tx: Transaction = {
        id: generateId(),
        type: 'sale',
        status: 'confirmed',
        items,
        subtotalPaise: subtotal,
        totalPaise: subtotal,
        paymentMethod: cart.paymentMethod,
        customerId: cart.customerId,
        customerName: cart.customerName,
        businessDate: todayISO(),
        createdAt: now,
        confirmedAt: now,
        log: [
          logEvent('receipt_created', `Sale receipt created with ${items.length} item(s) · ${formatPKR(subtotal)}`),
          logEvent('receipt_confirmed', `Receipt confirmed · paid ${formatPKR(subtotal)} via ${cart.paymentMethod.toUpperCase()}${cart.customerName ? ` · ${cart.customerName}` : ''}`),
        ],
      };

      // Log the stock change each line item causes (before → after values).
      for (const item of cart.items) {
        const product = state.products.find(p => p.id === item.product.id);
        if (product) {
          tx.log!.push(logEvent(
            'stock_deducted',
            `Stock ${product.name}: ${product.stock} → ${product.stock - item.quantity} ${product.unit} (−${item.quantity})`,
          ));
        }
      }

      // An udhaar sale also opens a khata entry — fold it into the receipt log
      // *before* persisting, so the transaction is written exactly once with its
      // full history (re-saving it later duplicated the write and could race).
      const udhaarCustomer = cart.paymentMethod === 'udhaar' && cart.customerId
        ? state.customers.find(c => c.id === cart.customerId)
        : undefined;
      if (udhaarCustomer) {
        tx.log!.push(logEvent(
          'udhaar_added',
          `Udhaar: ${formatPKR(subtotal)} added to ${udhaarCustomer.name}'s khata · balance ${formatPKR(udhaarCustomer.balancePaise)} → ${formatPKR(udhaarCustomer.balancePaise + subtotal)}`,
        ));
      }

      await db.saveTransaction(tx);
      dispatch({ type: 'ADD_TRANSACTION', payload: tx });

      // Update stock
      for (const item of cart.items) {
        const product = state.products.find(p => p.id === item.product.id);
        if (product) {
          const updated = { ...product, stock: product.stock - item.quantity, updatedAt: now };
          await db.saveProduct(updated);
          dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
        }
      }

      // Raise the customer's khata balance once, with a single ledger entry.
      if (udhaarCustomer) {
        const entry = {
          id: generateId(), type: 'credit_sale' as const, amountPaise: subtotal,
          transactionId: tx.id, date: todayISO(), createdAt: now,
        };
        const updated = {
          ...udhaarCustomer,
          balancePaise: udhaarCustomer.balancePaise + subtotal,
          ledger: [...udhaarCustomer.ledger, entry],
          updatedAt: now,
        };
        await db.saveCustomer(updated);
        dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
      }
      dispatch({ type: 'CLEAR_CART' });
      setShowReview(false);
      setConfirmResult({ success: true, message: `Sale confirmed — ${formatPKR(subtotal)} via ${cart.paymentMethod.toUpperCase()}` });
      setTimeout(() => setConfirmResult(null), 4000);
    } catch (err) {
      setConfirmResult({ success: false, message: 'Sale could not be confirmed. Your cart is preserved — please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={<Lightning weight="fill" />}
        title="Quick Sale"
        subtitle="Ring up a sale: search the item, build the bill, choose how the customer pays, and confirm."
        related={[
          { href: '/products', label: 'Products', hint: 'Add items or check stock levels' },
          { href: '/transactions', label: 'Transactions', hint: 'The receipt appears here after confirming' },
          { href: '/udhaar', label: 'Udhaar Khata', hint: 'Credit sales update customer balances' },
        ]}
        actions={
          <Link href="/products" className="btn btn-outline btn-sm">
            <Plus size={16} /> New Product
          </Link>
        }
      />

      {confirmResult && (
        <div role="status" aria-live="polite" style={{
          display: 'flex', alignItems: 'center', gap: '.625rem',
          padding: '.875rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-lg)',
          background: confirmResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: confirmResult.success ? 'var(--success)' : 'var(--danger)',
          fontWeight: 500, fontSize: '.9rem',
        }}>
          {confirmResult.success ? <CheckCircle weight="fill" size={20} /> : <WarningCircle weight="fill" size={20} />}
          {confirmResult.message}
        </div>
      )}

      <div className="quick-sale-layout">
        {/* Left: Search + Cart */}
        <div>
          {/* Product Search */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="search-wrap" style={{ position: 'relative' }}>
              <span className="search-icon"><MagnifyingGlass size={18} /></span>
              <input
                ref={searchRef}
                id="product-search"
                type="search"
                className="form-control search-input"
                placeholder="Search product (مثلاً آٹا، چاول، گھی، دال)..."
                value={searchQuery}
                onChange={e => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  setShowResults(value.trim().length > 0);
                }}
                onFocus={() => searchQuery && setShowResults(true)}
                onBlur={() => setTimeout(() => { if (!dropdownHover.current) setShowResults(false); }, 200)}
                autoComplete="off"
                aria-label="Search products"
                aria-autocomplete="list"
                aria-controls="search-results"
                style={{ fontSize: '1rem', padding: '.75rem .875rem .75rem 2.75rem' }}
              />
              {showResults && (
                <div
                  className="search-dropdown"
                  id="search-results"
                  role="listbox"
                  aria-label="Search results"
                  onMouseEnter={() => { dropdownHover.current = true; }}
                  onMouseLeave={() => { dropdownHover.current = false; }}
                >
                  {searchResults.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                      No products found for &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      className="search-result-item"
                      role="option"
                      aria-selected="false"
                      // Preventing this default keeps focus on the input while the
                      // option is pressed, so the click always lands on it and the
                      // product is reliably added to the current bill.
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => addToCart(p)}
                      onKeyDown={e => e.key === 'Enter' && addToCart(p)}
                      tabIndex={0}
                    >
                      <div>
                        <div className="search-result-name">{p.name}</div>
                        <div className="search-result-meta">{p.category} · Stock: {p.stock} {p.unit}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="search-result-price">{formatPKR(p.sellingPricePaise)}</div>
                        {p.stock <= p.lowStockThreshold && (
                          <span className="badge badge-warning" style={{ fontSize: '.65rem', marginTop: '.2rem' }}>Low Stock</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Current Bill / Cart ({cart.items.length})</h2>
              {cart.items.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'CLEAR_CART' })}>
                  Clear all
                </button>
              )}
            </div>

            {cart.items.length === 0 ? (
              <div className="state-container" style={{ padding: '2rem' }}>
                <div className="state-icon">🛒</div>
                <p className="state-message">No items in cart. Search a product above or use a barcode scanner.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ boxShadow: 'none' }}>
                <table className="data-table" aria-label="Cart items">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: 80 }}>Qty</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Unit Price</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                      <th style={{ width: 48 }}><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map(item => (
                      <tr key={item.product.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                          <div className="text-muted text-small">{item.product.category}</div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="cart-qty-input"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateQty(item.product.id, parseInt(e.target.value) || 0)}
                            aria-label={`Quantity for ${item.product.name}`}
                          />
                        </td>
                        <td className="text-right amount">{formatPKR(item.unitPricePaise)}</td>
                        <td className="text-right amount" style={{ fontWeight: 600 }}>
                          {formatPKR(lineTotal(item.quantity, item.unitPricePaise))}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeItem(item.product.id)}
                            aria-label={`Remove ${item.product.name} from cart`}
                            style={{ color: 'var(--danger)', padding: '.25rem' }}
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Bill Summary */}
        <div className="bill-panel">
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '1rem' }}>Bill Summary</h2>

            <div className="bill-total-row">
              <span className="text-muted">Subtotal</span>
              <span className="currency">{formatPKR(subtotal)}</span>
            </div>
            <div className="bill-total-row grand">
              <span>Grand Total</span>
              <span className="currency">{formatPKR(subtotal)}</span>
            </div>

            <hr className="divider" />

            <div style={{ marginBottom: '1rem' }}>
              <p className="form-label" style={{ marginBottom: '.5rem' }}>Payment Method (طریقہ ادائیگی)</p>
              <div className="payment-pills">
                {(['cash', 'wallet', 'udhaar'] as const).map(method => (
                  <button
                    key={method}
                    className={`payment-pill${cart.paymentMethod === method ? ' selected' : ''}`}
                    onClick={() => dispatch({ type: 'SET_PAYMENT_METHOD', payload: method })}
                    aria-pressed={cart.paymentMethod === method}
                  >
                    {method === 'cash' ? '💵' : method === 'wallet' ? '📱' : '📒'}
                    {method === 'cash' ? 'Cash (نقد)' : method === 'wallet' ? 'JazzCash / EasyPaisa' : 'Udhaar (ادھار)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bill composition — see at a glance which item carries the bill */}
            <div style={{ margin: '1rem 0 .5rem', borderTop: '1px solid var(--line)', paddingTop: '.75rem' }}>
              <h3 style={{ margin: '0 0 .5rem', fontSize: '1rem', fontWeight: 700 }}>Current bill share</h3>
              <p style={{ margin: '-.25rem 0 .75rem', fontSize: '.8125rem', color: 'var(--text-muted)' }}>
                {cart.items.length ? 'Each product contributes this much of the grand total' : 'Add products to the bill to see its composition'}
              </p>
              <DonutChart
                data={cartMix(cart)}
                formatValue={formatPKR}
                centerLabel="Bill"
                ariaLabel={`Composition of the current bill, grand total ${formatPKR(subtotal)}`}
                emptyMessage="No items in the bill yet"
              />
            </div>

            {cart.paymentMethod === 'udhaar' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="udhaar-customer">Customer (required for Udhaar)</label>
                <select
                  id="udhaar-customer"
                  className="form-control"
                  value={cart.customerId ?? ''}
                  onChange={e => {
                    const c = state.customers.find(c => c.id === e.target.value);
                    if (c) dispatch({ type: 'SET_CART_CUSTOMER', payload: { customerId: c.id, customerName: c.name } });
                    else dispatch({ type: 'SET_CART_CUSTOMER', payload: null });
                  }}
                >
                  <option value="">Select customer…</option>
                  {state.customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                  ))}
                </select>
                {state.customers.length === 0 && (
                  <p className="form-hint">No customers yet. Add one in <Link href="/udhaar">Udhaar Khata</Link>.</p>
                )}
              </div>
            )}

            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={cart.items.length === 0 || (cart.paymentMethod === 'udhaar' && !cart.customerId)}
              onClick={() => setShowReview(true)}
              style={{ marginTop: '.5rem' }}
            >
              Review &amp; Confirm Bill <ArrowRight weight="bold" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReview && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Review and confirm sale" onClick={e => { if (e.target === e.currentTarget && !submitting) setShowReview(false); }}>
          <div className="modal modal-lg">
            <div className="modal__header">
              <span className="modal__title">Review &amp; Confirm Bill</span>
              {!submitting && <button className="modal__close" onClick={() => setShowReview(false)} aria-label="Close review"><X size={20} /></button>}
            </div>
            <div className="modal__body">
              <div className="table-wrapper" style={{ marginBottom: '1rem', boxShadow: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }}>
                <table className="data-table" aria-label="Bill line items">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map(item => (
                      <tr key={item.product.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.product.name}</div>
                          <div className="text-muted text-small">{item.product.unit}</div>
                        </td>
                        <td className="text-right amount">{item.quantity}</td>
                        <td className="text-right amount">{formatPKR(item.unitPricePaise)}</td>
                        <td className="text-right amount" style={{ fontWeight: 600 }}>{formatPKR(lineTotal(item.quantity, item.unitPricePaise))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.375rem' }}>
                <div className="bill-total-row" style={{ padding: '.25rem 0' }}>
                  <span className="text-muted">Payment Method</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cart.paymentMethod}{cart.customerName ? ` — ${cart.customerName}` : ''}</span>
                </div>
                <div className="bill-total-row grand" style={{ fontSize: '1.25rem' }}>
                  <span>Amount Payable</span>
                  <span className="currency">{formatPKR(subtotal)}</span>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-secondary" onClick={() => setShowReview(false)} disabled={submitting}>Back to Cart</button>
              <button className="btn btn-primary btn-lg" onClick={confirmSale} disabled={submitting}>
                {submitting ? 'Confirming…' : 'Confirm Sale ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
