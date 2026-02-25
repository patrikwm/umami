# Umami OIDC Configuration Guide

This guide explains how to configure Umami to use OIDC/OAuth2 authentication with your identity provider.

## Prerequisites

- Umami installed and running
- Access to Umami's `.env` file or environment variables
- Admin access to Umami's web interface
- OIDC provider configured (see [Provider Setup Guides](./providers/))

---

## How OIDC Authentication Works

### SSO Login Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    1. User clicks "Sign in with [Provider]"         │
│                       on Umami login page                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Umami redirects to IdP authorization endpoint                   │
│     https://idp.company.com/authorize?                              │
│       client_id=umami                                               │
│       redirect_uri=https://umami.company.com/api/auth/callback/... │
│       scope=openid+profile+email+groups                             │
│       response_type=code                                            │
│       state=random_state_value                                      │
│       nonce=random_nonce_value                                      │
│       code_challenge=pkce_challenge (PKCE)                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. User authenticates with IdP                                     │
│     • Enters username/password                                      │
│     • Completes MFA if required                                     │
│     • Reviews consent screen (if shown)                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. IdP redirects back to Umami with authorization code             │
│     https://umami.company.com/api/auth/callback/provider?           │
│       code=AUTHORIZATION_CODE                                       │
│       state=random_state_value                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Umami exchanges code for tokens (server-to-server)              │
│     POST https://idp.company.com/token                              │
│       grant_type=authorization_code                                 │
│       code=AUTHORIZATION_CODE                                       │
│       client_id=umami                                               │
│       client_secret=***SECRET***                                    │
│       redirect_uri=https://umami.company.com/api/auth/callback/... │
│       code_verifier=pkce_verifier (PKCE)                            │
│                                                                     │
│     Response:                                                       │
│       {                                                             │
│         "id_token": "eyJhbGc...",        ← JWT with user claims     │
│         "access_token": "eyJhbGc...",                               │
│         "refresh_token": "eyJhbGc..."                               │
│       }                                                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Umami validates ID token & extracts claims                      │
│     • Verify JWT signature                                          │
│     • Validate nonce matches                                        │
│     • Check token expiration                                        │
│     • Extract claims: sub, email, name, groups                      │
│                                                                     │
│     ID Token payload example:                                       │
│     {                                                               │
│       "sub": "user-123456",                                         │
│       "email": "john.doe@company.com",                              │
│       "email_verified": true,                                       │
│       "name": "John Doe",                                           │
│       "preferred_username": "john.doe",                             │
│       "groups": ["umami-admins", "engineering"]                     │
│     }                                                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. Umami processes user provisioning & permissions                 │
│     • Check if user exists (by email or IdP sub)                    │
│     • If new user: Create account (Just-in-Time provisioning)       │
│     • Update profile: name, email, email_verified                   │
│     • Map groups to role:                                           │
│       - In adminGroup? → role = admin                               │
│       - In viewOnlyGroup? → role = view-only                        │
│       - Else → role = user                                          │
│     • Sync team memberships:                                        │
│       - Add user to teams for groups in teamMappings               │
│       - Remove from OIDC-managed teams they left                    │
│     • Log audit event: login, user email, role, teams              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Umami creates session & redirects to dashboard                  │
│     • Issue JWT session token (encrypted cookie)                    │
│     • Set session duration (default: 24 hours)                      │
│     • Redirect to: /dashboard or originally requested page          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ User is now authenticated and can access Umami                   │
│    • Session stored in encrypted HTTP-only cookie                   │
│    • Subsequent requests include session token                      │
│    • Permissions based on assigned role                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### SSO Logout Flow (RP-Initiated Logout)

