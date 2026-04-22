-- Tambah kolom yang belum ada di tabel kandang
ALTER TABLE kandang ADD COLUMN IF NOT EXISTS chickin DATE;
ALTER TABLE kandang ADD COLUMN IF NOT EXISTS umur_masuk INTEGER DEFAULT 0;
ALTER TABLE kandang ADD COLUMN IF NOT EXISTS populasi INTEGER DEFAULT 0;
ALTER TABLE kandang ADD COLUMN IF NOT EXISTS harga_pullet NUMERIC DEFAULT 0;

-- Tambah kolom harga_per_kg di kiriman_pakan
ALTER TABLE kiriman_pakan ADD COLUMN IF NOT EXISTS harga_per_kg NUMERIC DEFAULT 0;

-- Fix constraint status kandang
ALTER TABLE kandang DROP CONSTRAINT IF EXISTS kandang_status_check;
ALTER TABLE kandang ADD CONSTRAINT kandang_status_check 
  CHECK (status IN ('Aktif', 'Selesai', 'aktif', 'kosong', 'maintenance'));

-- Fix constraint role users (tambah manajer, supervisor, staff, viewer)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'admin', 'manajer', 'supervisor', 'operator', 'staff', 'viewer'));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Selesai!' AS status;
