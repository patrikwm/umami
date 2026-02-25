# Okta OIDC Provider Setup Guide

This guide explains how to configure Okta as an OpenID Connect (OIDC) provider for Umami.

---

## Overview

**Provider Type:** OIDC (Category A - Full OIDC with auto-discovery)
**Groups Support:** ✅ Yes (with custom authorization server)
**Email Verification:** ✅ Trusted (Okta verifies email ownership)
**Logout Support:** ✅ RP-initiated logout supported

Okta provides enterprise-grade identity management with full OIDC support. The main configuration consideration is choosing between the org-level authorization server and a custom authorization server.

---

## Prerequisites

- Okta account (any tier: Developer, Workforce Identity, Customer Identity)
- Admin access to Okta Admin Console
- Umami instance with OIDC support enabled

---

## Part 1: Create Application in Okta

### Step 1: Access Applications

1. Log in to **Okta Admin Console** (e.g., `https://company.okta.com/admin`)
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**

### Step 2: Configure Sign-In Method

1. Select **Sign-in method:** `OIDC - OpenID Connect`
2. Select **Application type:** `Web Application`
3. Click **Next**

### Step 3: App Integration Settings

Configure the following settings:

**General Settings:**
- **App integration name:** `Umami Analytics` (or your preferred name)
- **Logo:** (optional) Upload your Umami logo

**Grant types:** (select the following)
- ✅ **Authorization Code**
- ✅ **Refresh Token** (optional, for long-lived sessions)

**Sign-in redirect URIs:**
```
https://your-umami-domain.com/api/auth/callback/[provider-id]
```
Replace `[provider-id]` with the actual UUID shown in Umami provider form.

**Sign-out redirect URIs:**
```
https://your-umami-domain.com/login
```

**Controlled access:**
- Select who can use this application:
  - **Allow everyone in your organization to access** (default)
  - OR **Limit access to selected groups** (recommended for production)

Click **Save**.

### Step 4: Note Client Credentials

After saving, you'll see the application details page. Note these values for Umami configuration:

- **Client ID:** (e.g., `0oa1234abcd5678efgh`)
- **Client secret:** Click **Show** to reveal (e.g., `ABCdef123-XYZ789_qwertyuiopasdfghjklzxcvbnm`)

Keep this page open - you'll need these values.

---

## Part 2: Configure Authorization Server (for Groups Support)

**Important:** The default **Org Authorization Server** (`https://company.okta.com`) does NOT include the `groups` claim in tokens. To get group membership, you must use a **Custom Authorization Server**.

### Option A: Use Default Authorization Server (No Groups)

If you don't need group-based role mapping:

**Issuer URL:**
```
https://company.okta.com
```

**Scopes:**
```
openid profile email
```

**Groups Support:** ❌ No

---

### Option B: Use Custom Authorization Server (Recommended for Groups)

#### Step 1: Create or Use Existing Authorization Server

1. In Okta Admin Console, go to **Security** → **API**
2. You'll see **Authorization Servers** tab
3. Okta provides a built-in `default` server at:
   ```
   https://company.okta.com/oauth2/default
   ```
   Or create a new custom server if needed

#### Step 2: Configure Groups Claim

1. Click on your authorization server (e.g., `default`)
2. Go to **Claims** tab
3. Click **Add Claim**

**Claim configuration:**
- **Name:** `groups`
- **Include in token type:** `ID Token` and `Access Token` (both)
- **Value type:** `Groups`
- **Filter:** `Matches regex` → `.*` (all groups) OR `Starts with` → `umami-` (only Umami groups)
- **Include in:** `Any scope`

Click **Create**.

#### Step 3: Add Groups Scope (Optional but Recommended)

1. Go to **Scopes** tab
2. Click **Add Scope**

**Scope configuration:**
- **Name:** `groups`
- **Description:** `Access to user's group membership`
- **Include in public metadata:** ✅ (checked)

Click **Create**.

---

## Part 3: Assign Users/Groups to Application

### Step 1: Assign Access

1. Go back to **Applications** → **Applications** → Your Umami app
2. Click **Assignments** tab
3. Click **Assign** → Choose:
   - **Assign to People** (individual users)
   - **Assign to Groups** (recommended for scalability)

### Step 2: Assign Groups (Recommended)

For easier management:

1. Click **Assign** → **Assign to Groups**
2. Select groups that should have Umami access:
   - `umami-admins` → Admins
   - `umami-users` → Regular users
   - `umami-viewers` → View-only users
3. Click **Assign** for each group
4. Click **Done**

---

## Part 4: Configure Provider in Umami

