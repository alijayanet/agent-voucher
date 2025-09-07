// Main JavaScript file for Voucher WiFi App
console.log('🚀 Voucher WiFi App JavaScript loaded!');
console.log('📅 FILE VERSION: 2024-12-03-TOKEN-FIX-v1');
console.log('🔧 FIXED: Token "null" string handling - Robust authentication');

// IMMEDIATE FUNCTION DEFINITION - CRITICAL FIX
console.log('🔧 CRITICAL: Setting up showDepositRequestsModal immediately...');

// Define function IMMEDIATELY to prevent "not defined" errors
window.showDepositRequestsModal = function() {
    console.log('🎯 CALLED: showDepositRequestsModal (immediate version)');
    
    // Check if full implementation is ready
    if (typeof window.showDepositRequestsModalFull === 'function') {
        console.log('✅ FOUND: Full implementation available, calling...');
        try {
            return window.showDepositRequestsModalFull();
        } catch (error) {
            console.error('❌ ERROR: Full implementation failed:', error);
            alert('Error opening dashboard: ' + error.message);
        }
    } else {
        console.warn('⚠️ WAITING: Full implementation not ready, retrying...');
        
        // Show loading message
        const alertMsg = 'Dashboard sedang dimuat, mohon tunggu...';
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = `
            <div class="alert alert-info alert-dismissible fade show" role="alert">
                <i class="fas fa-spinner fa-spin me-2"></i>${alertMsg}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        document.body.insertBefore(alertDiv, document.body.firstChild);
        
        // Retry mechanism
        setTimeout(() => {
            if (typeof window.showDepositRequestsModalFull === 'function') {
                console.log('🔄 SUCCESS: Retry successful, calling full implementation...');
                alertDiv.remove();
                window.showDepositRequestsModalFull();
            } else {
                console.error('❌ FAILED: Function still not available after retry');
                alertDiv.remove();
                
                // Show error message with refresh option
                const errorDiv = document.createElement('div');
                errorDiv.innerHTML = `
                    <div class="alert alert-danger alert-dismissible fade show" role="alert">
                        <i class="fas fa-exclamation-triangle me-2"></i>Dashboard tidak dapat dimuat. 
                        <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="location.reload()">
                            <i class="fas fa-refresh me-1"></i>Refresh Halaman
                        </button>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                document.body.insertBefore(errorDiv, document.body.firstChild);
            }
        }, 1000);
    }
};

console.log('✅ SUCCESS: showDepositRequestsModal defined immediately!');
console.log('🔍 VERIFY: Function type:', typeof window.showDepositRequestsModal);

// Global variables
let currentSection = 'dashboard';
let currentVoucherPage = 1;
let currentTransactionPage = 1;
let currentHotspotUsersPage = 1; // Tambah tracking halaman hotspot users
let currentHotspotUsersLimit = 50; // Tambah tracking limit per halaman
let voucherProfiles = [];
let currentUser = null;
let authToken = null;
let isLoadingAgents = false;
let isLoadingAgentStats = false;

// 🔧 UNIVERSAL API BASE - Works on any server/domain
function getApiBase() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Check if we're on localhost/IP (development)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        // Local development - always use port 3010
        return `${protocol}//${hostname}:3010/api`;
    } else {
        // Production domain - check if port is in URL
        if (port && port !== '80' && port !== '443') {
            // Custom port specified in URL
            return `${protocol}//${hostname}:${port}/api`;
        } else {
            // Standard port - assume same origin
            return `${protocol}//${hostname}/api`;
        }
    }
}

const API_BASE = getApiBase();
console.log('🌐 Universal API_BASE (Admin):', API_BASE);

// Role helpers
function isAdmin() {
    return currentUser && (currentUser.role === 'admin' || currentUser.is_admin === true);
}

function updateNavigationForRole() {
    try {
        const agentNavLink = document.querySelector("a.nav-link[href='#agents']");
        if (agentNavLink) {
            const li = agentNavLink.closest('li');
            if (!isAdmin()) {
                li && (li.style.display = 'none');
            } else {
                li && (li.style.display = 'block');
            }
        }
    } catch (e) {
        console.error('updateNavigationForRole error:', e);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM Content Loaded event fired!');
    
    // Check if user is logged in
    console.log('🔐 Checking auth status...');
    checkAuthStatus();
    
    // Set up event listeners
    console.log('🎧 Setting up event listeners...');
    setupEventListeners();
    
    console.log('✅ Voucher WiFi App initialized successfully!');
});

// Setup event listeners
function setupEventListeners() {
            // Profile select change handler
        document.getElementById('sellProfileSelect').addEventListener('change', function() {
            updateProfileDetails(this.value, 'profileDetails');
        });

        // Profile search input handler
        const profileSearchInput = document.getElementById('profileSearch');
        if (profileSearchInput) {
            profileSearchInput.addEventListener('input', function() {
                // Auto search with debounce
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    searchProfiles();
                }, 500);
            });
        }
    
    // Navigation event delegation
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('nav-link') && e.target.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            const sectionName = e.target.getAttribute('href').substring(1);
            showSection(sectionName);
        }
    });
}

// Authentication Functions
async function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    
    // 🔧 FIX: Handle "null" string vs null value
    if (!token || token === 'null' || token === 'undefined') {
        console.log('🚫 No valid token found, clearing storage and showing login');
        localStorage.removeItem('authToken'); // Clean up invalid token
        authToken = null;
        showLoginModal();
        return;
    }
    
    console.log('🔐 Found valid token, validating with server...');
    
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
                        if (result.success) {
                    // 🔧 FIX: Set authToken variable with proper validation
                    authToken = token;
                    currentUser = result.user;
                    console.log('✅ Auth validated successfully for user:', result.user.username);
                    console.log('🔑 AuthToken set:', authToken ? `${authToken.substring(0, 20)}...` : 'NULL');
                    
                    showUserInterface();
                    loadInitialData();

                    // Redirect agent to agent dashboard
                    if (result.user.role === 'agent' && !window.location.pathname.includes('agent-dashboard')) {
                        window.location.href = '/agent-dashboard';
                    }
                } else {
                    console.log('❌ Token validation failed:', result.message);
                    localStorage.removeItem('authToken');
                    authToken = null;
                    showLoginModal();
                }
    } catch (error) {
        console.error('❌ Auth check error:', error);
        localStorage.removeItem('authToken');
        authToken = null; // 🔧 FIX: Ensure authToken is null on error
        showLoginModal();
    }
}

function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
    
    // Hide main content
    document.querySelector('.container').style.display = 'none';
}

function showUserInterface() {
    // Show main content
    document.querySelector('.container').style.display = 'block';
    
    // Update user menu
    document.getElementById('userMenu').style.display = 'block';
    document.getElementById('currentUserName').textContent = currentUser.full_name || currentUser.username;

    // Apply role-based navigation visibility
    updateNavigationForRole();
}

async function doLogin() {
    try {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            showAlert('Username dan password harus diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
                    if (result.success) {
                localStorage.setItem('authToken', result.token);
                authToken = result.token;
                currentUser = result.user;

                // Hide login modal
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();

                showUserInterface();
                loadInitialData();
                showAlert('Login berhasil!', 'success');

                // Redirect agent to agent dashboard if logged in via main login
                if (result.user.role === 'agent') {
                    setTimeout(() => {
                        window.location.href = '/agent-dashboard';
                    }, 1000);
                }
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Error saat login', 'danger');
    } finally {
        showLoading(false);
    }
}

async function doLogout() {
    try {
        if (authToken) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    
    // Hide user interface
    document.querySelector('.container').style.display = 'none';
    document.getElementById('userMenu').style.display = 'none';
    
    // Show login modal
    showLoginModal();
    showAlert('Logout berhasil', 'info');
}

function loadInitialData() {
    loadDashboardData();
    loadVoucherProfiles();
}

// Helper function untuk request dengan auth
async function authenticatedFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    // 🔧 FIX: Robust token validation
    if (authToken && authToken !== 'null' && authToken !== 'undefined' && authToken.trim() !== '') {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔑 Auth header added:', `Bearer ${authToken.substring(0, 20)}...`);
    } else {
        console.warn('⚠️ No valid auth token available for:', url);
        console.warn('🔍 Current authToken value:', authToken);
        
        // Try to get fresh token from localStorage
        const storedToken = localStorage.getItem('authToken');
        if (storedToken && storedToken !== 'null' && storedToken !== 'undefined' && storedToken.trim() !== '') {
            authToken = storedToken; // Restore authToken
            headers['Authorization'] = `Bearer ${authToken}`;
            console.log('🔄 Restored token from localStorage:', `Bearer ${authToken.substring(0, 20)}...`);
        } else {
            console.error('❌ No valid token found, redirecting to login');
            // Don't redirect here, let the API call fail and handle 401
        }
    }
    
    console.log('🌐 Fetching URL:', url);
    console.log('📋 Headers:', headers);
    
    return fetch(url, {
        ...options,
        headers
    });
}

// Show/hide sections
function showSection(sectionName) {
    try {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionName);
        
        if (!targetSection) {
            console.error('showSection: Section not found:', sectionName);
            return;
        }

        // Guard: block non-admin from accessing agents section
        if (sectionName === 'agents' && !isAdmin()) {
            showAlert('Halaman Agent hanya untuk Admin', 'warning');
            document.getElementById('dashboard').style.display = 'block';
            currentSection = 'dashboard';
            return;
        }
        
        targetSection.style.display = 'block';
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[href="#${sectionName}"]`);
        
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        currentSection = sectionName;
        
        // Load section-specific data
        switch(sectionName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'vouchers':
                loadVouchers();
                break;
            case 'transactions':
                loadTransactions();
                break;
            case 'profiles':
                loadProfiles();
                break;
            case 'mikrotik':
                loadMikrotikStatus();
                // Load konfigurasi yang tersimpan
                loadMikrotikConfig();
                break;
            case 'profile':
                loadUserProfile();
                break;
            case 'agents':
                // Tampilkan daftar agent dan statistik tanpa memanggil showSection lagi (hindari rekursi)
                loadAgents();
                loadAgentStats();
                break;
            case 'whatsapp':
                // Muat status WhatsApp Gateway tanpa memanggil showSection lagi (hindari rekursi)
                getWhatsAppStatus();
                loadWhatsAppOrders();
                break;
        }
        
    } catch (error) {
        console.error('showSection: Error occurred:', error);
        console.error('showSection: Error stack:', error.stack);
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        showLoading(true);
        
        // Load statistics
        const [voucherStats, transactionStats, recentTransactions] = await Promise.all([
            authenticatedFetch(`${API_BASE}/vouchers/stats`).then(r => r.json()),
            authenticatedFetch(`${API_BASE}/transactions/dashboard`).then(r => r.json()),
            authenticatedFetch(`${API_BASE}/transactions?limit=5`).then(r => r.json())
        ]);
        
        // Update statistics cards
        if (voucherStats.success) {
            const stats = voucherStats.data;
            document.getElementById('totalVouchers').textContent = stats.total_vouchers || 0;
            document.getElementById('soldVouchers').textContent = stats.used_vouchers || 0;
        }
        
        if (transactionStats.success) {
            const stats = transactionStats.data.overview;
            document.getElementById('todayRevenue').textContent = formatCurrency(stats.today_revenue || 0);
            document.getElementById('totalRevenue').textContent = formatCurrency(stats.total_revenue || 0);
        }
        
        // Update recent transactions
        if (recentTransactions.success) {
            updateRecentTransactionsTable(recentTransactions.data.transactions);
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error loading dashboard data', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateRecentTransactionsTable(transactions) {
    const tbody = document.getElementById('recentTransactions');
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada transaksi</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${transaction.id}</td>
            <td>${transaction.customer_name || 'Guest'}</td>
            <td>${transaction.profile || '-'}</td>
            <td>${formatCurrency(transaction.amount)}</td>
            <td>${formatDateTime(transaction.created_at)}</td>
            <td><span class="badge bg-success">Selesai</span></td>
        </tr>
    `).join('');
}

// Voucher functions
async function loadVoucherProfiles() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/profiles/active`);
        const result = await response.json();
        
        if (result.success) {
            voucherProfiles = result.data;
            updateProfileSelects();
        }
    } catch (error) {
        console.error('Error loading voucher profiles:', error);
    }
}

function updateProfileSelects(mikrotikProfiles = null) {
    // Only update elements that actually exist on current page
    const possibleSelects = ['sellProfileSelect', 'createProfileSelect', 'generateProfileSelect'];
    
    possibleSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) {
            // Element doesn't exist on this page, skip silently
            return;
        }
        
        console.log(`🔄 Updating select: ${selectId}`);
        
        try {
        select.innerHTML = '<option value="">Pilih profil voucher...</option>';
        
        voucherProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.name;
            option.textContent = `${profile.name} - ${formatCurrency(profile.selling_price || 0)} - ${profile.duration}`;
            option.dataset.profile = JSON.stringify(profile);
            select.appendChild(option);
        });
            
            console.log(`✅ Successfully updated ${selectId} with ${voucherProfiles.length} profiles`);
        } catch (error) {
            console.error(`❌ Error updating select ${selectId}:`, error);
        }
    });
    
    // Update Mikrotik user profile select if profiles provided
    if (mikrotikProfiles) {
        const mikrotikSelect = document.getElementById('mikrotikUserProfile');
        mikrotikSelect.innerHTML = '<option value="default">default</option>';
        
        mikrotikProfiles.forEach(profile => {
            if (profile.name && profile.name !== 'default') {
                const option = document.createElement('option');
                option.value = profile.name;
                option.textContent = profile.name;
                mikrotikSelect.appendChild(option);
            }
        });
    }
}

function updateProfileDetails(profileName, detailsElementId) {
    const detailsElement = document.getElementById(detailsElementId);
    
    if (!profileName) {
        detailsElement.style.display = 'none';
        return;
    }
    
    const profile = voucherProfiles.find(p => p.name === profileName);
    if (!profile) {
        detailsElement.style.display = 'none';
        return;
    }
    
    detailsElement.innerHTML = `
        <h6><i class="fas fa-info-circle me-2"></i>Detail Profil</h6>
        <div class="row">
            <div class="col-6"><strong>Nama:</strong> ${profile.name}</div>
            <div class="col-6"><strong>Harga Jual:</strong> ${formatCurrency(profile.selling_price || 0)}</div>
            <div class="col-6"><strong>Durasi:</strong> ${profile.duration}</div>
            <div class="col-6"><strong>Bandwidth:</strong> ${profile.bandwidth_limit || 'Unlimited'}</div>
        </div>
        ${profile.description ? `<div class="mt-2"><small>${profile.description}</small></div>` : ''}
    `;
    detailsElement.style.display = 'block';
}

async function loadVouchers(page = 1) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers?page=${page}&limit=10`);
        const result = await response.json();
        
        if (result.success) {
            updateVouchersTable(result.data.vouchers);
            updateVoucherPagination(result.data);
        } else {
            showAlert('Error loading vouchers: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading vouchers:', error);
        showAlert('Error loading vouchers', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateVouchersTable(vouchers) {
    const tbody = document.getElementById('vouchersList');
    
    if (!vouchers || vouchers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Belum ada voucher</td></tr>';
        return;
    }
    
    tbody.innerHTML = vouchers.map(voucher => `
        <tr>
            <td>${voucher.id}</td>
            <td><code>${voucher.username}</code></td>
            <td><code>${voucher.password}</code></td>
            <td><span class="badge bg-info">${voucher.profile}</span></td>
            <td>${formatCurrency(voucher.agent_price || 0)}</td>
            <td>${getVoucherStatusBadge(voucher)}</td>
            <td>${formatDateTime(voucher.created_at)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" title="Detail" onclick="showVoucherDetails(${voucher.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-success" title="Print" onclick="printVoucherCard(${voucher.id})">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-outline-secondary" title="Download" onclick="downloadVoucherCard(${voucher.id})">
                        <i class="fas fa-download"></i>
                    </button>
                    ${!voucher.is_used ? `
                        <button class="btn btn-outline-danger" title="Hapus" onclick="deleteVoucher(${voucher.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function printVoucherCard(voucherId) {
    try {
        const url = `/print-vouchers.html?ids=${voucherId}`;
        const w = window.open(url, '_blank');
        if (!w) {
            showAlert('Popup diblokir. Izinkan popup untuk mencetak voucher.', 'warning');
        }
    } catch (e) {
        showAlert('Gagal membuka halaman cetak', 'danger');
    }
}

function downloadVoucherCard(voucherId) {
    showAlert('Fitur download voucher (PDF) akan segera hadir', 'info');
}

function getVoucherStatusBadge(voucher) {
    if (voucher.is_used) {
        return '<span class="badge bg-success">Digunakan</span>';
    }
    
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        return '<span class="badge bg-danger">Expired</span>';
    }
    
    return '<span class="badge bg-warning">Belum Digunakan</span>';
}

function updateVoucherPagination(data) {
    const pagination = document.getElementById('voucherPagination');
    const { page, totalPages } = data;
    
    let html = '';
    
    // Previous button
    if (page > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadVouchers(${page - 1})">Previous</a></li>`;
    }
    
    // Page numbers
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadVouchers(${i})">${i}</a>
        </li>`;
    }
    
    // Next button
    if (page < totalPages) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadVouchers(${page + 1})">Next</a></li>`;
    }
    
    pagination.innerHTML = html;
}

// Modal functions
function showSellVoucherModal() {
    const modal = new bootstrap.Modal(document.getElementById('sellVoucherModal'));
    
    // Reset form
    document.getElementById('sellVoucherForm').reset();
    document.getElementById('profileDetails').style.display = 'none';
    
    modal.show();
}

async function showDepositRequestsModalFull() {
    console.log('🎯 showDepositRequestsModalFull called (full implementation)');
    
    try {
        const modalElement = document.getElementById('depositRequestsModal');
        if (!modalElement) {
            console.error('❌ Modal element #depositRequestsModal not found');
            showAlert('Modal tidak ditemukan. Silakan refresh halaman.', 'danger');
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        
        // Load deposit requests data
        console.log('📊 Loading deposit requests data...');
        await loadDepositRequests();
        
        console.log('🎉 Opening modal...');
        modal.show();
    } catch (error) {
        console.error('❌ Error opening deposit requests modal:', error);
        showAlert('Terjadi kesalahan saat membuka dashboard: ' + error.message, 'danger');
    }
}

// Alias for backward compatibility
window.showDepositRequestsModal = async function() {
    console.log('🎯 showDepositRequestsModal called (window alias)');
    return await showDepositRequestsModalFull();
};

async function showDepositAgentModal() {
    try {
        // Load agents list for selection
        const response = await authenticatedFetch(`${API_BASE}/agents`);
        const result = await response.json();
        
        if (!result.success) {
            showAlert('Gagal memuat daftar agent: ' + result.message, 'danger');
            return;
        }
        
        const agents = Array.isArray(result.data) ? result.data : (result.data.agents || result.data.users || result.data.items || []);
        
        // Create agent selection dropdown
        const agentSelectHtml = agents.map(agent => 
            `<option value="${agent.id}" data-balance="${agent.balance || 0}" data-phone="${agent.phone || ''}">${agent.full_name} (${agent.username}) - Saldo: Rp ${(agent.balance || 0).toLocaleString('id-ID')}</option>`
        ).join('');
        
        // Update modal content with agent dropdown
        const modalBody = document.querySelector('#depositAgentModal .modal-body');
        modalBody.innerHTML = `
            <div class="mb-3">
                <label class="form-label"><i class="fas fa-user me-1"></i>Pilih Agent *</label>
                <select class="form-control" id="selectDepositAgent" required>
                    <option value="">-- Pilih Agent --</option>
                    ${agentSelectHtml}
                </select>
                <div class="form-text">Pilih agent yang akan menerima deposit saldo</div>
            </div>
            
            <div id="agentInfoSection" style="display: none;">
                <div class="card mb-3" style="background-color: #f8f9fa; border: 1px solid #e9ecef;">
                    <div class="card-body py-2">
                        <h6 class="card-title mb-2"><i class="fas fa-info-circle me-1 text-primary"></i>Informasi Agent</h6>
                        <div class="row">
                            <div class="col-sm-6">
                                <small class="text-muted">Nama Agent:</small>
                                <div id="selectedAgentName" class="fw-bold">-</div>
                            </div>
                            <div class="col-sm-6">
                                <small class="text-muted">Username:</small>
                                <div id="selectedAgentUsername" class="fw-bold">-</div>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-sm-6">
                                <small class="text-muted">Saldo Saat Ini:</small>
                                <div id="selectedAgentBalance" class="fw-bold text-primary">-</div>
                            </div>
                            <div class="col-sm-6">
                                <small class="text-muted">WhatsApp:</small>
                                <div id="selectedAgentPhone" class="fw-bold">-</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mb-3">
                <label for="depositAmount" class="form-label"><i class="fas fa-money-bill-wave me-1"></i>Jumlah Deposit *</label>
                <div class="input-group">
                    <span class="input-group-text">Rp</span>
                    <input type="number" class="form-control" id="depositAmount" required min="1000" step="1000" placeholder="0">
                </div>
                <div class="form-text">Minimal deposit Rp 1.000</div>
            </div>
            
            <div id="newBalancePreview" class="mb-3" style="display: none;">
                <div class="alert alert-success py-2">
                    <small class="text-muted">Saldo setelah deposit:</small>
                    <div id="previewNewBalance" class="fw-bold text-success">-</div>
                </div>
            </div>
            
            <div class="mb-3">
                <label for="depositNotes" class="form-label"><i class="fas fa-sticky-note me-1"></i>Catatan</label>
                <textarea class="form-control" id="depositNotes" rows="2" placeholder="Contoh: Deposit awal, Top up saldo untuk promosi, dll"></textarea>
            </div>
        `;
        
        // Add event listener to agent selection
        const agentSelect = document.getElementById('selectDepositAgent');
        const agentInfoSection = document.getElementById('agentInfoSection');
        const newBalancePreview = document.getElementById('newBalancePreview');
        const depositAmountInput = document.getElementById('depositAmount');
        
        agentSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            
            if (selectedOption.value) {
                // Extract agent data from option text and attributes
                const optionText = selectedOption.textContent;
                const [namePart, balancePart] = optionText.split(' - Saldo: ');
                const [fullName, username] = namePart.split(' (');
                const cleanUsername = username ? username.replace(')', '') : '';
                
                const balance = parseInt(selectedOption.getAttribute('data-balance') || 0);
                const phone = selectedOption.getAttribute('data-phone') || 'Tidak ada';
                
                // Update agent info
                document.getElementById('selectedAgentName').textContent = fullName;
                document.getElementById('selectedAgentUsername').textContent = cleanUsername;
                document.getElementById('selectedAgentBalance').textContent = `Rp ${balance.toLocaleString('id-ID')}`;
                document.getElementById('selectedAgentPhone').textContent = phone === '' ? 'Tidak ada' : phone;
                
                // Store current balance for calculation
                agentSelect.dataset.currentBalance = balance;
                
                agentInfoSection.style.display = 'block';
            } else {
                agentInfoSection.style.display = 'none';
                newBalancePreview.style.display = 'none';
            }
        });
        
        // Add event listener to deposit amount for preview
        depositAmountInput.addEventListener('input', function() {
            const currentBalance = parseInt(agentSelect.dataset.currentBalance || 0);
            const depositAmount = parseInt(this.value || 0);
            
            if (agentSelect.value && depositAmount > 0) {
                const newBalance = currentBalance + depositAmount;
                document.getElementById('previewNewBalance').textContent = `Rp ${newBalance.toLocaleString('id-ID')}`;
                newBalancePreview.style.display = 'block';
            } else {
                newBalancePreview.style.display = 'none';
            }
        });
    
    // Reset form
        document.getElementById('depositAgentForm').reset();
    
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('depositAgentModal'));
    modal.show();
        
    } catch (error) {
        console.error('Error loading agents for deposit:', error);
        showAlert('Error memuat daftar agent', 'danger');
    }
}

