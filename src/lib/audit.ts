import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';

/**
 * Log an audit event
 * Used for tracking authentication events and administrative actions
 *
 * @param params - Audit event parameters
 */
export async function logAuditEvent(params: {
  userId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  const { userId, action, resource, metadata, ipAddress } = params;

  try {
    await prisma.client.auditLog.create({
      data: {
        id: randomUUID(),
        userId: userId || null,
        action,
        resource: resource || null,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    // Log to console but don't fail the request if audit logging fails
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  const { userId, action, startDate, endDate, page = 1, pageSize = 50 } = filters;

  const where: any = {};

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = action;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.client.auditLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    prisma.client.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}
