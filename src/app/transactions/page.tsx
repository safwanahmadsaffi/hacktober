'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Receipt, Plus, MagnifyingGlass, X, Eye, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { formatPKR, formatDateTime, generateId, isRealSale, todayISO } from '@/lib/financial';
import { logEvent, deriveLegacyLog, newestFirst } from '@/lib/txlog';
import { dailySeries, paymentMix, useBusinessToday } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import GroupedBars from '@/components/charts/GroupedBars';
import DonutChart from '@/components/charts/DonutChart';
import type { Transaction, TransactionType, TransactionStatus, TransactionLineItem, TransactionLogEntry } from '@/types';
import db from '@/lib/db';
import PageHeader from '@/components/common/PageHeader';

function statusBadge(status: TransactionStatus) {
  const map = { confirmed: 'badge-success', draft: 'badge-neutral', reversed: 'badge-danger' };
  const labels = { confirmed: 'Confirmed', draft: 'Draft', reversed: 'Reversed' };
  return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
}

function typeBadge(type: TransactionType) {
  return <span className={`badge ${type === 'sale' ? 'badge-accent' : 'badge-info'}`}>{type === 'sale' ? 'Sale' : 'Purchase'}</span>;
}

const EVENT_META: Record<string, { label: string; badge: string }> = {
  receipt_created:   { label: 'Receipt created',   badge: 'badge-info' },
  receipt_confirmed: { label: 'Receipt confirmed', badge: 'badge-success' },
  stock_deducted:    { label: 'Stock reduced',     badge: 'badge-warning' },
  stock_restored:    { label: 'Stock restored',    badge: 'badge-success' },
  udhaar_added:      { label: 'Udhaar added',      badge: 'badge-warning' },
  reversed:          { label: 'Reversed',          badge: 'badge-danger' },
};

/** Human-readable list of every change this receipt caused. */
function changeLines(tx: Transaction): string[] {
  const lines: string[] = [];
  for (const item of tx.items) {
    const direction = tx.type === 'sale' ? '−' : '+';
    const rolled = tx.status === 'reversed' ? ' (rolled back)' : '';
    lines.push(`Stock ${direction}${item.quantity} ${item.unit} · ${item.productName}${rolled}`);
  }
  if (tx.paymentMethod === 'udhaar' && tx.customerName) {
    lines.push(`${tx.status === 'reversed' ? 'Udhaar rolled back ' : 'Udhaar +'}${formatPKR(tx.totalPaise)} · ${tx.customerName}`);
  }
  if (lines.length === 0) lines.push('No stock or balance changes for this receipt.');
  return lines;
}

