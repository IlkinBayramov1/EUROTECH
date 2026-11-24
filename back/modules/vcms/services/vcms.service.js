const prisma = require('../../../config/db');
const cacheService = require('../../../services/cache.service');
const {
  slugifyToken,
  nextQuestionCode,
  nextDocumentCode,
  generateUniqueOptionCode,
} = require('./codeGenerator.service');
const {
  evaluateConditionSet,
  validateQuestionValue,
  detectCircularConditions,
} = require('./conditionalEvaluator.service');
const { STANDARD_CATEGORIES_FOR_PURPOSE } = require('../../../scripts/migrate-vcms-baseline');

function invalidateVcmsCaches(countryId = null) {
  try {
    cacheService.del('templates:countries:active');
    if (countryId) {
      cacheService.del(`templates:visa_categories:${countryId}`);
    }
  } catch (_) {}
}

async function recordVcmsAudit(actorId, action, details, db = prisma) {
  try {
    invalidateVcmsCaches(details?.countryId || null);
    await db.auditLog.create({
      data: {
        userId: actorId || null,
        action,
        details: details || {},
      },
    });
  } catch (_) {}
}

function resolveQuestionConfig(config) {
  const g = config.globalQuestion || {};
  const isOverriddenLocally = Boolean(
    config.customTitleEn ||
      config.customTitleAz ||
      config.customOfficialTextEn ||
      config.customOfficialTextAz ||
      config.customHelpTextEn ||
      config.customHelpTextAz ||
      config.customAnswerType ||
      config.optionsOverrideJson
  );

  const globalOptions = Array.isArray(g.options) ? g.options.filter((o) => o.isActive !== false) : [];
  const resolvedOptions = Array.isArray(config.optionsOverrideJson) && config.optionsOverrideJson.length > 0
    ? config.optionsOverrideJson
    : globalOptions;

  const resolvedValidations =
    Array.isArray(config.validations) && config.validations.length > 0
      ? config.validations
      : Array.isArray(g.validations)
        ? g.validations
        : [];

  return {
    id: config.id,
    configId: config.id,
    visaPurposeId: config.visaPurposeId,
    categoryId: config.categoryId,
    categoryNameEn: config.category?.nameEn || g.defaultCategoryName || 'General',
    categoryNameAz: config.category?.nameAz || config.category?.nameEn || 'Ümumi',
    globalQuestionId: config.globalQuestionId,
    questionCode: g.questionCode || 'Q000',
    titleEn: config.customTitleEn || g.titleEn || '',
    titleAz: config.customTitleAz || g.titleAz || config.customTitleEn || g.titleEn || '',
    titleRu: g.titleRu || config.customTitleEn || g.titleEn || '',
    officialTextEn: config.customOfficialTextEn || g.officialTextEn || g.titleEn || '',
    officialTextAz: config.customOfficialTextAz || g.officialTextAz || config.customOfficialTextEn || g.officialTextEn || '',
    officialTextRu: g.officialTextRu || config.customOfficialTextEn || g.officialTextEn || '',
    helpTextEn: config.customHelpTextEn ?? g.helpTextEn ?? null,
    helpTextAz: config.customHelpTextAz ?? g.helpTextAz ?? null,
    defaultValue: config.customDefaultValue ?? g.defaultValue ?? null,
    answerType: config.customAnswerType || g.answerType || 'TEXT',
    isRequired: Boolean(config.isRequired),
    isRepeatable: Boolean(config.isRepeatable || g.isRepeatable),
    repeaterSchemaJson: g.repeaterSchemaJson || null,
    officialFormOrder: config.officialFormOrder ?? 0,
    schengenPdfFieldKey: g.schengenPdfFieldKey || null,
    options: resolvedOptions,
    conditions: config.conditions || [],
    conditionalLogicJson: config.conditionalLogicJson || null,
    validations: resolvedValidations,
    validationOverride: config.validationOverride || null,
    isOverriddenLocally,
    isActive: config.isActive !== false,
    rawOverrides: {
      customTitleEn: config.customTitleEn,
      customTitleAz: config.customTitleAz,
      customOfficialTextEn: config.customOfficialTextEn,
      customOfficialTextAz: config.customOfficialTextAz,
      customHelpTextEn: config.customHelpTextEn,
      customHelpTextAz: config.customHelpTextAz,
      customDefaultValue: config.customDefaultValue,
      customAnswerType: config.customAnswerType,
    },
  };
}

function resolveDocumentConfig(config) {
  const g = config.globalDocument || {};
  const isOverriddenLocally = Boolean(
    config.customNameEn || config.customNameAz || config.customDescriptionEn || config.customDescriptionAz
  );

  return {
    id: config.id,
    configId: config.id,
    visaPurposeId: config.visaPurposeId,
    globalDocumentId: config.globalDocumentId,
    documentCode: g.documentCode || 'DOC-000',
    nameEn: config.customNameEn || g.nameEn || '',
    nameAz: config.customNameAz || g.nameAz || config.customNameEn || g.nameEn || '',
    nameRu: g.nameRu || config.customNameEn || g.nameEn || '',
    descriptionEn: config.customDescriptionEn || g.descriptionEn || '',
    descriptionAz: config.customDescriptionAz || g.descriptionAz || config.customDescriptionEn || g.descriptionEn || '',
    category: g.category || 'OTHER',
    documentCategory: g.documentCategory || null,
    isRequired: Boolean(config.isRequired),
    displayOrder: config.displayOrder ?? 0,
    allowedFormats: g.allowedFormats || 'pdf,jpg,jpeg,png',
    maxFileSizeMb: g.maxFileSizeMb || 15,
    legacyDocCode: g.legacyDocCode || g.documentCode || 'DOCUMENT',
    conditions: config.conditions || [],
    conditionalRulesJson: config.conditionalRulesJson || null,
    isOverriddenLocally,
    isActive: config.isActive !== false,
  };
}

function computeCountryChecklist(country) {
  const visaTypes = country.visaTypes || [];
  const allPurposes = visaTypes.flatMap((vt) => vt.purposes || []);
  const hasCountry = Boolean(country.id);
  const hasVisaTypes = visaTypes.length > 0;
  const hasPurposes = allPurposes.length > 0;
  const totalQuestions = allPurposes.reduce((sum, p) => sum + (p._count?.questionConfigs ?? (p.questionConfigs?.length || 0)), 0);
  const totalDocuments = allPurposes.reduce((sum, p) => sum + (p._count?.documentConfigs ?? (p.documentConfigs?.length || 0)), 0);
  const hasQuestions = totalQuestions > 0;
  const hasDocuments = totalDocuments > 0;
  const hasVac = (country.visaApplicationCentres?.length || 0) > 0;
  const hasEmbassy = (country.embassies?.length || 0) > 0;
  const isPublished = country.status === 'ACTIVE' && (country.configurationVersions?.length || 0) > 0;

  const steps = [
    { step: 1, key: 'COUNTRY', label: 'Add Country Profile', completed: hasCountry },
    { step: 2, key: 'VISA_TYPES', label: 'Create Visa Types', completed: hasVisaTypes },
    { step: 3, key: 'PURPOSES', label: 'Create Purposes', completed: hasPurposes },
    { step: 4, key: 'QUESTIONS', label: 'Configure Questions', completed: hasQuestions },
    { step: 5, key: 'DOCUMENTS', label: 'Configure Documents', completed: hasDocuments },
    { step: 6, key: 'VAC', label: 'Add Visa Application Centre', completed: hasVac },
    { step: 7, key: 'EMBASSY', label: 'Add Embassy', completed: hasEmbassy },
    { step: 8, key: 'PUBLISH', label: 'Review & Publish', completed: isPublished || country.status === 'ACTIVE' },
  ];
  const completedCount = steps.filter((s) => s.completed).length;
  const completenessPercent = Math.round((completedCount / steps.length) * 100);

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    completenessPercent,
    visaTypesCount: visaTypes.length,
    purposesCount: allPurposes.length,
    totalQuestionsCount: totalQuestions,
    totalDocumentsCount: totalDocuments,
    hasVac,
    hasEmbassy,
  };
}

// ============================================================================
// 1. DESTINATIONS, VISA TYPES & PURPOSES
// ============================================================================

async function listDestinations({ search, region, isSchengen, status } = {}) {
  const where = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (region && region !== 'ALL') {
    where.region = { contains: region };
  }
  if (isSchengen !== undefined && isSchengen !== '' && isSchengen !== 'ALL') {
    where.isSchengen = String(isSchengen) === 'true';
  }
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { code: { contains: q } },
      { nameEn: { contains: q } },
      { nameAz: { contains: q } },
      { nameRu: { contains: q } },
    ];
  }

  const countries = await prisma.country.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { nameEn: 'asc' }],
    include: {
      visaTypes: {
        orderBy: { displayOrder: 'asc' },
        include: {
          purposes: {
            orderBy: { displayOrder: 'asc' },
            include: {
              _count: {
                select: { questionConfigs: true, documentConfigs: true },
              },
            },
          },
        },
      },
      visaApplicationCentres: { where: { status: { not: 'INACTIVE' } } },
      embassies: { where: { status: { not: 'INACTIVE' } } },
      configurationVersions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { id: true, versionNumber: true, status: true, publishedAt: true, changeSummary: true },
      },
      _count: { select: { dossiers: true } },
    },
  });

  return countries.map((c) => {
    const checklist = computeCountryChecklist(c);
    return {
      ...c,
      ...checklist,
      latestVersion: c.configurationVersions[0] || null,
      dossiersCount: c._count?.dossiers || 0,
    };
  });
}

async function getCountryDetail(countryId) {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    include: {
      visaCategories: true,
      visaTypes: {
        orderBy: { displayOrder: 'asc' },
        include: {
          purposes: {
            orderBy: { displayOrder: 'asc' },
            include: {
              questionCategories: { orderBy: { displayOrder: 'asc' } },
              _count: {
                select: { questionConfigs: true, documentConfigs: true, dossiers: true },
              },
            },
          },
        },
      },
      visaApplicationCentres: { orderBy: { isPrimary: 'desc' } },
      embassies: { orderBy: { isPrimary: 'desc' } },
      applicationLocations: {
        include: {
          visaApplicationCentre: true,
          embassy: true,
        },
      },
      appointmentProviders: {
        include: {
          embassy: true,
          visaApplicationCentre: true,
          servedVisaTypes: { include: { visaType: true } },
          servedPurposes: { include: { visaPurpose: true } },
        },
      },
      configurationVersions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          changeSummary: true,
          publishedById: true,
          publishedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!country) {
    const err = new Error('Destination country not found');
    err.statusCode = 404;
    throw err;
  }

  const checklist = computeCountryChecklist(country);
  return {
    ...country,
    ...checklist,
    latestVersion: country.configurationVersions[0] || null,
  };
}

