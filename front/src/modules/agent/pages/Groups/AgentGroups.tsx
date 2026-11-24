import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService, appointmentService, documentService, dossierService, paymentService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';
import { downloadRosterTemplate } from '@/shared/utils/excelParser';
import SchengenQuestionnaire from '@/modules/applicant/components/SchengenQuestionnaire/SchengenQuestionnaire';
import { DEFAULT_SCHENGEN_FORM_DATA } from '@/modules/applicant/types/applicant.types';
import { usePricingCatalog } from '@/shared/hooks/usePricingCatalog';
import PromoCodeInput from '@/shared/components/PromoCodeInput/PromoCodeInput';
import type { PromoValidationResult } from '@/shared/api/services/promo.service';
import './AgentGroups.css';

// --- Tiplər ---
export interface ApplicantDoc {
    id: string;
    requiredDocumentType: string;
    fileUrl: string;
    originalFileName?: string;
    status: 'PENDING' | 'VERIFIED' | 'NEEDS_CORRECTION' | 'REJECTED';
    operatorNotes?: string;
    createdAt?: string;
}

export interface Applicant {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    passport: string;
    dob?: string;
    issueDate?: string;
    expiryDate?: string;
    status: 'pending' | 'verified' | 'action_req';
    formProgress: number;
    dossierId: string;
    documents: ApplicantDoc[];
    formDataJson?: any;
}

export interface Group {
    id: string;
    code: string;
    name: string;
    destination: string;
    travelDate: string;
    duration: 'short' | 'long';
    projectReason: string;
    createdDate: string;
    status: 'draft' | 'processing';
    packageTier?: string;
    applicants: Applicant[];
    dossierId?: string;
    paymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED';
    totalFee?: number;
    ratePerPax?: number;
    estimatedCommissionEur?: number;
    appointment?: {
        id: string;
        date?: string;
        startTime?: string;
        status?: string;
        location?: string;
    } | null;
}

const REQUIRED_DOC_TYPES = [
    { type: 'PASSPORT', title: 'Valid Passport Copy', desc: 'Scanned color copy of the primary passport page (clear bio-data and photo).' },
    { type: 'BIOMETRIC_PHOTO', title: 'ICAO Biometric Photograph', desc: 'Recent color photo measuring 3.5 x 4.5 cm with light background, meeting ICAO standards.' },
    { type: 'INSURANCE', title: 'Schengen Travel Medical Insurance', desc: 'Medical insurance certificate covering minimum €30,000 for emergency treatment and repatriation.' },
    { type: 'FLIGHT_ITINERARY', title: 'Roundtrip Flight Reservation', desc: 'Confirmed booking itinerary showing entry and exit dates matching travel parameters.' },
    { type: 'BANK_STATEMENT', title: 'Proof of Financial Solvency', desc: 'Official bank account statement covering the past 3-6 months with bank stamp.' },
];

