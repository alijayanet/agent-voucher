const database = require('../config/database');
const bcrypt = require('bcryptjs');

class AgentModel {
    // Create new agent
    static async create(agentData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { username, password, full_name, email, phone, address } = agentData;
                
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                const sql = `
                    INSERT INTO users (username, password, full_name, email, phone, address, role, is_active, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, 'agent', 1, CURRENT_TIMESTAMP)
                `;
                
                database.getDb().run(sql, [username, hashedPassword, full_name, email, phone, address], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            username,
                            full_name,
                            email,
                            phone,
                            address,
                            role: 'agent',
                            is_active: true,
                            created_at: new Date().toISOString()
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Get all agents
    static async getAll() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, username, full_name, email, phone, address, is_active, created_at, last_login, updated_at, 
                       COALESCE(balance, 0) as balance
                FROM users 
                WHERE role = 'agent'
                ORDER BY created_at DESC
            `;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Database error in getAll:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get agent by ID
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, username, full_name, email, phone, address, is_active, created_at, last_login, updated_at, 
                       COALESCE(balance, 0) as balance
                FROM users 
                WHERE id = ? AND role = 'agent'
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

    // Update agent
    static async update(id, agentData) {
        return new Promise((resolve, reject) => {
            const { full_name, email, phone, address, is_active, balance } = agentData;
            
            let sql = `
                UPDATE users 
                SET full_name = ?, email = ?, phone = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            `;
            let params = [full_name, email, phone, address, is_active];
            
            // Add balance to update if provided
            if (balance !== undefined) {
                sql = sql.replace('updated_at = CURRENT_TIMESTAMP', 'balance = ?, updated_at = CURRENT_TIMESTAMP');
                params.splice(-1, 0, balance);
            }
            
            sql += ` WHERE id = ? AND role = 'agent'`;
            params.push(id);
            
            database.getDb().run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        AgentModel.getById(id).then(resolve).catch(reject);
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    // Delete agent
    static async delete(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM users WHERE id = ? AND role = 'agent'`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Get agent statistics
    static async getStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 0 THEN 0 ELSE 1 END) as active,
                    COALESCE(SUM(COALESCE(balance, 0)), 0) as total_balance
                FROM users 
                WHERE role = 'agent'
            `;
            
            database.getDb().get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const result = {
                        total: row.total || 0,
                        active: row.active || 0,
                        total_balance: row.total_balance || 0,
                        transactions: 0,
                        revenue: 0
                    };
                    resolve(result);
                }
            });
        });
    }

    // Update last login
    static async updateLastLogin(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Change password
    static async changePassword(id, newPassword) {
        return new Promise(async (resolve, reject) => {
            try {
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                
                const sql = `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'agent'`;
                
                database.getDb().run(sql, [hashedPassword, id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Update agent balance only
    static async updateBalance(id, balance) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'agent'`;
            database.getDb().run(sql, [balance, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Check if username exists
    static async usernameExists(username, excludeId = null) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT id FROM users WHERE username = ?`;
            let params = [username];
            
            if (excludeId) {
                sql += ` AND id != ?`;
                params.push(excludeId);
            }
            
            database.getDb().get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }
}

module.exports = AgentModel;
