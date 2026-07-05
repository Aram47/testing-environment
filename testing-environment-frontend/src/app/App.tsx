import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '../layout/DashboardLayout';
import { ProtectedRoute } from '../routes/ProtectedRoute';
import { LoginForm, RegisterForm } from '../forms/AuthForms';
import { DashboardPage } from '../pages/DashboardPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { CreateProjectPage } from '../pages/CreateProjectPage';
import { EditProjectPage } from '../pages/EditProjectPage';
import { ProjectDetailsPage } from '../pages/ProjectDetailsPage';
import { EnvironmentPage } from '../pages/EnvironmentPage';
import { TestSuitesPage } from '../pages/TestSuitesPage';
import { TestSuiteEditorPage } from '../pages/TestSuiteEditorPage';
import { TestRunsPage } from '../pages/TestRunsPage';
import { TestRunDetailPage } from '../pages/TestRunDetailPage';
import { CompanySettingsPage } from '../pages/CompanySettingsPage';
import { SubscriptionPage } from '../pages/SubscriptionPage';
import { OnboardingPage } from '../pages/OnboardingPage';

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
          <Route path="/projects/:projectId/environment" element={<EnvironmentPage />} />
          <Route path="/projects/:projectId/test-suites" element={<TestSuitesPage />} />
          <Route path="/projects/:projectId/test-suites/new" element={<TestSuiteEditorPage mode="new" />} />
          <Route path="/projects/:projectId/test-suites/:suiteId" element={<TestSuiteEditorPage mode="edit" />} />
          <Route path="/projects/:projectId/runs" element={<TestRunsPage />} />
          <Route path="/projects/:projectId/runs/:runId" element={<TestRunDetailPage />} />
          <Route path="/settings/company" element={<CompanySettingsPage />} />
          <Route path="/settings/subscription" element={<SubscriptionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
