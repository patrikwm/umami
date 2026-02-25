import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, notFound, ok, unauthorized } from '@/lib/response';
import { canDeleteOidcProvider, canUpdateOidcProvider, canViewOidcProvider } from '@/permissions';
import { deleteOidcProvider, getOidcProvider, updateOidcProvider } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (!(await canViewOidcProvider(auth))) {
    return unauthorized();
  }

  const { providerId } = await params;

  const provider = await getOidcProvider(providerId, {
    includeSecret: false, // Don't expose secret in GET
    showDisabled: true,
  });

  if (!provider) {
    return notFound();
  }

  return json(provider);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    type: z.string().max(50).optional(),
    category: z.enum(['oidc', 'oauth2', 'oidc-quirks']).optional(),
    issuer: z.string().url().max(500).optional().nullable(),
    clientId: z.string().min(1).max(255).optional(),
    clientSecret: z.string().max(500).optional(),
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

  if (!(await canUpdateOidcProvider(auth))) {
    return unauthorized();
  }

  const { providerId } = await params;

  const provider = await getOidcProvider(providerId, { showDisabled: true });

  if (!provider) {
    return notFound();
  }

  // Strip empty clientSecret so we don't overwrite the existing value
  const updateData = { ...body };
  if (!updateData.clientSecret) {
    delete updateData.clientSecret;
  }

  const updated = await updateOidcProvider(providerId, updateData);

  return json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (!(await canDeleteOidcProvider(auth))) {
    return unauthorized();
  }

  const { providerId } = await params;

  const provider = await getOidcProvider(providerId, { showDisabled: true });

  if (!provider) {
    return notFound();
  }

  await deleteOidcProvider(providerId);

  return ok();
}
