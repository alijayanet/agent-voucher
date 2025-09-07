const express = require('express');
const OrderController = require('../controllers/OrderController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Public routes
router.post('/create', OrderController.createOrder);
router.post('/:order_id/complete', OrderController.completeOrder);
router.post('/notification', OrderController.handlePaymentNotification);

// Protected routes (admin only)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Not implemented yet'
    });
});

module.exports = router;