export default function TransactionsPage() {
  const { state, dispatch } = useApp();
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewTx, setViewTx] = useState<Transaction | null>(null);

  const transactions = [...state.transactions]
    .filter(t => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (dateFrom && t.businessDate < dateFrom) return false;
      if (dateTo && t.businessDate > dateTo) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalRevenue = state.transactions.filter(t => t.status === 'confirmed' && isRealSale(t)).reduce((s, t) => s + t.totalPaise, 0);
  const totalPurchases = state.transactions.filter(t => t.type === 'purchase' && t.status === 'confirmed').reduce((s, t) => s + t.totalPaise, 0);

  // Visual pulse for this ledger
  const today = useBusinessToday();
  const salesVsPurchases7 = useMemo(
    () => dailySeries(state.transactions, 7, today).map(p => ({ label: p.label, a: p.sales, b: p.purchases })),
    [state.transactions, today],
  );
  const payMix = useMemo(() => paymentMix(state.transactions), [state.transactions]);

  /** Full activity log for the detail modal, newest first (backfills old receipts). */
  function logFor(tx: Transaction): TransactionLogEntry[] {
    return newestFirst(tx.log ?? deriveLegacyLog(tx));
  }

  async function reverseTransaction(tx: Transaction) {
    if (!confirm(`Reverse this ${tx.type}? This will restore stock and mark the transaction as reversed.`)) return;
    const now = new Date().toISOString();
    const logEntries: TransactionLogEntry[] = [logEvent('reversed', `${tx.type === 'sale' ? 'Sale' : 'Purchase'} receipt of ${formatPKR(tx.totalPaise)} reversed`)];
    const reversed = { ...tx, status: 'reversed' as const, reversedById: undefined };

    // Restore stock
    if (tx.type === 'sale' && tx.status === 'confirmed') {
      for (const item of tx.items) {
        const p = state.products.find(p => p.id === item.productId);
        if (p) {
          const updated = { ...p, stock: p.stock + item.quantity, updatedAt: now };
          await db.saveProduct(updated);
          dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
          logEntries.push(logEvent(
            'stock_restored',
            `Stock ${item.productName}: ${p.stock} → ${p.stock + item.quantity} ${item.unit} (+${item.quantity})`,
          ));
        }
      }
    }

    await db.saveTransaction({ ...reversed, log: [...(reversed.log ?? []), ...logEntries] });
    dispatch({ type: 'UPDATE_TRANSACTION', payload: { ...reversed, log: [...(reversed.log ?? []), ...logEntries] } });
    setViewTx(null);
  }

  return (
    <div>
      <PageHeader
        icon={<Receipt weight="fill" />}
        title="Transactions"
        subtitle="The sales and purchase ledger. Receipts are not profit — cost of goods is evaluated separately in Reports."
        related={[
          { href: '/', label: 'Quick Sale', hint: 'Create a new sale receipt' },
          { href: '/udhaar', label: 'Udhaar Khata', hint: 'Credit sales appear on the customer khata' },
          { href: '/reports', label: 'Reports', hint: 'Turn these receipts into profit figures' },
        ]}
        actions={
          <Link href="/" className="btn btn-primary">
            <Plus size={16} /> New Sale
          </Link>
        }
      />

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Gross Revenue</div>
          <div className="stat-card__value" style={{ color: 'var(--success)' }}>{formatPKR(totalRevenue)}</div>
          <div className="stat-card__sub">Confirmed sales only</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Total Purchases</div>
          <div className="stat-card__value" style={{ color: 'var(--accent-deep)' }}>{formatPKR(totalPurchases)}</div>
          <div className="stat-card__sub">Confirmed purchases only</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Transaction Count</div>
          <div className="stat-card__value">{state.transactions.length}</div>
          <div className="stat-card__sub">All types and statuses</div>
        </div>
      </div>

      {/* Charts — the ledger as pictures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <ChartCard title="Sales vs Purchases — last 7 days" hint="Every day business moved (quiet days included)">
          <GroupedBars series={salesVsPurchases7} legend={['Sales', 'Purchases']} colorA="var(--success)" colorB="var(--accent-deep)" formatValue={formatPKR} emptyMessage="No receipts in the last 7 days" />
        </ChartCard>
        <ChartCard title="How receipts are paid" hint="Confirmed sales by payment method">
          <DonutChart data={payMix} formatValue={formatPKR} emptyMessage="Confirm a sale to see the payment mix" />
        </ChartCard>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-control" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value as TransactionType | '')} aria-label="Filter by type">
          <option value="">All Types</option>
          <option value="sale">Sales</option>
          <option value="purchase">Purchases</option>
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as TransactionStatus | '')} aria-label="Filter by status">
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="draft">Draft</option>
          <option value="reversed">Reversed</option>
        </select>
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="To date" />
        {(typeFilter || statusFilter || dateFrom || dateTo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {state.isLoading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="state-container">
          <div className="state-icon"><Receipt size={40} /></div>
          <div className="state-title">No transactions</div>
          <div className="state-message">{state.transactions.length === 0 ? 'Create your first sale via Quick Sale.' : 'No transactions match the current filters.'}</div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" aria-label="Transactions list">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="text-small">{formatDateTime(tx.createdAt)}</td>
                  <td>{typeBadge(tx.type)}</td>
                  <td>{statusBadge(tx.status)}</td>
                  <td className="text-small">{tx.items.length} item(s)</td>
                  <td style={{ textTransform: 'capitalize' }}>{tx.paymentMethod}</td>
                  <td>{tx.customerName ?? '—'}</td>
                  <td className="text-right amount" style={{ fontWeight: 600 }}>{formatPKR(tx.totalPaise)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewTx(tx)} aria-label="View transaction details"><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Modal */}
      {viewTx && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setViewTx(null); }}>
          <div className="modal modal-lg">
            <div className="modal__header">
              <span className="modal__title">Transaction Detail</span>
              <button className="modal__close" onClick={() => setViewTx(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="modal__body">
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {typeBadge(viewTx.type)} {statusBadge(viewTx.status)}
                <span className="text-muted text-small" style={{ alignSelf: 'center' }}>{formatDateTime(viewTx.createdAt)}</span>
              </div>
              {viewTx.customerName && <p style={{ marginBottom: '.5rem' }}><strong>Customer:</strong> {viewTx.customerName}</p>}
              <p style={{ marginBottom: '1rem' }}><strong>Payment:</strong> {viewTx.paymentMethod.toUpperCase()}</p>
              <div className="table-wrapper" style={{ boxShadow: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                <table className="data-table">
                  <thead><tr><th>Product</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {viewTx.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.productName}</td>
                        <td className="text-right">{item.quantity} {item.unit}</td>
                        <td className="text-right amount">{formatPKR(item.unitPricePaise)}</td>
                        <td className="text-right amount" style={{ fontWeight: 600 }}>{formatPKR(item.totalPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bill-total-row grand" style={{ fontSize: '1.125rem', paddingTop: '.5rem', borderTop: '2px solid var(--line)' }}>
                <span>Grand Total</span><span className="currency">{formatPKR(viewTx.totalPaise)}</span>
              </div>

              {/* What changed because of this receipt */}
              <div style={{ marginTop: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.75rem 1rem' }}>
                <h3 style={{ margin: '0 0 .375rem', fontSize: '.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.02em', color: 'var(--text-muted)' }}>
                  Changes from this receipt
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.25rem', fontSize: '.875rem' }}>
                  {changeLines(viewTx).map(line => <li key={line}>{line}</li>)}
                </ul>
              </div>

              {/* Activity log — what happened on this receipt, newest first */}
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ margin: '0 0 .375rem', fontSize: '.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.02em', color: 'var(--text-muted)' }}>
                  Activity log
                </h3>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.375rem' }}>
                  {logFor(viewTx).map(entry => {
                    const meta = EVENT_META[entry.event] ?? { label: entry.event, badge: 'badge-neutral' };
                    return (
                      <li key={entry.id} style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', fontSize: '.875rem' }}>
                        <span className={`badge ${meta.badge}`} style={{ whiteSpace: 'nowrap' }}>{meta.label}</span>
                        <span style={{ minWidth: 0 }}>{entry.message}</span>
                        <span className="text-muted text-small" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {viewTx.reversalOfId && <p className="text-muted text-small" style={{ marginTop: '.75rem' }}>↩ Reversal of transaction #{viewTx.reversalOfId.slice(-6)}</p>}
            </div>
            {viewTx.status === 'confirmed' && (
              <div className="modal__footer">
                <button className="btn btn-secondary" onClick={() => setViewTx(null)}>Close</button>
                <button className="btn btn-danger btn-sm" onClick={() => reverseTransaction(viewTx)}>
                  <ArrowCounterClockwise size={15} /> Reverse Transaction
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
