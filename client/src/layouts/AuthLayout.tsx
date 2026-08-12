import { Outlet, Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Card, CardBody } from '../components/ui/Card';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center" aria-label="MarketSphere home">
          <Logo />
        </Link>
        <Card>
          <CardBody className="p-6">
            <Outlet />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
