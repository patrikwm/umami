# GitLab OIDC Integration with Umami

This guide walks you through setting up GitLab (self-hosted or GitLab.com) as an OpenID Connect (OIDC) identity provider for Umami.

## Overview

GitLab provides full OIDC support for both self-hosted instances and GitLab.com SaaS.

**Provider Type:** OIDC (Category A - Full OIDC with auto-discovery)

**Features:**
- ✅ Full OIDC support with auto-discovery
- ✅ Group-based role mapping
- ✅ Email verified by GitLab
- ✅ RP-initiated logout
- ✅ Works with self-hosted and GitLab.com

**Use cases:**
- Development teams using GitLab
- Self-hosted GitLab instances
- Organizations managing code and analytics in GitLab ecosystem

**Limitations:**
- ⚠️ Group names are paths (e.g., `mygroup/subgroup`)
- ⚠️ GitLab.com SaaS has some restrictions vs self-hosted
- ⚠️ Public projects may expose group membership

---

## Prerequisites

- GitLab instance (self-hosted) with admin access, OR
- GitLab.com account
- Umami instance with OIDC support configured (see [Configuration Guide](../configuration.md))

---

## Part 1A: Self-Hosted GitLab Setup

### Step 1: Create Application (Self-Hosted Admin)

For self-hosted GitLab with admin access:

1. Log in to GitLab as admin
2. Navigate to **Admin Area** (wrench icon) → **Applications**
3. Click **New application**

Configure:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `Umami Analytics` | Application display name |
| **Redirect URI** | `https://your-umami-domain.com/api/auth/callback/[provider-id]` | Callback URL |
| **Confidential** | ✓ Checked | Keep application secret confidential |
| **Scopes** | ☑ `openid`<br>☑ `profile`<br>☑ `email`<br>☑ `read_user` | Required scopes |

**Redirect URI examples:**
- Production: `https://analytics.example.com/api/auth/callback/gitlab`
- Development: `http://localhost:3000/api/auth/callback/gitlab`

4. Click **Save application**
5. **Copy Application ID** (e.g., `abc123def456...`)
6. **Copy Secret** (e.g., `xyz789abc123...`)

> ⚠️ **Important:** The secret is shown only once. Store it securely.

---

## Part 1B: GitLab.com or Group-Level Setup

### Alternative: Group or User-Level Application

If you don't have admin access, or are using GitLab.com:

1. Navigate to your **Group** → **Settings** → **Applications**, OR
2. Navigate to your **User Settings** → **Applications**
3. Click **Add new application**

Configure:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `Umami Analytics` | Application display name |
| **Redirect URI** | `https://your-umami-domain.com/api/auth/callback/[provider-id]` | Callback URL |
| **Confidential** | ✓ Checked | Keep application secret confidential |
| **Scopes** | ☑ `openid`<br>☑ `profile`<br>☑ `email`<br>☑ `read_user` | Required scopes |

4. Click **Save application**
5. **Copy Application ID**
6. **Copy Secret**

> **Note:** Group-level applications are scoped to that group. User-level applications are personal.

---

## Part 2: Configure Umami

### Method A: Admin UI (Recommended)

1. Log in to Umami as admin
2. Navigate to **Settings** → **OIDC Providers**
3. Click **Add Provider**

Configure:

| Field | Value | Notes |
|-------|-------|-------|
| **Provider ID** | `gitlab` | URL-safe identifier |
| **Name** | `GitLab` | Display name on login button |
| **Category** | `OIDC` | Full OIDC support |
| **Client ID** | From GitLab | Application ID |
| **Client Secret** | From GitLab | Application secret |
| **Issuer** | `https://gitlab.company.com` | Your GitLab instance URL |
| **Scope** | `openid profile email` | Required scopes |
| **Auto-create users** | ✓ Enabled | Allow JIT provisioning |
| **Trusted provider** | ✓ Enabled | GitLab verifies emails |

**Issuer URL formats:**
- **Self-hosted:** `https://gitlab.company.com`
- **GitLab.com:** `https://gitlab.com`

> **Important:** Do NOT include `/oauth/authorize` or other paths. Just the base URL.

**For role mapping (if using groups):**

| Group | Umami Role | GitLab Group Path |
|-------|------------|-------------------|
| **Admin group** | `admin` | `umami-admins` or `myorg/umami-admins` |
| **View-only group** | `view-only` | `umami-viewers` |

> **Note:** GitLab group names are **paths**, not display names. Use the path shown in the group URL.

Click **Save**.

---

### Method B: Environment Variables

Add to your `.env` file:

