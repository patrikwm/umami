# OIDC Authentication - Feature List

This document details all features implemented across the 6-phase OIDC enhancement project.

## Phase 1: Enhanced Profile Synchronization

### 1.1 JWT Session Management
- **Configurable session duration** via `SESSION_DURATION` environment variable (default: 86400 seconds / 24 hours)
- JWT-based sessions for stateless authentication
- Automatic session refresh on activity

### 1.2 Trusted Provider Flag
- `trusted` boolean field on OIDC providers
- **When enabled:**
  - Bypasses email verification requirements
  - Allows automatic account linking for users with matching email addresses
  - Ideal for enterprise IdPs with verified email addresses (Authentik, Keycloak, Okta)
- **When disabled:** Requires manual email verification; safer for public OAuth providers

### 1.3 Profile Synchronization
- Updates user's `name` and `email` on every login
- Syncs `email_verified` status from IdP
- Maps `preferred_username` or `email` to username field

### 1.4 Email Address Guard
- Rejects login attempts when IdP doesn't provide an email address
- Returns clear error message: "Email address is required for login"
- Prevents invalid user records in database

### 1.5 Unique Username Generation
- Deduplicates usernames on collision
- Uses `preferred_username` from IdP if available
- Falls back to email prefix with random 4-digit suffix (e.g., `john.doe.1234`)
- Ensures unique constraint satisfaction

### 1.6 Callback URI Display
- Shows callback URI in provider add/edit forms
- Read-only field for easy copy-paste
- Format: `{AUTH_URL}/api/auth/callback/{provider-slug}`
- Updated dynamically based on provider ID

### 1.7 Advanced OIDC Configuration Fields
New fields in provider forms:
- `scope` - OAuth scopes (default: "openid email profile")
- `authorizationUrl` - Custom authorization endpoint
- `tokenUrl` - Custom token endpoint
- `userinfoUrl` - Custom userinfo endpoint

### 1.8 Environment Variable Documentation
Created `.env.example` with all required variables:
- `AUTH_URL` - Public-facing Umami URL
- `AUTH_SECRET` - Secret key for JWT signing (min 32 chars)
- `SESSION_DURATION` - Session lifetime in seconds
- Provider-specific credentials (`OIDC_*`, `GOOGLE_*`, `GITHUB_*`)

---

## Phase 2: Role Mapping via Group Claims

### 2.1 Admin Group Mapping
- `adminGroup` field on OIDC providers (e.g., "umami-admins")
- Users in this group receive **admin** role
- Full system access: manage all websites, teams, users, and providers

### 2.2 View-Only Group Mapping
- `viewOnlyGroup` field on OIDC providers (e.g., "umami-viewers")
- Users in this group receive **view-only** role
- Can view all websites and dashboards but cannot modify data

### 2.3 Three-Tier Role Priority
Role assignment logic:
1. **Admin** - If user is in `adminGroup` → role = admin
2. **View-only** - Else if user is in `viewOnlyGroup` → role = view-only
3. **User** - Default role for all other authenticated users

### 2.4 Groups Claim Parsing
- Reads `groups` claim from ID token (common in Keycloak, Authentik, Okta)
- Supports both string arrays and comma-separated strings
- Case-sensitive group name matching
- Re-evaluates role on every login (dynamic role changes)

### 2.5 Integration Points
- Implemented in `src/lib/oidc.ts::mapClaimsToRole()`
- Called during signin callback in `src/lib/next-auth.ts`
- Updates user's role in database on every successful login

---

## Phase 3: Team Membership Synchronization

### 3.1 Team Mappings Schema
- `teamMappings` JSON field on OIDC providers
- Format: `{ "ldap-group-name": "umami-team-id", ... }`
- Example: `{ "analytics-team": "abc123", "marketing-team": "def456" }`

### 3.2 Membership Source Tracking
- New `source` field on `TeamUser` model
- Values: `"oidc"` (managed by IdP) or `"manual"` (added by admin)
- Prevents accidental removal of manually-added memberships

### 3.3 Add + Remove Sync Logic
**On every login:**
- **Add:** User is added to teams whose groups they're in
- **Remove:** User is removed from OIDC-managed teams they've left (only if `source = 'oidc'`)
- **Protect:** Manual memberships (`source = 'manual'`) are never removed by sync

### 3.4 Team Role Limitation
- All OIDC-synced users are added with `teamRole = 'member'`
- Admin must manually promote users to 'team-manager' or 'team-owner' if needed
- Prevents privilege escalation via IdP group manipulation

### 3.5 Implementation
- Team sync function: `src/lib/oidc.ts::syncTeamMembership()`
- Called after role mapping in signin callback
- Non-blocking: Failures logged but don't prevent login

