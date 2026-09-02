/*
 * iSEJARAH -> Google Sheets snapshot endpoint.
 *
 * Security model:
 * - Supabase remains the only source of truth.
 * - This function accepts only a short-lived Google OAuth token that can open
 *   the configured spreadsheet.
 * - The service-role key stays inside Supabase Edge Functions.
 * - The function never writes to Google Sheets; the bound Apps Script writes
 *   the returned snapshot into its own spreadsheet.
 */

const SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID") ||
  "1d1bdBDxj2AtKGp_mqQV1P-CDxPZ88lVVQRU1vNnnlIM";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const PBD_TEMPLATES: Record<string, Array<[string, string[]]>> = {
  "4": [
    ["MARI BELAJAR SEJARAH", ["PENGERTIAN SEJARAH", "DIRI DAN KELUARGA", "SEJARAH SEKOLAH", "KAWASAN TEMPAT TINGGAL"]],
    ["ZAMAN AIR BATU", ["ZAMAN AIR BATU"]],
    ["ZAMAN PRASEJARAH", ["KEHIDUPAN MANUSIA PRASEJARAH"]],
    ["KERAJAAN MELAYU AWAL", ["KEDUDUKAN KERAJAAN-KERAJAAN MELAYU AWAL"]],
    ["TOKOH-TOKOH TERBILANG KESULTANAN MELAYU MELAKA", [
      "TOKOH-TOKOH TERBILANG KESULTANAN MELAYU MELAKA",
      "PARAMESWARA SEBAGAI PENGASAS KESULTANAN MELAYU MELAKA",
      "TUN PERAK SEBAGAI BENDAHARA MELAKA",
      "HANG TUAH SEBAGAI LAKSAMANA MELAKA",
    ]],
  ],
  "5": [
    ["WARISAN NEGARA KITA", ["INSTITUSI RAJA", "AGAMA ISLAM", "BAHASA MELAYU"]],
    ["PERJUANGAN KEMERDEKAAN NEGARA", ["PENJAJAHAN DAN CAMPUR TANGAN KUASA LUAR", "PERJUANGAN TOKOH TEMPATAN", "SEJARAH KEMERDEKAAN 1957"]],
    ["YANG DI-PERTUAN AGONG", ["YANG DI-PERTUAN AGONG KETUA NEGARA"]],
    ["IDENTITI NEGARA KITA", ["JATA NEGARA", "BENDERA KEBANGSAAN", "LAGU KEBANGSAAN", "BAHASA KEBANGSAAN", "BUNGA KEBANGSAAN"]],
  ],
  "6": [
    ["KEMAKMURAN NEGARA KITA", ["PEMBENTUKAN MALAYSIA", "NEGERI-NEGERI DI MALAYSIA", "RUKUN NEGARA"]],
    ["KITA RAKYAT MALAYSIA", ["KAUM DAN ETNIK DI MALAYSIA", "AGAMA DAN KEPERCAYAAN", "PERAYAAN MASYARAKAT MALAYSIA"]],
    ["PENCAPAIAN DAN KEBANGGAAN NEGARA", ["SUKAN KEBANGGAAN NEGARA", "KEMAJUAN EKONOMI", "PEMIMPIN NEGARA", "MALAYSIA DAN DUNIA"]],
  ],
};

type DbRow = Record<string, unknown> & { id: string; data?: Record<string, unknown> };

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function numberOrBlank(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function value(row: DbRow, camelKey: string, columnKey?: string) {
  const data = row.data || {};
  return data[camelKey] ?? (columnKey ? row[columnKey] : undefined);
}

function formatMyKid(raw: unknown) {
  const digits = text(raw).replace(/\D/g, "");
  return digits.length === 12
    ? `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
    : text(raw);
}

function makeDskpMap() {
  const map = new Map<string, { theme: string; topic: string }>();
  Object.entries(PBD_TEMPLATES).forEach(([year, groups]) => {
    groups.forEach(([theme, topics], groupIndex) => {
      topics.forEach((topic, topicIndex) => {
        map.set(`tpl_y${year}_g${groupIndex + 1}_t${topicIndex + 1}`, { theme, topic });
      });
    });
  });
  return map;
}

async function requireSpreadsheetAccess(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return false;
  const check = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}?fields=spreadsheetId`,
    { headers: { authorization } },
  );
  if (!check.ok) return false;
  const result = await check.json();
  return result.spreadsheetId === SHEET_ID;
}