```bash
# Required for Auth.js
AUTH_URL=https://analytics.example.com
AUTH_SECRET=your-secret-key-min-32-chars

# GitLab OIDC (self-hosted)
OIDC_ID=gitlab
OIDC_NAME=GitLab
OIDC_ISSUER=https://gitlab.company.com
OIDC_CLIENT_ID=abc123def456...
OIDC_CLIENT_SECRET=xyz789abc123...
OIDC_SCOPE=openid profile email
```

**For GitLab.com:**
```bash
OIDC_ISSUER=https://gitlab.com
```

**Generate AUTH_SECRET:**
```bash
openssl rand -base64 32
```

Restart Umami after updating environment variables.

---

## Part 3: OIDC Auto-Discovery

GitLab supports OIDC auto-discovery via the `.well-known/openid-configuration` endpoint.

**Verify auto-discovery:**
```bash
curl https://gitlab.company.com/.well-known/openid-configuration
```

**Expected response includes:**
```json
{
  "issuer": "https://gitlab.company.com",
  "authorization_endpoint": "https://gitlab.company.com/oauth/authorize",
  "token_endpoint": "https://gitlab.company.com/oauth/token",
  "userinfo_endpoint": "https://gitlab.company.com/oauth/userinfo",
  "end_session_endpoint": "https://gitlab.company.com/oauth/logout",
  "scopes_supported": ["openid", "profile", "email"],
  ...
}
```

✅ Umami automatically discovers these endpoints - no manual configuration needed.

---

## Part 4: Group-Based Role Mapping

### How GitLab Groups Work

GitLab includes group membership in the ID token's `groups` claim:

```json
{
  "sub": "1234567",
  "email": "user@example.com",
  "name": "Jane Doe",
  "groups": ["myorg/developers", "myorg/admins", "public-group"]
}
```

### Group Path Format

**Important:** GitLab group names use **path notation**, not display names.

| Display Name | Group Path (use this) | URL |
|--------------|----------------------|-----|
| `Umami Admins` | `umami-admins` | `gitlab.com/umami-admins` |
| `My Org / Admins` | `myorg/admins` | `gitlab.com/myorg/admins` |
| `Company / IT / Security` | `company/it/security` | `gitlab.com/company/it/security` |

**Finding the group path:**
1. Navigate to the group in GitLab
2. Look at the URL: `https://gitlab.com/myorg/subgroup`
3. The path is everything after the domain: `myorg/subgroup`

### Configure Role Mapping in Umami

In Umami, edit the GitLab provider and go to the **Role Mappings** tab:

| Field | Value | Description |
|-------|-------|-------------|
| **Admin Group** | `myorg/umami-admins` | GitLab group path for admin users |
| **View-Only Group** | `myorg/umami-viewers` | GitLab group path for read-only users |

**Matching is exact and case-sensitive:**
- ✅ `myorg/admins` (correct)
- ❌ `myorg/Admins` (wrong case)
- ❌ `Admins` (missing path)

### Understanding Umami Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, teams, websites, and providers |
| **View-only** | Read-only access to all websites and dashboards |
| **User** | Default role: can access websites they're assigned to |

On every login, Umami:
1. Reads the `groups` claim from the GitLab ID token
2. Checks if the user is in the **Admin Group** → assigns `role = admin`
3. Else checks if the user is in the **View-Only Group** → assigns `role = view-only`
4. Otherwise → assigns `role = user` (default)

**Priority:** Admin > View-only > User. Roles are re-evaluated on every login.

---

## OIDC Logout Behavior

### ✅ RP-Initiated Logout Supported

GitLab supports full OIDC logout via the `end_session_endpoint`.

**How logout works:**
1. User clicks "Logout" in Umami
2. Umami clears its JWT session cookie
3. Umami redirects to GitLab's logout endpoint:
   ```
   https://gitlab.company.com/oauth/logout?
     post_logout_redirect_uri=https://analytics.example.com/login&
     id_token_hint=eyJhbGc...
   ```
4. GitLab ends the user's session
5. GitLab redirects back to Umami login page

**Result:** User is logged out of both Umami and GitLab.

---

## Team Sync (Optional)

Umami can automatically sync team memberships based on GitLab groups. Configure these in the **Team Mappings** field within the **Role Mappings** tab when editing the provider in Umami's admin UI.

### Setup

1. Create teams in Umami (Settings → Teams)
2. Map GitLab groups to teams:

| Umami Team | GitLab Group | Access Level |
|------------|--------------|--------------|
| `Engineering` | `myorg/engineering` | Team member |
| `Product` | `myorg/product` | Team member |
| `Leadership` | `myorg/leadership` | Team owner |

3. In the **Role Mappings** tab, enter Team Mappings as JSON:
   ```json
   {
     "myorg/engineering": "engineering-team-id",
     "myorg/product": "product-team-id"
   }
   ```

### Sync Behavior

- Users are **added** to teams when they log in if they're in the mapped GitLab group
- Users are **removed** from teams if they're no longer in the group
- Manual team memberships (`source: 'manual'`) are preserved

