'use client';

import React from 'react';
import type { ChartDatum } from '@/lib/charts';
import { CHART_PALETTE } from '@/lib/charts';

/**
 * Horizontal ranked bars (e.g. top udhaar debtors, lowest stock). The longest
 * bar spans the full width; every row is one real <li> so screen readers get
 * a plain list of {label, formatted value} pairs.
 */
export default function RankBars({
  data,
  formatValue,
  emptyMessage = 'No data yet',
  ariaLabel = 'Ranked bar chart',
}: {
  data: ChartDatum[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}) {
  const filled = data.map((d, i) => ({ ...d, color: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }));
  const max = Math.max(...filled.map(d => d.value), 0);

  if (max === 0) {
    return (
      <div role="img" aria-label={ariaLabel} style={{ padding: '1rem 0', fontSize: '.875rem', color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul role="img" aria-label={ariaLabel} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
      {filled.map(d => (
        <li key={d.label} style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.875rem', marginBottom: '.25rem' }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatValue(d.value)}</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-soft)', borderRadius: 4, overflow: 'hidden' }}>
            <div title={`${d.label}: ${formatValue(d.value)}`} style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color, borderRadius: 4 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