async function sellVoucher() {
    try {
        const profileName = document.getElementById('sellProfileSelect').value;
        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        
        if (!profileName) {
            showAlert('Pilih profil voucher terlebih dahulu', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/sell`, {
            method: 'POST',
            body: JSON.stringify({
                profile_name: profileName,
                customer_name: customerName,
                customer_phone: customerPhone,
                payment_method: paymentMethod
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Voucher berhasil dijual!', 'success');
            
            // Show voucher details
            showVoucherDetailsModal(result.data.voucher);
            
            // Close sell modal
            bootstrap.Modal.getInstance(document.getElementById('sellVoucherModal')).hide();
            
            // Refresh data
            if (currentSection === 'dashboard') {
                loadDashboardData();
            } else if (currentSection === 'vouchers') {
                loadVouchers();
            }
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error selling voucher:', error);
        showAlert('Error selling voucher', 'danger');
    } finally {
        showLoading(false);
    }
}

// Global variables for deposit requests management
let allDepositRequests = [];
let filteredDepositRequests = [];
let currentDepositPage = 1;
const depositRequestsPerPage = 10;

async function loadDepositRequests() {
    try {
        showLoading(true, 'depositRequestsTable');
        
        const response = await authenticatedFetch(`${API_BASE}/admin/deposit-requests`);
        const result = await response.json();
        
        if (result.success) {
            allDepositRequests = result.data.requests || [];
            filteredDepositRequests = [...allDepositRequests];
            
            // Update stats
            updateDepositRequestsStats(result.data.stats);
            
            // Render table and pagination
            renderDepositRequestsTable();
            renderDepositRequestsPagination();
        } else {
            showAlert('Error loading deposit requests: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading deposit requests:', error);
        showAlert('Terjadi kesalahan saat memuat data', 'danger');
    } finally {
        showLoading(false, 'depositRequestsTable');
    }
}

function updateDepositRequestsStats(stats) {
    // Update stats cards
    document.getElementById('pendingRequestsCount').textContent = stats.pending.count || 0;
    document.getElementById('pendingRequestsAmount').textContent = `Rp ${(stats.pending.amount || 0).toLocaleString('id-ID')}`;
    
    document.getElementById('approvedTodayCount').textContent = stats.approvedToday.count || 0;
    document.getElementById('approvedTodayAmount').textContent = `Rp ${(stats.approvedToday.amount || 0).toLocaleString('id-ID')}`;
    
    document.getElementById('rejectedTodayCount').textContent = stats.rejectedToday.count || 0;
    document.getElementById('rejectedTodayAmount').textContent = `Rp ${(stats.rejectedToday.amount || 0).toLocaleString('id-ID')}`;
    
    document.getElementById('totalRequestsCount').textContent = stats.total.count || 0;
    document.getElementById('totalRequestsAmount').textContent = `Rp ${(stats.total.amount || 0).toLocaleString('id-ID')}`;
}

function renderDepositRequestsTable() {
    const tbody = document.getElementById('depositRequestsTable');
    const startIndex = (currentDepositPage - 1) * depositRequestsPerPage;
    const endIndex = startIndex + depositRequestsPerPage;
    const currentRequests = filteredDepositRequests.slice(startIndex, endIndex);
    
    if (currentRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data</td></tr>';
            return;
        }
        
    const priorityText = {
        'normal': 'Normal',
        'urgent': 'Urgent', 
        'asap': 'ASAP'
    };
    
    const priorityClass = {
        'normal': 'badge bg-secondary',
        'urgent': 'badge bg-warning',
        'asap': 'badge bg-danger'
    };
    
    const statusText = {
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };
    
    const statusClass = {
        'pending': 'badge bg-warning',
        'approved': 'badge bg-success', 
        'rejected': 'badge bg-danger'
    };
    
    tbody.innerHTML = currentRequests.map(request => `
        <tr>
            <td>
                ${request.status === 'pending' ? `<input type="checkbox" class="request-checkbox" data-id="${request.id}">` : ''}
            </td>
            <td>#${request.id}</td>
            <td>
                <div class="fw-bold">${request.agent_name}</div>
                <small class="text-muted">${request.username}</small>
            </td>
            <td>Rp ${(request.amount || 0).toLocaleString('id-ID')}</td>
            <td>${request.payment_method || '-'}</td>
            <td><span class="${priorityClass[request.priority] || 'badge bg-secondary'}">${priorityText[request.priority] || 'Normal'}</span></td>
            <td><span class="${statusClass[request.status] || 'badge bg-secondary'}">${statusText[request.status] || request.status}</span></td>
            <td>${new Date(request.created_at).toLocaleDateString('id-ID')}</td>
            <td>
                ${request.status === 'pending' ? `
                    <button class="btn btn-sm btn-success me-1" onclick="approveDepositRequest(${request.id})" title="Approve">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectDepositRequest(${request.id})" title="Reject">
                        <i class="fas fa-times"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-info" onclick="viewDepositRequestDetail(${request.id})" title="Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                `}
            </td>
        </tr>
    `).join('');
    
    // Update bulk action button
    updateBulkActionButton();
}

function renderDepositRequestsPagination() {
    const pagination = document.getElementById('depositRequestsPagination');
    const totalPages = Math.ceil(filteredDepositRequests.length / depositRequestsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
            return;
        }
        
    let paginationHTML = '';
    
    // Previous button
    if (currentDepositPage > 1) {
        paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changeDepositPage(${currentDepositPage - 1})">Previous</a></li>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const activeClass = i === currentDepositPage ? 'active' : '';
        paginationHTML += `<li class="page-item ${activeClass}"><a class="page-link" href="#" onclick="changeDepositPage(${i})">${i}</a></li>`;
    }
    
    // Next button
    if (currentDepositPage < totalPages) {
        paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="changeDepositPage(${currentDepositPage + 1})">Next</a></li>`;
    }
    
    pagination.innerHTML = paginationHTML;
}

function changeDepositPage(page) {
    currentDepositPage = page;
    renderDepositRequestsTable();
    renderDepositRequestsPagination();
}

function filterDepositRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    
    filteredDepositRequests = allDepositRequests.filter(request => {
        const statusMatch = !statusFilter || request.status === statusFilter;
        const priorityMatch = !priorityFilter || request.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });
    
    currentDepositPage = 1;
    renderDepositRequestsTable();
    renderDepositRequestsPagination();
}

function refreshDepositRequests() {
    loadDepositRequests();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllRequests');
    const checkboxes = document.querySelectorAll('.request-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateBulkActionButton();
}

function updateBulkActionButton() {
    const checkboxes = document.querySelectorAll('.request-checkbox:checked');
    const bulkBtn = document.getElementById('bulkApproveBtn');
    
    if (checkboxes.length > 0) {
        bulkBtn.disabled = false;
        bulkBtn.textContent = `Approve Selected (${checkboxes.length})`;
    } else {
        bulkBtn.disabled = true;
        bulkBtn.innerHTML = '<i class="fas fa-check me-1"></i>Approve Selected';
    }
}

async function approveDepositRequest(requestId) {
    if (!confirm('Approve request deposit ini?')) return;
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/admin/deposit-requests/approve/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Request berhasil diapprove!', 'success');
            loadDepositRequests(); // Refresh data
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showAlert('Terjadi kesalahan', 'danger');
    } finally {
        showLoading(false);
    }
}

async function rejectDepositRequest(requestId) {
    const reason = prompt('Masukkan alasan penolakan:');
    if (!reason || !reason.trim()) return;
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/admin/deposit-requests/reject/${requestId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                admin_notes: reason.trim()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Request berhasil ditolak!', 'success');
            loadDepositRequests(); // Refresh data
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        showAlert('Terjadi kesalahan', 'danger');
    } finally {
        showLoading(false);
    }
}

function viewDepositRequestDetail(requestId) {
    const request = allDepositRequests.find(r => r.id === requestId);
    if (!request) return;
    
    const statusText = {
        'pending': 'Pending',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };
    
    const detail = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>ID:</strong> #${request.id}</p>
                <p><strong>Agent:</strong> ${request.agent_name} (${request.username})</p>
                <p><strong>Jumlah:</strong> Rp ${(request.amount || 0).toLocaleString('id-ID')}</p>
                <p><strong>Metode:</strong> ${request.payment_method}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Prioritas:</strong> ${request.priority}</p>
                <p><strong>Status:</strong> ${statusText[request.status] || request.status}</p>
                <p><strong>Tanggal:</strong> ${new Date(request.created_at).toLocaleString('id-ID')}</p>
                ${request.processed_at ? `<p><strong>Diproses:</strong> ${new Date(request.processed_at).toLocaleString('id-ID')}</p>` : ''}
            </div>
        </div>
        ${request.notes ? `<div class="mt-3"><strong>Catatan Agent:</strong><br>${request.notes}</div>` : ''}
        ${request.admin_notes ? `<div class="mt-3"><strong>Catatan Admin:</strong><br>${request.admin_notes}</div>` : ''}
    `;
    
    showAlert(detail, 'info', 'Detail Request Deposit');
}

async function bulkApproveSelected() {
    const checkboxes = document.querySelectorAll('.request-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    if (!confirm(`Approve ${checkboxes.length} request yang dipilih?`)) return;
    
    try {
        showLoading(true);
        
        for (const checkbox of checkboxes) {
            const requestId = checkbox.dataset.id;
            await authenticatedFetch(`${API_BASE}/admin/deposit-requests/approve/${requestId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        showAlert(`${checkboxes.length} request berhasil diapprove!`, 'success');
        loadDepositRequests(); // Refresh data
    } catch (error) {
        console.error('Error bulk approving:', error);
        showAlert('Terjadi kesalahan saat bulk approve', 'danger');
    } finally {
        showLoading(false);
    }
}

// Add event listeners for checkboxes
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('request-checkbox')) {
        updateBulkActionButton();
    }
});

