---
name: reliable-headless-screenshots
description: Скриншоты страниц для визуальной проверки — headless Chrome --window-size НЕ задаёт CSS-viewport (мобильные скрины врут), а fullPage выходит пустым при scroll-reveal анимациях. Триггер: снимаю страницу headless-браузером, особенно мобильную вёрстку.
metadata:
  type: reference
---

# Надёжные скриншоты страниц в headless-браузере

**Extracted:** 2026-07-12
**Context:** Визуальная проверка вёрстки лендинга (мобайл/десктоп) перед деплоем.

## Problem 1 — `--window-size` не задаёт мобильный viewport

```
chrome --headless=new --window-size=390,844 --screenshot=out.png <url>
```
НЕ включает мобильную эмуляцию. Страница рендерится в десктопной ширине, а скриншот — просто **обрезка левых 390px**.

**Симптом:** текст «обрезан» справа, раскладка десктопная (не центрированная), media-queries не применились. Легко принять за реальный баг переполнения — а его нет.

## Solution 1 — Puppeteer с настоящей эмуляцией

`puppeteer-core` + уже установленный Chrome (без скачивания браузера ~150МБ):

```js
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new', args: ['--no-sandbox', '--hide-scrollbars']
});
await page.setViewport({ width:390, height:844, deviceScaleFactor:2, isMobile:true, hasTouch:true });
```

Заодно проверять переполнение прямо в странице (объективно, а не на глаз):

```js
const o = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth
}));
// scrollW > clientW → реальный горизонтальный оверфлоу
```

Форсить язык/состояние до загрузки:
```js
await page.evaluateOnNewDocument(l => { try{ localStorage.setItem('lang', l); }catch(e){} }, 'ru');
```

## Problem 2 — fullPage-скриншот пустой при scroll-reveal

Если на странице `.reveal{opacity:0}` + `IntersectionObserver` добавляет `.in` при скролле, то при `screenshot({fullPage:true})` обсервер для секций ниже вьюпорта **не срабатывает** → секции занимают высоту, но невидимы. Итог: гигантский скрин с пустотой (высота верная, контента нет).

## Solution 2 — форсить видимость перед съёмкой

```js
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
```
Либо снимать конкретную секцию элементом (обычно полезнее длинного fullPage):
```js
const el = await page.$('#how');
await el.screenshot({ path: 'how.png' });
```

## When to Use

- Нужен скриншот страницы для проверки вёрстки, особенно мобильной.
- Скрин показал «обрезанный» текст → **сначала проверь, что viewport реально мобильный**, прежде чем чинить CSS.
- fullPage вышел пустым/огромным → ищи scroll-reveal анимации.
- Проверка кликов/событий аналитики: подменить `window.fbq`/`window.ym` на шпион, повесить capture-listener с `preventDefault()`, программно кликнуть — событие ловится, навигация не происходит.
