import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { agentService, dossierService } from '@/shared/api/services';
import { useToast } from '@/shared/context/ToastContext';
import './AgentApplicantFill.css';

const REQUIRED_DOC_TYPES = [
    { type: 'PASSPORT', title: 'Xarici Pasportun Əsas Səhifəsi', desc: 'Pasportun foto və məlumatlar olan səhifəsinin aydın rəngli surəti.' },
    { type: 'BIOMETRIC_PHOTO', title: 'Biometrik Fotoşəkil (3.5 x 4.5)', desc: 'Son 6 ayda çəkilmiş, ağ fonda ICAO standartına uyğun fotoşəkil.' },
    { type: 'INSURANCE', title: 'Schengen Tibbi Sığortası', desc: 'Minimum 30,000 EUR təminatlı beynəlxalq səyahət sığortası sertifikatı.' },
    { type: 'FLIGHT_ITINERARY', title: 'Aviabilet və ya Otel Rezervasiyası', desc: 'Səyahət tarixlərini təsdiq edən gediş-dönüş bilet və ya otel bronu.' },
    { type: 'BANK_STATEMENT', title: 'Bank Çıxarışı (İş Yeri Arayışı)', desc: 'Son 3-6 aylıq bank hesab çıxarışı və ya iş yerindən rəsmi arayış.' },
];