---

## Phase 4: Security Hardening

### 4.1 Client Secret Encryption
- **AES-256-GCM** encryption for all `clientSecret` values
- Encrypted before storage in database
- Decrypted only when needed (provider configuration, token exchange)
- Uses `APP_SECRET` environment variable as encryption key
- Implementation: `src/lib/crypto.ts::encrypt()` / `decrypt()`

### 4.2 Configurable Session Duration
- `SESSION_DURATION` environment variable (seconds)
- Default: 86400 (24 hours)
- Configurable per deployment (e.g., 3600 for 1 hour, 604800 for 1 week)
- Applied to JWT `maxAge` in Auth.js configuration

### 4.3 Nonce Validation
- All OIDC flows use nonce parameter
- Validates nonce in ID token matches request
- Prevents token replay attacks
- Automatically handled by Auth.js

### 4.4 PKCE Support
- Proof Key for Code Exchange enabled by default
- Adds security for authorization code flow
- Mitigates authorization code interception attacks

---

## Phase 5: UX Enhancements

### 5.1 Provider Ordering
- `sortOrder` integer field on OIDC providers
- Controls display order on login page
- Lower numbers appear first
- Default: 0

### 5.2 Callback URI Visibility
- Callback URI displayed prominently in add/edit forms
- Read-only field with copy-paste functionality
- Helps administrators configure IdP redirect URIs correctly

### 5.3 Advanced Configuration UI
Eight new form fields in provider add/edit forms:
- Scope (text input)
- Authorization URL (text input)
- Token URL (text input)
- Userinfo URL (text input)
- Trusted provider (checkbox with help text)
- Admin group (text input with placeholder)
- View-only group (text input with placeholder)
- Sort order (number input)

### 5.4 Help Text
- Inline help text for "Trusted Provider" checkbox
- Explains when to enable (enterprise IdPs) vs disable (public OAuth)
- Improves admin understanding and reduces misconfiguration

---

## Phase 6: Audit Logging

### 6.1 Audit Log Schema
New `AuditLog` table with fields:
- `id` (UUID)
- `userId` (relation to User)
- `action` (enum: login, login_failed, user_created, etc.)
- `resource` (string: affected resource type)
- `metadata` (JSON: additional context)
- `ipAddress` (string)
- `createdAt` (timestamp)

### 6.2 Tracked Events
- **login**: Successful authentication
- **user_created**: New user provisioned via JIT
- **login_failed**: Authentication failure (with reason)

### 6.3 Logged Metadata
Captured in JSON `metadata` field:
- Provider name/ID
- User email
- Role assigned
- Teams synced
- Error messages (for failures)

### 6.4 Admin UI
- New page: `/admin/audit`
- Table view showing recent audit events
- Columns: Date, User, Action, Resource, IP Address
- Requires admin role to access

### 6.5 Non-Blocking Logging
- Audit writes wrapped in try-catch
- Logging failures don't block user authentication
- Errors logged to console for monitoring

### 6.6 API Endpoint
- `GET /api/audit-logs` - Fetch audit log entries
- Query parameters: `page`, `limit`, `userId`, `action`
- Returns paginated results with user information

---

## Phase 7: Provider Categories & Dynamic Configuration

### 7.1 Three-Category Provider System

**Category A: Full OIDC (oidc)**
- Providers: Authentik, Keycloak, Okta, Entra ID, GitLab, Generic OIDC
- Features:
  - ✅ Auto-discovery via `.well-known/openid-configuration`
  - ✅ Only requires: `issuer`, `clientId`, `clientSecret`
  - ✅ Endpoints automatically discovered
  - ✅ RP-initiated logout supported
  - ✅ Groups claim available (with configuration)
- **Best for:** Enterprise deployments, internal tools

**Category B: OAuth 2.0 (oauth2)**
- Providers: GitHub, Discord, Slack
- Features:
  - ❌ No auto-discovery
  - ⚠️ Requires manual endpoints: `authUrl`, `tokenUrl`, `userinfoUrl`
  - ❌ No OIDC logout support
  - ❌ No groups claim
  - ⚠️ Email verification varies by provider
- **Best for:** Developer-focused apps, public instances, community dashboards

**Category C: OIDC with Quirks (oidc-quirks)**
- Providers: Google
- Features:
  - ✅ Auto-discovery works
  - ❌ No OIDC logout support
  - ❌ No groups claim (free accounts)
  - ⚠️ Domain restriction (`hd`) is advisory only
- **Best for:** Quick setup, public instances, small teams

### 7.2 New Database Fields

