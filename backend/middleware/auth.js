const UserModel = require('../models/User');

// Middleware untuk verifikasi token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        // Remove sensitive logging in production
        if (process.env.NODE_ENV !== 'production') {
            console.log('🔐 Auth middleware - Header:', authHeader ? 'Present' : 'Missing');
            console.log('🔐 Auth middleware - Token:', token ? 'Present' : 'Missing');
        }

        if (!token) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('❌ No token provided');
            }
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const verification = await UserModel.verifyToken(token);
        if (process.env.NODE_ENV !== 'production') {
            console.log('🔐 Token verification result:', verification.valid ? 'Valid' : 'Invalid');
        }

        if (!verification.valid) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('❌ Token verification failed:', verification.message);
            }
            return res.status(401).json({
                success: false,
                message: verification.message || 'Invalid token'
            });
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('✅ Token valid for user:', verification.user.username);
        }
        req.user = verification.user;
        next();
    } catch (error) {
        console.error('❌ Authentication error:', error);
        return res.status(403).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// Middleware untuk verifikasi role admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

// Middleware untuk verifikasi role agent atau admin
const requireAgent = (req, res, next) => {
    if (req.user.role !== 'agent' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Agent or admin access required'
        });
    }
    next();
};

// Middleware opsional untuk autentikasi (tidak wajib login)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const verification = await UserModel.verifyToken(token);
            if (verification.valid) {
                req.user = verification.user;
            }
        }
        
        next();
    } catch (error) {
        // Jika error, lanjutkan tanpa user
        next();
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireAgent,
    optionalAuth
};