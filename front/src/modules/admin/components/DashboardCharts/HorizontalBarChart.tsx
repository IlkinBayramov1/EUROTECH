import React from 'react';
import type { DestinationStatRow } from '@/shared/types/admin.types';
import './DashboardCharts.css';

export type DestinationMetricMode = 'dossiers' | 'revenue' | 'approvalRate';

interface HorizontalBarChartProps {
  rows: DestinationStatRow[];
  metric: DestinationMetricMode;
  onRowClick?: (row: DestinationStatRow) => void;
}

export default function HorizontalBarChart({ rows, metric, onRowClick }: HorizontalBarChartProps) {
  if (!rows || rows.length === 0) {
    return <div className="chart-empty-box">No destination country records found in this timeframe.</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    if (metric === 'revenue') return b.revenueEur - a.revenueEur;
    if (metric === 'approvalRate') return b.approvalRatePct - a.approvalRatePct;
    return b.dossiers - a.dossiers;
  });

  const maxVal =
    metric === 'approvalRate'
      ? 100
      : Math.max(
          1,
          ...sorted.map((r) => (metric === 'revenue' ? Number(r.revenueEur || 0) : Number(r.dossiers || 0)))
        );

  return (
    <div className="hbar-list">
      {sorted.map((row) => {
        const val =
          metric === 'revenue'
            ? row.revenueEur
            : metric === 'approvalRate'
              ? row.approvalRatePct
              : row.dossiers;
        const pct = Math.min(100, Math.max(val > 0 ? 4 : 0, (val / maxVal) * 100));

        const primaryLabel =
          metric === 'revenue'
            ? `€${row.revenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : metric === 'approvalRate'
              ? `${row.approvalRatePct.toFixed(1)}%`
              : `${row.dossiers} dossiers`;

        const fillColor =
          metric === 'revenue' ? '#0F1E36' : metric === 'approvalRate' ? '#059669' : '#2563EB';

        return (
          <div
            key={row.countryId}
            className={`hbar-row ${onRowClick ? 'clickable' : ''}`}
            onClick={() => onRowClick && onRowClick(row)}
            title={`Click to filter dossiers for ${row.name}`}
          >
            <div className="hbar-top">
              <div className="hbar-country">
                <span className="iso-code-chip">{row.code}</span>
                <span className="hbar-name">{row.name}</span>
              </div>
              <div className="hbar-metrics">
                <strong>{primaryLabel}</strong>
                <span className="hbar-sub">
                  {row.applicants} pax &bull; €{row.revenueEur.toFixed(0)} &bull; {row.approvalRatePct.toFixed(0)}% appr.
                </span>
              </div>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${pct}%`, background: fillColor }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
