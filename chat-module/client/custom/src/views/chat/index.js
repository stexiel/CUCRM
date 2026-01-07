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
                    
                case 'searchMessagesResults':
                    this.handleSearchMessagesResults(msg);
                    break;
                case 'searchAllRoomsResults':
                    this.handleSearchAllRoomsResults(data);
                    break;
                case 'roomRestored':
                    this.handleRoomRestored(data);
                    break;
                case 'reloadRooms':
                    this.loadRooms();
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
                    
                case 'roomDeleted':
                    // Room was deleted by another user
                    if (this.currentRoom && this.currentRoom.id === msg.roomId) {
                        this.currentRoom = null;
                        this.messages = [];
                        this.$messagesContainer.html('<div class="no-chat-selected"><i class="fas fa-comments"></i><h2>CU CRM Chat</h2><p>Выберите чат из списка или создайте новый</p></div>');
                        this.$chatName.text('Выберите чат');
                        this.$deleteChatBtn.hide();
                        this.$manageParticipantsBtn.hide();
                        Espo.Ui.warning('Этот чат был удален');
                    }
                    this.loadRooms();
                    break;
                    
                case 'roomDeletedSuccess':
                    // Room was successfully deleted by current user
                    // Clear current room
                    this.currentRoom = null;
                    this.messages = [];
                    this.$messagesContainer.html('<div class="no-chat-selected"><i class="fas fa-comments"></i><h2>CU CRM Chat</h2><p>Выберите чат из списка или создайте новый</p></div>');
                    this.$chatName.text('Выберите чат');
                    
                    // Hide delete button
                    this.$deleteChatBtn.hide();
                    this.$manageParticipantsBtn.hide();
                    
                    Espo.Ui.success('Чат удален');
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
            console.log('Received rooms:', rooms.length);
            console.log('Rooms data:', rooms);
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
        
        handleSearchMessagesResults: function (data) {
            console.log('Search messages results:', data.count, 'messages found');
            
            // Show message search results
            this.showMessageSearchResults(data.query, data.results);
        },
        
        showMessageSearchResults: function (query, results) {
            // Remove existing message search results
            this.$el.find('.message-search-results').remove();
            
            if (results.length === 0) {
                var noResultsHtml = `
                    <div class="message-search-results">
                        <div class="search-header">
                            <i class="fas fa-search"></i>
                            <span>Сообщения по запросу "${this.escapeHtml(query)}"</span>
                        </div>
                        <div class="no-message-results">Нет сообщений найдено</div>
                    </div>
                `;
                this.$messagesContainer.prepend(noResultsHtml);
                return;
            }
            
            var resultsHtml = `
                <div class="message-search-results">
                    <div class="search-header">
                        <i class="fas fa-search"></i>
                        <span>Сообщения по запросу "${this.escapeHtml(query)}" (${results.length})</span>
                    </div>
                    <div class="search-results-list">
            `;
            
            results.forEach(msg => {
                var messageText = this.highlightSearchText(msg.message, query);
                var time = this.formatMessageTime(msg.createdAt);
                
                resultsHtml += `
                    <div class="search-result-item" data-message-id="${msg.id}">
                        <div class="result-header">
                            <span class="result-user">${this.escapeHtml(msg.fromUserName)}</span>
                            <span class="result-time">${time}</span>
                        </div>
                        <div class="result-message">${messageText}</div>
                    </div>
                `;
            });
            
            resultsHtml += `
                    </div>
                </div>
            `;
            
            this.$messagesContainer.prepend(resultsHtml);
            
            // Handle clicks on search results
            this.$el.find('.search-result-item').on('click', (e) => {
                var messageId = $(e.currentTarget).data('message-id');
                this.scrollToMessage(messageId);
            });
        },
        
        scrollToMessage: function (messageId) {
            var $message = this.$el.find(`.message[data-message-id="${messageId}"]`);
            if ($message.length > 0) {
                // Highlight the message
                $message.addClass('highlighted-message');
                
                // Scroll to it
                $message[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    $message.removeClass('highlighted-message');
                }, 3000);
            }
        },
        
        handleSearchAllRoomsResults: function (data) {
            console.log('Search all rooms results:', data.count, 'rooms found');
            
            // Show all rooms search results including deleted ones
            this.showAllRoomsSearchResults(data.query, data.results);
        },
        
        showAllRoomsSearchResults: function (query, results) {
            // Remove existing all rooms search results
            this.$el.find('.all-rooms-search-results').remove();
            
            if (results.length === 0) {
                var noResultsHtml = `
                    <div class="all-rooms-search-results">
                        <div class="search-header">
                            <i class="fas fa-search"></i>
                            <span>Все чаты по запросу "${this.escapeHtml(query)}"</span>
                        </div>
                        <div class="no-room-results">Нет чатов найдено</div>
                    </div>
                `;
                this.$chatList.prepend(noResultsHtml);
                return;
            }
            
            var resultsHtml = `
                <div class="all-rooms-search-results">
                    <div class="search-header">
                        <i class="fas fa-search"></i>
                        <span>Все чаты по запросу "${this.escapeHtml(query)}" (${results.length})</span>
                    </div>
                    <div class="search-results-list">
            `;
            
            results.forEach(room => {
                var roomClass = room.userDeleted ? 'deleted-room' : 'active-room';
                var deletedLabel = room.userDeleted ? '<span class="deleted-label">(удален)</span>' : '';
                var lastMessage = room.lastMessage ? this.escapeHtml(room.lastMessage).substring(0, 50) + '...' : 'Нет сообщений';
                
                resultsHtml += `
                    <div class="search-room-item ${roomClass}" data-room-id="${room.id}">
                        <div class="result-room-header">
                            <span class="result-room-name">${this.escapeHtml(room.name)}${deletedLabel}</span>
                            <span class="result-room-time">${this.formatMessageTime(room.lastMessageAt)}</span>
                        </div>
                        <div class="result-room-message">${lastMessage}</div>
                        ${room.userDeleted ? '<div class="restore-hint">Нажмите чтобы восстановить чат</div>' : ''}
                    </div>
                `;
            });
            
            resultsHtml += `
                    </div>
                </div>
            `;
            
            this.$chatList.prepend(resultsHtml);
            
            // Handle clicks on search results
            this.$el.find('.search-room-item').on('click', (e) => {
                var roomId = $(e.currentTarget).data('room-id');
                var room = results.find(r => r.id === roomId);
                
                if (room && room.userDeleted) {
                    // Restore deleted room
                    this.restoreRoom(roomId);
                } else {
                    // Select normal room
                    this.selectRoom(roomId);
                }
            });
        },
        
        restoreRoom: function (roomId) {
            // Send request to restore room (undelete for current user)
            this.wsSend({
                type: 'restoreRoom',
                roomId: roomId
            });
        },
        
        handleRoomRestored: function (data) {
            console.log('Room restored successfully:', data.roomId);
            
            // Reload rooms list to show restored room
            this.loadRooms();
            
            // Remove search results
            this.$el.find('.all-rooms-search-results').remove();
            
            // Clear search input
            this.$searchInput.val('');
            
            // Show success message
            Espo.Ui.success('Чат восстановлен');
            
            // Select the restored room
            this.selectRoom(data.roomId);
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
            this.$deleteChatBtn = this.$el.find('#deleteChatBtn');
            
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
            this.$searchInput.on('keypress', (e) => {
                if (e.which === 13) {
                    e.preventDefault();
                    this.hideAutocomplete();
                    this.handleSearchAction();
                }
            });
            this.$searchInput.on('keydown', (e) => {
                if (e.which === 27) { // Escape
                    this.hideAutocomplete();
                }
            });
            
            // Hide autocomplete when clicking outside
            $(document).on('click', (e) => {
                if (!$(e.target).closest('.search-box, .search-autocomplete').length) {
                    this.hideAutocomplete();
                }
            });
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
            
            // Delete chat handlers
            this.$deleteChatBtn.on('click', () => this.showDeleteChatDialog());
            
            $(document)
                .off('click.chatDelete')
                .on('click.chatDelete', '#confirmDelete', (e) => {
                    e.preventDefault();
                    if (this.deleteChat) {
                        this.deleteChat();
                    }
                });
            
            $(document)
                .off('click.chatCancelDelete')
                .on('click.chatCancelDelete', '#cancelDelete, #closeDeleteModal', (e) => {
                    e.preventDefault();
                    if (this.closeDeleteDialog) {
                        this.closeDeleteDialog();
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
            
            // Get current search query for highlighting
            const searchQuery = this.$searchInput.val().trim();
            
            let html = '';
            this.rooms.forEach(room => {
                const isActive = this.currentRoom && this.currentRoom.id === room.id;
                const unreadBadge = room.unreadCount > 0 ? 
                    `<span class="chat-item-unread">${room.unreadCount}</span>` : '';
                
                // Get display name (for direct chats, show only other person's name)
                const displayName = this.getChatDisplayName(room);
                const initials = displayName.substring(0, 2).toUpperCase();
                const time = room.lastMessageTime ? new Date(room.lastMessageTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '';
                
                // Highlight search query in display name
                const highlightedName = searchQuery ? 
                    this.highlightSearchText(displayName, searchQuery) : 
                    this.escapeHtml(displayName);
                
                html += `
                    <div class="chat-item ${isActive ? 'active' : ''}" data-id="${room.id}">
                        <div class="chat-item-avatar">${initials}</div>
                        <div class="chat-item-content">
                            <div class="chat-item-header">
                                <span class="chat-item-name">${highlightedName}</span>
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
                
                // Attachment (image) - WhatsApp style
                let attachmentHtml = '';
                if (msg.attachmentType === 'image' && msg.attachmentUrl) {
                    attachmentHtml = `
                        <div class="message-image-container">
                            <div class="message-image" onclick="window.open('${msg.attachmentUrl}', '_blank')">
                                <img src="${msg.attachmentUrl}" alt="${this.escapeHtml(msg.attachmentName || 'Image')}" loading="lazy" />
                                <div class="image-overlay">
                                    <i class="fas fa-expand"></i>
                                </div>
                            </div>
                        </div>
                    `;
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
                console.log('Right click detected on message');
                e.preventDefault();
                const messageId = $(e.currentTarget).data('message-id');
                const messageIndex = $(e.currentTarget).data('index');
                console.log('Message ID:', messageId, 'Index:', messageIndex);
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
                
                // Show delete button for all rooms
                if (this.$deleteChatBtn) {
                    this.$deleteChatBtn.show();
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
            var trimmedQuery = query.trim();
            
            if (!trimmedQuery) {
                this.rooms = this.allRooms;
                this.renderRooms();
                this.hideSearchResults();
                this.hideAutocomplete();
                return;
            }
            
            // Smart search with trigram fuzzy matching
            var filtered = [];
            var lowerQuery = trimmedQuery.toLowerCase();
            
            // Priority 1: Exact match
            var exactMatches = [];
            // Priority 2: Starts with
            var startsWithMatches = [];
            // Priority 3: Contains with trigrams (fuzzy matching)
            var fuzzyMatches = [];
            
            // Search in existing rooms
            for (var i = 0; i < this.allRooms.length; i++) {
                var room = this.allRooms[i];
                var roomName = room.name.toLowerCase();
                
                if (roomName === lowerQuery) {
                    exactMatches.push(room);
                } else if (roomName.startsWith(lowerQuery)) {
                    startsWithMatches.push(room);
                } else if (this.trigramMatch(lowerQuery, roomName)) {
                    fuzzyMatches.push(room);
                }
            }
            
            // Combine by priority
            filtered = exactMatches.concat(startsWithMatches, fuzzyMatches);
            
            this.rooms = filtered;
            this.renderRooms();
            
            // Show trigram search results
            this.showTrigramSearchResults(trimmedQuery, exactMatches, startsWithMatches, fuzzyMatches);
            
            // Show autocomplete with typo correction
            this.showAutocomplete(trimmedQuery);
            
            // Search ALL users, messages and rooms (including deleted)
            var self = this;
            this.pendingUsersCallback = function(users) {
                self.renderSearchUsers(users, trimmedQuery);
                // Also search in messages
                self.searchInMessages(trimmedQuery);
                // Search all rooms including deleted ones
                self.searchAllRooms(trimmedQuery);
            };
            this.wsSend({ type: 'getUsers' });
        },
        
        searchAllRooms: function (query) {
            // Request search in all rooms including deleted ones
            this.wsSend({
                type: 'searchAllRooms',
                query: query
            });
        },
        
        searchInMessages: function (query) {
            if (!this.currentRoom || !query) return;
            
            // Request message search from server
            this.wsSend({
                type: 'searchMessages',
                roomId: this.currentRoom.id,
                query: query
            });
        },
        
        trigramMatch: function (query, text) {
            // Generate trigrams for query and text
            var queryTrigrams = this.generateTrigrams(query);
            var textTrigrams = this.generateTrigrams(text);
            
            if (queryTrigrams.length === 0 || textTrigrams.length === 0) return false;
            
            // Calculate Jaccard similarity between trigram sets
            var intersection = 0;
            var union = new Set();
            
            queryTrigrams.forEach(trigram => union.add(trigram));
            textTrigrams.forEach(trigram => union.add(trigram));
            
            queryTrigrams.forEach(trigram => {
                if (textTrigrams.includes(trigram)) intersection++;
            });
            
            var similarity = intersection / union.size;
            
            // Return true if similarity is above threshold (0.3 for fuzzy matching)
            return similarity > 0.3;
        },
        
        generateTrigrams: function (text) {
            var trigrams = [];
            var paddedText = '^' + text + '$'; // Add start/end markers
            
            for (var i = 0; i < paddedText.length - 2; i++) {
                trigrams.push(paddedText.substr(i, 3));
            }
            
            return trigrams;
        },
        
        suggestCorrection: function (query) {
            if (query.length < 3) return query;
            
            var bestMatch = query;
            var bestScore = 0;
            
            this.allRooms.forEach(room => {
                var roomName = room.name.toLowerCase();
                var score = this.calculateSimilarity(query.toLowerCase(), roomName);
                
                if (score > bestScore && score > 0.6) { // 60% similarity threshold
                    bestScore = score;
                    bestMatch = room.name;
                }
            });
            
            return bestMatch;
        },
        
        calculateSimilarity: function (str1, str2) {
            var longer = str1.length > str2.length ? str1 : str2;
            var shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.length === 0) return 1.0;
            
            var editDistance = this.levenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / longer.length;
        },
        
        levenshteinDistance: function (str1, str2) {
            var matrix = [];
            
            for (var i = 0; i <= str2.length; i++) {
                matrix[i] = [i];
            }
            
            for (var j = 0; j <= str1.length; j++) {
                matrix[0][j] = j;
            }
            
            for (var i = 1; i <= str2.length; i++) {
                for (var j = 1; j <= str1.length; j++) {
                    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            
            return matrix[str2.length][str1.length];
        },
        
        showTrigramSearchResults: function (query, exactMatches, startsWithMatches, fuzzyMatches) {
            this.$chatList.find('.search-results-info').remove();
            
            var totalResults = exactMatches.length + startsWithMatches.length + fuzzyMatches.length;
            
            var resultsHtml = '<div class="search-results-info">';
            
            if (totalResults > 0) {
                // Check if we should suggest correction
                var suggestedCorrection = this.suggestCorrection(query);
                var hasTypo = suggestedCorrection.toLowerCase() !== query.toLowerCase() && suggestedCorrection !== query;
                
                if (hasTypo) {
                    resultsHtml += `<div class="typo-correction">
                        <i class="fas fa-magic"></i>
                        Возможно, вы имели в виду: 
                        <span class="correction-suggestion" onclick='this.closest(".search-results-info").parentNode.querySelector("#searchInput").value="${this.escapeHtml(suggestedCorrection)}"; this.closest(".search-results-info").parentNode.querySelector("#searchInput").dispatchEvent(new Event("input"))'>
                            ${this.escapeHtml(suggestedCorrection)}
                        </span>
                    </div>`;
                }
                
                resultsHtml += '<div class="search-trigrams">';
                
                // Show results by type
                if (exactMatches.length > 0) {
                    resultsHtml += `<div class="trigram-section exact">
                        <div class="trigram-title">Точные совпадения (${exactMatches.length})</div>
                        <div class="trigram-results">`;
                    
                    exactMatches.slice(0, 3).forEach(room => {
                        resultsHtml += `<div class="trigram-result">${this.escapeHtml(this.getChatDisplayName(room))}</div>`;
                    });
                    
                    resultsHtml += '</div></div>';
                }
                
                if (startsWithMatches.length > 0) {
                    resultsHtml += `<div class="trigram-section starts-with">
                        <div class="trigram-title">Начинается с "${this.escapeHtml(query)}" (${startsWithMatches.length})</div>
                        <div class="trigram-results">`;
                    
                    startsWithMatches.slice(0, 3).forEach(room => {
                        resultsHtml += `<div class="trigram-result">${this.escapeHtml(this.getChatDisplayName(room))}</div>`;
                    });
                    
                    resultsHtml += '</div></div>';
                }
                
                if (fuzzyMatches.length > 0) {
                    resultsHtml += `<div class="trigram-section fuzzy">
                        <div class="trigram-title">Похожие на "${this.escapeHtml(query)}" (${fuzzyMatches.length})</div>
                        <div class="trigram-results">`;
                    
                    fuzzyMatches.slice(0, 3).forEach(room => {
                        resultsHtml += `<div class="trigram-result">${this.escapeHtml(this.getChatDisplayName(room))}</div>`;
                    });
                    
                    resultsHtml += '</div></div>';
                }
                
                resultsHtml += '</div>';
            } else {
                resultsHtml += `<div class="no-results">Нет результатов для "${this.escapeHtml(query)}"</div>`;
            }
            
            resultsHtml += '</div>';
            this.$chatList.prepend(resultsHtml);
        },
        
        showAutocomplete: function (query) {
            var suggestions = this.getAutocompleteSuggestions(query);
            if (suggestions.length === 0) {
                this.hideAutocomplete();
                return;
            }
            
            var autocompleteHtml = '<div class="search-autocomplete">';
            suggestions.forEach(suggestion => {
                autocompleteHtml += `
                    <div class="autocomplete-item" data-query="${this.escapeHtml(suggestion)}">
                        <i class="fas fa-search"></i>
                        <span class="suggestion-text">${this.highlightSearchText(suggestion, query)}</span>
                    </div>
                `;
            });
            autocompleteHtml += '</div>';
            
            // Remove existing autocomplete
            this.hideAutocomplete();
            
            // Position autocomplete below search input
            this.$searchInput.closest('.search-box').css('position', 'relative').append(autocompleteHtml);
            
            // Handle autocomplete clicks
            this.$el.find('.autocomplete-item').on('click', (e) => {
                var selectedQuery = $(e.currentTarget).data('query');
                this.$searchInput.val(selectedQuery);
                this.searchChats(selectedQuery);
                this.hideAutocomplete();
            });
        },
        
        hideAutocomplete: function () {
            this.$el.find('.search-autocomplete').remove();
        },
        
        getAutocompleteSuggestions: function (query) {
            if (query.length < 2) return [];
            
            var suggestions = [];
            var lowerQuery = query.toLowerCase();
            var allNames = [];
            
            // Collect all room and user names
            this.allRooms.forEach(room => {
                allNames.push(room.name);
            });
            
            // Bilingual common suggestions with translations
            var bilingualSuggestions = [
                // Russian-English pairs
                'привет', 'hello', 'hi',
                'чат', 'chat', 'conversation',
                'группа', 'group', 'team',
                'общение', 'message', 'messages',
                'новый', 'new', 'create',
                'друг', 'friend', 'contact',
                'семья', 'family', 'home',
                'работа', 'work', 'job', 'office',
                'проект', 'project', 'task',
                'встреча', 'meeting', 'call',
                'помощь', 'help', 'support',
                'информация', 'info', 'information',
                'документ', 'document', 'file',
                'фото', 'photo', 'image', 'picture',
                'видео', 'video', 'media',
                'музыка', 'music', 'audio',
                'ссылка', 'link', 'url',
                'новости', 'news', 'updates',
                'событие', 'event', 'calendar',
                'задача', 'task', 'todo',
                'план', 'plan', 'schedule',
                'отчет', 'report', 'summary',
                'идея', 'idea', 'suggestion',
                'вопрос', 'question', 'ask',
                'ответ', 'answer', 'reply',
                'комментарий', 'comment', 'feedback',
                'обсуждение', 'discussion', 'talk'
            ];
            
            // Add all suggestions
            allNames = allNames.concat(bilingualSuggestions);
            
            // Find matching suggestions with trigram fuzzy matching
            allNames.forEach(name => {
                var lowerName = name.toLowerCase();
                var score = 0;
                
                // Exact match gets highest score
                if (lowerName === lowerQuery) {
                    score = 100;
                } else if (lowerName.startsWith(lowerQuery)) {
                    score = 80;
                } else if (lowerName.includes(lowerQuery)) {
                    score = 60;
                } else if (this.trigramMatch(lowerQuery, lowerName)) {
                    score = 40;
                }
                
                if (score > 0 && suggestions.indexOf(name) === -1) {
                    suggestions.push({ name: name, score: score });
                }
            });
            
            // Also add transliteration suggestions
            var transliterations = this.getTransliterations(query);
            transliterations.forEach(trans => {
                allNames.forEach(name => {
                    var lowerName = name.toLowerCase();
                    if (lowerName.includes(trans) && !suggestions.find(s => s.name === name)) {
                        suggestions.push({ name: name, score: 30 });
                    }
                });
            });
            
            // Sort by score (highest first) then by relevance
            suggestions.sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                
                var aLower = a.name.toLowerCase();
                var bLower = b.name.toLowerCase();
                
                // Prioritize common words
                var commonWords = ['hello', 'chat', 'group', 'message', 'new', 'привет', 'чат', 'группа', 'сообщение', 'новый'];
                var aIsCommon = commonWords.includes(aLower);
                var bIsCommon = commonWords.includes(bLower);
                if (aIsCommon && !bIsCommon) return -1;
                if (bIsCommon && !aIsCommon) return 1;
                
                // Alphabetical
                return a.name.localeCompare(b.name);
            });
            
            // Return just the names, limited to 5
            return suggestions.slice(0, 5).map(s => s.name);
        },
        
        getTransliterations: function (query) {
            var transliterations = [];
            var cyrillicToLatin = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
                'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
                'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
                'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
            };
            
            // Transliterate Russian to Latin
            var latin = '';
            for (var i = 0; i < query.length; i++) {
                var char = query[i].toLowerCase();
                latin += cyrillicToLatin[char] || char;
            }
            if (latin !== query.toLowerCase()) {
                transliterations.push(latin);
            }
            
            return transliterations;
        },
        
        showSearchResults: function (query, count) {
            this.$chatList.find('.search-results-info').remove();
            
            var resultsHtml = `
                <div class="search-results-info">
                    ${count > 0 ? 
                        `Найдено чатов: ${count} для "${this.escapeHtml(query)}"` : 
                        `Нет чатов для "${this.escapeHtml(query)}"`
                    }
                </div>
            `;
            this.$chatList.prepend(resultsHtml);
        },
        
        hideSearchResults: function () {
            this.$chatList.find('.search-results-info').remove();
            this.$chatList.find('.search-users-section').remove();
        },
        
        handleSearchAction: function () {
            var query = this.$searchInput.val().trim();
            if (query) {
                // If pressing Enter on search, create new chat with first matching user
                var self = this;
                this.pendingUsersCallback = function(users) {
                    var matchingUsers = users.filter(user => 
                        user.name.toLowerCase().includes(query.toLowerCase())
                    );
                    if (matchingUsers.length > 0) {
                        self.createDirectChat(matchingUsers[0].id);
                    }
                };
                this.wsSend({ type: 'getUsers' });
            }
        },

        renderSearchUsers: function (users, query) {
            this.$chatList.find('.search-users-section').remove();
            
            if (users.length === 0 || !query) return;
            
            var lowerQuery = query.toLowerCase();
            
            // Filter users by search query with fuzzy matching
            var filteredUsers = users.filter(user => {
                var userName = user.name.toLowerCase();
                var userUserName = user.userName.toLowerCase();
                
                // Exact match in full name
                if (userName.includes(lowerQuery)) return true;
                
                // Exact match in username
                if (userUserName.includes(lowerQuery)) return true;
                
                // Check if query parts match name parts
                var queryParts = lowerQuery.split(' ');
                var nameParts = userName.split(' ');
                
                // Match any query part to any name part
                for (var i = 0; i < queryParts.length; i++) {
                    for (var j = 0; j < nameParts.length; j++) {
                        if (nameParts[j].includes(queryParts[i])) {
                            return true;
                        }
                    }
                }
                
                // Fuzzy matching with trigrams
                if (this.trigramMatch(lowerQuery, userName) || this.trigramMatch(lowerQuery, userUserName)) {
                    return true;
                }
                
                return false;
            });
            
            if (filteredUsers.length === 0) return;
            
            let html = '<div class="search-users-section"><div class="search-section-title">Контакты</div>';
            
            filteredUsers.forEach(user => {
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
            console.log('Showing context menu at:', x, y, 'for message:', messageId);
            const message = this.messages[messageIndex];
            const isOwn = message.fromUserId === this.getUser().id;
            
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
            if (!this.currentRoom) return;
            
            // Check if we have a pending image
            if (this.pendingImage) {
                this.sendImageWithCaption(message);
                return;
            }
            
            if (!message) return; // Don't send empty text messages
            
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
        
        sendImageWithCaption: function (caption) {
            if (!this.pendingImage || !this.currentRoom) return;
            
            var data = {
                type: 'sendMessage',
                roomId: this.currentRoom.id,
                message: caption || this.pendingImage.fileName,
                attachmentType: 'image',
                attachmentUrl: this.pendingImage.base64,
                attachmentName: this.pendingImage.fileName
            };
            
            if (this.replyingTo) {
                data.replyToId = this.replyingTo.id;
            }
            
            console.log('Sending image with caption to room:', this.currentRoom.id);
            this.wsSend(data);
            
            // Clean up
            this.pendingImage = null;
            this.$el.find('.image-preview').remove();
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
                    // WhatsApp-like compression
                    var canvas = document.createElement('canvas');
                    var width = img.width;
                    var height = img.height;
                    
                    // Limit to 1080px (WhatsApp standard)
                    var maxDimension = 1080;
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
                    
                    // Higher compression for WhatsApp-like quality
                    var base64 = canvas.toDataURL('image/jpeg', 0.7);
                    console.log('Compressed base64 length:', base64.length);
                    
                    // Check size limit (5MB for WebSocket)
                    if (base64.length > 5 * 1024 * 1024) {
                        // Try even more compression
                        base64 = canvas.toDataURL('image/jpeg', 0.5);
                        if (base64.length > 5 * 1024 * 1024) {
                            Espo.Ui.error('Изображение слишком большое. Попробуйте файл меньшего размера.');
                            return;
                        }
                    }
                    
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
            
            // Show image preview in input area like WhatsApp
            this.showImagePreview(base64, fileName);
        },
        
        showImagePreview: function (base64, fileName) {
            // Remove existing preview
            this.$el.find('.image-preview').remove();
            
            var previewHtml = `
                <div class="image-preview">
                    <div class="preview-image">
                        <img src="${base64}" alt="${this.escapeHtml(fileName)}" />
                        <button class="remove-image" onclick="this.closest('.image-preview').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="preview-caption">
                        <input type="text" placeholder="Добавьте подпись..." class="image-caption-input" />
                    </div>
                </div>
            `;
            
            // Insert before message input container
            this.$el.find('.message-input-container').before(previewHtml);
            
            // Focus on caption input
            this.$el.find('.image-caption-input').focus();
            
            // Store image data for sending
            this.pendingImage = {
                base64: base64,
                fileName: fileName
            };
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

        // Delete chat functions
        showDeleteChatDialog: function () {
            if (!this.currentRoom) {
                Espo.Ui.error('Выберите чат для удаления');
                return;
            }
            
            $('#deleteChatModal').show();
        },
        
        closeDeleteDialog: function () {
            $('#deleteChatModal').hide();
        },
        
        deleteChat: function () {
            if (!this.currentRoom) {
                return;
            }
            
            const roomId = this.currentRoom.id;
            
            // Send delete request via WebSocket
            this.wsSend({
                type: 'deleteRoom',
                roomId: roomId
            });
            
            // Close modal
            this.closeDeleteDialog();
            
            // Don't clear immediately - wait for server response
            // The room will be cleared when we receive roomDeletedSuccess
        },

        onRemove: function () {
            if (this.ws) {
                this.ws.close();
            }
        }

    });
});
