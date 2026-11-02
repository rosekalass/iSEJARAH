# iSEJARAH v88.22

Dashboard Utama and Analisis Markah now use the existing **Cetak Slaid / PDF** preview, with **Slaid 16:9** and **A4 landskap** page formats.

## Included content

- Dashboard: six indicators, grade and TP charts, the GPMP Headcount trend/table and class overview. GPMP slides identify their own displayed scope when it differs from the global filter.
- Analisis Markah: eight indicators, GPMP, completion, grade percentages, score bands, insights, GPMP by class/year, active assessment comparison and the currently filtered pupil table.
- Support and Near Miss slides include every candidate in the authorized analytics scope, beyond the screen-card limits. Local pupil-table search/filters apply to the pupil table; candidate-list scope is labelled separately.

The exporter reads existing rendered values and existing scoped analytics rows. It does not fetch or write records, change filters, switch tabs or alter score calculations. Charts are rendered separately for print, with light print colors in both app themes. Long tables repeat headings and page numbers.

The Dashboard percentage indicator is labelled **Purata Markah**, matching its existing percentage calculation. GPMP remains available in the separate GPMP summary.

Preview scaling uses a transformed fixed-size deck, preserving table geometry on phones. Part counters appear in the footer so pagination does not change measured title height.

## Validation

Full-app tests compare Dashboard/Analisis Markah values, charts and all table cells with their source views. Both formats, both themes, desktop/tablet/phone, comparison filters, empty scopes and teacher class boundaries are covered. Every one of the 167 anonymized source pupils appears once in the complete mark table. Additional synthetic candidates verify lists beyond the screen limits and long names. Printing leaves data and filters unchanged.

PDF checks verify landscape dimensions, distinct pages, all required sections and the final candidates. Existing Headcount/PBD print tests and real-app integration continue to pass.

## Files

Publish `modules/presentation-print.js`, `presentation-print.css`, `index.html`, `sw.js` and this note. The service-worker cache is `v88-22-dashboard-slides`. No database migration, credentials, data reseeding or Supabase-policy changes are required. The v88.21 completeness and Headcount/PBD print features remain in place.
