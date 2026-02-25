# Discord OAuth 2.0 Integration with Umami

This guide walks you through setting up Discord as an OAuth 2.0 identity provider for Umami.

## Overview

Discord provides OAuth 2.0 authentication for gaming communities and developer tools.

**Provider Type:** OAuth 2.0 (Category B - manual endpoint configuration required)

**Features:**
- ✅ OAuth 2.0 support
- ✅ User profile data (username, email, avatar)
- ⚠️ Email verification unreliable
- ❌ No groups/roles support
- ❌ No OIDC logout

**Use cases:**
- Gaming community dashboards
- Discord bot analytics
- Developer-focused public instances

**Limitations:**
- ⚠️ Email verification is unreliable - **always mark as untrusted**
- ⚠️ No role/group mapping (Discord roles not exposed via OAuth)
- ❌ No OIDC logout support
- ❌ Manual endpoint configuration required (no auto-discovery)

---

## Prerequisites

- Discord account
- Umami instance with OIDC support configured (see [Configuration Guide](../configuration.md))
- Access to Discord Developer Portal

---

## Part 1: Create Discord Application

### Step 1: Access Developer Portal

1. Log in to https://discord.com/developers/applications
2. Click **New Application**
3. Enter application name (e.g., `Umami Analytics`)
4. Accept Discord Developer Terms of Service
5. Click **Create**

### Step 2: Configure OAuth2 Settings

1. In the left sidebar, click **OAuth2**
2. Under **Redirects**, click **Add Redirect**
3. Enter your Umami callback URL:

```
https://your-umami-domain.com/api/auth/callback/[provider-id]
```

**Examples:**
- Production: `https://analytics.example.com/api/auth/callback/discord`
- Development: `http://localhost:3000/api/auth/callback/discord`

> **Note:** The `[provider-id]` will be the UUID shown in Umami when you create the provider. You can update this later.

4. Click **Save Changes**

### Step 3: Get Client Credentials

1. Still on the **OAuth2** page, find the **Client information** section
2. Copy the **CLIENT ID** (e.g., `1234567890123456789`)
3. Click **Reset Secret** (if first time) or reveal existing secret
4. Copy the **CLIENT SECRET** (e.g., `AbCdEf123XyZ789...`)

> ⚠️ **Important:** Store the secret securely. If you lose it, you'll need to reset it.

---

## Part 2: Configure Umami

### Method A: Admin UI (Recommended)

1. Log in to Umami as admin
2. Navigate to **Settings** → **OIDC Providers**
3. Click **Add Provider**

Configure with these values:

| Field | Value | Notes |
|-------|-------|-------|
| **Provider ID** | `discord` | URL-safe identifier |
| **Name** | `Discord` | Display name on login button |
| **Category** | `OAuth 2.0` | Select from dropdown |
| **Client ID** | From Discord Portal | `1234567890...` |
| **Client Secret** | From Discord Portal | Keep secure |
| **Authorization URL** | `https://discord.com/api/oauth2/authorize` | Required for OAuth 2.0 |
| **Token URL** | `https://discord.com/api/oauth2/token` | Required for OAuth 2.0 |
| **Userinfo URL** | `https://discord.com/api/users/@me` | Discord user endpoint |
| **Scope** | `identify email` | Required scopes |
| **Auto-create users** | ✓ Enabled | Allow JIT provisioning |
| **Trusted provider** | ❌ **DISABLED** | Email verification unreliable |

**Important:** Always leave **Trusted provider** disabled for Discord. Email verification is unreliable.

Click **Save**.

---

### Method B: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# Discord OAuth 2.0
OIDC_ID=discord
OIDC_NAME=Discord
OIDC_CATEGORY=oauth2
OIDC_CLIENT_ID=1234567890123456789
OIDC_CLIENT_SECRET=AbCdEf123XyZ789-your-secret
OIDC_AUTH_URL=https://discord.com/api/oauth2/authorize
OIDC_TOKEN_URL=https://discord.com/api/oauth2/token
OIDC_USERINFO_URL=https://discord.com/api/users/@me
OIDC_SCOPE=identify email
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

Restart Umami after updating environment variables.

---

## Part 3: Configure Profile Mapping

Discord returns user data in this format:

```json
{
  "id": "80351110224678912",
  "username": "Nelly",
  "discriminator": "1337",
  "avatar": "8342729096ea3675442027381ff50dfe",
  "verified": true,
  "email": "nelly@discord.com",
  "flags": 64,
  "locale": "en-US"
}
```

### Profile Mapper Configuration

Umami's default profile mapper handles Discord automatically, but for reference:

