// ═══════════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════════
const SUPA_URL = 'https://rzzqbxusiipltswdfnbq.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6enFieHVzaWlwbHRzd2RmbmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDM4NDEsImV4cCI6MjA4NzQ3OTg0MX0.IPKo1CwZARk1bfaOeSK50BW8lC11pyVo9jJyjiY8LGg';

// ═══════════════════════════════════════════════════
//  HTTP HELPER
// ═══════════════════════════════════════════════════
async function supa(method, table, body = null, query = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
  };
  if (method === 'GET') headers['Accept'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Shorthand helpers
const SB = {
  select: (table, query = '') => supa('GET', table, null, query),
  insert: (table, body) => supa('POST', table, body),
  update: (table, body, query) => supa('PATCH', table, body, query),
  upsert: (table, body) => supa('POST', table, body, '?on_conflict=id'),
  delete: (table, query) => supa('DELETE', table, null, query),
};

// ═══════════════════════════════════════════════════
//  CACHE LAYER (untuk performa & offline fallback)
// ═══════════════════════════════════════════════════
const cache = {
  _data: {},
  get: k => cache._data[k] ?? null,
  set: (k, v) => { cache._data[k] = v; },
  del: k => { delete cache._data[k]; }
};

// ═══════════════════════════════════════════════════
//  DATA API — semua fungsi async
// ═══════════════════════════════════════════════════

// ── USERS ──────────────────────────────────────────
async function dbGetUsers() {
  try {
    const rows = await SB.select('users', '?select=*&order=created_at.asc');
    cache.set('users', rows);
    return rows;
  } catch { return cache.get('users') || []; }
}

async function dbSaveUser(obj) {
  if (obj.id) {
    await SB.update('users', obj, `?id=eq.${obj.id}`);
  } else {
    obj.id = crypto.randomUUID();
    await SB.insert('users', obj);
  }
  cache.del('users');
}

async function dbDeleteUser(id) {
  await SB.delete('users', `?id=eq.${id}`);
  cache.del('users');
}

async function dbFindUser(username, password) {
  try {
    // Fetch by username only, then filter active + password in JS
    // (avoids issues with boolean vs text 'active' column type)
    const rows = await SB.select('users', `?select=*&username=eq.${encodeURIComponent(username)}`);
    return (rows || []).find(u =>
      u.password === password &&
      (u.active === true || u.active === 'true' || u.active === 1)
    ) || null;
  } catch { return null; }
}

// ── KANDANG ────────────────────────────────────────
async function dbGetKandang() {
  try {
    const rows = await SB.select('kandang', '?select=*&order=created_at.asc');
    cache.set('kandang_list', rows);
    return rows;
  } catch { return cache.get('kandang_list') || []; }
}

async function dbSaveKandang(obj) {
  if (obj.id) {
    await SB.update('kandang', obj, `?id=eq.${obj.id}`);
  } else {
    obj.id = crypto.randomUUID();
    await SB.insert('kandang', obj);
  }
  cache.del('kandang_list');
}

async function dbDeleteKandang(id) {
  await SB.delete('kandang', `?id=eq.${id}`);
  cache.del('kandang_list');
}

// ── INPUT HARIAN ───────────────────────────────────
async function dbSaveInput(tanggal, kandang, data) {
  // Upsert berdasarkan tanggal + kandang
  const existing = await SB.select('input_harian', `?tanggal=eq.${tanggal}&kandang=eq.${encodeURIComponent(kandang)}`);
  if (existing && existing.length > 0) {
    await SB.update('input_harian', { data, user_input: data.user }, `?tanggal=eq.${tanggal}&kandang=eq.${encodeURIComponent(kandang)}`);
  } else {
    await SB.insert('input_harian', {
      id: crypto.randomUUID(),
      tanggal,
      kandang,
      user_input: data.user,
      data
    });
  }
  cache.del('input_harian');
  cache.del('_all_inputs');
}

async function dbGetInput(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.tanggal) q += `&tanggal=eq.${filters.tanggal}`;
    if (filters.kandang) q += `&kandang=eq.${encodeURIComponent(filters.kandang)}`;
    if (filters.dari) q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai) q += `&tanggal=lte.${filters.sampai}`;
    // Gunakan cache untuk query tanpa filter (all data)
    const isAll = !filters.tanggal && !filters.kandang && !filters.dari && !filters.sampai;
    if (isAll && cache.get('_all_inputs')) return cache.get('_all_inputs');
    const rows = await SB.select('input_harian', q);
    if (isAll) cache.set('_all_inputs', rows || []);
    return rows || [];
  } catch { return []; }
}

