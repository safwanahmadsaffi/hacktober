'use client';

import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { useApp } from '@/lib/store';
import { getTranslation } from '@/lib/translations';

/**
 * A one-glance map of how the shop's screens connect into a single daily loop.
 * Labels reuse the app's own navigation translations, so it is readable in
 * Urdu, English and the other supported languages.
 */
export default function ShopWorkflow() {
  const { state } = useApp();
  const t = getTranslation(state.selectedLanguage.code);

  const steps = [
    { href: '/',             label: t.quickSale,    hint: 'Sell at the counter' },
    { href: '/products',     label: t.products,     hint: 'Stock is reduced automatically' },
    { href: '/transactions', label: t.transactions, hint: 'Every bill becomes a receipt' },
    { href: '/udhaar',       label: t.udhaarKhata,  hint: 'Credit sales become customer balances' },
    { href: '/expenses',     label: t.expenses,     hint: 'Shop costs leave the till' },
    { href: '/cash-closing', label: t.cashClosing,  hint: 'Count the drawer and close the day' },
    { href: '/reports',      label: t.reports,      hint: 'See profit and what to reorder' },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">How your shop connects · دکان کا روزانہ چکر</h2>
        <Link href="/munshi" className="btn btn-outline btn-sm">Ask Munshi AI</Link>
      </div>

      <div className="workflow">
        {steps.map((step, i) => (
          <span key={step.href} style={{ display: 'contents' }}>
            <Link href={step.href} className="workflow__step" title={step.hint}>
              <span className="workflow__num" aria-hidden="true">{i + 1}</span>
              <span>{step.label}</span>
            </Link>
            {i < steps.length - 1 ? (
              <span className="workflow__arrow" aria-hidden="true">
                <ArrowRight size={14} />
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <p className="form-hint mt-3">
        Every screen feeds the next: a sale changes stock and the ledger, credit sales change the
        udhaar khata, costs leave the till, and the roznamcha ties them together — so the reports
        and the Munshi AI always reason over the same numbers.
      </p>
    </div>
  );
}