In Umami Admin UI (**Admin** → **Providers** → **Add Provider**):

### Required Fields

**Provider Name:**
```
Okta
```

**Provider Type:**
```
Okta
```

**Issuer URL:**

For **org-level server** (no groups):
```
https://company.okta.com
```

For **custom auth server** (with groups):
```
https://company.okta.com/oauth2/default
```
Or for a custom server:
```
https://company.okta.com/oauth2/{authServerId}
```

**Client ID:**
```
[paste Client ID from Okta]
```

**Client Secret:**
```
[paste Client Secret from Okta]
```

**Scopes:**

For **org-level server**:
```
openid profile email
```

For **custom auth server with groups**:
```
openid profile email groups
```

---

### Optional Fields

**Authorization URL:** (leave empty - auto-discovered)

**Token URL:** (leave empty - auto-discovered)

**Userinfo URL:** (leave empty - auto-discovered)

**Trusted:** ✅ **Yes** (Okta verifies email addresses)

**Admin Group:** (if using custom auth server with groups)
```
umami-admins
```
Users in this Okta group will get the `admin` role in Umami.

**View-Only Group:** (if using custom auth server with groups)
```
umami-viewers
```
Users in this Okta group will get read-only access.

**Auto-create Users:** ✅ **Yes** (recommended)

**Enabled:** ✅ **Yes**

---

### Extra Configuration (Okta-Specific)

**Authorization Server ID:** (optional)
```
default
```

This field is used when you want Umami to automatically construct the issuer URL. If you already provided the full issuer URL above (e.g., `https://company.okta.com/oauth2/default`), you can leave this empty.

**How it works:**
- If **Issuer URL** = `https://company.okta.com` and **authServerId** = `default`
- Umami constructs: `https://company.okta.com/oauth2/default`

---

## Part 5: Role Mapping & Team Sync

Umami can automatically assign roles and team memberships based on Okta group claims. Configure these in the **Role Mappings** tab when adding or editing the provider in Umami's admin UI.

> **Prerequisite:** Role mapping requires a **custom authorization server** (not the org-level server). Ensure you completed Part 2 with Option B and added a `groups` claim.

### Understanding Umami Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, websites, and providers |
| **View-only** | Read-only access to all websites and dashboards |
| **User** | Default role: can access websites they're assigned to |

### How It Works

On every login, Umami:
1. Reads the `groups` claim from the Okta ID token
2. Checks if the user is in the **Admin Group** → assigns `role = admin`
3. Else checks if the user is in the **View-Only Group** → assigns `role = view-only`
4. Otherwise → assigns `role = user` (default)

**Priority:** Admin > View-only > User

### Configure Role Mapping

In Umami, edit the Okta provider and go to the **Role Mappings** tab:

| Field | Value | Description |
|-------|-------|-------------|
| **Admin Group** | `umami-admins` | Okta group name for admin users |
| **View-Only Group** | `umami-viewers` | Okta group name for read-only users |

> **Note:** These must exactly match the Okta group names assigned to the application (Part 3). Group matching is case-sensitive.

### Verifying Group Claims

To verify Okta is sending the `groups` claim correctly:

1. Log in via Okta
2. Decode the ID token at https://jwt.io
3. Look for the `groups` field:

```json
{
  "sub": "abc123",
  "email": "user@example.com",
  "groups": ["umami-admins", "Everyone"]
}
```

If the `groups` claim is missing:
- Verify you're using a **custom auth server** (not org-level)
- Check that the `groups` claim is configured in the auth server's claims settings
- Ensure the groups scope is included: `openid profile email groups`

### Team Sync (Optional)

To automatically add users to Umami teams based on Okta groups, use the **Team Mappings** field in the same **Role Mappings** tab:

1. Create teams in Umami (via **Settings** → **Teams**)
2. Note each team's ID (from URL: `/admin/teams/{team-id}`)
3. Enter Team Mappings as JSON:

```json
{
  "engineering-group": "abc123-team-id-uuid",
  "marketing-group": "def456-team-id-uuid"
}
```

**How it works:**
- **Key:** Okta group name (from `groups` claim)
- **Value:** Umami team ID (UUID)
- User in Okta group → added to Umami team on next login
- User removed from Okta group → removed from Umami team on next login
- Manual team memberships (`source: 'manual'`) are preserved

---

## Part 6: Test the Integration

### Step 1: Test Login

1. Log out of Umami
2. Go to login page: `https://your-umami-domain.com/login`
3. Click **Continue with Okta**
4. You should be redirected to Okta login
5. Enter credentials
6. After successful authentication, you should be redirected back to Umami dashboard

