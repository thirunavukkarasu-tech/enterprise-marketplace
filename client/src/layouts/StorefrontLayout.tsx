import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Heart, UserCircle, ShoppingCart } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Button } from '../components/ui/Button';
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore';
import { logoutUser } from '../features/auth/authSlice';
import { homePathForRole } from '../utils/roleHome';
import { cn } from '../utils/cn';

const navLinks = [
  { to: '/', label: 'Shop' },
  { to: '/categories', label: 'Categories' },
  { to: '/vendors', label: 'Vendors' },
];

export function StorefrontLayout() {
  const { user, status } = useAppSelector((state) => state.auth);
  const wishlistCount = useAppSelector((state) => state.wishlist.productIds.length);
  const cartCount = useAppSelector((state) => state.cart.cart?.itemCount ?? 0);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/');
  };

  const dashboardPath = user ? homePathForRole(user.role) : null;

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
                end={link.to === '/'}
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
            {status === 'authenticated' && user ? (
              <>
                {user.role === 'customer' && (
                  <Link to="/wishlist" className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100" aria-label="Wishlist">
                    <Heart size={18} />
                    {wishlistCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 font-mono text-[10px] text-white">
                        {wishlistCount}
                      </span>
                    )}
                  </Link>
                )}
                {user.role === 'customer' && (
                  <Link to="/cart" className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-slate-100" aria-label="Cart">
                    <ShoppingCart size={18} />
                    {cartCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 font-mono text-[10px] text-white">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                )}
                {dashboardPath && dashboardPath !== '/' && (
                  <Link to={dashboardPath}>
                    <Button variant="ghost" size="sm">
                      <LayoutDashboard size={15} /> Dashboard
                    </Button>
                  </Link>
                )}
                <Link to="/account" className="hidden items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink sm:flex">
                  <UserCircle size={16} />
                  {user.name.split(' ')[0]}
                </Link>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  <LogOut size={15} /> Sign out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Create account
                  </Button>
                </Link>
              </>
            )}
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
