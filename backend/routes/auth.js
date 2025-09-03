const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Public routes (tidak perlu login)
router.post('/login', AuthController.login);
router.post('/request-otp', AuthController.requestOTP);
router.post('/login-otp', AuthController.loginWithOTP);

// Protected routes (perlu login)
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.me);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post('/change-password', authenticateToken, AuthController.changePassword);

// Admin only routes
router.post('/register', authenticateToken, requireAdmin, AuthController.register);
router.get('/users', authenticateToken, requireAdmin, AuthController.getUsers);
router.put('/users/:id', authenticateToken, requireAdmin, AuthController.updateUser);
router.delete('/users/:id', authenticateToken, requireAdmin, AuthController.deleteUser);

// OTP Login Settings (2FA) - Admin only
router.post('/otp-login-settings', authenticateToken, requireAdmin, AuthController.saveOTPLoginSettings);
router.get('/otp-login-settings', authenticateToken, requireAdmin, AuthController.getOTPLoginSettings);

// Generate OTP for login (public route for agents)
router.post('/generate-login-otp', AuthController.generateLoginOTP);

module.exports = router;