async function createCountry(payload, actorId) {
  const code = String(payload.code || '').trim().toUpperCase();
  if (!code || code.length < 2) {
    const err = new Error('Valid ISO country code (e.g. FR, DE, US) is required.');
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.country.findUnique({ where: { code } });
  if (existing) {
    const err = new Error(`Country with ISO code "${code}" already exists.`);
    err.statusCode = 409;
    throw err;
  }

  const status = payload.status || 'DRAFT';
  const country = await prisma.$transaction(async (tx) => {
    const created = await tx.country.create({
      data: {
        code,
        nameEn: String(payload.nameEn || '').trim(),
        nameAz: String(payload.nameAz || payload.nameEn || '').trim(),
        nameRu: String(payload.nameRu || payload.nameEn || '').trim(),
        flagUrl: payload.flagUrl || `https://flagcdn.com/w80/${code.toLowerCase()}.png`,
        flagEmoji: payload.flagEmoji || code,
        region: payload.region || 'Europe',
        isSchengen: payload.isSchengen !== undefined ? Boolean(payload.isSchengen) : true,
        status,
        isActive: status === 'ACTIVE',
        displayOrder: Number(payload.displayOrder || 20),
        processingDaysLabel: payload.processingDaysLabel || '15 business days',
      },
    });

    // Legacy bridge VisaCategory so existing endpoints never fail
    await tx.visaCategory.create({
      data: {
        countryId: created.id,
        code: 'SCHENGEN_TOURIST',
        nameEn: `${created.nameEn} Short Stay Visa`,
        nameAz: `${created.nameAz} Qısamüddətli Viza`,
        nameRu: `${created.nameRu} Виза`,
        baseFee: 80.0,
      },
    });

    return created;
  });

  await recordVcmsAudit(actorId, 'VCMS_COUNTRY_CREATED', { countryId: country.id, code: country.code });
  return getCountryDetail(country.id);
}

async function updateCountry(countryId, payload, actorId) {
  const existing = await prisma.country.findUnique({ where: { id: countryId } });
  if (!existing) {
    const err = new Error('Country not found');
    err.statusCode = 404;
    throw err;
  }

  const nextStatus = payload.status || existing.status;
  const updated = await prisma.country.update({
    where: { id: countryId },
    data: {
      code: payload.code ? String(payload.code).trim().toUpperCase() : existing.code,
      nameEn: payload.nameEn !== undefined ? String(payload.nameEn).trim() : existing.nameEn,
      nameAz: payload.nameAz !== undefined ? String(payload.nameAz).trim() : existing.nameAz,
      nameRu: payload.nameRu !== undefined ? String(payload.nameRu).trim() : existing.nameRu,
      flagUrl: payload.flagUrl !== undefined ? payload.flagUrl : existing.flagUrl,
      flagEmoji: payload.flagEmoji !== undefined ? payload.flagEmoji : existing.flagEmoji,
      region: payload.region !== undefined ? payload.region : existing.region,
      isSchengen: payload.isSchengen !== undefined ? Boolean(payload.isSchengen) : existing.isSchengen,
      status: nextStatus,
      isActive: nextStatus === 'ACTIVE',
      displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : existing.displayOrder,
      processingDaysLabel: payload.processingDaysLabel !== undefined ? payload.processingDaysLabel : existing.processingDaysLabel,
    },
  });

  await recordVcmsAudit(actorId, 'VCMS_COUNTRY_UPDATED', { countryId, status: updated.status });
  return getCountryDetail(countryId);
}

async function deleteOrDeactivateCountry(countryId, actorId) {
  const dossierCount = await prisma.dossier.count({ where: { countryId } });
  if (dossierCount > 0) {
    await prisma.country.update({
      where: { id: countryId },
      data: { status: 'INACTIVE', isActive: false },
    });
    await recordVcmsAudit(actorId, 'VCMS_COUNTRY_DEACTIVATED', { countryId, dossierCount });
    return { deactivated: true, deleted: false, message: 'Country has existing dossiers and was set to INACTIVE.' };
  }
  await prisma.country.delete({ where: { id: countryId } });
  await recordVcmsAudit(actorId, 'VCMS_COUNTRY_DELETED', { countryId });
  return { deactivated: false, deleted: true };
}

async function createVisaType(countryId, payload, actorId) {
  const code = slugifyToken(payload.code || payload.nameEn || 'VISA_TYPE');
  const created = await prisma.visaType.create({
    data: {
      countryId,
      code,
      nameEn: String(payload.nameEn || '').trim(),
      nameAz: String(payload.nameAz || payload.nameEn || '').trim(),
      nameRu: String(payload.nameRu || payload.nameEn || '').trim(),
      descriptionEn: payload.descriptionEn || null,
      descriptionAz: payload.descriptionAz || null,
      descriptionRu: payload.descriptionRu || null,
      stayCategory: payload.stayCategory || 'SHORT',
      maxDurationDays: payload.maxDurationDays ? Number(payload.maxDurationDays) : 90,
      maxDurationLabel: payload.maxDurationLabel || 'Up to 90 days in any 180-day period',
      defaultFeeEur: payload.defaultFeeEur !== undefined ? Number(payload.defaultFeeEur) : 80.0,
      status: payload.status || 'ACTIVE',
      displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : 1,
    },
  });
  await recordVcmsAudit(actorId, 'VCMS_VISA_TYPE_CREATED', { countryId, visaTypeId: created.id, code });
  return created;
}

async function updateVisaType(visaTypeId, payload, actorId) {
  const updated = await prisma.visaType.update({
    where: { id: visaTypeId },
    data: {
      ...(payload.code ? { code: slugifyToken(payload.code) } : {}),
      ...(payload.nameEn !== undefined ? { nameEn: String(payload.nameEn).trim() } : {}),
      ...(payload.nameAz !== undefined ? { nameAz: String(payload.nameAz).trim() } : {}),
      ...(payload.nameRu !== undefined ? { nameRu: String(payload.nameRu).trim() } : {}),
      ...(payload.descriptionEn !== undefined ? { descriptionEn: payload.descriptionEn } : {}),
      ...(payload.descriptionAz !== undefined ? { descriptionAz: payload.descriptionAz } : {}),
      ...(payload.stayCategory !== undefined ? { stayCategory: payload.stayCategory } : {}),
      ...(payload.maxDurationDays !== undefined ? { maxDurationDays: Number(payload.maxDurationDays) } : {}),
      ...(payload.maxDurationLabel !== undefined ? { maxDurationLabel: payload.maxDurationLabel } : {}),
      ...(payload.defaultFeeEur !== undefined ? { defaultFeeEur: Number(payload.defaultFeeEur) } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.displayOrder !== undefined ? { displayOrder: Number(payload.displayOrder) } : {}),
    },
  });
  await recordVcmsAudit(actorId, 'VCMS_VISA_TYPE_UPDATED', { visaTypeId });
  return updated;
}

async function deleteVisaType(visaTypeId, actorId) {
  const dossierCount = await prisma.dossier.count({ where: { visaTypeId } });
  if (dossierCount > 0) {
    const archived = await prisma.visaType.update({
      where: { id: visaTypeId },
      data: { status: 'INACTIVE' },
    });
    return { archived: true, visaType: archived };
  }
  await prisma.visaType.delete({ where: { id: visaTypeId } });
  await recordVcmsAudit(actorId, 'VCMS_VISA_TYPE_DELETED', { visaTypeId });
  return { deleted: true };
}

async function createVisaPurpose(visaTypeId, payload, actorId) {
  const visaType = await prisma.visaType.findUnique({ where: { id: visaTypeId } });
  if (!visaType) {
    const err = new Error('Visa Type not found');
    err.statusCode = 404;
    throw err;
  }

  const code = slugifyToken(payload.code || payload.nameEn || 'PURPOSE');

  return await prisma.$transaction(async (tx) => {
    // Ensure a legacy VisaCategory bridge exists
    let legacyCat = await tx.visaCategory.findFirst({
      where: { countryId: visaType.countryId },
    });
    if (!legacyCat) {
      legacyCat = await tx.visaCategory.create({
        data: {
          countryId: visaType.countryId,
          code: `${visaType.code}_${code}`,
          nameEn: `${visaType.nameEn} - ${payload.nameEn}`,
          nameAz: `${visaType.nameAz || visaType.nameEn} - ${payload.nameAz || payload.nameEn}`,
          nameRu: `${visaType.nameRu || visaType.nameEn} - ${payload.nameRu || payload.nameEn}`,
          baseFee: Number(payload.consularFeeOverride ?? visaType.defaultFeeEur ?? 80),
        },
      });
    }

    const purpose = await tx.visaPurpose.create({
      data: {
        visaTypeId,
        code,
        nameEn: String(payload.nameEn || '').trim(),
        nameAz: String(payload.nameAz || payload.nameEn || '').trim(),
        nameRu: String(payload.nameRu || payload.nameEn || '').trim(),
        descriptionEn: payload.descriptionEn || null,
        descriptionAz: payload.descriptionAz || null,
        descriptionRu: payload.descriptionRu || null,
        consularFeeOverride:
          payload.consularFeeOverride !== undefined && payload.consularFeeOverride !== '' && payload.consularFeeOverride !== null
            ? Number(payload.consularFeeOverride)
            : null,
        legacyVisaCategoryId: legacyCat.id,
        status: payload.status || 'ACTIVE',
        displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : 1,
      },
    });

    // Seed default 5 official form question categories so Admin can start adding questions immediately
    for (const catSpec of STANDARD_CATEGORIES_FOR_PURPOSE) {
      await tx.questionCategory.create({
        data: {
          visaPurposeId: purpose.id,
          code: catSpec.code,
          nameEn: catSpec.nameEn,
          nameAz: catSpec.nameAz,
          nameRu: catSpec.nameRu,
          displayOrder: catSpec.displayOrder,
          isActive: true,
        },
      });
    }

    await recordVcmsAudit(actorId, 'VCMS_PURPOSE_CREATED', { visaTypeId, purposeId: purpose.id, code }, tx);
    return purpose;
  });
}

async function updateVisaPurpose(purposeId, payload, actorId) {
  const updated = await prisma.visaPurpose.update({
    where: { id: purposeId },
    data: {
      ...(payload.code ? { code: slugifyToken(payload.code) } : {}),
      ...(payload.nameEn !== undefined ? { nameEn: String(payload.nameEn).trim() } : {}),
      ...(payload.nameAz !== undefined ? { nameAz: String(payload.nameAz).trim() } : {}),
      ...(payload.nameRu !== undefined ? { nameRu: String(payload.nameRu).trim() } : {}),
      ...(payload.descriptionEn !== undefined ? { descriptionEn: payload.descriptionEn } : {}),
      ...(payload.descriptionAz !== undefined ? { descriptionAz: payload.descriptionAz } : {}),
      ...(payload.consularFeeOverride !== undefined
        ? {
            consularFeeOverride:
              payload.consularFeeOverride === '' || payload.consularFeeOverride === null
                ? null
                : Number(payload.consularFeeOverride),
          }
        : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.displayOrder !== undefined ? { displayOrder: Number(payload.displayOrder) } : {}),
    },
  });
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_UPDATED', { purposeId });
  return updated;
}

async function deleteVisaPurpose(purposeId, actorId) {
  const dossierCount = await prisma.dossier.count({ where: { visaPurposeId: purposeId } });
  if (dossierCount > 0) {
    const archived = await prisma.visaPurpose.update({
      where: { id: purposeId },
      data: { status: 'INACTIVE' },
    });
    return { archived: true, purpose: archived };
  }
  await prisma.visaPurpose.delete({ where: { id: purposeId } });
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_DELETED', { purposeId });
  return { deleted: true };
}

async function duplicateVisaPurpose(sourcePurposeId, payload, actorId) {
  const source = await prisma.visaPurpose.findUnique({
    where: { id: sourcePurposeId },
    include: {
      visaType: true,
      questionCategories: { orderBy: { displayOrder: 'asc' } },
      questionConfigs: {
        include: { conditions: true, validations: true },
        orderBy: { officialFormOrder: 'asc' },
      },
      documentConfigs: {
        include: { conditions: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!source) {
    const err = new Error('Source purpose not found');
    err.statusCode = 404;
    throw err;
  }

  const targetVisaTypeId = payload.targetVisaTypeId || source.visaTypeId;
  const newNameEn = String(payload.nameEn || `${source.nameEn} (Copy)`).trim();
  const newCode = slugifyToken(payload.code || `${source.code}_COPY_${Date.now().toString().slice(-4)}`);

  return await prisma.$transaction(async (tx) => {
    const clonedPurpose = await tx.visaPurpose.create({
      data: {
        visaTypeId: targetVisaTypeId,
        code: newCode,
        nameEn: newNameEn,
        nameAz: String(payload.nameAz || `${source.nameAz || source.nameEn} (Kopya)`).trim(),
        nameRu: String(payload.nameRu || newNameEn).trim(),
        descriptionEn: payload.descriptionEn ?? source.descriptionEn,
        descriptionAz: payload.descriptionAz ?? source.descriptionAz,
        consularFeeOverride: source.consularFeeOverride,
        legacyVisaCategoryId: source.legacyVisaCategoryId,
        status: payload.status || 'DRAFT',
        displayOrder: source.displayOrder + 1,
      },
    });

    // Clone categories
    const categoryIdMap = new Map();
    for (const cat of source.questionCategories) {
      const newCat = await tx.questionCategory.create({
        data: {
          visaPurposeId: clonedPurpose.id,
          code: cat.code,
          nameEn: cat.nameEn,
          nameAz: cat.nameAz,
          nameRu: cat.nameRu,
          descriptionEn: cat.descriptionEn,
          displayOrder: cat.displayOrder,
          isActive: cat.isActive,
        },
      });
      categoryIdMap.set(cat.id, newCat.id);
    }

    // Fallback category if needed
    let fallbackCategoryId = Array.from(categoryIdMap.values())[0];
    if (!fallbackCategoryId) {
      const defCat = await tx.questionCategory.create({
        data: {
          visaPurposeId: clonedPurpose.id,
          code: 'GENERAL',
          nameEn: '1. General Questions',
          displayOrder: 1,
        },
      });
      fallbackCategoryId = defCat.id;
    }

    // Clone question configs + conditions + validations
    for (const qCfg of source.questionConfigs) {
      const newQCfg = await tx.purposeQuestionConfig.create({
        data: {
          visaPurposeId: clonedPurpose.id,
          categoryId: categoryIdMap.get(qCfg.categoryId) || fallbackCategoryId,
          globalQuestionId: qCfg.globalQuestionId,
          customTitleEn: qCfg.customTitleEn,
          customTitleAz: qCfg.customTitleAz,
          customOfficialTextEn: qCfg.customOfficialTextEn,
          customOfficialTextAz: qCfg.customOfficialTextAz,
          customHelpTextEn: qCfg.customHelpTextEn,
          customHelpTextAz: qCfg.customHelpTextAz,
          customDefaultValue: qCfg.customDefaultValue,
          customAnswerType: qCfg.customAnswerType,
          isRequired: qCfg.isRequired,
          isRepeatable: qCfg.isRepeatable,
          officialFormOrder: qCfg.officialFormOrder,
          validationOverride: qCfg.validationOverride,
          optionsOverrideJson: qCfg.optionsOverrideJson,
          conditionalLogicJson: qCfg.conditionalLogicJson,
          isActive: qCfg.isActive,
        },
      });

      for (const cond of qCfg.conditions || []) {
        await tx.questionCondition.create({
          data: {
            purposeQuestionConfigId: newQCfg.id,
            groupOperator: cond.groupOperator,
            action: cond.action,
            triggerQuestionCode: cond.triggerQuestionCode,
            comparator: cond.comparator,
            triggerValue: cond.triggerValue,
            displayOrder: cond.displayOrder,
          },
        });
      }

      for (const val of qCfg.validations || []) {
        await tx.questionValidation.create({
          data: {
            purposeQuestionConfigId: newQCfg.id,
            ruleType: val.ruleType,
            ruleValue: val.ruleValue,
            errorMessageEn: val.errorMessageEn,
            errorMessageAz: val.errorMessageAz,
            errorMessageRu: val.errorMessageRu,
          },
        });
      }
    }

    // Clone document configs + conditions
    for (const dCfg of source.documentConfigs) {
      const newDCfg = await tx.purposeDocumentConfig.create({
        data: {
          visaPurposeId: clonedPurpose.id,
          globalDocumentId: dCfg.globalDocumentId,
          customNameEn: dCfg.customNameEn,
          customNameAz: dCfg.customNameAz,
          customDescriptionEn: dCfg.customDescriptionEn,
          customDescriptionAz: dCfg.customDescriptionAz,
          isRequired: dCfg.isRequired,
          displayOrder: dCfg.displayOrder,
          conditionalRulesJson: dCfg.conditionalRulesJson,
          isActive: dCfg.isActive,
        },
      });

      for (const cond of dCfg.conditions || []) {
        await tx.documentCondition.create({
          data: {
            purposeDocumentConfigId: newDCfg.id,
            groupOperator: cond.groupOperator,
            action: cond.action,
            triggerQuestionCode: cond.triggerQuestionCode,
            comparator: cond.comparator,
            triggerValue: cond.triggerValue,
          },
        });
      }
    }

    await recordVcmsAudit(
      actorId,
      'VCMS_PURPOSE_DUPLICATED',
      { sourcePurposeId, newPurposeId: clonedPurpose.id, newCode },
      tx
    );
    return clonedPurpose;
  });
}

// ============================================================================
// 2. CENTRAL QUESTION POOL & PURPOSE QUESTION CONFIGS (2-LAYER ISOLATION)
// ============================================================================

async function listQuestionPool({ search, answerType, category, status } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (answerType && answerType !== 'ALL') where.answerType = answerType;
  if (category && category !== 'ALL') where.defaultCategoryName = { contains: category };
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { questionCode: { contains: q } },
      { titleEn: { contains: q } },
      { titleAz: { contains: q } },
      { officialTextEn: { contains: q } },
      { officialTextAz: { contains: q } },
    ];
  }

  const questions = await prisma.globalQuestion.findMany({
    where,
    orderBy: { questionCode: 'asc' },
    include: {
      options: { orderBy: { displayOrder: 'asc' } },
      validations: true,
      purposeConfigs: {
        include: {
          visaPurpose: {
            include: {
              visaType: {
                include: {
                  country: { select: { id: true, code: true, nameEn: true, flagEmoji: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return questions.map((q) => {
    const countryMap = new Map();
    for (const pc of q.purposeConfigs || []) {
      const c = pc.visaPurpose?.visaType?.country;
      if (c) {
        const entry = countryMap.get(c.code) || { ...c, purposesCount: 0 };
        entry.purposesCount += 1;
        countryMap.set(c.code, entry);
      }
    }
    return {
      ...q,
      usedInPurposesCount: q.purposeConfigs?.length || 0,
      usedInCountries: Array.from(countryMap.values()),
    };
  });
}

async function createGlobalQuestion(payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const questionCode = payload.questionCode
      ? String(payload.questionCode).trim().toUpperCase()
      : await nextQuestionCode(tx);

    const created = await tx.globalQuestion.create({
      data: {
        questionCode,
        titleEn: String(payload.titleEn || '').trim(),
        titleAz: String(payload.titleAz || payload.titleEn || '').trim(),
        titleRu: String(payload.titleRu || payload.titleEn || '').trim(),
        officialTextEn: String(payload.officialTextEn || payload.titleEn || '').trim(),
        officialTextAz: String(payload.officialTextAz || payload.officialTextEn || payload.titleEn || '').trim(),
        officialTextRu: String(payload.officialTextRu || payload.officialTextEn || payload.titleEn || '').trim(),
        defaultCategoryName: payload.defaultCategoryName || 'General Information',
        answerType: payload.answerType || 'TEXT',
        defaultRequired: payload.defaultRequired !== undefined ? Boolean(payload.defaultRequired) : true,
        isReusable: payload.isReusable !== undefined ? Boolean(payload.isReusable) : true,
        isRepeatable: Boolean(payload.isRepeatable),
        helpTextEn: payload.helpTextEn || null,
        helpTextAz: payload.helpTextAz || null,
        defaultValue: payload.defaultValue || null,
        validationJson: payload.validationJson || null,
        repeaterSchemaJson: payload.repeaterSchemaJson || null,
        schengenPdfFieldKey: payload.schengenPdfFieldKey || null,
        status: payload.status || 'ACTIVE',
      },
    });

    const localCodes = new Set();
    if (Array.isArray(payload.options) && payload.options.length > 0) {
      for (let i = 0; i < payload.options.length; i++) {
        const opt = payload.options[i];
        const labelEn = String(opt.labelEn || opt.label || '').trim();
        if (!labelEn) continue;
        const optionCode = opt.optionCode
          ? String(opt.optionCode).trim().toUpperCase()
          : await generateUniqueOptionCode(payload.titleEn || questionCode, labelEn, tx, localCodes);
        localCodes.add(optionCode);

        await tx.globalQuestionOption.create({
          data: {
            globalQuestionId: created.id,
            optionCode,
            labelEn,
            labelAz: String(opt.labelAz || labelEn).trim(),
            labelRu: String(opt.labelRu || labelEn).trim(),
            displayOrder: opt.displayOrder ?? i + 1,
            isActive: opt.isActive !== false,
          },
        });
      }
    }

    if (Array.isArray(payload.validations) && payload.validations.length > 0) {
      for (const v of payload.validations) {
        if (!v.ruleType) continue;
        await tx.questionValidation.create({
          data: {
            globalQuestionId: created.id,
            ruleType: v.ruleType,
            ruleValue: String(v.ruleValue ?? ''),
            errorMessageEn: v.errorMessageEn || null,
            errorMessageAz: v.errorMessageAz || null,
          },
        });
      }
    }

    await recordVcmsAudit(actorId, 'VCMS_GLOBAL_QUESTION_CREATED', { questionId: created.id, questionCode }, tx);
    return tx.globalQuestion.findUnique({
      where: { id: created.id },
      include: { options: { orderBy: { displayOrder: 'asc' } }, validations: true },
    });
  });
}

async function updateGlobalQuestion(questionId, payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.globalQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!existing) {
      const err = new Error('Global Question not found');
      err.statusCode = 404;
      throw err;
    }

    await tx.globalQuestion.update({
      where: { id: questionId },
      data: {
        ...(payload.titleEn !== undefined ? { titleEn: String(payload.titleEn).trim() } : {}),
        ...(payload.titleAz !== undefined ? { titleAz: String(payload.titleAz).trim() } : {}),
        ...(payload.titleRu !== undefined ? { titleRu: String(payload.titleRu).trim() } : {}),
        ...(payload.officialTextEn !== undefined ? { officialTextEn: String(payload.officialTextEn).trim() } : {}),
        ...(payload.officialTextAz !== undefined ? { officialTextAz: String(payload.officialTextAz).trim() } : {}),
        ...(payload.officialTextRu !== undefined ? { officialTextRu: String(payload.officialTextRu).trim() } : {}),
        ...(payload.defaultCategoryName !== undefined ? { defaultCategoryName: payload.defaultCategoryName } : {}),
        ...(payload.answerType !== undefined ? { answerType: payload.answerType } : {}),
        ...(payload.defaultRequired !== undefined ? { defaultRequired: Boolean(payload.defaultRequired) } : {}),
        ...(payload.isReusable !== undefined ? { isReusable: Boolean(payload.isReusable) } : {}),
        ...(payload.isRepeatable !== undefined ? { isRepeatable: Boolean(payload.isRepeatable) } : {}),
        ...(payload.helpTextEn !== undefined ? { helpTextEn: payload.helpTextEn } : {}),
        ...(payload.helpTextAz !== undefined ? { helpTextAz: payload.helpTextAz } : {}),
        ...(payload.defaultValue !== undefined ? { defaultValue: payload.defaultValue } : {}),
        ...(payload.repeaterSchemaJson !== undefined ? { repeaterSchemaJson: payload.repeaterSchemaJson } : {}),
        ...(payload.schengenPdfFieldKey !== undefined ? { schengenPdfFieldKey: payload.schengenPdfFieldKey } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      },
    });

    if (Array.isArray(payload.options)) {
      const localCodes = new Set();
      for (let i = 0; i < payload.options.length; i++) {
        const opt = payload.options[i];
        const labelEn = String(opt.labelEn || opt.label || '').trim();
        if (!labelEn) continue;
        if (opt.id) {
          await tx.globalQuestionOption.update({
            where: { id: opt.id },
            data: {
              labelEn,
              labelAz: String(opt.labelAz || labelEn).trim(),
              labelRu: String(opt.labelRu || labelEn).trim(),
              displayOrder: opt.displayOrder ?? i + 1,
              isActive: opt.isActive !== false,
            },
          });
        } else if (opt.optionCode) {
          await tx.globalQuestionOption.upsert({
            where: { optionCode: opt.optionCode },
            update: {
              labelEn,
              labelAz: String(opt.labelAz || labelEn).trim(),
              displayOrder: opt.displayOrder ?? i + 1,
              isActive: opt.isActive !== false,
            },
            create: {
              globalQuestionId: questionId,
              optionCode: opt.optionCode,
              labelEn,
              labelAz: String(opt.labelAz || labelEn).trim(),
              displayOrder: opt.displayOrder ?? i + 1,
              isActive: opt.isActive !== false,
            },
          });
        } else {
          const optionCode = await generateUniqueOptionCode(existing.titleEn, labelEn, tx, localCodes);
          await tx.globalQuestionOption.create({
            data: {
              globalQuestionId: questionId,
              optionCode,
              labelEn,
              labelAz: String(opt.labelAz || labelEn).trim(),
              displayOrder: opt.displayOrder ?? i + 1,
              isActive: true,
            },
          });
        }
      }
    }

    await recordVcmsAudit(actorId, 'VCMS_GLOBAL_QUESTION_UPDATED', { questionId, questionCode: existing.questionCode }, tx);
    return tx.globalQuestion.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { displayOrder: 'asc' } }, validations: true },
    });
  });
}

async function duplicateGlobalQuestion(questionId, actorId) {
  const source = await prisma.globalQuestion.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { displayOrder: 'asc' } }, validations: true },
  });
  if (!source) {
    const err = new Error('Source question not found');
    err.statusCode = 404;
    throw err;
  }

  return createGlobalQuestion(
    {
      titleEn: `${source.titleEn} (Copy)`,
      titleAz: `${source.titleAz || source.titleEn} (Kopya)`,
      officialTextEn: source.officialTextEn,
      officialTextAz: source.officialTextAz,
      defaultCategoryName: source.defaultCategoryName,
      answerType: source.answerType,
      defaultRequired: source.defaultRequired,
      isReusable: source.isReusable,
      isRepeatable: source.isRepeatable,
      helpTextEn: source.helpTextEn,
      helpTextAz: source.helpTextAz,
      defaultValue: source.defaultValue,
      repeaterSchemaJson: source.repeaterSchemaJson,
      options: (source.options || []).map((o) => ({
        labelEn: o.labelEn,
        labelAz: o.labelAz,
        labelRu: o.labelRu,
        displayOrder: o.displayOrder,
      })),
      validations: (source.validations || []).map((v) => ({
        ruleType: v.ruleType,
        ruleValue: v.ruleValue,
        errorMessageEn: v.errorMessageEn,
        errorMessageAz: v.errorMessageAz,
      })),
    },
    actorId
  );
}

async function getPurposeWorkspace(purposeId) {
  const purpose = await prisma.visaPurpose.findUnique({
    where: { id: purposeId },
    include: {
      visaType: {
        include: {
          country: true,
        },
      },
      questionCategories: {
        orderBy: { displayOrder: 'asc' },
      },
      questionConfigs: {
        orderBy: { officialFormOrder: 'asc' },
        include: {
          category: true,
          globalQuestion: {
            include: {
              options: { orderBy: { displayOrder: 'asc' } },
              validations: true,
            },
          },
          conditions: { orderBy: { displayOrder: 'asc' } },
          validations: true,
        },
      },
      documentConfigs: {
        orderBy: { displayOrder: 'asc' },
        include: {
          globalDocument: {
            include: { documentCategory: true },
          },
          conditions: true,
        },
      },
    },
  });

  if (!purpose) {
    const err = new Error('Visa Purpose not found');
    err.statusCode = 404;
    throw err;
  }

  const resolvedQuestions = purpose.questionConfigs.map(resolveQuestionConfig);
  const resolvedDocuments = purpose.documentConfigs.map(resolveDocumentConfig);

  const categoriesWithQuestions = purpose.questionCategories.map((cat) => ({
    ...cat,
    questions: resolvedQuestions
      .filter((q) => q.categoryId === cat.id)
      .sort((a, b) => a.officialFormOrder - b.officialFormOrder),
  }));

  return {
    purpose: {
      id: purpose.id,
      code: purpose.code,
      nameEn: purpose.nameEn,
      nameAz: purpose.nameAz,
      nameRu: purpose.nameRu,
      descriptionEn: purpose.descriptionEn,
      consularFeeOverride: purpose.consularFeeOverride,
      status: purpose.status,
      visaType: purpose.visaType,
      country: purpose.visaType.country,
    },
    categories: categoriesWithQuestions,
    questions: resolvedQuestions,
    documents: resolvedDocuments,
  };
}

async function createQuestionCategory(purposeId, payload) {
  const count = await prisma.questionCategory.count({ where: { visaPurposeId: purposeId } });
  const code = slugifyToken(payload.code || payload.nameEn || `CAT_${count + 1}`);
  return prisma.questionCategory.create({
    data: {
      visaPurposeId: purposeId,
      code,
      nameEn: String(payload.nameEn || '').trim(),
      nameAz: String(payload.nameAz || payload.nameEn || '').trim(),
      nameRu: String(payload.nameRu || payload.nameEn || '').trim(),
      descriptionEn: payload.descriptionEn || null,
      displayOrder: payload.displayOrder !== undefined ? Number(payload.displayOrder) : count + 1,
      isActive: true,
    },
  });
}

async function reorderQuestionCategories(purposeId, items = []) {
  return prisma.$transaction(
    items.map((item, idx) =>
      prisma.questionCategory.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder !== undefined ? Number(item.displayOrder) : idx + 1 },
      })
    )
  );
}

