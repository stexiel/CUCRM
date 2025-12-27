<?php

namespace Espo\Custom\Controllers;

use Espo\Core\Controllers\Base;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\ORM\EntityManager;
use Espo\Entities\User;

class Chat extends Base
{
    private $entityManager;
    protected $user;
    
    public function __construct(EntityManager $entityManager, User $user)
    {
        $this->entityManager = $entityManager;
        $this->user = $user;
    }
    
    protected function getUser(): User
    {
        return $this->user;
    }
    
    public function getActionRooms(Request $request, Response $response): array
    {
        $userId = $this->getUser()->getId();
        $entityManager = $this->entityManager;
        $pdo = $entityManager->getPDO();
        
        // Get all chat rooms for current user using SQL
        $sql = "
            SELECT DISTINCT cr.* 
            FROM chat_room cr
            INNER JOIN chat_room_user cru ON cr.id = cru.chat_room_id
            WHERE cru.user_id = ? AND cr.deleted = 0 AND cru.deleted = 0
            ORDER BY cr.created_at DESC
        ";
        
        $sth = $pdo->prepare($sql);
        $sth->execute([$userId]);
        $roomsData = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        $result = [];
        foreach ($roomsData as $roomData) {
            $roomId = $roomData['id'];
            
            // Get last message
            $msgSql = "SELECT message, created_at FROM chat_message WHERE chat_room_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 1";
            $msgSth = $pdo->prepare($msgSql);
            $msgSth->execute([$roomId]);
            $lastMsg = $msgSth->fetch(\PDO::FETCH_ASSOC);
            
            // Get unread count
            $unreadSql = "SELECT COUNT(*) as cnt FROM chat_message WHERE chat_room_id = ? AND to_user_id = ? AND is_read = 0 AND deleted = 0";
            $unreadSth = $pdo->prepare($unreadSql);
            $unreadSth->execute([$roomId, $userId]);
            $unreadData = $unreadSth->fetch(\PDO::FETCH_ASSOC);
            
            // Get participants
            $partSql = "
                SELECT u.id, u.user_name, u.first_name, u.last_name
                FROM user u
                INNER JOIN chat_room_user cru ON u.id = cru.user_id
                WHERE cru.chat_room_id = ? AND u.deleted = 0 AND cru.deleted = 0
            ";
            $partSth = $pdo->prepare($partSql);
            $partSth->execute([$roomId]);
            $participants = $partSth->fetchAll(\PDO::FETCH_ASSOC);
            
            $participantsList = [];
            foreach ($participants as $p) {
                $name = trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));
                if (empty($name)) {
                    $name = $p['user_name'];
                }
                $participantsList[] = [
                    'id' => $p['id'],
                    'name' => $name,
                    'userName' => $p['user_name']
                ];
            }
            
