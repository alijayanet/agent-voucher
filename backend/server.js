// Load environment variables first
const dotenv = require('dotenv');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.env');
const result = dotenv.config({ path: configPath });

if (result.error) {
    console.error('❌ Error loading config.env:', result.error);
    console.error('🔍 Attempted path:', configPath);
} else {
    console.log('✅ config.env loaded successfully from:', configPath);
    console.log('🔧 Environment variables:', {
        MIKROTIK_HOST: process.env.MIKROTIK_HOST,
        MIKROTIK_USER: process.env.MIKROTIK_USER,
        MIKROTIK_PORT: process.env.MIKROTIK_PORT,
        MIKROTIK_PASSWORD: process.env.MIKROTIK_PASSWORD ? '***SET***' : 'NOT SET'
    });
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import routes
const authRoutes = require('./routes/auth');
const voucherRoutes = require('./routes/vouchers');
const profileRoutes = require('./routes/profiles');
const transactionRoutes = require('./routes/transactions');
const mikrotikRoutes = require('./routes/mikrotik');
const agentManagementRoutes = require('./routes/agents');
const whatsappRoutes = require('./routes/whatsapp');
const agentDashboardRoutes = require('./routes/agent-dashboard');

// Import database to initialize
const database = require('./config/database');
const { migrateDatabase } = require('./config/migrate');
const VoucherProfileModel = require('./models/VoucherProfile');
const UserModel = require('./models/User');
const VoucherScheduler = require('./services/VoucherScheduler');
const AdminInitializer = require('./services/AdminInitializer');
const WhatsAppGateway = require('./services/WhatsAppGateway');

const app = express();
const PORT = process.env.PORT || 3000; // Default to 3000

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3010',
    credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentManagementRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/mikrotik', mikrotikRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/agent', agentDashboardRoutes);
app.use('/api/admin', require('./routes/admin'));

// Print voucher page route
app.get('/print-vouchers.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'print-vouchers.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Mikrotik Voucher WiFi API is running',
        timestamp: new Date().toISOString()
    });
});

// Test Mikrotik connection endpoint (without auth for testing)
app.get('/api/test-mikrotik-direct', async (req, res) => {
    try {
        const MikrotikAPI = require('./config/mikrotik');
        const mikrotik = new MikrotikAPI();

        console.log('🔧 Testing Mikrotik connection directly...');

        const result = await mikrotik.testConnection();

        res.json({
            success: result.success,
            message: result.message,
            identity: result.identity || null,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error testing Mikrotik connection:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint - serve HTML dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Agent dashboard endpoint
app.get('/agent-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'agent-dashboard.html'));
});

// Agent login endpoint
app.get('/agent-login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'agent-login.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    console.error('Error stack:', err.stack);

    // Don't crash the server on errors
    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

// Initialize default data
async function initializeData() {
    try {
        console.log('🔄 Running database migration...');
        await migrateDatabase();

        console.log('✅ Database migration completed');

        // Initialize admin user from .env
        console.log('👑 Initializing admin user...');
        const adminUser = await AdminInitializer.initializeAdminUser();

        console.log('📝 Note: Voucher profiles should be created by admin via dashboard');
        console.log('🔧 Use "Load Default" button in admin dashboard to create initial profiles');
        if (adminUser) {
            console.log('👑 Admin user ready:', adminUser.username);
        }

        return true; // Success
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        throw error; // Re-throw to be caught by caller
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Mikrotik Voucher WiFi API server running on port ${PORT}`);
    console.log(`📱 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);

    // Initialize default data synchronously
    try {
        await initializeData();
        console.log('✅ Server initialization completed successfully');

        // Initialize WhatsApp Gateway automatically
        try {
            const wa = WhatsAppGateway.getInstance();
            await wa.initialize();
            console.log('📲 WhatsApp Gateway auto-started');
        } catch (waError) {
            console.error('❌ Failed to auto-start WhatsApp Gateway:', waError);
        }
    } catch (error) {
        console.error('❌ Error during server initialization:', error);
        process.exit(1);
    }

    // Start automated scheduler
    setTimeout(() => {
        console.log('🕐 Starting automated voucher scheduler...');
        VoucherScheduler.start();
    }, 5000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    database.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    database.close();
    process.exit(0);
});

module.exports = app;