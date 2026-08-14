---
name: rn-dynamic-import-expo-go-crash
description: "Динамический await import('react-native') заставляет Metro энумерировать весь namespace пакета, что трогает геттеры всех экспортов и крашит Expo Go на отсутствующем нативном модуле (PushNotificationIOS и подобные), даже если этот модуль в коде не используется. Лечится статическим именованным импортом или обёрткой-модулем, который импортируют динамически. Триггерить при 'Native module does not exist' на неиспользуемом модуле и при ревью любого await import пакета с нативными модулями."
---

# Динамический import("react-native") крашит Expo Go (грузит отсутствующие нативные модули)

**Extracted:** 2026-07-10
**Context:** React Native / Expo Go — краш «Native module doesn't exist» (например, PushNotificationIOS) при том, что этот модуль в коде явно не используется.

## Problem
Динамический импорт всего пакета:
```ts
const RN = await import("react-native");
RN.Platform.OS; // нужен был только Platform
```
заставляет Metro сгенерировать полную энумерацию namespace `react-native`. При выполнении энумерация трогает **все** геттеры экспортов, включая нативные модули, которых нет в рантайме Expo Go (PushNotificationIOS и др.) → мгновенный краш с «Native module doesn't exist», хотя сам модуль нигде явно не вызывался.

## Solution
Использовать статические именованные импорты нужных частей:
```ts
import { Platform } from "react-native";
```
Если динамика нужна по архитектуре (условная загрузка) — выносить обращение к react-native в отдельный модуль со статическими именованными импортами и динамически импортировать уже **свой** модуль:
```ts
// pushNative.ts
import { Platform } from "react-native"; // статика — tree-shaking по именам
export function isIos() { return Platform.OS === "ios"; }

// caller.ts
const { isIos } = await import("./pushNative"); // динамика на своём модуле — безопасна
```

## When to Use
- Краш «Native module doesn't exist» в Expo Go на модуле, который в коде не используется.
- Ревью кода: любой `await import("react-native")` (или другого пакета с нативными модулями, например `expo-*`) — красный флаг, заменить на статический именованный импорт или обёртку-модуль.
