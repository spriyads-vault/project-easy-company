# Claude Pro: Maximum Useful Work per 5-Hour Window

The five-hour reset is a subscription usage limit. No memory or graph tool bypasses it. The objective is to reduce wasted context and make each window produce clean commits.

## Per window
1. Do architecture/product decisions outside the coding loop when possible.
2. Start with a fresh Claude Code context.
3. Let CLAUDE.md load automatically.
4. Read progress + features + graph, not the whole repo.
5. Complete 2–4 bounded tickets depending on complexity.
6. Commit after every ticket.
7. Use `/clear` after a large ticket once progress is durable.
8. Do not run multiple expensive subagents by default.
9. Use Ralph only for a ticket with objective tests, max ~3–5 iterations.
10. When the “approaching 5-hour limit” warning appears, finish/revert the current unit, run tests, update progress, and commit. Do not start a new large ticket.

## Why
Anthropic’s long-running-agent work found that incremental features, structured handoffs, git history, a progress artifact, tests, and fresh contexts are more reliable than one giant autonomous prompt. Their 2026 harness work also used planner/generator/evaluator roles, but a full multi-agent harness is much more expensive. On Pro, emulate the pattern economically:
- human/Claude Plan Mode = planner
- one coding agent = generator
- tests + occasional separate review = evaluator

## Ralph
Use an Anthropic-verified Ralph Loop only for bounded work:
```text
/ralph-loop "Complete MVP-06 from features.json. Follow CLAUDE.md. Run all acceptance checks. Update progress and commit. Output TASK COMPLETE only when the ticket genuinely passes." --max-iterations 4 --completion-promise "TASK COMPLETE"
```
Do not Ralph-loop the whole MVP. It can consume the five-hour allowance quickly.

## Subagents
Use sparingly on Pro:
- security review before deployment
- independent review of a risky data migration
- difficult bug where separate context helps
Avoid fleets/parallel agents for normal CRUD/UI work.
