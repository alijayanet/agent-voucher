const WhatsAppGateway = require('../services/WhatsAppGateway');
const fs = require('fs');
const path = require('path');
const database = require('../config/database');

class WhatsAppController {
    constructor() {
        this.gateway = new WhatsAppGateway();
    }

    // Initialize WhatsApp Gateway
    static async initializeGateway(req, res) {
        try {
            const gateway = WhatsAppGateway.getInstance();
            await gateway.initialize();
            
            res.json({
                success: true,
                message: 'WhatsApp Gateway berhasil diinisialisasi',
                status: gateway.getStatus()
            });
        } catch (error) {
            console.error('❌ Error initializing WhatsApp Gateway:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menginisialisasi WhatsApp Gateway',
                error: error.message
            });
        }
    }

    // Get WhatsApp Gateway status
    static async getStatus(req, res) {
        try {
            const gateway = WhatsAppGateway.getInstance();
            const status = gateway.getStatus();
            
            res.json({
                success: true,
                status
            });
        } catch (error) {
            console.error('❌ Error getting WhatsApp Gateway status:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mendapatkan status WhatsApp Gateway',
                error: error.message
            });
        }
    }

    // Get QR Code for WhatsApp connection
    static async getQRCode(req, res) {
        try {
            const gateway = WhatsAppGateway.getInstance();
            const status = gateway.getStatus();
            
            res.json({
                success: true,
                qrCode: status.qrCode,
                qrCodeDataUrl: status.qrCodeDataUrl,
                qrCodeText: status.qrCodeText,
                connectionStatus: status.connectionStatus,
                isConnected: status.isConnected
            });
        } catch (error) {
            console.error('❌ Error getting QR code:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mendapatkan QR code',
                error: error.message
            });
        }
    }

    // Send test message
    static async sendTestMessage(req, res) {
        try {
            const { phoneNumber, message } = req.body;
            
            if (!phoneNumber || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Nomor telepon dan pesan harus diisi'
                });
            }

            const gateway = new WhatsAppGateway();
            const result = await gateway.sendReply(phoneNumber, message);
            
            if (result) {
                res.json({
                    success: true,
                    message: 'Pesan test berhasil dikirim',
                    data: {
                        phoneNumber,
                        message,
                        timestamp: new Date().toISOString()
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Gagal mengirim pesan test'
                });
            }
        } catch (error) {
            console.error('❌ Error sending test message:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengirim pesan test',
                error: error.message
            });
        }
    }

    // Process incoming message (for testing)
    static async processIncomingMessage(req, res) {
        try {
            const { phoneNumber, message } = req.body;
            
            if (!phoneNumber || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Nomor telepon dan pesan harus diisi'
                });
            }

            const gateway = new WhatsAppGateway();
            const result = await gateway.processMessage(phoneNumber, message);
            
            res.json({
                success: true,
                message: 'Pesan berhasil diproses',
                data: {
                    phoneNumber,
                    message,
                    processed: result,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('❌ Error processing incoming message:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memproses pesan',
                error: error.message
            });
        }
    }

    // Get help message
    static async getHelpMessage(req, res) {
        try {
            const gateway = new WhatsAppGateway();
            const helpMessage = gateway.getHelpMessage();
            
            res.json({
                success: true,
                helpMessage
            });
        } catch (error) {
            console.error('❌ Error getting help message:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mendapatkan pesan bantuan',
                error: error.message
            });
        }
    }

    // Disconnect WhatsApp Gateway
    static async disconnectGateway(req, res) {
        try {
            const gateway = new WhatsAppGateway();
            gateway.disconnect();
            
            res.json({
                success: true,
                message: 'WhatsApp Gateway berhasil diputuskan'
            });
        } catch (error) {
            console.error('❌ Error disconnecting WhatsApp Gateway:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memutuskan WhatsApp Gateway',
                error: error.message
            });
        }
    }

    // Reset WhatsApp session: delete session folder and re-initialize to show new QR
    static async resetSession(req, res) {
        try {
            const gateway = WhatsAppGateway.getInstance();

            // Determine session path
            const sessionPath = gateway.sessionPath || process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions';

            console.log('🔄 Starting WhatsApp session reset...');
            console.log('📁 Session path:', sessionPath);

            // Disconnect first and cleanup
            try { 
                gateway.disconnect(); 
                console.log('✅ WhatsApp disconnected');
                
                // Wait a bit for cleanup
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.log('⚠️ Disconnect error (ignored):', e.message);
            }

            // Remove session directory recursively
            if (fs.existsSync(sessionPath)) {
                console.log('🗑️ Removing session directory:', sessionPath);
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('✅ Session directory removed');
            }

            // Recreate empty directory
            fs.mkdirSync(sessionPath, { recursive: true });
            console.log('📁 Session directory recreated');

            // Re-initialize to trigger QR code
            console.log('🔄 Re-initializing WhatsApp Gateway...');
            await gateway.initialize();
            console.log('✅ WhatsApp Gateway re-initialized');

            // Wait for QR code to be generated with polling
            console.log('⏳ Waiting for QR code generation...');
            let attempts = 0;
            const maxAttempts = 20; // 20 seconds max wait
            let status = gateway.getStatus();
            
            while (attempts < maxAttempts && !status.qrCodeDataUrl && !status.qrCodeText) {
                console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts} - Waiting for QR code...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                status = gateway.getStatus();
                attempts++;
            }

            console.log('📊 Gateway status after reset:', {
                isConnected: status.isConnected,
                connectionStatus: status.connectionStatus,
                hasQRCode: !!(status.qrCodeDataUrl || status.qrCodeText),
                isInitialized: status.isInitialized,
                attempts: attempts
            });

            const finalStatus = gateway.getStatus();
            console.log('📊 Final status:', {
                isConnected: finalStatus.isConnected,
                connectionStatus: finalStatus.connectionStatus,
                hasQRCode: !!(finalStatus.qrCodeDataUrl || finalStatus.qrCodeText),
                isInitialized: finalStatus.isInitialized
            });

            res.json({
                success: true,
                message: 'Session WhatsApp direset. QR Code baru siap untuk dipindai.',
                status: finalStatus
            });

        } catch (error) {
            console.error('❌ Error resetting WhatsApp session:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mereset sesi WhatsApp',
                error: error.message
            });
        }
    }

    // Get order history
    static async getOrderHistory(req, res) {
        try {
            const { agentId, limit = 50, offset = 0 } = req.query;
            
            // First, check if transactions table exists and has data
            const database = require('../config/database');
            
            // Check if table exists
            database.getDb().get("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'", (err, tableExists) => {
                if (err) {
                    console.error('❌ Error checking table existence:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Database error checking table'
                    });
                }
                
                if (!tableExists) {
                    console.log('📋 Transactions table does not exist, returning empty result');
                    return res.json({
                        success: true,
                        orders: [],
                        pagination: {
                            limit: parseInt(limit),
                            offset: parseInt(offset),
                            total: 0
                        }
                    });
                }
                
                // Check if there are any transactions with whatsapp payment method
                database.getDb().get("SELECT COUNT(*) as count FROM transactions WHERE payment_method = 'whatsapp'", (err, countResult) => {
                    if (err) {
                        console.error('❌ Error counting whatsapp transactions:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Database error counting transactions'
                        });
                    }
                    
                    const whatsappCount = countResult.count || 0;
                    console.log(`📊 Found ${whatsappCount} WhatsApp transactions`);
                    
                    if (whatsappCount === 0) {
                        // No WhatsApp transactions found, return empty result
                        return res.json({
                            success: true,
                            orders: [],
                            pagination: {
                                limit: parseInt(limit),
                                offset: parseInt(offset),
                                total: 0
                            }
                        });
                    }
                    
                    // Query for WhatsApp transactions
                    let sql = `
                        SELECT t.*, u.username as agent_username, u.full_name as agent_name
                        FROM transactions t
                        JOIN users u ON t.created_by = u.id
                        WHERE t.payment_method = 'whatsapp'
                    `;
                    
                    let params = [];
                    
                    if (agentId) {
                        sql += ` AND t.created_by = ?`;
                        params.push(agentId);
                    }
                    
                    sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
                    params.push(parseInt(limit), parseInt(offset));
                    
                    database.getDb().all(sql, params, (err, rows) => {
                        if (err) {
                            console.error('❌ Database error querying transactions:', err);
                            return res.status(500).json({
                                success: false,
                                message: 'Database error querying transactions'
                            });
                        }
                        
                        console.log(`✅ Successfully retrieved ${rows ? rows.length : 0} WhatsApp orders`);
                        
                        res.json({
                            success: true,
                            orders: rows || [],
                            pagination: {
                                limit: parseInt(limit),
                                offset: parseInt(offset),
                                total: rows ? rows.length : 0
                            }
                        });
                    });
                });
            });
            
        } catch (error) {
            console.error('❌ Error getting order history:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mendapatkan riwayat order',
                error: error.message
            });
        }
    }

    // Get agent order statistics
    static async getAgentOrderStats(req, res) {
        try {
            const { agentId } = req.params;
            
            if (!agentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Agent ID diperlukan'
                });
            }

            const sql = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(amount) as total_revenue,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    AVG(amount) as average_order_value,
                    MAX(created_at) as last_order_date
                FROM transactions 
                WHERE created_by = ? AND payment_method = 'whatsapp'
            `;
            
            const database = require('../config/database');
            
            database.getDb().get(sql, [agentId], (err, row) => {
                if (err) {
                    console.error('❌ Database error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Database error'
                    });
                }
                
                res.json({
                    success: true,
                    stats: {
                        total_orders: row.total_orders || 0,
                        total_revenue: row.total_revenue || 0,
                        active_days: row.active_days || 0,
                        average_order_value: row.average_order_value || 0,
                        last_order_date: row.last_order_date || null
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ Error getting agent order stats:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mendapatkan statistik order agent',
                error: error.message
            });
        }
    }

    // Save OTP Settings
    static async saveOTPSettings(req, res) {
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

            // Save to database
            const sql = `
                INSERT OR REPLACE INTO otp_settings 
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
                        console.error('Error saving OTP settings:', err);
                        reject(err);
                    } else {
                        console.log('OTP settings saved:', { enabled, length, expiry });
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Pengaturan OTP berhasil disimpan',
                data: {
                    enabled,
                    length: length || 6,
                    expiry: expiry || 600
                }
            });

        } catch (error) {
            console.error('Error saving OTP settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get OTP Settings
    static async getOTPSettings(req, res) {
        try {
            const sql = `SELECT * FROM otp_settings WHERE id = 1`;
            
            const settings = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [], (err, row) => {
                    if (err) {
                        console.error('Error getting OTP settings:', err);
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
            console.error('Error getting OTP settings:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = WhatsAppController;
