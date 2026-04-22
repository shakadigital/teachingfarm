// ═══════════════════════════════════════════════════
//  LOCAL DB (IndexedDB)
// ═══════════════════════════════════════════════════

const LOCAL_DB_NAME = 'teaching_farm_ub';
const LOCAL_DB_VERSION = 1;

function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      const ensureStore = (name, opts) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, opts);
        }
      };

      ensureStore('users', { keyPath: 'id' });
      ensureStore('kandang', { keyPath: 'id' });

      if (!db.objectStoreNames.contains('input_harian')) {
        const s = db.createObjectStore('input_harian', { keyPath: 'id' });
        s.createIndex('tanggal', 'tanggal', { unique: false });
        s.createIndex('kandang', 'kandang', { unique: false });
        s.createIndex('tanggal_kandang', ['tanggal', 'kandang'], { unique: true });
      }

      ensureStore('penjualan', { keyPath: 'id' });
      ensureStore('daftar_pakan', { keyPath: 'id' });
      ensureStore('kiriman_pakan', { keyPath: 'id' });
      ensureStore('kas_operasional', { keyPath: 'id' });
      ensureStore('pembayaran', { keyPath: 'id' });
      ensureStore('activity_log', { keyPath: 'id' });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbTx(storeName, mode, fn) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let out;
    Promise.resolve()
      .then(() => fn(store))
      .then((v) => {
        out = v;
      })
      .catch(reject);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function _reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _getAll(storeName) {
  return _idbTx(storeName, 'readonly', (store) => _reqToPromise(store.getAll()));
}

async function _getByKey(storeName, key) {
  return _idbTx(storeName, 'readonly', (store) => _reqToPromise(store.get(key)));
}

async function _put(storeName, obj) {
  return _idbTx(storeName, 'readwrite', (store) => _reqToPromise(store.put(obj)));
}

async function _delete(storeName, key) {
  return _idbTx(storeName, 'readwrite', (store) => _reqToPromise(store.delete(key)));
}

async function _queryInputHarian(filters = {}) {
  const all = await _getAll('input_harian');
  const out = all.filter((r) => {
    if (!r) return false;
    if (filters.tanggal && r.tanggal !== filters.tanggal) return false;
    if (filters.kandang && r.kandang !== filters.kandang) return false;
    if (filters.dari && r.tanggal < filters.dari) return false;
    if (filters.sampai && r.tanggal > filters.sampai) return false;
    return true;
  });
  out.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  return out;
}

async function _queryTanggalRange(storeName, filters = {}) {
  const all = await _getAll(storeName);
  const out = all.filter((r) => {
    if (!r) return false;
    if (filters.dari && r.tanggal < filters.dari) return false;
    if (filters.sampai && r.tanggal > filters.sampai) return false;
    if (filters.kandang && r.kandang !== filters.kandang) return false;
    if (filters.jenis && r.jenis !== filters.jenis) return false;
    return true;
  });
  out.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  return out;
}

// ═══════════════════════════════════════════════════
//  CACHE LAYER (in-memory)
// ═══════════════════════════════════════════════════
const cache = {
  _data: {},
  get: k => cache._data[k] ?? null,
  set: (k, v) => { cache._data[k] = v; },
  del: k => { delete cache._data[k]; }
};

// ═══════════════════════════════════════════════════
//  DATA API — kompatibel dengan supabase.js
// ═══════════════════════════════════════════════════

async function dbGetUsers() {
  try {
    const rows = await _getAll('users');
    rows.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    cache.set('users', rows);
    return rows;
  } catch { return cache.get('users') || []; }
}

async function dbSaveUser(obj) {
  if (!obj.id) obj.id = crypto.randomUUID();
  await _put('users', obj);
  cache.del('users');
}

async function dbDeleteUser(id) {
  await _delete('users', id);
  cache.del('users');
}

async function dbFindUser(username, password) {
  try {
    const rows = await dbGetUsers();
    return (rows || []).find(u =>
      u.username === username &&
      u.password === password &&
      (u.active === true || u.active === 'true' || u.active === 1)
    ) || null;
  } catch { return null; }
}

async function dbGetKandang() {
  try {
    const rows = await _getAll('kandang');
    rows.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    cache.set('kandang_list', rows);
    return rows;
  } catch { return cache.get('kandang_list') || []; }
}

async function dbSaveKandang(obj) {
  if (!obj.id) obj.id = crypto.randomUUID();
  await _put('kandang', obj);
  cache.del('kandang_list');
}

async function dbDeleteKandang(id) {
  await _delete('kandang', id);
  cache.del('kandang_list');
}

