import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService } from '@/shared/api/services/dossier.service';
import { serviceService } from '@/shared/api/services/service.service';
import './ClientServices.css';

interface ServiceItem {
    id: string;
    title: string;
    category: string;
    description: string;
    price: number;
    icon: React.ReactNode;
}

interface Applicant {
    id: string;
    name: string;
    isPrimary?: boolean;
}

interface PurchasedService {
    id: string;
    dossierId: string;
    applicantId?: string | null;
    serviceType: string;
    price: number;
    status: string;
    createdAt?: string;
}

interface CartItem {
    serviceId: string;
    applicantId: string;
}

const CANONICAL_ALIASES: Record<string, string> = {
    LOUNGE: 'PREMIUM_LOUNGE',
    PREMIUM_LOUNGE: 'PREMIUM_LOUNGE',
    FILEPREP: 'FILE_PREPARATION',
    FILE_PREPARATION: 'FILE_PREPARATION',
    INSURANCE: 'TRAVEL_INSURANCE',
    TRAVEL_INSURANCE: 'TRAVEL_INSURANCE',
    HOTEL: 'HOTEL_BOOKING',
    HOTEL_BOOKING: 'HOTEL_BOOKING',
    FLIGHT: 'FLIGHT_BOOKING',
    FLIGHT_BOOKING: 'FLIGHT_BOOKING',
    FORMASSIST: 'FORM_ASSIST',
    FORM_ASSIST: 'FORM_ASSIST',
    COURIER: 'COURIER',
    PHOTO: 'BIOMETRIC_PHOTO',
    BIOMETRIC_PHOTO: 'BIOMETRIC_PHOTO',
    EXPRESS: 'EXPRESS_PROCESSING',
    EXPRESS_PROCESSING: 'EXPRESS_PROCESSING',
    TRANSLATION: 'TRANSLATION_APOSTILLE',
    TRANSLATION_APOSTILLE: 'TRANSLATION_APOSTILLE',
};

function normalizeServiceType(raw?: string | null): string {
    if (!raw) return '';
    const clean = String(raw).trim().toUpperCase().replace(/[\s-]/g, '_');
    return CANONICAL_ALIASES[clean] || clean;
}

