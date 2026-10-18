'use client';

import React from 'react';
import type { ChartDatum } from '@/lib/charts';
import { CHART_PALETTE } from '@/lib/charts';

const SIZE = 160;
const RADIUS = 64;
const STROKE = 24;

/**
 * Dependency-free donut chart. `data` values may be any positive numbers
 * (paise, counts, quantities); they are drawn as proportional arcs with a
 * value legend beside the ring. Empty/zero data renders a friendly placeholder.
 */
export default function DonutChart({
  data,
  formatValue,
  centerLabel = 'Total',
  emptyMessage = 'No data yet',
  ariaLabel = 'Composition chart',
}: {
  data: ChartDatum[];
  formatValue: (value: number) => string;
  centerLabel?: string;
  emptyMessage?: string;
  ariaLabel?: string;
}) {
  const filled = data.map((d, i) => ({ ...d, color: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }));
  const total = filled.reduce((s, d) => s + Math.max(0, d.value), 0);
  const circumference = 2 * Math.PI * RADIUS;

  const fractions = filled.map(d => (total > 0 ? Math.max(0, d.value) / total : 0));
  // Prefix sums give every arc its start position, so nothing is mutated during render.
  const starts = fractions.map((_, i) => fractions.slice(0, i).reduce((s, f) => s + f, 0));
  const segments = filled.map((d, i) => ({
    ...d,
    frac: fractions[i],
    // Start from the top of the ring (−90°) and advance clockwise.
    dash: `${fractions[i] * circumference} ${circumference}`,
    dashOffset: -starts[i] * circumference,
  }));

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: SIZE, flexShrink: 0 }}
      >
        {total === 0 ? (
          <>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE} strokeDasharray="4 8" />
            <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" fontSize="11" fill="var(--text-muted)">Wait for</text>
            <text x={SIZE / 2} y={SIZE / 2 + 10} textAnchor="middle" fontSize="11" fill="var(--text-muted)">entries…</text>
          </>
        ) : (
          segments.map(s => (
            <circle
              key={s.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={s.dash}
              strokeDashoffset={s.dashOffset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            >
              <title>{`${s.label}: ${formatValue(s.value)} (${Math.round(s.frac * 100)}%)`}</title>
            </circle>
          ))
        )}
        {total > 0 && (
          <>
            <text x={SIZE / 2} y={SIZE / 2 - 3} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{centerLabel}</text>
            <text x={SIZE / 2} y={SIZE / 2 + 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)" className="num">
              {formatValue(total)}
            </text>
          </>
        )}
      </svg>

      {/* Legend with values and shares — makes the chart readable without hover */}
      {total > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.375rem', minWidth: 0, flex: 1 }}>
          {segments.map(s => (
            <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.8125rem', minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span className="num" style={{ marginLeft: 'auto', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatValue(s.value)}
              </span>
              <span style={{ color: 'var(--text-muted)', width: '2.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {Math.round(s.frac * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      {total === 0 && <p style={{ margin: 0, fontSize: '.8125rem', color: 'var(--text-muted)' }}>{emptyMessage}</p>}
    </div>
  );
}
