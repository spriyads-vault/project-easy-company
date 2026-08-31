# Unattended Claude Code Mode

There are two different interruption types:

1. **Decision prompts** such as “Option 1 / 2 / 3?”  
   `CLAUDE.md` now tells Claude to choose its own recommended option for reversible in-scope decisions.

2. **Tool permission prompts** for edits/commands.  
   `.claude/settings.json` defaults to `acceptEdits` and pre-approves routine test/git commands while keeping deployment/push/database operations interactive.

## Best mode
If your Claude Code account exposes **Auto mode**, use it for bounded tickets after you trust the plan. Anthropic documents Auto mode as running tools without routine prompts while applying background safety checks.

Do NOT use `bypassPermissions` on your normal laptop/project. Anthropic recommends it only in isolated containers/VMs because it removes the permission layer.

If Auto mode is unavailable, the included `acceptEdits` + allow rules is the safer low-interruption fallback.

## Recommended operating pattern
1. Start a ticket in Plan mode only when architecture is genuinely uncertain.
2. Approve the plan into Auto mode if available, otherwise acceptEdits.
3. Let Claude execute the ticket without preference menus.
4. Human input only for one-way-door decisions listed in CLAUDE.md.
5. Tests + git + `PROGRESS.md` are the checkpoint.
