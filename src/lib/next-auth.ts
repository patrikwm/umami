import { randomUUID } from 'node:crypto';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { logAuditEvent } from '@/lib/audit';
import { ROLES } from '@/lib/constants';
import { decrypt, secret } from '@/lib/crypto';
import { generateUniqueUsername, mapClaimsToRole, syncTeamMembership } from '@/lib/oidc';
import {
  buildAuthorizationParams,
  detectProviderType,
  type ProviderCategory,
} from '@/lib/oidc-providers';
import prisma from '@/lib/prisma';

/**
 * Auth.js v5 configuration for Umami
 * Supports:
 * - Local username/password login (Credentials provider)
 * - Google OAuth
 * - GitHub OAuth
 * - Generic OIDC (via env vars)
 * - Dynamic admin-managed OIDC providers (from database)
 */

// Custom Prisma adapter to map Auth.js models to Umami schema
const customPrismaAdapter: Adapter = {
  ...PrismaAdapter(prisma.client as any),
  // Custom Prisma adapter to map Auth.js models to Umami schema
  async createUser(data: any) {
    const user = await prisma.client.user.create({
      data: {
        id: randomUUID(),
        username: data.email?.split('@')[0] || data.name || `user_${randomUUID().slice(0, 8)}`,
        email: data.email,
        emailVerified: data.emailVerified,
        logoUrl: data.image,
        displayName: data.name,
        password: null, // OIDC users don't have password
        role: ROLES.user, // Default role (overridden in signIn callback)
      },
    });
    return user as any;
  },
  async getUser(id: string) {
    const user = await prisma.client.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email || '',
      emailVerified: user.emailVerified,
      name: user.displayName,
      image: user.logoUrl,
    } as any;
  },
  async getUserByEmail(email: string) {
    const user = await prisma.client.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return null;
    return {
      id: user.id,
      email: user.email || '',
      emailVerified: user.emailVerified,
      name: user.displayName,
      image: user.logoUrl,
    } as any;
  },
  async getUserByAccount({
    providerAccountId,
    provider,
  }: {
    providerAccountId: string;
    provider: string;
  }) {
    const account = await prisma.client.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: { user: true },
    });
    if (!account?.user || account.user.deletedAt) return null;
    return {
      id: account.user.id,
      email: account.user.email || '',
      emailVerified: account.user.emailVerified,
      name: account.user.displayName,
      image: account.user.logoUrl,
    } as any;
  },
  // Auth sessions use the new AuthSession table
  async createSession({ sessionToken, userId, expires }: any) {
    return prisma.client.authSession.create({
      data: {
        id: randomUUID(),
        sessionToken,
        userId,
        expires,
      },
    });
  },
  async getSessionAndUser(sessionToken: string) {
    const session = await prisma.client.authSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    });
    if (!session?.user || session.user.deletedAt) return null;
    return {
      session: {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      },
      user: {
        id: session.user.id,
        email: session.user.email || '',
        emailVerified: session.user.emailVerified,
        name: session.user.displayName,
        image: session.user.logoUrl,
      },
    } as any;
  },
  async updateSession({ sessionToken, ...data }: any) {
    return prisma.client.authSession.update({
      where: { sessionToken },
      data,
    });
  },
  async deleteSession(sessionToken: string) {
    await prisma.client.authSession.delete({
      where: { sessionToken },
    });
  },
};

