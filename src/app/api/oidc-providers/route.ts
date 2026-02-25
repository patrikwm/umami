import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canCreateOidcProvider, canViewOidcProviders } from '@/permissions';
import { createOidcProvider, getOidcProviders } from '@/queries/prisma';

export async function GET(request: Request) {
  const schema = z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canViewOidcProviders(auth))) {
    return unauthorized();
  }

  const { page, pageSize, search } = query;

  const providers = await getOidcProviders(
    {},
    {
      page,
      pageSize,
      search,
    },
  );

  return json(providers);
}

export async function POST(request: Request) {
  const schema = z.object({
    id: z.uuid().optional(),
    name: z.string().min(1).max(100),
    type: z.string().max(50),
    category: z.enum(['oidc', 'oauth2', 'oidc-quirks']).optional(),
    issuer: z.string().url().max(500).optional().nullable(),
    clientId: z.string().min(1).max(255),
    clientSecret: z.string().min(1).max(500),
    authUrl: z.string().url().max(500).optional().nullable(),
    tokenUrl: z.string().url().max(500).optional().nullable(),
    userinfoUrl: z.string().url().max(500).optional().nullable(),
    scope: z.string().max(500).optional().nullable(),
    enabled: z.boolean().optional(),
    autoCreate: z.boolean().optional(),
    trusted: z.boolean().optional(),
    adminGroup: z.string().max(200).optional().nullable(),
    viewOnlyGroup: z.string().max(200).optional().nullable(),
    teamMappings: z.record(z.string(), z.string()).optional().nullable(),
    extraConfig: z.record(z.any()).optional().nullable(),
    sortOrder: z.number().int().optional().nullable(),
    isPrimary: z.boolean().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canCreateOidcProvider(auth))) {
    return unauthorized();
  }

  const {
    id,
    name,
    type,
    category,
    issuer,
    clientId,
    clientSecret,
    authUrl,
    tokenUrl,
    userinfoUrl,
    scope,
    enabled,
    autoCreate,
    trusted,
    adminGroup,
    viewOnlyGroup,
    teamMappings,
    extraConfig,
    sortOrder,
    isPrimary,
  } = body;

  const provider = await createOidcProvider({
    id: id || uuid(),
    name,
    type,
    category: category || 'oidc',
    issuer,
    clientId,
    clientSecret,
    authUrl,
    tokenUrl,
    userinfoUrl,
    scope,
    enabled,
    autoCreate,
    trusted,
    adminGroup,
    viewOnlyGroup,
    teamMappings,
    extraConfig,
    sortOrder,
    isPrimary,
  });

  return json(provider);
}
