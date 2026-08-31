# Research Basis (Aug 2026)

Primary patterns used in this build harness:
- Anthropic, “Effective harnesses for long-running agents” (Nov 2025): initializer + incremental coding agent, structured progress artifact, feature JSON, git commits, explicit end-to-end testing.
- Anthropic, “Harness design for long-running application development” (Mar 2026): decompose work, structured handoffs, planner/generator/evaluator pattern, context-reset lessons.
- Anthropic, “How Claude Code is used in practice” (Jun 2026): users tend to make planning decisions while Claude executes; domain expertise improves success and work per instruction.
- Anthropic Verified Ralph Loop plugin: repeated bounded prompts with persistent files/git until objective completion.
- YC Terminal Use (W26): reports using actor-critique loops and Claude Code/Ralph harnesses internally.
- YC Compyle (F25): useful counter-signal that excessive autonomy can create many small decisions and code ownership problems. We therefore use bounded tickets and tests, not blind all-day autonomy.
- Graphify upstream project: graph-first navigation and Claude hook integration. Its token-reduction figures are project-reported, not independent guarantees.
