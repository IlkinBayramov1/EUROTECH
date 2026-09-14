import React, { useState } from 'react';
import './ClientServices.css';

interface ServiceItem {
    id: string;
    title: string;
    description: string;
    price: number;
    icon: React.ReactNode;
}

interface Applicant {
    id: string;
    name: string;
}

interface CartItem {
    serviceId: string;
    applicantId: string;
}

export default function ClientServices() {
    // Sərnişinlər
    const [applicants] = useState<Applicant[]>([
        { id: 'app-1', name: 'Ali Mammadov (Primary)' },
        { id: 'app-2', name: 'Leyla Mammadova (Co-Applicant)' }
    ]);

    const [selectedApplicant, setSelectedApplicant] = useState<string>(applicants[0].id);
    
    // YENİ: Öncədən alınmış (paketə daxil olan və ya əvvəl ödənilmiş) xidmətlər
    // Ali üçün File Prep və Form Assist əvvəlki Premium paketindən gəlir.
    // Leyla üçün yalnız Form Assist alınıb.
    const [lockedServices] = useState<{ [key: string]: string[] }>({
        'app-1': ['filePrep', 'formAssist'], 
        'app-2': ['formAssist']
    });

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const availableServices: ServiceItem[] = [
        {
            id: 'lounge', title: 'Premium Lounge Access', price: 81.00,
            description: 'Dedicated quiet space, prime time slots, and personal support throughout the center.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
        },
        {
            id: 'filePrep', title: 'File Preparation', price: 55.00,
            description: 'Verification of documents and consistency check to maximize acceptance chances.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        },
        {
            id: 'insurance', title: 'Travel Medical Insurance', price: 35.00, 
            description: 'Schengen-compliant health coverage up to €30,000 for your travel dates.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8 11h8"/><path d="M12 7v8"/></svg>
        },
        {
            id: 'hotel', title: 'Hotel Reservation', price: 15.00,
            description: 'Verifiable dummy hotel booking required for your visa application.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        },
        {
            id: 'flight', title: 'Flight Itinerary', price: 15.00,
            description: 'Verifiable round-trip flight reservation without upfront ticket purchase.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        },
        {
            id: 'formAssist', title: 'Form Completion', price: 24.00,
            description: 'Assistance with filling out the official application form accurately.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>
        },
        {
            id: 'courier', title: 'Courier Delivery', price: 20.00,
            description: 'Secure and tracked delivery of your passport directly to your address.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        },
        {
            id: 'photo', title: 'Compliant ID Photo', price: 12.00,
            description: '100% Schengen and ICAO compliant biometric photos taken on-site.',
            icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        }
    ];

    const toggleService = (serviceId: string, applicantId: string, isLocked: boolean) => {
        if (isLocked) return; // Kilidlənmişsə heç bir əməliyyat etmə

        setCart(prev => {
            const exists = prev.find(item => item.serviceId === serviceId && item.applicantId === applicantId);
            if (exists) {
                return prev.filter(item => !(item.serviceId === serviceId && item.applicantId === applicantId));
            } else {
                return [...prev, { serviceId, applicantId }];
            }
        });
    };

    const handleCheckout = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            alert("Payment gateway module will be integrated here.");
        }, 1500);
    };

    const totalAmount = cart.reduce((sum, cartItem) => {
        const service = availableServices.find(s => s.id === cartItem.serviceId);
        return sum + (service ? service.price : 0);
    }, 0);

    return (
        <div className="services-page-content fade-in">
            {/* Header & Applicant Selector */}
            <div className="services-header-premium">
                <div className="header-titles">
                    <h1 className="docs-title">Value-Added Services</h1>
                    <p className="docs-subtitle">Enhance your application experience with our premium official services.</p>
                </div>
                
                <div className="applicant-selector-box">
                    <label>Managing Services For:</label>
                    <div className="premium-select-wrapper compact">
                        <select 
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

            <div className="services-layout-grid">
                {/* Sol Tərəf: Xidmət Kartları */}
                <div className="services-list-column">
                    <div className="services-cards-grid">
                        {availableServices.map((service) => {
                            const isLocked = lockedServices[selectedApplicant]?.includes(service.id);
                            const isSelected = cart.some(item => item.serviceId === service.id && item.applicantId === selectedApplicant);

                            return (
                                <div 
                                    key={service.id} 
                                    className={`premium-service-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                                    onClick={() => toggleService(service.id, selectedApplicant, isLocked)}
                                >
                                    {isLocked && <div className="locked-badge">Purchased</div>}
                                    
                                    <div className="service-card-top">
                                        <div className="service-icon">
                                            {service.icon}
                                        </div>
                                        <div className="service-price">
                                            {service.price.toFixed(2)} <span>AZN</span>
                                        </div>
                                    </div>
                                    <div className="service-card-body">
                                        <h3>{service.title}</h3>
                                        <p>{service.description}</p>
                                    </div>
                                    <div className="service-card-footer">
                                        {isLocked ? (
                                            <>
                                                <div className="checkbox-indicator locked">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                </div>
                                                <span className="text-locked">Included in Profile</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="checkbox-indicator">
                                                    {isSelected ? (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
                </div>

                {/* Sağ Tərəf: Səbət / Xülasə */}
                <aside className="services-summary-column">
                    <div className="order-summary-card sticky-box">
                        <h3>Order Summary</h3>
                        
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
                                                <button className="btn-remove" onClick={() => toggleService(item.serviceId, item.applicantId, false)}>Remove</button>
                                            </div>
                                            <div className="cart-item-price">{serviceInfo.price.toFixed(2)} AZN</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-cart">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                                <p>No additional services selected. Choose an applicant and add items to your cart.</p>
                            </div>
                        )}

                        <div className="summary-total-section">
                            <div className="total-row">
                                <span>Subtotal ({cart.length} new items)</span>
                                <span>{totalAmount.toFixed(2)} AZN</span>
                            </div>
                            <div className="total-row final-total">
                                <span>Total to Pay</span>
                                <span>{totalAmount.toFixed(2)} AZN</span>
                            </div>
                        </div>

                        <button 
                            className="btn-primary checkout-btn" 
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleCheckout}
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    Proceed to Checkout
                                </>
                            )}
                        </button>

                        <div className="secure-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span>Official Visa Application Center</span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}