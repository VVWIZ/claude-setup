---
description: Eval-driven development — define/check/report/list эвалов фичи
---

# Eval Command

Manage eval-driven development workflow.

## Usage

`/eval [define|check|report|list] [feature-name]`

## Define Evals

`/eval define feature-name`

Create a new eval definition:

1. Create `.claude/evals/feature-name.md` with template:

```markdown
## EVAL: feature-name
Created: $(date)

### Capability Evals
- [ ] [Description of capability 1]
- [ ] [Description of capability 2]

### Regression Evals
- [ ] [Existing behavior 1 still works]
- [ ] [Existing behavior 2 still works]

### Success Criteria
- pass@3 > 90% for capability evals
- pass^3 = 100% for regression evals
```

2. Prompt user to fill in specific criteria

## Check Evals

`/eval check feature-name`

Run evals for a feature:

1. Read eval definition from `.claude/evals/feature-name.md`
2. For each capability eval:
   - Attempt to verify criterion
   - Record PASS/FAIL
   - Log attempt in `.claude/evals/feature-name.log`
3. For each regression eval:
   - Run relevant tests
   - Compare against baseline
   - Record PASS/FAIL
4. Report current status:

```
EVAL CHECK: feature-name
========================
Capability: X/Y passing
Regression: X/Y passing
Status: IN PROGRESS / READY
```

## Report Evals

`/eval report feature-name`

Generate comprehensive eval report:

```
EVAL REPORT: feature-name
=========================
Generated: $(date)

CAPABILITY EVALS
----------------
[eval-1]: PASS (pass@1)
[eval-2]: PASS (pass@2) - required retry
[eval-3]: FAIL - see notes

REGRESSION EVALS
----------------
[test-1]: PASS
[test-2]: PASS
[test-3]: PASS

METRICS
-------
Capability pass@1: 67%
Capability pass@3: 100%
Regression pass^3: 100%

NOTES
-----
[Any issues, edge cases, or observations]

RECOMMENDATION
--------------
[SHIP / NEEDS WORK / BLOCKED]
```

## List Evals

`/eval list`

Show all eval definitions:

```
EVAL DEFINITIONS
================
feature-auth      [3/5 passing] IN PROGRESS
feature-search    [5/5 passing] READY
feature-export    [0/4 passing] NOT STARTED
```

## Пример: добавление аутентификации

```markdown
## EVAL: add-authentication

### Фаза 1: Define (10 мин)
Capability:
- [ ] Регистрация по email/паролю
- [ ] Логин с валидными данными
- [ ] Невалидные данные отклоняются с внятной ошибкой
- [ ] Сессия переживает перезагрузку страницы
- [ ] Логаут чистит сессию

Regression:
- [ ] Публичные роуты доступны
- [ ] Ответы API не изменились
- [ ] Схема БД совместима

### Фаза 2: Implement
[код]

### Фаза 3: Evaluate — /eval check add-authentication

### Фаза 4: Report
Capability: 5/5 (pass@3: 100%) · Regression: 3/3 (pass^3: 100%) · Status: SHIP IT
```

## Grader Types

Каждый критерий закрывается одним из трёх грейдеров. Выбирай самый детерминированный из применимых.

**1. Code-based** — проверка кодом, детерминированно:
```bash
grep -q "export function handleAuth" src/auth.ts && echo "PASS" || echo "FAIL"
npm test -- --testPathPattern="auth" && echo "PASS" || echo "FAIL"
npm run build && echo "PASS" || echo "FAIL"
```

**2. Model-based** — для открытых формулировок, где кодом не проверить:
```markdown
[MODEL GRADER PROMPT]
Оцени изменение:
1. Решает ли оно заявленную проблему?
2. Структура вменяемая?
3. Пограничные случаи закрыты?
4. Обработка ошибок адекватна?

Score: 1-5 (1=плохо, 5=отлично)
Reasoning: [обоснование]
```

**3. Human** — вручную, для security и необратимого:
```markdown
[HUMAN REVIEW REQUIRED]
Change: что изменилось
Reason: почему нужен человек
Risk Level: LOW/MEDIUM/HIGH
```

## Метрики

**pass@k** — «хотя бы один успех из k попыток». `pass@1` — доля успеха с первого раза, `pass@3` — успех в пределах трёх попыток. Типовая цель: `pass@3 > 90%`.

**pass^k** — «все k прогонов успешны». Планка выше, применяется к критичным путям и регрессиям: `pass^3` = три успеха подряд.

Разница существенна: `pass@3` терпит нестабильность, `pass^3` её запрещает. Для capability-эвалов бери `pass@k`, для регрессионных — `pass^k`.

## Best Practices

1. **Определять эвалы ДО кода** — заставляет сформулировать критерий успеха
2. **Гонять часто** — регрессии ловятся ранними
3. **Следить за pass@k во времени** — тренд надёжности важнее одной точки
4. **Code-грейдер везде, где возможен** — детерминированное лучше вероятностного
5. **Security — только через человека**, полная автоматизация недопустима
6. **Эвалы должны быть быстрыми** — медленные не запускают
7. **Версионировать вместе с кодом** — эвалы такой же артефакт

## Arguments

$ARGUMENTS:
- `define <name>` - Create new eval definition
- `check <name>` - Run and check evals
- `report <name>` - Generate full report
- `list` - Show all evals
- `clean` - Remove old eval logs (keeps last 10 runs)
