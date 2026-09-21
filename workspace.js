/* Daily workspace: navigation only; existing modules own all data and saves. */
(() => {
  'use strict';
  const workflows = [
    ['students','Data Murid','Daftar dan urus senarai murid','users'],
    ['analytics-marks','Analisis Markah','Bandingkan keputusan dan taburan gred','chart-column'],
    ['marks','Pengisian Markah','Diagnostik, UPSA dan UASA','pencil-line'],
    ['pbd','Pengisian PBD','Rekod TP mengikut standard pembelajaran','clipboard-check'],
    ['completeness','Semak Kelengkapan','Kenal pasti rekod yang perlu dilengkapkan','list-checks'],
    ['headcount','Headcount & Sasaran','Semak perkembangan dan pencapaian','chart-no-axes-combined'],
    ['intervention','Intervensi & Susulan','Rancang sokongan dan tindakan guru','heart-handshake'],
    ['reports','Laporan & Cetakan','Jana pratonton, PDF dan laporan panitia','file-text']
  ];
  const allowed = id => typeof isViewAllowed === 'function' && isViewAllowed(id);
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let previousFocus;
  const dialog = document.createElement('dialog');
  dialog.id='workspace-search';
  dialog.setAttribute('aria-labelledby','workspace-search-title');
  dialog.innerHTML='<div class="workspace-dialog-head"><h2 id="workspace-search-title">Cari modul iSEJARAH</h2><button type="button" data-close aria-label="Tutup carian">Tutup</button></div><label for="workspace-query">Nama modul atau tugasan</label><input id="workspace-query" type="search" placeholder="Contoh: markah, murid, laporan…" autocomplete="off"><div id="workspace-results" aria-live="polite"></div>';
  document.body.append(dialog);
  function close(){dialog.close();previousFocus?.focus();}
  dialog.querySelector('[data-close]').addEventListener('click',close);
  // Search inputs may consume the first Escape to clear their value.
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  const query=dialog.querySelector('input');
  function results(){
    const q=query.value.trim().toLocaleLowerCase('ms');
    const items=[...document.querySelectorAll('#sidebar .nav-item[id^="nav-"]')]
      .map(el=>({id:el.id.slice(4),label:el.textContent.trim()}))
      .filter(x=>allowed(x.id)&&x.label.toLocaleLowerCase('ms').includes(q));
    const box=dialog.querySelector('#workspace-results');
    box.replaceChildren();
    items.forEach(item=>{
      const button=document.createElement('button');button.type='button';button.textContent=item.label;
      button.addEventListener('click',()=>{close();navigateTab(item.id);});box.append(button);
    });
    if(!items.length)box.textContent='Tiada modul sepadan. Cuba perkataan lain.';
  }
  query.addEventListener('input',results);
  query.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();dialog.querySelector('#workspace-results button')?.focus();}});
  function open(){
    const overlay=document.getElementById('login-overlay');
    if(overlay&&getComputedStyle(overlay).display!=='none')return;
    previousFocus=document.activeElement;query.value='';results();dialog.showModal();query.focus();
  }
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}});
  function install(){
    for(const id of ['view-dashboard','view-teacher-dashboard']){
      const view=document.getElementById(id);if(!view||view.querySelector('.workspace-home'))continue;
      const home=document.createElement('article');home.className='workspace-home';
      home.innerHTML='<div class="workspace-heading"><div class="workspace-heading-main"><div class="workspace-profile-avatar"><img class="workspace-profile-photo" alt="Gambar profil pengguna"><span class="workspace-profile-initial">G</span></div><div class="workspace-welcome-copy"><p>RUANG KERJA PANITIA</p><span class="workspace-greeting">Assalamualaikum, Cikgu!</span><h2>Cikgu nak buat apa hari ini?</h2><span class="workspace-subtitle">Pengisian, pemantauan dan pelaporan dalam satu tempat.</span></div></div><button type="button" data-search>Cari semua modul <small>Ctrl / ⌘ K</small></button></div><div class="workspace-actions"></div><details><summary>Panduan ringkas aliran kerja</summary><ol><li>Pilih sesi, tahun dan kelas sebelum membuat pengisian.</li><li>Masukkan Markah atau TP, kemudian tekan Simpan pada modul berkenaan.</li><li>Semak Kelengkapan dan Headcount untuk mengenal pasti tindakan susulan.</li><li>Jana Pratonton Laporan sebelum cetak atau simpan PDF.</li></ol><p>Tarikh ujian ditetapkan oleh Admin di Tetapan Sekolah. Semak status simpan dalam modul sebelum keluar.</p></details><p class="workspace-connection" role="status"></p>';
      home.querySelector('[data-search]').addEventListener('click',open);
      workflows.forEach(([target,label,note,icon])=>{
        const b=document.createElement('button');b.type='button';b.dataset.target=target;
        b.innerHTML=`<i data-lucide="${icon}" aria-hidden="true"></i><span class="workspace-action-copy"><strong>${escape(label)}</strong><small>${escape(note)}</small></span><span class="workspace-action-arrow" aria-hidden="true">→</span>`;
        b.addEventListener('click',()=>navigateTab(target));home.querySelector('.workspace-actions').append(b);
      });
      view.prepend(home);
    }
    if(!document.getElementById('workspace-sidebar-search')){
      const nav=document.querySelector('#nav-group-main');
      if(nav){const b=document.createElement('button');b.id='workspace-sidebar-search';b.type='button';b.textContent='Cari modul…';b.addEventListener('click',open);nav.prepend(b);}
    }
    refresh();window.lucide?.createIcons();
  }
  function refreshGreeting(profile={}){
    const rawName=String(profile.name||document.getElementById('user-display-name')?.textContent||'Cikgu').trim();
    const displayName=/^(cikgu|puan|encik|ustaz|ustazah|dr\.?|teacher)\b/i.test(rawName)?rawName:`Cikgu ${rawName}`;
    const photo=typeof profile.photoDataUrl==='string'&&/^data:image\/(?:jpeg|png);base64,/i.test(profile.photoDataUrl)?profile.photoDataUrl:'';
    document.querySelectorAll('.workspace-home').forEach(home=>{
      const greeting=home.querySelector('.workspace-greeting');
      const image=home.querySelector('.workspace-profile-photo');
      const initial=home.querySelector('.workspace-profile-initial');
      if(greeting)greeting.textContent=`Assalamualaikum, ${displayName} yang shantekkk!`;
      if(initial){initial.textContent=(rawName||'G').charAt(0).toUpperCase();initial.hidden=Boolean(photo);}
      if(image){image.hidden=!photo;if(photo)image.src=photo;else image.removeAttribute('src');}
    });
  }
  window.refreshWorkspaceGreeting=refreshGreeting;
  function refresh(){
    document.querySelectorAll('.workspace-actions button').forEach(b=>{b.hidden=!allowed(b.dataset.target);});
    document.querySelectorAll('.workspace-connection').forEach(el=>{
      el.textContent=navigator.onLine?'Rangkaian tersedia · status penyegerakan ditunjukkan dalam modul masing-masing.':'Tiada rangkaian · semak status simpan apabila internet kembali.';
      el.classList.toggle('is-offline',!navigator.onLine);
    });
  }
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  // Refresh only when existing role/navigation controls change, including after login.
  const sidebar=document.getElementById('sidebar');
  if(sidebar)new MutationObserver(refresh).observe(sidebar,{subtree:true,attributes:true,attributeFilter:['class']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();refreshGreeting();},{once:true});
  else{install();refreshGreeting();}
})();
