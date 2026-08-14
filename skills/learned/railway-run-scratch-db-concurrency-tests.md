---
name: railway-run-scratch-db-concurrency-tests
description: Проверка гонок/локов (FOR UPDATE, дедлоки, конкурентные инварианты) на НАСТОЯЩЕМ Postgres через scratch-базу на прод-инстансе Railway; секреты не попадают в чат (railway run инжектит env). Триггерить, когда SQLite игнорирует FOR UPDATE и «зелёные тесты не доказывают сериализацию», или нужен живой PG той же версии, что прод.
metadata:
  type: reference
---

# Scratch-БД на прод-инстансе PG через `railway run` — честные конкурентные тесты

**Extracted:** 2026-08-10 (сессия закрытия техдолгов for_mam_App: гонка двух DELETE)
**Context:** Дев и тесты живут на SQLite, где `FOR UPDATE` игнорируется — 545 зелёных
тестов доказывают «ничего не сломалось», но не сериализацию. Нужен настоящий Postgres
той же мажорной версии, что прод, без утечки `DATABASE_URL` в переписку.

## Problem

1. Локи/гонки нельзя проверить на SQLite; локального Docker может не быть.
2. Секрет подключения к прод-БД нельзя светить в чате (правило: секреты мимо переписки).
3. `init_db` проекта создаёт схему только на SQLite — на PG «relation does not exist».

## Solution

`railway run --service Postgres -- <команда>` запускает ЛОКАЛЬНУЮ команду с env
Postgres-сервиса (включая `DATABASE_PUBLIC_URL` / TCP-proxy переменные) — значения
видит только процесс, в вывод их не печатаем. Скрипт: админ-коннект psycopg2 →
`CREATE DATABASE scratch` на ТОМ ЖЕ инстансе (та же версия PG, боевая база не
тронута) → схема через `Base.metadata.create_all` → N раундов `asyncio.gather`
с настоящей сервис-функцией → проверка инвариантов → `DROP DATABASE` в `finally`.

## Example

```python
raw = os.environ.get("DATABASE_PUBLIC_URL") or f"postgresql://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}@{os.environ['RAILWAY_TCP_PROXY_DOMAIN']}:{os.environ['RAILWAY_TCP_PROXY_PORT']}/{os.environ.get('PGDATABASE','railway')}"
admin_url = re.sub(r"^postgres://", "postgresql://", raw).split("?")[0]   # без query
scratch_url = re.sub(r"(/)[^/]+$", r"\g<1>lock_scratch_tmp", admin_url)
async_url = scratch_url.replace("postgresql://", "postgresql+asyncpg://", 1)

admin = psycopg2.connect(admin_url); admin.autocommit = True
admin.cursor().execute('CREATE DATABASE "lock_scratch_tmp"')

os.environ["DATABASE_URL"] = async_url          # ДО импорта app.* (get_settings кэширует)
sys.path.insert(0, r"C:\path\to\backend")        # скрипт лежит вне backend/
from app.db.models import Base
async with engine.begin() as conn:               # init_db на не-SQLite схему НЕ создаёт
    await conn.run_sync(Base.metadata.create_all)

results = await asyncio.gather(op_a(), op_b(), return_exceptions=True)  # сама гонка
# finally: pg_terminate_backend(по datname) → DROP DATABASE
```

Запуск (Windows): `railway run --service Postgres -- "C:\...\backend\.venv\Scripts\python.exe" "C:\...\script.py"`

## Грабли (все пойманы на живом прогоне)

1. **Windows**: `railway run` исполняет через cmd — путь к python АБСОЛЮТНЫЙ Windows-стилем (`.venv/Scripts/...` → «не является командой»).
2. **`ModuleNotFoundError: app`** — sys.path[0] у скрипта = его каталог, не cwd; добавлять backend в путь явно.
3. **`relation "users" does not exist`** — `init_db` создаёт схему только на SQLite; на scratch-PG звать `Base.metadata.create_all` напрямую.
4. **`No module named asyncpg`** — дев-venv живёт на aiosqlite; asyncpg доставить (`pip install asyncpg`, он и так в requirements прод-рантайма).
5. `DATABASE_URL` задавать ДО импорта `app.*` — настройки кэшируются.
6. Query-параметры URL срезать (asyncpg не ест `sslmode`); `postgres://` → `postgresql+asyncpg://`.
7. Перед `DROP DATABASE` — `pg_terminate_backend` по datname, иначе «database is being accessed».
8. В stdout — только статусы раундов, НИКОГДА не URL/пароли.

## When to Use

- Проверка `FOR UPDATE` / `populate_existing` / дедлоков / конкурентных инвариантов, когда тесты на SQLite их физически не видят.
- Любой «нужен живой PG той же версии, что прод, а Docker недоступен» — родственный приём для миграций: [[prod-migration-verify-against-deploy-pipeline]] (`mig_scratch`).
- Паттерн раундов: свежие данные на раунд → `asyncio.gather(..., return_exceptions=True)` → инвариант после ОБОИХ исходов; 10 раундов достаточно, чтобы поймать FK-гонку, существовавшую до фикса.
