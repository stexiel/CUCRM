# 💬 CHAT MODULE - ПОЛНОЕ РУКОВОДСТВО ПО УСТАНОВКЕ

**Версия**: 2.0  
**Совместимость**: EspoCRM 9.1.8  
**Дата**: 2026-01-07

---

## 📋 СОДЕРЖАНИЕ

1. [Что входит в модуль](#что-входит-в-модуль)
2. [Структура файлов](#структура-файлов)
3. [Быстрая установка](#быстрая-установка)
4. [Детальная установка](#детальная-установка)
5. [База данных](#база-данных)
6. [Запуск WebSocket сервера](#запуск-websocket-сервера)
7. [Проверка работы](#проверка-работы)
8. [Возможности чата](#возможности-чата)
9. [Troubleshooting](#troubleshooting)

---

## 📦 ЧТО ВХОДИТ В МОДУЛЬ

### Серверная часть (PHP)
- **chat-websocket-server.php** - WebSocket сервер (1279 строк)
- **custom/Espo/Custom/Controllers/Chat.php** - REST API контроллер (645 строк)
- **custom/Espo/Custom/Hooks/User/AddToGeneralGroup.php** - Автодобавление в общую группу

### Клиентская часть (JavaScript)
- **client/custom/src/views/chat/index.js** - Главный JS файл (2156 строк)
- **client/custom/res/templates/chat/index.tpl** - HTML шаблон с CSS (1733 строки)

### Metadata (JSON)
- **custom/Espo/Custom/Resources/metadata/entityDefs/ChatRoom.json**
- **custom/Espo/Custom/Resources/metadata/entityDefs/ChatMessage.json**
- **custom/Espo/Custom/Resources/metadata/clientDefs/ChatRoom.json**
- **custom/Espo/Custom/Resources/metadata/scopes/ChatRoom.json**

### Документация
- **INSTALLATION_GUIDE.md** - Этот файл
- **DATABASE.sql** - SQL скрипт для создания таблиц

---

## 📂 СТРУКТУРА ФАЙЛОВ

### Карта размещения на боевом сервере:

```
EspoCRM-9.1.8/
│
├── chat-websocket-server.php
│   └── Адрес: /path/to/EspoCRM-9.1.8/chat-websocket-server.php
│
├── custom/
│   └── Espo/
│       └── Custom/
│           ├── Controllers/
│           │   └── Chat.php
│           │       └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Controllers/Chat.php
│           │
│           ├── Hooks/
│           │   └── User/
│           │       └── AddToGeneralGroup.php
│           │           └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Hooks/User/AddToGeneralGroup.php
│           │
│           └── Resources/
│               └── metadata/
│                   ├── entityDefs/
│                   │   ├── ChatRoom.json
│                   │   │   └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Resources/metadata/entityDefs/ChatRoom.json
│                   │   └── ChatMessage.json
│                   │       └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Resources/metadata/entityDefs/ChatMessage.json
│                   │
│                   ├── clientDefs/
│                   │   └── ChatRoom.json
│                   │       └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Resources/metadata/clientDefs/ChatRoom.json
│                   │
│                   └── scopes/
│                       └── ChatRoom.json
│                           └── Адрес: /path/to/EspoCRM-9.1.8/custom/Espo/Custom/Resources/metadata/scopes/ChatRoom.json
│
└── client/
    └── custom/
        ├── src/
        │   └── views/
        │       └── chat/
        │           └── index.js
        │               └── Адрес: /path/to/EspoCRM-9.1.8/client/custom/src/views/chat/index.js
        │
        └── res/
            └── templates/
                └── chat/
                    └── index.tpl
                        └── Адрес: /path/to/EspoCRM-9.1.8/client/custom/res/templates/chat/index.tpl
```

---

## ⚡ БЫСТРАЯ УСТАНОВКА

### Шаг 1: Копирование файлов

```bash
# На Linux/Mac
cd /path/to/EspoCRM-9.1.8
cp -r chat-module/* ./

# На Windows
cd C:\path\to\EspoCRM-9.1.8
xcopy chat-module\* . /E /Y
```

### Шаг 2: Установка прав (только Linux)

```bash
chmod 644 chat-websocket-server.php
chmod -R 644 custom/Espo/Custom/Controllers/
chmod -R 644 custom/Espo/Custom/Hooks/
chmod -R 755 custom/Espo/Custom/Resources/
chown -R www-data:www-data custom/
chown www-data:www-data chat-websocket-server.php
```

### Шаг 3: База данных

```bash
mysql -u root -p espocrm < chat-module/DATABASE.sql
```

Или выполните SQL вручную через phpMyAdmin/Adminer.

### Шаг 4: Очистка кэша

```bash
php command.php rebuild
rm -rf data/cache/*
```

### Шаг 5: Добавление в меню

Откройте `data/config.php` и добавьте `ChatRoom` в `tabList`:

```php
'tabList' => [
    // ... другие модули
    'ChatRoom',
    // ...
],
```

### Шаг 6: Запуск WebSocket сервера

⚠️ **КРИТИЧЕСКИ ВАЖНО: WebSocket сервер запускается ОТДЕЛЬНО!**

```bash
# Для теста
php chat-websocket-server.php

# Для продакшена (systemd)
sudo systemctl start chat-websocket
sudo systemctl enable chat-websocket
```

### Шаг 7: Открытие порта

```bash
sudo ufw allow 8081/tcp
```

### Шаг 8: Проверка

Откройте браузер → EspoCRM → ChatRoom → F12 → Console  
Должно быть: `WebSocket connected`

---

## 🔧 ДЕТАЛЬНАЯ УСТАНОВКА

### 1. Подготовка сервера

**Требования:**
- PHP 8.2+
- MySQL 8.0+
- EspoCRM 9.1.8
- Открытый порт 8081
- Расширения PHP: PDO, sockets, json

**Проверка:**
```bash
php -v
mysql --version
php -m | grep -E "PDO|sockets|json"
```

### 2. Копирование файлов

Скопируйте все файлы из `chat-module/` в корень EspoCRM:

```bash
cd /path/to/EspoCRM-9.1.8

# Скопируйте WebSocket сервер
cp chat-module/chat-websocket-server.php ./

# Скопируйте серверные файлы
cp -r chat-module/custom/Espo/Custom/Controllers/* custom/Espo/Custom/Controllers/
cp -r chat-module/custom/Espo/Custom/Hooks/* custom/Espo/Custom/Hooks/
cp -r chat-module/custom/Espo/Custom/Resources/* custom/Espo/Custom/Resources/

# Скопируйте клиентские файлы
cp -r chat-module/client/custom/src/* client/custom/src/
cp -r chat-module/client/custom/res/* client/custom/res/
```

### 3. Установка прав доступа (Linux)

```bash
# Права на PHP файлы
chmod 644 chat-websocket-server.php
chmod 644 custom/Espo/Custom/Controllers/Chat.php
chmod 644 custom/Espo/Custom/Hooks/User/AddToGeneralGroup.php

# Права на директории
chmod 755 custom/Espo/Custom/Controllers
chmod 755 custom/Espo/Custom/Hooks/User
chmod 755 custom/Espo/Custom/Resources/metadata/*

# Владелец (замените www-data на вашего веб-пользователя)
chown -R www-data:www-data custom/
chown www-data:www-data chat-websocket-server.php
```

### 4. Проверка файлов

```bash
# Проверьте что все файлы на месте
ls -la chat-websocket-server.php
ls -la custom/Espo/Custom/Controllers/Chat.php
ls -la client/custom/src/views/chat/index.js
ls -la client/custom/res/templates/chat/index.tpl
```

### 5. Очистка кэша EspoCRM

```bash
# Через CLI
php command.php rebuild

# Или удалите кэш вручную
rm -rf data/cache/*
```

### 6. Добавление в конфигурацию

Откройте `data/config.php` и убедитесь, что ChatRoom в списке табов:

```php
'tabList' => [
    'Account',
    'Contact',
    'Lead',
    'ChatRoom',  // ← Добавьте эту строку
    // ... остальные модули
],
```

---

## 🗄️ БАЗА ДАННЫХ

### Создание таблиц

Выполните следующие SQL команды:

```sql
-- Таблица комнат
CREATE TABLE IF NOT EXISTS `chat_room` (
  `id` VARCHAR(24) NOT NULL,
  `name` VARCHAR(255) DEFAULT NULL,
  `type` ENUM('direct', 'group') DEFAULT 'direct',
  `created_at` DATETIME DEFAULT NULL,
  `modified_at` DATETIME DEFAULT NULL,
  `deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица сообщений
CREATE TABLE IF NOT EXISTS `chat_message` (
  `id` VARCHAR(24) NOT NULL,
  `message` TEXT,
  `from_user_id` VARCHAR(24) DEFAULT NULL,
  `to_user_id` VARCHAR(24) DEFAULT NULL,
  `chat_room_id` VARCHAR(24) DEFAULT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `is_edited` TINYINT(1) DEFAULT 0,
  `edited_at` DATETIME DEFAULT NULL,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `reply_to_id` VARCHAR(24) DEFAULT NULL,
  `reactions` JSON DEFAULT NULL,
  `attachment_type` VARCHAR(50) DEFAULT NULL,
  `attachment_url` MEDIUMTEXT DEFAULT NULL,
  `attachment_name` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT NULL,
  `deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_room` (`chat_room_id`),
  INDEX `idx_from_user` (`from_user_id`),
  INDEX `idx_created` (`created_at`),
  INDEX `idx_deleted` (`deleted`),
  FOREIGN KEY (`chat_room_id`) REFERENCES `chat_room`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблица участников комнат
CREATE TABLE IF NOT EXISTS `chat_room_user` (
  `id` INT AUTO_INCREMENT,
  `chat_room_id` VARCHAR(24) NOT NULL,
  `user_id` VARCHAR(24) NOT NULL,
  `deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_room_user` (`chat_room_id`, `user_id`),
  INDEX `idx_room` (`chat_room_id`),
  INDEX `idx_user` (`user_id`),
  INDEX `idx_deleted` (`deleted`),
  FOREIGN KEY (`chat_room_id`) REFERENCES `chat_room`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Добавление полей в таблицу user
ALTER TABLE `user` 
  ADD COLUMN IF NOT EXISTS `is_online` TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `last_seen` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `is_typing_in_room` VARCHAR(24) DEFAULT NULL;

-- Создание "Общей группы"
INSERT INTO `chat_room` (`id`, `name`, `type`, `created_at`, `deleted`)
VALUES ('general-group-id', 'Общая группа', 'group', NOW(), 0)
ON DUPLICATE KEY UPDATE `name` = 'Общая группа';

-- Добавление всех активных пользователей в "Общую группу"
INSERT IGNORE INTO `chat_room_user` (`chat_room_id`, `user_id`, `deleted`)
SELECT 'general-group-id', `id`, 0
FROM `user`
WHERE `is_active` = 1 AND `deleted` = 0;
```

### Проверка таблиц

```sql
-- Проверьте что таблицы созданы
SHOW TABLES LIKE 'chat_%';

-- Должны быть:
-- chat_room
-- chat_message
-- chat_room_user

-- Проверьте "Общую группу"
SELECT * FROM chat_room WHERE name = 'Общая группа';
```

---

## ⚡ ЗАПУСК WEBSOCKET СЕРВЕРА

### ⚠️ КРИТИЧЕСКИ ВАЖНО!

**WebSocket сервер - это ОТДЕЛЬНЫЙ процесс, который должен работать постоянно!**

Он НЕ запускается автоматически при запуске Apache/Nginx!

### Вариант 1: Запуск вручную (для тестирования)

```bash
cd /path/to/EspoCRM-9.1.8
php chat-websocket-server.php

# Вывод должен быть:
# Database connected
# WebSocket server started on 0.0.0.0:8081
# Waiting for connections...
```

**Проблема**: При закрытии терминала сервер остановится.

### Вариант 2: Запуск в фоне с nohup

```bash
nohup php chat-websocket-server.php > /var/log/chat-websocket.log 2>&1 &

# Проверка что запущен
ps aux | grep chat-websocket-server

# Просмотр логов
tail -f /var/log/chat-websocket.log
```

### Вариант 3: Systemd сервис (РЕКОМЕНДУЕТСЯ для продакшена)

Создайте файл `/etc/systemd/system/chat-websocket.service`:

```ini
[Unit]
Description=EspoCRM Chat WebSocket Server
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/EspoCRM-9.1.8
ExecStart=/usr/bin/php /path/to/EspoCRM-9.1.8/chat-websocket-server.php
Restart=always
RestartSec=10
StandardOutput=append:/var/log/chat-websocket.log
StandardError=append:/var/log/chat-websocket-error.log

[Install]
WantedBy=multi-user.target
```

**Замените `/path/to/EspoCRM-9.1.8` на реальный путь!**

Активация сервиса:

```bash
# Перезагрузите systemd
sudo systemctl daemon-reload

# Запустите сервис
sudo systemctl start chat-websocket

# Включите автозапуск при загрузке
sudo systemctl enable chat-websocket

# Проверьте статус
sudo systemctl status chat-websocket

# Просмотр логов
sudo journalctl -u chat-websocket -f
```

Управление сервисом:

```bash
# Остановить
sudo systemctl stop chat-websocket

# Перезапустить
sudo systemctl restart chat-websocket

# Статус
sudo systemctl status chat-websocket
```

### Вариант 4: Supervisor (альтернатива)

Установите supervisor:

```bash
sudo apt-get install supervisor
```

Создайте файл `/etc/supervisor/conf.d/chat-websocket.conf`:

```ini
[program:chat-websocket]
command=/usr/bin/php /path/to/EspoCRM-9.1.8/chat-websocket-server.php
directory=/path/to/EspoCRM-9.1.8
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/chat-websocket.log
```

Запуск:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start chat-websocket
sudo supervisorctl status
```

### Настройка файрвола

Откройте порт 8081 для WebSocket:

```bash
# UFW
sudo ufw allow 8081/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 8081 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

### Проверка WebSocket сервера

```bash
# Проверьте что порт слушается
netstat -tulpn | grep 8081

# Или
ss -tulpn | grep 8081

# Должно быть:
# tcp  0  0  0.0.0.0:8081  0.0.0.0:*  LISTEN  12345/php
```

Тест подключения:

```bash
# Установите wscat
npm install -g wscat

# Подключитесь
wscat -c ws://localhost:8081

# Отправьте тестовое сообщение
> {"type":"auth","userId":"test"}

# Должен прийти ответ
< {"type":"authSuccess","userId":"test"}
```

---

## ✅ ПРОВЕРКА РАБОТЫ

### 1. Проверка файлов

```bash
ls -la chat-websocket-server.php
ls -la custom/Espo/Custom/Controllers/Chat.php
ls -la client/custom/src/views/chat/index.js
ls -la client/custom/res/templates/chat/index.tpl
```

### 2. Проверка базы данных

```sql
SELECT COUNT(*) FROM chat_room;
SELECT COUNT(*) FROM chat_message;
SELECT COUNT(*) FROM chat_room_user;

-- Проверьте "Общую группу"
SELECT * FROM chat_room WHERE name = 'Общая группа';
```

### 3. Проверка WebSocket

```bash
# Проверьте что процесс запущен
ps aux | grep chat-websocket-server

# Проверьте логи
tail -f /var/log/chat-websocket.log
```

### 4. Проверка в браузере

1. Откройте EspoCRM в браузере
2. Перейдите в меню → **ChatRoom**
3. Откройте консоль браузера (F12)
4. Проверьте подключение:

```
Connecting to WebSocket: ws://your-domain.com:8081
WebSocket connected
Authenticated as user: your-user-id
```

5. Попробуйте создать чат и отправить сообщение

---

## ✨ ВОЗМОЖНОСТИ ЧАТА

### Основные функции
- ✅ **Реал-тайм общение** через WebSocket
- ✅ **Личные чаты** (direct) - 1 на 1
- ✅ **Групповые чаты** - неограниченное количество участников
- ✅ **Отправка изображений** с автосжатием (WhatsApp-style)
- ✅ **Редактирование сообщений** (только своих)
- ✅ **Удаление сообщений** (soft delete)
- ✅ **Ответы на сообщения** (reply) с превью
- ✅ **Реакции эмодзи** (👍 ❤️ 😂 😮 😢 🙏)
- ✅ **Закрепленные сообщения**
- ✅ **Статусы прочтения** (✓ одна галочка / ✓✓ две галочки)

### Поиск
- ✅ **Поиск по сообщениям** с fuzzy matching
- ✅ **Поиск по комнатам** с триграммами
- ✅ **Поиск пользователей** для создания чата
- ✅ **Автокомплит** с транслитерацией RU/EN
- ✅ **Восстановление удаленных чатов**

### Индикаторы
- ✅ **Typing indicator** - "Имя печатает..."
- ✅ **Online статус** - кто сейчас онлайн
- ✅ **Unread count** - счетчик непрочитанных

### Управление
- ✅ **Добавление участников** в группы
- ✅ **Удаление участников** из групп
- ✅ **Автодобавление** новых пользователей в "Общая группа"
- ✅ **Удаление комнат** (с возможностью восстановления)

### UI/UX
- WhatsApp-подобный интерфейс
- Двухпанельный layout
- Аватары с инициалами
- Цветовая кодировка пользователей
- Контекстное меню (правый клик)
- Модальные окна для управления

---

## 🐛 TROUBLESHOOTING

### Проблема: WebSocket не подключается

**Решение:**

```bash
# 1. Проверьте что сервер запущен
ps aux | grep chat-websocket-server

# 2. Проверьте порт
netstat -tulpn | grep 8081

# 3. Проверьте логи
tail -f /var/log/chat-websocket.log

# 4. Проверьте файрвол
sudo ufw status
sudo iptables -L -n | grep 8081

# 5. Перезапустите сервер
sudo systemctl restart chat-websocket
```

### Проблема: Ошибка "Database error"

**Решение:**

```bash
# Проверьте data/config-internal.php
cat data/config-internal.php

# Убедитесь что есть секция database:
# 'database' => [
#     'host' => 'localhost',
#     'port' => '3306',
#     'dbname' => 'espocrm',
#     'user' => 'root',
#     'password' => 'password'
# ]

# Проверьте подключение к БД
mysql -u root -p -e "SHOW DATABASES;"
```

### Проблема: Чат не отображается в меню

**Решение:**

```bash
# 1. Очистите кэш
php command.php rebuild
rm -rf data/cache/*

# 2. Проверьте config.php
grep -A 20 "tabList" data/config.php

# 3. Добавьте ChatRoom если нет
# Отредактируйте data/config.php вручную
```

### Проблема: "Permission denied" при запуске

**Решение:**

```bash
# Установите правильные права
chmod +x chat-websocket-server.php
chown www-data:www-data chat-websocket-server.php

# Проверьте права на data/config-internal.php
chmod 644 data/config-internal.php
```

### Проблема: Сообщения не отправляются

**Решение:**

```bash
# 1. Проверьте консоль браузера (F12)
# Ищите ошибки WebSocket

# 2. Проверьте логи WebSocket сервера
tail -f /var/log/chat-websocket.log

# 3. Проверьте таблицы БД
mysql -u root -p espocrm -e "SELECT COUNT(*) FROM chat_message;"

# 4. Проверьте что пользователь авторизован
# В консоли должно быть: "Authenticated as user: ..."
```

### Проблема: Высокая нагрузка CPU

**Решение:**

```bash
# Проверьте количество подключений
netstat -an | grep 8081 | wc -l

# Рестартуйте сервер
sudo systemctl restart chat-websocket
```

---

## 📝 ЧЕКЛИСТ УСТАНОВКИ

- [ ] Скопированы все файлы в правильные директории
- [ ] Установлены права доступа (chmod/chown)
- [ ] Создана база данных и таблицы
- [ ] Добавлена "Общая группа" в БД
- [ ] Очищен кэш EspoCRM
- [ ] ChatRoom добавлен в tabList
- [ ] WebSocket сервер запущен
- [ ] Настроен systemd/supervisor для автозапуска
- [ ] Открыт порт 8081 в файрволе
- [ ] Проверено подключение в браузере
- [ ] Создан тестовый чат
- [ ] Отправлено тестовое сообщение

---

## 🔒 БЕЗОПАСНОСТЬ

- ✅ Аутентификация через userId
- ✅ Проверка прав на редактирование/удаление
- ✅ PDO prepared statements (защита от SQL injection)
- ✅ HTML escaping (защита от XSS)
- ✅ Валидация размера файлов (макс 10MB)
- ✅ Soft delete (сохранение истории)

---

## 📊 СТАТИСТИКА

| Компонент | Строк кода | Размер |
|-----------|-----------|--------|
| WebSocket сервер | 1,279 | 50KB |
| Frontend JS | 2,156 | 92KB |
| REST контроллер | 645 | 24KB |
| HTML/CSS шаблон | 1,733 | 35KB |
| **ИТОГО** | **5,813** | **201KB** |

---

## 📞 ПОДДЕРЖКА

При возникновении проблем:

1. Проверьте логи: `/var/log/chat-websocket.log`
2. Проверьте консоль браузера (F12)
3. Проверьте статус сервиса: `systemctl status chat-websocket`
4. Проверьте подключение к БД
5. Очистите кэш: `php command.php rebuild`

---

**Версия документации**: 2.0  
**Дата**: 2026-01-07  
**Совместимость**: EspoCRM 9.1.8  
**Автор**: CUCRM Development Team
