// ═══════════════════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════════════════
const SUPA_URL = 'https://pdaxnavaldekfrrreviz.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkYXhuYXZhbGRla2ZycnJldml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzQ2MzAsImV4cCI6MjA5MTg1MDYzMH0.vK2ULcKr24hLJe1StfWQEiaZZliX48xbd_hDQMvBaFQ';

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
    const rows = await SB.select('users', `?username=eq.${encodeURIComponent(username)}&active=eq.true`);
    return (rows || []).find(u => u.password === password) || null;
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
}

async function dbGetInput(filters = {}) {
  try {
    let q = '?select=*&order=tanggal.desc';
    if (filters.tanggal) q += `&tanggal=eq.${filters.tanggal}`;
    if (filters.kandang) q += `&kandang=eq.${encodeURIComponent(filters.kandang)}`;
    if (filters.dari) q += `&tanggal=gte.${filters.dari}`;
    if (filters.sampai) q += `&tanggal=lte.${filters.sampai}`;
    const rows = await SB.select('input_harian', q);
    return rows || [];
  } catch { return []; }
}

async function dbDeleteInput(id) {
  await SB.delete('input_harian', `?id=eq.${id}`);
}

// ── PENJUALAN ──────────────────────────────────────
async function dbSavePenjualan(obj) {
  obj.id = crypto.randomUUID();
  await SB.insert('penjualan', obj);
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
