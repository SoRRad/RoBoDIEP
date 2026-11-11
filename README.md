# Robotic DIEP Selection Calculator (RoBoDIEP)

[![Tests](https://github.com/SoRRad/RoBoDIEP/actions/workflows/test.yml/badge.svg)](https://github.com/SoRRad/RoBoDIEP/actions/workflows/test.yml)

An interactive, browser-only research and educational tool. It walks through the patient-selection framework for robotic-assisted DIEP flap harvest developed from a systematic review by the authors (manuscript in preparation). The steps are:

1. A flap-safety gate.
2. CT angiography measurements.
3. Separately graded technical complexity.
4. Expected benefit.
5. An integrated plan.
6. A summary you can print, copy or download.

**Live site:** https://sorrad.github.io/RoBoDIEP/

> **Research and educational tool. Not a medical device. Not validated for clinical decision-making. Does not replace surgical judgment. Intraoperative findings always take precedence.**

## What it is, and what it is not

| It is | It is not |
| --- | --- |
| A structured checklist that mirrors a published selection framework | A medical device or a validated decision rule |
| A way to document grades, the principal limiting factor and the rationale | A substitute for surgical judgment or intraoperative findings |
| A source of a **Suggestion (unvalidated)** to compare with your own plan | A tool that stores, sends or remembers any data |

The surgeon's own selection is always the final plan.

## How to use

The site has two tabs: **Calculator** and **Evidence & About**. The calculator has three steps.

1. **Case setup.** Optionally add a *Case label*; do not enter patient identifiers. Tick **Assess both sides** to grade each hemiabdomen separately.
2. **Step 1, Flap safety & CT measurements.**
   - Answer the three Gate 1 questions. Any **No** stops that side: the CT section is hidden and an **early-stop summary** appears in its place, listing the item(s) not met and the next step, with an optional note and print, copy-note and CSV buttons. Any **Uncertain** lets you continue, but the suggestion becomes *Additional assessment needed*.
   - Enter A, C, the optional 3D length, and the arcuate-line relation and method. B = C − A and B/C are calculated live. The **How to measure** button opens the measuring guide beside the inputs.
3. **Step 2, Complexity & expected benefit.** Grade configuration, intramuscular course and access, and record team experience. The course grade is auto-filled from A. The expected-benefit grade is pre-selected from B/C using example cutoffs. Override either if your assessment differs.
4. **Step 3, Plan & summary.** Review the **Suggestion (unvalidated)**, why it was made, and how the rules matched. Choose your plan, the principal limiting factor and a rationale; the rationale is required when your plan differs from the suggestion. The summary sits on the same page, with print or save as PDF (one page per side), copy note and CSV download.

Each question is written in plain language, with answers as small buttons on the same line. Its **(?)** explains what to consider and quotes the original framework wording. The **Next** button shows how many required items are still missing on that step.

The **Try an example** menu loads fictional teaching cases.

## How to measure

The *How to measure* tab has an original schematic (*schematic, not to scale*) and the steps:

1. Use a sagittal MIP.
2. Measure A and C as craniocaudal projections with the same reference convention, and record the endpoints separately.
3. Record the 3D length separately, if wanted.
4. Identify the arcuate line, or estimate it at one-third of the umbilicus–pubis distance, and record which.

- **A** is the intramuscular course (craniocaudal).
- **C** is the distance from the perforator to the external iliac origin (craniocaudal).
- **B = C − A** is the projected fascial saving.

2.5 and 5 cm are reported research anchors, not validated boundaries.

## How the suggestion works

`suggestPlan()` in `assets/js/logic.js` applies these rules in order; the first match wins.

| Rule | Condition | Suggestion |
| --- | --- | --- |
| a | Any Gate 1 item = No | No plan; reassess message |
| b | Any Gate 1 item = Uncertain | Additional assessment needed (flap safety not confirmed) |
| c | Any domain = Not assessable, or arcuate line located by = Indeterminate | Additional assessment needed |
| d | Access = No feasible robotic route | Consider hybrid or conventional harvest |
| e | Benefit = Small | Consider hybrid or conventional harvest |
| f | Highest complexity grade = High and benefit = Substantial | Individualized or expert review |
| g | Highest complexity grade = High and benefit = Moderate | Individualized or expert review, flagged *Outside the typical scenarios; nearest match shown.* |
| h | Highest complexity grade = Moderate and team = Early in program | Individualized or expert review |
| i | Otherwise | Consider robotic harvest |

The highest complexity grade across the three domains is used only to match a typical scenario. It is not an overall category. No validated rule combines the domains.

### Tool defaults (disclosure)

> The B/C cutoffs and plan-matching order used in this calculator are tool defaults for prospective evaluation and are not part of the published framework.

The benefit grade is suggested from B/C with these cutoffs:

- **Substantial** if B/C ≥ 0.67.
- **Moderate** if 0.33 ≤ B/C < 0.67.
- **Small** if B/C < 0.33.

The cutoffs are applied literally. For example, a B/C of exactly two-thirds (66.7%) is graded Moderate.

### Implementation choices not specified by the framework

These behaviours are deliberate and covered by the unit tests. None of them adds a clinical rule.

- **Measurement precision:**
  - Measurements are handled in integer tenths of a centimetre, so 12.2 − 3.1 is exactly 9.1.
  - Values with more than one decimal are flagged rather than rounded, because rounding could move a value across the 2.5 or 5 cm anchors.
  - A decimal comma is accepted.
- **Paramuscular course:** if "Paramuscular or subfascial course" is ticked and A is blank, A is taken as 0, so B = C.
- **B/C display:** B/C is shown to one decimal place. In the rare case where rounding would cross a cutoff, extra decimals are shown (for example 66.99%), so the number shown never contradicts the grade.
- **Overrides:** a grade counts as *overridden* only while it differs from the automatic or suggested grade.
- **Required fields:**
  - The route is not required when access is "No feasible robotic route" or "Not assessable".
  - The arcuate-line relation is not required when the line is "Indeterminate".
- **Principal limiting factor suggestion** (also labelled *Suggestion (unvalidated)*), following the matched rule:
  - Gate 1 Uncertain → Flap safety.
  - Not assessable → that domain; an indeterminate arcuate line → Expected benefit.
  - No feasible robotic route → Access.
  - Small benefit → "Small expected benefit".
  - Otherwise, the complexity domain(s) with the least favorable grade, with ties all listed. When every complexity domain is Low, nothing is suggested, or "Expected benefit" when the benefit is Moderate.
  - Team experience is never suggested automatically.
- **"Why this suggestion" text** is assembled only from the rule wording and the inputs.
- **Gate 1 failures:** a side that fails Gate 1 can still be documented. Its summary, note and CSV row contain the Gate 1 answers and the reassess message only.
- **Step order:** steps open in order at least once, so the pre-suggested benefit grade (Step 4) is always seen before Step 5.

## Privacy

All calculations run in your browser; nothing is stored or sent.

- **No identifying fields:** there are no fields for name, record number, date of birth or dates of service.
- **No storage:** no cookies, `localStorage` or other browser storage, and no analytics.
- **No network access:** the page's Content-Security-Policy blocks every network connection (`connect-src 'none'`).
- **Nothing persists:** reloading or closing the page clears the case, and the page warns you before you leave an unsaved case.
- **Exports stay on your device:** printed pages, copied notes and CSV files go only where you save or paste them.

## Run locally

There are no dependencies and no build step.

- **Open from disk:** open `index.html` directly in any browser. The scripts are classic scripts rather than ES modules, so this works from `file://` in every browser.
- **Or serve it:**

  ```bash
  python3 -m http.server 8000
  ```

  Then open http://localhost:8000.

## Tests

```bash
node --test
```

The tests use Node 20 or newer, with `node:test` and `node:assert` only. They cover:

- The intramuscular-course auto-grade.
- B and B/C, including the cutoff boundaries.
- Validation.
- Every plan rule a–i, including precedence.
- Limiting-factor ties.
- CSV escaping.
- The exact copy-note template.
- A word-for-word check of the key clinical strings in `framework.js`.
- Guards against storage or network APIs.

GitHub Actions runs the same command on every push and pull request (`.github/workflows/test.yml`).

## Deploy to GitHub Pages

1. Merge into `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Source: Deploy from a branch**, then **Branch: `main`** and **Folder: `/ (root)`**, and click **Save**.
4. After a minute or two the site is live at https://sorrad.github.io/RoBoDIEP/.

The empty `.nojekyll` file tells Pages to serve the files as they are.

## Update clinical text or cutoffs

1. Edit **`assets/js/framework.js` only**. It holds every clinical string, option, cutoff, the citation and the version. `logic.js` and `app.js` never need to change for wording or cutoffs.
2. Bump `version` and `date` in `framework.js`. The version is printed on every note, CSV row and printed page.
3. Add an entry to `CHANGELOG.md`.
4. If you changed wording on purpose, update the matching expected strings in `tests/logic.test.mjs`.
5. Run `node --test`.

The article citation is hidden while the manuscript is under internal review. When it can be cited, fill in the `citation` fields in `framework.js` and set `citation.show` to `true`; this brings back the "How to cite" card, the footer link and the citation line on printed pages. Add a matching `preferred-citation` to `CITATION.cff`.

## Project structure

```
index.html                    single-page app (calculator and information tabs)
assets/css/styles.css         styles, dark theme, print styles
assets/js/framework.js        all clinical text, options, cutoffs, citation, version
assets/js/logic.js            pure functions: grading, plan suggestion, validation, exports
assets/js/app.js              user interface wiring only
assets/img/measurements.svg   original schematic of A, B and C
tests/logic.test.mjs          unit tests (node:test)
```

## Accessibility

- **Semantic structure:** semantic HTML, with a fieldset and legend for every choice group.
- **Keyboard:** full keyboard operation with visible focus.
- **Screen readers:** a live region announces the suggestion and errors.
- **Help on demand:** help text and notes sit behind (?) tips that open on hover, keyboard focus or tap.
- **Contrast:** WCAG 2.1 AA, checked with axe-core in light and dark themes.
- **Not colour alone:** every grade shows its word and an icon.
- **System settings:** the page follows the system's light or dark setting and its reduced-motion preference.

## License

- **Code:** [MIT](LICENSE).
- **Clinical text, documentation and the schematic:** [CC BY 4.0](LICENSE-CONTENT.md).

© 2026 Reza Shahriarirad and Aparna Vijayasekaran.

Mayo Clinic and the triple-shield logo are trademarks of Mayo Foundation for Medical Education and Research, used with permission. They are not covered by the licenses above.

Found a problem? [Report an issue](https://github.com/SoRRad/RoBoDIEP/issues). Please do not include patient information.
