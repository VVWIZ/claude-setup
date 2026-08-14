---
name: railway-prod-db-query
description: Разовый read-only запрос к прод-БД на Railway из локальной среды — через публичный TCP-прокси сервиса Postgres, без утечки секретов и с кириллицей. Триггер — «покажи/посчитай/дай список X из прод-базы», ad-hoc SQL, когда БД на Railway.
metadata:
  type: reference
---

# Разовый запрос к прод-БД Railway через публичный прокси

**Extracted:** 2026-07-07
**Context:** Baby Tracker (c:\claude\for_mam). Прод-Postgres на Railway; нужен разовый read-only запрос (COUNT, список) из локальной среды агента.

## Problem
- `DATABASE_URL` у сервиса-приложения указывает на внутренний хост `postgres.railway.internal:5432` — резолвится ТОЛЬКО внутри сети Railway; с локальной машины и через `railway run` недоступен (connection refused / DNS).
- Нельзя светить connection string с паролем в транскрипт.
- Windows-консоль (cp1251) роняет кириллицу из БД: `UnicodeEncodeError` на `print`.

## Solution
1. Публичный адрес брать у **сервиса Postgres** (не приложения): переменная `DATABASE_PUBLIC_URL`, хост вида `<name>.proxy.rlwy.net:PORT` — доступен снаружи.
2. Секрет не печатать: `railway variables --service Postgres --json` пайпить прямо в python; URL читать из stdin/JSON, наружу выводить только результат.
3. Кириллица: `PYTHONUTF8=1` (или в скрипте `sys.stdout.reconfigure(encoding="utf-8")`).
4. asyncpg: сначала `ssl="require"`, при отказе — без ssl; URL нормализовать `postgres(ql)(+asyncpg)://` → `postgresql://`.
5. Токен — проектный `RAILWAY_TOKEN` (up/logs/variables/status работают; whoami/link/add — нет).

## Example
```bash
export RAILWAY_TOKEN=<проектный-токен> PYTHONUTF8=1
./.tools/railway.exe variables --service Postgres --json 2>/dev/null \
  | ./.venv/Scripts/python.exe query.py
```
```python
# query.py — URL приходит из stdin (JSON), пароль в транскрипт не попадает
import sys, json, re, asyncio, asyncpg
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
d = json.load(sys.stdin)
url = d.get("DATABASE_PUBLIC_URL") or d.get("DATABASE_URL")
url = re.sub(r"^postgres(ql)?(\+asyncpg)?://", "postgresql://", url.strip())
async def main():
    try: c = await asyncpg.connect(url, ssl="require", timeout=25)
    except Exception: c = await asyncpg.connect(url, timeout=25)
    print(await c.fetchval("select count(*) from children"))
    await c.close()
asyncio.run(main())
```

## When to Use
- «Сколько … в проде», «список … из боевой базы», ad-hoc SELECT по прод-Postgres на Railway.
- Когда `railway run` / локальный connect падает на `*.railway.internal` (unreachable) → переключиться на `DATABASE_PUBLIC_URL` **сервиса Postgres**.
- Всегда read-only для таких запросов; персональные данные наружу не отправлять, пароль не печатать.
