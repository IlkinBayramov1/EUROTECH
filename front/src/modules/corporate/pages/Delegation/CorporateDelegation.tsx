import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { Spinner } from '@/shared/components/ui/Spinner';
import { BuildingIcon, ShieldIcon, CheckCircleIcon } from '@/shared/components/icons/Icons';
import { apiClient } from '@/shared/api/client';
import DynamicVcmsFormRenderer, {
  type VcmsQuestionItem,
} from '@/modules/applicant/components/VcmsDynamicForm/DynamicVcmsFormRenderer';
import { evaluateFrontendConditionSet } from '@/modules/admin/api/vcmsApi';
import { useToast } from '@/shared/context/ToastContext';
import { getFileUrl } from '@/shared/utils/file.util';

export default function CorporateDelegation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Form State
  const [dob, setDob] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [phone, setPhone] = useState('');
  const [vcmsQuestions, setVcmsQuestions] = useState<VcmsQuestionItem[]>([]);
  const [vcmsDocuments, setVcmsDocuments] = useState<any[]>([]);
  const [vcmsAnswers, setVcmsAnswers] = useState<Record<string, any>>({});

  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setTokenError('No delegation token provided. Please use the complete link sent by your HR team.');
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get(`/corporate/delegation/profile?token=${token}`);
        if (res && res.data) {
          const prof = res.data.profile || res.data;
          setProfile(prof);
          if (prof.passportNumber) {
            setPassportNumber(prof.passportNumber);
          }
          if (prof.dob || prof.birthDate) {
            setDob(String(prof.dob || prof.birthDate).split('T')[0]);
          }
          if (prof.passportExpiry) {
            setPassportExpiry(String(prof.passportExpiry).split('T')[0]);
          }
          if (prof.phone) {
            setPhone(prof.phone);
          }
          if (prof.vcms?.schema) {
            setVcmsQuestions(prof.vcms.schema.questions || []);
            setVcmsDocuments(prof.vcms.schema.documents || []);
            const savedMap: Record<string, any> = {};
            for (const ans of prof.vcms.savedAnswers || []) {
              savedMap[ans.questionCode] =
                Array.isArray(ans.selectedOptionCodesJson) && ans.selectedOptionCodesJson.length > 1
                  ? ans.selectedOptionCodesJson
                  : ans.valueText ||
                    (Array.isArray(ans.selectedOptionCodesJson) ? ans.selectedOptionCodesJson[0] : '') ||
                    (ans.valueJson !== null && ans.valueJson !== undefined ? ans.valueJson : '');
            }
            setVcmsAnswers(savedMap);
          }
        }
      } catch (err: any) {
        console.warn('Delegation profile load error:', err);
        setTokenError(err.message || 'This employee delegation link is invalid or has expired. Please contact your company HR.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  const handleVcmsAnswerChange = (q: VcmsQuestionItem, val: any) => {
    setVcmsAnswers((prev) => ({ ...prev, [q.questionCode]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const formattedVcmsAnswers = vcmsQuestions
      .filter((q) => vcmsAnswers[q.questionCode] !== undefined && vcmsAnswers[q.questionCode] !== '')
      .map((q) => {
        const rawVal = vcmsAnswers[q.questionCode];
        const isSelect = ['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(q.answerType);
        return {
          purposeQuestionConfigId: q.configId,
          questionCode: q.questionCode,
          valueText: Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal),
          valueJson: Array.isArray(rawVal) ? rawVal : undefined,
          selectedOptionCodes: isSelect
            ? Array.isArray(rawVal)
              ? rawVal.map(String)
              : [String(rawVal)]
            : undefined,
        };
      });

    setSubmitting(true);
    try {
      await apiClient.post('/corporate/delegation/submit', {
        token,
        passportNumber,
        dob,
        passportExpiry,
        phone,
        vcmsAnswers: formattedVcmsAnswers,
      });
      showSuccess('Your application details have been saved to your corporate file.');
      setIsCompleted(true);
    } catch (err: any) {
      showError(err.message || 'Submission failed. Please check your data and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadMySchengenPdf = async () => {
    try {
      showSuccess('Rəsmi Şengen vizası ərizə forması (PDF) hazırlanır...');
      const dossierId = profile?.dossierId || 'corporate-delegation';
      const applicantId = profile?.applicantId || profile?.id || 'applicant';
      const res = await apiClient.post(`/dossiers/${dossierId}/applicants/${applicantId}/application-pdf`, {
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        passportNumber,
        birthDate: dob,
        passportExpiry,
        phone,
        destination: profile?.destination || 'Europe / Schengen',
        purpose: 'Business',
        employerName: profile?.companyName || 'Corporate Partner',
        costCoveredBy: 'By Sponsor / Employer',
      });

      if (res.data?.downloadUrl) {
        const fullUrl = getFileUrl(res.data.downloadUrl);
        
        const fileRes = await fetch(fullUrl);
        if (!fileRes.ok) throw new Error(`Status ${fileRes.status}`);
        const blob = await fileRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = res.data.fileName || `Schengen_Form_${profile?.firstName || 'Applicant'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        showSuccess('Şengen forması (PDF) uğurla endirildi!');
      }
    } catch (err: any) {
      console.error('Schengen PDF error:', err);
      showError('Şengen PDF formasını yükləmək mümkün olmadı.');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ maxWidth: '500px', textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ color: '#EF4444', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>
            Invalid or Expired Delegation Link
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '12px 0 24px', lineHeight: 1.6 }}>
            {tokenError}
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Portal Home
          </Button>
        </Card>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ maxWidth: '540px', textAlign: 'center', padding: '40px 30px' }}>
          <div style={{ color: 'var(--color-tertiary)', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <CheckCircleIcon size={56} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>
            Information Submitted Successfully!
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '12px 0 24px', lineHeight: 1.6 }}>
            Thank you, <strong>{profile?.firstName}</strong>. Your mobility documents and details have been linked to your
            corporate visa delegation file for <strong>{profile?.companyName}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              variant="primary" 
              onClick={handleDownloadMySchengenPdf}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#EF4444', borderColor: '#EF4444' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Şengen Formasını Yüklə (PDF)
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Portal Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              ET
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>EUROTECH</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)' }}>
            Corporate Visa Delegation Form
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            You have been invited by your employer to complete your consular information.
          </p>
        </div>

        {/* Company Badge Info */}
        <Card style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BuildingIcon size={24} style={{ color: 'var(--color-secondary)' }} />
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block' }}>Sponsoring Organization</span>
              <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                {profile?.companyName || 'Corporate Partner'}
              </strong>
            </div>
          </div>
          <Badge variant="info">
            <ShieldIcon size={12} /> Verified Delegation Link
          </Badge>
        </Card>

        {/* Form Card */}
        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input
                label="First Name"
                value={profile?.firstName || ''}
                disabled
                style={{ backgroundColor: '#F8FAFC' }}
              />
              <Input
                label="Last Name"
                value={profile?.lastName || ''}
                disabled
                style={{ backgroundColor: '#F8FAFC' }}
              />
            </div>

            <Input
              label="Job Title / Department"
              value={`${profile?.jobTitle || 'Staff'} - ${profile?.department || 'Operations'}`}
              disabled
              style={{ backgroundColor: '#F8FAFC' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input
                label="Passport Number"
                placeholder="e.g. C12345678"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input
                label="Passport Expiry Date"
                type="date"
                value={passportExpiry}
                onChange={(e) => setPassportExpiry(e.target.value)}
                required
              />
              <Input
                label="Contact Mobile"
                type="tel"
                placeholder="+994 50 000 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {vcmsQuestions.length > 0 && (
              <DynamicVcmsFormRenderer
                questions={vcmsQuestions}
                answers={vcmsAnswers}
                onAnswerChange={handleVcmsAnswerChange}
                stepFilter={null}
                countryName={profile?.destination}
                visaTypeName={profile?.vcms?.visaType?.nameEn}
                visaPurposeName={profile?.vcms?.visaPurpose?.nameEn || profile?.vcms?.schema?.purpose?.nameEn}
              />
            )}

            {vcmsDocuments.length > 0 && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                }}
              >
                <strong style={{ display: 'block', fontSize: '0.92rem', color: '#0f172a', marginBottom: 8 }}>
                  Required Consular Documents for {profile?.destination}
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {vcmsDocuments
                    .filter((d) => {
                      const evalState = evaluateFrontendConditionSet(
                        { isRequired: d.isRequired, isVisible: true, conditions: d.conditions },
                        vcmsAnswers
                      );
                      return evalState.isVisible;
                    })
                    .map((d) => (
                      <div
                        key={d.configId || d.documentCode}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.82rem',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <code style={{ color: '#2563eb', fontWeight: 700, marginRight: 6 }}>{d.documentCode}</code>
                          <strong style={{ color: '#0f172a' }}>{d.nameEn}</strong>
                          {d.descriptionEn && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                              {d.descriptionEn}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: d.isRequired ? '#fee2e2' : '#f1f5f9',
                            color: d.isRequired ? '#b91c1c' : '#475569',
                          }}
                        >
                          {d.isRequired ? 'Required' : 'Optional'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px' }}>
              <Button type="submit" variant="primary" style={{ width: '100%' }} isLoading={submitting}>
                Submit Visa Details to HR
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