export default function AgentApplicantFill() {
    const [searchParams] = useSearchParams();
    const groupId = searchParams.get('groupId');
    const applicantId = searchParams.get('applicantId');
    const { showSuccess, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Backend Loaded Data
    const [groupData, setGroupData] = useState<any>(null);
    const [applicantData, setApplicantData] = useState<any>(null);

    // Form inputs
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [passportNumber, setPassportNumber] = useState('');
    const [dob, setDob] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [accommodation, setAccommodation] = useState('');
    const [stayDuration, setStayDuration] = useState('');

    // Document Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedDocType, setSelectedDocType] = useState<string>('');
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);

    const loadData = async () => {
        if (!groupId || !applicantId) {
            setErrorMsg('Müraciət linki natamamdır. Zəhmət olmasa tur agentinizdən tam linki yenidən əldə edin.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res: any = await agentService.getCustomerSelfFillData(groupId, applicantId);
            if (res.data) {
                const g = res.data.group;
                const a = res.data.applicant;
                setGroupData(g);
                setApplicantData(a);

                setFirstName(a.firstName || '');
                setLastName(a.lastName || '');
                setPassportNumber(a.passportNumber || '');
                setDob(a.birthDate ? String(a.birthDate).split('T')[0] : (a.formDataJson?.dob || ''));
                setIssueDate(a.formDataJson?.issueDate || '');
                setExpiryDate(a.formDataJson?.expiryDate || '');
                setContactPhone(a.formDataJson?.contactPhone || '');
                setContactEmail(a.formDataJson?.contactEmail || '');
                setAccommodation(a.formDataJson?.accommodation || '');
                setStayDuration(a.formDataJson?.stayDuration || '');
                setDocuments(a.documents || []);
            }
        } catch (err: any) {
            console.error('Self-fill load error:', err);
            setErrorMsg(err.message || 'Məlumatları yükləmək mümkün olmadı. Linkin etibarlılıq müddətini yoxlayın.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [groupId, applicantId]);

    const triggerUpload = (docType: string) => {
        setSelectedDocType(docType);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !groupId || !applicantId) return;

        setUploadingDocType(selectedDocType);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('requiredDocumentType', selectedDocType);

            const res: any = await agentService.uploadCustomerDoc(groupId, applicantId, formData);
            showSuccess('Sənəd uğurla yükləndi!');
            if (res.data?.document) {
                setDocuments(prev => {
                    const filtered = prev.filter(d => d.requiredDocumentType !== selectedDocType);
                    return [...filtered, res.data.document];
                });
            } else {
                await loadData();
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            showError(err.message || 'Faylı yükləmək mümkün olmadı.');
        } finally {
            setUploadingDocType(null);
            setSelectedDocType('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId || !applicantId) return;

        if (!firstName.trim() || !lastName.trim() || !passportNumber.trim()) {
            showError('Zəhmət olmasa Ad, Soyad və Pasport nömrənizi daxil edin.');
            return;
        }

        setIsSaving(true);
        try {
            await agentService.submitCustomerSelfFill(groupId, applicantId, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                passportNumber: passportNumber.trim().toUpperCase(),
                birthDate: dob || undefined,
                formDataJson: {
                    dob,
                    issueDate,
                    expiryDate,
                    contactPhone,
                    contactEmail,
                    accommodation,
                    stayDuration,
                },
            });
            showSuccess('Məlumatlarınız uğurla qeydiyyata alındı!');
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Submit error:', err);
            showError(err.message || 'Məlumatları saxlamaq mümkün olmadı.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadMySchengenPdf = async () => {
        try {
            showSuccess('Rəsmi Şengen vizası ərizə forması (PDF) hazırlanır...');
            const dossierId = groupData?.dossierId || groupData?.id || groupId || 'agent-group';
            const res = await dossierService.getApplicationFormPdf(dossierId, applicantId || 'applicant', {
                firstName,
                lastName,
                passportNumber,
                birthDate: dob,
                issueDate,
                passportExpiry: expiryDate,
                phone: contactPhone,
                email: contactEmail,
                hotelAccommodation: accommodation,
                durationOfStay: stayDuration,
                destination: groupData?.destination || 'Europe / Schengen',
                purpose: groupData?.projectReason || 'Tourism',
                arrivalDate: groupData?.travelDate,
            });

            if (res.data?.downloadUrl) {
                const fullUrl = res.data.downloadUrl.startsWith('http')
                    ? res.data.downloadUrl
                    : `http://localhost:5000${res.data.downloadUrl}`;
                
                const fileRes = await fetch(fullUrl);
                if (!fileRes.ok) throw new Error(`Status ${fileRes.status}`);
                const blob = await fileRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = res.data.fileName || `Schengen_Form_${firstName}_${lastName}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                showSuccess('Şengen forması (PDF) uğurla endirildi!');
            }
        } catch (err: any) {
            console.error('Schengen PDF download error:', err);
            showError('Şengen PDF formasını yükləmək mümkün olmadı.');
        }
    };

    if (loading) {
        return (
            <div className="agent-fill-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#1E3A8A' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 44, height: 44, animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                    <p style={{ marginTop: '12px', fontWeight: 600 }}>Məlumatlar yüklənir...</p>
                </div>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="agent-fill-page">
                <div className="agent-fill-container" style={{ maxWidth: '540px', marginTop: '60px' }}>
                    <div className="agent-fill-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 32, height: 32 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <h2 style={{ fontSize: '1.3rem', color: '#0F1E36', marginBottom: '8px' }}>Müraciət Linki Tapılmadı</h2>
                        <p style={{ color: '#64748B', fontSize: '0.92rem', marginBottom: '24px' }}>{errorMsg}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="agent-fill-page">
                <div className="agent-fill-container" style={{ maxWidth: '600px', marginTop: '40px' }}>
                    <div className="agent-fill-card success-splash-card">
                        <div className="success-splash-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F1E36', marginBottom: '8px' }}>
                            Məlumatlarınız Uğurla Qəbul Edildi!
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
                            Hörmətli <strong>{firstName} {lastName}</strong>, viza müraciətiniz üçün təqdim etdiyiniz şəxsi məlumatlar və sənədlər qeydə alındı və tur agentiniz <strong>{groupData?.agencyName}</strong> tərəfindən nəzərdən keçiriləcək.
                        </p>
                        <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'left', fontSize: '0.88rem' }}>
                            <div style={{ marginBottom: '6px' }}>📍 Qrup / Səfər: <strong>{groupData?.name}</strong></div>
                            <div style={{ marginBottom: '6px' }}>🌍 Təyinat Ölkəsi: <strong>{groupData?.destination}</strong></div>
                            <div>📄 Yüklənmiş Sənədlər: <strong>{documents.length} ədəd</strong></div>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                            <button 
                                type="button" 
                                onClick={handleDownloadMySchengenPdf}
                                className="btn-submit-customer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EF4444', width: 'auto', padding: '12px 24px', cursor: 'pointer' }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                📄 Rəsmi Şengen Formasını Yüklə (PDF)
                            </button>
                        </div>
                        <p style={{ marginTop: '24px', fontSize: '0.85rem', color: '#94A3B8' }}>
                            Təşəkkür edirik! Bu səhifəni bağlaya bilərsiniz.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="agent-fill-page">
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.jpg,.jpeg,.png" 
                onChange={handleFileSelected} 
            />

            <div className="agent-fill-container">
                {/* Header Brand */}
                <div className="agent-fill-header-card">
                    <div className="agent-fill-brand">
                        <div className="brand-icon-shield">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <div className="brand-titles">
                            <h1>EuroTech Visa Portal</h1>
                            <p>Səyahətçi Məlumatlarının Təqdim Edilməsi</p>
                        </div>
                    </div>
                    <div className="agent-fill-agency-badge">
                        <span>Tur Agentliyi</span>
                        <strong>{groupData?.agencyName || 'Partnyor Turizm'}</strong>
                    </div>
                </div>

                {/* Form Card */}
                <div className="agent-fill-card">
                    <h2 className="agent-fill-card-title">1. Şəxsi və Pasport Məlumatları</h2>
                    <p className="agent-fill-card-subtitle">
                        Zəhmət olmasa xarici pasportunuza uyğun məlumatları daxil edin. Bu məlumatlar konsulluq müraciət anketində istifadə ediləcək.
                    </p>

                    <form id="customerFillForm" onSubmit={handleSubmit}>
                        <div className="agent-fill-grid">
                            <div className="agent-fill-input-group">
                                <label>Ad (First Name) *</label>
                                <input 
                                    type="text" 
                                    className="agent-fill-input" 
                                    placeholder="e.g. Leyla" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Soyad (Last Name) *</label>
                                <input 
                                    type="text" 
                                    className="agent-fill-input" 
                                    placeholder="e.g. Məmmədova" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Xarici Pasport Nömrəsi *</label>
                                <input 
                                    type="text" 
                                    className="agent-fill-input" 
                                    placeholder="e.g. C12345678" 
                                    value={passportNumber} 
                                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())} 
                                    required 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Doğum Tarixi *</label>
                                <input 
                                    type="date" 
                                    className="agent-fill-input" 
                                    value={dob} 
                                    onChange={(e) => setDob(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Pasport Verilmə Tarixi</label>
                                <input 
                                    type="date" 
                                    className="agent-fill-input" 
                                    value={issueDate} 
                                    onChange={(e) => setIssueDate(e.target.value)} 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Pasport Bitmə Tarixi</label>
                                <input 
                                    type="date" 
                                    className="agent-fill-input" 
                                    value={expiryDate} 
                                    onChange={(e) => setExpiryDate(e.target.value)} 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>Əlaqə Nömrəsi (Mobil) *</label>
                                <input 
                                    type="tel" 
                                    className="agent-fill-input" 
                                    placeholder="+994 50 123 45 67" 
                                    value={contactPhone} 
                                    onChange={(e) => setContactPhone(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="agent-fill-input-group">
                                <label>E-poçt Ünvanı</label>
                                <input 
                                    type="email" 
                                    className="agent-fill-input" 
                                    placeholder="email@example.com" 
                                    value={contactEmail} 
                                    onChange={(e) => setContactEmail(e.target.value)} 
                                />
                            </div>
                            <div className="agent-fill-input-group full-width">
                                <label>Qalacağınız Ünvan və ya Otel Adı</label>
                                <input 
                                    type="text" 
                                    className="agent-fill-input" 
                                    placeholder="e.g. Grand Hotel Budapest və ya Dost evi" 
                                    value={accommodation} 
                                    onChange={(e) => setAccommodation(e.target.value)} 
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Documents Upload Card */}
                <div className="agent-fill-card">
                    <h2 className="agent-fill-card-title">2. Tələb Olunan Viza Sənədləri</h2>
                    <p className="agent-fill-card-subtitle">
                        Aşağıdakı sənədlərin aydın şəklini və ya PDF faylını yükləyin (Maks. 10MB).
                    </p>

                    <div className="agent-fill-docs-list">
                        {REQUIRED_DOC_TYPES.map(reqDoc => {
                            const existing = documents.find(d => d.requiredDocumentType === reqDoc.type);
                            const isUploaded = !!existing;
                            const isUploadingThis = uploadingDocType === reqDoc.type;

                            return (
                                <div key={reqDoc.type} className={`agent-fill-doc-row ${isUploaded ? 'uploaded' : ''}`}>
                                    <div className="doc-row-left">
                                        <div className="doc-row-icon">
                                            {isUploaded ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: 20, height: 20 }}><polyline points="20 6 9 17 4 12"/></svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            )}
                                        </div>
                                        <div className="doc-row-text">
                                            <h4>{reqDoc.title}</h4>
                                            <p>{reqDoc.desc}</p>
                                            {isUploaded && existing?.originalFileName && (
                                                <span style={{ fontSize: '0.75rem', color: '#16A34A', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                                                    ✓ {existing.originalFileName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        className={`btn-upload-customer ${isUploaded ? 'reupload' : ''}`}
                                        onClick={() => triggerUpload(reqDoc.type)}
                                        disabled={isUploadingThis}
                                    >
                                        {isUploadingThis ? 'Yüklənir...' : isUploaded ? 'Yenilə' : 'Fayl Yüklə'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="agent-fill-footer">
                        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                            * Məlumatların düzgünlüyünü təsdiq edərək müraciətinizi tamamlayın.
                        </span>
                        <button 
                            type="submit" 
                            form="customerFillForm" 
                            className="btn-submit-customer"
                            disabled={isSaving}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 18, height: 18 }}><polyline points="20 6 9 17 4 12"/></svg>
                            {isSaving ? 'Saxlanılır...' : 'Məlumatları Təsdiqlə və Göndər'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