async function fetchTable(table: string): Promise<DbRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5000`;
  const result = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      accept: "application/json",
    },
  });
  if (!result.ok) throw new Error(`${table}: ${result.status} ${await result.text()}`);
  return await result.json();
}

function buildSnapshot(year: string, rows: Record<string, DbRow[]>) {
  const classes = new Map(rows.classes.map((row) => [row.id, { ...row.data, id: row.id, teacherId: value(row, "teacherId", "teacher_id") }]));
  const users = new Map<string, Record<string, unknown>>();
  rows.users.forEach((row) => {
    const item = { ...row.data, id: row.id };
    users.set(row.id, item);
    const legacyId = text(row.data?.legacyId);
    if (legacyId) users.set(legacyId, item);
  });
  const className = (classId: unknown) => text(classes.get(text(classId))?.name);
  const teacherName = (classId: unknown) => {
    const teacherId = text(classes.get(text(classId))?.teacherId);
    return text(users.get(teacherId)?.name).toUpperCase();
  };

  const students = rows.students.map((row) => ({
    ...row.data,
    id: row.id,
    classId: value(row, "classId", "class_id"),
    academicYear: value(row, "academicYear", "academic_year"),
  })).filter((student) => text(student.academicYear) === year && [4, 5, 6].includes(Number(student.year)));
  students.sort((a, b) => Number(a.year) - Number(b.year) || className(a.classId).localeCompare(className(b.classId), "ms") || text(a.name).localeCompare(text(b.name), "ms"));
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const assessments = rows.assessments.map((row) => ({
    ...row.data,
    id: row.id,
    classId: value(row, "classId", "class_id"),
    academicYear: value(row, "academicYear", "academic_year"),
  })).filter((assessment) => text(assessment.academicYear) === year && text(assessment.subject || "SEJARAH").toUpperCase() === "SEJARAH");
  const assessmentMap = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const dskpMap = makeDskpMap();

  const murid = students.map((student) => [
    student.id,
    year,
    Number(student.year),
    className(student.classId),
    text(student.name).toUpperCase(),
    formatMyKid(student.identifier),
    text(student.gender).toUpperCase(),
    teacherName(student.classId),
    text(student.status || "AKTIF").toUpperCase(),
  ]);

  const markah = rows.scores.map((row) => {
    const studentId = text(value(row, "studentId", "student_id"));
    const assessmentId = text(value(row, "assessmentId", "assessment_id"));
    const student = studentMap.get(studentId);
    const assessment = assessmentMap.get(assessmentId);
    if (!student || !assessment) return null;
    const absent = Boolean(row.data?.absent);
    const rawScore = absent ? "" : numberOrBlank(row.data?.rawScore);
    const maxScore = Number(assessment.maxScore || 100);
    const percentage = absent ? "" : numberOrBlank(row.data?.percentage ?? (rawScore === "" ? "" : Math.round(Number(rawScore) / maxScore * 100)));
    return {
      sort: [Number(student.year), className(student.classId), text(student.name), text(assessment.type), text(assessment.date)],
      values: [row.id, student.id, year, Number(student.year), className(student.classId), text(student.name).toUpperCase(), text(assessment.type || assessment.name).toUpperCase(), text(assessment.date), absent ? "TH" : "HADIR", rawScore, maxScore, percentage, absent ? "TH" : text(row.data?.grade), text(row.data?.teacherNote), "SUPABASE"],
    };
  }).filter(Boolean) as Array<{ sort: Array<string | number>; values: unknown[] }>;
  markah.sort((a, b) => Number(a.sort[0]) - Number(b.sort[0]) || text(a.sort[1]).localeCompare(text(b.sort[1]), "ms") || text(a.sort[2]).localeCompare(text(b.sort[2]), "ms") || text(a.sort[3]).localeCompare(text(b.sort[3])) || text(b.sort[4]).localeCompare(text(a.sort[4])));

  const pbd = rows.pbd_records.map((row) => {
    const studentId = text(value(row, "studentId", "student_id"));
    const student = studentMap.get(studentId);
    if (!student) return null;
    const dskpId = text(row.data?.dskpId);
    const standard = dskpMap.get(dskpId) || { theme: "", topic: dskpId };
    const period = text(row.data?.assessmentPeriod).toUpperCase() === "AKHIR" ? "Akhir Tahun" : "Pertengahan Tahun";
    return [row.id, student.id, year, period, Number(student.year), className(student.classId), text(student.name).toUpperCase(), standard.theme, standard.topic, numberOrBlank(row.data?.tp), text(row.data?.assessmentDate), text(row.data?.evidence), text(row.data?.teacherNote), "SUPABASE"];
  }).filter(Boolean) as unknown[][];
  pbd.sort((a, b) => Number(a[4]) - Number(b[4]) || text(a[5]).localeCompare(text(b[5]), "ms") || text(a[6]).localeCompare(text(b[6]), "ms") || text(a[7]).localeCompare(text(b[7]), "ms") || text(a[8]).localeCompare(text(b[8]), "ms"));

  return {
    version: 1,
    source: "iSEJARAH Supabase",
    spreadsheetId: SHEET_ID,
    academicYear: year,
    generatedAt: new Date().toISOString(),
    counts: { students: murid.length, scores: markah.length, pbd: pbd.length },
    sheets: { MURID: murid, MARKAH_UJIAN: markah.map((item) => item.values), PBD: pbd },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return response(500, { error: "SUPABASE_CONFIG_MISSING" });

  try {
    if (!await requireSpreadsheetAccess(req)) return response(401, { error: "GOOGLE_SHEET_ACCESS_REQUIRED" });
    const body = await req.json().catch(() => ({}));
    const year = /^20\d{2}$/.test(text(body.year)) ? text(body.year) : "2026";
    const [users, classes, students, assessments, scores, pbdRecords] = await Promise.all([
      fetchTable("users"), fetchTable("classes"), fetchTable("students"),
      fetchTable("assessments"), fetchTable("scores"), fetchTable("pbd_records"),
    ]);
    return response(200, buildSnapshot(year, { users, classes, students, assessments, scores, pbd_records: pbdRecords }));
  } catch (error) {
    console.error("google-sheets-sync", error);
    return response(500, { error: "SYNC_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
});
