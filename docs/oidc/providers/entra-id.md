# Microsoft Entra ID (Azure AD) OIDC Integration with Umami

This guide walks you through configuring Microsoft Entra ID (formerly Azure Active Directory) as an OIDC identity provider for Umami.

## Overview

Microsoft Entra ID provides enterprise-grade authentication and authorization for Microsoft 365 and Azure environments.

**Features:**
- ✅ Full OIDC support
- ✅ Automatic email verification
- ✅ Group-based role mapping
- ✅ RP-initiated logout (with quirk - see below)
- ✅ Enterprise security features (MFA, Conditional Access)

**Use cases:**
- Enterprise organizations using Microsoft 365
- Azure-hosted applications
- Organizations requiring advanced security controls

**Limitations:**
- ⚠️ Logout shows Microsoft "signed out" page before redirect
- ⚠️ Requires Azure AD Premium for group claims (P1/P2)
- ⚠️ Group names are GUIDs by default (requires additional config for friendly names)

---

## Prerequisites

- Azure subscription with Entra ID (Azure AD) access
- Admin privileges to register applications
- Umami instance with OIDC support configured (see [Configuration Guide](../configuration.md))

---

## Part 1: Register Application in Entra ID

### Step 1: Access Azure Portal

1. Log in to https://portal.azure.com/
2. Navigate to **Microsoft Entra ID** (or **Azure Active Directory**)
3. Select **App registrations** from the left menu
4. Click **New registration**

### Step 2: Register Application

| Field | Value | Description |
|-------|-------|-------------|
| **Name** | `Umami Analytics` | Display name for the application |
| **Supported account types** | **Accounts in this organizational directory only (Single tenant)** | Recommended for internal use |
| **Redirect URI** | Select **Web**, enter callback URL | Where Entra ID sends users after login |

**Redirect URI format:**
```
https://analytics.example.com/api/auth/callback/entra-id
```

**Examples:**
- Production: `https://analytics.example.com/api/auth/callback/entra-id`
- Development: `http://localhost:3000/api/auth/callback/entra-id`

> **Note:** The provider ID `entra-id` must match what you configure in Umami later.

Click **Register**.

---

### Step 3: Configure Authentication

After registration, configure additional settings:

1. Click **Authentication** in the left menu
2. Under **Front-channel logout URL**, add:
   ```
   https://analytics.example.com/login
   ```
   **Important:** This is where users land after logout. Required for OIDC logout to work properly.

3. Under **Implicit grant and hybrid flows**, ensure all are **unchecked** (modern flows only)

4. Click **Save**

---

### Step 4: Create Client Secret

1. Click **Certificates & secrets** in the left menu
2. Click **New client secret**
3. Configure:

| Field | Value |
|-------|-------|
| **Description** | `Umami OIDC Secret` |
| **Expires** | Recommended: 24 months |

4. Click **Add**
5. **Copy the secret VALUE immediately** - it won't be shown again

> ⚠️ **Important:** Store the secret securely. If you lose it, you'll need to generate a new one.

---

### Step 5: Configure Token Claims

1. Click **Token configuration** in the left menu
2. Click **Add optional claim**
3. Select **ID** token type
4. Add these claims:
   - ✓ `email`
   - ✓ `family_name`
   - ✓ `given_name`

5. Click **Add**
6. If prompted to enable Microsoft Graph permissions, click **Add**

---

### Step 6: Configure Groups (Optional - for Role Mapping)

To use group-based role mapping in Umami:

1. Click **Token configuration** → **Add groups claim**
2. Select **Security groups**
3. Under **Customize token properties by type**, select **ID**:
   - **Group ID** (default - returns GUIDs)
   - Or **sAMAccountName** / **Group display name** (requires Azure AD Premium)

4. Click **Add**

> **Note:** For friendly group names instead of GUIDs, you need **Azure AD Premium P1/P2**.

---

### Step 7: Get Configuration Details

You'll need these values for Umami:

1. Go to **Overview** page
2. Copy:
   - **Application (client) ID** (e.g., `12345678-1234-1234-1234-123456789abc`)
   - **Directory (tenant) ID** (e.g., `87654321-4321-4321-4321-cba987654321`)

**OIDC Issuer URL format:**
```
https://login.microsoftonline.com/{TENANT_ID}/v2.0
```

