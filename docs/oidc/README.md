# OIDC/OAuth2 Authentication for Umami

Umami supports enterprise-grade authentication through OpenID Connect (OIDC) and OAuth 2.0, allowing seamless integration with identity providers like Authentik, Keycloak, Okta, Google, GitHub, and others.

## Overview

This implementation provides:

- **Single Sign-On (SSO)**: Users authenticate through your organization's identity provider
- **Just-in-Time Provisioning**: Automatic user creation on first login
- **Role-Based Access Control**: Map IdP groups to Umami roles (admin, view-only, user)
- **Team Synchronization**: Automatically sync users to teams based on IdP group membership
- **Multi-Provider Support**: Configure multiple identity providers simultaneously
- **Audit Logging**: Track all authentication events for security compliance
- **Trusted Providers**: Fine-grained control over account linking and email verification

## Documentation

- **[Features](./features.md)** - Complete list of implemented features across all 6 phases
- **[Configuration](./configuration.md)** - How to configure Umami for OIDC authentication
- **[Provider Setup Guides](./providers/)**
  - [Authentik](./providers/authentik.md) - Full OIDC support with clean logout
  - [Keycloak](./providers/keycloak.md) - Full OIDC support with clean logout
  - [Okta](./providers/okta.md) - Enterprise OIDC with groups support
  - [Entra ID (Azure AD)](./providers/entra-id.md) - Enterprise OIDC with Microsoft logout page
  - [GitLab](./providers/gitlab.md) - Full OIDC with group-based access control
  - [Google OAuth](./providers/google.md) - OIDC with quirks (no logout support)
  - [GitHub](./providers/github.md) - OAuth 2.0 (no logout support)
  - [Discord](./providers/discord.md) - OAuth 2.0 for gaming communities
  - [Slack](./providers/slack.md) - OAuth 2.0 for workspace authentication

## Provider Categories

Umami supports three categories of identity providers, each with different capabilities and configuration requirements:

### Category A: Full OIDC with Auto-Discovery

**Providers:** Authentik, Keycloak, Okta, Entra ID, GitLab

**Characteristics:**
- ✅ Full OpenID Connect specification compliance
- ✅ Auto-discovery via `.well-known/openid-configuration`
- ✅ RP-initiated logout support
- ✅ Groups claim available (with proper configuration)
- ✅ Email verification guaranteed
- ✅ Recommended for enterprise use

**Configuration:**
- Only requires: `issuer`, `clientId`, `clientSecret`
- Endpoints auto-discovered
- Scope: `openid profile email` (groups optional)

**Best for:** Enterprise deployments, internal tools, applications requiring role-based access control

---

### Category B: OAuth 2.0 (Manual Configuration)

**Providers:** GitHub, Discord, Slack

**Characteristics:**
- ⚠️ OAuth 2.0 only (not full OIDC)
- ❌ No auto-discovery (manual endpoints required)
- ❌ No OIDC logout support
- ❌ No groups claim
- ⚠️ Email verification varies by provider
- ⚠️ Use with caution for sensitive applications

**Configuration:**
- Requires: `clientId`, `clientSecret`, `authUrl`, `tokenUrl`, `userinfoUrl`
- No auto-discovery
- Custom scopes per provider

**Best for:** Developer-focused applications, public instances, community dashboards

---

### Category C: OIDC with Quirks

**Providers:** Google

**Characteristics:**
- ✅ OIDC support with auto-discovery
- ❌ No OIDC logout support
- ❌ No groups claim (free accounts)
- ✅ Email verification guaranteed
- ⚠️ Domain restriction (`hd` parameter) is advisory only
- ⚠️ Suitable for quick setup but limited features

**Configuration:**
- Requires: `issuer`, `clientId`, `clientSecret`
- Auto-discovery works
- Extra config: `hd` for domain restriction (Google Workspace)

**Best for:** Public instances, small teams, quick MVP deployments

---

## Comprehensive Provider Comparison

| Provider | Category | Auto-Discovery | Groups | Email Verified | Logout | Extra Fields | Best For |
|----------|----------|----------------|--------|----------------|--------|--------------|----------|
| **Authentik** | A | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Clean | None | Self-hosted, full features |
| **Keycloak** | A | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Clean | `realm` | Enterprise self-hosted |
| **Okta** | A | ✅ Yes | ⚠️ Custom server | ✅ Yes | ✅ Clean | `authServerId` | Enterprise SaaS |
| **Entra ID** | A | ✅ Yes | ⚠️ Premium for names | ✅ Yes | ⚠️ With page | `tenantId` | Microsoft 365 orgs |
| **GitLab** | A | ✅ Yes | ✅ Yes (paths) | ✅ Yes | ✅ Clean | None | DevOps teams |
| **Google** | C | ✅ Yes | ❌ No | ✅ Yes | ❌ No | `hd` (domain) | Public/small teams |
| **GitHub** | B | ❌ No | ❌ No | ⚠️ Optional | ❌ No | Manual endpoints | Developers |
| **Discord** | B | ❌ No | ❌ No | ⚠️ Unreliable | ❌ No | Manual endpoints | Gaming communities |
| **Slack** | B | ❌ No | ❌ No | ✅ Yes (workspace) | ❌ No | Manual endpoints | Workspace apps |
| **Generic** | A | ✓ Provider-dependent | ✓ Provider-dependent | ✓ Provider-dependent | ✓ Provider-dependent | Fully custom | Custom OIDC providers |

