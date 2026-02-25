/**
 * Tests for @/lib/oidc-providers
 * Provider detection and configuration utilities
 */

import {
  buildAuthorizationParams,
  buildIssuerUrl,
  detectProviderType,
  getDefaultScope,
  getProviderCategory,
  getProviderSpec,
  type ProviderCategory,
  type ProviderType,
  requiresManualEndpoints,
  supportsDiscovery,
  validateProviderConfig,
} from '@/lib/oidc-providers';

describe('oidc-providers', () => {
  describe('detectProviderType', () => {
    test('detects Authentik from issuer URL', () => {
      expect(detectProviderType('https://authentik.company.com/application/o/umami/')).toBe(
        'authentik',
      );
      expect(detectProviderType('https://auth.example.com/authentik/application/o/app/')).toBe(
        'authentik',
      );
    });

    test('detects Keycloak from issuer URL', () => {
      expect(detectProviderType('https://keycloak.company.com/realms/myrealm')).toBe('keycloak');
      expect(detectProviderType('https://auth.example.com/keycloak/realms/master')).toBe(
        'keycloak',
      );
    });

    test('detects Okta from issuer URL', () => {
      expect(detectProviderType('https://company.okta.com')).toBe('okta');
      expect(detectProviderType('https://company.oktapreview.com')).toBe('okta');
      expect(detectProviderType('https://dev-12345.okta.com/oauth2/default')).toBe('okta');
    });

    test('detects Entra ID from issuer URL', () => {
      expect(
        detectProviderType('https://login.microsoftonline.com/12345678-1234-1234-1234/v2.0'),
      ).toBe('entra-id');
      expect(detectProviderType('https://sts.windows.net/tenant-id/')).toBe('entra-id');
    });

    test('detects GitLab from issuer URL', () => {
      expect(detectProviderType('https://gitlab.com')).toBe('gitlab');
      expect(detectProviderType('https://gitlab.company.com')).toBe('gitlab');
    });

    test('detects Google from issuer URL', () => {
      expect(detectProviderType('https://accounts.google.com')).toBe('google');
    });

    test('detects GitHub from issuer URL', () => {
      expect(detectProviderType('https://github.com')).toBe('github');
      expect(detectProviderType('https://api.github.com')).toBe('github');
    });

    test('detects Discord from issuer URL', () => {
      expect(detectProviderType('https://discord.com/api/oauth2')).toBe('discord');
    });

    test('detects Slack from issuer URL', () => {
      expect(detectProviderType('https://slack.com/oauth')).toBe('slack');
    });

    test('returns generic for unknown providers', () => {
      expect(detectProviderType('https://unknown-provider.com')).toBe('generic');
      expect(detectProviderType('https://custom.example.com')).toBe('generic');
    });

    test('handles case-insensitive matching', () => {
      expect(detectProviderType('HTTPS://AUTHENTIK.COM')).toBe('authentik');
      expect(detectProviderType('https://KEYCLOAK.example.com/realms/Test')).toBe('keycloak');
    });
  });

  describe('getProviderSpec', () => {
    test('returns correct spec for Authentik', () => {
      const spec = getProviderSpec('authentik');
      expect(spec.type).toBe('authentik');
      expect(spec.category).toBe('oidc');
      expect(spec.displayName).toBe('Authentik');
      expect(spec.requiredFields).toContain('issuer');
      expect(spec.requiredFields).toContain('clientId');
      expect(spec.requiredFields).toContain('clientSecret');
      expect(spec.scopeDefault).toBe('openid profile email groups');
      expect(spec.trustedDefault).toBe(true);
      expect(spec.supportsGroups).toBe(true);
    });

    test('returns correct spec for Keycloak', () => {
      const spec = getProviderSpec('keycloak');
      expect(spec.category).toBe('oidc');
      expect(spec.supportsGroups).toBe(true);
      expect(spec.trustedDefault).toBe(true);
    });

    test('returns correct spec for Okta', () => {
      const spec = getProviderSpec('okta');
      expect(spec.category).toBe('oidc');
      expect(spec.extraFields.length).toBeGreaterThan(0);
      expect(spec.extraFields[0].key).toBe('authServerId');
    });

    test('returns correct spec for Entra ID', () => {
      const spec = getProviderSpec('entra-id');
      expect(spec.category).toBe('oidc');
      expect(spec.extraFields.some(f => f.key === 'tenantId')).toBe(true);
    });

    test('returns correct spec for Google', () => {
      const spec = getProviderSpec('google');
      expect(spec.category).toBe('oidc-quirks');
      expect(spec.supportsGroups).toBe(false);
      expect(spec.trustedDefault).toBe(true); // Google is trusted by default
      expect(spec.extraFields.some(f => f.key === 'hd')).toBe(true);
    });

    test('returns correct spec for GitHub', () => {
      const spec = getProviderSpec('github');
      expect(spec.category).toBe('oauth2');
      expect(spec.supportsGroups).toBe(false);
      expect(spec.trustedDefault).toBe(false);
      expect(spec.requiredFields).toContain('authUrl');
      expect(spec.requiredFields).toContain('tokenUrl');
      expect(spec.requiredFields).toContain('userinfoUrl');
    });

    test('returns correct spec for Discord', () => {
      const spec = getProviderSpec('discord');
      expect(spec.category).toBe('oauth2');
      expect(spec.supportsGroups).toBe(false);
    });

    test('returns correct spec for Slack', () => {
      const spec = getProviderSpec('slack');
      expect(spec.category).toBe('oauth2');
      expect(spec.scopeDefault).toBe('identity.basic identity.email');
    });

    test('returns correct spec for generic OIDC', () => {
      const spec = getProviderSpec('generic');
      expect(spec.category).toBe('oidc');
      expect(spec.displayName).toBe('Generic OIDC');
    });
  });

  describe('getProviderCategory', () => {
    test('returns oidc for Authentik', () => {
      expect(getProviderCategory('authentik')).toBe('oidc');
    });

    test('returns oidc for Keycloak', () => {
      expect(getProviderCategory('keycloak')).toBe('oidc');
    });

    test('returns oidc-quirks for Google', () => {
      expect(getProviderCategory('google')).toBe('oidc-quirks');
    });

    test('returns oauth2 for GitHub', () => {
      expect(getProviderCategory('github')).toBe('oauth2');
    });

    test('returns oauth2 for Discord', () => {
      expect(getProviderCategory('discord')).toBe('oauth2');
    });

    test('returns oauth2 for Slack', () => {
      expect(getProviderCategory('slack')).toBe('oauth2');
    });
  });

  describe('supportsDiscovery', () => {
    test('returns true for oidc category', () => {
      expect(supportsDiscovery('oidc')).toBe(true);
    });

    test('returns true for oidc-quirks category', () => {
      expect(supportsDiscovery('oidc-quirks')).toBe(true);
    });

    test('returns false for oauth2 category', () => {
      expect(supportsDiscovery('oauth2')).toBe(false);
    });
  });

  describe('requiresManualEndpoints', () => {
    test('returns true for oauth2 category', () => {
      expect(requiresManualEndpoints('oauth2')).toBe(true);
    });

    test('returns false for oidc category', () => {
      expect(requiresManualEndpoints('oidc')).toBe(false);
    });

    test('returns false for oidc-quirks category', () => {
      expect(requiresManualEndpoints('oidc-quirks')).toBe(false);
    });
  });

  describe('getDefaultScope', () => {
    test('returns correct scope for Authentik', () => {
      expect(getDefaultScope('authentik')).toBe('openid profile email groups');
    });

    test('returns correct scope for Keycloak', () => {
      expect(getDefaultScope('keycloak')).toBe('openid profile email groups');
    });

    test('returns correct scope for Google', () => {
      expect(getDefaultScope('google')).toBe('openid profile email');
    });

    test('returns correct scope for GitHub', () => {
      expect(getDefaultScope('github')).toBe('user:email read:user');
    });

    test('returns correct scope for Discord', () => {
      expect(getDefaultScope('discord')).toBe('identify email');
    });

    test('returns correct scope for Slack', () => {
      expect(getDefaultScope('slack')).toBe('identity.basic identity.email');
    });

    test('returns correct scope for generic OIDC', () => {
      expect(getDefaultScope('generic')).toBe('openid profile email');
    });
  });

  describe('validateProviderConfig', () => {
    describe('oidc category', () => {
      test('validates complete OIDC config', () => {
        const result = validateProviderConfig('oidc', {
          issuer: 'https://auth.example.com',
          clientId: 'client-id',
          clientSecret: 'client-secret',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('requires issuer for OIDC', () => {
        const result = validateProviderConfig('oidc', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Issuer URL is required for OIDC providers');
      });

      test('requires clientId', () => {
        const result = validateProviderConfig('oidc', {
          issuer: 'https://auth.example.com',
          clientSecret: 'client-secret',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Client ID is required');
      });

      test('requires clientSecret', () => {
        const result = validateProviderConfig('oidc', {
          issuer: 'https://auth.example.com',
          clientId: 'client-id',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Client Secret is required');
      });
    });

    describe('oauth2 category', () => {
      test('validates complete OAuth 2.0 config', () => {
        const result = validateProviderConfig('oauth2', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          authUrl: 'https://provider.com/oauth/authorize',
          tokenUrl: 'https://provider.com/oauth/token',
          userinfoUrl: 'https://provider.com/userinfo',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('requires authUrl for OAuth 2.0', () => {
        const result = validateProviderConfig('oauth2', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          tokenUrl: 'https://provider.com/oauth/token',
          userinfoUrl: 'https://provider.com/userinfo',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Authorization URL is required for OAuth 2.0 providers');
      });

      test('requires tokenUrl for OAuth 2.0', () => {
        const result = validateProviderConfig('oauth2', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          authUrl: 'https://provider.com/oauth/authorize',
          userinfoUrl: 'https://provider.com/userinfo',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Token URL is required for OAuth 2.0 providers');
      });

      test('requires userinfoUrl for OAuth 2.0', () => {
        const result = validateProviderConfig('oauth2', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          authUrl: 'https://provider.com/oauth/authorize',
          tokenUrl: 'https://provider.com/oauth/token',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Userinfo URL is required for OAuth 2.0 providers');
      });
    });

    describe('oidc-quirks category', () => {
      test('validates oidc-quirks config', () => {
        const result = validateProviderConfig('oidc-quirks', {
          issuer: 'https://accounts.google.com',
          clientId: 'client-id',
          clientSecret: 'client-secret',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('requires issuer for oidc-quirks', () => {
        const result = validateProviderConfig('oidc-quirks', {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Issuer URL is required for OIDC providers');
      });
    });
  });

  describe('buildIssuerUrl', () => {
    test('returns base issuer for most providers', () => {
      expect(buildIssuerUrl('authentik', 'https://auth.example.com')).toBe(
        'https://auth.example.com',
      );
      expect(buildIssuerUrl('keycloak', 'https://keycloak.example.com/realms/master')).toBe(
        'https://keycloak.example.com/realms/master',
      );
      expect(buildIssuerUrl('google', 'https://accounts.google.com')).toBe(
        'https://accounts.google.com',
      );
    });

    test('appends authServerId for Okta', () => {
      expect(buildIssuerUrl('okta', 'https://company.okta.com', { authServerId: 'default' })).toBe(
        'https://company.okta.com/oauth2/default',
      );
      expect(buildIssuerUrl('okta', 'https://company.okta.com/', { authServerId: 'custom' })).toBe(
        'https://company.okta.com/oauth2/custom',
      );
    });

    test('returns base issuer for Okta without authServerId', () => {
      expect(buildIssuerUrl('okta', 'https://company.okta.com')).toBe('https://company.okta.com');
      expect(buildIssuerUrl('okta', 'https://company.okta.com', {})).toBe(
        'https://company.okta.com',
      );
    });

    test('constructs Entra ID issuer from tenantId', () => {
      expect(
        buildIssuerUrl('entra-id', '', { tenantId: '12345678-1234-1234-1234-123456789abc' }),
      ).toBe('https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0');
    });

    test('returns base issuer for Entra ID without tenantId', () => {
      expect(buildIssuerUrl('entra-id', 'https://login.microsoftonline.com/tenant/v2.0')).toBe(
        'https://login.microsoftonline.com/tenant/v2.0',
      );
    });

    test('handles trailing slashes', () => {
      expect(buildIssuerUrl('okta', 'https://company.okta.com/', { authServerId: 'default' })).toBe(
        'https://company.okta.com/oauth2/default',
      );
    });
  });

  describe('buildAuthorizationParams', () => {
    test('returns empty params for most providers', () => {
      expect(buildAuthorizationParams('authentik')).toEqual({});
      expect(buildAuthorizationParams('keycloak')).toEqual({});
      expect(buildAuthorizationParams('okta')).toEqual({});
      expect(buildAuthorizationParams('github')).toEqual({});
    });

    test('includes hd parameter for Google', () => {
      expect(buildAuthorizationParams('google', { hd: 'example.com' })).toEqual({
        hd: 'example.com',
      });
    });

    test('returns empty params for Google without hd', () => {
      expect(buildAuthorizationParams('google')).toEqual({});
      expect(buildAuthorizationParams('google', {})).toEqual({});
    });

    test('ignores extraConfig for non-Google providers', () => {
      expect(buildAuthorizationParams('authentik', { hd: 'example.com' })).toEqual({});
      expect(buildAuthorizationParams('keycloak', { someParam: 'value' })).toEqual({});
    });
  });
});
