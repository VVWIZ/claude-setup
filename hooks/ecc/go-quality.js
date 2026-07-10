#!/usr/bin/env node
/**
 * Go quality gate (PostToolUse, matcher: Edit|Write)
 *
 * After editing a .go file: gofmt the file, then `go vet` its package.
 * Vet/compile errors are fed back to Claude (exit 2) for immediate fixing.
 *
 * Go-stack replacement for the prettier/tsc hooks from
 * WorldFlowAI/everything-claude-code. Silently no-ops outside Go projects
 * (no .go file, no go.mod, no Go toolchain).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findGoMod(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'go.mod'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

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
  if (!/\.go$/.test(p) || !fs.existsSync(p)) process.exit(0);

  const fileDir = path.dirname(p);
  if (!findGoMod(fileDir)) process.exit(0);

  const base = path.basename(p);
  const cleanLines = (raw) =>
    raw
      .split('\n')
      .filter((l) => l.trim() && !/^#/.test(l) && !/^go: downloading/.test(l));

  try {
    execFileSync('gofmt', ['-w', p], { stdio: 'pipe', timeout: 15000, encoding: 'utf8' });
  } catch (e) {
    if (e.code === 'ENOENT') process.exit(0); // no Go toolchain in PATH — stay silent
    // gofmt fails on syntax errors — report them instead of swallowing
    const out = cleanLines((e.stderr || '') + '\n' + (e.stdout || '')).slice(0, 15).join('\n');
    if (out) {
      console.error(`[Hook] gofmt: синтаксическая ошибка в ${base}:\n${out}`);
      process.exit(2);
    }
    process.exit(0);
  }

  let vetRaw = '';
  try {
    execFileSync('go', ['vet', '.'], { cwd: fileDir, stdio: 'pipe', timeout: 60000, encoding: 'utf8' });
  } catch (e) {
    if (e.code === 'ENOENT') process.exit(0);
    vetRaw = (e.stderr || '') + '\n' + (e.stdout || '');
  }

  const lines = cleanLines(vetRaw);
  // Report only errors touching the edited file; pre-existing errors elsewhere
  // in the package are summarized once instead of spammed on every edit
  const mine = lines.filter((l) => l.includes(base)).slice(0, 15);
  if (mine.length) {
    console.error(`[Hook] go vet нашёл проблемы после правки ${base}:\n${mine.join('\n')}`);
    process.exit(2);
  }
  if (lines.length) {
    console.error(`[Hook] go vet: в пакете ${fileDir} есть ${lines.length} ошибок в других файлах (вероятно, существовавшие ранее)`);
  }
  process.exit(0);
});
