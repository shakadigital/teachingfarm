-- ═══════════════════════════════════════════════════
-- ADD ACTIVITY LOG TABLE
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  user_input TEXT NOT NULL,
  aksi TEXT NOT NULL,       -- TAMBAH | EDIT | HAPUS
  tabel TEXT NOT NULL,      -- input_harian | penjualan | dst
  record_id TEXT,
  data_lama JSONB,
  data_baru JSONB,
  keterangan TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_tanggal ON activity_log(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_log_user ON activity_log(user_input);
CREATE INDEX IF NOT EXISTS idx_log_tabel ON activity_log(tabel);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true);

SELECT 'activity_log table created!' AS status;
