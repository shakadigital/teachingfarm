// ═══ PERIOD BAR ═══
async function updatePeriodBar(){
  const name=(document.getElementById('kandang').value||'').trim();
  const bar=document.getElementById('period-bar');
  const tglInput = document.getElementById('tanggal').value || new Date().toISOString().split('T')[0];
  
  if(!name){bar.style.display='none';document.getElementById('hdr-kandang').textContent='—';return;}
  const list=cache.get('kandang_list')||[];
  const k=list.find(x=>x.nama===name);
  if(!k){bar.style.display='none';return;}
  bar.style.display='flex';
  document.getElementById('pi-kandang').textContent=k.nama;
  document.getElementById('pi-status').innerHTML=k.status==='Aktif'?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-gray">Selesai</span>';
  document.getElementById('hdr-kandang').textContent=k.nama;
  
  // ── Hitung Populasi Awal Kumulatif ──
  // Populasi awal hari ini = Populasi masuk - total deplesi hari-hari sebelumnya
  const allInputs = await dbGetInput({kandang: name});
  let totalDepSebelumnya = 0;
  allInputs.forEach(row => {
    if(row.tanggal < tglInput) {
      totalDepSebelumnya += parseInt(row.data?.deplesi?.total || 0);
    }
  });
  const popAwalHariIni = Math.max(0, (parseInt(k.populasi)||0) - totalDepSebelumnya);
  document.getElementById('populasi_awal').value = popAwalHariIni;
  document.getElementById('pi-pop').textContent = popAwalHariIni + ' ekor';

  calcSisa();
  // Refresh saldo kas untuk kandang ini
  if(typeof renderKasSaldo === 'function') renderKasSaldo();
  
  if(k.chickin){
    const today=new Date(tglInput);
    const cin=new Date(k.chickin);cin.setHours(0,0,0,0);today.setHours(0,0,0,0);
    const hariSejak=Math.floor((today-cin)/86400000);
    const totalHari=(parseInt(k.umur_masuk)||0)+hariSejak;
    const mg=Math.floor(totalHari/7);
    const hr=totalHari%7;
    document.getElementById('pi-umur').textContent=mg+' mg'+(hr>0?' '+hr+'hr':'');
    document.getElementById('pi-hari').textContent=hariSejak>=0?'Hari ke-'+(hariSejak+1):'—';
  }else{
    document.getElementById('pi-umur').textContent='—';
    document.getElementById('pi-hari').textContent='—';
  }
}

// ═══ FORM CALC ═══
function calcSisa(){
  const pop=parseFloat(document.getElementById('populasi_awal').value)||0;
  const mati=parseFloat(document.getElementById('mati').value)||0;
  const afkir=parseFloat(document.getElementById('afkir').value)||0;
  const dep=mati+afkir;const sisa=Math.max(pop-dep,0);
  document.getElementById('total_deplesi').value=dep;
  document.getElementById('sisa_ayam').value=sisa;
  document.getElementById('pct_deplesi').value=pop>0?(dep/pop*100).toFixed(2)+' %':'0.00 %';
  calcAir();calcProduksi();
}
function calcAir(){
  const liter=parseFloat(document.getElementById('air_liter').value)||0;
  const sisa=parseFloat(document.getElementById('sisa_ayam').value)||0;
  document.getElementById('air_ml_ek').value=sisa>0?((liter*1000)/sisa).toFixed(1)+' ml':'—';
  let tp=0;document.querySelectorAll('.pakan-row input[type="number"]').forEach(i=>{tp+=parseFloat(i.value)||0;});
  document.getElementById('air_rasio').value=tp>0?(liter/tp).toFixed(2)+' : 1':'—';
}
function calcProduksi(){
  const nb=parseFloat(document.getElementById('p_normal_butir').value)||0,nk=parseFloat(document.getElementById('p_normal_kilo').value)||0;
  const cb=parseFloat(document.getElementById('p_cream_butir').value)||0,ck=parseFloat(document.getElementById('p_cream_kilo').value)||0;
  const rb=parseFloat(document.getElementById('p_retak_butir').value)||0,rk=parseFloat(document.getElementById('p_retak_kilo').value)||0;
  const tb=nb+cb+rb,tk=(nk+ck+rk).toFixed(2);
  document.getElementById('p_total_butir').value=tb;document.getElementById('p_total_kilo').value=tk;
  const sisa=parseFloat(document.getElementById('sisa_ayam').value)||0;
  document.getElementById('hdp').value=sisa>0?(tb/sisa*100).toFixed(2)+' %':'0.00 %';
  document.getElementById('berat_rata').value=tb>0?((parseFloat(tk)*1000)/tb).toFixed(1)+' g':'0 g';
}

