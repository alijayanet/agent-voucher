const database = require('../config/database');

class VoucherProfileModel {
    // Membuat profile voucher baru
    static async create(profileData) {
        const { name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, voucher_code_length } = profileData;
        
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO voucher_profiles (name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, voucher_code_length)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            database.getDb().run(sql, [name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, voucher_code_length || 4], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            name,
                            duration,
                            bandwidth_limit,
                            data_limit,
                            agent_price,
                            selling_price,
                            mikrotik_profile_name,
                            description,
                            voucher_code_length: voucher_code_length || 4,
                            is_active: true
                        });
                    }
                });
        });
    }

    // Mendapatkan profile berdasarkan ID
    static async getById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM voucher_profiles WHERE id = ?`;
            
            database.getDb().get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Mendapatkan profile berdasarkan nama
    static async getByName(name) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM voucher_profiles WHERE name = ?`;
            
            database.getDb().get(sql, [name], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Mendapatkan semua profile aktif
    static async getActive() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM voucher_profiles WHERE is_active = TRUE ORDER BY agent_price ASC`;

            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Mendapatkan profile aktif untuk agent (format sederhana)
    static async getActiveForAgent() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, duration, agent_price, is_active FROM voucher_profiles WHERE is_active = 1 ORDER BY agent_price ASC`;

            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('🔍 VoucherProfile.getActiveForAgent - Raw results:', rows.length);
                    rows.forEach((row, index) => {
                        console.log(`   ${index + 1}. ${row.name} - is_active: ${row.is_active} (${typeof row.is_active})`);
                    });

                    // Filter again to ensure only active profiles
                    const activeRows = rows.filter(row => {
                        const isActive = row.is_active === 1 || row.is_active === true || row.is_active === '1';
                        console.log(`   Filtering ${row.name}: ${row.is_active} -> ${isActive}`);
                        return isActive;
                    });

                    console.log('✅ Filtered active profiles:', activeRows.length);
                    resolve(activeRows);
                }
            });
        });
    }

    // Get public voucher profiles (active only)
    static async getPublicProfiles() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, duration, agent_price, selling_price, mikrotik_profile_name, description 
                        FROM voucher_profiles 
                        WHERE is_active = TRUE 
                        ORDER BY selling_price ASC`;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Mendapatkan semua profile dengan pagination
    static async getAll(page = 1, limit = 10) {
        return new Promise((resolve, reject) => {
            const countSql = `SELECT COUNT(*) as total FROM voucher_profiles`;
            const sql = `SELECT * FROM voucher_profiles ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            
            // Get total count
            database.getDb().get(countSql, [], (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get profiles
                database.getDb().all(sql, [limit, (page - 1) * limit], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            profiles: rows,
                            total: countResult.total,
                            page: page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }

    // Update profile
    static async update(id, profileData) {
        const { name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, is_active, voucher_code_length } = profileData;
        
        return new Promise((resolve, reject) => {
            const sql = `UPDATE voucher_profiles 
                        SET name = ?, duration = ?, bandwidth_limit = ?, data_limit = ?, 
                            agent_price = ?, selling_price = ?, mikrotik_profile_name = ?, description = ?, is_active = ?, voucher_code_length = ?
                        WHERE id = ?`;
            
            database.getDb().run(sql, [name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, is_active, voucher_code_length || 4, id], 
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
        });
    }

    // Mengaktifkan/menonaktifkan profile
    static async toggleActive(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE voucher_profiles SET is_active = NOT is_active WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Menghapus profile
    static async delete(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM voucher_profiles WHERE id = ?`;
            
            database.getDb().run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Insert default profiles
    static async insertDefaults() {
        const defaultProfiles = [
            {
                name: '1 Jam',
                duration: '1h',
                bandwidth_limit: '2M/1M',
                data_limit: '100MB',
                agent_price: 3000,
                selling_price: 5000,
                mikrotik_profile_name: '1JAM',
                description: 'Paket internet 1 jam dengan kecepatan 2Mbps download dan 1Mbps upload'
            },
            {
                name: '3 Jam',
                duration: '3h',
                bandwidth_limit: '2M/1M',
                data_limit: '300MB',
                agent_price: 8000,
                selling_price: 12000,
                mikrotik_profile_name: '3JAM',
                description: 'Paket internet 3 jam dengan kecepatan 2Mbps download dan 1Mbps upload'
            },
            {
                name: '1 Hari',
                duration: '1d',
                bandwidth_limit: '3M/1M',
                data_limit: '1GB',
                agent_price: 15000,
                selling_price: 20000,
                mikrotik_profile_name: '1HARI',
                description: 'Paket internet 1 hari dengan kecepatan 3Mbps download dan 1Mbps upload'
            },
            {
                name: '1 Minggu',
                duration: '7d',
                bandwidth_limit: '5M/2M',
                data_limit: '5GB',
                agent_price: 60000,
                selling_price: 75000,
                mikrotik_profile_name: '1MINGGU',
                description: 'Paket internet 1 minggu dengan kecepatan 5Mbps download dan 2Mbps upload'
            },
            {
                name: '1 Bulan',
                duration: '30d',
                bandwidth_limit: '10M/5M',
                data_limit: '20GB',
                agent_price: 200000,
                selling_price: 250000,
                mikrotik_profile_name: '1BULAN',
                description: 'Paket internet 1 bulan dengan kecepatan 10Mbps download dan 5Mbps upload'
            }
        ];

        try {
            for (const profile of defaultProfiles) {
                const existing = await this.getByName(profile.name);
                if (!existing) {
                    await this.create(profile);
                }
            }
            return true;
        } catch (error) {
            console.error('Error inserting default profiles:', error);
            return false;
        }
    }

    // Mendapatkan statistik profile
    static async getStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    vp.name,
                    vp.selling_price as price,
                    (vp.selling_price - vp.agent_price) as margin,
                    COUNT(v.id) as total_vouchers_sold,
                    SUM(CASE WHEN v.is_used = TRUE THEN vp.selling_price ELSE 0 END) as revenue
                FROM voucher_profiles vp
                LEFT JOIN vouchers v ON vp.name = v.profile
                WHERE vp.is_active = TRUE
                GROUP BY vp.id, vp.name, vp.selling_price, vp.agent_price
                ORDER BY revenue DESC
            `;
            
            database.getDb().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = VoucherProfileModel;