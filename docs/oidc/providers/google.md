# Google OAuth Integration with Umami

This guide walks you through configuring Google as an OAuth provider for Umami authentication.

## Overview

Google supports **OpenID Connect (OIDC)** and is one of the most widely used identity providers.

**Features:**
- ✅ Full OIDC support
- ✅ Verified email addresses
- ✅ Reliable userinfo claims
- ⚠️ Limited groups support (Google Workspace only)
- ⚠️ Not recommended for "trusted provider" (public OAuth)

**Use cases:**
- Quick authentication setup
- Public Umami instances
- Small teams without enterprise IdP

**Limitations:**
- ❌ No groups claim for free Google accounts
- ✅ Google Workspace supports groups (requires admin setup)
- ⚠️ External accounts (anyone with Gmail) can authenticate

---

## Part 1: Create Google OAuth Credentials

### Step 1: Access Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select or create a project (e.g., "Umami Analytics")
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen

Before creating credentials, you must configure the consent screen:

1. Click **OAuth consent screen** in left sidebar
2. Choose user type:
   - **Internal** - Only Google Workspace users in your organization (recommended for enterprise)
   - **External** - Any Google account (public)
3. Click **Create**

Fill in the following:

| Field | Value | Example |
|-------|-------|---------|
| **App name** | `Umami Analytics` | Name shown to users during consent |
| **User support email** | Your email | Contact for support questions |
| **App logo** | (optional) | Upload Umami logo |
| **Application home page** | Umami URL | `https://analytics.example.com` |
| **Authorized domains** | Your domain | `example.com` |
| **Developer contact email** | Your email | For Google to contact you |

4. Click **Save and Continue**

### Step 3: Configure Scopes

1. Click **Add or Remove Scopes**
2. Select these scopes:

| Scope | Description |
|-------|-------------|
| `.../auth/userinfo.email` | User's email address |
| `.../auth/userinfo.profile` | User's basic profile info |
| `openid` | OpenID Connect |

3. Click **Update** then **Save and Continue**

### Step 4: Add Test Users (External only)

If you chose "External" user type and haven't published the app:

1. Click **Add Users**
2. Add email addresses of test users
3. These users can authenticate while app is in testing mode

> **Note:** Published apps can be used by any Google account. Keep in testing mode for internal use.

Click **Save and Continue** then **Back to Dashboard**.

### Step 5: Create OAuth Credentials

1. Click **Credentials** in left sidebar
2. Click **Create Credentials** → **OAuth client ID**
3. Select application type: **Web application**
4. Configure:

| Field | Value | Example |
|-------|-------|---------|
| **Name** | `Umami Web Client` | Internal name |
| **Authorized JavaScript origins** | Umami URL | `https://analytics.example.com` |
| **Authorized redirect URIs** | Callback endpoint | `https://analytics.example.com/api/auth/callback/google` |

**Redirect URI format:**
```
{UMAMI_URL}/api/auth/callback/google
```

**Examples:**
- Production: `https://analytics.example.com/api/auth/callback/google`
- Development: `http://localhost:3000/api/auth/callback/google`

5. Click **Create**

### Step 6: Get Client Credentials

After creating the credentials:

1. **Client ID** is displayed (e.g., `123456789.apps.googleusercontent.com`)
2. **Client secret** is displayed (e.g., `GOCSPX-xxxxxxxxxxxx`)
3. Copy both values

> ⚠️ **Important:** Keep the client secret secure. You can always retrieve it later from the credentials page.

---

## Part 2: Configure Umami

You can configure Google OAuth via environment variables OR the admin UI.

### Method A: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

Restart Umami:
```bash
pnpm build && pnpm start
# or with Docker
docker-compose restart umami
```

### Method B: Admin UI (Recommended)

1. Log in to Umami as admin
2. Navigate to **Settings** → **Providers**
3. Click **Add Provider**
4. Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `Google` |
| **Type** | `google` |
| **Client ID** | `123456789.apps.googleusercontent.com` |
| **Client Secret** | `GOCSPX-xxxxxxxxxxxx` |
| **Trusted Provider** | ☐ Unchecked (recommended for public Google OAuth) |
| **Admin Group** | (leave blank unless using Google Workspace with groups) |
| **View-Only Group** | (leave blank) |
| **Team Mappings** | (leave blank) |

5. **Copy the Callback URI** shown in the form
6. Click **Save**

> **Note:** Free Google accounts don't provide groups claim. For Google Workspace with groups, see [Advanced Configuration](#google-workspace-groups).

---

## Part 3: Verify Configuration

### Test Login Flow

