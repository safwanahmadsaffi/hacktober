'use client';

import { useState, useMemo } from 'react';
import { Package, Plus, MagnifyingGlass, PencilSimple, Trash, X, Check } from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { formatPKR, generateId, todayISO } from '@/lib/financial';
import { lowestStock, stockValueByCategory } from '@/lib/charts';
import ChartCard from '@/components/charts/ChartCard';
import RankBars from '@/components/charts/RankBars';
import DonutChart from '@/components/charts/DonutChart';
import type { Product, Unit, ExpenseCategory } from '@/types';
import db from '@/lib/db';
import PageHeader from '@/components/common/PageHeader';

const UNITS: Unit[] = ['piece', 'kg', 'g', 'litre', 'ml', 'dozen', 'pack', 'box'];
const CATEGORIES = ['Groceries', 'Dairy', 'Beverages', 'Snacks', 'Personal Care', 'Household', 'Electronics', 'Clothing', 'Other'];

function emptyProduct(): Partial<Product> {
  return { name: '', category: 'Groceries', unit: 'piece', stock: 0, purchasePricePaise: 0, sellingPricePaise: 0, lowStockThreshold: 5, isActive: true };
}

function ProductModal({ product, onSave, onClose }: { product: Partial<Product>; onSave: (p: Product) => void; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Product>>(product);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: keyof Product, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key as string]; return n; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Product name is required.';
    if ((form.sellingPricePaise ?? 0) <= 0) e.sellingPricePaise = 'Selling price must be greater than zero.';
    if ((form.stock ?? 0) < 0) e.stock = 'Stock cannot be negative.';
    if ((form.purchasePricePaise ?? 0) < 0) e.purchasePricePaise = 'Purchase price cannot be negative.';
    return e;
  }

  function submit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const now = new Date().toISOString();
    const p: Product = {
      id: form.id ?? generateId(),
      name: form.name!.trim(),
      sku: form.sku?.trim() || undefined,
      barcode: form.barcode?.trim() || undefined,
      category: form.category ?? 'Groceries',
      unit: form.unit ?? 'piece',
      stock: Number(form.stock ?? 0),
      purchasePricePaise: Number(form.purchasePricePaise ?? 0),
      sellingPricePaise: Number(form.sellingPricePaise ?? 0),
      lowStockThreshold: Number(form.lowStockThreshold ?? 5),
      isActive: form.isActive !== false,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };
    onSave(p);
  }

  const toRupees = (p: number) => p > 0 ? (p / 100).toFixed(2) : '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={form.id ? 'Edit product' : 'Add product'} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal__header">
          <span className="modal__title">{form.id ? 'Edit Product' : 'Add Product'}</span>
          <button className="modal__close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="p-name">Product Name *</label>
                <input id="p-name" className="form-control" value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Guard Basmati Rice 1kg" />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-category">Category</label>
                <select id="p-category" className="form-control" value={form.category ?? 'Groceries'} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="p-sku">SKU / Barcode</label>
                <input id="p-sku" className="form-control" value={form.sku ?? ''} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-unit">Unit</label>
                <select id="p-unit" className="form-control" value={form.unit ?? 'piece'} onChange={e => set('unit', e.target.value as Unit)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="p-purchase">Purchase Price (Rs.)</label>
                <input id="p-purchase" className="form-control" type="number" min="0" step="0.01" value={toRupees(form.purchasePricePaise ?? 0)} onChange={e => set('purchasePricePaise', Math.round(parseFloat(e.target.value || '0') * 100))} placeholder="0.00" />
                {errors.purchasePricePaise && <span className="form-error">{errors.purchasePricePaise}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-selling">Selling Price (Rs.) *</label>
                <input id="p-selling" className="form-control" type="number" min="0" step="0.01" value={toRupees(form.sellingPricePaise ?? 0)} onChange={e => set('sellingPricePaise', Math.round(parseFloat(e.target.value || '0') * 100))} placeholder="0.00" />
                {errors.sellingPricePaise && <span className="form-error">{errors.sellingPricePaise}</span>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="p-stock">Stock Quantity</label>
                <input id="p-stock" className="form-control" type="number" min="0" value={form.stock ?? 0} onChange={e => set('stock', parseInt(e.target.value) || 0)} />
                {errors.stock && <span className="form-error">{errors.stock}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="p-threshold">Low Stock Threshold</label>
                <input id="p-threshold" className="form-control" type="number" min="0" value={form.lowStockThreshold ?? 5} onChange={e => set('lowStockThreshold', parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.625rem', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={form.isActive !== false} onChange={e => set('isActive', e.target.checked)} />
              <span className="form-label" style={{ cursor: 'pointer', marginBottom: 0 }}>Active (visible in Quick Sale)</span>
            </label>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}><Check size={16} /> Save Product</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Partial<Product>>(emptyProduct());

  // Chart data — derived from the same catalog the table uses
  const memoLowStock = useMemo(() => lowestStock(state.products), [state.products]);
  const memoStockValue = useMemo(() => stockValueByCategory(state.products), [state.products]);

  const products = state.products.filter(p => {
    if (lowStockOnly && p.stock > p.lowStockThreshold) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  const categories = [...new Set(state.products.map(p => p.category))].sort();

  async function handleSave(p: Product) {
    await db.saveProduct(p);
    if (state.products.find(x => x.id === p.id)) {
      dispatch({ type: 'UPDATE_PRODUCT', payload: p });
    } else {
      dispatch({ type: 'ADD_PRODUCT', payload: p });
    }
    setShowModal(false);
  }

  return (
    <div>
      <PageHeader
        icon={<Package weight="fill" />}
        title="Products"
        subtitle="Manage the catalog, stock levels, prices and units. Stock changes here whenever a sale is confirmed."
        related={[
          { href: '/', label: 'Quick Sale', hint: 'Sell these items at the counter' },
          { href: '/transactions', label: 'Transactions', hint: 'See which items sold' },
          { href: '/reports', label: 'Reports', hint: 'Stock value and low-stock count' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => { setEditProduct(emptyProduct()); setShowModal(true); }}>
            <Plus size={16} /> Add Product
          </button>
        }
      />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Total Products', value: String(state.products.length) },
          { label: 'Active', value: String(state.products.filter(p => p.isActive).length) },
          { label: 'Low Stock', value: String(state.products.filter(p => p.isActive && p.stock <= p.lowStockThreshold).length), warn: true },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value" style={s.warn ? { color: 'var(--warning)' } : {}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts — the catalog as pictures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <ChartCard title="Stock levels — lowest first" hint="Red bars are at or below the low-stock threshold">
          <RankBars data={memoLowStock} formatValue={v => `${v} in stock`} ariaLabel="Products with the least remaining stock" emptyMessage="No products yet" />
        </ChartCard>
        <ChartCard title="Stock value by category" hint="Money tied up in inventory, at purchase cost">
          <DonutChart data={memoStockValue} formatValue={formatPKR} centerLabel="Stock" ariaLabel="Inventory cost by category" emptyMessage="Add products to see stock value" />
        </ChartCard>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon"><MagnifyingGlass size={16} /></span>
          <input className="form-control search-input" placeholder="Search by name, SKU, category…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search products" />
        </div>
        <select className="form-control" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filter by category">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '.875rem', fontWeight: 500 }}>
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} /> Low Stock Only
        </label>
        {(query || categoryFilter || lowStockOnly) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(''); setCategoryFilter(''); setLowStockOnly(false); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Product Table */}
      {state.isLoading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="state-container">
          <div className="state-icon"><Package size={40} /></div>
          <div className="state-title">{state.products.length === 0 ? 'No products yet' : 'No matching products'}</div>
          <div className="state-message">{state.products.length === 0 ? 'Add your first product to get started.' : 'Try adjusting your search or filters.'}</div>
          {state.products.length === 0 && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setEditProduct(emptyProduct()); setShowModal(true); }}><Plus size={16} /> Add First Product</button>}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" aria-label="Products list">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Purchase Price</th>
                <th style={{ textAlign: 'right' }}>Selling Price</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.sku && <div className="text-muted text-small">SKU: {p.sku}</div>}
                  </td>
                  <td>{p.category}</td>
                  <td>{p.unit}</td>
                  <td className="text-right qty">
                    <span style={{ color: p.stock <= p.lowStockThreshold ? 'var(--danger)' : 'var(--text)', fontWeight: p.stock <= p.lowStockThreshold ? 600 : 400 }}>
                      {p.stock}
                    </span>
                    {p.stock <= p.lowStockThreshold && <span className="badge badge-warning" style={{ marginLeft: '.5rem' }}>Low</span>}
                  </td>
                  <td className="text-right amount">{formatPKR(p.purchasePricePaise)}</td>
                  <td className="text-right amount" style={{ fontWeight: 600 }}>{formatPKR(p.sellingPricePaise)}</td>
                  <td>
                    <span className={`badge ${p.isActive ? 'badge-success' : 'badge-neutral'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditProduct(p); setShowModal(true); }} aria-label={`Edit ${p.name}`}>
                      <PencilSimple size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={editProduct}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
