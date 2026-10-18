'use client';

import { useState } from 'react';
import {
  HandCoins, Plus, MagnifyingGlass, User, Phone,
  ClockCounterClockwise, ArrowDownLeft, ArrowUpRight, X, Check, Wallet
} from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { UDHAAR_REPAYMENT_PRODUCT_ID, formatPKR, generateId, todayISO, rupeesToPaise } from '@/lib/financial';
import { topDebtors } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import RankBars from '@/components/charts/RankBars';
import type { Customer, LedgerEntry, PaymentMethod } from '@/types';
import db from '@/lib/db';
import PageHeader from '@/components/common/PageHeader';

export default function UdhaarPage() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  // Repayment form states
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState<PaymentMethod>('cash');
  const [repaymentNote, setRepaymentNote] = useState('');

  // Manual Credit form states
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  // Chart data — the khata's heaviest balances
  const debtors = topDebtors(state.customers);

  const filteredCustomers = state.customers.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  const totalOutstanding = state.customers.reduce((sum, c) => sum + (c.balancePaise > 0 ? c.balancePaise : 0), 0);
  const activeBorrowersCount = state.customers.filter(c => c.balancePaise > 0).length;

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) return;

    const initPaise = initialBalance ? rupeesToPaise(parseFloat(initialBalance) || 0) : 0;
    const now = new Date().toISOString();
    const ledger: LedgerEntry[] = initPaise > 0 ? [{
      id: generateId(),
      type: 'credit_sale',
      amountPaise: initPaise,
      note: 'Opening balance / initial credit',
      date: todayISO(),
      createdAt: now,
    }] : [];

    const newCustomer: Customer = {
      id: generateId(),
      name: customerName.trim(),
      phone: customerPhone.trim() || undefined,
      balancePaise: initPaise,
      ledger,
      createdAt: now,
      updatedAt: now,
    };

    await db.saveCustomer(newCustomer);
    dispatch({ type: 'ADD_CUSTOMER', payload: newCustomer });
    setCustomerName('');
    setCustomerPhone('');
    setInitialBalance('');
    setShowAddCustomer(false);
  }

  async function handleRecordRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = rupeesToPaise(parseFloat(repaymentAmount) || 0);
    if (amount <= 0) return;

    const now = new Date().toISOString();
    const entry: LedgerEntry = {
      id: generateId(),
      type: 'repayment',
      amountPaise: amount,
      paymentMethod: repaymentMethod,
      note: repaymentNote.trim() || 'Customer repayment (Jama)',
      date: todayISO(),
      createdAt: now,
    };

    const updatedCustomer: Customer = {
      ...selectedCustomer,
      balancePaise: Math.max(0, selectedCustomer.balancePaise - amount),
      ledger: [entry, ...selectedCustomer.ledger],
      updatedAt: now,
    };

    await db.saveCustomer(updatedCustomer);
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
    setSelectedCustomer(updatedCustomer);

    // Also add to transactions ledger if physical cash or upi
    const txn = {
      id: generateId(),
      type: 'sale' as const,
      status: 'confirmed' as const,
      items: [{
        productId: UDHAAR_REPAYMENT_PRODUCT_ID,
        productName: `Udhaar Jama - ${selectedCustomer.name}`,
        unit: 'piece' as const,
        quantity: 1,
        unitPricePaise: amount,
        totalPaise: amount,
      }],
      subtotalPaise: amount,
      totalPaise: amount,
      paymentMethod: repaymentMethod,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      notes: entry.note,
      businessDate: todayISO(),
      createdAt: now,
      confirmedAt: now,
    };
    await db.saveTransaction(txn);
    dispatch({ type: 'ADD_TRANSACTION', payload: txn });

    setRepaymentAmount('');
    setRepaymentNote('');
    setShowRepaymentModal(false);
  }

  async function handleAddCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = rupeesToPaise(parseFloat(creditAmount) || 0);
    if (amount <= 0) return;

    const now = new Date().toISOString();
    const entry: LedgerEntry = {
      id: generateId(),
      type: 'credit_sale',
      amountPaise: amount,
      paymentMethod: 'udhaar',
      note: creditNote.trim() || 'Manual credit entry (Udhaar)',
      date: todayISO(),
      createdAt: now,
    };

    const updatedCustomer: Customer = {
      ...selectedCustomer,
      balancePaise: selectedCustomer.balancePaise + amount,
      ledger: [entry, ...selectedCustomer.ledger],
      updatedAt: now,
    };

    await db.saveCustomer(updatedCustomer);
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
    setSelectedCustomer(updatedCustomer);

    setCreditAmount('');
    setCreditNote('');
    setShowCreditModal(false);
  }

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <PageHeader
        icon={<HandCoins size={28} color="var(--accent-deep)" />}
        title="Udhaar Khata (Customer Credit)"
        subtitle="The auditable customer credit ledger — who owes what, and every repayment in cash, JazzCash, EasyPaisa or Raast."
        related={[
          { href: '/', label: 'Quick Sale', hint: 'Sell on udhaar from the counter' },
          { href: '/transactions', label: 'Transactions', hint: 'The receipts behind each balance' },
          { href: '/cash-closing', label: 'Cash Closing', hint: 'Cash repayments are counted in the till' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => setShowAddCustomer(true)}>
            <Plus size={18} weight="bold" />
            <span>Add New Customer</span>
          </button>
        }
      />

      {/* Chart — who carries the most credit */}
      <ChartCard
        title="Top udhaar balances"
        hint="Customers carrying the most credit right now — chase these first"
        style={{ marginBottom: '1rem' }}
      >
        <RankBars
          data={debtors}
          formatValue={formatPKR}
          ariaLabel="Customers with the largest outstanding balances"
          emptyMessage="Nobody owes anything right now"
        />
      </ChartCard>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Outstanding Credit
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--danger)', marginTop: '0.375rem' }} className="num">
            {formatPKR(totalOutstanding)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across {activeBorrowersCount} customer{activeBorrowersCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Registered Customers
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.375rem' }} className="num">
            {state.customers.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            In digital credit register
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Zero-Balance Customers
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.375rem' }} className="num">
            {state.customers.filter(c => c.balancePaise === 0).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            All dues settled
          </div>
        </div>
      </div>

      {/* Main Grid: Customer List + Detail Ledger View */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1fr 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Customer Directory */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem' }}>Customer Directory</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {filteredCustomers.length} records
            </span>
          </div>

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
            />
            <MagnifyingGlass
              size={18}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <User size={40} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 500 }}>No customers found</p>
              <p style={{ fontSize: '0.8125rem' }}>Click &quot;Add New Customer&quot; above to create a credit account.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '600px', overflowY: 'auto' }}>
              {filteredCustomers.map(customer => {
                const isSelected = selectedCustomer?.id === customer.id;
                const hasDues = customer.balancePaise > 0;
                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      borderRadius: 'var(--radius)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                      background: isSelected ? 'var(--surface-blue)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: hasDues ? 'var(--warning-bg)' : 'var(--success-bg)',
                          color: hasDues ? 'var(--warning)' : 'var(--success)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                        }}
                      >
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{customer.name}</div>
                        {customer.phone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Phone size={12} /> {customer.phone}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="num"
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: hasDues ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {formatPKR(customer.balancePaise)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {hasDues ? 'Due Balance' : 'Settled'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Customer Statement & Ledger Details */}
        {selectedCustomer && (
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem' }}>{selectedCustomer.name}</h2>
                  <span className={`badge ${selectedCustomer.balancePaise > 0 ? 'badge-warning' : 'badge-success'}`}>
                    {selectedCustomer.balancePaise > 0 ? 'Pending Dues' : 'Clear'}
                  </span>
                </div>
                {selectedCustomer.phone && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Phone: {selectedCustomer.phone}
                  </p>
                )}
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close statement"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Due Highlight */}
            <div
              style={{
                background: selectedCustomer.balancePaise > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  CURRENT OUTSTANDING BALANCE
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: selectedCustomer.balancePaise > 0 ? 'var(--danger)' : 'var(--success)' }} className="num">
                  {formatPKR(selectedCustomer.balancePaise)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowRepaymentModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <ArrowDownLeft size={16} weight="bold" />
                  <span>Record Payment (Jama)</span>
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowCreditModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <ArrowUpRight size={16} weight="bold" />
                  <span>Give Credit (Udhaar)</span>
                </button>
              </div>
            </div>

            {/* Statement Ledger Entries */}
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClockCounterClockwise size={18} />
                Transaction Statement
              </h3>

              {(!selectedCustomer.ledger || selectedCustomer.ledger.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--line)', borderRadius: 'var(--radius)' }}>
                  No statement history recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedCustomer.ledger.map(entry => {
                    const isCredit = entry.type === 'credit_sale';
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isCredit ? 'var(--danger-bg)' : 'var(--success-bg)',
                              color: isCredit ? 'var(--danger)' : 'var(--success)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isCredit ? <ArrowUpRight size={16} weight="bold" /> : <ArrowDownLeft size={16} weight="bold" />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {isCredit ? 'Credit Given (Udhaar)' : 'Payment Received (Jama)'}
                              {entry.paymentMethod && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                  via {entry.paymentMethod}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {entry.date} {entry.note && `• ${entry.note}`}
                            </div>
                          </div>
                        </div>

                        <div className="num" style={{ fontWeight: 700, color: isCredit ? 'var(--danger)' : 'var(--success)' }}>
                          {isCredit ? `+${formatPKR(entry.amountPaise)}` : `-${formatPKR(entry.amountPaise)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Customer */}
      {showAddCustomer && (
        <div className="modal-overlay" onClick={() => setShowAddCustomer(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Add New Customer</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddCustomer(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Muhammad Ali (محمد علی)"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 0300-1234567"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Opening Due Balance (Rs., Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={e => setInitialBalance(e.target.value)}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Repayment (Jama) */}
      {showRepaymentModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowRepaymentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Record Payment (Jama)</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>From {selectedCustomer.name}</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowRepaymentModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleRecordRepayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Amount Received (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  autoFocus
                  placeholder="0.00"
                  value={repaymentAmount}
                  onChange={e => setRepaymentAmount(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${repaymentMethod === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRepaymentMethod('cash')}
                    style={{ justifyContent: 'center' }}
                  >
                    💵 Cash (نقد کیش)
                  </button>
                  <button
                    type="button"
                    className={`btn ${repaymentMethod === 'wallet' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRepaymentMethod('wallet')}
                    style={{ justifyContent: 'center' }}
                  >
                    📱 JazzCash / EasyPaisa / Bank
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                  {repaymentMethod === 'cash' ? 'Note: Cash repayments will reconcile in today’s Roznamcha.' : 'Note: Digital wallet repayments are excluded from physical cash drawer.'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Note / Receipt Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received via JazzCash or Counter Cash"
                  value={repaymentNote}
                  onChange={e => setRepaymentNote(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowRepaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Give Credit (Udhaar) */}
      {showCreditModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowCreditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Give Credit (Udhaar)</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>To {selectedCustomer.name}</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCreditModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCredit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Credit Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  autoFocus
                  placeholder="0.00"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Note / Bill Details (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 5kg Sunridge Atta, Dalda Oil, Sugar"
                  value={creditNote}
                  onChange={e => setCreditNote(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }}>Confirm Credit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
