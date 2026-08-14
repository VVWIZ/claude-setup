---
name: for-mam-paired-time-edit-order
description: for_mam_App — при правке парного времени события (start/end) слать правки в порядке по направлению сдвига окна, иначе 400. Триггер: редактирование времени сна/прогулки/кормления, editEventTime, set_event_time, TimeOrderError.
metadata:
  type: reference
---

# for_mam_App: порядок правки парного времени start/end

**Extracted:** 2026-07-24
**Context:** Редактирование завершённого события с двумя временными границами (сон, прогулка, кормление) в for_mam_App — mobile-клиент ↔ backend.

## Problem
Бэкенд `app/services/events.py::set_event_time` меняет **по одному полю за запрос** и валидирует новое значение против **СТАРОГО** соседнего:
- `field="start"`: `if event.ended_at is not None and new_dt >= event.ended_at: raise TimeOrderError("Начало должно быть раньше конца")`
- `field="end"`: `if new_dt <= event.started_at: raise TimeOrderError`

Если клиент всегда шлёт правку `start` первой, то при сдвиге окна **вперёд** (напр. сон 10:00–11:00 → 12:00–13:00) первый запрос `start=12:00` упирается в `12:00 >= старый end 11:00` → 400, хотя финальное состояние (12:00–13:00) полностью валидно. Клиентская валидация (endT > startT по новым значениям) проходит и не ловит это — расхождение именно из-за проверки против старого соседнего поля на бэкенде.

## Solution
Клиент должен упорядочить две правки по направлению сдвига окна:
- Сдвиг **вперёд** (новый `start` ≥ старый `end`) → сначала `end`, потом `start`.
- Иначе (сдвиг назад / сужение) → сначала `start`, потом `end`.

Тогда ни один промежуточный запрос не создаёт временно-невалидную пару относительно старого соседнего значения.

## Example
```ts
// mobile/src/components/EventList.tsx :: save()
const startEdit = startT && startT !== isoToLocalInput(event.started_at) ? (localInputToIso(startT) as string) : null;
const endEdit   = hasEnd && event.ended_at && endT && endT !== isoToLocalInput(event.ended_at) ? (localInputToIso(endT) as string) : null;
const doStart = async () => { if (startEdit) await api.editEventTime(id, "start", startEdit); };
const doEnd   = async () => { if (endEdit)   await api.editEventTime(id, "end",   endEdit); };
// Сдвиг окна вперёд → сначала конец, иначе первый запрос упрётся в «начало позже конца».
const shiftLater = !!(startEdit && event.ended_at && new Date(startEdit).getTime() >= new Date(event.ended_at).getTime());
if (shiftLater) { await doEnd(); await doStart(); } else { await doStart(); await doEnd(); }
```

## When to Use
- Правишь редактирование времени событий с парой границ в for_mam_App / Baby Tracker (сон, прогулка, кормление).
- Видишь `set_event_time`, `editEventTime`, `TimeOrderError`, «Начало должно быть раньше конца».
- Симптом: правка завершённого события на более позднее время падает 400, хотя итог валиден.
- Более надёжная альтернатива на будущее: атомарный эндпоинт, принимающий пару (start, end) и валидирующий их вместе (текущий фикс — только порядок вызовов, промежуточная неатомарность сохраняется).
