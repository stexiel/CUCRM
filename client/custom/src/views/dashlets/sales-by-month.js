define('custom:views/dashlets/sales-by-month', ['views/dashlets/abstract/base'], function (Dep) {

    return Dep.extend({

        name: 'SalesByMonth',

        templateContent: `
            <div class="dashlet-body">
                <div class="sales-table-container" style="overflow-x: auto;">
                    <table class="sales-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 10px; text-align: left; font-weight: 600;">Подразделение</th>
                                <th style="padding: 10px; text-align: right; font-weight: 600;">Продажи за месяц</th>
                                <th style="padding: 10px; text-align: right; font-weight: 600;">Средний чек</th>
                                <th style="padding: 10px; text-align: right; font-weight: 600;">Кол-во чеков</th>
                            </tr>
                        </thead>
                        <tbody data-name="salesTableBody">
                            <tr>
                                <td colspan="4" style="padding: 40px; text-align: center; color: #999;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                                    <div style="margin-top: 10px;">Загрузка...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <style>
                .sales-table tbody tr {
                    border-bottom: 1px solid #e9ecef;
                    transition: background 0.2s;
                }
                .sales-table tbody tr:hover {
                    background: #f8f9fa;
                }
                .sales-table td {
                    padding: 10px;
                }
                .store-name {
                    font-weight: 600;
                    color: #333;
                }
                .sales-amount {
                    color: #28a745;
                    font-weight: 600;
                }
            </style>
        `,

        setup: function () {
            this.getCollectionFactory().create('CMotivation', (collection) => {
                this.collection = collection;
                this.collection.maxSize = 1000; // берём максимум, сами сгруппируем
                this.collection.url = 'CMotivation';
                
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
            const startDate = moment().startOf('month').format('YYYY-MM-DD');
            const endDate = moment().endOf('month').format('YYYY-MM-DD');
            
            this.collection.data = {
                where: [
                    {
                        type: 'between',
                        attribute: 'date',
                        value: [startDate, endDate]
                    }
                ],
                orderBy: 'date',
                order: 'asc'
            };
            
            this.collection.fetch().then(() => {
                this.renderTable();
            }).catch((err) => {
                console.error('Error loading motivation for SalesByMonth:', err);
                this.$el.find('[data-name="salesTableBody"]').html(
                    '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #dc3545;">Ошибка загрузки данных</td></tr>'
                );
            });
        },

        renderTable: function () {
            const $tbody = this.$el.find('[data-name="salesTableBody"]');
            $tbody.empty();

            if (!this.collection || this.collection.models.length === 0) {
                $tbody.html('<tr><td colspan="4" style="padding: 40px; text-align: center; color: #999;">Нет данных за текущий месяц</td></tr>');
                return;
            }

            // Группируем по nameStore
            const agg = {};
            this.collection.models.forEach((model) => {
                const storeName = model.get('nameStore') || 'Не указано';
                const sales = model.get('sales') || 0;
                const avgCheck = model.get('avarageCheck') || 0;
                const checkCount = model.get('numberofproduct') || 0;

                if (!agg[storeName]) {
                    agg[storeName] = {sales: 0, totalAvg: 0, totalChecks: 0, rows: 0};
                }

                agg[storeName].sales += sales;
                agg[storeName].totalAvg += avgCheck;
                agg[storeName].totalChecks += checkCount;
                agg[storeName].rows += 1;
            });

            // Преобразуем в массив и сортируем по продажам
            const rows = Object.keys(agg).map((storeName) => {
                const item = agg[storeName];
                const avgCheck = item.rows > 0 ? Math.round(item.totalAvg / item.rows) : 0;
                return {
                    storeName: storeName,
                    sales: item.sales,
                    avgCheck: avgCheck,
                    checks: item.totalChecks
                };
            }).sort((a, b) => b.sales - a.sales);

            rows.forEach((row) => {
                const $row = $(`
                    <tr>
                        <td class="store-name">${this.escapeHtml(row.storeName)}</td>
                        <td style="text-align: right;" class="sales-amount">${this.formatNumber(row.sales)} ₸</td>
                        <td style="text-align: right;">${this.formatNumber(row.avgCheck)} ₸</td>
                        <td style="text-align: right;">${row.checks}</td>
                    </tr>
                `);

                $tbody.append($row);
            });
        },

        formatNumber: function (num) {
            if (!num) return '0';
            return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
