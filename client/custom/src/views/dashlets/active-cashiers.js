define('custom:views/dashlets/active-cashiers', ['views/dashlets/abstract/base'], function (Dep) {

    return Dep.extend({

        name: 'ActiveCashiers',

        templateContent: `
            <div class="dashlet-body">
                <div class="cashiers-container" data-name="cashiersList"></div>
            </div>
            <style>
                .cashier-item {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.2s;
                }
                .cashier-item:hover {
                    background: #f8f9fa;
                    cursor: pointer;
                }
                .cashier-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .cashier-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: #007bff;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 14px;
                }
                .cashier-details {
                    flex: 1;
                }
                .cashier-name {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 2px;
                }
                .cashier-store {
                    font-size: 12px;
                    color: #666;
                }
                .cashier-order {
                    text-align: right;
                }
                .order-number {
                    font-size: 13px;
                    font-weight: 600;
                    color: #007bff;
                    margin-bottom: 2px;
                }
                .order-time {
                    font-size: 11px;
                    color: #999;
                }
                .no-data {
                    text-align: center;
                    padding: 40px 20px;
                    color: #999;
                }
                .status-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    margin-left: 8px;
                }
                .status-active {
                    background: #d4edda;
                    color: #155724;
                }
            </style>
        `,

        setup: function () {
            this.getCollectionFactory().create('Case', (collection) => {
                this.collection = collection;
                this.collection.maxSize = this.getOption('displayRecords') || 15;
                this.collection.url = 'Case';
                
                this.loadData();
                
                const interval = this.getOption('autorefreshInterval');
                if (interval) {
                    this.intervalId = setInterval(() => {
                        this.loadData();
                    }, interval * 60000);
                }
            });
        },

        loadData: function () {
            const today = moment().format('YYYY-MM-DD');
            const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD');
            
            this.collection.data = {
                where: [
                    {
                        type: 'between',
                        attribute: 'createdAt',
                        value: [today + ' 00:00:00', tomorrow + ' 00:00:00']
                    }
                ],
                orderBy: 'createdAt',
                order: 'desc',
                maxSize: this.getOption('displayRecords') || 15
            };
            
            this.collection.fetch().then(() => {
                console.log('Cases loaded:', this.collection.models.length);
                if (this.collection.models.length > 0) {
                    console.log('First case:', this.collection.models[0].attributes);
                }
                this.renderCashiersList();
            }).catch((err) => {
                console.error('Error loading cases:', err);
                this.$el.find('[data-name="cashiersList"]').html('<div class="no-data">Ошибка загрузки данных</div>');
            });
        },

        renderCashiersList: function () {
            const $container = this.$el.find('[data-name="cashiersList"]');
            $container.empty();

            if (this.collection.models.length === 0) {
                $container.html('<div class="no-data"><i class="fas fa-cash-register" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>Нет активных продаж</div>');
                return;
            }

            this.collection.models.forEach((model) => {
                // Получаем имя пользователя через assignedUser link
                let assignedUserName = 'Не назначен';
                if (model.get('assignedUserId')) {
                    assignedUserName = model.get('assignedUserName') || model.get('assignedUserId');
                }
                
                // Получаем название подразделения через account link  
                let accountName = '';
                if (model.get('accountId')) {
                    accountName = model.get('accountName') || model.get('accountId');
                }
                
                const caseNumber = model.get('number') || '';
                const createdAt = model.get('createdAt') || '';
                const timeAgo = this.getTimeAgo(createdAt);
                const initials = this.getInitials(assignedUserName);

                const $item = $(`
                    <div class="cashier-item" data-id="${model.id}">
                        <div class="cashier-info">
                            <div class="cashier-avatar">${initials}</div>
                            <div class="cashier-details">
                                <div class="cashier-name">
                                    ${this.escapeHtml(assignedUserName)}
                                    <span class="status-badge status-active">Активен</span>
                                </div>
                                <div class="cashier-store">${this.escapeHtml(accountName)}</div>
                            </div>
                        </div>
                        <div class="cashier-order">
                            <div class="order-number">№ ${this.escapeHtml(caseNumber)}</div>
                            <div class="order-time">${timeAgo}</div>
                        </div>
                    </div>
                `);

                $item.on('click', () => {
                    this.getRouter().navigate('#Case/view/' + model.id, {trigger: true});
                });

                $container.append($item);
            });
        },

        getInitials: function (name) {
            if (!name) return '?';
            const parts = name.trim().split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        },

        getTimeAgo: function (dateString) {
            if (!dateString) return '';
            const date = moment(dateString);
            const now = moment();
            const diffMinutes = now.diff(date, 'minutes');
            
            if (diffMinutes < 1) return 'только что';
            if (diffMinutes < 60) return diffMinutes + ' мин назад';
            
            const diffHours = now.diff(date, 'hours');
            if (diffHours < 24) return diffHours + ' ч назад';
            
            return date.format('DD.MM HH:mm');
        },

        escapeHtml: function (text) {
            if (!text) return '';
            if (typeof text !== 'string') {
                text = String(text);
            }
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, (m) => map[m]);
        },

        onRemove: function () {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }
        }
    });
});
