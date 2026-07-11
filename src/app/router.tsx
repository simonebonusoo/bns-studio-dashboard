import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { RequireAuth } from './RequireAuth';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/misc/ForgotPasswordPage'));
const LegalPage = lazy(() => import('@/features/misc/LegalPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ClientsPage = lazy(() => import('@/features/clients/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/features/clients/ClientDetailPage'));
const PipelinePage = lazy(() => import('@/features/leads/PipelinePage'));
const LeadsPage = lazy(() => import('@/features/leads/LeadsPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ProjectDetailPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const TeamPage = lazy(() => import('@/features/team/TeamPage'));
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
const ServicesPage = lazy(() => import('@/features/services/ServicesPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const NotFoundPage = lazy(() => import('@/features/misc/NotFoundPage'));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
      { path: 'pipeline', element: <PipelinePage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'team', element: <TeamPage /> },
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
      { path: 'services', element: <ServicesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
