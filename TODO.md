# PWA Data Harian Peternakan Ayam Petelur (Tanpa DOC Sampling)

## Status: ✅ Lengkap & Clean!

**Fitur:**
- Input data harian ayam petelur: telur, kematian, pakan kg, suhu °C, kelembaban %, catatan.
- List riwayat dengan stats keseluruhan: HD % produktivitas, mortalitas kumulatif %, pakan/ekor/hari.
- Form validasi lengkap, draft, edit/hapus.
- PWA offline IndexedDB ('layer-farm-db').
- React TSX, responsive mobile.

**Demo:**
1. `npx serve .`
2. Buka http://localhost:3000
3. Tambah data → lihat list/stats.

**Files utama:**
- `src/pages/HomePage.tsx`: List & stats.
- `src/pages/FormDailyLayerPage.tsx`: Input form.
- `src/db/database.ts`: DB CRUD.
- `src/models/DailyLayer.ts`: Types.

Siap digunakan di peternakan!

