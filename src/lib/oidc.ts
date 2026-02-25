import { randomUUID } from 'node:crypto';
import { ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';

/**
 * Configuration for role group mapping
 */
interface RoleGroupConfig {
  adminGroup?: string | null;
  viewOnlyGroup?: string | null;
}

/**
 * Map OIDC claims to Umami user role
 * Priority: admin > view-only > user (default)
 * Only applies to OIDC providers that send a `groups` claim
 * OAuth2 providers (GitHub, Discord) always default to ROLES.user
 *
 * @param profile - OIDC profile with claims (sub, email, name, groups, etc.)
 * @param config - Provider config with adminGroup and viewOnlyGroup
 * @returns Umami role string ('admin', 'view-only', or 'user')
 */
export function mapClaimsToRole(profile: Record<string, any>, config: RoleGroupConfig): string {
  const groups: string[] = profile.groups ?? [];

  if (config.adminGroup && groups.includes(config.adminGroup)) return ROLES.admin;
  if (config.viewOnlyGroup && groups.includes(config.viewOnlyGroup)) return ROLES.viewOnly;
  return ROLES.user; // safe default
}

/**
 * Sync team membership based on OIDC groups claim
 * Adds memberships for groups in the claim, removes stale OIDC-managed memberships
 * Protects manually-assigned team memberships (source: 'manual')
 *
 * @param userId - Umami user ID
 * @param profile - OIDC profile with groups claim
 * @param teamMappings - JSON object mapping IdP group names to Umami team IDs
 */
export async function syncTeamMembership(
  userId: string,
  profile: Record<string, any>,
  teamMappings: Record<string, string> | null | undefined,
) {
  if (!teamMappings) return;

  const groups: string[] = profile.groups ?? [];

  // Map IdP groups → target Umami team IDs
  const targetTeamIds = new Set(groups.map(g => teamMappings[g]).filter(Boolean));

  // Get current OIDC-managed memberships for this user
  const currentOidcMemberships = await prisma.client.teamUser.findMany({
    where: { userId, source: 'oidc' },
  });

  // Add new memberships
  for (const teamId of targetTeamIds) {
    const exists = currentOidcMemberships.some(m => m.teamId === teamId);
    if (!exists) {
      await prisma.client.teamUser.create({
        data: {
          id: randomUUID(),
          teamId,
          userId,
          role: ROLES.teamMember,
          source: 'oidc',
        },
      });
    }
  }

  // Remove stale OIDC-managed memberships (not in current groups claim)
  const toRemove = currentOidcMemberships.filter(m => !targetTeamIds.has(m.teamId));
  for (const membership of toRemove) {
    await prisma.client.teamUser.delete({
      where: { id: membership.id },
    });
  }
}

/**
 * Generate a unique username for JIT provisioning
 * Uses preferred_username from profile if available,
 * falls back to email prefix, appends random suffix on collision
 *
 * @param profile - OIDC profile with preferred_username or email
 * @param email - Email address
 * @returns Unique username
 */
export async function generateUniqueUsername(
  profile: Record<string, any> | null | undefined,
  email: string | null | undefined,
): Promise<string> {
  const base = profile?.preferred_username || email?.split('@')[0] || 'user';
  let username = base;

  // Check for collision, append suffix if needed
  const existing = await prisma.client.user.findUnique({ where: { username } });
  if (existing) {
    username = `${base}_${randomUUID().slice(0, 6)}`;
  }

  return username;
}
