# Service Lists v1.0.0 — публикация на GitHub Pages

## 1. Создать публичный репозиторий

Рекомендуемое имя:

`Service-Lists`

Владелец:

`DKHNV`

## 2. Загрузить содержимое проекта в ветку main

Корень репозитория должен содержать:

```text
.github/workflows/pages.yml
site/
tests/
README.md
DEPLOY.md
```

## 3. Включить GitHub Pages

В репозитории открыть:

`Settings → Pages`

В `Build and deployment` выбрать:

`Source: GitHub Actions`

## 4. Запустить deployment

Workflow `Deploy Service Lists` запускается автоматически после push в `main`.

Также его можно запустить вручную:

`Actions → Deploy Service Lists → Run workflow`

## 5. Ожидаемый адрес

Для репозитория `DKHNV/Service-Lists`:

`https://dkhnv.github.io/Service-Lists/`

## 6. Проверка

На главной должны появиться 7 сервисов:

- YouTube
- Telegram
- Meta
- ChatGPT
- Discord
- Netflix
- Services

Внутри каждого сервиса должны быть вкладки:

- CIDR
- RouterOS
- DNS

На карточке сервиса отображаются три счётчика и дата последнего push исходного репозитория.

## 7. Как обновляются данные

Ничего обновлять в `Service-Lists` после изменения списков не требуется.

Браузер читает актуальные файлы напрямую из `raw.githubusercontent.com` при открытии страницы. Дата последнего изменения репозитория запрашивается через публичный GitHub REST API и кэшируется локально на 15 минут.

## 8. Добавление нового сервиса

Нужно изменить только `site/services.json`, добавив:

- key
- отображаемое имя
- имя репозитория
- точный путь CIDR-файла
- точный путь RouterOS-файла
- точный путь DNS-файла

После push Service Lists автоматически переразвернётся через GitHub Pages.