// Ensure all deposit request functions are globally available
console.log('🌐 Exposing deposit request functions to global scope...');

// Main functions
window.showDepositRequestsModalFull = showDepositRequestsModalFull;
window.loadDepositRequests = loadDepositRequests;
window.approveDepositRequest = approveDepositRequest;
window.rejectDepositRequest = rejectDepositRequest;
window.viewDepositRequestDetail = viewDepositRequestDetail;
window.bulkApproveSelected = bulkApproveSelected;

// Helper functions
window.filterDepositRequests = filterDepositRequests;
window.refreshDepositRequests = refreshDepositRequests;
window.toggleSelectAll = toggleSelectAll;
window.changeDepositPage = changeDepositPage;
window.updateBulkActionButton = updateBulkActionButton;
window.renderDepositRequestsTable = renderDepositRequestsTable;
window.renderDepositRequestsPagination = renderDepositRequestsPagination;
window.updateDepositRequestsStats = updateDepositRequestsStats;

// Override the early definition with full implementation
window.showDepositRequestsModal = showDepositRequestsModalFull;

console.log('✅ All deposit request functions exposed to global scope');

// Debug: Log all available functions
console.log('🔍 Available functions:', Object.keys(window).filter(key => 
    key.includes('Deposit') && typeof window[key] === 'function'
));

async function showVoucherDetails(voucherId) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/${voucherId}`);
        const result = await response.json();
        
        if (result.success) {
            showVoucherDetailsModal(result.data);
        } else {
            showAlert('Error loading voucher details', 'danger');
        }
    } catch (error) {
        console.error('Error loading voucher details:', error);
        showAlert('Error loading voucher details', 'danger');
    } finally {
        showLoading(false);
    }
}

function showVoucherDetailsModal(voucher) {
    const modal = new bootstrap.Modal(document.getElementById('voucherDetailsModal'));
    const content = document.getElementById('voucherDetailsContent');
    
    content.innerHTML = `
        <div class="voucher-card">
            <div class="voucher-header">
                <h4><i class="fas fa-wifi me-2"></i>Voucher WiFi</h4>
                <p class="mb-0">ID: ${voucher.id}</p>
            </div>
            <div class="voucher-details">
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Username:</span>
                    <span class="voucher-detail-value">${voucher.username}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Password:</span>
                    <span class="voucher-detail-value">${voucher.password}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Profil:</span>
                    <span class="voucher-detail-value">${voucher.profile}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Harga Dasar:</span>
                    <span class="voucher-detail-value">${formatCurrency(voucher.agent_price || 0)}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Durasi:</span>
                    <span class="voucher-detail-value">${voucher.duration}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Status:</span>
                    <span>${getVoucherStatusBadge(voucher)}</span>
                </div>
                <div class="voucher-detail-item">
                    <span class="voucher-detail-label">Dibuat:</span>
                    <span class="voucher-detail-value">${formatDateTime(voucher.created_at)}</span>
                </div>
                ${voucher.expires_at ? `
                    <div class="voucher-detail-item">
                        <span class="voucher-detail-label">Expired:</span>
                        <span class="voucher-detail-value">${formatDateTime(voucher.expires_at)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.show();
}

async function deleteVoucher(voucherId) {
    if (!confirm('Apakah Anda yakin ingin menghapus voucher ini?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/${voucherId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Voucher berhasil dihapus', 'success');
            loadVouchers(currentVoucherPage);
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting voucher:', error);
        showAlert('Error deleting voucher', 'danger');
    } finally {
        showLoading(false);
    }
}

function printVoucher() {
    try {
        // Ambil ID voucher dari konten modal
        const content = document.getElementById('voucherDetailsContent');
        if (!content) return;
        const idMatch = content.innerHTML.match(/ID:\s*(\d+)/i);
        const voucherId = idMatch ? parseInt(idMatch[1]) : null;
        if (!voucherId) {
            showAlert('Gagal menemukan ID voucher untuk cetak', 'danger');
            return;
        }
        const url = `/print-vouchers.html?ids=${voucherId}`;
        const w = window.open(url, '_blank');
        if (!w) {
            showAlert('Popup diblokir. Izinkan popup untuk mencetak voucher.', 'warning');
        }
    } catch (e) {
        showAlert('Terjadi kesalahan saat menyiapkan cetak voucher', 'danger');
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'block' : 'none';
}

function showAlert(message, type = 'info', duration = 5000) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(alertDiv);
    
    // Auto remove after specified duration
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, duration);
}

// Placeholder functions for other sections
async function loadTransactions(page = 1) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/transactions?page=${page}&limit=10`);
        const result = await response.json();
        
        if (result.success) {
            updateTransactionsTable(result.data.transactions);
            updateTransactionPagination(result.data);
            updateTransactionStats();
        } else {
            showAlert('Error loading transactions: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        showAlert('Error loading transactions', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsList');
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Belum ada transaksi</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${transaction.id}</td>
            <td>${formatDateTime(transaction.created_at)}</td>
            <td>${transaction.customer_name || 'Guest'}</td>
            <td>${transaction.customer_phone || '-'}</td>
            <td><code>${transaction.username || '-'}</code></td>
            <td><span class="badge bg-info">${transaction.profile || '-'}</span></td>
            <td>${formatCurrency(transaction.amount)}</td>
            <td><span class="badge bg-secondary">${transaction.payment_method}</span></td>
            <td><span class="badge bg-success">Selesai</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showTransactionDetails(${transaction.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateTransactionPagination(data) {
    const pagination = document.getElementById('transactionPagination');
    const { page, totalPages } = data;
    
    let html = '';
    
    // Previous button
    if (page > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadTransactions(${page - 1})">Previous</a></li>`;
    }
    
    // Page numbers
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadTransactions(${i})">${i}</a>
        </li>`;
    }
    
    // Next button
    if (page < totalPages) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadTransactions(${page + 1})">Next</a></li>`;
    }
    
    pagination.innerHTML = html;
}

async function updateTransactionStats() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/transactions/stats`);
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            document.getElementById('totalTransactionsCount').textContent = stats.total_transactions || 0;
            document.getElementById('totalTransactionRevenue').textContent = formatCurrency(stats.total_revenue || 0);
            document.getElementById('avgTransactionAmount').textContent = formatCurrency(stats.average_transaction || 0);
            document.getElementById('todayTransactionsCount').textContent = stats.today_transactions || 0;
        }
    } catch (error) {
        console.error('Error loading transaction stats:', error);
    }
}

function filterTransactions() {
    const dateFrom = document.getElementById('transactionDateFrom').value;
    const dateTo = document.getElementById('transactionDateTo').value;
    const status = document.getElementById('transactionStatus').value;
    const paymentMethod = document.getElementById('transactionPayment').value;
    
    let url = `${API_BASE}/transactions?`;
    const params = [];
    
    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);
    if (status) params.push(`status=${status}`);
    if (paymentMethod) params.push(`payment_method=${paymentMethod}`);
    
    url += params.join('&');
    
    // Load filtered transactions
    loadFilteredTransactions(url);
}

async function loadFilteredTransactions(url) {
    try {
        showLoading(true);
        const response = await authenticatedFetch(url);
        const result = await response.json();
        
        if (result.success) {
            updateTransactionsTable(result.data.transactions);
            updateTransactionPagination(result.data);
        }
    } catch (error) {
        console.error('Error loading filtered transactions:', error);
        showAlert('Error loading transactions', 'danger');
    } finally {
        showLoading(false);
    }
}

function resetTransactionFilter() {
    document.getElementById('transactionDateFrom').value = '';
    document.getElementById('transactionDateTo').value = '';
    document.getElementById('transactionStatus').value = '';
    document.getElementById('transactionPayment').value = '';
    loadTransactions();
}

function exportTransactions() {
    showAlert('Fitur export akan segera hadir', 'info');
}

function searchTransactions() {
    const searchTerm = document.getElementById('transactionSearch').value;
    if (searchTerm) {
        loadFilteredTransactions(`${API_BASE}/transactions?customer_name=${searchTerm}`);
    } else {
        loadTransactions();
    }
}

function loadProfiles() {
    console.log('Loading profiles...');
}

async function loadMikrotikStatus() {
    console.log('Loading Mikrotik status...');
    
    try {
        // Load informasi sistem Mikrotik
        await loadMikrotikSystemInfo();
        
        // Test koneksi otomatis
        await testMikrotikConnection();
    } catch (error) {
        console.error('Error loading Mikrotik status:', error);
        updateConnectionStatus('disconnected', 'Error loading status');
    }
}

// Load informasi sistem Mikrotik
async function loadMikrotikSystemInfo() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/system-info`);
        const result = await response.json();
        
        if (result.success && result.data) {
            updateMikrotikSystemInfo(result.data);
        } else {
            showAlert('Error loading system info: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading Mikrotik system info:', error);
        // Tampilkan error state
        updateMikrotikSystemInfoError();
    }
}

// Update tampilan informasi sistem Mikrotik
function updateMikrotikSystemInfo(data) {
    const container = document.getElementById('mikrotikSystemInfo');
    
    if (!container) return;
    
    const { identity, resource, interfaces } = data;
    
    let html = '';
    
    // System Identity
    if (identity && identity.name) {
        html += `<div class="mb-3">
            <h6 class="text-primary mb-2"><i class="fas fa-tag me-1"></i>System Identity</h6>
            <p class="mb-1"><strong>${identity.name}</strong></p>
        </div>`;
    }
    
    // System Resources
    if (resource) {
        html += `<div class="mb-3">
            <h6 class="text-success mb-2"><i class="fas fa-microchip me-1"></i>System Resources</h6>
            <div class="row">
                <div class="col-6">
                    <small class="text-muted">CPU Load:</small><br>
                    <span class="badge bg-info">${resource['cpu-load'] || 'N/A'}%</span>
                </div>
                <div class="col-6">
                    <small class="text-muted">Free Memory:</small><br>
                    <span class="badge bg-success">${formatBytes(resource['free-memory'] || 0)}</span>
                </div>
            </div>
            <div class="row mt-2">
                <div class="col-6">
                    <small class="text-muted">Total Memory:</small><br>
                    <span class="badge bg-primary">${formatBytes(resource['total-memory'] || 0)}</span>
                </div>
                <div class="col-6">
                    <small class="text-muted">Uptime:</small><br>
                    <span class="badge bg-warning">${formatUptime(resource['uptime'] || 0)}</span>
                </div>
            </div>
        </div>`;
    }
    
    // Network Interfaces (Physical interfaces only)
    if (interfaces && interfaces.length > 0) {
        // Filter hanya interface fisik (ether, sfp, wlan, dll)
        const physicalInterfaces = interfaces.filter(iface => {
            const name = iface.name.toLowerCase();
            return name.startsWith('ether') || 
                   name.startsWith('sfp') || 
                   name.startsWith('wlan') || 
                   name.startsWith('wifi') ||
                   name.startsWith('usb') ||
                   name.includes('ethernet');
        });
        
        if (physicalInterfaces.length > 0) {
            html += `<div class="mb-3">
                <h6 class="text-info mb-2"><i class="fas fa-network-wired me-1"></i>Physical Network Interfaces</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-borderless">
                        <tbody>`;
            
            physicalInterfaces.forEach(iface => {
                const statusClass = iface.running ? 'bg-success' : 'bg-secondary';
                const statusText = iface.running ? 'Active' : 'Inactive';
                
                html += `<tr>
                    <td><small>${iface.name}</small></td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                </tr>`;
            });
            
            html += `</tbody></table></div></div>`;
        }
    }
    
    container.innerHTML = html;
}

// Tampilkan error state untuk informasi sistem
function updateMikrotikSystemInfoError() {
    const container = document.getElementById('mikrotikSystemInfo');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Gagal memuat informasi sistem Mikrotik
        </div>
        <button class="btn btn-sm btn-outline-primary" onclick="loadMikrotikSystemInfo()">
            <i class="fas fa-refresh me-1"></i>Coba Lagi
        </button>
    `;
}

// Helper function untuk format bytes
function formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function untuk format uptime
function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

async function testMikrotikConnection() {
    try {
        updateConnectionStatus('connecting', 'Menghubungkan...');
        showLoading(true);
        
        // Test koneksi dengan konfigurasi dari .env
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/test-connection`);
        
        console.log('Testing connection with .env config...');
        
        const result = await response.json();
        
        if (result.success) {
            updateConnectionStatus('connected', `Terhubung ke ${result.identity || 'Mikrotik'}`);
            showAlert('Koneksi berhasil!', 'success');
            
            // Load data setelah koneksi berhasil
            setTimeout(() => {
                loadActiveUsers();
                loadHotspotProfiles();
            }, 500);
        } else {
            updateConnectionStatus('disconnected', 'Koneksi gagal');
            showAlert('Koneksi gagal: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        updateConnectionStatus('disconnected', 'Error koneksi');
        showAlert('Error testing connection: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

// Load konfigurasi Mikrotik yang tersimpan
async function loadMikrotikConfig() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/config`);
        const result = await response.json();
        
        if (result.success && result.data) {
            document.getElementById('mikrotikHost').value = result.data.host || '192.168.1.1';
            document.getElementById('mikrotikUsername').value = result.data.username || 'admin';
            document.getElementById('mikrotikPort').value = result.data.port || 8728;
            // Password tidak dimuat untuk keamanan
        }
    } catch (error) {
        console.error('Error loading Mikrotik config:', error);
        // Gunakan default values jika gagal load
        document.getElementById('mikrotikHost').value = '192.168.1.1';
        document.getElementById('mikrotikUsername').value = 'admin';
        document.getElementById('mikrotikPort').value = 8728;
    }
}

function updateConnectionStatus(status, text) {
    const statusElement = document.querySelector('.connection-status');
    const textElement = document.getElementById('connectionStatusText');
    
    statusElement.className = `connection-status ${status}`;
    textElement.textContent = text;
}

async function loadActiveUsers() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/users/active`);
        const result = await response.json();
        
        if (result.success) {
            updateActiveUsersList(result.data);
            document.getElementById('activeUsersCount').textContent = result.data.length;
        } else {
            showAlert('Error loading active users: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading active users:', error);
        showAlert('Error loading active users', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateActiveUsersList(users) {
    const container = document.getElementById('activeUsersList');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<p class="text-muted">Tidak ada user aktif</p>';
        return;
    }
    
    const html = `
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>User</th>
                    <th>IP</th>
                    <th>Uptime</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.user || '-'}</td>
                        <td>${user.address || '-'}</td>
                        <td>${user.uptime || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" onclick="disconnectUser('${user.user}')">
                                <i class="fas fa-times"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

async function loadHotspotProfiles() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/profiles`);
        const result = await response.json();
        
        if (result.success) {
            updateHotspotProfilesList(result.data);
            updateProfileSelects(result.data);
        } else {
            console.error('Error loading hotspot profiles:', result);
            let errorMsg = result.message || 'Error loading hotspot profiles';
            
            if (result.troubleshoot) {
                errorMsg += '\n\nTroubleshooting steps:';
                result.troubleshoot.steps.forEach((step, index) => {
                    errorMsg += `\n${index + 1}. ${step}`;
                });
            }
            
            showAlert(errorMsg, 'warning');
            
            // Show empty profiles list with troubleshooting info
            updateHotspotProfilesList([]);
        }
    } catch (error) {
        console.error('Error loading hotspot profiles:', error);
        showAlert('Error loading hotspot profiles: ' + error.message, 'danger');
        updateHotspotProfilesList([]);
    } finally {
        showLoading(false);
    }
}

function updateHotspotProfilesList(profiles) {
    const tbody = document.getElementById('hotspotProfilesList');
    
    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada profil ditemukan</td></tr>';
        return;
    }
    
    tbody.innerHTML = profiles.map(profile => `
        <tr>
            <td>${profile.name || '-'}</td>
            <td>${profile['rate-limit'] || '-'}</td>
            <td>${profile['session-timeout'] || '-'}</td>
            <td>${profile['idle-timeout'] || '-'}</td>
            <td>${profile['shared-users'] || '-'}</td>
            <td><span class="badge bg-success">Aktif</span></td>
        </tr>
    `).join('');
}