export default function ClientServices() {
    const { showSuccess, showError } = useToast();

    const [dossierId, setDossierId] = useState<string | null>(null);
    const [dossierNumber, setDossierNumber] = useState<string>('');
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<string>('');
    const [purchasedServices, setPurchasedServices] = useState<PurchasedService[]>([]);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    const availableServices: ServiceItem[] = [
        {
            id: 'PREMIUM_LOUNGE',
            title: 'Premium Lounge Access',
            category: 'Comfort & Speed',
            price: 81.00,
            description: 'Dedicated quiet space, prime time slots, refreshments, and personal concierge support.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                    <line x1="6" y1="1" x2="6" y2="4"/>
                    <line x1="10" y1="1" x2="10" y2="4"/>
                    <line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
            )
        },
        {
            id: 'FILE_PREPARATION',
            title: 'File Preparation',
            category: 'Documentation',
            price: 55.00,
            description: 'Thorough verification of documents and completeness check to maximize visa acceptance.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
            )
        },
        {
            id: 'TRAVEL_INSURANCE',
            title: 'Travel Medical Insurance',
            category: 'Required Coverage',
            price: 35.00,
            description: 'Official Schengen-compliant health & emergency coverage up to €30,000 for your travel dates.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M8 11h8"/>
                    <path d="M12 7v8"/>
                </svg>
            )
        },
        {
            id: 'HOTEL_BOOKING',
            title: 'Hotel Reservation',
            category: 'Accommodation',
            price: 15.00,
            description: 'Verifiable dummy hotel itinerary with valid confirmation number required for visa submission.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
            )
        },
        {
            id: 'FLIGHT_BOOKING',
            title: 'Flight Itinerary',
            category: 'Travel Route',
            price: 15.00,
            description: 'Official airline round-trip reservation with active PNR code without upfront ticket purchase.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2 11 13"/>
                    <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
            )
        },
        {
            id: 'FORM_ASSIST',
            title: 'Form Completion',
            category: 'Expert Assistance',
            price: 24.00,
            description: 'Expert review and precision completion of the national/Schengen visa application form.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/>
                </svg>
            )
        },
        {
            id: 'COURIER',
            title: 'Courier Delivery',
            category: 'Secure Logistics',
            price: 20.00,
            description: 'Direct secure and tracked delivery of your processed passport straight to your home or office.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
            )
        },
        {
            id: 'BIOMETRIC_PHOTO',
            title: 'Compliant ID Photo',
            category: 'Biometrics',
            price: 12.00,
            description: '100% Schengen and ICAO compliant biometric passport photo service taken directly on-site.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            )
        },
        {
            id: 'EXPRESS_PROCESSING',
            title: 'Express Processing',
            category: 'Priority',
            price: 60.00,
            description: 'Priority document triage and expedited processing queue for rapid consular delivery.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
            )
        },
        {
            id: 'TRANSLATION_APOSTILLE',
            title: 'Translation & Apostille',
            category: 'Legalization',
            price: 45.00,
            description: 'Official notarized legal translation and apostille certification of required civil documents.',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
            )
        },
    ];

    const loadDossierData = useCallback(async () => {
        try {
            const res = await dossierService.getMyDossiers();
            const dossiers = res.data?.dossiers || [];
            if (dossiers.length > 0) {
                const active = dossiers[0];
                setDossierId(active.id);
                setDossierNumber(active.dossierNumber || '');

                // Active purchased services from DB
                const activeServices: PurchasedService[] = (active.services || []).filter(
                    (s: any) => s.status === 'ACTIVE'
                );
                setPurchasedServices(activeServices);

                // Applicants
                if (active.applicants && active.applicants.length > 0) {
                    const mapped: Applicant[] = active.applicants.map((a: any, idx: number) => ({
                        id: a.id,
                        name: `${a.firstName} ${a.lastName} ${idx === 0 ? '(Primary)' : '(Co-Applicant)'}`,
                        isPrimary: idx === 0
                    }));
                    setApplicants(mapped);
                    if (!selectedApplicant || !mapped.some(m => m.id === selectedApplicant)) {
                        setSelectedApplicant(mapped[0].id);
                    }
                } else {
                    // Fallback to default primary applicant if no relations exist yet
                    const fallbackApplicant: Applicant = {
                        id: 'primary-applicant',
                        name: 'Primary Applicant',
                        isPrimary: true
                    };
                    setApplicants([fallbackApplicant]);
                    setSelectedApplicant(fallbackApplicant.id);
                }
            }
        } catch (err) {
            console.error('Failed to load active dossier for services:', err);
            showError('Could not load dossier services. Please refresh.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedApplicant, showError]);

    useEffect(() => {
        loadDossierData();
    }, [loadDossierData]);

    // Check if a service is already purchased in DB for the specified applicant
    const getPurchasedItem = (serviceId: string, applicantId: string) => {
        const canonical = normalizeServiceType(serviceId);
        return purchasedServices.find(s => {
            const matchType = normalizeServiceType(s.serviceType) === canonical;
            const matchApp = !s.applicantId || s.applicantId === applicantId;
            return matchType && matchApp && s.status === 'ACTIVE';
        });
    };

    const toggleService = (serviceId: string, applicantId: string, isPurchased: boolean) => {
        if (isPurchased) return;

        setCart(prev => {
            const exists = prev.find(item => item.serviceId === serviceId && item.applicantId === applicantId);
            if (exists) {
                return prev.filter(item => !(item.serviceId === serviceId && item.applicantId === applicantId));
            } else {
                return [...prev, { serviceId, applicantId }];
            }
        });
    };

    const handleRemoveFromCart = (serviceId: string, applicantId: string) => {
        setCart(prev => prev.filter(item => !(item.serviceId === serviceId && item.applicantId === applicantId)));
    };

    const handleRemovePurchased = async (serviceRecordId: string, serviceTitle: string) => {
        if (!window.confirm(`Are you sure you want to cancel and remove "${serviceTitle}"?`)) {
            return;
        }

        setDeletingId(serviceRecordId);
        try {
            await serviceService.removeService(serviceRecordId);
            showSuccess(`"${serviceTitle}" has been cancelled and removed from your dossier.`);
            await loadDossierData();
        } catch (err: any) {
            console.error('Remove service error:', err);
            showError(err.response?.data?.message || err.message || 'Failed to remove service.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenCheckoutModal = () => {
        if (cart.length === 0) {
            showError('Please select at least one service to proceed.');
            return;
        }
        setShowCheckoutModal(true);
    };

    const executeCheckout = async () => {
        if (!dossierId || cart.length === 0) return;

        setIsProcessing(true);
        try {
            const payload = {
                dossierId,
                items: cart.map(c => ({
                    serviceType: c.serviceId,
                    applicantId: c.applicantId === 'primary-applicant' ? undefined : c.applicantId,
                }))
            };

            const res = await serviceService.checkout(payload);
            const msg = res.data?.message || `Successfully booked ${cart.length} service(s) for ${totalAmount.toFixed(2)} AZN!`;
            showSuccess(msg);
            setCart([]);
            setShowCheckoutModal(false);
            await loadDossierData();
        } catch (err: any) {
            console.error('Checkout error:', err);
            showError(err.response?.data?.message || err.message || 'Payment processing failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const totalAmount = cart.reduce((sum, cartItem) => {
        const service = availableServices.find(s => s.id === cartItem.serviceId);
        return sum + (service ? service.price : 0);
    }, 0);

    const getApplicantDisplayName = (appId?: string | null) => {
        if (!appId) return 'Primary Applicant';
        const found = applicants.find(a => a.id === appId);
        return found ? found.name.split(' (')[0] : 'Applicant';
    };

    return (
        <div className="services-page-content fade-in">
            {/* Header & Applicant Selector */}
            <div className="services-header-premium">
                <div className="header-titles">
                    <div className="header-badge-row">
                        <span className="live-status-pill">Active Visa Dossier</span>
                        {dossierNumber && <span className="dossier-pill">{dossierNumber}</span>}
                    </div>
                    <h1 className="docs-title">Value-Added Services</h1>
                    <p className="docs-subtitle">
                        Enhance your visa appointment and application journey with official VIP and convenience services.
                    </p>
                </div>
                
                <div className="applicant-selector-box">
                    <label htmlFor="applicant-select">Configuring Services For:</label>
                    <div className="premium-select-wrapper compact">
                        <select 
                            id="applicant-select"
                            value={selectedApplicant} 
                            onChange={(e) => setSelectedApplicant(e.target.value)}
                        >
                            {applicants.map(app => (
                                <option key={app.id} value={app.id}>{app.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="services-layout-grid">
                {/* Left Column: Service Cards */}
                <div className="services-list-column">
                    <div className="services-cards-grid">
                        {availableServices.map((service) => {
                            const purchasedItem = getPurchasedItem(service.id, selectedApplicant);
                            const isPurchased = !!purchasedItem;
                            const isSelected = cart.some(item => item.serviceId === service.id && item.applicantId === selectedApplicant);

                            return (
                                <div 
                                    key={service.id} 
                                    className={`premium-service-card ${isSelected ? 'selected' : ''} ${isPurchased ? 'locked' : ''}`}
                                    onClick={() => toggleService(service.id, selectedApplicant, isPurchased)}
                                >
                                    {isPurchased && (
                                        <div className="locked-badge">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                            Active in Dossier
                                        </div>
                                    )}
                                    
                                    <div className="service-card-top">
                                        <div className="service-icon">
                                            {service.icon}
                                        </div>
                                        <div className="service-price">
                                            {service.price.toFixed(2)} <span>AZN</span>
                                        </div>
                                    </div>

                                    <div className="service-card-body">
                                        <span className="service-category">{service.category}</span>
                                        <h3>{service.title}</h3>
                                        <p>{service.description}</p>
                                    </div>

                                    <div className="service-card-footer">
                                        {isPurchased ? (
                                            <div className="purchased-action-row" onClick={e => e.stopPropagation()}>
                                                <div className="checkbox-indicator locked">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                </div>
                                                <span className="text-locked">Booked & Confirmed</span>
                                                <button 
                                                    type="button"
                                                    className="btn-cancel-service" 
                                                    disabled={deletingId === purchasedItem.id}
                                                    onClick={() => handleRemovePurchased(purchasedItem.id, service.title)}
                                                    title="Cancel and remove this service from your dossier"
                                                >
                                                    {deletingId === purchasedItem.id ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="checkbox-indicator">
                                                    {isSelected ? (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                    ) : (
                                                        <div className="empty-circle"></div>
                                                    )}
                                                </div>
                                                <span className={isSelected ? 'text-selected' : 'text-add'}>
                                                    {isSelected ? 'Added to Cart' : 'Add to Cart'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Active Purchased Services Overview Table */}
                    {purchasedServices.length > 0 && (
                        <div className="active-dossier-services-section">
                            <div className="section-title-wrap">
                                <div className="icon-badge-green">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                </div>
                                <div>
                                    <h3>Confirmed Services for Dossier</h3>
                                    <p>The following services are already active and included in your dossier record.</p>
                                </div>
                            </div>

                            <div className="active-services-list">
                                {purchasedServices.map(srv => {
                                    const canonical = normalizeServiceType(srv.serviceType);
                                    const catalogInfo = availableServices.find(s => s.id === canonical);
                                    const title = catalogInfo?.title || srv.serviceType.replace(/_/g, ' ');
                                    const applicantName = getApplicantDisplayName(srv.applicantId);

                                    return (
                                        <div key={srv.id} className="active-service-row">
                                            <div className="srv-info">
                                                <div className="srv-bullet"></div>
                                                <div>
                                                    <span className="srv-title">{title}</span>
                                                    <span className="srv-applicant">Applicant: {applicantName}</span>
                                                </div>
                                            </div>
                                            <div className="srv-meta">
                                                <span className="srv-price">{srv.price.toFixed(2)} AZN</span>
                                                <span className="srv-badge-paid">Paid / Active</span>
                                                <button 
                                                    type="button"
                                                    className="btn-text-danger"
                                                    disabled={deletingId === srv.id}
                                                    onClick={() => handleRemovePurchased(srv.id, title)}
                                                >
                                                    {deletingId === srv.id ? 'Removing...' : 'Cancel'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Order Summary Cart */}
                <aside className="services-summary-column">
                    <div className="order-summary-card sticky-box">
                        <div className="order-summary-header">
                            <h3>Order Summary</h3>
                            {cart.length > 0 && <span className="cart-badge-count">{cart.length}</span>}
                        </div>
                        
                        {cart.length > 0 ? (
                            <div className="cart-items-list">
                                {cart.map((item, index) => {
                                    const serviceInfo = availableServices.find(s => s.id === item.serviceId);
                                    const applicantInfo = applicants.find(a => a.id === item.applicantId);
                                    if (!serviceInfo || !applicantInfo) return null;

                                    return (
                                        <div key={`${item.serviceId}-${item.applicantId}-${index}`} className="cart-item-row fade-in">
                                            <div className="cart-item-details">
                                                <h4>{serviceInfo.title}</h4>
                                                <span className="cart-applicant-name">For: {applicantInfo.name.split(' (')[0]}</span>
                                                <button 
                                                    type="button"
                                                    className="btn-remove" 
                                                    onClick={() => handleRemoveFromCart(item.serviceId, item.applicantId)}
                                                >
                                                    Remove from cart
                                                </button>
                                            </div>
                                            <div className="cart-item-price">{serviceInfo.price.toFixed(2)} AZN</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-cart">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="9" cy="21" r="1"/>
                                    <circle cx="20" cy="21" r="1"/>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                                </svg>
                                <p>No additional services selected. Choose an applicant and select services above to add to your order.</p>
                            </div>
                        )}

                        <div className="summary-total-section">
                            <div className="total-row">
                                <span>Selected Services</span>
                                <span>{cart.length} item(s)</span>
                            </div>
                            <div className="total-row">
                                <span>Currency</span>
                                <span>AZN (Azerbaijani Manat)</span>
                            </div>
                            <div className="total-row final-total">
                                <span>Total to Pay</span>
                                <span>{totalAmount.toFixed(2)} AZN</span>
                            </div>
                        </div>

                        <button 
                            type="button"
                            className="btn-primary checkout-btn" 
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleOpenCheckoutModal}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Proceed to Checkout
                        </button>

                        <div className="secure-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <span>Official Visa Center Secure Payment</span>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Checkout Confirmation Modal */}
            {showCheckoutModal && (
                <div className="checkout-modal-overlay" onClick={() => !isProcessing && setShowCheckoutModal(false)}>
                    <div className="checkout-modal-card fade-in" onClick={e => e.stopPropagation()}>
                        <div className="checkout-modal-header">
                            <div className="modal-title-group">
                                <h3>Confirm Value-Added Services</h3>
                                {dossierNumber && <span className="modal-dossier-tag">Dossier: {dossierNumber}</span>}
                            </div>
                            <button 
                                type="button"
                                className="modal-close-btn" 
                                onClick={() => setShowCheckoutModal(false)}
                                disabled={isProcessing}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="checkout-modal-body">
                            <p className="modal-instructions">
                                Please review your selected services before finalizing payment. The confirmed items will be linked to your dossier and receipt will be issued in AZN.
                            </p>

                            <div className="modal-items-review-list">
                                {cart.map((item, idx) => {
                                    const srv = availableServices.find(s => s.id === item.serviceId);
                                    const app = applicants.find(a => a.id === item.applicantId);
                                    if (!srv) return null;

                                    return (
                                        <div key={idx} className="modal-review-row">
                                            <div className="modal-review-info">
                                                <span className="modal-srv-title">{srv.title}</span>
                                                <span className="modal-srv-target">For: {app?.name || 'Applicant'}</span>
                                            </div>
                                            <span className="modal-srv-price">{srv.price.toFixed(2)} AZN</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="modal-payment-gateway-box">
                                <div className="gateway-header">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                    <span>EuroTech Visa Center Payment Gateway</span>
                                </div>
                                <div className="gateway-details">
                                    <span>Currency: <strong>AZN</strong></span>
                                    <span>Status: <strong>Immediate Confirmation</strong></span>
                                </div>
                            </div>

                            <div className="modal-total-summary-row">
                                <span>Grand Total to Pay:</span>
                                <span className="modal-grand-amount">{totalAmount.toFixed(2)} AZN</span>
                            </div>
                        </div>

                        <div className="checkout-modal-footer">
                            <button 
                                type="button"
                                className="btn-secondary" 
                                onClick={() => setShowCheckoutModal(false)}
                                disabled={isProcessing}
                            >
                                Back / Modify
                            </button>
                            <button 
                                type="button"
                                className="btn-primary modal-confirm-btn" 
                                onClick={executeCheckout}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                                        Processing Payment...
                                    </>
                                ) : (
                                    <>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                        Confirm & Pay {totalAmount.toFixed(2)} AZN
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}