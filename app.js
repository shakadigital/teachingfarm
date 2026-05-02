// ═══ STORAGE (localStorage fallback untuk session saja) ═══
const DB={
  get:k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}},
  set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),
  del:k=>localStorage.removeItem(k)
};


// ═══ MANUAL SYNC ═══
async function manualSync(){
  const btn=document.getElementById('btn-sync');
  if(btn.classList.contains('syncing'))return; // Prevent double click
  
  btn.classList.add('syncing');
  btn.title='Syncing...';
  showToast('🔄 Memulai sync...');
  
  try{
    // Cek mode database
    if(window.DB_MODE!=='supabase'){
      showToast('⚠️ Sync hanya tersedia di mode Supabase');
      btn.classList.remove('syncing');
      return;
    }
    
    // Refresh semua data dari server
    const results=await Promise.allSettled([
      dbGetUsers(),
      dbGetKandang(),
      dbGetInput({}),
      dbGetPenjualan({}),
      dbGetDaftarPakan(),
      dbGetKiriman({}),
      dbGetKas({})
    ]);
    
    // Cek hasil
    const failed=results.filter(r=>r.status==='rejected');
    
    // Clear all cache regardless of partial failures so successful ones update UI
    if(typeof cache!=='undefined'&&cache._data){
      Object.keys(cache._data).forEach(k=>cache.del(k));
    }
    
    if(failed.length>0){
      console.error('Sync errors:',failed);
      btn.classList.add('error');
      setTimeout(()=>btn.classList.remove('error'),2000);
      showToast('❌ Sync gagal: '+failed.length+' tabel error');
    }else{
      btn.classList.add('success');
      setTimeout(()=>btn.classList.remove('success'),2000);
      showToast('✅ Sync berhasil! Data diperbarui.');
      
      // Refresh tampilan jika di home
      const activePage=document.querySelector('.page.active');
      if(activePage&&activePage.id==='page-home'){
        renderHome();
      }
    }
  }catch(e){
    console.error('Sync error:',e);
    btn.classList.add('error');
    setTimeout(()=>btn.classList.remove('error'),2000);
    showToast('❌ Sync gagal: '+e.message);
  }finally{
    btn.classList.remove('syncing');
    btn.title='Sync Data';
  }
}



// ═══ NAVIGATION ═══
function switchPage(name){
  if(name==='penjualan'&&!can('JUAL')){showToast('Tidak ada akses ke halaman Penjualan');return;}
  if(name==='biaya'&&!can('BIAYA')){showToast('Tidak ada akses ke halaman Biaya Operasional');return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const targetPage = document.getElementById('page-'+name);
  if(targetPage) targetPage.classList.add('active');
  else console.warn('Halaman tidak ditemukan: page-'+name);
  const navEl = document.getElementById('nav-'+name);
  if(navEl) navEl.classList.add('active');
  if(name==='home')renderHome();
  if(name==='input')autoLoadInputHarian();   // ← auto-load data hari ini
  if(name==='settings')renderSettings();
  if(name==='gudang') { _currentGTab='pakan'; switchGTab('pakan'); }
  if(name==='penjualan'){renderStokTelur();renderRiwayatJual();}
  if(name==='biaya'){initBiayaPage();}
  if(name==='riwayat')renderRiwayat();
  if(name==='laporan'){populateLaporanKandang();renderLaporan();}
}

// ═══ INIT ═══
async function initApp(){
  if(!document.getElementById('tanggal').value)document.getElementById('tanggal').value=new Date().toISOString().split('T')[0];
  if(!document.getElementById('jual-tanggal').value)document.getElementById('jual-tanggal').value=new Date().toISOString().split('T')[0];
  await populateKandangSelects();
  await populateAllPakanSelects();
  await loadKesMaster(); // Load master vitamin/obat/vaksin untuk dropdown
  updatePeriodBar();
  calcSisa();calcSaleTotal();
  renderHome();
}

// ═══ KANDANG SELECT ═══
async function populateKandangSelects(){
  const list=await dbGetKandang();
  cache.set('kandang_list',list);
  ['kandang'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const prev=sel.value;
    sel.innerHTML='<option value="">-- Pilih Kandang --</option>';
    list.forEach(k=>{const o=document.createElement('option');o.value=k.nama;o.textContent=k.nama+(k.status==='Aktif'?' ✅':' ⬜');sel.appendChild(o);});
    if(prev)sel.value=prev;
  });
}

function addSaleRow(){
  const card=document.createElement('div');
  card.className='sale-card sale-row';
  card.innerHTML=
    '<button class="btn-del-card" onclick="removeSaleRow(this)">✕</button>'+
    '<div class="sc-row"><div class="sc-field" style="grid-column:1/-1"><label>Pelanggan</label><input type="text" placeholder="Nama pelanggan"/></div></div>'+
    '<div class="sc-row three">'+
      '<div class="sc-field"><label>Grade</label><select><option value="">-- Grade --</option><option>Normal</option><option>Cream</option><option>Retak</option></select></div>'+
      '<div class="sc-field"><label>Butir</label><input type="number" min="0" placeholder="0" oninput="calcTotal(this)"/></div>'+
      '<div class="sc-field"><label>Kilo (kg)</label><input type="number" min="0" step="0.01" placeholder="0" oninput="calcTotal(this)"/></div>'+
    '</div>'+
    '<div class="sc-row"><div class="sc-field"><label>Harga/kg (Rp)</label><input type="number" min="0" step="100" placeholder="0" oninput="calcTotal(this)"/></div></div>'+
    '<div class="sc-total"><span>Total</span><strong class="total-col">Rp 0</strong></div>';
  document.getElementById('sale-tbody').appendChild(card);
}
function removeSaleRow(btn){
  if(document.querySelectorAll('.sale-row').length<=1)return;
  btn.closest('.sale-row').remove();calcSaleTotal();
}
function calcTotal(inp){
  const card=inp.closest('.sale-row');
  const nums=card.querySelectorAll('input[type="number"]');
  // nums[0]=butir, nums[1]=kilo, nums[2]=harga
  const kilo=parseFloat(nums[1]?.value)||0;
  const harga=parseFloat(nums[2]?.value)||0;
  card.querySelector('.total-col').textContent='Rp '+(kilo*harga).toLocaleString('id-ID');
  calcSaleTotal();
}
function calcSaleTotal(){
  let g=0;
  document.querySelectorAll('.sale-row .total-col').forEach(el=>{
    g+=parseInt(el.textContent.replace(/[^0-9]/g,''))||0;
  });
  document.getElementById('grand_total').value='Rp '+g.toLocaleString('id-ID');
}
// ═══ STOK TELUR KUMULATIF ═══
async function getStokTelur(tgl){
  const prod={Normal:{butir:0,kilo:0},Cream:{butir:0,kilo:0},Retak:{butir:0,kilo:0}};
  const inputs=await dbGetInput({sampai:tgl});
  inputs.forEach(row=>{
    const d=row.data;if(!d||!d.produksi)return;
    ['normal','cream','retak'].forEach(g=>{
      const G=g.charAt(0).toUpperCase()+g.slice(1);
      prod[G].butir+=parseInt(d.produksi[g]?.butir)||0;
      prod[G].kilo+=parseFloat(d.produksi[g]?.kilo)||0;
    });
  });
  const juals=await dbGetPenjualan({sampai:tgl});
  juals.forEach(j=>{
    (j.rows||[]).forEach(r=>{
      const G=r.grade;
      if(prod[G]){
        prod[G].butir=Math.max(0,prod[G].butir-(parseInt(r.butir)||0));
        prod[G].kilo=Math.max(0,prod[G].kilo-(parseFloat(r.kilo)||0));
      }
    });
  });
  return prod;
}

async function renderStokTelur(){
  const tgl=document.getElementById('jual-tanggal').value||new Date().toISOString().split('T')[0];
  const el=document.getElementById('stok-telur-body');
  el.innerHTML='<div style="color:#aaa;font-size:.85rem;text-align:center;padding:8px">⏳ Menghitung stok...</div>';
  const stok=await getStokTelur(tgl);
  const grades=['Normal','Cream','Retak'];
  const totalButir=grades.reduce((s,g)=>s+stok[g].butir,0);
  const totalKilo=grades.reduce((s,g)=>s+stok[g].kilo,0);
  el.innerHTML=
    '<table class="tbl" style="margin-bottom:0">'+
    '<thead><tr><th>Grade</th><th>Stok (butir)</th><th>Stok (kg)</th></tr></thead><tbody>'+
    grades.map(g=>'<tr><td>'+g+'</td><td style="font-weight:700;color:'+(stok[g].butir>0?'#1b4332':'#dc2626')+'">'+stok[g].butir.toLocaleString('id-ID')+'</td><td>'+stok[g].kilo.toFixed(2)+' kg</td></tr>').join('')+
    '<tr style="background:#d8f3dc;font-weight:700"><td>TOTAL</td><td>'+totalButir.toLocaleString('id-ID')+'</td><td>'+totalKilo.toFixed(2)+' kg</td></tr>'+
    '</tbody></table>'+
    '<div style="font-size:.75rem;color:#888;margin-top:8px">Kumulatif produksi semua kandang s.d. '+tgl+', dikurangi penjualan.</div>';
}

// ═══ PENJUALAN ═══
async function savePenjualan(){
  if(!can('JUAL')){showToast('Tidak ada akses!');return;}
  const tgl=document.getElementById('jual-tanggal').value;
  if(!tgl){showToast('⚠️ Pilih tanggal!');return;}
  const rows=[...document.querySelectorAll('.sale-row')].map(r=>{
    const inp=r.querySelectorAll('input[type="text"],input[type="number"]');
    const sel=r.querySelector('select');
    return{
      pelanggan:inp[0]?.value.trim()||'',
      grade:sel?.value||'',
      butir:parseFloat(inp[1]?.value)||0,
      kilo:parseFloat(inp[2]?.value)||0,
      harga:parseFloat(inp[3]?.value)||0,
      total:r.querySelector('.total-col')?.textContent||'Rp 0'
    };
  }).filter(r=>r.pelanggan||r.kilo||r.butir);

  if(!rows.length){showToast('⚠️ Isi minimal satu baris penjualan!');return;}

  // Validasi setiap baris
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    const no=i+1;
    if(!r.grade){showToast(`⚠️ Baris ${no}: Grade wajib dipilih!`);return;}
    if(!r.butir&&!r.kilo){showToast(`⚠️ Baris ${no}: Isi jumlah butir atau kilo!`);return;}
    if(r.butir<0||r.kilo<0){showToast(`⚠️ Baris ${no}: Jumlah tidak boleh negatif!`);return;}
    if(r.harga<=0){showToast(`⚠️ Baris ${no}: Harga per kg wajib diisi!`);return;}
    if(!r.pelanggan){showToast(`⚠️ Baris ${no}: Nama pelanggan wajib diisi!`);return;}
  }

  showToast('⏳ Memeriksa stok...');
  const stok=await getStokTelur(tgl);
  const jualPerGrade={};
  rows.forEach(r=>{const G=r.grade;if(G)jualPerGrade[G]=(jualPerGrade[G]||0)+(parseInt(r.butir)||0);});
  for(const G in jualPerGrade){
    if(stok[G]!==undefined&&jualPerGrade[G]>stok[G].butir){
      showToast('⚠️ Stok '+G+' tidak cukup! Tersedia: '+stok[G].butir+' butir');return;
    }
  }
  const grandTotal=parseInt(document.getElementById('grand_total').value.replace(/[^0-9]/g,''))||0;
  try{
    await dbSavePenjualan({tanggal:tgl,user_input:currentUser?currentUser.username:'',rows,grand_total:grandTotal});
    await renderStokTelur();await renderRiwayatJual();
    showToast('✅ Penjualan disimpan!');
    resetPenjualan();
  }catch(e){showToast('❌ Gagal menyimpan: '+e.message);}
}

function resetPenjualan(){
  document.getElementById('jual-tanggal').value=new Date().toISOString().split('T')[0];
  const sb=document.getElementById('sale-tbody');
  [...sb.querySelectorAll('.sale-row')].slice(1).forEach(r=>r.remove());
  const first=sb.querySelector('.sale-row');
  if(first){
    first.querySelectorAll('input').forEach(i=>i.value='');
    first.querySelectorAll('select').forEach(s=>s.value='');
    const tc=first.querySelector('.total-col');
    if(tc)tc.textContent='Rp 0';
  }
  document.getElementById('grand_total').value='';
  calcSaleTotal();
  renderStokTelur();
  showToast('🔄 Form direset!');
}

async function renderRiwayatJual(){
  const all=await dbGetPenjualan();
  const tbody=document.getElementById('riwayat-jual-tbody');
  const empty=document.getElementById('riwayat-jual-empty');
  tbody.innerHTML='';
  if(!all.length){empty.style.display='block';return;}
  empty.style.display='none';
  const isAdmin=currentUser?.role==='admin'||currentUser?.role==='superadmin';
  all.slice(0,60).forEach(rec=>{
    const rows=rec.rows||[];
    rows.forEach((r,i)=>{
      const tr=document.createElement('tr');
      const aksiCell=isAdmin&&i===0
        ?`<td rowspan="${rows.length}" style="text-align:center;vertical-align:middle">
            <button onclick="hapusPenjualan('${rec.id}')" style="background:none;border:none;cursor:pointer;font-size:1.1rem;color:#dc2626" title="Hapus transaksi ini">🗑️</button>
           </td>`
        :(isAdmin?'':'<td></td>');
      tr.innerHTML='<td>'+fmtTgl(rec.tanggal)+'</td><td>'+esc(r.pelanggan||'—')+'</td><td>'+esc(r.grade||'—')+'</td><td>'+(r.butir||0)+' butir</td><td>'+(r.kilo||0)+' kg</td><td>'+esc(r.total||'Rp 0')+'</td>'+(i===0?aksiCell:'');
      tbody.appendChild(tr);
    });
  });
}

async function hapusPenjualan(id){
  if(!currentUser||!['admin','superadmin'].includes(currentUser.role)){showToast('⛔ Hanya Admin yang bisa menghapus data penjualan!');return;}
  const konfirm=confirm('⚠️ Hapus transaksi penjualan ini?\n\nData yang dihapus tidak bisa dikembalikan.');
  if(!konfirm)return;
  try{
    showToast('⏳ Menghapus...');
    const all=await dbGetPenjualan();
    const rec=all.find(x=>x.id===id);
    await dbDeletePenjualan(id);
    await dbSaveLog('HAPUS','penjualan',id,rec,null,
      `Hapus penjualan tgl ${rec?.tanggal||'—'}, total Rp ${(rec?.grand_total||0).toLocaleString('id-ID')}`);
    await renderStokTelur();
    await renderRiwayatJual();
    showToast('✅ Transaksi penjualan dihapus!');
  }catch(e){showToast('❌ Gagal menghapus: '+e.message);}
}

// ═══ GUDANG ═══
async function calcStokPakan(namaPakan){
  const kiriman=cache.get('kiriman_pakan')||await dbGetKiriman();
  const masuk=kiriman.filter(k=>k.nama_pakan===namaPakan).reduce((s,k)=>s+(parseFloat(k.jumlah)||0),0);
  const inputs=cache.get('_all_inputs')||await dbGetInput();
  let keluar=0;
  inputs.forEach(row=>{
    const d=row.data;if(!d||!d.pakan)return;
    d.pakan.forEach(p=>{if(p.kode===namaPakan)keluar+=parseFloat(p.jumlah)||0;});
  });
  return Math.max(0,masuk-keluar);
}

async function getHargaTerakhir(namaPakan){
  const kiriman=cache.get('kiriman_pakan')||await dbGetKiriman();
  const filtered=kiriman.filter(k=>k.nama_pakan===namaPakan);
  if(!filtered.length)return 0;
  filtered.sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  return parseFloat(filtered[0].harga_per_kg)||0;
}

async function renderGudang(){
  const pakans=await dbGetDaftarPakan();
  cache.set('daftar_pakan',pakans);

  // Fetch semua data sekali — tidak ada N+1
  const kiriman=await dbGetKiriman();
  const allInputs=await dbGetInput();
  cache.set('_all_inputs',allInputs);

  // Pre-compute stok & harga per pakan dari data yang sudah di-fetch
  const stokMap={},hargaMap={};
  kiriman.forEach(k=>{
    if(!k.nama_pakan)return;
    stokMap[k.nama_pakan]=(stokMap[k.nama_pakan]||0)+(parseFloat(k.jumlah)||0);
  });
  allInputs.forEach(row=>{
    const d=row.data;if(!d||!d.pakan)return;
    d.pakan.forEach(p=>{if(p.kode)stokMap[p.kode]=(stokMap[p.kode]||0)-(parseFloat(p.jumlah)||0);});
  });
  // Harga terakhir per pakan
  const kirimanSorted=[...kiriman].sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
  kirimanSorted.forEach(k=>{if(k.nama_pakan&&!hargaMap[k.nama_pakan])hargaMap[k.nama_pakan]=parseFloat(k.harga_per_kg)||0;});

  const tbody=document.getElementById('stok-tbody');
  const empty=document.getElementById('stok-empty');
  tbody.innerHTML='';
  if(!pakans.length){empty.style.display='block';}
  else{
    empty.style.display='none';
    pakans.forEach(p=>{
      const stok=Math.max(0,stokMap[p.nama]||0);
      const min=parseFloat(p.stok_minimal)||0;
      const low=stok<=min;
      const pct=min>0?Math.min(100,Math.round((stok/min)*100)):100;
      const harga=hargaMap[p.nama]||0;
      const tr=document.createElement('tr');
      tr.innerHTML=
        '<td><strong>'+esc(p.nama)+'</strong></td>'+
        '<td>'+stok.toFixed(1)+' kg<div class="stok-bar"><div class="stok-bar-track"><div class="stok-bar-fill'+(low?' low':'')+'" style="width:'+Math.min(pct,100)+'%"></div></div><span class="stok-bar-pct">'+(min>0?pct+'%':'—')+'</span></div></td>'+
        '<td>'+(min||'—')+' kg</td>'+
        '<td>'+(harga?'Rp '+parseFloat(harga).toLocaleString('id-ID'):'—')+'</td>'+
        '<td>'+(low?'<span class="badge badge-red">Stok Rendah</span>':'<span class="badge badge-green">Aman</span>')+'</td>'+
        '<td>'+
          (can('KEUANGAN')?'<button class="btn-edit" onclick="openStokModal(\''+p.id+'\')">✏️</button>':'')+
          (can('KEUANGAN')?'<button class="btn-del" onclick="deletePakan(\''+p.id+'\')">🗑</button>':'')+
        '</td>';
      tbody.appendChild(tr);
    });
  }

  // Kiriman tabel — data sudah ada di kiriman
  const ktbody=document.getElementById('kiriman-tbody');
  const kempty=document.getElementById('kiriman-empty');
  ktbody.innerHTML='';
  if(!kiriman.length){kempty.style.display='block';}
  else{
    kempty.style.display='none';
    kiriman.slice(0,40).forEach(k=>{
      const tr=document.createElement('tr');
      const total=(parseFloat(k.jumlah)||0)*(parseFloat(k.harga_total)||0);
      const statusBayar=k.status_bayar||'belum';
      const statusBadge=statusBayar==='lunas'
        ?'<span class="badge badge-green">Lunas</span>'
        :statusBayar==='sebagian'
          ?`<span class="badge badge-orange">Sisa Rp ${parseFloat(k.sisa_tagihan||0).toLocaleString('id-ID')}</span>`
          :'<span class="badge badge-red">Belum Bayar</span>';
      tr.innerHTML='<td>'+fmtTgl(k.tanggal)+'</td><td>'+esc(k.nama_pakan)+'</td><td>'+k.jumlah+' kg</td><td>Rp '+parseFloat(k.harga_per_kg||0).toLocaleString('id-ID')+'/kg</td><td>Rp '+parseFloat(k.harga_total||0).toLocaleString('id-ID')+'</td><td>'+esc(k.keterangan||'—')+'</td>'+
        '<td>'+statusBadge+'</td>'+
        '<td style="white-space:nowrap">'+
          (can('JUAL')?'<button class="btn-edit" onclick="openKirimanEditModal(\''+k.id+'\')">✏️</button>':'')+
          (can('KEUANGAN')&&statusBayar!=='lunas'?'<button class="btn-add" style="padding:3px 8px;font-size:.75rem;margin:0 2px" onclick="openBayarModal(\''+k.id+'\')">💳 Bayar</button>':'')+
          (can('KEUANGAN')?'<button class="btn-del" onclick="deleteKiriman(\''+k.id+'\')">🗑</button>':'')+
        '</td>';
      ktbody.appendChild(tr);
    });
  }

  // Riwayat pemakaian — dari allInputs yang sudah di-fetch
  const pemakaian=[];
  allInputs.forEach(row=>{const d=row.data;if(!d||!d.pakan)return;d.pakan.forEach(p=>{if(p.kode&&p.jumlah)pemakaian.push({tgl:d.tanggal,kandang:d.kandang,pakan:p.kode,jumlah:p.jumlah});});});
  pemakaian.sort((a,b)=>b.tgl.localeCompare(a.tgl));
  const ptbody=document.getElementById('pakai-tbody');
  const pempty=document.getElementById('pakai-empty');
  ptbody.innerHTML='';
  if(!pemakaian.length){pempty.style.display='block';}
  else{pempty.style.display='none';pemakaian.slice(0,40).forEach(p=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+esc(p.tgl)+'</td><td>'+esc(p.kandang)+'</td><td>'+esc(p.pakan)+'</td><td>'+p.jumlah+' kg</td>';ptbody.appendChild(tr);});}

  // Section pembayaran — hanya manajer ke atas
  const canBayar=can('KEUANGAN');
  const secBayar=document.getElementById('section-pembayaran');
  const secPembelian=document.getElementById('section-pembelian');
  if(secBayar) secBayar.style.display=canBayar?'block':'none';
  if(secPembelian) secPembelian.style.display=canBayar?'block':'none';
  if(canBayar) {
    await renderPembayaran();
    await renderPembelian();
  }
}

// ═══ PEMBAYARAN PAKAN & PULLET ═══
async function renderPembayaran(){
  const list=await dbGetPembayaran({});
  const tbody=document.getElementById('bayar-tbody');
  const empty=document.getElementById('bayar-empty');
  if(!tbody)return;
  tbody.innerHTML='';
  if(!list.length){empty.style.display='block';return;}
  empty.style.display='none';
  list.slice(0,60).forEach(b=>{
    const statusSisa=b.sisa_tagihan>0
      ?`<span class="badge badge-orange">Sisa Rp ${parseFloat(b.sisa_tagihan).toLocaleString('id-ID')}</span>`
      :'<span class="badge badge-green">Lunas</span>';
    const tr=document.createElement('tr');
    tr.innerHTML=
      '<td>'+fmtTgl(b.tanggal)+'</td>'+
      '<td>'+(b.jenis==='pakan'?'🌾 Pakan':'🐔 Pullet')+'</td>'+
      '<td>'+esc(b.supplier||'—')+'</td>'+
      '<td style="font-weight:700;color:#1b4332">Rp '+parseFloat(b.jumlah_bayar).toLocaleString('id-ID')+'</td>'+
      '<td><span class="badge badge-gray">'+esc(b.metode)+'</span></td>'+
      '<td style="font-size:.8rem">'+esc(b.keterangan||'—')+'</td>'+
      '<td>'+statusSisa+'<button class="btn-del" style="margin-left:4px" onclick="deletePembayaran(\''+b.id+'\')">🗑</button></td>';
    tbody.appendChild(tr);
  });
}

// ═══ PEMBELIAN & TAGIHAN ═══
let currentPembTab = 'belum';

