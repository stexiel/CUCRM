<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<div class="whatsapp-container">
    <!-- Sidebar with chat list -->
    <div class="sidebar">
        <div class="sidebar-header">
            <div class="header-icons">
                <button class="icon-btn" id="newChatBtn" title="Новый чат"><i class="fas fa-plus"></i></button>
                <button class="icon-btn" id="newGroupBtn" title="Новая группа"><i class="fas fa-users"></i></button>
            </div>
        </div>
        
        <div class="search-container">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Поиск или новый чат" id="searchInput">
            </div>
        </div>
        
        <div class="chat-list" id="chatList">
            <!-- Chat items will be dynamically added here -->
        </div>
    </div>
    
    <!-- Main chat area -->
    <div class="chat-area">
        <div class="chat-header">
            <div class="chat-header-info">
                <div class="chat-header-text">
                    <h3 id="chatName">Выберите чат</h3>
                    <span class="chat-status" id="chatStatus">онлайн</span>
                </div>
            </div>
            <div class="chat-header-actions">
                <button class="icon-btn" id="manageParticipantsBtn" title="Управление участниками" style="display:none;"><i class="fas fa-user-cog"></i></button>
                <button class="icon-btn" id="groupInfoBtn" title="Информация"><i class="fas fa-info-circle"></i></button>
            </div>
        </div>
        
        <div class="messages-container" id="messagesContainer">
            <div class="no-chat-selected">
                <i class="fas fa-comments"></i>
                <h2>CU CRM Chat</h2>
                <p>Выберите чат из списка или создайте новый</p>
            </div>
        </div>
        
        <div class="message-input-container">
            <button class="icon-btn" id="emojiBtn" title="Стикеры"><i class="fas fa-sticky-note"></i></button>
            <button class="icon-btn" id="attachBtn" title="Прикрепить"><i class="fas fa-paperclip"></i></button>
            <div class="message-input-wrapper">
                <input type="text" placeholder="Введите сообщение" id="messageInput" autocomplete="off">
            </div>
            <button class="send-btn" id="sendBtn" title="Отправить">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>
    
    <!-- Emoji Picker -->
    <div class="emoji-picker" id="emojiPicker" style="display: none;">
        <div class="emoji-grid" id="emojiGrid">
            <!-- Emojis will be populated by JavaScript -->
        </div>
    </div>
    
    <!-- Group Info Panel -->
    <div class="group-info-panel" id="groupInfoPanel" style="display: none;">
        <div class="group-info-header">
            <h3>Информация о группе</h3>
            <button class="icon-btn" id="closeGroupInfo"><i class="fas fa-times"></i></button>
        </div>
        <div class="group-info-body">
            <div class="group-info-section">
                <h4>Участники</h4>
                <div id="groupParticipantsList"></div>
            </div>
            <div class="group-info-section">
                <button class="btn-add-participants" id="addParticipantsBtn">
                    <i class="fas fa-user-plus"></i> Добавить участников
                </button>
            </div>
        </div>
    </div>
    
    <!-- New Group Modal -->
    <div class="modal" id="newGroupModal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Новая группа</h3>
                <button class="icon-btn" id="closeModal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Название группы:</label>
                    <input type="text" id="groupNameInput" placeholder="Введите название группы">
                </div>
                <div class="form-group">
                    <label>Участники:</label>
                    <div class="participants-select" id="participantsSelect">
                        <!-- Available contacts will be listed here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" id="cancelGroupBtn">Отмена</button>
                <button class="btn-create" id="createGroupBtn">Создать</button>
            </div>
        </div>
    </div>
</div>

<style>
* {
    box-sizing: border-box;
}