// Load database-configured OIDC providers
async function loadDatabaseProviders(): Promise<Provider[]> {
  try {
    const dbProviders = await prisma.client.oidcProvider.findMany({
      where: { enabled: true },
    });

    return dbProviders
      .map(provider => {
        const category = (provider.category as ProviderCategory) || 'oidc';
        const providerType = provider.issuer ? detectProviderType(provider.issuer) : 'generic';
        const extraConfig = (provider.extraConfig as Record<string, any>) || {};

        // Build authorization params including provider-specific extras (e.g., Google hd)
        const extraAuthParams = buildAuthorizationParams(providerType, extraConfig);
        const scopeParam = provider.scope || 'openid profile email';

        // Base configuration
        const baseConfig: any = {
          id: provider.id,
          name: provider.name,
          clientId: provider.clientId,
          clientSecret: decrypt(provider.clientSecret, secret()),
          checks: ['pkce', 'state', 'nonce'],
        };

        // Category-specific configuration
        if (category === 'oidc' || category === 'oidc-quirks') {
          // OIDC providers with auto-discovery
          if (!provider.issuer) {
            console.error(`OIDC provider ${provider.name} missing issuer URL`);
            return null;
          }

          return {
            ...baseConfig,
            type: 'oidc' as const,
            issuer: provider.issuer,
            authorization: provider.authUrl
              ? {
                  url: provider.authUrl,
                  params: { scope: scopeParam, ...extraAuthParams },
                }
              : {
                  params: { scope: scopeParam, ...extraAuthParams },
                },
            token: provider.tokenUrl ? { url: provider.tokenUrl } : undefined,
            userinfo: provider.userinfoUrl ? { url: provider.userinfoUrl } : undefined,
            profile(profile: any) {
              return {
                id: profile.sub,
                email: profile.email,
                name: profile.name || profile.preferred_username,
                image: profile.picture,
              };
            },
          };
        }

        if (category === 'oauth2') {
          // OAuth 2.0 providers - manual endpoint configuration required
          if (!provider.authUrl || !provider.tokenUrl) {
            console.error(
              `OAuth 2.0 provider ${provider.name} missing required endpoints (authUrl, tokenUrl)`,
            );
            return null;
          }

          return {
            ...baseConfig,
            type: 'oauth' as const,
            authorization: {
              url: provider.authUrl,
              params: { scope: scopeParam },
            },
            token: { url: provider.tokenUrl },
            userinfo: provider.userinfoUrl ? { url: provider.userinfoUrl } : undefined,
            profile(profile: any) {
              // OAuth 2.0 profile mapping (provider-specific)
              if (providerType === 'github') {
                return {
                  id: profile.id?.toString(),
                  email: profile.email,
                  name: profile.name || profile.login,
                  image: profile.avatar_url,
                };
              }
              if (providerType === 'discord') {
                return {
                  id: profile.id,
                  email: profile.email,
                  name: profile.username,
                  image: profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                    : null,
                };
              }
              if (providerType === 'slack') {
                return {
                  id: profile.user?.id,
                  email: profile.user?.email,
                  name: profile.user?.name,
                  image: profile.user?.image_192,
                };
              }
              // Generic OAuth 2.0
              return {
                id: profile.id || profile.sub,
                email: profile.email,
                name: profile.name,
                image: profile.picture || profile.avatar_url,
              };
            },
          };
        }

        // Fallback to basic OIDC
        if (!provider.issuer) {
          console.error(`Provider ${provider.name} missing issuer URL`);
          return null;
        }

        return {
          ...baseConfig,
          type: 'oidc' as const,
          issuer: provider.issuer,
          authorization: { params: { scope: scopeParam } },
          profile(profile: any) {
            return {
              id: profile.sub,
              email: profile.email,
              name: profile.name,
              image: profile.picture,
            };
          },
        };
      })
      .filter((p): p is Provider => p !== null);
  } catch (error) {
    console.error('Failed to load database OIDC providers:', error);
    return [];
  }
}

// Load environment-configured providers
function loadEnvProviders(): Provider[] {
  const providers: Provider[] = [];

  // Google OAuth
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  // GitHub OAuth
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }

  // Generic OIDC provider (e.g., KeyCloak, Authentik, EntraID)
  if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
    const oidcName = process.env.OIDC_NAME || 'OIDC';
    const oidcId = process.env.OIDC_ID || oidcName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const oidcScope = process.env.OIDC_SCOPE || 'openid profile email';
    providers.push({
      id: oidcId,
      name: oidcName,
      type: 'oidc',
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorization: process.env.OIDC_AUTH_URL
        ? { url: process.env.OIDC_AUTH_URL, params: { scope: oidcScope } }
        : { params: { scope: oidcScope } },
      token: process.env.OIDC_TOKEN_URL ? { url: process.env.OIDC_TOKEN_URL } : undefined,
      userinfo: process.env.OIDC_USERINFO_URL ? { url: process.env.OIDC_USERINFO_URL } : undefined,
      checks: ['pkce', 'state', 'nonce'],
      profile(profile: any) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name || profile.preferred_username,
          image: profile.picture,
        };
      },
    });
  }

  return providers;
}

// Credentials provider for local username/password
function getCredentialsProvider(): Provider {
  return Credentials({
    name: 'Credentials',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.username || !credentials?.password) {
        return null;
      }

      const user = await prisma.client.user.findUnique({
        where: { username: credentials.username as string },
      });

      if (!user || user.deletedAt) {
        return null;
      }

      // Check password
      if (!user.password) {
        // User exists but has no password (OIDC-only user)
        return null;
      }

      const isValid = await compare(credentials.password as string, user.password);

      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || user.username,
        name: user.displayName || user.username,
        image: user.logoUrl,
      };
    },
  });
}

