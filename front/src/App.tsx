import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- AUTH & PROFILE SELECTION ---
import SelectProfile from '@/modules/auth/pages/SelectProfile';
import AuthPage from '@/modules/auth/pages/AuthPage';

// --- UNIFIED APPLICATION WIZARD (ALL PORTALS) ---
import UnifiedWizard from '@/modules/wizard/UnifiedWizard';
import ClientLayout from '@/layouts/ClientLayout/ClientLayout';
import ClientDashboard from '@/modules/client/pages/Dashboard/ClientDashboard';
import ClientDocuments from '@/modules/client/pages/Documents/ClientDocuments';
import ClientApplication from '@/modules/client/pages/Application/ClientApplication';
import ClientAppointment from '@/modules/client/pages/Appointment/ClientAppointment';
import ClientServices from '@/modules/client/pages/Services/ClientServices';
import ClientTracking from '@/modules/client/pages/Tracking/ClientTracking';
import ClientPrivacy from '@/modules/client/pages/Privacy/ClientPrivacy';
import ClientWallet from '@/modules/client/pages/Wallet/ClientWallet';

// --- AGENT PORTAL ---
import AgentLayout from '@/layouts/AgentLayout/AgentLayout';
import AgentDashboard from '@/modules/agent/pages/Dashboard/AgentDashboard';
import AgentGroups from '@/modules/agent/pages/Groups/AgentGroups';
import AgentFinance from '@/modules/agent/pages/Finance/AgentFinance';
import AgentAppointments from '@/modules/agent/pages/Appointments/AgentAppointments';
import AgentApplicantFill from '@/modules/agent/pages/ApplicantFill/AgentApplicantFill';

// --- CORPORATE PORTAL ---
import CorporateLayout from '@/layouts/CorporateLayout/CorporateLayout';
import CorporateDashboard from '@/modules/corporate/pages/Dashboard/CorporateDashboard';
import CorporateBatches from '@/modules/corporate/pages/Batches/CorporateBatches';
import CorporateEmployees from '@/modules/corporate/pages/Employees/CorporateEmployees';
import CorporateAppointments from '@/modules/corporate/pages/Appointments/CorporateAppointments';
import CorporateFinance from '@/modules/corporate/pages/Finance/CorporateFinance';
import CorporateDelegation from '@/modules/corporate/pages/Delegation/CorporateDelegation';

// --- UNIVERSAL APPLICANT APPLICATION WORKSPACE (ALL PORTALS) ---
import UnifiedApplicantWorkspace from '@/modules/applicant/pages/UnifiedApplicantWorkspace';
import DynamicApplicantRedirect from '@/modules/applicant/pages/DynamicApplicantRedirect';

// --- ADMIN & CONSULAR PORTAL ---
import AdminLayout from '@/layouts/AdminLayout/AdminLayout';
import AdminDashboard from '@/modules/admin/pages/Dashboard/AdminDashboard';
import AdminDossierList from '@/modules/admin/pages/Dossiers/AdminDossierList';
import AdminDossierDetail from '@/modules/admin/pages/Dossiers/AdminDossierDetail';
import AdminAuditLogs from '@/modules/admin/pages/AuditLogs/AdminAuditLogs';
import AdminSettings from '@/modules/admin/pages/Settings/AdminSettings';
import AdminFinancials from '@/modules/admin/pages/Financials/AdminFinancials';

