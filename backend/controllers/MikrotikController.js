const MikrotikAPI = require('../config/mikrotik');
const database = require('../config/database');

class MikrotikController {
    // Simpan konfigurasi Mikrotik
    static async saveConfig(req, res) {
        try {
            const { host, username, password, port } = req.body;

            if (!host || !username) {
                return res.status(400).json({
                    success: false,
                    message: 'Host dan username harus diisi'
                });
            }

            // Simpan ke database
            const sql = `INSERT OR REPLACE INTO mikrotik_config 
                        (id, name, host, username, password, port, is_active) 
                        VALUES (1, 'Main Config', ?, ?, ?, ?, 1)`;
            
            database.getDb().run(sql, [host, username, password, port || 8728], function(err) {
                if (err) {
                    console.error('Error saving Mikrotik config:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Gagal menyimpan konfigurasi ke database'
                    });
                }

                console.log('Mikrotik config saved:', { host, username, port: port || 8728 });

                // Update konfigurasi di MikrotikAPI instance
                const mikrotik = new MikrotikAPI();
                mikrotik.config.host = host;
                mikrotik.config.user = username;
                mikrotik.config.password = password;
                mikrotik.config.port = parseInt(port) || 8728;

                res.json({
                    success: true,
                    message: 'Konfigurasi Mikrotik berhasil disimpan'
                });
            });

        } catch (error) {
            console.error('Error saving Mikrotik config:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Load konfigurasi Mikrotik dari .env
    static async getConfig(req, res) {
        try {
            // Ambil konfigurasi dari environment variables
            const config = {
                host: process.env.MIKROTIK_HOST || '192.168.1.1',
                username: process.env.MIKROTIK_USER || 'admin',
                port: parseInt(process.env.MIKROTIK_PORT) || 8728
            };

            console.log('Returning .env config:', {
                host: config.host,
                username: config.username,
                port: config.port
            });

            res.json({
                success: true,
                data: config
            });

        } catch (error) {
            console.error('Error getting Mikrotik config:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    // Test koneksi Mikrotik dengan konfigurasi dari .env
    static async testConnection(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            
            console.log('Testing connection with .env config...');
            
            // Test koneksi dengan konfigurasi yang sudah ada di MikrotikAPI
            const result = await mikrotik.testConnection();
            res.json(result);

        } catch (error) {
            console.error('Error testing Mikrotik connection:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan daftar user aktif
    static async getActiveUsers(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            
            // Check if connection is possible
            if (!mikrotik.config.host || mikrotik.config.host === '192.168.1.1') {
                return res.status(400).json({
                    success: false,
                    message: 'Mikrotik belum dikonfigurasi. Silakan set konfigurasi di halaman Mikrotik terlebih dahulu.'
                });
            }
            
            const activeUsers = await mikrotik.getActiveUsers();

            res.json({
                success: true,
                data: activeUsers
            });

        } catch (error) {
            console.error('Error getting active users:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil data user aktif. Pastikan koneksi ke Mikrotik sudah benar.',
                error: error.message
            });
        }
    }

    // Mendapatkan semua user hotspot dengan pagination
    static async getAllHotspotUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50; // Default 50 per halaman
            const offset = (page - 1) * limit;

            const mikrotik = new MikrotikAPI();
            const allUsers = await mikrotik.getAllHotspotUsers();

            // Hitung total user
            const totalUsers = allUsers.length;
            const totalPages = Math.ceil(totalUsers / limit);

            // Slice data sesuai pagination
            const users = allUsers.slice(offset, offset + limit);

            res.json({
                success: true,
                data: users,
                pagination: {
                    page,
                    limit,
                    totalUsers,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });

        } catch (error) {
            console.error('Error getting hotspot users:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get hotspot users from Mikrotik',
                error: error.message
            });
        }
    }

    // Mendapatkan profile hotspot
    static async getHotspotProfiles(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            
            // Check if connection is possible
            if (!mikrotik.config.host || mikrotik.config.host === '192.168.1.1') {
                return res.status(400).json({
                    success: false,
                    message: 'Mikrotik belum dikonfigurasi. Silakan set konfigurasi di halaman Mikrotik terlebih dahulu.'
                });
            }
            
            console.log('Attempting to get hotspot profiles...');
            const profiles = await mikrotik.getHotspotProfiles();
            console.log('Successfully retrieved profiles:', profiles.length);

            res.json({
                success: true,
                data: profiles
            });

        } catch (error) {
            console.error('Error getting hotspot profiles:', error);
            
            let errorMessage = 'Failed to get hotspot profiles from Mikrotik';
            
            if (error.message.includes('authentication') || error.message.includes('login')) {
                errorMessage = 'Authentication failed. Check Mikrotik credentials.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Connection timeout. Check Mikrotik connectivity.';
            } else if (error.message.includes('permission') || error.message.includes('access')) {
                errorMessage = 'User does not have permission to access hotspot profiles. Please check user permissions in Mikrotik.';
            } else if (error.message.includes('no such command')) {
                errorMessage = 'Hotspot service not configured on Mikrotik. Please configure hotspot first.';
            }
            
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: error.message,
                troubleshoot: {
                    steps: [
                        'Check if hotspot service is configured: /ip hotspot print',
                        'Verify user permissions: /user print',
                        'Ensure user has full group access: /user set [username] group=full',
                        'Check hotspot profiles: /ip hotspot user profile print'
                    ]
                }
            });
        }
    }

