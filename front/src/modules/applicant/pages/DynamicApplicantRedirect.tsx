import React from 'react';
import { useParams, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import UnifiedApplicantWorkspace from './UnifiedApplicantWorkspace';

/**
 * DynamicApplicantRedirect
 * Ensures that no matter how an applicant form is accessed (/application/:dossierId/applicant/:applicantId),
 * the user is seamlessly routed into their active portal (Corporate, Agent, Client, Admin)
 * so that the left sidebar is 100% visible, dynamic, and interactive at all times.
 */
export default function DynamicApplicantRedirect() {
  const { dossierId, applicantId } = useParams<{ dossierId?: string; applicantId?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const token = searchParams.get('token');
  const origin = searchParams.get('origin')?.toLowerCase();

  // 1. Guest Self-Fill Link with Token -> Render standalone workspace
  if (token || origin === 'guest' || !user) {
    return <UnifiedApplicantWorkspace />;
  }

  const applicantPath = applicantId ? `applicant/${applicantId}` : '';
  const dossierPath = dossierId ? `${dossierId}/${applicantPath}` : '';
  const search = location.search;

  // 2. Corporate HR Portal
  if (user.role === 'CORPORATE' || user.role === 'CORPORATE_HR' || origin === 'corporate') {
    const target = dossierId
      ? `/corporate/application/${dossierId}/${applicantPath}${search}`
      : `/corporate/batches${search}`;
    return <Navigate to={target} replace />;
  }

  // 3. Travel Agent / Tour Operator Portal
  if (user.role === 'AGENT' || user.role === 'AGENT_TUR_OPERATOR' || origin === 'agent') {
    const target = dossierId
      ? `/agent/application/${dossierId}/${applicantPath}${search}`
      : `/agent/groups${search}`;
    return <Navigate to={target} replace />;
  }

  // 4. Consular Staff / Admin Portal
  if (['ADMIN', 'OPERATOR', 'MANAGER'].includes(user.role)) {
    const target = dossierId
      ? `/admin/dossiers/${dossierId}${search}`
      : `/admin/dossiers${search}`;
    return <Navigate to={target} replace />;
  }

  // 5. Individual / Client Portal (Default)
  const target = dossierId
    ? `/client/application/${dossierId}/${applicantPath}${search}`
    : `/client/application${search}`;
  return <Navigate to={target} replace />;
}

