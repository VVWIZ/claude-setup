#!/usr/bin/env node
/**
 * Strategic Compact Suggester (PreToolUse, matcher: Edit|Write)
 *
 * Suggests manual /compact at logical intervals instead of relying on
 * auto-compaction at arbitrary points mid-task.
 *
 * Adapted from WorldFlowAI/everything-claude-code:
 * - session_id read from hook stdin JSON (upstream relied on env vars
 *   that current Claude Code versions do not set)
 * - standalone, no lib/utils dependency
 * - message delivered via documented systemMessage JSON output
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const THRESHOLD = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(data);
  } catch {
    // continue with defaults
  }

  const sessionId = input.session_id || 'default';
  const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

  let count = 1;
  try {
    const parsed = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    // guard against corrupted counter file — NaN would silence the hook forever
    if (Number.isFinite(parsed)) count = parsed + 1;
  } catch {
    // first call in session
  }
  try {
    fs.writeFileSync(counterFile, String(count));
  } catch {
    process.exit(0);
  }

  let msg = null;
  if (count === THRESHOLD) {
    msg = `[StrategicCompact] ${THRESHOLD} вызовов инструментов — если фаза задачи сменилась (research → код), хорошая точка для /compact`;
  } else if (count > THRESHOLD && count % 25 === 0) {
    msg = `[StrategicCompact] ${count} вызовов — чекпоинт для /compact, если старый контекст больше не нужен`;
  }

  if (msg) {
    console.log(JSON.stringify({ systemMessage: msg }));
  }
  process.exit(0);
});
