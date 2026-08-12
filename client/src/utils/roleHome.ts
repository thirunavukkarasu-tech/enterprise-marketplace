import type { Role } from '../types/role';

/** Where to send a user immediately after authenticating, based on role. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'vendor':
      return '/vendor';
    case 'delivery_partner':
      return '/delivery';
    case 'customer':
    default:
      return '/';
  }
}