**OidcProvider table additions:**
- `category` (String, nullable) - Provider category: "oidc", "oauth2", "oidc-quirks"
- `extraConfig` (JSON, nullable) - Provider-specific configuration

### 7.3 Provider-Specific Extra Configuration

**Google (`hd` - Hosted Domain):**
```json
{
  "hd": "example.com"
}
```
- Restricts login picker to specific Google Workspace domain
- Advisory only - requires server-side validation

**Microsoft Entra ID (`tenantId`):**
```json
{
  "tenantId": "12345678-1234-1234-1234-123456789abc"
}
```
- Used to construct tenant-specific issuer URL
- Format: `https://login.microsoftonline.com/{tenantId}/v2.0`

**Okta (`authServerId`):**
```json
{
  "authServerId": "default"
}
```
- Appended to issuer URL for custom authorization server
- Format: `{issuer}/oauth2/{authServerId}`
- Required for groups claim support

### 7.4 Dynamic Admin Form Behavior

The OIDC provider add/edit forms now adapt based on provider category:

**Auto-detected providers:**
- Form auto-detects provider type from issuer URL patterns
- Shows/hides fields dynamically based on category
- Provides provider-specific help text and placeholders

**Category A (OIDC) - Minimal fields:**
- Issuer (auto-discovery handles endpoints)
- Client ID
- Client Secret
- Scope (with smart defaults)
- Groups fields (show/hide based on provider capability)

**Category B (OAuth 2.0) - Manual endpoints:**
- Authorization URL (required)
- Token URL (required)
- Userinfo URL (required)
- Client ID
- Client Secret
- Scope (provider-specific defaults)
- Groups fields hidden (not supported)

**Category C (OIDC-quirks) - Hybrid:**
- Issuer (auto-discovery)
- Client ID
- Client Secret
- Scope
- Extra config (e.g., Google `hd`)
- Groups fields hidden

### 7.5 Provider Auto-Detection

Implemented in `src/lib/oidc-providers.ts::detectProviderType()`:

```typescript
function detectProviderType(issuer: string): ProviderType {
  if (issuer.includes('authentik')) return 'authentik';
  if (issuer.includes('keycloak')) return 'keycloak';
  if (issuer.includes('okta.com')) return 'okta';
  if (issuer.includes('microsoftonline.com')) return 'entra-id';
  if (issuer.includes('gitlab')) return 'gitlab';
  if (issuer.includes('accounts.google.com')) return 'google';
  // ... etc
  return 'generic';
}
```

Auto-detection enables:
- Smart defaults for scopes (e.g., Google: `openid email profile`)
- Conditional field visibility
- Provider-specific placeholders and help text
- Extra config field suggestions

### 7.6 Issuer URL Construction

For providers with extra config, issuer URL is dynamically constructed:

**Okta with `authServerId`:**
```
Base issuer: https://company.okta.com
authServerId: default
Final issuer: https://company.okta.com/oauth2/default
```

**Entra ID with `tenantId`:**
```
Base issuer: (not needed)
tenantId: 12345678-1234-1234-1234-123456789abc
Final issuer: https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0
```

Implemented in `src/lib/oidc-providers.ts::buildIssuerUrl()`.

### 7.7 Provider Specification Registry

New provider specs define capabilities and defaults:

```typescript
const PROVIDER_SPECS = {
  authentik: {
    category: 'oidc',
    scopeDefault: 'openid email profile groups',
    supportsGroups: true,
    trustedDefault: true,
  },
  github: {
    category: 'oauth2',
    scopeDefault: 'read:user user:email',
    supportsGroups: false,
    trustedDefault: false,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
  },
  google: {
    category: 'oidc-quirks',
    scopeDefault: 'openid email profile',
    supportsGroups: false,
    trustedDefault: false,
    extraFields: ['hd'],
  },
  // ... etc
};
```

Used by:
- `ProviderAddForm` and `ProviderEditForm` for dynamic UI
- Backend validation logic
- Default value suggestion

### 7.8 Profile Mapper Enhancements

Custom profile mappers handle provider-specific response structures:

**Slack (nested structure):**
```typescript
profile: {
  user: {
    id: 'U0G9QF9C6',
    name: 'johnsmith',
    email: 'john@example.com'
  }
}

// Mapped to:
{
  id: profile.user.id,
  name: profile.user.name,
  email: profile.user.email
}
```

**GitHub (separate email API call):**
```typescript
// Primary profile doesn't include email if private
// Requires additional API call to /user/emails
```

Implemented in provider-specific adapters.

### 7.9 Authorization Params Builder

Provider-specific authorization parameters:

