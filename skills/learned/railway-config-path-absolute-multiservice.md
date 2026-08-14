---
name: railway-config-path-absolute-multiservice
description: Railway мультисервисный деплой из одной репы — Config Path задаётся абсолютно от корня репо (/backend/railway.json), НЕ относительно Root Directory; иначе доп. сервисы молча поднимаются копиями первого. Триггерить при настройке 2+ сервисов из одного репозитория/образа в Railway.
metadata:
  type: reference
---

# Railway: Config Path не следует за Root Directory (мультисервис из одной репы)

**Extracted:** 2026-07-25
**Context:** Деплой нескольких сервисов из одного репозитория/Docker-образа в Railway (api + worker + reminders, у каждого свой `railway*.json`).

## Problem
При деплое нескольких сервисов из одной репы путь к config-as-code файлу (`railway.json`/`railway.toml`) Railway резолвит **абсолютно от корня репозитория**, а **НЕ** относительно выставленного Root Directory.

Официальная дока Railway:
> "The Railway Config File does not follow the Root Directory path. You have to specify the absolute path for the railway.json or railway.toml file, for example: `/backend/railway.toml`."

**Симптом, если не задать Config Path явно:** для дополнительных сервисов Railway берёт дефолтный `railway.json` (а не `railway.worker.json` / `railway.reminders.json`). В итоге worker и reminders **молча поднимаются как вторые копии API** — сервисы «зелёные», но нерабочие (рендер / напоминания не выполняются), а у сервиса без своего конфига не отрабатывает `preDeployCommand` (например, миграция БД). Незаметно, пока не начнёшь искать, почему фоновая работа не идёт.

## Solution
Для **КАЖДОГО** сервиса (включая тот, что использует дефолтный `railway.json`) явно выставить Config Path как **абсолютный от корня репо**:

- `api` → `/backend/railway.json`
- `worker` → `/backend/railway.worker.json`
- `reminders` → `/backend/railway.reminders.json`

Не полагаться на автоопределение ни для одного сервиса. После первого деплоя каждого — **свериться в build/deploy-логах**, что применён нужный `startCommand`/`preDeployCommand` и найден нужный `Dockerfile`.

Дополнительно: резолюция `build.dockerfilePath` при связке Root Directory + кастомный Config Path в доке Railway **не описана явно** — проверять по build-логам первого деплоя (нашёлся ли `backend/Dockerfile`, а не несуществующий в корне).

## Example
```
# 3 сервиса из одной репы, один образ. В Railway Dashboard → каждый сервис → Settings:
api        Config Path = /backend/railway.json          (preDeployCommand: alembic upgrade head)
worker     Config Path = /backend/railway.worker.json   (startCommand: python -m app.render.worker)
reminders  Config Path = /backend/railway.reminders.json(startCommand: python -m app.worker)

# ⚠️ Даже для api — задать ЯВНО, не рассчитывать что подхватится «сам» из Root Directory.
# Проверка в логах деплоя: применился ли ожидаемый startCommand/preDeployCommand.
```

## When to Use
- Настройка **2+ сервисов из одного репозитория/образа** в Railway (монорепа, split на api/worker/cron).
- Симптом: воркер/крон в Railway «зелёный», но задачи не выполняются; или `preDeployCommand`/миграция не отрабатывает.
- Любой мультисервисный Railway-деплой с несколькими `railway*.json` в подкаталоге.
