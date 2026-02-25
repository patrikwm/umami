# Deployment Guides

This directory contains platform-specific deployment guides for Umami.

## Available Guides

- **[Coolify](./coolify.md)** - Deploy Umami on Coolify using Docker Compose
  - [Environment Variable Reference](./coolify-env-reference.md) - Detailed env documentation for Coolify

## General Requirements

All deployment methods require:

- **Node.js** version 18.18+ (for source installations)
- **PostgreSQL** version 12.14+
- **Domain/Subdomain** configured with SSL/TLS

## Environment Variables

Core environment variables required for any deployment:

```bash
DATABASE_URL=postgresql://username:password@host:5432/umami
APP_SECRET=your-random-secret-key
AUTH_SECRET=your-auth-secret-key  # Required for OIDC
AUTH_URL=https://your-domain.com  # Required for OIDC
```

Generate secrets with:
```bash
openssl rand -base64 32
```

## Quick Start Options

### Docker Compose (Generic)

See the [docker-compose.yml](../../docker-compose.yml) in the root directory for a basic Docker setup.

### From Source

See the main [README.md](../../README.md) for installing from source.

## Contributing

Have a deployment guide for another platform? Contributions are welcome! Please submit a pull request with:

- A new markdown file in this directory
- Clear step-by-step instructions
- Troubleshooting section
- Update this README with a link

Popular platforms we'd love guides for:
- AWS (ECS, Fargate, EC2)
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform
- Kubernetes/Helm
- Railway
- Render
- Fly.io