async function attachQuestionsFromPool(purposeId, { categoryId, globalQuestionIds = [], isRequired }, actorId) {
  let targetCategoryId = categoryId;
  if (!targetCategoryId) {
    let firstCat = await prisma.questionCategory.findFirst({
      where: { visaPurposeId: purposeId },
      orderBy: { displayOrder: 'asc' },
    });
    if (!firstCat) {
      firstCat = await createQuestionCategory(purposeId, { nameEn: '1. General Questions', code: 'GENERAL' });
    }
    targetCategoryId = firstCat.id;
  }

  const maxOrderAgg = await prisma.purposeQuestionConfig.aggregate({
    where: { visaPurposeId: purposeId },
    _max: { officialFormOrder: true },
  });
  let nextOrder = (maxOrderAgg._max.officialFormOrder || 0) + 1;

  const attached = [];
  for (const gqId of globalQuestionIds) {
    const gq = await prisma.globalQuestion.findUnique({ where: { id: gqId } });
    if (!gq) continue;

    const existing = await prisma.purposeQuestionConfig.findUnique({
      where: { visaPurposeId_globalQuestionId: { visaPurposeId: purposeId, globalQuestionId: gqId } },
    });
    if (existing) {
      attached.push(existing);
      continue;
    }

    const created = await prisma.purposeQuestionConfig.create({
      data: {
        visaPurposeId: purposeId,
        categoryId: targetCategoryId,
        globalQuestionId: gqId,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : gq.defaultRequired,
        isRepeatable: gq.isRepeatable,
        officialFormOrder: nextOrder++,
        isActive: true,
      },
    });
    attached.push(created);
  }

  await recordVcmsAudit(actorId, 'VCMS_QUESTIONS_ATTACHED_FROM_POOL', { purposeId, count: attached.length });
  return getPurposeWorkspace(purposeId);
}

