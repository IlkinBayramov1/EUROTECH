const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');
const ApiResponse = require('../../core/api.response');
const vcmsService = require('./services/vcms.service');
const appointmentEngine = require('./services/appointmentEngine.service');

// ============================================================================
// 1. DESTINATIONS, VISA TYPES & PURPOSES
// ============================================================================

async function listDestinations(req, res) {
  try {
    const countries = await vcmsService.listDestinations(req.query);
    return ApiResponse.success(res, { countries });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getCountryDetail(req, res) {
  try {
    const country = await vcmsService.getCountryDetail(req.params.countryId);
    return ApiResponse.success(res, { country });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createCountry(req, res) {
  try {
    const country = await vcmsService.createCountry(req.body, req.user?.id);
    return ApiResponse.success(res, { country }, 'Country created successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateCountry(req, res) {
  try {
    const country = await vcmsService.updateCountry(req.params.countryId, req.body, req.user?.id);
    return ApiResponse.success(res, { country }, 'Country updated successfully');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function deleteCountry(req, res) {
  try {
    const result = await vcmsService.deleteOrDeactivateCountry(req.params.countryId, req.user?.id);
    return ApiResponse.success(res, result, 'Country status updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createVisaType(req, res) {
  try {
    const visaType = await vcmsService.createVisaType(req.params.countryId, req.body, req.user?.id);
    return ApiResponse.success(res, { visaType }, 'Visa Type created successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateVisaType(req, res) {
  try {
    const visaType = await vcmsService.updateVisaType(req.params.visaTypeId, req.body, req.user?.id);
    return ApiResponse.success(res, { visaType }, 'Visa Type updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function deleteVisaType(req, res) {
  try {
    const result = await vcmsService.deleteVisaType(req.params.visaTypeId, req.user?.id);
    return ApiResponse.success(res, result, 'Visa Type removed');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createVisaPurpose(req, res) {
  try {
    const purpose = await vcmsService.createVisaPurpose(req.params.visaTypeId, req.body, req.user?.id);
    return ApiResponse.success(res, { purpose }, 'Visa Purpose created successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateVisaPurpose(req, res) {
  try {
    const purpose = await vcmsService.updateVisaPurpose(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, { purpose }, 'Visa Purpose updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function deleteVisaPurpose(req, res) {
  try {
    const result = await vcmsService.deleteVisaPurpose(req.params.purposeId, req.user?.id);
    return ApiResponse.success(res, result, 'Visa Purpose removed');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function duplicateVisaPurpose(req, res) {
  try {
    const purpose = await vcmsService.duplicateVisaPurpose(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, { purpose }, 'Visa Purpose duplicated successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 2. QUESTION POOL & PURPOSE QUESTIONS
// ============================================================================

async function listQuestionPool(req, res) {
  try {
    const questions = await vcmsService.listQuestionPool(req.query);
    return ApiResponse.success(res, { questions });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createGlobalQuestion(req, res) {
  try {
    const question = await vcmsService.createGlobalQuestion(req.body, req.user?.id);
    return ApiResponse.success(res, { question }, 'Global Question created in pool', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateGlobalQuestion(req, res) {
  try {
    const question = await vcmsService.updateGlobalQuestion(req.params.questionId, req.body, req.user?.id);
    return ApiResponse.success(res, { question }, 'Global Question updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function duplicateGlobalQuestion(req, res) {
  try {
    const question = await vcmsService.duplicateGlobalQuestion(req.params.questionId, req.user?.id);
    return ApiResponse.success(res, { question }, 'Question duplicated in pool', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getPurposeWorkspace(req, res) {
  try {
    const workspace = await vcmsService.getPurposeWorkspace(req.params.purposeId);
    return ApiResponse.success(res, workspace);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createQuestionCategory(req, res) {
  try {
    const category = await vcmsService.createQuestionCategory(req.params.purposeId, req.body);
    return ApiResponse.success(res, { category }, 'Question Category created', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function reorderQuestionCategories(req, res) {
  try {
    const categories = await vcmsService.reorderQuestionCategories(req.params.purposeId, req.body.items || []);
    return ApiResponse.success(res, { categories }, 'Categories reordered');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function attachQuestionsFromPool(req, res) {
  try {
    const workspace = await vcmsService.attachQuestionsFromPool(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, workspace, 'Questions attached from pool');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createAndAttachQuestion(req, res) {
  try {
    const workspace = await vcmsService.createAndAttachQuestion(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, workspace, 'Question created and attached to purpose', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updatePurposeQuestionConfig(req, res) {
  try {
    const questionConfig = await vcmsService.updatePurposeQuestionConfig(
      req.params.configId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, { questionConfig }, 'Purpose question configuration updated (local override isolated)');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function reorderPurposeQuestions(req, res) {
  try {
    const workspace = await vcmsService.reorderPurposeQuestions(
      req.params.purposeId,
      req.body.items || [],
      req.user?.id
    );
    return ApiResponse.success(res, workspace, 'Questions reordered');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function detachPurposeQuestion(req, res) {
  try {
    const result = await vcmsService.detachPurposeQuestion(req.params.configId, req.user?.id);
    return ApiResponse.success(res, result, 'Question detached from purpose (kept in pool)');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 3. DOCUMENT POOL & PURPOSE DOCUMENTS
// ============================================================================

async function listDocumentCategories(req, res) {
  try {
    const categories = await vcmsService.listDocumentCategories();
    return ApiResponse.success(res, { categories });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function listDocumentPool(req, res) {
  try {
    const documents = await vcmsService.listDocumentPool(req.query);
    return ApiResponse.success(res, { documents });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createGlobalDocument(req, res) {
  try {
    const document = await vcmsService.createGlobalDocument(req.body, req.user?.id);
    return ApiResponse.success(res, { document }, 'Global Document created in pool', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateGlobalDocument(req, res) {
  try {
    const document = await vcmsService.updateGlobalDocument(req.params.documentId, req.body, req.user?.id);
    return ApiResponse.success(res, { document }, 'Global Document updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function attachDocumentsFromPool(req, res) {
  try {
    const workspace = await vcmsService.attachDocumentsFromPool(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, workspace, 'Documents attached from pool');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createAndAttachDocument(req, res) {
  try {
    const workspace = await vcmsService.createAndAttachDocument(req.params.purposeId, req.body, req.user?.id);
    return ApiResponse.success(res, workspace, 'Document created and attached', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updatePurposeDocumentConfig(req, res) {
  try {
    const documentConfig = await vcmsService.updatePurposeDocumentConfig(
      req.params.configId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, { documentConfig }, 'Purpose document configuration updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function reorderPurposeDocuments(req, res) {
  try {
    const workspace = await vcmsService.reorderPurposeDocuments(
      req.params.purposeId,
      req.body.items || [],
      req.user?.id
    );
    return ApiResponse.success(res, workspace, 'Documents reordered');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function detachPurposeDocument(req, res) {
  try {
    const result = await vcmsService.detachPurposeDocument(req.params.configId, req.user?.id);
    return ApiResponse.success(res, result, 'Document detached from purpose');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 4. VISA APPLICATION CENTRES, EMBASSIES & LOCATIONS
// ============================================================================

async function listVisaOffices(req, res) {
  try {
    const data = await vcmsService.listVisaOffices(req.query);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function saveVisaCentre(req, res) {
  try {
    const payload = { ...req.body, ...(req.params.id ? { id: req.params.id } : {}) };
    const visaCentre = await vcmsService.saveVisaCentre(payload, req.user?.id);
    return ApiResponse.success(res, { visaCentre }, 'Visa Application Centre saved');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function saveEmbassy(req, res) {
  try {
    const payload = { ...req.body, ...(req.params.id ? { id: req.params.id } : {}) };
    const embassy = await vcmsService.saveEmbassy(payload, req.user?.id);
    return ApiResponse.success(res, { embassy }, 'Embassy saved');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 5. PREVIEW, PUBLISH, VERSION CONTROL & IMPORT/EXPORT
// ============================================================================

async function publishCountry(req, res) {
  try {
    const version = await vcmsService.publishCountryConfiguration(
      req.params.countryId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, { version }, `Country published as version v${version.versionNumber}`);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function rollbackCountryVersion(req, res) {
  try {
    const version = await vcmsService.rollbackConfigurationVersion(
      req.params.countryId,
      req.params.versionId,
      req.user?.id
    );
    return ApiResponse.success(res, { version }, `Rolled back to new version v${version.versionNumber}`);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function importQuestions(req, res) {
  try {
    const result = await vcmsService.importQuestionsBatch(req.body, req.user?.id);
    return ApiResponse.success(res, result, result.dryRun ? 'Import dry-run validated' : 'Questions imported');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function exportPurpose(req, res) {
  try {
    const workspace = await vcmsService.getPurposeWorkspace(req.params.purposeId);
    return ApiResponse.success(res, {
      exportedAt: new Date().toISOString(),
      ...workspace,
    });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 6. APPOINTMENT MANAGEMENT (PROVIDERS, SCHEDULES, RULES, CALENDAR, SLOTS, BOOKINGS)
// ============================================================================

async function listAppointmentProviders(req, res) {
  try {
    const providers = await appointmentEngine.listAppointmentProviders(req.query);
    return ApiResponse.success(res, { providers });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function saveAppointmentProvider(req, res) {
  try {
    const payload = { ...req.body, ...(req.params.providerId ? { id: req.params.providerId } : {}) };
    const provider = await appointmentEngine.saveAppointmentProvider(payload, req.user?.id);
    return ApiResponse.success(res, { provider }, 'Appointment Provider saved');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateProviderVisaMappings(req, res) {
  try {
    const provider = await appointmentEngine.updateProviderVisaMappings(
      req.params.providerId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, { provider }, 'Provider Visa Types & Purposes mappings updated');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function listAppointmentSchedules(req, res) {
  try {
    const schedules = await appointmentEngine.listAppointmentSchedules(req.query);
    return ApiResponse.success(res, { schedules });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createOrUpdateSchedule(req, res) {
  try {
    const payload = { ...req.body, ...(req.params.scheduleId ? { id: req.params.scheduleId } : {}) };
    const schedule = await appointmentEngine.createOrUpdateMonthlySchedule(payload, req.user?.id);
    return ApiResponse.success(res, { schedule }, 'Monthly Schedule & Generation Rules saved');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function previewScheduleGeneration(req, res) {
  try {
    const { summary } = await appointmentEngine.computeScheduleGenerationPlan(
      req.params.scheduleId,
      req.body?.rule || null
    );
    return ApiResponse.success(res, { preview: summary }, 'Draft Preview computed');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function generateScheduleSlots(req, res) {
  try {
    const result = await appointmentEngine.generateMonthlyScheduleSlots(req.params.scheduleId, req.user?.id);
    return ApiResponse.success(
      res,
      { generation: result },
      `Generated ${result.createdCount} slots in DRAFT mode (${result.preservedCount} existing preserved)`
    );
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function publishSchedule(req, res) {
  try {
    const result = await appointmentEngine.publishAppointmentSchedule(req.params.scheduleId, req.user?.id);
    return ApiResponse.success(
      res,
      result,
      `Schedule PUBLISHED. ${result.activatedSlotsCount} slots opened to customers.`
    );
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function closeOrArchiveSchedule(req, res) {
  try {
    const targetStatus = req.body.status || 'CLOSED';
    const schedule = await appointmentEngine.closeOrArchiveAppointmentSchedule(
      req.params.scheduleId,
      targetStatus,
      req.user?.id
    );
    return ApiResponse.success(res, { schedule }, `Schedule marked as ${targetStatus}`);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getAppointmentCalendar(req, res) {
  try {
    const calendar = await appointmentEngine.getAppointmentCalendar(req.query);
    return ApiResponse.success(res, calendar);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function listScheduleExceptions(req, res) {
  try {
    const exceptions = await appointmentEngine.listScheduleExceptions(req.query);
    return ApiResponse.success(res, { exceptions });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createScheduleException(req, res) {
  try {
    const result = await appointmentEngine.createScheduleException(req.body, req.user?.id);
    return ApiResponse.success(res, result, result.warning || 'Excluded date added', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function deleteScheduleException(req, res) {
  try {
    const result = await appointmentEngine.deleteScheduleException(req.params.exceptionId, req.user?.id);
    return ApiResponse.success(res, result, 'Excluded date removed');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createManualSlot(req, res) {
  try {
    const slot = await appointmentEngine.createManualSlot(req.body, req.user?.id);
    return ApiResponse.success(res, { slot }, 'Manual slot created successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateSlot(req, res) {
  try {
    const result = await appointmentEngine.updateSlot(req.params.slotId, req.body, req.user?.id);
    return ApiResponse.success(
      res,
      result,
      result.notificationsSentCount > 0
        ? `Slot updated and ${result.notificationsSentCount} customer(s) notified.`
        : 'Slot updated successfully'
    );
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function deleteSlot(req, res) {
  try {
    const result = await appointmentEngine.deleteSlot(req.params.slotId, req.user?.id);
    return ApiResponse.success(res, result, 'Slot deleted');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function listBookings(req, res) {
  try {
    const bookings = await appointmentEngine.listBookings(req.query);
    return ApiResponse.success(res, { bookings });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function updateBookingStatus(req, res) {
  try {
    const booking = await appointmentEngine.updateBookingStatus(
      req.params.appointmentId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, { booking }, `Booking status updated to ${booking.status}`);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function adminRescheduleBooking(req, res) {
  try {
    const result = await appointmentEngine.adminRescheduleBooking(
      req.params.appointmentId,
      req.body,
      req.user?.id
    );
    return ApiResponse.success(res, result, 'Booking rescheduled and customer notified');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

// ============================================================================
// 7. USER MANAGEMENT (/api/v1/admin/users)
// ============================================================================

async function listUsers(req, res) {
  try {
    const { role, status, search } = req.query;
    const where = {};
    if (role && role !== 'ALL') where.role = role;
    if (status && status !== 'ALL') where.accountStatus = status;
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { fullName: { contains: q } },
        { email: { contains: q } },
        { username: { contains: q } },
        { companyName: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        phone: true,
        companyName: true,
        accountStatus: true,
        agentTier: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: { dossiers: true, appointments: true, groupBatches: true },
        },
      },
    });
    return ApiResponse.success(res, { users });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function createUserByAdmin(req, res) {
  try {
    const { email, fullName, role, phone, companyName, password, username, agentTier } = req.body;
    if (!email || !fullName) {
      return ApiResponse.error(res, 'Email and Full Name are required', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (existing) {
      return ApiResponse.error(res, 'User with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password || 'EuroTech2026!', 10);
    const created = await prisma.user.create({
      data: {
        email: String(email).trim().toLowerCase(),
        username: username || `EUR-${Date.now().toString().slice(-6)}`,
        passwordHash,
        fullName: String(fullName).trim(),
        role: role || 'OPERATOR',
        phone: phone || null,
        companyName: companyName || null,
        accountStatus: 'ACTIVE',
        isVerified: true,
        ...(agentTier ? { agentTier } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: 'ADMIN_USER_CREATED',
        details: { createdUserId: created.id, email: created.email, role: created.role },
      },
    });

    return ApiResponse.success(res, { user: created }, 'User created successfully', 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}

async function updateUserByAdmin(req, res) {
  try {
    const { userId } = req.params;
    const { role, accountStatus, fullName, phone, companyName, agentTier, newPassword } = req.body;

    const updateData = {
      ...(role !== undefined ? { role } : {}),
      ...(accountStatus !== undefined ? { accountStatus } : {}),
      ...(fullName !== undefined ? { fullName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(companyName !== undefined ? { companyName } : {}),
      ...(agentTier !== undefined ? { agentTier } : {}),
    };
    if (newPassword && String(newPassword).trim().length >= 6) {
      updateData.passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: 'ADMIN_USER_UPDATED',
        details: { targetUserId: userId, role: updated.role, accountStatus: updated.accountStatus },
      },
    });

    return ApiResponse.success(res, { user: updated }, 'User updated successfully');
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}

// ============================================================================
// 8. PUBLIC / PORTAL ENDPOINTS (/api/v1/vcms/*)
// ============================================================================

async function getPublicCountries(req, res) {
  try {
    const countries = await vcmsService.getPublicCountriesWithVisaStructure();
    return ApiResponse.success(res, { countries });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getPublicPurposeSchema(req, res) {
  try {
    let answersByQuestionCode = {};
    if (req.query.answersJson) {
      try {
        answersByQuestionCode = JSON.parse(req.query.answersJson);
      } catch (_) {}
    } else if (req.body && req.body.answersByQuestionCode) {
      answersByQuestionCode = req.body.answersByQuestionCode;
    }

    const schema = await vcmsService.getPublicPurposeFormSchema(req.params.purposeId, {
      applicantCountryCode: req.query.applicantCountryCode || 'AZ',
      answersByQuestionCode,
    });
    return ApiResponse.success(res, schema);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getApplicantAnswers(req, res) {
  try {
    const data = await vcmsService.getApplicantAnswersAndSchema({
      dossierId: req.params.dossierId,
      applicantId: req.params.applicantId,
    });
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function saveApplicantAnswers(req, res) {
  try {
    const data = await vcmsService.saveApplicantQuestionAnswers({
      dossierId: req.params.dossierId,
      applicantId: req.params.applicantId,
      answers: req.body.answers || [],
      actorId: req.user?.id || null,
    });
    return ApiResponse.success(res, data, 'Application answers saved and synced');
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getCustomerPublishedSlots(req, res) {
  try {
    const data = await appointmentEngine.getCustomerPublishedSlots(req.query);
    return ApiResponse.success(res, data);
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function getMyAppointmentNotifications(req, res) {
  try {
    const notifications = await appointmentEngine.listUserAppointmentNotifications(req.user.id);
    return ApiResponse.success(res, { notifications });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

async function markMyAppointmentNotificationRead(req, res) {
  try {
    await appointmentEngine.markAppointmentNotificationRead(req.params.notificationId, req.user.id);
    return ApiResponse.success(res, { read: true });
  } catch (err) {
    return ApiResponse.error(res, err.message, err.statusCode || 400);
  }
}

module.exports = {
  listDestinations,
  getCountryDetail,
  createCountry,
  updateCountry,
  deleteCountry,
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
  publishCountry,
  rollbackCountryVersion,
  importQuestions,
  exportPurpose,
  listAppointmentProviders,
  saveAppointmentProvider,
  updateProviderVisaMappings,
  listAppointmentSchedules,
  createOrUpdateSchedule,
  previewScheduleGeneration,
  generateScheduleSlots,
  publishSchedule,
  closeOrArchiveSchedule,
  getAppointmentCalendar,
  listScheduleExceptions,
  createScheduleException,
  deleteScheduleException,
  createManualSlot,
  updateSlot,
  deleteSlot,
  listBookings,
  updateBookingStatus,
  adminRescheduleBooking,
  listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  getPublicCountries,
  getPublicPurposeSchema,
  getApplicantAnswers,
  saveApplicantAnswers,
  getCustomerPublishedSlots,
  getMyAppointmentNotifications,
  markMyAppointmentNotificationRead,
};
