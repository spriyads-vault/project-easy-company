# Graphify + Pro-plan Context Strategy

Graphify is a third-party optimization. It is not Anthropic-verified and must not become the source of truth.

## When to use
Do not index on an almost-empty greenfield repo. Add it after the project has enough files/modules that Claude repeatedly searches for architecture/context.

## Suggested install
Review the current Graphify repository before running third-party install commands.

Current upstream instructions (Aug 2026):
```bash
pip install graphifyy
graphify install
# inside repo, after a graph exists
graphify claude install
graphify hook install
```

Build/query:
```text
/graphify .
/graphify . --update
/graphify query "where is analysis event persistence implemented?"
```

`graphify claude install` adds project CLAUDE.md guidance and a PreToolUse hook so Claude is reminded to consult the graph before broad Glob/Grep.
`graphify hook install` can refresh the graph after commits/branch changes.

## Token-safety rules
- Prefer commit-time updates, not expensive semantic re-indexing after every edit.
- Exclude `.env*`, secrets, node_modules, `.next`, coverage, generated output, uploads and customer documents.
- Read graph first for navigation, then actual source before edits.
- Treat inferred edges as hints.
- For docs/images, Graphify may use an LLM provider. Do not route confidential pilot/customer material to a third party without approval.
- If semantic extraction burns Claude allowance, either disable it or configure a separate approved low-cost provider. Code AST extraction can still give structural value.

Graphify's own published benchmark reports little compression benefit on a tiny six-file corpus and much larger savings on a 52-file mixed corpus. Treat those numbers as vendor/project benchmarks, not guaranteed savings for Crado.
