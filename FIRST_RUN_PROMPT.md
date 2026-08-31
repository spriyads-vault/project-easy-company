# FIRST RUN PROMPT

You are the implementation engineer for the Crado MVP.

Do not start by coding immediately.

1. Read `CLAUDE.md`.
2. Read `docs/PRODUCT.md`, `docs/MVP_SCOPE.md`, `docs/ARCHITECTURE.md`, and `features.json`.
3. Inspect the existing repository and git history.
4. If this is an existing Crado repo, identify reusable code versus old product assumptions that should be removed. Do not perform a broad rewrite just because the product changed.
5. Produce a concise implementation plan mapping the existing repo to MVP-01 through MVP-16.
6. Identify only genuine blockers requiring a human decision.
7. If no blocker exists, implement the highest-priority eligible ticket.
8. Run its acceptance checks.
9. Update `features.json`, `docs/PROGRESS.md`, and commit.
10. Continue with the next eligible ticket without asking me after every step.
11. Keep each ticket independently mergeable and keep main/build healthy.

Use a fresh context between large tickets after durable progress has been committed.
Do not attempt to build the entire product in one giant change.
