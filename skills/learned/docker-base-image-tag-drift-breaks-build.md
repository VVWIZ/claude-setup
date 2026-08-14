---
name: docker-base-image-tag-drift-breaks-build
description: Плавающий тег базового образа (python:3.12-slim и т.п.) молча уезжает на новый мажор дистрибутива и ломает шаги, завязанные на списки системных пакетов — типовой симптом «apt exit 100 / has no installation candidate» при playwright install --with-deps. Триггерить, когда сборка образа падает на apt/системных зависимостях, а код и Dockerfile не менялись.
metadata:
  type: reference
---

# Дрейф тега базового образа ломает сборку (apt-пакеты «исчезли»)

**Extracted:** 2026-07-26
**Context:** Первый деплой FastAPI-сервиса на Railway. Код зелёный (347 pytest / 165 jest), Dockerfile не трогали месяцами — сборка падает на шаге Playwright.

## Problem

`FROM python:3.12-slim` — тег **плавающий**: он переезжает на новую основу дистрибутива (bookworm/Debian 12 → trixie/Debian 13) без единого изменения в репозитории. Сборка, которая работала вчера, ломается сегодня на ровном месте.

Больнее всего бьёт по шагам, которые ставят системные пакеты по **захардкоженному списку**. Playwright знает список только для поддерживаемых ОС; на незнакомой откатывается на ubuntu20.04 и пытается ставить пакеты, которых в новом Debian уже нет:

```
BEWARE: your OS is not officially supported by Playwright;
        installing dependencies for ubuntu20.04-x64 as a fallback.
E: Package 'ttf-unifont' has no installation candidate
   However the following packages replace it: fonts-unifont
E: Package 'ttf-ubuntu-font-family' has no installation candidate
Failed to install browsers → Installation process exited with code: 100
```

**Почему не ловится локально** (главная ловушка): тесты гоняются в venv и образа не касаются вовсе, а вспомогательные докер-прогоны (например «проверить миграции на настоящем Postgres») берут чистый базовый образ и до тяжёлого шага просто **не доходят**. То есть весь локальный зелёный свет к сборке образа отношения не имеет.

## Solution

**Пинить базовый образ до кодового имени дистрибутива** и оставлять рядом причину — иначе следующий разработчик «почистит» пин как лишний:

```dockerfile
# Пин на bookworm (Debian 12) — намеренно, НЕ обновлять вслепую: тег
# python:3.12-slim уехал на trixie (Debian 13), где `playwright install
# --with-deps` откатывается на список пакетов ubuntu20.04 и падает на
# несуществующих ttf-unifont / ttf-ubuntu-font-family → apt exit 100.
# Снимать пин только вместе с апгрейдом playwright под новый Debian.
FROM python:3.12-slim-bookworm
```

**Отвергнутые альтернативы** (и почему):
- *Обновить инструмент до версии, знающей новый дистрибутив* — тянет за собой смену движка (у Playwright это рендеринг), а он часто покрыт только визуальной проверкой. Не то, что чинят под деплой.
- *Ставить системные зависимости руками вместо `--with-deps`* — свой список из ~30 библиотек на вечное сопровождение; та же поломка вернётся при следующем дрейфе, только тише и позже.

## Example

Диагностика по логу сборки — искать две приметы:
1. `your OS is not officially supported` / `as a fallback` — инструмент не узнал дистрибутив;
2. `has no installation candidate` + `packages replace it: <новое имя>` — пакет переименован в новом релизе.

Обе вместе = дрейф базового образа, а не проблема кода.

## When to Use

- Сборка образа падает на `apt-get` / установке системных зависимостей, **при том что Dockerfile и код не менялись**.
- Любой `Dockerfile` с плавающим тегом (`:slim`, `:latest`, `:3.12`) + шаг, ставящий системные пакеты (playwright, puppeteer, wkhtmltopdf, шрифты, ODBC-драйверы).
- Общий вывод: **первый деплой прогонять как отладку**, специально до заведения всех секретов — платформенные ошибки всплывут отдельно от прикладных. Родственно [[build-pipeline-wiring-smoke-gap]] и [[prod-migration-verify-against-deploy-pipeline]]: зелёные тесты не проверяют то, что исполняется только в облаке.
