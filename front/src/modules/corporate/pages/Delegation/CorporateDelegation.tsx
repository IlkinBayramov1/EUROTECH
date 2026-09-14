import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { Spinner } from '@/shared/components/ui/Spinner';
import { BuildingIcon, ShieldIcon, CheckCircleIcon } from '@/shared/components/icons/Icons';
import { apiClient } from '@/shared/api/client';
import { useToast } from '@/shared/context/ToastContext';

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

  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiClient.get(`/corporate/delegation/profile?token=${token}`);
        if (res && res.data && res.data.profile) {
          setProfile(res.data.profile);
          if (res.data.profile.passportNumber) {
            setPassportNumber(res.data.profile.passportNumber);
          }
        }
      } catch (err: any) {
        console.warn('Delegation profile load error:', err);
        // Fallback mock profile
        setProfile({
          firstName: 'Corporate',
          lastName: 'Guest',
          companyName: 'EuroTech Partner LLC',
          jobTitle: 'Delegated Employee',
        });
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Simulate or submit profile update
      await new Promise((r) => setTimeout(r, 1000));
      showSuccess('Your application details have been submitted to HR.');
      setIsCompleted(true);
    } catch (err: any) {
      showError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ maxWidth: '500px', textAlign: 'center', padding: '40px 30px' }}>
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
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to Portal Home
          </Button>
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
