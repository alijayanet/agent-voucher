const VoucherProfileModel = require('../models/VoucherProfile');
const VoucherModel = require('../models/Voucher');
const TransactionModel = require('../models/Transaction');
const MikrotikAPI = require('../config/mikrotik');
const database = require('../config/database');
const PaymentGateway = require('../services/PaymentGateway');

class OrderController {
    // Create new order (NO VOUCHER CREATION - voucher hanya dibuat setelah pembayaran berhasil)
    static async createOrder(req, res) {
        try {
            const { profile_id, customer_name, customer_phone, payment_method } = req.body;

            // Validate input
            if (!profile_id || !customer_name || !customer_phone || !payment_method) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua field harus diisi'
                });
            }

            // Validate phone number format
            if (!/^628\d{8,12}$/.test(customer_phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format nomor WhatsApp tidak valid'
                });
            }

            // Get profile details
            const profile = await VoucherProfileModel.getById(profile_id);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profil voucher tidak ditemukan'
                });
            }

            // Create order record ONLY (NO VOUCHER CREATION YET)
            const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
            
            const sql = `INSERT INTO orders (order_id, profile_id, customer_name, customer_phone, amount, payment_method, status)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
            
            await new Promise((resolve, reject) => {
                database.getDb().run(sql, [orderId, profile_id, customer_name, customer_phone, profile.selling_price, payment_method], function(err) {
                    if (err) {
                        console.error('Database error creating order:', err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });

            // Create payment transaction
            const paymentData = {
                order_id: orderId,
                amount: profile.selling_price,
                customer_name: customer_name,
                customer_phone: customer_phone,
                profile_name: profile.name,
                profile_duration: profile.duration,
                payment_method: payment_method
            };

            console.log('Creating payment transaction with data:', JSON.stringify(paymentData, null, 2));
            const paymentResult = await PaymentGateway.createTransaction(paymentData);
            console.log('Payment transaction result:', JSON.stringify(paymentResult, null, 2));

            res.json({
                success: true,
                message: 'Pesanan berhasil dibuat. Silakan selesaikan pembayaran untuk mendapatkan voucher.',
                data: {
                    order_id: orderId,
                    amount: profile.selling_price,
                    payment_method: payment_method,
                    payment_url: paymentResult.payment_url,
                    transaction_id: paymentResult.transaction_id
                }
            });

        } catch (error) {
            console.error('Error creating order:', error);
            // Menentukan status code berdasarkan jenis error
            let statusCode = 500;
            let message = 'Internal server error';
            
            // Jika error dari payment gateway
            if (error.message && error.message.includes('payment')) {
                statusCode = 400;
                message = 'Gagal memproses pembayaran: ' + error.message;
            } else if (error.message && error.message.includes('Tripay')) {
                statusCode = 400;
                message = 'Gagal memproses pembayaran: ' + error.message;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Complete order manually (for admin use or fallback scenarios)
    // NOTE: This method is now mainly for manual completion by admin
    // Normal flow: voucher is created automatically in handlePaymentNotification
    static async completeOrder(req, res) {
        try {
            const { order_id } = req.params;
            const { payment_reference } = req.body;

            console.log('🔧 Manual order completion requested for:', order_id);

            // Get order details
            const orderSql = `SELECT * FROM orders WHERE order_id = ?`;
            const order = await new Promise((resolve, reject) => {
                database.getDb().get(orderSql, [order_id], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pesanan tidak ditemukan'
                });
            }

            if (order.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Pesanan sudah diproses'
                });
            }

            // Get profile details
            const profile = await VoucherProfileModel.getById(order.profile_id);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profil voucher tidak ditemukan'
                });
            }

            // Create voucher manually
            console.log('🎫 Creating voucher manually for order:', order_id);
            const mikrotik = new MikrotikAPI();
            let voucherData = null;

            try {
                // Connect to Mikrotik
                await mikrotik.connect();

                // Calculate expiry date
                const expiresAt = OrderController.calculateExpiryDate(profile.duration);

                // Create voucher in database
                voucherData = await VoucherModel.create({
                    profile: profile.name,
                    agent_price: profile.agent_price,
                    duration: profile.duration,
                    expiresAt: expiresAt,
                    voucher_code_length: profile.voucher_code_length
                });

                // Create user in Mikrotik
                const comment = `Manual Order: ${order.customer_name} (${order.customer_phone}) | ${new Date().toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}`;
                
                await mikrotik.createHotspotUser(
                    voucherData.username,
                    voucherData.password,
                    profile.mikrotik_profile_name || profile.name || 'default',
                    profile.duration,
                    comment
                );

                await mikrotik.disconnect();
                console.log('✅ Manual voucher created successfully');

            } catch (mikrotikError) {
                console.error('Mikrotik error:', mikrotikError);
                
                // Even if Mikrotik fails, we still create the voucher in database
                if (!voucherData) {
                    const expiresAt = OrderController.calculateExpiryDate(profile.duration);
                    voucherData = await VoucherModel.create({
                        profile: profile.name,
                        agent_price: profile.agent_price,
                        duration: profile.duration,
                        expiresAt: expiresAt,
                        voucher_code_length: profile.voucher_code_length
                    });
                }
            }

            // Update order status
            const updateOrderSql = `UPDATE orders SET status = 'completed', payment_reference = ?, processed_at = CURRENT_TIMESTAMP WHERE order_id = ?`;
            await new Promise((resolve, reject) => {
                database.getDb().run(updateOrderSql, [payment_reference || 'MANUAL', order_id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            // Create transaction
            const transaction = await TransactionModel.create({
                voucher_id: voucherData.id,
                customer_name: order.customer_name,
                customer_phone: order.customer_phone,
                amount: order.amount,
                payment_method: order.payment_method,
                status: 'completed',
                notes: `Manual Order ID: ${order_id}`
            });

            // Mark voucher as used (since it's been sold)
            await VoucherModel.markAsUsed(voucherData.id);

            // Send WhatsApp notification (if WhatsApp gateway is available)
            try {
                const WhatsAppGateway = require('../services/WhatsAppGateway');
                const wa = WhatsAppGateway.getInstance();
                
                if (wa.isConnected) {
                    // Send notification to customer
                    let formattedPhone = order.customer_phone;
                    try {
                        if (formattedPhone && !formattedPhone.includes('@')) {
                            formattedPhone = formattedPhone.replace(/\D/g, '');
                            if (!formattedPhone.startsWith('62')) {
                                if (formattedPhone.startsWith('0')) {
                                    formattedPhone = '62' + formattedPhone.substring(1);
                                } else {
                                    formattedPhone = '62' + formattedPhone;
                                }
                            }
                            if (!formattedPhone.endsWith('@s.whatsapp.net')) {
                                formattedPhone = formattedPhone + '@s.whatsapp.net';
                            }
                        }
                    } catch (formatError) {
                        console.error('Error formatting phone number:', formatError);
                        formattedPhone = order.customer_phone;
                    }
                    
                    const customerMessage = 
                        `🎉 *PEMBELIAN VOUCHER BERHASIL!*\n\n` +
                        `👤 Nama: ${order.customer_name}\n` +
                        `📱 Nomor: ${order.customer_phone}\n` +
                        `🏷️ Paket: ${profile.name}\n` +
                        `💰 Harga: Rp ${parseInt(order.amount).toLocaleString('id-ID')}\n` +
                        `📅 Durasi: ${profile.duration.replace('h', ' jam').replace('d', ' hari')}\n\n` +
                        `🔐 *Detail Voucher:*\n` +
                        `🔑 Kode Voucher: ${voucherData.username}\n\n` +
                        `💡 Cara menggunakan:\n` +
                        `1. Buka browser\n` +
                        `2. Masukkan kode voucher sebagai username dan password\n` +
                        `3. Klik login\n\n` +
                        `⏰ Berlaku sampai: ${new Date(voucherData.expires_at).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        })}\n\n` +
                        `Terima kasih telah menggunakan layanan kami!`;

                    const sendResult = await wa.sendReply(formattedPhone, customerMessage);
                    if (sendResult) {
                        console.log(`✅ WhatsApp notification sent successfully to customer ${formattedPhone}`);
                    } else {
                        console.log(`⚠️ Failed to send WhatsApp notification to customer ${formattedPhone}`);
                    }

                    // Send notification to admins
                    await OrderController.notifyAdmins(order, profile, voucherData);
                    
                } else {
                    console.log('⚠️ WhatsApp gateway not connected, skipping notification');
                }
            } catch (waError) {
                console.error('Error sending WhatsApp notification:', waError);
            }

            res.json({
                success: true,
                message: 'Pesanan berhasil diselesaikan secara manual',
                data: {
                    order_id: order_id,
                    voucher: voucherData
                }
            });

        } catch (error) {
            console.error('Error completing order manually:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Handle payment notification from payment gateway
    static async handlePaymentNotification(req, res) {
        try {
            console.log('📥 Received payment notification from payment gateway');
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            console.log('Request headers:', JSON.stringify(req.headers, null, 2));
            console.log('Server info:', {
                hostname: req.hostname,
                host: req.headers.host,
                url: req.url,
                environment: process.env.NODE_ENV
            });
            
            const notification = req.body;
            const headers = req.headers;
            
            // Verify notification
            const verification = await PaymentGateway.verifyNotification(notification, headers);
            console.log('Verification result:', JSON.stringify(verification, null, 2));
            
            if (!verification.verified) {
                console.error('Payment notification verification failed:', verification.error);
                return res.status(400).json({
                    success: false,
                    message: 'Notification verification failed'
                });
            }

            // Get order details
            console.log('Looking for order with ID:', verification.order_id);
            const orderSql = `SELECT * FROM orders WHERE order_id = ?`;
            const order = await new Promise((resolve, reject) => {
                database.getDb().get(orderSql, [verification.order_id], (err, row) => {
                    if (err) {
                        console.error('Database error when fetching order:', err);
                        reject(err);
                    } else {
                        console.log('Order found:', row ? 'Yes' : 'No');
                        if (row) {
                            console.log('Order details:', JSON.stringify(row, null, 2));
                        }
                        resolve(row);
                    }
                });
            });

            if (!order) {
                // Log all pending orders for debugging
                console.log('Checking all pending orders for debugging:');
                const allOrdersSql = `SELECT order_id, customer_name, created_at FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`;
                database.getDb().all(allOrdersSql, [], (err, rows) => {
                    if (!err && rows) {
                        console.log('All pending orders:', JSON.stringify(rows, null, 2));
                    }
                });
                
                console.error('Order not found for payment notification:', verification.order_id);
                console.error('This may be because the order was created on a different server/environment.');
                console.error('Current server environment:', process.env.NODE_ENV);
                console.error('Expected callback URL:', `${process.env.CORS_ORIGIN || 'http://localhost:3010'}/api/orders/notification`);
                
                return res.status(404).json({
                    success: false,
                    message: 'Pesanan tidak ditemukan',
                    debug_info: process.env.NODE_ENV === 'development' ? {
                        requested_order_id: verification.order_id,
                        server_environment: process.env.NODE_ENV,
                        note: 'Order may exist on production server but not on this development server'
                    } : undefined
                });
            }

            // Update order status based on payment status
            if (verification.transaction_status === 'settlement' || 
                verification.transaction_status === 'capture' || 
                verification.transaction_status === 'SUCCESS') {
                
                // Payment successful, NOW CREATE VOUCHER
                try {
                    console.log('🎫 Payment successful! Creating voucher now...');
                    
                    // Update order status
                    const updateOrderSql = `UPDATE orders SET status = 'completed', payment_reference = ?, processed_at = CURRENT_TIMESTAMP WHERE order_id = ?`;
                    await new Promise((resolve, reject) => {
                        database.getDb().run(updateOrderSql, [verification.transaction_id, verification.order_id], function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });

                    // Get profile details
                    const profile = await VoucherProfileModel.getById(order.profile_id);
                    if (!profile) {
                        throw new Error('Profil voucher tidak ditemukan');
                    }

                    // 🎫 CREATE VOUCHER ONLY AFTER SUCCESSFUL PAYMENT
                    console.log('🎫 Creating voucher after successful payment...');
                    const mikrotik = new MikrotikAPI();
                    let voucherData = null;

                    try {
                        // Connect to Mikrotik
                        await mikrotik.connect();

                        // Calculate expiry date
                        const expiresAt = OrderController.calculateExpiryDate(profile.duration);

                        // Create voucher in database
                        voucherData = await VoucherModel.create({
                            profile: profile.name,
                            agent_price: profile.agent_price,
                            duration: profile.duration,
                            expiresAt: expiresAt,
                            voucher_code_length: profile.voucher_code_length
                        });

                        // Create user in Mikrotik
                        const comment = `Public Order: ${order.customer_name} (${order.customer_phone}) | ${new Date().toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}`;
                        
                        await mikrotik.createHotspotUser(
                            voucherData.username,
                            voucherData.password,
                            profile.mikrotik_profile_name || profile.name || 'default',
                            profile.duration,
                            comment
                        );

                        await mikrotik.disconnect();
                        console.log('✅ Voucher created successfully in Mikrotik');

                    } catch (mikrotikError) {
                        console.error('Mikrotik error:', mikrotikError);
                        
                        // Even if Mikrotik fails, we still create the voucher in database
                        if (!voucherData) {
                            const expiresAt = OrderController.calculateExpiryDate(profile.duration);
                            voucherData = await VoucherModel.create({
                                profile: profile.name,
                                agent_price: profile.agent_price,
                                duration: profile.duration,
                                expiresAt: expiresAt,
                                voucher_code_length: profile.voucher_code_length
                            });
                        }
                    }

                    // Create transaction
                    const transaction = await TransactionModel.create({
                        voucher_id: voucherData.id,
                        customer_name: order.customer_name,
                        customer_phone: order.customer_phone,
                        amount: order.amount,
                        payment_method: order.payment_method,
                        status: 'completed',
                        notes: `Order ID: ${order.order_id}`
                    });

                    // Mark voucher as used (since it's been sold)
                    await VoucherModel.markAsUsed(voucherData.id);

                    // Send WhatsApp notification (if WhatsApp gateway is available)
                    try {
                        const WhatsAppGateway = require('../services/WhatsAppGateway');
                        const wa = WhatsAppGateway.getInstance();
                        
                        // Check if WhatsApp is connected, if not try to initialize it
                        if (!wa.isConnected) {
                            console.log('⚠️ WhatsApp gateway not connected, attempting to initialize...');
                            try {
                                await wa.initialize();
                                console.log('🔄 WhatsApp gateway initialization attempted');
                            } catch (initError) {
                                console.error('❌ Error initializing WhatsApp gateway:', initError);
                            }
                        }
                        
                        console.log('WhatsApp gateway status in payment notification:', {
                            isConnected: wa.isConnected,
                            connectionStatus: wa.connectionStatus,
                            phoneNumber: wa.phoneNumber
                        });
                        
                        if (wa.isConnected) {
                            const message = 
                                `🎉 *PEMBELIAN VOUCHER BERHASIL!*\n\n` +
                                `👤 Nama: ${order.customer_name}\n` +
                                `📱 Nomor: ${order.customer_phone}\n` +
                                `🏷️ Paket: ${profile.name}\n` +
                                `💰 Harga: Rp ${parseInt(order.amount).toLocaleString('id-ID')}\n` +
                                `📅 Durasi: ${profile.duration.replace('h', ' jam').replace('d', ' hari')}\n\n` +
                                `🔐 *Detail Voucher:*\n` +
                                `🔑 Kode Voucher: ${voucherData.username}\n\n` +
                                `💡 Cara menggunakan:\n` +
                                `1. Buka browser\n` +
                                `2. Masukkan kode voucher sebagai username dan password\n` +
                                `3. Klik login\n\n` +
                                `⏰ Berlaku sampai: ${new Date(voucherData.expires_at).toLocaleString('id-ID', {
                                    timeZone: 'Asia/Jakarta',
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}\n\n` +
                                `Terima kasih telah menggunakan layanan kami!`;

                            // Validate and format phone number with better error handling
                            let formattedPhone = order.customer_phone;
                            try {
                                if (formattedPhone && !formattedPhone.includes('@')) {
                                    // Remove any non-digit characters and ensure it starts with 62
                                    formattedPhone = formattedPhone.replace(/\D/g, '');
                                    if (!formattedPhone.startsWith('62')) {
                                        if (formattedPhone.startsWith('0')) {
                                            formattedPhone = '62' + formattedPhone.substring(1);
                                        } else {
                                            formattedPhone = '62' + formattedPhone;
                                        }
                                    }
                                    // Add WhatsApp suffix if needed
                                    if (!formattedPhone.endsWith('@s.whatsapp.net')) {
                                        formattedPhone = formattedPhone + '@s.whatsapp.net';
                                    }
                                }
                                
                                console.log('Sending WhatsApp notification to:', formattedPhone);
                                const sendResult = await wa.sendReply(formattedPhone, message);
                                if (sendResult) {
                                    console.log(`✅ WhatsApp notification sent successfully to ${formattedPhone}`);
                                } else {
                                    console.log(`⚠️ Failed to send WhatsApp notification to ${formattedPhone}`);
                                    // Try sending without the @s.whatsapp.net suffix
                                    const simplifiedPhone = formattedPhone.replace('@s.whatsapp.net', '');
                                    console.log('Trying with simplified phone number:', simplifiedPhone);
                                    const retryResult = await wa.sendReply(simplifiedPhone, message);
                                    if (retryResult) {
                                        console.log(`✅ WhatsApp notification sent successfully on retry to ${simplifiedPhone}`);
                                    } else {
                                        console.log(`⚠️ Failed to send WhatsApp notification on retry to ${simplifiedPhone}`);
                                    }
                                }
                            } catch (formatError) {
                                console.error('Error formatting phone number:', formatError);
                                // Try with the original phone number as fallback
                                const sendResult = await wa.sendReply(order.customer_phone, message);
                                if (sendResult) {
                                    console.log(`✅ WhatsApp notification sent successfully with original phone number`);
                                } else {
                                    console.log(`⚠️ Failed to send WhatsApp notification with original phone number`);
                                }
                            }

                            // Send notification to admins
                            await OrderController.notifyAdmins(order, profile, voucherData);
                            
                        } else {
                            console.log('⚠️ WhatsApp gateway not connected, skipping notification');
                            console.log('Please scan the QR code in the admin dashboard to connect WhatsApp');
                            
                            // Log additional connection status information
                            console.log('WhatsApp gateway detailed status:', wa.getStatus());
                        }
                    } catch (waError) {
                        console.error('Error sending WhatsApp notification:', waError);
                        console.error('Error stack:', waError.stack);
                        // Don't fail the entire order if WhatsApp fails
                    }

                    res.json({
                        success: true,
                        message: 'Payment notification processed successfully'
                    });
                } catch (error) {
                    console.error('Error completing order after payment:', error);
                    res.status(500).json({
                        success: false,
                        message: 'Error completing order after payment',
                        error: error.message
                    });
                }
            } else {
                // Payment failed or pending - NO VOUCHER CREATED
                console.log('❌ Payment failed or pending, no voucher created');
                console.log('Payment status:', verification.transaction_status);
                res.json({
                    success: true,
                    message: 'Payment notification received - payment not successful'
                });
            }

        } catch (error) {
            console.error('Error handling payment notification:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Helper method to calculate expiry date
    static calculateExpiryDate(duration) {
        const now = new Date();
        const durationMatch = duration.match(/(\d+)([hd])/);
        
        if (!durationMatch) {
            return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Default 1 day
        }
        
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        
        switch (unit) {
            case 'h':
                return new Date(now.getTime() + amount * 60 * 60 * 1000).toISOString();
            case 'd':
                return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000).toISOString();
            default:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        }
    }

    // Send notification to admins about new public order
    static async notifyAdmins(order, profile, voucherData) {
        try {
            const WhatsAppGateway = require('../services/WhatsAppGateway');
            const whatsapp = WhatsAppGateway.getInstance();

            // Get admin phones from config
            const adminPhones = process.env.ADMIN_PHONES ? process.env.ADMIN_PHONES.split(',') : [];
            
            if (adminPhones.length === 0) {
                console.log('⚠️ No admin phones configured, skipping admin notification');
                return;
            }

            const message = 
                `🛒 *TRANSAKSI VOUCHER BARU!*\n\n` +
                `👤 Customer: ${order.customer_name}\n` +
                `📱 Nomor: ${order.customer_phone}\n` +
                `🏷️ Paket: ${profile.name}\n` +
                `💰 Harga: Rp ${parseInt(order.amount).toLocaleString('id-ID')}\n` +
                `📅 Durasi: ${profile.duration.replace('h', ' jam').replace('d', ' hari')}\n` +
                `💳 Payment: ${order.payment_method.toUpperCase()}\n\n` +
                `🔐 *Detail Voucher:*\n` +
                `🔑 Kode: ${voucherData.username}\n` +
                `⏰ Expires: ${new Date(voucherData.expires_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })}\n\n` +
                `🆔 Order ID: #${order.id}\n` +
                `⏰ Waktu: ${new Date().toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })}\n\n` +
                `📊 Dashboard: ${process.env.DASHBOARD_URL || 'http://localhost:3010'}`;

            // Send to all admin phones
            for (const adminPhone of adminPhones) {
                if (adminPhone && adminPhone.trim()) {
                    try {
                        let formattedAdminPhone = adminPhone.trim();
                        if (!formattedAdminPhone.includes('@')) {
                            // Remove any non-digit characters and ensure it starts with 62
                            formattedAdminPhone = formattedAdminPhone.replace(/\D/g, '');
                            if (!formattedAdminPhone.startsWith('62')) {
                                if (formattedAdminPhone.startsWith('0')) {
                                    formattedAdminPhone = '62' + formattedAdminPhone.substring(1);
                                } else {
                                    formattedAdminPhone = '62' + formattedAdminPhone;
                                }
                            }
                            // Add WhatsApp suffix if needed
                            if (!formattedAdminPhone.endsWith('@s.whatsapp.net')) {
                                formattedAdminPhone = formattedAdminPhone + '@s.whatsapp.net';
                            }
                        }
                        
                        await whatsapp.sendReply(formattedAdminPhone, message);
                        console.log(`✅ Admin notification sent to ${formattedAdminPhone}`);
                    } catch (adminError) {
                        console.error(`❌ Error sending admin notification to ${adminPhone}:`, adminError);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error in notifyAdmins:', error);
        }
    }
}

module.exports = OrderController;