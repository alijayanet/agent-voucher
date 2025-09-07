const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const VoucherProfileModel = require('../models/VoucherProfile');
const VoucherModel = require('../models/Voucher');
const AgentModel = require('../models/Agent');
const TransactionModel = require('../models/Transaction');
const database = require('../config/database');

class WhatsAppGateway {
    constructor() {
        this.isConnected = false;
        this.phoneNumber = null;
        this.orders = new Map(); // Menyimpan order yang sedang diproses
        this.sock = null;
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions';
        this.qrCode = null;
        this.qrCodeDataUrl = null; // Untuk menampilkan QR code di dashboard
        this.qrCodeText = null; // Backup QR code text
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.sentMessages = new Set(); // Track messages sent by bot to prevent self-response
        
        // Ensure session directory exists
        if (!fs.existsSync(this.sessionPath)) {
            fs.mkdirSync(this.sessionPath, { recursive: true });
        }
    }

    // Static instance untuk singleton pattern
    static getInstance() {
        if (!WhatsAppGateway.instance) {
            WhatsAppGateway.instance = new WhatsAppGateway();
        }
        return WhatsAppGateway.instance;
    }

    // Initialize WhatsApp connection using Baileys
    async initialize() {
        try {
            console.log('🔄 Initializing WhatsApp Gateway with Baileys...');
            console.log('📁 Session path:', this.sessionPath);
            
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            console.log('✅ Auth state loaded');
            
            this.sock = makeWASocket({
                auth: state,
                logger: require('pino')({ level: 'silent' }),
                browser: ['Mikrotik Voucher WiFi', 'Chrome', '1.0.0']
            });
            console.log('✅ Socket created');

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                console.log('🔄 Connection update received:', {
                    connection: connection,
                    hasQR: !!qr,
                    qrLength: qr ? qr.length : 0
                });
                
                if (qr) {
                    this.qrCode = qr;
                    console.log('📱 Scan QR Code ini di WhatsApp Anda:');
                    console.log('🔗 QR Code string length:', qr.length);
                    
                    // Generate QR code data URL untuk dashboard
                    try {
                        const qrcodeLib = require('qrcode');
                        // Use the QR code string directly from the parameter
                        this.qrCodeDataUrl = await qrcodeLib.toDataURL(qr);
                        console.log('✅ QR Code generated for dashboard');
                        console.log('🔗 QR Code Data URL length:', this.qrCodeDataUrl.length);
                    } catch (error) {
                        console.error('❌ Error generating QR code data URL:', error);
                        console.error('❌ QR Code data:', typeof qr, qr ? qr.length : 'null');
                        
                        // Fallback: create simple text representation
                        try {
                            this.qrCodeDataUrl = `data:text/plain;base64,${Buffer.from('QR Code Available - Check Terminal').toString('base64')}`;
                            console.log('✅ Fallback QR code created');
                        } catch (fallbackError) {
                            console.error('❌ Fallback also failed:', fallbackError);
                            this.qrCodeDataUrl = null;
                        }
                    }
                    
                    // Store QR code text as backup for dashboard
                    this.qrCodeText = qr;
                    console.log('📝 QR Code text stored for dashboard display');
                    
                    this.connectionStatus = 'qr_ready';
                    console.log('✅ Connection status updated to qr_ready');
                }
                
                // Handle other connection states
                if (connection === 'open') {
                    console.log('✅ WhatsApp connected successfully');
                    this.isConnected = true;
                    this.connectionStatus = 'connected';
                    this.qrCode = null;
                    this.qrCodeDataUrl = null;
                    this.qrCodeText = null;
                } else if (connection === 'close') {
                    console.log('❌ WhatsApp connection closed');
                    this.isConnected = false;
                    this.connectionStatus = 'disconnected';
                    
                    // Define in outer scope to avoid ReferenceError
                    let shouldReconnect = true;
                    try {
                        shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                        console.log('❌ Connection closed due to ', lastDisconnect?.error?.message || lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                    } catch (error) {
                        console.error('❌ Error handling connection close:', error);
                        console.log('❌ Connection closed, will attempt reconnection');
                        shouldReconnect = true; // Default to reconnect on unknown errors
                    }
                    
                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.connectionStatus = 'reconnecting';
                        this.reconnectAttempts++;
                        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

                        // Use setTimeout with error handling
                        setTimeout(async () => {
                            try {
                                await this.initialize();
                            } catch (reconnectError) {
                                console.error('❌ Reconnection failed:', reconnectError);
                                this.connectionStatus = 'error';
                                this.isConnected = false;
                            }
                        }, 3000);
                    } else {
                        this.connectionStatus = shouldReconnect ? 'max_retries_exceeded' : 'logged_out';
                        this.isConnected = false;
                        this.reconnectAttempts = 0;
                        console.log('🔚 Max reconnection attempts reached or logged out');
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp connected successfully!');
                    this.isConnected = true;
                    this.connectionStatus = 'connected';
                    this.phoneNumber = this.sock.user?.id?.split('@')[0];
                    this.reconnectAttempts = 0;
                    this.qrCode = null;
                    this.qrCodeDataUrl = null;
                    
                    // Start listening for messages
                    this.startMessageListener();
                }
            });

            // Handle incoming messages
            this.sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                
                // Enhanced filtering to prevent bot from responding to own messages
                if (!msg.key.fromMe && msg.message) {
                    console.log(`📨 Message received from: ${msg.key.remoteJid}, fromMe: ${msg.key.fromMe}`);
                    await this.handleIncomingMessage(msg);
                } else {
                    console.log(`🚫 Ignored message - fromMe: ${msg.key.fromMe}, hasMessage: ${!!msg.message}`);
                }
            });

            // Save credentials when updated
            this.sock.ev.on('creds.update', saveCreds);

            console.log('✅ WhatsApp Gateway initialized with Baileys');
            
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp Gateway:', error);
            this.isConnected = false;
            this.connectionStatus = 'error';
            throw error;
        }
    }

    // Handle incoming WhatsApp message
    async handleIncomingMessage(msg) {
        try {
            const phoneNumber = msg.key.remoteJid.split('@')[0];
            const messageText = msg.message?.conversation || 
                              msg.message?.extendedTextMessage?.text || 
                              msg.message?.imageMessage?.caption || '';

            console.log(`📱 Received message from ${phoneNumber}: ${messageText}`);
            
            // Process the message
            await this.processMessage(phoneNumber, messageText);
            
        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
        }
    }

    // Start listening for incoming messages
    startMessageListener() {
        console.log('👂 Starting WhatsApp message listener...');
        
        // Message listener is now handled by Baileys events
        // No need for manual polling
    }

    // Check for new messages (simulated)
    async checkForNewMessages() {
        if (!this.isConnected) return;
        
        // This method is no longer needed with Baileys
        // Messages are handled automatically via events
    }

    // Process incoming WhatsApp message
    async processMessage(phoneNumber, message) {
        try {
            console.log(`📱 Processing message from ${phoneNumber}: ${message}`);

            // Clean message (remove extra spaces, newlines)
            const cleanMessage = message.trim().replace(/\s+/g, ' ');
            
            // Skip processing if message looks like a system notification
            // These are usually sent by the bot itself and should not be processed as commands
            const systemNotificationPatterns = [
                /^✅.*[Dd]eposit.*berhasil/i,
                /^💰.*[Dd]eposit.*telah.*berhasil/i,
                /^🎯.*[Vv]oucher.*berhasil/i,
                /^📱.*[Nn]otifikasi/i,
                /^⏰.*[Ww]aktu:/i,
                /^💡.*[Tt]erima kasih/i,
                /^🆔.*Request ID:/i,
                /^❌.*REQUEST.*REJECTED/i,
                /^✅.*REQUEST.*APPROVED/i,
                /^🎉.*PEMBELIAN.*VOUCHER.*BERHASIL/i, // Add pattern for successful voucher notifications
                /^🔐.*Detail Voucher:/i, // Add pattern for voucher details
                /^👤.*Username:/i, // Add pattern for username line
                /^🔑.*Password:/i // Add pattern for password line
            ];
            
            for (const pattern of systemNotificationPatterns) {
                if (pattern.test(cleanMessage)) {
                    console.log(`🚫 Skipping system notification: ${cleanMessage.substring(0, 50)}...`);
                    return; // Don't process system notifications as commands
                }
            }
            
            // Check if this message was recently sent by the bot itself
            const messageHash = `${phoneNumber}:${cleanMessage.substring(0, 100)}`;
            if (this.sentMessages.has(messageHash)) {
                console.log(`🚫 Skipping bot's own message: ${cleanMessage.substring(0, 50)}...`);
                this.sentMessages.delete(messageHash); // Remove to free memory
                return;
            }

            // Check if sender is a registered agent
            const agent = await this.findAgentByPhone(phoneNumber);

            // Check if sender is a dedicated admin phone
            const dedicatedAdmin = await this.isDedicatedAdminPhone(phoneNumber);

            // Allow registration commands even for unregistered numbers
            const lowerMessage = cleanMessage.toLowerCase();

            // Handle dedicated admin phone commands first
            if (dedicatedAdmin) {
                console.log(`👑 Dedicated admin command from ${phoneNumber} (${dedicatedAdmin.admin_name})`);
                return await this.handleDedicatedAdminCommands(phoneNumber, dedicatedAdmin, cleanMessage);
            }

            if (!agent) {
                // Allow ONLY registration command for unregistered numbers; otherwise ignore silently
                if (lowerMessage.startsWith('daftar_agent') || lowerMessage.startsWith('register_agent')) {
                    console.log(`👤 Registration request from ${phoneNumber}`);
                    return await this.handleAgentRegistration(phoneNumber, cleanMessage);
                }
                console.log(`🚫 Ignoring message from unregistered number (no reply): ${phoneNumber}`);
                return; // Do not send any reply for unregistered numbers
            }

            // Check if agent is active
            if (!agent.is_active) {
                console.log(`🚫 Ignoring message from inactive agent: ${phoneNumber}`);
                // Jangan kirim reply untuk agent yang tidak aktif
                return;
            }

            // Parse message content
            const order = this.parseOrderMessage(cleanMessage);
            if (!order) {
                // Cek apakah ini adalah perintah khusus yang diperbolehkan
                const lowerMessage = cleanMessage.toLowerCase();

                if (lowerMessage === 'help' || lowerMessage === 'bantuan' || lowerMessage === 'menu') {
                    console.log(`📋 Help requested from ${phoneNumber}`);
                    return this.sendReply(phoneNumber, this.getHelpMessage(agent));
                } else if (lowerMessage === 'status' || lowerMessage === 'saldo') {
                    console.log(`💰 Balance check from ${phoneNumber}`);
                    return this.sendReply(phoneNumber,
                        `💰 *Status Agent*\n\n` +
                        `👤 Nama: ${agent.full_name}\n` +
                        `📱 Nomor: ${agent.phone}\n` +
                        `💵 Saldo: Rp ${agent.balance.toLocaleString('id-ID')}\n` +
                        `📊 Role: ${agent.role}\n\n` +
                        `💡 Kirim "beli [harga] [jumlah] [nomor]" untuk order voucher`);
                } else if (lowerMessage === 'laporan' || lowerMessage === 'report') {
                    console.log(`📊 Report request from ${phoneNumber}`);
                    const reportMessage = await this.getAgentReport(agent.id);
                    return this.sendReply(phoneNumber, reportMessage);
                } else if (lowerMessage === 'otp' || lowerMessage === 'minta otp' || lowerMessage === 'request otp') {
                    console.log(`🔐 OTP requested from ${phoneNumber}`);
                    const otpResult = await this.generateOTP(phoneNumber);
                    if (otpResult.success) {
                        return; // OTP already sent in generateOTP method
                    } else {
                        return this.sendReply(phoneNumber, `❌ ${otpResult.message}`);
                    }
                } else if (this.isAdmin(agent) && lowerMessage.startsWith('admin_')) {
                    // Admin commands
                    return await this.handleAdminCommands(phoneNumber, agent, cleanMessage);
                } else {
                    // Check if this might be an auto-response to our own message
                    // If the message contains typical voucher notification elements, don't respond
                    const voucherNotificationPatterns = [
                        /voucher/i,
                        /username/i,
                        /password/i,
                        /berhasil/i,
                        /terima kasih/i,
                        /pembelian/i,
                        /kode voucher/i,
                        /detail voucher/i,
                        /cara menggunakan/i,
                        /berlaku sampai/i
                    ];
                    
                    let isLikelyVoucherNotification = false;
                    for (const pattern of voucherNotificationPatterns) {
                        if (pattern.test(cleanMessage)) {
                            isLikelyVoucherNotification = true;
                            break;
                        }
                    }
                    
                    if (isLikelyVoucherNotification) {
                        console.log(`🚫 Skipping likely voucher notification response to ${phoneNumber}: ${cleanMessage.substring(0, 50)}...`);
                        return; // Don't send any reply for voucher notifications
                    }
                    
                    // Check for other common auto-responses or non-command messages
                    const autoResponsePatterns = [
                        /ok/i,
                        /terima kasih/i,
                        /thanks/i,
                        /oke/i,
                        /baik/i,
                        /siap/i,
                        /ya/i,
                        /tidak/i,
                        /no/i,
                        /yes/i,
                        /sudah/i,
                        /belum/i,
                        /mantap/i,
                        /bagus/i,
                        /keren/i,
                        /👍/,
                        /👌/,
                        /😊/,
                        /😀/,
                        /🙏/
                    ];
                    
                    let isAutoResponse = false;
                    for (const pattern of autoResponsePatterns) {
                        if (pattern.test(cleanMessage)) {
                            isAutoResponse = true;
                            break;
                        }
                    }
                    
                    if (isAutoResponse) {
                        console.log(`🚫 Ignoring auto-response message from ${phoneNumber}: ${cleanMessage.substring(0, 50)}...`);
                        return; // Don't send any reply for auto-responses
                    }
                    
                    // For any other unrecognized messages, ignore silently
                    console.log(`🚫 Ignoring unrecognized message from ${phoneNumber}: ${cleanMessage.substring(0, 50)}...`);
                    return; // Don't send any reply for unrecognized messages
                }
            }

            // Check OTP if required
            const otpSettings = await this.getOTPSettings();
            
            if (otpSettings.enabled) {
                if (order.requiresOTP) {
                    // Validate OTP
                    const otpResult = await this.validateOTP(phoneNumber, order.otp);
                    if (!otpResult.success) {
                        return this.sendReply(phoneNumber, 
                            `🔐 *OTP Tidak Valid!*\n\n` +
                            `❌ ${otpResult.message}\n\n` +
                            `💡 Minta OTP baru: ketik "otp"\n` +
                            `🔍 Format: otp [kode] beli [profile] [jumlah]`);
                    }
                    console.log(`✅ OTP validated for ${phoneNumber}: ${order.otp}`);
                } else {
                    // OTP enabled but not provided in order
                    return this.sendReply(phoneNumber, 
                        `🔐 *OTP Diperlukan!*\n\n` +
                        `⚠️ Sistem OTP sedang aktif, gunakan format:\n` +
                        `📝 otp [kode] beli [profile] [jumlah]\n\n` +
                        `💡 Minta OTP: ketik "otp"\n` +
                        `🔍 Contoh: otp 123456 beli paket1jam 5`);
                }
            }

            // Process the order
            return await this.processOrder(agent, order, phoneNumber);

        } catch (error) {
            console.error('❌ Error processing WhatsApp message:', error);
            // Jangan kirim error message untuk menghindari spam
            return;
        }
    }

    // Handle agent registration via WhatsApp
    async handleAgentRegistration(phoneNumber, message) {
        try {
            console.log(`👤 Processing agent registration from ${phoneNumber}: ${message}`);

            // Parse registration message
            // Format: daftar_agent [nama_lengkap]
            const parts = message.split(/\s+/);
            if (parts.length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Format tidak valid!\n\n` +
                    `📝 Format yang benar:\n` +
                    `*daftar_agent [nama_lengkap]*\n\n` +
                    `💡 Contoh: *daftar_agent Ahmad Setiawan*`);
            }

            // Remove "daftar_agent" from parts
            parts.shift();
            const fullName = parts.join(' ');

            if (!fullName || fullName.trim().length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Nama lengkap harus diisi!\n\n` +
                    `💡 Contoh: *daftar_agent Ahmad Setiawan*`);
            }

            // Normalize phone number
            let normalizedPhone = phoneNumber.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            // Check if phone number already registered
            const existingAgent = await this.findAgentByPhone(normalizedPhone);
            if (existingAgent) {
                return this.sendReply(phoneNumber,
                    `❌ Nomor WhatsApp ini sudah terdaftar!\n\n` +
                    `👤 Nama: ${existingAgent.full_name}\n` +
                    `📊 Status: ${existingAgent.is_active ? 'Aktif' : 'Menunggu Aktivasi'}\n\n` +
                    `💡 Jika belum aktif, hubungi admin untuk aktivasi.`);
            }

            // Create registration request in database
            const database = require('../config/database');
            const sql = `INSERT INTO agent_registrations (phone_number, full_name, status, created_at)
                        VALUES (?, ?, 'pending', datetime('now'))`;

            return new Promise((resolve, reject) => {
                database.getDb().run(sql, [normalizedPhone, fullName], function(err) {
                    if (err) {
                        console.error('❌ Error saving agent registration:', err);
                        return reject(err);
                    }

                    console.log(`✅ Agent registration saved for ${normalizedPhone} - ${fullName}`);

                    // Send confirmation message
                    const replyMessage =
                        `✅ *Pendaftaran Agent Berhasil!*\n\n` +
                        `👤 Nama: ${fullName}\n` +
                        `📱 Nomor: ${normalizedPhone}\n\n` +
                        `⏳ Status: Menunggu Persetujuan Admin\n\n` +
                        `💡 Admin akan memproses pendaftaran Anda dalam 1-2 hari.\n` +
                        `📩 Anda akan mendapat notifikasi setelah disetujui.\n\n` +
                        `❓ Jika ada pertanyaan, silakan hubungi admin.`;

                    resolve(this.sendReply(phoneNumber, replyMessage));
                });
            });

        } catch (error) {
            console.error('❌ Error handling agent registration:', error);
            return this.sendReply(phoneNumber,
                `❌ Terjadi kesalahan saat memproses pendaftaran!\n\n` +
                `💡 Silakan coba lagi atau hubungi admin.`);
        }
    }

    // Check if user is admin
    isAdmin(agent) {
        return agent && agent.role === 'admin';
    }

    // Check if phone number is a dedicated admin phone
    async isDedicatedAdminPhone(phoneNumber) {
        try {
            // Normalize phone number
            let normalizedPhone = phoneNumber.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            const database = require('../config/database');
            const sql = `SELECT * FROM admin_phones WHERE phone_number = ? AND is_active = 1`;

            return new Promise((resolve, reject) => {
                database.getDb().get(sql, [normalizedPhone], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } catch (error) {
            console.error('❌ Error checking dedicated admin phone:', error);
            return null;
        }
    }

    // Handle dedicated admin phone commands (simple commands)
    async handleDedicatedAdminCommands(phoneNumber, adminPhone, message) {
        try {
            console.log(`👑 Processing dedicated admin command: ${message}`);

            // Update last used timestamp and command count
            const database = require('../config/database');
            const updateSql = `
                UPDATE admin_phones
                SET last_used = datetime('now'), total_commands = total_commands + 1
                WHERE id = ?
            `;
            database.getDb().run(updateSql, [adminPhone.id]);

            const lowerMessage = message.toLowerCase().trim();

            // Parse command
            if (lowerMessage.startsWith('daftar ')) {
                return await this.handleAdminDaftarCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('deposit ')) {
                return await this.handleAdminDepositCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('approve ')) {
                return await this.handleAdminApproveDepositCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('reject ')) {
                return await this.handleAdminRejectDepositCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('terima ')) {
                return await this.handleAdminApproveDepositCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('tolak ')) {
                return await this.handleAdminRejectDepositCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('hapus ')) {
                return await this.handleAdminHapusCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('edit ')) {
                return await this.handleAdminEditCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('laporan ')) {
                return await this.handleAdminLaporanCommand(phoneNumber, message);
            } else if (lowerMessage.startsWith('status ')) {
                return await this.handleAdminStatusCommand(phoneNumber, message);
            } else if (lowerMessage === 'help' || lowerMessage === 'bantuan' || lowerMessage === 'menu') {
                return this.sendReply(phoneNumber, this.getDedicatedAdminHelp());
            } else if (lowerMessage === 'list' || lowerMessage === 'daftar_agent') {
                return await this.handleAdminListAgents(phoneNumber);
            } else if (lowerMessage === 'pending' || lowerMessage === 'registrasi') {
                return await this.handleAdminPendingRegistrations(phoneNumber);
            } else if (lowerMessage.startsWith('voucher ') || lowerMessage.startsWith('beli ')) {
                const parts = message.split(/\s+/);
                if (parts.length < 3) {
                    return this.sendReply(phoneNumber, '❌ Format: voucher [profile] [jumlah] [customer_name] [customer_phone]');
                }
                const profile = parts[1];
                const quantity = parseInt(parts[2]);
                const customerName = parts[3] || 'Admin Customer';
                const customerPhone = parts[4] || '';
                return await this.adminCreateVoucher(phoneNumber, profile, quantity, customerName, customerPhone);
            } else {
                // Check if this might be an auto-response or non-command message
                const autoResponsePatterns = [
                    /ok/i,
                    /terima kasih/i,
                    /thanks/i,
                    /oke/i,
                    /baik/i,
                    /siap/i,
                    /ya/i,
                    /tidak/i,
                    /no/i,
                    /yes/i,
                    /sudah/i,
                    /belum/i,
                    /mantap/i,
                    /bagus/i,
                    /keren/i,
                    /👍/,
                    /👌/,
                    /😊/,
                    /😀/,
                    /🙏/
                ];
                
                let isAutoResponse = false;
                for (const pattern of autoResponsePatterns) {
                    if (pattern.test(cleanMessage)) {
                        isAutoResponse = true;
                        break;
                    }
                }
                
                if (isAutoResponse) {
                    console.log(`🚫 Ignoring auto-response message from admin ${phoneNumber}: ${cleanMessage.substring(0, 50)}...`);
                    return; // Don't send any reply for auto-responses
                }
                
                // For any other unrecognized admin commands, ignore silently
                console.log(`🚫 Ignoring unrecognized admin command from ${phoneNumber}: ${cleanMessage.substring(0, 50)}...`);
                return; // Don't send any reply for unrecognized admin commands
            }

        } catch (error) {
            console.error('❌ Error handling dedicated admin command:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat memproses perintah.');
        }
    }

    // Get help message for dedicated admin
    getDedicatedAdminHelp() {
        return `👑 *ADMIN COMMANDS - SIMPLE MODE*\n\n` +
               `📝 *Perintah Daftar Agent:*\n` +
               `• daftar [nama_agent] [nomor_wa]\n` +
               `  Contoh: daftar Ahmad 628123456789\n\n` +
               `💰 *Perintah Deposit:*\n` +
               `• deposit [nama_agent] [jumlah]\n` +
               `  Contoh: deposit Ahmad 50000\n\n` +
               `✅ *Perintah Terima Request:*\n` +
               `• terima [request_id]\n` +
               `  Contoh: terima 123\n\n` +
               `❌ *Perintah Tolak Request:*\n` +
               `• tolak [request_id] [alasan]\n` +
               `  Contoh: tolak 123 Data tidak lengkap\n\n` +
               `🗑️ *Perintah Hapus Agent:*\n` +
               `• hapus [nama_agent]\n` +
               `  Contoh: hapus Ahmad\n\n` +
               `✏️ *Perintah Edit Agent:*\n` +
               `• edit [nama_agent]\n` +
               `  Contoh: edit Ahmad\n\n` +
               `📊 *Perintah Laporan:*\n` +
               `• laporan [nama_agent]\n` +
               `  Contoh: laporan Ahmad\n\n` +
               `📈 *Perintah Status:*\n` +
               `• status [nama_agent]\n` +
               `  Contoh: status Ahmad\n\n` +
               `🎫 *Perintah Voucher:*\n` +
               `• voucher [profile] [jumlah] [customer] [phone]\n` +
               `  Contoh: voucher paket1jam 5 Customer 081234567890\n` +
               `• beli [profile] [jumlah] [customer] [phone]\n` +
               `  Contoh: beli paket1hari 3 Ahmad 081234567890\n\n` +
               `📋 *Perintah Lain:*\n` +
               `• list - Daftar semua agent\n` +
               `• pending - Pendaftaran pending\n` +
               `• help - Menu ini\n\n` +
               `💡 *Catatan:*\n` +
               `• Gunakan nama lengkap agent\n` +
               `• Nomor WA tanpa + dan spasi\n` +
               `• Deposit dalam rupiah`;
    }

    // ===== DEDICATED ADMIN COMMAND HANDLERS =====

    // Handle: daftar [nama] [nomor]
    async handleAdminDaftarCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 3) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `📝 Format yang benar:\n` +
                    `*daftar [nama_agent] [nomor_wa]*\n\n` +
                    `💡 Contoh: daftar Ahmad 628123456789`);
            }

            const name = parts.slice(1, -1).join(' '); // All parts except first and last
            const rawPhone = parts[parts.length - 1];

            if (!name || name.trim().length < 2) {
                return this.sendReply(phoneNumber, '❌ Nama agent minimal 2 karakter!');
            }

            // Validate phone number
            let normalizedPhone = rawPhone.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
                return this.sendReply(phoneNumber, '❌ Nomor WhatsApp tidak valid!');
            }

            // Check if phone number already registered
            const existingAgent = await this.findAgentByPhone(normalizedPhone);
            if (existingAgent) {
                return this.sendReply(phoneNumber,
                    `❌ Nomor WhatsApp sudah terdaftar!\n\n` +
                    `👤 Nama: ${existingAgent.full_name}\n` +
                    `📊 Status: ${existingAgent.is_active ? 'Aktif' : 'Tidak Aktif'}`);
            }

            // Generate username and secure password
            const username = normalizedPhone.replace(/^62/, '');
            const crypto = require('crypto');
            const password = crypto.randomBytes(4).toString('hex'); // 8 char secure password

            // Create user account
            const UserModel = require('../models/User');
            const user = await UserModel.create({
                username: username,
                password: password,
                email: null,
                full_name: name,
                phone: normalizedPhone,
                role: 'agent'
            });

            // Send welcome message to new agent
            const welcomeMessage =
                `🎉 *SELAMAT! Akun Agent Anda Sudah Dibuat*\n\n` +
                `👤 Nama: ${name}\n` +
                `👤 Username: ${username}\n` +
                `🔑 Password: ${password}\n` +
                `📱 Nomor: ${normalizedPhone}\n\n` +
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
                await this.sendReply(normalizedPhone, welcomeMessage);
                console.log(`✅ Welcome message sent to ${normalizedPhone}`);
            } catch (whatsappError) {
                console.error('❌ Error sending WhatsApp welcome message:', whatsappError);
            }

            return this.sendReply(phoneNumber,
                `✅ *Agent Berhasil Dibuat!*\n\n` +
                `👤 Nama: ${name}\n` +
                `📱 Nomor: ${normalizedPhone}\n` +
                `👤 Username: ${username}\n` +
                `🔑 Password: ${password}\n\n` +
                `💡 Agent sudah menerima pesan selamat datang.`);

        } catch (error) {
            console.error('Error in handleAdminDaftarCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat mendaftarkan agent.');
        }
    }

    // Handle: deposit [nama] [jumlah]
    async handleAdminDepositCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 3) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `💰 Format yang benar:\n` +
                    `*deposit [nama_agent] [jumlah]*\n\n` +
                    `💡 Contoh: deposit Ahmad 50000`);
            }

            const name = parts.slice(1, -1).join(' '); // All parts except first and last
            const amount = parseInt(parts[parts.length - 1]);

            if (!name || name.trim().length < 2) {
                return this.sendReply(phoneNumber, '❌ Nama agent minimal 2 karakter!');
            }

            if (!amount || amount < 1000) {
                return this.sendReply(phoneNumber, '❌ Jumlah deposit minimal Rp 1.000!');
            }

            // Find agent by name
            const agent = await this.findAgentByName(name);
            if (!agent) {
                return this.sendReply(phoneNumber,
                    `❌ Agent "${name}" tidak ditemukan!\n\n` +
                    `💡 Gunakan nama lengkap agent yang sudah terdaftar.`);
            }

            if (!agent.is_active) {
                return this.sendReply(phoneNumber,
                    `❌ Agent "${name}" tidak aktif!\n\n` +
                    `📊 Status: Tidak Aktif`);
            }

            // Get current balance
            const UserModel = require('../models/User');
            const currentBalance = await UserModel.getBalance(agent.id);
            const newBalance = currentBalance + amount;

            // Update balance
            await UserModel.updateBalance(agent.id, newBalance);

            // Create transaction record
            const TransactionModel = require('../models/Transaction');
            await TransactionModel.create({
                customer_name: 'Deposit Agent (WhatsApp)',
                customer_phone: null,
                amount: amount,
                payment_method: 'admin_deposit_whatsapp',
                status: 'completed',
                created_by: 1, // Admin user ID
                notes: `Deposit via WhatsApp admin untuk ${agent.full_name}`
            });

            // Send notification to agent
            try {
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
                    `💡 Terima kasih atas kerjasamanya!`;

                await this.sendReply(agent.phone, depositMessage);
            } catch (whatsappError) {
                console.error('Error sending deposit notification:', whatsappError);
            }

            return this.sendReply(phoneNumber,
                `✅ *Deposit Berhasil!*\n\n` +
                `👤 Agent: ${agent.full_name}\n` +
                `💵 Jumlah: Rp ${amount.toLocaleString('id-ID')}\n` +
                `💰 Saldo Baru: Rp ${newBalance.toLocaleString('id-ID')}\n\n` +
                `💡 Agent sudah menerima notifikasi deposit.`);

        } catch (error) {
            console.error('Error in handleAdminDepositCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat deposit.');
        }
    }

    // Handle: hapus [nama]
    async handleAdminHapusCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `🗑️ Format yang benar:\n` +
                    `*hapus [nama_agent]*\n\n` +
                    `💡 Contoh: hapus Ahmad`);
            }

            const name = parts.slice(1).join(' ');

            if (!name || name.trim().length < 2) {
                return this.sendReply(phoneNumber, '❌ Nama agent minimal 2 karakter!');
            }

            // Find agent by name
            const agent = await this.findAgentByName(name);
            if (!agent) {
                return this.sendReply(phoneNumber,
                    `❌ Agent "${name}" tidak ditemukan!\n\n` +
                    `💡 Gunakan nama lengkap agent yang sudah terdaftar.`);
            }

            // Prevent deleting admin
            if (agent.role === 'admin') {
                return this.sendReply(phoneNumber, '❌ Tidak dapat menghapus akun admin!');
            }

            // Delete agent
            const UserModel = require('../models/User');
            const result = await UserModel.delete(agent.id);

            if (result.changes === 0) {
                return this.sendReply(phoneNumber, '❌ Gagal menghapus agent.');
            }

            // Send notification to agent
            try {
                const deleteMessage =
                    `⚠️ *AKUN ANDA TELAH DINONAKTIFKAN*\n\n` +
                    `👤 Nama: ${agent.full_name}\n` +
                    `📱 Nomor: ${agent.phone}\n\n` +
                    `📝 Alasan: Dihapus oleh admin\n\n` +
                    `💡 Jika ada pertanyaan, silakan hubungi admin.`;

                await this.sendReply(agent.phone, deleteMessage);
            } catch (whatsappError) {
                console.error('Error sending delete notification:', whatsappError);
            }

            return this.sendReply(phoneNumber,
                `🗑️ *Agent Berhasil Dihapus!*\n\n` +
                `👤 Nama: ${agent.full_name}\n` +
                `📱 Nomor: ${agent.phone}\n\n` +
                `💡 Agent sudah menerima notifikasi penghapusan.`);

        } catch (error) {
            console.error('Error in handleAdminHapusCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat menghapus agent.');
        }
    }

    // Handle: status [nama]
    async handleAdminStatusCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `📊 Format yang benar:\n` +
                    `*status [nama_agent]*\n\n` +
                    `💡 Contoh: status Ahmad`);
            }

            const name = parts.slice(1).join(' ');

            if (!name || name.trim().length < 2) {
                return this.sendReply(phoneNumber, '❌ Nama agent minimal 2 karakter!');
            }

            // Find agent by name
            const agent = await this.findAgentByName(name);
            if (!agent) {
                return this.sendReply(phoneNumber,
                    `❌ Agent "${name}" tidak ditemukan!\n\n` +
                    `💡 Gunakan nama lengkap agent yang sudah terdaftar.`);
            }

            // Get agent statistics
            const database = require('../config/database');

            // Get transaction count and total amount
            const statsSql = `
                SELECT
                    COUNT(*) as total_orders,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount
                FROM transactions
                WHERE created_by = ? AND status = 'completed'
            `;

            const stats = await new Promise((resolve, reject) => {
                database.getDb().get(statsSql, [agent.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            const statusMessage =
                `📊 *STATUS AGENT*\n\n` +
                `👤 Nama: ${agent.full_name}\n` +
                `👤 Username: ${agent.username}\n` +
                `📱 Nomor: ${agent.phone}\n` +
                `💰 Saldo: Rp ${agent.balance?.toLocaleString('id-ID') || '0'}\n` +
                `📊 Status: ${agent.is_active ? 'Aktif' : 'Tidak Aktif'}\n` +
                `📅 Bergabung: ${new Date(agent.created_at).toLocaleDateString('id-ID')}\n` +
                `🕐 Login Terakhir: ${agent.last_login ? new Date(agent.last_login).toLocaleDateString('id-ID') : 'Belum pernah'}\n\n` +
                `📈 *Statistik Transaksi:*\n` +
                `• Total Order: ${stats.total_orders || 0}\n` +
                `• Total Pendapatan: Rp ${(stats.total_amount || 0).toLocaleString('id-ID')}\n` +
                `• Rata-rata Order: Rp ${(stats.avg_amount || 0).toLocaleString('id-ID')}`;

            return this.sendReply(phoneNumber, statusMessage);

        } catch (error) {
            console.error('Error in handleAdminStatusCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat mengambil status agent.');
        }
    }

    // Helper: Find agent by name (partial match)
    async findAgentByName(name) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT * FROM users
                WHERE role = 'agent'
                AND LOWER(full_name) LIKE LOWER(?)
                ORDER BY full_name
                LIMIT 1
            `;

            return new Promise((resolve, reject) => {
                database.getDb().get(sql, [`%${name}%`], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } catch (error) {
            console.error('Error finding agent by name:', error);
            return null;
        }
    }

    // Handle: laporan [nama]
    async handleAdminLaporanCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `📊 Format yang benar:\n` +
                    `*laporan [nama_agent]*\n\n` +
                    `💡 Contoh: laporan Ahmad`);
            }

            const name = parts.slice(1).join(' ');

            if (!name || name.trim().length < 2) {
                return this.sendReply(phoneNumber, '❌ Nama agent minimal 2 karakter!');
            }

            // Find agent by name
            const agent = await this.findAgentByName(name);
            if (!agent) {
                return this.sendReply(phoneNumber,
                    `❌ Agent "${name}" tidak ditemukan!\n\n` +
                    `💡 Gunakan nama lengkap agent yang sudah terdaftar.`);
            }

            // Get recent transactions
            const database = require('../config/database');
            const transactionsSql = `
                SELECT
                    id, customer_name, customer_phone, amount, status,
                    created_at
                FROM transactions
                WHERE created_by = ?
                ORDER BY created_at DESC
                LIMIT 10
            `;

            const transactions = await new Promise((resolve, reject) => {
                database.getDb().all(transactionsSql, [agent.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            let reportMessage =
                `📊 *LAPORAN AGENT*\n\n` +
                `👤 Nama: ${agent.full_name}\n` +
                `📱 Nomor: ${agent.phone}\n` +
                `💰 Saldo: Rp ${agent.balance?.toLocaleString('id-ID') || '0'}\n\n`;

            if (transactions.length === 0) {
                reportMessage += `📝 Belum ada transaksi.`;
            } else {
                reportMessage += `📋 *Transaksi Terakhir (10 terbaru):*\n\n`;

                transactions.forEach((transaction, index) => {
                    const date = new Date(transaction.created_at).toLocaleDateString('id-ID');
                    const time = new Date(transaction.created_at).toLocaleTimeString('id-ID');
                    const statusEmoji = transaction.status === 'completed' ? '✅' : '⏳';

                    reportMessage += `${index + 1}. ${statusEmoji} ${date} ${time}\n`;
                    reportMessage += `   👤 ${transaction.customer_name || 'N/A'}\n`;
                    reportMessage += `   💵 Rp ${transaction.amount?.toLocaleString('id-ID') || '0'}\n`;
                    reportMessage += `   📱 ${transaction.customer_phone || '-'}\n\n`;
                });
            }

            return this.sendReply(phoneNumber, reportMessage);

        } catch (error) {
            console.error('Error in handleAdminLaporanCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat mengambil laporan.');
        }
    }

    // Handle: edit [nama] (placeholder for now)
    async handleAdminEditCommand(phoneNumber, message) {
        return this.sendReply(phoneNumber,
            `✏️ *FITUR EDIT AGENT*\n\n` +
            `👤 Agent: ${message.replace(/^edit\s+/i, '')}\n\n` +
            `💡 Fitur edit agent akan segera hadir!\n` +
            `📝 Untuk saat ini, gunakan dashboard admin untuk edit agent.`);
    }

    // Handle: list (show all agents)
    async handleAdminListAgents(phoneNumber) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT id, username, full_name, phone, balance, is_active, created_at
                FROM users WHERE role = 'agent'
                ORDER BY created_at DESC LIMIT 20
            `;

            const agents = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            if (agents.length === 0) {
                return this.sendReply(phoneNumber, '📝 Belum ada agent terdaftar.');
            }

            let message = `👥 *DAFTAR SEMUA AGENT*\n\n`;
            agents.forEach((agent, index) => {
                const status = agent.is_active ? '✅ Aktif' : '❌ Tidak Aktif';
                message += `${index + 1}. ${agent.full_name}\n`;
                message += `   📱 ${agent.phone}\n`;
                message += `   💰 Rp ${agent.balance?.toLocaleString('id-ID') || '0'}\n`;
                message += `   ${status}\n\n`;
            });

            return this.sendReply(phoneNumber, message);

        } catch (error) {
            console.error('Error in handleAdminListAgents:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat mengambil daftar agent.');
        }
    }

    // Handle: pending (show pending registrations)
    async handleAdminPendingRegistrations(phoneNumber) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT id, full_name, phone_number, created_at
                FROM agent_registrations
                WHERE status = 'pending'
                ORDER BY created_at DESC LIMIT 10
            `;

            const registrations = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            if (registrations.length === 0) {
                return this.sendReply(phoneNumber, '📝 Tidak ada pendaftaran pending.');
            }

            let message = `📋 *PENDAFTARAN PENDING*\n\n`;
            registrations.forEach((reg, index) => {
                const date = new Date(reg.created_at).toLocaleDateString('id-ID');
                message += `${index + 1}. ${reg.full_name}\n`;
                message += `   📱 ${reg.phone_number}\n`;
                message += `   ⏰ ${date}\n\n`;
            });

            return this.sendReply(phoneNumber, message);

        } catch (error) {
            console.error('Error in handleAdminPendingRegistrations:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat mengambil pendaftaran pending.');
        }
    }

    // Handle admin commands via WhatsApp
    async handleAdminCommands(phoneNumber, admin, message) {
        try {
            console.log(`👑 Admin command from ${phoneNumber}: ${message}`);
            const lowerMessage = message.toLowerCase();

            if (lowerMessage === 'admin_help' || lowerMessage === 'admin_bantuan') {
                return this.sendReply(phoneNumber,
                    `👑 *ADMIN COMMANDS*\n\n` +
                    `📝 *Perintah Agent:*\n` +
                    `• admin_lihat_agent - Lihat semua agent\n` +
                    `• admin_setujui [id] - Setujui pendaftaran\n` +
                    `• admin_tolak [id] - Tolak pendaftaran\n` +
                    `• admin_hapus [id] - Hapus agent\n` +
                    `• admin_topup [id] [jumlah] - Top up saldo\n\n` +
                    `🎫 *Perintah Voucher:*\n` +
                    `• admin_voucher [profile] [jumlah] [customer] [phone] - Buat voucher\n` +
                    `• admin_beli [profile] [jumlah] [customer] [phone] - Buat voucher\n\n` +
                    `📊 *Perintah Laporan:*\n` +
                    `• admin_laporan - Laporan lengkap\n` +
                    `• admin_registrasi - Lihat pendaftaran pending\n\n` +
                    `💡 Contoh:\n` +
                    `• admin_setujui 1\n` +
                    `• admin_topup 5 50000\n` +
                    `• admin_voucher paket1jam 5 Customer 081234567890\n` +
                    `• admin_hapus 3`);

            } else if (lowerMessage === 'admin_lihat_agent' || lowerMessage === 'admin_agents') {
                return await this.adminGetAgents(phoneNumber);

            } else if (lowerMessage === 'admin_registrasi' || lowerMessage === 'admin_pending') {
                return await this.adminGetPendingRegistrations(phoneNumber);

            } else if (lowerMessage === 'admin_laporan') {
                return await this.adminGetSystemReport(phoneNumber);

            } else if (lowerMessage.startsWith('admin_setujui')) {
                const parts = message.split(/\s+/);
                if (parts.length < 2) {
                    return this.sendReply(phoneNumber, '❌ Format: admin_setujui [id_registrasi]');
                }
                const regId = parseInt(parts[1]);
                return await this.adminApproveRegistration(phoneNumber, regId);

            } else if (lowerMessage.startsWith('admin_tolak')) {
                const parts = message.split(/\s+/);
                if (parts.length < 2) {
                    return this.sendReply(phoneNumber, '❌ Format: admin_tolak [id_registrasi]');
                }
                const regId = parseInt(parts[1]);
                return await this.adminRejectRegistration(phoneNumber, regId);

            } else if (lowerMessage.startsWith('admin_hapus')) {
                const parts = message.split(/\s+/);
                if (parts.length < 2) {
                    return this.sendReply(phoneNumber, '❌ Format: admin_hapus [id_agent]');
                }
                const agentId = parseInt(parts[1]);
                return await this.adminDeleteAgent(phoneNumber, agentId);

            } else if (lowerMessage.startsWith('admin_topup')) {
                const parts = message.split(/\s+/);
                if (parts.length < 3) {
                    return this.sendReply(phoneNumber, '❌ Format: admin_topup [id_agent] [jumlah]');
                }
                const agentId = parseInt(parts[1]);
                const amount = parseInt(parts[2]);
                return await this.adminTopupAgent(phoneNumber, agentId, amount);

            } else if (lowerMessage.startsWith('admin_voucher') || lowerMessage.startsWith('admin_beli')) {
                const parts = message.split(/\s+/);
                if (parts.length < 3) {
                    return this.sendReply(phoneNumber, '❌ Format: admin_voucher [profile] [jumlah] [customer_name] [customer_phone]');
                }
                const profile = parts[1];
                const quantity = parseInt(parts[2]);
                const customerName = parts[3] || 'Admin Customer';
                const customerPhone = parts[4] || '';
                return await this.adminCreateVoucher(phoneNumber, profile, quantity, customerName, customerPhone);

            } else {
                // Check if this might be an auto-response or non-command message
                const autoResponsePatterns = [
                    /ok/i,
                    /terima kasih/i,
                    /thanks/i,
                    /oke/i,
                    /baik/i,
                    /siap/i,
                    /ya/i,
                    /tidak/i,
                    /no/i,
                    /yes/i,
                    /sudah/i,
                    /belum/i,
                    /mantap/i,
                    /bagus/i,
                    /keren/i,
                    /👍/,
                    /👌/,
                    /😊/,
                    /😀/,
                    /🙏/
                ];
                
                let isAutoResponse = false;
                for (const pattern of autoResponsePatterns) {
                    if (pattern.test(message)) {
                        isAutoResponse = true;
                        break;
                    }
                }
                
                if (isAutoResponse) {
                    console.log(`🚫 Ignoring auto-response message from admin ${phoneNumber}: ${message.substring(0, 50)}...`);
                    return; // Don't send any reply for auto-responses
                }
                
                // For any other unrecognized admin commands, ignore silently
                console.log(`🚫 Ignoring unrecognized admin command from ${phoneNumber}: ${message.substring(0, 50)}...`);
                return; // Don't send any reply for unrecognized admin commands
            }

        } catch (error) {
            console.error('❌ Error handling admin command:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat memproses perintah admin.');
        }
    }

    // Admin: Get all agents
    async adminGetAgents(phoneNumber) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT id, username, full_name, phone, balance, is_active, created_at
                FROM users WHERE role = 'agent'
                ORDER BY created_at DESC LIMIT 20
            `;

            const agents = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            if (agents.length === 0) {
                return this.sendReply(phoneNumber, '📝 Tidak ada agent terdaftar.');
            }

            let message = `👥 *DAFTAR AGENT*\n\n`;
            agents.forEach(agent => {
                message += `🆔 ${agent.id}\n`;
                message += `👤 ${agent.full_name}\n`;
                message += `📱 ${agent.phone}\n`;
                message += `💰 Rp ${agent.balance?.toLocaleString() || '0'}\n`;
                message += `📊 ${agent.is_active ? 'Aktif' : 'Tidak Aktif'}\n\n`;
            });

            return this.sendReply(phoneNumber, message);

        } catch (error) {
            console.error('Error getting agents for admin:', error);
            return this.sendReply(phoneNumber, '❌ Gagal mengambil daftar agent.');
        }
    }

    // Admin: Get pending registrations
    async adminGetPendingRegistrations(phoneNumber) {
        try {
            const database = require('../config/database');
            const sql = `
                SELECT id, full_name, phone_number, created_at
                FROM agent_registrations
                WHERE status = 'pending'
                ORDER BY created_at DESC LIMIT 10
            `;

            const registrations = await new Promise((resolve, reject) => {
                database.getDb().all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            if (registrations.length === 0) {
                return this.sendReply(phoneNumber, '📝 Tidak ada pendaftaran pending.');
            }

            let message = `📋 *PENDAFTARAN PENDING*\n\n`;
            registrations.forEach(reg => {
                message += `🆔 ${reg.id}\n`;
                message += `👤 ${reg.full_name}\n`;
                message += `📱 ${reg.phone_number}\n`;
                message += `⏰ ${new Date(reg.created_at).toLocaleDateString('id-ID')}\n\n`;
            });

            return this.sendReply(phoneNumber, message);

        } catch (error) {
            console.error('Error getting pending registrations:', error);
            return this.sendReply(phoneNumber, '❌ Gagal mengambil pendaftaran pending.');
        }
    }

    // Admin: Approve registration
    async adminApproveRegistration(phoneNumber, registrationId) {
        try {
            const AgentManagementController = require('../controllers/AgentManagementController');

            // Simulate request/response for controller
            const mockReq = {
                params: { id: registrationId },
                user: { id: 1, role: 'admin' } // Admin user
            };
            const mockRes = {
                status: (code) => ({ json: (data) => data }),
                json: (data) => data
            };

            const result = await AgentManagementController.approveRegistration(mockReq, mockRes);

            if (result.success) {
                return this.sendReply(phoneNumber, `✅ Pendaftaran ID ${registrationId} berhasil disetujui!`);
            } else {
                return this.sendReply(phoneNumber, `❌ Gagal menyetujui: ${result.message}`);
            }

        } catch (error) {
            console.error('Error approving registration:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat menyetujui pendaftaran.');
        }
    }

    // Admin: Reject registration
    async adminRejectRegistration(phoneNumber, registrationId) {
        try {
            const reason = 'Ditolak via WhatsApp admin';
            const AgentManagementController = require('../controllers/AgentManagementController');

            const mockReq = {
                params: { id: registrationId },
                body: { reason },
                user: { id: 1, role: 'admin' }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => data }),
                json: (data) => data
            };

            const result = await AgentManagementController.rejectRegistration(mockReq, mockRes);

            if (result.success) {
                return this.sendReply(phoneNumber, `❌ Pendaftaran ID ${registrationId} berhasil ditolak!`);
            } else {
                return this.sendReply(phoneNumber, `❌ Gagal menolak: ${result.message}`);
            }

        } catch (error) {
            console.error('Error rejecting registration:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat menolak pendaftaran.');
        }
    }

    // Admin: Delete agent
    async adminDeleteAgent(phoneNumber, agentId) {
        try {
            const AgentManagementController = require('../controllers/AgentManagementController');

            const mockReq = {
                params: { id: agentId },
                user: { id: 1, role: 'admin' }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => data }),
                json: (data) => data
            };

            const result = await AgentManagementController.deleteAgent(mockReq, mockRes);

            if (result.success) {
                return this.sendReply(phoneNumber, `🗑️ Agent ID ${agentId} berhasil dihapus!`);
            } else {
                return this.sendReply(phoneNumber, `❌ Gagal menghapus: ${result.message}`);
            }

        } catch (error) {
            console.error('Error deleting agent:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat menghapus agent.');
        }
    }

    // Admin: Top up agent balance
    async adminTopupAgent(phoneNumber, agentId, amount) {
        try {
            const AgentManagementController = require('../controllers/AgentManagementController');

            const mockReq = {
                body: {
                    agent_id: agentId,
                    amount: amount,
                    notes: 'Top up via WhatsApp admin'
                },
                user: { id: 1, role: 'admin' }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => data }),
                json: (data) => data
            };

            const result = await AgentManagementController.depositAgent(mockReq, mockRes);

            if (result.success) {
                return this.sendReply(phoneNumber, `💰 Top up agent ID ${agentId} sebesar Rp ${amount.toLocaleString()} berhasil!`);
            } else {
                return this.sendReply(phoneNumber, `❌ Gagal top up: ${result.message}`);
            }

        } catch (error) {
            console.error('Error topping up agent:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat top up agent.');
        }
    }

    // Admin: Create voucher directly (without balance check)
    async adminCreateVoucher(phoneNumber, profileName, quantity, customerName, customerPhone) {
        try {
            console.log(`👑 Admin creating voucher: ${profileName} x${quantity} for ${customerName}`);

            // Get voucher profile
            const profile = await this.getVoucherProfile(profileName);
            if (!profile) {
                return this.sendReply(phoneNumber,
                    `❌ Profile voucher "${profileName}" tidak ditemukan.\n\n` +
                    `💡 Profile yang tersedia:\n` +
                    `• paket1jam, paket2jam, paket3jam\n` +
                    `• paket1hari, paket2hari, paket3hari\n` +
                    `• paket1minggu, paket2minggu\n` +
                    `• paket1bulan, paket2bulan\n\n` +
                    `🔍 Contoh: admin_voucher paket1jam 5 Customer 081234567890`);
            }

            // Create vouchers
            const vouchers = await this.createVouchers(profile, quantity, null); // null = admin created
            if (!vouchers || vouchers.length === 0) {
                return this.sendReply(phoneNumber, '❌ Gagal membuat voucher. Silakan coba lagi.');
            }

            // Create users in Mikrotik
            try {
                const MikrotikAPI = require('../config/mikrotik');
                const mikrotik = new MikrotikAPI();
                
                console.log('🔄 Connecting to Mikrotik for admin voucher creation...');
                await mikrotik.connect();
                
                for (const voucher of vouchers) {
                    try {
                        await mikrotik.createHotspotUser(
                            voucher.username,
                            voucher.password,
                            profile.mikrotik_profile_name || profile.name || 'default',
                            profile.duration
                        );
                        console.log(`✅ Mikrotik user created: ${voucher.username}`);
                    } catch (mikrotikError) {
                        console.error(`❌ Error creating Mikrotik user ${voucher.username}:`, mikrotikError);
                        // Continue with other vouchers even if one fails
                    }
                }
                
                await mikrotik.disconnect();
                console.log('✅ Mikrotik connection closed');
            } catch (mikrotikError) {
                console.error('❌ Error connecting to Mikrotik:', mikrotikError);
                // Don't fail the whole process if Mikrotik fails
            }

            // Create transaction record (admin voucher creation - no cost)
            await this.createTransaction(null, vouchers, customerName, customerPhone, 0);

            // Send voucher to customer if phone provided
            if (customerPhone && customerPhone.trim()) {
                try {
                    const voucherMessage = this.formatVoucherMessage(vouchers, profile, customerName, 'Admin');
                    await this.sendReply(customerPhone, voucherMessage);
                    console.log(`✅ Voucher sent to customer ${customerPhone}`);
                } catch (whatsappError) {
                    console.error('❌ Error sending voucher to customer:', whatsappError);
                }
            }

            // Send confirmation to admin
            const voucherCodes = vouchers.map(v => v.username).join('\n');
            const formattedDuration = this.formatDuration(profile.duration);
            const reply = `✅ *VOUCHER ADMIN BERHASIL DIBUAT!*\n\n` +
                         `📦 Profile: ${profile.name}\n` +
                         `🔢 Jumlah: ${quantity}\n` +
                         `👤 Customer: ${customerName}\n` +
                         `📱 Nomor: ${customerPhone || 'Tidak ada'}\n\n` +
                         `🔐 *Kode Voucher:*\n${voucherCodes}\n\n` +
                         `💰 Harga: GRATIS (Admin)\n` +
                         `📅 Durasi: ${formattedDuration}\n\n` +
                         `⏰ Dibuat: ${new Date().toLocaleString('id-ID', {
                             timeZone: 'Asia/Jakarta',
                             year: 'numeric',
                             month: '2-digit',
                             day: '2-digit',
                             hour: '2-digit',
                             minute: '2-digit',
                             second: '2-digit'
                         })}\n\n` +
                         `${customerPhone ? '📱 Voucher sudah dikirim ke customer' : '⚠️ Nomor customer tidak ada, voucher tidak dikirim'}`;

            return this.sendReply(phoneNumber, reply);

        } catch (error) {
            console.error('Error in adminCreateVoucher:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat membuat voucher.');
        }
    }

    // Admin: Get system report
    async adminGetSystemReport(phoneNumber) {
        try {
            const database = require('../config/database');

            // Get agent stats
            const agentStats = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT
                        COUNT(*) as total_agents,
                        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_agents,
                        SUM(balance) as total_balance
                    FROM users WHERE role = 'agent'
                `;
                database.getDb().get(sql, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get pending registrations
            const pendingCount = await new Promise((resolve, reject) => {
                const sql = `SELECT COUNT(*) as count FROM agent_registrations WHERE status = 'pending'`;
                database.getDb().get(sql, [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count || 0);
                });
            });

            const message =
                `📊 *LAPORAN SISTEM*\n\n` +
                `👥 *Agent:*\n` +
                `• Total: ${agentStats.total_agents || 0}\n` +
                `• Aktif: ${agentStats.active_agents || 0}\n` +
                `• Total Saldo: Rp ${(agentStats.total_balance || 0).toLocaleString()}\n\n` +
                `📋 *Pendaftaran:*\n` +
                `• Pending: ${pendingCount}\n\n` +
                `💡 Kirim "admin_help" untuk perintah lainnya.`;

            return this.sendReply(phoneNumber, message);

        } catch (error) {
            console.error('Error getting system report:', error);
            return this.sendReply(phoneNumber, '❌ Gagal mengambil laporan sistem.');
        }
    }

    // Find agent by phone number
    async findAgentByPhone(phoneNumber) {
        try {
            // Remove +62 prefix if present and add 62 if not
            let normalizedPhone = phoneNumber.replace(/^\+/, '');
            if (!normalizedPhone.startsWith('62')) {
                normalizedPhone = '62' + normalizedPhone;
            }

            // Query database for agent with this phone number
            const sql = `SELECT * FROM users WHERE phone = ? AND role = 'agent' AND is_active = 1`;
            
            return new Promise((resolve, reject) => {
                const database = require('../config/database');
                database.getDb().get(sql, [normalizedPhone], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error finding agent by phone:', error);
            return null;
        }
    }

    // Generate OTP for agent
    async generateOTP(agentPhone) {
        try {
            // Get OTP settings
            const settings = await this.getOTPSettings();
            
            if (!settings.enabled) {
                return { success: false, message: 'OTP tidak diaktifkan' };
            }

            // Generate random OTP
            const otpLength = settings.length || 6;
            const otp = Math.random().toString().slice(2, 2 + otpLength);
            
            // Calculate expiry time
            const expirySeconds = settings.expiry || 600;
            const expiresAt = new Date(Date.now() + (expirySeconds * 1000));

            // Save OTP to database
            const sql = `
                INSERT INTO otp_codes (agent_phone, otp_code, expires_at) 
                VALUES (?, ?, ?)
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [agentPhone, otp, expiresAt.toISOString()], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Send OTP to agent
            const otpMessage = 
                `🔐 *KODE OTP ANDA*\n\n` +
                `🔢 Kode: *${otp}*\n` +
                `⏰ Berlaku: ${Math.round(expirySeconds / 60)} menit\n\n` +
                `💡 *Cara Pakai:*\n` +
                `Ketik: otp ${otp} beli [profile] [jumlah]\n` +
                `Contoh: otp ${otp} beli paket1jam 5\n\n` +
                `⚠️ *Penting:* Jangan bagikan kode ini!`;

            await this.sendReply(agentPhone, otpMessage);
            
            return { 
                success: true, 
                otp: otp,
                expiresAt: expiresAt,
                message: 'OTP berhasil dikirim'
            };

        } catch (error) {
            console.error('Error generating OTP:', error);
            return { success: false, message: 'Gagal generate OTP' };
        }
    }

    // Validate OTP
    async validateOTP(agentPhone, inputOTP) {
        try {
            const sql = `
                SELECT * FROM otp_codes 
                WHERE agent_phone = ? AND otp_code = ? AND used = 0 AND expires_at > datetime('now')
                ORDER BY created_at DESC LIMIT 1
            `;

            const otpRecord = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [agentPhone, inputOTP], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (otpRecord) {
                // Mark OTP as used
                const updateSql = `
                    UPDATE otp_codes 
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
                return { success: false, message: 'OTP tidak valid atau sudah kadaluarsa' };
            }

        } catch (error) {
            console.error('Error validating OTP:', error);
            return { success: false, message: 'Error validasi OTP' };
        }
    }

    // Get OTP settings
    async getOTPSettings() {
        try {
            const sql = `SELECT * FROM otp_settings WHERE id = 1`;
            
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
            console.error('Error getting OTP settings:', error);
            return { enabled: false, length: 6, expiry: 600 };
        }
    }

    // Parse order message from WhatsApp (with OTP support)
    parseOrderMessage(message) {
        const trimmedMessage = message.trim().toLowerCase();

        // Patterns yang didukung:
        // 1. OTP format: "otp [code] beli [profile] [quantity] [customer_phone]"
        // 2. OTP format: "otp [code] beli [profile] [quantity]"
        // 3. Regular: "beli [profile] [quantity] [customer_phone]" - dengan nomor customer
        // 4. Regular: "beli [profile] [quantity]" - tanpa nomor customer
        // 5. Old format: "beli [profile] [quantity] [name] [phone]"

        const patterns = [
            // OTP format dengan nomor: otp [code] beli [profile] [quantity] [phone]
            /^otp\s+(\d+)\s+beli\s+(\w+)\s+(\d+)\s+(628\d{9,12})$/i,
            // OTP format tanpa nomor: otp [code] beli [profile] [quantity]
            /^otp\s+(\d+)\s+beli\s+(\w+)\s+(\d+)$/i,
            // OTP old format: otp [code] beli [profile] [quantity] [name] [phone]
            /^otp\s+(\d+)\s+beli\s+(\w+)\s+(\d+)\s+(.+?)\s+(628\d{9,12})$/i,
            // Format dengan nomor: beli [profile] [quantity] [phone]
            /^beli\s+(\w+)\s+(\d+)\s+(628\d{9,12})$/i,
            // Format tanpa nomor: beli [profile] [quantity]
            /^beli\s+(\w+)\s+(\d+)$/i,
            // Old format: beli [profile] [quantity] [name] [phone]
            /^beli\s+(\w+)\s+(\d+)\s+(.+?)\s+(628\d{9,12})$/i,
            // Alternative commands
            /^order\s+(\w+)\s+(\d+)\s+(628\d{9,12})$/i,
            /^voucher\s+(\w+)\s+(\d+)\s+(628\d{9,12})$/i
        ];

        for (const pattern of patterns) {
            const match = trimmedMessage.match(pattern);
            if (match) {
                // Check if this is OTP format
                const isOTPFormat = trimmedMessage.startsWith('otp ');
                
                if (isOTPFormat) {
                    // OTP format patterns
                    if (match.length === 5 && match[4] && match[4].startsWith('628')) {
                        // OTP format dengan nomor: otp [code] beli [profile] [quantity] [phone]
                        return {
                            otp: match[1],
                            profile: match[2],
                            quantity: parseInt(match[3]),
                            customerName: `Customer ${match[4]}`,
                            customerPhone: match[4],
                            sendToCustomer: true,
                            isValid: true,
                            requiresOTP: true
                        };
                    } else if (match.length === 4) {
                        // OTP format tanpa nomor: otp [code] beli [profile] [quantity]
                        return {
                            otp: match[1],
                            profile: match[2],
                            quantity: parseInt(match[3]),
                            customerName: `Customer ${Date.now()}`,
                            customerPhone: null,
                            sendToCustomer: false,
                            isValid: true,
                            requiresOTP: true
                        };
                    } else if (match.length === 6) {
                        // OTP old format: otp [code] beli [profile] [quantity] [name] [phone]
                        return {
                            otp: match[1],
                            profile: match[2],
                            quantity: parseInt(match[3]),
                            customerName: match[4].trim(),
                            customerPhone: match[5],
                            sendToCustomer: true,
                            isValid: true,
                            requiresOTP: true
                        };
                    }
                } else {
                    // Regular format patterns (non-OTP)
                if (match.length === 4 && match[3] && match[3].startsWith('628')) {
                    // Format dengan nomor: beli [profile] [quantity] [phone]
                    return {
                        profile: match[1],
                        quantity: parseInt(match[2]),
                            customerName: `Customer ${match[3]}`,
                        customerPhone: match[3],
                            sendToCustomer: true,
                            isValid: true,
                            requiresOTP: false
                    };
                } else if (match.length === 3) {
                    // Format tanpa nomor: beli [profile] [quantity]
                    return {
                        profile: match[1],
                        quantity: parseInt(match[2]),
                            customerName: `Customer ${Date.now()}`,
                            customerPhone: null,
                            sendToCustomer: false,
                            isValid: true,
                            requiresOTP: false
                    };
                } else if (match.length === 5) {
                    // Old format: beli [profile] [quantity] [name] [phone]
                    return {
                        profile: match[1],
                        quantity: parseInt(match[2]),
                        customerName: match[3].trim(),
                        customerPhone: match[4],
                            sendToCustomer: true,
                            isValid: true,
                            requiresOTP: false
                    };
                    }
                }
            }
        }

        return null;
    }

    // Process the order
    async processOrder(agent, order, agentPhone) {
        try {
            console.log(`🛒 Processing order:`, order);

            // Get voucher profile
            const profile = await this.getVoucherProfile(order.profile);
            if (!profile) {
                return this.sendReply(agentPhone,
                    `❌ Profile voucher "${order.profile}" tidak ditemukan.`);
            }

            // Calculate total cost - Always charge for voucher creation
            const actualCost = profile.agent_price * order.quantity;

            // Check balance - Always required for voucher creation
            if (agent.balance < actualCost) {
                return this.sendReply(agentPhone,
                    `❌ Saldo tidak cukup. Saldo: ${agent.balance}, Total: ${actualCost}`);
            }

            // Create vouchers
            const vouchers = await this.createVouchers(profile, order.quantity, agent.id);
            if (!vouchers || vouchers.length === 0) {
                return this.sendReply(agentPhone, '❌ Gagal membuat voucher. Silakan coba lagi.');
            }

            // Create transaction record with actual cost (0 for free orders)
            await this.createTransaction(agent.id, vouchers, order.customerName, order.customerPhone, actualCost);

            // Always deduct balance for voucher creation
            await this.deductAgentBalance(agent.id, actualCost);
            const finalBalance = agent.balance - actualCost;

            // Send confirmation message
            const voucherCodes = vouchers.map(v => v.username).join('\n');

            let reply = `✅ Order berhasil diproses!\n\n` +
                       `📦 Profile: ${profile.name}\n` +
                       `🔢 Jumlah: ${order.quantity}\n` +
                       `👤 Customer: ${order.customerName}\n`;

            if (order.sendToCustomer) {
                reply += `📱 Phone: ${order.customerPhone}\n` +
                        `💰 Total: Rp ${actualCost.toLocaleString('id-ID')}\n` +
                        `💳 Saldo tersisa: Rp ${finalBalance.toLocaleString('id-ID')}\n\n`;

                // Send voucher to customer
                const customerReply = `🔑 *Voucher Internet Anda*\n\n` +
                                    `👤 Nama: ${order.customerName}\n` +
                                    `📦 Paket: ${profile.name}\n` +
                                    `⏰ Durasi: ${profile.duration}\n` +
                                    `🔑 Kode Voucher: ${voucherCodes}\n\n` +
                                    `📋 Cara menggunakan:\n` +
                                    `1. Connect ke WiFi hotspot\n` +
                                    `2. Login dengan kode voucher di atas sebagai username dan password\n` +
                                    `3. Nikmati internet! 🚀\n\n` +
                                    `_Voucher dari: ${agent.full_name}_`;

                try {
                    await this.sendReply(order.customerPhone, customerReply);
                    reply += `✅ Voucher telah dikirim ke customer\n\n`;
                } catch (customerError) {
                    console.error('Error sending to customer:', customerError);
                    reply += `⚠️ Gagal kirim ke customer (cek nomor)\n\n`;
                }
            } else {
                reply += `📱 Phone: - (Tidak ada nomor customer)\n` +
                        `💰 Total: Rp ${actualCost.toLocaleString('id-ID')}\n` +
                        `💳 Saldo tersisa: Rp ${finalBalance.toLocaleString('id-ID')}\n\n` +
                        `ℹ️ Voucher TIDAK dikirim ke customer (tidak ada nomor)\n\n`;
            }

            reply += `🔑 Kode Voucher:\n${voucherCodes}`;

            return this.sendReply(agentPhone, reply);

        } catch (error) {
            console.error('❌ Error processing order:', error);
            return this.sendReply(agentPhone, '❌ Terjadi kesalahan saat memproses order. Silakan coba lagi.');
        }
    }

    // Get voucher profile by name or price
    async getVoucherProfile(profileInput) {
        try {
            const database = require('../config/database');
            let sql, params;

            // Check if input is numeric (price-based search)
            if (!isNaN(profileInput) && !isNaN(parseFloat(profileInput))) {
                // Search by selling price
                sql = `SELECT * FROM voucher_profiles WHERE selling_price = ? AND is_active = 1`;
                params = [parseFloat(profileInput)];
            } else {
                // Search by name (backward compatibility)
                sql = `SELECT * FROM voucher_profiles WHERE name = ? AND is_active = 1`;
                params = [profileInput];
            }

            return new Promise((resolve, reject) => {
                database.getDb().get(sql, params, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error getting voucher profile:', error);
            return null;
        }
    }

    // Create vouchers
    async createVouchers(profile, quantity, agentId) {
        try {
            const vouchers = [];
            
            for (let i = 0; i < quantity; i++) {
                const voucher = await this.createSingleVoucher(profile, agentId);
                if (voucher) {
                    vouchers.push(voucher);
                }
            }
            
            return vouchers;
        } catch (error) {
            console.error('❌ Error creating vouchers:', error);
            return [];
        }
    }

    // Generate voucher code (numeric with desired length)
    generateVoucherCode(length = 4) {
        // Generate numeric code with specified length
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;
        const code = Math.floor(min + Math.random() * (max - min + 1));
        return code.toString();
    }

    // Format duration for display
    formatDuration(duration) {
        if (!duration) return 'Tidak ditentukan';
        
        const durationStr = duration.toString().toLowerCase();
        
        if (durationStr.includes('h')) {
            const hours = parseInt(durationStr.replace('h', ''));
            return `${hours} jam`;
        } else if (durationStr.includes('d')) {
            const days = parseInt(durationStr.replace('d', ''));
            return `${days} hari`;
        } else if (durationStr.includes('w')) {
            const weeks = parseInt(durationStr.replace('w', ''));
            return `${weeks} minggu`;
        } else if (durationStr.includes('m')) {
            const months = parseInt(durationStr.replace('m', ''));
            return `${months} bulan`;
        } else {
            return duration;
        }
    }

    // Format voucher message for customer
    formatVoucherMessage(vouchers, profile, customerName, createdBy) {
        const voucherCodes = vouchers.map(v => v.username).join('\n');
        const formattedDuration = this.formatDuration(profile.duration);
        const currentTime = new Date().toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        return `🎫 *VOUCHER WIFI BERHASIL DIBUAT!*\n\n` +
               `👤 Customer: ${customerName}\n` +
               `📦 Profile: ${profile.name}\n` +
               `📅 Durasi: ${formattedDuration}\n` +
               `💰 Harga: GRATIS (${createdBy})\n\n` +
               `🔐 *Kode Voucher:*\n${voucherCodes}\n\n` +
               `⏰ Dibuat: ${currentTime}\n\n` +
               `📱 Gunakan kode di atas untuk login WiFi hotspot!`;
    }

    // Create single voucher
    async createSingleVoucher(profile, agentId) {
        try {
            // Generate username with length from profile (default 4)
            const codeLength = Math.max(3, Math.min(12, parseInt(profile.voucher_code_length || 4)));
            const username = this.generateVoucherCode(codeLength);
            // Password sama dengan username for Mikrotik compatibility
            const password = username;

            const sql = `INSERT INTO vouchers (username, password, profile, agent_price, duration, created_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

            return new Promise((resolve, reject) => {
                const database = require('../config/database');
                database.getDb().run(sql, [username, password, profile.name, profile.agent_price, profile.duration], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            username,
                            password,
                            profile: profile.name,
                            agent_price: profile.agent_price,
                            duration: profile.duration
                        });
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error creating single voucher:', error);
            return null;
        }
    }

    // Deduct balance from agent
    async deductAgentBalance(agentId, amount) {
        try {
            const sql = `UPDATE users SET balance = balance - ? WHERE id = ? AND role = 'agent'`;
            
            return new Promise((resolve, reject) => {
                const database = require('../config/database');
                database.getDb().run(sql, [amount, agentId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error deducting agent balance:', error);
            throw error;
        }
    }

    // Create transaction record
    async createTransaction(agentId, vouchers, customerName, customerPhone, amount) {
        try {
            // First check if created_by column exists, if not use fallback
            const database = require('../config/database');
            const db = database.getDb();

            // Try with created_by column
            let sql = `INSERT INTO transactions (customer_name, customer_phone, amount, payment_method, status, created_by, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

            return new Promise((resolve, reject) => {
                db.run(sql, [customerName, customerPhone, amount, 'whatsapp', 'completed', agentId], function(err) {
                    if (err) {
                        // If created_by column doesn't exist, try without it
                        if (err.message.includes('no column named created_by')) {
                            console.log('⚠️  created_by column not found, using fallback query');
                            const fallbackSql = `INSERT INTO transactions (customer_name, customer_phone, amount, payment_method, status, created_at)
                                               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

                            db.run(fallbackSql, [customerName, customerPhone, amount, 'whatsapp', 'completed'], function(fallbackErr) {
                                if (fallbackErr) {
                                    reject(fallbackErr);
                                } else {
                                    resolve(this.lastID);
                                }
                            });
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        } catch (error) {
            console.error('❌ Error creating transaction:', error);
            throw error;
        }
    }

    // Send reply using Baileys
    async sendReply(phoneNumber, message) {
        try {
            // Check if WhatsApp is connected, if not try to initialize it
            if (!this.sock || !this.isConnected) {
                console.error('❌ WhatsApp not connected - Cannot send message to:', phoneNumber);
                console.log('🔄 Attempting to reconnect WhatsApp gateway...');
                
                try {
                    // Try to reinitialize the connection
                    await this.initialize();
                    
                    // Wait a bit for connection to establish
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    if (!this.isConnected) {
                        console.error('❌ WhatsApp still not connected after reinitialization attempt');
                        return false;
                    }
                } catch (reconnectError) {
                    console.error('❌ Error reconnecting WhatsApp gateway:', reconnectError);
                    return false;
                }
            }

            const jid = phoneNumber.includes('@s.whatsapp.net') ? 
                       phoneNumber : `${phoneNumber}@s.whatsapp.net`;

            // Track this message to prevent self-response
            const messageHash = `${phoneNumber}:${message.substring(0, 100)}`;
            this.sentMessages.add(messageHash);
            
            // Clean up old tracked messages (keep only last 100)
            if (this.sentMessages.size > 100) {
                const messages = Array.from(this.sentMessages);
                this.sentMessages.clear();
                messages.slice(-50).forEach(msg => this.sentMessages.add(msg));
            }

            await this.sock.sendMessage(jid, { text: message });
            
            console.log(`📤 WhatsApp Reply sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
            console.log(`🔍 Message tracked: ${messageHash}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error sending WhatsApp reply to', phoneNumber, ':', error.message);
            console.error('Error stack:', error.stack);
            
            // Try to send with simplified phone number format
            if (phoneNumber.includes('@s.whatsapp.net')) {
                const simplifiedPhone = phoneNumber.replace('@s.whatsapp.net', '');
                console.log('🔄 Retrying with simplified phone number:', simplifiedPhone);
                try {
                    // Try once more with simplified format
                    const jid = `${simplifiedPhone}@s.whatsapp.net`;
                    await this.sock.sendMessage(jid, { text: message });
                    console.log(`📤 WhatsApp Reply sent to ${simplifiedPhone} (retry): ${message.substring(0, 50)}...`);
                    return true;
                } catch (retryError) {
                    console.error('❌ Retry failed for', simplifiedPhone, ':', retryError.message);
                }
            }
            
            return false;
        }
    }

    // Get help message
    getHelpMessage(agent) {
        let message = `📱 *WhatsApp Voucher Order*\n\n` +
               `🎯 Format pesan:\n` +
               `• Dengan nomor customer:\n` +
               `  beli [harga] [jumlah] [nomor_customer]\n\n` +
               `• Tanpa nomor customer:\n` +
               `  beli [harga] [jumlah]\n\n` +
               `📝 Contoh:\n` +
               `✅ beli 3000 1 628123456789 (dengan nomor)\n` +
               `✅ beli 3000 1 (tanpa nomor)\n` +
               `✅ beli 5000 2 628987654321 (dengan nomor)\n\n` +
               `📋 Paket yang tersedia:\n` +
               `- 3000: 1 jam internet (3Mbps)\n` +
               `- 5000: 3 jam internet (3Mbps)\n` +
               `- 10000: 1 hari internet (5Mbps)\n` +
               `- 25000: 1 minggu internet (10Mbps)\n\n` +
               `💰 Sistem Pembayaran:\n` +
               `• Selalu BAYAR (potong saldo agent untuk pembuatan voucher)\n` +
               `• Dengan nomor: Voucher dikirim ke customer\n` +
               `• Tanpa nomor: Voucher hanya untuk agent\n\n` +
               `✅ Keuntungan:\n` +
               `• Voucher 4 digit angka\n` +
               `• Username = Password\n` +
               `• Kirim otomatis ke customer\n` +
               `• Format fleksibel\n\n` +
               `📋 Perintah Lain:\n` +
               `• status / saldo: Cek saldo dan informasi agent\n` +
               `• laporan / report: Lihat laporan transaksi\n` +
               `• help / bantuan: Tampilkan menu ini`;

        // Add admin commands if user is admin
        if (this.isAdmin(agent)) {
            message += `\n\n👑 *ADMIN COMMANDS:*\n` +
                       `• admin_help: Lihat perintah admin lengkap\n` +
                       `• admin_lihat_agent: Lihat semua agent\n` +
                       `• admin_registrasi: Lihat pendaftaran pending\n` +
                       `• admin_setujui [id]: Setujui pendaftaran\n` +
                       `• admin_tolak [id]: Tolak pendaftaran\n` +
                       `• admin_hapus [id]: Hapus agent\n` +
                       `• admin_topup [id] [jumlah]: Top up saldo agent\n` +
                       `• admin_laporan: Laporan sistem lengkap`;
        }

        message += `\n\n💡 Tips:\n` +
                   `- Format nomor: 628xxxxxxxxxx\n` +
                   `- Saldo SELALU dipotong untuk pembuatan voucher`;

        return message;
    }

    // Send OTP to agent
    async sendOTP(phoneNumber, otp) {
        try {
            const message = `🔐 *KODE OTP LOGIN*

Kode OTP Anda: *${otp}*

⏰ Berlaku selama 5 menit
📱 Jangan bagikan kode ini kepada siapapun

_Sistem Voucher WiFi_`;

            return await this.sendReply(phoneNumber, message);
        } catch (error) {
            console.error('❌ Error sending OTP:', error);
            return false;
        }
    }

    // Get agent report (laporan transaksi)
    async getAgentReport(agentId) {
        try {
            const database = require('../config/database');
            const db = database.getDb();

            // Get transaction summary for today
            const today = new Date().toISOString().split('T')[0];
            const sqlToday = `
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COUNT(CASE WHEN customer_phone IS NOT NULL AND customer_phone != '' THEN 1 END) as orders_with_customer
                FROM transactions
                WHERE created_by = ? AND DATE(created_at) = ?
            `;

            // Get transaction summary for this week
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];
            const sqlWeek = `
                SELECT
                    COUNT(*) as total_orders,
                    COALESCE(SUM(amount), 0) as total_amount
                FROM transactions
                WHERE created_by = ? AND DATE(created_at) >= ?
            `;

            // Get recent transactions (last 5)
            const sqlRecent = `
                SELECT
                    customer_name,
                    customer_phone,
                    amount,
                    created_at
                FROM transactions
                WHERE created_by = ?
                ORDER BY created_at DESC
                LIMIT 5
            `;

            return new Promise((resolve, reject) => {
                let todayStats = { total_orders: 0, total_amount: 0, orders_with_customer: 0 };
                let weekStats = { total_orders: 0, total_amount: 0 };
                let recentTransactions = [];

                // Get today's stats
                db.get(sqlToday, [agentId, today], (err, todayRow) => {
                    if (err) {
                        console.error('Error getting today stats:', err);
                        return reject(err);
                    }

                    if (todayRow) {
                        todayStats = todayRow;
                    }

                    // Get week stats
                    db.get(sqlWeek, [agentId, weekAgoStr], (err, weekRow) => {
                        if (err) {
                            console.error('Error getting week stats:', err);
                            return reject(err);
                        }

                        if (weekRow) {
                            weekStats = weekRow;
                        }

                        // Get recent transactions
                        db.all(sqlRecent, [agentId], (err, rows) => {
                            if (err) {
                                console.error('Error getting recent transactions:', err);
                                return reject(err);
                            }

                            if (rows) {
                                recentTransactions = rows;
                            }

                            // Format the report message
                            let report = `📊 *LAPORAN TRANSAKSI AGENT*\n\n`;

                            // Today's summary
                            report += `📅 *HARI INI (${today}):*\n`;
                            report += `🔢 Total Order: ${todayStats.total_orders}\n`;
                            report += `💰 Total Pendapatan: Rp ${todayStats.total_amount.toLocaleString('id-ID')}\n`;
                            report += `👥 Order dengan Customer: ${todayStats.orders_with_customer}\n\n`;

                            // Week summary
                            report += `📊 *MINGGU INI (7 hari terakhir):*\n`;
                            report += `🔢 Total Order: ${weekStats.total_orders}\n`;
                            report += `💰 Total Pendapatan: Rp ${weekStats.total_amount.toLocaleString('id-ID')}\n\n`;

                            // Recent transactions
                            if (recentTransactions.length > 0) {
                                report += `📋 *TRANSAKSI TERAKHIR:*\n`;
                                recentTransactions.forEach((tx, index) => {
                                    const date = new Date(tx.created_at).toLocaleString('id-ID', {
                                        timeZone: 'Asia/Jakarta',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    });
                                    const customer = tx.customer_phone ?
                                        `${tx.customer_name} (${tx.customer_phone})` :
                                        tx.customer_name;
                                    report += `${index + 1}. ${date}\n`;
                                    report += `   👤 ${customer}\n`;
                                    report += `   💰 Rp ${tx.amount.toLocaleString('id-ID')}\n\n`;
                                });
                            } else {
                                report += `📋 *TIDAK ADA TRANSAKSI*\n\n`;
                            }

                            report += `💡 *Keterangan:*\n`;
                            report += `• Semua order sudah termasuk biaya voucher\n`;
                            report += `• Jika ada nomor customer = voucher dikirim ke customer\n`;
                            report += `• Tanpa nomor customer = voucher hanya untuk agent\n\n`;
                            report += `📱 Kirim "help" untuk menu lengkap`;

                            resolve(report);
                        });
                    });
                });
            });

        } catch (error) {
            console.error('❌ Error generating agent report:', error);
            return `❌ Gagal mendapatkan laporan. Silakan coba lagi.`;
        }
    }

    // Get status
    getStatus() {
        return {
            isConnected: this.isConnected,
            phoneNumber: this.phoneNumber,
            connectionStatus: this.connectionStatus,
            activeOrders: this.orders.size,
            qrCode: this.qrCode,
            qrCodeDataUrl: this.qrCodeDataUrl,
            qrCodeText: this.qrCodeText,
            reconnectAttempts: this.reconnectAttempts,
            isInitialized: !!this.sock,
            hasSession: this.sessionPath && fs.existsSync(this.sessionPath),
            sessionPath: this.sessionPath
        };
    }

    // Disconnect WhatsApp
    disconnect() {
        console.log('🔄 Disconnecting WhatsApp Gateway...');
        
        if (this.sock) {
            this.sock.end();
            this.sock = null;
        }
        
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
        this.orders.clear();
        this.qrCode = null;
        this.qrCodeDataUrl = null;
        this.qrCodeText = null;
        this.reconnectAttempts = 0;
        
        console.log('✅ WhatsApp Gateway disconnected');
    }

    // Handle: approve/terima [request_id]
    async handleAdminApproveDepositCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 2) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `✅ Format yang benar:\n` +
                    `*terima [request_id]*\n\n` +
                    `💡 Contoh: terima 123`);
            }

            const requestId = parseInt(parts[1]);
            if (!requestId) {
                return this.sendReply(phoneNumber, '❌ Request ID harus berupa angka!');
            }

            // Get request details
            const database = require('../config/database');
            const sql = `
                SELECT dr.*, u.full_name, u.username, u.phone, u.balance
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                WHERE dr.id = ? AND dr.status = 'pending'
            `;

            const request = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [requestId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!request) {
                return this.sendReply(phoneNumber, `❌ Request #${requestId} tidak ditemukan atau sudah diproses!`);
            }

            // Approve the request
            const UserModel = require('../models/User');
            
            // Update request status
            const updateSql = `
                UPDATE deposit_requests 
                SET status = 'approved', processed_amount = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateSql, [request.amount, requestId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update agent balance
            const newBalance = request.balance + request.amount;
            await UserModel.updateBalance(request.agent_id, newBalance);

            // Notify agent
            if (request.phone) {
                const agentMessage = 
                    `🎉 *DEPOSIT APPROVED!*\n\n` +
                    `👤 Agent: ${request.full_name}\n` +
                    `💵 Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                    `💰 Saldo Lama: Rp ${request.balance.toLocaleString('id-ID')}\n` +
                    `💰 Saldo Baru: Rp ${newBalance.toLocaleString('id-ID')}\n` +
                    `🆔 Request ID: #${requestId}\n\n` +
                    `✅ Saldo sudah bertambah otomatis\n` +
                    `🚀 Siap untuk order voucher!\n\n` +
                    `⏰ Diproses: ${new Date().toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })}`;

                await this.sendReply(request.phone, agentMessage);
            }

            return this.sendReply(phoneNumber,
                `✅ *REQUEST APPROVED!*\n\n` +
                `🆔 Request ID: #${requestId}\n` +
                `👤 Agent: ${request.full_name}\n` +
                `💵 Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                `💰 Saldo Baru: Rp ${newBalance.toLocaleString('id-ID')}\n\n` +
                `📱 Agent sudah menerima notifikasi`);

        } catch (error) {
            console.error('Error in handleAdminApproveDepositCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat approve request.');
        }
    }

    // Handle: reject/tolak [request_id] [alasan]
    async handleAdminRejectDepositCommand(phoneNumber, message) {
        try {
            const parts = message.split(/\s+/);
            if (parts.length < 3) {
                return this.sendReply(phoneNumber,
                    `❌ Format salah!\n\n` +
                    `❌ Format yang benar:\n` +
                    `*tolak [request_id] [alasan]*\n\n` +
                    `💡 Contoh: tolak 123 Data tidak lengkap`);
            }

            const requestId = parseInt(parts[1]);
            const reason = parts.slice(2).join(' ');

            if (!requestId) {
                return this.sendReply(phoneNumber, '❌ Request ID harus berupa angka!');
            }

            // Get request details
            const database = require('../config/database');
            const sql = `
                SELECT dr.*, u.full_name, u.username, u.phone
                FROM deposit_requests dr
                JOIN users u ON dr.agent_id = u.id
                WHERE dr.id = ? AND dr.status = 'pending'
            `;

            const request = await new Promise((resolve, reject) => {
                database.getDb().get(sql, [requestId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!request) {
                return this.sendReply(phoneNumber, `❌ Request #${requestId} tidak ditemukan atau sudah diproses!`);
            }

            // Update request status
            const updateSql = `
                UPDATE deposit_requests 
                SET status = 'rejected', admin_notes = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                database.getDb().run(updateSql, [reason, requestId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Notify agent
            if (request.phone) {
                const agentMessage = 
                    `❌ *DEPOSIT REQUEST DITOLAK*\n\n` +
                    `👤 Agent: ${request.full_name}\n` +
                    `💵 Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                    `🆔 Request ID: #${requestId}\n\n` +
                    `📝 Alasan: ${reason}\n\n` +
                    `💡 Silakan buat request baru dengan:\n` +
                    `• Informasi yang lebih lengkap\n` +
                    `• Metode pembayaran yang sesuai\n` +
                    `• Hubungi admin untuk klarifikasi\n\n` +
                    `⏰ Diproses: ${new Date().toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })}`;

                await this.sendReply(request.phone, agentMessage);
            }

            return this.sendReply(phoneNumber,
                `❌ *REQUEST REJECTED!*\n\n` +
                `🆔 Request ID: #${requestId}\n` +
                `👤 Agent: ${request.full_name}\n` +
                `💵 Jumlah: Rp ${request.amount.toLocaleString('id-ID')}\n` +
                `📝 Alasan: ${reason}\n\n` +
                `📱 Agent sudah menerima notifikasi`);

        } catch (error) {
            console.error('Error in handleAdminRejectDepositCommand:', error);
            return this.sendReply(phoneNumber, '❌ Terjadi kesalahan saat reject request.');
        }
    }
}

module.exports = WhatsAppGateway;
