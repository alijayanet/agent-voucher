const database = require('../config/database');
const VoucherProfileModel = require('../models/VoucherProfile');

async function ensureProfilesExist() {
    console.log('🔍 Checking if voucher profiles exist...');

    try {
        // Check if any profiles exist
        const existingProfiles = await VoucherProfileModel.getActive();
        console.log(`📊 Found ${existingProfiles.length} existing profiles`);

        if (existingProfiles.length === 0) {
            console.log('📝 No profiles found, inserting default profiles...');

            // Insert default profiles
            const success = await VoucherProfileModel.insertDefaults();

            if (success) {
                console.log('✅ Default profiles inserted successfully');

                // Verify the insertion
                const newProfiles = await VoucherProfileModel.getActive();
                console.log(`📊 Now have ${newProfiles.length} profiles:`);

                newProfiles.forEach((profile, index) => {
                    console.log(`   ${index + 1}. ${profile.name} - Rp ${profile.agent_price} (${profile.duration})`);
                });

            } else {
                console.log('❌ Failed to insert default profiles');
            }

        } else {
            console.log('✅ Profiles already exist:');
            existingProfiles.forEach((profile, index) => {
                console.log(`   ${index + 1}. ${profile.name} - Rp ${profile.agent_price} (${profile.duration})`);
            });
        }

    } catch (error) {
        console.error('❌ Error ensuring profiles exist:', error);
    } finally {
        // Close database connection
        database.close();
    }
}

// Run if called directly
if (require.main === module) {
    ensureProfilesExist().then(() => {
        console.log('🎉 Profile check completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Profile check failed:', error);
        process.exit(1);
    });
}

module.exports = { ensureProfilesExist };