// Build providers list
async function getProviders(): Promise<Provider[]> {
  const envProviders = loadEnvProviders();
  const dbProviders = await loadDatabaseProviders();

  const providers: Provider[] = [...envProviders, ...dbProviders];

  // Add credentials provider unless disabled
  if (process.env.DISABLE_LOCAL_LOGIN !== 'true') {
    providers.push(getCredentialsProvider());
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  adapter: customPrismaAdapter,
  providers: [] as Provider[], // Dynamically loaded in auth()
  session: {
    strategy: 'jwt', // Use JWT instead of database sessions for simplicity
    maxAge: parseInt(process.env.SESSION_DURATION || '86400', 10), // Default: 24h (1 day)
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials (local login) — always allow
      if (account?.provider === 'credentials') {
        return true;
      }

      // OIDC/OAuth login
      // Phase 1.2: Load provider config to check trusted flag
      const providerConfig = await prisma.client.oidcProvider.findFirst({
        where: { id: account.provider },
      });
      const isTrusted = providerConfig?.trusted ?? false;

      // Phase 1.2: Block unverified emails on untrusted providers
      if (!isTrusted && profile?.email_verified === false) {
        console.warn(
          `Blocked login: email not verified for ${user.email} from provider ${account.provider}`,
        );
        // Log failed login attempt
        await logAuditEvent({
          action: 'login_failed',
          resource: account.provider,
          metadata: {
            provider: account.provider,
            email: user.email,
            reason: 'email_not_verified',
          },
        });
        return false;
      }

      // Phase 1.6: Missing email claim blocks login
      if (!user.email && !profile?.email) {
        console.warn(`Blocked login: no email claim from provider ${account.provider}`);
        // Log failed login attempt
        await logAuditEvent({
          action: 'login_failed',
          resource: account.provider,
          metadata: {
            provider: account.provider,
            reason: 'missing_email',
          },
        });
        return false;
      }

      // Normalize email
      const email = user.email || profile?.email || '';

      // Check if account already linked (by provider + sub)
      const existingAccount = await prisma.client.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      });

      let userId: string;

      if (existingAccount) {
        // Phase 1.1: Sync profile on every login
        await prisma.client.user.update({
          where: { id: existingAccount.userId },
          data: {
            displayName: profile?.name || user.name,
            email: email,
            logoUrl: profile?.picture || profile?.image || user.image,
          },
        });
        userId = existingAccount.userId;
        user.id = userId;
      } else {
        // Account not linked yet — determine if we should link or create new user

        // Phase 1.2: Try email-based auto-linking ONLY for trusted providers
        let existingUser = null;
        if (isTrusted && email) {
          existingUser = await prisma.client.user.findUnique({
            where: { email },
          });
        }

        if (existingUser) {
          // Link new provider identity to existing user
          await prisma.client.account.create({
            data: {
              id: randomUUID(),
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refreshToken: account.refresh_token,
              accessToken: account.access_token,
              expiresAt: account.expires_at,
              tokenType: account.token_type,
              scope: account.scope,
              idToken: account.id_token,
              sessionState: account.session_state as string | null,
            },
          });
          userId = existingUser.id;
          user.id = userId;
        } else {
          // Create new user (JIT provisioning)
          const autoCreate = providerConfig?.autoCreate ?? process.env.OIDC_AUTO_CREATE !== 'false';

          if (!autoCreate) {
            console.log(`OIDC auto-create disabled, rejecting user: ${email}`);
            return false;
          }

          // Phase 1.5: Generate unique username
          const username = await generateUniqueUsername(profile, email);

          // Phase 2.2: Map role from groups claim
          const role = mapClaimsToRole(profile ?? {}, {
            adminGroup: providerConfig?.adminGroup,
            viewOnlyGroup: providerConfig?.viewOnlyGroup,
          });

          const newUser = await prisma.client.user.create({
            data: {
              id: randomUUID(),
              username,
              email,
              emailVerified: new Date(),
              displayName: profile?.name || user.name,
              logoUrl: profile?.picture || profile?.image || user.image,
              password: null,
              role,
            },
          });

          // Link account
          await prisma.client.account.create({
            data: {
              id: randomUUID(),
              userId: newUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refreshToken: account.refresh_token,
              accessToken: account.access_token,
              expiresAt: account.expires_at,
              tokenType: account.token_type,
              scope: account.scope,
              idToken: account.id_token,
              sessionState: account.session_state as string | null,
            },
          });

          userId = newUser.id;
          user.id = userId;
        }
      }

      // Phase 2.3: Update role on every login (for existing users)
      if (existingAccount) {
        const role = mapClaimsToRole(profile ?? {}, {
          adminGroup: providerConfig?.adminGroup,
          viewOnlyGroup: providerConfig?.viewOnlyGroup,
        });
        await prisma.client.user.update({
          where: { id: userId },
          data: { role },
        });
      }

      // Phase 3.2: Sync team membership
      await syncTeamMembership(userId, profile ?? {}, providerConfig?.teamMappings as any);

      // Phase 6: Audit logging
      await logAuditEvent({
        userId,
        action: existingAccount ? 'login' : 'user_created',
        resource: account.provider,
        metadata: {
          provider: account.provider,
          email,
          isNewUser: !existingAccount,
        },
      });

      return true;
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;

        // Fetch full Umami user data
        const umamiUser = await prisma.client.user.findUnique({
          where: { id: user.id },
        });

        if (umamiUser) {
          token.role = umamiUser.role;
          token.username = umamiUser.username;
        }
      }

      // Store OIDC provider info for logout
      if (account) {
        token.provider = account.provider;
        token.idToken = account.id_token;
      }

      return token;
    },
    async session({ session, token }) {
      // Add Umami-specific fields to session
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        // Store provider info for OIDC logout
        session.provider = token.provider as string;
        session.idToken = token.idToken as string;
      }

      return session;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

// Export the configured NextAuth instance
// Note: providers are loaded dynamically per request
export const { handlers, auth, signIn, signOut } = NextAuth(async _req => {
  const providers = await getProviders();
  return {
    ...authConfig,
    providers,
  };
});
