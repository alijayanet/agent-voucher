const UserModel = require('../models/User');
const bcrypt = require('bcryptjs');
const database = require('../config/database');

class AuthController {
    // Simple login with username/password only
    static async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username dan password harus diisi'
                });
            }

            // Bypass: admin login via ENV tanpa DB
            const adminUsername = process.env.ADMIN_USERNAME;
            const adminPassword = process.env.ADMIN_PASSWORD;
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@voucherwifi.com';
            const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';
            if (adminUsername && adminPassword && username === adminUsername && password === adminPassword) {
                const jwt = require('jsonwebtoken');
                const token = jwt.sign(
                    {
                        username: adminUsername,
                        role: 'admin',
                        source: 'env-admin'
                    },
                    process.env.JWT_SECRET || 'voucher_wifi_secret_key',
                    { expiresIn: '24h' }
                );

                return res.json({
                    success: true,
                    message: 'Login berhasil',
                    token: token,
                    user: {
                        id: null,
                        username: adminUsername,
                        full_name: adminFullName,
                        email: adminEmail,
                        role: 'admin',
                        phone: null,
                        balance: 0
                    }
                });
            }

            // Get user by username
            const user = await UserModel.findByUsername(username);
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Username atau password salah'
                });
            }

            // Check password
            const bcrypt = require('bcryptjs');
            const isPasswordValid = await bcrypt.compare(password, user.password);
            
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Username atau password salah'
                });
            }

            // Check if user is active
            if (!user.is_active) {
                return res.status(401).json({
                    success: false,
                    message: 'Akun Anda tidak aktif. Hubungi administrator.'
                });
            }

            // Generate token and complete login
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role 
                },
                process.env.JWT_SECRET || 'voucher_wifi_secret_key',
                { expiresIn: '24h' }
            );

            // Update last login and create session
            await UserModel.updateLastLogin(user.id);
            await UserModel.createSession(user.id, token);

                res.json({
                    success: true,
                    message: 'Login berhasil',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    balance: user.balance
                }
            });

        } catch (error) {
            console.error('Error during login:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Logout
    static async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token diperlukan untuk logout'
                });
            }

            // Jika token adalah admin ENV, tidak perlu hapus sesi DB
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'voucher_wifi_secret_key');
                if (decoded && decoded.role === 'admin' && decoded.username === (process.env.ADMIN_USERNAME || 'admin')) {
                    return res.json({
                        success: true,
                        message: 'Logout berhasil'
                    });
                }
            } catch (e) {
                // lanjut ke penghapusan sesi DB untuk token non-admin/env
            }

            // Invalidate session (non-admin)
            const sql = `DELETE FROM user_sessions WHERE token = ?`;
            
            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [token], function(err) {
                    if (err) {
                        console.error('Error deleting session:', err);
                        reject(err);
                    } else {
                        console.log(`Session deleted for token: ${token.substring(0, 20)}...`);
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Logout berhasil'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get current user profile
    static async me(req, res) {
        try {
            const user = req.user;
            
            console.log('🔍 me() - req.user:', user);

            // Admin ENV: kembalikan dari ENV tanpa query DB
            if (user && user.role === 'admin' && user.username === (process.env.ADMIN_USERNAME || 'admin')) {
                return res.json({
                    success: true,
                    user: {
                        id: null,
                        username: process.env.ADMIN_USERNAME || 'admin',
                        email: process.env.ADMIN_EMAIL || 'admin@voucherwifi.com',
                        full_name: process.env.ADMIN_FULL_NAME || 'Administrator',
                        phone: null,
                        role: 'admin',
                        balance: 0,
                        is_active: 1,
                        created_at: null,
                        last_login: null
                    }
                });
            }

            if (!user || !user.id) {
                console.log('❌ me() - No user or user.id in request');
                return res.status(401).json({
                    success: false,
                    message: 'User tidak ditemukan dalam request'
                });
            }
            
            // Get fresh user data from database
            const freshUser = await UserModel.findById(user.id);
            
            if (!freshUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan'
                });
            }

                res.json({
                    success: true,
                user: {
                    id: freshUser.id,
                    username: freshUser.username,
                    email: freshUser.email,
                    full_name: freshUser.full_name,
                    phone: freshUser.phone,
                    role: freshUser.role,
                    balance: freshUser.balance || 0,
                    is_active: freshUser.is_active,
                    created_at: freshUser.created_at,
                    last_login: freshUser.last_login
                }
            });

        } catch (error) {
            console.error('Error getting user profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Register new user (admin only)
    static async register(req, res) {
        try {
            const { username, password, email, full_name, phone, role, balance } = req.body;

            // Validate required fields
            if (!username || !password || !email || !full_name || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Username, password, email, full_name, dan role harus diisi'
                });
            }

            // Check if username already exists
            const existingUser = await UserModel.findByUsername(username);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username sudah digunakan'
                });
            }

            // Create user
            const userData = {
                username,
                password,
                email,
                full_name,
                phone: phone || null,
                role,
                balance: role === 'agent' ? (balance || 0) : 0,
                is_active: 1
            };

            const userId = await UserModel.create(userData);

            res.json({
                success: true,
                message: 'User berhasil didaftarkan',
                user_id: userId
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update user profile
    static async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { email, full_name, phone } = req.body;

            if (!email || !full_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Email dan nama lengkap harus diisi'
                });
            }

            const sql = `
                UPDATE users 
                SET email = ?, full_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [email, full_name, phone, userId], function(err) {
                    if (err) {
                        console.error('Error updating profile:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Profile berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Change password
    static async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword, confirmPassword } = req.body;

            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua field password harus diisi'
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Password baru dan konfirmasi password tidak cocok'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password baru minimal 6 karakter'
                });
            }

            // Get current user
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan'
                });
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Password saat ini salah'
                });
            }

            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            const sql = `
                UPDATE users 
                SET password = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [hashedNewPassword, userId], function(err) {
                    if (err) {
                        console.error('Error updating password:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Password berhasil diubah'
            });

        } catch (error) {
            console.error('Change password error:', error);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
        }
    }

    // Get all users (admin only)
    static async getUsers(req, res) {
        try {
            const sql = `
                SELECT id, username, email, full_name, phone, role, balance, is_active, created_at, last_login 
                FROM users 
                ORDER BY created_at DESC
            `;

            const users = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) {
                        console.error('Error getting users:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });

            res.json({
                success: true,
                users: users
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update user (admin only)
    static async updateUser(req, res) {
        try {
            const userId = req.params.id;
            const { username, email, full_name, phone, role, balance, is_active, password } = req.body;

            if (!username || !email || !full_name || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Username, email, nama lengkap, dan role harus diisi'
                });
            }

            // Build update query
            let setParts = ['username = ?', 'email = ?', 'full_name = ?', 'phone = ?', 'role = ?', 'is_active = ?', 'updated_at = CURRENT_TIMESTAMP'];
            let params = [username, email, full_name, phone, role, is_active ? 1 : 0];

            // Add balance for agents
            if (role === 'agent' && typeof balance !== 'undefined') {
                setParts.push('balance = ?');
                params.push(balance);
            }

            // Add password if provided
            if (typeof password !== 'undefined' && password !== null && password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(password, 10);
                setParts.push('password = ?');
                params.push(hashedPassword);
            }

            params.push(userId);

            const sql = `UPDATE users SET ${setParts.join(', ')} WHERE id = ?`;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, params, function(err) {
                    if (err) {
                        console.error('Error updating user:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'User berhasil diperbarui'
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Delete user (admin only)
    static async deleteUser(req, res) {
        try {
            const userId = req.params.id;
            const currentUserId = req.user.id;

            // Prevent deleting own account
            if (parseInt(userId) === parseInt(currentUserId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tidak dapat menghapus akun sendiri'
                });
            }

            const sql = `DELETE FROM users WHERE id = ?`;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [userId], function(err) {
                    if (err) {
                        console.error('Error deleting user:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'User berhasil dihapus'
            });

        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = AuthController;