// ═══ PAKAN ROWS ═══
async function populatePakanSelect(sel){
  const pakans=cache.get('daftar_pakan')||await dbGetDaftarPakan();
  const prev=sel.value;
  sel.innerHTML='<option value="">-- Pilih Pakan --</option>';
  pakans.forEach(p=>{const o=document.createElement('option');o.value=p.nama;o.textContent=p.nama;sel.appendChild(o);});
  if(prev)sel.value=prev;
}
async function populateAllPakanSelects(){
  const pakans=cache.get('daftar_pakan')||await dbGetDaftarPakan();
  cache.set('daftar_pakan',pakans);
  document.querySelectorAll('.pakan-select').forEach(sel=>{
    const prev=sel.value;
    sel.innerHTML='<option value="">-- Pilih Pakan --</option>';
    pakans.forEach(p=>{const o=document.createElement('option');o.value=p.nama;o.textContent=p.nama;sel.appendChild(o);});
    if(prev)sel.value=prev;
  });
}
function autoResetInputForm(){
  // Reset input fields ke 0
  ['mati','afkir','air_liter',
   'p_normal_butir','p_normal_kilo','p_cream_butir','p_cream_kilo','p_retak_butir','p_retak_kilo'
  ].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
  // Reset readonly calculated fields
  ['total_deplesi','sisa_ayam','p_total_butir','p_total_kilo',
   'air_ml_ek','air_rasio','hdp','berat_rata','total_biaya'
  ].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('pct_deplesi').value='';
  // Reset catatan
  document.getElementById('catatan').value='';
  // Reset tags kesehatan → reset rows baru
  resetKesRows();
  // Sembunyikan status bar
  const bar = document.getElementById('input-status-bar');
  if(bar) bar.style.display = 'none';
  // Reset edit mode
  if (typeof _editRowId !== 'undefined') _editRowId = null;
  // Reset pakan — sisakan 1 baris kosong
  const pl=document.getElementById('pakan-list');
  [...pl.querySelectorAll('.pakan-row')].slice(1).forEach(r=>r.remove());
  const firstSel=pl.querySelector('.pakan-row .pakan-select');
  if(firstSel)firstSel.value='';
  pl.querySelector('.pakan-row input[type="number"]').value='';
  // Reset biaya operasional
  if(typeof resetBiayaRows==='function')resetBiayaRows();
  // Recalculate semua field otomatis
  calcSisa();
  calcAir();
  calcProduksi();
  // Update period bar sesuai kandang yang masih terpilih
  updatePeriodBar();
}
function addPakan(){
  const list=document.getElementById('pakan-list');
  const row=document.createElement('div');row.className='row pakan-row';
  row.innerHTML='<div class="field"><label>Kode Pakan</label><select class="pakan-select" style="border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 10px;font-size:.9rem;width:100%;background:#fff"><option value="">-- Pilih Pakan --</option></select></div><div class="field"><label>Jumlah (kg)</label><input type="number" min="0" step="0.1" placeholder="0" oninput="calcAir()"/></div><div style="display:flex;align-items:flex-end"><button class="btn-del" onclick="removeRow(this,\'pakan-list\',\'pakan-row\')">✕</button></div>';
  list.appendChild(row);
  populatePakanSelect(row.querySelector('.pakan-select'));
}
function removeRow(btn,cid,cls){
  const c=document.getElementById(cid);
  if(!c||c.querySelectorAll('.'+cls).length<=1)return;
  (btn.closest('.'+cls)||btn.closest('tr')).remove();
  calcAir();
  if(typeof calcSaleTotal === 'function') calcSaleTotal();
}

