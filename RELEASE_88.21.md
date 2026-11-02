# iSEJARAH v88.21

## Kelengkapan Data

The completeness centre and teacher dashboard use the same raw marks and matrix-topic PBD records as data entry. Completeness uses active pupils in the selected academic session and class/year scope. Each pupil/assessment or pupil/SK slot is counted once. Note-only and blank mark rows are incomplete; a real zero and recorded TH are complete.

The centre now provides a Markah exam selector and PBD period selector. PBD is calculated for one selected period, using the existing AKHIR carry-forward rule. Mid-year values inherited by AKHIR are counted once and labelled, without creating or modifying PBD records. Entered/expected counts appear below percentages. An incomplete class cannot round up to 100%. Action buttons open the matching class/year/exam/period.

Remote refresh retains selected sessions. Visible summary views update after local marks/PBD edits, login hydration, global filter changes and remote changes. Accepted realtime updates/deletes invalidate an older in-flight snapshot, preserving pending local edits.

## Landscape presentation printing

Open Headcount Sejarah or Analisis & Heat Map PBD and choose **Cetak Slaid / PDF**. The preview contains the currently selected scope. Choose **Slaid 16:9** or **A4 landskap**, then **Cetak / Simpan PDF**.

Headcount includes Ringkasan, Prestasi Murid, Analisis Gred and Trend Headcount. PBD includes summary indicators, charts, the heat map and the SK analysis table. Long tables repeat headers and continue onto distinct pages. The preview is read-only and uses separate print styles, so app light/dark mode does not hide the text. It does not save, import or modify pupil data, or change the selected source tabs/filters.

## Validation

- Offline calculation tests cover active/session/exam scope, zero/TH/blank, duplicates, mapped SK, exact and inherited PBD, invalid TP and empty classes.
- Read-only Supabase verification matches independent aggregate counts for all nine 2026 classes. Pupil names are replaced in local test fixtures. No database migration, reseeding or production-record edits are part of this release.
- Sync regression covers admin/teacher hydration, deferred snapshot update/delete races, pending writes, archived-session retention and pagination beyond 1,000 records.
- Browser completeness tests cover all nine classes, all exam/period choices, visible scope controls, action links, preserved selections and teacher access across desktop/tablet/mobile and both themes.
- Presentation layout tests cover 40 synthetic pupils, 12 heatmap themes, 30 SK and repeated table headers in both page formats. Generated PDFs have one distinct landscape PDF page per slide and retain the final pupil/SK.
- Full-application integration uses an anonymized Supabase snapshot: all 85 print source IDs exist, Headcount includes all 54 Year-4 pupils and all four sections, and PBD includes its complete 54-pupil heatmap and 11-SK table. KPIs, grades, charts, targets, trend and table cells match the original rendered views. No source data or filter state changes while printing.
- Existing item analysis, JSI editing, keyboard navigation, imports/exports, save/conflict behavior, legacy Markah/PBD navigation and responsive layouts pass regression checks.

Publish these eight files: `app.js`, `styles.css`, `index.html`, `sw.js`, `modules/upgrades.js`, `modules/presentation-print.js`, `presentation-print.css`, and this note. Existing item analysis code, data tables, credentials and Supabase policies remain in place. The service-worker cache is `v88-21-completeness-slides`.
