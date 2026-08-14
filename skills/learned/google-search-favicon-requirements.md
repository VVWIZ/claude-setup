---
name: google-search-favicon-requirements
description: В выдаче Google у сайта нет иконки (серый глобус) — потому что favicon задан через data:-URI. Google берёт favicon только как отдельный файл по URL. Триггер: настраиваю favicon, или в поиске у сайта нет иконки.
metadata:
  type: reference
---

# Favicon для выдачи Google: только файл по URL, не data:-URI

**Extracted:** 2026-07-18
**Context:** Лендинг проиндексировался в Google, но в результатах поиска вместо иконки — серый глобус.

## Problem

Удобный трюк «favicon без внешнего файла» — эмодзи в `data:`-URI:

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='...'><text y='.9em' font-size='90'>🍼</text></svg>">
```

**Во вкладке браузера работает отлично** — и создаёт ложное ощущение, что favicon настроен. Но **Google в результатах поиска его не показывает**: краулеру нужно скачать иконку по отдельному URL, `data:`-URI он для этого не использует. То же касается favicon, заданного только инлайном.

## Solution

Отдать иконку настоящими файлами и сослаться на них:

```html
<link rel="icon" type="image/png" sizes="96x96"  href="/icon-96.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
<link rel="apple-touch-icon" href="/icon-512.png">
```

Требования Google: иконка **квадратная**, размер кратен 48px (48/96/144/512), **на том же хосте**, что и страница, **не закрыта в robots.txt**, ссылка `<link rel="icon">` в `<head>` главной.

Сгенерировать PNG без графредактора можно headless-браузером (см. [[reliable-headless-screenshots]]):
```
chrome --headless=new --window-size=512,512 --default-background-color=00000000 \
       --screenshot=icon-512.png file:///.../favicon-src.html
```
(`--default-background-color=00000000` даёт прозрачные углы у скруглённой иконки.)

## When to Use

- Настраиваю favicon сайту, который должен хорошо выглядеть в выдаче.
- Жалоба «в Google у нас нет иконки» → первым делом проверить, не `data:`-URI ли это.
- **Важно:** иконка появится в выдаче только после переобхода страницы (Search Console → Проверка URL → Запросить индексирование), а не сразу после деплоя.
