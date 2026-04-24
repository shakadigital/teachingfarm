-- ═══════════════════════════════════════════════════
-- FIX: Tambah UNIQUE constraint pada nama di semua master table
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── master_vitamin ──
DELETE FROM master_vitamin
WHERE id NOT IN (
  SELECT DISTINCT ON (nama) id FROM master_vitamin ORDER BY nama, kode ASC
);
ALTER TABLE master_vitamin DROP CONSTRAINT IF EXISTS master_vitamin_nama_unique;
ALTER TABLE master_vitamin ADD CONSTRAINT master_vitamin_nama_unique UNIQUE (nama);

-- ── master_obat ──
DELETE FROM master_obat
WHERE id NOT IN (
  SELECT DISTINCT ON (nama) id FROM master_obat ORDER BY nama, kode ASC
);
ALTER TABLE master_obat DROP CONSTRAINT IF EXISTS master_obat_nama_unique;
ALTER TABLE master_obat ADD CONSTRAINT master_obat_nama_unique UNIQUE (nama);

-- ── master_vaksin ──
DELETE FROM master_vaksin
WHERE id NOT IN (
  SELECT DISTINCT ON (nama) id FROM master_vaksin ORDER BY nama, kode ASC
);
ALTER TABLE master_vaksin DROP CONSTRAINT IF EXISTS master_vaksin_nama_unique;
ALTER TABLE master_vaksin ADD CONSTRAINT master_vaksin_nama_unique UNIQUE (nama);

-- ── master_pelanggan ──
DELETE FROM master_pelanggan
WHERE id NOT IN (
  SELECT DISTINCT ON (nama) id FROM master_pelanggan ORDER BY nama, kode ASC
);
ALTER TABLE master_pelanggan DROP CONSTRAINT IF EXISTS master_pelanggan_nama_unique;
ALTER TABLE master_pelanggan ADD CONSTRAINT master_pelanggan_nama_unique UNIQUE (nama);

NOTIFY pgrst, 'reload schema';
SELECT 'Unique constraints berhasil ditambahkan!' AS status;
