import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- AUTH & PROFILE SELECTION ---
import SelectProfile from '@/modules/auth/pages/SelectProfile';
import AuthPage from '@/modules/auth/pages/AuthPage';

// --- INDIVIDUAL (CLIENT) WIZARD & PORTAL ---
import IndividualWizard from '@/modules/client/wizard/ClientWizard';
import ClientLayout from '@/layouts/ClientLayout/ClientLayout';
import ClientDashboard from '@/modules/client/pages/Dashboard/ClientDashboard';
import ClientDocuments from '@/modules/client/pages/Documents/ClientDocuments';
import ClientApplication from '@/modules/client/pages/Application/ClientApplication';
import ClientAppointment from '@/modules/client/pages/Appointment/ClientAppointment';
import ClientServices from '@/modules/client/pages/Services/ClientServices';
import ClientTracking from '@/modules/client/pages/Tracking/ClientTracking';
import ClientPrivacy from '@/modules/client/pages/Privacy/ClientPrivacy';

// --- AGENT PORTAL ---
import AgentLayout from '@/layouts/AgentLayout/AgentLayout';
import AgentDashboard from '@/modules/agent/pages/Dashboard/AgentDashboard';
import AgentGroups from '@/modules/agent/pages/Groups/AgentGroups';
import AgentFinance from '@/modules/agent/pages/Finance/AgentFinance';
import AgentAppointments from '@/modules/agent/pages/Appointments/AgentAppointments';
import AgentWizard from '@/modules/agent/wizard/AgentWizard';

// --- CORPORATE PORTAL ---
import CorporateLayout from '@/layouts/CorporateLayout/CorporateLayout';
import CorporateDashboard from '@/modules/corporate/pages/Dashboard/CorporateDashboard';
import CorporateBatches from '@/modules/corporate/pages/Batches/CorporateBatches';
import CorporateEmployees from '@/modules/corporate/pages/Employees/CorporateEmployees';
import CorporateAppointments from '@/modules/corporate/pages/Appointments/CorporateAppointments';
import CorporateFinance from '@/modules/corporate/pages/Finance/CorporateFinance';
import CorporateWizard from '@/modules/corporate/wizard/CorporateWizard';
import CorporateDelegation from '@/modules/corporate/pages/Delegation/CorporateDelegation';

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

        {/* --- INDIVIDUAL APPLICATION WIZARD --- */}
        <Route
          path="/individual/wizard"
          element={
            <ProtectedRoute allowedRoles={['INDIVIDUAL', 'ADMIN']} redirectPath="/login/individual">
              <IndividualWizard />
            </ProtectedRoute>
          }
        />

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
          <Route path="appointment" element={<ClientAppointment />} />
          <Route path="services" element={<ClientServices />} />
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
          <Route path="finance" element={<AgentFinance />} />
          <Route path="appointments" element={<AgentAppointments />} />
        </Route>

        {/* --- AGENT GROUP CREATION WIZARD --- */}
        <Route
          path="/agent/create-group"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'AGENT_TUR_OPERATOR', 'ADMIN']} redirectPath="/login/agent">
              <AgentWizard />
            </ProtectedRoute>
          }
        />

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
          <Route path="employees" element={<CorporateEmployees />} />
          <Route path="appointments" element={<CorporateAppointments />} />
          <Route path="finance" element={<CorporateFinance />} />
        </Route>

        <Route
          path="/corporate/create-batch"
          element={
            <ProtectedRoute allowedRoles={['CORPORATE', 'CORPORATE_HR', 'ADMIN']} redirectPath="/login/corporate">
              <CorporateWizard />
            </ProtectedRoute>
          }
        />

        {/* --- PUBLIC CORPORATE GUEST DELEGATION FORM --- */}
        <Route path="/corporate/delegation" element={<CorporateDelegation />} />

        {/* --- FALLBACK ROUTE --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