/* Полностью фиксированный чат */
.whatsapp-container {
    display: flex;
    height: calc(100vh - 120px);
    position: fixed !important;
    top: 70px;
    left: 260px;
    right: 20px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
    z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Sidebar Styles */
.sidebar {
    width: 280px;
    min-width: 250px;
    background: #fff;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e0e0e0;
    flex-shrink: 0;
}

.sidebar-header {
    background: #f0f2f5;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
    border-bottom: 1px solid #ddd;
}

.header-icons {
    display: flex;
    gap: 20px;
}

.icon-btn {
    background: none;
    border: none;
    color: #54656f;
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: background 0.2s;
}

.icon-btn:hover {
    background: #f0f2f5;
}

/* Search Box */
.search-container {
    padding: 10px 12px;
    background: #fff;
}

.search-box {
    background: #f0f2f5;
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.search-box i {
    color: #54656f;
    font-size: 14px;
}

.search-box input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    color: #111b21;
    font-size: 14px;
}

/* Chat List */
.chat-list {
    flex: 1;
    overflow-y: auto;
    background: #fff;
}

.chat-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f0f2f5;
    transition: background 0.2s;
}

.chat-item:hover {
    background: #f5f5f5;
}

.chat-item.active {
    background: #f0f2f5;
}

.chat-item-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #dfe5e7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #54656f;
    margin-right: 12px;
    flex-shrink: 0;
}

.chat-item-content {
    flex: 1;
    min-width: 0;
}

.chat-item-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
}

.chat-item-name {
    font-size: 16px;
    font-weight: 500;
    color: #111b21;
}

.chat-item-time {
    font-size: 12px;
    color: #667781;
}

.chat-item-message {
    font-size: 14px;
    color: #667781;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-item-unread {
    background: #25d366;
    color: #fff;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
    margin-left: 8px;
}

/* Chat Area */
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #efeae2;
}

.chat-header {
    background: #f0f2f5;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
    border-bottom: 1px solid #ddd;
}

.chat-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.chat-header-text h3 {
    margin: 0;
    font-size: 16px;
    color: #111b21;
}

.chat-status {
    font-size: 13px;
    color: #667781;
}

.chat-header-actions {
    display: flex;
    gap: 20px;
}

/* Messages Container */
.messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background: #efeae2;
}

.no-chat-selected {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #667781;
}

.no-chat-selected i {
    font-size: 100px;
    margin-bottom: 20px;
    opacity: 0.3;
}

.no-chat-selected h2 {
    margin: 0 0 10px 0;
    font-weight: 300;
}

.no-chat-selected p {
    margin: 0;
    font-size: 14px;
}

.message {
    display: flex;
    margin-bottom: 12px;
    animation: fadeIn 0.3s;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.message.sent {
    justify-content: flex-end;
}

/* Manage Participants Dialog */
.manage-participants-container {
    max-height: 500px;
    overflow-y: auto;
}

.participants-list {
    padding: 10px 0;
}

.participant-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 15px;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
}

.participant-item:hover {
    background-color: #f5f5f5;
}

.participant-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.participant-name {
    font-size: 14px;
    font-weight: 500;
}

.participant-toggle {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
}

.participant-toggle.btn-success {
    background-color: #25d366;
    color: white;
}

.participant-toggle.btn-success:hover {
    background-color: #20ba5a;
}

.participant-toggle.btn-danger {
    background-color: #dc3545;
    color: white;
}

.participant-toggle.btn-danger:hover {
    background-color: #c82333;
}

.message.received {
    justify-content: flex-start;
}

.message-bubble {
    max-width: 65%;
    padding: 6px 7px 8px 9px;
    border-radius: 7.5px;
    position: relative;
}

.message.sent .message-bubble {
    background: #d9fdd3;
}

.message.received .message-bubble {
    background: #fff;
}

.message-sender {
    font-size: 12px;
    font-weight: 600;
    color: #667781;
    margin-bottom: 4px;
}

.message-text {
    font-size: 14px;
    color: #111b21;
    word-wrap: break-word;
    margin-bottom: 4px;
}

.message-time {
    font-size: 11px;
    color: #667781;
    text-align: right;
}

/* Message Input */
.message-input-container {
    background: #f0f2f5;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.message-input-wrapper {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    padding: 10px 15px;
}

.message-input-wrapper input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 15px;
    color: #111b21;
}

.send-btn {
    background: #25d366;
    border: none;
    color: #fff;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: background 0.2s;
}

.send-btn:hover {
    background: #20bd5f;
}

/* Emoji Picker */
.emoji-picker {
    position: fixed;
    bottom: 80px;
    left: 380px;
    width: 350px;
    height: 400px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
}

.emoji-picker-header {
    padding: 10px;
    border-bottom: 1px solid #ddd;
}

