-- ═══════════════════════════════════════════════════
-- MASTER TABLES - Teaching Farm UB
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── 1. MASTER PAKAN ────────────────────────────────
-- Sudah ada sebagai daftar_pakan, tambah kolom kode & supplier
ALTER TABLE daftar_pakan ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE daftar_pakan ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE daftar_pakan ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Generate kode otomatis untuk data lama
UPDATE daftar_pakan SET kode = 'PKN-' || UPPER(SUBSTRING(id::TEXT, 1, 6)) WHERE kode IS NULL;

-- ── 2. MASTER SUPPLIER ─────────────────────────────
CREATE TABLE IF NOT EXISTS master_supplier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('pakan', 'vitamin', 'obat', 'vaksin', 'umum')),
  telepon TEXT,
  alamat TEXT,
  keterangan TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_kode ON master_supplier(kode);
CREATE INDEX IF NOT EXISTS idx_supplier_kategori ON master_supplier(kategori);
CREATE INDEX IF NOT EXISTS idx_supplier_nama ON master_supplier(nama);

-- ── 3. MASTER VITAMIN ──────────────────────────────
CREATE TABLE IF NOT EXISTS master_vitamin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  supplier_id UUID REFERENCES master_supplier(id) ON DELETE SET NULL,
  satuan TEXT DEFAULT 'botol',
  harga_satuan NUMERIC DEFAULT 0,
  keterangan TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vitamin_kode ON master_vitamin(kode);
CREATE INDEX IF NOT EXISTS idx_vitamin_nama ON master_vitamin(nama);

-- ── 4. MASTER OBAT ─────────────────────────────────
CREATE TABLE IF NOT EXISTS master_obat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  supplier_id UUID REFERENCES master_supplier(id) ON DELETE SET NULL,
  satuan TEXT DEFAULT 'botol',
  harga_satuan NUMERIC DEFAULT 0,
  keterangan TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obat_kode ON master_obat(kode);
CREATE INDEX IF NOT EXISTS idx_obat_nama ON master_obat(nama);

-- ── 5. MASTER VAKSIN ───────────────────────────────
CREATE TABLE IF NOT EXISTS master_vaksin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  supplier_id UUID REFERENCES master_supplier(id) ON DELETE SET NULL,
  satuan TEXT DEFAULT 'dosis',
  harga_satuan NUMERIC DEFAULT 0,
  keterangan TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaksin_kode ON master_vaksin(kode);
CREATE INDEX IF NOT EXISTS idx_vaksin_nama ON master_vaksin(nama);

-- ── 6. MASTER PELANGGAN ────────────────────────────
CREATE TABLE IF NOT EXISTS master_pelanggan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  telepon TEXT,
  alamat TEXT,
  tipe TEXT DEFAULT 'retail' CHECK (tipe IN ('retail', 'grosir', 'distributor')),
  harga_khusus NUMERIC DEFAULT 0,
  keterangan TEXT,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pelanggan_kode ON master_pelanggan(kode);
CREATE INDEX IF NOT EXISTS idx_pelanggan_nama ON master_pelanggan(nama);

-- ── RLS POLICIES ───────────────────────────────────
ALTER TABLE master_supplier  ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_vitamin   ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_obat      ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_vaksin    ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_pelanggan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on master_supplier"  ON master_supplier  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on master_vitamin"   ON master_vitamin   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on master_obat"      ON master_obat      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on master_vaksin"    ON master_vaksin    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on master_pelanggan" ON master_pelanggan FOR ALL USING (true) WITH CHECK (true);

-- ── SEED DATA ──────────────────────────────────────
INSERT INTO master_supplier (kode, nama, kategori, keterangan) VALUES
  ('SUP-001', 'PT Charoen Pokphand', 'pakan', 'Supplier pakan utama'),
  ('SUP-002', 'PT Medion', 'vaksin', 'Supplier vaksin & obat'),
  ('SUP-003', 'PT Mensana', 'obat', 'Supplier obat ternak'),
  ('SUP-004', 'CV Agro Makmur', 'vitamin', 'Supplier vitamin ternak'),
  ('SUP-005', 'Toko Pakan Sejahtera', 'umum', 'Supplier lokal')
ON CONFLICT (kode) DO NOTHING;

INSERT INTO master_vitamin (kode, nama, satuan, keterangan) VALUES
  ('VIT-001', 'Vitachick', 'sachet', 'Vitamin untuk DOC'),
  ('VIT-002', 'Fortevit', 'botol', 'Vitamin multivitamin layer'),
  ('VIT-003', 'Vita Stress', 'sachet', 'Vitamin anti stress'),
  ('VIT-004', 'Elektrolit Plus', 'sachet', 'Elektrolit untuk ayam')
ON CONFLICT (kode) DO NOTHING;

INSERT INTO master_obat (kode, nama, satuan, keterangan) VALUES
  ('OBT-001', 'Amoxilin', 'botol', 'Antibiotik broad spectrum'),
  ('OBT-002', 'Colistin', 'sachet', 'Antibiotik untuk CRD'),
  ('OBT-003', 'Enrofloxacin', 'botol', 'Antibiotik fluoroquinolon'),
  ('OBT-004', 'Desinfektan Kandang', 'liter', 'Untuk sanitasi kandang')
ON CONFLICT (kode) DO NOTHING;

INSERT INTO master_vaksin (kode, nama, satuan, keterangan) VALUES
  ('VAK-001', 'ND Lasota', 'dosis', 'Vaksin Newcastle Disease'),
  ('VAK-002', 'IB H120', 'dosis', 'Vaksin Infectious Bronchitis'),
  ('VAK-003', 'AI H5N1', 'dosis', 'Vaksin Avian Influenza'),
  ('VAK-004', 'Gumboro', 'dosis', 'Vaksin Gumboro/IBD')
ON CONFLICT (kode) DO NOTHING;

INSERT INTO master_pelanggan (kode, nama, tipe, keterangan) VALUES
  ('PLG-001', 'Pasar Tradisional', 'retail', 'Pelanggan pasar umum'),
  ('PLG-002', 'Toko Sembako Maju', 'grosir', 'Pelanggan grosir tetap'),
  ('PLG-003', 'Distributor Jaya', 'distributor', 'Distributor telur wilayah')
ON CONFLICT (kode) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Master tables berhasil dibuat!' AS status;
