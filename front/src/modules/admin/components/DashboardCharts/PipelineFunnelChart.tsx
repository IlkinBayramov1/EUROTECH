import React from 'react';
import type { PipelineStageRow, DossierStatusType } from '@/shared/types/admin.types';
import './DashboardCharts.css';

interface DocumentHealthData {
  total: number;
  verified: number;
  pending: number;
  needsCorrection: number;
  rejected: number;
  verificationRatePct: number;
}

interface PipelineFunnelChartProps {
  stages: PipelineStageRow[];
  documentHealth: DocumentHealthData;
  avgTurnaroundDays: number;
  onStageClick?: (status: DossierStatusType) => void;
}

const STAGE_COLOR_MAP: Record<DossierStatusType, string> = {
  RECEIVED: '#64748B',
  UNDER_REVIEW: '#2563EB',
  NEEDS_CORRECTION: '#D97706',
  SUBMITTED_TO_CONSULATE: '#7C3AED',
  APPROVED: '#059669',
  REJECTED: '#DC2626',
};

export default function PipelineFunnelChart({
  stages,
  documentHealth,
  avgTurnaroundDays,
  onStageClick,
}: PipelineFunnelChartProps) {
  const maxStageCount = Math.max(1, ...stages.map((s) => Number(s.count || 0)));

  const docTotal = Math.max(1, documentHealth.total);
  const docVerifiedPct = documentHealth.total > 0 ? (documentHealth.verified / docTotal) * 100 : 0;
  const docPendingPct = documentHealth.total > 0 ? (documentHealth.pending / docTotal) * 100 : 0;
  const docCorrectionPct = documentHealth.total > 0 ? (documentHealth.needsCorrection / docTotal) * 100 : 0;
  const docRejectedPct = documentHealth.total > 0 ? (documentHealth.rejected / docTotal) * 100 : 0;

  return (
    <div className="pipeline-chart-container">
      {/* 6-Stage Consular Workflow Breakdown */}
      <div className="pipeline-stages-list">
        {stages.map((stage) => {
          const color = STAGE_COLOR_MAP[stage.status] || '#475569';
          const barWidthPct =
            stage.count > 0 ? Math.min(100, Math.max(4, (stage.count / maxStageCount) * 100)) : 0;

          return (
            <div
              key={stage.status}
              className={`pipeline-stage-row ${onStageClick ? 'clickable' : ''}`}
              onClick={() => onStageClick && onStageClick(stage.status)}
              title={`Filter dossiers with status: ${stage.label}`}
            >
              <div className="pipeline-stage-meta">
                <div className="pipeline-stage-left">
                  <span className="legend-dot" style={{ background: color }} />
                  <span className="pipeline-stage-name">{stage.label}</span>
                </div>
                <div className="pipeline-stage-right">
                  <strong>{stage.count}</strong>
                  <span className="pipeline-share">({stage.sharePct.toFixed(1)}%)</span>
                  <span className="pipeline-live-pill" title="All-time live dossiers currently in this stage">
                    Live: {stage.liveTotal}
                  </span>
                </div>
              </div>
              <div className="pipeline-bar-track">
                <div
                  className="pipeline-bar-fill"
                  style={{ width: `${barWidthPct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Document Verification Health & Consular Turnaround Footer */}
      <div className="doc-health-box">
        <div className="doc-health-header">
          <div>
            <span className="doc-health-title">Document Verification Health</span>
            <span className="doc-health-sub">
              {documentHealth.total} total files &bull; {documentHealth.verificationRatePct.toFixed(1)}% verified
            </span>
          </div>
          <div className="turnaround-badge" title="Average elapsed days from creation to Approved/Rejected decision">
            <span>Avg Turnaround</span>
            <strong>{avgTurnaroundDays > 0 ? `${avgTurnaroundDays.toFixed(1)}d` : 'N/A'}</strong>
          </div>
        </div>

        <div className="doc-stacked-bar" aria-label="Document Verification Status Distribution">
          {documentHealth.total === 0 ? (
            <div className="doc-seg seg-empty" style={{ width: '100%' }} />
          ) : (
            <>
              {docVerifiedPct > 0 && (
                <div
                  className="doc-seg seg-verified"
                  style={{ width: `${docVerifiedPct}%` }}
                  title={`Verified: ${documentHealth.verified}`}
                />
              )}
              {docPendingPct > 0 && (
                <div
                  className="doc-seg seg-pending"
                  style={{ width: `${docPendingPct}%` }}
                  title={`Pending Review: ${documentHealth.pending}`}
                />
              )}
              {docCorrectionPct > 0 && (
                <div
                  className="doc-seg seg-correction"
                  style={{ width: `${docCorrectionPct}%` }}
                  title={`Needs Correction: ${documentHealth.needsCorrection}`}
                />
              )}
              {docRejectedPct > 0 && (
                <div
                  className="doc-seg seg-rejected"
                  style={{ width: `${docRejectedPct}%` }}
                  title={`Rejected: ${documentHealth.rejected}`}
                />
              )}
            </>
          )}
        </div>

        <div className="doc-health-legend">
          <span className="doc-leg-item">
            <i className="legend-dot" style={{ background: '#059669' }} />
            Verified: <strong>{documentHealth.verified}</strong>
          </span>
          <span className="doc-leg-item">
            <i className="legend-dot" style={{ background: '#2563EB' }} />
            Pending: <strong>{documentHealth.pending}</strong>
          </span>
          <span className="doc-leg-item">
            <i className="legend-dot" style={{ background: '#D97706' }} />
            Correction: <strong>{documentHealth.needsCorrection}</strong>
          </span>
          <span className="doc-leg-item">
            <i className="legend-dot" style={{ background: '#DC2626' }} />
            Rejected: <strong>{documentHealth.rejected}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
