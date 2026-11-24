import { apiClient } from '@/shared/api/client';

export const QUESTION_ANSWER_TYPES = [
  { value: 'TEXT', label: 'Text Input', example: 'First name, surname' },
  { value: 'NUMBER', label: 'Number', example: 'Number of children' },
  { value: 'DATE', label: 'Date Picker', example: 'Date of birth' },
  { value: 'SINGLE_SELECT', label: 'Single Select', example: 'Gender, marital status' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Select', example: 'Multiple nationalities' },
  { value: 'YES_NO', label: 'Yes / No', example: 'Previous visa refusal' },
  { value: 'TEXTAREA', label: 'Textarea', example: 'Explanation' },
  { value: 'EMAIL', label: 'Email', example: 'Email address' },
  { value: 'PHONE', label: 'Phone', example: 'Phone number' },
  { value: 'COUNTRY_SELECT', label: 'Country Select', example: 'Country of birth' },
  { value: 'ADDRESS', label: 'Address', example: 'Residential address' },
  { value: 'FILE_UPLOAD', label: 'File Upload', example: 'Supporting file, if required' },
  { value: 'REPEATER', label: 'Repeater', example: 'Multiple previous trips, employers' },
] as const;

export const DOCUMENT_CATEGORY_TYPES = [
  { value: 'IDENTITY', label: 'Identity' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'PURPOSE_SPECIFIC', label: 'Purpose-specific' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const EXCLUDED_DATE_REASONS = [
  { value: 'PUBLIC_HOLIDAY', label: 'Public Holiday' },
  { value: 'EMBASSY_CLOSED', label: 'Embassy Closed' },
  { value: 'VISA_CENTRE_CLOSED', label: 'Visa Centre Closed' },
  { value: 'TECHNICAL_MAINTENANCE', label: 'Technical Maintenance' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function evaluateFrontendSingleRule(rule: any, answersMap: Record<string, any> = {}): boolean {
  const triggerCode = rule.triggerQuestionCode || rule.questionCode;
  const comparator = String(rule.comparator || 'EQUALS').toUpperCase();
  const rawExpected = rule.triggerValue !== undefined ? rule.triggerValue : rule.value;
  const rawActual = answersMap[triggerCode];

  let actualArray: string[] = [];
  if (Array.isArray(rawActual)) {
    actualArray = rawActual.map((v) => String(v).trim());
  } else if (rawActual && typeof rawActual === 'object') {
    if (Array.isArray(rawActual.selectedOptionCodes)) {
      actualArray = rawActual.selectedOptionCodes.map((v: any) => String(v).trim());
    } else if (rawActual.valueText) {
      actualArray = [String(rawActual.valueText).trim()];
    }
  } else if (rawActual !== undefined && rawActual !== null && String(rawActual).trim() !== '') {
    actualArray = [String(rawActual).trim()];
  }
  const actualStr = actualArray[0] || '';

  let expectedArray: string[] = [];
  if (Array.isArray(rawExpected)) {
    expectedArray = rawExpected.map((v) => String(v).trim());
  } else if (typeof rawExpected === 'string' && rawExpected.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawExpected);
      if (Array.isArray(parsed)) expectedArray = parsed.map((v) => String(v).trim());
    } catch {
      expectedArray = [rawExpected.trim()];
    }
  } else if (rawExpected !== undefined && rawExpected !== null) {
    expectedArray = [String(rawExpected).trim()];
  }
  const expectedStr = expectedArray[0] || '';

  switch (comparator) {
    case 'EQUALS':
      return actualArray.includes(expectedStr) || actualStr.toLowerCase() === expectedStr.toLowerCase();
    case 'NOT_EQUALS':
      return !actualArray.includes(expectedStr) && actualStr.toLowerCase() !== expectedStr.toLowerCase();
    case 'IN':
      return actualArray.some((a) => expectedArray.includes(a));
    case 'NOT_IN':
      return !actualArray.some((a) => expectedArray.includes(a));
    case 'IS_TRUE':
      return ['true', 'yes', '1', 'bəli'].includes(actualStr.toLowerCase());
    case 'IS_FALSE':
      return ['false', 'no', '0', 'xeyr'].includes(actualStr.toLowerCase());
    case 'GREATER_THAN':
      return Number(actualStr) > Number(expectedStr);
    case 'LESS_THAN':
      return Number(actualStr) < Number(expectedStr);
    case 'IS_FILLED':
      return actualArray.length > 0 && actualStr.length > 0;
    case 'IS_EMPTY':
      return actualArray.length === 0 || actualStr.length === 0;
    default:
      return false;
  }
}

export function evaluateFrontendConditionSet(
  item: {
    conditions?: any[];
    conditionalLogicJson?: any;
    conditionalRulesJson?: any;
    isRequired?: boolean;
    isVisible?: boolean;
    [key: string]: any;
  },
  answersMap: Record<string, any> = {}
): { isVisible: boolean; isRequired: boolean } {
  const conditions = item.conditions || [];
  const jsonRules = item.conditionalLogicJson?.rules || item.conditionalRulesJson?.rules || [];
  const rules = conditions.length > 0 ? conditions : jsonRules;

  if (!rules || rules.length === 0) {
    return { isVisible: true, isRequired: Boolean(item.isRequired) };
  }

  const operator = String(
    conditions[0]?.groupOperator || item.conditionalLogicJson?.operator || item.conditionalRulesJson?.operator || 'AND'
  ).toUpperCase();
  const action = String(
    conditions[0]?.action || item.conditionalLogicJson?.action || item.conditionalRulesJson?.action || 'SHOW_AND_REQUIRE'
  ).toUpperCase();

  const results = rules.map((r: any) => evaluateFrontendSingleRule(r, answersMap));
  const matched = operator === 'OR' ? results.some(Boolean) : results.every(Boolean);

  if (action === 'SHOW') return { isVisible: matched, isRequired: matched ? Boolean(item.isRequired) : false };
  if (action === 'HIDE') return { isVisible: !matched, isRequired: !matched ? Boolean(item.isRequired) : false };
  if (action === 'REQUIRE') return { isVisible: true, isRequired: matched ? true : Boolean(item.isRequired) };
  if (action === 'MAKE_OPTIONAL') return { isVisible: true, isRequired: matched ? false : Boolean(item.isRequired) };

  return { isVisible: matched, isRequired: matched };
}

export const vcmsApi = {
  // 1. Destinations, Visa Types & Purposes
  listDestinations: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/destinations?${qs.toString()}`);
  },
  getCountryDetail: (countryId: string) => apiClient.get(`/admin/vcms/destinations/${countryId}`),
  createCountry: (data: any) => apiClient.post('/admin/vcms/destinations', data),
  updateCountry: (countryId: string, data: any) => apiClient.patch(`/admin/vcms/destinations/${countryId}`, data),
  deleteCountry: (countryId: string) => apiClient.delete(`/admin/vcms/destinations/${countryId}`),

  createVisaType: (countryId: string, data: any) =>
    apiClient.post(`/admin/vcms/destinations/${countryId}/visa-types`, data),
  updateVisaType: (visaTypeId: string, data: any) =>
    apiClient.patch(`/admin/vcms/visa-types/${visaTypeId}`, data),
  deleteVisaType: (visaTypeId: string) => apiClient.delete(`/admin/vcms/visa-types/${visaTypeId}`),

  createVisaPurpose: (visaTypeId: string, data: any) =>
    apiClient.post(`/admin/vcms/visa-types/${visaTypeId}/purposes`, data),
  updateVisaPurpose: (purposeId: string, data: any) =>
    apiClient.patch(`/admin/vcms/purposes/${purposeId}`, data),
  deleteVisaPurpose: (purposeId: string) => apiClient.delete(`/admin/vcms/purposes/${purposeId}`),
  duplicateVisaPurpose: (purposeId: string, data: any) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/duplicate`, data),
  getPurposeWorkspace: (purposeId: string) => apiClient.get(`/admin/vcms/purposes/${purposeId}/workspace`),

  // 2. Question Pool & Purpose Questions
  listQuestionPool: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/question-pool?${qs.toString()}`);
  },
  createGlobalQuestion: (data: any) => apiClient.post('/admin/vcms/question-pool', data),
  updateGlobalQuestion: (questionId: string, data: any) =>
    apiClient.patch(`/admin/vcms/question-pool/${questionId}`, data),
  duplicateGlobalQuestion: (questionId: string) =>
    apiClient.post(`/admin/vcms/question-pool/${questionId}/duplicate`, {}),

  createQuestionCategory: (purposeId: string, data: any) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/categories`, data),
  reorderQuestionCategories: (purposeId: string, items: any[]) =>
    apiClient.patch(`/admin/vcms/purposes/${purposeId}/categories/reorder`, { items }),
  attachQuestionsFromPool: (purposeId: string, data: { categoryId?: string; globalQuestionIds: string[]; isRequired?: boolean }) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/questions/attach`, data),
  createAndAttachQuestion: (purposeId: string, data: any) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/questions/create-and-attach`, data),
  updatePurposeQuestionConfig: (configId: string, data: any) =>
    apiClient.patch(`/admin/vcms/purpose-questions/${configId}`, data),
  reorderPurposeQuestions: (purposeId: string, items: any[]) =>
    apiClient.patch(`/admin/vcms/purposes/${purposeId}/questions/reorder`, { items }),
  detachPurposeQuestion: (configId: string) =>
    apiClient.delete(`/admin/vcms/purpose-questions/${configId}`),

  // 3. Document Pool & Purpose Documents
  listDocumentCategories: () => apiClient.get('/admin/vcms/document-categories'),
  listDocumentPool: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/document-pool?${qs.toString()}`);
  },
  createGlobalDocument: (data: any) => apiClient.post('/admin/vcms/document-pool', data),
  updateGlobalDocument: (documentId: string, data: any) =>
    apiClient.patch(`/admin/vcms/document-pool/${documentId}`, data),
  attachDocumentsFromPool: (purposeId: string, data: { globalDocumentIds: string[]; isRequired?: boolean }) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/documents/attach`, data),
  createAndAttachDocument: (purposeId: string, data: any) =>
    apiClient.post(`/admin/vcms/purposes/${purposeId}/documents/create-and-attach`, data),
  updatePurposeDocumentConfig: (configId: string, data: any) =>
    apiClient.patch(`/admin/vcms/purpose-documents/${configId}`, data),
  reorderPurposeDocuments: (purposeId: string, items: any[]) =>
    apiClient.patch(`/admin/vcms/purposes/${purposeId}/documents/reorder`, { items }),
  detachPurposeDocument: (configId: string) =>
    apiClient.delete(`/admin/vcms/purpose-documents/${configId}`),

  // 4. Visa Offices (Centres & Embassies)
  listVisaOffices: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/visa-offices?${qs.toString()}`);
  },
  saveVisaCentre: (data: any) =>
    data.id ? apiClient.patch(`/admin/vcms/visa-centres/${data.id}`, data) : apiClient.post('/admin/vcms/visa-centres', data),
  saveEmbassy: (data: any) =>
    data.id ? apiClient.patch(`/admin/vcms/embassies/${data.id}`, data) : apiClient.post('/admin/vcms/embassies', data),

  // 5. Publish, Version Control, Import & Export
  publishCountry: (countryId: string, changeSummary?: string) =>
    apiClient.post(`/admin/vcms/destinations/${countryId}/publish`, { changeSummary }),
  rollbackCountryVersion: (countryId: string, versionId: string) =>
    apiClient.post(`/admin/vcms/destinations/${countryId}/versions/${versionId}/rollback`, {}),
  importQuestions: (data: { rows: any[]; dryRun: boolean; purposeId?: string; categoryId?: string }) =>
    apiClient.post('/admin/vcms/import/questions', data),
  exportPurpose: (purposeId: string) => apiClient.get(`/admin/vcms/export/purpose/${purposeId}`),

  // 6. Appointment Management (8 Sub-sections)
  listAppointmentProviders: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/appointments/providers?${qs.toString()}`);
  },
  saveAppointmentProvider: (data: any) =>
    data.id
      ? apiClient.patch(`/admin/vcms/appointments/providers/${data.id}`, data)
      : apiClient.post('/admin/vcms/appointments/providers', data),
  updateProviderVisaMappings: (providerId: string, data: { visaTypeIds: string[]; visaPurposeIds: string[] }) =>
    apiClient.put(`/admin/vcms/appointments/providers/${providerId}/visa-mappings`, data),

  listAppointmentSchedules: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/appointments/schedules?${qs.toString()}`);
  },
  saveAppointmentSchedule: (data: any) =>
    data.id
      ? apiClient.patch(`/admin/vcms/appointments/schedules/${data.id}`, data)
      : apiClient.post('/admin/vcms/appointments/schedules', data),
  previewScheduleGeneration: (scheduleId: string, rule?: any) =>
    apiClient.post(`/admin/vcms/appointments/schedules/${scheduleId}/preview`, { rule }),
  generateScheduleSlots: (scheduleId: string) =>
    apiClient.post(`/admin/vcms/appointments/schedules/${scheduleId}/generate`, {}),
  publishSchedule: (scheduleId: string) =>
    apiClient.post(`/admin/vcms/appointments/schedules/${scheduleId}/publish`, {}),
  updateScheduleStatus: (scheduleId: string, status: 'CLOSED' | 'ARCHIVED') =>
    apiClient.post(`/admin/vcms/appointments/schedules/${scheduleId}/status`, { status }),

  getAppointmentCalendar: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/appointments/calendar?${qs.toString()}`);
  },
  listExcludedDates: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/appointments/excluded-dates?${qs.toString()}`);
  },
  createExcludedDate: (data: any) => apiClient.post('/admin/vcms/appointments/excluded-dates', data),
  deleteExcludedDate: (exceptionId: string) =>
    apiClient.delete(`/admin/vcms/appointments/excluded-dates/${exceptionId}`),

  createManualSlot: (data: any) => apiClient.post('/admin/vcms/appointments/slots/manual', data),
  updateSlot: (slotId: string, data: any) =>
    apiClient.patch(`/admin/vcms/appointments/slots/${slotId}`, data),
  deleteSlot: (slotId: string) => apiClient.delete(`/admin/vcms/appointments/slots/${slotId}`),

  listBookings: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/appointments/bookings?${qs.toString()}`);
  },
  updateBookingStatus: (appointmentId: string, data: { status: string; adminNotes?: string }) =>
    apiClient.patch(`/admin/vcms/appointments/bookings/${appointmentId}/status`, data),
  adminRescheduleBooking: (
    appointmentId: string,
    data: { newTimeSlotId: string; adminNotes?: string; sendNotification?: boolean }
  ) => apiClient.patch(`/admin/vcms/appointments/bookings/${appointmentId}/reschedule`, data),

  // 7. User Management
  listUsers: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/admin/vcms/users?${qs.toString()}`);
  },
  createUser: (data: any) => apiClient.post('/admin/vcms/users', data),
  updateUser: (userId: string, data: any) => apiClient.patch(`/admin/vcms/users/${userId}`, data),

  // 8. Public / Portal Endpoints
  getPublicCountries: () => apiClient.get('/vcms/countries'),
  getPublicPurposeFormSchema: (purposeId: string, answersByQuestionCode: Record<string, any> = {}, applicantCountryCode = 'AZ') =>
    apiClient.post(`/vcms/purposes/${purposeId}/form-schema?applicantCountryCode=${applicantCountryCode}`, {
      answersByQuestionCode,
    }),
  getCustomerPublishedSlots: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient.get(`/vcms/available-slots?${qs.toString()}`);
  },
  getApplicantAnswers: (dossierId: string, applicantId: string) =>
    apiClient.get(`/vcms/dossiers/${dossierId}/applicants/${applicantId}/answers`),
  saveApplicantAnswers: (dossierId: string, applicantId: string, answers: any[]) =>
    apiClient.put(`/vcms/dossiers/${dossierId}/applicants/${applicantId}/answers`, { answers }),
  getMyAppointmentNotifications: () => apiClient.get('/vcms/my-appointment-notifications'),
  markAppointmentNotificationRead: (notificationId: string) =>
    apiClient.patch(`/vcms/my-appointment-notifications/${notificationId}/read`, {}),
};
