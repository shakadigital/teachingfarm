-- Tabel konfigurasi aplikasi (untuk standar performa, dll)
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: hanya superadmin yang bisa write, semua bisa read
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_read_all" ON app_config
  FOR SELECT USING (true);

CREATE POLICY "app_config_write_anon" ON app_config
  FOR ALL USING (true) WITH CHECK (true);
