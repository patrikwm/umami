import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const TRACKER_PATH = '/script.js';
const COLLECT_PATH = '/api/send';
const LOGIN_PATH = '/login';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/logout',
  '/share/',
  '/api/auth',
  '/api/send',
  '/api/config',
  '/script.js',
  '/telemetry.js',
  '/_next',
  '/favicon.ico',
  '/images/',
  '/intl/',
  '/robots.txt',
  '/site.webmanifest',
  '/browserconfig.xml',
];

const apiHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, POST, PUT',
  'Access-Control-Max-Age': process.env.CORS_MAX_AGE || '86400',
  'Cache-Control': 'no-cache',
};

const trackerHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=86400, must-revalidate',
};

function customCollectEndpoint(request: NextRequest) {
  const collectEndpoint = process.env.COLLECT_API_ENDPOINT;

  if (collectEndpoint) {
    const url = request.nextUrl.clone();

    if (url.pathname.endsWith(collectEndpoint)) {
      url.pathname = COLLECT_PATH;
      return NextResponse.rewrite(url, { headers: apiHeaders });
    }
  }
}

function customScriptName(request: NextRequest) {
  const scriptName = process.env.TRACKER_SCRIPT_NAME;

  if (scriptName) {
    const url = request.nextUrl.clone();
    const names = scriptName.split(',').map(name => name.trim().replace(/^\/+/, ''));

    if (names.find(name => url.pathname.endsWith(name))) {
      url.pathname = TRACKER_PATH;
      return NextResponse.rewrite(url, { headers: trackerHeaders });
    }
  }
}

function customScriptUrl(request: NextRequest) {
  const scriptUrl = process.env.TRACKER_SCRIPT_URL;

  if (scriptUrl && request.nextUrl.pathname.endsWith(TRACKER_PATH)) {
    return NextResponse.rewrite(scriptUrl, { headers: trackerHeaders });
  }
}

function disableLogin(request: NextRequest) {
  const loginDisabled = process.env.DISABLE_LOGIN;

  if (loginDisabled && request.nextUrl.pathname.endsWith(LOGIN_PATH)) {
    return new NextResponse('Access denied', { status: 403 });
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle custom endpoints (tracker, collect, etc.)
  const customHandlers = [customCollectEndpoint, customScriptName, customScriptUrl, disableLogin];

  for (const fn of customHandlers) {
    const res = fn(req);
    if (res) {
      return res;
    }
  }

  // Allow public paths without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Also allow API routes that handle their own auth (Bearer tokens, share tokens)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for Auth.js JWT session token (Edge Runtime compatible)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token) {
    const loginUrl = new URL(`${process.env.basePath || ''}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|intl/|datamaps).*)'],
};
