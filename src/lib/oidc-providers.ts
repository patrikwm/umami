/**
 * OIDC Provider categorization and detection utilities
 *
 * Three provider categories:
 * - Category A: Full OIDC with auto-discovery (Authentik, Keycloak, Okta, Entra ID, GitLab)
 * - Category B: OAuth 2.0 only, no discovery (GitHub, Discord, Slack)
 * - Category C: OIDC with quirks (Google)
 */

export type ProviderCategory = 'oidc' | 'oauth2' | 'oidc-quirks';

export type ProviderType =
  | 'authentik'
  | 'keycloak'
  | 'okta'
  | 'entra-id'
  | 'gitlab'
  | 'google'
  | 'github'
  | 'discord'
  | 'slack'
  | 'generic';

export interface ProviderSpec {
  type: ProviderType;
  category: ProviderCategory;
  displayName: string;
  requiredFields: string[];
  optionalFields: string[];
  extraFields: ExtraField[];
  scopeDefault: string;
  trustedDefault: boolean;
  supportsGroups: boolean;
  documentation?: string;
}

export interface ExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean';
  placeholder?: string;
  helpText?: string;
  required?: boolean;
}

/**
 * Detect provider type from issuer URL
 */
export function detectProviderType(issuer: string): ProviderType {
  const issuerLower = issuer.toLowerCase();

  if (issuerLower.includes('authentik')) return 'authentik';
  if (issuerLower.includes('keycloak')) return 'keycloak';
  if (issuerLower.includes('okta.com') || issuerLower.includes('oktapreview.com')) return 'okta';
  if (issuerLower.includes('login.microsoftonline.com') || issuerLower.includes('sts.windows.net'))
    return 'entra-id';
  if (issuerLower.includes('gitlab')) return 'gitlab';
  if (issuerLower.includes('accounts.google.com')) return 'google';
  if (issuerLower.includes('github.com')) return 'github';
  if (issuerLower.includes('discord.com')) return 'discord';
  if (issuerLower.includes('slack.com')) return 'slack';

  return 'generic';
}

/**
 * Get provider specification
 */
export function getProviderSpec(type: ProviderType): ProviderSpec {
  const specs: Record<ProviderType, ProviderSpec> = {
    authentik: {
      type: 'authentik',
      category: 'oidc',
      displayName: 'Authentik',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope', 'adminGroup', 'viewOnlyGroup', 'teamMappings'],
      extraFields: [],
      scopeDefault: 'openid profile email groups',
      trustedDefault: true,
      supportsGroups: true,
      documentation: '/docs/oidc/providers/authentik.md',
    },
    keycloak: {
      type: 'keycloak',
      category: 'oidc',
      displayName: 'Keycloak',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope', 'adminGroup', 'viewOnlyGroup', 'teamMappings'],
      extraFields: [],
      scopeDefault: 'openid profile email groups',
      trustedDefault: true,
      supportsGroups: true,
      documentation: '/docs/oidc/providers/keycloak.md',
    },
    okta: {
      type: 'okta',
      category: 'oidc',
      displayName: 'Okta',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope', 'adminGroup', 'viewOnlyGroup', 'teamMappings'],
      extraFields: [
        {
          key: 'authServerId',
          label: 'Authorization Server ID',
          type: 'text',
          placeholder: 'default',
          helpText:
            'Custom auth server ID (e.g., "default"). Required for groups claim. Leave empty for org-level server.',
          required: false,
        },
      ],
      scopeDefault: 'openid profile email groups',
      trustedDefault: true,
      supportsGroups: true,
      documentation: '/docs/oidc/providers/okta.md',
    },
    'entra-id': {
      type: 'entra-id',
      category: 'oidc',
      displayName: 'Microsoft Entra ID (Azure AD)',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope', 'adminGroup', 'viewOnlyGroup', 'teamMappings'],
      extraFields: [
        {
          key: 'tenantId',
          label: 'Tenant ID',
          type: 'text',
          placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          helpText:
            'Azure AD tenant ID. Use "common" for multi-tenant, your tenant GUID for single-tenant.',
          required: true,
        },
      ],
      scopeDefault: 'openid profile email',
      trustedDefault: true,
      supportsGroups: true,
      documentation: '/docs/oidc/providers/entra-id.md',
    },
    gitlab: {
      type: 'gitlab',
      category: 'oidc',
      displayName: 'GitLab',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope', 'adminGroup', 'viewOnlyGroup', 'teamMappings'],
      extraFields: [],
      scopeDefault: 'openid profile email',
      trustedDefault: true,
      supportsGroups: true,
      documentation: '/docs/oidc/providers/gitlab.md',
    },
    google: {
      type: 'google',
      category: 'oidc-quirks',
      displayName: 'Google',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: ['scope'],
      extraFields: [
        {
          key: 'hd',
          label: 'Hosted Domain (hd)',
          type: 'text',
          placeholder: 'company.com',
          helpText:
            'Restrict to a Google Workspace domain. Without this, ANY Google account can log in.',
          required: false,
        },
      ],
      scopeDefault: 'openid profile email',
      trustedDefault: false,
      supportsGroups: false,
      documentation: '/docs/oidc/providers/google.md',
    },
    github: {
      type: 'github',
      category: 'oauth2',
      displayName: 'GitHub',
      requiredFields: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'userinfoUrl'],
      optionalFields: ['scope'],
      extraFields: [],
      scopeDefault: 'user:email read:user',
      trustedDefault: false,
      supportsGroups: false,
      documentation: '/docs/oidc/providers/github.md',
    },
    discord: {
      type: 'discord',
      category: 'oauth2',
      displayName: 'Discord',
      requiredFields: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'userinfoUrl'],
      optionalFields: ['scope'],
      extraFields: [],
      scopeDefault: 'identify email',
      trustedDefault: false,
      supportsGroups: false,
      documentation: '/docs/oidc/providers/discord.md',
    },
    slack: {
      type: 'slack',
      category: 'oauth2',
      displayName: 'Slack',
      requiredFields: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'userinfoUrl'],
      optionalFields: ['scope'],
      extraFields: [],
      scopeDefault: 'identity.basic identity.email identity.avatar',
      trustedDefault: false,
      supportsGroups: false,
      documentation: '/docs/oidc/providers/slack.md',
    },
    generic: {
      type: 'generic',
      category: 'oidc',
      displayName: 'Generic OIDC',
      requiredFields: ['issuer', 'clientId', 'clientSecret'],
      optionalFields: [
        'scope',
        'authUrl',
        'tokenUrl',
        'userinfoUrl',
        'adminGroup',
        'viewOnlyGroup',
        'teamMappings',
      ],
      extraFields: [],
      scopeDefault: 'openid profile email',
      trustedDefault: false,
      supportsGroups: true,
    },
  };

  return specs[type];
}

