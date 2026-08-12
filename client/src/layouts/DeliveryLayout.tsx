import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Package, MapPin, History, LogOut } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { useAppDispatch } from '../hooks/useAppStore';
import { logoutUser } from '../features/auth/authSlice';
import { cn } from '../utils/cn';

const tabs = [
  { to: '/delivery', label: 'Active', icon: Package, end: true },
  { to: '/delivery/tracking', label: 'Tracking', icon: MapPin },
  { to: '/delivery/history', label: 'History', icon: History },
];

/**
 * Delivery partners work from a phone in the field, not a desktop — so
 * this shell is a top bar plus a bottom tab strip rather than a sidebar,
 * and it's built mobile-first (the sidebar dashboards are desktop-first).
 */
export function DeliveryLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-canvas-raised px-4">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-mono text-xs font-medium text-emerald-600">
            ON DUTY
          </span>
          <button onClick={handleLogout} aria-label="Sign out" className="text-slate hover:text-coral-600">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-16">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-slate-200 bg-canvas-raised">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-slate',
                  isActive && 'text-indigo-600'
                )
              }
            >
              <Icon size={19} />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
