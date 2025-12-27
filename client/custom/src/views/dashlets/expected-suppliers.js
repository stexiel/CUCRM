define('custom:views/dashlets/expected-suppliers', ['views/dashlets/abstract/base'], function (Dep) {

    return Dep.extend({

        name: 'ExpectedSuppliers',

        templateContent: `
            <div class="dashlet-body">
                <div class="list-container" data-name="suppliersList"></div>
            </div>
            <style>
                .supplier-item {
                    padding: 12px;
                    border-bottom: 1px solid #e9ecef;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.2s;
                }
                .supplier-item:hover {
                    background: #f8f9fa;
                }
                .supplier-info {
                    flex: 1;
                }
                .supplier-name {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 4px;
                }
                .supplier-store {
                    font-size: 12px;
                    color: #666;
                }
                .supplier-details {
                    text-align: right;
                }
                .supplier-amount {
                    font-size: 16px;
                    font-weight: bold;
                    color: #5cb85c;
                    margin-bottom: 4px;
                }
                .supplier-doc {
                    font-size: 11px;
                    color: #999;
                }
                .no-data {
                    text-align: center;
                    padding: 40px 20px;
                    color: #999;
                }
            </style>
        `,

        setup: function () {
            this.getCollectionFactory().create('CTMO', (collection) => {
                this.collection = collection;
                this.collection.maxSize = this.getOption('displayRecords') || 10;
                this.collection.url = 'CTMO';
                
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
            const futureDate = moment().add(7, 'days').format('YYYY-MM-DD');
            
            this.collection.data = {
                where: [
                    {
                        type: 'between',
                        attribute: 'dateOfReceiptOfGoods',
                        value: [today, futureDate]
                    }
                ],
                orderBy: 'dateOfReceiptOfGoods',
                order: 'asc'
            };
            
            this.collection.fetch().then(() => {
                this.renderSuppliersList();
            }).catch((err) => {
                console.error('Error loading TMO:', err);
                this.$el.find('[data-name="suppliersList"]').html('<div class="no-data">Ошибка загрузки данных</div>');
            });
        },

        renderSuppliersList: function () {
            const $container = this.$el.find('[data-name="suppliersList"]');
            $container.empty();

            if (this.collection.models.length === 0) {
                $container.html('<div class="no-data"><i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>Нет ожидаемых поставок</div>');
                return;
            }

            this.collection.models.forEach((model) => {
                // Получаем данные поставщика и магазина через связи
                const supplierId = model.get('supplierId');
                const storeStatusId = model.get('storeStatusId');
                
                const supplierName = model.get('supplierName') || 'Не указан';
                const storeName = model.get('storeStatusName') || '';
                const amount = model.get('amountOfGoodsReceived') || 0;
                const docNumber = model.get('name') || '';
                const date = model.get('dateOfReceiptOfGoods') || '';

                const $item = $(`
                    <div class="supplier-item" data-id="${model.id}">
                        <div class="supplier-info">
                            <div class="supplier-name">${this.escapeHtml(supplierName)}</div>
                            <div class="supplier-store">${this.escapeHtml(storeName)} • ${date}</div>
                        </div>
                        <div class="supplier-details">
                            <div class="supplier-amount">${this.formatNumber(amount)} ₸</div>
                            <div class="supplier-doc">№ ${this.escapeHtml(docNumber)}</div>
                        </div>
                    </div>
                `);

                $item.on('click', () => {
                    this.getRouter().navigate('#CTMO/view/' + model.id, {trigger: true});
                });

                $container.append($item);
            });
        },

        formatNumber: function (num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        escapeHtml: function (text) {
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
