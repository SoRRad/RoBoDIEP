# Changelog

All notable changes are recorded here. The version matches `version` in `assets/js/framework.js`. That version is printed on every exported note, CSV row and printed page, so each export can be traced to the exact framework wording and cutoffs.

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
