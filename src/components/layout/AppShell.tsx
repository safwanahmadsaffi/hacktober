'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Lightning, ChartPieSlice, Package, Receipt,
  HandCoins, Money, Vault, ChartBar, Globe, Robot
} from '@phosphor-icons/react';
import AssistantBar from './AssistantBar';
import LanguageModal from '@/components/common/LanguageModal';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { getTranslation } from '@/lib/translations';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLang, setShowLang] = useState(false);
  const { state } = useApp();
  const t = getTranslation(state.selectedLanguage.code);
  const isUrdu = state.selectedLanguage.code === 'ur';

  const NAV_ITEMS = [
    { href: '/',              label: t.quickSale,    Icon: Lightning },
    { href: '/munshi',        label: isUrdu ? 'منشی اے آئی' : 'Munshi AI', Icon: Robot },
    { href: '/dashboard',     label: t.dashboard,    Icon: ChartPieSlice },
    { href: '/products',      label: t.products,     Icon: Package },
    { href: '/transactions',  label: t.transactions, Icon: Receipt },
    { href: '/udhaar',        label: t.udhaarKhata,  Icon: HandCoins },
    { href: '/expenses',      label: t.expenses,     Icon: Money },
    { href: '/cash-closing',  label: t.cashClosing,  Icon: Vault },
    { href: '/reports',       label: t.reports,      Icon: ChartBar },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar app-shell__nav" aria-label="Main navigation">
        <Link href="/" className="sidebar__logo" aria-label="DukaanVoice PK home">
          <span className="sidebar__logo-icon" aria-hidden="true">🇵🇰</span>
          <span>
            <span className="sidebar__logo-name">DukaanVoice PK</span>
            <span className="sidebar__logo-tagline">{isUrdu ? 'ڈیجیٹل دکان کھاتہ و روزنامچہ' : 'Pakistan Digital Shop Register'}</span>
          </span>
        </Link>

        <div className="sidebar__nav">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <button
                key={href}
                className={`sidebar__nav-link${isActive ? ' active' : ''}`}
                onClick={() => router.push(href)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  <Icon weight={isActive ? 'fill' : 'regular'} size={20} />
                </span>
                <span style={{ fontSize: isUrdu ? '0.95rem' : '0.9rem' }}>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar__footer">
          <button
            className="sidebar__nav-link"
            onClick={() => setShowLang(true)}
            aria-label="Change language"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span className="nav-icon" aria-hidden="true">🌐</span>
              <span>{t.language}</span>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
              {state.selectedLanguage.nativeName}
            </span>
          </button>
        </div>
      </nav>

      {/* Assistant Bar */}
      <header className="app-shell__header">
        <AssistantBar onLangClick={() => setShowLang(true)} />
      </header>

      {/* Main Content */}
      <main className="app-shell__main" id="main-content">
        {children}
      </main>

      {/* Language Modal */}
      {showLang && <LanguageModal onClose={() => setShowLang(false)} />}
    </div>
  );
}
