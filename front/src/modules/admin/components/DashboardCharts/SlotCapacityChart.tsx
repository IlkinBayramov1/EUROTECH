import React, { useState } from 'react';
import type { DailySlotCapacityRow } from '@/shared/types/admin.types';
import './DashboardCharts.css';

interface AppointmentByStatus {
  CONFIRMED: number;
  COMPLETED: number;
  PENDING_PAYMENT: number;
  RESCHEDULED: number;
  CANCELLED: number;
  NO_SHOW: number;
}

interface SlotCapacityChartProps {
  dailyCapacity: DailySlotCapacityRow[];
  byStatus: AppointmentByStatus;
  totalBookedNext14d: number;
  totalCapacityNext14d: number;
  occupancyPct: number;
}

export default function SlotCapacityChart({
  dailyCapacity,
  byStatus,
  totalBookedNext14d,
  totalCapacityNext14d,
  occupancyPct,
}: SlotCapacityChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 420;
  const height = 168;
  const padLeft = 32;
  const padRight = 10;
  const padTop = 14;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const safeRows = dailyCapacity && dailyCapacity.length > 0 ? dailyCapacity : [];
  const maxCap = Math.max(4, ...safeRows.map((r) => Math.max(r.capacity, r.booked)));
  const colStep = safeRows.length > 0 ? plotW / safeRows.length : plotW;
  const barW = Math.max(8, Math.min(20, colStep * 0.62));

  const activeRow = hoveredIdx !== null && safeRows[hoveredIdx] ? safeRows[hoveredIdx] : null;
  const yTicks = [0, 0.5, 1];

  return (
    <div className="slot-chart-container">
      {/* Occupancy Summary Bar */}
      <div className="slot-kpi-strip">
        <div className="slot-kpi-metric">
          <span className="slot-kpi-label">14-Day Occupancy</span>
          <strong className="slot-kpi-val">{occupancyPct.toFixed(1)}%</strong>
        </div>
        <div className="slot-kpi-metric right">
          <span className="slot-kpi-label">Booked / Published</span>
          <strong className="slot-kpi-val-sub">
            {totalBookedNext14d} / {totalCapacityNext14d} seats
          </strong>
        </div>
      </div>

      {/* 14-Day SVG Capacity Bar Chart */}
      <div className="slot-svg-wrapper">
        {totalCapacityNext14d <= 0 ? (
          <div className="chart-empty-box compact">
            No active biometric slots published for the next 14 days.
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="slot-chart-svg"
              role="img"
              aria-label="14-Day Biometric Slot Capacity Chart"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {yTicks.map((ratio, idx) => {
                const y = padTop + plotH * (1 - ratio);
                const val = Math.round(maxCap * ratio);
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
                      x={padLeft - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      className="chart-axis-text small"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {safeRows.map((row, idx) => {
                const centerX = padLeft + idx * colStep + colStep / 2;
                const x = centerX - barW / 2;
                const capH = row.capacity > 0 ? Math.max(2, (row.capacity / maxCap) * plotH) : 0;
                const bookedH = row.booked > 0 ? Math.max(2, (row.booked / maxCap) * plotH) : 0;
                const capY = padTop + plotH - capH;
                const bookedY = padTop + plotH - bookedH;
                const isHovered = hoveredIdx === idx;
                const bookedColor =
                  row.occupancyPct >= 90 ? '#DC2626' : row.occupancyPct >= 65 ? '#D97706' : '#2563EB';

                return (
                  <g
                    key={row.date}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover highlight backdrop */}
                    {isHovered && (
                      <rect
                        x={padLeft + idx * colStep}
                        y={padTop}
                        width={colStep}
                        height={plotH}
                        fill="#F1F5F9"
                        rx={4}
                      />
                    )}

                    {/* Total Published Capacity Track */}
                    {capH > 0 && (
                      <rect
                        x={x}
                        y={capY}
                        width={barW}
                        height={capH}
                        rx={3}
                        fill="#DBEAFE"
                      />
                    )}

                    {/* Booked Portion Overlay */}
                    {bookedH > 0 && (
                      <rect
                        x={x}
                        y={bookedY}
                        width={barW}
                        height={bookedH}
                        rx={3}
                        fill={bookedColor}
                      />
                    )}

                    {/* Show every 3rd date label + last date to prevent overlap */}
                    {(idx % 3 === 0 || idx === safeRows.length - 1) && (
                      <text
                        x={centerX}
                        y={height - 8}
                        textAnchor="middle"
                        className="chart-axis-text small"
                      >
                        {row.label.split(' ')[1] || row.label}
                      </text>
                    )}

                    {/* Full column hit area */}
                    <rect
                      x={padLeft + idx * colStep}
                      y={padTop}
                      width={colStep}
                      height={plotH}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {activeRow && (
              <div className="slot-hover-readout">
                <strong>{activeRow.label}</strong>
                <span>
                  Booked: <b>{activeRow.booked}</b> / {activeRow.capacity} ({activeRow.occupancyPct.toFixed(0)}%) &bull; Free:{' '}
                  <b>{activeRow.available}</b>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Appointment Status Breakdown Grid */}
      <div className="appt-status-grid">
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#059669' }} />
          <span>Confirmed</span>
          <strong>{byStatus.CONFIRMED}</strong>
        </div>
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#2563EB' }} />
          <span>Completed</span>
          <strong>{byStatus.COMPLETED}</strong>
        </div>
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#D97706' }} />
          <span>Pending Pay</span>
          <strong>{byStatus.PENDING_PAYMENT}</strong>
        </div>
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#7C3AED' }} />
          <span>Rescheduled</span>
          <strong>{byStatus.RESCHEDULED}</strong>
        </div>
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#64748B' }} />
          <span>Cancelled</span>
          <strong>{byStatus.CANCELLED}</strong>
        </div>
        <div className="appt-pill">
          <span className="legend-dot" style={{ background: '#DC2626' }} />
          <span>No-Show</span>
          <strong>{byStatus.NO_SHOW}</strong>
        </div>
      </div>
    </div>
  );
}
