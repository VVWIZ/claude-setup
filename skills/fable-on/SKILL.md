---
name: fable-on
description: Включить Fable-режим для @architect (после /fable-off) — architect будет вызываться с model: fable на вызове. Правит маркер в ~/.claude/CLAUDE.md.
allowed-tools: Read, Edit
model: haiku
---

Возврат architect: Opus → Fable (включение Fable-режима).

Выполни:
0. Определи абсолютный путь к глобальному CLAUDE.md: домашняя директория пользователя + `/.claude/CLAUDE.md` (Edit-тул требует абсолютный путь — раскрой `~` сам; домашняя директория видна из контекста окружения/рабочей директории).
1. В этом файле найди строку, начинающуюся с `**Fable-режим: OFF**`, и замени её целиком на:
   `**Fable-режим: ON** — `@architect` вызывать с `model: fable` в параметрах Agent-тула.`
   Если строка уже начинается с `**Fable-режим: ON**` — сообщи, что Fable уже активна, и остановись.
2. Подтверди пользователю: «Fable-режим ON: architect вызывается на Fable.»

Примечание: файл `agents/architect.md` НЕ трогать — там всегда `model: opus` (CLI не регистрирует Fable во frontmatter, Fable подаётся только параметром вызова).