### Step 2: Verify User Profile

1. Check that your Umami user profile shows:
   - ✅ Email from Okta
   - ✅ Display name from Okta
   - ✅ Correct role (if using group mapping)

### Step 3: Test Group-Based Roles (if configured)

1. Create a test user in Okta
2. Add them to `umami-admins` group
3. Have them log in to Umami
4. Verify they have **Admin** role in Umami

---

## Part 7: OIDC Logout Behavior

### RP-Initiated Logout

Okta supports **RP-initiated logout** (also called OIDC logout or single logout). When users click "Logout" in Umami:

1. Umami calls `/api/auth/signout` (local session destroyed)
2. User is redirected to Okta's logout endpoint:
   ```
   https://company.okta.com/oauth2/default/v1/logout
   ```
   (or org-level: `https://company.okta.com/oauth2/v1/logout`)
3. Okta terminates the SSO session
4. User is redirected back to Umami login page

**This means:**
- ✅ User is logged out of Okta (SSO session terminated)
- ✅ User is logged out of all applications using this Okta session
- ✅ Clean logout experience

### Logout Flow Diagram

```
User clicks "Logout"
    ↓
Umami destroys local session
    ↓
Redirect to Okta logout:
https://company.okta.com/oauth2/default/v1/logout?
  id_token_hint={id_token}&
  post_logout_redirect_uri=https://umami.company.com/login
    ↓
Okta terminates SSO session
    ↓
Okta redirects back to Umami login page
```

---

## Field Requirements Summary

| Field | Required | Value | Notes |
|---|---|---|---|
| **Client ID** | ✅ Yes | From Okta app | Found in app details |
| **Client Secret** | ✅ Yes | From Okta app | Click "Show" to reveal |
| **Issuer URL** | ✅ Yes | `https://company.okta.com/oauth2/default` | Custom auth server recommended |
| **Auth URL** | ❌ No | (auto-discovered) | Leave empty |
| **Token URL** | ❌ No | (auto-discovered) | Leave empty |
| **Userinfo URL** | ❌ No | (auto-discovered) | Leave empty |
| **Scopes** | ✅ Yes | `openid profile email groups` | Add `groups` for role mapping |
| **Trusted** | ✅ Yes | `true` | Okta is enterprise-grade |
| **Admin Group** | ⚠️ Optional | `umami-admins` | Only works with custom auth server |
| **View-Only Group** | ⚠️ Optional | `umami-viewers` | Only works with custom auth server |

---

## Common Issues & Troubleshooting

### Issue: "Groups claim not in token"

**Symptoms:**
- User logs in successfully
- Group-based role assignment doesn't work
- Token doesn't contain `groups` claim

**Causes:**
1. Using org-level authorization server instead of custom server
2. Groups claim not configured in authorization server
3. Groups scope not requested

**Solution:**
1. Verify you're using custom authorization server:
   ```
   https://company.okta.com/oauth2/default
   ```
   NOT just `https://company.okta.com`

2. Check **Security** → **API** → **default** → **Claims** → Verify `groups` claim exists

3. Verify scope in Umami includes `groups`:
   ```
   openid profile email groups
   ```

---

### Issue: "invalid_client" error

**Symptoms:**
- Error during login: "invalid_client"

**Causes:**
1. Wrong Client ID
2. Wrong Client Secret
3. Application disabled in Okta

**Solution:**
1. Double-check Client ID and Secret in Okta app settings
2. Verify app is **Active** in Okta (not suspended)
3. Regenerate client secret if needed

---

### Issue: "Redirect URI mismatch"

**Symptoms:**
- Error: "redirect_uri_mismatch" or similar

**Causes:**
- Callback URI in Okta doesn't match Umami's callback URI

**Solution:**
1. Get exact callback URI from Umami provider form
2. Add it **exactly** to Okta **Sign-in redirect URIs**
3. Include protocol (`https://`) and full path

---

### Issue: User can't log in - "Not assigned"

**Symptoms:**
- Error in Okta: "This application is not assigned to you"

**Causes:**
- User or their group is not assigned to the Okta application

**Solution:**
1. Go to Okta app → **Assignments** tab
2. Click **Assign** → **Assign to People** or **Assign to Groups**
3. Add the user or their group

---

## Known Limitations

### Groups Claim Requires Custom Authorization Server

**Limitation:** The default Okta authorization server (org-level `https://company.okta.com`) does NOT include the `groups` claim in ID tokens. You must use a custom authorization server.

**Impact:** Without a custom authorization server, role mapping and team sync will not work.

