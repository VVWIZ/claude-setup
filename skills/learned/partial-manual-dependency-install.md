---
name: partial-manual-dependency-install
description: Ручная доустановка одной зависимости (pip install playwright) вместо полного requirements.txt → недоехавший pypdf уронил пайплайн на ПОСЛЕДНЕМ шаге после успешных предыдущих. Триггер: ModuleNotFoundError глубоко в рантайме после ручных pip install.
metadata:
  type: reference
---

# Частичная ручная установка зависимостей — падение на последнем шаге

**Extracted:** 2026-07-18
**Context:** Baby Tracker: дев-venv, включали PDF-рендер (Playwright+Chromium ставили руками).

## Проблема
`pip install playwright` поставлен вручную (казалось, только его и не хватает), а `pypdf` из того же requirements.txt — нет. Рендер отработал ВСЮ дорогу (Chromium, 10 разворотов) и упал на финальном шаге склейки: `ModuleNotFoundError: No module named 'pypdf'`. Симптом коварный: «фича почти работает», падение глубоко в рантайме, а не на старте.

## Решение
- Доустанавливать зависимости в venv ТОЛЬКО полным файлом: `pip install -r requirements.txt` (идемпотентно, уже стоящее пропустит).
- После — быстрый smoke критичных импортов: `python -c "import playwright, pypdf, PIL"` (по списку새 фичи).
- При диагностике «упало на позднем шаге пайплайна» — первым делом проверить ModuleNotFoundError в логе (ленивые импорты внутри функций проявляются только при достижении шага).

## When to Use
Любая ручная установка пакета в существующий venv/node_modules; «фича работает до шага N и падает»; ленивые импорты внутри функций.