1. Log out of Umami
2. Navigate to login page
3. Click **Sign in with Google** button
4. Choose Google account
5. Grant permissions (first time only)
6. Redirected back to Umami and logged in

### Check User Creation

1. Log in as admin → **Settings** → **Users**
2. Verify Google user was created with:
   - **Email:** From Google account
   - **Username:** Derived from email
   - **Role:** `user` (default)
   - **Email verified:** `true`

### Check Audit Logs

1. Go to **Settings** → **Audit Logs**
2. Verify login event with:
   - Action: `login`
   - Provider: `google`
   - User email and IP

---

## Advanced Configuration

### Google Workspace Groups

Google Workspace (formerly G Suite) can provide groups in the OIDC token.

#### Prerequisites:
- Google Workspace account (not free Gmail)
- Admin access to Google Workspace
- Domain-wide delegation configured

#### Steps:

1. **Enable Admin SDK API:**
   - Google Cloud Console → **APIs & Services** → **Library**
   - Search for "Admin SDK API"
   - Click **Enable**

2. **Configure Domain-Wide Delegation:**
   - Cloud Console → **IAM & Admin** → **Service Accounts**
   - Create service account with admin access
   - Enable domain-wide delegation
   - Grant scopes: `https://www.googleapis.com/auth/admin.directory.group.readonly`

3. **Update OAuth Scopes:**
   In Umami provider settings, set **Scope** to:
   ```
   openid email profile https://www.googleapis.com/auth/admin.directory.group.readonly
   ```

4. **Configure Group Mappings:**
   Use Google group emails as keys:
   ```json
   {
     "umami-admins@example.com": "team-id-uuid",
     "analytics-team@example.com": "team-id-uuid"
   }
   ```

> **Note:** This requires custom implementation. Standard Google OAuth doesn't expose groups by default.

### Hosted Domain Restriction

To restrict authentication to a specific Google Workspace domain:

**In Google OAuth consent screen:**
1. Set user type to **Internal**
2. Only users in your workspace can authenticate

**Or via code:**
Add `hd` parameter to restrict domain (requires custom configuration in `next-auth.ts`).

### Email Restrictions

To restrict to specific email domains:

**Option 1:** Use Google Workspace Internal user type
**Option 2:** Implement post-login email validation
**Option 3:** Use Keycloak/Authentik to broker Google + add rules

---

## Role Mapping & Team Sync

### ❌ Limited Support

Google OAuth does **not** include a `groups` claim in the ID token for standard Google accounts. This means automatic role mapping and team sync are **not available** with Google as the identity provider.

**Why:** Google accounts (even Google Workspace) don't expose group membership through the standard OIDC flow. The Google Directory API exists but requires separate admin SDK integration.

### Workarounds

| Approach | Complexity | Description |
|----------|------------|-------------|
| **Manual assignment** | Low | Assign roles and teams in Umami admin UI after users log in |
| **Google Workspace + Keycloak** | Medium | Use Keycloak to broker Google authentication and add group mappings |
| **Google Workspace + Authentik** | Medium | Use Authentik to broker Google authentication and add group claims |
| **Google Cloud Identity** | High | Use Google Cloud Identity API with custom middleware |

### Recommended Approach

If you need role mapping with Google authentication:

1. Set up **Keycloak** or **Authentik** as your primary identity provider
2. Configure Google as a **social login broker** in Keycloak/Authentik
3. Create groups in Keycloak/Authentik and assign users
4. Umami will receive group claims from Keycloak/Authentik (not directly from Google)

This gives you the convenience of Google login with the full power of enterprise role mapping.

---

## Logout Behavior

### ❌ No OIDC Logout Support

Google OAuth **does not support RP-initiated logout** (`end_session_endpoint`). This is intentional on Google's part — third-party applications cannot terminate Google sessions.

When users click "Logout" in Umami:

```
1. Umami clears its JWT session cookie ✅
2. User is logged out of Umami ✅
3. Google session remains active ⚠️
```

**Result:** User is logged out of Umami, but their Google session stays alive.

###  What This Means for Users

If a user clicks "Sign in with Google" again immediately after logout:
- Google recognizes they're already signed in
- **No password prompt** - instant SSO login
- User is logged back into Umami with one click

**This is expected behavior** and cannot be changed - it's how Google OAuth works for all third-party applications.

### User Actions to Fully Log Out

If users want to fully log out from Google (not just Umami):

1. Log out from Umami
2. Go to https://accounts.google.com/
3. Click account → **Sign out**

Or sign out of their entire Google account in their browser.

### Alternative: Clear Browser Storage

