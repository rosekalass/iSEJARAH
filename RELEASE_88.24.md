# iSEJARAH v88.24 — stable filters and Dashboard exams

## Corrected behavior

Background refreshes no longer reapply global class/year/exam defaults over a teacher's local analysis choices. For example, selecting 5 Al-Biruni in Analisis Markah remains selected after a delayed full data load or a Realtime score update, even when the global Dashboard scope is still 4 Al-Khawarimi. Local pupil search, grade/status, comparison and other filters remain intact while refreshed data is rendered.

Refresh paths preserve current selections for PBD analysis, comparative analysis, pupil profiles and interventions. The global class list respects its selected academic session and year. If a class becomes unavailable or unauthorized, selection falls back safely instead of silently selecting the first class. A hidden marks-entry initializer cannot change Dashboard to 4 Al-Khawarimi.

The short delayed global-filter callback is coalesced and checks the currently visible module and latest local selections. It does not overwrite newer module selections or rerun a module the user has left. Explicit user changes to global filters continue to apply.

## Dashboard assessment selection

Dashboard now has its own **Pentaksiran Markah** field: **Pentaksiran terkini**, **Diagnostik**, **UPSA**, **UASA**. Mark averages, grade charts and the class mark overview use the selected examination type. Missing results remain unknown; they are not replaced by another exam or counted as zero. The default retains the latest available exam per pupil.

Dashboard's choice is independent of the score-entry examination and Analisis Markah's local examination. PBD continues to use its existing latest effective PBD period; intervention indicators continue to use current records/trends. The visible basis note identifies these differences, and Dashboard slides identify the chosen exam.

## Data safety

Read-only filtering and background analysis no longer seed or normalize classes/assessment templates through the refresh paths. Template preparation remains in the explicit marks-entry workflow. There is no database migration, credential change, data deletion or change to mark/PBD formulas. Live synchronization remains active.

## Validation

Real-app tests use anonymized data with stable synthetic record IDs. They reproduce the original delayed-load and Realtime reset before the fix, then verify the latest chosen filters and nonempty mark values after refresh. Coverage includes Dashboard exam options/results, exam independence, local analytics filters, other modules, 250ms races, explicit global changes, archived sessions without record changes or writes, and teacher class boundaries. Desktop/tablet/phone and both themes are checked. Existing completeness and slide/export checks remain covered.

Publish `app.js`, `modules/live-sync.js`, `modules/presentation-print.js`, `index.html`, `sw.js` and this note. The existing presentation CSS is referenced with the new cache version but its contents are unchanged. No Supabase changes are required.