export default function AgentGroups() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { packages: adminPackages, calculateLiveFees } = usePricingCatalog();
    const activeAdminPackages = (adminPackages || []).filter(p => p.isActive !== false);

    // --- State-lər ---
    const [view, setView] = useState<'list' | 'manage'>('list');
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [activeApplicant, setActiveApplicant] = useState<Applicant | null>(null);
    const [loading, setLoading] = useState(true);

    // Manage View State-ləri
    const [manageTab, setManageTab] = useState<'form' | 'docs' | 'packages'>('form');
    const [currentFormStep, setCurrentFormStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

    // Applicant Form Edit State (Official 37-Point Schengen Questionnaire)
    const [applicantFormData, setApplicantFormData] = useState<Record<string, any>>({
        ...DEFAULT_SCHENGEN_FORM_DATA,
    });

    // Filter & Search State-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [destinationFilter, setDestinationFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal State-ləri (Group Settings)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [groupForSettings, setGroupForSettings] = useState<Group | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupPackage, setEditGroupPackage] = useState('standard');

    // Add Traveler Modal
    const [isAddTravelerOpen, setIsAddTravelerOpen] = useState(false);
    const [targetGroupForTraveler, setTargetGroupForTraveler] = useState<Group | null>(null);
    const [newTravelerData, setNewTravelerData] = useState({
        firstName: '',
        lastName: '',
        passportNumber: '',
        dob: '',
        contactPhone: '',
        contactEmail: '',
    });

    // Group Appointment & Payment Modals
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedGroupForAction, setSelectedGroupForAction] = useState<Group | null>(null);
    const [newAppointmentDate, setNewAppointmentDate] = useState('');
    const [newAppointmentTime, setNewAppointmentTime] = useState('10:00');
    const [newAppointmentLocation, setNewAppointmentLocation] = useState('EuroTech Main Center, Port Baku Towers');
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<'PENDING' | 'PAID' | 'REFUNDED'>('PENDING');
    const [b2bPaymentMethod, setB2bPaymentMethod] = useState<'WALLET' | 'CARD' | 'BANK_SLIP'>('WALLET');
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [slipBankName, setSlipBankName] = useState('ABB (International Bank of Azerbaijan)');
    const [slipSenderName, setSlipSenderName] = useState('');
    const [slipReceiptNumber, setSlipReceiptNumber] = useState('');
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);

    // Hidden file input ref
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [targetUploadType, setTargetUploadType] = useState<string>('');

    // Qrupları Verilənlər Bazasından Yükləmə Funksiyası
    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await agentService.getGroups();
            if (res.data?.groups) {
                const mapped: Group[] = res.data.groups.map((g: any) => {
                    const primaryDossier = g.dossiers?.[0] || {};
                    const primaryDossierId = primaryDossier.id || '';
                    const rawApplicants = g.applicants || primaryDossier.applicants || [];

                    const mappedApplicants: Applicant[] = rawApplicants.map((a: any) => {
                        const docs: ApplicantDoc[] = (a.documents || []).map((d: any) => ({
                            id: d.id,
                            requiredDocumentType: d.requiredDocumentType || d.type || 'DOCUMENT',
                            fileUrl: d.fileUrl,
                            originalFileName: d.originalFileName,
                            status: d.status || 'PENDING',
                            operatorNotes: d.operatorNotes,
                            createdAt: d.createdAt,
                        }));

                        const hasRejected = docs.some(d => d.status === 'REJECTED');
                        const verifiedCount = docs.filter(d => d.status === 'VERIFIED').length;
                        const allVerified = docs.length >= 3 && verifiedCount === docs.length;

                        const applicantStatus: 'verified' | 'pending' | 'action_req' =
                            hasRejected ? 'action_req' : (allVerified ? 'verified' : 'pending');

                        const formProgress = a.formDataJson?.formProgress || (allVerified ? 100 : docs.length > 0 ? 50 : 25);

                        return {
                            id: a.id,
                            fullName: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Traveler',
                            firstName: a.firstName || '',
                            lastName: a.lastName || '',
                            passport: a.passportNumber || 'P0000000',
                            dob: a.birthDate ? String(a.birthDate).split('T')[0] : a.formDataJson?.dob || '',
                            issueDate: a.formDataJson?.issueDate || '',
                            expiryDate: a.formDataJson?.expiryDate || '',
                            status: applicantStatus,
                            formProgress,
                            dossierId: a.dossierId || primaryDossierId,
                            documents: docs,
                            formDataJson: a.formDataJson || {},
                        };
                    });

                    const primaryAppt = g.appointments?.[0] || null;
                    const appointmentData = primaryAppt ? {
                        id: primaryAppt.id,
                        date: primaryAppt.timeSlot?.date ? String(primaryAppt.timeSlot.date).split('T')[0] : (primaryAppt.date ? String(primaryAppt.date).split('T')[0] : 'TBD'),
                        startTime: primaryAppt.timeSlot?.startTime || primaryAppt.startTime || '',
                        status: primaryAppt.status || 'CONFIRMED',
                        location: primaryAppt.location || primaryAppt.timeSlot?.location || 'EuroTech Main Center'
                    } : null;

                    return {
                        id: g.id,
                        code: g.code || g.id,
                        name: g.name,
                        destination: g.destination || 'Europe / Schengen',
                        travelDate: g.travelDate ? String(g.travelDate).split('T')[0] : 'N/A',
                        duration: (g.duration as 'short' | 'long') || 'short',
                        projectReason: g.projectReason || 'Tourism',
                        createdDate: new Date(g.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                        status: (g.status === 'COMPLETED' || g.status === 'PROCESSING') ? 'processing' : 'draft',
                        packageTier: String(g.packageTier || mappedApplicants[0]?.formDataJson?.package || 'standard').toLowerCase(),
                        applicants: mappedApplicants,
                        dossierId: primaryDossierId,
                        paymentStatus: primaryDossier.paymentStatus || 'PENDING',
                        totalFee: Number(g.totalAmount || primaryDossier.totalAmount || primaryDossier.totalFee || (mappedApplicants.length * 145) || 145),
                        ratePerPax: Number(g.ratePerPax || 20),
                        estimatedCommissionEur: Number(g.estimatedCommissionEur ?? (mappedApplicants.length * Number(g.ratePerPax || 20))),
                        appointment: appointmentData,
                    };
                });
                setGroups(mapped);
            }
        } catch (err: any) {
            console.error('Failed to load agent groups from DB:', err);
            showError('Qrup məlumatlarını verilənlər bazasından yükləmək mümkün olmadı.');
        } finally {
            setLoading(false);
        }
    };

    // İlk yüklənmə
    useEffect(() => {
        fetchGroups();
    }, []);

    // Hesablanmış Metrikalar (KPIs)
    const stats = useMemo(() => {
        const totalGroups = groups.length;
        const totalApplicants = groups.reduce((acc, g) => acc + g.applicants.length, 0);
        const verifiedApplicants = groups.reduce((acc, g) => 
            acc + g.applicants.filter(a => a.status === 'verified').length, 0
        );
        const actionReqCount = groups.reduce((acc, g) => 
            acc + g.applicants.filter(a => a.status === 'action_req').length, 0
        );
        const ratePerPax = groups[0]?.ratePerPax || 20;
        const estimatedCommission = groups.reduce(
            (acc, g) => acc + (g.estimatedCommissionEur ?? g.applicants.length * ratePerPax),
            0
        );

        return {
            totalGroups,
            totalApplicants,
            verifiedApplicants,
            actionReqCount,
            ratePerPax,
            estimatedCommission,
            readinessRate: totalApplicants > 0 ? Math.round((verifiedApplicants / totalApplicants) * 100) : 0
        };
    }, [groups]);

    // Mövcud Ölkələr siyahısı
    const destinations = useMemo(() => {
        const set = new Set<string>();
        groups.forEach(g => set.add(g.destination));
        return Array.from(set);
    }, [groups]);

    // Filtrlənmiş Qruplar
    const filteredGroups = useMemo(() => {
        return groups.filter(g => {
            const matchesQuery = searchQuery === '' || 
                g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.applicants.some(a => a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || a.passport.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesDest = destinationFilter === 'ALL' || g.destination.toLowerCase() === destinationFilter.toLowerCase();
            const matchesStatus = statusFilter === 'ALL' || g.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesQuery && matchesDest && matchesStatus;
        });
    }, [groups, searchQuery, destinationFilter, statusFilter]);

    // --- Funksiyalar (Aksiyalar) ---
    const handleManageApplicant = (group: Group, applicant: Applicant) => {
        setActiveGroup(group);
        setActiveApplicant(applicant);
        const savedForm = (applicant.formDataJson && typeof applicant.formDataJson === 'object') ? applicant.formDataJson : {};
        const nameParts = (applicant.fullName || '').trim().split(' ');
        setApplicantFormData({
            ...DEFAULT_SCHENGEN_FORM_DATA,
            ...savedForm,
            firstName: applicant.firstName || savedForm.firstName || nameParts[0] || '',
            lastName: applicant.lastName || savedForm.lastName || nameParts.slice(1).join(' ') || '',
            passportNumber: applicant.passport || savedForm.passportNumber || '',
            birthDate: applicant.dob || savedForm.birthDate || '',
            passportExpiry: applicant.expiryDate || savedForm.passportExpiry || '',
            destination: group.destination || savedForm.destination || 'Hungary',
        });
        setManageTab('form');
        setCurrentFormStep(1);
        setView('manage');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveGroup(null);
        setActiveApplicant(null);
    };

    // Qrupun Emala Göndərilməsi (Real DB Submit)
    const handleSubmitGroup = async (groupId: string) => {
        try {
            const res: any = await agentService.submitGroup(groupId);
            const credited = Number(res.data?.commissionCredited || 0);
            const pending = Number(res.data?.commissionPending || 0);
            if (credited > 0) {
                showSuccess(`Qrup rəsmi emala göndərildi! Qazanılan komissiya: €${credited.toFixed(2)} balansınıza əlavə edildi.`);
            } else {
                showSuccess(`Qrup rəsmi emala göndərildi! €${pending.toFixed(2)} gözləmədədir (komissiyanın açılması üçün qrup rüsumunu ödəyin).`);
            }
            await fetchGroups();
        } catch (e: any) {
            console.error('Group submit error:', e);
            showError(e.message || 'Qrupu emala göndərmək mümkün olmadı.');
        }
    };

    // Rəsmi Konsulluq Manifesti (PDF) Yükləməsi
    const handleDownloadManifest = async (group: Group) => {
        showSuccess(`${group.name} (${group.code}) üçün rəsmi konsulluq manifesti hazırlanır...`);
        try {
            const res = await appointmentService.generateManifestPdf({
                groupBatchId: group.id,
                groupInfo: {
                    id: group.code,
                    name: group.name,
                    size: group.applicants.length,
                    package: 'Official Group Manifest',
                    applicants: group.applicants.map(a => ({
                        name: a.fullName,
                        passport: a.passport,
                        docsStatus: a.status === 'verified' ? 'Verified' : 'Pending',
                    })),
                },
            });

            const downloadUrl = res.data?.fileUrl || (res.data?.fileName ? `/uploads/${res.data.fileName}` : null);
            if (downloadUrl) {
                const fullUrl = getFileUrl(downloadUrl);
                const fileRes = await fetch(fullUrl);
                const blob = await fileRes.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = res.data?.fileName || `manifest_${group.code}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                showSuccess('Rəsmi Konsulluq Manifesti (PDF) uğurla endirildi!');
            }
        } catch (e: any) {
            showError(e.message || 'Manifest PDF faylını endirmək mümkün olmadı.');
        }
    };

    const handleDownloadApplicantSchengenPdf = async (group: Group, applicant: Applicant) => {
        try {
            showSuccess(`${applicant.fullName} üçün rəsmi Şengen vizası ərizə forması (PDF) hazırlanır...`);
            const dossierId = group.dossierId || group.id;
            const res = await dossierService.getApplicationFormPdf(dossierId, applicant.id, {
                ...(applicant.formDataJson || {}),
                firstName: applicant.firstName,
                lastName: applicant.lastName,
                passportNumber: applicant.passport,
                birthDate: applicant.dob,
                issueDate: applicant.issueDate,
                passportExpiry: applicant.expiryDate,
                destination: group.destination,
                purpose: group.projectReason || 'Tourism',
                arrivalDate: group.travelDate,
            });

            if (res.data?.downloadUrl) {
                const fullUrl = getFileUrl(res.data.downloadUrl);
                
                const fileRes = await fetch(fullUrl);
                if (!fileRes.ok) throw new Error(`Status ${fileRes.status}`);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = res.data.fileName || `Schengen_Form_${applicant.firstName}_${applicant.lastName}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess(`${applicant.fullName} üçün Şengen forması (PDF) uğurla endirildi!`);
            }
        } catch (err: any) {
            console.error('Schengen PDF error:', err);
            showError('Şengen PDF formasını yükləmək mümkün olmadı.');
        }
    };

    // Sərnişin Anket Məlumatlarının Saxlanması (Real DB Update)
    const handleSaveForm = async (e?: React.FormEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!activeGroup || !activeApplicant) return;

        setIsSaving(true);
        try {
            await agentService.saveApplicantForm(activeGroup.id, activeApplicant.id, applicantFormData);

            // Update local state
            setActiveApplicant(prev => prev ? {
                ...prev,
                firstName: applicantFormData.firstName,
                lastName: applicantFormData.lastName,
                fullName: `${applicantFormData.firstName} ${applicantFormData.lastName}`.trim(),
                passport: applicantFormData.passportNumber,
                dob: applicantFormData.birthDate || applicantFormData.dob,
                expiryDate: applicantFormData.passportExpiry || applicantFormData.expiryDate,
                formDataJson: { ...prev.formDataJson, ...applicantFormData },
                formProgress: 100,
            } : null);

            showSuccess('Traveler Schengen application (37 points) saved successfully!');
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Anket məlumatlarını saxlamaq mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Real Sənəd Yükləməsi (Real DB File Upload)
    const triggerUpload = (docType: string) => {
        setTargetUploadType(docType);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeApplicant) return;

        setUploadingDocType(targetUploadType);
        try {
            await documentService.uploadDocument({
                dossierId: activeApplicant.dossierId,
                applicantId: activeApplicant.id,
                requiredDocumentType: targetUploadType,
                isMandatory: true,
                file,
            });

            showSuccess(`${targetUploadType} sənədi uğurla sistemə yükləndi və bazada qeydiyyata alındı!`);
            await fetchGroups();

            // Refresh active applicant documents
            const updatedGroupRes = await agentService.getGroupById(activeGroup?.id || '');
            if (updatedGroupRes.data?.group) {
                const refreshedGroup = updatedGroupRes.data.group;
                const foundApp = refreshedGroup.dossiers?.[0]?.applicants?.find((a: any) => a.id === activeApplicant.id);
                if (foundApp) {
                    setActiveApplicant(prev => prev ? {
                        ...prev,
                        documents: foundApp.documents || [],
                    } : null);
                }
            }
        } catch (err: any) {
            console.error('File upload error:', err);
            showError(err.message || 'Faylı yükləmək mümkün olmadı.');
        } finally {
            setUploadingDocType(null);
            setTargetUploadType('');
        }
    };

    // Sərnişinin Qrupdan Silinməsi (Real DB Delete)
    const handleDeleteApplicant = async (applicantId: string) => {
        if (!activeGroup) return;
        if (!confirm('Bu sərnişini qrupdan və verilənlər bazasından silmək istədiyinizə əminsiniz?')) return;
        try {
            await agentService.removeApplicant(activeGroup.id, applicantId);
            showSuccess('Sərnişin qrupdan və verilənlər bazasından uğurla silindi.');
            await fetchGroups();
            if (activeApplicant?.id === applicantId) {
                handleBackToList();
            }
        } catch (e: any) {
            showError(e.message || 'Sərnişini silmək mümkün olmadı.');
        }
    };

    // Sənədi Açmaq / Baxmaq (View Document)
    const handleViewDoc = (doc: ApplicantDoc) => {
        if (!doc.fileUrl) {
            showError('Sənəd faylı tapılmadı.');
            return;
        }
        const fullUrl = getFileUrl(doc.fileUrl);
        window.open(fullUrl, '_blank');
    };

    // Sənədi Bazadan Silmək (Remove Document)
    const handleRemoveDoc = async (doc: ApplicantDoc) => {
        if (!confirm('Bu sənədi silmək istədiyinizə əminsiniz?')) return;
        try {
            await documentService.deleteDocument(doc.id);
            showSuccess('Sənəd uğurla silindi.');
            await fetchGroups();

            // Refresh active applicant documents
            if (activeGroup && activeApplicant) {
                const updatedGroupRes = await agentService.getGroupById(activeGroup.id);
                if (updatedGroupRes.data?.group) {
                    const refreshedGroup = updatedGroupRes.data.group;
                    const foundApp = refreshedGroup.dossiers?.[0]?.applicants?.find((a: any) => a.id === activeApplicant.id);
                    if (foundApp) {
                        setActiveApplicant(prev => prev ? {
                            ...prev,
                            documents: foundApp.documents || [],
                        } : null);
                    }
                }
            }
        } catch (e: any) {
            console.error('Doc remove error:', e);
            showError(e.message || 'Sənədi silmək mümkün olmadı.');
        }
    };

    // Yeni Sərnişin Əlavə Etmə Modalı
    const openAddTravelerModal = (group: Group) => {
        setTargetGroupForTraveler(group);
        setNewTravelerData({
            firstName: '',
            lastName: '',
            passportNumber: '',
            dob: '',
            contactPhone: '',
            contactEmail: '',
        });
        setIsAddTravelerOpen(true);
    };

    const handleSaveNewTraveler = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetGroupForTraveler) return;
        if (!newTravelerData.firstName.trim() || !newTravelerData.lastName.trim() || !newTravelerData.passportNumber.trim()) {
            showError('Zəhmət olmasa Ad, Soyad və Pasport nömrəsini daxil edin.');
            return;
        }

        setIsSaving(true);
        try {
            const res: any = await agentService.addApplicant(targetGroupForTraveler.id, {
                firstName: newTravelerData.firstName.trim(),
                lastName: newTravelerData.lastName.trim(),
                passportNumber: newTravelerData.passportNumber.trim().toUpperCase(),
                dob: newTravelerData.dob || undefined,
                formData: {
                    dob: newTravelerData.dob,
                    contactPhone: newTravelerData.contactPhone,
                    contactEmail: newTravelerData.contactEmail,
                },
            });
            const createdApplicant = res.data?.data?.applicant || res.data?.applicant;
            const targetDossierId = createdApplicant?.dossierId || targetGroupForTraveler.dossierId || targetGroupForTraveler.id;
            const groupId = targetGroupForTraveler.id;

            showSuccess(`${newTravelerData.firstName} ${newTravelerData.lastName} qrupa uğurla əlavə edildi!`);
            setIsAddTravelerOpen(false);
            setTargetGroupForTraveler(null);
            await fetchGroups();
        } catch (err: any) {
            console.error('Add traveler error:', err);
            showError(err.message || 'Yeni sərnişini qrupa əlavə etmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Qrup Görüş Tarixi Təyini
    const openAppointmentModal = (group: Group) => {
        setSelectedGroupForAction(group);
        setNewAppointmentDate(group.appointment?.date && group.appointment.date !== 'TBD' ? group.appointment.date : '');

        let timeVal = '10:00';
        if (group.appointment?.startTime) {
            const raw = group.appointment.startTime.trim();
            const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (m) {
                let h = parseInt(m[1], 10);
                const min = m[2];
                const mer = m[3]?.toUpperCase();
                if (mer === 'PM' && h < 12) h += 12;
                if (mer === 'AM' && h === 12) h = 0;
                timeVal = `${String(h).padStart(2, '0')}:${min}`;
            } else {
                timeVal = raw;
            }
        }
        setNewAppointmentTime(timeVal);
        setNewAppointmentLocation(group.appointment?.location || 'EuroTech Main Center, Port Baku Towers');
        setIsAppointmentModalOpen(true);
    };

    const handleSaveGroupAppointment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupForAction) return;
        if (!newAppointmentDate) {
            showError('Zəhmət olmasa görüş tarixini seçin.');
            return;
        }

        setIsSaving(true);
        try {
            await agentService.setGroupAppointment(selectedGroupForAction.id, {
                appointmentDate: newAppointmentDate,
                appointmentTime: newAppointmentTime,
                location: newAppointmentLocation,
            });
            showSuccess('Qrupun görüş tarixi və vaxtı uğurla yeniləndi!');
            setIsAppointmentModalOpen(false);
            await fetchGroups();
        } catch (err: any) {
            console.error('Set appointment error:', err);
            showError(err.message || 'Görüş tarixini təyin etmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Qrup Ödəniş və Bank Qəbzi Modalı
    const openPaymentModal = async (group: Group) => {
        setSelectedGroupForAction(group);
        setSelectedPaymentStatus(group.paymentStatus || 'PENDING');
        setAppliedPromo(null);
        setSlipFile(null);
        setSlipReceiptNumber(`GRP-${group.code}`);
        const amountEur = group.totalFee || (group.applicants.length * 145) || 145;
        setIsPaymentModalOpen(true);

        try {
            const res: any = await agentService.getWallet();
            const w = res?.data?.wallet || res?.wallet || res?.data;
            const bal = Number(w?.balance || 0);
            setWalletBalance(bal);
            setB2bPaymentMethod(bal >= amountEur ? 'WALLET' : 'CARD');
        } catch {
            setB2bPaymentMethod('CARD');
        }
    };

    const selectedGroupGrossFee = selectedGroupForAction
        ? selectedGroupForAction.totalFee || (selectedGroupForAction.applicants.length * 145) || 145
        : 0;
    const selectedGroupEffectiveFee = appliedPromo ? appliedPromo.finalAmountEur : selectedGroupGrossFee;

    const handleExecuteB2BPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupForAction) return;

        setIsSaving(true);
        try {
            const amountEur = selectedGroupEffectiveFee;
            const promoCodeStr = appliedPromo?.promo?.code || undefined;

            if (b2bPaymentMethod === 'WALLET') {
                await agentService.payGroupWithWallet(selectedGroupForAction.id, { promoCode: promoCodeStr });
                showSuccess(
                    amountEur <= 0
                        ? `Qrup promo kod (${promoCodeStr}) ilə €0.00 ödənişlə bağlandı!`
                        : `Qrup rüsumu (€${amountEur.toFixed(2)}) Agency Wallet balansından ödənildi${promoCodeStr ? ` (Promo ${promoCodeStr})` : ''}!`
                );
                setAppliedPromo(null);
                setIsPaymentModalOpen(false);
                await fetchGroups();
            } else if (b2bPaymentMethod === 'BANK_SLIP') {
                if (!slipFile && !slipReceiptNumber.trim()) {
                    showError('Zəhmət olmasa qəbz nömrəsini daxil edin və ya bank köçürmə qəbzini yükləyin.');
                    setIsSaving(false);
                    return;
                }

                const fd = new FormData();
                fd.append('groupBatchId', selectedGroupForAction.id);
                if (selectedGroupForAction.dossierId) {
                    fd.append('dossierId', selectedGroupForAction.dossierId);
                }
                fd.append('amount', amountEur.toFixed(2));
                fd.append('currency', 'EUR');
                fd.append('bankName', slipBankName);
                fd.append('senderName', slipSenderName || 'Turizm Agentliyi');
                fd.append('referenceCode', slipReceiptNumber || `GRP-SLIP-${Date.now()}`);
                fd.append('receiptNumber', slipReceiptNumber || `GRP-SLIP-${Date.now()}`);
                fd.append('purpose', `GROUP_BATCH_PAYMENT (${selectedGroupForAction.code})`);
                fd.append('scope', 'GROUP_BATCH_PAYMENT');
                if (promoCodeStr) {
                    fd.append('promoCode', promoCodeStr);
                }
                if (slipFile) {
                    fd.append('slip', slipFile);
                }

                await paymentService.submitBankSlip(fd);
                showSuccess(`Qrup üzrə bank köçürmə qəbzi (€${amountEur.toFixed(2)}) uğurla təqdim olundu! Mühasibatlıq təsdiqindən sonra konsulluq emalına icazə veriləcək.`);
                setAppliedPromo(null);
                setIsPaymentModalOpen(false);
                setSlipFile(null);
                await fetchGroups();
            } else {
                // Online B2B Card Payment
                const intent = await paymentService.createPaymentIntent({
                    groupBatchId: selectedGroupForAction.id,
                    amount: amountEur,
                    currency: 'EUR',
                    purpose: 'GROUP_BATCH_PAYMENT',
                    scope: 'GROUP_BATCH_PAYMENT',
                    promoCode: promoCodeStr,
                });
                if (!intent?.zeroDueSettled && intent?.paymentIntentId) {
                    await paymentService.confirmPaymentMock({
                        paymentIntentId: intent.paymentIntentId,
                        bankReference: `B2B-CARD-${Date.now()}`,
                    });
                }
                showSuccess(
                    amountEur <= 0
                        ? `Qrup promo kod (${promoCodeStr}) ilə €0.00 ödənişlə bağlandı!`
                        : `Qrup üzrə €${amountEur.toFixed(2)} məbləğində B2B kart ödənişi təsdiqləndi${promoCodeStr ? ` (Promo ${promoCodeStr})` : ''}!`
                );
                setAppliedPromo(null);
                setIsPaymentModalOpen(false);
                await fetchGroups();
            }
        } catch (err: any) {
            console.error('B2B payment processing error:', err);
            const msg = err?.response?.data?.message || err.message || 'Ödəniş qeydə alınarkən xəta baş verdi.';
            if (/already.*settled|already.*paid/i.test(msg)) {
                setAppliedPromo(null);
                setIsPaymentModalOpen(false);
                showSuccess('Bu qrup artıq ödənilib! Siyahı yenilənir...');
                await fetchGroups();
            } else {
                showError(msg);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Müştəri üçün Self-Fill Link Kopyalama
    const handleCopySelfFillLink = (group: Group, app: Applicant) => {
        const link = `${window.location.origin}/agent/applicant-fill?groupId=${group.id}&applicantId=${app.id}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link);
        }
        showSuccess(`Müştəri linki kopyalandı! Bu linki sərnişinə göndərə bilərsiniz:\n${link}`);
    };

    // Modal Funksiyaları (Settings)
    const openSettings = (group: Group) => {
        setGroupForSettings(group);
        setEditGroupName(group.name);
        setEditGroupPackage(group.packageTier || 'standard');
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
        setTimeout(() => {
            setGroupForSettings(null);
            setEditGroupName('');
        }, 300);
    };

    // Qrup Adının və Ödəniş Paketinin Yenilənməsi (Real DB Update)
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupForSettings) return;

        setIsSaving(true);
        try {
            await agentService.updateGroup(groupForSettings.id, {
                name: editGroupName,
                packageTier: editGroupPackage,
            } as any);
            showSuccess('Qrup parametrləri, adı və ödəniş paketi verilənlər bazasında uğurla yeniləndi!');
            closeSettings();
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Qrupu yeniləmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangeGroupPackageDirect = async (group: Group, pkgId: string) => {
        setIsSaving(true);
        try {
            await agentService.updateGroup(group.id, { packageTier: pkgId } as any);
            const pkgName = activeAdminPackages.find(p => p.id === pkgId)?.name || pkgId.toUpperCase();
            showSuccess(`"${group.name}" qrupunun ödəniş paketi "${pkgName}" olaraq yeniləndi!`);
            await fetchGroups();
            if (activeGroup && activeGroup.id === group.id) {
                setActiveGroup(prev => prev ? { ...prev, packageTier: pkgId } : null);
            }
        } catch (e: any) {
            showError(e.message || 'Ödəniş paketini yeniləmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    // Qrupun Bazadan Silinməsi (Real DB Delete)
    const handleDeleteGroup = async () => {
        if (!groupForSettings) return;
        if (!confirm(`"${groupForSettings.name}" qrupunu və ona aid bütün qeydləri bazadan tamamilə silmək istədiyinizə əminsiniz?`)) return;

        setIsSaving(true);
        try {
            await agentService.deleteGroup(groupForSettings.id);
            showSuccess('Qrup və əlaqəli bütün qeydlər verilənlər bazasından uğurla silindi.');
            closeSettings();
            await fetchGroups();
        } catch (e: any) {
            showError(e.message || 'Qrupu silmək mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadGroupInvoice = async (group: Group) => {
        try {
            showSuccess('Generating official B2B Group Tax Invoice...');
            const res = await agentService.getGroupInvoicePdf(group.id);
            const fileUrl = res.data?.fileUrl;
            if (fileUrl) {
                const fullUrl = getFileUrl(fileUrl);
                const fileRes = await fetch(fullUrl);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = res.data?.fileName || `group_invoice_${group.code}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess('Official Group Tax Invoice (PDF) downloaded!');
            }
        } catch (err: any) {
            console.error('Invoice download error:', err);
            showError(err.message || 'Failed to download invoice.');
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setDestinationFilter('ALL');
        setStatusFilter('ALL');
    };

    // Status Pill-ləri
    const renderApplicantStatus = (status: Applicant['status']) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="app-status-badge verified">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Təsdiqlənib
                    </span>
                );
            case 'action_req':
                return (
                    <span className="app-status-badge action_req">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Tələb Olunur
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span className="app-status-badge pending">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        İcrada
                    </span>
                );
        }
    };

    // ==========================================
    // RENDER: VİEW 1 - Qrupların Siyahısı
    // ==========================================
    if (view === 'list') {
        return (
            <div className="agent-groups-content fade-in">
                {/* Gizli Fayl Girişi */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png" 
                    onChange={handleFileSelected} 
                />

                {/* --- HEADER --- */}
                <div className="agent-groups-header">
                    <div className="header-left">
                        <span className="portal-pill-badge">B2B Agent Ecosystem</span>
                        <h1 className="dash-title">Groups Management</h1>
                        <p className="dash-subtitle">Create and manage applicant groups, track missing documents, and submit bulk applications.</p>
                    </div>
                    <div className="header-actions">
                        <button 
                            className="btn-secondary" 
                            onClick={() => downloadRosterTemplate()} 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                            title="Download official CSV roster template for tour groups"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Roster Template
                        </button>
                        <button className="btn-primary-gradient" onClick={() => navigate('/agent/create-group')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Create New Group
                        </button>
                    </div>
                </div>

                {/* --- 4 KPI STAT CARDS --- */}
                <div className="agent-kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-icon-box blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Active Groups</span>
                            <span className="kpi-value">{loading ? '...' : stats.totalGroups}</span>
                            <span className="kpi-subtext">Registered Tour Delegations</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box indigo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Total Travelers</span>
                            <span className="kpi-value">{loading ? '...' : stats.totalApplicants}</span>
                            <span className="kpi-subtext">Managed Applicants</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box emerald">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Readiness Rate</span>
                            <span className="kpi-value">{loading ? '...' : `${stats.readinessRate}%`}</span>
                            <span className="kpi-subtext">{stats.verifiedApplicants} of {stats.totalApplicants} Verified</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon-box amber">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </div>
                        <div className="kpi-content">
                            <span className="kpi-label">Est. Commission</span>
                            <span className="kpi-value">{loading ? '...' : `€ ${stats.estimatedCommission.toFixed(2)}`}</span>
                            <span className="kpi-subtext">€ {stats.ratePerPax.toFixed(2)} / Passenger</span>
                        </div>
                    </div>
                </div>

                {/* --- FILTER & SEARCH BAR --- */}
                <div className="groups-filter-bar">
                    <div className="search-input-wrapper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input 
                            type="text" 
                            placeholder="Search by Group Name, ID or Applicant Name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="filter-select-wrapper">
                        <select 
                            value={destinationFilter} 
                            onChange={(e) => setDestinationFilter(e.target.value)}
                        >
                            <option value="ALL">All Destinations</option>
                            {destinations.map(dest => (
                                <option key={dest} value={dest}>{dest}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-select-wrapper">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="processing">Processing</option>
                            <option value="draft">Draft</option>
                        </select>
                    </div>

                    {(searchQuery || destinationFilter !== 'ALL' || statusFilter !== 'ALL') && (
                        <button className="btn-reset-filters" onClick={resetFilters}>
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* --- GROUPS LIST --- */}
                {loading ? (
                    <div className="groups-empty-state fade-in">
                        <div className="empty-icon-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <h3>Loading real database groups...</h3>
                        <p>Connecting to EuroTech database and fetching delegation rosters.</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="groups-empty-state fade-in">
                        <div className="empty-icon-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3>No matching groups found</h3>
                        <p>You have not registered any tour groups matching these filters yet.</p>
                        <button className="btn-primary-gradient" onClick={() => navigate('/agent/create-group')} style={{ marginTop: '12px' }}>
                            Register New Tour Group
                        </button>
                    </div>
                ) : (
                    <div className="groups-list">
                        {filteredGroups.map(group => {
                            const verifiedCount = group.applicants.filter(a => a.status === 'verified').length;
                            const totalApps = group.applicants.length;
                            const progressPercent = totalApps > 0 ? Math.round((verifiedCount / totalApps) * 100) : 0;

                            return (
                                <div key={group.id} className="group-card fade-in">
                                    <div className="group-card-header">
                                        <div className="group-info-main">
                                            <div className="group-icon-avatar">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                            </div>
                                            <div className="group-titles-block">
                                                <div className="group-title-row">
                                                    <h3>{group.name}</h3>
                                                    <span className={`status-pill ${group.status}`}>
                                                        <span className="pulse-dot"></span>
                                                        {group.status === 'draft' ? 'Draft' : 'Processing'}
                                                    </span>
                                                    <span className="code-badge">{group.code}</span>
                                                </div>
                                                <div className="group-meta-chips">
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                        Created: {group.createdDate}
                                                    </span>
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        Destination: <strong>{group.destination}</strong>
                                                    </span>
                                                    <span className="meta-chip">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        Departure: {group.travelDate}
                                                    </span>
                                                    <span 
                                                        className="meta-chip chip-appointment" 
                                                        onClick={() => openAppointmentModal(group)}
                                                        title="Qrupun görüş tarixini təyin et və ya dəyiş"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        Görüş: <strong>{group.appointment?.date && group.appointment.date !== 'TBD' ? `${group.appointment.date} ${group.appointment.startTime || ''}` : 'Təyin et'}</strong>
                                                    </span>
                                                    <span 
                                                        className={`meta-chip chip-payment ${group.paymentStatus?.toLowerCase() || 'pending'}`} 
                                                        onClick={() => openPaymentModal(group)}
                                                        title="Qrupun ödəniş statusunu dəyiş"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                                        Ödəniş: <strong>{group.paymentStatus || 'PENDING'} (€{(group.totalFee || 145).toFixed(0)})</strong>
                                                    </span>
                                                    <span
                                                        className="meta-chip"
                                                        onClick={() => openSettings(group)}
                                                        style={{ cursor: 'pointer', background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                                                        title="Qrupun Ödəniş Paketini dəyiş"
                                                    >
                                                        Paket:{' '}
                                                        <strong>
                                                            {activeAdminPackages.find(p => p.id === (group.packageTier || 'standard'))?.name ||
                                                                (group.packageTier || 'standard').toUpperCase()}
                                                        </strong>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="group-actions">
                                            {group.status === 'draft' && (
                                                <button className="btn-submit-group" onClick={() => handleSubmitGroup(group.id)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                                    Submit Group
                                                </button>
                                            )}
                                            
                                            <button 
                                                className="btn-icon-action" 
                                                onClick={() => handleDownloadManifest(group)} 
                                                title="Download Consular Manifest PDF"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>

                                            <button 
                                                className="btn-icon-action" 
                                                onClick={() => handleDownloadGroupInvoice(group)} 
                                                title="Download Official B2B Group Tax Invoice & Commission Statement (PDF)"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 14h.01"/></svg>
                                            </button>

                                            <button className="btn-icon-action" onClick={() => openSettings(group)} title="Group Settings">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="3" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* APPLICANTS ROSTER TABLE */}
                                    <div className="group-applicants-section">
                                        <div className="applicants-header-row">
                                            <h4>
                                                Delegation Roster 
                                                <span className="applicants-count-chip">{group.applicants.length} Travelers</span>
                                            </h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <button 
                                                    className="btn-add-traveler" 
                                                    onClick={() => openAddTravelerModal(group)}
                                                    title="Mövcud qrupa yeni sərnişin əlavə et"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                    + Add Traveler
                                                </button>
                                                <div className="readiness-indicator">
                                                    Readiness: <strong>{progressPercent}% Complete</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {group.applicants.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '0.9rem' }}>
                                                No travelers registered in this delegation yet.
                                            </div>
                                        ) : (
                                            <div className="applicants-table-wrapper">
                                                <table className="applicants-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Applicant Name</th>
                                                            <th>Passport No.</th>
                                                            <th>Status</th>
                                                            <th>Documents</th>
                                                            <th style={{ textAlign: 'right' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.applicants.map((app, idx) => {
                                                            const initials = app.fullName
                                                                .split(' ')
                                                                .map(n => n[0])
                                                                .join('')
                                                                .toUpperCase()
                                                                .slice(0, 2);

                                                            const docCount = app.documents.length;
                                                            const isComplete = docCount >= 3 && app.status === 'verified';

                                                            return (
                                                                <tr key={app.id}>
                                                                    <td>
                                                                        <div className="applicant-identity">
                                                                            <div className="applicant-initials-avatar">{initials}</div>
                                                                            <div className="applicant-name-wrap">
                                                                                <span className="applicant-full-name">{app.fullName}</span>
                                                                                <span className="applicant-role-label">
                                                                                    {idx === 0 ? 'Primary Applicant' : 'Delegation Traveler'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <span className="cell-passport-code">{app.passport}</span>
                                                                    </td>
                                                                    <td>
                                                                        <div className="cell-status-wrapper">
                                                                            {renderApplicantStatus(app.status)}
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`cell-docs-tag ${isComplete ? 'complete' : 'missing'}`}>
                                                                            {isComplete ? `All Uploaded (${REQUIRED_DOC_TYPES.length}/${REQUIRED_DOC_TYPES.length})` : `${docCount}/${REQUIRED_DOC_TYPES.length} Uploaded`}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                        <button 
                                                                            className="btn-share-link" 
                                                                            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#EF4444', marginRight: 6 }}
                                                                            onClick={() => handleDownloadApplicantSchengenPdf(group, app)}
                                                                            title="Şengen Viza Formasını (PDF) endir"
                                                                        >
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                                            PDF Form
                                                                        </button>
                                                                        <button 
                                                                            className="btn-share-link" 
                                                                            onClick={() => handleCopySelfFillLink(group, app)}
                                                                            title="Sərnişin üçün Self-Fill linkini kopyala"
                                                                        >
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                                                            Send Link
                                                                        </button>
                                                                        <button className="btn-manage-action" onClick={() => handleManageApplicant(group, app)}>
                                                                            Manage
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* --- ULTRA-PREMIUM SETTINGS MODAL --- */}
                {isSettingsOpen && groupForSettings && (
                    <div className="premium-modal-overlay fade-in" onClick={closeSettings}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Group Settings</span>
                                    <h2>{groupForSettings.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={closeSettings}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="settingsForm" onSubmit={handleSaveSettings}>
                                    <div className="settings-section">
                                        <h3>General Identity</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group full-width">
                                                <label>Group Name (Internal Reference)</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={editGroupName}
                                                    onChange={(e) => setEditGroupName(e.target.value)}
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Group Code</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.code} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Creation Date</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.createdDate} disabled />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-section">
                                        <h3>Payment Package &amp; Service Tier</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                                            {activeAdminPackages.map(pkg => {
                                                const isSel = editGroupPackage === pkg.id;
                                                return (
                                                    <div
                                                        key={pkg.id}
                                                        onClick={() => setEditGroupPackage(pkg.id)}
                                                        style={{
                                                            padding: '12px',
                                                            borderRadius: '10px',
                                                            border: isSel ? '2px solid #2563EB' : '1.5px solid #CBD5E1',
                                                            background: isSel ? '#EFF6FF' : '#FFFFFF',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{pkg.name}</strong>
                                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2563EB' }}>
                                                                {Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(0)}` : '€0'}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>{pkg.description}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="settings-section">
                                        <h3>Travel Parameters</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>Destination Country</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.destination} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Intended Departure Date</label>
                                                <input type="date" className="client-input" defaultValue={groupForSettings.travelDate} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Duration of Stay</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.duration === 'short' ? 'Short Stay (≤ 90 days)' : 'Long Stay (> 90 days)'} disabled />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Group Travel Project</label>
                                                <input type="text" className="client-input" defaultValue={groupForSettings.projectReason} disabled />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <span className="helper-text">Core travel parameters cannot be changed after consular submission.</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="settings-danger-zone">
                                        <div className="danger-info">
                                            <h4>Danger Zone</h4>
                                            <p>Deleting this group will remove all associated applicants and uploaded documents from the database. This action cannot be undone.</p>
                                        </div>
                                        <button type="button" className="btn-danger-outline" onClick={handleDeleteGroup} disabled={isSaving}>
                                            Delete Group
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={closeSettings} disabled={isSaving}>Cancel</button>
                                <button type="submit" form="settingsForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ADD TRAVELER MODAL --- */}
                {isAddTravelerOpen && targetGroupForTraveler && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsAddTravelerOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Delegation Roster</span>
                                    <h2>Add Traveler to {targetGroupForTraveler.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsAddTravelerOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="addTravelerForm" onSubmit={handleSaveNewTraveler}>
                                    <div className="settings-section">
                                        <h3>Traveler Information</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>First Name (Ad) *</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Leyla" 
                                                    value={newTravelerData.firstName} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, firstName: e.target.value })} 
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Last Name (Soyad) *</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. Məmmədova" 
                                                    value={newTravelerData.lastName} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, lastName: e.target.value })} 
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Passport Number *</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    placeholder="e.g. C12345678" 
                                                    value={newTravelerData.passportNumber} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, passportNumber: e.target.value.toUpperCase() })} 
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Date of Birth (Təvəllüd)</label>
                                                <input 
                                                    type="date" 
                                                    className="client-input" 
                                                    value={newTravelerData.dob} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, dob: e.target.value })} 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Contact Phone</label>
                                                <input 
                                                    type="tel" 
                                                    className="client-input" 
                                                    placeholder="+994 50 123 45 67" 
                                                    value={newTravelerData.contactPhone} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, contactPhone: e.target.value })} 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Email Address</label>
                                                <input 
                                                    type="email" 
                                                    className="client-input" 
                                                    placeholder="traveler@example.com" 
                                                    value={newTravelerData.contactEmail} 
                                                    onChange={(e) => setNewTravelerData({ ...newTravelerData, contactEmail: e.target.value })} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsAddTravelerOpen(false)} disabled={isSaving}>Cancel</button>
                                <button type="submit" form="addTravelerForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Əlavə edilir...' : 'Add Traveler to Group'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- GROUP APPOINTMENT MODAL --- */}
                {isAppointmentModalOpen && selectedGroupForAction && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsAppointmentModalOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Group Schedule</span>
                                    <h2>Appointment for {selectedGroupForAction.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsAppointmentModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="appointmentForm" onSubmit={handleSaveGroupAppointment}>
                                    <div className="settings-section">
                                        <h3>Consular Appointment Slot</h3>
                                        <div className="client-form-grid">
                                            <div className="client-input-group">
                                                <label>Appointment Date *</label>
                                                <input 
                                                    type="date" 
                                                    className="client-input" 
                                                    value={newAppointmentDate} 
                                                    onChange={(e) => setNewAppointmentDate(e.target.value)} 
                                                    required 
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Time Slot *</label>
                                                <select 
                                                    className="client-input" 
                                                    value={newAppointmentTime} 
                                                    onChange={(e) => setNewAppointmentTime(e.target.value)}
                                                >
                                                    <option value="09:00">09:00 - 09:30</option>
                                                    <option value="09:30">09:30 - 10:00</option>
                                                    <option value="10:00">10:00 - 10:30</option>
                                                    <option value="10:30">10:30 - 11:00</option>
                                                    <option value="11:00">11:00 - 11:30</option>
                                                    <option value="11:30">11:30 - 12:00</option>
                                                    <option value="14:00">14:00 - 14:30</option>
                                                    <option value="14:30">14:30 - 15:00</option>
                                                    <option value="15:00">15:00 - 15:30</option>
                                                    <option value="15:30">15:30 - 16:00</option>
                                                    <option value="16:00">16:00 - 16:30</option>
                                                    <option value="16:30">16:30 - 17:00</option>
                                                    {newAppointmentTime && !['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].includes(newAppointmentTime) && (
                                                        <option value={newAppointmentTime}>{newAppointmentTime}</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Submission Center Location</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={newAppointmentLocation} 
                                                    onChange={(e) => setNewAppointmentLocation(e.target.value)} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="info-alert" style={{ marginTop: '16px' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <span>Görüş təyin edildikdən sonra qrup manifesti və ərizəçilərin görüş bildirişləri avtomatik yenilənir.</span>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => setIsAppointmentModalOpen(false)} disabled={isSaving}>Cancel</button>
                                <button type="submit" form="appointmentForm" className="btn-modal-primary" disabled={isSaving}>
                                    {isSaving ? 'Yadda saxlanılır...' : 'Save Appointment'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- GROUP PAYMENT MODAL --- */}
                {isPaymentModalOpen && selectedGroupForAction && (
                    <div className="premium-modal-overlay fade-in" onClick={() => setIsPaymentModalOpen(false)}>
                        <div className="premium-modal-container slide-up" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-info">
                                    <span className="modal-badge">Group Billing</span>
                                    <h2>Payment Status for {selectedGroupForAction.name}</h2>
                                </div>
                                <button className="btn-modal-close" onClick={() => setIsPaymentModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>

                            <div className="modal-body">
                                <form id="paymentStatusForm" onSubmit={handleExecuteB2BPayment}>
                                    <div style={{ background: '#F8FAFC', padding: '14px 18px', borderRadius: '10px', border: '1.5px solid #E2E8F0', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Total Group Fee:</span>
                                            <strong style={{ fontSize: '1.2rem', color: '#0F1E36' }}>
                                                € {selectedGroupEffectiveFee.toFixed(2)} EUR
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                                            Includes {selectedGroupForAction.applicants.length} applicant(s) consular &amp; package fees. Current Status: <strong style={{ color: selectedGroupForAction.paymentStatus === 'PAID' ? '#16A34A' : '#D97706' }}>{selectedGroupForAction.paymentStatus || 'PENDING'}</strong>
                                        </div>
                                    </div>

                                    <PromoCodeInput
                                        targetType="GROUP_BATCH_PAYMENT"
                                        groupBatchId={selectedGroupForAction.id}
                                        grossAmountEur={selectedGroupGrossFee}
                                        displayCurrency="EUR"
                                        appliedPromo={appliedPromo}
                                        onPromoChange={setAppliedPromo}
                                        disabled={isSaving}
                                        resetKey={selectedGroupForAction.id}
                                    />

                                    {/* Payment Method Switcher */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F1E36', marginBottom: '8px' }}>
                                            Select Settlement Method:
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setB2bPaymentMethod('WALLET')}
                                                style={{
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    border: b2bPaymentMethod === 'WALLET' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                    background: b2bPaymentMethod === 'WALLET' ? '#EFF6FF' : '#FFFFFF',
                                                    fontWeight: 700,
                                                    fontSize: '0.82rem',
                                                    color: b2bPaymentMethod === 'WALLET' ? '#1E3A8A' : '#475569',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Agency Wallet
                                                <div style={{ fontSize: '0.72rem', marginTop: '2px', color: walletBalance + 0.005 >= selectedGroupEffectiveFee ? '#059669' : '#DC2626' }}>
                                                    € {walletBalance.toFixed(2)} avail.
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setB2bPaymentMethod('CARD')}
                                                style={{
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    border: b2bPaymentMethod === 'CARD' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                    background: b2bPaymentMethod === 'CARD' ? '#EFF6FF' : '#FFFFFF',
                                                    fontWeight: 700,
                                                    fontSize: '0.82rem',
                                                    color: b2bPaymentMethod === 'CARD' ? '#1E3A8A' : '#475569',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                B2B Card
                                                <div style={{ fontSize: '0.72rem', marginTop: '2px', color: '#64748B' }}>Instant</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setB2bPaymentMethod('BANK_SLIP')}
                                                style={{
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    border: b2bPaymentMethod === 'BANK_SLIP' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                                    background: b2bPaymentMethod === 'BANK_SLIP' ? '#EFF6FF' : '#FFFFFF',
                                                    fontWeight: 700,
                                                    fontSize: '0.82rem',
                                                    color: b2bPaymentMethod === 'BANK_SLIP' ? '#1E3A8A' : '#475569',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Bank Slip
                                                <div style={{ fontSize: '0.72rem', marginTop: '2px', color: '#64748B' }}>Wire Transfer</div>
                                            </button>
                                        </div>
                                    </div>

                                    {b2bPaymentMethod === 'WALLET' ? (
                                        <div style={{ background: walletBalance + 0.005 >= selectedGroupEffectiveFee ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${walletBalance + 0.005 >= selectedGroupEffectiveFee ? '#A7F3D0' : '#FECACA'}`, borderRadius: '8px', padding: '14px' }}>
                                            <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#0F1E36', fontWeight: 700 }}>
                                                Pay Directly from Prepaid Agency Wallet (Available: € {walletBalance.toFixed(2)})
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569' }}>
                                                    {walletBalance + 0.005 >= selectedGroupEffectiveFee
                                                        ? 'Instant consular settlement with automatic commission credit back to your Agency Wallet.'
                                                        : 'Insufficient wallet balance. Top up your wallet in Finance & Commissions or choose B2B Card / Bank Slip.'}
                                                </p>
                                                {selectedGroupEffectiveFee > 0 && walletBalance + 0.005 < selectedGroupEffectiveFee && (
                                                    <button
                                                        type="button"
                                                        className="btn-primary"
                                                        style={{ padding: '6px 12px', fontSize: '0.76rem' }}
                                                        onClick={() => {
                                                            setIsPaymentModalOpen(false);
                                                            setAppliedPromo(null);
                                                            navigate('/agent/finance');
                                                        }}
                                                    >
                                                        + Top Up Wallet
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : b2bPaymentMethod === 'BANK_SLIP' ? (
                                        <div className="client-form-grid" style={{ gap: '12px' }}>
                                            <div className="client-input-group full-width">
                                                <label>Bank Name</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={slipBankName} 
                                                    onChange={(e) => setSlipBankName(e.target.value)}
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Remitter (Agency Company Name)</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={slipSenderName} 
                                                    onChange={(e) => setSlipSenderName(e.target.value)}
                                                    placeholder="Baku Tours MMC"
                                                />
                                            </div>
                                            <div className="client-input-group">
                                                <label>Bank Reference / Slip Number</label>
                                                <input 
                                                    type="text" 
                                                    className="client-input" 
                                                    value={slipReceiptNumber} 
                                                    onChange={(e) => setSlipReceiptNumber(e.target.value)}
                                                    placeholder="e.g. BB-98214"
                                                    required
                                                />
                                            </div>
                                            <div className="client-input-group full-width">
                                                <label>Upload Official Payment Receipt (PDF / Image)</label>
                                                <input 
                                                    type="file" 
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                                                    className="client-input"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#0F1E36', fontWeight: 600 }}>
                                                B2B 3D-Secure Card Checkout
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
                                                Fast consular processing fee payment via corporate credit/debit card with automatic VAT proforma receipt.
                                            </p>
                                        </div>
                                    )}

                                    <div className="info-alert" style={{ marginTop: '16px' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <span>Ödəniş təsdiqləndikdən sonra qrup konsulluq emalına icazə verilir və agent komissiyası aktivləşir.</span>
                                    </div>
                                </form>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal-secondary" onClick={() => { setIsPaymentModalOpen(false); setAppliedPromo(null); }} disabled={isSaving}>Cancel</button>
                                <button
                                    type="submit"
                                    form="paymentStatusForm"
                                    className="btn-modal-primary"
                                    disabled={isSaving || (b2bPaymentMethod === 'WALLET' && selectedGroupEffectiveFee > 0 && walletBalance + 0.005 < selectedGroupEffectiveFee)}
                                >
                                    {isSaving
                                        ? 'Processing...'
                                        : selectedGroupEffectiveFee <= 0
                                          ? 'Confirm Free Promo Settlement (€0.00)'
                                          : b2bPaymentMethod === 'BANK_SLIP'
                                            ? `Submit Bank Slip (€${selectedGroupEffectiveFee.toFixed(2)})`
                                            : `Pay €${selectedGroupEffectiveFee.toFixed(2)}`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // RENDER: VIEW 2 - Sərnişin İdarəetmə Paneli (Form & Docs)
    // ==========================================
    const formSteps = [
        { id: 1, title: 'Your plans' }, 
        { id: 2, title: 'Your information' }, 
        { id: 3, title: 'Your last visa' }, 
        { id: 4, title: 'Your stay' }, 
        { id: 5, title: 'Your contacts' }
    ];

    const uploadedDocTypes = new Set(activeApplicant?.documents.map(d => d.requiredDocumentType) || []);

    return (
        <div className="agent-groups-content fade-in">
            {/* Gizli Fayl Girişi */}
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.jpg,.jpeg,.png" 
                onChange={handleFileSelected} 
            />

            {/* Header: Back & Info */}
            <div className="manage-view-header">
                <button className="btn-back-link" onClick={handleBackToList}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Groups List
                </button>
                <div className="manage-applicant-info">
                    <div className="applicant-id-badge">Group: <strong>{activeGroup?.name}</strong> ({activeGroup?.code})</div>
                    <h2 className="manage-title">Applicant: {activeApplicant?.fullName}</h2>
                </div>
                {activeGroup && activeApplicant && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            type="button" 
                            className="btn-action-outline" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '8px 16px', fontSize: '0.85rem' }}
                            onClick={() => handleDownloadApplicantSchengenPdf(activeGroup, activeApplicant)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            Download Schengen PDF
                        </button>
                        <button 
                            type="button" 
                            className="btn-share-link" 
                            onClick={() => handleCopySelfFillLink(activeGroup, activeApplicant)}
                            title="Sərnişin üçün Self-Fill linkini kopyala"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Copy Customer Self-Fill Link
                        </button>
                    </div>
                )}
            </div>

            {/* Premium Tabs */}
            <div className="manage-tabs-container">
                <button className={`premium-tab ${manageTab === 'form' ? 'active' : ''}`} onClick={() => setManageTab('form')}>
                    1. Application Form (37 Points)
                </button>
                <button className={`premium-tab ${manageTab === 'docs' ? 'active' : ''}`} onClick={() => setManageTab('docs')}>
                    2. Required Documents ({activeApplicant?.documents.length || 0})
                </button>
                <button className={`premium-tab ${manageTab === 'packages' ? 'active' : ''}`} onClick={() => setManageTab('packages')}>
                    3. Payment Packages ({activeAdminPackages.find(p => p.id === (activeGroup?.packageTier || 'standard'))?.name || 'Standard'})
                </button>
            </div>

            {/* --- TAB 3: PAYMENT PACKAGES --- */}
            {manageTab === 'packages' && activeGroup && (
                <div className="fade-in" style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                                Group Service &amp; Payment Package ({activeGroup.name})
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                                Select or upgrade the payment package applied to all {activeGroup.applicants.length} traveler(s) in this group.
                            </p>
                        </div>
                        <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.88rem' }}>
                            Total Group Fee: €{(activeGroup.totalFee || 145).toFixed(2)}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        {activeAdminPackages.map(pkg => {
                            const isCur = (activeGroup.packageTier || 'standard') === pkg.id;
                            const liveCalc = calculateLiveFees({
                                portalType: 'GROUP_AGENT',
                                paxCount: Math.max(1, activeGroup.applicants.length),
                                activePackage: pkg.id,
                                duration: activeGroup.duration || 'short',
                            });
                            return (
                                <div
                                    key={pkg.id}
                                    style={{
                                        border: isCur ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                                        background: isCur ? '#EFF6FF' : '#F8FAFC',
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
                                                <span style={{ fontSize: '0.72rem', fontWeight: 800, background: isCur ? '#2563EB' : '#E2E8F0', color: isCur ? '#FFFFFF' : '#334155', padding: '3px 8px', borderRadius: '8px' }}>
                                                    {pkg.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1D4ED8', marginBottom: '6px' }}>
                                            {Number(pkg.priceEur) > 0 ? `+€${Number(pkg.priceEur).toFixed(2)}` : '€0.00'} <span style={{ fontSize: '0.78rem', color: '#64748B' }}>/ pax</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                                            Group Total ({activeGroup.applicants.length} Pax): €{liveCalc.grandTotalEur.toFixed(2)}
                                        </div>
                                        <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, marginBottom: '12px' }}>{pkg.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isCur || isSaving}
                                        onClick={() => handleChangeGroupPackageDirect(activeGroup, pkg.id)}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: isCur ? '1.5px solid #2563EB' : 'none',
                                            background: isCur ? '#DBEAFE' : '#2563EB',
                                            color: isCur ? '#1E40AF' : '#FFFFFF',
                                            fontWeight: 700,
                                            cursor: isCur ? 'default' : 'pointer',
                                        }}
                                    >
                                        {isCur ? '✓ Active Group Package' : `Switch Group to ${pkg.name}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- TAB 1: 37-POINT SCHENGEN FORM --- */}
            {manageTab === 'form' && (
                <div className="fade-in">
                    <SchengenQuestionnaire
                        formData={applicantFormData}
                        onFieldChange={(field, value) => setApplicantFormData(prev => ({ ...prev, [field]: value }))}
                        dossier={activeGroup ? {
                            id: activeGroup.dossierId || activeGroup.id,
                            dossierNumber: activeGroup.code || activeGroup.id,
                            portalType: 'GROUP_AGENT',
                            status: activeGroup.status,
                            currentStep: 1,
                            country: { id: '', code: '', nameEn: activeGroup.destination, nameAz: activeGroup.destination },
                        } : null}
                        onOpenMrzModal={() => {}}
                        onSaveForm={handleSaveForm}
                        isCorporateMode={false}
                    />
                </div>
            )}

            {/* --- TAB 2: DOCUMENTS --- */}
            {manageTab === 'docs' && (
                <div className="docs-main-layout fade-in">
                    <aside className="docs-sidebar">
                        <div className="docs-tracker-card-vertical">
                            <div className="tracker-header">
                                <span>Document Checklist</span>
                                <span className="tracker-count">{activeApplicant?.documents.length || 0} / {REQUIRED_DOC_TYPES.length} Uploaded</span>
                            </div>
                            <div className="tracker-progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ width: `${Math.min(100, Math.round(((activeApplicant?.documents.length || 0) / REQUIRED_DOC_TYPES.length) * 100))}%` }}
                                ></div>
                            </div>
                            <div className="tracker-items-vertical">
                                {REQUIRED_DOC_TYPES.map(doc => {
                                    const isUploaded = uploadedDocTypes.has(doc.type);
                                    const matched = activeApplicant?.documents.find(d => d.requiredDocumentType === doc.type);
                                    const isRejected = matched?.status === 'REJECTED';
                                    const isVerified = matched?.status === 'VERIFIED';

                                    return (
                                        <div key={doc.type} className={`tracker-item-vert ${isRejected ? 'rejected' : isVerified ? 'completed' : isUploaded ? 'completed' : 'pending'}`}>
                                            <div className="tracker-icon-vert">
                                                {isRejected ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                ) : isUploaded ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                ) : (
                                                    <span className="empty-circle"></span>
                                                )}
                                            </div>
                                            <span className="tracker-label-vert">{doc.title}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    <section className="docs-list-premium">
                        {REQUIRED_DOC_TYPES.map(reqDoc => {
                            const existing = activeApplicant?.documents.find(d => d.requiredDocumentType === reqDoc.type);
                            const isUploaded = !!existing;
                            const isRejected = existing?.status === 'REJECTED';
                            const isVerified = existing?.status === 'VERIFIED';
                            const isUploadingThis = uploadingDocType === reqDoc.type;

                            return (
                                <div 
                                    key={reqDoc.type} 
                                    className={`doc-card-premium ${isRejected ? 'rejected' : isVerified ? 'verified' : isUploaded ? 'verified' : 'pending'}`}
                                >
                                    <div className="doc-card-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    </div>
                                    <div className="doc-card-info">
                                        <div className="doc-card-header">
                                            <h3>{reqDoc.title}</h3>
                                            <span className={`doc-badge ${isRejected ? 'rejected' : isVerified ? 'verified' : isUploaded ? 'verified' : 'pending'}`}>
                                                {isRejected ? 'Action Required' : isVerified ? 'Verified' : isUploaded ? 'Uploaded (Pending Review)' : 'Not Uploaded'}
                                            </span>
                                        </div>
                                        <p className="doc-explanatory-text">{reqDoc.desc}</p>
                                        
                                        {isRejected && existing?.operatorNotes && (
                                            <div className="doc-feedback-alert">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                <div className="feedback-content">
                                                    <strong>Operator Feedback:</strong>
                                                    <span>{existing.operatorNotes}</span>
                                                </div>
                                            </div>
                                        )}

                                        {isUploaded && existing?.originalFileName && (
                                            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                                                Fayl: <strong>{existing.originalFileName}</strong>
                                            </div>
                                        )}
                                    </div>
                                    <div className="doc-card-actions">
                                        {isUploaded && existing && (
                                            <>
                                                <button 
                                                    type="button" 
                                                    className="btn-view-doc" 
                                                    onClick={() => handleViewDoc(existing)}
                                                    title="Sənədə yeni tabda bax"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    View
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-remove-doc" 
                                                    onClick={() => handleRemoveDoc(existing)}
                                                    title="Sənədi bazadan sil"
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    Remove
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            className="btn-upload-primary" 
                                            onClick={() => triggerUpload(reqDoc.type)}
                                            disabled={isUploadingThis}
                                        >
                                            {isUploadingThis ? 'Uploading...' : isUploaded ? 'Re-upload File' : 'Upload File'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                </div>
            )}
        </div>
    );
}
