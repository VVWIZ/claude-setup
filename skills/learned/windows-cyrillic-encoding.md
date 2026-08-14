---
name: windows-cyrillic-encoding
description: Гочи кодировок под Windows — .ps1 без BOM ломает PowerShell 5.1 на кириллице, и curl с кириллицей в теле под Git Bash бьётся в cp1251. Триггерить при написании PowerShell-скриптов с русским текстом или при HTTP-запросах curl с кириллицей/UTF-8 в теле на Windows.
metadata:
  type: reference
---

# Windows: кодировки текста (PowerShell .ps1 + curl body)

**Extracted:** 2026-07-19
**Context:** Windows 10, PowerShell 5.1 (powershell.exe) + Git Bash. Русскоязычные скрипты и API-запросы с кириллицей.

## Проблема

Две независимые, но родственные ошибки — обе от несовпадения UTF-8 и системной ANSI-кодовой страницы (cp1251):

1. **PowerShell 5.1 читает `.ps1` без BOM как ANSI (cp1251), а не UTF-8.**
   Если в скрипте есть кириллица или типографские тире (`—`), парсер спотыкается:
   `The string is missing the terminator: "`, `Unexpected token ')'`,
   `Missing closing '}'` — при том, что синтаксис на самом деле корректный.
   (Инструменты записи файлов обычно пишут UTF-8 **без** BOM → грабли.)

2. **`curl` с кириллицей в теле (`-d '{"title":"Строительство"}'`) под Git Bash на Windows**
   портит байты (UTF-8 → cp1251) → FastAPI/сервер отвечает
   `{"detail":"There was an error parsing the body"}` (невалидный JSON/UTF-8).
   Пайплайн/тесты при этом на тех же данных проходят — значит дело не в коде, а в шелле.

## Решение

1. **`.ps1` сохранять как UTF-8 С BOM.** Проверка синтаксиса без запуска — через
   `[System.Management.Automation.Language.Parser]::ParseFile(...)`; пересохранение с BOM —
   `System.Text.UTF8Encoding($true)` + `[IO.File]::WriteAllText`.
2. **Тело `curl` не передавать кириллицей в аргументе** — генерировать JSON в Python и
   подавать в stdin через `--data-binary @-` (гарантированный UTF-8).

## Example

Пересохранить .ps1 в UTF-8 BOM и проверить парсинг (PowerShell):
```powershell
$p = (Resolve-Path 'scripts\dev-up.ps1').Path
$text = Get-Content -Raw -Encoding UTF8 $p
[IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding($true)))  # BOM=true
$errs = $null
[System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs) | Out-Null
if ($errs) { $errs | ForEach-Object { "L$($_.Extent.StartLineNumber): $($_.Message)" } } else { 'OK' }
```

curl с кириллическим телом через Python-stdin (Git Bash):
```bash
python -c "import json,sys; sys.stdout.buffer.write(json.dumps({'title':'Строительство завода'}).encode())" \
  | curl -s -X POST "$B/endpoint" -H "Content-Type: application/json" --data-binary @-
```

## When to Use

- Пишешь/правишь `.ps1` с русскими комментариями или строками (особенно если его будет
  запускать пользователь через `powershell -File ...`) → сохраняй UTF-8 BOM, парс-проверяй.
- Делаешь `curl`/HTTP-запрос с кириллицей (или любым не-ASCII) в теле под Windows/Git Bash
  и получаешь «error parsing body» / кракозябры → подавай тело из Python через stdin.
- Общий признак: «на Windows не работает, хотя код/тесты на тех же данных зелёные» → подозревай
  cp1251 vs UTF-8 в шелле/файле, а не логику.
