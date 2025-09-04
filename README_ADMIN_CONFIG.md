# 🚀 **Konfigurasi Admin User**

Panduan lengkap untuk mengkonfigurasi admin user melalui file `.env`

---

## 📋 **Konfigurasi Admin di .env**

Edit file `config.env` dan tambahkan konfigurasi admin berikut:

```env
# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@voucherwifi.com
ADMIN_FULL_NAME=Administrator
```

### **Parameter Admin Configuration:**

| Parameter | Default | Deskripsi |
|-----------|---------|-----------|
| `ADMIN_USERNAME` | `admin` | Username untuk login admin |
| `ADMIN_PASSWORD` | `admin123` | Password untuk login admin |
| `ADMIN_EMAIL` | `admin@voucherwifi.com` | Email admin (opsional) |
| `ADMIN_FULL_NAME` | `Administrator` | Nama lengkap admin |

---

## 🔧 **Cara Kerja Sistem Admin**

### **1. Otomatisasi Inisialisasi**
- ✅ Admin user dibuat otomatis saat server start
- ✅ Jika admin sudah ada, sistem akan update jika ada perubahan
- ✅ Password di-hash menggunakan bcrypt untuk keamanan
- ✅ Role admin otomatis ditetapkan

### **2. Update Dinamis**
- ✅ Sistem mendeteksi perubahan di file `.env`
- ✅ Password akan diupdate jika berbeda
- ✅ Email dan nama lengkap dapat diupdate
- ✅ Tidak perlu restart manual untuk perubahan

### **3. Migrasi Server**
- ✅ Copy file `.env` ke server baru
- ✅ Admin user akan dibuat otomatis dengan konfigurasi baru
- ✅ Tidak perlu export/import database untuk admin user

---

## 🎯 **Contoh Penggunaan**

### **Konfigurasi Default:**
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### **Konfigurasi Custom:**
```env
ADMIN_USERNAME=superadmin
ADMIN_PASSWORD=mySecurePass2024!
ADMIN_EMAIL=admin@company.com
ADMIN_FULL_NAME=System Administrator
```

### **Multiple Environment:**
```env
# Development
ADMIN_USERNAME=admin_dev
ADMIN_PASSWORD=dev123

# Production
ADMIN_USERNAME=admin_prod
ADMIN_PASSWORD=prodSecure456!
```

---

## 🔒 **Keamanan & Best Practices**

### **✅ Yang Direkomendasikan:**
- ✅ Gunakan password yang kuat (minimal 8 karakter)
- ✅ Gabungkan huruf besar, kecil, angka, dan simbol
- ✅ Ubah password default sebelum production
- ✅ Gunakan email yang valid
- ✅ Backup file `.env` secara terpisah dari kode

### **❌ Yang Harus Dihindari:**
- ❌ Jangan commit file `.env` ke git
- ❌ Jangan gunakan password yang mudah ditebak
- ❌ Jangan bagikan kredensial admin
- ❌ Jangan gunakan username default di production

---

## 🚀 **Testing & Verifikasi**

### **Test Admin Configuration:**
```bash
# Jalankan test
node test_admin_env.js

# Output yang diharapkan:
✅ config.env loaded successfully
✅ Admin user initialized successfully!
✅ Login successful with .env credentials!
🎉 Admin initialization from .env test completed successfully!
```

### **Manual Verification:**
```bash
# Check admin user in database
sqlite3 voucher_wifi.db "SELECT username, role, email FROM users WHERE role='admin';"

# Expected output:
# admin|admin|admin@voucherwifi.com
```

---

## 📊 **Logging & Monitoring**

### **Server Startup Logs:**
```
👑 Initializing admin user from .env...
✅ Admin user already exists: admin
✅ Admin user is up to date
👑 Admin user ready: admin
```

### **Update Logs:**
```
🔄 Admin password changed, updating...
✅ Admin user updated successfully
```

---

## 🔄 **Upgrade dari Database ke .env**

### **Jika sudah ada admin di database:**

1. **Backup database** (opsional tapi direkomendasikan)
   ```bash
   cp voucher_wifi.db voucher_wifi_backup.db
   ```

2. **Update file `.env`** dengan konfigurasi yang diinginkan
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=newSecurePassword
   ```

3. **Restart server**
   ```bash
   npm start
   ```

4. **Sistem akan otomatis:**
   - ✅ Deteksi admin user yang sudah ada
   - ✅ Update password jika berbeda
   - ✅ Update informasi lain jika diperlukan

---

## 🛠 **Troubleshooting**

### **Error: "Admin user creation failed"**
```bash
# Check database connection
node -e "require('./backend/config/database'); console.log('DB connected');"

# Check .env file permissions
ls -la config.env
```

### **Error: "Admin login failed"**
```bash
# Verify .env configuration
cat config.env | grep ADMIN_

# Test manual login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### **Error: "Password not updated"**
```bash
# Check if password hashing works
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('test', 10));"

# Restart server to force re-initialization
npm start
```

---

## 📝 **Catatan Penting**

### **🔄 Auto-Update Behavior:**
- Sistem mendeteksi perubahan di `.env` saat server restart
- Password hanya diupdate jika berbeda dari yang ada di database
- Username tidak bisa diubah setelah admin user dibuat

### **🗃️ Database Migration:**
- Admin user tetap ada di database untuk kompatibilitas
- Sistem `.env` hanya untuk konfigurasi awal dan update
- Tidak ada konflik antara database dan `.env`

### **🔐 Security Considerations:**
- Password di-hash menggunakan bcrypt dengan salt rounds 10
- JWT tokens memiliki expiration 24 jam
- Session management untuk keamanan tambahan

---

## 🎉 **Keuntungan Sistem Baru**

### **✅ Migrasi Mudah:**
- Copy `.env` ke server baru → admin user otomatis dibuat
- Tidak perlu export/import database untuk admin user
- Setup production menjadi lebih cepat

### **✅ Environment Management:**
- Development dan production dapat memiliki admin berbeda
- Password dapat berbeda per environment
- Konfigurasi dapat di-version control (tanpa password)

### **✅ Maintenance Friendly:**
- Update password tanpa akses database
- Reset admin credentials dengan mudah
- Backup dan restore yang lebih sederhana

---

**Sistem admin user sekarang sudah dikonfigurasi melalui file `.env` dan siap untuk migrasi ke server mana pun! 🚀✨**
