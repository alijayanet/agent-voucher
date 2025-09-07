const VoucherModel = require('../models/Voucher');
const VoucherProfileModel = require('../models/VoucherProfile');
const TransactionModel = require('../models/Transaction');
const MikrotikAPI = require('../config/mikrotik');
const moment = require('moment');

class VoucherController {
    // Membuat voucher baru
    static async createVoucher(req, res) {
        try {
            const { profile_name, quantity = 1, custom_duration } = req.body;

            if (!profile_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile name is required'
                });
            }

            // Get profile data
            const profile = await VoucherProfileModel.getByName(profile_name);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            const vouchers = [];
            const mikrotik = new MikrotikAPI();

            try {
                // Connect to Mikrotik
                await mikrotik.connect();

                for (let i = 0; i < quantity; i++) {
                    // Calculate expiry date
                    const duration = custom_duration || profile.duration;
                    const expiresAt = this.calculateExpiryDate(duration);

                    // Create voucher in database
                    const voucher = await VoucherModel.create({
                        profile: profile.name,
                        agent_price: profile.agent_price,
                        duration: duration,
                        expiresAt: expiresAt,
                        voucher_code_length: profile.voucher_code_length
                    });

                    // Create user in Mikrotik with session timeout (mulai hitung saat login)
                    await mikrotik.createHotspotUser(
                        voucher.username,
                        voucher.password,
                        'default', // menggunakan profile default dulu
                        duration // session-timeout yang akan dihitung saat user login
                    );

                    vouchers.push(voucher);
                }

                await mikrotik.disconnect();

                res.json({
                    success: true,
                    message: `${quantity} voucher(s) created successfully`,
                    data: vouchers
                });

            } catch (mikrotikError) {
                console.error('Mikrotik error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create vouchers in Mikrotik',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error creating voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Menjual voucher
    static async sellVoucher(req, res) {
        try {
            const { profile_name, customer_name, customer_phone, payment_method = 'cash' } = req.body;

            if (!profile_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile name is required'
                });
            }

            // Get profile data
            const profile = await VoucherProfileModel.getByName(profile_name);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            const mikrotik = new MikrotikAPI();

            try {
                // Connect to Mikrotik
                await mikrotik.connect();

                // Calculate expiry date
                const expiresAt = this.calculateExpiryDate(profile.duration);

                // Create voucher in database
                const voucher = await VoucherModel.create({
                    profile: profile.name,
                    agent_price: profile.agent_price,
                    duration: profile.duration,
                    expiresAt: expiresAt,
                    voucher_code_length: profile.voucher_code_length
                });

                // Create user in Mikrotik dengan session timeout
                await mikrotik.createHotspotUser(
                    voucher.username,
                    voucher.password,
                    profile.mikrotik_profile_name || profile.name || 'default', // menggunakan profile dari database
                    profile.duration // session-timeout mulai hitung saat login
                );

                // Create transaction
                const transaction = await TransactionModel.create({
                    voucher_id: voucher.id,
                    customer_name,
                    customer_phone,
                    amount: profile.selling_price,
                    payment_method
                });

                // Mark voucher as used
                await VoucherModel.markAsUsed(voucher.id);

                await mikrotik.disconnect();

                res.json({
                    success: true,
                    message: 'Voucher sold successfully',
                    data: {
                        voucher: voucher,
                        transaction: transaction
                    }
                });

            } catch (mikrotikError) {
                console.error('Mikrotik error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create voucher in Mikrotik',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error selling voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan daftar voucher
    static async getVouchers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            
            const filter = {};
            if (req.query.is_used !== undefined) {
                filter.is_used = req.query.is_used === 'true';
            }
            if (req.query.profile) {
                filter.profile = req.query.profile;
            }
            if (req.query.date_from) {
                filter.date_from = req.query.date_from;
            }
            if (req.query.date_to) {
                filter.date_to = req.query.date_to;
            }

            const result = await VoucherModel.getAll(page, limit, filter);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error getting vouchers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan voucher berdasarkan ID
    static async getVoucherById(req, res) {
        try {
            const { id } = req.params;
            const voucher = await VoucherModel.getById(id);

            if (!voucher) {
                return res.status(404).json({
                    success: false,
                    message: 'Voucher not found'
                });
            }

            res.json({
                success: true,
                data: voucher
            });

        } catch (error) {
            console.error('Error getting voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Data voucher untuk cetak (admin/agent)
    static async getPrintDetails(req, res) {
        try {
            const { voucherIds } = req.body;
            if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Voucher IDs harus disediakan' });
            }

            const role = req.user?.role;
            const agentId = req.user?.id;

            // Build SQL
            const placeholders = voucherIds.map(() => '?').join(',');
            const baseSql = `
                SELECT v.id, v.username, v.password, v.profile, v.duration, v.customer_name, v.created_at,
                       v.agent_price, COALESCE(vp.selling_price, NULL) AS selling_price
                FROM vouchers v
                LEFT JOIN voucher_profiles vp ON vp.name = v.profile
                WHERE v.id IN (${placeholders})
            `;

            const sql = role === 'agent'
                ? baseSql + ' AND (v.agent_id = ? OR v.agent_id IS NULL) ORDER BY v.created_at DESC'
                : baseSql + ' ORDER BY v.created_at DESC';

            const params = role === 'agent' ? [...voucherIds, agentId] : [...voucherIds];

            const database = require('../config/database');
            const rows = await new Promise((resolve, reject) => {
                database.getDb().all(sql, params, (err, data) => {
                    if (err) reject(err); else resolve(data || []);
                });
            });

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Tidak ada voucher ditemukan' });
            }

            res.json({
                success: true,
                vouchers: rows,
                printData: {
                    totalVouchers: rows.length,
                    printedAt: new Date().toISOString(),
                    role: role
                }
            });
        } catch (error) {
            console.error('Error getPrintDetails:', error);
            res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
        }
    }

    // Validasi voucher untuk login
    static async validateVoucher(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            const result = await VoucherModel.validate(username, password);

            if (result.valid) {
                // Update last activity
                await VoucherModel.updateLastActivity(result.voucher.id);
                
                res.json({
                    success: true,
                    message: 'Voucher is valid',
                    data: result.voucher
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: result.message
                });
            }

        } catch (error) {
            console.error('Error validating voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Menghapus voucher
    static async deleteVoucher(req, res) {
        try {
            const { id } = req.params;

            // Get voucher details first
            const voucher = await VoucherModel.getById(id);
            if (!voucher) {
                return res.status(404).json({
                    success: false,
                    message: 'Voucher not found'
                });
            }

            // Delete from Mikrotik if not used
            if (!voucher.is_used) {
                try {
                    const mikrotik = new MikrotikAPI();
                    await mikrotik.deleteHotspotUser(voucher.username);
                } catch (mikrotikError) {
                    console.error('Error deleting from Mikrotik:', mikrotikError);
                    // Continue with database deletion even if Mikrotik fails
                }
            }

            // Delete from database
            const result = await VoucherModel.delete(id);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Voucher not found'
                });
            }

            res.json({
                success: true,
                message: 'Voucher deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting voucher:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan statistik voucher
    static async getStats(req, res) {
        try {
            const stats = await VoucherModel.getStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error calculating stats:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Import users dari Mikrotik ke database
    static async importMikrotikUsers(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            let importedCount = 0;
            let skippedCount = 0;
            let errors = [];

            try {
                // Get all hotspot users from Mikrotik
                const mikrotikUsers = await mikrotik.getAllHotspotUsers();
                
                if (!mikrotikUsers || mikrotikUsers.length === 0) {
                    return res.json({
                        success: true,
                        message: 'No users found in Mikrotik to import',
                        data: { imported: 0, skipped: 0 }
                    });
                }

                for (const user of mikrotikUsers) {
                    try {
                        // Skip if username or password is empty
                        if (!user.name || !user.password) {
                            skippedCount++;
                            errors.push(`Skipped user ${user.name || 'unnamed'}: Missing username or password`);
                            continue;
                        }

                        // Check if voucher already exists in database
                        const existingVoucher = await VoucherModel.getByUsername(user.name);
                        if (existingVoucher) {
                            skippedCount++;
                            errors.push(`Skipped user ${user.name}: Already exists in database`);
                            continue;
                        }

                        // Convert Mikrotik limit-uptime to our duration format
                        let duration = '24h'; // default
                        if (user['limit-uptime']) {
                            duration = this.convertMikrotikUptimeToHours(user['limit-uptime']);
                        }

                        // Calculate expiry date based on creation time or current time
                        const expiresAt = this.calculateExpiryDate(duration);

                        // Get profile name (use profile or default)
                        const profileName = user.profile || 'default';
                        
                        // Get agent_price from profile or use default
                        let agent_price = 5000; // default price
                        try {
                            const profile = await VoucherProfileModel.getByName(profileName);
                            if (profile) {
                                agent_price = profile.agent_price;
                            }
                        } catch (profileError) {
                            console.log(`Profile ${profileName} not found, using default agent_price`);
                        }

                        // Create voucher in database
                        const voucher = await VoucherModel.createFromImport({
                            username: user.name,
                            password: user.password,
                            profile: profileName,
                            agent_price: agent_price,
                            duration: duration,
                            expiresAt: expiresAt,
                            is_used: user.disabled !== 'true', // if not disabled, consider as used
                            imported_from_mikrotik: true
                        });

                        importedCount++;
                        
                    } catch (userError) {
                        console.error(`Error importing user ${user.name}:`, userError);
                        errors.push(`Error importing user ${user.name}: ${userError.message}`);
                        skippedCount++;
                    }
                }

                res.json({
                    success: true,
                    message: `Import completed. ${importedCount} users imported, ${skippedCount} skipped.`,
                    data: {
                        imported: importedCount,
                        skipped: skippedCount,
                        total_processed: mikrotikUsers.length,
                        errors: errors.length > 0 ? errors.slice(0, 10) : [] // limit errors shown
                    }
                });

            } catch (mikrotikError) {
                console.error('Mikrotik connection error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to connect to Mikrotik or retrieve users',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error importing Mikrotik users:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during import',
                error: error.message
            });
        }
    }

    // Full sync dengan Mikrotik - import users dan profiles sekaligus
    static async fullSyncWithMikrotik(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            let results = {
                profiles: { imported: 0, skipped: 0, errors: [] },
                users: { imported: 0, skipped: 0, errors: [] }
            };

            try {
                // Step 1: Import profiles first
                console.log('Starting profiles import...');
                const VoucherProfileController = require('./VoucherProfileController');
                const profileResult = await VoucherProfileController.importMikrotikProfilesInternal();
                results.profiles = profileResult;

                // Step 2: Import users
                console.log('Starting users import...');
                const mikrotikUsers = await mikrotik.getAllHotspotUsers();
                
                if (mikrotikUsers && mikrotikUsers.length > 0) {
                    for (const user of mikrotikUsers) {
                        try {
                            if (!user.name || !user.password) {
                                results.users.skipped++;
                                results.users.errors.push(`Skipped ${user.name || 'unnamed'}: Missing data`);
                                continue;
                            }

                            const existingVoucher = await VoucherModel.getByUsername(user.name);
                            if (existingVoucher) {
                                results.users.skipped++;
                                continue;
                            }

                            let duration = '24h';
                            if (user['limit-uptime']) {
                                duration = this.convertMikrotikUptimeToHours(user['limit-uptime']);
                            }

                            const expiresAt = this.calculateExpiryDate(duration);
                            const profileName = user.profile || 'default';
                            
                            let agent_price = 5000;
                            try {
                                const profile = await VoucherProfileModel.getByName(profileName);
                                if (profile) agent_price = profile.agent_price;
                            } catch (e) {}

                            await VoucherModel.createFromImport({
                                username: user.name,
                                password: user.password,
                                profile: profileName,
                                agent_price: agent_price,
                                duration: duration,
                                expiresAt: expiresAt,
                                is_used: user.disabled !== 'true',
                                imported_from_mikrotik: true
                            });

                            results.users.imported++;
                            
                        } catch (userError) {
                            console.error(`Error importing user ${user.name}:`, userError);
                            results.users.errors.push(`${user.name}: ${userError.message}`);
                            results.users.skipped++;
                        }
                    }
                }

                // Step 3: Cleanup expired vouchers and sync back
                console.log('Starting cleanup and re-sync...');
                await this.cleanupExpiredVouchersInternal();
                await this.resyncMissingVouchersInternal();

                res.json({
                    success: true,
                    message: `Full sync completed. Profiles: ${results.profiles.imported} imported/${results.profiles.skipped} skipped. Users: ${results.users.imported} imported/${results.users.skipped} skipped.`,
                    data: results
                });

            } catch (mikrotikError) {
                console.error('Mikrotik sync error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed during Mikrotik synchronization',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error in full sync:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during full sync',
                error: error.message
            });
        }
    }

    // Re-sync missing vouchers to Mikrotik
    static async resyncMissingVouchers(req, res) {
        try {
            const result = await this.resyncMissingVouchersInternal();
            res.json({
                success: true,
                message: `Re-sync completed. ${result.synced} vouchers synced to Mikrotik.`,
                data: result
            });
        } catch (error) {
            console.error('Error in resync:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during resync',
                error: error.message
            });
        }
    }

    // Cleanup voucher yang sudah expired
    static async cleanupExpiredVouchers(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            let cleanedCount = 0;
            let errors = [];

            try {
                // Get expired vouchers from database
                const expiredVouchers = await VoucherModel.getExpired();
                
                if (expiredVouchers.length === 0) {
                    return res.json({
                        success: true,
                        message: 'Tidak ada voucher expired yang perlu dibersihkan',
                        data: { cleanedCount: 0 }
                    });
                }

                for (const voucher of expiredVouchers) {
                    try {
                        // Delete user from Mikrotik
                        const deleted = await mikrotik.deleteHotspotUser(voucher.username);
                        if (deleted) {
                            // Mark as expired in database
                            await VoucherModel.markAsExpired(voucher.id);
                            cleanedCount++;
                        }
                    } catch (cleanupError) {
                        console.error(`Error cleaning voucher ${voucher.username}:`, cleanupError);
                        errors.push(`Failed to cleanup ${voucher.username}: ${cleanupError.message}`);
                    }
                }

                res.json({
                    success: true,
                    message: `Cleanup completed. ${cleanedCount} expired vouchers cleaned.`,
                    data: {
                        cleanedCount,
                        totalExpired: expiredVouchers.length,
                        errors: errors.length > 0 ? errors.slice(0, 5) : []
                    }
                });

            } catch (mikrotikError) {
                console.error('Mikrotik cleanup error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to connect to Mikrotik for cleanup',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error in cleanup expired vouchers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during cleanup',
                error: error.message
            });
        }
    }

    // Sync voucher dengan Mikrotik
    static async syncWithMikrotik(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            let syncedCount = 0;
            let issues = [];
            let markedUsed = 0;

            try {
                // Get all vouchers from database
                const allVouchers = await VoucherModel.getAllForSync();
                const mikrotikUsers = await mikrotik.getAllHotspotUsers();
                const mikrotikUsernames = mikrotikUsers.map(u => u.name);
                // Ambil user aktif untuk penandaan terpakai
                const activeUsers = await mikrotik.getActiveUsers().catch(() => []);
                const activeUsernames = (activeUsers || []).map(u => u.user || u.name).filter(Boolean);
                // Deteksi user yang pernah login dari daftar user (uptime/traffic)
                const usedByUptime = (mikrotikUsers || [])
                    .filter(u => {
                        const uptime = (u.uptime || u['uptime'] || '').toString();
                        const bytesIn = parseInt(u['bytes-in'] || u['bytes_in'] || '0', 10);
                        const bytesOut = parseInt(u['bytes-out'] || u['bytes_out'] || '0', 10);
                        const hasUptime = uptime && !/^0+[smhd]?$/i.test(uptime);
                        const hasTraffic = (bytesIn > 0) || (bytesOut > 0);
                        return hasUptime || hasTraffic;
                    })
                    .map(u => u.name)
                    .filter(Boolean);
                const usedUsernamesSet = new Set([ ...activeUsernames, ...usedByUptime ]);

                for (const voucher of allVouchers) {
                    try {
                        const existsInMikrotik = mikrotikUsernames.includes(voucher.username);
                        const isUsedInRouter = usedUsernamesSet.has(voucher.username);
                        
                        if (voucher.is_used === false && !existsInMikrotik) {
                            // Voucher exists in DB but not in Mikrotik - create it
                            await mikrotik.createHotspotUser(
                                voucher.username,
                                voucher.password,
                                'default',
                                voucher.duration
                            );
                            syncedCount++;
                        } else if (voucher.is_used === true && existsInMikrotik) {
                            // Used voucher still exists in Mikrotik - remove it
                            await mikrotik.deleteHotspotUser(voucher.username);
                            syncedCount++;
                        }
                        
                        // Jika voucher terdeteksi dipakai di router, tandai sebagai digunakan
                        if (!voucher.is_used && isUsedInRouter) {
                            await VoucherModel.markAsUsed(voucher.id);
                            markedUsed++;
                        }

                        // Check for expired vouchers
                        if (voucher.expires_at && moment().isAfter(moment(voucher.expires_at))) {
                            if (existsInMikrotik) {
                                await mikrotik.deleteHotspotUser(voucher.username);
                                await VoucherModel.markAsExpired(voucher.id);
                                syncedCount++;
                            }
                        }
                        
                    } catch (syncError) {
                        console.error(`Error syncing voucher ${voucher.username}:`, syncError);
                        issues.push({
                            voucher: voucher.username,
                            issue: syncError.message
                        });
                    }
                }

                res.json({
                    success: true,
                    message: `Sync completed. ${syncedCount} synced, ${markedUsed} marked as used.`,
                    data: {
                        syncedCount,
                        markedUsed,
                        totalVouchers: allVouchers.length,
                        issues: issues.length > 0 ? issues.slice(0, 10) : []
                    }
                });

            } catch (mikrotikError) {
                console.error('Mikrotik sync error:', mikrotikError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to connect to Mikrotik for sync',
                    error: mikrotikError.message
                });
            }

        } catch (error) {
            console.error('Error in sync with Mikrotik:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during sync',
                error: error.message
            });
        }
    }

    // Internal method untuk resync (dapat dipanggil dari method lain)
    static async resyncMissingVouchersInternal() {
        const mikrotik = new MikrotikAPI();
        let syncedCount = 0;
        let errors = [];

        try {
            // Get all unused vouchers from database
            const unusedVouchers = await VoucherModel.getUnused();
            const mikrotikUsers = await mikrotik.getAllHotspotUsers();
            const mikrotikUsernames = mikrotikUsers.map(u => u.name);

            for (const voucher of unusedVouchers) {
                try {
                    // Check if voucher exists in Mikrotik
                    if (!mikrotikUsernames.includes(voucher.username)) {
                        // Create missing voucher in Mikrotik
                        await mikrotik.createHotspotUser(
                            voucher.username,
                            voucher.password,
                            'default',
                            voucher.duration
                        );
                        syncedCount++;
                    }
                } catch (userError) {
                    errors.push(`Failed to sync ${voucher.username}: ${userError.message}`);
                }
            }

            return { synced: syncedCount, errors };

        } catch (error) {
            throw error;
        }
    }

    // Internal method untuk cleanup (dapat dipanggil dari scheduler)
    static async cleanupExpiredVouchersInternal() {
        const mikrotik = new MikrotikAPI();
        let cleanedCount = 0;
        let errors = [];

        try {
            const expiredVouchers = await VoucherModel.getExpired();
            
            for (const voucher of expiredVouchers) {
                try {
                    const deleted = await mikrotik.deleteHotspotUser(voucher.username);
                    if (deleted) {
                        await VoucherModel.markAsExpired(voucher.id);
                        cleanedCount++;
                    }
                } catch (cleanupError) {
                    errors.push(`Failed to cleanup ${voucher.username}: ${cleanupError.message}`);
                }
            }

            return { cleanedCount, errors };

        } catch (error) {
            throw error;
        }
    }

    // Helper method untuk convert Mikrotik uptime format ke hours
    static convertMikrotikUptimeToHours(uptimeStr) {
        if (!uptimeStr) return '24h';
        
        // Mikrotik uptime format bisa: 1d, 2h, 30m, 1d2h30m, dll
        const timeStr = uptimeStr.toString().toLowerCase();
        
        let totalHours = 0;
        
        // Extract days
        const daysMatch = timeStr.match(/(\d+)d/);
        if (daysMatch) {
            totalHours += parseInt(daysMatch[1]) * 24;
        }
        
        // Extract hours
        const hoursMatch = timeStr.match(/(\d+)h/);
        if (hoursMatch) {
            totalHours += parseInt(hoursMatch[1]);
        }
        
        // Extract minutes (convert to hours)
        const minutesMatch = timeStr.match(/(\d+)m/);
        if (minutesMatch) {
            totalHours += parseInt(minutesMatch[1]) / 60;
        }
        
        // Extract seconds (convert to hours)
        const secondsMatch = timeStr.match(/(\d+)s/);
        if (secondsMatch) {
            totalHours += parseInt(secondsMatch[1]) / 3600;
        }
        
        // If no time unit found, assume it's seconds
        if (!daysMatch && !hoursMatch && !minutesMatch && !secondsMatch) {
            const numValue = parseInt(timeStr);
            if (!isNaN(numValue)) {
                totalHours = numValue / 3600; // convert seconds to hours
            }
        }
        
        // Round to nearest hour and ensure minimum 1 hour
        totalHours = Math.max(1, Math.round(totalHours));
        
        return `${totalHours}h`;
    }

    // Helper method untuk menghitung tanggal expired
    static calculateExpiryDate(duration) {
        const now = moment();
        const durationMatch = duration.match(/(\d+)([hdwm])/);
        
        if (!durationMatch) {
            return now.add(1, 'day').toISOString();
        }
        
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        
        switch (unit) {
            case 'h':
                return now.add(amount, 'hours').toISOString();
            case 'd':
                return now.add(amount, 'days').toISOString();
            case 'w':
                return now.add(amount, 'weeks').toISOString();
            case 'm':
                return now.add(amount, 'months').toISOString();
            default:
                return now.add(1, 'day').toISOString();
        }
    }
}

module.exports = VoucherController;