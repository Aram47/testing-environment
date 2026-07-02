import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/authContext';
import { Button } from '../components/ui/Button';
import { useTheme } from '../features/theme/themeContext';

export function Topbar() {
  const { user, logout } = useAuth();
  const { preference, resolvedTheme, cyclePreference } = useTheme();
  const ThemeIcon = preference === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const label = preference === 'system' ? 'Theme: system' : resolvedTheme === 'dark' ? 'Theme: dark' : 'Theme: light';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur md:px-8">
      <p className="text-sm text-muted">
        Workspace <span className="font-semibold text-ink">{user?.company?.name ?? 'Company'}</span>
      </p>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">{user?.email}</span>
        <Button variant="ghost" onClick={cyclePreference} aria-label={label} title={label}>
          <ThemeIcon aria-hidden="true" size={18} />
          <span className="hidden sm:inline">{preference === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light'}</span>
        </Button>
        <Button variant="ghost" onClick={logout} aria-label="Logout">
          <LogOut aria-hidden="true" size={18} />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
