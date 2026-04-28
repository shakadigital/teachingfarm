# TODO — Peternakan Ayam Petelur App

## ✅ Sudah Dikerjakan

### Fondasi Aplikasi
- [x] PWA mobile-first (manifest, service worker, installable)
- [x] Loading screen dengan animasi
- [x] Login screen dengan autentikasi username + password
- [x] Session management (sessionStorage)
- [x] Bottom navigation 7 menu (Home, Input, Riwayat, Laporan, Jual, Gudang, Atur)
- [x] Responsive layout mobile-first
- [x] Toast notification
- [x] **Supabase integration — data tersimpan di cloud, real-time multi-device**

### Manajemen User
- [x] Role: Admin, Manajer, Supervisor, Operator, Staff
- [x] Admin bisa tambah / edit / hapus user
- [x] Badge warna per role
- [x] Proteksi: tidak bisa hapus akun sendiri

### Informasi Kandang
- [x] Data kandang: Nama, Kapasitas, Tanggal Chick In, Umur saat Chick In, Populasi Masuk, Status
- [x] Deteksi periode produksi otomatis (hari ke-X berjalan)
- [x] Kalkulasi umur ayam harian otomatis
- [x] Status Aktif / Selesai
- [x] Period info bar di halaman Input Harian

### Input Harian
- [x] Deplesi (mati + afkir) dengan kalkulasi otomatis
- [x] Sisa ayam & % deplesi otomatis
- [x] Input pakan multi-baris (kode + jumlah)
- [x] Air minum (ml/ekor & rasio air:pakan otomatis)
- [x] Produksi telur per grade (Normal, Cream, Retak)
- [x] HDP (Hen Day Production) otomatis
- [x] Berat rata-rata per butir otomatis
- [x] Program kesehatan (Vitamin, Obat, Vaksin) dengan tag input
- [x] Catatan harian
- [x] Dropdown kandang dari data yang terdaftar
- [x] Simpan & Reset form

### Penjualan Telur
- [x] Stok telur kumulatif otomatis (produksi semua kandang - penjualan)
- [x] Stok per grade (Normal, Cream, Retak)
- [x] Validasi stok tidak boleh minus saat simpan
- [x] Form transaksi penjualan multi-baris
- [x] Grand total otomatis
- [x] Riwayat penjualan

### Gudang Pakan
- [x] Daftar pakan dengan minimum stok peringatan
- [x] Stok otomatis: kiriman masuk − pemakaian harian
- [x] Progress bar stok dengan indikator merah/hijau
- [x] Harga terakhir dari kiriman
- [x] Catat kiriman pakan (tanggal, jumlah, harga/kg, total, supplier)
- [x] Riwayat pemakaian otomatis dari input harian

### Home Dashboard
- [x] Jumlah kandang aktif
- [x] Total populasi
- [x] Produksi hari ini (butir)
- [x] Penjualan hari ini (Rp)
- [x] Aktivitas input terakhir
- [x] Status semua kandang

---

## 🔲 Belum Dikerjakan

### Prioritas Tinggi
- [x] **Riwayat Input Harian** — tabel semua data yang sudah diinput, bisa edit/hapus
- [x] **Laporan Rekap Mingguan/Bulanan** — produksi, deplesi, HDP per periode
- [x] **Laporan Laba Rugi** — pendapatan penjualan vs biaya pakan + biaya operasional per periode
- [x] **Export PDF / Excel** — export CSV (kompatibel Excel)

### Prioritas Menengah
- [x] **Grafik HDP harian** — line chart trend produksi per kandang (Chart.js)
- [x] **Grafik stok pakan** — bar chart stok vs minimum per jenis pakan
- [x] **FCR (Feed Conversion Ratio)** — kg pakan per kg telur, otomatis dari data, dengan rating Baik/Cukup/Buruk
- [x] **Ringkasan akhir siklus** — tombol 📋 di tiap kandang, rekap lengkap satu periode (produksi, deplesi, pakan, laba rugi)
- [x] **Notifikasi stok pakan rendah** — alert di Home saat stok ≤ minimum
- [x] **Alert HDP turun drastis** — peringatan di Home jika HDP drop ≥10% dari hari sebelumnya
- [x] **Alert belum input hari ini** — reminder kandang aktif yang belum ada data

### Prioritas Rendah
- [x] **Backup & Restore** — export semua data ke JSON, import kembali (via Supabase)
- [x] **Dark mode** — toggle di header, preferensi tersimpan di localStorage
- [x] **Multi-bahasa** — Indonesia / English, toggle di header

---

## 📌 Catatan

- Data saat ini tersimpan di `localStorage` browser (per perangkat)
- Untuk multi-user real-time perlu migrasi ke Firebase / Supabase
- Urutan pengerjaan yang disarankan:
  `Riwayat Input → Laporan Rekap → Grafik → FCR → Notifikasi → Export → Backend`
- te@chingfarM2022
- **Refactor app.js**: Pecah app.js menjadi modul-modul yang lebih kecil (misalnya dashboard.js, transaksi.js, gudang.js) di masa depan jika skala aplikasi / database semakin besar.
