---
name: alembic-psycopg2-alongside-asyncpg
description: FastAPI/SQLAlchemy async на asyncpg, но Alembic env.py гонит миграции через psycopg2 — psycopg2-binary ОБЯЗАН быть в requirements рядом с asyncpg, иначе `alembic upgrade head` в preDeploy падает ModuleNotFoundError. Триггерить при деплое async-Python-бэка с alembic-миграциями на Postgres.
metadata:
  type: reference
---

# Alembic sync-миграции (psycopg2) рядом с async-рантаймом (asyncpg)

**Extracted:** 2026-07-25
**Context:** Деплой FastAPI + SQLAlchemy async (asyncpg) на Postgres, миграции через Alembic в preDeploy.

## Problem
Async-проект использует `asyncpg` в рантайме (`app/db/session.py` → `postgresql+asyncpg://`), но Alembic `env.py` конвертирует `DATABASE_URL` в **`postgresql+psycopg2://`** (синхронный движок — Alembic работает синхронно). Это два **разных** драйвера.

Если в `requirements.txt` есть только `asyncpg`, а `psycopg2`/`psycopg2-binary` забыт — `preDeployCommand: alembic upgrade head` на Postgres падает:
```
ModuleNotFoundError: No module named 'psycopg2'
```
Деплой не активируется, API не поднимается. На sqlite (локальные тесты) не воспроизводится — там свой драйвер, поэтому зелёные тесты проблему прячут.

**Признак в коде:** `alembic/env.py` содержит `.replace("+asyncpg", "+psycopg2")` или явный `postgresql+psycopg2`, а `requirements.txt`/`pyproject.toml` не содержит `psycopg2`.

## Solution
Держать **`psycopg2-binary`** в requirements рядом с `asyncpg`:
- psycopg2 нужен только для короткого sync-процесса миграции в preDeploy; рантайм приложения остаётся на asyncpg.
- `-binary` wheel самодостаточен (тянет свой libpq) — ставится на `python:3.12-slim` **без** `gcc`/`libpq-dev`, Dockerfile трогать не надо.
- Для рантайма прода psycopg2-разработчики советуют сборку из исходников, но здесь psycopg2 только для миграций — `-binary` полностью уместен.

**Проверка до пуша** (на целевой СУБД, не sqlite): в чистом контейнере того же образа, что прод —
```bash
docker run --rm -v "PATH/backend:/app" -w /app \
  -e DATABASE_URL='postgresql+asyncpg://user:pass@pg-host:5432/db' \
  python:3.12-slim bash -c \
  'pip install -q -r requirements.txt && python -c "import psycopg2; print(psycopg2.__version__)" && alembic upgrade head && alembic current'
```
Ожидается: `import psycopg2` ок + цепочка миграций до `... (head)`.

## Example
```txt
# requirements.txt
asyncpg==0.31.0
# Sync-драйвер для Alembic: env.py гонит миграции через postgresql+psycopg2://
# (asyncpg — только рантайм). Без него preDeploy alembic падает ModuleNotFoundError.
psycopg2-binary==2.9.10
```

## When to Use
- Деплой async-Python-бэка (FastAPI/Starlette + SQLAlchemy async + asyncpg) с Alembic-миграциями на Postgres.
- В `alembic/env.py` виден sync-драйвер (`psycopg2`), а рантайм на asyncpg.
- Ошибка `No module named 'psycopg2'` в preDeploy/CI-миграции при зелёных локальных тестах на sqlite.
