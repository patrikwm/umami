# Coolify Deployment - Environment Variable Reference

This file documents the environment variables used in Coolify deployments.
Coolify auto-generates most of these values - you typically don't need to set them manually.

## Auto-Generated Variables (by Coolify)

These variables are automatically created by Coolify and should not be manually set:

```bash
# Service URLs and FQDNs
SERVICE_FQDN_UMAMI_3000=https://analytics.yourdomain.com
SERVICE_URL_UMAMI_3000=http://umami:3000

# Database credentials (auto-generated)
SERVICE_USER_POSTGRES=auto-generated-username
SERVICE_PASSWORD_POSTGRES=auto-generated-password
SERVICE_PASSWORD_64_UMAMI=auto-generated-base64-secret

# Database configuration
POSTGRES_DB=umami
```

## Required Umami Variables

These are essential for Umami to function:

```bash
# Database connection (constructed from Coolify variables)
DATABASE_URL=postgres://$SERVICE_USER_POSTGRES:$SERVICE_PASSWORD_POSTGRES@postgresql:5432/$POSTGRES_DB
DATABASE_TYPE=postgresql

# Application secrets (reuse Coolify-generated secrets)
APP_SECRET=$SERVICE_PASSWORD_64_UMAMI
AUTH_SECRET=$SERVICE_PASSWORD_64_UMAMI

# Public URL (use Coolify FQDN)
AUTH_URL=$SERVICE_FQDN_UMAMI_3000
```

## Optional Configuration

```bash
# OIDC user auto-creation
OIDC_AUTO_CREATE=true

# Disable local username/password login (forces OIDC-only)
DISABLE_LOCAL_LOGIN=false

# Trust host header (only for testing/development)
# AUTH_TRUST_HOST=true
```

## OIDC Provider Configuration (Optional)

Add these if you want OAuth/OIDC authentication:

### Google OAuth
```bash
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret
```

### GitHub OAuth
```bash
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret
```

### Generic OIDC (Authentik, Keycloak, etc.)
```bash
OIDC_NAME=Authentik
OIDC_ISSUER=https://auth.example.com/application/o/umami/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_AUTH_URL=https://auth.example.com/application/o/authorize/
OIDC_TOKEN_URL=https://auth.example.com/application/o/token/
OIDC_USERINFO_URL=https://auth.example.com/application/o/userinfo/
```

## Advanced Configuration

```bash
# Redis for session storage (recommended with OIDC)
REDIS_URL=redis://redis:6379

# ClickHouse for analytics scaling
CLICKHOUSE_URL=http://clickhouse:8123/umami

# Feature flags
DISABLE_LOGIN=false
DISABLE_UI=false
CLOUD_MODE=false
```

## Security Best Practices

1. **Never** hardcode secrets in your docker-compose.yml
2. Use Coolify's auto-generated secrets (`$SERVICE_PASSWORD_64_UMAMI`)
3. Set `AUTH_URL` to your actual public domain
4. Avoid using `AUTH_TRUST_HOST=true` in production
5. Change the default Umami admin password (`admin`/`umami`) immediately after first login

## Example Docker Compose Snippet

```yaml
environment:
  # Auto-provided by Coolify
  - SERVICE_URL_UMAMI_3000
  - SERVICE_FQDN_UMAMI_3000

  # Database
  - 'DATABASE_URL=postgres://$SERVICE_USER_POSTGRES:$SERVICE_PASSWORD_POSTGRES@postgresql:5432/$POSTGRES_DB'
  - DATABASE_TYPE=postgresql

  # Secrets (reuse Coolify-generated)
  - APP_SECRET=$SERVICE_PASSWORD_64_UMAMI
  - AUTH_SECRET=$SERVICE_PASSWORD_64_UMAMI
  - AUTH_URL=$SERVICE_FQDN_UMAMI_3000

  # Optional OIDC
  - OIDC_AUTO_CREATE=true
  - DISABLE_LOCAL_LOGIN=false

  # Add your OIDC provider variables here if needed
```

## Troubleshooting

### AUTH_URL Not Working
If you see "UntrustedHost" errors, manually set AUTH_URL:
```bash
AUTH_URL=https://analytics.yourdomain.com
```

### Coolify Variables Not Expanding
Ensure you're using single quotes in docker-compose for variable interpolation:
```yaml
# Correct
- 'DATABASE_URL=postgres://$SERVICE_USER_POSTGRES:...'

# Incorrect (Docker will not interpolate)
- "DATABASE_URL=postgres://$SERVICE_USER_POSTGRES:..."
```
