const RouterOS = require('node-routeros').RouterOSAPI;

class MikrotikAPI {
    constructor() {
        this.conn = null;
        this.config = {
            host: process.env.MIKROTIK_HOST || '192.168.1.1',
            user: process.env.MIKROTIK_USER || 'admin',
            password: process.env.MIKROTIK_PASSWORD || '',
            port: process.env.MIKROTIK_PORT || 8728,
            timeout: 5000
        };
        
        // Log current config
        console.log('🔧 Mikrotik config loaded from .env:', {
            host: this.config.host,
            user: this.config.user,
            port: this.config.port,
            hasPassword: !!this.config.password
        });
    }

    async connect(customConfig = null) {
        try {
            const config = customConfig || this.config;
            
            console.log('🔌 Attempting to connect to Mikrotik...');
            console.log('📡 Connection details:', {
                host: config.host,
                user: config.user,
                port: config.port,
                timeout: config.timeout,
                hasPassword: !!config.password
            });
            
            // Validate config
            if (!config.host) {
                throw new Error('Host Mikrotik belum dikonfigurasi. Silakan set MIKROTIK_HOST di file .env');
            }
            
            if (!config.password) {
                throw new Error('Password Mikrotik belum dikonfigurasi. Silakan set MIKROTIK_PASSWORD di file .env');
            }
            
            this.conn = new RouterOS({
                host: config.host,
                user: config.user,
                password: config.password,
                port: parseInt(config.port) || 8728,
                timeout: config.timeout
            });

            console.log('🔄 Establishing connection...');
            await this.conn.connect();
            console.log('✅ Successfully connected to Mikrotik router');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Mikrotik:', error.message);
            console.error('🔍 Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            this.conn = null;
            throw error;
        }
    }

    async disconnect() {
        if (this.conn) {
            try {
                await this.conn.close();
                console.log('Disconnected from Mikrotik router');
            } catch (error) {
                console.error('Error disconnecting from Mikrotik:', error.message);
            }
        }
    }

    // Membuat user hotspot baru dengan session timeout yang tepat
    async createHotspotUser(username, password, profile = 'default', limitUptime = '1d') {
        try {
            if (!this.conn) {
                await this.connect();
            }

            // Konversi duration ke format yang tepat untuk session-timeout
            const sessionTimeout = this.convertDurationToSessionTimeout(limitUptime);

            const userdata = await this.conn.write('/ip/hotspot/user/add', [
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profile}`,
                `=limit-uptime=${sessionTimeout}` // Timer mulai saat user login
            ]);

            console.log(`Hotspot user created: ${username} with session timeout: ${sessionTimeout}`);
            return userdata;
        } catch (error) {
            console.error('Error creating hotspot user:', error.message);
            throw error;
        }
    }

    // Menghapus user hotspot
    async deleteHotspotUser(username) {
        try {
            if (!this.conn) {
                await this.connect();
            }

            // Cari user berdasarkan nama
            const users = await this.conn.write('/ip/hotspot/user/print', [
                `=where=name=${username}`
            ]);

            if (users.length > 0) {
                const userId = users[0]['.id'];
                await this.conn.write('/ip/hotspot/user/remove', [
                    `=.id=${userId}`
                ]);
                console.log(`Hotspot user deleted: ${username}`);
                return true;
            } else {
                console.log(`User not found: ${username}`);
                return false;
            }
        } catch (error) {
            console.error('Error deleting hotspot user:', error.message);
            throw error;
        }
    }

    // Mendapatkan daftar user aktif
    async getActiveUsers() {
        try {
            if (!this.conn) {
                await this.connect();
            }

            const activeUsers = await this.conn.write('/ip/hotspot/active/print');
            return activeUsers;
        } catch (error) {
            console.error('Error getting active users:', error.message);
            throw error;
        }
    }

    // Mendapatkan daftar semua user hotspot
    async getAllHotspotUsers() {
        try {
            if (!this.conn) {
                await this.connect();
            }

            console.log('Getting all hotspot users...');
            const users = await this.conn.write('/ip/hotspot/user/print');
            console.log('Hotspot users retrieved:', users.length);
            return users;
        } catch (error) {
            console.error('Error getting hotspot users:', error.message);
            
            // If hotspot not configured, return empty array
            if (error.message.includes('no such command') || error.message.includes('not found')) {
                console.log('Hotspot not configured, returning empty users list');
                return [];
            }
            
            throw error;
        }
    }

    // Mendapatkan daftar profile hotspot
    async getHotspotProfiles() {
        try {
            if (!this.conn) {
                await this.connect();
            }

            console.log('Getting hotspot profiles...');
            const profiles = await this.conn.write('/ip/hotspot/user/profile/print');
            console.log('Hotspot profiles retrieved:', profiles.length);
            return profiles;
        } catch (error) {
            console.error('Error getting hotspot profiles:', error.message);
            
            // If profiles don't exist, return default profile
            if (error.message.includes('no such command') || error.message.includes('not found')) {
                console.log('Hotspot not configured, returning default profile');
                return [{
                    '.id': '*1',
                    'name': 'default',
                    'session-timeout': '1d',
                    'idle-timeout': 'none',
                    'rate-limit': ''
                }];
            }
            
            throw error;
        }
    }

    // Test koneksi ke Mikrotik
    async testConnection(customConfig = null) {
        let testConn = null;
        try {
            const config = customConfig || this.config;
            
            // Validasi konfigurasi
            if (!config.host || config.host === '192.168.1.1') {
                return {
                    success: false,
                    message: 'Host Mikrotik belum dikonfigurasi. Silakan set IP address yang benar.'
                };
            }
            
            console.log('Testing Mikrotik connection with config:', {
                host: config.host,
                user: config.user,
                port: config.port,
                timeout: config.timeout
            });
            
            testConn = new RouterOS({
                host: config.host,
                user: config.user,
                password: config.password,
                port: config.port,
                timeout: 3000 // Timeout lebih pendek untuk test
            });
            
            console.log('Attempting to connect...');
            await testConn.connect();
            console.log('Connection established, getting identity...');
            
            const identity = await testConn.write('/system/identity/print');
            console.log('Identity received:', identity);
            
            await testConn.close();
            
            return {
                success: true,
                message: 'Connection successful',
                identity: identity[0] ? identity[0].name : 'Unknown'
            };
        } catch (error) {
            if (testConn) {
                try {
                    await testConn.close();
                } catch (closeError) {
                    // Ignore close error
                }
            }
            
            let errorMessage = 'Connection failed';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Koneksi ditolak. Pastikan IP address benar dan API service aktif di Mikrotik.';
            } else if (error.code === 'EHOSTUNREACH') {
                errorMessage = 'Host tidak dapat dijangkau. Periksa IP address dan koneksi network.';
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = 'Timeout. Periksa IP address dan pastikan port API (8728) terbuka.';
            } else if (error.message.includes('authentication') || error.message.includes('invalid') || error.message.includes('login')) {
                errorMessage = 'Username atau password salah. Pastikan kredensial benar dan user memiliki akses API di Mikrotik.';
            } else if (error.message.includes('ENOTFOUND')) {
                errorMessage = 'Host tidak ditemukan. Periksa IP address Mikrotik.';
            } else {
                errorMessage = `Connection error: ${error.message}`;
            }
            
            console.error('Mikrotik connection error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                message: errorMessage
            };
        }
    }

    // Disconnect user aktif dari hotspot
    async disconnectUser(activeId) {
        try {
            if (!this.conn) {
                await this.connect();
            }

            await this.conn.write('/ip/hotspot/active/remove', [
                `=.id=${activeId}`
            ]);

            console.log(`User disconnected from hotspot: ${activeId}`);
            return true;
        } catch (error) {
            console.error('Error disconnecting user:', error.message);
            throw error;
        }
    }

    // Konversi duration format ke session timeout format
    convertDurationToSessionTimeout(duration) {
        // Input: "1h", "3h", "1d", "7d", "30d"
        // Output: "01:00:00", "03:00:00", "1d 00:00:00", etc.
        
        const match = duration.match(/^(\d+)([hdwm])$/);
        if (!match) {
            return '1d 00:00:00'; // default 1 hari
        }

        const [, amount, unit] = match;
        const numAmount = parseInt(amount);

        switch (unit) {
            case 'h': // hours
                return `${numAmount.toString().padStart(2, '0')}:00:00`;
            case 'd': // days
                return `${numAmount}d 00:00:00`;
            case 'w': // weeks
                return `${numAmount * 7}d 00:00:00`;
            case 'm': // months (approximate as 30 days)
                return `${numAmount * 30}d 00:00:00`;
            default:
                return '1d 00:00:00';
        }
    }
}

module.exports = MikrotikAPI;