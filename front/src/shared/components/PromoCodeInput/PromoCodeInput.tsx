import React, { useState, useEffect } from 'react';
import { promoService, type PromoValidationResult, type PromoScope } from '@/shared/api/services/promo.service';
import './PromoCodeInput.css';

interface PromoCodeInputProps {
  targetType: PromoScope;
  dossierId?: string | null;
  groupBatchId?: string | null;
  invoiceId?: string | null;
  cartItems?: Array<{ serviceType: string; applicantId?: string }>;
  grossAmountEur: number;
  displayCurrency?: 'EUR' | 'AZN';
  exchangeRate?: number;
  appliedPromo: PromoValidationResult | null;
  onPromoChange: (result: PromoValidationResult | null) => void;
  disabled?: boolean;
  resetKey?: string | number | null;
}

export default function PromoCodeInput({
  targetType,
  dossierId,
  groupBatchId,
  invoiceId,
  cartItems,
  grossAmountEur,
  displayCurrency = 'EUR',
  exchangeRate = 1.85,
  appliedPromo,
  onPromoChange,
  disabled = false,
  resetKey,
}: PromoCodeInputProps) {
  const [inputCode, setInputCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset promo input cleanly when target order changes
  useEffect(() => {
    setInputCode('');
    setErrorMsg(null);
    onPromoChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleApply = async () => {
    const cleaned = inputCode.trim().toUpperCase();
    if (!cleaned) {
      setErrorMsg('Please enter a promo code.');
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);
    try {
      const result = await promoService.validate({
        code: cleaned,
        dossierId: dossierId || null,
        groupBatchId: groupBatchId || null,
        invoiceId: invoiceId || null,
        scope: targetType,
        cartItems: cartItems && cartItems.length > 0 ? cartItems : undefined,
      });
      onPromoChange(result);
      setInputCode(result.promo.code);
    } catch (err: any) {
      onPromoChange(null);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Promo code could not be applied.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setInputCode('');
    setErrorMsg(null);
    onPromoChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isValidating && !disabled) {
        handleApply();
      }
    }
  };

  const rate = appliedPromo?.eurToAznRate || exchangeRate || 1.85;
  const origEur = appliedPromo ? appliedPromo.originalAmountEur : Number(grossAmountEur || 0);
  const discEur = appliedPromo ? appliedPromo.discountAmountEur : 0;
  const finalEur = appliedPromo ? appliedPromo.finalAmountEur : origEur;

  const formatAmt = (eurVal: number) => {
    if (displayCurrency === 'AZN') {
      const azn = Number((eurVal * rate).toFixed(2));
      return `${azn.toFixed(2)} AZN (€${eurVal.toFixed(2)})`;
    }
    return `€${eurVal.toFixed(2)}`;
  };

  return (
    <div className="promo-widget">
      <div className="promo-widget-header">
        <span className="promo-widget-label">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          Promo Code
        </span>
        {appliedPromo && (
          <span className="promo-widget-applied-tag">
            Applied: {appliedPromo.promo.code}
          </span>
        )}
      </div>

      {!appliedPromo ? (
        <div className="promo-widget-row">
          <input
            type="text"
            className="promo-widget-input"
            value={inputCode}
            onChange={(e) => {
              setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter promo code (e.g. EURO2026)"
            maxLength={32}
            disabled={disabled || isValidating}
          />
          <button
            type="button"
            className="promo-widget-apply-btn"
            onClick={handleApply}
            disabled={disabled || isValidating || !inputCode.trim()}
          >
            {isValidating ? 'Checking...' : 'Apply'}
          </button>
        </div>
      ) : (
        <div className="promo-widget-active-box">
          <div className="promo-widget-active-info">
            <span className="promo-widget-code-chip">{appliedPromo.promo.code}</span>
            <span className="promo-widget-desc">
              {appliedPromo.promo.discountType === 'PERCENTAGE'
                ? `${appliedPromo.promo.discountValue}% discount`
                : `€${Number(appliedPromo.promo.discountValue).toFixed(2)} discount`}
              {appliedPromo.promo.applyTarget === 'SERVICE_AND_EXTRAS_ONLY' ? ' (service fees)' : ''}
            </span>
          </div>
          <button
            type="button"
            className="promo-widget-remove-btn"
            onClick={handleRemove}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      )}

      {errorMsg && <div className="promo-widget-error">{errorMsg}</div>}

      {appliedPromo && (
        <div className="promo-widget-breakdown">
          <div className="promo-breakdown-row">
            <span>Original Payable</span>
            <span>{formatAmt(origEur)}</span>
          </div>
          <div className="promo-breakdown-row discount">
            <span>Promo Discount ({appliedPromo.promo.code})</span>
            <span>-{formatAmt(discEur)}</span>
          </div>
          <div className="promo-breakdown-row total">
            <span>Net Payable</span>
            <strong>{formatAmt(finalEur)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
