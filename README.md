# CUCRM - EspoCRM 9.1.8 с кастомными модулями

**CUCRM** - это кастомизированная CRM система на базе EspoCRM 9.1.8 с расширенным функционалом чата и бизнес-модулями.

## Быстрый запуск

### 1. Запуск веб-сервера
Откройте терминал и выполните:
\\\ash
cd C:\Users\Aser\Downloads\CATEC\EspoCRM-9.1.8
php -S localhost:8080 router.php
\\\

### 2. Запуск WebSocket чата
Откройте второй терминал и выполните:
\\\ash
php chat-websocket-server.php
\\\

### 3. Доступ к системе
- **CRM:** http://localhost:8080
- **Чат:** http://localhost:8080/#ChatRoom

## Требования
- PHP 8.2+
- MySQL 8.0+
- Composer

## Для разработчиков

### Установка проекта
\\\ash
git clone https://github.com/stexiel/CUCRM.git
cd CUCRM
composer install
\\\

### Конфигурация
1. Создайте базу данных MySQL: \cucrm\
2. Настройте \data/config-internal.php\
3. Установите права доступа к папкам

### Разработка
- **Кастомные модули:** \custom/Espo/Custom/\
- **Фронтенд:** \client/custom/\
- **API:** \pplication/Espo/Controllers/\

## Репозиторий
https://github.com/stexiel/CUCRM.git
