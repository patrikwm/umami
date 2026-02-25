import type { Auth } from '@/lib/types';

export async function canViewAuditLogs({ user }: Auth) {
  return user.isAdmin;
}