    // Membuat user hotspot manual
    static async createHotspotUser(req, res) {
        try {
            const { username, password, profile, limitUptime } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            const mikrotik = new MikrotikAPI();
            const comment = `Manual: ${req.user?.username || 'System'} | ${new Date().toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}`;
            
            await mikrotik.createHotspotUser(
                username,
                password,
                profile || 'default',
                limitUptime || '1d',
                comment
            );

            res.json({
                success: true,
                message: 'Hotspot user created successfully',
                data: { username, password, profile: profile || 'default' }
            });

        } catch (error) {
            console.error('Error creating hotspot user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create hotspot user in Mikrotik',
                error: error.message
            });
        }
    }

    // Menghapus user hotspot
    static async deleteHotspotUser(req, res) {
        try {
            const { username } = req.params;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'Username is required'
                });
            }

            const mikrotik = new MikrotikAPI();
            const result = await mikrotik.deleteHotspotUser(username);

            if (result) {
                res.json({
                    success: true,
                    message: 'Hotspot user deleted successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'User not found in Mikrotik'
                });
            }

        } catch (error) {
            console.error('Error deleting hotspot user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete hotspot user from Mikrotik',
                error: error.message
            });
        }
    }

    // Sync users - sinkronisasi antara database dan Mikrotik
    static async syncUsers(req, res) {
        try {
            // This would be a complex operation to sync users between database and Mikrotik
            // For now, we'll just return the current status
            const mikrotik = new MikrotikAPI();
            const mikrotikUsers = await mikrotik.getAllHotspotUsers();

            res.json({
                success: true,
                message: 'User sync information retrieved',
                data: {
                    mikrotik_users_count: mikrotikUsers.length,
                    mikrotik_users: mikrotikUsers
                }
            });

        } catch (error) {
            console.error('Error syncing users:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to sync users',
                error: error.message
            });
        }
    }

    // Mendapatkan sistem info dari Mikrotik
    static async getSystemInfo(req, res) {
        try {
            const mikrotik = new MikrotikAPI();
            await mikrotik.connect();

            // Get system identity
            const identity = await mikrotik.conn.write('/system/identity/print');
            
            // Get system resource info
            const resource = await mikrotik.conn.write('/system/resource/print');
            
            // Get interface info
            const interfaces = await mikrotik.conn.write('/interface/print');

            await mikrotik.disconnect();

            res.json({
                success: true,
                data: {
                    identity: identity[0] || {},
                    resource: resource[0] || {},
                    interfaces: interfaces || []
                }
            });

        } catch (error) {
            console.error('Error getting system info:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system info from Mikrotik',
                error: error.message
            });
        }
    }

    // Disconnect user yang sedang aktif
    static async disconnectActiveUser(req, res) {
        try {
            const { username } = req.params;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'Username is required'
                });
            }

            const mikrotik = new MikrotikAPI();
            await mikrotik.connect();

            // Find active user
            const activeUsers = await mikrotik.getActiveUsers();
            const activeUser = activeUsers.find(user => user.user === username);

            if (!activeUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Active user not found'
                });
            }

            // Disconnect user
            await mikrotik.conn.write('/ip/hotspot/active/remove', [
                `=.id=${activeUser['.id']}`
            ]);

            await mikrotik.disconnect();

            res.json({
                success: true,
                message: 'User disconnected successfully'
            });

        } catch (error) {
            console.error('Error disconnecting user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disconnect user',
                error: error.message
            });
        }
    }
}

module.exports = MikrotikController;