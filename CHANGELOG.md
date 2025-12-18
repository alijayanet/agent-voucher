# Changelog - Agent Voucher WiFi

## [Unreleased] - 2025-12-18

### 🔄 Updated
- **@whiskeysockets/baileys**: v6.7.19 → **v7.0.0-rc.6**
  - Update to latest RC version for better stability
  - Improved WhatsApp Web protocol compatibility
  - Bug fixes and performance improvements

### ✨ Added
- **getMessage handler** in WhatsAppGateway
  - Required for Baileys v7.0.0+ compatibility
  - Prevents errors when replying to messages
  - Returns empty conversation for missing messages

### 🔧 Changed
- Updated `makeWASocket` configuration
  - Added getMessage async handler
  - Maintains compatibility with v7.0.0-rc.6

### 📝 Technical Details

#### Modified Files:
1. `package.json`
   - Updated Baileys dependency version

2. `backend/services/WhatsAppGateway.js`
   - Added getMessage handler in initialize() method
   - Configuration now v7.0.0 compliant

#### getMessage Handler:
```javascript
getMessage: async (key) => {
    return { conversation: '' }
}
```

**Purpose:** Handle requests for messages that might not be available in local cache, preventing errors when replying or quoting messages.

---

## [1.0.0] - Previous

### Features
- WhatsApp Bot dengan Baileys v6.7.19
- Voucher WiFi management
- Agent system dengan deposit
- MikroTik Hotspot integration
- Admin commands via WhatsApp
- OTP system for security
- Transaction tracking
- SQLite database

---

**Notes:**
- Baileys v7.0.0 Final belum release (masih RC)
- v7.0.0-rc.6 sudah stable untuk production
- Tested dan verified working
- getMessage handler adalah REQUIRED di v7.0.0+

**Upgrade Path:**
```bash
# Install dependencies
npm install

# Test aplikasi
npm start
```

**Compatibility:**
- ✅ Node.js >= 14.0.0
- ✅ WhatsApp Web Multi-Device
- ✅ Baileys v7.0.0-rc.6

---

*Last updated: 2025-12-18*
