import React from 'react';
import { evaluateFrontendConditionSet } from '@/modules/admin/api/vcmsApi';

export interface VcmsQuestionItem {
  configId: string;
  questionId: string;
  questionCode: string;
  titleEn: string;
  titleAz?: string;
  officialTextEn?: string;
  officialTextAz?: string;
  helpTextEn?: string | null;
  answerType: string;
  categoryCode?: string;
  categoryNameEn?: string;
  categoryNameAz?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isVisible?: boolean;
  schengenPdfFieldKey?: string | null;
  options?: Array<{
    optionCode: string;
    labelEn: string;
    labelAz?: string;
    displayOrder?: number;
  }>;
  validation?: {
    minLength?: number | null;
    maxLength?: number | null;
    regexPattern?: string | null;
    minDate?: string | null;
    maxDate?: string | null;
    dateDirection?: string | null;
    errorMessageEn?: string | null;
    errorMessageAz?: string | null;
  } | null;
  conditions?: any[];
}

interface DynamicVcmsFormRendererProps {
  questions: VcmsQuestionItem[];
  answers: Record<string, any>;
  onAnswerChange: (question: VcmsQuestionItem, value: any) => void;
  stepFilter?: number | null;
  countryName?: string;
  visaTypeName?: string;
  visaPurposeName?: string;
  readOnly?: boolean;
}

const COMMON_COUNTRIES = [
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'AT', name: 'Austria' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TR', name: 'Turkey' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'GE', name: 'Georgia' },
];

export function validateVcmsQuestionValue(q: VcmsQuestionItem, rawValue: any): string | null {
  const v = q.validation;
  if (!v) return null;
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  const strVal = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);

  if (v.minLength && strVal.length < v.minLength) {
    return v.errorMessageEn || `Minimum ${v.minLength} characters required.`;
  }
  if (v.maxLength && strVal.length > v.maxLength) {
    return v.errorMessageEn || `Maximum ${v.maxLength} characters allowed.`;
  }
  if (v.regexPattern) {
    try {
      const rx = new RegExp(v.regexPattern);
      if (!rx.test(strVal)) {
        return v.errorMessageEn || 'Value format is invalid.';
      }
    } catch {
      // Ignore invalid regex in config
    }
  }
  if (q.answerType === 'DATE' && strVal) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (v.dateDirection === 'PAST_ONLY' && strVal > todayStr) {
      return v.errorMessageEn || 'Date must be in the past.';
    }
    if (v.dateDirection === 'FUTURE_ONLY' && strVal < todayStr) {
      return v.errorMessageEn || 'Date must be in the future.';
    }
    if (v.minDate && strVal < String(v.minDate).slice(0, 10)) {
      return v.errorMessageEn || `Date cannot be earlier than ${String(v.minDate).slice(0, 10)}.`;
    }
    if (v.maxDate && strVal > String(v.maxDate).slice(0, 10)) {
      return v.errorMessageEn || `Date cannot be later than ${String(v.maxDate).slice(0, 10)}.`;
    }
  }
  return null;
}

