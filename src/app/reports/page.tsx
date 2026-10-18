'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChartBar, Package, Receipt } from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { formatPKR, isRealSale, isUdhaarRepayment, todayISO } from '@/lib/financial';
import { revenueSeries, paymentMix, moneySplit, dailySeries } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import TrendChart from '@/components/charts/TrendChart';
import GroupedBars from '@/components/charts/GroupedBars';
import DonutChart from '@/components/charts/DonutChart';
import RankBars from '@/components/charts/RankBars';
import PageHeader from '@/components/common/PageHeader';

const RANGES = ['today', '7days', '30days', 'all'] as const;
type Range = typeof RANGES[number];
const RANGE_LABELS: Record<Range, string> = {
  today: 'Today', '7days': 'Last 7 Days', '30days': 'Last 30 Days', all: 'All Time',
};

export default function ReportsPage() {
  const { state } = useApp();
  const [dateRange, setDateRange] = useState<Range>('all');
  const [todayStr, setTodayStr] = useState<string>('');

  useEffect(() => {
    // The local date must be resolved on the client: computing it during the render
    // of a prerendered page is rejected by Next's Cache Components, and an effect
    // keeps server/client HTML identical (the default 'all' view ignores the date).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayStr(todayISO());
  }, []);

  // Filter transactions and expenses based on dateRange
  const { filteredTxns, filteredExpenses } = useMemo(() => {
    let cutoff = '';
    if (!todayStr) {
      return {
        filteredTxns: state.transactions.filter(t => t.status === 'confirmed'),
        filteredExpenses: state.expenses.filter(e => !e.reversed),
      };
    }

    if (dateRange === 'today') {
      cutoff = todayStr;
      return {
        filteredTxns: state.transactions.filter(t => t.businessDate === todayStr && t.status === 'confirmed'),
        filteredExpenses: state.expenses.filter(e => e.date === todayStr && !e.reversed),
      };
    } else if (dateRange === '7days') {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - 7);
      cutoff = d.toISOString().split('T')[0];
    } else if (dateRange === '30days') {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - 30);
      cutoff = d.toISOString().split('T')[0];
    }

    return {
      filteredTxns: state.transactions.filter(t => t.status === 'confirmed' && (!cutoff || t.businessDate >= cutoff)),
      filteredExpenses: state.expenses.filter(e => !e.reversed && (!cutoff || e.date >= cutoff)),
    };
  }, [state.transactions, state.expenses, dateRange, todayStr]);

  // Compute metrics (all respect the selected range)
  const salesTxns = filteredTxns.filter(isRealSale);
  const grossSales = salesTxns.reduce((sum, t) => sum + t.totalPaise, 0);
  // Udhaar repayments are receipts against a past sale, not new revenue.
  const udhaarRecovered = filteredTxns.filter(isUdhaarRepayment).reduce((sum, t) => sum + t.totalPaise, 0);
  const purchaseTxns = filteredTxns.filter(t => t.type === 'purchase');
  const totalPurchases = purchaseTxns.reduce((sum, t) => sum + t.totalPaise, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountPaise, 0);

  // Estimate COGS based on sold items and product purchase prices
  const estimatedCOGS = salesTxns.reduce((sum, txn) => {
    return sum + txn.items.reduce((acc, item) => {
      const prod = state.products.find(p => p.id === item.productId);
      const unitCost = prod ? prod.purchasePricePaise : Math.round(item.unitPricePaise * 0.75); // fallback 75% cost
      return acc + (unitCost * item.quantity);
    }, 0);
  }, 0);

  const grossProfit = Math.max(0, grossSales - estimatedCOGS);
  const netEarnings = grossProfit - totalExpenses;

  // Chart data. Trends always show the same "last 7 days" window so the range
  // selector and the chart titles never disagree; the donut and money split
  // follow the selected range.
  const revenueTrend = useMemo(
    () => revenueSeries(state.transactions, 7, todayStr),
    [state.transactions, todayStr],
  );
  const splitByDay = useMemo(
    () => dailySeries(state.transactions, 7, todayStr).map(p => ({ label: p.label, a: p.sales, b: p.purchases })),
    [state.transactions, todayStr],
  );
  const payMix = useMemo(() => paymentMix(filteredTxns), [filteredTxns]);
  const money = moneySplit(grossSales, estimatedCOGS, totalExpenses);

  // Inventory valuation
  const inventoryCostValue = state.products.reduce((sum, p) => sum + (p.purchasePricePaise * p.stock), 0);
  const inventoryRetailValue = state.products.reduce((sum, p) => sum + (p.sellingPricePaise * p.stock), 0);
  const lowStockCount = state.products.filter(p => p.stock <= p.lowStockThreshold).length;

  const kpis = [
    {
      label: 'Gross Sales Revenue', value: grossSales, color: 'var(--accent-deep)', border: 'var(--accent)',
      formula: `${salesTxns.length} confirmed counter sales`,
      extra: udhaarRecovered > 0 ? `+ ${formatPKR(udhaarRecovered)} udhaar recovered (not revenue)` : undefined,
    },
    {
      label: 'Estimated Gross Margin (Profit)', value: grossProfit, color: 'var(--success)', border: 'var(--success)',
      formula: `Sales − COGS = ${formatPKR(grossSales)} − ${formatPKR(estimatedCOGS)}`,
    },
    {
      label: 'Operating Expenses', value: totalExpenses, color: 'var(--danger)', border: 'var(--warning)',
      formula: `${filteredExpenses.length} overhead entries`,
    },
    {
      label: 'Estimated Net Shop Earnings', value: netEarnings, color: netEarnings >= 0 ? 'var(--success)' : 'var(--danger)', border: 'var(--success)',
      formula: 'Gross Profit − Overhead Expenses',
    },
  ];

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <PageHeader
        icon={<ChartBar size={28} color="var(--accent-deep)" />}
        title="Business Reports & Audit Intelligence"
        subtitle="Receipts separated from gross margin, stock valuation, and net cash flow over the selected period."
        related={[
          { href: '/transactions', label: 'Transactions', hint: 'The receipts behind these totals' },
          { href: '/expenses', label: 'Expenses', hint: 'Costs subtracted from net earnings' },
          { href: '/cash-closing', label: 'Cash Closing', hint: 'Daily reconciliation history' },
        ]}
        actions={
          <div role="group" aria-label="Date range" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '3px' }}>
            {RANGES.map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                aria-pressed={dateRange === range}
                style={{
                  border: 'none',
                  background: dateRange === range ? 'var(--accent)' : 'transparent',
                  color: dateRange === range ? 'white' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '0.4rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        }
      />

      {/*
        THE WHOLE REPORT IN ONE CARD — nothing scattered, nothing duplicated.
        Sections sit in order: money at a glance → pictures → stock position,
        and the accounting reminder is a strip inside the same card.
      */}
      <div className="card" style={{ padding: '1.5rem' }}>

        {/* Accounting reminder (inline strip) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', background: 'var(--surface-blue)', border: '1px solid var(--accent-tint)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', marginBottom: '1.25rem', fontSize: '.8125rem' }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <span>
            <strong>Reminder:</strong> receipts are revenue collected, <em>not</em> profit. Gross margin removes COGS; net earnings also remove operating expenses.
          </span>
          <span className="badge badge-info" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{RANGE_LABELS[dateRange]}</span>
        </div>

        {/* Section 1 — money at a glance */}
        <h2 style={{ fontSize: '1rem', margin: '0 0 .75rem' }}>Money at a glance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.875rem 1rem', borderLeft: `4px solid ${k.border}` }}>
              <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.02em' }}>{k.label}</div>
              <div className="num" style={{ fontSize: '1.4rem', fontWeight: 800, color: k.color, margin: '.25rem 0 .125rem' }}>{formatPKR(k.value)}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{k.formula}</div>
              {k.extra && <div style={{ fontSize: '.75rem', color: 'var(--success)', marginTop: '.25rem' }}>{k.extra}</div>}
            </div>
          ))}
        </div>

        {/* Section 2 — the pictures */}
        <h2 style={{ fontSize: '1rem', margin: '0 0 .75rem' }}>Visual pulse</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Revenue — last 7 days</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>Confirmed sales per business day</div>
            <TrendChart series={revenueTrend} formatValue={formatPKR} ariaLabel="Daily revenue trend for the last seven days" emptyMessage="Confirm a sale to start the trend" />
          </div>

          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Sales vs Purchases — last 7 days</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>Money in vs money out for stock</div>
            <GroupedBars series={splitByDay} legend={['Sales', 'Purchases']} colorA="var(--success)" colorB="var(--accent-deep)" formatValue={formatPKR} emptyMessage="No receipts in the last 7 days" />
          </div>

          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Payment mix (selected period)</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>How revenue arrived — cash, wallet or udhaar</div>
            <DonutChart data={payMix} formatValue={formatPKR} ariaLabel="Revenue by payment method" emptyMessage="Confirm a sale to see the payment mix" />
          </div>

          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '1rem' }}>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.25rem' }}>Where the money goes (selected period)</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>Gross sales split into COGS, expenses and net</div>
            <RankBars data={money.map(m => ({ label: m.label, value: m.value, color: m.color }))} formatValue={formatPKR} ariaLabel="Cost of goods, expenses and net earnings" emptyMessage="No sales in this period" />
          </div>
        </div>

        {/* Section 3 — stock position */}
        <h2 style={{ fontSize: '1rem', margin: '0 0 .75rem' }}>Stock position</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '.75rem' }}>
          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.875rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.375rem', fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <Package size={14} /> Inventory at cost
            </div>
            <div className="num" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '.25rem 0' }}>{formatPKR(inventoryCostValue)}</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Estimated retail: {formatPKR(inventoryRetailValue)}</div>
          </div>
          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.875rem 1rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active products</div>
            <div className="num" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '.25rem 0' }}>{state.products.length} SKUs</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Across the whole catalog</div>
          </div>
          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.875rem 1rem' }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low stock</div>
            <div style={{ margin: '.375rem 0' }}>
              <span className={`badge ${lowStockCount > 0 ? 'badge-danger' : 'badge-success'}`}>{lowStockCount} items low</span>
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Restock before the counter runs dry</div>
          </div>
          <div style={{ background: 'var(--surface-soft)', borderRadius: 'var(--radius)', padding: '.875rem 1rem', fontSize: '.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <Receipt size={14} /> Stock values update live on every confirmed sale, purchase intake and inventory adjustment — same ledger, same numbers, no double-counting.
          </div>
        </div>
      </div>
    </div>
  );
}
