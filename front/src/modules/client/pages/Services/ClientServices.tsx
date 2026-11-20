import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/context/ToastContext';
import { dossierService } from '@/shared/api/services/dossier.service';
import { serviceService } from '@/shared/api/services/service.service';
import { paymentService } from '@/shared/api/services/payment.service';
import { storage } from '@/shared/utils/storage';
import { DEFAULT_FRONTEND_CATALOG, type PricingPackageItem } from '@/shared/hooks/usePricingCatalog';
import './ClientServices.css';

interface ServiceItem {
    id: string;
    title: string;
    category: string;
    description: string;
    price: number;
    priceEur?: number;
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

const BASE_AVAILABLE_SERVICES: ServiceItem[] = [
    {
        id: 'PREMIUM_LOUNGE',
        title: 'Premium Lounge Access',
        category: 'Comfort & Speed',
        price: 157.25,
        priceEur: 85,
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
        price: 92.50,
        priceEur: 50,
        description: 'Expert pre-check, sorting, and certified verification of your consular dossier.',
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
        title: 'Schengen Travel Insurance',
        category: 'Legal Requirement',
        price: 55.50,
        priceEur: 30,
        description: 'Mandatory €30,000 medical coverage policy valid across all Schengen member territories.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        )
    },
    {
        id: 'HOTEL_BOOKING',
        title: 'Hotel Reservation Voucher',
        category: 'Itinerary Verification',
        price: 46.25,
        priceEur: 25,
        description: 'Confirmed hotel booking reservation strictly compliant with consular requirements.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-4"/>
                <path d="M9 9h1"/>
                <path d="M9 13h1"/>
                <path d="M9 17h1"/>
            </svg>
        )
    },
    {
        id: 'FLIGHT_BOOKING',
        title: 'Flight Itinerary Reservation',
        category: 'Itinerary Verification',
        price: 46.25,
        priceEur: 25,
        description: 'Verified verifiable roundtrip flight booking voucher with active PNR.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
        )
    },
    {
        id: 'FORM_ASSIST',
        title: 'Form Completion & Review',
        category: 'Expert Assistance',
        price: 37.00,
        priceEur: 20,
        description: 'Expert review and precision completion of the national/Schengen visa application form.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/>
            </svg>
        )
    },
    {
        id: 'COURIER',
        title: 'Courier Passport Delivery',
        category: 'Secure Logistics',
        price: 27.75,
        priceEur: 15,
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
        price: 18.50,
        priceEur: 10,
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
        price: 111.00,
        priceEur: 60,
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
        price: 83.25,
        priceEur: 45,
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

export default function ClientServices() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const [dossierId, setDossierId] = useState<string | null>(null);
    const [dossierNumber, setDossierNumber] = useState<string>('');
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<string>('');
    const [purchasedServices, setPurchasedServices] = useState<PurchasedService[]>([]);
    const [availableServices, setAvailableServices] = useState<ServiceItem[]>(BASE_AVAILABLE_SERVICES);
    const [availablePackages, setAvailablePackages] = useState<PricingPackageItem[]>(DEFAULT_FRONTEND_CATALOG.packages);
    const [activeDossierPackage, setActiveDossierPackage] = useState<string>('standard');
    const [updatingPkgId, setUpdatingPkgId] = useState<string | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(1.85);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Payment Mode: 'WALLET' | 'CARD' | 'BANK_SLIP'
    const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'CARD' | 'BANK_SLIP'>('WALLET');
    const [walletBalanceEur, setWalletBalanceEur] = useState<number>(0);

    // Online Card Form State
    const [cardHolder, setCardHolder] = useState('E. Abdullayev');
    const [cardNumber, setCardNumber] = useState('4169 7820 9182 4310');
    const [cardExpiry, setCardExpiry] = useState('12/28');
    const [cardCvv, setCardCvv] = useState('892');

    // Bank Slip Upload State
    const [slipBankName, setSlipBankName] = useState('ABB (International Bank of Azerbaijan)');
    const [slipSenderName, setSlipSenderName] = useState('');
    const [slipReceiptNumber, setSlipReceiptNumber] = useState('');
    const [slipFile, setSlipFile] = useState<File | null>(null);

    const loadDossierData = useCallback(async () => {
        try {
            // Load dynamic catalog (packages & services) from backend Admin pricing config
            try {
                const catalogRes: any = await serviceService.getCatalog();
                const rawData = catalogRes?.data?.data || catalogRes?.data || catalogRes;
                const rate = Number(rawData?.exchangeRate || rawData?.baseFees?.eurToAznRate || 1.85);
                setExchangeRate(rate);

                if (Array.isArray(rawData?.packages) && rawData.packages.length > 0) {
                    setAvailablePackages(rawData.packages.filter((p: any) => p.isActive !== false));
                }

                const dynamicCatalog = rawData?.catalog || rawData?.services;
                if (Array.isArray(dynamicCatalog) && dynamicCatalog.length > 0) {
                    setAvailableServices(prev => {
                        const updatedExisting = prev.map(item => {
                            const matched = dynamicCatalog.find(
                                (c: any) => (c.id || c.code) === item.id || normalizeServiceType(c.id || c.code) === item.id
                            );
                            if (matched) {
                                const pEur = Number(matched.priceEur ?? matched.price ?? item.priceEur ?? 0);
                                const pAzn = Number(matched.priceAzn ?? (pEur * rate));
                                return {
                                    ...item,
                                    price: pAzn,
                                    priceEur: pEur,
                                    title: matched.title || matched.name || item.title,
                                    description: matched.description || item.description,
                                    category: matched.category || item.category,
                                };
                            }
                            return item;
                        });

                        // Append any custom services created by Admin
                        const existingIds = new Set(updatedExisting.map(s => s.id));
                        const customOnes: ServiceItem[] = dynamicCatalog
                            .filter((c: any) => c.isActive !== false && !existingIds.has(normalizeServiceType(c.id || c.code)))
                            .map((c: any) => {
                                const pEur = Number(c.priceEur ?? c.price ?? 0);
                                return {
                                    id: c.id || c.code,
                                    title: c.title || c.name || c.id,
                                    category: c.category || 'ASSISTANCE',
                                    description: c.description || '',
                                    priceEur: pEur,
                                    price: Number(c.priceAzn ?? (pEur * rate)),
                                    icon: BASE_AVAILABLE_SERVICES[0].icon,
                                };
                            });

                        return [...updatedExisting, ...customOnes];
                    });
                }
            } catch (catErr) {
                console.warn('Dynamic catalog load notice, using standard catalog:', catErr);
            }

            try {
                const walletRes: any = await paymentService.getUserWallet();
                const rawW = walletRes?.data?.data || walletRes?.data || walletRes;
                const bal = Number(
                    rawW?.wallet?.balance ?? rawW?.wallet?.balanceEur ?? rawW?.balance ?? rawW?.balanceEur ?? 0
                );
                setWalletBalanceEur(bal);
            } catch (wErr) {
                console.warn('Wallet load note:', wErr);
            }

            const res = await dossierService.getMyDossiers();
            const dossiers = res.data?.dossiers || [];
            if (dossiers.length > 0) {
                const activeDossierId = storage.getActiveDossierId();
                const active = (activeDossierId && dossiers.find((d: any) => d.id === activeDossierId)) || dossiers[0];
                setDossierId(active.id);
                setDossierNumber(active.dossierNumber || '');
                storage.setActiveDossierId(active.id);

                // Active purchased services from DB
                const activeServices: PurchasedService[] = (active.services || []).filter(
                    (s: any) => s.status === 'ACTIVE'
                );
                setPurchasedServices(activeServices);
                const pkgFromApplicant = active.applicants?.[0]?.formDataJson?.package || active.groupBatch?.packageTier || 'standard';
                setActiveDossierPackage(String(pkgFromApplicant).toLowerCase());

                // Applicants
                if (active.applicants && active.applicants.length > 0) {
                    const mapped: Applicant[] = active.applicants.map((a: any, idx: number) => ({
                        id: a.id,
                        name: `${a.firstName} ${a.lastName} ${idx === 0 ? '(Primary)' : '(Co-Applicant)'}`,
                        isPrimary: idx === 0
                    }));
                    setApplicants(mapped);
                    setSelectedApplicant(prev => (!prev || !mapped.some(m => m.id === prev) ? mapped[0].id : prev));
                } else {
                    setApplicants([]);
                    setSelectedApplicant('');
                }
            } else {
                setDossierId(null);
                setDossierNumber('');
                setApplicants([]);
                setSelectedApplicant('');
                setPurchasedServices([]);
            }
        } catch (err) {
            console.error('Failed to load active dossier for services:', err);
            showError('Could not load dossier services. Please refresh.');
        } finally {
            setIsLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        loadDossierData();
    }, [loadDossierData]);

    const handleSelectDossierPackage = async (pkg: PricingPackageItem) => {
        if (!dossierId) return;
        setUpdatingPkgId(pkg.id);
        try {
            await serviceService.updateDossierPackage(dossierId, { packageId: pkg.id });
            setActiveDossierPackage(pkg.id);
            showSuccess(`Payment package updated to "${pkg.name}" (€${Number(pkg.priceEur).toFixed(2)} / person)!`);
            await loadDossierData();
        } catch (err: any) {
            showError(err.response?.data?.message || err.message || 'Failed to update payment package.');
        } finally {
            setUpdatingPkgId(null);
        }
    };

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
            const res = await serviceService.removeService(serviceRecordId);
            const msg = res.data?.message || `"${serviceTitle}" has been cancelled and removed from your dossier.`;
            showSuccess(msg);
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

    const totalAmount = cart.reduce((sum, cartItem) => {
        const service = availableServices.find(s => s.id === cartItem.serviceId);
        return sum + (service ? service.price : 0);
    }, 0);

    const executeCheckout = async () => {
        let activeId = dossierId;
        if (!activeId) {
            const fresh = await dossierService.getMyDossiers().catch(() => null);
            if (fresh?.data?.dossiers?.[0]?.id) {
                activeId = fresh.data.dossiers[0].id;
                setDossierId(activeId);
            }
        }

        if (!activeId || cart.length === 0) {
            showError('Please select at least one service and ensure your dossier is active.');
            return;
        }

        setIsProcessing(true);
        try {
            if (paymentMethod === 'WALLET') {
                const totalEur = totalAmount / 1.80;
                if (walletBalanceEur < totalEur) {
                    showError(`Insufficient wallet balance (€${walletBalanceEur.toFixed(2)} < €${totalEur.toFixed(2)}). Please top up first or pay via Card.`);
                    setIsProcessing(false);
                    return;
                }

                // 1. Checkout services onto dossier
                const payload = {
                    dossierId: activeId,
                    items: cart.map(c => ({
                        serviceType: c.serviceId,
                        applicantId: c.applicantId === 'primary-applicant' ? undefined : c.applicantId,
                    }))
                };
                await serviceService.checkout(payload);

                // 2. Settle dossier via wallet
                await paymentService.payWithWallet({ dossierId: activeId });

                showSuccess(`Payment of ${totalAmount.toFixed(2)} AZN (€${totalEur.toFixed(2)}) settled instantly from your EuroTech Wallet! ${cart.length} service(s) activated.`);
                setCart([]);
                setShowCheckoutModal(false);
                await loadDossierData();
            } else if (paymentMethod === 'BANK_SLIP') {
                if (!slipFile) {
                    showError('Please select and upload your bank payment slip / receipt.');
                    setIsProcessing(false);
                    return;
                }

                const fd = new FormData();
                fd.append('dossierId', activeId);
                fd.append('amount', totalAmount.toFixed(2));
                fd.append('currency', 'AZN');
                fd.append('bankName', slipBankName);
                fd.append('senderName', slipSenderName || cardHolder || 'Applicant');
                fd.append('receiptNumber', slipReceiptNumber || `REC-${Date.now()}`);
                fd.append('purpose', `Value-Added Services (${cart.length} items)`);
                fd.append('slip', slipFile);

                await paymentService.submitBankSlip(fd);

                // Attach services to dossier in pending state
                const payload = {
                    dossierId: activeId,
                    items: cart.map(c => ({
                        serviceType: c.serviceId,
                        applicantId: c.applicantId === 'primary-applicant' ? undefined : c.applicantId,
                    }))
                };
                await serviceService.checkout(payload).catch(() => {});

                showSuccess('Bank payment slip submitted successfully! Services will be verified upon banking reconciliation.');
                setCart([]);
                setSlipFile(null);
                setShowCheckoutModal(false);
                await loadDossierData();
            } else {
                // Online Card Checkout
                const payload = {
                    dossierId: activeId,
                    items: cart.map(c => ({
                        serviceType: c.serviceId,
                        applicantId: c.applicantId === 'primary-applicant' ? undefined : c.applicantId,
                    }))
                };

                const res = await serviceService.checkout(payload);
                const msg = res.data?.message || `Payment of ${totalAmount.toFixed(2)} AZN processed successfully! ${cart.length} service(s) activated.`;
                showSuccess(msg);
                setCart([]);
                setShowCheckoutModal(false);
                await loadDossierData();
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            showError(err.response?.data?.message || err.message || 'Payment processing failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const getApplicantDisplayName = (appId?: string | null) => {
        if (!appId) return 'Primary Applicant';
        const found = applicants.find(a => a.id === appId);
        return found ? found.name.split(' (')[0] : 'Applicant';
    };

    if (!isLoading && !dossierId) {
        return (
            <div className="services-page-content fade-in">
                <div className="services-header-premium">
                    <div className="header-titles">
                        <h1 className="docs-title">Value-Added Services</h1>
                        <p className="docs-subtitle">
                            Enhance your visa appointment and application journey with official VIP and convenience services.
                        </p>
                    </div>
                </div>

                <div className="dash-card-premium onboarding-banner-card" style={{ marginTop: '24px', padding: '48px 32px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                                <circle cx="9" cy="21" r="1"/>
                                <circle cx="20" cy="21" r="1"/>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                            </svg>
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F1E36', marginBottom: '10px' }}>
                            No Active Application Dossier Found
                        </h2>
                        <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
                            To select VIP Lounge access, travel insurance, or consular courier services, please start your visa application first.
                        </p>
                        <button className="btn-hero-primary pulse-btn" onClick={() => navigate('/individual/wizard')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '1rem' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Start New Application
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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

            {/* Payment Packages (Bundles) Section */}
            <div style={{ marginBottom: '32px', background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            All-Inclusive Consular Bundles
                        </span>
                        <h2 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                            Payment Packages
                        </h2>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#475569', background: '#EFF6FF', padding: '6px 14px', borderRadius: '20px', fontWeight: 700 }}>
                        Active Package: <strong style={{ color: '#1D4ED8' }}>{activeDossierPackage.toUpperCase()}</strong>
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
                    {availablePackages.map((pkg) => {
                        const isCurrent = activeDossierPackage === String(pkg.id).toLowerCase();
                        const pEur = Number(pkg.priceEur || 0);
                        const pAzn = Number(pkg.priceAzn ?? (pEur * exchangeRate));
                        return (
                            <div
                                key={pkg.id}
                                style={{
                                    border: isCurrent ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                                    background: isCurrent ? '#EFF6FF' : '#F8FAFC',
                                    borderRadius: '14px',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{pkg.name}</h3>
                                        {pkg.badge && (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, background: isCurrent ? '#2563EB' : '#E2E8F0', color: isCurrent ? '#FFFFFF' : '#334155', padding: '3px 9px', borderRadius: '10px' }}>
                                                {pkg.badge}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1D4ED8', marginBottom: '8px' }}>
                                        {pEur > 0 ? `+€${pEur.toFixed(2)}` : '€0.00'}{' '}
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748B' }}>
                                            ({pAzn.toFixed(2)} AZN / person)
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.45, marginBottom: '12px' }}>
                                        {pkg.description}
                                    </p>
                                    {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                                        <ul style={{ margin: '0 0 16px 0', paddingLeft: '18px', fontSize: '0.8rem', color: '#334155' }}>
                                            {pkg.features.map((f, i) => (
                                                <li key={i} style={{ marginBottom: '4px' }}>{f}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled={isCurrent || updatingPkgId === pkg.id}
                                    onClick={() => handleSelectDossierPackage(pkg)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: isCurrent ? '1.5px solid #2563EB' : 'none',
                                        background: isCurrent ? '#DBEAFE' : '#2563EB',
                                        color: isCurrent ? '#1E40AF' : '#FFFFFF',
                                        fontWeight: 700,
                                        cursor: isCurrent ? 'default' : 'pointer',
                                    }}
                                >
                                    {updatingPkgId === pkg.id
                                        ? 'Updating Package...'
                                        : isCurrent
                                        ? '✓ Active Package on Dossier'
                                        : `Select ${pkg.name}`}
                                </button>
                            </div>
                        );
                    })}
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
                                    className={`service-card ${isPurchased ? 'is-purchased' : isSelected ? 'is-selected' : ''}`}
                                    onClick={() => toggleService(service.id, selectedApplicant, isPurchased)}
                                >
                                    <div className="service-card-top">
                                        <div className="service-icon-wrapper">
                                            {service.icon}
                                        </div>
                                        <div className="service-price-badge">
                                            <span className="price-val">{service.price.toFixed(2)} AZN</span>
                                            {service.priceEur && <span className="price-sub">≈ €{service.priceEur}</span>}
                                        </div>
                                    </div>

                                    <div className="service-card-body">
                                        <span className="service-category">{service.category}</span>
                                        <h3 className="service-title">{service.title}</h3>
                                        <p className="service-desc">{service.description}</p>
                                    </div>

                                    <div className="service-card-footer">
                                        {isPurchased ? (
                                            <div className="status-badge-enrolled">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                Active on Dossier
                                            </div>
                                        ) : (
                                            <button 
                                                type="button" 
                                                className={`btn-select-service ${isSelected ? 'btn-selected' : ''}`}
                                            >
                                                {isSelected ? 'Selected in Cart' : '+ Add Service'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Active Services Enrolled Section */}
                    {purchasedServices.length > 0 && (
                        <div className="active-services-section">
                            <h3 className="section-title">Enrolled Dossier Services</h3>
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
                                <h3>Checkout & Payment Gateway</h3>
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

                            {/* Payment Method Selector */}
                            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0F1E36', marginBottom: '8px' }}>
                                    Select Payment Method:
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('WALLET')}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: paymentMethod === 'WALLET' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                            background: paymentMethod === 'WALLET' ? '#EFF6FF' : '#FFFFFF',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            color: paymentMethod === 'WALLET' ? '#1E3A8A' : '#475569',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        👛 Wallet (€{walletBalanceEur.toFixed(2)})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('CARD')}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: paymentMethod === 'CARD' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                            background: paymentMethod === 'CARD' ? '#EFF6FF' : '#FFFFFF',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            color: paymentMethod === 'CARD' ? '#1E3A8A' : '#475569',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        💳 Card (Online)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('BANK_SLIP')}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: paymentMethod === 'BANK_SLIP' ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                            background: paymentMethod === 'BANK_SLIP' ? '#EFF6FF' : '#FFFFFF',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            color: paymentMethod === 'BANK_SLIP' ? '#1E3A8A' : '#475569',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📄 Bank Wire Slip
                                    </button>
                                </div>
                            </div>

                            {paymentMethod === 'WALLET' ? (
                                <div style={{ background: '#F8FAFC', border: '1.5px solid #BFDBFE', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: '0.92rem', color: '#0F1E36' }}>EuroTech Pre-Funded Wallet</strong>
                                        <span style={{ fontSize: '0.78rem', background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                                            Instant Settlement
                                        </span>
                                    </div>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '0.84rem', color: '#64748B' }}>
                                        Available Balance: <strong style={{ color: walletBalanceEur >= (totalAmount / 1.80) ? '#059669' : '#DC2626' }}>€{walletBalanceEur.toFixed(2)}</strong> (≈ {(walletBalanceEur * 1.80).toFixed(2)} AZN)
                                    </p>
                                    {walletBalanceEur < (totalAmount / 1.80) ? (
                                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: '#B91C1C' }}>
                                            ⚠️ Insufficient balance to cover this purchase. Top up your EuroTech Wallet under "Wallet &amp; Invoices", or choose Card / Bank Wire.
                                        </div>
                                    ) : (
                                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: '#047857' }}>
                                            ✓ Funds will be immediately deducted and your additional services will be active right away.
                                        </div>
                                    )}
                                </div>
                            ) : paymentMethod === 'CARD' ? (
                                <div className="azericard-portal-box" style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ background: '#0F1E36', color: '#FFFFFF', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px' }}>AZERICARD</span>
                                            <strong style={{ fontSize: '0.88rem', color: '#0F1E36' }}>3D-Secure Bank Gateway</strong>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 700, background: '#DCFCE7', padding: '2px 8px', borderRadius: '12px' }}>
                                            🔒 256-bit Encrypted
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Cardholder Full Name</label>
                                            <input 
                                                type="text" 
                                                value={cardHolder} 
                                                onChange={(e) => setCardHolder(e.target.value)}
                                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, color: '#0F1E36', background: '#FFFFFF' }}
                                                placeholder="CARDHOLDER NAME"
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Card Number (Visa / Mastercard / MilliKart)</label>
                                            <div style={{ position: 'relative' }}>
                                                <input 
                                                    type="text" 
                                                    value={cardNumber} 
                                                    onChange={(e) => setCardNumber(e.target.value)}
                                                    maxLength={19}
                                                    style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, color: '#0F1E36', background: '#FFFFFF', letterSpacing: '1px' }}
                                                    placeholder="4169 0000 0000 0000"
                                                />
                                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>💳</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Expiry Date</label>
                                                <input 
                                                    type="text" 
                                                    value={cardExpiry} 
                                                    onChange={(e) => setCardExpiry(e.target.value)}
                                                    maxLength={5}
                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, color: '#0F1E36', background: '#FFFFFF', textAlign: 'center' }}
                                                    placeholder="MM/YY"
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>CVV / CVC</label>
                                                <input 
                                                    type="password" 
                                                    value={cardCvv} 
                                                    onChange={(e) => setCardCvv(e.target.value)}
                                                    maxLength={3}
                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, color: '#0F1E36', background: '#FFFFFF', textAlign: 'center', letterSpacing: '2px' }}
                                                    placeholder="•••"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bank-slip-portal-box" style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '12px', padding: '16px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: '#0F1E36', fontWeight: 700 }}>
                                        Upload Official Bank Payment Receipt / Slip
                                    </h4>
                                    <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#64748B' }}>
                                        Please transfer {totalAmount.toFixed(2)} AZN to EuroTech Services bank account (IBAN: AZ00ABB00000000000000000000) and attach the receipt below:
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Bank Name</label>
                                            <input 
                                                type="text" 
                                                value={slipBankName} 
                                                onChange={(e) => setSlipBankName(e.target.value)}
                                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Sender Name</label>
                                                <input 
                                                    type="text" 
                                                    value={slipSenderName} 
                                                    onChange={(e) => setSlipSenderName(e.target.value)}
                                                    placeholder="Full name as on receipt"
                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Receipt / Slip Number</label>
                                                <input 
                                                    type="text" 
                                                    value={slipReceiptNumber} 
                                                    onChange={(e) => setSlipReceiptNumber(e.target.value)}
                                                    placeholder="e.g. REC-98214"
                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Receipt File (PDF, JPG, PNG)</label>
                                            <input 
                                                type="file" 
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                                                style={{ width: '100%', padding: '8px', border: '1px dashed #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', background: '#FFFFFF' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="modal-total-summary-row" style={{ marginTop: '14px' }}>
                                <span>Total Payable (AZN):</span>
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
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn-primary modal-confirm-btn" 
                                onClick={executeCheckout}
                                disabled={isProcessing || (paymentMethod === 'WALLET' && walletBalanceEur < (totalAmount / 1.80))}
                                style={{ background: '#0F1E36', borderColor: '#0F1E36' }}
                            >
                                {isProcessing ? (
                                    <>
                                        <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                                        Processing Payment...
                                    </>
                                ) : paymentMethod === 'WALLET' ? (
                                    <>
                                        <span>👛</span>
                                        Pay {totalAmount.toFixed(2)} AZN from Wallet
                                    </>
                                ) : paymentMethod === 'CARD' ? (
                                    <>
                                        <span>🔒</span>
                                        Pay {totalAmount.toFixed(2)} AZN with Card
                                    </>
                                ) : (
                                    <>
                                        <span>📤</span>
                                        Submit Receipt ({totalAmount.toFixed(2)} AZN)
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
