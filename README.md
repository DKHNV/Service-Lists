# Service Lists

Публичная статическая панель для списков DKHNV: IPv4/CIDR, RouterOS и DNS.

## Архитектура

Service Lists не содержит backend и не генерирует сетевые данные. GitHub Pages публикует только HTML/CSS/JS. Браузер читает актуальные файлы напрямую из публичных GitHub Raw репозиториев, перечисленных в `services.json`.

Дата обновления берётся из `pushed_at` GitHub REST API и кэшируется в браузере на 15 минут. Если API недоступен, интерфейс пытается использовать дату `#Gen... DD.MM.YYYY` из CIDR/RouterOS файла.

## Сервисы

- YouTube
- Telegram
- Meta
- ChatGPT
- Discord
- Netflix
- Services

## GitHub Pages

После публикации репозитория откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Workflow `.github/workflows/pages.yml` публикует сайт при push в `main` и поддерживает ручной запуск через Actions.

Для project repository `DKHNV/Service-Lists` ожидаемый адрес сайта:

`https://dkhnv.github.io/Service-Lists/`

## Добавление сервиса

Добавьте одну запись в `services.json`, явно указав реальные имена трёх файлов. Интерфейс не угадывает имена файлов по шаблону, потому что существующие репозитории имеют различия вроде `Telegram-CIDR.txt` и `Discord_CIDR`.
