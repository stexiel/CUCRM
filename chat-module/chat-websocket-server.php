<?php
/**
 * Chat WebSocket Server for EspoCRM
 * Запуск: php chat-websocket-server.php
 */

class ChatWebSocketServer
{
    private $host = '0.0.0.0';
    private $port = 8081;
    private $socket;
    private $clients = [];
    private $userConnections = []; // userId => [client1, client2, ...]
    private $connectionUsers = []; // resourceId => userId
    private $pdo;

    public function __construct()
    {
        $configPath = __DIR__ . '/data/config-internal.php';
        if (!file_exists($configPath)) {
            die("Config file not found: $configPath\n");
        }

        $config = include $configPath;
        $db = $config['database'];

        $dsn = "mysql:host={$db['host']};dbname={$db['dbname']};charset=utf8mb4";
        if (!empty($db['port'])) {
            $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['dbname']};charset=utf8mb4";
        }

        try {
            $this->pdo = new PDO($dsn, $db['user'], $db['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            echo "Database connected\n";
        } catch (PDOException $e) {
            die("Database error: " . $e->getMessage() . "\n");
        }
    }

    public function run()
    {
        $context = stream_context_create();
        $this->socket = stream_socket_server(
            "tcp://{$this->host}:{$this->port}",
            $errno, $errstr,
            STREAM_SERVER_BIND | STREAM_SERVER_LISTEN,
            $context
        );

        if (!$this->socket) {
            die("Server error: $errstr ($errno)\n");
        }

        stream_set_blocking($this->socket, false);
        $this->clients[] = $this->socket;

        echo "WebSocket Server started on ws://{$this->host}:{$this->port}\n";

        while (true) {
            $read = array_filter($this->clients, 'is_resource');
            if (!in_array($this->socket, $read)) {
                $read[] = $this->socket;
            }
            $write = null;
            $except = null;

            if (@stream_select($read, $write, $except, 1, 0) < 1) {
                continue;
            }

            // New connection
            if (in_array($this->socket, $read)) {
                $newClient = @stream_socket_accept($this->socket, 0);
                if ($newClient) {
                    stream_set_blocking($newClient, false);
                    $this->clients[] = $newClient;

                    $header = '';
                    $start = time();
                    while (strpos($header, "\r\n\r\n") === false && (time() - $start) < 5) {
                        $chunk = @fread($newClient, 1024);
                        if ($chunk) $header .= $chunk;
                        usleep(10000);
                    }

                    if ($header) {
                        $this->handshake($header, $newClient);
                        echo "Client connected\n";
                    }
                }
                $key = array_search($this->socket, $read);
                unset($read[$key]);
            }

            // Handle messages
            foreach ($read as $client) {
                if (!is_resource($client)) {
                    $this->removeClient($client);
                    continue;
                }

                // Читаем данные с увеличенным буфером для больших изображений (до 20MB)
                $data = '';
                $maxSize = 20 * 1024 * 1024; // 20MB
                $chunkSize = 2 * 1024 * 1024; // 2MB за раз
                stream_set_blocking($client, false);
                while (($chunk = @fread($client, $chunkSize)) !== false && $chunk !== '') {
                    $data .= $chunk;
                    if (strlen($data) > $maxSize) {
                        echo "[ERROR] Message too large, closing connection\n";
                        $this->removeClient($client);
                        continue 2;
                    }
                    if (strlen($chunk) < $chunkSize) break;
                }
                stream_set_blocking($client, true);
                
                if ($data === '') {
                    $this->removeClient($client);
                    continue;
                }

                $msg = $this->decode($data);
                if ($msg && $msg['type'] === 'text') {
                    $this->handleMessage($client, $msg['payload']);
                } elseif ($msg && $msg['type'] === 'close') {
                    $this->removeClient($client);
                }
            }
        }
    }

    private function handshake($header, $client)
    {
        if (preg_match("/Sec-WebSocket-Key: (.*)\r\n/", $header, $match)) {
            $key = trim($match[1]);
            $acceptKey = base64_encode(sha1($key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));

            $response = "HTTP/1.1 101 Switching Protocols\r\n" .
                "Upgrade: websocket\r\n" .
                "Connection: Upgrade\r\n" .
                "Sec-WebSocket-Accept: $acceptKey\r\n\r\n";

            @fwrite($client, $response);
        }
    }

    private function decode($data)
    {
        if (strlen($data) < 2) return null;

        $firstByte = ord($data[0]);
        $opcode = $firstByte & 0x0F;

        if ($opcode === 0x08) return ['type' => 'close', 'payload' => ''];

        $secondByte = ord($data[1]);
        $masked = ($secondByte & 0x80) !== 0;
        $len = $secondByte & 0x7F;

        $offset = 2;
        if ($len === 126) {
            $len = unpack('n', substr($data, 2, 2))[1];
            $offset = 4;
        } elseif ($len === 127) {
            $len = unpack('J', substr($data, 2, 8))[1];
            $offset = 10;
        }

        if ($masked) {
            $mask = substr($data, $offset, 4);
            $offset += 4;
        }

        $payload = substr($data, $offset, $len);

        if ($masked) {
            $decoded = '';
            for ($i = 0; $i < strlen($payload); $i++) {
                $decoded .= $payload[$i] ^ $mask[$i % 4];
            }
            $payload = $decoded;
        }

        return ['type' => 'text', 'payload' => $payload];
    }

    private function encode($payload)
    {
        $len = strlen($payload);
        if ($len <= 125) {
            return chr(0x81) . chr($len) . $payload;
        } elseif ($len <= 65535) {
            return chr(0x81) . chr(126) . pack('n', $len) . $payload;
        } else {
            return chr(0x81) . chr(127) . pack('J', $len) . $payload;
        }
    }

    private function send($client, $data)
    {
        if (!is_resource($client)) return;
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        @fwrite($client, $this->encode($json));
    }

    private function removeClient($client)
    {
        $resourceId = (int)$client;
        
        if (isset($this->connectionUsers[$resourceId])) {
            $userId = $this->connectionUsers[$resourceId];
            if (isset($this->userConnections[$userId])) {
                $key = array_search($client, $this->userConnections[$userId]);
                if ($key !== false) {
                    unset($this->userConnections[$userId][$key]);
                }
                if (empty($this->userConnections[$userId])) {
                    unset($this->userConnections[$userId]);
                }
            }
            unset($this->connectionUsers[$resourceId]);
        }

        $key = array_search($client, $this->clients);
        if ($key !== false) {
            unset($this->clients[$key]);
        }

        if (is_resource($client)) {
            @fclose($client);
        }
    }

    private function handleMessage($client, $payload)
    {
        $data = json_decode($payload, true);
        if (!$data || !isset($data['type'])) return;

        echo "Received: {$data['type']}\n";

        try {
            switch ($data['type']) {
                case 'auth':
                    $this->handleAuth($client, $data);
                    break;
                case 'loadRooms':
                    $this->handleLoadRooms($client);
                    break;
                case 'loadMessages':
                    $this->handleLoadMessages($client, $data);
                    break;
                case 'sendMessage':
                    $this->handleSendMessage($client, $data);
                    break;
                case 'markAsRead':
                    $this->handleMarkAsRead($client, $data);
                    break;
                case 'getUsers':
                    $this->handleGetUsers($client);
                    break;
                case 'createRoom':
                    $this->handleCreateRoom($client, $data);
                    break;
                case 'getParticipants':
                    $this->handleGetParticipants($client, $data);
                    break;
                case 'addParticipants':
                    $this->handleAddParticipants($client, $data);
                    break;
                case 'removeParticipant':
                    $this->handleRemoveParticipant($client, $data);
                    break;
                case 'editMessage':
                    $this->handleEditMessage($client, $data);
                    break;
                case 'deleteMessage':
                    $this->handleDeleteMessage($client, $data);
                    break;
                case 'reactToMessage':
                    $this->handleReactToMessage($client, $data);
                    break;
                case 'pinMessage':
                    $this->handlePinMessage($client, $data);
                    break;
                case 'typing':
                    $this->handleTyping($client, $data);
                    break;
            }
        } catch (Exception $e) {
            echo "Error: " . $e->getMessage() . "\n";
            $this->send($client, ['type' => 'error', 'message' => $e->getMessage()]);
        }
    }

    private function getUserId($client)
    {
        $resourceId = (int)$client;
        return $this->connectionUsers[$resourceId] ?? null;
    }

    private function generateId()
    {
        return substr(str_replace('.', '', uniqid('', true)), 0, 17);
    }

    // === HANDLERS ===

    private function handleAuth($client, $data)
    {
        $userId = $data['userId'] ?? null;
        if (!$userId) {
            $this->send($client, ['type' => 'error', 'message' => 'userId required']);
            return;
        }

        $resourceId = (int)$client;
        $this->connectionUsers[$resourceId] = $userId;

        if (!isset($this->userConnections[$userId])) {
            $this->userConnections[$userId] = [];
        }
        $this->userConnections[$userId][] = $client;

        // Update online status
        $sql = "UPDATE user SET is_online = 1, last_seen = NOW() WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$userId]);

        $this->send($client, ['type' => 'authSuccess', 'userId' => $userId]);
        echo "User $userId authenticated\n";
    }

    private function handleLoadRooms($client)
    {
        $userId = $this->getUserId($client);
        if (!$userId) {
            $this->send($client, ['type' => 'error', 'message' => 'Not authenticated']);
            return;
        }

        $sql = "
            SELECT DISTINCT cr.* 
            FROM chat_room cr
            INNER JOIN chat_room_user cru ON cr.id = cru.chat_room_id
            WHERE cru.user_id = ? AND cr.deleted = 0 AND cru.deleted = 0
            ORDER BY cr.created_at DESC
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$userId]);
        $rooms = $stmt->fetchAll();

