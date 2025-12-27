# EspoCRM Chat Module

## Файлы чата

### Основные файлы:
- `index.js` - WebSocket клиент
- `index.tpl` - HTML шаблон чата
- `chat-websocket-server.php` - WebSocket сервер

## Установка

Скопировать файлы в папки EspoCRM от корня:

```
index.js → client/custom/src/views/chat/index.js
index.tpl → client/custom/res/templates/chat/index.tpl
chat-websocket-server.php → chat-websocket-server.php
```

## Запуск

Запустить WebSocket сервер в терминале:

```bash
php chat-websocket-server.php
```

Чат доступен по адресу:
```
http://localhost:8080/#ChatRoom
```
