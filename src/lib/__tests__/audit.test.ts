/**
 * Tests for @/lib/audit
 * Audit logging for authentication events and admin actions
 */

import { getAuditLogs, logAuditEvent } from '@/lib/audit';
import prisma from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  client: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock console.error to suppress error output in tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('logAuditEvent', () => {
    test('creates audit log with all parameters', async () => {
      const params = {
        userId: 'user-123',
        action: 'user.login',
        resource: 'auth',
        metadata: { provider: 'oidc', issuer: 'https://idp.example.com' },
        ipAddress: '192.168.1.100',
      };

      await logAuditEvent(params);

      expect(prisma.client.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          metadata: { provider: 'oidc', issuer: 'https://idp.example.com' },
          ipAddress: '192.168.1.100',
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          ),
        }),
      });
    });

    test('creates audit log with only action (minimal)', async () => {
      await logAuditEvent({ action: 'website.create' });

      expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'website.create',
          userId: null,
          resource: null,
          metadata: null,
          ipAddress: null,
        }),
      });
    });

    test('handles null userId', async () => {
      await logAuditEvent({ action: 'public.access', userId: undefined });

      expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
        }),
      });
    });

    test('handles complex metadata object', async () => {
      const metadata = {
        oldValue: { role: 'user' },
        newValue: { role: 'admin' },
        changedBy: 'admin-user',
        reason: 'promotion',
      };

      await logAuditEvent({
        action: 'user.role-change',
        userId: 'user-123',
        metadata,
      });

      expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata,
        }),
      });
    });

    test('does not throw error when database fails (non-blocking)', async () => {
      (prisma.client.auditLog.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should NOT throw
      await expect(logAuditEvent({ action: 'test' })).resolves.toBeUndefined();
    });

    test('logs error to console when database fails', async () => {
      const dbError = new Error('Database connection failed');
      (prisma.client.auditLog.create as jest.Mock).mockRejectedValue(dbError);

      await logAuditEvent({ action: 'test' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to log audit event:', dbError);
    });

    test('generates unique UUID for each event', async () => {
      await logAuditEvent({ action: 'event1' });
      await logAuditEvent({ action: 'event2' });

      const call1 = (prisma.client.auditLog.create as jest.Mock).mock.calls[0][0];
      const call2 = (prisma.client.auditLog.create as jest.Mock).mock.calls[1][0];

      expect(call1.data.id).not.toBe(call2.data.id);
    });
  });

  describe('getAuditLogs', () => {
    test('retrieves logs with pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'user.login',
          createdAt: new Date(),
          user: { id: 'user-1', username: 'john', email: 'john@example.com' },
        },
        {
          id: 'log-2',
          action: 'user.logout',
          createdAt: new Date(),
          user: { id: 'user-1', username: 'john', email: 'john@example.com' },
        },
      ];

      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(25);

      const result = await getAuditLogs({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        data: mockLogs,
        total: 25,
        page: 1,
        pageSize: 10,
        pageCount: 3,
      });
    });

    test('filters by userId', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({ userId: 'user-123' });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        }),
      );
    });

    test('filters by action', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({ action: 'user.login' });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'user.login' },
        }),
      );
    });

    test('filters by date range (startDate and endDate)', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await getAuditLogs({ startDate, endDate });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      );
    });

    test('filters by startDate only', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      const startDate = new Date('2024-01-01');

      await getAuditLogs({ startDate });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
            },
          },
        }),
      );
    });

    test('filters by endDate only', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      const endDate = new Date('2024-12-31');

      await getAuditLogs({ endDate });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              lte: endDate,
            },
          },
        }),
      );
    });

    test('combines multiple filters', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await getAuditLogs({
        userId: 'user-123',
        action: 'user.login',
        startDate,
        endDate,
      });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            action: 'user.login',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      );
    });

    test('orders by createdAt descending', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({});

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    test('includes user information in results', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({});

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        }),
      );
    });

    test('defaults to page 1 and pageSize 50', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({});

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * 50
          take: 50,
        }),
      );
    });

    test('calculates skip/take for page 2', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(100);

      await getAuditLogs({ page: 2, pageSize: 25 });

      expect(prisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25, // (2 - 1) * 25
          take: 25,
        }),
      );
    });

    test('calculates pageCount correctly', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(47);

      const result = await getAuditLogs({ pageSize: 10 });

      expect(result.pageCount).toBe(5); // Math.ceil(47 / 10)
    });

    test('returns empty data with no results', async () => {
      (prisma.client.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.client.auditLog.count as jest.Mock).mockResolvedValue(0);

      const result = await getAuditLogs({});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        pageCount: 0,
      });
    });
  });
});
