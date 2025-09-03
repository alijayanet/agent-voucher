const express = require('express');
const router = express.Router();
const AgentManagementController = require('../controllers/AgentManagementController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Test endpoints (remove in production) - no auth required
router.get('/test', (req, res) => {
    console.log('🧪 Test endpoint called (no auth)');
    res.json({
        success: true,
        message: 'Agents route is working',
        timestamp: new Date().toISOString(),
        authenticated: !!req.user,
        user: req.user ? req.user.id : 'No user',
        user_role: req.user ? req.user.role : 'No role'
    });
});

// All routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Agent CRUD routes
router.post('/', AgentManagementController.createAgent);
router.get('/', AgentManagementController.getAllAgents);
router.get('/stats', AgentManagementController.getAgentStats);
router.get('/:id', AgentManagementController.getAgentById);
router.put('/:id', AgentManagementController.updateAgent);
router.delete('/:id', AgentManagementController.deleteAgent);
router.put('/:id/password', AgentManagementController.changeAgentPassword);
router.post('/deposit', AgentManagementController.depositAgent);

// Agent registration management routes
router.get('/registrations/pending', AgentManagementController.getPendingRegistrations);
router.post('/registrations/:id/approve', AgentManagementController.approveRegistration);
router.post('/registrations/:id/reject', AgentManagementController.rejectRegistration);

// Get admin phones from config (simple endpoint)
router.get('/admin-phones', (req, res) => {
    const adminPhonesStr = process.env.ADMIN_PHONES || '6281234567890';
    const adminPhones = adminPhonesStr.split(',').map(phone => phone.trim());

    res.json({
        success: true,
        admin_phones: adminPhones,
        count: adminPhones.length,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
