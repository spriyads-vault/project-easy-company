# Crado

AI-native regulatory engineering — regulation, inside the engineering loop.

Pilot MVP: radiated-emissions investigation for connected hardware. See
`CLAUDE.md` and `docs/` for product scope, architecture, and the operating
instructions this repo is built against. `features.json` tracks tickets;
`docs/PROGRESS.md` is the session handoff log.

## Stack

Next.js (App Router) + React + TypeScript, Tailwind CSS, Zod, Vitest.
Supabase (Postgres/Auth/Storage) and the Vercel AI SDK are added as the auth
and AI tickets land.

## Commands

```bash
pnpm dev         # local dev server
pnpm build       # production build
pnpm start       # run the production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```

Copy `.env.example` to `.env.local` and fill in values before running
anything that touches Supabase or the AI provider.
