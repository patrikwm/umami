# Slack OAuth 2.0 Integration with Umami

This guide walks you through setting up Slack as an OAuth 2.0 identity provider for Umami.

## Overview

Slack provides OAuth 2.0 authentication for workspace-based applications.

**Provider Type:** OAuth 2.0 (Category B - manual endpoint configuration required)

**Features:**
- ✅ OAuth 2.0 support
- ✅ Workspace-scoped authentication
- ✅ Email verified by workspace
- ⚠️ Non-standard response structure
- ❌ No groups/teams support
- ❌ No OIDC logout

**Use cases:**
- Slack workspace analytics
- Internal team dashboards
- Workspace-scoped applications

**Limitations:**
- ⚠️ Non-standard JSON response structure (requires custom profile mapper)
- ⚠️ Workspace-scoped (users can only auth to one workspace per app)
- ❌ No role/group mapping (Slack channels/teams not exposed via OAuth)
- ❌ No OIDC logout support
- ❌ Manual endpoint configuration required

---

## Prerequisites

- Slack workspace with admin access
- Umami instance with OIDC support configured (see [Configuration Guide](../configuration.md))
- Access to Slack API portal

---

## Part 1: Create Slack App

### Step 1: Access Slack API Portal

1. Log in to https://api.slack.com/apps
2. Click **Create New App**
3. Select **From scratch**
4. Enter **App Name** (e.g., `Umami Analytics`)
5. Select **Workspace** to develop the app in
6. Click **Create App**

### Step 2: Configure OAuth & Permissions

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Redirect URLs**
3. Click **Add New Redirect URL**
4. Enter your Umami callback URL:

```
https://your-umami-domain.com/api/auth/callback/[provider-id]
```

**Examples:**
- Production: `https://analytics.example.com/api/auth/callback/slack`
- Development: `http://localhost:3000/api/auth/callback/slack`

> **Note:** The `[provider-id]` will be the UUID shown in Umami when you create the provider. You can update this later.

5. Click **Add**
6. Click **Save URLs**

### Step 3: Add OAuth Scopes

Still on the **OAuth & Permissions** page:

1. Scroll to **Scopes** → **User Token Scopes**
2. Click **Add an OAuth Scope**
3. Add these scopes:

| Scope | Purpose |
|-------|---------|
| `identity.basic` | Access user's basic identity info |
| `identity.email` | Access user's email address |
| `identity.avatar` | Access user's profile picture |

4. Click **Save Changes**

### Step 4: Get Client Credentials

1. In the left sidebar, click **Basic Information**
2. Scroll to **App Credentials**
3. Copy the **Client ID** (e.g., `1234567890.1234567890123`)
4. Click **Show** next to **Client Secret**
5. Copy the **Client Secret** (e.g., `abc123def456...`)

> ⚠️ **Important:** Store the secret securely. If you lose it, you'll need to regenerate it.

---

## Part 2: Configure Umami

### Method A: Admin UI (Recommended)

1. Log in to Umami as admin
2. Navigate to **Settings** → **OIDC Providers**
3. Click **Add Provider**

Configure with these values:

| Field | Value | Notes |
|-------|-------|-------|
| **Provider ID** | `slack` | URL-safe identifier |
| **Name** | `Slack` | Display name on login button |
| **Category** | `OAuth 2.0` | Select from dropdown |
| **Client ID** | From Slack App | `1234567890.123...` |
| **Client Secret** | From Slack App | Keep secure |
| **Authorization URL** | `https://slack.com/oauth/v2/authorize` | Slack OAuth endpoint |
| **Token URL** | `https://slack.com/api/oauth.v2.access` | Slack token endpoint |
| **Userinfo URL** | `https://slack.com/api/users.identity` | Slack user identity endpoint |
| **Scope** | `identity.basic identity.email identity.avatar` | Required scopes |
| **Auto-create users** | ✓ Enabled | Allow JIT provisioning |
| **Trusted provider** | ✓ Enabled | Workspace emails are verified |

**Trusted Provider:**
- ✅ **Enable for private workspaces** where email domains are controlled
- ❌ **Disable for public/open workspaces** where anyone can join

Click **Save**.

---

