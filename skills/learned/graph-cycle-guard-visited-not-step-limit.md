---
name: graph-cycle-guard-visited-not-step-limit
description: Числовой лимит шагов как защита от зацикливания на ГРАФЕ даёт тихий false-negative (цикл пропущен, «всё ок»). Нужен visited-set. Триггер: обход связей стал ветвящимся — «одна ссылка → список ссылок», дерево → DAG.
metadata:
  type: reference
---

# Guard от циклов: visited-set, а не счётчик шагов

**Extracted:** 2026-08-01
**Context:** Рефакторинг «одна ссылка на предка → список ссылок»: линейная цепочка превращается в граф.

## Проблема
Для ЛИНЕЙНОЙ цепочки типичный guard — счётчик шагов:

```python
for _ in range(_MAX_DEPTH):          # 100 шагов и хватит
    if cur is None or cur in seen: break
    cur = node.parent_id
return False                          # цикла не нашли
```

При переходе на граф этот код переносят «как было», добавив обход веток. И тогда `лимит исчерпан → break → return False` означает **«цикла нет»**, хотя обход просто не успел. Это false-negative в защите целостности: цикл пролезает в данные, а функция отвечает «всё чисто». Симптом не проявится в тестах на маленьких графах — только на проде.

## Решение
Терминируемость на графе даёт конечность множества вершин, а не счётчик:

```python
def would_create_cycle(by_id, node_id, parent_id) -> bool:
    if node_id == parent_id:
        return True
    seen: set[UUID] = set()
    stack = [parent_id]
    while stack:
        cur = stack.pop()
        if cur == node_id:
            return True
        if cur in seen:
            continue
        seen.add(cur)
        node = by_id.get(cur)
        if node is not None:
            stack.extend(link.parent_id for link in node.parents)
    return False
```

`visited` завершает обход и на битых данных с уже существующим циклом. Если хочется дополнительной страховки — лимит `len(by_id) + 1` и **исключение** при превышении, но НИКОГДА не тихий `False`.

Итеративно (стек), не рекурсивно: цепочка в тысячи узлов кладёт рекурсию в `RecursionError`.

## When to Use
- Поле «ссылка на одного предка» становится списком ссылок.
- Дерево превращается в DAG / появляется fan-out или fan-in.
- В коде обхода видишь `range(MAX_DEPTH)`, `for i in range(...)` вокруг перехода по ссылкам.
- Ревью функции вида `would_create_cycle` / `has_loop` / `detect_cycle`.