**Example:**
```
https://login.microsoftonline.com/87654321-4321-4321-4321-cba987654321/v2.0
```

---

## Part 2: Create Security Groups (Optional)

For role mapping, create security groups:

### Step 1: Create Groups

1. Navigate to **Microsoft Entra ID** → **Groups**
2. Click **New group**

Create these groups:

| Group Name | Description | Purpose |
|------------|-------------|---------|
| `Umami Admins` | Umami administrators | Full admin access |
| `Umami Viewers` | Read-only users | View-only access |

### Step 2: Add Members

1. Click on each group
2. Select **Members** → **Add members**
3. Add appropriate users

---

## Part 3: Configure Umami

### Method A: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# Entra ID (Azure AD) OIDC
OIDC_ID=entra-id
OIDC_NAME=Microsoft
OIDC_ISSUER=https://login.microsoftonline.com/{TENANT_ID}/v2.0
OIDC_CLIENT_ID=12345678-1234-1234-1234-123456789abc
OIDC_CLIENT_SECRET=your-client-secret-value
OIDC_SCOPE=openid profile email
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

Restart Umami after updating environment variables.

---

### Method B: Admin UI (Recommended)

1. Log in to Umami as admin
2. Navigate to **Settings** → **OIDC Providers**
3. Click **Add Provider**

Configure:

| Field | Value | Example |
|-------|-------|---------|
| **Provider ID** | `entra-id` | URL-safe identifier |
| **Name** | `Microsoft` | Display name on login button |
| **Client ID** | From Azure Portal | `12345678-1234-...` |
| **Client Secret** | Client secret VALUE | `abc123xyz...` |
| **Issuer** | Tenant-specific URL | `https://login.microsoftonline.com/{TENANT_ID}/v2.0` |
| **Scope** | `openid profile email` | Required scopes |
| **Auto-create users** | ✓ Enabled | Allow JIT provisioning |
| **Trusted provider** | ✓ Enabled | Email verification not needed |

**For role mapping (if using groups):**

| Group | Umami Role | Azure Group Name/ID |
|-------|------------|---------------------|
| **Admin group** | `admin` | `Umami Admins` or group GUID |
| **View-only group** | `view-only` | `Umami Viewers` or group GUID |

> **Note:** If using group GUIDs, go to Azure Portal → Groups → select group → copy **Object ID**.

Click **Save**.

---

## Role Mapping & Team Sync

Umami can automatically assign roles and team memberships based on Entra ID group claims. Configure these in the **Role Mappings** tab when adding or editing the provider in Umami's admin UI.

### Understanding Umami Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, websites, and providers |
| **View-only** | Read-only access to all websites and dashboards |
| **User** | Default role: can access websites they're assigned to |

### How It Works

On every login, Umami:
1. Reads the `groups` claim from the Entra ID token
2. Checks if the user is in the **Admin Group** → assigns `role = admin`
3. Else checks if the user is in the **View-Only Group** → assigns `role = view-only`
4. Otherwise → assigns `role = user` (default)

### Important: Entra ID Group Format

> **⚠️ Entra ID sends group Object IDs (GUIDs), not group names.**

Unlike Authentik/Keycloak which send group names like `umami-admins`, Entra ID sends:

```json
{
  "groups": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "f9e8d7c6-b5a4-3210-fedc-ba0987654321"
  ]
}
```

To get the group names instead of GUIDs, you need **Azure AD Premium P1** and configure:
1. Go to **App registrations** → your app → **Token configuration**
2. Click **Add groups claim**
3. Select **Security groups**
4. Under **Customize token properties by type**, set **Group ID** to **sAMAccountName** or **Cloud display name** (requires Premium P1)

Without Premium, use the group **Object ID** as the Admin/View-Only group value in Umami.

### Configure Role Mapping

In Umami, edit the Entra ID provider and go to the **Role Mappings** tab:

| Field | Value (without Premium) | Value (with Premium) |
|-------|------------------------|---------------------|
| **Admin Group** | `a1b2c3d4-e5f6-...` (Object ID) | `Umami Admins` |
| **View-Only Group** | `f9e8d7c6-b5a4-...` (Object ID) | `Umami Viewers` |

