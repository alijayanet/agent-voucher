const database = require('./database');

// Script untuk mengupdate struktur database yang sudah ada
async function migrateDatabase() {
    console.log('🔄 Starting database migration...');
    
    try {
        const db = database.getDb();
        
        // Check if balance column exists
        db.get("SELECT * FROM pragma_table_info('users') WHERE name='balance'", (err, row) => {
            if (err) {
                console.error('❌ Error checking balance column:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Adding balance column to users table...');
                db.run("ALTER TABLE users ADD COLUMN balance DECIMAL(10,2) DEFAULT 0", (err) => {
                    if (err) {
                        console.error('❌ Error adding balance column:', err);
                    } else {
                        console.log('✅ Balance column added successfully');
                        
                        // Update existing users with default balance
                        db.run("UPDATE users SET balance = 0 WHERE balance IS NULL", (err) => {
                            if (err) {
                                console.error('❌ Error updating existing users:', err);
                            } else {
                                console.log('✅ Existing users updated with default balance');
                            }
                        });
                    }
                });
            } else {
                console.log('✅ Balance column already exists');
            }
        });
        
        // Check if phone column exists
        db.get("SELECT * FROM pragma_table_info('users') WHERE name='phone'", (err, row) => {
            if (err) {
                console.error('❌ Error checking phone column:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Adding phone column to users table...');
                db.run("ALTER TABLE users ADD COLUMN phone TEXT", (err) => {
                    if (err) {
                        console.error('❌ Error adding phone column:', err);
                    } else {
                        console.log('✅ Phone column added successfully');
                    }
                });
            } else {
                console.log('✅ Phone column already exists');
            }
        });
        
        // Check if address column exists
        db.get("SELECT * FROM pragma_table_info('users') WHERE name='address'", (err, row) => {
            if (err) {
                console.error('❌ Error checking address column:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Adding address column to users table...');
                db.run("ALTER TABLE users ADD COLUMN address TEXT", (err) => {
                    if (err) {
                        console.error('❌ Error adding address column:', err);
                    } else {
                        console.log('✅ Address column added successfully');
                    }
                });
            } else {
                console.log('✅ Address column already exists');
            }
        });
        
        // Create OTP settings table
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_settings'", (err, row) => {
            if (err) {
                console.error('❌ Error checking otp_settings table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating otp_settings table...');
                const createOTPTable = `
                    CREATE TABLE otp_settings (
                        id INTEGER PRIMARY KEY,
                        enabled INTEGER DEFAULT 0,
                        length INTEGER DEFAULT 6,
                        expiry INTEGER DEFAULT 600,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_by INTEGER
                    )
                `;
                
                db.run(createOTPTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating otp_settings table:', err);
                    } else {
                        console.log('✅ OTP settings table created successfully');
                        
                        // Insert default settings
                        db.run(`
                            INSERT INTO otp_settings (id, enabled, length, expiry) 
                            VALUES (1, 0, 6, 600)
                        `, (err) => {
                            if (err) {
                                console.error('❌ Error inserting default OTP settings:', err);
                            } else {
                                console.log('✅ Default OTP settings inserted');
                            }
                        });
                    }
                });
            } else {
                console.log('✅ OTP settings table already exists');
            }
        });
        
        // Create OTP codes table for storing active OTP codes
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_codes'", (err, row) => {
            if (err) {
                console.error('❌ Error checking otp_codes table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating otp_codes table...');
                const createOTPCodesTable = `
                    CREATE TABLE otp_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        agent_phone TEXT NOT NULL,
                        otp_code TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL,
                        used INTEGER DEFAULT 0,
                        used_at DATETIME
                    )
                `;
                
                db.run(createOTPCodesTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating otp_codes table:', err);
                    } else {
                        console.log('✅ OTP codes table created successfully');
                    }
                });
            } else {
                console.log('✅ OTP codes table already exists');
            }
        });
        
        // Create OTP login settings table
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_login_settings'", (err, row) => {
            if (err) {
                console.error('❌ Error checking otp_login_settings table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating otp_login_settings table...');
                const createOTPLoginTable = `
                    CREATE TABLE otp_login_settings (
                        id INTEGER PRIMARY KEY,
                        enabled INTEGER DEFAULT 0,
                        length INTEGER DEFAULT 6,
                        expiry INTEGER DEFAULT 600,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_by INTEGER
                    )
                `;
                
                db.run(createOTPLoginTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating otp_login_settings table:', err);
                    } else {
                        console.log('✅ OTP login settings table created successfully');
                        
                        // Insert default settings
                        db.run(`
                            INSERT INTO otp_login_settings (id, enabled, length, expiry) 
                            VALUES (1, 0, 6, 600)
                        `, (err) => {
                            if (err) {
                                console.error('❌ Error inserting default OTP login settings:', err);
                            } else {
                                console.log('✅ Default OTP login settings inserted');
                            }
                        });
                    }
                });
            } else {
                console.log('✅ OTP login settings table already exists');
            }
        });
        
        // Create OTP login codes table for storing active login OTP codes
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_login_codes'", (err, row) => {
            if (err) {
                console.error('❌ Error checking otp_login_codes table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating otp_login_codes table...');
                const createOTPLoginCodesTable = `
                    CREATE TABLE otp_login_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        otp_code TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL,
                        used INTEGER DEFAULT 0,
                        used_at DATETIME
                    )
                `;
                
                db.run(createOTPLoginCodesTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating otp_login_codes table:', err);
                    } else {
                        console.log('✅ OTP login codes table created successfully');
                    }
                });
            } else {
                console.log('✅ OTP login codes table already exists');
            }
        });

        // Create deposit requests table
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='deposit_requests'", (err, row) => {
            if (err) {
                console.error('❌ Error checking deposit_requests table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating deposit_requests table...');
                const createDepositRequestsTable = `
                    CREATE TABLE deposit_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        agent_id INTEGER NOT NULL,
                        amount DECIMAL(10,2) NOT NULL,
                        payment_method TEXT NOT NULL,
                        notes TEXT,
                        priority TEXT DEFAULT 'normal',
                        status TEXT DEFAULT 'pending',
                        processed_amount DECIMAL(10,2),
                        admin_notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        processed_at DATETIME,
                        processed_by INTEGER,
                        FOREIGN KEY (agent_id) REFERENCES users (id),
                        FOREIGN KEY (processed_by) REFERENCES users (id)
                    )
                `;
                
                db.run(createDepositRequestsTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating deposit_requests table:', err);
                    } else {
                        console.log('✅ Deposit requests table created successfully');
                    }
                });
            } else {
                console.log('✅ Deposit requests table already exists');
            }
        });
        
        // Create orders table for public voucher orders
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'", (err, row) => {
            if (err) {
                console.error('❌ Error checking orders table:', err);
                return;
            }
            
            if (!row) {
                console.log('➕ Creating orders table...');
                const createOrdersTable = `
                    CREATE TABLE orders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id TEXT UNIQUE NOT NULL,
                        profile_id INTEGER NOT NULL,
                        customer_name TEXT NOT NULL,
                        customer_phone TEXT NOT NULL,
                        amount DECIMAL(10,2) NOT NULL,
                        payment_method TEXT NOT NULL,
                        payment_reference TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        processed_at DATETIME,
                        FOREIGN KEY (profile_id) REFERENCES voucher_profiles (id)
                    )
                `;
                
                db.run(createOrdersTable, (err) => {
                    if (err) {
                        console.error('❌ Error creating orders table:', err);
                    } else {
                        console.log('✅ Orders table created successfully');
                    }
                });
            } else {
                console.log('✅ Orders table already exists');
            }
        });
        
        console.log('✅ Database migration completed');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateDatabase();
}

module.exports = { migrateDatabase };
