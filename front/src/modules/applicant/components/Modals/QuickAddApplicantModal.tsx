import React, { useState } from 'react';
import { dossierService } from '@/shared/api/services/dossier.service';
import { useToast } from '@/shared/context/ToastContext';

interface QuickAddApplicantModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossierId: string;
  onApplicantAdded: (newApplicantId?: string) => void;
  defaultRoleLabel?: string;
}

export default function QuickAddApplicantModal({
  isOpen,
  onClose,
  dossierId,
  onApplicantAdded,
  defaultRoleLabel = 'Member',
}: QuickAddApplicantModalProps) {
  const { showSuccess, showError } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [nationality, setNationality] = useState('AZ');
  const [familyRole, setFamilyRole] = useState('SPOUSE');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showError('Please provide applicant given name and surname.');
      return;
    }
    if (!passportNumber.trim()) {
      showError('Please provide applicant passport number.');
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await dossierService.addApplicants(dossierId, [
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passportNumber: passportNumber.trim().toUpperCase(),
          birthDate: dob || undefined,
          nationality,
          gender,
          familyRole: familyRole as any,
          formDataJson: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            passportNumber: passportNumber.trim().toUpperCase(),
            birthDate: dob || '',
            nationality: nationality === 'AZ' ? 'Azerbaijan' : nationality,
            gender: gender === 'FEMALE' ? 'Female' : 'Male',
          },
        },
      ]);

      const addedList = res.data?.data || res.data || [];
      const createdApp = Array.isArray(addedList) ? addedList[0] : addedList;

      showSuccess(`New applicant ${firstName} ${lastName} added successfully!`);
      setFirstName('');
      setLastName('');
      setPassportNumber('');
      setDob('');
      onApplicantAdded(createdApp?.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to add applicant:', err);
      showError(err.message || 'Could not add applicant to dossier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="applicant-modal-overlay">
      <div className="applicant-modal-container">
        <div className="applicant-modal-header">
          <div>
            <h3>+ Register New Applicant ({defaultRoleLabel})</h3>
            <p>Add a new passenger or family member to this application dossier.</p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="applicant-modal-body">
          <div className="modal-form-grid">
            <div className="modal-input-group">
              <label>First Name (Ad) *</label>
              <input
                type="text"
                className="modal-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Anar"
                required
              />
            </div>

            <div className="modal-input-group">
              <label>Last Name (Soyad) *</label>
              <input
                type="text"
                className="modal-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Quliyev"
                required
              />
            </div>

            <div className="modal-input-group">
              <label>Passport Number (Pasport Seriyası) *</label>
              <input
                type="text"
                className="modal-input"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                placeholder="e.g. C12345678"
                required
              />
            </div>

            <div className="modal-input-group">
              <label>Date of Birth (Doğum Tarixi)</label>
              <input
                type="date"
                className="modal-input"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <div className="modal-input-group">
              <label>Gender (Cinsiyyət)</label>
              <select
                className="modal-input"
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
              >
                <option value="MALE">Male (Kişi)</option>
                <option value="FEMALE">Female (Qadın)</option>
              </select>
            </div>

            <div className="modal-input-group">
              <label>Nationality (Vətəndaşlıq)</label>
              <select
                className="modal-input"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              >
                <option value="AZ">Azerbaijan (AZ)</option>
                <option value="TR">Turkey (TR)</option>
                <option value="GE">Georgia (GE)</option>
                <option value="KZ">Kazakhstan (KZ)</option>
                <option value="UZ">Uzbekistan (UZ)</option>
              </select>
            </div>
          </div>

          <div className="modal-footer-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Save & Open Application →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

