const express = require('express');
const router = express.Router();
const WhatsAppController = require('../controllers/WhatsAppController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// WhatsApp Gateway management routes
router.post('/initialize', WhatsAppController.initializeGateway);
router.get('/status', WhatsAppController.getStatus);
router.get('/qr-code', WhatsAppController.getQRCode);
router.post('/test-message', WhatsAppController.sendTestMessage);
router.post('/process-message', WhatsAppController.processIncomingMessage);
router.get('/help', WhatsAppController.getHelpMessage);
router.post('/disconnect', WhatsAppController.disconnectGateway);
router.post('/reset-session', WhatsAppController.resetSession);

// Order history and statistics
router.get('/orders', WhatsAppController.getOrderHistory);
router.get('/agent/:agentId/stats', WhatsAppController.getAgentOrderStats);

// OTP Settings
router.post('/otp-settings', WhatsAppController.saveOTPSettings);
router.get('/otp-settings', WhatsAppController.getOTPSettings);

module.exports = router;
