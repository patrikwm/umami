# Plan: OIDC Limitations, Provider Guides & Tests

**TL;DR:** Document known provider limitations in a dedicated section across 6 provider docs + a central limitations reference, create 3 missing provider guides (Discord, Slack, GitLab), update the OIDC README with provider categories and comparison matrix, also upgrade the ProviderEditForm to match the dynamic ProviderAddForm, and write comprehensive unit tests for all OIDC implementation code (currently zero tests exist).

---

**Steps**

## Phase A: Document Known Limitations

1. **Add "Known Limitations" section to `docs/oidc/providers/authentik.md`** — Currently has no limitations section. Document: back-channel logout not implemented (RP-initiated only), `groups` claim requires scope mapping configuration in Authentik.

2. **Enhance limitations in `docs/oidc/providers/entra-id.md`** — Existing content mentions GUIDs inline. Consolidate into dedicated "Known Limitations" section covering: group GUIDs (not displayNames), overage claim for 6+ groups requiring Graph API call, Azure AD Premium required for group names, Microsoft logout page cannot be suppressed.

3. **Enhance limitations in `docs/oidc/providers/okta.md`** — Currently mentioned inline only. Add formal "Known Limitations" section: groups claim requires custom authorization server (not org-level), groups filter config required in admin, token refresh behavior.

4. **Verify limitations in `docs/oidc/providers/google.md`** — Has `Limitations & Workarounds` section at L426. Verify it covers: no OIDC logout, no groups claim, `hd` claim only restricts domain (not enforce — must validate server-side), any Google account can auth without `hd`.

5. **Verify limitations in `docs/oidc/providers/github.md`** — Has `Limitations & Workarounds` section at L341. Verify it covers: no OIDC logout, no role/group mapping, email may be private (requires `/user/emails` API), org membership requires separate `/user/orgs` call.

6. **Add central "Known Limitations" table to `docs/oidc/features.md`** — Add a dedicated section at the end consolidating all provider-specific limitations in one comparison table for quick reference.

## Phase B: Create Missing Provider Guides

7. **Create `docs/oidc/providers/discord.md`** — OAuth 2.0 (Category B) setup guide.
   - Discord Developer Portal app creation
   - OAuth2 redirect URI configuration
   - Required fields: `clientId`, `clientSecret`, `authUrl` (`https://discord.com/api/oauth2/authorize`), `tokenUrl` (`https://discord.com/api/oauth2/token`), `userinfoUrl` (`https://discord.com/api/users/@me`), `scope` (`identify email`)
   - Profile mapper: `id`, `username`, `email`, avatar URL construction
   - Known limitations: email verification unreliable (`email_verified` field exists but unreliable), no groups/roles, no OIDC logout, always set `trusted: false`
   - Comparison table with other OAuth 2.0 providers

8. **Create `docs/oidc/providers/slack.md`** — OAuth 2.0 (Category B) setup guide.
   - Slack API app creation
   - OAuth & Permissions config in Slack admin
   - Required fields: `clientId`, `clientSecret`, `authUrl` (`https://slack.com/oauth/v2/authorize`), `tokenUrl` (`https://slack.com/api/oauth.v2.access`), `userinfoUrl` (`https://slack.com/api/users.identity`), `scope` (`identity.basic identity.email`)
   - Known limitations: non-standard JSON response structure (nested `user.id`, `user.email`, `user.name`), custom profile mapper needed, workspace-scoped auth, no groups/roles, no OIDC logout
   - Document that `trusted` can be set since workspace email is usually reliable

9. **Create `docs/oidc/providers/gitlab.md`** — Full OIDC (Category A) setup guide.
   - GitLab self-hosted application creation (Admin → Applications)
   - Issuer URL format: `https://gitlab.company.com`
   - Required fields: `clientId`, `clientSecret`, `issuer`, `scope` (`openid profile email`)
   - Auto-discovery works (no manual endpoints needed)
   - Groups support via GitLab group membership
   - RP-initiated logout supported (`/oauth/logout`)
   - Known limitations: GitLab.com SaaS has restrictions vs self-hosted, group names are paths (e.g., `mygroup/subgroup`)

## Phase C: Update OIDC README & Features

10. **Update `docs/oidc/README.md`** — Add:
    - Provider Categories section explaining the 3 categories (A: Full OIDC, B: OAuth 2.0, C: OIDC with quirks)
    - Comprehensive comparison table with all 10 providers (authentik, keycloak, okta, entra-id, gitlab, google, github, discord, slack, generic)
    - Columns: Provider, Category, Auto-discovery, Groups, Email Verified, Logout, Extra Fields
    - Links to all 8 provider guides (add Discord, Slack, GitLab to the existing list)
    - Known Limitations summary with links to provider-specific details

11. **Update `docs/oidc/features.md`** — Add a "Phase 7: Provider Categories & Dynamic Configuration" section documenting:
    - Three-category system (oidc, oauth2, oidc-quirks)
    - New database fields: `category`, `extraConfig`
    - Dynamic admin form behavior
    - Provider auto-detection from issuer URL
    - Provider-specific extra fields (Google `hd`, Entra `tenantId`, Okta `authServerId`)

