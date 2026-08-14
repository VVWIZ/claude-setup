---
name: railway-custom-domain-txt-verification
description: Кастомный домен Railway требует ДВЕ DNS-записи — CNAME и TXT _railway-verify.<host>; без TXT сертификат бессрочно висит в VALIDATING_OWNERSHIP без единой ошибки. Триггерить при подключении custom domain на Railway и при диагностике «сертификат не выпускается».
metadata:
  type: reference
---

# Railway custom domain: TXT-запись подтверждения владения обязательна

**Extracted:** 2026-07-30
**Context:** Подключение `api.mamahelpbot.com` к сервису на Railway (проект babytracker), DNS — Cloudflare.

## Problem

После `railway domain <домен> --service <svc>` и создания CNAME сертификат застрял в
`CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` на 75+ минут:

- `certificateErrorMessage: null` — ошибок нет;
- `dnsRecords[].status: DNS_RECORD_STATUS_PROPAGATED` — Railway видит CNAME;
- `syncStatus: ACTIVE`, CAA-записей в зоне нет, DNS резолвится по всей цепочке.

Все проверяемые сигналы зелёные, а сертификата нет — выглядит как «медленная очередь», на деле валидация не начнётся никогда.

## Root cause

Railway требует **две** записи, а не одну:

1. CNAME `<host>` → `<xxxx>.up.railway.app` (маршрутизация трафика);
2. **TXT `_railway-verify.<host>` = `railway-verify=<токен>`** (подтверждение владения).

Поля `verificationToken` / `verificationDnsHost` / `verified` приходят в ответе
`customDomainCreate` **ниже** блока сертификата — и потерялись, потому что вывод CLI
был обрезан `| head -30`. Дальше статусные запросы про них не напоминают.

## Solution

1. Полный ответ о требованиях — GraphQL через CLI-прокси (токен не нужен):
   ```bash
   railway api 'query{customDomain(id:"<id>",projectId:"<pid>"){status{
     certificateStatus verificationToken verificationDnsHost verified
     dnsRecords{requiredValue currentValue status}}}'
   ```
2. Создать **обе** записи в DNS (TXT — с host `_railway-verify.<host>`, значение целиком `railway-verify=...`).
3. После добавления TXT сертификат выпускается за ~2 минуты.
4. Зависшую привязку можно пересоздать (`customDomainDelete` мутацией + `railway domain ...`),
   но **CNAME-цель при пересоздании меняется** (`o9nbpmi6...` → `miiye9ml...`) — обновить
   DNS-запись и все доки, где цель упомянута.

## When to Use

- Подключение custom domain к любому сервису Railway.
- Диагностика «TLS не выпускается, ошибок нет»: первым делом сверить `verified` и `verificationDnsHost`.
- Мета-правило: читая у CLI **требования** (а не логи), не резать вывод `head`-ом — обрезка спрятала обязательное поле и стоила часа ожидания.
