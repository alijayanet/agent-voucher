const database = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserModel {
    // Membuat user baru
    static async create(userData) {
        const { username, password, email, full_name, role = 'agent' } = userData;
        
        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO users (username, password, email, full_name, role)
                        VALUES (?, ?, ?, ?, ?)`;
            
            database.getDb().run(sql, [username, hashedPassword, email, full_name, role], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            username,
                            email,
                            full_name,
                            role
                        });
                    }
                });
        });
    }

    // Login user
    static async login(username, password) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE username = ? AND is_active = TRUE`;
            
            database.getDb().get(sql, [username], (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!user) {
                    resolve({ success: false, message: 'Username tidak ditemukan' });
                    return;
                }
                
                // Check password
                const isPasswordValid = bcrypt.compareSync(password, user.password);
                if (!isPasswordValid) {
                    resolve({ success: false, message: 'Password salah' });
                    return;
                }
                
                // Generate JWT token
                const token = jwt.sign(
                    { 
                        id: user.id, 
                        username: user.username, 
                        role: user.role 
                    },
                    process.env.JWT_SECRET || 'voucher_wifi_secret_key',
                    { expiresIn: '24h' }
                );
                
                // Update last login
                this.updateLastLogin(user.id);
                
                // Save session
                this.createSession(user.id, token);
                
                resolve({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role
                    }
                });
            });
        });
    }

    // Update last login
    static async updateLastLogin(userId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
            database.getDb().run(sql, [userId], function(err) {
                if (err) {
                    console.error('Error updating last login:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Create session
    static async createSession(userId, token) {
        return new Promise((resolve, reject) => {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
            
            const sql = `INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`;
            database.getDb().run(sql, [userId, token, expiresAt.toISOString()], function(err) {
                if (err) {
                    console.error('Error creating session:', err);
                    reject(err);
                } else {
                    console.log('✅ Session created for user:', userId);
                    resolve();
                }
            });
        });
    }

    // Verify token
    static async verifyToken(token) {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔍 Verifying token:', token ? `${token.substring(0, 20)}...` : 'None');
                
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'voucher_wifi_secret_key');
                console.log('✅ JWT decoded successfully:', { id: decoded.id, username: decoded.username, role: decoded.role });
                
                // Check if session exists and not expired
                const sql = `SELECT s.*, u.username, u.full_name, u.role, u.is_active, u.email, u.phone, u.balance
                           FROM user_sessions s 
                           JOIN users u ON s.user_id = u.id 
                           WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE`;
                
                console.log('🔍 Checking session in database...');
                database.getDb().get(sql, [token], (err, session) => {
                    if (err) {
                        console.error('❌ Database error during session check:', err);
                        reject(err);
                        return;
                    }
                    
                    if (!session) {
                        console.log('❌ No valid session found in database');
                        resolve({ valid: false, message: 'Session expired or invalid' });
                        return;
                    }
                    
                    console.log('✅ Valid session found for user:', session.username);
                    resolve({
                        valid: true,
                        user: {
                            id: decoded.id,
                            username: session.username,
                            full_name: session.full_name,
                            email: session.email,
                            phone: session.phone,
                            role: session.role,
                            balance: session.balance
                        }
                    });
                });
            } catch (error) {
                console.error('❌ JWT verification failed:', error.message);
                resolve({ valid: false, message: 'Invalid token' });
            }
        });
    }

    // Logout user
    static async logout(token) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM user_sessions WHERE token = ?`;
            
            database.getDb().run(sql, [token], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true, message: 'Logout successful' });
                }
            });
        });
    }

    // Get user by ID
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, username, email, full_name, role, is_active, last_login, created_at 
                        FROM users WHERE id = ?`;
            
            database.getDb().get(sql, [id], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
    }

    // Get all users
    static async getAll(page = 1, limit = 10) {
        return new Promise((resolve, reject) => {
            const countSql = `SELECT COUNT(*) as total FROM users`;
            const sql = `SELECT id, username, email, full_name, role, is_active, last_login, created_at 
                        FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            
            // Get total count
            database.getDb().get(countSql, [], (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get users
                database.getDb().all(sql, [limit, (page - 1) * limit], (err, users) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            users: users,
                            total: countResult.total,
                            page: page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }

    // Update user
    static async update(id, userData) {
        const { username, email, full_name, role, is_active } = userData;
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, 
                        is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [username, email, full_name, role, is_active, id], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
        });
    }

    // Change password
    static async changePassword(id, oldPassword, newPassword) {
        return new Promise((resolve, reject) => {
            // First get user to verify old password
            const getUserSql = `SELECT password FROM users WHERE id = ?`;
            
            database.getDb().get(getUserSql, [id], (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!user) {
                    resolve({ success: false, message: 'User not found' });
                    return;
                }
                
                // Verify old password
                const isOldPasswordValid = bcrypt.compareSync(oldPassword, user.password);
                if (!isOldPasswordValid) {
                    resolve({ success: false, message: 'Password lama salah' });
                    return;
                }
                
                // Hash new password
                const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
                
                // Update password
                const updateSql = `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
                database.getDb().run(updateSql, [hashedNewPassword, id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ success: true, message: 'Password berhasil diubah' });
                    }
                });
            });
        });
    }

    // Delete user
    static async delete(id) {
        return new Promise((resolve, reject) => {
            // First delete user sessions
            const deleteSessionsSql = `DELETE FROM user_sessions WHERE user_id = ?`;
            database.getDb().run(deleteSessionsSql, [id], (err) => {
                if (err) {
                    console.error('Error deleting user sessions:', err);
                }
                
                // Then delete user
                const deleteUserSql = `DELETE FROM users WHERE id = ?`;
                database.getDb().run(deleteUserSql, [id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        });
    }

    // Clean expired sessions
    static cleanExpiredSessions() {
        const sql = `DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP`;
        database.getDb().run(sql, [], (err) => {
            if (err) {
                console.error('Error cleaning expired sessions:', err);
            } else {
                console.log('Expired sessions cleaned');
            }
        });
    }

    // Update user profile
    static async updateProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            const { full_name, email } = profileData;
            
            const sql = `UPDATE users SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [full_name, email, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        // Get updated user data
                        UserModel.getUpdatedUser(userId, resolve, reject);
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    }

    // Update user password
    static async updatePassword(userId, hashedPassword) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            database.getDb().run(sql, [hashedPassword, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Helper method to get updated user data
    static getUpdatedUser(userId, resolve, reject) {
        const sql = `SELECT id, username, full_name, email, role, created_at, updated_at FROM users WHERE id = ?`;

        database.getDb().get(sql, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    }

    // Find user by phone number
    static async findByPhone(phone) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE phone = ? AND is_active = TRUE`;

            database.getDb().get(sql, [phone], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
    }

    // Save OTP for user
    static async saveOTP(userId, otp, expiresAt) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET otp_code = ?, otp_expires = ?, login_attempts = 0 WHERE id = ?`;

            database.getDb().run(sql, [otp, expiresAt.toISOString(), userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Verify OTP
    static async verifyOTP(userId, otp) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT otp_code, otp_expires FROM users WHERE id = ?`;

            database.getDb().get(sql, [userId], (err, user) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!user || !user.otp_code || !user.otp_expires) {
                    resolve(false);
                    return;
                }

                const now = new Date();
                const expiresAt = new Date(user.otp_expires);

                // Check if OTP is expired
                if (now > expiresAt) {
                    resolve(false);
                    return;
                }

                // Check if OTP matches
                resolve(user.otp_code === otp);
            });
        });
    }

    // Clear OTP
    static async clearOTP(userId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = ?`;

            database.getDb().run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Increment login attempts
    static async incrementLoginAttempts(userId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?`;

            database.getDb().run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Reset login attempts
    static async resetLoginAttempts(userId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET login_attempts = 0 WHERE id = ?`;

            database.getDb().run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Get login attempts
    static async getLoginAttempts(userId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT login_attempts FROM users WHERE id = ?`;

            database.getDb().get(sql, [userId], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user ? user.login_attempts : 0);
                }
            });
        });
    }



    // Find user by ID
    static async findById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE id = ?`;

            database.getDb().get(sql, [id], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
    }

    // Deduct balance from user
    static async deductBalance(userId, amount) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND balance >= ?`;

            database.getDb().run(sql, [amount, userId, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Get user balance
    static async getBalance(userId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT balance FROM users WHERE id = ?`;

            database.getDb().get(sql, [userId], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user ? user.balance : 0);
                }
            });
        });
    }

    // Update user balance
    static async updateBalance(userId, newBalance) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

            database.getDb().run(sql, [newBalance, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // Get all agents with pagination
    static async getAllAgents(page = 1, limit = 10) {
        return new Promise((resolve, reject) => {
            const countSql = `SELECT COUNT(*) as total FROM users WHERE role = 'agent'`;
            const sql = `SELECT id, username, full_name, phone, address, balance, is_active, created_at, last_login
                        FROM users WHERE role = 'agent' ORDER BY created_at DESC LIMIT ? OFFSET ?`;

            // Get total count
            database.getDb().get(countSql, [], (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get agents
                database.getDb().all(sql, [limit, (page - 1) * limit], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            agents: rows || [],
                            total: countResult ? countResult.total : 0,
                            page: page,
                            totalPages: Math.ceil((countResult ? countResult.total : 0) / limit)
                        });
                    }
                });
            });
        });
    }

    // Get agent statistics
    static async getAgentStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    COUNT(*) as total_agents,
                    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_agents,
                    SUM(balance) as total_balance,
                    AVG(balance) as avg_balance
                FROM users WHERE role = 'agent'
            `;

            database.getDb().get(sql, [], (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stats);
                }
            });
        });
    }

    // Find user by username
    static async findByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, username, password, email, full_name, phone, role, 
                       balance, is_active, created_at, last_login, updated_at
                FROM users 
                WHERE username = ?
            `;
            
            database.getDb().get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
}

module.exports = UserModel;