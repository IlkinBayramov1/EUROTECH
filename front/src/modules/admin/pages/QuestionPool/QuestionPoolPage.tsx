import React, { useEffect, useState } from 'react';
import { vcmsApi, QUESTION_ANSWER_TYPES } from '../../api/vcmsApi';
import '../../styles/vcms.css';

export default function QuestionPoolPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [answerTypeFilter, setAnswerTypeFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    titleEn: '',
    titleAz: '',
    officialTextEn: '',
    officialTextAz: '',
    defaultCategoryName: '2. Your Information',
    answerType: 'TEXT',
    defaultRequired: true,
    isReusable: true,
    isRepeatable: false,
    helpTextEn: '',
    schengenPdfFieldKey: '',
    options: [{ optionCode: '', labelEn: '', labelAz: '' }],
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPool = async () => {
    try {
      const res = await vcmsApi.listQuestionPool({
        search,
        answerType: answerTypeFilter,
      });
      setQuestions(res.data?.questions || []);
    } catch (err: any) {
      notify(err.message || 'Failed to load Question Pool');
    }
  };

  useEffect(() => {
    loadPool();
  }, [search, answerTypeFilter]);

  const openEditor = (q?: any) => {
    if (q) {
      setEditingQ(q);
      setForm({
        titleEn: q.titleEn || '',
        titleAz: q.titleAz || '',
        officialTextEn: q.officialTextEn || '',
        officialTextAz: q.officialTextAz || '',
        defaultCategoryName: q.defaultCategoryName || 'General Information',
        answerType: q.answerType || 'TEXT',
        defaultRequired: Boolean(q.defaultRequired),
        isReusable: Boolean(q.isReusable),
        isRepeatable: Boolean(q.isRepeatable),
        helpTextEn: q.helpTextEn || '',
        schengenPdfFieldKey: q.schengenPdfFieldKey || '',
        options:
          q.options?.length > 0
            ? q.options.map((o: any) => ({
                id: o.id,
                optionCode: o.optionCode,
                labelEn: o.labelEn,
                labelAz: o.labelAz || o.labelEn,
              }))
            : [{ optionCode: '', labelEn: '', labelAz: '' }],
      });
    } else {
      setEditingQ(null);
      setForm({
        titleEn: '',
        titleAz: '',
        officialTextEn: '',
        officialTextAz: '',
        defaultCategoryName: '2. Your Information',
        answerType: 'TEXT',
        defaultRequired: true,
        isReusable: true,
        isRepeatable: false,
        helpTextEn: '',
        schengenPdfFieldKey: '',
        options: [{ optionCode: '', labelEn: '', labelAz: '' }],
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        options: ['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(form.answerType)
          ? form.options.filter((o) => o.labelEn.trim())
          : [],
      };
      if (editingQ) {
        await vcmsApi.updateGlobalQuestion(editingQ.id, payload);
        notify(`Global Question ${editingQ.questionCode} updated (local country overrides preserved)`);
      } else {
        const res = await vcmsApi.createGlobalQuestion(payload);
        notify(`Global Question ${res.data.question.questionCode} added to pool!`);
      }
      setShowModal(false);
      await loadPool();
    } catch (err: any) {
      notify(err.message || 'Failed to save question');
    }
  };

  return (
    <div className="vcms-page">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '12px 18px',
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      <div className="vcms-header">
        <div className="vcms-title-group">
          <h1>
            Central Question Pool
            <span className="vcms-badge code">{questions.length} Global Questions</span>
          </h1>
          <p>
            Reusable central repository of application form questions (Q001, Q002...) across all 13 answer types.
            Two-Layer Architecture: Global Question definitions live here, while Country/Purpose overrides remain
            isolated.
          </p>
        </div>
        <button className="vcms-btn accent" onClick={() => openEditor()}>
          + Add Question to Pool
        </button>
      </div>

      <div className="vcms-toolbar">
        <div className="vcms-filters">
          <input
            className="vcms-input"
            style={{ minWidth: 280 }}
            placeholder="Search by Question ID (Q001), title, or official form text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="vcms-select"
            value={answerTypeFilter}
            onChange={(e) => setAnswerTypeFilter(e.target.value)}
          >
            <option value="ALL">All 13 Answer Types</option>
            {QUESTION_ANSWER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} ({t.value})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="vcms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="vcms-table">
          <thead>
            <tr>
              <th>Question ID</th>
              <th>Title & Official Form Text</th>
              <th>Default Category</th>
              <th>Answer Type</th>
              <th>Options (OPT_*)</th>
              <th>Used In Countries</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td>
                  <span className="vcms-badge code">{q.questionCode}</span>
                </td>
                <td>
                  <strong>{q.titleEn}</strong>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{q.officialTextEn}</div>
                </td>
                <td>{q.defaultCategoryName}</td>
                <td>
                  <span className="vcms-badge info">{q.answerType}</span>
                </td>
                <td>
                  {q.options?.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 260 }}>
                      {q.options.map((o: any) => (
                        <span key={o.optionCode} className="vcms-badge inactive" title={o.optionCode}>
                          {o.labelEn}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(q.usedInCountries || []).map((c: any) => (
                      <span key={c.code} className="vcms-badge active">
                        {c.code} ({c.purposesCount})
                      </span>
                    ))}
                    {(!q.usedInCountries || q.usedInCountries.length === 0) && (
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Unassigned</span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="vcms-btn sm secondary" onClick={() => openEditor(q)}>
                      Edit Global
                    </button>
                    <button
                      className="vcms-btn sm secondary"
                      onClick={async () => {
                        const res = await vcmsApi.duplicateGlobalQuestion(q.id);
                        await loadPool();
                        notify(`Duplicated as ${res.data.question.questionCode}`);
                      }}
                    >
                      Duplicate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="vcms-modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>
                {editingQ
                  ? `Edit Global Question Definition (${editingQ.questionCode})`
                  : '+ Add New Question to Central Pool (Auto Qxxx)'}
              </h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Question Title (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    value={form.titleEn}
                    onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Question Title (AZ)</label>
                  <input
                    className="vcms-input"
                    value={form.titleAz}
                    onChange={(e) => setForm({ ...form, titleAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Default Category</label>
                  <input
                    className="vcms-input"
                    value={form.defaultCategoryName}
                    onChange={(e) => setForm({ ...form, defaultCategoryName: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Answer Type *</label>
                  <select
                    className="vcms-select"
                    value={form.answerType}
                    onChange={(e) => setForm({ ...form, answerType: e.target.value })}
                  >
                    {QUESTION_ANSWER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Official Application Form Question Text (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    value={form.officialTextEn}
                    onChange={(e) => setForm({ ...form, officialTextEn: e.target.value })}
                  />
                </div>
              </div>

              {['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(form.answerType) && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>Options (Unique Option IDs: OPT_*)</strong>
                    <button
                      type="button"
                      className="vcms-btn sm secondary"
                      onClick={() =>
                        setForm({
                          ...form,
                          options: [...form.options, { optionCode: '', labelEn: '', labelAz: '' }],
                        })
                      }
                    >
                      + Add Option
                    </button>
                  </div>
                  {form.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="vcms-input"
                        placeholder="Label EN (e.g. Employed)"
                        value={opt.labelEn}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[idx].labelEn = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                      />
                      <input
                        className="vcms-input"
                        placeholder="Label AZ (e.g. İşləyir)"
                        value={opt.labelAz}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[idx].labelAz = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                      />
                      <input
                        className="vcms-input"
                        placeholder="Auto OPT_*"
                        value={opt.optionCode}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[idx].optionCode = e.target.value.toUpperCase();
                          setForm({ ...form, options: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save to Central Question Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