**Google `hd` parameter:**
```typescript
function buildAuthorizationParams(provider) {
  if (provider.type === 'google' && provider.extraConfig?.hd) {
    return { hd: provider.extraConfig.hd };
  }
  return {};
}
```

Passed to OAuth authorization URL as query params.

### 7.10 Migration Path

Existing providers without `category` field:
- Backward compatible: treated as Category A (OIDC)
- Auto-detection runs on first edit
- Admin can manually set category if needed
- No breaking changes to existing configurations

---

## Database Changes

### New Models
- **AuditLog** - Audit trail for authentication events

### Modified Models

**OidcProvider:**
- `trusted` (Boolean) - Phase 1.2
- `adminGroup` (String, nullable) - Phase 2.1
- `viewOnlyGroup` (String, nullable) - Phase 2.2
- `teamMappings` (JSON, nullable) - Phase 3.1
- `sortOrder` (Int, default 0) - Phase 5.1
- `scope`, `authorizationUrl`, `tokenUrl`, `userinfoUrl` (String, nullable) - Phase 1.7
- `category` (String, nullable) - Phase 7.2
- `extraConfig` (JSON, nullable) - Phase 7.2

**TeamUser:**
- `source` (String, default "manual") - Phase 3.2

**User:** (from earlier phases)
- `email` (String, unique, nullable)
- `emailVerified` (DateTime, nullable)
- `password` (String, nullable - supports OIDC-only users)

### Migrations
- `20260226075417_add_oidc_enhancements` - Single migration for all Phase 1-6 changes
- All new columns have safe defaults (backward compatible)

---

## API Changes

### Modified Endpoints

**POST/GET `/api/oidc-providers`**
- Accepts new fields: `trusted`, `adminGroup`, `viewOnlyGroup`, `teamMappings`, `sortOrder`, `scope`, authorization/token/userinfo URLs
- Validates `teamMappings` as valid JSON object

**PUT `/api/oidc-providers/[providerId]`**
- Same field additions as above
- Re-encrypts `clientSecret` if changed

**GET `/api/audit-logs`** (New)
- Returns paginated audit log entries
- Requires admin permission
- Includes joined user data

---

## Security Considerations

### Trusted Providers
- Only mark IdPs as "trusted" if they guarantee verified email addresses
- Untrusted providers require email verification before account linking
- Prevents account takeover via spoofed email claims

### Team Sync Safety
- Manual team memberships preserved during sync
- Only `source = 'oidc'` memberships can be auto-removed
- Prevents accidental lockout of manually-added users

### Encryption
- Client secrets encrypted at rest using AES-256-GCM
- Requires `APP_SECRET` environment variable (min 32 chars recommended)
- Decryption only occurs when secrets are actively used

### Audit Logging
- IP addresses logged for forensic analysis
- Metadata stored as JSON for flexibility
- Non-blocking writes prevent auth disruption

---

## Environment Variables Reference

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# Optional: Configure session duration (seconds)
SESSION_DURATION=86400

# Example OIDC provider (generic)
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=https://idp.example.com/realms/master

