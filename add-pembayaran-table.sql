-- ═══════════════════════════════════════════════════
-- ADD TABEL PEMBAYARAN (Pakan & Pullet)
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Tambah kolom harga_per_kg di kiriman_pakan jika belum ada
ALTER TABLE kiriman_pakan ADD COLUMN IF NOT EXISTS harga_per_kg NUMERIC DEFAULT 0;

-- Tambah kolom status tagihan di kiriman_pakan
ALTER TABLE kiriman_pakan ADD COLUMN IF NOT EXISTS status_bayar TEXT DEFAULT 'belum' 
  CHECK (status_bayar IN ('belum', 'sebagian', 'lunas'));
ALTER TABLE kiriman_pakan ADD COLUMN IF NOT EXISTS sisa_tagihan NUMERIC DEFAULT 0;

-- Tabel pembayaran pakan & pullet
CREATE TABLE IF NOT EXISTS pembayaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('pakan', 'pullet')),
  supplier TEXT NOT NULL,
  referensi_id UUID,           -- id kiriman_pakan atau kandang (pullet)
  jumlah_tagihan NUMERIC NOT NULL DEFAULT 0,
  jumlah_bayar NUMERIC NOT NULL,
  sisa_tagihan NUMERIC NOT NULL DEFAULT 0,
  metode TEXT NOT NULL CHECK (metode IN ('tunai', 'transfer', 'cek', 'giro')),
  no_referensi TEXT,           -- no. transfer / no. cek
  keterangan TEXT,
  kandang TEXT,
  user_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bayar_tanggal ON pembayaran(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_bayar_jenis ON pembayaran(jenis);
CREATE INDEX IF NOT EXISTS idx_bayar_supplier ON pembayaran(supplier);
CREATE INDEX IF NOT EXISTS idx_bayar_ref ON pembayaran(referensi_id);

ALTER TABLE pembayaran ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pembayaran" ON pembayaran FOR ALL USING (true) WITH CHECK (true);

-- Update sisa_tagihan di kiriman_pakan yang sudah ada
UPDATE kiriman_pakan SET sisa_tagihan = COALESCE(harga_total, 0) WHERE sisa_tagihan = 0;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Tabel pembayaran berhasil dibuat!' AS status;
