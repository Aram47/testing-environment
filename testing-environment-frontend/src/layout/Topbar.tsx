import { LogOut } from 'lucide-react';
import { useAuth } from '../features/auth/authContext';
import { Button } from '../components/ui/Button';

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur md:px-8">
      <p className="text-sm text-muted">
        Workspace <span className="font-semibold text-ink">{user?.company?.name ?? 'Company'}</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">{user?.email}</span>
        <Button variant="ghost" onClick={logout} aria-label="Logout">
          <LogOut aria-hidden="true" size={18} />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