async function renderPembelian(){
  const kiriman = await dbGetKiriman({});
  const tbody = document.getElementById('pembelian-tbody');
  const empty = document.getElementById('pembelian-empty');
  if(!tbody) return;
  
  // Filter berdasarkan tab aktif
  let filteredData = kiriman;
  if(currentPembTab === 'belum') {
    filteredData = kiriman.filter(k => k.status_bayar !== 'lunas');
  } else if(currentPembTab === 'lunas') {
    filteredData = kiriman.filter(k => k.status_bayar === 'lunas');
  }
  
  tbody.innerHTML = '';
  if(!filteredData.length) {
    empty.style.display = 'block';
    empty.textContent = currentPembTab === 'belum' ? 'Tidak ada tagihan yang belum lunas.' : 
                       currentPembTab === 'lunas' ? 'Tidak ada tagihan yang sudah lunas.' : 
                       'Tidak ada data pembelian.';
    return;
  }
  
  empty.style.display = 'none';
  filteredData.slice(0,50).forEach(k => {
    const total = parseFloat(k.harga_total) || 0;
    const sisa = parseFloat(k.sisa_tagihan) || 0;
    const statusBayar = k.status_bayar || 'belum';
    
    let statusBadge, statusClass;
    if(statusBayar === 'lunas') {
      statusBadge = '<span class="badge badge-green">✅ Lunas</span>';
      statusClass = 'style="background:#f0fdf4"';
    } else if(statusBayar === 'sebagian') {
      statusBadge = `<span class="badge badge-orange">⏳ Sisa Rp ${sisa.toLocaleString('id-ID')}</span>`;
      statusClass = 'style="background:#fef3c7"';
    } else {
      statusBadge = `<span class="badge badge-red">❌ Belum Bayar</span>`;
      statusClass = 'style="background:#fee2e2"';
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = 
      `<td>${fmtTgl(k.tanggal)}</td>` +
      `<td>🌾 Pakan</td>` +
      `<td>${esc(k.supplier || '—')}</td>` +
      `<td>${esc(k.nama_pakan)} (${k.jumlah} kg)</td>` +
      `<td>${k.jumlah} kg</td>` +
      `<td style="font-weight:700;color:#1b4332">Rp ${total.toLocaleString('id-ID')}</td>` +
      `<td ${statusClass}>${statusBadge}</td>` +
      `<td>` +
        (statusBayar !== 'lunas' ? `<button class="btn-edit" onclick="openBayarModal('${k.id}')" title="Bayar">💳</button>` : '') +
        `<button class="btn-edit" onclick="editKiriman('${k.id}')" title="Edit" style="background:#ede9fe;color:#6d28d9;margin-left:4px">✏️</button>` +
        (can('KEUANGAN') ? `<button class="btn-del" onclick="deleteKiriman('${k.id}')" title="Hapus" style="margin-left:4px">🗑</button>` : '') +
      `</td>`;
    tbody.appendChild(tr);
  });
}

function switchPembTab(tab) {
  currentPembTab = tab;
  
  // Update tab buttons
  document.getElementById('pemb-tab-belum').classList.toggle('active', tab === 'belum');
  document.getElementById('pemb-tab-lunas').classList.toggle('active', tab === 'lunas');
  document.getElementById('pemb-tab-semua').classList.toggle('active', tab === 'semua');
  
  // Re-render table
  renderPembelian();
}

async function exportPembelian() {
  if(!can('EXPORT_LAP')) {
    showToast('⚠️ Tidak ada akses export!');
    return;
  }
  
  try {
    const kiriman = await dbGetKiriman({});
    const data = kiriman.map(k => ({
      'Tanggal': k.tanggal,
      'Supplier': k.supplier || '',
      'Nama Pakan': k.nama_pakan,
      'Jumlah (kg)': k.jumlah,
      'Harga per kg': k.harga_per_kg || 0,
      'Total Tagihan': k.harga_total || 0,
      'Status Bayar': k.status_bayar || 'belum',
      'Sisa Tagihan': k.sisa_tagihan || 0,
      'Keterangan': k.keterangan || '',
      'User Input': k.user_input || ''
    }));
    
    exportToCSV(data, `Laporan_Pembelian_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('✅ Laporan pembelian berhasil didownload!');
  } catch(e) {
    showToast('❌ Gagal export: ' + e.message);
  }
}

async function editKiriman(id) {
  if(!can('BIAYA')) {
    showToast('⚠️ Tidak ada akses edit kiriman!');
    return;
  }
  
  try {
    const kiriman = await dbGetKiriman({});
    const k = kiriman.find(x => x.id === id);
    if(!k) {
      showToast('❌ Data kiriman tidak ditemukan!');
      return;
    }
    
    // Populate form dengan data existing
    const pakans = await dbGetDaftarPakan();
    const sel = document.getElementById('mk2-pakan');
    sel.innerHTML = '';
    pakans.forEach(p => {
      const o = document.createElement('option');
      o.value = p.nama;
      o.textContent = p.nama;
      sel.appendChild(o);
    });
    
    // Set values
    document.getElementById('mk2-id').value = k.id;
    document.getElementById('mk2-tgl').value = k.tanggal;
    document.getElementById('mk2-pakan').value = k.nama_pakan;
    document.getElementById('mk2-jumlah').value = k.jumlah;
    document.getElementById('mk2-harga').value = k.harga_per_kg || 0;
    document.getElementById('mk2-supplier').value = k.supplier || '';
    document.getElementById('mk2-ket').value = k.keterangan || '';
    
    calcKirimanTotal();
    document.getElementById('modal-kiriman').style.display = 'flex';
    
  } catch(e) {
    showToast('❌ Gagal load data: ' + e.message);
  }
}

async function openBayarModal(kirimanId){
  if(!can('KEUANGAN')){showToast('⚠️ Hanya Manajer ke atas yang bisa catat pembayaran!');return;}
  // Reset form
  document.getElementById('mb-ref-id').value=kirimanId||'';
  document.getElementById('mb-tgl').value=new Date().toISOString().split('T')[0];
  document.getElementById('mb-jenis').value='pakan';
  document.getElementById('mb-supplier').value='';
  document.getElementById('mb-jumlah').value='';
  document.getElementById('mb-noref').value='';
  document.getElementById('mb-ket').value='';
  document.getElementById('mb-tagihan-total').value='';
  document.getElementById('mb-sisa').value='';
  document.getElementById('mb-sisa-setelah-wrap').style.display='none';

  // Populate dropdown tagihan kiriman belum lunas
  const kiriman=await dbGetKiriman({});
  const sel=document.getElementById('mb-tagihan');
  sel.innerHTML='<option value="">-- Pilih tagihan atau isi manual --</option>';
  kiriman.filter(k=>k.status_bayar!=='lunas').forEach(k=>{
    const sisa=parseFloat(k.sisa_tagihan)||parseFloat(k.harga_total)||0;
    const opt=document.createElement('option');
    opt.value=k.id;
    opt.dataset.total=k.harga_total||0;
    opt.dataset.sisa=sisa;
    opt.dataset.supplier=k.supplier||'';
    opt.textContent=`${fmtTgl(k.tanggal)} — ${k.nama_pakan} ${k.jumlah}kg — Sisa Rp ${sisa.toLocaleString('id-ID')}`;
    sel.appendChild(opt);
  });

  // Jika dipanggil dari tombol kiriman tertentu
  if(kirimanId){
    sel.value=kirimanId;
    onTagihanSelect();
  }
  document.getElementById('modal-bayar').style.display='flex';
}

function onBayarJenisChange(){
  const jenis=document.getElementById('mb-jenis').value;
  document.getElementById('mb-tagihan-wrap').style.display=jenis==='pakan'?'block':'none';
  if(jenis==='pullet'){
    document.getElementById('mb-tagihan-total').removeAttribute('readonly');
    document.getElementById('mb-sisa').removeAttribute('readonly');
  } else {
    document.getElementById('mb-tagihan-total').setAttribute('readonly','');
    document.getElementById('mb-sisa').setAttribute('readonly','');
  }
}

function onTagihanSelect(){
  const sel=document.getElementById('mb-tagihan');
  const opt=sel.options[sel.selectedIndex];
  if(opt&&opt.value){
    document.getElementById('mb-tagihan-total').value=opt.dataset.total||0;
    document.getElementById('mb-sisa').value=opt.dataset.sisa||0;
    document.getElementById('mb-supplier').value=opt.dataset.supplier||'';
  } else {
    document.getElementById('mb-tagihan-total').value='';
    document.getElementById('mb-sisa').value='';
  }
  calcSisaBayar();
}

function calcSisaBayar(){
  const sisa=parseFloat(document.getElementById('mb-sisa').value)||0;
  const bayar=parseFloat(document.getElementById('mb-jumlah').value)||0;
  const wrap=document.getElementById('mb-sisa-setelah-wrap');
  const el=document.getElementById('mb-sisa-setelah');
  if(bayar>0){
    const sisaSetelah=Math.max(0,sisa-bayar);
    wrap.style.display='block';
    el.textContent='Rp '+sisaSetelah.toLocaleString('id-ID');
    el.style.color=sisaSetelah<=0?'#16a34a':'#dc2626';
  } else {
    wrap.style.display='none';
  }
}

async function savePembayaran(){
  const tanggal=document.getElementById('mb-tgl').value;
  const jenis=document.getElementById('mb-jenis').value;
  const supplier=document.getElementById('mb-supplier').value.trim();
  const jumlah_bayar=parseFloat(document.getElementById('mb-jumlah').value)||0;
  const jumlah_tagihan=parseFloat(document.getElementById('mb-tagihan-total').value)||0;
  const sisa_sebelum=parseFloat(document.getElementById('mb-sisa').value)||0;
  const sisa_tagihan=Math.max(0,sisa_sebelum-jumlah_bayar);
  const metode=document.getElementById('mb-metode').value;
  const no_referensi=document.getElementById('mb-noref').value.trim();
  const keterangan=document.getElementById('mb-ket').value.trim();
  const refId=document.getElementById('mb-ref-id').value||document.getElementById('mb-tagihan').value||null;

  if(!tanggal){showToast('⚠️ Tanggal wajib diisi!');return;}
  if(!supplier){showToast('⚠️ Nama supplier wajib diisi!');return;}
  if(!jumlah_bayar||jumlah_bayar<=0){showToast('⚠️ Jumlah bayar harus lebih dari 0!');return;}
  if(jumlah_tagihan>0&&jumlah_bayar>sisa_sebelum){
    showToast(`⚠️ Jumlah bayar (Rp ${jumlah_bayar.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${sisa_sebelum.toLocaleString('id-ID')})!`);return;
  }

  showToast('⏳ Menyimpan...');
  try{
    await dbSavePembayaran({
      tanggal,jenis,supplier,
      referensi_id:refId||null,
      jumlah_tagihan,jumlah_bayar,sisa_tagihan,
      metode,no_referensi:no_referensi||null,
      keterangan:keterangan||null,
      user_input:currentUser?.username||''
    });
    if(refId) await dbUpdateStatusTagihan(refId,jumlah_bayar);
    closeModal('modal-bayar');
    await renderGudang();
    await dbSaveLog('TAMBAH','pembayaran',null,null,
      {tanggal,jenis,supplier,jumlah_bayar,metode},
      `Pembayaran ${jenis}: ${supplier} Rp ${jumlah_bayar.toLocaleString('id-ID')} via ${metode}`);
    showToast('✅ Pembayaran dicatat!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function deletePembayaran(id){
  if(!can('KEUANGAN')){showToast('⚠️ Tidak ada akses!');return;}
  if(!confirm('Hapus data pembayaran ini?'))return;
  try{
    const list=await dbGetPembayaran({});
    const b=list.find(x=>x.id===id);
    await dbDeletePembayaran(id);
    await renderGudang();
    await dbSaveLog('HAPUS','pembayaran',id,b,null,
      `Hapus pembayaran: ${b?.supplier||'—'} Rp ${(b?.jumlah_bayar||0).toLocaleString('id-ID')}`);
    showToast('🗑 Pembayaran dihapus.');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function openStokModal(id){
  const pakans=cache.get('daftar_pakan')||await dbGetDaftarPakan();
  const p=id?pakans.find(x=>x.id===id):null;
  document.getElementById('modal-stok-title').textContent=p?'Edit Pakan':'Daftarkan Pakan';
  document.getElementById('ms-id').value=p?p.id:'';
  document.getElementById('ms-nama').value=p?p.nama:'';
  document.getElementById('ms-min').value=p?p.stok_minimal:'';
  document.getElementById('modal-stok').style.display='flex';
}
async function saveStok(){
  const nama=document.getElementById('ms-nama').value.trim();
  const min=parseFloat(document.getElementById('ms-min').value)||0;
  if(!nama){showToast('⚠️ Nama pakan wajib diisi!');return;}
  if(nama.length<2){showToast('⚠️ Nama pakan minimal 2 karakter!');return;}
  if(min<0){showToast('⚠️ Minimum stok tidak boleh negatif!');return;}
  const id=document.getElementById('ms-id').value;
  const obj={nama,stok_minimal:min};
  if(id)obj.id=id;
  try{await dbSaveDaftarPakan(obj);closeModal('modal-stok');await renderGudang();
    await dbSaveLog(id?'EDIT':'TAMBAH','daftar_pakan',obj.id||null,null,obj,`${id?'Edit':'Tambah'} pakan: ${nama}`);
    showToast('✅ Pakan disimpan!');}
  catch(e){showToast('❌ Gagal: '+e.message);}
}
async function openKirimanModal(){
  const pakans=await dbGetDaftarPakan();
  if(!pakans.length){showToast('⚠️ Daftarkan pakan terlebih dahulu!');return;}
  const sel=document.getElementById('mk2-pakan');
  sel.innerHTML='';pakans.forEach(p=>{const o=document.createElement('option');o.value=p.nama;o.textContent=p.nama;sel.appendChild(o);});
  document.getElementById('mk2-id').value='';
  document.getElementById('mk2-tgl').value=new Date().toISOString().split('T')[0];
  document.getElementById('mk2-jumlah').value='';
  document.getElementById('mk2-harga').value='';
  document.getElementById('mk2-total').value='';
  document.getElementById('mk2-ket').value='';
  document.getElementById('modal-kiriman').style.display='flex';
}
function calcKirimanTotal(){
  const j=parseFloat(document.getElementById('mk2-jumlah').value)||0;
  const h=parseFloat(document.getElementById('mk2-harga').value)||0;
  document.getElementById('mk2-total').value=j&&h?'Rp '+(j*h).toLocaleString('id-ID'):'';
}
async function saveKiriman(){
  const tanggal=document.getElementById('mk2-tgl').value;
  const nama_pakan=document.getElementById('mk2-pakan').value;
  const jumlah=parseFloat(document.getElementById('mk2-jumlah').value)||0;
  const harga_per_kg=parseFloat(document.getElementById('mk2-harga').value)||0;
  const harga_total=jumlah*harga_per_kg;
  const supplier=document.getElementById('mk2-supplier').value.trim();
  const keterangan=document.getElementById('mk2-ket').value;
  const editId=document.getElementById('mk2-id').value;

  if(!tanggal){showToast('⚠️ Tanggal wajib diisi!');return;}
  if(!nama_pakan){showToast('⚠️ Pilih jenis pakan!');return;}
  if(!jumlah||jumlah<=0){showToast('⚠️ Jumlah harus lebih dari 0!');return;}
  if(harga_per_kg<=0){showToast('⚠️ Harga per kg wajib diisi!');return;}
  if(!supplier){showToast('⚠️ Nama supplier wajib diisi!');return;}

  try{
    if(editId){
      await SB.update('kiriman_pakan',{tanggal,nama_pakan,jumlah,harga_per_kg,harga_total,supplier,keterangan,sisa_tagihan:harga_total},`?id=eq.${editId}`);
      cache.del('kiriman_pakan');
    }else{
      await dbSaveKiriman({tanggal,nama_pakan,jumlah,harga_per_kg,harga_total,supplier,keterangan,sisa_tagihan:harga_total,status_bayar:'belum',user_input:currentUser?.username||''});
    }
    closeModal('modal-kiriman');await renderGudang();
    await dbSaveLog(editId?'EDIT':'TAMBAH','kiriman_pakan',editId||null,null,
      {tanggal,nama_pakan,jumlah,harga_per_kg,harga_total,supplier},
      `${editId?'Edit':'Tambah'} kiriman: ${nama_pakan} ${jumlah}kg dari ${supplier||'—'}`);
    showToast(editId?'✅ Kiriman diperbarui!':'✅ Kiriman pakan dicatat sebagai tagihan!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}
// Edit kiriman — supervisor ke atas boleh
async function openKirimanEditModal(id){
  if(!can('JUAL')){showToast('⚠️ Tidak ada akses!');return;}
  const kiriman=await dbGetKiriman({});
  const k=kiriman.find(x=>x.id===id);
  if(!k)return;
  const pakans=await dbGetDaftarPakan();
  const sel=document.getElementById('mk2-pakan');
  sel.innerHTML='';
  pakans.forEach(p=>{const o=document.createElement('option');o.value=p.nama;o.textContent=p.nama;sel.appendChild(o);});
  document.getElementById('mk2-id').value=k.id;
  document.getElementById('mk2-tgl').value=k.tanggal||'';
  sel.value=k.nama_pakan||'';
  document.getElementById('mk2-jumlah').value=k.jumlah||'';
  document.getElementById('mk2-harga').value=k.harga_per_kg||'';
  calcKirimanTotal();
  document.getElementById('mk2-ket').value=k.keterangan||'';
  document.getElementById('modal-kiriman').style.display='flex';
}

// ═══ HOME ═══
async function renderHome(){
  const list=await dbGetKandang();
  cache.set('kandang_list',list);
  const aktif=list.filter(k=>k.status==='Aktif');
  document.getElementById('hs-kandang').textContent=aktif.length;
  const totalPop=aktif.reduce((s,k)=>s+(parseInt(k.populasi)||0),0);
  document.getElementById('hs-populasi').textContent=totalPop.toLocaleString('id-ID');
  const today=new Date().toISOString().split('T')[0];
  const todayInputs=await dbGetInput({tanggal:today});
  let totalProd=0;
  todayInputs.forEach(row=>{const d=row.data;if(d&&d.produksi)totalProd+=parseInt(d.produksi.total.butir)||0;});
  const juals=await dbGetPenjualan({dari:today,sampai:today});
  const totalJual=juals.reduce((s,j)=>s+(parseInt(j.grand_total)||0),0);
  document.getElementById('hs-produksi').textContent=totalProd.toLocaleString('id-ID');
  document.getElementById('hs-penjualan').textContent='Rp '+totalJual.toLocaleString('id-ID');
  const actEl=document.getElementById('home-activity');
  const recent=await dbGetInput({});
  const last5=recent.slice(0,5);
  if(!last5.length){actEl.innerHTML='<div style="color:#aaa;font-size:.85rem;text-align:center;padding:12px 0">Belum ada data tersimpan.</div>';}
  else{
    actEl.innerHTML='<table class="tbl"><thead><tr><th>Tanggal</th><th>Kandang</th><th>Produksi</th><th>HDP</th></tr></thead><tbody>'+
    last5.map(row=>{const d=row.data;if(!d)return'';return'<tr><td>'+fmtTgl(d.tanggal)+'</td><td>'+esc(d.kandang)+'</td><td>'+(d.produksi?d.produksi.total.butir+' butir':'—')+'</td><td>'+(d.produksi?d.produksi.hdp:'—')+'</td></tr>';}).join('')+
    '</tbody></table>';
  }
  // Status kandang
  const klEl=document.getElementById('home-kandang-list');
  if(!list.length){klEl.innerHTML='<div style="color:#aaa;font-size:.85rem;text-align:center;padding:12px 0">Belum ada kandang.</div>';}
  else{
    klEl.innerHTML='<table class="tbl"><thead><tr><th>Kandang</th><th>Populasi</th><th>Periode</th><th>Hari ke-</th><th>Status</th></tr></thead><tbody>'+
    list.map(k=>{
      const diff=k.chickin?Math.floor((new Date()-new Date(k.chickin))/86400000)+1:0;
      return'<tr><td><strong>'+esc(k.nama)+'</strong></td><td>'+(k.populasi||0)+' ekor</td><td>'+fmtTgl(k.chickin)+'</td><td>'+(diff>0?diff:'—')+'</td><td>'+(k.status==='Aktif'?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-gray">Selesai</span>')+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  // Render daily summary & alerts (async, tidak block render utama)
  renderDailySummary(todayInputs, list);
  renderHomeAlerts();
}

// ═══ DAILY PERFORMANCE SUMMARY ═══
async function renderDailySummary(todayInputs, kandangList){
  const today=new Date().toISOString().split('T')[0];
  const kList=kandangList||cache.get('kandang_list')||await dbGetKandang();

  // Populate selector kandang
  const sel=document.getElementById('ds-kandang-sel');
  if(sel&&sel.options.length<=1){
    sel.innerHTML='<option value="">Semua Kandang</option>';
    kList.filter(k=>k.status==='Aktif').forEach(k=>{
      const o=document.createElement('option');o.value=k.nama;o.textContent=k.nama;sel.appendChild(o);
    });
  }
  const selectedKandang=sel?sel.value:'';

  // Tanggal header
  const tglFmt=fmtTglPanjang(today);
  const dsDate=document.getElementById('ds-date');
  if(dsDate)dsDate.textContent=tglFmt;

  // Ambil data hari ini & kemarin
  const inputs=todayInputs||await dbGetInput({tanggal:today});
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yd=yesterday.toISOString().split('T')[0];
  const yInputs=await dbGetInput({tanggal:yd});

  // Filter per kandang jika dipilih
  const filtered=selectedKandang?inputs.filter(r=>r.kandang===selectedKandang):inputs;
  const yFiltered=selectedKandang?yInputs.filter(r=>r.kandang===selectedKandang):yInputs;

  const bodyEl=document.getElementById('ds-body');
  if(!filtered.length){
    bodyEl.innerHTML='<div style="color:#aaa;font-size:.85rem;text-align:center;padding:20px">Belum ada data input hari ini'+(selectedKandang?' untuk '+esc(selectedKandang):'')+'.</div>';
    document.getElementById('ds-footer-note').textContent='Belum ada data';
    document.getElementById('ds-hari-ke').textContent='';
    return;
  }

  // ── Agregat hari ini ──
  let totalButir=0,totalKg=0,totalSisa=0,totalDeplesi=0,totalPakanKg=0,totalAirL=0;
  let hdpSum=0,hdpCount=0,ewSum=0,ewCount=0,fiSum=0,fiCount=0,waterMlSum=0,waterCount=0,rasioSum=0,rasioCount=0;

  filtered.forEach(r=>{
    const d=r.data;if(!d)return;
    totalButir+=parseInt(d.produksi?.total?.butir)||0;
    totalKg+=parseFloat(d.produksi?.total?.kilo)||0;
    totalSisa+=parseInt(d.sisa_ayam)||0;
    totalDeplesi+=(parseInt(d.deplesi?.mati)||0)+(parseInt(d.deplesi?.afkir)||0);
    const pakanRow=(d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0);
    totalPakanKg+=pakanRow;
    totalAirL+=parseFloat(d.air_liter)||0;
    const hdp=parseFloat(d.produksi?.hdp)||0;
    if(hdp>0){hdpSum+=hdp;hdpCount++;}
    // EW (Egg Weight) = berat rata-rata per butir gram
    const ew=parseFloat(d.produksi?.berat_rata)||0;
    if(ew>0){ewSum+=ew;ewCount++;}
    // FI (Feed Intake) = gr/ekor = (pakan kg * 1000) / sisa ayam
    const sisa=parseInt(d.sisa_ayam)||0;
    if(sisa>0&&pakanRow>0){fiSum+=(pakanRow*1000/sisa);fiCount++;}
    // Water intake ml/ekor
    const airMl=parseFloat(d.air_liter)*1000||0;
    if(sisa>0&&airMl>0){waterMlSum+=(airMl/sisa);waterCount++;}
    // Rasio air:pakan
    const rasio=parseFloat(d.air_rasio)||0;
    if(rasio>0){rasioSum+=rasio;rasioCount++;}
  });

  // ── Agregat kemarin (untuk trend) ──
  let yDeplesi=0,yHdpSum=0,yHdpCount=0,yTotalSisa=0;
  yFiltered.forEach(r=>{
    const d=r.data;if(!d)return;
    yDeplesi+=(parseInt(d.deplesi?.mati)||0)+(parseInt(d.deplesi?.afkir)||0);
    yTotalSisa+=parseInt(d.sisa_ayam)||0;
    const hdp=parseFloat(d.produksi?.hdp)||0;
    if(hdp>0){yHdpSum+=hdp;yHdpCount++;}
  });

  // ── Kalkulasi final ──
  const avgHDP=hdpCount>0?(hdpSum/hdpCount):0;
  const yAvgHDP=yHdpCount>0?(yHdpSum/yHdpCount):0;
  const avgEW=ewCount>0?(ewSum/ewCount):0;
  const avgFI=fiCount>0?(fiSum/fiCount):0;
  const avgWater=waterCount>0?(waterMlSum/waterCount):0;
  const avgRasio=rasioCount>0?(rasioSum/rasioCount):0;

  // Deplesi % hari ini vs kemarin
  const deplesiPct=totalSisa>0?((totalDeplesi/(totalSisa+totalDeplesi))*100):0;
  const yDeplesiPct=yTotalSisa>0?((yDeplesi/(yTotalSisa+yDeplesi))*100):0;

  // FCR = total pakan kg / total telur kg
  const fcr=totalKg>0?(totalPakanKg/totalKg):0;

  // Umur ayam dari kandang
  let umurMinggu='—',umurHari='—',hariKeProd='—';
  const refKandang=kList.find(k=>k.nama===(selectedKandang||filtered[0]?.kandang));
  if(refKandang?.chickin&&refKandang?.umur_masuk){
    const hariSejak=Math.floor((new Date(today)-new Date(refKandang.chickin))/86400000);
    const totalHari=(refKandang.umur_masuk||0)+hariSejak;
    umurMinggu=Math.floor(totalHari/7)+'w';
    umurHari=(totalHari%7)+'d';
    hariKeProd='Hari ke-'+(hariSejak+1);
  }
  const dsHariKe=document.getElementById('ds-hari-ke');
  if(dsHariKe)dsHariKe.textContent=hariKeProd;

  // ── Helper trend ──
  const trend=(now,prev)=>{
    if(!prev||!now)return'';
    const diff=now-prev;
    if(Math.abs(diff)<0.01)return'<span class="trend-flat">→ sama</span>';
    return diff>0
      ?'<span class="trend-up">▲ +'+(Math.abs(diff).toFixed(2))+'</span>'
      :'<span class="trend-down">▼ '+(Math.abs(diff).toFixed(2))+'</span>';
  };
  const trendHDP=trend(avgHDP,yAvgHDP);
  const trendDeplesi=trend(deplesiPct,yDeplesiPct);

  // ── Rating helpers ──
  const hdpClass=avgHDP>=80?'val-good':avgHDP>=65?'val-warn':'val-bad';
  const fcrClass=fcr>0?(fcr<=2.0?'val-good':fcr<=2.5?'val-warn':'val-bad'):'';
  const deplesiClass=deplesiPct<=0.05?'val-good':deplesiPct<=0.1?'val-warn':'val-bad';

  // ── Render tabel ──
  bodyEl.innerHTML=`
  <table class="perf-table">
    <tr class="section-head"><td colspan="3">🐔 Populasi</td></tr>
    <tr><td>Umur Ayam</td><td>${umurMinggu} ${umurHari}</td><td>minggu + hari</td></tr>
    <tr><td>Populasi</td><td>${totalSisa.toLocaleString('id-ID')}</td><td>ekor</td></tr>

    <tr class="section-head"><td colspan="3">📉 Deplesi</td></tr>
    <tr><td>Deplesi Hari Ini</td><td class="${deplesiClass}">${totalDeplesi} ekor (${deplesiPct.toFixed(3)}%)</td><td>${trendDeplesi||'—'}</td></tr>

    <tr class="section-head"><td colspan="3">🌾 Pakan & Air</td></tr>
    <tr><td>FI (Feed Intake)</td><td>${avgFI>0?avgFI.toFixed(1):'—'}</td><td>gr/ekor</td></tr>
    <tr><td>Water Intake</td><td>${avgWater>0?avgWater.toFixed(0):'—'}</td><td>ml/ekor</td></tr>
    <tr><td>Rasio Air:Pakan</td><td>${avgRasio>0?avgRasio.toFixed(2):'—'}</td><td>:1</td></tr>

    <tr class="section-head"><td colspan="3">🥚 Produksi Telur</td></tr>
    <tr><td>EW (Egg Weight)</td><td>${avgEW>0?avgEW.toFixed(1):'—'}</td><td>gr/butir</td></tr>
    <tr><td>HD% (Hen Day)</td><td class="${hdpClass}">${avgHDP>0?avgHDP.toFixed(1)+'%':'—'}</td><td>${trendHDP||'—'}</td></tr>
    <tr><td>Total Produksi</td><td>${totalButir.toLocaleString('id-ID')} butir</td><td>${totalKg.toFixed(2)} kg</td></tr>

    <tr class="section-head"><td colspan="3">📊 Efisiensi</td></tr>
    <tr><td>FCR</td><td class="${fcrClass}">${fcr>0?fcr.toFixed(3):'—'}</td><td>${fcr>0?(fcr<=2.0?'✅ Baik':fcr<=2.5?'⚠️ Cukup':'❌ Buruk'):'—'}</td></tr>
  </table>`;

  // Footer
  const now=new Date();
  document.getElementById('ds-footer-note').textContent=
    (selectedKandang||'Semua Kandang')+' · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}

// ═══ CAPTURE SUMMARY ═══
async function captureSummary(){
  if(typeof html2canvas==='undefined'){
    showToast('⏳ Memuat library capture...');
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload=res;s.onerror=rej;
      document.head.appendChild(s);
    });
  }
  showToast('📸 Mengambil screenshot...');
  const el=document.getElementById('daily-summary');
  try{
    const btn=el.querySelector('.btn-capture');
    if(btn)btn.style.visibility='hidden';
    const canvas=await html2canvas(el,{
      backgroundColor:document.body.classList.contains('dark')?'#1e293b':'#ffffff',
      scale:2,useCORS:true,logging:false
    });
    if(btn)btn.style.visibility='visible';
    const a=document.createElement('a');
    a.download='performa_harian_'+new Date().toISOString().split('T')[0]+'.png';
    a.href=canvas.toDataURL('image/png');
    a.click();
    showToast('✅ Screenshot tersimpan!');
  }catch(e){
    const btn=el.querySelector('.btn-capture');
    if(btn)btn.style.visibility='visible';
    showToast('❌ Gagal capture: '+e.message);
  }
}

// ═══ SETTINGS — KANDANG ═══
function renderSettings(){
  const isSuperadmin = currentUser?.role === 'superadmin';
  const isManager    = can('KEUANGAN');

  // Tab Master — manajer ke atas
  const tabMaster = document.getElementById('stab-master');
  if(tabMaster) tabMaster.style.display = isManager ? '' : 'none';

  // Tab Backup — superadmin only
  const tabBackup = document.getElementById('stab-backup');
  if(tabBackup) tabBackup.style.display = isSuperadmin ? '' : 'none';

  switchSTab('kandang');
}

let currentSTab='kandang';
function switchSTab(tab){
  currentSTab=tab;
  ['kandang','user','master','backup'].forEach(t=>{
    const btn = document.getElementById('stab-'+t);
    const content = document.getElementById('stab-content-'+t);
    if(btn) btn.classList.toggle('active',t===tab);
    if(content) content.style.display=t===tab?'block':'none';
  });
  if(tab==='kandang') renderKandangTable();
  if(tab==='user') renderUserTable();
  if(tab==='master') renderMaster();
  if(tab==='backup') loadCacheInfo();
}

async function renderKandangTable(){
  const list=await dbGetKandang();
  cache.set('kandang_list',list);
  const tbody=document.getElementById('kandang-tbody');
  const empty=document.getElementById('kandang-empty');
  tbody.innerHTML='';
  if(!list.length){empty.style.display='block';return;}
  empty.style.display='none';
  list.forEach((k,i)=>{
    const cin=k.chickin?new Date(k.chickin):null;
    const days=cin?Math.floor((new Date()-cin)/86400000):0;
    const periode=k.chickin?(k.status==='Aktif'?'Hari ke-'+(days+1)+' (berjalan)':days+' hari'):'—';
    const tr=document.createElement('tr');
    tr.innerHTML='<td><strong>'+esc(k.nama)+'</strong></td><td>'+(k.kapasitas||'—')+' ekor</td><td>'+fmtTgl(k.chickin)+'</td><td>'+(k.umur_masuk?k.umur_masuk+' hari':'—')+'</td><td>'+(k.populasi||'—')+' ekor</td><td style="font-size:.8rem">'+periode+'</td><td>'+(k.status==='Aktif'?'<span class="badge badge-green">Aktif</span>':'<span class="badge badge-gray">Selesai</span>')+'</td><td style="white-space:nowrap">'+
      '<button class="btn-edit" onclick="openKandangModal(\''+k.id+'\')">✏️</button>'+
      (can('KEUANGAN')
        ?'<button class="btn-del" onclick="deleteKandang(\''+k.id+'\')" title="Hapus Kandang">🗑</button>'
        :'<button class="btn-del" data-no-access onclick="deleteKandang(\''+k.id+'\')" title="Butuh izin Manajer/Admin">🔒</button>')+
      '<button class="btn-edit" style="background:#ede9fe;color:#6d28d9" onclick="showRingkasanSiklus(\''+esc(k.nama)+'\')">📋</button>'+
      '</td>';
    tbody.appendChild(tr);
  });
}

function openKandangModal(id){
  const list=cache.get('kandang_list')||[];
  const k=id?list.find(x=>x.id===id):null;
  document.getElementById('modal-kandang-title').textContent=k?'Edit Kandang':'Tambah Kandang';
  document.getElementById('mk-id').value=k?k.id:'';
  document.getElementById('mk-nama').value=k?k.nama:'';
  document.getElementById('mk-kapasitas').value=k?k.kapasitas:'';
  document.getElementById('mk-chickin').value=k?k.chickin:'';
  document.getElementById('mk-umur').value=k?(k.umur_masuk||0):0;
  document.getElementById('mk-populasi').value=k?k.populasi:'';
  document.getElementById('mk-harga-pullet').value=k?(k.harga_pullet||0):0;
  document.getElementById('mk-status').value=k?k.status:'Aktif';
  document.getElementById('modal-kandang').style.display='flex';
  calcUmurKandang();
}

function calcUmurKandang(){
  const chickin=document.getElementById('mk-chickin').value;
  const umurMasuk=parseInt(document.getElementById('mk-umur').value)||0;
  const preview=document.getElementById('mk-umur-preview');
  if(!chickin){preview.textContent='';return;}
  const today=new Date();today.setHours(0,0,0,0);
  const cin=new Date(chickin);cin.setHours(0,0,0,0);
  const hariSejak=Math.floor((today-cin)/86400000);
  const totalHari=umurMasuk+(hariSejak>=0?hariSejak:0);
  const mg=Math.floor(totalHari/7);
  const hr=totalHari%7;
  preview.textContent=`📅 Umur hari ini: ${mg} mg ${hr} hari (${totalHari} hari total)`;
}

async function saveKandang(){
  const nama=document.getElementById('mk-nama').value.trim();
  const kapasitas=parseInt(document.getElementById('mk-kapasitas').value)||0;
  const populasi=parseInt(document.getElementById('mk-populasi').value)||0;
  const chickin=document.getElementById('mk-chickin').value||null;

  if(!nama){showToast('⚠️ Nama kandang wajib diisi!');return;}
  if(kapasitas<=0){showToast('⚠️ Kapasitas harus lebih dari 0!');return;}
  if(populasi<=0){showToast('⚠️ Populasi masuk harus lebih dari 0!');return;}
  if(populasi>kapasitas){showToast('⚠️ Populasi tidak boleh melebihi kapasitas!');return;}
  if(chickin){
    const today=new Date().toISOString().split('T')[0];
    if(chickin>today){showToast('⚠️ Tanggal Periode tidak boleh di masa depan!');return;}
  }

  const id=document.getElementById('mk-id').value;
  const obj={
    nama,
    kapasitas,
    chickin,
    umur_masuk:parseInt(document.getElementById('mk-umur').value)||null,
    populasi,
    harga_pullet:parseFloat(document.getElementById('mk-harga-pullet').value)||null,
    status:document.getElementById('mk-status').value
  };
  if(id)obj.id=id;
  showToast('⏳ Menyimpan...');
  try{
    await dbSaveKandang(obj);
    closeModal('modal-kandang');
    await renderKandangTable();
    await populateKandangSelects();
    await dbSaveLog(id?'EDIT':'TAMBAH','kandang',obj.id||null,null,obj,
      `${id?'Edit':'Tambah'} kandang: ${nama}`);
    showToast('✅ Kandang disimpan!');
  }catch(e){showToast('❌ Gagal menyimpan: '+e.message);}
}

// ═══ SETTINGS — USER ═══
async function renderUserTable(){
  const isSuperadmin = currentUser?.role === 'superadmin';
  const isAdmin      = currentUser?.role === 'admin' || isSuperadmin;
  document.getElementById('user-noaccess').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('user-section').style.display  = isAdmin ? 'block' : 'none';
  if(!isAdmin) return;

  const users = await dbGetUsers();
  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '';

  const roleBadge = {
    superadmin: '<span class="badge" style="background:#1e1b4b;color:#a5b4fc">⭐ Superadmin</span>',
    admin:      '<span class="badge badge-blue">Admin</span>',
    manajer:    '<span class="badge badge-green">Manajer</span>',
    supervisor: '<span class="badge" style="background:#ede9fe;color:#6d28d9">Supervisor</span>',
    operator:   '<span class="badge badge-orange">Operator</span>',
    staff:      '<span class="badge badge-gray">Staff</span>',
    viewer:     '<span class="badge" style="background:#f1f5f9;color:#64748b">👁 Viewer</span>'
  };

  users.forEach(u => {
    const isSelf            = u.username === currentUser.username;
    const targetIsSuperadmin = u.role === 'superadmin';
    const isActive          = u.active !== false;

    // Superadmin tidak bisa diedit kecuali oleh dirinya sendiri
    const canEdit = isSelf || (isSuperadmin && !targetIsSuperadmin) || (!targetIsSuperadmin && isAdmin);

    // Hapus permanen: hanya superadmin, dan tidak bisa hapus diri sendiri atau superadmin lain
    const canHardDelete = isSuperadmin && !targetIsSuperadmin && !isSelf;

    // Nonaktifkan (soft-delete): admin bisa, tapi tidak bisa ke superadmin atau diri sendiri
    const canSoftDelete = isAdmin && !targetIsSuperadmin && !isSelf && isActive;

    // Aktifkan kembali: admin bisa aktifkan user yang nonaktif
    const canActivate = isAdmin && !targetIsSuperadmin && !isSelf && !isActive;

    const statusBadge = isActive
      ? '<span class="badge badge-green">Aktif</span>'
      : '<span class="badge badge-gray">Nonaktif</span>';

    let aksiHtml = '';
    if(canEdit)        aksiHtml += `<button class="btn-edit" onclick="openUserModal('${u.id}')" title="Edit">✏️</button>`;
    if(canSoftDelete)  aksiHtml += `<button class="btn-del" style="background:#fef3c7;color:#92400e" onclick="softDeleteUser('${u.id}','${esc(u.username)}')" title="Nonaktifkan">🚫</button>`;
    if(canActivate)    aksiHtml += `<button class="btn-edit" style="background:#d8f3dc;color:#1b4332" onclick="activateUser('${u.id}','${esc(u.username)}')" title="Aktifkan kembali">✅</button>`;
    if(canHardDelete)  aksiHtml += `<button class="btn-del" onclick="deleteUser('${u.id}','${esc(u.username)}')" title="Hapus permanen">🗑</button>`;

    const tr = document.createElement('tr');
    // Baris user nonaktif ditampilkan lebih redup
    if(!isActive) tr.style.opacity = '0.55';
    tr.innerHTML =
      `<td><strong>${esc(u.username)}</strong>${targetIsSuperadmin?' 🔒':''}</td>`+
      `<td>${roleBadge[u.role] || `<span class="badge badge-gray">${esc(u.role)}</span>`}</td>`+
      `<td>${statusBadge}</td>`+
      `<td>${aksiHtml}</td>`;
    tbody.appendChild(tr);
  });
}

async function openUserModal(id){
  const users=await dbGetUsers();
  const u=id?users.find(x=>x.id===id):null;
  // superadmin hanya bisa edit dirinya sendiri
  if(u?.role==='superadmin'&&currentUser?.role!=='superadmin'){showToast('🔒 Tidak bisa mengedit Superadmin!');return;}
  document.getElementById('modal-user-title').textContent=u?'Edit User':'Tambah User';
  document.getElementById('mu-id').value=u?u.id:'';
  document.getElementById('mu-username').value=u?u.username:'';
  document.getElementById('mu-password').value=u?u.password:'';
  // Tampilkan opsi superadmin hanya jika login sebagai superadmin
  const roleSelect=document.getElementById('mu-role');
  const hasSuperadmin=roleSelect.querySelector('option[value="superadmin"]');
  if(currentUser?.role==='superadmin'&&!hasSuperadmin){
    const opt=document.createElement('option');opt.value='superadmin';opt.textContent='⭐ Superadmin';
    roleSelect.insertBefore(opt,roleSelect.firstChild);
  } else if(currentUser?.role!=='superadmin'&&hasSuperadmin){
    roleSelect.removeChild(hasSuperadmin);
  }
  roleSelect.value=u?u.role:'operator';
  document.getElementById('modal-user').style.display='flex';
}

async function saveUser(){
  const uname=document.getElementById('mu-username').value.trim();
  const pw=document.getElementById('mu-password').value.trim();
  const id=document.getElementById('mu-id').value;

  if(!uname){showToast('⚠️ Username wajib diisi!');return;}
  if(!/^[a-zA-Z0-9_]+$/.test(uname)){showToast('⚠️ Username hanya boleh huruf, angka, dan underscore!');return;}
  if(uname.length<3){showToast('⚠️ Username minimal 3 karakter!');return;}
  if(!pw){showToast('⚠️ Password wajib diisi!');return;}
  if(pw.length<6){showToast('⚠️ Password minimal 6 karakter!');return;}

  const obj={username:uname,password:pw,role:document.getElementById('mu-role').value,active:true};
  if(id)obj.id=id;
  showToast('⏳ Menyimpan...');
  try{
    await dbSaveUser(obj);
    closeModal('modal-user');
    await renderUserTable();
    await dbSaveLog(id?'EDIT':'TAMBAH','users',obj.id||null,null,
      {username:uname,role:obj.role},
      `${id?'Edit':'Tambah'} user: ${uname} (${obj.role})`);
    showToast('✅ User disimpan!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

// ═══ UTILS ═══
function closeModal(id){document.getElementById(id).style.display='none';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── Format tanggal & waktu lokal Indonesia ──
function fmtTgl(iso){
  if(!iso||iso==='—')return'—';
  try{const d=new Date(iso.length===10?iso+'T00:00:00':iso);return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});}
  catch{return iso;}
}
function fmtTglWaktu(iso){
  if(!iso)return'—';
  try{const d=new Date(iso);return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})+', '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
function fmtTglPanjang(iso){
  if(!iso)return'—';
  try{const d=new Date(iso.length===10?iso+'T00:00:00':iso);return d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
  catch{return iso;}
}

// ── Export to CSV ──
function exportToCSV(data, filename) {
  if(!data || !data.length) {
    showToast('⚠️ Tidak ada data untuk diexport!');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
          ? `"${escaped}"` 
          : escaped;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function todayISO(){return new Date().toISOString().split('T')[0];}
function yesterdayISO(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split('T')[0];}

// ═══ PWA ═══
if('serviceWorker' in navigator && location.protocol !== 'file:'){
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Jika ada SW baru menunggu, langsung aktifkan
    if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if(newSW) newSW.addEventListener('statechange', () => {
        if(newSW.state === 'installed' && navigator.serviceWorker.controller){
          // SW baru siap — reload untuk pakai versi terbaru
          window.location.reload();
        }
      });
    });
  }).catch(()=>{});

  // Jika SW controller berubah (update aktif), reload
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(!refreshing){ refreshing = true; window.location.reload(); }
  });
}

// ═══ BIAYA OPERASIONAL ═══
const BIAYA_ROLES=['superadmin','admin','manajer','supervisor'];

function canInputBiaya(){
  return currentUser&&BIAYA_ROLES.includes(currentUser.role);
}


// ═══ CATEGORY PICKER ═══
let _catPickerTarget=null;

function openCatPicker(btn){
  const dd=document.getElementById('cat-dropdown');
  const overlay=document.getElementById('cat-sheet-overlay');
  if(_catPickerTarget===btn&&!dd.classList.contains('hidden')){
    closeCatPicker();return;
  }
  document.removeEventListener('click',outsideCatClick);
  _catPickerTarget=btn;
  const curVal=btn.closest('.cat-picker-wrap').previousElementSibling?.value||'tenaga_harian';
  dd.querySelectorAll('.cat-option').forEach(o=>{
    o.classList.toggle('selected',o.dataset.val===curVal);
  });
  dd.classList.remove('hidden');
  overlay.classList.remove('hidden');
  requestAnimationFrame(()=>{
    dd.classList.add('active');
    overlay.classList.add('active');
  });
}

function outsideCatClick(e){
  const dd=document.getElementById('cat-dropdown');
  if(dd.contains(e.target)||(_catPickerTarget&&_catPickerTarget.contains(e.target)))return;
  document.removeEventListener('click',outsideCatClick);
  closeCatPicker();
}

function closeCatPicker(){
  const dd=document.getElementById('cat-dropdown');
  const overlay=document.getElementById('cat-sheet-overlay');
  dd.classList.remove('active');
  overlay.classList.remove('active');
  document.removeEventListener('click',outsideCatClick);
  _catPickerTarget=null;
  setTimeout(()=>{dd.classList.add('hidden');overlay.classList.add('hidden');},280);
}

function selectCatOption(el){
  if(!_catPickerTarget)return;
  const val=el.dataset.val;
  const icon=el.dataset.icon;
  const label=el.dataset.label;
  // Update hidden input
  const wrap=_catPickerTarget.closest('.cat-picker-wrap');
  const hidden=wrap.previousElementSibling;
  if(hidden)hidden.value=val;
  // Update tombol tampilan
  _catPickerTarget.querySelector('.cpb-icon').textContent=icon;
  _catPickerTarget.querySelector('.cpb-label').textContent=label;
  closeCatPicker();
}

// Pasang event ke cat-option via delegation (handle static + dynamic rows)
document.addEventListener('click',e=>{
  const o=e.target.closest('.cat-option');
  if(o&&document.getElementById('cat-dropdown').contains(o))selectCatOption(o);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){
    const o=e.target.closest('.cat-option');
    if(o&&document.getElementById('cat-dropdown').contains(o)){e.preventDefault();selectCatOption(o);}
  }
});

function makeCatPickerHTML(defaultVal='tenaga_harian'){
  const cats={
    tenaga_harian:{icon:'👷',label:'Tenaga Harian / Lembur'},
    bbm_energi:{icon:'⛽',label:'BBM & Energi'},
    listrik_air:{icon:'💡',label:'Listrik & Air'},
    peralatan_farm:{icon:'🔧',label:'Peralatan Farm'},
    mess_fasilitas:{icon:'🏠',label:'Mess & Fasilitas'},
    kesehatan:{icon:'💊',label:'Kesehatan Ternak'},
    transportasi:{icon:'🚛',label:'Transportasi'},
    lainnya:{icon:'📦',label:'Lainnya'}
  };
  const c=cats[defaultVal]||cats.tenaga_harian;
  return `<input type="hidden" class="biaya-kategori-val" value="${defaultVal}"/>
    <div class="cat-picker-wrap">
      <button type="button" class="cat-picker-btn" onclick="openCatPicker(this)">
        <span class="cpb-icon">${c.icon}</span>
        <span class="cpb-label">${c.label}</span>
        <span class="cpb-arrow">▼</span>
      </button>
    </div>`;
}

function buildBiayaRowHTML(kategori='tenaga_harian'){
  return '<div class="field"><label>Kategori</label>'+makeCatPickerHTML(kategori)+'</div>'+
    '<div class="field" style="flex:2"><label>Keterangan</label><input type="text" placeholder="Mis. Gaji harian, BBM genset, dll."/></div>'+
    '<div class="field"><label>Jumlah (Rp)</label><input type="number" min="0" step="1000" placeholder="0" oninput="calcTotalBiaya()"/></div>'+
    '<div style="display:flex;align-items:flex-end"><button class="btn-del" onclick="removeBiayaRow(this)">✕</button></div>';
}

function addBiayaRow(){
  const list=document.getElementById('biaya-list');
  const row=document.createElement('div');
  row.className='row biaya-row';
  row.innerHTML=buildBiayaRowHTML();
  list.appendChild(row);
}

function removeBiayaRow(btn){
  const list=document.getElementById('biaya-list');
  if(list.querySelectorAll('.biaya-row').length<=1)return;
  btn.closest('.biaya-row').remove();
  calcTotalBiaya();
}

function calcTotalBiaya(){
  let total=0;
  document.querySelectorAll('.biaya-row input[type="number"]').forEach(i=>{total+=parseFloat(i.value)||0;});
  document.getElementById('total_biaya').value=total?'Rp '+total.toLocaleString('id-ID'):'Rp 0';
}

function getBiayaRows(){
  return [...document.querySelectorAll('.biaya-row')].map(r=>{
    const ketInput=r.querySelector('input[type="text"]');
    const jmlInput=r.querySelector('input[type="number"]');
    const katInput=r.querySelector('.biaya-kategori-val');
    return{ket:ketInput?.value||'',kategori:katInput?katInput.value:'lainnya',jumlah:parseFloat(jmlInput?.value)||0};
  }).filter(b=>b.ket||b.jumlah);
}

function resetBiayaRows(){
  const list=document.getElementById('biaya-list');
  [...list.querySelectorAll('.biaya-row')].slice(1).forEach(r=>r.remove());
  const first=list.querySelector('.biaya-row');
  if(first){
    first.querySelectorAll('input[type="text"],input[type="number"]').forEach(i=>i.value='');
    const katInput=first.querySelector('.biaya-kategori-val');
    if(katInput){katInput.value='tenaga_harian';}
    const btn=first.querySelector('.cat-picker-btn');
    if(btn){btn.querySelector('.cpb-icon').textContent='👷';btn.querySelector('.cpb-label').textContent='Tenaga Harian / Lembur';}
  }
  calcTotalBiaya();
}

// ═══ BIAYA OPERASIONAL PAGE ═══
async function saveBiayaData(){
  const tanggal=document.getElementById('biaya-tanggal').value;
  const kandang=document.getElementById('biaya-kandang').value;
  if(!tanggal){showToast('⚠️ Pilih tanggal!');return;}
  const biayaRows=getBiayaRows();
  if(biayaRows.length===0){showToast('⚠️ Tambahkan minimal 1 biaya!');return;}

  // Validasi setiap baris biaya
  for(let i=0;i<biayaRows.length;i++){
    const b=biayaRows[i];
    const no=i+1;
    if(!b.jumlah||b.jumlah<=0){showToast(`⚠️ Baris ${no}: Jumlah biaya harus lebih dari 0!`);return;}
    if(!b.ket){showToast(`⚠️ Baris ${no}: Keterangan wajib diisi!`);return;}
  }

  showToast('⏳ Menyimpan...');
  try{
    for(const b of biayaRows){
      await dbSaveKas({
        tanggal,
        jenis:'keluar',
        kategori:b.kategori||'lainnya',
        jumlah:b.jumlah,
        keterangan:b.ket,
        kandang:kandang||null,
        user_input:currentUser?.username||''
      });
    }
    await dbSaveLog('TAMBAH','kas_operasional',null,null,
      {tanggal,kandang,total:biayaRows.reduce((s,b)=>s+b.jumlah,0),items:biayaRows.length},
      `Input biaya operasional: ${biayaRows.length} item, total Rp ${biayaRows.reduce((s,b)=>s+b.jumlah,0).toLocaleString('id-ID')}`);
    showToast('✅ Biaya operasional disimpan!');
    resetBiayaRows();
    document.getElementById('biaya-tanggal').value=new Date().toISOString().split('T')[0];
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function loadRekapBiaya(){
  const bulan=document.getElementById('biaya-bulan').value;
  const kandang=document.getElementById('biaya-rekap-kandang').value;
  if(!bulan){showToast('⚠️ Pilih bulan!');return;}
  const[tahun,bln]=bulan.split('-');
  const dari=`${tahun}-${bln}-01`;
  const sampai=`${tahun}-${bln}-${new Date(tahun,bln,0).getDate()}`;
  showToast('⏳ Memuat rekap...');
  try{
    const list=await dbGetKas({dari,sampai,kandang:kandang||undefined});
    const keluar=list.filter(k=>k.jenis==='keluar');
    if(keluar.length===0){
      document.getElementById('rekap-biaya-result').innerHTML='<div class="info-box">Tidak ada data biaya untuk periode ini.</div>';
      return;
    }
    // Group by kategori
    const byKat={};
    keluar.forEach(k=>{
      const kat=k.kategori||'lainnya';
      if(!byKat[kat])byKat[kat]={total:0,items:[]};
      byKat[kat].total+=parseFloat(k.jumlah)||0;
      byKat[kat].items.push(k);
    });
    const total=keluar.reduce((s,k)=>s+(parseFloat(k.jumlah)||0),0);
    let html='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Kategori</th><th>Jumlah (Rp)</th><th>%</th></tr></thead><tbody>';
    Object.keys(byKat).forEach(kat=>{
      const pct=((byKat[kat].total/total)*100).toFixed(1);
      html+=`<tr><td>${esc(kat)}</td><td>Rp ${byKat[kat].total.toLocaleString('id-ID')}</td><td>${pct}%</td></tr>`;
    });
    html+=`<tr style="font-weight:700;background:#f0fdf4"><td>TOTAL</td><td>Rp ${total.toLocaleString('id-ID')}</td><td>100%</td></tr>`;
    html+='</tbody></table></div>';
    document.getElementById('rekap-biaya-result').innerHTML=html;
    showToast('✅ Rekap dimuat!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function exportRekapBiaya(){
  const bulan=document.getElementById('biaya-bulan').value;
  const kandang=document.getElementById('biaya-rekap-kandang').value;
  if(!bulan){showToast('⚠️ Pilih bulan!');return;}
  const[tahun,bln]=bulan.split('-');
  const dari=`${tahun}-${bln}-01`;
  const sampai=`${tahun}-${bln}-${new Date(tahun,bln,0).getDate()}`;
  showToast('⏳ Mengekspor...');
  try{
    const list=await dbGetKas({dari,sampai,kandang:kandang||undefined});
    const keluar=list.filter(k=>k.jenis==='keluar');
    if(keluar.length===0){showToast('⚠️ Tidak ada data untuk diekspor');return;}
    let csv='Tanggal,Kategori,Keterangan,Kandang,Jumlah (Rp)\n';
    keluar.forEach(k=>{
      csv+=`${k.tanggal},${k.kategori||''},${k.keterangan||''},${k.kandang||''},${k.jumlah}\n`;
    });
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Biaya_Operasional_${bulan}${kandang?'_'+kandang:''}.csv`;
    a.click();
    showToast('✅ File CSV didownload!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function exportRiwayatJual(){
  if(!can('EXPORT_LAP')){showToast('⚠️ Hanya Supervisor ke atas yang bisa download!');return;}
  showToast('⏳ Menyiapkan CSV...');
  try{
    const list=await dbGetPenjualan({});
    if(list.length===0){showToast('⚠️ Tidak ada data penjualan');return;}
    let csv='Tanggal,Pelanggan,Grade,Butir,Kilo (kg),Harga/kg (Rp),Total (Rp),Diinput Oleh\n';
    list.forEach(p=>{
      const items=p.items||[];
      items.forEach(item=>{
        csv+=`${p.tanggal},${item.pelanggan||''},${item.grade||''},${item.butir||0},${item.kilo||0},${item.harga||0},${item.total||0},${p.user_input||''}\n`;
      });
    });
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Riwayat_Penjualan_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ File CSV didownload!');
  }catch(e){
    console.error('Export error:',e);
    showToast('❌ Gagal export: '+e.message);
  }
}

function initBiayaPage(){
  if(!document.getElementById('biaya-tanggal').value)
    document.getElementById('biaya-tanggal').value=new Date().toISOString().split('T')[0];
  if(!document.getElementById('biaya-bulan').value)
    document.getElementById('biaya-bulan').value=new Date().toISOString().slice(0,7);
  populateBiayaKandang();
  renderKasSaldo(); // Load saldo kas
}

async function populateBiayaKandang(){
  try{
    const list=cache.get('kandang_list')||await dbGetKandang();
    ['biaya-kandang','biaya-rekap-kandang'].forEach(id=>{
      const sel=document.getElementById(id);
      if(!sel)return;
      const prev=sel.value;
      sel.innerHTML='<option value="">Semua Kandang</option>';
      list.forEach(k=>sel.innerHTML+=`<option value="${esc(k.nama)}">${esc(k.nama)}</option>`);
      if(prev)sel.value=prev;
    });
    // Add event listener untuk update saldo saat kandang berubah
    const selKandang=document.getElementById('biaya-kandang');
    if(selKandang&&!selKandang.dataset.listenerAdded){
      selKandang.addEventListener('change',()=>renderKasSaldo());
      selKandang.dataset.listenerAdded='true';
    }
  }catch(e){
    console.error('populateBiayaKandang error:',e);
  }
}

// ═══ RIWAYAT ═══
let currentRTab='harian';
function switchRTab(tab){
  currentRTab=tab;
  ['harian','penjualan','kiriman'].forEach(t=>{
    document.getElementById('rtab-'+t).classList.toggle('active',t===tab);
    document.getElementById('rtab-content-'+t).style.display=t===tab?'block':'none';
  });
  renderRiwayat();
}

function renderRiwayat(){
  populateRiwayatKandang();
  if(currentRTab==='harian')renderRHarian();
  else if(currentRTab==='penjualan')renderRPenjualan();
  else renderRKiriman();
}

function populateRiwayatKandang(){
  const sel=document.getElementById('r-kandang-filter');
  const prev=sel.value;
  const list=cache.get('kandang_list')||[];
  sel.innerHTML='<option value="">Semua Kandang</option>';
  list.forEach(k=>{const o=document.createElement('option');o.value=k.nama;o.textContent=k.nama;sel.appendChild(o);});
  if(prev)sel.value=prev;
}

function getRFilter(){
  return{kandang:document.getElementById('r-kandang-filter').value,dari:document.getElementById('r-dari').value,sampai:document.getElementById('r-sampai').value};
}

function inRange(tgl,dari,sampai){
  if(dari&&tgl<dari)return false;
  if(sampai&&tgl>sampai)return false;
  return true;
}

async function renderRHarian(){
  const f=getRFilter();
  const rows=await dbGetInput(f);
  const tbody=document.getElementById('r-harian-tbody');
  const empty=document.getElementById('r-harian-empty');
  const isSA=currentUser?.role==='superadmin';
  const thUser=document.getElementById('th-harian-user');
  if(thUser) thUser.style.display=isSA?'':'none';
  tbody.innerHTML='';
  if(!rows.length){empty.style.display='block';return;}
  empty.style.display='none';
  rows.forEach(row=>{
    const d=row.data;if(!d)return;
    const totalPakan=((d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0)).toFixed(1);
    const pemilik=d.user||row.user_input||'';
    const sameUser=pemilik===currentUser?.username;
    const canDel=sameUser||myLevel()>=3;
    const delBtn=canDel
      ?`<button class="btn-del" onclick="deleteInputHarian('${row.id}')" title="Hapus">🗑</button>`
      :`<button class="btn-del" data-no-access onclick="deleteInputHarian('${row.id}')" title="Butuh izin atasan">🔒</button>`;
    // Kolom tracking superadmin
    const waktuEdit=row.updated_at||row.created_at||'';
    const aksiLabel=row.updated_at&&row.updated_at!==row.created_at
      ?'<span class="badge badge-orange">Edit</span>'
      :'<span class="badge badge-green">Input</span>';
    const userCell=isSA
      ?`<td style="font-size:.75rem;white-space:nowrap">${aksiLabel} <strong>${esc(pemilik)}</strong><br><span style="color:#888">${fmtTglWaktu(waktuEdit)}</span></td>`
      :'';
    const tr=document.createElement('tr');
    tr.innerHTML=
      '<td>'+fmtTgl(d.tanggal)+'</td><td>'+esc(d.kandang)+'</td>'+
      '<td>'+(d.sisa_ayam||0)+' ekor</td><td>'+(d.deplesi?d.deplesi.total:0)+' ekor</td>'+
      '<td>'+(d.produksi?d.produksi.total.butir:0)+' butir</td><td>'+(d.produksi?d.produksi.hdp:'—')+'</td>'+
      '<td>'+totalPakan+' kg</td><td>'+(d.air_liter||0)+' L</td>'+
      userCell+
      '<td style="white-space:nowrap"><button class="btn-edit" onclick="editInputHarian(\''+row.id+'\')">✏️</button>'+delBtn+'</td>';
    tbody.appendChild(tr);
  });
}

async function renderRPenjualan(){
  const f=getRFilter();
  const all=await dbGetPenjualan(f);
  const tbody=document.getElementById('r-jual-tbody');
  const empty=document.getElementById('r-jual-empty');
  const isSA=currentUser?.role==='superadmin';
  const thUser=document.getElementById('th-jual-user');
  if(thUser) thUser.style.display=isSA?'':'none';
  tbody.innerHTML='';let count=0;
  all.forEach(rec=>{
    (rec.rows||[]).forEach((r,i)=>{
      const tr=document.createElement('tr');
      const pemilik=rec.user_input||'—';
      const waktu=rec.created_at||'';
      const userCell=isSA&&i===0
        ?`<td rowspan="${(rec.rows||[]).length}" style="font-size:.75rem;white-space:nowrap;vertical-align:middle"><span class="badge badge-green">Input</span> <strong>${esc(pemilik)}</strong><br><span style="color:#888">${fmtTglWaktu(waktu)}</span></td>`
        :(isSA?'':'');
      tr.innerHTML='<td>'+fmtTgl(rec.tanggal)+'</td><td>'+esc(r.pelanggan||'—')+'</td><td>'+esc(r.grade||'—')+'</td><td>'+(r.butir||0)+'</td><td>'+(r.kilo||0)+' kg</td><td>Rp '+parseFloat(r.harga||0).toLocaleString('id-ID')+'</td><td>'+esc(r.total||'Rp 0')+'</td>'+userCell;
      tbody.appendChild(tr);count++;
    });
  });
  empty.style.display=count?'none':'block';
}

async function renderRKiriman(){
  const f=getRFilter();
  const all=await dbGetKiriman(f);
  const tbody=document.getElementById('r-kiriman-tbody');
  const empty=document.getElementById('r-kiriman-empty');
  const isSA=currentUser?.role==='superadmin';
  const thUser=document.getElementById('th-kiriman-user');
  if(thUser) thUser.style.display=isSA?'':'none';
  tbody.innerHTML='';let count=0;
  all.forEach(k=>{
    const total=parseFloat(k.harga_total)||0;
    const pemilik=k.user_input||'—';
    const waktu=k.created_at||'';
    const userCell=isSA
      ?`<td style="font-size:.75rem;white-space:nowrap"><span class="badge badge-green">Input</span> <strong>${esc(pemilik)}</strong><br><span style="color:#888">${fmtTglWaktu(waktu)}</span></td>`
      :'';
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+fmtTgl(k.tanggal)+'</td><td>'+esc(k.nama_pakan)+'</td><td>'+k.jumlah+' kg</td><td>Rp '+parseFloat(k.harga_per_kg||0).toLocaleString('id-ID')+'/kg</td><td>Rp '+total.toLocaleString('id-ID')+'</td><td>'+esc(k.keterangan||'—')+'</td>'+userCell;
    tbody.appendChild(tr);count++;
  });
  empty.style.display=count?'none':'block';
}

function filterRiwayat(){renderRiwayat();}

let _editRowId=null; // ID record yang sedang diedit

async function editInputHarian(id){
  const rows=await dbGetInput({});
  const row=rows.find(r=>r.id===id);
  if(!row)return;
  const d=row.data;

  // Tampilkan modal preview data asli sebelum edit
  const modal=document.getElementById('modal-edit-preview');
  if(modal){
    document.getElementById('ep-tanggal').textContent=fmtTgl(d.tanggal)||'—';
    document.getElementById('ep-kandang').textContent=d.kandang||'—';
    document.getElementById('ep-populasi').textContent=(d.sisa_ayam||0)+' ekor';
    document.getElementById('ep-mati').textContent=(d.deplesi?.mati||0)+' ekor';
    document.getElementById('ep-afkir').textContent=(d.deplesi?.afkir||0)+' ekor';
    document.getElementById('ep-normal').textContent=(d.produksi?.normal?.butir||0)+' butir / '+(d.produksi?.normal?.kilo||0)+' kg';
    document.getElementById('ep-cream').textContent=(d.produksi?.cream?.butir||0)+' butir / '+(d.produksi?.cream?.kilo||0)+' kg';
    document.getElementById('ep-retak').textContent=(d.produksi?.retak?.butir||0)+' butir / '+(d.produksi?.retak?.kilo||0)+' kg';
    document.getElementById('ep-hdp').textContent=(d.produksi?.hdp||'—')+'%';
    document.getElementById('ep-air').textContent=(d.air_liter||0)+' L';
    document.getElementById('ep-pakan').textContent=((d.pakan||[]).map(p=>p.kode+' '+p.jumlah+'kg').join(', '))||'—';
    document.getElementById('ep-catatan').textContent=d.catatan||'—';
    document.getElementById('ep-user').textContent=(d.user||row.user_input||'—')+' · '+fmtTglWaktu(row.updated_at||row.created_at||'');
    _editRowId=id;
    modal.style.display='flex';
    return;
  }
  // Fallback jika modal tidak ada
  _loadEditToForm(d,id);
}

function _loadEditToForm(d,id){
  _editRowId=id;
  switchPage('input');
  setTimeout(()=>{
    document.getElementById('tanggal').value=d.tanggal||'';
    document.getElementById('kandang').value=d.kandang||'';
    document.getElementById('mati').value=d.deplesi?d.deplesi.mati:0;
    document.getElementById('afkir').value=d.deplesi?d.deplesi.afkir:0;
    document.getElementById('populasi_awal').value=d.sisa_ayam||0;
    document.getElementById('air_liter').value=d.air_liter||0;
    document.getElementById('p_normal_butir').value=d.produksi?d.produksi.normal.butir:0;
    document.getElementById('p_normal_kilo').value=d.produksi?d.produksi.normal.kilo:0;
    document.getElementById('p_cream_butir').value=d.produksi?d.produksi.cream.butir:0;
    document.getElementById('p_cream_kilo').value=d.produksi?d.produksi.cream.kilo:0;
    document.getElementById('p_retak_butir').value=d.produksi?d.produksi.retak.butir:0;
    document.getElementById('p_retak_kilo').value=d.produksi?d.produksi.retak.kilo:0;
    document.getElementById('catatan').value=d.catatan||'';

    // Load pakan rows
    const pakanList=document.getElementById('pakan-list');
    pakanList.innerHTML=''; // clear existing
    if(d.pakan&&d.pakan.length>0){
      d.pakan.forEach(p=>{
        const row=document.createElement('div');row.className='row pakan-row';
        row.innerHTML='<div class="field"><label>Kode Pakan</label><select class="pakan-select" style="border:1.5px solid #e2e8f0;border-radius:7px;padding:8px 10px;font-size:.9rem;width:100%;background:#fff"><option value="">-- Pilih Pakan --</option></select></div><div class="field"><label>Jumlah (kg)</label><input type="number" min="0" step="0.1" placeholder="0" oninput="calcAir()"/></div><div style="display:flex;align-items:flex-end"><button class="btn-del" onclick="removeRow(this,\'pakan-list\',\'pakan-row\')">✕</button></div>';
        pakanList.appendChild(row);
        populatePakanSelect(row.querySelector('.pakan-select'));
        row.querySelector('.pakan-select').value=p.kode||'';
        row.querySelector('input[type="number"]').value=p.jumlah||0;
      });
    } else {
      addPakan(); // minimal 1 row kosong
    }

    // Load kesehatan rows (format baru dengan dropdown)
    populateKesRows(d.kesehatan);

    updatePeriodBar();calcSisa();calcAir();calcProduksi();
  },200);
}

async function confirmEditLanjut(){
  closeModal('modal-edit-preview');
  const rows=await dbGetInput({});
  const row=rows.find(r=>r.id===_editRowId);
  if(!row)return;
  _loadEditToForm(row.data,_editRowId);
}

// ═══ HAPUS UNIVERSAL — role-based ═══
let _hapusFn=null; // fungsi yang akan dieksekusi setelah konfirmasi

function showHapusModal({judul, deskripsi, warning, canDelete, onConfirm}){
  document.getElementById('hapus-info').innerHTML=
    `<strong>${judul}</strong><br><span style="color:#6b7280">${deskripsi}</span>`;
  const warnEl=document.getElementById('hapus-warning');
  if(warning){warnEl.style.display='block';warnEl.innerHTML=warning;}
  else{warnEl.style.display='none';}
  const btnConfirm=document.getElementById('btn-hapus-confirm');
  btnConfirm.style.display=canDelete?'':'none';
  _hapusFn=canDelete?onConfirm:null;
  document.getElementById('modal-hapus').style.display='flex';
}

async function executeHapus(){
  closeModal('modal-hapus');
  if(_hapusFn)await _hapusFn();
  _hapusFn=null;
}

// Helper: cek role lebih tinggi dari user lain
const ROLE_LEVEL={viewer:0,staff:1,operator:2,supervisor:3,manajer:4,admin:5,superadmin:6};
function roleLevel(r){return ROLE_LEVEL[r]??0;}
function myLevel(){return roleLevel(currentUser?.role);}

// ── Hapus Input Harian ──
async function deleteInputHarian(id){
  // Ambil data dulu untuk cek siapa yang input
  const rows=await dbGetInput({});
  const row=rows.find(r=>r.id===id);
  const pemilik=row?.data?.user||row?.user_input||'—';
  const tgl=row?.data?.tanggal||'';
  const knd=row?.data?.kandang||'';
  const sameUser=pemilik===currentUser?.username;
  const pemilikLevel=roleLevel((await dbGetUsers()).find(u=>u.username===pemilik)?.role||'');
  const canDelete=sameUser||(myLevel()>pemilikLevel)||(myLevel()>=3);

  showHapusModal({
    judul:`Hapus Input Harian`,
    deskripsi:`📅 ${tgl} — ${knd}<br>Diinput oleh: <strong>${esc(pemilik)}</strong>`,
    warning: !canDelete
      ?`🚫 Anda tidak berwenang menghapus data yang diinput oleh <strong>${esc(pemilik)}</strong>. Hubungi Manajer atau Admin.`
      :(!sameUser&&myLevel()<=2
        ?`⚠️ Data ini diinput oleh <strong>${esc(pemilik)}</strong>. Pastikan sudah mendapat persetujuan atasan sebelum menghapus.`
        :null),
    canDelete,
    onConfirm:async()=>{
      try{
        await dbSaveLog('HAPUS','input_harian',id,row?.data,null,`Hapus data harian ${tgl} kandang ${knd}`);
        await dbDeleteInput(id);await renderRHarian();showToast('🗑 Data dihapus.');
      }
      catch(e){showToast('❌ Gagal menghapus.');}
    }
  });
}

// ── Hapus Kandang ──
async function deleteKandang(id){
  const list=cache.get('kandang_list')||await dbGetKandang();
  const k=list.find(x=>x.id===id);
  const canDelete=can('KEUANGAN'); // admin & manajer

  showHapusModal({
    judul:`Hapus Kandang`,
    deskripsi:`🏠 <strong>${esc(k?.nama||id)}</strong><br>Populasi: ${k?.populasi||0} ekor · Status: ${k?.status||'—'}`,
    warning: !canDelete
      ?`🚫 Hanya Manajer dan Admin yang dapat menghapus kandang. Hubungi atasan Anda.`
      :`⚠️ Menghapus kandang akan menghilangkan semua referensi kandang ini. Pastikan tidak ada data aktif.`,
    canDelete,
    onConfirm:async()=>{
      try{
        await dbDeleteKandang(id);
        await renderKandangTable();
        await populateKandangSelects();
        await dbSaveLog('HAPUS','kandang',id,k,null,`Hapus kandang: ${k?.nama||id}`);
        showToast('🗑 Kandang dihapus.');
      }catch(e){showToast('❌ Gagal menghapus.');}
    }
  });
}

// ── Hapus User ──
async function deleteUser(id, username){
  // Hard delete — hanya superadmin
  if(currentUser?.role !== 'superadmin'){showToast('🔒 Hanya Superadmin yang bisa hapus permanen!');return;}
  if(username === currentUser?.username){showToast('⚠️ Tidak bisa hapus akun sendiri!');return;}
  const users = await dbGetUsers();
  const u = users.find(x => x.id === id);
  if(u?.role === 'superadmin'){showToast('🔒 Superadmin tidak dapat dihapus!');return;}

  showHapusModal({
    judul: 'Hapus Permanen User',
    deskripsi: `👤 <strong>${esc(username)}</strong> · Role: ${u?.role||'—'}`,
    warning: `⚠️ Hapus permanen tidak bisa dibatalkan. User tidak akan bisa login lagi dan semua data terkait akan terputus.`,
    canDelete: true,
    onConfirm: async () => {
      try{
        await dbDeleteUser(id);
        await renderUserTable();
        await dbSaveLog('HAPUS','users',id,{username,role:u?.role},null,`Hapus permanen user: ${username}`);
        showToast('🗑 User dihapus permanen.');
      }catch(e){showToast('❌ Gagal menghapus.');}
    }
  });
}

async function softDeleteUser(id, username){
  // Soft delete — nonaktifkan user (admin bisa)
  if(!['admin','superadmin'].includes(currentUser?.role)){showToast('⚠️ Tidak ada akses!');return;}
  if(username === currentUser?.username){showToast('⚠️ Tidak bisa nonaktifkan akun sendiri!');return;}
  if(!confirm(`Nonaktifkan user "${username}"? User tidak bisa login tapi data tetap tersimpan.`)) return;
  try{
    await SB.update('users', {active: false}, `?id=eq.${id}`);
    cache.del('users');
    await renderUserTable();
    await dbSaveLog('NONAKTIF','users',id,{active:true},{active:false},`Nonaktifkan user: ${username}`);
    showToast(`🚫 User "${username}" dinonaktifkan.`);
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function activateUser(id, username){
  if(!['admin','superadmin'].includes(currentUser?.role)){showToast('⚠️ Tidak ada akses!');return;}
  try{
    await SB.update('users', {active: true}, `?id=eq.${id}`);
    cache.del('users');
    await renderUserTable();
    await dbSaveLog('AKTIFKAN','users',id,{active:false},{active:true},`Aktifkan kembali user: ${username}`);
    showToast(`✅ User "${username}" diaktifkan kembali.`);
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

// ── Hapus Daftar Pakan ──
async function deletePakan(id){
  if(!can('KEUANGAN')){showToast('⚠️ Hanya Admin/Manajer yang bisa hapus pakan!');return;}
  const list=cache.get('daftar_pakan')||await dbGetDaftarPakan();
  const p=list.find(x=>x.id===id);

  showHapusModal({
    judul:`Hapus Pakan`,
    deskripsi:`🌾 <strong>${esc(p?.nama||id)}</strong><br>Min. stok: ${p?.stok_minimal||0} kg`,
    warning:`⚠️ Menghapus pakan akan menghilangkan data dari semua dropdown input. Pastikan tidak ada stok aktif.`,
    canDelete:true,
    onConfirm:async()=>{
      try{
        await dbDeleteDaftarPakan(id);
        await renderGudang();
        await dbSaveLog('HAPUS','daftar_pakan',id,p,null,`Hapus pakan: ${p?.nama||id}`);
        showToast('🗑 Pakan dihapus.');
      }
      catch(e){showToast('❌ Gagal menghapus.');}
    }
  });
}

// ── Hapus Kiriman Pakan ──
async function deleteKiriman(id){
  if(!can('KEUANGAN')){showToast('⚠️ Hanya Admin/Manajer yang bisa hapus kiriman!');return;}
  const kiriman=cache.get('kiriman_pakan')||await dbGetKiriman({});
  const k=kiriman.find(x=>x.id===id);

  showHapusModal({
    judul:`Hapus Kiriman Pakan`,
    deskripsi:`🚚 <strong>${esc(k?.nama_pakan||'—')}</strong> ${k?.jumlah||0} kg dari ${esc(k?.supplier||'—')}`,
    warning:`⚠️ Menghapus kiriman akan mempengaruhi kalkulasi stok pakan secara otomatis.`,
    canDelete:true,
    onConfirm:async()=>{
      try{
        await dbDeleteKiriman(id);
        await renderGudang();
        await dbSaveLog('HAPUS','kiriman_pakan',id,k,null,
          `Hapus kiriman: ${k?.nama_pakan||'—'} ${k?.jumlah||0}kg tgl ${k?.tanggal||'—'}`);
        showToast('🗑 Kiriman dihapus.');
      }
      catch(e){showToast('❌ Gagal menghapus.');}
    }
  });
}

async function exportRiwayat(){
  let csv='';
  if(currentRTab==='harian'){
    csv='Tanggal,Kandang,Sisa Ayam,Deplesi,Prod Butir,HDP,Pakan kg,Air L\n';
    const f=getRFilter();
    const rows=await dbGetInput(f);
    rows.forEach(row=>{
      const d=row.data;if(!d)return;
      const tp=((d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0)).toFixed(1);
      csv+=`${d.tanggal},${d.kandang},${d.sisa_ayam||0},${d.deplesi?d.deplesi.total:0},${d.produksi?d.produksi.total.butir:0},${d.produksi?d.produksi.hdp:''},${tp},${d.air_liter||0}\n`;
    });
  } else if(currentRTab==='penjualan'){
    csv='Tanggal,Pelanggan,Grade,Butir,Kilo,Harga/kg,Total\n';
    const all=await dbGetPenjualan({});
    all.forEach(rec=>{(rec.rows||[]).forEach(r=>{csv+=`${rec.tanggal},${r.pelanggan||''},${r.grade||''},${r.butir||0},${r.kilo||0},${r.harga||0},${(r.total||'').replace(/[^0-9]/g,'')}\n`;});});
  } else {
    csv='Tanggal,Pakan,Jumlah kg,Harga/kg,Total,Supplier\n';
    const kiriman=await dbGetKiriman({});
    kiriman.forEach(k=>{
      const tot=parseFloat(k.harga_total)||0;
      csv+=`${k.tanggal},${k.nama_pakan},${k.jumlah},${k.harga_per_kg||0},${tot},${k.keterangan||''}\n`;
    });
  }
  downloadCSV(csv,'riwayat_'+currentRTab+'_'+new Date().toISOString().split('T')[0]+'.csv');
}

// ═══ LAPORAN ═══
let currentLTab='rekap';
function switchLTab(tab){
  currentLTab=tab;
  ['rekap','labarugi','grafik','fcr'].forEach(t=>{
    document.getElementById('ltab-'+t).classList.toggle('active',t===tab);
    document.getElementById('ltab-content-'+t).style.display=t===tab?'block':'none';
  });
  renderLaporan();
}

function populateLaporanKandang(){
  const list=cache.get('kandang_list')||[];
  // Populate semua select kandang di halaman laporan
  // Populate select kandang di halaman laporan
  ['l-kandang'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    const prev=sel.value;
    sel.innerHTML='<option value="">Semua Kandang</option>';
    list.forEach(k=>{const o=document.createElement('option');o.value=k.nama;o.textContent=k.nama;sel.appendChild(o);});
    if(prev)sel.value=prev;
  });
  document.getElementById('l-periode').onchange=function(){
    const show=this.value==='custom';
    document.getElementById('l-dari').style.display=show?'':'none';
    document.getElementById('l-sampai').style.display=show?'':'none';
  };
  document.getElementById('fcr-periode').onchange=function(){
    const show=this.value==='custom';
    document.getElementById('fcr-dari').style.display=show?'':'none';
    document.getElementById('fcr-sampai').style.display=show?'':'none';
  };
}

function getLaporanRange(){
  const p=document.getElementById('l-periode').value;
  const now=new Date();
  let dari,sampai=now.toISOString().split('T')[0];
  if(p==='bulan'){
    dari=now.getFullYear()+'-'+(String(now.getMonth()+1).padStart(2,'0'))+'-01';
  } else if(!isNaN(p)) {
    const d=new Date(now); d.setDate(d.getDate() - (parseInt(p)-1));
    dari=d.toISOString().split('T')[0];
  } else {
    dari=document.getElementById('l-dari').value||sampai;
    sampai=document.getElementById('l-sampai').value||sampai;
  }
  return{dari,sampai,kandang:document.getElementById('l-kandang').value};
}

function renderLaporan(){
  if(currentLTab==='rekap')renderLapRekap();
  else if(currentLTab==='labarugi')renderLapLabaRugi();
  else if(currentLTab==='grafik')renderGrafik();
  else if(currentLTab==='fcr')renderFCR();
}

async function renderLapRekap(){
  const{dari,sampai,kandang}=getLaporanRange();

  // Update title
  const titleName = document.getElementById('lap-kandang-name');
  if(titleName) titleName.textContent = kandang ? `(${kandang})` : '';

  // Ambil data untuk hitung kumulatif
  const allRowsRaw = await dbGetInput(kandang ? {kandang} : {});
  // Urutkan dari terlama ke terbaru untuk hitung kumulatif deplesi
  const sortedRows = allRowsRaw.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
  
  const kandangList = cache.get('kandang_list') || await dbGetKandang();
  const currentSisaMap = {};
  kandangList.forEach(k => { currentSisaMap[k.nama] = parseInt(k.populasi) || 0; });

  // Hitung sisa ayam secara kumulatif berdasarkan urutan tanggal
  const processedRows = sortedRows.map(row => {
    const d = { ...row.data };
    const kName = row.kandang;
    const depTotal = parseInt(d.deplesi?.total || 0);
    
    const prevSisa = currentSisaMap[kName] || 0;
    const newSisa = Math.max(0, prevSisa - depTotal);
    currentSisaMap[kName] = newSisa;
    
    d.sisa_ayam_calc = newSisa; 
    return d;
  }).filter(Boolean);

  // Filter sesuai range tanggal & balik urutan (terbaru di atas)
  const rows = processedRows.filter(d => {
    if(dari && d.tanggal < dari) return false;
    if(sampai && d.tanggal > sampai) return false;
    return true;
  }).reverse();

  const totalProd=rows.reduce((s,d)=>s+(parseInt(d.produksi?d.produksi.total.butir:0)||0),0);
  const totalKilo=rows.reduce((s,d)=>s+(parseFloat(d.produksi?d.produksi.total.kilo:0)||0),0);
  const totalDep=rows.reduce((s,d)=>s+(parseInt(d.deplesi?d.deplesi.total:0)||0),0);
  const totalPakan=rows.reduce((s,d)=>s+((d.pakan||[]).reduce((ss,p)=>ss+(parseFloat(p.jumlah)||0),0)),0);
  const avgHDP=rows.length?rows.reduce((s,d)=>s+(parseFloat(d.produksi?d.produksi.hdp:0)||0),0)/rows.length:0;

  document.getElementById('lap-summary').innerHTML=
    sumCard('📅 Hari Data','green',rows.length+' hari')+
    sumCard('🥚 Total Produksi','blue',totalProd.toLocaleString('id-ID')+' butir')+
    sumCard('⚖️ Total Berat','blue',totalKilo.toFixed(1)+' kg')+
    sumCard('📉 Avg HDP','orange',avgHDP.toFixed(1)+'%')+
    sumCard('💀 Total Deplesi','red',totalDep+' ekor')+
    sumCard('🌾 Total Pakan','orange',totalPakan.toFixed(1)+' kg');

  const tbody=document.getElementById('lap-rekap-tbody');
  const empty=document.getElementById('lap-rekap-empty');
  tbody.innerHTML='';
  if(!rows.length){empty.style.display='block';return;}
  empty.style.display='none';

  rows.forEach(d=>{
    const pakanKg = (d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0);
    const sisaAyam = d.sisa_ayam_calc; // Gunakan hasil kalkulasi kumulatif
    const fi = sisaAyam > 0 ? (pakanKg * 1000 / sisaAyam) : 0;
    
    const prodButir = parseInt(d.produksi?.total?.butir)||0;
    const prodKg = parseFloat(d.produksi?.total?.kilo)||0;
    const ew = prodButir > 0 ? (prodKg * 1000 / prodButir) : 0;

    // Bersihkan HDP dari % ganda jika sudah ada
    let hdp = d.produksi?.hdp || '—';
    if(typeof hdp === 'string' && hdp.includes('%')) hdp = hdp.replace('%', '').trim();

    const tr = document.createElement('tr');
    // Order: Tanggal | Deplesi | Sisa Ayam | Pakan (kg) | Fi (gr) | Prod. (butir) | Prod. (kg) | HDP (%) | EW (gr)
    tr.innerHTML = `<td>${fmtTgl(d.tanggal)}</td>
      <td>${d.deplesi?d.deplesi.total:0}</td>
      <td>${sisaAyam}</td>
      <td>${pakanKg.toFixed(1)}</td>
      <td>${fi.toFixed(1)}</td>
      <td>${prodButir}</td>
      <td>${prodKg.toFixed(1)}</td>
      <td>${hdp}${hdp !== '—' ? '%' : ''}</td>
      <td>${ew.toFixed(1)}</td>`;
    tbody.appendChild(tr);
  });
}

async function renderLapLabaRugi(){
  const{dari,sampai,kandang}=getLaporanRange();
  const pendMap={};
  const juals=await dbGetPenjualan({dari,sampai});
  juals.forEach(rec=>{pendMap[rec.tanggal]=(pendMap[rec.tanggal]||0)+(parseInt(rec.grand_total)||0);});

  // Ambil kiriman pakan untuk hitung biaya berdasarkan harga_per_kg
  const semuaKiriman=await dbGetKiriman({});
  const getHargaOnDate=(namaPakan,tgl)=>{
    const filtered=semuaKiriman
      .filter(k=>k.nama_pakan===namaPakan&&k.tanggal<=tgl)
      .sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
    return filtered.length?parseFloat(filtered[0].harga_per_kg)||0:0;
  };

  const biayaMap={},opsMap={};
  const allInputs=await dbGetInput({dari,sampai,kandang});
  for(const row of allInputs){
    const d=row.data;if(!d)continue;
    let biaya=0;
    for(const p of (d.pakan||[])){
      const namaPakan=p.kode||p.nama||'';
      const harga=getHargaOnDate(namaPakan,d.tanggal);
      biaya+=(parseFloat(p.jumlah)||0)*harga;
    }
    biayaMap[d.tanggal]=(biayaMap[d.tanggal]||0)+biaya;
    const ops=(d.biaya_ops||[]).reduce((s,b)=>s+(parseFloat(b.jumlah)||0),0);
    opsMap[d.tanggal]=(opsMap[d.tanggal]||0)+ops;
  }

  // Hitung total pembayaran real (yang sudah dibayar)
  const semuaBayar=await dbGetPembayaran({dari,sampai});
  const totalBayarReal=semuaBayar.reduce((s,b)=>s+(parseFloat(b.jumlah_bayar)||0),0);
  const totalTagihanBelumBayar=semuaKiriman
    .filter(k=>k.status_bayar!=='lunas')
    .reduce((s,k)=>s+(parseFloat(k.sisa_tagihan)||0),0);

  const allDates=[...new Set([...Object.keys(pendMap),...Object.keys(biayaMap),...Object.keys(opsMap)])].sort().reverse();
  let totalPend=0,totalBiaya=0,totalOps=0;
  const tbody=document.getElementById('lr-tbody');
  const empty=document.getElementById('lr-empty');
  tbody.innerHTML='';
  if(!allDates.length){empty.style.display='block';}
  else{
    empty.style.display='none';
    allDates.forEach(tgl=>{
      const pend=pendMap[tgl]||0,biaya=biayaMap[tgl]||0,ops=opsMap[tgl]||0;
      const totalB=biaya+ops,laba=pend-totalB;
      totalPend+=pend;totalBiaya+=biaya;totalOps+=ops;
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+fmtTgl(tgl)+'</td><td style="color:#1b4332;font-weight:600">Rp '+pend.toLocaleString('id-ID')+'</td><td style="color:#dc2626">Rp '+biaya.toLocaleString('id-ID')+'</td><td style="color:#f59e0b;font-weight:600">Rp '+ops.toLocaleString('id-ID')+'</td><td style="color:#dc2626;font-weight:600">Rp '+totalB.toLocaleString('id-ID')+'</td><td style="font-weight:700;color:'+(laba>=0?'#1b4332':'#dc2626')+'">Rp '+laba.toLocaleString('id-ID')+'</td>';
      tbody.appendChild(tr);
    });
  }
  const totalSemua=totalBiaya+totalOps;
  const totalLaba=totalPend-totalSemua;
  // Margin real = pendapatan - yang sudah dibayar - ops
  const labaReal=totalPend-totalBayarReal-totalOps;
  document.getElementById('lr-summary').innerHTML=
    sumCard('💵 Total Pendapatan','green','Rp '+totalPend.toLocaleString('id-ID'))+
    sumCard('🌾 Biaya Pakan Terpakai','red','Rp '+totalBiaya.toLocaleString('id-ID'))+
    sumCard('🔧 Biaya Operasional','orange','Rp '+totalOps.toLocaleString('id-ID'))+
    sumCard('💸 Total Biaya','red','Rp '+totalSemua.toLocaleString('id-ID'))+
    sumCard(totalLaba>=0?'📈 Laba (Akrual)':'📉 Rugi (Akrual)',totalLaba>=0?'green':'red','Rp '+Math.abs(totalLaba).toLocaleString('id-ID'))+
    sumCard('📊 Margin Akrual',totalLaba>=0?'blue':'red',totalPend>0?(totalLaba/totalPend*100).toFixed(1)+'%':'—')+
    sumCard('💳 Total Dibayar ke Supplier','blue','Rp '+totalBayarReal.toLocaleString('id-ID'))+
    sumCard('⏳ Sisa Tagihan Belum Bayar','orange','Rp '+totalTagihanBelumBayar.toLocaleString('id-ID'))+
    sumCard(labaReal>=0?'✅ Laba Real (Kas)':'❌ Rugi Real (Kas)',labaReal>=0?'green':'red','Rp '+Math.abs(labaReal).toLocaleString('id-ID'))+
    sumCard('📊 Margin Real (Kas)',labaReal>=0?'blue':'red',totalPend>0?(labaReal/totalPend*100).toFixed(1)+'%':'—');
}

function sumCard(label,color,val){
  return'<div class="sum-card '+color+'"><div class="sl">'+label+'</div><div class="sv">'+val+'</div></div>';
}

async function exportLaporan(format='csv'){
  if(!can('EXPORT_LAP')){showToast('⚠️ Tidak ada akses export laporan!');return;}
  const{dari,sampai,kandang}=getLaporanRange();
  const isSupervisor=currentUser&&currentUser.role==='supervisor';
  const fname='laporan_'+currentLTab+'_'+new Date().toISOString().split('T')[0];
  showToast('⏳ Menyiapkan export...');

  // ── Kumpulkan data ──
  let headers=[], rows=[], title='';

  if(currentLTab==='rekap'){
    title='Laporan Rekap Produksi';
    headers=['Tanggal','Deplesi','Sisa Ayam','Pakan (kg)','Fi (gr)','Prod (butir)','Prod (kg)','HDP (%)','EW (gr)'];
    
    const allRowsRaw = await dbGetInput(kandang ? {kandang} : {});
    const sortedRows = allRowsRaw.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
    const kandangList = cache.get('kandang_list') || await dbGetKandang();
    const currentSisaMap = {};
    kandangList.forEach(k => { currentSisaMap[k.nama] = parseInt(k.populasi) || 0; });

    const processedRows = sortedRows.map(row => {
      const d = { ...row.data };
      const kName = row.kandang;
      const depTotal = parseInt(d.deplesi?.total || 0);
      const prevSisa = currentSisaMap[kName] || 0;
      const newSisa = Math.max(0, prevSisa - depTotal);
      currentSisaMap[kName] = newSisa;
      d.sisa_ayam_calc = newSisa; 
      return d;
    }).filter(d => {
      if(dari && d.tanggal < dari) return false;
      if(sampai && d.tanggal > sampai) return false;
      return true;
    });

    processedRows.forEach(d=>{
      const pakanKg = (d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0);
      const sisaAyam = d.sisa_ayam_calc;
      const fi = sisaAyam > 0 ? (pakanKg * 1000 / sisaAyam) : 0;
      const prodButir = parseInt(d.produksi?.total?.butir)||0;
      const prodKg = parseFloat(d.produksi?.total?.kilo)||0;
      const ew = prodButir > 0 ? (prodKg * 1000 / prodButir) : 0;
      
      let hdp = d.produksi?.hdp || 0;
      if(typeof hdp === 'string') hdp = hdp.replace('%', '').trim();
      
      rows.push([d.tanggal, d.deplesi?.total||0, sisaAyam, pakanKg.toFixed(1), fi.toFixed(1), prodButir, prodKg.toFixed(1), hdp + '%', ew.toFixed(1)]);
    });

  } else if(currentLTab==='labarugi'){
    title='Laporan Laba Rugi';
    const semuaKiriman=await dbGetKiriman({});
    const getHargaOnDate=(namaPakan,tgl)=>{
      const f=semuaKiriman.filter(k=>k.nama_pakan===namaPakan&&k.tanggal<=tgl).sort((a,b)=>b.tanggal.localeCompare(a.tanggal));
      return f.length?parseFloat(f[0].harga_per_kg)||0:0;
    };
    const juals=await dbGetPenjualan({dari,sampai});
    const pendMap={};
    juals.forEach(rec=>{pendMap[rec.tanggal]=(pendMap[rec.tanggal]||0)+(parseInt(rec.grand_total)||0);});
    const inputs=await dbGetInput({dari,sampai,kandang});
    const biayaMap={},opsMap={};
    for(const row of inputs){
      const d=row.data;if(!d)continue;
      let b=0;
      for(const p of (d.pakan||[])){b+=(parseFloat(p.jumlah)||0)*getHargaOnDate(p.kode||p.nama||'',d.tanggal);}
      biayaMap[d.tanggal]=(biayaMap[d.tanggal]||0)+b;
      opsMap[d.tanggal]=(opsMap[d.tanggal]||0)+(d.biaya_ops||[]).reduce((s,x)=>s+(parseFloat(x.jumlah)||0),0);
    }
    if(isSupervisor){
      headers=['Tanggal','Penjualan (Rp)','Biaya Pakan (Rp)','Biaya Ops (Rp)'];
      [...new Set([...Object.keys(pendMap),...Object.keys(biayaMap)])].sort().reverse().forEach(tgl=>{
        rows.push([tgl,pendMap[tgl]||0,Math.round(biayaMap[tgl]||0),Math.round(opsMap[tgl]||0)]);
      });
    } else {
      headers=['Tanggal','Pendapatan (Rp)','Biaya Pakan (Rp)','Biaya Ops (Rp)','Total Biaya (Rp)','Laba/Rugi (Rp)'];
      [...new Set([...Object.keys(pendMap),...Object.keys(biayaMap)])].sort().reverse().forEach(tgl=>{
        const p=pendMap[tgl]||0,b=Math.round(biayaMap[tgl]||0),o=Math.round(opsMap[tgl]||0);
        rows.push([tgl,p,b,o,b+o,p-b-o]);
      });
    }
  } else {
    showToast('⚠️ Pilih tab Rekap atau Laba Rugi untuk export.');return;
  }

  if(!rows.length){showToast('⚠️ Tidak ada data untuk di-export.');return;}

  if(format==='csv'){
    const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
    downloadCSV(csv,fname+'.csv');
  } else if(format==='excel'){
    exportExcel(title,headers,rows,fname+'.xlsx');
  } else if(format==='pdf'){
    exportPDF(title,headers,rows,fname+'.pdf',dari,sampai,kandang);
  }
}

function exportExcel(title, headers, rows, filename){
  const wb=XLSX.utils.book_new();
  // Baris judul
  const wsData=[[title],['Diekspor: '+new Date().toLocaleString('id-ID')],[''],[headers],...rows];
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  // Style lebar kolom otomatis
  ws['!cols']=headers.map((_,i)=>({wch:Math.max(headers[i].length,
    ...rows.map(r=>String(r[i]||'').length))+2}));
  // Merge judul
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:headers.length-1}}];
  XLSX.utils.book_append_sheet(wb,ws,'Laporan');
  XLSX.writeFile(wb,filename);
  showToast('✅ Excel berhasil didownload!');
}

function exportPDF(title, headers, rows, filename, dari, sampai, kandang){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:rows[0]?.length>5?'landscape':'portrait',unit:'mm',format:'a4'});
  // Header
  doc.setFontSize(14);doc.setFont('helvetica','bold');
  doc.text('Teaching Farm UB',14,15);
  doc.setFontSize(11);doc.setFont('helvetica','normal');
  doc.text(title,14,22);
  doc.setFontSize(9);doc.setTextColor(100);
  doc.text(`Periode: ${dari||'—'} s/d ${sampai||'—'}  |  Kandang: ${kandang||'Semua'}  |  Diekspor: ${new Date().toLocaleString('id-ID')}`,14,28);
  doc.setTextColor(0);
  // Tabel
  doc.autoTable({
    head:[headers],
    body:rows,
    startY:33,
    styles:{fontSize:8,cellPadding:2},
    headStyles:{fillColor:[45,106,79],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[240,253,244]},
    columnStyles:headers.reduce((acc,_,i)=>({...acc,[i]:{halign:i>0?'right':'left'}}),{}),
    didDrawPage:(data)=>{
      // Footer
      doc.setFontSize(7);doc.setTextColor(150);
      doc.text('Teaching Farm UB — '+new Date().toLocaleDateString('id-ID'),14,doc.internal.pageSize.height-8);
      doc.text('Hal '+data.pageNumber,doc.internal.pageSize.width-20,doc.internal.pageSize.height-8);
    }
  });
  doc.save(filename);
  showToast('✅ PDF berhasil didownload!');
}

function downloadCSV(csv,filename){
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

// ═══ SETTINGS DROPDOWN ═══
function toggleSettings(){
  const menu=document.getElementById('settings-menu');
  menu.classList.toggle('show');
}

function goSettings(tab){
  switchPage('settings');
  switchSTab(tab);
  toggleSettings();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.settings-dropdown');
  const menu = document.getElementById('settings-menu');
  if(dropdown && menu && !dropdown.contains(e.target)){
    menu.classList.remove('show');
  }
});
// Close dropdown when clicking outside
document.addEventListener('click',function(e){
  const dropdown=document.querySelector('.settings-dropdown');
  const menu=document.getElementById('settings-menu');
  if(dropdown && menu && !dropdown.contains(e.target)){
    menu.classList.remove('show');
  }
});

// ═══ DARK MODE ═══
function toggleDark(){
  const isDark=document.body.classList.toggle('dark');
  localStorage.setItem('darkMode',isDark?'1':'0');
  // Update dropdown icons/text
  const icon=document.getElementById('dark-icon');
  const text=document.getElementById('dark-text');
  if(icon)icon.textContent=isDark?'☀️':'🌙';
  if(text)text.textContent=isDark?'Mode Terang':'Mode Gelap';
  // Update old button if exists
  const btn=document.getElementById('btn-dark');
  if(btn)btn.textContent=isDark?'☀️':'🌙';
}
function initDarkMode(){
  if(localStorage.getItem('darkMode')==='1'){
    document.body.classList.add('dark');
    // Update dropdown
    const icon=document.getElementById('dark-icon');
    const text=document.getElementById('dark-text');
    if(icon)icon.textContent='☀️';
    if(text)text.textContent='Mode Terang';
    // Update old button if exists
    const btn=document.getElementById('btn-dark');
    if(btn)btn.textContent='☀️';
  }
}

// ═══ MULTI-BAHASA ═══
// ═══ HOME ALERTS ═══
async function renderHomeAlerts(){
  const alerts=[];
  const today=new Date().toISOString().split('T')[0];
  const kandangList=await dbGetKandang();
  const aktif=kandangList.filter(k=>k.status==='Aktif');

  // 1. Alert stok pakan rendah
  try{
    const pakans=await dbGetDaftarPakan();
    for(const p of pakans){
      const stok=await calcStokPakan(p.nama);
      const min=parseFloat(p.stok_minimal)||0;
      if(min>0&&stok<min){
        alerts.push({type:'danger',icon:'🌾',title:'Stok Pakan Rendah',desc:p.nama+': '+stok.toFixed(1)+' kg (min: '+min+' kg)'});
      }
    }
  }catch(e){}

  // 2. Alert HDP turun drastis (≥10% dari hari sebelumnya)
  try{
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const yd=yesterday.toISOString().split('T')[0];
    const todayInputs=await dbGetInput({tanggal:today});
    const yestInputs=await dbGetInput({tanggal:yd});
    for(const ti of todayInputs){
      const yi=yestInputs.find(r=>r.kandang===ti.kandang);
      if(!yi)continue;
      const hdpToday=parseFloat(ti.data?.produksi?.hdp)||0;
      const hdpYest=parseFloat(yi.data?.produksi?.hdp)||0;
      if(hdpYest>0&&hdpToday>0){
        const drop=((hdpYest-hdpToday)/hdpYest)*100;
        if(drop>=10){
          alerts.push({type:'warn',icon:'📉',title:'HDP Turun Drastis',desc:ti.kandang+': '+hdpYest.toFixed(1)+'% → '+hdpToday.toFixed(1)+'% (turun '+drop.toFixed(1)+'%)'});
        }
      }
    }
  }catch(e){}

  // 3. Alert kandang aktif belum input hari ini
  try{
    const todayInputs=await dbGetInput({tanggal:today});
    const sudahInput=new Set(todayInputs.map(r=>r.kandang));
    for(const k of aktif){
      if(!sudahInput.has(k.nama)){
        alerts.push({type:'info',icon:'⏰',title:'Belum Input Hari Ini',desc:'Kandang '+k.nama+' belum ada data input untuk hari ini.'});
      }
    }
  }catch(e){}

  const el=document.getElementById('home-alerts');
  if(!el)return;
  if(!alerts.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='block';
  el.innerHTML=alerts.map(a=>`<div class="alert-item ${a.type}"><div class="ai-icon">${a.icon}</div><div class="ai-text"><div class="ai-title">${a.title}</div><div class="ai-desc">${a.desc}</div></div></div>`).join('');
}

// ═══ GRAFIK (Chart.js) ═══
let chartHDP=null,chartPerforma=null;

async function renderGrafik(){
  const {dari:dariStr, sampai:sampaiStr, kandang} = getLaporanRange();
  const now = new Date(sampaiStr);

  // ── HDP + FI Chart (Dual Axis) ──
  const inputs=await dbGetInput({dari:dariStr,sampai:sampaiStr,kandang});
  
  // Cari tanggal data pertama yang ada
  const tanggalAda = inputs.map(r=>r.tanggal).sort();
  const startDate = tanggalAda.length > 0 ? new Date(tanggalAda[0]) : new Date(dariStr);
  
  // Build map untuk HDP dan FI per tanggal
  const dataMap={};
  inputs.forEach(r=>{
    const tgl=r.tanggal;
    const hdp=parseFloat(r.data?.produksi?.hdp)||null;
    const populasi=parseFloat(r.data?.sisa_ayam)||1;
    let totalPakanKg=0;
    (r.data?.pakan||[]).forEach(p=>{totalPakanKg+=parseFloat(p.jumlah)||0;});
    const fi=populasi>0&&totalPakanKg>0?parseFloat(((totalPakanKg*1000)/populasi).toFixed(1)):null;
    
    if(!dataMap[tgl])dataMap[tgl]={hdp:[],fi:[]};
    if(hdp!==null&&hdp>0&&hdp<=100)dataMap[tgl].hdp.push(hdp);
    if(fi!==null&&fi>0&&fi<=200)dataMap[tgl].fi.push(fi);
  });
  
  // Generate labels dan data dari startDate sampai now
  const labels=[];const hdpData=[];const fiData=[];
  let prevMonth=null;
  for(let d=new Date(startDate);d<=now;d.setDate(d.getDate()+1)){
    const s=d.toISOString().split('T')[0];
    const tanggal=d.getDate();
    const bulan=d.getMonth();
    // Label: tanggal saja, tapi reset ke 1 kalau pindah bulan
    labels.push(prevMonth!==null&&bulan!==prevMonth?`1 (${(bulan+1).toString().padStart(2,'0')})`:tanggal.toString());
    prevMonth=bulan;
    
    const v=dataMap[s];
    const avgHdp=v&&v.hdp.length?parseFloat((v.hdp.reduce((a,b)=>a+b,0)/v.hdp.length).toFixed(1)):null;
    const avgFi=v&&v.fi.length?parseFloat((v.fi.reduce((a,b)=>a+b,0)/v.fi.length).toFixed(1)):null;
    hdpData.push(avgHdp);
    fiData.push(avgFi);
  }
  
  const ctxHDP=document.getElementById('chart-hdp').getContext('2d');
  if(chartHDP)chartHDP.destroy();
  chartHDP=new Chart(ctxHDP,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'HDP (%)',data:hdpData,borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.1)',tension:.3,fill:true,pointRadius:3,spanGaps:true,yAxisID:'yL'},
        {label:'FI (g/ekor)',data:fiData,borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,.1)',tension:.3,fill:false,pointRadius:3,spanGaps:true,yAxisID:'yR'}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'top',labels:{usePointStyle:true,padding:12}},
        tooltip:{callbacks:{
          label:ctx=>{
            const label=ctx.dataset.label||'';
            const val=ctx.parsed.y;
            return val!==null?`${label}: ${val}${label.includes('HDP')?'%':' g/ekor'}`:'Tidak ada data';
          }
        }}
      },
      scales:{
        yL:{type:'linear',position:'left',title:{display:true,text:'HDP (%)'},beginAtZero:false,ticks:{callback:v=>v+'%'}},
        yR:{type:'linear',position:'right',title:{display:true,text:'FI (g/ekor)'},beginAtZero:false,grid:{drawOnChartArea:false}},
        x:{ticks:{maxTicksLimit:15,autoSkip:true}}
      }
    }
  });

  // ── Performa Mingguan Chart (HD, FI, EW, FCR) ──
  // Ambil semua data kandang yang dipilih, group per minggu umur ayam
  const semuaKandang = await dbGetKandang();
  const allKandangs = kandang ? semuaKandang.filter(k=>k.nama===kandang||k.id===kandang) : semuaKandang;
  const weekMap = {}; // key: "Minggu X", value: {hd:[], fi:[], ew:[], fcr:[]}

  for(const k of allKandangs){
    if(!k || k.status==='selesai') continue;
    const chickInDate = new Date(k.chickin);
    const umurChickIn = parseInt(k.umur_masuk)||0;
    const allInputs = await dbGetInput({kandang: k.nama});
    for(const r of allInputs){
      const tgl = new Date(r.tanggal);
      const hariKe = Math.floor((tgl - chickInDate)/(1000*60*60*24));
      const umurHari = umurChickIn + hariKe;
      const minggu = Math.floor(umurHari/7)+1;
      const key = `${minggu}`; // Label X axis: angka minggu saja (13, 14, 15...)
      if(!weekMap[key]) weekMap[key]={hd:[],fi:[],ew:[],fcr:[]};

      const hdp = parseFloat(r.data?.produksi?.hdp)||null;
      // Populasi: ambil dari sisa_ayam data harian, fallback ke populasi kandang
      const populasi = parseFloat(r.data?.sisa_ayam)||parseFloat(k.populasi)||1;
      // FI: total pakan hari itu (gram/ekor) — pakan dalam kg * 1000 / populasi
      let totalPakanKg=0;
      (r.data?.pakan||[]).forEach(p=>{ totalPakanKg+=parseFloat(p.jumlah)||0; });
      const fi = populasi>0 && totalPakanKg>0
        ? parseFloat(((totalPakanKg*1000)/populasi).toFixed(1))
        : null;
      // EW: berat rata-rata telur (gram/butir)
      const ew = parseFloat(r.data?.produksi?.berat_rata)||null;
      // FCR: kg pakan / kg telur produksi hari itu
      const totalTelurKg = parseFloat(r.data?.produksi?.total?.kilo)||0;
      const fcr = totalTelurKg>0 ? parseFloat((totalPakanKg/totalTelurKg).toFixed(2)) : null;

      if(hdp!==null && hdp>0 && hdp<=100) weekMap[key].hd.push(hdp);
      if(fi!==null && fi>0 && fi<=200) weekMap[key].fi.push(fi); // max 200gr/ekor wajar
      if(ew!==null && ew>0 && ew<=80) weekMap[key].ew.push(ew);  // max 80gr/butir wajar
      if(fcr!==null && fcr>0 && fcr<10) weekMap[key].fcr.push(fcr);
    }
  }

  // Sort minggu secara numerik
  const avg = arr => arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : null;
  const weekKeys = Object.keys(weekMap).sort((a,b)=>parseInt(a)-parseInt(b));
  const wLabels = weekKeys;
  const hdData  = weekKeys.map(k=>avg(weekMap[k].hd));
  const wFiData  = weekKeys.map(k=>avg(weekMap[k].fi));

  const ctxP=document.getElementById('chart-performa').getContext('2d');
  if(chartPerforma)chartPerforma.destroy();
  chartPerforma=new Chart(ctxP,{
    type:'line',
    data:{
      labels:wLabels,
      datasets:[
        {label:'FI (g/ekor)',data:wFiData,borderColor:'#2563eb',borderWidth:2,tension:.4,fill:false,pointRadius:3,pointHoverRadius:5,spanGaps:true},
        {label:'HD / HDP (%)',data:hdData,borderColor:'#16a34a',borderWidth:2,tension:.4,fill:false,pointRadius:3,pointHoverRadius:5,spanGaps:true}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'line',padding:16}},
        tooltip:{callbacks:{
          label:ctx=>{
            const v=ctx.parsed.y;
            if(v===null||v===undefined)return null;
            const units={
              'FI (g/ekor)':'g/ekor',
              'HD / HDP (%)':'%'
            };
            const u=units[ctx.dataset.label]||'';
            return `${ctx.dataset.label}: ${v}${u}`;
          }
        }}
      },
      scales:{
        y:{
          title:{display:true,text:'FI (g) / HD (%)'},
          min:0,
          grid:{color:'rgba(0,0,0,.06)'},
          ticks:{color:'#374151'}
        },
        x:{
          title:{display:true,text:'Minggu Umur Ayam (Mgg ke-)'},
          ticks:{maxTicksLimit:20,color:'#374151'},
          grid:{color:'rgba(0,0,0,.04)'}
        }
      }
    }
  });
}