async function dbSaveInput(tanggal, kandang, data) {
  const existing = await dbGetInput({ tanggal, kandang });
  if (existing && existing.length > 0) {
    const prev = existing[0];
    await _put('input_harian', {
      ...prev,
      tanggal,
      kandang,
      user_input: data.user,
      data,
      updated_at: new Date().toISOString()
    });
  } else {
    await _put('input_harian', {
      id: crypto.randomUUID(),
      tanggal,
      kandang,
      user_input: data.user,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  cache.del('input_harian');
  cache.del('_all_inputs');
}

async function dbGetInput(filters = {}) {
  try {
    const isAll = !filters.tanggal && !filters.kandang && !filters.dari && !filters.sampai;
    if (isAll && cache.get('_all_inputs')) return cache.get('_all_inputs');
    const rows = await _queryInputHarian(filters);
    if (isAll) cache.set('_all_inputs', rows || []);
    return rows || [];
  } catch { return []; }
}

async function dbDeleteInput(id) {
  await _delete('input_harian', id);
  cache.del('_all_inputs');
}

async function dbSavePenjualan(obj) {
  obj.id = crypto.randomUUID();
  obj.created_at = obj.created_at || new Date().toISOString();
  await _put('penjualan', obj);
  cache.del('penjualan_list');
}

async function dbDeletePenjualan(id) {
  await _delete('penjualan', id);
  cache.del('penjualan_list');
}

async function dbGetPenjualan(filters = {}) {
  try {
    const rows = await _queryTanggalRange('penjualan', filters);
    cache.set('penjualan_list', rows);
    return rows || [];
  } catch { return cache.get('penjualan_list') || []; }
}

async function dbGetDaftarPakan() {
  try {
    const rows = await _getAll('daftar_pakan');
    rows.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    cache.set('daftar_pakan', rows);
    return rows;
  } catch { return cache.get('daftar_pakan') || []; }
}

async function dbSaveDaftarPakan(obj) {
  if (!obj.id) obj.id = crypto.randomUUID();
  await _put('daftar_pakan', obj);
  cache.del('daftar_pakan');
}

async function dbDeleteDaftarPakan(id) {
  await _delete('daftar_pakan', id);
  cache.del('daftar_pakan');
}

async function dbGetKiriman(filters = {}) {
  try {
    const rows = await _queryTanggalRange('kiriman_pakan', filters);
    cache.set('kiriman_pakan', rows);
    return rows || [];
  } catch { return cache.get('kiriman_pakan') || []; }
}

async function dbSaveKiriman(obj) {
  obj.id = crypto.randomUUID();
  await _put('kiriman_pakan', obj);
  cache.del('kiriman_pakan');
}

async function dbDeleteKiriman(id) {
  await _delete('kiriman_pakan', id);
  cache.del('kiriman_pakan');
}

async function dbGetKas(filters = {}) {
  try {
    const rows = await _queryTanggalRange('kas_operasional', filters);
    cache.set('kas_list', rows);
    return rows || [];
  } catch { return cache.get('kas_list') || []; }
}

async function dbSaveKas(obj) {
  obj.id = crypto.randomUUID();
  await _put('kas_operasional', obj);
  cache.del('kas_list');
}

async function dbDeleteKas(id) {
  await _delete('kas_operasional', id);
  cache.del('kas_list');
}

async function dbGetSaldoKas(kandang) {
  const list = await dbGetKas(kandang ? { kandang } : {});
  const masuk  = list.filter(k => k.jenis === 'masuk') .reduce((s, k) => s + (parseFloat(k.jumlah) || 0), 0);
  const keluar = list.filter(k => k.jenis === 'keluar').reduce((s, k) => s + (parseFloat(k.jumlah) || 0), 0);
  return { masuk, keluar, saldo: masuk - keluar, list };
}

async function dbSaveLog(aksi, tabel, recordId, dataLama, dataBaru, keterangan = '') {
  try {
    await _put('activity_log', {
      id: crypto.randomUUID(),
      user_input: window.currentUser?.username || '—',
      aksi,
      tabel,
      record_id: recordId || null,
      data_lama: dataLama || null,
      data_baru: dataBaru || null,
      keterangan: keterangan || null,
      tanggal: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[activity_log] Gagal simpan log:', e);
  }
}

async function dbGetLog(filters = {}) {
  try {
    const rows = await _getAll('activity_log');
    const out = (rows || []).filter((r) => {
      if (!r) return false;
      if (filters.user && r.user_input !== filters.user) return false;
      if (filters.tabel && r.tabel !== filters.tabel) return false;
      const t = (r.tanggal || '').slice(0, 10);
      if (filters.dari && t < filters.dari) return false;
      if (filters.sampai && t > filters.sampai) return false;
      return true;
    });
    out.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    return out.slice(0, 200);
  } catch { return []; }
}

async function dbGetPembayaran(filters = {}) {
  try {
    const rows = await _queryTanggalRange('pembayaran', filters);
    cache.set('pembayaran_list', rows);
    return rows || [];
  } catch { return cache.get('pembayaran_list') || []; }
}

async function dbSavePembayaran(obj) {
  obj.id = crypto.randomUUID();
  await _put('pembayaran', obj);
  cache.del('pembayaran_list');
}

async function dbDeletePembayaran(id) {
  await _delete('pembayaran', id);
  cache.del('pembayaran_list');
}

async function dbUpdateStatusTagihan(kirimanId, jumlahBayar) {
  try {
    const k = await _getByKey('kiriman_pakan', kirimanId);
    if (!k) return;
    const totalTagihan = parseFloat(k.harga_total) || 0;
    const bayarList = (await _getAll('pembayaran')).filter(b => b.referensi_id === kirimanId);
    const totalBayar = (bayarList || []).reduce((s, b) => s + (parseFloat(b.jumlah_bayar) || 0), 0);
    const sisa = Math.max(0, totalTagihan - totalBayar);
    const status = sisa <= 0 ? 'lunas' : totalBayar > 0 ? 'sebagian' : 'belum';
    await _put('kiriman_pakan', { ...k, status_bayar: status, sisa_tagihan: sisa });
    cache.del('kiriman_pakan');
  } catch (e) { console.warn('updateStatusTagihan error:', e); }
}
