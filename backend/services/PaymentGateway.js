const crypto = require('crypto');
const axios = require('axios');

class PaymentGateway {
    constructor() {
        // Load configuration from environment variables
        this.midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
        this.midtransClientKey = process.env.MIDTRANS_CLIENT_KEY || '';
        this.xenditSecretKey = process.env.XENDIT_SECRET_KEY || '';
        this.tripayApiKey = process.env.TRIPAY_API_KEY || '';
        this.tripayPrivateKey = process.env.TRIPAY_PRIVATE_KEY || '';
        this.tripayMerchantCode = process.env.TRIPAY_MERCHANT_CODE || '';
        this.isSandbox = process.env.PAYMENT_SANDBOX === 'true' || process.env.TRIPAY_SANDBOX === 'true';
        this.midtransUrl = this.isSandbox 
            ? 'https://api.sandbox.midtrans.com' 
            : 'https://api.midtrans.com';
        this.xenditUrl = 'https://api.xendit.co';
        this.tripayUrl = this.isSandbox 
            ? 'https://tripay.co.id/api-sandbox' 
            : 'https://tripay.co.id/api';
    }

    /**
     * Create a payment transaction
     * @param {Object} orderData - Order information
     * @returns {Object} Payment transaction details
     */
    async createTransaction(orderData) {
        try {
            // Check which payment gateway is configured
            if (this.midtransServerKey) {
                return await this.createMidtransTransaction(orderData);
            } else if (this.xenditSecretKey) {
                return await this.createXenditTransaction(orderData);
            } else if (this.tripayApiKey && this.tripayPrivateKey && this.tripayMerchantCode) {
                return await this.createTripayTransaction(orderData);
            } else {
                // Fallback to simulation if no payment gateway configured
                return await this.createSimulationTransaction(orderData);
            }
        } catch (error) {
            console.error('Payment gateway error:', error);
            throw new Error('Failed to create payment transaction: ' + error.message);
        }
    }

