const express = require('express');
const router = express.Router();
const WhatsAppGateway = require('../services/WhatsAppGateway');
const WhatsAppController = require('../controllers/WhatsAppController');

// Get WhatsApp status
router.get('/status', (req, res) => {
    try {
        const wa = WhatsAppGateway.getInstance();
        const status = wa.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting WhatsApp status',
            error: error.message
        });
    }
});

// Initialize WhatsApp connection
router.post('/initialize', WhatsAppController.initializeGateway);

// Get QR code for WhatsApp connection
router.get('/qr-code', (req, res) => {
    try {
        const wa = WhatsAppGateway.getInstance();
        const status = wa.getStatus();
        
        if (status.qrCodeDataUrl) {
            res.json({
                success: true,
                data: {
                    qrCodeDataUrl: status.qrCodeDataUrl,
                    qrCodeText: status.qrCodeText,
                    connectionStatus: status.connectionStatus
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No QR code available. WhatsApp may not be initialized.'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting QR code',
            error: error.message
        });
    }
});

// Reset WhatsApp session
router.post('/reset-session', WhatsAppController.resetSession);

// Disconnect WhatsApp
router.post('/disconnect', WhatsAppController.disconnectGateway);

// Get order history
router.get('/order-history', WhatsAppController.getOrderHistory);

module.exports = router;