/**
 * Bound Apps Script for "iSEJARAH Data Sync 2026".
 * Supabase is the only source of truth. This script replaces report-source
 * rows; it never sends spreadsheet edits back to Supabase.
 */
const ISEJARAH_SYNC = Object.freeze({
  spreadsheetId: '1d1bdBDxj2AtKGp_mqQV1P-CDxPZ88lVVQRU1vNnnlIM',
  endpoint: 'https://rmlkmnpnoasagwpvawxx.supabase.co/functions/v1/google-sheets-sync',
  academicYear: '2026',
  firstDataRow: 5,
  clearThroughRow: 2500,
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('iSEJARAH Sync')
    .addItem('Sync sekarang', 'syncISejarahNow')
    .addSeparator()
    .addItem('Aktifkan sync automatik (5 minit)', 'enableISejarahAutoSync')
    .addItem('Hentikan sync automatik', 'disableISejarahAutoSync')
    .addItem('Lihat status sync', 'showISejarahSyncStatus')
    .addToUi();
}

function syncISejarahNow() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getId() !== ISEJARAH_SYNC.spreadsheetId) {
    throw new Error('Skrip ini hanya dibenarkan untuk Google Sheet iSEJARAH yang ditetapkan.');
  }

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Penyegerakan lain masih berjalan. Cuba semula sebentar lagi.');

  try {
    spreadsheet.toast('Mengambil data terkini daripada Supabase…', 'iSEJARAH Sync', 10);
    const result = UrlFetchApp.fetch(ISEJARAH_SYNC.endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ year: ISEJARAH_SYNC.academicYear }),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    const status = result.getResponseCode();
    const payload = JSON.parse(result.getContentText() || '{}');
    if (status !== 200) throw new Error(payload.message || payload.error || ('HTTP ' + status));
    if (payload.spreadsheetId !== spreadsheet.getId()) throw new Error('ID Google Sheet tidak sepadan.');

    writeSourceSheet_(spreadsheet, 'MURID', 9, payload.sheets.MURID || []);
    writeSourceSheet_(spreadsheet, 'MARKAH_UJIAN', 15, payload.sheets.MARKAH_UJIAN || []);
    writeSourceSheet_(spreadsheet, 'PBD', 14, payload.sheets.PBD || []);

    const properties = PropertiesService.getDocumentProperties();
    properties.setProperties({
      ISEJARAH_LAST_SYNC_AT: payload.generatedAt || new Date().toISOString(),
      ISEJARAH_LAST_SYNC_COUNTS: JSON.stringify(payload.counts || {}),
      ISEJARAH_LAST_SYNC_ERROR: '',
    });
    SpreadsheetApp.flush();
    const counts = payload.counts || {};
    spreadsheet.toast(
      `${counts.students || 0} murid · ${counts.scores || 0} markah · ${counts.pbd || 0} PBD`,
      'Sync selesai',
      8,
    );
    return payload.counts;
  } catch (error) {
    PropertiesService.getDocumentProperties().setProperty('ISEJARAH_LAST_SYNC_ERROR', String(error));
    spreadsheet.toast(String(error), 'Sync gagal', 10);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function writeSourceSheet_(spreadsheet, sheetName, columnCount, values) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Tab ${sheetName} tidak ditemui.`);
  const requiredRows = Math.max(ISEJARAH_SYNC.clearThroughRow, ISEJARAH_SYNC.firstDataRow + values.length);
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  sheet.getRange(ISEJARAH_SYNC.firstDataRow, 1, requiredRows - ISEJARAH_SYNC.firstDataRow + 1, columnCount).clearContent();
  if (values.length) sheet.getRange(ISEJARAH_SYNC.firstDataRow, 1, values.length, columnCount).setValues(values);
}

function enableISejarahAutoSync() {
  disableISejarahAutoSync_(false);
  ScriptApp.newTrigger('syncISejarahNow').timeBased().everyMinutes(5).create();
  syncISejarahNow();
  SpreadsheetApp.getUi().alert('Sync automatik iSEJARAH telah diaktifkan setiap 5 minit.');
}

function disableISejarahAutoSync() {
  disableISejarahAutoSync_(true);
}

function disableISejarahAutoSync_(showMessage) {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncISejarahNow')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  if (showMessage) SpreadsheetApp.getUi().alert('Sync automatik iSEJARAH telah dihentikan.');
}

function showISejarahSyncStatus() {
  const properties = PropertiesService.getDocumentProperties();
  const at = properties.getProperty('ISEJARAH_LAST_SYNC_AT') || 'Belum pernah sync';
  const counts = properties.getProperty('ISEJARAH_LAST_SYNC_COUNTS') || '{}';
  const error = properties.getProperty('ISEJARAH_LAST_SYNC_ERROR') || 'Tiada';
  SpreadsheetApp.getUi().alert(`Sync terakhir: ${at}\nRekod: ${counts}\nRalat terakhir: ${error}`);
}
