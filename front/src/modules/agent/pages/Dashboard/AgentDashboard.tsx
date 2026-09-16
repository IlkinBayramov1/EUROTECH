import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '@/shared/api/services/agent.service';
import './AgentDashboard.css';

interface GroupSummary {
    id: string;
    code: string;
    name: string;
    size: number;
    status: string;
}

export default function AgentDashboard() {
    const navigate = useNavigate();
    const [groupsCount, setGroupsCount] = useState(12);
    const [applicantsCount, setApplicantsCount] = useState(48);
    const [commission, setCommission] = useState(3450.00);
    const [recentGroups, setRecentGroups] = useState<GroupSummary[]>([
        { id: '1', code: 'GRP-8821', name: 'Budapest Delegation', size: 10, status: 'processing' },
        { id: '2', code: 'GRP-8845', name: 'Vienna Summer Tour', size: 5, status: 'action_req' },
        { id: '3', code: 'GRP-8902', name: 'Exchange Fall \'26', size: 8, status: 'ready' },
    ]);

    useEffect(() => {
        async function loadAgentData() {
            try {
                const [groupsRes, walletRes] = await Promise.allSettled([
                    agentService.getGroups(),
                    agentService.getWallet(),
                ]);

                if (groupsRes.status === 'fulfilled' && groupsRes.value.data?.groups) {
                    const groups = groupsRes.value.data.groups;
                    setGroupsCount(groups.length);
                    let totalApps = 0;
                    const mapped = groups.slice(0, 5).map((g: any) => {
                        const count = g.applicantsCount || (g.applicants ? g.applicants.length : (g.totalPassports || 5));
                        totalApps += count;
                        return {
                            id: g.id,
                            code: g.code || `GRP-${g.id.slice(0, 4)}`,
                            name: g.name || 'Tour Group',
                            size: count,
                            status: g.status ? g.status.toLowerCase() : 'processing',
                        };
                    });
                    if (mapped.length > 0) {
                        setRecentGroups(mapped);
                        setApplicantsCount(totalApps || 48);
                    }
                }

                if (walletRes.status === 'fulfilled' && walletRes.value.data?.wallet) {
                    setCommission(Number(walletRes.value.data.wallet.balance || 3450.00));
                }
            } catch (err) {
                console.warn('Agent dashboard data fetch note:', err);
            }
        }
        loadAgentData();
    }, []);

    return (
        <div className="dashboard-content fade-in">
            {/* Header */}
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">Agency Dashboard</h1>
                    <p className="dash-subtitle">Overview of your active groups, applications, and financial metrics.</p>
                </div>
                <button className="btn-primary" onClick={() => navigate('/agent/create-group')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', width: '18px'}}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    Create New Group
                </button>
            </div>

            {/* Top Cards (Stats) */}
            <div className="dash-grid-top">
                <div className="dash-stat-card active-card" onClick={() => navigate('/agent/groups')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Active Groups</span>
                        <h3>{groupsCount} Groups</h3>
                    </div>
                </div>
                <div className="dash-stat-card" onClick={() => navigate('/agent/groups')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Pending Applicants</span>
                        <h3>{applicantsCount} Applicants</h3>
                    </div>
                </div>
                <div className="dash-stat-card" onClick={() => navigate('/agent/finance')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <div className="stat-info">
                        <span>Agency Wallet Balance</span>
                        <h3>€ {commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
                    </div>
                </div>
            </div>

            <div className="dash-grid-main">
                {/* Left Column: Recent Groups Table */}
                <div className="dash-column-left">
                    <div className="dash-card table-card-wrapper">
                        <div className="card-header">
                            <h3>Recent Group Applications</h3>
                            <button className="btn-text" onClick={() => navigate('/agent/groups')}>View All</button>
                        </div>
                        
                        <div className="premium-table-container">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Group ID</th>
                                        <th>Name</th>
                                        <th>Size</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentGroups.map((g) => (
                                        <tr key={g.id}>
                                            <td><strong>{g.code}</strong></td>
                                            <td>{g.name}</td>
                                            <td>{g.size}</td>
                                            <td><span className={`status-label ${g.status === 'ready' ? 'ready' : g.status === 'action_req' ? 'action-req' : 'processing'}`}>{g.status.toUpperCase()}</span></td>
                                            <td>
                                                <button className="btn-icon-action" onClick={() => navigate('/agent/groups')} title="View Group Dossier">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity & Support */}
                <div className="dash-column-right">
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Agency Activity</h3>
                        </div>
                        <div className="activity-timeline">
                            <div className="activity-item">
                                <div className="activity-dot new"></div>
                                <div className="activity-content">
                                    <p><strong>Commission Paid</strong></p>
                                    <span>€ 450 credited to wallet</span>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-dot"></div>
                                <div className="activity-content">
                                    <p><strong>GRP-8845 Missing Docs</strong></p>
                                    <span>2 applicants need updated insurance</span>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-dot"></div>
                                <div className="activity-content">
                                    <p><strong>New Group Created</strong></p>
                                    <span>GRP-8902 initialized</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dash-premium-card">
                        <div className="premium-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        </div>
                        <h3>VIP Group Processing</h3>
                        <p>Need urgent visas for a corporate group? Use our VIP Fast-Track pipeline.</p>
                        <button className="btn-upgrade" onClick={() => navigate('/agent/create-group')}>Request VIP Slot</button>
                    </div>
                </div>
            </div>
        </div>
    );
}