async function createAndAttachQuestion(purposeId, payload, actorId) {
  const globalQ = await createGlobalQuestion(payload, actorId);
  await attachQuestionsFromPool(
    purposeId,
    {
      categoryId: payload.categoryId,
      globalQuestionIds: [globalQ.id],
      isRequired: payload.isRequired ?? payload.defaultRequired ?? true,
    },
    actorId
  );

  // If conditions or local overrides were provided at creation time, apply them to the PurposeQuestionConfig
  const config = await prisma.purposeQuestionConfig.findUnique({
    where: { visaPurposeId_globalQuestionId: { visaPurposeId: purposeId, globalQuestionId: globalQ.id } },
  });

  if (config && (Array.isArray(payload.conditions) || payload.officialFormOrder !== undefined)) {
    await updatePurposeQuestionConfig(
      config.id,
      {
        officialFormOrder: payload.officialFormOrder ?? config.officialFormOrder,
        conditions: payload.conditions,
        validations: payload.validations,
      },
      actorId
    );
  }

  return getPurposeWorkspace(purposeId);
}

/**
 * STRICT TWO-LAYER ISOLATION:
 * Updating a PurposeQuestionConfig modifies ONLY this purpose's local config
 * and NEVER alters GlobalQuestion or any other country!
 */
async function updatePurposeQuestionConfig(configId, payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purposeQuestionConfig.findUnique({
      where: { id: configId },
      include: { globalQuestion: true },
    });
    if (!existing) {
      const err = new Error('Purpose Question Configuration not found');
      err.statusCode = 404;
      throw err;
    }

    await tx.purposeQuestionConfig.update({
      where: { id: configId },
      data: {
        ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
        ...(payload.customTitleEn !== undefined ? { customTitleEn: payload.customTitleEn || null } : {}),
        ...(payload.customTitleAz !== undefined ? { customTitleAz: payload.customTitleAz || null } : {}),
        ...(payload.customOfficialTextEn !== undefined ? { customOfficialTextEn: payload.customOfficialTextEn || null } : {}),
        ...(payload.customOfficialTextAz !== undefined ? { customOfficialTextAz: payload.customOfficialTextAz || null } : {}),
        ...(payload.customHelpTextEn !== undefined ? { customHelpTextEn: payload.customHelpTextEn || null } : {}),
        ...(payload.customHelpTextAz !== undefined ? { customHelpTextAz: payload.customHelpTextAz || null } : {}),
        ...(payload.customDefaultValue !== undefined ? { customDefaultValue: payload.customDefaultValue || null } : {}),
        ...(payload.customAnswerType !== undefined ? { customAnswerType: payload.customAnswerType || null } : {}),
        ...(payload.isRequired !== undefined ? { isRequired: Boolean(payload.isRequired) } : {}),
        ...(payload.isRepeatable !== undefined ? { isRepeatable: Boolean(payload.isRepeatable) } : {}),
        ...(payload.officialFormOrder !== undefined ? { officialFormOrder: Number(payload.officialFormOrder) } : {}),
        ...(payload.optionsOverrideJson !== undefined ? { optionsOverrideJson: payload.optionsOverrideJson } : {}),
        ...(payload.validationOverride !== undefined ? { validationOverride: payload.validationOverride } : {}),
        ...(payload.conditionalLogicJson !== undefined ? { conditionalLogicJson: payload.conditionalLogicJson } : {}),
        ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
      },
    });

    if (Array.isArray(payload.conditions)) {
      await tx.questionCondition.deleteMany({ where: { purposeQuestionConfigId: configId } });
      for (let i = 0; i < payload.conditions.length; i++) {
        const c = payload.conditions[i];
        const triggerCode = c.triggerQuestionCode || c.questionCode;
        if (!triggerCode) continue;
        if (triggerCode === existing.globalQuestion.questionCode) {
          const err = new Error('A question cannot depend on itself in Conditional Logic.');
          err.statusCode = 400;
          throw err;
        }
        await tx.questionCondition.create({
          data: {
            purposeQuestionConfigId: configId,
            groupOperator: c.groupOperator || payload.conditionOperator || 'AND',
            action: c.action || payload.conditionAction || 'SHOW_AND_REQUIRE',
            triggerQuestionCode: triggerCode,
            comparator: c.comparator || 'EQUALS',
            triggerValue: c.triggerValue !== undefined ? String(c.triggerValue) : c.value !== undefined ? String(c.value) : null,
            displayOrder: i + 1,
          },
        });
      }

      // Check circular dependency across all questions in this purpose
      const allPurposeConfigs = await tx.purposeQuestionConfig.findMany({
        where: { visaPurposeId: existing.visaPurposeId },
        include: { globalQuestion: true, conditions: true },
      });
      const graphNodes = allPurposeConfigs.map((cfg) => ({
        questionCode: cfg.globalQuestion?.questionCode,
        conditions: cfg.conditions,
      }));
      if (detectCircularConditions(graphNodes)) {
        const err = new Error('Circular dependency detected in Conditional Logic rules.');
        err.statusCode = 400;
        throw err;
      }

      // Sync JSON representation
      await tx.purposeQuestionConfig.update({
        where: { id: configId },
        data: {
          conditionalLogicJson:
            payload.conditions.length > 0
              ? {
                  operator: payload.conditions[0].groupOperator || 'AND',
                  action: payload.conditions[0].action || 'SHOW_AND_REQUIRE',
                  rules: payload.conditions.map((c) => ({
                    questionCode: c.triggerQuestionCode || c.questionCode,
                    comparator: c.comparator || 'EQUALS',
                    value: c.triggerValue ?? c.value ?? null,
                  })),
                }
              : null,
        },
      });
    }

    if (Array.isArray(payload.validations)) {
      await tx.questionValidation.deleteMany({ where: { purposeQuestionConfigId: configId } });
      for (const v of payload.validations) {
        if (!v.ruleType) continue;
        await tx.questionValidation.create({
          data: {
            purposeQuestionConfigId: configId,
            ruleType: v.ruleType,
            ruleValue: String(v.ruleValue ?? ''),
            errorMessageEn: v.errorMessageEn || null,
            errorMessageAz: v.errorMessageAz || null,
          },
        });
      }
    }

    await recordVcmsAudit(actorId, 'VCMS_PURPOSE_QUESTION_OVERRIDDEN', { configId, purposeId: existing.visaPurposeId }, tx);
    const updated = await tx.purposeQuestionConfig.findUnique({
      where: { id: configId },
      include: {
        category: true,
        globalQuestion: { include: { options: { orderBy: { displayOrder: 'asc' } }, validations: true } },
        conditions: { orderBy: { displayOrder: 'asc' } },
        validations: true,
      },
    });
    return resolveQuestionConfig(updated);
  });
}

