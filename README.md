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
eduquest/
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
