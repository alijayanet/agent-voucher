const database = require('../config/database');

class TransactionModel {
    // Membuat transaksi baru
    static async create(transactionData) {
        const { voucher_id, customer_name, customer_phone, amount, payment_method = 'cash', status = 'completed', created_by, notes } = transactionData;

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO transactions (voucher_id, customer_name, customer_phone, amount, payment_method, status, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

            database.getDb().run(sql, [voucher_id, customer_name, customer_phone, amount, payment_method, status, created_by],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            voucher_id,
                            customer_name,
                            customer_phone,
                            amount,
                            payment_method,
                            status,
                            created_by,
                            notes
                        });
                    }
                });
        });
    }

    // Mendapatkan transaksi berdasarkan ID
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT t.*, v.username, v.password, v.profile, v.duration
                FROM transactions t
                LEFT JOIN vouchers v ON t.voucher_id = v.id
                WHERE t.id = ?
            `;
            
            database.getDb().get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Mendapatkan semua transaksi dengan pagination
    static async getAll(page = 1, limit = 10, filter = {}) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT t.*, v.username, v.password, v.profile, v.duration
                FROM transactions t
                LEFT JOIN vouchers v ON t.voucher_id = v.id
            `;
            let countSql = `SELECT COUNT(*) as total FROM transactions t`;
            let params = [];
            let conditions = [];

            // Filter berdasarkan status
            if (filter.status) {
                conditions.push('t.status = ?');
                params.push(filter.status);
            }

            // Filter berdasarkan payment method
            if (filter.payment_method) {
                conditions.push('t.payment_method = ?');
                params.push(filter.payment_method);
            }

            // Filter berdasarkan tanggal
            if (filter.date_from) {
                conditions.push('t.created_at >= ?');
                params.push(filter.date_from);
            }

            if (filter.date_to) {
                conditions.push('t.created_at <= ?');
                params.push(filter.date_to);
            }

            // Filter berdasarkan customer
            if (filter.customer_name) {
                conditions.push('t.customer_name LIKE ?');
                params.push(`%${filter.customer_name}%`);
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ');
                sql += whereClause;
                countSql += whereClause;
            }

            sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, (page - 1) * limit);

            // Get total count
            database.getDb().get(countSql, params.slice(0, -2), (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get transactions
                database.getDb().all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            transactions: rows,
                            total: countResult.total,
                            page: page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }

    // Update status transaksi
    static async updateStatus(id, status) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE transactions SET status = ? WHERE id = ?`;
            
            database.getDb().run(sql, [status, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Menghapus transaksi
    static async delete(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM transactions WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Mendapatkan laporan penjualan harian
    static async getDailyReport(date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_revenue,
                    payment_method,
                    COUNT(*) as count_by_method
                FROM transactions 
                WHERE DATE(created_at) = ? AND status = 'completed'
                GROUP BY DATE(created_at), payment_method
            `;
            
            database.getDb().all(sql, [targetDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Mendapatkan laporan penjualan bulanan
    static async getMonthlyReport(year = null, month = null) {
        const targetYear = year || new Date().getFullYear();
        const targetMonth = month || (new Date().getMonth() + 1);
        
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    strftime('%Y-%m-%d', created_at) as date,
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_revenue
                FROM transactions 
                WHERE strftime('%Y', created_at) = ? 
                    AND strftime('%m', created_at) = ?
                    AND status = 'completed'
                GROUP BY strftime('%Y-%m-%d', created_at)
                ORDER BY date ASC
            `;
            
            const monthStr = targetMonth.toString().padStart(2, '0');
            
            database.getDb().all(sql, [targetYear.toString(), monthStr], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Mendapatkan top customers
    static async getTopCustomers(limit = 10) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    customer_name,
                    customer_phone,
                    COUNT(*) as total_purchases,
                    SUM(amount) as total_spent
                FROM transactions 
                WHERE status = 'completed' AND customer_name IS NOT NULL
                GROUP BY customer_name, customer_phone
                ORDER BY total_spent DESC
                LIMIT ?
            `;
            
            database.getDb().all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Mendapatkan statistik transaksi
    static async getStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_revenue,
                    AVG(amount) as average_transaction,
                    COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_transactions,
                    SUM(CASE WHEN DATE(created_at) = DATE('now') THEN amount ELSE 0 END) as today_revenue
                FROM transactions
                WHERE status = 'completed'
            `;
            
            database.getDb().get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
}

module.exports = TransactionModel;