async function dbDeleteInput(id) {
  await SB.delete('input_harian', `?id=eq.${id}`);
  cache.del('_all_inputs');
}

// ── PENJUALAN ──────────────────────────────────────
async function dbSavePenjualan(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('penjualan', obj);
  cache.del('penjualan_list');
}

async function dbDeletePenjualan(id) {
  await SB.delete('penjualan', `?id=eq.${id}`);
  cache.del('penjualan_list');
}

async function dbGetPenjualan(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.dari) q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai) q += `&tanggal=lte.${filters.sampai}`;
    const rows = await SB.select('penjualan', q);
    cache.set('penjualan_list', rows);
    return rows || [];
  } catch { return cache.get('penjualan_list') || []; }
}

// ── DAFTAR PAKAN ───────────────────────────────────
async function dbGetDaftarPakan() {
  try {
    const rows = await SB.select('daftar_pakan', '?select=*&order=nama.asc');
    cache.set('daftar_pakan', rows);
    return rows;
  } catch { return cache.get('daftar_pakan') || []; }
}

async function dbSaveDaftarPakan(obj) {
  if (obj.id) {
    await SB.update('daftar_pakan', obj, `?id=eq.${obj.id}`);
  } else {
    obj.id = crypto.randomUUID();
    await SB.insert('daftar_pakan', obj);
  }
  cache.del('daftar_pakan');
}

async function dbDeleteDaftarPakan(id) {
  await SB.delete('daftar_pakan', `?id=eq.${id}`);
  cache.del('daftar_pakan');
}

// ── KIRIMAN PAKAN ──────────────────────────────────
async function dbGetKiriman(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.dari) q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai) q += `&tanggal=lte.${filters.sampai}`;
    const rows = await SB.select('kiriman_pakan', q);
    cache.set('kiriman_pakan', rows);
    return rows || [];
  } catch { return cache.get('kiriman_pakan') || []; }
}

async function dbSaveKiriman(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('kiriman_pakan', obj);
  cache.del('kiriman_pakan');
}

async function dbDeleteKiriman(id) {
  await SB.delete('kiriman_pakan', `?id=eq.${id}`);
  cache.del('kiriman_pakan');
}

// ── KAS OPERASIONAL ────────────────────────────────
async function dbGetKas(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc,created_at.desc';
    if (filters.dari)   q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai) q += `&tanggal=lte.${filters.sampai}`;
    if (filters.kandang) q += `&kandang=eq.${encodeURIComponent(filters.kandang)}`;
    const rows = await SB.select('kas_operasional', q);
    cache.set('kas_list', rows);
    return rows || [];
  } catch { return cache.get('kas_list') || []; }
}

async function dbSaveKas(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('kas_operasional', obj);
  cache.del('kas_list');
}

async function dbDeleteKas(id) {
  await SB.delete('kas_operasional', `?id=eq.${id}`);
  cache.del('kas_list');
}

// Hitung saldo kas: total masuk - total keluar
async function dbGetSaldoKas(kandang) {
  const list = await dbGetKas(kandang ? { kandang } : {});
  const masuk  = list.filter(k => k.jenis === 'masuk') .reduce((s, k) => s + (parseFloat(k.jumlah) || 0), 0);
  const keluar = list.filter(k => k.jenis === 'keluar').reduce((s, k) => s + (parseFloat(k.jumlah) || 0), 0);
  return { masuk, keluar, saldo: masuk - keluar, list };
}

// ── ACTIVITY LOG ───────────────────────────────────
async function dbSaveLog(aksi, tabel, recordId, dataLama, dataBaru, keterangan = '') {
  try {
    await SB.insert('activity_log', {
      id: crypto.randomUUID(),
      user_input: window.currentUser?.username || '—',
      aksi,       // 'EDIT' | 'HAPUS' | 'TAMBAH'
      tabel,      // 'input_harian' | 'penjualan' | dst
      record_id: recordId || null,
      data_lama: dataLama || null,
      data_baru: dataBaru || null,
      keterangan: keterangan || null
    });
  } catch (e) {
    console.warn('[activity_log] Gagal simpan log:', e);
  }
}

async function dbGetLog(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc&limit=200';
    if (filters.user)  q += `&user_input=eq.${encodeURIComponent(filters.user)}`;
    if (filters.tabel) q += `&tabel=eq.${encodeURIComponent(filters.tabel)}`;
    if (filters.dari)  q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai)q += `&tanggal=lte.${filters.sampai}`;
    return await SB.select('activity_log', q) || [];
  } catch { return []; }
}