Users can force a complete logout by:
- Clearing cookies for `analytics.example.com`
- Using incognito/private browsing mode
- Using a different browser profile

### Comparison with Other Providers

| Provider | Logout Support | User Experience |
|----------|----------------|-----------------|
| **Google** | ❌ No `end_session_endpoint` | Cookie deleted, Google session stays active |
| **GitHub** | ❌ No `end_session_endpoint` | Cookie deleted, GitHub session stays active |
| **Authentik** | ✅ Full RP-initiated logout | Both Umami and Authentik sessions terminated |
| **Keycloak** | ✅ Full RP-initiated logout | Both Umami and Keycloak sessions terminated |

### Recommendation

**Accept this limitation.** It's standard for cloud OAuth providers (Google, GitHub, Discord, Slack).

For enterprise deployments where full SSO logout is required:
- Use **Keycloak** or **Authentik** as an identity broker
- Configure Google as an upstream IdP in Keycloak/Authentik
- Umami connects to Keycloak/Authentik (which supports logout)
- Users authenticate via Google through the bridge
- Logging out terminates the Keycloak/Authentik session (Google session may remain, but next Umami login requires Keycloak re-auth)

---

## Security Considerations

### 1. Don't Mark as Trusted Provider (Public)

For **public Google OAuth** (any Gmail account):
- ☐ Leave "Trusted Provider" unchecked
- Email addresses are verified but anyone can create a Google account

For **Google Workspace Internal**:
- ✓ Can mark as "Trusted" if you control the workspace

### 2. Consent Screen Publishing

**Testing mode:**
- Only whitelisted test users can authenticate
- App shows "unverified" warning
- Good for internal use

**Published app:**
- Any Google account can authenticate
- Requires Google verification (if requesting sensitive scopes)
- Use only for public Umami instances

### 3. Rotate Client Secret

Periodically rotate the client secret:
1. Google Cloud Console → **Credentials**
2. Click your OAuth client
3. Click **Reset secret**
4. Update in Umami provider settings

### 4. Monitor API Quotas

Google OAuth has rate limits:
- 10,000 requests per day (default)
- Can request quota increase in Cloud Console

### 5. Review Permissions Regularly

Check Google account permissions:
1. Visit https://myaccount.google.com/permissions
2. Users can see all apps with access
3. Users can revoke access (triggers logout on next request)

---

## Troubleshooting

### "Redirect URI mismatch"

**Cause:** Callback URL in Google doesn't match.

**Solution:**
1. Check Google Cloud Console → **Credentials** → OAuth client
2. **Authorized redirect URIs** should be: `https://analytics.example.com/api/auth/callback/google`
3. Ensure exact match (no trailing slash, correct protocol)

### "Access blocked: This app's request is invalid"

**Cause:** Missing or incorrect scopes.

**Solution:**
1. Verify OAuth consent screen has required scopes (email, profile, openid)
2. Check redirect URI is authorized
3. Ensure app is in testing mode or published

### "Email is required for login"

**Cause:** User denied email permission.

**Solution:**
1. User must grant email scope permission
2. Cannot authenticate without email
3. User should revoke + re-authorize the app

### "Admin verification required"

**Cause:** Google requires verification for sensitive scopes or published apps.

**Solution:**
- For internal use: Keep app in testing mode
- For public use: Submit app for verification (can take weeks)
- Or: Use less sensitive scopes

### Login works but user has no access

**Cause:** User role is `user` by default (no groups claim).

**Solution:**
- Admin must manually assign roles in Umami
- Or manually add users to teams
- Or set up Google Workspace groups (advanced)

---

## Limitations & Workarounds

### No OIDC Logout Support

**Limitation:** Google does not support the OIDC `end_session_endpoint` for logout. When users log out of Umami, only the Umami session is cleared - their Google session remains active.

**Impact:** If a user logs out of Umami and another person uses the same browser, they may be automatically logged back in with the previous Google account.

**Workarounds:**
1. Educate users to log out of Google separately if using shared computers
2. Document this behavior in user training materials
3. Consider using a federated IdP (Authentik, Keycloak) that brokers Google and adds logout support

### No Groups Claim (Free Gmail)

**Limitation:** Free Google accounts don't provide group membership in ID tokens. Only Google Workspace (paid) can provide groups via the Admin SDK API.

**Impact:** Role mapping and team sync based on groups will not work with free Gmail accounts.

**Workarounds:**
1. Manually assign roles/teams in Umami after login
2. Upgrade to Google Workspace and integrate Admin SDK API (advanced, requires custom code)
3. Use Keycloak/Authentik to broker Google + add custom groups

