#!/usr/bin/env node
/**
 * Continuous Learning - Session Evaluator (Stop hook)
 *
 * Once per session, after the conversation grows past the configured
 * threshold, nudges Claude to offer /learn to the user so reusable
 * patterns get extracted to ~/.claude/skills/learned/.
 *
 * Adapted from WorldFlowAI/everything-claude-code:
 * - transcript_path read from hook stdin JSON (upstream read
 *   CLAUDE_TRANSCRIPT_PATH env var, which is not set by current versions,
 *   so the upstream hook was a silent no-op)
 * - fires max once per session (marker file in temp)
 * - respects stop_hook_active to avoid loops
 * - extraction itself stays approval-gated: Claude only OFFERS /learn
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_FILE = path.join(os.homedir(), '.claude', 'skills', 'continuous-learning', 'config.json');

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  // Never re-fire while Claude is already continuing because of a Stop hook
  if (input.stop_hook_active) process.exit(0);

  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  let minSessionLength = 10;
  let learnedPath = path.join(os.homedir(), '.claude', 'skills', 'learned');
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (config.min_session_length) minSessionLength = config.min_session_length;
    if (config.learned_skills_path) {
      learnedPath = config.learned_skills_path.replace(/^~/, os.homedir());
    }
  } catch {
    // defaults
  }

  const sessionId = input.session_id || 'default';
  const markerFile = path.join(os.tmpdir(), `claude-learn-suggested-${sessionId}`);
  if (fs.existsSync(markerFile)) process.exit(0);

  // Count real user prompts (tool results also have type:user — skip them)
  let userMessages = 0;
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    userMessages = lines.filter(
      (l) => l.includes('"type":"user"') && !l.includes('tool_result')
    ).length;
  } catch {
    process.exit(0);
  }

  if (userMessages < minSessionLength) process.exit(0);

  try {
    fs.writeFileSync(markerFile, new Date().toISOString());
  } catch {
    process.exit(0);
  }

  console.error(
    `[ContinuousLearning] В сессии ${userMessages}+ сообщений. Проверь: были ли решены нетривиальные проблемы ` +
      `(ошибки с неочевидной причиной, обходы библиотек, исправления от пользователя, конвенции проекта)? ` +
      `Если да — кратко предложи пользователю: "Замечен паттерн X → сохраняем через /learn или пропускаем?" ` +
      `(сохранение в ${learnedPath} только после его подтверждения). ` +
      `Если извлекать нечего — просто заверши ответ, ничего не упоминая.`
  );
  process.exit(2);
});