async function reorderPurposeQuestions(purposeId, items = [], actorId) {
  await prisma.$transaction(
    items.map((item, idx) =>
      prisma.purposeQuestionConfig.update({
        where: { id: item.id },
        data: {
          ...(item.categoryId ? { categoryId: item.categoryId } : {}),
          officialFormOrder: item.officialFormOrder !== undefined ? Number(item.officialFormOrder) : idx + 1,
        },
      })
    )
  );
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_QUESTIONS_REORDERED', { purposeId, count: items.length });
  return getPurposeWorkspace(purposeId);
}

async function detachPurposeQuestion(configId, actorId) {
  const existing = await prisma.purposeQuestionConfig.findUnique({ where: { id: configId } });
  if (!existing) {
    const err = new Error('Purpose question config not found');
    err.statusCode = 404;
    throw err;
  }
  await prisma.purposeQuestionConfig.delete({ where: { id: configId } });
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_QUESTION_DETACHED', { configId, purposeId: existing.visaPurposeId });
  return { detached: true, purposeId: existing.visaPurposeId };
}

// ============================================================================
// 3. CENTRAL DOCUMENT POOL & PURPOSE DOCUMENT CONFIGS
// ============================================================================

async function listDocumentCategories() {
  return prisma.documentCategory.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { documents: true } } },
  });
}

