# GitHub OAuth Integration with Umami

This guide walks you through configuring GitHub as an OAuth provider for Umami authentication.

## Overview

GitHub provides OAuth 2.0 authentication but **does not support full OpenID Connect (OIDC)**. However, it works seamlessly with Auth.js, which handles the differences automatically.

**Key differences from OIDC:**
- No ID token (uses access token + userinfo endpoint)
- Limited claims (no `groups` claim)
- Email addresses may not be verified

**Use cases:**
- Public Umami instances
- Developer-focused teams
- Quick setup without enterprise IdP

**Limitations:**
- ❌ No role mapping (no groups claim)
- ❌ No team sync (no groups claim)
- ⚠️ Email may be private or unverified
- ⚠️ Not recommended for "trusted provider" flag

---

## Part 1: Create GitHub OAuth App

### Step 1: Access GitHub Settings

**For personal account:**
1. Go to https://github.com/settings/developers
2. Click **OAuth Apps**
3. Click **New OAuth App**

**For organization:**
1. Go to `https://github.com/organizations/{org-name}/settings/applications`
2. Click **OAuth Apps** (under Developer settings)
3. Click **New OAuth App**

### Step 2: Register Application

Fill in the application details:

| Field | Value | Example |
|-------|-------|---------|
| **Application name** | `Umami Analytics` | Display name users will see |
| **Homepage URL** | Your Umami URL | `https://analytics.example.com` |
| **Application description** | (optional) | `Web analytics platform` |
| **Authorization callback URL** | Callback endpoint | `https://analytics.example.com/api/auth/callback/github` |

**Callback URL format:**
```
{UMAMI_URL}/api/auth/callback/github
```

**Examples:**
- Production: `https://analytics.example.com/api/auth/callback/github`
- Development: `http://localhost:3000/api/auth/callback/github`

Click **Register application**.

### Step 3: Get Client Credentials

After creating the app:

1. **Client ID** is displayed on the page (copy it)
2. Click **Generate a new client secret**
3. **Client secret** is shown once (copy it immediately)

> ⚠️ **Important:** The client secret is shown only once. If you lose it, you'll need to generate a new one.

---

## Part 2: Configure Umami

You can configure GitHub OAuth via environment variables OR the admin UI.

