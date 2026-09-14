import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CorporateDashboard.css';

export default function CorporateDashboard() {
    const navigate = useNavigate();

    return (
        <div className="corp-dash-content fade-in">
            {/* --- Premium Header --- */}
            <div className="corp-dash-header">
                <div className="header-titles">
                    <h1 className="dash-title">HR & Mobility Workspace</h1>
                    <p className="dash-subtitle">Manage employee visa batches, track corporate invoices, and oversee global mobility for <strong>Tech Innovators LLC</strong>.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-outline-secondary" onClick={() => navigate('/corporate/finance')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        Manage Wallet
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/corporate/create-batch')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        Create Employee Batch
                    </button>
                </div>
            </div>

            {/* --- Top Statistics Grid (4 Cards) --- */}
            <div className="corp-stats-grid">
                <div className="corp-stat-card active-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Active Batches</span>
                        <h3>4 Processing</h3>
                    </div>
                </div>
                <div className="corp-stat-card warning-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Action Required</span>
                        <h3>2 Missing Docs</h3>
                    </div>
                </div>
                <div className="corp-stat-card success-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Visas Approved (YTD)</span>
                        <h3>45 Employees</h3>
                    </div>
                </div>
                <div className="corp-stat-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Upcoming Appointment</span>
                        <h3>Sep 12, 09:00 AM</h3>
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
                            <span className="corp-badge badge-warning">Priority</span>
                        </div>
                        <ul className="corp-action-list">
                            <li className="corp-action-item">
                                <div className="action-icon warning">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div className="action-details">
                                    <h4>Missing Employment Letter</h4>
                                    <p>Employee <strong>David Smith</strong> (Batch: Berlin Relocation) has not uploaded his signed offer letter.</p>
                                </div>
                                <div className="action-buttons">
                                    <button className="btn-text-secondary" onClick={() => alert('Reminder email sent to employee.')}>Remind</button>
                                    <button className="btn-action" onClick={() => navigate('/corporate/batches')}>Upload</button>
                                </div>
                            </li>
                            <li className="corp-action-item">
                                <div className="action-icon danger">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                </div>
                                <div className="action-details">
                                    <h4>Pending Proforma Invoice</h4>
                                    <p>Batch <strong>BCH-2026-101</strong> (Vienna Summit) requires payment of €1,450 to confirm the appointment.</p>
                                </div>
                                <div className="action-buttons">
                                    <button className="btn-action danger" onClick={() => navigate('/corporate/finance')}>Pay Now</button>
                                </div>
                            </li>
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
                                    <tr>
                                        <td className="cell-bold">BCH-2026-101</td>
                                        <td>Vienna Summit <br/><span className="sub-text">Austria • Short Stay</span></td>
                                        <td>12</td>
                                        <td>
                                            <div className="progress-indicator">
                                                <div className="progress-bg"><div className="progress-fill warning" style={{ width: '85%' }}></div></div>
                                                <span>85%</span>
                                            </div>
                                        </td>
                                        <td><span className="corp-badge badge-warning">Awaiting Payment</span></td>
                                        <td className="text-right"><button className="btn-icon-action" onClick={() => navigate('/corporate/batches')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
                                    </tr>
                                    <tr>
                                        <td className="cell-bold">BCH-2026-098</td>
                                        <td>Berlin Relocation <br/><span className="sub-text">Germany • Long Stay (D)</span></td>
                                        <td>3</td>
                                        <td>
                                            <div className="progress-indicator">
                                                <div className="progress-bg"><div className="progress-fill" style={{ width: '100%' }}></div></div>
                                                <span>100%</span>
                                            </div>
                                        </td>
                                        <td><span className="corp-badge badge-processing">At Embassy</span></td>
                                        <td className="text-right"><button className="btn-icon-action" onClick={() => navigate('/corporate/batches')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
                                    </tr>
                                    <tr>
                                        <td className="cell-bold">BCH-2026-095</td>
                                        <td>Budapest Training <br/><span className="sub-text">Hungary • Short Stay</span></td>
                                        <td>5</td>
                                        <td>
                                            <div className="progress-indicator">
                                                <div className="progress-bg"><div className="progress-fill success" style={{ width: '100%' }}></div></div>
                                                <span>100%</span>
                                            </div>
                                        </td>
                                        <td><span className="corp-badge badge-success">Visas Ready</span></td>
                                        <td className="text-right"><button className="btn-icon-action" onClick={() => navigate('/corporate/batches')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
                                    </tr>
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
                                <p>Pre-funded balance</p>
                            </div>
                        </div>
                        <div className="wallet-balance">
                            <h2>€ 12,500.00</h2>
                        </div>
                        <div className="wallet-actions">
                            <button className="btn-wallet-outline" onClick={() => alert('Redirecting to Invoice Generation...')}>Generate Invoice</button>
                            <button className="btn-wallet-solid" onClick={() => alert('Opening Credit Card payment gateway...')}>Add Funds</button>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>Quick Actions</h3>
                        </div>
                        <div className="quick-links-list">
                            <button className="quick-link-btn" onClick={() => navigate('/corporate/create-batch')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                Add Employees to New Batch
                            </button>
                            <button className="quick-link-btn" onClick={() => navigate('/corporate/appointments')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                View Company Appointments
                            </button>
                            <button className="quick-link-btn" onClick={() => alert('Opening employee delegation link manager...')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Manage Delegation Links
                            </button>
                        </div>
                    </div>

                    {/* Recent HR Activity */}
                    <div className="corp-panel-card">
                        <div className="panel-header">
                            <h3>HR Activity Log</h3>
                        </div>
                        <div className="corp-timeline">
                            <div className="timeline-item">
                                <div className="timeline-dot new"></div>
                                <div className="timeline-content">
                                    <p><strong>Batch Submitted</strong></p>
                                    <span>BCH-2026-098 sent to Embassy (Today)</span>
                                </div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <p><strong>Wallet Funded</strong></p>
                                    <span>€ 5,000 added via Wire Transfer (Yesterday)</span>
                                </div>
                            </div>
                            <div className="timeline-item">
                                <div className="timeline-dot"></div>
                                <div className="timeline-content">
                                    <p><strong>Delegation Link Sent</strong></p>
                                    <span>Sent to 12 employees for BCH-2026-101</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}