# Example: Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Example: GitHub OAuth
GITHUB_CLIENT_ID=Ov23liXXX
GITHUB_CLIENT_SECRET=xxx
```

See [Configuration Guide](./configuration.md) for complete setup instructions.
---

## Known Provider Limitations

This section consolidates known limitations across all supported OIDC/OAuth providers. For detailed provider-specific limitations and workarounds, see the individual provider guides.

### Comprehensive Limitations Comparison

| Provider | Category | Logout Support | Groups Claim | Email Verified | Key Limitations |
|----------|----------|----------------|--------------|----------------|-----------------|
| **Authentik** | OIDC (A) | ✅ RP-initiated | ✅ Yes (with config) | ✅ Yes | Back-channel logout not supported; groups require scope mapping |
| **Keycloak** | OIDC (A) | ✅ RP-initiated | ✅ Yes | ✅ Yes | Realm-specific issuer required |
| **Okta** | OIDC (A) | ✅ RP-initiated | ⚠️ Custom server only | ✅ Yes | Groups require custom authorization server; org-level server doesn't include groups |
| **Entra ID** | OIDC (A) | ⚠️ Yes (with page) | ⚠️ Premium for names | ✅ Yes | Logout shows Microsoft page; groups are GUIDs by default; 6+ groups triggers overage |
| **GitLab** | OIDC (A) | ✅ RP-initiated | ✅ Yes | ✅ Yes | Group names are paths (e.g., `mygroup/subgroup`); SaaS vs self-hosted differences |
| **Google** | OIDC-quirks (C) | ❌ No | ❌ No (Workspace: API) | ✅ Yes | No logout; no groups (free); `hd` restricts but doesn't enforce; any Google account can auth |
| **GitHub** | OAuth 2.0 (B) | ❌ No | ❌ No | ⚠️ Optional | No logout; no groups; email may be private; org membership requires API call |
| **Discord** | OAuth 2.0 (B) | ❌ No | ❌ No | ⚠️ Unreliable | Email verification unreliable; no groups; always untrusted; non-standard API |
| **Slack** | OAuth 2.0 (B) | ❌ No | ❌ No | ✅ Yes (workspace) | Non-standard response structure; custom profile mapper; workspace-scoped; no groups |
| **Generic** | OIDC (A) | ✓ Provider-dependent | ✓ Provider-dependent | ✓ Provider-dependent | Fully custom configuration required |

### Limitation Categories

#### Logout Limitations

- **No OIDC Logout:** Google, GitHub, Discord, Slack
  - Only Umami session cleared; IdP session remains active
  - Risk of auto-login on shared devices
  - Workaround: Use federated IdP (Authentik/Keycloak) as broker

- **Logout with Quirks:** Entra ID
  - Shows intermediate Microsoft "signed out" page before redirect
  - Cannot be suppressed
  - Adds 2-3 second delay to logout flow

#### Groups/Role Mapping Limitations

- **No Groups Support:** Google (free), GitHub, Discord, Slack
  - Manual role/team assignment required
  - Cannot use group-based access control
  - Workaround: Use enterprise IdP to broker and add groups

- **Conditional Groups Support:**
  - **Okta:** Requires custom authorization server (not org-level)
  - **Entra ID:** Groups are GUIDs unless Azure AD Premium license
  - **Authentik:** Requires explicit scope mapping configuration
  - **GitLab:** Group names are paths (e.g., `mygroup/subgroup`)

- **Group Overage:**
  - **Entra ID:** Users in 6+ groups trigger `_claim_names` instead of `groups` claim (requires Graph API fallback)

#### Email Verification Limitations

- **Unreliable Verification:**
  - **Discord:** `email_verified` field exists but is unreliable - always mark as untrusted
  - **GitHub:** Email verification is optional; users can hide email

- **Email Privacy:**
  - **GitHub:** Users can hide email address; requires `user:email` scope and API call to `/user/emails`

#### Domain/Organization Restrictions

- **No Enforcement:**
  - **Google:** `hd` parameter restricts login picker but doesn't enforce; requires server-side validation
  - **GitHub:** No native org restriction; requires separate `/user/orgs` API call

- **Token-based Only:**
  - **Slack:** Workspace-scoped tokens; no cross-workspace authentication

### Provider-Specific Quirks

- **Authentik:** Custom claims require explicit property mappings
- **Okta:** Org vs custom authorization server confusion; token refresh rotation behavior
- **Entra ID:** Email claim requires explicit `email` scope (not included in `profile`)
- **Google:** Free Gmail accounts have limited functionality vs Workspace
- **GitHub:** OAuth 2.0 only (not full OIDC); no standard userinfo endpoint
- **Discord:** Email verification unreliable; non-standard API responses
- **Slack:** Non-standard JSON structure (nested `user.id`, `user.email`, `user.name`)
- **GitLab:** SaaS (gitlab.com) has different restrictions than self-hosted

### Recommendations by Use Case

| Use Case | Recommended Providers | Avoid |
|----------|----------------------|-------|
| **Enterprise (internal)** | Authentik, Keycloak, Okta, Entra ID, GitLab | GitHub, Discord |
| **Small teams** | Google Workspace (Internal), Authentik | Public Google, Discord |
| **Public instances** | Google (free), GitHub | Entra ID, Okta (licensing costs) |
| **Full feature set** | Authentik, Keycloak, GitLab (self-hosted) | GitHub, Discord, Slack |
| **Developer-focused** | GitHub, GitLab | Slack, Discord |
| **Zero-config** | Google, GitHub | Generic (requires manual endpoints) |

### Detailed Limitations by Provider

For comprehensive workarounds and troubleshooting:

- [Authentik Limitations](./providers/authentik.md#known-limitations)
- [Entra ID Limitations](./providers/entra-id.md#known-limitations)
- [Okta Limitations](./providers/okta.md#known-limitations)
- [Google Limitations](./providers/google.md#limitations--workarounds)
- [GitHub Limitations](./providers/github.md#limitations--workarounds)
- [Discord Limitations](./providers/discord.md#known-limitations) (coming soon)
- [Slack Limitations](./providers/slack.md#known-limitations) (coming soon)
- [GitLab Limitations](./providers/gitlab.md#known-limitations) (coming soon)
