import { logAuditEvent } from '@/lib/audit';
import { checkAuth } from '@/lib/auth';
import redis from '@/lib/redis';
import { ok } from '@/lib/response';

export async function POST(request: Request) {
  // Get user info before clearing session for audit log
  const auth = await checkAuth(request);

  if (redis.enabled) {
    const token = request.headers.get('authorization')?.split(' ')?.[1];

    await redis.client.del(token);
  }

  // Log logout event
  if (auth?.user?.id) {
    await logAuditEvent({
      userId: auth.user.id,
      action: 'logout',
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    });
  }

  return ok();
}
