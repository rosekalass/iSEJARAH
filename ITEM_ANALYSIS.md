# Analisis Item & JSI — v88.17

Open **Analisis & Prestasi → Analisis Item & JSI**. Select session, year, UPSA/UASA and class. The module contains topic analysis, entry of 28 item scores, item statistics, source JSI and paired UPSA/UASA comparison.

## Structure and calculations

- A1–A20: 1 mark each; B1–B4: 5 marks each; C5A/C6A: 2 each; C5B/C6B: 3 each. Total 50.
- In the supplied papers, C1(a)/(b) corresponds to app C5A/C5B and C2(a)/(b) to C6A/C6B.
- Zero is a score. Blank is unfinished. TH must have no scores. Only complete, valid rows enter p, D and topic calculations.
- p = sum of scores / (complete pupil count × item maximum).
- D uses floor(27% × N) in each group, minimum N = 10. Ties are resolved by pupil ID for reproducible results.
- Topic performance is weighted by maximum marks. Topics with no assessed items have no performance value.
- Topic mappings inferred from the supplied 2026 UASA papers are prefilled. T5 A20 and T6 A17 remain marked for review and are excluded from topic aggregation until an admin confirms the topic.
- Bundled JSI allocations are the starting reference. Admins can update them in **Pemetaan JSI → Edit JSI**, editing theme/context labels and integer allocation cells, then **Simpan JSI**. Topic codes stay immutable, preserving question mappings. Both A and B+C drafts survive section/tab switches. Allocation totals show A /20 and B+C /30; incomplete/unbalanced allocations remain visibly labelled as planning drafts, rather than silently remapping questions. Planned R/S/T is distinct from observed item difficulty. UPSA allocations and future sessions are not inferred from the UASA paper.
- Matrix saves use the same admin-only, revision-checked paper RPC. They preserve question mappings, thresholds and all pupil responses. Stale/network failures retain the draft. Refresh, polling and paper/class changes cannot overwrite it. Cancel explicitly discards the matrix draft; export includes both matrix sections, including unsaved drafts. Teachers see the matrix read-only.
- The compact matrix has explicit context/numeric column widths and a single keyboard-accessible horizontal scroll region. Legacy auto-sizing is bypassed only for this matrix. The module title has no generated home icon; the navigation uses one explicit target icon.

## Import, export and saving

Use the supplied workbook structure, choosing the matching `T4_UPSA` through `T6_UASA` tab. Row 9 headers are detected automatically. A single-sheet workbook or CSV with matching headers is also supported. Pupil IDs must match existing IDs or unique identifiers in the selected permitted scope; unknown or duplicate IDs stop the import. Export the current class from this module to obtain a compatible, populated pupil list.

Import first displays a preview, then applies to a draft. Filled Excel cells replace the matching item; blank Excel cells preserve existing scores. Confirmed TH clears item scores for that pupil. Press **Simpan** to send the draft to Supabase. Export includes unsaved drafts and marks them in the filename. An unfilled template does not erase records.

Saves use expected revisions. If another user changes the same pupil row, the whole save batch fails atomically, retaining the local draft. Export the draft, discard it, refresh and merge the intended changes. Refresh and polling never replace dirty drafts. A session/paper/class change is blocked while dirty or importing. Drafts are kept in memory, with an unload warning; save or export before closing the tab.

The module stores only `item_analysis_papers` and `item_analysis_responses`. It does **not** overwrite existing marks, PBD, headcount or pupil records. There is no live link to a local Excel file and no automatic editing of the original workbook. Polling runs every 30 seconds while the module is visible and idle.

## Access and existing login compatibility

The production app uses legacy anonymous Supabase Auth sessions plus app credentials. The additional, module-specific binding verifies those existing credentials on the server, with per-session throttling. A private table binds the Auth UID to a verified app profile for 24 hours. The binding reads the current profile and class assignment rather than trusting client roles or user metadata. Existing login and legacy-module permissions are unchanged.

New tables have RLS. Active verified admins manage mappings; verified teachers access only assigned classes. Public RPCs use SECURITY INVOKER; credential verification and binding lookups use restricted functions in a non-exposed private schema. The private session table is not granted to the client. Users with an unverified/expired binding are prompted to log out and in again. No password is saved by the new module.

The Supabase advisor flags signed-in anonymous sessions for these policies because the existing app deliberately uses that Auth mode. New-module access additionally requires the verified private binding; an unbound session was tested and rejected. See [Supabase anonymous-user RLS guidance](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins). Pre-existing shared-access policies and older SECURITY DEFINER helpers were outside this additive change. They remain a separate legacy security concern: [advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Verification

- Pure calculations: all 28 items, /50 total, blank vs zero, invalid C maximum, TH, weighted topic calculation, p/D and minimum N, import header and duplicate-ID checks.
- Browser with isolated fixtures: save/refresh, conflict retention, actual attached workbook parsing, blank-preserving import, export, A4 print, desktop/tablet/mobile, both themes, teacher navigation/mapping permissions, old marks and PBD navigation. No live pupil responses were used in screenshots.
- Live database transaction, rolled back: server credential verification and bad-password rejection, teacher class boundaries, response save, stale revision rejection, invalid C score rejection, teacher config rejection.
- Legacy counts after verification: 166 pupils, 449 score records, 1,040 PBD records, unchanged. Six paper configurations were added; no real item responses were inserted by development.
- A4 PDF was inspected: two distinct pages, topic summary followed by all 28 items.

## Deployment and rollback

Source SQL: `sql/item-analysis.sql`, followed by `sql/item-analysis-legacy-session.sql`. Both migrations were applied through Supabase before the frontend release. Never rerun these create statements blindly. The six 2026 paper configurations are initialized from the bundled seeds; future sessions can be prepared by an admin.

The service-worker cache version is v88-17-jsi. This hotfix changes only `item-analysis.css`, `modules/item-analysis.js`, `responsive.js`, `index.html`, `sw.js` and this guide. No new SQL migration or data reseeding is needed. Revert the frontend commit to restore the previous interface; additive item tables can remain so entered data is retained. Do not drop tables as part of a frontend rollback.
