import type { Auth } from '@/lib/types';

export async function canCreateOidcProvider({ user }: Auth) {
  return user.isAdmin;
}

export async function canViewOidcProvider({ user }: Auth) {
  return user.isAdmin;
}

export async function canViewOidcProviders({ user }: Auth) {
  return user.isAdmin;
}

export async function canUpdateOidcProvider({ user }: Auth) {
  return user.isAdmin;
}

export async function canDeleteOidcProvider({ user }: Auth) {
  return user.isAdmin;
}
