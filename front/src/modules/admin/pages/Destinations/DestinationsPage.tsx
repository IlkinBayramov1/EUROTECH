import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  vcmsApi,
  QUESTION_ANSWER_TYPES,
  DOCUMENT_CATEGORY_TYPES,
  evaluateFrontendConditionSet,
} from '../../api/vcmsApi';
import '../../styles/vcms.css';

export default function DestinationsPage() {
  const { countryId } = useParams<{ countryId?: string }>();
  const navigate = useNavigate();

  // List State
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schengenFilter, setSchengenFilter] = useState('ALL');
  const [showAddCountryModal, setShowAddCountryModal] = useState(false);
  const [newCountryForm, setNewCountryForm] = useState({
    code: '',
    nameEn: '',
    nameAz: '',
    nameRu: '',
    flagEmoji: '',
    region: 'Europe',
    isSchengen: true,
    status: 'DRAFT',
    processingDaysLabel: '15 business days',
  });

  // Detail Hub State
  const [countryDetail, setCountryDetail] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<
    'VISA_TYPES' | 'QUESTIONS' | 'DOCUMENTS' | 'VISA_CENTRE' | 'EMBASSY' | 'PREVIEW_PUBLISH'
  >('VISA_TYPES');
  const [selectedVisaTypeId, setSelectedVisaTypeId] = useState<string>('');
  const [selectedPurposeId, setSelectedPurposeId] = useState<string>('');
  const [purposeWorkspace, setPurposeWorkspace] = useState<any | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals in Detail View
  const [showVisaTypeModal, setShowVisaTypeModal] = useState(false);
  const [visaTypeForm, setVisaTypeForm] = useState<any>({
    id: '',
    code: '',
    nameEn: '',
    nameAz: '',
    stayCategory: 'SHORT',
    maxDurationDays: 90,
    maxDurationLabel: 'Up to 90 days in any 180-day period',
    defaultFeeEur: 80,
    status: 'ACTIVE',
  });

  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [purposeForm, setPurposeForm] = useState<any>({
    id: '',
    visaTypeId: '',
    code: '',
    nameEn: '',
    nameAz: '',
    descriptionEn: '',
    consularFeeOverride: '',
    status: 'ACTIVE',
  });

  const [showDuplicatePurposeModal, setShowDuplicatePurposeModal] = useState(false);
  const [dupPurposeForm, setDupPurposeForm] = useState({
    sourcePurposeId: '',
    targetVisaTypeId: '',
    nameEn: '',
    nameAz: '',
    code: '',
  });

  // Question Builder & Pool Picker State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [newCategoryNameAz, setNewCategoryNameAz] = useState('');

  const [showPoolQuestionsModal, setShowPoolQuestionsModal] = useState(false);
  const [poolQuestions, setPoolQuestions] = useState<any[]>([]);
  const [selectedPoolQIds, setSelectedPoolQIds] = useState<string[]>([]);
  const [attachTargetCategoryId, setAttachTargetCategoryId] = useState<string>('');

  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
  const [editingQuestionConfig, setEditingQuestionConfig] = useState<any | null>(null);
  const [qForm, setQForm] = useState<any>({
    categoryId: '',
    titleEn: '',
    titleAz: '',
    officialTextEn: '',
    officialTextAz: '',
    answerType: 'TEXT',
    isRequired: true,
    isReusable: true,
    isRepeatable: false,
    officialFormOrder: 1,
    helpTextEn: '',
    defaultValue: '',
    schengenPdfFieldKey: '',
    options: [{ optionCode: '', labelEn: '', labelAz: '' }],
    conditions: [] as any[],
    validations: [] as any[],
  });

  // Document Builder & Pool Picker State
  const [showPoolDocsModal, setShowPoolDocsModal] = useState(false);
  const [poolDocs, setPoolDocs] = useState<any[]>([]);
  const [selectedPoolDocIds, setSelectedPoolDocIds] = useState<string[]>([]);

  const [showDocBuilder, setShowDocBuilder] = useState(false);
  const [editingDocConfig, setEditingDocConfig] = useState<any | null>(null);
  const [docForm, setDocForm] = useState<any>({
    nameEn: '',
    nameAz: '',
    descriptionEn: '',
    descriptionAz: '',
    category: 'PURPOSE_SPECIFIC',
    isRequired: true,
    displayOrder: 1,
    conditions: [] as any[],
  });

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState(
    'titleEn,officialTextEn,answerType,categoryName,isRequired,options\nPrevious Schengen Visa Number,Please enter your previous Schengen visa sticker number,TEXT,1. Your Plans,false,\nTravel Companion Type,Who are you travelling with?,SINGLE_SELECT,1. Your Plans,true,Alone|Family|Business Delegation'
  );
  const [importDryRunResult, setImportDryRunResult] = useState<any | null>(null);

  // Visa Centre & Embassy Form State
  const [vacForm, setVacForm] = useState<any>({
    id: '',
    providerName: 'Capago',
    centreName: '',
    address: '',
    city: 'Baku',
    locationCountryCode: 'AZ',
    locationCountryName: 'Azerbaijan',
    telephone: '',
    email: '',
    officialWebsite: '',
    appointmentBookingUrl: '',
    workingHours: 'Mon–Fri 09:00 – 17:00',
    status: 'ACTIVE',
  });

  const [embassyForm, setEmbassyForm] = useState<any>({
    id: '',
    responsibleAuthority: '',
    address: '',
    city: 'Baku',
    locationCountryCode: 'AZ',
    locationCountryName: 'Azerbaijan',
    telephone: '',
    email: '',
    officialWebsite: '',
    visaInformationUrl: '',
    consularHours: 'Mon–Fri 09:00 – 12:30',
    status: 'ACTIVE',
  });

  // Interactive Preview & Publish State
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [publishSummary, setPublishSummary] = useState('');

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCountries = async () => {
    setLoading(true);
    try {
      const res = await vcmsApi.listDestinations({
        search,
        status: statusFilter,
        isSchengen: schengenFilter,
      });
      setCountries(res.data?.countries || []);
    } catch (err: any) {
      notify(err.message || 'Failed to load destinations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCountryDetail = async (cId: string) => {
    setLoading(true);
    try {
      const res = await vcmsApi.getCountryDetail(cId);
      const c = res.data?.country;
      setCountryDetail(c);

      if (c) {
        const firstVt = c.visaTypes?.[0];
        const vtId = selectedVisaTypeId && c.visaTypes?.some((v: any) => v.id === selectedVisaTypeId)
          ? selectedVisaTypeId
          : firstVt?.id || '';
        setSelectedVisaTypeId(vtId);

        const activeVt = c.visaTypes?.find((v: any) => v.id === vtId) || firstVt;
        const firstPurpose = activeVt?.purposes?.[0];
        const pId =
          selectedPurposeId && activeVt?.purposes?.some((p: any) => p.id === selectedPurposeId)
            ? selectedPurposeId
            : firstPurpose?.id || '';
        setSelectedPurposeId(pId);

        const vac = c.visaApplicationCentres?.[0];
        if (vac) {
          setVacForm({
            id: vac.id,
            providerName: vac.providerName || '',
            centreName: vac.centreName || '',
            address: vac.address || '',
            city: vac.city || 'Baku',
            locationCountryCode: vac.locationCountryCode || 'AZ',
            locationCountryName: vac.locationCountryName || 'Azerbaijan',
            telephone: vac.telephone || '',
            email: vac.email || '',
            officialWebsite: vac.officialWebsite || '',
            appointmentBookingUrl: vac.appointmentBookingUrl || '',
            workingHours: vac.workingHours || 'Mon–Fri 09:00 – 17:00',
            status: vac.status || 'ACTIVE',
          });
        } else {
          setVacForm({
            id: '',
            providerName: 'Capago',
            centreName: `${c.nameEn} Visa Application Centre — Baku`,
            address: '',
            city: 'Baku',
            locationCountryCode: 'AZ',
            locationCountryName: 'Azerbaijan',
            telephone: '',
            email: '',
            officialWebsite: '',
            appointmentBookingUrl: '',
            workingHours: 'Mon–Fri 09:00 – 17:00',
            status: 'ACTIVE',
          });
        }

        const emb = c.embassies?.[0];
        if (emb) {
          setEmbassyForm({
            id: emb.id,
            responsibleAuthority: emb.responsibleAuthority || '',
            address: emb.address || '',
            city: emb.city || 'Baku',
            locationCountryCode: emb.locationCountryCode || 'AZ',
            locationCountryName: emb.locationCountryName || 'Azerbaijan',
            telephone: emb.telephone || '',
            email: emb.email || '',
            officialWebsite: emb.officialWebsite || '',
            visaInformationUrl: emb.visaInformationUrl || '',
            consularHours: emb.consularHours || 'Mon–Fri 09:00 – 12:30',
            status: emb.status || 'ACTIVE',
          });
        } else {
          setEmbassyForm({
            id: '',
            responsibleAuthority: `Embassy of ${c.nameEn} in Baku`,
            address: '',
            city: 'Baku',
            locationCountryCode: 'AZ',
            locationCountryName: 'Azerbaijan',
            telephone: '',
            email: '',
            officialWebsite: '',
            visaInformationUrl: '',
            consularHours: 'Mon–Fri 09:00 – 12:30',
            status: 'ACTIVE',
          });
        }
      }
    } catch (err: any) {
      notify(err.message || 'Failed to load country configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPurposeWorkspace = async (pId: string) => {
    if (!pId) {
      setPurposeWorkspace(null);
      return;
    }
    try {
      const res = await vcmsApi.getPurposeWorkspace(pId);
      setPurposeWorkspace(res.data);
      if (res.data?.categories?.[0] && !attachTargetCategoryId) {
        setAttachTargetCategoryId(res.data.categories[0].id);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to load purpose workspace', 'error');
    }
  };

  useEffect(() => {
    if (!countryId) {
      loadCountries();
    } else {
      loadCountryDetail(countryId);
    }
  }, [countryId, search, statusFilter, schengenFilter]);

  useEffect(() => {
    if (selectedPurposeId) {
      loadPurposeWorkspace(selectedPurposeId);
    }
  }, [selectedPurposeId]);

  const currentVisaType = useMemo(() => {
    return countryDetail?.visaTypes?.find((v: any) => v.id === selectedVisaTypeId) || countryDetail?.visaTypes?.[0] || null;
  }, [countryDetail, selectedVisaTypeId]);

  const availablePurposes = useMemo(() => {
    return currentVisaType?.purposes || [];
  }, [currentVisaType]);

  // Handlers
  const handleCreateCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await vcmsApi.createCountry(newCountryForm);
      setShowAddCountryModal(false);
      notify(`Country "${res.data.country.nameEn}" created!`);
      navigate(`/admin/destinations/${res.data.country.id}`);
    } catch (err: any) {
      notify(err.message || 'Failed to create country', 'error');
    }
  };

  const handleSaveVisaType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryId) return;
    try {
      if (visaTypeForm.id) {
        await vcmsApi.updateVisaType(visaTypeForm.id, visaTypeForm);
        notify('Visa Type updated');
      } else {
        await vcmsApi.createVisaType(countryId, visaTypeForm);
        notify('Visa Type created');
      }
      setShowVisaTypeModal(false);
      await loadCountryDetail(countryId);
    } catch (err: any) {
      notify(err.message || 'Failed to save visa type', 'error');
    }
  };

  const handleSavePurpose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryId) return;
    try {
      if (purposeForm.id) {
        await vcmsApi.updateVisaPurpose(purposeForm.id, purposeForm);
        notify('Visa Purpose updated');
      } else {
        const res = await vcmsApi.createVisaPurpose(purposeForm.visaTypeId || selectedVisaTypeId, purposeForm);
        setSelectedPurposeId(res.data?.purpose?.id || selectedPurposeId);
        notify('Visa Purpose created with 5 default question categories');
      }
      setShowPurposeModal(false);
      await loadCountryDetail(countryId);
    } catch (err: any) {
      notify(err.message || 'Failed to save purpose', 'error');
    }
  };

  const handleDuplicatePurpose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryId) return;
    try {
      const res = await vcmsApi.duplicateVisaPurpose(dupPurposeForm.sourcePurposeId, dupPurposeForm);
      setShowDuplicatePurposeModal(false);
      notify(`Purpose cloned with all categories, questions, conditions & documents!`);
      await loadCountryDetail(countryId);
      if (res.data?.purpose?.id) {
        setSelectedPurposeId(res.data.purpose.id);
      }
    } catch (err: any) {
      notify(err.message || 'Failed to duplicate purpose', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurposeId) return;
    try {
      await vcmsApi.createQuestionCategory(selectedPurposeId, {
        nameEn: newCategoryNameEn,
        nameAz: newCategoryNameAz || newCategoryNameEn,
      });
      setNewCategoryNameEn('');
      setNewCategoryNameAz('');
      setShowCategoryModal(false);
      await loadPurposeWorkspace(selectedPurposeId);
      notify('Question category added');
    } catch (err: any) {
      notify(err.message || 'Failed to create category', 'error');
    }
  };

  const openPoolQuestionsPicker = async (catId?: string) => {
    try {
      const res = await vcmsApi.listQuestionPool();
      setPoolQuestions(res.data?.questions || []);
      setSelectedPoolQIds([]);
      setAttachTargetCategoryId(catId || purposeWorkspace?.categories?.[0]?.id || '');
      setShowPoolQuestionsModal(true);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleAttachPoolQuestions = async () => {
    if (!selectedPurposeId || selectedPoolQIds.length === 0) return;
    try {
      await vcmsApi.attachQuestionsFromPool(selectedPurposeId, {
        categoryId: attachTargetCategoryId,
        globalQuestionIds: selectedPoolQIds,
      });
      setShowPoolQuestionsModal(false);
      await loadPurposeWorkspace(selectedPurposeId);
      if (countryId) await loadCountryDetail(countryId);
      notify(`${selectedPoolQIds.length} question(s) attached from Central Pool`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const openQuestionBuilder = (existingCfg?: any, defaultCategoryId?: string) => {
    if (existingCfg) {
      setEditingQuestionConfig(existingCfg);
      setQForm({
        categoryId: existingCfg.categoryId,
        titleEn: existingCfg.titleEn,
        titleAz: existingCfg.titleAz,
        officialTextEn: existingCfg.officialTextEn,
        officialTextAz: existingCfg.officialTextAz,
        answerType: existingCfg.answerType,
        isRequired: existingCfg.isRequired,
        isReusable: true,
        isRepeatable: existingCfg.isRepeatable,
        officialFormOrder: existingCfg.officialFormOrder,
        helpTextEn: existingCfg.helpTextEn || '',
        defaultValue: existingCfg.defaultValue || '',
        schengenPdfFieldKey: existingCfg.schengenPdfFieldKey || '',
        options:
          existingCfg.options?.length > 0
            ? existingCfg.options.map((o: any) => ({
                optionCode: o.optionCode,
                labelEn: o.labelEn,
                labelAz: o.labelAz || o.labelEn,
              }))
            : [{ optionCode: '', labelEn: '', labelAz: '' }],
        conditions: (existingCfg.conditions || []).map((c: any) => ({
          groupOperator: c.groupOperator || 'AND',
          action: c.action || 'SHOW_AND_REQUIRE',
          triggerQuestionCode: c.triggerQuestionCode,
          comparator: c.comparator || 'EQUALS',
          triggerValue: c.triggerValue || '',
        })),
        validations: (existingCfg.validations || []).map((v: any) => ({
          ruleType: v.ruleType,
          ruleValue: v.ruleValue,
          errorMessageEn: v.errorMessageEn || '',
        })),
      });
    } else {
      setEditingQuestionConfig(null);
      setQForm({
        categoryId: defaultCategoryId || purposeWorkspace?.categories?.[0]?.id || '',
        titleEn: '',
        titleAz: '',
        officialTextEn: '',
        officialTextAz: '',
        answerType: 'TEXT',
        isRequired: true,
        isReusable: true,
        isRepeatable: false,
        officialFormOrder: (purposeWorkspace?.questions?.length || 0) + 1,
        helpTextEn: '',
        defaultValue: '',
        schengenPdfFieldKey: '',
        options: [{ optionCode: '', labelEn: '', labelAz: '' }],
        conditions: [],
        validations: [],
      });
    }
    setShowQuestionBuilder(true);
  };

  const handleSaveQuestionBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurposeId) return;
    try {
      if (editingQuestionConfig) {
        // Local Country/Purpose override ONLY (isolated from other countries!)
        await vcmsApi.updatePurposeQuestionConfig(editingQuestionConfig.configId, {
          categoryId: qForm.categoryId,
          customTitleEn: qForm.titleEn,
          customTitleAz: qForm.titleAz,
          customOfficialTextEn: qForm.officialTextEn,
          customOfficialTextAz: qForm.officialTextAz,
          customHelpTextEn: qForm.helpTextEn || null,
          customDefaultValue: qForm.defaultValue || null,
          customAnswerType: qForm.answerType,
          isRequired: qForm.isRequired,
          isRepeatable: qForm.isRepeatable,
          officialFormOrder: Number(qForm.officialFormOrder),
          optionsOverrideJson:
            ['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(qForm.answerType)
              ? qForm.options.filter((o: any) => o.labelEn.trim())
              : null,
          conditions: qForm.conditions,
          validations: qForm.validations,
        });
        notify('Question local configuration updated (isolated to this country & purpose)');
      } else {
        await vcmsApi.createAndAttachQuestion(selectedPurposeId, {
          ...qForm,
          options: ['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(qForm.answerType)
            ? qForm.options.filter((o: any) => o.labelEn.trim())
            : [],
        });
        notify('New question added to Question Pool & attached to purpose!');
      }
      setShowQuestionBuilder(false);
      await loadPurposeWorkspace(selectedPurposeId);
      if (countryId) await loadCountryDetail(countryId);
    } catch (err: any) {
      notify(err.message || 'Failed to save question', 'error');
    }
  };

  const handleMoveQuestionOrder = async (question: any, direction: -1 | 1) => {
    if (!purposeWorkspace || !selectedPurposeId) return;
    const catQuestions = purposeWorkspace.questions
      .filter((q: any) => q.categoryId === question.categoryId)
      .sort((a: any, b: any) => a.officialFormOrder - b.officialFormOrder);

    const idx = catQuestions.findIndex((q: any) => q.configId === question.configId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= catQuestions.length) return;

    const a = catQuestions[idx];
    const b = catQuestions[swapIdx];
    try {
      await vcmsApi.reorderPurposeQuestions(selectedPurposeId, [
        { id: a.configId, officialFormOrder: b.officialFormOrder },
        { id: b.configId, officialFormOrder: a.officialFormOrder },
      ]);
      await loadPurposeWorkspace(selectedPurposeId);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const openPoolDocsPicker = async () => {
    try {
      const res = await vcmsApi.listDocumentPool();
      setPoolDocs(res.data?.documents || []);
      setSelectedPoolDocIds([]);
      setShowPoolDocsModal(true);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleAttachPoolDocs = async () => {
    if (!selectedPurposeId || selectedPoolDocIds.length === 0) return;
    try {
      await vcmsApi.attachDocumentsFromPool(selectedPurposeId, {
        globalDocumentIds: selectedPoolDocIds,
      });
      setShowPoolDocsModal(false);
      await loadPurposeWorkspace(selectedPurposeId);
      if (countryId) await loadCountryDetail(countryId);
      notify(`${selectedPoolDocIds.length} document(s) attached from Document Pool`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const openDocumentBuilder = (existingDoc?: any) => {
    if (existingDoc) {
      setEditingDocConfig(existingDoc);
      setDocForm({
        nameEn: existingDoc.nameEn,
        nameAz: existingDoc.nameAz,
        descriptionEn: existingDoc.descriptionEn,
        descriptionAz: existingDoc.descriptionAz,
        category: existingDoc.category,
        isRequired: existingDoc.isRequired,
        displayOrder: existingDoc.displayOrder,
        conditions: (existingDoc.conditions || []).map((c: any) => ({
          groupOperator: c.groupOperator || 'AND',
          action: c.action || 'SHOW_AND_REQUIRE',
          triggerQuestionCode: c.triggerQuestionCode,
          comparator: c.comparator || 'EQUALS',
          triggerValue: c.triggerValue || '',
        })),
      });
    } else {
      setEditingDocConfig(null);
      setDocForm({
        nameEn: '',
        nameAz: '',
        descriptionEn: '',
        descriptionAz: '',
        category: 'PURPOSE_SPECIFIC',
        isRequired: true,
        displayOrder: (purposeWorkspace?.documents?.length || 0) + 1,
        conditions: [],
      });
    }
    setShowDocBuilder(true);
  };

  const handleSaveDocumentBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurposeId) return;
    try {
      if (editingDocConfig) {
        await vcmsApi.updatePurposeDocumentConfig(editingDocConfig.configId, {
          customNameEn: docForm.nameEn,
          customNameAz: docForm.nameAz,
          customDescriptionEn: docForm.descriptionEn,
          customDescriptionAz: docForm.descriptionAz,
          isRequired: docForm.isRequired,
          displayOrder: Number(docForm.displayOrder),
          conditions: docForm.conditions,
        });
        notify('Document configuration updated for this purpose');
      } else {
        await vcmsApi.createAndAttachDocument(selectedPurposeId, docForm);
        notify('New required document added to Document Pool & attached to purpose!');
      }
      setShowDocBuilder(false);
      await loadPurposeWorkspace(selectedPurposeId);
      if (countryId) await loadCountryDetail(countryId);
    } catch (err: any) {
      notify(err.message || 'Failed to save document', 'error');
    }
  };

  const handleSaveVac = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryId) return;
    try {
      await vcmsApi.saveVisaCentre({ ...vacForm, countryId });
      await loadCountryDetail(countryId);
      notify('Visa Application Centre saved & synced with Appointment Providers');
    } catch (err: any) {
      notify(err.message || 'Failed to save Visa Application Centre', 'error');
    }
  };

  const handleSaveEmbassy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryId) return;
    try {
      await vcmsApi.saveEmbassy({ ...embassyForm, countryId });
      await loadCountryDetail(countryId);
      notify('Embassy information saved & synced with Appointment Providers');
    } catch (err: any) {
      notify(err.message || 'Failed to save Embassy', 'error');
    }
  };

  const handlePublishCountry = async () => {
    if (!countryId) return;
    try {
      const res = await vcmsApi.publishCountry(
        countryId,
        publishSummary || `Published ${countryDetail?.nameEn} Visa Configuration`
      );
      setPublishSummary('');
      await loadCountryDetail(countryId);
      notify(`Country configuration published as Version v${res.data.version.versionNumber}!`);
    } catch (err: any) {
      notify(err.message || 'Publish failed', 'error');
    }
  };

  const handleRollbackVersion = async (versionId: string, verNum: number) => {
    if (!countryId) return;
    try {
      await vcmsApi.rollbackCountryVersion(countryId, versionId);
      await loadCountryDetail(countryId);
      notify(`Rolled back to snapshot v${verNum}`);
    } catch (err: any) {
      notify(err.message || 'Rollback failed', 'error');
    }
  };

  const parseCsvRows = () => {
    const lines = importCsvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cols = line.split(',');
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] !== undefined ? cols[i].trim() : '';
      });
      obj.isRequired = String(obj.isRequired).toLowerCase() !== 'false';
      return obj;
    });
  };

  const handleRunImport = async (dryRun: boolean) => {
    try {
      const rows = parseCsvRows();
      const res = await vcmsApi.importQuestions({
        rows,
        dryRun,
        purposeId: selectedPurposeId,
        categoryId: purposeWorkspace?.categories?.[0]?.id,
      });
      setImportDryRunResult(res.data);
      if (!dryRun && res.data?.committed) {
        setShowImportModal(false);
        setImportDryRunResult(null);
        if (selectedPurposeId) await loadPurposeWorkspace(selectedPurposeId);
        notify(`Imported ${res.data.importedCount} question(s) successfully!`);
      }
    } catch (err: any) {
      notify(err.message || 'Import error', 'error');
    }
  };

  const handleExportPurposeJson = async () => {
    if (!selectedPurposeId) return;
    try {
      const res = await vcmsApi.exportPurpose(selectedPurposeId);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${countryDetail?.code || 'COUNTRY'}_${purposeWorkspace?.purpose?.code || 'PURPOSE'}_vcms.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Configuration exported');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // ==========================================================================
  // VIEW A: COUNTRIES LIST (/admin/destinations)
  // ==========================================================================
  if (!countryId) {
    return (
      <div className="vcms-page">
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 2000,
              padding: '12px 18px',
              borderRadius: 12,
              background: toast.type === 'error' ? '#dc2626' : '#0f172a',
              color: '#fff',
              fontWeight: 600,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            {toast.text}
          </div>
        )}

        <div className="vcms-header">
          <div className="vcms-title-group">
            <h1>
              Destinations
              <span className="vcms-badge active">{countries.length} Countries</span>
            </h1>
            <p>
              Manage destination countries, country-specific Visa Types (Short Stay / Long Stay), Purposes, Application
              Questions, Required Documents, Visa Centres, and Embassies without writing code.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="vcms-btn accent" onClick={() => setShowAddCountryModal(true)}>
              + Add Country
            </button>
          </div>
        </div>

        <div className="vcms-toolbar">
          <div className="vcms-filters">
            <input
              type="text"
              className="vcms-input"
              style={{ minWidth: 260 }}
              placeholder="Search countries by name or ISO code (e.g. France, FR)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="vcms-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses (Active / Draft / Inactive)</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select className="vcms-select" value={schengenFilter} onChange={(e) => setSchengenFilter(e.target.value)}>
              <option value="ALL">Schengen & Non-Schengen</option>
              <option value="true">Schengen Area Only</option>
              <option value="false">Non-Schengen Only</option>
            </select>
          </div>
        </div>

        <div className="vcms-country-list">
          {countries.map((c) => (
            <div key={c.id} className="vcms-country-row" onClick={() => navigate(`/admin/destinations/${c.id}`)}>
              <div className="vcms-country-left">
                {c.flagUrl ? (
                  <img src={c.flagUrl} alt={c.nameEn} className="vcms-country-flag" />
                ) : (
                  <div className="vcms-country-flag" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1d4ed8' }}>
                    {c.code}
                  </div>
                )}
                <div className="vcms-country-meta">
                  <h3>
                    {c.nameEn}{' '}
                    <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.84rem' }}>
                      ({c.code} · {c.nameAz})
                    </span>
                  </h3>
                  <span>
                    {c.region || 'Europe'} · {c.isSchengen ? 'Schengen' : 'Non-Schengen'} · {c.visaTypesCount || 0} Visa
                    Types · {c.purposesCount || 0} Purposes · {c.totalQuestionsCount || 0} Questions ·{' '}
                    {c.totalDocumentsCount || 0} Documents
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="vcms-badge info">{c.completenessPercent || 100}% Configured</span>
                {c.latestVersion && <span className="vcms-badge code">v{c.latestVersion.versionNumber}</span>}
                <span className={`vcms-badge ${String(c.status || 'ACTIVE').toLowerCase()}`}>{c.status}</span>
                <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>
              </div>
            </div>
          ))}
        </div>

        {showAddCountryModal && (
          <div className="vcms-modal-backdrop" onClick={() => setShowAddCountryModal(false)}>
            <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
              <div className="vcms-modal-header">
                <h2>+ Add New Destination Country</h2>
                <button className="vcms-btn sm secondary" onClick={() => setShowAddCountryModal(false)}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateCountry}>
                <div className="vcms-form-grid">
                  <div className="vcms-field">
                    <label>Country Name (English) *</label>
                    <input
                      className="vcms-input"
                      required
                      placeholder="e.g. United States"
                      value={newCountryForm.nameEn}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, nameEn: e.target.value })}
                    />
                  </div>
                  <div className="vcms-field">
                    <label>Country Name (Azerbaijani)</label>
                    <input
                      className="vcms-input"
                      placeholder="məs. Amerika Birləşmiş Ştatları"
                      value={newCountryForm.nameAz}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, nameAz: e.target.value })}
                    />
                  </div>
                  <div className="vcms-field">
                    <label>Country Code (ISO 2-letter) *</label>
                    <input
                      className="vcms-input"
                      required
                      maxLength={3}
                      placeholder="e.g. US, GB, NL"
                      value={newCountryForm.code}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="vcms-field">
                    <label>Region</label>
                    <select
                      className="vcms-select"
                      value={newCountryForm.region}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, region: e.target.value })}
                    >
                      <option value="Europe">Europe</option>
                      <option value="North America">North America</option>
                      <option value="Asia">Asia</option>
                      <option value="Middle East">Middle East</option>
                    </select>
                  </div>
                  <div className="vcms-field">
                    <label>Zone Classification</label>
                    <select
                      className="vcms-select"
                      value={String(newCountryForm.isSchengen)}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, isSchengen: e.target.value === 'true' })}
                    >
                      <option value="true">Schengen</option>
                      <option value="false">Non-Schengen</option>
                    </select>
                  </div>
                  <div className="vcms-field">
                    <label>Initial Status</label>
                    <select
                      className="vcms-select"
                      value={newCountryForm.status}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, status: e.target.value })}
                    >
                      <option value="DRAFT">Draft (Configure before opening to customers)</option>
                      <option value="ACTIVE">Active (Immediately visible)</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  <div className="vcms-field">
                    <label>Processing Time Label</label>
                    <input
                      className="vcms-input"
                      value={newCountryForm.processingDaysLabel}
                      onChange={(e) => setNewCountryForm({ ...newCountryForm, processingDaysLabel: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" className="vcms-btn secondary" onClick={() => setShowAddCountryModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="vcms-btn accent">
                    Create Country & Open Hub
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // VIEW B: COUNTRY MANAGEMENT HUB (/admin/destinations/:countryId)
  // ==========================================================================
  if (!countryDetail) {
    return <div className="vcms-page">Loading country configuration...</div>;
  }

  return (
    <div className="vcms-page">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: '12px 18px',
            borderRadius: 12,
            background: toast.type === 'error' ? '#dc2626' : '#0f172a',
            color: '#fff',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div className="vcms-header">
        <div className="vcms-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button className="vcms-btn sm secondary" onClick={() => navigate('/admin/destinations')}>
              ← All Destinations
            </button>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.86rem' }}>
              {countryDetail.nameEn} ({countryDetail.code})
            </span>
          </div>
          <h1>
            {countryDetail.nameEn} ({countryDetail.code}) — Country Management
            <span className={`vcms-badge ${String(countryDetail.status).toLowerCase()}`}>{countryDetail.status}</span>
            {countryDetail.latestVersion && (
              <span className="vcms-badge code">v{countryDetail.latestVersion.versionNumber} Published</span>
            )}
          </h1>
          <p>
            {countryDetail.region} · {countryDetail.isSchengen ? 'Schengen Zone' : 'Non-Schengen'} ·{' '}
            {countryDetail.processingDaysLabel || '15 business days'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="vcms-select"
            value={countryDetail.status}
            onChange={async (e) => {
              await vcmsApi.updateCountry(countryDetail.id, { status: e.target.value });
              await loadCountryDetail(countryDetail.id);
              notify(`Country status changed to ${e.target.value}`);
            }}
          >
            <option value="ACTIVE">Status: Active</option>
            <option value="DRAFT">Status: Draft</option>
            <option value="INACTIVE">Status: Inactive</option>
          </select>
          <button
            className="vcms-btn secondary"
            onClick={() => navigate(`/admin/appointments?countryId=${countryDetail.id}`)}
          >
            Manage Appointments
          </button>
          <button className="vcms-btn success" onClick={() => setActiveTab('PREVIEW_PUBLISH')}>
            Review & Publish
          </button>
        </div>
      </div>

      {/* 8-Step Setup Workflow Bar */}
      <div className="vcms-workflow-bar">
        {(countryDetail.steps || []).map((st: any) => (
          <div
            key={st.step}
            className={`vcms-workflow-step ${st.completed ? 'done' : ''}`}
            onClick={() => {
              if (st.key === 'VISA_TYPES' || st.key === 'PURPOSES') setActiveTab('VISA_TYPES');
              if (st.key === 'QUESTIONS') setActiveTab('QUESTIONS');
              if (st.key === 'DOCUMENTS') setActiveTab('DOCUMENTS');
              if (st.key === 'VAC') setActiveTab('VISA_CENTRE');
              if (st.key === 'EMBASSY') setActiveTab('EMBASSY');
              if (st.key === 'PUBLISH') setActiveTab('PREVIEW_PUBLISH');
            }}
          >
            <span className="vcms-workflow-dot">{st.completed ? '✓' : st.step}</span>
            <span>{st.label}</span>
          </div>
        ))}
      </div>

      {/* Country Internal Structure Navigation Tabs */}
      <div className="vcms-tabs">
        <button
          className={`vcms-tab ${activeTab === 'VISA_TYPES' ? 'active' : ''}`}
          onClick={() => setActiveTab('VISA_TYPES')}
        >
          Visa Types & Purposes ({countryDetail.visaTypes?.length || 0})
        </button>
        <button
          className={`vcms-tab ${activeTab === 'QUESTIONS' ? 'active' : ''}`}
          onClick={() => setActiveTab('QUESTIONS')}
        >
          Application Questions ({purposeWorkspace?.questions?.length || 0})
        </button>
        <button
          className={`vcms-tab ${activeTab === 'DOCUMENTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('DOCUMENTS')}
        >
          Required Documents ({purposeWorkspace?.documents?.length || 0})
        </button>
        <button
          className={`vcms-tab ${activeTab === 'VISA_CENTRE' ? 'active' : ''}`}
          onClick={() => setActiveTab('VISA_CENTRE')}
        >
          Visa Application Centre
        </button>
        <button
          className={`vcms-tab ${activeTab === 'EMBASSY' ? 'active' : ''}`}
          onClick={() => setActiveTab('EMBASSY')}
        >
          Embassy
        </button>
        <button
          className={`vcms-tab ${activeTab === 'PREVIEW_PUBLISH' ? 'active' : ''}`}
          onClick={() => setActiveTab('PREVIEW_PUBLISH')}
        >
          Preview & Version Control
        </button>
      </div>

      {/* ====================================================================
          TAB 1: VISA TYPES & PURPOSES
          ==================================================================== */}
      {activeTab === 'VISA_TYPES' && (
        <div>
          <div className="vcms-toolbar">
            <div>
              <strong>Country-Specific Visa Structure</strong>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Each country defines its own Visa Types (e.g., Short Stay C, Long Stay D) and its own Purposes under
                each Visa Type.
              </div>
            </div>
            <button
              className="vcms-btn accent"
              onClick={() => {
                setVisaTypeForm({
                  id: '',
                  code: '',
                  nameEn: '',
                  nameAz: '',
                  stayCategory: 'SHORT',
                  maxDurationDays: 90,
                  maxDurationLabel: 'Up to 90 days in any 180-day period',
                  defaultFeeEur: 80,
                  status: 'ACTIVE',
                });
                setShowVisaTypeModal(true);
              }}
            >
              + Add Visa Type
            </button>
          </div>

          {(countryDetail.visaTypes || []).map((vt: any) => (
            <div key={vt.id} className="vcms-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: '1.12rem' }}>{vt.nameEn}</h3>
                    <span className="vcms-badge code">{vt.code}</span>
                    <span className="vcms-badge info">€{vt.defaultFeeEur} Base Fee</span>
                    <span className={`vcms-badge ${String(vt.status).toLowerCase()}`}>{vt.status}</span>
                  </div>
                  <div style={{ fontSize: '0.83rem', color: '#64748b', marginTop: 4 }}>
                    {vt.maxDurationLabel || vt.descriptionEn} · {vt.purposes?.length || 0} Purposes configured
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="vcms-btn sm secondary"
                    onClick={() => {
                      setVisaTypeForm({
                        id: vt.id,
                        code: vt.code,
                        nameEn: vt.nameEn,
                        nameAz: vt.nameAz || vt.nameEn,
                        stayCategory: vt.stayCategory,
                        maxDurationDays: vt.maxDurationDays || 90,
                        maxDurationLabel: vt.maxDurationLabel || '',
                        defaultFeeEur: vt.defaultFeeEur || 80,
                        status: vt.status,
                      });
                      setShowVisaTypeModal(true);
                    }}
                  >
                    Edit Visa Type
                  </button>
                  <button
                    className="vcms-btn sm accent"
                    onClick={() => {
                      setSelectedVisaTypeId(vt.id);
                      setPurposeForm({
                        id: '',
                        visaTypeId: vt.id,
                        code: '',
                        nameEn: '',
                        nameAz: '',
                        descriptionEn: '',
                        consularFeeOverride: '',
                        status: 'ACTIVE',
                      });
                      setShowPurposeModal(true);
                    }}
                  >
                    + Add Purpose
                  </button>
                </div>
              </div>

              {/* Purposes under this Visa Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(vt.purposes || []).map((p: any) => (
                  <div key={p.id} className="vcms-item-row">
                    <div className="vcms-item-main">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: '0.96rem' }}>{p.nameEn}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>({p.nameAz})</span>
                          <span className="vcms-badge code">{p.code}</span>
                          <span className={`vcms-badge ${String(p.status).toLowerCase()}`}>{p.status}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                          {p.descriptionEn || 'Official application form & required documents configured'} ·{' '}
                          <strong>{p._count?.questionConfigs || 0} Questions</strong> ·{' '}
                          <strong>{p._count?.documentConfigs || 0} Required Documents</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="vcms-btn sm primary"
                        onClick={() => {
                          setSelectedVisaTypeId(vt.id);
                          setSelectedPurposeId(p.id);
                          setActiveTab('QUESTIONS');
                        }}
                      >
                        Configure Questions ({p._count?.questionConfigs || 0}) →
                      </button>
                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => {
                          setSelectedVisaTypeId(vt.id);
                          setSelectedPurposeId(p.id);
                          setActiveTab('DOCUMENTS');
                        }}
                      >
                        Configure Documents ({p._count?.documentConfigs || 0}) →
                      </button>
                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => {
                          setDupPurposeForm({
                            sourcePurposeId: p.id,
                            targetVisaTypeId: vt.id,
                            nameEn: `${p.nameEn} (Copy)`,
                            nameAz: `${p.nameAz || p.nameEn} (Kopya)`,
                            code: `${p.code}_COPY`,
                          });
                          setShowDuplicatePurposeModal(true);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => {
                          setPurposeForm({
                            id: p.id,
                            visaTypeId: vt.id,
                            code: p.code,
                            nameEn: p.nameEn,
                            nameAz: p.nameAz || '',
                            descriptionEn: p.descriptionEn || '',
                            consularFeeOverride: p.consularFeeOverride ?? '',
                            status: p.status,
                          });
                          setShowPurposeModal(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          TAB 2 & TAB 3 HEADER: PURPOSE SELECTOR BAR
          ==================================================================== */}
      {(activeTab === 'QUESTIONS' || activeTab === 'DOCUMENTS') && (
        <div className="vcms-toolbar" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
          <div className="vcms-filters">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Visa Type:</label>
              <select
                className="vcms-select"
                value={selectedVisaTypeId}
                onChange={(e) => {
                  const nextVtId = e.target.value;
                  setSelectedVisaTypeId(nextVtId);
                  const vt = countryDetail.visaTypes?.find((v: any) => v.id === nextVtId);
                  setSelectedPurposeId(vt?.purposes?.[0]?.id || '');
                }}
              >
                {(countryDetail.visaTypes || []).map((vt: any) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Purpose:</label>
              <select
                className="vcms-select"
                value={selectedPurposeId}
                onChange={(e) => setSelectedPurposeId(e.target.value)}
              >
                {availablePurposes.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEn} ({p.nameAz})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="vcms-btn sm secondary" onClick={() => setShowImportModal(true)}>
              Import CSV / Excel
            </button>
            <button className="vcms-btn sm secondary" onClick={handleExportPurposeJson}>
              Export Purpose
            </button>
            <button className="vcms-btn sm accent" onClick={() => setActiveTab('PREVIEW_PUBLISH')}>
              Live Form Preview
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: APPLICATION QUESTIONS (CATEGORIES + 13 ANSWER TYPES + CONDITIONAL LOGIC)
          ==================================================================== */}
      {activeTab === 'QUESTIONS' && purposeWorkspace && (
        <div>
          <div className="vcms-toolbar">
            <div>
              <strong>
                {countryDetail.nameEn} → {purposeWorkspace.purpose?.visaType?.nameEn} →{' '}
                {purposeWorkspace.purpose?.nameEn} — Application Questions
              </strong>
              <div style={{ fontSize: '0.81rem', color: '#64748b' }}>
                Questions are grouped by official form categories and ordered by official form sequence. Edits here are
                isolated to this country/purpose and do not alter other countries.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="vcms-btn secondary" onClick={() => setShowCategoryModal(true)}>
                + Add Category
              </button>
              <button className="vcms-btn secondary" onClick={() => openPoolQuestionsPicker()}>
                + Add from Question Pool
              </button>
              <button className="vcms-btn accent" onClick={() => openQuestionBuilder()}>
                + Create New Question
              </button>
            </div>
          </div>

          {(purposeWorkspace.categories || []).map((cat: any) => (
            <div key={cat.id} className="vcms-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                    {cat.nameEn}{' '}
                    <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.86rem' }}>({cat.nameAz})</span>
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {cat.questions?.length || 0} question(s) in official application form sequence
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="vcms-btn sm secondary" onClick={() => openPoolQuestionsPicker(cat.id)}>
                    + Attach from Pool
                  </button>
                  <button className="vcms-btn sm accent" onClick={() => openQuestionBuilder(undefined, cat.id)}>
                    + Add Question Here
                  </button>
                </div>
              </div>

              {(cat.questions || []).length === 0 ? (
                <div style={{ padding: 14, color: '#94a3b8', fontSize: '0.85rem' }}>
                  No questions in this category yet. Click "+ Add Question Here" or "+ Attach from Pool".
                </div>
              ) : (
                (cat.questions || []).map((q: any) => (
                  <div key={q.configId} className="vcms-item-row">
                    <div className="vcms-item-main">
                      <span className="vcms-order-pill">#{q.officialFormOrder}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="vcms-badge code">{q.questionCode}</span>
                          <strong>{q.titleEn}</strong>
                          <span className="vcms-badge info">{q.answerType}</span>
                          <span className={`vcms-badge ${q.isRequired ? 'required' : 'inactive'}`}>
                            {q.isRequired ? 'Required' : 'Optional'}
                          </span>
                          {q.conditions?.length > 0 && (
                            <span className="vcms-badge conditional">
                              Conditional: IF {q.conditions[0].triggerQuestionCode} {q.conditions[0].comparator}{' '}
                              {q.conditions[0].triggerValue}
                            </span>
                          )}
                          {q.isOverriddenLocally && <span className="vcms-badge override">Local Country Override</span>}
                          {q.schengenPdfFieldKey && <span className="vcms-badge active">PDF: {q.schengenPdfFieldKey}</span>}
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: 4 }}>{q.officialTextEn}</div>
                        {q.options?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {q.options.map((opt: any) => (
                              <span
                                key={opt.optionCode || opt.labelEn}
                                style={{
                                  fontSize: '0.73rem',
                                  padding: '2px 8px',
                                  background: '#f1f5f9',
                                  borderRadius: 6,
                                  color: '#334155',
                                }}
                              >
                                <code>{opt.optionCode}</code>: {opt.labelEn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="vcms-btn sm secondary"
                        title="Move Up"
                        onClick={() => handleMoveQuestionOrder(q, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="vcms-btn sm secondary"
                        title="Move Down"
                        onClick={() => handleMoveQuestionOrder(q, 1)}
                      >
                        ↓
                      </button>
                      <button className="vcms-btn sm secondary" onClick={() => openQuestionBuilder(q)}>
                        Edit / Logic
                      </button>
                      <button
                        className="vcms-btn sm danger"
                        onClick={async () => {
                          await vcmsApi.detachPurposeQuestion(q.configId);
                          await loadPurposeWorkspace(selectedPurposeId);
                          notify(`Detached ${q.questionCode} from this purpose (kept in Question Pool)`);
                        }}
                      >
                        Detach
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          TAB 3: REQUIRED DOCUMENTS (DOC-001 + DOCUMENT CATEGORIES + CONDITIONS)
          ==================================================================== */}
      {activeTab === 'DOCUMENTS' && purposeWorkspace && (
        <div className="vcms-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>
                {countryDetail.nameEn} → {purposeWorkspace.purpose?.visaType?.nameEn} →{' '}
                {purposeWorkspace.purpose?.nameEn} — Required Documents
              </h3>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Each document has a unique ID (DOC-001...) so when a customer uploads a file, the system knows the exact
                required document it satisfies.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="vcms-btn secondary" onClick={openPoolDocsPicker}>
                + Add from Document Pool
              </button>
              <button className="vcms-btn accent" onClick={() => openDocumentBuilder()}>
                + Create New Document
              </button>
            </div>
          </div>

          {(purposeWorkspace.documents || []).map((doc: any) => (
            <div key={doc.configId} className="vcms-item-row">
              <div className="vcms-item-main">
                <span className="vcms-order-pill">#{doc.displayOrder}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="vcms-badge code">{doc.documentCode}</span>
                    <strong>{doc.nameEn}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>({doc.nameAz})</span>
                    <span className="vcms-badge info">{doc.category}</span>
                    <span className={`vcms-badge ${doc.isRequired ? 'required' : 'inactive'}`}>
                      {doc.isRequired ? 'Required' : 'Optional'}
                    </span>
                    {doc.conditions?.length > 0 && (
                      <span className="vcms-badge conditional">
                        Conditional: IF {doc.conditions[0].triggerQuestionCode} {doc.conditions[0].comparator}{' '}
                        {doc.conditions[0].triggerValue}
                      </span>
                    )}
                    {doc.isOverriddenLocally && <span className="vcms-badge override">Local Description Override</span>}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: 4 }}>{doc.descriptionEn}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="vcms-btn sm secondary" onClick={() => openDocumentBuilder(doc)}>
                  Edit / Conditions
                </button>
                <button
                  className="vcms-btn sm danger"
                  onClick={async () => {
                    await vcmsApi.detachPurposeDocument(doc.configId);
                    await loadPurposeWorkspace(selectedPurposeId);
                    notify(`Detached ${doc.documentCode} from this purpose`);
                  }}
                >
                  Detach
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          TAB 4: 8.1 VISA APPLICATION CENTRE
          ==================================================================== */}
      {activeTab === 'VISA_CENTRE' && (
        <div className="vcms-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>{countryDetail.nameEn} — Visa Application Centre</h3>
              <span style={{ fontSize: '0.83rem', color: '#64748b' }}>
                Separate institution from the Embassy. Connected to both destination country ({countryDetail.nameEn})
                and applicant location ({vacForm.locationCountryName}).
              </span>
            </div>
            <span className={`vcms-badge ${String(vacForm.status).toLowerCase()}`}>{vacForm.status}</span>
          </div>

          <form onSubmit={handleSaveVac}>
            <div className="vcms-form-grid">
              <div className="vcms-field">
                <label>Provider Name *</label>
                <input
                  className="vcms-input"
                  required
                  placeholder="e.g. Capago, VFS Global, TLScontact"
                  value={vacForm.providerName}
                  onChange={(e) => setVacForm({ ...vacForm, providerName: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Centre Name</label>
                <input
                  className="vcms-input"
                  placeholder="e.g. Capago France Visa Centre — Baku"
                  value={vacForm.centreName}
                  onChange={(e) => setVacForm({ ...vacForm, centreName: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Applicant Location Country (ISO)</label>
                <input
                  className="vcms-input"
                  value={vacForm.locationCountryCode}
                  onChange={(e) => setVacForm({ ...vacForm, locationCountryCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="vcms-field">
                <label>City</label>
                <input
                  className="vcms-input"
                  value={vacForm.city}
                  onChange={(e) => setVacForm({ ...vacForm, city: e.target.value })}
                />
              </div>
              <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                <label>Address *</label>
                <input
                  className="vcms-input"
                  required
                  placeholder="Globus Center, 609 Jafar Jabbarli Street, 14th Floor, Baku, Azerbaijan"
                  value={vacForm.address}
                  onChange={(e) => setVacForm({ ...vacForm, address: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Telephone</label>
                <input
                  className="vcms-input"
                  placeholder="+994 12 310 07 10"
                  value={vacForm.telephone}
                  onChange={(e) => setVacForm({ ...vacForm, telephone: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Email</label>
                <input
                  className="vcms-input"
                  placeholder="infofrance-az@capago.eu"
                  value={vacForm.email}
                  onChange={(e) => setVacForm({ ...vacForm, email: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Official Website</label>
                <input
                  className="vcms-input"
                  placeholder="https://www.capago.eu/"
                  value={vacForm.officialWebsite}
                  onChange={(e) => setVacForm({ ...vacForm, officialWebsite: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Appointment Booking URL</label>
                <input
                  className="vcms-input"
                  placeholder="https://fr-az.capago.eu/"
                  value={vacForm.appointmentBookingUrl}
                  onChange={(e) => setVacForm({ ...vacForm, appointmentBookingUrl: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Working Hours</label>
                <input
                  className="vcms-input"
                  value={vacForm.workingHours}
                  onChange={(e) => setVacForm({ ...vacForm, workingHours: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Status</label>
                <select
                  className="vcms-select"
                  value={vacForm.status}
                  onChange={(e) => setVacForm({ ...vacForm, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <button type="submit" className="vcms-btn accent">
              Save Visa Application Centre Information
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          TAB 5: 8.2 EMBASSY
          ==================================================================== */}
      {activeTab === 'EMBASSY' && (
        <div className="vcms-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>{countryDetail.nameEn} — Embassy</h3>
              <span style={{ fontSize: '0.83rem', color: '#64748b' }}>
                Diplomatic authority information for {countryDetail.nameEn} in {embassyForm.city},{' '}
                {embassyForm.locationCountryName}.
              </span>
            </div>
            <span className={`vcms-badge ${String(embassyForm.status).toLowerCase()}`}>{embassyForm.status}</span>
          </div>

          <form onSubmit={handleSaveEmbassy}>
            <div className="vcms-form-grid">
              <div className="vcms-field">
                <label>Responsible Authority (Embassy Name) *</label>
                <input
                  className="vcms-input"
                  required
                  placeholder="Embassy of France in Baku"
                  value={embassyForm.responsibleAuthority}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, responsibleAuthority: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>City</label>
                <input
                  className="vcms-input"
                  value={embassyForm.city}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, city: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Applicant Location Country (ISO)</label>
                <input
                  className="vcms-input"
                  value={embassyForm.locationCountryCode}
                  onChange={(e) =>
                    setEmbassyForm({ ...embassyForm, locationCountryCode: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                <label>Address *</label>
                <input
                  className="vcms-input"
                  required
                  placeholder="9 Rasul Rza Street, Baku, Azerbaijan"
                  value={embassyForm.address}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, address: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Telephone</label>
                <input
                  className="vcms-input"
                  placeholder="+994 12 490 81 00"
                  value={embassyForm.telephone}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, telephone: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Email</label>
                <input
                  className="vcms-input"
                  placeholder="visas.bakou-amba@diplomatie.gouv.fr"
                  value={embassyForm.email}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, email: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Official Website</label>
                <input
                  className="vcms-input"
                  placeholder="https://az.ambafrance.org/"
                  value={embassyForm.officialWebsite}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, officialWebsite: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Visa Information URL</label>
                <input
                  className="vcms-input"
                  placeholder="https://france-visas.gouv.fr/"
                  value={embassyForm.visaInformationUrl}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, visaInformationUrl: e.target.value })}
                />
              </div>
              <div className="vcms-field">
                <label>Status</label>
                <select
                  className="vcms-select"
                  value={embassyForm.status}
                  onChange={(e) => setEmbassyForm({ ...embassyForm, status: e.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <button type="submit" className="vcms-btn accent">
              Save Embassy Information
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          TAB 6: LIVE INTERACTIVE PREVIEW, VERSION CONTROL & PUBLISH
          ==================================================================== */}
      {activeTab === 'PREVIEW_PUBLISH' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
          {/* Left: Live Interactive Customer Simulator */}
          <div className="vcms-card">
            <h3 style={{ marginTop: 0 }}>
              Live Interactive Customer Form Preview ({purposeWorkspace?.purpose?.nameEn || 'Select Purpose'})
            </h3>
            <p style={{ fontSize: '0.83rem', color: '#64748b' }}>
              Test how questions and required documents dynamically appear or hide when a customer selects options
              (e.g. Marital Status = Married → Spouse Name opens; Employment = Employed → Employer Name & Employment
              Letter required).
            </p>

            {purposeWorkspace ? (
              <div>
                {(purposeWorkspace.categories || []).map((cat: any) => (
                  <div
                    key={cat.id}
                    style={{
                      marginBottom: 16,
                      padding: 14,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                    }}
                  >
                    <h4 style={{ margin: '0 0 10px 0' }}>{cat.nameEn}</h4>
                    <div className="vcms-form-grid">
                      {(cat.questions || []).map((q: any) => {
                        const evalState = evaluateFrontendConditionSet(q, previewAnswers);
                        if (!evalState.isVisible) return null;
                        return (
                          <div key={q.configId} className="vcms-field">
                            <label>
                              <span className="vcms-badge code" style={{ marginRight: 6 }}>
                                {q.questionCode}
                              </span>
                              {q.titleEn} {evalState.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
                            </label>
                            {q.answerType === 'SINGLE_SELECT' || q.answerType === 'MULTIPLE_SELECT' ? (
                              <select
                                className="vcms-select"
                                value={previewAnswers[q.questionCode] || ''}
                                onChange={(e) =>
                                  setPreviewAnswers({ ...previewAnswers, [q.questionCode]: e.target.value })
                                }
                              >
                                <option value="">-- Select --</option>
                                {(q.options || []).map((o: any) => (
                                  <option key={o.optionCode} value={o.optionCode}>
                                    {o.labelEn} ({o.optionCode})
                                  </option>
                                ))}
                              </select>
                            ) : q.answerType === 'YES_NO' ? (
                              <select
                                className="vcms-select"
                                value={previewAnswers[q.questionCode] || ''}
                                onChange={(e) =>
                                  setPreviewAnswers({ ...previewAnswers, [q.questionCode]: e.target.value })
                                }
                              >
                                <option value="">-- Select --</option>
                                <option value="YES">Yes</option>
                                <option value="NO">No</option>
                              </select>
                            ) : (
                              <input
                                type={q.answerType === 'DATE' ? 'date' : q.answerType === 'NUMBER' ? 'number' : 'text'}
                                className="vcms-input"
                                placeholder={q.officialTextEn}
                                value={previewAnswers[q.questionCode] || ''}
                                onChange={(e) =>
                                  setPreviewAnswers({ ...previewAnswers, [q.questionCode]: e.target.value })
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ padding: 14, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Dynamic Required Documents Checklist</h4>
                  {(purposeWorkspace.documents || []).map((d: any) => {
                    const evalState = evaluateFrontendConditionSet(d, previewAnswers);
                    if (!evalState.isVisible) return null;
                    return (
                      <div
                        key={d.configId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: '0.84rem',
                        }}
                      >
                        <span>
                          <span className="vcms-badge code" style={{ marginRight: 6 }}>
                            {d.documentCode}
                          </span>
                          <strong>{d.nameEn}</strong>
                        </span>
                        <span className={`vcms-badge ${evalState.isRequired ? 'required' : 'inactive'}`}>
                          {evalState.isRequired ? 'Required' : 'Optional'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>Select a purpose to preview.</div>
            )}
          </div>

          {/* Right: Publish & Configuration Version History */}
          <div>
            <div className="vcms-card">
              <h3 style={{ marginTop: 0 }}>Publish Configuration (Step 8)</h3>
              <p style={{ fontSize: '0.83rem', color: '#64748b' }}>
                Publishing freezes an immutable snapshot (<code>ConfigurationVersion</code>) so existing customer
                applications remain protected even when future edits are made.
              </p>
              <div className="vcms-field" style={{ marginBottom: 12 }}>
                <label>Version Change Summary</label>
                <input
                  className="vcms-input"
                  placeholder="e.g. Added Business & Medical questions and Capago Baku details"
                  value={publishSummary}
                  onChange={(e) => setPublishSummary(e.target.value)}
                />
              </div>
              <button className="vcms-btn success" style={{ width: '100%' }} onClick={handlePublishCountry}>
                Publish {countryDetail.nameEn} Configuration Now
              </button>
            </div>

            <div className="vcms-card">
              <h3 style={{ marginTop: 0 }}>Version History & Rollback</h3>
              {(countryDetail.configurationVersions || []).length === 0 ? (
                <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No versions published yet.</div>
              ) : (
                (countryDetail.configurationVersions || []).map((ver: any) => (
                  <div
                    key={ver.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="vcms-badge code">v{ver.versionNumber}</span>
                        <span className={`vcms-badge ${String(ver.status).toLowerCase()}`}>{ver.status}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 3 }}>{ver.changeSummary}</div>
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                        {ver.publishedAt ? new Date(ver.publishedAt).toLocaleString() : ''}
                      </div>
                    </div>
                    {ver.status !== 'ACTIVE' && (
                      <button
                        className="vcms-btn sm secondary"
                        onClick={() => handleRollbackVersion(ver.id, ver.versionNumber)}
                      >
                        Rollback to v{ver.versionNumber}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODALS FOR VISA TYPE, PURPOSE, DUPLICATE, CATEGORY, QUESTION BUILDER,
          POOL PICKERS, DOCUMENT BUILDER & CSV IMPORT
          ==================================================================== */}

      {showVisaTypeModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowVisaTypeModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>{visaTypeForm.id ? 'Edit Visa Type' : '+ Add Visa Type'}</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowVisaTypeModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveVisaType}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Visa Type Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. Short Stay Visa (C)"
                    value={visaTypeForm.nameEn}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, nameEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Visa Type Name (AZ)</label>
                  <input
                    className="vcms-input"
                    placeholder="məs. Qısamüddətli Viza (C)"
                    value={visaTypeForm.nameAz}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, nameAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Code</label>
                  <input
                    className="vcms-input"
                    placeholder="SHORT_STAY_C"
                    value={visaTypeForm.code}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, code: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Stay Category</label>
                  <select
                    className="vcms-select"
                    value={visaTypeForm.stayCategory}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, stayCategory: e.target.value })}
                  >
                    <option value="SHORT">Short Stay (Up to 90 days)</option>
                    <option value="LONG">Long Stay / National (&gt; 90 days)</option>
                    <option value="TRANSIT">Airport Transit</option>
                    <option value="OTHER">Other Special Category</option>
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Default Consular Fee (€)</label>
                  <input
                    type="number"
                    className="vcms-input"
                    value={visaTypeForm.defaultFeeEur}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, defaultFeeEur: Number(e.target.value) })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Max Duration Label</label>
                  <input
                    className="vcms-input"
                    value={visaTypeForm.maxDurationLabel}
                    onChange={(e) => setVisaTypeForm({ ...visaTypeForm, maxDurationLabel: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowVisaTypeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Visa Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPurposeModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowPurposeModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>{purposeForm.id ? 'Edit Visa Purpose' : '+ Add Visa Purpose'}</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowPurposeModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSavePurpose}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Purpose Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. Business, Tourism, Study"
                    value={purposeForm.nameEn}
                    onChange={(e) => setPurposeForm({ ...purposeForm, nameEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Purpose Name (AZ)</label>
                  <input
                    className="vcms-input"
                    placeholder="məs. Biznes, Turizm, Təhsil"
                    value={purposeForm.nameAz}
                    onChange={(e) => setPurposeForm({ ...purposeForm, nameAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Code</label>
                  <input
                    className="vcms-input"
                    placeholder="BUSINESS"
                    value={purposeForm.code}
                    onChange={(e) => setPurposeForm({ ...purposeForm, code: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Consular Fee Override (€, optional)</label>
                  <input
                    type="number"
                    className="vcms-input"
                    placeholder="Leave empty to use Visa Type fee"
                    value={purposeForm.consularFeeOverride}
                    onChange={(e) => setPurposeForm({ ...purposeForm, consularFeeOverride: e.target.value })}
                  />
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <input
                    className="vcms-input"
                    value={purposeForm.descriptionEn}
                    onChange={(e) => setPurposeForm({ ...purposeForm, descriptionEn: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowPurposeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Purpose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDuplicatePurposeModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowDuplicatePurposeModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Duplicate Purpose (Deep Clone Questions, Conditions & Documents)</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowDuplicatePurposeModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleDuplicatePurpose}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>New Purpose Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    value={dupPurposeForm.nameEn}
                    onChange={(e) => setDupPurposeForm({ ...dupPurposeForm, nameEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>New Purpose Code *</label>
                  <input
                    className="vcms-input"
                    required
                    value={dupPurposeForm.code}
                    onChange={(e) => setDupPurposeForm({ ...dupPurposeForm, code: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="vcms-btn secondary"
                  onClick={() => setShowDuplicatePurposeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Clone Purpose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>+ Add Question Category</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowCategoryModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Category Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. 6. Business Host Details"
                    value={newCategoryNameEn}
                    onChange={(e) => setNewCategoryNameEn(e.target.value)}
                  />
                </div>
                <div className="vcms-field">
                  <label>Category Name (AZ)</label>
                  <input
                    className="vcms-input"
                    placeholder="məs. 6. Dəvət Edən Şirkət"
                    value={newCategoryNameAz}
                    onChange={(e) => setNewCategoryNameAz(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Builder Modal (13 Answer Types + Options + Conditional Logic + Validations) */}
      {showQuestionBuilder && (
        <div className="vcms-modal-backdrop" onClick={() => setShowQuestionBuilder(false)}>
          <div className="vcms-modal" style={{ maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>
                {editingQuestionConfig
                  ? `Edit Question (${editingQuestionConfig.questionCode}) — Isolated to ${countryDetail.nameEn}`
                  : '+ Question Builder (13 Answer Types + Conditional Logic)'}
              </h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowQuestionBuilder(false)}>
                ✕
              </button>
            </div>

            {editingQuestionConfig && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  marginBottom: 14,
                }}
              >
                <strong>Two-Layer Isolation Active:</strong> Changes saved here only affect{' '}
                <strong>
                  {countryDetail.nameEn} → {purposeWorkspace?.purpose?.nameEn}
                </strong>
                . Other countries using <code>{editingQuestionConfig.questionCode}</code> remain untouched.
              </div>
            )}

            <form onSubmit={handleSaveQuestionBuilder}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Category *</label>
                  <select
                    className="vcms-select"
                    required
                    value={qForm.categoryId}
                    onChange={(e) => setQForm({ ...qForm, categoryId: e.target.value })}
                  >
                    {(purposeWorkspace?.categories || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Answer Type (13 Supported Types) *</label>
                  <select
                    className="vcms-select"
                    value={qForm.answerType}
                    onChange={(e) => setQForm({ ...qForm, answerType: e.target.value })}
                  >
                    {QUESTION_ANSWER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} — ({t.example})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Official Application Form Sequence (#)</label>
                  <input
                    type="number"
                    className="vcms-input"
                    value={qForm.officialFormOrder}
                    onChange={(e) => setQForm({ ...qForm, officialFormOrder: Number(e.target.value) })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Short Question Title (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. Marital Status"
                    value={qForm.titleEn}
                    onChange={(e) => setQForm({ ...qForm, titleEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Short Question Title (AZ)</label>
                  <input
                    className="vcms-input"
                    placeholder="məs. Ailə Vəziyyəti"
                    value={qForm.titleAz}
                    onChange={(e) => setQForm({ ...qForm, titleAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Schengen 37-Point PDF Field Key (Optional)</label>
                  <input
                    className="vcms-input"
                    placeholder="e.g. firstName, lastName, passportNumber, maritalStatus"
                    value={qForm.schengenPdfFieldKey}
                    onChange={(e) => setQForm({ ...qForm, schengenPdfFieldKey: e.target.value })}
                  />
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Official Application Form Question Text (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="Exact wording as it appears on the official visa application form"
                    value={qForm.officialTextEn}
                    onChange={(e) => setQForm({ ...qForm, officialTextEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Help Text / Tooltip (Optional)</label>
                  <input
                    className="vcms-input"
                    placeholder="Shown under input for applicant guidance"
                    value={qForm.helpTextEn}
                    onChange={(e) => setQForm({ ...qForm, helpTextEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Settings</label>
                  <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={qForm.isRequired}
                        onChange={(e) => setQForm({ ...qForm, isRequired: e.target.checked })}
                      />
                      Required
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={qForm.isRepeatable}
                        onChange={(e) => setQForm({ ...qForm, isRepeatable: e.target.checked })}
                      />
                      Repeatable
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={qForm.isReusable}
                        onChange={(e) => setQForm({ ...qForm, isReusable: e.target.checked })}
                      />
                      Save to Reusable Pool
                    </label>
                  </div>
                </div>
              </div>

              {/* Options Manager for SINGLE_SELECT & MULTIPLE_SELECT */}
              {['SINGLE_SELECT', 'MULTIPLE_SELECT'].includes(qForm.answerType) && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong>Question Options (Each option gets a unique Option ID e.g. OPT_MARITAL_MARRIED)</strong>
                    <button
                      type="button"
                      className="vcms-btn sm secondary"
                      onClick={() =>
                        setQForm({
                          ...qForm,
                          options: [...qForm.options, { optionCode: '', labelEn: '', labelAz: '' }],
                        })
                      }
                    >
                      + Add Option
                    </button>
                  </div>
                  {qForm.options.map((opt: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="vcms-input"
                        style={{ flex: 1 }}
                        placeholder="Option Label (EN) e.g. Married"
                        value={opt.labelEn}
                        onChange={(e) => {
                          const next = [...qForm.options];
                          next[idx].labelEn = e.target.value;
                          setQForm({ ...qForm, options: next });
                        }}
                      />
                      <input
                        className="vcms-input"
                        style={{ flex: 1 }}
                        placeholder="Option Label (AZ) e.g. Evli"
                        value={opt.labelAz}
                        onChange={(e) => {
                          const next = [...qForm.options];
                          next[idx].labelAz = e.target.value;
                          setQForm({ ...qForm, options: next });
                        }}
                      />
                      <input
                        className="vcms-input"
                        style={{ width: 210 }}
                        placeholder="Auto Option ID (OPT_*)"
                        value={opt.optionCode}
                        onChange={(e) => {
                          const next = [...qForm.options];
                          next[idx].optionCode = e.target.value.toUpperCase();
                          setQForm({ ...qForm, options: next });
                        }}
                      />
                      <button
                        type="button"
                        className="vcms-btn sm danger"
                        onClick={() =>
                          setQForm({
                            ...qForm,
                            options: qForm.options.filter((_: any, i: number) => i !== idx),
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Conditional Logic Editor */}
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong>Conditional Logic (Show / Require this question based on another question’s answer)</strong>
                  <button
                    type="button"
                    className="vcms-btn sm secondary"
                    onClick={() =>
                      setQForm({
                        ...qForm,
                        conditions: [
                          ...qForm.conditions,
                          {
                            groupOperator: 'AND',
                            action: 'SHOW_AND_REQUIRE',
                            triggerQuestionCode: purposeWorkspace?.questions?.[0]?.questionCode || 'Q010',
                            comparator: 'EQUALS',
                            triggerValue: '',
                          },
                        ],
                      })
                    }
                  >
                    + Add Condition Rule
                  </button>
                </div>

                {qForm.conditions.map((cond: any, idx: number) => {
                  const triggerQ = (purposeWorkspace?.questions || []).find(
                    (pq: any) => pq.questionCode === cond.triggerQuestionCode
                  );
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <select
                        className="vcms-select"
                        value={cond.action}
                        onChange={(e) => {
                          const next = [...qForm.conditions];
                          next[idx].action = e.target.value;
                          setQForm({ ...qForm, conditions: next });
                        }}
                      >
                        <option value="SHOW_AND_REQUIRE">Show & Make Required IF</option>
                        <option value="SHOW">Show (Optional) IF</option>
                        <option value="HIDE">Hide IF</option>
                        <option value="REQUIRE">Make Required IF</option>
                      </select>

                      <select
                        className="vcms-select"
                        value={cond.triggerQuestionCode}
                        onChange={(e) => {
                          const next = [...qForm.conditions];
                          next[idx].triggerQuestionCode = e.target.value;
                          setQForm({ ...qForm, conditions: next });
                        }}
                      >
                        {(purposeWorkspace?.questions || []).map((pq: any) => (
                          <option key={pq.questionCode} value={pq.questionCode}>
                            {pq.questionCode} — {pq.titleEn}
                          </option>
                        ))}
                      </select>

                      <select
                        className="vcms-select"
                        value={cond.comparator}
                        onChange={(e) => {
                          const next = [...qForm.conditions];
                          next[idx].comparator = e.target.value;
                          setQForm({ ...qForm, conditions: next });
                        }}
                      >
                        <option value="EQUALS">EQUALS</option>
                        <option value="NOT_EQUALS">NOT EQUALS</option>
                        <option value="IN">IN</option>
                        <option value="IS_TRUE">IS YES / TRUE</option>
                        <option value="IS_FALSE">IS NO / FALSE</option>
                        <option value="IS_FILLED">IS FILLED</option>
                      </select>

                      {triggerQ?.options?.length > 0 ? (
                        <select
                          className="vcms-select"
                          value={cond.triggerValue}
                          onChange={(e) => {
                            const next = [...qForm.conditions];
                            next[idx].triggerValue = e.target.value;
                            setQForm({ ...qForm, conditions: next });
                          }}
                        >
                          <option value="">-- Select Option ID --</option>
                          {triggerQ.options.map((o: any) => (
                            <option key={o.optionCode} value={o.optionCode}>
                              {o.labelEn} ({o.optionCode})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="vcms-input"
                          placeholder="Expected value (e.g. OPT_MARITAL_MARRIED)"
                          value={cond.triggerValue}
                          onChange={(e) => {
                            const next = [...qForm.conditions];
                            next[idx].triggerValue = e.target.value;
                            setQForm({ ...qForm, conditions: next });
                          }}
                        />
                      )}

                      <button
                        type="button"
                        className="vcms-btn sm danger"
                        onClick={() =>
                          setQForm({
                            ...qForm,
                            conditions: qForm.conditions.filter((_: any, i: number) => i !== idx),
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowQuestionBuilder(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Question Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach from Central Question Pool Modal */}
      {showPoolQuestionsModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowPoolQuestionsModal(false)}>
          <div className="vcms-modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Select Reusable Questions from Central Question Pool</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowPoolQuestionsModal(false)}>
                ✕
              </button>
            </div>
            <div className="vcms-field" style={{ marginBottom: 12 }}>
              <label>Target Category in {purposeWorkspace?.purpose?.nameEn}</label>
              <select
                className="vcms-select"
                value={attachTargetCategoryId}
                onChange={(e) => setAttachTargetCategoryId(e.target.value)}
              >
                {(purposeWorkspace?.categories || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
              {poolQuestions.map((pq) => {
                const alreadyAttached = (purposeWorkspace?.questions || []).some(
                  (q: any) => q.globalQuestionId === pq.id
                );
                const checked = selectedPoolQIds.includes(pq.id);
                return (
                  <label
                    key={pq.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderBottom: '1px solid #f1f5f9',
                      opacity: alreadyAttached ? 0.55 : 1,
                      cursor: alreadyAttached ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        disabled={alreadyAttached}
                        checked={checked || alreadyAttached}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPoolQIds([...selectedPoolQIds, pq.id]);
                          else setSelectedPoolQIds(selectedPoolQIds.filter((id) => id !== pq.id));
                        }}
                      />
                      <span className="vcms-badge code">{pq.questionCode}</span>
                      <strong>{pq.titleEn}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{pq.officialTextEn}</span>
                    </div>
                    <span className="vcms-badge info">{pq.answerType}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="vcms-btn secondary" onClick={() => setShowPoolQuestionsModal(false)}>
                Cancel
              </button>
              <button className="vcms-btn accent" onClick={handleAttachPoolQuestions}>
                Attach Selected ({selectedPoolQIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Builder Modal */}
      {showDocBuilder && (
        <div className="vcms-modal-backdrop" onClick={() => setShowDocBuilder(false)}>
          <div className="vcms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>
                {editingDocConfig
                  ? `Edit Required Document (${editingDocConfig.documentCode})`
                  : '+ Add Required Document (Auto-generates DOC-xxx)'}
              </h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowDocBuilder(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDocumentBuilder}>
              <div className="vcms-form-grid">
                <div className="vcms-field">
                  <label>Document Name (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. Business Invitation Letter"
                    value={docForm.nameEn}
                    onChange={(e) => setDocForm({ ...docForm, nameEn: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Document Name (AZ)</label>
                  <input
                    className="vcms-input"
                    placeholder="məs. Rəsmi İşgüzar Dəvətnamə"
                    value={docForm.nameAz}
                    onChange={(e) => setDocForm({ ...docForm, nameAz: e.target.value })}
                  />
                </div>
                <div className="vcms-field">
                  <label>Document Category</label>
                  <select
                    className="vcms-select"
                    value={docForm.category}
                    onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                  >
                    {DOCUMENT_CATEGORY_TYPES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="vcms-field">
                  <label>Requirement Level</label>
                  <select
                    className="vcms-select"
                    value={String(docForm.isRequired)}
                    onChange={(e) => setDocForm({ ...docForm, isRequired: e.target.value === 'true' })}
                  >
                    <option value="true">Required (Mandatory)</option>
                    <option value="false">Optional</option>
                  </select>
                </div>
                <div className="vcms-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Document Description & Instructions (EN) *</label>
                  <input
                    className="vcms-input"
                    required
                    placeholder="e.g. Official invitation letter from the host company in France."
                    value={docForm.descriptionEn}
                    onChange={(e) => setDocForm({ ...docForm, descriptionEn: e.target.value })}
                  />
                </div>
              </div>

              {/* Conditional Document Rules */}
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>Conditional Document Requirement (Optional)</strong>
                  <button
                    type="button"
                    className="vcms-btn sm secondary"
                    onClick={() =>
                      setDocForm({
                        ...docForm,
                        conditions: [
                          ...docForm.conditions,
                          {
                            groupOperator: 'AND',
                            action: 'SHOW_AND_REQUIRE',
                            triggerQuestionCode: 'Q022',
                            comparator: 'EQUALS',
                            triggerValue: 'OPT_EMPLOYMENT_EMPLOYED',
                          },
                        ],
                      })
                    }
                  >
                    + Add Condition
                  </button>
                </div>
                {docForm.conditions.map((cond: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      className="vcms-input"
                      placeholder="Question Code (e.g. Q022)"
                      value={cond.triggerQuestionCode}
                      onChange={(e) => {
                        const next = [...docForm.conditions];
                        next[idx].triggerQuestionCode = e.target.value.toUpperCase();
                        setDocForm({ ...docForm, conditions: next });
                      }}
                    />
                    <input
                      className="vcms-input"
                      placeholder="Option Code (e.g. OPT_EMPLOYMENT_EMPLOYED)"
                      value={cond.triggerValue}
                      onChange={(e) => {
                        const next = [...docForm.conditions];
                        next[idx].triggerValue = e.target.value;
                        setDocForm({ ...docForm, conditions: next });
                      }}
                    />
                    <button
                      type="button"
                      className="vcms-btn sm danger"
                      onClick={() =>
                        setDocForm({
                          ...docForm,
                          conditions: docForm.conditions.filter((_: any, i: number) => i !== idx),
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="vcms-btn secondary" onClick={() => setShowDocBuilder(false)}>
                  Cancel
                </button>
                <button type="submit" className="vcms-btn accent">
                  Save Required Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach from Document Pool Modal */}
      {showPoolDocsModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowPoolDocsModal(false)}>
          <div className="vcms-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Select Reusable Documents from Central Document Pool</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowPoolDocsModal(false)}>
                ✕
              </button>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
              {poolDocs.map((pd) => {
                const alreadyAttached = (purposeWorkspace?.documents || []).some(
                  (d: any) => d.globalDocumentId === pd.id
                );
                const checked = selectedPoolDocIds.includes(pd.id);
                return (
                  <label
                    key={pd.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderBottom: '1px solid #f1f5f9',
                      opacity: alreadyAttached ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        disabled={alreadyAttached}
                        checked={checked || alreadyAttached}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPoolDocIds([...selectedPoolDocIds, pd.id]);
                          else setSelectedPoolDocIds(selectedPoolDocIds.filter((id) => id !== pd.id));
                        }}
                      />
                      <span className="vcms-badge code">{pd.documentCode}</span>
                      <strong>{pd.nameEn}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{pd.descriptionEn}</span>
                    </div>
                    <span className="vcms-badge info">{pd.category}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="vcms-btn secondary" onClick={() => setShowPoolDocsModal(false)}>
                Cancel
              </button>
              <button className="vcms-btn accent" onClick={handleAttachPoolDocs}>
                Attach Selected ({selectedPoolDocIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV / Excel Bulk Import Modal */}
      {showImportModal && (
        <div className="vcms-modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="vcms-modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="vcms-modal-header">
              <h2>Import Questions from CSV / Excel Rows</h2>
              <button className="vcms-btn sm secondary" onClick={() => setShowImportModal(false)}>
                ✕
              </button>
            </div>
            <div className="vcms-field" style={{ marginBottom: 12 }}>
              <label>Paste CSV Rows (Header: titleEn,officialTextEn,answerType,categoryName,isRequired,options)</label>
              <textarea
                className="vcms-textarea"
                rows={6}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
              />
            </div>
            {importDryRunResult && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 12,
                  fontSize: '0.84rem',
                }}
              >
                <strong>Dry-Run Validation Result:</strong> {importDryRunResult.validCount} valid /{' '}
                {importDryRunResult.invalidCount} invalid out of {importDryRunResult.totalRows} row(s).
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="vcms-btn secondary" onClick={() => handleRunImport(true)}>
                1. Validate (Dry-Run)
              </button>
              <button className="vcms-btn accent" onClick={() => handleRunImport(false)}>
                2. Confirm & Import Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