async function listDocumentPool({ search, category, status } = {}) {
  const where = {};
  if (status && status !== 'ALL') where.status = status;
  if (category && category !== 'ALL') where.category = category;
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { documentCode: { contains: q } },
      { nameEn: { contains: q } },
      { nameAz: { contains: q } },
      { descriptionEn: { contains: q } },
      { descriptionAz: { contains: q } },
    ];
  }

  const docs = await prisma.globalDocument.findMany({
    where,
    orderBy: { documentCode: 'asc' },
    include: {
      documentCategory: true,
      purposeConfigs: {
        include: {
          visaPurpose: {
            include: {
              visaType: {
                include: {
                  country: { select: { id: true, code: true, nameEn: true, flagEmoji: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return docs.map((d) => {
    const countryMap = new Map();
    for (const pc of d.purposeConfigs || []) {
      const c = pc.visaPurpose?.visaType?.country;
      if (c) {
        const entry = countryMap.get(c.code) || { ...c, purposesCount: 0 };
        entry.purposesCount += 1;
        countryMap.set(c.code, entry);
      }
    }
    return {
      ...d,
      usedInPurposesCount: d.purposeConfigs?.length || 0,
      usedInCountries: Array.from(countryMap.values()),
    };
  });
}

async function createGlobalDocument(payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const documentCode = payload.documentCode
      ? String(payload.documentCode).trim().toUpperCase()
      : await nextDocumentCode(tx);

    const catCode = payload.category || 'OTHER';
    const docCat = await tx.documentCategory.findUnique({ where: { code: catCode } });

    const created = await tx.globalDocument.create({
      data: {
        documentCode,
        nameEn: String(payload.nameEn || '').trim(),
        nameAz: String(payload.nameAz || payload.nameEn || '').trim(),
        nameRu: String(payload.nameRu || payload.nameEn || '').trim(),
        descriptionEn: payload.descriptionEn || null,
        descriptionAz: payload.descriptionAz || payload.descriptionEn || null,
        descriptionRu: payload.descriptionRu || payload.descriptionEn || null,
        category: catCode,
        documentCategoryId: docCat?.id || null,
        defaultRequired: payload.defaultRequired !== undefined ? Boolean(payload.defaultRequired) : true,
        isReusable: payload.isReusable !== undefined ? Boolean(payload.isReusable) : true,
        allowedFormats: payload.allowedFormats || 'pdf,jpg,jpeg,png',
        maxFileSizeMb: payload.maxFileSizeMb ? Number(payload.maxFileSizeMb) : 15,
        legacyDocCode: payload.legacyDocCode || documentCode,
        status: payload.status || 'ACTIVE',
      },
      include: { documentCategory: true },
    });

    await recordVcmsAudit(actorId, 'VCMS_GLOBAL_DOCUMENT_CREATED', { documentId: created.id, documentCode }, tx);
    return created;
  });
}

async function updateGlobalDocument(documentId, payload, actorId) {
  const catCode = payload.category;
  let docCatId = undefined;
  if (catCode) {
    const dc = await prisma.documentCategory.findUnique({ where: { code: catCode } });
    docCatId = dc?.id || null;
  }

  const updated = await prisma.globalDocument.update({
    where: { id: documentId },
    data: {
      ...(payload.nameEn !== undefined ? { nameEn: String(payload.nameEn).trim() } : {}),
      ...(payload.nameAz !== undefined ? { nameAz: String(payload.nameAz).trim() } : {}),
      ...(payload.nameRu !== undefined ? { nameRu: String(payload.nameRu).trim() } : {}),
      ...(payload.descriptionEn !== undefined ? { descriptionEn: payload.descriptionEn } : {}),
      ...(payload.descriptionAz !== undefined ? { descriptionAz: payload.descriptionAz } : {}),
      ...(payload.category !== undefined ? { category: payload.category, documentCategoryId: docCatId } : {}),
      ...(payload.defaultRequired !== undefined ? { defaultRequired: Boolean(payload.defaultRequired) } : {}),
      ...(payload.allowedFormats !== undefined ? { allowedFormats: payload.allowedFormats } : {}),
      ...(payload.maxFileSizeMb !== undefined ? { maxFileSizeMb: Number(payload.maxFileSizeMb) } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
    },
    include: { documentCategory: true },
  });

  await recordVcmsAudit(actorId, 'VCMS_GLOBAL_DOCUMENT_UPDATED', { documentId });
  return updated;
}

async function attachDocumentsFromPool(purposeId, { globalDocumentIds = [], isRequired }, actorId) {
  const maxOrderAgg = await prisma.purposeDocumentConfig.aggregate({
    where: { visaPurposeId: purposeId },
    _max: { displayOrder: true },
  });
  let nextOrder = (maxOrderAgg._max.displayOrder || 0) + 1;

  for (const docId of globalDocumentIds) {
    const gDoc = await prisma.globalDocument.findUnique({ where: { id: docId } });
    if (!gDoc) continue;

    const existing = await prisma.purposeDocumentConfig.findUnique({
      where: { visaPurposeId_globalDocumentId: { visaPurposeId: purposeId, globalDocumentId: docId } },
    });
    if (existing) continue;

    await prisma.purposeDocumentConfig.create({
      data: {
        visaPurposeId: purposeId,
        globalDocumentId: docId,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : gDoc.defaultRequired,
        displayOrder: nextOrder++,
        isActive: true,
      },
    });
  }

  await recordVcmsAudit(actorId, 'VCMS_DOCUMENTS_ATTACHED_FROM_POOL', { purposeId, count: globalDocumentIds.length });
  return getPurposeWorkspace(purposeId);
}

async function createAndAttachDocument(purposeId, payload, actorId) {
  const globalDoc = await createGlobalDocument(payload, actorId);
  await attachDocumentsFromPool(
    purposeId,
    {
      globalDocumentIds: [globalDoc.id],
      isRequired: payload.isRequired ?? payload.defaultRequired ?? true,
    },
    actorId
  );

  if (Array.isArray(payload.conditions) && payload.conditions.length > 0) {
    const cfg = await prisma.purposeDocumentConfig.findUnique({
      where: { visaPurposeId_globalDocumentId: { visaPurposeId: purposeId, globalDocumentId: globalDoc.id } },
    });
    if (cfg) {
      await updatePurposeDocumentConfig(cfg.id, { conditions: payload.conditions }, actorId);
    }
  }

  return getPurposeWorkspace(purposeId);
}

async function updatePurposeDocumentConfig(configId, payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purposeDocumentConfig.findUnique({ where: { id: configId } });
    if (!existing) {
      const err = new Error('Purpose Document Config not found');
      err.statusCode = 404;
      throw err;
    }

    await tx.purposeDocumentConfig.update({
      where: { id: configId },
      data: {
        ...(payload.customNameEn !== undefined ? { customNameEn: payload.customNameEn || null } : {}),
        ...(payload.customNameAz !== undefined ? { customNameAz: payload.customNameAz || null } : {}),
        ...(payload.customDescriptionEn !== undefined ? { customDescriptionEn: payload.customDescriptionEn || null } : {}),
        ...(payload.customDescriptionAz !== undefined ? { customDescriptionAz: payload.customDescriptionAz || null } : {}),
        ...(payload.isRequired !== undefined ? { isRequired: Boolean(payload.isRequired) } : {}),
        ...(payload.displayOrder !== undefined ? { displayOrder: Number(payload.displayOrder) } : {}),
        ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
      },
    });

    if (Array.isArray(payload.conditions)) {
      await tx.documentCondition.deleteMany({ where: { purposeDocumentConfigId: configId } });
      for (const c of payload.conditions) {
        const triggerCode = c.triggerQuestionCode || c.questionCode;
        if (!triggerCode) continue;
        await tx.documentCondition.create({
          data: {
            purposeDocumentConfigId: configId,
            groupOperator: c.groupOperator || 'AND',
            action: c.action || 'SHOW_AND_REQUIRE',
            triggerQuestionCode: triggerCode,
            comparator: c.comparator || 'EQUALS',
            triggerValue: c.triggerValue !== undefined ? String(c.triggerValue) : c.value !== undefined ? String(c.value) : null,
          },
        });
      }
      await tx.purposeDocumentConfig.update({
        where: { id: configId },
        data: {
          conditionalRulesJson:
            payload.conditions.length > 0
              ? {
                  operator: payload.conditions[0].groupOperator || 'AND',
                  action: payload.conditions[0].action || 'SHOW_AND_REQUIRE',
                  rules: payload.conditions,
                }
              : null,
        },
      });
    }

    await recordVcmsAudit(actorId, 'VCMS_PURPOSE_DOCUMENT_UPDATED', { configId, purposeId: existing.visaPurposeId }, tx);
    const updated = await tx.purposeDocumentConfig.findUnique({
      where: { id: configId },
      include: { globalDocument: { include: { documentCategory: true } }, conditions: true },
    });
    return resolveDocumentConfig(updated);
  });
}

async function reorderPurposeDocuments(purposeId, items = [], actorId) {
  await prisma.$transaction(
    items.map((item, idx) =>
      prisma.purposeDocumentConfig.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder !== undefined ? Number(item.displayOrder) : idx + 1 },
      })
    )
  );
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_DOCUMENTS_REORDERED', { purposeId });
  return getPurposeWorkspace(purposeId);
}

async function detachPurposeDocument(configId, actorId) {
  const existing = await prisma.purposeDocumentConfig.findUnique({ where: { id: configId } });
  if (!existing) {
    const err = new Error('Purpose document config not found');
    err.statusCode = 404;
    throw err;
  }
  await prisma.purposeDocumentConfig.delete({ where: { id: configId } });
  await recordVcmsAudit(actorId, 'VCMS_PURPOSE_DOCUMENT_DETACHED', { configId, purposeId: existing.visaPurposeId });
  return { detached: true, purposeId: existing.visaPurposeId };
}

// ============================================================================
// 4. VISA APPLICATION CENTRES, EMBASSIES & APPLICANT LOCATIONS
// ============================================================================

async function listVisaOffices({ countryId, locationCountryCode } = {}) {
  const where = {};
  if (countryId && countryId !== 'ALL') where.countryId = countryId;
  if (locationCountryCode && locationCountryCode !== 'ALL') where.locationCountryCode = locationCountryCode;

  const [visaCentres, embassies, applicationLocations] = await Promise.all([
    prisma.visaApplicationCentre.findMany({
      where,
      include: { country: { select: { id: true, code: true, nameEn: true, nameAz: true, flagEmoji: true } } },
      orderBy: [{ country: { displayOrder: 'asc' } }, { isPrimary: 'desc' }],
    }),
    prisma.embassy.findMany({
      where,
      include: { country: { select: { id: true, code: true, nameEn: true, nameAz: true, flagEmoji: true } } },
      orderBy: [{ country: { displayOrder: 'asc' } }, { isPrimary: 'desc' }],
    }),
    prisma.countryApplicationLocation.findMany({
      where: {
        ...(countryId && countryId !== 'ALL' ? { destinationCountryId: countryId } : {}),
        ...(locationCountryCode && locationCountryCode !== 'ALL' ? { applicantCountryCode: locationCountryCode } : {}),
      },
      include: {
        destinationCountry: { select: { id: true, code: true, nameEn: true, flagEmoji: true } },
        visaApplicationCentre: true,
        embassy: true,
      },
    }),
  ]);

  return { visaCentres, embassies, applicationLocations };
}

async function saveVisaCentre(payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const data = {
      countryId: payload.countryId,
      providerName: String(payload.providerName || 'Capago').trim(),
      centreName: payload.centreName || `${payload.providerName} Visa Application Centre (${payload.city || 'Baku'})`,
      city: String(payload.city || 'Baku').trim(),
      locationCountryCode: String(payload.locationCountryCode || 'AZ').trim().toUpperCase(),
      locationCountryName: String(payload.locationCountryName || 'Azerbaijan').trim(),
      address: String(payload.address || '').trim(),
      telephone: payload.telephone || null,
      email: payload.email || null,
      officialWebsite: payload.officialWebsite || null,
      appointmentBookingUrl: payload.appointmentBookingUrl || null,
      workingHours: payload.workingHours || 'Mon–Fri 09:00 – 17:00',
      notes: payload.notes || null,
      status: payload.status || 'ACTIVE',
      isPrimary: payload.isPrimary !== undefined ? Boolean(payload.isPrimary) : true,
    };

    const vac = payload.id
      ? await tx.visaApplicationCentre.update({ where: { id: payload.id }, data })
      : await tx.visaApplicationCentre.create({ data });

    // Auto-sync CountryApplicationLocation
    await tx.countryApplicationLocation.upsert({
      where: {
        destinationCountryId_applicantCountryCode: {
          destinationCountryId: vac.countryId,
          applicantCountryCode: vac.locationCountryCode,
        },
      },
      update: { visaApplicationCentreId: vac.id, applicantCountryName: vac.locationCountryName },
      create: {
        destinationCountryId: vac.countryId,
        applicantCountryCode: vac.locationCountryCode,
        applicantCountryName: vac.locationCountryName,
        visaApplicationCentreId: vac.id,
        isDefault: vac.locationCountryCode === 'AZ',
        status: 'ACTIVE',
      },
    });

    // Auto-sync AppointmentProvider for this Visa Centre
    const existingProvider = await tx.appointmentProvider.findFirst({
      where: { visaApplicationCentreId: vac.id },
    });
    if (existingProvider) {
      await tx.appointmentProvider.update({
        where: { id: existingProvider.id },
        data: {
          displayName: `${vac.providerName} Visa Centre (${vac.city})`,
          applicantCountryCode: vac.locationCountryCode,
          status: vac.status,
        },
      });
    } else {
      const createdProvider = await tx.appointmentProvider.create({
        data: {
          countryId: vac.countryId,
          providerType: 'VISA_APPLICATION_CENTRE',
          visaApplicationCentreId: vac.id,
          displayName: `${vac.providerName} Visa Centre (${vac.city})`,
          applicantCountryCode: vac.locationCountryCode,
          timezone: payload.timezone || 'Asia/Baku',
          defaultManagementMode: 'AUTOMATIC_GENERATION',
          status: vac.status,
        },
      });

      const shortStay = await tx.visaType.findFirst({
        where: { countryId: vac.countryId, stayCategory: 'SHORT' },
      });
      if (shortStay) {
        await tx.providerVisaType.upsert({
          where: { providerId_visaTypeId: { providerId: createdProvider.id, visaTypeId: shortStay.id } },
          update: { isActive: true },
          create: { providerId: createdProvider.id, visaTypeId: shortStay.id, isDefault: true, isActive: true },
        });
      }
    }

    await recordVcmsAudit(actorId, 'VCMS_VISA_CENTRE_SAVED', { vacId: vac.id, countryId: vac.countryId }, tx);
    return vac;
  });
}

async function saveEmbassy(payload, actorId) {
  return await prisma.$transaction(async (tx) => {
    const data = {
      countryId: payload.countryId,
      responsibleAuthority: String(payload.responsibleAuthority || '').trim(),
      city: String(payload.city || 'Baku').trim(),
      locationCountryCode: String(payload.locationCountryCode || 'AZ').trim().toUpperCase(),
      locationCountryName: String(payload.locationCountryName || 'Azerbaijan').trim(),
      address: String(payload.address || '').trim(),
      telephone: payload.telephone || null,
      email: payload.email || null,
      officialWebsite: payload.officialWebsite || null,
      visaInformationUrl: payload.visaInformationUrl || null,
      consularHours: payload.consularHours || 'Mon–Fri 09:00 – 12:30',
      jurisdictionNotes: payload.jurisdictionNotes || null,
      status: payload.status || 'ACTIVE',
      isPrimary: payload.isPrimary !== undefined ? Boolean(payload.isPrimary) : true,
    };

    const embassy = payload.id
      ? await tx.embassy.update({ where: { id: payload.id }, data })
      : await tx.embassy.create({ data });

    // Auto-sync CountryApplicationLocation
    await tx.countryApplicationLocation.upsert({
      where: {
        destinationCountryId_applicantCountryCode: {
          destinationCountryId: embassy.countryId,
          applicantCountryCode: embassy.locationCountryCode,
        },
      },
      update: { embassyId: embassy.id, applicantCountryName: embassy.locationCountryName },
      create: {
        destinationCountryId: embassy.countryId,
        applicantCountryCode: embassy.locationCountryCode,
        applicantCountryName: embassy.locationCountryName,
        embassyId: embassy.id,
        isDefault: embassy.locationCountryCode === 'AZ',
        status: 'ACTIVE',
      },
    });

    // Auto-sync AppointmentProvider for this Embassy
    const existingProvider = await tx.appointmentProvider.findFirst({
      where: { embassyId: embassy.id },
    });
    if (existingProvider) {
      await tx.appointmentProvider.update({
        where: { id: existingProvider.id },
        data: {
          displayName: embassy.responsibleAuthority,
          applicantCountryCode: embassy.locationCountryCode,
          status: embassy.status,
        },
      });
    } else {
      const createdProvider = await tx.appointmentProvider.create({
        data: {
          countryId: embassy.countryId,
          providerType: 'EMBASSY',
          embassyId: embassy.id,
          displayName: embassy.responsibleAuthority,
          applicantCountryCode: embassy.locationCountryCode,
          timezone: payload.timezone || 'Asia/Baku',
          defaultManagementMode: 'AUTOMATIC_GENERATION',
          status: embassy.status,
        },
      });

      const longStay = await tx.visaType.findFirst({
        where: { countryId: embassy.countryId, stayCategory: 'LONG' },
      });
      if (longStay) {
        await tx.providerVisaType.upsert({
          where: { providerId_visaTypeId: { providerId: createdProvider.id, visaTypeId: longStay.id } },
          update: { isActive: true },
          create: { providerId: createdProvider.id, visaTypeId: longStay.id, isDefault: true, isActive: true },
        });
      }
    }

    await recordVcmsAudit(actorId, 'VCMS_EMBASSY_SAVED', { embassyId: embassy.id, countryId: embassy.countryId }, tx);
    return embassy;
  });
}

// ============================================================================
// 5. VERSION CONTROL, PREVIEW, PUBLISH, ROLLBACK & IMPORT/EXPORT
// ============================================================================

async function buildCountrySnapshot(countryId) {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    include: {
      visaTypes: {
        orderBy: { displayOrder: 'asc' },
        include: {
          purposes: {
            orderBy: { displayOrder: 'asc' },
            include: {
              questionCategories: { orderBy: { displayOrder: 'asc' } },
              questionConfigs: {
                orderBy: { officialFormOrder: 'asc' },
                include: {
                  category: true,
                  globalQuestion: { include: { options: { orderBy: { displayOrder: 'asc' } }, validations: true } },
                  conditions: { orderBy: { displayOrder: 'asc' } },
                  validations: true,
                },
              },
              documentConfigs: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  globalDocument: { include: { documentCategory: true } },
                  conditions: true,
                },
              },
            },
          },
        },
      },
      visaApplicationCentres: true,
      embassies: true,
      applicationLocations: { include: { visaApplicationCentre: true, embassy: true } },
      appointmentProviders: {
        include: {
          servedVisaTypes: true,
          servedPurposes: true,
        },
      },
    },
  });

  if (!country) {
    const err = new Error('Country not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    capturedAt: new Date().toISOString(),
    country: {
      id: country.id,
      code: country.code,
      nameEn: country.nameEn,
      nameAz: country.nameAz,
      nameRu: country.nameRu,
      region: country.region,
      isSchengen: country.isSchengen,
      processingDaysLabel: country.processingDaysLabel,
    },
    visaTypes: country.visaTypes.map((vt) => ({
      ...vt,
      purposes: vt.purposes.map((p) => ({
        ...p,
        resolvedQuestions: p.questionConfigs.map(resolveQuestionConfig),
        resolvedDocuments: p.documentConfigs.map(resolveDocumentConfig),
      })),
    })),
    visaApplicationCentres: country.visaApplicationCentres,
    embassies: country.embassies,
    applicationLocations: country.applicationLocations,
    appointmentProviders: country.appointmentProviders,
  };
}

