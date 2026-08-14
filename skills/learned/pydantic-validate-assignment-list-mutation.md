---
name: pydantic-validate-assignment-list-mutation
description: При validate_assignment=True мутация списка in-place (append) проходит мимо валидации и мимо побочных эффектов сеттера — нужен реассайн новым списком. Триггер: Pydantic v2 модель со списком, добавление элемента в поле-коллекцию, поле «одиночное значение → список».
metadata:
  type: reference
---

# Pydantic v2: `validate_assignment` не видит `append` в поле-списке

**Extracted:** 2026-08-01
**Context:** Pydantic v2, `model_config = ConfigDict(validate_assignment=True)`, поле-коллекция в доменной сущности.

## Проблема
`validate_assignment=True` валидирует **присваивание полю**, а не мутацию объекта, на который поле ссылается. Поэтому

```python
self.supersedes.append(DecisionLink(...))   # валидация НЕ запускается
```

проходит мимо всех проверок модели. В домене с версионированием это опаснее, чем кажется: рядом с валидацией обычно висит `touch()` (инкремент `version`, `updated_at`) — при `append` он тоже не сработает, и изменение уедет в БД без новой версии.

## Решение
Заменять список целиком:

```python
def add_prior(self, prior_id: UUID, kind: SupersedeKind, basis: str = "") -> None:
    self.assert_can_add_prior(prior_id)               # инвариант — до мутации
    self.supersedes = [*self.supersedes, DecisionLink(prior_id=prior_id, kind=kind, basis=basis)]
    self.touch()

def remove_prior(self, prior_id: UUID) -> None:
    if not any(l.prior_id == prior_id for l in self.supersedes):
        raise InvariantViolation(...)
    self.supersedes = [l for l in self.supersedes if l.prior_id != prior_id]
    self.touch()
```

Дополнительно: элемент коллекции объявить `model_config = ConfigDict(frozen=True)` — тогда `obj.items[0].field = x` тоже невозможно, и единственный путь изменения — через методы сущности.

## Смежное: `model_validator(mode="before")` не должен мутировать вход
Валидатор получает исходный словарь вызывающего. `data["x"] = ...` дописывает поле в чужую структуру — а если этим словарём окажется снимок истории (append-only аудит), в него втихую попадёт то, чего в снимке не было. Возвращать копию: `return {**data, "supersedes": [...]}`.

Ещё нюанс: `Model.model_validate(instance)` при `revalidate_instances='never'` (дефолт) возвращает **тот же объект** и валидатор не вызывает — тест «валидатор терпит не-dict» через инстанс ничего не проверяет, нужен `model_validate([1,2,3])` с `pytest.raises(ValidationError)`.

## When to Use
- Добавляешь/удаляешь элемент в поле-списке Pydantic-модели с `validate_assignment=True`.
- Рефакторинг «одиночное поле → список» в доменной сущности.
- Изменение не увеличивает `version` / не пишет ревизию, хотя метод вызван.
- Пишешь `model_validator(mode="before")` для миграции формата на чтении.