            $result[] = [
                'id' => $roomId,
                'name' => $roomData['name'],
                'type' => $roomData['type'],
                'lastMessage' => $lastMsg ? $lastMsg['message'] : null,
                'lastMessageTime' => $lastMsg ? $lastMsg['created_at'] : null,
                'unreadCount' => (int)($unreadData['cnt'] ?? 0),
                'participants' => $participantsList,
                'createdAt' => $roomData['created_at'],
                'pinned' => $roomData['name'] === 'Общая группа'
            ];
        }
        
        return $result;
    }
    
    public function getActionMessages(Request $request, Response $response): array
    {
        $roomId = $request->getQueryParam('roomId');
        $offset = $request->getQueryParam('offset') ?? 0;
        $limit = $request->getQueryParam('limit') ?? 50;
        
        if (!$roomId) {
            throw new \Espo\Core\Exceptions\BadRequest('Room ID is required');
        }
        
        $entityManager = $this->entityManager;
        $pdo = $entityManager->getPDO();
        
        // Get messages using SQL
        $sql = "
            SELECT cm.*, u.user_name, u.first_name, u.last_name,
                   ru.user_name as reply_user_name, ru.first_name as reply_first_name, ru.last_name as reply_last_name
            FROM chat_message cm
            LEFT JOIN user u ON cm.from_user_id = u.id
            LEFT JOIN chat_message reply_msg ON cm.reply_to_id = reply_msg.id
            LEFT JOIN user ru ON reply_msg.from_user_id = ru.id
            WHERE cm.chat_room_id = ? AND cm.deleted = 0
            ORDER BY cm.created_at ASC
            LIMIT ? OFFSET ?
        ";
        
        $sth = $pdo->prepare($sql);
        $sth->bindValue(1, $roomId, \PDO::PARAM_STR);
        $sth->bindValue(2, (int)$limit, \PDO::PARAM_INT);
        $sth->bindValue(3, (int)$offset, \PDO::PARAM_INT);
        $sth->execute();
        $messages = $sth->fetchAll(\PDO::FETCH_ASSOC);
        
        $result = [];
        foreach ($messages as $msg) {
            $userName = trim(($msg['first_name'] ?? '') . ' ' . ($msg['last_name'] ?? ''));
            if (empty($userName)) {
                $userName = $msg['user_name'] ?? 'Unknown';
            }
            
            $replyUserName = null;
            if ($msg['reply_to_id']) {
                $replyUserName = trim(($msg['reply_first_name'] ?? '') . ' ' . ($msg['reply_last_name'] ?? ''));
                if (empty($replyUserName)) {
                    $replyUserName = $msg['reply_user_name'] ?? 'Unknown';
                }
            }
            
            $result[] = [
                'id' => $msg['id'],
                'message' => $msg['message'],
                'fromUserId' => $msg['from_user_id'],
                'fromUserName' => $userName,
                'toUserId' => $msg['to_user_id'],
                'isRead' => (bool)$msg['is_read'],
                'createdAt' => $msg['created_at'],
                'isEdited' => (bool)$msg['is_edited'],
                'editedAt' => $msg['edited_at'],
                'reactions' => $msg['reactions'] ? json_decode($msg['reactions'], true) : null,
                'isPinned' => (bool)$msg['is_pinned'],
                'replyToId' => $msg['reply_to_id'],
                'replyUserName' => $replyUserName,
                'attachmentType' => $msg['attachment_type'],
                'attachmentUrl' => $msg['attachment_url'],
                'attachmentName' => $msg['attachment_name']
            ];
        }
        
        return $result;
    }
    
    public function postActionSendMessage(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $roomId = $data->roomId ?? null;
        $message = $data->message ?? null;
        $toUserId = $data->toUserId ?? null;
        $replyToId = $data->replyToId ?? null;
        $attachmentType = $data->attachmentType ?? null;
        $attachmentUrl = $data->attachmentUrl ?? null;
        $attachmentName = $data->attachmentName ?? null;
        
        if (!$message && !$attachmentUrl) {
            throw new \Espo\Core\Exceptions\BadRequest('Message or attachment is required');
        }
        
        $entityManager = $this->entityManager;
        $userId = $this->getUser()->getId();
        
        // If no room ID, create or find direct chat room
        if (!$roomId && $toUserId) {
            $room = $this->getOrCreateDirectRoom($userId, $toUserId);
            $roomId = $room->getId();
        }
        
        if (!$roomId) {
            throw new \Espo\Core\Exceptions\BadRequest('Room ID or To User ID is required');
        }
        
        $messageData = [
            'message' => $message ?? '',
            'fromUserId' => $userId,
            'chatRoomId' => $roomId,
            'isRead' => false
        ];
        
        if ($replyToId) {
            $messageData['replyToId'] = $replyToId;
        }
        
        if ($attachmentType && $attachmentUrl) {
            $messageData['attachmentType'] = $attachmentType;
            $messageData['attachmentUrl'] = $attachmentUrl;
            $messageData['attachmentName'] = $attachmentName;
        }
        
        $chatMessage = $entityManager->createEntity('ChatMessage', $messageData);
        
        return [
            'id' => $chatMessage->getId(),
            'message' => $chatMessage->get('message'),
            'fromUserId' => $chatMessage->get('fromUserId'),
            'chatRoomId' => $chatMessage->get('chatRoomId'),
            'createdAt' => $chatMessage->get('createdAt'),
            'replyToId' => $chatMessage->get('replyToId'),
            'attachmentType' => $chatMessage->get('attachmentType'),
            'attachmentUrl' => $chatMessage->get('attachmentUrl'),
            'attachmentName' => $chatMessage->get('attachmentName')
        ];
    }
    
    public function postActionMarkAsRead(Request $request, Response $response): bool
    {
        $data = $request->getParsedBody();
        $messageId = $data->messageId ?? null;
        $roomId = $data->roomId ?? null;
        
        $entityManager = $this->entityManager;
        $userId = $this->getUser()->getId();
        
        if ($messageId) {
            $message = $entityManager->getEntity('ChatMessage', $messageId);
            if ($message && $message->get('toUserId') === $userId) {
                $message->set('isRead', true);
                $entityManager->saveEntity($message);
            }
        } elseif ($roomId) {
            // Mark all messages in room as read
            $messages = $entityManager
                ->getRDBRepository('ChatMessage')
                ->where([
                    'chatRoomId' => $roomId,
                    'toUserId' => $userId,
                    'isRead' => false
                ])
                ->find();
            
            foreach ($messages as $message) {
                $message->set('isRead', true);
                $entityManager->saveEntity($message);
            }
        }
        
        return true;
    }
    
    public function getActionParticipants(Request $request, Response $response): array
    {
        $roomId = $request->getQueryParam('roomId');
        
        if (!$roomId) {
            throw new \Espo\Core\Exceptions\BadRequest('Room ID is required');
        }
        
        $pdo = $this->entityManager->getPDO();
        
        $sql = "
            SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name
            FROM user u
            INNER JOIN chat_room_user cru ON cru.user_id = u.id
            WHERE cru.chat_room_id = ? AND cru.deleted = 0 AND u.deleted = 0
            ORDER BY u.first_name, u.last_name
        ";
        
        $sth = $pdo->prepare($sql);
        $sth->execute([$roomId]);
        
        return $sth->fetchAll(\PDO::FETCH_ASSOC);
    }
    
    public function postActionRemoveParticipant(Request $request, Response $response): bool
    {
        $data = $request->getParsedBody();
        $roomId = $data->roomId ?? null;
        $userId = $data->userId ?? null;
        
        if (!$roomId || !$userId) {
            throw new \Espo\Core\Exceptions\BadRequest('Room ID and User ID are required');
        }
        
        $pdo = $this->entityManager->getPDO();
        
        // Mark as deleted
        $sql = "UPDATE chat_room_user SET deleted = 1 WHERE chat_room_id = ? AND user_id = ?";
        $sth = $pdo->prepare($sql);
        $sth->execute([$roomId, $userId]);
        
        return true;
    }
    
    public function postActionCreateRoom(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $name = $data->name ?? null;
        $type = $data->type ?? 'group';
        $participantIds = $data->participantIds ?? [];
        
        // Convert to array if it's an object
        if (is_object($participantIds)) {
            $participantIds = (array)$participantIds;
        }
        
        // Ensure it's an array
        if (!is_array($participantIds)) {
            $participantIds = [];
        }
        
        error_log('Creating room: ' . $name . ' with participants: ' . json_encode($participantIds));
        
        if (!$name) {
            throw new \Espo\Core\Exceptions\BadRequest('Room name is required');
        }
        
        $entityManager = $this->entityManager;
        $userId = $this->getUser()->getId();
        $pdo = $entityManager->getPDO();
        
        // Add current user to participants
        if (!in_array($userId, $participantIds)) {
            $participantIds[] = $userId;
        }
        
        // Create room using direct SQL to avoid hooks
        $roomId = \Espo\Core\Utils\Util::generateId();
        $now = date('Y-m-d H:i:s');
        
        $insertRoomSql = "INSERT INTO chat_room (id, name, type, created_at, modified_at, deleted) VALUES (?, ?, ?, ?, ?, 0)";
        $insertRoomSth = $pdo->prepare($insertRoomSql);
        $insertRoomSth->execute([$roomId, $name, $type, $now, $now]);
        
        error_log('Room created with SQL: ' . $roomId);
        
        // Add participants using SQL
        $insertSql = "INSERT INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $insertSth = $pdo->prepare($insertSql);
        foreach ($participantIds as $participantId) {
            if ($participantId) {
                $insertSth->execute([$roomId, $participantId]);
                error_log('Added participant: ' . $participantId);
            }
        }
        
        return [
            'id' => $roomId,
            'name' => $name,
            'type' => $type
        ];
    }
    
    private function getOrCreateDirectRoom(string $user1Id, string $user2Id)
    {
        $entityManager = $this->entityManager;
        
        // Try to find existing direct room
        $pdo = $entityManager->getPDO();
        $sql = "
            SELECT cr.id 
            FROM chat_room cr
            INNER JOIN chat_room_user cru1 ON cr.id = cru1.chat_room_id AND cru1.user_id = ?
            INNER JOIN chat_room_user cru2 ON cr.id = cru2.chat_room_id AND cru2.user_id = ?
            WHERE cr.type = 'direct'
            AND cr.deleted = 0
            GROUP BY cr.id
            HAVING COUNT(DISTINCT cru1.user_id) = 2
        ";
        
        $sth = $pdo->prepare($sql);
        $sth->execute([$user1Id, $user2Id]);
        $roomId = $sth->fetchColumn();
        
        if ($roomId) {
            return $entityManager->getEntity('ChatRoom', $roomId);
        }
        
        // Create new direct room
        $user1 = $entityManager->getEntity('User', $user1Id);
        $user2 = $entityManager->getEntity('User', $user2Id);
        
        // Use full name (firstName + lastName) instead of userName
        $name1 = trim($user1->get('firstName') . ' ' . $user1->get('lastName'));
        if (empty($name1)) {
            $name1 = $user1->get('userName') ?? $user1->get('name');
        }
        
        $name2 = trim($user2->get('firstName') . ' ' . $user2->get('lastName'));
        if (empty($name2)) {
            $name2 = $user2->get('userName') ?? $user2->get('name');
        }
        
        $room = $entityManager->createEntity('ChatRoom', [
            'name' => $name1 . ' - ' . $name2,
            'type' => 'direct'
        ]);
        
        // Add participants using SQL
        $roomId = $room->getId();
        $insertSql = "INSERT INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $insertSth = $pdo->prepare($insertSql);
        $insertSth->execute([$roomId, $user1Id]);
        $insertSth->execute([$roomId, $user2Id]);
        
        return $room;
    }
    
    public function getActionUsers(Request $request, Response $response): array
    {
        $entityManager = $this->entityManager;
        $currentUserId = $this->getUser()->getId();
        
        $users = $entityManager
            ->getRDBRepository('User')
            ->where([
                'isActive' => true,
                'id!=' => $currentUserId
            ])
            ->order('name', 'ASC')
            ->find();
        
        $result = [];
        foreach ($users as $user) {
            $result[] = [
                'id' => $user->getId(),
                'name' => $user->get('name'),
                'userName' => $user->get('userName'),
                'emailAddress' => $user->get('emailAddress')
            ];
        }
        
        return $result;
    }
    
    public function postActionAddParticipants(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $roomId = $data->roomId ?? null;
        $participantIds = $data->participantIds ?? [];
        
        if (!$roomId || empty($participantIds)) {
            throw new \Espo\Core\Exceptions\BadRequest('Room ID and participant IDs are required');
        }
        
        $entityManager = $this->entityManager;
        $pdo = $entityManager->getPDO();
        
        // Add participants using SQL
        $insertSql = "INSERT IGNORE INTO chat_room_user (chat_room_id, user_id, deleted) VALUES (?, ?, 0)";
        $insertSth = $pdo->prepare($insertSql);
        
        $added = 0;
        foreach ($participantIds as $participantId) {
            $insertSth->execute([$roomId, $participantId]);
            $added += $insertSth->rowCount();
        }
        
        return [
            'success' => true,
            'added' => $added
        ];
    }
    
    public function postActionEditMessage(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $messageId = $data->messageId ?? null;
        $newText = $data->message ?? null;
        
        if (!$messageId || !$newText) {
            throw new \Espo\Core\Exceptions\BadRequest('Message ID and new text are required');
        }
        
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        // Update message
        $sql = "UPDATE chat_message SET message = ?, is_edited = 1, edited_at = NOW() 
                WHERE id = ? AND from_user_id = ? AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$newText, $messageId, $userId]);
        
        return ['success' => true];
    }
    
    public function postActionDeleteMessage(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $messageId = $data->messageId ?? null;
        
        if (!$messageId) {
            throw new \Espo\Core\Exceptions\BadRequest('Message ID is required');
        }
        
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        // Soft delete message
        $sql = "UPDATE chat_message SET deleted = 1 WHERE id = ? AND from_user_id = ? AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$messageId, $userId]);
        
        return ['success' => true];
    }
    
    public function postActionReactToMessage(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $messageId = $data->messageId ?? null;
        $emoji = $data->emoji ?? null;
        
        if (!$messageId || !$emoji) {
            throw new \Espo\Core\Exceptions\BadRequest('Message ID and emoji are required');
        }
        
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        // Get current reactions
        $sql = "SELECT reactions FROM chat_message WHERE id = ? AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$messageId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        
        $reactions = $row && $row['reactions'] ? json_decode($row['reactions'], true) : [];
        
        // Toggle reaction
        if (!isset($reactions[$emoji])) {
            $reactions[$emoji] = [];
        }
        
        $key = array_search($userId, $reactions[$emoji]);
        if ($key !== false) {
            unset($reactions[$emoji][$key]);
            if (empty($reactions[$emoji])) {
                unset($reactions[$emoji]);
            }
        } else {
            $reactions[$emoji][] = $userId;
        }
        
        // Update reactions
        $sql = "UPDATE chat_message SET reactions = ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([json_encode($reactions), $messageId]);
        
        return ['success' => true, 'reactions' => $reactions];
    }
    
    public function postActionPinMessage(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $messageId = $data->messageId ?? null;
        $pinned = $data->pinned ?? true;
        
        if (!$messageId) {
            throw new \Espo\Core\Exceptions\BadRequest('Message ID is required');
        }
        
        $pdo = $this->entityManager->getPDO();
        
        $sql = "UPDATE chat_message SET is_pinned = ? WHERE id = ? AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$pinned ? 1 : 0, $messageId]);
        
        return ['success' => true];
    }
    
    public function postActionSetTyping(Request $request, Response $response): array
    {
        $data = $request->getParsedBody();
        $roomId = $data->roomId ?? null;
        $isTyping = $data->isTyping ?? false;
        
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        $sql = "UPDATE user SET is_typing_in_room = ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$isTyping ? $roomId : null, $userId]);
        
        return ['success' => true];
    }
    
    public function postActionUpdateOnlineStatus(Request $request, Response $response): array
    {
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        $sql = "UPDATE user SET is_online = 1, last_seen = NOW() WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$userId]);
        
        return ['success' => true];
    }
    
    public function getActionTypingUsers(Request $request, Response $response): array
    {
        $roomId = $request->getQueryParam('roomId');
        
        if (!$roomId) {
            return [];
        }
        
        $pdo = $this->entityManager->getPDO();
        $userId = $this->getUser()->getId();
        
        $sql = "SELECT id, user_name, first_name, last_name 
                FROM user 
                WHERE is_typing_in_room = ? AND id != ? AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$roomId, $userId]);
        $users = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        
        $result = [];
        foreach ($users as $user) {
            $userName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            if (empty($userName)) {
                $userName = $user['user_name'] ?? 'Unknown';
            }
            $result[] = ['id' => $user['id'], 'name' => $userName];
        }
        
        return $result;
    }
}
