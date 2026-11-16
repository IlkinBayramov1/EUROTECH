import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '@/shared/api/services/admin.service';
import { dossierService } from '@/shared/api/services/dossier.service';
import { useToast } from '@/shared/context/ToastContext';
import { downloadFileFromApi } from '@/shared/utils/download.util';
import DocumentReviewModal from '@/modules/admin/components/DocumentReviewModal';
import ConsularDecisionModal from '@/modules/admin/components/ConsularDecisionModal';
import type { AdminDossier, AdminApplicantDocument, DossierStatusType } from '@/shared/types/admin.types';
import './AdminDossierDetail.css';

export default function AdminDossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [dossier, setDossier] = useState<AdminDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'documents' | 'applicant' | 'history'>('documents');
  const [selectedApplicantIndex, setSelectedApplicantIndex] = useState(0);

  // Edit questionnaire inputs state
  const [isEditingInputs, setIsEditingInputs] = useState(false);
  const [editingFormData, setEditingFormData] = useState<Record<string, any>>({});
  const [isSavingInputs, setIsSavingInputs] = useState(false);

  // Modals state
  const [selectedDocForReview, setSelectedDocForReview] = useState<AdminApplicantDocument | null>(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchDossierData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await adminService.getDossierById(id);
      if (res.data?.dossier) {
        setDossier(res.data.dossier);
      }
    } catch (err: any) {
      console.error('Failed to load dossier details:', err);
      showError(err.message || 'Could not load dossier details.');
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    fetchDossierData();
  }, [fetchDossierData]);

  // Sync editing form data when active applicant or dossier changes
  useEffect(() => {
    const curApp = dossier?.applicants?.[selectedApplicantIndex] || dossier?.applicants?.[0];
    if (curApp) {
      const rawForm = curApp.formDataJson && typeof curApp.formDataJson === 'object' ? curApp.formDataJson : {};
      
      const effectiveFirstName = curApp.firstName || rawForm.firstNames || rawForm.firstName || '';
      const effectiveLastName = curApp.lastName || rawForm.surname || rawForm.lastName || '';
      const effectiveBirthSurname = rawForm.surnameAtBirth || rawForm.birthSurname || '';
      const effectiveDob = curApp.birthDate ? String(curApp.birthDate).split('T')[0] : (rawForm.dateOfBirth || rawForm.birthDate || rawForm.dob || '');
      const effectivePassport = curApp.passportNumber || rawForm.travelDocumentNumber || rawForm.passportNumber || '';
      const effectiveNationality = curApp.nationality || rawForm.currentNationality || rawForm.nationality || '';
      const effectiveGender = curApp.gender || rawForm.sex || rawForm.gender || '';
      const effectiveMarital = rawForm.civilStatus || rawForm.maritalStatus || '';
      const effectivePassportType = rawForm.travelDocumentType || rawForm.passportType || 'Ordinary Passport';
      const effectivePassportExpiry = rawForm.expirationDate || rawForm.passportExpiry || '';
      const effectivePurpose = rawForm.mainPurpose || rawForm.purpose || '';
      const effectiveDestination = rawForm.destinationMemberState || rawForm.destination || dossier?.country?.nameEn || '';
      const effectiveFirstEntry = rawForm.firstEntryMemberState || rawForm.firstEntry || dossier?.country?.nameEn || '';
      const effectiveEntries = rawForm.numberOfEntries || rawForm.entriesRequested || 'Single';
      const effectiveArrival = rawForm.intendedArrivalDate || rawForm.arrivalDate || '';
      const effectiveDeparture = rawForm.intendedDepartureDate || rawForm.departureDate || '';
      const effectiveDuration = rawForm.intendedDurationOfStay || rawForm.durationOfStay || '';
      const effectiveHotelName = rawForm.hotelName || rawForm.invitingOrgName || rawForm.invitingParty || '';
      const effectiveHotelAddress = rawForm.hotelAddress || rawForm.invitingAddress || rawForm.address || '';
      const effectiveHotelEmail = rawForm.hotelEmail || rawForm.invitingEmail || '';
      const effectiveHotelPhone = rawForm.hotelPhone || rawForm.invitingPhone || '';
      const effectiveApplicantPhone = rawForm.applicantPhone || rawForm.homePhone || rawForm.phone || dossier?.user?.phone || '';
      const effectiveApplicantEmail = rawForm.applicantEmail || rawForm.homeEmail || rawForm.email || dossier?.user?.email || '';
      const effectiveApplicantAddress = rawForm.applicantAddress || rawForm.homeAddress || '';

      setEditingFormData({
        // 1. Spread rawForm FIRST so that any custom extra keys are preserved
        ...rawForm,
        // 2. Then override with the freshest, authoritative values:
        firstName: effectiveFirstName,
        firstNames: effectiveFirstName,
        lastName: effectiveLastName,
        surname: effectiveLastName,
        surnameAtBirth: effectiveBirthSurname,
        birthSurname: effectiveBirthSurname,
        dateOfBirth: effectiveDob,
        birthDate: effectiveDob,
        dob: effectiveDob,
        placeOfBirth: rawForm.placeOfBirth || rawForm.birthPlace || '',
        birthPlace: rawForm.placeOfBirth || rawForm.birthPlace || '',
        countryOfBirth: rawForm.countryOfBirth || rawForm.birthCountry || '',
        birthCountry: rawForm.countryOfBirth || rawForm.birthCountry || '',
        currentNationality: effectiveNationality,
        nationality: effectiveNationality,
        sex: effectiveGender,
        gender: effectiveGender,
        civilStatus: effectiveMarital,
        maritalStatus: effectiveMarital,
        mainPurpose: effectivePurpose,
        purpose: effectivePurpose,
        destinationMemberState: effectiveDestination,
        destination: effectiveDestination,
        firstEntryMemberState: effectiveFirstEntry,
        firstEntry: effectiveFirstEntry,
        numberOfEntries: effectiveEntries,
        entriesRequested: effectiveEntries,
        intendedArrivalDate: effectiveArrival,
        arrivalDate: effectiveArrival,
        intendedDepartureDate: effectiveDeparture,
        departureDate: effectiveDeparture,
        intendedDurationOfStay: effectiveDuration,
        durationOfStay: effectiveDuration,
        fingerprintsCollected: rawForm.fingerprintsCollected || 'no',
        travelDocumentType: effectivePassportType,
        passportType: effectivePassportType,
        travelDocumentNumber: effectivePassport,
        passportNumber: effectivePassport,
        issueDate: rawForm.issueDate || '',
        expirationDate: effectivePassportExpiry,
        passportExpiry: effectivePassportExpiry,
        issuedBy: rawForm.issuedBy || '',
        accommodationType: rawForm.accommodationType || 'hotel',
        hotelName: effectiveHotelName,
        invitingParty: effectiveHotelName,
        hotelAddress: effectiveHotelAddress,
        address: effectiveHotelAddress,
        hotelEmail: effectiveHotelEmail,
        hotelPhone: effectiveHotelPhone,
        costCoveredBy: rawForm.costCoveredBy || 'self',
        meansOfSupport: rawForm.meansOfSupport || '',
        currentOccupation: rawForm.currentOccupation || rawForm.occupation || '',
        employerName: rawForm.employerName || rawForm.organization || '',
        employerAddress: rawForm.employerAddress || '',
        applicantPhone: effectiveApplicantPhone,
        homePhone: effectiveApplicantPhone,
        phone: effectiveApplicantPhone,
        applicantEmail: effectiveApplicantEmail,
        homeEmail: effectiveApplicantEmail,
        email: effectiveApplicantEmail,
        applicantAddress: effectiveApplicantAddress,
        homeAddress: effectiveApplicantAddress,
      });
      setIsEditingInputs(false);
    }
  }, [dossier, selectedApplicantIndex]);

  const handleFieldChange = (field: string, value: any) => {
    setEditingFormData((prev) => {
      const updated: Record<string, any> = { ...prev, [field]: value };
      // Keep aliases automatically in sync
      if (field === 'surname' || field === 'lastName') {
        updated.surname = value;
        updated.lastName = value;
      } else if (field === 'firstNames' || field === 'firstName') {
        updated.firstNames = value;
        updated.firstName = value;
      } else if (field === 'dateOfBirth' || field === 'birthDate' || field === 'dob') {
        updated.dateOfBirth = value;
        updated.birthDate = value;
        updated.dob = value;
      } else if (field === 'travelDocumentNumber' || field === 'passportNumber') {
        updated.travelDocumentNumber = value;
        updated.passportNumber = value;
      } else if (field === 'destinationMemberState' || field === 'destination') {
        updated.destinationMemberState = value;
        updated.destination = value;
      } else if (field === 'firstEntryMemberState' || field === 'firstEntry') {
        updated.firstEntryMemberState = value;
        updated.firstEntry = value;
      } else if (field === 'mainPurpose' || field === 'purpose') {
        updated.mainPurpose = value;
        updated.purpose = value;
      } else if (field === 'numberOfEntries' || field === 'entriesRequested') {
        updated.numberOfEntries = value;
        updated.entriesRequested = value;
      } else if (field === 'intendedArrivalDate' || field === 'arrivalDate') {
        updated.intendedArrivalDate = value;
        updated.arrivalDate = value;
      } else if (field === 'intendedDepartureDate' || field === 'departureDate') {
        updated.intendedDepartureDate = value;
        updated.departureDate = value;
      } else if (field === 'intendedDurationOfStay' || field === 'durationOfStay') {
        updated.intendedDurationOfStay = value;
        updated.durationOfStay = value;
      } else if (field === 'expirationDate' || field === 'passportExpiry') {
        updated.expirationDate = value;
        updated.passportExpiry = value;
      } else if (field === 'sex' || field === 'gender') {
        updated.sex = value;
        updated.gender = value;
      } else if (field === 'currentNationality' || field === 'nationality') {
        updated.currentNationality = value;
        updated.nationality = value;
      } else if (field === 'civilStatus' || field === 'maritalStatus') {
        updated.civilStatus = value;
        updated.maritalStatus = value;
      } else if (field === 'hotelName' || field === 'invitingParty') {
        updated.hotelName = value;
        updated.invitingParty = value;
      } else if (field === 'hotelAddress' || field === 'address') {
        updated.hotelAddress = value;
        updated.address = value;
      } else if (field === 'applicantPhone' || field === 'homePhone' || field === 'phone') {
        updated.applicantPhone = value;
        updated.homePhone = value;
        updated.phone = value;
      } else if (field === 'applicantEmail' || field === 'homeEmail' || field === 'email') {
        updated.applicantEmail = value;
        updated.homeEmail = value;
        updated.email = value;
      } else if (field === 'applicantAddress' || field === 'homeAddress') {
        updated.applicantAddress = value;
        updated.homeAddress = value;
      } else if (field === 'surnameAtBirth' || field === 'birthSurname') {
        updated.surnameAtBirth = value;
        updated.birthSurname = value;
      } else if (field === 'placeOfBirth' || field === 'birthPlace') {
        updated.placeOfBirth = value;
        updated.birthPlace = value;
      } else if (field === 'countryOfBirth' || field === 'birthCountry') {
        updated.countryOfBirth = value;
        updated.birthCountry = value;
      } else if (field === 'travelDocumentType' || field === 'passportType') {
        updated.travelDocumentType = value;
        updated.passportType = value;
      }
      return updated;
    });
  };

  const handleSaveApplicantInputs = async () => {
    const curApp = dossier?.applicants?.[selectedApplicantIndex] || dossier?.applicants?.[0];
    if (!id || !curApp?.id) return;

    setIsSavingInputs(true);
    try {
      const res: any = await dossierService.updateApplicantForm(id, curApp.id, editingFormData);
      const savedApplicant = res?.data?.applicant || res?.data?.data?.applicant;

      // Update local dossier applicants array immediately for instant UI responsiveness
      if (dossier && dossier.applicants) {
        setDossier((prev) => {
          if (!prev) return null;
          const updatedApps = (prev.applicants || []).map((app, idx) => {
            if (app.id === curApp.id || (idx === selectedApplicantIndex && !app.id)) {
              return {
                ...app,
                firstName: editingFormData.firstName || editingFormData.firstNames || app.firstName,
                lastName: editingFormData.lastName || editingFormData.surname || app.lastName,
                passportNumber: editingFormData.passportNumber || editingFormData.travelDocumentNumber || app.passportNumber,
                birthDate: editingFormData.dateOfBirth || editingFormData.birthDate || app.birthDate,
                nationality: editingFormData.nationality || editingFormData.currentNationality || app.nationality,
                gender: editingFormData.gender || editingFormData.sex || app.gender,
                formDataJson: {
                  ...(app.formDataJson && typeof app.formDataJson === 'object' ? app.formDataJson : {}),
                  ...editingFormData,
                },
                ...(savedApplicant || {}),
              };
            }
            return app;
          });
          return {
            ...prev,
            applicants: updatedApps,
          };
        });
      }

      showSuccess(`Application inputs saved successfully for ${editingFormData.firstName || curApp.firstName} ${editingFormData.lastName || curApp.lastName}`);
      setIsEditingInputs(false);
      await fetchDossierData();
    } catch (err: any) {
      console.error('Failed to save applicant inputs:', err);
      showError(err.message || 'Failed to save applicant inputs.');
    } finally {
      setIsSavingInputs(false);
    }
  };

  const runDossierExport = async (endpoint: string, fallbackFileName: string, successMsg: string, errorMsg: string) => {
    setIsExporting(true);
    try {
      await downloadFileFromApi(endpoint, fallbackFileName);
      showSuccess(successMsg);
    } catch (err: any) {
      showError(err?.message || errorMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChecklist = () => {
    if (!id) return;
    const memberCount = dossier?.applicants?.length || 0;
    const msg = memberCount > 1
      ? `Consular document checklist PDF downloaded (${memberCount} members, separate pages).`
      : 'Consular document checklist downloaded.';
    return runDossierExport(
      `/documents/dossier/${id}/export-checklist`,
      `Checklist_${dossier?.dossierNumber || id}.pdf`,
      msg,
      'Failed to export checklist PDF.'
    );
  };

  const handleExportSummary = () => {
    if (!id) return;
    return runDossierExport(
      `/dossiers/${id}/summary-pdf?download=true`,
      `Dossier_Summary_${dossier?.dossierNumber || id}.pdf`,
      'Dossier summary PDF downloaded successfully.',
      'Failed to generate summary PDF.'
    );
  };

  const handleExportSchengenPdf = () => {
    if (!id) return;
    const currentApplicant = dossier?.applicants?.[selectedApplicantIndex] || dossier?.applicants?.[0];
    if (!currentApplicant) {
      showError('No applicant available for Schengen PDF generation.');
      return;
    }
    const safeFirst = String(currentApplicant.firstName || 'Applicant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeLast = String(currentApplicant.lastName || 'Form').replace(/[^a-zA-Z0-9_-]/g, '_');
    return runDossierExport(
      `/dossiers/${id}/applicants/${currentApplicant.id}/application-pdf?download=true`,
      `Harmonized_Schengen_Form_${safeFirst}_${safeLast}.pdf`,
      `Harmonized Schengen PDF generated for ${currentApplicant.firstName || ''} ${currentApplicant.lastName || ''}.`.trim(),
      'Failed to generate Schengen form PDF.'
    );
  };

  const handleExportArchiveZip = () => {
    if (!id) return;
    return runDossierExport(
      `/dossiers/${id}/archive-zip?download=true`,
      `Dossier_Archive_${dossier?.dossierNumber || id}.zip`,
      'Dossier Archive ZIP package generated and downloaded.',
      'Failed to generate Archive ZIP.'
    );
  };

  if (loading) {
    return (
      <div className="dossier-detail-loading">
        <div className="spinner"></div>
        <p>Loading dossier examination workspace...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="dossier-detail-error">
        <h2>Dossier not found</h2>
        <p>The requested visa application record does not exist or has been removed.</p>
        <button className="btn-action-primary" onClick={() => navigate('/admin/dossiers')}>
          Return to All Dossiers
        </button>
      </div>
    );
  }

  const primaryApplicant = dossier.applicants?.[0];
  const activeApplicant = dossier.applicants?.[selectedApplicantIndex] || dossier.applicants?.[0];
  const allDocuments = dossier.documents || [];
  const verifiedCount = allDocuments.filter(d => d.status === 'VERIFIED').length;
  const correctionCount = allDocuments.filter(d => d.status === 'NEEDS_CORRECTION').length;
  const isGroupOrCorporate = dossier.portalType === 'GROUP_AGENT' || dossier.portalType === 'CORPORATE' || !!dossier.groupBatch;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'badge-approved';
      case 'REJECTED': return 'badge-rejected';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'NEEDS_CORRECTION': return 'badge-warning';
      case 'SUBMITTED_TO_CONSULATE': return 'badge-consulate';
      default: return 'badge-received';
    }
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="doc-pill pill-verified">Verified</span>;
      case 'NEEDS_CORRECTION':
        return <span className="doc-pill pill-correction">Action Required</span>;
      case 'REJECTED':
        return <span className="doc-pill pill-rejected">Rejected</span>;
      default:
        return <span className="doc-pill pill-pending">Pending Review</span>;
    }
  };

  return (
    <div className="admin-dossier-detail-view">
      {/* --- TOP BREADCRUMB & ACTIONS --- */}
      <div className="detail-top-nav">
        <button className="btn-back" onClick={() => navigate('/admin/dossiers')}>
          Back to Dossier Registry
        </button>
        <div className="top-nav-actions">
          <button
            className="btn-secondary"
            onClick={handleExportSchengenPdf}
            disabled={isExporting}
            title={activeApplicant ? `Generate Harmonized 37-point Schengen PDF for ${activeApplicant.firstName} ${activeApplicant.lastName}` : 'Generate Harmonized 37-point Schengen PDF'}
          >
            Harmonized Schengen PDF
          </button>
          <button className="btn-secondary" onClick={handleExportArchiveZip} disabled={isExporting} title="Package dossier files, summary & checklist into a ZIP archive">
            Archive ZIP
          </button>
          <button className="btn-secondary" onClick={handleExportSummary} disabled={isExporting} title="Download official dossier summary PDF">
            Summary PDF
          </button>
          <button
            className="btn-secondary"
            onClick={handleExportChecklist}
            disabled={isExporting}
            title={isGroupOrCorporate ? 'Export unified checklist PDF (separate page per group member)' : 'Export document checklist PDF'}
          >
            Export Checklist
          </button>
          <button className="btn-consular-decision" onClick={() => setIsDecisionModalOpen(true)}>
            Consular Decision
          </button>
        </div>
      </div>

      {/* --- DOSSIER HERO CARD --- */}
      <div className="dossier-hero-card">
        <div className="hero-left">
          <div className="dossier-header-title">
            <span className="hero-jurisdiction">
              {dossier.country?.nameEn} Consular Review
            </span>
            <h1>{dossier.dossierNumber}</h1>
          </div>
          <div className="hero-meta-strip">
            <span className={`admin-badge ${getStatusBadgeClass(dossier.status)}`}>
              {dossier.status.replace(/_/g, ' ')}
            </span>
            <span className="hero-sep">•</span>
            <span className="hero-channel">Channel: <strong>{dossier.portalType}</strong></span>
            <span className="hero-sep">•</span>
            <span className="hero-date">Registered: {new Date(dossier.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="hero-stat-box">
            <span className="box-label">Verified Documents</span>
            <span className="box-val text-emerald">{verifiedCount} / {allDocuments.length}</span>
            {correctionCount > 0 && <span className="box-sub text-amber">{correctionCount} Needs Correction</span>}
          </div>
          <div className="hero-stat-box">
            <span className="box-label">Total Consular Fees</span>
            <span className="box-val">€{dossier.totalAmount}</span>
            <span className="box-sub">Status: {dossier.paymentStatus}</span>
          </div>
        </div>
      </div>

      {/* --- GROUP DELEGATION BANNER (FOR CORPORATE & AGENT GROUPS) --- */}
      {isGroupOrCorporate && (
        <div className="group-delegation-card">
          <div className="delegation-header">
            <div className="delegation-titles">
              <span className="delegation-type-badge">
                {dossier.portalType === 'CORPORATE' ? 'Corporate Mobility Delegation' : 'Travel Agency Group'}
              </span>
              <h3>
                {dossier.groupBatch?.name || (dossier.portalType === 'CORPORATE' ? 'Corporate Employee Delegation' : 'Group Tour Delegation')}
              </h3>
            </div>
            <div className="delegation-meta-tags">
              <span className="meta-tag">Code: <strong>{dossier.groupBatch?.code || '—'}</strong></span>
              <span className="meta-tag">Company: <strong>{dossier.user?.companyName || dossier.user?.fullName || '—'}</strong></span>
              <span className="meta-tag">Destination: <strong>{dossier.groupBatch?.destination || dossier.country?.nameEn}</strong></span>
              {dossier.groupBatch?.travelDate && (
                <span className="meta-tag">Travel Date: <strong>{dossier.groupBatch.travelDate}</strong></span>
              )}
              <span className="meta-tag pax-badge">Delegation Size: <strong>{dossier.applicants?.length || 1} applicants</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK DETAILS BAR --- */}
      <div className="dossier-summary-bar">
        <div className="summary-col">
          <span className="col-label">PRIMARY APPLICANT</span>
          <strong>{primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : dossier.user?.fullName}</strong>
          <span>Passport: {primaryApplicant?.passportNumber || '—'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">DESTINATION / CATEGORY</span>
          <strong>{dossier.country?.nameEn || 'Schengen Area'}</strong>
          <span>{dossier.visaCategory?.nameEn || 'Visa'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">BIOMETRIC APPOINTMENT</span>
          <strong>
            {dossier.appointmentDate 
              ? new Date(dossier.appointmentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : 'Not Scheduled'}
          </strong>
          <span>{dossier.appointmentLocation || 'EuroTech Main Biometrics Center'}</span>
        </div>
        <div className="summary-col">
          <span className="col-label">REGISTERED USER / CONTACT</span>
          <strong>{dossier.user?.email || '—'}</strong>
          <span>{dossier.user?.phone || 'No phone recorded'}</span>
        </div>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="detail-tabs-header">
        <button
          className={`detail-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Document Examination Desk ({allDocuments.length})
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'applicant' ? 'active' : ''}`}
          onClick={() => setActiveTab('applicant')}
        >
          Consular Application Questionnaire
        </button>
        <button
          className={`detail-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Audit Trail & Status History ({dossier.statusHistory?.length || 0})
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="detail-tab-content">
        {/* TAB 1: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="tab-pane-documents">
            <div className="docs-section-header">
              <div>
                <h3>Mandatory Document Checklist</h3>
                <p>Click on any document card to inspect the file preview and record official verification decisions.</p>
              </div>
            </div>

            {allDocuments.length === 0 ? (
              <div className="empty-docs-box">
                <p>No documents uploaded for this application yet.</p>
              </div>
            ) : (
              <div className="docs-grid">
                {allDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="admin-doc-card"
                    onClick={() => setSelectedDocForReview(doc)}
                  >
                    <div className="doc-card-top">
                      <div className="doc-icon-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      {getDocStatusBadge(doc.status)}
                    </div>
                    <div className="doc-card-title">
                      <h4>{doc.requiredDocumentType.replace(/_/g, ' ')}</h4>
                      <p title={doc.fileName}>{doc.fileName}</p>
                    </div>
                    {doc.operatorNotes && (
                      <div className="doc-notes-preview">
                        <strong>Note:</strong> {doc.operatorNotes}
                      </div>
                    )}
                    <div className="doc-card-footer">
                      <span className="doc-size">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                      <button className="btn-examine-doc">
                        Examine & Verify
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLICANT FORM & QUESTIONNAIRE TUNING */}
        {activeTab === 'applicant' && (
          <div className="tab-pane-questionnaire">
            <div className="questionnaire-top-action-bar">
              <div className="questionnaire-header">
                <h3>Harmonized Schengen Questionnaire (37 Points)</h3>
                <p>Review, tune, and regulate applicant biometric details and consular answers.</p>
              </div>

              <div className="questionnaire-action-controls">
                {activeApplicant && (
                  <button
                    type="button"
                    className="btn-open-workspace"
                    onClick={() => navigate(`/admin/dossiers/${dossier.id}/applicant/${activeApplicant.id}`)}
                    title="Open full interactive Schengen 37-point workspace with live verification"
                  >
                    Open 37-Point Workspace
                  </button>
                )}

                {!isEditingInputs ? (
                  <button
                    type="button"
                    className="btn-edit-inputs"
                    onClick={() => setIsEditingInputs(true)}
                  >
                    Tune / Edit Inputs
                  </button>
                ) : (
                  <div className="edit-mode-btn-group">
                    <button
                      type="button"
                      className="btn-cancel-edit"
                      onClick={() => setIsEditingInputs(false)}
                      disabled={isSavingInputs}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-save-inputs"
                      onClick={handleSaveApplicantInputs}
                      disabled={isSavingInputs}
                    >
                      {isSavingInputs ? 'Saving to Database...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Applicant Selector Bar for Groups & Multi-Applicant Applications */}
            {dossier.applicants && dossier.applicants.length > 0 && (
              <div className="applicant-selector-bar">
                <span className="applicant-selector-label">
                  {isGroupOrCorporate ? 'Delegation Member:' : 'Applicant:'}
                </span>
                <div className="applicant-pills-list">
                  {dossier.applicants.map((app, idx) => (
                    <button
                      key={app.id || idx}
                      type="button"
                      className={`app-pill-btn ${selectedApplicantIndex === idx ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedApplicantIndex(idx);
                        setIsEditingInputs(false);
                      }}
                    >
                      <span className="pill-index">{idx + 1}.</span>
                      <span className="pill-name">{app.firstName} {app.lastName}</span>
                      {app.passportNumber && <span className="pill-pass">({app.passportNumber})</span>}
                      {idx === 0 && <span className="pill-primary-tag">Primary</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isEditingInputs && (
              <div className="editing-alert-banner">
                <div className="editing-alert-text">
                  <strong>Editing Mode Active:</strong> You are regulating form inputs for{' '}
                  <span>{editingFormData.firstName || activeApplicant?.firstName} {editingFormData.lastName || activeApplicant?.lastName}</span>.
                  Modifications will be permanently saved to the database.
                </div>
                <div className="editing-alert-actions">
                  <button type="button" className="btn-cancel-sm" onClick={() => setIsEditingInputs(false)}>Cancel</button>
                  <button type="button" className="btn-save-sm" onClick={handleSaveApplicantInputs} disabled={isSavingInputs}>
                    {isSavingInputs ? 'Saving...' : 'Save to DB'}
                  </button>
                </div>
              </div>
            )}

            <div className="qa-sections-grid">
              {/* Section 1: Travel Details & Plans */}
              <div className="qa-card">
                <h4>1. Travel Details & Plans (Boxes 21, 23-25, 27-28)</h4>
                <div className="qa-rows">
                  <div className="qa-row">
                    <span className="qa-k">Main Purpose of Journey:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.mainPurpose || ''}
                        onChange={(e) => handleFieldChange('mainPurpose', e.target.value)}
                      >
                        <option value="">Select Purpose</option>
                        <option value="Tourism">Tourism</option>
                        <option value="Business">Business</option>
                        <option value="Visiting family or friends">Visiting family or friends</option>
                        <option value="Cultural">Cultural</option>
                        <option value="Sports">Sports</option>
                        <option value="Official visit">Official visit</option>
                        <option value="Medical reasons">Medical reasons</option>
                        <option value="Study">Study</option>
                        <option value="Transit">Airport transit</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.mainPurpose || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Member State of Destination:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.destinationMemberState || ''}
                        onChange={(e) => handleFieldChange('destinationMemberState', e.target.value)}
                        placeholder="E.g. Germany, Hungary"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.destinationMemberState || dossier.country?.nameEn || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Member State of First Entry:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.firstEntryMemberState || ''}
                        onChange={(e) => handleFieldChange('firstEntryMemberState', e.target.value)}
                        placeholder="E.g. Hungary, Poland"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.firstEntryMemberState || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Number of Entries Requested:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.numberOfEntries || 'Single'}
                        onChange={(e) => handleFieldChange('numberOfEntries', e.target.value)}
                      >
                        <option value="Single">Single Entry</option>
                        <option value="Two">Two Entries</option>
                        <option value="Multiple">Multiple Entries</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.numberOfEntries || 'Single'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Intended Date of Arrival:</span>
                    {isEditingInputs ? (
                      <input
                        type="date"
                        className="qa-input-field"
                        value={editingFormData.intendedArrivalDate || ''}
                        onChange={(e) => handleFieldChange('intendedArrivalDate', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.intendedArrivalDate || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Intended Date of Departure:</span>
                    {isEditingInputs ? (
                      <input
                        type="date"
                        className="qa-input-field"
                        value={editingFormData.intendedDepartureDate || ''}
                        onChange={(e) => handleFieldChange('intendedDepartureDate', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.intendedDepartureDate || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Duration of Intended Stay (Days):</span>
                    {isEditingInputs ? (
                      <input
                        type="number"
                        className="qa-input-field"
                        value={editingFormData.intendedDurationOfStay || ''}
                        onChange={(e) => handleFieldChange('intendedDurationOfStay', e.target.value)}
                        placeholder="E.g. 15"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.intendedDurationOfStay ? `${editingFormData.intendedDurationOfStay} days` : '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Fingerprints Collected Previously:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.fingerprintsCollected || 'no'}
                        onChange={(e) => handleFieldChange('fingerprintsCollected', e.target.value)}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.fingerprintsCollected === 'yes' ? 'Yes' : 'No'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Personal Identification */}
              <div className="qa-card">
                <h4>2. Personal Identification (Boxes 1-11)</h4>
                <div className="qa-rows">
                  <div className="qa-row">
                    <span className="qa-k">Surname (Family name):</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.surname || ''}
                        onChange={(e) => handleFieldChange('surname', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.surname || activeApplicant?.lastName || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Surname at Birth (Former surname):</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.surnameAtBirth || ''}
                        onChange={(e) => handleFieldChange('surnameAtBirth', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.surnameAtBirth || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">First Name(s) (Given names):</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.firstNames || ''}
                        onChange={(e) => handleFieldChange('firstNames', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.firstNames || activeApplicant?.firstName || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Date of Birth:</span>
                    {isEditingInputs ? (
                      <input
                        type="date"
                        className="qa-input-field"
                        value={editingFormData.dateOfBirth || ''}
                        onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.dateOfBirth || (activeApplicant?.birthDate ? String(activeApplicant.birthDate).split('T')[0] : '—')}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Place of Birth:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.placeOfBirth || ''}
                        onChange={(e) => handleFieldChange('placeOfBirth', e.target.value)}
                        placeholder="City of birth"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.placeOfBirth || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Country of Birth:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.countryOfBirth || ''}
                        onChange={(e) => handleFieldChange('countryOfBirth', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.countryOfBirth || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Current Nationality:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.currentNationality || ''}
                        onChange={(e) => handleFieldChange('currentNationality', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.currentNationality || activeApplicant?.nationality || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Sex / Gender:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.sex || editingFormData.gender || ''}
                        onChange={(e) => handleFieldChange('sex', e.target.value)}
                      >
                        <option value="">Select Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.sex || activeApplicant?.gender || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Civil Status:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.civilStatus || ''}
                        onChange={(e) => handleFieldChange('civilStatus', e.target.value)}
                      >
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Separated">Separated</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widow(er)">Widow(er)</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.civilStatus || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Travel Document */}
              <div className="qa-card">
                <h4>3. Travel Document (Passport - Boxes 12-17)</h4>
                <div className="qa-rows">
                  <div className="qa-row">
                    <span className="qa-k">Type of Travel Document:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.travelDocumentType || 'Ordinary Passport'}
                        onChange={(e) => handleFieldChange('travelDocumentType', e.target.value)}
                      >
                        <option value="Ordinary Passport">Ordinary Passport</option>
                        <option value="Diplomatic Passport">Diplomatic Passport</option>
                        <option value="Service Passport">Service Passport</option>
                        <option value="Official Passport">Official Passport</option>
                        <option value="Special Passport">Special Passport</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.travelDocumentType || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Number of Travel Document:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field font-mono"
                        value={editingFormData.travelDocumentNumber || ''}
                        onChange={(e) => handleFieldChange('travelDocumentNumber', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v font-mono">{editingFormData.travelDocumentNumber || activeApplicant?.passportNumber || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Date of Issue:</span>
                    {isEditingInputs ? (
                      <input
                        type="date"
                        className="qa-input-field"
                        value={editingFormData.issueDate || ''}
                        onChange={(e) => handleFieldChange('issueDate', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.issueDate || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Valid Until (Expiration Date):</span>
                    {isEditingInputs ? (
                      <input
                        type="date"
                        className="qa-input-field"
                        value={editingFormData.expirationDate || ''}
                        onChange={(e) => handleFieldChange('expirationDate', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.expirationDate || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Issued By (Country / Authority):</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.issuedBy || ''}
                        onChange={(e) => handleFieldChange('issuedBy', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.issuedBy || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Stay & Financial Solvency */}
              <div className="qa-card">
                <h4>4. Stay & Financial Solvency (Boxes 30-33)</h4>
                <div className="qa-rows">
                  <div className="qa-row">
                    <span className="qa-k">Accommodation Type:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.accommodationType || 'hotel'}
                        onChange={(e) => handleFieldChange('accommodationType', e.target.value)}
                      >
                        <option value="hotel">Hotel / Commercial Accommodation</option>
                        <option value="host">Inviting Individual / Host</option>
                        <option value="company">Inviting Company / Institution</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.accommodationType || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Hotel or Inviting Entity Name:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.hotelName || ''}
                        onChange={(e) => handleFieldChange('hotelName', e.target.value)}
                        placeholder="Hotel name or inviting organization"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.hotelName || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Address in Destination:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.hotelAddress || ''}
                        onChange={(e) => handleFieldChange('hotelAddress', e.target.value)}
                        placeholder="Full street address and city"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.hotelAddress || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Inviting / Hotel Contact Phone:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.hotelPhone || ''}
                        onChange={(e) => handleFieldChange('hotelPhone', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.hotelPhone || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Cost of Travelling Covered By:</span>
                    {isEditingInputs ? (
                      <select
                        className="qa-input-field"
                        value={editingFormData.costCoveredBy || 'self'}
                        onChange={(e) => handleFieldChange('costCoveredBy', e.target.value)}
                      >
                        <option value="self">By the applicant himself/herself</option>
                        <option value="sponsor">By a sponsor (host, company, organisation)</option>
                      </select>
                    ) : (
                      <span className="qa-v">{editingFormData.costCoveredBy === 'sponsor' ? 'By a sponsor / company' : editingFormData.costCoveredBy ? 'By the applicant' : '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Means of Financial Support:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.meansOfSupport || ''}
                        onChange={(e) => handleFieldChange('meansOfSupport', e.target.value)}
                        placeholder="E.g. Credit card, Cash, Prepaid accommodation"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.meansOfSupport || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 5: Contacts & Employment */}
              <div className="qa-card">
                <h4>5. Contacts & Employment (Boxes 18-20)</h4>
                <div className="qa-rows">
                  <div className="qa-row">
                    <span className="qa-k">Current Occupation:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.currentOccupation || ''}
                        onChange={(e) => handleFieldChange('currentOccupation', e.target.value)}
                        placeholder="Job title / profession"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.currentOccupation || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Employer / Organisation Name:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.employerName || ''}
                        onChange={(e) => handleFieldChange('employerName', e.target.value)}
                        placeholder="Company or institution name"
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.employerName || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Employer Address & Phone:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.employerAddress || ''}
                        onChange={(e) => handleFieldChange('employerAddress', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.employerAddress || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Applicant Mobile Phone:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.applicantPhone || ''}
                        onChange={(e) => handleFieldChange('applicantPhone', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.applicantPhone || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Applicant Email Address:</span>
                    {isEditingInputs ? (
                      <input
                        type="email"
                        className="qa-input-field"
                        value={editingFormData.applicantEmail || ''}
                        onChange={(e) => handleFieldChange('applicantEmail', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.applicantEmail || '—'}</span>
                    )}
                  </div>

                  <div className="qa-row">
                    <span className="qa-k">Applicant Home Address:</span>
                    {isEditingInputs ? (
                      <input
                        type="text"
                        className="qa-input-field"
                        value={editingFormData.applicantAddress || ''}
                        onChange={(e) => handleFieldChange('applicantAddress', e.target.value)}
                      />
                    ) : (
                      <span className="qa-v">{editingFormData.applicantAddress || '—'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY */}
        {activeTab === 'history' && (
          <div className="tab-pane-history">
            <div className="history-header">
              <h3>Consular Audit & Status Log</h3>
              <p>Chronological record of status transitions, officer reviews, and notifications.</p>
            </div>

            {!dossier.statusHistory || dossier.statusHistory.length === 0 ? (
              <div className="empty-history-box">
                <p>No status transitions recorded yet for this dossier.</p>
              </div>
            ) : (
              <div className="history-timeline">
                {dossier.statusHistory.map((h) => (
                  <div key={h.id} className="timeline-node">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-title-row">
                        <strong>
                          {h.fromStatus} to <span className="status-highlight">{h.toStatus}</span>
                        </strong>
                        <span className="timeline-time">
                          {new Date(h.createdAt).toLocaleString('en-US')}
                        </span>
                      </div>
                      {h.notes && <p className="timeline-notes">"{h.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- DOCUMENT REVIEW MODAL --- */}
      {selectedDocForReview && (
        <DocumentReviewModal
          document={selectedDocForReview}
          dossierId={dossier.id}
          isOpen={true}
          onClose={() => setSelectedDocForReview(null)}
          onSuccess={() => fetchDossierData()}
        />
      )}

      {/* --- CONSULAR DECISION MODAL --- */}
      {isDecisionModalOpen && (
        <ConsularDecisionModal
          dossierId={dossier.id}
          dossierNumber={dossier.dossierNumber}
          currentStatus={dossier.status}
          isOpen={true}
          onClose={() => setIsDecisionModalOpen(false)}
          onSuccess={(newStatus: DossierStatusType) => {
            setDossier(prev => prev ? { ...prev, status: newStatus } : null);
            fetchDossierData();
          }}
        />
      )}
    </div>
  );
}
