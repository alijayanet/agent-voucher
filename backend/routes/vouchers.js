const express = require('express');
const VoucherController = require('../controllers/VoucherController');
const { authenticateToken, requireAgent, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Routes untuk voucher (perlu autentikasi)
router.post('/create', authenticateToken, requireAgent, VoucherController.createVoucher);
router.post('/sell', authenticateToken, requireAgent, VoucherController.sellVoucher);
router.get('/', authenticateToken, requireAgent, VoucherController.getVouchers);
router.get('/stats', authenticateToken, requireAgent, VoucherController.getStats);
router.get('/:id', authenticateToken, requireAgent, VoucherController.getVoucherById);
router.post('/validate', VoucherController.validateVoucher); // Public endpoint untuk validasi voucher
router.delete('/:id', authenticateToken, requireAgent, VoucherController.deleteVoucher);

// Cleanup dan sync routes (admin only)
router.post('/cleanup-expired', authenticateToken, requireAdmin, VoucherController.cleanupExpiredVouchers);
router.post('/sync-mikrotik', authenticateToken, requireAdmin, VoucherController.syncWithMikrotik);
router.post('/resync-missing', authenticateToken, requireAdmin, VoucherController.resyncMissingVouchers);
router.post('/import-mikrotik-users', authenticateToken, requireAdmin, VoucherController.importMikrotikUsers);
router.post('/full-sync', authenticateToken, requireAdmin, VoucherController.fullSyncWithMikrotik);

// Shared print details endpoint (admin & agent)
router.post('/print-details', authenticateToken, VoucherController.getPrintDetails);

module.exports = router;