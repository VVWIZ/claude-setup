---
name: background-tasks-survive-session-restart
description: Фоновые процессы (uvicorn/Metro/туннели), запущенные через run_in_background, переживают перезапуск сессии Claude Code — задачи помечаются stopped, но OS-процессы живы и держат порты. Триггер: «порт занят» (Errno 10048/EADDRINUSE) при старте сервера после обрыва/перезапуска сессии.
metadata:
  type: reference
---

# Фоновые процессы переживают перезапуск сессии → зомби на портах

**Extracted:** 2026-07-16
**Context:** Claude Code на Windows; дев-серверы (uvicorn, Metro, cloudflared/ngrok) запускались через run_in_background, затем сессия оборвалась/перезапустилась.

## Проблема
После перезапуска процесса Claude Code фоновые задачи приходят с пометкой «stopped / no completion record», но сами OS-процессы (python/node/cloudflared) ПРОДОЛЖАЮТ работать и держат порты. Повторный запуск сервера падает: `[WinError 10048] only one usage of each socket address` (или сервер «работает», но это старый процесс со старым кодом/env).

## Решение
Перед перезапуском дев-серверов после обрыва сессии — зачистить порты:
```powershell
foreach ($p in 8090, 8081) {
  (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess |
    Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
```

## Коварный вариант
Порт отвечает → кажется «всё работает», но это зомби со СТАРЫМ кодом/старыми env-переменными (изменения «не применяются»). При любых сомнениях — проверить PID/CommandLine процесса на порту (`Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"`).

## When to Use
«Порт занят» после перезапуска сессии; изменения кода/env «не применяются» на работающем дев-сервере; уведомления «task stopped, no completion record». Родня: [[metro-ci1-stale-bundle]], [[expo-public-env-build-time]].
