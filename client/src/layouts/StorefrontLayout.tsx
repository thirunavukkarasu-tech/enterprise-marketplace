import { Outlet, Link, NavLink } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';

const navLinks = [
  { to: '/', label: 'Shop' },
  { to: '/categories', label: 'Categories' },
  { to: '/vendors', label: 'Vendors' },
];

export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-canvas-raised/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="MarketSphere home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium text-ink-soft transition-colors hover:text-ink',
                    isActive && 'text-ink'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button variant="primary" size="sm">
              Create account
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-canvas-raised">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate">
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div>
              <Logo />
              <p className="mt-2 max-w-xs text-slate">
                A marketplace built for independent sellers and the customers who find them.
              </p>
            </div>
            <div className="flex gap-12">
              <div>
                <p className="mb-2 font-medium text-ink-soft">Company</p>
                <ul className="space-y-1">
                  <li>About</li>
                  <li>Careers</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium text-ink-soft">Sell</p>
                <ul className="space-y-1">
                  <li>Become a vendor</li>
                  <li>Vendor guidelines</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-slate-200 pt-6">© {new Date().getFullYear()} MarketSphere.</p>
        </div>
      </footer>
    </div>
  );
}
