---
name: idempotency-cache-excludes-unauth
description: Кэш-ответов/idempotency middleware нельзя вешать на неаутентифицированные token-выдающие эндпоинты (login) — общий Idempotency-Key вернёт чужой токен. Триггер при добавлении idempotency/response-cache middleware, review auth-эндпоинтов.
metadata:
  type: reference
---

# Idempotency/response-cache middleware не должен кэшировать неаутентифицированные (token-выдающие) эндпоинты

**Extracted:** 2026-07-26
**Context:** FastAPI/Starlette, in-memory idempotency middleware поверх `POST /v1/messages`-стиля мутаций; баг всплыл на стыке идемпотентности и `/auth/login`. Нашло слепое jury-ревью.

## Problem
Middleware идемпотентности кэшировал ответ мутации по ключу
`sha256(Authorization | method | path | Idempotency-Key)`, «привязывая» кэш к пользователю
через заголовок `Authorization`. Но `/auth/login` **неаутентифицирован** → `Authorization`
пуст у ВСЕХ вызывающих → cache_id схлопывается в `""|POST|/auth/login|<key>`, одинаковый для
всех. Ответ логина (200 c `access_token`, status<500) кэшируется без TTL. Итог: пользователь V
логинится с `Idempotency-Key: "X"` → его токен лежит под user-независимым ключом; атакующий
POST-ит `/auth/login` с тем же `Idempotency-Key: "X"` (любые креды) и получает **токен V**
(`Idempotent-Replay: true`) → **захват аккаунта**. User-scoping через `Authorization` —
**no-op для эндпоинтов, которые сами выдают аутентификацию.**

Юнит-тесты идемпотентности (только на аутентифицированных ручках) и тесты логина (без
Idempotency-Key) по отдельности этого НЕ ловят — баг живёт на стыке двух фич.

## Solution
Кэшировать только аутентифицированные запросы — если нет `Authorization`, идемпотентность не
применяется:

```python
@app.middleware("http")
async def _idempotency(request, call_next):
    key = request.headers.get("Idempotency-Key")
    auth = request.headers.get("Authorization", "")
    # Неаутентифицированные (login/register) НЕ кэшируем: общий ключ вернул бы чужой токен.
    if not key or not auth or request.method not in ("POST", "PUT", "PATCH"):
        return await call_next(request)
    cache_id = sha256(f"{auth}|{request.method}|{request.url.path}|{key}")
    ...
```

## When to Use
- Добавляешь idempotency-ключи / любой **per-user кэш ответов** как middleware.
- Ревьюишь middleware, который короткозамыкает ответ по ключу, включающему `Authorization`.
- Признак опасности: кэш-ключ полагается на заголовок аутентификации, а маршрут может быть
  **неаутентифицированным** (login, register, refresh, password-reset, OTP-verify) → user-scoping
  становится пустым и общим. Всегда исключай token-выдающие/анонимные эндпоинты из такого кэша.