    /**
     * Create a Midtrans transaction
     * @param {Object} orderData - Order information
     * @returns {Object} Midtrans transaction details
     */
    async createMidtransTransaction(orderData) {
        try {
            const payload = {
                transaction_details: {
                    order_id: orderData.order_id,
                    gross_amount: orderData.amount
                },
                customer_details: {
                    first_name: orderData.customer_name,
                    phone: orderData.customer_phone
                },
                item_details: [
                    {
                        id: orderData.profile_name,
                        price: orderData.amount,
                        quantity: 1,
                        name: `${orderData.profile_name} (${orderData.profile_duration})`
                    }
                ]
            };

            const response = await axios.post(`${this.midtransUrl}/v2/charge`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(this.midtransServerKey + ':').toString('base64')}`
                }
            });

            return {
                success: true,
                transaction_id: response.data.transaction_id,
                payment_url: response.data.redirect_url,
                gross_amount: response.data.gross_amount,
                currency: 'IDR',
                order_id: orderData.order_id,
                customer_details: {
                    first_name: orderData.customer_name,
                    phone: orderData.customer_phone
                }
            };
        } catch (error) {
            console.error('Midtrans transaction error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a Xendit transaction
     * @param {Object} orderData - Order information
     * @returns {Object} Xendit transaction details
     */
    async createXenditTransaction(orderData) {
        try {
            // Generate a more realistic email address if customer email is not provided
            const customerEmail = orderData.customer_email || 
                (orderData.customer_phone ? 
                    `${orderData.customer_name.replace(/\s+/g, '.').toLowerCase()}@gantiwifi.online` : 
                    'customer@gantiwifi.online');
            
            const payload = {
                external_id: orderData.order_id,
                amount: orderData.amount,
                payer_email: customerEmail,
                description: `${orderData.profile_name} (${orderData.profile_duration})`
            };

            const response = await axios.post(`${this.xenditUrl}/v2/invoices`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(this.xenditSecretKey + ':').toString('base64')}`
                }
            });

            return {
                success: true,
                transaction_id: response.data.id,
                payment_url: response.data.invoice_url,
                gross_amount: response.data.amount,
                currency: response.data.currency,
                order_id: orderData.order_id,
                customer_details: {
                    first_name: orderData.customer_name,
                    phone: orderData.customer_phone
                }
            };
        } catch (error) {
            console.error('Xendit transaction error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create a Tripay transaction
     * @param {Object} orderData - Order information
     * @returns {Object} Tripay transaction details
     */
    async createTripayTransaction(orderData) {
        try {
            // Map generic payment method to Tripay specific method codes
            const paymentMethodMap = {
                'qris': 'QRIS',
                'QRIS': 'QRIS',
                'DANA': 'DANA',
                'OVO': 'OVO',
                'GOPAY': 'GOPAY',
                'SHOPEEPAY': 'SHOPEEPAY',
                'BNI': 'BNI',
                'BCA': 'BCA',
                'ALFAMART': 'ALFAMART',
                'INDOMARET': 'INDOMARET'
            };
            
            // Get the Tripay method code, default to ALFAMART if not found
            const tripayMethod = paymentMethodMap[orderData.payment_method?.toUpperCase()] || 'ALFAMART';
            
            // Special handling for sandbox - use BRIVA which is usually available
            // For production, use the actual payment method or default to ALFAMART
            const finalPaymentMethod = this.isSandbox ? 'BRIVA' : tripayMethod;
            
            // Create signature according to Tripay documentation
            const signatureString = `${this.tripayMerchantCode}${orderData.order_id}${orderData.amount}`;
            const signature = crypto.createHmac('sha256', this.tripayPrivateKey)
                .update(signatureString)
                .digest('hex');
            
            // Determine the base URL for callbacks - prefer production domain if available
            const baseUrl = process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN ? 
                process.env.CORS_ORIGIN : 
                (process.env.CORS_ORIGIN || 'http://localhost:3010');
            
            // Generate a more realistic email address if customer email is not provided
            const customerEmail = orderData.customer_email || 
                (orderData.customer_phone ? 
                    `${orderData.customer_name.replace(/\s+/g, '.').toLowerCase()}@gantiwifi.online` : 
                    'customer@gantiwifi.online');
            
            const payload = {
                method: finalPaymentMethod,
                merchant_ref: orderData.order_id,
                amount: orderData.amount,
                customer_name: orderData.customer_name,
                customer_email: customerEmail,
                customer_phone: orderData.customer_phone,
                order_items: [
                    {
                        sku: orderData.profile_name,
                        name: `${orderData.profile_name} (${orderData.profile_duration})`,
                        price: orderData.amount,
                        quantity: 1
                    }
                ],
                callback_url: `${baseUrl}/api/orders/notification`,
                return_url: `${baseUrl}/payment-success.html?order_id=${orderData.order_id}`,
                expired_time: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
                signature: signature
            };

            console.log('Tripay request payload:', JSON.stringify(payload, null, 2));
            console.log('Tripay API URL:', `${this.tripayUrl}/transaction/create`);
            console.log('Tripay API Key:', this.tripayApiKey);

            const response = await axios.post(`${this.tripayUrl}/transaction/create`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.tripayApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Tripay response status:', response.status);
            console.log('Tripay response data:', JSON.stringify(response.data, null, 2));

            if (response.data && response.data.success) {
                return {
                    success: true,
                    transaction_id: response.data.data.reference,
                    payment_url: response.data.data.checkout_url,
                    gross_amount: response.data.data.amount,
                    currency: 'IDR',
                    order_id: orderData.order_id,
                    customer_details: {
                        first_name: orderData.customer_name,
                        phone: orderData.customer_phone
                    }
                };
            } else {
                const errorMessage = response.data ? (response.data.message || 'Tripay transaction failed') : 'Tripay transaction failed - no response data';
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Tripay transaction error:', error.response?.data || error.message);
            // If there's a response error from Tripay, provide a more specific message
            if (error.response && error.response.data) {
                const tripayError = error.response.data;
                if (tripayError.message) {
                    // Check if the error is about payment channel not being enabled
                    if (tripayError.message.includes('Payment channel is not enabled')) {
                        throw new Error(`Tripay API Error: Payment channel ${finalPaymentMethod} is not enabled for your merchant account. Please log in to your Tripay merchant dashboard and enable payment channels under Merchant > Opsi > Atur Channel Pembayaran.`);
                    }
                    throw new Error(`Tripay API Error: ${tripayError.message}`);
                } else if (tripayError.error) {
                    throw new Error(`Tripay API Error: ${JSON.stringify(tripayError.error)}`);
                }
            }
            throw error;
        }
    }

    /**
     * Create a simulation transaction
     * @param {Object} orderData - Order information
     * @returns {Object} Simulation transaction details
     */
    async createSimulationTransaction(orderData) {
        // Generate a unique transaction ID
        const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Determine the base URL for callbacks - prefer production domain if available
        const baseUrl = process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN : 
            (process.env.CORS_ORIGIN || 'http://localhost:3010');
        
        return {
            success: true,
            transaction_id: transactionId,
            payment_url: `${baseUrl}/payment-success.html?order_id=${orderData.order_id}`,
            gross_amount: orderData.amount,
            currency: 'IDR',
            order_id: orderData.order_id,
            customer_details: {
                first_name: orderData.customer_name,
                phone: orderData.customer_phone
            }
        };
    }

    /**
     * Verify payment notification from payment gateway
     * @param {Object} notification - Payment notification data
     * @returns {Object} Verification result
     */
    async verifyNotification(notification, headers) {
        try {
            // Check which payment gateway sent the notification
            if (headers['x-callback-token'] || headers['xendit-callback-token']) {
                return await this.verifyXenditNotification(notification, headers);
            } else if (headers['x-signature']) {
                return await this.verifyMidtransNotification(notification, headers);
            } else if (headers['authorization']) {
                return await this.verifyTripayNotification(notification, headers);
            } else {
                // For simulation, just return the notification as verified
                return {
                    verified: true,
                    transaction_status: notification.transaction_status || 'settlement',
                    order_id: notification.order_id,
                    transaction_id: notification.transaction_id,
                    gross_amount: notification.gross_amount
                };
            }
        } catch (error) {
            console.error('Payment notification verification error:', error);
            return {
                verified: false,
                error: error.message
            };
        }
    }

    /**
     * Verify Midtrans notification
     * @param {Object} notification - Midtrans notification data
     * @param {Object} headers - HTTP headers
     * @returns {Object} Verification result
     */
    async verifyMidtransNotification(notification, headers) {
        // In a real implementation, you would verify the signature
        // For demonstration, we'll just return the notification as verified
        return {
            verified: true,
            transaction_status: notification.transaction_status || 'settlement',
            order_id: notification.order_id,
            transaction_id: notification.transaction_id,
            gross_amount: notification.gross_amount
        };
    }

    /**
     * Verify Xendit notification
     * @param {Object} notification - Xendit notification data
     * @param {Object} headers - HTTP headers
     * @returns {Object} Verification result
     */
    async verifyXenditNotification(notification, headers) {
        // In a real implementation, you would verify the signature
        // For demonstration, we'll just return the notification as verified
        return {
            verified: true,
            transaction_status: notification.status || 'SUCCESS',
            order_id: notification.external_id,
            transaction_id: notification.id,
            gross_amount: notification.amount
        };
    }

    /**
     * Verify Tripay notification
     * @param {Object} notification - Tripay notification data
     * @param {Object} headers - HTTP headers
     * @returns {Object} Verification result
     */
    async verifyTripayNotification(notification, headers) {
        try {
            // Verify Tripay signature
            const signature = crypto.createHmac('sha256', this.tripayPrivateKey)
                .update(JSON.stringify(notification))
                .digest('hex');

            // Check if x-callback-signature header exists and matches signature
            // Tripay sends signature in x-callback-signature header
            const callbackSignature = headers['x-callback-signature'];
            if (callbackSignature && signature === callbackSignature) {
                return {
                    verified: true,
                    transaction_status: notification.status || 'PAID',
                    order_id: notification.merchant_ref,
                    transaction_id: notification.reference,
                    gross_amount: notification.amount
                };
            }
            
            // Also check authorization header for backward compatibility
            const authHeader = headers['authorization'];
            if (authHeader) {
                // Extract signature from header (could be "Bearer signature" or just "signature")
                const providedSignature = authHeader.startsWith('Bearer ') ? 
                    authHeader.substring(7) : authHeader;
                
                if (signature === providedSignature) {
                    return {
                        verified: true,
                        transaction_status: notification.status || 'PAID',
                        order_id: notification.merchant_ref,
                        transaction_id: notification.reference,
                        gross_amount: notification.amount
                    };
                }
            }
            
            return {
                verified: false,
                error: 'Invalid signature'
            };
        } catch (error) {
            console.error('Tripay notification verification error:', error);
            return {
                verified: false,
                error: error.message
            };
        }
    }

    /**
     * Generate signature for notification verification
     * @param {Object} data - Data to sign
     * @returns {string} Signature
     */
    generateSignature(data) {
        // In a real implementation, this would generate a proper signature
        // For demonstration, we'll create a simple hash
        const jsonString = JSON.stringify(data);
        return crypto.createHash('sha256').update(jsonString).digest('hex');
    }

    /**
     * Check if payment gateway is properly configured
     * @returns {string} Configuration status
     */
    getConfigurationStatus() {
        if (this.midtransServerKey) {
            return 'Midtrans';
        } else if (this.xenditSecretKey) {
            return 'Xendit';
        } else if (this.tripayApiKey && this.tripayPrivateKey && this.tripayMerchantCode) {
            return 'Tripay';
        } else {
            return 'Simulation';
        }
    }
}

// Export singleton instance
module.exports = new PaymentGateway();