const cron = require('node-cron');
const VoucherController = require('../controllers/VoucherController');

class VoucherScheduler {
    static start() {
        console.log('Starting voucher cleanup scheduler...');

        // Jalankan cleanup setiap 1 menit
        cron.schedule('* * * * *', async () => {
            console.log('Running automated voucher cleanup...');
            try {
                // Test koneksi Mikrotik terlebih dahulu
                const MikrotikAPI = require('../config/mikrotik');
                const mikrotik = new MikrotikAPI();

                try {
                    await mikrotik.connect();
                    console.log('Mikrotik connection OK for cleanup');

                    // Buat mock request/response untuk controller
                    const req = {};
                    const res = {
                        json: (data) => console.log('Cleanup result:', data),
                        status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
                    };

                    await VoucherController.cleanupExpiredVouchers(req, res);
                    await mikrotik.disconnect();

                } catch (mikrotikError) {
                    console.log('Mikrotik connection failed for cleanup, skipping:', mikrotikError.message);
                }

            } catch (error) {
                console.error('Automated cleanup error:', error);
            }
        });

        // Jalankan sync dengan Mikrotik setiap 1 menit
        cron.schedule('* * * * *', async () => {
            console.log('Running automated Mikrotik sync...');
            try {
                // Test koneksi Mikrotik terlebih dahulu
                const MikrotikAPI = require('../config/mikrotik');
                const mikrotik = new MikrotikAPI();

                try {
                    await mikrotik.connect();
                    console.log('Mikrotik connection OK for sync');

                    const req = {};
                    const res = {
                        json: (data) => console.log('Sync result:', data),
                        status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
                    };

                    await VoucherController.syncWithMikrotik(req, res);
                    await mikrotik.disconnect();

                } catch (mikrotikError) {
                    console.log('Mikrotik connection failed for sync, skipping:', mikrotikError.message);
                }

            } catch (error) {
                console.error('Automated sync error:', error);
            }
        });

        console.log('Voucher scheduler started successfully');
    }
}

module.exports = VoucherScheduler;