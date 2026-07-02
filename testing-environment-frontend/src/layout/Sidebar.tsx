import { BarChart3, CreditCard, FolderKanban, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/settings/company', label: 'Company', icon: Settings },
  { to: '/settings/subscription', label: 'Subscription', icon: CreditCard },
];

export function Sidebar() {
  return (
    <aside className="border-b border-border bg-surface md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center px-5">
        <span className="text-base font-bold text-ink">Backend Test Runner</span>
      </div>
      <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `focus-ring flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                isActive ? 'bg-blue-50 text-brand' : 'text-muted hover:bg-page hover:text-ink'
              }`
            }
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
