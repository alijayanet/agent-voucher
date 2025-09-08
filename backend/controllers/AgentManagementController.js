const UserModel = require('../models/User');

class AgentManagementController {
    // Create new agent
    static async createAgent(req, res) {
        try {
            const { username, password, full_name, phone, address } = req.body;

            // Validate input
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

            // Create agent user
            const user = await UserModel.create({
                username,
                password,
                email: null,
                full_name,
                phone,
                address,
                role: 'agent'
            });

            res.status(201).json({
                success: true,
                message: 'Agent berhasil dibuat',
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    phone: user.phone,
                    role: user.role,
                    created_at: user.created_at
                }
            });

        } catch (error) {
            console.error('Error creating agent:', error);
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

    // Get all agents
    static async getAllAgents(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const result = await UserModel.getAllAgents(page, limit);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error getting all agents:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get agent statistics
    static async getAgentStats(req, res) {
        try {
            const stats = await UserModel.getAgentStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error getting agent stats:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get agent by ID
    static async getAgentById(req, res) {
        try {
            const { id } = req.params;
            const agent = await UserModel.findById(id);

            if (!agent || agent.role !== 'agent') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            res.json({
                success: true,
                agent: {
                    id: agent.id,
                    username: agent.username,
                    full_name: agent.full_name,
                    phone: agent.phone,
                    address: agent.address,
                    balance: agent.balance,
                    is_active: agent.is_active,
                    created_at: agent.created_at,
                    last_login: agent.last_login
                }
            });

        } catch (error) {
            console.error('Error getting agent by ID:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update agent
    static async updateAgent(req, res) {
        try {
            const { id } = req.params;
            const { username, full_name, phone, address, email, password } = req.body;
            let { is_active, balance } = req.body;

            // Update hanya field yang dikirim (hindari overwrite NULL pada kolom NOT NULL)
            const database = require('../config/database');

            const setParts = [];
            const params = [];

            if (typeof username !== 'undefined' && username !== null && username !== '') {
                setParts.push('username = ?');
                params.push(username);
            }
            if (typeof full_name !== 'undefined') {
                setParts.push('full_name = ?');
                params.push(full_name);
            }
            if (typeof phone !== 'undefined') {
                setParts.push('phone = ?');
                params.push(phone);
            }
            if (typeof email !== 'undefined') {
                setParts.push('email = ?');
                params.push(email);
            }
            if (typeof address !== 'undefined') {
                setParts.push('address = ?');
                params.push(address);
            }
            if (typeof password !== 'undefined' && password !== null && password.trim() !== '') {
                // Hash password before updating
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash(password, 10);
                setParts.push('password = ?');
                params.push(hashedPassword);
            }
            if (typeof is_active !== 'undefined') {
                // Normalisasi ke 0/1
                const activeVal = (is_active === true || is_active === 1 || is_active === '1' || is_active === 'true') ? 1 : 0;
                setParts.push('is_active = ?');
                params.push(activeVal);
            }
            if (typeof balance !== 'undefined') {
                const balVal = isNaN(parseFloat(balance)) ? 0 : parseFloat(balance);
                setParts.push('balance = ?');
                params.push(balVal);
            }

            if (setParts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tidak ada perubahan yang dikirim'
                });
            }

            const sql = `UPDATE users SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            params.push(id);

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, params, function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                });
            });

            res.json({ success: true, message: 'Agent berhasil diupdate' });

        } catch (error) {
            console.error('Error updating agent:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Delete agent
    static async deleteAgent(req, res) {
        try {
            const { id } = req.params;

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
                    message: 'Agent tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'Agent berhasil dihapus'
            });

        } catch (error) {
            console.error('Error deleting agent:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Change agent password
    static async changeAgentPassword(req, res) {
        try {
            const { id } = req.params;
            const { new_password } = req.body;

            if (!new_password || new_password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password baru minimal 6 karakter'
                });
            }

            const hashedPassword = require('bcryptjs').hashSync(new_password, 10);
            const result = await UserModel.updatePassword(id, hashedPassword);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'Password agent berhasil diubah'
            });

        } catch (error) {
            console.error('Error changing agent password:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Deposit agent balance
    static async depositAgent(req, res) {
        try {
            const { agent_id, amount, notes } = req.body;

            if (!agent_id || !amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Agent dan jumlah deposit harus diisi'
                });
            }

            // Get agent details first
            const agent = await UserModel.findById(agent_id);
            if (!agent || agent.role !== 'agent') {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            // Get current balance
            const currentBalance = await UserModel.getBalance(agent_id);
            const newBalance = currentBalance + amount;

            // Update balance
            await UserModel.updateBalance(agent_id, newBalance);

            // Create transaction record
            const TransactionModel = require('../models/Transaction');
            await TransactionModel.create({
                customer_name: 'Deposit Agent',
                customer_phone: null,
                amount: amount,
                payment_method: 'admin_deposit',
                status: 'completed',
                created_by: req.user.id,
                notes: notes || 'Deposit saldo agent'
            });

            // Send WhatsApp notification to agent [[memory:7877427]]
            if (agent.phone) {
                try {
                    const WhatsAppGateway = require('../services/WhatsAppGateway');
                    const whatsapp = WhatsAppGateway.getInstance();
                    
                    const depositMessage =
                        `💰 *DEPOSIT SALDO BERHASIL!*\n\n` +
                        `👤 Nama: ${agent.full_name}\n` +
                        `💵 Jumlah Deposit: Rp ${amount.toLocaleString('id-ID')}\n` +
                        `💰 Saldo Lama: Rp ${currentBalance.toLocaleString('id-ID')}\n` +
                        `💰 Saldo Baru: Rp ${newBalance.toLocaleString('id-ID')}\n\n` +
                        `⏰ Waktu: ${new Date().toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}\n\n` +
                        `💡 Gunakan saldo ini untuk order voucher.\n` +
                        `📱 Ketik "help" untuk melihat cara order.`;

                    await whatsapp.sendReply(agent.phone, depositMessage);
                    console.log(`✅ Deposit notification sent to agent ${agent.full_name} (${agent.phone})`);
                } catch (whatsappError) {
                    console.error('❌ Error sending deposit notification via WhatsApp:', whatsappError);
                    // Don't fail the whole process if WhatsApp fails
                }
            }

            res.json({
                success: true,
                message: 'Deposit agent berhasil dan notifikasi WhatsApp telah dikirim',
                data: {
                    agent_id: agent_id,
                    agent_name: agent.full_name,
                    agent_phone: agent.phone,
                    previous_balance: currentBalance,
                    deposit_amount: amount,
                    new_balance: newBalance,
                    whatsapp_sent: !!agent.phone
                }
            });

        } catch (error) {
            console.error('Error depositing agent balance:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get pending agent registrations
    static async getPendingRegistrations(req, res) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT * FROM agent_registrations
                WHERE status = 'pending'
                ORDER BY created_at DESC
            `;

            return new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            }).then(registrations => {
                res.json({
                    success: true,
                    data: registrations
                });
            });
        } catch (error) {
            console.error('Error getting pending registrations:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Approve agent registration
    static async approveRegistration(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.user.id;
            const database = require('../config/database');

            // Get registration details
            const getRegSql = `SELECT * FROM agent_registrations WHERE id = ? AND status = 'pending'`;
            const registration = await new Promise((resolve, reject) => {
                database.getDb().get(getRegSql, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!registration) {
                return res.status(404).json({
                    success: false,
                    message: 'Pendaftaran tidak ditemukan atau sudah diproses'
                });
            }

            // Generate username and password
            const username = registration.phone_number.replace(/^62/, '');
            const password = Math.random().toString(36).slice(-8);

            // Create user account
            const UserModel = require('../models/User');
            const user = await UserModel.create({
                username: username,
                password: password,
                email: null,
                full_name: registration.full_name,
                phone: registration.phone_number,
                role: 'agent'
            });

            // Update registration status
            const updateRegSql = `
                UPDATE agent_registrations
                SET status = 'approved', approved_by = ?, approved_at = datetime('now')
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateRegSql, [adminId, id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Send WhatsApp notification to agent
            const WhatsAppGateway = require('../services/WhatsAppGateway');
            const whatsapp = WhatsAppGateway.getInstance();
            const welcomeMessage =
                `🎉 *SELAMAT! Akun Agent Anda Sudah Aktif*\n\n` +
                `👤 Nama: ${registration.full_name}\n` +
                `👤 Username: ${username}\n` +
                `🔑 Password: ${password}\n` +
                `📱 Nomor: ${registration.phone_number}\n\n` +
                `💡 *Cara Menggunakan Bot:*\n` +
                `• Kirim "help" untuk melihat menu\n` +
                `• Kirim "status" untuk cek saldo\n` +
                `• Kirim "beli [harga] [jumlah] [nomor_customer]" untuk order\n` +
                `• Kirim "laporan" untuk laporan transaksi\n\n` +
                `⚠️ *PENTING:*\n` +
                `• Simpan username & password dengan aman\n` +
                `• Gunakan bot untuk order voucher\n` +
                `• Hubungi admin jika ada masalah\n\n` +
                `🚀 Selamat bekerja!`;

            try {
                await whatsapp.sendReply(registration.phone_number, welcomeMessage);
                console.log(`✅ Welcome message sent to ${registration.phone_number}`);
            } catch (whatsappError) {
                console.error('❌ Error sending WhatsApp welcome message:', whatsappError);
                // Don't fail the whole process if WhatsApp fails
            }

            res.json({
                success: true,
                message: 'Agent berhasil disetujui dan akun sudah dibuat',
                data: {
                    user_id: user.id,
                    username: username,
                    full_name: registration.full_name,
                    phone: registration.phone_number
                }
            });

        } catch (error) {
            console.error('Error approving agent registration:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Reject agent registration
    static async rejectRegistration(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const adminId = req.user.id;
            const database = require('../config/database');

            // Get registration details
            const getRegSql = `SELECT * FROM agent_registrations WHERE id = ? AND status = 'pending'`;
            const registration = await new Promise((resolve, reject) => {
                database.getDb().get(getRegSql, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!registration) {
                return res.status(404).json({
                    success: false,
                    message: 'Pendaftaran tidak ditemukan atau sudah diproses'
                });
            }

            // Update registration status
            const updateRegSql = `
                UPDATE agent_registrations
                SET status = 'rejected', approved_by = ?, rejected_reason = ?
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateRegSql, [adminId, reason || 'Tidak ada alasan', id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Send WhatsApp notification to agent
            const WhatsAppGateway = require('../services/WhatsAppGateway');
            const whatsapp = WhatsAppGateway.getInstance();
            const rejectMessage =
                `❌ *Pendaftaran Agent Ditolak*\n\n` +
                `👤 Nama: ${registration.full_name}\n` +
                `📱 Nomor: ${registration.phone_number}\n\n` +
                `📝 Alasan: ${reason || 'Tidak ada alasan khusus'}\n\n` +
                `💡 Jika ada pertanyaan, silakan hubungi admin.`;

            try {
                await whatsapp.sendReply(registration.phone_number, rejectMessage);
                console.log(`✅ Rejection message sent to ${registration.phone_number}`);
            } catch (whatsappError) {
                console.error('❌ Error sending WhatsApp rejection message:', whatsappError);
            }

            res.json({
                success: true,
                message: 'Pendaftaran agent berhasil ditolak'
            });

        } catch (error) {
            console.error('Error rejecting agent registration:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }




}

module.exports = AgentManagementController;
