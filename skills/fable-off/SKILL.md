---
name: fable-off
description: Выключить Fable-режим для @architect (Fable недоступна, лимит близок или дорого) — architect будет вызываться без override, на Opus. Правит маркер в ~/.claude/CLAUDE.md.
allowed-tools: Read, Edit
model: haiku
---

Переброс architect: Fable → Opus (выключение Fable-режима).

Выполни:
1. В файле `~/.claude/CLAUDE.md` найди строку, начинающуюся с `**Fable-режим: ON**`, и замени её целиком на:
   `**Fable-режим: OFF** — `@architect` вызывать БЕЗ override модели (едет на Opus).`
   Если строка уже начинается с `**Fable-режим: OFF**` — сообщи, что фолбэк уже активен, и остановись.
2. Подтверди пользователю: «Fable-режим OFF: architect вызывается на Opus. Вернуть — /fable-on.»

Примечание: файл `agents/architect.md` НЕ трогать — там всегда `model: opus` (CLI не регистрирует Fable во frontmatter, Fable подаётся только параметром вызова).
