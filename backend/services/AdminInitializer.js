const UserModel = require('../models/User');
const database = require('../config/database');

class AdminInitializer {
    /**
     * Initialize admin user from environment variables
     */
    static async initializeAdminUser() {
        try {
            console.log('👑 Admin from .env enabled; skip creating admin in DB');

            // Get admin configuration from environment (no DB write)
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@voucherwifi.com';
            const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';

            return {
                username: adminUsername,
                email: adminEmail,
                full_name: adminFullName,
                role: 'admin'
            };

        } catch (error) {
            console.error('❌ Error initializing admin user:', error.message);
            // Don't throw error, just log and continue
            return null;
        }
    }

    /**
     * Check if admin user already exists
     */
    static checkExistingAdmin(username) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE username = ? AND role = 'admin'`;

            database.getDb().get(sql, [username], (err, user) => {
                if (err) {
                    console.error('❌ Error checking existing admin:', err);
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
    }

    /**
     * Update admin user if password or details changed
     */
    static async updateAdminIfNeeded(existingAdmin, newDetails) {
        try {
            // With ENV-based admin, we skip updating DB admin
            console.log('ℹ️ Skipping admin DB update; admin is managed via .env');
            return false;
        } catch (error) {
            console.error('❌ Error updating admin user:', error);
            throw error;
        }
    }

    /**
     * Get admin user info (safe to display)
     */
    static async getAdminInfo() {
        try {
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';

            // Prefer .env values directly
            return {
                id: null,
                username: adminUsername,
                email: process.env.ADMIN_EMAIL || 'admin@voucherwifi.com',
                full_name: process.env.ADMIN_FULL_NAME || 'Administrator',
                role: 'admin',
                created_at: null,
                last_login: null
            };

        } catch (error) {
            console.error('❌ Error getting admin info:', error);
            return null;
        }
    }
}

module.exports = AdminInitializer;
