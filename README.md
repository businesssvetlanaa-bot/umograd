# Умоград — игровой ИИ-репетитор для 4 класса

Игровой AI-репетитор в стиле Minecraft для детей 4 класса: математика, русский язык, английский.

## Стек

- **Client:** React + TypeScript + Vite + Tailwind CSS v4 + React Router
- **Server:** Node.js + Express + TypeScript + Prisma ORM
- **AI:** Anthropic Claude API
- **DB:** SQLite для локального тестирования
- **Storage:** Cloudflare R2

## Быстрый старт

### 1. Установка зависимостей

```bash
# Client
cd client && npm install

# Server
cd server && npm install
```

### 2. Настройка переменных окружения

```bash
# Скопируй .env.example в server/.env
cp .env.example server/.env
# Заполни все переменные
```

### 3. База данных

```bash
cd server
npm run db:generate   # Генерация Prisma Client
npm run db:init:local # Создать локальную базу
npm run db:seed       # Загрузить учебные темы
```

### 4. Запуск

```bash
# Server (порт 5001)
cd server && npm run dev

# Client (порт 3001) — в другом терминале
cd client && npm run dev
```

Открой [http://127.0.0.1:3001](http://127.0.0.1:3001)

## Структура проекта

```
umograd/
├── client/                 # React приложение
│   └── src/
│       ├── api/            # HTTP-клиент, запросы к API
│       ├── components/     # UI компоненты
│       ├── hooks/          # Кастомные хуки
│       ├── pages/          # Страницы (роуты)
│       ├── store/          # Стейт-менеджмент
│       ├── styles/         # CSS переменные
│       └── types/          # TypeScript типы
├── server/                 # Express API
│   ├── prisma/             # Схема БД и миграции
│   └── src/
│       ├── controllers/    # Обработчики роутов
│       ├── middleware/     # JWT, валидация
│       ├── routes/         # Express роуты
│       └── services/       # Бизнес-логика
├── .env.example
├── .gitignore
└── README.md
```

## Безопасный production-запуск

`npm start` предназначен для production: он выполняет read-only preflight и никогда не создаёт базу данных и не запускает seed. Для локального запуска собранной версии используйте `npm run start:local`.

До production-запуска:

1. Подключите постоянный диск. Эфемерная файловая система недопустима.
2. Создайте SQLite-базу отдельно и укажите её абсолютный путь: `DATABASE_URL=file:/абсолютный/путь/umograd.sqlite`. Файл должен находиться вне каталога приложения и временного каталога.
3. Задайте случайный `JWT_SECRET` длиной не менее 32 символов и `UMOGRAD_PERSISTENT_DB_CONFIRMED=true`.
4. Если UI и API находятся на разных origins, задайте один точный `CLIENT_URL`; для одного origin переменная не обязательна.
5. Выполните `npm run preflight`. Команда только читает конфигурацию, файл БД, таблицы и обязательные колонки.
6. Запустите `npm start`, затем проверьте `GET /api/health`, `GET /api/ready` и главную страницу. Readiness должен вернуть `200 {"status":"ready"}`.

`ANTHROPIC_API_KEY` не обязателен для текстового локального тьютора. Без него распознавание фотографий недоступно, но production startup не блокируется.

### Важное ограничение migrations

Текущая Prisma schema использует SQLite, а сохранённая migration history содержит PostgreSQL migrations. До отдельного решения о production provider не запускайте `prisma migrate deploy`, `prisma migrate dev` или `prisma db push` на production-данных. Startup намеренно не меняет схему и завершится ошибкой, если обязательных таблиц или колонок нет.

Seed также не входит в startup и при `NODE_ENV=production` заблокирован. До исправления migration history production-базу нужно готовить отдельной проверенной процедурой, а не командами запуска приложения.

### Backup и проверка восстановления SQLite

1. Корректно остановите приложение и убедитесь, что процессов записи больше нет.
2. Скопируйте файл из `DATABASE_URL` и существующие соседние файлы с суффиксами `-wal` и `-shm` как единый backup-набор на отдельное постоянное хранилище.
3. Восстановите набор в отдельный тестовый каталог.
4. Из `server` запустите `npm run preflight:local`, временно задав `DATABASE_URL` абсолютным путём к восстановленной копии.
5. Только после успешной проверки используйте backup для rollback. Никогда не заменяйте рабочую БД при запущенном сервере.