// ── PEMBAYARAN ─────────────────────────────────────
async function dbGetPembayaran(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.dari)    q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai)  q += `&tanggal=lte.${filters.sampai}`;
    if (filters.jenis)   q += `&jenis=eq.${filters.jenis}`;
    if (filters.kandang) q += `&kandang=eq.${encodeURIComponent(filters.kandang)}`;
    const rows = await SB.select('pembayaran', q);
    cache.set('pembayaran_list', rows);
    return rows || [];
  } catch { return cache.get('pembayaran_list') || []; }
}

async function dbSavePembayaran(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('pembayaran', obj);
  cache.del('pembayaran_list');
}

async function dbDeletePembayaran(id) {
  await SB.delete('pembayaran', `?id=eq.${id}`);
  cache.del('pembayaran_list');
}

// Update status_bayar & sisa_tagihan di kiriman_pakan setelah pembayaran
async function dbUpdateStatusTagihan(kirimanId, jumlahBayar) {
  try {
    const rows = await SB.select('kiriman_pakan', `?id=eq.${kirimanId}`);
    if (!rows || !rows.length) return;
    const k = rows[0];
    const totalTagihan = parseFloat(k.harga_total) || 0;
    // Hitung total yang sudah dibayar sebelumnya
    const bayarList = await SB.select('pembayaran', `?referensi_id=eq.${kirimanId}`);
    const totalBayar = (bayarList || []).reduce((s, b) => s + (parseFloat(b.jumlah_bayar) || 0), 0);
    const sisa = Math.max(0, totalTagihan - totalBayar);
    const status = sisa <= 0 ? 'lunas' : totalBayar > 0 ? 'sebagian' : 'belum';
    await SB.update('kiriman_pakan', { status_bayar: status, sisa_tagihan: sisa }, `?id=eq.${kirimanId}`);
    cache.del('kiriman_pakan');
  } catch (e) { console.warn('updateStatusTagihan error:', e); }
}

// ── MASTER TABLES ──────────────────────────────────

// Helper generic untuk master tables
async function dbGetMaster(table, filters = {}) {
  try {
    // Hanya tampilkan yang aktif di UI, tapi semua kode tetap dihitung untuk generate
    let q = '?select=*&active=eq.true&order=kode.asc';
    if (filters.kategori) q += `&kategori=eq.${encodeURIComponent(filters.kategori)}`;
    const rows = await SB.select(table, q);
    cache.set(table, rows);
    return rows || [];
  } catch { return cache.get(table) || []; }
}

async function dbSaveMaster(table, obj) {
  if (obj.id) {
    obj.updated_at = new Date().toISOString();
    await SB.update(table, obj, `?id=eq.${obj.id}`);
  } else {
    obj.id = crypto.randomUUID();
    obj.created_at = new Date().toISOString();
    await SB.insert(table, obj);
  }
  cache.del(table);
}

async function dbDeleteMaster(table, id) {
  // Soft delete — set active = false
  await SB.update(table, { active: false, updated_at: new Date().toISOString() }, `?id=eq.${id}`);
  cache.del(table);
}

// Auto-generate kode berdasarkan prefix dan data existing
async function dbGenerateKode(table, prefix) {
  try {
    // Gunakan ilike dengan % (bukan *) untuk Supabase REST API
    // Ambil SEMUA kode dengan prefix ini (termasuk nonaktif) untuk hindari duplikat
    const rows = await SB.select(table, `?select=kode&kode=ilike.${prefix}-%25&order=kode.desc&limit=1`);
    if (!rows || !rows.length) return `${prefix}-001`;
    const lastKode = rows[0].kode;
    const lastNum = parseInt(lastKode.replace(prefix + '-', '')) || 0;
    return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
  } catch {
    // Fallback: timestamp-based untuk hindari collision
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
}

// Specific getters
const dbGetSupplier  = (f) => dbGetMaster('master_supplier', f);
const dbGetVitamin   = (f) => dbGetMaster('master_vitamin', f);
const dbGetObat      = (f) => dbGetMaster('master_obat', f);
const dbGetVaksin    = (f) => dbGetMaster('master_vaksin', f);
const dbGetPelanggan = (f) => dbGetMaster('master_pelanggan', f);

// Get all master data sekaligus (untuk dropdown)
async function dbGetAllMaster() {
  const [supplier, vitamin, obat, vaksin, pelanggan, pakan] = await Promise.all([
    dbGetSupplier(),
    dbGetVitamin(),
    dbGetObat(),
    dbGetVaksin(),
    dbGetPelanggan(),
    dbGetDaftarPakan()
  ]);
  return { supplier, vitamin, obat, vaksin, pelanggan, pakan };
}

// ── STOK NON-PAKAN (Vitamin, Obat, Vaksin, Desinfektan, Lainnya) ──

async function dbGetKirimanNonPakan(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.kategori) q += `&kategori=eq.${encodeURIComponent(filters.kategori)}`;
    if (filters.dari)     q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai)   q += `&tanggal=lte.${filters.sampai}`;
    const rows = await SB.select('kiriman_nonpakan', q);
    cache.set('kiriman_np_' + (filters.kategori || 'all'), rows);
    return rows || [];
  } catch { return cache.get('kiriman_np_' + (filters.kategori || 'all')) || []; }
}