// ═══ FCR (Feed Conversion Ratio) ═══
function getFCRRange(){
  const p=document.getElementById('fcr-periode').value;
  const now=new Date();
  let dari,sampai=now.toISOString().split('T')[0];
  if(p==='minggu'){const d=new Date(now);d.setDate(d.getDate()-6);dari=d.toISOString().split('T')[0];}
  else if(p==='bulan'){dari=now.getFullYear()+'-'+(String(now.getMonth()+1).padStart(2,'0'))+'-01';}
  else{dari=document.getElementById('fcr-dari').value||sampai;sampai=document.getElementById('fcr-sampai').value||sampai;}
  return{dari,sampai,kandang:document.getElementById('fcr-kandang').value};
}

async function renderFCR(){
  const {dari, sampai, kandang} = getLaporanRange();
  const inputs=await dbGetInput({dari,sampai,kandang});
  // Group by kandang
  const byKandang={};
  inputs.forEach(r=>{
    const k=r.kandang;
    if(!byKandang[k])byKandang[k]={pakanKg:0,telurKg:0};
    // Pakan
    const pakanRows=r.data?.pakan||[];
    pakanRows.forEach(p=>{byKandang[k].pakanKg+=parseFloat(p.jumlah)||0;});
    // Telur
    byKandang[k].telurKg+=parseFloat(r.data?.produksi?.total?.kilo)||0;
  });
  const rows=Object.entries(byKandang).map(([nama,v])=>{
    const fcr=v.telurKg>0?parseFloat((v.pakanKg/v.telurKg).toFixed(2)):null;
    let rating='—',ratingClass='';
    if(fcr!==null){
      if(fcr<=2.0){rating='Baik';ratingClass='baik';}
      else if(fcr<=2.5){rating='Cukup';ratingClass='cukup';}
      else{rating='Buruk';ratingClass='buruk';}
    }
    return{nama,pakanKg:v.pakanKg,telurKg:v.telurKg,fcr,rating,ratingClass};
  });
  // Summary cards
  const totalPakan=rows.reduce((s,r)=>s+r.pakanKg,0);
  const totalTelur=rows.reduce((s,r)=>s+r.telurKg,0);
  const avgFCR=totalTelur>0?parseFloat((totalPakan/totalTelur).toFixed(2)):null;
  let avgRating='—',avgClass='';
  if(avgFCR!==null){if(avgFCR<=2.0){avgRating='Baik';avgClass='baik';}else if(avgFCR<=2.5){avgRating='Cukup';avgClass='cukup';}else{avgRating='Buruk';avgClass='buruk';}}
  document.getElementById('fcr-summary').innerHTML=
    `<div class="fcr-card"><div class="fc-label">Total Pakan</div><div class="fc-val">${totalPakan.toFixed(1)}<small style="font-size:.9rem"> kg</small></div></div>`+
    `<div class="fcr-card"><div class="fc-label">Total Telur</div><div class="fc-val">${totalTelur.toFixed(1)}<small style="font-size:.9rem"> kg</small></div></div>`+
    `<div class="fcr-card"><div class="fc-label">FCR Rata-rata</div><div class="fc-val">${avgFCR??'—'}</div>${avgFCR!==null?'<span class="fc-rating '+avgClass+'">'+avgRating+'</span>':''}</div>`+
    `<div class="fcr-card"><div class="fc-label">Kandang Dianalisis</div><div class="fc-val">${rows.length}</div></div>`;
  const tbody=document.getElementById('fcr-tbody');
  const empty=document.getElementById('fcr-empty');
  tbody.innerHTML='';
  if(!rows.length){empty.style.display='block';return;}
  empty.style.display='none';
  rows.forEach(r=>{
    tbody.innerHTML+=`<tr><td><strong>${esc(r.nama)}</strong></td><td>${r.pakanKg.toFixed(1)} kg</td><td>${r.telurKg.toFixed(1)} kg</td><td><strong>${r.fcr??'—'}</strong></td><td>${r.fcr!==null?'<span class="fc-rating '+r.ratingClass+'">'+r.rating+'</span>':'—'}</td></tr>`;
  });
}

