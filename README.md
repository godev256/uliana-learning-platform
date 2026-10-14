# Сайт Ульяны

Одностраничный сайт репетитора: React 19, Vite 8, Tailwind CSS 4 и Framer Motion.
Для локальной разработки не нужны база данных, backend или `.env`.
Форма записи подготавливает сообщение для отправки посетителем через Telegram или VK.

## Локальный запуск

```sh
cd /Users/ulanaa/Desktop/website
./dev.sh
```

Сайт: http://127.0.0.1:5173. Изменения в `src/` автоматически появляются в браузере.
Остановка сервера: Ctrl+C. Для другого порта: `./dev.sh --port 5174`.

На текущем компьютере Node.js 24.19.0 с npm установлен в `.local/node/`.
Обёртка `scripts/npm.sh` автоматически использует его, поэтому системная установка не нужна.
Локальные инструменты, зависимости и результаты сборки исключены из Git.

На другом компьютере установите Node.js 24 (версия зафиксирована в `.nvmrc`
и `.node-version`), затем выполните:

```sh
./scripts/npm.sh ci
./dev.sh
```

При использовании nvm достаточно `nvm install && nvm use`.
Все стандартные команды `npm` также работают при установленном системном Node.js.

## Проверки и сборка

```sh
./scripts/npm.sh run build
./scripts/npm.sh run preview
```

Сборка сохраняется в `dist/`, preview доступен на http://127.0.0.1:4173.

Для браузерной проверки сначала запустите dev-сервер, затем в другом терминале:

```sh
./scripts/npm.sh exec -- playwright install chromium
./scripts/npm.sh run verify:playwright
```

Проверка охватывает три размера экрана, карусель и изображения отзывов,
валидацию формы, копирование сообщения и закрытие модальных окон.
Скриншоты сохраняются в `playwright-report/`.
Обёртка сохраняет браузеры Playwright в `.local/playwright/`.
Другой адрес: `PLAYWRIGHT_URL=http://127.0.0.1:5174 ./scripts/npm.sh run verify:playwright`.

После замены оригинальных фотографий или отзывов запустите
`./scripts/npm.sh run build:images` для обновления адаптивных файлов в `public/`.

## Где вносить изменения

- `src/App.jsx` — разделы сайта, тексты и интерактивные элементы.
- `src/index.css` — оформление, шрифты и стили.
- `public/` — готовые изображения; `repetitor.png` и `reviews/` — оригиналы.
- `DESIGN.md` и `PRODUCT.md` — визуальные и продуктовые ориентиры.
- `scripts/verify-playwright.mjs` — существующие браузерные проверки.

## Git

Репозиторий клонирован с историей, `origin` указывает на
https://github.com/godev256/uliana-learning-platform.
На этом Mac без Xcode используйте обёртку для Git из Codex:

```sh
./scripts/git.sh status
./scripts/git.sh switch -c feature/my-change
./scripts/git.sh diff
```

На компьютере с системным Git можно использовать обычные команды `git`.
