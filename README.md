# 🎫 Sistem Manajemen Voucher WiFi Agent

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Mikrotik](https://img.shields.io/badge/Mikrotik-FF6B35?style=for-the-badge&logo=mikrotik&logoColor=white)

**Sistem Manajemen Voucher WiFi Modern dengan Integrasi WhatsApp & Dukungan Mikrotik**

[📋 Fitur](#-fitur) • [🚀 Mulai Cepat](#-mulai-cepat) • [⚙️ Konfigurasi](#%EF%B8%8F-konfigurasi) • [📱 Setup WhatsApp](#-setup-whatsapp) • [🛠️ Penggunaan](#%EF%B8%8F-penggunaan)

</div>

---

## 📋 Fitur

### 🎯 Fitur Utama
- **🎫 Manajemen Voucher** - Buat, kelola, dan lacak voucher WiFi
- **👥 Sistem Agent** - Dukungan multi-agent dengan akses berbasis peran
- **💰 Manajemen Saldo** - Pelacakan saldo agent dan permintaan deposit
- **📱 Integrasi WhatsApp** - Notifikasi otomatis dan perintah bot
- **🌐 Integrasi Mikrotik** - Manajemen hotspot user langsung
- **🔐 Autentikasi** - Keamanan berbasis JWT dengan dukungan 2FA

### 💼 Fitur Admin
- **📊 Dashboard** - Statistik dan analitik real-time
- **👤 Manajemen Agent** - Tambah, edit, dan kelola agent
- **💳 Kontrol Deposit** - Setujui/tolak permintaan deposit
- **🎛️ Manajemen Profil** - Profil voucher dan penetapan harga
- **📈 Laporan** - Laporan transaksi dan penjualan
- **⚙️ Pengaturan** - Konfigurasi sistem dan preferensi

### 📱 Fitur Agent
- **🎫 Generate Voucher** - Buat voucher untuk pelanggan
- **💰 Request Deposit** - Minta penambahan saldo
- **📊 Dashboard** - Statistik penjualan personal
- **📱 Order WhatsApp** - Terima pesanan via WhatsApp
- **🔐 Login 2FA** - Keamanan tinggi dengan OTP

### 🤖 Fitur Bot WhatsApp
- **🛒 Proses Pesanan** - Tangani pesanan voucher secara otomatis
- **📢 Notifikasi** - Update dan alert real-time
- **💬 Perintah Admin** - Kelola sistem via WhatsApp
- **🎫 Kirim Voucher Otomatis** - Pengiriman voucher langsung ke pelanggan

---

## 🛠️ Teknologi yang Digunakan

| Kategori | Teknologi |
|----------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite |
| **Autentikasi** | JWT, bcryptjs |
| **WhatsApp** | Baileys (WhatsApp Web API) |
| **Network** | Mikrotik RouterOS API |
| **Frontend** | HTML5, CSS3, Bootstrap 5, JavaScript |
| **Real-time** | Koneksi WebSocket |

---

## 🚀 Mulai Cepat

### 📋 Persyaratan

```bash
# Software yang dibutuhkan
Node.js >= 16.0.0
npm >= 8.0.0
Git
```

### ⚡ Instalasi Satu Perintah

```bash
# Clone repository
git clone https://github.com/alijayanet/agent-voucher.git
cd agent-voucher

# Install dependencies
npm install

# Setup database
node backend/config/migrate.js

# Start development server
npm start
```

### 🔧 Langkah Instalasi Manual

#### 1. **Clone Repository**
```bash
git clone https://github.com/alijayanet/agent-voucher.git
cd agent-voucher
```

#### 2. **Install Dependencies**
```bash
npm install
```

#### 3. **Konfigurasi Environment**
```bash
# Copy template environment
cp config.env.example config.env

# Edit konfigurasi (lihat bagian Konfigurasi di bawah)
nano config.env
```

#### 4. **Setup Database**
```bash
# Inisialisasi database dan buat tabel
node backend/config/migrate.js
```

#### 5. **Buat User Admin**
```bash
# Jalankan setup admin (opsional)
node backend/scripts/create-admin.js
```

#### 6. **Jalankan Aplikasi**
```bash
# Mode development
npm run dev

# Mode production
npm start

# Dengan PM2 (direkomendasikan untuk production)
npm install -g pm2
pm2 start ecosystem.config.js
```

---

## ⚙️ Konfigurasi

### 📝 Variabel Environment (config.env)

```bash
# Konfigurasi Server
PORT=3010
NODE_ENV=production

# Database
DATABASE_PATH=./backend/data/voucher_wifi.db

# Keamanan JWT
JWT_SECRET=kunci-rahasia-jwt-super-aman-anda
JWT_EXPIRES_IN=7d

# Konfigurasi Mikrotik
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=password-mikrotik-anda
MIKROTIK_PORT=8728

# Konfigurasi WhatsApp
WHATSAPP_SESSION_PATH=./backend/sessions/whatsapp
WHATSAPP_AUTO_CONNECT=true

# Nomor HP Admin (pisahkan dengan koma)
ADMIN_PHONES=6281234567890,6289876543210

# Pengaturan Aplikasi
DASHBOARD_URL=https://domain-anda.com
CLEANUP_INTERVAL=24h
SESSION_TIMEOUT=30d

# Konfigurasi Email (opsional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email-anda@gmail.com
SMTP_PASS=password-aplikasi-anda

# Konfigurasi Upload
MAX_FILE_SIZE=5MB
UPLOAD_PATH=./backend/uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

### 🔐 Pengaturan Keamanan

```bash
# Generate JWT secret yang aman
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set permission file yang tepat
chmod 600 config.env
chmod 755 backend/data/
chmod 644 backend/data/voucher_wifi.db
```

---

## 📱 Setup WhatsApp

### 🔧 Setup Awal

1. **Jalankan Aplikasi**
```bash
npm start
```

2. **Buka Halaman Setup WhatsApp**
```
http://localhost:3010/whatsapp-setup.html
```

3. **Scan QR Code**
   - Buka WhatsApp di HP Anda
   - Masuk ke Pengaturan > Perangkat Tertaut
   - Scan QR code yang ditampilkan

4. **Verifikasi Koneksi**
   - Cek console untuk pesan "WhatsApp connected"
   - Test dengan mengirim pesan ke salah satu nomor admin

### 📱 Perintah WhatsApp

#### 👑 Perintah Admin
```
help                    - Tampilkan semua perintah
list                    - Daftar semua agent
pending                 - Tampilkan registrasi pending

# Manajemen Agent
daftar [nama] [hp]      - Daftarkan agent baru
deposit [agent] [jumlah] - Tambah deposit ke agent
hapus [agent]           - Hapus agent
edit [agent]            - Edit detail agent

# Permintaan Deposit
terima [request_id]     - Setujui permintaan deposit
tolak [request_id] [alasan] - Tolak permintaan deposit

# Laporan
laporan [agent]         - Laporan agent
status [agent]          - Status agent
```

#### 👤 Perintah Agent
```
# Order Voucher
order [profil] [qty]    - Pesan voucher
saldo                   - Cek saldo
profil                  - Tampilkan profil yang tersedia

# Manajemen Akun
info                    - Informasi akun
help                    - Tampilkan perintah
```

---

## 🛠️ Penggunaan

### 👑 Panel Admin

1. **Akses Dashboard Admin**
```
http://localhost:3010
Login: admin / admin123 (ubah password default)
```

2. **Fitur Utama**
   - **Dashboard**: Ringkasan penjualan, agent, dan transaksi
   - **Manajemen Agent**: Tambah, edit, hapus agent
   - **Profil Voucher**: Konfigurasi jenis voucher dan harga
   - **Transaksi**: Lihat semua transaksi sistem
   - **Request Deposit**: Setujui/tolak permintaan deposit agent
   - **Pengaturan**: Konfigurasi sistem dan preferensi

### 👤 Panel Agent

1. **Akses Dashboard Agent**
```
http://localhost:3010/agent-login.html
Login dengan kredensial agent
```

2. **Fitur Utama**
   - **Generate Voucher**: Buat voucher untuk pelanggan
   - **Request Deposit**: Minta penambahan saldo
   - **Lihat Statistik**: Riwayat penjualan dan transaksi personal
   - **Manajemen Profil**: Update informasi akun

### 🎫 Generate Voucher

```javascript
// Contoh: Generate voucher via API
POST /api/agent/generate-voucher
{
  "profileId": 1,
  "quantity": 5,
  "customerName": "John Doe",
  "customerPhone": "628123456789"
}
```

### 💰 Manajemen Deposit

```javascript
// Contoh: Request deposit via API
POST /api/agent/request-deposit
{
  "amount": 100000,
  "payment_method": "transfer_bank",
  "notes": "Transfer dari BCA",
  "priority": "normal"
}
```

---

## 📊 Dokumentasi API

### 🔐 Autentikasi
```bash
# Login
POST /api/auth/login
{
  "username": "agent1",
  "password": "password"
}

# Response
{
  "success": true,
  "token": "jwt-token-here",
  "user": {...}
}
```

### 🎫 Manajemen Voucher
```bash
# Ambil profil voucher
GET /api/profiles/active

# Generate voucher
POST /api/agent/generate-voucher
Authorization: Bearer {token}

# Ambil riwayat voucher
GET /api/agent/vouchers?page=1&limit=10
```

### 💰 Operasi Keuangan
```bash
# Request deposit
POST /api/agent/request-deposit
Authorization: Bearer {token}

# Ambil riwayat deposit
GET /api/agent/deposit-requests

# Admin: Setujui deposit
POST /api/admin/deposit-requests/approve/{id}
Authorization: Bearer {admin-token}
```

---

## 🏗️ Struktur Proyek

```
agent-voucher/
├── backend/
│   ├── config/
│   │   ├── database.js          # Konfigurasi database
│   │   └── migrate.js           # Migrasi database
│   ├── controllers/
│   │   ├── AuthController.js    # Logika autentikasi
│   │   ├── AgentController.js   # Operasi agent
│   │   ├── VoucherController.js # Manajemen voucher
│   │   └── DepositRequestController.js # Penanganan deposit
│   ├── middleware/
│   │   ├── auth.js              # Autentikasi JWT
│   │   └── validation.js        # Validasi input
│   ├── models/
│   │   ├── User.js              # Model user
│   │   ├── Voucher.js           # Model voucher
│   │   └── Transaction.js       # Model transaksi
│   ├── routes/
│   │   ├── auth.js              # Route auth
│   │   ├── agent.js             # Route agent
│   │   ├── admin.js             # Route admin
│   │   └── vouchers.js          # Route voucher
│   ├── services/
│   │   ├── WhatsAppGateway.js   # Integrasi WhatsApp
│   │   ├── MikrotikService.js   # API Mikrotik
│   │   └── EmailService.js      # Notifikasi email
│   └── server.js                # Entry point aplikasi utama
├── public/
│   ├── index.html               # Dashboard admin
│   ├── agent-login.html         # Halaman login agent
│   ├── agent-dashboard.html     # Dashboard agent
│   ├── app.js                   # JavaScript frontend
│   └── style.css                # Gaya CSS
├── config.env                   # Variabel environment
├── package.json                 # Dependencies
└── README.md                    # File ini
```

---

## 🔧 Development

### 🛠️ Setup Development
```bash
# Install development dependencies
npm install --include=dev

# Jalankan dalam mode development dengan auto-restart
npm run dev

# Jalankan tests
npm test

# Code linting
npm run lint

# Code formatting
npm run format
```

### 📝 Script yang Tersedia
```bash
npm start           # Jalankan server production
npm run dev         # Jalankan server development dengan nodemon
npm test            # Jalankan test suite
npm run lint        # Pengecekan kode ESLint
npm run format      # Format kode dengan Prettier
npm run build       # Build untuk production
npm run migrate     # Jalankan migrasi database
npm run seed        # Isi database dengan data contoh
```

### 🧪 Testing
```bash
# Jalankan semua test
npm test

# Jalankan file test spesifik
npm test -- --grep "Auth"

# Jalankan test dengan coverage
npm run test:coverage

# Jalankan integration test
npm run test:integration
```

---

## 🐳 Docker Deployment

### 🔧 Docker Setup
```bash
# Build image
docker build -t agent-voucher .

# Run container
docker run -d \
  --name agent-voucher \
  -p 3010:3010 \
  -v $(pwd)/backend/data:/app/backend/data \
  -v $(pwd)/config.env:/app/config.env \
  agent-voucher

# Using Docker Compose
docker-compose up -d
```

### 📝 docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3010:3010"
    volumes:
      - ./backend/data:/app/backend/data
      - ./config.env:/app/config.env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

---

## 🌐 Production Deployment

### 🚀 Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Restart
pm2 restart agent-voucher

# Stop
pm2 stop agent-voucher
```

### ⚙️ ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'agent-voucher',
    script: './backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3010
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 🔒 Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📚 Troubleshooting

### ❓ Common Issues

#### 🔐 Authentication Issues
```bash
# Reset admin password
node backend/scripts/reset-admin.js

# Clear sessions
rm -rf backend/sessions/*

# Check JWT secret
grep JWT_SECRET config.env
```

#### 📱 WhatsApp Connection Issues
```bash
# Clear WhatsApp session
rm -rf backend/sessions/whatsapp/*

# Restart application
pm2 restart agent-voucher

# Check WhatsApp setup page
curl http://localhost:3010/whatsapp-setup.html
```

#### 🗄️ Database Issues
```bash
# Reset database
rm backend/data/voucher_wifi.db
node backend/config/migrate.js

# Check database integrity
sqlite3 backend/data/voucher_wifi.db "PRAGMA integrity_check;"

# Backup database
cp backend/data/voucher_wifi.db backup_$(date +%Y%m%d).db
```

#### 🌐 Mikrotik Connection Issues
```bash
# Test Mikrotik connection
node backend/scripts/test-mikrotik.js

# Check Mikrotik API settings
grep MIKROTIK config.env

# Verify Mikrotik user permissions
# User needs: api, read, write permissions
```

### 📊 Optimasi Performa

```bash
# Aktifkan kompresi gzip
# Tambahkan ke nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;

# Optimasi database
sqlite3 backend/data/voucher_wifi.db "VACUUM;"
sqlite3 backend/data/voucher_wifi.db "ANALYZE;"

# Monitor performa
pm2 monit
```

---

## 🤝 Kontribusi

### 🔧 Panduan Development

1. **Fork repository**
2. **Buat feature branch**: `git checkout -b feature/fitur-keren`
3. **Commit perubahan**: `git commit -m 'Tambah fitur keren'`
4. **Push ke branch**: `git push origin feature/fitur-keren`
5. **Buka Pull Request**

### 📝 Gaya Kode
- Gunakan konfigurasi ESLint yang disediakan
- Ikuti conventional commit messages
- Tambahkan test untuk fitur baru
- Update dokumentasi

### 🧪 Panduan Testing
```bash
# Jalankan test sebelum commit
npm test

# Tambahkan test untuk fitur baru
# File test: tests/*.test.js

# Integration test
# File test: tests/integration/*.test.js
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **Lisensi MIT** - lihat file [LICENSE](LICENSE) untuk detailnya.

---

## 👨‍💻 Pembuat

**Ali Jaya**
- GitHub: [@alijayanet](https://github.com/alijayanet)
- Website: [alijayanet](https://alijaya.net)

---

## 🙏 Ucapan Terima Kasih

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Mikrotik RouterOS API](https://wiki.mikrotik.com/wiki/Manual:API) - Manajemen jaringan
- [Express.js](https://expressjs.com/) - Web framework
- [Bootstrap](https://getbootstrap.com/) - UI framework

---

## 📈 Roadmap

- [ ] **Aplikasi Mobile** - Aplikasi mobile React Native
- [ ] **Dukungan Multi-bahasa** - Internasionalisasi
- [ ] **Analitik Lanjutan** - Laporan dan grafik detail
- [ ] **Payment Gateway** - Integrasi pembayaran online
- [ ] **Multi-tenant** - Dukungan untuk multiple organisasi
- [ ] **API Webhooks** - Integrasi sistem eksternal
- [ ] **Keamanan Lanjutan** - Rate limiting, IP whitelisting
- [ ] **Backup & Restore** - Sistem backup otomatis

---

<div align="center">

**⭐ Berikan star pada repo ini jika bermanfaat!**

![Visitors](https://visitor-badge.laobi.icu/badge?page_id=alijayanet.agent-voucher)
[![GitHub stars](https://img.shields.io/github/stars/alijayanet/agent-voucher?style=social)](https://github.com/alijayanet/agent-voucher/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/alijayanet/agent-voucher?style=social)](https://github.com/alijayanet/agent-voucher/network/members)


</div>

