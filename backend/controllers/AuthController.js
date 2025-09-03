const UserModel = require('../models/User');
const bcrypt = require('bcryptjs');
const database = require('../config/database');

class AuthController {
    // Login with 2FA support
    static async login(req, res) {
        try {
            const { username, password, otp } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username dan password harus diisi'
                });
            }

            // Check if 2FA is enabled for agents
            const otpSettings = await AuthController.getOTPLoginSettingsInternal();
            
            // Get user first to check if it's an agent
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

            // If 2FA is enabled and user is agent
            if (otpSettings.enabled && user.role === 'agent') {
                if (!otp) {
                    // Need OTP, don't return token yet
                    return res.json({
                        success: true,
                        requires2FA: true,
                        message: 'Silakan masukkan kode OTP yang dikirim ke WhatsApp Anda'
                    });
                } else {
                    // Validate OTP
                    const otpValid = await AuthController.validateLoginOTP(username, otp);
                    if (!otpValid.success) {
                        return res.status(400).json({
                            success: false,
                            message: otpValid.message
                        });
                    }
                }
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

    // Validate login OTP
    static async validateLoginOTP(username, inputOTP) {
        try {
            const sql = `
                SELECT * FROM otp_login_codes 
                WHERE username = ? AND otp_code = ? AND used = 0 AND expires_at > datetime('now')
                ORDER BY created_at DESC LIMIT 1
            `;

            const otpRecord = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [username, inputOTP], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (otpRecord) {
                // Mark OTP as used
                const updateSql = `
                    UPDATE otp_login_codes 
                    SET used = 1, used_at = datetime('now') 
                    WHERE id = ?
                `;
                
                await new Promise((resolve, reject) => {
                    database.getDb().run(updateSql, [otpRecord.id], function(err) {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                return { success: true, message: 'OTP valid' };
            } else {
                return { success: false, message: 'Kode OTP tidak valid atau sudah kadaluarsa' };
            }

        } catch (error) {
            console.error('Error validating login OTP:', error);
            return { success: false, message: 'Error validasi OTP' };
        }
    }

    // Logout
    static async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token tidak ditemukan'
                });
            }

            await UserModel.logout(token);

            res.json({
                success: true,
                message: 'Logout berhasil'
            });

        } catch (error) {
            console.error('Error during logout:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Verify token / Get current user
    static async me(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Token tidak ditemukan'
                });
            }

            const verification = await UserModel.verifyToken(token);

            if (verification.valid) {
                res.json({
                    success: true,
                    user: verification.user
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: verification.message
                });
            }

        } catch (error) {
            console.error('Error verifying token:', error);
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
            const { full_name, email } = req.body;

            // Validate input
            if (!full_name || full_name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nama lengkap harus diisi'
                });
            }

            // Validate email format if provided
            if (email && !this.isValidEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format email tidak valid'
                });
            }

            // Update user profile
            const updatedUser = await UserModel.updateProfile(userId, {
                full_name: full_name.trim(),
                email: email ? email.trim() : null
            });

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'Profil berhasil diupdate',
                data: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    full_name: updatedUser.full_name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    created_at: updatedUser.created_at,
                    updated_at: updatedUser.updated_at
                }
            });

        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Change password
    static async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { current_password, new_password } = req.body;

            // Validate input
            if (!current_password || !new_password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password saat ini dan password baru harus diisi'
                });
            }

            if (new_password.length < 6) {
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
            const isValidPassword = await bcrypt.compare(current_password, user.password);
            if (!isValidPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Password saat ini salah'
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(new_password, 10);

            // Update password
            const updatedUser = await UserModel.updatePassword(userId, hashedPassword);

            if (!updatedUser) {
                return res.status(500).json({
                    success: false,
                    message: 'Gagal mengupdate password'
                });
            }

            res.json({
                success: true,
                message: 'Password berhasil diubah'
            });

        } catch (error) {
            console.error('Error changing password:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Helper method to validate email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Register new user (admin only)
    static async register(req, res) {
        try {
            const { username, password, email, full_name, role } = req.body;

            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Hanya admin yang dapat mendaftarkan user baru'
                });
            }

            if (!username || !password || !full_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Username, password, dan nama lengkap harus diisi'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password minimal 6 karakter'
                });
            }

            const validRoles = ['admin', 'agent'];
            if (role && !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Role harus admin atau agent'
                });
            }

            const user = await UserModel.create({
                username,
                password,
                email,
                full_name,
                role: role || 'agent'
            });

            res.status(201).json({
                success: true,
                message: 'User berhasil didaftarkan',
                user: user
            });

        } catch (error) {
            console.error('Error registering user:', error);
            
            if (error.code === 'SQLITE_CONSTRAINT') {
                res.status(409).json({
                    success: false,
                    message: 'Username sudah digunakan'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                });
            }
        }
    }

    // Get all users (admin only)
    static async getUsers(req, res) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Hanya admin yang dapat melihat daftar user'
                });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const result = await UserModel.getAll(page, limit);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error getting users:', error);
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
            const { id } = req.params;
            const { username, email, full_name, role, is_active } = req.body;

            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Hanya admin yang dapat mengupdate user'
                });
            }

            const result = await UserModel.update(id, {
                username,
                email,
                full_name,
                role,
                is_active
            });

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'User berhasil diupdate'
            });

        } catch (error) {
            console.error('Error updating user:', error);
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
            const { id } = req.params;

            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Hanya admin yang dapat menghapus user'
                });
            }

            // Prevent admin from deleting themselves
            if (parseInt(id) === req.user.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Tidak dapat menghapus akun sendiri'
                });
            }

            const result = await UserModel.delete(id);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'User berhasil dihapus'
            });

        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Request OTP for agent login
    static async requestOTP(req, res) {
        try {
            const { phone } = req.body;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Nomor WhatsApp harus diisi'
                });
            }

            // Normalize phone number
            let normalizedPhone = phone.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            // Find agent by phone
            const agent = await UserModel.findByPhone(normalizedPhone);

            if (!agent || agent.role !== 'agent') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent dengan nomor WhatsApp ini tidak ditemukan'
                });
            }

            if (!agent.is_active) {
                return res.status(403).json({
                    success: false,
                    message: 'Akun agent tidak aktif'
                });
            }

            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

            // Save OTP to database
            await UserModel.saveOTP(agent.id, otp, expiresAt);

            // Send OTP via WhatsApp Gateway
            try {
                const WhatsAppGateway = require('../services/WhatsAppGateway');
                const whatsapp = WhatsAppGateway.getInstance();

                // Initialize WhatsApp if not connected/initialized
                if (!whatsapp.isConnected) {
                    await whatsapp.initialize();
                }

                const sent = await whatsapp.sendOTP(normalizedPhone, otp);
                if (!sent) {
                    console.warn('⚠️  Failed to send OTP via WhatsApp, falling back to console log');
                    console.log(`📱 OTP untuk ${agent.full_name} (${normalizedPhone}): ${otp}`);
                }
            } catch (whatsappError) {
                console.error('❌ Error sending OTP via WhatsApp:', whatsappError);
                // Fallback to console log
                console.log(`📱 OTP untuk ${agent.full_name} (${normalizedPhone}): ${otp}`);
            }

            res.json({
                success: true,
                message: 'OTP berhasil dikirim ke WhatsApp Anda',
                expires_in: 300 // 5 minutes in seconds
            });

        } catch (error) {
            console.error('Error requesting OTP:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Login agent with OTP
    static async loginWithOTP(req, res) {
        try {
            const { phone, otp } = req.body;

            if (!phone || !otp) {
                return res.status(400).json({
                    success: false,
                    message: 'Nomor WhatsApp dan OTP harus diisi'
                });
            }

            // Normalize phone number
            let normalizedPhone = phone.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            // Find agent by phone
            const agent = await UserModel.findByPhone(normalizedPhone);

            if (!agent || agent.role !== 'agent') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent dengan nomor WhatsApp ini tidak ditemukan'
                });
            }

            if (!agent.is_active) {
                return res.status(403).json({
                    success: false,
                    message: 'Akun agent tidak aktif'
                });
            }

            // Verify OTP
            const isValidOTP = await UserModel.verifyOTP(agent.id, otp);

            if (!isValidOTP) {
                // Increment login attempts
                await UserModel.incrementLoginAttempts(agent.id);

                // Check if too many attempts
                const attempts = await UserModel.getLoginAttempts(agent.id);
                if (attempts >= 5) {
                    return res.status(429).json({
                        success: false,
                        message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.'
                    });
                }

                return res.status(401).json({
                    success: false,
                    message: 'OTP tidak valid atau sudah kadaluarsa'
                });
            }

            // Reset login attempts on successful login
            await UserModel.resetLoginAttempts(agent.id);

            // Clear OTP
            await UserModel.clearOTP(agent.id);

            // Generate JWT token
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                {
                    id: agent.id,
                    username: agent.username,
                    role: agent.role
                },
                process.env.JWT_SECRET || 'voucher_wifi_secret_key',
                { expiresIn: '24h' }
            );

            // Update last login
            await UserModel.updateLastLogin(agent.id);

            // Save session
            await UserModel.createSession(agent.id, token);

            res.json({
                success: true,
                message: 'Login berhasil',
                token,
                user: {
                    id: agent.id,
                    username: agent.username,
                    email: agent.email,
                    full_name: agent.full_name,
                    phone: agent.phone,
                    role: agent.role,
                    balance: agent.balance
                },
                redirect_url: agent.role === 'agent' ? '/agent-dashboard' : '/'
            });

        } catch (error) {
            console.error('Error logging in with OTP:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Save OTP Login Settings (2FA)
    static async saveOTPLoginSettings(req, res) {
        try {
            const { enabled, length, expiry } = req.body;

            // Validate input
            if (typeof enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'Status enabled harus berupa boolean'
                });
            }

            if (length && (length < 4 || length > 8)) {
                return res.status(400).json({
                    success: false,
                    message: 'Panjang OTP harus antara 4-8 digit'
                });
            }

            if (expiry && (expiry < 60 || expiry > 3600)) {
                return res.status(400).json({
                    success: false,
                    message: 'Waktu kadaluarsa harus antara 1-60 menit'
                });
            }

            // Save to database (reuse otp_settings table but with different purpose)
            const sql = `
                INSERT OR REPLACE INTO otp_login_settings 
                (id, enabled, length, expiry, updated_at, updated_by) 
                VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `;
            
            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [
                    enabled ? 1 : 0, 
                    length || 6, 
                    expiry || 600,
                    req.user.id
                ], function(err) {
                    if (err) {
                        console.error('Error saving OTP login settings:', err);
                        reject(err);
                    } else {
                        console.log('OTP login settings saved:', { enabled, length, expiry });
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Pengaturan 2FA (OTP Login) berhasil disimpan',
                data: {
                    enabled,
                    length: length || 6,
                    expiry: expiry || 600
                }
            });

        } catch (error) {
            console.error('Error saving OTP login settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get OTP Login Settings (2FA)
    static async getOTPLoginSettings(req, res) {
        try {
            const sql = `SELECT * FROM otp_login_settings WHERE id = 1`;
            
            const settings = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [], (err, row) => {
                    if (err) {
                        console.error('Error getting OTP login settings:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });

            if (settings) {
                res.json({
                    success: true,
                    data: {
                        enabled: settings.enabled === 1,
                        length: settings.length || 6,
                        expiry: settings.expiry || 600,
                        updated_at: settings.updated_at
                    }
                });
            } else {
                // Return default settings if no record found
                res.json({
                    success: true,
                    data: {
                        enabled: false,
                        length: 6,
                        expiry: 600,
                        updated_at: null
                    }
                });
            }

        } catch (error) {
            console.error('Error getting OTP login settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Generate OTP for login (2FA)
    static async generateLoginOTP(req, res) {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'Username harus diisi'
                });
            }

            // Get agent by username
            const agent = await UserModel.findByUsername(username);
            if (!agent || agent.role !== 'agent') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            if (!agent.phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Agent tidak memiliki nomor WhatsApp'
                });
            }

            // Check if OTP login is enabled
            const settings = await this.getOTPLoginSettingsInternal();
            if (!settings.enabled) {
                return res.status(400).json({
                    success: false,
                    message: '2FA (OTP Login) tidak diaktifkan'
                });
            }

            // Generate OTP
            const otpLength = settings.length || 6;
            const otp = Math.random().toString().slice(2, 2 + otpLength);
            
            // Calculate expiry time
            const expirySeconds = settings.expiry || 600;
            const expiresAt = new Date(Date.now() + (expirySeconds * 1000));

            // Save OTP to database
            const sql = `
                INSERT INTO otp_login_codes (username, otp_code, expires_at) 
                VALUES (?, ?, ?)
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [username, otp, expiresAt.toISOString()], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Send OTP via WhatsApp
            try {
                const WhatsAppGateway = require('../services/WhatsAppGateway');
                const whatsapp = WhatsAppGateway.getInstance();
                
                const otpMessage = 
                    `🔐 *KODE OTP LOGIN*\n\n` +
                    `👤 Agent: ${agent.full_name}\n` +
                    `🔢 Kode: *${otp}*\n` +
                    `⏰ Berlaku: ${Math.round(expirySeconds / 60)} menit\n\n` +
                    `💡 Masukkan kode ini untuk login ke dashboard.\n\n` +
                    `⚠️ *Penting:* Jangan bagikan kode ini!`;

                await whatsapp.sendReply(agent.phone, otpMessage);
                console.log(`✅ Login OTP sent to agent ${agent.full_name} (${agent.phone})`);
            } catch (whatsappError) {
                console.error('❌ Error sending login OTP via WhatsApp:', whatsappError);
                return res.status(500).json({
                    success: false,
                    message: 'Gagal mengirim OTP via WhatsApp'
                });
            }

            res.json({
                success: true,
                message: 'Kode OTP telah dikirim ke WhatsApp Anda',
                data: {
                    username: username,
                    phone: agent.phone,
                    expiresAt: expiresAt
                }
            });

        } catch (error) {
            console.error('Error generating login OTP:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Helper method to get OTP login settings internally
    static async getOTPLoginSettingsInternal() {
        try {
            const sql = `SELECT * FROM otp_login_settings WHERE id = 1`;
            
            const settings = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (settings) {
                return {
                    enabled: settings.enabled === 1,
                    length: settings.length || 6,
                    expiry: settings.expiry || 600
                };
            } else {
                return { enabled: false, length: 6, expiry: 600 };
            }

        } catch (error) {
            console.error('Error getting OTP login settings internally:', error);
            return { enabled: false, length: 6, expiry: 600 };
        }
    }
}

module.exports = AuthController;