**Legend:**
- **Auto-Discovery:** Provider supports OIDC `.well-known/openid-configuration` endpoint
- **Groups:** Provider includes group membership in ID token (for role mapping)
- **Email Verified:** Provider guarantees email verification
- **Logout:** Support for RP-initiated logout (terminates IdP session)
- **Extra Fields:** Provider-specific configuration fields required

---

## Provider Logout Support Comparison

| Provider | Local Logout | RP-Initiated Logout | User Experience | Best For |
|----------|--------------|---------------------|-----------------|----------|
| **Authentik** | ✅ | ✅ | Clean SSO logout | Self-hosted, full control |
| **Keycloak** | ✅ | ✅ | Clean SSO logout | Enterprise self-hosted |
| **Entra ID** | ✅ | ✅ | Microsoft logout page shown | Microsoft 365 orgs |
| **Okta** | ✅ | ✅ | Clean SSO logout | Enterprise SaaS |
| **GitLab** | ✅ | ✅ (self-hosted) | Clean SSO logout | DevOps teams |
| **Google** | ✅ | ❌ | Cookie-only logout | Quick setup, public access |
| **GitHub** | ✅ | ❌ | Cookie-only logout | Developer-focused apps |

**Legend:**
- **Local Logout** - Clears Umami session only (all providers support this)
- **RP-Initiated Logout** - Also terminates the identity provider session (full SSO logout)

**Note:** For providers without RP-initiated logout (Google, GitHub, Discord, Slack), users remain signed in to the provider and can instantly re-authenticate with one click. This is standard OAuth behavior and cannot be changed.

## Known Limitations by Provider

For detailed limitations and workarounds, see the [Features - Known Limitations](./features.md#known-provider-limitations) section and individual provider guides:

- **Authentik:** Back-channel logout not supported; groups require scope mapping
- **Keycloak:** Realm-specific issuer required
- **Okta:** Groups require custom authorization server (not org-level)
- **Entra ID:** Logout shows Microsoft page; groups are GUIDs (Premium for names); 6+ groups trigger overage
- **GitLab:** Group names are paths (e.g., `mygroup/subgroup`); SaaS vs self-hosted differences
- **Google:** No logout; no groups (free); `hd` restricts but doesn't enforce; any account can auth
- **GitHub:** No logout; no groups; email may be private; org membership requires API call
- **Discord:** Email verification unreliable; no groups; always untrusted; non-standard API
- **Slack:** Non-standard response structure; workspace-scoped; no groups

## Quick Start

1. **Configure your identity provider** - Follow one of the provider setup guides
2. **Set environment variables** - Configure `AUTH_URL`, `AUTH_SECRET`, and provider credentials
3. **Add OIDC provider** - Use the Umami admin UI at `/admin/providers`
4. **Test login** - Users can now sign in through your identity provider

## Architecture

```
┌─────────────────────────────────────────────┐
│         Identity Provider (IdP)             │
│  Authentik / Keycloak / Okta / Google       │
│                                             │
│  • User authentication & MFA                │
│  • Group membership                         │
│  • Claims/attributes (groups, email, etc.)  │
└──────────────────┬──────────────────────────┘
                   │ ID Token (JWT)
                   ▼
┌─────────────────────────────────────────────┐
│          Umami Authentication               │
│           (Auth.js / NextAuth)              │
│                                             │
│  • Verify JWT signature                     │
│  • Map groups → roles (admin/view-only)     │
│  • Sync team memberships                    │
│  • Create/update user                       │
│  • Issue Umami session                      │
└──────────────────┬──────────────────────────┘
                   │ Session token
                   ▼
┌─────────────────────────────────────────────┐
│           Umami Application                 │
│  • Dashboard access control                 │
│  • Website permissions                      │
│  • Team permissions                         │
└─────────────────────────────────────────────┘
```

## Security Features

- **AES-256-GCM encryption** for OAuth client secrets
- **PKCE (Proof Key for Code Exchange)** for authorization code flow
- **Nonce validation** to prevent replay attacks
- **Configurable session duration** (default: 24 hours)
- **Audit logging** for all authentication events
- **Trusted provider control** for account linking and email verification bypass

## Support

For issues or questions:
- Check the [Configuration Guide](./configuration.md)
- Review [provider-specific setup guides](./providers/)
- Check Umami's GitHub Issues
