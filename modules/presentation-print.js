/* Read-only presentation printing. Never changes filters, tabs, records or saves. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const scriptUrl = document.currentScript?.src || new URL('modules/presentation-print.js', document.baseURI).href;
  const stylesheet = new URL('../presentation-print.css', scriptUrl);
  stylesheet.search = new URL(scriptUrl).search;
  const stylesheetUrl = stylesheet.href;
  const plain = value => String(value ?? '').trim();
  const text = id => plain($(id)?.textContent);
  const selected = id => {
    const select = $(id);
    return plain(select?.selectedOptions?.[0]?.textContent || select?.value);
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanText = node => plain(node?.textContent).replace(/\s+/g, ' ');
  const cellText = element => {
    const parts=[];
    const walk=node=>{
      if(node.nodeType===3){const value=plain(node.textContent).replace(/\s+/g,' ');if(value)parts.push(value);}
      else Array.from(node.childNodes||[]).forEach(walk);
    };
    walk(element);
    return parts.join(' · ');
  };
  let dialog = null, current = null, previousFocus = null, previousOverflow = '', generation = 0;

  function cloneChartValue(value, seen = new WeakMap()) {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value);
    const result = Array.isArray(value) ? [] : {};
    seen.set(value, result);
    Object.keys(value).forEach(key => { result[key] = cloneChartValue(value[key], seen); });
    return result;
  }

  function chartImage(canvasId, label, settings={}) {
    const source = $(canvasId);
    if (!source) return {label, url:''};
    let canvas = null, instance = null;
    try {
      const original = typeof Chart !== 'undefined' && typeof Chart.getChart === 'function' ? Chart.getChart(source) : null;
      if (original) {
        const config = original.config?._config || original.config;
        const options = cloneChartValue(config?.options || {});
        options.responsive = false;
        options.maintainAspectRatio = false;
        options.animation = false;
        options.devicePixelRatio = 1.5;
        options.color = '#46536b';
        options.plugins = options.plugins || {};
        options.plugins.legend = {...(options.plugins.legend || {}), labels:{...(options.plugins.legend?.labels || {}), color:'#46536b', font:{size:15}}};
        if(settings.legendPosition)options.plugins.legend.position=settings.legendPosition;
        if(settings.legendFontSize)options.plugins.legend.labels.font.size=settings.legendFontSize;
        options.plugins.title = {...(options.plugins.title || {}), color:'#273653'};
        Object.values(options.scales || {}).forEach(scale => {
          if (!scale || typeof scale !== 'object') return;
          scale.ticks = {...(scale.ticks || {}), color:'#46536b', font:{size:14}};
          scale.title = {...(scale.title || {}), color:'#46536b'};
          scale.grid = {...(scale.grid || {}), color:'#e2e8f0'};
        });
        canvas = document.createElement('canvas');
        canvas.width = 1100; canvas.height = 530;
        canvas.style.cssText = 'position:fixed;left:-20000px;top:0;width:1100px;height:530px;pointer-events:none';
        canvas.setAttribute('aria-hidden','true');
        document.body.appendChild(canvas);
        instance = new Chart(canvas, {type:config.type, data:cloneChartValue(original.data), options});
        instance.update('none');
        return {label, url:canvas.toDataURL('image/png')};
      }
      if (source.width > 0 && source.height > 0) return {label, url:source.toDataURL('image/png')};
    } catch (error) {
      console.warn('Carta cetakan:', error?.message || error);
    } finally {
      try { instance?.destroy(); } catch (_) {}
      canvas?.remove();
    }
    return {label, url:''};
  }

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  }
  function kpi(label, value, note='') { return {label:plain(label), value:plain(value) || '—', note:plain(note)}; }
  function kpiHtml(items) {
    return `<div class="ps-kpis">${items.map((x, i) => `<article class="ps-kpi ps-tone-${i % 4}"><p>${escape(x.label)}</p><strong>${escape(x.value)}</strong>${x.note ? `<small>${escape(x.note)}</small>` : ''}</article>`).join('')}</div>`;
  }
  function figureHtml(chart, className='') {
    return `<figure class="ps-figure ${className}"><figcaption>${escape(chart.label)}</figcaption>${chart.url ? `<img src="${escape(chart.url)}" alt="${escape(chart.label)}">` : '<div class="ps-empty">Carta belum tersedia dalam paparan semasa.</div>'}</figure>`;
  }
  function valueHtml(label, value, note='') {
    return `<div class="ps-value"><span>${escape(label)}</span><strong>${escape(value || '—')}</strong>${note ? `<small>${escape(note)}</small>` : ''}</div>`;
  }
  function targetHtml(legendId) {
    const entries = Array.from($(legendId)?.children || []).map(item => ({label:cleanText(item.querySelector('span')), value:cleanText(item.querySelector('strong'))}));
    return `<div class="ps-targets">${entries.map((item,i) => `<div class="ps-target ps-tone-${i % 4}"><span>${escape(item.label)}</span><strong>${escape(item.value)}</strong></div>`).join('') || '<p class="ps-empty">Belum ada data sasaran.</p>'}</div>`;
  }
  function gradeCardsHtml() {
    return Array.from($('hc-grade-cards')?.children || []).map(item=>{
      const first=item.children[0],last=item.children[1];
      const grade=cleanText(first?.querySelector('span'));
      const description=cleanText(first?.querySelector('p'));
      const count=cleanText(item.querySelector('strong'));
      const percentage=cleanText(last?.querySelector('p'));
      return grade?`<div><b>${escape(grade)}</b><span>${escape(description)}</span><strong>${escape(count)} murid</strong><small>${escape(percentage)}</small></div>`:`<div>${escape(cleanText(item))}</div>`;
    }).join('');
  }

  // Only text, row/column spans, and a small semantic TP colour marker cross
  // into the print document. No inline handlers, app CSS or sticky offsets.
  function tableSnapshot(table, options={}) {
    if (!table) return null;
    const output = node('table','ps-table');
    const allRows = Array.from(table.tHead?.rows || []);
    const columnCount = allRows[allRows.length-1]?.cells.length || table.rows[0]?.cells.length || 0;
    const indices = options.indices || Array.from({length:columnCount},(_,i)=>i).filter(i => !options.omit?.includes(i));
    const copyRow = (row, header=false) => {
      const tr = node('tr');
      indices.forEach((index,position) => {
        const original = row.cells[index];
        if (!original) return;
        const cell = node(header?'th':'td');
        if (header) cell.scope='col';
        const source = original.cloneNode(true);
        source.querySelectorAll('svg, i, .hc-avatar, .cute-page-icon, .hc-tov-source, .hc-icon-btn, input, select, textarea, script, style').forEach(element=>element.remove());
        cell.textContent = cellText(source) || '—';
        if (!header && options.nameColumn === index) {
          cell.className='ps-name';
          const strong=source.querySelector('.hc-student-main strong, span.block.font-bold');
          const secondary=source.querySelector('.hc-student-main div > span, span.block.text-\\[10px\\]');
          if(strong) {
            cell.textContent='';cell.appendChild(node('strong','',cleanText(strong)));
            if(secondary)cell.appendChild(node('small','',cleanText(secondary)));
          }
        }
        if(!header && options.heatmap && position>0) {
          const tp=cell.textContent.match(/\bTP([1-6])\b/);
          if(tp)cell.classList.add(`ps-tp-${tp[1]}`);
        }
        if(header && (options.nameColumn===index))cell.classList.add('ps-name');
        tr.appendChild(cell);
      });
      return tr;
    };
    const thead = node('thead');
    allRows.forEach(row=>thead.appendChild(copyRow(row,true)));
    output.appendChild(thead);
    const tbody=node('tbody');
    Array.from(table.tBodies || []).flatMap(body=>Array.from(body.rows)).forEach(row=>tbody.appendChild(copyRow(row)));
    output.appendChild(tbody);
    if(options.kind)output.classList.add(`ps-table-${options.kind}`);
    return output;
  }

  function dataTable(headers, rows, kind, nameColumn=1) {
    const table=node('table',`ps-table ps-table-${kind}`),head=node('thead'),heading=node('tr'),body=node('tbody');
    headers.forEach((label,index)=>{const th=node('th',index===nameColumn?'ps-name':'',label);th.scope='col';heading.appendChild(th);});
    head.appendChild(heading);table.append(head,body);
    rows.forEach(values=>{const tr=node('tr');values.forEach((value,index)=>tr.appendChild(node('td',index===nameColumn?'ps-name':'',plain(value)||'—')));body.appendChild(tr);});
    return table;
  }

  function marksGradeCardsHtml() {
    return Array.from($('grade-percentage-cards')?.children || []).map(card=>{
      const heading=card.firstElementChild;
      return `<div><b>${escape(cleanText(heading?.children[0]))}</b><span>${escape(cleanText(card.lastElementChild))}</span><strong>${escape(cleanText(heading?.children[1]))}</strong><small>${escape(cleanText(card.querySelector('.analytics-percent')))}</small></div>`;
    }).join('');
  }

  function marksCandidateTable(nearMiss=false) {
    // These are the already authorized/scoped rows used by the visible analytics.
    // Screen cards cap at 9/12; print the complete candidate list without changing filters.
    const rows=typeof analyticsCurrentRows!=='undefined' && Array.isArray(analyticsCurrentRows) ? analyticsCurrentRows : [];
    if(nearMiss) {
      const candidates=rows.map(row=>({row,info:typeof analyticsNearMissInfo==='function'?analyticsNearMissInfo(row):{nearMiss:false}}))
        .filter(x=>x.info.nearMiss).sort((a,b)=>a.info.gap-b.info.gap||String(a.row.student?.name||'').localeCompare(String(b.row.student?.name||''),'ms'));
      return dataTable(['Bil','Nama Murid','Kelas','Pentaksiran','Markah','Gred → Sasaran','Jurang'],candidates.map(({row:r,info},i)=>[
        i+1,r.student?.name,r.cls?.name,r.assessment?.name,`${Math.round(info.value)}%`,`${info.currentGrade} → ${info.targetGrade}`,`${info.gap} markah`
      ]),'near-miss');
    }
    const candidates=rows.filter(r=>typeof analyticsRowStatus==='function' && analyticsRowStatus(r)==='SOKONGAN').sort((a,b)=>Number(a.score.percentage)-Number(b.score.percentage));
    return dataTable(['Bil','Nama Murid','Kelas','Pentaksiran','Markah','Gred'],candidates.map((r,i)=>[
      i+1,r.student?.name,r.cls?.name,r.assessment?.name,`${Math.round(Number(r.score.percentage))}%`,r.score.grade
    ]),'support');
  }

  function collectDashboard() {
    const slides=[{section:'Dashboard',title:'Ringkasan prestasi Sejarah',html:kpiHtml([
      kpi('Jumlah Murid',text('kpi-total-students'),text('kpi-total-classes')),
      kpi('Purata Markah',text('kpi-avg-marks'),text('kpi-avg-grade')),
      kpi('Menguasai',text('kpi-mastery'),text('kpi-mastery-count')),
      kpi('TP Dominan',text('kpi-dominant-tp')),
      kpi('Perlu Intervensi',text('kpi-intervention'),'Bawah TP3 / Gred E–F'),
      kpi('PBD Belum Lengkap',text('kpi-pbd-pending'),text('kpi-pbd-pending-count'))
    ])+`<div class="ps-two-col ps-summary-charts">${figureHtml(chartImage('chart-grades','Taburan Gred Markah Sejarah'))}${figureHtml(chartImage('chart-tp','Taburan Tahap Penguasaan TP1–TP6',{legendPosition:'bottom',legendFontSize:20}))}</div>`}];
    const gpmpScope=[selected('filter-academic-year'),text('dashboard-gpmp-chart-scope')||selected('dashboard-gpmp-year')].filter(Boolean).join(' · ');
    slides.push({section:'GPMP Dashboard',title:'Perbandingan trend GPMP Headcount',scope:gpmpScope,html:`<div class="ps-two-col ps-dashboard-gpmp">${figureHtml(chartImage('dashboard-gpmp-chart','Sasaran dan pencapaian GPMP'))}<section class="ps-panel"><h3>Ringkasan GPMP</h3>${tableSnapshot($('dashboard-gpmp-table'),{kind:'gpmp'})?.outerHTML||'<p class="ps-empty">Belum ada data GPMP.</p>'}<p class="ps-note">GPMP lebih rendah menunjukkan pencapaian lebih baik. TH dan rekod kosong dikecualikan. Sasaran sama seperti Headcount Sejarah.</p></section></div>`});
    slides.push({section:'Status Kelas',title:'Status pengisian dan purata kelas Sejarah',table:tableSnapshot($('dashboard-class-overview-table'),{omit:[7],nameColumn:0,kind:'class-overview'}),note:'Kelas dalam skop Dashboard semasa. Nilai disalin daripada paparan ringkasan kelas.'});
    return slides;
  }

  function collectMarks() {
    const kpis=[kpi('Jumlah Murid',text('an-kpi-total')),kpi('Markah Diisi',text('an-kpi-filled')),kpi('Purata',text('an-kpi-average')),kpi('Median',text('an-kpi-median')),kpi('Tertinggi',text('an-kpi-high')),kpi('Terendah',text('an-kpi-low')),kpi('Menguasai',text('an-kpi-mastery')),kpi('Tidak Hadir',text('an-kpi-absent'))];
    const summary=kpiHtml(kpis).replace('class="ps-kpis"','class="ps-kpis ps-kpis-wrap"');
    const insights=Array.from($('analytics-insights')?.children||[]).map(item=>cleanText(item.querySelector('span'))||cleanText(item));
    const compareStats=Array.from($('analytics-comparison-stats')?.children||[]).map(item=>{
      const parts=item.querySelectorAll('p');return parts.length>1?valueHtml(cleanText(parts[1]),cleanText(parts[0])):`<p class="ps-note">${escape(cleanText(item))}</p>`;
    }).join('');
    const comparisonActive=$('analytics-assessment-b')?.value && $('analytics-assessment-b').value!=='NONE';
    const localScope=[selected('analytics-student-year-filter'),selected('analytics-student-class-filter'),selected('analytics-grade-filter'),selected('analytics-status-filter'),$('analytics-search')?.value?`Carian: ${$('analytics-search').value}`:''].filter(Boolean).join(' · ');
    return [
      {section:'Analisis Markah',title:'Ringkasan pencapaian markah',html:summary+`<div class="ps-two-col ps-marks-summary"><section class="ps-panel"><h3>GPMP Keseluruhan</h3>${valueHtml('GPMP',text('an-kpi-gpmp'),'Lebih rendah menunjukkan prestasi lebih baik')}<p class="ps-note">${escape(text('an-gpmp-basis'))}</p></section><section class="ps-panel"><h3>Status Pengisian · ${escape(text('an-completion-label'))}</h3><div class="ps-marks-status">${valueHtml('Diisi',text('an-complete-filled'))}${valueHtml('Belum diisi',text('an-complete-missing'))}${valueHtml('Tidak Hadir',text('an-complete-absent'))}</div></section></div>`},
      {section:'Analisis Gred Markah',title:'Peratusan gred markah',html:`<div class="ps-two-col ps-pbd-charts"><section class="ps-panel"><h3>Gred dan peratusan calon</h3><div class="ps-grade-list">${marksGradeCardsHtml()}</div><p class="ps-note">${escape(text('grade-percentage-valid-count'))}. Peratus dikira daripada calon bermarkah sah; TH dikecualikan.</p></section>${figureHtml(chartImage('analytics-grade-chart','Peratusan calon mengikut gred'))}</div>`},
      {section:'Julat Skor & Insight',title:'Taburan skor dan insight prestasi',html:`<div class="ps-two-col ps-pbd-charts">${figureHtml(chartImage('analytics-band-chart','Taburan julat skor'))}<section class="ps-panel"><h3>Insight Prestasi</h3><ul class="ps-insight-list">${insights.map(item=>`<li>${escape(item)}</li>`).join('')||'<li>Belum ada insight untuk skop ini.</li>'}</ul></section></div>`},
      {section:'GPMP Mengikut Kelas',title:'GPMP kelas dalam skop analisis',table:tableSnapshot($('gpmp-class-table'),{nameColumn:0,kind:'gpmp'}),note:'Berdasarkan jenis ujian dipilih; TH dan markah kosong dikecualikan.'},
      {section:'GPMP Mengikut Tahun',title:'GPMP mengikut Tahun 4, 5 dan 6',table:tableSnapshot($('gpmp-year-table'),{kind:'gpmp'}),note:'Gabungan kelas yang termasuk dalam skop analisis semasa.'},
      {section:'Perbandingan Pentaksiran',title:'Perbandingan prestasi pentaksiran',note:text('analytics-comparison-subtitle'),html:comparisonActive?`<div class="ps-two-col ps-trend-layout ps-marks-comparison">${figureHtml(chartImage('analytics-compare-chart','Purata pentaksiran yang dibandingkan'))}<section class="ps-panel"><h3>Perubahan Prestasi</h3>${compareStats}</section></div>`:'<div class="ps-empty">Tiada perbandingan aktif. Pilih “Banding Dengan” dalam Analisis Markah untuk mencetak perbandingan pentaksiran.</div>'},
      {section:'Prestasi Individu',title:'Prestasi individu murid',table:tableSnapshot($('analytics-student-table'),{nameColumn:1,kind:'marks-students'}),note:`${text('analytics-table-subtitle')} · ${localScope}`},
      {section:'Murid Memerlukan Sokongan',title:'Senarai murid yang memerlukan sokongan',table:marksCandidateTable(false),note:`Julat sokongan 0–${text('analytics-threshold-label')||'39%'} · Senarai penuh dalam skop analisis; penapis tempatan jadual murid tidak digunakan pada senarai ini.`},
      {section:'Calon Near Miss',title:'Calon Near Miss dan sasaran gred',table:marksCandidateTable(true),note:`Margin ${text('analytics-nearmiss-margin')||'5'} markah daripada gred lebih baik. Senarai penuh dalam skop analisis; penapis tempatan jadual murid tidak digunakan pada senarai ini.`}
    ];
  }

  function scopeFor(kind) {
    const school=text('topbar-school-name') || text('sidebar-school-name') || 'Panitia Sejarah';
    const date=new Date().toLocaleString('ms-MY',{dateStyle:'medium',timeStyle:'short'});
    if(kind==='dashboard')return {
      school,date,title:'Dashboard Prestasi Panitia Sejarah',
      scope:[selected('filter-academic-year'),selected('filter-tahun'),selected('filter-kelas'),$('filter-assessment')?.value?selected('filter-assessment'):'Rekod markah dalam skop semasa'].filter(Boolean).join(' · '),
      note:'Skop mengikut penapis Dashboard. Ringkasan GPMP menggunakan skopnya yang dipaparkan pada slaid GPMP.'
    };
    if(kind==='marks')return {
      school,date,title:'Analisis Markah Ujian Sejarah',
      scope:[selected('analytics-year-session'),selected('analytics-year-level'),selected('analytics-class'),selected('analytics-assessment-type')].filter(Boolean).join(' · '),
      note:[`Utama: ${selected('analytics-assessment-a')}`,`Banding: ${selected('analytics-assessment-b')}`].join(' · ')
    };
    if(kind==='headcount')return {
      school,date,title:'Headcount & Analisis Prestasi Sejarah',
      scope:[selected('headcount-session'),selected('headcount-year'),selected('headcount-class')].filter(Boolean).join(' · '),
      note:[`Ringkasan: ${cleanText(document.querySelector('#hc-tab-summary .hc-segment.active')) || 'UPSA'}`,`Analisis gred: ${cleanText(document.querySelector('#hc-tab-grades .hc-segment.active')) || 'UPSA'}`,`Trend: ${selected('hc-trend-metric') || 'Purata Markah'}`].join(' · ')
    };
    return {
      school,date,title:'Analisis & Heat Map PBD Sejarah',
      scope:[selected('pbd-an-session'),selected('pbd-an-year'),selected('pbd-an-class'),selected('pbd-an-period')].filter(Boolean).join(' · '),
      note:[selected('pbd-an-theme'),selected('pbd-an-sk'),selected('pbd-an-heatmap-focus'),$('pbd-an-search')?.value ? `Carian: ${$('pbd-an-search').value}`:''].filter(Boolean).join(' · ')
    };
  }

  function collectHeadcount() {
    const slides=[];
    const summaryChart=chartImage('hc-summary-grade-chart','Distribusi Gred');
    slides.push({section:'Ringkasan',title:'Pencapaian semasa',html:kpiHtml([
      kpi('Jumlah Murid',text('hc-kpi-total')),
      kpi(text('hc-kpi-average-label'),text('hc-kpi-average')),
      kpi('MTM',text('hc-kpi-mtm'),text('hc-kpi-mtm-note')),
      kpi('BMTM',text('hc-kpi-bmtm'),text('hc-kpi-bmtm-note')),
      kpi('GPMP',text('hc-kpi-gpmp'),'Lebih rendah lebih baik'),
      kpi('Capai / Melebihi',text('hc-kpi-target'),'Murid'),
      kpi('Perlu Sokongan',text('hc-kpi-attention'),'Murid')
    ])+`<div class="ps-two-col ps-summary-charts">${figureHtml(summaryChart)}<section class="ps-panel"><h3>Tahap minimum</h3>${valueHtml('MTM',text('hc-summary-mtm-pct'),text('hc-summary-mtm-count'))}${valueHtml('BMTM',text('hc-summary-bmtm-pct'),text('hc-summary-bmtm-count'))}<p class="ps-note">A–E = MTM · F = BMTM · TH dikecualikan.</p><p class="ps-note">${escape(text('hc-summary-attendance'))}</p></section></div>`});
    const attention=Array.from($('hc-attention-list')?.querySelectorAll('.hc-attention-item') || []).map(item=>({name:cleanText(item.querySelector('strong')),note:cleanText(item.querySelector('p'))}));
    slides.push({section:'Ringkasan',title:'Sasaran dan sokongan murid',html:`<div class="ps-two-col"><section class="ps-panel"><h3>Pencapaian Sasaran</h3>${targetHtml('hc-target-legend')}</section><section class="ps-panel"><h3>Murid Memerlukan Sokongan</h3>${attention.length?`<ol class="ps-attention">${attention.map(item=>`<li><strong>${escape(item.name)}</strong><span>${escape(item.note)}</span></li>`).join('')}</ol>`:'<p class="ps-empty">Tiada murid memerlukan sokongan segera dalam paparan semasa.</p>'}<p class="ps-note">Senarai sokongan mengikut paparan ringkasan. Prestasi semua murid disenaraikan pada slaid berikutnya.</p></section></div>`});
    const students=tableSnapshot($('hc-student-table-body')?.closest('table'),{omit:[11],nameColumn:1,kind:'students'});
    slides.push({section:'Prestasi Murid',title:'Prestasi dan sasaran setiap murid',table:students,note:[`Carian: ${$('hc-student-search')?.value || 'Semua nama'}`,`Penapis: ${selected('hc-performance-filter') || 'Semua Murid'}`].join(' · ')});
    slides.push({section:'Analisis Gred',title:`Analisis gred · ${text('hc-grade-analysis-label') || 'Pentaksiran semasa'}`,html:kpiHtml([
      kpi('Jumlah Murid',text('hc-grade-total')),kpi('Jumlah Ambil',text('hc-grade-taken')),kpi('Tidak Hadir',text('hc-grade-absent')),kpi('GPMP',text('hc-grade-gpmp'),'TH dikecualikan')
    ])+`<div class="ps-two-col ps-grade-charts"><section class="ps-panel"><h3>Taburan Gred</h3><div class="ps-grade-list">${gradeCardsHtml()}</div>${valueHtml('MTM',text('hc-grade-mtm-pct'),text('hc-grade-mtm-count'))}${valueHtml('BMTM',text('hc-grade-bmtm-pct'),text('hc-grade-bmtm-count'))}</section>${figureHtml(chartImage('hc-grade-chart','Jumlah murid mengikut gred'))}</div>`});
    slides.push({section:'Trend Headcount',title:'Perjalanan sasaran dan pencapaian',html:`<div class="ps-two-col ps-trend-layout">${figureHtml(chartImage('hc-trend-chart',text('hc-trend-subtitle') || 'Trend Prestasi Sejarah'))}<section class="ps-panel">${valueHtml('Purata TOV',text('hc-trend-toy'))}${valueHtml('Perubahan TOV → UPSA',text('hc-trend-upsa-change'))}${valueHtml('Perubahan UPSA → UASA',text('hc-trend-uasa-change'))}${valueHtml('Progress ke ETR',text('hc-trend-progress'))}</section></div>`});
    const projections=[0,1,2,3].map(i=>kpi(text(`hc-proj-label-${i}`),text(`hc-proj-gpmp-${i}`)));
    slides.push({section:'Trend Headcount',title:'Sasaran dan unjuran Near Miss',html:`<div class="ps-two-col"><section class="ps-panel"><h3>Pencapaian Sasaran</h3>${targetHtml('hc-trend-target-legend')}<p class="ps-note">Berdasarkan keputusan sebenar terkini.</p></section><section class="ps-panel"><h3>Unjuran GPMP Near Miss · 3 Tahun</h3><p class="ps-note">${escape(text('hc-nearmiss-count'))}</p>${kpiHtml(projections)}${figureHtml(chartImage('hc-projection-chart','Unjuran GPMP Near Miss'),'ps-projection')}<p class="ps-note">Simulasi penukaran 35%, 70% dan 100% calon near miss kepada satu gred lebih baik. GPMP lebih rendah menunjukkan peningkatan. Ini bukan ramalan mutlak.</p></section></div>`});
    return slides;
  }

  function collectPbd() {
    const slides=[{section:'Analisis PBD',title:'Ringkasan penguasaan Standard Kandungan',html:kpiHtml([
      kpi('Jumlah Murid',text('pbd-an-kpi-students'),text('pbd-an-kpi-classes')),
      kpi('Rekod SK',text('pbd-an-kpi-records'),text('pbd-an-kpi-expected')),
      kpi('Kelengkapan SK',text('pbd-an-kpi-completion')),
      kpi('Purata TP SK',text('pbd-an-kpi-dominant'),text('pbd-an-kpi-dominant-count')),
      kpi(`Penguasaan ≥ TP${text('pbd-an-mastery-threshold-label') || '3'}`,text('pbd-an-kpi-mastery'),text('pbd-an-kpi-mastery-count')),
      kpi('SK Perlu Pengukuhan',text('pbd-an-kpi-support-sp'),'Penguasaan bawah 60%')
    ])+`<div class="ps-two-col ps-insights"><section class="ps-panel ps-tone-0"><p class="ps-eyebrow">Standard Kandungan paling dikuasai</p><h3>${escape(text('pbd-an-strong-code'))}</h3><p>${escape(text('pbd-an-strong-text'))}</p><strong>${escape(text('pbd-an-strong-rate'))}</strong></section><section class="ps-panel ps-tone-2"><p class="ps-eyebrow">Standard Kandungan perlu pengukuhan</p><h3>${escape(text('pbd-an-support-code'))}</h3><p>${escape(text('pbd-an-support-text'))}</p><strong>${escape(text('pbd-an-support-rate'))}</strong></section></div>`},
    {section:'Analisis PBD',title:'Taburan TP dan penguasaan SK',html:`<div class="ps-two-col ps-pbd-charts">${figureHtml(chartImage('pbd-analytics-tp-chart','Taburan TP Standard Kandungan'))}${figureHtml(chartImage('pbd-analytics-sp-chart','Penguasaan Mengikut Standard Kandungan'))}</div><p class="ps-note">Carta penguasaan mengikut paparan analisis. Jadual pada bahagian akhir menyenaraikan semua SK dalam skop.</p>`}];
    const heat=$('pbd-an-heatmap-body')?.closest('table');
    const totalColumns=heat?.tHead?.rows[0]?.cells.length || 0;
    const themes=Math.max(0,totalColumns-2);
    const chunks=Math.max(1,Math.ceil(themes/5));
    for(let chunk=0;chunk<chunks;chunk++) {
      const themeIndices=Array.from({length:Math.min(5,themes-chunk*5)},(_,i)=>chunk*5+i+1);
      const indices=totalColumns?[0,...themeIndices,totalColumns-1]:[];
      slides.push({section:'Mastery Heat Map',title:chunks>1?`Purata Tema · Kumpulan ${chunk+1}/${chunks}`:'Purata Tema setiap murid',table:tableSnapshot(heat,{indices,nameColumn:0,heatmap:true,kind:'heatmap'}),note:`${text('pbd-an-heatmap-subtitle')} · TP1–TP6 = purata Tema · — = belum lengkap`});
    }
    slides.push({section:'Analisis Standard Kandungan',title:'Kelengkapan, penguasaan dan tindakan SK',table:tableSnapshot($('pbd-an-sk-table'),{kind:'sk'}),note:'Semua Standard Kandungan dalam skop analisis semasa.'});
    return slides;
  }

  function createSlide(doc, descriptor, metadata) {
    const slide=doc.createElement('section');slide.className='ps-slide';
    slide.dataset.section=descriptor.section;
    slide.innerHTML=`<header class="ps-header"><div><p class="ps-eyebrow">PANITIA SEJARAH · ${escape(descriptor.section)}</p><h1>${escape(descriptor.title)}</h1><p class="ps-scope">${escape(descriptor.scope||metadata.scope)}</p></div><span class="ps-school">${escape(metadata.school)}</span></header><main class="ps-main"></main><footer class="ps-footer"><span>${escape(metadata.title)}</span><span>Dijana ${escape(metadata.date)}</span><strong class="ps-page-number"></strong></footer>`;
    if(descriptor.note)slide.querySelector('.ps-main').appendChild(Object.assign(doc.createElement('p'),{className:'ps-table-note',textContent:descriptor.note}));
    return slide;
  }

  function renderDeck(doc, descriptors, metadata) {
    const deck=doc.querySelector('.ps-deck');
    deck.replaceChildren();
    for(const descriptor of descriptors) {
      if(!descriptor.table) {
        const slide=createSlide(doc,descriptor,metadata);
        slide.querySelector('.ps-main').insertAdjacentHTML('beforeend',descriptor.html || '<p class="ps-empty">Tiada rekod dalam skop semasa.</p>');
        deck.appendChild(slide);
        continue;
      }
      const original=descriptor.table;
      const rows=Array.from(original.tBodies[0]?.rows || []);
      let slide=null,table=null,body=null,part=0;
      const startPage=()=>{
        part++;
        slide=createSlide(doc,descriptor,metadata);
        table=doc.importNode(original,false);
        if(original.tHead)table.appendChild(doc.importNode(original.tHead,true));
        body=doc.createElement('tbody');table.appendChild(body);
        slide.querySelector('.ps-main').appendChild(table);deck.appendChild(slide);
      };
      startPage();
      if(!rows.length) {
        const row=doc.createElement('tr'),cell=doc.createElement('td');
        cell.colSpan=Math.max(1,original.tHead?.rows[0]?.cells.length || 1);cell.className='ps-empty';cell.textContent='Tiada rekod sepadan dengan skop atau penapis semasa.';row.appendChild(cell);body.appendChild(row);
      }
      rows.forEach(sourceRow=>{
        const row=doc.importNode(sourceRow,true);body.appendChild(row);
        const main=slide.querySelector('.ps-main');
        if(main.scrollHeight>main.clientHeight+1 && body.rows.length>1) {
          row.remove();startPage();body.appendChild(row);
        }
      });
      // Keep the measured header height unchanged after pagination. Adding a
      // part counter to a long title can wrap it and steal space from the table.
      if(part>1)Array.from(deck.children).filter(page=>page.dataset.section===descriptor.section&&page.querySelector('h1')?.textContent===descriptor.title).forEach((page,index)=>{
        page.querySelector('.ps-footer span').appendChild(doc.createTextNode(` · Bahagian ${index+1}/${part}`));
      });
    }
    const pages=Array.from(deck.querySelectorAll('.ps-slide'));
    pages.forEach((slide,index)=>slide.querySelector('.ps-page-number').textContent=`${index+1} / ${pages.length}`);
    return pages.length;
  }

  function setPreviewScale() {
    const frame=dialog?.querySelector('iframe'),doc=frame?.contentDocument;
    if(!doc?.documentElement)return;
    const width=dialog.querySelector('[data-ps-format]')?.value==='a4'?1122.52:1280;
    const available=Math.min(frame.clientWidth,doc.documentElement.clientWidth||frame.clientWidth);
    const scale=Math.min(1,Math.max(.18,(available-38)/width));
    doc.documentElement.style.setProperty('--ps-preview-scale',String(scale));
    const deck=doc.querySelector('.ps-deck'),viewport=doc.querySelector('.ps-preview-viewport');
    if(deck&&viewport){
      deck.style.left=Math.max(0,(available-width*scale)/2)+'px';
      viewport.style.height=Math.ceil(deck.offsetHeight*scale)+'px';
    }
  }

  async function loadPreview() {
    if(!current||!dialog)return;
    const token=++generation;
    const format=dialog.querySelector('[data-ps-format]').value;
    const frame=dialog.querySelector('iframe'),status=dialog.querySelector('[data-ps-status]'),print=dialog.querySelector('[data-ps-print]');
    print.disabled=true;status.textContent='Menyediakan pratonton…';
    const pageSize=format==='a4'?'A4 landscape':'338.666667mm 190.5mm';
    const snapshot=current;
    const loaded=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Pratonton mengambil masa terlalu lama. Cuba buka semula.')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};
    });
    frame.srcdoc=`<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>${escape(snapshot.metadata.title)}</title><link rel="stylesheet" href="${escape(stylesheetUrl)}"><style>@page{size:${pageSize};margin:0}</style></head><body class="ps-document" data-format="${format}"><div class="ps-preview-viewport"><div class="ps-deck"></div></div></body></html>`;
    try {
      await loaded;
      if(token!==generation||!dialog?.open)return;
      const doc=frame.contentDocument;
      if(doc.fonts?.ready)await doc.fonts.ready;
      const pages=renderDeck(doc,snapshot.slides,snapshot.metadata);
      await Promise.all(Array.from(doc.images).map(image=>image.decode?.().catch(()=>{}) || Promise.resolve()));
      if(token!==generation)return;
      setPreviewScale();
      status.textContent=`${pages} halaman · ${format==='a4'?'A4 landskap':'Slaid 16:9'} · ${snapshot.metadata.note}`;
      print.disabled=false;
    } catch(error) {
      if(token!==generation)return;
      status.textContent=error?.message || 'Pratonton tidak dapat dijana. Tutup dan cuba semula.';
    }
  }

  function close() {
    generation++;
    if(dialog?.open)dialog.close();
    dialog?.remove();dialog=null;current=null;
    document.documentElement.style.overflow=previousOverflow;
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    previousFocus=null;
  }

  function open(kind) {
    const views={headcount:'view-headcount',pbd:'view-analytics-pbd',dashboard:'view-dashboard',marks:'view-analytics-marks'};
    const collectors={headcount:collectHeadcount,pbd:collectPbd,dashboard:collectDashboard,marks:collectMarks};
    if(!views[kind])return;
    const view=$(views[kind]);
    if(!view||view.classList.contains('hidden'))return;
    if(dialog)close();
    previousFocus=document.activeElement;
    const metadata=scopeFor(kind);
    current={metadata,slides:collectors[kind]()};
    dialog=node('dialog','presentation-print-dialog');
    dialog.id='isejarah-presentation-dialog';dialog.setAttribute('aria-labelledby','ps-dialog-title');
    dialog.innerHTML=`<div class="presentation-print-toolbar"><div><p>PRATONTON CETAKAN</p><h2 id="ps-dialog-title">${escape(metadata.title)}</h2></div><div class="presentation-print-actions"><label for="ps-print-format">Saiz halaman<select id="ps-print-format" data-ps-format><option value="slides">Slaid 16:9</option><option value="a4">A4 landskap</option></select></label><button type="button" data-ps-print disabled>Cetak / Simpan PDF</button><button type="button" data-ps-close aria-label="Tutup pratonton cetakan">Tutup</button></div></div><p class="presentation-print-status" data-ps-status role="status"></p><iframe class="presentation-print-frame" title="Pratonton slaid cetakan" sandbox="allow-same-origin allow-modals"></iframe><p class="presentation-print-help">Pilih “Save as PDF” / “Simpan sebagai PDF” dalam tetingkap cetakan. Gunakan skala 100% dan matikan header/footer pelayar.</p>`;
    document.body.appendChild(dialog);
    previousOverflow=document.documentElement.style.overflow;
    document.documentElement.style.overflow='hidden';
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.querySelector('[data-ps-close]').addEventListener('click',close);
    dialog.querySelector('[data-ps-format]').addEventListener('change',loadPreview);
    dialog.querySelector('[data-ps-print]').addEventListener('click',()=>{
      const frame=dialog?.querySelector('iframe');
      if(frame?.contentWindow){frame.contentWindow.focus();frame.contentWindow.print();}
    });
    dialog.showModal();
    loadPreview();
  }

  function install() {
    if($('dashboard-kpi-grid')&&!$('dashboard-presentation-print-actions')) {
      const bar=node('div','presentation-print-actions-row');bar.id='dashboard-presentation-print-actions';
      $('dashboard-kpi-grid').before(bar);
    }
    const targets=[
      {kind:'headcount',id:'headcount-presentation-print-btn',group:document.querySelector('#view-headcount .hc-page-header > div:last-child')},
      {kind:'pbd',id:'pbd-presentation-print-btn',group:document.querySelector('#view-analytics-pbd .analysis-export-btn--pbd')?.parentElement},
      {kind:'dashboard',id:'dashboard-presentation-print-btn',group:$('dashboard-presentation-print-actions')},
      {kind:'marks',id:'marks-presentation-print-btn',group:document.querySelector('#view-analytics-marks .analysis-export-btn--marks')?.parentElement}
    ];
    targets.forEach(({kind,id,group})=>{
      if(!group||$(id))return;
      const button=node('button','presentation-print-trigger hc-outline-btn','Cetak Slaid / PDF');
      button.id=id;button.type='button';button.addEventListener('click',()=>open(kind));group.appendChild(button);
    });
  }

  window.iSejarahPresentationPrint={open,close,install};
  window.addEventListener('resize',setPreviewScale);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