### `hd` Claim Only Restricts Domain, Doesn't Enforce

**Limitation:** The `hd` (hosted domain) parameter restricts the login picker to a specific Google Workspace domain, but it does NOT prevent users from other domains from authenticating if they navigate around the restriction.

**Impact:** Users from outside your organization can potentially authenticate if they manipulate the OAuth flow.

**Workarounds:**
1. Always validate the `hd` claim server-side in Umami (Umami does NOT currently do this - requires custom middleware)
2. Use Google Workspace "Internal" user type instead of "External" to enforce domain restriction
3. Implement additional email domain validation logic

### Any Google Account Can Authenticate Without `hd`

**Limitation:** If you omit the `hd` parameter in Extra Config, any Google account (personal Gmail, other Workspace orgs) can authenticate.

**Impact:** Unintended users may gain access to your Umami instance.

**Workarounds:**
1. Always set `hd: your-domain.com` in Extra Config for Workspace organizations
2. Keep OAuth consent screen in "Testing" mode with explicit user allowlist
3. Use "Internal" user type for Workspace apps (restricts to org members only)
4. Implement email domain validation in Umami middleware (custom code required)

### External Accounts

**Limitation:** Free Google accounts don't provide group membership.

**Workarounds:**
1. Manually assign roles/teams in Umami after login
2. Use Google Workspace with Admin SDK API (advanced)
3. Use Keycloak/Authentik to broker Google + add custom groups

### External Accounts

**Limitation:** Published apps allow any Google account to authenticate.

**Workarounds:**
1. Keep app in testing mode (whitelist users)
2. Use Internal user type (Google Workspace only)
3. Implement post-login email domain validation

### No Organization Control

**Limitation:** Google OAuth doesn't restrict by organization like GitHub.

**Workarounds:**
1. Use Google Workspace Internal user type
2. Implement email domain check after login
3. Use enterprise IdP (Keycloak, Authentik) to broker Google

---

## Comparison with Enterprise IdPs

| Feature | Google OAuth (Free) | Google Workspace | Authentik/Keycloak |
|---------|-------------------|------------------|-------------------|
| **OIDC support** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Groups claim** | ❌ No | ⚠️ Yes (with Admin SDK) | ✅ Yes |
| **Role mapping** | ❌ No | ⚠️ Yes (advanced setup) | ✅ Yes |
| **Team sync** | ❌ No | ⚠️ Yes (advanced setup) | ✅ Yes |
| **Email verified** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Trusted provider** | ❌ Not recommended | ✅ Recommended (Internal) | ✅ Recommended |
| **Setup complexity** | ✅ Easy (10 minutes) | ⚠️ Moderate | ⚠️ Moderate |
| **Best for** | Public instances | Enterprise Google users | Enterprise (any provider) |

---

## Best Practices

### 1. Use for Public or Small Teams

Google OAuth is ideal for:
- Public Umami instances
- Small teams without IT infrastructure
- Quick MVP/testing

### 2. Combine with Local Accounts

Allow both Google OAuth and local username/password:
- Admins use local accounts (more secure, no dependency)
- Regular users use Google (convenience)

### 3. Manual Role Assignment

Since free Google doesn't support role mapping:
1. Users log in via Google (role: `user`)
2. Admin manually promotes to `admin` or `view-only`
3. Admin manually adds users to teams

### 4. Monitor New User Creation

Enable audit logging to track:
- New users created via Google OAuth
- Review accounts periodically
- Remove inactive users

### 5. Consider Google Workspace

For organizations, Google Workspace offers:
- Internal user type (domain restriction)
- Group support (with Admin SDK)
- Better admin controls

---

## Example: Complete .env Configuration

```bash
# Database
DATABASE_URL=postgresql://umami:umami@localhost:5432/umami

# Auth.js configuration
AUTH_URL=https://analytics.example.com
AUTH_SECRET=xK9mP2qR5tW8yB3nC6fJ9mL2oP5sV8xA1dE4gH7jK0m=

# Google OAuth
GOOGLE_CLIENT_ID=123456789-xxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx

# Optional: Session duration (24 hours)
SESSION_DURATION=86400
```

---

## Next Steps

- **[Configuration Guide](../configuration.md)** - Learn about Umami configuration options
- **[Features](../features.md)** - Explore OIDC features
- **[Keycloak Guide](./keycloak.md)** - Use Keycloak to broker Google + add groups
- **Google OAuth Documentation:** https://developers.google.com/identity/protocols/oauth2
- **Google Workspace Admin SDK:** https://developers.google.com/admin-sdk
