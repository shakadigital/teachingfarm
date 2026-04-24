-- ═══════════════════════════════════════════════════
-- STOK NON-PAKAN: Vitamin, Obat, Vaksin, Desinfektan, Lainnya
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── Tabel kiriman/stok non-pakan ──────────────────
CREATE TABLE IF NOT EXISTS kiriman_nonpakan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('vitamin','obat','vaksin','desinfektan','lainnya')),
  nama_item TEXT NOT NULL,          -- nama produk
  jumlah NUMERIC NOT NULL,
  satuan TEXT DEFAULT 'botol',
  supplier TEXT,
  harga_satuan NUMERIC DEFAULT 0,
  harga_total NUMERIC DEFAULT 0,
  keterangan TEXT,
  kandang TEXT,                     -- opsional, untuk kandang tertentu
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabel pemakaian non-pakan (input manual) ──────
CREATE TABLE IF NOT EXISTS pemakaian_nonpakan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('vitamin','obat','vaksin','desinfektan','lainnya')),
  nama_item TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  satuan TEXT DEFAULT 'botol',
  kandang TEXT,
  keterangan TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kiriman_np_tanggal  ON kiriman_nonpakan(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_kiriman_np_kategori ON kiriman_nonpakan(kategori);
CREATE INDEX IF NOT EXISTS idx_kiriman_np_nama     ON kiriman_nonpakan(nama_item);
CREATE INDEX IF NOT EXISTS idx_pakai_np_tanggal    ON pemakaian_nonpakan(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_pakai_np_kategori   ON pemakaian_nonpakan(kategori);

-- ── RLS ───────────────────────────────────────────
ALTER TABLE kiriman_nonpakan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pemakaian_nonpakan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on kiriman_nonpakan"   ON kiriman_nonpakan   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pemakaian_nonpakan" ON pemakaian_nonpakan FOR ALL USING (true) WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Tabel stok non-pakan berhasil dibuat!' AS status;
