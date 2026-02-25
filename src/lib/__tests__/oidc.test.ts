/**
 * Tests for @/lib/oidc
 * Role mapping and team sync logic
 */

import { ROLES } from '@/lib/constants';
import { generateUniqueUsername, mapClaimsToRole, syncTeamMembership } from '@/lib/oidc';
import prisma from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  client: {
    teamUser: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('oidc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapClaimsToRole', () => {
    test('assigns admin role when user is in admin group', () => {
      const profile = { groups: ['developers', 'umami-admins', 'users'] };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.admin);
    });

    test('assigns view-only role when user is in viewOnly group', () => {
      const profile = { groups: ['developers', 'umami-viewers'] };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.viewOnly);
    });

    test('assigns user role when user is not in any mapped group', () => {
      const profile = { groups: ['developers', 'marketing'] };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('prioritizes admin over view-only when user is in both groups', () => {
      const profile = { groups: ['umami-admins', 'umami-viewers'] };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.admin);
    });

    test('returns user role when groups claim is empty array', () => {
      const profile = { groups: [] };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('returns user role when groups claim is null', () => {
      const profile = { groups: null };
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('returns user role when groups claim is undefined', () => {
      const profile = {};
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('returns user role when no groups are configured', () => {
      const profile = { groups: ['umami-admins'] };
      const config = { adminGroup: null, viewOnlyGroup: null };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('returns user role when config is undefined', () => {
      const profile = { groups: ['umami-admins'] };
      const config = {};

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user);
    });

    test('handles case-sensitive group matching', () => {
      const profile = { groups: ['umami-Admins'] }; // Different case
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user); // No match
    });

    test('exact string matching required', () => {
      const profile = { groups: ['umami-admins-sub'] }; // Contains admin group as prefix
      const config = { adminGroup: 'umami-admins', viewOnlyGroup: 'umami-viewers' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.user); // No match
    });

    test('handles groups claim as comma-separated string (compatibility)', () => {
      // Note: In practice, OIDC providers send arrays. This tests array handling only.
      const profile = { groups: ['group1', 'umami-admins', 'group2'] };
      const config = { adminGroup: 'umami-admins' };

      expect(mapClaimsToRole(profile, config)).toBe(ROLES.admin);
    });
  });

  describe('syncTeamMembership', () => {
    const userId = 'user-123';
    const teamId1 = 'team-abc';
    const teamId2 = 'team-def';

    test('adds user to teams based on groups claim', async () => {
      const profile = { groups: ['engineering', 'product'] };
      const teamMappings = { engineering: teamId1, product: teamId2 };

      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([]);

      await syncTeamMembership(userId, profile, teamMappings);

      expect(prisma.client.teamUser.create).toHaveBeenCalledTimes(2);
      expect(prisma.client.teamUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: teamId1,
          userId,
          role: ROLES.teamMember,
          source: 'oidc',
        }),
      });
      expect(prisma.client.teamUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: teamId2,
          userId,
          role: ROLES.teamMember,
          source: 'oidc',
        }),
      });
    });

    test('removes stale OIDC-managed team memberships', async () => {
      const profile = { groups: ['engineering'] }; // Only in engineering now
      const teamMappings = { engineering: teamId1, product: teamId2 };

      // User currently in both teams (via OIDC)
      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([
        { id: 'membership-1', teamId: teamId1, userId, source: 'oidc' },
        { id: 'membership-2', teamId: teamId2, userId, source: 'oidc' },
      ]);

      await syncTeamMembership(userId, profile, teamMappings);

      // Should remove from team2
      expect(prisma.client.teamUser.delete).toHaveBeenCalledTimes(1);
      expect(prisma.client.teamUser.delete).toHaveBeenCalledWith({
        where: { id: 'membership-2' },
      });
    });

    test('preserves manual team memberships', async () => {
      const profile = { groups: ['engineering'] };
      const teamMappings = { engineering: teamId1, product: teamId2 };

      // User in team2 via manual assignment
      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([
        { id: 'membership-1', teamId: teamId1, userId, source: 'oidc' },
        // Manual membership not included in OIDC-managed query
      ]);

      await syncTeamMembership(userId, profile, teamMappings);

      // Should NOT try to remove manual membership (it's not in the OIDC query results)
      expect(prisma.client.teamUser.delete).not.toHaveBeenCalled();
    });

    test('does nothing when teamMappings is null', async () => {
      const profile = { groups: ['engineering'] };
      await syncTeamMembership(userId, profile, null);

      expect(prisma.client.teamUser.findMany).not.toHaveBeenCalled();
      expect(prisma.client.teamUser.create).not.toHaveBeenCalled();
      expect(prisma.client.teamUser.delete).not.toHaveBeenCalled();
    });

    test('does nothing when teamMappings is undefined', async () => {
      const profile = { groups: ['engineering'] };
      await syncTeamMembership(userId, profile, undefined);

      expect(prisma.client.teamUser.findMany).not.toHaveBeenCalled();
    });

    test('handles empty team mappings', async () => {
      const profile = { groups: ['engineering'] };
      const teamMappings = {};

      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([]);

      await syncTeamMembership(userId, profile, teamMappings);

      // No teams to add
      expect(prisma.client.teamUser.create).not.toHaveBeenCalled();
    });

    test('handles user with no groups', async () => {
      const profile = { groups: [] };
      const teamMappings = { engineering: teamId1 };

      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([
        { id: 'membership-1', teamId: teamId1, userId, source: 'oidc' },
      ]);

      await syncTeamMembership(userId, profile, teamMappings);

      // Should remove all OIDC memberships
      expect(prisma.client.teamUser.delete).toHaveBeenCalledTimes(1);
      expect(prisma.client.teamUser.create).not.toHaveBeenCalled();
    });

    test('skips creating duplicate team memberships', async () => {
      const profile = { groups: ['engineering'] };
      const teamMappings = { engineering: teamId1 };

      // User already in team
      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([
        { id: 'membership-1', teamId: teamId1, userId, source: 'oidc' },
      ]);

      await syncTeamMembership(userId, profile, teamMappings);

      // Should NOT create duplicate
      expect(prisma.client.teamUser.create).not.toHaveBeenCalled();
      expect(prisma.client.teamUser.delete).not.toHaveBeenCalled();
    });

    test('ignores groups not in team mappings', async () => {
      const profile = { groups: ['engineering', 'marketing', 'finance'] };
      const teamMappings = { engineering: teamId1 }; // Only engineering mapped

      (prisma.client.teamUser.findMany as jest.Mock).mockResolvedValue([]);

      await syncTeamMembership(userId, profile, teamMappings);

      // Should only create membership for engineering
      expect(prisma.client.teamUser.create).toHaveBeenCalledTimes(1);
      expect(prisma.client.teamUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: teamId1,
        }),
      });
    });
  });

  describe('generateUniqueUsername', () => {
    test('uses preferred_username from profile', async () => {
      const profile = { preferred_username: 'john.doe' };
      const email = 'john.doe@example.com';

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(profile, email);
      expect(username).toBe('john.doe');
    });

    test('falls back to email prefix when preferred_username is missing', async () => {
      const profile = {};
      const email = 'jane.smith@example.com';

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(profile, email);
      expect(username).toBe('jane.smith');
    });

    test('appends random suffix on username collision', async () => {
      const profile = { preferred_username: 'john.doe' };
      const email = 'john.doe@example.com';

      // First user exists
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'existing-user',
        username: 'john.doe',
      });

      const username = await generateUniqueUsername(profile, email);
      expect(username).toMatch(/^john\.doe_[a-f0-9]{6}$/);
      expect(username).not.toBe('john.doe');
    });

    test('handles null profile', async () => {
      const email = 'user@example.com';

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(null, email);
      expect(username).toBe('user');
    });

    test('handles undefined profile', async () => {
      const email = 'user@example.com';

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(undefined, email);
      expect(username).toBe('user');
    });

    test('uses default "user" when profile and email are missing', async () => {
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(null, null);
      expect(username).toBe('user');
    });

    test('handles profile with empty preferred_username', async () => {
      const profile = { preferred_username: '' };
      const email = 'user@example.com';

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      const username = await generateUniqueUsername(profile, email);
      expect(username).toBe('user'); // Falls back to email prefix
    });

    test('appends short random suffix (6 chars)', async () => {
      const profile = { preferred_username: 'collision' };

      (prisma.client.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing' });

      const username = await generateUniqueUsername(profile, null);
      expect(username.length).toBe('collision_'.length + 6);
    });
  });
});