async function publishCountryConfiguration(countryId, { changeSummary } = {}, actorId) {
  const snapshot = await buildCountrySnapshot(countryId);
  if (!snapshot.visaTypes.length) {
    const err = new Error('Cannot publish country without at least one Visa Type and Purpose.');
    err.statusCode = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const maxVer = await tx.configurationVersion.aggregate({
      where: { countryId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (maxVer._max.versionNumber || 0) + 1;

    // Mark previous ACTIVE versions as INACTIVE (archived history)
    await tx.configurationVersion.updateMany({
      where: { countryId, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });

    const version = await tx.configurationVersion.create({
      data: {
        countryId,
        versionNumber: nextVersionNumber,
        status: 'ACTIVE',
        changeSummary: changeSummary || `Published configuration v${nextVersionNumber}`,
        snapshotJson: snapshot,
        publishedById: actorId || null,
        publishedAt: new Date(),
      },
    });

    await tx.country.update({
      where: { id: countryId },
      data: { status: 'ACTIVE', isActive: true },
    });

    await recordVcmsAudit(
      actorId,
      'VCMS_COUNTRY_PUBLISHED',
      { countryId, versionNumber: nextVersionNumber, versionId: version.id },
      tx
    );

    return version;
  });
}

async function rollbackConfigurationVersion(countryId, versionId, actorId) {
  const targetVer = await prisma.configurationVersion.findUnique({
    where: { id: versionId },
  });
  if (!targetVer || targetVer.countryId !== countryId) {
    const err = new Error('Configuration version not found for this country');
    err.statusCode = 404;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const maxVer = await tx.configurationVersion.aggregate({
      where: { countryId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (maxVer._max.versionNumber || 0) + 1;

    await tx.configurationVersion.updateMany({
      where: { countryId, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });

    const restoredVersion = await tx.configurationVersion.create({
      data: {
        countryId,
        versionNumber: nextVersionNumber,
        status: 'ACTIVE',
        changeSummary: `Rollback to v${targetVer.versionNumber} (${targetVer.changeSummary || 'Snapshot restored'})`,
        snapshotJson: targetVer.snapshotJson,
        publishedById: actorId || null,
        publishedAt: new Date(),
      },
    });

    await recordVcmsAudit(
      actorId,
      'VCMS_COUNTRY_ROLLBACK',
      { countryId, fromVersion: targetVer.versionNumber, newVersion: nextVersionNumber },
      tx
    );
    return restoredVersion;
  });
}

async function importQuestionsBatch({ rows = [], dryRun = true, purposeId = null, categoryId = null }, actorId) {
  const validAnswerTypes = new Set([
    'TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'MULTIPLE_SELECT',
    'YES_NO', 'TEXTAREA', 'EMAIL', 'PHONE', 'COUNTRY_SELECT',
    'ADDRESS', 'FILE_UPLOAD', 'REPEATER',
  ]);

  const report = rows.map((row, idx) => {
    const errors = [];
    const titleEn = String(row.titleEn || row.title || '').trim();
    const officialTextEn = String(row.officialTextEn || row.officialText || titleEn).trim();
    const answerType = String(row.answerType || 'TEXT').trim().toUpperCase();

    if (!titleEn) errors.push('Missing titleEn');
    if (!validAnswerTypes.has(answerType)) errors.push(`Invalid answerType: ${answerType}`);

    const rawOptions = Array.isArray(row.options)
      ? row.options
      : typeof row.options === 'string' && row.options.trim()
        ? row.options.split('|').map((s) => ({ labelEn: s.trim() }))
        : [];

    if ((answerType === 'SINGLE_SELECT' || answerType === 'MULTIPLE_SELECT') && rawOptions.length === 0) {
      errors.push('SELECT question requires at least one option (separated by "|" or array)');
    }

    return {
      rowIndex: idx + 1,
      valid: errors.length === 0,
      errors,
      normalized: {
        titleEn,
        titleAz: String(row.titleAz || titleEn).trim(),
        officialTextEn,
        officialTextAz: String(row.officialTextAz || officialTextEn).trim(),
        defaultCategoryName: row.categoryName || row.defaultCategoryName || 'General Information',
        answerType,
        defaultRequired: row.isRequired !== undefined ? Boolean(row.isRequired) : true,
        helpTextEn: row.helpTextEn || null,
        schengenPdfFieldKey: row.schengenPdfFieldKey || null,
        options: rawOptions,
      },
    };
  });

  const validRows = report.filter((r) => r.valid);
  const invalidRows = report.filter((r) => !r.valid);

  if (dryRun || invalidRows.length > 0) {
    return {
      dryRun: true,
      committed: false,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      rows: report,
    };
  }

  const createdQuestions = [];
  for (const r of validRows) {
    const q = await createGlobalQuestion(r.normalized, actorId);
    createdQuestions.push(q);
  }

  if (purposeId && createdQuestions.length > 0) {
    await attachQuestionsFromPool(
      purposeId,
      {
        categoryId,
        globalQuestionIds: createdQuestions.map((q) => q.id),
      },
      actorId
    );
  }

  return {
    dryRun: false,
    committed: true,
    totalRows: rows.length,
    importedCount: createdQuestions.length,
    createdQuestions,
  };
}

// ============================================================================
// 6. PUBLIC / PORTAL FORM SCHEMA, CONDITIONAL EVALUATION & APPLICANT ANSWERS
// ============================================================================

async function getPublicCountriesWithVisaStructure() {
  const countries = await prisma.country.findMany({
    where: { status: 'ACTIVE', isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { nameEn: 'asc' }],
    include: {
      visaCategories: true,
      visaTypes: {
        where: { status: 'ACTIVE' },
        orderBy: { displayOrder: 'asc' },
        include: {
          purposes: {
            where: { status: 'ACTIVE' },
            orderBy: { displayOrder: 'asc' },
            include: {
              _count: { select: { questionConfigs: true, documentConfigs: true } },
            },
          },
        },
      },
      visaApplicationCentres: { where: { status: 'ACTIVE' } },
      embassies: { where: { status: 'ACTIVE' } },
      applicationLocations: {
        where: { status: 'ACTIVE' },
        include: { visaApplicationCentre: true, embassy: true },
      },
      appointmentProviders: {
        where: { status: 'ACTIVE' },
        include: {
          embassy: true,
          visaApplicationCentre: true,
          servedVisaTypes: { where: { isActive: true } },
          servedPurposes: { where: { isActive: true } },
        },
      },
      configurationVersions: {
        where: { status: 'ACTIVE' },
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { id: true, versionNumber: true, publishedAt: true },
      },
    },
  });

  return countries;
}

async function getPublicPurposeFormSchema(purposeId, { applicantCountryCode = 'AZ', answersByQuestionCode = {} } = {}) {
  const workspace = await getPurposeWorkspace(purposeId);
  const countryId = workspace.purpose.country.id;

  const locationConfig = await prisma.countryApplicationLocation.findFirst({
    where: {
      destinationCountryId: countryId,
      applicantCountryCode: String(applicantCountryCode || 'AZ').toUpperCase(),
    },
    include: {
      visaApplicationCentre: true,
      embassy: true,
    },
  });

  const providers = await prisma.appointmentProvider.findMany({
    where: {
      countryId,
      status: 'ACTIVE',
      applicantCountryCode: String(applicantCountryCode || 'AZ').toUpperCase(),
    },
    include: {
      embassy: true,
      visaApplicationCentre: true,
      servedVisaTypes: { where: { isActive: true } },
      servedPurposes: { where: { isActive: true } },
    },
  });

  // Evaluate visibility & required status for every question and document based on current answers
  const evaluatedQuestions = workspace.questions.map((q) => {
    const evalState = evaluateConditionSet(
      {
        conditions: q.conditions,
        conditionalJson: q.conditionalLogicJson,
        baseRequired: q.isRequired,
      },
      answersByQuestionCode
    );
    return {
      ...q,
      evaluatedVisibility: evalState.isVisible,
      evaluatedRequired: evalState.isRequired,
    };
  });

  const evaluatedDocuments = workspace.documents.map((d) => {
    const evalState = evaluateConditionSet(
      {
        conditions: d.conditions,
        conditionalJson: d.conditionalRulesJson,
        baseRequired: d.isRequired,
      },
      answersByQuestionCode
    );
    return {
      ...d,
      evaluatedVisibility: evalState.isVisible,
      evaluatedRequired: evalState.isRequired,
    };
  });

  const evaluatedCategories = workspace.categories.map((cat) => ({
    ...cat,
    questions: evaluatedQuestions
      .filter((q) => q.categoryId === cat.id)
      .sort((a, b) => a.officialFormOrder - b.officialFormOrder),
  }));

  return {
    purpose: workspace.purpose,
    categories: evaluatedCategories,
    questions: evaluatedQuestions,
    documents: evaluatedDocuments,
    visaApplicationCentre: locationConfig?.visaApplicationCentre || null,
    embassy: locationConfig?.embassy || null,
    appointmentProviders: providers,
  };
}

async function getApplicantAnswersAndSchema({ dossierId, applicantId }) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      country: true,
      visaCategory: true,
      visaType: true,
      visaPurpose: true,
      configurationVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          changeSummary: true,
          publishedAt: true,
          snapshotJson: true,
        },
      },
    },
  });
  if (!dossier) {
    const err = new Error('Dossier not found');
    err.statusCode = 404;
    throw err;
  }

  let purposeId = dossier.visaPurposeId;
  if (!purposeId) {
    // Resolve fallback purpose by countryId + legacyVisaCategoryId or first active purpose
    const matchedPurpose = await prisma.visaPurpose.findFirst({
      where: {
        visaType: { countryId: dossier.countryId },
        OR: [{ legacyVisaCategoryId: dossier.visaCategoryId }, { status: 'ACTIVE' }],
      },
      orderBy: { displayOrder: 'asc' },
    });
    purposeId = matchedPurpose?.id || null;
  }

  const savedAnswers = applicantId
    ? await prisma.applicantQuestionAnswer.findMany({
        where: { applicantId },
      })
    : [];

  const answersByQuestionCode = {};
  for (const ans of savedAnswers) {
    answersByQuestionCode[ans.questionCode] = {
      valueText: ans.valueText,
      selectedOptionCodes: ans.selectedOptionCodesJson || [],
      structuredValue: ans.structuredValueJson || null,
    };
  }

  let schema = null;
  if (purposeId) {
    try {
      schema = await getPublicPurposeFormSchema(purposeId, { answersByQuestionCode });
    } catch (_) {
      // Fallback to immutable ConfigurationVersion snapshot if live purpose was archived/removed
      const snap = dossier.configurationVersion?.snapshotJson;
      if (snap && Array.isArray(snap.visaTypes)) {
        for (const vt of snap.visaTypes) {
          const matchedP = (vt.purposes || []).find((p) => p.id === purposeId);
          if (matchedP) {
            schema = {
              purpose: { ...matchedP, visaType: vt, country: snap.country },
              categories: matchedP.questionCategories || [],
              questions: matchedP.resolvedQuestions || [],
              documents: matchedP.resolvedDocuments || [],
              visaApplicationCentre: snap.visaApplicationCentres?.[0] || null,
              embassy: snap.embassies?.[0] || null,
              appointmentProviders: snap.appointmentProviders || [],
            };
            break;
          }
        }
      }
    }
  }

  return {
    dossierId,
    applicantId,
    purposeId,
    visaType: dossier.visaType || schema?.purpose?.visaType || null,
    visaPurpose: dossier.visaPurpose || schema?.purpose || null,
    configurationVersion: dossier.configurationVersion
      ? {
          id: dossier.configurationVersion.id,
          versionNumber: dossier.configurationVersion.versionNumber,
          publishedAt: dossier.configurationVersion.publishedAt,
          changeSummary: dossier.configurationVersion.changeSummary,
        }
      : null,
    savedAnswers,
    answersByQuestionCode,
    schema,
  };
}

