#!/usr/bin/env node
/**
 * PR URL logger (PostToolUse, matcher: Bash)
 *
 * After `gh pr create`, surfaces the PR URL and a ready review command.
 * Adapted from WorldFlowAI/everything-claude-code (standalone, systemMessage output).
 */

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  const cmd = (input.tool_input && input.tool_input.command) || '';
  if (!/gh pr create/.test(cmd)) process.exit(0);

  const haystack = JSON.stringify(input.tool_response || '');
  const m = haystack.match(/https:\/\/github\.com\/([^/"\\]+\/[^/"\\]+)\/pull\/(\d+)/);
  if (m) {
    console.log(
      JSON.stringify({
        systemMessage: `PR создан: ${m[0]} | Ревью: gh pr review ${m[2]} --repo ${m[1]}`,
      })
    );
  }
  process.exit(0);
});
