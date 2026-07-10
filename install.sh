#!/bin/bash
# ============================================
# Claude Setup — установка в ~/.claude/
# Бэкапит существующие CLAUDE.md и agents/, копирует сетап,
# settings.json НЕ трогает (merge вручную — см. вывод в конце).
# ============================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GLOBAL_DIR="$HOME/.claude"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$GLOBAL_DIR/backups/claude-setup-$STAMP"

echo "========================================"
echo "  Claude Setup → $GLOBAL_DIR"
echo "========================================"
echo ""

mkdir -p "$GLOBAL_DIR"

# --- 0. Бэкап того, что перезапишем ---
mkdir -p "$BACKUP_DIR"
[ -f "$GLOBAL_DIR/CLAUDE.md" ] && cp "$GLOBAL_DIR/CLAUDE.md" "$BACKUP_DIR/CLAUDE.md" && echo "  ✓ бэкап CLAUDE.md → $BACKUP_DIR"
[ -d "$GLOBAL_DIR/agents" ] && cp -r "$GLOBAL_DIR/agents" "$BACKUP_DIR/agents" && echo "  ✓ бэкап agents/"
echo ""

# --- 1. CLAUDE.md, MODEL-ROUTING.md ---
cp "$SCRIPT_DIR/CLAUDE.md" "$GLOBAL_DIR/CLAUDE.md"
cp "$SCRIPT_DIR/MODEL-ROUTING.md" "$GLOBAL_DIR/MODEL-ROUTING.md"
echo "  ✓ CLAUDE.md + MODEL-ROUTING.md"

# --- 2. Скиллы ---
skill_count=0
for skill_dir in "$SCRIPT_DIR/skills"/*/; do
  name="$(basename "$skill_dir")"
  mkdir -p "$GLOBAL_DIR/skills/$name"
  cp -r "$skill_dir." "$GLOBAL_DIR/skills/$name/"
  skill_count=$((skill_count + 1))
done
echo "  ✓ $skill_count скиллов → skills/"

# --- 3. Агенты (full-replace: без призраков удалённых) ---
rm -rf "$GLOBAL_DIR/agents"
mkdir -p "$GLOBAL_DIR/agents"
cp "$SCRIPT_DIR/agents/"*.md "$GLOBAL_DIR/agents/"
echo "  ✓ $(ls "$SCRIPT_DIR/agents/"*.md | wc -l | tr -d ' ') субагента → agents/"

# --- 4. Хуки и команды ---
mkdir -p "$GLOBAL_DIR/hooks"
cp -r "$SCRIPT_DIR/hooks/ecc" "$GLOBAL_DIR/hooks/"
echo "  ✓ хуки → hooks/ecc/"
mkdir -p "$GLOBAL_DIR/commands"
cp "$SCRIPT_DIR/commands/"*.md "$GLOBAL_DIR/commands/"
echo "  ✓ команды → commands/"

# --- 5. Статус-строка ---
cp "$SCRIPT_DIR/statusline/statusline.sh" "$GLOBAL_DIR/statusline.sh"
echo "  ✓ statusline.sh"

echo ""
echo "========================================"
echo "  Готово. Остался ОДИН ручной шаг:"
echo "========================================"
echo ""
echo "  Перенеси нужные фрагменты из settings.example.json"
echo "  в свой $GLOBAL_DIR/settings.json:"
echo "    • \"model\": \"opus[1m]\"          — дефолт главного цикла"
echo "    • \"statusLine\": {...}            — статус-строка"
echo "    • \"hooks\": {...}                 — хуки ecc (нужен Node.js)"
echo "    • \"permissions\": {...}           — пример allow/ask (по вкусу)"
echo ""
echo "  settings.json НЕ перезаписан намеренно — там твои личные permissions."
echo "  Затем перезапусти сессию Claude Code (агенты и статус-строка подхватятся)."
echo "========================================"
