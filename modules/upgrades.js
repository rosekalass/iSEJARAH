/* iSEJARAH v66 upgrade modules. Depends on app.js and preserves its public state/functions. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const safe = (value) => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const ay = () => String($('filter-academic-year')?.value || (typeof getActiveAcademicYear === 'function' ? getActiveAcademicYear() : '2026'));
  const activeClasses = () => typeof canonicalActiveClasses === 'function' ? canonicalActiveClasses(ay()) : (appState.classes || []).filter(c => c.active !== false && String(c.academicYear || ay()) === ay());
  const permittedClasses = () => activeClasses().filter(c => currentUserRole !== 'GURU_SEJARAH' || c.teacherId === currentUserId);
  const classStudents = (classId) => (appState.students || []).filter(s => s.active !== false && s.status === 'Aktif' && s.classId === classId && String(s.academicYear || ay()) === ay());
  const actualScores = () => typeof getActualScoreRecords === 'function' ? getActualScoreRecords() : (appState.scores || []);
  const pct = (score) => {
    if (Number.isFinite(Number(score.percentage))) return Number(score.percentage);
    if (typeof calculateScorePercentage === 'function') return Number(calculateScorePercentage(score));
    const total = Number(score.totalMarks || score.maxScore || 100);
    return total ? Number(score.score || score.marks || 0) / total * 100 : 0;
  };
  const assessmentYear = (assessment) => String(assessment?.academicYear || ay());
  const periodOf = (record) => String(record?.assessmentPeriod || record?.period || '').toUpperCase();
  const card = (label, value, note, tone='mint') => `<article class="upgrade-kpi tone-${tone}"><p>${safe(label)}</p><strong>${safe(value)}</strong><span>${safe(note)}</span></article>`;
  let completionFilters = null;
  function completionScope() {
    if (!completionFilters) {
      const hasFinal = (appState.pbdRecords || []).some(r => String(r.academicYear || ay()) === ay() && periodOf(r) === 'AKHIR' && Number(r.tp) >= 1 && Number(r.tp) <= 6);
      completionFilters = {assessmentType:'ALL', period:hasFinal ? 'AKHIR' : 'PERTENGAHAN'};
    }
    return completionFilters;
  }
  function completionClasses() {
    const year = $('filter-tahun')?.value || 'ALL', classId = $('filter-kelas')?.value || 'ALL';
    return permittedClasses().filter(c => (year === 'ALL' || String(c.year) === year) && (classId === 'ALL' || c.id === classId));
  }
  const validTp = r => r && Number.isInteger(Number(r.tp)) && Number(r.tp) >= 1 && Number(r.tp) <= 6;
  function completeScore(record) {
    if (!record) return false;
    if (record.absent === true) return true;
    // A note-only record is not a mark. Zero is a real, completed mark.
    const value = record.rawScore;
    return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  }

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

  function completionForClass(cls, scope=completionScope()) {
    const students = classStudents(cls.id);
    const studentIds = new Set(students.map(s => s.id));
    const assessments = [...new Map((appState.assessments || []).filter(a => assessmentYear(a) === ay() && a.classId === cls.id && (!a.subject || String(a.subject).toUpperCase() === 'SEJARAH') && (scope.assessmentType === 'ALL' || a.type === scope.assessmentType)).map(a => [a.id,a])).values()];
    const assessmentIds = new Set(assessments.map(a=>a.id));
    const scores = new Map();
    // Use the same first record displayed by Pengisian Markah; duplicates cannot inflate completion.
    actualScores().filter(s => studentIds.has(s.studentId) && assessmentIds.has(s.assessmentId)).forEach(s => {
      const key = JSON.stringify([s.studentId,s.assessmentId]);
      if (!scores.has(key)) scores.set(key,s);
    });
    const recordedMarks = [...scores.values()].filter(completeScore).length;
    const expectedMarks = students.length * assessments.length;
    const template = getPbdMatrixTemplate(Number(cls.year));
    const dskp = [...new Map(template.groups.flatMap(group => group.topics.map((_,index) => pbdMatrixDskpForTopic(Number(cls.year),group.key,index))).filter(Boolean).map(d => [d.id,d])).values()];
    let recordedPbd = 0, inheritedPbd = 0;
    students.forEach(student => dskp.forEach(d => {
      const record = getEffectivePbdMatrixRecord(student.id,d.id,scope.period,ay());
      if (validTp(record)) {recordedPbd++; if (record.inherited) inheritedPbd++;}
    }));
    const expectedPbd = students.length * dskp.length;
    const percentage = (filled,total) => total ? (filled === total ? 100 : Math.min(99,Math.round(filled / total * 100))) : 0;
    return {students:students.length,recordedMarks,expectedMarks,recordedPbd,expectedPbd,inheritedPbd,
      marks:percentage(recordedMarks,expectedMarks),pbd:percentage(recordedPbd,expectedPbd),
      missingMarks:Math.max(0,expectedMarks-recordedMarks),missingPbd:Math.max(0,expectedPbd-recordedPbd)};
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
    const classes = completionClasses();
    const stats = classes.map(c => ({c, ...completionForClass(c)}));
    const attention = attentionRows();
    const nearMiss = attention.filter(r => r.avgMark >= 40 && r.avgMark < 50);
    const avgMarks = actualScores().filter(s => classes.some(c => classStudents(c.id).some(st => st.id === s.studentId))).map(pct);
    const average = avgMarks.length ? (avgMarks.reduce((a,b)=>a+b,0)/avgMarks.length).toFixed(1)+'%' : '—';
    $('teacher-dashboard-content').innerHTML = `<div class="upgrade-grid kpis">${card('Kelas Ditugaskan',classes.length,'Sesi '+ay(),'lilac')}${card('Purata Semasa',average,avgMarks.length+' rekod markah','blue')}${card('Near Miss',nearMiss.length,'40–49%, tindakan cepat','peach')}${card('Perlu Perhatian',attention.length,'Keutamaan dan sokongan','rose')}</div>
      <div class="upgrade-panel"><div class="panel-title"><h2>Status Kelas</h2><span>${safe(new Date().toLocaleDateString('ms-MY'))}</span></div><div class="upgrade-class-grid">${stats.length ? stats.map(x=>`<article class="class-status"><div><h3>${safe(x.c.name)}</h3><span>${x.students} murid · Tahun ${safe(x.c.year)}</span></div><div class="progress-label"><span>Markah</span><b>${x.marks}%</b></div><div class="progress"><i style="width:${x.marks}%"></i></div><div class="progress-label"><span>PBD</span><b>${x.pbd}%</b></div><div class="progress pbd"><i style="width:${x.pbd}%"></i></div><p>${x.missingMarks} markah · ${x.missingPbd} PBD belum lengkap</p><div class="quick-actions"><button onclick="navigateTab('marks')">Isi Markah</button><button onclick="navigateTab('pbd')">Isi PBD</button></div></article>`).join('') : '<div class="upgrade-empty">Tiada kelas ditugaskan untuk sesi ini.</div>'}</div></div>`;
  }

  function renderCompleteness() {
    const scope = completionScope();
    const rows = completionClasses().map(c => ({c,...completionForClass(c,scope)}));
    const totalStudents=rows.reduce((sum,x)=>sum+x.students,0);
    const completeMarks=rows.filter(x=>x.expectedMarks>0 && x.missingMarks===0).length;
    const completePbd=rows.filter(x=>x.expectedPbd>0 && x.missingPbd===0).length;
    const makeActions=x=>x.students===0?'<span>Tiada murid aktif</span>':`<div class="completion-actions">${x.missingMarks?`<button class="text-action" onclick="iSejarahV66.openCompletion('marks','${safe(x.c.id)}')">Markah</button>`:''}${x.missingPbd?`<button class="text-action pbd" onclick="iSejarahV66.openCompletion('pbd','${safe(x.c.id)}')">PBD</button>`:''}${!x.missingMarks&&!x.missingPbd?'<span class="completion-ok">✓ Lengkap</span>':''}</div>`;
    const periodLabel = scope.period === 'AKHIR' ? 'Akhir Tahun' : 'Pertengahan Tahun';
    const detail = (x,kind) => kind === 'marks'
      ? `${x.recordedMarks} / ${x.expectedMarks} rekod${x.expectedMarks?'':' · Tiada ujian dalam skop'}`
      : `${x.recordedPbd} / ${x.expectedPbd} SK${x.inheritedPbd?` · ${x.inheritedPbd} diwarisi`:''}`;
    const cell = (x,kind) => `<div class="completion-cell"><span class="completion-badge ${x[kind]===100?'done':''}">${x[kind]}%</span><span class="completion-track ${kind==='pbd'?'pbd':''}" aria-hidden="true"><i style="width:${x[kind]}%"></i></span></div><small>${safe(detail(x,kind))}</small>`;
    const sessions = typeof normalizedAcademicSessions==='function' ? normalizedAcademicSessions() : [...new Set([ay(),...(appState.classes||[]).map(c=>String(c.academicYear||ay()))])].sort().reverse().map(year=>({year,label:year}));
    const selectedYear = $('filter-tahun')?.value || 'ALL', selectedClass = $('filter-kelas')?.value || 'ALL';
    const selectableClasses = permittedClasses().filter(c=>selectedYear==='ALL'||String(c.year)===selectedYear);
    $('completeness-content').innerHTML = `
      <div class="upgrade-panel completion-scope">
        <div class="panel-title"><h2>Skop kelengkapan · Sesi ${safe(ay())}</h2></div>
        <div class="form-row">
          <label for="completion-session">Sesi<select id="completion-session" onchange="iSejarahV66.setCompletionContext('session',this.value)">${sessions.map(s=>`<option value="${safe(s.year)}" ${s.year===ay()?'selected':''}>${safe(s.label)}</option>`).join('')}</select></label>
          <label for="completion-year">Tahun<select id="completion-year" onchange="iSejarahV66.setCompletionContext('year',this.value)">${['ALL','4','5','6'].map(year=>`<option value="${year}" ${selectedYear===year?'selected':''}>${year==='ALL'?'Semua Tahun':'Tahun '+year}</option>`).join('')}</select></label>
          <label for="completion-class">Kelas<select id="completion-class" onchange="iSejarahV66.setCompletionContext('classId',this.value)"><option value="ALL">Semua Kelas</option>${selectableClasses.map(c=>`<option value="${safe(c.id)}" ${selectedClass===c.id?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label>
          <label for="completion-exam">Markah ujian<select id="completion-exam" onchange="iSejarahV66.setCompletionScope('assessmentType',this.value)">${['ALL','DIAGNOSTIK','UPSA','UASA'].map(type=>`<option value="${type}" ${scope.assessmentType===type?'selected':''}>${type==='ALL'?'Semua ujian':type}</option>`).join('')}</select></label>
          <label for="completion-period">Tempoh PBD<select id="completion-period" onchange="iSejarahV66.setCompletionScope('period',this.value)"><option value="PERTENGAHAN" ${scope.period==='PERTENGAHAN'?'selected':''}>Pertengahan Tahun</option><option value="AKHIR" ${scope.period==='AKHIR'?'selected':''}>Akhir Tahun</option></select></label>
        </div>
        <p class="completion-explanation">PBD dikira daripada SK dalam jadual pengisian bagi ${safe(periodLabel)}. Nilai Pertengahan yang dibawa ke Akhir Tahun dikira sekali dan dilabel diwarisi. Markah 0 dan TH dikira lengkap; rekod kosong atau catatan sahaja belum lengkap.</p>
      </div>
      <div class="completion-summary" aria-label="Ringkasan kelengkapan"><article><span>Kelas dipantau</span><b>${rows.length}</b></article><article><span>Jumlah murid</span><b>${totalStudents}</b></article><article><span>Kelas markah lengkap</span><b>${completeMarks}/${rows.length}</b></article><article><span>Kelas PBD lengkap</span><b>${completePbd}/${rows.length}</b></article></div>
      <div class="upgrade-panel table-shell completeness-table-shell"><table class="upgrade-table completeness-table"><caption class="sr-only">Kelengkapan sesi ${safe(ay())}; markah ${safe(scope.assessmentType)}; PBD ${safe(periodLabel)}</caption><thead><tr><th scope="col">Kelas</th><th scope="col">Murid</th><th scope="col">Markah Lengkap</th><th scope="col">PBD Lengkap</th><th scope="col">Belum Lengkap</th><th scope="col">Tindakan</th></tr></thead><tbody>${rows.map(x=>`<tr><td data-label="Kelas"><b>${safe(x.c.name)}</b><small>Tahun ${safe(x.c.year)}</small></td><td data-label="Murid"><strong class="table-number">${x.students}</strong></td><td data-label="Markah">${cell(x,'marks')}</td><td data-label="PBD">${cell(x,'pbd')}</td><td data-label="Belum lengkap"><span class="missing-count ${x.missingMarks?'':'zero'}">${x.missingMarks} markah</span><span class="missing-count ${x.missingPbd?'':'zero'}">${x.missingPbd} PBD</span></td><td data-label="Tindakan">${makeActions(x)}</td></tr>`).join('')||'<tr><td colspan="6">Tiada kelas dalam skop ini.</td></tr>'}</tbody></table>
      <div class="completion-mobile">${rows.map(x=>`<article><header><div><b>${safe(x.c.name)}</b><small>Tahun ${safe(x.c.year)} · ${x.students} murid</small></div>${x.missingMarks||x.missingPbd?'<span class="needs-action">Perlu tindakan</span>':'<span class="is-complete">Lengkap</span>'}</header><div class="mobile-progress"><label><span>Markah</span><b>${x.marks}%</b></label><i><em style="width:${x.marks}%"></em></i></div><p>${safe(detail(x,'marks'))}</p><div class="mobile-progress pbd"><label><span>PBD · ${safe(periodLabel)}</span><b>${x.pbd}%</b></label><i><em style="width:${x.pbd}%"></em></i></div><p>${safe(detail(x,'pbd'))}</p><p>${x.missingMarks} markah · ${x.missingPbd} PBD belum lengkap</p>${makeActions(x)}</article>`).join('')||'<p class="upgrade-empty">Tiada kelas dalam skop ini.</p>'}</div></div>`;
  }

  function setCompletionScope(field,value) {
    const allowed = {assessmentType:['ALL','DIAGNOSTIK','UPSA','UASA'],period:['PERTENGAHAN','AKHIR']};
    if (!allowed[field]?.includes(value)) return;
    completionScope()[field] = value;
    renderCompleteness();
    $(field==='period'?'completion-period':'completion-exam')?.focus({preventScroll:true});
  }

  function setCompletionContext(field,value) {
    if(field==='session') {
      const sessions = typeof normalizedAcademicSessions==='function' ? normalizedAcademicSessions().map(s=>s.year) : (appState.classes||[]).map(c=>String(c.academicYear));
      if(!sessions.includes(value)||!$('filter-academic-year'))return;
      $('filter-academic-year').value=value;
      if($('filter-kelas'))$('filter-kelas').value='ALL';
    } else if(field==='year') {
      if(!['ALL','4','5','6'].includes(value)||!$('filter-tahun'))return;
      $('filter-tahun').value=value;
      if($('filter-kelas'))$('filter-kelas').value='ALL';
    } else if(field==='classId') {
      if(value!=='ALL'&&!permittedClasses().some(c=>c.id===value))return;
      if(!$('filter-kelas'))return;
      $('filter-kelas').value=value;
    } else return;
    if(field!=='classId'&&typeof onTahunChange==='function')onTahunChange();
    else if(typeof onFilterChange==='function')onFilterChange();
    renderCompleteness();
  }

  function openCompletion(module,classId){
    const cls = permittedClasses().find(c=>c.id===classId);
    if (!cls) return;
    const scope = {...completionScope()};
    if ($('filter-tahun')) $('filter-tahun').value=String(cls.year);
    if ($('filter-kelas')) $('filter-kelas').value=classId;
    navigateTab(module);
    setTimeout(()=>{
      if(module==='pbd') {
        if($('pbd-year')) $('pbd-year').value=String(cls.year);
        if($('pbd-period')) $('pbd-period').value=scope.period;
        if(typeof populatePbdMatrixClassOptions==='function')populatePbdMatrixClassOptions(classId);
      }
      const select=$(module==='marks'?'filter-kelas':'pbd-class');
      if(select&&[...select.options].some(option=>option.value===classId)){
        select.value=classId;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(module==='marks' && scope.assessmentType!=='ALL' && typeof selectMarksAssessmentType==='function')selectMarksAssessmentType(scope.assessmentType);
      if(module==='pbd' && typeof renderPbdModule==='function')renderPbdModule();
    },0);
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

  let executiveFilters = null;
  function executiveScope() {
    if (!executiveFilters) {
      const ids = new Set(permittedClasses().flatMap(c => classStudents(c.id).map(s => s.id)));
      const exam = ['UASA','UPSA','DIAGNOSTIK'].find(type => {
        const exams = new Set((appState.assessments || []).filter(a => assessmentYear(a) === ay() && a.type === type && (!a.subject || String(a.subject).toUpperCase() === 'SEJARAH')).map(a => a.id));
        return actualScores().some(s => ids.has(s.studentId) && exams.has(s.assessmentId) && completeScore(s));
      }) || 'UPSA';
      executiveFilters = {exam,period:exam === 'UASA' ? 'AKHIR' : 'PERTENGAHAN',year:'ALL',classId:'ALL'};
    }
    // A class selected in a different session or role must never remain as a hidden filter.
    if (executiveFilters.classId !== 'ALL' && !permittedClasses().some(c=>c.id===executiveFilters.classId && (executiveFilters.year==='ALL'||String(c.year)===executiveFilters.year))) executiveFilters.classId='ALL';
    return executiveFilters;
  }
  function executiveClasses() {
    const scope = executiveScope();
    return permittedClasses().filter(c => (scope.year === 'ALL' || String(c.year) === scope.year) && (scope.classId === 'ALL' || c.id === scope.classId));
  }
  function executiveMark(score,assessment) {
    if (!completeScore(score) || score.absent) return null;
    const supplied = score.percentage;
    const maximum = Number(assessment?.maxScore || assessment?.totalMarks || 100);
    if (!(maximum > 0) || Number(score.rawScore) > maximum) return null;
    const value = supplied !== null && supplied !== undefined && String(supplied).trim() !== '' ? Number(supplied) : Number(score.rawScore) / maximum * 100;
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  }
  function getExecutiveSnapshot() {
    const scope = {...executiveScope()}, classes = executiveClasses(), ids = new Set(classes.flatMap(c => classStudents(c.id).map(s => s.id)));
    const allMarks = [], allPoints = [], belowMarkIds = new Set(), lowPbdIds = new Set();
    const progress = {enabled:scope.period==='AKHIR',improved:0,same:0,declined:0,reassessed:0,inherited:0,newFinal:0};
    let mastered = 0, recordedPbd = 0, expectedPbd = 0, inheritedPbd = 0, pbdMastered = 0, absent = 0;
    const classRows = classes.map(cls => {
      const students = classStudents(cls.id);
      const assessments = (appState.assessments || []).filter(a => a.classId === cls.id && assessmentYear(a) === ay() && a.type === scope.exam && (!a.subject || String(a.subject).toUpperCase() === 'SEJARAH'))
        .sort((a,b) => typeof compareAssessmentsByExamDate === 'function' ? compareAssessmentsByExamDate(b,a) : String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
      const assessment = assessments[0], scoreMap = new Map();
      if (assessment) actualScores().filter(s => s.assessmentId === assessment.id).forEach(s => { if (!scoreMap.has(s.studentId)) scoreMap.set(s.studentId,s); });
      const marks = [], points = []; let classAbsent = 0, classMtm = 0;
      students.forEach(student => {
        const score = scoreMap.get(student.id);
        if (score?.absent === true) { classAbsent++; return; }
        const value = executiveMark(score,assessment); if (value === null) return;
        const grade = typeof calculateGrade === 'function' ? calculateGrade(value) : null;
        const point = typeof gradePointForGrade === 'function' ? gradePointForGrade(grade) : null;
        marks.push(value); if (point !== null && Number.isFinite(point)) points.push(point);
        if (['A','B','C','D','E'].includes(grade)) classMtm++;
        if (value < 40) belowMarkIds.add(student.id);
      });
      const template = getPbdMatrixTemplate(Number(cls.year));
      const dskp = [...new Map(template.groups.flatMap(group => group.topics.map((_,index) => pbdMatrixDskpForTopic(Number(cls.year),group.key,index))).filter(Boolean).map(d => [d.id,d])).values()];
      let recorded = 0, inherited = 0, mastery = 0;
      students.forEach(student => dskp.forEach(d => {
        const record = getEffectivePbdMatrixRecord(student.id,d.id,scope.period,ay());
        if (scope.period === 'AKHIR') {
          const mid = getEffectivePbdMatrixRecord(student.id,d.id,'PERTENGAHAN',ay());
          const final = (appState.pbdRecords || []).find(r=>r.studentId===student.id && r.dskpId===d.id && periodOf(r)==='AKHIR' && String(r.academicYear || ay())===ay());
          if (validTp(final) && validTp(mid)) {progress.reassessed++;const delta=Number(final.tp)-Number(mid.tp);progress[delta>0?'improved':delta<0?'declined':'same']++;}
          else if (validTp(final)) progress.newFinal++;
        }
        if (!validTp(record)) return;
        recorded++; if (record.inherited) inherited++;
        if (Number(record.tp) >= 3) mastery++; else lowPbdIds.add(student.id);
      }));
      const expected = students.length * dskp.length;
      allMarks.push(...marks); allPoints.push(...points); mastered += classMtm; absent += classAbsent;
      recordedPbd += recorded; expectedPbd += expected; inheritedPbd += inherited; pbdMastered += mastery;
      return {id:cls.id,name:cls.name,year:Number(cls.year),students:students.length,assessmentMissing:!assessment,taken:marks.length,absent:classAbsent,expectedMarks:students.length,missingMarks:Math.max(0,students.length-marks.length-classAbsent),average:marks.length?marks.reduce((a,b)=>a+b,0)/marks.length:null,mtmPct:marks.length?classMtm/marks.length*100:null,gpmp:points.length?points.reduce((a,b)=>a+b,0)/points.length:null,pbdRecorded:recorded,pbdExpected:expected,pbdMissing:expected-recorded,pbdInherited:inherited,pbdMasteryPct:recorded?mastery/recorded*100:null};
    });
    const interventions = (appState.interventions || []).filter(r => ids.has(r.studentId) && String(r.academicYear || ay()) === ay() && r.status !== 'SELESAI');
    const due = interventions.filter(r => typeof isInterventionDue === 'function' && isInterventionDue(r)).length;
    const missingMarks = classRows.reduce((sum,r)=>sum+r.missingMarks,0), missingPbd = expectedPbd-recordedPbd, priorities = [];
    if (missingMarks) priorities.push({title:'Sahkan data markah sebelum membuat rumusan',detail:`${missingMarks} daripada ${ids.size} murid belum mempunyai markah sah atau status TH untuk ${scope.exam}. Semak kelas yang belum lengkap.`,target:'completeness'});
    if (belowMarkIds.size || lowPbdIds.size) priorities.push({title:'Rancang sokongan mengikut keperluan',detail:`${belowMarkIds.size} murid memperoleh markah di bawah 40%; ${lowPbdIds.size} murid mempunyai sekurang-kurangnya satu rekod SK di bawah TP3 dalam skop laporan. Kumpulan ini boleh bertindih. Murid Perhatian menggunakan purata dan trend keseluruhan, jadi senarainya mungkin berbeza.`,target:'attention'});
    if (due) priorities.push({title:'Semak susulan intervensi yang telah sampai tarikh',detail:`${due} daripada ${interventions.length} intervensi aktif telah sampai atau melepasi tarikh semakan. Catat hasil dan tetapkan langkah seterusnya.`,target:'intervention'});
    if (missingPbd) priorities.push({title:'Lengkapkan bukti pentaksiran PBD',detail:`${missingPbd} daripada ${expectedPbd} rekod SK belum diisi untuk tempoh yang dipilih. Penguasaan hanya mewakili ${recordedPbd} rekod yang berisi.`,target:'pbd'});
    if (inheritedPbd) priorities.push({title:'Nilai semula rekod PBD yang diwarisi',detail:`${inheritedPbd} rekod Akhir Tahun menggunakan TP Pertengahan sebagai kesinambungan. Sahkan semula apabila bukti baharu tersedia.`,target:'pbd'});
    if (!priorities.length) priorities.push({title:ids.size?'Teruskan pemantauan berjadual':'Pilih sesi atau kelas yang mempunyai murid aktif',detail:ids.size?'Tiada jurang data atau indikator sokongan di atas dikesan dalam skop ini. Semak analisis item untuk menentukan pengayaan seterusnya.':'Tiada murid aktif dalam skop pilihan. Keputusan prestasi tidak dikira.',target:ids.size?'item-analysis':'students'});
    priorities.forEach(p=>{p.action=({completeness:`Semak murid tanpa markah atau TH bagi ${scope.exam}; sahkan rekod sebelum membentang.`,attention:`Padankan keputusan ${scope.exam} dengan purata dan trend keseluruhan di Murid Perhatian, kemudian pilih murid untuk bimbingan.`,intervention:'Buka rekod susulan, catat hasil semakan dan tetapkan tarikh tindakan berikutnya.',pbd:p.title.includes('diwarisi')?'Semak bukti baharu dan sahkan semula TP Akhir Tahun yang masih diwarisi.':'Isi TP berdasarkan bukti pentaksiran bagi SK yang belum direkodkan.', 'item-analysis':'Semak topik sukar dan pilih aktiviti pengayaan atau pengukuhan untuk pengajaran berikutnya.',students:'Semak senarai murid aktif dan pilihan sesi sebelum menjana laporan semula.'})[p.target];});
    progress.inherited=inheritedPbd;
    return {academicYear:ay(),exam:scope.exam,period:scope.period,scopeLabel:`Sesi ${ay()} · ${scope.classId !== 'ALL' ? classes[0]?.name || 'Kelas tidak tersedia' : scope.year !== 'ALL' ? 'Tahun '+scope.year : 'Semua Tahun'} · ${scope.exam} · PBD ${scope.period==='AKHIR'?'Akhir Tahun':'Pertengahan Tahun'}`,classes:classes.length,students:ids.size,taken:allMarks.length,absent,missingMarks,expectedMarks:ids.size,average:allMarks.length?allMarks.reduce((a,b)=>a+b,0)/allMarks.length:null,mtmPct:allMarks.length?mastered/allMarks.length*100:null,gpmp:allPoints.length?allPoints.reduce((a,b)=>a+b,0)/allPoints.length:null,pbd:{recorded:recordedPbd,expected:expectedPbd,missing:missingPbd,inherited:inheritedPbd,masteryPct:recordedPbd?pbdMastered/recordedPbd*100:null,belowTp3:lowPbdIds.size,progress},classRows,priorities,interventions:{active:interventions.length,due},below40:belowMarkIds.size};
  }
  function getAttentionSnapshot() {
    return {academicYear:ay(),rows:attentionRows().map(r=>({name:r.student.name,className:(appState.classes||[]).find(c=>c.id===r.student.classId)?.name||'—',avgMark:r.avgMark,avgTp:r.avgTp,trend:r.trend,priority:r.priority,reasons:[...(r.reasons||[])]}))};
  }
  function setExecutiveScope(field,value) {
    const scope = executiveScope();
    if (field === 'session') {
      const sessions = typeof normalizedAcademicSessions === 'function' ? normalizedAcademicSessions().map(s=>String(s.year)) : [...new Set((appState.classes||[]).map(c=>String(c.academicYear)))];
      if (!sessions.includes(value) || !$('filter-academic-year')) return;
      $('filter-academic-year').value=value; scope.classId='ALL';
      // Update the shared selector without the entry-module initializer, which
      // creates assessment templates. Viewing an archived report is read-only.
      if ($('filter-kelas')) {
        const year=$('filter-tahun')?.value || 'ALL';
        $('filter-kelas').innerHTML='<option value="ALL">Semua Kelas</option>'+permittedClasses().filter(c=>year==='ALL'||String(c.year)===year).map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('');
        $('filter-kelas').value='ALL';
      }
    } else if (field === 'exam' && ['DIAGNOSTIK','UPSA','UASA'].includes(value)) scope.exam=value;
    else if (field === 'period' && ['PERTENGAHAN','AKHIR'].includes(value)) scope.period=value;
    else if (field === 'year' && ['ALL','4','5','6'].includes(value)) {scope.year=value;scope.classId='ALL';}
    else if (field === 'classId' && (value === 'ALL' || permittedClasses().some(c=>c.id===value && (scope.year==='ALL'||String(c.year)===scope.year)))) scope.classId=value;
    else return;
    renderExecutive(); $('executive-'+field)?.focus({preventScroll:true});
  }
  function openExecutiveAction(target) {
    const report=getExecutiveSnapshot(), scope=executiveScope();
    if (!['completeness','attention','intervention','pbd','item-analysis','students'].includes(target)) return;
    if (target === 'completeness') {completionScope().assessmentType=scope.exam;completionScope().period=scope.period;}
    if ($('filter-tahun')) $('filter-tahun').value=scope.year;
    if (typeof onTahunChange==='function') onTahunChange();
    if ($('filter-kelas')) $('filter-kelas').value=scope.classId;
    navigateTab(target);
    if (target === 'pbd') {
      if ($('pbd-period')) $('pbd-period').value=report.period;
      if ($('pbd-year') && scope.year!=='ALL') $('pbd-year').value=scope.year;
      if (typeof populatePbdMatrixClassOptions==='function') populatePbdMatrixClassOptions(scope.classId==='ALL'?null:scope.classId);
      if (typeof renderPbdModule==='function') renderPbdModule();
    }
  }
  function renderExecutive() {
    const scope=executiveScope(), d=getExecutiveSnapshot(), percent=value=>value===null?'—':value.toFixed(1)+'%', sessions=typeof normalizedAcademicSessions==='function'?normalizedAcademicSessions():[{year:ay(),label:ay()}];
    const options=(list,value)=>list.map(([id,label])=>`<option value="${safe(id)}" ${String(id)===String(value)?'selected':''}>${safe(label)}</option>`).join('');
    $('executive-report-content').innerHTML=`<section class="executive-purpose" aria-labelledby="executive-purpose-title"><div><p class="executive-eyebrow">Untuk mesyuarat & keputusan panitia</p><h2 id="executive-purpose-title">Apa yang telah dicapai, dan apa tindakan seterusnya?</h2><p>Gunakan laporan ini sebagai ringkasan pembentangan: semak prestasi satu ujian, kenal pasti jurang PBD dan bawa tindakan susulan ke mesyuarat. Pilihan di bawah menentukan semua angka dalam laporan.</p></div><div id="executive-print-actions"></div></section>
      <section class="executive-scope" aria-label="Skop laporan eksekutif"><label for="executive-session">Sesi<select id="executive-session" onchange="iSejarahV66.setExecutiveScope('session',this.value)">${options(sessions.map(s=>[s.year,s.label||s.year]),ay())}</select></label><label for="executive-year">Tahun<select id="executive-year" onchange="iSejarahV66.setExecutiveScope('year',this.value)">${options([['ALL','Semua Tahun'],['4','Tahun 4'],['5','Tahun 5'],['6','Tahun 6']],scope.year)}</select></label><label for="executive-classId">Kelas<select id="executive-classId" onchange="iSejarahV66.setExecutiveScope('classId',this.value)">${options([['ALL','Semua kelas dibenarkan'],...permittedClasses().filter(c=>scope.year==='ALL'||String(c.year)===scope.year).map(c=>[c.id,c.name])],scope.classId)}</select></label><label for="executive-exam">Ujian<select id="executive-exam" onchange="iSejarahV66.setExecutiveScope('exam',this.value)">${options([['DIAGNOSTIK','Diagnostik'],['UPSA','UPSA'],['UASA','UASA']],scope.exam)}</select></label><label for="executive-period">Tempoh PBD<select id="executive-period" onchange="iSejarahV66.setExecutiveScope('period',this.value)">${options([['PERTENGAHAN','Pertengahan Tahun'],['AKHIR','Akhir Tahun']],scope.period)}</select></label></section>
      <div id="executive-print"><div class="executive-context"><strong>${safe(d.scopeLabel)}</strong><span>${d.classes} kelas · ${d.students} murid aktif · Dijana ${safe(new Date().toLocaleString('ms-MY'))}</span></div>
      <div class="executive-kpis">${card('Purata '+d.exam,percent(d.average),d.taken+' murid bermarkah sah','blue')}${card('MTM · Gred A–E',percent(d.mtmPct),'TH dan markah kosong dikecualikan','mint')}${card('GPMP',d.gpmp===null?'—':d.gpmp.toFixed(2),'Lebih rendah = lebih baik','lilac')}${card('Penguasaan SK PBD',percent(d.pbd.masteryPct),d.pbd.recorded+' rekod berisi · TP3–TP6','peach')}</div>
      <section class="executive-quality" aria-labelledby="executive-quality-title"><h2 id="executive-quality-title">Semak liputan sebelum membuat keputusan</h2><div class="executive-quality-grid"><p><strong>${d.taken} bermarkah · ${d.absent} TH · ${d.missingMarks} belum lengkap</strong><span>${d.expectedMarks} murid dijangka untuk ${safe(d.exam)}. TH dikira sebagai status berisi, dan dikecualikan daripada purata, MTM dan GPMP.</span></p><p><strong>${d.pbd.recorded} / ${d.pbd.expected} rekod SK PBD berisi</strong><span>${d.pbd.missing} belum diisi${d.period==='AKHIR'?' · '+d.pbd.inherited+' diwarisi daripada Pertengahan':''}. Penguasaan ialah peratus rekod berisi yang mencapai TP3, bukan peratus semua murid.</span></p></div></section>
      ${d.pbd.progress.enabled?`<section class="executive-section" aria-labelledby="executive-progress-title"><div class="executive-section-heading"><h2 id="executive-progress-title">Perubahan PBD: Pertengahan → Akhir</h2><span>${d.pbd.progress.reassessed} rekod SK dinilai semula dan boleh dibandingkan</span></div><div class="executive-progress"><p><strong>${d.pbd.progress.improved}</strong><span>Meningkat</span></p><p><strong>${d.pbd.progress.same}</strong><span>Kekal selepas penilaian semula</span></p><p><strong>${d.pbd.progress.declined}</strong><span>Menurun</span></p></div><p class="executive-method">Perbandingan hanya menggunakan rekod SK dengan TP Pertengahan dan TP Akhir yang diisi secara berasingan. ${d.pbd.progress.inherited} rekod diwarisi tidak dianggap sebagai penilaian baharu atau “kekal”. ${d.pbd.progress.newFinal} rekod Akhir tanpa TP Pertengahan tidak dibandingkan.</p></section>`:''}
      <section class="executive-section" aria-labelledby="executive-classes-title"><div class="executive-section-heading"><h2 id="executive-classes-title">Prestasi mengikut kelas</h2><span>Ujian terkini bagi jenis yang dipilih dalam setiap kelas</span></div><div class="executive-table-scroll" tabindex="0" role="region" aria-label="Ringkasan prestasi kelas; leret untuk melihat semua lajur"><table class="executive-table" id="executive-class-table"><caption class="sr-only">Prestasi markah dan PBD dalam skop laporan</caption><thead><tr><th scope="col">Kelas</th><th scope="col">Murid</th><th scope="col">Bermarkah / TH</th><th scope="col">Purata</th><th scope="col">MTM</th><th scope="col">GPMP</th><th scope="col">Markah belum lengkap</th><th scope="col">SK PBD berisi</th><th scope="col">Penguasaan SK</th></tr></thead><tbody>${d.classRows.length?d.classRows.map(r=>`<tr><th scope="row">${safe(r.name)}</th><td>${r.students}</td><td>${r.taken} / ${r.absent}</td><td>${percent(r.average)}</td><td>${percent(r.mtmPct)}</td><td>${r.gpmp===null?'—':r.gpmp.toFixed(2)}</td><td>${r.missingMarks}${r.assessmentMissing?'<small>Ujian belum diwujudkan</small>':''}</td><td>${r.pbdRecorded} / ${r.pbdExpected}</td><td>${percent(r.pbdMasteryPct)}</td></tr>`).join(''):'<tr><td colspan="9">Tiada kelas atau murid aktif dalam skop ini.</td></tr>'}</tbody></table></div></section>
      <section class="executive-section" aria-labelledby="executive-actions-title"><div class="executive-section-heading"><h2 id="executive-actions-title">Agenda tindakan susulan</h2><span>${d.interventions.active} intervensi aktif · ${d.interventions.due} perlu semakan</span></div><ol class="executive-priorities">${d.priorities.map((p,i)=>`<li><span class="executive-step" aria-hidden="true">${i+1}</span><div><h3>${safe(p.title)}</h3><p>${safe(p.detail)}</p></div><button type="button" onclick="iSejarahV66.openExecutiveAction('${p.target}')">Semak <span class="sr-only">${safe(p.title)}</span>→</button></li>`).join('')}</ol><p class="executive-method">Cadangan di atas dijana daripada data dalam skop. Tetapkan pegawai bertanggungjawab, tarikh sasaran dan keputusan dalam minit mesyuarat. Laporan ini tidak mengubah rekod atau mencipta intervensi secara automatik.</p></section></div>`;
    window.iSejarahPresentationPrint?.install();
  }

  function printExecutive() {
    if(window.iSejarahPresentationPrint) return window.iSejarahPresentationPrint.open('executive');
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

  window.iSejarahV66={runRollover,backup,render,printExecutive,openCompletion,completionForClass,setCompletionScope,setCompletionContext,getExecutiveSnapshot,getAttentionSnapshot,setExecutiveScope,openExecutiveAction};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
