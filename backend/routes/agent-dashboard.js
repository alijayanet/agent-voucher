const express = require('express');
const AgentController = require('../controllers/AgentController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware to ensure only agents (and admin for testing) can access these routes
const requireAgent = (req, res, next) => {
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya agent yang dapat mengakses fitur ini.'
        });
    }
    next();
};

// All agent dashboard routes require authentication and agent role
router.use(authenticateToken);
router.use(requireAgent);

// Get agent dashboard
router.get('/dashboard', AgentController.getDashboard);

// Get agent orders
router.get('/orders', AgentController.getOrders);
// Get single agent order detail
router.get('/orders/:id', AgentController.getOrderDetail);

// Get agent reports
router.get('/reports', AgentController.getReports);

// Generate voucher for agent
router.post('/generate-voucher', AgentController.generateVoucher);

// Get voucher profiles for agent
router.get('/profiles', AgentController.getProfiles);

// Update agent profile
router.put('/profile', AgentController.updateProfile);


// Debug endpoint for testing profiles
router.get('/debug-profiles', async (req, res) => {
    try {
        console.log('🔧 DEBUG ENDPOINT: Getting all profiles from database');

        const VoucherProfileModel = require('../models/VoucherProfile');

        // Get all profiles (not just active ones)
        const allProfiles = await new Promise((resolve, reject) => {
            const database = require('../config/database');
            database.getDb().all('SELECT * FROM voucher_profiles ORDER BY id', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📊 Found ${allProfiles.length} total profiles in database`);

        // Get active profiles using model method
        console.log('📦 Calling VoucherProfileModel.getActiveForAgent...');
        const activeProfiles = await VoucherProfileModel.getActiveForAgent();
        console.log(`✅ Model returned ${activeProfiles.length} active profiles`);

        res.json({
            success: true,
            debug: {
                total_profiles_in_db: allProfiles.length,
                active_profiles_from_model: activeProfiles.length,
                all_profiles: allProfiles,
                active_profiles: activeProfiles
            }
        });

    } catch (error) {
        console.error('❌ Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get voucher details for printing
router.post('/vouchers/details', requireAgent, async (req, res) => {
    try {
        console.log('🎫 Getting voucher details for printing');
        const { voucherIds } = req.body;
        const agentId = req.user.id;

        if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Voucher IDs harus disediakan'
            });
        }

        // Get voucher details
        const database = require('../config/database');
        const placeholders = voucherIds.map(() => '?').join(',');
        const sql = `
            SELECT v.id, v.username, v.password, v.profile, v.duration, v.customer_name, v.created_at,
                   v.agent_price, COALESCE(vp.selling_price, NULL) AS selling_price
            FROM vouchers v
            LEFT JOIN voucher_profiles vp ON vp.name = v.profile
            WHERE v.id IN (${placeholders}) AND (v.agent_id = ? OR v.agent_id IS NULL)
            ORDER BY v.created_at DESC
        `;

        const params = [...voucherIds, agentId];

        database.getDb().all(sql, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Gagal mengambil data voucher'
                });
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Tidak ada voucher ditemukan'
                });
            }

            console.log(`✅ Found ${rows.length} vouchers for printing`);

            res.json({
                success: true,
                vouchers: rows,
                printData: {
                    totalVouchers: rows.length,
                    printedAt: new Date().toISOString(),
                    agentId: agentId
                }
            });
        });

    } catch (error) {
        console.error('Error getting voucher details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Debug endpoint for testing voucher generation
router.post('/debug-generate-voucher', async (req, res) => {
    try {
        console.log('🎯 DEBUG VOUCHER GENERATION ENDPOINT');
        console.log('📋 Request body:', req.body);
        console.log('👤 Agent ID:', req.user?.id);

        const { profileId, quantity = 1, customerName = 'Debug Test' } = req.body;

        // Simulate the generateVoucher process step by step
        const agentId = req.user.id;
        const UserModel = require('../models/User');
        const VoucherProfileModel = require('../models/VoucherProfile');

        console.log('👤 Step 1: Getting agent info...');
        const agent = await UserModel.findById(agentId);
        console.log('👤 Agent found:', !!agent, 'Balance:', agent?.balance);

        console.log('📦 Step 2: Getting profile...');
        const profile = await VoucherProfileModel.getById(profileId);
        console.log('📦 Profile found:', !!profile, 'Active:', profile?.is_active);

        if (!profile || !profile.is_active) {
            return res.json({
                success: false,
                step: 'profile_check',
                message: 'Profile not found or not active',
                profile: profile
            });
        }

        console.log('💰 Step 3: Checking balance...');
        const totalCost = profile.agent_price * quantity;
        console.log('💰 Total cost:', totalCost, 'Balance:', agent.balance);

        if (agent.balance < totalCost) {
            return res.json({
                success: false,
                step: 'balance_check',
                message: 'Insufficient balance',
                required: totalCost,
                available: agent.balance
            });
        }

        console.log('🎫 Step 4: Generating voucher...');
        const voucher = await require('../controllers/AgentController').createSingleVoucher(profile, agentId, customerName);
        console.log('🎫 Voucher created:', !!voucher);

        if (!voucher) {
            return res.json({
                success: false,
                step: 'voucher_creation',
                message: 'Failed to create voucher'
            });
        }

        console.log('💸 Step 5: Deducting balance...');
        const deductResult = await UserModel.deductBalance(agentId, totalCost);
        console.log('💸 Balance deducted:', deductResult);

        console.log('📝 Step 6: Creating transaction...');
        const transaction = await require('../controllers/AgentController').createVoucherTransaction(agentId, [voucher], profile, totalCost, customerName);
        console.log('📝 Transaction created');

        res.json({
            success: true,
            message: 'Voucher generated successfully via debug endpoint',
            voucher: {
                id: voucher.id,
                username: voucher.username,
                password: voucher.password,
                profile: profile.name,
                duration: profile.duration
            },
            cost: totalCost,
            steps_completed: ['agent_check', 'profile_check', 'balance_check', 'voucher_creation', 'balance_deduction', 'transaction_creation']
        });

    } catch (error) {
        console.error('💥 DEBUG ENDPOINT ERROR:', error);
        console.error('📊 Error message:', error.message);
        console.error('📊 Error stack:', error.stack);

        res.status(500).json({
            success: false,
            message: 'Debug endpoint error',
            error: error.message,
            stack: error.stack,
            code: error.code
        });
    }
});

module.exports = router;