export default function DynamicVcmsFormRenderer({
  questions,
  answers,
  onAnswerChange,
  stepFilter = null,
  countryName,
  visaTypeName,
  visaPurposeName,
  readOnly = false,
}: DynamicVcmsFormRendererProps) {
  if (!questions || questions.length === 0) return null;

  const filteredQuestions = questions.filter((q) => {
    if (stepFilter !== null && stepFilter !== undefined) {
      const catPrefix = String(q.categoryNameEn || '').trim()[0];
      const matchesStep =
        catPrefix === String(stepFilter) ||
        (!['1', '2', '3', '4', '5'].includes(catPrefix) && stepFilter === 5);
      if (!matchesStep) return false;
    }
    const evalState = evaluateFrontendConditionSet(q, answers);
    return evalState.isVisible;
  });

  if (filteredQuestions.length === 0) return null;

  // Group by categoryNameEn when stepFilter is null
  const groupedByCategory: Record<string, VcmsQuestionItem[]> = {};
  for (const q of filteredQuestions) {
    const catKey = q.categoryNameEn || 'Consular Questions';
    if (!groupedByCategory[catKey]) groupedByCategory[catKey] = [];
    groupedByCategory[catKey].push(q);
  }

  const renderControl = (q: VcmsQuestionItem, isRequired: boolean) => {
    const val = answers[q.questionCode];
    const type = String(q.answerType || 'TEXT').toUpperCase();
    const baseInputStyle: React.CSSProperties = {
      padding: '9px 12px',
      borderRadius: 10,
      border: '1px solid #cbd5e1',
      background: readOnly ? '#f1f5f9' : '#ffffff',
      fontSize: '0.86rem',
      color: '#0f172a',
      width: '100%',
    };

    if (type === 'SINGLE_SELECT') {
      return (
        <select
          disabled={readOnly}
          required={isRequired}
          style={baseInputStyle}
          value={Array.isArray(val) ? val[0] || '' : val || ''}
          onChange={(e) => onAnswerChange(q, e.target.value)}
        >
          <option value="">-- Select Option --</option>
          {(q.options || []).map((o) => (
            <option key={o.optionCode} value={o.optionCode}>
              {o.labelEn}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'MULTIPLE_SELECT') {
      const selectedArr: string[] = Array.isArray(val)
        ? val
        : typeof val === 'string' && val
          ? val.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      return (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: readOnly ? '#f1f5f9' : '#ffffff',
          }}
        >
          {(q.options || []).map((o) => {
            const checked = selectedArr.includes(o.optionCode);
            return (
              <label
                key={o.optionCode}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: checked ? '#eff6ff' : '#f8fafc',
                  border: checked ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  color: checked ? '#1d4ed8' : '#334155',
                  fontWeight: checked ? 700 : 500,
                  cursor: readOnly ? 'default' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...selectedArr, o.optionCode]))
                      : selectedArr.filter((code) => code !== o.optionCode);
                    onAnswerChange(q, next);
                  }}
                />
                {o.labelEn}
              </label>
            );
          })}
        </div>
      );
    }

    if (type === 'YES_NO') {
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          {['YES', 'NO'].map((choice) => {
            const active = String(val || '').toUpperCase() === choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={readOnly}
                onClick={() => onAnswerChange(q, choice)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: active ? '#eff6ff' : '#ffffff',
                  color: active ? '#1d4ed8' : '#334155',
                  fontWeight: 700,
                  fontSize: '0.83rem',
                  cursor: readOnly ? 'default' : 'pointer',
                }}
              >
                {choice === 'YES' ? 'Yes' : 'No'}
              </button>
            );
          })}
        </div>
      );
    }

    if (type === 'TEXTAREA' || type === 'ADDRESS') {
      return (
        <textarea
          disabled={readOnly}
          required={isRequired}
          rows={type === 'ADDRESS' ? 2 : 3}
          style={{ ...baseInputStyle, resize: 'vertical' }}
          placeholder={
            type === 'ADDRESS'
              ? 'Street, Building, City, Postal Code, Country'
              : q.officialTextEn || q.titleEn
          }
          value={val || ''}
          onChange={(e) => onAnswerChange(q, e.target.value)}
        />
      );
    }

    if (type === 'COUNTRY_SELECT') {
      return (
        <select
          disabled={readOnly}
          required={isRequired}
          style={baseInputStyle}
          value={val || ''}
          onChange={(e) => onAnswerChange(q, e.target.value)}
        >
          <option value="">-- Select Country --</option>
          {(q.options && q.options.length > 0
            ? q.options.map((o) => ({ code: o.optionCode, name: o.labelEn }))
            : COMMON_COUNTRIES
          ).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      );
    }

    if (type === 'REPEATER') {
      const entries: string[] = Array.isArray(val)
        ? val
        : typeof val === 'string' && val
          ? (() => {
              try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : [val];
              } catch {
                return val.split('\n').filter(Boolean);
              }
            })()
          : [''];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((entry, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                disabled={readOnly}
                style={baseInputStyle}
                placeholder={`Entry #${idx + 1} (${q.titleEn})`}
                value={entry}
                onChange={(e) => {
                  const next = [...entries];
                  next[idx] = e.target.value;
                  onAnswerChange(q, next);
                }}
              />
              {!readOnly && entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = entries.filter((_, i) => i !== idx);
                    onAnswerChange(q, next);
                  }}
                  style={{
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onAnswerChange(q, [...entries, ''])}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px dashed #2563eb',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add Another Entry
            </button>
          )}
        </div>
      );
    }

    if (type === 'FILE_UPLOAD') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!readOnly && (
            <input
              type="file"
              style={{ ...baseInputStyle, padding: '6px 10px' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAnswerChange(q, f.name);
              }}
            />
          )}
          {val && (
            <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
              Attached: {String(val)}
            </span>
          )}
        </div>
      );
    }

    const htmlInputType =
      type === 'DATE'
        ? 'date'
        : type === 'NUMBER'
          ? 'number'
          : type === 'EMAIL'
            ? 'email'
            : type === 'PHONE'
              ? 'tel'
              : 'text';

    return (
      <input
        type={htmlInputType}
        disabled={readOnly}
        required={isRequired}
        style={baseInputStyle}
        placeholder={q.officialTextEn || q.titleEn}
        value={val || ''}
        onChange={(e) => onAnswerChange(q, e.target.value)}
      />
    );
  };

  return (
    <div
      style={{
        marginTop: 20,
        padding: 18,
        borderRadius: 14,
        border: '1px solid #cbd5e1',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <strong style={{ color: '#0f172a', fontSize: '0.96rem' }}>
            {countryName || 'Country'} Configured Consular Questions
            {stepFilter ? ` (Step ${stepFilter})` : ''}
          </strong>
          {(visaTypeName || visaPurposeName) && (
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>
              {visaTypeName} {visaPurposeName ? `→ ${visaPurposeName}` : ''}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: '0.74rem',
            padding: '3px 10px',
            borderRadius: 999,
            background: '#e0e7ff',
            color: '#3730a3',
            fontWeight: 700,
          }}
        >
          VCMS Dynamic Form ({filteredQuestions.length} Active)
        </span>
      </div>

      {Object.entries(groupedByCategory).map(([categoryTitle, catQuestions]) => (
        <div key={categoryTitle} style={{ marginBottom: 16 }}>
          {stepFilter === null && Object.keys(groupedByCategory).length > 1 && (
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: '#1e3a8a',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 10,
                paddingBottom: 4,
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {categoryTitle}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {catQuestions.map((q) => {
              const evalState = evaluateFrontendConditionSet(q, answers);
              const valError = validateVcmsQuestionValue(q, answers[q.questionCode]);
              return (
                <div key={q.configId || q.questionCode} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    <code
                      style={{
                        color: '#2563eb',
                        background: '#eff6ff',
                        padding: '1px 6px',
                        borderRadius: 5,
                        marginRight: 6,
                        fontSize: '0.74rem',
                      }}
                    >
                      {q.questionCode}
                    </code>
                    {q.titleEn}
                    {evalState.isRequired && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
                  </label>
                  {renderControl(q, evalState.isRequired)}
                  {q.helpTextEn && (
                    <span style={{ fontSize: '0.73rem', color: '#64748b' }}>{q.helpTextEn}</span>
                  )}
                  {valError && (
                    <span style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 600 }}>
                      {valError}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
