---
name: prod-migration-verify-against-deploy-pipeline
description: Перед прод-миграцией БД — сквозная проверка ФАКТИЧЕСКОГО деплой-пайплайна (preDeploy-команда, драйвер, транзакционность env.py) и верификация на ЦЕЛЕВОЙ СУБД, а не на удобной sqlite. Триггер — пишешь/ревьюишь Alembic-миграцию для прод-Postgres, особенно CONCURRENTLY / autocommit-DDL / online-index / data-backfill; видишь op.execute("COMMIT") в миграции.
metadata:
  type: reference
---

# Прод-миграция: сверять с реальным деплой-пайплайном, тестировать на целевой СУБД

**Extracted:** 2026-07-25
**Context:** Alembic-миграция на прод-Postgres (Railway), dev/тесты на SQLite. Особенно CONCURRENTLY / autocommit-DDL / online-index.

## Problem
Взял `CREATE INDEX CONCURRENTLY` по шаблону проекта (`_TEMPLATE_concurrent_index.py.example`), прогнал upgrade/downgrade на temp-sqlite — «зелено», порекомендовал пользователю и закоммитил. `/review --jury` (ось compatibility) нашёл **3 HIGH**:
1. Миграция авто-запустится в `preDeployCommand: alembic upgrade head` (railway.json) — хотя шаблон требует «вручную вне preDeploy». Противоречие лежало в двух файлах, но я их не сопоставил.
2. `env.py` гонит миграции в `context.begin_transaction()` на psycopg2 → `op.execute("COMMIT")` не даёт autocommit (драйвер открывает новую неявную транзакцию) → `CREATE INDEX CONCURRENTLY` падает «cannot run inside a transaction block».
3. Сорванный CONCURRENTLY оставляет INVALID-индекс; `if_not_exists` матчит по ИМЕНИ → повтор «skipping», версия штампуется, а уникальности НЕТ (backstop молча отсутствует).

Корень: (а) доверие шаблону-`.example` как проверенному — он никогда не прогонялся в пайплайне; (б) верификация на НЕ ТОЙ ветке — sqlite шёл по `IF NOT EXISTS`, а все HIGH были в Postgres-ветке, которую sqlite-тест не исполнял. «Зелёный тест, но не там».

## Solution — чек-лист ПЕРЕД прод-миграцией (конкретные действия, не принцип)
1. **Прочитать, КАК миграция реально запустится в проде:** `railway.json` / `Procfile` / CI — есть ли `alembic upgrade head` в `preDeployCommand`? Если да — миграция стартует АВТОМАТИЧЕСКИ и синхронно, держит деплой. «Гнать вручную» без отдельного гейта/ветки — неисполнимо, миграция уедет в авто-прогон.
2. **Прочитать `alembic/env.py`:** обёрнут ли прогон в `context.begin_transaction()`? какой драйвер (psycopg2 / asyncpg)? Вне-транзакционный DDL (`CREATE/DROP INDEX CONCURRENTLY`, `VACUUM`, в старых PG `ALTER TYPE ... ADD VALUE`) внутри транзакции — упадёт.
3. **CONCURRENTLY — только через** `with op.get_context().autocommit_block():`, НЕ через сырой `op.execute("COMMIT")` на psycopg2.
4. **Self-heal INVALID-индекса:** `DROP INDEX CONCURRENTLY IF EXISTS <name>` ПЕРЕД `CREATE`, а не только `if_not_exists` (он матчит по имени и «пропустит» невалидный, отрапортовав успех).
5. **Верифицировать на ЦЕЛЕВОЙ СУБД-ветке.** Если миграция ветвится по диалекту (`if dialect == 'sqlite'`), sqlite-тест НЕ покрывает Postgres-ветку. Прогнать на dev/staging-Postgres; если нельзя — ЯВНО держать «прод-ветка не покрыта» как РИСК, а не как галочку «протестировано».
6. **Малая таблица? Обычный `CREATE INDEX` в транзакции** проще и безопаснее CONCURRENTLY (атомарно, работает в авто-preDeploy, нет INVALID, нет окна гонки dedup↔index). CONCURRENTLY — только когда блокировка на build реально болезненна (большая таблица).
7. **Шаблон-`.example` ≠ проверенный.** Паттерн, который никогда не прогонялся в этом пайплайне, не выдавать за «правило проекта» — проверить самому против п.1–2.

## When to Use
- Пишешь/ревьюишь любую Alembic-миграцию для прод-Postgres.
- В миграции есть CONCURRENTLY / autocommit-DDL / online-index / data-backfill.
- Dev/тесты на SQLite, прод на Postgres (ветвление по диалекту).
- Красный флаг: `op.execute("COMMIT")` в миграции → сразу проверь `env.py`.

Родня: [[feedback-verify-runtime-not-green-tests]], [[feedback-instrument-dont-guess-native-bugs]].
