import React, { useState } from 'react';
import { extractMrzFromText } from '@/shared/utils/mrzParser';
import { useToast } from '@/shared/context/ToastContext';

interface MrzScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMrz: (fields: Record<string, any>) => void;
}

export default function MrzScannerModal({
  isOpen,
  onClose,
  onApplyMrz,
}: MrzScannerModalProps) {
  const { showSuccess, showError } = useToast();
  const [mrzText, setMrzText] = useState('');

  if (!isOpen) return null;

  const handleParse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrzText.trim()) {
      showError('Please paste the 2 MRZ lines from the bottom of the passport.');
      return;
    }

    const parsed = extractMrzFromText(mrzText);
    if (!parsed || !parsed.isValid) {
      showError('Could not parse valid ICAO Doc 9303 MRZ data. Ensure 2 lines with 44 characters each.');
      return;
    }

    onApplyMrz({
      passportNumber: parsed.passportNumber,
      lastName: parsed.lastName,
      firstName: parsed.firstName,
      nationality: parsed.nationality || 'Azerbaijan',
      birthDate: parsed.birthDate,
      passportExpiry: parsed.expiryDate,
      gender: parsed.gender === 'F' ? 'Female' : 'Male',
    });

    showSuccess(`Passport MRZ parsed successfully: ${parsed.passportNumber} (${parsed.firstName} ${parsed.lastName})!`);
    setMrzText('');
    onClose();
  };

  return (
    <div className="applicant-modal-overlay">
      <div className="applicant-modal-container">
        <div className="applicant-modal-header">
          <div>
            <h3>ICAO 9303 Passport MRZ Scanner</h3>
            <p>Paste the two 44-character optical lines from the bottom of the applicant's passport.</p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleParse} className="applicant-modal-body">
          <div className="mrz-sample-hint">
            <strong>Sample 2-Line Format:</strong>
            <code>
              P&lt;AZEALIYEV&lt;&lt;ANAR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;<br />
              C123456780AZE9001015M3001014&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;02
            </code>
          </div>

          <textarea
            className="mrz-textarea"
            rows={4}
            value={mrzText}
            onChange={(e) => setMrzText(e.target.value.toUpperCase())}
            placeholder="Paste raw MRZ text here..."
            required
          />

          <div className="modal-footer-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-submit">
              Apply Extracted Data →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