**Workarounds:**
1. Create a custom authorization server (see "Option B" in this guide)
2. Use the `default` custom authorization server (included in all Okta accounts)
3. Alternative: Manually assign roles/teams in Umami after user login

### Groups Filter Required in Custom Authorization Server

**Limitation:** Even with a custom authorization server, groups are not automatically included in tokens. You must explicitly configure a `groups` claim with filter criteria.

**Impact:** Without proper claim configuration, no group information is sent to Umami.

**Workarounds:**
1. Follow the custom authorization server setup in this guide (Part 2: Option B)
2. Configure groups claim with filter (e.g., `Regex: .*` to include all groups)
3. Verify groups claim appears in token using jwt.io

### Token Refresh Behavior Differs from Other Providers

**Limitation:** Okta's refresh token rotation policy may differ from other providers. By default, Okta rotates refresh tokens on each use.

**Impact:** If Umami implements refresh token logic in the future, it must handle Okta's rotation behavior correctly.

**Workarounds:**
1. Currently not an issue (Umami doesn't use refresh tokens)
2. Future consideration for long-lived sessions
3. Can configure refresh token rotation policy in Okta

### Org vs Custom Authorization Server Confusion

**Limitation:** Okta has two types of authorization servers (org-level and custom), which can be confusing for first-time setup.

**Impact:** Users may configure the org-level server and expect groups to work, but they won't.

**Workarounds:**
1. Always use custom authorization server for Umami (this guide recommends it)
2. Issuer URL should include `/oauth2/{authServerId}` path
3. Verify issuer format matches custom server pattern

### Group Name Length Limits

**Limitation:** Okta group names have a maximum length of 255 characters, but very long group names in tokens may cause issues.

**Impact:** Tokens may become large if users are in many groups with long names.

**Workarounds:**
1. Keep group names concise and descriptive
2. Use group filters to limit which groups are sent to Umami
3. Only include Umami-relevant groups in the claim

---

## Comparison with Other Providers

| Feature | Okta | Authentik | Keycloak | Google | GitHub |
|---|---|---|---|---|---|
| **Category** | OIDC | OIDC | OIDC | OIDC-quirks | OAuth 2.0 |
| **Auto-discovery** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Groups support** | ⚠️ Custom server only | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Email verified** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **RP-initiated logout** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Endpoint config** | Auto | Auto | Auto | Auto | Manual |
| **Best for** | Enterprise | Self-hosted | Self-hosted | Quick setup | Public apps |

---

## Security Recommendations

1. **Use Custom Authorization Server** for group claims - don't rely on org-level server for role mapping
2. **Limit group assignments** - only assign groups that need Umami access
3. **Enable Multi-Factor Authentication (MFA)** in Okta for all users
4. **Use Group-based assignment** instead of individual users for easier management
5. **Regularly audit** user assignments and group memberships
6. **Rotate client secrets** periodically (Okta supports multiple secrets for zero-downtime rotation)
7. **Monitor Okta System Log** for failed authentication attempts

---

## Advanced Configuration

### Token Lifetime

Default Okta token lifetimes:
- **ID Token:** 1 hour
- **Access Token:** 1 hour
- **Refresh Token:** 90 days

To customize:
1. **Security** → **API** → **Authorization Servers** → **default**
2. **Access Policies** → **Default Policy Rule** → **Edit**
3. Adjust token lifetimes as needed

### Custom User Attributes

To include custom Okta user attributes in Umami:

1. **Security** → **API** → **Authorization Servers** → **default** → **Claims**
2. **Add Claim**
3. Map Okta user attributes to token claims
4. Modify Umami's OIDC profile mapper to handle custom claims

### Network Zones

Restrict Umami access by IP range:

1. **Security** → **Networks** → **Add Zone**
2. Create zone with allowed IP ranges
3. **Security** → **Authentication Policies** → Edit policy
4. Add rule: "Only allow from network zone X"

---

## Additional Resources

- [Okta Developer Documentation](https://developer.okta.com/docs/)
- [Okta OpenID Connect & OAuth 2.0 API](https://developer.okta.com/docs/reference/api/oidc/)
- [Okta Groups and Claims](https://developer.okta.com/docs/guides/customize-tokens-groups-claim/)
- [Umami OIDC Overview](../README.md)

---

## Support

If you encounter issues:

1. Check this troubleshooting guide first
2. Review Okta System Log (**Reports** → **System Log**) for authentication errors
3. Check Umami logs for OIDC errors
4. Join [Umami Discord](https://discord.gg/4dz4zcXYrQ) for community support