// ═══ KESEHATAN — DROPDOWN DARI MASTER ═══
// Cache master data kesehatan
const _kesMaster = { vitamin: [], obat: [], vaksin: [] };

async function loadKesMaster() {
  try {
    const [vitamins, obats, vaksins] = await Promise.all([
      dbGetVitamin(), dbGetObat(), dbGetVaksin()
    ]);
    _kesMaster.vitamin = vitamins;
    _kesMaster.obat    = obats;
    _kesMaster.vaksin  = vaksins;
  } catch(e) { console.warn('loadKesMaster error:', e); }
}

function addKesRow(type, namaItem = '', jumlah = 1) {
  const list = document.getElementById(`kes-${type}-list`);
  if(!list) return;

  const items = _kesMaster[type] || [];
  const row = document.createElement('div');
  row.className = 'kes-row';

  // Build options
  const opts = items.length
    ? items.map(m =>
        `<option value="${esc(m.nama)}" data-supplier="${esc(m.supplier_id||'')}" data-satuan="${esc(m.satuan||'botol')}">${esc(m.nama)}</option>`
      ).join('')
    : `<option value="">-- Belum ada data di Master --</option>`;

  // Cari satuan default dari item yang dipilih
  const selectedItem = items.find(m => m.nama === namaItem);
  const satuan = selectedItem?.satuan || (type === 'vaksin' ? 'dosis' : 'botol');

  row.innerHTML = `
    <select class="kes-select" onchange="onKesItemChange(this,'${type}')">
      <option value="">-- Pilih ${type} --</option>
      ${opts}
    </select>
    <input type="number" class="kes-jumlah" value="${jumlah}" min="0.1" step="0.1" placeholder="1"/>
    <span class="kes-satuan">${esc(satuan)}</span>
    <span class="kes-supplier" title="Supplier">—</span>
    <button class="btn-del" onclick="this.closest('.kes-row').remove()" style="flex-shrink:0">✕</button>
  `;

  list.appendChild(row);

  // Set nilai jika ada
  if(namaItem) {
    const sel = row.querySelector('.kes-select');
    sel.value = namaItem;
    onKesItemChange(sel, type);
  }
}

async function onKesItemChange(sel, type) {
  const row = sel.closest('.kes-row');
  const nama = sel.value;
  const supplierEl = row.querySelector('.kes-supplier');
  const satuanEl   = row.querySelector('.kes-satuan');

  if(!nama) {
    supplierEl.textContent = '—';
    return;
  }

  // Cari dari cache master
  const item = (_kesMaster[type] || []).find(m => m.nama === nama);
  if(item) {
    // Update satuan
    if(item.satuan) satuanEl.textContent = item.satuan;

    // Cari nama supplier
    if(item.supplier_id) {
      try {
        const suppliers = await dbGetSupplier();
        const sup = suppliers.find(s => s.id === item.supplier_id);
        supplierEl.textContent = sup ? sup.nama : '—';
        supplierEl.title = sup ? `Supplier: ${sup.nama}` : 'Supplier tidak ditemukan';
      } catch(e) {
        supplierEl.textContent = '—';
      }
    } else {
      supplierEl.textContent = 'Tanpa supplier';
    }
  }
}

// Collect data kesehatan dari rows baru
function collectKesehatan() {
  const result = { vitamin: [], obat: [], vaksin: [] };
  ['vitamin', 'obat', 'vaksin'].forEach(type => {
    const rows = document.querySelectorAll(`#kes-${type}-list .kes-row`);
    rows.forEach(row => {
      const nama = row.querySelector('.kes-select')?.value;
      const jumlah = parseFloat(row.querySelector('.kes-jumlah')?.value) || 1;
      const satuan = row.querySelector('.kes-satuan')?.textContent || 'botol';
      const supplier = row.querySelector('.kes-supplier')?.textContent || '';
      if(nama) result[type].push({ nama, jumlah, satuan, supplier });
    });
  });
  return result;
}

