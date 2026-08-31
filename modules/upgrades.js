/* iSEJARAH v66 upgrade modules. Depends on app.js and preserves its public state/functions. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const safe = (value) => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const ay = () => typeof getActiveAcademicYear === 'function' ? String(getActiveAcademicYear()) : String($('filter-academic-year')?.value || '2026');
  const activeClasses = () => (appState.classes || []).filter(c => c.active !== false && String(c.academicYear || ay()) === ay());
  const permittedClasses = () => activeClasses().filter(c => currentUserRole !== 'GURU_SEJARAH' || c.teacherId === currentUserId);
  const classStudents = (classId) => (appState.students || []).filter(s => s.active !== false && s.classId === classId);
  const actualScores = () => typeof getActualScoreRecords === 'function' ? getActualScoreRecords() : (appState.scores || []);
  const pct = (score) => {
    if (Number.isFinite(Number(score.percentage))) return Number(score.percentage);
    if (typeof calculateScorePercentage === 'function') return Number(calculateScorePercentage(score));
    const total = Number(score.totalMarks || score.maxScore || 100);
    return total ? Number(score.score || score.marks || 0) / total * 100 : 0;
  };
  const assessmentYear = (assessment) => String(assessment?.academicYear || assessment?.year || ay());
  const periodOf = (record) => String(record?.assessmentPeriod || record?.period || '').toUpperCase();
  const card = (label, value, note, tone='mint') => `<article class="upgrade-kpi tone-${tone}"><p>${safe(label)}</p><strong>${safe(value)}</strong><span>${safe(note)}</span></article>`;

  function addNav(groupId, id, label, icon, adminOnly=false) {
    const group = $(groupId);
    if (!group || $(`nav-${id}`)) return;
    const button = document.createElement('button');
    button.id = `nav-${id}`;
    button.className = `nav-item ${adminOnly ? 'admin-only' : ''} w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all text-slate-400 hover:text-slate-100 hover:bg-navy-900/70`;
    button.setAttribute('onclick', `navigateTab('${id}')`);
    button.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${safe(label)}</span>`;
    group.appendChild(button);
  }

  function injectViews() {
    const main = $('view-dashboard')?.parentElement;
    if (!main || $('view-teacher-dashboard')) return;
    main.insertAdjacentHTML('beforeend', `
      <section id="view-teacher-dashboard" class="hidden space-y-5"><div class="upgrade-heading"><div><p>Ruang kerja harian</p><h1>Dashboard Guru</h1><span>Kelas ditugaskan, kelengkapan dan tindakan segera</span></div><i data-lucide="layout-dashboard"></i></div><div id="teacher-dashboard-content"></div></section>
      <section id="view-completeness" class="hidden space-y-5"><div class="upgrade-heading"><div><p>Kawalan kualiti data</p><h1>Pusat Kelengkapan Data</h1><span>Markah dan PBD mengikut kelas untuk sesi aktif</span></div><i data-lucide="list-checks"></i></div><div id="completeness-content"></div></section>
      <section id="view-attention" class="hidden space-y-5"><div class="upgrade-heading"><div><p>Sokongan berfokus</p><h1>Murid Memerlukan Perhatian</h1><span>Gabungan markah, PBD, trend, Near Miss dan intervensi</span></div><i data-lucide="heart-pulse"></i></div><div id="attention-content"></div></section>
      <section id="view-admin-tools" class="hidden space-y-5"><div class="upgrade-heading"><div><p>Pentadbiran selamat</p><h1>Rollover, Backup & Audit Trail</h1><span>Operasi sesi tanpa menimpa sejarah</span></div><i data-lucide="shield-check"></i></div><div id="admin-tools-content"></div></section>
      <section id="view-executive-report" class="hidden space-y-5"><div class="upgrade-heading"><div><p>Mesyuarat panitia</p><h1>Laporan Eksekutif Panitia</h1><span>Ringkasan Tahun 4–6, GPMP, PBD dan intervensi</span></div><i data-lucide="presentation"></i></div><div id="executive-report-content"></div></section>`);
  }

  function completionForClass(cls) {
    const students = classStudents(cls.id);
    const studentIds = new Set(students.map(s => s.id));
    const assessments = (appState.assessments || []).filter(a => assessmentYear(a) === ay() && (!a.classId || a.classId === cls.id));
    const scores = actualScores().filter(s => studentIds.has(s.studentId) && assessments.some(a => a.id === s.assessmentId));
    const expectedMarks = students.length * assessments.length;
    const pbd = (appState.pbdRecords || []).filter(r => studentIds.has(r.studentId) && String(r.academicYear || ay()) === ay());
    const dskpCount = Math.max(1, (appState.dskp || []).filter(d => d.active !== false && (!d.yearLevel || Number(d.yearLevel) === Number(cls.year))).length);
    const expectedPbd = students.length * dskpCount * 2;
    return {students:students.length, marks:expectedMarks ? Math.min(100,Math.round(scores.length/expectedMarks*100)) : 0, pbd:expectedPbd ? Math.min(100,Math.round(pbd.length/expectedPbd*100)) : 0, missingMarks:Math.max(0,expectedMarks-scores.length), missingPbd:Math.max(0,expectedPbd-pbd.length)};
  }

  function attentionRows() {
    const ids = new Set(permittedClasses().flatMap(c => classStudents(c.id).map(s => s.id)));
    return [...ids].map(id => {
      if (typeof getStudentInterventionMetrics === 'function') return getStudentInterventionMetrics(id, ay());
      const student = (appState.students || []).find(s => s.id === id);
      const marks = actualScores().filter(s => s.studentId === id).map(pct);
      const tps = (appState.pbdOverall || []).filter(r => r.studentId === id && String(r.academicYear || ay()) === ay()).map(r => Number(r.overallTP || r.tp)).filter(Boolean);
      const avgMark = marks.length ? marks.reduce((a,b)=>a+b,0)/marks.length : null;
      const avgTp = tps.length ? tps.reduce((a,b)=>a+b,0)/tps.length : null;
      const priority = avgMark !== null && avgMark < 40 || avgTp !== null && avgTp < 2 ? 'HIGH' : avgMark !== null && avgMark < 50 || avgTp !== null && avgTp < 3 ? 'SUPPORT' : null;
      return {student,avgMark,avgTp,priority,reasons:[],trend:null};
    }).filter(r => r?.student && r.priority);
  }

  function renderTeacherDashboard() {
    const classes = permittedClasses();
    const stats = classes.map(c => ({c, ...completionForClass(c)}));
    const attention = attentionRows();
    const nearMiss = attention.filter(r => r.avgMark >= 40 && r.avgMark < 50);
    const avgMarks = actualScores().filter(s => classes.some(c => classStudents(c.id).some(st => st.id === s.studentId))).map(pct);
    const average = avgMarks.length ? (avgMarks.reduce((a,b)=>a+b,0)/avgMarks.length).toFixed(1)+'%' : '—';
    $('teacher-dashboard-content').innerHTML = `<div class="upgrade-grid kpis">${card('Kelas Ditugaskan',classes.length,'Sesi '+ay(),'lilac')}${card('Purata Semasa',average,avgMarks.length+' rekod markah','blue')}${card('Near Miss',nearMiss.length,'40–49%, tindakan cepat','peach')}${card('Perlu Perhatian',attention.length,'Keutamaan dan sokongan','rose')}</div>
      <div class="upgrade-panel"><div class="panel-title"><h2>Status Kelas</h2><span>${safe(new Date().toLocaleDateString('ms-MY'))}</span></div><div class="upgrade-class-grid">${stats.length ? stats.map(x=>`<article class="class-status"><div><h3>${safe(x.c.name)}</h3><span>${x.students} murid · Tahun ${safe(x.c.year)}</span></div><div class="progress-label"><span>Markah</span><b>${x.marks}%</b></div><div class="progress"><i style="width:${x.marks}%"></i></div><div class="progress-label"><span>PBD</span><b>${x.pbd}%</b></div><div class="progress pbd"><i style="width:${x.pbd}%"></i></div><p>${x.missingMarks} markah · ${x.missingPbd} PBD belum lengkap</p><div class="quick-actions"><button onclick="navigateTab('marks')">Isi Markah</button><button onclick="navigateTab('pbd')">Isi PBD</button></div></article>`).join('') : '<div class="upgrade-empty">Tiada kelas ditugaskan untuk sesi ini.</div>'}</div></div>`;
  }

  function renderCompleteness() {
    const rows = permittedClasses().map(c => ({c,...completionForClass(c)}));
    $('completeness-content').innerHTML = `<div class="upgrade-panel table-shell"><table class="upgrade-table"><thead><tr><th>Kelas</th><th>Murid</th><th>Markah Lengkap</th><th>PBD Lengkap</th><th>Belum Lengkap</th><th>Tindakan</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${safe(x.c.name)}</b><small>Tahun ${safe(x.c.year)}</small></td><td>${x.students}</td><td><span class="completion-badge ${x.marks===100?'done':''}">${x.marks}%</span></td><td><span class="completion-badge ${x.pbd===100?'done':''}">${x.pbd}%</span></td><td>${x.missingMarks} markah<br>${x.missingPbd} PBD</td><td><button class="text-action" onclick="navigateTab('${x.missingMarks?'marks':'pbd'}')">Lengkapkan →</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderAttention() {
    const rows = attentionRows();
    const priorityLabel = p => p==='HIGH'?'Keutamaan Tinggi':p==='SUPPORT'?'Sokongan':'Pantau';
    $('attention-content').innerHTML = `<div class="upgrade-grid kpis">${card('Keutamaan Tinggi',rows.filter(r=>r.priority==='HIGH').length,'Markah <40 atau TP rendah','rose')}${card('Perlu Sokongan',rows.filter(r=>r.priority==='SUPPORT').length,'Pengukuhan terancang','peach')}${card('Pantau',rows.filter(r=>r.priority==='MONITOR').length,'Trend menurun','blue')}</div><div class="upgrade-panel table-shell"><table class="upgrade-table"><thead><tr><th>Murid</th><th>Markah</th><th>PBD</th><th>Trend</th><th>Keutamaan</th><th>Tindakan</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><b>${safe(r.student.name)}</b><small>${safe((appState.classes||[]).find(c=>c.id===r.student.classId)?.name||'—')}</small></td><td>${r.avgMark==null?'—':r.avgMark.toFixed(1)+'%'}</td><td>${r.avgTp==null?'—':'TP'+r.avgTp.toFixed(1)}</td><td>${r.trend==null?'—':r.trend>0?'↑ '+r.trend.toFixed(1):r.trend<0?'↓ '+Math.abs(r.trend).toFixed(1):'→'}</td><td><span class="priority ${String(r.priority).toLowerCase()}">${priorityLabel(r.priority)}</span></td><td><button class="text-action" onclick="navigateTab('intervention')">Susulan →</button></td></tr>`).join(''):'<tr><td colspan="6"><div class="upgrade-empty">Tiada murid memenuhi indikator perhatian.</div></td></tr>'}</tbody></table></div>`;
  }

  function pbdProgress() {
    const students = new Set(permittedClasses().flatMap(c=>classStudents(c.id).map(s=>s.id)));
    const rows=[];
    students.forEach(id=>{
      const mid=(appState.pbdOverall||[]).find(r=>r.studentId===id&&String(r.academicYear||ay())===ay()&&periodOf(r).includes('PERTENGAHAN'));
      const end=(appState.pbdOverall||[]).find(r=>r.studentId===id&&String(r.academicYear||ay())===ay()&&periodOf(r).includes('AKHIR'));
      const a=Number(mid?.overallTP||mid?.tp||0), b=Number(end?.overallTP||end?.tp||0);
      if(a) rows.push({a,b:b||a,inherited:!b,delta:(b||a)-a});
    });
    return rows;
  }

  async function runRollover() {
    if (currentUserRole !== 'ADMIN') return showAlert('Akses Ditolak','Hanya Admin boleh menjalankan rollover.','danger');
    const from=$('rollover-from').value, to=$('rollover-to').value;
    if (!phase10Db) return showAlert('Supabase Tidak Bersambung','Rollover memerlukan sambungan Supabase dan migrasi SQL.','danger');
    showAlert('Sahkan Rollover',`Arkib sesi ${from} dan cipta enrolmen ${to}? Data lama tidak akan ditimpa.`,'info',async()=>{
      const {data,error}=await phase10Db.rpc('rollover_academic_session',{p_from_year:from,p_to_year:to});
      if(error) return showAlert('Rollover Gagal',error.message,'danger');
      logAudit('SESSION_ROLLOVER',{fromYear:from,toYear:to,result:data});
      showAlert('Rollover Selesai',`Sesi ${to} telah disediakan. Semak penugasan guru sebelum diaktifkan.`,'success');
    });
  }

  function renderAdminTools() {
    const logs=(appState.auditLogs||[]).slice().sort((a,b)=>String(b.timestamp||b.createdAt).localeCompare(String(a.timestamp||a.createdAt))).slice(0,100);
    $('admin-tools-content').innerHTML=`<div class="upgrade-grid admin-columns"><div class="upgrade-panel"><div class="panel-title"><h2>Rollover Sesi 2027</h2><span>Backward-safe</span></div><p class="panel-copy">Tahun 4→5, Tahun 5→6, Tahun 6→graduated. Sejarah markah/PBD kekal melalui enrolmen sesi.</p><div class="form-row"><label>Dari<input id="rollover-from" value="${safe(ay())}" readonly></label><label>Ke<input id="rollover-to" value="2027" inputmode="numeric"></label></div><button class="primary-action" onclick="iSejarahV66.runRollover()">Sediakan Sesi 2027</button><p class="safety-note">Operasi idempotent dan tidak mengubah kelas asal.</p></div><div class="upgrade-panel"><div class="panel-title"><h2>Backup Penuh</h2><span>JSON</span></div><p class="panel-copy">Muat turun data murid, kelas, markah, PBD, headcount, intervensi, tetapan dan audit.</p><button class="primary-action secondary" onclick="iSejarahV66.backup()">Backup Sekarang</button><p class="safety-note">Simpan fail di lokasi sekolah yang dilindungi.</p></div></div><div class="upgrade-panel table-shell"><div class="panel-title"><h2>Audit Trail</h2><span>${logs.length} rekod terkini</span></div><table class="upgrade-table"><thead><tr><th>Masa</th><th>Pengguna</th><th>Modul</th><th>Tindakan</th><th>Butiran</th></tr></thead><tbody>${logs.length?logs.map(l=>`<tr><td>${safe(new Date(l.timestamp||l.createdAt).toLocaleString('ms-MY'))}</td><td>${safe(l.changedBy||l.userId||'Sistem')}</td><td>${safe(l.module||'UMUM')}</td><td><b>${safe(l.action)}</b></td><td><code>${safe(JSON.stringify(l.current||l.details||{}).slice(0,100))}</code></td></tr>`).join(''):'<tr><td colspan="5"><div class="upgrade-empty">Belum ada rekod audit.</div></td></tr>'}</tbody></table></div>`;
  }

  function backup() {
    const payload={schemaVersion:2,exportedAt:new Date().toISOString(),academicYear:ay(),schoolProfile:typeof phase9SchoolProfile==='object'?phase9SchoolProfile:null,data:{users:appState.users||[],classes:appState.classes||[],students:appState.students||[],assessments:appState.assessments||[],scores:actualScores(),dskp:appState.dskp||[],pbdRecords:appState.pbdRecords||[],pbdOverall:appState.pbdOverall||[],pbdGroupLevels:appState.pbdGroupLevels||[],pbdLocks:appState.pbdLocks||[],headcount:appState.headcount||[],interventions:appState.interventions||[],auditLogs:appState.auditLogs||[],settings:appState.settings||{}}};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`iSEJARAH_Backup_${ay()}_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);logAudit('FULL_BACKUP_EXPORT',{academicYear:ay(),schemaVersion:2});
  }

  function renderExecutive() {
    const classes=permittedClasses(), ids=new Set(classes.flatMap(c=>classStudents(c.id).map(s=>s.id))), scores=actualScores().filter(s=>ids.has(s.studentId)), marks=scores.map(pct), average=marks.length?marks.reduce((a,b)=>a+b,0)/marks.length:0, pass=marks.length?marks.filter(x=>x>=40).length/marks.length*100:0, pbd=(appState.pbdOverall||[]).filter(r=>ids.has(r.studentId)&&String(r.academicYear||ay())===ay()), mastery=pbd.length?pbd.filter(r=>Number(r.overallTP||r.tp)>=3).length/pbd.length*100:0, attention=attentionRows(), interventions=(appState.interventions||[]).filter(r=>ids.has(r.studentId)&&String(r.academicYear||ay())===ay()), progress=pbdProgress();
    const improved=progress.filter(x=>x.delta>0).length, same=progress.filter(x=>x.delta===0).length, declined=progress.filter(x=>x.delta<0).length, inherited=progress.filter(x=>x.inherited).length;
    $('executive-report-content').innerHTML=`<div id="executive-print"><div class="report-cover"><p>PANITIA SEJARAH</p><h2>Laporan Prestasi Eksekutif</h2><span>Sesi ${safe(ay())} · Dijana ${safe(new Date().toLocaleDateString('ms-MY'))}</span></div><div class="upgrade-grid kpis">${card('Purata Markah',average.toFixed(1)+'%',scores.length+' rekod','blue')}${card('Lulus',pass.toFixed(1)+'%','Ambang 40%','mint')}${card('Penguasaan PBD',mastery.toFixed(1)+'%','TP3–TP6','lilac')}${card('Intervensi',interventions.length,attention.length+' murid perhatian','peach')}</div><div class="upgrade-grid admin-columns"><div class="upgrade-panel"><div class="panel-title"><h2>Progress PBD</h2><span>Pertengahan → Akhir</span></div><div class="pbd-progress-summary"><b class="up">↑ ${improved} meningkat</b><b>→ ${same} kekal</b><b class="down">↓ ${declined} menurun</b></div><p class="inherited-note">${inherited} rekod Akhir Tahun masih memaparkan data diwarisi daripada Pertengahan dan belum dinilai semula.</p></div><div class="upgrade-panel"><div class="panel-title"><h2>Insight Panitia</h2><span>Berpandukan data</span></div><ul class="insight-list"><li>${classes.length} kelas aktif dengan ${ids.size} murid.</li><li>${attention.filter(r=>r.priority==='HIGH').length} murid memerlukan tindakan keutamaan tinggi.</li><li>${interventions.filter(isInterventionDue).length} susulan intervensi telah sampai atau melepasi tarikh semakan.</li></ul></div></div></div><button class="primary-action" onclick="iSejarahV66.printExecutive()">Cetak / Simpan PDF</button>`;
  }

  function printExecutive() {
    const report=$('executive-print');
    if(!report){showAlert('Tiada Paparan','Jana Laporan Eksekutif dahulu.','info');return;}
    const win=window.open('','_blank','width=1100,height=850');
    if(!win){showAlert('Pop-up Disekat','Benarkan pop-up untuk membuka paparan cetakan.','danger');return;}
    win.document.write(`<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>Laporan Eksekutif Panitia ${safe(ay())}</title><style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1e293b;background:#fff}.report-cover{padding:24px;border-radius:12px;background:#172554;color:#fff;margin-bottom:14px}.report-cover p{margin:0;font-size:9px;font-weight:800;letter-spacing:.2em;color:#a7f3d0}.report-cover h2{font-size:22px;margin:6px 0}.report-cover span{font-size:10px;color:#cbd5e1}.upgrade-grid{display:grid;gap:12px;margin-bottom:14px}.upgrade-grid.kpis{grid-template-columns:repeat(4,1fr)}.admin-columns{grid-template-columns:repeat(2,1fr)}.upgrade-kpi,.upgrade-panel{border:1px solid #dbe3ee;border-radius:11px;padding:14px;break-inside:avoid}.upgrade-kpi p{margin:0;font-size:8px;text-transform:uppercase;color:#64748b}.upgrade-kpi strong{display:block;font-size:21px;margin:5px 0}.upgrade-kpi span,.panel-title span{font-size:8px;color:#64748b}.tone-blue{background:#eff6ff}.tone-mint{background:#ecfdf5}.tone-lilac{background:#f5f3ff}.tone-peach{background:#fff7ed}.panel-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.panel-title h2{font-size:14px;margin:0}.pbd-progress-summary{display:flex;gap:6px;flex-wrap:wrap}.pbd-progress-summary b{font-size:9px;padding:6px 8px;border-radius:7px;background:#f8fafc}.pbd-progress-summary .up{background:#ecfdf5;color:#047857}.pbd-progress-summary .down{background:#fff1f2;color:#be123c}.inherited-note{font-size:9px;line-height:1.5;padding:9px;background:#f5f3ff;border-left:3px solid #8b5cf6}.insight-list{font-size:9px;line-height:1.7;padding-left:16px}button,svg{display:none!important}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${report.outerHTML}</body></html>`);
    win.document.close();win.focus();setTimeout(()=>win.print(),450);
  }

  function render(tab) {
    if(tab==='teacher-dashboard')renderTeacherDashboard();
    if(tab==='completeness')renderCompleteness();
    if(tab==='attention')renderAttention();
    if(tab==='admin-tools')renderAdminTools();
    if(tab==='executive-report')renderExecutive();
    if(window.lucide)lucide.createIcons();
  }

  function initialize() {
    injectViews();
    addNav('nav-group-main','teacher-dashboard','Dashboard Guru','layout-dashboard');
    addNav('nav-group-main','completeness','Kelengkapan Data','list-checks');
    addNav('nav-group-analytics','attention','Murid Perhatian','heart-pulse');
    addNav('nav-group-admin','admin-tools','Rollover & Audit','shield-check',true);
    addNav('nav-group-admin','executive-report','Laporan Eksekutif','presentation',true);
    const originalNavigate=navigateTab;
    navigateTab=function(tabId){originalNavigate(tabId);if(isViewAllowed(tabId))render(tabId);};
    window.navigateTab=navigateTab;
    const originalApply=applyRoleAccessUI;
    applyRoleAccessUI=function(skip){const result=originalApply(skip);document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',currentUserRole!=='ADMIN'));if(currentUserRole==='GURU_SEJARAH'&&!$('main-app')?.classList.contains('hidden'))setTimeout(()=>navigateTab('teacher-dashboard'),0);return result;};
    window.applyRoleAccessUI=applyRoleAccessUI;
    if((window.MATTARY_SUPABASE_CONFIG?.authMode||'legacy_anonymous')==='password'){
      const email=$('login-email'), label=$('login-userid-label');
      if(email){email.type='email';email.inputMode='email';email.maxLength=254;email.value='';email.placeholder='nama@sekolah.edu.my';}
      if(label)label.textContent='Email Supabase Auth';
    }
    if(window.lucide)lucide.createIcons();
  }

  window.iSejarahV66={runRollover,backup,render,printExecutive};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
