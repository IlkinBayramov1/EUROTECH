import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { storage } from '@/shared/utils/storage';
import { dossierService } from '@/shared/api/services/dossier.service';
import { serviceService } from '@/shared/api/services/service.service';
import { useToast } from '@/shared/context/ToastContext';
import { usePricingCatalog, type PricingPackageItem } from '@/shared/hooks/usePricingCatalog';
import { useApplicantPermissions } from '../hooks/useApplicantPermissions';
import { useUnifiedApplicant } from '../hooks/useUnifiedApplicant';
import ApplicantHeader from '../components/ApplicantHeader';
import ApplicantSwitcher from '../components/ApplicantSwitcher';
import SchengenQuestionnaire from '../components/SchengenQuestionnaire/SchengenQuestionnaire';
import ApplicantDocumentDesk from '../components/DocumentDesk/ApplicantDocumentDesk';
import ApplicantAppointmentDesk from '../components/AppointmentDesk/ApplicantAppointmentDesk';
import QuickAddApplicantModal from '../components/Modals/QuickAddApplicantModal';
import MrzScannerModal from '../components/Modals/MrzScannerModal';
import './UnifiedApplicantWorkspace.css';

export default function UnifiedApplicantWorkspace() {
  const { dossierId: routeDossierId, applicantId: routeApplicantId } = useParams<{
    dossierId?: string;
    applicantId?: string;
  }>();

  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useApplicantPermissions();
  const { showSuccess, showError } = useToast();
  const { packages, services: catalogServices, exchangeRate } = usePricingCatalog();

  const [activeDossierId, setActiveDossierId] = useState<string>(routeDossierId || storage.getActiveDossierId() || '');
  const [activeApplicantId, setActiveApplicantId] = useState<string>(routeApplicantId || 'primary');
  const [resolvingIds, setResolvingIds] = useState(!routeDossierId);

  const [activeTab, setActiveTab] = useState<'questionnaire' | 'documents' | 'appointment' | 'packages'>('questionnaire');
  const [updatingPkgId, setUpdatingPkgId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMrzModalOpen, setIsMrzModalOpen] = useState(false);

  // If dossierId was not in route (e.g. called from /client/application), resolve from API
  useEffect(() => {
    if (routeDossierId) {
      setActiveDossierId(routeDossierId);
      setActiveApplicantId(routeApplicantId || 'primary');
      setResolvingIds(false);
      return;
    }

    setResolvingIds(true);
    dossierService
      .getMyDossiers()
      .then((res: any) => {
        const list = res.data?.dossiers || [];
        if (list.length > 0) {
          const first = list[0];
          setActiveDossierId(first.id);
          storage.setActiveDossierId(first.id);
          const firstApp = first.applicants?.[0];
          if (firstApp) {
            setActiveApplicantId(firstApp.id);
          }
        }
      })
      .catch((err) => console.warn('Dossier resolve warning:', err))
      .finally(() => setResolvingIds(false));
  }, [routeDossierId, routeApplicantId]);

  const {
    loading,
    saving,
    lastSaved,
    applicant,
    dossier,
    allApplicants,
    formData,
    progress,
    updateFormField,
    updateMultipleFields,
    manualSave,
    reloadDetails,
  } = useUnifiedApplicant(activeDossierId, activeApplicantId);

  const handleSelectApplicant = (newApplicantId: string) => {
    setActiveApplicantId(newApplicantId);
    if (activeDossierId) {
      let basePath = `/application/${activeDossierId}/applicant/${newApplicantId}`;
      if (location.pathname.startsWith('/corporate')) {
        basePath = `/corporate/application/${activeDossierId}/applicant/${newApplicantId}`;
      } else if (location.pathname.startsWith('/agent')) {
        basePath = `/agent/application/${activeDossierId}/applicant/${newApplicantId}`;
      } else if (location.pathname.startsWith('/client')) {
        basePath = `/client/application/${activeDossierId}/applicant/${newApplicantId}`;
      } else if (location.pathname.startsWith('/admin')) {
        basePath = `/admin/dossiers/${activeDossierId}/applicant/${newApplicantId}`;
      }
      navigate(`${basePath}${location.search}`, {
        replace: true,
      });
    }
  };

  const handleApplicantAdded = (newApplicantId?: string) => {
    reloadDetails();
    if (newApplicantId) {
      handleSelectApplicant(newApplicantId);
    }
  };

  const currentPkgId = String(
    (applicant as any)?.formDataJson?.package ||
      (dossier as any)?.groupBatch?.packageTier ||
      'standard'
  ).toLowerCase();

  const handleSelectPackageInWorkspace = async (pkg: PricingPackageItem) => {
    if (!dossier?.id) return;
    setUpdatingPkgId(pkg.id);
    try {
      await serviceService.updateDossierPackage(dossier.id, { packageId: pkg.id });
      showSuccess(`Payment package updated to "${pkg.name}" (€${Number(pkg.priceEur).toFixed(2)} / person)!`);
      reloadDetails();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to update payment package.');
    } finally {
      setUpdatingPkgId(null);
    }
  };

  if (resolvingIds || (loading && !applicant)) {
    return (
      <div className="applicant-workspace-loading">
        <div className="unified-spinner"></div>
        <p>Loading consular application workspace...</p>
      </div>
    );
  }

  if (!dossier || !applicant) {
    return (
      <div className="applicant-workspace-empty">
        <h2>Application Dossier Not Found</h2>
        <p>You do not have an active visa dossier selected or permission to view this application.</p>
        <button
          type="button"
          className="btn-return-portal"
          onClick={() => navigate(permissions.backUrl || '/')}
        >
          {permissions.backLabel || 'Return to Dashboard'}
        </button>
      </div>
    );
  }

  return (
    <div className="unified-applicant-workspace">
      {/* Top Universal Header */}
      <ApplicantHeader
        applicant={applicant}
        dossier={dossier}
        permissions={permissions}
        progress={progress}
        saving={saving}
        lastSaved={lastSaved}
        onOpenMrzModal={() => setIsMrzModalOpen(true)}
        onManualSave={manualSave}
      />

      <div className="workspace-container">
        {/* Switcher Bar for Groups / Multi-Applicant Families */}
        {permissions.canSwitchApplicants && allApplicants.length > 0 && (
          <ApplicantSwitcher
            applicants={allApplicants}
            currentApplicantId={applicant.id}
            onSelectApplicant={handleSelectApplicant}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            canAdd={permissions.origin !== 'guest'}
            portalType={dossier.portalType}
          />
        )}

        {/* Main Tab Navigation */}
        <div className="workspace-tabs-bar">
          <button
            type="button"
            className={`ws-tab-btn ${activeTab === 'questionnaire' ? 'active' : ''}`}
            onClick={() => setActiveTab('questionnaire')}
          >
            Harmonized Questionnaire (37 Points)
            <span className="tab-pill-progress">{progress}%</span>
          </button>

          <button
            type="button"
            className={`ws-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Required Documents
            <span className="tab-pill-count">
              {applicant.documents?.length || 0}
            </span>
          </button>

          <button
            type="button"
            className={`ws-tab-btn ${activeTab === 'appointment' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointment')}
          >
            Biometric Appointment
            {dossier.appointment && <span className="tab-pill-confirmed">Booked</span>}
          </button>

          <button
            type="button"
            className={`ws-tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
            onClick={() => setActiveTab('packages')}
          >
            Payment Packages &amp; Services
            <span className="tab-pill-count">{currentPkgId.toUpperCase()}</span>
          </button>
        </div>

        {/* Tab 1: 37-Point Harmonized Questionnaire */}
        {activeTab === 'questionnaire' && (
          <SchengenQuestionnaire
            formData={formData}
            onFieldChange={updateFormField}
            dossier={dossier}
            onOpenMrzModal={() => setIsMrzModalOpen(true)}
            onSaveForm={manualSave}
            isCorporateMode={permissions.origin === 'corporate'}
          />
        )}

        {/* Tab 2: Document Examination Desk */}
        {activeTab === 'documents' && (
          <ApplicantDocumentDesk
            applicant={applicant}
            dossier={dossier}
            onReload={reloadDetails}
          />
        )}

        {/* Tab 3: Biometric Appointment */}
        {activeTab === 'appointment' && (
          <ApplicantAppointmentDesk
            dossier={dossier}
            onReload={reloadDetails}
          />
        )}

        {/* Tab 4: Payment Packages & Add-On Services */}
        {activeTab === 'packages' && (
          <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A', fontWeight: 800 }}>
                  Consular Payment Packages &amp; Value-Added Services
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#64748B' }}>
                  Select or upgrade your service package for this application dossier ({allApplicants.length} applicant{allApplicants.length > 1 ? 's' : ''}).
                </p>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '8px 16px', borderRadius: '10px' }}>
                Active Package: {currentPkgId.toUpperCase()} • Dossier Total: €{Number((dossier as any).totalAmount || 0).toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '28px' }}>
              {packages.filter((p) => p.isActive !== false).map((pkg) => {
                const isSelected = currentPkgId === String(pkg.id).toLowerCase();
                const pEur = Number(pkg.priceEur || 0);
                const pAzn = Number(pkg.priceAzn ?? (pEur * exchangeRate));
                return (
                  <div
                    key={pkg.id}
                    style={{
                      border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                      background: isSelected ? '#EFF6FF' : '#F8FAFC',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{pkg.name}</h4>
                        {pkg.badge && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, background: isSelected ? '#2563EB' : '#E2E8F0', color: isSelected ? '#FFFFFF' : '#334155', padding: '3px 8px', borderRadius: '8px' }}>
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1D4ED8', marginBottom: '8px' }}>
                        {pEur > 0 ? `+€${pEur.toFixed(2)}` : '€0.00'}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                          ({pAzn.toFixed(2)} AZN / pax)
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, marginBottom: '12px' }}>
                        {pkg.description}
                      </p>
                      {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                        <ul style={{ margin: '0 0 14px 0', paddingLeft: '18px', fontSize: '0.78rem', color: '#334155' }}>
                          {pkg.features.map((f, i) => (
                            <li key={i} style={{ marginBottom: '3px' }}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isSelected || updatingPkgId === pkg.id}
                      onClick={() => handleSelectPackageInWorkspace(pkg)}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #2563EB' : 'none',
                        background: isSelected ? '#DBEAFE' : '#2563EB',
                        color: isSelected ? '#1E40AF' : '#FFFFFF',
                        fontWeight: 700,
                        cursor: isSelected ? 'default' : 'pointer',
                      }}
                    >
                      {updatingPkgId === pkg.id ? 'Updating...' : isSelected ? '✓ Active Package' : `Select ${pkg.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              Available Individual Add-On Services
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {catalogServices.filter((s) => s.isActive !== false).map((srv) => (
                <div
                  key={srv.id}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.86rem', color: '#0F172A' }}>{srv.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{srv.category}</span>
                  </div>
                  <strong style={{ fontSize: '0.9rem', color: '#1D4ED8', whiteSpace: 'nowrap' }}>
                    €{Number(srv.priceEur).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Applicant Modal */}
      <QuickAddApplicantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        dossierId={dossier.id}
        onApplicantAdded={handleApplicantAdded}
        defaultRoleLabel={
          permissions.origin === 'agent'
            ? 'Passenger'
            : permissions.origin === 'corporate'
            ? 'Employee'
            : 'Family Member'
        }
      />

      {/* Passport MRZ Scanner Modal */}
      <MrzScannerModal
        isOpen={isMrzModalOpen}
        onClose={() => setIsMrzModalOpen(false)}
        onApplyMrz={(extracted) => {
          updateMultipleFields(extracted);
        }}
      />
    </div>
  );
}

