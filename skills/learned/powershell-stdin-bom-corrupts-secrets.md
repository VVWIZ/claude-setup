---
name: powershell-stdin-bom-corrupts-secrets
description: Windows PowerShell при передаче строки в stdin нативной программы дописывает BOM (U+FEFF) в начало — секрет молча сохраняется испорченным и падает там, где значение обязано быть ASCII (HTTP-заголовок Authorization, Basic-auth, токен в query). Триггерить при `echo/$var | tool set-secret --stdin` на Windows и при диагностике UnicodeEncodeError '﻿' / невалидного ключа, который «точно правильный».
metadata:
  type: reference
---

# PowerShell stdin дописывает BOM и портит секреты

**Extracted:** 2026-07-26
**Context:** Задание `RESEND_API_KEY` в Railway через `railway variable set --stdin` из Windows PowerShell. Ключ скопирован верно, но каждое письмо падало.

## Problem

Чтобы секрет не светился в списке процессов и в истории команд, его правильно передавать через stdin, а не аргументом:

```powershell
$key | railway variable set RESEND_API_KEY --stdin --service api      # ← BOM!
```

**Windows PowerShell 5.1 кодирует пайп в нативную программу с BOM.** В хранилище уезжает `﻿re_ABC…` вместо `re_ABC…`. Ошибки на этом шаге нет: команда «успешна», значение выглядит правильным в любом выводе (BOM невидим), длина отличается на 1.

Ломается позже и в неочевидном месте — там, где значение обязано быть ASCII:

```
UnicodeEncodeError: 'ascii' codec can't encode character '﻿'
                    in position 7: ordinal not in range(128)
```

`position 7` — это длина `"Bearer "`, то есть первый символ самого ключа. Аналогично ломаются Basic-auth, подпись запроса, любой заголовок.

**Коварство:** секреты, которые НЕ уходят в заголовки (JWT-подпись, pepper для HMAC), с BOM работают нормально — строка используется одинаково при записи и при проверке. То есть часть секретов «работает», часть падает, и это сбивает с диагноза.

## Solution

**Проверить наличие BOM, не печатая секрет:**
```powershell
$val = (railway variable list --service api --json | ConvertFrom-Json).RESEND_API_KEY
"длина=$($val.Length), BOM=$(if ($val[0] -eq [char]0xFEFF) {'ДА'} else {'нет'})"
```
Коды первых символов: `$val.ToCharArray() | % { [int]$_ }` → `65279` в начале и есть BOM.

**Задавать через bash (Git Bash есть везде, где стоит git):**
```bash
printf '%s' "$SECRET" | railway variable set KEY --stdin --service api
```
`printf` (не `echo`) — без перевода строки и без BOM.

**Или аргументом `KEY=VALUE`**, если утечка в историю/список процессов приемлема (для одноразового значения на своей машине — обычно да): именно так заданное `EMAIL_FROM` в том же прогоне оказалось чистым.

**Починка PowerShell-пайпа**, если bash недоступен:
```powershell
$OutputEncoding = New-Object System.Text.UTF8Encoding $false   # $false = без BOM
```

## Example

Симптом → диагноз за один шаг:

| Что видно | Что это значит |
|---|---|
| `UnicodeEncodeError: '﻿' in position N` | BOM в значении; N = длина префикса перед секретом |
| Ключ «точно верный», но провайдер отвечает 401/ошибкой кодирования | сравнить `.Length` с ожидаемой длиной ключа — будет +1 |
| Один секрет ломается, другой (той же выдачи) работает | тот, что работает, не уходит в HTTP-заголовок |

После починки перезадать **все** секреты, заданные тем же способом: BOM в них тоже есть, просто пока безвреден.

## When to Use

- Любая передача значения в stdin нативной утилиты из Windows PowerShell — `railway variable set`, `gh secret set`, `vercel env add`, `docker login --password-stdin`, `kubectl create secret`.
- Диагностика «ключ правильный, но не работает» на Windows.
- `UnicodeEncodeError` с `﻿` в любом коде, отправляющем HTTP-заголовки.
- Родственное про кодировки в этом же окружении: [[windows-cyrillic-encoding]], [[powershell-utf8-web-checks]].
