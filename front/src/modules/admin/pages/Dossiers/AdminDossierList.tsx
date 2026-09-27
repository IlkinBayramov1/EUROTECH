import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '@/shared/api/services/admin.service';
import type { AdminDossier } from '@/shared/types/admin.types';
import './AdminDossierList.css';

export default function AdminDossierList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Query Param state synchronization
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialPortal = searchParams.get('portalType') || 'ALL';
  const initialSearch = searchParams.get('search') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [portalFilter, setPortalFilter] = useState<string>(initialPortal);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const [dossiers, setDossiers] = useState<AdminDossier[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getAllDossiers({
        status: statusFilter,
        portalType: portalFilter,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.data) {
        setDossiers(res.data.dossiers || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.warn('Failed to fetch dossiers for admin:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, portalFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  // Update query params on filter change
  const handleFilterApply = (newStatus: string, newPortal: string, newSearch: string) => {
    setStatusFilter(newStatus);
    setPortalFilter(newPortal);
    setSearchQuery(newSearch);
    setCurrentPage(1);

    const params: Record<string, string> = {};
    if (newStatus !== 'ALL') params.status = newStatus;
    if (newPortal !== 'ALL') params.portalType = newPortal;
    if (newSearch) params.search = newSearch;
    setSearchParams(params);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'badge-approved';
      case 'REJECTED': return 'badge-rejected';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'NEEDS_CORRECTION': return 'badge-warning';
      case 'SUBMITTED_TO_CONSULATE': return 'badge-consulate';
      default: return 'badge-received';
    }
  };

  const getPortalBadge = (portalType: string) => {
    switch (portalType) {
      case 'GROUP_AGENT': return <span className="admin-tag tag-agent">Agency Group</span>;
      case 'CORPORATE': return <span className="admin-tag tag-corp">Corporate</span>;
      default: return <span className="admin-tag tag-client">Individual</span>;
    }
  };

  return (
    <div className="admin-dossier-list-view">
      {/* --- PAGE HEADER --- */}
      <div className="dossiers-header">
        <div>
          <h1 className="dossiers-title">Dossier Registry & Verification Hub</h1>
          <p className="dossiers-subtitle">
            Search, filter, and inspect visa applications across all consular jurisdictions.
          </p>
        </div>
        <div className="dossiers-header-meta">
          <span className="count-pill">
            <strong>{totalCount}</strong> Total Registered Dossiers
          </span>
        </div>
      </div>

      {/* --- FILTER CONTROLS BAR --- */}
      <div className="dossiers-filter-bar">
        {/* Search */}
        <div className="filter-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search dossier code, passport, applicant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFilterApply(statusFilter, portalFilter, searchQuery);
              }
            }}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => handleFilterApply(statusFilter, portalFilter, '')}>
              ×
            </button>
          )}
        </div>

        {/* Portal Filter */}
        <div className="filter-select-group">
          <label>Portal Channel:</label>
          <select 
            value={portalFilter} 
            onChange={(e) => handleFilterApply(statusFilter, e.target.value, searchQuery)}
          >
            <option value="ALL">All Channels</option>
            <option value="INDIVIDUAL">Individual (B2C)</option>
            <option value="GROUP_AGENT">Agency Groups (B2B)</option>
            <option value="CORPORATE">Corporate HR (B2B)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-select-group">
          <label>Consular Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => handleFilterApply(e.target.value, portalFilter, searchQuery)}
          >
            <option value="ALL">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="NEEDS_CORRECTION">Needs Correction</option>
            <option value="SUBMITTED_TO_CONSULATE">Submitted to Consulate</option>
            <option value="APPROVED">Approved (Visa Issued)</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Reset */}
        {(statusFilter !== 'ALL' || portalFilter !== 'ALL' || searchQuery) && (
          <button 
            className="btn-reset-filters"
            onClick={() => handleFilterApply('ALL', 'ALL', '')}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* --- TABLE CONTENT --- */}
      <div className="dossiers-table-panel">
        {loading ? (
          <div className="dossiers-loading">
            <div className="spinner"></div>
            <span>Fetching consular records from database...</span>
          </div>
        ) : dossiers.length === 0 ? (
          <div className="dossiers-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="8" y1="15" x2="16" y2="15"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            <h3>No matching dossiers found</h3>
            <p>Try adjusting your search query or filter criteria.</p>
            <button className="btn-action-primary" onClick={() => handleFilterApply('ALL', 'ALL', '')}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dossier Code</th>
                  <th>Primary Applicant</th>
                  <th>Passport No.</th>
                  <th>Destination & Category</th>
                  <th>Channel</th>
                  <th>Appointment</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => {
                  const primaryApplicant = d.applicants?.[0];
                  const passportNum = primaryApplicant?.passportNumber || d.user?.phone || '—';
                  const appointmentStr = d.appointmentDate 
                    ? new Date(d.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : (d.appointments?.[0]?.timeSlot?.date ? new Date(d.appointments[0].timeSlot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not Booked');

                  return (
                    <tr 
                      key={d.id} 
                      className="table-row-hover"
                      onClick={() => navigate(`/admin/dossiers/${d.id}`)}
                    >
                      <td>
                        <div className="dossier-code-cell">
                          <span className="code-text">{d.dossierNumber}</span>
                          <span className="code-date">{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-cell">
                          <strong>{primaryApplicant ? `${primaryApplicant.firstName} ${primaryApplicant.lastName}` : (d.user?.fullName || 'Applicant')}</strong>
                          <span>{d.user?.email || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="passport-text">{passportNum}</span>
                      </td>
                      <td>
                        <div className="destination-cell">
                          <span className="dest-name">{d.country?.nameEn || d.country?.nameAz || 'Schengen'}</span>
                          <span className="dest-category">{d.visaCategory?.nameEn || d.visaCategory?.nameAz || 'Visa'}</span>
                        </div>
                      </td>
                      <td>{getPortalBadge(d.portalType)}</td>
                      <td>
                        <div className="appointment-cell">
                          <span className="appt-date">{appointmentStr}</span>
                          <span className="appt-loc">{d.appointmentLocation || d.appointments?.[0]?.timeSlot?.location || 'Center'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="fee-cell">{formatCurrency(d.totalAmount || 0)}</span>
                      </td>
                      <td>
                        <span className={`admin-badge ${getStatusBadgeClass(d.status)}`}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-examine"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/dossiers/${d.id}`);
                          }}
                        >
                          Review Desk →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- PAGINATION BAR --- */}
        {totalPages > 1 && (
          <div className="dossiers-pagination">
            <div className="pagination-info">
              Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount} items)
            </div>
            <div className="pagination-controls">
              <button 
                className="btn-page"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="page-ellipsis">…</span>}
                    <button
                      className={`btn-page-number ${p === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button 
                className="btn-page"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
