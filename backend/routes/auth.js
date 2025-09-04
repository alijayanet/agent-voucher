const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Public routes (tidak perlu login)
router.post('/login', AuthController.login);

// Protected routes (perlu login)
router.post('/logout', AuthController.logout);
router.get('/me', authenticateToken, AuthController.me);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post('/change-password', authenticateToken, AuthController.changePassword);

// Admin only routes
router.post('/register', authenticateToken, requireAdmin, AuthController.register);
router.get('/users', authenticateToken, requireAdmin, AuthController.getUsers);
router.put('/users/:id', authenticateToken, requireAdmin, AuthController.updateUser);
router.delete('/users/:id', authenticateToken, requireAdmin, AuthController.deleteUser);

// No OTP routes needed anymore - using simple username/password login

module.exports = router;