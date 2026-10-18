'use client';

import { useState, useEffect } from 'react';
import {
  Money, Plus, MagnifyingGlass, Funnel, ArrowCounterClockwise,
  CheckCircle, WarningCircle, X, Receipt, Calendar, CreditCard, Bank
} from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { formatPKR, generateId, todayISO, rupeesToPaise } from '@/lib/financial';
import { expensesByCategory } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import DonutChart from '@/components/charts/DonutChart';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types';
import db from '@/lib/db';
import PageHeader from '@/components/common/PageHeader';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: 'rent', label: 'Shop Rent (دکان کا کرایہ)', icon: '🏢' },
  { key: 'electricity', label: 'Electricity / WAPDA / LESCO (بجلی کا بل)', icon: '⚡' },
  { key: 'transport', label: 'Transport / Freight (کرایہ مال)', icon: '🚚' },
  { key: 'wages', label: 'Wages / Mazdoori (تنخواہ و مزدوری)', icon: '👥' },
  { key: 'packaging', label: 'Shopping Bags / Lifafay (شاپنگ بیگز و لفافے)', icon: '📦' },
  { key: 'maintenance', label: 'Maintenance / Repairs (مرمت)', icon: '🔧' },
  { key: 'miscellaneous', label: 'Staff Tea & Chai (چائے و متفرق)', icon: '☕' },
];

