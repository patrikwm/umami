import { z } from 'zod';
import { getAuditLogs } from '@/lib/audit';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewAuditLogs } from '@/permissions';

export async function GET(request: Request) {
  const schema = z.object({
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canViewAuditLogs(auth))) {
    return unauthorized();
  }

  const { userId, action, startDate, endDate, page, pageSize } = query;

  const logs = await getAuditLogs({
    userId,
    action,
    startDate,
    endDate,
    page,
    pageSize,
  });

  return json(logs);
}
