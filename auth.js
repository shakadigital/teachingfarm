// ═══ ROLE PERMISSIONS ═══
const ROLES = {
  KEUANGAN:  ['superadmin', 'admin', 'manajer'],
  EXPORT_LAP:['superadmin', 'admin', 'manajer', 'supervisor'],
  JUAL:      ['superadmin', 'admin', 'manajer', 'supervisor'],
  BIAYA:     ['superadmin', 'admin', 'manajer', 'supervisor'],
  KAS_MASUK: ['superadmin', 'admin', 'manajer'],
  KAS_KELUAR:['superadmin', 'admin', 'manajer', 'supervisor'],
  KAS_VIEW:  ['superadmin', 'admin', 'manajer', 'supervisor'],
  INPUT:     ['superadmin', 'admin', 'manajer', 'supervisor', 'operator'],
  ALL:       ['superadmin', 'admin', 'manajer', 'supervisor', 'operator', 'staff', 'viewer']
};

function can(p) {
  if (currentUser?.role === 'superadmin') return true;
  return currentUser && ROLES[p] && ROLES[p].includes(currentUser.role);
}

function applyRoleRestrictions() {
  const nj = document.getElementById('nav-penjualan');
  if (nj) nj.style.display = can('JUAL') ? '' : 'none';
  const nb = document.getElementById('nav-biaya');
  if (nb) nb.style.display = can('BIAYA') ? '' : 'none';
  const hp = document.getElementById('hs-penjualan')?.closest('.stat-card');
  if (hp) hp.style.display = can('KEUANGAN') ? '' : 'none';
  const hk = document.getElementById('hs-kas-card');
  if (hk) hk.style.display = can('KAS_VIEW') ? '' : 'none';
  const tl = document.getElementById('ltab-labarugi');
  if (tl) tl.style.display = can('KEUANGAN') ? '' : 'none';
  const rj = document.getElementById('rtab-penjualan');
  if (rj) rj.style.display = can('JUAL') ? '' : 'none';
  
  document.querySelectorAll('.btn-export').forEach(b => {
    if (b.getAttribute('onclick') === 'exportLaporan()') b.style.display = can('EXPORT_LAP') ? '' : 'none';
  });
  
  const btnExportJual = document.getElementById('btn-export-jual');
  if (btnExportJual) btnExportJual.style.display = can('EXPORT_LAP') ? '' : 'none';
  
  const btnExportJualRiwayat = document.getElementById('btn-export-jual-riwayat');
  if (btnExportJualRiwayat) btnExportJualRiwayat.style.display = can('EXPORT_LAP') ? '' : 'none';
  
  const btnDaftar = document.getElementById('btn-daftar-pakan');
  if (btnDaftar) btnDaftar.style.display = can('KEUANGAN') ? '' : 'none';

  // Settings dropdown menu visibility
  const isSuperadmin = currentUser?.role === 'superadmin';
  const isManager    = can('KEUANGAN'); // manajer ke atas

  // Backup — superadmin only
  const smBackup = document.getElementById('smenu-backup');
  if (smBackup) smBackup.style.display = isSuperadmin ? '' : 'none';

  // Master — manajer ke atas
  const smMaster = document.getElementById('smenu-master');
  if (smMaster) smMaster.style.display = isManager ? '' : 'none';

  // Tab Master di settings — manajer ke atas
  const stabMaster = document.getElementById('stab-master');
  if (stabMaster) stabMaster.style.display = isManager ? '' : 'none';

  // Tab Backup di settings — superadmin only
  const stabBackup = document.getElementById('stab-backup');
  if (stabBackup) stabBackup.style.display = isSuperadmin ? '' : 'none';
}

// ═══ AUTH (Supabase) ═══
let currentUser = null;

async function initUsers() {
  // Cek apakah tabel users sudah ada data, jika tidak insert default admin
  try {
    const users = await dbGetUsers();
    if (!users || users.length === 0) {
      await dbSaveUser({ username: 'admin', password: 'ab5678', role: 'admin', active: true });
    }
  } catch (e) {
    console.warn('initUsers error:', e);
  }
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  if (!u || !p) {
    err.textContent = '❌ Username dan password wajib diisi.';
    return;
  }
  err.textContent = '⏳ Memeriksa...';
  try {
    const user = await dbFindUser(u, p);
    if (user) {
      currentUser = user;
      sessionStorage.setItem('session_user', JSON.stringify(user));
      err.textContent = '';
      showApp();
    } else {
      err.textContent = '❌ Username atau password salah.';
      document.getElementById('login-pw').value = '';
      document.getElementById('login-pw').focus();
    }
  } catch (e) {
    err.textContent = '❌ Gagal terhubung ke server. Cek koneksi internet.';
    console.error('[doLogin error]', e);
  }
}

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem('session_user');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-err').textContent = '';
}

function checkSession() {
  const s = sessionStorage.getItem('session_user');
  if (s) {
    try {
      currentUser = JSON.parse(s);
      showApp();
      return;
    } catch {}
  }
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function showApp() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('hdr-user').textContent = currentUser.username + ' (' + currentUser.role + ')';
  
  applyRoleRestrictions();
  initDarkMode(); // Called from app.js
  
  initApp().catch(e => console.error('initApp error:', e)); // Called from app.js
  
  // Inisialisasi realtime setelah app tampil (tidak block loading)
  setTimeout(() => { 
    if (typeof initRealtimeManager === 'function') initRealtimeManager(); 
  }, 2000);
}

function togglePw() {
  const i = document.getElementById('login-pw');
  i.type = i.type === 'password' ? 'text' : 'password';
}

function togglePwField(id) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
}
