# Changelog

All notable changes are recorded here. The version matches `version` in `assets/js/framework.js`. That version is printed on every exported note, CSV row and printed page, so each export can be traced to the exact framework wording and cutoffs.

## [Unreleased]

### Changed

- **Plain-language questions:** every question is reworded to be easier to read (for example, Gate 1 item 3 now asks *“Would you choose the same perforators for a conventional (open) harvest?”*). Each (?) explains what to consider and quotes the original framework wording, which is unchanged in `framework.js`, the rules and the exports.
- **Compact layout:** answers are small buttons inline with each question (stacked under it on phones); a grade's description shows under the row once chosen, and every description is in the (?). CT values sit on the same line as their label, plan cards are smaller, and complexity and benefit now stack in one column.
- **Early-stop summary:** when any Gate 1 item is *No*, the side shows a summary in place, with the items not met, the next step, an optional note, and print, copy-note and CSV buttons. The note and the failed items are included in the copied note, the CSV `rationale` column and the printed page.
- **Next shows what is left:** each Next button shows how many required items are still missing on that step.
- **Simpler flow:** three steps instead of six (Flap safety & CT measurements; Complexity & expected benefit; Plan & summary), so a case needs two Next presses instead of five. Complexity and benefit sit side by side on wide screens.
- **Two tabs:** *Calculator* and *Evidence & About*. *How to measure* is now a slide-out guide opened from the CT measurements section; old `#how-to-measure`, `#evidence` and `#about` links still work.
- **Citation hidden:** the manuscript is still under internal review, so the "How to cite" card, footer link, printed citation line and the article details in `CITATION.cff` are removed, and the tab is renamed *About*. Set `citation.show` in `framework.js` to restore them later.
- **Design refresh:** Inter typeface (bundled, no external requests), a calmer type scale, a clean white header with underlined tabs, and dividers instead of nested boxes.
- **(?) tips:** help text and notes now sit behind a (?) that opens on hover, keyboard focus or tap. Grade descriptors, the disclaimer, the Gate 1 stop message, every "Suggestion (unvalidated)" label and the intraoperative override stay visible.
- **Phones:** Back and Next stay in reach at the bottom of the screen.
- **Mayo Clinic theme:** official Mayo Clinic logo in the header, footer and printed pages (white version in dark mode), Mayo blue (#0067B1), a branded band carrying the disclaimer, and Source Serif 4 headings echoing the wordmark. The logo is a trademark used with permission and is excluded from the repository licenses.

## [1.0.1] – 2026-11-10

### Changed

- **Limiting-factor suggestion:** when every complexity domain is Low, the three domains are no longer all listed as "limiting". Nothing is suggested, or *Expected benefit* when the benefit is Moderate.
- **Evidence tab:** conversion now reads "1 of 79 robotic flaps", matching the manuscript.

## [1.0.0] – 2026-11-10

### Added

- **Six-step calculator:**
  1. Gate 1, flap safety (hard stop).
  2. CT measurements, with B = C − A and B/C calculated live.
  3. Technical complexity, with each domain graded separately.
  4. Expected benefit, suggested from B/C with example cutoffs.
  5. Integrated plan, with a **Suggestion (unvalidated)**, the reasons for it and a rule-by-rule trace.
  6. Summary and export.
- **Two-sided cases:** assess both sides with separate Left and Right steppers, plus a combined summary.
- **Live summary panel:** a sidebar on desktop and a bottom sheet on mobile.
- **Exports:**
  - Print or save as PDF, one page per side.
  - A structured note you can copy.
  - A CSV file (RFC 4180, UTF-8 with BOM).
- **Information tabs:** *How to measure* with an original schematic, *Evidence*, and *About & cite*.
- **Fictional teaching examples.**
- **Accessibility and display:** light and dark themes, reduced-motion support and WCAG 2.1 AA accessibility.
- **Privacy:** no storage, no analytics, and no network access, enforced by a Content-Security-Policy.
- **Unit tests** with `node --test`, and a GitHub Actions workflow.

### Tool defaults

- **Benefit cutoffs** (example cutoffs, not validated):
  - Substantial if B/C ≥ 0.67.
  - Moderate if 0.33 ≤ B/C < 0.67.
  - Small if B/C < 0.33.
- **Intramuscular-course anchors:**
  - Low if ≤2.5 cm, or paramuscular or subfascial.
  - Moderate if >2.5 to 5 cm.
  - High if >5 cm.
- **Plan matching:** rules a–i, applied in order with the first match winning.
