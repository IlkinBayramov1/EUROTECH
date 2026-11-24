import React, { useState, useMemo } from 'react';
import type { TimeSeriesPoint } from '@/shared/types/admin.types';
import './DashboardCharts.css';

export type TrendChartMode = 'revenue' | 'applications' | 'dual';

interface TrendAreaChartProps {
  data: TimeSeriesPoint[];
  mode: TrendChartMode;
  eurToAznRate?: number;
}

function getNiceCeiling(maxVal: number): number {
  if (maxVal <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const normalized = maxVal / magnitude;
  let nice = 1;
  if (normalized <= 1.2) nice = 1.2;
  else if (normalized <= 1.5) nice = 1.5;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 2.5) nice = 2.5;
  else if (normalized <= 3) nice = 3;
  else if (normalized <= 4) nice = 4;
  else if (normalized <= 5) nice = 5;
  else if (normalized <= 6) nice = 6;
  else if (normalized <= 8) nice = 8;
  else nice = 10;
  return nice * magnitude;
}

function formatAxisVal(val: number, isCurrency: boolean): string {
  if (val >= 1000000) return `${isCurrency ? '€' : ''}${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${isCurrency ? '€' : ''}${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return isCurrency ? `€${Math.round(val)}` : String(Math.round(val));
}

export default function TrendAreaChart({ data, mode, eurToAznRate = 1.85 }: TrendAreaChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 760;
  const height = 270;
  const padLeft = 58;
  const padRight = mode === 'dual' ? 46 : 20;
  const padTop = 18;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { revMax, appMax, revPath, revAreaPath, appPath, appAreaPath, points, tickIndices } = useMemo(() => {
    const safeData = data && data.length > 0 ? data : [];
    const maxRevRaw = safeData.reduce((m, d) => Math.max(m, Number(d.revenueEur || 0)), 0);
    const maxAppRaw = safeData.reduce((m, d) => Math.max(m, Number(d.applications || 0)), 0);

    const revCeil = getNiceCeiling(maxRevRaw > 0 ? maxRevRaw * 1.12 : 100);
    const appCeil = getNiceCeiling(maxAppRaw > 0 ? maxAppRaw * 1.15 : 5);

    const n = safeData.length;
    const stepX = n > 1 ? plotW / (n - 1) : 0;

    const pts = safeData.map((d, i) => {
      const x = n > 1 ? padLeft + i * stepX : padLeft + plotW / 2;
      const revY = padTop + plotH - (Math.max(0, d.revenueEur) / revCeil) * plotH;
      const appY = padTop + plotH - (Math.max(0, d.applications) / appCeil) * plotH;
      return { ...d, i, x, revY, appY };
    });

    const buildLine = (key: 'revY' | 'appY') => {
      if (pts.length === 0) return '';
      return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p[key].toFixed(1)}`).join(' ');
    };

    const buildArea = (key: 'revY' | 'appY') => {
      if (pts.length === 0) return '';
      const line = buildLine(key);
      const bottomY = (padTop + plotH).toFixed(1);
      return `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${bottomY} L ${pts[0].x.toFixed(1)} ${bottomY} Z`;
    };

    // Smart X-axis tick thinning so labels never collide
    const maxLabels = 7;
    const ticks: number[] = [];
    if (n <= maxLabels) {
      for (let i = 0; i < n; i++) ticks.push(i);
    } else {
      const stride = Math.ceil((n - 1) / (maxLabels - 1));
      for (let i = 0; i < n; i += stride) ticks.push(i);
      if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1);
    }

    return {
      revMax: revCeil,
      appMax: appCeil,
      revPath: buildLine('revY'),
      revAreaPath: buildArea('revY'),
      appPath: buildLine('appY'),
      appAreaPath: buildArea('appY'),
      points: pts,
      tickIndices: ticks,
    };
  }, [data, plotW, plotH, padLeft, padTop]);

  if (!data || data.length === 0) {
    return <div className="chart-empty-box">No timeline records available for the selected range.</div>;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const primaryMax = mode === 'applications' ? appMax : revMax;
  const primaryIsCurrency = mode !== 'applications';
  const activePt = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;
  const barWidth = Math.max(6, Math.min(24, (plotW / Math.max(1, points.length)) * 0.52));

  return (
    <div className="trend-chart-wrapper">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart-svg"
        role="img"
        aria-label="Revenue and Application Volume Time Series Chart"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="eurotechRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="eurotechAppGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Left Y-Axis Labels */}
        {gridLines.map((ratio, idx) => {
          const y = padTop + plotH * (1 - ratio);
          const leftVal = primaryMax * ratio;
          const rightVal = appMax * ratio;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={ratio === 0 ? '#CBD5E1' : '#F1F5F9'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                className="chart-axis-text"
              >
                {formatAxisVal(leftVal, primaryIsCurrency)}
              </text>
              {mode === 'dual' && (
                <text
                  x={width - padRight + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="chart-axis-text axis-right"
                >
                  {formatAxisVal(rightVal, false)}
                </text>
              )}
            </g>
          );
        })}

        {/* Dual Mode: Applications subtle bars behind Revenue Line */}
        {mode === 'dual' &&
          points.map((p) => {
            const barH = Math.max(0, padTop + plotH - p.appY);
            const isActive = hoveredIdx === p.i;
            return (
              <rect
                key={`bar-${p.key}`}
                x={p.x - barWidth / 2}
                y={p.appY}
                width={barWidth}
                height={barH}
                rx={3}
                fill={isActive ? '#059669' : '#10B981'}
                opacity={isActive ? 0.5 : 0.24}
              />
            );
          })}

        {/* Revenue Area + Line */}
        {(mode === 'revenue' || mode === 'dual') && (
          <>
            <path d={revAreaPath} fill="url(#eurotechRevGrad)" />
            <path
              d={revPath}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Applications Area + Line */}
        {mode === 'applications' && (
          <>
            <path d={appAreaPath} fill="url(#eurotechAppGrad)" />
            <path
              d={appPath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hover Crosshair & Active Markers */}
        {activePt && (
          <g>
            <line
              x1={activePt.x}
              y1={padTop}
              x2={activePt.x}
              y2={padTop + plotH}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {(mode === 'revenue' || mode === 'dual') && (
              <circle
                cx={activePt.x}
                cy={activePt.revY}
                r="5"
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
            )}
            {mode === 'applications' && (
              <circle
                cx={activePt.x}
                cy={activePt.appY}
                r="5"
                fill="#059669"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
            )}
          </g>
        )}

        {/* X-Axis Labels */}
        {tickIndices.map((idx) => {
          const pt = points[idx];
          if (!pt) return null;
          return (
            <text
              key={`x-${pt.key}`}
              x={pt.x}
              y={height - 12}
              textAnchor="middle"
              className="chart-axis-text"
            >
              {pt.label}
            </text>
          );
        })}

        {/* Invisible Pointer Hit Strips for Smooth Hover */}
        {points.map((p, idx) => {
          const sliceW = points.length > 1 ? plotW / (points.length - 1) : plotW;
          const hitX = Math.max(padLeft, p.x - sliceW / 2);
          const hitW = Math.min(width - padRight - hitX, sliceW);
          return (
            <rect
              key={`hit-${p.key}`}
              x={hitX}
              y={padTop}
              width={Math.max(4, hitW)}
              height={plotH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoveredIdx(idx)}
            />
          );
        })}
      </svg>

      {/* Interactive Floating Tooltip */}
      {activePt && (
        <div
          className="chart-floating-tooltip"
          style={{
            left: `${Math.min(72, Math.max(8, (activePt.x / width) * 100))}%`,
          }}
        >
          <div className="tooltip-title">{activePt.label} ({activePt.key})</div>
          <div className="tooltip-grid">
            <span className="tt-label">Net Revenue:</span>
            <strong className="tt-val tt-blue">
              €{activePt.revenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="tt-label">AZN Equiv.:</span>
            <span className="tt-val">
              {(activePt.revenueAzn ?? activePt.revenueEur * eurToAznRate).toFixed(2)} AZN
            </span>
            <span className="tt-label">Applications:</span>
            <strong className="tt-val tt-emerald">{activePt.applications} dossiers</strong>
            <span className="tt-label">Travelers (Pax):</span>
            <span className="tt-val">{activePt.applicants}</span>
            <span className="tt-label">Approved:</span>
            <span className="tt-val">{activePt.approved}</span>
          </div>
        </div>
      )}

      {/* Compact Legend */}
      <div className="chart-inline-legend">
        {(mode === 'revenue' || mode === 'dual') && (
          <span className="legend-pill">
            <i className="legend-dot" style={{ background: '#2563EB' }} />
            Net Settled Revenue (EUR)
          </span>
        )}
        {(mode === 'applications' || mode === 'dual') && (
          <span className="legend-pill">
            <i className="legend-dot" style={{ background: '#059669' }} />
            New Applications (Count)
          </span>
        )}
      </div>
    </div>
  );
}
