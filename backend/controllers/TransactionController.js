const TransactionModel = require('../models/Transaction');

class TransactionController {
    // Mendapatkan semua transaksi dengan pagination
    static async getTransactions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            
            const filter = {};
            if (req.query.status) {
                filter.status = req.query.status;
            }
            if (req.query.payment_method) {
                filter.payment_method = req.query.payment_method;
            }
            if (req.query.date_from) {
                filter.date_from = req.query.date_from;
            }
            if (req.query.date_to) {
                filter.date_to = req.query.date_to;
            }
            if (req.query.customer_name) {
                filter.customer_name = req.query.customer_name;
            }

            const result = await TransactionModel.getAll(page, limit, filter);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error getting transactions:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan transaksi berdasarkan ID
    static async getTransactionById(req, res) {
        try {
            const { id } = req.params;
            const transaction = await TransactionModel.getById(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            res.json({
                success: true,
                data: transaction
            });

        } catch (error) {
            console.error('Error getting transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Update status transaksi
    static async updateTransactionStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
            }

            const validStatuses = ['pending', 'completed', 'cancelled', 'refunded'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
                });
            }

            const result = await TransactionModel.updateStatus(id, status);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            res.json({
                success: true,
                message: 'Transaction status updated successfully'
            });

        } catch (error) {
            console.error('Error updating transaction status:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Menghapus transaksi
    static async deleteTransaction(req, res) {
        try {
            const { id } = req.params;

            const result = await TransactionModel.delete(id);

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Transaction not found'
                });
            }

            res.json({
                success: true,
                message: 'Transaction deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting transaction:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan laporan penjualan harian
    static async getDailyReport(req, res) {
        try {
            const { date } = req.query;
            const report = await TransactionModel.getDailyReport(date);

            res.json({
                success: true,
                data: report
            });

        } catch (error) {
            console.error('Error getting daily report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan laporan penjualan bulanan
    static async getMonthlyReport(req, res) {
        try {
            const year = req.query.year ? parseInt(req.query.year) : null;
            const month = req.query.month ? parseInt(req.query.month) : null;
            
            const report = await TransactionModel.getMonthlyReport(year, month);

            res.json({
                success: true,
                data: report
            });

        } catch (error) {
            console.error('Error getting monthly report:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan top customers
    static async getTopCustomers(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const customers = await TransactionModel.getTopCustomers(limit);

            res.json({
                success: true,
                data: customers
            });

        } catch (error) {
            console.error('Error getting top customers:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Mendapatkan statistik transaksi
    static async getStats(req, res) {
        try {
            const stats = await TransactionModel.getStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error getting transaction stats:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Dashboard statistics
    static async getDashboardStats(req, res) {
        try {
            const [transactionStats, dailyReport, topCustomers] = await Promise.all([
                TransactionModel.getStats(),
                TransactionModel.getDailyReport(),
                TransactionModel.getTopCustomers(5)
            ]);

            res.json({
                success: true,
                data: {
                    overview: transactionStats,
                    today: dailyReport,
                    topCustomers: topCustomers
                }
            });

        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
}

module.exports = TransactionController;