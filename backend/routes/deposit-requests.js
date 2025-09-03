const express = require('express');
const DepositRequestController = require('../controllers/DepositRequestController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Agent routes (require authentication)
router.post('/request-deposit', authenticateToken, DepositRequestController.createDepositRequest);
router.get('/my-deposit-requests', authenticateToken, DepositRequestController.getDepositRequests);

// Admin routes (require admin privileges)
router.post('/approve/:id', authenticateToken, requireAdmin, DepositRequestController.approveDepositRequest);
router.post('/reject/:id', authenticateToken, requireAdmin, DepositRequestController.rejectDepositRequest);

module.exports = router;
