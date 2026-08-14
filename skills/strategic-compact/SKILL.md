---
name: strategic-compact
description: Подсказывает ручной /compact на логичных границах задачи (после порога вызовов инструментов), чтобы не терять контекст от авто-компакта посреди работы.
---

# Strategic Compact Skill

Suggests manual `/compact` at strategic points in your workflow rather than relying on arbitrary auto-compaction.

## Why Strategic Compaction?

Auto-compaction triggers at arbitrary points:
- Often mid-task, losing important context
- No awareness of logical task boundaries
- Can interrupt complex multi-step operations

Strategic compaction at logical boundaries:
- **After exploration, before execution** — compact research context, keep implementation plan
- **After completing a milestone** — fresh start for next phase
- **Before major context shifts** — clear exploration context before a different task

## How It Works

The `suggest-compact.js` hook runs on PreToolUse (Edit/Write):

1. **Tracks tool calls** — counts invocations per session (temp counter file)
2. **Threshold detection** — suggests at configurable threshold (default: 50 calls)
3. **Periodic reminders** — reminds every 25 calls after threshold

## Hook Setup (installed)

In `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/ecc/suggest-compact.js\"",
        "timeout": 10
      }]
    }]
  }
}
```

## Configuration

Environment variable:
- `COMPACT_THRESHOLD` — tool calls before first suggestion (default: 50)

## Best Practices

1. **Compact after planning** — once plan is finalized, compact to start fresh
2. **Compact after debugging** — clear error-resolution context before continuing
3. **Don't compact mid-implementation** — preserve context for related changes
4. **Read the suggestion** — the hook tells you *when*, you decide *if*

## Source

Adapted from [WorldFlowAI/everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code)
(session id now read from hook stdin JSON, suggestion delivered via systemMessage).
