import React, { useEffect, useState } from 'react';
import { vcmsApi, DOCUMENT_CATEGORY_TYPES } from '../../api/vcmsApi';
import '../../styles/vcms.css';

export default function DocumentPoolPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    nameEn: '',
    nameAz: '',
    descriptionEn: '',
    descriptionAz: '',
    category: 'IDENTITY',
    defaultRequired: true,
    allowedFormats: 'pdf,jpg,jpeg,png',
    maxFileSizeMb: 15,
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPool = async () => {
    try {
      const res = await vcmsApi.listDocumentPool({
        search,
        category: categoryFilter,
      });
      setDocuments(res.data?.documents || []);
    } catch (err: any) {
      notify(err.message || 'Failed to load Document Pool');
    }
  };

  useEffect(() => {
    loadPool();
  }, [search, categoryFilter]);

  const openEditor = (d?: any) => {
    if (d) {
      setEditingDoc(d);
      setForm({
        nameEn: d.nameEn || '',
        nameAz: d.nameAz || '',
        descriptionEn: d.descriptionEn || '',
        descriptionAz: d.descriptionAz || '',
        category: d.category || 'IDENTITY',
        defaultRequired: Boolean(d.defaultRequired),
        allowedFormats: d.allowedFormats || 'pdf,jpg,jpeg,png',
        maxFileSizeMb: d.maxFileSizeMb || 15,
      });
    } else {
      setEditingDoc(null);
      setForm({
        nameEn: '',
        nameAz: '',
        descriptionEn: '',
        descriptionAz: '',
        category: 'PURPOSE_SPECIFIC',
        defaultRequired: true,
        allowedFormats: 'pdf,jpg,jpeg,png',
        maxFileSizeMb: 15,
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDoc) {
        await vcmsApi.updateGlobalDocument(editingDoc.id, form);
        notify(`Global Document ${editingDoc.documentCode} updated`);
      } else {
        const res = await vcmsApi.createGlobalDocument(form);
        notify(`Global Document ${res.data.document.documentCode} created in pool!`);
      }
      setShowModal(false);
      await loadPool();
    } catch (err: any) {
      notify(err.message || 'Failed to save document');
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
            Central Document Pool
            <span className="vcms-badge code">{documents.length} Global Documents</span>
          </h1>
          <p>
            Central repository of reusable required documents (DOC-001, DOC-002...). Every document has a unique code
            so customer uploads map 1:1 to the exact requirement.
          </p>
        </div>
        <button className="vcms-btn accent" onClick={() => openEditor()}>
          + Add Document to Pool
        </button>
      </div>

      <div className="vcms-toolbar">
        <div className="vcms-filters">
          <input
            className="vcms-input"
            style={{ minWidth: 280 }}
            placeholder="Search by Document ID (DOC-001), name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="vcms-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Document Categories</option>
            {DOCUMENT_CATEGORY_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="vcms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="vcms-table">
          <thead>
            <tr>
              <th>Document ID</th>
              <th>Document Name & Description</th>
              <th>Category</th>
              <th>Default Rule</th>
              <th>Used In Countries</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="vcms-badge code">{d.documentCode}</span>
                </td>
                <td>
                  <strong>{d.nameEn}</strong>{' '}
                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({d.nameAz})</span>
                  <div style={{ fontSize: '0.79rem', color: '#475569', marginTop: 3 }}>{d.descriptionEn}</div>
                </td>
                <td>
                  <span className="vcms-badge info">{d.category}</span>
                </td>
                <td>
                  <span className={`vcms-badge ${d.defaultRequired ? 'required' : 'inactive'}`}>
                    {d.defaultRequired ? 'Required' : 'Optional'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(d.usedInCountries || []).map((c: any) => (
                      <span key={c.code} className="vcms-badge active">
                        {c.code} ({c.purposesCount})
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="vcms-btn sm secondary" onClick={() => openEditor(d)}>
                    Edit Global
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>
                {editingDoc
                  ? `Edit Global Document (${editingDoc.documentCode})`
                  : '+ Add Document to Central Pool (Auto DOC-xxx)'}
              </h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Document Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Document Name (AZ)</label>
                  <input
                    className="vcms-input"
                    value={form.nameAz}
                    onChange={(e) => setForm({ ...form, nameAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Document Category</label>
                  <select
                    className="vcms-select"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {DOCUMENT_CATEGORY_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Default Requirement</label>
                  <select
                    className="vcms-select"
                    value={String(form.defaultRequired)}
                    onChange={(e) => setForm({ ...form, defaultRequired: e.target.value === 'true' })}
                  >
                    <option value="true">Required</option>
                    <option value="false">Optional</option>
                  </select>
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Description & Upload Guidance (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    value={form.descriptionEn}
                    onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save to Central Document Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
