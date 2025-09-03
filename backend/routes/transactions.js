const express = require('express');
const TransactionController = require('../controllers/TransactionController');
const { authenticateToken, requireAgent } = require('../middleware/auth');
const router = express.Router();

// Routes untuk transactions (perlu autentikasi)
router.get('/', authenticateToken, requireAgent, TransactionController.getTransactions);
router.get('/stats', authenticateToken, requireAgent, TransactionController.getStats);
router.get('/dashboard', authenticateToken, requireAgent, TransactionController.getDashboardStats);
router.get('/reports/daily', authenticateToken, requireAgent, TransactionController.getDailyReport);
router.get('/reports/monthly', authenticateToken, requireAgent, TransactionController.getMonthlyReport);
router.get('/customers/top', authenticateToken, requireAgent, TransactionController.getTopCustomers);
router.get('/:id', authenticateToken, requireAgent, TransactionController.getTransactionById);
router.patch('/:id/status', authenticateToken, requireAgent, TransactionController.updateTransactionStatus);
router.delete('/:id', authenticateToken, requireAgent, TransactionController.deleteTransaction);

module.exports = router;