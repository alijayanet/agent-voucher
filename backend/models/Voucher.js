const database = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class VoucherModel {
    // Membuat voucher baru
    static async create(voucherData) {
        const { profile, agent_price, duration, expiresAt, voucher_code_length } = voucherData;
        
        // Generate username with specified length or default to 4 digits
        const codeLength = voucher_code_length || 4;
        const username = this.generateUsername(codeLength);
        const password = username; // Same as username for Mikrotik compatibility
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vouchers (username, password, profile, agent_price, duration, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)`;
            
            database.getDb().run(sql, [username, password, profile, agent_price, duration, expiresAt], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            username,
                            password,
                            profile,
                            agent_price,
                            duration,
                            expires_at: expiresAt
                        });
                    }
                });
        });
    }

    // Membuat voucher dari import Mikrotik
    static async createFromImport(importData) {
        const { username, password, profile, agent_price, duration, expiresAt, is_used, imported_from_mikrotik } = importData;
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO vouchers (username, password, profile, agent_price, duration, expires_at, is_used)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            database.getDb().run(sql, [username, password, profile, agent_price, duration, expiresAt, is_used || false], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            username,
                            password,
                            profile,
                            agent_price,
                            duration,
                            expires_at: expiresAt,
                            is_used: is_used || false,
                            imported_from_mikrotik: imported_from_mikrotik || false
                        });
                    }
                });
        });
    }

    // Mendapatkan voucher berdasarkan ID
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers WHERE id = ?`;
            
            database.getDb().get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Mendapatkan voucher berdasarkan username
    static async getByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers WHERE username = ?`;
            
            database.getDb().get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Mendapatkan semua voucher dengan pagination
    static async getAll(page = 1, limit = 10, filter = {}) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM vouchers`;
            let countSql = `SELECT COUNT(*) as total FROM vouchers`;
            let params = [];
            let conditions = [];

            // Filter berdasarkan status
            if (filter.is_used !== undefined) {
                conditions.push('is_used = ?');
                params.push(filter.is_used);
            }

            // Filter berdasarkan profile
            if (filter.profile) {
                conditions.push('profile = ?');
                params.push(filter.profile);
            }

            // Filter berdasarkan tanggal
            if (filter.date_from) {
                conditions.push('created_at >= ?');
                params.push(filter.date_from);
            }

            if (filter.date_to) {
                conditions.push('created_at <= ?');
                params.push(filter.date_to);
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ');
                sql += whereClause;
                countSql += whereClause;
            }

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, (page - 1) * limit);

            // Get total count
            database.getDb().get(countSql, params.slice(0, -2), (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get vouchers
                database.getDb().all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            vouchers: rows,
                            total: countResult.total,
                            page: page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }

    // Menandai voucher sebagai digunakan
    static async markAsUsed(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE vouchers SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Menghapus voucher
    static async delete(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM vouchers WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Generate username random with specified length
    static generateUsername(length = 4) {
        // Generate a numeric code with specified length
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;
        const code = Math.floor(min + Math.random() * (max - min + 1));
        return code.toString();
    }

    // Generate password - same as username for Mikrotik compatibility
    static generatePassword() {
        // Password should be the same as username for Mikrotik compatibility
        // This method is kept for backward compatibility but should not be used independently
        return ''; // Will be set to match username in the create method
    }

    // Validasi voucher
    static async validate(username, password) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers WHERE username = ? AND password = ? AND is_used = FALSE`;
            
            database.getDb().get(sql, [username, password], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve({ valid: false, message: 'Voucher tidak ditemukan atau sudah digunakan' });
                } else {
                    // Check if expired
                    if (row.expires_at && moment().isAfter(moment(row.expires_at))) {
                        resolve({ valid: false, message: 'Voucher sudah expired' });
                    } else {
                        resolve({ valid: true, voucher: row });
                    }
                }
            });
        });
    }

    // Mendapatkan statistik voucher
    static async getStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_vouchers,
                    COUNT(CASE WHEN is_used = TRUE THEN 1 END) as used_vouchers,
                    COUNT(CASE WHEN is_used = FALSE THEN 1 END) as unused_vouchers,
                    SUM(CASE WHEN is_used = TRUE THEN agent_price ELSE 0 END) as total_revenue
                FROM vouchers
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

    // Mendapatkan voucher yang sudah expired
    static async getExpired() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers WHERE expires_at < CURRENT_TIMESTAMP AND is_used = FALSE`;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Menandai voucher sebagai expired
    static async markAsExpired(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE vouchers SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Mendapatkan semua voucher untuk sinkronisasi
    static async getAllForSync() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers ORDER BY created_at DESC`;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Update last activity
    static async updateLastActivity(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE vouchers SET used_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Mendapatkan voucher yang belum digunakan
    static async getUnused() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM vouchers WHERE is_used = FALSE ORDER BY created_at DESC`;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = VoucherModel;