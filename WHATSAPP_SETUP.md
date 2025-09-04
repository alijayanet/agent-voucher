# 📱 SETUP WHATSAPP BAILEYS - AGENT VOUCHER WIFI

## 🚀 **LANGKAH INSTALASI WHATSAPP BAILEYS**

### **1. Install Dependencies WhatsApp**

Jalankan perintah berikut di terminal:

```bash
npm install @whiskeysockets/baileys qrcode-terminal @hapi/boom pino
```

**Penjelasan Package:**
- `@whiskeysockets/baileys` - Library WhatsApp Web API yang aktif dan ter-maintain
- `qrcode-terminal` - Untuk menampilkan QR code di terminal
- `@hapi/boom` - Untuk error handling yang lebih baik
- `pino` - Logger yang dibutuhkan Baileys

### **2. Setup Environment Variables**

Buat file `.env` di root project (copy dari `config.env`):

```env
# WhatsApp Configuration
WHATSAPP_NUMBER=6281234567890
WHATSAPP_SESSION_PATH=./whatsapp-sessions
WHATSAPP_QR_TIMEOUT=60000

# Mikrotik Configuration
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your_password
MIKROTIK_PORT=8728

# Server Configuration
PORT=3000
NODE_ENV=development
```

**Ganti nilai sesuai konfigurasi Anda:**
- `WHATSAPP_NUMBER` - Nomor WhatsApp yang akan digunakan
- `MIKROTIK_HOST` - IP address router Mikrotik
- `MIKROTIK_USER` - Username Mikrotik
- `MIKROTIK_PASSWORD` - Password Mikrotik

### **3. Jalankan Aplikasi**

```bash
# Development mode (dengan auto-restart)
npm run dev

# Production mode
npm start
```

### **4. Setup WhatsApp Gateway**

1. **Buka Dashboard** di browser: `http://localhost:3000`
2. **Login sebagai Admin**
3. **Klik menu "WhatsApp Gateway"**
4. **Klik "Start Gateway"**
5. **Scan QR Code** yang muncul di terminal dengan WhatsApp Anda

## 🔧 **FITUR WHATSAPP YANG TERSEDIA**

### **✅ Gateway Management:**
- Initialize/Disconnect Gateway
- Real-time status monitoring
- Auto-reconnect saat koneksi terputus
- Session persistence (tidak perlu scan ulang setiap restart)

### **✅ Order Processing via WhatsApp:**
- Format pesan: `beli [profile] [jumlah] [nama_customer] [nomor_customer]`
- Contoh: `beli paket1jam 5 john doe 628123456789`
- Otomatis validasi agent dan saldo
- Pembuatan voucher otomatis
- Deduksi saldo agent

### **✅ Message Handling:**
- Auto-reply untuk order voucher
- Help message otomatis
- Error handling yang robust
- Logging lengkap

## 📱 **CARA KERJA WHATSAPP GATEWAY**

### **1. Koneksi:**
- Aplikasi menggunakan Baileys untuk koneksi WhatsApp Web
- QR code ditampilkan di terminal untuk scan
- Session disimpan di folder `whatsapp-sessions`

### **2. Message Processing:**
- Pesan masuk otomatis diproses
- Validasi agent berdasarkan nomor WhatsApp
- Parsing pesan order menggunakan regex pattern
- Pembuatan voucher dan transaksi otomatis

### **3. Auto-Reply:**
- Konfirmasi order berhasil
- Informasi voucher yang dibuat
- Pesan error jika ada masalah
- Help message untuk format yang salah

## 🛠️ **TROUBLESHOOTING**

### **❌ QR Code Tidak Muncul:**
1. Pastikan dependencies terinstall: `npm run install-deps`
2. Check console untuk error
3. Restart aplikasi: `npm run dev`

### **❌ Koneksi Terputus:**
1. Aplikasi akan auto-reconnect maksimal 5x
2. Check koneksi internet
3. Pastikan WhatsApp tidak logout di device lain

### **❌ Session Expired:**
1. Hapus folder `whatsapp-sessions`
2. Restart aplikasi
3. Scan QR code ulang

### **❌ Message Tidak Terkirim:**
1. Check status koneksi di dashboard
2. Pastikan WhatsApp terhubung
3. Check console untuk error

## 📊 **MONITORING & LOGS**

### **Dashboard Status:**
- Status koneksi real-time
- Nomor WhatsApp yang terhubung
- Jumlah order aktif
- Informasi reconnect attempts

### **Console Logs:**
- Connection updates
- Message processing
- Error logs
- QR code generation

## 🔒 **KEAMANAN**

### **Authentication:**
- Semua endpoint WhatsApp memerlukan admin privileges
- JWT token validation
- Role-based access control

### **Session Management:**
- Session WhatsApp disimpan lokal
- Tidak ada data yang dikirim ke server eksternal
- Auto-cleanup session expired

## 📈 **PERFORMANCE**

### **Optimization:**
- Event-driven message handling
- No polling required
- Efficient memory usage
- Auto-reconnect dengan exponential backoff

### **Scalability:**
- Support multiple concurrent connections
- Queue system untuk message processing
- Database connection pooling

## 🚀 **NEXT STEPS**

### **Fitur yang Bisa Ditambahkan:**
1. **Broadcast Messages** - Kirim pesan ke multiple agents
2. **Template Messages** - Pesan terstruktur untuk order
3. **Media Support** - Kirim gambar/dokumen
4. **Group Chat** - Support group WhatsApp
5. **Analytics** - Statistik penggunaan WhatsApp

### **Integrasi Tambahan:**
1. **Payment Gateway** - Integrasi dengan payment provider
2. **SMS Gateway** - Backup jika WhatsApp down
3. **Email Notifications** - Notifikasi via email
4. **Webhook** - Integrasi dengan sistem eksternal

---

## 📞 **SUPPORT**

Jika mengalami masalah:
1. Check dokumentasi ini terlebih dahulu
2. Lihat console logs untuk error detail
3. Restart aplikasi dan coba lagi
4. Hapus folder `whatsapp-sessions` jika ada masalah session

**WhatsApp Gateway siap digunakan! 🎉**
