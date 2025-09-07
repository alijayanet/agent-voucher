const express = require('express');
const VoucherProfileController = require('../controllers/VoucherProfileController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Public routes
router.get('/public', VoucherProfileController.getPublicProfiles);

// Protected routes (admin only)
router.get('/', authenticateToken, requireAdmin, VoucherProfileController.getAllProfiles);
router.get('/active', authenticateToken, requireAdmin, VoucherProfileController.getActiveProfiles);
router.get('/:id', authenticateToken, requireAdmin, VoucherProfileController.getProfileById);
router.post('/', authenticateToken, requireAdmin, VoucherProfileController.createProfile);
router.put('/:id', authenticateToken, requireAdmin, VoucherProfileController.updateProfile);
router.delete('/:id', authenticateToken, requireAdmin, VoucherProfileController.deleteProfile);

module.exports = router;