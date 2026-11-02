# iSEJARAH v88.23

Landscape slide printing now covers **Analisis Komparatif, Murid Perhatian, Analisis Item & JSI and Laporan Eksekutif**, alongside Dashboard, Analisis Markah, Headcount and PBD. Use **Cetak Slaid / PDF → Slaid 16:9 or A4 landskap → Cetak / Simpan PDF**.

## Empty table correction

Empty messages now remain table cells spanning the full table width. Previously the flex layout applied to the empty `<td>` overrode table-cell layout and squeezed the message into the Bil column. Source-table row and column spans are also preserved. Repeated headings, page numbers and fixed print geometry remain intact across phone, tablet and desktop.

## Executive report

The report is a meeting brief: one selected exam, one PBD period and an explicit academic session/year/class scope. It shows weighted pupil mark averages, MTM (grades A–E), GPMP, PBD mastery among filled SK records, missing marks, TH, PBD coverage and inherited records. Missing data stays unknown instead of becoming zero. Zero is a valid score; TH is excluded from mark averages and GPMP. PBD uses the same effective matrix records and authorized active pupils as the existing modules.

Class tables and data-based priorities support decisions about data completion, pupil support, reassessment and intervention follow-up. Module links help teachers act on those priorities. The report explains its purpose and calculation basis in the screen itself; it does not invent meeting decisions or write intervention records.

For Akhir Tahun, the PBD progression panel and slide compare explicit final records with matching mid-year pupil × SK records. Inherited records and new final-only SK are shown separately, rather than counted as fresh reassessments or progress.

## Slide contents and draft behavior

- Comparative slides include current KPIs, charts, ranking/marks and PBD/intervention tables. The percentage-based “GPMP Tertinggi” label is corrected to “Purata Markah Tertinggi”; calculation and sorting are unchanged.
- Attention slides include the full authorized pupil list, indicators and support priorities.
- Item slides include topic performance/support lists, all 28 items including C5A/C5B/C6A/C6B, current question mappings and both complete JSI matrices. Eighteen construct/level columns are split into readable groups of six; all allocations and totals are retained.
- Current score drafts are explicitly marked DRAF. Finish or cancel unfinished JSI edits/import previews before generating slides. Printing neither saves nor discards drafts.
- UPSA–UASA item comparison is included after it has been loaded in its existing tab and still matches the current scope. Otherwise the deck explains how to load it; export makes no additional database requests.

All exports use detached snapshots, sanitize source content and preserve tabs, filters and records. Charts use a separate light print palette in either application theme.

## Validation and deployment

Focused tests cover source values/rows, both formats, desktop/tablet/phone, light/dark, empty cells spanning all columns, complete JSI allocations, score drafts, unfinished JSI/import guards, teacher boundaries, immutable state and no database writes. PDF checks cover landscape dimensions, page counts and distinct content. Existing Dashboard/Marks, Headcount/PBD and item input/edit/import tests remain covered.

Publish `app.js`, `modules/upgrades.js`, `modules/item-analysis.js`, `modules/presentation-print.js`, `presentation-print.css`, `executive-report.css`, `index.html`, `sw.js` and this note. Service worker cache: `v88-23-extended-slides`. No database migrations or credential changes are needed.
