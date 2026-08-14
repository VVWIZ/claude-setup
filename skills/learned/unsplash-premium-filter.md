---
name: unsplash-premium-filter
description: Unsplash napi-поиск подмешивает платные Unsplash+/Getty кадры — перед использованием фото на коммерческом сайте фильтровать результаты по флагу premium/plus. Триггер — подбор стоковых фото с Unsplash без API-ключа.
metadata:
  type: reference
---

# Фильтр платных кадров в Unsplash napi-поиске

**Extracted:** 2026-08-03
**Context:** Подбор бесплатных стоковых фото для коммерческого лендинга через недокументированный поисковый эндпоинт Unsplash (без API-ключа).

## Problem

Эндпоинт `https://unsplash.com/napi/search/photos?query=...&per_page=N` отдаёт вперемешку бесплатные фото (Unsplash License) и платные Unsplash+ (часто автор «Getty Images»). Визуально в JSON они неотличимы, URL скачиваются одинаково — но использование Unsplash+ кадров без подписки нарушает лицензию. На лендинге СпецТехЛизинг так чуть не уехали в прод два платных кадра (герой и карточка услуги).

## Solution

У каждого результата есть флаги `premium` и `plus`. Использовать только кадры, где оба falsy. Автор «Getty Images» — почти всегда признак платного кадра, но проверять надо по флагу, а не по имени.

## Example

```python
import json
d = json.load(open('search.json', encoding='utf-8'))
free = [r for r in d['results'] if not r.get('premium') and not r.get('plus')]
for r in free:
    print(r['id'], r['urls']['raw'], r['user']['name'])
# скачивание: f"{r['urls']['raw']}&w=900&q=75&fm=jpg&fit=crop"
```

## When to Use

- Любой подбор фото с Unsplash через napi/скрейпинг (без официального API-ключа)
- Ревью чужих проектов: если стоковые фото «с Unsplash», а в титрах Getty — проверить лицензию
