// Initialize database with required tables
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function initDatabase() {
    console.log('🔧 INITIALIZING DATABASE WITH REQUIRED TABLES\n');
    console.log('='.repeat(50));

    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, 'database.sqlite');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Database connection failed:', err.message);
                reject(err);
                return;
            }
            console.log('✅ Database connected successfully');
        });

        // Create tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                phone TEXT,
                address TEXT,
                role TEXT DEFAULT 'agent',
                balance INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                otp_code TEXT,
                otp_expires DATETIME,
                login_attempts INTEGER DEFAULT 0
            )`,

            `CREATE TABLE IF NOT EXISTS voucher_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                duration TEXT,
                bandwidth_limit TEXT,
                data_limit TEXT,
                agent_price INTEGER NOT NULL,
                selling_price INTEGER NOT NULL,
                mikrotik_profile_name TEXT,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS vouchers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                profile TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                is_used BOOLEAN DEFAULT 0,
                used_at DATETIME,
                agent_id INTEGER,
                customer_name TEXT,
                FOREIGN KEY (agent_id) REFERENCES users(id)
            )`,

            `CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voucher_id INTEGER,
                customer_name TEXT,
                customer_phone TEXT,
                amount INTEGER NOT NULL,
                payment_method TEXT DEFAULT 'cash',
                status TEXT DEFAULT 'completed',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`
        ];

        let completed = 0;
        const total = tables.length;

        tables.forEach((sql, index) => {
            db.run(sql, (err) => {
                if (err) {
                    console.error(`❌ Error creating table ${index + 1}:`, err.message);
                    reject(err);
                    return;
                }

                completed++;
                console.log(`✅ Table ${index + 1}/${total} created successfully`);

                if (completed === total) {
                    // Create default admin user
                    console.log('\n👤 Creating default admin user...');
                    const hashedPassword = require('bcryptjs').hashSync('admin123', 10);

                    db.run(`INSERT OR IGNORE INTO users (username, password, full_name, role, is_active)
                           VALUES (?, ?, ?, ?, ?)`,
                           ['admin', hashedPassword, 'Administrator', 'admin', 1],
                           function(err) {
                        if (err) {
                            console.error('❌ Error creating admin user:', err.message);
                            reject(err);
                            return;
                        }

                        if (this.changes > 0) {
                            console.log('✅ Default admin user created');
                            console.log('   Username: admin');
                            console.log('   Password: admin123');
                        } else {
                            console.log('ℹ️  Admin user already exists');
                        }

                        // Create sample voucher profiles
                        console.log('\n📦 Creating sample voucher profiles...');

                        const sampleProfiles = [
                            {
                                name: 'Paket 1 Jam',
                                duration: '1h',
                                bandwidth_limit: '2M/1M',
                                data_limit: '100MB',
                                agent_price: 3000,
                                selling_price: 5000,
                                mikrotik_profile_name: '1JAM',
                                description: 'Internet 1 jam dengan kecepatan 2Mbps download'
                            },
                            {
                                name: 'Paket 3 Jam',
                                duration: '3h',
                                bandwidth_limit: '2M/1M',
                                data_limit: '300MB',
                                agent_price: 8000,
                                selling_price: 12000,
                                mikrotik_profile_name: '3JAM',
                                description: 'Internet 3 jam dengan kecepatan 2Mbps download'
                            },
                            {
                                name: 'Paket 1 Hari',
                                duration: '1d',
                                bandwidth_limit: '3M/1M',
                                data_limit: '1GB',
                                agent_price: 15000,
                                selling_price: 20000,
                                mikrotik_profile_name: '1HARI',
                                description: 'Internet 1 hari dengan kecepatan 3Mbps download'
                            }
                        ];

                        let profileCompleted = 0;
                        sampleProfiles.forEach(profile => {
                            db.run(`INSERT OR IGNORE INTO voucher_profiles
                                   (name, duration, bandwidth_limit, data_limit, agent_price, selling_price, mikrotik_profile_name, description, is_active)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                   [profile.name, profile.duration, profile.bandwidth_limit, profile.data_limit,
                                    profile.agent_price, profile.selling_price, profile.mikrotik_profile_name,
                                    profile.description, 1],
                                   function(err) {
                                if (err) {
                                    console.error(`❌ Error creating profile ${profile.name}:`, err.message);
                                } else if (this.changes > 0) {
                                    console.log(`✅ Created profile: ${profile.name}`);
                                } else {
                                    console.log(`ℹ️  Profile already exists: ${profile.name}`);
                                }

                                profileCompleted++;
                                if (profileCompleted === sampleProfiles.length) {
                                    // Close database
                                    db.close((err) => {
                                        if (err) {
                                            console.error('❌ Error closing database:', err.message);
                                            reject(err);
                                        } else {
                                            console.log('\n✅ Database initialized successfully!');
                                            console.log('🎉 Agent can now click "Order Baru" without errors');

                                            console.log('\n📋 SUMMARY:');
                                            console.log('✅ Tables created: users, voucher_profiles, vouchers, transactions');
                                            console.log('✅ Default admin user created');
                                            console.log('✅ Sample voucher profiles created and activated');

                                            console.log('\n🚀 NEXT STEPS:');
                                            console.log('1. Start server: npm start');
                                            console.log('2. Login as agent or admin');
                                            console.log('3. Click "Order Baru" - should work now!');

                                            resolve();
                                        }
                                    });
                                }
                            });
                        });
                    });
                }
            });
        });
    });
}

// Run database initialization
initDatabase()
    .then(() => {
        console.log('\n' + '='.repeat(50));
        console.log('🎊 DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ DATABASE INITIALIZATION FAILED:', error);
        console.log('\n💡 TROUBLESHOOTING:');
        console.log('1. Check if database file is writable');
        console.log('2. Make sure no other process is using the database');
        console.log('3. Try deleting database.sqlite and running again');
        process.exit(1);
    });
