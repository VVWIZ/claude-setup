#!/usr/bin/env node
/**
 * Block junk .md/.txt file creation (PreToolUse, matcher: Write)
 *
 * Blocks creation of stray markdown/text files outside allowed names and
 * directories. Deliverable docs belong in docs/, codemaps/, specs/ etc.
 *
 * Adapted from WorldFlowAI/everything-claude-code for this setup:
 * - allowlist covers Claude Code service dirs (.claude, memory, scratchpad)
 *   and doc-output dirs used by local skills (/docs, /tz, /report)
 * - exit 2 (documented blocking code for PreToolUse), upstream used exit 1
 */

const ALLOWED_BASENAMES = /^(readme|claude|agents|contributing|changelog|license|memory|skill|security|codeowners)[^\\/]*\.(md|txt)$/i;
const ALLOWED_DIR_SEGMENTS = /(^|[\\/])(\.claude|\.reports|docs?|documentation|codemaps|memory|memories|scratchpad|specs?|reports?|wiki|learned|testdata|fixtures|temp|tmp)([\\/]|$)/i;

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  const p = (input.tool_input && input.tool_input.file_path) || '';
  if (!/\.(md|txt)$/i.test(p)) process.exit(0);

  const basename = p.split(/[\\/]/).pop() || '';
  if (ALLOWED_BASENAMES.test(basename)) process.exit(0);
  if (ALLOWED_DIR_SEGMENTS.test(p)) process.exit(0);

  console.error(
    `[Hook] ЗАБЛОКИРОВАНО создание файла: ${p}\n` +
      `[Hook] Случайные .md/.txt-отчёты засоряют проект. Варианты:\n` +
      `[Hook] 1) Выведи содержимое в ответ пользователю вместо файла\n` +
      `[Hook] 2) Если файл-документ действительно нужен — положи в docs/ или specs/\n` +
      `[Hook] 3) Временные заметки — в scratchpad`
  );
  process.exit(2);
});