async function dbSaveKirimanNonPakan(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('kiriman_nonpakan', obj);
  cache.del('kiriman_np_' + obj.kategori);
  cache.del('kiriman_np_all');
}

async function dbDeleteKirimanNonPakan(id, kategori) {
  await SB.delete('kiriman_nonpakan', `?id=eq.${id}`);
  cache.del('kiriman_np_' + (kategori || 'all'));
  cache.del('kiriman_np_all');
}

async function dbGetPemakaianNonPakan(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.kategori) q += `&kategori=eq.${encodeURIComponent(filters.kategori)}`;
    if (filters.dari)     q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai)   q += `&tanggal=lte.${filters.sampai}`;
    const rows = await SB.select('pemakaian_nonpakan', q);
    return rows || [];
  } catch { return []; }
}

async function dbSavePemakaianNonPakan(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('pemakaian_nonpakan', obj);
}

async function dbDeletePemakaianNonPakan(id) {
  await SB.delete('pemakaian_nonpakan', `?id=eq.${id}`);
}

// Hitung stok non-pakan: total kiriman - total pemakaian
async function dbGetStokNonPakan(kategori) {
  const [kiriman, pakai] = await Promise.all([
    dbGetKirimanNonPakan({ kategori }),
    dbGetPemakaianNonPakan({ kategori })
  ]);
  // Group by nama_item
  const stokMap = {};
  kiriman.forEach(k => {
    if (!stokMap[k.nama_item]) stokMap[k.nama_item] = { masuk: 0, keluar: 0, satuan: k.satuan, harga: 0 };
    stokMap[k.nama_item].masuk += parseFloat(k.jumlah) || 0;
    stokMap[k.nama_item].harga = parseFloat(k.harga_satuan) || stokMap[k.nama_item].harga;
  });
  pakai.forEach(p => {
    if (!stokMap[p.nama_item]) stokMap[p.nama_item] = { masuk: 0, keluar: 0, satuan: p.satuan, harga: 0 };
    stokMap[p.nama_item].keluar += parseFloat(p.jumlah) || 0;
  });
  return Object.entries(stokMap).map(([nama, v]) => ({
    nama,
    stok: Math.max(0, v.masuk - v.keluar),
    satuan: v.satuan,
    harga: v.harga
  }));
}

// ── STANDAR PERFORMA ───────────────────────────────
// Disimpan sebagai satu record JSON di tabel app_config
async function dbGetStandar() {
  try {
    const rows = await SB.select('app_config', `?key=eq.standar_performa&select=value`);
    if(rows && rows.length && rows[0].value) return rows[0].value;
    return null;
  } catch {
    // Fallback ke localStorage
    try { return JSON.parse(localStorage.getItem('standar_performa')); } catch { return null; }
  }
}

async function dbSaveStandar(data) {
  try {
    const existing = await SB.select('app_config', `?key=eq.standar_performa`);
    if(existing && existing.length) {
      await SB.update('app_config', { value: data, updated_at: new Date().toISOString() }, `?key=eq.standar_performa`);
    } else {
      await SB.insert('app_config', { id: crypto.randomUUID(), key: 'standar_performa', value: data, created_at: new Date().toISOString() });
    }
    cache.del('standar_performa');
  } catch(e) {
    // Fallback: simpan ke localStorage jika Supabase gagal
    localStorage.setItem('standar_performa', JSON.stringify(data));
    console.warn('dbSaveStandar fallback to localStorage:', e.message);
    throw e; // re-throw agar UI tahu ada error
  }
}
