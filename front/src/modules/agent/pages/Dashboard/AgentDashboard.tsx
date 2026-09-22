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
    createdAt?: string;
}

interface ActivityItem {
    id: string;
    title: string;
    description: string;
    time: string;
    isNew?: boolean;
}

export default function AgentDashboard() {
    const navigate = useNavigate();
    const [groupsCount, setGroupsCount] = useState<number>(0);
    const [applicantsCount, setApplicantsCount] = useState<number>(0);
    const [commission, setCommission] = useState<number>(0);
    const [recentGroups, setRecentGroups] = useState<GroupSummary[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function loadAgentData() {
            setLoading(true);
            try {
                const [groupsRes, walletRes, apptsRes] = await Promise.allSettled([
                    agentService.getGroups(),
                    agentService.getWallet(),
                    agentService.getAgentAppointments(),
                ]);

                let realGroups: any[] = [];
                let totalApps = 0;

                if (groupsRes.status === 'fulfilled' && groupsRes.value.data?.groups) {
                    realGroups = groupsRes.value.data.groups;
                    setGroupsCount(realGroups.length);

                    const mapped: GroupSummary[] = realGroups.slice(0, 5).map((g: any) => {
                        const count = g.applicantsCount ?? (g.applicants ? g.applicants.length : (g.dossiers?.[0]?.applicants?.length ?? 0));
                        totalApps += count;
                        return {
                            id: g.id,
                            code: g.code || `GRP-${g.id.slice(0, 4)}`,
                            name: g.name || 'Tour Group',
                            size: count,
                            status: g.status ? g.status.toLowerCase() : 'draft',
                            createdAt: g.createdAt,
                        };
                    });

                    // Also calculate total apps across all groups if more than 5 exist
                    if (realGroups.length > 5) {
                        totalApps = realGroups.reduce((acc: number, g: any) => {
                            const c = g.applicantsCount ?? (g.applicants ? g.applicants.length : (g.dossiers?.[0]?.applicants?.length ?? 0));
                            return acc + c;
                        }, 0);
                    }

                    setRecentGroups(mapped);
                    setApplicantsCount(totalApps);
                } else {
                    setRecentGroups([]);
                    setGroupsCount(0);
                    setApplicantsCount(0);
                }

                let walletData: any = null;
                if (walletRes.status === 'fulfilled' && walletRes.value.data?.wallet) {
                    walletData = walletRes.value.data.wallet;
                    setCommission(Number(walletData.balance ?? 0));
                } else {
                    setCommission(0);
                }

                let appointments: any[] = [];
                if (apptsRes.status === 'fulfilled' && apptsRes.value.data?.appointments) {
                    appointments = apptsRes.value.data.appointments;
                }

                // Construct Real Activity Feed dynamically from database records
                const realActivities: ActivityItem[] = [];

                // 1. Group events
                realGroups.forEach((g: any) => {
                    const date = new Date(g.createdAt || Date.now());
                    const timeStr = date.toLocaleDateString('az-AZ', { month: 'short', day: 'numeric', year: 'numeric' });
                    if (g.status === 'SUBMITTED' || g.status === 'PROCESSING') {
                        realActivities.push({
                            id: `group-sub-${g.id}`,
                            title: 'Group Submitted',
                            description: `${g.name} (${g.code}) submitted for visa processing`,
                            time: timeStr,
                            isNew: true,
                        });
                    } else {
                        realActivities.push({
                            id: `group-reg-${g.id}`,
                            title: 'New Group Registered',
                            description: `${g.name} (${g.code}) initialized with ${g.applicantsCount || 0} passengers`,
                            time: timeStr,
                            isNew: false,
                        });
                    }
                });

                // 2. Appointment events
                appointments.forEach((app: any) => {
                    const rawDate = app.timeSlot?.date || app.appointmentDate || app.createdAt || Date.now();
                    const date = new Date(rawDate);
                    const timeStr = date.toLocaleDateString('az-AZ', { month: 'short', day: 'numeric', year: 'numeric' });
                    const slotTime = app.timeSlot?.startTime || '10:00 AM';
                    const groupName = app.groupInfo?.name || app.groupBatch?.name || 'Tour Group';
                    realActivities.push({
                        id: `appt-${app.id}`,
                        title: 'Consular Appointment Scheduled',
                        description: `${groupName} appointment set for ${timeStr} (${slotTime})`,
                        time: timeStr,
                        isNew: false,
                    });
                });

                // 3. Wallet transaction events
                if (walletData && walletData.transactions) {
                    walletData.transactions.forEach((tx: any) => {
                        const date = new Date(tx.createdAt || Date.now());
                        const timeStr = date.toLocaleDateString('az-AZ', { month: 'short', day: 'numeric', year: 'numeric' });
                        const isCredit = tx.type === 'CREDIT';
                        realActivities.push({
                            id: `tx-${tx.id}`,
                            title: isCredit ? 'Commission Credited' : 'Payout Processed',
                            description: `€ ${Math.abs(tx.amount).toFixed(2)} - ${tx.description}`,
                            time: timeStr,
                            isNew: isCredit,
                        });
                    });
                }

                setActivities(realActivities.slice(0, 5));
            } catch (err) {
                console.warn('Agent dashboard data fetch note:', err);
            } finally {
                setLoading(false);
            }
        }
        loadAgentData();
    }, []);

    const getStatusLabelClass = (status: string) => {
        switch (status.toLowerCase()) {
            case 'ready':
            case 'approved':
                return 'ready';
            case 'action_req':
            case 'action_required':
            case 'rejected':
                return 'action-req';
            case 'submitted':
            case 'processing':
                return 'processing';
            case 'draft':
            default:
                return 'draft';
        }
    };

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
                        <h3>€ {commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
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
                                    {recentGroups.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '48px 24px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px', color: 'var(--color-neutral)', opacity: 0.5 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>No group applications found</p>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--color-neutral)' }}>You haven't registered any tour groups matching your agency yet.</span>
                                                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', marginTop: '6px' }} onClick={() => navigate('/agent/create-group')}>
                                                        + Register First Group
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        recentGroups.map((g) => (
                                            <tr key={g.id}>
                                                <td><strong>{g.code}</strong></td>
                                                <td>{g.name}</td>
                                                <td>{g.size}</td>
                                                <td>
                                                    <span className={`status-label ${getStatusLabelClass(g.status)}`}>
                                                        {g.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn-icon-action" onClick={() => navigate('/agent/groups')} title="View Group Dossier">
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

                {/* Right Column: Activity & Support */}
                <div className="dash-column-right">
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Agency Activity</h3>
                        </div>
                        {activities.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-neutral)' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '32px', height: '32px', margin: '0 auto 8px', opacity: 0.5, display: 'block' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <p style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)' }}>No recent activity yet</p>
                                <span style={{ fontSize: '0.82rem' }}>Actions such as group registrations and commission payouts will appear here.</span>
                            </div>
                        ) : (
                            <div className="activity-timeline">
                                {activities.map((act) => (
                                    <div className="activity-item" key={act.id}>
                                        <div className={`activity-dot ${act.isNew ? 'new' : ''}`}></div>
                                        <div className="activity-content">
                                            <p><strong>{act.title}</strong></p>
                                            <span>{act.description}</span>
                                            <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px', opacity: 0.7 }}>{act.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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