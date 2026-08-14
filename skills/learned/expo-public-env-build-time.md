---
name: expo-public-env-build-time
description: EXPO_PUBLIC_* впекаются в JS-бандл при старте Metro. Смена .env требует рестарта Metro (--clear), не просто reload приложения. Триггер «сменил API-URL/EXPO_PUBLIC_* в .env, а приложение видит старое значение».
metadata:
  type: reference
---

# EXPO_PUBLIC_* впекаются на сборке — смена .env требует рестарта Metro

**Extracted:** 2026-07-12
**Context:** Expo / React Native, конфиг через `process.env.EXPO_PUBLIC_*` (напр. `API_BASE_URL` в config.ts).

## Проблема
`process.env.EXPO_PUBLIC_API_BASE_URL` инлайнится Babel-трансформом в бандл в момент СТАРТА Metro. После правки `.env` работающий Metro продолжает отдавать старое значение — reload приложения не помогает, потому что бандл уже собран со старым адресом.

## Решение
После изменения `.env` — перезапустить Metro (в идеале `npx expo start --clear`), затем reload приложения. Проверять по факту: `curl "http://localhost:8081/index.bundle?platform=ios"` и `grep` нужного адреса в бандле.

## When to Use
Сменил API-URL / любой `EXPO_PUBLIC_*` в `.env`, а приложение видит старое значение. Диагностика «конфиг не применяется». Родня [[metro-ci1-stale-bundle]].
