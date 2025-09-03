const express = require('express');
const MikrotikController = require('../controllers/MikrotikController');
const { authenticateToken, requireAgent, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Routes untuk konfigurasi Mikrotik (Admin only)
router.post('/config', authenticateToken, requireAdmin, MikrotikController.saveConfig);
router.get('/config', authenticateToken, requireAgent, MikrotikController.getConfig);

// Routes untuk Mikrotik (perlu autentikasi)
router.get('/test-connection', authenticateToken, requireAgent, MikrotikController.testConnection);
router.get('/users/active', authenticateToken, requireAgent, MikrotikController.getActiveUsers);
router.get('/users/hotspot', authenticateToken, requireAgent, MikrotikController.getAllHotspotUsers);
router.get('/profiles', authenticateToken, requireAgent, MikrotikController.getHotspotProfiles);
router.get('/system-info', authenticateToken, requireAgent, MikrotikController.getSystemInfo);
router.post('/users/create', authenticateToken, requireAgent, MikrotikController.createHotspotUser);
router.delete('/users/:username', authenticateToken, requireAgent, MikrotikController.deleteHotspotUser);
router.post('/users/:username/disconnect', authenticateToken, requireAgent, MikrotikController.disconnectActiveUser);
router.get('/sync', authenticateToken, requireAgent, MikrotikController.syncUsers);

module.exports = router;