| Umami Field | Discord Claim | Notes |
|-------------|---------------|-------|
| **User ID** | `id` | Unique Discord user ID |
| **Username** | `username` | Discord username (without discriminator) |
| **Email** | `email` | Requires `email` scope |
| **Email Verified** | `verified` | ⚠️ Unreliable - ignore |
| **Avatar URL** | `avatar` | Construct: `https://cdn.discordapp.com/avatars/{id}/{avatar}.png` |

**Note:** The `discriminator` field (e.g., `#1337`) was deprecated by Discord in 2023. Modern accounts use unique usernames without discriminators.

---

## OIDC Logout Behavior

### ❌ No Logout Support

Discord OAuth 2.0 **does not support** the OIDC `end_session_endpoint` for logout.

**How logout works:**
1. User clicks "Logout" in Umami
2. Umami clears its JWT session cookie
3. Umami redirects to `/login`
4. **Discord session remains active**

**Impact:**
- If the same browser is reused, clicking "Login with Discord" will auto-login without prompting
- Shared/public computers may auto-login the previous user

**Recommendations:**
1. Educate users to log out of Discord separately if using shared devices
2. Document this behavior in user onboarding
3. For sensitive use cases, consider using an enterprise IdP (Authentik, Keycloak) that brokers Discord and adds logout support

---

## Role Mapping & Team Sync

### ❌ Not Supported

Discord OAuth 2.0 does **not** expose server roles or group membership via the standard OAuth flow.

**Limitations:**
- No `groups` claim in user data
- Server roles require separate Discord Bot API integration
- Cannot auto-assign Umami roles based on Discord roles
- Cannot sync team memberships
- The **Role Mappings** tab is not available for Discord providers in Umami's admin UI

All Discord users who log in will receive the default `user` role.

### Workarounds

| Approach | Complexity | Description |
|----------|------------|-------------|
| **Manual assignment** | Low | Assign roles/teams in Umami admin UI after users log in |
| **Discord Bot middleware** | High | Build custom middleware using Discord Bot API to fetch guild member roles |
| **Discord + Keycloak** | Medium | Use Keycloak to broker Discord auth and add group mappings |
| **Discord + Authentik** | Medium | Use Authentik to broker Discord auth and add group claims |

### Recommended Approach

If you need role mapping with Discord authentication:

1. Set up **Keycloak** or **Authentik** as your primary identity provider
2. Configure Discord as a **social login source** in Keycloak/Authentik
3. Create groups in Keycloak/Authentik and assign users
4. Umami will receive group claims from Keycloak/Authentik

---

## Troubleshooting

### Login fails with "invalid_request"

**Cause:** Redirect URI mismatch.

**Solution:**
1. Check exact callback URI in Umami provider settings
2. Ensure it exactly matches the redirect URI in Discord Developer Portal
3. Include protocol (`https://` or `http://`) and full path

### Email not returned

**Cause:** Missing `email` scope.

**Solution:**
1. Verify scope includes `email` in Umami configuration
2. User must grant email permission during Discord OAuth consent
3. Some users may have email privacy settings that prevent sharing

### Email verification issues

**Cause:** Discord's `verified` field is unreliable.

**Solution:**
1. **Always mark Discord as untrusted** in Umami
2. Require manual email verification in Umami after first login
3. Do not use `email_verified` claim for account linking

### Avatar not displaying

**Cause:** Avatar URL construction incorrect.

**Solution:**

Construct avatar URL as:
```
https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png
```

If avatar is `null`, use default Discord avatar:
```
https://cdn.discordapp.com/embed/avatars/{discriminator % 5}.png
```

---

## Known Limitations

### Email Verification Unreliable

**Limitation:** Discord's `verified` field in the OAuth response exists but is unreliable. It does not consistently reflect whether the user has verified their email with Discord.

**Impact:** Cannot trust `email_verified` claim for automatic account linking or email verification bypass.

**Workarounds:**
1. **Always mark Discord as untrusted** in Umami provider settings
2. Implement manual email verification flow in Umami
3. Accept that users must verify email separately

### No Role or Group Mapping

**Limitation:** Discord OAuth 2.0 does not expose Discord server roles or group membership in the OAuth user data.

**Impact:** Cannot automatically assign Umami roles based on Discord roles. Cannot sync team memberships.

**Workarounds:**
1. Manually assign roles/teams in Umami UI
2. Build custom Discord Bot integration (requires Bot API, guild member permissions, and custom middleware)
3. Use federated IdP (Authentik/Keycloak) to broker Discord and add group mapping

### No OIDC Logout

**Limitation:** Discord OAuth 2.0 does not support the OIDC `end_session_endpoint`. Logging out of Umami does not log users out of Discord.

