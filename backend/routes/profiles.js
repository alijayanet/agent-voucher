const express = require('express');
const VoucherProfileController = require('../controllers/VoucherProfileController');
const { authenticateToken, requireAgent, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Routes untuk voucher profiles
router.post('/', authenticateToken, requireAdmin, VoucherProfileController.createProfile);
router.get('/active', authenticateToken, VoucherProfileController.getActiveProfiles);
router.get('/stats', authenticateToken, requireAgent, VoucherProfileController.getProfileStats);
router.get('/', authenticateToken, requireAgent, VoucherProfileController.getAllProfiles);
router.get('/:id', authenticateToken, requireAgent, VoucherProfileController.getProfileById);
router.put('/:id', authenticateToken, requireAdmin, VoucherProfileController.updateProfile);
router.patch('/:id/toggle', authenticateToken, requireAdmin, VoucherProfileController.toggleProfileStatus);
router.delete('/:id', authenticateToken, requireAdmin, VoucherProfileController.deleteProfile);
router.post('/initialize-defaults', authenticateToken, requireAdmin, VoucherProfileController.initializeDefaults);
router.post('/import-mikrotik', authenticateToken, requireAdmin, VoucherProfileController.importMikrotikProfiles);

module.exports = router;