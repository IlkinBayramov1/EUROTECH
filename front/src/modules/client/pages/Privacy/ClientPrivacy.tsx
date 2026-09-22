import { useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { ShieldIcon, DownloadIcon, AlertTriangleIcon, CheckCircleIcon } from '@/shared/components/icons/Icons';
import { apiClient } from '@/shared/api/client';
import { useToast } from '@/shared/context/ToastContext';
import './ClientPrivacy.css';

export default function ClientPrivacy() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');

  // Format Helpers
  const formatDocType = (rawType: string) => {
    switch (rawType) {
      case 'PASSPORT': return 'International Passport Scan';
      case 'FLIGHT_ITINERARY': return 'Roundtrip Flight Reservation';
      case 'BIOMETRIC_PHOTO': return 'ICAO Biometric Photograph';
      case 'INSURANCE': return 'Schengen Travel Medical Insurance';
      case 'FINANCIAL': return 'Bank Statement & Solvency Proof';
      case 'EMPLOYMENT': return 'Employment & Income Verification';
      case 'HOTEL_BOOKING': return 'Accommodation / Hotel Voucher';
      default: return String(rawType || 'DOCUMENT').replace(/_/g, ' ');
    }
  };

  const formatServiceTitle = (serviceType: string) => {
    switch (serviceType) {
      case 'PREMIUM_LOUNGE': return 'Premium VIP Consular Lounge Access';
      case 'FILE_PREPARATION': return 'Professional File & Dossier Preparation';
      case 'BIOMETRIC_PHOTO': return 'ICAO Standard Biometric Photography';
      case 'EXPRESS_PROCESSING': return 'Consular Express Fast-Track Service';
      case 'TRAVEL_INSURANCE': return 'Schengen Travel Medical Insurance (30k EUR)';
      case 'TRANSLATION_APOSTILLE': return 'Certified Translation & Legal Apostille';
      case 'COURIER': return 'Secure Passport Courier Delivery';
      case 'FLIGHT_BOOKING': return 'Confirmed Flight Reservation Voucher';
      case 'HOTEL_BOOKING': return 'Confirmed Hotel Accommodation Voucher';
      default: return String(serviceType || '').replace(/_/g, ' ');
    }
  };

  // Fetch GDPR data payload from real backend database
  const fetchGdprData = async () => {
    try {
      const res: any = await apiClient.get('/privacy/export-data');
      if (res && res.data) {
        return res.data;
      }
      throw new Error('No data received from GDPR export service.');
    } catch (e: any) {
      console.error('API export error:', e);
      showError(e?.message || 'Failed to fetch personal GDPR data.');
      throw e;
    }
  };

  // 1. EXPORT TO MICROSOFT EXCEL (.xls SpreadsheetML Multi-Sheet Workbook with EuroTech Luxury Navy Design)
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const data = await fetchGdprData();
      const userData = data?.user || {};
      const dossiers = userData?.dossiers || [];
      const exportedAt = data?.exportedAt ? new Date(data.exportedAt).toLocaleString('en-US') : new Date().toLocaleString('en-US');

      const esc = (val: any) => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      const cell = (val: any, styleId = 'Cell', type = 'String') =>
        `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${esc(val)}</Data></Cell>`;

      const row = (cells: string[]) => `<Row ss:AutoFitHeight="1">${cells.join('')}</Row>`;

      // Sheet 1: User Profile & System Metadata
      const profileRows = [
        row([cell('EUROTECH IMMIGRATION & MOBILITY — ŞƏXSİ VERİLƏNLƏRİN İXRACI (GDPR ARTICLE 20)', 'Title')]),
        row([cell(`İxrac Tarixi: ${exportedAt} | Şifrələmə Standartı: AES-256-GCM / ISO-27001`, 'Sub')]),
        row([]),
        row([cell('Məlumat Sahəsi', 'HeaderNavy'), cell('Saxlanılan Dəyər', 'HeaderNavy'), cell('Hüquqi Kateqoriya / Standart', 'HeaderNavy')]),
        row([cell('Tam Ad və Soyad', 'Cell'), cell(userData.fullName || '—', 'Cell'), cell('Şəxsi İdentifikator (PII)', 'Cell')]),
        row([cell('E-poçt Ünvanı', 'CellZebra'), cell(userData.email || '—', 'CellZebra'), cell('Əlaqə Məlumatı (PII)', 'CellZebra')]),
        row([cell('Əlaqə Telefonu', 'Cell'), cell(userData.phone || '—', 'Cell'), cell('Əlaqə Məlumatı (PII)', 'Cell')]),
        row([cell('İstifadəçi Sistem ID', 'CellZebra'), cell(userData.id || '—', 'CellZebra'), cell('Sistem İdentifikatoru', 'CellZebra')]),
        row([cell('Sistem Rolu', 'Cell'), cell(userData.role || 'CLIENT', 'Cell'), cell('Səlahiyyət Təyinatı', 'Cell')]),
        row([cell('Seçilmiş Dil', 'CellZebra'), cell((userData.preferredLanguage || 'az').toUpperCase(), 'CellZebra'), cell('İstifadəçi Tərcihi', 'CellZebra')]),
        row([cell('Hesab Qeydiyyat Tarixi', 'Cell'), cell(userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '—', 'Cell'), cell('Audit Qeydiyyatı', 'Cell')]),
        row([cell('Kriptoqrafik Qorunma', 'CellZebra'), cell('AES-256-GCM at rest, HMAC Blind Index, TLS 1.3', 'CellZebra'), cell('Maddə 32 Texniki Tələb', 'CellZebra')]),
        row([cell('Hüquqi Əsas', 'Cell'), cell('Avropa İttifaqı GDPR Nizamnaməsi (EU 2016/679) Maddə 15 və Maddə 20', 'Cell'), cell('Hüquqi Reqlament', 'Cell')]),
      ];

      // Sheet 2: Dossiers & Applications
      const dossierRows = [
        row([cell('VİZA VƏ İMMİQRASİYA FAYLLARI (IMMIGRATION DOSSIERS)', 'Title')]),
        row([cell(`Qeydiyyatdakı Ümumi Fayl Sayı: ${dossiers.length}`, 'Sub')]),
        row([]),
        row([
          cell('Dosye Nömrəsi', 'HeaderNavy'),
          cell('Status', 'HeaderNavyCenter'),
          cell('Təyinat Ölkəsi', 'HeaderNavy'),
          cell('Viza Kateqoriyası', 'HeaderNavy'),
          cell('Dövlət Rüsumu', 'HeaderNavyRight'),
          cell('Xidmət Haqqı', 'HeaderNavyRight'),
          cell('Əlavə Xidmətlər', 'HeaderNavyRight'),
          cell('Cəmi Məbləğ', 'HeaderNavyRight'),
          cell('Ödəniş Statusu', 'HeaderNavyCenter'),
          cell('Müraciət Tarixi', 'HeaderNavyCenter'),
        ]),
      ];
      if (dossiers.length === 0) {
        dossierRows.push(row([cell('Qeydiyyatda heç bir aktiv viza dosyesi tapılmadı', 'Cell')]));
      } else {
        dossiers.forEach((d: any, i: number) => {
          const destCountry = d.country?.nameEn || d.country?.nameAz || d.countryId || '—';
          const visaCat = d.visaCategory?.nameEn || d.visaCategory?.nameAz || d.visaCategoryId || '—';
          const isZebra = i % 2 === 1;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const mStyle = isZebra ? 'MoneyCellZebra' : 'MoneyCell';
          const payBadge = d.paymentStatus === 'PAID' ? 'BadgePaid' : 'BadgePending';

          dossierRows.push(
            row([
              cell(d.dossierNumber || d.id, cStyle),
              cell(d.status || 'RECEIVED', cCenter),
              cell(destCountry, cStyle),
              cell(visaCat, cStyle),
              cell(d.governmentFee != null ? Number(d.governmentFee).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(d.serviceFee != null ? Number(d.serviceFee).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(d.extraServicesFee != null ? Number(d.extraServicesFee).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(d.totalAmount != null ? Number(d.totalAmount).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(d.paymentStatus || 'PENDING', payBadge),
              cell(d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—', cCenter),
            ])
          );
        });
      }

      // Sheet 3: Applicants & Travelers
      const applicantRows = [
        row([cell('QEYDİYYATDA OLAN ƏRİZƏÇİLƏR VƏ SƏYAHƏTÇİLƏR', 'Title')]),
        row([cell('Bütün qeydiyyatdan keçmiş əsas ərizəçilər və ailə üzvləri', 'Sub')]),
        row([]),
        row([
          cell('Ərizəçi ID', 'HeaderNavy'),
          cell('Tam Ad və Soyad', 'HeaderNavy'),
          cell('Xarici Pasport', 'HeaderNavyCenter'),
          cell('Vətəndaşlıq', 'HeaderNavyCenter'),
          cell('Doğum Tarixi', 'HeaderNavyCenter'),
          cell('Cins', 'HeaderNavyCenter'),
          cell('Müraciət Rolu', 'HeaderNavy'),
          cell('Əlaqəli Dosye', 'HeaderNavy'),
        ]),
      ];
      let hasApplicants = false;
      let appIdx = 0;
      dossiers.forEach((d: any) => {
        (d.applicants || []).forEach((a: any, idx: number) => {
          hasApplicants = true;
          const isZebra = appIdx % 2 === 1;
          appIdx++;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ') || (userData.fullName || '—');
          const pass = a.passportNumber || (a.passportNumberEncrypted ? 'ENCRYPTED (AES-256)' : '—');

          applicantRows.push(
            row([
              cell(a.id ? a.id.substring(0, 10).toUpperCase() : `APP-${appIdx}`, cStyle),
              cell(fullName, cStyle),
              cell(pass, cCenter),
              cell(a.nationality || '—', cCenter),
              cell(a.birthDate ? new Date(a.birthDate).toLocaleDateString() : '—', cCenter),
              cell(a.gender || '—', cCenter),
              cell(idx === 0 ? 'Əsas Ərizəçi' : 'Birgə Səyahətçi', cStyle),
              cell(d.dossierNumber || d.id, cStyle),
            ])
          );
        });
      });
      if (!hasApplicants) {
        applicantRows.push(row([cell('Qeydiyyatda ərizəçi tapılmadı', 'Cell')]));
      }

      // Sheet 4: Uploaded Supporting Documents
      const docRows = [
        row([cell('TƏQDİM OLUNAN DƏSTƏKLƏYİCİ SƏNƏDLƏR', 'Title')]),
        row([cell('Konsulluq yoxlaması üçün sistemə yüklənmiş sənədlər reyestri', 'Sub')]),
        row([]),
        row([
          cell('Sənəd Növü', 'HeaderNavy'),
          cell('Faylın Adı', 'HeaderNavy'),
          cell('Məcburilik', 'HeaderNavyCenter'),
          cell('Yoxlama Statusu', 'HeaderNavyCenter'),
          cell('Əlaqəli Dosye', 'HeaderNavy'),
        ]),
      ];
      let hasDocs = false;
      let docIdx = 0;
      dossiers.forEach((d: any) => {
        (d.documents || []).forEach((doc: any) => {
          hasDocs = true;
          const isZebra = docIdx % 2 === 1;
          docIdx++;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const docBadge = doc.status === 'VERIFIED' ? 'BadgeVerified' : (doc.status === 'PENDING' ? 'BadgePending' : cCenter);

          docRows.push(
            row([
              cell(formatDocType(doc.requiredDocumentType || doc.docType || doc.type), cStyle),
              cell(doc.fileName || doc.originalName || '—', cStyle),
              cell(doc.isMandatory !== false ? 'Məcburi' : 'Könüllü', cCenter),
              cell(doc.status || 'PENDING', docBadge),
              cell(d.dossierNumber || d.id, cStyle),
            ])
          );
        });
      });
      if (!hasDocs) {
        docRows.push(row([cell('Qeydiyyatda sənəd tapılmadı', 'Cell')]));
      }

      // Sheet 5: Consular Biometrics Appointments
      const apptRows = [
        row([cell('KONSULLUQ VƏ BİOMETRİYA GÖRÜŞLƏRİ', 'Title')]),
        row([cell('Təyin olunmuş konsulluq müsahibələri və biometrik qəbullar', 'Sub')]),
        row([]),
        row([
          cell('Görüş Ref', 'HeaderNavy'),
          cell('Tarix', 'HeaderNavyCenter'),
          cell('Saat', 'HeaderNavyCenter'),
          cell('Konsulluq Mərkəzi / Ünvan', 'HeaderNavy'),
          cell('Status', 'HeaderNavyCenter'),
          cell('Əlaqəli Dosye', 'HeaderNavy'),
        ]),
      ];
      let hasAppts = false;
      let apptIdx = 0;
      dossiers.forEach((d: any) => {
        (d.appointments || []).forEach((ap: any) => {
          hasAppts = true;
          const isZebra = apptIdx % 2 === 1;
          apptIdx++;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const aDate = ap.timeSlot?.date ? new Date(ap.timeSlot.date).toLocaleDateString() : '—';
          const aTime = ap.timeSlot?.startTime || '—';
          const aLoc = ap.location || ap.timeSlot?.location || 'EuroTech Visa Center';
          const aRef = ap.id ? `ET-APT-${ap.id.substring(0, 8).toUpperCase()}` : '—';
          const apptBadge = ap.status === 'CONFIRMED' ? 'BadgePaid' : 'BadgePending';

          apptRows.push(
            row([
              cell(aRef, cStyle),
              cell(aDate, cCenter),
              cell(aTime, cCenter),
              cell(aLoc, cStyle),
              cell(ap.status || 'PENDING', apptBadge),
              cell(d.dossierNumber || d.id, cStyle),
            ])
          );
        });
      });
      if (!hasAppts) {
        apptRows.push(row([cell('Təyin olunmuş konsulluq görüşü tapılmadı', 'Cell')]));
      }

      // Sheet 6: Purchased Value-Added Services (VAS)
      const srvRows = [
        row([cell('ƏLAVƏ DƏYƏR XİDMƏTLƏRİ (VALUE-ADDED SERVICES)', 'Title')]),
        row([cell('Seçilmiş və aktivləşdirilmiş konsulluq xidmət paketləri', 'Sub')]),
        row([]),
        row([
          cell('Xidmət Paketi', 'HeaderNavy'),
          cell('Qiymət', 'HeaderNavyRight'),
          cell('Fulfillment Statusu', 'HeaderNavyCenter'),
          cell('Qeydiyyat Tarixi', 'HeaderNavyCenter'),
          cell('Əlaqəli Dosye', 'HeaderNavy'),
        ]),
      ];
      let hasSrv = false;
      let srvIdx = 0;
      dossiers.forEach((d: any) => {
        (d.services || []).forEach((s: any) => {
          hasSrv = true;
          const isZebra = srvIdx % 2 === 1;
          srvIdx++;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const mStyle = isZebra ? 'MoneyCellZebra' : 'MoneyCell';

          srvRows.push(
            row([
              cell(formatServiceTitle(s.serviceType), cStyle),
              cell(s.price != null ? Number(s.price).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(s.status || 'ACTIVE', 'BadgePaid'),
              cell(s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—', cCenter),
              cell(d.dossierNumber || d.id, cStyle),
            ])
          );
        });
      });
      if (!hasSrv) {
        srvRows.push(row([cell('Heç bir əlavə xidmət qeydiyyatı tapılmadı', 'Cell')]));
      }

      // Sheet 7: Financial Transactions & Invoices
      const txRows = [
        row([cell('MALİYYƏ VƏ ÖDƏNİŞ ƏMƏLİYYATLARI (FINANCIAL TRANSACTIONS)', 'Title')]),
        row([cell('Konsulluq ödənişləri və rüsum tranzaksiyaları reyestri', 'Sub')]),
        row([]),
        row([
          cell('Əməliyyat ID', 'HeaderNavy'),
          cell('Ödəniş Provayderi', 'HeaderNavy'),
          cell('Məbləğ', 'HeaderNavyRight'),
          cell('Valyuta', 'HeaderNavyCenter'),
          cell('Hesablaşma Statusu', 'HeaderNavyCenter'),
          cell('Tarix', 'HeaderNavyCenter'),
          cell('Əlaqəli Dosye', 'HeaderNavy'),
        ]),
      ];
      let hasTx = false;
      let txIdx = 0;
      dossiers.forEach((d: any) => {
        (d.transactions || []).forEach((t: any) => {
          hasTx = true;
          const isZebra = txIdx % 2 === 1;
          txIdx++;
          const cStyle = isZebra ? 'CellZebra' : 'Cell';
          const cCenter = isZebra ? 'CellZebraCenter' : 'CellCenter';
          const mStyle = isZebra ? 'MoneyCellZebra' : 'MoneyCell';
          const txBadge = t.status === 'PAID' ? 'BadgePaid' : 'BadgePending';

          txRows.push(
            row([
              cell(t.id || '—', cStyle),
              cell(t.paymentProvider || 'Portal Ödənişi', cStyle),
              cell(t.amount != null ? Number(t.amount).toFixed(2) : '0.00', mStyle, 'Number'),
              cell(t.currency || 'AZN', cCenter),
              cell(t.status || 'PAID', txBadge),
              cell(t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—', cCenter),
              cell(d.dossierNumber || d.id, cStyle),
            ])
          );
        });
      });
      if (!hasTx) {
        txRows.push(row([cell('Heç bir maliyyə əməliyyatı qeydə alınmayıb', 'Cell')]));
      }

      const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0F2744"/>
  </Style>
  <Style ss:ID="Sub">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="HeaderNavy">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Interior ss:Color="#0F2744" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderNavyRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Interior ss:Color="#0F2744" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderNavyCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#0F2744" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0A192F"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellZebra">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellZebraCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="MoneyCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00 &quot;AZN&quot;"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F2744"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="MoneyCellZebra">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00 &quot;AZN&quot;"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F2744"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgePaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#166534"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgePending">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#92400E"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgeVerified">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#0369A1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Xülasə &amp; Şəxsiyyət">
  <Table ss:DefaultColumnWidth="180">
   <Column ss:Width="190"/>
   <Column ss:Width="280"/>
   <Column ss:Width="230"/>
   ${profileRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Fayllar (Dossiers)">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="160"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   ${dossierRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Ərizəçilər">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="120"/>
   <Column ss:Width="180"/>
   <Column ss:Width="150"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   ${applicantRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Sənədlər">
  <Table ss:DefaultColumnWidth="160">
   <Column ss:Width="240"/>
   <Column ss:Width="250"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   ${docRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Qəbullar">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="250"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   ${apptRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Əlavə Xidmətlər">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="260"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="130"/>
   <Column ss:Width="140"/>
   ${srvRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Maliyyə Əməliyyatları">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="180"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   ${txRows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

      const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eurotech_gdpr_export_${Date.now()}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess('Məlumatlarınız Excel (.xls) formatında uğurla yükləndi!');
    } catch (err: any) {
      showError(err.message || 'Excel export failed.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 2. EXPORT TO CSV (Universal Structured Tabular CSV with Clear Tables & UTF-8 BOM)
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const data = await fetchGdprData();
      const userData = data?.user || {};
      const dossiers = userData?.dossiers || [];
      const exportedAt = data?.exportedAt ? new Date(data.exportedAt).toLocaleString('en-US') : new Date().toLocaleString('en-US');

      const lines: string[] = [];
      const esc = (val: any) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      // Manifest Header
      lines.push(esc('EUROTECH IMMIGRATION & MOBILITY — RƏSMİ GDPR VERİLƏNLƏRİN DAŞINMASI MANİFESTİ'));
      lines.push(`${esc('Hüquqi Əsas')},${esc('Avropa İttifaqı GDPR Nizamnaməsi (EU 2016/679) Maddə 20 (Data Portability)')}`);
      lines.push(`${esc('İxrac Tarixi')},${esc(exportedAt)}`);
      lines.push(`${esc('Hesab Sahibi')},${esc(userData.fullName || '—')}`);
      lines.push(`${esc('E-poçt Ünvanı')},${esc(userData.email || '—')}`);
      lines.push(`${esc('Əlaqə Nömrəsi')},${esc(userData.phone || '—')}`);
      lines.push(`${esc('Təhlükəsizlik Standartı')},${esc('AES-256-GCM / HMAC-SHA256 Blind Index / ISO-27001')}`);
      lines.push('');

      // Table 1: User Profile & System Metadata
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 1: HESAB VƏ ŞƏXSİYYƏT MƏLUMATLARI (USER PROFILE & SYSTEM METADATA)'));
      lines.push(esc('========================================================================================================'));
      lines.push([esc('Məlumat Sahəsi'), esc('Saxlanılan Dəyər'), esc('Kateqoriya'), esc('Hüquqi Əsas')].join(','));
      lines.push([esc('Tam Ad və Soyad'), esc(userData.fullName || '—'), esc('Şəxsi İdentifikator (PII)'), esc('Maddə 6(1)(b) Müqavilə Öhdəliyi')].join(','));
      lines.push([esc('E-poçt Ünvanı'), esc(userData.email || '—'), esc('Əlaqə Məlumatı (PII)'), esc('Maddə 6(1)(b) Əlaqə və Bildiriş')].join(','));
      lines.push([esc('Əlaqə Telefonu'), esc(userData.phone || '—'), esc('Əlaqə Məlumatı (PII)'), esc('Maddə 6(1)(b) Təcili Əlaqə')].join(','));
      lines.push([esc('İstifadəçi Sistem ID'), esc(userData.id || '—'), esc('Sistem İdentifikatoru'), esc('Hesab Qeydiyyatı')].join(','));
      lines.push([esc('Sistem Rolu'), esc(userData.role || 'CLIENT'), esc('Səlahiyyət Təyinatı'), esc('İcazə İdarəetməsi')].join(','));
      lines.push([esc('Seçilmiş Dil'), esc((userData.preferredLanguage || 'az').toUpperCase()), esc('İstifadəçi Tərcihi'), esc('Portal Fərdiləşdirməsi')].join(','));
      lines.push([esc('Qeydiyyat Tarixi'), esc(userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '—'), esc('Audit Qeydiyyatı'), esc('Sistem Jurnalı')].join(','));
      lines.push([esc('Kriptoqrafik Qorunma'), esc('AES-256-GCM Şifrələmə, TLS 1.3'), esc('Texniki Təhlükəsizlik'), esc('Maddə 32 Təhlükəsizlik Tələbi')].join(','));
      lines.push('');

      // Table 2: Immigration Dossiers
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 2: VİZA VƏ İMMİQRASİYA FAYLLARI (IMMIGRATION & VISA DOSSIERS)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Dosye Nömrəsi'),
        esc('Status'),
        esc('Təyinat Ölkəsi'),
        esc('Viza Kateqoriyası'),
        esc('Dövlət Rüsumu (AZN)'),
        esc('Xidmət Haqqı (AZN)'),
        esc('Əlavə Xidmətlər (AZN)'),
        esc('Cəmi Məbləğ (AZN)'),
        esc('Ödəniş Statusu'),
        esc('Müraciət Tarixi'),
      ].join(','));

      if (dossiers.length === 0) {
        lines.push(esc('Qeydiyyatda heç bir aktiv viza müraciəti tapılmadı.'));
      } else {
        dossiers.forEach((d: any) => {
          const dest = d.country?.nameEn || d.country?.nameAz || d.countryId || '—';
          const visaCat = d.visaCategory?.nameEn || d.visaCategory?.nameAz || d.visaCategoryId || '—';
          const gFee = d.governmentFee != null ? Number(d.governmentFee).toFixed(2) : '0.00';
          const sFee = d.serviceFee != null ? Number(d.serviceFee).toFixed(2) : '0.00';
          const eFee = d.extraServicesFee != null ? Number(d.extraServicesFee).toFixed(2) : '0.00';
          const tFee = d.totalAmount != null ? Number(d.totalAmount).toFixed(2) : '0.00';
          lines.push([
            esc(d.dossierNumber || d.id),
            esc(d.status || 'RECEIVED'),
            esc(dest),
            esc(visaCat),
            esc(gFee),
            esc(sFee),
            esc(eFee),
            esc(tFee),
            esc(d.paymentStatus || 'PENDING'),
            esc(d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'),
          ].join(','));
        });
      }
      lines.push('');

      // Table 3: Registered Applicants & Travelers
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 3: QEYDİYYATDA OLAN ƏRİZƏÇİLƏR VƏ SƏYAHƏTÇİLƏR (REGISTERED APPLICANTS)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Ərizəçi ID'),
        esc('Tam Ad və Soyad'),
        esc('Xarici Pasport'),
        esc('Vətəndaşlıq'),
        esc('Doğum Tarixi'),
        esc('Cins'),
        esc('Müraciət Rolu'),
        esc('Əlaqəli Dosye'),
      ].join(','));

      let appCount = 0;
      dossiers.forEach((d: any) => {
        (d.applicants || []).forEach((a: any, idx: number) => {
          appCount++;
          const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ') || (userData.fullName || '—');
          const pass = a.passportNumber || (a.passportNumberEncrypted ? 'ENCRYPTED (AES-256)' : '—');
          lines.push([
            esc(a.id ? a.id.substring(0, 10).toUpperCase() : `APP-${appCount}`),
            esc(fullName),
            esc(pass),
            esc(a.nationality || '—'),
            esc(a.birthDate ? new Date(a.birthDate).toLocaleDateString() : '—'),
            esc(a.gender || '—'),
            esc(idx === 0 ? 'Əsas Ərizəçi' : 'Birgə Səyahətçi'),
            esc(d.dossierNumber || d.id),
          ].join(','));
        });
      });
      if (appCount === 0) lines.push(esc('Qeydiyyatda ərizəçi tapılmadı.'));
      lines.push('');

      // Table 4: Supporting Documents
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 4: TƏQDİM OLUNAN SƏNƏDLƏR (SUPPORTING DOCUMENTS)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Sənəd Növü'),
        esc('Faylın Adı'),
        esc('Məcburilik Tələbi'),
        esc('Yoxlama Statusu'),
        esc('Əlaqəli Dosye'),
      ].join(','));

      let docCount = 0;
      dossiers.forEach((d: any) => {
        (d.documents || []).forEach((doc: any) => {
          docCount++;
          lines.push([
            esc(formatDocType(doc.requiredDocumentType || doc.docType || doc.type)),
            esc(doc.fileName || doc.originalName || '—'),
            esc(doc.isMandatory !== false ? 'Məcburi' : 'Könüllü'),
            esc(doc.status || 'PENDING'),
            esc(d.dossierNumber || d.id),
          ].join(','));
        });
      });
      if (docCount === 0) lines.push(esc('Qeydiyyatda sənəd tapılmadı.'));
      lines.push('');

      // Table 5: Consular Biometrics Appointments
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 5: KONSULLUQ VƏ BİOMETRİYA GÖRÜŞLƏRİ (CONSULAR APPOINTMENTS)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Görüş Ref'),
        esc('Tarix'),
        esc('Saat İntervalı'),
        esc('Konsulluq Mərkəzi / Ünvan'),
        esc('Status'),
        esc('Əlaqəli Dosye'),
      ].join(','));

      let aptCount = 0;
      dossiers.forEach((d: any) => {
        (d.appointments || []).forEach((ap: any) => {
          aptCount++;
          const aDate = ap.timeSlot?.date ? new Date(ap.timeSlot.date).toLocaleDateString() : '—';
          const aTime = ap.timeSlot?.startTime || '—';
          const aLoc = ap.location || ap.timeSlot?.location || 'EuroTech Visa Center';
          const aRef = ap.id ? `ET-APT-${ap.id.substring(0, 8).toUpperCase()}` : '—';
          lines.push([
            esc(aRef),
            esc(aDate),
            esc(aTime),
            esc(aLoc),
            esc(ap.status || 'PENDING'),
            esc(d.dossierNumber || d.id),
          ].join(','));
        });
      });
      if (aptCount === 0) lines.push(esc('Təyin olunmuş konsulluq görüşü tapılmadı.'));
      lines.push('');

      // Table 6: Value-Added Services (VAS)
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 6: ƏLAVƏ DƏYƏR XİDMƏTLƏRİ (VALUE-ADDED SERVICES MANIFEST)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Xidmət Paketi'),
        esc('Qiymət (AZN)'),
        esc('Fulfillment Statusu'),
        esc('Qeydiyyat Tarixi'),
        esc('Əlaqəli Dosye'),
      ].join(','));

      let srvCount = 0;
      dossiers.forEach((d: any) => {
        (d.services || []).forEach((s: any) => {
          srvCount++;
          lines.push([
            esc(formatServiceTitle(s.serviceType)),
            esc(s.price != null ? Number(s.price).toFixed(2) : '0.00'),
            esc(s.status || 'ACTIVE'),
            esc(s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'),
            esc(d.dossierNumber || d.id),
          ].join(','));
        });
      });
      if (srvCount === 0) lines.push(esc('Əlavə xidmət qeydiyyatı tapılmadı.'));
      lines.push('');

      // Table 7: Financial Transactions & Invoices
      lines.push(esc('========================================================================================================'));
      lines.push(esc('CƏDVƏL 7: MALİYYƏ VƏ ÖDƏNİŞ ƏMƏLİYYATLARI (FINANCIAL TRANSACTIONS & BILLING)'));
      lines.push(esc('========================================================================================================'));
      lines.push([
        esc('Əməliyyat ID'),
        esc('Ödəniş Provayderi'),
        esc('Məbləğ (AZN)'),
        esc('Valyuta'),
        esc('Hesablaşma Statusu'),
        esc('Tarix'),
        esc('Əlaqəli Dosye'),
      ].join(','));

      let txCount = 0;
      dossiers.forEach((d: any) => {
        (d.transactions || []).forEach((t: any) => {
          txCount++;
          lines.push([
            esc(t.id || '—'),
            esc(t.paymentProvider || 'Portal Ödənişi'),
            esc(t.amount != null ? Number(t.amount).toFixed(2) : '0.00'),
            esc(t.currency || 'AZN'),
            esc(t.status || 'PAID'),
            esc(t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'),
            esc(d.dossierNumber || d.id),
          ].join(','));
        });
      });
      if (txCount === 0) lines.push(esc('Heç bir maliyyə əməliyyatı qeydə alınmayıb.'));

      // UTF-8 BOM ensures Excel opens Azerbaijani and international characters perfectly
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eurotech_gdpr_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess('Məlumatlarınız CSV formatında uğurla yükləndi!');
    } catch (err: any) {
      showError(err.message || 'CSV export failed.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // 3. EXPORT TO OFFICIAL PDF DOSSIER (GDPR Article 15 & 20 DSAR Compliance Document)
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res: any = await apiClient.get('/privacy/export-pdf');
      const downloadUrl = res?.data?.downloadUrl || res?.downloadUrl;
      const fileName = res?.data?.fileName || res?.fileName || `EuroTech_GDPR_Dossier_${Date.now()}.pdf`;

      if (downloadUrl) {
        const backendOrigin = import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
          : 'http://localhost:5000';
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${backendOrigin}${downloadUrl}`;
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error('PDF faylını serverdən yükləmək mümkün olmadı.');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        showSuccess('GDPR Rəsmi Sertifikatlaşdırılmış PDF Dosyesi uğurla yükləndi.');
      } else {
        throw new Error('PDF yükləmə ünvanı əldə edilmədi.');
      }
    } catch (err: any) {
      console.error('Export PDF error:', err);
      showError(err.message || 'PDF ixracı uğursuz oldu.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleAnonymize = async () => {
    if (confirmedName !== 'CONFIRM') {
      showError('Təsdiq etmək üçün zəhmət olmasa CONFIRM yazın.');
      return;
    }
    setAnonymizing(true);
    try {
      await apiClient.post('/privacy/anonymize', { reason: 'User requested right to be forgotten' });
      showSuccess('Hesabınız və şəxsi məlumatlarınız GDPR əsasında uğurla anonimləşdirildi.');
      setIsModalOpen(false);
      setTimeout(() => {
        logout();
        window.location.href = '/login/individual';
      }, 1500);
    } catch (err: any) {
      showError(err.message || 'Anonimləşdirmə sorğusu uğursuz oldu.');
    } finally {
      setAnonymizing(false);
    }
  };

  return (
    <div className="privacy-content-wrap fade-in">
      {/* Header */}
      <div className="privacy-header">
        <div className="privacy-header-titles">
          <h1>GDPR Privacy & Data Governance Center</h1>
          <p>
            Manage your personal data rights, cryptographic exports, and data privacy under EU GDPR regulations.
          </p>
        </div>
        <div className="privacy-badges-group">
          <span className="gdpr-compliance-badge">
            <ShieldIcon size={16} /> GDPR Compliant (AES-256)
          </span>
        </div>
      </div>

      {/* Main 2-Column Cards */}
      <div className="privacy-cards-grid">
        
        {/* Card 1: Data Portability (Excel & Formats) */}
        <div className="privacy-feature-card">
          <div className="card-top-block">
            <div className="feature-header-row">
              <div className="feature-icon-box blue">
                <DownloadIcon size={24} />
              </div>
              <div className="feature-title-wrap">
                <h3>Download Personal Data Package</h3>
                <span className="article-tag">Article 20 — Right to Data Portability</span>
              </div>
            </div>

            <p className="feature-description">
              Generate and download a comprehensive structured data report containing all your registered visa dossiers, applicant passport references, uploaded document metadata, and consular billing logs.
            </p>

            {/* What's Included Preview Chips */}
            <div className="package-included-box">
              <span className="included-title">Report Data Includes:</span>
              <div className="included-chips">
                <span className="chip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Client Profile & Metadata
                </span>
                <span className="chip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Dossiers & Schengen Applications
                </span>
                <span className="chip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Travelers & Passport Indices
                </span>
                <span className="chip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Document Verification History
                </span>
                <span className="chip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Financial Invoices & Fees
                </span>
              </div>
            </div>
          </div>

          {/* Export Action Block with Excel & Other Formats */}
          <div className="export-action-block">
            <div className="export-primary-row">
              {/* Primary: Microsoft Excel */}
              <button
                className="btn-export-excel"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                type="button"
                title="Microsoft Excel Cədvəli kimi yüklə"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <rect x="8" y="12" width="8" height="6" rx="1"/>
                  <line x1="12" y1="12" x2="12" y2="18"/>
                  <line x1="8" y1="15" x2="16" y2="15"/>
                </svg>
                {isExportingExcel ? 'Hazırlanır...' : 'Excel-ə Yüklə (.XLS)'}
              </button>

              {/* Secondary: CSV */}
              <button
                className="btn-export-alt"
                onClick={handleExportCsv}
                disabled={isExportingCsv}
                type="button"
                title="Universal CSV Cədvəli kimi yüklə"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/>
                  <line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
                {isExportingCsv ? '...' : 'CSV (.csv)'}
              </button>

              {/* Tertiary: Official PDF Dossier */}
              <button
                className="btn-export-alt"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                type="button"
                title="Rəsmi PDF GDPR Dosyesi"
              >
                <DownloadIcon size={16} />
                {isExportingPdf ? 'Hazırlanır...' : 'Rəsmi Dosye (.PDF)'}
              </button>
            </div>
            <p className="export-hint">
              💡 <strong>Tövsiyə:</strong> Excel formatı çox-vərəqli (multi-sheet) və rəngli başlıqlarla təchiz olunub, Microsoft Excel-də dərhal açılır.
            </p>
          </div>
        </div>

        {/* Card 2: Right to be Forgotten (Erasure) */}
        <div className="privacy-feature-card">
          <div className="card-top-block">
            <div className="feature-header-row">
              <div className="feature-icon-box danger">
                <AlertTriangleIcon size={24} />
              </div>
              <div className="feature-title-wrap">
                <h3>Right to be Forgotten (Erasure)</h3>
                <span className="article-tag">Article 17 — Right to Erasure</span>
              </div>
            </div>

            <p className="feature-description">
              Permanently anonymize your personally identifiable information (PII), passport hash indices, and email identifiers across active systems while maintaining consular auditing compliance.
            </p>

            <div className="erasure-warning-box">
              <strong>⚠️ Permanent Legal Action</strong>
              <p>
                Once executed, your application account cannot be recovered. Ongoing visa submissions will lose active status tracking notifications.
              </p>
            </div>
          </div>

          <button className="btn-request-erasure" onClick={() => setIsModalOpen(true)} type="button">
            Request Account Anonymization
          </button>
        </div>

      </div>

      {/* Security Safeguards Active */}
      <div className="privacy-safeguards-card">
        <div className="safeguards-header">
          <CheckCircleIcon size={20} style={{ color: '#10B981' }} />
          <h4>Active Data Protection & Cryptographic Safeguards</h4>
        </div>
        <div className="safeguards-grid">
          <div className="safeguard-item">
            <div className="safeguard-check">
              <CheckCircleIcon size={18} />
            </div>
            <div className="safeguard-text">
              <strong>AES-256-GCM Encryption</strong>
              <p>Passport numbers & attachments encrypted with authenticated GCM ciphers at rest.</p>
            </div>
          </div>
          <div className="safeguard-item">
            <div className="safeguard-check">
              <CheckCircleIcon size={18} />
            </div>
            <div className="safeguard-text">
              <strong>HMAC-SHA256 Blind Index</strong>
              <p>Searchable encrypted index prevents plaintext biometric enumeration in database queries.</p>
            </div>
          </div>
          <div className="safeguard-item">
            <div className="safeguard-check">
              <CheckCircleIcon size={18} />
            </div>
            <div className="safeguard-text">
              <strong>15-Min Signed URLs</strong>
              <p>Ephemeral short-lived cryptographic tokens for all consular document access.</p>
            </div>
          </div>
          <div className="safeguard-item">
            <div className="safeguard-check">
              <CheckCircleIcon size={18} />
            </div>
            <div className="safeguard-text">
              <strong>Zero-Knowledge Audit Trail</strong>
              <p>Immutable administrative logs tracked without recording plain applicant identity.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Consular Retention Notice */}
      <div className="privacy-policy-banner">
        <div className="policy-banner-left">
          <ShieldIcon size={20} />
          <p>
            <strong>Consular Compliance Notice:</strong> European Schengen visa biometric records and financial fee transaction records are retained in compliance with EU Visa Code (EC No 810/2009) and national financial auditing standards.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Confirm GDPR Anonymization">
        <div className="erasure-modal-wrap">
          <p>
            This action is irreversible. All your contact details, personal identification numbers, and passport references will be cryptographically stripped from active records.
          </p>
          <div className="modal-confirm-input-box">
            <label>Type CONFIRM below to proceed with data erasure:</label>
            <input
              type="text"
              placeholder="CONFIRM"
              value={confirmedName}
              onChange={(e) => setConfirmedName(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleAnonymize}
              isLoading={anonymizing}
              disabled={confirmedName !== 'CONFIRM'}
            >
              Permanently Anonymize
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