.emoji-picker-header h4 {
    margin: 0;
    font-size: 14px;
}

.emoji-grid {
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 5px;
    overflow-y: auto;
    height: calc(100% - 50px);
}

.emoji-item {
    font-size: 24px;
    cursor: pointer;
    padding: 5px;
    text-align: center;
    border-radius: 4px;
    transition: background 0.2s;
}

.emoji-item:hover {
    background: #f0f2f5;
}

/* Modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.modal-content {
    background: #fff;
    border-radius: 8px;
    width: 500px;
    max-width: 90%;
}

.modal-header {
    padding: 15px 20px;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
    flex: 1;
}

.modal-header .icon-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
}

.modal-header .icon-btn:hover {
    background: #f0f0f0;
}

.modal-header .icon-btn i {
    font-size: 18px;
    color: #666;
}

.modal-body {
    padding: 20px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
}

.form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.participants-select {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
}

.participant-item {
    padding: 8px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
}

.participant-item:hover {
    background: #f0f2f5;
}

.participant-item input {
    margin-right: 10px;
}

.modal-footer {
    padding: 15px 20px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-cancel, .btn-create {
    padding: 8px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.btn-cancel {
    background: #f0f2f5;
    color: #54656f;
}

.btn-create {
    background: #25d366;
    color: #fff;
}

.btn-cancel:hover {
    background: #e4e6eb;
}

.btn-create:hover {
    background: #20bd5f;
}

.btn-create:disabled {
    background: #ccc;
    cursor: not-allowed;
}

/* Group Info Panel */
.group-info-panel {
    position: fixed;
    right: 0;
    top: 0;
    width: 350px;
    height: 100vh;
    background: #fff;
    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
    z-index: 1001;
    transform: translateX(100%);
    transition: transform 0.3s;
}

.group-info-panel.active {
    transform: translateX(0);
}

.group-info-header {
    background: #f0f2f5;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ddd;
}

.group-info-header h3 {
    margin: 0;
    font-size: 18px;
    color: #111b21;
}

.group-info-body {
    padding: 20px;
    overflow-y: auto;
    height: calc(100vh - 70px);
}

.group-info-section {
    margin-bottom: 20px;
}

.group-info-section h4 {
    margin: 0 0 15px 0;
    font-size: 14px;
    color: #667781;
    text-transform: uppercase;
}

.participant-list-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 8px;
}

.participant-list-item:hover {
    background: #f0f2f5;
}

.participant-list-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #dfe5e7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #54656f;
    margin-right: 12px;
}

.participant-list-name {
    flex: 1;
    font-size: 16px;
    color: #111b21;
}

.btn-add-participants {
    width: 100%;
    padding: 12px;
    background: #25d366;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-add-participants:hover {
    background: #20ba5a;
}

/* Search Users Section */
.search-users-section {
    border-top: 1px solid #f0f2f5;
    padding-top: 8px;
}

.search-section-title {
    padding: 8px 16px;
    font-size: 14px;
    color: #667781;
    font-weight: 600;
}

/* Contact Item for Group Creation */
.contact-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: background 0.2s;
}

.contact-item:hover {
    background: #f0f2f5;
}

.contact-item input[type="checkbox"] {
    margin: 0 12px 0 0;
    cursor: pointer;
    width: 18px;
    height: 18px;
}

.contact-item label {
    display: flex;
    align-items: center;
    cursor: pointer;
    flex: 1;
    margin: 0;
}

.contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #dfe5e7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #54656f;
    margin-right: 12px;
    flex-shrink: 0;
}

.contact-item label span {
    font-size: 15px;
    color: #111b21;
}

.participants-select {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 8px;
    background: #fff;
}

/* Message Context Menu */
.message-context-menu {
    position: fixed;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 2000;
    min-width: 200px;
}

.message-context-menu .menu-item {
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
}

.message-context-menu .menu-item:hover {
    background: #f0f2f5;
}

.message-context-menu .menu-item i {
    width: 20px;
    color: #54656f;
}

/* Message Reply */
.message-reply {
    background: rgba(0,0,0,0.05);
    border-left: 3px solid #25d366;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 4px;
    cursor: pointer;
}

