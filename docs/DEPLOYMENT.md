# Deployment

## Target
Vercel + Supabase.

## Before first production deployment
- `.env.example` exists with names only, no secrets.
- Production environment variables configured in host.
- Supabase RLS verified with cross-user tests.
- Storage bucket private.
- Upload validation in place.
- Production database migrations applied through versioned migrations.
- Seed/demo data is isolated from customer data.
- Error logging does not include raw customer documents.
- AI provider key server-side only.
- Build, lint, typecheck, unit tests and critical E2E pass.
- `/api/health` or equivalent smoke check works.

## Deployment rule
Claude may prepare deployment configuration and run non-destructive checks. It must ask before creating paid resources, changing DNS, deleting production data, or exposing a previously private service.