## Phase D: Fix ProviderEditForm Parity

12. **Update `src/app/(main)/admin/providers/ProviderEditForm.tsx`** — Currently uses old static form (OIDC/OAuth dropdown, all fields always visible). Upgrade to match the dynamic `ProviderAddForm` behavior: detect provider type from saved `category`/`issuer`, show/hide fields based on category, show extra config fields, conditional group fields, provider-specific placeholders.

## Phase E: Deduplicate Code

13. **Refactor `src/app/api/auth/oidc-logout-url/route.ts`** — Remove the duplicate local `detectProviderType()` function (defined at ~L101) and import from `@/lib/oidc-providers` instead. Both implementations do the same issuer URL pattern matching.

## Phase F: Unit Tests

14. **Create `src/lib/__tests__/oidc-providers.test.ts`** — Test the provider detection and configuration library:
    - `detectProviderType()` — test all 10 issuer URL patterns (authentik, keycloak, okta, entra-id, gitlab, google, github, discord, slack, generic fallback)
    - `getProviderSpec()` — verify specs for each type return correct category, required fields, extra fields, scope defaults, trusted defaults
    - `getProviderCategory()` — verify category mapping
    - `supportsDiscovery()` / `requiresManualEndpoints()` — verify boolean results per category
    - `getDefaultScope()` — verify provider-specific defaults (OIDC scopes vs custom scopes)
    - `validateProviderConfig()` — test validation logic for all 3 categories with valid/invalid configs
    - `buildIssuerUrl()` — test Okta `authServerId` appending, Entra `tenantId` URL construction, passthrough for others
    - `buildAuthorizationParams()` — test Google `hd` inclusion, empty return for non-Google

15. **Create `src/lib/__tests__/oidc.test.ts`** — Test role mapping and team sync:
    - `mapClaimsToRole()` — test: user in admin group → admin, user in viewOnly group → view-only, user in both → admin (priority), user in neither → user, empty groups array, null groups, string groups (comma-separated), case sensitivity
    - `syncTeamMembership()` — requires mocking Prisma: test add to mapped teams, remove from unmapped teams, protect manual memberships (`source: 'manual'`), handle empty team mappings, handle user with no groups
    - `generateUniqueUsername()` — test: uses `preferred_username`, falls back to email prefix, handles collision with random suffix

16. **Create `src/lib/__tests__/crypto.test.ts`** — Test encryption/decryption:
    - `encrypt()` / `decrypt()` round-trip with known secret
    - Decrypt with wrong key fails gracefully
    - Different plaintexts produce different ciphertexts
    - Empty string handling
    - `hash()` produces consistent SHA-256 output
    - `uuid()` produces valid UUID format

17. **Create `src/lib/__tests__/audit.test.ts`** — Test audit logging (requires Prisma mock):
    - `logAuditEvent()` — verify it creates a record with correct fields (userId, action, resource, metadata, ipAddress)
    - Non-blocking: verify errors are caught and logged, not thrown
    - `getAuditLogs()` — verify pagination and filter logic

18. **Create `src/app/api/__tests__/oidc-providers.test.ts`** — Integration-style tests for the API routes:
    - POST `/oidc-providers` — valid OIDC provider creation, valid OAuth 2.0 provider, invalid body (missing required fields), unauthorized (non-admin)
    - GET `/oidc-providers` — list with pagination, search filter
    - GET `/oidc-providers/[id]` — returns provider without secret
    - POST `/oidc-providers/[id]` — update, verify empty clientSecret doesn't overwrite
    - DELETE `/oidc-providers/[id]` — success, not found

---

## Verification

- Run `pnpm test` to execute all new unit tests
- Run `pnpm biome check` on all new/modified files
- Run `pnpm build-app` to verify no type errors or build failures
- Manual: verify `docs/oidc/README.md` provider links all resolve to existing files
- Manual: verify ProviderEditForm shows dynamic fields matching ProviderAddForm behavior

## Decisions

- **Test mocking strategy:** Use Jest manual mocks for Prisma (`jest.mock('@/lib/prisma')`) following the pattern of existing tests which import directly without external mock libraries
- **Provider docs structure:** Follow the existing pattern established by `docs/oidc/providers/authentik.md` — Overview, Prerequisites, Setup Steps, Umami Configuration, Limitations, Comparison Table, Troubleshooting
- **Limitations placement:** Both in individual provider docs AND a central summary table in `docs/oidc/features.md` — this gives users both provider-specific detail and a quick cross-provider comparison
- **ProviderEditForm upgrade:** Import and reuse logic from `@/lib/oidc-providers` (same as ProviderAddForm) rather than duplicating the provider spec definitions
- **Code dedup:** The duplicate `detectProviderType()` in the logout route is extracted to the shared module — single source of truth
