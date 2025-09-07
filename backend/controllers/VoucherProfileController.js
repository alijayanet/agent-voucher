const VoucherProfileModel = require('../models/VoucherProfile');

class VoucherProfileController {
    // Membuat profile voucher baru
    static async createProfile(req, res) {
        try {
            const { name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, voucher_code_length } = req.body;

            // Validasi input
            if (!name || !duration || !agent_price || !selling_price || !mikrotik_profile_name) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, duration, agent_price, selling_price, and mikrotik_profile_name are required'
                });
            }

            // Check if profile name already exists
            const existingProfile = await VoucherProfileModel.getByName(name);
            if (existingProfile) {
                return res.status(409).json({
                    success: false,
                    message: 'Profile name already exists'
                });
            }

            const profile = await VoucherProfileModel.create({
                name,
                duration,
                bandwidth_limit,
                data_limit,
                agent_price,
                selling_price,
                mikrotik_profile_name,
                description,
                voucher_code_length
            });

            res.status(201).json({
                success: true,
                message: 'Profile created successfully',
                data: profile
            });

        } catch (error) {
            console.error('Error creating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan semua profile aktif
    static async getActiveProfiles(req, res) {
        try {
            const profiles = await VoucherProfileModel.getActive();

            res.json({
                success: true,
                data: profiles
            });

        } catch (error) {
            console.error('Error getting active profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan semua profile dengan pagination
    static async getAllProfiles(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            const result = await VoucherProfileModel.getAll(page, limit);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error getting profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan profile berdasarkan ID
    static async getProfileById(req, res) {
        try {
            const { id } = req.params;
            const profile = await VoucherProfileModel.getById(id);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            res.json({
                success: true,
                data: profile
            });

        } catch (error) {
            console.error('Error getting profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update profile
    static async updateProfile(req, res) {
        try {
            const { id } = req.params;
            const { name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, is_active, voucher_code_length } = req.body;

            // Check if profile exists
            const existingProfile = await VoucherProfileModel.getById(id);
            if (!existingProfile) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            // Check if new name conflicts with existing profile (except current one)
            if (name && name !== existingProfile.name) {
                const nameConflict = await VoucherProfileModel.getByName(name);
                if (nameConflict) {
                    return res.status(409).json({
                        success: false,
                        message: 'Profile name already exists'
                    });
                }
            }

            const result = await VoucherProfileModel.update(id, {
                name: name || existingProfile.name,
                duration: duration || existingProfile.duration,
                bandwidth_limit: bandwidth_limit || existingProfile.bandwidth_limit,
                data_limit: data_limit || existingProfile.data_limit,
                agent_price: agent_price || existingProfile.agent_price,
                selling_price: selling_price || existingProfile.selling_price,
                mikrotik_profile_name: mikrotik_profile_name || existingProfile.mikrotik_profile_name,
                description: description || existingProfile.description,
                is_active: is_active !== undefined ? is_active : existingProfile.is_active,
                voucher_code_length: voucher_code_length || existingProfile.voucher_code_length || 4
            });

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            res.json({
                success: true,
                message: 'Profile updated successfully'
            });

        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Toggle status aktif profile
    static async toggleProfileStatus(req, res) {
        try {
            const { id } = req.params;

            const result = await VoucherProfileModel.toggleActive(id);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            res.json({
                success: true,
                message: 'Profile status toggled successfully'
            });

        } catch (error) {
            console.error('Error toggling profile status:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Menghapus profile
    static async deleteProfile(req, res) {
        try {
            const { id } = req.params;

            const result = await VoucherProfileModel.delete(id);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            res.json({
                success: true,
                message: 'Profile deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting profile:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Get public voucher profiles (active only)
    static async getPublicProfiles(req, res) {
        try {
            const profiles = await VoucherProfileModel.getPublicProfiles();
            
            res.json({
                success: true,
                profiles: profiles
            });
        } catch (error) {
            console.error('Error getting public profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Import profiles dari Mikrotik ke database
    static async importMikrotikProfiles(req, res) {
        try {
            const result = await this.importMikrotikProfilesInternal();
            res.json({
                success: true,
                message: `Import completed. ${result.imported} profiles imported, ${result.skipped} skipped.`,
                data: result
            });
        } catch (error) {
            console.error('Error importing Mikrotik profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during import',
                error: error.message
            });
        }
    }

    // Internal method untuk import profiles (dapat dipanggil dari controller lain)
    static async importMikrotikProfilesInternal() {
        const MikrotikAPI = require('../config/mikrotik');
        const mikrotik = new MikrotikAPI();
        let importedCount = 0;
        let skippedCount = 0;
        let errors = [];

        try {
            // Get all hotspot profiles from Mikrotik
            const mikrotikProfiles = await mikrotik.getHotspotProfiles();
            
            if (!mikrotikProfiles || mikrotikProfiles.length === 0) {
                return { imported: 0, skipped: 0, errors: ['No profiles found in Mikrotik'] };
            }

            for (const profile of mikrotikProfiles) {
                try {
                    // Skip default system profiles or profiles without names
                    if (!profile.name || profile.name === 'default-encryption') {
                        skippedCount++;
                        continue;
                    }

                    // Check if profile already exists in database
                    const existingProfile = await VoucherProfileModel.getByName(profile.name);
                    if (existingProfile) {
                        skippedCount++;
                        errors.push(`Profile ${profile.name} already exists`);
                        continue;
                    }

                    // Convert Mikrotik session-timeout to our duration format
                    let duration = '24h'; // default
                    if (profile['session-timeout']) {
                        duration = this.convertSessionTimeoutToHours(profile['session-timeout']);
                    }

                    // Extract bandwidth limits
                    let bandwidth_limit = null;
                    if (profile['rate-limit']) {
                        bandwidth_limit = profile['rate-limit'];
                    }

                    // Set default agent_price based on duration
                    let agent_price = this.calculateDefaultPrice(duration);

                    // Create profile in database
                    const newProfile = await VoucherProfileModel.create({
                        name: profile.name,
                        duration: duration,
                        bandwidth_limit: bandwidth_limit,
                        data_limit: null, // Mikrotik doesn't have direct data limit in profile
                        agent_price: agent_price,
                        selling_price: agent_price, // Set selling_price sama dengan agent_price untuk default
                        mikrotik_profile_name: profile.name, // Set mikrotik_profile_name untuk referensi
                        description: `Imported from Mikrotik - ${profile.name}`,
                        is_active: true
                    });

                    importedCount++;
                    
                } catch (profileError) {
                    console.error(`Error importing profile ${profile.name}:`, profileError);
                    errors.push(`Error importing ${profile.name}: ${profileError.message}`);
                    skippedCount++;
                }
            }

            return {
                imported: importedCount,
                skipped: skippedCount,
                total_processed: mikrotikProfiles.length,
                errors: errors.length > 0 ? errors.slice(0, 10) : []
            };

        } catch (mikrotikError) {
            console.error('Mikrotik connection error:', mikrotikError);
            throw new Error(`Failed to connect to Mikrotik: ${mikrotikError.message}`);
        }
    }

    // Helper method untuk convert session-timeout ke hours format
    static convertSessionTimeoutToHours(sessionTimeout) {
        if (!sessionTimeout) return '24h';
        
        const timeStr = sessionTimeout.toString();
        
        // Jika sudah dalam format time (00:01:00)
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length >= 2) {
                const hours = parseInt(parts[0]) || 0;
                const minutes = parseInt(parts[1]) || 0;
                const totalHours = hours + (minutes / 60);
                return `${Math.max(1, Math.round(totalHours))}h`;
            }
        }
        
        // Jika dalam format detik
        const seconds = parseInt(timeStr);
        if (!isNaN(seconds)) {
            const hours = Math.max(1, Math.round(seconds / 3600));
            return `${hours}h`;
        }
        
        return '24h'; // default
    }

    // Helper method untuk menghitung harga default berdasarkan durasi
    static calculateDefaultPrice(duration) {
        const durationStr = duration.toLowerCase();
        const hours = parseInt(durationStr.replace('h', ''));
        
        if (hours <= 1) return 3000;
        if (hours <= 3) return 5000;
        if (hours <= 6) return 8000;
        if (hours <= 12) return 12000;
        if (hours <= 24) return 15000;
        if (hours <= 72) return 35000; // 3 days
        if (hours <= 168) return 50000; // 1 week
        
        return 75000; // 1 month or more
    }

    // Initialize default profiles
    static async initializeDefaults(req, res) {
        try {
            const result = await VoucherProfileModel.insertDefaults();

            if (result) {
                res.json({
                    success: true,
                    message: 'Default profiles initialized successfully'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to initialize default profiles'
                });
            }

        } catch (error) {
            console.error('Error initializing default profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Import Mikrotik hotspot profiles ke database
    static async importMikrotikProfiles(req, res) {
        try {
            const MikrotikAPI = require('../config/mikrotik');
            const mikrotik = new MikrotikAPI();
            await mikrotik.connect();

            // Get hotspot profiles from Mikrotik
            const mikrotikProfiles = await mikrotik.getHotspotProfiles();
            
            let importedCount = 0;
            let skippedCount = 0;
            let errors = [];

            for (const profile of mikrotikProfiles) {
                try {
                    // Skip default profile dan yang sudah ada
                    if (profile.name === 'default' || profile.name === 'default-encryption') {
                        skippedCount++;
                        continue;
                    }

                    // Check if profile already exists
                    const existingProfile = await VoucherProfileModel.getByName(profile.name);
                    if (existingProfile) {
                        skippedCount++;
                        continue;
                    }

                    // Parse duration dari session-timeout
                    let duration = '1d'; // default
                    if (profile['session-timeout']) {
                        // Convert dari format Mikrotik ke format aplikasi
                        const sessionTimeout = profile['session-timeout'];
                        if (sessionTimeout.includes('h')) {
                            duration = sessionTimeout.replace('h', 'h');
                        } else if (sessionTimeout.includes('d')) {
                            duration = sessionTimeout.replace('d', 'd');
                        }
                    }

                    // Tentukan harga default berdasarkan durasi (bisa disesuaikan)
                    let defaultPrice = 5000;
                    if (duration.includes('h')) {
                        const hours = parseInt(duration);
                        defaultPrice = hours * 3000; // Rp 3000 per jam
                    } else if (duration.includes('d')) {
                        const days = parseInt(duration);
                        defaultPrice = days * 15000; // Rp 15000 per hari
                    }

                    // Create profile di database
                    await VoucherProfileModel.create({
                        name: profile.name,
                        duration: duration,
                        bandwidth_limit: profile['rate-limit'] || null,
                        data_limit: null, // Mikrotik biasanya tidak set data limit di profile
                        agent_price: defaultPrice,
                        selling_price: defaultPrice, // Set selling_price sama dengan agent_price untuk default
                        description: `Imported from Mikrotik - ${profile.name}`
                    });

                    importedCount++;
                    console.log(`Imported profile ${profile.name} from Mikrotik`);
                } catch (profileError) {
                    errors.push({
                        profile: profile.name,
                        error: profileError.message
                    });
                }
            }

            await mikrotik.disconnect();

            res.json({
                success: true,
                message: `Import profile selesai! ${importedCount} profile berhasil diimpor dari Mikrotik`,
                data: {
                    importedCount,
                    skippedCount,
                    totalMikrotikProfiles: mikrotikProfiles.length,
                    errors
                }
            });

        } catch (error) {
            console.error('Error importing Mikrotik profiles:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to import profiles from Mikrotik',
                error: error.message
            });
        }
    }
    static async getProfileStats(req, res) {
        try {
            const stats = await VoucherProfileModel.getStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error getting profile stats:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = VoucherProfileController;