// Reset semua rows kesehatan
function resetKesRows() {
  ['vitamin', 'obat', 'vaksin'].forEach(type => {
    const list = document.getElementById(`kes-${type}-list`);
    if(list) list.innerHTML = '';
  });
}

// Populate rows dari data yang sudah ada (saat edit)
function populateKesRows(kesehatan) {
  resetKesRows();
  if(!kesehatan) return;
  ['vitamin', 'obat', 'vaksin'].forEach(type => {
    const items = kesehatan[type] || [];
    items.forEach(item => {
      // Support format lama (string) dan baru (object)
      if(typeof item === 'string') {
        addKesRow(type, item, 1);
      } else if(item?.nama) {
        addKesRow(type, item.nama, item.jumlah || 1);
      }
    });
  });
}

// ═══ TAGS (legacy — masih dipakai untuk backward compat) ═══
function tagEnter(e,t){if(e.key==='Enter'){e.preventDefault();addKesRow(t);}}
function addTag(type){ addKesRow(type); }

// ═══ SAVE INPUT HARIAN ═══
let _pendingInputData=null; // simpan sementara data yang menunggu konfirmasi

function collectInputData(){
  const tgl=document.getElementById('tanggal').value;
  const knd=document.getElementById('kandang').value;
  if(!tgl||!knd){showToast('⚠️ Pilih tanggal dan kandang!');return null;}
  return{
    tanggal:tgl,kandang:knd,user:currentUser?currentUser.username:'',
    deplesi:{mati:document.getElementById('mati').value,afkir:document.getElementById('afkir').value,total:document.getElementById('total_deplesi').value},
    sisa_ayam:document.getElementById('sisa_ayam').value,pct_deplesi:document.getElementById('pct_deplesi').value,
    pakan:[...document.querySelectorAll('.pakan-row')].map(r=>{const sel=r.querySelector('.pakan-select');const inp=r.querySelector('input[type="number"]');return{kode:sel?sel.value:'',jumlah:inp?parseFloat(inp.value)||0:0};}).filter(p=>p.kode),
    air_liter:document.getElementById('air_liter').value,
    produksi:{
      normal:{butir:document.getElementById('p_normal_butir').value,kilo:document.getElementById('p_normal_kilo').value},
      cream:{butir:document.getElementById('p_cream_butir').value,kilo:document.getElementById('p_cream_kilo').value},
      retak:{butir:document.getElementById('p_retak_butir').value,kilo:document.getElementById('p_retak_kilo').value},
      total:{butir:document.getElementById('p_total_butir').value,kilo:document.getElementById('p_total_kilo').value},
      hdp:document.getElementById('hdp').value,berat_rata:document.getElementById('berat_rata').value
    },
    kesehatan: collectKesehatan(),
    catatan:document.getElementById('catatan').value
  };
}

