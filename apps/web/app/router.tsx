import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { RequireAuth } from './RequireAuth';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const OnboardingPage = lazy(() => import('@/features/auth/OnboardingPage'));
const ForgotPasswordPage = lazy(() => import('@/features/misc/ForgotPasswordPage'));
const LegalPage = lazy(() => import('@/features/misc/LegalPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ClientsPage = lazy(() => import('@/features/clients/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/features/clients/ClientDetailPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const TeamPage = lazy(() => import('@/features/team/TeamPage'));
const HubPage = lazy(() => import('@/features/team/WorkloadPage'));
const TimePage = lazy(() => import('@/features/time-tracking/TimePage'));
const EstimatesPage = lazy(() => import('@/features/estimates/EstimatesPage'));
const EstimateDetailPage = lazy(() => import('@/features/estimates/EstimateDetailPage'));
const ContractsPage = lazy(() => import('@/features/contracts/ContractsPage'));
const InvoicesPage = lazy(() => import('@/features/invoices/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/InvoiceDetailPage'));
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'));
const FinancePage = lazy(() => import('@/features/finance/FinancePage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const FilesPage = lazy(() => import('@/features/files/FilesPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const ServicesPage = lazy(() => import('@/features/services/ServicesPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('@/features/misc/NotFoundPage'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/legal/:doc', element: <LegalPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/:id', element: <ClientDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'hub', element: <HubPage /> },
      { path: 'workload', element: <HubPage /> },
      { path: 'time', element: <TimePage /> },
      { path: 'estimates', element: <EstimatesPage /> },
      { path: 'estimates/:id', element: <EstimateDetailPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'finance', element: <FinancePage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
