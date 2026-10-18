'use client';

import React from 'react';

export interface GroupedPoint { label: string; a: number; b: number }

const W = 480;
const H = 190;
const PAD_L = 10;
const PAD_R = 10;
const PAD_TOP = 10;
const PAD_BOT = 30;
const GRID_LINES = 3;

/**
 * Dependency-free grouped vertical bar chart (e.g. sales vs purchases per
 * day, expected vs physical drawer cash per closing). Pairs equal-width,
 * side-by-side bars scaled to the largest value in the series.
 */
export default function GroupedBars({
  series,
  legend,
  colorA = 'var(--success)',
  colorB = 'var(--warning)',
  formatValue,
  ariaLabel = 'Grouped bar chart',
  emptyMessage = 'No data yet',
}: {
  series: GroupedPoint[];
  legend: [string, string];
  colorA?: string;
  colorB?: string;
  formatValue: (value: number) => string;
  ariaLabel?: string;
  emptyMessage?: string;
}) {
  const max = Math.max(...series.flatMap(p => [p.a, p.b]), 0);
  const usableH = H - PAD_TOP - PAD_BOT;
  const usableW = W - PAD_L - PAD_R;
  const slotW = series.length > 0 ? usableW / series.length : usableW;
  const barW = Math.min(16, Math.max(6, slotW * 0.28));
  const h = (v: number) => (max > 0 ? (v / max) * usableH : 0);

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '.25rem', fontSize: '.8125rem' }}>
        {[legend[0], legend[1]].map((name, i) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '.375rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? colorA : colorB }} aria-hidden="true" />
            {name}
          </span>
        ))}
      </div>

      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* Gridlines + abbreviated axis labels for scale reference */}
        {max > 0 && Array.from({ length: GRID_LINES }, (_, gi) => {
          const v = (max * (gi + 1)) / GRID_LINES;
          const y = PAD_TOP + usableH * (1 - (gi + 1) / GRID_LINES);
          return (
            <g key={gi}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />
              <text x={W - PAD_R} y={y - 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{formatValue(v)}</text>
            </g>
          );
        })}
        <line x1={PAD_L} y1={PAD_TOP + usableH} x2={W - PAD_R} y2={PAD_TOP + usableH} stroke="var(--line)" strokeWidth="1" />

        {max === 0 || series.length === 0 ? (
          <text x={W / 2} y={(PAD_TOP + usableH / 2)} textAnchor="middle" fontSize="13" fill="var(--text-muted)">{emptyMessage}</text>
        ) : series.map((p, i) => {
          const cx = PAD_L + slotW * i + slotW / 2;
          return (
            <g key={p.label}>
              <rect
                x={cx - barW - 1}
                y={PAD_TOP + usableH - h(p.a)}
                width={barW}
                height={h(p.a)}
                fill={colorA}
                rx="2"
              >
                <title>{`${legend[0]} · ${p.label}: ${formatValue(p.a)}`}</title>
              </rect>
              <rect
                x={cx + 1}
                y={PAD_TOP + usableH - h(p.b)}
                width={barW}
                height={h(p.b)}
                fill={colorB}
                rx="2"
              >
                <title>{`${legend[1]} · ${p.label}: ${formatValue(p.b)}`}</title>
              </rect>
              {/* Day/period label under each pair */}
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