async function saveInputData(){
  const btn = document.querySelector('#page-input .btn-save');
  if(btn && btn.disabled) return;
  const data=collectInputData();
  if(!data)return;

  showToast('⏳ Menyimpan...');
  if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try{
    const existing=await dbGetInput({tanggal:data.tanggal,kandang:data.kandang});
    const dataLama = existing?.length > 0 ? existing[0].data : null;
    await doSaveInput(data, dataLama);
  }catch(e){
    showToast('❌ Gagal menyimpan: '+e.message);
  }finally{
    if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

async function confirmTimpa(){
  // Legacy — tidak dipakai lagi, tapi jaga agar tidak error
  closeModal('modal-duplikat');
  if(!_pendingInputData)return;
  await doSaveInput(_pendingInputData.data, _pendingInputData.dataLama);
  _pendingInputData=null;
}

async function doSaveInput(data, dataLama){
  try{
    // ══════════════════════════════════════════════════════
    // PRINSIP: Merge akumulatif — hanya field yang diisi yang di-update
    // Siapa pun yang menyimpan, field kosong/0 tidak menimpa data lama
    // Last editor dicatat di field 'last_editor' untuk audit trail
    // ══════════════════════════════════════════════════════

    const hasVal = v => v !== null && v !== undefined && v !== '' && v !== '0' && parseFloat(v) !== 0;
    const hasArr = a => Array.isArray(a) && a.length > 0;

    let finalData;

    if(!dataLama || (typeof _editRowId !== 'undefined' && _editRowId)){
      // Data baru atau edit eksplisit via ✏️ → simpan langsung
      finalData = { ...data };
    } else {
      // Merge akumulatif — berlaku untuk semua user (sama atau berbeda)
      // Proteksi role sudah ditangani di autoLoadInputHarian (read-only jika tidak berhak)

      const deplesiDiisi = hasVal(data.deplesi?.mati) || hasVal(data.deplesi?.afkir);
      const prodDiisi    = hasVal(data.produksi?.total?.butir) || hasVal(data.produksi?.total?.kilo);
      const kesDiisi     = hasArr(data.kesehatan?.vitamin) || hasArr(data.kesehatan?.obat) || hasArr(data.kesehatan?.vaksin);

      finalData = {
        ...dataLama,
        tanggal:    data.tanggal,
        kandang:    data.kandang,
        user:       dataLama.user,           // pertahankan user pertama yang input
        last_editor: data.user,              // catat siapa yang terakhir edit
        last_edit_time: new Date().toISOString(),
        deplesi:    deplesiDiisi ? data.deplesi    : dataLama.deplesi,
        sisa_ayam:  deplesiDiisi ? data.sisa_ayam  : dataLama.sisa_ayam,
        pct_deplesi:deplesiDiisi ? data.pct_deplesi: dataLama.pct_deplesi,
        pakan:      hasArr(data.pakan)       ? data.pakan      : dataLama.pakan,
        air_liter:  hasVal(data.air_liter)   ? data.air_liter  : dataLama.air_liter,
        produksi:   prodDiisi                ? data.produksi   : dataLama.produksi,
        kesehatan:  kesDiisi                 ? data.kesehatan  : dataLama.kesehatan,
        catatan:    data.catatan?.trim()     ? data.catatan    : (dataLama.catatan||''),
      };
    }

    await dbSaveInput(data.tanggal, data.kandang, finalData);

    // Activity log
    const aksi = dataLama ? 'EDIT' : 'TAMBAH';
    const _eid = (typeof _editRowId !== 'undefined') ? _editRowId : null;
    await dbSaveLog(aksi,'input_harian',_eid,dataLama,finalData,
      `${aksi} data harian ${data.tanggal} kandang ${data.kandang}`);

    // Sync pemakaian non-pakan
    const kes = finalData.kesehatan || {};
    const kesLama = dataLama?.kesehatan || {};
    if(JSON.stringify(kes) !== JSON.stringify(kesLama) || !dataLama){
      await syncPemakaianNonPakan(data.tanggal, data.kandang, kes, kesLama);
    }

    if (typeof _editRowId !== 'undefined') _editRowId = null;
    showToast('✅ Data harian disimpan!');
    autoResetInputForm();
  }catch(e){showToast('❌ Gagal menyimpan: '+e.message);}
}

// ═══ AUTO-LOAD INPUT HARIAN ═══
// Dipanggil saat buka halaman Input — load data hari ini jika sudah ada
async function autoLoadInputHarian(){
  const tgl  = document.getElementById('tanggal').value || new Date().toISOString().split('T')[0];
  const knd  = document.getElementById('kandang').value;

  // Set tanggal hari ini jika belum diset
  if(!document.getElementById('tanggal').value){
    document.getElementById('tanggal').value = tgl;
  }

  // Jika kandang belum dipilih, tunggu user pilih kandang dulu
  if(!knd){
    updatePeriodBar();
    return;
  }

  try{
    const existing = await dbGetInput({tanggal:tgl, kandang:knd});
    if(!existing || existing.length === 0){
      // Belum ada data — form kosong
      updatePeriodBar();
      return;
    }

    const d = existing[0].data;
    const prevUser = d?.user || existing[0].user_input || '—';
    const lastEditor = d?.last_editor || prevUser;
    const lastTime = d?.last_edit_time || existing[0].updated_at || existing[0].created_at || '';

    // Cek apakah user ini boleh edit
    const LEVEL={viewer:0,staff:1,operator:2,supervisor:3,manajer:4,admin:5,superadmin:6};
    const prevUserObj=(await dbGetUsers()).find(u=>u.username===prevUser);
    const prevRole=prevUserObj?.role||'';
    const myLevel=LEVEL[currentUser?.role]??0;
    const prevLevel=LEVEL[prevRole]??0;
    const sameUser = prevUser === currentUser?.username;
    const canEdit = sameUser || myLevel > prevLevel;

    // Tampilkan info siapa yang sudah input
    showInputStatusBar(prevUser, lastEditor, lastTime, canEdit, prevRole);

    if(!canEdit){
      // Read-only — tampilkan data tapi disable tombol simpan
      if(typeof _loadEditToForm === 'function') _loadEditToForm(d, existing[0].id);
      const btnSave = document.querySelector('#page-input .btn-save');
      if(btnSave){
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.title = `Data diinput oleh ${prevUser} (${prevRole}). Anda tidak bisa mengubahnya.`;
      }
      return;
    }

    // Bisa edit — load data dan enable simpan
    if(typeof _loadEditToForm === 'function') _loadEditToForm(d, existing[0].id);
    const btnSave = document.querySelector('#page-input .btn-save');
    if(btnSave){ btnSave.disabled = false; btnSave.style.opacity = ''; btnSave.title = ''; }

  }catch(e){
    console.warn('autoLoadInputHarian error:', e);
    showToast('⚠️ Gagal memuat data sebelumnya. Cek koneksi internet Anda.');
    updatePeriodBar();
  }
}

// Tampilkan status bar info siapa yang sudah input
function showInputStatusBar(prevUser, lastEditor, lastTime, canEdit, prevRole){
  let bar = document.getElementById('input-status-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'input-status-bar';
    bar.style.cssText = 'margin-bottom:12px;padding:10px 14px;border-radius:8px;font-size:.82rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    const periodBar = document.getElementById('period-bar');
    if(periodBar) periodBar.parentNode.insertBefore(bar, periodBar.nextSibling);
  }

  const timeStr = lastTime ? (typeof fmtTglWaktu === 'function' ? fmtTglWaktu(lastTime) : lastTime) : '—';
  const editorInfo = lastEditor !== prevUser
    ? `Pertama: <strong>${typeof esc === 'function' ? esc(prevUser) : prevUser}</strong> · Terakhir edit: <strong>${typeof esc === 'function' ? esc(lastEditor) : lastEditor}</strong>`
    : `Diinput oleh: <strong>${typeof esc === 'function' ? esc(prevUser) : prevUser}</strong>`;

  if(canEdit){
    bar.style.background = '#f0fdf4';
    bar.style.border = '1px solid #b7e4c7';
    bar.style.color = '#1b4332';
    bar.innerHTML = `✅ Data sudah ada · ${editorInfo} · ${timeStr} · <em style="color:#2d6a4f">Lanjutkan mengisi field yang kosong</em>`;
  } else {
    bar.style.background = '#fef3c7';
    bar.style.border = '1px solid #fde68a';
    bar.style.color = '#92400e';
    bar.innerHTML = `🔒 ${editorInfo} (${prevRole}) · ${timeStr} · <em>Anda tidak bisa mengubah data ini</em>`;
  }
  bar.style.display = 'flex';
}

// Auto-scroll ke field pertama yang belum diisi
function autoScrollToEmpty(){
  const checks = [
    [
      ()=>!document.getElementById('kandang').value,
      ()=>document.getElementById('kandang'),
    ],
    [
      ()=>{ const m=parseFloat(document.getElementById('mati').value)||0; const a=parseFloat(document.getElementById('afkir').value)||0; return m===0&&a===0; },
      ()=>document.getElementById('mati'),
    ],
    [
      ()=>{ const rows=document.querySelectorAll('.pakan-row'); return ![...rows].some(r=>r.querySelector('.pakan-select')?.value); },
      ()=>document.querySelector('.pakan-select'),
    ],
    [
      ()=>{ const v=parseFloat(document.getElementById('p_normal_butir').value)||0; const k=parseFloat(document.getElementById('p_normal_kilo').value)||0; return v===0&&k===0; },
      ()=>document.getElementById('p_normal_butir'),
    ],
  ];

  for(const [isEmpty, getEl] of checks){
    if(isEmpty()){
      const el = getEl();
      if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); return; }
    }
  }
}