**Impact:** Users remain logged into Discord after logging out of Umami. Shared devices may auto-login.

**Workarounds:**
1. Educate users to log out of Discord separately
2. Use federated IdP with logout support
3. Document this limitation in user guides

### Always Untrusted

**Limitation:** Due to unreliable email verification, Discord must always be configured as **untrusted**.

**Impact:** Users cannot auto-link existing Umami accounts by email. Increases friction for users with existing accounts.

**Workarounds:**
1. Accept this as a security trade-off
2. Manually link accounts in Umami admin UI if needed
3. Use a different primary IdP (Google, Entra ID) for trusted authentication

### Non-Standard API

**Limitation:** Discord's OAuth implementation uses non-standard userinfo endpoint (`/users/@me` instead of `/oauth2/userinfo`).

**Impact:** Requires manual endpoint configuration (no auto-discovery). Cannot use generic OIDC provider setup.

**Workarounds:**
1. Use Category B (OAuth 2.0) provider type in Umami
2. Manually specify all endpoints (authorization, token, userinfo)
3. Already documented in this guide

---

## Comparison with Other OAuth Providers

| Feature | Discord | GitHub | Slack | Google |
|---------|---------|--------|-------|--------|
| **Protocol** | OAuth 2.0 | OAuth 2.0 | OAuth 2.0 | OIDC |
| **Auto-discovery** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Groups/roles** | ❌ No | ❌ No | ❌ No | ❌ No (free) |
| **Email verified** | ⚠️ Unreliable | ⚠️ Optional | ✅ Yes | ✅ Yes |
| **Logout support** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Trusted provider** | ❌ Never | ❌ Not recommended | ✅ Possible | ⚠️ Workspace only |
| **Setup complexity** | ⚠️ Moderate | ✅ Easy | ⚠️ Moderate | ✅ Easy |
| **Best for** | Gaming communities | Developers | Workspaces | General public |

---

## Best Practices

### 1. Use for Gaming/Community Instances Only

Discord OAuth is ideal for:
- Gaming community analytics dashboards
- Discord bot monitoring tools
- Developer-focused public instances
- Non-sensitive analytics

**Not recommended for:**
- Enterprise applications requiring role-based access
- Financial or healthcare data analytics
- Applications requiring email verification

### 2. Always Mark as Untrusted

```json
{
  "trusted": false
}
```

Never enable the trusted flag for Discord providers.

### 3. Implement Manual Role Assignment

Since Discord roles are not available via OAuth:
1. Create default user role for all Discord logins
2. Manually promote users to admin/view-only as needed
3. Use Umami's team management to control access

### 4. Document Logout Limitations

Inform users that:
- Logging out of Umami doesn't log them out of Discord
- Shared devices should also log out of Discord
- Browser private/incognito mode recommended for shared computers

### 5. Consider Federation for Advanced Features

For role mapping or logout support:
1. Set up Authentik or Keycloak
2. Configure Discord as an external IdP
3. Add custom groups/roles in Authentik
4. Point Umami to Authentik instead of Discord directly

---

## Security Considerations

### 1. Client Secret Protection

- Store `CLIENT_SECRET` in environment variables or encrypted database (Umami auto-encrypts)
- Never commit secrets to version control
- Rotate secrets periodically in Discord Developer Portal

### 2. Redirect URI Validation

- Use exact URI matching (Discord enforces this)
- Only add legitimate redirect URIs
- Remove development URIs in production

### 3. Limited Permission Scopes

Only request necessary scopes:
```
identify email
```

Do NOT request unnecessary scopes like `guilds`, `guilds.members.read` unless you have a specific integration need.

### 4. Rate Limiting

Discord API has rate limits:
- 50 requests per second per endpoint
- Umami should stay well below this during normal auth flows

### 5. Monitor for Suspicious Activity

- Review Umami audit logs (Settings → Audit Logs)
- Check Discord Developer Portal for unusual token usage
- Revoke tokens for compromised accounts

---

## Additional Resources

- [Discord Developer Documentation](https://discord.com/developers/docs)
- [Discord OAuth2 Guide](https://discord.com/developers/docs/topics/oauth2)
- [Discord API Reference](https://discord.com/developers/docs/reference)
- [Umami OIDC Overview](../README.md)

---

## Support

If you encounter issues:

1. Check this troubleshooting guide first
2. Review Discord Developer Portal application logs
3. Check Umami logs for OIDC errors
4. Join [Umami Discord](https://discord.gg/4dz4zcXYrQ) for community support
5. Review [Discord Developer Community](https://discord.gg/discord-developers)