/**
 * Get category for a provider
 */
export function getProviderCategory(type: ProviderType): ProviderCategory {
  return getProviderSpec(type).category;
}

/**
 * Check if provider supports auto-discovery
 */
export function supportsDiscovery(category: ProviderCategory): boolean {
  return category === 'oidc' || category === 'oidc-quirks';
}

/**
 * Check if provider requires manual endpoint configuration
 */
export function requiresManualEndpoints(category: ProviderCategory): boolean {
  return category === 'oauth2';
}

/**
 * Get default scope for provider
 */
export function getDefaultScope(type: ProviderType): string {
  return getProviderSpec(type).scopeDefault;
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(
  category: ProviderCategory,
  config: {
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    tokenUrl?: string;
    userinfoUrl?: string;
  },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Common required fields
  if (!config.clientId) errors.push('Client ID is required');
  if (!config.clientSecret) errors.push('Client Secret is required');

  // Category-specific validation
  if (category === 'oidc' || category === 'oidc-quirks') {
    if (!config.issuer) errors.push('Issuer URL is required for OIDC providers');
  }

  if (category === 'oauth2') {
    if (!config.authUrl) errors.push('Authorization URL is required for OAuth 2.0 providers');
    if (!config.tokenUrl) errors.push('Token URL is required for OAuth 2.0 providers');
    if (!config.userinfoUrl) errors.push('Userinfo URL is required for OAuth 2.0 providers');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build issuer URL for provider (handles special cases)
 */
export function buildIssuerUrl(
  type: ProviderType,
  baseIssuer: string,
  extraConfig?: Record<string, any>,
): string {
  switch (type) {
    case 'okta':
      if (extraConfig?.authServerId) {
        // Custom auth server
        return `${baseIssuer.replace(/\/$/, '')}/oauth2/${extraConfig.authServerId}`;
      }
      return baseIssuer;

    case 'entra-id':
      if (extraConfig?.tenantId) {
        return `https://login.microsoftonline.com/${extraConfig.tenantId}/v2.0`;
      }
      return baseIssuer;

    default:
      return baseIssuer;
  }
}

/**
 * Build authorization params (handles special cases like Google hd)
 */
export function buildAuthorizationParams(
  type: ProviderType,
  extraConfig?: Record<string, any>,
): Record<string, string> {
  const params: Record<string, string> = {};

  switch (type) {
    case 'google':
      if (extraConfig?.hd) {
        params.hd = extraConfig.hd;
      }
      break;
  }

  return params;
}