async function loadHotspotUsers(page = 1) {
    try {
        showLoading(true);
        
        // Update current page jika parameter page diberikan
        if (page !== undefined) {
            currentHotspotUsersPage = page;
        }
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/users/hotspot?page=${currentHotspotUsersPage}&limit=${currentHotspotUsersLimit}`);
        const result = await response.json();
        
        if (result.success) {
            updateHotspotUsersList(result.data);
            updateHotspotUsersPagination(result.pagination);
        } else {
            showAlert('Error loading hotspot users: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading hotspot users:', error);
        showAlert('Error loading hotspot users', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateHotspotUsersList(users) {
    const tbody = document.getElementById('hotspotUsersList');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada user ditemukan</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><code>${user.name || '-'}</code></td>
            <td><code>${user.password || '-'}</code></td>
            <td>${user.profile || '-'}</td>
            <td>${user.uptime || '-'}</td>
            <td>${user['bytes-in'] || '-'}</td>
            <td>${user['bytes-out'] || '-'}</td>
            <td><span class="badge bg-info">Aktif</span></td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteMikrotikUser('${user.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateHotspotUsersPagination(pagination) {
    const paginationElement = document.getElementById('hotspotUsersPagination');
    if (!paginationElement) return;
    
    const { page, totalPages, totalUsers } = pagination;
    
    let html = '';
    
    // Info total user dan halaman
    html += `<div class="d-flex justify-content-between align-items-center mb-3">
        <span>Total User: <strong>${totalUsers}</strong> | Halaman ${page} dari ${totalPages} | ${currentHotspotUsersLimit} per halaman</span>
    </div>`;
    
    // Pagination controls
    if (totalPages > 1) {
        html += '<nav><ul class="pagination pagination-sm justify-content-center">';
        
        // Previous button
        if (page > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="loadHotspotUsers(${page - 1})">Previous</a></li>`;
        }
        
        // Page numbers
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            html += `<li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadHotspotUsers(${i})">${i}</a>
            </li>`;
        }
        
        // Next button
        if (page < totalPages) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="loadHotspotUsers(${page + 1})">Next</a></li>`;
        }
        
        html += '</ul></nav>';
    }
    
    paginationElement.innerHTML = html;
}

function changeHotspotUsersLimit() {
    const limitSelect = document.getElementById('hotspotUsersLimit');
    currentHotspotUsersLimit = parseInt(limitSelect.value);
    currentHotspotUsersPage = 1; // Reset ke halaman pertama
    loadHotspotUsers();
}

function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('createMikrotikUserModal'));
    document.getElementById('createMikrotikUserForm').reset();
    modal.show();
}

async function createMikrotikUser() {
    try {
        const username = document.getElementById('mikrotikUserUsername').value;
        const password = document.getElementById('mikrotikUserPassword').value;
        const profile = document.getElementById('mikrotikUserProfile').value;
        const uptime = document.getElementById('mikrotikUserUptime').value;
        
        if (!username || !password) {
            showAlert('Username dan password harus diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/users/create`, {
            method: 'POST',
            body: JSON.stringify({
                username,
                password,
                profile,
                limitUptime: uptime
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('User berhasil dibuat!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createMikrotikUserModal')).hide();
            loadHotspotUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('Error creating user', 'danger');
    } finally {
        showLoading(false);
    }
}

async function deleteMikrotikUser(username) {
    if (!confirm(`Apakah Anda yakin ingin menghapus user ${username}?`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/users/${username}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('User berhasil dihapus', 'success');
            loadHotspotUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Error deleting user', 'danger');
    } finally {
        showLoading(false);
    }
}

async function disconnectUser(username) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/users/${username}/disconnect`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('User berhasil didisconnect', 'success');
            loadActiveUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error disconnecting user:', error);
        showAlert('Error disconnecting user', 'danger');
    } finally {
        showLoading(false);
    }
}

async function getMikrotikInfo() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/system-info`);
        const result = await response.json();
        
        if (result.success) {
            displayMikrotikInfo(result.data);
        } else {
            showAlert('Error getting system info: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error getting system info:', error);
        showAlert('Error getting system info', 'danger');
    } finally {
        showLoading(false);
    }
}

function displayMikrotikInfo(data) {
    const container = document.getElementById('mikrotikInfoContent');
    const infoDiv = document.getElementById('mikrotikInfo');
    
    const html = `
        <div class="row">
            <div class="col-6"><strong>Identity:</strong></div>
            <div class="col-6">${data.identity?.name || 'Unknown'}</div>
            <div class="col-6"><strong>Version:</strong></div>
            <div class="col-6">${data.resource?.version || 'Unknown'}</div>
            <div class="col-6"><strong>Uptime:</strong></div>
            <div class="col-6">${data.resource?.uptime || 'Unknown'}</div>
            <div class="col-6"><strong>CPU Load:</strong></div>
            <div class="col-6">${data.resource?.["cpu-load"] || 'Unknown'}%</div>
        </div>
    `;
    
    container.innerHTML = html;
    infoDiv.style.display = 'block';
}

async function saveMikrotikConfig() {
    // Fungsi ini sudah tidak diperlukan karena konfigurasi diambil dari .env
    showAlert('Konfigurasi Mikrotik diambil dari file .env. Untuk mengubah, edit file .env di root folder aplikasi.', 'info');
}

function showTroubleshooting() {
    const troubleshootingDiv = document.getElementById('troubleshootingInfo');
    const mikrotikDiv = document.getElementById('mikrotikInfo');
    
    if (troubleshootingDiv.style.display === 'none') {
        troubleshootingDiv.style.display = 'block';
        mikrotikDiv.style.display = 'none';
    } else {
        troubleshootingDiv.style.display = 'none';
    }
}

function searchVouchers() {
    const searchTerm = document.getElementById('voucherSearch').value;
    console.log('Searching vouchers:', searchTerm);
    // Implement search functionality
}

async function loadProfiles(page = 1) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles?page=${page}&limit=10`);
        const result = await response.json();
        
        if (result.success) {
            updateProfilesTable(result.data.profiles);
            updateProfilePagination(result.data);
            updateProfileStats();
            loadProfileSalesStats();
        } else {
            showAlert('Error loading profiles: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading profiles:', error);
        showAlert('Error loading profiles', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateProfilesTable(profiles) {
    const tbody = document.getElementById('profilesList');
    
    if (!profiles || profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada profil</td></tr>';
        return;
    }
    
    tbody.innerHTML = profiles.map(profile => `
        <tr>
            <td>${profile.id}</td>
            <td><strong>${profile.name}</strong></td>
            <td><span class="badge bg-info">${profile.duration}</span></td>
            <td><strong class="text-success">${formatCurrency(profile.agent_price || 0)}</strong></td>
            <td><strong class="text-primary">${formatCurrency(profile.selling_price || 0)}</strong></td>
            <td>${getProfileStatusBadge(profile.is_active)}</td>
            <td><span class="badge bg-secondary">0</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showEditProfile(${profile.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-${profile.is_active ? 'warning' : 'success'} ms-1" onclick="toggleProfileStatus(${profile.id})">
                    <i class="fas fa-${profile.is_active ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteProfile(${profile.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getProfileStatusBadge(isActive) {
    return isActive 
        ? '<span class="badge bg-success">Aktif</span>' 
        : '<span class="badge bg-secondary">Nonaktif</span>';
}

function updateProfilePagination(data) {
    const pagination = document.getElementById('profilePagination');
    const { page, totalPages } = data;
    
    let html = '';
    
    if (page > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadProfiles(${page - 1})">Previous</a></li>`;
    }
    
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadProfiles(${i})">${i}</a>
        </li>`;
    }
    
    if (page < totalPages) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadProfiles(${page + 1})">Next</a></li>`;
    }
    
    pagination.innerHTML = html;
}

async function updateProfileStats() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/profiles`);
        const result = await response.json();
        
        if (result.success) {
            const profiles = result.data.profiles;
            const activeProfiles = profiles.filter(p => p.is_active).length;
            const sellingPrices = profiles.map(p => p.selling_price || 0);
            const agentPrices = profiles.map(p => p.agent_price || 0);
            
            // Hitung margin
            const margins = profiles.map(p => (p.selling_price || 0) - (p.agent_price || 0));
            const totalMargin = margins.reduce((sum, margin) => sum + margin, 0);
            const averageMargin = margins.length > 0 ? totalMargin / margins.length : 0;
            
            document.getElementById('totalProfiles').textContent = profiles.length;
            document.getElementById('activeProfiles').textContent = activeProfiles;
            document.getElementById('highestPrice').textContent = sellingPrices.length > 0 ? formatCurrency(Math.max(...sellingPrices)) : 'Rp 0';
            document.getElementById('lowestPrice').textContent = sellingPrices.length > 0 ? formatCurrency(Math.min(...sellingPrices)) : 'Rp 0';
            document.getElementById('averageMargin').textContent = formatCurrency(averageMargin);
            document.getElementById('totalMargin').textContent = formatCurrency(totalMargin);
        }
    } catch (error) {
        console.error('Error loading profile stats:', error);
    }
}

async function loadProfileSalesStats() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/profiles/stats`);
        const result = await response.json();
        
        if (result.success) {
            displayProfileSalesStats(result.data);
        }
    } catch (error) {
        console.error('Error loading profile sales stats:', error);
        document.getElementById('profileStatsContent').innerHTML = '<p class="text-muted">Error loading sales stats</p>';
    }
}