export default function ExpensesPage() {
  const { state, dispatch } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  const [showReversed, setShowReversed] = useState(false);
  const [search, setSearch] = useState('');

  // Chart data — the spend picture
  const expenseCats = expensesByCategory(state.expenses);

  // Form states
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<ExpenseCategory>('miscellaneous');
  const [paymentModeInput, setPaymentModeInput] = useState<PaymentMethod>('cash');
  const [dateInput, setDateInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    // Client-only default: the date must not be resolved during a prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateInput(todayISO());
  }, []);

  // Filtering
  const filteredExpenses = state.expenses.filter(item => {
    if (!showReversed && item.reversed) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (paymentModeFilter !== 'all' && item.paymentMode !== paymentModeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNote = item.note?.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      if (!matchNote && !matchCat) return false;
    }
    return true;
  });

  // Calculate totals (excluding reversed)
  const activeExpenses = state.expenses.filter(e => !e.reversed);
  const totalExpenses = activeExpenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const cashExpenses = activeExpenses.filter(e => e.paymentMode === 'cash').reduce((sum, e) => sum + e.amountPaise, 0);
  const upiExpenses = activeExpenses.filter(e => e.paymentMode === 'wallet').reduce((sum, e) => sum + e.amountPaise, 0);
  const bankExpenses = activeExpenses.filter(e => e.paymentMode === 'bank').reduce((sum, e) => sum + e.amountPaise, 0);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = rupeesToPaise(parseFloat(amountInput) || 0);
    if (amount <= 0) return;

    const now = new Date().toISOString();
    const newExpense: Expense = {
      id: generateId(),
      amountPaise: amount,
      category: categoryInput,
      paymentMode: paymentModeInput,
      date: dateInput || todayISO(),
      note: noteInput.trim() || undefined,
      reversed: false,
      createdAt: now,
    };

    await db.saveExpense(newExpense);
    dispatch({ type: 'ADD_EXPENSE', payload: newExpense });

    setAmountInput('');
    setNoteInput('');
    setShowAddModal(false);
  }

  async function handleReverseExpense(expense: Expense) {
    if (!confirm(`Are you sure you want to reverse this expense of ${formatPKR(expense.amountPaise)}? It will remain logged for audit compliance.`)) {
      return;
    }

    const updated: Expense = {
      ...expense,
      reversed: true,
      reversedAt: new Date().toISOString(),
    };

    await db.saveExpense(updated);
    dispatch({ type: 'UPDATE_EXPENSE', payload: updated });
  }

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <PageHeader
        icon={<Money size={28} color="var(--accent-deep)" />}
        title="Operating Expenses"
        subtitle="Record shop overheads split by cash or digital. Cash expenses are deducted from the till during the daily roznamcha."
        related={[
          { href: '/cash-closing', label: 'Cash Closing', hint: 'Cash expenses reduce the expected drawer' },
          { href: '/reports', label: 'Reports', hint: 'Expenses feed net profit' },
          { href: '/transactions', label: 'Transactions', hint: 'The sales these costs offset' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} weight="bold" />
            <span>Record Expense</span>
          </button>
        }
      />

      {/* Chart — where the shop's money goes */}
      <ChartCard
        title="Expenses by category"
        hint="Total recorded spend per category; the biggest slice deserves attention"
        style={{ marginBottom: '1rem' }}
      >
        <DonutChart
          data={expenseCats}
          formatValue={formatPKR}
          centerLabel="Spent"
          ariaLabel="Recorded expenses by category"
          emptyMessage="Record an expense to see the breakdown"
        />
      </ChartCard>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--text)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Expenses
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.375rem' }} className="num">
            {formatPKR(totalExpenses)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {activeExpenses.length} active records
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            💵 Cash Paid (Drawer Deduction)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)', marginTop: '0.375rem' }} className="num">
            {formatPKR(cashExpenses)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Directly deducted in Cash Closing
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            📱 JazzCash, EasyPaisa & Bank Paid
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-deep)', marginTop: '0.375rem' }} className="num">
            {formatPKR(upiExpenses + bankExpenses)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Wallets: {formatPKR(upiExpenses)} • Bank: {formatPKR(bankExpenses)}
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search expenses by note or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.25rem', width: '100%' }}
            />
            <MagnifyingGlass size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
            ))}
          </select>

          <select
            value={paymentModeFilter}
            onChange={e => setPaymentModeFilter(e.target.value)}
            className="form-select"
            style={{ width: 'auto' }}
          >
            <option value="all">All Payment Modes (تمام ذرائع)</option>
            <option value="cash">💵 Cash Only (صرف نقد)</option>
            <option value="wallet">📱 JazzCash / EasyPaisa</option>
            <option value="bank">🏛 Bank Transfer (بینک)</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showReversed}
            onChange={e => setShowReversed(e.target.checked)}
          />
          <span>Show Reversed Items</span>
        </label>
      </div>

      {/* Expenses Table */}
      <div className="card table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>DATE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>CATEGORY</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>NOTE / DETAILS</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>PAYMENT MODE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>AMOUNT</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Receipt size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 500 }}>No expense entries found</p>
                  <p style={{ fontSize: '0.8125rem' }}>Click &quot;Record Expense&quot; above to log an operational outflow.</p>
                </td>
              </tr>
            ) : (
              filteredExpenses.map(item => {
                const cat = CATEGORIES.find(c => c.key === item.category);
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--line)',
                      opacity: item.reversed ? 0.5 : 1,
                      textDecoration: item.reversed ? 'line-through' : 'none',
                    }}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                      {item.date}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span>{cat?.icon || '📁'}</span>
                        <span style={{ fontWeight: 500 }}>{cat?.label || item.category}</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {item.note || '—'}
                      {item.reversed && (
                        <span className="badge badge-danger" style={{ marginLeft: '0.5rem', textDecoration: 'none' }}>
                          Reversed
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>
                      <span className={`badge ${item.paymentMode === 'cash' ? 'badge-warning' : 'badge-info'}`}>
                        {item.paymentMode.toUpperCase()}
                      </span>
                    </td>
                    <td className="num amount" style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                      -{formatPKR(item.amountPaise)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      {!item.reversed ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleReverseExpense(item)}
                          title="Reverse this expense"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
                        >
                          <ArrowCounterClockwise size={14} />
                          <span>Reverse</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audit Logged</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Expense */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Record Operating Expense</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="0.5"
                  step="0.01"
                  autoFocus
                  placeholder="0.00"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Expense Category *</label>
                <select
                  value={categoryInput}
                  onChange={e => setCategoryInput(e.target.value as ExpenseCategory)}
                  className="form-select"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${paymentModeInput === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPaymentModeInput('cash')}
                    style={{ justifyContent: 'center' }}
                  >
                    💵 Cash (نقد)
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentModeInput === 'wallet' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPaymentModeInput('wallet')}
                    style={{ justifyContent: 'center' }}
                  >
                    📱 JazzCash / EasyPaisa
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentModeInput === 'bank' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPaymentModeInput('bank')}
                    style={{ justifyContent: 'center' }}
                  >
                    🏛 Bank (بینک)
                  </button>
                </div>
                {paymentModeInput === 'cash' && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.375rem' }}>
                    ⚠️ This cash amount will be deducted from today&apos;s Cash Drawer calculation.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  required
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Note / Receipt / Vendor Details (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Electric bill for Oct or 500 carry bags"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
