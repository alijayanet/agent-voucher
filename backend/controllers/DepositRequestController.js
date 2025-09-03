const database = require('../config/database');
const UserModel = require('../models/User');

class DepositRequestController {
    // Create new deposit request
    static async createDepositRequest(req, res) {
        try {
            console.log('🎯 DepositRequestController.createDepositRequest called');
            console.log('👤 Agent ID:', req.user?.id);
            console.log('📋 Request body:', req.body);

            const agentId = req.user.id;
            const { amount, payment_method, notes, priority } = req.body;

            // Validate input
            if (!amount || amount < 10000) {
                return res.status(400).json({
                    success: false,
                    message: 'Jumlah deposit minimal Rp 10.000'
                });
            }

            if (!payment_method) {
                return res.status(400).json({
                    success: false,
                    message: 'Metode pembayaran harus dipilih'
                });
            }

            // Get agent info
            const agent = await UserModel.findById(agentId);
            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            // Insert deposit request to database
            const sql = `
                INSERT INTO deposit_requests (
                    agent_id, amount, payment_method, notes, priority, status, created_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
            `;

            const requestId = await new Promise((resolve, reject) => {
                database.getDb().run(sql, [
                    agentId, 
                    amount, 
                    payment_method, 
                    notes || null, 
                    priority || 'normal'
                ], function(err) {
                    if (err) {
                        console.error('Error inserting deposit request:', err);
                        reject(err);
                    } else {
                        console.log('✅ Deposit request created with ID:', this.lastID);
                        resolve(this.lastID);
                    }
                });
            });

            // Send WhatsApp notification to admins
            try {
                await DepositRequestController.notifyAdmins(requestId, agent, amount, payment_method, notes, priority);
                console.log('✅ Admin notification sent');
            } catch (whatsappError) {
                console.error('❌ Error sending admin notification:', whatsappError);
                // Don't fail the whole process if WhatsApp fails
            }

            // Send confirmation to agent
            try {
                await DepositRequestController.notifyAgent(agent, requestId, amount, payment_method);
                console.log('✅ Agent confirmation sent');
            } catch (whatsappError) {
                console.error('❌ Error sending agent confirmation:', whatsappError);
            }

            res.json({
                success: true,
                message: 'Request deposit berhasil dikirim',
                data: {
                    request_id: requestId,
                    amount: amount,
                    payment_method: payment_method,
                    priority: priority || 'normal',
                    status: 'pending'
                }
            });

        } catch (error) {
            console.error('Error creating deposit request:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Send notification to admins
    static async notifyAdmins(requestId, agent, amount, paymentMethod, notes, priority) {
        const WhatsAppGateway = require('../services/WhatsAppGateway');
        const whatsapp = WhatsAppGateway.getInstance();

        // Get admin phones from config
        const adminPhones = process.env.ADMIN_PHONES ? process.env.ADMIN_PHONES.split(',') : [];
        
        const priorityEmoji = {
            'normal': '📝',
            'urgent': '⚡', 
            'asap': '🔥'
        };

        const priorityText = {
            'normal': 'Normal',
            'urgent': 'Urgent (1 jam)',
            'asap': 'ASAP (segera)'
        };

        const paymentMethodText = {
            'transfer_bank': 'Transfer Bank',
            'cash': 'Cash/Tunai',
            'emoney': 'E-Money',
            'crypto': 'Cryptocurrency'
        };

        const message = 
            `${priorityEmoji[priority] || '📝'} *REQUEST DEPOSIT AGENT*\n\n` +
            `👤 Agent: ${agent.full_name}\n` +
            `📱 Username: ${agent.username}\n` +
            `📞 WhatsApp: ${agent.phone}\n` +
            `💰 Saldo Saat Ini: Rp ${(agent.balance || 0).toLocaleString('id-ID')}\n\n` +
            `💵 *Detail Request:*\n` +
            `💰 Jumlah: Rp ${amount.toLocaleString('id-ID')}\n` +
            `💳 Metode: ${paymentMethodText[paymentMethod] || paymentMethod}\n` +
            `⏰ Prioritas: ${priorityText[priority] || 'Normal'}\n` +
            `🆔 Request ID: #${requestId}\n\n` +
            `${notes ? `📝 Catatan: ${notes}\n\n` : ''}` +
            `🎯 *Aksi Admin:*\n` +
            `✅ Terima: ketik "terima ${requestId}"\n` +
            `❌ Tolak: ketik "tolak ${requestId} [alasan]"\n\n` +
            `📊 Dashboard: ${process.env.DASHBOARD_URL || 'bit.ly/admin-dashboard'}\n` +
            `⏰ Waktu: ${new Date().toLocaleString('id-ID')}`;

        // Send to all admin phones
        for (const adminPhone of adminPhones) {
            try {
                await whatsapp.sendReply(adminPhone.trim(), message);
            } catch (error) {
                console.error(`Failed to send to admin ${adminPhone}:`, error);
            }
        }
    }

    // Send confirmation to agent
    static async notifyAgent(agent, requestId, amount, paymentMethod) {
        if (!agent.phone) return;

        const WhatsAppGateway = require('../services/WhatsAppGateway');
        const whatsapp = WhatsAppGateway.getInstance();

        const paymentMethodText = {
            'transfer_bank': 'Transfer Bank',
            'cash': 'Cash/Tunai', 
            'emoney': 'E-Money',
            'crypto': 'Cryptocurrency'
        };

        const message =
            `✅ *REQUEST DEPOSIT DITERIMA*\n\n` +
            `👤 Agent: ${agent.full_name}\n` +
            `💵 Jumlah: Rp ${amount.toLocaleString('id-ID')}\n` +
            `💳 Metode: ${paymentMethodText[paymentMethod]}\n` +
            `🆔 Request ID: #${requestId}\n\n` +
            `📋 *Status: PENDING*\n` +
            `⏳ Menunggu konfirmasi admin\n\n` +
            `💡 *Info:*\n` +
            `• Admin akan memproses dalam 1-24 jam\n` +
            `• Anda akan mendapat notifikasi update status\n` +
            `• Saldo otomatis bertambah jika approved\n\n` +
            `📞 Hubungi admin jika ada pertanyaan`;

        await whatsapp.sendReply(agent.phone, message);
    }

    // Get deposit requests for agent
    static async getDepositRequests(req, res) {
        try {
            const agentId = req.user.id;
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const sql = `
                SELECT dr.*, u.full_name as agent_name, u.username
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                WHERE dr.agent_id = ?
                ORDER BY dr.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const requests = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [agentId, limit, offset], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            res.json({
                success: true,
                data: {
                    requests: requests,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: requests.length
                    }
                }
            });

        } catch (error) {
            console.error('Error getting deposit requests:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get all deposit requests for admin with stats
    static async getAllDepositRequests(req, res) {
        try {
            console.log('🎯 DepositRequestController.getAllDepositRequests called');
            
            const { page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            // Get all requests with agent info
            const sql = `
                SELECT dr.*, u.full_name as agent_name, u.username, u.phone
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                ORDER BY dr.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const requests = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [limit, offset], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Get stats
            const statsSQL = `
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    DATE(created_at) as date
                FROM deposit_requests 
                GROUP BY status, DATE(created_at)
                ORDER BY created_at DESC
            `;

            const statsRaw = await new Promise((resolve, reject) => {
                database.getDb().all(statsSQL, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Process stats
            const today = new Date().toISOString().split('T')[0];
            
            const stats = {
                pending: { count: 0, amount: 0 },
                approvedToday: { count: 0, amount: 0 },
                rejectedToday: { count: 0, amount: 0 },
                total: { count: 0, amount: 0 }
            };

            statsRaw.forEach(row => {
                // Total for all statuses
                stats.total.count += row.count;
                stats.total.amount += row.total_amount || 0;

                // Pending (all dates)
                if (row.status === 'pending') {
                    stats.pending.count += row.count;
                    stats.pending.amount += row.total_amount || 0;
                }

                // Today's approved/rejected
                if (row.date === today) {
                    if (row.status === 'approved') {
                        stats.approvedToday.count += row.count;
                        stats.approvedToday.amount += row.total_amount || 0;
                    } else if (row.status === 'rejected') {
                        stats.rejectedToday.count += row.count;
                        stats.rejectedToday.amount += row.total_amount || 0;
                    }
                }
            });

            console.log('📊 Stats calculated:', stats);

            res.json({
                success: true,
                data: {
                    requests: requests,
                    stats: stats,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: requests.length
                    }
                }
            });

        } catch (error) {
            console.error('Error getting all deposit requests:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Approve deposit request (admin only)
    static async approveDepositRequest(req, res) {
        try {
            const { id } = req.params;
            const { processed_amount, admin_notes } = req.body;

            // Get request details
            const sql = `
                SELECT dr.*, u.full_name, u.username, u.phone, u.balance
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                WHERE dr.id = ? AND dr.status = 'pending'
            `;

            const request = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Request tidak ditemukan atau sudah diproses'
                });
            }

            const finalAmount = processed_amount || request.amount;

            // Update request status
            const updateSql = `
                UPDATE deposit_requests 
                SET status = 'approved', processed_amount = ?, admin_notes = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateSql, [finalAmount, admin_notes, req.user.id, id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update agent balance
            const newBalance = request.balance + finalAmount;
            await UserModel.updateBalance(request.agent_id, newBalance);

            // Notify agent
            if (request.phone) {
                try {
                    const WhatsAppGateway = require('../services/WhatsAppGateway');
                    const whatsapp = WhatsAppGateway.getInstance();

                    const message = 
                        `🎉 *DEPOSIT APPROVED!*\n\n` +
                        `👤 Agent: ${request.full_name}\n` +
                        `💵 Jumlah: Rp ${finalAmount.toLocaleString('id-ID')}\n` +
                        `💰 Saldo Lama: Rp ${request.balance.toLocaleString('id-ID')}\n` +
                        `💰 Saldo Baru: Rp ${newBalance.toLocaleString('id-ID')}\n` +
                        `🆔 Request ID: #${id}\n\n` +
                        `${admin_notes ? `📝 Catatan Admin: ${admin_notes}\n\n` : ''}` +
                        `✅ Saldo sudah bertambah otomatis\n` +
                        `🚀 Siap untuk order voucher!\n\n` +
                        `⏰ Diproses: ${new Date().toLocaleString('id-ID')}`;

                    await whatsapp.sendReply(request.phone, message);
                } catch (error) {
                    console.error('Error sending approval notification:', error);
                }
            }

            res.json({
                success: true,
                message: 'Request deposit berhasil diapprove',
                data: {
                    request_id: id,
                    agent: request.full_name,
                    amount: finalAmount,
                    new_balance: newBalance
                }
            });

        } catch (error) {
            console.error('Error approving deposit request:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Reject deposit request (admin only)
    static async rejectDepositRequest(req, res) {
        try {
            const { id } = req.params;
            const { admin_notes } = req.body;

            // Get request details
            const sql = `
                SELECT dr.*, u.full_name, u.username, u.phone
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                WHERE dr.id = ? AND dr.status = 'pending'
            `;

            const request = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Request tidak ditemukan atau sudah diproses'
                });
            }

            // Update request status
            const updateSql = `
                UPDATE deposit_requests 
                SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateSql, [admin_notes, req.user.id, id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Notify agent
            if (request.phone) {
                try {
                    const WhatsAppGateway = require('../services/WhatsAppGateway');
                    const whatsapp = WhatsAppGateway.getInstance();

                    const message = 
                        `❌ *DEPOSIT REQUEST DITOLAK*\n\n` +
                        `👤 Agent: ${request.full_name}\n` +
                        `💵 Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                        `🆔 Request ID: #${id}\n\n` +
                        `${admin_notes ? `📝 Alasan: ${admin_notes}\n\n` : ''}` +
                        `💡 Silakan buat request baru dengan:\n` +
                        `• Informasi yang lebih lengkap\n` +
                        `• Metode pembayaran yang sesuai\n` +
                        `• Hubungi admin untuk klarifikasi\n\n` +
                        `⏰ Diproses: ${new Date().toLocaleString('id-ID')}`;

                    await whatsapp.sendReply(request.phone, message);
                } catch (error) {
                    console.error('Error sending rejection notification:', error);
                }
            }

            res.json({
                success: true,
                message: 'Request deposit berhasil ditolak',
                data: {
                    request_id: id,
                    agent: request.full_name,
                    amount: request.amount
                }
            });

        } catch (error) {
            console.error('Error rejecting deposit request:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = DepositRequestController;
