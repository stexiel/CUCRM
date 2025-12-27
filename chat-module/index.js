define('custom:views/chat/index', ['view'], function (Dep) {

    return Dep.extend({

        template: 'custom:chat/index',

        data: function () {
            return {
                rooms: this.rooms || [],
                messages: this.messages || [],
                currentRoom: this.currentRoom,
                currentUser: {
                    id: this.getUser().id,
                    name: this.getUser().get('name')
                }
            };
        },

        setup: function () {
            this.rooms = [];
            this.messages = [];
            this.currentRoom = null;
            this.allRooms = [];
            this.replyingTo = null;
            this.editingMessage = null;
            this.typingUsers = {};
            
            this.wsConnected = false;
            this.wsReconnectAttempts = 0;
            this.wsMaxReconnectAttempts = 5;
            
            this.connectWebSocket();
        },
        
        connectWebSocket: function () {
            var self = this;
            var wsUrl = 'ws://localhost:8081';
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            try {
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = function () {
                    console.log('WebSocket connected');
                    self.wsConnected = true;
                    self.wsReconnectAttempts = 0;
                    
                    self.wsSend({
                        type: 'auth',
                        userId: self.getUser().id
                    });
                };
                
                this.ws.onmessage = function (event) {
                    self.handleWsMessage(event.data);
                };
                
                this.ws.onclose = function () {
                    console.log('WebSocket disconnected');
                    self.wsConnected = false;
                    self.attemptReconnect();
                };
                
                this.ws.onerror = function (error) {
                    console.error('WebSocket error:', error);
                };
            } catch (e) {
                console.error('Failed to create WebSocket:', e);
                this.attemptReconnect();
            }
        },
        
        attemptReconnect: function () {
            var self = this;
            if (this.wsReconnectAttempts < this.wsMaxReconnectAttempts) {
                this.wsReconnectAttempts++;
                console.log('Reconnecting... attempt', this.wsReconnectAttempts);
                setTimeout(function() { self.connectWebSocket(); }, 3000);
            } else {
                Espo.Ui.error('WebSocket connection failed. Please refresh the page.');
            }
        },
        
        wsSend: function (data) {
            if (this.ws && this.wsConnected) {
                console.log('Sending:', data.type);
                this.ws.send(JSON.stringify(data));
            } else {
                console.warn('WebSocket not connected, cannot send:', data.type);
            }
        },
        
        handleWsMessage: function (data) {
            var msg;
            try {
                msg = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
                return;
            }
            
            console.log('Received:', msg.type);
            
            switch (msg.type) {
                case 'authSuccess':
                    console.log('Authenticated as user:', msg.userId);
                    this.loadRooms();
                    break;
                    
                case 'rooms':
                    this.handleRoomsMessage(msg.rooms);
                    break;
                    
                case 'messages':
                    this.messages = msg.messages || [];
                    this.renderMessages();
                    this.scrollToBottom();
                    break;
                    
                case 'newMessage':
                    this.handleNewMessage(msg);
                    break;
                    
                case 'roomUpdate':
                case 'roomCreated':
                    this.loadRooms();
                    if (msg.room && msg.room.id) {
                        var self = this;
                        setTimeout(function() {
                            self.selectRoom(msg.room.id);
                        }, 500);
                    }
                    break;
                    
                case 'messageEdited':
                case 'messageDeleted':
                case 'messagePinned':
                case 'messageReaction':
                    if (this.currentRoom && this.currentRoom.id === msg.roomId) {
                        this.loadMessages(msg.roomId);
                    }
                    this.loadRooms();
                    break;
                    
                case 'typing':
                    this.handleTypingMessage(msg);
                    break;
                    
                case 'users':
                    if (this.pendingUsersCallback) {
                        this.pendingUsersCallback(msg.users);
                        this.pendingUsersCallback = null;
                    }
                    break;
                    
                case 'participants':
                    if (this.pendingParticipantsCallback) {
                        this.pendingParticipantsCallback(msg.participants);
                        this.pendingParticipantsCallback = null;
                    }
                    break;
                    
                case 'error':
                    console.error('WebSocket error:', msg.message);
                    Espo.Ui.error(msg.message);
                    break;
            }
        },
        
        handleRoomsMessage: function (rooms) {
            this.allRooms = rooms;
            this.rooms = rooms;
            this.renderRooms();
        },
        
        handleNewMessage: function (msg) {
            if (this.currentRoom && this.currentRoom.id === msg.roomId) {
                this.messages.push(msg.message);
                this.renderMessages();
                this.scrollToBottom();
                this.markRoomAsRead(msg.roomId);
            }
            this.loadRooms();
        },
        
        handleTypingMessage: function (msg) {
            if (!this.currentRoom || this.currentRoom.id !== msg.roomId) return;
            
            var $status = this.$el.find('#chatStatus');
            if (msg.isTyping) {
                this.typingUsers[msg.userId] = msg.userName;
            } else {
                delete this.typingUsers[msg.userId];
            }
            
            var typingNames = [];
            for (var userId in this.typingUsers) {
                typingNames.push(this.typingUsers[userId]);
            }
            
            if (typingNames.length > 0) {
                $status.text(typingNames.join(', ') + ' печатает...');
            } else {
                $status.text('онлайн');
            }
        },

        afterRender: function () {
            this.$messageInput = this.$el.find('#messageInput');
            this.$sendBtn = this.$el.find('#sendBtn');
            this.$chatList = this.$el.find('#chatList');
            this.$messagesContainer = this.$el.find('#messagesContainer');
            this.$newChatBtn = this.$el.find('#newChatBtn');
            this.$newGroupBtn = this.$el.find('#newGroupBtn');
            this.$chatName = this.$el.find('#chatName');
            this.$searchInput = this.$el.find('#searchInput');
            this.$emojiBtn = this.$el.find('#emojiBtn');
            this.$emojiPicker = this.$el.find('#emojiPicker');
            this.$groupInfoBtn = this.$el.find('#groupInfoBtn');
            this.$groupInfoPanel = this.$el.find('#groupInfoPanel');
            this.$closeGroupInfo = this.$el.find('#closeGroupInfo');
            this.$addParticipantsBtn = this.$el.find('#addParticipantsBtn');
            this.$manageParticipantsBtn = this.$el.find('#manageParticipantsBtn');
            
            this.$sendBtn.on('click', () => this.sendMessage());
            this.$messageInput.on('keypress', (e) => {
                if (e.which === 13) {
                    this.sendMessage();
                }
            });
            
            // Typing indicator
            let typingTimeout;
            this.$messageInput.on('input', () => {
                if (this.currentRoom) {
                    this.setTyping(true);
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        this.setTyping(false);
                    }, 3000);
                }
            });
            
            this.$newChatBtn.on('click', () => this.showNewChatDialog());
            this.$newGroupBtn.on('click', () => this.showNewGroupDialog());
            this.$searchInput.on('input', (e) => this.searchChats(e.target.value));
            this.$emojiBtn.on('click', () => this.toggleEmojiPicker());
            this.$groupInfoBtn.on('click', () => this.showGroupInfo());
            this.$closeGroupInfo.on('click', () => this.hideGroupInfo());
            this.$manageParticipantsBtn.on('click', () => this.showManageParticipantsDialog());
            this.$addParticipantsBtn.on('click', () => this.showAddParticipantsDialog());

            // Global delegated handlers for New Group modal buttons
            // Ensure they work even if modal is rendered outside this.$el
            $(document)
                .off('click.chatCreateGroup')
                .on('click.chatCreateGroup', '#createGroupBtn', (e) => {
                    e.preventDefault();
                    // Передаём событие, чтобы найти инпут в том же модальном окне
                    if (this.createNewGroup) {
                        this.createNewGroup(e);
                    }
                });

            $(document)
                .off('click.chatCancelGroup')
                .on('click.chatCancelGroup', '#cancelGroupBtn', (e) => {
                    e.preventDefault();
                    if (this.closeDialog) {
                        this.closeDialog();
                    }
                });
            
            // Image upload
            this.$el.find('#attachBtn').on('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => this.handleImageUpload(e.target.files[0]);
                input.click();
            });
            
            this.initEmojiPicker();
        },

        loadRooms: function () {
            this.wsSend({ type: 'loadRooms' });
        },


        loadMessages: function (roomId) {
            this.wsSend({ type: 'loadMessages', roomId: roomId });
        },
        
        markRoomAsRead: function (roomId) {
            this.wsSend({ type: 'markAsRead', roomId: roomId });
        },

        renderRooms: function () {
            if (!this.$chatList) return;
            
            let html = '';
            this.rooms.forEach(room => {
                const isActive = this.currentRoom && this.currentRoom.id === room.id;
                const unreadBadge = room.unreadCount > 0 ? 
                    `<span class="chat-item-unread">${room.unreadCount}</span>` : '';
                
                // Get display name (for direct chats, show only other person's name)
                const displayName = this.getChatDisplayName(room);
                const initials = displayName.substring(0, 2).toUpperCase();
                const time = room.lastMessageTime ? new Date(room.lastMessageTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '';
                
                html += `
                    <div class="chat-item ${isActive ? 'active' : ''}" data-id="${room.id}">
                        <div class="chat-item-avatar">${initials}</div>
                        <div class="chat-item-content">
                            <div class="chat-item-header">
                                <span class="chat-item-name">${this.escapeHtml(displayName)}</span>
                                <span class="chat-item-time">${time}</span>
                            </div>
                            <div class="chat-item-message">${this.escapeHtml(room.lastMessage || 'Нет сообщений')}${unreadBadge}</div>
                        </div>
                    </div>
                `;
            });
            
            this.$chatList.html(html);
            
            this.$chatList.find('.chat-item').on('click', (e) => {
                const roomId = $(e.currentTarget).data('id');
                this.selectRoom(roomId);
            });
        },
        
        getChatDisplayName: function (room) {
            // For direct chats, show only the other person's name
            if (room.type === 'direct' && room.participants && room.participants.length === 2) {
                const currentUserId = this.getUser().id;
                const otherUser = room.participants.find(p => p.id !== currentUserId);
                if (otherUser) {
                    return otherUser.name;
                }
            }
            // For groups or fallback, use room name
            return room.name;
        },
        
        getAvatarColor: function (userId) {
            // Generate consistent color for user based on their ID
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
                '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
                '#E76F51', '#2A9D8F', '#E9C46A', '#F4A261', '#264653'
            ];
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = userId.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        },

        renderMessages: function () {
            if (!this.$messagesContainer) return;
            
            // Remove "no chat selected" message
            this.$messagesContainer.find('.no-chat-selected').remove();
            
            let html = '';
            const currentUserId = this.getUser().id;
            
            this.messages.forEach((msg, index) => {
                const isSent = msg.fromUserId === currentUserId;
                const time = new Date(msg.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
                
                // Reply preview
                let replyHtml = '';
                if (msg.replyToId) {
                    const replyMsg = this.messages.find(m => m.id === msg.replyToId);
                    if (replyMsg) {
                        replyHtml = `
                            <div class="message-reply" data-reply-id="${msg.replyToId}">
                                <i class="fas fa-reply"></i>
                                <span>${this.escapeHtml(msg.replyUserName || 'Unknown')}</span>
                                <p>${this.escapeHtml(replyMsg.message.substring(0, 50))}${replyMsg.message.length > 50 ? '...' : ''}</p>
                            </div>
                        `;
                    }
                }
                
                // Reactions
                let reactionsHtml = '';
                if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                    reactionsHtml = '<div class="message-reactions">';
                    for (const [emoji, users] of Object.entries(msg.reactions)) {
                        reactionsHtml += `<span class="reaction-item" data-emoji="${emoji}">${emoji} ${users.length}</span>`;
                    }
                    reactionsHtml += '</div>';
                }
                
                // Edited indicator
                const editedText = msg.isEdited ? '<span class="edited-indicator">(изменено)</span>' : '';
                
                // Read status (checkmarks)
                let readStatus = '';
                if (isSent) {
                    readStatus = msg.isRead ? 
                        '<i class="fas fa-check-double read-status read"></i>' : 
                        '<i class="fas fa-check read-status"></i>';
                }
                
                // Pinned indicator
                const pinnedClass = msg.isPinned ? 'pinned' : '';
                
                // Attachment (image)
                let attachmentHtml = '';
                if (msg.attachmentType === 'image' && msg.attachmentUrl) {
                    attachmentHtml = `<div class="message-image"><img src="${msg.attachmentUrl}" alt="${this.escapeHtml(msg.attachmentName || 'Image')}" /></div>`;
                }
                
                // Avatar for received messages
                let avatarHtml = '';
                if (!isSent) {
                    const initials = msg.fromUserName ? msg.fromUserName.substring(0, 2).toUpperCase() : '??';
                    const avatarColor = this.getAvatarColor(msg.fromUserId);
                    avatarHtml = `<div class="message-avatar" style="background-color: ${avatarColor}">${initials}</div>`;
                }
                
                // Show sender name only in group chats
                const isGroupChat = this.currentRoom && this.currentRoom.type === 'group';
                const senderNameHtml = (!isSent && isGroupChat) ? `<div class="message-sender">${this.escapeHtml(msg.fromUserName)}</div>` : '';
                
                html += `
                    <div class="message ${isSent ? 'sent' : 'received'} ${pinnedClass}" data-message-id="${msg.id}" data-index="${index}">
                        ${avatarHtml}
                        <div class="message-bubble">
                            ${senderNameHtml}
                            ${replyHtml}
                            ${attachmentHtml}
                            ${msg.message ? `<div class="message-text">${this.escapeHtml(msg.message)}</div>` : ''}
                            <div class="message-footer">
                                <span class="message-time">${time} ${editedText}</span>
                                ${readStatus}
                            </div>
                            ${reactionsHtml}
                        </div>
                        ${isSent ? '<button class="message-menu-btn" title="Меню"><i class="fas fa-ellipsis-v"></i></button>' : ''}
                    </div>
                `;
            });
            
            this.$messagesContainer.html(html);
            
            // Add event listeners
            this.attachMessageEvents();
        },
        
        attachMessageEvents: function () {
            // Context menu on right click
            this.$messagesContainer.find('.message').on('contextmenu', (e) => {
                e.preventDefault();
                const messageId = $(e.currentTarget).data('message-id');
                const messageIndex = $(e.currentTarget).data('index');
                this.showMessageContextMenu(e.pageX, e.pageY, messageId, messageIndex);
            });
            
            // Menu button click
            this.$messagesContainer.find('.message-menu-btn').on('click', (e) => {
                e.stopPropagation();
                const $message = $(e.currentTarget).closest('.message');
                const messageId = $message.data('message-id');
                const messageIndex = $message.data('index');
                const rect = e.currentTarget.getBoundingClientRect();
                this.showMessageContextMenu(rect.left, rect.bottom, messageId, messageIndex);
            });
            
            // Reply click - scroll to original message
            this.$messagesContainer.find('.message-reply').on('click', (e) => {
                const replyId = $(e.currentTarget).data('reply-id');
                const $replyMsg = this.$messagesContainer.find(`[data-message-id="${replyId}"]`);
                if ($replyMsg.length) {
                    $replyMsg[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                    $replyMsg.addClass('highlight');
                    setTimeout(() => $replyMsg.removeClass('highlight'), 2000);
                }
            });
            
            // Reaction click
            this.$messagesContainer.find('.reaction-item').on('click', (e) => {
                const emoji = $(e.currentTarget).data('emoji');
                const messageId = $(e.currentTarget).closest('.message').data('message-id');
                this.toggleReaction(messageId, emoji);
            });
        },

        selectRoom: function (roomId) {
            const room = this.rooms.find(r => r.id === roomId);
            if (room) {
                this.currentRoom = room;
                if (this.$chatName) {
                    const displayName = this.getChatDisplayName(room);
                    this.$chatName.text(displayName);
                }
                
                // Show manage participants button only for groups
                if (this.$manageParticipantsBtn) {
                    if (room.type === 'group') {
                        this.$manageParticipantsBtn.show();
                    } else {
                        this.$manageParticipantsBtn.hide();
                    }
                }
                
                this.loadMessages(roomId);
                this.renderRooms();
            }
        },

        showNewChatDialog: function () {
            var self = this;
            this.pendingUsersCallback = function(users) {
                this.createView('dialog', 'views/modal', {
                    templateContent: this.getNewChatDialogTemplate(users),
                    headerText: 'Новый чат',
                    backdrop: true,
                    buttonList: [
                        {
                            name: 'create',
                            label: 'Создать',
                            style: 'primary',
                            onClick: () => {
                                this.createNewChat();
                            }
                        },
                        {
                            name: 'cancel',
                            label: 'Отмена'
                        }
                    ]
                }, function(view) {
                    view.render();
                });
            };
            this.wsSend({ type: 'getUsers' });
        },

        getNewChatDialogTemplate: function (users) {
            let html = `
                <div class="form-group">
                    <label>Выберите пользователя:</label>
                    <select class="form-control" id="selectUser">
                        <option value="">-- Выберите --</option>
            `;
            
            users.forEach(user => {
                html += `<option value="${user.id}">${this.escapeHtml(user.name)}</option>`;
            });
            
            html += `
                    </select>
                </div>
            `;
            
            return html;
        },

        createNewChat: function () {
            var userId = $('#selectUser').val();
            if (!userId) {
                Espo.Ui.error('Выберите пользователя');
                return;
            }
            
            this.wsSend({
                type: 'sendMessage',
                toUserId: userId,
                message: 'Привет!'
            });
            this.closeDialog();
        },

        scrollToBottom: function () {
            if (this.$messagesContainer) {
                this.$messagesContainer.scrollTop(this.$messagesContainer[0].scrollHeight);
            }
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        },

        searchChats: function (query) {
            if (!query || query.trim() === '') {
                this.rooms = this.allRooms;
                this.renderRooms();
                this.$chatList.find('.search-users-section').remove();
                return;
            }
            
            var filtered = [];
            for (var i = 0; i < this.allRooms.length; i++) {
                var room = this.allRooms[i];
                if (room.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    filtered.push(room);
                }
            }
            
            this.rooms = filtered;
            this.renderRooms();
            
            var self = this;
            this.pendingUsersCallback = function(users) {
                self.renderSearchUsers(users);
            };
            this.wsSend({ type: 'getUsers' });
        },

        renderSearchUsers: function (users) {
            this.$chatList.find('.search-users-section').remove();
            
            if (users.length === 0) return;
            
            let html = '<div class="search-users-section"><div class="search-section-title">Контакты</div>';
            
            users.forEach(user => {
                const initials = user.name.substring(0, 2).toUpperCase();
                html += `
                    <div class="chat-item search-user-item" data-user-id="${user.id}">
                        <div class="chat-item-avatar">${initials}</div>
                        <div class="chat-item-content">
                            <div class="chat-item-header">
                                <span class="chat-item-name">${this.escapeHtml(user.name)}</span>
                            </div>
                            <div class="chat-item-message">Начать чат</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            this.$chatList.append(html);
            
            // Handle click on user to start chat
            this.$chatList.find('.search-user-item').on('click', (e) => {
                const userId = $(e.currentTarget).data('user-id');
                this.startChatWithUser(userId);
            });
        },

        startChatWithUser: function (userId) {
            this.wsSend({
                type: 'sendMessage',
                toUserId: userId,
                message: 'Привет! 👋'
            });
            this.$searchInput.val('');
        },

        showNewGroupDialog: function () {
            var self = this;
            this.pendingUsersCallback = function(users) {
                this.createView('dialog', 'views/modal', {
                    templateContent: this.getNewGroupDialogHtml(users),
                    backdrop: true,
                    headerText: 'Новая группа'
                }, view => {
                    view.render();
                    
                    // Search participants
                    $('#searchParticipants').on('input', function() {
                        const query = $(this).val().toLowerCase();
                        $('#participantsSelect .contact-item').each(function() {
                            const userName = $(this).data('user-name');
                            if (userName.includes(query)) {
                                $(this).show();
                            } else {
                                $(this).hide();
                            }
                        });
                    });
                    
                    // Toggle checkbox on contact item click
                    $('#participantsSelect').on('click', '.contact-item', function(e) {
                        if (e.target.tagName !== 'INPUT') {
                            const checkbox = $(this).find('input[type="checkbox"]');
                            checkbox.prop('checked', !checkbox.prop('checked'));
                        }
                    });
                    
                    $('#createGroupBtn').on('click', function() {
                        self.createNewGroup();
                    });
                    
                    $('#cancelGroupBtn').on('click', function() {
                        self.closeDialog();
                    });
                });
            };
            this.wsSend({ type: 'getUsers' });
        },

        getNewGroupDialogHtml: function (users) {
            let html = `
                <div class="form-group">
                    <label>Название группы:</label>
                    <input type="text" class="form-control" id="groupNameInput" placeholder="Введите название группы">
                </div>
                <div class="form-group">
                    <label>Участники (опционально):</label>
                    <div class="search-box" style="margin-bottom: 10px;">
                        <i class="fas fa-search"></i>
                        <input type="text" id="searchParticipants" placeholder="Поиск участников" style="width: 100%; padding: 8px 8px 8px 35px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="participants-select" id="participantsSelect" style="max-height: 300px; overflow-y: auto;">
            `;
            
            users.forEach(user => {
                const initials = user.name.substring(0, 2).toUpperCase();
                html += `
                    <div class="contact-item" data-user-id="${user.id}" data-user-name="${this.escapeHtml(user.name).toLowerCase()}">
                        <input type="checkbox" value="${user.id}" id="user_${user.id}">
                        <label for="user_${user.id}">
                            <div class="contact-avatar">${initials}</div>
                            <span>${this.escapeHtml(user.name)}</span>
                        </label>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelGroupBtn">Отмена</button>
                    <button class="btn-create" id="createGroupBtn">Создать</button>
                </div>
            `;
            
            return html;
        },

        createNewGroup: function (e) {
            let name = '';

            // Пытаемся найти инпут в том же модальном окне, где нажата кнопка
            if (e && e.target) {
                const $modal = $(e.target).closest('.modal, .modal-body, .modal-dialog');
                if ($modal.length) {
                    const $input = $modal.find('#groupNameInput').last();
                    if ($input.length) {
                        name = (($input.val() || '') + '').trim();
                    }
                }
            }

            // Если не нашли по событию, используем последний видимый инпут как запасной вариант
            if (!name) {
                const $visibleInputs = $('#groupNameInput:visible');
                if ($visibleInputs.length) {
                    const $last = $($visibleInputs[$visibleInputs.length - 1]);
                    name = (($last.val() || '') + '').trim();
                }
            }

            if (!name) {
                Espo.Ui.error('Введите название группы');
                return;
            }

            const participantIds = [];
            $('#participantsSelect input:checked').each(function() {
                participantIds.push($(this).val());
            });
            
            console.log('Creating group with name:', name, 'participants:', participantIds);
            
            this.wsSend({
                type: 'createRoom',
                name: name,
                roomType: 'group',
                participantIds: participantIds
            });
            this.closeDialog();
            Espo.Ui.success('Группа создается...');
        },
        
        closeDialog: function () {
            if (this.hasView('dialog')) {
                this.clearView('dialog');
            }
            if (this.hasView('groupDialog')) {
                this.clearView('groupDialog');
            }
        },

        initEmojiPicker: function () {
            const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'];
            
            const emojiGrid = this.$el.find('#emojiGrid');
            let html = '';
            emojis.forEach(emoji => {
                html += `<span class="emoji-item">${emoji}</span>`;
            });
            emojiGrid.html(html);
            
            emojiGrid.find('.emoji-item').on('click', (e) => {
                const emoji = $(e.target).text();
                const currentText = this.$messageInput.val();
                this.$messageInput.val(currentText + emoji);
                this.$messageInput.focus();
                this.toggleEmojiPicker();
            });
        },

        toggleEmojiPicker: function () {
            if (this.$emojiPicker.is(':visible')) {
                this.$emojiPicker.hide();
            } else {
                this.$emojiPicker.show();
            }
        },

        showGroupInfo: function () {
            if (!this.currentRoom) return;
            if (this.currentRoom.type === 'group') {
                this.renderGroupParticipants(this.currentRoom);
                this.$groupInfoPanel.addClass('active');
            }
        },

        hideGroupInfo: function () {
            this.$groupInfoPanel.removeClass('active');
        },

        renderGroupParticipants: function (room) {
            var participantsList = this.$el.find('#groupParticipantsList');
            var html = '';
            
            if (room.participants) {
                for (var i = 0; i < room.participants.length; i++) {
                    var participant = room.participants[i];
                    var initials = participant.name.substring(0, 2).toUpperCase();
                    html += '<div class="participant-list-item">' +
                        '<div class="participant-list-avatar">' + initials + '</div>' +
                        '<div class="participant-list-name">' + this.escapeHtml(participant.name) + '</div>' +
                        '</div>';
                }
            }
            participantsList.html(html);
        },

        showAddParticipantsDialog: function () {
            if (!this.currentRoom) return;
            
            var self = this;
            this.pendingUsersCallback = function(users) {
                this.createView('addParticipantsDialog', 'views/modal', {
                    templateContent: this.getAddParticipantsDialogHtml(users),
                    backdrop: true,
                    headerText: 'Добавить участников'
                }, function(view) {
                    view.render();
                    
                    $('#addSelectedBtn').on('click', function() {
                        self.addParticipantsToGroup();
                    });
                    
                    $('#cancelAddBtn').on('click', function() {
                        self.clearView('addParticipantsDialog');
                    });
                });
            };
            this.wsSend({ type: 'getUsers' });
        },

        getAddParticipantsDialogHtml: function (users) {
            let html = `
                <div class="form-group">
                    <label>Выберите участников:</label>
                    <div class="participants-select" id="addParticipantsSelect">
            `;
            
            users.forEach(user => {
                const initials = user.name.substring(0, 2).toUpperCase();
                html += `
                    <div class="contact-item">
                        <input type="checkbox" value="${user.id}" id="add_user_${user.id}">
                        <label for="add_user_${user.id}">
                            <div class="contact-avatar">${initials}</div>
                            <span>${this.escapeHtml(user.name)}</span>
                        </label>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelAddBtn">Отмена</button>
                    <button class="btn-create" id="addSelectedBtn">Добавить</button>
                </div>
            `;
            
            return html;
        },

        addParticipantsToGroup: function () {
            const participantIds = [];
            $('#addParticipantsSelect input:checked').each(function() {
                participantIds.push($(this).val());
            });
            
            if (participantIds.length === 0) {
                Espo.Ui.error('Выберите хотя бы одного участника');
                return;
            }
            
            // Add participants to existing room
            this.wsSend({
                type: 'addParticipants',
                roomId: this.currentRoom.id,
                participantIds: participantIds
            });
            this.clearView('addParticipantsDialog');
            Espo.Ui.success('Участники добавляются...');
        },

        showMessageContextMenu: function (x, y, messageId, messageIndex) {
            // Remove existing menu
            $('.message-context-menu').remove();
            
            const message = this.messages[messageIndex];
            const currentUserId = this.getUser().id;
            const isOwn = message.fromUserId === currentUserId;
            
            let menuHtml = '<div class="message-context-menu" style="left:' + x + 'px; top:' + y + 'px;">';
            menuHtml += '<div class="menu-item" data-action="reply"><i class="fas fa-reply"></i> Ответить</div>';
            menuHtml += '<div class="menu-item" data-action="react"><i class="fas fa-smile"></i> Реакция</div>';
            
            if (isOwn) {
                menuHtml += '<div class="menu-item" data-action="edit"><i class="fas fa-edit"></i> Редактировать</div>';
                menuHtml += '<div class="menu-item" data-action="delete"><i class="fas fa-trash"></i> Удалить</div>';
            }
            
            menuHtml += '<div class="menu-item" data-action="pin"><i class="fas fa-thumbtack"></i> ' + (message.isPinned ? 'Открепить' : 'Закрепить') + '</div>';
            menuHtml += '</div>';
            
            $('body').append(menuHtml);
            
            const $menu = $('.message-context-menu');
            
            // Handle menu clicks
            $menu.find('.menu-item').on('click', (e) => {
                const action = $(e.currentTarget).data('action');
                $menu.remove();
                
                switch(action) {
                    case 'reply':
                        this.replyToMessage(messageId, messageIndex);
                        break;
                    case 'react':
                        this.showReactionPicker(messageId);
                        break;
                    case 'edit':
                        this.editMessage(messageId, messageIndex);
                        break;
                    case 'delete':
                        this.deleteMessage(messageId);
                        break;
                    case 'pin':
                        this.togglePinMessage(messageId, !message.isPinned);
                        break;
                }
            });
            
            // Close menu on click outside
            $(document).one('click', () => $menu.remove());
        },

        replyToMessage: function (messageId, messageIndex) {
            this.replyingTo = {
                id: messageId,
                message: this.messages[messageIndex]
            };
            
            const msg = this.messages[messageIndex];
            const replyPreview = `
                <div class="reply-preview">
                    <i class="fas fa-reply"></i>
                    <div>
                        <strong>${this.escapeHtml(msg.fromUserName)}</strong>
                        <p>${this.escapeHtml(msg.message.substring(0, 50))}</p>
                    </div>
                    <button class="cancel-reply"><i class="fas fa-times"></i></button>
                </div>
            `;
            
            this.$el.find('.message-input-container').prepend(replyPreview);
            this.$el.find('.cancel-reply').on('click', () => {
                this.replyingTo = null;
                this.$el.find('.reply-preview').remove();
            });
            
            this.$messageInput.focus();
        },

        editMessage: function (messageId, messageIndex) {
            const msg = this.messages[messageIndex];
            this.editingMessage = {id: messageId, originalText: msg.message};
            
            this.$messageInput.val(msg.message);
            this.$sendBtn.html('<i class="fas fa-check"></i>');
            
            const editPreview = `
                <div class="edit-preview">
                    <i class="fas fa-edit"></i>
                    <span>Редактирование сообщения</span>
                    <button class="cancel-edit"><i class="fas fa-times"></i></button>
                </div>
            `;
            
            this.$el.find('.message-input-container').prepend(editPreview);
            this.$el.find('.cancel-edit').on('click', () => {
                this.cancelEdit();
            });
            
            this.$messageInput.focus();
        },

        cancelEdit: function () {
            this.editingMessage = null;
            this.$messageInput.val('');
            this.$sendBtn.html('<i class="fas fa-paper-plane"></i>');
            this.$el.find('.edit-preview').remove();
        },

        deleteMessage: function (messageId) {
            if (!confirm('Удалить сообщение?')) return;
            
            this.wsSend({
                type: 'deleteMessage',
                messageId: messageId
            });
        },

        togglePinMessage: function (messageId, pinned) {
            this.wsSend({
                type: 'pinMessage',
                messageId: messageId,
                pinned: pinned
            });
        },

        showReactionPicker: function (messageId) {
            const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
            
            let html = '<div class="reaction-picker">';
            reactions.forEach(emoji => {
                html += `<span class="reaction-emoji" data-emoji="${emoji}">${emoji}</span>`;
            });
            html += '</div>';
            
            const $picker = $(html);
            $('body').append($picker);
            
            $picker.find('.reaction-emoji').on('click', (e) => {
                const emoji = $(e.currentTarget).data('emoji');
                this.toggleReaction(messageId, emoji);
                $picker.remove();
            });
            
            $(document).one('click', () => $picker.remove());
        },

        toggleReaction: function (messageId, emoji) {
            this.wsSend({
                type: 'reactToMessage',
                messageId: messageId,
                emoji: emoji
            });
        },

        sendMessage: function () {
            var message = this.$messageInput.val().trim();
            if (!message || !this.currentRoom) return;
            
            if (this.editingMessage) {
                this.wsSend({
                    type: 'editMessage',
                    messageId: this.editingMessage.id,
                    message: message
                });
                this.cancelEdit();
                return;
            }
            
            var data = {
                type: 'sendMessage',
                roomId: this.currentRoom.id,
                message: message
            };
            
            if (this.replyingTo) {
                data.replyToId = this.replyingTo.id;
            }
            
            this.wsSend(data);
            this.$messageInput.val('');
            this.replyingTo = null;
            this.$el.find('.reply-preview').remove();
        },
        
        handleImageUpload: function (file) {
            if (!file || !this.currentRoom) return;
            
            var maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                Espo.Ui.error('Файл слишком большой! Максимальный размер: 10MB');
                return;
            }
            
            console.log('Uploading image:', file.name, 'size:', file.size);
            
            if (file.size > 2 * 1024 * 1024) {
                this.compressAndUploadImage(file);
            } else {
                this.uploadImageDirect(file);
            }
        },
        
        compressAndUploadImage: function (file) {
            var self = this;
            var reader = new FileReader();
            reader.onload = function (e) {
                var img = new Image();
                img.onload = function () {
                    var canvas = document.createElement('canvas');
                    var width = img.width;
                    var height = img.height;
                    
                    var maxDimension = 1920;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = (height / width) * maxDimension;
                            width = maxDimension;
                        } else {
                            width = (width / height) * maxDimension;
                            height = maxDimension;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    var base64 = canvas.toDataURL('image/jpeg', 0.8);
                    console.log('Compressed base64 length:', base64.length);
                    
                    self.sendImageMessage(base64, file.name);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        },
        
        uploadImageDirect: function (file) {
            var self = this;
            var reader = new FileReader();
            reader.onload = function (e) {
                var base64 = e.target.result;
                console.log('Base64 length:', base64.length);
                self.sendImageMessage(base64, file.name);
            };
            reader.onerror = function (e) {
                console.error('FileReader error:', e);
                Espo.Ui.error('Ошибка чтения файла');
            };
            reader.readAsDataURL(file);
        },
        
        sendImageMessage: function (base64, fileName) {
            if (base64.length > 15 * 1024 * 1024) {
                Espo.Ui.error('Изображение слишком большое даже после сжатия. Попробуйте меньший файл.');
                return;
            }
            
            var data = {
                type: 'sendMessage',
                roomId: this.currentRoom.id,
                message: fileName,
                attachmentType: 'image',
                attachmentUrl: base64,
                attachmentName: fileName
            };
            
            if (this.replyingTo) {
                data.replyToId = this.replyingTo.id;
            }
            
            console.log('Sending image message to room:', this.currentRoom.id);
            this.wsSend(data);
            this.replyingTo = null;
            this.$el.find('.reply-preview').remove();
            Espo.Ui.success('Изображение отправляется...');
        },

        setTyping: function (isTyping) {
            if (!this.currentRoom) return;
            
            this.wsSend({
                type: 'typing',
                roomId: this.currentRoom.id,
                isTyping: isTyping
            });
        },

        showManageParticipantsDialog: function () {
            if (!this.currentRoom || this.currentRoom.type !== 'group') {
                return;
            }
            
            var self = this;
            var participantIds = [];
            if (this.currentRoom.participants) {
                for (var i = 0; i < this.currentRoom.participants.length; i++) {
                    participantIds.push(this.currentRoom.participants[i].id);
                }
            }
            
            this.pendingUsersCallback = function(allUsers) {
                
                self.createView('manageDialog', 'views/modal', {
                    templateContent: this.getManageParticipantsHtml(allUsers, participantIds),
                    backdrop: true,
                    headerText: 'Управление участниками'
                }, function(view) {
                    view.render();
                    
                    var roomId = self.currentRoom.id;
                    
                    $('#manageParticipantsList').on('click', '.participant-toggle', function() {
                        var $btn = $(this);
                        var userId = $btn.data('user-id');
                        var isParticipant = $btn.hasClass('remove');
                        
                        if (isParticipant) {
                            self.wsSend({
                                type: 'removeParticipant',
                                roomId: roomId,
                                userId: userId
                            });
                            $btn.removeClass('remove btn-danger').addClass('add btn-success');
                            $btn.html('<i class="fas fa-user-plus"></i> Добавить');
                        } else {
                            self.wsSend({
                                type: 'addParticipants',
                                roomId: roomId,
                                participantIds: [userId]
                            });
                            $btn.removeClass('add btn-success').addClass('remove btn-danger');
                            $btn.html('<i class="fas fa-user-minus"></i> Удалить');
                        }
                    });
                    
                    $('#closeManageBtn').on('click', function() {
                        self.clearView('manageDialog');
                    });
                });
            };
            this.wsSend({ type: 'getUsers' });
        },
        
        getManageParticipantsHtml: function (allUsers, participantIds) {
            let html = `
                <div class="manage-participants-container">
                    <div class="participants-list" id="manageParticipantsList">
            `;
            
            allUsers.forEach(user => {
                const isParticipant = participantIds.includes(user.id);
                const initials = user.name.substring(0, 2).toUpperCase();
                const btnClass = isParticipant ? 'remove btn-danger' : 'add btn-success';
                const btnText = isParticipant ? '<i class="fas fa-user-minus"></i> Удалить' : '<i class="fas fa-user-plus"></i> Добавить';
                
                html += `
                    <div class="participant-item">
                        <div class="participant-info">
                            <div class="contact-avatar">${initials}</div>
                            <span class="participant-name">${this.escapeHtml(user.name)}</span>
                        </div>
                        <button class="participant-toggle ${btnClass}" data-user-id="${user.id}">
                            ${btnText}
                        </button>
                    </div>
                `;
            });
            
            html += `
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-default" id="closeManageBtn">Закрыть</button>
                    </div>
                </div>
            `;
            
            return html;
        },

        onRemove: function () {
            if (this.ws) {
                this.ws.close();
            }
        }

    });
});