---

## Troubleshooting

### Auto-discovery fails

**Cause:** Issuer URL incorrect or GitLab instance unreachable.

**Solution:**
1. Verify issuer URL is just the base domain: `https://gitlab.company.com`
2. Ensure Umami can reach GitLab (check firewall, DNS)
3. Test discovery endpoint:
   ```bash
   curl https://gitlab.company.com/.well-known/openid-configuration
   ```

### Login fails with "redirect_uri_mismatch"

**Cause:** Callback URI doesn't match configured redirect URI in GitLab.

**Solution:**
1. Check exact callback URI in Umami provider settings
2. Ensure it exactly matches the redirect URI in GitLab application
3. Include protocol (`https://`) and full path

### Groups not working

**Cause:** User not in any groups, or group path incorrect.

**Solution:**
1. Verify user is actually a member of the group in GitLab
2. Check group path format (use path, not display name)
3. Case-sensitive match: `myorg/admins` ≠ `myorg/Admins`
4. Decode ID token at https://jwt.io to verify `groups` claim

### Email not returned

**Cause:** Missing `email` scope or user's email is private.

**Solution:**
1. Verify `email` scope is selected in GitLab application
2. Check user's email visibility in GitLab profile settings
3. Ensure `read_user` scope is enabled

### Groups claim contains subgroups

**Cause:** User is in nested subgroups.

