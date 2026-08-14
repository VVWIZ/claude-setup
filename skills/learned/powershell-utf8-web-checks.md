---
name: powershell-utf8-web-checks
description: Проверка не-ASCII контента (кириллица и др.) на живом сайте через PowerShell даёт ложные негативы — Invoke-WebRequest.Content портит кодировку. Триггер: проверяю деплой/контент сайта с не-латинским текстом из PowerShell.
metadata:
  type: reference
---

# PowerShell: ложные негативы при проверке не-ASCII контента на сайте

**Extracted:** 2026-07-12
**Context:** Верификация деплоя лендинга — проверял, встал ли на прод новый русский текст.

## Problem

`Invoke-WebRequest -UseBasicParsing` отдаёт `.Content`, декодированный **не как UTF-8** (PowerShell 5.1 полагается на charset из заголовков и часто промахивается). В результате:

- `$r.Content -match 'Сон, кормление'` → **False**, хотя текст на странице есть;
- ASCII-проверки в том же ответе (`id="how"`, `fbq('init'`) → **True**.

**Симптом-маркер: в одном и том же ответе ASCII находится, а кириллица — нет.** Это почти всегда кодировка, а не отсутствие контента.

Цена ошибки: увело в ложный диагноз «деплой не встал» — я полез копать билд-очередь и кэш, хотя новая версия уже была в проде.

## Solution

Качать байты и декодировать UTF-8 явно:

```powershell
$wc = New-Object System.Net.WebClient
$bytes = $wc.DownloadData("https://example.com/?cb=$([DateTimeOffset]::Now.ToUnixTimeSeconds())")
$html = [System.Text.Encoding]::UTF8.GetString($bytes)
$html -match 'Сон, кормление'   # теперь True
```

## When to Use

- Проверяю через PowerShell, что задеплоился контент с кириллицей/не-латиницей.
- Получил противоречие: ASCII-маркеры в ответе есть, а не-ASCII «нет» → не верь, перепроверь с явным декодом.
- Любой `-match` / `Select-String` по HTML с не-латинским текстом.

## Related gotcha

Строка `"попытка $i: ..."` → PowerShell парсит `$i:` как drive-нотацию → `ParserError: Variable reference is not valid`. Писать `${i}`.
