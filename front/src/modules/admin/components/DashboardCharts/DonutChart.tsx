import React, { useState } from 'react';
import './DashboardCharts.css';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  secondaryText?: string;
  color: string;
  sharePct: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
  formatValue?: (val: number) => string;
  onSegmentClick?: (segment: DonutSegment) => void;
  emptyMessage?: string;
}

export default function DonutChart({
  segments,
  centerLabel,
  centerValue,
  formatValue = (v) => String(v),
  onSegmentClick,
  emptyMessage = 'No data recorded for this period.',
}: DonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const total = segments.reduce((sum, s) => sum + Math.max(0, Number(s.value || 0)), 0);
  const radius = 64;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  const hoveredSeg = hoveredId ? segments.find((s) => s.id === hoveredId) || null : null;

  let cumulativeOffset = 0;

  return (
    <div className="donut-chart-layout">
      <div className="donut-svg-box">
        <svg viewBox="0 0 180 180" className="donut-svg" role="img" aria-label={centerLabel}>
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments.map((seg) => {
              const val = Math.max(0, Number(seg.value || 0));
              if (val <= 0) return null;
              const fraction = val / total;
              const dashLen = fraction * circumference;
              const dashGap = circumference - dashLen;
              const offset = -cumulativeOffset;
              cumulativeOffset += dashLen;
              const isHovered = hoveredId === seg.id;

              return (
                <circle
                  key={seg.id}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${Math.max(1.5, dashLen - 1.5)} ${dashGap + 1.5}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 90 90)"
                  style={{
                    cursor: onSegmentClick ? 'pointer' : 'default',
                    transition: 'stroke-width 0.16s ease, opacity 0.16s ease',
                    opacity: hoveredId && !isHovered ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSegmentClick && onSegmentClick(seg)}
                />
              );
            })}
        </svg>

        <div className="donut-center-readout">
          <span className="donut-center-label">
            {hoveredSeg ? hoveredSeg.label : centerLabel}
          </span>
          <strong className="donut-center-value">
            {hoveredSeg ? formatValue(hoveredSeg.value) : centerValue}
          </strong>
          {hoveredSeg && (
            <span className="donut-center-pct">{hoveredSeg.sharePct.toFixed(1)}%</span>
          )}
        </div>
      </div>

      {total <= 0 ? (
        <div className="donut-empty-note">{emptyMessage}</div>
      ) : (
        <div className="donut-legend-list">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className={`donut-legend-row ${hoveredId === seg.id ? 'active' : ''} ${onSegmentClick ? 'clickable' : ''}`}
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSegmentClick && onSegmentClick(seg)}
            >
              <div className="donut-legend-left">
                <span className="legend-dot" style={{ background: seg.color }} />
                <div>
                  <span className="donut-legend-name">{seg.label}</span>
                  {seg.secondaryText && <span className="donut-legend-sub">{seg.secondaryText}</span>}
                </div>
              </div>
              <div className="donut-legend-right">
                <strong>{formatValue(seg.value)}</strong>
                <span>{seg.sharePct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