### Method B: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# Slack OAuth 2.0
OIDC_ID=slack
OIDC_NAME=Slack
OIDC_CATEGORY=oauth2
OIDC_CLIENT_ID=1234567890.1234567890123
OIDC_CLIENT_SECRET=abc123def456-your-secret
OIDC_AUTH_URL=https://slack.com/oauth/v2/authorize
OIDC_TOKEN_URL=https://slack.com/api/oauth.v2.access
OIDC_USERINFO_URL=https://slack.com/api/users.identity
OIDC_SCOPE=identity.basic identity.email identity.avatar
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

Restart Umami after updating environment variables.

---

## Part 3: Configure Profile Mapping

### ⚠️ Non-Standard Response Structure

**Important:** Slack's `users.identity` endpoint returns data in a **non-standard nested structure**, different from typical OAuth 2.0 providers.

**Slack response format:**
```json
{
  "ok": true,
  "user": {
    "id": "U0G9QF9C6",
    "name": "johnsmith",
    "email": "john@example.com"
  },
  "team": {
    "id": "T0G9PQBBK",
    "name": "Example Workspace"
  }
}
```

### Profile Mapper Configuration

Umami's OIDC library needs to extract data from the nested `user` object:

| Umami Field | Slack Claim Path | Notes |
|-------------|------------------|-------|
| **User ID** | `user.id` | Unique Slack user ID |
| **Username** | `user.name` | Slack username (display name) |
| **Email** | `user.email` | Requires `identity.email` scope |
| **Email Verified** | (trusted provider setting) | Workspace emails are verified |
| **Avatar URL** | `user.image_512` or `user.image_192` | Profile picture URL |

**Custom Profile Mapper (if needed):**

If using a custom profile mapper in Umami, map fields like this:

```javascript
{
  id: profile.user.id,
  name: profile.user.name,
  email: profile.user.email,
  image: profile.user.image_512 || profile.user.image_192
}
```

---

## OIDC Logout Behavior

### ❌ No Logout Support

Slack OAuth 2.0 **does not support** the OIDC `end_session_endpoint` for logout.

**How logout works:**
1. User clicks "Logout" in Umami
2. Umami clears its JWT session cookie
3. Umami redirects to `/login`
4. **Slack session remains active**

**Impact:**
- If the same browser is reused, clicking "Login with Slack" will auto-login without prompting
- Shared/public computers may auto-login the previous user

**Recommendations:**
1. Educate users to log out of Slack separately if using shared devices
2. For internal workspaces, this is usually acceptable (users stay logged into Slack all day)
3. For sensitive use cases, consider using an enterprise IdP (Authentik, Keycloak) that brokers Slack and adds logout support

---

## Role Mapping & Team Sync

### ❌ Not Supported

Slack OAuth 2.0 does **not** expose workspace roles, channels, or user groups via the standard OAuth `identity` scopes.

**Limitations:**
- No `groups` claim in user data
- User groups require additional Slack API calls (`usergroups.list`, `usergroups.users.list`)
- Channels are not exposed via OAuth identity scopes
- Cannot auto-assign Umami roles based on Slack workspace role (Admin vs Member)
- The **Role Mappings** tab is not available for Slack providers in Umami's admin UI

All Slack users who log in will receive the default `user` role.

### Workarounds

| Approach | Complexity | Description |
|----------|------------|-------------|
| **Manual assignment** | Low | Assign roles/teams in Umami admin UI after users log in |
| **Custom API middleware** | High | Build middleware using Slack Web API to fetch user groups (requires `usergroups:read` scope) |
| **Slack + Keycloak** | Medium | Use Keycloak to broker Slack auth and add group mappings |
| **Slack + Authentik** | Medium | Use Authentik to broker Slack auth and add group claims |

### Recommended Approach

If you need role mapping with Slack authentication:

1. Set up **Keycloak** or **Authentik** as your primary identity provider
2. Configure Slack as a **social login source** in Keycloak/Authentik
3. Create groups in Keycloak/Authentik and assign users
4. Umami will receive group claims from Keycloak/Authentik

---

## Troubleshooting

### Login fails with "invalid_client_id"

**Cause:** Client ID incorrect or app not installed to workspace.

**Solution:**
1. Verify **Client ID** from Slack App → **Basic Information** → **App Credentials**
2. Ensure app is installed to the workspace
3. Check no extra spaces in `.env` or Umami config

### Redirect URI mismatch error

**Cause:** Callback URI doesn't match configured redirect URLs.

