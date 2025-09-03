const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, '..', '..', 'voucher_wifi.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    async createTables() {
        // Tabel untuk menyimpan voucher
        this.db.run(`CREATE TABLE IF NOT EXISTS vouchers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            profile TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_used BOOLEAN DEFAULT FALSE,
            used_at DATETIME,
            agent_price DECIMAL(10,2) NOT NULL,
            duration TEXT NOT NULL,
            agent_id INTEGER,
            customer_name TEXT,
            transaction_id INTEGER,
            FOREIGN KEY (agent_id) REFERENCES users (id)
        )`);

        // Tabel untuk menyimpan transaksi
        this.db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voucher_id INTEGER,
            customer_name TEXT,
            customer_phone TEXT,
            amount DECIMAL(10,2) NOT NULL,
            payment_method TEXT DEFAULT 'cash',
            status TEXT DEFAULT 'completed',
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (voucher_id) REFERENCES vouchers (id),
            FOREIGN KEY (created_by) REFERENCES users (id)
        )`);

        // Tabel untuk konfigurasi Mikrotik
        this.db.run(`CREATE TABLE IF NOT EXISTS mikrotik_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            port INTEGER DEFAULT 8728,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabel untuk profile voucher
        this.db.run(`CREATE TABLE IF NOT EXISTS voucher_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            duration TEXT NOT NULL,
            bandwidth_limit TEXT,
            data_limit TEXT,
            agent_price DECIMAL(10,2) NOT NULL,
            selling_price DECIMAL(10,2),
            mikrotik_profile_name TEXT,
            description TEXT,
            voucher_code_length INTEGER DEFAULT 4,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabel untuk users (admin dan agent)
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            full_name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            role TEXT NOT NULL DEFAULT 'agent',
            is_active BOOLEAN DEFAULT TRUE,
            balance DECIMAL(10,2) DEFAULT 0,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabel untuk user sessions
        this.db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        console.log('Tables created successfully');
        await this.updateExistingTables();
        this.createDefaultUsers();
    }

    // Method untuk mengupdate struktur tabel yang sudah ada
    async updateExistingTables() {
        // Update tabel users jika kolom balance belum ada
        this.db.get("PRAGMA table_info(users)", (err, rows) => {
            if (err) {
                console.error('Error checking table structure:', err);
                return;
            }

            // Check if balance column exists
            this.db.get("SELECT * FROM pragma_table_info('users') WHERE name='balance'", (err, row) => {
                if (err) {
                    console.error('Error checking balance column:', err);
                    return;
                }

                if (!row) {
                    console.log('Adding balance column to users table...');
                    this.db.run("ALTER TABLE users ADD COLUMN balance DECIMAL(10,2) DEFAULT 0", (err) => {
                        if (err) {
                            console.error('Error adding balance column:', err);
                        } else {
                            console.log('Balance column added successfully');
                        }
                    });
                }
            });
        });

        // Update tabel transactions jika kolom created_by belum ada
        this.db.get("PRAGMA table_info(transactions)", (err, rows) => {
            if (err) {
                console.error('Error checking transactions table structure:', err);
                return;
            }

            // Check if created_by column exists
            this.db.get("SELECT * FROM pragma_table_info('transactions') WHERE name='created_by'", (err, row) => {
                if (err) {
                    console.error('Error checking created_by column:', err);
                    return;
                }

                if (!row) {
                    console.log('Adding created_by column to transactions table...');
                    this.db.run("ALTER TABLE transactions ADD COLUMN created_by INTEGER", (err) => {
                        if (err) {
                            console.error('Error adding created_by column:', err);
                        } else {
                            console.log('Created_by column added successfully');
                            // Add foreign key constraint
                            this.db.run("CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by)", (err) => {
                                if (err) {
                                    console.error('Error creating index:', err);
                                }
                            });
                        }
                    });
                } else {
                    console.log('Created_by column already exists');
                }
            });
        });

        // Add OTP columns to users table
        this.db.get("SELECT * FROM pragma_table_info('users') WHERE name='otp_code'", (err, row) => {
            if (err) {
                console.error('Error checking otp_code column:', err);
                return;
            }

            if (!row) {
                console.log('Adding OTP columns to users table...');
                this.db.run("ALTER TABLE users ADD COLUMN otp_code TEXT", (err) => {
                    if (err) {
                        console.error('Error adding otp_code column:', err);
                    } else {
                        console.log('OTP code column added successfully');
                    }
                });

                this.db.run("ALTER TABLE users ADD COLUMN otp_expires DATETIME", (err) => {
                    if (err) {
                        console.error('Error adding otp_expires column:', err);
                    } else {
                        console.log('OTP expires column added successfully');
                    }
                });

                this.db.run("ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0", (err) => {
                    if (err) {
                        console.error('Error adding login_attempts column:', err);
                    } else {
                        console.log('Login attempts column added successfully');
                    }
                });
            } else {
                console.log('OTP columns already exist');
            }
        });

        // Add agent_id and customer_name columns to vouchers table
        this.db.get("SELECT * FROM pragma_table_info('vouchers') WHERE name='agent_id'", (err, row) => {
            if (err) {
                console.error('Error checking agent_id column:', err);
                return;
            }

            if (!row) {
                console.log('Adding agent_id and customer_name columns to vouchers table...');
                this.db.run("ALTER TABLE vouchers ADD COLUMN agent_id INTEGER REFERENCES users(id)", (err) => {
                    if (err) {
                        console.error('Error adding agent_id column:', err);
                    } else {
                        console.log('Agent_id column added successfully');
                    }
                });

                this.db.run("ALTER TABLE vouchers ADD COLUMN customer_name TEXT", (err) => {
                    if (err) {
                        console.error('Error adding customer_name column:', err);
                    } else {
                        console.log('Customer_name column added successfully');
                    }
                });
            } else {
                console.log('Agent columns already exist in vouchers table');
            }
        });

        // Add transaction_id to vouchers if missing
        this.db.get("SELECT * FROM pragma_table_info('vouchers') WHERE name='transaction_id'", (err, row) => {
            if (err) {
                console.error('Error checking transaction_id column:', err);
                return;
            }

            if (!row) {
                console.log('Adding transaction_id column to vouchers table...');
                this.db.run("ALTER TABLE vouchers ADD COLUMN transaction_id INTEGER REFERENCES transactions(id)", (err) => {
                    if (err) {
                        console.error('Error adding transaction_id column:', err);
                    } else {
                        console.log('transaction_id column added successfully');
                        this.db.run("CREATE INDEX IF NOT EXISTS idx_vouchers_transaction_id ON vouchers(transaction_id)", (err) => {
                            if (err) {
                                console.error('Error creating index on transaction_id:', err);
                            }
                        });
                    }
                });
            }
        });

        // Add voucher_code_length to voucher_profiles if missing
        this.db.get("SELECT * FROM pragma_table_info('voucher_profiles') WHERE name='voucher_code_length'", (err, row) => {
            if (err) {
                console.error('Error checking voucher_code_length column:', err);
                return;
            }

            if (!row) {
                console.log('Adding voucher_code_length column to voucher_profiles table...');
                this.db.run("ALTER TABLE voucher_profiles ADD COLUMN voucher_code_length INTEGER DEFAULT 4", (err) => {
                    if (err) {
                        console.error('Error adding voucher_code_length column:', err);
                    } else {
                        console.log('voucher_code_length column added successfully');
                    }
                });
            }
        });

        // Create agent_registrations table for WhatsApp registration requests
        const createAgentRegistrationsTable = `
            CREATE TABLE IF NOT EXISTS agent_registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                approved_by INTEGER,
                approved_at DATETIME,
                rejected_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await new Promise((resolve, reject) => {
            this.db.run(createAgentRegistrationsTable, (err) => {
                if (err) {
                    console.error('❌ Error creating agent_registrations table:', err);
                    reject(err);
                } else {
                    console.log('✅ Agent registrations table created/verified');
                    resolve();
                }
            });
        });

        // Create admin_phones table for dedicated admin phone numbers
        const createAdminPhonesTable = `
            CREATE TABLE IF NOT EXISTS admin_phones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number TEXT NOT NULL UNIQUE,
                admin_name TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME,
                total_commands INTEGER DEFAULT 0
            )
        `;

        await new Promise((resolve, reject) => {
            this.db.run(createAdminPhonesTable, (err) => {
                if (err) {
                    console.error('❌ Error creating admin_phones table:', err);
                    reject(err);
                } else {
                    console.log('✅ Admin phones table created/verified');
                    resolve();
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }

    // Method untuk mendapatkan instance database
    getDb() {
        return this.db;
    }

    // Method untuk membuat default users
    createDefaultUsers() {
        const bcrypt = require('bcryptjs');
        
        // Check if admin already exists
        this.db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (err) {
                console.error('Error checking admin user:', err);
                return;
            }
            
            if (!row) {
                // Create default admin user
                const adminPassword = bcrypt.hashSync('admin123', 10);
                this.db.run(
                    'INSERT INTO users (username, password, full_name, role, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['admin', adminPassword, 'Administrator', 'admin', 'admin@voucherwifi.com', null, null],
                    function(err) {
                        if (err) {
                            console.error('Error creating admin user:', err);
                        } else {
                            console.log('Default admin user created (username: admin, password: admin123)');
                        }
                    }
                );
            }
        });

        // Check if agent already exists
        this.db.get('SELECT * FROM users WHERE username = ?', ['agent'], (err, row) => {
            if (err) {
                console.error('Error checking agent user:', err);
                return;
            }
            
            if (!row) {
                // Create default agent user
                const agentPassword = bcrypt.hashSync('agent123', 10);
                this.db.run(
                    'INSERT INTO users (username, password, full_name, role, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['agent', agentPassword, 'Agent Penjualan', 'agent', 'agent@voucherwifi.com', null, null],
                    function(err) {
                        if (err) {
                            console.error('Error creating agent user:', err);
                        } else {
                            console.log('Default agent user created (username: agent, password: agent123)');
                        }
                    }
                );
            }
        });
    }
}

module.exports = new Database();