// ═══ RINGKASAN SIKLUS ═══
let _siklusData=null;
async function showRingkasanSiklus(namaKandang){
  showToast('⏳ Memuat ringkasan...');
  const list=cache.get('kandang_list')||await dbGetKandang();
  const k=list.find(x=>x.nama===namaKandang);
  if(!k){showToast('❌ Kandang tidak ditemukan');return;}
  const inputs=await dbGetInput({kandang:namaKandang});
  const penjualanAll=await dbGetPenjualan();
  const kiriman=await dbGetKiriman();
  // Hitung total produksi
  let totalButir=0,totalKgTelur=0,totalPakanKg=0,totalDeplesi=0;
  inputs.forEach(r=>{
    const d=r.data;if(!d)return;
    totalButir+=parseInt(d.produksi?.total?.butir)||0;
    totalKgTelur+=parseFloat(d.produksi?.total?.kilo)||0;
    totalDeplesi+=(parseInt(d.deplesi?.mati)||0)+(parseInt(d.deplesi?.afkir)||0);
    (d.pakan||[]).forEach(p=>{totalPakanKg+=parseFloat(p.jumlah)||0;});
  });
  // Hitung pendapatan dari penjualan (filter by kandang tidak bisa langsung, ambil semua)
  const totalPendapatan=penjualanAll.reduce((s,j)=>s+(parseInt(j.grand_total)||0),0);
  // Hitung biaya pakan dari kiriman
  const totalBiayaPakan=kiriman.reduce((s,ki)=>s+(parseFloat(ki.total_harga)||0),0);
  // Hitung biaya operasional dari input
  let totalBiayaOps=0;
  inputs.forEach(r=>{(r.data?.biaya||[]).forEach(b=>{totalBiayaOps+=parseFloat(b.jumlah)||0;});});
  const totalBiaya=totalBiayaPakan+totalBiayaOps;
  const labaRugi=totalPendapatan-totalBiaya;
  const fcr=totalKgTelur>0?parseFloat((totalPakanKg/totalKgTelur).toFixed(2)):null;
  const fcrRating=fcr===null?'—':fcr<=2.0?'Baik':fcr<=2.5?'Cukup':'Buruk';
  const pctDeplesi=k.populasi>0?((totalDeplesi/k.populasi)*100).toFixed(2):0;
  const avgHDP=inputs.length>0?(inputs.reduce((s,r)=>s+(parseFloat(r.data?.produksi?.hdp)||0),0)/inputs.length).toFixed(1):0;
  _siklusData={namaKandang,k,totalButir,totalKgTelur,totalPakanKg,totalDeplesi,totalPendapatan,totalBiayaPakan,totalBiayaOps,labaRugi,fcr,fcrRating,pctDeplesi,avgHDP,hari:inputs.length};
  const fmt=n=>'Rp '+Math.abs(n).toLocaleString('id-ID');
  document.getElementById('modal-siklus-title').textContent='📋 Ringkasan Siklus — '+namaKandang;
  document.getElementById('modal-siklus-body').innerHTML=`
    <div class="siklus-box"><h4>🏠 Info Kandang</h4>
      <div class="siklus-row"><span class="sr-label">Nama Kandang</span><span class="sr-val">${esc(k.nama)}</span></div>
      <div class="siklus-row"><span class="sr-label">Periode</span><span class="sr-val">${fmtTgl(k.chickin)}</span></div>
      <div class="siklus-row"><span class="sr-label">Populasi Masuk</span><span class="sr-val">${(k.populasi||0).toLocaleString('id-ID')} ekor</span></div>
      <div class="siklus-row"><span class="sr-label">Status</span><span class="sr-val">${k.status}</span></div>
      <div class="siklus-row"><span class="sr-label">Hari Data Tercatat</span><span class="sr-val">${inputs.length} hari</span></div>
    </div>
    <div class="siklus-box"><h4>🥚 Produksi</h4>
      <div class="siklus-row"><span class="sr-label">Total Produksi</span><span class="sr-val">${totalButir.toLocaleString('id-ID')} butir</span></div>
      <div class="siklus-row"><span class="sr-label">Total Berat Telur</span><span class="sr-val">${totalKgTelur.toFixed(1)} kg</span></div>
      <div class="siklus-row"><span class="sr-label">Rata-rata HDP</span><span class="sr-val">${avgHDP}%</span></div>
    </div>
    <div class="siklus-box"><h4>🐔 Deplesi</h4>
      <div class="siklus-row"><span class="sr-label">Total Deplesi</span><span class="sr-val">${totalDeplesi.toLocaleString('id-ID')} ekor</span></div>
      <div class="siklus-row"><span class="sr-label">% Deplesi</span><span class="sr-val">${pctDeplesi}%</span></div>
    </div>
    <div class="siklus-box"><h4>🌾 Pakan & FCR</h4>
      <div class="siklus-row"><span class="sr-label">Total Pakan</span><span class="sr-val">${totalPakanKg.toFixed(1)} kg</span></div>
      <div class="siklus-row"><span class="sr-label">FCR</span><span class="sr-val">${fcr??'—'} <span style="font-size:.75rem;color:#888">(${fcrRating})</span></span></div>
    </div>
    <div class="siklus-box"><h4>💰 Keuangan</h4>
      <div class="siklus-row"><span class="sr-label">Total Pendapatan</span><span class="sr-val green">${fmt(totalPendapatan)}</span></div>
      <div class="siklus-row"><span class="sr-label">Biaya Pakan</span><span class="sr-val red">${fmt(totalBiayaPakan)}</span></div>
      <div class="siklus-row"><span class="sr-label">Biaya Operasional</span><span class="sr-val red">${fmt(totalBiayaOps)}</span></div>
      <div class="siklus-row"><span class="sr-label">Total Biaya</span><span class="sr-val red">${fmt(totalBiaya)}</span></div>
      <div class="siklus-row" style="border-top:2px solid #e2e8f0;margin-top:4px;padding-top:8px"><span class="sr-label" style="font-weight:700">Laba / Rugi</span><span class="sr-val ${labaRugi>=0?'green':'red'}" style="font-size:1.1rem">${labaRugi>=0?'':'−'}${fmt(labaRugi)}</span></div>
    </div>`;
  document.getElementById('modal-siklus').style.display='flex';
}

