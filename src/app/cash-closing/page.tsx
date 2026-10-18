'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Vault, CheckCircle, WarningCircle, ClockCounterClockwise,
  FloppyDisk, LockKey, ArrowRight, Calculator, Plus, Minus, Equals
} from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { formatPKR, generateId, isUdhaarRepayment, todayISO, rupeesToPaise } from '@/lib/financial';
import { cashSeries } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import GroupedBars from '@/components/charts/GroupedBars';
import type { CashClosing } from '@/types';
import db from '@/lib/db';
import PageHeader from '@/components/common/PageHeader';

export default function CashClosingPage() {
  const { state, dispatch } = useApp();
  const [today, setToday] = useState<string>('');
  const [openingCashInput, setOpeningCashInput] = useState<string>('2000');
  const [physicalCashInput, setPhysicalCashInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Chart data — expected vs actually counted drawer, last 7 closings
  const closings = useMemo(() => cashSeries(state.cashClosings), [state.cashClosings]);

  useEffect(() => {
    // Hydrate client-only form state (today's date + any saved closing) from the
    // local ledger. This cannot be derived during render: the date is client-only
    // and the saved closing arrives asynchronously from IndexedDB.
    /* eslint-disable react-hooks/set-state-in-effect */
    const t = todayISO();
    setToday(t);
    const existing = state.cashClosings.find(c => c.businessDate === t);
    if (existing) {
      setOpeningCashInput((existing.openingCashPaise / 100).toString());
      setPhysicalCashInput((existing.physicalCashPaise / 100).toString());
      setNotesInput(existing.notes || '');
      setIsLocked(existing.status === 'finalized');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state.cashClosings]);

  const todayClosing = state.cashClosings.find(c => c.businessDate === today);

  // Compute today's cash movements from confirmed transactions and expenses
  const { cashSales, cashRepayments, cashExpenses } = useMemo(() => {
    // Confirmed cash sales today
    const sales = state.transactions
      .filter(t => t.businessDate === today && t.status === 'confirmed' && t.type === 'sale' && t.paymentMethod === 'cash' && !isUdhaarRepayment(t))
      .reduce((sum, t) => sum + t.totalPaise, 0);

    // Cash customer repayments recorded today in ledger
    let repayments = 0;
    state.customers.forEach(c => {
      c.ledger.forEach(entry => {
        if (entry.date === today && entry.type === 'repayment' && entry.paymentMethod === 'cash') {
          repayments += entry.amountPaise;
        }
      });
    });

    // Cash expenses paid today
    const expenses = state.expenses
      .filter(e => e.date === today && !e.reversed && e.paymentMode === 'cash')
      .reduce((sum, e) => sum + e.amountPaise, 0);

    return {
      cashSales: sales,
      cashRepayments: repayments,
      cashExpenses: expenses,
    };
  }, [state.transactions, state.customers, state.expenses, today]);

  const openingCashPaise = rupeesToPaise(parseFloat(openingCashInput) || 0);
  const expectedDrawerPaise = openingCashPaise + cashSales + cashRepayments - cashExpenses;

  const physicalCashPaise = physicalCashInput ? rupeesToPaise(parseFloat(physicalCashInput) || 0) : null;
  const differencePaise = physicalCashPaise !== null ? physicalCashPaise - expectedDrawerPaise : null;

  async function handleSaveDraft() {
    const now = new Date().toISOString();
    const closing: CashClosing = {
      id: todayClosing?.id || generateId(),
      businessDate: today,
      openingCashPaise,
      cashSalesPaise: cashSales,
      cashRepaymentsPaise: cashRepayments,
      cashExpensesPaise: cashExpenses,
      expectedDrawerPaise,
      physicalCashPaise: physicalCashPaise ?? 0,
      differencePaise: differencePaise ?? 0,
      notes: notesInput.trim() || undefined,
      status: 'draft',
      createdAt: todayClosing?.createdAt || now,
    };

    await db.saveCashClosing(closing);
    if (todayClosing) {
      dispatch({ type: 'UPDATE_CASH_CLOSING', payload: closing });
    } else {
      dispatch({ type: 'ADD_CASH_CLOSING', payload: closing });
    }
    alert('Draft cash closing saved successfully.');
  }

  async function handleFinalizeAndLock() {
    if (physicalCashPaise === null) {
      alert('Please enter the physically counted drawer cash before locking the day.');
      return;
    }

    if (differencePaise !== 0 && !notesInput.trim()) {
      alert('There is a cash difference. Please enter an explanation or note in the Shortage/Surplus Notes field.');
      return;
    }

    if (!confirm('Are you sure you want to finalize and LOCK today’s cash closing? This establishes an immutable daily register audit.')) {
      return;
    }

    const now = new Date().toISOString();
    const closing: CashClosing = {
      id: todayClosing?.id || generateId(),
      businessDate: today,
      openingCashPaise,
      cashSalesPaise: cashSales,
      cashRepaymentsPaise: cashRepayments,
      cashExpensesPaise: cashExpenses,
      expectedDrawerPaise,
      physicalCashPaise,
      differencePaise: differencePaise ?? 0,
      notes: notesInput.trim() || undefined,
      status: 'finalized',
      createdAt: todayClosing?.createdAt || now,
      finalizedAt: now,
    };

    await db.saveCashClosing(closing);
    if (todayClosing) {
      dispatch({ type: 'UPDATE_CASH_CLOSING', payload: closing });
    } else {
      dispatch({ type: 'ADD_CASH_CLOSING', payload: closing });
    }
    setIsLocked(true);
  }

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <PageHeader
        icon={<Vault size={28} color="var(--accent-deep)" />}
        title="Daily Cash Drawer Closing & Reconciliation"
        subtitle="Reconcile physical till cash with the register ledger (روزنامچہ). Digital receipts — JazzCash, EasyPaisa, Bank — are excluded from physical cash."
        related={[
          { href: '/transactions', label: 'Transactions', hint: "Today's cash sales come from here" },
          { href: '/expenses', label: 'Expenses', hint: 'Cash expenses leave the till' },
          { href: '/udhaar', label: 'Udhaar Khata', hint: 'Cash repayments add to the till' },
        ]}
        actions={
          <>
            <span className="badge badge-info" style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}>
              Business Date: {today}
            </span>
            {isLocked && (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <LockKey size={14} weight="bold" /> Day Finalized & Locked
              </span>
            )}
          </>
        }
      />

      {/* Chart — drawer accuracy at a glance */}
      <ChartCard
        title="Expected vs counted cash — last 7 closings"
        hint="Bar pairs that match mean a clean roznamcha; gaps are drawer differences"
        style={{ marginBottom: '1.5rem' }}
      >
        <GroupedBars
          series={closings.map(c => ({ label: c.label, a: c.expected, b: c.physical }))}
          legend={['Expected drawer', 'Physical cash']}
          colorA="var(--accent)"
          colorB="var(--success)"
          formatValue={formatPKR}
          ariaLabel="Expected drawer versus physically counted cash for the last seven closings"
          emptyMessage="Close a day to start the cash history"
        />
      </ChartCard>

      {/* Main Reconciliation Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
          <Calculator size={22} color="var(--accent)" />
          <h2 style={{ fontSize: '1.125rem' }}>Expected Physical Cash Formula</h2>
        </div>

        {/* Formula Visual Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            background: 'var(--surface-soft)',
            padding: '1.25rem',
            borderRadius: 'var(--radius)',
          }}
        >
          {/* Opening Cash */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>OPENING CASH</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="0"
                step="1"
                disabled={isLocked}
                value={openingCashInput}
                onChange={e => setOpeningCashInput(e.target.value)}
                className="form-input"
                style={{ width: '130px', fontWeight: 700 }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start of day till float</span>
          </div>

          {/* Plus Cash Sales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
              <Plus size={14} weight="bold" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>CASH SALES</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }} className="num">
              {formatPKR(cashSales)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Counter physical cash sales</span>
          </div>

          {/* Plus Customer Cash Repayments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
              <Plus size={14} weight="bold" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>CASH UDHAAR JAMA</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }} className="num">
              {formatPKR(cashRepayments)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Customer repayments in cash</span>
          </div>

          {/* Minus Cash Expenses */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger)' }}>
              <Minus size={14} weight="bold" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>CASH EXPENSES</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }} className="num">
              {formatPKR(cashExpenses)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paid out of register drawer</span>
          </div>

          {/* Expected Drawer Total */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              background: 'var(--surface-blue)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-deep)' }}>
              <Equals size={14} weight="bold" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>EXPECTED IN DRAWER</span>
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--accent-deep)' }} className="num">
              {formatPKR(expectedDrawerPaise)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Exact physical cash expected</span>
          </div>
        </div>

        {/* Physical Cash Count and Reconciliation Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Physical Cash Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              Counted Physical Cash in Drawer (Rs.) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={isLocked}
              placeholder="Enter physical cash counted in notes and coins..."
              value={physicalCashInput}
              onChange={e => setPhysicalCashInput(e.target.value)}
              className="form-input"
              style={{ fontSize: '1.25rem', padding: '0.75rem 1rem', fontWeight: 700 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Count notes (Rs.500, Rs.200, Rs.100, Rs.50, Rs.20, Rs.10) and coins physically present in the till.
            </span>
          </div>

          {/* Variance / Difference Display */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '2px solid',
              borderColor: differencePaise === null
                ? 'var(--line)'
                : differencePaise === 0
                  ? 'var(--success)'
                  : 'var(--danger)',
              background: differencePaise === null
                ? 'var(--surface-soft)'
                : differencePaise === 0
                  ? 'var(--success-bg)'
                  : 'var(--danger-bg)',
            }}
          >
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              TILL DIFFERENCE / VARIANCE
            </div>
            <div
              className="num"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                marginTop: '0.375rem',
                color: differencePaise === null
                  ? 'var(--text-muted)'
                  : differencePaise === 0
                    ? 'var(--success)'
                    : 'var(--danger)',
              }}
            >
              {differencePaise === null ? 'Enter physical count' : (differencePaise > 0 ? `+${formatPKR(differencePaise)} (Surplus)` : differencePaise < 0 ? `${formatPKR(differencePaise)} (Shortage)` : 'Rs.0.00 (Balanced)')}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.375rem', color: 'var(--text-muted)' }}>
              {differencePaise === null
                ? 'Difference will calculate immediately.'
                : differencePaise === 0
                  ? 'Perfect match: physical drawer matches register ledger exactly!'
                  : differencePaise < 0
                    ? 'Shortage detected: counted cash is less than ledger expectation.'
                    : 'Surplus detected: counted cash exceeds ledger expectation.'}
            </div>
          </div>
        </div>

        {/* Notes & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="form-label">Reason for Variance / Closing Notes</label>
          <input
            type="text"
            disabled={isLocked}
            placeholder="e.g. Rs.20 coin shortage or drawer verified by owner"
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
            className="form-input"
          />
        </div>

        {!isLocked ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSaveDraft}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <FloppyDisk size={18} />
              <span>Save Draft Closing</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFinalizeAndLock}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <LockKey size={18} weight="bold" />
              <span>Finalize & Lock Business Day</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius)',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
            }}
          >
            <CheckCircle size={20} weight="fill" />
            Today’s business day is finalized and locked. Audit record is immutable.
          </div>
        )}
      </div>

      {/* Historical Closings Register */}
      <div className="card table-wrap" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClockCounterClockwise size={20} />
          Closing History & Audit Trail
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>BUSINESS DATE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>OPENING</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>CASH SALES</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>EXPECTED</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>PHYSICAL COUNT</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>VARIANCE</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {state.cashClosings.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  No historical closings recorded yet.
                </td>
              </tr>
            ) : (
              state.cashClosings.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{c.businessDate}</td>
                  <td className="num" style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>{formatPKR(c.openingCashPaise)}</td>
                  <td className="num" style={{ padding: '0.875rem 1rem', textAlign: 'right', color: 'var(--success)' }}>+{formatPKR(c.cashSalesPaise)}</td>
                  <td className="num" style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 600 }}>{formatPKR(c.expectedDrawerPaise)}</td>
                  <td className="num" style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700 }}>{formatPKR(c.physicalCashPaise)}</td>
                  <td className="num" style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: c.differencePaise === 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {c.differencePaise > 0 ? `+${formatPKR(c.differencePaise)}` : formatPKR(c.differencePaise)}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                    <span className={`badge ${c.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
