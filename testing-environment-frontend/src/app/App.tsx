import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '../layout/DashboardLayout';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { LoginForm, RegisterForm } from '../forms/AuthForms';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardPage } from '../pages/DashboardPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { CreateProjectPage } from '../pages/CreateProjectPage';
import { EditProjectPage } from '../pages/EditProjectPage';
import { ProjectDetailsPage } from '../pages/ProjectDetailsPage';
import { TestSuitesPage } from '../pages/TestSuitesPage';
import { TestRunsPage } from '../pages/TestRunsPage';
import { CompanySettingsPage } from '../pages/CompanySettingsPage';
import { SubscriptionPage } from '../pages/SubscriptionPage';
import { TeamPage } from '../pages/TeamPage';
import { ApiTokensPage } from '../pages/ApiTokensPage';
import { AuditPage } from '../pages/AuditPage';
import { OnboardingPage } from '../pages/OnboardingPage';

const EnvironmentPage = lazy(() =>
  import('../pages/EnvironmentPage').then((module) => ({ default: module.EnvironmentPage })),
);
const TestSuiteEditorPage = lazy(() =>
  import('../pages/TestSuiteEditorPage').then((module) => ({ default: module.TestSuiteEditorPage })),
);
const TestRunDetailPage = lazy(() =>
  import('../pages/TestRunDetailPage').then((module) => ({ default: module.TestRunDetailPage })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading page" />}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<CreateProjectPage />} />
          <Route path="/projects/:projectId/edit" element={<EditProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="/projects/:projectId/environment" element={<LazyPage><EnvironmentPage /></LazyPage>} />
          <Route path="/projects/:projectId/test-suites" element={<TestSuitesPage />} />
          <Route path="/projects/:projectId/test-suites/new" element={<LazyPage><TestSuiteEditorPage mode="new" /></LazyPage>} />
          <Route path="/projects/:projectId/test-suites/:suiteId" element={<LazyPage><TestSuiteEditorPage mode="edit" /></LazyPage>} />
          <Route path="/projects/:projectId/runs" element={<TestRunsPage />} />
          <Route path="/projects/:projectId/runs/:runId" element={<LazyPage><TestRunDetailPage /></LazyPage>} />
          <Route path="/settings/company" element={<CompanySettingsPage />} />
          <Route path="/settings/subscription" element={<SubscriptionPage />} />
          <Route path="/settings/team" element={<TeamPage />} />
          <Route path="/settings/api-tokens" element={<ApiTokensPage />} />
          <Route path="/settings/audit" element={<AuditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
