import { Prisma } from '@/generated/prisma/client';
import { decrypt, encrypt, secret } from '@/lib/crypto';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';

import OidcProviderFindManyArgs = Prisma.OidcProviderFindManyArgs;

export interface GetOidcProviderOptions {
  includeSecret?: boolean;
  showDisabled?: boolean;
}

async function findOidcProvider(
  criteria: Prisma.OidcProviderFindUniqueArgs,
  options: GetOidcProviderOptions = {},
) {
  const { includeSecret = false, showDisabled = false } = options;

  return prisma.client.oidcProvider.findUnique({
    ...criteria,
    where: {
      ...criteria.where,
      ...(!showDisabled && { enabled: true }),
    },
    select: {
      id: true,
      name: true,
      type: true,
      issuer: true,
      clientId: true,
      clientSecret: includeSecret,
      authUrl: true,
      tokenUrl: true,
      userinfoUrl: true,
      scope: true,
      enabled: true,
      autoCreate: true,
      trusted: true,
      adminGroup: true,
      viewOnlyGroup: true,
      teamMappings: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getOidcProvider(providerId: string, options: GetOidcProviderOptions = {}) {
  return findOidcProvider(
    {
      where: {
        id: providerId,
      },
    },
    options,
  );
}

export async function getOidcProviders(
  criteria: OidcProviderFindManyArgs = {},
  filters: QueryFilters = {},
) {
  const { search } = filters;

  const where: Prisma.OidcProviderWhereInput = {
    ...criteria.where,
    ...prisma.getSearchParameters(search, [
      { name: 'contains' },
      { type: 'contains' },
      { issuer: 'contains' },
    ]),
  };

  return prisma.pagedQuery(
    'oidcProvider',
    {
      ...criteria,
      where,
      select: {
        id: true,
        name: true,
        type: true,
        issuer: true,
        clientId: true,
        clientSecret: false, // Never include secret in list
        authUrl: true,
        tokenUrl: true,
        userinfoUrl: true,
        scope: true,
        enabled: true,
        autoCreate: true,
        trusted: true,
        adminGroup: true,
        viewOnlyGroup: true,
        teamMappings: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    {
      orderBy: 'sortOrder',
      sortDescending: false,
      ...filters,
    },
  );
}

export async function getEnabledOidcProviders() {
  const providers = await prisma.client.oidcProvider.findMany({
    where: {
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      issuer: true,
      clientId: true,
      clientSecret: true,
      authUrl: true,
      tokenUrl: true,
      userinfoUrl: true,
      scope: true,
      autoCreate: true,
      trusted: true,
      adminGroup: true,
      viewOnlyGroup: true,
      teamMappings: true,
      sortOrder: true,
      isPrimary: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  // Decrypt clientSecret for each provider
  return providers.map(provider => ({
    ...provider,
    clientSecret: decrypt(provider.clientSecret, secret()),
  }));
}

export async function createOidcProvider(data: {
  id: string;
  name: string;
  type: string;
  category?: string | null;
  issuer?: string | null;
  clientId: string;
  clientSecret: string;
  authUrl?: string | null;
  tokenUrl?: string | null;
  userinfoUrl?: string | null;
  scope?: string | null;
  enabled?: boolean;
  autoCreate?: boolean;
  trusted?: boolean;
  adminGroup?: string | null;
  viewOnlyGroup?: string | null;
  teamMappings?: Record<string, string> | null;
  extraConfig?: Record<string, any> | null;
  sortOrder?: number | null;
  isPrimary?: boolean;
}) {
  // Phase 4.1: Encrypt clientSecret
  const encryptedSecret = encrypt(data.clientSecret, secret());

  return prisma.client.oidcProvider.create({
    data: {
      ...data,
      category: data.category || 'oidc',
      clientSecret: encryptedSecret,
    },
    select: {
      id: true,
      name: true,
      type: true,
      category: true,
      issuer: true,
      clientId: true,
      clientSecret: false,
      authUrl: true,
      tokenUrl: true,
      userinfoUrl: true,
      scope: true,
      enabled: true,
      autoCreate: true,
      trusted: true,
      adminGroup: true,
      viewOnlyGroup: true,
      teamMappings: true,
      extraConfig: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
    },
  });
}

export async function updateOidcProvider(providerId: string, data: Prisma.OidcProviderUpdateInput) {
  // Phase 4.1: Encrypt clientSecret if provided
  const updateData = { ...data };
  if (updateData.clientSecret && typeof updateData.clientSecret === 'string') {
    updateData.clientSecret = encrypt(updateData.clientSecret, secret());
  }

  return prisma.client.oidcProvider.update({
    where: {
      id: providerId,
    },
    data: updateData,
    select: {
      id: true,
      name: true,
      type: true,
      issuer: true,
      clientId: true,
      clientSecret: false,
      authUrl: true,
      tokenUrl: true,
      userinfoUrl: true,
      scope: true,
      enabled: true,
      autoCreate: true,
      trusted: true,
      adminGroup: true,
      viewOnlyGroup: true,
      teamMappings: true,
      sortOrder: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteOidcProvider(providerId: string) {
  return prisma.client.oidcProvider.delete({
    where: {
      id: providerId,
    },
  });
}
