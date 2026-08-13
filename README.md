# Claude Setup — скиллы, правила и роутинг моделей для Claude Code

Полный рабочий сетап Claude Code: 47 скиллов, глобальные правила с автотриггерами, 3 субагента с роутингом моделей, хуки качества и статус-строка. Ставится одной командой.

## Быстрая установка

```bash
git clone https://github.com/VVWIZ/claude-setup.git
cd claude-setup
bash install.sh
```

Скрипт скопирует всё в `~/.claude/` (существующий `CLAUDE.md` и `agents/` предварительно бэкапятся). После установки — один ручной шаг: перенести фрагменты из `settings.example.json` в свой `~/.claude/settings.json` (модель, statusline, хуки, permissions) — см. вывод скрипта.

**Требования:** Claude Code CLI; Node.js (для хуков); на Windows — Git Bash (идёт с git). Хук `go-quality.js` активен только для Go-файлов и молча пропускает остальное.

## Что внутри

```
claude-setup/
├── CLAUDE.md              # Глобальные правила: язык, brainstorming-first, апрув правок,
│                          #   автотриггеры 36 скиллов, роутинг моделей (карта задача→модель)
├── MODEL-ROUTING.md       # Гайд: как устроен роутинг моделей и как повторить у себя
├── install.sh             # Установка в ~/.claude/ с бэкапом
├── settings.example.json  # Фрагменты для ~/.claude/settings.json (merge вручную)
├── agents/                # Субагенты (модель в frontmatter)
│   ├── architect.md       #   системная архитектура — Fable через override на вызове
│   ├── researcher.md      #   Sonnet — исследование кода/веба, read-only
│   └── mechanic.md        #   Haiku — механика: grep/переименования/форматирование
├── hooks/ecc/             # Хуки (Node.js): block-md, suggest-compact, go-quality,
│                          #   pr-url, evaluate-session (continuous learning)
├── commands/              # Слэш-команды: /eval, /learn, /update-codemaps
├── statusline/            # Статус-строка: модель сессии + Fable-режим + лимит 5h (jq-free)
└── skills/                # 47 скиллов + learned/
```

### Скиллы по категориям

| Категория | Скиллы |
|-----------|--------|
| Оркестрация | build, plan, spec-to-code, subagent-driven-development, dispatching-parallel-agents |
| Дисциплина (Superpowers) | systematic-debugging, test-driven-development, verification-before-completion, receiving-code-review, finishing-a-development-branch, using-git-worktrees |
| Исследование | brainstorming, research, deep-research, interview-me |
| Качество кода | review, class-sweep, api-contract-guardian, dependency-optimizer, error-handling-standardizer, performance-scanner, performance-optimization |
| База данных (Go/PostgreSQL) | postgres-patterns, database-reviewer, database-migrations |
| Документы | docs, report, task-status, tz, test, eval-harness |
| DevOps | cicd-quick-setup, audit-server, observability-and-instrumentation |
| Фронтенд | frontend-ui-engineering, browser-testing-with-devtools¹ |
| Обслуживание сетапа | skill-stocktake, context-budget, rules-distill, continuous-learning, strategic-compact |
| Инженерная культура | source-driven-development, doubt-driven-development, simplify-this, deprecation-and-migration |
| Роутинг моделей | fable-on, fable-off |
| learned/ | выученные паттерны сессий (пополняется через /learn) |

¹ требует настроенного chrome-devtools MCP.

## Роутинг моделей (кратко)

Дефолт главного цикла — **Opus**. Рутина уводится вниз, архитектура — вверх:

- `@architect` → **Fable** (только системная/межсервисная архитектура; подаётся override-параметром `model: fable` на вызове — см. важный нюанс ниже)
- `@researcher` → Sonnet, `@mechanic` → Haiku
- Worker-скиллы (docs, report, test, research и др.) запинены `model: sonnet` во frontmatter
- `/fable-off` / `/fable-on` — персистентный переключатель Fable-режима (маркер в CLAUDE.md)

Полная карта «тип задачи → модель» — в `CLAUDE.md`, механика — в `MODEL-ROUTING.md`.

## Важные нюансы (выучено на практике)

1. **Fable во frontmatter агентов может не регистрироваться** — поэтому `architect.md` держит `model: opus`, а Fable передаётся параметром вызова Agent-тула. Не «чините» это возвратом `model: fable` в файл.
2. **Двоеточие+пробел в неквотированном YAML-значении ломает файл агента целиком** (`description: ... Read-only: ...` → agent not found). Description с двоеточиями — только в кавычках.
3. **Реестр агентов обновляется на границе сообщений** — новый/исправленный агент появится после следующего сообщения пользователя, не мгновенно.

Подробности — `skills/learned/agent-not-registered-yaml-frontmatter.md`.

## Обновление сетапа

Правки делаются в этом репо → `bash install.sh` → commit+push. Локальные `~/.claude/` копии перезаписываются установкой (кроме `settings.json` — он не трогается никогда).

## Что сюда НЕ входит

- `settings.json` целиком (личные permissions и пути) — только `settings.example.json`
- Проектные `CLAUDE.md` и стек-специфичные скиллы проектов
- Кэши (`skill-stocktake/results.json`)
