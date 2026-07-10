# Git Bash на Windows искажает бэкслеши в JSON при передаче через shell

**Extracted:** 2026-07-06
**Context:** Тестирование Node.js-скриптов (хуки Claude Code, CLI), принимающих JSON со stdin, на Windows-машине через Git Bash

## Problem

MSYS/Git Bash выполняет конвертацию аргументов при вызове нативных Windows-программ: `\\` в строках превращается в `\`, даже внутри одинарных кавычек. Два проявления из реальной сессии:

1. `echo '{"file_path":"C:\\proj\\FILE.md"}' | node hook.js` — до node доходит `"C:\proj\..."`, `JSON.parse` падает на невалидном escape (`\p`). Если скрипт глотает ошибку парсинга через `try/catch → exit 0` (типично для хуков), тест даёт **ложный PASS/FAIL без единой ошибки на экране** — выглядит как «хук не работает».
2. `node -e 'скрипт с "C:\\Users\\..."'` — та же конвертация ломает сам код: `SyntaxError: Invalid hexadecimal escape sequence` на `\U`.

## Solution

Не передавать JSON с Windows-путями через shell-строки вообще. Надёжные способы:

- **Лучший**: тест-скрипт на Node, который сам генерит вход и вызывает цель через `spawnSync` с опцией `input` — шелл не участвует:
- Либо записать JSON в файл (Write-тулом или `fs.writeFileSync`) и делать `cat payload.json | node hook.js`.
- Либо строить JSON внутри node: `node -e "console.log(JSON.stringify({p: String.raw\`C:\proj\x\`}))" | node hook.js` — но проще первый вариант.

## Example

```js
// test.js — запускать: node test.js (никакого echo '<json>')
const { spawnSync } = require('child_process');
const r = spawnSync('node', ['hook.js'], {
  input: JSON.stringify({ tool_input: { file_path: 'C:\\proj\\SUMMARY.md' } }),
  encoding: 'utf8',
});
console.log(r.status, r.stdout, r.stderr);
```

## When to Use

- Тестирование хуков Claude Code / любых stdin-JSON CLI на Windows
- Любая передача строк с `\\` (пути, regex) в нативные exe через Git Bash
- Симптом-триггер: «скрипт молча делает не то в bash-тесте, но работает при прямом запуске» или `Invalid hexadecimal escape sequence` в `node -e`