**Finding group Object IDs:**
1. Azure Portal → **Microsoft Entra ID** → **Groups**
2. Click on the group
3. Copy the **Object ID** from the overview page

### Groups Overage

> **⚠️ If a user is in more than 6 groups**, Entra ID may trigger a "groups overage" and not include the `groups` claim in the token. In this case, Umami cannot perform role mapping.

**Workaround:**
1. Reduce the number of groups assigned to the application
2. Use **app roles** instead of groups (requires custom configuration)
3. Manually assign roles in Umami

### Team Sync (Optional)

To automatically add users to Umami teams based on Entra ID groups, use the **Team Mappings** field in the same **Role Mappings** tab:

```json
{
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "umami-team-id-uuid",
  "f9e8d7c6-b5a4-3210-fedc-ba0987654321": "another-team-id-uuid"
}
```

> **Note:** Use group Object IDs as keys (or display names if using Premium P1).

---

## OIDC Logout Behavior

### ⚠️ RP-Initiated Logout with Quirk

Entra ID **supports RP-initiated logout**, but with a noticeable quirk: Microsoft always shows a "You have been signed out" page before redirecting to your application.

When users click "Logout" in Umami:

1. Umami clears its JWT session cookie
2. Umami redirects to Entra ID's `end_session_endpoint`:
   ```
   https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout
   ?id_token_hint=<user_id_token>
   &post_logout_redirect_uri=https://analytics.example.com/login
   ```
3. Entra ID terminates the SSO session
4. **Entra ID shows "You have been signed out" page** (cannot be suppressed)
5. After ~2 seconds, Entra ID redirects to **post_logout_redirect_uri** (your login page)

**Result:** User is logged out from both Umami and Entra ID, but sees Microsoft's logout page briefly.

### Logout Flow Diagram

```
┌─────────────┐
│ User clicks │
│   Logout    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│ Umami clears JWT cookie  │
└──────┬───────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Redirect to Entra ID end_session:       │
│ /oauth2/v2.0/logout                     │
│ ?id_token_hint=<token>                  │
│ &post_logout_redirect_uri=/login        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ Entra ID invalidates       │
│ SSO session                │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│ Microsoft shows                    │
│ "You have been signed out" page    │
│ (2 second delay)                   │
└──────┬─────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Redirect to Front-channel        │
│ logout URL:                      │
│ https://analytics.../login       │
└──────────────────────────────────┘
```

### Why the Microsoft Page Appears

This is **intentional Microsoft UX** and cannot be disabled:
- Microsoft wants users to know they're logged out of Microsoft services
- Provides consistency across all Microsoft-integrated apps
- Shows visual confirmation of logout

**You cannot suppress this page.** All applications using Entra ID logout see this behavior.

### Required Configuration

For logout to work, you **must** configure the **Front-channel logout URL** in Azure Portal:

1. Azure Portal → **App registrations** → Your app
2. **Authentication** → **Front-channel logout URL**
3. Set to: `https://analytics.example.com/login`
4. Click **Save**

**If this is not configured:**
- Logout redirect will fail
- Users see an error instead of returning to Umami
- Logout still works, but UX is broken

### Credentials vs OIDC Logout

| Login Method | Logout Behavior |
|--------------|-----------------|
| **Local credentials** | Clears Umami session → redirects to login page |
| **OIDC (Entra ID)** | Clears Umami session → logs out from Entra ID → shows Microsoft page → redirects to login page |

### Testing Logout

1. Log in to Umami via Microsoft
2. Click the profile menu → **Logout**
3. ✅ Redirected to Microsoft logout page
4. ✅ See "You have been signed out" message
5. ✅ Automatically redirected to Umami login page (2-3 sec delay)
6. ✅ Try logging in again — Entra ID should prompt for credentials (not auto-login)

**Expected behavior:**
- Umami session cleared
- Entra ID SSO session terminated
- User must re-authenticate on next login

**If auto-login happens:**
- Check **Front-channel logout URL** is configured
- Verify `id_token` is in session (automatic)
- Review Azure AD sign-in logs

---

## Part 4: Advanced Configuration

### Conditional Access

Control access based on location, device, risk level:

1. **Microsoft Entra ID** → **Security** → **Conditional Access**
2. Create policy for **Umami Analytics** application
3. Examples:
   - Require MFA for admins
   - Block access from untrusted locations
   - Require managed devices

