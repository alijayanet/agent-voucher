const express = require('express');
const DepositRequestController = require('../controllers/DepositRequestController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Deposit Request Management
router.get('/deposit-requests', DepositRequestController.getAllDepositRequests);
router.post('/deposit-requests/approve/:id', DepositRequestController.approveDepositRequest);
router.post('/deposit-requests/reject/:id', DepositRequestController.rejectDepositRequest);

module.exports = router;
