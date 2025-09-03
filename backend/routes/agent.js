const express = require('express');
const AgentController = require('../controllers/AgentController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware to ensure only agents can access these routes
const requireAgent = (req, res, next) => {
    if (req.user.role !== 'agent') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya agent yang dapat mengakses fitur ini.'
        });
    }
    next();
};

// All agent routes require authentication and agent role
router.use(authenticateToken);
router.use(requireAgent);

// Get agent dashboard
router.get('/dashboard', AgentController.getDashboard);

// Get agent orders
router.get('/orders', AgentController.getOrders);
// Get order detail
router.get('/orders/:id', AgentController.getOrderDetail);

// Get agent reports
router.get('/reports', AgentController.getReports);

// Generate voucher for agent
router.post('/generate-voucher', AgentController.generateVoucher);

// Request deposit
const DepositRequestController = require('../controllers/DepositRequestController');
router.post('/request-deposit', DepositRequestController.createDepositRequest);
router.get('/deposit-requests', DepositRequestController.getDepositRequests);

// Update agent profile
router.put('/profile', AgentController.updateProfile);

module.exports = router;
