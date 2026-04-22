# Tabel Hak Akses — Teaching Farm UB

## Role yang Tersedia

| Role | Level | Keterangan |
|------|:-----:|------------|
| ⭐ Superadmin | 6 | Akses penuh, tidak bisa dihapus oleh siapapun |
| Admin | 5 | Akses hampir penuh, bisa kelola user |
| Manajer | 4 | Akses operasional & keuangan |
| Supervisor | 3 | Akses operasional, terbatas keuangan |
| Operator | 2 | Input data harian saja |
| Staff | 1 | Hanya lihat data |
| Viewer | 0 | Read-only, tidak bisa input apapun |

---

## Hak Akses per Fitur

### 🏠 Dashboard & Navigasi

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat Statistik Penjualan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat Saldo Kas | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Menu Penjualan (nav) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

### 📋 Input Harian

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Input data harian | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Input biaya operasional | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Overwrite data orang lain | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ |
| Hapus input harian sendiri | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Hapus input harian orang lain | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ |

> *Supervisor hanya bisa overwrite/hapus data milik Operator & Staff, tidak bisa overwrite data Admin/Manajer

---

### 🛒 Penjualan

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat data penjualan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Tambah transaksi penjualan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hapus transaksi penjualan | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export laporan penjualan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

### 🌾 Gudang & Pakan

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat stok pakan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tambah/Edit daftar pakan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hapus daftar pakan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tambah kiriman pakan (tagihan) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit kiriman pakan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hapus kiriman pakan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Catat pembayaran pakan/pullet | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hapus pembayaran | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

### 💰 Kas Operasional

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat saldo & riwayat kas | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Alokasi kas masuk | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Catat pengeluaran kas | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hapus transaksi kas | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

### 🏠 Kandang

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat daftar kandang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tambah/Edit kandang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hapus kandang | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

### 📊 Laporan

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat laporan umum | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lihat tab Laba/Rugi | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lihat tab Penjualan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Export laporan | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

---

### ⚙️ Pengaturan & User Management

| Fitur | Superadmin | Admin | Manajer | Supervisor | Operator | Staff |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Lihat daftar user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tambah user baru | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit user lain | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit akun sendiri | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hapus user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hapus/Edit Superadmin | ❌* | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign role Superadmin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> *Superadmin hanya bisa edit akunnya sendiri, tidak bisa dihapus oleh siapapun termasuk Superadmin lain

---

## Ringkasan Level Akses

```
Superadmin (6) > Admin (5) > Manajer (4) > Supervisor (3) > Operator (2) > Staff (1) > Viewer (0)
```

- **Superadmin** — bypass semua permission check, akses penuh tanpa pengecualian
- **Admin** — kelola user & semua data, kecuali tidak bisa hapus/edit Superadmin
- **Manajer** — akses keuangan penuh + operasional
- **Supervisor** — operasional + pengeluaran kas, terbatas di keuangan
- **Operator** — hanya input data harian
- **Staff** — read-only, tidak bisa input
- **Viewer** — read-only, tidak bisa input apapun (sama seperti Staff tapi level lebih rendah)
