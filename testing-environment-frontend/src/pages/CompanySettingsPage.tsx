import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../features/auth/authContext';

export function CompanySettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader title="Company settings" description="Workspace identity from the authenticated Nest.js API session." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Company" value={user?.company?.name ?? 'Not loaded'} />
        <StatCard label="User" value={user?.name ?? user?.email ?? 'Not loaded'} />
        <StatCard label="Plan" value={user?.company?.plan.tier ?? 'Unknown'} />
      </div>
    </>
  );
}
