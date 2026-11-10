/*
 * Robotic DIEP Selection Calculator: framework configuration
 * ----------------------------------------------------------------------------
 * ALL clinical text, options, cutoffs, citation details and the version live in
 * this one file. The decision logic (logic.js) and the interface (app.js) read
 * everything from here, so wording or cutoffs can be updated without touching
 * either of them.
 *
 * To update:
 *   1. Edit the text or values below. Keep the keys unchanged.
 *   2. Bump `version` and `date`.
 *   3. Add an entry to CHANGELOG.md.
 *   4. Run the tests: `node --test`. tests/logic.test.mjs checks the key
 *      clinical strings word for word, so update the test when wording changes
 *      on purpose.
 *
 * Exact characters matter: the en dash (–), em dash (—), minus sign (−),
 * ≤ and ≥ are deliberate.
 *
 * The file is a classic script (not an ES module) so the site also works when
 * index.html is opened directly from disk; see the export block at the end.
 */
'use strict';

const FRAMEWORK = {
  version: '1.0.0',
  date: '2026-11-10',

  meta: {
    toolName: 'Robotic DIEP Selection Calculator',
    wordmark: 'RoBoDIEP',
    authors: ['Reza Shahriarirad', 'Aparna Vijayasekaran'],
    // Optional: add affiliations in author order, e.g. ['University A', 'Hospital B'].
    affiliations: [],
    copyrightYear: '2026',
    repoUrl: 'https://github.com/SoRRad/RoBoDIEP',
    issuesUrl: 'https://github.com/SoRRad/RoBoDIEP/issues',
    changelogUrl: 'https://github.com/SoRRad/RoBoDIEP/blob/main/CHANGELOG.md',
    siteUrl: 'https://sorrad.github.io/RoBoDIEP/',
    license: {
      code: 'MIT',
      content: 'CC BY 4.0',
      contentUrl: 'https://creativecommons.org/licenses/by/4.0/'
    }
  },

  // Citation of the source article. When it is published, fill in
  // `yearVolumeArticle` (e.g. '2027;15(1):e1234') and `doi`
  // (e.g. '10.1097/GOX.0000000000001234'); the "pending" text then disappears.
  citation: {
    authors: 'Shahriarirad R, Vijayasekaran A',
    title: 'Patient Selection for Robotic-Assisted DIEP Flap Harvest Using Preoperative CT Angiography: A Systematic Review With Exploratory Meta-analysis and a Proposed Selection Framework',
    journal: 'Plast Reconstr Surg Glob Open',
    yearVolumeArticle: '',
    doi: '',
    pendingText: 'Publication pending.'
  },

  disclaimer: 'Research and educational tool. Not a medical device. Not validated for clinical decision-making. Does not replace surgical judgment. Intraoperative findings always take precedence.',
  privacy: 'All calculations run in your browser; nothing is stored or sent',
  suggestionLabel: 'Suggestion (unvalidated)',
  finalPlanNote: "The surgeon's own selection is always the final plan.",

  caseLabel: {
    label: 'Case label',
    hint: 'Do not enter patient identifiers.',
    maxLength: 60
  },

  bilateralToggle: 'Assess both sides',
  sides: ['Left', 'Right'],
  sideLong: { Left: 'Left hemiabdomen', Right: 'Right hemiabdomen' },
  sideQuestion: 'Side assessed (hemiabdomen)',

  tabs: {
    calculator: 'Calculator',
    measure: 'How to measure',
    evidence: 'Evidence',
    about: 'About & cite'
  },

  steps: [
    'Flap safety',
    'CT measurements',
    'Technical complexity',
    'Expected benefit',
    'Integrated plan',
    'Summary and export'
  ],

  // Step 1
  gate1: {
    title: 'Gate 1 — Flap safety (hard stop)',
    items: [
      { id: 'perforators', text: 'Perforators adequate for the planned flap volume and territory' },
      { id: 'flow', text: 'Arterial inflow and venous drainage judged adequate for the planned flap (vein caliber, SIEV, superficial–deep connection); unresolved concerns require reassessment' },
      { id: 'notCompromised', text: 'Perforator selection not compromised solely to facilitate robotic harvest' }
    ],
    answers: { yes: 'Yes', no: 'No', uncertain: 'Uncertain' },
    failMessage: 'Reassess the flap and perforator plan. Consider conventional DIEP only if an adequately perfused alternative harvest is feasible; otherwise consider another reconstructive option.',
    uncertainReason: 'Flap safety not confirmed',
    statusText: { passed: 'passed', notConfirmed: 'not confirmed', failed: 'failed' }
  },

  // Step 2
  ct: {
    title: 'CT measurements',
    unit: 'cm',
    A: {
      label: 'A = intramuscular course, craniocaudal extent (projected on sagittal MIP)',
      requirement: 'required unless the course is paramuscular/subfascial'
    },
    paramuscular: {
      label: 'Paramuscular or subfascial course',
      hint: 'when checked, A may be 0 or blank and the course grade is Low'
    },
    C: {
      label: 'C = perforator to external iliac origin, craniocaudal projection, same projection and reference convention as A',
      requirement: 'required'
    },
    course3d: {
      label: '3D intramuscular course length (optional; recorded only, never used in calculations)',
      help: 'Do not mix 3D length with the projected A.'
    },
    arcuateRelation: {
      label: 'Arcuate line relation of the predicted robotic incision',
      options: { above: 'Above', crossing: 'Crossing', below: 'Below' }
    },
    arcuateMethod: {
      label: 'Arcuate line located by',
      options: {
        identified: 'Identified on imaging',
        estimated: 'Estimated (one-third of the umbilicus–pubis distance)',
        indeterminate: 'Indeterminate'
      }
    },
    B: { label: 'B = C − A (projected fascial saving, cm)' },
    ratio: { label: 'B/C (%)' },
    surrogateLabel: 'Projected surrogate; not validated against outcomes.',
    help: 'A = intramuscular course and C = perforator to external iliac origin, both as craniocaudal projections; B = C − A is the projected fascial saving. Record 3D course length separately; do not mix the two. 2.5 and 5 cm are reported research anchors, not validated boundaries.',
    maxCm: 99.9
  },

  // Step 3
  complexity: {
    title: 'Technical complexity',
    subtitle: 'Grade each domain separately',
    grades: { low: 'Low', moderate: 'Moderate', high: 'High', na: 'Not assessable' },
    order: ['config', 'course', 'access'],
    domains: {
      config: {
        label: 'Required perforator configuration',
        short: 'configuration',
        descriptors: {
          low: 'All required perforators in one fascial window on one DIEA branch',
          moderate: 'Required perforators on one DIEA branch, in separate fascial windows',
          high: 'Required perforators on separate DIEA trunks'
        }
      },
      course: {
        label: 'Intramuscular course (A)',
        short: 'course',
        descriptors: {
          low: '≤2.5 cm, or paramuscular or subfascial',
          moderate: '>2.5 to 5 cm',
          high: '>5 cm'
        },
        tags: { auto: 'auto', overridden: 'overridden' }
      },
      access: {
        label: 'Access for the planned route (TAPP or TEP)',
        short: 'access',
        routeLabel: 'Planned route',
        routes: { TAPP: 'TAPP', TEP: 'TEP' },
        descriptors: {
          low: 'No scar, mesh or suspected adhesions affecting the planned route',
          moderate: 'Scar or suspected adhesions affect the planned route, which remains feasible',
          high: 'Mesh, dense scar or extensive adhesions affect the planned route; feasible only for an experienced team'
        },
        noRoute: 'No feasible robotic route',
        help: 'Grade by the consequences for the planned route, not by surgical-history labels alone.'
      }
    },
    team: {
      label: 'Team experience with robotic DIEP harvest',
      options: { established: 'Established', early: 'Early in program' },
      help: 'Published learning curves describe dissection time, not validated competence.'
    },
    // Intramuscular-course auto-grade: Low if A ≤ lowMaxCm (or paramuscular or
    // subfascial), Moderate if A ≤ moderateMaxCm, otherwise High.
    courseCutoffs: { lowMaxCm: 2.5, moderateMaxCm: 5 }
  },

  // Step 4
  benefit: {
    title: 'Expected benefit',
    subtitle: 'Graded separately from complexity',
    domainLabel: 'Projected fascial saving (B = C − A)',
    grades: { substantial: 'Substantial', moderate: 'Moderate', small: 'Small', na: 'Not assessable' },
    descriptors: {
      substantial: 'Most of the conventional exposure spared',
      moderate: 'Part of the conventional exposure spared',
      small: 'Little spared; A approaches C'
    },
    // Example cutoffs (tool defaults): Substantial if B/C ≥ substantialMin;
    // Moderate if moderateMin ≤ B/C < substantialMin; Small if B/C < moderateMin.
    cutoffs: { substantialMin: 0.67, moderateMin: 0.33 },
    suggestedLabel: 'Suggested from B/C using author-proposed example cutoffs; not validated. Override if your assessment differs.',
    tags: { suggested: 'suggested', overridden: 'overridden' },
    arcuateModifierLabel: 'Arcuate line relation (recorded modifier; no grade change)',
    arcuateNote: 'Part of the incision lies at or below the arcuate line; record this when weighing the benefit.',
    notAssessableRule: 'Not assessable (for example, an indeterminate arcuate line or an uncertain access plane): obtain further assessment; do not assume a grade.'
  },

  // Step 5
  plan: {
    title: 'Integrated plan',
    intro: 'Integrated assessment: weigh complexity, expected benefit and team experience together. Document the principal limiting factor and the rationale for the plan. No validated rule combines the domains.',
    order: ['robotic', 'expert', 'hybrid', 'assess'],
    plans: {
      robotic: { label: 'Consider robotic harvest', scenario: 'Substantial or moderate benefit with low or moderate complexity' },
      expert: { label: 'Individualized or expert review', scenario: 'Substantial benefit with high complexity, or moderate complexity early in a program' },
      hybrid: { label: 'Consider hybrid or conventional harvest', scenario: 'Small expected benefit, or no feasible robotic route' },
      assess: { label: 'Additional assessment needed', scenario: 'Any domain not assessable' }
    },
    footnote: 'Typical scenarios are author-proposed examples for prospective evaluation, not rules.',
    whyTitle: 'Why this suggestion',
    outsideFlag: 'Outside the typical scenarios; nearest match shown.',
    highestNote: 'the highest complexity grade across the three domains is used only to match a typical scenario; it is not an overall category.',
    smallBenefitFactor: 'Small expected benefit',
    selectedLabel: 'Selected plan',
    limitingLabel: 'Principal limiting factor',
    limitingOrder: ['config', 'course', 'access', 'benefit', 'team', 'flapSafety', 'other'],
    limitingOptions: {
      config: 'Perforator configuration',
      course: 'Intramuscular course',
      access: 'Access',
      benefit: 'Expected benefit',
      team: 'Team experience',
      flapSafety: 'Flap safety',
      other: 'Other'
    },
    otherLabel: 'Other limiting factor (describe)',
    rationaleLabel: 'Rationale',
    rationaleMax: 500,
    differs: 'Differs from suggestion',
    override: 'Intraoperative override: perfusion assessment (clinical or ICG) and the anatomy found at surgery take precedence; convert to hybrid or open harvest at any step.',

    // Plan matching, applied in this order; the first match wins.
    rules: [
      { id: 'a', condition: 'Any Gate 1 item = No', outcome: null },
      { id: 'b', condition: 'Any Gate 1 item = Uncertain', outcome: 'assess' },
      { id: 'c', condition: 'Any domain = Not assessable, or arcuate line located by = Indeterminate', outcome: 'assess' },
      { id: 'd', condition: 'Access = No feasible robotic route', outcome: 'hybrid' },
      { id: 'e', condition: 'Benefit = Small', outcome: 'hybrid' },
      { id: 'f', condition: 'Highest complexity grade = High and benefit = Substantial', outcome: 'expert' },
      { id: 'g', condition: 'Highest complexity grade = High and benefit = Moderate', outcome: 'expert' },
      { id: 'h', condition: 'Highest complexity grade = Moderate and team = Early in program', outcome: 'expert' },
      { id: 'i', condition: 'Otherwise', outcome: 'robotic' }
    ],
    noPlanOutcome: 'No plan; reassess',

    // "Why" reasons are assembled from these templates and the inputs only.
    reasons: {
      b: 'Flap safety not confirmed',
      cDomains: 'Not assessable: {domains}',
      cArcuate: 'arcuate line indeterminate',
      d: 'No feasible robotic route',
      e: 'Small expected benefit',
      f: 'Substantial benefit with high complexity ({domains})',
      g: 'Moderate benefit with high complexity ({domains})',
      h: 'Moderate complexity ({domains}) early in a program',
      iLow: '{benefit} benefit with low complexity',
      iModerate: '{benefit} benefit with moderate complexity ({domains}) and an established team'
    },
    benefitShort: 'expected benefit'
  },

  // Step 6
  summary: {
    title: 'Summary and export',
    actions: {
      print: 'Print / Save as PDF',
      copy: 'Copy note',
      csv: 'Download CSV',
      reset: 'Start new case'
    },
    // Plain-text note. {placeholders} are filled by logic.buildNote().
    note: {
      header: 'ROBOTIC DIEP SELECTION – {side}',
      gate: 'Gate 1 (flap safety): {status}',
      cta: 'CTA: A {A} cm{paramuscular} | C {C} cm | B {B} cm (B/C {ratio}) | 3D course {course3d} | Arcuate: {relation}, {method}',
      paramuscular: ' (paramuscular or subfascial)',
      complexity: 'Complexity: configuration {config}; course {course}; access{route} {access}',
      benefit: 'Expected benefit: {benefit} ({source})',
      team: 'Team: {team}',
      suggested: 'Suggested (unvalidated): {plan} – {reason}',
      selected: 'Selected: {plan} | Limiting factor: {factor} | Rationale: {rationale}',
      tool: 'Tool: Robotic DIEP Selection Calculator v{version}; research use only.',
      notRecorded: 'not recorded'
    },
    csvColumns: [
      'tool_version', 'case_label', 'side', 'route',
      'gate1_perforators', 'gate1_flow', 'gate1_not_compromised',
      'A_cm', 'C_cm', 'B_cm', 'B_over_C', 'course_3d_cm', 'paramuscular',
      'arcuate_relation', 'arcuate_method',
      'config_grade', 'course_grade', 'course_grade_source', 'access_grade',
      'team_experience', 'benefit_grade', 'benefit_grade_source',
      'suggested_plan', 'suggestion_reason', 'selected_plan', 'limiting_factor', 'rationale'
    ],
    csvBoolean: { true: 'yes', false: 'no' }
  },

  // Validation messages
  messages: {
    sideRequired: 'Choose the side (hemiabdomen) assessed.',
    answerRequired: 'Answer this item.',
    aRequired: 'Enter A in cm, or tick “Paramuscular or subfascial course”.',
    cRequired: 'Enter C in cm.',
    format: 'Enter a number in cm, for example 3.1.',
    decimals: 'Use one decimal place, for example 3.1.',
    aNegative: 'A must be 0 or greater.',
    cPositive: 'C must be greater than 0.',
    course3dPositive: 'Enter a positive number, or leave this blank.',
    max: 'Enter a value up to 99.9 cm.',
    aGeC: 'A cannot equal or exceed C. Check that both use the same craniocaudal projection.',
    relationRequired: 'Choose the arcuate line relation.',
    methodRequired: 'Choose how the arcuate line was located.',
    gradeRequired: 'Choose a grade.',
    routeRequired: 'Choose the planned route (TAPP or TEP).',
    teamRequired: 'Choose the team experience.',
    planRequired: 'Choose the plan you are selecting.',
    limitingRequired: 'Choose the principal limiting factor.',
    otherRequired: 'Describe the other limiting factor.',
    rationaleRequired: 'A rationale is required when the selected plan differs from the suggestion.'
  },

  // "How to measure" tab
  measure: {
    title: 'How to measure',
    intro: 'Measure on the preoperative CT angiogram. A and C use the same craniocaudal projection and reference convention; B is calculated.',
    schematicCaption: 'Schematic, not to scale.',
    schematicAlt: 'Schematic sagittal view of the lower abdominal wall. The perforator exits the anterior rectus sheath, runs through the rectus abdominis muscle and joins the deep inferior epigastric artery (DIEA), which runs caudally to its origin from the external iliac artery. A marks the craniocaudal extent of the intramuscular course; C marks the craniocaudal distance from the perforator to the external iliac origin; B = C − A is the remaining distance. The arcuate line is marked.',
    definitions: [
      { term: 'A', text: 'Intramuscular course, craniocaudal' },
      { term: 'C', text: 'Perforator to external iliac origin, craniocaudal' },
      { term: 'B = C − A', text: 'Projected fascial saving' }
    ],
    steps: [
      'Use a sagittal MIP.',
      'Measure A and C as craniocaudal projections with the same reference convention, and record the endpoints separately.',
      'Record the 3D length separately, if wanted.',
      'Identify the arcuate line, or estimate it at one-third of the umbilicus–pubis distance, and record which.'
    ]
  },

  // "Evidence" tab: plain-language summary. Numbers must match the article.
  evidence: {
    title: 'Evidence',
    intro: 'Plain-language summary of the systematic review behind the framework.',
    cardTitles: {
      review: 'The evidence base',
      criteria: 'Selection criteria',
      eligibility: 'Eligibility and cutoffs',
      fascia: 'Fascial incision',
      periop: 'Perioperative course',
      safety: 'Safety and abdominal wall',
      note: 'Tool defaults'
    },
    points: {
      review: 'Systematic review of 27 reports (2018–2026) from 18 programs in 9 countries; about 126–171 robotic patients; none randomized.',
      criteria: 'No selection criterion has been validated against outcomes. Intramuscular-course cutoffs ranged from 2.5 to 5 cm; perforator size cutoffs from 1 to 2.7 mm.',
      eligibility: 'In one cohort, eligibility rose from 46% (≤2.5 cm) to 93% (≤5 cm).',
      fascia: 'Fascial incision about 65% shorter with robotic harvest (ratio of means 0.35; robotic about 3.5 cm). Low certainty.',
      periop: 'Operative time about 75 minutes longer; hospital stay about 0.6 days shorter; early pain lower. Very low certainty.',
      safety: 'Total flap loss 1 of 135 robotic flaps; conversion 1 of 79; no hernia in 60 or bulge in 41 explicitly assessed patients, over about 5–15 months of follow-up. Long-term abdominal-wall benefit is unproven.'
    },
    note: 'The B/C cutoffs and plan-matching order used in this calculator are tool defaults for prospective evaluation and are not part of the published framework.',
    // Figures drawn from the sentences above (same numbers) for the visuals.
    figures: {
      kpis: [
        { value: '27', label: 'reports, 2018–2026' },
        { value: '18', label: 'programs' },
        { value: '9', label: 'countries' },
        { value: '126–171', label: 'robotic patients (about)' },
        { value: 'None', label: 'randomized' }
      ],
      ranges: [
        { label: 'Intramuscular-course cutoffs', value: '2.5 to 5 cm' },
        { label: 'Perforator size cutoffs', value: '1 to 2.7 mm' }
      ],
      eligibility: [
        { label: '≤2.5 cm', percent: 46 },
        { label: '≤5 cm', percent: 93 }
      ],
      fascia: { ratio: 0.35, ratioLabel: 'ratio of means 0.35', shorter: 'about 65% shorter', robotic: 'robotic about 3.5 cm', certainty: 'Low certainty' },
      periop: {
        items: [
          { value: 'about 75 min', label: 'longer operative time' },
          { value: 'about 0.6 days', label: 'shorter hospital stay' },
          { value: 'lower', label: 'early pain' }
        ],
        certainty: 'Very low certainty'
      },
      safety: {
        items: [
          { label: 'Total flap loss', events: 1, total: 135, unit: 'robotic flaps' },
          { label: 'Conversion', events: 1, total: 79, unit: '' },
          { label: 'Hernia', events: 0, total: 60, unit: 'explicitly assessed patients' },
          { label: 'Bulge', events: 0, total: 41, unit: 'explicitly assessed patients' }
        ],
        followUp: 'about 5–15 months of follow-up',
        caveat: 'Long-term abdominal-wall benefit is unproven.'
      }
    }
  },

  // "About & cite" tab
  about: {
    title: 'About & cite',
    cardTitles: {
      purpose: 'About this tool',
      disclaimer: 'Disclaimer',
      privacy: 'Privacy',
      cite: 'How to cite',
      rules: 'How the suggestion works',
      version: 'Version and license',
      feedback: 'Feedback'
    },
    purpose: 'This calculator is an interactive, research-use version of the patient-selection framework proposed in the systematic review cited below. It walks through a flap-safety gate, CT angiography measurements, separately graded technical complexity and expected benefit, and an integrated plan. The suggested plan is unvalidated and is shown to support documentation and prospective evaluation only.',
    privacyDetails: [
      'There are no fields for names, record numbers, dates of birth or dates of service. Do not enter patient identifiers in the case label or the rationale.',
      'No cookies, analytics, tracking or external requests. Reloading or closing the page clears the case.',
      'Printed pages, copied notes and CSV files are created on your device and go only where you save or paste them.'
    ],
    reportIssue: 'Report an issue'
  }
};

/* ---------------------------------------------------------------------------
 * Export block. Do not edit below this line.
 * Works as a classic browser script (window.RoboDIEP.FRAMEWORK) and in Node
 * (globalThis.RoboDIEP.FRAMEWORK or require()).
 * ------------------------------------------------------------------------- */
(function exportFramework(root) {
  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    }
    return value;
  }
  deepFreeze(FRAMEWORK);
  root.RoboDIEP = root.RoboDIEP || {};
  root.RoboDIEP.FRAMEWORK = FRAMEWORK;
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = { FRAMEWORK: FRAMEWORK };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
