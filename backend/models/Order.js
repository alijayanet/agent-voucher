const database = require('../config/database');

class OrderModel {
    // Initialize orders table
    static async initialize() {
        const sql = `
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                profile_id INTEGER NOT NULL,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT NOT NULL,
                payment_reference TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                FOREIGN KEY (profile_id) REFERENCES voucher_profiles (id)
            )
        `;
        
        return new Promise((resolve, reject) => {
            database.getDb().run(sql, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Create new order
    static async create(orderData) {
        const { order_id, profile_id, customer_name, customer_phone, amount, payment_method } = orderData;
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO orders (order_id, profile_id, customer_name, customer_phone, amount, payment_method)
                        VALUES (?, ?, ?, ?, ?, ?)`;
            
            database.getDb().run(sql, [order_id, profile_id, customer_name, customer_phone, amount, payment_method], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            order_id,
                            profile_id,
                            customer_name,
                            customer_phone,
                            amount,
                            payment_method,
                            status: 'pending',
                            created_at: new Date().toISOString()
                        });
                    }
                });
        });
    }

    // Get order by ID
    static async getById(orderId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM orders WHERE order_id = ?`;
            
            database.getDb().get(sql, [orderId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Update order status
    static async updateStatus(orderId, status, paymentReference = null) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE orders SET status = ?, payment_reference = ?, processed_at = CURRENT_TIMESTAMP WHERE order_id = ?`;
            
            database.getDb().run(sql, [status, paymentReference, orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Get all orders with pagination
    static async getAll(page = 1, limit = 10, filter = {}) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT o.*, vp.name as profile_name FROM orders o 
                      LEFT JOIN voucher_profiles vp ON o.profile_id = vp.id`;
            let countSql = `SELECT COUNT(*) as total FROM orders`;
            let params = [];
            let conditions = [];

            // Filter by status
            if (filter.status) {
                conditions.push('o.status = ?');
                params.push(filter.status);
            }

            // Filter by date range
            if (filter.date_from) {
                conditions.push('o.created_at >= ?');
                params.push(filter.date_from);
            }

            if (filter.date_to) {
                conditions.push('o.created_at <= ?');
                params.push(filter.date_to);
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ');
                sql += whereClause;
                countSql += whereClause;
            }

            sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, (page - 1) * limit);

            // Get total count
            database.getDb().get(countSql, params.slice(0, -2), (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get orders
                database.getDb().all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            orders: rows,
                            total: countResult.total,
                            page: page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }
}

// Initialize table when module is loaded
OrderModel.initialize().catch(console.error);

module.exports = OrderModel;