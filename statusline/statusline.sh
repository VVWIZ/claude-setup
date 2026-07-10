#!/bin/bash
# Claude Code statusline — модель сессии + режим architect (Fable/Opus) + лимит 5h.
# jq-FREE: парсит stdin через grep/sed (jq не гарантирован в Git Bash на Windows).
# Включён через ~/.claude/settings.json ->
#   "statusLine": { "type": "command", "command": "bash ~/.claude/statusline.sh" }
# rate_limits приходит только подписчикам и только после первого ответа API; отсутствие — норма.

input=$(cat)

# Режим architect из маркера в CLAUDE.md (файл агента всегда opus — Fable подаётся override'ом на вызове)
claude_md="$HOME/.claude/CLAUDE.md"
fable_mode=$(grep -m1 -o '\*\*Fable-режим: [A-Z]*' "$claude_md" 2>/dev/null | grep -o '[A-Z]*$')
case "$fable_mode" in
  ON)  arch_model="fable(ON)" ;;
  OFF) arch_model="opus(OFF)" ;;
  *)   arch_model="?" ;;
esac

# Модель текущей сессии: model.display_name (единственный display_name в JSON statusline)
model=$(printf '%s' "$input" \
  | grep -o '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed 's/.*:[[:space:]]*"\([^"]*\)".*/\1/')

# Лимит 5h (graceful — поля может не быть)
pct=$(printf '%s' "$input" \
  | grep -o '"used_percentage"[[:space:]]*:[[:space:]]*[0-9.]*' \
  | head -1 \
  | grep -o '[0-9.]*$')
limit=""
[ -n "$pct" ] && limit=" | 5h:${pct}%"

printf 'M:%s | architect:%s%s' "${model:-?}" "${arch_model:-?}" "$limit"