**Applies to:** Authentik, Keycloak, Okta, Entra ID, GitLab (OIDC providers with `end_session_endpoint`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. User clicks "Logout" in Umami                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Umami detects OIDC provider with logout support                 │
│     • Frontend calls: GET /api/auth/oidc-logout-url                 │
│     • Backend checks provider type & constructs logout URL          │
│                                                                     │
│     Response:                                                       │
│     {                                                               │
│       "logoutUrl": "https://idp.company.com/logout?...",            │
│       "providerType": "authentik",                                  │
│       "provider": "provider-id"                                     │
│     }                                                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Umami destroys local session                                    │
│     • Call signOut({ redirect: false })                             │
│     • Clear session cookie                                          │
│     • Session invalidated in database                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Redirect to IdP logout endpoint                                 │
│     https://idp.company.com/end-session?                            │
│       id_token_hint=eyJhbGc...                                      │
│       post_logout_redirect_uri=https://umami.company.com/login      │
│                                                                     │
│     Provider-specific endpoints:                                    │
│     • Authentik: /application/o/{slug}/end-session/                 │
│     • Keycloak: /realms/{realm}/protocol/openid-connect/logout      │
│     • Okta: /oauth2/{authServerId}/v1/logout                        │
│     • Entra ID: /oauth2/v2.0/logout                                 │
│     • GitLab: /oauth/logout                                         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. IdP terminates SSO session                                      │
│     • Validates id_token_hint                                       │
│     • Destroys IdP session                                          │
│     • Logs out user from ALL applications using this session        │
│     • Clears IdP session cookies                                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. IdP redirects back to Umami                                     │
│     Redirect to: post_logout_redirect_uri                           │
│     → https://umami.company.com/login                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ User is fully logged out                                         │
│    • Umami session destroyed                                        │
│    • IdP session destroyed                                          │
│    • User must re-authenticate to access Umami                      │
│    • All other apps using same IdP session also logged out          │
└─────────────────────────────────────────────────────────────────────┘
```

**Note for Entra ID (Microsoft):**
After step 5, Entra ID shows an intermediary "You have been signed out" page for ~2 seconds before redirecting. This cannot be suppressed - it's Microsoft's standard behavior.

---

### Local-Only Logout (OAuth 2.0 Providers)

**Applies to:** GitHub, Google, Discord, Slack (OAuth providers without OIDC logout support)

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. User clicks "Logout" in Umami                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Umami checks for logout URL support                             │
│     • Call: GET /api/auth/oidc-logout-url                           │
│     • Response: { "logoutUrl": null }  ← No logout endpoint         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Umami destroys local session only                               │
│     • Call signOut()                                                │
│     • Clear session cookie                                          │
│     • Redirect to /login                                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ User logged out of Umami (cookie-only)                           │
│    • Umami session destroyed ✅                                      │
│    • GitHub/Google session still active ⚠️                          │
│                                                                     │
│    What this means:                                                 │
│    • If user clicks "Sign in with GitHub" immediately:              │
│      → They are instantly re-authenticated (no password needed)     │
│    • IdP session remains active until user manually logs out        │
│      of GitHub/Google or session expires                            │
│                                                                     │
│    This is expected OAuth behavior - NOT a bug.                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Workaround for users:**
To fully log out, user must also visit GitHub/Google and manually sign out from there.

---

## Step 1: Configure Environment Variables

### Required Variables

Add these to your `.env` file:

```bash
# Auth.js configuration
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-minimum-32-characters

# Database connection (already configured)
DATABASE_URL=postgresql://user:password@localhost:5432/umami
```

### Variable Details

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_URL` | Public-facing URL of your Umami instance | `https://analytics.example.com` or `http://localhost:3000` |
| `AUTH_SECRET` | Secret key for JWT signing (min 32 chars) | Generate with `openssl rand -base64 32` |
| `SESSION_DURATION` | Optional: Session lifetime in seconds (default: 86400 = 24h) | `3600` (1 hour), `604800` (1 week) |

### Generate AUTH_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32
```

Copy the output to your `.env` file:

```bash
AUTH_SECRET="xK9mP2qR5tW8yB3nC6fJ9mL2oP5sV8xA1dE4gH7jK0m="
```

> ⚠️ **Important:** Keep `AUTH_SECRET` secure! It's used to sign session tokens. If compromised, attackers can forge sessions.

---

## Step 2: Optional Environment-Based Providers

You can configure OIDC providers via environment variables OR through the admin UI (Step 3). Environment variables are useful for containerized deployments.

### Generic OIDC Provider

```bash
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=https://idp.example.com/realms/master
```

### Google OAuth

```bash
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

### GitHub OAuth

```bash
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXX
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
```

> **Note:** Providers configured via environment variables cannot be edited or deleted through the UI. For maximum flexibility, use database-backed providers (Step 3).

---

## Step 3: Add OIDC Providers via Admin UI

### 3.1 Access Provider Management

1. Log in to Umami as an admin user
2. Navigate to **Settings** → **Providers**
3. Click **Add Provider**

### 3.2 Basic Provider Information

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Display name for this provider | `Company SSO` |
| **Type** | Provider type | `oidc` |
| **Client ID** | OAuth client ID from your IdP | `umami-client` |
| **Client Secret** | OAuth client secret (encrypted at rest) | `********` |
| **Issuer URL** | OIDC issuer/discovery endpoint | `https://auth.example.com/realms/master` |

### 3.3 Advanced Configuration (Optional)

| Field | Description | Default |
|-------|-------------|---------|
| **Scope** | OAuth scopes to request | `openid email profile` |
| **Authorization URL** | Custom authorization endpoint | Auto-discovered from issuer |
| **Token URL** | Custom token endpoint | Auto-discovered from issuer |
| **Userinfo URL** | Custom userinfo endpoint | Auto-discovered from issuer |
| **Sort Order** | Display order on login page (lower = higher) | `0` |

> **Note:** Most OIDC providers support auto-discovery. Leave URL fields blank unless your provider requires custom endpoints.

### 3.4 Callback URI

The callback URI is displayed in the form (read-only). Use this when configuring your IdP:

```
https://analytics.example.com/api/auth/callback/provider-id
```

Example for Authentik:
```
https://analytics.example.com/api/auth/callback/authentik
```

---

## Step 4: Configure Trusted Providers (Phase 1)

**Trusted providers** bypass email verification and allow automatic account linking.

### When to Enable "Trusted"

✅ **Enable for:**
- Enterprise identity providers (Authentik, Keycloak, Okta, Azure AD)
- Providers where email addresses are verified and controlled
- Internal SSO systems

❌ **Disable for:**
- Public OAuth providers (GitHub, Google for public accounts)
- Any provider where users can self-register with unverified emails

### How to Configure

1. Check the **Trusted Provider** checkbox when adding/editing a provider
2. Save the provider

**Security implications:**
- **Enabled:** Users can link their OIDC account to existing Umami accounts with matching email addresses
- **Disabled:** Email verification required before account linking (safer for public providers)

---

## Step 5: Configure Role Mapping (Phase 2)

Map identity provider groups to Umami roles.

> **Where to configure:** When adding or editing an OIDC provider in the Umami admin UI, navigate to the **Role Mappings** tab. This tab is available for all OIDC providers (Authentik, Keycloak, Okta, Entra ID, GitLab, and Generic OIDC) but not for OAuth2 providers (GitHub, Discord, Slack) as they don't support group claims.

### 5.1 Understanding Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, websites, and providers |
| **View-only** | Read-only access to all websites and dashboards |
| **User** | Default role: can access websites they're assigned to |

### 5.2 Configure Group Mappings

| Field | Description | Example |
|-------|-------------|---------|
| **Admin Group** | IdP group name for admin users | `umami-admins` |
| **View-Only Group** | IdP group name for viewers | `umami-viewers` |

### 5.3 How It Works

On every login, Umami:
1. Reads the `groups` claim from the ID token
2. Checks if user is in **Admin Group** → assigns `role = admin`
3. Else, checks if user is in **View-Only Group** → assigns `role = view-only`
4. Else → assigns `role = user` (default)

**Priority:** Admin > View-only > User

### 5.4 Example Configuration

**In your IdP (Keycloak/Authentik):**
- Create groups: `umami-admins`, `umami-viewers`
- Assign users to groups
- Ensure `groups` claim is included in ID token

**In Umami:**
- Admin Group: `umami-admins`
- View-Only Group: `umami-viewers`

Now users in `umami-admins` will have admin access automatically.

---

## Step 6: Configure Team Synchronization (Phase 3)

Automatically add users to teams based on IdP group membership.

> **Where to configure:** When adding or editing an OIDC provider, navigate to the **Role Mappings** tab. The team mappings field is located in the same tab as the role mappings, since both features rely on the `groups` claim from your identity provider.

### 6.1 Team Mappings Format

Team mappings are defined as JSON:

```json
{
  "engineering-group": "team-id-abc123",
  "marketing-group": "team-id-def456",
  "analytics-team": "team-id-ghi789"
}
```

**Key:** IdP group name (from `groups` claim)
**Value:** Umami team ID (UUID)

### 6.2 How to Find Team IDs

**Option 1: Via API**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://analytics.example.com/api/teams
```

**Option 2: Via URL**
Navigate to the team in Umami's UI. The URL will be:
```
https://analytics.example.com/admin/teams/abc123-def-456...
```
The UUID after `/teams/` is the team ID.

### 6.3 Configure Team Mappings

1. Edit your OIDC provider in Umami
2. In **Team Mappings** field, enter JSON:
   ```json
   {
     "engineering": "abc123-def-456-...",
     "marketing": "def456-ghi-789-..."
   }
   ```
3. Save the provider

### 6.4 Sync Behavior

On every login:
- **Add:** User is added to teams whose groups they're in
- **Remove:** User is removed from OIDC-managed teams they've left
- **Protect:** Manually-added memberships are never removed

**Example:**
- User is in IdP groups: `["engineering", "marketing"]`
- Team mappings: `{"engineering": "team-A", "marketing": "team-B"}`
- Result: User added to team-A and team-B with role `member`

If user later leaves `marketing` group in IdP:
- Next login: User removed from team-B (but only if they were added via OIDC sync)

---

## Step 7: Verify Configuration

### Test Login Flow

1. Log out of Umami
2. Navigate to login page
3. Click your OIDC provider button
4. Authenticate with IdP
5. Verify you're redirected back to Umami

### Check Audit Logs

1. Log in as admin
2. Navigate to **Settings** → **Audit Logs**
3. Verify your login event appears with:
   - Action: `login`
   - Resource: `user`
   - IP address
   - Metadata (provider, email, role)

### Verify Role Assignment

1. Log in with a test account in the admin group
2. Check **Settings** → **Users**
3. Verify user has **Admin** role

### Verify Team Sync

1. Log in with a user in a mapped group
2. Check **Settings** → **Teams**
3. Verify user appears in the expected team

---

## Troubleshooting

### "Email address is required for login"

**Cause:** IdP isn't providing an email claim.

**Solution:**
- In your IdP, ensure `email` scope is included
- In Keycloak: Enable "Include in ID token" for email mapper
- In Authentik: Check scope mappings include email

### "Provider not found"

**Cause:** Provider ID mismatch or provider not enabled.

**Solution:**
- Verify provider exists in database (check `/admin/providers`)
- Ensure provider `enabled = true`
- Check callback URI matches: `/api/auth/callback/{provider-id}`

### Role not updating

**Cause:** Groups claim not present in ID token.

**Solution:**
- Verify `groups` scope is requested (add to Scope field)
- In IdP, ensure groups claim is mapped to ID token
- Check group names match exactly (case-sensitive)

### Team sync not working

**Cause:** Team mappings JSON invalid or team IDs incorrect.

**Solution:**
- Validate JSON syntax: `{"group": "team-id"}` (not `{'group': 'team-id'}`)
- Verify team IDs are correct UUIDs
- Check IdP provides `groups` claim

### Callback URI mismatch

**Cause:** IdP redirect URI doesn't match Umami's callback URI.

**Solution:**
- Copy callback URI from Umami provider form
- Paste exactly into IdP's "Redirect URI" / "Callback URL" field
- Ensure protocol matches (http vs https)
- Ensure no trailing slash

---

## Security Best Practices

### 1. Rotate AUTH_SECRET Regularly
```bash
# Generate new secret
openssl rand -base64 32

# Update .env
AUTH_SECRET="new-secret-here"

# Restart Umami
```

**Note:** This invalidates all existing sessions. Users must re-login.

### 2. Use HTTPS in Production

```bash
# Always use https:// for AUTH_URL in production
AUTH_URL=https://analytics.example.com
```

HTTP is acceptable only for local development.

### 3. Limit Session Duration

For high-security environments:
```bash
SESSION_DURATION=3600  # 1 hour
```

### 4. Monitor Audit Logs

Regularly review `/admin/audit` for:
- Failed login attempts
- Unusual IP addresses
- Unexpected user creation events

### 5. Use Trusted Flag Carefully

Only mark providers as "trusted" if you control the IdP and verify email addresses.

---

## Advanced: Environment Variable Priority

Providers configured via environment variables take precedence over database providers during Auth.js initialization.

**Load order:**
1. Environment-based providers (Google, GitHub, generic OIDC)
2. Database-backed providers (from `oidc_provider` table)

**Recommendation:** Use database providers for maximum flexibility. Reserve environment variables for CI/CD or immutable infrastructure.

---

## Next Steps

- **[Feature Reference](./features.md)** - Detailed explanation of all features
- **[Provider Setup Guides](./providers/)** - Configure Keycloak, Authentik, GitHub, etc.
- **Admin UI** - Manage providers at `/admin/providers`
- **Audit Logs** - Monitor auth events at `/admin/audit`
