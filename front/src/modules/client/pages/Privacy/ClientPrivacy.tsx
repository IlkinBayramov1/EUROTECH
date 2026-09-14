import { useState } from 'react';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { Modal } from '@/shared/components/ui/Modal';
import { ShieldIcon, DownloadIcon, AlertTriangleIcon, CheckCircleIcon } from '@/shared/components/icons/Icons';
import { apiClient } from '@/shared/api/client';
import { useToast } from '@/shared/context/ToastContext';

export default function ClientPrivacy() {
  const [downloading, setDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');
  const { showSuccess, showError } = useToast();

  const handleExportData = async () => {
    setDownloading(true);
    try {
      const res = await apiClient.get('/privacy/export-data');
      if (res && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eurotech_gdpr_export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('GDPR Data Package downloaded successfully.');
      } else {
        showError('Could not retrieve data package.');
      }
    } catch (err: any) {
      showError(err.message || 'Export failed.');
    } finally {
      setDownloading(false);
    }
  };

  const handleAnonymize = async () => {
    if (confirmedName !== 'CONFIRM') {
      showError('Please type CONFIRM to verify.');
      return;
    }
    setAnonymizing(true);
    try {
      await apiClient.post('/privacy/anonymize', { reason: 'User requested right to be forgotten' });
      showSuccess('Account has been anonymized successfully.');
      setIsModalOpen(false);
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      showError(err.message || 'Anonymization request failed.');
    } finally {
      setAnonymizing(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)' }}>
            GDPR Privacy & Data Governance Center
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Manage your personal data rights, cryptographic exports, and data privacy under EU GDPR regulations.
          </p>
        </div>
        <Badge variant="success" size="md">
          <ShieldIcon size={14} /> GDPR Compliant (AES-256)
        </Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Card 1: Data Portability */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-secondary-light)',
                color: 'var(--color-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DownloadIcon size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Download Personal Data Package
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Article 20 — Right to Data Portability
              </span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Generate a full cryptographic JSON archive containing all your dossiers, registered applicants,
            uploaded document metadata, and financial transaction records.
          </p>
          <Button
            variant="secondary"
            onClick={handleExportData}
            isLoading={downloading}
            leftIcon={<DownloadIcon size={18} />}
          >
            Export All Data (.JSON)
          </Button>
        </Card>

        {/* Card 2: Right to be Forgotten */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangleIcon size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Right to be Forgotten (Erasure)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Article 17 — Right to Erasure
              </span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Permanently anonymize your personally identifiable information (PII), passport hash indices, and email
            identifiers while maintaining consular auditing integrity.
          </p>
          <Button variant="danger" onClick={() => setIsModalOpen(true)}>
            Request Account Anonymization
          </Button>
        </Card>
      </div>

      {/* Security Status Box */}
      <Card style={{ backgroundColor: '#F8FAFC', border: '1px solid var(--color-border)' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '12px' }}>
          Data Protection Safeguards Active
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircleIcon size={18} style={{ color: 'var(--color-tertiary)', marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>AES-256-GCM Encryption</strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Passport numbers encrypted at rest.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircleIcon size={18} style={{ color: 'var(--color-tertiary)', marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>HMAC-SHA256 Blind Index</strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Encrypted searchable passport lookup.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <CheckCircleIcon size={18} style={{ color: 'var(--color-tertiary)', marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>15-Min Signed URLs</strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ephemeral document downloads.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Confirm GDPR Anonymization">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            This action is irreversible. All your contact details, names, and passport references will be
            cryptographically stripped from active records.
          </p>
          <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-danger)' }}>
              Type CONFIRM below to proceed:
            </span>
            <input
              type="text"
              placeholder="CONFIRM"
              value={confirmedName}
              onChange={(e) => setConfirmedName(e.target.value)}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-danger)',
                fontSize: '14px',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleAnonymize}
              isLoading={anonymizing}
              disabled={confirmedName !== 'CONFIRM'}
            >
              Permanently Anonymize
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