### Group-Based Access Control

Restrict who can access Umami via groups:

1. Azure Portal → **App registrations** → **Umami**
2. **Enterprise applications** → **Users and groups**
3. Select **Assignment required**
4. Add groups: `Umami Admins`, `Umami Viewers`

Only members of assigned groups can log in.

### Custom Claims

Add custom attributes to ID tokens:

1. **Token configuration** → **Add optional claim**
2. Add claims: `department`, `job_title`, etc.
3. Use in Umami for custom logic (requires code changes)

---

## Troubleshooting

### "AADSTS50011: The redirect URI ... does not match"

**Cause:** Redirect URI mismatch.

**Solution:**
1. Verify redirect URI in Azure matches exactly: `https://analytics.example.com/api/auth/callback/entra-id`
2. Check no extra trailing slashes
3. Ensure protocol matches (http vs https)

### "AADSTS700016: Application ... was not found"

**Cause:** Client ID incorrect.

**Solution:**
1. Verify **Application (client) ID** from Azure Portal
2. Check no extra spaces in `.env` or Umami config

### Groups claim missing

**Cause:** Groups claim not configured or user not in any groups.

**Solution:**
1. Verify **Token configuration** → **Groups claim** is added
2. Check user is actually in security groups
3. Test by decoding ID token at https://jwt.ms/

### Logout redirect fails / error page

**Cause:** Front-channel logout URL not configured.

**Solution:**
1. Azure Portal → **App registrations** → **Authentication**
2. Set **Front-channel logout URL**: `https://analytics.example.com/login`
3. Save and test again

### Tenant-specific vs Multi-tenant

**Single tenant (recommended):**
```
Issuer: https://login.microsoftonline.com/{TENANT_ID}/v2.0
```

**Multi-tenant (advanced):**
```
Issuer: https://login.microsoftonline.com/common/v2.0
```

For internal use, always use single tenant (tenant-specific issuer).

---

## Security Considerations

### 1. Use Tenant-Specific Endpoints

```bash
# ✅ Recommended - Single tenant
OIDC_ISSUER=https://login.microsoftonline.com/87654321-4321-4321-4321-cba987654321/v2.0

# ❌ Avoid - Common endpoint (allows any Azure AD tenant)
OIDC_ISSUER=https://login.microsoftonline.com/common/v2.0
```

### 2. Enable MFA

Require multi-factor authentication:
1. **Microsoft Entra ID** → **Security** → **Conditional Access**
2. Create policy requiring MFA for Umami app
3. Apply to all users or specific groups

### 3. Rotate Client Secrets

- Client secrets expire (max 24 months)
- Set calendar reminder to rotate before expiration
- Update Umami config after rotation

### 4. Review Sign-in Logs

Monitor authentication activity:
1. **Microsoft Entra ID** → **Monitoring** → **Sign-in logs**
2. Filter by application: **Umami Analytics**
3. Review failed attempts, locations, devices

### 5. Conditional Access Policies

Examples:
- Block legacy authentication
- Require compliant devices
- Block high-risk sign-ins
- Geo-fencing (allow only certain countries)

---

## Known Limitations

### Microsoft Logout Page Cannot Be Suppressed

**Limitation:** When users log out via Umami, Microsoft Entra ID always shows a "You have been signed out" confirmation page before redirecting back to Umami's login page.

**Impact:** The logout flow is not seamless - users see an intermediate Microsoft page for 2-3 seconds.

**Workarounds:**
1. Accept this as expected behavior (cannot be disabled)
2. Educate users that the Microsoft page is part of the logout process
3. Consider using a self-hosted IdP (Authentik, Keycloak) if clean logout is critical

### Group Names Are GUIDs by Default

**Limitation:** By default, the `groups` claim contains group Object IDs (GUIDs like `a1b2c3d4-e5f6-...`) rather than human-readable group names.

**Impact:** You must use GUIDs in Umami's role mapping configuration, which is less intuitive.

**Workarounds:**
1. Use GUIDs directly (see Appendix at end of this guide)
2. Upgrade to Azure AD Premium (P1 or P2) and configure `emit groups as role claims` with `sAMAccountName` or `displayName`
3. Use the Microsoft Graph API to resolve GUIDs to names (requires custom implementation)

