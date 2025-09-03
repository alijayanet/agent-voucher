const UserModel = require('../models/User');
const database = require('../config/database');

class AdminInitializer {
    /**
     * Initialize admin user from environment variables
     */
    static async initializeAdminUser() {
        try {
            console.log('👑 Initializing admin user from .env...');

            // Get admin configuration from environment
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@voucherwifi.com';
            const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';

            console.log('✅ Admin configuration loaded from .env');
            console.log(`   Username: ${adminUsername}`);
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Full Name: ${adminFullName}`);

            // Simple approach: Always try to create, ignore if exists
            try {
                const adminUser = await UserModel.create({
                    username: adminUsername,
                    password: adminPassword,
                    email: adminEmail,
                    full_name: adminFullName,
                    role: 'admin'
                });

                console.log('✅ Admin user created successfully');
                return adminUser;

            } catch (createError) {
                // If creation fails (probably because user exists), just return success
                console.log('ℹ️ Admin user already exists or creation skipped');
                return {
                    username: adminUsername,
                    email: adminEmail,
                    full_name: adminFullName,
                    role: 'admin'
                };
            }

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
            const bcrypt = require('bcryptjs');
            let needsUpdate = false;
            const updateData = {};

            // Check if password needs update
            if (newDetails.password) {
                const isSamePassword = await bcrypt.compare(newDetails.password, existingAdmin.password);
                if (!isSamePassword) {
                    console.log('🔄 Admin password changed, updating...');
                    updateData.password = bcrypt.hashSync(newDetails.password, 10);
                    needsUpdate = true;
                }
            }

            // Check if other details need update
            if (newDetails.email && newDetails.email !== existingAdmin.email) {
                updateData.email = newDetails.email;
                needsUpdate = true;
            }

            if (newDetails.full_name && newDetails.full_name !== existingAdmin.full_name) {
                updateData.full_name = newDetails.full_name;
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log('🔄 Updating admin user details...');

                const sql = `UPDATE users SET
                    ${updateData.password ? 'password = ?, ' : ''}
                    ${updateData.email ? 'email = ?, ' : ''}
                    ${updateData.full_name ? 'full_name = ?, ' : ''}
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`;

                const params = [];
                if (updateData.password) params.push(updateData.password);
                if (updateData.email) params.push(updateData.email);
                if (updateData.full_name) params.push(updateData.full_name);
                params.push(existingAdmin.id);

                return new Promise((resolve, reject) => {
                    database.getDb().run(sql.replace(/, updated_at/g, 'updated_at'), params, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('✅ Admin user updated successfully');
                            resolve(this.changes > 0);
                        }
                    });
                });
            } else {
                console.log('✅ Admin user is up to date');
            }

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

            const adminUser = await this.checkExistingAdmin(adminUsername);

            if (adminUser) {
                return {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                    full_name: adminUser.full_name,
                    role: adminUser.role,
                    created_at: adminUser.created_at,
                    last_login: adminUser.last_login
                };
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting admin info:', error);
            return null;
        }
    }
}

module.exports = AdminInitializer;