// Sinkronisasi otomatis pemakaian vitamin/obat/vaksin ke tabel pemakaian_nonpakan
async function syncPemakaianNonPakan(tanggal, kandang, kesBaru, kesLama) {
  try {
    // Hapus pemakaian lama yang berasal dari input harian untuk tanggal+kandang ini
    const existing = await dbGetPemakaianNonPakan({ dari: tanggal, sampai: tanggal });
    const toDelete = existing.filter(p =>
      p.keterangan === 'Auto dari Input Harian' &&
      (p.kandang === kandang || (!p.kandang && !kandang))
    );
    for(const p of toDelete) {
      await dbDeletePemakaianNonPakan(p.id);
    }

    // Simpan pemakaian baru dari data kesehatan
    const kategoriMap = {
      vitamin: { kategori: 'vitamin', satuan: 'botol' },
      obat:    { kategori: 'obat',    satuan: 'botol' },
      vaksin:  { kategori: 'vaksin',  satuan: 'dosis' }
    };

    for(const [field, cfg] of Object.entries(kategoriMap)) {
      const items = kesBaru[field] || [];
      for(const item of items) {
        // Support format lama (string) dan baru (object {nama, jumlah, satuan, supplier})
        const nama_item = typeof item === 'string' ? item : item?.nama;
        const jumlah    = typeof item === 'object'  ? (item?.jumlah || 1) : 1;
        const satuan    = typeof item === 'object'  ? (item?.satuan || cfg.satuan) : cfg.satuan;
        if(!nama_item || !nama_item.trim()) continue;
        await dbSavePemakaianNonPakan({
          tanggal,
          kategori: cfg.kategori,
          nama_item: nama_item.trim(),
          jumlah,
          satuan,
          kandang: kandang || null,
          keterangan: 'Auto dari Input Harian',
          user_input: currentUser?.username || ''
        });
      }
    }
  } catch(e) {
    console.warn('syncPemakaianNonPakan error:', e);
    // Tidak throw — jangan gagalkan save input harian karena sync error
  }
}

function resetInputForm(){
  if(!confirm('Reset semua data form?'))return;
  document.getElementById('tanggal').value=new Date().toISOString().split('T')[0];
  document.getElementById('kandang').value='';
  ['mati','afkir','populasi_awal','air_liter','p_normal_butir','p_normal_kilo','p_cream_butir','p_cream_kilo','p_retak_butir','p_retak_kilo'].forEach(id=>document.getElementById(id).value=0);
  document.getElementById('catatan').value='';
  resetKesRows();
  if (typeof _editRowId !== 'undefined') _editRowId = null;
  const pl=document.getElementById('pakan-list');
  [...pl.querySelectorAll('.pakan-row')].slice(1).forEach(r=>r.remove());
  pl.querySelector('.pakan-row').querySelectorAll('input').forEach(i=>i.value='');
  calcSisa();updatePeriodBar();
  if(typeof resetBiayaRows==='function') resetBiayaRows();
  showToast('🔄 Form direset!');
}
