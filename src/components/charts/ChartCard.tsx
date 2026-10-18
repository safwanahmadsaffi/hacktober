'use client';

import React from 'react';

/**
 * Uniform container for every chart across the app's pages: a standard card
 * with a title, optional explanation line, and consistently padded body.
 */
export default function ChartCard({
  title,
  hint,
  icon,
  children,
  style,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="card" style={{ padding: '1.25rem', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
      </div>
      {hint && (
        <p style={{ margin: '-.5rem 0 .75rem', fontSize: '.8125rem', color: 'var(--text-muted)' }}>{hint}</p>
      )}
      {children}
    </div>
  );
}
