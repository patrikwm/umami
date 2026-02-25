import debug from 'debug';
import { ROLE_PERMISSIONS, ROLES, SHARE_TOKEN_HEADER } from '@/lib/constants';
import { secret } from '@/lib/crypto';
import { getRandomChars } from '@/lib/generate';
import { createSecureToken, parseSecureToken, parseToken } from '@/lib/jwt';
import { auth as getAuthSession } from '@/lib/next-auth';
import redis from '@/lib/redis';
import { ensureArray } from '@/lib/utils';
import { getUser } from '@/queries/prisma/user';

const log = debug('umami:auth');

export function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization');

  return auth?.split(' ')[1];
}

export async function checkAuth(request: Request) {
  const shareToken = await parseShareToken(request);

  // Try Auth.js session first (cookie-based)
  try {
    const session = await getAuthSession();

    if (session?.user?.id) {
      const user = await getUser(session.user.id);

      if (user) {
        user.isAdmin = user.role === ROLES.admin;
        log({ session, user, shareToken });

        return {
          user,
          shareToken,
          token: null,
          authKey: null,
        };
      }
    }
  } catch (e) {
    log('Auth.js session check failed, falling back to Bearer token:', e);
  }

  // Fallback to Bearer token (legacy / API tokens)
  const token = getBearerToken(request);
  const payload = parseSecureToken(token, secret());

  let user = null;
  const { userId, authKey } = payload || {};

  if (userId) {
    user = await getUser(userId);
  } else if (redis.enabled && authKey) {
    const key = await redis.client.get(authKey);

    if (key?.userId) {
      user = await getUser(key.userId);
    }
  }

  log({ token, payload, authKey, shareToken, user });

  if (!user?.id && !shareToken) {
    log('User not authorized');
    return null;
  }

  if (user) {
    user.isAdmin = user.role === ROLES.admin;
  }

  return {
    token,
    authKey,
    shareToken,
    user,
  };
}

export async function saveAuth(data: any, expire = 0) {
  const authKey = `auth:${getRandomChars(32)}`;

  if (redis.enabled) {
    await redis.client.set(authKey, data);

    if (expire) {
      await redis.client.expire(authKey, expire);
    }
  }

  return createSecureToken({ authKey }, secret());
}

export async function hasPermission(role: string, permission: string | string[]) {
  return ensureArray(permission).some(e => ROLE_PERMISSIONS[role]?.includes(e));
}

export function parseShareToken(request: Request) {
  try {
    return parseToken(request.headers.get(SHARE_TOKEN_HEADER), secret());
  } catch (e) {
    log(e);
    return null;
  }
}
