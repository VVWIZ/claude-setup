---
name: continuous-learning
description: Автоизвлечение переиспользуемых паттернов из сессий Claude Code — решения ошибок, обходы, конвенции — с сохранением в skills/learned/ после апрува пользователя.
---

# Continuous Learning Skill

Automatically evaluates Claude Code sessions to extract reusable patterns that can be saved as learned skills.

## How It Works

A **Stop hook** (`~/.claude/hooks/ecc/evaluate-session.js`) fires once per session:

1. **Session Evaluation**: checks the session has enough real user messages (default: 10+)
2. **Pattern Detection**: nudges Claude to look for extractable patterns
3. **Approval Gate**: Claude offers `/learn` to the user — nothing is saved without confirmation
4. **Skill Extraction**: confirmed patterns are saved to `~/.claude/skills/learned/`

## Configuration

Edit `config.json` in this directory:

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "~/.claude/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

## Pattern Types

| Pattern | Description |
|---------|-------------|
| `error_resolution` | How specific errors were resolved |
| `user_corrections` | Patterns from user corrections |
| `workarounds` | Solutions to framework/library quirks |
| `debugging_techniques` | Effective debugging approaches |
| `project_specific` | Project-specific conventions |

## Hook Setup (installed)

In `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node \"~/.claude/hooks/ecc/evaluate-session.js\"",
        "timeout": 15
      }]
    }]
  }
}
```

The hook fires **max once per session** (marker file in temp), respects
`stop_hook_active` to avoid loops, and stays silent for short sessions.

## Manual Extraction

Use `/learn` at any point mid-session to extract a pattern without waiting
for the session-end nudge.

## Source

Adapted from [WorldFlowAI/everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code)
(transcript path now read from hook stdin JSON; extraction is approval-gated).
