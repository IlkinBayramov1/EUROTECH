import React from 'react';
import './ClientDashboard.css';

export default function ClientDashboard() {
    return (
        <div className="dashboard-content fade-in">
            {/* --- Header Section --- */}
            <div className="dash-header-premium">
                <div className="dash-header-info">
                    <h1 className="dash-title">Welcome back, Ali!</h1>
                    <p className="dash-subtitle">Manage your visa applications, complete pending tasks, and track your progress.</p>
                </div>
                <div className="dash-header-actions">
                    <div className="client-id-badge">Client ID: <strong>AZ12X34C5</strong></div>
                </div>
            </div>

            {/* --- Top Statistics Grid (4 Cards) --- */}
            <div className="dash-grid-top-v2">
                <div className="dash-stat-card active-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Current Status</span>
                        <h3>In Progress</h3>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Documents</span>
                        <h3>2 Missing / 6 Uploaded</h3>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Appointment</span>
                        <h3>Sep 6, 10:45 AM</h3>
                    </div>
                </div>
                <div className="dash-stat-card warning-card">
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Pending Tasks</span>
                        <h3>2 Action Required</h3>
                    </div>
                </div>
            </div>

            {/* --- Main Layout Grid --- */}
            <div className="dash-grid-main-v2">
                {/* Left Column (Wider) */}
                <div className="dash-column-left">
                    
                    {/* Visual Progress Bar */}
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Application Progress</h3>
                            <span className="status-label">Step 2 of 5</span>
                        </div>
                        <div className="progress-container-v2">
                            <div className="progress-track">
                                <div className="progress-fill" style={{ width: '35%' }}></div>
                            </div>
                            <div className="progress-labels">
                                <span className="completed">1. Received</span>
                                <span className="active">2. Preparation</span>
                                <span>3. Submission</span>
                                <span>4. Consulate</span>
                                <span>5. Ready</span>
                            </div>
                        </div>
                    </div>

                    {/* To-Do List (Action Required) */}
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Action Required (To-Do List)</h3>
                        </div>
                        <ul className="action-list-v2">
                            <li className="action-item pending">
                                <div className="action-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div className="action-details">
                                    <h4>Upload Financial Documents (Leyla)</h4>
                                    <p>Bank statements and proof of employment are missing for the co-applicant.</p>
                                </div>
                                <button className="btn-action">Upload Now</button>
                            </li>
                            <li className="action-item pending">
                                <div className="action-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>
                                </div>
                                <div className="action-details">
                                    <h4>Complete Application Form (Ali)</h4>
                                    <p>Your official consular form is currently 40% complete. Please finish all sections.</p>
                                </div>
                                <button className="btn-action">Resume</button>
                            </li>
                            <li className="action-item completed">
                                <div className="action-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                                <div className="action-details">
                                    <h4>Pay Initial Consular Fees</h4>
                                    <p>Payment of 145.00 AZN was successfully processed.</p>
                                </div>
                                <span className="status-text-done">Done</span>
                            </li>
                        </ul>
                    </div>

                    {/* Application Summary */}
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Application Summary</h3>
                            <button className="btn-text-link">View Full Details</button>
                        </div>
                        <div className="summary-details-grid">
                            <div className="summary-box">
                                <span>Destination</span>
                                <strong>Hungary</strong>
                            </div>
                            <div className="summary-box">
                                <span>Visa Category</span>
                                <strong>Schengen C (Short Stay)</strong>
                            </div>
                            <div className="summary-box">
                                <span>Total Applicants</span>
                                <strong>2 Persons</strong>
                            </div>
                            <div className="summary-box">
                                <span>Travel Dates</span>
                                <strong>Oct 10 - Oct 24, 2026</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (Narrower) */}
                <div className="dash-column-right">
                    
                    {/* Quick Links */}
                    <div className="dash-card quick-links-card">
                        <div className="card-header">
                            <h3>Quick Actions</h3>
                        </div>
                        <div className="quick-links-list">
                            <button className="quick-link-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download Receipt
                            </button>
                            <button className="quick-link-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Reschedule Appointment
                            </button>
                            <button className="quick-link-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Contact Agent
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Recent Activity</h3>
                        </div>
                        <div className="activity-timeline-v2">
                            <div className="activity-item">
                                <div className="activity-dot new"></div>
                                <div className="activity-content">
                                    <p><strong>Travel Insurance Purchased</strong></p>
                                    <span>Today, 11:30 AM</span>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-dot"></div>
                                <div className="activity-content">
                                    <p><strong>Passport Copy Uploaded (Ali)</strong></p>
                                    <span>Yesterday, 09:15 AM</span>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-dot"></div>
                                <div className="activity-content">
                                    <p><strong>Application Created</strong></p>
                                    <span>Aug 26, 2026 at 16:20 PM</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Premium Upsell Card */}
                    <div className="dash-premium-upsell">
                        <div className="premium-icon-gold">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                        </div>
                        <h3>Avoid the wait!</h3>
                        <p>Upgrade to Premium Lounge for a private, dedicated quiet space during your appointment.</p>
                        <button className="btn-upgrade-gold">Add for 81.00 AZN</button>
                    </div>
                </div>
            </div>
        </div>
    );
}