.message-reply:hover {
    background: rgba(0,0,0,0.08);
}

.message-reply i {
    color: #25d366;
    margin-right: 8px;
}

.message-reply span {
    font-weight: 600;
    color: #25d366;
}

.message-reply p {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: #667781;
}

/* Message Reactions */
.message-reactions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
}

.reaction-item {
    background: #f0f2f5;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 14px;
    cursor: pointer;
}

.reaction-item:hover {
    background: #e4e6eb;
}

/* Reaction Picker */
.reaction-picker {
    position: fixed;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 8px;
    display: flex;
    gap: 8px;
    z-index: 2000;
}

.reaction-emoji {
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
}

.reaction-emoji:hover {
    background: #f0f2f5;
}

/* Message Footer */
.message-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
}

/* Read Status */
.read-status {
    font-size: 14px;
    color: #667781;
}

.read-status.read {
    color: #53bdeb;
}

/* Edited Indicator */
.edited-indicator {
    font-size: 11px;
    color: #667781;
    font-style: italic;
}

/* Message Menu Button */
.message-menu-btn {
    position: absolute;
    right: -30px;
    top: 50%;
    transform: translateY(-50%);
    background: #f0f2f5;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
}

.message:hover .message-menu-btn {
    opacity: 1;
}

.message-menu-btn:hover {
    background: #e4e6eb;
}

/* Pinned Message */
.message.pinned {
    background: rgba(37, 211, 102, 0.1);
    border-radius: 8px;
    padding: 4px;
}

/* Reply Preview */
.reply-preview, .edit-preview {
    background: #f0f2f5;
    padding: 8px 12px;
    margin-bottom: 8px;
    border-left: 3px solid #25d366;
    display: flex;
    align-items: center;
    gap: 12px;
}

.reply-preview i, .edit-preview i {
    color: #25d366;
}

.reply-preview div {
    flex: 1;
}

.reply-preview strong {
    color: #25d366;
    font-size: 14px;
}

.reply-preview p {
    margin: 2px 0 0 0;
    font-size: 13px;
    color: #667781;
}

.cancel-reply, .cancel-edit {
    background: none;
    border: none;
    cursor: pointer;
    color: #54656f;
    padding: 4px;
}

.cancel-reply:hover, .cancel-edit:hover {
    color: #111b21;
}

/* Highlight Animation */
.message.highlight {
    animation: highlight 2s ease;
}

@keyframes highlight {
    0%, 100% { background: transparent; }
    50% { background: rgba(37, 211, 102, 0.3); }
}

/* Message Image */
.message-image {
    margin-bottom: 8px;
}

.message-image img {
    max-width: 300px;
    max-height: 300px;
    border-radius: 8px;
    cursor: pointer;
}

.message-image img:hover {
    opacity: 0.9;
}

/* Message Avatar */
.message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    flex-shrink: 0;
    margin-right: 8px;
    align-self: flex-end;
}

.message.received {
    display: flex;
    align-items: flex-end;
}

.message.sent {
    justify-content: flex-end;
}

/* Sticker Picker Styles */
.sticker-tabs {
    display: flex;
    border-bottom: 1px solid #ddd;
    padding: 8px;
    gap: 4px;
}

.sticker-tab {
    padding: 8px 16px;
    border: none;
    background: #f0f2f5;
    border-radius: 20px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
}

.sticker-tab.active {
    background: #25d366;
    color: white;
}

.sticker-tab:hover:not(.active) {
    background: #e0e0e0;
}

.sticker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 12px;
    max-height: 250px;
    overflow-y: auto;
}

.sticker-item {
    width: 50px;
    height: 50px;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
    font-size: 28px;
}

.sticker-item:hover {
    transform: scale(1.2);
    background: #f0f2f5;
}

/* Sticker in message */
.message-sticker img {
    max-width: 120px;
    max-height: 120px;
}

/* Search highlight */
.message.search-highlight {
    background: rgba(255, 235, 59, 0.3) !important;
    border-left: 3px solid #ffc107;
}

.search-results-info {
    text-align: center;
    padding: 8px;
    background: #e3f2fd;
    color: #1976d2;
    font-size: 12px;
    border-radius: 4px;
    margin-bottom: 10px;
}