function exportSiklus(){
  if(!_siklusData)return;
  const d=_siklusData;
  let csv='Ringkasan Siklus,'+d.namaKandang+'\n';
  csv+='Periode,'+d.k.chickin+'\nPopulasi Masuk,'+d.k.populasi+'\nHari Tercatat,'+d.hari+'\n\n';
  csv+='PRODUKSI\nTotal Butir,'+d.totalButir+'\nTotal kg Telur,'+d.totalKgTelur+'\nRata-rata HDP,'+d.avgHDP+'%\n\n';
  csv+='DEPLESI\nTotal Deplesi,'+d.totalDeplesi+'\n% Deplesi,'+d.pctDeplesi+'%\n\n';
  csv+='PAKAN & FCR\nTotal Pakan kg,'+d.totalPakanKg+'\nFCR,'+d.fcr+'\nRating FCR,'+d.fcrRating+'\n\n';
  csv+='KEUANGAN\nPendapatan,'+d.totalPendapatan+'\nBiaya Pakan,'+d.totalBiayaPakan+'\nBiaya Ops,'+d.totalBiayaOps+'\nLaba/Rugi,'+d.labaRugi+'\n';
  downloadCSV(csv,'siklus_'+d.namaKandang+'_'+new Date().toISOString().split('T')[0]+'.csv');
}

