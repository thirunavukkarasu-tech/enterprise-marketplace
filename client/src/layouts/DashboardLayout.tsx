import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { type LucideIcon, LogOut } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Badge } from '../components/ui/Badge';
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore';
import { logoutUser } from '../features/auth/authSlice';
import { cn } from '../utils/cn';

export interface DashboardNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  navItems: DashboardNavItem[];
  roleLabel: string;
  roleTone?: 'indigo' | 'marigold' | 'emerald' | 'coral' | 'neutral';
}

/**
 * One layout, parameterized by nav items and role label, powers both the
 * Admin and Vendor dashboards. Duplicating this shell per role would
 * drift out of sync fast; the sidebar contents are the only thing that
 * differs between the two roles.
 */
export function DashboardLayout({ navItems, roleLabel, roleTone = 'indigo' }: DashboardLayoutProps) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-canvas-raised">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <Logo />
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <Badge tone={roleTone}>{roleLabel}</Badge>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === navItems[0].to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink',
                    isActive && 'bg-indigo-50 text-indigo-700'
                  )
                }
              >
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <p className="truncate px-1 text-sm font-medium text-ink">{user?.name}</p>
          <p className="truncate px-1 text-xs text-slate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-coral-600"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
