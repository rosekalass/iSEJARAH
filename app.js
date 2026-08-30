
    // Initialize Lucide Icons
    lucide.createIcons();

    // Chart.js Variables
    let chartGradesInstance = null;
    let chartTpInstance = null;
    let dashboardGpmpChartInstance = null;
    let analyticsGradeChartInstance = null;
    let analyticsBandChartInstance = null;
    let analyticsCompareChartInstance = null;
    let marksAssessmentTypeFilter = 'DIAGNOSTIK';
    let analyticsCurrentRows = [];
    let pbdAnalyticsTpChartInstance = null;
    let pbdAnalyticsSpChartInstance = null;
    let pbdAnalyticsCurrent = null;
    let studentProfileMarksChartInstance = null;
    let studentProfilePbdChartInstance = null;
    let classCompareMarksChartInstance = null;
    let classComparePbdChartInstance = null;
    let studentProfileCurrent = null;

    // --- GLOBAL SETTINGS & CALCULATION ENGINE ---
    const appSettings = {
        // Skala KPM: Panduan Pengurusan PBS Edisi 1 Tahun 2025.
        masteryThreshold: 39,
        pbdMasteryTp: 3,
        gradeBoundaries: [
            { grade: 'A', min: 82, max: 100, label: 'Cemerlang', point: 1 },
            { grade: 'B', min: 66, max: 81, label: 'Kepujian', point: 2 },
            { grade: 'C', min: 50, max: 65, label: 'Baik', point: 3 },
            { grade: 'D', min: 35, max: 49, label: 'Memuaskan', point: 4 },
            { grade: 'E', min: 20, max: 34, label: 'Mencapai Tahap Minimum', point: 5 },
            { grade: 'F', min: 0, max: 19, label: 'Belum Mencapai Tahap Minimum', point: 6 }
        ]
    };

    function masteryMinimumMark(){
        return Math.min(100,Math.max(0,Number(appSettings.masteryThreshold||39)+1));
    }

    function isSupportMark(value){
        return value!==null &&
               value!==undefined &&
               Number.isFinite(Number(value)) &&
               Number(value)<=Number(appSettings.masteryThreshold);
    }

    function isMasteredMark(value){
        return value!==null &&
               value!==undefined &&
               Number.isFinite(Number(value)) &&
               Number(value)>Number(appSettings.masteryThreshold);
    }

    const assessmentTypes = [
        { id: 'DIAGNOSTIK', name: 'Ujian Diagnostik' },
        { id: 'UPSA', name: 'Ujian Pertengahan Sesi Akademik (UPSA)' },
        { id: 'UASA', name: 'Ujian Akhir Sesi Akademik (UASA)' }
    ];

    // Engine Functions
    function calculatePercentage(raw, max) {
        if (raw === null || raw === '' || isNaN(raw) || max <= 0) return null;
        return Math.max(0, Math.min(100, Math.round((Number(raw) / Number(max)) * 100)));
    }

    function formatWholePercent(value, fallback='—') {
        if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return fallback;
        return `${Math.round(Number(value))}%`;
    }

    function formatSignedWholePercent(value, fallback='—') {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
        const n=Math.round(Number(value));
        return `${n>0?'+':''}${n}%`;
    }

    function formatPercent1(value, fallback='—') {
        if(value===null || value===undefined || value==='' || Number.isNaN(Number(value)))return fallback;
        const n=Math.round(Number(value)*10)/10;
        return `${n.toFixed(1)}%`;
    }

    function formatAverageMark(value, fallback='—') {
        if(value===null || value===undefined || value==='' || Number.isNaN(Number(value)))return fallback;
        return `${Math.round(Number(value))}%`;
    }

    function getActualScoreRecords() {
        // Single source of truth for Markah Ujian, Analisis Markah and Headcount.
        // Only records produced by real user entry/imported Supabase data live here.
        return Array.isArray(appState?.scores) ? appState.scores : [];
    }

    function calculateGrade(percentage) {
        if (percentage === null) return '-';
        const bound = appSettings.gradeBoundaries.find(b => percentage >= b.min && percentage <= b.max);
        return bound ? bound.grade : '-';
    }

    function gradePointForGrade(grade) {
        const bound = appSettings.gradeBoundaries.find(b => b.grade === grade);
        return bound && Number.isFinite(Number(bound.point)) ? Number(bound.point) : null;
    }

    function calculateGPMPFromScores(scores) {
        const valid = scores.filter(s => s && !s.absent && s.percentage !== null && s.percentage !== undefined);
        const points = valid.map(s => {
            const grade = s.grade && s.grade !== '-' ? s.grade : calculateGrade(Number(s.percentage));
            return gradePointForGrade(grade);
        }).filter(v => v !== null);
        if (!points.length) return null;
        return Number((points.reduce((a,b)=>a+b,0) / points.length).toFixed(2));
    }

    // --- PHASE 2 & 3: DATA STATE & MODELS (Supabase/Local data state) ---
    // Collections used by the live application
    let mockTeachers = [
        { id: 'admin1', name: 'Admin PK Pentadbiran', email: 'admin@moe.edu.my', staffId: 'ADM001', role: 'ADMIN', active: true, updatedAt: '2026-08-19' },
        { id: 't1', name: 'Puan Noraini', email: 'kp.sejarah@moe.edu.my', staffId: 'KP001', role: 'ADMIN', active: true, updatedAt: '2026-08-19' },
        { id: 't2', name: 'Cikgu Ahmad Faris', email: 'ahmad.faris@moe.edu.my', staffId: 'GS001', role: 'GURU_SEJARAH', active: true, updatedAt: '2026-08-19' },
        { id: 't3', name: 'Ustazah Siti Sarah', email: 'siti.sarah@moe.edu.my', staffId: 'GS002', role: 'GURU_SEJARAH', active: true, updatedAt: '2026-08-19' }
    ];

    let appState = {
        classes: [
            { id: 'c1', name: '4 Ibnu Sina', year: 4, teacherId: 't2', active: true, academicYear: '2026' },
            { id: 'c2', name: '4 Al-Farabi', year: 4, teacherId: 't2', active: true, academicYear: '2026' },
            { id: 'c3', name: '5 Al-Biruni', year: 5, teacherId: 't3', active: true, academicYear: '2026' },
            { id: 'c4', name: '5 Ibnu Rushd', year: 5, teacherId: 't3', active: true, academicYear: '2026' },
            { id: 'c5', name: '6 Ibnu Khaldun', year: 6, teacherId: 't1', active: true, academicYear: '2026' },
            { id: 'c6', name: '6 Al-Zahrawi', year: 6, teacherId: 't1', active: true, academicYear: '2026' }
        ],
        students: [
            { id: 's1', name: 'Muhammad Ali Bin Abu', year: 4, classId: 'c1', gender: 'L', status: 'Aktif', identifier: '120101011234', academicYear: '2026' },
            { id: 's2', name: 'Siti Aminah Binti Omar', year: 4, classId: 'c1', gender: 'P', status: 'Aktif', identifier: '120202021234', academicYear: '2026' },
            { id: 's3', name: 'Wong Wei Jie', year: 4, classId: 'c2', gender: 'L', status: 'Aktif', identifier: '', academicYear: '2026' },
            { id: 's4', name: 'Nurul Huda Binti Hassan', year: 5, classId: 'c3', gender: 'P', status: 'Aktif', identifier: '', academicYear: '2026' },
            { id: 's5', name: 'Ahmad Faiz Bin Othman', year: 5, classId: 'c4', gender: 'L', status: 'Aktif', identifier: '', academicYear: '2026' },
            { id: 's6', name: 'Kavitha A/P Subramaniam', year: 6, classId: 'c5', gender: 'P', status: 'Aktif', identifier: '', academicYear: '2026' },
            { id: 's7', name: 'Megat Zaqwan', year: 6, classId: 'c6', gender: 'L', status: 'Aktif', identifier: '', academicYear: '2026' }
        ],
        assessments: [],
        scores: [],
        dskp: [
            {
                id: 'd4_1', subject: 'SEJARAH', yearLevel: 4,
                themeName: 'Tema Demo Tahun 4', unitName: 'Unit Demo 1',
                standardContentCode: 'DEMO-SK4.1', standardContentText: 'Contoh Standard Kandungan Tahun 4 — gantikan dengan teks DSKP rasmi.',
                standardLearningCode: 'DEMO-SP4.1.1', standardLearningText: 'Contoh Standard Pembelajaran Tahun 4 untuk menguji aliran perekodan PBD.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            },
            {
                id: 'd4_2', subject: 'SEJARAH', yearLevel: 4,
                themeName: 'Tema Demo Tahun 4', unitName: 'Unit Demo 1',
                standardContentCode: 'DEMO-SK4.1', standardContentText: 'Contoh Standard Kandungan Tahun 4 — gantikan dengan teks DSKP rasmi.',
                standardLearningCode: 'DEMO-SP4.1.2', standardLearningText: 'Contoh Standard Pembelajaran kedua Tahun 4.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            },
            {
                id: 'd5_1', subject: 'SEJARAH', yearLevel: 5,
                themeName: 'Tema Demo Tahun 5', unitName: 'Unit Demo 1',
                standardContentCode: 'DEMO-SK5.1', standardContentText: 'Contoh Standard Kandungan Tahun 5 — gantikan dengan teks DSKP rasmi.',
                standardLearningCode: 'DEMO-SP5.1.1', standardLearningText: 'Contoh Standard Pembelajaran Tahun 5 untuk menguji aliran perekodan PBD.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            },
            {
                id: 'd5_2', subject: 'SEJARAH', yearLevel: 5,
                themeName: 'Tema Demo Tahun 5', unitName: 'Unit Demo 2',
                standardContentCode: 'DEMO-SK5.2', standardContentText: 'Contoh Standard Kandungan kedua Tahun 5.',
                standardLearningCode: 'DEMO-SP5.2.1', standardLearningText: 'Contoh Standard Pembelajaran kedua Tahun 5.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            },
            {
                id: 'd6_1', subject: 'SEJARAH', yearLevel: 6,
                themeName: 'Tema Demo Tahun 6', unitName: 'Unit Demo 1',
                standardContentCode: 'DEMO-SK6.1', standardContentText: 'Contoh Standard Kandungan Tahun 6 — gantikan dengan teks DSKP rasmi.',
                standardLearningCode: 'DEMO-SP6.1.1', standardLearningText: 'Contoh Standard Pembelajaran Tahun 6 untuk menguji aliran perekodan PBD.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            },
            {
                id: 'd6_2', subject: 'SEJARAH', yearLevel: 6,
                themeName: 'Tema Demo Tahun 6', unitName: 'Unit Demo 2',
                standardContentCode: 'DEMO-SK6.2', standardContentText: 'Contoh Standard Kandungan kedua Tahun 6.',
                standardLearningCode: 'DEMO-SP6.2.1', standardLearningText: 'Contoh Standard Pembelajaran kedua Tahun 6.',
                performanceStandards: {1:'',2:'',3:'',4:'',5:'',6:''}, active: true
            }
        ],
        pbdRecords: [],
        pbdOverall: [],
        pbdGroupLevels: [],
        pbdLocks: [],
        pbdPeriods: [
            { id: 'PERTENGAHAN', name: 'Pertengahan Tahun', active: true },
            { id: 'AKHIR', name: 'Akhir Tahun', active: true }
        ],
        interventions: [],
        auditLogs: []
    };


    // --- MARKS PERSISTENCE — ACTUAL ENTRY DATA / FIRESTORE ---
    const MARKS_STORAGE_KEY = 'sejarah_marks_actual_v3';

    function restoreMarksState() {
        try {
            const saved = localStorage.getItem(MARKS_STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.assessments)) appState.assessments = parsed.assessments;
            if (Array.isArray(parsed.scores)) appState.scores = parsed.scores;
        } catch (err) {
            console.warn('Gagal memulihkan data markah:', err);
        }
    }

    function persistMarksState() {
        try {
            localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify({
                assessments: appState.assessments,
                scores: appState.scores
            }));
        } catch (err) {
            console.warn('Gagal menyimpan data markah:', err);
        }
    }

    restoreMarksState();

    function purgeLegacyMockMarks() {
        const legacyMockScoreIds=new Set(['sc1','sc2','sc3']);
        const legacyMockAssessmentIds=new Set(['a1','a2']);

        const beforeScores=appState.scores.length;
        appState.scores=appState.scores.filter(s=>{
            if(!legacyMockScoreIds.has(s.id))return true;
            // Exact old built-in demo records only.
            if(s.id==='sc1')return !(s.studentId==='s1'&&s.assessmentId==='a1'&&Number(s.rawScore)===42);
            if(s.id==='sc2')return !(s.studentId==='s2'&&s.assessmentId==='a1'&&s.absent===true);
            if(s.id==='sc3')return !(s.studentId==='s6'&&s.assessmentId==='a2'&&Number(s.rawScore)===18);
            return true;
        });

        const referencedAssessmentIds=new Set(appState.scores.map(s=>s.assessmentId));
        appState.assessments=appState.assessments.filter(a=>{
            if(!legacyMockAssessmentIds.has(a.id))return true;
            if(referencedAssessmentIds.has(a.id))return true;
            return !(
                (a.id==='a1'&&a.name==='UPSA Sejarah 2026') ||
                (a.id==='a2'&&a.name==='Ujian Diagnostik Sejarah 2026')
            );
        });

        if(beforeScores!==appState.scores.length)persistMarksState();

        // Retire the old demo storage key so it cannot re-enter the live app.
        try{localStorage.removeItem('sejarah_marks_assessments_demo_v2');}catch(_){}
    }

    purgeLegacyMockMarks();

    function normalizeAssessmentCatalog() {
        let changed = false;
        appState.assessments.forEach(a => {
            if (!['UPSA','UASA','DIAGNOSTIK'].includes(a.type)) {
                a.type = 'DIAGNOSTIK';
                changed = true;
            }
        });
        if (changed) persistMarksState();
    }
    normalizeAssessmentCatalog();

    const FIXED_ASSESSMENT_META = {
        DIAGNOSTIK:{name:'Ujian Diagnostik Sejarah',short:'Diagnostik'},
        UPSA:{name:'Ujian Pertengahan Sesi Akademik (UPSA) Sejarah',short:'UPSA'},
        UASA:{name:'Ujian Akhir Sesi Akademik (UASA) Sejarah',short:'UASA'}
    };

    const FIXED_ASSESSMENT_ORDER = {DIAGNOSTIK:1,UPSA:2,UASA:3};

    function normalizeAssessmentExamDate(value) {
        const raw=String(value||'').trim().slice(0,10);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return '';
        const parsed=new Date(`${raw}T00:00:00`);
        if(Number.isNaN(parsed.getTime()))return '';
        const [year,month,day]=raw.split('-').map(Number);
        if(parsed.getFullYear()!==year||parsed.getMonth()+1!==month||parsed.getDate()!==day)return '';
        return raw;
    }

    function assessmentExamDateValue(assessment) {
        return normalizeAssessmentExamDate(assessment?.date);
    }

    function compareAssessmentsByExamDate(a,b) {
        const dateComparison=assessmentExamDateValue(a).localeCompare(assessmentExamDateValue(b));
        if(dateComparison)return dateComparison;
        const typeComparison=(FIXED_ASSESSMENT_ORDER[String(a?.type||'').toUpperCase()]||0)-
            (FIXED_ASSESSMENT_ORDER[String(b?.type||'').toUpperCase()]||0);
        if(typeComparison)return typeComparison;
        return String(a?.id||'').localeCompare(String(b?.id||''));
    }

    function formatAssessmentExamDate(value, fallback='Belum ditetapkan') {
        const normalized=normalizeAssessmentExamDate(value);
        if(!normalized)return fallback;
        return new Date(`${normalized}T00:00:00`).toLocaleDateString('ms-MY',{
            day:'2-digit',month:'short',year:'numeric'
        });
    }

    function ensureAutoAssessmentTemplates(syncRemote=true, academicYear=null) {
        const session=String(academicYear || document.getElementById('filter-academic-year')?.value || '2026');
        let changed=false;
        const touched=[];

        appState.classes
            .filter(c=>c.active!==false && String(c.academicYear||session)===session)
            .forEach(cls=>{
                ['DIAGNOSTIK','UPSA','UASA'].forEach(type=>{
                    const matches=appState.assessments
                        .filter(a=>a.classId===cls.id && a.type===type && String(a.academicYear||session)===session)
                        .sort((a,b)=>compareAssessmentsByExamDate(b,a));

                    let assessment=matches[0];
                    const meta=FIXED_ASSESSMENT_META[type];

                    if(!assessment){
                        assessment={
                            id:`assess_${session}_${cls.id}_${type}`.replace(/[^A-Za-z0-9_-]/g,'_'),
                            name:meta.name,
                            type,
                            academicYear:session,
                            year:Number(cls.year),
                            classId:cls.id,
                            date:'',
                            maxScore:100,
                            status:'OPEN',
                            createdBy:'SYSTEM',
                            autoTemplate:true,
                            updatedAt:new Date().toISOString()
                        };
                        appState.assessments.push(assessment);
                        touched.push(assessment);
                        changed=true;
                    }else{
                        const patch={
                            name:meta.name,
                            academicYear:session,
                            year:Number(cls.year),
                            maxScore:100,
                            status:'OPEN',
                            autoTemplate:true
                        };
                        let localChanged=false;
                        Object.entries(patch).forEach(([k,v])=>{
                            if(assessment[k]!==v){assessment[k]=v;localChanged=true;}
                        });
                        if(!Number.isFinite(Number(assessment.maxScore)) || Number(assessment.maxScore)<=0){
                            assessment.maxScore=100;
                            localChanged=true;
                        }
                        if(localChanged){
                            assessment.updatedAt=new Date().toISOString();
                            touched.push(assessment);
                            changed=true;
                        }
                    }
                });
            });

        appState.scores.forEach(sc=>{
            if(sc.absent){
                if(sc.percentage!==null || sc.grade!=='-'){sc.percentage=null;sc.grade='-';changed=true;}
                return;
            }
            const assessment=appState.assessments.find(a=>a.id===sc.assessmentId);
            if(!assessment)return;
            const pct=(sc.rawScore!==null && sc.rawScore!==undefined && sc.rawScore!=='')
                ? calculatePercentage(sc.rawScore,assessment.maxScore)
                : (sc.percentage===null || sc.percentage===undefined ? null : Math.round(Number(sc.percentage)));
            if(pct===null || Number.isNaN(Number(pct)))return;
            const grade=calculateGrade(pct);
            if(sc.percentage!==pct || sc.grade!==grade){
                sc.percentage=pct;sc.grade=grade;changed=true;
                if(syncRemote && typeof phase10Upsert==='function')phase10Upsert('scores',sc.id,sc);
            }
        });

        if(changed)persistMarksState();
        const maySyncAssessmentTemplates=typeof isTeacherSession!=='function'||!isTeacherSession();
        if(syncRemote && maySyncAssessmentTemplates && typeof phase10Upsert==='function'){
            touched.forEach(a=>phase10Upsert('assessments',a.id,a,{subject:'SEJARAH'}));
        }
        return touched;
    }

    function openAssessmentTypes(kind='marks') {
        return ['DIAGNOSTIK','UPSA','UASA'].filter(type=>isAssessmentEntryOpen(kind,type));
    }

    function syncTeacherAssessmentAvailability(kind='marks') {
        if(!isTeacherSession())return;
        const open=openAssessmentTypes(kind);
        if(kind==='marks'){
            if(!open.includes(marksAssessmentTypeFilter))marksAssessmentTypeFilter=open[0]||'';
            updateMarksTypeButtonUI();
        }
    }

    const PHASE4_STORAGE_KEY = 'sejarah_pbd_phase4_demo_v1';
    let selectedPbdStudents = new Set();
    let pbdQuickFilter = 'ALL';
    let pendingDskpImport = [];
    let pbdSaveTimeouts = {};

    function restorePhase4State() {
        try {
            const saved = localStorage.getItem(PHASE4_STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.dskp) && parsed.dskp.length) appState.dskp = parsed.dskp;
            if (Array.isArray(parsed.pbdRecords)) appState.pbdRecords = parsed.pbdRecords;
            if (Array.isArray(parsed.pbdOverall)) appState.pbdOverall = parsed.pbdOverall;
            if (Array.isArray(parsed.pbdGroupLevels)) appState.pbdGroupLevels = parsed.pbdGroupLevels;
            if (Array.isArray(parsed.pbdLocks)) appState.pbdLocks = parsed.pbdLocks;
        } catch (err) {
            console.warn('Gagal memulihkan data semasa Fasa 4:', err);
        }
    }

    function persistPhase4State() {
        try {
            localStorage.setItem(PHASE4_STORAGE_KEY, JSON.stringify({
                dskp: appState.dskp,
                pbdRecords: appState.pbdRecords,
                pbdOverall: appState.pbdOverall,
                pbdGroupLevels: appState.pbdGroupLevels || [],
                pbdLocks: appState.pbdLocks
            }));
        } catch (err) {
            console.warn('Gagal menyimpan data semasa Fasa 4:', err);
        }
    }

    restorePhase4State();

    // ==============================================================
    // PBD MATRIX TEMPLATE — based on the supplied Year 4/5/6 sheets
    // ==============================================================
    const PBD_MATRIX_TEMPLATES = {
        4: {
            label: 'Tahun 4',
            groups: [
                { key:'Y4_G1', name:'MARI BELAJAR SEJARAH', color:'#86EFAC', topics:[
                    'PENGERTIAN SEJARAH','DIRI DAN KELUARGA','SEJARAH SEKOLAH','KAWASAN TEMPAT TINGGAL'
                ]},
                { key:'Y4_G2', name:'ZAMAN AIR BATU', color:'#BEF264', topics:['ZAMAN AIR BATU']},
                { key:'Y4_G3', name:'ZAMAN PRASEJARAH', color:'#FDE047', topics:['KEHIDUPAN MANUSIA PRASEJARAH']},
                { key:'Y4_G4', name:'KERAJAAN MELAYU AWAL', color:'#7DD3FC', topics:['KEDUDUKAN KERAJAAN-KERAJAAN MELAYU AWAL']},
                { key:'Y4_G5', name:'TOKOH-TOKOH TERBILANG KESULTANAN MELAYU MELAKA', color:'#F9A8D4', topics:[
                    'TOKOH-TOKOH TERBILANG KESULTANAN MELAYU MELAKA',
                    'PARAMESWARA SEBAGAI PENGASAS KESULTANAN MELAYU MELAKA',
                    'TUN PERAK SEBAGAI BENDAHARA MELAKA',
                    'HANG TUAH SEBAGAI LAKSAMANA MELAKA'
                ]}
            ]
        },
        5: {
            label: 'Tahun 5',
            groups: [
                { key:'Y5_G1', name:'WARISAN NEGARA KITA', color:'#86EFAC', topics:[
                    'INSTITUSI RAJA','AGAMA ISLAM','BAHASA MELAYU'
                ]},
                { key:'Y5_G2', name:'PERJUANGAN KEMERDEKAAN NEGARA', color:'#BEF264', topics:[
                    'PENJAJAHAN DAN CAMPUR TANGAN KUASA LUAR',
                    'PERJUANGAN TOKOH TEMPATAN',
                    'SEJARAH KEMERDEKAAN 1957'
                ]},
                { key:'Y5_G3', name:'YANG DI-PERTUAN AGONG', color:'#7DD3FC', topics:[
                    'YANG DI-PERTUAN AGONG KETUA NEGARA'
                ]},
                { key:'Y5_G4', name:'IDENTITI NEGARA KITA', color:'#F9A8D4', topics:[
                    'JATA NEGARA','BENDERA KEBANGSAAN','LAGU KEBANGSAAN','BAHASA KEBANGSAAN','BUNGA KEBANGSAAN'
                ]}
            ]
        },
        6: {
            label: 'Tahun 6',
            groups: [
                { key:'Y6_G1', name:'KEMAKMURAN NEGARA KITA', color:'#86EFAC', topics:[
                    'PEMBENTUKAN MALAYSIA','NEGERI-NEGERI DI MALAYSIA','RUKUN NEGARA'
                ]},
                { key:'Y6_G2', name:'KITA RAKYAT MALAYSIA', color:'#BEF264', topics:[
                    'KAUM DAN ETNIK DI MALAYSIA','AGAMA DAN KEPERCAYAAN','PERAYAAN MASYARAKAT MALAYSIA'
                ]},
                { key:'Y6_G3', name:'PENCAPAIAN DAN KEBANGGAAN NEGARA', color:'#F9A8D4', topics:[
                    'SUKAN KEBANGGAAN NEGARA','KEMAJUAN EKONOMI','PEMIMPIN NEGARA','MALAYSIA DAN DUNIA'
                ]}
            ]
        }
    };

    function buildPbdTemplateDskp() {
        const result = [];
        Object.entries(PBD_MATRIX_TEMPLATES).forEach(([yearKey, template]) => {
            let running = 1;
            template.groups.forEach((group, groupIndex) => {
                group.topics.forEach((topic, topicIndex) => {
                    const id = `tpl_y${yearKey}_g${groupIndex+1}_t${topicIndex+1}`;
                    result.push({
                        id,
                        subject:'SEJARAH',
                        yearLevel:Number(yearKey),
                        themeName:group.name,
                        unitName:topic,
                        // System reference only; the supplied template did not show official SK codes.
                        standardContentCode:`SK${running}`,
                        standardContentText:topic,
                        standardLearningCode:`SK${running}`,
                        standardLearningText:topic,
                        performanceStandards:{1:'',2:'',3:'',4:'',5:'',6:''},
                        active:true,
                        matrixTemplate:true,
                        matrixGroupKey:group.key,
                        matrixGroupName:group.name,
                        matrixTopicIndex:topicIndex,
                        matrixStandardIndex:running
                    });
                    running++;
                });
            });
        });
        return result;
    }

    function ensurePbdMatrixTemplateDskp() {
        const templateDskp = buildPbdTemplateDskp();
        // The new matrix is the source of truth for PBD entry and analytics.
        appState.dskp = templateDskp;
        if (!Array.isArray(appState.pbdGroupLevels)) appState.pbdGroupLevels = [];
        persistPhase4State();
    }

    ensurePbdMatrixTemplateDskp();

    // --- USER MANAGEMENT PERSISTENCE (LIVE DATA MODE / FIRESTORE-READY) ---
    const USERS_STORAGE_KEY = 'sejarah_users_demo_v2';

    function normalizeDemoUsers() {
        mockTeachers = mockTeachers.map((u, index) => ({
            id: u.id || `usr_${Date.now()}_${index}`,
            name: u.name || 'Pengguna',
            email: u.email || '',
            staffId: u.staffId || '',
            role: (u.role === 'KETUA_PANITIA' ? 'ADMIN' : (u.role || 'GURU_SEJARAH')),
            active: u.active !== false,
            updatedAt: u.updatedAt || new Date().toISOString().split('T')[0]
        }));
    }

    function restoreUsersState() {
        try {
            const saved = localStorage.getItem(USERS_STORAGE_KEY);
            if (!saved) { normalizeDemoUsers(); return; }
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.users) && parsed.users.length) mockTeachers = parsed.users;
            if (parsed.classAssignments && typeof parsed.classAssignments === 'object') {
                appState.classes.forEach(c => {
                    if (Object.prototype.hasOwnProperty.call(parsed.classAssignments, c.id)) c.teacherId = parsed.classAssignments[c.id] || '';
                });
            }
            normalizeDemoUsers();
        } catch (err) {
            console.warn('Gagal memulihkan pengguna demo:', err);
            normalizeDemoUsers();
        }
    }

    function persistUsersState() {
        try {
            const classAssignments = {};
            appState.classes.forEach(c => classAssignments[c.id] = c.teacherId || '');
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify({ users: mockTeachers, classAssignments }));
        } catch (err) {
            console.warn('Gagal menyimpan pengguna demo:', err);
        }
    }

    restoreUsersState();

    // --- PHASE 8: INTERVENTION PERSISTENCE (LIVE DATA MODE / FIRESTORE-READY) ---
    const PHASE8_STORAGE_KEY = 'sejarah_pbd_phase8_interventions_v1';
    let interventionCandidateFilter = 'ALL';

    function restorePhase8State() {
        try {
            const saved = localStorage.getItem(PHASE8_STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.interventions)) appState.interventions = parsed.interventions;
            if (Array.isArray(parsed.auditLogs)) {
                const phase8Ids = new Set((parsed.auditLogs || []).map(x => x.id));
                appState.auditLogs = [...appState.auditLogs.filter(x => !phase8Ids.has(x.id)), ...parsed.auditLogs];
            }
        } catch (err) {
            console.warn('Gagal memulihkan data semasa Fasa 8:', err);
        }
    }

    function persistPhase8State() {
        try {
            localStorage.setItem(PHASE8_STORAGE_KEY, JSON.stringify({
                interventions: appState.interventions,
                auditLogs: appState.auditLogs.filter(x => String(x.module || '').toUpperCase() === 'INTERVENTION')
            }));
            if(typeof phase10Mode!=='undefined'&&phase10Mode==='SUPABASE'&&typeof phase10Upsert==='function'){
                (appState.interventions||[]).forEach(r=>{
                    if(r?.id)phase10Upsert('interventions',r.id,r);
                });
            }
        } catch (err) {
            console.warn('Gagal menyimpan data semasa Fasa 8:', err);
        }
    }

    restorePhase8State();

    let currentUserRole = 'ADMIN';
    let currentRole = 'ADMIN';
    let currentUserId = 't1';
    let selectedStudents = new Set();
    let pendingImportData = [];
    
    // Auto-save debounce timer
    let saveTimeout = {};

    // v56 — Supabase mark-save reliability.
    // Keep just-entered marks protected while their network write is pending.
    let phase10ScoreWriteSeq = 0;
    const phase10PendingScoreWrites = new Map();
    let phase10RemoteLoadSeq = 0;

    function phase10MergePendingScores(remoteScores=[]) {
        const merged=new Map(
            (Array.isArray(remoteScores)?remoteScores:[])
                .filter(Boolean)
                .map(score=>[String(score.id),score])
        );

        phase10PendingScoreWrites.forEach(entry=>{
            const record=entry?.record;
            if(record?.id)merged.set(String(record.id),{...record});
        });

        return [...merged.values()];
    }

    async function phase10SaveScoreRecordRemote(scoreRec){
        if(!scoreRec?.id)return false;

        const version=++phase10ScoreWriteSeq;
        const snapshot=JSON.parse(JSON.stringify(scoreRec));
        phase10PendingScoreWrites.set(String(scoreRec.id),{version,record:snapshot});

        const ok=await phase10Upsert('scores',scoreRec.id,snapshot);
        const current=phase10PendingScoreWrites.get(String(scoreRec.id));

        if(ok&&current?.version===version){
            phase10PendingScoreWrites.delete(String(scoreRec.id));
        }
        return ok;
    }

    // Explicit data edit modes. Empty templates open directly for entry;
    // existing data opens in view mode until "Edit" is pressed.
    let marksManualEditMode = true;
    let marksEditContextKey = '';
    let pbdManualEditMode = true;
    let pbdEditContextKey = '';

    // Utility: Custom Alert/Confirm
    function showAlert(title, message, type = 'info', confirmCallback = null) {
        const modal = document.getElementById('custom-alert');
        const icon = document.getElementById('alert-icon');
        const btnCancel = document.getElementById('alert-btn-cancel');
        const btnConfirm = document.getElementById('alert-btn-confirm');
        
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-message').textContent = message;
        
        icon.className = 'w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3';
        if (type === 'danger') {
            icon.classList.add('bg-rose-100', 'text-rose-600');
            icon.innerHTML = '<i data-lucide="alert-triangle" class="w-6 h-6"></i>';
            btnConfirm.className = "px-5 py-2 text-white bg-rose-600 rounded-lg text-sm font-bold hover:bg-rose-700 shadow-md";
        } else if (type === 'success') {
            icon.classList.add('bg-emerald-100', 'text-emerald-600');
            icon.innerHTML = '<i data-lucide="check-circle" class="w-6 h-6"></i>';
            btnConfirm.className = "px-5 py-2 text-white bg-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-md";
        } else {
            icon.classList.add('bg-blue-100', 'text-blue-600');
            icon.innerHTML = '<i data-lucide="info" class="w-6 h-6"></i>';
            btnConfirm.className = "px-5 py-2 text-white bg-blue-600 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md";
        }
        
        if (confirmCallback) {
            btnCancel.classList.remove('hidden');
            btnCancel.onclick = () => { modal.classList.add('hidden'); };
            btnConfirm.onclick = () => {
                confirmCallback();
                modal.classList.add('hidden');
            };
        } else {
            btnCancel.classList.add('hidden');
            btnConfirm.onclick = () => { modal.classList.add('hidden'); };
        }
        
        lucide.createIcons();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // --- PHASE 2: STUDENTS MODULE ---
    // --- MATTARY CANONICAL CLASS CATALOG ---
    const MATTARY_CLASS_CATALOG = [
        {code:'4K',year:4,name:'4 AL-KHAWARIMI',group:'K'},
        {code:'4B',year:4,name:'4 AL-BIRUNI',group:'B'},
        {code:'4F',year:4,name:'4 AL-FARABI',group:'F'},
        {code:'5K',year:5,name:'5 AL-KHAWARIMI',group:'K'},
        {code:'5B',year:5,name:'5 AL-BIRUNI',group:'B'},
        {code:'5F',year:5,name:'5 AL-FARABI',group:'F'},
        {code:'6K',year:6,name:'6 AL-KHAWARIMI',group:'K'},
        {code:'6B',year:6,name:'6 AL-BIRUNI',group:'B'},
        {code:'6F',year:6,name:'6 AL-FARABI',group:'F'}
    ];
    const MATTARY_CLASS_ORDER = new Map(MATTARY_CLASS_CATALOG.map((x,i)=>[x.code,i]));

    function normalizeClassLookupText(value){
        return String(value??'')
            .toUpperCase()
            .normalize('NFKD')
            .replace(/[’']/g,'')
            .replace(/[^A-Z0-9]+/g,' ')
            .trim()
            .replace(/\s+/g,' ');
    }

    function canonicalClassCode(value,yearHint=null){
        if(value && typeof value==='object'){
            if(value.classCode && MATTARY_CLASS_ORDER.has(String(value.classCode).toUpperCase())) return String(value.classCode).toUpperCase();
            yearHint=value.year??yearHint;
            value=value.name??value.code??'';
        }
        const raw=normalizeClassLookupText(value);
        const compact=raw.replace(/\s+/g,'');
        const direct=compact.match(/^([456])([KBF])$/);
        if(direct)return direct[1]+direct[2];

        const ym=raw.match(/(?:TAHUN\s*)?([456])/);
        const year=String(yearHint||ym?.[1]||'');
        if(!['4','5','6'].includes(year))return '';

        // Accept both spelling in uploaded template and the requested class spelling.
        if(/KHAWARIZMI|KHAWARIMI|KHAWARIZMY|KHAWARMI/.test(compact))return year+'K';
        if(/BIRUNI/.test(compact))return year+'B';
        if(/FARABI/.test(compact))return year+'F';
        return '';
    }

    function canonicalClassSpec(value,yearHint=null){
        const code=canonicalClassCode(value,yearHint);
        return MATTARY_CLASS_CATALOG.find(x=>x.code===code)||null;
    }

    function isCanonicalMattaryClass(cls){
        return Boolean(canonicalClassCode(cls));
    }

    function classSortIndex(cls){
        const code=canonicalClassCode(cls);
        return MATTARY_CLASS_ORDER.has(code)?MATTARY_CLASS_ORDER.get(code):999;
    }

    function sortClassesCanonical(classes){
        return [...(classes||[])].sort((a,b)=>
            classSortIndex(a)-classSortIndex(b) ||
            Number(a.year||0)-Number(b.year||0) ||
            String(a.name||'').localeCompare(String(b.name||''),'ms',{sensitivity:'base'})
        );
    }

    function chartClassShortLabel(value){
        let cls=value;
        if(typeof value==='string'){
            cls=appState.classes.find(c=>c.id===value) || value;
        }
        const code=canonicalClassCode(cls);
        if(code)return code; // 4K, 4B, 4F ... 6K, 6B, 6F

        const raw=typeof cls==='object' ? String(cls?.name||'') : String(cls||'');
        return raw || '—';
    }

    function canonicalActiveClasses(academicYear=null){
        const ay=String(academicYear||document.getElementById('filter-academic-year')?.value||getActiveAcademicYear?.()||'2026');
        return sortClassesCanonical(
            appState.classes.filter(c=>
                c.active!==false &&
                isCanonicalMattaryClass(c) &&
                String(c.academicYear||ay)===ay
            )
        );
    }

    function ensureMattaryClassCatalog(syncRemote=false){
        if(!appState?.classes)return [];
        const ay=String(document.getElementById('filter-academic-year')?.value||getActiveAcademicYear?.()||'2026');
        const touched=[];

        MATTARY_CLASS_CATALOG.forEach(spec=>{
            let cls=appState.classes.find(c=>
                canonicalClassCode(c)===spec.code &&
                String(c.academicYear||ay)===ay
            );

            if(!cls){
                cls={
                    id:`cls_${spec.code}_${ay}`,
                    classCode:spec.code,
                    name:spec.name,
                    year:spec.year,
                    teacherId:'',
                    active:true,
                    academicYear:ay
                };
                appState.classes.push(cls);
                touched.push(cls);
            }else{
                let changed=false;
                const patch={classCode:spec.code,name:spec.name,year:spec.year,active:true,academicYear:ay};
                Object.entries(patch).forEach(([k,v])=>{
                    if(cls[k]!==v){cls[k]=v;changed=true;}
                });
                if(changed)touched.push(cls);
            }
        });

        appState.classes.sort((a,b)=>classSortIndex(a)-classSortIndex(b)||String(a.name||'').localeCompare(String(b.name||''),'ms',{sensitivity:'base'}));

        if(syncRemote && typeof phase10Upsert==='function'){
            touched.forEach(c=>phase10Upsert('classes',c.id,c));
        }
        return canonicalActiveClasses(ay);
    }

    function normalizeMyKid(value){
        return String(value??'').replace(/\D/g,'').slice(0,12);
    }

    function formatMyKid(value){
        const digits=normalizeMyKid(value);
        return digits.length===12 ? `${digits.slice(0,6)}-${digits.slice(6,8)}-${digits.slice(8)}` : String(value??'').trim();
    }

    function studentNameCompare(a,b){
        const byName=String(a?.name||'').trim().localeCompare(
            String(b?.name||'').trim(),
            'ms',
            {sensitivity:'base',numeric:true,ignorePunctuation:true}
        );
        return byName || String(a?.id||'').localeCompare(String(b?.id||''),'ms',{sensitivity:'base',numeric:true});
    }

    function sortStudentsAZ(rows){
        return [...(rows||[])].sort(studentNameCompare);
    }

    function refreshStudentClassFilter(preserve=true){
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const yearEl=document.getElementById('student-year-filter');
        const classEl=document.getElementById('student-class-filter');
        if(!classEl)return;

        const ay=document.getElementById('filter-academic-year')?.value||'2026';
        const year=yearEl?.value||'ALL';
        const previous=preserve?classEl.value:'ALL';

        let classes=canonicalActiveClasses(ay);
        if(currentUserRole==='GURU_SEJARAH')classes=classes.filter(c=>c.teacherId===currentUserId);
        if(year!=='ALL')classes=classes.filter(c=>String(c.year)===String(year));

        classEl.innerHTML='<option value="ALL">Semua Kelas</option>'+
            classes.map(c=>`<option value="${c.id}">${canonicalClassCode(c)} · ${escapeHtml(c.name)}</option>`).join('');

        classEl.value=classes.some(c=>c.id===previous)?previous:'ALL';
    }

    function renderStudents() {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        refreshStudentClassFilter(true);

        const tbody=document.getElementById('student-table-body');
        const emptyState=document.getElementById('student-empty-state');
        if(!tbody||!emptyState)return;

        const searchVal=(document.getElementById('student-search')?.value||'').trim().toLowerCase();
        const statusFilter=document.getElementById('student-status-filter')?.value||'ALL';
        const yearFilter=document.getElementById('student-year-filter')?.value||'ALL';
        const classFilter=document.getElementById('student-class-filter')?.value||'ALL';
        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';

        let permittedClasses=canonicalActiveClasses(academicYear);
        if(currentUserRole==='GURU_SEJARAH'){
            permittedClasses=permittedClasses.filter(c=>c.teacherId===currentUserId);
        }
        const permittedClassIds=new Set(permittedClasses.map(c=>c.id));

        let filtered=appState.students.filter(s=>{
            if(!permittedClassIds.has(s.classId))return false;
            if(String(s.academicYear||academicYear)!==String(academicYear))return false;

            const searchableName=String(s.name||'').toLowerCase();
            const searchableId=normalizeMyKid(s.identifier);
            const searchDigits=normalizeMyKid(searchVal);
            if(searchVal && !searchableName.includes(searchVal) && !(searchDigits && searchableId.includes(searchDigits)))return false;

            if(statusFilter!=='ALL'&&s.status!==statusFilter)return false;
            if(yearFilter!=='ALL'&&String(s.year)!==String(yearFilter))return false;
            if(classFilter!=='ALL'&&s.classId!==classFilter)return false;
            return true;
        });

        // Auto sorting:
        // 1) classes follow 4K,4B,4F,5K,5B,5F,6K,6B,6F
        // 2) names are alphabetical A-Z inside each class.
        filtered.sort((a,b)=>{
            const ca=appState.classes.find(c=>c.id===a.classId);
            const cb=appState.classes.find(c=>c.id===b.classId);
            return classSortIndex(ca)-classSortIndex(cb) || studentNameCompare(a,b);
        });

        tbody.innerHTML='';
        if(!filtered.length){
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
            tbody.parentElement.classList.add('hidden');
        }else{
            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');
            tbody.parentElement.classList.remove('hidden');

            filtered.forEach((s,idx)=>{
                const classObj=appState.classes.find(c=>c.id===s.classId);
                const className=classObj?classObj.name:'Tiada Kelas';

                let statusBadge='';
                if(s.status==='Aktif')statusBadge='<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">AKTIF</span>';
                else if(s.status==='Pindah Sekolah')statusBadge='<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">PINDAH</span>';
                else statusBadge='<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">T. AKTIF</span>';

                const tr=document.createElement('tr');
                tr.className=`hover:bg-slate-50 transition-colors ${selectedStudents.has(s.id)?'bg-emerald-50/30':''}`;
                tr.innerHTML=`
                    <td class="px-4 py-3 text-center border-t border-slate-100">
                        <input type="checkbox" value="${s.id}" ${selectedStudents.has(s.id)?'checked':''} onchange="toggleStudentSelection(this)" class="student-checkbox rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30">
                    </td>
                    <td class="px-4 py-3 text-slate-500 border-t border-slate-100">${idx+1}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800 border-t border-slate-100">
                        ${escapeHtml(s.name||'')}
                        ${s.identifier?`<div class="text-[10px] text-slate-400 font-normal">MyKid: ${escapeHtml(formatMyKid(s.identifier))}</div>`:''}
                    </td>
                    <td class="px-4 py-3 text-slate-600 border-t border-slate-100">Tahun ${s.year}</td>
                    <td class="px-4 py-3 text-slate-600 border-t border-slate-100">${escapeHtml(className)}</td>
                    <td class="px-4 py-3 text-slate-600 border-t border-slate-100">${s.gender==='L'?'Lelaki':(s.gender==='P'?'Perempuan':'-')}</td>
                    <td class="px-4 py-3 border-t border-slate-100">${statusBadge}</td>
                    <td class="px-4 py-3 text-right border-t border-slate-100">
                        <button onclick="editStudent('${s.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Kemaskini">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteStudentConfirm('${s.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Padam">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>`;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('student-pagination-info').textContent=`Menunjukkan ${filtered.length} rekod · Auto sort kelas & nama A–Z`;
        updateBulkActionUI();
        lucide.createIcons();
    }

    // Modal Operations (Students)
    function openStudentModal() {
        document.getElementById('form-student-id').value = '';
        document.getElementById('form-student-name').value = '';
        document.getElementById('form-student-year').value = '';
        document.getElementById('form-student-class').value = '';
        document.getElementById('form-student-gender').value = '';
        document.getElementById('form-student-status').value = 'Aktif';
        document.getElementById('form-student-identifier').value = '';
        document.getElementById('form-student-class').disabled = true;
        
        document.getElementById('modal-student-title').textContent = 'Tambah Murid';
        const modal = document.getElementById('modal-student');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeStudentModal() {
        document.getElementById('modal-student').classList.add('hidden');
        document.getElementById('modal-student').classList.remove('flex');
    }

    function populateFormClasses(selectedClassId = '') {
        const year = document.getElementById('form-student-year').value;
        const classSelect = document.getElementById('form-student-class');
        classSelect.innerHTML = '<option value="">Pilih Kelas</option>';
        
        if (year) {
            ensureMattaryClassCatalog(isAdminSession?.()===true);
            let availableClasses = canonicalActiveClasses().filter(c => c.year.toString() === year);
            if (currentUserRole === 'GURU_SEJARAH') {
                availableClasses = availableClasses.filter(c => c.teacherId === currentUserId);
            }
            
            availableClasses.forEach(c => {
                classSelect.innerHTML += `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>`;
            });
            classSelect.disabled = false;
        } else {
            classSelect.innerHTML = '<option value="">Pilih Tahun Dahulu</option>';
            classSelect.disabled = true;
        }
    }

    function editStudent(id) {
        const student = appState.students.find(s => s.id === id);
        if(!student) return;

        document.getElementById('form-student-id').value = student.id;
        document.getElementById('form-student-name').value = student.name;
        document.getElementById('form-student-year').value = student.year;
        populateFormClasses(student.classId);
        document.getElementById('form-student-gender').value = student.gender || '';
        document.getElementById('form-student-status').value = student.status;
        document.getElementById('form-student-identifier').value = student.identifier || '';

        document.getElementById('modal-student-title').textContent = 'Kemaskini Murid';
        const modal = document.getElementById('modal-student');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function saveStudent() {
        const id = document.getElementById('form-student-id').value;
        const name = document.getElementById('form-student-name').value.trim();
        const year = document.getElementById('form-student-year').value;
        const classId = document.getElementById('form-student-class').value;
        const gender = document.getElementById('form-student-gender').value;
        const status = document.getElementById('form-student-status').value;
        const identifier = document.getElementById('form-student-identifier').value.trim();
        
        if(!name || !year || !classId) {
            showAlert('Ralat Pengisian', 'Sila isi Nama, Tahun dan Kelas yang wajib (*).', 'danger');
            return;
        }

        const studentData = {
            name, year: parseInt(year), classId, gender, status, identifier,
            academicYear: document.getElementById('filter-academic-year').value
        };

        if (id) {
            // Update
            const index = appState.students.findIndex(s => s.id === id);
            if(index !== -1) {
                appState.students[index] = { ...appState.students[index], ...studentData };
                showAlert('Berjaya', 'Rekod murid telah dikemaskini.', 'success');
            }
        } else {
            // Create
            studentData.id = 's' + Date.now();
            appState.students.push(studentData);
            showAlert('Berjaya', 'Rekod murid baru telah ditambah.', 'success');
        }
        
        const savedStudent=id?appState.students.find(s=>s.id===id):studentData;
        if(savedStudent) phase10Upsert('students',savedStudent.id,savedStudent);
        closeStudentModal();
        renderStudents();
        renderClasses(); // Update counts
    }

    function deleteStudentConfirm(id) {
        showAlert('Pengesahan Padam', 'Adakah anda pasti ingin memadam rekod murid ini? Tindakan ini tidak boleh dipulihkan.', 'danger', () => {
            appState.students = appState.students.filter(s => s.id !== id);
            phase10Delete('students',id);
            selectedStudents.delete(id);
            renderStudents();
            renderClasses();
            showAlert('Dipadam', 'Rekod telah berjaya dipadam.', 'success');
        });
    }

    // Bulk Actions Logic
    function toggleSelectAll(checkbox) {
        const rowCheckboxes = document.querySelectorAll('.student-checkbox');
        if (checkbox.checked) {
            rowCheckboxes.forEach(cb => {
                cb.checked = true;
                selectedStudents.add(cb.value);
            });
        } else {
            rowCheckboxes.forEach(cb => {
                cb.checked = false;
                selectedStudents.delete(cb.value);
            });
        }
        renderStudents(); // Re-render to highlight rows
    }

    function toggleStudentSelection(checkbox) {
        if(checkbox.checked) {
            selectedStudents.add(checkbox.value);
        } else {
            selectedStudents.delete(checkbox.value);
            document.getElementById('select-all-students').checked = false;
        }
        const tr = checkbox.closest('tr');
        if (checkbox.checked) tr.classList.add('bg-emerald-50/30');
        else tr.classList.remove('bg-emerald-50/30');
        
        updateBulkActionUI();
    }

    function updateBulkActionUI() {
        const bulkDiv = document.getElementById('bulk-actions');
        const countSpan = document.getElementById('selected-count');
        if(selectedStudents.size > 0) {
            countSpan.textContent = selectedStudents.size;
            bulkDiv.classList.remove('hidden');
            bulkDiv.classList.add('flex');
        } else {
            bulkDiv.classList.add('hidden');
            bulkDiv.classList.remove('flex');
        }
    }

    function bulkDeleteStudents() {
        if(selectedStudents.size === 0) return;
        showAlert('Padam Pelbagai', `Anda pasti ingin memadam ${selectedStudents.size} murid yang dipilih?`, 'danger', () => {
            const idsToDelete=[...selectedStudents];
            appState.students = appState.students.filter(s => !selectedStudents.has(s.id));
            idsToDelete.forEach(id=>phase10Delete('students',id));
            selectedStudents.clear();
            document.getElementById('select-all-students').checked = false;
            renderStudents();
            renderClasses();
            showAlert('Berjaya', 'Rekod terpilih telah dipadam.', 'success');
        });
    }

    function openBulkTransferModal() {
        if(selectedStudents.size === 0) return;
        
        // Populate class select
        const classSelect = document.getElementById('bulk-transfer-class');
        classSelect.innerHTML = '<option value="">Pilih Kelas</option>';
        
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let availableClasses = canonicalActiveClasses();
        if (currentUserRole === 'GURU_SEJARAH') {
            availableClasses = availableClasses.filter(c => c.teacherId === currentUserId);
        }
        
        // Group by year for neatness
        [4,5,6].forEach(y => {
            const yClasses = availableClasses.filter(c => c.year === y);
            if(yClasses.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `Tahun ${y}`;
                yClasses.forEach(c => {
                    optgroup.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                });
                classSelect.appendChild(optgroup);
            }
        });

        document.getElementById('transfer-count').textContent = selectedStudents.size;
        const modal = document.getElementById('modal-bulk-transfer');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeBulkTransferModal() {
        document.getElementById('modal-bulk-transfer').classList.add('hidden');
        document.getElementById('modal-bulk-transfer').classList.remove('flex');
    }

    function executeBulkTransfer() {
        const destClassId = document.getElementById('bulk-transfer-class').value;
        if(!destClassId) {
            alert("Sila pilih kelas destinasi.");
            return;
        }
        const destClass = appState.classes.find(c => c.id === destClassId);
        const transferred=[];
        appState.students.forEach(s => {
            if(selectedStudents.has(s.id)) {
                s.classId = destClassId;
                s.year = destClass.year; // Align year with new class
                transferred.push(s);
            }
        });
        transferred.forEach(s=>phase10Upsert('students',s.id,s));

        selectedStudents.clear();
        document.getElementById('select-all-students').checked = false;
        closeBulkTransferModal();
        renderStudents();
        renderClasses();
        showAlert('Berjaya', 'Pindahan kelas berjaya dilaksanakan.', 'success');
    }

    // --- DATA MURID IMPORT / EXPORT WORKBOOK ---
    function studentExportClassScope(templateOnly=false){
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const ay=document.getElementById('filter-academic-year')?.value||'2026';
        if(templateOnly)return canonicalActiveClasses(ay);

        const year=document.getElementById('student-year-filter')?.value||'ALL';
        const classId=document.getElementById('student-class-filter')?.value||'ALL';
        let classes=canonicalActiveClasses(ay);
        if(currentUserRole==='GURU_SEJARAH')classes=classes.filter(c=>c.teacherId===currentUserId);
        if(year!=='ALL')classes=classes.filter(c=>String(c.year)===String(year));
        if(classId!=='ALL')classes=classes.filter(c=>c.id===classId);
        return sortClassesCanonical(classes);
    }

    function buildStudentTemplateSheet(cls,templateOnly=false){
        const ay=document.getElementById('filter-academic-year')?.value||'2026';
        const spec=canonicalClassSpec(cls);
        const teacher=mockTeachers.find(t=>t.id===cls.teacherId);
        const students=templateOnly?[]:appState.students
            .filter(s=>s.classId===cls.id && String(s.academicYear||ay)===String(ay) && s.status==='Aktif')
            .sort(studentNameCompare);

        const rows=[
            [`SENARAI NAMA MURID MATTARY SESI ${ay}`,'','',''],
            [`TAHUN ${spec?.year||cls.year} ${(spec?.name||cls.name).replace(/^[456]\s+/,'')}`,'','',''],
            [teacher?.name||'','','',''],
            ['','','',''],
            ['BIL','NO.MYKID','NAMA','JANTINA'],
            ...students.map((s,i)=>[
                i+1,
                formatMyKid(s.identifier),
                String(s.name||'').toUpperCase(),
                s.gender==='L'?'L':(s.gender==='P'?'P':'')
            ])
        ];

        const ws=XLSX.utils.aoa_to_sheet(rows);
        ws['!merges']=[
            {s:{r:0,c:0},e:{r:0,c:3}},
            {s:{r:1,c:0},e:{r:1,c:3}},
            {s:{r:2,c:0},e:{r:2,c:3}}
        ];
        ws['!cols']=[{wch:8},{wch:20},{wch:48},{wch:12}];
        ws['!rows']=[{hpt:24},{hpt:22},{hpt:30},{hpt:8},{hpt:20}];
        return ws;
    }

    function exportStudentWorkbook(templateOnly=false){
        if(typeof XLSX==='undefined'){
            showAlert('Excel Tidak Tersedia','Library XLSX gagal dimuatkan.','danger');
            return;
        }

        const classes=studentExportClassScope(templateOnly).sort((a,b)=>
            (MATTARY_CLASS_ORDER.get(canonicalClassCode(a))??999)-
            (MATTARY_CLASS_ORDER.get(canonicalClassCode(b))??999)
        );
        if(!classes.length){
            showAlert('Tiada Kelas','Tiada kelas dalam skop penapis semasa.','info');
            return;
        }

        const wb=XLSX.utils.book_new();
        classes.forEach(cls=>{
            const code=canonicalClassCode(cls)||`T${cls.year}`;
            XLSX.utils.book_append_sheet(wb,buildStudentTemplateSheet(cls,templateOnly),code);
        });

        const ay=document.getElementById('filter-academic-year')?.value||'2026';
        XLSX.writeFile(
            wb,
            templateOnly
                ? `Template_Data_Murid_MATTARY_${ay}.xlsx`
                : `Data_Murid_MATTARY_${ay}_${new Date().toISOString().slice(0,10)}.xlsx`
        );
    }

    function downloadStudentTemplateWorkbook(){
        exportStudentWorkbook(true);
    }

    function exportCSV(){
        // Legacy button/function compatibility now exports the required workbook template.
        exportStudentWorkbook(false);
    }

    function openImportModal() {
        resetImport();
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const modal=document.getElementById('modal-import');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeImportModal() {
        document.getElementById('modal-import').classList.add('hidden');
        document.getElementById('modal-import').classList.remove('flex');
    }

    function resetImport() {
        pendingImportData=[];
        document.getElementById('file-upload').value='';
        document.getElementById('import-upload-area').classList.remove('hidden');
        document.getElementById('import-preview-area').classList.add('hidden');
        document.getElementById('btn-reset-import').classList.add('hidden');
        const btnConfirm=document.getElementById('btn-confirm-import');
        btnConfirm.disabled=true;
        btnConfirm.textContent='Sahkan Import';
        const classSummary=document.getElementById('import-class-summary');
        if(classSummary)classSummary.textContent='Kelas dikesan: —';
    }

    function handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('border-emerald-500','bg-emerald-50');
        if(e.dataTransfer.files&&e.dataTransfer.files.length>0){
            const input=document.getElementById('file-upload');
            input.files=e.dataTransfer.files;
            handleFileUpload({target:input});
        }
    }

    function normalizedTemplateHeader(value){
        return String(value??'')
            .toUpperCase()
            .replace(/\s+/g,' ')
            .replace(/[^A-Z0-9.]/g,'')
            .trim();
    }

    function findStudentTemplateHeader(row){
        const headers=(row||[]).map(normalizedTemplateHeader);
        const nameIndex=headers.findIndex(x=>x==='NAMA'||x==='NAMAMURID');
        const idIndex=headers.findIndex(x=>['NO.MYKID','NOMYKID','MYKID','NOKP','NOMYKAD'].includes(x));
        const genderIndex=headers.findIndex(x=>x==='JANTINA'||x==='GENDER');
        const bilIndex=headers.findIndex(x=>x==='BIL'||x==='BIL.');
        if(nameIndex<0)return null;
        return {bilIndex,idIndex,nameIndex,genderIndex};
    }

    function genderCode(value){
        const v=String(value??'').trim().toUpperCase();
        if(v==='L'||v.startsWith('LELAKI'))return 'L';
        if(v==='P'||v.startsWith('PEREMPUAN'))return 'P';
        return '';
    }

    function extractTemplateStudentRecords(rows,sheetName=''){
        const records=[];
        let activeSpec=canonicalClassSpec(sheetName);
        let i=0;

        while(i<rows.length){
            const row=Array.isArray(rows[i])?rows[i]:[];
            const rowText=row.map(v=>String(v??'').trim()).filter(Boolean).join(' ');
            const rowSpec=canonicalClassSpec(rowText);
            if(rowSpec)activeSpec=rowSpec;

            const header=findStudentTemplateHeader(row);
            if(!header){i++;continue;}

            // If class was not in sheet name, search nearby rows above the header.
            if(!activeSpec){
                for(let back=Math.max(0,i-5);back<i;back++){
                    const candidate=canonicalClassSpec((rows[back]||[]).join(' '));
                    if(candidate){activeSpec=candidate;break;}
                }
            }

            let j=i+1;
            let blankRun=0;
            while(j<rows.length){
                const dataRow=Array.isArray(rows[j])?rows[j]:[];
                const joined=dataRow.map(v=>String(v??'').trim()).filter(Boolean).join(' ');
                if(canonicalClassSpec(joined) || findStudentTemplateHeader(dataRow))break;

                const name=String(dataRow[header.nameIndex]??'').trim().replace(/\s+/g,' ');
                const identifier=header.idIndex>=0?String(dataRow[header.idIndex]??'').trim():'';
                const gender=header.genderIndex>=0?String(dataRow[header.genderIndex]??'').trim():'';
                const bil=header.bilIndex>=0?String(dataRow[header.bilIndex]??'').trim():'';

                if(!name&&!identifier&&!gender&&!bil){
                    blankRun++;
                    if(blankRun>=2)break;
                    j++;
                    continue;
                }
                blankRun=0;

                if(name){
                    records.push({
                        name,
                        identifier,
                        gender:genderCode(gender),
                        classCode:activeSpec?.code||'',
                        year:activeSpec?.year||null,
                        className:activeSpec?.name||'',
                        sourceSheet:sheetName
                    });
                }
                j++;
            }
            i=Math.max(j,i+1);
        }

        return records;
    }

    function extractFlatStudentRecords(rows,sheetName=''){
        if(!rows.length)return [];
        let headerIndex=-1,header=null;
        for(let i=0;i<Math.min(rows.length,30);i++){
            const h=findStudentTemplateHeader(rows[i]);
            if(h){
                const normalized=(rows[i]||[]).map(v=>String(v??'').trim().toUpperCase());
                const hasScope=normalized.some(v=>v==='TAHUN'||v==='KELAS'||v==='NAMA KELAS');
                if(hasScope){headerIndex=i;header=h;break;}
            }
        }
        if(headerIndex<0)return [];

        const rawHeader=(rows[headerIndex]||[]).map(v=>String(v??'').trim().toUpperCase());
        const yearIndex=rawHeader.findIndex(v=>v==='TAHUN');
        const classIndex=rawHeader.findIndex(v=>v==='KELAS'||v==='NAMA KELAS');

        return rows.slice(headerIndex+1).map(row=>{
            const spec=canonicalClassSpec(classIndex>=0?row[classIndex]:'',yearIndex>=0?row[yearIndex]:null);
            return {
                name:String(row[header.nameIndex]??'').trim().replace(/\s+/g,' '),
                identifier:header.idIndex>=0?String(row[header.idIndex]??'').trim():'',
                gender:header.genderIndex>=0?genderCode(row[header.genderIndex]):'',
                classCode:spec?.code||'',
                year:spec?.year||Number(row[yearIndex])||null,
                className:spec?.name||'',
                sourceSheet:sheetName
            };
        }).filter(r=>r.name);
    }

    function extractStudentWorkbookRecords(workbook){
        const all=[];
        const orderedSheets=[...(workbook.SheetNames||[])].sort((a,b)=>{
            const ca=canonicalClassCode(a);
            const cb=canonicalClassCode(b);
            const ia=MATTARY_CLASS_ORDER.has(ca)?MATTARY_CLASS_ORDER.get(ca):999;
            const ib=MATTARY_CLASS_ORDER.has(cb)?MATTARY_CLASS_ORDER.get(cb):999;
            return ia-ib || String(a).localeCompare(String(b),'ms',{sensitivity:'base'});
        });

        orderedSheets.forEach(sheetName=>{
            const ws=workbook.Sheets[sheetName];
            if(!ws)return;

            const rows=XLSX.utils.sheet_to_json(ws,{
                header:1,
                defval:'',
                raw:false,
                blankrows:true
            });

            let records=extractTemplateStudentRecords(rows,sheetName);
            if(!records.length)records=extractFlatStudentRecords(rows,sheetName);

            records.forEach(r=>{
                // Workbook provided by school uses sheet codes (4K ... 6F)
                // and titles such as "TAHUN 4 AL-KHAWARIZMI".
                // Both KHAWARIZMI and KHAWARIMI map to the canonical app class.
                const spec=canonicalClassSpec(r.classCode||sheetName,r.year);
                if(spec){
                    r.classCode=spec.code;
                    r.year=spec.year;
                    r.className=spec.name;
                }
            });

            all.push(...records);
        });

        return all.sort((a,b)=>{
            const ia=MATTARY_CLASS_ORDER.has(a.classCode)?MATTARY_CLASS_ORDER.get(a.classCode):999;
            const ib=MATTARY_CLASS_ORDER.has(b.classCode)?MATTARY_CLASS_ORDER.get(b.classCode):999;
            return ia-ib || String(a.name||'').localeCompare(String(b.name||''),'ms',{sensitivity:'base',numeric:true});
        });
    }

    function handleFileUpload(event) {
        const file=event.target.files[0];
        if(!file)return;
        if(file.size>5*1024*1024){
            showAlert('Fail Terlalu Besar','Saiz fail maksimum ialah 5MB.','danger');
            resetImport();
            return;
        }

        const reader=new FileReader();
        reader.onload=function(e){
            try{
                if(typeof XLSX==='undefined')throw new Error('Library XLSX belum dimuatkan.');
                const data=new Uint8Array(e.target.result);
                const workbook=XLSX.read(data,{type:'array'});
                const records=extractStudentWorkbookRecords(workbook);
                processImportData(records);
            }catch(err){
                console.error('Import Data Murid:',err);
                showAlert('Ralat Fail','Gagal membaca workbook/CSV. Pastikan fail menggunakan template Data Murid MATTARY.','danger');
                resetImport();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function processImportData(rawData) {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        if(!rawData.length){
            showAlert('Tiada Rekod','Tiada rekod murid ditemui. Pastikan workbook mempunyai tajuk kelas serta lajur BIL, NO.MYKID, NAMA dan JANTINA.','danger');
            return;
        }

        rawData=[...rawData].sort((a,b)=>{
            const ia=MATTARY_CLASS_ORDER.has(a.classCode)?MATTARY_CLASS_ORDER.get(a.classCode):999;
            const ib=MATTARY_CLASS_ORDER.has(b.classCode)?MATTARY_CLASS_ORDER.get(b.classCode):999;
            return ia-ib || String(a.name||'').localeCompare(String(b.name||''),'ms',{sensitivity:'base',numeric:true});
        });

        document.getElementById('import-upload-area').classList.add('hidden');
        document.getElementById('import-preview-area').classList.remove('hidden');
        document.getElementById('btn-reset-import').classList.remove('hidden');

        let validCount=0,dupeCount=0,errorCount=0;
        const tbody=document.getElementById('import-preview-body');
        tbody.innerHTML='';
        pendingImportData=[];

        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        const importKeys=new Set();

        rawData.forEach((row,idx)=>{
            const name=String(row.name||'').trim().replace(/\s+/g,' ');
            const identifier=normalizeMyKid(row.identifier);
            const gender=genderCode(row.gender);
            const spec=canonicalClassSpec(row.classCode||row.className,row.year);
            const foundClass=spec?canonicalActiveClasses(academicYear).find(c=>canonicalClassCode(c)===spec.code):null;

            let statusObj={type:'valid',msg:'Sedia',color:'emerald'};
            if(!name||!spec||!foundClass){
                statusObj={type:'error',msg:!spec?'Kelas Tidak Dikesan':'Data Tidak Lengkap',color:'rose'};
                errorCount++;
            }else{
                const normalizedName=name.toLocaleUpperCase('ms');
                const key=identifier?`ID:${identifier}`:`NM:${spec.code}:${normalizedName}`;
                const existingDupe=appState.students.some(s=>
                    (identifier&&normalizeMyKid(s.identifier)===identifier) ||
                    (String(s.name||'').toLocaleUpperCase('ms')===normalizedName&&s.classId===foundClass.id)
                );
                const importDupe=importKeys.has(key);

                if(existingDupe||importDupe){
                    statusObj={type:'dupe',msg:'Pendua',color:'amber'};
                    dupeCount++;
                }else{
                    importKeys.add(key);
                    validCount++;
                    pendingImportData.push({
                        id:identifier?`student_${identifier}`:`s_imp_${Date.now()}_${idx}`,
                        name,
                        year:spec.year,
                        classId:foundClass.id,
                        gender,
                        status:'Aktif',
                        identifier,
                        academicYear
                    });
                }
            }

            if(idx<80){
                const tr=document.createElement('tr');
                tr.innerHTML=`
                    <td class="px-3 py-2 border-b border-slate-100"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-${statusObj.color}-100 text-${statusObj.color}-700">${statusObj.msg}</span></td>
                    <td class="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">${escapeHtml(formatMyKid(identifier)||'-')}</td>
                    <td class="px-3 py-2 border-b border-slate-100 font-medium text-slate-800">${escapeHtml(name||'-')}</td>
                    <td class="px-3 py-2 border-b border-slate-100 text-slate-600">${spec?.year||'-'}</td>
                    <td class="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">${spec?`${spec.code} · ${escapeHtml(spec.name)}`:'-'}</td>
                    <td class="px-3 py-2 border-b border-slate-100 text-slate-600">${gender||'-'}</td>`;
                tbody.appendChild(tr);
            }
        });

        if(rawData.length>80){
            tbody.innerHTML+=`<tr><td colspan="6" class="px-3 py-2 text-center text-xs text-slate-500 bg-slate-50">... ${rawData.length-80} rekod lain tidak dipaparkan</td></tr>`;
        }

        document.getElementById('import-stat-total').textContent=rawData.length;
        document.getElementById('import-stat-valid').textContent=validCount;
        document.getElementById('import-stat-dupes').textContent=dupeCount;
        document.getElementById('import-stat-errors').textContent=errorCount;
        const detectedCodes=[...new Set(rawData.map(r=>r.classCode).filter(code=>MATTARY_CLASS_ORDER.has(code)))]
            .sort((a,b)=>MATTARY_CLASS_ORDER.get(a)-MATTARY_CLASS_ORDER.get(b));
        const summaryEl=document.getElementById('import-class-summary');
        if(summaryEl){
            summaryEl.textContent=detectedCodes.length
                ? `Kelas dikesan (${detectedCodes.length}/9): ${detectedCodes.join(' · ')}`
                : 'Kelas dikesan: tiada';
        }

        const btnConfirm=document.getElementById('btn-confirm-import');
        btnConfirm.disabled=validCount===0;
        btnConfirm.textContent=validCount>0?`Import ${validCount} Rekod Sah`:'Tiada Rekod Sah';
    }

    function confirmImport() {
        if(!pendingImportData.length)return;

        const imported=[...pendingImportData].sort((a,b)=>{
            const ca=appState.classes.find(c=>c.id===a.classId);
            const cb=appState.classes.find(c=>c.id===b.classId);
            return classSortIndex(ca)-classSortIndex(cb)||studentNameCompare(a,b);
        });
        appState.students=[...appState.students,...imported];
        imported.forEach(s=>phase10Upsert('students',s.id,s));

        pendingImportData=[];
        showAlert('Import Selesai',`${imported.length} rekod murid berjaya diimport dan disusun mengikut kelas serta nama A–Z.`,'success');

        closeImportModal();
        refreshStudentClassFilter(false);
        renderStudents();
        renderClasses();
        updateDashboardKPIs();
    }

    // --- PHASE 2: CLASSES MODULE (PENGURUSAN KELAS) ---
    function renderClasses() {
        const container = document.getElementById('class-grid-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const globalYearFilter = document.getElementById('filter-academic-year').value;
        let permittedClasses = canonicalActiveClasses(globalYearFilter);
        
        // RBAC filtering for classes view
        if (currentUserRole === 'GURU_SEJARAH') {
            permittedClasses = permittedClasses.filter(c => c.teacherId === currentUserId);
            document.getElementById('class-permission-alert').classList.remove('hidden');
            document.getElementById('class-actions-container').classList.add('hidden');
        } else {
            document.getElementById('class-permission-alert').classList.add('hidden');
            document.getElementById('class-actions-container').classList.remove('hidden');
        }

        [4, 5, 6].forEach(year => {
            const yearClasses = sortClassesCanonical(permittedClasses.filter(c => c.year === year));
            if (yearClasses.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'space-y-4';
            
            groupDiv.innerHTML = `
                <h3 class="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">T${year}</div>
                    Tahun ${year}
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="class-grid-y${year}">
                </div>
            `;
            
            container.appendChild(groupDiv);
            
            const grid = groupDiv.querySelector(`#class-grid-y${year}`);
            
            yearClasses.forEach(cls => {
                const teacher = mockTeachers.find(t => t.id === cls.teacherId);
                const teacherName = teacher ? teacher.name : 'Tiada Guru';
                
                // Calculate student count from single source of truth
                const studentCount = appState.students.filter(s => s.classId === cls.id && s.status === 'Aktif').length;
                
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group';
                
                let actionsHtml = '';
                if (currentUserRole !== 'GURU_SEJARAH') {
                    actionsHtml = `
                        <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onclick="editClass('${cls.id}')" class="p-1.5 bg-slate-100 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Kemaskini Kelas"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteClassConfirm('${cls.id}')" class="p-1.5 bg-slate-100 text-rose-600 hover:bg-rose-100 rounded-md transition-colors" title="Padam Kelas"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    `;
                }

                card.innerHTML = `
                    ${actionsHtml}
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200">
                            ${cls.name.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-base leading-tight">${cls.name}</h4>
                            <p class="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                                <span class="w-2 h-2 rounded-full ${cls.active ? 'bg-emerald-400' : 'bg-slate-300'}"></span>
                                ${cls.active ? 'Aktif' : 'Tidak Aktif'}
                            </p>
                        </div>
                    </div>
                    
                    <div class="space-y-2.5">
                        <div class="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
                            <span class="text-slate-500 text-xs font-semibold uppercase">Guru Sejarah</span>
                            <span class="font-medium text-slate-800 text-right">${teacherName}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
                            <span class="text-slate-500 text-xs font-semibold uppercase">Bil. Murid</span>
                            <span class="font-bold text-emerald-600 text-right">${studentCount} Orang</span>
                        </div>
                    </div>
                    
                    <div class="mt-4 pt-4 border-t border-slate-100 flex justify-between gap-2">
                        <button onclick="document.getElementById('filter-kelas').value='${cls.id}'; navigateTab('students'); onFilterChange();" class="flex-1 text-xs font-bold text-slate-600 hover:text-emerald-600 bg-white border border-slate-200 hover:border-emerald-200 py-1.5 rounded-lg transition-colors text-center">Lihat Murid</button>
                        <button onclick="document.getElementById('filter-kelas').value='${cls.id}'; navigateTab('marks'); onFilterChange();" class="flex-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-1.5 rounded-lg transition-colors text-center shadow-sm">Isi Markah</button>
                    </div>
                `;
                
                grid.appendChild(card);
            });
        });
        
        if (permittedClasses.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200 border-dashed">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="building" class="w-8 h-8 text-slate-400"></i>
                    </div>
                    <h3 class="text-sm font-bold text-slate-800">Tiada Kelas Ditemui</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm">Tiada maklumat kelas didaftarkan mengikut penapis carian semasa atau anda tiada akses.</p>
                </div>
            `;
        }
        
        lucide.createIcons();
    }
    
    function populateFormTeachers() {
        const select = document.getElementById('form-class-teacher');
        select.innerHTML = '<option value="">Pilih Guru Sejarah</option>';
        mockTeachers.filter(t => t.role === 'GURU_SEJARAH' && t.active !== false).forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    }

    function openClassModal() {
        document.getElementById('form-class-id').value = '';
        document.getElementById('form-class-name').value = '';
        document.getElementById('form-class-year').value = '4';
        document.getElementById('form-class-active').checked = true;
        
        populateFormTeachers();
        document.getElementById('form-class-teacher').value = '';
        
        document.getElementById('modal-class-title').textContent = 'Tambah Kelas Baru';
        const modal = document.getElementById('modal-class');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeClassModal() {
        document.getElementById('modal-class').classList.add('hidden');
        document.getElementById('modal-class').classList.remove('flex');
    }

    function editClass(id) {
        const cls = appState.classes.find(c => c.id === id);
        if(!cls) return;

        document.getElementById('form-class-id').value = cls.id;
        document.getElementById('form-class-name').value = cls.name;
        document.getElementById('form-class-year').value = cls.year;
        document.getElementById('form-class-active').checked = cls.active;
        
        populateFormTeachers();
        document.getElementById('form-class-teacher').value = cls.teacherId;

        document.getElementById('modal-class-title').textContent = 'Kemaskini Kelas';
        const modal = document.getElementById('modal-class');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function saveClass() {
        const id = document.getElementById('form-class-id').value;
        const name = document.getElementById('form-class-name').value.trim();
        const year = document.getElementById('form-class-year').value;
        const teacherId = document.getElementById('form-class-teacher').value;
        const active = document.getElementById('form-class-active').checked;
        const academicYear = document.getElementById('filter-academic-year').value;
        
        if(!name || !year || !teacherId) {
            showAlert('Ralat Pengisian', 'Sila isi Nama Kelas, Tahun dan pilih Guru Sejarah.', 'danger');
            return;
        }

        const classData = {
            name, year: parseInt(year), teacherId, active, academicYear
        };

        if (id) {
            const index = appState.classes.findIndex(c => c.id === id);
            if(index !== -1) {
                appState.classes[index] = { ...appState.classes[index], ...classData };
                showAlert('Berjaya', 'Maklumat kelas telah dikemaskini.', 'success');
            }
        } else {
            classData.id = 'c_' + Date.now();
            appState.classes.push(classData);
            showAlert('Berjaya', 'Kelas baru telah ditambah.', 'success');
        }
        
        const savedClass=id?appState.classes.find(c=>c.id===id):classData;
        if(savedClass) phase10Upsert('classes',savedClass.id,savedClass);
        closeClassModal();
        renderClasses();
        updateClassFilterDropdown();
    }

    function deleteClassConfirm(id) {
        // Protection check
        const activeStudents = appState.students.filter(s => s.classId === id && s.status === 'Aktif');
        if (activeStudents.length > 0) {
            showAlert('Tindakan Dihalang', `Kelas ini masih mempunyai ${activeStudents.length} murid aktif. Anda perlu memadam atau memindahkan murid terlebih dahulu sebelum kelas boleh dipadam.`, 'warning');
            return;
        }
        
        showAlert('Pengesahan Padam', 'Adakah anda pasti ingin memadam kelas ini?', 'danger', () => {
            appState.classes = appState.classes.filter(c => c.id !== id);
            phase10Delete('classes',id);
            renderClasses();
            updateClassFilterDropdown();
            showAlert('Dipadam', 'Kelas telah berjaya dipadam.', 'success');
        });
    }

    function updateClassFilterDropdown() {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const select=document.getElementById('filter-kelas');
        if(!select)return;
        const currentVal=select.value;
        let classes=canonicalActiveClasses();
        if(currentUserRole==='GURU_SEJARAH')classes=classes.filter(c=>c.teacherId===currentUserId);

        select.innerHTML='<option value="ALL">Semua Kelas</option>'+
            classes.map(c=>`<option value="${c.id}">${canonicalClassCode(c)} · ${escapeHtml(c.name)}</option>`).join('');

        select.value=classes.some(c=>c.id===currentVal)?currentVal:'ALL';
        refreshStudentClassFilter(true);
    }

    // --- PHASE 3: MARKS MODULE ---
    
    // Synchronize Assessment dropdown with Class selection in Global Filters
    function marksPermittedClasses(academicYear, yearLevel='ALL') {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (isTeacherSession()) classes = classes.filter(c => c.teacherId === currentUserId);
        if (yearLevel !== 'ALL') classes = classes.filter(c => String(c.year) === String(yearLevel));
        return sortClassesCanonical(classes);
    }

    function initializeMarksScopeControls() {
        ensureAutoAssessmentTemplates(true,document.getElementById('filter-academic-year')?.value||getActiveAcademicYear());
        if(isTeacherSession())syncTeacherAssessmentAvailability('marks');
        const sessionEl = document.getElementById('marks-scope-session');
        const yearEl = document.getElementById('marks-scope-year');
        const classEl = document.getElementById('marks-scope-class');
        if (!sessionEl || !yearEl || !classEl) return;

        sessionEl.value = document.getElementById('filter-academic-year')?.value || '2026';
        yearEl.value = document.getElementById('filter-tahun')?.value || 'ALL';
        refreshMarksScopeClassOptions();

        const globalClass = document.getElementById('filter-kelas')?.value || 'ALL';
        if ([...classEl.options].some(o => o.value === globalClass)) {
            classEl.value = globalClass;
        } else {
            const firstActual = [...classEl.options].find(o => o.value);
            classEl.value = firstActual?.value || '';
            if (classEl.value) syncMarksScopeToGlobal();
        }

        const note = document.getElementById('marks-access-note');
        if (note) note.textContent = isTeacherSession()
            ? 'Guru hanya boleh memilih kelas yang telah ditugaskan kepadanya.'
            : 'Admin boleh memilih semua kelas.';
    }

    function refreshMarksScopeClassOptions() {
        const sessionEl = document.getElementById('marks-scope-session');
        const yearEl = document.getElementById('marks-scope-year');
        const classEl = document.getElementById('marks-scope-class');
        if (!sessionEl || !yearEl || !classEl) return;

        const previous = classEl.value;
        const classes = marksPermittedClasses(sessionEl.value, yearEl.value);
        classEl.innerHTML = classes.length
            ? '<option value="">Pilih Kelas</option>' + classes.map(c => `<option value="${c.id}">Tahun ${c.year} · ${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">Tiada Kelas Ditugaskan</option>';

        if (classes.some(c => c.id === previous)) classEl.value = previous;
    }

    function syncMarksScopeToGlobal() {
        const sessionEl = document.getElementById('marks-scope-session');
        const yearEl = document.getElementById('marks-scope-year');
        const classEl = document.getElementById('marks-scope-class');
        const globalSession = document.getElementById('filter-academic-year');
        const globalYear = document.getElementById('filter-tahun');
        const globalClass = document.getElementById('filter-kelas');
        if (!sessionEl || !yearEl || !classEl || !globalSession || !globalYear || !globalClass) return;

        globalSession.value = sessionEl.value;
        globalYear.value = yearEl.value;
        updateClassFilterDropdown();

        globalClass.value = [...globalClass.options].some(o => o.value === classEl.value) ? classEl.value : 'ALL';
        updateAssessmentDropdown();
        renderMarksModule();
    }

    function onMarksScopeControlChange(source) {
        if (source === 'session' || source === 'year') {
            refreshMarksScopeClassOptions();
            const classEl = document.getElementById('marks-scope-class');
            const firstActual = classEl ? [...classEl.options].find(o => o.value) : null;
            if (classEl) classEl.value = firstActual?.value || '';
        }
        syncMarksScopeToGlobal();
    }

    function updateMarksTypeButtonUI() {
        ['UPSA','UASA','DIAGNOSTIK'].forEach(type => {
            const btn=document.getElementById(`marks-type-${type}`);
            if(!btn)return;
            const open=isAssessmentEntryOpen('marks',type);
            const active=marksAssessmentTypeFilter===type;

            // v59: explicit selected class gives reliable contrast in both
            // light and dark mode without changing the assessment logic.
            btn.classList.toggle('is-selected',active);
            btn.setAttribute('aria-pressed',active?'true':'false');

            btn.classList.toggle('hidden',isTeacherSession()&&!open);
            btn.classList.toggle('border-emerald-400',active);
            btn.classList.toggle('bg-emerald-50',active);
            btn.classList.toggle('ring-2',active);
            btn.classList.toggle('ring-emerald-500/10',active);
            btn.classList.toggle('border-slate-200',!active);
            btn.classList.toggle('bg-white',!active);
            btn.classList.toggle('opacity-55',isAdminSession()&&!open);
            btn.title=open?'Pengisian markah aktif':'Pengisian markah dinyahaktifkan oleh Admin';
        });
    }

    function selectMarksAssessmentType(type) {
        if(!['UPSA','UASA','DIAGNOSTIK'].includes(type))return;
        if(isTeacherSession()&&!isAssessmentEntryOpen('marks',type))return;
        marksAssessmentTypeFilter=type;
        updateMarksTypeButtonUI();
        updateAssessmentDropdown();
        renderMarksModule();
        lucide.createIcons();
    }

    function updateAssessmentDropdown(preferredAssessmentId = null) {
        const classId=document.getElementById('filter-kelas')?.value||'ALL';
        const academicYear=document.getElementById('filter-academic-year')?.value||getActiveAcademicYear();
        const assessSelect=document.getElementById('filter-assessment');
        if(!assessSelect)return;

        ensureAutoAssessmentTemplates(true,academicYear);
        if(isTeacherSession())syncTeacherAssessmentAvailability('marks');

        const prevSelected=preferredAssessmentId||assessSelect.value;
        assessSelect.innerHTML='';

        if(!marksAssessmentTypeFilter){
            assessSelect.innerHTML='<option value="">Tiada ujian markah diaktifkan</option>';
            return;
        }

        if(classId&&classId!=='ALL'){
            const classAssessments=appState.assessments
                .filter(a=>a.classId===classId &&
                    String(a.academicYear||academicYear)===String(academicYear) &&
                    a.type===marksAssessmentTypeFilter)
                .sort((a,b)=>compareAssessmentsByExamDate(b,a));

            if(classAssessments.length){
                const preferred=classAssessments.find(a=>a.id===prevSelected)||classAssessments[0];
                classAssessments.forEach(a=>{
                    assessSelect.innerHTML+=`<option value="${a.id}">${escapeHtml(FIXED_ASSESSMENT_META[a.type]?.short||a.type)}</option>`;
                });
                assessSelect.value=preferred.id;
            }else{
                assessSelect.innerHTML='<option value="">Template ujian belum tersedia</option>';
            }
        }else{
            assessSelect.innerHTML='<option value="">Pilih Kelas Dahulu</option>';
        }
        updateMarksTypeButtonUI();
    }

    function renderMarksModule() {
        const classId = document.getElementById('filter-kelas').value;
        const assessmentId = document.getElementById('filter-assessment').value;
        
        const promptState = document.getElementById('marks-prompt-state');
        const workspace = document.getElementById('marks-workspace');

        if(isTeacherSession() && openAssessmentTypes('marks').length===0){
            promptState.classList.remove('hidden');
            workspace.classList.add('hidden');
            const title=promptState.querySelector('h3');if(title)title.textContent='Tiada Pengisian Markah Diaktifkan';
            const desc=promptState.querySelector('p');if(desc)desc.textContent='Admin belum mengaktifkan pengisian Markah bagi Diagnostik, UPSA atau UASA.';
            return;
        }
        if(!classId || classId==='ALL' || !assessmentId){
            promptState.classList.remove('hidden');
            workspace.classList.add('hidden');
            const title=promptState.querySelector('h3');if(title)title.textContent='Pilih Kelas untuk Mula Pengisian';
            const desc=promptState.querySelector('p');if(desc)desc.textContent='Pilih kelas. Template ujian yang diaktifkan oleh Admin akan dipaparkan secara automatik.';
            return;
        }

        const assessment = appState.assessments.find(a => a.id === assessmentId);
        const classObj = appState.classes.find(c => c.id === classId);
        
        if (!assessment || !classObj) return;

        const marksContextKey=`${classId}|${assessmentId}`;
        if(marksEditContextKey!==marksContextKey){
            marksEditContextKey=marksContextKey;
            marksManualEditMode=!getActualScoreRecords().some(s=>s.assessmentId===assessmentId);
        }

        if (isTeacherSession() && classObj.teacherId !== currentUserId) {
            promptState.classList.remove('hidden');
            workspace.classList.add('hidden');
            showAlert('Akses Kelas Ditolak', 'Guru hanya boleh mengisi markah untuk kelas yang ditugaskan kepadanya.', 'danger');
            return;
        }

        promptState.classList.add('hidden');
        workspace.classList.remove('hidden');

        // Header Info
        document.getElementById('mark-assessment-name').textContent = assessment.name;
        document.getElementById('mark-assessment-class').textContent = classObj.name;
        document.getElementById('mark-assessment-date').textContent=`Sesi ${phase9AyLabel(assessment.academicYear||getActiveAcademicYear())}`;
        document.getElementById('mark-assessment-max').textContent = assessment.maxScore;
        document.getElementById('table-max-score').textContent = assessment.maxScore;
        document.getElementById('stat-mastery-threshold').textContent = appSettings.masteryThreshold;

        // Admin activation control is the single source of truth.
        const statusBadge=document.getElementById('mark-assessment-status');
        const overlay=document.getElementById('marks-locked-overlay');
        const entryOpen=isAssessmentEntryOpen('marks',assessment.type);
        const canManage=entryOpen && (isAdminSession() || (isTeacherSession() && classObj.teacherId===currentUserId));
        const canEdit=canManage && marksManualEditMode;
        const isLocked=false;

        const examDateInput=document.getElementById('mark-assessment-date-input');
        const examDateDisplay=document.getElementById('mark-assessment-date-display');
        const examDateLabelText=document.getElementById('mark-assessment-date-label-text');
        const examDateNote=document.getElementById('mark-assessment-date-note');
        const dateCard=document.querySelector('.marks-exam-date-card');
        const adminCanSetDate=isAdminSession();
        if(examDateInput){
            examDateInput.value=assessmentExamDateValue(assessment);
            examDateInput.disabled=!adminCanSetDate;
            examDateInput.classList.toggle('hidden',!adminCanSetDate);
            examDateInput.setAttribute('aria-invalid',assessmentExamDateValue(assessment)?'false':'true');
        }
        if(examDateDisplay){
            examDateDisplay.textContent=formatAssessmentExamDate(assessment.date);
            examDateDisplay.classList.toggle('hidden',adminCanSetDate);
        }
        if(examDateLabelText)examDateLabelText.textContent=adminCanSetDate?'Tarikh Ujian':'Tarikh Ujian Ditetapkan Admin';
        dateCard?.classList.toggle('is-readonly',!adminCanSetDate);
        if(examDateNote){
            const actualDate=assessmentExamDateValue(assessment);
            const possibleMockDate=Boolean(actualDate&&assessment.autoTemplate&&/-01-01$/.test(actualDate));
            examDateNote.textContent=!adminCanSetDate
                ? actualDate
                    ? 'Tarikh ini diselaraskan daripada tetapan Admin dan digunakan untuk Markah Terkini.'
                    : 'Tarikh belum ditetapkan oleh Admin. Guru tidak perlu mengisi medan ini.'
                : !actualDate
                    ? 'Belum ditetapkan. Isi tarikh sebenar ujian untuk susunan prestasi yang tepat.'
                    : possibleMockDate
                        ? `${formatAssessmentExamDate(actualDate)} · sila semak, ini mungkin tarikh contoh data lama.`
                        : `${formatAssessmentExamDate(actualDate)} · digunakan untuk Markah Terkini.`;
            examDateNote.classList.toggle('is-missing',!actualDate||possibleMockDate);
        }

        document.getElementById('btn-edit-assessment')?.classList.add('hidden');
        document.getElementById('btn-lock-assessment')?.classList.add('hidden');

        if(!entryOpen){
            statusBadge.innerHTML='<i data-lucide="pause-circle" class="w-3 h-3 inline mr-1"></i> DINYAHAKTIFKAN';
            statusBadge.className='px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center';
            overlay.classList.remove('hidden');overlay.classList.add('flex');
            const h=overlay.querySelector('h4');if(h)h.textContent='Pengisian Markah Dinyahaktifkan';
            const p=overlay.querySelector('p');if(p)p.textContent=marksEntryClosedMessage(assessment.type);
        }else if(!canManage){
            statusBadge.textContent='PAPARAN SAHAJA';
            statusBadge.className='px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200';
            overlay.classList.remove('hidden');overlay.classList.add('flex');
            const h=overlay.querySelector('h4');if(h)h.textContent='Tiada Kebenaran Mengedit';
            const p=overlay.querySelector('p');if(p)p.textContent='Anda hanya boleh mengisi markah bagi kelas yang ditugaskan kepada anda.';
        }else{
            statusBadge.textContent=marksManualEditMode?'EDIT AKTIF':'PAPARAN';
            statusBadge.className=marksManualEditMode
                ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200';
            overlay.classList.add('hidden');overlay.classList.remove('flex');
        }
        updateMarksDataActionButtons(canManage,assessmentId);

        // Render Students Grid
        const tbody = document.getElementById('marks-table-body');
        tbody.innerHTML = '';
        
        // Use active students assigned to this class
        const students = sortStudentsAZ(appState.students.filter(s => s.classId === classId && s.status === 'Aktif'));
        
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-slate-500 font-medium bg-slate-50/50">Tiada murid aktif dalam kelas ini. Sila tambah di modul Data Murid.</td></tr>`;
            updateMarksStats([], assessment);
            lucide.createIcons();
            return;
        }

        students.forEach((student, idx) => {
            // Find existing score record
            const scoreRec = getActualScoreRecords().find(s => s.studentId === student.id && s.assessmentId === assessmentId) || {
                rawScore: '', percentage: '', grade: '-', absent: false, teacherNote: ''
            };
            
            const markPercentVal = scoreRec.absent
                ? ''
                : (scoreRec.percentage !== null && scoreRec.percentage !== undefined && scoreRec.percentage !== ''
                    ? Math.round(Number(scoreRec.percentage))
                    : (scoreRec.rawScore !== null && scoreRec.rawScore !== undefined && scoreRec.rawScore !== ''
                        ? Math.round(Number(scoreRec.rawScore))
                        : ''));
            const grdVal = scoreRec.absent ? 'TH' : scoreRec.grade;
            
            // Generate Grade styling
            let gradeBadge = grdVal;
            if (['A', 'B', 'C'].includes(grdVal)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700">${grdVal}</span>`;
            else if (['D'].includes(grdVal)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-700">${grdVal}</span>`;
            else if (['E', 'F'].includes(grdVal)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-700">${grdVal}</span>`;
            else if (grdVal === 'TH') gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-600">${grdVal}</span>`;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors group';
            tr.innerHTML = `
                <td class="marks-center-cell marks-bil-cell">${idx + 1}</td>
                <td class="marks-name-cell">${escapeHtml(student.name)}</td>
                <td class="marks-center-cell">
                    <label class="marks-attendance-wrap">
                        <input type="checkbox"
                               class="sr-only peer attendance-checkbox"
                               data-student="${student.id}"
                               ${scoreRec.absent ? 'checked' : ''}
                               onchange="toggleAbsent('${student.id}', '${assessmentId}', this, ${assessment.maxScore})"
                               ${(!canEdit || isLocked) ? 'disabled' : ''}>
                        <div class="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        <span class="marks-attendance-label">${scoreRec.absent?'TH':'HADIR'}</span>
                    </label>
                </td>
                <td class="marks-center-cell">
                    <div class="marks-score-wrap">
                        <div class="marks-percent-input-wrap">
                            <input type="number"
                                   data-student="${student.id}"
                                   min="0"
                                   max="100"
                                   step="1"
                                   value="${markPercentVal}"
                                   class="score-input marks-score-input"
                                   ${scoreRec.absent || !canEdit || isLocked ? 'disabled' : ''}
                                   oninput="handleScoreInput('${student.id}', '${assessmentId}', this, 100)"
                                   onkeydown="handleSpreadsheetNav(event, this)">
                            <span class="marks-percent-suffix">%</span>
                        </div>
                        <span class="marks-row-save-state" id="status-${student.id}">
                            <i data-lucide="check" class="w-3.5 h-3.5 ${scoreRec.percentage !== null || scoreRec.absent ? 'text-emerald-500' : 'text-slate-300'}"></i>
                        </span>
                    </div>
                </td>
                <td class="marks-center-cell marks-grade-cell" id="grade-${student.id}">${gradeBadge}</td>
                <td class="marks-center-cell">
                    <input type="text"
                           data-student="${student.id}"
                           value="${escapeHtml(scoreRec.teacherNote || '')}"
                           placeholder="Catatan..."
                           class="teacher-note-input marks-note-input"
                           ${!canEdit || isLocked ? 'disabled' : ''}
                           oninput="handleNoteInput('${student.id}', '${assessmentId}', this)">
                </td>
            `;
            tbody.appendChild(tr);
        });

        updateMarksStats(students, assessment);
        lucide.createIcons();
    }

    function logAudit(action, details) {
        appState.auditLogs.push({
            id: 'log_' + Date.now(),
            timestamp: new Date().toISOString(),
            userId: currentUserId,
            action: action,
            details: details
        });
    }

    // Input Handlers with Debounce (Auto-save)
    function currentMarksContext(){
        const classId=document.getElementById('filter-kelas')?.value||'';
        const assessmentId=document.getElementById('filter-assessment')?.value||'';
        const assessment=appState.assessments.find(a=>a.id===assessmentId);
        const cls=appState.classes.find(c=>c.id===classId);
        const canManage=Boolean(
            assessment && cls &&
            isAssessmentEntryOpen('marks',assessment.type) &&
            (isAdminSession() || (isTeacherSession() && cls.teacherId===currentUserId))
        );
        return {classId,assessmentId,assessment,cls,canManage};
    }

    async function saveCurrentAssessmentDate(value){
        const ctx=currentMarksContext();
        if(!isAdminSession()){
            showAlert('Tetapan Admin','Tarikh ujian ditetapkan oleh Admin. Guru tidak perlu mengisi atau mengubah tarikh ini.','info');
            renderMarksModule();
            return;
        }

        const requested=String(value||'').trim();
        const nextDate=normalizeAssessmentExamDate(requested);
        if(requested&&!nextDate){
            showAlert('Tarikh Tidak Sah','Sila masukkan tarikh ujian yang sah.','danger');
            renderMarksModule();
            return;
        }

        const previousDate=assessmentExamDateValue(ctx.assessment);
        if(previousDate===nextDate)return;

        ctx.assessment.date=nextDate;
        ctx.assessment.updatedAt=new Date().toISOString();
        ctx.assessment.updatedBy=currentUserId;
        persistMarksState();

        let remoteSaved=true;
        if(phase10Mode==='SUPABASE'){
            remoteSaved=await phase10Upsert('assessments',ctx.assessment.id,ctx.assessment,{subject:'SEJARAH'});
        }
        logAudit('UPDATE_ASSESSMENT_DATE',{
            assessmentId:ctx.assessment.id,
            classId:ctx.classId,
            assessmentType:ctx.assessment.type,
            previousDate:previousDate||null,
            examDate:nextDate||null
        });

        renderMarksModule();
        refreshLiveMarksDependents();
        showAlert(
            remoteSaved?'Tarikh Ujian Dikemas Kini':'Tarikh Disimpan Secara Setempat',
            nextDate
                ? `${ctx.assessment.name} kini menggunakan ${formatAssessmentExamDate(nextDate)} untuk menentukan markah terkini murid.`
                : 'Tarikh ujian telah dikosongkan. Tetapkan tarikh sebenar supaya markah terkini dapat dikenal pasti dengan tepat.',
            remoteSaved?'success':'info'
        );
    }

    function updateMarksDataActionButtons(canManage=null,assessmentId=null){
        const ctx=currentMarksContext();
        if(canManage===null)canManage=ctx.canManage;
        if(!assessmentId)assessmentId=ctx.assessmentId;
        const hasData=Boolean(assessmentId&&getActualScoreRecords().some(s=>s.assessmentId===assessmentId));
        const edit=document.getElementById('btn-marks-edit-data');
        const save=document.getElementById('btn-marks-save-data');
        const del=document.getElementById('btn-marks-delete-data');
        [edit,save,del].forEach(btn=>{
            if(!btn)return;
            btn.disabled=!canManage;
            btn.classList.toggle('is-disabled',!canManage);
        });
        if(save){
            save.disabled=!canManage||!marksManualEditMode;
            save.classList.toggle('is-disabled',save.disabled);
        }
        if(del){
            del.disabled=!canManage||!hasData;
            del.classList.toggle('is-disabled',del.disabled);
        }
        if(edit){
            edit.classList.toggle('is-active',Boolean(canManage&&marksManualEditMode));
            edit.innerHTML=marksManualEditMode
                ? '<i data-lucide="pencil" class="w-4 h-4"></i> Edit Aktif'
                : '<i data-lucide="pencil" class="w-4 h-4"></i> Edit';
        }
        if(typeof lucide!=='undefined')lucide.createIcons();
    }

    function enableCurrentMarksEdit(){
        const ctx=currentMarksContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','Pengisian markah tidak aktif atau kelas ini bukan di bawah tugasan anda.','danger');
            return;
        }
        marksManualEditMode=true;
        renderMarksModule();
        setTimeout(()=>document.querySelector('#marks-table-body .score-input:not([disabled])')?.focus(),80);
    }
    async function saveCurrentMarksData(){
        const ctx=currentMarksContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','Data markah tidak boleh disimpan dalam skop ini.','danger');
            return;
        }

        const students=sortStudentsAZ(appState.students.filter(s=>s.classId===ctx.classId&&s.status==='Aktif'));
        const writes=[];

        students.forEach(student=>{
            const scoreInput=document.querySelector(`.score-input[data-student="${student.id}"]`);
            const attendance=document.querySelector(`.attendance-checkbox[data-student="${student.id}"]`);
            const noteInput=document.querySelector(`.teacher-note-input[data-student="${student.id}"]`);
            if(!scoreInput&&!attendance&&!noteInput)return;

            const absent=Boolean(attendance?.checked);
            const raw=absent||!scoreInput||scoreInput.value===''?null:Math.round(Number(scoreInput.value));
            const percentage=absent?null:raw;
            const grade=absent?'-':calculateGrade(percentage);

            let rec=getActualScoreRecords().find(s=>s.studentId===student.id&&s.assessmentId===ctx.assessmentId);
            const hasContent=absent||raw!==null||String(noteInput?.value||'').trim()!=='';
            if(!rec&&!hasContent)return;

            if(!rec){
                rec={
                    id:'sc_'+Date.now()+Math.random().toString(16).slice(2),
                    studentId:student.id,
                    assessmentId:ctx.assessmentId,
                    teacherNote:''
                };
                appState.scores.push(rec);
            }

            rec.rawScore=raw;
            rec.percentage=percentage;
            rec.grade=grade;
            rec.absent=absent;
            rec.teacherNote=String(noteInput?.value||'');
            rec.updatedAt=new Date().toISOString();
            rec.updatedBy=currentUserId;

            writes.push(phase10SaveScoreRecordRemote(rec));
        });

        // Local cache is updated first, but "Disimpan" only appears after
        // Supabase has confirmed all writes.
        persistMarksState();
        const results=await Promise.all(writes);
        const allSaved=results.every(Boolean);

        if(!allSaved){
            showAlert(
                'Gagal Menyimpan',
                'Sebahagian markah belum berjaya dihantar ke Supabase. Nilai dikekalkan pada skrin supaya tidak hilang. Semak sambungan dan cuba Simpan sekali lagi.',
                'danger'
            );
            return;
        }

        logAudit('SAVE_MARKS_DATA',{classId:ctx.classId,assessmentId:ctx.assessmentId});
        showGlobalSaveSuccess();
        marksManualEditMode=false;
        renderMarksModule();
        refreshLiveMarksDependents();
    }

    function deleteCurrentMarksData(){
        const ctx=currentMarksContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','Data markah tidak boleh dipadam dalam skop ini.','danger');
            return;
        }
        const records=getActualScoreRecords().filter(s=>s.assessmentId===ctx.assessmentId);
        if(!records.length){
            showAlert('Tiada Data','Tiada data markah untuk dipadam.','info');
            return;
        }
        showAlert(
            'Padam Data Markah',
            `Padam semua data markah ${ctx.assessment?.name||'ujian'} bagi ${ctx.cls?.name||'kelas ini'}? Data murid tidak akan dipadam.`,
            'danger',
            ()=>{
                const ids=new Set(records.map(r=>r.id));
                appState.scores=appState.scores.filter(s=>!ids.has(s.id));
                records.forEach(r=>phase10Delete('scores',r.id));
                persistMarksState();
                logAudit('DELETE_MARKS_DATA',{classId:ctx.classId,assessmentId:ctx.assessmentId,count:records.length});
                marksManualEditMode=true;
                renderMarksModule();
                refreshLiveMarksDependents();
            }
        );
    }

    function handleScoreInput(studentId, assessmentId, inputEl, maxScore) {
        const assessmentGuard=appState.assessments.find(a=>a.id===assessmentId);
        if(assessmentGuard&&!isAssessmentEntryOpen('marks',assessmentGuard.type)){
            showAlert('Pengisian Ditutup',marksEntryClosedMessage(assessmentGuard.type),'info');
            renderMarksModule();
            return;
        }
        const statusIcon = document.getElementById(`status-${studentId}`);
        const gradeEl = document.getElementById(`grade-${studentId}`);
        
        let raw = inputEl.value === '' ? null : parseFloat(inputEl.value);
        
        // Basic Validation
        if (raw !== null && (raw < 0 || raw > maxScore)) {
            inputEl.classList.add('border-rose-500', 'bg-rose-50');
            statusIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 mx-auto"></i>';
            lucide.createIcons();
            return;
        } else {
            inputEl.classList.remove('border-rose-500', 'bg-rose-50');
        }

        // Real-time UI update
        statusIcon.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 text-blue-500 animate-spin mx-auto"></i>';
        lucide.createIcons();

        // Markah Sejarah is entered directly as a percentage (0–100).
        const percentage = raw===null ? null : Math.round(Number(raw));
        raw = percentage;
        const grade = calculateGrade(percentage);
        
        let gradeBadge = grade;
        if (['A', 'B', 'C'].includes(grade)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700">${grade}</span>`;
        else if (['D'].includes(grade)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-700">${grade}</span>`;
        else if (['E', 'F'].includes(grade)) gradeBadge = `<span class="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-700">${grade}</span>`;
        gradeEl.innerHTML = gradeBadge;

        // Debounce Save to Supabase
        const key = `${studentId}_${assessmentId}`;
        clearTimeout(saveTimeout[key]);
        
        saveTimeout[key] = setTimeout(async () => {
            const saved=await saveSingleScore(studentId, assessmentId, raw, percentage, grade, false);
            statusIcon.innerHTML=saved
                ? '<i data-lucide="check" class="w-4 h-4 text-emerald-500 mx-auto"></i>'
                : '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 mx-auto"></i>';
            if(saved)showGlobalSaveSuccess();
            lucide.createIcons();
            
            // Update stats immediately
            const classId = document.getElementById('filter-kelas').value;
            const students = sortStudentsAZ(appState.students.filter(s => s.classId === classId && s.status === 'Aktif'));
            const assessment = appState.assessments.find(a => a.id === assessmentId);
            updateMarksStats(students, assessment);
            refreshLiveMarksDependents();

        }, 600); // 600ms debounce
    }

    async function toggleAbsent(studentId, assessmentId, checkbox, maxScore) {
        const assessmentGuard=appState.assessments.find(a=>a.id===assessmentId);
        if(assessmentGuard&&!isAssessmentEntryOpen('marks',assessmentGuard.type)){
            showAlert('Pengisian Ditutup',marksEntryClosedMessage(assessmentGuard.type),'info');
            renderMarksModule();
            return;
        }
        const inputEl = document.querySelector(`input.score-input[data-student="${studentId}"]`);
        const isAbsent = checkbox.checked;
        const attendanceLabel=checkbox.closest('.marks-attendance-wrap')?.querySelector('.marks-attendance-label');
        if(attendanceLabel)attendanceLabel.textContent=isAbsent?'TH':'HADIR';
        
        if (isAbsent) {
            inputEl.value = '';
            inputEl.disabled = true;
            document.getElementById(`grade-${studentId}`).innerHTML = `<span class="px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-600">TH</span>`;
        } else {
            inputEl.disabled = false;
            // trigger recalculation based on empty input
            handleScoreInput(studentId, assessmentId, inputEl, maxScore);
            return; // handleScoreInput takes care of saving
        }

        const statusIcon = document.getElementById(`status-${studentId}`);
        statusIcon.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 text-blue-500 animate-spin mx-auto"></i>';
        lucide.createIcons();

        // Immediate Save for Boolean toggle — confirm Supabase first.
        const saved=await saveSingleScore(studentId, assessmentId, null, null, '-', true);
        statusIcon.innerHTML=saved
            ? '<i data-lucide="check" class="w-4 h-4 text-emerald-500 mx-auto"></i>'
            : '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-500 mx-auto"></i>';
        if(saved)showGlobalSaveSuccess();
        lucide.createIcons();
        
        const classId = document.getElementById('filter-kelas').value;
        const students = sortStudentsAZ(appState.students.filter(s => s.classId === classId && s.status === 'Aktif'));
        const assessment = appState.assessments.find(a => a.id === assessmentId);
        updateMarksStats(students, assessment);
        refreshLiveMarksDependents();
    }

    function handleNoteInput(studentId, assessmentId, inputEl) {
        const assessmentGuard=appState.assessments.find(a=>a.id===assessmentId);
        if(assessmentGuard&&!isAssessmentEntryOpen('marks',assessmentGuard.type)){
            showAlert('Pengisian Ditutup',marksEntryClosedMessage(assessmentGuard.type),'info');
            renderMarksModule();
            return;
        }
        const key = `note_${studentId}_${assessmentId}`;
        clearTimeout(saveTimeout[key]);
        saveTimeout[key] = setTimeout(async () => {
            let scoreRec = getActualScoreRecords().find(s => s.studentId === studentId && s.assessmentId === assessmentId);
            if (scoreRec) {
                scoreRec.teacherNote = inputEl.value;
            } else {
                // Creates placeholder score document if just note is added first
                appState.scores.push({
                    id: 'sc_' + Date.now(),
                    studentId, assessmentId, rawScore: null, percentage: null, grade: '-', absent: false, teacherNote: inputEl.value
                });
            }
            persistMarksState();
            const noteScore=getActualScoreRecords().find(s=>s.studentId===studentId&&s.assessmentId===assessmentId);
            const saved=noteScore?await phase10SaveScoreRecordRemote(noteScore):false;
            if(saved)showGlobalSaveSuccess();
            refreshLiveMarksDependents();
        }, 800);
    }
    async function saveSingleScore(studentId, assessmentId, rawScore, percentage, grade, absent) {
        let scoreRec=getActualScoreRecords().find(s=>s.studentId===studentId&&s.assessmentId===assessmentId);

        if(scoreRec){
            scoreRec.rawScore=rawScore;
            scoreRec.percentage=percentage;
            scoreRec.grade=grade;
            scoreRec.absent=absent;
            scoreRec.updatedAt=new Date().toISOString();
            scoreRec.updatedBy=currentUserId;
            logAudit('UPDATE_SCORE',{studentId,assessmentId,rawScore});
        }else{
            scoreRec={
                id:'sc_'+Date.now()+Math.random().toString(16).slice(2),
                studentId,
                assessmentId,
                rawScore,
                percentage,
                grade,
                absent,
                teacherNote:'',
                updatedAt:new Date().toISOString(),
                updatedBy:currentUserId
            };
            appState.scores.push(scoreRec);
            logAudit('CREATE_SCORE',{studentId,assessmentId,rawScore});
        }

        // Keep the entered value locally immediately.
        persistMarksState();

        // Only report success when Supabase actually confirms the upsert.
        return await phase10SaveScoreRecordRemote(scoreRec);
    }

    function refreshLiveMarksDependents() {
        // All modules calculate from the same appState.scores collection.
        if(typeof updateDashboardKPIs==='function')updateDashboardKPIs();
        if(typeof updateCharts==='function'&&chartGradesInstance&&chartTpInstance)updateCharts();

        if(typeof initializeMarksAnalytics==='function' &&
           !document.getElementById('view-analytics-marks')?.classList.contains('hidden')){
            initializeMarksAnalytics();
        }

        if(typeof renderHeadcount==='function' &&
           !document.getElementById('view-headcount')?.classList.contains('hidden')){
            renderHeadcount();
        }

        if(typeof renderStudentProfile==='function' &&
           !document.getElementById('view-student-profile')?.classList.contains('hidden')){
            renderStudentProfile();
        }
    }

    function showGlobalSaveSuccess() {
        const badge = document.getElementById('global-save-status');
        badge.classList.remove('opacity-0');
        setTimeout(() => {
            badge.classList.add('opacity-0');
        }, 2000);
    }

    // Keyboard Navigation (Spreadsheet style)
    function handleSpreadsheetNav(e, currentInput) {
        if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.score-input:not([disabled])'));
        const index = inputs.indexOf(currentInput);
        
        if (index > -1) {
            let nextIndex = index;
            if (e.key === 'Enter' || e.key === 'ArrowDown') nextIndex = index + 1;
            else if (e.key === 'ArrowUp') nextIndex = index - 1;
            
            if (nextIndex >= 0 && nextIndex < inputs.length) {
                inputs[nextIndex].focus();
                inputs[nextIndex].select();
            }
        }
    }

    // Copy Paste Support
    function handleScorePaste(e) {
        const activeEl = document.activeElement;
        if (!activeEl.classList.contains('score-input')) return;
        
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        
        // Parse rows, handling Windows \r\n and standard \n
        const rows = pasteData.split(/\r?\n/).filter(val => val.trim() !== '');
        
        const inputs = Array.from(document.querySelectorAll('.score-input:not([disabled])'));
        const startIndex = inputs.indexOf(activeEl);
        if (startIndex === -1) return;

        const assessmentId = document.getElementById('filter-assessment').value;
        const assessment = appState.assessments.find(a => a.id === assessmentId);
        let pastedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const targetIndex = startIndex + i;
            if (targetIndex >= inputs.length) break; // Out of bounds
            
            const rawValStr = rows[i].trim();
            const rawVal = parseFloat(rawValStr);
            const targetInput = inputs[targetIndex];
            
            if (!isNaN(rawVal) && rawVal >= 0 && rawVal <= assessment.maxScore) {
                targetInput.value = rawVal;
                // Programmatically trigger input handler to save and update UI
                handleScoreInput(targetInput.dataset.student, assessmentId, targetInput, assessment.maxScore);
                pastedCount++;
            } else {
                errorCount++;
                targetInput.classList.add('border-rose-500', 'bg-rose-50');
            }
        }
        
        if (errorCount > 0) {
            showAlert('Makluman Paste', `${pastedCount} markah berjaya dimasukkan. ${errorCount} nilai diabaikan kerana format tidak sah atau melebihi had.`, 'warning');
        } else if (pastedCount > 0) {
            logAudit('BULK_PASTE', { count: pastedCount, assessmentId });
        }
    }

    // Statistics Engine
    function updateMarksStats(students, assessment) {
        let filledCount=0,absentCount=0,masteryCount=0;
        const validScores=[];

        (students||[]).forEach(st=>{
            const sc=getActualScoreRecords().find(s=>s.studentId===st.id&&s.assessmentId===assessment?.id);
            if(!sc)return;
            if(sc.absent){absentCount++;return;}
            if(sc.rawScore!==null&&sc.rawScore!==undefined&&sc.percentage!==null&&sc.percentage!==undefined){
                filledCount++;
                validScores.push(Number(sc.percentage));
                if(isMasteredMark(sc.percentage))masteryCount++;
            }
        });

        const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
        set('stat-total',(students||[]).length);
        set('stat-filled',filledCount);
        set('stat-absent',absentCount);

        if(validScores.length){
            const sum=validScores.reduce((a,b)=>a+b,0);
            const avg=sum/validScores.length;
            const high=Math.max(...validScores);
            const low=Math.min(...validScores);
            const masteryRate=masteryCount/validScores.length*100;
            set('stat-avg',formatWholePercent(avg));
            set('stat-high',formatWholePercent(high));
            set('stat-low',formatWholePercent(low));
            set('stat-mastery',formatWholePercent(masteryRate));
        }else{
            set('stat-avg','0%');
            set('stat-high','0%');
            set('stat-low','0%');
            set('stat-mastery','0%');
        }
    }

    // Fixed assessment templates are generated automatically; no manual assessment creation is required.

    function exportMarksCSV() {
        const assessId = document.getElementById('filter-assessment').value;
        const assessment = appState.assessments.find(a => a.id === assessId);
        if (!assessment) {
            showAlert('Pilih Ujian', 'Sila pilih kelas dan ujian sebelum mengeksport markah.', 'info');
            return;
        }
        const classObj = appState.classes.find(c => c.id === assessment.classId);
        if (!classObj) {
            showAlert('Kelas Tidak Ditemui', 'Kelas untuk ujian ini tidak ditemui.', 'danger');
            return;
        }

        const students = sortStudentsAZ(appState.students.filter(s => s.classId === classObj.id && s.status === 'Aktif'));
        
        const headers = ["Nama Murid", "Kelas", "Ujian", "Markah Penuh", "Markah Diperoleh", "Peratus", "Gred", "Kehadiran", "Catatan"];
        let csvContent = headers.join(",") + "\n";

        students.forEach(st => {
            const sc = getActualScoreRecords().find(s => s.studentId === st.id && s.assessmentId === assessId) || {};
            const row = [
                `"${st.name}"`,
                `"${classObj.name}"`,
                `"${assessment.name}"`,
                assessment.maxScore,
                sc.absent ? '' : (sc.rawScore !== null && sc.rawScore !== undefined ? sc.rawScore : ''),
                sc.percentage !== null && sc.percentage !== undefined ? sc.percentage : '',
                sc.grade || '',
                sc.absent ? 'Tidak Hadir' : 'Hadir',
                `"${sc.teacherNote || ''}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        const safeName = assessment.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("download", `Markah_${safeName}_${classObj.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    // --- PHASE 4: DSKP & PBD MODULE ---

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getPermittedClassesForPbd() {
        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (currentUserRole === 'GURU_SEJARAH') {
            classes = classes.filter(c => c.teacherId === currentUserId);
        }
        return sortClassesCanonical(classes);
    }

    function canEditPbdClass(classId) {
        const cls = appState.classes.find(c => c.id === classId);
        if (!cls) return false;
        return currentUserRole === 'ADMIN' ||
               currentUserRole === 'KETUA_PANITIA' ||
               (currentUserRole === 'GURU_SEJARAH' && cls.teacherId === currentUserId);
    }

    function isPbdLocked(classId, period) {
        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        return appState.pbdLocks.some(l =>
            l.classId === classId &&
            l.academicYear === academicYear &&
            l.period === period &&
            l.locked === true
        );
    }

    function refreshLivePbdDependents() {
        if(typeof updateDashboardKPIs==='function')updateDashboardKPIs();
        if(typeof updateCharts==='function'&&chartGradesInstance&&chartTpInstance)updateCharts();

        if(typeof renderPbdAnalytics==='function' &&
           !document.getElementById('view-analytics-pbd')?.classList.contains('hidden')){
            renderPbdAnalytics();
        }
        if(typeof renderStudentProfile==='function' &&
           !document.getElementById('view-analytics-student')?.classList.contains('hidden')){
            renderStudentProfile();
        }
        if(typeof renderClassComparison==='function' &&
           !document.getElementById('view-analytics-class')?.classList.contains('hidden')){
            renderClassComparison();
        }
    }

    function showPbdSaveState(message, mode = 'saving') {
        const el = document.getElementById('pbd-global-save-status');
        if (!el) return;
        const span = el.querySelector('span');
        if (span) span.textContent = message;
        el.classList.remove('opacity-0', 'text-slate-400', 'text-emerald-600', 'text-rose-600', 'text-amber-600');
        el.classList.add(mode === 'error' ? 'text-rose-600' : mode === 'saved' ? 'text-emerald-600' : 'text-amber-600');
        clearTimeout(showPbdSaveState._hideTimer);
        showPbdSaveState._hideTimer = setTimeout(() => el.classList.add('opacity-0'), mode === 'error' ? 3500 : 1800);
    }

    function renderDskp() {
        const tbody = document.getElementById('dskp-table-body');
        if (!tbody) return;

        const search = (document.getElementById('dskp-search')?.value || '').trim().toLowerCase();
        const year = document.getElementById('dskp-year-filter')?.value || 'ALL';
        const activeFilter = document.getElementById('dskp-active-filter')?.value || 'ACTIVE';

        let rows = appState.dskp.filter(d => {
            if (year !== 'ALL' && String(d.yearLevel) !== year) return false;
            if (activeFilter === 'ACTIVE' && !d.active) return false;
            if (activeFilter === 'INACTIVE' && d.active) return false;
            if (search) {
                const haystack = [
                    d.themeName, d.unitName, d.standardContentCode, d.standardContentText,
                    d.standardLearningCode, d.standardLearningText
                ].join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        }).sort((a,b) =>
            a.yearLevel - b.yearLevel ||
            String(a.themeName).localeCompare(String(b.themeName)) ||
            String(a.unitName).localeCompare(String(b.unitName)) ||
            String(a.standardLearningCode).localeCompare(String(b.standardLearningCode))
        );

        tbody.innerHTML = '';
        rows.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/70';
            tr.innerHTML = `
                <td class="px-4 py-3 align-top"><span class="px-2 py-1 rounded bg-navy-50 text-navy-800 font-bold text-xs">Tahun ${d.yearLevel}</span></td>
                <td class="px-4 py-3 align-top">
                    <p class="font-bold text-slate-800">${escapeHtml(d.themeName)}</p>
                    <p class="text-xs text-slate-500 mt-1">${escapeHtml(d.unitName)}</p>
                </td>
                <td class="px-4 py-3 align-top">
                    <p class="font-bold text-emerald-700">${escapeHtml(d.standardContentCode)}</p>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">${escapeHtml(d.standardContentText)}</p>
                </td>
                <td class="px-4 py-3 align-top">
                    <p class="font-bold text-blue-700">${escapeHtml(d.standardLearningCode)}</p>
                    <p class="text-xs text-slate-600 mt-1 leading-relaxed">${escapeHtml(d.standardLearningText)}</p>
                </td>
                <td class="px-4 py-3 align-top">
                    ${d.active
                        ? '<span class="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">AKTIF</span>'
                        : '<span class="px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">TIDAK AKTIF</span>'}
                </td>
                <td class="px-4 py-3 align-top text-right">
                    <button onclick="editDskpRecord('${d.id}')" class="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50" title="Kemaskini">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });

        const empty = document.getElementById('dskp-empty-state');
        if (rows.length === 0) empty.classList.remove('hidden');
        else empty.classList.add('hidden');

        document.getElementById('dskp-count').textContent = `${rows.length} rekod dipaparkan`;
        const canManage = currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA';
        const addBtn = document.getElementById('btn-add-dskp');
        if (addBtn) {
            addBtn.disabled = !canManage;
            addBtn.classList.toggle('opacity-50', !canManage);
            addBtn.classList.toggle('cursor-not-allowed', !canManage);
        }
        lucide.createIcons();
    }

    function openDskpModal() {
        if (!(currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA')) {
            showAlert('Tiada Kebenaran', 'Hanya Admin atau Ketua Panitia dibenarkan mengurus kandungan DSKP.', 'danger');
            return;
        }
        document.getElementById('form-dskp-id').value = '';
        document.getElementById('form-dskp-year').value = document.getElementById('filter-tahun').value !== 'ALL' ? document.getElementById('filter-tahun').value : '4';
        ['theme','unit','sk-code','sk-text','sp-code','sp-text'].forEach(k => document.getElementById(`form-dskp-${k}`).value = '');
        [1,2,3,4,5,6].forEach(tp => document.getElementById(`form-dskp-tp${tp}`).value = '');
        document.getElementById('form-dskp-active').checked = true;
        document.getElementById('modal-dskp-title').textContent = 'Tambah Rekod DSKP';
        document.getElementById('btn-deactivate-dskp').classList.add('hidden');
        const modal = document.getElementById('modal-dskp');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function editDskpRecord(id) {
        const d = appState.dskp.find(x => x.id === id);
        if (!d) return;
        if (!(currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA')) {
            showAlert('Akses Baca Sahaja', 'Guru Sejarah boleh melihat DSKP tetapi tidak mengubah rekod ini.', 'info');
            return;
        }
        document.getElementById('form-dskp-id').value = d.id;
        document.getElementById('form-dskp-year').value = d.yearLevel;
        document.getElementById('form-dskp-theme').value = d.themeName || '';
        document.getElementById('form-dskp-unit').value = d.unitName || '';
        document.getElementById('form-dskp-sk-code').value = d.standardContentCode || '';
        document.getElementById('form-dskp-sk-text').value = d.standardContentText || '';
        document.getElementById('form-dskp-sp-code').value = d.standardLearningCode || '';
        document.getElementById('form-dskp-sp-text').value = d.standardLearningText || '';
        [1,2,3,4,5,6].forEach(tp => document.getElementById(`form-dskp-tp${tp}`).value = d.performanceStandards?.[tp] || '');
        document.getElementById('form-dskp-active').checked = d.active !== false;
        document.getElementById('modal-dskp-title').textContent = 'Kemaskini Rekod DSKP';
        document.getElementById('btn-deactivate-dskp').classList.toggle('hidden', d.active === false);
        const modal = document.getElementById('modal-dskp');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function closeDskpModal() {
        const modal = document.getElementById('modal-dskp');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function saveDskpRecord() {
        const id = document.getElementById('form-dskp-id').value;
        const yearLevel = Number(document.getElementById('form-dskp-year').value);
        const themeName = document.getElementById('form-dskp-theme').value.trim();
        const unitName = document.getElementById('form-dskp-unit').value.trim();
        const standardContentCode = document.getElementById('form-dskp-sk-code').value.trim();
        const standardContentText = document.getElementById('form-dskp-sk-text').value.trim();
        const standardLearningCode = document.getElementById('form-dskp-sp-code').value.trim();
        const standardLearningText = document.getElementById('form-dskp-sp-text').value.trim();

        if (![4,5,6].includes(yearLevel) || !themeName || !unitName || !standardContentCode || !standardContentText || !standardLearningCode || !standardLearningText) {
            showAlert('Ralat Pengisian', 'Sila lengkapkan Tahun, Tema, Unit, SK dan SP yang wajib.', 'danger');
            return;
        }

        const duplicate = appState.dskp.find(d =>
            d.id !== id &&
            d.yearLevel === yearLevel &&
            d.standardLearningCode.toLowerCase() === standardLearningCode.toLowerCase()
        );
        if (duplicate) {
            showAlert('Rekod Pendua', `Kod SP ${standardLearningCode} sudah wujud bagi Tahun ${yearLevel}.`, 'danger');
            return;
        }

        const performanceStandards = {};
        [1,2,3,4,5,6].forEach(tp => performanceStandards[tp] = document.getElementById(`form-dskp-tp${tp}`).value.trim());

        const record = {
            id: id || 'd_' + Date.now(),
            subject: 'SEJARAH',
            yearLevel,
            themeName,
            unitName,
            standardContentCode,
            standardContentText,
            standardLearningCode,
            standardLearningText,
            performanceStandards,
            active: document.getElementById('form-dskp-active').checked,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserId
        };

        if (id) {
            const idx = appState.dskp.findIndex(d => d.id === id);
            if (idx >= 0) appState.dskp[idx] = { ...appState.dskp[idx], ...record };
            logAudit('UPDATE_DSKP', { dskpId: id, standardLearningCode });
        } else {
            appState.dskp.push(record);
            logAudit('CREATE_DSKP', { dskpId: record.id, standardLearningCode });
        }

        persistPhase4State();
        closeDskpModal();
        renderDskp();
        initializePbdModule(true);
        showAlert('Berjaya', 'Rekod DSKP telah disimpan.', 'success');
    }

    function deactivateDskpConfirm() {
        const id = document.getElementById('form-dskp-id').value;
        const d = appState.dskp.find(x => x.id === id);
        if (!d) return;
        const linked = appState.pbdRecords.filter(r => r.dskpId === id).length;
        showAlert(
            'Nyahaktif Rekod DSKP',
            linked > 0
                ? `Rekod ini mempunyai ${linked} rekod PBD berkaitan. Ia tidak akan dipadam, hanya dinyahaktifkan.`
                : 'Rekod ini akan dinyahaktifkan dan tidak lagi muncul dalam pilihan PBD.',
            'info',
            () => {
                d.active = false;
                d.updatedAt = new Date().toISOString();
                logAudit('DEACTIVATE_DSKP', { dskpId: id, linkedRecords: linked });
                persistPhase4State();
                closeDskpModal();
                renderDskp();
                initializePbdModule(true);
            }
        );
    }

    function openDskpImportModal() {
        if (!(currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA')) {
            showAlert('Tiada Kebenaran', 'Import DSKP hanya dibenarkan untuk Admin atau Ketua Panitia.', 'danger');
            return;
        }
        pendingDskpImport = [];
        document.getElementById('dskp-import-file').value = '';
        document.getElementById('dskp-import-summary').classList.add('hidden');
        document.getElementById('dskp-import-preview-wrap').classList.add('hidden');
        document.getElementById('btn-confirm-dskp-import').disabled = true;
        document.getElementById('dskp-import-preview').innerHTML = '';
        const modal = document.getElementById('modal-dskp-import');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function closeDskpImportModal() {
        const modal = document.getElementById('modal-dskp-import');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function parseCsvRows(text) {
        const rows = [];
        let row = [], field = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
                if (inQuotes && text[i+1] === '"') { field += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                row.push(field); field = '';
            } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && text[i+1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(v => String(v).trim() !== '')) rows.push(row);
                row = [];
            } else field += ch;
        }
        row.push(field);
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        if (rows.length < 2) return [];
        const headers = rows[0].map(h => String(h).trim());
        return rows.slice(1).map(vals => Object.fromEntries(headers.map((h,i) => [h, vals[i] ?? ''])));
    }

    function normalizeImportKey(key) {
        return String(key || '').toLowerCase().trim().replace(/[._\-\/]/g, ' ').replace(/\s+/g, ' ');
    }

    function getImportValue(row, aliases) {
        const keys = Object.keys(row);
        for (const alias of aliases) {
            const wanted = normalizeImportKey(alias);
            const found = keys.find(k => normalizeImportKey(k) === wanted);
            if (found !== undefined) return String(row[found] ?? '').trim();
        }
        return '';
    }

    function normalizeDskpImportRows(rawRows) {
        const seenPending = new Set();
        return rawRows.map((row, index) => {
            const yearLevel = Number(getImportValue(row, ['Tahun', 'Year', 'Year Level']));
            const themeName = getImportValue(row, ['Tema', 'Theme']);
            const unitName = getImportValue(row, ['Unit', 'Tajuk Unit']);
            const standardContentCode = getImportValue(row, ['Kod SK', 'SK', 'Standard Kandungan Kod']);
            const standardContentText = getImportValue(row, ['Standard Kandungan', 'Teks SK']);
            const standardLearningCode = getImportValue(row, ['Kod SP', 'SP', 'Standard Pembelajaran Kod']);
            const standardLearningText = getImportValue(row, ['Standard Pembelajaran', 'Teks SP']);
            const performanceStandards = {};
            [1,2,3,4,5,6].forEach(tp => performanceStandards[tp] = getImportValue(row, [`TP${tp}`, `TP ${tp}`]));

            const key = `${yearLevel}|${standardLearningCode.toLowerCase()}`;
            const duplicateExisting = appState.dskp.some(d => d.yearLevel === yearLevel && d.standardLearningCode.toLowerCase() === standardLearningCode.toLowerCase());
            const duplicatePending = seenPending.has(key);
            const missing = ![4,5,6].includes(yearLevel) || !themeName || !unitName || !standardContentCode || !standardContentText || !standardLearningCode || !standardLearningText;
            if (!missing && !duplicateExisting && !duplicatePending) seenPending.add(key);

            return {
                rowNumber: index + 2,
                valid: !missing && !duplicateExisting && !duplicatePending,
                error: missing ? 'Medan wajib tidak lengkap' : duplicateExisting ? 'SP telah wujud' : duplicatePending ? 'Pendua dalam fail' : '',
                record: {
                    id: 'd_' + Date.now() + '_' + index,
                    subject: 'SEJARAH', yearLevel, themeName, unitName,
                    standardContentCode, standardContentText, standardLearningCode, standardLearningText,
                    performanceStandards, active: true, updatedAt: new Date().toISOString(), updatedBy: currentUserId
                }
            };
        });
    }

    function handleDskpImportFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        reader.onerror = () => showAlert('Import Gagal', 'Fail tidak dapat dibaca.', 'danger');

        reader.onload = (e) => {
            try {
                let rawRows = [];
                if (ext === 'csv') {
                    rawRows = parseCsvRows(String(e.target.result || ''));
                } else {
                    if (typeof XLSX === 'undefined') throw new Error('Library XLSX belum dimuatkan.');
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                }
                pendingDskpImport = normalizeDskpImportRows(rawRows);
                renderDskpImportPreview();
            } catch (err) {
                console.error(err);
                showAlert('Import Gagal', `Format fail tidak dapat diproses: ${err.message}`, 'danger');
            }
        };

        if (ext === 'csv') reader.readAsText(file, 'utf-8');
        else reader.readAsArrayBuffer(file);
    }

    function renderDskpImportPreview() {
        const total = pendingDskpImport.length;
        const valid = pendingDskpImport.filter(r => r.valid).length;
        const invalid = total - valid;
        document.getElementById('dskp-import-total').textContent = total;
        document.getElementById('dskp-import-valid').textContent = valid;
        document.getElementById('dskp-import-invalid').textContent = invalid;
        document.getElementById('dskp-import-summary').classList.remove('hidden');
        document.getElementById('dskp-import-preview-wrap').classList.remove('hidden');
        document.getElementById('btn-confirm-dskp-import').disabled = valid === 0;

        const body = document.getElementById('dskp-import-preview');
        body.innerHTML = '';
        pendingDskpImport.slice(0, 80).forEach(item => {
            const d = item.record;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${item.valid
                    ? '<span class="text-emerald-700 font-bold">SAH</span>'
                    : `<span class="text-rose-700 font-bold" title="${escapeHtml(item.error)}">RALAT</span>`}</td>
                <td class="px-3 py-2">Tahun ${d.yearLevel || '-'}</td>
                <td class="px-3 py-2"><strong>${escapeHtml(d.themeName)}</strong><br><span class="text-slate-500">${escapeHtml(d.unitName)}</span></td>
                <td class="px-3 py-2">${escapeHtml(d.standardContentCode)}</td>
                <td class="px-3 py-2">${escapeHtml(d.standardLearningCode)}</td>`;
            body.appendChild(tr);
        });
    }

    function confirmDskpImport() {
        const validRows = pendingDskpImport.filter(r => r.valid);
        if (!validRows.length) return;
        appState.dskp.push(...validRows.map(r => r.record));
        logAudit('IMPORT_DSKP', { imported: validRows.length, rejected: pendingDskpImport.length - validRows.length });
        persistPhase4State();
        closeDskpImportModal();
        renderDskp();
        initializePbdModule(true);
        showAlert('Import Berjaya', `${validRows.length} rekod DSKP telah ditambah.`, 'success');
    }

    function initializePbdModule(preserveCurrent = false) {
        const pbdLockBtn = document.getElementById('btn-pbd-lock'); if (pbdLockBtn) pbdLockBtn.classList.toggle('hidden', !isAdminSession());
        const yearEl = document.getElementById('pbd-year');
        if (!yearEl) return;

        const globalYearLevel = document.getElementById('filter-tahun')?.value;
        if (!preserveCurrent || !yearEl.value) {
            if (globalYearLevel && globalYearLevel !== 'ALL') yearEl.value = globalYearLevel;
            else {
                const firstClass = getPermittedClassesForPbd()[0];
                yearEl.value = firstClass ? String(firstClass.year) : '4';
            }
        }

        populatePbdPeriodOptions();
        onPbdYearChange(preserveCurrent);

        const globalClassId = document.getElementById('filter-kelas')?.value;
        if (globalClassId && globalClassId !== 'ALL') {
            const cls = getPermittedClassesForPbd().find(c => c.id === globalClassId && String(c.year) === yearEl.value);
            if (cls) document.getElementById('pbd-class').value = cls.id;
        }
        renderPbdModule();
    }

    function populatePbdPeriodOptions() {
        const select = document.getElementById('pbd-period');
        if (!select) return;
        const current = select.value || 'PERTENGAHAN';
        select.innerHTML = appState.pbdPeriods.filter(p => p.active).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        if (appState.pbdPeriods.some(p => p.id === current && p.active)) select.value = current;
    }

    function onPbdYearChange(preserve = false) {
        const year = Number(document.getElementById('pbd-year').value);
        const classSelect = document.getElementById('pbd-class');
        const prevClass = preserve ? classSelect.value : '';
        const classes = getPermittedClassesForPbd().filter(c => c.year === year);
        classSelect.innerHTML = classes.length
            ? '<option value="">Pilih Kelas</option>' + classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
            : '<option value="">Tiada Kelas</option>';
        if (classes.some(c => c.id === prevClass)) classSelect.value = prevClass;
        else if (classes.length === 1) classSelect.value = classes[0].id;

        populatePbdThemeOptions(preserve);
    }

    function populatePbdThemeOptions(preserve = false) {
        const year = Number(document.getElementById('pbd-year').value);
        const select = document.getElementById('pbd-theme');
        const prev = preserve ? select.value : '';
        const themes = [...new Set(appState.dskp.filter(d => d.active && d.yearLevel === year).map(d => d.themeName))];
        select.innerHTML = '<option value="">Pilih Tema</option>' + themes.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        if (themes.includes(prev)) select.value = prev;
        else if (themes.length === 1) select.value = themes[0];
        onPbdThemeChange(preserve);
    }

    function onPbdThemeChange(preserve = false) {
        const year = Number(document.getElementById('pbd-year').value);
        const theme = document.getElementById('pbd-theme').value;
        const select = document.getElementById('pbd-unit');
        const prev = preserve ? select.value : '';
        const units = [...new Set(appState.dskp.filter(d => d.active && d.yearLevel === year && d.themeName === theme).map(d => d.unitName))];
        select.innerHTML = '<option value="">Pilih Unit</option>' + units.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        if (units.includes(prev)) select.value = prev;
        else if (units.length === 1) select.value = units[0];
        onPbdUnitChange(preserve);
    }

    function onPbdUnitChange(preserve = false) {
        const year = Number(document.getElementById('pbd-year').value);
        const theme = document.getElementById('pbd-theme').value;
        const unit = document.getElementById('pbd-unit').value;
        const select = document.getElementById('pbd-sk');
        const prev = preserve ? select.value : '';
        const matching = appState.dskp.filter(d => d.active && d.yearLevel === year && d.themeName === theme && d.unitName === unit);
        const sks = [...new Map(matching.map(d => [d.standardContentCode, `${d.standardContentCode} — ${d.standardContentText}`])).entries()];
        select.innerHTML = '<option value="">Pilih SK</option>' + sks.map(([code,label]) => `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`).join('');
        if (sks.some(([code]) => code === prev)) select.value = prev;
        else if (sks.length === 1) select.value = sks[0][0];
        onPbdSkChange(preserve);
    }

    function onPbdSkChange(preserve = false) {
        const year = Number(document.getElementById('pbd-year').value);
        const theme = document.getElementById('pbd-theme').value;
        const unit = document.getElementById('pbd-unit').value;
        const sk = document.getElementById('pbd-sk').value;
        const select = document.getElementById('pbd-sp');
        const prev = preserve ? select.value : '';
        const sps = appState.dskp.filter(d => d.active && d.yearLevel === year && d.themeName === theme && d.unitName === unit && d.standardContentCode === sk);
        select.innerHTML = '<option value="">Pilih SP</option>' + sps.map(d => `<option value="${d.id}">${escapeHtml(d.standardLearningCode)} — ${escapeHtml(d.standardLearningText)}</option>`).join('');
        if (sps.some(d => d.id === prev)) select.value = prev;
        else if (sps.length === 1) select.value = sps[0].id;
        renderPbdModule();
    }

    function getCurrentPbdContext() {
        const classId = document.getElementById('pbd-class')?.value || '';
        const dskpId = document.getElementById('pbd-sp')?.value || '';
        const period = document.getElementById('pbd-period')?.value || 'PERTENGAHAN';
        const dskp = appState.dskp.find(d => d.id === dskpId);
        const classObj = appState.classes.find(c => c.id === classId);
        return { classId, dskpId, period, dskp, classObj };
    }

    function renderPbdModule() {
        const empty = document.getElementById('pbd-selection-empty');
        const workspace = document.getElementById('pbd-workspace');
        if (!empty || !workspace) return;

        const { classId, dskpId, period, dskp, classObj } = getCurrentPbdContext();
        if (!classId || !dskpId || !dskp || !classObj) {
            empty.classList.remove('hidden');
            workspace.classList.add('hidden');
            updatePbdLockUi();
            return;
        }

        if (!getPermittedClassesForPbd().some(c => c.id === classId)) {
            empty.classList.remove('hidden');
            workspace.classList.add('hidden');
            showAlert('Tiada Kebenaran', 'Anda tidak mempunyai akses ke kelas yang dipilih.', 'danger');
            return;
        }

        empty.classList.add('hidden');
        workspace.classList.remove('hidden');
        document.getElementById('pbd-selected-sp-code').textContent = dskp.standardLearningCode;
        document.getElementById('pbd-selected-sp-text').textContent = dskp.standardLearningText;
        document.getElementById('pbd-selected-path').textContent = `Tahun ${dskp.yearLevel} · ${dskp.themeName} · ${dskp.unitName} · ${dskp.standardContentCode}`;

        updatePbdLockUi();
        renderPbdRows();
        updatePbdStats();
        updateDashboardKPIs();
        if (chartTpInstance) {
            chartTpInstance.data.datasets[0].data = getDashboardPbdDistribution();
            chartTpInstance.update();
        }
        lucide.createIcons();
    }

    function getStudentsForCurrentPbd() {
        const { classId } = getCurrentPbdContext();
        return sortStudentsAZ(appState.students.filter(s => s.classId === classId && s.status === 'Aktif'));
    }

    function getPbdRecord(studentId, dskpId, period) {
        return appState.pbdRecords.find(r => r.studentId === studentId && r.dskpId === dskpId && r.assessmentPeriod === period);
    }

    function getOverallTpRecord(studentId, period) {
        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        return appState.pbdOverall.find(r => r.studentId === studentId && r.academicYear === academicYear && r.assessmentPeriod === period);
    }

    function tpButtonClass(tp, selected, disabled) {
        const base = 'px-2.5 py-1.5 rounded-md text-xs font-black border transition-all ';
        if (disabled) return base + 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed';
        if (selected) {
            const colors = {
                1:'bg-rose-600 text-white border-rose-600',
                2:'bg-orange-500 text-white border-orange-500',
                3:'bg-amber-500 text-white border-amber-500',
                4:'bg-blue-600 text-white border-blue-600',
                5:'bg-emerald-600 text-white border-emerald-600',
                6:'bg-purple-600 text-white border-purple-600'
            };
            return base + colors[tp];
        }
        return base + 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50';
    }

    function recordStatusBadge(studentId, record) {
        if (!record || !record.tp) return '<span class="text-[10px] font-bold text-amber-700">Belum Direkod</span>';
        return `<span class="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Disimpan</span>`;
    }

    function buildTpButtons(studentId, currentTp, disabled) {
        return [1,2,3,4,5,6].map(tp =>
            `<button type="button" ${disabled ? 'disabled' : ''} onclick="setPbdTp('${studentId}', ${tp})" title="Tetapkan TP${tp}" class="${tpButtonClass(tp, currentTp === tp, disabled)}">TP${tp}</button>`
        ).join('');
    }

    function renderPbdRows() {
        const tbody = document.getElementById('pbd-table-body');
        const mobile = document.getElementById('pbd-mobile-list');
        const empty = document.getElementById('pbd-empty-state');
        if (!tbody || !mobile || !empty) return;

        const { classId, dskpId, period } = getCurrentPbdContext();
        if (!classId || !dskpId) return;

        const search = (document.getElementById('pbd-search')?.value || '').trim().toLowerCase();
        const locked = isPbdLocked(classId, period);
        const canEdit = canEditPbdClass(classId) && !locked;

        let students = getStudentsForCurrentPbd();
        students = students.filter(st => {
            if (search && !st.name.toLowerCase().includes(search)) return false;
            const rec = getPbdRecord(st.id, dskpId, period);
            if (pbdQuickFilter === 'MISSING' && rec?.tp) return false;
            if (/^[1-6]$/.test(pbdQuickFilter) && Number(rec?.tp) !== Number(pbdQuickFilter)) return false;
            return true;
        });

        tbody.innerHTML = '';
        mobile.innerHTML = '';

        if (students.length === 0) {
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
        }

        const today = new Date().toISOString().slice(0,10);

        students.forEach((student, index) => {
            const rec = getPbdRecord(student.id, dskpId, period);
            const overall = getOverallTpRecord(student.id, period);
            const selected = selectedPbdStudents.has(student.id);
            const evidence = rec?.evidence || '';
            const note = rec?.teacherNote || '';
            const date = rec?.assessmentDate || today;

            const tr = document.createElement('tr');
            tr.className = selected ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="px-3 py-3 text-center align-top">
                    <input type="checkbox" class="pbd-row-checkbox rounded border-slate-300 text-blue-600" value="${student.id}" ${selected ? 'checked' : ''} onchange="togglePbdStudentSelection(this)">
                </td>
                <td class="px-3 py-3 align-top sticky left-0 ${selected ? 'bg-blue-50' : 'bg-white'} z-10 border-r border-slate-100">
                    <button onclick="openPbdHistory('${student.id}')" class="font-bold text-slate-800 hover:text-emerald-700 text-left">${escapeHtml(student.name)}</button>
                    <p class="text-[10px] text-slate-400 mt-0.5">Murid ${index + 1}</p>
                </td>
                <td class="px-3 py-3 align-top"><div class="flex flex-wrap gap-1.5">${buildTpButtons(student.id, Number(rec?.tp || 0), !canEdit)}</div></td>
                <td class="px-3 py-3 align-top">
                    <select ${!canEdit ? 'disabled' : ''} onchange="updatePbdField('${student.id}','evidence',this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">
                        <option value="">— Pilih —</option>
                        ${['Pemerhatian','Lisan','Bertulis','Kuiz','Latihan','Projek','Pembentangan','Lain-lain'].map(v => `<option value="${v}" ${evidence===v?'selected':''}>${v}</option>`).join('')}
                    </select>
                </td>
                <td class="px-3 py-3 align-top">
                    <input ${!canEdit ? 'disabled' : ''} value="${escapeHtml(note)}" oninput="updatePbdField('${student.id}','teacherNote',this.value,true)" type="text" placeholder="Catatan ringkas..." class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">
                </td>
                <td class="px-3 py-3 align-top">
                    <input ${!canEdit ? 'disabled' : ''} value="${date}" onchange="updatePbdField('${student.id}','assessmentDate',this.value)" type="date" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">
                </td>
                <td class="px-3 py-3 align-top">
                    <button onclick="openOverallTpModal('${student.id}')" class="px-2.5 py-1.5 rounded-lg border ${overall?.overallTP ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-slate-600 border-slate-200'} text-xs font-bold hover:bg-purple-50">
                        ${overall?.overallTP ? `TP${overall.overallTP}` : 'Tetapkan'}
                    </button>
                </td>
                <td class="px-3 py-3 align-top">${recordStatusBadge(student.id, rec)}</td>
                <td class="px-3 py-3 align-top text-right">
                    <button onclick="openPbdHistory('${student.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Sejarah PBD"><i data-lucide="history" class="w-4 h-4"></i></button>
                </td>`;
            tbody.appendChild(tr);

            const card = document.createElement('div');
            card.className = 'p-4 space-y-3';
            card.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <label class="flex items-start gap-3 min-w-0">
                        <input type="checkbox" value="${student.id}" ${selected ? 'checked' : ''} onchange="togglePbdStudentSelection(this)" class="pbd-row-checkbox mt-1 rounded border-slate-300 text-blue-600">
                        <span class="min-w-0">
                            <button type="button" onclick="openPbdHistory('${student.id}')" class="text-left font-bold text-slate-900 leading-tight">${escapeHtml(student.name)}</button>
                            <span class="block text-[10px] text-slate-400 mt-1">${recordStatusBadge(student.id, rec)}</span>
                        </span>
                    </label>
                    <button onclick="openOverallTpModal('${student.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg border ${overall?.overallTP ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'} text-xs font-bold">
                        ${overall?.overallTP ? `Keseluruhan TP${overall.overallTP}` : 'TP Keseluruhan'}
                    </button>
                </div>
                <div>
                    <p class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">Tahap Penguasaan</p>
                    <div class="grid grid-cols-3 gap-2">${buildTpButtons(student.id, Number(rec?.tp || 0), !canEdit)}</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <select ${!canEdit ? 'disabled' : ''} onchange="updatePbdField('${student.id}','evidence',this.value)" class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">
                        <option value="">Evidens</option>
                        ${['Pemerhatian','Lisan','Bertulis','Kuiz','Latihan','Projek','Pembentangan','Lain-lain'].map(v => `<option value="${v}" ${evidence===v?'selected':''}>${v}</option>`).join('')}
                    </select>
                    <input ${!canEdit ? 'disabled' : ''} value="${date}" onchange="updatePbdField('${student.id}','assessmentDate',this.value)" type="date" class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">
                </div>
                <input ${!canEdit ? 'disabled' : ''} value="${escapeHtml(note)}" oninput="updatePbdField('${student.id}','teacherNote',this.value,true)" type="text" placeholder="Catatan guru..." class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50">`;
            mobile.appendChild(card);
        });

        updatePbdBulkUi();
        lucide.createIcons();
    }

    function ensurePbdRecord(studentId) {
        const { classId, dskpId, period, classObj } = getCurrentPbdContext();
        let rec = getPbdRecord(studentId, dskpId, period);
        if (rec) return rec;
        const now = new Date().toISOString();
        rec = {
            id: `pbd_${studentId}_${dskpId}_${period}`,
            studentId,
            dskpId,
            schoolId: 'MATTARY',
            academicYear: document.getElementById('filter-academic-year')?.value || '2026',
            classId,
            teacherId: currentUserId,
            assessmentPeriod: period,
            tp: null,
            assessmentDate: new Date().toISOString().slice(0,10),
            evidence: '',
            teacherNote: '',
            createdAt: now,
            updatedAt: now,
            createdBy: currentUserId,
            yearLevel: classObj?.year
        };
        appState.pbdRecords.push(rec);
        return rec;
    }

    function assertPbdWritable() {
        const { classId, period } = getCurrentPbdContext();
        if (!canEditPbdClass(classId)) {
            showAlert('Tiada Kebenaran', 'Anda tidak mempunyai kebenaran untuk mengubah PBD kelas ini.', 'danger');
            return false;
        }
        if (isPbdLocked(classId, period)) {
            showAlert('PBD Dikunci', 'Tempoh PBD ini telah dikunci dan tidak boleh diubah.', 'danger');
            return false;
        }
        return true;
    }

    function setPbdTp(studentId, tp) {
        if (![1,2,3,4,5,6].includes(Number(tp)) || !assertPbdWritable()) return;
        const rec = ensurePbdRecord(studentId);
        const previousTP = rec.tp;
        rec.tp = Number(tp);
        rec.teacherId = currentUserId;
        rec.updatedAt = new Date().toISOString();
        rec.updatedBy = currentUserId;
        logAudit(previousTP ? 'UPDATE_PBD' : 'CREATE_PBD', {
            pbdRecordId: rec.id, studentId, dskpId: rec.dskpId, previousTP, newTP: rec.tp, period: rec.assessmentPeriod
        });
        showPbdSaveState('Sedang menyimpan...', 'saving');
        persistPhase4State();
        setTimeout(() => showPbdSaveState('✓ Disimpan', 'saved'), 250);
        renderPbdRows();
        updatePbdStats();
        updateDashboardKPIs();
    }

    function updatePbdField(studentId, field, value, debounce = false) {
        if (!assertPbdWritable()) return;
        const rec = ensurePbdRecord(studentId);
        const commit = () => {
            rec[field] = value;
            rec.updatedAt = new Date().toISOString();
            rec.updatedBy = currentUserId;
            logAudit('UPDATE_PBD', { pbdRecordId: rec.id, studentId, field });
            persistPhase4State();
            showPbdSaveState('✓ Disimpan', 'saved');
        };
        showPbdSaveState('Sedang menyimpan...', 'saving');
        if (debounce) {
            clearTimeout(pbdSaveTimeouts[`${studentId}_${field}`]);
            pbdSaveTimeouts[`${studentId}_${field}`] = setTimeout(commit, 650);
        } else {
            commit();
        }
    }

    function setPbdQuickFilter(filter) {
        pbdQuickFilter = String(filter);
        document.querySelectorAll('.pbd-quick-filter').forEach(btn => {
            const active = btn.dataset.pbdFilter === pbdQuickFilter;
            btn.className = active
                ? 'pbd-quick-filter px-3 py-1.5 rounded-lg text-xs font-bold bg-navy-900 text-white whitespace-nowrap'
                : 'pbd-quick-filter px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 whitespace-nowrap';
        });
        renderPbdRows();
    }

    function togglePbdStudentSelection(checkbox) {
        if (checkbox.checked) selectedPbdStudents.add(checkbox.value);
        else selectedPbdStudents.delete(checkbox.value);
        document.querySelectorAll(`.pbd-row-checkbox[value="${checkbox.value}"]`).forEach(cb => cb.checked = checkbox.checked);
        updatePbdBulkUi();
    }

    function toggleSelectAllPbd(checkbox) {
        const visibleIds = [...document.querySelectorAll('#pbd-table-body .pbd-row-checkbox')].map(cb => cb.value);
        visibleIds.forEach(id => checkbox.checked ? selectedPbdStudents.add(id) : selectedPbdStudents.delete(id));
        renderPbdRows();
    }

    function clearPbdSelection() {
        selectedPbdStudents.clear();
        const selectAll = document.getElementById('pbd-select-all');
        if (selectAll) selectAll.checked = false;
        renderPbdRows();
    }

    function updatePbdBulkUi() {
        const bar = document.getElementById('pbd-bulk-bar');
        if (!bar) return;
        document.getElementById('pbd-selected-count').textContent = selectedPbdStudents.size;
        if (selectedPbdStudents.size) {
            bar.classList.remove('hidden');
            bar.classList.add('flex');
        } else {
            bar.classList.add('hidden');
            bar.classList.remove('flex');
        }
    }

    function bulkSetPbdTp(tp) {
        if (!selectedPbdStudents.size || !assertPbdWritable()) return;
        const { dskpId, period } = getCurrentPbdContext();
        const existing = [...selectedPbdStudents].filter(id => getPbdRecord(id, dskpId, period)?.tp).length;
        const proceed = () => {
            [...selectedPbdStudents].forEach(studentId => {
                const rec = ensurePbdRecord(studentId);
                rec.tp = Number(tp);
                rec.updatedAt = new Date().toISOString();
                rec.updatedBy = currentUserId;
            });
            logAudit('BULK_UPDATE_PBD', { count: selectedPbdStudents.size, tp: Number(tp), dskpId, period });
            persistPhase4State();
            showPbdSaveState('✓ Disimpan', 'saved');
            selectedPbdStudents.clear();
            renderPbdRows();
            updatePbdStats();
            updateDashboardKPIs();
        };

        if (existing > 0) {
            showAlert(
                'Ganti Rekod TP?',
                `${selectedPbdStudents.size} murid dipilih dan ${existing} sudah mempunyai TP. Teruskan dan ganti rekod sedia ada?`,
                'info',
                proceed
            );
        } else proceed();
    }

    function updatePbdStats() {
        const { dskpId, period } = getCurrentPbdContext();
        const students = getStudentsForCurrentPbd();
        const records = students.map(st => getPbdRecord(st.id, dskpId, period)).filter(r => r?.tp);
        const counts = [0,0,0,0,0,0];
        records.forEach(r => counts[Number(r.tp)-1]++);
        const total = students.length;
        const recorded = records.length;
        const missing = Math.max(0, total - recorded);
        const completion = total ? Math.round(recorded / total * 1000) / 10 : 0;
        const max = Math.max(...counts, 0);
        const dominant = max > 0 ? counts.indexOf(max) + 1 : null;

        document.getElementById('pbd-stat-total').textContent = total;
        document.getElementById('pbd-stat-recorded').textContent = recorded;
        document.getElementById('pbd-stat-missing').textContent = missing;
        document.getElementById('pbd-stat-completion').textContent = `${completion}%`;
        document.getElementById('pbd-stat-dominant').textContent = dominant ? `TP${dominant}` : '—';
        document.getElementById('pbd-distribution-total').textContent = `${recorded} rekod`;

        const labels = ['TP1','TP2','TP3','TP4','TP5','TP6'];
        const colorClasses = [
            'bg-rose-500','bg-orange-500','bg-amber-500','bg-blue-500','bg-emerald-500','bg-purple-500'
        ];
        document.getElementById('pbd-distribution-bars').innerHTML = counts.map((count, idx) => {
            const pct = recorded ? Math.round(count / recorded * 100) : 0;
            return `<div class="rounded-lg border border-slate-200 p-2.5">
                <div class="flex items-center justify-between text-xs"><span class="font-bold text-slate-700">${labels[idx]}</span><span class="font-black">${count}</span></div>
                <div class="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div class="${colorClasses[idx]} h-full rounded-full" style="width:${pct}%"></div></div>
                <p class="text-[10px] text-slate-400 mt-1">${pct}%</p>
            </div>`;
        }).join('');
    }

    function updatePbdLockUi() {
        const { classId, period } = getCurrentPbdContext();
        const locked = classId && isPbdLocked(classId, period);
        const badge = document.getElementById('pbd-lock-badge');
        const btn = document.getElementById('btn-pbd-lock');
        if (badge) {
            badge.textContent = locked ? 'DIKUNCI' : 'TERBUKA';
            badge.className = locked
                ? 'px-2 py-1 rounded bg-rose-500/20 border border-rose-400/30 text-rose-200 text-[10px] font-bold'
                : 'px-2 py-1 rounded bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold';
        }
        if (btn) {
            btn.disabled = !classId || !canEditPbdClass(classId);
            if (locked) {
                btn.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i> Buka Kunci PBD';
                btn.className = 'px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2';
            } else {
                btn.innerHTML = '<i data-lucide="lock" class="w-4 h-4"></i> Kunci PBD';
                btn.className = 'px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors flex items-center gap-2';
            }
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function togglePbdLock() {
        if (!isAdminSession()) { showAlert('Akses Ditolak', 'Kunci/Buka Kunci PBD hanya dibenarkan untuk Admin (KP Sejarah).', 'danger'); return; }
        const { classId, period } = getCurrentPbdContext();
        if (!classId) {
            showAlert('Pilih Kelas', 'Sila pilih kelas terlebih dahulu.', 'info');
            return;
        }
        if (!canEditPbdClass(classId)) {
            showAlert('Tiada Kebenaran', 'Anda tidak dibenarkan mengunci PBD kelas ini.', 'danger');
            return;
        }
        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        const existing = appState.pbdLocks.find(l => l.classId === classId && l.academicYear === academicYear && l.period === period);
        const currentlyLocked = existing?.locked === true;

        if (currentlyLocked && !(currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA')) {
            showAlert('Tiada Kebenaran', 'Hanya Admin atau Ketua Panitia boleh membuka kunci PBD yang telah dikunci.', 'danger');
            return;
        }

        const perform = () => {
            if (existing) {
                existing.locked = !currentlyLocked;
                existing.updatedAt = new Date().toISOString();
                existing.updatedBy = currentUserId;
            } else {
                appState.pbdLocks.push({
                    id: 'lock_' + Date.now(), classId, academicYear, period,
                    locked: true, updatedAt: new Date().toISOString(), updatedBy: currentUserId
                });
            }
            logAudit(currentlyLocked ? 'UNLOCK_PBD' : 'LOCK_PBD', { classId, academicYear, period });
            persistPhase4State();
            updatePbdLockUi();
            renderPbdRows();
        };

        if (!currentlyLocked) {
            showAlert('Kunci PBD', 'Selepas dikunci, guru biasa tidak boleh mengubah rekod bagi kelas dan tempoh ini sehingga dibuka semula oleh pihak berautoriti.', 'info', perform);
        } else perform();
    }

    function getAssistedTpSuggestion(studentId, period) {
        const student = appState.students.find(s => s.id === studentId);
        if (!student) return { tp: null, reason: 'Tiada rekod murid.' };
        const validDskpIds = new Set(appState.dskp.filter(d => d.yearLevel === student.year).map(d => d.id));
        const records = appState.pbdRecords
            .filter(r => r.studentId === studentId && r.assessmentPeriod === period && validDskpIds.has(r.dskpId) && r.tp)
            .sort((a,b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));

        if (!records.length) return { tp: null, reason: 'Belum ada rekod TP untuk tempoh ini.' };

        const counts = {};
        records.forEach(r => counts[r.tp] = (counts[r.tp] || 0) + 1);
        const maxCount = Math.max(...Object.values(counts));
        const tied = Object.keys(counts).map(Number).filter(tp => counts[tp] === maxCount);
        let suggested = tied.length === 1 ? tied[0] : Number(records.slice().reverse().find(r => tied.includes(Number(r.tp)))?.tp || tied[0]);

        const recent = records.slice(-5).map(r => `TP${r.tp}`).join(', ');
        return {
            tp: suggested,
            reason: `${records.length} evidens direkodkan. TP${suggested} paling konsisten (${counts[suggested]} rekod). Rekod terkini: ${recent}. Guru masih membuat keputusan akhir.`
        };
    }

    function openOverallTpModal(studentId) {
        const student = appState.students.find(s => s.id === studentId);
        if (!student) return;
        const { period } = getCurrentPbdContext();
        const existing = getOverallTpRecord(studentId, period);
        const suggestion = getAssistedTpSuggestion(studentId, period);

        document.getElementById('overall-tp-student-id').value = studentId;
        document.getElementById('overall-tp-student-name').textContent = `${student.name} · ${appState.classes.find(c => c.id === student.classId)?.name || ''}`;
        document.getElementById('overall-tp-suggestion').textContent = suggestion.tp ? `TP${suggestion.tp}` : 'Belum Ada Cadangan';
        document.getElementById('overall-tp-reason').textContent = suggestion.reason;
        document.getElementById('overall-tp-value').value = existing?.overallTP || suggestion.tp || '';
        document.getElementById('overall-tp-note').value = existing?.teacherNote || '';
        document.getElementById('overall-tp-assisted').checked = existing?.calculationMode === 'ASSISTED';

        const modal = document.getElementById('modal-overall-tp');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function closeOverallTpModal() {
        const modal = document.getElementById('modal-overall-tp');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function saveOverallTp() {
        const studentId = document.getElementById('overall-tp-student-id').value;
        const overallTP = Number(document.getElementById('overall-tp-value').value);
        const teacherNote = document.getElementById('overall-tp-note').value.trim();
        const assisted = document.getElementById('overall-tp-assisted').checked;
        const { classId, period } = getCurrentPbdContext();

        if (![1,2,3,4,5,6].includes(overallTP)) {
            showAlert('TP Diperlukan', 'Sila pilih TP1 hingga TP6.', 'danger');
            return;
        }
        if (!assertPbdWritable()) return;

        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        let rec = getOverallTpRecord(studentId, period);
        if (!rec) {
            rec = {
                id: `overall_${studentId}_${academicYear}_${period}`,
                studentId, schoolId: 'MATTARY', academicYear, classId,
                assessmentPeriod: period, overallTP,
                calculationMode: assisted ? 'ASSISTED' : 'MANUAL',
                confirmedBy: currentUserId, confirmedAt: new Date().toISOString(),
                teacherNote, updatedAt: new Date().toISOString()
            };
            appState.pbdOverall.push(rec);
        } else {
            rec.overallTP = overallTP;
            rec.classId = classId;
            rec.calculationMode = assisted ? 'ASSISTED' : 'MANUAL';
            rec.confirmedBy = currentUserId;
            rec.confirmedAt = new Date().toISOString();
            rec.teacherNote = teacherNote;
            rec.updatedAt = new Date().toISOString();
        }
        logAudit('CONFIRM_OVERALL_TP', { studentId, overallTP, period, mode: rec.calculationMode });
        persistPhase4State();
        closeOverallTpModal();
        renderPbdRows();
        showAlert('TP Keseluruhan Disahkan', `TP${overallTP} telah disimpan sebagai keputusan guru.`, 'success');
    }

    function openPbdHistory(studentId) {
        const student = appState.students.find(s => s.id === studentId);
        if (!student) return;
        document.getElementById('pbd-history-student').textContent = `${student.name} · ${appState.classes.find(c => c.id === student.classId)?.name || ''}`;
        const history = appState.pbdRecords
            .filter(r => r.studentId === studentId)
            .sort((a,b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

        const container = document.getElementById('pbd-history-content');
        if (!history.length) {
            container.innerHTML = '<div class="p-8 text-center text-sm text-slate-500">Belum ada sejarah rekod PBD untuk murid ini.</div>';
        } else {
            container.innerHTML = history.map(r => {
                const d = appState.dskp.find(x => x.id === r.dskpId);
                return `<div class="rounded-xl border border-slate-200 p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black">TP${r.tp || '-'}</span>
                                <span class="text-xs font-bold text-blue-700">${escapeHtml(d?.standardLearningCode || 'SP tidak ditemui')}</span>
                            </div>
                            <p class="text-sm font-semibold text-slate-800 mt-2">${escapeHtml(d?.standardLearningText || '')}</p>
                            <p class="text-xs text-slate-500 mt-1">${escapeHtml(d?.themeName || '')} · ${escapeHtml(d?.unitName || '')}</p>
                        </div>
                        <span class="text-[10px] text-slate-400 whitespace-nowrap">${escapeHtml(r.assessmentDate || '')}</span>
                    </div>
                    <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div class="bg-slate-50 rounded-lg p-2"><strong>Evidens:</strong> ${escapeHtml(r.evidence || '—')}</div>
                        <div class="bg-slate-50 rounded-lg p-2"><strong>Catatan:</strong> ${escapeHtml(r.teacherNote || '—')}</div>
                    </div>
                </div>`;
            }).join('');
        }

        const modal = document.getElementById('modal-pbd-history');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function closePbdHistory() {
        const modal = document.getElementById('modal-pbd-history');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function getDashboardPbdDistribution() {
        const academicYear = document.getElementById('filter-academic-year')?.value || '2026';
        const yearFilter = document.getElementById('filter-tahun')?.value || 'ALL';
        const classFilter = document.getElementById('filter-kelas')?.value || 'ALL';
        let permittedClasses = getPermittedClassesForPbd();
        if (yearFilter !== 'ALL') permittedClasses = permittedClasses.filter(c => String(c.year) === yearFilter);
        if (classFilter !== 'ALL') permittedClasses = permittedClasses.filter(c => c.id === classFilter);
        const classIds = new Set(permittedClasses.map(c => c.id));
        const counts = [0,0,0,0,0,0];
        appState.pbdRecords
            .filter(r => r.academicYear === academicYear && classIds.has(r.classId) && r.tp)
            .forEach(r => counts[Number(r.tp)-1]++);
        return counts;
    }

    function getDashboardScope() {
        const academicYear=document.getElementById('filter-academic-year')?.value||getActiveAcademicYear();
        const yearFilter=document.getElementById('filter-tahun')?.value||'ALL';
        const classFilter=document.getElementById('filter-kelas')?.value||'ALL';

        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes=canonicalActiveClasses(academicYear);
        if(isTeacherSession())classes=classes.filter(c=>c.teacherId===currentUserId);
        if(yearFilter!=='ALL')classes=classes.filter(c=>String(c.year)===String(yearFilter));
        if(classFilter!=='ALL')classes=classes.filter(c=>c.id===classFilter);

        const classIds=new Set(classes.map(c=>c.id));
        const students=sortStudentsAZ(appState.students.filter(s=>
            s.status==='Aktif' &&
            String(s.academicYear||academicYear)===String(academicYear) &&
            classIds.has(s.classId)
        ));
        const studentIds=new Set(students.map(s=>s.id));
        const assessments=appState.assessments.filter(a=>
            String(a.academicYear||academicYear)===String(academicYear) &&
            classIds.has(a.classId)
        );
        const assessmentById=new Map(assessments.map(a=>[a.id,a]));
        const scores=getActualScoreRecords().filter(sc=>studentIds.has(sc.studentId)&&assessmentById.has(sc.assessmentId));
        return {academicYear,yearFilter,classFilter,classes,classIds,students,studentIds,assessments,assessmentById,scores};
    }

    function dashboardLatestScoresByStudent(scope) {
        const byStudent=new Map();
        scope.students.forEach(st=>{
            const candidates=scope.scores
                .filter(sc=>sc.studentId===st.id&&!sc.absent&&sc.percentage!==null&&sc.percentage!==undefined)
                .map(sc=>({score:sc,assessment:scope.assessmentById.get(sc.assessmentId)}))
                .filter(x=>x.assessment)
                .sort((a,b)=>compareAssessmentsByExamDate(b.assessment,a.assessment));
            if(candidates.length)byStudent.set(st.id,candidates[0]);
        });
        return byStudent;
    }

    function dashboardPbdPeriod(scope) {
        const hasFinal=appState.pbdRecords.some(r=>
            r.assessmentPeriod==='AKHIR' &&
            String(r.academicYear||scope.academicYear)===String(scope.academicYear) &&
            scope.studentIds.has(r.studentId)
        );
        return hasFinal?'AKHIR':'PERTENGAHAN';
    }

    function getDashboardPbdDistribution() {
        const scope=getDashboardScope();
        const period=dashboardPbdPeriod(scope);
        const counts=[0,0,0,0,0,0];

        // Dashboard TP distribution uses the effective PBD period.
        // For AKHIR, untouched SK values continue from PERTENGAHAN.
        scope.students.forEach(st=>{
            const overall=getEffectivePbdOverall(
                st.id,
                period,
                scope.academicYear,
                st.year
            );
            if(overall&&Number(overall.overallTP)>=1&&Number(overall.overallTP)<=6){
                counts[Number(overall.overallTP)-1]++;
            }
        });
        return counts;
    }

    function dashboardPbdCompletionForClass(cls,students,academicYear,period) {
        const template=getPbdMatrixTemplate(Number(cls.year));
        const requiredDskp=template.groups.flatMap(group=>
            group.topics.map((_,idx)=>pbdMatrixDskpForTopic(Number(cls.year),group.key,idx)).filter(Boolean)
        );
        const expected=students.length*requiredDskp.length;
        if(!expected)return {expected:0,recorded:0,completion:0};

        const studentIds=new Set(students.map(s=>s.id));
        const dskpIds=new Set(requiredDskp.map(d=>d.id));
        const recorded=getEffectivePbdRecordsForScope(
            studentIds,
            dskpIds,
            academicYear,
            period
        ).filter(r=>Number(r.tp)>=1&&Number(r.tp)<=6).length;
        return {expected,recorded,completion:recorded/expected*100};
    }

    function updateDashboardPbdKpis() {
        const scope=getDashboardScope();
        const period=dashboardPbdPeriod(scope);
        const counts=getDashboardPbdDistribution();
        const max=Math.max(...counts,0);
        const dominant=max>0?counts.indexOf(max)+1:null;

        const dominantEl=document.getElementById('kpi-dominant-tp');
        if(dominantEl)dominantEl.textContent=dominant?`TP ${dominant}`:'—';

        let expected=0,recorded=0;
        scope.classes.forEach(cls=>{
            const students=scope.students.filter(s=>s.classId===cls.id);
            const c=dashboardPbdCompletionForClass(cls,students,scope.academicYear,period);
            expected+=c.expected;recorded+=c.recorded;
        });

        const pending=Math.max(0,expected-recorded);
        const pendingPct=expected?pending/expected*100:null;
        const pendingEl=document.getElementById('kpi-pbd-pending');
        const pendingCountEl=document.getElementById('kpi-pbd-pending-count');
        if(pendingEl)pendingEl.textContent=pendingPct===null?'—':formatPercent1(pendingPct);
        if(pendingCountEl)pendingCountEl.textContent=expected
            ? `${pending} / ${expected} rekod belum lengkap · ${pbdPeriodLabel(period)}`
            : `Belum ada rekod PBD · ${pbdPeriodLabel(period)}`;
    }

    function renderDashboardClassOverview(scope=null) {
        scope=scope||getDashboardScope();
        const body=document.getElementById('dashboard-class-overview-body');
        if(!body)return;

        if(!scope.classes.length){
            body.innerHTML='<tr><td colspan="8" class="px-5 py-8 text-center text-slate-500">Tiada kelas dalam skop semasa.</td></tr>';
            return;
        }

        const latestByStudent=dashboardLatestScoresByStudent(scope);
        const pbdPeriod=dashboardPbdPeriod(scope);

        body.innerHTML=sortClassesCanonical(scope.classes).map(cls=>{
            const students=sortStudentsAZ(scope.students.filter(s=>s.classId===cls.id));
            const valid=students.map(s=>latestByStudent.get(s.id)?.score).filter(Boolean);
            const avg=valid.length?valid.reduce((sum,s)=>sum+Number(s.percentage),0)/valid.length:null;

            const overallTps=students.map(st=>{
                const r=getEffectivePbdOverall(
                    st.id,
                    pbdPeriod,
                    scope.academicYear,
                    st.year
                );
                return Number(r?.overallTP||0);
            }).filter(v=>v>=1&&v<=6);
            const tpCounts=[1,2,3,4,5,6].map(tp=>overallTps.filter(v=>v===tp).length);
            const tpMax=Math.max(...tpCounts,0);
            const dominantTp=tpMax?tpCounts.indexOf(tpMax)+1:null;

            const completion=dashboardPbdCompletionForClass(cls,students,scope.academicYear,pbdPeriod);
            const teacher=mockTeachers.find(t=>t.id===cls.teacherId);
            const pct=completion.expected?completion.completion:null;
            const statusText=pct===null?'Belum ada data':pct>=100?'Selesai 100%':pct<=0?'Belum Mula (0%)':`Sedang Diisi (${formatPercent1(pct)})`;
            const statusClass=pct===null||pct<=0
                ? 'bg-rose-100 text-rose-800'
                : pct>=100
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800';

            return `<tr class="hover:bg-slate-50/80 transition-colors">
                <td class="px-5 py-3.5 font-bold text-slate-800">${escapeHtml(cls.name)}</td>
                <td class="px-4 py-3.5 text-slate-600">Tahun ${cls.year}</td>
                <td class="px-4 py-3.5 text-slate-600">${escapeHtml(teacher?.name||'Belum ditugaskan')}</td>
                <td class="px-4 py-3.5 text-slate-600">${students.length} Orang</td>
                <td class="px-4 py-3.5 font-bold text-emerald-700 dashboard-percent">${avg===null?'—':formatAverageMark(avg)}</td>
                <td class="px-4 py-3.5">${dominantTp?`<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">TP ${dominantTp}</span>`:'—'}</td>
                <td class="px-4 py-3.5"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass} dashboard-percent">${statusText}</span></td>
                <td class="px-5 py-3.5 text-right"><button onclick="openDashboardClassMarks('${cls.id}')" class="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Kemaskini</button></td>
            </tr>`;
        }).join('');
    }

    function openDashboardClassMarks(classId){
        const cls=appState.classes.find(c=>c.id===classId);
        if(!cls)return;
        const yearEl=document.getElementById('filter-tahun');
        const classEl=document.getElementById('filter-kelas');
        if(yearEl)yearEl.value=String(cls.year);
        onTahunChange();
        setTimeout(()=>{
            if(classEl&&[...classEl.options].some(o=>o.value===classId))classEl.value=classId;
            updateAssessmentDropdown();
            navigateTab('marks');
        },50);
    }

    function dashboardGpmpScopeRows(){
        const academicYear=document.getElementById('filter-academic-year')?.value||getActiveAcademicYear();
        const yearFilter=document.getElementById('dashboard-gpmp-year')?.value||'ALL';

        let classes=headcountAllowedClasses(academicYear,yearFilter,'ALL');
        const classIds=new Set(classes.map(c=>c.id));
        const students=sortStudentsAZ(appState.students.filter(s=>
            s.status==='Aktif' &&
            String(s.academicYear||academicYear)===String(academicYear) &&
            classIds.has(s.classId) &&
            (yearFilter==='ALL'||String(s.year)===String(yearFilter))
        ));

        return {
            academicYear,
            yearFilter,
            classes,
            students,
            rows:students.map(s=>hcBuildRow(s,academicYear))
        };
    }

    function dashboardGpmpStageResult(row,key){
        // Read the same target values displayed in Headcount > Prestasi Murid.
        if(key==='TOV')return row.toy;
        if(key==='OT1')return Number.isFinite(Number(row.oti1))
            ? {value:Number(row.oti1),status:'VALUE'}
            : {value:null,status:'MISSING'};
        if(key==='AR1')return row.ar1;
        if(key==='OT2')return Number.isFinite(Number(row.oti2))
            ? {value:Number(row.oti2),status:'VALUE'}
            : {value:null,status:'MISSING'};
        if(key==='AR2')return row.ar2;
        if(key==='ETR')return Number.isFinite(Number(row.etr))
            ? {value:Number(row.etr),status:'VALUE'}
            : {value:null,status:'MISSING'};
        return {value:null,status:'MISSING'};
    }

    function dashboardGpmpStageMetrics(rows,key){
        const results=rows.map(row=>dashboardGpmpStageResult(row,key));
        const valid=results.filter(r=>r.status==='VALUE'&&Number.isFinite(Number(r.value)));
        const absent=results.filter(r=>r.status==='TH').length;
        const grades={A:0,B:0,C:0,D:0,E:0,F:0};

        valid.forEach(r=>{
            const g=hcGrade(Number(r.value));
            if(Object.prototype.hasOwnProperty.call(grades,g))grades[g]++;
        });

        const points=valid
            .map(r=>hcGradePoint(hcGrade(Number(r.value))))
            .filter(v=>Number.isFinite(Number(v)));
        const gpmp=points.length
            ? Number((points.reduce((a,b)=>a+Number(b),0)/points.length).toFixed(2))
            : null;
        const average=valid.length
            ? valid.reduce((a,b)=>a+Number(b.value),0)/valid.length
            : null;
        const mtm=grades.A+grades.B+grades.C+grades.D+grades.E;
        const masteryRate=valid.length?mtm/valid.length*100:null;

        return {
            key,
            valid:valid.length,
            absent,
            gpmp,
            average,
            masteryRate,
            grades
        };
    }

    function dashboardGpmpSourceLabel(key){
        return ({
            TOV:'Diagnostik',
            OT1:'Sasaran 1',
            AR1:'UPSA',
            OT2:'Sasaran 2',
            AR2:'UASA',
            ETR:'Sasaran Akhir'
        })[key]||key;
    }

    function renderDashboardGpmpSummary(){
        const body=document.getElementById('dashboard-gpmp-table-body');
        const canvas=document.getElementById('dashboard-gpmp-chart');
        if(!body||!canvas)return;

        const scope=dashboardGpmpScopeRows();

        // Table keeps all six Headcount stages.
        const tableStages=['TOV','OT1','AR1','OT2','AR2','ETR'];
        const tableMetrics=tableStages.map(key=>dashboardGpmpStageMetrics(scope.rows,key));

        // Graph compares two 4-point GPMP journeys:
        // Target: TOV -> OT1 -> OT2 -> ETR
        // Actual: TOV -> AR1 -> AR2 -> ETR
        const targetKeys=['TOV','OT1','OT2','ETR'];
        const actualKeys=['TOV','AR1','AR2','ETR'];
        const targetMetrics=targetKeys.map(key=>dashboardGpmpStageMetrics(scope.rows,key));
        const actualMetrics=actualKeys.map(key=>dashboardGpmpStageMetrics(scope.rows,key));

        const scopeText=scope.yearFilter==='ALL'
            ? 'Keseluruhan Tahun 4–6'
            : `Tahun ${scope.yearFilter}`;

        const scopeEl=document.getElementById('dashboard-gpmp-chart-scope');
        if(scopeEl)scopeEl.textContent=`${scopeText} · Sesi ${phase9AyLabel(scope.academicYear)} · ${hcCurrentMethod()==='METHOD2'?'Kaedah 2':'Kaedah 1'}`;

        body.innerHTML=tableMetrics.map(m=>{
            const gpmp=m.gpmp===null?'—':m.gpmp.toFixed(2);
            return `<tr>
                <td class="px-4 py-3">
                  <div class="dashboard-gpmp-stage">
                    <strong>${m.key}</strong>
                    <span>${dashboardGpmpSourceLabel(m.key)}</span>
                  </div>
                </td>
                <td class="px-3 py-3 text-center font-bold text-slate-700">${m.valid}</td>
                <td class="px-3 py-3 text-center font-bold text-slate-700 percent-nowrap">${m.masteryRate===null?'—':formatPercent1(m.masteryRate)}</td>
                <td class="px-4 py-3 text-center">
                  <span class="dashboard-gpmp-value">${gpmp}</span>
                </td>
            </tr>`;
        }).join('');

        if(dashboardGpmpChartInstance){
            dashboardGpmpChartInstance.destroy();
            dashboardGpmpChartInstance=null;
        }

        const dark=document.documentElement.classList.contains('theme-dark');
        const chartMode=document.getElementById('dashboard-gpmp-chart-type')?.value==='LINE'?'LINE':'BAR';
        const isLine=chartMode==='LINE';

        // Neutral comparison labels: first stage, checkpoint 1, checkpoint 2, final.
        // Tooltip exposes the exact Headcount labels (OT1 vs AR1, OT2 vs AR2).
        const compareLabels=['TOV','Peringkat 1','Peringkat 2','ETR'];

        const targetColor=dark?'rgba(110,231,183,1)':'rgba(5,150,105,1)';
        const actualColor=dark?'rgba(165,180,252,1)':'rgba(79,70,229,1)';

        dashboardGpmpChartInstance=new Chart(canvas,{
            type:isLine?'line':'bar',
            data:{
                labels:compareLabels,
                datasets:[
                    {
                        label:'Sasaran · TOV → OT1 → OT2 → ETR',
                        data:targetMetrics.map(m=>m.gpmp),
                        backgroundColor:isLine
                            ? (dark?'rgba(110,231,183,.10)':'rgba(5,150,105,.08)')
                            : (dark?'rgba(52,211,153,.74)':'rgba(16,185,129,.76)'),
                        borderColor:targetColor,
                        borderWidth:isLine?2.5:1,
                        borderRadius:isLine?0:6,
                        pointBackgroundColor:targetColor,
                        pointBorderColor:dark?'#0E242A':'#FFFFFF',
                        pointBorderWidth:2,
                        pointRadius:isLine?4:0,
                        pointHoverRadius:isLine?5:0,
                        tension:.3,
                        fill:false
                    },
                    {
                        label:'Pencapaian · TOV → AR1 → AR2 → ETR',
                        data:actualMetrics.map(m=>m.gpmp),
                        backgroundColor:isLine
                            ? (dark?'rgba(165,180,252,.10)':'rgba(79,70,229,.08)')
                            : (dark?'rgba(129,140,248,.72)':'rgba(99,102,241,.74)'),
                        borderColor:actualColor,
                        borderWidth:isLine?2.5:1,
                        borderRadius:isLine?0:6,
                        pointBackgroundColor:actualColor,
                        pointBorderColor:dark?'#0E242A':'#FFFFFF',
                        pointBorderWidth:2,
                        pointRadius:isLine?4:0,
                        pointHoverRadius:isLine?5:0,
                        tension:.3,
                        fill:false
                    }
                ]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                interaction:{mode:'index',intersect:false},
                plugins:{
                    legend:{
                        display:true,
                        position:'bottom',
                        labels:{
                            usePointStyle:true,
                            boxWidth:8,
                            font:{size:9},
                            color:dark?'#E2E8F0':'#475569'
                        }
                    },
                    tooltip:{
                        callbacks:{
                            title:(items)=>{
                                const idx=items?.[0]?.dataIndex;
                                if(idx===0)return 'TOV';
                                if(idx===1)return 'OT1 vs AR1';
                                if(idx===2)return 'OT2 vs AR2';
                                if(idx===3)return 'ETR';
                                return '';
                            },
                            label:(ctx)=>{
                                const idx=ctx.dataIndex;
                                const isTarget=ctx.datasetIndex===0;
                                const stage=isTarget?targetKeys[idx]:actualKeys[idx];
                                const value=ctx.raw;
                                return `${stage}: ${value===null?'—':Number(value).toFixed(2)}`;
                            },
                            afterBody:(items)=>{
                                const idx=items?.[0]?.dataIndex;
                                if(idx===undefined)return '';
                                const t=targetMetrics[idx];
                                const a=actualMetrics[idx];
                                return [
                                    `Sasaran rekod sah: ${t.valid}`,
                                    `Pencapaian rekod sah: ${a.valid}`
                                ];
                            }
                        }
                    }
                },
                scales:{
                    x:{
                        grid:{display:false},
                        ticks:{font:{size:10,weight:'700'},color:dark?'#E2E8F0':'#475569'}
                    },
                    y:{
                        min:1,
                        max:6,
                        ticks:{stepSize:1,color:dark?'#CBD5E1':'#64748B'},
                        grid:{color:dark?'rgba(148,163,184,.13)':'rgba(226,232,240,.75)'},
                        title:{
                            display:true,
                            text:'GPMP · lebih rendah lebih baik',
                            color:dark?'#CBD5E1':'#64748B',
                            font:{size:9}
                        }
                    }
                }
            }
        });
    }

    function updateDashboardKPIs() {
        const scope=getDashboardScope();
        const latestByStudent=dashboardLatestScoresByStudent(scope);
        const scored=[...latestByStudent.values()].map(x=>x.score);
        const values=scored.map(s=>Number(s.percentage)).filter(Number.isFinite);

        const masteryCount=values.filter(v=>isMasteredMark(v)).length;
        let interventionCount=0;
        try{
            interventionCount=getInterventionCandidates({
                academicYear:scope.academicYear,
                year:scope.yearFilter,
                classId:scope.classFilter
            }).length;
        }catch(err){console.warn('Gagal mengira calon intervensi dashboard:',err);}

        const totalEl=document.getElementById('kpi-total-students');
        const classesEl=document.getElementById('kpi-total-classes');
        const avgEl=document.getElementById('kpi-avg-marks');
        const avgGradeEl=document.getElementById('kpi-avg-grade');
        const masteryEl=document.getElementById('kpi-mastery');
        const masteryCountEl=document.getElementById('kpi-mastery-count');
        const interventionEl=document.getElementById('kpi-intervention');

        if(totalEl)totalEl.textContent=scope.students.length;
        if(classesEl)classesEl.textContent=`${scope.classes.length} Kelas`;

        if(values.length){
            const avg=values.reduce((a,b)=>a+b,0)/values.length;
            if(avgEl)avgEl.textContent=formatAverageMark(avg);
            if(avgGradeEl){
                const grade=calculateGrade(avg);
                const info=appSettings.gradeBoundaries.find(b=>b.grade===grade);
                avgGradeEl.textContent=grade?`Gred ${grade}${info?.label?` (${info.label})`:''}`:'—';
            }
            const masteryRate=values.length?masteryCount/values.length*100:0;
            if(masteryEl)masteryEl.textContent=formatPercent1(masteryRate);
            if(masteryCountEl)masteryCountEl.textContent=`${masteryCount} / ${values.length} Murid Bermarkah`;
        }else{
            if(avgEl)avgEl.textContent='—';
            if(avgGradeEl)avgGradeEl.textContent='Belum ada markah';
            if(masteryEl)masteryEl.textContent='—';
            if(masteryCountEl)masteryCountEl.textContent=`0 / ${scope.students.length} Murid Bermarkah`;
        }
        if(interventionEl)interventionEl.textContent=interventionCount;

        updateDashboardPbdKpis();
        renderDashboardClassOverview(scope);
        renderDashboardGpmpSummary();
    }

    // --- INTEGRATION MODIFICATIONS ---

    // Login / Logout & Theme Functions
    const THEME_STORAGE_KEY = 'sejarah_dashboard_theme_v1';

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('theme-dark', isDark);
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');

        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = isDark ? '#cbd5e1' : '#475569';
            Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';
        }

        try {
            if (chartGradesInstance || chartTpInstance) initCharts();
            if (document.getElementById('dashboard-gpmp-chart')) renderDashboardGpmpSummary();
            if (document.getElementById('view-analytics-marks') && !document.getElementById('view-analytics-marks').classList.contains('hidden')) renderMarksAnalytics();
            if (document.getElementById('view-analytics-pbd') && !document.getElementById('view-analytics-pbd').classList.contains('hidden')) renderPbdAnalytics();
            if (document.getElementById('view-analytics-class') && !document.getElementById('view-analytics-class').classList.contains('hidden')) renderClassComparison();
        } catch (err) {
            console.warn('Theme chart refresh skipped:', err);
        }
        lucide.createIcons();
    }

    function toggleTheme() {
        applyTheme(document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark');
    }

    function restoreTheme() {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(preferred);
    }


    // ==============================================================
    // PHASE 10 — SUPABASE AUTHENTICATION + POSTGRES + REALTIME
    // Existing phase10* function names are retained for compatibility
    // with the rest of this single-file application.
    // ==============================================================
    const PHASE10_CONFIG = window.MATTARY_SUPABASE_CONFIG || {};
    const PHASE10_COLLECTIONS = window.MATTARY_SUPABASE_TABLES || {};
    const PHASE10_FIELD_COLUMNS = {
        teacherId:'teacher_id',
        classId:'class_id',
        studentId:'student_id',
        assessmentId:'assessment_id',
        academicYear:'academic_year',
        authUserId:'auth_user_id',
        loginId:'login_id',
        role:'role',
        active:'active'
    };

    let phase10App = null;
    let phase10Auth = null;
    let phase10Db = null;
    let phase10Mode = 'LOCAL';
    let phase10SignedInUser = null;
    let phase10CurrentFirebaseProfile = null; // compatibility name; profile is stored in Supabase
    let phase10Initialized = false;
    let phase10InitPromise = null;
    let phase10PersistencePromise = null;
    let phase10LoginHydrationToken = 0;
    let phase10RealtimeUnsubscribers = [];
    let phase10RealtimeRefreshTimer = null;
    let phase10RealtimeSeenNonEmpty = {};
    let phase10RealtimeRemoteTimer = null;

    function phase10Configured() {
        return Boolean(
            PHASE10_CONFIG &&
            PHASE10_CONFIG.url &&
            PHASE10_CONFIG.publishableKey &&
            typeof window.supabase?.createClient === 'function'
        );
    }

    function phase10Collection(key) {
        return PHASE10_COLLECTIONS[key] || key;
    }

    function phase10ProjectLabel(){
        try{
            const host=new URL(PHASE10_CONFIG.url).hostname;
            return host.split('.')[0]||host;
        }catch(_){
            return PHASE10_CONFIG.url||'—';
        }
    }

    function phase10SetStatus(mode, detail='') {
        phase10Mode = mode;
        const badge=document.getElementById('phase10-backend-badge');
        const settingsBadge=document.getElementById('phase10-settings-status');
        const dbStatus=document.getElementById('phase10-db-status');
        const project=document.getElementById('phase10-project-id');
        const loginNote=document.getElementById('login-backend-note');

        if(project) project.textContent=phase10ProjectLabel();

        if(badge){
            badge.classList.remove('phase10-online','phase10-syncing','phase10-error');
            if(mode==='SUPABASE') badge.classList.add('phase10-online');
            if(mode==='SYNCING') badge.classList.add('phase10-syncing');
            if(mode==='ERROR') badge.classList.add('phase10-error');
            const label=badge.querySelector('span')||badge;
            if(label) label.textContent=mode==='SUPABASE'?'SUPABASE':mode==='SYNCING'?'SYNC':'LOCAL';
        }

        if(settingsBadge){
            const classes={
                SUPABASE:'bg-emerald-50 text-emerald-700 border-emerald-200',
                SYNCING:'bg-amber-50 text-amber-700 border-amber-200',
                ERROR:'bg-rose-50 text-rose-700 border-rose-200',
                LOCAL:'bg-slate-100 text-slate-600 border-slate-200'
            };
            settingsBadge.className=`px-2 py-0.5 rounded-full border text-[9px] font-black ${classes[mode]||classes.LOCAL}`;
            settingsBadge.textContent=mode==='SUPABASE'?'SUPABASE AKTIF':mode==='SYNCING'?'MENYELARAS':mode==='ERROR'?'RALAT SAMBUNGAN':'MOD LOCAL';
        }

        if(dbStatus){
            dbStatus.textContent=mode==='SUPABASE'
                ? 'Supabase Postgres · aktif'
                : mode==='SYNCING'
                    ? 'Supabase · menyelaras'
                    : mode==='ERROR'
                        ? 'Supabase · ralat'
                        : 'LocalStorage · cache/fallback';
        }

        if(loginNote){
            loginNote.textContent=phase10Configured()
                ? 'Supabase Anonymous Authentication aktif. User ID/MyKad disahkan pada peringkat aplikasi.'
                : 'Mod tempatan · konfigurasi Supabase belum lengkap.';
        }

        if(detail) console.info('[Supabase]',detail);
    }

    // Compatibility name retained: this now initializes Supabase, not Firebase.
    async function phase10InitFirebase() {
        if(phase10InitPromise) return phase10InitPromise;

        phase10InitPromise=(async()=>{
            if(!phase10Configured()){
                phase10Initialized=true;
                phase10SetStatus('LOCAL','Konfigurasi Supabase belum lengkap.');
                return false;
            }

            try{
                phase10SetStatus('SYNCING','Memulakan Supabase...');
                phase10App=window.supabase.createClient(
                    PHASE10_CONFIG.url,
                    PHASE10_CONFIG.publishableKey,
                    {
                        auth:{
                            persistSession:true,
                            autoRefreshToken:true,
                            detectSessionInUrl:false
                        },
                        db:{schema:'public'}
                    }
                );
                phase10Db=phase10App;
                phase10Auth=phase10App.auth;
                phase10Initialized=true;
                phase10SetStatus('SUPABASE','Supabase berjaya dimulakan.');
                return true;
            }catch(err){
                console.error('Supabase init error:',err);
                phase10Initialized=true;
                phase10SetStatus('ERROR',err.message||String(err));
                return false;
            }
        })();

        return phase10InitPromise;
    }

    function phase10CleanValue(value) {
        if(value===undefined) return null;
        if(value===null || typeof value==='string' || typeof value==='number' || typeof value==='boolean') return value;
        if(value instanceof Date) return value.toISOString();
        if(Array.isArray(value)) return value.map(phase10CleanValue);
        if(typeof value==='object'){
            const out={};
            Object.entries(value).forEach(([k,v])=>{
                if(typeof v!=='function' && v!==undefined) out[k]=phase10CleanValue(v);
            });
            return out;
        }
        return String(value);
    }

    function phase10PackRow(id,data,extra={}) {
        const payload={
            ...phase10CleanValue(data||{}),
            ...phase10CleanValue(extra||{})
        };
        delete payload.id;

        const row={
            id:String(id),
            data:payload,
            teacher_id:payload.teacherId||null,
            class_id:payload.classId||null,
            student_id:payload.studentId||null,
            assessment_id:payload.assessmentId||null,
            academic_year:payload.academicYear===null||payload.academicYear===undefined?null:String(payload.academicYear),
            login_id:payload.loginId||null,
            role:payload.role||null,
            active:payload.active===null||payload.active===undefined?null:Boolean(payload.active),
            updated_by_uid:phase10SignedInUser?.id||null,
            updated_at:new Date().toISOString()
        };
        return row;
    }

    function phase10DocData(row) {
        if(!row)return null;
        return {id:row.id,...(row.data||{})};
    }

    function phase10Chunk(values,size=100) {
        const result=[];
        for(let i=0;i<values.length;i+=size)result.push(values.slice(i,i+size));
        return result;
    }

    async function phase10QueryByEq(collectionKey,field,value){
        if(value===undefined||value===null||value==='')return [];
        const table=phase10Collection(collectionKey);
        const column=PHASE10_FIELD_COLUMNS[field];
        if(!column){
            const all=await phase10GetAll(collectionKey);
            return all.filter(x=>String(x?.[field]??'')===String(value));
        }
        let v=value;
        if(field==='academicYear')v=String(value);
        const {data,error}=await phase10Db.from(table).select('*').eq(column,v);
        if(error)throw error;
        return (data||[]).map(phase10DocData);
    }

    async function phase10QueryByIn(collectionKey,field,values) {
        if(!values?.length) return [];
        const unique=[...new Set(values)].filter(v=>v!==null&&v!==undefined&&v!=='');
        if(!unique.length)return [];

        const table=phase10Collection(collectionKey);
        const column=PHASE10_FIELD_COLUMNS[field];
        if(!column){
            const all=await phase10GetAll(collectionKey);
            const wanted=new Set(unique.map(String));
            return all.filter(x=>wanted.has(String(x?.[field]??'')));
        }

        const normalized=field==='academicYear'?unique.map(String):unique;
        const chunks=phase10Chunk(normalized,100);
        const results=await Promise.all(chunks.map(async chunk=>{
            const {data,error}=await phase10Db.from(table).select('*').in(column,chunk);
            if(error)throw error;
            return (data||[]).map(phase10DocData);
        }));
        return results.flat();
    }

    async function phase10GetAll(collectionKey) {
        const {data,error}=await phase10Db.from(phase10Collection(collectionKey)).select('*');
        if(error)throw error;
        return (data||[]).map(phase10DocData);
    }

    async function phase10GetById(collectionKey,id){
        const {data,error}=await phase10Db
            .from(phase10Collection(collectionKey))
            .select('*')
            .eq('id',String(id))
            .maybeSingle();
        if(error)throw error;
        return data?phase10DocData(data):null;
    }

    async function phase10GetUserProfileByLoginId(loginId, role) {
        const normalized=normalizeLoginUserId(loginId,role);
        let data=await phase10GetById('users',normalized);

        if(!data){
            const rows=await phase10QueryByEq('users','loginId',normalized);
            data=rows[0]||null;
        }
        if(!data)return null;

        const normalizedRole=data.role==='KETUA_PANITIA'?'ADMIN':data.role;
        return {
            ...data,
            supabaseRowId:data.id||normalized,
            id:data.legacyId||data.id||normalized,
            legacyId:data.legacyId||data.id||normalized,
            loginId:data.loginId||normalized,
            mykad:data.mykad||data.myKad||data.staffId||'',
            name:data.name||'Pengguna',
            email:data.email||'',
            role:normalizedRole,
            active:data.active!==false
        };
    }

    async function phase10Sha256(value){
        if(!crypto?.subtle) throw new Error('Web Crypto tidak tersedia pada pelayar ini.');
        const bytes=new TextEncoder().encode(String(value??''));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    async function phase10ValidateAppCredentials(userId,password){
        if((window.MATTARY_SUPABASE_CONFIG?.authMode||'legacy_anonymous')==='password') return true;
        const normalized=normalizeLoginUserId(userId);

        if(selectedLoginRole==='ADMIN'){
            if(normalized!=='ADMIN') throw new Error('User ID Admin mestilah ADMIN.');
            const inputHash=await phase10Sha256(password);
            const expectedHash='7d77b9fdb2a1f783e11ae71c70a8820f3a58dfef556f43d614dfbc2c25cfad2e';
            if(inputHash!==expectedHash) throw new Error('Kata laluan Admin tidak sah.');
            return true;
        }

        if(!/^\d{12}$/.test(normalized)){
            throw new Error('User ID Guru Sejarah mestilah nombor MyKad 12 digit.');
        }
        if(String(password)!==normalized){
            throw new Error('Bagi Guru Sejarah, kata laluan mestilah nombor MyKad yang sama dengan User ID.');
        }
        return true;
    }

    async function phase10Authenticate(userId,password) {
        const ready=await phase10InitFirebase();
        if(!ready) return null;

        await phase10ValidateAppCredentials(userId,password);

        let sessionUser=null;
        const {data:sessionData,error:sessionError}=await phase10Auth.getSession();
        if(sessionError)throw sessionError;
        sessionUser=sessionData?.session?.user||null;

        const authMode=window.MATTARY_SUPABASE_CONFIG?.authMode||'legacy_anonymous';
        if(authMode==='password'){
            if(!sessionUser || sessionUser.is_anonymous===true){
                if(sessionUser){ try{await phase10Auth.signOut();}catch(_){} }
                const {data,error}=await phase10Auth.signInWithPassword({email:String(userId).trim(),password:String(password)});
                if(error)throw error;
                sessionUser=data?.user||data?.session?.user||null;
            }
        }else if(!sessionUser || sessionUser.is_anonymous!==true){
            if(sessionUser){
                try{await phase10Auth.signOut();}catch(_){}
            }
            const {data,error}=await phase10Auth.signInAnonymously();
            if(error)throw error;
            sessionUser=data?.user||data?.session?.user||null;
        }

        if(!sessionUser)throw new Error('Supabase Authentication tidak menghasilkan sesi pengguna.');
        phase10SignedInUser=sessionUser;

        const normalizedId=normalizeLoginUserId(userId);
        let profile=null;
        if(authMode==='password'){
            const linked=await phase10QueryByEq('users','authUserId',sessionUser.id);
            if(linked[0]){
                const raw=linked[0], normalizedRole=raw.role==='KETUA_PANITIA'?'ADMIN':raw.role;
                profile={...raw,supabaseRowId:raw.id,id:raw.legacyId||raw.id,legacyId:raw.legacyId||raw.id,loginId:raw.loginId||raw.email||userId,mykad:raw.mykad||raw.myKad||'',name:raw.name||sessionUser.email||'Pengguna',email:raw.email||sessionUser.email||'',role:normalizedRole,active:raw.active!==false};
            }
        }else{
            profile=await phase10GetUserProfileByLoginId(normalizedId,selectedLoginRole);
        }

        if(authMode==='password' && !profile) throw new Error('Akaun Auth ini belum dipautkan kepada rekod public.users.auth_user_id.');

        // First Admin bootstrap. The profile is then written to Supabase (legacy mode only).
        if(!profile && selectedLoginRole==='ADMIN'){
            const localAdmin=getLoginProfile('ADMIN') || mockTeachers.find(u=>(u.role==='ADMIN'||u.role==='KETUA_PANITIA'));
            profile={
                ...(localAdmin||{}),
                id:localAdmin?.id||'admin1',
                legacyId:localAdmin?.id||'admin1',
                loginId:'ADMIN',
                name:localAdmin?.name||'Admin / KP Sejarah',
                role:'ADMIN',
                active:true
            };
            await phase10Upsert('users','ADMIN',profile);
        }

        if(!profile){
            throw new Error('Profil pengguna belum didaftarkan dalam Pengurusan Pengguna / Supabase.');
        }
        if(!profile.active){
            throw new Error('Akaun ini telah dinyahaktifkan oleh Admin.');
        }
        if(profile.role!==selectedLoginRole){
            const label=selectedLoginRole==='ADMIN'?'Admin (KP Sejarah)':'Guru Sejarah';
            throw new Error(`Profil ini tidak mempunyai peranan ${label}.`);
        }

        phase10CurrentFirebaseProfile={...profile,loginId:normalizedId};
        return phase10CurrentFirebaseProfile;
    }

    async function phase10LoadRemoteState(profile,showToast=false,onCoreReady=null) {
        if(!phase10Db || !phase10SignedInUser) return false;
        const loadSeq=++phase10RemoteLoadSeq;
        phase10SetStatus('SYNCING','Menyelaraskan data Supabase...');

        try{
            const isAdmin=profile.role==='ADMIN';
            let classes=[];
            let students=[];
            let assessments=[];
            let scores=[];
            let pbdRecords=[];
            let pbdGroupLevels=[];
            let pbdOverall=[];
            let pbdLocks=[];
            let interventions=[];
            let remoteUsers=[];
            let auditLogs=[];
            let headcountDocs=[];
            let settingsData=null;
            let coreReadyCalled=false;

            const notifyCoreReady=()=>{
                if(coreReadyCalled)return;
                coreReadyCalled=true;
                try{
                    if(typeof onCoreReady==='function')onCoreReady({classes,students,assessments,scores});
                }catch(err){
                    console.warn('Fast-login core callback:',err);
                }
            };

            if(isAdmin){
                const [c,s,a,settings]=await Promise.all([
                    phase10GetAll('classes'),
                    phase10GetAll('students'),
                    phase10GetAll('assessments'),
                    phase10GetById('settings','school')
                ]);

                settingsData=settings;
                classes=c.filter(x=>[4,5,6].includes(Number(x.year)));
                const classIds=new Set(classes.map(x=>x.id));
                students=s.filter(x=>[4,5,6].includes(Number(x.year))&&(!x.classId||classIds.has(x.classId)));
                assessments=a.filter(x=>classIds.has(x.classId)&&(!x.subject||String(x.subject).toUpperCase()==='SEJARAH'));

                const assessmentIds=assessments.map(x=>x.id);
                scores=assessmentIds.length
                    ? await phase10QueryByIn('scores','assessmentId',assessmentIds)
                    : [];

                if(loadSeq!==phase10RemoteLoadSeq)return false;

                appState.classes=classes;
                appState.students=students;
                appState.assessments=assessments;
                appState.scores=phase10MergePendingScores(scores);
                persistMarksState();
                notifyCoreReady();

                const [pr,pgl,po,pl,it,u,al,hc]=await Promise.all([
                    phase10GetAll('pbdRecords'),
                    phase10GetAll('pbdGroupLevels'),
                    phase10GetAll('pbdOverall'),
                    phase10GetAll('pbdLocks'),
                    phase10GetAll('interventions'),
                    phase10GetAll('users'),
                    phase10GetAll('auditLogs'),
                    phase10GetAll('headcount')
                ]);

                const studentIdsSet=new Set(students.map(x=>x.id));
                const classIdsSet=new Set(classes.map(x=>x.id));
                pbdRecords=pr.filter(x=>studentIdsSet.has(x.studentId));
                pbdGroupLevels=pgl.filter(x=>studentIdsSet.has(x.studentId));
                pbdOverall=po.filter(x=>studentIdsSet.has(x.studentId));
                pbdLocks=pl.filter(x=>classIdsSet.has(x.classId));
                interventions=it.filter(x=>!x.studentId||studentIdsSet.has(x.studentId));
                headcountDocs=hc.filter(x=>!x.studentId||studentIdsSet.has(x.studentId));

                remoteUsers=u.map(x=>({
                    ...x,
                    loginId:x.loginId||x.id,
                    id:x.legacyId||x.id,
                    legacyId:x.legacyId||x.id,
                    role:x.role==='KETUA_PANITIA'?'ADMIN':x.role
                }));
                auditLogs=al;
            }else{
                // Teacher fast path: load only assigned classes and their pupils.
                const [classDocs,settings]=await Promise.all([
                    phase10QueryByEq('classes','teacherId',profile.id),
                    phase10GetById('settings','school')
                ]);
                settingsData=settings;

                classes=classDocs.filter(x=>[4,5,6].includes(Number(x.year)));
                const classIds=classes.map(x=>x.id);

                const [studentDocs,assessmentDocs,lockDocs]=await Promise.all([
                    phase10QueryByIn('students','classId',classIds),
                    phase10QueryByIn('assessments','classId',classIds),
                    phase10QueryByIn('pbdLocks','classId',classIds)
                ]);

                students=studentDocs.filter(x=>[4,5,6].includes(Number(x.year)));
                assessments=assessmentDocs.filter(x=>!x.subject||String(x.subject).toUpperCase()==='SEJARAH');
                pbdLocks=lockDocs;

                scores=assessments.length
                    ? await phase10QueryByIn('scores','assessmentId',assessments.map(x=>x.id))
                    : [];

                if(loadSeq!==phase10RemoteLoadSeq)return false;

                appState.classes=classes;
                appState.students=students;
                appState.assessments=assessments;
                appState.scores=phase10MergePendingScores(scores);
                appState.pbdLocks=pbdLocks;
                persistMarksState();
                notifyCoreReady();

                const studentIds=students.map(x=>x.id);
                const [pr,pgl,po,it,hc]=await Promise.all([
                    phase10QueryByIn('pbdRecords','studentId',studentIds),
                    phase10QueryByIn('pbdGroupLevels','studentId',studentIds),
                    phase10QueryByIn('pbdOverall','studentId',studentIds),
                    phase10QueryByIn('interventions','studentId',studentIds),
                    phase10QueryByIn('headcount','studentId',studentIds)
                ]);

                pbdRecords=pr;
                pbdGroupLevels=pgl;
                pbdOverall=po;
                interventions=it;
                headcountDocs=hc;
                remoteUsers=[profile];
            }

            if(loadSeq!==phase10RemoteLoadSeq)return false;

            appState.classes=classes;
            appState.students=students;
            appState.assessments=assessments;
            appState.scores=phase10MergePendingScores(scores);
            appState.pbdRecords=pbdRecords;
            appState.pbdGroupLevels=pbdGroupLevels;
            appState.pbdOverall=pbdOverall;
            appState.pbdLocks=pbdLocks;
            appState.interventions=interventions;

            if(isAdmin)appState.auditLogs=auditLogs;
            if(remoteUsers.length)mockTeachers=remoteUsers;

            if(settingsData){
                phase9SchoolProfile={...phase9SchoolProfile,...settingsData};
                persistPhase9State();
            }

            headcountState.toyOverrides=headcountState.toyOverrides||{};
            headcountState.interventions=headcountState.interventions||{};
            headcountDocs.forEach(doc=>{
                const key=`${doc.academicYear}|${doc.studentId}`;
                if(doc.intervention)headcountState.interventions[key]=doc.intervention;
            });
            persistHeadcountState();

            notifyCoreReady();
            ensurePbdMatrixTemplateDskp();
            persistMarksState();
            persistPhase4State();
            persistUsersState();
            updatePhase9Branding();
            populateAcademicSessionSelectors(false);
            phase10SetStatus('SUPABASE','Supabase selesai dimuat.');

            if(showToast){
                showAlert('Data Dikemas Kini','Data terkini berjaya ditarik daripada Supabase.','success');
            }
            return true;
        }catch(err){
            console.error('Supabase load error:',err);
            phase10SetStatus('ERROR',err.message||String(err));
            if(showToast)showAlert('Gagal Menarik Data',phase10FriendlyError(err),'danger');
            return false;
        }
    }

    function phase10FriendlyError(err) {
        const code=String(err?.code||'');
        const msg=String(err?.message||err||'');
        const low=msg.toLowerCase();

        if(low.includes('anonymous sign-ins') && (low.includes('disabled')||low.includes('not enabled'))){
            return 'Supabase Anonymous Sign-Ins belum diaktifkan. Buka Authentication → Providers → Anonymous dan aktifkan Anonymous Sign-Ins.';
        }
        if(code==='42501'||low.includes('row-level security')||low.includes('permission denied')){
            return 'Akses Supabase ditolak oleh Row Level Security (RLS). Jalankan fail SQL schema + RLS yang disediakan.';
        }
        if(code==='42P01'||low.includes('relation')&&low.includes('does not exist')){
            return 'Jadual Supabase belum diwujudkan. Jalankan fail SQL schema + RLS yang disediakan dalam SQL Editor.';
        }
        if(low.includes('failed to fetch')||low.includes('network')){
            return 'Sambungan rangkaian ke Supabase tidak tersedia.';
        }
        return msg || 'Ralat Supabase yang tidak diketahui.';
    }

    async function phase10Upsert(collectionKey,id,data,extra={}) {
        if(phase10Mode!=='SUPABASE' || !phase10Db || !phase10SignedInUser || !id) return false;
        try{
            const row=phase10PackRow(id,data,extra);
            const {error}=await phase10Db
                .from(phase10Collection(collectionKey))
                .upsert(row,{onConflict:'id'});
            if(error)throw error;
            return true;
        }catch(err){
            console.error(`Supabase write ${collectionKey}/${id}:`,err);
            phase10SetStatus('ERROR',err.message||String(err));
            return false;
        }
    }

    async function phase10Delete(collectionKey,id) {
        if(phase10Mode!=='SUPABASE' || !phase10Db || !phase10SignedInUser || !id) return false;
        try{
            const {error}=await phase10Db
                .from(phase10Collection(collectionKey))
                .delete()
                .eq('id',String(id));
            if(error)throw error;
            return true;
        }catch(err){
            console.error(`Supabase delete ${collectionKey}/${id}:`,err);
            phase10SetStatus('ERROR',err.message||String(err));
            return false;
        }
    }

    async function phase10BatchUpsert(collectionKey,records,extraFactory=null) {
        if(phase10Mode!=='SUPABASE' || !phase10Db || !phase10SignedInUser || !records?.length) return;
        const valid=records.filter(x=>x&&x.id);
        for(const chunk of phase10Chunk(valid,250)){
            const rows=chunk.map(record=>{
                const extra=typeof extraFactory==='function'?extraFactory(record):{};
                return phase10PackRow(record.id,record,extra);
            });
            const {error}=await phase10Db
                .from(phase10Collection(collectionKey))
                .upsert(rows,{onConflict:'id'});
            if(error)throw error;
        }
    }

    async function phase10SyncHeadcountStudent(studentId) {
        if(phase10Mode!=='SUPABASE' || !studentId) return;
        const academicYear=document.getElementById('headcount-session')?.value||getActiveAcademicYear();
        const key=`${academicYear}|${studentId}`;
        const docId=`${academicYear}_${studentId}`.replace(/[^A-Za-z0-9_-]/g,'_');
        await phase10Upsert('headcount',docId,{
            studentId,
            academicYear,
            intervention:(headcountState.interventions||{})[key]||null,
            subject:'SEJARAH'
        });
    }

    function phase10StopRealtimeSync() {
        phase10RealtimeUnsubscribers.forEach(fn=>{try{fn();}catch(_){}});
        phase10RealtimeUnsubscribers=[];
        phase10RealtimeSeenNonEmpty={};
        if(phase10RealtimeRefreshTimer)clearTimeout(phase10RealtimeRefreshTimer);
        if(phase10RealtimeRemoteTimer)clearTimeout(phase10RealtimeRemoteTimer);
        phase10RealtimeRefreshTimer=null;
        phase10RealtimeRemoteTimer=null;
    }

    function phase10ScheduleUiRefresh() {
        clearTimeout(phase10RealtimeRefreshTimer);
        phase10RealtimeRefreshTimer=setTimeout(()=>{
            try{
                ensureAutoAssessmentTemplates(false,document.getElementById('filter-academic-year')?.value||getActiveAcademicYear());
                updateClassFilterDropdown();

                if(!document.getElementById('view-marks')?.classList.contains('hidden')){
                    initializeMarksScopeControls();
                    updateAssessmentDropdown();
                    renderMarksModule();
                }
                if(!document.getElementById('view-pbd')?.classList.contains('hidden'))initializePbdModule(true);
                if(!document.getElementById('view-analytics-marks')?.classList.contains('hidden')&&typeof initializeMarksAnalytics==='function')initializeMarksAnalytics();
                if(!document.getElementById('view-analytics-pbd')?.classList.contains('hidden')&&typeof renderPbdAnalytics==='function')renderPbdAnalytics();
                if(!document.getElementById('view-headcount')?.classList.contains('hidden')&&typeof renderHeadcount==='function')renderHeadcount();
                if(!document.getElementById('view-users')?.classList.contains('hidden')&&typeof renderUsers==='function')renderUsers();
                if(!document.getElementById('view-classes')?.classList.contains('hidden')&&typeof renderClasses==='function')renderClasses();
                updateDashboardKPIs();
            }catch(err){
                console.warn('Realtime UI refresh:',err);
            }
        },140);
    }

    function phase10ScheduleRemoteRefresh(profile){
        clearTimeout(phase10RealtimeRemoteTimer);
        phase10RealtimeRemoteTimer=setTimeout(async()=>{
            try{
                await phase10LoadRemoteState(profile,false);
                phase10ScheduleUiRefresh();
                phase10SetStatus('SUPABASE','Live sync aktif.');
            }catch(err){
                console.warn('Supabase realtime refresh:',err);
            }
        },280);
    }

    function phase10StartRealtimeSync(profile) {
        if(!phase10Db||!phase10SignedInUser)return;
        phase10StopRealtimeSync();

        // Scores are merged directly. A single mark edit must not trigger
        // a full state reload that can overwrite an in-flight local value.
        const tables=[
            'classes','students','assessments',
            'pbdRecords','pbdGroupLevels','pbdOverall','pbdLocks',
            'interventions','users','settings','headcount'
        ];

        let channel=phase10Db.channel(`isejarah-live-${phase10SignedInUser.id}-${Date.now()}`);

        channel=channel.on(
            'postgres_changes',
            {
                event:'*',
                schema:'public',
                table:phase10Collection('scores')
            },
            payload=>{
                const eventType=String(payload?.eventType||'').toUpperCase();
                const id=String(payload?.new?.id||payload?.old?.id||'');
                if(!id)return;

                if(eventType==='DELETE'){
                    if(!phase10PendingScoreWrites.has(id)){
                        appState.scores=appState.scores.filter(s=>String(s.id)!==id);
                    }
                }else{
                    const incoming=phase10DocData(payload.new);
                    if(incoming&&!phase10PendingScoreWrites.has(id)){
                        const idx=appState.scores.findIndex(s=>String(s.id)===id);
                        if(idx>=0)appState.scores[idx]=incoming;
                        else appState.scores.push(incoming);
                    }
                }

                persistMarksState();
                phase10SetStatus('SUPABASE','Live sync: scores');
                phase10ScheduleUiRefresh();
            }
        );

        tables.forEach(key=>{
            channel=channel.on(
                'postgres_changes',
                {
                    event:'*',
                    schema:'public',
                    table:phase10Collection(key)
                },
                ()=>phase10ScheduleRemoteRefresh(profile)
            );
        });

        channel.subscribe(status=>{
            if(status==='SUBSCRIBED')phase10SetStatus('SUPABASE','Realtime subscribed.');
        });

        phase10RealtimeUnsubscribers.push(()=>{
            try{phase10Db.removeChannel(channel);}catch(_){}
        });
    }

    async function phase10TestConnection() {
        if(!isAdminSession()){
            showAlert('Akses Ditolak','Hanya Admin boleh menguji konfigurasi Supabase.','danger');
            return;
        }
        const ready=await phase10InitFirebase();
        if(!ready){
            showAlert('Supabase Belum Dikonfigurasi','Project URL atau Publishable Key belum lengkap.','info');
            return;
        }

        try{
            const {data,error}=await phase10Auth.getSession();
            if(error)throw error;
            const user=data?.session?.user||null;

            if(!user){
                showAlert('Supabase Sedia','SDK Supabase berjaya dimulakan. Log masuk semula untuk menguji Authentication dan Database sepenuhnya.','success');
                return;
            }

            const {error:testError}=await phase10Db.from(phase10Collection('settings')).select('id').limit(1);
            if(testError)throw testError;

            phase10SetStatus('SUPABASE');
            showAlert('Sambungan Berjaya',`Supabase Authentication, Postgres dan Realtime sedia untuk projek ${phase10ProjectLabel()}.`,'success');
        }catch(err){
            phase10SetStatus('ERROR');
            showAlert('Sambungan Gagal',phase10FriendlyError(err),'danger');
        }
    }

    async function phase10ReloadFromSupabase() {
        if(!isAdminSession()){
            showAlert('Akses Ditolak','Hanya Admin boleh memaksa penyelarasan penuh.','danger');
            return;
        }
        if(!phase10SignedInUser){
            showAlert('Belum Log Masuk Supabase','Aktifkan konfigurasi Supabase dan log masuk semula dahulu.','info');
            return;
        }
        await phase10LoadRemoteState(phase10CurrentFirebaseProfile||{role:currentUserRole,id:currentUserId},true);
        updateClassFilterDropdown();
        updateAssessmentDropdown();
        updateDashboardKPIs();
        initCharts();
    }

    async function phase10SeedCurrentData() {
        if(!isAdminSession()){
            showAlert('Akses Ditolak','Migrasi data hanya untuk Admin.','danger');
            return;
        }
        if(!phase10SignedInUser || phase10Mode!=='SUPABASE'){
            showAlert('Supabase Tidak Aktif','Log masuk melalui Supabase terlebih dahulu.','info');
            return;
        }

        showAlert(
            'Migrasi Data ke Supabase',
            'Ini akan memuat naik data semasa ke Supabase. Rekod dengan ID sama akan dikemas kini, bukan diduplikasi. Teruskan?',
            'info',
            async()=>{
                try{
                    phase10SetStatus('SYNCING');
                    await phase10BatchUpsert('classes',appState.classes);
                    await phase10BatchUpsert('students',appState.students);
                    await phase10BatchUpsert('assessments',appState.assessments,r=>({subject:r.subject||'SEJARAH'}));
                    await phase10BatchUpsert('scores',appState.scores);
                    await phase10BatchUpsert('pbdRecords',appState.pbdRecords);
                    await phase10BatchUpsert('pbdGroupLevels',appState.pbdGroupLevels||[]);
                    await phase10BatchUpsert('pbdOverall',appState.pbdOverall||[]);
                    await phase10BatchUpsert('pbdLocks',appState.pbdLocks||[]);
                    await phase10BatchUpsert('interventions',appState.interventions||[]);
                    await phase10BatchUpsert(
                        'auditLogs',
                        (appState.auditLogs||[]).map(x=>({...x,actorUid:x.actorUid||phase10SignedInUser.id}))
                    );

                    for(const u of mockTeachers){
                        const role=u.role==='KETUA_PANITIA'?'ADMIN':u.role;
                        const loginId=role==='ADMIN'
                            ? 'ADMIN'
                            : String(u.loginId||u.mykad||u.myKad||u.staffId||'').replace(/\D/g,'');
                        if(!loginId)continue;

                        const data={
                            ...phase10CleanValue(u),
                            legacyId:u.id,
                            loginId,
                            mykad:role==='GURU_SEJARAH'?loginId:'',
                            role,
                            active:u.active!==false
                        };
                        delete data.id;
                        delete data.firebaseUid;
                        await phase10Upsert('users',loginId,data);
                    }

                    await phase10Upsert('settings','school',phase9SchoolProfile);

                    const studentIds=new Set();
                    Object.keys(headcountState.interventions||{}).forEach(k=>{
                        studentIds.add(k.split('|').slice(1).join('|'));
                    });
                    for(const studentId of studentIds){
                        await phase10SyncHeadcountStudent(studentId);
                    }

                    phase10SetStatus('SUPABASE');
                    showAlert('Migrasi Selesai','Data semasa telah dimuat naik ke Supabase.','success');
                }catch(err){
                    console.error(err);
                    phase10SetStatus('ERROR');
                    showAlert('Migrasi Gagal',phase10FriendlyError(err),'danger');
                }
            }
        );
    }


    function phase10SetLoginBusy(busy) {
        const btn=document.getElementById('login-submit-btn');
        if(!btn)return;
        btn.classList.toggle('phase10-busy',busy);
        btn.disabled=busy;
        if(busy){
            btn.dataset.originalText=btn.textContent;
            btn.textContent='Mengesahkan akaun...';
        }else{
            btn.textContent=btn.dataset.originalText || (selectedLoginRole==='ADMIN'?'Log Masuk sebagai Admin (KP Sejarah)':'Log Masuk sebagai Guru Sejarah');
        }
    }

    // Initialize status only. We intentionally DO NOT auto-bypass the login
    // screen even if Supabase has a persisted anonymous auth session.
    setTimeout(()=>phase10InitFirebase(),0);


    function phase10ShowFastLoginSync(show,message='Menyelaraskan data...') {
        let el=document.getElementById('phase10-fast-login-sync');
        if(!el){
            el=document.createElement('div');
            el.id='phase10-fast-login-sync';
            el.innerHTML=`
                <span class="phase10-fast-spinner" aria-hidden="true"></span>
                <span id="phase10-fast-login-message"></span>`;
            document.body.appendChild(el);
        }
        const msg=el.querySelector('#phase10-fast-login-message');
        if(msg)msg.textContent=message;
        el.classList.toggle('is-visible',Boolean(show));
    }

    function phase10ShowBareInitialView(profile) {
        const tabId=profile.role==='ADMIN'?'dashboard':'marks';

        if(typeof views!=='undefined'){
            views.forEach(v=>document.getElementById(`view-${v}`)?.classList.add('hidden'));
        }
        document.getElementById(`view-${tabId}`)?.classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(el=>{
            el.classList.remove('tab-active','text-slate-100','bg-navy-900/70');
            el.classList.add('text-slate-400');
        });
        const activeNav=document.getElementById(`nav-${tabId}`);
        if(activeNav){
            activeNav.classList.add('tab-active');
            activeNav.classList.remove('text-slate-400');
        }
    }

    function phase10EnterAuthenticatedShell(profile) {
        document.getElementById('login-overlay').style.display='none';
        applyRoleAccessUI(true);
        phase10ShowBareInitialView(profile);
        phase10ShowFastLoginSync(
            true,
            profile.role==='ADMIN'
                ? 'Akaun disahkan · memuat data dashboard...'
                : 'Akaun disahkan · memuat kelas & markah...'
        );
    }

    function phase10FinishCoreLogin(profile) {
        // Called as soon as essential classes/students/assessments/scores are ready.
        applyRoleAccessUI(false);
        updateClassFilterDropdown();
        updateAssessmentDropdown();

        if(profile.role==='ADMIN'){
            updateDashboardKPIs();
            navigateTab('dashboard');
        }else{
            navigateTab('marks');
        }

        phase10ShowFastLoginSync(false);
    }

    async function phase10HydrateAfterLogin(profile,token) {
        let coreFinished=false;
        const finishCore=()=>{
            if(coreFinished||token!==phase10LoginHydrationToken)return;
            coreFinished=true;
            phase10FinishCoreLogin(profile);
        };

        const ok=await phase10LoadRemoteState(profile,false,finishCore);
        if(token!==phase10LoginHydrationToken)return;

        // If a very small/empty account had no separate core event, still enter.
        finishCore();

        if(ok){
            ensureAutoAssessmentTemplates(
                true,
                document.getElementById('filter-academic-year')?.value||getActiveAcademicYear()
            );
            phase10StartRealtimeSync(profile);

            updateClassFilterDropdown();
            updateAssessmentDropdown();
            if(typeof updateDashboardKPIs==='function')updateDashboardKPIs();

            // Refresh only the currently visible module. Heavy charts are not
            // created during authentication itself.
            if(!document.getElementById('view-marks')?.classList.contains('hidden')){
                initializeMarksScopeControls();
                renderMarksModule();
            }else if(!document.getElementById('view-dashboard')?.classList.contains('hidden')){
                setTimeout(initCharts,80);
            }

            phase10SetStatus('SUPABASE','Fast login · live sync aktif.');
        }else{
            phase10ShowFastLoginSync(false);
            showAlert(
                'Akaun Berjaya Disahkan',
                'Log masuk berjaya tetapi penyelarasan data Supabase mengambil masa atau gagal. Semak sambungan internet dan cuba Tarik Data jika perlu.',
                'info'
            );
        }
    }

    async function login() {
        const userIdRaw=document.getElementById('login-email')?.value.trim()||'';
        const password=document.getElementById('login-password')?.value||'';
        const userId=normalizeLoginUserId(userIdRaw);

        if(!userId||!password){
            showAlert('Maklumat Tidak Lengkap','Sila masukkan User ID dan kata laluan.','info');
            return;
        }

        if(selectedLoginRole==='ADMIN'&&userId!=='ADMIN'){
            showAlert('User ID Tidak Sah','User ID untuk Admin (KP Sejarah) mestilah ADMIN.','danger');
            return;
        }

        if(selectedLoginRole==='GURU_SEJARAH'){
            if(!/^\d{12}$/.test(userId)){
                showAlert('MyKad Tidak Sah','Masukkan nombor MyKad guru sebanyak 12 digit.','danger');
                return;
            }
            if(password!==userId){
                showAlert('Kata Laluan Tidak Sah','Untuk Guru Sejarah, kata laluan mestilah nombor MyKad yang sama dengan User ID.','danger');
                return;
            }
        }

        phase10SetLoginBusy(true);
        try{
            let profile=null;

            if(phase10Configured()){
                // Only Authentication + profile verification are blocking.
                profile=await phase10Authenticate(userId,password);
                if(!profile)throw new Error('Supabase Authentication tidak dapat dimulakan.');

                setSessionUser(profile);
                const token=++phase10LoginHydrationToken;

                // Enter the system immediately after the account is verified.
                phase10EnterAuthenticatedShell(profile);

                // Supabase Database data continues asynchronously.
                void phase10HydrateAfterLogin(profile,token);
            }else{
                profile=getLoginProfile(userId);
                if(!profile){
                    const roleName=selectedLoginRole==='ADMIN'?'Admin (KP Sejarah)':'Guru Sejarah';
                    showAlert('Log Masuk Tidak Berjaya',`User ID ini tidak sepadan dengan akaun ${roleName} yang aktif.`,'danger');
                    return;
                }
                if(selectedLoginRole==='GURU_SEJARAH'&&password!==userId){
                    showAlert('Log Masuk Tidak Berjaya','Kata laluan Guru Sejarah mestilah nombor MyKad yang sama.','danger');
                    return;
                }

                setSessionUser({...profile,loginId:selectedLoginRole==='ADMIN'?'ADMIN':userId});
                phase10SetStatus('LOCAL');
                document.getElementById('login-overlay').style.display='none';
                applyRoleAccessUI();
                updateClassFilterDropdown();
                updateAssessmentDropdown();
                if(typeof renderDskp==='function')renderDskp();
                updateDashboardKPIs();

                if(isAdminSession())navigateTab('dashboard');
                else navigateTab('marks');
            }
        }catch(err){
            console.error('Login error:',err);
            try{if(phase10Auth)await phase10Auth.signOut();}catch(_){}
            phase10StopRealtimeSync();
            phase10SignedInUser=null;
            phase10CurrentFirebaseProfile=null;
            phase10LoginHydrationToken++;
            phase10ShowFastLoginSync(false);

            const code=String(err?.code||'');
            const msg=code.includes('auth/invalid-credential')||code.includes('auth/wrong-password')
                ? 'User ID atau kata laluan tidak sah.'
                : code.includes('auth/user-not-found')
                    ? 'Profil Supabase untuk User ID ini belum diwujudkan.'
                    : phase10FriendlyError(err);

            showAlert('Log Masuk Tidak Berjaya',msg,'danger');
        }finally{
            phase10SetLoginBusy(false);
        }
    }

    function logout() {
        showAlert('Log Keluar', 'Anda pasti mahu log keluar daripada sistem?', 'info', async () => {
            phase10LoginHydrationToken++;
            phase10ShowFastLoginSync(false);
            document.querySelectorAll('[id^="modal-"]').forEach(modal => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            });

            try{
                if(phase10Auth) await phase10Auth.signOut();
            }catch(err){console.warn('Supabase sign out:',err);}
            phase10SignedInUser=null;
            phase10CurrentFirebaseProfile=null;

            if (typeof views !== 'undefined') {
                views.forEach(v => document.getElementById(`view-${v}`)?.classList.add('hidden'));
            }
            document.getElementById('view-dashboard')?.classList.remove('hidden');

            const overlay = document.getElementById('login-overlay');
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
            selectLoginRole(selectedLoginRole);
            phase10SetStatus(phase10Configured()?'SUPABASE':'LOCAL');
        });
    }

    restoreTheme();

    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    let sidebarOpen = false;

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
        if (sidebarOpen) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    // ==============================================================
    // TWO-ROLE SESSION & RBAC: ADMIN (KP SEJARAH) / GURU SEJARAH
    // ==============================================================
    let selectedLoginRole = 'ADMIN';

    const ROLE_ALLOWED_VIEWS = {
        ADMIN: ['dashboard', 'teacher-dashboard', 'completeness', 'attention', 'students', 'classes', 'marks', 'pbd', 'analytics-marks', 'headcount', 'analytics-pbd', 'analytics-student', 'analytics-class', 'intervention', 'admin-tools', 'executive-report', 'reports', 'import-export', 'users', 'settings'],
        GURU_SEJARAH: ['teacher-dashboard', 'completeness', 'attention', 'marks', 'pbd', 'analytics-marks', 'headcount', 'analytics-pbd', 'intervention']
    };

    function isAdminSession() { return currentUserRole === 'ADMIN'; }
    function isTeacherSession() { return currentUserRole === 'GURU_SEJARAH'; }
    function isViewAllowed(tabId) { return (ROLE_ALLOWED_VIEWS[currentUserRole] || []).includes(tabId); }

    function selectLoginRole(role) {
        selectedLoginRole = role === 'GURU_SEJARAH' ? 'GURU_SEJARAH' : 'ADMIN';
        const adminCard = document.getElementById('login-role-admin');
        const teacherCard = document.getElementById('login-role-teacher');
        const userId = document.getElementById('login-email');
        const password = document.getElementById('login-password');
        const userIdLabel = document.getElementById('login-userid-label');
        const submit = document.getElementById('login-submit-btn');
        const adminActive = selectedLoginRole === 'ADMIN';

        [adminCard, teacherCard].forEach(card => {
            if (!card) return;
            card.classList.remove('border-emerald-500','bg-emerald-50','border-blue-500','bg-blue-50');
            card.classList.add('border-slate-200','bg-white');
        });

        if(password) password.value='';

        if (adminActive) {
            adminCard?.classList.remove('border-slate-200','bg-white');
            adminCard?.classList.add('border-emerald-500','bg-emerald-50');

            if(userId){
                userId.value='ADMIN';
                userId.placeholder='ADMIN';
                userId.inputMode='text';
                userId.maxLength=20;
            }
            if(userIdLabel) userIdLabel.textContent='User ID';
            if (submit) submit.textContent = 'Log Masuk sebagai Admin (KP Sejarah)';
        } else {
            teacherCard?.classList.remove('border-slate-200','bg-white');
            teacherCard?.classList.add('border-blue-500','bg-blue-50');

            if(userId){
                userId.value='';
                userId.placeholder='Masukkan MyKad';
                userId.inputMode='numeric';
                userId.maxLength=14;
            }
            if(userIdLabel) userIdLabel.textContent='User ID / MyKad';
            if (submit) submit.textContent = 'Log Masuk sebagai Guru Sejarah';
        }
        if((window.MATTARY_SUPABASE_CONFIG?.authMode||'legacy_anonymous')==='password'){
            if(userId){userId.type='email';userId.value='';userId.placeholder='nama@sekolah.edu.my';userId.inputMode='email';userId.maxLength=254;}
            if(userIdLabel)userIdLabel.textContent='Email Supabase Auth';
        }
        lucide.createIcons();
    }

    document.addEventListener('DOMContentLoaded', () => {
        selectLoginRole('ADMIN');
    }, { once: true });

    function normalizeLoginUserId(value,role=selectedLoginRole) {
        const raw=String(value||'').trim();
        if(role==='ADMIN') return raw.toUpperCase();
        return raw.replace(/\D/g,'');
    }

    function getLoginProfile(userId) {
        const normalizedId=normalizeLoginUserId(userId);
        return mockTeachers.find(u => {
            const normalizedRole = u.role === 'KETUA_PANITIA' ? 'ADMIN' : u.role;
            if(u.active===false || normalizedRole!==selectedLoginRole) return false;

            if(selectedLoginRole==='ADMIN'){
                return normalizedId==='ADMIN';
            }

            const candidates=[
                u.loginId,
                u.mykad,
                u.myKad,
                u.staffId,
                u.userId,
                u.id
            ].filter(Boolean).map(v=>String(v).replace(/\D/g,''));

            return candidates.includes(normalizedId);
        }) || null;
    }

    function setSessionUser(profile) {
        currentUserId = profile.id;
        currentUserRole = profile.role === 'KETUA_PANITIA' ? 'ADMIN' : profile.role;
        currentRole = currentUserRole;

        const roleBadge = document.getElementById('current-role-badge');
        const roleLabel = document.getElementById('sidebar-role-label');
        const userName = document.getElementById('user-display-name');
        const bannerName = document.getElementById('banner-user-name');
        const userEmail = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar-initial');

        if (isAdminSession()) {
            if (roleBadge) { roleBadge.textContent = 'ADMIN · KP SEJARAH'; roleBadge.className = 'text-purple-700 font-bold'; }
            if (roleLabel) roleLabel.textContent = 'Admin · Ketua Panitia Sejarah';
        } else {
            if (roleBadge) { roleBadge.textContent = 'GURU SEJARAH'; roleBadge.className = 'text-blue-700 font-bold'; }
            if (roleLabel) roleLabel.textContent = 'Guru Sejarah · Akses Kelas Tugasan';
        }

        if (userName) userName.textContent = profile.name;
        if (bannerName) bannerName.textContent = profile.name;
        if (userEmail) {
            const displayLoginId = profile.loginId || profile.mykad || profile.myKad || profile.staffId || (isAdminSession() ? 'ADMIN' : profile.email) || '—';
            userEmail.textContent = displayLoginId;
        }
        if (userAvatar) userAvatar.textContent = (profile.name || 'U').trim().charAt(0).toUpperCase();
    }

    function applyRoleAccessUI(skipDataInit=false) {
        const teacherAllowedNav = new Set([
            'nav-teacher-dashboard','nav-completeness','nav-attention',
            'nav-marks','nav-pbd','nav-analytics-marks','nav-headcount','nav-analytics-pbd',
            'nav-intervention'
        ]);
        const allNav = [...document.querySelectorAll('.nav-item')];
        const adminGroupLabel=document.getElementById('nav-group-admin-label');

        if (isAdminSession()) {
            allNav.forEach(el => el.classList.remove('hidden'));
            ['nav-group-main','nav-group-data','nav-group-assessment','nav-group-analytics','nav-group-admin'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
            if(adminGroupLabel)adminGroupLabel.textContent='Laporan & Pentadbiran';
        } else {
            allNav.forEach(el => el.classList.toggle('hidden', !teacherAllowedNav.has(el.id)));
            document.getElementById('nav-group-main')?.classList.remove('hidden');
            document.getElementById('nav-group-data')?.classList.add('hidden');
            document.getElementById('nav-group-admin')?.classList.add('hidden');
            document.getElementById('nav-group-assessment')?.classList.remove('hidden');
            document.getElementById('nav-group-analytics')?.classList.remove('hidden');
            ['nav-dashboard','nav-analytics-student','nav-analytics-class'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
            if(adminGroupLabel)adminGroupLabel.textContent='Laporan & Pentadbiran';
        }

        ['btn-add-assessment','btn-edit-assessment','btn-lock-assessment','btn-pbd-lock'].forEach(id => {
            document.getElementById(id)?.classList.toggle('hidden', !isAdminSession());
        });
        document.getElementById('report-settings-link')?.classList.toggle('hidden',!isAdminSession());
        document.getElementById('headcount-print-report-btn')?.classList.toggle('hidden',isTeacherSession());

        const accessNote = document.getElementById('marks-access-note');
        if (accessNote) accessNote.textContent = isAdminSession()
            ? 'Admin boleh memilih semua kelas.'
            : 'Guru hanya boleh memilih kelas yang telah ditugaskan kepadanya.';

        if(!skipDataInit)initializeMarksScopeControls();
        lucide.createIcons();
    }


    // ==============================================================
    // PBD MATRIX CONTROLLER — Professional Auto-Average Edition
    // ==============================================================
    function getPbdMatrixTemplate(year) { return PBD_MATRIX_TEMPLATES[Number(year)] || PBD_MATRIX_TEMPLATES[4]; }
    function getPbdMatrixClass() { return appState.classes.find(c => c.id === document.getElementById('pbd-class')?.value); }
    function getPbdMatrixPeriod() { return document.getElementById('pbd-period')?.value || 'PERTENGAHAN'; }
    function getPbdMatrixStudents() {
        const classId=document.getElementById('pbd-class')?.value||'';
        return sortStudentsAZ(appState.students.filter(s=>s.classId===classId&&s.status==='Aktif'));
    }
    function pbdMatrixDskpForTopic(year, groupKey, topicIndex) {
        return appState.dskp.find(d=>Number(d.yearLevel)===Number(year)&&d.matrixGroupKey===groupKey&&Number(d.matrixTopicIndex)===Number(topicIndex));
    }
    function pbdResolveAcademicYear(academicYear=null) {
        return String(
            academicYear ||
            document.getElementById('filter-academic-year')?.value ||
            getActiveAcademicYear?.() ||
            '2026'
        );
    }

    // Exact record = only the selected assessment period.
    // This function is deliberately kept exact so editing AKHIR never changes
    // the original PERTENGAHAN record.
    function getPbdMatrixRecord(studentId,dskpId,period,academicYear=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        return appState.pbdRecords.find(r=>
            r.studentId===studentId &&
            r.dskpId===dskpId &&
            r.assessmentPeriod===period &&
            String(r.academicYear||ay)===ay
        );
    }

    // Effective PBD continuity:
    // AKHIR uses its own value when available; otherwise it carries forward
    // the PERTENGAHAN value as the baseline.
    function getEffectivePbdMatrixRecord(studentId,dskpId,period,academicYear=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        const exact=getPbdMatrixRecord(studentId,dskpId,period,ay);
        if(exact){
            return {
                ...exact,
                effectiveAssessmentPeriod:period,
                inheritedFromPeriod:null,
                inherited:false
            };
        }

        if(period==='AKHIR'){
            const baseline=getPbdMatrixRecord(studentId,dskpId,'PERTENGAHAN',ay);
            if(baseline){
                return {
                    ...baseline,
                    assessmentPeriod:'AKHIR',
                    effectiveAssessmentPeriod:'AKHIR',
                    sourceAssessmentPeriod:'PERTENGAHAN',
                    sourceRecordId:baseline.id,
                    inheritedFromPeriod:'PERTENGAHAN',
                    inherited:true
                };
            }
        }
        return null;
    }

    function getEffectivePbdRecordsForScope(studentIds,dskpIds,academicYear,period) {
        const students=[...(studentIds instanceof Set?studentIds:new Set(studentIds||[]))];
        const dskps=[...(dskpIds instanceof Set?dskpIds:new Set(dskpIds||[]))];
        const rows=[];

        students.forEach(studentId=>{
            dskps.forEach(dskpId=>{
                const rec=getEffectivePbdMatrixRecord(studentId,dskpId,period,academicYear);
                if(rec?.tp)rows.push(rec);
            });
        });
        return rows;
    }

    function getLatestEffectivePbdPeriodForStudent(studentId,academicYear=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        const hasAkhir=appState.pbdRecords.some(r=>
            r.studentId===studentId &&
            r.assessmentPeriod==='AKHIR' &&
            String(r.academicYear||ay)===ay &&
            r.tp
        );
        return hasAkhir?'AKHIR':'PERTENGAHAN';
    }

    function getEffectivePbdOverall(studentId,period,academicYear=null,yearLevel=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        const exact=(appState.pbdOverall||[]).find(o=>
            o.studentId===studentId &&
            o.assessmentPeriod===period &&
            String(o.academicYear||ay)===ay
        );

        // Preserve explicitly teacher-confirmed/manual overall TP.
        if(exact && exact.calculationMode && !['AUTO_THEME_AVERAGE','AUTO_SK_AVERAGE'].includes(exact.calculationMode)){
            return exact;
        }

        const student=appState.students.find(s=>s.id===studentId);
        const year=Number(yearLevel||student?.year||4);
        const template=getPbdMatrixTemplate(year);
        const calc=calculateStudentFinalAverage(studentId,template,year,period,ay);

        if(calc.complete){
            return {
                ...(exact||{}),
                id:exact?.id||`effective_overall_${studentId}_${ay}_${period}`,
                studentId,
                academicYear:ay,
                assessmentPeriod:period,
                overallTP:calc.avg,
                averageTP:calc.avg,
                calculated:true,
                calculationMode:'AUTO_THEME_AVERAGE',
                effective:true
            };
        }

        // If AKHIR has not become complete yet, the baseline overall remains
        // available as continuity only when no exact end-year overall exists.
        if(period==='AKHIR'&&!exact){
            const baseline=(appState.pbdOverall||[]).find(o=>
                o.studentId===studentId &&
                o.assessmentPeriod==='PERTENGAHAN' &&
                String(o.academicYear||ay)===ay
            );
            if(baseline){
                return {
                    ...baseline,
                    assessmentPeriod:'AKHIR',
                    inheritedFromPeriod:'PERTENGAHAN',
                    inherited:true,
                    effective:true
                };
            }
        }

        return exact||null;
    }

    function getPbdGroupLevel(studentId,groupKey,period) {
        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        return (appState.pbdGroupLevels||[]).find(r=>r.studentId===studentId&&r.groupKey===groupKey&&r.assessmentPeriod===period&&String(r.academicYear)===String(academicYear));
    }
    function getPbdMatrixOverall(studentId,period) {
        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        return appState.pbdOverall.find(r=>r.studentId===studentId&&r.assessmentPeriod===period&&String(r.academicYear)===String(academicYear));
    }

    function pbdAvgClass(avg) {
        if (avg===null || avg===undefined || !Number.isFinite(Number(avg))) return 'pbd-incomplete-chip';
        const v=Number(avg);
        if(v<2) return 'pbd-avg-low';
        if(v<3) return 'pbd-avg-mid';
        if(v<4) return 'pbd-avg-good';
        if(v<5) return 'pbd-avg-high';
        return 'pbd-avg-excellent';
    }
    function pbdTpClass(tp) {
        return [1,2,3,4,5,6].includes(Number(tp)) ? `pbd-tp-${Number(tp)}` : 'pbd-tp-blank';
    }
    function applyPbdTpTone(select) {
        if(!select)return;
        select.classList.remove('pbd-tp-blank','pbd-tp-1','pbd-tp-2','pbd-tp-3','pbd-tp-4','pbd-tp-5','pbd-tp-6');
        select.classList.add(pbdTpClass(select.value));
    }

    function pbdMatrixCanWrite() {
        const classId=document.getElementById('pbd-class')?.value||'';
        const period=getPbdMatrixPeriod();
        const type=pbdAssessmentTypeFromPeriod(period);
        if(!isAssessmentEntryOpen('pbd',type)){showAlert('Pengisian PBD Ditutup',pbdEntryClosedMessage(period),'info');return false;}
        if(!classId||!canEditPbdClass(classId)){showAlert('Akses Ditolak','Guru hanya boleh mengisi PBD untuk kelas yang ditugaskan kepadanya.','danger');return false;}
        if(isPbdLocked(classId,period)){showAlert('PBD Dikunci','Rekod PBD kelas ini telah dikunci oleh Admin (KP Sejarah).','danger');return false;}
        return true;
    }

    function createTpSelect(value,onchangeCode,disabled=false,title='') {
        const options=['<option value=""></option>'].concat([1,2,3,4,5,6].map(tp=>`<option value="${tp}" ${Number(value)===tp?'selected':''}>TP${tp}</option>`)).join('');
        return `<select ${disabled?'disabled':''} title="${escapeHtml(title)}" onchange="applyPbdTpTone(this);${onchangeCode}" class="pbd-tp-select ${pbdTpClass(value)} disabled:opacity-60">${options}</select>`;
    }

    function calculateStudentThemeAverage(studentId,group,year,period,academicYear=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        const dskps=group.topics.map((_,idx)=>pbdMatrixDskpForTopic(year,group.key,idx)).filter(Boolean);
        const values=dskps.map(d=>Number(getEffectivePbdMatrixRecord(studentId,d.id,period,ay)?.tp||0));
        const recorded=values.filter(v=>v>=1&&v<=6);
        const complete=dskps.length>0&&recorded.length===dskps.length;
        const rawAvg=complete?recorded.reduce((a,b)=>a+b,0)/recorded.length:null;
        const avg=rawAvg===null?null:Math.max(1,Math.min(6,Math.round(rawAvg)));
        return {complete,recorded:recorded.length,total:dskps.length,rawAvg,avg};
    }

    function calculateStudentFinalAverage(studentId,template,year,period,academicYear=null) {
        const ay=pbdResolveAcademicYear(academicYear);
        const themes=template.groups.map(group=>({
            group,
            ...calculateStudentThemeAverage(studentId,group,year,period,ay)
        }));
        const complete=themes.length>0&&themes.every(x=>x.complete);
        const rawAvg=complete?themes.reduce((sum,x)=>sum+x.avg,0)/themes.length:null;
        const avg=rawAvg===null?null:Math.max(1,Math.min(6,Math.round(rawAvg)));
        return {complete,rawAvg,avg,themes};
    }

    function syncPbdDerivedLevelsForStudent(studentId,persist=false) {
        const year=Number(document.getElementById('pbd-year')?.value||4);
        const period=getPbdMatrixPeriod();
        const classId=document.getElementById('pbd-class')?.value||'';
        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        const template=getPbdMatrixTemplate(year);
        if(!Array.isArray(appState.pbdGroupLevels))appState.pbdGroupLevels=[];

        template.groups.forEach(group=>{
            const calc=calculateStudentThemeAverage(studentId,group,year,period,academicYear);
            const idx=appState.pbdGroupLevels.findIndex(r=>r.studentId===studentId&&r.groupKey===group.key&&r.assessmentPeriod===period&&String(r.academicYear)===String(academicYear));
            if(calc.complete){
                const payload={id:idx>=0?appState.pbdGroupLevels[idx].id:`pbdgrp_${studentId}_${group.key}_${period}`,studentId,groupKey:group.key,groupName:group.name,classId,academicYear,assessmentPeriod:period,tp:calc.avg,averageTP:calc.avg,calculated:true,calculationMode:'AUTO_SK_AVERAGE',teacherId:currentUserId,updatedAt:new Date().toISOString()};
                if(idx>=0)appState.pbdGroupLevels[idx]={...appState.pbdGroupLevels[idx],...payload};else appState.pbdGroupLevels.push(payload);
            } else if(idx>=0) appState.pbdGroupLevels.splice(idx,1);
        });

        const finalCalc=calculateStudentFinalAverage(studentId,template,year,period,academicYear);
        const oIdx=appState.pbdOverall.findIndex(r=>r.studentId===studentId&&r.assessmentPeriod===period&&String(r.academicYear)===String(academicYear));
        if(finalCalc.complete){
            const avg=finalCalc.avg;
            const payload={id:oIdx>=0?appState.pbdOverall[oIdx].id:`overall_${studentId}_${academicYear}_${period}`,studentId,classId,academicYear,assessmentPeriod:period,overallTP:avg,averageTP:avg,teacherId:currentUserId,calculated:true,calculationMode:'AUTO_THEME_AVERAGE',confirmedByTeacher:false,updatedAt:new Date().toISOString()};
            if(oIdx>=0)appState.pbdOverall[oIdx]={...appState.pbdOverall[oIdx],...payload};else appState.pbdOverall.push(payload);
        } else if(oIdx>=0 && appState.pbdOverall[oIdx].calculationMode==='AUTO_THEME_AVERAGE') appState.pbdOverall.splice(oIdx,1);

        if(persist)persistPhase4State();
        return finalCalc;
    }

    function syncPbdDerivedLevelsForCurrentClass() {
        const students=getPbdMatrixStudents();
        students.forEach(s=>syncPbdDerivedLevelsForStudent(s.id,false));
        persistPhase4State();
    }

    function syncPbdPeriodAvailability() {
        const el=document.getElementById('pbd-period');
        if(!el)return;
        const previous=el.value;
        const options=[
            {period:'PERTENGAHAN',type:'UPSA',label:'Pertengahan Tahun'},
            {period:'AKHIR',type:'UASA',label:'Akhir Tahun'}
        ];
        const visible=isTeacherSession()?options.filter(x=>isAssessmentEntryOpen('pbd',x.type)):options;
        el.innerHTML=visible.length
            ? visible.map(x=>`<option value="${x.period}">${x.label}${isAdminSession()&&!isAssessmentEntryOpen('pbd',x.type)?' · Ditutup':''}</option>`).join('')
            : '<option value="">Tiada PBD diaktifkan</option>';
        if(visible.some(x=>x.period===previous))el.value=previous;
        else el.value=visible[0]?.period||'';
    }

    function initializePbdModule(preserveCurrent=false) {
        syncPbdPeriodAvailability();
        const yearEl=document.getElementById('pbd-year'),classEl=document.getElementById('pbd-class'),periodEl=document.getElementById('pbd-period');
        if(!yearEl||!classEl||!periodEl)return;
        const globalYear=document.getElementById('filter-tahun')?.value||'ALL';
        const globalClass=document.getElementById('filter-kelas')?.value||'ALL';
        const oldYear=preserveCurrent?yearEl.value:'',oldClass=preserveCurrent?classEl.value:'';
        if(!preserveCurrent){
            if(['4','5','6'].includes(String(globalYear)))yearEl.value=String(globalYear);
            else if(isTeacherSession()){const firstAssigned=getPermittedClassesForPbd()[0];yearEl.value=firstAssigned?String(firstAssigned.year):'4';}
            else yearEl.value='4';
        } else if(oldYear)yearEl.value=oldYear;
        populatePbdMatrixClassOptions(oldClass||(globalClass!=='ALL'?globalClass:''));
        const note=document.getElementById('pbd-matrix-access-note');
        if(note)note.textContent=isTeacherSession()?'Guru hanya boleh mengisi kelas yang ditugaskan kepadanya. Purata Tema dan Tahap Akhir dikira automatik.':'Admin boleh mengisi semua kelas. Purata Tema dan Tahap Akhir dikira automatik.';
        const lockBtn=document.getElementById('btn-pbd-lock');if(lockBtn)lockBtn.classList.toggle('hidden',!isAdminSession());
        renderPbdModule();
    }

    function populatePbdMatrixClassOptions(preferredClassId='') {
        const year=Number(document.getElementById('pbd-year')?.value||4),classEl=document.getElementById('pbd-class');if(!classEl)return;
        let classes=getPermittedClassesForPbd().filter(c=>Number(c.year)===year).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
        classEl.innerHTML=classes.length?'<option value="">Pilih Kelas</option>'+classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join(''):'<option value="">Tiada Kelas Ditugaskan</option>';
        if(classes.some(c=>c.id===preferredClassId))classEl.value=preferredClassId;else if(classes.length===1||isTeacherSession())classEl.value=classes[0]?.id||'';
    }
    function onPbdMatrixYearChange(){populatePbdMatrixClassOptions('');renderPbdModule();}

    function renderPbdModule() {
        syncPbdPeriodAvailability();
        const year=Number(document.getElementById('pbd-year')?.value||4),classId=document.getElementById('pbd-class')?.value||'',period=getPbdMatrixPeriod();
        const empty=document.getElementById('pbd-selection-empty'),workspace=document.getElementById('pbd-workspace');
        if(isTeacherSession()&&!period){
            empty?.classList.remove('hidden');workspace?.classList.add('hidden');
            const h=empty?.querySelector('h3');if(h)h.textContent='Tiada Pengisian PBD Diaktifkan';
            const p=empty?.querySelector('p');if(p)p.textContent='Admin belum mengaktifkan PBD bagi Diagnostik, UPSA atau UASA.';
            return;
        }
        if(!classId){empty?.classList.remove('hidden');workspace?.classList.add('hidden');return;}
        const cls=appState.classes.find(c=>c.id===classId);
        if(!cls||Number(cls.year)!==year||(isTeacherSession()&&cls.teacherId!==currentUserId)){empty?.classList.remove('hidden');workspace?.classList.add('hidden');return;}

        const pbdContextKey=`${year}|${classId}|${period}`;
        if(pbdEditContextKey!==pbdContextKey){
            pbdEditContextKey=pbdContextKey;
            const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
            pbdManualEditMode=!appState.pbdRecords.some(r=>r.classId===classId&&r.assessmentPeriod===period&&String(r.academicYear)===String(academicYear));
        }
        empty?.classList.add('hidden');workspace?.classList.remove('hidden');
        const pbdEntryOpen=isAssessmentEntryOpen('pbd',pbdAssessmentTypeFromPeriod(period));
        const accessNote=document.getElementById('pbd-matrix-access-note');
        if(accessNote){
            accessNote.classList.toggle('hidden',pbdEntryOpen);
            accessNote.className=pbdEntryOpen?'hidden':'entry-closed-notice';
            accessNote.innerHTML=pbdEntryOpen?'':`<i data-lucide="pause-circle" class="w-4 h-4 shrink-0 mt-0.5"></i><span>${escapeHtml(pbdEntryClosedMessage(period))}</span>`;
        }
        syncPbdDerivedLevelsForCurrentClass();

        const template=getPbdMatrixTemplate(year);
        document.getElementById('pbd-matrix-title').textContent=`PBD Sejarah Tahun ${year} · ${cls.name}`;
        document.getElementById('pbd-matrix-subtitle').textContent=
            `${pbdPeriodLabel(period)} · ${template.groups.length} Tema · ${template.groups.reduce((n,g)=>n+g.topics.length,0)} SK` +
            (period==='AKHIR'?' · Kesinambungan: nilai Pertengahan Tahun dibawa ke hadapan sehingga dikemas kini':'');
        const themeCountEl=document.getElementById('pbd-kpi-theme-count');
        const skCountEl=document.getElementById('pbd-kpi-sk-count');
        if(themeCountEl)themeCountEl.textContent=template.groups.length;
        if(skCountEl)skCountEl.textContent=template.groups.reduce((n,g)=>n+g.topics.length,0);
        populatePbdThemeFilter(template);
        updatePbdDataActionButtons();
        renderPbdMatrixHead(template);renderPbdMatrixRows(template);updatePbdMatrixStats(template);updatePbdMatrixLockUi();filterPbdMatrixRows();applyPbdThemeFilter();lucide.createIcons();
    }

    function getPbdThemeHeaderColor(index) {
        const colors = ['#065F46','#0F766E','#115E59','#164E63','#14532D'];
        return colors[index % colors.length];
    }

    function formatPbdSkTitle(topic) {
        const raw=String(topic||'').trim();

        // Preferred layouts for the Tahun 4 examples supplied by the user.
        const preferred={
            'PENGERTIAN SEJARAH':['PENGERTIAN','SEJARAH'],
            'DIRI DAN KELUARGA':['DIRI DAN','KELUARGA'],
            'SEJARAH SEKOLAH':['SEJARAH','SEKOLAH'],
            'KAWASAN TEMPAT TINGGAL':['KAWASAN','TEMPAT','TINGGAL']
        };
        if(preferred[raw]){
            return preferred[raw].map(line=>escapeHtml(line)).join('<br>');
        }

        const words=raw.split(/\s+/).filter(Boolean);
        if(words.length<=1)return escapeHtml(raw);

        // Use 2 lines for short titles; 3 lines for longer titles.
        // The algorithm balances character length without ever splitting words.
        const lineCount=words.length<=4 && raw.length<=28 ? 2 : 3;
        if(words.length<=lineCount){
            return words.map(w=>escapeHtml(w)).join('<br>');
        }

        const lines=[];
        let start=0;
        for(let line=0;line<lineCount;line++){
            const remainingLines=lineCount-line;
            const remainingWords=words.length-start;
            if(remainingLines===1){
                lines.push(words.slice(start).join(' '));
                break;
            }

            // Choose the split that best balances the remaining text while
            // guaranteeing at least one word for each remaining line.
            const maxEnd=words.length-(remainingLines-1);
            let bestEnd=start+1;
            let bestScore=Infinity;
            const remainingTextLen=words.slice(start).join(' ').length;
            const target=remainingTextLen/remainingLines;

            for(let end=start+1;end<=maxEnd;end++){
                const candidate=words.slice(start,end).join(' ');
                const score=Math.abs(candidate.length-target);
                if(score<bestScore){
                    bestScore=score;
                    bestEnd=end;
                }
            }
            lines.push(words.slice(start,bestEnd).join(' '));
            start=bestEnd;
        }

        return lines.filter(Boolean).map(line=>escapeHtml(line)).join('<br>');
    }

    function getPbdSkColumnWidth(topic) {
        const html=formatPbdSkTitle(topic);
        const lines=String(html)
            .replace(/<br\s*\/?>/gi,'|')
            .replace(/<[^>]*>/g,'')
            .split('|')
            .map(s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim())
            .filter(Boolean);

        const longest=lines.reduce((m,line)=>Math.max(m,line.length),0);

        // Approximate rendered width for the compact 8px–8.2px header font.
        // Clamp keeps TP controls comfortable and prevents overly wide columns.
        return Math.max(66,Math.min(108,Math.round(longest*4.9+22)));
    }

    function renderPbdMatrixHead(template) {
        const head=document.getElementById('pbd-matrix-head');if(!head)return;
        const year=Number(document.getElementById('pbd-year')?.value||4);

        const groupCells=template.groups.map((g,gIndex) =>
            `<th data-theme-key="${g.key}" colspan="${g.topics.length+1}" class="pbd-theme-header" title="Tema ${gIndex+1} — ${escapeHtml(g.name)}" style="background-color:${getPbdThemeHeaderColor(gIndex)} !important">
                <span class="pbd-theme-star">✦</span><span class="pbd-theme-number">T${gIndex+1}</span><span class="pbd-theme-title">${escapeHtml(g.name)}</span>
            </th>`
        ).join('');

        const topicCells=template.groups.map((g,gIndex) =>
            g.topics.map((topic,idx)=>{
                const d=pbdMatrixDskpForTopic(year,g.key,idx);
                const skWidth=getPbdSkColumnWidth(topic);
                return `<th data-theme-key="${g.key}" class="pbd-sk-header" style="--pbd-this-sk-width:${skWidth}px" title="${escapeHtml(d?.standardContentCode||'SK')} — ${escapeHtml(topic)}">
                    <span class="pbd-sk-stack">
                        <span class="pbd-sk-code-inline">${escapeHtml(d?.standardContentCode||'SK')}</span>
                        <span class="pbd-sk-separator">•</span>
                        <span class="pbd-sk-title-inline">${formatPbdSkTitle(topic)}</span>
                    </span>
                </th>`;
            }).join('') +
            `<th data-theme-key="${g.key}" class="pbd-average-header" title="Purata Tema ${gIndex+1} — ${escapeHtml(g.name)}">
                <span class="pbd-average-title">PURATA TEMA ${gIndex+1}</span>
            </th>`
        ).join('');

        head.innerHTML=`<tr class="pbd-theme-row">
            <th rowspan="2" class="pbd-fixed-head pbd-bil-head">BIL</th>
            <th rowspan="2" class="pbd-fixed-head pbd-name-head text-left pl-4">NAMA MURID</th>
            ${groupCells}
            <th rowspan="2" class="pbd-final-header"><span class="pbd-final-title">TP AKHIR</span></th>
        </tr>
        <tr class="pbd-sk-row">${topicCells}</tr>`;
    }

    function highlightPbdStudentRow(target) {
        const row=target?.closest ? target.closest('tr[data-pbd-student]') : target;
        if(!row)return;
        document.querySelectorAll('#pbd-matrix-body tr.pbd-selected-row').forEach(r=>r.classList.remove('pbd-selected-row'));
        row.classList.add('pbd-selected-row');
    }

    function renderPbdMatrixRows(template) {
        const body=document.getElementById('pbd-matrix-body');if(!body)return;
        const students=getPbdMatrixStudents(),period=getPbdMatrixPeriod(),year=Number(document.getElementById('pbd-year')?.value||4),classId=document.getElementById('pbd-class')?.value||'',locked=isPbdLocked(classId,period),entryOpen=isAssessmentEntryOpen('pbd',pbdAssessmentTypeFromPeriod(period)),canEdit=canEditPbdClass(classId)&&!locked&&entryOpen&&pbdManualEditMode;

        const pill=(tp,emptyText='—')=>{
            if(!tp)return `<span class="pbd-tp-pill pbd-tp-pill-empty">${emptyText}</span>`;
            return `<span class="pbd-tp-pill ${pbdTpClass(tp)}">TP${tp}</span>`;
        };

        body.innerHTML=students.map((student,index)=>{
            const finalCalc=calculateStudentFinalAverage(student.id,template,year,period,pbdResolveAcademicYear());
            let cells='';

            template.groups.forEach((group,gIndex)=>{
                const themeCalc=calculateStudentThemeAverage(student.id,group,year,period,pbdResolveAcademicYear());

                group.topics.forEach((topic,idx)=>{
                    const d=pbdMatrixDskpForTopic(year,group.key,idx);
                    const rec=d?getEffectivePbdMatrixRecord(student.id,d.id,period,pbdResolveAcademicYear()):null;
                    const continuityTitle=rec?.inheritedFromPeriod
                        ? `${d.standardContentCode} · ${topic} · Dibawa dari Pertengahan Tahun`
                        : `${d?.standardContentCode||'SK'} · ${topic}`;
                    cells+=`<td data-theme-key="${group.key}" onclick="highlightPbdStudentRow(this)">
                        ${d?createTpSelect(rec?.tp||'',`highlightPbdStudentRow(this);setPbdMatrixTopicTp('${student.id}','${d.id}',this.value)`,!canEdit,continuityTitle):pill(null)}
                    </td>`;
                });

                cells+=`<td data-theme-key="${group.key}" class="pbd-average-cell" onclick="highlightPbdStudentRow(this)">
                    ${themeCalc.complete
                        ? pill(themeCalc.avg)
                        : `<span class="pbd-tp-pill pbd-tp-pill-empty" title="${themeCalc.recorded}/${themeCalc.total} SK direkod">${themeCalc.recorded}/${themeCalc.total}</span>`}
                </td>`;
            });

            const finalHtml=finalCalc.complete?pill(finalCalc.avg):`<span class="pbd-tp-pill pbd-tp-pill-empty">—</span>`;

            return `<tr data-pbd-student="${student.id}" data-name="${escapeHtml(student.name.toLowerCase())}" data-complete="${finalCalc.complete?'1':'0'}" data-final-tp="${finalCalc.complete?finalCalc.avg:''}" onclick="highlightPbdStudentRow(this)">
                <td class="pbd-bil-cell">${String(index+1).padStart(2,'0')}</td>
                <td class="pbd-name-cell" title="${escapeHtml(student.name)}">${escapeHtml(student.name)}</td>
                ${cells}
                <td class="pbd-final-cell">${finalHtml}</td>
            </tr>`;
        }).join('');

        if(!students.length){
            const totalCols=3+template.groups.reduce((sum,g)=>sum+g.topics.length+1,0);
            body.innerHTML=`<tr><td colspan="${totalCols}" class="p-10 text-center text-slate-500">Tiada murid aktif dalam kelas ini.</td></tr>`;
        }
    }

    function populatePbdThemeFilter(template) {
        const select=document.getElementById('pbd-theme-filter');if(!select)return;
        const prev=select.value||'ALL';
        select.innerHTML='<option value="ALL">Semua Tema</option>'+template.groups.map(g=>`<option value="${g.key}">${escapeHtml(g.name)}</option>`).join('');
        select.value=template.groups.some(g=>g.key===prev)?prev:'ALL';
    }

    function applyPbdThemeFilter() {
        const selected=document.getElementById('pbd-theme-filter')?.value||'ALL';
        document.querySelectorAll('#pbd-matrix-table [data-theme-key]').forEach(el=>{
            el.classList.toggle('pbd-theme-hidden', selected!=='ALL' && el.dataset.themeKey!==selected);
        });
    }

    function filterPbdMatrixRows() {
        const q=(document.getElementById('pbd-matrix-search')?.value||'').trim().toLowerCase();
        const mode=document.getElementById('pbd-matrix-row-filter')?.value||'ALL';
        let visible=0;
        document.querySelectorAll('#pbd-matrix-body tr[data-pbd-student]').forEach(row=>{
            const name=row.dataset.name||'',complete=row.dataset.complete==='1',finalTp=row.dataset.finalTp||'';
            const matchName=!q||name.includes(q);
            let matchMode=true;
            if(mode==='INCOMPLETE') matchMode=!complete;
            else if(/^TP[1-6]$/.test(mode)) matchMode=finalTp===mode.replace('TP','');
            const show=matchName&&matchMode;
            row.classList.toggle('hidden',!show);
            if(show)visible++;
        });
        const empty=document.getElementById('pbd-filter-empty-state');
        const scroll=document.getElementById('pbd-matrix-scroll');
        if(empty)empty.classList.toggle('hidden',visible>0);
        if(scroll)scroll.classList.toggle('hidden',visible===0 && document.querySelectorAll('#pbd-matrix-body tr[data-pbd-student]').length>0);
        if(typeof lucide!=='undefined')lucide.createIcons();
    }

    function resetPbdMatrixFilters() {
        const search=document.getElementById('pbd-matrix-search');
        const theme=document.getElementById('pbd-theme-filter');
        const tp=document.getElementById('pbd-matrix-row-filter');
        if(search)search.value='';if(theme)theme.value='ALL';if(tp)tp.value='ALL';
        applyPbdThemeFilter();filterPbdMatrixRows();
    }

    function printPbdMatrix() {
        const table=document.getElementById('pbd-matrix-table');
        const title=document.getElementById('pbd-matrix-title')?.textContent||'PBD Sejarah';
        if(!table)return;
        const printable=table.cloneNode(true);
        printable.querySelectorAll('select').forEach(select=>{
            const span=document.createElement('span');
            span.className='print-tp';span.textContent=select.value?`TP${select.value}`:'—';select.replaceWith(span);
        });
        printable.querySelectorAll('.hidden,.pbd-theme-hidden').forEach(el=>el.remove());
        printable.querySelectorAll('[style]').forEach(el=>el.removeAttribute('style'));
        const context=currentPbdDataContext();
        const periodLabel=getPbdMatrixPeriod()==='AKHIR'?'Akhir Tahun':'Pertengahan Tahun';
        const win=window.open('','_blank','width=1400,height=900');
        if(!win)return;
        win.document.write(`<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
          @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
          .print-head{display:flex;justify-content:space-between;align-items:flex-end;margin:0 0 10px;border-bottom:2px solid #1f2937;padding:0 0 8px}.print-head h1{font-size:17px;margin:0 0 3px}.print-head p,.print-meta{font-size:8px;margin:0;color:#475569}.print-meta{text-align:right;line-height:1.5}
          .table-wrap{width:100%;overflow:visible}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:6.5px}th,td{border:1px solid #aeb4ba;padding:3px 2px;text-align:center;vertical-align:middle;line-height:1.15;overflow-wrap:anywhere}
          thead th{background:#f3f4f6;font-weight:800;text-transform:uppercase}.pbd-theme-row th{background:#075f4a!important;color:#fff!important;font-size:6.5px;letter-spacing:.02em}.pbd-theme-row th:nth-child(4n+2){background:#0f6b62!important}.pbd-sk-row th{background:#f3f4f6!important;color:#111!important}
          .pbd-bil-head,.pbd-bil-cell{width:25px!important;min-width:25px!important;max-width:25px!important}.pbd-name-head,.pbd-name-cell{width:145px!important;min-width:145px!important;max-width:145px!important;text-align:left!important;padding-left:5px!important}.pbd-name-cell{font-weight:700;text-transform:uppercase}.pbd-average-header,.pbd-final-header{width:48px!important}.pbd-sk-header{min-width:48px!important}.pbd-sk-code{display:block;font-size:6px;font-weight:900}.pbd-sk-name{display:block;font-size:5.5px;font-weight:600;white-space:normal!important;writing-mode:horizontal-tb!important;transform:none!important;max-width:none!important}
          tbody tr{height:25px}tbody tr:nth-child(even) td{background:#fafafa}.print-tp,.pbd-tp-pill{font-size:10px;font-weight:800;color:#999}.pbd-average-cell,.pbd-final-cell{font-weight:900;color:#111}.pbd-final-cell{background:#f8fafc!important}
          svg,i,button,input,.pbd-theme-star{display:none!important}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-head{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}}
        </style></head><body><header class="print-head"><div><h1>${escapeHtml(title)}</h1><p>PBD Sejarah Tahun ${escapeHtml(context.year)} · ${escapeHtml(context.cls?.name||'Kelas')}</p></div><div class="print-meta">Sesi ${escapeHtml(context.academicYear)}<br>${escapeHtml(periodLabel)}<br>${new Date().toLocaleDateString('ms-MY')}</div></header><div class="table-wrap">${printable.outerHTML}</div></body></html>`);
        win.document.close();win.focus();setTimeout(()=>win.print(),450);
    }

    function exportPbdMatrixPdf() {
        const table=document.getElementById('pbd-matrix-table');
        const title=document.getElementById('pbd-matrix-title')?.textContent||'PBD Sejarah';
        if(!table){showAlert('Tiada Data','Tiada jadual PBD untuk dieksport.','info');return;}
        if(typeof html2canvas==='undefined'||typeof jspdf==='undefined'){
            printPbdMatrix();
            return;
        }
        const wrapper=document.createElement('div');
        wrapper.style.cssText='position:fixed;left:-99999px;top:0;background:white;padding:18px;width:max-content;z-index:-1;';
        wrapper.innerHTML=`<h2 style="font-family:Arial;font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h2>${table.outerHTML}`;
        document.body.appendChild(wrapper);
        html2canvas(wrapper,{scale:1.2,backgroundColor:'#ffffff'}).then(canvas=>{
            const img=canvas.toDataURL('image/png');
            const {jsPDF}=window.jspdf;
            const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
            const pageW=pdf.internal.pageSize.getWidth()-12,pageH=pdf.internal.pageSize.getHeight()-12;
            const ratio=Math.min(pageW/canvas.width,pageH/canvas.height);
            pdf.addImage(img,'PNG',6,6,canvas.width*ratio,canvas.height*ratio);
            pdf.save(`PBD_Sejarah_${new Date().toISOString().slice(0,10)}.pdf`);
            wrapper.remove();
        }).catch(()=>{wrapper.remove();printPbdMatrix();});
    }

    function currentPbdDataContext(){
        const year=Number(document.getElementById('pbd-year')?.value||4);
        const classId=document.getElementById('pbd-class')?.value||'';
        const period=getPbdMatrixPeriod();
        const academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        const cls=appState.classes.find(c=>c.id===classId);
        const entryOpen=isAssessmentEntryOpen('pbd',pbdAssessmentTypeFromPeriod(period));
        const canManage=Boolean(cls&&entryOpen&&canEditPbdClass(classId)&&!isPbdLocked(classId,period));
        return {year,classId,period,academicYear,cls,entryOpen,canManage};
    }

    function updatePbdDataActionButtons(){
        const ctx=currentPbdDataContext();
        const hasData=appState.pbdRecords.some(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));
        const edit=document.getElementById('btn-pbd-edit-data');
        const save=document.getElementById('btn-pbd-save-data');
        const del=document.getElementById('btn-pbd-delete-data');
        [edit,save,del].forEach(btn=>{
            if(!btn)return;
            btn.disabled=!ctx.canManage;
            btn.classList.toggle('is-disabled',!ctx.canManage);
        });
        if(save){
            save.disabled=!ctx.canManage||!pbdManualEditMode;
            save.classList.toggle('is-disabled',save.disabled);
        }
        if(del){
            del.disabled=!ctx.canManage||!hasData;
            del.classList.toggle('is-disabled',del.disabled);
        }
        if(edit){
            edit.classList.toggle('active',Boolean(ctx.canManage&&pbdManualEditMode));
            edit.innerHTML=pbdManualEditMode
                ? '<i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit Aktif'
                : '<i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit';
        }
        if(typeof lucide!=='undefined')lucide.createIcons();
    }

    function enableCurrentPbdEdit(){
        const ctx=currentPbdDataContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','PBD tidak aktif, dikunci, atau kelas ini bukan di bawah tugasan anda.','danger');
            return;
        }
        pbdManualEditMode=true;
        renderPbdModule();
        setTimeout(()=>document.querySelector('#pbd-matrix-body .pbd-tp-select:not([disabled])')?.focus(),80);
    }

    async function saveCurrentPbdData(){
        const ctx=currentPbdDataContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','Data PBD tidak boleh disimpan dalam skop ini.','danger');
            return;
        }
        syncPbdDerivedLevelsForCurrentClass();

        const records=appState.pbdRecords.filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));
        const groups=(appState.pbdGroupLevels||[]).filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));
        const overall=(appState.pbdOverall||[]).filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));

        persistPhase4State();
        phase10RemoteLoadSeq++;
        showPbdSaveState('Sedang menyimpan...','saving');

        const writes=[
            ...records.map(r=>phase10Upsert('pbdRecords',r.id,r)),
            ...groups.map(r=>phase10Upsert('pbdGroupLevels',r.id,r)),
            ...overall.map(r=>phase10Upsert('pbdOverall',r.id,r))
        ];
        const results=await Promise.all(writes);
        const saved=results.every(Boolean);

        if(!saved){
            showPbdSaveState('Gagal menyimpan','error');
            showAlert('Gagal Menyimpan','Sebahagian data PBD belum berjaya dihantar ke Supabase. Data tempatan dikekalkan. Cuba Simpan semula.','danger');
            return;
        }

        logAudit('SAVE_PBD_DATA',{classId:ctx.classId,period:ctx.period,count:records.length});
        showPbdSaveState('✓ Disimpan','saved');
        pbdManualEditMode=false;
        renderPbdModule();
        refreshLivePbdDependents();
    }

    function deleteCurrentPbdData(){
        const ctx=currentPbdDataContext();
        if(!ctx.canManage){
            showAlert('Akses Ditolak','Data PBD tidak boleh dipadam dalam skop ini.','danger');
            return;
        }

        const records=appState.pbdRecords.filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));
        const groups=(appState.pbdGroupLevels||[]).filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));
        const overall=(appState.pbdOverall||[]).filter(r=>r.classId===ctx.classId&&r.assessmentPeriod===ctx.period&&String(r.academicYear)===String(ctx.academicYear));

        if(!records.length&&!groups.length&&!overall.length){
            showAlert('Tiada Data','Tiada data PBD untuk dipadam.','info');
            return;
        }

        showAlert(
            'Padam Data PBD',
            `Padam semua rekod PBD ${pbdPeriodLabel(ctx.period)} bagi ${ctx.cls?.name||'kelas ini'}? Data murid tidak akan dipadam.`,
            'danger',
            ()=>{
                const recordIds=new Set(records.map(r=>r.id));
                const groupIds=new Set(groups.map(r=>r.id));
                const overallIds=new Set(overall.map(r=>r.id));
                appState.pbdRecords=appState.pbdRecords.filter(r=>!recordIds.has(r.id));
                appState.pbdGroupLevels=(appState.pbdGroupLevels||[]).filter(r=>!groupIds.has(r.id));
                appState.pbdOverall=(appState.pbdOverall||[]).filter(r=>!overallIds.has(r.id));
                records.forEach(r=>phase10Delete('pbdRecords',r.id));
                groups.forEach(r=>phase10Delete('pbdGroupLevels',r.id));
                overall.forEach(r=>phase10Delete('pbdOverall',r.id));
                persistPhase4State();
                logAudit('DELETE_PBD_DATA',{classId:ctx.classId,period:ctx.period,count:records.length});
                pbdManualEditMode=true;
                renderPbdModule();
                refreshLivePbdDependents();
            }
        );
    }

    async function setPbdMatrixTopicTp(studentId,dskpId,rawValue) {
        if(!pbdManualEditMode){
            showAlert('Klik Edit','Klik butang Edit sebelum mengubah data PBD.','info');
            renderPbdModule();
            return;
        }
        if(!pbdMatrixCanWrite()){renderPbdModule();return;}
        const tp=rawValue===''?null:Number(rawValue);if(tp!==null&&![1,2,3,4,5,6].includes(tp))return;
        const period=getPbdMatrixPeriod(),classId=document.getElementById('pbd-class')?.value||'',year=Number(document.getElementById('pbd-year')?.value||4),academicYear=document.getElementById('filter-academic-year')?.value||'2026';
        let rec=getPbdMatrixRecord(studentId,dskpId,period);
        if(!rec){rec={id:`pbd_${studentId}_${dskpId}_${period}`,studentId,dskpId,classId,schoolId:'MATTARY',academicYear,teacherId:currentUserId,assessmentPeriod:period,tp:null,assessmentDate:new Date().toISOString().slice(0,10),evidence:'',teacherNote:'',yearLevel:year,createdAt:new Date().toISOString(),createdBy:currentUserId};appState.pbdRecords.push(rec);}
        rec.tp=tp;rec.updatedAt=new Date().toISOString();rec.updatedBy=currentUserId;
        if(tp===null)appState.pbdRecords=appState.pbdRecords.filter(r=>r!==rec);
        syncPbdDerivedLevelsForStudent(studentId,false);
        logAudit('UPDATE_PBD_STANDARD_KANDUNGAN',{studentId,dskpId,tp,period});
        showPbdSaveState('Sedang menyimpan...','saving');persistPhase4State();

        // Invalidate any full remote load that started before this edit.
        phase10RemoteLoadSeq++;

        let saved=true;
        if(phase10Mode==='SUPABASE'){
            const writes=[];
            writes.push(tp===null
                ? phase10Delete('pbdRecords',rec.id)
                : phase10Upsert('pbdRecords',rec.id,rec));

            (appState.pbdGroupLevels||[])
                .filter(r=>r.studentId===studentId&&r.assessmentPeriod===period)
                .forEach(r=>writes.push(phase10Upsert(
                    'pbdGroupLevels',
                    r.id||`${r.studentId}_${r.groupKey}_${r.academicYear}_${r.assessmentPeriod}`,
                    r
                )));

            (appState.pbdOverall||[])
                .filter(r=>r.studentId===studentId&&r.assessmentPeriod===period)
                .forEach(r=>writes.push(phase10Upsert(
                    'pbdOverall',
                    r.id||`${r.studentId}_${r.academicYear}_${r.assessmentPeriod}`,
                    r
                )));

            const results=await Promise.all(writes);
            saved=results.every(Boolean);
        }

        showPbdSaveState(saved?'✓ Disimpan':'Gagal menyimpan',saved?'saved':'error');
        const template=getPbdMatrixTemplate(year);renderPbdMatrixRows(template);updatePbdMatrixStats(template);filterPbdMatrixRows();refreshLivePbdDependents();
    }

    function updatePbdMatrixStats(template) {
        const students=getPbdMatrixStudents(),period=getPbdMatrixPeriod(),year=Number(document.getElementById('pbd-year')?.value||4),academicYear=pbdResolveAcademicYear(),topicDskp=appState.dskp.filter(d=>d.matrixTemplate&&Number(d.yearLevel)===year),studentIds=new Set(students.map(s=>s.id)),topicIds=new Set(topicDskp.map(d=>d.id));
        const records=getEffectivePbdRecordsForScope(studentIds,topicIds,academicYear,period);
        const expected=students.length*topicDskp.length,completion=expected?records.length/expected*100:0;
        const finals=students.map(s=>calculateStudentFinalAverage(s.id,template,year,period,academicYear)).filter(x=>x.complete);
        const finalAvg=finals.length?finals.reduce((sum,x)=>sum+x.avg,0)/finals.length:null;
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        set('pbd-matrix-stat-students',students.length);set('pbd-matrix-stat-recorded',`${records.length}/${expected}`);set('pbd-matrix-stat-completion',formatWholePercent(completion));set('pbd-matrix-stat-overall',`${finals.length}/${students.length}`);set('pbd-matrix-stat-dominant',finalAvg===null?'—':`TP${Math.round(finalAvg)}`);
    }

    function updatePbdMatrixLockUi() {
        const classId=document.getElementById('pbd-class')?.value||'',period=getPbdMatrixPeriod(),locked=classId?isPbdLocked(classId,period):false,entryOpen=isAssessmentEntryOpen('pbd',pbdAssessmentTypeFromPeriod(period)),badge=document.getElementById('pbd-matrix-lock-state'),headerBadge=document.getElementById('pbd-header-lock-state'),btn=document.getElementById('btn-pbd-lock');
        if(badge){
            badge.textContent=!entryOpen?'PENGISIAN DITUTUP':locked?'DIKUNCI':'TERBUKA';
            badge.className=!entryOpen?'pbd-open-badge !text-amber-800 !bg-amber-50 !border-amber-200':locked?'pbd-open-badge !text-rose-700 !bg-rose-50 !border-rose-200':'pbd-open-badge';
        }
        if(headerBadge){
            headerBadge.textContent=!entryOpen?'PENGISIAN DITUTUP':locked?'DIKUNCI':'TERBUKA';
            headerBadge.className=!entryOpen
                ? 'px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-black'
                : locked
                ? 'px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black'
                : 'px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black';
        }
        if(btn&&isAdminSession()){btn.innerHTML=locked?'<i data-lucide="unlock" class="w-4 h-4"></i> Buka Kunci PBD':'<i data-lucide="lock" class="w-4 h-4"></i> Kunci PBD';btn.className=locked?'px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold hover:bg-emerald-100 flex items-center gap-2':'px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold hover:bg-rose-100 flex items-center gap-2';}
    }

    function togglePbdLock() {
        if(!isAdminSession()){showAlert('Akses Ditolak','Kunci/Buka Kunci PBD hanya untuk Admin (KP Sejarah).','danger');return;}
        const classId=document.getElementById('pbd-class')?.value||'';if(!classId){showAlert('Pilih Kelas','Sila pilih kelas dahulu.','info');return;}
        const period=getPbdMatrixPeriod(),academicYear=document.getElementById('filter-academic-year')?.value||'2026',current=isPbdLocked(classId,period);
        const action=()=>{let rec=appState.pbdLocks.find(l=>l.classId===classId&&l.period===period&&String(l.academicYear)===String(academicYear));if(rec){rec.locked=!current;rec.updatedAt=new Date().toISOString();rec.updatedBy=currentUserId;}else{rec={id:`lock_${classId}_${academicYear}_${period}`,classId,academicYear,period,locked:true,createdBy:currentUserId,createdAt:new Date().toISOString()};appState.pbdLocks.push(rec);}persistPhase4State();phase10Upsert('pbdLocks',rec.id,rec);logAudit(current?'UNLOCK_PBD':'LOCK_PBD',{classId,period});renderPbdModule();};
        showAlert(current?'Buka Kunci PBD?':'Kunci PBD?',current?'Guru akan dapat mengubah rekod semula.':'Selepas dikunci, guru tidak boleh mengubah TP kelas ini.','info',action);
    }

    function exportPbdMatrixExcel() {
        const year=Number(document.getElementById('pbd-year')?.value||4),classId=document.getElementById('pbd-class')?.value||'',cls=appState.classes.find(c=>c.id===classId);
        if(!cls){showAlert('Pilih Kelas','Sila pilih kelas sebelum mengeksport.','info');return;}
        if(typeof XLSX==='undefined'){showAlert('Export Tidak Tersedia','Library Excel belum dimuatkan.','danger');return;}

        const template=getPbdMatrixTemplate(year),period=getPbdMatrixPeriod(),students=getPbdMatrixStudents();
        const header1=['BIL','NAMA MURID'],header2=['',''],merges=[
            {s:{r:0,c:0},e:{r:1,c:0}},
            {s:{r:0,c:1},e:{r:1,c:1}}
        ];
        let col=2;

        template.groups.forEach(group=>{
            const span=group.topics.length+1;
            header1.push(group.name,...Array(span-1).fill(''));
            header2.push(...group.topics,'PURATA TEMA');
            merges.push({s:{r:0,c:col},e:{r:0,c:col+span-1}});
            col+=span;
        });

        header1.push('TP AKHIR');header2.push('');
        merges.push({s:{r:0,c:col},e:{r:1,c:col}});

        const rows=students.map((student,index)=>{
            const row=[index+1,student.name];
            template.groups.forEach(group=>{
                group.topics.forEach((topic,idx)=>{
                    const d=pbdMatrixDskpForTopic(year,group.key,idx),rec=d?getPbdMatrixRecord(student.id,d.id,period):null;
                    row.push(rec?.tp||'');
                });
                const calc=calculateStudentThemeAverage(student.id,group,year,period);
                row.push(calc.complete?calc.avg:'');
            });
            const final=calculateStudentFinalAverage(student.id,template,year,period);
            row.push(final.complete?final.avg:'');
            return row;
        });

        const ws=XLSX.utils.aoa_to_sheet([header1,header2,...rows]);
        ws['!merges']=merges;
        ws['!cols']=[{wch:5},{wch:38},...Array(col-2).fill({wch:14}),{wch:12}];

        const wb=XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb,ws,`PBD Tahun ${year}`);
        XLSX.writeFile(wb,`PBD_Sejarah_Tahun${year}_${cls.name.replace(/\s+/g,'_')}_${period==='PERTENGAHAN'?'Pertengahan':'Akhir'}.xlsx`);
    }

    // --- PHASE 5: MARKS ANALYTICS MODULE ---
    function analyticsGetScope() {
        const academicYear = document.getElementById('analytics-year-session')?.value || '2026';
        const yearLevel = document.getElementById('analytics-year-level')?.value || 'ALL';
        const classId = document.getElementById('analytics-class')?.value || 'ALL';
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (currentUserRole === 'GURU_SEJARAH') classes = classes.filter(c => c.teacherId === currentUserId);
        if (yearLevel !== 'ALL') classes = classes.filter(c => String(c.year) === String(yearLevel));
        if (classId !== 'ALL') classes = classes.filter(c => c.id === classId);
        const classIds = new Set(classes.map(c => c.id));
        const students = sortStudentsAZ(appState.students.filter(s => s.status === 'Aktif' && s.academicYear === academicYear && classIds.has(s.classId)));
        return { academicYear, yearLevel, classId, classes, students, classIds };
    }

    function analyticsMedian(values) {
        if (!values.length) return null;
        const sorted = [...values].sort((a,b) => a-b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
    }

    function analyticsPopulateClassOptions() {
        const select = document.getElementById('analytics-class');
        if (!select) return;
        const academicYear = document.getElementById('analytics-year-session').value;
        const yearLevel = document.getElementById('analytics-year-level').value;
        const previous = select.value;
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (currentUserRole === 'GURU_SEJARAH') classes = classes.filter(c => c.teacherId === currentUserId);
        if (yearLevel !== 'ALL') classes = classes.filter(c => String(c.year) === String(yearLevel));
        select.innerHTML = '<option value="ALL">Semua Kelas</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (classes.some(c => c.id === previous)) select.value = previous; else select.value = 'ALL';
    }

    function analyticsPopulateAssessmentOptions() {
        const scope = analyticsGetScope();
        const a = document.getElementById('analytics-assessment-a');
        const b = document.getElementById('analytics-assessment-b');
        const type = document.getElementById('analytics-assessment-type')?.value || 'UPSA';
        if (!a || !b) return;
        const prevA = a.value;
        const prevB = b.value;

        const allAvailable = appState.assessments
            .filter(x => x.academicYear === scope.academicYear && scope.classIds.has(x.classId))
            .sort(compareAssessmentsByExamDate);

        const primaryAvailable = allAvailable.filter(x => x.type === type);
        const typeLabel = assessmentTypes.find(t => t.id === type)?.name || type;

        a.innerHTML = `<option value="ALL">Semua ${typeLabel} dalam skop</option>` +
            primaryAvailable.map(x => `<option value="${x.id}">${x.name}</option>`).join('');

        b.innerHTML = '<option value="NONE">Tiada Perbandingan</option>' +
            allAvailable.map(x => `<option value="${x.id}">${x.name} · ${x.type}</option>`).join('');

        if (primaryAvailable.some(x => x.id === prevA)) a.value = prevA;
        else a.value = 'ALL';

        if (allAvailable.some(x => x.id === prevB) && prevB !== a.value) b.value = prevB;
        else b.value = 'NONE';
    }

    function initializeMarksAnalytics() {
        const globalAcademic = document.getElementById('filter-academic-year')?.value || '2026';
        const globalYear = document.getElementById('filter-tahun')?.value || 'ALL';
        const globalClass = document.getElementById('filter-kelas')?.value || 'ALL';
        document.getElementById('analytics-year-session').value = globalAcademic;
        document.getElementById('analytics-year-level').value = globalYear;
        document.getElementById('analytics-assessment-type').value = marksAssessmentTypeFilter;
        analyticsPopulateClassOptions();
        if ([...document.getElementById('analytics-class').options].some(o => o.value === globalClass)) document.getElementById('analytics-class').value = globalClass;
        analyticsPopulateAssessmentOptions();
        document.getElementById('analytics-threshold-label').textContent = `${appSettings.masteryThreshold}%`;
        resetAnalyticsStudentLocalFilters();
        const nearMargin=document.getElementById('analytics-nearmiss-margin');
        if(nearMargin)nearMargin.textContent=Math.max(1,Number(phase9SchoolProfile?.nearMissMargin||5));
        renderMarksAnalytics();
    }

    function onAnalyticsScopeChange() {
        analyticsPopulateClassOptions();
        analyticsPopulateAssessmentOptions();
        resetAnalyticsStudentLocalFilters();
        renderMarksAnalytics();
    }

    function onAnalyticsClassChange() {
        analyticsPopulateAssessmentOptions();
        resetAnalyticsStudentLocalFilters();
        renderMarksAnalytics();
    }

    function onAnalyticsAssessmentTypeChange() {
        const type = document.getElementById('analytics-assessment-type')?.value || 'UPSA';
        marksAssessmentTypeFilter = type;
        updateMarksTypeButtonUI();
        analyticsPopulateAssessmentOptions();
        resetAnalyticsStudentLocalFilters();
        renderMarksAnalytics();
    }

    function getAnalyticsRows() {
        const scope = analyticsGetScope();
        const assessmentAId = document.getElementById('analytics-assessment-a')?.value || 'ALL';
        const assessmentBId = document.getElementById('analytics-assessment-b')?.value || 'NONE';
        const assessmentType = document.getElementById('analytics-assessment-type')?.value || 'UPSA';
        const selectedAssessments = assessmentAId === 'ALL'
            ? appState.assessments.filter(a => a.academicYear === scope.academicYear && scope.classIds.has(a.classId) && a.type === assessmentType)
            : appState.assessments.filter(a => a.id === assessmentAId && scope.classIds.has(a.classId));
        const assessmentIds = new Set(selectedAssessments.map(a => a.id));
        const studentMap = new Map(scope.students.map(s => [s.id, s]));
        const rows = [];
        scope.students.forEach(student => {
            let score = null;
            let assessment = null;
            if (assessmentAId === 'ALL') {
                const candidates = getActualScoreRecords()
                    .filter(sc => sc.studentId === student.id && assessmentIds.has(sc.assessmentId))
                    .map(sc => ({sc, a: appState.assessments.find(x => x.id === sc.assessmentId)}))
                    .filter(x => x.a)
                    .sort((x,y) => compareAssessmentsByExamDate(y.a,x.a));
                if (candidates.length) { score = candidates[0].sc; assessment = candidates[0].a; }
            } else {
                assessment = appState.assessments.find(a => a.id === assessmentAId) || null;
                score = getActualScoreRecords().find(sc => sc.studentId === student.id && sc.assessmentId === assessmentAId) || null;
            }
            const comparisonScore = assessmentBId !== 'NONE' ? (getActualScoreRecords().find(sc => sc.studentId === student.id && sc.assessmentId === assessmentBId) || null) : null;
            const cls = appState.classes.find(c => c.id === student.classId);
            let trend = null;
            if (score && !score.absent && score.percentage != null && comparisonScore && !comparisonScore.absent && comparisonScore.percentage != null) {
                trend = Number((comparisonScore.percentage - score.percentage).toFixed(1));
            }
            rows.push({ student, cls, score, assessment, comparisonScore, trend });
        });
        return rows;
    }

    function renderMarksAnalytics() {
        analyticsCurrentRows = getAnalyticsRows();
        const scoredRows = analyticsCurrentRows.filter(r => r.score && !r.score.absent && r.score.percentage != null);
        const absentRows = analyticsCurrentRows.filter(r => r.score?.absent);
        const values = scoredRows.map(r => Number(r.score.percentage));
        const masteryRows = scoredRows.filter(r => isMasteredMark(r.score.percentage));
        const total = analyticsCurrentRows.length;
        const filled = scoredRows.length;
        const completion = total ? ((filled + absentRows.length) / total * 100) : 0;
        const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
        const median = analyticsMedian(values);
        const high = values.length ? Math.max(...values) : null;
        const low = values.length ? Math.min(...values) : null;
        const masteryRate = values.length ? masteryRows.length / values.length * 100 : null;
        const setText=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
        setText('an-kpi-total', total);
        setText('an-kpi-filled', filled);
        setText('an-kpi-average', avg == null ? '—' : formatAverageMark(avg));
        setText('an-kpi-median', median == null ? '—' : formatWholePercent(median));
        setText('an-kpi-high', high == null ? '—' : formatWholePercent(high));
        setText('an-kpi-low', low == null ? '—' : formatWholePercent(low));
        setText('an-kpi-mastery', masteryRate == null ? '—' : formatPercent1(masteryRate));
        setText('an-kpi-absent', absentRows.length);
        setText('an-completion-label', formatPercent1(completion));
        setText('an-complete-filled', filled);
        setText('an-complete-missing', Math.max(0,total-filled-absentRows.length));
        setText('an-complete-absent', absentRows.length);
        const bar=document.getElementById('an-completion-bar'); if(bar) bar.style.width=`${completion}%`;
        const scope=analyticsGetScope();
        const scopeLabel = scope.classId !== 'ALL' ? appState.classes.find(c=>c.id===scope.classId)?.name : (scope.yearLevel !== 'ALL' ? `Tahun ${scope.yearLevel}` : 'Semua Tahun');
        const assessmentType = document.getElementById('analytics-assessment-type')?.value || 'UPSA';
        const typeShort = assessmentType === 'DIAGNOSTIK' ? 'Diagnostik' : assessmentType;
        setText('analytics-scope-label', `${scopeLabel || 'Semua Kelas'} · ${typeShort} · ${phase9AyLabel(scope.academicYear)}`);
        renderAnalyticsGPMPAndGrades(scoredRows);
        renderAnalyticsInsights(scoredRows, absentRows, avg, masteryRate);
        renderAnalyticsCharts(scoredRows);
        analyticsStudentFilterClasses();
        renderAnalyticsStudentTable();
        renderAnalyticsSupportList();
        renderAnalyticsNearMissList();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function analyticsLatestAssessmentForClass(classId, type, academicYear) {
        return appState.assessments
            .filter(a => a.classId === classId && a.academicYear === academicYear && a.type === type)
            .sort((a,b) => compareAssessmentsByExamDate(b,a))[0] || null;
    }

    function analyticsScoresForAssessment(assessment, students) {
        if (!assessment) return [];
        const studentIds = new Set(students.map(s => s.id));
        return getActualScoreRecords().filter(s => s.assessmentId === assessment.id && studentIds.has(s.studentId));
    }

    function renderAnalyticsGPMPAndGrades(scoredRows) {
        const validScores = scoredRows.map(r => r.score).filter(Boolean);
        const gpmp = calculateGPMPFromScores(validScores);
        const gpmpEl = document.getElementById('an-kpi-gpmp');
        const basis = document.getElementById('an-gpmp-basis');
        if (gpmpEl) gpmpEl.textContent = gpmp === null ? '—' : gpmp.toFixed(2);
        if (basis) basis.textContent = `${validScores.length} calon markah sah · Skala mata ${appSettings.gradeBoundaries.map(b=>`${b.grade}=${b.point}`).join(', ')}`;

        const gradeCounts = {};
        appSettings.gradeBoundaries.forEach(b => gradeCounts[b.grade] = 0);
        validScores.forEach(s => {
            const grade = s.grade && s.grade !== '-' ? s.grade : calculateGrade(Number(s.percentage));
            if (Object.prototype.hasOwnProperty.call(gradeCounts, grade)) gradeCounts[grade]++;
        });
        const totalValid = validScores.length;
        const cards = document.getElementById('grade-percentage-cards');
        const validCount = document.getElementById('grade-percentage-valid-count');
        if (validCount) validCount.textContent = `${totalValid} calon sah`;
        if (cards) {
            const tones = {
                A:'bg-emerald-50 text-emerald-700 border-emerald-200',
                B:'bg-blue-50 text-blue-700 border-blue-200',
                C:'bg-amber-50 text-amber-700 border-amber-200',
                D:'bg-orange-50 text-orange-700 border-orange-200',
                E:'bg-rose-50 text-rose-700 border-rose-200'
            };
            cards.innerHTML = appSettings.gradeBoundaries.map(b => {
                const count = gradeCounts[b.grade] || 0;
                const pct = totalValid ? count / totalValid * 100 : 0;
                return `<button onclick="setAnalyticsGradeFilter('${b.grade}')" class="rounded-xl border p-3 text-left ${tones[b.grade] || 'bg-slate-50 text-slate-700 border-slate-200'} hover:-translate-y-0.5 transition-transform">
                    <div class="flex items-center justify-between"><span class="text-lg font-black">${b.grade}</span><span class="text-[10px] font-bold">${count} murid</span></div>
                    <p class="text-2xl font-black mt-1 analytics-percent">${formatPercent1(pct)}</p>
                    <p class="text-[9px] opacity-80 mt-1">${b.label}</p>
                </button>`;
            }).join('');
        }

        renderAnalyticsGPMPBreakdown();
    }

    function renderAnalyticsGPMPBreakdown() {
        const scope = analyticsGetScope();
        const type = document.getElementById('analytics-assessment-type')?.value || 'UPSA';
        const classBody = document.getElementById('gpmp-class-body');
        const yearBody = document.getElementById('gpmp-year-body');
        if (!classBody || !yearBody) return;

        const classRows = scope.classes.map(cls => {
            const students = scope.students.filter(s => s.classId === cls.id);
            const assessment = analyticsLatestAssessmentForClass(cls.id, type, scope.academicYear);
            const scores = analyticsScoresForAssessment(assessment, students)
                .filter(s => !s.absent && s.percentage !== null && s.percentage !== undefined);
            const gpmp = calculateGPMPFromScores(scores);
            const avg = scores.length ? scores.reduce((sum,s)=>sum+Number(s.percentage),0)/scores.length : null;
            return { cls, students, assessment, scores, gpmp, avg };
        }).sort((a,b) => a.cls.year-b.cls.year || a.cls.name.localeCompare(b.cls.name));

        classBody.innerHTML = classRows.length ? classRows.map(r => `
            <tr class="hover:bg-slate-50/70">
                <td class="px-4 py-3"><p class="font-bold text-slate-800">${escapeHtml(r.cls.name)}</p><p class="text-[9px] text-slate-400">${r.assessment ? escapeHtml(r.assessment.name) : 'Tiada ujian '+type}</p></td>
                <td class="px-4 py-3">Tahun ${r.cls.year}</td>
                <td class="px-4 py-3">${r.scores.length}</td>
                <td class="px-4 py-3 font-black ${r.gpmp!==null && r.gpmp<=2?'text-emerald-700':'text-indigo-700'}">${r.gpmp===null?'—':r.gpmp.toFixed(2)}</td>
                <td class="px-4 py-3 font-bold">${r.avg===null?'—':formatWholePercent(r.avg)}</td>
            </tr>`).join('') :
            '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">Tiada kelas dalam skop semasa.</td></tr>';

        const years = [...new Set(classRows.map(r => Number(r.cls.year)))].sort();
        yearBody.innerHTML = years.length ? years.map(year => {
            const yearRows = classRows.filter(r => Number(r.cls.year) === year);
            const allScores = yearRows.flatMap(r => r.scores);
            const gpmp = calculateGPMPFromScores(allScores);
            const avg = allScores.length ? allScores.reduce((sum,s)=>sum+Number(s.percentage),0)/allScores.length : null;
            return `<tr class="hover:bg-slate-50/70">
                <td class="px-4 py-3 font-bold text-slate-800">Tahun ${year}</td>
                <td class="px-4 py-3">${yearRows.length}</td>
                <td class="px-4 py-3">${allScores.length}</td>
                <td class="px-4 py-3 font-black ${gpmp!==null && gpmp<=2?'text-emerald-700':'text-indigo-700'}">${gpmp===null?'—':gpmp.toFixed(2)}</td>
                <td class="px-4 py-3 font-bold">${avg===null?'—':formatWholePercent(avg)}</td>
            </tr>`;
        }).join('') :
        '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">Tiada data Tahun dalam skop semasa.</td></tr>';
    }

    function renderAnalyticsInsights(scoredRows, absentRows, avg, masteryRate) {
        const container=document.getElementById('analytics-insights'); if(!container) return;
        const insights=[];
        if (!scoredRows.length) {
            insights.push({icon:'info', text:'Belum ada markah sah untuk menghasilkan insight prestasi.'});
        } else {
            insights.push({icon:'bar-chart-3', text:`Purata semasa ialah ${formatWholePercent(avg)} daripada ${scoredRows.length} rekod markah sah.`});
            insights.push({icon:'target', text:`${formatWholePercent(masteryRate)} murid bermarkah telah melepasi threshold menguasai ${appSettings.masteryThreshold}% (menguasai mulai ${masteryMinimumMark()}%).`});
            const support=scoredRows.filter(r=>isSupportMark(r.score.percentage)).length;
            insights.push({icon:'heart-handshake', text:support ? `${support} murid berada dalam julat sokongan 0–${appSettings.masteryThreshold}%.` : 'Tiada murid bermarkah berada dalam julat sokongan 0–39%.'});
            if (absentRows.length) insights.push({icon:'calendar-x', text:`${absentRows.length} murid direkodkan tidak hadir dan tidak dimasukkan dalam purata.`});
            const bId=document.getElementById('analytics-assessment-b').value;
            if (bId !== 'NONE') {
                const comparable=analyticsCurrentRows.filter(r=>r.trend != null);
                const improved=comparable.filter(r=>r.trend>0.05).length;
                const declined=comparable.filter(r=>r.trend<-0.05).length;
                insights.push({icon:'git-compare-arrows', text:`Perbandingan: ${improved} meningkat, ${declined} menurun daripada ${comparable.length} murid dengan dua rekod sah.`});
            }
        }
        container.innerHTML=insights.slice(0,4).map(i=>`<div class="flex gap-2 p-3 rounded-lg bg-white/5 border border-white/10"><i data-lucide="${i.icon}" class="w-4 h-4 text-amber-300 shrink-0 mt-0.5"></i><span class="text-xs text-slate-200 leading-relaxed">${i.text}</span></div>`).join('');
    }

    function renderAnalyticsCharts(scoredRows) {
        const gradeLabels = appSettings.gradeBoundaries.map(b => b.grade);
        const gradeCounts = Object.fromEntries(gradeLabels.map(g => [g,0]));
        scoredRows.forEach(r=>{
            const grade = r.score.grade && r.score.grade !== '-' ? r.score.grade : calculateGrade(Number(r.score.percentage));
            if(Object.prototype.hasOwnProperty.call(gradeCounts,grade)) gradeCounts[grade]++;
        });
        const gradeTotal = scoredRows.length;
        const gradePercentages = Object.fromEntries(gradeLabels.map(g => [g, gradeTotal ? Number((gradeCounts[g] / gradeTotal * 100).toFixed(1)) : 0]));
        const bandCounts=[0,0,0,0,0];
        scoredRows.forEach(r=>{ const p=r.score.percentage; if(p<40)bandCounts[0]++; else if(p<50)bandCounts[1]++; else if(p<65)bandCounts[2]++; else if(p<80)bandCounts[3]++; else bandCounts[4]++; });
        const gradeCanvas=document.getElementById('analytics-grade-chart');
        const bandCanvas=document.getElementById('analytics-band-chart');
        const compareCanvas=document.getElementById('analytics-compare-chart');
        if (analyticsGradeChartInstance) analyticsGradeChartInstance.destroy();
        if (analyticsBandChartInstance) analyticsBandChartInstance.destroy();
        if (analyticsCompareChartInstance) analyticsCompareChartInstance.destroy();
        if (gradeCanvas) analyticsGradeChartInstance=new Chart(gradeCanvas,{type:'bar',data:{labels:gradeLabels,datasets:[{label:'Peratus Calon (%)',data:gradeLabels.map(g=>gradePercentages[g]),backgroundColor:['#059669','#3B82F6','#F59E0B','#F97316','#E11D48'],borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${ctx.raw}% (${gradeCounts[ctx.label]||0} murid)`}}},scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}}},onClick:(evt,elements)=>{if(elements.length){const g=gradeLabels[elements[0].index];setAnalyticsGradeFilter(g);}}}});
        if (bandCanvas) analyticsBandChartInstance=new Chart(bandCanvas,{type:'doughnut',data:{labels:['0–39','40–49','50–64','65–79','80–100'],datasets:[{data:bandCounts,backgroundColor:['#E11D48','#F97316','#F59E0B','#3B82F6','#059669'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:8,usePointStyle:true,font:{size:10}}}}}});
        const aId=document.getElementById('analytics-assessment-a').value;
        const bId=document.getElementById('analytics-assessment-b').value;
        const comparisonStats=document.getElementById('analytics-comparison-stats');
        const subtitle=document.getElementById('analytics-comparison-subtitle');
        if (bId !== 'NONE') {
            const a=appState.assessments.find(x=>x.id===aId);
            const b=appState.assessments.find(x=>x.id===bId);
            const comparable=analyticsCurrentRows.filter(r=>r.score&&!r.score.absent&&r.score.percentage!=null&&r.comparisonScore&&!r.comparisonScore.absent&&r.comparisonScore.percentage!=null);
            const avgA=comparable.length?comparable.reduce((s,r)=>s+r.score.percentage,0)/comparable.length:0;
            const avgB=comparable.length?comparable.reduce((s,r)=>s+r.comparisonScore.percentage,0)/comparable.length:0;
            const improved=comparable.filter(r=>r.trend>0.05).length, declined=comparable.filter(r=>r.trend<-0.05).length, same=comparable.length-improved-declined;
            if(subtitle) subtitle.textContent=`${a?.name||'Pentaksiran A'} vs ${b?.name||'Pentaksiran B'}`;
            if(compareCanvas) analyticsCompareChartInstance=new Chart(compareCanvas,{type:'bar',data:{labels:['Purata'],datasets:[{label:a?.name||'A',data:[Number(avgA.toFixed(1))],backgroundColor:'#334E68',borderRadius:6},{label:b?.name||'B',data:[Number(avgB.toFixed(1))],backgroundColor:'#059669',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,max:100}},plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
            if(comparisonStats) comparisonStats.innerHTML=`<div class="rounded-lg bg-emerald-50 p-2"><p class="font-extrabold text-emerald-700">${improved}</p><p class="text-[10px] text-slate-500">Meningkat</p></div><div class="rounded-lg bg-slate-50 p-2"><p class="font-extrabold text-slate-700">${same}</p><p class="text-[10px] text-slate-500">Kekal</p></div><div class="rounded-lg bg-rose-50 p-2"><p class="font-extrabold text-rose-700">${declined}</p><p class="text-[10px] text-slate-500">Menurun</p></div>`;
        } else {
            if(subtitle) subtitle.textContent='Pilih pentaksiran kedua untuk membandingkan';
            if(compareCanvas) analyticsCompareChartInstance=new Chart(compareCanvas,{type:'bar',data:{labels:['Belum dipilih'],datasets:[{data:[0],backgroundColor:'#CBD5E1'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
            if(comparisonStats) comparisonStats.innerHTML='<p class="col-span-3 text-[11px] text-slate-400 py-2">Tiada perbandingan aktif</p>';
        }
    }

    function analyticsNearMissInfo(row){
        const score=row?.score;
        if(!score||score.absent||score.percentage===null||score.percentage===undefined){
            return {nearMiss:false};
        }

        const value=Number(score.percentage);
        if(!Number.isFinite(value))return {nearMiss:false};

        const grade=score.grade&&score.grade!=='-'?score.grade:calculateGrade(value);
        const currentIndex=appSettings.gradeBoundaries.findIndex(b=>b.grade===grade);
        if(currentIndex<=0)return {nearMiss:false};

        const better=appSettings.gradeBoundaries[currentIndex-1];
        const gap=Number((Number(better.min)-value).toFixed(1));
        const margin=Math.max(1,Number(phase9SchoolProfile?.nearMissMargin||5));

        return {
            nearMiss:gap>0&&gap<=margin,
            gap,
            value,
            currentGrade:grade,
            targetGrade:better.grade,
            targetMark:Number(better.min),
            margin
        };
    }

    function analyticsIsNearMiss(row){
        return analyticsNearMissInfo(row).nearMiss===true;
    }

    function renderAnalyticsNearMissList(){
        const container=document.getElementById('analytics-nearmiss-list');
        const countEl=document.getElementById('analytics-nearmiss-count');
        const marginEl=document.getElementById('analytics-nearmiss-margin');
        if(!container)return;

        const margin=Math.max(1,Number(phase9SchoolProfile?.nearMissMargin||5));
        if(marginEl)marginEl.textContent=margin;

        const rows=analyticsCurrentRows
            .filter(r=>analyticsIsNearMiss(r))
            .map(r=>({row:r,info:analyticsNearMissInfo(r)}))
            .sort((a,b)=>a.info.gap-b.info.gap || String(a.row.student.name).localeCompare(String(b.row.student.name),'ms'));

        if(countEl)countEl.textContent=`${rows.length} murid`;

        if(!rows.length){
            container.innerHTML='<div class="md:col-span-2 xl:col-span-3 p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">Tiada calon near miss dalam skop semasa berdasarkan margin yang ditetapkan.</div>';
            return;
        }

        container.innerHTML=rows.slice(0,12).map(({row:r,info})=>`
            <div class="analytics-nearmiss-card">
                <div class="min-w-0">
                    <button onclick="openStudentProfile('${r.student.id}')" class="analytics-nearmiss-name">${escapeHtml(r.student.name)}</button>
                    <p class="analytics-nearmiss-meta">${escapeHtml(r.cls?.name||'')} · ${escapeHtml(r.assessment?.name||'')}</p>
                </div>
                <div class="analytics-nearmiss-score">
                    <strong>${formatWholePercent(info.value)}</strong>
                    <span>Gred ${info.currentGrade} → ${info.targetGrade}</span>
                    <small>${hcFmt(info.gap)} markah lagi</small>
                </div>
            </div>
        `).join('');
    }

    function analyticsRowStatus(row) {
        if (!row.score) return 'MISSING';
        if (row.score.absent) return 'ABSENT';
        if (row.score.percentage == null) return 'MISSING';
        return isMasteredMark(row.score.percentage) ? 'MENGUASAI' : 'SOKONGAN';
    }

    function analyticsClassSortRank(cls){
        const year=Number(cls?.year||0);
        const name=String(cls?.name||'').toUpperCase();

        let classOrder=99;
        if(name.includes('AL-BIRUNI'))classOrder=1;
        else if(name.includes('AL-FARABI'))classOrder=2;
        else if(name.includes('AL-KHAWARIZMI'))classOrder=3;

        return year*10+classOrder;
    }

    function sortAnalyticsRowsByClassThenName(rows){
        return [...rows].sort((a,b)=>{
            const rankA=analyticsClassSortRank(a.cls);
            const rankB=analyticsClassSortRank(b.cls);
            if(rankA!==rankB)return rankA-rankB;

            return String(a.student?.name||'').localeCompare(
                String(b.student?.name||''),
                'ms',
                {sensitivity:'base'}
            );
        });
    }

    function analyticsStudentFilterClasses(){
        const year=document.getElementById('analytics-student-year-filter')?.value||'ALL';
        const classSelect=document.getElementById('analytics-student-class-filter');
        if(!classSelect)return;

        const current=classSelect.value||'ALL';
        const classMap=new Map();

        analyticsCurrentRows.forEach(r=>{
            const cls=r.cls;
            const student=r.student;
            if(!cls||!student)return;
            if(year!=='ALL'&&String(student.year)!==String(year))return;
            classMap.set(cls.id,cls);
        });

        const classes=[...classMap.values()].sort((a,b)=>{
            const rankA=analyticsClassSortRank(a);
            const rankB=analyticsClassSortRank(b);
            if(rankA!==rankB)return rankA-rankB;
            return String(a.name||'').localeCompare(String(b.name||''),'ms',{sensitivity:'base'});
        });

        classSelect.innerHTML='<option value="ALL">Semua Kelas</option>'+
            classes.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');

        classSelect.value=[...classSelect.options].some(o=>o.value===current)?current:'ALL';
    }

    function onAnalyticsStudentYearFilterChange(){
        analyticsStudentFilterClasses();
        renderAnalyticsStudentTable();
    }

    function resetAnalyticsStudentLocalFilters(){
        const year=document.getElementById('analytics-student-year-filter');
        const cls=document.getElementById('analytics-student-class-filter');
        if(year)year.value='ALL';
        if(cls)cls.value='ALL';
        analyticsStudentFilterClasses();
    }

    function renderAnalyticsStudentTable() {
        const tbody=document.getElementById('analytics-student-body');
        const mobile=document.getElementById('analytics-mobile-cards');
        const empty=document.getElementById('analytics-empty');
        if(!tbody||!mobile||!empty)return;

        const q=(document.getElementById('analytics-search')?.value||'').trim().toLowerCase();
        const year=document.getElementById('analytics-student-year-filter')?.value||'ALL';
        const classId=document.getElementById('analytics-student-class-filter')?.value||'ALL';
        const grade=document.getElementById('analytics-grade-filter')?.value||'ALL';
        const status=document.getElementById('analytics-status-filter')?.value||'ALL';

        let rows=analyticsCurrentRows.filter(r=>!q||r.student.name.toLowerCase().includes(q));
        if(year!=='ALL')rows=rows.filter(r=>String(r.student?.year)===String(year));
        if(classId!=='ALL')rows=rows.filter(r=>String(r.student?.classId)===String(classId));
        if(grade!=='ALL')rows=rows.filter(r=>r.score?.grade===grade);
        if(status==='NEAR_MISS')rows=rows.filter(r=>analyticsIsNearMiss(r));
        else if(status!=='ALL')rows=rows.filter(r=>analyticsRowStatus(r)===status);
        rows=sortAnalyticsRowsByClassThenName(rows);

        tbody.innerHTML='';
        mobile.innerHTML='';
        empty.classList.toggle('hidden',rows.length>0);

        if(!rows.length){
            if(typeof lucide!=='undefined')lucide.createIcons();
            return;
        }

        rows.forEach((r,i)=>{
            const st=analyticsRowStatus(r);
            let statusBadge='';
            let statusLabel='';
            if(st==='MENGUASAI'){
                statusLabel='Menguasai';
                statusBadge='<span class="analytics-status-pill is-success">Menguasai</span>';
            }else if(st==='SOKONGAN'){
                statusLabel='Perlu Sokongan';
                statusBadge='<span class="analytics-status-pill is-danger">Perlu Sokongan</span>';
            }else if(st==='ABSENT'){
                statusLabel='Tidak Hadir';
                statusBadge='<span class="analytics-status-pill is-warning">Tidak Hadir</span>';
            }else{
                statusLabel='Belum Diisi';
                statusBadge='<span class="analytics-status-pill is-neutral">Belum Diisi</span>';
            }

            let trend='—';
            if(r.trend!=null){
                trend=r.trend>0.05
                    ? `<span class="text-emerald-700 font-bold">↑ ${formatSignedWholePercent(r.trend)}</span>`
                    : r.trend<-0.05
                        ? `<span class="text-rose-700 font-bold">↓ ${formatSignedWholePercent(r.trend)}</span>`
                        : '<span class="text-slate-500 font-bold">→ 0%</span>';
            }

            const markText=r.score?.absent
                ? 'TH'
                : (r.score?.percentage==null?'—':formatWholePercent(r.score.percentage));
            const gr=r.score?.grade||'—';
            const classLabel=r.cls?.name||'—';

            // Desktop / tablet table.
            const tr=document.createElement('tr');
            tr.className='hover:bg-slate-50/80';
            tr.innerHTML=`
                <td class="px-4 py-3 text-slate-500">${i+1}</td>
                <td class="px-4 py-3 font-bold text-slate-800">
                    <button onclick="openStudentProfile('${r.student.id}')" class="text-left hover:text-emerald-700 hover:underline">${escapeHtml(r.student.name)}</button>
                </td>
                <td class="px-4 py-3 text-slate-600">${escapeHtml(classLabel)}</td>
                <td class="px-4 py-3 font-bold text-slate-800 percent-nowrap">${markText}</td>
                <td class="px-4 py-3"><span class="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs">${gr}</span></td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3">${trend}</td>`;
            tbody.appendChild(tr);

            // Phone-native card. No horizontal table and no squeezed text.
            const card=document.createElement('article');
            card.className='analytics-mobile-student-card';
            card.innerHTML=`
                <div class="analytics-mobile-card-head">
                    <div class="analytics-mobile-card-index">${i+1}</div>
                    <div class="analytics-mobile-card-name">
                        <button onclick="openStudentProfile('${r.student.id}')">${escapeHtml(r.student.name)}</button>
                        <span>${escapeHtml(classLabel)}</span>
                    </div>
                    <div class="analytics-mobile-card-grade">${gr}</div>
                </div>
                <div class="analytics-mobile-card-grid">
                    <div class="analytics-mobile-metric">
                        <span>Markah</span>
                        <strong class="percent-nowrap">${markText}</strong>
                    </div>
                    <div class="analytics-mobile-metric">
                        <span>Status</span>
                        <strong>${statusBadge}</strong>
                    </div>
                    <div class="analytics-mobile-metric">
                        <span>Trend</span>
                        <strong>${trend}</strong>
                    </div>
                </div>`;
            mobile.appendChild(card);
        });

        if(typeof lucide!=='undefined')lucide.createIcons();
    }

    function renderAnalyticsSupportList() {
        const container=document.getElementById('analytics-support-list'); if(!container)return;
        const rows=analyticsCurrentRows.filter(r=>analyticsRowStatus(r)==='SOKONGAN').sort((a,b)=>a.score.percentage-b.score.percentage);
        if(!rows.length){container.innerHTML='<div class="md:col-span-2 xl:col-span-3 p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">Tiada murid bermarkah dalam julat sokongan 0–39% bagi skop semasa.</div>';return;}
        container.innerHTML=rows.slice(0,9).map(r=>`<div class="rounded-xl border border-rose-100 bg-rose-50/40 p-3 flex items-center justify-between gap-3"><div class="min-w-0"><button onclick="openStudentProfile('${r.student.id}')" class="font-bold text-slate-800 hover:text-emerald-700 text-xs truncate text-left">${r.student.name}</button><p class="text-[10px] text-slate-500 mt-0.5">${r.cls?.name||''} · ${r.assessment?.name||''}</p></div><div class="text-right shrink-0"><p class="font-extrabold text-rose-700">${formatWholePercent(r.score.percentage)}</p><p class="text-[10px] text-slate-500">Gred ${r.score.grade}</p></div></div>`).join('');
    }

    function setAnalyticsGradeFilter(grade) { const el=document.getElementById('analytics-grade-filter'); if(el){el.value=grade;renderAnalyticsStudentTable();} }
    function setAnalyticsStatusFilter(status) { const el=document.getElementById('analytics-status-filter'); if(el){el.value=status;renderAnalyticsStudentTable();document.getElementById('analytics-student-body')?.closest('.bg-white')?.scrollIntoView({behavior:'smooth',block:'start'});} }

    function exportAnalyticsCSV() {
        if(!analyticsCurrentRows.length){showAlert('Tiada Data','Tiada rekod analisis untuk dieksport.','warning');return;}
        const headers=['Nama Murid','Kelas','Pentaksiran','Jenis Ujian','Markah (%)','Gred','Mata Gred','Status'];
        const lines=[headers.join(',')];
        analyticsCurrentRows.forEach(r=>{
            const status=analyticsRowStatus(r);
            const pct=r.score?.percentage??'';
            const g=r.score?.grade || (r.score?.percentage != null ? calculateGrade(Number(r.score.percentage)) : '');
            lines.push([
                `"${String(r.student.name).replaceAll('"','""')}"`,
                `"${r.cls?.name||''}"`,
                `"${r.assessment?.name||''}"`,
                r.assessment?.type||'',
                pct,
                g,
                gradePointForGrade(g)??'',
                status
            ].join(','));
        });
        const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`Analisis_Markah_Sejarah_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }



    // ==============================================================
    // ==============================================================
    // HEADCOUNT & ANALISIS PRESTASI SEJARAH — TAHUN 4, 5 & 6
    // One source of truth:
    // AR1 = UPSA score in appState.scores
    // AR2 = UASA score in appState.scores
    // TOV = automatic percentage from ACTUAL Diagnostik score (same live marks source)
    // ==============================================================
    const HEADCOUNT_STORAGE_KEY='sejarah_headcount_demo_v2';
    const HEADCOUNT_GRADE_SCALE=[
        {grade:'A',min:82,max:100,point:1,label:'Cemerlang'},
        {grade:'B',min:66,max:81,point:2,label:'Kepujian'},
        {grade:'C',min:50,max:65,point:3,label:'Baik'},
        {grade:'D',min:35,max:49,point:4,label:'Memuaskan'},
        {grade:'E',min:20,max:34,point:5,label:'Mencapai Tahap Minimum'},
        {grade:'F',min:0,max:19,point:6,label:'Belum Mencapai Tahap Minimum'}
    ];
    const HEADCOUNT_SEJARAH_DOMAINS=['Objektif','Struktur','KBAT','Fakta','Kronologi','Tokoh','Sebab dan Kesan']; // architecture-ready, no fake data
    let headcountState={toyOverrides:{},interventions:{},lastScope:{},ui:{tab:'summary',assessment:'UPSA',gradeAssessment:'UPSA',trendMetric:'MARK'}};
    let hcCharts={summaryGrade:null,grade:null,trend:null,projection:null,student:null};
    let hcSelectedStudentId=null;

    function restoreHeadcountState(){
        try{
            const saved=localStorage.getItem(HEADCOUNT_STORAGE_KEY);
            if(saved){
                const parsed=JSON.parse(saved);
                headcountState={
                    ...headcountState,
                    ...parsed,
                    toyOverrides:{...(headcountState.toyOverrides||{}),...(parsed.toyOverrides||{})},
                    interventions:{...(headcountState.interventions||{}),...(parsed.interventions||{})},
                    lastScope:{...(headcountState.lastScope||{}),...(parsed.lastScope||{})},
                    ui:{...(headcountState.ui||{}),...(parsed.ui||{})}
                };
            }
        }catch(e){console.warn('Gagal memulihkan Headcount:',e);}
    }
    function persistHeadcountState(){
        try{localStorage.setItem(HEADCOUNT_STORAGE_KEY,JSON.stringify(headcountState));}
        catch(e){console.warn('Gagal menyimpan Headcount:',e);}
    }
    restoreHeadcountState();

    function hcFmt(v,digits=1){
        if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))return '—';
        const n=Number(v);
        return n.toFixed(digits).replace(/\.0$/,'');
    }
    function hcPct(v,digits=1){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':`${hcFmt(v,digits)}%`;}
    function hcAverage(values){
        const valid=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
        return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;
    }
    function hcGrade(score){
        if(score===null||score===undefined||!Number.isFinite(Number(score)))return '—';
        const n=Number(score),bound=HEADCOUNT_GRADE_SCALE.find(b=>n>=b.min&&n<=b.max);
        return bound?.grade||'—';
    }
    function hcGradePoint(grade){return HEADCOUNT_GRADE_SCALE.find(b=>b.grade===grade)?.point??null;}
    function hcGradeBadge(grade){
        if(!grade||grade==='—')return '';
        const safe=grade==='TH'?'TH':grade;
        return `<span class="hc-grade-badge hc-grade-${safe}">${safe}</span>`;
    }
    function hcMarkGrade(value,status='VALUE'){
        if(status==='TH')return `<span class="hc-mark-grade">${hcGradeBadge('TH')}</span>`;
        if(value===null||value===undefined)return '<span class="text-slate-400">—</span>';
        const grade=hcGrade(value);
        return `<span class="hc-mark-grade"><strong>${hcFmt(value)}%</strong>${hcGradeBadge(grade)}</span>`;
    }
    function hcInitials(name){
        return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'M';
    }
    function hcCurrentIncrements(){
        const cfg=phase9SchoolProfile.headcountIncrements||{};
        return {
            oti1:Math.max(0,Number(cfg.oti1??3)),
            oti2:Math.max(0,Number(cfg.oti2??3)),
            etr:Math.max(0,Number(cfg.etr??4))
        };
    }

    function headcountAllowedClasses(academicYear,year,classId='ALL'){
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let rows=canonicalActiveClasses(academicYear).filter(c=>[4,5,6].includes(Number(c.year)));
        if(year&&year!=='ALL')rows=rows.filter(c=>String(c.year)===String(year));
        if(isTeacherSession())rows=rows.filter(c=>c.teacherId===currentUserId);
        if(classId&&classId!=='ALL')rows=rows.filter(c=>c.id===classId);
        return sortClassesCanonical(rows);
    }
    function hcCanEditStudent(student){
        if(isAdminSession())return true;
        const cls=appState.classes.find(c=>c.id===student.classId);
        return isTeacherSession()&&cls?.teacherId===currentUserId;
    }
    function latestAssessmentForStudentType(student,type,academicYear){
        return appState.assessments
            .filter(a=>a.type===type&&String(a.academicYear)===String(academicYear)&&a.classId===student.classId)
            .sort((a,b)=>compareAssessmentsByExamDate(b,a))[0]||null;
    }
    function hcAssessmentResult(student,type,academicYear){
        const assessment=latestAssessmentForStudentType(student,type,academicYear);
        if(!assessment)return {value:null,status:'MISSING',assessment:null,score:null};
        const score=getActualScoreRecords().find(s=>s.studentId===student.id&&s.assessmentId===assessment.id);
        if(!score)return {value:null,status:'MISSING',assessment,score:null};
        if(score.absent)return {value:null,status:'TH',assessment,score};
        if(score.percentage===null||score.percentage===undefined||!Number.isFinite(Number(score.percentage)))return {value:null,status:'MISSING',assessment,score};
        return {value:Number(score.percentage),status:'VALUE',assessment,score};
    }

    function hcToyResult(student,academicYear){
        // TOV always comes directly from the Diagnostik percentage.
        // Headcount has no manual TOV override and no mock-mark fallback.
        const diag=hcAssessmentResult(student,'DIAGNOSTIK',academicYear);
        return {...diag,source:'DIAGNOSTIK'};
    }

    function hcCurrentMethod(){
        return phase9SchoolProfile.headcountMethod==='METHOD2'?'METHOD2':'METHOD1';
    }

    function hcComputeTargetValues(tov){
        if(tov===null||tov===undefined||!Number.isFinite(Number(tov))){
            return {oti1:null,oti2:null,etr:null,method:hcCurrentMethod()};
        }

        const base=Math.max(0,Math.min(100,Number(tov)));
        const method=hcCurrentMethod();

        if(method==='METHOD2'){
            let etr;
            if(base>=90)etr=base+2;
            else if(base>=80)etr=base+4;
            else if(base>=70)etr=base+6;
            else if(base>=60)etr=base+8;
            else if(base>=40)etr=base+10;
            else etr=base+10; // continuation for TOV < 40

            etr=Math.max(0,Math.min(100,etr));

            // Formula supplied for Kaedah 2.
            // ROUNDUP(...,0) for positive mark values = Math.ceil(...).
            const oti1=Math.max(0,Math.min(100,Math.ceil(base+((etr-base)/3))));
            const oti2=Math.max(0,Math.min(100,Math.ceil(base+(((etr-base)*2)/3))));
            return {oti1,oti2,etr,method};
        }

        const inc=hcCurrentIncrements();
        const oti1=Math.min(base+inc.oti1,100);
        const oti2=Math.min(oti1+inc.oti2,100);
        const etr=Math.min(oti2+inc.etr,100);
        return {oti1,oti2,etr,method};
    }

    function hcBuildRow(student,academicYear){
        const toy=hcToyResult(student,academicYear);
        const ar1=hcAssessmentResult(student,'UPSA',academicYear);
        const ar2=hcAssessmentResult(student,'UASA',academicYear);

        // IMPORTANT: these target values are the single source used by:
        // Headcount > Prestasi Murid, Dashboard GPMP, reports and charts.
        const target=toy.status==='VALUE'
            ? hcComputeTargetValues(toy.value)
            : {oti1:null,oti2:null,etr:null,method:hcCurrentMethod()};

        const oti1=target.oti1;
        const oti2=target.oti2;
        const etr=target.etr;
        const latestActual=ar2.status!=='MISSING'
            ? {...ar2,stage:'UASA',target:oti2}
            : ar1.status!=='MISSING'
                ? {...ar1,stage:'UPSA',target:oti1}
                : {...toy,stage:'TOV',target:null};
        const status=hcTargetStatus(latestActual.value,latestActual.target,latestActual.status);

        return {student,toy,oti1,ar1,oti2,ar2,etr,targetMethod:target.method,latestActual,status};
    }

    function hcTargetStatus(actual,target,status='VALUE'){
        if(status==='TH')return 'Tidak Hadir';
        if(actual===null||actual===undefined||target===null||target===undefined)return 'Belum Direkod';
        const diff=Number(actual)-Number(target);
        if(diff>0)return 'Melebihi Sasaran';
        if(diff===0)return 'Capai Sasaran';
        if(diff>=-5)return 'Hampir Sasaran';
        return 'Belum Capai Sasaran';
    }
    function hcStatusClass(status){
        if(status==='Melebihi Sasaran')return 'hc-status-exceed';
        if(status==='Capai Sasaran')return 'hc-status-hit';
        if(status==='Hampir Sasaran')return 'hc-status-near';
        if(status==='Belum Capai Sasaran')return 'hc-status-below';
        return 'hc-status-pending';
    }
    function hcStatusBadge(status){return `<span class="hc-status ${hcStatusClass(status)}">${escapeHtml(status)}</span>`;}
    function hcDiffHtml(actual,target,status='VALUE'){
        if(status==='TH')return '<span class="hc-status hc-status-pending">TH</span>';
        if(actual===null||actual===undefined||target===null||target===undefined)return '<span class="text-slate-400">—</span>';
        const d=Number(actual)-Number(target);
        if(d>0)return `<span class="hc-diff up">↑ +${hcFmt(d)}</span>`;
        if(d===0)return '<span class="hc-diff equal">✓ 0</span>';
        if(d>=-5)return `<span class="hc-diff near">↓ ${hcFmt(d)}</span>`;
        return `<span class="hc-diff down">↓ ${hcFmt(d)}</span>`;
    }

    function hcSelectedScope(){
        return {
            academicYear:document.getElementById('headcount-session')?.value||getActiveAcademicYear(),
            year:document.getElementById('headcount-year')?.value||'4',
            classId:document.getElementById('headcount-class')?.value||'ALL'
        };
    }
    function hcScopeRows(){
        const {academicYear,year,classId}=hcSelectedScope(),classes=headcountAllowedClasses(academicYear,year,classId),ids=new Set(classes.map(c=>c.id));
        const students=sortStudentsAZ(appState.students
            .filter(s=>s.status==='Aktif'&&String(s.academicYear)===String(academicYear)&&[4,5,6].includes(Number(s.year))&&String(s.year)===String(year)&&ids.has(s.classId)));
        return students.map(s=>hcBuildRow(s,academicYear));
    }

    function hcStageResult(row,key){
        if(key==='TOY')return row.toy;
        if(key==='UPSA')return row.ar1;
        if(key==='UASA')return row.ar2;
        if(key==='ETR')return row.etr===null?{value:null,status:'MISSING'}:{value:row.etr,status:'VALUE'};
        return {value:null,status:'MISSING'};
    }
    function hcMetrics(rows,key){
        const results=rows.map(r=>({row:r,...hcStageResult(r,key)}));
        const valid=results.filter(x=>x.status==='VALUE'&&Number.isFinite(Number(x.value)));
        const absent=results.filter(x=>x.status==='TH');
        const missing=results.filter(x=>x.status==='MISSING');
        const grades={A:0,B:0,C:0,D:0,E:0,F:0};
        valid.forEach(x=>{const g=hcGrade(x.value);if(grades[g]!==undefined)grades[g]++;});
        const taken=valid.length,total=rows.length,mtm=grades.A+grades.B+grades.C+grades.D+grades.E,bmtm=grades.F;
        const gpmp=taken?Number((Object.entries(grades).reduce((sum,[g,c])=>sum+c*(hcGradePoint(g)||0),0)/taken).toFixed(2)):null;
        return {
            total,taken,absent:absent.length,missing:missing.length,
            average:hcAverage(valid.map(x=>x.value)),grades,gpmp,mtm,bmtm,
            mtmPct:taken?mtm/taken*100:null,bmtmPct:taken?bmtm/taken*100:null
        };
    }

    function hcStatusForAssessment(row,key='LATEST'){
        if(key==='UPSA')return hcTargetStatus(row.ar1.value,row.oti1,row.ar1.status);
        if(key==='UASA')return hcTargetStatus(row.ar2.value,row.oti2,row.ar2.status);
        if(key==='TOY')return 'Belum Direkod';
        return row.status;
    }
    function hcTargetCounts(rows,key='LATEST'){
        const labels=['Melebihi Sasaran','Capai Sasaran','Hampir Sasaran','Belum Capai Sasaran'];
        const counts=Object.fromEntries(labels.map(x=>[x,0]));
        rows.forEach(r=>{const status=hcStatusForAssessment(r,key);if(counts[status]!==undefined)counts[status]++;});
        return counts;
    }
    function hcAttentionReasons(row,assessmentKey){
        const reasons=[],selected=hcStageResult(row,assessmentKey);
        if(selected.status==='MISSING')reasons.push('Rekod pentaksiran belum lengkap');
        if(selected.status==='VALUE'&&hcGrade(selected.value)==='F')reasons.push('Perlu pengukuhan asas');
        if(hcStatusForAssessment(row,assessmentKey)==='Belum Capai Sasaran')reasons.push('Masih di bawah sasaran headcount');
        if(row.ar1.status==='VALUE'&&row.oti1!==null&&row.ar1.value<row.oti1-5)reasons.push('AR1 belum mencapai OT1');
        if(row.ar2.status==='VALUE'&&row.oti2!==null&&row.ar2.value<row.oti2-5)reasons.push('AR2 belum mencapai OT2');
        if(row.toy.status==='VALUE'&&row.latestActual?.status==='VALUE'&&row.latestActual.value<row.toy.value-8)reasons.push('Prestasi menurun dan perlu dipantau');
        return [...new Set(reasons)];
    }

    function populateHeadcountClasses(){
        const session=document.getElementById('headcount-session')?.value||getActiveAcademicYear(),year=document.getElementById('headcount-year')?.value||'4',el=document.getElementById('headcount-class');
        if(!el)return;
        const prev=headcountState.lastScope?.classId||el.value||'ALL',classes=headcountAllowedClasses(session,year,'ALL');
        el.innerHTML='<option value="ALL">Semua Kelas</option>'+classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name.replace(/^\d+\s+/,''))}</option>`).join('');
        el.value=classes.some(c=>c.id===prev)?prev:'ALL';
    }
    function onHeadcountScopeChange(source){
        if(source==='session'||source==='year')populateHeadcountClasses();
        const scope=hcSelectedScope();headcountState.lastScope={...scope};persistHeadcountState();renderHeadcount();
    }
    function initializeHeadcount(){
        populateAcademicSessionSelectors(true);
        const session=document.getElementById('headcount-session');
        if(session){
            const preferred=headcountState.lastScope?.academicYear;
            session.value=normalizedAcademicSessions().some(s=>s.year===preferred)?preferred:getActiveAcademicYear();
        }
        const yearEl=document.getElementById('headcount-year');
        const sessionYear=session?.value||getActiveAcademicYear();
        const allowed=headcountAllowedClasses(sessionYear,'ALL','ALL');
        const availableYears=[...new Set(allowed.map(c=>String(c.year)))].filter(y=>['4','5','6'].includes(y)).sort();
        const preferredYear=String(headcountState.lastScope?.year||document.getElementById('filter-tahun')?.value||'');
        yearEl.value=availableYears.includes(preferredYear)?preferredYear:(availableYears[0]||'4');
        populateHeadcountClasses();
        const classEl=document.getElementById('headcount-class');
        if(classEl&&headcountState.lastScope?.classId&&[...classEl.options].some(o=>o.value===headcountState.lastScope.classId))classEl.value=headcountState.lastScope.classId;
        switchHeadcountTab(headcountState.ui?.tab||'summary',false);
        renderHeadcount();
    }
    function switchHeadcountTab(tab,render=true){
        if(!['summary','students','grades','trend'].includes(tab))tab='summary';
        headcountState.ui.tab=tab;persistHeadcountState();
        ['summary','students','grades','trend'].forEach(t=>{
            document.getElementById(`hc-tab-${t}`)?.classList.toggle('hidden',t!==tab);
            document.getElementById(`hc-tab-btn-${t}`)?.classList.toggle('active',t===tab);
        });
        if(render)renderHeadcount();
    }
    function setHeadcountAssessment(key){
        headcountState.ui.assessment=key;persistHeadcountState();
        ['TOY','UPSA','UASA'].forEach(k=>document.getElementById(`hc-assess-${k}`)?.classList.toggle('active',k===key));
        renderHeadcountSummary(hcScopeRows());
    }
    function setHeadcountGradeAssessment(key){
        headcountState.ui.gradeAssessment=key;persistHeadcountState();
        ['TOY','UPSA','UASA','ETR'].forEach(k=>document.getElementById(`hc-grade-${k}`)?.classList.toggle('active',k===key));
        renderHeadcountGradeAnalysis(hcScopeRows());
    }

    function renderHeadcount(){
        const rows=hcScopeRows(),scope=hcSelectedScope(),classes=headcountAllowedClasses(scope.academicYear,scope.year,scope.classId);
        const classLabel=scope.classId==='ALL'?'Semua Kelas':(classes[0]?.name||'Kelas').replace(/^\d+\s+/,'');
        const teacherIds=[...new Set(classes.map(c=>c.teacherId).filter(Boolean))],teachers=teacherIds.map(id=>mockTeachers.find(t=>t.id===id)?.name).filter(Boolean);
        const teacherLabel=teachers.length===1?teachers[0]:teachers.length>1?'Pelbagai Guru Sejarah':(isTeacherSession()?mockTeachers.find(t=>t.id===currentUserId)?.name||'Guru Sejarah':'—');
        const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
        set('hc-context-class',`Tahun ${scope.year} • ${classLabel}`);
        set('hc-context-teacher',teacherLabel);set('hc-context-session',phase9AyLabel(scope.academicYear));set('hc-context-students',rows.length);

        const assessment=headcountState.ui.assessment||'UPSA',gradeAssessment=headcountState.ui.gradeAssessment||'UPSA';
        ['TOY','UPSA','UASA'].forEach(k=>document.getElementById(`hc-assess-${k}`)?.classList.toggle('active',k===assessment));
        ['TOY','UPSA','UASA','ETR'].forEach(k=>document.getElementById(`hc-grade-${k}`)?.classList.toggle('active',k===gradeAssessment));

        renderHeadcountSummary(rows);
        renderHeadcountStudents(rows);
        renderHeadcountGradeAnalysis(rows);
        renderHeadcountTrend(rows);
        if(hcSelectedStudentId&&document.getElementById('hc-drawer-overlay')&&!document.getElementById('hc-drawer-overlay').classList.contains('hidden'))openHeadcountStudentDrawer(hcSelectedStudentId,false);
        lucide.createIcons();
    }

    function renderHeadcountSummary(rows){
        const key=headcountState.ui.assessment||'UPSA',m=hcMetrics(rows,key),target=hcTargetCounts(rows,key),labels={TOY:'TOV',UPSA:'UPSA / AR1',UASA:'UASA / AR2'};
        const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;};
        const emptyAssessment=document.getElementById('hc-summary-empty-assessment');
        if(emptyAssessment){
            const noData=m.taken===0;
            emptyAssessment.classList.toggle('hidden',!noData);
            emptyAssessment.textContent=noData?`Belum ada data ${labels[key]}. Rekod kosong tidak dianggap sebagai 0% atau gred F.`:'';
        }
        set('hc-kpi-total',m.total);set('hc-kpi-average-label',`Purata ${labels[key]}`);set('hc-kpi-average',hcPct(m.average));
        set('hc-kpi-mtm',m.mtmPct===null?'—':`${m.mtmPct.toFixed(2)}%`);set('hc-kpi-bmtm',m.bmtmPct===null?'—':`${m.bmtmPct.toFixed(2)}%`);
        set('hc-kpi-mtm-note',m.taken?`${m.mtm} daripada ${m.taken} murid`:'Belum ada data');set('hc-kpi-bmtm-note',m.taken?`${m.bmtm} daripada ${m.taken} murid`:'Belum ada data');
        set('hc-kpi-gpmp',m.gpmp??'—');set('hc-kpi-target',(target['Melebihi Sasaran']||0)+(target['Capai Sasaran']||0));
        const attention=rows.filter(r=>hcAttentionReasons(r,key).length>0);set('hc-kpi-attention',attention.length);
        set('hc-summary-grade-subtitle',labels[key]);set('hc-summary-attendance',`${m.taken} ambil · ${m.absent} TH`);
        set('hc-summary-mtm-count',m.taken?`${m.mtm} daripada ${m.taken} murid`:'Belum ada data');set('hc-summary-bmtm-count',m.taken?`${m.bmtm} daripada ${m.taken} murid`:'Belum ada data');
        set('hc-summary-mtm-pct',m.mtmPct===null?'—':`${m.mtmPct.toFixed(2)}%`);set('hc-summary-bmtm-pct',m.bmtmPct===null?'—':`${m.bmtmPct.toFixed(2)}%`);
        const mtmBar=document.getElementById('hc-summary-mtm-bar'),bmtmBar=document.getElementById('hc-summary-bmtm-bar');if(mtmBar)mtmBar.style.width=`${m.mtmPct||0}%`;if(bmtmBar)bmtmBar.style.width=`${m.bmtmPct||0}%`;
        renderHcGradeChart('summaryGrade','hc-summary-grade-chart',m.grades);
        renderHcTargetComponents('hc-target-segment-bar','hc-target-legend',target);
        const list=document.getElementById('hc-attention-list');
        if(list)list.innerHTML=attention.length?attention.slice(0,6).map(r=>{
            const reasons=hcAttentionReasons(r,key);
            const selected=hcStageResult(r,key);
            return `<div class="hc-attention-item"><div><strong>${escapeHtml(r.student.name)}</strong><p>${selected.status==='TH'?'TH':selected.value!==null?`${hcFmt(selected.value)}% · ${hcGrade(selected.value)}`:'Belum Direkod'} · ${escapeHtml(reasons[0]||'Perlu dipantau')}</p></div><button onclick="openHeadcountStudentDrawer('${r.student.id}')">Lihat Analisis</button></div>`;
        }).join(''):'<div class="hc-empty !p-5"><i data-lucide="badge-check" class="w-6 h-6 text-emerald-600"></i><strong>Tiada murid memerlukan sokongan segera</strong><span>Berdasarkan data semasa.</span></div>';
    }

    function renderHcGradeChart(key,canvasId,grades){
        const canvas=document.getElementById(canvasId);if(!canvas||typeof Chart==='undefined')return;
        if(hcCharts[key])hcCharts[key].destroy();
        hcCharts[key]=new Chart(canvas,{type:'bar',data:{labels:['A','B','C','D','E','F'],datasets:[{data:['A','B','C','D','E','F'].map(g=>grades[g]||0),backgroundColor:['#22C55E','#10B981','#3B82F6','#F59E0B','#F97316','#EF4444'],borderRadius:6,maxBarThickness:38}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw} murid`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0},title:{display:true,text:'Jumlah Murid'},grid:{color:'rgba(148,163,184,.15)'}}}}});
    }

    function renderHcTargetComponents(barId,legendId,counts){
        const total=Object.values(counts).reduce((a,b)=>a+b,0),defs=[
            ['Melebihi Sasaran','#10B981'],['Capai Sasaran','#3B82F6'],['Hampir Sasaran','#F59E0B'],['Belum Capai Sasaran','#FB7185']
        ];
        const bar=document.getElementById(barId),legend=document.getElementById(legendId);
        if(bar)bar.innerHTML=defs.map(([label,color])=>`<span title="${label}" style="width:${total?(counts[label]||0)/total*100:0}%;background:${color}"></span>`).join('');
        if(legend)legend.innerHTML=defs.map(([label,color])=>`<div class="hc-target-legend-item"><span><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:5px"></i>${label}</span><strong>${counts[label]||0} murid · ${formatWholePercent(total?((counts[label]||0)/total*100):0)}</strong></div>`).join('');
    }

    function saveHeadcountToy(studentId,raw){
        showAlert('TOV Automatik','Nilai TOV diambil secara automatik daripada markah Ujian Diagnostik dan tidak boleh diubah dalam Headcount.','info');
        renderHeadcount();
    }

    function showHeadcountSaveState(label){
        const el=document.getElementById('hc-autosave-status');if(!el)return;el.innerHTML=`<i data-lucide="${label.includes('Menyimpan')?'cloud-upload':'cloud-check'}" class="w-3.5 h-3.5"></i> ${label}`;lucide.createIcons();
    }

    function renderHeadcountStudents(rowsArg=null){
        const rows=rowsArg||hcScopeRows(),q=(document.getElementById('hc-student-search')?.value||'').trim().toLowerCase(),filter=document.getElementById('hc-performance-filter')?.value||'ALL';
        const filtered=rows.filter(r=>{
            if(q&&!r.student.name.toLowerCase().includes(q))return false;
            if(filter==='ALL')return true;
            if(['Melebihi Sasaran','Capai Sasaran','Hampir Sasaran','Belum Capai Sasaran'].includes(filter))return r.status===filter;
            if(filter==='TH')return r.latestActual.status==='TH';
            const result=r.latestActual;
            if(result.status!=='VALUE')return false;
            const g=hcGrade(result.value);if(filter==='MTM')return g!=='F';if(filter==='BMTM')return g==='F';return true;
        });
        const body=document.getElementById('hc-student-table-body'),mobile=document.getElementById('hc-mobile-student-cards'),empty=document.getElementById('hc-student-table-empty');
        if(body)body.innerHTML=filtered.map((r,index)=>{
            const cls=appState.classes.find(c=>c.id===r.student.classId);
            return `<tr>
                <td class="hc-row-number">${String(index+1).padStart(2,'0')}</td>
                <td><div class="hc-student-main"><span class="hc-avatar">${hcInitials(r.student.name)}</span><div><strong title="${escapeHtml(r.student.name)}">${escapeHtml(r.student.name)}</strong><span>${escapeHtml(cls?.name||'—')}</span></div></div></td>
                <td>${hcMarkGrade(r.toy.value,r.toy.status)}<div class="hc-tov-source">Auto · Diagnostik</div></td>
                <td class="font-bold">${r.oti1===null?'—':hcPct(r.oti1)}</td>
                <td>${hcMarkGrade(r.ar1.value,r.ar1.status)}</td>
                <td>${hcDiffHtml(r.ar1.value,r.oti1,r.ar1.status)}</td>
                <td class="font-bold">${r.oti2===null?'—':hcPct(r.oti2)}</td>
                <td>${hcMarkGrade(r.ar2.value,r.ar2.status)}</td>
                <td>${hcDiffHtml(r.ar2.value,r.oti2,r.ar2.status)}</td>
                <td>${hcMarkGrade(r.etr,r.etr===null?'MISSING':'VALUE')}</td>
                <td>${hcStatusBadge(r.status)}</td>
                <td><button onclick="openHeadcountStudentDrawer('${r.student.id}')" class="hc-icon-btn" title="Lihat Prestasi"><i data-lucide="panel-right-open" class="w-3.5 h-3.5"></i></button></td>
            </tr>`;
        }).join('');
        if(empty)empty.classList.toggle('hidden',filtered.length>0);
        if(mobile)mobile.innerHTML=filtered.length?filtered.map(r=>{
            const current=r.ar2.status!=='MISSING'?{result:r.ar2,label:'UASA',target:r.oti2}:r.ar1.status!=='MISSING'?{result:r.ar1,label:'UPSA',target:r.oti1}:{result:r.toy,label:'TOV',target:null};
            return `<div class="hc-mobile-card">
                <div class="flex items-start justify-between gap-3"><div class="hc-student-main"><span class="hc-avatar">${hcInitials(r.student.name)}</span><div><strong>${escapeHtml(r.student.name)}</strong><span>${escapeHtml(appState.classes.find(c=>c.id===r.student.classId)?.name||'')}</span></div></div>${hcStatusBadge(r.status)}</div>
                <div class="mt-3">
                    <div class="hc-mobile-row"><span>${current.label}</span><strong>${current.result.status==='TH'?'TH':current.result.value===null?'—':`${hcFmt(current.result.value)}% · ${hcGrade(current.result.value)}`}</strong></div>
                    <div class="hc-mobile-row"><span>Target</span><strong>${current.target===null?'—':hcPct(current.target)}</strong></div>
                    <div class="hc-mobile-row"><span>Prestasi</span><strong>${hcDiffHtml(current.result.value,current.target,current.result.status)}</strong></div>
                    <div class="hc-mobile-row"><span>ETR</span><strong>${r.etr===null?'—':`${hcFmt(r.etr)}% · ${hcGrade(r.etr)}`}</strong></div>
                </div>
                <button onclick="openHeadcountStudentDrawer('${r.student.id}')" class="mt-3 w-full hc-outline-btn">Lihat Prestasi</button>
            </div>`;
        }).join(''):'<div class="hc-empty"><i data-lucide="search-x" class="w-7 h-7"></i><strong>Tiada murid ditemui</strong><span>Ubah carian atau penapis semasa.</span></div>';
        lucide.createIcons();
    }

    function renderHeadcountGradeAnalysis(rows){
        const key=headcountState.ui.gradeAssessment||'UPSA',m=hcMetrics(rows,key),labels={TOY:'TOV',UPSA:'UPSA',UASA:'UASA',ETR:'ETR'},set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        const emptyAssessment=document.getElementById('hc-grade-empty-assessment');
        if(emptyAssessment){
            const noData=m.taken===0;
            emptyAssessment.classList.toggle('hidden',!noData);
            emptyAssessment.textContent=noData?`Belum ada data ${labels[key]}. Murid tanpa markah tidak diberi gred F dan tidak dimasukkan dalam GPMP.`:'';
        }
        set('hc-grade-total',m.total);set('hc-grade-taken',m.taken);set('hc-grade-absent',m.absent);set('hc-grade-gpmp',m.gpmp??'—');set('hc-grade-analysis-label',labels[key]);
        set('hc-grade-mtm-count',m.taken?`${m.mtm} daripada ${m.taken} murid`:'Belum ada data');set('hc-grade-bmtm-count',m.taken?`${m.bmtm} daripada ${m.taken} murid`:'Belum ada data');
        set('hc-grade-mtm-pct',m.mtmPct===null?'—':`${m.mtmPct.toFixed(2)}%`);set('hc-grade-bmtm-pct',m.bmtmPct===null?'—':`${m.bmtmPct.toFixed(2)}%`);
        const a=document.getElementById('hc-grade-mtm-bar'),b=document.getElementById('hc-grade-bmtm-bar');if(a)a.style.width=`${m.mtmPct||0}%`;if(b)b.style.width=`${m.bmtmPct||0}%`;
        const cards=document.getElementById('hc-grade-cards');if(cards)cards.innerHTML=['A','B','C','D','E','F'].map(g=>`<div class="hc-grade-card"><div>${hcGradeBadge(g)}<p class="mt-1">${HEADCOUNT_GRADE_SCALE.find(x=>x.grade===g)?.label||''}</p></div><div class="text-right"><strong>${m.grades[g]||0}</strong><p>${formatWholePercent(m.taken?((m.grades[g]||0)/m.taken*100):0)}</p></div></div>`).join('');
        renderHcGradeChart('grade','hc-grade-chart',m.grades);
    }

    function hcGpmpFromValues(values){
        const valid=(values||[])
            .filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))
            .map(Number);
        if(!valid.length)return null;
        const points=valid
            .map(v=>hcGradePoint(hcGrade(v)))
            .filter(v=>Number.isFinite(Number(v)));
        return points.length
            ? Number((points.reduce((a,b)=>a+Number(b),0)/points.length).toFixed(2))
            : null;
    }

    function onHeadcountTrendMetricChange(){
        const metric=document.getElementById('hc-trend-metric')?.value==='GPMP'?'GPMP':'MARK';
        headcountState.ui=headcountState.ui||{};
        headcountState.ui.trendMetric=metric;
        persistHeadcountState();
        renderHeadcountTrend(hcScopeRows());
    }

    function renderHeadcountTrend(rows){
        const avgs={
            toy:hcAverage(rows.filter(r=>r.toy.status==='VALUE').map(r=>r.toy.value)),
            oti1:hcAverage(rows.map(r=>r.oti1)),
            upsa:hcAverage(rows.filter(r=>r.ar1.status==='VALUE').map(r=>r.ar1.value)),
            oti2:hcAverage(rows.map(r=>r.oti2)),
            uasa:hcAverage(rows.filter(r=>r.ar2.status==='VALUE').map(r=>r.ar2.value)),
            etr:hcAverage(rows.map(r=>r.etr))
        };

        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        set('hc-trend-toy',hcPct(avgs.toy));
        set('hc-trend-upsa-change',avgs.toy!==null&&avgs.upsa!==null?`${avgs.upsa-avgs.toy>=0?'↑ +':'↓ '}${hcFmt(avgs.upsa-avgs.toy)}%`:'—');
        set('hc-trend-uasa-change',avgs.upsa!==null&&avgs.uasa!==null?`${avgs.uasa-avgs.upsa>=0?'↑ +':'↓ '}${hcFmt(avgs.uasa-avgs.upsa)}%`:'—');
        const current=avgs.uasa??avgs.upsa??avgs.toy;
        const progress=current!==null&&avgs.etr?Math.min(100,current/avgs.etr*100):null;
        set('hc-trend-progress',progress===null?'—':`${formatWholePercent(progress)} menuju ETR`);

        const select=document.getElementById('hc-trend-metric');
        const savedMetric=headcountState.ui?.trendMetric==='GPMP'?'GPMP':'MARK';
        if(select&&select.value!==savedMetric)select.value=savedMetric;
        const metric=select?.value==='GPMP'?'GPMP':'MARK';
        headcountState.ui.trendMetric=metric;

        const subtitle=document.getElementById('hc-trend-subtitle');
        if(subtitle){
            subtitle.textContent=metric==='GPMP'
                ? 'Trend GPMP: sasaran TOV → OT1 → OT2 → ETR berbanding pencapaian TOV → AR1 → AR2'
                : 'Purata markah kelas: TOV → OT1 → UPSA → OT2 → UASA → ETR';
        }

        const canvas=document.getElementById('hc-trend-chart');
        if(canvas&&typeof Chart!=='undefined'){
            if(hcCharts.trend)hcCharts.trend.destroy();

            const dark=document.documentElement.classList.contains('theme-dark');
            let labels,datasets,scales;

            if(metric==='GPMP'){
                const targetGpmp={
                    tov:hcGpmpFromValues(rows.filter(r=>r.toy.status==='VALUE').map(r=>r.toy.value)),
                    ot1:hcGpmpFromValues(rows.map(r=>r.oti1)),
                    ot2:hcGpmpFromValues(rows.map(r=>r.oti2)),
                    etr:hcGpmpFromValues(rows.map(r=>r.etr))
                };
                const actualGpmp={
                    tov:targetGpmp.tov,
                    ar1:hcGpmpFromValues(rows.filter(r=>r.ar1.status==='VALUE').map(r=>r.ar1.value)),
                    ar2:hcGpmpFromValues(rows.filter(r=>r.ar2.status==='VALUE').map(r=>r.ar2.value))
                };

                labels=['TOV','OT1 / AR1','OT2 / AR2','ETR'];
                datasets=[
                    {
                        label:'Sasaran GPMP',
                        data:[targetGpmp.tov,targetGpmp.ot1,targetGpmp.ot2,targetGpmp.etr],
                        borderColor:dark?'#2DD4BF':'#0F766E',
                        backgroundColor:dark?'rgba(45,212,191,.08)':'rgba(15,118,110,.06)',
                        borderDash:[5,4],
                        pointRadius:4,
                        pointHoverRadius:5,
                        tension:.3,
                        spanGaps:true
                    },
                    {
                        label:'Pencapaian Sebenar GPMP',
                        data:[actualGpmp.tov,actualGpmp.ar1,actualGpmp.ar2,null],
                        borderColor:dark?'#FBBF24':'#C6A15B',
                        backgroundColor:dark?'rgba(251,191,36,.08)':'rgba(198,161,91,.08)',
                        pointRadius:5,
                        pointHoverRadius:6,
                        tension:.3,
                        spanGaps:true
                    }
                ];
                scales={
                    y:{
                        min:1,
                        max:6,
                        reverse:true,
                        ticks:{
                            stepSize:1,
                            color:dark?'#CBD5E1':'#64748B'
                        },
                        title:{
                            display:true,
                            text:'GPMP · lebih rendah lebih baik',
                            color:dark?'#CBD5E1':'#64748B',
                            font:{size:9}
                        },
                        grid:{color:'rgba(148,163,184,.15)'}
                    },
                    x:{
                        grid:{display:false},
                        ticks:{color:dark?'#CBD5E1':'#64748B'}
                    }
                };
            }else{
                labels=['TOV','OT1','UPSA','OT2','UASA','ETR'];
                datasets=[
                    {
                        label:'Sasaran',
                        data:[avgs.toy,avgs.oti1,avgs.oti1,avgs.oti2,avgs.oti2,avgs.etr],
                        borderColor:dark?'#2DD4BF':'#0F766E',
                        backgroundColor:dark?'rgba(45,212,191,.08)':'rgba(15,118,110,.06)',
                        borderDash:[5,4],
                        pointRadius:3,
                        tension:.3,
                        spanGaps:true
                    },
                    {
                        label:'Pencapaian Sebenar',
                        data:[avgs.toy,null,avgs.upsa,null,avgs.uasa,null],
                        borderColor:dark?'#FBBF24':'#C6A15B',
                        backgroundColor:dark?'rgba(251,191,36,.08)':'rgba(198,161,91,.08)',
                        pointRadius:5,
                        tension:.3,
                        spanGaps:true
                    }
                ];
                scales={
                    y:{
                        min:0,
                        max:100,
                        ticks:{
                            callback:v=>v+'%',
                            color:dark?'#CBD5E1':'#64748B'
                        },
                        grid:{color:'rgba(148,163,184,.15)'}
                    },
                    x:{
                        grid:{display:false},
                        ticks:{color:dark?'#CBD5E1':'#64748B'}
                    }
                };
            }

            hcCharts.trend=new Chart(canvas,{
                type:'line',
                data:{labels,datasets},
                options:{
                    responsive:true,
                    maintainAspectRatio:false,
                    interaction:{mode:'index',intersect:false},
                    plugins:{
                        legend:{
                            position:'bottom',
                            labels:{
                                color:dark?'#E2E8F0':'#475569',
                                usePointStyle:true,
                                boxWidth:9,
                                font:{size:9}
                            }
                        },
                        tooltip:metric==='GPMP'?{
                            callbacks:{
                                label:(ctx)=>`${ctx.dataset.label}: ${ctx.raw===null?'—':Number(ctx.raw).toFixed(2)}`
                            }
                        }:{}
                    },
                    scales
                }
            });
        }

        const targets=hcTargetCounts(rows);
        renderHcTargetComponents('hc-trend-target-bar','hc-trend-target-legend',targets);
        renderHeadcountNearMissProjection(rows);
    }

    function hcNearMissInfo(score){
        if(score===null||score===undefined||!Number.isFinite(Number(score)))return {nearMiss:false};
        const grade=hcGrade(score),point=hcGradePoint(grade);if(!point||point<=1)return {nearMiss:false};
        const better=HEADCOUNT_GRADE_SCALE.find(x=>x.point===point-1);if(!better)return {nearMiss:false};
        const gap=Number((better.min-Number(score)).toFixed(1)),margin=Number(phase9SchoolProfile.nearMissMargin||5);
        return {nearMiss:gap>0&&gap<=margin,gap,target:better.min,currentGrade:grade,targetGrade:better.grade};
    }
    function hcProjectedGpmp(rows,rate){
        const valid=rows.map(r=>{
            const res=r.ar2.status==='VALUE'?r.ar2:r.ar1.status==='VALUE'?r.ar1:r.toy.status==='VALUE'?r.toy:null;
            return res?{row:r,value:res.value,point:hcGradePoint(hcGrade(res.value)),near:hcNearMissInfo(res.value)}:null;
        }).filter(Boolean);
        if(!valid.length)return null;
        const near=valid.filter(x=>x.near.nearMiss&&x.point>1).sort((a,b)=>a.near.gap-b.near.gap),convert=Math.round(near.length*rate),ids=new Set(near.slice(0,convert).map(x=>x.row.student.id));
        return Number((valid.reduce((sum,x)=>sum+(ids.has(x.row.student.id)?Math.max(1,x.point-1):x.point),0)/valid.length).toFixed(2));
    }
    function renderHeadcountNearMissProjection(rows){
        const scope=hcSelectedScope();
        const start=Number(scope.academicYear);
        const rates=[0,.35,.70,1];
        const vals=rates.map(r=>hcProjectedGpmp(rows,r));
        const labels=rates.map((_,i)=>phase9AyLabel(String(start+i)));

        const nearCount=rows.filter(r=>{
            const res=r.ar2.status==='VALUE'
                ? r.ar2
                : r.ar1.status==='VALUE'
                    ? r.ar1
                    : r.toy.status==='VALUE'
                        ? r.toy
                        : null;
            return res&&hcNearMissInfo(res.value).nearMiss;
        }).length;

        const badge=document.getElementById('hc-nearmiss-count');
        if(badge)badge.textContent=`${nearCount} near miss`;

        vals.forEach((v,i)=>{
            const val=document.getElementById(`hc-proj-gpmp-${i}`);
            const lab=document.getElementById(`hc-proj-label-${i}`);
            if(val)val.textContent=v??'—';
            if(lab)lab.textContent=labels[i];
        });

        const canvas=document.getElementById('hc-projection-chart');
        if(!canvas||typeof Chart==='undefined')return;

        if(hcCharts.projection){
            hcCharts.projection.destroy();
            hcCharts.projection=null;
        }

        const dark=document.documentElement.classList.contains('theme-dark');
        hcCharts.projection=new Chart(canvas,{
            type:'line',
            data:{
                labels,
                datasets:[{
                    label:'Unjuran GPMP',
                    data:vals,
                    borderColor:dark?'#34D399':'#059669',
                    backgroundColor:dark?'rgba(52,211,153,.12)':'rgba(5,150,105,.10)',
                    pointBackgroundColor:dark?'#6EE7B7':'#047857',
                    pointBorderColor:dark?'#0E242A':'#FFFFFF',
                    pointBorderWidth:2,
                    pointRadius:4,
                    pointHoverRadius:5,
                    tension:.32,
                    fill:true,
                    spanGaps:true
                }]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{
                    legend:{display:false},
                    tooltip:{
                        callbacks:{
                            label:(ctx)=>ctx.raw===null
                                ? 'GPMP: —'
                                : `GPMP: ${Number(ctx.raw).toFixed(2)}`
                        }
                    }
                },
                scales:{
                    x:{
                        grid:{display:false},
                        ticks:{
                            color:dark?'#CBD5E1':'#64748B',
                            font:{size:9}
                        }
                    },
                    y:{
                        min:1,
                        max:6,
                        reverse:true,
                        ticks:{
                            stepSize:1,
                            color:dark?'#CBD5E1':'#64748B',
                            font:{size:8}
                        },
                        title:{
                            display:true,
                            text:'GPMP · lebih rendah lebih baik',
                            color:dark?'#CBD5E1':'#64748B',
                            font:{size:8}
                        },
                        grid:{color:'rgba(148,163,184,.13)'}
                    }
                }
            }
        });
    }

    function openHeadcountStudentDrawer(studentId,show=true){
        const row=hcScopeRows().find(r=>r.student.id===studentId);if(!row)return;hcSelectedStudentId=studentId;
        const overlay=document.getElementById('hc-drawer-overlay');if(show!==false)overlay?.classList.remove('hidden');
        const cls=appState.classes.find(c=>c.id===row.student.classId),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        set('hc-drawer-name',row.student.name);set('hc-drawer-class',`${cls?.name||'—'} · ${phase9AyLabel(hcSelectedScope().academicYear)}`);
        const steps=[['TOV',row.toy.value,row.toy.status],['OT1',row.oti1,row.oti1===null?'MISSING':'VALUE'],['UPSA / AR1',row.ar1.value,row.ar1.status],['OT2',row.oti2,row.oti2===null?'MISSING':'VALUE'],['UASA / AR2',row.ar2.value,row.ar2.status],['ETR',row.etr,row.etr===null?'MISSING':'VALUE']];
        const journey=document.getElementById('hc-drawer-journey');if(journey)journey.innerHTML=steps.map(([label,value,status])=>`<div class="hc-journey-step"><span>${label}</span><strong>${status==='TH'?'TH':value===null?'—':`${hcFmt(value)}%${['TOV','UPSA / AR1','UASA / AR2','ETR'].includes(label)?` · ${hcGrade(value)}`:''}`}</strong></div>`).join('');
        set('hc-drawer-status',row.status);
        const current=row.ar2.status==='VALUE'?row.ar2.value:row.ar1.status==='VALUE'?row.ar1.value:row.toy.status==='VALUE'?row.toy.value:null;
        set('hc-drawer-change',current!==null&&row.toy.status==='VALUE'?`${current-row.toy.value>=0?'+':''}${hcFmt(current-row.toy.value)}%`:'—');set('hc-drawer-etr',row.etr===null?'—':hcPct(row.etr));set('hc-drawer-gap',current!==null&&row.etr!==null?`${Math.max(0,row.etr-current).toFixed(1).replace('.0','')} mata lagi`:'—');
        const key=`${hcSelectedScope().academicYear}|${studentId}`,saved=headcountState.interventions?.[key]||{},sel=document.getElementById('hc-drawer-intervention'),note=document.getElementById('hc-drawer-note');if(sel)sel.value=saved.tag||'';if(note)note.value=saved.note||'';
        renderHeadcountStudentChart(row);lucide.createIcons();
    }
    function closeHeadcountStudentDrawer(event){
        if(event&&event.target?.id!=='hc-drawer-overlay')return;
        document.getElementById('hc-drawer-overlay')?.classList.add('hidden');hcSelectedStudentId=null;
        if(hcCharts.student){hcCharts.student.destroy();hcCharts.student=null;}
    }
    function renderHeadcountStudentChart(row){
        const canvas=document.getElementById('hc-student-chart');if(!canvas||typeof Chart==='undefined')return;if(hcCharts.student)hcCharts.student.destroy();
        hcCharts.student=new Chart(canvas,{type:'line',data:{labels:['TOV','OT1','AR1','OT2','AR2','ETR'],datasets:[
            {label:'Sasaran',data:[row.toy.value,row.oti1,row.oti1,row.oti2,row.oti2,row.etr],borderColor:'#0F766E',borderDash:[4,3],pointRadius:3,tension:.25,spanGaps:true},
            {label:'Pencapaian',data:[row.toy.status==='VALUE'?row.toy.value:null,null,row.ar1.status==='VALUE'?row.ar1.value:null,null,row.ar2.status==='VALUE'?row.ar2.value:null,null],borderColor:'#C6A15B',pointRadius:4,tension:.25,spanGaps:true}
        ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:9}}}},scales:{y:{min:0,max:100,ticks:{font:{size:8},callback:v=>v+'%'},grid:{color:'rgba(148,163,184,.13)'}},x:{ticks:{font:{size:8}},grid:{display:false}}}}});
    }
    function saveHeadcountIntervention(){
        if(!hcSelectedStudentId)return;const row=hcScopeRows().find(r=>r.student.id===hcSelectedStudentId);if(!row||!hcCanEditStudent(row.student)){showAlert('Tiada Kebenaran','Anda tidak dibenarkan mengubah catatan murid ini.','danger');return;}
        const key=`${hcSelectedScope().academicYear}|${hcSelectedStudentId}`,tag=document.getElementById('hc-drawer-intervention')?.value||'',note=document.getElementById('hc-drawer-note')?.value.trim()||'';
        if(!headcountState.interventions)headcountState.interventions={};headcountState.interventions[key]={tag,note,updatedAt:new Date().toISOString(),updatedBy:currentUserId};persistHeadcountState();phase10SyncHeadcountStudent(hcSelectedStudentId);showHeadcountSaveState('✓ Disimpan');
    }

    function hcReportScopeData(){
        const rows=hcScopeRows(),scope=hcSelectedScope(),classes=headcountAllowedClasses(scope.academicYear,scope.year,scope.classId),classLabel=scope.classId==='ALL'?'Semua Kelas':(classes[0]?.name||'—').replace(/^\d+\s+/,'');
        const teacherIds=[...new Set(classes.map(c=>c.teacherId).filter(Boolean))],teachers=teacherIds.map(id=>mockTeachers.find(t=>t.id===id)?.name).filter(Boolean),teacher=teachers.length===1?teachers[0]:teachers.length>1?'Pelbagai Guru Sejarah':'—';
        const currentKey=headcountState.ui.assessment||'UPSA',metrics=hcMetrics(rows,currentKey),trend={toy:hcAverage(rows.filter(r=>r.toy.status==='VALUE').map(r=>r.toy.value)),upsa:hcAverage(rows.filter(r=>r.ar1.status==='VALUE').map(r=>r.ar1.value)),uasa:hcAverage(rows.filter(r=>r.ar2.status==='VALUE').map(r=>r.ar2.value)),etr:hcAverage(rows.map(r=>r.etr))};
        return {rows,scope,classes,classLabel,teacher,currentKey,metrics,trend};
    }
    function buildHeadcountReportHtml(){
        const d=hcReportScopeData(),m=d.metrics,logo=phase9SchoolProfile.logoDataUrl?`<img src="${phase9SchoolProfile.logoDataUrl}" style="width:54px;height:54px;object-fit:contain">`:'<div style="width:48px;height:48px;border:1px solid #ccc;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800">S</div>';
        const rows=d.rows.map((r,i)=>`<tr><td>${i+1}</td><td style="text-align:left">${escapeHtml(r.student.name)}</td><td>${r.toy.status==='TH'?'TH':r.toy.value===null?'—':hcFmt(r.toy.value)}</td><td>${r.oti1===null?'—':hcFmt(r.oti1)}</td><td>${r.ar1.status==='TH'?'TH':r.ar1.value===null?'—':hcFmt(r.ar1.value)}</td><td>${r.oti2===null?'—':hcFmt(r.oti2)}</td><td>${r.ar2.status==='TH'?'TH':r.ar2.value===null?'—':hcFmt(r.ar2.value)}</td><td>${r.etr===null?'—':hcFmt(r.etr)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('');
        const grades=['A','B','C','D','E','F'].map(g=>`${g}: ${m.grades[g]||0}`).join(' · ');
        return `<div style="font-family:Arial,sans-serif;color:#172033;background:white;padding:24px;width:1120px">
            <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #065F46;padding-bottom:12px">${logo}<div><h1 style="font-size:19px;margin:0">${escapeHtml(phase9SchoolProfile.schoolName||'MATTARY')}</h1><p style="font-size:11px;margin:3px 0 0">Headcount & Analisis Prestasi Sejarah</p></div></div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;font-size:10px"><div><b>Tahun</b><br>${d.scope.year}</div><div><b>Kelas</b><br>${escapeHtml(d.classLabel)}</div><div><b>Guru Sejarah</b><br>${escapeHtml(d.teacher)}</div><div><b>Sesi</b><br>${phase9AyLabel(d.scope.academicYear)}</div></div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:12px">${[['Jumlah Murid',m.total],['Purata',hcPct(m.average)],['MTM',m.mtmPct===null?'—':m.mtmPct.toFixed(2)+'%'],['BMTM',m.bmtmPct===null?'—':m.bmtmPct.toFixed(2)+'%'],['GPMP',m.gpmp??'—']].map(x=>`<div style="border:1px solid #ddd;border-radius:7px;padding:8px"><span style="font-size:8px;color:#777">${x[0]}</span><strong style="display:block;font-size:16px;margin-top:2px">${x[1]}</strong></div>`).join('')}</div>
            <table style="width:100%;border-collapse:collapse;font-size:8.5px"><thead><tr style="background:#F0FDF4"><th>Bil</th><th style="text-align:left">Nama Murid</th><th>TOV</th><th>OT1</th><th>UPSA/AR1</th><th>OT2</th><th>UASA/AR2</th><th>ETR</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
            <div style="margin-top:12px;font-size:9px"><b>Distribusi Gred (${d.currentKey}):</b> ${grades}<br><b>Trend Purata:</b> TOV ${hcPct(d.trend.toy)} · UPSA ${hcPct(d.trend.upsa)} · UASA ${hcPct(d.trend.uasa)} · ETR ${hcPct(d.trend.etr)}</div>
            <div style="margin-top:14px;padding-top:8px;border-top:1px solid #ddd;font-size:8px;color:#777">Dijana pada ${new Date().toLocaleString('ms-MY')} · ${escapeHtml(phase9SchoolProfile.reportFooter||'')}</div>
            
        </div>`;
    }
    function printHeadcountReport(){
        if(isTeacherSession()){showAlert('Akses Admin','Cetak Laporan Headcount hanya tersedia dalam panel Admin.','info');return;}
        const win=window.open('','_blank','width=1300,height=900');if(!win){showAlert('Pop-up Disekat','Benarkan pop-up untuk mencetak laporan.','info');return;}
        win.document.write(`<html><head><title>Headcount Sejarah</title></head><body>${buildHeadcountReportHtml()}</body></html>`);win.document.close();win.focus();setTimeout(()=>win.print(),300);
    }
    async function exportHeadcountPdf(){
        if(typeof html2canvas==='undefined'||!window.jspdf){showAlert('PDF Tidak Tersedia','Pustaka PDF belum dimuatkan. Gunakan Cetak Laporan sementara waktu.','info');return;}
        const host=document.createElement('div');host.style.cssText='position:fixed;left:-99999px;top:0;background:white;z-index:-1';host.innerHTML=buildHeadcountReportHtml();document.body.appendChild(host);
        try{
            const canvas=await html2canvas(host.firstElementChild,{scale:1.25,backgroundColor:'#ffffff'});
            const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),pw=pdf.internal.pageSize.getWidth()-12,ph=pdf.internal.pageSize.getHeight()-12,ratio=Math.min(pw/canvas.width,ph/canvas.height);
            pdf.addImage(canvas.toDataURL('image/png'),'PNG',6,6,canvas.width*ratio,canvas.height*ratio);
            const d=hcReportScopeData();pdf.save(`Headcount_Sejarah_Tahun${d.scope.year}_${d.scope.academicYear}.pdf`);
        }catch(e){console.error(e);showAlert('Eksport PDF Gagal','Tidak dapat menjana PDF. Cuba Cetak Laporan.','danger');}finally{host.remove();}
    }
    function exportHeadcountExcel(){
        if(typeof XLSX==='undefined'){showAlert('Excel Tidak Tersedia','Pustaka Excel belum dimuatkan.','info');return;}
        const d=hcReportScopeData(),wb=XLSX.utils.book_new();
        const hcRows=[['Bil','Student ID','Nama Murid','Tahun','Kelas','TOV','Gred TOV','OT1','UPSA / AR1','Gred UPSA','Beza AR1','OT2','UASA / AR2','Gred UASA','Beza AR2','ETR','Gred ETR','Status']];
        d.rows.forEach((r,i)=>{const cls=appState.classes.find(c=>c.id===r.student.classId);hcRows.push([i+1,r.student.id,r.student.name,r.student.year,cls?.name||'',r.toy.status==='TH'?'TH':r.toy.value??'',r.toy.status==='VALUE'?hcGrade(r.toy.value):r.toy.status==='TH'?'TH':'',r.oti1??'',r.ar1.status==='TH'?'TH':r.ar1.value??'',r.ar1.status==='VALUE'?hcGrade(r.ar1.value):r.ar1.status==='TH'?'TH':'',r.ar1.status==='VALUE'&&r.oti1!==null?r.ar1.value-r.oti1:'',r.oti2??'',r.ar2.status==='TH'?'TH':r.ar2.value??'',r.ar2.status==='VALUE'?hcGrade(r.ar2.value):r.ar2.status==='TH'?'TH':'',r.ar2.status==='VALUE'&&r.oti2!==null?r.ar2.value-r.oti2:'',r.etr??'',r.etr!==null?hcGrade(r.etr):'',r.status]);});
        XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(hcRows),'HEADCOUNT SEJARAH');

        const gradeRows=[['Pentaksiran','A','B','C','D','E','F','Jumlah Ambil','TH','MTM %','BMTM %','GPMP']];
        ['TOY','UPSA','UASA','ETR'].forEach(k=>{const m=hcMetrics(d.rows,k);gradeRows.push([k==='TOY'?'TOV':k,m.grades.A,m.grades.B,m.grades.C,m.grades.D,m.grades.E,m.grades.F,m.taken,m.absent,m.mtmPct===null?'':Number(m.mtmPct.toFixed(2)),m.bmtmPct===null?'':Number(m.bmtmPct.toFixed(2)),m.gpmp??'']);});
        XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(gradeRows),'ANALISIS GRED');

        const target=hcTargetCounts(d.rows),summaryRows=[
            ['RINGKASAN PRESTASI','Nilai'],['Sesi Akademik',phase9AyLabel(d.scope.academicYear)],['Tahun',d.scope.year],['Kelas',d.classLabel],['Guru Sejarah',d.teacher],['Jumlah Murid',d.rows.length],
            ['Purata TOV',d.trend.toy??''],['Purata UPSA',d.trend.upsa??''],['Purata UASA',d.trend.uasa??''],['Purata ETR',d.trend.etr??''],
            ['Melebihi Sasaran',target['Melebihi Sasaran']||0],['Capai Sasaran',target['Capai Sasaran']||0],['Hampir Sasaran',target['Hampir Sasaran']||0],['Belum Capai Sasaran',target['Belum Capai Sasaran']||0]
        ];
        XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryRows),'RINGKASAN PRESTASI');
        XLSX.writeFile(wb,`Headcount_Sejarah_Tahun${d.scope.year}_${d.scope.academicYear}.xlsx`);
    }
    function exportHeadcountCsv(){exportHeadcountExcel();} // legacy alias preserved


    // --- PHASE 6: PBD ANALYTICS BY STANDARD KANDUNGAN + THEME HEATMAP ---
    function pbdAnalyticsAllowedClasses(academicYear,yearLevel='ALL',classId='ALL') {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes=canonicalActiveClasses(academicYear);
        if(isTeacherSession())classes=classes.filter(c=>c.teacherId===currentUserId);
        if(yearLevel!=='ALL')classes=classes.filter(c=>String(c.year)===String(yearLevel));
        if(classId!=='ALL')classes=classes.filter(c=>c.id===classId);
        return classes;
    }

    function pbdAnalyticsGetScope() {
        const academicYear=document.getElementById('pbd-an-session')?.value||'2026',yearLevel=document.getElementById('pbd-an-year')?.value||'ALL',classId=document.getElementById('pbd-an-class')?.value||'ALL',period=document.getElementById('pbd-an-period')?.value||'PERTENGAHAN',theme=document.getElementById('pbd-an-theme')?.value||'ALL',skId=document.getElementById('pbd-an-sk')?.value||'ALL';
        const classes=pbdAnalyticsAllowedClasses(academicYear,yearLevel,classId),classIds=new Set(classes.map(c=>c.id)),years=new Set(classes.map(c=>Number(c.year)));
        const students=sortStudentsAZ(appState.students.filter(s=>s.status==='Aktif'&&String(s.academicYear)===String(academicYear)&&classIds.has(s.classId))),studentIds=new Set(students.map(s=>s.id));
        let dskp=appState.dskp.filter(d=>d.active!==false&&d.subject==='SEJARAH'&&d.matrixTemplate&&years.has(Number(d.yearLevel)));
        if(yearLevel!=='ALL')dskp=dskp.filter(d=>String(d.yearLevel)===String(yearLevel));
        if(theme!=='ALL')dskp=dskp.filter(d=>d.themeName===theme);
        if(skId!=='ALL')dskp=dskp.filter(d=>d.id===skId);
        dskp.sort((a,b)=>Number(a.yearLevel)-Number(b.yearLevel)||Number(a.matrixStandardIndex||0)-Number(b.matrixStandardIndex||0));
        const dskpIds=new Set(dskp.map(d=>d.id));
        const records=getEffectivePbdRecordsForScope(studentIds,dskpIds,academicYear,period);
        return {academicYear,yearLevel,classId,period,theme,skId,classes,classIds,students,studentIds,dskp,dskpIds,records};
    }

    function pbdAnalyticsPopulatePeriodOptions() {
        const select=document.getElementById('pbd-an-period');if(!select)return;const prev=select.value||'PERTENGAHAN',periods=(appState.pbdPeriods||[]).filter(p=>p.active!==false);
        select.innerHTML=periods.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');if([...select.options].some(o=>o.value===prev))select.value=prev;
    }
    function pbdAnalyticsPopulateClassOptions() {
        const select=document.getElementById('pbd-an-class');if(!select)return;const session=document.getElementById('pbd-an-session').value,year=document.getElementById('pbd-an-year').value,prev=select.value,classes=pbdAnalyticsAllowedClasses(session,year,'ALL');
        select.innerHTML='<option value="ALL">Semua Kelas</option>'+classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');select.value=classes.some(c=>c.id===prev)?prev:'ALL';
    }
    function pbdAnalyticsPopulateThemeSkOptions(resetTheme=false) {
        const session=document.getElementById('pbd-an-session')?.value||'2026',year=document.getElementById('pbd-an-year')?.value||'ALL',classId=document.getElementById('pbd-an-class')?.value||'ALL',classes=pbdAnalyticsAllowedClasses(session,year,classId),years=new Set(classes.map(c=>Number(c.year)));
        let dskp=appState.dskp.filter(d=>d.active!==false&&d.subject==='SEJARAH'&&d.matrixTemplate&&years.has(Number(d.yearLevel)));if(year!=='ALL')dskp=dskp.filter(d=>String(d.yearLevel)===String(year));
        const themeSelect=document.getElementById('pbd-an-theme'),skSelect=document.getElementById('pbd-an-sk');if(!themeSelect||!skSelect)return;
        const prevTheme=resetTheme?'ALL':themeSelect.value,themes=[...new Set(dskp.map(d=>d.themeName).filter(Boolean))];
        themeSelect.innerHTML='<option value="ALL">Semua Tema</option>'+themes.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');themeSelect.value=themes.includes(prevTheme)?prevTheme:'ALL';
        if(themeSelect.value!=='ALL')dskp=dskp.filter(d=>d.themeName===themeSelect.value);
        const prevSk=skSelect.value;
        skSelect.innerHTML='<option value="ALL">Semua Standard Kandungan</option>'+dskp.map(d=>`<option value="${d.id}">${escapeHtml(d.standardContentCode)} · ${escapeHtml(d.standardContentText)}</option>`).join('');
        skSelect.value=dskp.some(d=>d.id===prevSk)?prevSk:'ALL';
    }
    function pbdAnalyticsScopeChanged(source) {
        if(source==='session'||source==='year')pbdAnalyticsPopulateClassOptions();
        if(source==='session'||source==='year'||source==='class')pbdAnalyticsPopulateThemeSkOptions(source!=='class');
        if(source==='theme')pbdAnalyticsPopulateThemeSkOptions(false);
        renderPbdAnalytics();
    }

    function pbdAnalyticsStudentThemes(student,scope,byStudentDskp) {
        const template=getPbdMatrixTemplate(student.year);
        return template.groups.map(group=>{
            let dskps=appState.dskp.filter(d=>d.matrixTemplate&&Number(d.yearLevel)===Number(student.year)&&d.matrixGroupKey===group.key);
            // Theme heatmap remains by theme even when SK filter is applied; theme filter narrows themes.
            if(scope.theme!=='ALL'&&group.name!==scope.theme)return null;
            const values=dskps.map(d=>Number(byStudentDskp.get(`${student.id}|${d.id}`)?.tp||0));
            const recorded=values.filter(v=>v>=1&&v<=6),complete=dskps.length>0&&recorded.length===dskps.length;
            const rawAvg=complete?recorded.reduce((a,b)=>a+b,0)/recorded.length:null;
            const avg=rawAvg===null?null:Math.max(1,Math.min(6,Math.round(rawAvg)));
            return {key:group.key,name:group.name,color:group.color,total:dskps.length,recorded:recorded.length,complete,rawAvg,avg};
        }).filter(Boolean);
    }

    function pbdAnalyticsBuildMetrics(scope) {
        const masteryTp=Number(appSettings.pbdMasteryTp||3),byStudentDskp=new Map();scope.records.forEach(r=>byStudentDskp.set(`${r.studentId}|${r.dskpId}`,r));
        let expected=0;scope.students.forEach(st=>expected+=scope.dskp.filter(d=>Number(d.yearLevel)===Number(st.year)).length);
        const recorded=scope.records.length,completion=expected?recorded/expected*100:0,counts=[0,0,0,0,0,0];scope.records.forEach(r=>{const tp=Number(r.tp);if(tp>=1&&tp<=6)counts[tp-1]++;});
        const mastered=scope.records.filter(r=>Number(r.tp)>=masteryTp).length,masteryRate=recorded?mastered/recorded*100:0,avgAll=recorded?scope.records.reduce((sum,r)=>sum+Number(r.tp),0)/recorded:null;

        const skMetrics=scope.dskp.map(d=>{
            const eligible=scope.students.filter(st=>Number(st.year)===Number(d.yearLevel)),recs=eligible.map(st=>byStudentDskp.get(`${st.id}|${d.id}`)).filter(r=>r?.tp),avg=recs.length?recs.reduce((s,r)=>s+Number(r.tp),0)/recs.length:null,masteredCount=recs.filter(r=>Number(r.tp)>=masteryTp).length,mastery=recs.length?masteredCount/recs.length*100:0,comp=eligible.length?recs.length/eligible.length*100:0;
            return {dskp:d,eligible:eligible.length,records:recs.length,avg,masteredCount,mastery,completion:comp};
        });
        const withData=skMetrics.filter(x=>x.records>0),strongest=withData.length?[...withData].sort((a,b)=>b.mastery-a.mastery||(b.avg||0)-(a.avg||0))[0]:null,weakest=withData.length?[...withData].sort((a,b)=>a.mastery-b.mastery||(a.avg||0)-(b.avg||0))[0]:null,supportCount=skMetrics.filter(x=>x.records>0&&x.mastery<60).length;

        const studentThemeMap=new Map(),studentFinalMap=new Map();
        scope.students.forEach(st=>{
            const themes=pbdAnalyticsStudentThemes(st,scope,byStudentDskp);themes.forEach(t=>studentThemeMap.set(`${st.id}|${t.name}`,t));
            const complete=themes.length>0&&themes.every(t=>t.complete),rawAvg=complete?themes.reduce((s,t)=>s+t.avg,0)/themes.length:null,avg=rawAvg===null?null:Math.max(1,Math.min(6,Math.round(rawAvg)));
            studentFinalMap.set(st.id,{complete,avg,themes});
        });

        const themeNames=[...new Set(scope.students.flatMap(st=>pbdAnalyticsStudentThemes(st,scope,byStudentDskp).map(t=>t.name)))];
        const themeMetrics=themeNames.map(name=>{
            const rows=scope.students.map(st=>studentThemeMap.get(`${st.id}|${name}`)).filter(Boolean),completeRows=rows.filter(t=>t.complete),avg=completeRows.length?completeRows.reduce((s,t)=>s+t.avg,0)/completeRows.length:null,masteredRows=completeRows.filter(t=>t.avg>=masteryTp).length;
            return {name,eligible:rows.length,complete:completeRows.length,completion:rows.length?completeRows.length/rows.length*100:0,avg,mastery:completeRows.length?masteredRows/completeRows.length*100:0};
        });

        return {masteryTp,byStudentDskp,expected,recorded,completion,counts,mastered,masteryRate,avgAll,skMetrics,strongest,weakest,supportCount,studentThemeMap,studentFinalMap,themeNames,themeMetrics};
    }

    function initializePbdAnalytics() {
        const globalSession=document.getElementById('filter-academic-year')?.value||'2026',globalYear=document.getElementById('filter-tahun')?.value||'ALL',globalClass=document.getElementById('filter-kelas')?.value||'ALL',sessionEl=document.getElementById('pbd-an-session'),yearEl=document.getElementById('pbd-an-year');
        if(sessionEl&&[...sessionEl.options].some(o=>o.value===globalSession))sessionEl.value=globalSession;if(yearEl)yearEl.value=globalYear;
        pbdAnalyticsPopulatePeriodOptions();pbdAnalyticsPopulateClassOptions();const classEl=document.getElementById('pbd-an-class');if(classEl&&globalClass!=='ALL'&&[...classEl.options].some(o=>o.value===globalClass))classEl.value=globalClass;
        pbdAnalyticsPopulateThemeSkOptions(true);document.getElementById('pbd-an-mastery-threshold-label').textContent=appSettings.pbdMasteryTp||3;renderPbdAnalytics();
    }

    function renderPbdAnalytics() {
        const scope=pbdAnalyticsGetScope(),m=pbdAnalyticsBuildMetrics(scope);pbdAnalyticsCurrent={scope,metrics:m};
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        set('pbd-an-kpi-students',scope.students.length);set('pbd-an-kpi-classes',`${scope.classes.length} kelas`);set('pbd-an-kpi-records',m.recorded);set('pbd-an-kpi-expected',`${m.expected} dijangka`);set('pbd-an-kpi-completion',formatPercent1(m.completion));
        document.getElementById('pbd-an-completion-bar').style.width=`${Math.min(100,m.completion)}%`;set('pbd-an-kpi-dominant',m.avgAll===null?'—':`TP${Math.max(1,Math.min(6,Math.round(m.avgAll)))}`);set('pbd-an-kpi-dominant-count',m.avgAll===null?'Tiada rekod':`${m.recorded} rekod SK`);set('pbd-an-kpi-mastery',formatPercent1(m.masteryRate));set('pbd-an-kpi-mastery-count',`${m.mastered} / ${m.recorded} rekod`);set('pbd-an-kpi-support-sp',m.supportCount);
        renderPbdAnalyticsInsights(m);renderPbdAnalyticsCharts(m);renderPbdAnalyticsHeatmap();renderPbdAnalyticsSkTable(m);lucide.createIcons();
    }

    function renderPbdAnalyticsInsights(m) {
        const setInsight=(prefix,item,good)=>{
            document.getElementById(`${prefix}-code`).textContent=item?`${item.dskp.standardContentCode} · ${item.dskp.standardContentText}`:'Belum ada data';
            document.getElementById(`${prefix}-text`).textContent=item?`Tema: ${item.dskp.themeName}`:(good?'Lengkapkan rekod PBD untuk menghasilkan insight.':'Analisis akan mengenal pasti Standard Kandungan yang memerlukan pengukuhan.');
            document.getElementById(`${prefix}-rate`).textContent=item?`Penguasaan ${formatPercent1(item.mastery)} · Purata TP ${item.avg===null?'—':'TP'+Math.max(1,Math.min(6,Math.round(item.avg)))} · ${item.records}/${item.eligible} murid`:'';
        };
        setInsight('pbd-an-strong',m.strongest,true);setInsight('pbd-an-support',m.weakest,false);
    }

    function renderPbdAnalyticsCharts(m) {
        const tpCanvas=document.getElementById('pbd-analytics-tp-chart'),skCanvas=document.getElementById('pbd-analytics-sp-chart');if(!tpCanvas||!skCanvas||typeof Chart==='undefined')return;
        if(pbdAnalyticsTpChartInstance)pbdAnalyticsTpChartInstance.destroy();if(pbdAnalyticsSpChartInstance)pbdAnalyticsSpChartInstance.destroy();
        pbdAnalyticsTpChartInstance=new Chart(tpCanvas,{type:'doughnut',data:{labels:['TP1','TP2','TP3','TP4','TP5','TP6'],datasets:[{data:m.counts,backgroundColor:['#fb7185','#fb923c','#facc15','#60a5fa','#34d399','#a78bfa'],borderColor:'#fff',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,font:{size:11}}}}}});
        const rows=m.skMetrics.filter(x=>x.records>0).slice(0,20);
        pbdAnalyticsSpChartInstance=new Chart(skCanvas,{type:'bar',data:{labels:rows.map(x=>`${x.dskp.standardContentCode}`),datasets:[{label:'Penguasaan %',data:rows.map(x=>Number(x.mastery.toFixed(1))),backgroundColor:rows.map(x=>x.mastery<60?'rgba(225,29,72,.72)':x.mastery<80?'rgba(217,119,6,.72)':'rgba(5,150,105,.72)'),borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{title:(ctx)=>rows[ctx[0].dataIndex].dskp.standardContentText,afterLabel:(ctx)=>{const x=rows[ctx.dataIndex];return `Tema: ${x.dskp.themeName}\nPurata TP: ${x.avg?.toFixed(2)||'—'}\nRekod: ${x.records}/${x.eligible}`;}}}},scales:{x:{beginAtZero:true,max:100},y:{grid:{display:false}}}}});
    }

    function themeHeatClass(avg) {
        if(avg===null||avg===undefined)return 'bg-slate-50 text-slate-400 border-slate-200';
        if(avg<2)return 'bg-rose-100 text-rose-800 border-rose-200';
        if(avg<3)return 'bg-orange-100 text-orange-800 border-orange-200';
        if(avg<4)return 'bg-blue-100 text-blue-800 border-blue-200';
        if(avg<5)return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        return 'bg-violet-100 text-violet-800 border-violet-200';
    }
    function pbdAnalyticsStudentMatchesFocus(st,m,focus) {
        const final=m.studentFinalMap.get(st.id),themes=final?.themes||[];
        if(focus==='ALL')return true;if(focus==='INCOMPLETE')return themes.some(t=>!t.complete);if(focus==='THEME_BELOW3')return themes.some(t=>t.complete&&t.avg<3);if(focus==='FINAL_BELOW3')return final?.complete&&final.avg<3;if(focus==='COMPLETE')return final?.complete;if(focus==='FINAL_4PLUS')return final?.complete&&final.avg>=4;return true;
    }

    function renderPbdAnalyticsHeatmap() {
        if(!pbdAnalyticsCurrent)return;const {scope,metrics:m}=pbdAnalyticsCurrent,search=(document.getElementById('pbd-an-search')?.value||'').trim().toLowerCase(),focus=document.getElementById('pbd-an-heatmap-focus')?.value||'ALL';
        let students=scope.students.filter(st=>!search||st.name.toLowerCase().includes(search)).filter(st=>pbdAnalyticsStudentMatchesFocus(st,m,focus));
        const head=document.getElementById('pbd-an-heatmap-head'),body=document.getElementById('pbd-an-heatmap-body'),empty=document.getElementById('pbd-an-heatmap-empty'),wrap=document.getElementById('pbd-an-heatmap-wrap');if(!head||!body)return;
        head.innerHTML=`<tr><th class="sticky left-0 z-30 min-w-[230px] px-4 py-3 bg-slate-50 border-b border-r border-slate-200 text-left font-black text-slate-600">Murid</th>${m.themeNames.map(name=>`<th class="min-w-[150px] max-w-[190px] px-3 py-3 bg-slate-50 border-b border-r border-slate-200 text-center font-black text-slate-600">${escapeHtml(name)}</th>`).join('')}<th class="min-w-[100px] px-3 py-3 bg-violet-50 border-b border-r border-violet-200 text-center font-black text-violet-700">Tahap Akhir</th></tr>`;
        body.innerHTML=students.map(st=>{
            const cls=appState.classes.find(c=>c.id===st.classId),final=m.studentFinalMap.get(st.id),themeCells=m.themeNames.map(name=>{const t=m.studentThemeMap.get(`${st.id}|${name}`);if(!t)return'<td class="px-2 py-2 border-b border-r border-slate-100 text-center text-slate-300">—</td>';return `<td class="px-2 py-2 border-b border-r border-slate-100 text-center">${t.complete?`<button onclick="openThemeHeatDetail('${st.id}','${encodeURIComponent(name)}')" class="theme-heat-cell ${themeHeatClass(t.avg)}"><span>TP${t.avg}</span><small>${t.recorded}/${t.total} SK</small></button>`:`<span class="theme-heat-cell bg-slate-50 text-slate-400 border-slate-200"><span>—</span><small>${t.recorded}/${t.total} SK</small></span>`}</td>`;}).join('');
            const finalCell=final?.complete?`<span class="theme-heat-cell ${themeHeatClass(final.avg)} !min-w-[68px]"><span>TP${final.avg}</span><small>AKHIR</small></span>`:`<span class="theme-heat-cell bg-slate-50 text-slate-400 border-slate-200 !min-w-[68px]"><span>—</span><small>belum lengkap</small></span>`;
            return `<tr class="hover:bg-slate-50/60"><td class="sticky left-0 z-10 px-4 py-3 bg-white border-b border-r border-slate-200"><span class="block font-bold text-slate-800">${escapeHtml(st.name)}</span><span class="block text-[10px] text-slate-400 mt-1">${escapeHtml(cls?.name||'')}</span></td>${themeCells}<td class="px-2 py-2 bg-violet-50/40 border-b border-r border-violet-100 text-center">${finalCell}</td></tr>`;
        }).join('');
        const showEmpty=!m.themeNames.length||!students.length;empty.classList.toggle('hidden',!showEmpty);wrap.classList.toggle('hidden',showEmpty);
        document.getElementById('pbd-an-heatmap-subtitle').textContent=`${students.length} murid × ${m.themeNames.length} Tema · Purata Tema daripada semua Standard Kandungan`;
    }

    function openThemeHeatDetail(studentId,encodedTheme) {
        if(!pbdAnalyticsCurrent)return;const theme=decodeURIComponent(encodedTheme),{scope,metrics:m}=pbdAnalyticsCurrent,st=scope.students.find(s=>s.id===studentId),t=m.studentThemeMap.get(`${studentId}|${theme}`);if(!st||!t)return;
        const dskps=appState.dskp.filter(d=>d.matrixTemplate&&Number(d.yearLevel)===Number(st.year)&&d.themeName===theme),lines=dskps.map(d=>{const r=m.byStudentDskp.get(`${studentId}|${d.id}`);return `${d.standardContentCode} · ${d.standardContentText}: ${r?.tp?`TP${r.tp}`:'—'}`;});
        showAlert(`${st.name} · ${theme}`,`${lines.join('\n')}\n\nPurata Tema: ${t.complete?'TP'+t.avg:'Belum lengkap'}`,'info');
    }

    function renderPbdAnalyticsSkTable(m) {
        const body=document.getElementById('pbd-an-sp-body'),empty=document.getElementById('pbd-an-sp-empty');if(!body||!empty)return;
        body.innerHTML=m.skMetrics.map(x=>{let status={label:'Belum Ada Data',cls:'bg-slate-100 text-slate-600'};if(x.records>0&&x.mastery<60)status={label:'Perlu Pengukuhan',cls:'bg-rose-100 text-rose-700'};else if(x.records>0&&x.mastery<80)status={label:'Pantau',cls:'bg-amber-100 text-amber-700'};else if(x.records>0)status={label:'Dikuasai',cls:'bg-emerald-100 text-emerald-700'};
            return `<tr class="hover:bg-slate-50/70"><td class="px-4 py-3"><button onclick="filterPbdAnalyticsToSk('${x.dskp.id}')" class="font-black text-violet-700 hover:underline">${escapeHtml(x.dskp.standardContentCode)}</button></td><td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(x.dskp.standardContentText)}</td><td class="px-4 py-3 text-slate-500">${escapeHtml(x.dskp.themeName)}</td><td class="px-4 py-3"><span class="font-bold">${x.records}</span><span class="text-slate-400">/${x.eligible}</span><div class="w-20 h-1 bg-slate-100 rounded-full mt-1"><div class="h-full bg-blue-500 rounded-full" style="width:${Math.min(100,x.completion)}%"></div></div></td><td class="px-4 py-3 font-black">${x.avg===null?'—':'TP'+Math.max(1,Math.min(6,Math.round(x.avg)))}</td><td class="px-4 py-3 font-bold ${x.mastery<60?'text-rose-600':x.mastery<80?'text-amber-600':'text-emerald-600'}">${x.records?formatPercent1(x.mastery):'—'}</td><td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${status.cls}">${status.label}</span></td></tr>`;
        }).join('');
        empty.classList.toggle('hidden',m.skMetrics.length>0);
    }

    function filterPbdAnalyticsToSk(dskpId) {
        const d=appState.dskp.find(x=>x.id===dskpId);if(!d)return;const theme=document.getElementById('pbd-an-theme'),sk=document.getElementById('pbd-an-sk');
        if([...theme.options].some(o=>o.value===d.themeName))theme.value=d.themeName;pbdAnalyticsPopulateThemeSkOptions(false);if([...sk.options].some(o=>o.value===d.id))sk.value=d.id;renderPbdAnalytics();
    }

    function exportPbdAnalyticsCsv() {
        const current=pbdAnalyticsCurrent||{scope:pbdAnalyticsGetScope()},scope=current.scope,m=current.metrics||pbdAnalyticsBuildMetrics(scope);if(!scope.students.length){showAlert('Tiada Data','Tiada data PBD dalam skop semasa untuk dieksport.','info');return;}
        const themeNames=m.themeNames,headers=['Nama Murid','Kelas','Tahun',...themeNames.map(t=>`Purata Tema: ${t}`),'Tahap Akhir'];
        const rows=scope.students.map(st=>{const cls=appState.classes.find(c=>c.id===st.classId),final=m.studentFinalMap.get(st.id);return [st.name,cls?.name||'',`Tahun ${st.year}`,...themeNames.map(name=>{const t=m.studentThemeMap.get(`${st.id}|${name}`);return t?.complete?t.avg:'';}),final?.complete?final.avg:''];});
        rows.push([]);rows.push(['ANALISIS STANDARD KANDUNGAN']);rows.push(['SK','Standard Kandungan','Tema','Rekod','Layak','Purata TP','Penguasaan %','Kelengkapan %']);
        m.skMetrics.forEach(x=>rows.push([x.dskp.standardContentCode,x.dskp.standardContentText,x.dskp.themeName,x.records,x.eligible,x.avg===null?'':x.avg.toFixed(2),x.records?x.mastery.toFixed(1):'',x.completion.toFixed(1)]));
        const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`,csv='\uFEFF'+[headers,...rows].map(r=>r.map(esc).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Analisis_PBD_SK_Tema_${scope.academicYear}_${scope.period}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }

    // --- PHASE 7: PROFIL PRESTASI INDIVIDU MURID ---
    function getStudentProfilePermittedClasses(academicYear) {
        let classes = appState.classes.filter(c => c.active && String(c.academicYear || academicYear) === String(academicYear));
        if (currentUserRole === 'GURU_SEJARAH') classes = classes.filter(c => c.teacherId === currentUserId);
        return classes;
    }

    function initializeStudentProfile(preselectStudentId = null) {
        const ay = document.getElementById('profile-academic-year');
        const globalAy = document.getElementById('filter-academic-year')?.value || '2026';
        if (ay) ay.value = [...ay.options].some(o => o.value === globalAy) ? globalAy : ay.value;
        const yearEl = document.getElementById('profile-year');
        const globalYear = document.getElementById('filter-tahun')?.value || 'ALL';
        if (yearEl) yearEl.value = ['4','5','6'].includes(globalYear) ? globalYear : 'ALL';
        populateStudentProfilePeriods();
        populateStudentProfileClasses();
        populateStudentProfileStudents(preselectStudentId);
        renderStudentProfile();
    }

    function populateStudentProfilePeriods() {
        const el=document.getElementById('profile-pbd-period');if(!el)return;
        const current=['PERTENGAHAN','AKHIR'].includes(el.value)?el.value:'PERTENGAHAN';
        const periods=[
            {id:'PERTENGAHAN',name:'Pertengahan Tahun'},
            {id:'AKHIR',name:'Akhir Tahun'}
        ];
        el.innerHTML=periods.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
        el.value=periods.some(p=>p.id===current)?current:'PERTENGAHAN';
    }

    function populateStudentProfileClasses() {
        const classEl = document.getElementById('profile-class'); if (!classEl) return;
        const academicYear = document.getElementById('profile-academic-year')?.value || '2026';
        const year = document.getElementById('profile-year')?.value || 'ALL';
        const current = classEl.value || 'ALL';
        let classes = getStudentProfilePermittedClasses(academicYear);
        if (year !== 'ALL') classes = classes.filter(c => String(c.year) === String(year));
        classEl.innerHTML = '<option value="ALL">Semua Kelas</option>' + classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        classEl.value = [...classEl.options].some(o => o.value === current) ? current : 'ALL';
    }

    function getStudentProfileScopedStudents() {
        const academicYear = document.getElementById('profile-academic-year')?.value || '2026';
        const year = document.getElementById('profile-year')?.value || 'ALL';
        const classId = document.getElementById('profile-class')?.value || 'ALL';
        const allowedClasses = getStudentProfilePermittedClasses(academicYear);
        const allowedIds = new Set(allowedClasses.map(c => c.id));
        return sortStudentsAZ(appState.students.filter(s => s.status === 'Aktif' && allowedIds.has(s.classId) && String(s.academicYear || academicYear) === String(academicYear) && (year === 'ALL' || String(s.year) === year) && (classId === 'ALL' || s.classId === classId)));
    }

    function populateStudentProfileStudents(preselectStudentId = null) {
        const el = document.getElementById('profile-student'); if (!el) return;
        const current = preselectStudentId || el.value;
        const students = getStudentProfileScopedStudents();
        el.innerHTML = '<option value="">Pilih Murid</option>' + students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
        if (current && [...el.options].some(o => o.value === current)) el.value = current;
        else if (students.length === 1) el.value = students[0].id;
        const note = document.getElementById('profile-scope-note');
        if (note) note.textContent = `${students.length} murid tersedia dalam skop akses semasa.`;
    }

    function onStudentProfileScopeChange(source) {
        if (source === 'year' || source === 'level') populateStudentProfileClasses();
        populateStudentProfileStudents();
        renderStudentProfile();
    }

    function stepStudentProfile(direction) {
        const el = document.getElementById('profile-student'); if (!el || el.options.length <= 1) return;
        const valid = [...el.options].filter(o => o.value);
        if (!valid.length) return;
        let idx = valid.findIndex(o => o.value === el.value); if (idx < 0) idx = 0; else idx = (idx + direction + valid.length) % valid.length;
        el.value = valid[idx].value; renderStudentProfile();
    }

    function getStudentProfileData(studentId) {
        const student = appState.students.find(s => s.id === studentId); if (!student) return null;
        const cls = appState.classes.find(c => c.id === student.classId);
        const academicYear = document.getElementById('profile-academic-year')?.value || student.academicYear || '2026';
        const period = document.getElementById('profile-pbd-period')?.value || 'PERTENGAHAN';
        const assessments = appState.assessments.filter(a => a.classId === student.classId && String(a.academicYear) === String(academicYear));
        const markRows = assessments.map(a => ({assessment:a, score:getActualScoreRecords().find(sc => sc.studentId === student.id && sc.assessmentId === a.id)})).filter(x => x.score).sort((a,b)=>compareAssessmentsByExamDate(a.assessment,b.assessment));
        const scored = markRows.filter(x => !x.score.absent && x.score.percentage != null);
        const avgMark = scored.length ? scored.reduce((sum,x)=>sum+Number(x.score.percentage),0)/scored.length : null;
        const latest = scored.length ? scored[scored.length-1] : null;
        const previous = scored.length > 1 ? scored[scored.length-2] : null;
        const trend = latest && previous ? Number(latest.score.percentage)-Number(previous.score.percentage) : null;
        const applicableDskp = appState.dskp.filter(d => d.active !== false && Number(d.yearLevel) === Number(student.year));
        const pbdRows = applicableDskp.map(d => ({
            dskp:d,
            record:getEffectivePbdMatrixRecord(student.id,d.id,period,academicYear)
        }));
        const pbdRecorded = pbdRows.filter(x => x.record?.tp);
        const avgTp = pbdRecorded.length ? pbdRecorded.reduce((sum,x)=>sum+Number(x.record.tp),0)/pbdRecorded.length : null;
        const completion = applicableDskp.length ? pbdRecorded.length/applicableDskp.length*100 : 0;
        const overall = getEffectivePbdOverall(student.id,period,academicYear,student.year);
        return {student, cls, academicYear, period, markRows, scored, avgMark, latest, previous, trend, applicableDskp, pbdRows, pbdRecorded, avgTp, completion, overall};
    }

    function classifyStudentProfile(d) {
        const lowMark = d.avgMark != null && isSupportMark(d.avgMark);
        const lowPbd = d.avgTp != null && d.avgTp < appSettings.pbdMasteryTp;
        if (!d.scored.length && !d.pbdRecorded.length) return {label:'Belum Cukup Data', cls:'bg-white/10 border-white/20 text-white'};
        if (lowMark && lowPbd) return {label:'Keutamaan Sokongan', cls:'bg-rose-500/20 border-rose-300/30 text-rose-100'};
        if (lowMark || lowPbd || d.completion < 60) return {label:'Perlu Dipantau', cls:'bg-amber-500/20 border-amber-300/30 text-amber-100'};
        if ((d.trend ?? 0) > 3 || (d.avgTp ?? 0) >= 4) return {label:'Kemajuan Baik', cls:'bg-emerald-500/20 border-emerald-300/30 text-emerald-100'};
        return {label:'Prestasi Stabil', cls:'bg-blue-500/20 border-blue-300/30 text-blue-100'};
    }

    function renderStudentProfile() {
        const studentId = document.getElementById('profile-student')?.value || '';
        const empty = document.getElementById('student-profile-empty'); const content = document.getElementById('student-profile-content');
        if (!studentId) { if(empty) empty.classList.remove('hidden'); if(content) content.classList.add('hidden'); studentProfileCurrent=null; return; }
        const d = getStudentProfileData(studentId); if (!d) return;
        studentProfileCurrent=d; if(empty) empty.classList.add('hidden'); if(content) content.classList.remove('hidden');
        document.getElementById('profile-avatar').textContent = d.student.name.trim().charAt(0).toUpperCase();
        document.getElementById('profile-name').textContent = d.student.name;
        document.getElementById('profile-meta').textContent = `${d.cls?.name || 'Tiada Kelas'} · Tahun ${d.student.year} · ${d.student.gender==='L'?'Lelaki':d.student.gender==='P'?'Perempuan':'—'}`;
        const stat=classifyStudentProfile(d); const badge=document.getElementById('profile-status-badge'); badge.textContent=stat.label; badge.className=`px-3 py-1.5 rounded-full border text-xs font-bold ${stat.cls}`;
        document.getElementById('profile-data-note').textContent = `${d.scored.length} rekod markah · ${d.pbdRecorded.length}/${d.applicableDskp.length} rekod PBD`;
        const grade = d.avgMark==null?'—':calculateGrade(d.avgMark);
        document.getElementById('profile-kpi-average').textContent = d.avgMark==null?'—':formatAverageMark(d.avgMark);
        document.getElementById('profile-kpi-grade').textContent = d.avgMark==null?'Tiada data markah':`Purata Gred ${grade}`;
        document.getElementById('profile-kpi-latest').textContent = d.latest?formatWholePercent(d.latest.score.percentage):'—';
        document.getElementById('profile-kpi-latest-name').textContent = d.latest
            ? `${d.latest.assessment.name} · ${formatAssessmentExamDate(d.latest.assessment.date)}`
            : 'Tiada pentaksiran';
        const trendEl=document.getElementById('profile-kpi-trend');
        if(d.trend==null){trendEl.textContent='—';trendEl.className='text-2xl font-black text-slate-900 mt-1';} else {trendEl.textContent=`${d.trend>0?'↑ +':d.trend<0?'↓ ':'→ '}${Math.abs(Math.round(d.trend))}%`;trendEl.className=`text-2xl font-black mt-1 ${d.trend>0?'text-emerald-700':d.trend<0?'text-rose-700':'text-slate-600'}`;}
        document.getElementById('profile-kpi-overall-tp').textContent = d.overall?.overallTP ? `TP${d.overall.overallTP}` : '—';
        document.getElementById('profile-kpi-overall-mode').textContent = d.overall?.overallTP ? (d.overall.calculationMode==='AUTO_THEME_AVERAGE'?'Purata automatik semua Tema':d.overall.calculationMode==='ASSISTED'?'Disahkan · Berpandukan cadangan':'Disahkan guru') : 'Belum lengkap';
        document.getElementById('profile-kpi-pbd-average').textContent = d.avgTp==null?'—':d.avgTp.toFixed(2);
        document.getElementById('profile-kpi-pbd-records').textContent = `${d.pbdRecorded.length} rekod TP`;
        document.getElementById('profile-kpi-pbd-completion').textContent = formatWholePercent(d.completion);
        document.getElementById('profile-pbd-progress').style.width = `${Math.min(100,d.completion)}%`;
        renderStudentProfileInsights(d); renderStudentProfileCharts(d); renderStudentProfileAssessmentTable(d); renderStudentProfilePbdTable(d);
        if(typeof lucide!=='undefined') lucide.createIcons();
    }

    function renderStudentProfileInsights(d) {
        const insights=[];
        if (d.avgMark!=null) insights.push({icon:'bar-chart-3',tone:isMasteredMark(d.avgMark)?'emerald':'rose',title:'Prestasi Markah',text:`Purata ${formatAverageMark(d.avgMark)} daripada ${d.scored.length} ujian bermarkah.`});
        else insights.push({icon:'bar-chart-3',tone:'slate',title:'Prestasi Markah',text:'Belum ada markah sah untuk dianalisis.'});
        if(d.trend!=null) insights.push({icon:d.trend>=0?'trending-up':'trending-down',tone:d.trend>=0?'emerald':'amber',title:'Arah Perubahan',text:`Markah terkini ${Math.abs(d.trend).toFixed(1)} mata peratus ${d.trend>=0?'lebih tinggi':'lebih rendah'} berbanding pentaksiran sebelumnya.`});
        if(d.avgTp!=null) insights.push({icon:'award',tone:d.avgTp>=appSettings.pbdMasteryTp?'blue':'amber',title:'Perkembangan PBD',text:`Purata TP ${d.avgTp.toFixed(2)} dengan ${formatWholePercent(d.completion)} SP telah direkod.`});
        const lowSp=d.pbdRows.filter(x=>x.record?.tp && Number(x.record.tp)<appSettings.pbdMasteryTp);
        if(lowSp.length) insights.push({icon:'target',tone:'rose',title:'Fokus Pengukuhan',text:`${lowSp.length} Standard Pembelajaran masih berada di bawah TP${appSettings.pbdMasteryTp}.`});
        const container=document.getElementById('profile-insights');
        const tones={emerald:'bg-emerald-50 border-emerald-100 text-emerald-700',rose:'bg-rose-50 border-rose-100 text-rose-700',amber:'bg-amber-50 border-amber-100 text-amber-700',blue:'bg-blue-50 border-blue-100 text-blue-700',slate:'bg-slate-50 border-slate-100 text-slate-600'};
        container.innerHTML=insights.map(x=>`<div class="rounded-xl border p-3 ${tones[x.tone]||tones.slate}"><div class="flex items-start gap-2"><i data-lucide="${x.icon}" class="w-4 h-4 mt-0.5 shrink-0"></i><div><p class="text-xs font-bold">${x.title}</p><p class="text-[11px] mt-1 opacity-80 leading-relaxed">${x.text}</p></div></div></div>`).join('');
        const supports=[];
        if(d.avgMark!=null && isSupportMark(d.avgMark)) supports.push('Markah dalam julat sokongan 0–39%');
        if(d.avgTp!=null && d.avgTp<appSettings.pbdMasteryTp) supports.push(`Purata PBD di bawah TP${appSettings.pbdMasteryTp}`);
        if(d.completion<100) supports.push(`${Math.max(0,d.applicableDskp.length-d.pbdRecorded.length)} rekod PBD belum lengkap`);
        if(d.trend!=null && d.trend<-3) supports.push('Trend markah menurun');
        const s=document.getElementById('profile-support-summary');
        s.innerHTML=supports.length?supports.map(v=>`<div class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-[11px] text-amber-800"><i data-lucide="circle-alert" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i><span>${v}</span></div>`).join(''):'<div class="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-[11px] text-emerald-800 flex gap-2"><i data-lucide="circle-check" class="w-4 h-4 shrink-0"></i><span>Tiada indikator sokongan utama dikesan berdasarkan data semasa.</span></div>';
    }

    function renderStudentProfileCharts(d) {
        if(studentProfileMarksChartInstance) studentProfileMarksChartInstance.destroy(); if(studentProfilePbdChartInstance) studentProfilePbdChartInstance.destroy();
        const markCanvas=document.getElementById('profile-marks-chart');
        const labels=d.scored.map(x=>x.assessment.name); const vals=d.scored.map(x=>Number(x.score.percentage));
        studentProfileMarksChartInstance=new Chart(markCanvas,{type:'line',data:{labels,datasets:[{label:'Peratus',data:vals,borderColor:'#059669',backgroundColor:'rgba(5,150,105,.12)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'#059669'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,max:100}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>formatWholePercent(c.raw)}}}}});
        const dist=[1,2,3,4,5,6].map(tp=>d.pbdRecorded.filter(x=>Number(x.record.tp)===tp).length);
        studentProfilePbdChartInstance=new Chart(document.getElementById('profile-pbd-chart'),{type:'doughnut',data:{labels:['TP1','TP2','TP3','TP4','TP5','TP6'],datasets:[{data:dist,backgroundColor:['#FCA5A5','#FDBA74','#FCD34D','#93C5FD','#6EE7B7','#C4B5FD'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}}}});
        const periodName=appState.pbdPeriods.find(p=>p.id===d.period)?.name||d.period; document.getElementById('profile-pbd-chart-subtitle').textContent=`TP1–TP6 · ${periodName}`;
    }

    function renderStudentProfileAssessmentTable(d) {
        const body=document.getElementById('profile-assessment-body'), empty=document.getElementById('profile-assessment-empty'); body.innerHTML='';
        const rows=[...d.markRows].sort((a,b)=>compareAssessmentsByExamDate(b.assessment,a.assessment));
        empty.classList.toggle('hidden',rows.length>0);
        rows.forEach(x=>{const tr=document.createElement('tr');tr.className='hover:bg-slate-50';const pct=x.score.absent?'TH':x.score.percentage==null?'—':formatWholePercent(x.score.percentage);const raw=x.score.absent?'Tidak Hadir':x.score.rawScore==null?'—':`${x.score.rawScore} / ${x.assessment.maxScore}`;tr.innerHTML=`<td class="px-4 py-3 text-slate-500">${escapeHtml(x.assessment.date||'—')}</td><td class="px-4 py-3"><p class="font-bold text-slate-800">${escapeHtml(x.assessment.name)}</p><p class="text-[10px] text-slate-400">${escapeHtml(x.assessment.type||'')}</p></td><td class="px-4 py-3 font-semibold">${raw}</td><td class="px-4 py-3 font-bold ${x.score.absent?'text-amber-600':'text-slate-800'}">${pct}</td><td class="px-4 py-3"><span class="inline-flex w-7 h-7 rounded-lg bg-slate-100 items-center justify-center font-black">${escapeHtml(x.score.grade||'—')}</span></td><td class="px-4 py-3 text-slate-500">${escapeHtml(x.score.teacherNote||'—')}</td>`;body.appendChild(tr);});
    }

    function renderStudentProfilePbdTable(d) {
        const body=document.getElementById('profile-pbd-body'), empty=document.getElementById('profile-pbd-empty'); body.innerHTML='';
        const rows=d.pbdRows.filter(x=>x.record?.tp).sort((a,b)=>String(b.record.assessmentDate||'').localeCompare(String(a.record.assessmentDate||'')));
        empty.classList.toggle('hidden',rows.length>0);
        rows.forEach(x=>{const tp=Number(x.record.tp);const cls=tp<=2?'bg-rose-100 text-rose-700':tp===3?'bg-amber-100 text-amber-700':tp===4?'bg-blue-100 text-blue-700':tp===5?'bg-emerald-100 text-emerald-700':'bg-purple-100 text-purple-700';const tr=document.createElement('tr');tr.className='hover:bg-slate-50';tr.innerHTML=`<td class="px-4 py-3 font-bold text-purple-700">${escapeHtml(x.dskp.standardLearningCode)}</td><td class="px-4 py-3 text-slate-700">${escapeHtml(x.dskp.standardLearningText)}</td><td class="px-4 py-3"><span class="px-2.5 py-1 rounded-lg text-[10px] font-black ${cls}">TP${tp}</span></td><td class="px-4 py-3 text-slate-500">${escapeHtml(x.record.assessmentDate||'—')}</td><td class="px-4 py-3 text-slate-600">${escapeHtml(x.record.evidence||'—')}</td><td class="px-4 py-3 text-slate-500">${escapeHtml(x.record.teacherNote||'—')}</td>`;body.appendChild(tr);});
        const strong=rows.filter(x=>Number(x.record.tp)>=5).length, need=rows.filter(x=>Number(x.record.tp)<appSettings.pbdMasteryTp).length;document.getElementById('profile-pbd-strength-label').textContent=`${strong} SP kukuh · ${need} SP perlu pengukuhan`;
    }

    function openStudentProfile(studentId) {
        navigateTab('analytics-student');
        const st=appState.students.find(s=>s.id===studentId); if(!st)return;
        const ay=document.getElementById('profile-academic-year'); if(ay) ay.value=st.academicYear||'2026';
        const y=document.getElementById('profile-year'); if(y)y.value=String(st.year); populateStudentProfileClasses();
        const c=document.getElementById('profile-class'); if(c && [...c.options].some(o=>o.value===st.classId)) c.value=st.classId;
        populateStudentProfileStudents(studentId); renderStudentProfile();
    }

    function openSelectedStudentMarks(){ if(!studentProfileCurrent)return; const st=studentProfileCurrent.student; const gy=document.getElementById('filter-tahun'); const gc=document.getElementById('filter-kelas'); if(gy)gy.value=String(st.year); if(gc && [...gc.options].some(o=>o.value===st.classId))gc.value=st.classId; navigateTab('marks'); renderMarksModule(); }
    function openSelectedStudentPbd(){ if(!studentProfileCurrent)return; const st=studentProfileCurrent.student; const gy=document.getElementById('filter-tahun'); const gc=document.getElementById('filter-kelas'); if(gy)gy.value=String(st.year); if(gc && [...gc.options].some(o=>o.value===st.classId))gc.value=st.classId; navigateTab('pbd'); initializePbdModule(); }

    function exportStudentProfileCSV() {
        const d=studentProfileCurrent; if(!d){showAlert('Tiada Murid','Pilih murid terlebih dahulu.','info');return;}
        const rows=[['PROFIL PRESTASI INDIVIDU'],['Nama',d.student.name],['Kelas',d.cls?.name||''],['Tahun',d.student.year],['GPMP',d.avgMark==null?'':formatWholePercent(d.avgMark)],['TP Keseluruhan',d.overall?.overallTP?`TP${d.overall.overallTP}`:''],['Purata PBD',d.avgTp==null?'':d.avgTp.toFixed(2)],[],['SEJARAH MARKAH'],['Tarikh','Ujian','Markah','Peratus','Gred','Catatan']];
        d.markRows.forEach(x=>rows.push([x.assessment.date||'',x.assessment.name,x.score.absent?'TH':x.score.rawScore??'',x.score.percentage??'',x.score.grade||'',x.score.teacherNote||'']));
        rows.push([],['REKOD PBD'],['SP','Standard Pembelajaran','TP','Tarikh','Evidens','Catatan']); d.pbdRows.filter(x=>x.record?.tp).forEach(x=>rows.push([x.dskp.standardLearningCode,x.dskp.standardLearningText,`TP${x.record.tp}`,x.record.assessmentDate||'',x.record.evidence||'',x.record.teacherNote||'']));
        const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`; const csv='\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=`Profil_Sejarah_${d.student.name.replace(/[^a-z0-9]+/gi,'_')}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }


    // --- PHASE 8: PROGRAM INTERVENSI MURID ---
    const interventionStrategyLabels = {
        BIMBINGAN_INDIVIDU: 'Bimbingan Individu',
        LATIHAN_PENGUKUHAN: 'Latihan Pengukuhan',
        PEMBELAJARAN_BERPASANGAN: 'Pembelajaran Berpasangan',
        PETA_MINDA: 'Peta Minda / Pengurusan Grafik',
        VISUAL: 'Pembelajaran Berasaskan Visual',
        KUIZ_PENGUKUHAN: 'Kuiz Pengukuhan',
        KBAT_BERPERINGKAT: 'Latihan KBAT Berperingkat',
        AKTIVITI_PEMULIHAN: 'Aktiviti Pemulihan',
        CUSTOM: 'Lain-lain'
    };

    function getPermittedInterventionClasses(academicYear = null) {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let rows = canonicalActiveClasses(academicYear||undefined);
        if (academicYear) rows = rows.filter(c => String(c.academicYear) === String(academicYear));
        if (currentUserRole === 'GURU_SEJARAH') rows = rows.filter(c => c.teacherId === currentUserId);
        return rows;
    }

    function getInterventionScope(overrides = {}) {
        return {
            academicYear: overrides.academicYear || document.getElementById('intervention-academic-year')?.value || document.getElementById('filter-academic-year')?.value || '2026',
            year: overrides.year || document.getElementById('intervention-year')?.value || 'ALL',
            classId: overrides.classId || document.getElementById('intervention-class')?.value || 'ALL'
        };
    }

    function getScopedInterventionStudents(scope = getInterventionScope()) {
        let classes = getPermittedInterventionClasses(scope.academicYear);
        if (scope.year !== 'ALL') classes = classes.filter(c => String(c.year) === String(scope.year));
        if (scope.classId !== 'ALL') classes = classes.filter(c => c.id === scope.classId);
        const classIds = new Set(classes.map(c => c.id));
        return sortStudentsAZ(appState.students.filter(s =>
            s.status === 'Aktif' &&
            String(s.academicYear) === String(scope.academicYear) &&
            classIds.has(s.classId)
        ));
    }

    function getStudentInterventionMetrics(studentId, academicYear = '2026') {
        const student = appState.students.find(s => s.id === studentId);
        if (!student) return null;

        const assessmentMap = new Map(appState.assessments.map(a => [a.id, a]));
        const markRows = appState.scores
            .filter(sc => sc.studentId === studentId && !sc.absent && sc.percentage !== null && sc.percentage !== undefined)
            .map(sc => ({ score: sc, assessment: assessmentMap.get(sc.assessmentId) }))
            .filter(x => x.assessment && String(x.assessment.academicYear) === String(academicYear))
            .sort((a, b) => compareAssessmentsByExamDate(a.assessment,b.assessment));

        const percentages = markRows.map(x => Number(x.score.percentage)).filter(Number.isFinite);
        const avgMark = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : null;
        const latestMark = percentages.length ? percentages[percentages.length - 1] : null;
        const previousMark = percentages.length > 1 ? percentages[percentages.length - 2] : null;
        const trend = latestMark !== null && previousMark !== null ? latestMark - previousMark : null;

        const pbdPeriod=getLatestEffectivePbdPeriodForStudent(studentId,academicYear);
        const dskpIds=new Set(
            appState.dskp
                .filter(d=>d.active!==false&&Number(d.yearLevel)===Number(student.year))
                .map(d=>d.id)
        );
        const pbdRows=getEffectivePbdRecordsForScope(
            new Set([studentId]),
            dskpIds,
            academicYear,
            pbdPeriod
        );
        const tpValues = pbdRows.map(r => Number(r.tp)).filter(n => Number.isFinite(n) && n >= 1 && n <= 6);
        const avgTp = tpValues.length ? tpValues.reduce((a, b) => a + b, 0) / tpValues.length : null;
        const lowPbdRows = pbdRows.filter(r => Number(r.tp) < Number(appSettings.pbdMasteryTp || 3));
        const lowSpCodes = [...new Set(lowPbdRows.map(r => appState.dskp.find(d => d.id === r.dskpId)?.standardLearningCode).filter(Boolean))];

        let priority = null;
        const reasons = [];

        const severeMark = avgMark !== null && avgMark < 40;
        const severePbd = avgTp !== null && avgTp < 2;
        const supportMark = avgMark !== null && isSupportMark(avgMark);
        const supportPbd = avgTp !== null && avgTp < Number(appSettings.pbdMasteryTp || 3);
        const declining = trend !== null && trend <= -10;

        if (severeMark || severePbd) priority = 'HIGH';
        else if (supportMark || supportPbd) priority = 'SUPPORT';
        else if (declining) priority = 'MONITOR';

        if (avgMark !== null && supportMark) reasons.push(`Purata markah ${formatWholePercent(avgMark)} dalam julat sokongan 0–${appSettings.masteryThreshold}%.`);
        if (avgTp !== null && supportPbd) reasons.push(`Purata PBD TP${avgTp.toFixed(1)} di bawah indikator TP${appSettings.pbdMasteryTp}.`);
        if (declining) reasons.push(`Markah terkini menurun ${Math.abs(trend).toFixed(1)} mata peratus berbanding pentaksiran sebelumnya.`);
        if (lowSpCodes.length) reasons.push(`${lowSpCodes.length} Standard Pembelajaran mempunyai rekod di bawah TP${appSettings.pbdMasteryTp}.`);

        let recommendedStrategies = [];
        if (priority === 'HIGH') recommendedStrategies = ['BIMBINGAN_INDIVIDU', 'LATIHAN_PENGUKUHAN', 'AKTIVITI_PEMULIHAN'];
        else if (priority === 'SUPPORT') recommendedStrategies = ['LATIHAN_PENGUKUHAN', 'PEMBELAJARAN_BERPASANGAN', 'PETA_MINDA'];
        else if (priority === 'MONITOR') recommendedStrategies = ['KUIZ_PENGUKUHAN', 'KBAT_BERPERINGKAT'];

        return {
            student,
            avgMark,
            latestMark,
            previousMark,
            trend,
            markCount: percentages.length,
            avgTp,
            pbdCount: tpValues.length,
            lowSpCodes,
            priority,
            reasons,
            recommendedStrategies
        };
    }

    function getInterventionCandidates(scopeOverrides = {}) {
        const scope = getInterventionScope(scopeOverrides);
        return getScopedInterventionStudents(scope)
            .map(st => getStudentInterventionMetrics(st.id, scope.academicYear))
            .filter(m => m && m.priority)
            .sort((a, b) => {
                const order = { HIGH: 0, SUPPORT: 1, MONITOR: 2 };
                if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
                const aScore = a.avgMark === null ? 101 : a.avgMark;
                const bScore = b.avgMark === null ? 101 : b.avgMark;
                return aScore - bScore;
            });
    }

    function interventionPriorityMeta(priority) {
        if (priority === 'HIGH') return { label: 'Keutamaan Tinggi', cls: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'alert-triangle' };
        if (priority === 'SUPPORT') return { label: 'Perlu Sokongan', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'life-buoy' };
        return { label: 'Pantau', cls: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'eye' };
    }

    function interventionStatusMeta(status) {
        if (status === 'SELESAI') return { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        if (status === 'SEDANG_DILAKSANAKAN') return { label: 'Sedang Dilaksanakan', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
        return { label: 'Belum Bermula', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    }

    function formatInterventionDate(value) {
        if (!value) return '—';
        const d = new Date(`${value}T00:00:00`);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function isInterventionDue(record) {
        if (!record?.followUpDate || record.status === 'SELESAI') return false;
        const today = new Date(); today.setHours(0,0,0,0);
        const follow = new Date(`${record.followUpDate}T00:00:00`);
        return follow.getTime() <= today.getTime();
    }

    function logInterventionAudit(action, record, previous = null) {
        appState.auditLogs.push({
            id: `audit_int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            module: 'INTERVENTION',
            action,
            interventionId: record?.id || null,
            studentId: record?.studentId || null,
            previous: previous ? {
                status: previous.status,
                progress: previous.progress,
                followUpDate: previous.followUpDate,
                priority: previous.priority
            } : null,
            current: record ? {
                status: record.status,
                progress: record.progress,
                followUpDate: record.followUpDate,
                priority: record.priority
            } : null,
            changedBy: currentUserId,
            timestamp: new Date().toISOString()
        });
    }

    function populateInterventionClassFilter(preserve = true) {
        const el = document.getElementById('intervention-class');
        if (!el) return;
        const current = preserve ? el.value : 'ALL';
        const academicYear = document.getElementById('intervention-academic-year')?.value || '2026';
        const year = document.getElementById('intervention-year')?.value || 'ALL';
        let classes = getPermittedInterventionClasses(academicYear);
        if (year !== 'ALL') classes = classes.filter(c => String(c.year) === year);
        el.innerHTML = '<option value="ALL">Semua Kelas</option>' + classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        if ([...el.options].some(o => o.value === current)) el.value = current;
        else el.value = 'ALL';
    }

    function onInterventionScopeChange(type) {
        if (type === 'year') {
            const globalYear = document.getElementById('intervention-academic-year')?.value;
            if (globalYear) {
                const level = document.getElementById('intervention-year');
                if (level && !['4','5','6','ALL'].includes(level.value)) level.value = 'ALL';
            }
        }
        populateInterventionClassFilter(false);
        renderInterventionModule();
    }

    function initializeInterventionModule() {
        const ay = document.getElementById('intervention-academic-year');
        const year = document.getElementById('intervention-year');
        const globalAy = document.getElementById('filter-academic-year')?.value;
        const globalYear = document.getElementById('filter-tahun')?.value;
        const globalClass = document.getElementById('filter-kelas')?.value;
        if (ay && globalAy && [...ay.options].some(o => o.value === globalAy)) ay.value = globalAy;
        if (year && globalYear && [...year.options].some(o => o.value === globalYear)) year.value = globalYear;
        populateInterventionClassFilter(false);
        const classEl = document.getElementById('intervention-class');
        if (classEl && globalClass && [...classEl.options].some(o => o.value === globalClass)) classEl.value = globalClass;
        renderInterventionModule();
    }

    function setInterventionCandidateFilter(value) {
        interventionCandidateFilter = value;
        document.querySelectorAll('.int-candidate-filter').forEach(btn => {
            const active = btn.dataset.intCandidateFilter === value;
            btn.className = `int-candidate-filter px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${active ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600'}`;
        });
        renderInterventionCandidates();
    }

    function renderInterventionCandidates() {
        const container = document.getElementById('intervention-candidate-list');
        const empty = document.getElementById('intervention-candidate-empty');
        if (!container || !empty) return;
        const search = (document.getElementById('intervention-search')?.value || '').trim().toLowerCase();
        let rows = getInterventionCandidates();
        if (interventionCandidateFilter !== 'ALL') rows = rows.filter(x => x.priority === interventionCandidateFilter);
        if (search) rows = rows.filter(x => x.student.name.toLowerCase().includes(search));

        container.innerHTML = '';
        if (!rows.length) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        rows.forEach(m => {
            const cls = appState.classes.find(c => c.id === m.student.classId);
            const meta = interventionPriorityMeta(m.priority);
            const existing = appState.interventions.find(r => r.studentId === m.student.id && r.status !== 'SELESAI' && String(r.academicYear) === String(getInterventionScope().academicYear));
            const recommended = m.recommendedStrategies.slice(0, 2).map(code => interventionStrategyLabels[code]).join(' · ');
            const row = document.createElement('div');
            row.className = 'p-4 sm:p-5 hover:bg-slate-50/70 transition-colors';
            row.innerHTML = `
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <button onclick="openStudentProfile('${m.student.id}')" class="font-bold text-slate-900 hover:text-emerald-700 text-left">${escapeHtml(m.student.name)}</button>
                            <span class="px-2 py-0.5 rounded-full border text-[10px] font-black ${meta.cls}">${meta.label}</span>
                            ${existing ? '<span class="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">Intervensi Aktif</span>' : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(cls?.name || 'Tiada Kelas')} · ${m.markCount} rekod markah · ${m.pbdCount} rekod PBD</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <span class="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">GPMP: ${m.avgMark === null ? '—' : formatWholePercent(m.avgMark)}</span>
                            <span class="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">Purata PBD: ${m.avgTp === null ? '—' : 'TP' + m.avgTp.toFixed(1)}</span>
                            ${m.trend === null ? '' : `<span class="px-2 py-1 rounded-md ${m.trend < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} text-[10px] font-semibold">Trend ${m.trend >= 0 ? '+' : ''}${m.trend.toFixed(1)} pp</span>`}
                        </div>
                        <p class="text-xs text-slate-600 mt-2 leading-relaxed">${escapeHtml(m.reasons.join(' '))}</p>
                        ${recommended ? `<p class="text-[10px] text-emerald-700 mt-2 font-semibold">Cadangan strategi: ${escapeHtml(recommended)}</p>` : ''}
                    </div>
                    <div class="shrink-0">
                        <button onclick="${existing ? `openInterventionModal('', '${existing.id}')` : `openInterventionModal('${m.student.id}')`}" class="px-3.5 py-2 rounded-lg ${existing ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-600 text-white border-emerald-600'} border text-xs font-bold hover:opacity-90">
                            ${existing ? 'Kemaskini Intervensi' : 'Rancang Intervensi'}
                        </button>
                    </div>
                </div>`;
            container.appendChild(row);
        });
        lucide.createIcons();
    }

    function getFilteredInterventionRecords() {
        const scope = getInterventionScope();
        const status = document.getElementById('intervention-status-filter')?.value || 'ALL';
        const priority = document.getElementById('intervention-priority-filter')?.value || 'ALL';
        const search = (document.getElementById('intervention-search')?.value || '').trim().toLowerCase();
        const studentIds = new Set(getScopedInterventionStudents(scope).map(s => s.id));

        return appState.interventions
            .filter(r =>
                String(r.academicYear) === String(scope.academicYear) &&
                studentIds.has(r.studentId) &&
                (status === 'ALL' || r.status === status) &&
                (priority === 'ALL' || r.priority === priority)
            )
            .filter(r => {
                if (!search) return true;
                const st = appState.students.find(s => s.id === r.studentId);
                return st?.name.toLowerCase().includes(search);
            })
            .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    }

    function renderInterventionRecords(records) {
        const tbody = document.getElementById('intervention-record-body');
        const empty = document.getElementById('intervention-record-empty');
        if (!tbody || !empty) return;
        tbody.innerHTML = '';
        document.getElementById('intervention-record-count').textContent = `${records.length} rekod`;

        if (!records.length) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        records.forEach(r => {
            const st = appState.students.find(s => s.id === r.studentId);
            const cls = appState.classes.find(c => c.id === r.classId);
            if (!st) return;
            const pmeta = interventionPriorityMeta(r.priority);
            const smeta = interventionStatusMeta(r.status);
            const due = isInterventionDue(r);
            const strategy = r.strategy === 'CUSTOM' ? (r.customStrategy || 'Lain-lain') : (interventionStrategyLabels[r.strategy] || r.strategy || '—');
            const progress = Math.max(0, Math.min(100, Number(r.progress || 0)));
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80';
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <button onclick="openStudentProfile('${st.id}')" class="font-bold text-slate-800 hover:text-emerald-700 text-left">${escapeHtml(st.name)}</button>
                    <p class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(cls?.name || '')}</p>
                </td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full border text-[10px] font-bold ${pmeta.cls}">${pmeta.label}</span></td>
                <td class="px-4 py-3">
                    <p class="font-semibold text-slate-700">${escapeHtml(strategy)}</p>
                    <p class="text-[10px] text-slate-400 mt-1 max-w-xs truncate">${escapeHtml(r.issue || '')}</p>
                </td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full border text-[10px] font-bold ${smeta.cls}">${smeta.label}</span></td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2"><div class="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full" style="width:${progress}%"></div></div><span class="text-[10px] font-black text-slate-600">${progress}%</span></div>
                </td>
                <td class="px-4 py-3"><span class="${due ? 'text-rose-700 font-bold' : 'text-slate-600'} text-xs">${formatInterventionDate(r.followUpDate)}</span>${due ? '<p class="text-[9px] text-rose-500 font-bold mt-0.5">PERLU SUSULAN</p>' : ''}</td>
                <td class="px-4 py-3 text-right"><button onclick="openInterventionModal('', '${r.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold">Kemaskini</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderInterventionFollowups(records) {
        const list = document.getElementById('intervention-followup-list');
        const empty = document.getElementById('intervention-followup-empty');
        if (!list || !empty) return;
        const active = records
            .filter(r => r.status !== 'SELESAI' && r.followUpDate)
            .sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate)))
            .slice(0, 6);
        list.innerHTML = '';
        if (!active.length) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');
        active.forEach(r => {
            const st = appState.students.find(s => s.id === r.studentId);
            const due = isInterventionDue(r);
            const div = document.createElement('button');
            div.onclick = () => openInterventionModal('', r.id);
            div.className = `w-full text-left rounded-lg border p-3 hover:shadow-sm transition-all ${due ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`;
            div.innerHTML = `<div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="text-xs font-bold ${due ? 'text-rose-800' : 'text-slate-800'} truncate">${escapeHtml(st?.name || 'Murid')}</p><p class="text-[10px] ${due ? 'text-rose-600' : 'text-slate-500'} mt-0.5">${formatInterventionDate(r.followUpDate)}</p></div><span class="text-[9px] font-black ${due ? 'text-rose-600' : 'text-blue-600'}">${due ? 'SEGERA' : `${Number(r.progress || 0)}%`}</span></div>`;
            list.appendChild(div);
        });
    }

    function renderInterventionModule() {
        const scope = getInterventionScope();
        const allCandidates = getInterventionCandidates(scope);
        const records = getFilteredInterventionRecords();
        const allScopedRecords = appState.interventions.filter(r => {
            const studentIds = new Set(getScopedInterventionStudents(scope).map(s => s.id));
            return String(r.academicYear) === String(scope.academicYear) && studentIds.has(r.studentId);
        });

        const active = allScopedRecords.filter(r => r.status === 'SEDANG_DILAKSANAKAN').length;
        const due = allScopedRecords.filter(isInterventionDue).length;
        const completed = allScopedRecords.filter(r => r.status === 'SELESAI').length;
        const progressRows = allScopedRecords.filter(r => r.status !== 'BELUM_BERMULA' || Number(r.progress || 0) > 0);
        const avgProgress = progressRows.length ? progressRows.reduce((a, r) => a + Number(r.progress || 0), 0) / progressRows.length : null;

        document.getElementById('intervention-kpi-candidates').textContent = allCandidates.length;
        const activeCandidateIds = new Set(allScopedRecords.filter(r => r.status !== 'SELESAI').map(r => r.studentId));
        const newCandidateCount = allCandidates.filter(c => !activeCandidateIds.has(c.student.id)).length;
        document.getElementById('intervention-kpi-candidate-note').textContent = `${newCandidateCount} belum mempunyai intervensi aktif`;
        document.getElementById('intervention-kpi-active').textContent = active;
        document.getElementById('intervention-kpi-due').textContent = due;
        document.getElementById('intervention-kpi-completed').textContent = completed;
        document.getElementById('intervention-kpi-progress').textContent = avgProgress === null ? '—' : formatWholePercent(avgProgress);
        document.getElementById('intervention-kpi-progress-bar').style.width = `${avgProgress === null ? 0 : Math.max(0, Math.min(100, avgProgress))}%`;

        renderInterventionCandidates();
        renderInterventionRecords(records);
        renderInterventionFollowups(allScopedRecords);
        lucide.createIcons();
    }

    function populateInterventionStudentSelect(selectedId = '') {
        const select = document.getElementById('intervention-form-student');
        if (!select) return;
        const scope = getInterventionScope();
        const students = getScopedInterventionStudents(scope).sort((a, b) => a.name.localeCompare(b.name, 'ms'));
        select.innerHTML = '<option value="">Pilih Murid</option>' + students.map(s => {
            const cls = appState.classes.find(c => c.id === s.classId);
            return `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(cls?.name || '')}</option>`;
        }).join('');
        if (selectedId && [...select.options].some(o => o.value === selectedId)) select.value = selectedId;
    }

    function todayIsoLocal() {
        const d = new Date();
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    }

    function addDaysIso(dateStr, days) {
        const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
        d.setDate(d.getDate() + days);
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    }

    function openInterventionModal(studentId = '', interventionId = '') {
        populateInterventionStudentSelect(studentId);
        document.getElementById('intervention-form-id').value = '';
        document.getElementById('intervention-form-priority').value = 'SUPPORT';
        document.getElementById('intervention-form-issue').value = '';
        document.getElementById('intervention-form-strategy').value = '';
        document.getElementById('intervention-form-custom-strategy').value = '';
        document.getElementById('intervention-form-target').value = `Capai ≥ ${masteryMinimumMark()}% dan sekurang-kurangnya TP${appSettings.pbdMasteryTp} secara konsisten`;
        const start = todayIsoLocal();
        document.getElementById('intervention-form-start-date').value = start;
        document.getElementById('intervention-form-followup-date').value = addDaysIso(start, 14);
        document.getElementById('intervention-form-status').value = 'BELUM_BERMULA';
        document.getElementById('intervention-form-progress').value = '0';
        document.getElementById('intervention-form-note').value = '';
        document.getElementById('intervention-form-student').disabled = false;
        document.getElementById('intervention-delete-btn').classList.add('hidden');
        document.getElementById('modal-intervention-title').textContent = 'Rekod Intervensi Murid';
        toggleCustomInterventionStrategy();
        updateInterventionProgressLabel();

        if (interventionId) {
            const r = appState.interventions.find(x => x.id === interventionId);
            if (!r) return;
            const permittedClassIds=new Set(getPermittedInterventionClasses(getInterventionScope().academicYear).map(c=>c.id));
            const recordStudent=appState.students.find(s=>s.id===r.studentId);
            const recordClassId=r.classId||recordStudent?.classId;
            if(!recordClassId||!permittedClassIds.has(recordClassId)){
                showAlert('Akses Intervensi Ditolak','Guru hanya boleh membuka rekod intervensi murid dalam kelas yang ditugaskan.','danger');
                return;
            }
            populateInterventionStudentSelect(r.studentId);
            document.getElementById('intervention-form-id').value = r.id;
            document.getElementById('intervention-form-student').value = r.studentId;
            document.getElementById('intervention-form-student').disabled = true;
            document.getElementById('intervention-form-priority').value = r.priority || 'SUPPORT';
            document.getElementById('intervention-form-issue').value = r.issue || '';
            document.getElementById('intervention-form-strategy').value = r.strategy || '';
            document.getElementById('intervention-form-custom-strategy').value = r.customStrategy || '';
            document.getElementById('intervention-form-target').value = r.target || '';
            document.getElementById('intervention-form-start-date').value = r.startDate || start;
            document.getElementById('intervention-form-followup-date').value = r.followUpDate || '';
            document.getElementById('intervention-form-status').value = r.status || 'BELUM_BERMULA';
            document.getElementById('intervention-form-progress').value = String(r.progress || 0);
            document.getElementById('intervention-form-note').value = r.teacherNote || '';
            document.getElementById('modal-intervention-title').textContent = 'Kemaskini Intervensi Murid';
            if (currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA') document.getElementById('intervention-delete-btn').classList.remove('hidden');
            toggleCustomInterventionStrategy();
            updateInterventionProgressLabel();
        }

        onInterventionStudentChange(interventionId ? true : false);
        const modal = document.getElementById('modal-intervention');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }

    function closeInterventionModal() {
        const modal = document.getElementById('modal-intervention');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function onInterventionStudentChange(preserveExistingFields = false) {
        const studentId = document.getElementById('intervention-form-student')?.value;
        const signal = document.getElementById('intervention-form-signal');
        if (!studentId || !signal) {
            signal?.classList.add('hidden');
            return;
        }
        const metrics = getStudentInterventionMetrics(studentId, getInterventionScope().academicYear);
        if (!metrics) return;
        const meta = metrics.priority ? interventionPriorityMeta(metrics.priority) : null;
        const reasonText = metrics.reasons.length ? metrics.reasons.join(' ') : 'Tiada petunjuk risiko automatik yang jelas berdasarkan data semasa.';
        signal.innerHTML = `<div class="flex items-start gap-2"><i data-lucide="sparkles" class="w-4 h-4 mt-0.5 shrink-0"></i><div><p class="font-bold">Saringan Sistem ${meta ? '· ' + meta.label : ''}</p><p class="mt-1 leading-relaxed">${escapeHtml(reasonText)}</p></div></div>`;
        signal.classList.remove('hidden');

        if (!preserveExistingFields && !document.getElementById('intervention-form-id').value) {
            if (metrics.priority) document.getElementById('intervention-form-priority').value = metrics.priority;
            if (metrics.reasons.length) document.getElementById('intervention-form-issue').value = metrics.reasons.join(' ');
            const suggestion = metrics.recommendedStrategies[0];
            if (suggestion) document.getElementById('intervention-form-strategy').value = suggestion;
            toggleCustomInterventionStrategy();
        }
        lucide.createIcons();
    }

    function toggleCustomInterventionStrategy() {
        const value = document.getElementById('intervention-form-strategy')?.value;
        document.getElementById('intervention-custom-strategy-wrap')?.classList.toggle('hidden', value !== 'CUSTOM');
    }

    function updateInterventionProgressLabel() {
        const value = Number(document.getElementById('intervention-form-progress')?.value || 0);
        const label = document.getElementById('intervention-progress-label');
        if (label) label.textContent = `${value}%`;
    }

    function syncInterventionProgressWithStatus() {
        const status = document.getElementById('intervention-form-status')?.value;
        const range = document.getElementById('intervention-form-progress');
        if (!range) return;
        if (status === 'SELESAI') range.value = '100';
        else if (status === 'BELUM_BERMULA' && Number(range.value) === 100) range.value = '0';
        updateInterventionProgressLabel();
    }

    function saveIntervention() {
        const id = document.getElementById('intervention-form-id').value;
        const studentId = document.getElementById('intervention-form-student').value;
        const priority = document.getElementById('intervention-form-priority').value;
        const issue = document.getElementById('intervention-form-issue').value.trim();
        const strategy = document.getElementById('intervention-form-strategy').value;
        const customStrategy = document.getElementById('intervention-form-custom-strategy').value.trim();
        const target = document.getElementById('intervention-form-target').value.trim();
        const startDate = document.getElementById('intervention-form-start-date').value;
        const followUpDate = document.getElementById('intervention-form-followup-date').value;
        let status = document.getElementById('intervention-form-status').value;
        let progress = Math.max(0, Math.min(100, Number(document.getElementById('intervention-form-progress').value || 0)));
        const teacherNote = document.getElementById('intervention-form-note').value.trim();

        if (!studentId || !priority || !issue || !strategy || !startDate) {
            showAlert('Maklumat Belum Lengkap', 'Sila lengkapkan Murid, Keutamaan, Fokus Intervensi, Strategi dan Tarikh Mula.', 'danger');
            return;
        }
        if (strategy === 'CUSTOM' && !customStrategy) {
            showAlert('Strategi Diperlukan', 'Sila nyatakan strategi intervensi lain-lain.', 'danger');
            return;
        }
        const student = appState.students.find(s => s.id === studentId);
        if (!student) return;
        const permittedIds = new Set(getPermittedInterventionClasses(getInterventionScope().academicYear).map(c => c.id));
        if (!permittedIds.has(student.classId)) {
            showAlert('Tiada Kebenaran', 'Anda tidak mempunyai akses untuk merekod intervensi murid ini.', 'danger');
            return;
        }

        if (status === 'SELESAI') progress = 100;
        if (progress === 100 && status !== 'SELESAI') status = 'SELESAI';

        const now = new Date().toISOString();
        const base = {
            studentId,
            academicYear: getInterventionScope().academicYear,
            classId: student.classId,
            yearLevel: student.year,
            priority,
            source: getStudentInterventionMetrics(studentId, getInterventionScope().academicYear)?.priority ? 'SYSTEM_ASSISTED' : 'MANUAL',
            issue,
            strategy,
            customStrategy: strategy === 'CUSTOM' ? customStrategy : '',
            target,
            startDate,
            followUpDate,
            status,
            progress,
            teacherNote,
            updatedAt: now,
            updatedBy: currentUserId
        };

        if (id) {
            const idx = appState.interventions.findIndex(r => r.id === id);
            if (idx === -1) return;
            const previous = { ...appState.interventions[idx] };
            const history = Array.isArray(previous.history) ? [...previous.history] : [];
            history.push({
                timestamp: now,
                progress,
                status,
                followUpDate,
                note: teacherNote,
                by: currentUserId
            });
            const updated = { ...previous, ...base, history };
            appState.interventions[idx] = updated;
            logInterventionAudit('UPDATE_INTERVENTION', updated, previous);
        } else {
            const rec = {
                id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                ...base,
                createdAt: now,
                createdBy: currentUserId,
                history: [{
                    timestamp: now,
                    progress,
                    status,
                    followUpDate,
                    note: teacherNote,
                    by: currentUserId
                }]
            };
            appState.interventions.push(rec);
            logInterventionAudit('CREATE_INTERVENTION', rec);
        }

        persistPhase8State();
        closeInterventionModal();
        renderInterventionModule();
        updateDashboardKPIs();
        showAlert('Intervensi Disimpan', 'Rekod intervensi dan susulan murid telah dikemaskini.', 'success');
    }

    function deleteInterventionFromModal() {
        const id = document.getElementById('intervention-form-id').value;
        if (!id) return;
        if (!(currentUserRole === 'ADMIN' || currentUserRole === 'KETUA_PANITIA')) {
            showAlert('Tiada Kebenaran', 'Hanya pentadbir atau Ketua Panitia boleh memadam rekod intervensi.', 'danger');
            return;
        }
        const rec = appState.interventions.find(r => r.id === id);
        if (!rec) return;
        showAlert('Padam Rekod Intervensi?', 'Tindakan ini akan memadam rekod intervensi terpilih daripada prototaip ini.', 'danger', () => {
            logInterventionAudit('DELETE_INTERVENTION', rec);
            appState.interventions = appState.interventions.filter(r => r.id !== id);
            persistPhase8State();
            closeInterventionModal();
            renderInterventionModule();
            updateDashboardKPIs();
        });
    }

    function exportInterventionsCSV() {
        const scope = getInterventionScope();
        const studentIds = new Set(getScopedInterventionStudents(scope).map(s => s.id));
        const rows = appState.interventions.filter(r => String(r.academicYear) === String(scope.academicYear) && studentIds.has(r.studentId));
        if (!rows.length) {
            showAlert('Tiada Data', 'Belum ada rekod intervensi untuk dieksport bagi skop ini.', 'info');
            return;
        }
        const data = [['Nama Murid','Kelas','Tahun','Keutamaan','Isu/Fokus','Strategi','Sasaran','Tarikh Mula','Tarikh Susulan','Status','Kemajuan (%)','Catatan Guru']];
        rows.forEach(r => {
            const st = appState.students.find(s => s.id === r.studentId);
            const cls = appState.classes.find(c => c.id === r.classId);
            const strategy = r.strategy === 'CUSTOM' ? r.customStrategy : interventionStrategyLabels[r.strategy];
            data.push([
                st?.name || '', cls?.name || '', r.yearLevel || '', interventionPriorityMeta(r.priority).label,
                r.issue || '', strategy || '', r.target || '', r.startDate || '', r.followUpDate || '',
                interventionStatusMeta(r.status).label, r.progress || 0, r.teacherNote || ''
            ]);
        });
        const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = '\uFEFF' + data.map(row => row.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Intervensi_Sejarah_${scope.academicYear}_${todayIsoLocal()}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }

    const DEFAULT_MATTARY_LOGO_DATA_URL = 'assets/background-4.png';

    // --- PHASE 9: LAPORAN, PDF, EXCEL & PROFIL SEKOLAH ---
    const PHASE9_STORAGE_KEY = 'sejarah_pbd_phase9_report_settings_v1';
    let phase9SchoolProfile = {
        schoolName: 'SK Demo Bistari',
        schoolCode: 'DEMO001',
        address: 'Alamat sekolah belum ditetapkan',
        panitiaHead: 'Puan Noraini',
        headteacher: 'Guru Besar',
        sessionLabel: '2026',
        activeAcademicYear: '2026',
        pastAcademicYears: ['2025'],
        nearMissMargin: 5,
        headcountMethod: 'METHOD1',
        headcountIncrements: { oti1: 3, oti2: 3, etr: 4 },
        entryControls: {
            DIAGNOSTIK: { marks: true, pbd: true },
            UPSA: { marks: true, pbd: true },
            UASA: { marks: true, pbd: true }
        },
        reportFooter: 'Dijana melalui Sistem Pengurusan Markah & PBD Sejarah Sekolah Rendah',
        logoDataUrl: DEFAULT_MATTARY_LOGO_DATA_URL
    };
    let currentReportPayload = null;

    function restorePhase9State() {
        try {
            const saved = localStorage.getItem(PHASE9_STORAGE_KEY);
            if (saved) phase9SchoolProfile = {...phase9SchoolProfile, ...JSON.parse(saved)};
            if(!phase9SchoolProfile.logoDataUrl) phase9SchoolProfile.logoDataUrl=DEFAULT_MATTARY_LOGO_DATA_URL;
        } catch (err) { console.warn('Gagal memulihkan tetapan Fasa 9:', err); }
    }

    function persistPhase9State() {
        try { localStorage.setItem(PHASE9_STORAGE_KEY, JSON.stringify(phase9SchoolProfile)); }
        catch (err) { console.warn('Gagal menyimpan tetapan Fasa 9:', err); }
    }

    function phase9AyLabel(value) {
        const n=Number(value);
        if(!Number.isFinite(n))return String(value||'');
        // KPM school calendar uses calendar-year naming from 2026 onward.
        // Legacy academic sessions retain labels such as 2025/2026.
        return n>=2026 ? String(n) : `${n}/${n+1}`;
    }

    function normalizedEntryControls() {
        const defaults={
            DIAGNOSTIK:{marks:true,pbd:false},
            UPSA:{marks:true,pbd:true},
            UASA:{marks:true,pbd:true}
        };
        const source=phase9SchoolProfile.entryControls||{};
        return Object.fromEntries(Object.entries(defaults).map(([type,vals])=>[
            type,
            {
                marks: source[type]?.marks !== false,
                pbd: type==='DIAGNOSTIK' ? false : source[type]?.pbd !== false
            }
        ]));
    }

    function isAssessmentEntryOpen(kind,type) {
        if(!['marks','pbd'].includes(kind)||!['DIAGNOSTIK','UPSA','UASA'].includes(type))return true;
        return normalizedEntryControls()[type]?.[kind] !== false;
    }

    function pbdAssessmentTypeFromPeriod(period) {
        // PBD has only two periods; Admin activation still maps to UPSA/UASA controls.
        if(period==='PERTENGAHAN')return 'UPSA';
        if(period==='AKHIR')return 'UASA';
        return period;
    }

    function pbdPeriodLabel(period) {
        if(period==='PERTENGAHAN')return 'Pertengahan Tahun';
        if(period==='AKHIR')return 'Akhir Tahun';
        return period||'';
    }

    function updateEntryControlPreview(type) {
        const marks=document.getElementById(`entry-${type}-marks`)?.checked===true;
        const pbd=document.getElementById(`entry-${type}-pbd`)?.checked===true;
        const badge=document.getElementById(`entry-${type}-status`);
        if(!badge)return;
        const both=marks&&pbd, none=!marks&&!pbd;
        badge.className=`entry-status-badge ${both?'is-open':none?'is-closed':''}`;
        badge.textContent=both?'MARKAH & PBD AKTIF':none?'SEMUA DINYAHAKTIF':marks?'MARKAH SAHAJA AKTIF':'PBD SAHAJA AKTIF';
    }

    function renderEntryControlSettings() {
        if(!isAdminSession())return;
        const controls=normalizedEntryControls();
        ['DIAGNOSTIK','UPSA','UASA'].forEach(type=>{
            const marks=document.getElementById(`entry-${type}-marks`);
            const pbd=document.getElementById(`entry-${type}-pbd`);
            if(marks)marks.checked=controls[type].marks;
            if(pbd){
                pbd.checked=controls[type].pbd;
                pbd.disabled=type==='DIAGNOSTIK';
                pbd.closest('label')?.classList.toggle('opacity-30',type==='DIAGNOSTIK');
                pbd.closest('label')?.setAttribute('title',type==='DIAGNOSTIK'?'PBD hanya menggunakan Pertengahan Tahun dan Akhir Tahun':'');
            }
            updateEntryControlPreview(type);
        });
    }

    function marksEntryClosedMessage(type) {
        const names={DIAGNOSTIK:'Diagnostik',UPSA:'UPSA',UASA:'UASA'};
        return `Pengisian markah ${names[type]||type} telah dinyahaktifkan oleh Admin. Data sedia ada masih boleh dilihat.`;
    }

    function pbdEntryClosedMessage(period) {
        return `Pengisian PBD ${pbdPeriodLabel(period)} telah dinyahaktifkan oleh Admin. Data sedia ada masih boleh dilihat.`;
    }

    function normalizedAcademicSessions() {
        const active = String(phase9SchoolProfile.activeAcademicYear || '2026');
        const past = Array.isArray(phase9SchoolProfile.pastAcademicYears) ? phase9SchoolProfile.pastAcademicYears.map(String) : ['2025'];
        const years = [active, ...past].filter((v,i,a)=>/^\d{4}$/.test(v) && a.indexOf(v)===i);
        return years.sort((a,b)=>Number(b)-Number(a)).map(year=>({year,label:phase9AyLabel(year),active:year===active}));
    }

    function getActiveAcademicYear() {
        return String(phase9SchoolProfile.activeAcademicYear || '2026');
    }

    function populateAcademicSessionSelectors(preserve=true) {
        const sessions = normalizedAcademicSessions();
        const ids = [
            'filter-academic-year','marks-scope-session','analytics-year-session','pbd-an-session',
            'profile-academic-year','class-compare-session','intervention-academic-year',
            'report-academic-year','export-academic-year','headcount-session'
        ];
        ids.forEach(id=>{
            const el=document.getElementById(id);
            if(!el)return;
            const prev=preserve?el.value:'';
            el.innerHTML=sessions.map(s=>`<option value="${s.year}">${s.label}${s.active?' (Semasa)':''}</option>`).join('');
            if(prev && sessions.some(s=>s.year===prev)) el.value=prev;
            else el.value=getActiveAcademicYear();
        });
        const badge=document.getElementById('dashboard-session-badge');
        if(badge) badge.textContent=`Sesi Persekolahan ${phase9AyLabel(getActiveAcademicYear())}`;
    }

    function updatePhase9Branding() {
        const top = document.getElementById('topbar-school-name');
        const side = document.getElementById('sidebar-school-name');
        if (top) top.textContent = phase9SchoolProfile.schoolName || 'Sekolah';
        phase9SchoolProfile.sessionLabel = phase9AyLabel(getActiveAcademicYear());
        if (side) side.textContent = `${phase9SchoolProfile.schoolName || 'Sekolah'} (${phase9SchoolProfile.sessionLabel || 'Sesi'})`;
        const dashSession=document.getElementById('dashboard-session-badge'); if(dashSession) dashSession.textContent=`Sesi Persekolahan ${phase9SchoolProfile.sessionLabel}`;
        const summary = document.getElementById('report-school-summary');
        if (summary) summary.textContent = `${phase9SchoolProfile.schoolName}${phase9SchoolProfile.schoolCode ? ' · '+phase9SchoolProfile.schoolCode : ''}`;
    }

    restorePhase9State();
    updatePhase9Branding();
    setTimeout(()=>populateAcademicSessionSelectors(false),0);

    function getPhase9PermittedClasses(academicYear = null) {
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let rows = canonicalActiveClasses(academicYear||undefined);
        if (academicYear) rows = rows.filter(c => String(c.academicYear) === String(academicYear));
        if (currentUserRole === 'GURU_SEJARAH') rows = rows.filter(c => c.teacherId === currentUserId);
        return rows;
    }

    function getPhase9ScopedStudents(academicYear, year='ALL', classId='ALL') {
        let classes = getPhase9PermittedClasses(academicYear);
        if (year !== 'ALL') classes = classes.filter(c => String(c.year) === String(year));
        if (classId !== 'ALL') classes = classes.filter(c => c.id === classId);
        const ids = new Set(classes.map(c => c.id));
        return sortStudentsAZ(appState.students.filter(s => s.status === 'Aktif' && ids.has(s.classId) && String(s.academicYear || academicYear) === String(academicYear)));
    }

    function getTeacherName(id) { return mockTeachers.find(t => t.id === id)?.name || '—'; }
    function getClassName(id) { return appState.classes.find(c => c.id === id)?.name || '—'; }
    function reportSafe(value) { return escapeHtml(value == null || value === '' ? '—' : String(value)); }

    function initializeReports() {
        const ay = document.getElementById('report-academic-year');
        const globalAy = document.getElementById('filter-academic-year')?.value || '2026';
        if (ay && [...ay.options].some(o=>o.value===globalAy)) ay.value = globalAy;
        const y = document.getElementById('report-year');
        const gy = document.getElementById('filter-tahun')?.value || 'ALL';
        if (y) y.value = ['4','5','6'].includes(gy) ? gy : 'ALL';
        const period = document.getElementById('report-pbd-period');
        if (period) {
            const current = period.value || 'PERTENGAHAN';
            period.innerHTML = (appState.pbdPeriods || []).filter(p=>p.active!==false).map(p=>`<option value="${reportSafe(p.id)}">${reportSafe(p.name)}</option>`).join('');
            if ([...period.options].some(o=>o.value===current)) period.value=current;
        }
        populateReportClasses();
        populateReportStudents();
        onReportTypeChange(false);
        updatePhase9Branding();
        lucide.createIcons();
    }

    function populateReportClasses() {
        const el = document.getElementById('report-class'); if (!el) return;
        const ay = document.getElementById('report-academic-year')?.value || '2026';
        const year = document.getElementById('report-year')?.value || 'ALL';
        const previous = el.value || 'ALL';
        let classes = getPhase9PermittedClasses(ay);
        if (year !== 'ALL') classes = classes.filter(c=>String(c.year)===String(year));
        el.innerHTML = '<option value="ALL">Semua Kelas</option>' + classes.map(c=>`<option value="${c.id}">${reportSafe(c.name)}</option>`).join('');
        el.value = [...el.options].some(o=>o.value===previous) ? previous : 'ALL';
    }

    function populateReportStudents() {
        const el = document.getElementById('report-student'); if (!el) return;
        const ay = document.getElementById('report-academic-year')?.value || '2026';
        const year = document.getElementById('report-year')?.value || 'ALL';
        const classId = document.getElementById('report-class')?.value || 'ALL';
        const previous = el.value;
        const students = getPhase9ScopedStudents(ay,year,classId);
        el.innerHTML = '<option value="">Pilih Murid</option>' + students.map(s=>`<option value="${s.id}">${reportSafe(s.name)} · ${reportSafe(getClassName(s.classId))}</option>`).join('');
        if (previous && [...el.options].some(o=>o.value===previous)) el.value=previous;
        else if (students.length===1) el.value=students[0].id;
    }

    function onReportScopeChange(source) {
        if (source === 'year' || source === 'level') populateReportClasses();
        populateReportStudents();
        clearReportPreviewHint();
    }

    function onReportTypeChange(clear=true) {
        const type = document.getElementById('report-type')?.value || 'INDIVIDU';
        const studentWrap = document.getElementById('report-student-wrap');
        if (studentWrap) studentWrap.classList.toggle('hidden', type !== 'INDIVIDU');
        if (clear) clearReportPreviewHint();
    }

    function clearReportPreviewHint() {
        currentReportPayload = null;
        const area = document.getElementById('report-print-area'); if (!area) return;
        area.classList.remove('report-page-stack');
        area.innerHTML = `<div class="min-h-[700px] flex flex-col items-center justify-center text-center"><div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4"><i data-lucide="file-text" class="w-8 h-8"></i></div><h3 class="font-bold text-slate-800">Tetapan Laporan Berubah</h3><p class="text-xs text-slate-500 max-w-md mt-2">Klik <b>Jana Pratonton</b> untuk menjana semula laporan berdasarkan skop terkini.</p></div>`;
        lucide.createIcons();
    }

    function reportHeaderHtml(title, subtitle='') {
        const logo = phase9SchoolProfile.logoDataUrl
          ? `<img src="${phase9SchoolProfile.logoDataUrl}" alt="Logo sekolah" class="w-16 h-16 object-contain">`
          : `<div class="w-16 h-16 rounded-2xl bg-navy-950 text-white flex items-center justify-center font-black text-2xl">S</div>`;
        return `<div class="flex items-start gap-4 pb-5 border-b-2 border-slate-900"><div>${logo}</div><div class="flex-1"><p class="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Panitia Sejarah</p><h1 class="text-xl font-black text-slate-950 mt-1">${reportSafe(phase9SchoolProfile.schoolName)}</h1><p class="text-[10px] text-slate-500 mt-1 whitespace-pre-line">${reportSafe(phase9SchoolProfile.address)}${phase9SchoolProfile.schoolCode ? ' · Kod: '+reportSafe(phase9SchoolProfile.schoolCode) : ''}</p><h2 class="text-lg font-extrabold text-slate-900 mt-4">${reportSafe(title)}</h2>${subtitle?`<p class="text-xs text-slate-500 mt-1">${reportSafe(subtitle)}</p>`:''}</div><div class="text-right text-[10px] text-slate-500"><p class="font-bold text-slate-700">Sesi ${reportSafe(phase9SchoolProfile.sessionLabel)}</p><p class="mt-1">Dijana: ${new Date().toLocaleDateString('ms-MY')}</p></div></div>`;
    }

    function reportFooterHtml() {
        return `<div class="mt-8 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[10px] text-slate-500"><div><p class="font-bold text-slate-700">Ketua Panitia Sejarah</p><div class="mt-8 border-t border-slate-300 pt-1 max-w-[220px]">${reportSafe(phase9SchoolProfile.panitiaHead)}</div></div><div class="sm:text-right"><p class="font-bold text-slate-700">Guru Besar</p><div class="mt-8 border-t border-slate-300 pt-1 sm:ml-auto max-w-[220px]">${reportSafe(phase9SchoolProfile.headteacher)}</div></div><p class="sm:col-span-2 text-center mt-2">${reportSafe(phase9SchoolProfile.reportFooter)}</p></div>`;
    }

    function reportKpi(label,value,note='') { return `<div class="rounded-xl border border-slate-200 p-3"><p class="text-[9px] font-black uppercase tracking-wider text-slate-400">${reportSafe(label)}</p><p class="text-xl font-black text-slate-900 mt-1">${reportSafe(value)}</p>${note?`<p class="text-[9px] text-slate-500 mt-0.5">${reportSafe(note)}</p>`:''}</div>`; }

    function reportDistributionHtml(title, pairs, maxValue=null) {
        const max = maxValue || Math.max(1,...pairs.map(x=>Number(x.value)||0));
        return `<div class="rounded-xl border border-slate-200 p-4"><h3 class="text-xs font-black text-slate-800 mb-3">${reportSafe(title)}</h3><div class="space-y-2">${pairs.map(x=>`<div class="grid grid-cols-[70px_1fr_35px] items-center gap-2"><span class="text-[10px] font-bold text-slate-600">${reportSafe(x.label)}</span><div class="report-bar-track"><div class="report-bar-fill" style="width:${Math.max(0,Math.min(100,(Number(x.value)||0)/max*100))}%"></div></div><span class="text-[10px] font-black text-slate-700 text-right">${reportSafe(x.value)}</span></div>`).join('')}</div></div>`;
    }

    function getReportStudentData(studentId, academicYear, period) {
        const student = appState.students.find(s=>s.id===studentId); if (!student) return null;
        const permittedClassIds=new Set(getPhase9PermittedClasses(academicYear).map(c=>c.id));
        if(!permittedClassIds.has(student.classId))return null;
        const cls = appState.classes.find(c=>c.id===student.classId);
        const assessments = appState.assessments.filter(a=>a.classId===student.classId && String(a.academicYear)===String(academicYear)).sort(compareAssessmentsByExamDate);
        const markRows = assessments.map(a=>({assessment:a,score:getActualScoreRecords().find(sc=>sc.studentId===student.id && sc.assessmentId===a.id)})).filter(x=>x.score);
        const scored = markRows.filter(x=>!x.score.absent && x.score.percentage!=null);
        const avgMark = scored.length ? scored.reduce((s,x)=>s+Number(x.score.percentage),0)/scored.length : null;
        const dskp = appState.dskp.filter(d=>d.active!==false && Number(d.yearLevel)===Number(student.year));
        const pbdRows = dskp.map(d=>({
            dskp:d,
            record:getEffectivePbdMatrixRecord(student.id,d.id,period,academicYear)
        }));
        const pbdRecorded = pbdRows.filter(x=>x.record?.tp);
        const avgTp = pbdRecorded.length ? pbdRecorded.reduce((s,x)=>s+Number(x.record.tp),0)/pbdRecorded.length : null;
        const completion = dskp.length ? pbdRecorded.length/dskp.length*100 : 0;
        const overall = getEffectivePbdOverall(student.id,period,academicYear,student.year);
        const interventions = (appState.interventions||[]).filter(r=>r.studentId===student.id && String(r.academicYear)===String(academicYear));
        const headcount = typeof hcBuildRow==='function' ? hcBuildRow(student,academicYear) : null;
        const classmates=appState.students.filter(s=>s.classId===student.classId&&s.active!==false);
        const classAverages=classmates.map(st=>{
            const values=assessments.map(a=>getActualScoreRecords().find(sc=>sc.studentId===st.id&&sc.assessmentId===a.id)).filter(sc=>sc&&!sc.absent&&Number.isFinite(Number(sc.percentage))).map(sc=>Number(sc.percentage));
            return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
        }).filter(v=>v!==null);
        const classAverage=classAverages.length?classAverages.reduce((a,b)=>a+b,0)/classAverages.length:null;
        const classBand=avgMark===null||classAverage===null?'Tiada Data':avgMark>=classAverage+5?'Melebihi Purata Kelas':avgMark<classAverage-5?'Di Bawah Purata Kelas':'Sekitar Purata Kelas';
        const midOverall=getEffectivePbdOverall(student.id,'PERTENGAHAN',academicYear,student.year);
        const endOverall=getEffectivePbdOverall(student.id,'AKHIR',academicYear,student.year);
        const pbdProgress=dskp.map(d=>{
            const mid=getEffectivePbdMatrixRecord(student.id,d.id,'PERTENGAHAN',academicYear);
            const end=getEffectivePbdMatrixRecord(student.id,d.id,'AKHIR',academicYear);
            const directEnd=appState.pbdRecords.find(r=>r.studentId===student.id&&r.dskpId===d.id&&String(r.academicYear)===String(academicYear)&&String(r.assessmentPeriod).toUpperCase()==='AKHIR');
            const a=Number(mid?.tp||0),b=Number(end?.tp||0);
            return {dskp:d,mid,end,directEnd,delta:a&&b?b-a:null,status:directEnd?(directEnd.inheritedFromPeriod?'DIWARISI':'DINILAI_SEMULA'):(end?'DIWARISI':'BELUM_DINILAI')};
        });
        const attention=typeof getStudentInterventionMetrics==='function'?getStudentInterventionMetrics(student.id,academicYear):null;
        const latestActual=headcount?.latestActual?.value;
        const nearMiss=typeof hcNearMissInfo==='function'?hcNearMissInfo(latestActual):{nearMiss:false};
        const timestamps=[...markRows.map(x=>x.score.updatedAt||x.assessment.date),...pbdRecorded.map(x=>x.record.updatedAt||x.record.assessmentDate),...interventions.map(x=>x.updatedAt||x.createdAt)].filter(Boolean).sort();
        return {student,cls,markRows,scored,avgMark,dskp,pbdRows,pbdRecorded,avgTp,completion,overall,interventions,headcount,classAverage,classBand,midOverall,endOverall,pbdProgress,attention,nearMiss,lastUpdated:timestamps.at(-1)||null};
    }

    function buildIndividualReport(studentId, academicYear, period) {
        const d = getReportStudentData(studentId,academicYear,period); if(!d) return null;
        const periodName = appState.pbdPeriods.find(p=>p.id===period)?.name || period;
        const tpDist = [1,2,3,4,5,6].map(tp=>({label:`TP${tp}`,value:d.pbdRecorded.filter(x=>Number(x.record.tp)===tp).length}));
        const markTrend = d.scored.map(x=>({label:(x.assessment.type||x.assessment.name).slice(0,12),value:Number(x.score.percentage)}));
        const activeInt = d.interventions.filter(r=>r.status!=='SELESAI').length;
        const scored=d.scored;
        const totalChange=scored.length>1?Number(scored.at(-1).score.percentage)-Number(scored[0].score.percentage):null;
        const latest=scored.at(-1)||null;
        const hc=d.headcount;
        const targetGap=hc?.etr!=null&&latest?Number(hc.etr)-Number(latest.score.percentage):null;
        const markRows=d.markRows.map((x,i)=>{
            const previous=d.markRows.slice(0,i).reverse().find(y=>!y.score.absent&&Number.isFinite(Number(y.score.percentage)));
            const delta=!x.score.absent&&previous?Number(x.score.percentage)-Number(previous.score.percentage):null;
            const type=String(x.assessment.type||'').toUpperCase();
            const target=type==='UPSA'?hc?.oti1:type==='UASA'?hc?.oti2:type==='DIAGNOSTIK'?hc?.toy?.value:null;
            return `<tr class="border-t border-slate-100"><td class="p-2 font-bold">${reportSafe(x.assessment.name)}</td><td class="p-2 text-center">${x.score.absent?'TH':`${reportSafe(x.score.rawScore)}/${reportSafe(x.assessment.maxScore)}`}</td><td class="p-2 text-center font-black">${x.score.absent?'—':formatWholePercent(x.score.percentage)}</td><td class="p-2 text-center">${reportSafe(x.score.grade||'—')}</td><td class="p-2 text-center ${delta>0?'text-emerald-700':delta<0?'text-rose-700':'text-slate-500'}">${delta===null?'—':`${delta>0?'↑ +':delta<0?'↓ ':'→ '}${delta.toFixed(1)}`}</td><td class="p-2 text-center">${target==null?'—':formatWholePercent(target)}</td><td class="p-2">${reportSafe(x.score.teacherNote||'—')}</td></tr>`;
        }).join('');
        const progressRows=d.pbdProgress.map(x=>{
            const label=x.delta===null?'—':x.delta>0?`↑ +${x.delta}`:x.delta<0?`↓ ${x.delta}`:'→ Kekal';
            const status=x.status==='DINILAI_SEMULA'?'Dinilai semula':x.status==='DIWARISI'?'Diwarisi dari Pertengahan':'Belum dinilai';
            return `<tr class="border-t border-slate-100"><td class="p-2 font-bold text-indigo-700">${reportSafe(x.dskp.standardLearningCode)}</td><td class="p-2">${reportSafe(x.dskp.standardLearningText)}</td><td class="p-2 text-center font-black">${x.mid?.tp?`TP${x.mid.tp}`:'—'}</td><td class="p-2 text-center font-black">${x.end?.tp?`TP${x.end.tp}`:'—'}</td><td class="p-2 text-center ${x.delta>0?'text-emerald-700':x.delta<0?'text-rose-700':'text-slate-600'}">${label}</td><td class="p-2"><span class="report-status-chip ${x.status==='DIWARISI'?'inherited':''}">${status}</span></td></tr>`;
        }).join('');
        const improved=d.pbdProgress.filter(x=>x.delta>0).length,stable=d.pbdProgress.filter(x=>x.delta===0).length,declined=d.pbdProgress.filter(x=>x.delta<0).length,inherited=d.pbdProgress.filter(x=>x.status==='DIWARISI').length;
        const strengths=d.pbdProgress.filter(x=>Number(x.end?.tp||x.mid?.tp)>=4).slice(0,4);
        const gaps=d.pbdProgress.filter(x=>{const tp=Number(x.end?.tp||x.mid?.tp);return tp>0&&tp<3;}).slice(0,4);
        const priority=d.attention?.priority==='HIGH'?'Keutamaan Tinggi':d.attention?.priority==='SUPPORT'?'Perlu Sokongan':d.attention?.priority==='MONITOR'?'Pantau':'Tiada indikator kritikal';
        const nextStrategies=(d.attention?.recommendedStrategies||[]).slice(0,3).map(code=>interventionStrategyLabels[code]||code);
        const html = `${reportHeaderHtml('Laporan Prestasi Individu Murid', `${d.student.name} · ${d.cls?.name||''}`)}
          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]"><div><b>Nama Murid</b><p>${reportSafe(d.student.name)}</p></div><div><b>Kelas / Tahun</b><p>${reportSafe(d.cls?.name||'—')} / ${reportSafe(d.student.year||d.cls?.year||'—')}</p></div><div><b>Guru Sejarah</b><p>${reportSafe(getTeacherName(d.cls?.teacherId)||'—')}</p></div><div><b>Data Dikemas Kini</b><p>${d.lastUpdated?new Date(d.lastUpdated).toLocaleDateString('ms-MY'):'—'}</p></div></div>
          <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">${reportKpi('Purata Markah',d.avgMark==null?'—':formatWholePercent(d.avgMark),'Individu')}${reportKpi('Gred Semasa',latest?calculateGrade(latest.score.percentage):'—',latest?.assessment.name||'Tiada pentaksiran')}${reportKpi('TP Pertengahan → Akhir',`${d.midOverall?.overallTP?'TP'+d.midOverall.overallTP:'—'} → ${d.endOverall?.overallTP?'TP'+d.endOverall.overallTP:'—'}`)}${reportKpi('Sasaran ETR',hc?.etr==null?'—':formatWholePercent(hc.etr),targetGap==null?'Tiada jurang':targetGap<=0?'Sasaran dicapai':`Perlu +${targetGap.toFixed(1)} mata`)}${reportKpi('Status Perhatian',priority,d.nearMiss?.nearMiss?`Near Miss ${d.nearMiss.targetGrade}: +${d.nearMiss.gap}`:'Berdasarkan semua indikator')}${reportKpi('Kelengkapan Data',formatWholePercent(d.completion),`${d.pbdRecorded.length}/${d.dskp.length} SP PBD`)}</div>
          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${reportDistributionHtml('Trend Markah (%)',markTrend,100)}<div class="rounded-xl border border-slate-200 p-4"><h3 class="text-xs font-black text-slate-800 mb-3">Ringkasan Progression</h3><div class="space-y-2 text-[10px]"><p><b>Perubahan keseluruhan:</b> ${totalChange===null?'—':`${totalChange>0?'↑ +':totalChange<0?'↓ ':'→ '}${totalChange.toFixed(1)} mata peratus`}</p><p><b>Perbandingan kelas:</b> ${d.avgMark==null||d.classAverage==null?'—':`${formatWholePercent(d.avgMark)} berbanding ${formatWholePercent(d.classAverage)} (${reportSafe(d.classBand)})`}</p><p><b>Near Miss:</b> ${d.nearMiss?.nearMiss?`Gred ${d.nearMiss.currentGrade} → ${d.nearMiss.targetGrade}, perlu +${d.nearMiss.gap} mata`:'Tiada Near Miss pada pencapaian terkini'}</p><p><b>Status sasaran:</b> ${reportSafe(hc?.status||'Belum Direkod')}</p></div></div></div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Perbandingan Markah dan Sasaran</h3><div class="overflow-hidden rounded-xl border border-slate-200"><table class="w-full text-[9px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Pentaksiran</th><th class="p-2">Markah</th><th class="p-2">Peratus</th><th class="p-2">Gred</th><th class="p-2">Perubahan</th><th class="p-2">Sasaran</th><th class="p-2 text-left">Catatan</th></tr></thead><tbody>${markRows||`<tr><td colspan="7" class="p-4 text-center text-slate-400">Tiada markah direkodkan.</td></tr>`}</tbody></table></div></div>
          <div class="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><p class="text-[10px] font-black uppercase text-blue-700">Perjalanan Headcount</p><div class="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[9px]">${[['TOV',hc?.toy?.value],['OT1',hc?.oti1],['UPSA/AR1',hc?.ar1?.value],['OT2',hc?.oti2],['UASA/AR2',hc?.ar2?.value],['ETR',hc?.etr]].map(([l,v])=>`<div class="rounded-lg bg-white border border-blue-100 p-2"><b>${l}</b><p class="font-black mt-1">${v==null?'—':formatWholePercent(v)}</p></div>`).join('')}</div></div>

          <div class="report-page-break"></div>${reportHeaderHtml('Progression PBD dan Standard Pembelajaran', `${d.student.name} · Sesi ${academicYear}`)}
          <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">${reportKpi('Meningkat',improved,'SP')}${reportKpi('Kekal',stable,'SP')}${reportKpi('Menurun',declined,'SP')}${reportKpi('Data Diwarisi',inherited,'Belum dinilai semula')}</div>
          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${reportDistributionHtml('Taburan PBD — '+periodName,tpDist)}<div class="rounded-xl border border-slate-200 p-4"><h3 class="text-xs font-black text-slate-800 mb-2">Kekuatan dan Jurang</h3><p class="text-[10px] font-bold text-emerald-700">Kekuatan</p><ul class="text-[9px] text-slate-600 list-disc ml-4">${strengths.length?strengths.map(x=>`<li>${reportSafe(x.dskp.standardLearningCode)} · ${reportSafe(x.dskp.standardLearningText)}</li>`).join(''):'<li>Belum ada SP pada TP4–TP6.</li>'}</ul><p class="text-[10px] font-bold text-rose-700 mt-3">Perlu Diperkukuh</p><ul class="text-[9px] text-slate-600 list-disc ml-4">${gaps.length?gaps.map(x=>`<li>${reportSafe(x.dskp.standardLearningCode)} · ${reportSafe(x.dskp.standardLearningText)}</li>`).join(''):'<li>Tiada SP direkodkan di bawah TP3.</li>'}</ul></div></div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Pertengahan → Akhir Tahun</h3><div class="overflow-hidden rounded-xl border border-slate-200"><table class="w-full text-[8px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">SP</th><th class="p-2 text-left">Standard Pembelajaran</th><th class="p-2">Pertengahan</th><th class="p-2">Akhir</th><th class="p-2">Progress</th><th class="p-2 text-left">Status Data</th></tr></thead><tbody>${progressRows||`<tr><td colspan="6" class="p-4 text-center text-slate-400">Tiada data PBD.</td></tr>`}</tbody></table></div></div>

          <div class="report-page-break"></div>${reportHeaderHtml('Intervensi dan Pelan Tindakan', `${d.student.name} · ${d.cls?.name||''}`)}
          <div class="mt-5 rounded-xl border ${d.attention?.priority?'border-amber-200 bg-amber-50':'border-emerald-200 bg-emerald-50'} p-4"><p class="text-[10px] font-black uppercase">Rumusan Prestasi</p><p class="text-xs font-bold mt-1">${reportSafe(priority)}</p><div class="mt-2 text-[10px] space-y-1">${(d.attention?.reasons||[]).length?d.attention.reasons.map(r=>`<p>• ${reportSafe(r)}</p>`).join(''):'<p>Tiada indikator risiko kritikal berdasarkan markah dan PBD semasa.</p>'}</div></div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Rekod Intervensi dan Susulan</h3><div class="overflow-hidden rounded-xl border border-slate-200"><table class="w-full text-[8px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Isu / Strategi</th><th class="p-2">Mula</th><th class="p-2">Semakan</th><th class="p-2">Progress</th><th class="p-2">Status</th><th class="p-2 text-left">Hasil / Catatan</th></tr></thead><tbody>${d.interventions.length?d.interventions.map(r=>`<tr class="border-t border-slate-100"><td class="p-2"><b>${reportSafe(r.issue||'—')}</b><p>${reportSafe(interventionStrategyLabels[r.strategy]||r.customStrategy||r.strategy||'—')}</p></td><td class="p-2 text-center">${reportSafe(r.startDate||'—')}</td><td class="p-2 text-center ${isInterventionDue(r)?'text-rose-700 font-black':''}">${reportSafe(r.followUpDate||r.reviewDate||'—')}${isInterventionDue(r)?'<br>OVERDUE':''}</td><td class="p-2 text-center">${reportSafe(r.progress||0)}%</td><td class="p-2 text-center">${reportSafe((r.status||'—').replaceAll('_',' '))}</td><td class="p-2">${reportSafe(r.result||r.teacherNote||'—')}</td></tr>`).join(''):`<tr><td colspan="6" class="p-4 text-center text-slate-400">Tiada intervensi direkodkan.</td></tr>`}</tbody></table></div></div>
          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4"><div class="rounded-xl border border-slate-200 p-4"><h3 class="text-xs font-black">Pelan Tindakan Guru</h3><ul class="mt-2 text-[10px] list-disc ml-4 space-y-1">${nextStrategies.length?nextStrategies.map(x=>`<li>${reportSafe(x)}</li>`).join(''):'<li>Teruskan pemantauan berdasarkan sasaran pentaksiran berikutnya.</li>'}<li>Tarikh semakan berikutnya: ${reportSafe(d.interventions.find(r=>r.status!=='SELESAI')?.followUpDate||'Belum ditetapkan')}</li></ul></div><div class="rounded-xl border border-slate-200 p-4"><h3 class="text-xs font-black">Cadangan Murid dan Ibu Bapa</h3><ul class="mt-2 text-[10px] list-disc ml-4 space-y-1"><li>Ulang kaji SP yang disenaraikan sebagai perlu diperkukuh.</li><li>Semak latihan dan maklum balas guru setiap minggu.</li><li>Pantau kemajuan menuju sasaran ${hc?.etr==null?'yang akan ditetapkan':formatWholePercent(hc.etr)}.</li></ul></div></div>
          ${reportFooterHtml()}`;
        return {type:'INDIVIDU',title:`Laporan Individu - ${d.student.name}`,html,data:d};
    }

    function getClassReportData(classId, academicYear, period) {
        const cls = appState.classes.find(c=>c.id===classId); if(!cls) return null;
        if(!getPhase9PermittedClasses(academicYear).some(c=>c.id===classId))return null;
        const students = getPhase9ScopedStudents(academicYear,String(cls.year),classId);
        const assessmentIds = new Set(appState.assessments.filter(a=>a.classId===classId && String(a.academicYear)===String(academicYear)).map(a=>a.id));
        const dskpIds = new Set(appState.dskp.filter(d=>d.active!==false && Number(d.yearLevel)===Number(cls.year)).map(d=>d.id));
        const rows = students.map(st=>{
            const scores=getActualScoreRecords().filter(sc=>sc.studentId===st.id && assessmentIds.has(sc.assessmentId) && !sc.absent && sc.percentage!=null);
            const avgMark=scores.length?scores.reduce((a,b)=>a+Number(b.percentage),0)/scores.length:null;
            const pbd=getEffectivePbdRecordsForScope(
                new Set([st.id]),
                dskpIds,
                academicYear,
                period
            );
            const avgTp=pbd.length?pbd.reduce((a,b)=>a+Number(b.tp),0)/pbd.length:null;
            const overall=getEffectivePbdOverall(st.id,period,academicYear,st.year);
            const activeInterventions=(appState.interventions||[]).filter(r=>r.studentId===st.id && String(r.academicYear)===String(academicYear) && r.status!=='SELESAI').length;
            return {student:st,avgMark,grade:avgMark==null?'—':calculateGrade(avgMark),avgTp,overallTp:overall?.overallTP||null,pbdCount:pbd.length,activeInterventions};
        });
        const scored=rows.filter(r=>r.avgMark!=null); const avg=scored.length?scored.reduce((s,r)=>s+r.avgMark,0)/scored.length:null;
        const mastery=scored.filter(r=>isMasteredMark(r.avgMark)).length;
        const totalDskp=dskpIds.size; const recordedPbd=rows.reduce((s,r)=>s+r.pbdCount,0); const completion=students.length&&totalDskp?recordedPbd/(students.length*totalDskp)*100:0;
        const gradeDist=['A','B','C','D','E','F'].map(g=>({label:'Gred '+g,value:rows.filter(r=>r.grade===g).length}));
        const tpDist=[1,2,3,4,5,6].map(tp=>({label:'TP'+tp,value:rows.filter(r=>Number(r.overallTp||(r.avgTp?Math.round(r.avgTp):0))===tp).length}));
        return {cls,students,rows,avg,mastery,completion,gradeDist,tpDist,academicYear,period};
    }

    function buildClassReport(classId, academicYear, period) {
        const d=getClassReportData(classId,academicYear,period); if(!d)return null;
        const periodName=appState.pbdPeriods.find(p=>p.id===period)?.name||period;
        const html=`${reportHeaderHtml('Laporan Prestasi Kelas',`${d.cls.name} · Tahun ${d.cls.year}`)}
          <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">${reportKpi('Jumlah Murid',d.students.length)}${reportKpi('GPMP',d.avg==null?'—':formatWholePercent(d.avg))}${reportKpi('Kadar Menguasai',d.rows.filter(r=>r.avgMark!=null).length?formatWholePercent(d.mastery/d.rows.filter(r=>r.avgMark!=null).length*100):'—')}${reportKpi('Lengkap PBD',formatWholePercent(d.completion),periodName)}</div>
          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${reportDistributionHtml('Taburan Gred',d.gradeDist)}${reportDistributionHtml('Taburan TP Keseluruhan',d.tpDist)}</div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Prestasi Murid</h3><div class="overflow-hidden rounded-xl border border-slate-200"><table class="w-full text-[10px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Bil</th><th class="p-2 text-left">Nama Murid</th><th class="p-2">GPMP</th><th class="p-2">Gred</th><th class="p-2">Purata PBD</th><th class="p-2">TP Keseluruhan</th><th class="p-2">Intervensi Aktif</th></tr></thead><tbody>${d.rows.map((r,i)=>`<tr class="border-t border-slate-100"><td class="p-2">${i+1}</td><td class="p-2 font-semibold">${reportSafe(r.student.name)}</td><td class="p-2 text-center">${r.avgMark==null?'—':formatWholePercent(r.avgMark)}</td><td class="p-2 text-center font-black">${reportSafe(r.grade)}</td><td class="p-2 text-center">${r.avgTp==null?'—':'TP'+r.avgTp.toFixed(1)}</td><td class="p-2 text-center font-black">${r.overallTp?'TP'+r.overallTp:'—'}</td><td class="p-2 text-center">${r.activeInterventions}</td></tr>`).join('')}</tbody></table></div></div>
          <div class="mt-5 rounded-xl border border-slate-200 p-4 text-[10px] text-slate-600"><b>Guru Sejarah:</b> ${reportSafe(getTeacherName(d.cls.teacherId))} · <b>Tempoh PBD:</b> ${reportSafe(periodName)} · <b>Threshold Menguasai:</b> ${appSettings.masteryThreshold}%</div>
          ${reportFooterHtml()}`;
        return {type:'KELAS',title:`Laporan Kelas - ${d.cls.name}`,html,data:d};
    }

    function buildPanitiaReport(academicYear, year, period) {
        let classes=getPhase9PermittedClasses(academicYear); if(year!=='ALL')classes=classes.filter(c=>String(c.year)===String(year));
        const classRows=classes.map(c=>getClassReportData(c.id,academicYear,period)).filter(Boolean);
        const allRows=classRows.flatMap(c=>c.rows); const scored=allRows.filter(r=>r.avgMark!=null); const avg=scored.length?scored.reduce((s,r)=>s+r.avgMark,0)/scored.length:null;
        const gradeDist=['A','B','C','D','E','F'].map(g=>({label:'Gred '+g,value:allRows.filter(r=>r.grade===g).length}));
        const classBars=classRows.map(c=>({label:chartClassShortLabel(c.cls),value:c.avg==null?0:Number(c.avg.toFixed(1))}));
        const activeInt=(appState.interventions||[]).filter(r=>r.status!=='SELESAI' && String(r.academicYear)===String(academicYear) && allRows.some(x=>x.student.id===r.studentId)).length;
        const yearStats=[4,5,6].filter(y=>year==='ALL'||String(y)===String(year)).map(y=>{const subset=classRows.filter(c=>Number(c.cls.year)===y);const rows=subset.flatMap(c=>c.rows).filter(r=>r.avgMark!=null);return {year:y,classes:subset.length,students:subset.reduce((s,c)=>s+c.students.length,0),avg:rows.length?rows.reduce((s,r)=>s+r.avgMark,0)/rows.length:null};});
        const periodName=appState.pbdPeriods.find(p=>p.id===period)?.name||period;
        const html=`${reportHeaderHtml('Laporan Prestasi Panitia Sejarah',year==='ALL'?'Tahun 4, 5 dan 6':`Tahun ${year}`)}
          <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">${reportKpi('Jumlah Kelas',classRows.length)}${reportKpi('Jumlah Murid',allRows.length)}${reportKpi('GPMP',avg==null?'—':formatWholePercent(avg))}${reportKpi('Intervensi Aktif',activeInt)}</div>
          <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${reportDistributionHtml('Perbandingan Purata Kelas (%)',classBars,100)}${reportDistributionHtml('Taburan Gred Murid',gradeDist)}</div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Ringkasan Mengikut Tahun</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${yearStats.map(x=>`<div class="rounded-xl border border-slate-200 p-4"><p class="text-[10px] font-black text-emerald-700">TAHUN ${x.year}</p><p class="text-xl font-black mt-1">${x.avg==null?'—':formatWholePercent(x.avg)}</p><p class="text-[10px] text-slate-500 mt-1">${x.students} murid · ${x.classes} kelas</p></div>`).join('')}</div></div>
          <div class="mt-5"><h3 class="text-xs font-black text-slate-800 mb-2">Analisis Kelas</h3><div class="overflow-hidden rounded-xl border border-slate-200"><table class="w-full text-[10px]"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Kelas</th><th class="p-2">Murid</th><th class="p-2">Purata</th><th class="p-2">Menguasai</th><th class="p-2">PBD Lengkap</th><th class="p-2 text-left">Guru Sejarah</th></tr></thead><tbody>${classRows.map(c=>{const sr=c.rows.filter(r=>r.avgMark!=null);return `<tr class="border-t border-slate-100"><td class="p-2 font-bold">${reportSafe(c.cls.name)}</td><td class="p-2 text-center">${c.students.length}</td><td class="p-2 text-center font-black">${c.avg==null?'—':formatWholePercent(c.avg)}</td><td class="p-2 text-center">${sr.length?formatWholePercent(c.mastery/sr.length*100):'—'}</td><td class="p-2 text-center">${formatWholePercent(c.completion)}</td><td class="p-2">${reportSafe(getTeacherName(c.cls.teacherId))}</td></tr>`}).join('')}</tbody></table></div></div>
          <div class="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-[10px] text-indigo-900"><b>Tempoh PBD:</b> ${reportSafe(periodName)}. Semua statistik dijana daripada rekod markah dan PBD semasa dalam sistem; rekod kosong tidak dianggap sebagai markah 0.</div>
          ${reportFooterHtml()}`;
        return {type:'PANITIA',title:'Laporan Panitia Sejarah',html,data:{classRows,allRows,avg,gradeDist,classBars,yearStats,academicYear,year,period}};
    }

    function generateReportPreview() {
        const type=document.getElementById('report-type')?.value||'INDIVIDU';
        const ay=document.getElementById('report-academic-year')?.value||'2026';
        const year=document.getElementById('report-year')?.value||'ALL';
        const classId=document.getElementById('report-class')?.value||'ALL';
        const studentId=document.getElementById('report-student')?.value||'';
        const period=document.getElementById('report-pbd-period')?.value||'PERTENGAHAN';
        let payload=null;
        if(type==='INDIVIDU') { if(!studentId){showAlert('Pilih Murid','Sila pilih murid untuk laporan individu.','info');return;} payload=buildIndividualReport(studentId,ay,period); }
        else if(type==='KELAS') { if(classId==='ALL'){showAlert('Pilih Kelas','Sila pilih satu kelas untuk laporan kelas.','info');return;} payload=buildClassReport(classId,ay,period); }
        else payload=buildPanitiaReport(ay,year,period);
        if(!payload){showAlert('Tiada Data','Laporan tidak dapat dijana untuk skop ini.','info');return;}
        currentReportPayload=payload;
        const area=document.getElementById('report-print-area'); area.innerHTML=payload.html;
        arrangeReportPreviewPages(area);
        lucide.createIcons();
    }

    function arrangeReportPreviewPages(area) {
        if(!area)return;
        const nodes=[...area.childNodes];
        const segments=[[]];
        nodes.forEach(node=>{
            if(node.nodeType===1&&node.classList.contains('report-page-break'))segments.push([]);
            else segments.at(-1).push(node);
        });
        area.replaceChildren();
        area.classList.add('report-page-stack');
        segments.filter(segment=>segment.some(node=>node.nodeType!==3||node.textContent.trim())).forEach((segment,index)=>{
            const sheet=document.createElement('section');
            sheet.className='report-sheet';
            sheet.dataset.reportPage=String(index+1);
            segment.forEach(node=>sheet.appendChild(node));
            const number=document.createElement('div');
            number.className='report-sheet-number';
            number.textContent=`Halaman ${index+1}`;
            sheet.appendChild(number);
            area.appendChild(sheet);
        });
    }

    async function captureReportPreviewSheets() {
        const area=document.getElementById('report-print-area');
        if(!area||typeof html2canvas==='undefined')throw new Error('Enjin paparan laporan tidak tersedia.');
        let sheets=[...area.querySelectorAll(':scope > .report-sheet')];
        if(!sheets.length){arrangeReportPreviewPages(area);sheets=[...area.querySelectorAll(':scope > .report-sheet')];}
        if(document.fonts?.ready)await document.fonts.ready;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const canvases=[];
        for(const sheet of sheets){
            const canvas=await html2canvas(sheet,{
                scale:2,
                useCORS:true,
                allowTaint:false,
                backgroundColor:'#ffffff',
                logging:false,
                scrollX:0,
                scrollY:-window.scrollY,
                width:sheet.offsetWidth,
                height:sheet.scrollHeight
            });
            canvases.push(canvas);
        }
        return canvases;
    }

    async function downloadCurrentReportPdf() {
        if(!currentReportPayload) generateReportPreview();
        if(!currentReportPayload) return;
        if(typeof html2canvas==='undefined' || !window.jspdf?.jsPDF){ showAlert('Library PDF Tidak Tersedia','Gunakan butang Cetak dan pilih Save as PDF.','info'); return; }
        try {
            const canvases=await captureReportPreviewSheets();
            const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4');
            for(let index=0;index<canvases.length;index++){
                const canvas=canvases[index],imgData=canvas.toDataURL('image/png');
                const pageW=210,pageH=297,scale=Math.min(pageW/canvas.width,pageH/canvas.height),renderW=canvas.width*scale,renderH=canvas.height*scale,x=(pageW-renderW)/2,y=(pageH-renderH)/2;
                if(index>0)pdf.addPage('a4','portrait');
                pdf.addImage(imgData,'PNG',x,y,renderW,renderH,'FAST');
            }
            pdf.save(`${currentReportPayload.title.replace(/[^a-z0-9]+/gi,'_')}_${todayIsoLocal()}.pdf`);
        } catch(err){ console.error(err); showAlert('PDF Gagal Dijana','Cuba gunakan fungsi Cetak → Save as PDF.','danger'); }
    }

    async function printCurrentReport() {
        if(!currentReportPayload)generateReportPreview();
        if(!currentReportPayload)return;
        if(typeof html2canvas==='undefined'){showAlert('Enjin Cetakan Tidak Tersedia','Sila muat semula halaman dan cuba lagi.','danger');return;}
        const win=window.open('','_blank','width=900,height=950');
        if(!win){showAlert('Pop-up Disekat','Benarkan pop-up untuk membuka paparan cetakan A4.','danger');return;}
        win.document.write('<!doctype html><html><head><title>Menyediakan cetakan…</title></head><body style="font-family:Arial;padding:24px;color:#475569">Menyediakan halaman A4 berdasarkan pratonton…</body></html>');
        win.document.close();
        try{
            const canvases=await captureReportPreviewSheets();
            const title=reportSafe(currentReportPayload.title);
            const pages=canvases.map((canvas,index)=>`<section class="print-page"><img src="${canvas.toDataURL('image/png')}" alt="${title} — Halaman ${index+1}"></section>`).join('');
            win.document.open();
            win.document.write(`<!doctype html><html lang="ms"><head><meta charset="utf-8"><title>${title}</title><style>
              @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.print-page{width:210mm;height:297mm;margin:0;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;break-after:page;page-break-after:always}.print-page:last-child{break-after:auto;page-break-after:auto}.print-page img{display:block;width:210mm;height:297mm;object-fit:contain;object-position:center;background:#fff}@media screen{body{background:#dbe3ee;padding:20px}.print-page{margin:0 auto 20px;box-shadow:0 8px 30px rgba(15,23,42,.18)}}@media print{body{background:#fff!important}.print-page{box-shadow:none!important;margin:0!important}}
            </style></head><body>${pages}</body></html>`);
            win.document.close();win.focus();setTimeout(()=>win.print(),500);
        }catch(err){console.error(err);win.close();showAlert('Cetakan Gagal Dijana','Paparan pratonton tidak dapat dirakam. Cuba muat semula halaman.','danger');}
    }

    function reportRowsForWorkbook(payload) {
        if(!payload) return [];
        if(payload.type==='INDIVIDU') { const d=payload.data; return [
            ['LAPORAN PRESTASI INDIVIDU'],['Nama',d.student.name],['Kelas',d.cls?.name||''],['Purata Markah',d.avgMark==null?'':d.avgMark],['Purata Kelas',d.classAverage??''],['TP Pertengahan',d.midOverall?.overallTP||''],['TP Akhir',d.endOverall?.overallTP||''],['ETR',d.headcount?.etr??''],['Status Sasaran',d.headcount?.status||''],['Near Miss',d.nearMiss?.nearMiss?`Perlu +${d.nearMiss.gap} ke Gred ${d.nearMiss.targetGrade}`:'Tiada'],
            [],['PERBANDINGAN MARKAH'],['Ujian','Markah','Peratus','Gred','Catatan'],...d.markRows.map(x=>[x.assessment.name,x.score.absent?'TH':x.score.rawScore,x.score.percentage??'',x.score.grade||'',x.score.teacherNote||'']),
            [],['HEADCOUNT'],['TOV',d.headcount?.toy?.value??''],['OT1',d.headcount?.oti1??''],['UPSA / AR1',d.headcount?.ar1?.value??''],['OT2',d.headcount?.oti2??''],['UASA / AR2',d.headcount?.ar2?.value??''],['ETR',d.headcount?.etr??''],
            [],['PROGRESSION PBD'],['SP','Standard Pembelajaran','Pertengahan','Akhir','Perubahan','Status Data'],...d.pbdProgress.map(x=>[x.dskp.standardLearningCode,x.dskp.standardLearningText,x.mid?.tp||'',x.end?.tp||'',x.delta??'',x.status]),
            [],['INTERVENSI'],['Isu','Strategi','Tarikh Mula','Tarikh Semakan','Progress','Status','Hasil/Catatan'],...d.interventions.map(r=>[r.issue||'',interventionStrategyLabels[r.strategy]||r.customStrategy||r.strategy||'',r.startDate||'',r.followUpDate||r.reviewDate||'',r.progress||0,r.status||'',r.result||r.teacherNote||''])
        ]; }
        if(payload.type==='KELAS') return [['Nama Murid','GPMP','Gred','Purata PBD','TP Keseluruhan','Intervensi Aktif'],...payload.data.rows.map(r=>[r.student.name,r.avgMark??'',r.grade,r.avgTp??'',r.overallTp??'',r.activeInterventions])];
        return [['Kelas','Tahun','Jumlah Murid','GPMP','Kadar Menguasai','PBD Lengkap','Guru Sejarah'],...payload.data.classRows.map(c=>{const sr=c.rows.filter(r=>r.avgMark!=null);return[c.cls.name,c.cls.year,c.students.length,c.avg??'',sr.length?c.mastery/sr.length*100:'',c.completion,getTeacherName(c.cls.teacherId)]})];
    }

    function exportCurrentReportXlsx() {
        if(!currentReportPayload) generateReportPreview(); if(!currentReportPayload)return;
        if(typeof XLSX==='undefined'){showAlert('Excel Tidak Tersedia','Library XLSX gagal dimuatkan.','danger');return;}
        const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet(reportRowsForWorkbook(currentReportPayload)); XLSX.utils.book_append_sheet(wb,ws,'Laporan'); XLSX.writeFile(wb,`${currentReportPayload.title.replace(/[^a-z0-9]+/gi,'_')}_${todayIsoLocal()}.xlsx`);
    }

    function initializeImportExport() {
        const ay=document.getElementById('export-academic-year'); const global=document.getElementById('filter-academic-year')?.value||'2026'; if(ay&&[...ay.options].some(o=>o.value===global))ay.value=global; refreshImportExportSummary(); lucide.createIcons();
    }

    function getPhase9ExportBundle() {
        const ay=document.getElementById('export-academic-year')?.value||'2026'; const classes=getPhase9PermittedClasses(ay); const classIds=new Set(classes.map(c=>c.id)); const students=sortStudentsAZ(appState.students.filter(s=>classIds.has(s.classId)&&String(s.academicYear||ay)===String(ay))); const studentIds=new Set(students.map(s=>s.id));
        const assessments=appState.assessments.filter(a=>classIds.has(a.classId)&&String(a.academicYear)===String(ay)); const assessmentIds=new Set(assessments.map(a=>a.id));
        const scores=getActualScoreRecords().filter(s=>studentIds.has(s.studentId)&&assessmentIds.has(s.assessmentId)); const pbd=appState.pbdRecords.filter(r=>studentIds.has(r.studentId)&&String(r.academicYear||ay)===String(ay)); const interventions=(appState.interventions||[]).filter(r=>studentIds.has(r.studentId)&&String(r.academicYear)===String(ay)); const dskp=appState.dskp.filter(d=>d.active!==false); return {ay,classes,students,assessments,scores,pbd,interventions,dskp};
    }

    function refreshImportExportSummary() { const b=getPhase9ExportBundle(); const map={students:b.students.length,scores:b.scores.length,pbd:b.pbd.length,interventions:b.interventions.length,dskp:b.dskp.length}; Object.entries(map).forEach(([k,v])=>{const el=document.getElementById(`export-count-${k}`);if(el)el.textContent=v;}); }

    function sheetRowsStudents(b){return b.students.map(s=>({ID:s.id,Nama:s.name,Tahun:s.year,Kelas:getClassName(s.classId),Jantina:s.gender||'',Status:s.status||'',Sesi:phase9AyLabel(s.academicYear||b.ay)}));}
    function sheetRowsMarks(b){const amap=new Map(b.assessments.map(a=>[a.id,a]));return b.scores.map(sc=>{const st=appState.students.find(s=>s.id===sc.studentId),a=amap.get(sc.assessmentId);return{Nama_Murid:st?.name||'',Kelas:getClassName(st?.classId),Pentaksiran:a?.name||'',Jenis:a?.type||'',Tarikh:a?.date||'',Markah:sc.absent?'TH':sc.rawScore??'',Markah_Maksimum:a?.maxScore??'',Peratus:sc.percentage??'',Gred:sc.grade||'',Tidak_Hadir:sc.absent?'YA':'TIDAK',Catatan:sc.teacherNote||''};});}
    function sheetRowsPbd(b){return b.pbd.map(r=>{const st=appState.students.find(s=>s.id===r.studentId),d=appState.dskp.find(x=>x.id===r.dskpId);return{Nama_Murid:st?.name||'',Kelas:getClassName(st?.classId),Tempoh:r.assessmentPeriod||'',Kod_SP:d?.standardLearningCode||'',Standard_Pembelajaran:d?.standardLearningText||'',TP:r.tp||'',Tarikh:r.assessmentDate||'',Evidens:r.evidence||'',Catatan:r.teacherNote||''};});}
    function sheetRowsInterventions(b){return b.interventions.map(r=>{const st=appState.students.find(s=>s.id===r.studentId);return{Nama_Murid:st?.name||'',Kelas:getClassName(st?.classId),Keutamaan:r.priority||'',Isu:r.issue||'',Strategi:interventionStrategyLabels[r.strategy]||r.customStrategy||r.strategy||'',Tarikh_Mula:r.startDate||'',Tarikh_Susulan:r.followupDate||'',Status:r.status||'',Kemajuan:r.progress??'',Sasaran:r.target||'',Catatan:r.teacherNote||''};});}
    function sheetRowsDskp(b){return b.dskp.map(d=>({Tahun:d.yearLevel,Tema:d.themeName||'',Unit:d.unitName||'',Kod_SK:d.standardContentCode||'',Standard_Kandungan:d.standardContentText||'',Kod_SP:d.standardLearningCode||'',Standard_Pembelajaran:d.standardLearningText||'',TP1:d.performanceStandards?.[1]||'',TP2:d.performanceStandards?.[2]||'',TP3:d.performanceStandards?.[3]||'',TP4:d.performanceStandards?.[4]||'',TP5:d.performanceStandards?.[5]||'',TP6:d.performanceStandards?.[6]||''}));}

    function exportPhase9Workbook(dataset='ALL') {
        if(typeof XLSX==='undefined'){showAlert('Excel Tidak Tersedia','Library XLSX gagal dimuatkan.','danger');return;}
        const b=getPhase9ExportBundle(); const wb=XLSX.utils.book_new(); const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name);
        if(dataset==='ALL'||dataset==='STUDENTS')add('Murid',sheetRowsStudents(b)); if(dataset==='ALL'||dataset==='MARKS')add('Markah',sheetRowsMarks(b)); if(dataset==='ALL'||dataset==='PBD')add('PBD',sheetRowsPbd(b)); if(dataset==='ALL'||dataset==='INTERVENTIONS')add('Intervensi',sheetRowsInterventions(b)); if(dataset==='ALL'||dataset==='DSKP')add('DSKP',sheetRowsDskp(b));
        XLSX.writeFile(wb,`${dataset==='ALL'?'Data_Sejarah_Lengkap':dataset}_${phase9AyLabel(b.ay).replace('/','-')}_${todayIsoLocal()}.xlsx`);
    }

    function downloadPhase9BackupJson() {
        const b=getPhase9ExportBundle(); const payload={exportedAt:new Date().toISOString(),mode:'DEMO_LOCAL_STATE',schoolProfile:phase9SchoolProfile,academicYear:b.ay,classes:b.classes,students:b.students,assessments:b.assessments,scores:b.scores,dskp:b.dskp,pbdRecords:b.pbd,interventions:b.interventions,pbdOverall:appState.pbdOverall.filter(o=>b.students.some(s=>s.id===o.studentId))}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Backup_Sejarah_${b.ay}_${todayIsoLocal()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }

    function previewAcademicSessionSetting(){
        const input=document.getElementById('settings-active-session-year');
        const preview=document.getElementById('settings-active-session-preview');
        const labelField=document.getElementById('settings-session-label');
        const value=String(input?.value||'').trim();
        const label=/^\d{4}$/.test(value)?phase9AyLabel(value):'—';
        if(preview)preview.textContent=label;
        if(labelField)labelField.value=label==='—'?'':label;
    }

    function getSelectedHeadcountMethodSetting(){
        return document.querySelector('input[name="settings-hc-method"]:checked')?.value==='METHOD2'
            ? 'METHOD2'
            : 'METHOD1';
    }

    function onHeadcountMethodSettingChange(preview=true){
        const method=getSelectedHeadcountMethodSetting();
        const method1=document.getElementById('settings-hc-method1-panel');
        const method2=document.getElementById('settings-hc-method2-panel');
        const badge=document.getElementById('settings-hc-method-badge');
        method1?.classList.toggle('hidden',method!=='METHOD1');
        method2?.classList.toggle('hidden',method!=='METHOD2');
        if(badge)badge.textContent=method==='METHOD2'?'KAEDAH 2':'KAEDAH 1';

        ['settings-hc-oti1','settings-hc-oti2','settings-hc-etr'].forEach(id=>{
            const el=document.getElementById(id);
            if(el)el.disabled=method!=='METHOD1';
        });

        if(preview){
            const old=phase9SchoolProfile.headcountMethod;
            phase9SchoolProfile.headcountMethod=method;
            try{
                if(typeof renderHeadcount==='function'&&!document.getElementById('view-headcount')?.classList.contains('hidden'))renderHeadcount();
                if(typeof renderDashboardGpmpSummary==='function')renderDashboardGpmpSummary();
            }finally{
                phase9SchoolProfile.headcountMethod=old;
            }
        }
    }

    function initializePhase9Settings() {
        phase10SetStatus(phase10Mode);
        if(!isAdminSession()){showAlert('Akses Ditolak','Tetapan sistem hanya tersedia kepada Admin (KP Sejarah).','danger');return;}
        const set=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val??'';};
        set('settings-school-name',phase9SchoolProfile.schoolName);
        set('settings-school-code',phase9SchoolProfile.schoolCode);
        set('settings-school-address',phase9SchoolProfile.address);
        set('settings-panitia-head',phase9SchoolProfile.panitiaHead);
        set('settings-headteacher',phase9SchoolProfile.headteacher);
        set('settings-session-label',phase9AyLabel(getActiveAcademicYear()));
        set('settings-report-footer',phase9SchoolProfile.reportFooter);
        set('settings-active-session-year',getActiveAcademicYear());
        set('settings-past-sessions',(phase9SchoolProfile.pastAcademicYears||[]).join(', '));
        set('settings-near-miss-margin',phase9SchoolProfile.nearMissMargin||5);
        set('settings-hc-oti1',phase9SchoolProfile.headcountIncrements?.oti1 ?? 3);
        set('settings-hc-oti2',phase9SchoolProfile.headcountIncrements?.oti2 ?? 3);
        set('settings-hc-etr',phase9SchoolProfile.headcountIncrements?.etr ?? 4);
        const hcMethod=phase9SchoolProfile.headcountMethod==='METHOD2'?'METHOD2':'METHOD1';
        const hcMethodRadio=document.getElementById(hcMethod==='METHOD2'?'settings-hc-method-2':'settings-hc-method-1');
        if(hcMethodRadio)hcMethodRadio.checked=true;
        onHeadcountMethodSettingChange(false);
        renderEntryControlSettings();
        const preview=document.getElementById('settings-active-session-preview');
        if(preview)preview.textContent=phase9AyLabel(getActiveAcademicYear());
        document.getElementById('settings-hard-reset-card')?.classList.toggle('hidden',!isAdminSession());
        renderPhase9LogoPreview();
        lucide.createIcons();
    }

    function renderPhase9LogoPreview(){const el=document.getElementById('settings-logo-preview');if(!el)return;el.innerHTML=phase9SchoolProfile.logoDataUrl?`<img src="${phase9SchoolProfile.logoDataUrl}" class="w-full h-full object-contain p-2" alt="Logo sekolah">`:'<span class="text-3xl font-black">S</span>';}
    function handlePhase9LogoUpload(event){const file=event.target.files?.[0];if(!file)return;if(file.size>1024*1024){showAlert('Fail Terlalu Besar','Gunakan logo PNG/JPG kurang daripada 1MB untuk mod demo.','info');event.target.value='';return;}const reader=new FileReader();reader.onload=()=>{phase9SchoolProfile.logoDataUrl=reader.result;renderPhase9LogoPreview();};reader.readAsDataURL(file);}
    function clearPhase9Logo(){phase9SchoolProfile.logoDataUrl='';const input=document.getElementById('settings-logo-input');if(input)input.value='';renderPhase9LogoPreview();}

    function savePhase9SchoolProfile(){
        if(!isAdminSession()){showAlert('Tiada Kebenaran','Hanya Admin (KP Sejarah) boleh mengubah tetapan sistem.','danger');return;}
        const val=id=>document.getElementById(id)?.value.trim()||'';
        if(!val('settings-school-name')){showAlert('Nama Sekolah Diperlukan','Sila masukkan nama sekolah.','info');return;}
        const active=val('settings-active-session-year');
        if(!/^\d{4}$/.test(active)){showAlert('Sesi Tidak Sah','Masukkan tahun mula sesi aktif, contoh 2026.','info');return;}
        const pastRaw=val('settings-past-sessions').split(',').map(x=>x.trim()).filter(Boolean);
        const past=[...new Set(pastRaw.filter(x=>/^\d{4}$/.test(x)&&x!==active))].sort((a,b)=>Number(b)-Number(a));
        const margin=Math.max(1,Math.min(20,Number(val('settings-near-miss-margin'))||5));
        const headcountMethod=getSelectedHeadcountMethodSetting();
        const headcountIncrements={
            oti1:Math.max(0,Math.min(30,Number(val('settings-hc-oti1'))||0)),
            oti2:Math.max(0,Math.min(30,Number(val('settings-hc-oti2'))||0)),
            etr:Math.max(0,Math.min(30,Number(val('settings-hc-etr'))||0))
        };
        const entryControls={};
        ['DIAGNOSTIK','UPSA','UASA'].forEach(type=>{
            entryControls[type]={
                marks:document.getElementById(`entry-${type}-marks`)?.checked===true,
                pbd:document.getElementById(`entry-${type}-pbd`)?.checked===true
            };
        });

        phase9SchoolProfile={
            ...phase9SchoolProfile,
            schoolName:val('settings-school-name'),
            schoolCode:val('settings-school-code'),
            address:val('settings-school-address'),
            panitiaHead:val('settings-panitia-head'),
            headteacher:val('settings-headteacher'),
            activeAcademicYear:active,
            pastAcademicYears:past,
            nearMissMargin:margin,
            headcountMethod,
            headcountIncrements,
            entryControls,
            sessionLabel:phase9AyLabel(active),
            reportFooter:val('settings-report-footer')
        };
        persistPhase9State();
        if(phase10Mode==='SUPABASE'&&phase10Db&&phase10SignedInUser){
            phase10Upsert('settings','school',phase9SchoolProfile).catch(err=>console.error('Settings sync:',err));
        }
        updatePhase9Branding();
        populateAcademicSessionSelectors(false);
        initializePhase9Settings();
        if(typeof renderHeadcount==='function'&&!document.getElementById('view-headcount')?.classList.contains('hidden'))renderHeadcount();
        if(typeof renderDashboardGpmpSummary==='function')renderDashboardGpmpSummary();
        if(typeof updateDashboardKPIs==='function')updateDashboardKPIs();
        showAlert('Tetapan Disimpan',`Sesi akademik aktif kini ${phase9AyLabel(active)}. Kaedah Headcount ${headcountMethod==='METHOD2'?'2':'1'} digunakan dan semua paparan berkaitan telah diselaraskan.`,'success');
    }

    function hardResetSystem(){
        if(!isAdminSession()){showAlert('Akses Ditolak','Hard Reset hanya untuk Admin (KP Sejarah).','danger');return;}
        const phrase=window.prompt('HARD RESET akan memadam semua data semasa tersimpan pada pelayar ini. Taip RESET SEMUA untuk meneruskan.');
        if(phrase!=='RESET SEMUA'){showAlert('Hard Reset Dibatalkan','Frasa pengesahan tidak sepadan. Tiada data dipadam.','info');return;}
        const keys=[];
        for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('sejarah_'))keys.push(k);}
        keys.forEach(k=>localStorage.removeItem(k));
        showAlert('Hard Reset Berjaya','Semua data tersimpan telah dipadam. Sistem akan dimuat semula kepada data semasa asal.','success',()=>window.location.reload());
    }


    // ==============================================================
    // ENHANCED CLASS COMPARISON ANALYTICS
    // ==============================================================
    function classCompareAllowedClasses() {
        const academicYear = document.getElementById('class-compare-session')?.value || document.getElementById('filter-academic-year')?.value || '2026';
        const yearLevel = document.getElementById('class-compare-year')?.value || 'ALL';
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (currentUserRole === 'GURU_SEJARAH') classes = classes.filter(c => c.teacherId === currentUserId);
        if (yearLevel !== 'ALL') classes = classes.filter(c => String(c.year) === String(yearLevel));
        return classes;
    }

    function classCompareStudentAverages(studentIds, assessmentIds) {
        const byStudent = new Map();
        appState.scores
            .filter(s => studentIds.has(s.studentId) && assessmentIds.has(s.assessmentId) && !s.absent && s.percentage !== null && s.percentage !== undefined && !isNaN(Number(s.percentage)))
            .forEach(s => {
                if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, []);
                byStudent.get(s.studentId).push(Number(s.percentage));
            });
        const averages = [];
        byStudent.forEach((vals, studentId) => averages.push({ studentId, average: vals.reduce((a,b)=>a+b,0)/vals.length }));
        return averages;
    }

    function classCompareMetricsForClass(cls) {
        const academicYear = document.getElementById('class-compare-session')?.value || '2026';
        const assessmentType = document.getElementById('class-compare-assessment-type')?.value || 'ALL';
        const period = document.getElementById('class-compare-period')?.value || 'PERTENGAHAN';

        const students = sortStudentsAZ(appState.students.filter(s => s.status === 'Aktif' && s.classId === cls.id && String(s.academicYear || academicYear) === String(academicYear)));
        const studentIds = new Set(students.map(s => s.id));

        const assessments = appState.assessments.filter(a =>
            a.classId === cls.id &&
            String(a.academicYear || academicYear) === String(academicYear) &&
            (assessmentType === 'ALL' || a.type === assessmentType)
        );
        const assessmentIds = new Set(assessments.map(a => a.id));
        const studentAverages = classCompareStudentAverages(studentIds, assessmentIds);
        const classAverage = studentAverages.length ? studentAverages.reduce((a,b)=>a+b.average,0)/studentAverages.length : null;
        const mastered = studentAverages.filter(x => isMasteredMark(x.average)).length;
        const masteryRate = studentAverages.length ? mastered / studentAverages.length * 100 : null;

        const gradeCounts = {};
        studentAverages.forEach(x => {
            const g = calculateGrade(x.average);
            if (g && g !== '-') gradeCounts[g] = (gradeCounts[g] || 0) + 1;
        });
        const dominantGrade = Object.entries(gradeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

        const dskp = appState.dskp.filter(d => d.active !== false && Number(d.yearLevel) === Number(cls.year));
        const dskpIds = new Set(dskp.map(d => d.id));
        const pbdRecords=getEffectivePbdRecordsForScope(
            studentIds,
            dskpIds,
            academicYear,
            period
        );
        const uniquePbd = new Map();
        pbdRecords.forEach(r => uniquePbd.set(`${r.studentId}_${r.dskpId}`, r));
        const expectedPbd = students.length * dskp.length;
        const pbdCompletion = expectedPbd ? Math.min(100, uniquePbd.size / expectedPbd * 100) : null;
        const tpValues = [...uniquePbd.values()].map(r => Number(r.tp)).filter(v => v >= 1 && v <= 6);
        const avgTp = tpValues.length ? tpValues.reduce((a,b)=>a+b,0)/tpValues.length : null;
        const tpCounts = {};
        tpValues.forEach(tp => tpCounts[tp] = (tpCounts[tp] || 0) + 1);
        const dominantTp = Object.entries(tpCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;

        const activeInterventions = (appState.interventions || []).filter(i =>
            studentIds.has(i.studentId) &&
            String(i.academicYear || academicYear) === String(academicYear) &&
            i.status !== 'SELESAI'
        ).length;

        return {
            classId: cls.id,
            className: cls.name,
            year: cls.year,
            teacherId: cls.teacherId,
            teacherName: mockTeachers.find(t => t.id === cls.teacherId)?.name || 'Belum Ditugaskan',
            studentCount: students.length,
            assessmentCount: assessments.length,
            markDataStudents: studentAverages.length,
            average: classAverage,
            masteryRate,
            dominantGrade,
            pbdCompletion,
            avgTp,
            dominantTp,
            interventionCount: activeInterventions
        };
    }

    function initializeClassComparison() {
        const session = document.getElementById('class-compare-session');
        const year = document.getElementById('class-compare-year');
        const type = document.getElementById('class-compare-assessment-type');
        const period = document.getElementById('class-compare-period');
        if (!session || !year || !type || !period) return;

        session.value = document.getElementById('filter-academic-year')?.value || '2026';
        year.value = document.getElementById('filter-tahun')?.value || 'ALL';

        const previousType = type.value || 'ALL';
        type.innerHTML = '<option value="ALL">Semua Pentaksiran</option>' +
            assessmentTypes.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
        if ([...type.options].some(o => o.value === previousType)) type.value = previousType;

        const pbdPeriod = document.getElementById('pbd-period')?.value || 'PERTENGAHAN';
        if ([...period.options].some(o => o.value === pbdPeriod)) period.value = pbdPeriod;
        renderClassComparison();
    }

    function renderClassComparison() {
        const classes = classCompareAllowedClasses();
        let metrics = classes.map(classCompareMetricsForClass);
        const sortMode = document.getElementById('class-compare-sort')?.value || 'AVG_DESC';

        const valueOrNeg = v => v === null || v === undefined ? -Infinity : v;
        metrics.sort((a,b) => {
            if (sortMode === 'MASTERY_DESC') return valueOrNeg(b.masteryRate)-valueOrNeg(a.masteryRate);
            if (sortMode === 'PBD_DESC') return valueOrNeg(b.pbdCompletion)-valueOrNeg(a.pbdCompletion);
            if (sortMode === 'INTERVENTION_ASC') return a.interventionCount-b.interventionCount || valueOrNeg(b.average)-valueOrNeg(a.average);
            if (sortMode === 'NAME_ASC') return a.className.localeCompare(b.className);
            return valueOrNeg(b.average)-valueOrNeg(a.average);
        });

        const allStudents = metrics.reduce((sum,m)=>sum+m.studentCount,0);
        const markMetrics = metrics.filter(m=>m.average !== null);
        const overallAvg = markMetrics.length ? markMetrics.reduce((s,m)=>s+m.average,0)/markMetrics.length : null;
        const masteryMetrics = metrics.filter(m=>m.masteryRate !== null);
        const overallMastery = masteryMetrics.length ? masteryMetrics.reduce((s,m)=>s+m.masteryRate,0)/masteryMetrics.length : null;
        const pbdMetrics = metrics.filter(m=>m.pbdCompletion !== null);
        const overallPbd = pbdMetrics.length ? pbdMetrics.reduce((s,m)=>s+m.pbdCompletion,0)/pbdMetrics.length : null;
        const interventions = metrics.reduce((s,m)=>s+m.interventionCount,0);

        const setText = (id, val) => { const e=document.getElementById(id); if(e)e.textContent=val; };
        setText('class-compare-kpi-classes', metrics.length);
        setText('class-compare-kpi-students', allStudents);
        setText('class-compare-kpi-average', overallAvg === null ? '—' : formatWholePercent(overallAvg));
        setText('class-compare-kpi-mastery', overallMastery === null ? '—' : formatWholePercent(overallMastery));
        setText('class-compare-kpi-pbd', overallPbd === null ? '—' : formatWholePercent(overallPbd));
        setText('class-compare-kpi-intervention', interventions);

        const insights = document.getElementById('class-compare-insights');
        if (insights) {
            const bestAvg = [...metrics].filter(m=>m.average!==null).sort((a,b)=>b.average-a.average)[0];
            const bestPbd = [...metrics].filter(m=>m.pbdCompletion!==null).sort((a,b)=>b.pbdCompletion-a.pbdCompletion)[0];
            const support = [...metrics].filter(m=>m.average!==null || m.interventionCount>0)
                .sort((a,b)=>(valueOrNeg(a.average)-valueOrNeg(b.average)) || (b.interventionCount-a.interventionCount))[0];
            const insightCard = (icon,title,value,desc,classesCss) => `
                <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-3">
                    <div class="p-2 rounded-lg ${classesCss}"><i data-lucide="${icon}" class="w-4 h-4"></i></div>
                    <div class="min-w-0"><p class="text-[10px] font-black uppercase tracking-wider text-slate-400">${title}</p><p class="font-extrabold text-slate-800 mt-0.5 truncate">${value}</p><p class="text-[10px] text-slate-500 mt-1">${desc}</p></div>
                </div>`;
            insights.innerHTML =
                insightCard('trophy','GPMP Tertinggi', bestAvg?.className || 'Belum cukup data', bestAvg ? `${formatWholePercent(bestAvg.average)} berdasarkan ${bestAvg.markDataStudents} murid dengan markah` : 'Tiada markah tersedia', 'bg-amber-50 text-amber-600') +
                insightCard('clipboard-check','PBD Paling Lengkap', bestPbd?.className || 'Belum cukup data', bestPbd ? `${formatWholePercent(bestPbd.pbdCompletion)} lengkap` : 'Tiada rekod PBD tersedia', 'bg-emerald-50 text-emerald-600') +
                insightCard('heart-handshake','Perlu Perhatian', support?.className || 'Tiada kelas ditanda', support ? `${support.interventionCount} intervensi aktif · ${support.average===null?'tiada markah':formatWholePercent(support.average)+' purata'}` : 'Tiada data yang memerlukan perhatian', 'bg-rose-50 text-rose-600');
        }

        const tbody = document.getElementById('class-compare-table-body');
        const empty = document.getElementById('class-compare-empty');
        if (tbody) {
            tbody.innerHTML = metrics.map((m,idx) => {
                const rankBadge = idx < 3 && m.average !== null ? `<span class="w-6 h-6 inline-flex items-center justify-center rounded-full ${idx===0?'bg-amber-100 text-amber-700':idx===1?'bg-slate-200 text-slate-700':'bg-orange-100 text-orange-700'} font-black text-[10px]">${idx+1}</span>` : `<span class="text-slate-400">${idx+1}</span>`;
                const avg = m.average===null?'—':formatWholePercent(m.average);
                const mastery = m.masteryRate===null?'—':formatWholePercent(m.masteryRate);
                const pbd = m.pbdCompletion===null?'—':formatWholePercent(m.pbdCompletion);
                const tp = m.dominantTp ? `TP${m.dominantTp}` : '—';
                return `<tr class="hover:bg-slate-50/70">
                    <td class="px-4 py-3">${rankBadge}</td>
                    <td class="px-4 py-3"><p class="font-bold text-slate-800">${escapeHtml(m.className)}</p><p class="text-[10px] text-slate-500">Tahun ${m.year}</p></td>
                    <td class="px-4 py-3 text-slate-600">${escapeHtml(m.teacherName)}</td>
                    <td class="px-4 py-3 font-semibold">${m.studentCount}</td>
                    <td class="px-4 py-3">${m.assessmentCount}</td>
                    <td class="px-4 py-3 font-black ${m.average!==null && isMasteredMark(m.average)?'text-emerald-700':'text-slate-700'}">${avg}</td>
                    <td class="px-4 py-3">${mastery}</td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">${m.dominantGrade}</span></td>
                    <td class="px-4 py-3">${pbd}</td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">${tp}</span></td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full ${m.interventionCount?'bg-rose-50 text-rose-700':'bg-emerald-50 text-emerald-700'} text-[10px] font-bold">${m.interventionCount}</span></td>
                    <td class="px-4 py-3 text-right"><div class="inline-flex gap-1"><button onclick="openClassInMarksAnalytics('${m.classId}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100">Markah</button><button onclick="openClassInPbdAnalytics('${m.classId}')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100">PBD</button></div></td>
                </tr>`;
            }).join('');
        }
        if (empty) empty.classList.toggle('hidden', metrics.length > 0);
        setText('class-compare-data-note', `${metrics.length} kelas · threshold menguasai ${appSettings.masteryThreshold}%`);

        renderClassComparisonCharts(metrics);
        lucide.createIcons();
    }

    function renderClassComparisonCharts(metrics) {
        const marksCanvas = document.getElementById('class-compare-marks-chart');
        const pbdCanvas = document.getElementById('class-compare-pbd-chart');
        if (!marksCanvas || !pbdCanvas || typeof Chart === 'undefined') return;
        if (classCompareMarksChartInstance) classCompareMarksChartInstance.destroy();
        if (classComparePbdChartInstance) classComparePbdChartInstance.destroy();

        const labels = metrics.map(m=>chartClassShortLabel(m.classId||m.className));
        classCompareMarksChartInstance = new Chart(marksCanvas, {
            type:'bar',
            data:{ labels, datasets:[
                {label:'GPMP (%)',data:metrics.map(m=>m.average===null?null:Number(m.average.toFixed(1))),backgroundColor:'#059669',borderRadius:6},
                {label:'Menguasai (%)',data:metrics.map(m=>m.masteryRate===null?null:Number(m.masteryRate.toFixed(1))),backgroundColor:'#6366F1',borderRadius:6}
            ]},
            options:{responsive:true,maintainAspectRatio:false,scales:{
                x:{ticks:{autoSkip:false,maxRotation:0,minRotation:0,font:{size:10}}},
                y:{beginAtZero:true,max:100}
            },plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,font:{size:10}}}}}
        });

        classComparePbdChartInstance = new Chart(pbdCanvas, {
            type:'bar',
            data:{ labels, datasets:[
                {label:'PBD Lengkap (%)',data:metrics.map(m=>m.pbdCompletion===null?null:Number(m.pbdCompletion.toFixed(1))),backgroundColor:'#8B5CF6',borderRadius:6,yAxisID:'y'},
                {label:'Purata TP',data:metrics.map(m=>m.avgTp===null?null:Number(m.avgTp.toFixed(2))),backgroundColor:'#F59E0B',borderRadius:6,yAxisID:'y1'}
            ]},
            options:{responsive:true,maintainAspectRatio:false,scales:{
                x:{ticks:{autoSkip:false,maxRotation:0,minRotation:0,font:{size:10}}},
                y:{beginAtZero:true,max:100,position:'left',title:{display:true,text:'Kelengkapan %'}},
                y1:{beginAtZero:true,max:6,position:'right',grid:{drawOnChartArea:false},title:{display:true,text:'Purata TP'}}
            },plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,font:{size:10}}}}}
        });
    }

    function openClassInMarksAnalytics(classId) {
        const cls = appState.classes.find(c=>c.id===classId); if(!cls)return;
        document.getElementById('filter-tahun').value=String(cls.year); onTahunChange();
        document.getElementById('filter-kelas').value=classId;
        navigateTab('analytics-marks');
        setTimeout(()=>{ const el=document.getElementById('analytics-class'); if(el && [...el.options].some(o=>o.value===classId)){el.value=classId; analyticsPopulateAssessmentOptions(); renderMarksAnalytics();}},50);
    }

    function openClassInPbdAnalytics(classId) {
        const cls = appState.classes.find(c=>c.id===classId); if(!cls)return;
        document.getElementById('filter-tahun').value=String(cls.year); onTahunChange();
        document.getElementById('filter-kelas').value=classId;
        navigateTab('analytics-pbd');
        setTimeout(()=>{ const el=document.getElementById('pbd-an-class'); if(el && [...el.options].some(o=>o.value===classId)){el.value=classId; pbdAnalyticsScopeChanged('class');}},80);
    }

    function exportClassComparisonCSV() {
        const metrics = classCompareAllowedClasses().map(classCompareMetricsForClass);
        if (!metrics.length) { showAlert('Tiada Data','Tiada kelas untuk dieksport dalam skop semasa.','info'); return; }
        const rows = [['Kelas','Tahun','Guru Sejarah','Jumlah Murid','Pentaksiran','GPMP','Kadar Menguasai','Gred Dominan','PBD Lengkap','Purata TP','TP Dominan','Intervensi Aktif']];
        metrics.forEach(m=>rows.push([m.className,m.year,m.teacherName,m.studentCount,m.assessmentCount,m.average===null?'':m.average.toFixed(1),m.masteryRate===null?'':m.masteryRate.toFixed(1),m.dominantGrade,m.pbdCompletion===null?'':m.pbdCompletion.toFixed(1),m.avgTp===null?'':m.avgTp.toFixed(2),m.dominantTp?`TP${m.dominantTp}`:'',m.interventionCount]));
        const csv = rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Analisis_Komparatif_Kelas_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }

    // ==============================================================
    // ENHANCED USER MANAGEMENT
    // ==============================================================
    function userRoleLabel(role) {
        return (role === 'ADMIN' || role === 'KETUA_PANITIA') ? 'Admin (KP Sejarah)' : 'Guru Sejarah';
    }

    function userRoleBadge(role) {
        return (role === 'ADMIN' || role === 'KETUA_PANITIA')
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';
    }

    function initializeUsers() {
        const addBtn=document.getElementById('btn-add-user');
        const alert=document.getElementById('users-permission-alert');
        const admin=currentUserRole==='ADMIN';
        if(addBtn){addBtn.disabled=!admin;addBtn.classList.toggle('opacity-50',!admin);addBtn.classList.toggle('cursor-not-allowed',!admin);}
        if(alert)alert.classList.toggle('hidden',admin);
        renderUsers();
    }

    function getAssignedClassesForUser(userId) {
        return appState.classes.filter(c=>c.teacherId===userId && c.active!==false);
    }

    function renderUsers() {
        const q=(document.getElementById('users-search')?.value||'').trim().toLowerCase();
        const role=document.getElementById('users-role-filter')?.value||'ALL';
        const status=document.getElementById('users-status-filter')?.value||'ALL';

        let users=[...mockTeachers];

        if(q){
            users=users.filter(u=>{
                const loginId=String(u.loginId||u.mykad||u.myKad||u.staffId||u.id||'').toLowerCase();
                return (u.name||'').toLowerCase().includes(q) || loginId.includes(q);
            });
        }

        if(role!=='ALL'){
            users=users.filter(u=>{
                const normalizedRole=u.role==='KETUA_PANITIA'?'ADMIN':u.role;
                return normalizedRole===role;
            });
        }

        if(status!=='ALL')users=users.filter(u=>(u.active!==false?'ACTIVE':'INACTIVE')===status);
        users.sort((a,b)=>(a.active===false)-(b.active===false)||(a.name||'').localeCompare(b.name||''));

        const all=mockTeachers;
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
        set('users-kpi-total',all.length);
        set('users-kpi-active',all.filter(u=>u.active!==false).length);
        set('users-kpi-admin',all.filter(u=>u.role==='ADMIN'||u.role==='KETUA_PANITIA').length);
        set('users-kpi-assigned',appState.classes.filter(c=>c.active!==false && c.teacherId).length);
        set('users-kpi-teachers',all.filter(u=>u.role==='GURU_SEJARAH').length);

        const tbody=document.getElementById('users-table-body');
        const empty=document.getElementById('users-empty-state');

        if(tbody){
            tbody.innerHTML=users.map(u=>{
                const assigned=getAssignedClassesForUser(u.id);
                const classesHtml=assigned.length
                    ? `<div class="users-class-list">${assigned.map(c=>`<span class="users-class-chip">${escapeHtml(c.name)}</span>`).join('')}</div>`
                    : '<span class="users-empty-class">Tiada kelas</span>';

                const initial=(u.name||'U').trim().charAt(0).toUpperCase();
                const isSelf=u.id===currentUserId;
                const canEdit=currentUserRole==='ADMIN';
                const normalizedRole=u.role==='KETUA_PANITIA'?'ADMIN':u.role;
                const loginId=normalizedRole==='ADMIN'
                    ? 'ADMIN'
                    : String(u.loginId||u.mykad||u.myKad||u.staffId||u.id||'—');

                return `<tr class="users-row ${u.active===false?'users-row-inactive':''}">
                    <td class="px-5 py-4">
                        <div class="users-person">
                            <div class="users-avatar">${escapeHtml(initial)}</div>
                            <div class="min-w-0">
                                <p class="users-name">${escapeHtml(u.name||'Tanpa Nama')}</p>
                                <p class="users-id">${escapeHtml(loginId)}${isSelf?' · Anda':''}</p>
                            </div>
                        </div>
                    </td>

                    <td class="px-4 py-4">
                        <span class="users-role-badge ${normalizedRole==='ADMIN'?'is-admin':'is-teacher'}">${escapeHtml(userRoleLabel(normalizedRole))}</span>
                    </td>

                    <td class="px-4 py-4">${classesHtml}</td>

                    <td class="px-4 py-4">
                        <span class="users-status-badge ${u.active!==false?'is-active':'is-inactive'}">
                            <span class="users-status-dot"></span>${u.active!==false?'Aktif':'Tidak Aktif'}
                        </span>
                    </td>

                    <td class="px-5 py-4 text-right">
                        <div class="users-actions">
                            <button ${canEdit?'':'disabled'} onclick="editUser('${u.id}')" class="users-action-btn is-edit ${canEdit?'':'is-disabled'}" title="Edit pengguna" aria-label="Edit pengguna">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button ${canEdit&&!isSelf?'':'disabled'} onclick="toggleUserStatus('${u.id}')" class="users-action-btn ${u.active!==false?'is-deactivate':'is-activate'} ${canEdit&&!isSelf?'':'is-disabled'}" title="${u.active!==false?'Nyahaktifkan pengguna':'Aktifkan pengguna'}" aria-label="${u.active!==false?'Nyahaktifkan pengguna':'Aktifkan pengguna'}">
                                <i data-lucide="${u.active!==false?'user-x':'user-check'}" class="w-4 h-4"></i>
                            </button>
                            <button ${canEdit&&!isSelf?'':'disabled'} onclick="deleteUser('${u.id}')" class="users-action-btn is-delete ${canEdit&&!isSelf?'':'is-disabled'}" title="Padam pengguna" aria-label="Padam pengguna">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        if(empty)empty.classList.toggle('hidden',users.length>0);
        lucide.createIcons();
    }

    function openUserModal(userId='') {
        if(currentUserRole!=='ADMIN'){showAlert('Akses Ditolak','Hanya Admin boleh mengurus pengguna.','danger');return;}
        const u=userId?mockTeachers.find(x=>x.id===userId):null;
        document.getElementById('form-user-id').value=u?.id||'';
        document.getElementById('form-user-name').value=u?.name||'';
        document.getElementById('form-user-staff-id').value=u?.staffId||'';
        document.getElementById('form-user-role').value=u?.role||'GURU_SEJARAH';
        document.getElementById('form-user-status').value=u?.active===false?'INACTIVE':'ACTIVE';
        document.getElementById('modal-user-title').textContent=u?'Kemaskini Pengguna':'Tambah Pengguna';
        renderUserAssignmentOptions(u?.id||'');
        const modal=document.getElementById('modal-user');modal.classList.remove('hidden');modal.classList.add('flex');lucide.createIcons();
    }

    function editUser(id){openUserModal(id);}
    function closeUserModal(){const m=document.getElementById('modal-user');m.classList.add('hidden');m.classList.remove('flex');}

    function renderUserAssignmentOptions(userIdOverride='') {
        const list=document.getElementById('user-class-assignment-list'); if(!list)return;
        const userId=userIdOverride||document.getElementById('form-user-id').value||'';
        const role=document.getElementById('form-user-role').value === 'ADMIN' ? 'ADMIN' : 'GURU_SEJARAH';
        const section=document.getElementById('user-class-assignment-section');
        const assignable=role==='GURU_SEJARAH';
        section.classList.toggle('opacity-50',!assignable);
        ensureMattaryClassCatalog(isAdminSession?.()===true);
        const classes=canonicalActiveClasses();
        list.innerHTML=classes.map(c=>{
            const owner=mockTeachers.find(u=>u.id===c.teacherId);
            const checked=c.teacherId===userId;
            return `<label class="flex items-start gap-2 p-2.5 rounded-lg border ${checked?'border-emerald-300 bg-emerald-50':'border-slate-200 bg-slate-50'} ${assignable?'cursor-pointer':'cursor-not-allowed'}">
                <input type="checkbox" class="user-class-checkbox mt-0.5 rounded border-slate-300 text-emerald-600" value="${c.id}" ${checked?'checked':''} ${assignable?'':'disabled'}>
                <span class="min-w-0"><span class="block text-xs font-bold text-slate-800">${escapeHtml(c.name)}</span><span class="block text-[10px] text-slate-500">Tahun ${c.year}${owner&&owner.id!==userId?' · kini: '+escapeHtml(owner.name):''}</span></span>
            </label>`;
        }).join('');
    }

    function toggleAllUserClasses() {
        if(document.getElementById('form-user-role').value==='ADMIN')return;
        const boxes=[...document.querySelectorAll('.user-class-checkbox:not(:disabled)')];
        const shouldCheck=boxes.some(b=>!b.checked); boxes.forEach(b=>b.checked=shouldCheck);
    }

    function saveUser() {
        if(currentUserRole!=='ADMIN'){showAlert('Akses Ditolak','Hanya Admin boleh mengurus pengguna.','danger');return;}

        const id=document.getElementById('form-user-id').value;
        const name=document.getElementById('form-user-name').value.trim();
        const staffId=document.getElementById('form-user-staff-id').value.trim();
        const role=document.getElementById('form-user-role').value;
        const active=document.getElementById('form-user-status').value==='ACTIVE';

        if(!name||!role){
            showAlert('Maklumat Tidak Lengkap','Nama dan peranan pengguna adalah wajib.','info');
            return;
        }

        const existing=id?mockTeachers.find(u=>u.id===id):null;

        if(existing?.id===currentUserId && (existing.role!==role || !active)){
            showAlert('Perubahan Tidak Dibenarkan','Anda tidak boleh menukar peranan sendiri atau menyahaktifkan akaun yang sedang digunakan.','danger');
            return;
        }

        const userId=existing?.id||`usr_${Date.now().toString(36)}`;
        const loginId=role==='ADMIN'?'ADMIN':String(staffId||'').replace(/\D/g,'');

        if(role==='GURU_SEJARAH' && !/^\d{12}$/.test(loginId)){
            showAlert('MyKad Tidak Sah','MyKad/User ID Guru mestilah 12 digit.','danger');
            return;
        }

        const duplicateLogin=mockTeachers.find(u=>{
            if(u.id===userId)return false;
            const otherRole=u.role==='KETUA_PANITIA'?'ADMIN':u.role;
            const otherId=otherRole==='ADMIN'?'ADMIN':String(u.loginId||u.mykad||u.myKad||u.staffId||'').replace(/\D/g,'');
            return otherId===loginId;
        });
        if(duplicateLogin){
            showAlert('User ID Telah Digunakan','MyKad/User ID ini telah digunakan oleh pengguna lain.','danger');
            return;
        }

        const userData={
            id:userId,
            name,
            email:existing?.email||'',
            staffId:role==='GURU_SEJARAH'?loginId:'',
            loginId,
            mykad:role==='GURU_SEJARAH'?loginId:'',
            role,
            active,
            updatedAt:new Date().toISOString().split('T')[0]
        };

        if(existing) Object.assign(existing,userData);
        else mockTeachers.push(userData);

        const selected=new Set([...document.querySelectorAll('.user-class-checkbox:checked')].map(b=>b.value));
        appState.classes.forEach(c=>{
            if(c.teacherId===userId && (!selected.has(c.id)||role==='ADMIN')) c.teacherId='';
            if(role!=='ADMIN' && selected.has(c.id)) c.teacherId=userId;
        });

        persistUsersState();

        if(phase10Mode==='SUPABASE'&&userData.loginId){
            const remoteUser={...userData,legacyId:userId};
            delete remoteUser.id;
            delete remoteUser.email;
            phase10Upsert('users',userData.loginId,remoteUser)
                .catch(err=>console.error('User sync:',err));
        }

        appState.classes.forEach(c=>phase10Upsert('classes',c.id,c));
        logAudit(existing?'UPDATE_USER':'CREATE_USER',{userId,role,active,assignedClasses:[...selected]});
        closeUserModal();
        renderUsers();
        renderClasses();
        updateClassFilterDropdown();
        showAlert(existing?'Pengguna Dikemas Kini':'Pengguna Ditambah',`${name} berjaya ${existing?'dikemas kini':'ditambah'}.`,'success');
    }

    function toggleUserStatus(id) {
        if(currentUserRole!=='ADMIN'){showAlert('Akses Ditolak','Hanya Admin boleh menukar status pengguna.','danger');return;}
        if(id===currentUserId){showAlert('Tidak Dibenarkan','Akaun yang sedang digunakan tidak boleh dinyahaktifkan.','danger');return;}
        const u=mockTeachers.find(x=>x.id===id);if(!u)return;
        const next=u.active===false;
        showAlert(next?'Aktifkan Pengguna':'Nyahaktifkan Pengguna',`${next?'Aktifkan':'Nyahaktifkan'} akses untuk ${u.name}?`,'info',()=>{
            u.active=next;u.updatedAt=new Date().toISOString().split('T')[0];persistUsersState();
            if(phase10Mode==='SUPABASE'&&u.loginId){
                const remote={...u,legacyId:u.id};delete remote.id;
                phase10Upsert('users',u.loginId,remote)
                    .catch(err=>console.error('User status sync:',err));
            }
            logAudit(next?'ACTIVATE_USER':'DEACTIVATE_USER',{userId:id});renderUsers();
        });
    }

    function deleteUser(id) {
        if(currentUserRole!=='ADMIN'){
            showAlert('Akses Ditolak','Hanya Admin boleh memadam pengguna.','danger');
            return;
        }

        const u=mockTeachers.find(x=>x.id===id);
        if(!u)return;

        if(u.id===currentUserId){
            showAlert('Tidak Boleh Dipadam','Akaun yang sedang digunakan tidak boleh dipadam.','danger');
            return;
        }

        showAlert(
            'Padam Pengguna',
            `Padam ${u.name}? Semua agihan kelas pengguna ini akan dikosongkan. Markah dan PBD murid tidak akan dipadam.`,
            'danger',
            ()=>{
                const loginId=(u.role==='ADMIN'||u.role==='KETUA_PANITIA')
                    ? 'ADMIN'
                    : String(u.loginId||u.mykad||u.myKad||u.staffId||'').replace(/\D/g,'');

                appState.classes.forEach(c=>{
                    if(c.teacherId===u.id)c.teacherId='';
                });

                mockTeachers=mockTeachers.filter(x=>x.id!==id);
                persistUsersState();

                if(phase10Mode==='SUPABASE'&&loginId){
                    phase10Delete('users',loginId);
                    appState.classes.forEach(c=>phase10Upsert('classes',c.id,c));
                }

                logAudit('DELETE_USER',{userId:id,loginId,name:u.name});
                renderUsers();
                renderClasses();
                updateClassFilterDropdown();
            }
        );
    }


    function exportUsersCSV() {
        const rows=[['Nama','MyKad / User ID','Peranan','Status','Kelas Tugasan']];
        mockTeachers.forEach(u=>{
            const normalizedRole=u.role==='KETUA_PANITIA'?'ADMIN':u.role;
            const loginId=normalizedRole==='ADMIN'
                ? 'ADMIN'
                : String(u.loginId||u.mykad||u.myKad||u.staffId||'');
            rows.push([
                u.name,
                loginId,
                userRoleLabel(normalizedRole),
                u.active!==false?'Aktif':'Tidak Aktif',
                getAssignedClassesForUser(u.id).map(c=>c.name).join(' | ')
            ]);
        });
        const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`Pengurusan_Pengguna_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Navigation Logic
    const views = ['dashboard', 'teacher-dashboard', 'completeness', 'attention', 'students', 'classes', 'marks', 'pbd', 'analytics-marks', 'headcount', 'analytics-pbd', 'analytics-student', 'analytics-class', 'intervention', 'admin-tools', 'executive-report', 'reports', 'import-export', 'users', 'settings'];
    
    function navigateTab(tabId) {
        if (!isViewAllowed(tabId)) {
            showAlert('Akses Terhad', 'Akaun Guru hanya boleh mengakses modul pengajaran, analisis dan intervensi bagi kelas yang ditugaskan.', 'danger');
            return;
        }

        // Update nav styling
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('tab-active', 'text-slate-100', 'bg-navy-900/70');
            el.classList.add('text-slate-400');
        });
        
        const activeNav = document.getElementById(`nav-${tabId}`);
        if(activeNav) {
            activeNav.classList.add('tab-active');
            activeNav.classList.remove('text-slate-400');
        }

        // Switch views
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });
        
        const activeView = document.getElementById(`view-${tabId}`);
        if (activeView) activeView.classList.remove('hidden');

        // Close mobile sidebar if open
        if (window.innerWidth < 1024 && sidebarOpen) {
            toggleSidebar();
        }
        
        // Re-render charts or specific views when navigated to
        if (tabId === 'dashboard') {
            // Slight delay to ensure canvas is visible
            setTimeout(initCharts, 100);
        } else if (tabId === 'students') {
            renderStudents();
        } else if (tabId === 'classes') {
            renderClasses();
        } else if (tabId === 'marks') {
            initializeMarksScopeControls();
            updateMarksTypeButtonUI();
            updateAssessmentDropdown();
            renderMarksModule();
        } else if (tabId === 'pbd') {
            initializePbdModule();
        } else if (tabId === 'analytics-marks') {
            initializeMarksAnalytics();
        } else if (tabId === 'headcount') {
            initializeHeadcount();
        } else if (tabId === 'analytics-pbd') {
            initializePbdAnalytics();
        } else if (tabId === 'analytics-student') {
            initializeStudentProfile();
        } else if (tabId === 'analytics-class') {
            initializeClassComparison();
        } else if (tabId === 'users') {
            initializeUsers();
        } else if (tabId === 'intervention') {
            initializeInterventionModule();
        } else if (tabId === 'reports') {
            initializeReports();
        } else if (tabId === 'import-export') {
            initializeImportExport();
        } else if (tabId === 'settings') {
            initializePhase9Settings();
        }
    }

    // Filter Logic
    function onFilterChange() {
        console.log("Filters changed. Refreshing scoped data...");

        const sourceId = window.event?.target?.id || '';
        const kpis = document.querySelectorAll('.shadow-card h3');
        kpis.forEach(kpi => {
            kpi.classList.add('opacity-50', 'scale-95');
            setTimeout(() => kpi.classList.remove('opacity-50', 'scale-95'), 250);
        });

        const isMarksVisible = !document.getElementById('view-marks').classList.contains('hidden');
        const isPbdVisible = !document.getElementById('view-pbd').classList.contains('hidden');
        const isMarksAnalyticsVisible = !document.getElementById('view-analytics-marks').classList.contains('hidden');
        const isPbdAnalyticsVisible = !document.getElementById('view-analytics-pbd').classList.contains('hidden');
        const isStudentProfileVisible = !document.getElementById('view-analytics-student').classList.contains('hidden');
        const isClassComparisonVisible = !document.getElementById('view-analytics-class').classList.contains('hidden');

        if (sourceId === 'filter-kelas' || sourceId === 'filter-academic-year') {
            updateAssessmentDropdown();
        }

        setTimeout(() => {
            updateDashboardKPIs();
            updateCharts();

            const isStudentsVisible = !document.getElementById('view-students').classList.contains('hidden');
            const isClassesVisible = !document.getElementById('view-classes').classList.contains('hidden');
            const isDskpVisible = !document.getElementById('view-dskp').classList.contains('hidden');

            if (isStudentsVisible) renderStudents();
            if (isClassesVisible) renderClasses();
            if (isDskpVisible) renderDskp();
            if (isMarksVisible) renderMarksModule();
            if (isMarksAnalyticsVisible) initializeMarksAnalytics();
            if (isPbdAnalyticsVisible) initializePbdAnalytics();
            if (isStudentProfileVisible) initializeStudentProfile();
            if (isClassComparisonVisible) initializeClassComparison();

            if (isPbdVisible) {
                // Keep the new matrix scope aligned with the global filter.
                const globalYear = document.getElementById('filter-tahun').value;
                const globalClass = document.getElementById('filter-kelas').value;
                if (globalYear !== 'ALL' && ['4','5','6'].includes(String(globalYear))) {
                    document.getElementById('pbd-year').value = String(globalYear);
                }
                populatePbdMatrixClassOptions(globalClass !== 'ALL' ? globalClass : document.getElementById('pbd-class').value);
                renderPbdModule();
            }
        }, 250);
    }

    function onTahunChange() {
        const tahun = document.getElementById('filter-tahun').value;
        const kelasSelect = document.getElementById('filter-kelas');
        const previous = kelasSelect.value;
        const academicYear = document.getElementById('filter-academic-year').value;

        ensureMattaryClassCatalog(isAdminSession?.()===true);
        let classes = canonicalActiveClasses(academicYear);
        if (currentUserRole === 'GURU_SEJARAH') classes = classes.filter(c => c.teacherId === currentUserId);
        if (tahun !== 'ALL') classes = classes.filter(c => String(c.year) === tahun);

        kelasSelect.innerHTML = '<option value="ALL">Semua Kelas</option>' +
            sortClassesCanonical(classes).map(c => `<option value="${c.id}">${canonicalClassCode(c)} · ${escapeHtml(c.name)}</option>`).join('');

        if (classes.some(c => c.id === previous)) kelasSelect.value = previous;
        else kelasSelect.value = 'ALL';

        updateAssessmentDropdown();
        onFilterChange();
    }

    function resetFilters() {
        document.getElementById('filter-academic-year').value = getActiveAcademicYear();
        document.getElementById('filter-tahun').value = 'ALL';
        document.getElementById('filter-kelas').value = 'ALL';
        updateAssessmentDropdown();
        onTahunChange();
    }

    // Initialize Charts
    function initCharts() {
        const ctxGrades = document.getElementById('chart-grades');
        const ctxTp = document.getElementById('chart-tp');
        
        if (!ctxGrades || !ctxTp) return;
        
        updateDashboardKPIs(); // Call initial sync on boot

        // Destroy existing if re-initializing
        if (chartGradesInstance) chartGradesInstance.destroy();
        if (chartTpInstance) chartTpInstance.destroy();

        // Common font config
        Chart.defaults.font.family = "'Inter', sans-serif";
        const darkChartMode = document.documentElement.classList.contains('theme-dark');
        Chart.defaults.color = darkChartMode ? '#cbd5e1' : '#64748b';
        Chart.defaults.borderColor = darkChartMode ? '#334155' : '#e2e8f0';

        // 1. Mark Distribution (Bar Chart)
        chartGradesInstance = new Chart(ctxGrades, {
            type: 'bar',
            data: {
                labels: ['Gred A', 'Gred B', 'Gred C', 'Gred D', 'Gred E', 'Gred F'],
                datasets: [{
                    label: 'Bilangan Murid',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)', // A - Emerald
                        'rgba(5, 150, 105, 0.8)',  // B 
                        'rgba(59, 130, 246, 0.8)', // C - Blue
                        'rgba(245, 158, 11, 0.8)', // D - Amber
                        'rgba(244, 63, 94, 0.8)',  // E - Rose
                        'rgba(225, 29, 72, 0.8)'   // F - Dark Rose
                    ],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13, family: "'Plus Jakarta Sans', sans-serif" }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9', drawBorder: false },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        border: { display: false }
                    }
                }
            }
        });

        // 2. TP Distribution (Doughnut Chart)
        chartTpInstance = new Chart(ctxTp, {
            type: 'doughnut',
            data: {
                labels: ['TP1 (Sangat Terhad)', 'TP2 (Terhad)', 'TP3 (Memuaskan)', 'TP4 (Baik)', 'TP5 (Sangat Baik)', 'TP6 (Cemerlang)'],
                datasets: [{
                    data: getDashboardPbdDistribution(),
                    backgroundColor: [
                        '#ef4444', // TP1 Red
                        '#f97316', // TP2 Orange
                        '#eab308', // TP3 Yellow
                        '#3b82f6', // TP4 Blue
                        '#10b981', // TP5 Emerald
                        '#8b5cf6'  // TP6 Purple
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8
                    }
                }
            }
        });
        updateCharts();
    }

    // Update dashboard charts from the same live Markah + PBD records
    let responsiveResizeTimer=null;
    function refreshResponsiveCharts(){
        clearTimeout(responsiveResizeTimer);
        responsiveResizeTimer=setTimeout(()=>{
            const charts=[
                chartGradesInstance,chartTpInstance,dashboardGpmpChartInstance,
                analyticsGradeChart,analyticsBandChart,analyticsCompareChart,
                classCompareMarksChart,classComparePbdChart,
                pbdAnalyticsClassChart,pbdAnalyticsThemeChart,
                profileMarksChart,profilePbdChart,headcountTrendChart
            ];
            charts.forEach(chart=>{
                try{ if(chart&&typeof chart.resize==='function')chart.resize(); }catch(_){}
            });
        },120);
    }

    window.addEventListener('resize',refreshResponsiveCharts,{passive:true});
    window.addEventListener('orientationchange',refreshResponsiveCharts,{passive:true});

    function updateCharts() {
        if(!chartGradesInstance||!chartTpInstance)return;

        const scope=getDashboardScope();
        const latestByStudent=dashboardLatestScoresByStudent(scope);
        const gradeCounts={A:0,B:0,C:0,D:0,E:0,F:0};

        latestByStudent.forEach(({score})=>{
            const grade=score.grade&&score.grade!=='-'?score.grade:calculateGrade(Number(score.percentage));
            if(Object.prototype.hasOwnProperty.call(gradeCounts,grade))gradeCounts[grade]++;
        });

        chartGradesInstance.data.datasets[0].data=['A','B','C','D','E','F'].map(g=>gradeCounts[g]);
        chartTpInstance.data.datasets[0].data=getDashboardPbdDistribution();

        const dark=document.documentElement.classList.contains('theme-dark');
        chartGradesInstance.options.scales.y.grid.color=dark?'rgba(148,163,184,.18)':'#f1f5f9';
        chartGradesInstance.options.scales.x.ticks={color:dark?'#E2E8F0':'#475569'};
        chartGradesInstance.options.scales.y.ticks={color:dark?'#E2E8F0':'#475569'};
        chartTpInstance.data.datasets[0].borderColor=dark?'#10272D':'#ffffff';

        chartGradesInstance.update();
        chartTpInstance.update();
    }

  
