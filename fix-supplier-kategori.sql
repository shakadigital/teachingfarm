-- ═══════════════════════════════════════════════════
-- FIX: Hapus kolom kategori dari master_supplier
-- Supplier bisa supply semua kategori tanpa duplikat
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Hapus constraint kategori
ALTER TABLE master_supplier DROP CONSTRAINT IF EXISTS master_supplier_kategori_check;

-- 2. Hapus kolom kategori (tidak diperlukan lagi)
ALTER TABLE master_supplier DROP COLUMN IF EXISTS kategori;

-- 3. Hapus data duplikat — simpan hanya 1 record per nama supplier
-- (simpan yang kode-nya paling kecil/pertama)
DELETE FROM master_supplier
WHERE id NOT IN (
  SELECT DISTINCT ON (nama) id
  FROM master_supplier
  ORDER BY nama, kode ASC
);

-- 4. Pastikan nama supplier unique
ALTER TABLE master_supplier ADD CONSTRAINT master_supplier_nama_unique UNIQUE (nama);

-- 5. Tambah index nama
CREATE INDEX IF NOT EXISTS idx_supplier_nama_unique ON master_supplier(nama);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT nama, kode FROM master_supplier ORDER BY kode;
