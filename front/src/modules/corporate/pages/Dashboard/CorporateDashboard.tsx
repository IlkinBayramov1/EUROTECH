import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { corporateService } from '@/shared/api/services/corporate.service';
import './CorporateDashboard.css';

interface DashboardData {
    stats: {
        activeBatches: number;
        missingDocs: number;
        approvedVisas: number;
        totalEmployees: number;
        nextAppointment: {
            id: string;
            date: string;
            time: string;
            status: string;
            batchCode?: string;
        } | null;
        walletBalance: number;
        currency: string;
    };
    recentBatches: Array<{
        id: string;
        code: string;
        name: string;
        destination: string;
        duration?: string;
        status: string;
        employeesCount: number;
        readiness: number;
        hasPendingInvoice: boolean;
    }>;
    recentActivities: Array<{
        id: string;
        action: string;
        details: any;
        createdAt: string;
    }>;
}

export default function CorporateDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const companyDisplayName = user?.companyName || user?.fullName || 'Corporate Mobility';

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await corporateService.getDashboardStats();
            if (res.data) {
                setData(res.data);
            }
        } catch (err: any) {
            console.warn('Failed to load corporate dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleRemindBatch = async (batchId: string, batchName: string) => {
        try {
            showSuccess(`Reminder notifications queued for employees in "${batchName}".`);
        } catch {
            showError('Failed to send reminders.');
        }
    };

    const stats = data?.stats || {
        activeBatches: 0,
        missingDocs: 0,
        approvedVisas: 0,
        totalEmployees: 0,
        nextAppointment: null,
        walletBalance: 0,
        currency: 'EUR',
    };

    const batches = data?.recentBatches || [];
    const activities = data?.recentActivities || [];

    return (
        <div className="corp-dash-content fade-in">
            {/* --- Premium Header --- */}
            <div className="corp-dash-header">
                <div className="header-titles">
                    <h1 className="dash-title">HR & Mobility Workspace</h1>
                    <p className="dash-subtitle">Manage employee visa batches, track corporate invoices, and oversee global mobility for <strong>{companyDisplayName}</strong>.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-outline-secondary" onClick={() => navigate('/corporate/finance')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        Manage Wallet
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/corporate/batches')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Create Employee Batch
                    </button>
                </div>
            </div>

            {/* --- Top Statistics Grid (4 Cards) --- */}
            <div className="corp-stats-grid">
                <div className="corp-stat-card active-card" onClick={() => navigate('/corporate/batches')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Active Batches</span>
                        <h3>{loading ? '...' : `${stats.activeBatches} In Process`}</h3>
                    </div>
                </div>

                <div className="corp-stat-card warning-card" onClick={() => navigate('/corporate/batches')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Action Required</span>
                        <h3>{loading ? '...' : `${stats.missingDocs} Missing Docs`}</h3>
                    </div>
                </div>

                <div className="corp-stat-card success-card" onClick={() => navigate('/corporate/employees')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Active Visas / Directory</span>
                        <h3>{loading ? '...' : `${stats.approvedVisas} Active (${stats.totalEmployees} Total)`}</h3>
                    </div>
                </div>

                <div className="corp-stat-card" onClick={() => navigate('/corporate/appointments')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Upcoming Appointment</span>
                        <h3>
                            {loading ? '...' : stats.nextAppointment
                                ? `${new Date(stats.nextAppointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${stats.nextAppointment.time}`
                                : 'No Scheduled Slots'}
                        </h3>
                    </div>
                </div>
            </div>

            {/* --- Main Layout Grid --- */}
            <div className="corp-main-grid">
                
                {/* LEFT COLUMN: Actions & Batches */}
                <div className="corp-column-left">
                    
                    {/* Action Center / To-Do List */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>HR Action Center</h3>
                            <span className={`corp-badge ${stats.missingDocs > 0 || batches.some(b => b.hasPendingInvoice) ? 'badge-warning' : 'badge-success'}`}>
                                {stats.missingDocs > 0 || batches.some(b => b.hasPendingInvoice) ? 'Priority Items' : 'All Settled'}
                            </span>
                        </div>
                        <ul className="corp-action-list">
                            {batches.some(b => b.hasPendingInvoice) && (
                                <li className="corp-action-item">
                                    <div className="action-icon danger">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                    </div>
                                    <div className="action-details">
                                        <h4>Pending Proforma Invoices</h4>
                                        <p>You have batches awaiting consular fee settlement to confirm embassy slots.</p>
                                    </div>
                                    <div className="action-buttons">
                                        <button className="btn-action danger" onClick={() => navigate('/corporate/finance')}>Pay Now</button>
                                    </div>
                                </li>
                            )}

                            {stats.missingDocs > 0 && (
                                <li className="corp-action-item">
                                    <div className="action-icon warning">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>
                                    <div className="action-details">
                                        <h4>Missing Applicant Documents</h4>
                                        <p>{stats.missingDocs} required document(s) pending across your employee batch dossiers.</p>
                                    </div>
                                    <div className="action-buttons">
                                        <button className="btn-action" onClick={() => navigate('/corporate/batches')}>Review Batches</button>
                                    </div>
                                </li>
                            )}

                            {!batches.some(b => b.hasPendingInvoice) && stats.missingDocs === 0 && (
                                <li className="corp-action-item">
                                    <div className="action-icon success">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    </div>
                                    <div className="action-details">
                                        <h4>All Systems Clear</h4>
                                        <p>All corporate employee records and invoices are up to date. Ready for new submissions.</p>
                                    </div>
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* Recent Employee Batches Table */}
                    <div className="corp-panel-card table-wrapper">
                        <div className="panel-header">
                            <h3>Active Employee Batches</h3>
                            <button className="btn-text-link" onClick={() => navigate('/corporate/batches')}>View All Batches</button>
                        </div>
                        
                        <div className="corp-table-container">
                            <table className="corp-table">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Project / Destination</th>
                                        <th>Employees</th>
                                        <th>Readiness</th>
                                        <th>Status</th>
                                        <th className="text-right">Manage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--color-neutral)' }}>
                                                {loading ? 'Connecting to corporate database...' : 'No batches created yet. Click "Create Employee Batch" to begin.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        batches.map(b => (
                                            <tr key={b.id}>
                                                <td className="cell-bold">{b.code}</td>
                                                <td>
                                                    {b.name} <br/>
                                                    <span className="sub-text">{b.destination} • {b.duration === 'long' ? 'Long Stay (D)' : 'Short Stay (C)'}</span>
                                                </td>
                                                <td>{b.employeesCount}</td>
                                                <td>
                                                    <div className="progress-indicator">
                                                        <div className="progress-bg">
                                                            <div 
                                                                className={`progress-fill ${b.readiness >= 100 ? 'success' : b.readiness >= 50 ? 'warning' : ''}`} 
                                                                style={{ width: `${b.readiness}%` }}
                                                            ></div>
                                                        </div>
                                                        <span>{b.readiness}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`corp-badge ${
                                                        b.status === 'READY' || b.status === 'COMPLETED' ? 'badge-success' :
                                                        b.status === 'PROCESSING' ? 'badge-processing' :
                                                        b.hasPendingInvoice ? 'badge-warning' : 'badge-neutral'
                                                    }`}>
                                                        {b.hasPendingInvoice ? 'Awaiting Payment' : b.status}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <button className="btn-icon-action" onClick={() => navigate('/corporate/batches')}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Wallet & Quick Links */}
                <div className="corp-column-right">
                    
                    {/* Wallet Summary Card */}
                    <div className="corp-panel-card premium-bg-card">
                        <div className="wallet-header">
                            <div className="wallet-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                            </div>
                            <div>
                                <h3>Company Wallet</h3>
                                <p>Pre-funded mobility balance</p>
                            </div>
                        </div>
                        <div className="wallet-balance">
                            <h2>€ {loading ? '...' : stats.walletBalance.toFixed(2)}</h2>
                        </div>
                        <div className="wallet-actions">
                            <button className="btn-wallet-outline" onClick={() => navigate('/corporate/finance')}>Billing History</button>
                            <button className="btn-wallet-solid" onClick={() => navigate('/corporate/finance')}>Add Funds</button>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>Quick Actions</h3>
                        </div>
                        <div className="quick-links-list">
                            <button className="quick-link-btn" onClick={() => navigate('/corporate/batches')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                Manage Visa Batches
                            </button>
                            <button className="quick-link-btn" onClick={() => navigate('/corporate/employees')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                Employee Directory
                            </button>
                            <button className="quick-link-btn" onClick={() => navigate('/corporate/appointments')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                Biometric Appointments
                            </button>
                        </div>
                    </div>

                    {/* Recent HR Activity */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>HR Activity Log</h3>
                        </div>
                        <div className="corp-timeline">
                            {activities.length === 0 ? (
                                <div style={{ color: 'var(--color-neutral)', fontStyle: 'italic', fontSize: '0.9rem', padding: '16px', textAlign: 'center' }}>
                                    No recent activity logged yet.
                                </div>
                            ) : (
                                activities.map((act, index) => (
                                    <div key={act.id || index} className="timeline-item">
                                        <div className={`timeline-dot ${index === 0 ? 'new' : ''}`}></div>
                                        <div className="timeline-content">
                                            <p><strong>{act.action?.replace(/_/g, ' ') || 'Action Logged'}</strong></p>
                                            <span>{act.details?.batchName || act.details?.message || new Date(act.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}