**Solution:**
1. Check exact callback URI in Umami provider settings
2. Ensure it exactly matches a redirect URL in Slack App → **OAuth & Permissions**
3. Include protocol (`https://` or `http://`) and full path
4. Click **Save URLs** after adding redirect URLs

### Email not returned

**Cause:** Missing `identity.email` scope or user hasn't granted permission.

**Solution:**
1. Verify `identity.email` scope is added in Slack App → **OAuth & Permissions** → **User Token Scopes**
2. User must approve email permission during OAuth consent
3. Some workspace admins may restrict email sharing

### Non-standard JSON parsing error

**Cause:** Slack's response uses nested `user` object, not flat structure.

**Solution:**
1. Ensure you're using Umami's Slack-aware profile mapper
2. If using custom mapper, access fields via `profile.user.email` (not `profile.email`)
3. Check Umami logs for specific JSON parsing errors

### Workspace-scoped limitation

**Cause:** Slack workspace users can only authenticate to one workspace per app installation.

**Solution:**
1. This is by design - each workspace needs a separate app installation
2. For multi-workspace support, create separate Slack apps
3. Add each as a separate OIDC provider in Umami

---

## Known Limitations

### Non-Standard Response Structure

**Limitation:** Slack's `users.identity` API returns data in a non-standard nested JSON structure with `user`, `team` objects, unlike typical OAuth 2.0 flat profiles.

**Impact:** Requires custom profile mapping logic. Generic OAuth 2.0 parsers will fail.

**Workarounds:**
1. Use Umami's built-in Slack provider support (handles this automatically)
2. If using custom integration, map `profile.user.id`, `profile.user.email`, etc.
3. Test thoroughly with Slack's actual response structure

### Workspace-Scoped Authentication

**Limitation:** Slack OAuth tokens are scoped to a specific workspace. Users can only authenticate to workspaces where the app is installed.

**Impact:** Cannot authenticate across multiple Slack workspaces with a single app. Each workspace requires separate app installation.

**Workarounds:**
1. Create separate Slack apps for each workspace
2. Add each as a separate OIDC provider in Umami (e.g., `slack-workspace1`, `slack-workspace2`)
3. Users select the appropriate workspace button on login

### No Groups or Team Mapping

**Limitation:** Slack's identity scopes (`identity.basic`, `identity.email`) do not include user group membership or channel lists.

**Impact:** Cannot automatically assign Umami roles based on Slack user groups. Cannot sync team memberships.

**Workarounds:**
1. Manually assign roles/teams in Umami UI
2. Build custom integration using Slack Web API with `usergroups:read` scope (requires additional API calls)
3. Use federated IdP (Authentik/Keycloak) to broker Slack and add group mapping
4. Accept all Slack users as "user" role by default

### No OIDC Logout

**Limitation:** Slack OAuth 2.0 does not support the OIDC `end_session_endpoint`. Logging out of Umami does not log users out of Slack.

**Impact:** Users remain logged into Slack after logging out of Umami. Shared devices may auto-login.

**Workarounds:**
1. Document that Slack logout is manual
2. For internal workspaces, this is usually acceptable (users stay logged into Slack)
3. Use federated IdP with logout support for sensitive applications

### Manual Endpoint Configuration Required

**Limitation:** Slack does not provide OIDC auto-discovery (`.well-known/openid-configuration`). All endpoints must be manually configured.

**Impact:** Requires manually specifying authorization, token, and userinfo URLs. Cannot use generic OIDC provider setup.

**Workarounds:**
1. Use Category B (OAuth 2.0) provider type in Umami
2. Manually specify endpoints (documented in this guide)
3. Copy exact URLs from this guide to avoid typos

### Workspace Admin Can Revoke App

**Limitation:** Workspace admins can uninstall the Slack app at any time, immediately revoking OAuth access for all users.

**Impact:** All users lose authentication if app is uninstalled. No warning to Umami.

**Workarounds:**
1. Coordinate with workspace admin before deploying
2. Document Slack app as critical dependency
3. Have fallback authentication method (local accounts, other OIDC providers)
4. Monitor Slack API errors for "token_revoked" responses

---

## Comparison with Other OAuth Providers

