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
            this.allRooms = []; // Store all rooms for search
            this.replyingTo = null;
            this.editingMessage = null;
            this.loadRooms();
            
            // No auto-refresh - only update on send/receive
            
            // Check typing users every 2 seconds
            this.typingInterval = setInterval(() => {
                this.checkTypingUsers();
            }, 2000);
            
            // Update online status every 30 seconds
            this.onlineInterval = setInterval(() => {
                this.updateOnlineStatus();
            }, 30000);
            
            // Initial online status
            this.updateOnlineStatus();
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
            Espo.Ajax.getRequest('Chat/action/rooms').then(rooms => {
                // Всегда поднимаем "Общая группа" наверх, остальные по времени
                rooms.sort((a, b) => {
                    if (a.name === 'Общая группа') return -1;
                    if (b.name === 'Общая группа') return 1;
                    const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return tb - ta;
                });

                this.allRooms = rooms;
                this.rooms = rooms;
                this.renderRooms();
            });
        },

        silentRefresh: function () {
            // Silent update without re-rendering
            Espo.Ajax.getRequest('Chat/action/rooms').then(rooms => {
                // Сортируем так же, как в loadRooms
                rooms.sort((a, b) => {
                    if (a.name === 'Общая группа') return -1;
                    if (b.name === 'Общая группа') return 1;
                    const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return tb - ta;
                });

                this.allRooms = rooms;
                
                // Only update if search is not active
                if (!this.$searchInput || !this.$searchInput.val()) {
                    const currentScrollPos = this.$chatList ? this.$chatList.scrollTop() : 0;
                    this.rooms = rooms;
                    this.renderRooms();
                    
                    // Restore scroll position
                    if (this.$chatList) {
                        this.$chatList.scrollTop(currentScrollPos);
                    }
                }
            });
            
            // Refresh messages if chat is open
            if (this.currentRoom) {
                const currentScrollPos = this.$messagesContainer ? this.$messagesContainer.scrollTop() : 0;
                const isAtBottom = this.$messagesContainer ? 
                    (this.$messagesContainer[0].scrollHeight - this.$messagesContainer.scrollTop() - this.$messagesContainer.outerHeight() < 50) : false;
                
                Espo.Ajax.getRequest('Chat/action/messages', {roomId: this.currentRoom.id}).then(messages => {
                    const oldCount = this.messages.length;
                    this.messages = messages;
                    this.renderMessages();
                    
                    // Auto-scroll only if was at bottom or new messages
                    if (isAtBottom || messages.length > oldCount) {
                        this.scrollToBottom();
                    } else {
                        // Restore scroll position
                        if (this.$messagesContainer) {
                            this.$messagesContainer.scrollTop(currentScrollPos);
                        }
                    }
                });
            }
        },

        loadMessages: function (roomId) {
            Espo.Ajax.getRequest('Chat/action/messages', {roomId: roomId}).then(messages => {
                this.messages = messages;
                this.renderMessages();
                this.scrollToBottom();
                this.markRoomAsRead(roomId);
            });
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

        markRoomAsRead: function (roomId) {
            Espo.Ajax.postRequest('Chat/action/markAsRead', {
                roomId: roomId
            });
        },

        showNewChatDialog: function () {
            Espo.Ajax.getRequest('Chat/action/users').then(users => {
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
                }, view => {
                    view.render();
                });
            });
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
            const userId = $('#selectUser').val();
            if (!userId) {
                Espo.Ui.error('Выберите пользователя');
                return;
            }
            
            Espo.Ajax.postRequest('Chat/action/sendMessage', {
                toUserId: userId,
                message: 'Привет!'
            }).then(() => {
                this.loadRooms();
                this.closeDialog();
            });
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
                // Show all rooms when search is empty
                this.rooms = this.allRooms;
                this.renderRooms();
                this.$chatList.find('.search-users-section').remove();
                return;
            }
            
            // Filter from all rooms
            const filtered = this.allRooms.filter(room => 
                room.name.toLowerCase().includes(query.toLowerCase())
            );
            
            this.rooms = filtered;
            this.renderRooms();
            
            // Show ALL users (not filtered by query)
            Espo.Ajax.getRequest('Chat/action/users').then(users => {
                this.renderSearchUsers(users);
            });
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
            // Send first message to create chat
            Espo.Ajax.postRequest('Chat/action/sendMessage', {
                toUserId: userId,
                message: 'Привет! 👋'
            }).then(() => {
                this.$searchInput.val('');
                this.loadRooms();
            });
        },

        showNewGroupDialog: function () {
            Espo.Ajax.getRequest('Chat/action/users').then(users => {
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
                    
                    $('#createGroupBtn').on('click', () => {
                        this.createNewGroup();
                    });
                    
                    $('#cancelGroupBtn').on('click', () => {
                        this.closeDialog();
                    });
                });
            });
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
            
            Espo.Ajax.postRequest('Chat/action/createRoom', {
                name: name,
                type: 'group',
                participantIds: participantIds
            }).then((response) => {
                console.log('Group created:', response);
                this.clearView('dialog');
                Espo.Ui.success('Группа создана');
                
                // Reload rooms and open the new group
                this.loadRooms();
                
                // Wait a bit then select the new room
                setTimeout(() => {
                    const newRoom = this.rooms.find(r => r.id === response.id);
                    if (newRoom) {
                        this.selectRoom(newRoom.id);
                    }
                }, 500);
            }).catch((error) => {
                console.error('Error creating group:', error);
                Espo.Ui.error('Ошибка создания группы: ' + (error.message || 'Неизвестная ошибка'));
            });
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
            
            // Get room participants
            Espo.Ajax.getRequest('Chat/action/rooms').then(rooms => {
                const room = rooms.find(r => r.id === this.currentRoom.id);
                if (room && room.type === 'group') {
                    this.renderGroupParticipants(room);
                    this.$groupInfoPanel.addClass('active');
                }
            });
        },

        hideGroupInfo: function () {
            this.$groupInfoPanel.removeClass('active');
        },

        renderGroupParticipants: function (room) {
            const participantsList = this.$el.find('#groupParticipantsList');
            let html = '';
            
            // Get participants from room (you may need to add this to API)
            Espo.Ajax.getRequest('Chat/action/users').then(users => {
                users.forEach(user => {
                    const initials = user.name.substring(0, 2).toUpperCase();
                    html += `
                        <div class="participant-list-item">
                            <div class="participant-list-avatar">${initials}</div>
                            <div class="participant-list-name">${this.escapeHtml(user.name)}</div>
                        </div>
                    `;
                });
                participantsList.html(html);
            });
        },

        showAddParticipantsDialog: function () {
            if (!this.currentRoom) return;
            
            Espo.Ajax.getRequest('Chat/action/users').then(users => {
                this.createView('addParticipantsDialog', 'views/modal', {
                    templateContent: this.getAddParticipantsDialogHtml(users),
                    backdrop: true,
                    headerText: 'Добавить участников'
                }, view => {
                    view.render();
                    
                    $('#addSelectedBtn').on('click', () => {
                        this.addParticipantsToGroup();
                    });
                    
                    $('#cancelAddBtn').on('click', () => {
                        this.clearView('addParticipantsDialog');
                    });
                });
            });
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
            Espo.Ajax.postRequest('Chat/action/addParticipants', {
                roomId: this.currentRoom.id,
                participantIds: participantIds
            }).then(() => {
                this.clearView('addParticipantsDialog');
                this.showGroupInfo(); // Refresh participants list
                Espo.Ui.success('Участники добавлены');
            });
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
            
            Espo.Ajax.postRequest('Chat/action/deleteMessage', {
                messageId: messageId
            }).then(() => {
                this.loadMessages(this.currentRoom.id);
                Espo.Ui.success('Сообщение удалено');
            });
        },

        togglePinMessage: function (messageId, pinned) {
            Espo.Ajax.postRequest('Chat/action/pinMessage', {
                messageId: messageId,
                pinned: pinned
            }).then(() => {
                this.loadMessages(this.currentRoom.id);
                Espo.Ui.success(pinned ? 'Сообщение закреплено' : 'Сообщение откреплено');
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
            Espo.Ajax.postRequest('Chat/action/reactToMessage', {
                messageId: messageId,
                emoji: emoji
            }).then(() => {
                this.loadMessages(this.currentRoom.id);
            });
        },

        sendMessage: function () {
            const message = this.$messageInput.val().trim();
            if (!message || !this.currentRoom) return;
            
            // Check if editing
            if (this.editingMessage) {
                Espo.Ajax.postRequest('Chat/action/editMessage', {
                    messageId: this.editingMessage.id,
                    message: message
                }).then(() => {
                    this.cancelEdit();
                    this.loadMessages(this.currentRoom.id);
                    this.loadRooms(); // Refresh rooms list
                });
                return;
            }
            
            const data = {
                roomId: this.currentRoom.id,
                message: message
            };
            
            // Add reply if replying
            if (this.replyingTo) {
                data.replyToId = this.replyingTo.id;
            }
            
            Espo.Ajax.postRequest('Chat/action/sendMessage', data).then(() => {
                this.$messageInput.val('');
                this.replyingTo = null;
                this.$el.find('.reply-preview').remove();
                this.loadMessages(this.currentRoom.id);
                this.loadRooms(); // Refresh rooms list
                this.setTyping(false);
            });
        },
        
        handleImageUpload: function (file) {
            if (!file || !this.currentRoom) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                
                // Send image as attachment
                const data = {
                    roomId: this.currentRoom.id,
                    message: file.name,
                    attachmentType: 'image',
                    attachmentUrl: base64,
                    attachmentName: file.name
                };
                
                if (this.replyingTo) {
                    data.replyToId = this.replyingTo.id;
                }
                
                Espo.Ajax.postRequest('Chat/action/sendMessage', data).then(() => {
                    this.replyingTo = null;
                    this.$el.find('.reply-preview').remove();
                    this.loadMessages(this.currentRoom.id);
                    this.loadRooms();
                    Espo.Ui.success('Изображение отправлено');
                }).catch(() => {
                    Espo.Ui.error('Ошибка отправки изображения');
                });
            };
            reader.readAsDataURL(file);
        },

        setTyping: function (isTyping) {
            if (!this.currentRoom) return;
            
            Espo.Ajax.postRequest('Chat/action/setTyping', {
                roomId: this.currentRoom.id,
                isTyping: isTyping
            });
        },

        updateOnlineStatus: function () {
            Espo.Ajax.postRequest('Chat/action/updateOnlineStatus', {});
        },

        checkTypingUsers: function () {
            if (!this.currentRoom) return;
            
            Espo.Ajax.getRequest('Chat/action/typingUsers', {
                roomId: this.currentRoom.id
            }).then(users => {
                const $status = this.$el.find('#chatStatus');
                if (users.length > 0) {
                    const names = users.map(u => u.name).join(', ');
                    $status.text(names + ' печатает...');
                } else {
                    $status.text('онлайн');
                }
            });
        },

        showManageParticipantsDialog: function () {
            if (!this.currentRoom || this.currentRoom.type !== 'group') {
                return;
            }
            
            // Get current participants and all users
            Promise.all([
                Espo.Ajax.getRequest('Chat/action/participants', { roomId: this.currentRoom.id }),
                Espo.Ajax.getRequest('Chat/action/users')
            ]).then(([participants, allUsers]) => {
                const participantIds = participants.map(p => p.id);
                
                this.createView('manageDialog', 'views/modal', {
                    templateContent: this.getManageParticipantsHtml(allUsers, participantIds),
                    backdrop: true,
                    headerText: 'Управление участниками'
                }, view => {
                    view.render();
                    
                    const roomId = this.currentRoom.id;
                    
                    // Handle participant toggle
                    $('#manageParticipantsList').on('click', '.participant-toggle', function() {
                        const $btn = $(this);
                        const userId = $btn.data('user-id');
                        const isParticipant = $btn.hasClass('remove');
                        
                        if (isParticipant) {
                            // Remove participant
                            Espo.Ajax.postRequest('Chat/action/removeParticipant', {
                                roomId: roomId,
                                userId: userId
                            }).then(() => {
                                $btn.removeClass('remove btn-danger').addClass('add btn-success');
                                $btn.html('<i class="fas fa-user-plus"></i> Добавить');
                                Espo.Ui.success('Участник удален');
                            }).catch(() => {
                                Espo.Ui.error('Ошибка удаления участника');
                            });
                        } else {
                            // Add participant
                            Espo.Ajax.postRequest('Chat/action/addParticipants', {
                                roomId: roomId,
                                participantIds: [userId]
                            }).then(() => {
                                $btn.removeClass('add btn-success').addClass('remove btn-danger');
                                $btn.html('<i class="fas fa-user-minus"></i> Удалить');
                                Espo.Ui.success('Участник добавлен');
                            }).catch(() => {
                                Espo.Ui.error('Ошибка добавления участника');
                            });
                        }
                    });
                    
                    $('#closeManageBtn').on('click', () => {
                        this.clearView('manageDialog');
                        this.loadRooms(); // Refresh rooms
                    });
                });
            });
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
            if (this.interval) {
                clearInterval(this.interval);
            }
            if (this.typingInterval) {
                clearInterval(this.typingInterval);
            }
            if (this.onlineInterval) {
                clearInterval(this.onlineInterval);
            }
        }

    });
});
