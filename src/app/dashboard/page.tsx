'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ChartPieSlice, Package, Receipt, HandCoins, Money, Vault, ChartBar, Lightning, Robot, ArrowRight,
} from '@phosphor-icons/react';
import { useApp, SUPPORTED_LANGUAGES } from '@/lib/store';
import { formatPKR, isRealSale } from '@/lib/financial';
import { revenueSeries, dailySeries, paymentMix, useBusinessToday } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import TrendChart from '@/components/charts/TrendChart';
import GroupedBars from '@/components/charts/GroupedBars';
import DonutChart from '@/components/charts/DonutChart';
import PageHeader from '@/components/common/PageHeader';
import ShopWorkflow from '@/components/common/ShopWorkflow';

export default function DashboardPage() {
  const { state } = useApp();
  const today = useBusinessToday();

  const confirmedSales = state.transactions.filter(t => t.status === 'confirmed' && isRealSale(t));
  const totalRevenue = confirmedSales.reduce((sum, t) => sum + t.totalPaise, 0);
  const confirmedPurchases = state.transactions.filter(t => t.type === 'purchase' && t.status === 'confirmed');
  const totalPurchases = confirmedPurchases.reduce((sum, t) => sum + t.totalPaise, 0);
  const lowStockProducts = state.products.filter(p => p.isActive && p.stock <= p.lowStockThreshold);
  const totalOutstanding = state.customers.reduce((sum, c) => sum + c.balancePaise, 0);
  const totalExpenses = state.expenses.filter(e => !e.reversed).reduce((sum, e) => sum + e.amountPaise, 0);
  const activeProducts = state.products.filter(p => p.isActive).length;

  // Chart data (trend includes zero-length days so dips and quiet days show)
  const revenue7 = useMemo(() => revenueSeries(state.transactions, 7, today), [state.transactions, today]);
  const salesVsPurchases7 = useMemo(
    () => dailySeries(state.transactions, 7, today).map(p => ({ label: p.label, a: p.sales, b: p.purchases })),
    [state.transactions, today],
  );
  const payMix = useMemo(() => paymentMix(state.transactions), [state.transactions]);

  const cards = [
    { label: 'Total Revenue', value: formatPKR(totalRevenue), sub: `${confirmedSales.length} confirmed sale(s)`, color: 'var(--success)', href: '/transactions', hint: 'See every confirmed sale' },
    { label: 'Total Purchases', value: formatPKR(totalPurchases), sub: `${confirmedPurchases.length} confirmed purchase(s)`, color: 'var(--accent-deep)', href: '/transactions', hint: 'See the purchase ledger' },
    { label: 'Udhaar Outstanding', value: formatPKR(totalOutstanding), sub: `${state.customers.length} customer(s)`, color: 'var(--warning)', href: '/udhaar', hint: 'Open the udhaar khata' },
    { label: 'Low Stock Items', value: String(lowStockProducts.length), sub: 'Products below threshold', color: lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--success)', href: '/products', hint: 'Restock before you run out' },
  ];

  const hub = [
    { href: '/',             Icon: Lightning,  label: 'Quick Sale',      desc: 'Ring up a sale at the counter',        stat: state.cart.items.length ? `${state.cart.items.length} item(s) in the open bill` : 'Open bill is empty' },
    { href: '/munshi',       Icon: Robot,      label: 'Munshi AI',       desc: 'Ask in Urdu or English',               stat: 'Stock · sales · udhaar · mandi rates' },
    { href: '/products',     Icon: Package,    label: 'Products',        desc: 'Items, prices and stock levels',       stat: `${activeProducts} active · ${lowStockProducts.length} low` },
    { href: '/transactions', Icon: Receipt,    label: 'Transactions',    desc: 'Every sale and purchase receipt',      stat: `${state.transactions.length} receipt(s)` },
    { href: '/udhaar',       Icon: HandCoins,  label: 'Udhaar Khata',    desc: 'Customer credit and repayments',       stat: `${formatPKR(totalOutstanding)} outstanding` },
    { href: '/expenses',     Icon: Money,      label: 'Expenses',        desc: 'Rent, electricity, wages, misc',       stat: `${formatPKR(totalExpenses)} recorded` },
    { href: '/cash-closing', Icon: Vault,      label: 'Cash Closing',    desc: 'Daily roznamcha and drawer count',     stat: `${state.cashClosings.length} day(s) closed` },
    { href: '/reports',      Icon: ChartBar,   label: 'Reports',         desc: 'Profit, margins and stock value',      stat: 'Date range · payment mix · valuation' },
  ];

  return (
    <div>
      <PageHeader
        icon={<ChartPieSlice weight="fill" />}
        title="Dashboard"
        subtitle="One shop, one ledger: here is the whole business at a glance."
        related={[
          { href: '/transactions', label: 'Transactions', hint: 'Where the revenue numbers come from' },
          { href: '/udhaar', label: 'Udhaar Khata', hint: 'Where the outstanding credit comes from' },
          { href: '/reports', label: 'Reports', hint: 'Profit and stock valuation' },
        ]}
      />

      {/* KPIs — each links to the page that owns the number */}
      <div className="stats-grid">
        {cards.map(card => (
          <Link key={card.label} href={card.href} className="stat-card stat-card--link" title={card.hint}>
            <div className="stat-card__label">{card.label}</div>
            <div className="stat-card__value" style={{ color: card.color }}>{card.value}</div>
            <div className="stat-card__sub">{card.sub}</div>
          </Link>
        ))}
      </div>

      {/* Charts — the same ledger numbers, as pictures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <ChartCard title="Revenue — last 7 days" hint="Confirmed counter sales per business day">
          <TrendChart series={revenue7} formatValue={formatPKR} ariaLabel="Daily revenue trend for the last seven days" emptyMessage="Confirm a sale to start the trend" />
        </ChartCard>
        <ChartCard title="Sales vs Purchases — last 7 days" hint="Money coming in vs money spent on stock">
          <GroupedBars series={salesVsPurchases7} legend={['Sales', 'Purchases']} colorA="var(--success)" colorB="var(--accent-deep)" formatValue={formatPKR} emptyMessage="No receipts in the last 7 days" />
        </ChartCard>
        <ChartCard title="How customers pay" hint="Revenue share by payment method">
          <DonutChart data={payMix} formatValue={formatPKR} emptyMessage="Confirm a sale to see the payment mix" />
        </ChartCard>
      </div>

      {/* How the screens connect into one daily loop */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ShopWorkflow />
      </div>

      {/* Service Status */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Service Status</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem', padding: '.75rem', background: 'var(--success-bg)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: '1.25rem' }}>💾</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--success)' }}>Local Storage</div>
              <div className="text-muted text-small">IndexedDB · Active</div>
            </div>
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>OK</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem', padding: '.75rem', background: 'var(--info-bg)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: '1.25rem' }}>🌐</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--info)' }}>Language Support</div>
              <div className="text-muted text-small">{SUPPORTED_LANGUAGES.length} languages · Urdu, Punjabi, Sindhi, Pashto & English</div>
            </div>
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem', padding: '.75rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: '1.25rem' }}>📡</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--text)' }}>Data Sync</div>
              <div className="text-muted text-small">Offline-first mode</div>
            </div>
            <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>Local</span>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--warning-bg)' }}>
          <div className="card-header">
            <h2 className="card-title" style={{ color: 'var(--warning)' }}>⚠ Low Stock Alert</h2>
            <div className="page-header__actions">
              <Link href="/munshi" className="btn btn-outline btn-sm">Ask Munshi what to reorder</Link>
              <Link href="/products" className="btn btn-secondary btn-sm">View All</Link>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            {lowStockProducts.slice(0, 6).map(p => (
              <span key={p.id} className="badge badge-warning">
                {p.name} ({p.stock} {p.unit})
              </span>
            ))}
            {lowStockProducts.length > 6 && <span className="text-muted text-small" style={{ alignSelf: 'center' }}>+{lowStockProducts.length - 6} more</span>}
          </div>
        </div>
      )}

      {/* Quick Access — every screen in the shop */}
      <h2 className="card-title" style={{ marginBottom: '1rem' }}>Quick Access</h2>
      <div className="hub-grid">
        {hub.map(({ href, Icon, label, desc, stat }) => (
          <Link key={href} href={href} className="hub-card">
            <span className="hub-card__top">
              <span className="hub-card__icon"><Icon size={20} weight="fill" /></span>
              <span>{label}</span>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />
            </span>
            <span className="hub-card__desc">{desc}</span>
            <span className="hub-card__stat">{stat}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
