import { auth } from '@/lib/next-auth';
import { detectProviderType } from '@/lib/oidc-providers';
import prisma from '@/lib/prisma';
import { json } from '@/lib/response';

/**
 * GET /api/auth/oidc-logout-url
 * Returns the OIDC end_session_endpoint URL if user logged in via OIDC
 *
 * Supported providers:
 * - Authentik: Full RP-initiated logout
 * - Keycloak: Full RP-initiated logout
 * - Entra ID (Azure AD): RP-initiated logout (shows Microsoft page)
 * - Okta: Full RP-initiated logout
 * - GitLab (self-hosted): RP-initiated logout
 * - Google: No logout support (returns null)
 * - GitHub: No logout support (returns null)
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return json({ logoutUrl: null });
  }

  const provider = (session as any).provider;
  const idToken = (session as any).idToken;

  // Not an OIDC login (credentials login)
  if (!provider || provider === 'credentials') {
    return json({ logoutUrl: null });
  }

  // Providers that don't support RP-initiated logout
  const noLogoutProviders = ['google', 'github', 'discord', 'slack'];
  if (noLogoutProviders.includes(provider.toLowerCase())) {
    return json({ logoutUrl: null, reason: 'provider_no_logout_support' });
  }

  // Get the provider configuration to find the issuer
  let issuer: string | null = null;
  let providerType: string | null = null;

  // Check database providers
  const dbProvider = await prisma.client.oidcProvider.findFirst({
    where: { id: provider },
  });

  if (dbProvider) {
    issuer = dbProvider.issuer;
    // Detect provider type from issuer URL
    providerType = detectProviderType(issuer);
  } else {
    // Check environment providers
    if (provider === 'google') {
      return json({ logoutUrl: null, reason: 'google_no_logout' });
    }

    if (provider === 'github') {
      return json({ logoutUrl: null, reason: 'github_no_logout' });
    }

    // Check if it's the generic OIDC provider from env
    const envProviderId =
      process.env.OIDC_ID ||
      (process.env.OIDC_NAME || 'oidc').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (provider === envProviderId && process.env.OIDC_ISSUER) {
      issuer = process.env.OIDC_ISSUER;
      providerType = detectProviderType(issuer);
    }
  }

  if (!issuer) {
    return json({ logoutUrl: null, reason: 'issuer_not_found' });
  }

  // Construct the end_session_endpoint URL based on provider type
  const endSessionEndpoint = constructEndSessionEndpoint(issuer, providerType || 'generic');

  if (!endSessionEndpoint) {
    return json({ logoutUrl: null, reason: 'no_logout_endpoint' });
  }

  // Construct full logout URL with parameters
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const postLogoutRedirectUri = `${process.env.AUTH_URL || baseUrl}${process.env.basePath || ''}/login`;

  const logoutUrl = new URL(endSessionEndpoint);

  // id_token_hint is required for most providers
  if (idToken) {
    logoutUrl.searchParams.set('id_token_hint', idToken);
  }

  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);

  return json({
    logoutUrl: logoutUrl.toString(),
    providerType,
    provider,
  });
}

/**
 * Construct end_session_endpoint based on provider type
 */
function constructEndSessionEndpoint(issuer: string, providerType: string): string | null {
  const cleanIssuer = issuer.replace(/\/$/, ''); // Remove trailing slash

  switch (providerType) {
    case 'authentik':
      // Authentik: {issuer}/end-session/
      // Issuer already includes /application/o/{app}/
      return `${cleanIssuer}/end-session/`;

    case 'keycloak':
      // Keycloak: {issuer}/protocol/openid-connect/logout
      // Issuer format: https://keycloak.example.com/realms/{realm}
      return `${cleanIssuer}/protocol/openid-connect/logout`;

    case 'entra-id': {
      // Entra ID (Azure AD): https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout
      // Extract tenant ID from issuer
      const tenantMatch = issuer.match(/\/([^/]+)\/v2\.0/);
      if (tenantMatch) {
        return `https://login.microsoftonline.com/${tenantMatch[1]}/oauth2/v2.0/logout`;
      }
      // Fallback for older format
      return `${cleanIssuer}/oauth2/v2.0/logout`;
    }

    case 'okta':
      // Okta: {issuer}/v1/logout
      // Issuer format: https://company.okta.com/oauth2/{authServerId} or https://company.okta.com/oauth2/default
      return `${cleanIssuer}/v1/logout`;

    case 'gitlab':
      // GitLab: {issuer}/oauth/logout (self-hosted)
      return `${cleanIssuer}/oauth/logout`;

    case 'google':
    case 'github':
      // No logout support
      return null;
    default:
      // Generic OIDC: try standard endpoint
      // Most OIDC providers follow Keycloak pattern
      return `${cleanIssuer}/protocol/openid-connect/logout`;
  }
}
