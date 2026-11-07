/**
 * Agent Service (Unified Facade)
 *
 * Modular architecture facade delegating responsibilities to specialized sub-services:
 * - agentGroup.service.js: Group batch CRUD, submission, and validation
 * - agentTraveler.service.js: Applicant management and self-service portal
 * - agentFinance.service.js: Wallet, commissions, payouts, transactions, and invoice PDFs
 * - agentAppointment.service.js: Group appointment booking and scheduling
 */

const agentGroupService = require('./services/agentGroup.service');
const agentTravelerService = require('./services/agentTraveler.service');
const agentFinanceService = require('./services/agentFinance.service');
const agentAppointmentService = require('./services/agentAppointment.service');

module.exports = {
  ...agentGroupService,
  ...agentTravelerService,
  ...agentFinanceService,
  ...agentAppointmentService,
};