### Method A: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# GitHub OAuth
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXX
GITHUB_CLIENT_SECRET=your-github-client-secret
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
| **Name** | `GitHub` |
| **Type** | `github` |
| **Client ID** | (from Step 3) |
| **Client Secret** | (from Step 3) |
| **Scope** | `user:email read:user` |
| **Authorization URL** | `https://github.com/login/oauth/authorize` |
| **Token URL** | `https://github.com/login/oauth/access_token` |
| **Userinfo URL** | `https://api.github.com/user` |
| **Trusted Provider** | ☐ Unchecked (recommended) |
| **Admin Group** | (leave blank - GitHub doesn't provide groups) |
| **View-Only Group** | (leave blank) |
| **Team Mappings** | (leave blank) |

5. **Copy the Callback URI** shown in the form
6. Click **Save**

> **Note:** GitHub doesn't support role mapping or team sync because it doesn't provide a `groups` claim.

---

## Part 3: Verify Configuration

### Test Login Flow

1. Log out of Umami
2. Navigate to login page
3. Click **Sign in with GitHub** button
4. Authorize the application on GitHub
5. Redirected back to Umami and logged in

### Check User Creation

1. Log in as admin → **Settings** → **Users**
2. Verify GitHub user was created with:
   - **Email:** From GitHub account
   - **Username:** GitHub username
   - **Role:** `user` (default)

### Check Audit Logs

1. Go to **Settings** → **Audit Logs**
2. Verify login event with:
   - Action: `login`
   - Provider: `github`
   - User email and IP

---

## Advanced Configuration

### Email Privacy Issues

GitHub allows users to make email addresses private. If a user has hidden their email:

**Solution 1: Request email scope**
GitHub automatically requests the `user:email` scope, which provides access to private email addresses.

**Solution 2: Require verified emails**
In your GitHub OAuth app settings:
1. Enable **Require email verification**
2. Users without verified emails will be rejected

### Organization Membership

To restrict login to members of a specific GitHub organization:

**Option 1: Use GitHub App (not OAuth App)**
1. Create a GitHub App instead of OAuth App
2. Use Auth.js's GitHub provider with organization restriction
3. Requires custom configuration

**Option 2: Manual verification**
Check organization membership after login and reject unauthorized users.

### Multiple GitHub Accounts

Users can have multiple GitHub accounts. Each GitHub account will create a separate Umami user (by email).

To link accounts:
1. User logs in with GitHub
2. If email matches an existing Umami user, accounts can be linked
3. Only works if provider is marked "trusted" (not recommended for GitHub)

---

## Role Mapping & Team Sync

### ❌ Not Supported

GitHub OAuth 2.0 does **not** expose organization roles, team memberships, or group claims via the standard OAuth flow.

**Limitations:**
- No `groups` claim in user data
- Organization membership requires separate GitHub API calls
- Team membership requires admin-level GitHub API access
- Cannot auto-assign Umami roles based on GitHub org roles
- Cannot sync team memberships

### Workarounds

| Approach | Complexity | Description |
|----------|------------|-------------|
| **Manual assignment** | Low | Assign roles/teams in Umami admin UI after users log in |
| **GitHub + Keycloak** | Medium | Use Keycloak to broker GitHub auth and add group mappings |
| **GitHub + Authentik** | Medium | Use Authentik to broker GitHub auth and add group claims |
| **Custom middleware** | High | Build middleware using GitHub API to fetch org/team membership |

### Recommended Approach

If you need role mapping with GitHub authentication:

1. Set up **Keycloak** or **Authentik** as your primary identity provider
2. Configure GitHub as a **social login source** in Keycloak/Authentik
3. Create groups in Keycloak/Authentik and assign users
4. Umami will receive group claims from Keycloak/Authentik

All GitHub users who log in directly will receive the default `user` role.

---

## Logout Behavior

### ❌ No OIDC Logout Support

GitHub OAuth **does not support RP-initiated logout** (`end_session_endpoint`). Similar to Google, GitHub does not allow third-party applications to terminate GitHub sessions.

When users click "Logout" in Umami:

```
1. Umami clears its JWT session cookie ✅
2. User is logged out of Umami ✅
3. GitHub session remains active ⚠️
```

**Result:** User is logged out of Umami, but their GitHub session stays alive.

### What This Means for Users

If a user clicks "Sign in with GitHub" again immediately after logout:
- GitHub recognizes they're already signed in
- **No password prompt** - instant SSO login
- User is logged back into Umami with one click

**This is expected behavior** and cannot be changed - it's how GitHub OAuth works for all third-party applications.

### User Actions to Fully Log Out

If users want to fully log out from GitHub (not just Umami):

1. Log out from Umami
2. Go to https://github.com/
3. Click profile → **Sign out**

Or sign out of their entire GitHub account in their browser.

### Alternative: Revoke OAuth Access

Users can revoke Umami's access to their GitHub account:

1. Go to https://github.com/settings/applications
2. Find **Umami Analytics** (or your app name)
3. Click **Revoke access**

Next login will require re-authorizing the application.

### Comparison with Other Providers

| Provider | Logout Support | User Experience |
|----------|----------------|-----------------|
| **GitHub** | ❌ No `end_session_endpoint` | Cookie deleted, GitHub session stays active |
| **Google** | ❌ No `end_session_endpoint` | Cookie deleted, Google session stays active |
| **Authentik** | ✅ Full RP-initiated logout | Both Umami and Authentik sessions terminated |
| **Keycloak** | ✅ Full RP-initiated logout | Both Umami and Keycloak sessions terminated |

### Recommendation

**Accept this limitation.** It's standard for public OAuth providers (GitHub, Google, Discord, Slack).

For enterprise deployments where full SSO logout is required:
- Use **Keycloak** or **Authentik** as an identity broker
- Configure GitHub as an upstream IdP in Keycloak/Authentik
- Umami connects to Keycloak/Authentik (which supports logout)
- Users authenticate via GitHub through the bridge
- Logging out terminates the Keycloak/Authentik session (GitHub session may remain, but next Umami login requires Keycloak re-auth)

---

## Security Considerations

### 1. Don't Mark as Trusted Provider

**Reasoning:**
- GitHub emails may not be verified
- Users can change their email addresses
- Public OAuth provider (anyone can sign up)

**Recommendation:** Leave "Trusted Provider" unchecked.

### 2. Email Verification

GitHub provides `email_verified` status. Umami respects this:
- If `email_verified: false`, account linking is prevented
- Users may need to verify their email in GitHub first

### 3. Rotate Client Secret

Periodically rotate the client secret:
1. In GitHub OAuth App settings → **Generate a new client secret**
2. Update in Umami provider settings
3. Old secret remains valid for 24 hours (GitHub grace period)

### 4. Monitor Failed Logins

Check audit logs regularly for:
- Failed login attempts
- Unusual email addresses
- Suspicious IP addresses

### 5. Restrict by Organization (Advanced)

For private Umami instances, consider:
- Using GitHub Enterprise with SAML/OIDC instead
- Implementing custom organization check after login
- Using Keycloak/Authentik to broker GitHub + add group logic

---

## Troubleshooting

### "Redirect URI mismatch"

**Cause:** Callback URL in GitHub doesn't match.

**Solution:**
1. Check GitHub OAuth App → **Authorization callback URL**
2. Should be: `https://analytics.example.com/api/auth/callback/github`
3. Ensure exact match (no trailing slash, correct protocol)

### "Email is required for login"

**Cause:** User has private email on GitHub.

**Solution:**
1. Verify scopes include `user:email`
2. User must make email public or grant permission
3. Consider marking provider as "trusted" (use with caution)

### Login works but user has no access

**Cause:** User role is `user` by default.

**Solution:**
- Admin must manually grant permissions to websites/teams
- Or promote user to admin role in Umami

### "Application suspended"

**Cause:** GitHub suspended the OAuth app.

**Solution:**
- Check GitHub app settings for suspension notice
- Review for policy violations
- Contact GitHub support if needed

---

## Limitations & Workarounds

### No OIDC Logout Support

**Limitation:** GitHub OAuth 2.0 does not support the OIDC `end_session_endpoint` for logout. When users log out of Umami, only the Umami session is cleared - their GitHub session remains active.

**Impact:** If a user logs out of Umami and another person uses the same browser, they may be automatically logged back in with the previous GitHub account.

**Workarounds:**
1. Educate users to log out of GitHub separately if using shared computers
2. Document this behavior in user training materials
3. Consider using a federated IdP (Authentik, Keycloak) that brokers GitHub and adds logout support

### No Role Mapping

**Limitation:** GitHub doesn't provide a `groups` claim.

**Workarounds:**
1. Manually assign roles in Umami after login
2. Use Keycloak/Authentik to broker GitHub + add custom groups
3. Use GitHub organization membership check (requires GitHub App)

### No Team Sync

**Limitation:** GitHub doesn't provide group membership in claims.

**Workarounds:**
1. Manually add users to teams in Umami
2. Use GitHub organization teams with custom integration
3. Use an IdP that brokers GitHub (Authentik, Keycloak)

### Email Privacy

**Limitation:** Users can hide their email address in their GitHub profile settings. GitHub's OAuth may not return an email if privacy settings prevent it.

**Impact:** Without an email address, Umami cannot create or link a user account (email is required).

**Workarounds:**
1. Request the `user:email` scope (this guide includes it by default) - accesses private emails via API
2. For GitHub Enterprise: Require "Show email address" in organization SAML/SSO settings
3. Use a federated IdP instead of public GitHub OAuth
4. Note: The OAuth App automatically queries the `/user/emails` API endpoint if no public email exists

### Organization Membership Requires Separate API Call

**Limitation:** GitHub OAuth tokens do not include organization membership in the ID token. To check if a user belongs to a specific GitHub organization, you must make a separate API call to `/user/orgs`.

**Impact:** Cannot restrict access to organization members without custom middleware.

**Workarounds:**
1. Implement custom middleware to call `/user/orgs` API and validate membership
2. Use GitHub Apps instead of OAuth Apps (more complex but offers better org integration)
3. Use Authentik/Keycloak to broker GitHub and add organization-based group mapping
4. Accept that any GitHub user can authenticate and manually manage access in Umami

---

## Comparison with Enterprise IdPs

| Feature | GitHub OAuth | Authentik/Keycloak |
|---------|--------------|-------------------|
| **OIDC support** | ❌ OAuth 2.0 only | ✅ Full OIDC |
| **Groups claim** | ❌ No | ✅ Yes |
| **Role mapping** | ❌ No | ✅ Yes (via groups) |
| **Team sync** | ❌ No | ✅ Yes (via groups) |
| **Email verified** | ⚠️ Optional | ✅ Guaranteed (if configured) |
| **Trusted provider** | ❌ Not recommended | ✅ Recommended |
| **Setup complexity** | ✅ Easy (5 minutes) | ⚠️ Moderate (15+ minutes) |
| **Best for** | Public instances, developers | Enterprise, internal tools |

---

## Best Practices

### 1. Use for Public Instances Only

GitHub OAuth is ideal for:
- Open-source project analytics
- Developer community dashboards
- Public Umami instances

### 2. Combine with Local Accounts

Allow both GitHub OAuth and local username/password:
- Admins use local accounts (more secure)
- Regular users use GitHub (convenience)

### 3. Manual Role Assignment

Since GitHub doesn't support role mapping:
1. Users log in via GitHub (role: `user`)
2. Admin manually promotes to `admin` or `view-only` as needed
3. Admin manually adds users to teams

### 4. Monitor New User Creation

Enable audit logging to track:
- New users created via GitHub OAuth
- Review new accounts periodically
- Remove inactive users

### 5. Consider GitHub Enterprise

For organizations, GitHub Enterprise offers:
- SAML/OIDC support
- Organization-level controls
- Verified email enforcement

---

## Example: Complete .env Configuration

```bash
# Database
DATABASE_URL=postgresql://umami:umami@localhost:5432/umami

# Auth.js configuration
AUTH_URL=https://analytics.example.com
AUTH_SECRET=xK9mP2qR5tW8yB3nC6fJ9mL2oP5sV8xA1dE4gH7jK0m=

# GitHub OAuth
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXX
GITHUB_CLIENT_SECRET=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Session duration (24 hours)
SESSION_DURATION=86400
```

---

## Next Steps

- **[Configuration Guide](../configuration.md)** - Learn about Umami configuration options
- **[Features](../features.md)** - Explore OIDC features
- **[Keycloak Guide](./keycloak.md)** - Use Keycloak to broker GitHub + add groups
- **GitHub OAuth Documentation:** https://docs.github.com/en/developers/apps/building-oauth-apps
