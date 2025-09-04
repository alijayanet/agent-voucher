# Setup Mikrotik untuk Voucher WiFi

## 1. Enable API Service di Mikrotik

### Via Winbox/WebFig:
1. Buka **IP > Services**
2. Double-click pada **api**
3. Centang **Enabled**
4. Set **Port** = 8728
5. Klik **OK**

### Via Terminal:
```bash
/ip service
set api enabled=yes port=8728
```

## 2. Buat User untuk API (Opsional tapi Disarankan)

```bash
/user add name=apiuser password=apipass123 group=full
```

## 3. Setup Firewall (Jika Diperlukan)

Pastikan port 8728 dapat diakses dari komputer aplikasi:

```bash
/ip firewall filter
add chain=input dst-port=8728 protocol=tcp action=accept comment="API Access"
```

## 4. Konfigurasi Hotspot Profiles

Buat profil hotspot yang sesuai dengan voucher:

```bash
/ip hotspot user profile
add name="1-jam" rate-limit="2M/1M" session-timeout="1h" shared-users=1
add name="3-jam" rate-limit="2M/1M" session-timeout="3h" shared-users=1  
add name="1-hari" rate-limit="5M/2M" session-timeout="1d" shared-users=1
add name="1-minggu" rate-limit="5M/2M" session-timeout="7d" shared-users=1
add name="1-bulan" rate-limit="10M/5M" session-timeout="30d" shared-users=1
```

## 5. Test Koneksi dari Command Line

Test apakah API dapat diakses:

```bash
# Windows
telnet [IP_MIKROTIK] 8728

# Linux/Mac  
nc -zv [IP_MIKROTIK] 8728
```

## 6. Konfigurasi di Aplikasi

1. Buka aplikasi voucher WiFi
2. Login sebagai admin/agent
3. Pergi ke menu **Mikrotik**
4. Isi konfigurasi:
   - **IP Address**: IP LAN Mikrotik (contoh: 192.168.1.1)
   - **Username**: admin atau user API yang dibuat
   - **Password**: password user
   - **Port**: 8728 (default)
5. Klik **Test Koneksi**

## 7. Troubleshooting Koneksi Gagal

### Error "Connection Refused"
- Pastikan API service enabled
- Cek port 8728 tidak diblok firewall
- Pastikan IP address benar

### Error "Host Unreachable" 
- Cek koneksi network ke router
- Test ping ke IP router
- Pastikan router hidup dan IP benar

### Error "Authentication Failed"
- Username/password salah
- User tidak memiliki hak akses API
- Coba dengan user admin default

### Error "Timeout"
- Network lambat atau tidak stabil
- Router overload
- Firewall memblok koneksi

## 8. Tips Keamanan

1. **Gunakan User Khusus untuk API:**
   ```bash
   /user add name=voucherapi password=strong_password group=full
   ```

2. **Batasi Akses IP (Opsional):**
   ```bash
   /ip firewall filter
   add chain=input src-address=192.168.1.100 dst-port=8728 protocol=tcp action=accept
   add chain=input dst-port=8728 protocol=tcp action=drop
   ```

3. **Monitor Log API:**
   ```bash
   /log print where topics~"api"
   ```

## 9. Testing Mode (Tanpa Router Fisik)

Jika belum memiliki router Mikrotik:
1. Aplikasi tetap bisa digunakan untuk manajemen voucher
2. Data tersimpan di database
3. Fitur yang memerlukan koneksi Mikrotik akan menampilkan error yang informatif
4. Voucher dapat dibuat namun tidak akan otomatis masuk ke router

## 10. Mode Production

Setelah router dikonfigurasi:
1. Voucher otomatis dibuat di Mikrotik
2. User dapat login dengan voucher
3. Monitoring user aktif real-time
4. Sinkronisasi data voucher dengan router