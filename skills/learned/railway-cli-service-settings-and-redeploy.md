---
name: railway-cli-service-settings-and-redeploy
description: Railway полностью настраивается из CLI без браузера, но три вещи ломают автоматизацию — rootDirectory/railwayConfigFile ставятся только через GraphQL (railway api), railway redeploy повторяет СТАРЫЙ снапшот конфига, а railway status --json этих полей не показывает вовсе. Триггерить при настройке/деплое Railway из агента или скрипта, особенно когда правки настроек сервиса «не применяются».
metadata:
  type: reference
---

# Railway из CLI: настройки сервиса, проверка и правильный передеплой

**Extracted:** 2026-07-26
**Context:** Агент настраивал Railway-проект целиком из CLI (браузера нет): проект + Postgres + 3 сервиса из одной репы, Config Path, переменные, деплой.

## Problem

Railway CLI закрывает почти весь путь (`init` / `add` / `domain` / `variable` / `logs` / `deployment list`), но на трёх местах автоматизация тихо сходит с рельсов — каждая стоит итерации деплоя.

**1. Настроек сервиса в CLI нет.** `rootDirectory`, `railwayConfigFile` (Config Path), `watchPatterns` не выставляются ни одной подкомандой. Без них мультисервисный деплой из монорепы не собрать (см. [[railway-config-path-absolute-multiservice]]).

**2. `railway redeploy` НЕ подхватывает изменённые настройки.** Он повторяет снапшот прошлого деплоя: в `meta` уедет старый `rootDirectory: null` и `builder: RAILPACK`, даже если минуту назад выставлен `backend` + `DOCKERFILE`. Выглядит как «настройки не сохранились», хотя они сохранены.

**3. `railway status --json` этих полей не показывает вообще** — их нет в его выборке, поэтому они пустые ВСЕГДА, независимо от реального состояния. Проверять ими = проверять ничего.

## Solution

**Авторизация для GraphQL — через сам CLI.** Есть подкоманда `railway api` (прокси к публичному GraphQL с авторизацией CLI) — отдельный Account Token заводить и просить у пользователя НЕ нужно.

⚠️ OAuth-`accessToken` из `~/.railway/config.json` публичный GraphQL напрямую **не принимает** (`Not Authorized` на всех вариантах: `Bearer`, raw, `Project-Access-Token`) — не тратить на это время, сразу `railway api`. Поля `user.token` там давно нет, только `accessToken`/`refreshToken`.

**Настройки сервиса — мутацией:**
```bash
railway api 'mutation($e:String!,$s:String!,$i:ServiceInstanceUpdateInput!){serviceInstanceUpdate(environmentId:$e,serviceId:$s,input:$i)}' \
  --variables @vars.json
# vars.json: { "e": "<envId>", "s": "<serviceId>",
#   "i": { "rootDirectory": "backend",
#          "railwayConfigFile": "/backend/railway.json",
#          "watchPatterns": ["backend/**"] } }
```
Схему разведывать через `railway api search <term>` и `railway api describe <Type>` — быстрее, чем гадать по докам.

**Свежий деплой (а не повтор снапшота):**
```bash
railway api 'mutation($e:String!,$s:String!,$c:String){serviceInstanceDeployV2(environmentId:$e,serviceId:$s,commitSha:$c)}' \
  --raw-var e=<envId> --raw-var s=<serviceId> --raw-var c=$(git rev-parse HEAD)
```
Ещё проще — **`git push`**: GitHub-триггер поднимает все сервисы разом и всегда с актуальными настройками.

**Проверка — обратным запросом, а не `status`:**
```bash
railway api 'query($e:String!){environment(id:$e){serviceInstances{edges{node{
  serviceName rootDirectory railwayConfigFile watchPatterns}}}}}' --raw-var e=<envId>
```

## Example

```bash
# полный путь без браузера
railway init --name babytracker --workspace <workspaceId> --json
railway add --database postgres --json
railway add --service api --repo OWNER/REPO --branch master --json
# → serviceInstanceUpdate: rootDirectory + railwayConfigFile + watchPatterns
# → обратный запрос: убедиться, что применилось
railway domain --service api --json
railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service api --skip-deploys
echo "$SECRET" | railway variable set OTP_PEPPER --stdin --service api --skip-deploys
git push                      # ← деплой всех сервисов с актуальным конфигом
railway logs --build <deploymentId> --service api --lines 60     # сборка
railway logs --deployment <deploymentId> --service api --lines 40 # рантайм
```

Мелочи, экономящие время:
- Бинарь может быть **не в PATH**, а в npx-кэше (`~/AppData/Local/npm-cache/_npx/<hash>/node_modules/@railway/cli/bin/railway.exe`) — «CLI не установлен» бывает ложным выводом. Проверять `Get-ChildItem -Recurse -Filter railway.exe`, а не только `Get-Command`.
- `--skip-deploys` на каждом `variable set`, иначе каждая переменная триггерит отдельный деплой.
- Секреты — только `--stdin`; `variable list --json` и `--kv` печатают **сырые значения**.
- `watchPatterns` (напр. `["backend/**"]`) избавляет от пересборок бэкенда на коммитах в мобилку/доки.

## When to Use

- Настройка или деплой Railway **из агента/скрипта**, без доступа к дашборду.
- Симптом «выставил Root Directory / Config Path, а деплой их игнорирует» → почти наверняка использован `redeploy` вместо свежего деплоя.
- Симптом «проверяю `status --json`, поля пустые» → поля просто не запрошены, нужен обратный GraphQL-запрос.
- Нужен Railway GraphQL, но не хочется просить у пользователя Account Token → `railway api`.
