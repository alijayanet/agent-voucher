const UserModel = require('../models/User');
const database = require('../config/database');
const MikrotikAPI = require('../config/mikrotik');

class AgentController {
    // Get agent dashboard data
    static async getDashboard(req, res) {
        try {
            const agentId = req.user.id;

            // Get agent info
            const agent = await UserModel.findById(agentId);
            if (!agent) {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            // Get today's statistics
            const todayStats = await AgentController.getTodayStats(agentId);

            // Get monthly statistics
            const monthlyStats = await AgentController.getMonthlyStats(agentId);

            // Get recent orders
            const recentOrders = await AgentController.getRecentOrders(agentId);

            res.json({
                success: true,
                data: {
                agent: {
                    id: agent.id,
                    username: agent.username,
                    full_name: agent.full_name,
                    phone: agent.phone,
                        balance: agent.balance,
                    is_active: agent.is_active,
                        created_at: agent.created_at,
                        last_login: agent.last_login
                    },
                    statistics: {
                        today: todayStats,
                        monthly: monthlyStats
                    },
                    recentOrders: recentOrders
                }
            });

        } catch (error) {
            console.error('Error getting agent dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get today's statistics for agent
    static async getTodayStats(agentId) {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];

            const sql = `
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COUNT(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 END) as orders_with_customer
                FROM transactions
                WHERE created_by = ? AND DATE(created_at) = ?
            `;

            database.getDb().get(sql, [agentId, today], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Calculate commission from vouchers: sum(selling_price - agent_price)
                const commissionSql = `
                    SELECT COALESCE(SUM(
                        COALESCE(vp.selling_price, 0) - COALESCE(v.agent_price, 0)
                    ), 0) AS commission
                    FROM vouchers v
                    LEFT JOIN voucher_profiles vp ON vp.name = v.profile
                    WHERE v.agent_id = ? AND DATE(v.created_at) = ?
                `;

                database.getDb().get(commissionSql, [agentId, today], (cerr, crow) => {
                    if (cerr) {
                        reject(cerr);
                        return;
                    }
                    resolve({
                        total_orders: row ? row.total_orders : 0,
                        total_amount: row ? row.total_amount : 0,
                        orders_with_customer: row ? row.orders_with_customer : 0,
                        commission: crow ? crow.commission : 0
                    });
                });
            });
        });
    }