| Feature | Slack | Discord | GitHub | Google |
|---------|-------|---------|--------|--------|
| **Protocol** | OAuth 2.0 | OAuth 2.0 | OAuth 2.0 | OIDC |
| **Auto-discovery** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Groups/teams** | ❌ No (identity scopes) | ❌ No | ❌ No | ❌ No (free) |
| **Email verified** | ✅ Yes (workspace) | ⚠️ Unreliable | ⚠️ Optional | ✅ Yes |
| **Logout support** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Trusted provider** | ✅ Possible (private workspace) | ❌ Never | ❌ Not recommended | ⚠️ Workspace only |
| **Response structure** | ⚠️ Non-standard (nested) | ✅ Standard | ✅ Standard | ✅ Standard |
| **Setup complexity** | ⚠️ Moderate | ⚠️ Moderate | ✅ Easy | ✅ Easy |
| **Best for** | Internal workspaces | Gaming communities | Developers | General public |

---

## Best Practices

### 1. Use for Internal Workspace Applications

Slack OAuth is ideal for:
- Internal team analytics dashboards
- Workspace-specific tools
- Employee-only applications

**Not recommended for:**
- Public instances (users need Slack workspace access)
- Multi-tenant applications (each tenant needs separate app)
- Applications requiring role-based access control

### 2. Trusted Provider Decision

Enable "trusted" for:
- ✅ Private workspaces with controlled domains
- ✅ Internal corporate workspaces
- ✅ Workspaces with email domain restrictions

Disable "trusted" for:
- ❌ Open Slack communities
- ❌ Workspaces where anyone can join
- ❌ Public Slack workspaces

### 3. Implement Manual Role Assignment

Since Slack user groups are not available via identity scopes:
1. Create default "user" role for all Slack logins
2. Manually promote workspace admins to Umami admin role
3. Use Umami's team management to control access

### 4. Document Workspace Scope

Inform users that:
- Authentication is scoped to the specific Slack workspace
- Users need to be members of the workspace
- Changing workspaces requires re-authentication

### 5. Handle Non-Standard Response

Ensure profile mappers handle Slack's nested structure:
- Access `profile.user.id` (not `profile.id`)
- Access `profile.user.email` (not `profile.email`)
- Test with actual Slack responses

---

## Security Considerations

### 1. Client Secret Protection

- Store `CLIENT_SECRET` in environment variables or encrypted database (Umami auto-encrypts)
- Never commit secrets to version control
- Regenerate secrets in Slack App if compromised

### 2. Redirect URI Validation

- Use exact URI matching (Slack enforces this)
- Only add legitimate redirect URIs
- Remove development URIs in production
- Save URLs in Slack App settings

### 3. Limited Permission Scopes

Only request necessary scopes:
```
identity.basic identity.email identity.avatar
```

Do NOT request workspace scopes like `channels:read`, `users:read` unless you have a specific integration need.

### 4. Workspace Admin Communication

- Coordinate with workspace admin before deploying
- Document app purpose and required scopes
- Ensure admin won't uninstall app unexpectedly
- Establish change management process

### 5. Monitor for Token Revocation

- Handle `token_revoked` errors gracefully
- Provide clear error messages to users
- Have fallback authentication method
- Review Umami audit logs regularly

---

## Advanced: Multi-Workspace Support

To support multiple Slack workspaces:

### Option 1: Multiple Slack Apps (Recommended)

1. Create separate Slack app for each workspace
2. Add each as a separate provider in Umami:
   - Provider ID: `slack-workspace1`, `slack-workspace2`, etc.
   - Name: "Slack (Workspace Name)"
3. Users see multiple "Login with Slack" buttons (one per workspace)

### Option 2: Slack App Distribution (Advanced)

1. Create a **distributed Slack app** in Slack App Directory
2. Enable OAuth for multiple workspaces
3. Implement workspace-specific tenant logic in Umami
4. Requires custom development

---

## Additional Resources

- [Slack API Documentation](https://api.slack.com/)
- [Slack OAuth 2.0 Guide](https://api.slack.com/authentication/oauth-v2)
- [Slack Sign in with Slack](https://api.slack.com/docs/sign-in-with-slack)
- [Slack Identity Scopes](https://api.slack.com/scopes#identity)
- [Umami OIDC Overview](../README.md)

---

## Support

If you encounter issues:

1. Check this troubleshooting guide first
2. Review Slack App settings and installation status
3. Check Umami logs for OIDC errors
4. Test endpoints with Slack API tester: https://api.slack.com/methods
5. Join [Umami Discord](https://discord.gg/4dz4zcXYrQ) for community support