        $result = [];
        foreach ($rooms as $room) {
            $roomId = $room['id'];

            // Last message
            $msgSql = "SELECT message, created_at FROM chat_message WHERE chat_room_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 1";
            $msgStmt = $this->pdo->prepare($msgSql);
            $msgStmt->execute([$roomId]);
            $lastMsg = $msgStmt->fetch();

            // Unread count
            $unreadSql = "SELECT COUNT(*) as cnt FROM chat_message WHERE chat_room_id = ? AND from_user_id != ? AND is_read = 0 AND deleted = 0";
            $unreadStmt = $this->pdo->prepare($unreadSql);
            $unreadStmt->execute([$roomId, $userId]);
            $unread = $unreadStmt->fetch();

            // Participants
            $partSql = "
                SELECT u.id, u.user_name, u.first_name, u.last_name
                FROM user u
                INNER JOIN chat_room_user cru ON u.id = cru.user_id
                WHERE cru.chat_room_id = ? AND u.deleted = 0 AND cru.deleted = 0
            ";
            $partStmt = $this->pdo->prepare($partSql);
            $partStmt->execute([$roomId]);
            $participants = $partStmt->fetchAll();

            $participantsList = [];
            foreach ($participants as $p) {
                $name = trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));
                if (empty($name)) $name = $p['user_name'];
                $participantsList[] = [
                    'id' => $p['id'],
                    'name' => $name,
                    'userName' => $p['user_name']
                ];
            }

            $result[] = [
                'id' => $roomId,
                'name' => $room['name'],
                'type' => $room['type'],
                'lastMessage' => $lastMsg ? $lastMsg['message'] : null,
                'lastMessageTime' => $lastMsg ? $lastMsg['created_at'] : $room['created_at'],
                'unreadCount' => (int)($unread['cnt'] ?? 0),
                'participants' => $participantsList,
                'createdAt' => $room['created_at'],
                'pinned' => $room['name'] === 'Общая группа'
            ];
        }

        // Sort: "Общая группа" first, then by lastMessageTime (newest first)
        usort($result, function($a, $b) {
            if ($a['name'] === 'Общая группа') return -1;
            if ($b['name'] === 'Общая группа') return 1;
            $ta = $a['lastMessageTime'] ? strtotime($a['lastMessageTime']) : 0;
            $tb = $b['lastMessageTime'] ? strtotime($b['lastMessageTime']) : 0;
            return $tb - $ta;
        });

        $this->send($client, ['type' => 'rooms', 'rooms' => $result]);
    }

    private function handleLoadMessages($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $roomId = $data['roomId'] ?? null;
        if (!$roomId) return;

        $offset = $data['offset'] ?? 0;
        $limit = $data['limit'] ?? 50;

        $sql = "
            SELECT cm.*, u.user_name, u.first_name, u.last_name
            FROM chat_message cm
            LEFT JOIN user u ON cm.from_user_id = u.id
            WHERE cm.chat_room_id = ? AND cm.deleted = 0
            ORDER BY cm.created_at ASC
            LIMIT ? OFFSET ?
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(1, $roomId, PDO::PARAM_STR);
        $stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(3, (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        $messages = $stmt->fetchAll();

        $result = [];
        foreach ($messages as $msg) {
            $userName = trim(($msg['first_name'] ?? '') . ' ' . ($msg['last_name'] ?? ''));
            if (empty($userName)) $userName = $msg['user_name'] ?? 'Unknown';

            $result[] = [
                'id' => $msg['id'],
                'message' => $msg['message'] ?? '',
                'fromUserId' => $msg['from_user_id'],
                'fromUserName' => $userName,
                'toUserId' => $msg['to_user_id'] ?? null,
                'isRead' => (bool)($msg['is_read'] ?? false),
                'createdAt' => $msg['created_at'],
                'isEdited' => (bool)($msg['is_edited'] ?? false),
                'editedAt' => $msg['edited_at'] ?? null,
                'reactions' => $msg['reactions'] ? json_decode($msg['reactions'], true) : null,
                'isPinned' => (bool)($msg['is_pinned'] ?? false),
                'replyToId' => $msg['reply_to_id'] ?? null,
                'attachmentType' => $msg['attachment_type'] ?? null,
                'attachmentUrl' => $msg['attachment_url'] ?? null,
                'attachmentName' => $msg['attachment_name'] ?? null
            ];
        }

        $this->send($client, ['type' => 'messages', 'roomId' => $roomId, 'messages' => $result]);
    }

    private function handleSendMessage($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $roomId = $data['roomId'] ?? null;
        $message = $data['message'] ?? '';
        $toUserId = $data['toUserId'] ?? null;
        $replyToId = $data['replyToId'] ?? null;
        $attachmentType = $data['attachmentType'] ?? null;
        $attachmentUrl = $data['attachmentUrl'] ?? null;
        $attachmentName = $data['attachmentName'] ?? null;

        // Debug logging
        if ($attachmentType) {
            echo "[DEBUG] Attachment: type={$attachmentType}, name={$attachmentName}, url_length=" . strlen($attachmentUrl ?? '') . "\n";
        }

        if (!$message && !$attachmentUrl) return;

        // Create direct room if needed
        if (!$roomId && $toUserId) {
            $roomId = $this->getOrCreateDirectRoom($userId, $toUserId);
        }

        if (!$roomId) return;

        $messageId = $this->generateId();
        $now = date('Y-m-d H:i:s');

        $sql = "INSERT INTO chat_message (id, message, from_user_id, chat_room_id, is_read, created_at, deleted, reply_to_id, attachment_type, attachment_url, attachment_name) 
                VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$messageId, $message, $userId, $roomId, $now, $replyToId, $attachmentType, $attachmentUrl, $attachmentName]);

        // Get user name
        $userSql = "SELECT user_name, first_name, last_name FROM user WHERE id = ?";
        $userStmt = $this->pdo->prepare($userSql);
        $userStmt->execute([$userId]);
        $userData = $userStmt->fetch();

        $userName = trim(($userData['first_name'] ?? '') . ' ' . ($userData['last_name'] ?? ''));
        if (empty($userName)) $userName = $userData['user_name'] ?? 'Unknown';

        $messageData = [
            'type' => 'newMessage',
            'roomId' => $roomId,
            'message' => [
                'id' => $messageId,
                'message' => $message,
                'fromUserId' => $userId,
                'fromUserName' => $userName,
                'isRead' => false,
                'createdAt' => $now,
                'replyToId' => $replyToId,
                'attachmentType' => $attachmentType,
                'attachmentUrl' => $attachmentUrl,
                'attachmentName' => $attachmentName
            ]
        ];

        // Send to all users in room
        $this->broadcastToRoom($roomId, $messageData);
    }

    private function handleMarkAsRead($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $roomId = $data['roomId'] ?? null;
        if (!$roomId) return;

        $sql = "UPDATE chat_message SET is_read = 1 WHERE chat_room_id = ? AND from_user_id != ? AND is_read = 0";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId, $userId]);

        $this->send($client, ['type' => 'markAsReadSuccess', 'roomId' => $roomId]);
    }

    private function handleGetUsers($client)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $sql = "SELECT id, user_name, first_name, last_name FROM user WHERE is_active = 1 AND deleted = 0 AND id != ? ORDER BY first_name, last_name";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$userId]);
        $users = $stmt->fetchAll();

        $result = [];
        foreach ($users as $user) {
            $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            if (empty($name)) $name = $user['user_name'];
            $result[] = [
                'id' => $user['id'],
                'name' => $name,
                'userName' => $user['user_name']
            ];
        }

        $this->send($client, ['type' => 'users', 'users' => $result]);
    }

    private function handleCreateRoom($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $name = $data['name'] ?? null;
        $type = $data['roomType'] ?? $data['type'] ?? 'group';
        $participantIds = $data['participantIds'] ?? [];

        if (!$name) return;

        if (!in_array($userId, $participantIds)) {
            $participantIds[] = $userId;
        }

        $roomId = $this->generateId();
        $now = date('Y-m-d H:i:s');

        $sql = "INSERT INTO chat_room (id, name, type, created_at, deleted) VALUES (?, ?, ?, ?, 0)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId, $name, $type, $now]);

        $insertSql = "INSERT IGNORE INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $insertStmt = $this->pdo->prepare($insertSql);
        foreach ($participantIds as $pid) {
            if ($pid) $insertStmt->execute([$roomId, $pid]);
        }

        $this->send($client, ['type' => 'roomCreated', 'room' => ['id' => $roomId, 'name' => $name, 'type' => $type]]);

        // Notify all participants
        foreach ($participantIds as $pid) {
            $this->sendToUser($pid, ['type' => 'roomUpdate']);
        }
    }

    private function handleGetParticipants($client, $data)
    {
        $roomId = $data['roomId'] ?? null;
        if (!$roomId) return;

        $sql = "
            SELECT u.id, u.user_name, u.first_name, u.last_name
            FROM user u
            INNER JOIN chat_room_user cru ON u.id = cru.user_id
            WHERE cru.chat_room_id = ? AND u.deleted = 0 AND cru.deleted = 0
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId]);
        $participants = $stmt->fetchAll();

        $result = [];
        foreach ($participants as $p) {
            $name = trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));
            if (empty($name)) $name = $p['user_name'];
            $result[] = ['id' => $p['id'], 'name' => $name];
        }

        $this->send($client, ['type' => 'participants', 'roomId' => $roomId, 'participants' => $result]);
    }

    private function handleAddParticipants($client, $data)
    {
        $roomId = $data['roomId'] ?? null;
        $participantIds = $data['participantIds'] ?? [];

        if (!$roomId || empty($participantIds)) return;

        $sql = "INSERT IGNORE INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $stmt = $this->pdo->prepare($sql);
        foreach ($participantIds as $pid) {
            $stmt->execute([$roomId, $pid]);
        }

        $this->send($client, ['type' => 'participantsAdded', 'roomId' => $roomId]);
        $this->broadcastToRoom($roomId, ['type' => 'roomUpdate']);
    }

    private function handleRemoveParticipant($client, $data)
    {
        $roomId = $data['roomId'] ?? null;
        $participantId = $data['userId'] ?? null;

        if (!$roomId || !$participantId) return;

        $sql = "UPDATE chat_room_user SET deleted = 1 WHERE chat_room_id = ? AND user_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId, $participantId]);

        $this->send($client, ['type' => 'participantRemoved', 'roomId' => $roomId]);
        $this->broadcastToRoom($roomId, ['type' => 'roomUpdate']);
    }

    private function handleEditMessage($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $messageId = $data['messageId'] ?? null;
        $newText = $data['message'] ?? null;

        if (!$messageId || !$newText) return;

        $sql = "UPDATE chat_message SET message = ?, is_edited = 1, edited_at = NOW() WHERE id = ? AND from_user_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$newText, $messageId, $userId]);

        // Get room ID
        $roomSql = "SELECT chat_room_id FROM chat_message WHERE id = ?";
        $roomStmt = $this->pdo->prepare($roomSql);
        $roomStmt->execute([$messageId]);
        $row = $roomStmt->fetch();

        if ($row) {
            $this->broadcastToRoom($row['chat_room_id'], ['type' => 'messageEdited', 'messageId' => $messageId, 'roomId' => $row['chat_room_id']]);
        }
    }

    private function handleDeleteMessage($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $messageId = $data['messageId'] ?? null;
        if (!$messageId) return;

        // Get room ID first
        $roomSql = "SELECT chat_room_id FROM chat_message WHERE id = ?";
        $roomStmt = $this->pdo->prepare($roomSql);
        $roomStmt->execute([$messageId]);
        $row = $roomStmt->fetch();

        $sql = "UPDATE chat_message SET deleted = 1 WHERE id = ? AND from_user_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$messageId, $userId]);

        if ($row) {
            $this->broadcastToRoom($row['chat_room_id'], ['type' => 'messageDeleted', 'messageId' => $messageId, 'roomId' => $row['chat_room_id']]);
        }
    }

    private function handleReactToMessage($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $messageId = $data['messageId'] ?? null;
        $emoji = $data['emoji'] ?? null;

        if (!$messageId || !$emoji) return;

        $sql = "SELECT reactions, chat_room_id FROM chat_message WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$messageId]);
        $row = $stmt->fetch();

        $reactions = $row && $row['reactions'] ? json_decode($row['reactions'], true) : [];

        if (!isset($reactions[$emoji])) {
            $reactions[$emoji] = [];
        }

        $key = array_search($userId, $reactions[$emoji]);
        if ($key !== false) {
            unset($reactions[$emoji][$key]);
            $reactions[$emoji] = array_values($reactions[$emoji]);
            if (empty($reactions[$emoji])) {
                unset($reactions[$emoji]);
            }
        } else {
            $reactions[$emoji][] = $userId;
        }

        $updateSql = "UPDATE chat_message SET reactions = ? WHERE id = ?";
        $updateStmt = $this->pdo->prepare($updateSql);
        $updateStmt->execute([json_encode($reactions), $messageId]);

        if ($row) {
            $this->broadcastToRoom($row['chat_room_id'], ['type' => 'messageReaction', 'messageId' => $messageId, 'roomId' => $row['chat_room_id'], 'reactions' => $reactions]);
        }
    }

    private function handlePinMessage($client, $data)
    {
        $messageId = $data['messageId'] ?? null;
        $pinned = $data['pinned'] ?? true;

        if (!$messageId) return;

        $roomSql = "SELECT chat_room_id FROM chat_message WHERE id = ?";
        $roomStmt = $this->pdo->prepare($roomSql);
        $roomStmt->execute([$messageId]);
        $row = $roomStmt->fetch();

        $sql = "UPDATE chat_message SET is_pinned = ? WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$pinned ? 1 : 0, $messageId]);

        if ($row) {
            $this->broadcastToRoom($row['chat_room_id'], ['type' => 'messagePinned', 'messageId' => $messageId, 'roomId' => $row['chat_room_id'], 'pinned' => $pinned]);
        }
    }

    private function handleTyping($client, $data)
    {
        $userId = $this->getUserId($client);
        if (!$userId) return;

        $roomId = $data['roomId'] ?? null;
        $isTyping = $data['isTyping'] ?? false;

        if (!$roomId) return;

        // Get user name
        $sql = "SELECT user_name, first_name, last_name FROM user WHERE id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        $userName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
        if (empty($userName)) $userName = $user['user_name'] ?? 'Unknown';

        $this->broadcastToRoom($roomId, [
            'type' => 'typing',
            'roomId' => $roomId,
            'userId' => $userId,
            'userName' => $userName,
            'isTyping' => $isTyping
        ], $userId); // Exclude sender
    }

    // === HELPERS ===

    private function getOrCreateDirectRoom($user1Id, $user2Id)
    {
        // Find existing direct room
        $sql = "
            SELECT cr.id 
            FROM chat_room cr
            INNER JOIN chat_room_user cru1 ON cr.id = cru1.chat_room_id AND cru1.user_id = ? AND cru1.deleted = 0
            INNER JOIN chat_room_user cru2 ON cr.id = cru2.chat_room_id AND cru2.user_id = ? AND cru2.deleted = 0
            WHERE cr.type = 'direct' AND cr.deleted = 0
            LIMIT 1
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$user1Id, $user2Id]);
        $row = $stmt->fetch();

        if ($row) return $row['id'];

        // Create new direct room
        $userSql = "SELECT user_name, first_name, last_name FROM user WHERE id IN (?, ?)";
        $userStmt = $this->pdo->prepare($userSql);
        $userStmt->execute([$user1Id, $user2Id]);
        $users = $userStmt->fetchAll();

        $names = [];
        foreach ($users as $u) {
            $name = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            if (empty($name)) $name = $u['user_name'];
            $names[] = $name;
        }

        $roomId = $this->generateId();
        $roomName = implode(' - ', $names);
        $now = date('Y-m-d H:i:s');

        $sql = "INSERT INTO chat_room (id, name, type, created_at, deleted) VALUES (?, ?, 'direct', ?, 0)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId, $roomName, $now]);

        $insertSql = "INSERT IGNORE INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $insertStmt = $this->pdo->prepare($insertSql);
        $insertStmt->execute([$roomId, $user1Id]);
        $insertStmt->execute([$roomId, $user2Id]);

        return $roomId;
    }

    private function broadcastToRoom($roomId, $data, $excludeUserId = null)
    {
        // Get all users in room
        $sql = "SELECT user_id FROM chat_room_user WHERE chat_room_id = ? AND deleted = 0";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$roomId]);
        $users = $stmt->fetchAll();

        foreach ($users as $user) {
            if ($excludeUserId && $user['user_id'] === $excludeUserId) continue;
            $this->sendToUser($user['user_id'], $data);
        }
    }

    private function sendToUser($userId, $data)
    {
        if (!isset($this->userConnections[$userId])) return;

        foreach ($this->userConnections[$userId] as $client) {
            if (is_resource($client)) {
                $this->send($client, $data);
            }
        }
    }
}

// Run server
$server = new ChatWebSocketServer();
$server->run();
