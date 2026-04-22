-- ═══════════════════════════════════════════════════
-- TEACHING FARM UB - DATABASE SETUP
-- ═══════════════════════════════════════════════════
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── STEP 1: RESET (hapus semua tabel lama) ─────────

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS kandang CASCADE;
DROP TABLE IF EXISTS input_harian CASCADE;
DROP TABLE IF EXISTS penjualan CASCADE;
DROP TABLE IF EXISTS daftar_pakan CASCADE;
DROP TABLE IF EXISTS kiriman_pakan CASCADE;
DROP TABLE IF EXISTS kas_operasional CASCADE;
DROP TABLE IF EXISTS hasil_penjualan CASCADE;
DROP TABLE IF EXISTS monitoring_bb CASCADE;
DROP TABLE IF EXISTS operasional CASCADE;
DROP TABLE IF EXISTS pelanggan CASCADE;
DROP TABLE IF EXISTS pullet_setup CASCADE;
DROP TABLE IF EXISTS recording CASCADE;
DROP TABLE IF EXISTS stock_audit CASCADE;
DROP TABLE IF EXISTS stock_pakan CASCADE;

-- ── STEP 2: CREATE TABLES ──────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'operator', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kandang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT UNIQUE NOT NULL,
  kapasitas INTEGER,
  status TEXT CHECK (status IN ('aktif', 'kosong', 'maintenance')),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE input_harian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  kandang TEXT NOT NULL,
  user_input TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tanggal, kandang)
);

CREATE TABLE penjualan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  kandang TEXT NOT NULL,
  produk TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  satuan TEXT NOT NULL,
  harga_satuan NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  pembeli TEXT,
  keterangan TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daftar_pakan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT UNIQUE NOT NULL,
  jenis TEXT,
  satuan TEXT DEFAULT 'kg',
  harga_satuan NUMERIC,
  stok_minimal NUMERIC DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kiriman_pakan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  nama_pakan TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  satuan TEXT DEFAULT 'kg',
  supplier TEXT,
  harga_per_kg NUMERIC DEFAULT 0,
  harga_total NUMERIC,
  status_bayar TEXT DEFAULT 'belum' CHECK (status_bayar IN ('belum', 'sebagian', 'lunas')),
  sisa_tagihan NUMERIC DEFAULT 0,
  keterangan TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pembayaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('pakan', 'pullet')),
  supplier TEXT NOT NULL,
  referensi_id UUID,
  jumlah_tagihan NUMERIC NOT NULL DEFAULT 0,
  jumlah_bayar NUMERIC NOT NULL,
  sisa_tagihan NUMERIC NOT NULL DEFAULT 0,
  metode TEXT NOT NULL CHECK (metode IN ('tunai', 'transfer', 'cek', 'giro')),
  no_referensi TEXT,
  keterangan TEXT,
  kandang TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kas_operasional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  kategori TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  keterangan TEXT,
  kandang TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  user_input TEXT NOT NULL,
  aksi TEXT NOT NULL,
  tabel TEXT NOT NULL,
  record_id TEXT,
  data_lama JSONB,
  data_baru JSONB,
  keterangan TEXT
);

-- ── STEP 3: INDEXES ────────────────────────────────

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_kandang_nama ON kandang(nama);
CREATE INDEX idx_input_tanggal ON input_harian(tanggal DESC);
CREATE INDEX idx_input_kandang ON input_harian(kandang);
CREATE INDEX idx_penjualan_tanggal ON penjualan(tanggal DESC);
CREATE INDEX idx_penjualan_kandang ON penjualan(kandang);
CREATE INDEX idx_pakan_nama ON daftar_pakan(nama);
CREATE INDEX idx_kiriman_tanggal ON kiriman_pakan(tanggal DESC);
CREATE INDEX idx_kas_tanggal ON kas_operasional(tanggal DESC);
CREATE INDEX idx_kas_kandang ON kas_operasional(kandang);
CREATE INDEX idx_bayar_tanggal ON pembayaran(tanggal DESC);
CREATE INDEX idx_bayar_jenis ON pembayaran(jenis);
CREATE INDEX idx_bayar_supplier ON pembayaran(supplier);
CREATE INDEX idx_log_tanggal ON activity_log(tanggal DESC);
CREATE INDEX idx_log_user ON activity_log(user_input);
CREATE INDEX idx_log_tabel ON activity_log(tabel);

-- ── STEP 4: RLS POLICIES ───────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kandang ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan ENABLE ROW LEVEL SECURITY;
ALTER TABLE daftar_pakan ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiriman_pakan ENABLE ROW LEVEL SECURITY;
ALTER TABLE kas_operasional ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on kandang" ON kandang FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on input_harian" ON input_harian FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on penjualan" ON penjualan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on daftar_pakan" ON daftar_pakan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on kiriman_pakan" ON kiriman_pakan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on kas_operasional" ON kas_operasional FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pembayaran" ON pembayaran FOR ALL USING (true) WITH CHECK (true);

-- ── STEP 5: SEED DATA ──────────────────────────────

INSERT INTO users (username, password, role, active)
VALUES ('admin', 'admin123', 'admin', true);

INSERT INTO users (username, password, role, active)
VALUES ('shakadigital', 'abrisam2554', 'superadmin', true);

INSERT INTO kandang (nama, kapasitas, status, keterangan)
VALUES 
  ('Kandang 1', 5000, 'aktif', 'Kandang utama'),
  ('Kandang 2', 3000, 'aktif', 'Kandang cadangan');

INSERT INTO daftar_pakan (nama, jenis, satuan, harga_satuan, stok_minimal)
VALUES 
  ('Pakan Starter', 'Konsentrat', 'kg', 8500, 500),
  ('Pakan Grower', 'Konsentrat', 'kg', 7500, 500),
  ('Pakan Layer', 'Konsentrat', 'kg', 7000, 1000);

-- ── DONE ───────────────────────────────────────────
-- Login: username=admin, password=admin123