// ═══ BACKUP & RESTORE ═══
async function backupData(){
  showToast('⏳ Menyiapkan backup...');
  try{
    const[users,kandang,inputs,penjualan,daftarPakan,kiriman,kas]=await Promise.all([
      dbGetUsers(),dbGetKandang(),dbGetInput({}),dbGetPenjualan({}),dbGetDaftarPakan(),dbGetKiriman({}),dbGetKas({})
    ]);
    const backup={
      version:'1.0',exported_at:new Date().toISOString(),app:'Teaching Farm UB',
      data:{users,kandang,inputs,penjualan,daftar_pakan:daftarPakan,kiriman_pakan:kiriman,kas_operasional:kas}
    };
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='backup_peternakan_'+new Date().toISOString().split('T')[0]+'.json';
    a.click();URL.revokeObjectURL(url);
    showToast('✅ Backup berhasil didownload!');
  }catch(e){showToast('❌ Gagal backup: '+e.message);}
}

async function backupCSVAll(){
  showToast('⏳ Menyiapkan CSV...');
  try{
    const inputs=await dbGetInput({});
    let csv='Tanggal,Kandang,Sisa Ayam,Deplesi,Prod Butir,Prod kg,HDP,Pakan kg,Air Liter\n';
    inputs.forEach(r=>{
      const d=r.data;if(!d)return;
      const tp=(d.pakan||[]).reduce((s,p)=>s+(parseFloat(p.jumlah)||0),0);
      csv+=`${d.tanggal},${d.kandang},${d.sisa_ayam||0},${(d.deplesi?.mati||0)+(d.deplesi?.afkir||0)},${d.produksi?.total?.butir||0},${d.produksi?.total?.kilo||0},${d.produksi?.hdp||0},${tp},${d.air_liter||0}\n`;
    });
    downloadCSV(csv,'semua_input_'+new Date().toISOString().split('T')[0]+'.csv');
    showToast('✅ CSV berhasil didownload!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function restoreData(input){
  const file=input.files[0];if(!file)return;
  const statusEl=document.getElementById('restore-status');
  statusEl.textContent='⏳ Membaca file...';
  try{
    const text=await file.text();
    const backup=JSON.parse(text);
    if(!backup.data||!backup.version){statusEl.textContent='❌ Format file tidak valid!';return;}
    if(!confirm('⚠️ Restore akan menimpa data yang ada. Lanjutkan?')){statusEl.textContent='';input.value='';return;}
    statusEl.textContent='⏳ Merestore data...';
    const d=backup.data;
    // Restore users
    if(d.users?.length){for(const u of d.users){try{await SB.upsert('users',u);}catch(e){}}}
    // Restore kandang
    if(d.kandang?.length){for(const k of d.kandang){try{await SB.upsert('kandang',k);}catch(e){}}}
    // Restore input harian
    if(d.inputs?.length){for(const r of d.inputs){try{await SB.upsert('input_harian',r);}catch(e){}}}
    // Restore penjualan
    if(d.penjualan?.length){for(const p of d.penjualan){try{await SB.upsert('penjualan',p);}catch(e){}}}
    // Restore daftar pakan
    if(d.daftar_pakan?.length){for(const p of d.daftar_pakan){try{await SB.upsert('daftar_pakan',p);}catch(e){}}}
    // Restore kiriman pakan
    if(d.kiriman_pakan?.length){for(const k of d.kiriman_pakan){try{await SB.upsert('kiriman_pakan',k);}catch(e){}}}
    // Restore kas
    if(d.kas_operasional?.length){for(const k of d.kas_operasional){try{await SB.upsert('kas_operasional',k);}catch(e){}}}
    // Clear cache
    ['users','kandang_list','input_harian','penjualan_list','daftar_pakan','kiriman_pakan','kas_list'].forEach(k=>cache.del(k));
    statusEl.innerHTML='<span style="color:#16a34a;font-weight:700">✅ Restore berhasil! Halaman akan dimuat ulang...</span>';
    setTimeout(()=>location.reload(),2000);
  }catch(e){statusEl.textContent='❌ Gagal restore: '+e.message;}
  input.value='';
}

// ═══ KAS OPERASIONAL ═══
async function renderKasSaldo(kandangParam){
  // Ambil kandang dari parameter atau dari dropdown biaya-kandang atau kandang input
  const kandang=kandangParam||(document.getElementById('biaya-kandang')?.value||document.getElementById('kandang')?.value||'').trim();
  const bar=document.getElementById('kas-saldo-bar');
  if(!bar)return;
  // Tampilkan untuk KAS_VIEW (supervisor ke atas)
  if(!can('KAS_VIEW')){bar.style.display='none';return;}
  bar.style.display='flex';
  try{
    const list=await dbGetKas(kandang?{kandang}:{});
    const masuk=list.filter(k=>k.jenis==='masuk').reduce((s,k)=>s+(parseFloat(k.jumlah)||0),0);
    const keluar=list.filter(k=>k.jenis==='keluar').reduce((s,k)=>s+(parseFloat(k.jumlah)||0),0);
    const saldo=masuk-keluar;
    document.getElementById('ks-masuk').textContent='Rp '+masuk.toLocaleString('id-ID');
    document.getElementById('ks-keluar').textContent='Rp '+keluar.toLocaleString('id-ID');
    const saldoEl=document.getElementById('ks-saldo');
    saldoEl.textContent='Rp '+Math.abs(saldo).toLocaleString('id-ID')+(saldo<0?' (Minus)':'');
    saldoEl.className='ks-val'+(saldo<0?' red':saldo<500000?' orange':'');
    bar.className='kas-saldo-bar'+(saldo<0?' danger':saldo<500000?' warn':'');
  }catch(e){console.warn('kas saldo error',e);}
  // Tombol Alokasi hanya untuk manajer/admin
  const btnMasuk=document.getElementById('btn-kas-masuk');
  if(btnMasuk)btnMasuk.style.display=can('KAS_MASUK')?'':'none';
  
}

async function openKasModal(jenis){
  if(jenis==='masuk'&&!can('KAS_MASUK')){showToast('⚠️ Hanya Manajer/Admin yang bisa alokasi kas!');return;}
  if(jenis==='keluar'&&!can('KAS_KELUAR')){showToast('⚠️ Hanya Supervisor ke atas yang bisa catat pengeluaran!');return;}
  document.getElementById('mk3-jenis').value=jenis;
  document.getElementById('modal-kas-title').textContent=jenis==='masuk'?'💰 Alokasi Kas dari Manager':'📤 Catat Pengeluaran Kas';
  document.getElementById('mk3-tgl').value=new Date().toISOString().split('T')[0];
  document.getElementById('mk3-jumlah').value='';
  document.getElementById('mk3-ket').value='';
  const sel=document.getElementById('mk3-kandang');
  const list=cache.get('kandang_list')||await dbGetKandang();
  sel.innerHTML='<option value="">Semua Kandang</option>';
  list.forEach(k=>{const o=document.createElement('option');o.value=k.nama;o.textContent=k.nama;sel.appendChild(o);});
  // Ambil kandang dari halaman biaya atau input harian
  const aktif=document.getElementById('biaya-kandang')?.value||document.getElementById('kandang')?.value;
  if(aktif)sel.value=aktif;
  document.getElementById('modal-kas').style.display='flex';
}

async function saveKas(){
  const jenis=document.getElementById('mk3-jenis').value;
  const tanggal=document.getElementById('mk3-tgl').value;
  const jumlah=parseFloat(document.getElementById('mk3-jumlah').value)||0;
  const ket=document.getElementById('mk3-ket').value.trim();
  const kandang=document.getElementById('mk3-kandang').value;
  const kategori=jenis==='masuk'?'Alokasi Dana':'Operasional';

  if(!tanggal){showToast('⚠️ Tanggal wajib diisi!');return;}
  if(!jumlah||jumlah<=0){showToast('⚠️ Jumlah harus lebih dari 0!');return;}

  showToast('⏳ Menyimpan...');
  try{
    await dbSaveKas({tanggal,jenis,kategori,jumlah,keterangan:ket,kandang:kandang||null,user_input:currentUser?.username||''});
    closeModal('modal-kas');
    await renderKasSaldo();
    await dbSaveLog('TAMBAH','kas_operasional',null,null,
      {tanggal,jenis,kategori,jumlah,kandang:kandang||null},
      `${jenis==='masuk'?'Alokasi':'Pengeluaran'} kas: Rp ${jumlah.toLocaleString('id-ID')}${kandang?' ('+kandang+')':''}`);
    showToast(jenis==='masuk'?'✅ Alokasi kas disimpan!':'✅ Pengeluaran kas dicatat!');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}
// ═══ MASTER DATA ═══
const MASTER_ROLES = ['superadmin','admin','manajer'];
function canMaster(){ return MASTER_ROLES.includes(currentUser?.role); }

let _currentMasterType = 'pakan';

function switchMTab(tab){
  _currentMasterType = tab;
  ['pakan','supplier','vitamin','obat','vaksin','pelanggan'].forEach(t=>{
    const btn = document.getElementById(`smtab-${t}`);
    const content = document.getElementById(`smtab-content-${t}`);
    if(btn) btn.classList.toggle('active', t===tab);
    if(content) content.style.display = t===tab ? '' : 'none';
  });
  renderMasterTab(tab);
}

async function renderMaster(){
  const canEdit = canMaster();
  ['pakan','supplier','vitamin','obat','vaksin','pelanggan'].forEach(t=>{
    const btn = document.getElementById(`btn-add-${t}`);
    if(btn) btn.style.display = canEdit ? '' : 'none';
  });
  switchMTab('pakan');
}

async function renderMasterTab(tab){
  switch(tab){
    case 'pakan':     return renderMasterPakan();
    case 'supplier':  return renderMasterSupplier();
    case 'vitamin':   return renderMasterItem('vitamin',  'm-vitamin-tbody',  'm-vitamin-empty');
    case 'obat':      return renderMasterItem('obat',     'm-obat-tbody',     'm-obat-empty');
    case 'vaksin':    return renderMasterItem('vaksin',   'm-vaksin-tbody',   'm-vaksin-empty');
    case 'pelanggan': return renderMasterPelanggan();
  }
}

async function renderMasterPakan(){
  const list = await dbGetDaftarPakan();
  const tbody = document.getElementById('m-pakan-tbody');
  const empty = document.getElementById('m-pakan-empty');
  tbody.innerHTML = '';
  if(!list.length){ empty.style.display='block'; return; }
  empty.style.display = 'none';
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><span class="badge badge-gray" style="font-family:monospace">${esc(p.kode||'—')}</span></td>`+
      `<td><strong>${esc(p.nama)}</strong></td>`+
      `<td>${esc(p.satuan||'kg')}</td>`+
      `<td>${p.stok_minimal||0} kg</td>`+
      `<td><span class="badge ${p.active===false?'badge-gray':'badge-green'}">${p.active===false?'Nonaktif':'Aktif'}</span></td>`+
      `<td>`+
        (canMaster()?`<button class="btn-edit" onclick="openMasterModal('pakan','${p.id}')">✏️</button>`+
        `<button class="btn-del" onclick="deleteMasterData('pakan','${p.id}')">🗑</button>`:'')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

async function renderMasterSupplier(){
  const list = await dbGetSupplier();
  const tbody = document.getElementById('m-supplier-tbody');
  const empty = document.getElementById('m-supplier-empty');
  tbody.innerHTML = '';
  if(!list.length){ empty.style.display='block'; return; }
  empty.style.display = 'none';
  list.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><span class="badge badge-gray" style="font-family:monospace">${esc(s.kode)}</span></td>`+
      `<td><strong>${esc(s.nama)}</strong></td>`+
      `<td>${esc(s.telepon||'—')}</td>`+
      `<td><span class="badge ${s.active===false?'badge-gray':'badge-green'}">${s.active===false?'Nonaktif':'Aktif'}</span></td>`+
      `<td>`+
        (canMaster()?`<button class="btn-edit" onclick="openMasterModal('supplier','${s.id}')">✏️</button>`+
        `<button class="btn-del" onclick="deleteMasterData('supplier','${s.id}')">🗑</button>`:'')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

async function renderMasterItem(type, tbodyId, emptyId){
  const getters = {vitamin:dbGetVitamin, obat:dbGetObat, vaksin:dbGetVaksin};
  const list = await getters[type]();
  const suppliers = await dbGetSupplier();
  const supMap = Object.fromEntries(suppliers.map(s=>[s.id, s.nama]));
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  tbody.innerHTML = '';
  if(!list.length){ empty.style.display='block'; return; }
  empty.style.display = 'none';
  list.forEach(item=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><span class="badge badge-gray" style="font-family:monospace">${esc(item.kode)}</span></td>`+
      `<td><strong>${esc(item.nama)}</strong></td>`+
      `<td>${esc(supMap[item.supplier_id]||'—')}</td>`+
      `<td>${esc(item.satuan||'—')}</td>`+
      `<td><span class="badge ${item.active===false?'badge-gray':'badge-green'}">${item.active===false?'Nonaktif':'Aktif'}</span></td>`+
      `<td>`+
        (canMaster()?`<button class="btn-edit" onclick="openMasterModal('${type}','${item.id}')">✏️</button>`+
        `<button class="btn-del" onclick="deleteMasterData('${type}','${item.id}')">🗑</button>`:'')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

async function renderMasterPelanggan(){
  const list = await dbGetPelanggan();
  const tbody = document.getElementById('m-pelanggan-tbody');
  const empty = document.getElementById('m-pelanggan-empty');
  tbody.innerHTML = '';
  if(!list.length){ empty.style.display='block'; return; }
  empty.style.display = 'none';
  const tipeBadge = {retail:'badge-blue',grosir:'badge-green',distributor:'badge-orange'};
  list.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><span class="badge badge-gray" style="font-family:monospace">${esc(p.kode)}</span></td>`+
      `<td><strong>${esc(p.nama)}</strong></td>`+
      `<td><span class="badge ${tipeBadge[p.tipe]||'badge-gray'}">${esc(p.tipe||'—')}</span></td>`+
      `<td>${esc(p.telepon||'—')}</td>`+
      `<td><span class="badge ${p.active===false?'badge-gray':'badge-green'}">${p.active===false?'Nonaktif':'Aktif'}</span></td>`+
      `<td>`+
        (canMaster()?`<button class="btn-edit" onclick="openMasterModal('pelanggan','${p.id}')">✏️</button>`+
        `<button class="btn-del" onclick="deleteMasterData('pelanggan','${p.id}')">🗑</button>`:'')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

// ── Form Templates per tipe ──
const MASTER_FORMS = {
  pakan: (d={}) => `
    <input type="hidden" id="mf-id" value="${d.id||''}"/>
    <div class="field" style="margin-bottom:12px">
      <label>Kode Pakan</label>
      <input type="text" id="mf-kode" value="${esc(d.kode||'')}" placeholder="Auto-generate jika kosong" style="font-family:monospace"/>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Nama Pakan <span style="color:#dc2626">*</span></label>
      <input type="text" id="mf-nama" value="${esc(d.nama||'')}" placeholder="Mis. Pakan Layer A"/>
    </div>
    <div class="row">
      <div class="field">
        <label>Satuan</label>
        <select id="mf-satuan">
          <option value="kg" ${d.satuan==='kg'?'selected':''}>kg</option>
          <option value="sak" ${d.satuan==='sak'?'selected':''}>sak</option>
          <option value="ton" ${d.satuan==='ton'?'selected':''}>ton</option>
        </select>
      </div>
      <div class="field">
        <label>Min. Stok (kg)</label>
        <input type="number" id="mf-stok-min" value="${d.stok_minimal||0}" min="0"/>
      </div>
    </div>`,

  supplier: (d={}) => `
    <input type="hidden" id="mf-id" value="${d.id||''}"/>
    <div class="field" style="margin-bottom:12px">
      <label>Kode Supplier</label>
      <input type="text" id="mf-kode" value="${esc(d.kode||'')}" placeholder="Auto-generate jika kosong" style="font-family:monospace"/>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Nama Supplier <span style="color:#dc2626">*</span></label>
      <input type="text" id="mf-nama" value="${esc(d.nama||'')}" placeholder="Nama perusahaan/toko"/>
    </div>
    <div class="row">
      <div class="field">
        <label>Telepon</label>
        <input type="tel" id="mf-telepon" value="${esc(d.telepon||'')}" placeholder="08xx-xxxx-xxxx"/>
      </div>
    </div>
    <div class="field">
      <label>Alamat</label>
      <textarea id="mf-alamat" rows="2" placeholder="Alamat lengkap supplier">${esc(d.alamat||'')}</textarea>
    </div>`,

  _itemWithSupplier: (d={}, supplierOpts='', satuanOpts='') => `
    <input type="hidden" id="mf-id" value="${d.id||''}"/>
    <div class="field" style="margin-bottom:12px">
      <label>Kode</label>
      <input type="text" id="mf-kode" value="${esc(d.kode||'')}" placeholder="Auto-generate jika kosong" style="font-family:monospace"/>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Nama <span style="color:#dc2626">*</span></label>
      <input type="text" id="mf-nama" value="${esc(d.nama||'')}" placeholder="Nama produk"/>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Supplier</label>
      <select id="mf-supplier">${supplierOpts}</select>
    </div>
    <div class="row">
      <div class="field">
        <label>Satuan</label>
        <select id="mf-satuan">${satuanOpts}</select>
      </div>
      <div class="field">
        <label>Harga Satuan (Rp)</label>
        <input type="number" id="mf-harga" value="${d.harga_satuan||0}" min="0" step="100"/>
      </div>
    </div>
    <div class="field">
      <label>Keterangan</label>
      <input type="text" id="mf-ket" value="${esc(d.keterangan||'')}" placeholder="Keterangan tambahan"/>
    </div>`,

  pelanggan: (d={}) => `
    <input type="hidden" id="mf-id" value="${d.id||''}"/>
    <div class="field" style="margin-bottom:12px">
      <label>Kode Pelanggan</label>
      <input type="text" id="mf-kode" value="${esc(d.kode||'')}" placeholder="Auto-generate jika kosong" style="font-family:monospace"/>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Nama Pelanggan <span style="color:#dc2626">*</span></label>
      <input type="text" id="mf-nama" value="${esc(d.nama||'')}" placeholder="Nama pelanggan/toko"/>
    </div>
    <div class="row">
      <div class="field">
        <label>Tipe</label>
        <select id="mf-tipe">
          <option value="retail"      ${d.tipe==='retail'     ?'selected':''}>Retail</option>
          <option value="grosir"      ${d.tipe==='grosir'     ?'selected':''}>Grosir</option>
          <option value="distributor" ${d.tipe==='distributor'?'selected':''}>Distributor</option>
        </select>
      </div>
      <div class="field">
        <label>Telepon</label>
        <input type="tel" id="mf-telepon" value="${esc(d.telepon||'')}" placeholder="08xx-xxxx-xxxx"/>
      </div>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Harga Khusus (Rp/kg)</label>
      <input type="number" id="mf-harga" value="${d.harga_khusus||0}" min="0" step="100" placeholder="0 = harga normal"/>
    </div>
    <div class="field">
      <label>Alamat</label>
      <textarea id="mf-alamat" rows="2" placeholder="Alamat pelanggan">${esc(d.alamat||'')}</textarea>
    </div>`
};

async function openMasterModal(type, id=null){
  if(!canMaster()){showToast('⚠️ Hanya Supervisor ke atas yang bisa mengelola data master!');return;}

  _currentMasterType = type;
  const titles = {
    pakan:'Pakan', supplier:'Supplier', vitamin:'Vitamin',
    obat:'Obat', vaksin:'Vaksin', pelanggan:'Pelanggan'
  };
  document.getElementById('modal-master-title').textContent =
    (id ? '✏️ Edit ' : '＋ Tambah ') + titles[type];

  let data = {};
  if(id){
    const getters = {
      pakan: dbGetDaftarPakan, supplier: dbGetSupplier,
      vitamin: dbGetVitamin, obat: dbGetObat,
      vaksin: dbGetVaksin, pelanggan: dbGetPelanggan
    };
    const list = await getters[type]();
    data = list.find(x=>x.id===id) || {};
  }

  let html = '';
  if(type === 'pakan'){
    html = MASTER_FORMS.pakan(data);
  } else if(type === 'supplier'){
    html = MASTER_FORMS.supplier(data);
  } else if(type === 'pelanggan'){
    html = MASTER_FORMS.pelanggan(data);
  } else {
    // vitamin, obat, vaksin — perlu supplier dropdown
    const suppliers = await dbGetSupplier();
    const supOpts = '<option value="">-- Pilih Supplier --</option>' +
      suppliers.map(s=>`<option value="${s.id}" ${data.supplier_id===s.id?'selected':''}>${esc(s.nama)}</option>`).join('');
    const satuanMap = {
      vitamin: ['botol','sachet','liter'],
      obat:    ['botol','sachet','tablet','ampul'],
      vaksin:  ['dosis','vial','botol']
    };
    const satuanOpts = (satuanMap[type]||['pcs']).map(s=>
      `<option value="${s}" ${data.satuan===s?'selected':''}>${s}</option>`).join('');
    html = MASTER_FORMS._itemWithSupplier(data, supOpts, satuanOpts);
  }

  document.getElementById('modal-master-body').innerHTML = html;
  document.getElementById('modal-master').style.display = 'flex';
}

async function saveMasterData(){
  if(!canMaster()){showToast('⚠️ Tidak ada akses!');return;}

  const type = _currentMasterType;
  const id   = document.getElementById('mf-id')?.value || '';
  const nama = document.getElementById('mf-nama')?.value.trim() || '';
  let   kode = document.getElementById('mf-kode')?.value.trim() || '';

  if(!nama){showToast('⚠️ Nama wajib diisi!');return;}

  // Validasi duplikat nama (hanya untuk data baru atau jika nama berubah)
  if(!id || document.getElementById('mf-nama')?.dataset.originalNama !== nama) {
    const tableMap = {pakan:'daftar_pakan',supplier:'master_supplier',vitamin:'master_vitamin',
                      obat:'master_obat',vaksin:'master_vaksin',pelanggan:'master_pelanggan'};
    const getters  = {pakan:dbGetDaftarPakan,supplier:dbGetSupplier,vitamin:dbGetVitamin,
                      obat:dbGetObat,vaksin:dbGetVaksin,pelanggan:dbGetPelanggan};
    try {
      const existing = await getters[type]();
      const duplikat = existing.find(x => x.nama.toLowerCase() === nama.toLowerCase() && x.id !== id);
      if(duplikat) {
        showToast(`⚠️ Nama "${nama}" sudah terdaftar (${duplikat.kode})!`);
        return;
      }
    } catch(e) { /* lanjut jika gagal cek */ }
  }
  // Auto-generate kode hanya jika kosong DAN ini data baru (bukan edit)
  if(!kode && !id){
    const prefixMap = {pakan:'PKN',supplier:'SUP',vitamin:'VIT',obat:'OBT',vaksin:'VAK',pelanggan:'PLG'};
    const tableMap  = {pakan:'daftar_pakan',supplier:'master_supplier',vitamin:'master_vitamin',
                       obat:'master_obat',vaksin:'master_vaksin',pelanggan:'master_pelanggan'};
    showToast('⏳ Generate kode...');
    kode = await dbGenerateKode(tableMap[type], prefixMap[type]);
  } else if(!kode && id) {
    showToast('⚠️ Kode tidak boleh kosong saat edit!');
    return;
  }

  let obj = { kode, nama, active: true, created_by: currentUser?.username || '' };
  if(id) obj.id = id;

  // Tambah field spesifik per tipe
  if(type === 'pakan'){
    obj.satuan      = document.getElementById('mf-satuan')?.value || 'kg';
    obj.stok_minimal= parseFloat(document.getElementById('mf-stok-min')?.value)||0;
  } else if(type === 'supplier'){
    obj.telepon  = document.getElementById('mf-telepon')?.value.trim()||null;
    obj.alamat   = document.getElementById('mf-alamat')?.value.trim()||null;
  } else if(type === 'pelanggan'){
    obj.tipe         = document.getElementById('mf-tipe')?.value || 'retail';
    obj.telepon      = document.getElementById('mf-telepon')?.value.trim()||null;
    obj.harga_khusus = parseFloat(document.getElementById('mf-harga')?.value)||0;
    obj.alamat       = document.getElementById('mf-alamat')?.value.trim()||null;
  } else {
    // vitamin, obat, vaksin
    obj.supplier_id  = document.getElementById('mf-supplier')?.value||null;
    obj.satuan       = document.getElementById('mf-satuan')?.value||'botol';
    obj.harga_satuan = parseFloat(document.getElementById('mf-harga')?.value)||0;
    obj.keterangan   = document.getElementById('mf-ket')?.value.trim()||null;
  }

  showToast('⏳ Menyimpan...');
  try{
    const tableMap = {pakan:'daftar_pakan',supplier:'master_supplier',vitamin:'master_vitamin',
                      obat:'master_obat',vaksin:'master_vaksin',pelanggan:'master_pelanggan'};
    if(type === 'pakan'){
      await dbSaveDaftarPakan(obj);
    } else {
      await dbSaveMaster(tableMap[type], obj);
    }
    closeModal('modal-master');
    renderMasterTab(type);
    await dbSaveLog(id?'EDIT':'TAMBAH', 'master_'+type, obj.id||null, null, {kode,nama},
      `${id?'Edit':'Tambah'} master ${type}: ${kode} - ${nama}`);
    showToast(`✅ Data ${type} berhasil disimpan!`);
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

async function deleteMasterData(type, id){
  if(!canMaster()){showToast('⚠️ Tidak ada akses!');return;}
  if(!confirm('Nonaktifkan data ini? Data tidak akan dihapus permanen.'))return;
  try{
    const tableMap = {pakan:'daftar_pakan',supplier:'master_supplier',vitamin:'master_vitamin',
                      obat:'master_obat',vaksin:'master_vaksin',pelanggan:'master_pelanggan'};
    if(type === 'pakan'){
      await dbDeleteDaftarPakan(id);
    } else {
      await dbDeleteMaster(tableMap[type], id);
    }
    renderMasterTab(type);
    await dbSaveLog('NONAKTIF', tableMap[type]||type, id, null, {active:false},
      `Nonaktifkan master ${type}: id=${id}`);
    showToast('✅ Data dinonaktifkan.');
  }catch(e){showToast('❌ Gagal: '+e.message);}
}

// ═══ FORCE UPDATE PWA (Superadmin only) ═══
async function forceUpdatePWA() {
  if(currentUser?.role !== 'superadmin') {
    showToast('🔒 Hanya Superadmin yang bisa force update!');
    return;
  }
  if(!confirm('Hapus semua cache PWA dan muat ulang versi terbaru?\n\nSemua user yang membuka aplikasi akan otomatis mendapat versi baru.')) return;

  showToast('⏳ Menghapus cache lama...');

  try {
    // 1. Hapus semua cache
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // 2. Reset shown_version agar popup versi baru muncul lagi
    localStorage.removeItem('shown_version');

    // 3. Unregister service worker lama
    if('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    // 4. Log aktivitas
    await dbSaveLog('FORCE_UPDATE', 'system', null, null,
      { version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '—' },
      'Force update PWA oleh superadmin');

    showToast('✅ Cache dihapus! Memuat ulang...');

    // 5. Reload setelah delay singkat
    setTimeout(() => window.location.reload(true), 1500);

  } catch(e) {
    showToast('❌ Gagal: ' + e.message);
  }
}

async function broadcastUpdateNotice() {
  if(currentUser?.role !== 'superadmin') {
    showToast('🔒 Hanya Superadmin!');
    return;
  }
  // Reset shown_version di localStorage semua user tidak bisa dilakukan langsung
  // tapi kita bisa naikkan APP_VERSION di install-prompt.js
  showToast('💡 Untuk broadcast update: naikkan APP_VERSION di install-prompt.js lalu deploy ulang.');
}

// Tampilkan info versi & cache di tab backup
async function loadCacheInfo() {
  try {
    const keys = await caches.keys();
    const el = document.getElementById('current-cache-name');
    if(el) el.textContent = keys.join(', ') || 'Tidak ada cache';
    const ver = document.getElementById('current-app-version');
    if(ver) ver.textContent = typeof APP_VERSION !== 'undefined' ? 'V' + APP_VERSION : '—';
  } catch(e) {}
}

// ═══ GUDANG — TAB NON-PAKAN ═══
const NP_CONFIG = {
  vitamin:     { icon:'💊', label:'Vitamin',     satuan:'botol' },
  obat:        { icon:'🩺', label:'Obat',        satuan:'botol' },
  vaksin:      { icon:'💉', label:'Vaksin',      satuan:'dosis' },
  desinfektan: { icon:'🧴', label:'Desinfektan', satuan:'liter' },
  lainnya:     { icon:'📦', label:'Lainnya',     satuan:'pcs'   }
};

let _currentGTab = 'pakan';

function switchGTab(tab) {
  _currentGTab = tab;
  ['pakan','vitamin','obat','vaksin','desinfektan','lainnya'].forEach(t => {
    document.getElementById(`gtab-${t}`).classList.toggle('active', t === tab);
  });
  const isPakan = tab === 'pakan';
  document.getElementById('gtab-content-pakan').style.display    = isPakan ? '' : 'none';
  document.getElementById('gtab-content-nonpakan').style.display = isPakan ? 'none' : '';

  if(isPakan) {
    renderGudangPakan();
  } else {
    renderGudangNonPakan(tab);
  }
}

async function renderGudangPakan() {
  // Render semua konten pakan yang sudah ada
  await renderGudang();
}

async function renderGudangNonPakan(kategori) {
  const cfg = NP_CONFIG[kategori];
  if(!cfg) return;

  // Update judul
  document.getElementById('np-stok-icon').textContent     = cfg.icon;
  document.getElementById('np-stok-title').textContent    = `Stok ${cfg.label}`;
  document.getElementById('np-kiriman-title').textContent = `Kiriman ${cfg.label} Masuk`;
  document.getElementById('np-pakai-title').textContent   = `Riwayat Pemakaian ${cfg.label}`;

  // Render stok
  await renderNpStok(kategori);
  // Render kiriman
  await renderNpKiriman(kategori);
  // Render pemakaian
  await renderNpPakai(kategori);
}

async function renderNpStok(kategori) {
  const stokList = await dbGetStokNonPakan(kategori);
  const tbody = document.getElementById('np-stok-tbody');
  const empty = document.getElementById('np-stok-empty');
  tbody.innerHTML = '';
  if(!stokList.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  stokList.forEach(s => {
    const low = s.stok <= 0;
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><strong>${esc(s.nama)}</strong></td>`+
      `<td>${s.stok.toFixed(1)}</td>`+
      `<td>${esc(s.satuan)}</td>`+
      `<td>${s.harga ? 'Rp '+parseFloat(s.harga).toLocaleString('id-ID') : '—'}</td>`+
      `<td>${low
        ? '<span class="badge badge-red">Habis</span>'
        : '<span class="badge badge-green">Tersedia</span>'}</td>`;
    tbody.appendChild(tr);
  });
}

async function renderNpKiriman(kategori) {
  const list = await dbGetKirimanNonPakan({ kategori });
  const tbody = document.getElementById('np-kiriman-tbody');
  const empty = document.getElementById('np-kiriman-empty');
  tbody.innerHTML = '';
  if(!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.slice(0, 50).forEach(k => {
    const total = (parseFloat(k.jumlah)||0) * (parseFloat(k.harga_satuan)||0);
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${fmtTgl(k.tanggal)}</td>`+
      `<td><strong>${esc(k.nama_item)}</strong></td>`+
      `<td>${k.jumlah}</td>`+
      `<td>${esc(k.satuan||'—')}</td>`+
      `<td>${k.harga_satuan ? 'Rp '+parseFloat(k.harga_satuan).toLocaleString('id-ID') : '—'}</td>`+
      `<td>${total ? 'Rp '+total.toLocaleString('id-ID') : '—'}</td>`+
      `<td>${esc(k.supplier||'—')}</td>`+
      `<td>${esc(k.kandang||'Semua')}</td>`+
      `<td>`+
        (can('BIAYA') ? `<button class="btn-del" onclick="deleteNpKiriman('${k.id}','${kategori}')">🗑</button>` : '')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

async function renderNpPakai(kategori) {
  const list = await dbGetPemakaianNonPakan({ kategori });
  const tbody = document.getElementById('np-pakai-tbody');
  const empty = document.getElementById('np-pakai-empty');
  tbody.innerHTML = '';
  if(!list.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.slice(0, 50).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${fmtTgl(p.tanggal)}</td>`+
      `<td><strong>${esc(p.nama_item)}</strong></td>`+
      `<td>${p.jumlah}</td>`+
      `<td>${esc(p.satuan||'—')}</td>`+
      `<td>${esc(p.kandang||'Semua')}</td>`+
      `<td>${esc(p.keterangan||'—')}</td>`+
      `<td>`+
        (can('BIAYA') ? `<button class="btn-del" onclick="deleteNpPakai('${p.id}','${kategori}')">🗑</button>` : '')+
      `</td>`;
    tbody.appendChild(tr);
  });
}

// ── Modal Kiriman Non-Pakan ──
async function openNpKirimanModal() {
  const kategori = _currentGTab;
  const cfg = NP_CONFIG[kategori];
  if(!cfg) return;

  document.getElementById('npk-kategori').value = kategori;
  document.getElementById('modal-np-kiriman-title').textContent = `${cfg.icon} Catat Kiriman ${cfg.label}`;
  document.getElementById('npk-tgl').value = new Date().toISOString().split('T')[0];
  document.getElementById('npk-nama').value = '';
  document.getElementById('npk-jumlah').value = '';
  document.getElementById('npk-harga').value = '';
  document.getElementById('npk-total').value = '';
  document.getElementById('npk-supplier').value = '';
  document.getElementById('npk-ket').value = '';
  document.getElementById('npk-satuan').value = cfg.satuan;

  // Populate kandang
  const kandangList = cache.get('kandang_list') || await dbGetKandang();
  const sel = document.getElementById('npk-kandang');
  sel.innerHTML = '<option value="">Semua Kandang</option>';
  kandangList.forEach(k => {
    const o = document.createElement('option');
    o.value = k.nama; o.textContent = k.nama;
    sel.appendChild(o);
  });

  // Autocomplete nama dari master
  const getters = { vitamin: dbGetVitamin, obat: dbGetObat, vaksin: dbGetVaksin };
  if(getters[kategori]) {
    const masterList = await getters[kategori]();
    const dl = document.getElementById('npk-nama-list');
    dl.innerHTML = masterList.map(m => `<option value="${esc(m.nama)}">`).join('');
  }

  document.getElementById('modal-np-kiriman').style.display = 'flex';
}

function calcNpTotal() {
  const j = parseFloat(document.getElementById('npk-jumlah').value) || 0;
  const h = parseFloat(document.getElementById('npk-harga').value) || 0;
  document.getElementById('npk-total').value = j && h ? 'Rp ' + (j*h).toLocaleString('id-ID') : '';
}

async function saveNpKiriman() {
  const kategori = document.getElementById('npk-kategori').value;
  const tanggal  = document.getElementById('npk-tgl').value;
  const nama_item = document.getElementById('npk-nama').value.trim();
  const jumlah   = parseFloat(document.getElementById('npk-jumlah').value) || 0;
  const satuan   = document.getElementById('npk-satuan').value;
  const harga_satuan = parseFloat(document.getElementById('npk-harga').value) || 0;
  const harga_total  = jumlah * harga_satuan;
  const supplier = document.getElementById('npk-supplier').value.trim();
  const keterangan = document.getElementById('npk-ket').value.trim();
  const kandang  = document.getElementById('npk-kandang').value;

  if(!tanggal)    { showToast('⚠️ Tanggal wajib diisi!'); return; }
  if(!nama_item)  { showToast('⚠️ Nama item wajib diisi!'); return; }
  if(jumlah <= 0) { showToast('⚠️ Jumlah harus lebih dari 0!'); return; }

  showToast('⏳ Menyimpan...');
  try {
    await dbSaveKirimanNonPakan({
      tanggal, kategori, nama_item, jumlah, satuan,
      harga_satuan, harga_total, supplier: supplier||null,
      keterangan: keterangan||null, kandang: kandang||null,
      user_input: currentUser?.username || ''
    });
    await dbSaveLog('TAMBAH','kiriman_nonpakan',null,null,
      {tanggal,kategori,nama_item,jumlah,satuan},
      `Kiriman ${kategori}: ${nama_item} ${jumlah} ${satuan}`);
    closeModal('modal-np-kiriman');
    renderGudangNonPakan(kategori);
    showToast(`✅ Kiriman ${NP_CONFIG[kategori]?.label} disimpan!`);
  } catch(e) { showToast('❌ Gagal: ' + e.message); }
}

// ── Modal Pemakaian Non-Pakan ──
async function openNpPakaiModal() {
  const kategori = _currentGTab;
  const cfg = NP_CONFIG[kategori];
  if(!cfg) return;

  document.getElementById('npp-kategori').value = kategori;
  document.getElementById('modal-np-pakai-title').textContent = `📋 Catat Pemakaian ${cfg.label}`;
  document.getElementById('npp-tgl').value = new Date().toISOString().split('T')[0];
  document.getElementById('npp-nama').value = '';
  document.getElementById('npp-jumlah').value = '';
  document.getElementById('npp-ket').value = '';
  document.getElementById('npp-satuan').value = cfg.satuan;

  // Populate kandang
  const kandangList = cache.get('kandang_list') || await dbGetKandang();
  const sel = document.getElementById('npp-kandang');
  sel.innerHTML = '<option value="">Semua Kandang</option>';
  kandangList.forEach(k => {
    const o = document.createElement('option');
    o.value = k.nama; o.textContent = k.nama;
    sel.appendChild(o);
  });

  // Autocomplete dari stok yang ada
  const stokList = await dbGetStokNonPakan(kategori);
  const dl = document.getElementById('npp-nama-list');
  dl.innerHTML = stokList.map(s => `<option value="${esc(s.nama)}">`).join('');

  document.getElementById('modal-np-pakai').style.display = 'flex';
}

async function saveNpPakai() {
  const kategori  = document.getElementById('npp-kategori').value;
  const tanggal   = document.getElementById('npp-tgl').value;
  const nama_item = document.getElementById('npp-nama').value.trim();
  const jumlah    = parseFloat(document.getElementById('npp-jumlah').value) || 0;
  const satuan    = document.getElementById('npp-satuan').value;
  const keterangan = document.getElementById('npp-ket').value.trim();
  const kandang   = document.getElementById('npp-kandang').value;

  if(!tanggal)    { showToast('⚠️ Tanggal wajib diisi!'); return; }
  if(!nama_item)  { showToast('⚠️ Nama item wajib diisi!'); return; }
  if(jumlah <= 0) { showToast('⚠️ Jumlah harus lebih dari 0!'); return; }

  // Cek stok cukup
  const stokList = await dbGetStokNonPakan(kategori);
  const stokItem = stokList.find(s => s.nama === nama_item);
  if(stokItem && jumlah > stokItem.stok) {
    showToast(`⚠️ Stok ${nama_item} tidak cukup! Tersedia: ${stokItem.stok} ${stokItem.satuan}`);
    return;
  }

  showToast('⏳ Menyimpan...');
  try {
    await dbSavePemakaianNonPakan({
      tanggal, kategori, nama_item, jumlah, satuan,
      keterangan: keterangan||null, kandang: kandang||null,
      user_input: currentUser?.username || ''
    });
    await dbSaveLog('TAMBAH','pemakaian_nonpakan',null,null,
      {tanggal,kategori,nama_item,jumlah,satuan},
      `Pemakaian ${kategori}: ${nama_item} ${jumlah} ${satuan}`);
    closeModal('modal-np-pakai');
    renderGudangNonPakan(kategori);
    showToast(`✅ Pemakaian ${NP_CONFIG[kategori]?.label} dicatat!`);
  } catch(e) { showToast('❌ Gagal: ' + e.message); }
}

async function deleteNpKiriman(id, kategori) {
  if(!can('BIAYA')) { showToast('⚠️ Tidak ada akses!'); return; }
  if(!confirm('Hapus data kiriman ini?')) return;
  try {
    await dbDeleteKirimanNonPakan(id, kategori);
    await dbSaveLog('HAPUS','kiriman_nonpakan',id,null,null,`Hapus kiriman ${kategori}`);
    renderGudangNonPakan(kategori);
    showToast('🗑 Kiriman dihapus.');
  } catch(e) { showToast('❌ Gagal: ' + e.message); }
}

async function deleteNpPakai(id, kategori) {
  if(!can('BIAYA')) { showToast('⚠️ Tidak ada akses!'); return; }
  if(!confirm('Hapus data pemakaian ini?')) return;
  try {
    await dbDeletePemakaianNonPakan(id);
    await dbSaveLog('HAPUS','pemakaian_nonpakan',id,null,null,`Hapus pemakaian ${kategori}`);
    renderGudangNonPakan(kategori);
    showToast('🗑 Pemakaian dihapus.');
  } catch(e) { showToast('❌ Gagal: ' + e.message); }
}

// ═══ BOOT ═══
// Wait for DB script to load before initializing
let _bootAttempts = 0;
function bootApp(){
  _bootAttempts++;

  // Timeout 10 detik — jika DB tidak load, tampilkan login
  if(_bootAttempts > 100){
    console.error('❌ DB script gagal load setelah 10 detik');
    document.getElementById('loading-screen').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    return;
  }

  if(typeof dbGetUsers==='undefined'){
    setTimeout(bootApp,100);
    return;
  }

  try {
    initUsers();
    setTimeout(checkSession,300);
  } catch(e) {
    console.error('bootApp error:', e);
    document.getElementById('loading-screen').style.display='none';
    document.getElementById('login-screen').style.display='flex';
  }
}

// Jalankan setelah DOM siap
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}