import PasswordActionPage from '@/modules/auth/pages/PasswordActionPage';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- SELECTION & AUTH --- */}
        <Route path="/" element={<SelectProfile />} />

        <Route path="/login/individual" element={<AuthPage type="individual" />} />
        <Route path="/login/agent" element={<AuthPage type="agent" />} />
        <Route path="/login/corporate" element={<AuthPage type="corporate" />} />
        <Route path="/login/admin" element={<AuthPage type="admin" />} />
        <Route path="/admin/login" element={<Navigate to="/login/admin" replace />} />
        <Route path="/admin-login" element={<Navigate to="/login/admin" replace />} />
        <Route path="/set-password" element={<PasswordActionPage action="set" />} />
        <Route path="/reset-password" element={<PasswordActionPage action="reset" />} />

        {/* --- UNIFIED APPLICATION WIZARD (INDIVIDUAL) --- */}
        <Route
          path="/individual/wizard"
          element={
            <ProtectedRoute allowedRoles={['INDIVIDUAL', 'ADMIN']} redirectPath="/login/individual">
              <UnifiedWizard portalType="INDIVIDUAL" />
            </ProtectedRoute>
          }
        />
        <Route path="/client/wizard" element={<Navigate to="/individual/wizard" replace />} />

        {/* --- CLIENT PORTAL ROUTES --- */}
        <Route
          path="/client"
          element={
            <ProtectedRoute allowedRoles={['INDIVIDUAL', 'ADMIN']} redirectPath="/login/individual">
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientDashboard />} />
          <Route path="documents" element={<ClientDocuments />} />
          <Route path="application" element={<ClientApplication />} />
          <Route path="application/:dossierId" element={<UnifiedApplicantWorkspace />} />
          <Route path="application/:dossierId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="appointment" element={<ClientAppointment />} />
          <Route path="services" element={<ClientServices />} />
          <Route path="wallet" element={<ClientWallet />} />
          <Route path="tracking" element={<ClientTracking />} />
          <Route path="privacy" element={<ClientPrivacy />} />
        </Route>

        {/* --- AGENT PORTAL ROUTES --- */}
        <Route
          path="/agent"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'AGENT_TUR_OPERATOR', 'ADMIN']} redirectPath="/login/agent">
              <AgentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AgentDashboard />} />
          <Route path="groups" element={<AgentGroups />} />
          <Route path="application" element={<ClientApplication />} />
          <Route path="application/:dossierId" element={<UnifiedApplicantWorkspace />} />
          <Route path="application/:dossierId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="groups/:groupId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="finance" element={<AgentFinance />} />
          <Route path="appointments" element={<AgentAppointments />} />
        </Route>

        {/* --- UNIFIED AGENT GROUP CREATION WIZARD --- */}
        <Route
          path="/agent/create-group"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'AGENT_TUR_OPERATOR', 'ADMIN']} redirectPath="/login/agent">
              <UnifiedWizard portalType="GROUP_AGENT" />
            </ProtectedRoute>
          }
        />

        {/* --- PUBLIC AGENT CUSTOMER SELF-FILL FORM --- */}
        <Route path="/agent/applicant-fill" element={<AgentApplicantFill />} />

        {/* --- CORPORATE PORTAL ROUTES --- */}
        <Route
          path="/corporate"
          element={
            <ProtectedRoute allowedRoles={['CORPORATE', 'CORPORATE_HR', 'ADMIN']} redirectPath="/login/corporate">
              <CorporateLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CorporateDashboard />} />
          <Route path="batches" element={<CorporateBatches />} />
          <Route path="application" element={<ClientApplication />} />
          <Route path="application/:dossierId" element={<UnifiedApplicantWorkspace />} />
          <Route path="application/:dossierId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="batches/:batchId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="employees" element={<CorporateEmployees />} />
          <Route path="appointments" element={<CorporateAppointments />} />
          <Route path="finance" element={<CorporateFinance />} />
        </Route>

        {/* --- UNIFIED CORPORATE BATCH CREATION WIZARD --- */}
        <Route
          path="/corporate/create-batch"
          element={
            <ProtectedRoute allowedRoles={['CORPORATE', 'CORPORATE_HR', 'ADMIN']} redirectPath="/login/corporate">
              <UnifiedWizard portalType="CORPORATE" />
            </ProtectedRoute>
          }
        />

        {/* --- PUBLIC CORPORATE GUEST DELEGATION FORM --- */}
        <Route path="/corporate/delegation" element={<CorporateDelegation />} />

        {/* --- CONSULAR & ADMIN PORTAL ROUTES --- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'OPERATOR', 'MANAGER']} redirectPath="/login/admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dossiers" element={<AdminDossierList />} />
          <Route path="dossiers/:id" element={<AdminDossierDetail />} />
          <Route path="dossiers/:dossierId/applicant/:applicantId" element={<UnifiedApplicantWorkspace />} />
          <Route path="financials" element={<AdminFinancials />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* --- UNIVERSAL APPLICANT APPLICATION WORKSPACE (FALLBACK & SMART REDIRECT) --- */}
        <Route
          path="/application/:dossierId/applicant/:applicantId"
          element={<DynamicApplicantRedirect />}
        />
        <Route
          path="/application/:dossierId"
          element={<DynamicApplicantRedirect />}
        />
        <Route
          path="/application"
          element={<DynamicApplicantRedirect />}
        />
        <Route path="/application/self-fill" element={<UnifiedApplicantWorkspace />} />

        {/* --- FALLBACK ROUTE --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
