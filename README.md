# 🎫 Agent Voucher WiFi Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Mikrotik](https://img.shields.io/badge/Mikrotik-FF6B35?style=for-the-badge&logo=mikrotik&logoColor=white)

**Modern WiFi Voucher Management System with WhatsApp Integration & Mikrotik Support**

[📋 Features](#-features) • [🚀 Quick Start](#-quick-start) • [⚙️ Configuration](#%EF%B8%8F-configuration) • [📱 WhatsApp Setup](#-whatsapp-setup) • [🛠️ Usage](#%EF%B8%8F-usage)

</div>

---

## 📋 Features

### 🎯 Core Features
- **🎫 Voucher Management** - Create, manage, and track WiFi vouchers
- **👥 Agent System** - Multi-agent support with role-based access
- **💰 Balance Management** - Agent balance tracking and deposit requests
- **📱 WhatsApp Integration** - Automated notifications and bot commands
- **🌐 Mikrotik Integration** - Direct hotspot user management
- **🔐 Authentication** - JWT-based security with 2FA support

### 💼 Admin Features
- **📊 Dashboard** - Real-time statistics and analytics
- **👤 Agent Management** - Add, edit, and manage agents
- **💳 Deposit Control** - Approve/reject deposit requests
- **🎛️ Profile Management** - Voucher profiles and pricing
- **📈 Reports** - Transaction and sales reports
- **⚙️ Settings** - System configuration and preferences

### 📱 Agent Features
- **🎫 Generate Vouchers** - Create vouchers for customers
- **💰 Request Deposits** - Request balance top-ups
- **📊 Dashboard** - Personal sales statistics
- **📱 WhatsApp Orders** - Receive orders via WhatsApp
- **🔐 2FA Login** - Enhanced security with OTP

### 🤖 WhatsApp Bot Features
- **🛒 Order Processing** - Handle voucher orders automatically
- **📢 Notifications** - Real-time updates and alerts
- **💬 Admin Commands** - Manage system via WhatsApp
- **🎫 Auto-send Vouchers** - Direct voucher delivery to customers

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite |
| **Authentication** | JWT, bcryptjs |
| **WhatsApp** | Baileys (WhatsApp Web API) |
| **Network** | Mikrotik RouterOS API |
| **Frontend** | HTML5, CSS3, Bootstrap 5, JavaScript |
| **Real-time** | WebSocket connections |

---

## 🚀 Quick Start

### 📋 Prerequisites

```bash
# Required software
Node.js >= 16.0.0
npm >= 8.0.0
Git
```

### ⚡ One-Command Installation

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

### 🔧 Manual Installation Steps

#### 1. **Clone Repository**
```bash
git clone https://github.com/alijayanet/agent-voucher.git
cd agent-voucher
```

#### 2. **Install Dependencies**
```bash
npm install
```

#### 3. **Environment Configuration**
```bash
# Copy environment template
cp config.env.example config.env

# Edit configuration (see Configuration section below)
nano config.env
```

#### 4. **Database Setup**
```bash
# Initialize database and create tables
node backend/config/migrate.js
```

#### 5. **Create Admin User**
```bash
# Run admin setup (optional)
node backend/scripts/create-admin.js
```

#### 6. **Start Application**
```bash
# Development mode
npm run dev

# Production mode
npm start

# With PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
```

---

## ⚙️ Configuration

### 📝 Environment Variables (config.env)

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_PATH=./backend/data/voucher_wifi.db

# JWT Security
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Mikrotik Configuration
MIKROTIK_HOST=192.168.1.1
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your-mikrotik-password
MIKROTIK_PORT=8728

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./backend/sessions/whatsapp
WHATSAPP_AUTO_CONNECT=true

# Admin Phone Numbers (comma separated)
ADMIN_PHONES=6281234567890,6289876543210

# Application Settings
DASHBOARD_URL=https://your-domain.com
CLEANUP_INTERVAL=24h
SESSION_TIMEOUT=30d

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Upload Configuration
MAX_FILE_SIZE=5MB
UPLOAD_PATH=./backend/uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

### 🔐 Security Settings

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set proper file permissions
chmod 600 config.env
chmod 755 backend/data/
chmod 644 backend/data/voucher_wifi.db
```

---

## 📱 WhatsApp Setup

### 🔧 Initial Setup

1. **Start Application**
```bash
npm start
```

2. **Open WhatsApp Setup Page**
```
http://localhost:3000/whatsapp-setup.html
```

3. **Scan QR Code**
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Scan the QR code displayed

4. **Verify Connection**
   - Check console for "WhatsApp connected" message
   - Test by sending a message to one of admin phones

### 📱 WhatsApp Commands

#### 👑 Admin Commands
```
help                    - Show all commands
list                    - List all agents
pending                 - Show pending registrations

# Agent Management
daftar [name] [phone]   - Register new agent
deposit [agent] [amount] - Add deposit to agent
hapus [agent]           - Delete agent
edit [agent]            - Edit agent details

# Deposit Requests
terima [request_id]     - Approve deposit request
tolak [request_id] [reason] - Reject deposit request

# Reports
laporan [agent]         - Agent report
status [agent]          - Agent status
```

#### 👤 Agent Commands
```
# Order Vouchers
order [profile] [qty]   - Order vouchers
saldo                   - Check balance
profil                  - Show available profiles

# Account Management
info                    - Account information
help                    - Show commands
```

---

## 🛠️ Usage

### 👑 Admin Panel

1. **Access Admin Dashboard**
```
http://localhost:3000
Login: admin / admin123 (change default password)
```

2. **Key Features**
   - **Dashboard**: Overview of sales, agents, and transactions
   - **Agent Management**: Add, edit, remove agents
   - **Voucher Profiles**: Configure voucher types and pricing
   - **Transactions**: View all system transactions
   - **Deposit Requests**: Approve/reject agent deposit requests
   - **Settings**: System configuration and preferences

### 👤 Agent Panel

1. **Access Agent Dashboard**
```
http://localhost:3000/agent-login.html
Login with agent credentials
```

2. **Key Features**
   - **Generate Vouchers**: Create vouchers for customers
   - **Request Deposits**: Request balance top-ups
   - **View Statistics**: Personal sales and transaction history
   - **Profile Management**: Update account information

### 🎫 Voucher Generation

```javascript
// Example: Generate voucher via API
POST /api/agent/generate-voucher
{
  "profileId": 1,
  "quantity": 5,
  "customerName": "John Doe",
  "customerPhone": "628123456789"
}
```

### 💰 Deposit Management

```javascript
// Example: Request deposit via API
POST /api/agent/request-deposit
{
  "amount": 100000,
  "payment_method": "transfer_bank",
  "notes": "Transfer from BCA",
  "priority": "normal"
}
```

---

## 📊 API Documentation

### 🔐 Authentication
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

### 🎫 Voucher Management
```bash
# Get voucher profiles
GET /api/profiles/active

# Generate voucher
POST /api/agent/generate-voucher
Authorization: Bearer {token}

# Get voucher history
GET /api/agent/vouchers?page=1&limit=10
```

### 💰 Financial Operations
```bash
# Request deposit
POST /api/agent/request-deposit
Authorization: Bearer {token}

# Get deposit history
GET /api/agent/deposit-requests

# Admin: Approve deposit
POST /api/admin/deposit-requests/approve/{id}
Authorization: Bearer {admin-token}
```

---

## 🏗️ Project Structure

```
agent-voucher/
├── backend/
│   ├── config/
│   │   ├── database.js          # Database configuration
│   │   └── migrate.js           # Database migrations
│   ├── controllers/
│   │   ├── AuthController.js    # Authentication logic
│   │   ├── AgentController.js   # Agent operations
│   │   ├── VoucherController.js # Voucher management
│   │   └── DepositRequestController.js # Deposit handling
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── validation.js        # Input validation
│   ├── models/
│   │   ├── User.js              # User model
│   │   ├── Voucher.js           # Voucher model
│   │   └── Transaction.js       # Transaction model
│   ├── routes/
│   │   ├── auth.js              # Auth routes
│   │   ├── agent.js             # Agent routes
│   │   ├── admin.js             # Admin routes
│   │   └── vouchers.js          # Voucher routes
│   ├── services/
│   │   ├── WhatsAppGateway.js   # WhatsApp integration
│   │   ├── MikrotikService.js   # Mikrotik API
│   │   └── EmailService.js      # Email notifications
│   └── server.js                # Main application entry
├── public/
│   ├── index.html               # Admin dashboard
│   ├── agent-login.html         # Agent login page
│   ├── agent-dashboard.html     # Agent dashboard
│   ├── app.js                   # Frontend JavaScript
│   └── style.css                # Styles
├── config.env                   # Environment variables
├── package.json                 # Dependencies
└── README.md                    # This file
```

---

## 🔧 Development

### 🛠️ Development Setup
```bash
# Install development dependencies
npm install --include=dev

# Run in development mode with auto-restart
npm run dev

# Run tests
npm test

# Code linting
npm run lint

# Code formatting
npm run format
```

### 📝 Scripts Available
```bash
npm start           # Start production server
npm run dev         # Start development server with nodemon
npm test            # Run test suite
npm run lint        # ESLint code checking
npm run format      # Prettier code formatting
npm run build       # Build for production
npm run migrate     # Run database migrations
npm run seed        # Seed database with sample data
```

### 🧪 Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "Auth"

# Run tests with coverage
npm run test:coverage

# Run integration tests
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
  -p 3000:3000 \
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
      - "3000:3000"
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
      PORT: 3000
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
        proxy_pass http://localhost:3000;
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
curl http://localhost:3000/whatsapp-setup.html
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

### 📊 Performance Optimization

```bash
# Enable gzip compression
# Add to nginx.conf
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;

# Database optimization
sqlite3 backend/data/voucher_wifi.db "VACUUM;"
sqlite3 backend/data/voucher_wifi.db "ANALYZE;"

# Monitor performance
pm2 monit
```

---

## 🤝 Contributing

### 🔧 Development Guidelines

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### 📝 Code Style
- Use ESLint configuration provided
- Follow conventional commit messages
- Add tests for new features
- Update documentation

### 🧪 Testing Guidelines
```bash
# Run tests before committing
npm test

# Add tests for new features
# Test files: tests/*.test.js

# Integration tests
# Test files: tests/integration/*.test.js
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Ali Jaya**
- GitHub: [@alijayanet](https://github.com/alijayanet)
- Website: [alijayanet.com](https://alijayanet.com)

---

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Mikrotik RouterOS API](https://wiki.mikrotik.com/wiki/Manual:API) - Network management
- [Express.js](https://expressjs.com/) - Web framework
- [Bootstrap](https://getbootstrap.com/) - UI framework

---

## 📈 Roadmap

- [ ] **Mobile App** - React Native mobile application
- [ ] **Multi-language Support** - Internationalization
- [ ] **Advanced Analytics** - Detailed reporting and charts
- [ ] **Payment Gateway** - Online payment integration
- [ ] **Multi-tenant** - Support for multiple organizations
- [ ] **API Webhooks** - External system integration
- [ ] **Advanced Security** - Rate limiting, IP whitelisting
- [ ] **Backup & Restore** - Automated backup system

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

![Visitors](https://visitor-badge.laobi.icu/badge?page_id=alijayanet.agent-voucher)
[![GitHub stars](https://img.shields.io/github/stars/alijayanet/agent-voucher?style=social)](https://github.com/alijayanet/agent-voucher/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/alijayanet/agent-voucher?style=social)](https://github.com/alijayanet/agent-voucher/network/members)

</div>