/**
 * EUROTECH Corporate Module - Service Facade / Barrel
 * Aggregates all focused corporate sub-services for 100% backward compatibility.
 */

const batchService = require('./services/corporateBatch.service');
const employeeService = require('./services/corporateEmployee.service');
const delegationService = require('./services/corporateDelegation.service');
const financeService = require('./services/corporateFinance.service');
const departmentService = require('./services/corporateDepartment.service');
const documentService = require('./services/corporateDocument.service');

module.exports = {
  // Batch lifecycle & employees in batch
  ...batchService,

  // Employee directory, CRUD & Passport Radar
  ...employeeService,

  // Delegation guest links & self-fill forms
  ...delegationService,

  // Finance, Proforma Invoices, Wallet & Payments
  ...financeService,

  // Cost centers, department budgets & analytics
  ...departmentService,

  // Dashboard metrics & Official Guarantee Letter PDF
  ...documentService,
};
