import { useState, useEffect, useCallback } from 'react';
import { additionalService } from '@/shared/api/services/service.service';

export interface PricingPackageItem {
  id: string;
  code: string;
  name: string;
  badge: string;
  description: string;
  priceEur: number;
  priceAzn?: number;
  features: string[];
  includedServiceIds: string[];
  wizardFlags?: Record<string, boolean>;
  applicablePortals?: string[];
  isActive: boolean;
}

export interface PricingServiceItem {
  id: string;
  code?: string;
  wizardKey?: string | null;
  title: string;
  name?: string;
  description: string;
  category: string;
  priceEur: number;
  priceAzn?: number;
  price?: number;
  recommended?: boolean;
  isActive: boolean;
}

export interface PricingBaseFees {
  schengenShortStayFeeEur: number;
  nationalLongStayFeeEur: number;
  individualBaseServiceFeeEur: number;
  agentBaseServiceFeeEur: number;
  corporateBaseServiceFeeEur: number;
  eurToAznRate: number;
  agentCommissionRates: {
    BRONZE: number;
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
  };
}

export interface PricingCatalogData {
  baseFees: PricingBaseFees;
  packages: PricingPackageItem[];
  services: PricingServiceItem[];
  exchangeRate: number;
  currency: string;
}

export const DEFAULT_FRONTEND_CATALOG: PricingCatalogData = {
  baseFees: {
    schengenShortStayFeeEur: 80.0,
    nationalLongStayFeeEur: 90.0,
    individualBaseServiceFeeEur: 0.0,
    agentBaseServiceFeeEur: 65.0,
    corporateBaseServiceFeeEur: 65.0,
    eurToAznRate: 1.85,
    agentCommissionRates: {
      BRONZE: 20.0,
      SILVER: 25.0,
      GOLD: 28.0,
      PLATINUM: 32.0,
    },
  },
  packages: [
    {
      id: 'standard',
      code: 'STANDARD',
      name: 'Standard',
      badge: 'Essential',
      description: 'Essential consular file review, standard appointment scheduling & biometrics processing.',
      priceEur: 0.0,
      priceAzn: 0.0,
      features: [
        'Standard appointment scheduling',
        'Consular file completeness check',
        'General visa center hall access',
      ],
      includedServiceIds: [],
      wizardFlags: {
        filePrep: false,
        insurance: false,
        formAssist: false,
        photo: false,
        lounge: false,
        courier: false,
        hotelFlight: false,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
    {
      id: 'premium',
      code: 'PREMIUM',
      name: 'Premium Bundle',
      badge: 'Recommended',
      description: 'Full file preparation, questionnaire assistance, biometric photo & Schengen medical insurance.',
      priceEur: 126.0,
      priceAzn: 233.1,
      features: [
        'File Preparation & Verification',
        '€30,000 Schengen Medical Insurance',
        '37-Point Form Completion Assistance',
        'On-site ICAO Biometric Photos',
      ],
      includedServiceIds: ['FILE_PREPARATION', 'TRAVEL_INSURANCE', 'FORM_ASSIST', 'BIOMETRIC_PHOTO'],
      wizardFlags: {
        filePrep: true,
        insurance: true,
        formAssist: true,
        photo: true,
        lounge: false,
        courier: false,
        hotelFlight: false,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
    {
      id: 'vip',
      code: 'VIP',
      name: 'VIP Platinum',
      badge: 'VIP Service',
      description: 'All-inclusive diplomatic lounge access, verifiable hotel & flight itineraries, full concierge & courier return.',
      priceEur: 257.0,
      priceAzn: 475.45,
      features: [
        'Everything in Premium Bundle',
        'VIP Consular Lounge Access',
        'Hotel & Flight Itinerary Bookings',
        'Secure Doorstep Passport Courier',
      ],
      includedServiceIds: [
        'FILE_PREPARATION',
        'TRAVEL_INSURANCE',
        'FORM_ASSIST',
        'BIOMETRIC_PHOTO',
        'PREMIUM_LOUNGE',
        'HOTEL_BOOKING',
        'FLIGHT_BOOKING',
        'COURIER',
      ],
      wizardFlags: {
        filePrep: true,
        insurance: true,
        formAssist: true,
        photo: true,
        lounge: true,
        courier: true,
        hotelFlight: true,
      },
      applicablePortals: ['INDIVIDUAL', 'GROUP_AGENT', 'CORPORATE'],
      isActive: true,
    },
  ],
  services: [
    {
      id: 'PREMIUM_LOUNGE',
      wizardKey: 'lounge',
      title: 'VIP Lounge & Priority Access',
      description: 'Dedicated quiet space, prime time slots, refreshments, and personal support throughout the center.',
      category: 'COMFORT',
      priceEur: 81.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'EXPRESS_PROCESSING',
      wizardKey: 'express',
      title: 'Express Processing',
      description: 'Expedited processing queue and priority document verification before consular submission.',
      category: 'SPEED',
      priceEur: 60.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'FILE_PREPARATION',
      wizardKey: 'filePrep',
      title: 'Full File Preparation',
      description: 'Verification of documents and consistency check to maximize consular acceptance chances.',
      category: 'ASSISTANCE',
      priceEur: 55.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'TRANSLATION_APOSTILLE',
      wizardKey: 'translation',
      title: 'Translation & Apostille',
      description: 'Certified legal translation and official notarization/apostille support for civil documents.',
      category: 'LEGAL',
      priceEur: 45.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'TRAVEL_INSURANCE',
      wizardKey: 'insurance',
      title: 'Travel Medical Insurance (€30,000)',
      description: 'Schengen-compliant health coverage up to €30,000 valid across all Member States.',
      category: 'REQUIRED_COVERAGE',
      priceEur: 35.0,
      recommended: true,
      isActive: true,
    },
    {
      id: 'FORM_ASSIST',
      wizardKey: 'formAssist',
      title: '37-Point Form Completion',
      description: 'Specialist assistance with filling out and reviewing the official Schengen application form.',
      category: 'ASSISTANCE',
      priceEur: 24.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'COURIER',
      wizardKey: 'courier',
      title: 'Secure Passport Courier',
      description: 'Tracked door-to-door delivery of your processed passport directly to your home or office.',
      category: 'DELIVERY',
      priceEur: 20.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'HOTEL_BOOKING',
      wizardKey: 'hotelFlight',
      title: 'Verifiable Hotel Reservation',
      description: 'Consulate-verifiable accommodation confirmation matching your intended itinerary.',
      category: 'DOCUMENTATION',
      priceEur: 15.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'FLIGHT_BOOKING',
      wizardKey: 'hotelFlight',
      title: 'Flight Itinerary Reservation',
      description: 'Verifiable round-trip flight reservation without upfront full-fare ticket purchase.',
      category: 'DOCUMENTATION',
      priceEur: 15.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'BIOMETRIC_PHOTO',
      wizardKey: 'photo',
      title: 'ICAO Biometric Photo',
      description: '100% Schengen and ICAO compliant biometric photos captured on-site.',
      category: 'BIOMETRICS',
      priceEur: 12.0,
      recommended: false,
      isActive: true,
    },
    {
      id: 'SMS_TRACKING',
      wizardKey: 'sms',
      title: 'SMS & WhatsApp Live Alerts',
      description: 'Instant automated SMS & WhatsApp alerts at every consular milestone.',
      category: 'DELIVERY',
      priceEur: 5.0,
      recommended: false,
      isActive: true,
    },
  ],
  exchangeRate: 1.85,
  currency: 'EUR',
};

export function usePricingCatalog() {
  const [catalog, setCatalog] = useState<PricingCatalogData>(DEFAULT_FRONTEND_CATALOG);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await additionalService.getCatalog();
      const raw = res?.data?.data || res?.data || res;
      if (raw && (raw.packages || raw.catalog || raw.services)) {
        const rate = Number(raw.exchangeRate || raw.baseFees?.eurToAznRate || 1.85);
        const pkgs: PricingPackageItem[] = Array.isArray(raw.packages) && raw.packages.length > 0
          ? raw.packages
          : DEFAULT_FRONTEND_CATALOG.packages;
        const srvs: PricingServiceItem[] = Array.isArray(raw.catalog || raw.services) && (raw.catalog || raw.services).length > 0
          ? (raw.catalog || raw.services).map((s: any) => ({
              ...s,
              priceEur: Number(s.priceEur ?? s.price ?? 0),
              priceAzn: Number(s.priceAzn ?? Number(s.priceEur ?? s.price ?? 0) * rate),
            }))
          : DEFAULT_FRONTEND_CATALOG.services;

        setCatalog({
          baseFees: {
            ...DEFAULT_FRONTEND_CATALOG.baseFees,
            ...(raw.baseFees || {}),
            eurToAznRate: rate,
          },
          packages: pkgs,
          services: srvs,
          exchangeRate: rate,
          currency: 'EUR',
        });
      }
    } catch {
      // Keep default fallback catalog if offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const calculateLiveFees = useCallback(
    ({
      portalType = 'INDIVIDUAL',
      paxCount = 1,
      activePackage = 'standard',
      services = {},
      duration = 'short',
      baseConsularFeeOverride,
    }: {
      portalType?: string;
      paxCount?: number;
      activePackage?: string;
      services?: Record<string, any>;
      duration?: string;
      baseConsularFeeOverride?: number;
    }) => {
      const count = Math.max(1, Number(paxCount) || 1);
      const bf = catalog.baseFees;
      const rate = Number(bf.eurToAznRate || catalog.exchangeRate || 1.85);
      const pkgKey = String(activePackage || services?.activePackage || 'standard').toLowerCase();

      const stateFeePP =
        baseConsularFeeOverride !== undefined && baseConsularFeeOverride !== null && Number(baseConsularFeeOverride) > 0
          ? Number(baseConsularFeeOverride)
          : duration === 'long'
            ? Number(bf.nationalLongStayFeeEur ?? 90.0)
            : Number(bf.schengenShortStayFeeEur ?? 80.0);

      let baseServiceFeePP = Number(bf.individualBaseServiceFeeEur ?? 0.0);
      if (portalType === 'GROUP_AGENT') {
        baseServiceFeePP = Number(bf.agentBaseServiceFeeEur ?? 65.0);
      } else if (portalType === 'CORPORATE') {
        baseServiceFeePP = Number(bf.corporateBaseServiceFeeEur ?? 65.0);
      }

      // Build wizardKey -> price lookup from Admin services
      const addonPriceMap: Record<string, number> = {
        lounge: 81.0,
        filePrep: 55.0,
        insurance: 35.0,
        hotelFlight: 30.0,
        formAssist: 24.0,
        courier: 20.0,
        photo: 12.0,
        express: 60.0,
        translation: 45.0,
        sms: 5.0,
      };
      let hotelP: number | null = null;
      let flightP: number | null = null;
      for (const s of catalog.services) {
        const p = Number(s.priceEur ?? s.price ?? 0);
        addonPriceMap[s.id] = p;
        if (s.wizardKey && s.wizardKey !== 'hotelFlight') {
          addonPriceMap[s.wizardKey] = p;
        }
        if (s.id === 'HOTEL_BOOKING') hotelP = p;
        if (s.id === 'FLIGHT_BOOKING') flightP = p;
      }
      if (hotelP !== null || flightP !== null) {
        addonPriceMap.hotelFlight = (hotelP ?? 15.0) + (flightP ?? 15.0);
      }

      const matchedPkg = catalog.packages.find(
        (p) => String(p.id).toLowerCase() === pkgKey || String(p.code).toLowerCase() === pkgKey
      );

      let packageAddOnPP = 0.0;
      if (pkgKey === 'custom') {
        ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo', 'express', 'translation', 'sms'].forEach(
          (k) => {
            if (services && services[k]) {
              packageAddOnPP += addonPriceMap[k] || 0;
            }
          }
        );
      } else {
        packageAddOnPP = Number(matchedPkg?.priceEur ?? 0.0);
        const includedFlags = matchedPkg?.wizardFlags || {};
        if (services) {
          ['lounge', 'filePrep', 'insurance', 'hotelFlight', 'formAssist', 'courier', 'photo', 'express', 'translation', 'sms'].forEach(
            (k) => {
              if (services[k] && !includedFlags[k]) {
                packageAddOnPP += addonPriceMap[k] || 0;
              }
            }
          );
        }
      }

      const totalConsularFeesEur = Number((stateFeePP * count).toFixed(2));
      const totalBaseServiceFeesEur = Number((baseServiceFeePP * count).toFixed(2));
      const totalPackageFeesEur = Number((packageAddOnPP * count).toFixed(2));
      const totalServiceFeesEur = Number((totalBaseServiceFeesEur + totalPackageFeesEur).toFixed(2));
      const grandTotalEur = Number((totalConsularFeesEur + totalServiceFeesEur).toFixed(2));
      const grandTotalAzn = Number((grandTotalEur * rate).toFixed(2));

      return {
        paxCount: count,
        packageObj: matchedPkg || catalog.packages[0],
        packageName: matchedPkg?.name || (pkgKey === 'custom' ? 'Custom Bundle' : pkgKey.toUpperCase()),
        stateFeePP,
        baseServiceFeePP,
        packageAddOnPP,
        totalConsularFeesEur,
        totalBaseServiceFeesEur,
        totalPackageFeesEur,
        totalServiceFeesEur,
        grandTotalEur,
        grandTotalAzn,
        exchangeRate: rate,
        addonPriceMap,
      };
    },
    [catalog]
  );

  return {
    catalog,
    packages: catalog.packages,
    services: catalog.services,
    baseFees: catalog.baseFees,
    exchangeRate: catalog.exchangeRate,
    loading,
    refreshCatalog,
    calculateLiveFees,
  };
}