function displayProfileSalesStats(stats) {
    const container = document.getElementById('profileStatsContent');
    
    if (!stats || stats.length === 0) {
        container.innerHTML = '<p class="text-muted">Belum ada data penjualan</p>';
        return;
    }
    
    const html = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Profil</th>
                        <th>Harga Jual</th>
                        <th>Margin</th>
                        <th>Voucher Terjual</th>
                        <th>Revenue</th>
                        <th>Persentase</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(stat => {
                        const totalRevenue = stats.reduce((sum, s) => sum + (s.revenue || 0), 0);
                        const percentage = totalRevenue > 0 ? ((stat.revenue || 0) / totalRevenue * 100).toFixed(1) : 0;
                        return `
                            <tr>
                                <td><strong>${stat.name}</strong></td>
                                <td><strong class="text-primary">${formatCurrency(stat.price || 0)}</strong></td>
                                <td><strong class="text-success">${formatCurrency(stat.margin || 0)}</strong></td>
                                <td>${stat.total_vouchers_sold || 0}</td>
                                <td>${formatCurrency(stat.revenue || 0)}</td>
                                <td>
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar" role="progressbar" style="width: ${percentage}%">
                                            ${percentage}%
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

async function showCreateProfileModal() {
    try {
        // Load Mikrotik profiles untuk dropdown
        const response = await authenticatedFetch(`${API_BASE}/mikrotik/profiles`);
        const result = await response.json();
        
        if (result.success) {
            // Populate Mikrotik profile dropdown
            populateCreateMikrotikProfileSelect(result.data);
            
            // Reset form
            document.getElementById('createProfileForm').reset();
            
                                // Clear readonly fields
                    document.getElementById('profileDuration').value = '';
                    document.getElementById('createMikrotikProfileName').value = '';
            
            const modal = new bootstrap.Modal(document.getElementById('createProfileModal'));
            modal.show();
        } else {
            showAlert('Error loading Mikrotik profiles: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading Mikrotik profiles:', error);
        showAlert('Error loading Mikrotik profiles', 'danger');
    }
}

async function createProfile() {
    try {
        const name = document.getElementById('profileName').value;
        const mikrotikProfileName = document.getElementById('createMikrotikProfileName').value;
        const duration = document.getElementById('profileDuration').value;
        const agentPrice = parseFloat(document.getElementById('profileAgentPrice').value);
        const sellingPrice = parseFloat(document.getElementById('profileSellingPrice').value);
        const description = document.getElementById('profileDescription').value;
        const codeLengthEl = document.getElementById('profileCodeLength');
        const voucherCodeLength = codeLengthEl ? Math.max(3, Math.min(12, parseInt(codeLengthEl.value) || 4)) : 4;
        
        if (!name || !mikrotikProfileName || !agentPrice || !sellingPrice) {
            showAlert('Nama profil, profil Mikrotik, harga dasar, dan harga jual harus diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                mikrotik_profile_name: mikrotikProfileName,
                duration,
                agent_price: agentPrice,
                selling_price: sellingPrice,
                description,
                voucher_code_length: voucherCodeLength
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Profil berhasil dibuat!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createProfileModal')).hide();
            loadProfiles();
            loadVoucherProfiles(); // Refresh voucher profiles
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error creating profile:', error);
        showAlert('Error creating profile', 'danger');
    } finally {
        showLoading(false);
    }
}

async function showEditProfile(profileId) {
    try {
        showLoading(true);
        
        // Load profile details dan Mikrotik profiles secara bersamaan
        const [profileResponse, mikrotikProfilesResponse] = await Promise.all([
            authenticatedFetch(`${API_BASE}/profiles/${profileId}`),
            authenticatedFetch(`${API_BASE}/mikrotik/profiles`)
        ]);
        
        const profileResult = await profileResponse.json();
        const mikrotikProfilesResult = await mikrotikProfilesResponse.json();
        
        if (profileResult.success && mikrotikProfilesResult.success) {
            const profile = profileResult.data;
            const mikrotikProfiles = mikrotikProfilesResult.data;
            
            // Populate Mikrotik profile dropdown
            populateEditMikrotikProfileSelect(mikrotikProfiles, profile.mikrotik_profile_name);
            
            // Populate form fields
            document.getElementById('editProfileId').value = profile.id;
            document.getElementById('editProfileName').value = profile.name;
            document.getElementById('editProfileDuration').value = profile.duration;
            document.getElementById('editProfileAgentPrice').value = profile.agent_price || '';
            document.getElementById('editProfileSellingPrice').value = profile.selling_price || '';
            document.getElementById('editProfileDescription').value = profile.description || '';
            document.getElementById('editProfileActive').checked = profile.is_active;
            document.getElementById('editMikrotikProfileName').value = profile.mikrotik_profile_name || '';
            
            const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
            modal.show();
        } else {
            showAlert('Error loading profile details', 'danger');
        }
    } catch (error) {
        console.error('Error loading profile details:', error);
        showAlert('Error loading profile details', 'danger');
    } finally {
        showLoading(false);
    }
}

async function updateProfile() {
    try {
        const id = document.getElementById('editProfileId').value;
        const name = document.getElementById('editProfileName').value;
        const mikrotikProfileName = document.getElementById('editMikrotikProfileName').value;
        const duration = document.getElementById('editProfileDuration').value;
        const agentPrice = parseFloat(document.getElementById('editProfileAgentPrice').value);
        const sellingPrice = parseFloat(document.getElementById('editProfileSellingPrice').value);
        const description = document.getElementById('editProfileDescription').value;
        const codeLengthEl = document.getElementById('editProfileCodeLength');
        const voucherCodeLength = codeLengthEl ? Math.max(3, Math.min(12, parseInt(codeLengthEl.value) || 4)) : 4;
        const isActive = document.getElementById('editProfileActive').checked;
        
        if (!name || !mikrotikProfileName || !agentPrice || !sellingPrice) {
            showAlert('Nama profil, profil Mikrotik, harga dasar, dan harga jual harus diisi', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name,
                mikrotik_profile_name: mikrotikProfileName,
                duration,
                agent_price: agentPrice,
                selling_price: sellingPrice,
                description,
                voucher_code_length: voucherCodeLength,
                is_active: isActive
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Profil berhasil diupdate!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
            loadProfiles();
            loadVoucherProfiles(); // Refresh voucher profiles
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Error updating profile', 'danger');
    } finally {
        showLoading(false);
    }
}

async function toggleProfileStatus(profileId) {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles/${profileId}/toggle`, {
            method: 'PATCH'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Status profil berhasil diubah!', 'success');
            loadProfiles();
            loadVoucherProfiles(); // Refresh voucher profiles
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error toggling profile status:', error);
        showAlert('Error updating profile status', 'danger');
    } finally {
        showLoading(false);
    }
}

async function deleteProfile(profileId) {
    if (!confirm('Apakah Anda yakin ingin menghapus profil ini?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles/${profileId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Profil berhasil dihapus!', 'success');
            loadProfiles();
            loadVoucherProfiles(); // Refresh voucher profiles
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        showAlert('Error deleting profile', 'danger');
    } finally {
        showLoading(false);
    }
}

async function initializeDefaultProfiles() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles/initialize-defaults`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Default profiles berhasil dimuat!', 'success');
            loadProfiles();
            loadVoucherProfiles(); // Refresh voucher profiles
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error initializing default profiles:', error);
        showAlert('Error initializing default profiles', 'danger');
    } finally {
        showLoading(false);
    }
}

// Populate Mikrotik profile dropdown untuk create modal
function populateCreateMikrotikProfileSelect(mikrotikProfiles) {
    const select = document.getElementById('createMikrotikProfileSelect');
    select.innerHTML = '<option value="">Pilih profil Mikrotik...</option>';
    
    if (mikrotikProfiles && mikrotikProfiles.length > 0) {
        mikrotikProfiles.forEach(profile => {
            if (profile.name && profile.name !== 'default') {
                const option = document.createElement('option');
                option.value = profile.name;
                option.textContent = profile.name;
                option.dataset.profile = JSON.stringify(profile);
                select.appendChild(option);
            }
        });
    }
}

// Populate Mikrotik profile dropdown untuk edit modal
function populateEditMikrotikProfileSelect(mikrotikProfiles, selectedProfileName = '') {
    const select = document.getElementById('editMikrotikProfileSelect');
    select.innerHTML = '<option value="">Pilih profil Mikrotik...</option>';
    
    if (mikrotikProfiles && mikrotikProfiles.length > 0) {
        mikrotikProfiles.forEach(profile => {
            if (profile.name && profile.name !== 'default') {
                const option = document.createElement('option');
                option.value = profile.name;
                option.textContent = profile.name;
                option.dataset.profile = JSON.stringify(profile);
                
                if (profile.name === selectedProfileName) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            }
        });
    }
}

// Handle perubahan profil Mikrotik pada create modal
function onCreateMikrotikProfileChange() {
    const select = document.getElementById('createMikrotikProfileSelect');
    const selectedProfile = select.value;
    
    if (selectedProfile) {
        const profileData = JSON.parse(select.options[select.selectedIndex].dataset.profile);
        
                        // Auto-fill fields berdasarkan profil Mikrotik
                document.getElementById('profileDuration').value = profileData['session-timeout'] || 'N/A';
                document.getElementById('createMikrotikProfileName').value = selectedProfile;
        
        // Update nama profil display jika kosong
        if (!document.getElementById('profileName').value) {
            document.getElementById('profileName').value = selectedProfile;
        }
        
        // Update deskripsi jika kosong
        if (!document.getElementById('profileDescription').value) {
            const duration = profileData['session-timeout'] || '';
            const bandwidth = profileData['rate-limit'] || '';
            document.getElementById('profileDescription').value = 
                `Paket internet ${duration} dengan kecepatan ${bandwidth}`;
        }
    } else {
                        // Clear fields jika tidak ada profil yang dipilih
                document.getElementById('profileDuration').value = '';
                document.getElementById('createMikrotikProfileName').value = '';
    }
}

// Handle perubahan profil Mikrotik pada edit modal
function onEditMikrotikProfileChange() {
    const select = document.getElementById('editMikrotikProfileSelect');
    const selectedProfile = select.value;
    
    if (selectedProfile) {
        const profileData = JSON.parse(select.options[select.selectedIndex].dataset.profile);
        
                        // Auto-fill fields berdasarkan profil Mikrotik
                document.getElementById('editProfileDuration').value = profileData['session-timeout'] || 'N/A';
                document.getElementById('editMikrotikProfileName').value = selectedProfile;
        
        // Update nama profil display jika kosong
        if (!document.getElementById('editProfileName').value) {
            document.getElementById('editProfileName').value = selectedProfile;
        }
        
        // Update deskripsi jika kosong
        if (!document.getElementById('editProfileDescription').value) {
            const duration = profileData['session-timeout'] || '';
            const bandwidth = profileData['rate-limit'] || '';
            document.getElementById('editProfileDescription').value = 
                `Paket internet ${duration} dengan kecepatan ${bandwidth}`;
        }
    } else {
                        // Clear fields jika tidak ada profil yang dipilih
                document.getElementById('editProfileDuration').value = '';
                document.getElementById('editMikrotikProfileName').value = '';
    }
}

function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        searchProfiles();
    }
}

function searchProfiles() {
    const searchTerm = document.getElementById('profileSearch').value.trim();

    if (!searchTerm) {
        // Jika search kosong, load semua profiles
        loadProfiles();
        return;
    }

    console.log('Searching profiles:', searchTerm);
    showLoading(true);

    // Lakukan search client-side dari voucherProfiles yang sudah ada
    const filteredProfiles = voucherProfiles.filter(profile =>
        profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.duration?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Update tabel dengan hasil pencarian
    const tbody = document.getElementById('profilesList');

    if (filteredProfiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">
            <i class="fas fa-search text-muted mb-2" style="font-size: 2rem;"></i><br>
            Tidak ada profil yang cocok dengan "<strong>${searchTerm}</strong>"
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filteredProfiles.map(profile => `
        <tr>
            <td>${profile.id}</td>
            <td><strong>${profile.name}</strong></td>
            <td><span class="badge bg-info">${profile.duration}</span></td>
            <td><strong class="text-success">${formatCurrency(profile.agent_price || 0)}</strong></td>
            <td><strong class="text-primary">${formatCurrency(profile.selling_price || 0)}</strong></td>
            <td>${getProfileStatusBadge(profile.is_active)}</td>
            <td><span class="badge bg-secondary">${profile.total_sales || 0}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showEditProfile(${profile.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-${profile.is_active ? 'warning' : 'success'} ms-1" onclick="toggleProfileStatus(${profile.id})">
                    <i class="fas fa-${profile.is_active ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteProfile(${profile.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Update pagination info
    const pagination = document.getElementById('profilePagination');
    pagination.innerHTML = `<li class="page-item"><span class="page-link">Menampilkan ${filteredProfiles.length} hasil pencarian untuk "${searchTerm}"</span></li>`;

    showLoading(false);
}

function showTransactionDetails(transactionId) {
    console.log('Show transaction details:', transactionId);
    loadAndShowTransactionDetail(transactionId);
}

async function loadAndShowTransactionDetail(transactionId) {
    try {
        showLoading(true);
        const response = await authenticatedFetch(`${API_BASE}/transactions/${transactionId}`);
        const result = await response.json();
        if (!result.success) {
            showAlert('Gagal memuat detail transaksi', 'danger');
            return;
        }
        const t = result.data;
        const body = document.getElementById('transactionDetailBody');
        if (!body) {
            showAlert('Komponen detail transaksi tidak ditemukan', 'danger');
            return;
        }

        body.innerHTML = `
            <div class="row mb-3">
                <div class="col-md-6">
                    <div><strong>ID:</strong> #${t.id}</div>
                    <div><strong>Tanggal:</strong> ${formatDateTime(t.created_at)}</div>
                    <div><strong>Status:</strong> <span class="badge bg-success">${t.status}</span></div>
                </div>
                <div class="col-md-6">
                    <div><strong>Customer:</strong> ${t.customer_name || '-'}</div>
                    <div><strong>Telepon:</strong> ${t.customer_phone || '-'}</div>
                    <div><strong>Jumlah:</strong> ${formatCurrency(t.amount)}</div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Password</th>
                            <th>Profil</th>
                            <th>Durasi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>${t.username || '-'}</code></td>
                            <td><code>${t.password || '-'}</code></td>
                            <td>${t.profile || '-'}</td>
                            <td>${t.duration || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        const modalEl = document.getElementById('transactionDetailModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (err) {
        console.error('loadAndShowTransactionDetail error:', err);
        showAlert('Terjadi kesalahan saat memuat detail transaksi', 'danger');
    } finally {
        showLoading(false);
    }
}

function printTransactionDetail() {
    const body = document.getElementById('transactionDetailBody');
    if (!body) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Print Transaksi</title>`);
    w.document.write('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">');
    w.document.write('</head><body>');
    w.document.write(body.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    w.print();
    w.close();
}

function showProfile() {
    // Load user profile data
    loadUserProfile();
    
    // Show profile section
    showSection('profile');
}

async function loadUserProfile() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/auth/me`);
        const result = await response.json();
        
        if (result.success) {
            updateUserProfileDisplay(result.user);
        } else {
            showAlert('Error loading profile: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showAlert('Error loading profile', 'danger');
    } finally {
        showLoading(false);
    }
}

function updateUserProfileDisplay(user) {
    // Update profile display
    document.getElementById('profileUsername').textContent = user.username || '-';
    document.getElementById('profileFullName').textContent = user.full_name || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profileRole').textContent = user.role || 'User';
    document.getElementById('profileCreatedAt').textContent = formatDateTime(user.created_at);
    document.getElementById('profileLastLogin').textContent = user.last_login ? formatDateTime(user.last_login) : 'Belum pernah login';
    
    // Populate edit form
    document.getElementById('editProfileFullName').value = user.full_name || '';
    document.getElementById('editProfileEmail').value = user.email || '';
    
    // Show profile section
    document.getElementById('profileSection').style.display = 'block';
}

async function updateUserProfile() {
    try {
        const fullName = document.getElementById('editProfileFullName').value.trim();
        const email = document.getElementById('editProfileEmail').value.trim();
        
        if (!fullName) {
            showAlert('Nama lengkap harus diisi', 'warning');
            return;
        }
        
        if (email && !isValidEmail(email)) {
            showAlert('Format email tidak valid', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            body: JSON.stringify({
                full_name: fullName,
                email: email || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Profil berhasil diupdate!', 'success');
            
            // Update current user data
            if (currentUser) {
                currentUser.full_name = fullName;
                currentUser.email = email;
                document.getElementById('currentUserName').textContent = fullName || currentUser.username;
            }
            
            // Refresh profile display
            loadUserProfile();
            
            // Close edit modal
            bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Error updating profile', 'danger');
    } finally {
        showLoading(false);
    }
}

async function changePassword() {
    try {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            showAlert('Semua field password harus diisi', 'warning');
            return;
        }
        
        if (newPassword.length < 6) {
            showAlert('Password baru minimal 6 karakter', 'warning');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showAlert('Password baru dan konfirmasi password tidak cocok', 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Password berhasil diubah! Silakan login ulang.', 'success');
            
            // Clear form
            document.getElementById('changePasswordForm').reset();
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            
            // Logout user after password change
            setTimeout(() => {
                doLogout();
            }, 2000);
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showAlert('Error changing password', 'danger');
    } finally {
        showLoading(false);
    }
}

// Show edit voucher profile modal (for voucher profiles)
function showEditProfileModal() {
    const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    modal.show();
}

// Show edit user profile modal (for admin user profile)
function showEditUserProfileModal() {
    try {
        // Load current user data first
        if (!currentUser) {
            showAlert('Data pengguna tidak tersedia', 'warning');
            return;
        }
        
        // Populate form with current data
        document.getElementById('editProfileFullName').value = currentUser.full_name || '';
        document.getElementById('editProfileEmail').value = currentUser.email || '';
        
        const modal = new bootstrap.Modal(document.getElementById('editUserProfileModal'));
        modal.show();
    } catch (error) {
        console.error('Error showing edit user profile modal:', error);
        showAlert('Error membuka form edit profil', 'danger');
    }
}

// Update user profile function
async function updateUserProfile() {
    try {
        const fullName = document.getElementById('editProfileFullName').value.trim();
        const email = document.getElementById('editProfileEmail').value.trim();
        
        if (!fullName) {
            showAlert('Nama lengkap harus diisi', 'warning');
            return;
        }
        
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('Format email tidak valid', 'warning');
            return;
        }
        
        const response = await authenticatedFetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            body: JSON.stringify({
                full_name: fullName,
                email: email || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Profil berhasil diperbarui!', 'success');
            
            // Update current user data
            if (currentUser) {
                currentUser.full_name = fullName;
                currentUser.email = email;
            }
            
            // Update navbar display
            const currentUserNameEl = document.getElementById('currentUserName');
            if (currentUserNameEl) {
                currentUserNameEl.textContent = fullName;
            }
            
            // Update profile display if visible
            updateUserProfileDisplay({
                full_name: fullName,
                email: email,
                username: currentUser?.username,
                role: currentUser?.role,
                created_at: currentUser?.created_at,
                last_login: currentUser?.last_login
            });
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('editUserProfileModal')).hide();
            
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Error updating profile', 'danger');
    }
}

function showChangePasswordModal() {
    console.log('🔑 showChangePasswordModal called');
    try {
        const modalElement = document.getElementById('changePasswordModal');
        console.log('🔍 Modal element found:', modalElement);
        
        if (!modalElement) {
            console.error('❌ changePasswordModal element not found');
            showAlert('Modal change password tidak ditemukan', 'danger');
            return;
        }
        
        const formElement = document.getElementById('changePasswordForm');
        console.log('🔍 Form element found:', formElement);
        
        if (formElement) {
            formElement.reset();
        }
        
        const modal = new bootstrap.Modal(modalElement);
        console.log('✅ Modal created, showing...');
    modal.show();
        
    } catch (error) {
        console.error('❌ Error in showChangePasswordModal:', error);
        showAlert('Error membuka modal change password: ' + error.message, 'danger');
    }
}

// Ensure function is globally available
window.showChangePasswordModal = showChangePasswordModal;

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Cleanup expired vouchers
async function cleanupExpiredVouchers() {
    if (!confirm('Apakah Anda yakin ingin menjalankan cleanup voucher expired? Proses ini akan menghapus voucher yang sudah expired dari Mikrotik.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/cleanup-expired`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Cleanup berhasil! ${result.data.cleanedCount} voucher expired telah dibersihkan.`, 'success');
            // Refresh data
            loadVouchers();
            loadActiveUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error cleanup expired vouchers:', error);
        showAlert('Error melakukan cleanup voucher expired', 'danger');
    } finally {
        showLoading(false);
    }
}

// Sync dengan Mikrotik
async function syncWithMikrotik() {
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/sync-mikrotik`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            let message = `Sync berhasil! ${result.data.syncedCount} voucher telah disinkronisasi.`;
            if (result.data.issues && result.data.issues.length > 0) {
                message += `\n\n${result.data.issues.length} issue ditemukan:`;
                result.data.issues.forEach(issue => {
                    message += `\n- ${issue.voucher}: ${issue.issue}`;
                });
            }
            showAlert(message, 'success');
            
            // Refresh data
            loadVouchers();
            loadActiveUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error sync with Mikrotik:', error);
        showAlert('Error melakukan sinkronisasi dengan Mikrotik', 'danger');
    } finally {
        showLoading(false);
    }
}

// Re-sync missing vouchers
async function resyncMissingVouchers() {
    if (!confirm('Apakah Anda yakin ingin me-resync voucher yang hilang? Proses ini akan membuat ulang voucher di database yang tidak ada di Mikrotik.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/resync-missing`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Re-sync berhasil! ${result.data.resyncedCount} voucher telah dibuat ulang di Mikrotik.`, 'success');
            // Refresh data
            loadVouchers();
            loadHotspotUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error re-sync missing vouchers:', error);
        showAlert('Error melakukan re-sync voucher', 'danger');
    } finally {
        showLoading(false);
    }
}

// Import users dari Mikrotik ke database
async function importMikrotikUsers() {
    if (!confirm('Apakah Anda yakin ingin mengimpor user dari Mikrotik ke database? User yang sudah ada akan di-skip.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/import-mikrotik-users`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            let message = `Import berhasil! ${result.data.imported} user berhasil diimpor dari Mikrotik.`;
            if (result.data.skipped > 0) {
                message += ` ${result.data.skipped} user di-skip karena sudah ada.`;
            }
            if (result.data.errors && result.data.errors.length > 0) {
                message += ` ${result.data.errors.length} error ditemukan (lihat console untuk detail).`;
                console.warn('Import errors:', result.data.errors);
            }
            showAlert(message, 'success');
            
            // Refresh data
            loadVouchers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error importing Mikrotik users:', error);
        showAlert('Error mengimpor user dari Mikrotik', 'danger');
    } finally {
        showLoading(false);
    }
}

// Import profiles dari Mikrotik ke database
async function importMikrotikProfiles() {
    if (!confirm('Apakah Anda yakin ingin mengimpor profile dari Mikrotik ke database? Profile yang sudah ada akan di-skip.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/profiles/import-mikrotik`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            let message = `Import berhasil! ${result.data.imported} profile berhasil diimpor dari Mikrotik.`;
            if (result.data.skipped > 0) {
                message += ` ${result.data.skipped} profile di-skip karena sudah ada.`;
            }
            if (result.data.errors && result.data.errors.length > 0) {
                message += ` ${result.data.errors.length} error ditemukan (lihat console untuk detail).`;
                console.warn('Import errors:', result.data.errors);
            }
            showAlert(message, 'success');
            
            // Refresh data
            loadProfiles();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error importing Mikrotik profiles:', error);
        showAlert('Error mengimpor profile dari Mikrotik', 'danger');
    } finally {
        showLoading(false);
    }
}

// Full sync dua arah
async function fullSyncWithMikrotik() {
    if (!confirm('Apakah Anda yakin ingin melakukan sinkronisasi lengkap dua arah? Ini akan mengimpor profiles dan users dari Mikrotik, serta menyamakan data antara database dan Mikrotik.')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/vouchers/full-sync`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            let message = `Full sync berhasil!\n`;
            message += `- Profiles: ${result.data.profiles.imported} imported, ${result.data.profiles.skipped} skipped\n`;
            message += `- Users: ${result.data.users.imported} imported, ${result.data.users.skipped} skipped\n`;
            
            if (result.data.profiles.errors && result.data.profiles.errors.length > 0) {
                message += `\nProfile errors: ${result.data.profiles.errors.length} (lihat console untuk detail)`;
                console.warn('Profile import errors:', result.data.profiles.errors);
            }
            
            if (result.data.users.errors && result.data.users.errors.length > 0) {
                message += `\nUser errors: ${result.data.users.errors.length} (lihat console untuk detail)`;
                console.warn('User import errors:', result.data.users.errors);
            }
            
            showAlert(message, 'success');
            
            // Refresh semua data
            loadVouchers();
            loadProfiles();
            loadActiveUsers();
            loadHotspotUsers();
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error full sync with Mikrotik:', error);
        showAlert('Error melakukan full sync dengan Mikrotik', 'danger');
    } finally {
        showLoading(false);
    }
}

// ======================================
// AGENT MANAGEMENT FUNCTIONS
// ======================================

function showAddAgentModal() {
    // Clear form
    document.getElementById('addAgentForm').reset();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addAgentModal'));
    modal.show();
}

async function addAgent() {
    const username = document.getElementById('agentUsername').value.trim();
    const password = document.getElementById('agentPassword').value;
    const fullName = document.getElementById('agentFullName').value.trim();
    const email = document.getElementById('agentEmail').value.trim();
    const phone = document.getElementById('agentPhone').value.trim();
    const address = document.getElementById('agentAddress').value.trim();

    // Validation
    if (!username || !password || !fullName || !phone) {
        showAlert('Harap isi semua field yang wajib diisi (*)!', 'warning');
        return;
    }

    if (password.length < 6) {
        showAlert('Password minimal 6 karakter!', 'warning');
        return;
    }

    if (!phone.match(/^628\d{9,12}$/)) {
        showAlert('Format nomor WhatsApp tidak valid! Contoh: 628123456789', 'warning');
        return;
    }

    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showAlert('Format email tidak valid!', 'warning');
        return;
    }

    try {
        showLoading(true);

        const response = await authenticatedFetch(`${API_BASE}/agents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                full_name: fullName,
                email: email || null,
                phone,
                address: address || null
            })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Agent berhasil ditambahkan!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addAgentModal'));
            modal.hide();
            
            // Refresh agent list if on agents page
            if (document.getElementById('agents').style.display !== 'none') {
                loadAgents();
            }
        } else {
            showAlert('Error: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error adding agent:', error);
        showAlert('Error menambahkan agent', 'danger');
    } finally {
        showLoading(false);
    }
}

function showAgents() {
    showSection('agents');
    // Check if elements exist
    const agentsList = document.getElementById('agentsList');
    const totalAgents = document.getElementById('totalAgents');
    
    // Only load if not already loading
    if (!isLoadingAgents) {
        loadAgents();
    }
    
    if (!isLoadingAgentStats) {
        loadAgentStats();
    }
}

async function loadAgents() {
    try {
        showLoading(true);

        const response = await authenticatedFetch(`${API_BASE}/agents`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('loadAgents: HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }
        
        const result = await response.json();

        if (result.success) {
            const payload = (typeof result.data !== 'undefined') ? result.data : result;
            const agents = Array.isArray(payload)
                ? payload
                : (payload.agents || payload.users || payload.items || []);
            updateAgentsTable(agents);
        } else {
            console.error('loadAgents: API returned error:', result.message);
            showAlert('Error loading agents: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('loadAgents: Exception occurred:', error);
        showAlert('Error loading agents: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

async function loadAgentStats() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/agents/stats`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();

        if (result.success) {
            updateAgentStats(result.stats);
        } else {
            console.error('Error loading agent stats:', result.message);
        }
    } catch (error) {
        console.error('Error loading agent stats:', error);
    }
}

function updateAgentsTable(agents) {
    const tbody = document.getElementById('agentsList');
    
    if (!tbody) {
        console.error('updateAgentsTable: agentsList element not found!');
        return;
    }
    
    if (!agents || agents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Belum ada agent</td></tr>';
        return;
    }

    try {
        tbody.innerHTML = agents.map(agent => `
            <tr>
                <td>${agent.id || 'N/A'}</td>
                <td>${agent.username || 'N/A'}</td>
                <td>${agent.full_name || 'N/A'}</td>
                <td>${agent.phone || '-'}</td>
                <td>
                    <span class="badge bg-info">${formatCurrency(agent.balance || 0)}</span>
                </td>
                <td>
                    <span class="badge ${agent.is_active ? 'bg-success' : 'bg-secondary'}">
                        ${agent.is_active ? 'Aktif' : 'Non-aktif'}
                    </span>
                </td>
                <td>${agent.created_at ? formatDate(agent.created_at) : 'N/A'}</td>
                <td>${agent.last_login ? formatDate(agent.last_login) : 'Belum pernah'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="viewAgentDetail(${agent.id})" title="Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-success" onclick="showDepositModal(${agent.id}, '${agent.username}', ${agent.balance || 0})" title="Deposit">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="editAgent(${agent.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteAgent(${agent.id}, '${agent.username}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('updateAgentsTable: Error updating table:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error updating table</td></tr>';
    }
}

function updateAgentStats(stats) {
    document.getElementById('totalAgents').textContent = stats.total || 0;
    document.getElementById('totalAgentTransactions').textContent = stats.transactions || 0;
    document.getElementById('totalAgentBalance').textContent = formatCurrency(stats.total_balance || 0);
    document.getElementById('totalAgentRevenue').textContent = formatCurrency(stats.revenue || 0);
}

// ======================================
// WHATSAPP ORDER FUNCTIONS
// ======================================

// ======================================
// WHATSAPP GATEWAY FUNCTIONS (SIMPLIFIED)
// ======================================

function showWhatsAppOrderModal() {
    // Clear form
    document.getElementById('whatsAppOrderForm').reset();
    document.getElementById('waOrderSummary').style.display = 'none';
    
    // Load profiles for selection
    loadProfilesForWhatsApp();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('whatsAppOrderModal'));
    modal.show();
}

async function loadProfilesForWhatsApp() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/profiles`);
        const result = await response.json();

        if (result.success) {
            const select = document.getElementById('waProfileSelect');
            select.innerHTML = '<option value="">Pilih profil voucher...</option>';
            
            result.profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile.id;
                option.textContent = `${profile.name} - ${formatCurrency(profile.selling_price || 0)} - ${profile.duration}`;
                option.dataset.profile = JSON.stringify(profile);
                select.appendChild(option);
            });

            // Add event listener for profile selection
            select.addEventListener('change', updateWhatsAppOrderSummary);
            document.getElementById('waQuantity').addEventListener('input', updateWhatsAppOrderSummary);
        }
    } catch (error) {
        console.error('Error loading profiles for WhatsApp:', error);
    }
}

function updateWhatsAppOrderSummary() {
    const profileSelect = document.getElementById('waProfileSelect');
    const quantity = parseInt(document.getElementById('waQuantity').value) || 0;
    const summary = document.getElementById('waOrderSummary');

    if (profileSelect.value && quantity > 0) {
        const profile = JSON.parse(profileSelect.options[profileSelect.selectedIndex].dataset.profile);
        const total = (profile.selling_price || 0) * quantity;

        document.getElementById('waSummaryProfile').textContent = `${profile.name} x ${quantity}`;
        document.getElementById('waSummaryTotal').textContent = formatCurrency(total);
        
        summary.style.display = 'block';
    } else {
        summary.style.display = 'none';
    }
}

async function processWhatsAppOrder() {
    const customerName = document.getElementById('waCustomerName').value.trim();
    const customerPhone = document.getElementById('waCustomerPhone').value.trim();
    const profileId = document.getElementById('waProfileSelect').value;
    const quantity = parseInt(document.getElementById('waQuantity').value);
    const paymentMethod = document.getElementById('waPaymentMethod').value;
    const notes = document.getElementById('waNotes').value.trim();

    // Validation
    if (!customerName || !customerPhone || !profileId || !quantity || !paymentMethod) {
        showAlert('Harap isi semua field yang wajib diisi!', 'warning');
        return;
    }

    if (!customerPhone.match(/^628\d{9,12}$/)) {
        showAlert('Format nomor WhatsApp tidak valid! Contoh: 628123456789', 'warning');
        return;
    }

    try {
        showLoading(true);

        // Get profile details
        const profileSelect = document.getElementById('waProfileSelect');
        const profile = JSON.parse(profileSelect.options[profileSelect.selectedIndex].dataset.profile);
        const total = (profile.selling_price || 0) * quantity;

        // Generate vouchers for the order
        const vouchers = [];
        for (let i = 0; i < quantity; i++) {
            const voucherResponse = await authenticatedFetch(`${API_BASE}/vouchers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    profile_id: profileId,
                    customer_name: customerName
                })
            });

            const voucherResult = await voucherResponse.json();
            if (voucherResult.success) {
                vouchers.push(voucherResult.voucher);
            }
        }

        if (vouchers.length === quantity) {
            // Generate WhatsApp message
            const message = generateWhatsAppMessage(customerName, vouchers, profile, total, paymentMethod, notes);
            
            // Open WhatsApp
            const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');

            showAlert(`${quantity} voucher berhasil dibuat dan pesan WhatsApp siap dikirim!`, 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('whatsAppOrderModal'));
            modal.hide();
            
            // Refresh voucher list if on vouchers page
            if (document.getElementById('vouchers').style.display !== 'none') {
                loadVouchers();
            }
        } else {
            showAlert('Error membuat voucher untuk order WhatsApp', 'danger');
        }
    } catch (error) {
        console.error('Error processing WhatsApp order:', error);
        showAlert('Error memproses order WhatsApp', 'danger');
    } finally {
        showLoading(false);
    }
}

function generateWhatsAppMessage(customerName, vouchers, profile, total, paymentMethod, notes) {
    let message = `🎫 *VOUCHER WIFI INTERNET*\n\n`;
    message += `Halo ${customerName}! 👋\n\n`;
    message += `📦 *Detail Pesanan:*\n`;
    message += `• Paket: ${profile.name}\n`;
    message += `• Durasi: ${profile.duration}\n`;
    message += `• Jumlah: ${vouchers.length} voucher\n`;
    message += `• Total: ${formatCurrency(total)}\n`;
    message += `• Pembayaran: ${paymentMethod}\n\n`;
    
    if (notes) {
        message += `📝 *Catatan:* ${notes}\n\n`;
    }
    
    message += `🎫 *Kode Voucher:*\n`;
    vouchers.forEach((voucher, index) => {
        message += `${index + 1}. \`${voucher.code}\`\n`;
    });
    
    message += `\n📋 *Cara Penggunaan:*\n`;
    message += `1. Sambungkan ke WiFi hotspot\n`;
    message += `2. Buka browser dan masuk halaman login\n`;
    message += `3. Masukkan kode voucher\n`;
    message += `4. Klik "Login" untuk mulai browsing\n\n`;
    message += `⏰ *Voucher aktif setelah digunakan pertama kali*\n\n`;
    message += `Terima kasih! 🙏`;
    
    return message;
}

// Agent deposit functions
async function showDepositModal(agentId, username, currentBalance) {
    try {
        // Load full agent data first to get complete information
        const response = await authenticatedFetch(`${API_BASE}/agents`);
        const result = await response.json();
        
        if (!result.success) {
            showAlert('Gagal memuat data agent: ' + result.message, 'danger');
            return;
        }
        
        const agents = Array.isArray(result.data) ? result.data : (result.data.agents || result.data.users || result.data.items || []);
        
        // Find the specific agent
        const selectedAgent = agents.find(agent => agent.id == agentId);
        if (!selectedAgent) {
            showAlert('Agent tidak ditemukan', 'danger');
            return;
        }
        
        // Use the enhanced modal content (same as showDepositAgentModal)
        const modalBody = document.querySelector('#depositAgentModal .modal-body');
        modalBody.innerHTML = `
            <div id="agentInfoSection">
                <div class="card mb-3" style="background-color: #f8f9fa; border: 1px solid #e9ecef;">
                    <div class="card-body py-2">
                        <h6 class="card-title mb-2"><i class="fas fa-info-circle me-1 text-primary"></i>Informasi Agent</h6>
                        <div class="row">
                            <div class="col-sm-6">
                                <small class="text-muted">Nama Agent:</small>
                                <div id="selectedAgentName" class="fw-bold">${selectedAgent.full_name}</div>
                            </div>
                            <div class="col-sm-6">
                                <small class="text-muted">Username:</small>
                                <div id="selectedAgentUsername" class="fw-bold">${selectedAgent.username}</div>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-sm-6">
                                <small class="text-muted">Saldo Saat Ini:</small>
                                <div id="selectedAgentBalance" class="fw-bold text-primary">Rp ${(selectedAgent.balance || 0).toLocaleString('id-ID')}</div>
                            </div>
                            <div class="col-sm-6">
                                <small class="text-muted">WhatsApp:</small>
                                <div id="selectedAgentPhone" class="fw-bold">${selectedAgent.phone || 'Tidak ada'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <input type="hidden" id="selectDepositAgent" value="${agentId}">
            
            <div class="mb-3">
                <label for="depositAmount" class="form-label"><i class="fas fa-money-bill-wave me-1"></i>Jumlah Deposit *</label>
                <div class="input-group">
                    <span class="input-group-text">Rp</span>
                    <input type="number" class="form-control" id="depositAmount" required min="1000" step="1000" placeholder="0">
                </div>
                <div class="form-text">Minimal deposit Rp 1.000</div>
            </div>
            
            <div id="newBalancePreview" class="mb-3" style="display: none;">
                <div class="alert alert-success py-2">
                    <small class="text-muted">Saldo setelah deposit:</small>
                    <div id="previewNewBalance" class="fw-bold text-success">-</div>
                </div>
            </div>
            
            <div class="mb-3">
                <label for="depositNotes" class="form-label"><i class="fas fa-sticky-note me-1"></i>Catatan</label>
                <textarea class="form-control" id="depositNotes" rows="2" placeholder="Contoh: Deposit awal, Top up saldo untuk promosi, dll"></textarea>
            </div>
        `;
        
        // Add event listener to deposit amount for preview
        const depositAmountInput = document.getElementById('depositAmount');
        const newBalancePreview = document.getElementById('newBalancePreview');
        const currentBalance = selectedAgent.balance || 0;
        
        depositAmountInput.addEventListener('input', function() {
            const depositAmount = parseInt(this.value || 0);
            
            if (depositAmount > 0) {
                const newBalance = currentBalance + depositAmount;
                document.getElementById('previewNewBalance').textContent = `Rp ${newBalance.toLocaleString('id-ID')}`;
                newBalancePreview.style.display = 'block';
            } else {
                newBalancePreview.style.display = 'none';
            }
        });
        
        // Reset and show modal
        document.getElementById('depositAgentForm').reset();
    const modal = new bootstrap.Modal(document.getElementById('depositAgentModal'));
    modal.show();
        
    } catch (error) {
        console.error('Error showing deposit modal:', error);
        showAlert('Error memuat form deposit', 'danger');
    }
}

async function processDeposit() {
    const agentId = document.getElementById('selectDepositAgent').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const notes = document.getElementById('depositNotes').value;
    
    if (!agentId) {
        showAlert('Pilih agent terlebih dahulu', 'danger');
        return;
    }
    
    if (!amount || amount <= 0) {
        showAlert('Jumlah deposit harus lebih dari 0', 'danger');
        return;
    }
    
    if (amount < 1000) {
        showAlert('Minimal deposit Rp 1.000', 'danger');
        return;
    }
    
    try {
        showLoading(true);
        const response = await authenticatedFetch(`${API_BASE}/agents/deposit`, {
            method: 'POST',
            body: JSON.stringify({
                agent_id: agentId,
                amount,
                notes
            })
        });
        
            const result = await response.json();
        
        if (response.ok && result.success) {
            const data = result.data;
            let successMessage = `💰 Deposit berhasil!\n\n`;
            successMessage += `👤 Agent: ${data.agent_name}\n`;
            successMessage += `💵 Jumlah: Rp ${data.deposit_amount.toLocaleString('id-ID')}\n`;
            successMessage += `💰 Saldo Baru: Rp ${data.new_balance.toLocaleString('id-ID')}`;
            
            if (data.whatsapp_sent) {
                successMessage += `\n📱 Notifikasi WhatsApp telah dikirim ke ${data.agent_phone}`;
            } else if (data.agent_phone) {
                successMessage += `\n⚠️ WhatsApp gagal dikirim ke ${data.agent_phone}`;
            } else {
                successMessage += `\n⚠️ Agent tidak memiliki nomor WhatsApp`;
            }
            
            showAlert(successMessage, 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('depositAgentModal'));
                modal.hide();
                
                // Refresh agent data
                loadAgents();
                loadAgentStats();
            } else {
            showAlert(`Error: ${result.message || 'Gagal memproses deposit'}`, 'danger');
        }
    } catch (error) {
        console.error('Error processing deposit:', error);
        showAlert('Error: Gagal memproses deposit', 'danger');
    } finally {
        showLoading(false);
    }
}

// Wire deposit form submit to processDeposit
document.addEventListener('DOMContentLoaded', () => {
    const depositForm = document.getElementById('depositAgentForm');
    if (depositForm) {
        depositForm.addEventListener('submit', (e) => {
            e.preventDefault();
            processDeposit();
        });
    }
});

// Additional Agent actions
async function viewAgentDetail(id) {
    try {
        showLoading(true);
        const response = await authenticatedFetch(`${API_BASE}/agents/${id}`);
        const result = await response.json();
        if (!result.success) {
            showAlert('Gagal memuat detail agent: ' + (result.message || ''), 'danger');
            return;
        }

        const agent = result.agent;
        const modalHtml = `
            <div class="modal fade" id="agentDetailModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-user me-2"></i>Detail Agent: ${agent.username}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-2"><strong>Nama:</strong> ${agent.full_name || '-'}</div>
                            <div class="mb-2"><strong>WhatsApp:</strong> ${agent.phone || '-'}</div>
                            <div class="mb-2"><strong>Email:</strong> ${agent.email || '-'}</div>
                            <div class="mb-2"><strong>Alamat:</strong> ${agent.address || '-'}</div>
                            <div class="mb-2"><strong>Saldo:</strong> ${formatCurrency(agent.balance || 0)}</div>
                            <div class="mb-2"><strong>Status:</strong> ${agent.is_active ? 'Aktif' : 'Non-aktif'}</div>
                            <div class="mb-2"><strong>Dibuat:</strong> ${agent.created_at ? formatDate(agent.created_at) : '-'}</div>
                            <div class="mb-2"><strong>Login terakhir:</strong> ${agent.last_login ? formatDate(agent.last_login) : '-'}</div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                        </div>
                    </div>
                </div>
            </div>`;

        const existing = document.getElementById('agentDetailModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('agentDetailModal'));
        modal.show();
    } catch (err) {
        console.error('viewAgentDetail error:', err);
        showAlert('Error memuat detail agent', 'danger');
    } finally {
        showLoading(false);
    }
}

async function editAgent(id) {
    try {
        showLoading(true);
        // Load current data
        const res = await authenticatedFetch(`${API_BASE}/agents/${id}`);
        const data = await res.json();
        if (!data.success) {
            showAlert('Gagal memuat data agent: ' + (data.message || ''), 'danger');
            return;
        }
        const agent = data.agent;

        const modalHtml = `
            <div class="modal fade" id="editAgentModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-edit me-2"></i>Edit Agent: ${agent.username}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="editAgentForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Username *</label>
                                    <input type="text" class="form-control" id="editUsername" required value="${agent.username || ''}" readonly>
                                    <div class="form-text">Username tidak dapat diubah</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Password Baru</label>
                                    <input type="password" class="form-control" id="editPassword" minlength="6">
                                    <div class="form-text">Kosongkan jika tidak ingin mengubah password</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nama Lengkap *</label>
                                    <input type="text" class="form-control" id="editFullName" required value="${agent.full_name || ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nomor WhatsApp *</label>
                                    <input type="tel" class="form-control" id="editPhone" required value="${agent.phone || ''}" placeholder="628xxxxxxxxxx">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="editEmail" value="${agent.email || ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Alamat</label>
                                    <textarea class="form-control" id="editAddress" rows="2">${agent.address || ''}</textarea>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="editIsActive" ${agent.is_active ? 'checked' : ''}>
                                    <label class="form-check-label" for="editIsActive">Aktif</label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                                <button type="submit" class="btn btn-primary"><i class="fas fa-save me-1"></i>Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>`;

        const existing = document.getElementById('editAgentModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('editAgentModal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.querySelector('#editAgentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = modalEl.querySelector('#editFullName').value.trim();
            const phone = modalEl.querySelector('#editPhone').value.trim();
            const email = modalEl.querySelector('#editEmail').value.trim();
            const address = modalEl.querySelector('#editAddress').value.trim();
            const password = modalEl.querySelector('#editPassword').value;
            const is_active = modalEl.querySelector('#editIsActive').checked;

            if (!full_name || !phone) {
                showAlert('Nama lengkap dan nomor WhatsApp wajib diisi', 'warning');
                return;
            }
            if (!/^628\d{9,12}$/.test(phone)) {
                showAlert('Format nomor WhatsApp tidak valid. Contoh: 628123456789', 'warning');
                return;
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showAlert('Format email tidak valid', 'warning');
                return;
            }
            if (password && password.length < 6) {
                showAlert('Password minimal 6 karakter!', 'warning');
                return;
            }

            try {
                showLoading(true);
                
                const updateData = { 
                    full_name, 
                    phone, 
                    email: email || null, 
                    address: address || null, 
                    is_active 
                };
                
                // Only include password if provided
                if (password && password.trim()) {
                    updateData.password = password;
                }
                
                const resp = await authenticatedFetch(`${API_BASE}/agents/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                const out = await resp.json();
                if (out.success) {
                    const successMsg = password ? 'Agent berhasil diupdate (termasuk password)' : 'Agent berhasil diupdate';
                    showAlert(successMsg, 'success');
                    modal.hide();
                    loadAgents();
                    loadAgentStats();
                } else {
                    showAlert('Gagal mengupdate agent: ' + (out.message || ''), 'danger');
                }
            } catch (e) {
                console.error('editAgent submit error:', e);
                showAlert('Error mengupdate agent', 'danger');
            } finally {
                showLoading(false);
            }
        });

        modal.show();
    } catch (err) {
        console.error('editAgent error:', err);
        showAlert('Error membuka form edit agent', 'danger');
    } finally {
        showLoading(false);
    }
}

async function deleteAgent(id, username) {
    try {
        const ok = confirm(`Hapus agent "${username}" (ID: ${id})? Tindakan ini tidak dapat dibatalkan.`);
        if (!ok) return;
        showLoading(true);
        const resp = await authenticatedFetch(`${API_BASE}/agents/${id}`, { method: 'DELETE' });
        const result = await resp.json();
        if (result.success) {
            showAlert('Agent berhasil dihapus', 'success');
            loadAgents();
            loadAgentStats();
        } else {
            showAlert('Gagal menghapus agent: ' + (result.message || ''), 'danger');
        }
    } catch (err) {
        console.error('deleteAgent error:', err);
        showAlert('Error menghapus agent', 'danger');
    } finally {
        showLoading(false);
    }
}

// ======================================
// WHATSAPP GATEWAY FUNCTIONS
// ======================================

function showWhatsAppGateway() {
    console.log('🚀 Showing WhatsApp Gateway section...');
    showSection('whatsapp');
    
    // Wait for section to be visible
    setTimeout(() => {
        console.log('🔍 WhatsApp section visible:', document.getElementById('whatsapp').style.display);
        console.log('🔍 WhatsApp section exists:', !!document.getElementById('whatsapp'));
        console.log('🔍 All rows in whatsapp:', document.querySelectorAll('#whatsapp .row').length);
        
        getWhatsAppStatus();
        loadWhatsAppOrders();
        
        // Start auto-refresh for status and QR code
        startWhatsAppStatusAutoRefresh();
        startQRCodeAutoRefresh();
    }, 100);
}

async function initializeWhatsAppGateway() {
    try {
        showAlert('🔄 Menginisialisasi WhatsApp Gateway...', 'info');
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/initialize`, {
            method: 'POST'
        });
        
            const result = await response.json();
        
            if (result.success) {
                showAlert('WhatsApp Gateway berhasil diinisialisasi', 'success');
                getWhatsAppStatus();
            
            // Check for QR code after initialization
            setTimeout(() => {
                getWhatsAppQRCode();
            }, 2000);
            } else {
            showAlert(result.message || 'Gagal menginisialisasi WhatsApp Gateway', 'danger');
        }
    } catch (error) {
        console.error('Error initializing WhatsApp gateway:', error);
        showAlert('Error menginisialisasi WhatsApp Gateway', 'danger');
    } finally {
        showLoading(false);
    }
}

async function disconnectWhatsAppGateway() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/disconnect`, {
            method: 'POST'
        });
        
            const result = await response.json();
        
            if (result.success) {
                showAlert('WhatsApp Gateway berhasil diputuskan', 'success');
                getWhatsAppStatus();
            } else {
            showAlert(result.message || 'Gagal memutuskan WhatsApp Gateway', 'danger');
        }
    } catch (error) {
        console.error('Error disconnecting WhatsApp gateway:', error);
        showAlert('Error memutuskan WhatsApp Gateway', 'danger');
    }
}

async function getWhatsAppStatus() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/status`);
            const result = await response.json();
        
            if (result.success) {
                updateWhatsAppStatus(result.status);
        }
    } catch (error) {
        console.error('Error getting WhatsApp status:', error);
    }
}

// Update WhatsApp Status in dashboard
function updateWhatsAppStatus(status) {
    console.log('🔄 Updating WhatsApp status:', status);
    console.log('🔍 Status details:', {
        isConnected: status.isConnected,
        connectionStatus: status.connectionStatus,
        isInitialized: status.isInitialized,
        hasSession: status.hasSession,
        qrCode: !!status.qrCode,
        qrCodeDataUrl: !!status.qrCodeDataUrl,
        qrCodeText: !!status.qrCodeText
    });
    
    const statusElement = document.getElementById('whatsappStatus');
    const phoneElement = document.getElementById('whatsappPhone');
    const ordersElement = document.getElementById('whatsappOrders');
    const connectionInfo = document.getElementById('connectionInfo');
    
    if (statusElement) {
    if (status.isConnected) {
            statusElement.innerHTML = '🟢 Connected';
            statusElement.className = 'text-success';
        } else if (status.connectionStatus === 'qr_ready') {
            statusElement.innerHTML = '🟡 QR Code Ready';
            statusElement.className = 'text-warning';
        } else if (status.connectionStatus === 'reconnecting') {
            statusElement.innerHTML = '🟠 Reconnecting';
            statusElement.className = 'text-warning';
        } else if (status.connectionStatus === 'disconnected') {
            if (status.isInitialized) {
                statusElement.innerHTML = '🟡 Initialized (Waiting for QR)';
                statusElement.className = 'text-warning';
    } else {
                statusElement.innerHTML = '🔴 Not Initialized';
                statusElement.className = 'text-danger';
            }
        } else if (status.connectionStatus === 'error') {
            statusElement.innerHTML = '❌ Error';
            statusElement.className = 'text-danger';
        } else {
            statusElement.innerHTML = '⚪ Unknown';
            statusElement.className = 'text-secondary';
        }
    }
    
    if (phoneElement) {
        phoneElement.textContent = status.phoneNumber || '-';
    }
    
    if (ordersElement) {
        ordersElement.textContent = status.activeOrders || 0;
    }
    
    if (connectionInfo) {
        connectionInfo.innerHTML = `
            <div class="mb-2"><strong>Status:</strong> ${status.connectionStatus || 'disconnected'}</div>
            <div class="mb-2"><strong>Initialized:</strong> ${status.isInitialized ? 'Yes' : 'No'}</div>
            <div class="mb-2"><strong>Has Session:</strong> ${status.hasSession ? 'Yes' : 'No'}</div>
            <div class="mb-2"><strong>Reconnect Attempts:</strong> ${status.reconnectAttempts || 0}</div>
            <div class="mb-2"><strong>Active Orders:</strong> ${status.activeOrders || 0}</div>
        `;
    }
}

async function getWhatsAppQRCode() {
    try {
        console.log('🔍 Fetching WhatsApp QR Code...');
        console.log('🔑 Auth Token available:', !!authToken);
        console.log('🔑 Auth Token length:', authToken ? authToken.length : 0);
        
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/qr-code`);
        const result = await response.json();
        
        console.log('📱 QR Code API Response:', result);
        console.log('📱 Response success:', result.success);
        console.log('📱 Has qrCodeDataUrl:', !!result.qrCodeDataUrl);
        console.log('📱 Has qrCodeText:', !!result.qrCodeText);
        console.log('📱 Is connected:', result.isConnected);
        
        if (result.success && result.qrCodeDataUrl) {
            console.log('✅ Using QR Code Data URL');
            console.log('🔗 Data URL length:', result.qrCodeDataUrl.length);
            // Display QR code directly in dashboard
            showQRCodeInDashboard(result.qrCodeDataUrl);
        } else if (result.success && result.qrCodeText) {
            console.log('✅ Using QR Code Text fallback');
            console.log('🔗 Text length:', result.qrCodeText.length);
            // Fallback: use QR code text to generate QR code
            showQRCodeFromText(result.qrCodeText);
        } else if (result.success && result.isConnected) {
            console.log('✅ WhatsApp already connected');
            showAlert('✅ WhatsApp sudah terhubung!', 'success');
            hideQRCodeFromDashboard();
        } else {
            console.log('❌ No QR code available');
            console.log('❌ Response details:', result);
            console.log('🔍 Status analysis:', {
                success: result.success,
                connectionStatus: result.connectionStatus,
                isConnected: result.isConnected,
                qrCode: !!result.qrCode,
                qrCodeDataUrl: !!result.qrCodeDataUrl,
                qrCodeText: !!result.qrCodeText,
                isInitialized: result.isInitialized,
                hasSession: result.hasSession
            });
            
            if (result.connectionStatus === 'disconnected' && !result.isInitialized) {
                showAlert('⚠️ WhatsApp Gateway belum diinisialisasi. Silakan klik "Start Gateway" terlebih dahulu.', 'warning');
            } else if (result.connectionStatus === 'disconnected' && result.isInitialized) {
                showAlert('🟡 WhatsApp Gateway sudah diinisialisasi, menunggu QR Code. Coba refresh dalam beberapa detik.', 'info');
            } else if (result.connectionStatus === 'qr_ready') {
                showAlert('🟡 QR Code tersedia! Silakan scan dengan WhatsApp Anda.', 'info');
            } else {
                showAlert('QR Code tidak tersedia. Coba klik "Start Gateway" terlebih dahulu.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error getting QR code:', error);
        showAlert('Error mendapatkan QR code', 'danger');
    }
}

async function resetWhatsAppSession() {
    if (!confirm('Reset koneksi akan menghapus sesi WhatsApp dan menampilkan QR baru. Lanjutkan?')) return;
    try {
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/reset-session`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            showAlert('Sesi direset. QR Code baru siap dipindai.', 'success');
            const status = result.status || {};
            if (status.qrCodeDataUrl) {
                showQRCodeInDashboard(status.qrCodeDataUrl);
            } else if (status.qrCodeText) {
                showQRCodeFromText(status.qrCodeText);
            } else {
                await getWhatsAppQRCode();
            }
        } else {
            showAlert('Gagal mereset sesi: ' + (result.message || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error resetting session:', error);
        showAlert('Error mereset sesi WhatsApp', 'danger');
    }
}

function showQRCodeFromText(qrCodeText) {
    // Generate QR code from text using qrcode.js library
    try {
        // Create QR code container in dashboard
        let qrCodeContainer = document.getElementById('dashboardQRCode');
        
        if (!qrCodeContainer) {
            // Create QR code container if it doesn't exist
            const statusRow = document.querySelector('#whatsapp .row.mb-4');
            if (statusRow) {
                const qrCodeCol = document.createElement('div');
                qrCodeCol.className = 'col-12 mb-4';
                qrCodeCol.innerHTML = `
                    <div class="card border-warning">
                        <div class="card-header bg-warning text-white">
                            <h6 class="mb-0"><i class="fas fa-qrcode me-2"></i>QR Code WhatsApp</h6>
                        </div>
                        <div class="card-body text-center">
                            <div id="dashboardQRCode">
                                <div id="qrCodeCanvas"></div>
                            </div>
                            <p class="mt-3 mb-2">📱 <strong>Scan QR Code ini dengan WhatsApp Anda:</strong></p>
                            <ol class="text-start" style="display: inline-block;">
                                <li>Buka WhatsApp di HP</li>
                                <li>Menu → WhatsApp Web</li>
                                <li>Scan QR Code di atas</li>
                            </ol>
                            <div class="mt-3">
                                <button class="btn btn-primary btn-sm" onclick="getWhatsAppQRCode()">
                                    <i class="fas fa-sync-alt me-1"></i>Refresh QR Code
                                </button>
                                <button class="btn btn-success btn-sm ms-2" onclick="checkWhatsAppConnection()">
                                    <i class="fas fa-check me-1"></i>Cek Koneksi
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                statusRow.appendChild(qrCodeCol);
            }
        }
        
        // Generate QR code using qrcode.js
        const qrCodeCanvas = document.getElementById('qrCodeCanvas');
        if (qrCodeCanvas && qrCodeCanvas.innerHTML === '') {
            // Load qrcode.js library dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
            script.onload = function() {
                QRCode.toCanvas(qrCodeCanvas, qrCodeText, { 
                    width: 300,
                    margin: 2
                }, function (error) {
                    if (error) {
                        console.error('Error generating QR code:', error);
                        qrCodeCanvas.innerHTML = '<p class="text-danger">Error generating QR code</p>';
                    } else {
                        console.log('✅ QR Code generated from text');
                    }
                });
            };
            script.onerror = function() {
                qrCodeCanvas.innerHTML = '<p class="text-warning">QR Code tersedia di terminal. Silakan scan dari terminal.</p>';
            };
            document.head.appendChild(script);
        }
        
        showAlert('📱 QR Code WhatsApp berhasil ditampilkan! Silakan scan dengan WhatsApp Anda.', 'success');
        
    } catch (error) {
        console.error('Error showing QR code from text:', error);
        showAlert('Error menampilkan QR code', 'danger');
    }
}

function showQRCodeInDashboard(qrCodeDataUrl) {
    console.log('🎨 Creating QR Code in Dashboard...');
    console.log('🔗 QR Code Data URL length:', qrCodeDataUrl ? qrCodeDataUrl.length : 'null');
    
    // Create or update QR code display in dashboard
    let qrCodeContainer = document.getElementById('dashboardQRCode');
    console.log('🔍 Existing QR container:', !!qrCodeContainer);
    
    if (!qrCodeContainer) {
        console.log('📦 Creating new QR Code container...');
        // Create QR code container if it doesn't exist
        const statusRow = document.querySelector('#whatsapp .row.mb-4');
        console.log('🔍 Status row found:', !!statusRow);
        console.log('🔍 Status row selector:', '#whatsapp .row.mb-4');
        console.log('🔍 All rows in whatsapp section:', document.querySelectorAll('#whatsapp .row').length);
        
        if (statusRow) {
            console.log('✅ Found status row, creating QR code column');
            const qrCodeCol = document.createElement('div');
            qrCodeCol.className = 'col-12 mb-4';
            qrCodeCol.innerHTML = `
                <div class="card border-warning">
                    <div class="card-header bg-warning text-white">
                        <h6 class="mb-0"><i class="fas fa-qrcode me-2"></i>QR Code WhatsApp</h6>
                    </div>
                    <div class="card-body text-center">
                        <div id="dashboardQRCode">
                            <img src="${qrCodeDataUrl}" alt="QR Code WhatsApp" class="img-fluid" style="max-width: 300px;">
                        </div>
                        <p class="mt-3 mb-2">📱 <strong>Scan QR Code ini dengan WhatsApp Anda:</strong></p>
                        <ol class="text-start" style="display: inline-block;">
                            <li>Buka WhatsApp di HP</li>
                            <li>Menu → WhatsApp Web</li>
                            <li>Scan QR Code di atas</li>
                        </ol>
                        <div class="mt-3">
                            <button class="btn btn-primary btn-sm" onclick="getWhatsAppQRCode()">
                                <i class="fas fa-sync-alt me-1"></i>Refresh QR Code
                            </button>
                            <button class="btn btn-success btn-sm ms-2" onclick="checkWhatsAppConnection()">
                                <i class="fas fa-check me-1"></i>Cek Koneksi
                            </button>
                        </div>
                    </div>
                </div>
            `;
            statusRow.appendChild(qrCodeCol);
            console.log('✅ QR Code column added to dashboard');
        } else {
            console.error('❌ Status row not found!');
        }
    } else {
        console.log('🔄 Updating existing QR code container');
        // Update existing QR code
        qrCodeContainer.innerHTML = `<img src="${qrCodeDataUrl}" alt="QR Code WhatsApp" class="img-fluid" style="max-width: 300px;">`;
    }
    
    // Show success message
    showAlert('📱 QR Code WhatsApp berhasil ditampilkan! Silakan scan dengan WhatsApp Anda.', 'success');
    console.log('✅ QR Code display completed');
}

function hideQRCodeFromDashboard() {
    const qrCodeContainer = document.querySelector('#whatsapp .col-12.mb-4:last-child');
    if (qrCodeContainer && qrCodeContainer.querySelector('#dashboardQRCode')) {
        qrCodeContainer.remove();
    }
}

// Check WhatsApp Connection Status
async function checkWhatsAppConnection() {
    try {
        showAlert('🔄 Mengecek status koneksi WhatsApp...', 'info');
        
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/status`);
        const result = await response.json();
        
        if (result.success) {
            if (result.status.isConnected) {
                showAlert('✅ WhatsApp sudah terhubung!', 'success');
                hideQRCodeFromDashboard();
            } else if (result.status.connectionStatus === 'qr_ready') {
                showAlert('🟡 QR Code tersedia. Silakan scan dengan WhatsApp Anda.', 'warning');
            } else {
                showAlert('🔴 WhatsApp belum terhubung. Silakan scan QR Code terlebih dahulu.', 'warning');
            }
        } else {
            showAlert('❌ Gagal mengecek status koneksi: ' + result.message, 'danger');
        }
    } catch (error) {
        console.error('Error checking WhatsApp connection:', error);
        showAlert('❌ Error mengecek koneksi WhatsApp', 'danger');
    }
}

// Auto-refresh QR code every 30 seconds when QR is ready
function startQRCodeAutoRefresh() {
    setInterval(async () => {
        try {
            const response = await authenticatedFetch(`${API_BASE}/whatsapp/status`);
            const result = await response.json();
            
            if (result.success && result.status.connectionStatus === 'qr_ready' && result.status.qrCodeDataUrl) {
                // Update QR code if still in QR ready state
                const qrCodeImg = document.querySelector('#dashboardQRCode img');
                if (qrCodeImg) {
                    qrCodeImg.src = result.status.qrCodeDataUrl;
                }
            } else if (result.success && result.status.isConnected) {
                // Hide QR code if connected
                hideQRCodeFromDashboard();
            }
        } catch (error) {
            console.error('Error auto-refreshing QR code:', error);
        }
    }, 30000); // 30 seconds
}

// Auto-refresh WhatsApp status every 5 seconds
function startWhatsAppStatusAutoRefresh() {
    setInterval(async () => {
        try {
            const response = await authenticatedFetch(`${API_BASE}/whatsapp/status`);
            const result = await response.json();
            
            if (result.success) {
                // Update status display
                updateWhatsAppStatus(result.status);
                
                // Hide QR code if connected
                if (result.status.isConnected) {
                    hideQRCodeFromDashboard();
                }
            }
        } catch (error) {
            console.error('Error auto-refreshing WhatsApp status:', error);
        }
    }, 5000); // 5 seconds
}

// Start auto-refresh for QR code (called automatically)
// Note: showWhatsAppGateway() is defined earlier in the file

async function loadWhatsAppOrders() {
    try {
        console.log('📋 Loading WhatsApp orders...');
        
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/orders`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('📊 WhatsApp orders response:', result);
            
            if (result.success) {
                updateWhatsAppOrdersTable(result.orders || []);
            } else {
                console.error('❌ Failed to load WhatsApp orders:', result.message);
                updateWhatsAppOrdersTable([]);
            }
        } else {
            console.error('❌ HTTP error loading WhatsApp orders:', response.status);
            updateWhatsAppOrdersTable([]);
        }
    } catch (error) {
        console.error('❌ Error loading WhatsApp orders:', error);
        updateWhatsAppOrdersTable([]);
    }
}

function updateWhatsAppOrdersTable(orders) {
    console.log('🔄 Updating WhatsApp orders table with:', orders);
    
    const tbody = document.getElementById('whatsappOrdersList');
    if (!tbody) {
        console.error('❌ WhatsApp orders table body not found');
        return;
    }
    
    if (!orders || orders.length === 0) {
        console.log('📭 No WhatsApp orders to display');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada order WhatsApp</td></tr>';
        return;
    }
    
    console.log(`📊 Displaying ${orders.length} WhatsApp orders`);
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.id || 'N/A'}</td>
            <td>${order.created_at ? formatDateTime(order.created_at) : 'N/A'}</td>
            <td>${order.agent_name || order.agent_username || 'N/A'}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.customer_phone || 'N/A'}</td>
            <td>${order.amount || 'N/A'}</td>
            <td>${order.amount ? formatCurrency(order.amount) : 'N/A'}</td>
            <td><span class="badge bg-success">Selesai</span></td>
        </tr>
    `).join('');
    
    console.log('✅ WhatsApp orders table updated successfully');
}

async function showWhatsAppHelp() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/help`);
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showWhatsAppHelpModal(result.helpMessage);
            }
        }
    } catch (error) {
        console.error('Error getting WhatsApp help:', error);
    }
}

function showWhatsAppHelpModal(helpMessage) {
    // Create modal for help message
    const modalHtml = `
        <div class="modal fade" id="whatsAppHelpModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fab fa-whatsapp me-2"></i>Bantuan WhatsApp Gateway</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <pre style="white-space: pre-wrap; font-family: inherit;">${helpMessage}</pre>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('whatsAppHelpModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('whatsAppHelpModal'));
    modal.show();
}

function showWhatsAppTest() {
    // Create modal for test message
    const modalHtml = `
        <div class="modal fade" id="whatsAppTestModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-vial me-2"></i>Test WhatsApp Message</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="whatsAppTestForm">
                            <div class="mb-3">
                                <label for="testPhoneNumber" class="form-label">Nomor Telepon *</label>
                                <input type="tel" class="form-control" id="testPhoneNumber" required placeholder="628xxxxxxxxxx">
                            </div>
                            <div class="mb-3">
                                <label for="testMessage" class="form-label">Pesan Test *</label>
                                <textarea class="form-control" id="testMessage" rows="3" required placeholder="Masukkan pesan test..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-primary" onclick="sendWhatsAppTest()">Kirim Test</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('whatsAppTestModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('whatsAppTestModal'));
    modal.show();
}

async function sendWhatsAppTest() {
    const phoneNumber = document.getElementById('testPhoneNumber').value;
    const message = document.getElementById('testMessage').value;
    
    if (!phoneNumber || !message) {
        showAlert('Nomor telepon dan pesan harus diisi', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await authenticatedFetch(`${API_BASE}/whatsapp/test-message`, {
            method: 'POST',
            body: JSON.stringify({
                phoneNumber,
                message
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showAlert('Pesan test berhasil dikirim', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('whatsAppTestModal'));
                modal.hide();
            } else {
                showAlert('Gagal mengirim pesan test: ' + result.message, 'danger');
            }
        } else {
            showAlert('Error mengirim pesan test', 'danger');
        }
    } catch (error) {
        console.error('Error sending test message:', error);
        showAlert('Error mengirim pesan test', 'danger');
    } finally {
        showLoading(false);
    }
}