async function saveApplicantQuestionAnswers({ dossierId, applicantId, answers = [], actorId }) {
  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    include: { dossier: true },
  });
  if (!applicant) {
    const err = new Error('Applicant not found');
    err.statusCode = 404;
    throw err;
  }

  let purposeId = applicant.dossier?.visaPurposeId;
  if (!purposeId && applicant.dossier?.countryId) {
    const fallbackPurpose = await prisma.visaPurpose.findFirst({
      where: { visaType: { countryId: applicant.dossier.countryId } },
      orderBy: { displayOrder: 'asc' },
    });
    purposeId = fallbackPurpose?.id || null;
  }

  return await prisma.$transaction(async (tx) => {
    const pdfFormSync = {
      ...(typeof applicant.formDataJson === 'object' && applicant.formDataJson ? applicant.formDataJson : {}),
    };

    const upserted = [];
    for (const item of answers) {
      let configId = item.purposeQuestionConfigId || item.configId;
      let questionCode = item.questionCode;
      let pdfKey = null;

      if (configId) {
        const cfg = await tx.purposeQuestionConfig.findUnique({
          where: { id: configId },
          include: { globalQuestion: true },
        });
        if (cfg) {
          questionCode = cfg.globalQuestion?.questionCode || questionCode;
          pdfKey = cfg.globalQuestion?.schengenPdfFieldKey || null;
        }
      } else if (questionCode && purposeId) {
        const cfg = await tx.purposeQuestionConfig.findFirst({
          where: {
            visaPurposeId: purposeId,
            globalQuestion: { questionCode },
          },
          include: { globalQuestion: true },
        });
        if (cfg) {
          configId = cfg.id;
          pdfKey = cfg.globalQuestion?.schengenPdfFieldKey || null;
        }
      }

      if (!configId || !questionCode) continue;

      const valueText = item.valueText !== undefined && item.valueText !== null ? String(item.valueText) : null;
      const selectedOptionCodesJson = Array.isArray(item.selectedOptionCodes)
        ? item.selectedOptionCodes
        : item.selectedOptionCodesJson || null;
      const structuredValueJson = item.structuredValue || item.structuredValueJson || null;

      const saved = await tx.applicantQuestionAnswer.upsert({
        where: {
          applicantId_purposeQuestionConfigId: {
            applicantId,
            purposeQuestionConfigId: configId,
          },
        },
        update: {
          questionCode,
          valueText,
          selectedOptionCodesJson,
          structuredValueJson,
        },
        create: {
          dossierId: dossierId || applicant.dossierId,
          applicantId,
          purposeQuestionConfigId: configId,
          questionCode,
          valueText,
          selectedOptionCodesJson,
          structuredValueJson,
        },
      });
      upserted.push(saved);

      if (pdfKey) {
        pdfFormSync[pdfKey] =
          valueText ??
          (Array.isArray(selectedOptionCodesJson) ? selectedOptionCodesJson.join(', ') : null) ??
          structuredValueJson;
      }
    }

    // Sync core Applicant columns + 37-point Schengen formDataJson
    await tx.applicant.update({
      where: { id: applicantId },
      data: {
        ...(pdfFormSync.firstName ? { firstName: String(pdfFormSync.firstName) } : {}),
        ...(pdfFormSync.lastName ? { lastName: String(pdfFormSync.lastName) } : {}),
        ...(pdfFormSync.passportNumber ? { passportNumber: String(pdfFormSync.passportNumber) } : {}),
        formDataJson: pdfFormSync,
      },
    });

    await recordVcmsAudit(
      actorId,
      'VCMS_APPLICANT_ANSWERS_SAVED',
      { dossierId: applicant.dossierId, applicantId, count: upserted.length },
      tx
    );

    return { savedCount: upserted.length, answers: upserted, syncedFormData: pdfFormSync };
  });
}

module.exports = {
  resolveQuestionConfig,
  resolveDocumentConfig,
  listDestinations,
  getCountryDetail,
  createCountry,
  updateCountry,
  deleteOrDeactivateCountry,
  createVisaType,
  updateVisaType,
  deleteVisaType,
  createVisaPurpose,
  updateVisaPurpose,
  deleteVisaPurpose,
  duplicateVisaPurpose,
  listQuestionPool,
  createGlobalQuestion,
  updateGlobalQuestion,
  duplicateGlobalQuestion,
  getPurposeWorkspace,
  createQuestionCategory,
  reorderQuestionCategories,
  attachQuestionsFromPool,
  createAndAttachQuestion,
  updatePurposeQuestionConfig,
  reorderPurposeQuestions,
  detachPurposeQuestion,
  listDocumentCategories,
  listDocumentPool,
  createGlobalDocument,
  updateGlobalDocument,
  attachDocumentsFromPool,
  createAndAttachDocument,
  updatePurposeDocumentConfig,
  reorderPurposeDocuments,
  detachPurposeDocument,
  listVisaOffices,
  saveVisaCentre,
  saveEmbassy,
  buildCountrySnapshot,
  publishCountryConfiguration,
  rollbackConfigurationVersion,
  importQuestionsBatch,
  getPublicCountriesWithVisaStructure,
  getPublicPurposeFormSchema,
  getApplicantAnswersAndSchema,
  saveApplicantQuestionAnswers,
  validateQuestionValue,
};