**Solution:**
1. This is expected behavior - GitLab includes all ancestor groups
2. Use the full path in Umami mapping: `parent/child/grandchild`
3. Or use a parent group: `parent` (users in `parent/child` won't match)

---

## Known Limitations

### Group Names Are Paths

**Limitation:** GitLab group membership in the `groups` claim uses path notation (e.g., `myorg/engineering`) rather than human-readable display names.

**Impact:** You must use exact path strings in Umami role mapping configuration, which can be confusing for nested groups.

**Workarounds:**
1. Use GitLab's group path (visible in URL)
2. Document the path-to-display-name mapping for admins
3. Keep group structures flat to avoid deep nesting (e.g., `company/subgroup/team/role`)

### GitLab.com SaaS vs Self-Hosted Differences

**Limitation:** GitLab.com (SaaS) has different restrictions compared to self-hosted GitLab:
- Application creation limited to group/user level (no instance-wide admin apps)
- Some admin-level features unavailable
- API rate limits more restrictive

**Impact:** Setup process differs between SaaS and self-hosted. Group-level apps are scoped to that group only.

**Workarounds:**
1. For GitLab.com: Create group-level application in your organization's group
2. For self-hosted: Prefer admin-level applications for instance-wide access
3. Document deployment type in your integration docs

### Nested Group Path Complexity

**Limitation:** Deeply nested groups result in long path strings (e.g., `company/division/department/team/role`).

**Impact:** Role mapping configuration becomes verbose and error-prone. Difficult to manage.

**Workarounds:**
1. Keep group hierarchy flat when possible
2. Use top-level groups for role mapping (`company/admins` instead of `company/it/security/admins`)
3. Consider using a single "Umami Users" group with subgroups for roles

### Public Project Group Exposure

**Limitation:** If a user is a member of public GitLab groups/projects, their group membership may be visible to others.

**Impact:** Group-based role mapping may inadvertently expose organizational structure.

**Workarounds:**
1. Use private groups for sensitive role assignments
2. Understand GitLab's visibility model (private, internal, public)
3. Review group visibility settings before using for OIDC role mapping

### Group Membership Updates Not Real-Time

**Limitation:** When a user is added/removed from a GitLab group, the change is NOT reflected in Umami until their next login (when a new ID token is issued).

**Impact:** Users may retain access briefly after being removed from a group, or not gain access immediately after being added.

**Workarounds:**
1. Force re-authentication by invalidating Umami sessions (future feature)
2. Educate admins that group changes require user re-login
3. Use short JWT expiration times (`SESSION_DURATION`) to minimize window

### Self-Hosted SSL/TLS Requirements

**Limitation:** Self-hosted GitLab instances must use HTTPS with valid SSL/TLS certificates for OIDC to work reliably.

**Impact:** Self-signed certificates or HTTP-only instances will cause OIDC verification failures.

**Workarounds:**
1. Use Let's Encrypt for free SSL certificates
2. Configure GitLab with proper SSL/TLS termination
3. For development/testing, use ngrok or similar tunnels

---

## Comparison with Other Providers

| Feature | GitLab | GitHub | Authentik | Keycloak |
|---------|--------|--------|-----------|----------|
| **Category** | OIDC (A) | OAuth 2.0 (B) | OIDC (A) | OIDC (A) |
| **Auto-discovery** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Groups support** | ✅ Yes (paths) | ❌ No | ✅ Yes | ✅ Yes |
| **Email verified** | ✅ Yes | ⚠️ Optional | ✅ Yes | ✅ Yes |
| **RP-initiated logout** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Trusted provider** | ✅ Recommended | ❌ Not recommended | ✅ Recommended | ✅ Recommended |
| **Setup complexity** | ✅ Easy (10 min) | ✅ Easy (5 min) | ⚠️ Moderate | ⚠️ Moderate |
| **Best for** | DevOps teams | Developers | Enterprise | Enterprise |
| **SaaS option** | ✅ GitLab.com | ✅ GitHub.com | ❌ Self-hosted only | ❌ Self-hosted only |

---

## Best Practices

### 1. Use Admin-Level Applications (Self-Hosted)

For self-hosted GitLab:
- ✅ Create instance-wide applications (Admin Area → Applications)
- ✅ Allows any user on the instance to authenticate
- ❌ Avoid group-level apps unless you want to restrict to specific groups

For GitLab.com:
- ✅ Create group-level applications for your organization
- ✅ Scopes access to group members only

### 2. Use Path Notation Consistently

When configuring role mapping:
```
# ✅ Correct - use path
Admin group: myorg/umami-admins

# ❌ Wrong - display name
Admin group: Umami Admins
```

### 3. Test Group Membership

Before deploying, test group mapping:
1. Add test user to GitLab group
2. Log in to Umami with test user
3. Verify role assignment
4. Check Umami audit logs for group claim

### 4. Document Group Paths for Admins

Create internal documentation mapping display names to paths:

```markdown
| Display Name | Group Path (use in Umami) |
|--------------|---------------------------|
| Umami Admins | myorg/umami-admins        |
| Analytics Team | myorg/analytics         |
```

### 5. Enable Trusted Provider

GitLab verifies email addresses, so it's safe to enable:
```json
{
  "trusted": true
}
```

This allows:
- Email verification bypass
- Auto-linking of existing accounts by email

### 6. Monitor Group Changes

Since group membership updates aren't real-time:
- Document that users must re-login after group changes
- Consider shorter `SESSION_DURATION` for sensitive environments
- Educate admins about the sync delay

---

## Security Considerations

### 1. Use HTTPS for Self-Hosted

```bash
# ✅ Correct
OIDC_ISSUER=https://gitlab.company.com

# ❌ Never use HTTP in production
OIDC_ISSUER=http://gitlab.company.com
```

### 2. Rotate Client Secrets

- Store secrets securely (Umami auto-encrypts)
- Rotate periodically (e.g., annually)
- Update Umami config after rotation

### 3. Limit Application Scopes

Only enable required scopes:
```
openid profile email
```

Do NOT enable unnecessary scopes like:
- `api` (full API access)
- `write_repository` (repository write access)
- `sudo` (admin impersonation)

### 4. Use Private Groups for Sensitive Roles

- Create private groups for admin/sensitive role mapping
- Review group visibility settings
- Understand GitLab's visibility model

### 5. Review Audit Logs

- Monitor Umami audit logs (Settings → Audit Logs)
- Review GitLab audit events (Admin Area → Monitoring → Audit Events)
- Set up alerts for admin role assignments

### 6. Instance vs Group-Level Applications

| Application Level | Scope | Use When |
|-------------------|-------|----------|
| **Instance-wide (Admin)** | All instance users | Self-hosted, want organization-wide access |
| **Group-level** | Group members only | GitLab.com, want to restrict to specific group |
| **User-level** | Personal use | Testing, development |

---

## Advanced: Multiple GitLab Instances

To support multiple GitLab instances (e.g., gitlab.com + self-hosted):

1. Create separate applications in each GitLab instance
2. Add each as a separate provider in Umami:
   - Provider ID: `gitlab-com`, `gitlab-selfhosted`
   - Name: "GitLab.com", "GitLab (Internal)"
   - Issuer: respective instance URLs
3. Users see multiple login buttons

---

## Additional Resources

- [GitLab OIDC Documentation](https://docs.gitlab.com/ee/integration/openid_connect_provider.html)
- [GitLab OAuth 2.0 Authentication](https://docs.gitlab.com/ee/api/oauth2.html)
- [GitLab Groups Documentation](https://docs.gitlab.com/ee/user/group/)
- [Umami OIDC Overview](../README.md)

---

## Support

If you encounter issues:

1. Check this troubleshooting guide first
2. Review GitLab application settings
3. Test auto-discovery endpoint: `curl https://gitlab.company.com/.well-known/openid-configuration`
4. Decode ID token at https://jwt.io to inspect claims
5. Check Umami logs for OIDC errors
6. Join [Umami Discord](https://discord.gg/4dz4zcXYrQ) for community support
