'use client';

import React from 'react';

export interface TrendPoint { label: string; value: number; title?: string }

const W = 480;
const H = 180;
const PAD_L = 8;
const PAD_R = 8;
const PAD_TOP = 12;
const PAD_BOT = 26;

/**
 * Dependency-free area/line trend chart. X positions are evenly spaced by
 * index (values may cover zero-days), Y scales from 0 to the largest value.
 * Each point carries a `<title>` tooltip with the formatted value.
 */
export default function TrendChart({
  series,
  color = 'var(--accent)',
  formatValue,
  ariaLabel = 'Trend chart',
  emptyMessage = 'No data yet',
}: {
  series: TrendPoint[];
  color?: string;
  formatValue: (value: number) => string;
  ariaLabel?: string;
  emptyMessage?: string;
}) {
  const nonEmpty = series.length > 0;
  const max = Math.max(...series.map(p => p.value), 0);

  const x = (i: number) =>
    nonEmpty ? PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(series.length - 1, 1) : 0;
  const y = (v: number) =>
    max > 0 ? PAD_TOP + ((H - PAD_TOP - PAD_BOT) * (1 - v / max)) : H - PAD_BOT;

  const line = nonEmpty ? series.map((p, i) => `${x(i)},${y(p.value)}`).join(' ') : '';
  const area = nonEmpty
    ? `${line} ${x(series.length - 1)},${H - PAD_BOT} ${x(0)},${H - PAD_BOT}`
    : '';

  // Show start/middle/end labels only, to avoid crowding on narrow screens.
  const labelIdxs = nonEmpty && series.length > 2
    ? [0, Math.floor(series.length / 2), series.length - 1]
    : series.map((_, i) => i);

  return (
    <div>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Baseline + one mid gridline for quick reading */}
        <line x1={PAD_L} y1={H - PAD_BOT} x2={W - PAD_R} y2={H - PAD_BOT} stroke="var(--line)" strokeWidth="1" />
        {max > 0 && <line x1={PAD_L} y1={y(max / 2)} x2={W - PAD_R} y2={y(max / 2)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />}

        {!nonEmpty || max === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--text-muted)">{emptyMessage}</text>
        ) : (
          <>
            <polygon points={area} fill="url(#trend-fill)" />
            <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {series.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--surface)" stroke={color} strokeWidth="2">
                <title>{`${p.title ?? p.label}: ${formatValue(p.value)}`}</title>
              </circle>
            ))}
          </>
        )}

        {labelIdxs.map(i => (
          <text
            key={i}
            x={x(i)}
            y={H - 8 + (i === labelIdxs[0] ? 0 : 0)}
            textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--text-muted)"
          >
            {series[i].label}
          </text>
        ))}
      </svg>
    </div>
  );
}
