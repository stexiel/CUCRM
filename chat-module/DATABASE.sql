-- ============================================
-- CHAT MODULE DATABASE SCHEMA
-- EspoCRM 9.1.8
-- ============================================

-- Таблица комнат чата
CREATE TABLE IF NOT EXISTS `chat_room` (
  `id` VARCHAR(24) NOT NULL,
  `name` VARCHAR(255) DEFAULT NULL,
  `type` ENUM('direct', 'group') DEFAULT 'direct',
  `created_at` DATETIME DEFAULT NULL,
  `modified_at` DATETIME DEFAULT NULL,
  `deleted` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_deleted` (`deleted`),
  INDEX `idx_created` (`created_at`)
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
  INDEX `idx_to_user` (`to_user_id`),
  INDEX `idx_created` (`created_at`),
  INDEX `idx_deleted` (`deleted`),
  INDEX `idx_is_read` (`is_read`),
  FOREIGN KEY (`chat_room_id`) REFERENCES `chat_room`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
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

-- Добавление полей в таблицу user для онлайн статусов
ALTER TABLE `user` 
  ADD COLUMN IF NOT EXISTS `is_online` TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `last_seen` DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `is_typing_in_room` VARCHAR(24) DEFAULT NULL;

-- Создание индексов для user
ALTER TABLE `user`
  ADD INDEX IF NOT EXISTS `idx_is_online` (`is_online`),
  ADD INDEX IF NOT EXISTS `idx_last_seen` (`last_seen`);

-- Создание "Общей группы" (автоматически добавляются все новые пользователи)
INSERT INTO `chat_room` (`id`, `name`, `type`, `created_at`, `deleted`)
VALUES ('general-group-id', 'Общая группа', 'group', NOW(), 0)
ON DUPLICATE KEY UPDATE `name` = 'Общая группа';

-- Добавление всех существующих активных пользователей в "Общую группу"
INSERT IGNORE INTO `chat_room_user` (`chat_room_id`, `user_id`, `deleted`)
SELECT 'general-group-id', `id`, 0
FROM `user`
WHERE `is_active` = 1 AND `deleted` = 0;

-- ============================================
-- ПРОВЕРКА УСТАНОВКИ
-- ============================================

-- Проверка созданных таблиц
SELECT 
    'chat_room' AS table_name,
    COUNT(*) AS row_count
FROM chat_room
UNION ALL
SELECT 
    'chat_message' AS table_name,
    COUNT(*) AS row_count
FROM chat_message
UNION ALL
SELECT 
    'chat_room_user' AS table_name,
    COUNT(*) AS row_count
FROM chat_room_user;

-- Проверка "Общей группы"
SELECT 
    cr.id,
    cr.name,
    cr.type,
    COUNT(cru.user_id) AS participants_count
FROM chat_room cr
LEFT JOIN chat_room_user cru ON cr.id = cru.chat_room_id AND cru.deleted = 0
WHERE cr.name = 'Общая группа'
GROUP BY cr.id, cr.name, cr.type;

-- Проверка полей в таблице user
SHOW COLUMNS FROM `user` LIKE 'is_online';
SHOW COLUMNS FROM `user` LIKE 'last_seen';
SHOW COLUMNS FROM `user` LIKE 'is_typing_in_room';
