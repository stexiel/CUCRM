<?php

namespace Espo\Custom\Hooks\User;

use Espo\ORM\Entity;
use Espo\Core\Hook\Hook\AfterSave;
use Espo\ORM\Repository\Option\SaveOptions;

class AddToGeneralGroup implements AfterSave
{
    public function afterSave(Entity $entity, SaveOptions $options): void
    {
        // Only for new users
        if (!$entity->isNew()) {
            return;
        }
        
        // Only for active users
        if (!$entity->get('isActive')) {
            return;
        }
        
        $entityManager = $this->entityManager ?? \Espo\Core\Container::getInstance()->get('entityManager');
        $pdo = $entityManager->getPDO();
        
        // Find "Общая группа"
        $stmt = $pdo->prepare("
            SELECT id FROM chat_room 
            WHERE name = 'Общая группа' AND type = 'group' AND deleted = 0 
            LIMIT 1
        ");
        $stmt->execute();
        $room = $stmt->fetch(\PDO::FETCH_ASSOC);
        
        if (!$room) {
            return;
        }
        
        $roomId = $room['id'];
        $userId = $entity->getId();
        
        // Check if already added
        $checkStmt = $pdo->prepare("
            SELECT id FROM chat_room_user 
            WHERE chat_room_id = ? AND user_id = ? AND deleted = 0
        ");
        $checkStmt->execute([$roomId, $userId]);
        
        if ($checkStmt->fetch()) {
            return; // Already in group
        }
        
        // Add user to general group
        $insertStmt = $pdo->prepare("
            INSERT INTO chat_room_user (chat_room_id, user_id, deleted)
            VALUES (?, ?, 0)
        ");
        $insertStmt->execute([$roomId, $userId]);
        
        error_log("User {$entity->get('userName')} automatically added to General Group");
    }
    
    private $entityManager;
    
    public function __construct(\Espo\ORM\EntityManager $entityManager)
    {
        $this->entityManager = $entityManager;
    }
}