### Group Overage Claim for 6+ Groups

**Limitation:** If a user is a member of more than 5 groups (or 200 for app-only tokens), Entra ID omits the `groups` claim entirely and instead includes a `_claim_names` object with a link to query Microsoft Graph API.

**Impact:** Role mapping fails for users in many groups unless you implement Graph API fallback.

**Workarounds:**
1. Limit users to 5 or fewer security groups
2. Use app-only tokens (increases limit to 200)
3. Implement custom middleware to fetch groups via Microsoft Graph API when `_claim_names` is present
4. Use role claims instead of group claims (requires Premium license)

### Azure AD Premium Required for Group displayNames

**Limitation:** To emit group `displayName` values instead of GUIDs, you need Azure AD Premium P1 or P2 license.

**Impact:** Organizations on free/basic Azure AD must use GUIDs for role mapping.

**Workarounds:**
1. Upgrade to Azure AD Premium P1/P2
2. Accept using GUIDs (see Appendix)
3. Use Entra ID as a broker to Authentik/Keycloak (advanced)

### Email Claim Requires `email` Scope

**Limitation:** Unlike some providers that include email in the default `profile` scope, Entra ID requires explicit `openid profile email` scope.

**Impact:** If you omit the `email` scope, users cannot log in (Umami requires email for account creation).

**Workarounds:**
1. Always include `email` in scope configuration (already documented in this guide)
2. Verify scope in token at https://jwt.ms/ if issues occur

---

## Comparison: Entra ID vs Other Providers

| Feature | Entra ID | Authentik | Keycloak | Google |
|---------|----------|-----------|----------|--------|
| **RP-initiated logout** | ✅ Yes (with page) | ✅ Yes (clean) | ✅ Yes (clean) | ❌ No |
| **Group claims** | ✅ Yes (Premium for names) | ✅ Yes (free) | ✅ Yes (free) | ❌ No (Workspace only) |
| **MFA built-in** | ✅ Yes | ⚠️ Manual setup | ⚠️ Manual setup | ✅ Yes |
| **Conditional Access** | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited |
| **Cost** | 💰 Included with M365 | 🆓 Free (self-hosted) | 🆓 Free (self-hosted) | 🆓 Free |

**Use Entra ID when:**
- ✅ Already using Microsoft 365
- ✅ Need enterprise security features
- ✅ Require compliance (SOC 2, ISO 27001)
- ✅ Want centralized identity management

**Use Authentik/Keycloak when:**
- ✅ Self-hosted infrastructure preferred
- ✅ Need full control over IdP
- ✅ Want cleaner logout UX
- ✅ Multi-provider bridging required

---

## Example: Complete .env Configuration

```bash
# Database
DATABASE_URL=postgresql://umami:umami@localhost:5432/umami

# Auth.js configuration
AUTH_URL=https://analytics.example.com
AUTH_SECRET=xK9mP2qR5tW8yB3nC6fJ9mL2oP5sV8xA1dE4gH7jK0m=

# Microsoft Entra ID OIDC
OIDC_ID=entra-id
OIDC_NAME=Microsoft
OIDC_ISSUER=https://login.microsoftonline.com/87654321-4321-4321-4321-cba987654321/v2.0
OIDC_CLIENT_ID=12345678-1234-1234-1234-123456789abc
OIDC_CLIENT_SECRET=abc~123.xyz_789-def
OIDC_SCOPE=openid profile email

# Optional: Session duration (8 hours for enterprise)
SESSION_DURATION=28800
```

---

## Next Steps

- **[Configuration Guide](../configuration.md)** - Learn about role mapping and team sync
- **[Features](../features.md)** - Explore OIDC features
- **[Audit Logs](../configuration.md#audit-logging)** - Monitor authentication events
- **Microsoft Entra ID Documentation:** https://learn.microsoft.com/en-us/entra/identity/

---

## Appendix: Finding Group Object IDs

If using groups for role mapping and want to use GUIDs instead of names:

1. **Microsoft Entra ID** → **Groups**
2. Click on the group (e.g., `Umami Admins`)
3. Copy the **Object ID** (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

Use this in Umami OIDC provider config:

```
Admin group: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Or, if you have Azure AD Premium, configure Entra ID to send group display names and use:

```
Admin group: Umami Admins
```
