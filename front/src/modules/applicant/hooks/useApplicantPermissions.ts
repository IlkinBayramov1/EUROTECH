import { useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import type { ApplicantPermissions, ApplicantOrigin } from '../types/applicant.types';

export function useApplicantPermissions(): ApplicantPermissions {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  return useMemo(() => {
    const rawOrigin = searchParams.get('origin')?.toLowerCase();
    const token = searchParams.get('token');
    const pathname = location.pathname.toLowerCase();

    let origin: ApplicantOrigin = 'client';

    if (token || rawOrigin === 'guest') {
      origin = 'guest';
    } else if (
      pathname.startsWith('/corporate') ||
      rawOrigin === 'corporate' ||
      user?.role === 'CORPORATE_HR' ||
      user?.role === 'CORPORATE'
    ) {
      origin = 'corporate';
    } else if (
      pathname.startsWith('/agent') ||
      rawOrigin === 'agent' ||
      user?.role === 'AGENT_TUR_OPERATOR' ||
      user?.role === 'AGENT'
    ) {
      origin = 'agent';
    } else {
      origin = 'client';
    }

    if (origin === 'agent') {
      return {
        origin: 'agent',
        canEdit: true,
        canUploadDocs: true,
        canGeneratePdf: true,
        canSwitchApplicants: true,
        canBookAppointment: true,
        showFinancials: true,
        backUrl: '/agent/groups',
        backLabel: '← Back to Tour Groups',
        portalBadgeText: 'Tour Operator Passenger',
      };
    }

    if (origin === 'corporate') {
      return {
        origin: 'corporate',
        canEdit: true,
        canUploadDocs: true,
        canGeneratePdf: true,
        canSwitchApplicants: true,
        canBookAppointment: true,
        showFinancials: true,
        backUrl: '/corporate/batches',
        backLabel: '← Back to Batches',
        portalBadgeText: 'Corporate Delegation Employee',
      };
    }

    if (origin === 'guest') {
      return {
        origin: 'guest',
        canEdit: true,
        canUploadDocs: true,
        canGeneratePdf: true,
        canSwitchApplicants: false,
        canBookAppointment: false,
        showFinancials: false,
        backUrl: '',
        backLabel: '',
        portalBadgeText: 'Verified Consular Self-Registration',
      };
    }

    return {
      origin: 'client',
      canEdit: true,
      canUploadDocs: true,
      canGeneratePdf: true,
      canSwitchApplicants: true,
      canBookAppointment: true,
      showFinancials: false,
      backUrl: '/client',
      backLabel: '← Back to Client Portal',
      portalBadgeText: 'Individual Visa Dossier',
    };
  }, [user, searchParams, location.pathname]);
}
