import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <a className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3" href="#main">
        Skip to content
      </a>
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