    // Get monthly statistics for agent
    static async getMonthlyStats(agentId) {
        return new Promise((resolve, reject) => {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            const sql = `
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COUNT(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 END) as orders_with_customer
                FROM transactions
                WHERE created_by = ? AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
            `;

            database.getDb().get(sql, [agentId, currentMonth.toString().padStart(2, '0'), currentYear.toString()], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Calculate monthly commission from vouchers
                const commissionSql = `
                    SELECT COALESCE(SUM(
                        COALESCE(vp.selling_price, 0) - COALESCE(v.agent_price, 0)
                    ), 0) AS commission
                    FROM vouchers v
                    LEFT JOIN voucher_profiles vp ON vp.name = v.profile
                    WHERE v.agent_id = ?
                      AND strftime('%m', v.created_at) = ?
                      AND strftime('%Y', v.created_at) = ?
                `;

                database.getDb().get(commissionSql, [agentId, currentMonth.toString().padStart(2, '0'), currentYear.toString()], (cerr, crow) => {
                    if (cerr) {
                        reject(cerr);
                        return;
                    }

                    resolve({
                        total_orders: row ? row.total_orders : 0,
                        total_amount: row ? row.total_amount : 0,
                        orders_with_customer: row ? row.orders_with_customer : 0,
                        commission: crow ? crow.commission : 0
                    });
                });
            });
        });
    }

    // Get recent orders for agent
    static async getRecentOrders(agentId, limit = 10) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    t.id,
                    t.customer_name,
                    t.customer_phone,
                    t.amount,
                    t.status,
                    t.created_at,
                    COUNT(v.id) as voucher_count,
                    (SELECT profile FROM vouchers WHERE transaction_id = t.id LIMIT 1) as profile
                FROM transactions t
                LEFT JOIN vouchers v ON v.transaction_id = t.id
                WHERE t.created_by = ?
                GROUP BY t.id
                ORDER BY t.created_at DESC
                LIMIT ?
            `;

            database.getDb().all(sql, [agentId, limit], (err, rows) => {
                if (err) {
                    console.error('❌ getRecentOrders SQL error:', err);
                    reject(err);
                } else {
                    console.log(`📋 getRecentOrders: Found ${rows?.length || 0} recent orders for agent ${agentId}`);
                    if (rows?.length > 0) {
                        console.log('🔍 Sample recent order profile:', rows[0].profile);
                    }
                    resolve(rows || []);
                }
            });
        });
    }

    // Get agent orders with pagination
    static async getOrders(req, res) {
        try {
            const agentId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Get total count
            const countSql = `SELECT COUNT(*) as total FROM transactions WHERE created_by = ?`;
            const countResult = await new Promise((resolve, reject) => {
                database.getDb().get(countSql, [agentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get orders with profile information (from first voucher)
            const sql = `
                SELECT
                    t.id,
                    t.customer_name,
                    t.customer_phone,
                    t.amount,
                    t.status,
                    t.created_at,
                    COUNT(v.id) as voucher_count,
                    (SELECT profile FROM vouchers WHERE transaction_id = t.id LIMIT 1) as profile
                FROM transactions t
                LEFT JOIN vouchers v ON v.transaction_id = t.id
                WHERE t.created_by = ?
                GROUP BY t.id
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const orders = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [agentId, limit, offset], (err, rows) => {
                    if (err) {
                        console.error('❌ getOrders SQL error:', err);
                        reject(err);
                    } else {
                        console.log(`📋 getOrders: Found ${rows?.length || 0} orders for agent ${agentId}`);
                        if (rows?.length > 0) {
                            console.log('🔍 Sample order profile:', rows[0].profile);
                        }
                        resolve(rows);
                    }
                });
            });
            
            res.json({
                success: true,
                data: {
                    orders: orders,
                    pagination: {
                        page: page,
                        limit: limit,
                        total: countResult.total,
                        pages: Math.ceil(countResult.total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Error getting agent orders:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get single order detail with vouchers
    static async getOrderDetail(req, res) {
        try {
            const agentId = req.user.id;
            const orderId = parseInt(req.params.id);

            // Get order
            const orderSql = `
                SELECT id, customer_name, customer_phone, amount, status, created_by, created_at
                FROM transactions
                WHERE id = ? AND created_by = ?
            `;
            const order = await new Promise((resolve, reject) => {
                database.getDb().get(orderSql, [orderId, agentId], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
            }

            // Get vouchers linked to this order
            const vouchersSql = `
                SELECT id, username, password, profile, agent_price, duration, created_at
                FROM vouchers
                WHERE transaction_id = ? AND (agent_id = ? OR agent_id IS NULL)
                ORDER BY id ASC
            `;
            const vouchers = await new Promise((resolve, reject) => {
                database.getDb().all(vouchersSql, [orderId, agentId], (err, rows) => {
                    if (err) reject(err); else resolve(rows || []);
                });
            });

            res.json({
                success: true,
                data: {
                    order,
                    vouchers,
                    voucher_count: vouchers.length,
                    total_cost: vouchers.reduce((s, v) => s + (v.agent_price || 0), 0)
                }
            });
        } catch (error) {
            console.error('Error getting order detail:', error);
            res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
        }
    }

    // Get agent reports
    static async getReports(req, res) {
        try {
            const agentId = req.user.id;
            const period = req.query.period || 'month'; // 'today', 'week', 'month'

            let dateCondition = '';
            let params = [agentId];

            switch (period) {
                case 'today':
                    dateCondition = 'AND DATE(created_at) = DATE("now")';
                    break;
                case 'week':
                    dateCondition = 'AND created_at >= datetime("now", "-7 days")';
                    break;
                case 'month':
                    dateCondition = 'AND strftime("%m", created_at) = strftime("%m", "now") AND strftime("%Y", created_at) = strftime("%Y", "now")';
                    break;
                default:
                    dateCondition = '';
            }

            const sql = `
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COUNT(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 END) as orders_with_customer,
                    AVG(amount) as avg_order_amount,
                    MAX(amount) as max_order_amount,
                    MIN(amount) as min_order_amount
                FROM transactions
                WHERE created_by = ? ${dateCondition}
            `;

            const stats = await new Promise((resolve, reject) => {
                database.getDb().get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get daily breakdown for the period
            let dailySql = '';
            if (period === 'month') {
                dailySql = `
                    SELECT
                        DATE(created_at) as date,
                        COUNT(*) as orders,
                        COALESCE(SUM(amount), 0) as amount
                    FROM transactions
                    WHERE created_by = ? AND strftime('%m', created_at) = strftime('%m', 'now') AND strftime('%Y', created_at) = strftime('%Y', 'now')
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `;
            } else if (period === 'week') {
                dailySql = `
                    SELECT
                        DATE(created_at) as date,
                        COUNT(*) as orders,
                        COALESCE(SUM(amount), 0) as amount
                    FROM transactions
                    WHERE created_by = ? AND created_at >= datetime('now', '-7 days')
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                `;
            }

            let dailyStats = [];
            if (dailySql) {
                dailyStats = await new Promise((resolve, reject) => {
                    database.getDb().all(dailySql, [agentId], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    });
                });
            }

            res.json({
                success: true,
                data: {
                    period: period,
                    summary: {
                        total_orders: stats ? stats.total_orders : 0,
                        total_amount: stats ? stats.total_amount : 0,
                        orders_with_customer: stats ? stats.orders_with_customer : 0,
                        avg_order_amount: stats ? stats.avg_order_amount : 0,
                        max_order_amount: stats ? stats.max_order_amount : 0,
                        min_order_amount: stats ? stats.min_order_amount : 0
                    },
                    daily_breakdown: dailyStats
                }
            });

        } catch (error) {
            console.error('Error getting agent reports:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Generate voucher for agent
    static async generateVoucher(req, res) {
        try {
            console.log('🎯 AgentController.generateVoucher called');
            console.log('👤 Agent ID:', req.user?.id);
            console.log('📋 Request body:', req.body);

            const isAdminEnv = req.user && req.user.role === 'admin' && (req.user.id === null || typeof req.user.id === 'undefined');

            const agentId = req.user.id;
            const { profileId, quantity, customerName, customerPhone } = req.body;

            // Validate input
            if (!profileId || !quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile dan jumlah voucher harus diisi'
                });
            }

            if (quantity < 1 || quantity > 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Jumlah voucher harus antara 1-10'
                });
            }

            // Get voucher profile
            const VoucherProfileModel = require('../models/VoucherProfile');
            const profile = await VoucherProfileModel.getById(profileId);
            if (!profile || !profile.is_active) {
                return res.status(404).json({
                    success: false,
                    message: 'Profil voucher tidak ditemukan atau tidak aktif'
                });
            }

            // If ADMIN ENV, skip agent lookup and balance checks
            let agent = null;
            if (!isAdminEnv) {
                // Get agent info
                const UserModel = require('../models/User');
                agent = await UserModel.findById(agentId);
                if (!agent) {
                    return res.status(404).json({
                        success: false,
                        message: 'Agent tidak ditemukan'
                    });
                }

                // Check agent balance
                const totalCost = profile.agent_price * quantity;
                if (agent.balance < totalCost) {
                    return res.status(400).json({
                        success: false,
                        message: `Saldo tidak cukup. Diperlukan: Rp ${totalCost.toLocaleString('id-ID')}, Saldo: Rp ${agent.balance.toLocaleString('id-ID')}`
                    });
                }
            }

            // Generate vouchers & create Mikrotik users
            const vouchers = [];
            const mikrotik = new (require('../config/mikrotik'))();
            try {
                await mikrotik.connect();
                for (let i = 0; i < quantity; i++) {
                    const voucher = await AgentController.createSingleVoucher(profile, isAdminEnv ? null : agentId, customerName, mikrotik);
                    if (voucher) vouchers.push(voucher);
                }
            } catch (mtErr) {
                console.error('💥 Mikrotik connection/create error:', mtErr.message);
                return res.status(500).json({
                    success: false,
                    message: 'Gagal membuat user voucher di Mikrotik: ' + mtErr.message
                });
            } finally {
                try { await mikrotik.disconnect(); } catch (e) {}
            }

            if (vouchers.length === 0) {
                return res.status(500).json({
                    success: false,
                    message: 'Gagal membuat voucher'
                });
            }

            // For agent (non-admin), deduct balance and create transaction
            if (!isAdminEnv) {
                const UserModel = require('../models/User');
                const totalCost = profile.agent_price * quantity;
                await UserModel.deductBalance(agentId, totalCost);
                const transactionId = await AgentController.createVoucherTransaction(agentId, vouchers, profile, totalCost, customerName);
                await AgentController.linkVouchersToTransaction(vouchers.map(v => v.id), transactionId);
            }

            // Optionally send voucher to customer via WhatsApp if provided
            let whatsappStatus = null;
            if (customerPhone && customerPhone.trim()) {
                try {
                    const WhatsAppGateway = require('../services/WhatsAppGateway');
                    const whatsapp = WhatsAppGateway.getInstance();
                    const voucherMessage = AgentController.formatVoucherMessage(
                        vouchers,
                        profile,
                        customerName || 'Customer',
                        isAdminEnv ? (process.env.ADMIN_FULL_NAME || 'Administrator') : (agent?.full_name || 'Agent')
                    );
                    await whatsapp.sendReply(customerPhone, voucherMessage);
                    whatsappStatus = { sent: true, phone: customerPhone, message: 'Voucher berhasil dikirim ke customer' };
                } catch (whatsappError) {
                    whatsappStatus = { sent: false, phone: customerPhone, error: whatsappError.message || 'Gagal mengirim voucher' };
                }
            }

            return res.json({
                success: true,
                message: `${vouchers.length} voucher berhasil dibuat`,
                vouchers: vouchers.map(v => ({ id: v.id, username: v.username, password: v.password, profile: profile.name, duration: profile.duration, agent_price: profile.agent_price })),
                profile: { id: profile.id, name: profile.name, duration: profile.duration, agent_price: profile.agent_price },
                whatsapp: whatsappStatus
            });

        } catch (error) {
            console.error('💥 CRITICAL ERROR in generateVoucher:', error);
            return res.status(500).json({
                success: false,
                message: 'Gagal membuat voucher. Silakan coba lagi.',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    // Format voucher message for WhatsApp
    static formatVoucherMessage(vouchers, profile, customerName, agentName) {
        if (vouchers.length === 1) {
            // Single voucher message
            const voucher = vouchers[0];
            return `🎫 *VOUCHER WIFI*\n\n` +
                   `👤 Customer: ${customerName}\n` +
                   `🏪 Agent: ${agentName}\n\n` +
                   `📦 *Detail Voucher:*\n` +
                   `🔢 Username: *${voucher.username}*\n` +
                   `🔑 Password: *${voucher.password}*\n` +
                   `⏱️ Durasi: ${profile.duration}\n` +
                   `📊 Paket: ${profile.name}\n\n` +
                   `💡 *Cara Menggunakan:*\n` +
                   `1. Hubungkan ke WiFi hotspot\n` +
                   `2. Buka browser, akan muncul halaman login\n` +
                   `3. Masukkan username dan password di atas\n` +
                   `4. Klik login dan nikmati internet\n\n` +
                   `⏰ Voucher berlaku segera setelah login\n` +
                   `🔄 Simpan pesan ini sebagai backup\n\n` +
                   `📞 Hubungi agent jika ada masalah`;
        } else {
            // Multiple vouchers message
            let voucherList = '';
            vouchers.forEach((voucher, index) => {
                voucherList += `${index + 1}. Username: *${voucher.username}* | Password: *${voucher.password}*\n`;
            });

            return `🎫 *VOUCHER WIFI (${vouchers.length} VOUCHER)*\n\n` +
                   `👤 Customer: ${customerName}\n` +
                   `🏪 Agent: ${agentName}\n\n` +
                   `📦 *Detail Voucher:*\n` +
                   `⏱️ Durasi: ${profile.duration}\n` +
                   `📊 Paket: ${profile.name}\n\n` +
                   `🔢 *Daftar Username & Password:*\n` +
                   `${voucherList}\n` +
                   `💡 *Cara Menggunakan:*\n` +
                   `1. Hubungkan ke WiFi hotspot\n` +
                   `2. Buka browser, akan muncul halaman login\n` +
                   `3. Pilih salah satu username/password\n` +
                   `4. Klik login dan nikmati internet\n\n` +
                   `⏰ Voucher berlaku segera setelah login\n` +
                   `🔄 Simpan pesan ini sebagai backup\n\n` +
                   `📞 Hubungi agent jika ada masalah`;
        }
    }

    // Create single voucher
    static async createSingleVoucher(profile, agentId, customerName, mikrotikInstance = null) {
        return new Promise((resolve, reject) => {
            // Generate numeric username with length from profile (default 4)
            const length = Math.max(3, Math.min(12, parseInt(profile.voucher_code_length || 4)));
            const min = Math.pow(10, length - 1);
            const max = Math.pow(10, length) - 1;
            const username = Math.floor(min + Math.random() * (max - min + 1)).toString();
            const password = username; // Same as username

            const sql = `
                INSERT INTO vouchers (
                    username, password, profile, agent_price, duration,
                    created_at, agent_id, customer_name
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            `;

            database.getDb().run(sql, [
                username, password, profile.name, profile.agent_price,
                profile.duration, agentId, customerName || null
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    const createdVoucher = {
                        id: this.lastID,
                        username,
                        password,
                        profile: profile.name,
                        agent_price: profile.agent_price,
                        duration: profile.duration,
                        customer_name: customerName
                    };

                    // Create Mikrotik hotspot user (async waterfall)
                    (async () => {
                        try {
                            const mt = mikrotikInstance || new MikrotikAPI();
                            if (!mikrotikInstance) {
                                await mt.connect();
                            }
                            const actorLabel = agentId ? `Agent ID: ${agentId}` : `Admin: ${process.env.ADMIN_FULL_NAME || 'Administrator'}`;
                            const comment = `${actorLabel} | ${new Date().toLocaleString('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}`;
                            
                            await mt.createHotspotUser(
                                username,
                                password,
                                profile.mikrotik_profile_name || profile.name || 'default',
                                profile.duration,
                                comment
                            );
                            if (!mikrotikInstance) {
                                await mt.disconnect();
                            }
                            resolve(createdVoucher);
                        } catch (mtErr) {
                            console.error('❌ Error creating Mikrotik hotspot user:', mtErr.message);
                            // Rollback DB voucher? Untuk sekarang, kembali error agar user tahu gagal
                            reject(mtErr);
                        }
                    })();
                }
            });
        });
    }

    // Create voucher transaction record
    static async createVoucherTransaction(agentId, vouchers, profile, totalAmount, customerName) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO transactions (
                    customer_name, amount, payment_method, status,
                    created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            database.getDb().run(sql, [
                customerName || `Voucher ${profile.name}`,
                totalAmount,
                'web_agent',
                'completed',
                agentId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // Link vouchers to a transaction
    static async linkVouchersToTransaction(voucherIds, transactionId) {
        if (!voucherIds || voucherIds.length === 0) return;
        await new Promise((resolve, reject) => {
            const placeholders = voucherIds.map(() => '?').join(',');
            const sql = `UPDATE vouchers SET transaction_id = ? WHERE id IN (${placeholders})`;
            database.getDb().run(sql, [transactionId, ...voucherIds], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    // Update agent profile
    static async updateProfile(req, res) {
        try {
            const agentId = req.user.id;
            const { full_name, email } = req.body;

            // Validate input
            if (!full_name || full_name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Nama lengkap harus diisi'
                });
            }

            // Update profile
            const updatedAgent = await UserModel.updateProfile(agentId, {
                full_name: full_name.trim(),
                email: email ? email.trim() : null
            });

            if (!updatedAgent) {
                return res.status(404).json({
                    success: false,
                    message: 'Agent tidak ditemukan'
                });
            }

            res.json({
                success: true,
                message: 'Profil berhasil diupdate',
                data: {
                    id: updatedAgent.id,
                    username: updatedAgent.username,
                    full_name: updatedAgent.full_name,
                    email: updatedAgent.email,
                    role: updatedAgent.role,
                    created_at: updatedAgent.created_at,
                    updated_at: updatedAgent.updated_at
                }
            });

        } catch (error) {
            console.error('Error updating agent profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get voucher profiles for agent
    static async getProfiles(req, res) {
        try {
            console.log('🔍 AgentController.getProfiles called');

            const VoucherProfileModel = require('../models/VoucherProfile');
            console.log('📦 Calling VoucherProfileModel.getActiveForAgent...');

            const profiles = await VoucherProfileModel.getActiveForAgent();

            console.log(`✅ AgentController: Found ${profiles.length} profiles from model`);
            profiles.forEach((profile, index) => {
                console.log(`   ${index + 1}. ${profile.name} - Active: ${profile.is_active}`);
            });

            // Log profile details for debugging
            profiles.forEach((profile, index) => {
                console.log(`Profile ${index + 1}: ${profile.name} - Rp ${profile.agent_price} (${profile.duration})`);
            });
            
            res.json({
                success: true,
                profiles: profiles,
                count: profiles.length,
                message: `Berhasil memuat ${profiles.length} profil voucher`
            });
            
        } catch (error) {
            console.error('Error getting profiles for agent:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            });

            res.status(500).json({
                success: false,
                message: 'Gagal memuat profil voucher. Silakan coba lagi.',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = AgentController;