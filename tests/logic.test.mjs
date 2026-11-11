// Unit tests for the Robotic DIEP Selection Calculator.
// Run with: node --test   (Node 20+, no dependencies)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';

// Load the classic scripts exactly as the browser does: into the global scope, in order.
for (const file of ['../assets/js/framework.js', '../assets/js/logic.js']) {
  const url = new URL(file, import.meta.url);
  runInThisContext(readFileSync(url, 'utf8'), { filename: url.pathname });
}
const { FRAMEWORK: FW, logic: L } = globalThis.RoboDIEP;

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ------------------------------------------------------------------------- */
/* Fixtures                                                                  */
/* ------------------------------------------------------------------------- */

const allYes = { perforators: 'yes', flow: 'yes', notCompromised: 'yes' };

/** A complete suggestPlan input that matches rule i (Consider robotic harvest). */
function input(overrides = {}) {
  return {
    gate1: { ...allYes },
    config: 'low',
    course: 'low',
    access: 'low',
    benefit: 'substantial',
    team: 'established',
    arcuateMethod: 'identified',
    ...overrides
  };
}

/** The fixed worked example used for the note and CSV tests. */
function fixedExample() {
  const side = L.createSide('Left');
  Object.assign(side.gate1, allYes);
  Object.assign(side.m, {
    A: '3.1', C: '12.2', course3d: '4.0', paramuscular: false,
    arcuateRelation: 'above', arcuateMethod: 'identified'
  });
  Object.assign(side.cx, { config: 'low', courseOverride: null, route: 'TAPP', access: 'low', team: 'established' });
  Object.assign(side.plan, {
    selected: 'robotic', limiting: 'course', limitingOther: '',
    rationale: 'Single dominant perforator; short intramuscular course.'
  });
  return side;
}

/** Minimal RFC 4180 parser, used to round-trip the CSV output. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ------------------------------------------------------------------------- */
/* Course auto-grade                                                         */
/* ------------------------------------------------------------------------- */

describe('Intramuscular course auto-grade', () => {
  test('2.5 → Low', () => assert.equal(L.gradeCourse(2.5, false), 'low'));
  test('2.6 → Moderate', () => assert.equal(L.gradeCourse(2.6, false), 'moderate'));
  test('5.0 → Moderate', () => assert.equal(L.gradeCourse(5.0, false), 'moderate'));
  test('5.1 → High', () => assert.equal(L.gradeCourse(5.1, false), 'high'));
  test('paramuscular → Low (with or without A)', () => {
    assert.equal(L.gradeCourse('', true), 'low');
    assert.equal(L.gradeCourse(7.4, true), 'low');
  });
  test('string input and decimal comma behave the same', () => {
    assert.equal(L.gradeCourse('2,5', false), 'low');
    assert.equal(L.gradeCourse('5.10', false), 'high');
  });
  test('grade words come from the framework', () => {
    assert.equal(FW.complexity.grades[L.gradeCourse(2.6)], 'Moderate');
  });
});

/* ------------------------------------------------------------------------- */
/* B and B/C                                                                 */
/* ------------------------------------------------------------------------- */

describe('B = C − A and B/C', () => {
  test('A 3.1, C 12.2 → B 9.1, B/C 0.746 → Substantial', () => {
    const s = L.computeSaving(3.1, 12.2);
    assert.equal(s.B, 9.1); // exact, not 9.0999…
    assert.equal(Math.round(s.ratio * 1000) / 1000, 0.746);
    assert.equal(L.formatRatio(s.bTenths, s.cTenths), '0.746');
    assert.equal(L.formatPercent(s.bTenths, s.cTenths), '74.6%');
    assert.equal(L.suggestBenefit(s.ratio), 'substantial');
  });

  test('A 6, C 10 → B/C 0.40 → Moderate', () => {
    const s = L.computeSaving(6, 10);
    assert.equal(s.B, 4);
    assert.equal(s.ratio, 0.4);
    assert.equal(L.suggestBenefit(s.ratio), 'moderate');
  });

  test('A 8, C 10 → Small', () => {
    const s = L.computeSaving(8, 10);
    assert.equal(s.ratio, 0.2);
    assert.equal(L.suggestBenefit(s.ratio), 'small');
  });

  test('literal cutoffs at the boundaries', () => {
    assert.equal(L.suggestBenefit(L.computeSaving(3.3, 10).ratio), 'substantial'); // B/C = 0.67
    assert.equal(L.suggestBenefit(L.computeSaving(6.7, 10).ratio), 'moderate'); // B/C = 0.33
    assert.equal(L.suggestBenefit(L.computeSaving(6.8, 10).ratio), 'small'); // B/C = 0.32
    assert.equal(L.suggestBenefit(L.computeSaving(4.0, 12.0).ratio), 'moderate'); // exactly two-thirds
  });

  test('the displayed B/C never contradicts the suggested grade', () => {
    const near = L.computeSaving(3.4, 10.3); // 6.9 / 10.3 = 0.66990…
    assert.equal(L.suggestBenefit(near.ratio), 'moderate');
    assert.equal(L.formatPercent(near.bTenths, near.cTenths), '66.99%'); // not "67.0%"
    assert.equal(L.formatRatio(near.bTenths, near.cTenths), '0.6699'); // not "0.670"
    const third = L.computeSaving(4.0, 12.0);
    assert.equal(L.formatPercent(third.bTenths, third.cTenths), '66.7%');
  });

  test('invalid pairs return null', () => {
    assert.equal(L.computeSaving(12, 10), null);
    assert.equal(L.computeSaving(10, 10), null);
    assert.equal(L.computeSaving('', 10), null);
  });
});

/* ------------------------------------------------------------------------- */
/* Validation                                                                */
/* ------------------------------------------------------------------------- */

describe('Measurement validation', () => {
  const base = { course3d: '', paramuscular: false, arcuateRelation: 'above', arcuateMethod: 'identified' };

  test('a valid entry passes and exposes A, B, C and B/C', () => {
    const r = L.validateMeasurements({ ...base, A: '3.1', C: '12.2' });
    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, {});
    assert.equal(r.values.B, 9.1);
  });

  test('A ≥ C is rejected with the specified message', () => {
    const equal = L.validateMeasurements({ ...base, A: '10.0', C: '10' });
    assert.equal(equal.valid, false);
    assert.equal(equal.errors.A, 'A cannot equal or exceed C. Check that both use the same craniocaudal projection.');
    const greater = L.validateMeasurements({ ...base, A: '12', C: '10' });
    assert.equal(greater.errors.A, FW.messages.aGeC);
    assert.equal(greater.values, null);
  });

  test('negative values are rejected', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '-1', C: '10' }).errors.A, FW.messages.aNegative);
    assert.equal(L.validateMeasurements({ ...base, A: '1', C: '-10' }).errors.C, FW.messages.cPositive);
    assert.equal(L.validateMeasurements({ ...base, A: '1', C: '10', course3d: '-2' }).errors.course3d, FW.messages.course3dPositive);
  });

  test('C missing (or zero) is rejected', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '3', C: '' }).errors.C, FW.messages.cRequired);
    assert.equal(L.validateMeasurements({ ...base, A: '', C: '0', paramuscular: true }).errors.C, FW.messages.cPositive);
  });

  test('A is required unless the course is paramuscular or subfascial', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '', C: '10' }).errors.A, FW.messages.aRequired);
    const para = L.validateMeasurements({ ...base, A: '', C: '10', paramuscular: true });
    assert.equal(para.valid, true);
    assert.equal(para.values.A, 0);
    assert.equal(para.values.B, 10);
  });

  test('A may be 0', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '0', C: '10' }).valid, true);
  });

  test('more than one decimal is flagged, not rounded', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '2.55', C: '10' }).errors.A, FW.messages.decimals);
    assert.equal(L.validateMeasurements({ ...base, A: '2.50', C: '10' }).valid, true);
  });

  test('a decimal comma is accepted; other text is rejected', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '3,1', C: '12,2' }).values.B, 9.1);
    assert.equal(L.validateMeasurements({ ...base, A: 'abc', C: '10' }).errors.A, FW.messages.format);
    assert.equal(L.validateMeasurements({ ...base, A: '1e1', C: '20' }).errors.A, FW.messages.format);
  });

  test('values above 99.9 cm are rejected', () => {
    assert.equal(L.validateMeasurements({ ...base, A: '1', C: '100' }).errors.C, FW.messages.max);
  });

  test('the arcuate relation is required unless the line is indeterminate', () => {
    const missing = L.validateMeasurements({ ...base, A: '3', C: '10', arcuateRelation: null });
    assert.equal(missing.errors.arcuateRelation, FW.messages.relationRequired);
    const indeterminate = L.validateMeasurements({ ...base, A: '3', C: '10', arcuateRelation: null, arcuateMethod: 'indeterminate' });
    assert.equal(indeterminate.valid, true);
    const noMethod = L.validateMeasurements({ ...base, A: '3', C: '10', arcuateMethod: null });
    assert.equal(noMethod.errors.arcuateMethod, FW.messages.methodRequired);
  });
});

/* ------------------------------------------------------------------------- */
/* Plan suggestion: rules a–i                                                */
/* ------------------------------------------------------------------------- */

describe('suggestPlan (rules a–i, first match wins)', () => {
  test('a. any Gate 1 item = No → no plan; reassess message', () => {
    const s = L.suggestPlan(input({ gate1: { ...allYes, flow: 'no' } }));
    assert.equal(s.rule, 'a');
    assert.equal(s.status, 'gateFailed');
    assert.equal(s.plan, null);
    assert.equal(s.reason, FW.gate1.failMessage);
  });

  test('a. Gate 1 No overrides everything', () => {
    const s = L.suggestPlan(input({
      gate1: { perforators: 'no', flow: 'uncertain', notCompromised: null },
      config: 'na', access: 'none', benefit: 'small', arcuateMethod: 'indeterminate'
    }));
    assert.equal(s.rule, 'a');
    assert.equal(s.plan, null);
  });

  test('b. any Gate 1 item = Uncertain → Additional assessment needed (Flap safety not confirmed)', () => {
    const s = L.suggestPlan(input({ gate1: { ...allYes, notCompromised: 'uncertain' } }));
    assert.equal(s.rule, 'b');
    assert.equal(s.plan, 'assess');
    assert.equal(s.planLabel, 'Additional assessment needed');
    assert.equal(s.reason, 'Flap safety not confirmed');
  });

  test('b. takes precedence over c, d and e', () => {
    const s = L.suggestPlan(input({ gate1: { ...allYes, flow: 'uncertain' }, config: 'na', access: 'none', benefit: 'small' }));
    assert.equal(s.rule, 'b');
  });

  test('c. each domain = Not assessable → Additional assessment needed', () => {
    for (const key of ['config', 'course', 'access', 'benefit']) {
      const s = L.suggestPlan(input({ [key]: 'na' }));
      assert.equal(s.rule, 'c', key);
      assert.equal(s.plan, 'assess', key);
    }
    assert.equal(L.suggestPlan(input({ access: 'na' })).reason, 'Not assessable: access');
    assert.equal(L.suggestPlan(input({ benefit: 'na' })).reason, 'Not assessable: expected benefit');
  });

  test('c. arcuate line located by = Indeterminate → Additional assessment needed', () => {
    const s = L.suggestPlan(input({ arcuateMethod: 'indeterminate' }));
    assert.equal(s.rule, 'c');
    assert.equal(s.plan, 'assess');
    assert.equal(s.reason, 'Arcuate line indeterminate');
    const both = L.suggestPlan(input({ course: 'na', arcuateMethod: 'indeterminate' }));
    assert.equal(both.reason, 'Not assessable: course; arcuate line indeterminate');
  });

  test('c. precedence: Not assessable plus Small benefit → Additional assessment needed', () => {
    const s = L.suggestPlan(input({ config: 'na', benefit: 'small' }));
    assert.equal(s.rule, 'c');
    assert.equal(s.plan, 'assess');
  });

  test('c. precedence over d: Not assessable plus no feasible route → Additional assessment needed', () => {
    assert.equal(L.suggestPlan(input({ course: 'na', access: 'none' })).rule, 'c');
  });

  test('d. Access = No feasible robotic route → Consider hybrid or conventional harvest', () => {
    const s = L.suggestPlan(input({ access: 'none' }));
    assert.equal(s.rule, 'd');
    assert.equal(s.plan, 'hybrid');
    assert.equal(s.planLabel, 'Consider hybrid or conventional harvest');
    assert.equal(s.reason, 'No feasible robotic route');
  });

  test('d. precedence over e', () => {
    assert.equal(L.suggestPlan(input({ access: 'none', benefit: 'small' })).rule, 'd');
  });

  test('e. Benefit = Small → Consider hybrid or conventional harvest', () => {
    const s = L.suggestPlan(input({ benefit: 'small', config: 'high' }));
    assert.equal(s.rule, 'e');
    assert.equal(s.plan, 'hybrid');
    assert.equal(s.reason, 'Small expected benefit');
  });

  test('f. highest = High and benefit = Substantial → Individualized or expert review', () => {
    const s = L.suggestPlan(input({ access: 'high', team: 'early' }));
    assert.equal(s.rule, 'f');
    assert.equal(s.plan, 'expert');
    assert.equal(s.planLabel, 'Individualized or expert review');
    assert.equal(s.flag, null);
    assert.equal(s.reason, 'Substantial benefit with high complexity (access)');
  });

  test('g. highest = High and benefit = Moderate → Individualized or expert review, flagged', () => {
    const s = L.suggestPlan(input({ config: 'high', course: 'high', benefit: 'moderate' }));
    assert.equal(s.rule, 'g');
    assert.equal(s.plan, 'expert');
    assert.equal(s.flag, 'Outside the typical scenarios; nearest match shown.');
    assert.equal(s.reason, 'Moderate benefit with high complexity (configuration, course)');
    assert.equal(L.fullReason(s), 'Moderate benefit with high complexity (configuration, course). Outside the typical scenarios; nearest match shown.');
  });

  test('h. highest = Moderate and team = Early in program → Individualized or expert review', () => {
    const s = L.suggestPlan(input({ course: 'moderate', team: 'early' }));
    assert.equal(s.rule, 'h');
    assert.equal(s.plan, 'expert');
    assert.equal(s.reason, 'Moderate complexity (course) early in a program');
  });

  test('i. otherwise → Consider robotic harvest', () => {
    const lowEarly = L.suggestPlan(input({ team: 'early' }));
    assert.equal(lowEarly.rule, 'i');
    assert.equal(lowEarly.plan, 'robotic');
    assert.equal(lowEarly.planLabel, 'Consider robotic harvest');
    assert.equal(lowEarly.reason, 'Substantial benefit with low complexity');

    const moderateEstablished = L.suggestPlan(input({ access: 'moderate', benefit: 'moderate' }));
    assert.equal(moderateEstablished.rule, 'i');
    assert.equal(moderateEstablished.reason, 'Moderate benefit with moderate complexity (access) and an established team');
  });

  test('the trace marks earlier rules not met, the match, and later rules not reached', () => {
    const s = L.suggestPlan(input({ config: 'high' }));
    assert.equal(s.rule, 'f');
    assert.deepEqual(s.trace.map((t) => t.status), [
      'notMet', 'notMet', 'notMet', 'notMet', 'notMet', 'matched', 'notReached', 'notReached', 'notReached'
    ]);
  });

  test('"Why this suggestion" lists the inputs that drove it', () => {
    const s = L.suggestPlan(input({ config: 'high', benefit: 'substantial' }));
    assert.deepEqual(s.drivers, [
      { label: 'Required perforator configuration', value: 'High' },
      { label: 'Projected fascial saving (B = C − A)', value: 'Substantial' }
    ]);
  });

  test('incomplete input gives no suggestion', () => {
    assert.equal(L.suggestPlan(input({ gate1: { ...allYes, flow: null } })).status, 'incomplete');
    assert.equal(L.suggestPlan(input({ config: null })).status, 'incomplete');
    assert.equal(L.suggestPlan(input({ course: 'moderate', team: null })).status, 'incomplete');
  });

  test('the highest complexity grade is only a matching aid', () => {
    assert.equal(L.highestComplexity(input({ course: 'moderate' })), 'moderate');
    assert.equal(L.highestComplexity(input({ access: 'none' })), null);
  });
});

/* ------------------------------------------------------------------------- */
/* Limiting factor                                                           */
/* ------------------------------------------------------------------------- */

describe('Suggested principal limiting factor', () => {
  const keys = (inp) => L.suggestLimitingFactor(inp).map((f) => f.key);

  test('ties are all listed', () => {
    assert.deepEqual(keys(input({ config: 'moderate', course: 'moderate', access: 'low', team: 'early' })), ['config', 'course']);
    assert.deepEqual(keys(input({ config: 'high', course: 'high', access: 'high' })), ['config', 'course', 'access']);
    assert.deepEqual(keys(input()), []);
    assert.deepEqual(keys(input({ benefit: 'moderate' })), ['benefit']);
  });

  test('the least favorable domain is suggested', () => {
    assert.deepEqual(keys(input({ access: 'high' })), ['access']);
  });

  test('Small benefit → "Small expected benefit"', () => {
    const f = L.suggestLimitingFactor(input({ benefit: 'small', config: 'high' }));
    assert.deepEqual(f.map((x) => x.key), ['benefit']);
    assert.equal(f[0].label, 'Small expected benefit');
  });

  test('No feasible robotic route → Access', () => {
    assert.deepEqual(keys(input({ access: 'none' })), ['access']);
    assert.deepEqual(keys(input({ access: 'none', benefit: 'small' })), ['access', 'benefit']);
  });

  test('Gate 1 Uncertain → Flap safety; Gate 1 No → none', () => {
    assert.deepEqual(keys(input({ gate1: { ...allYes, flow: 'uncertain' } })), ['flapSafety']);
    assert.deepEqual(keys(input({ gate1: { ...allYes, flow: 'no' } })), []);
  });

  test('Not assessable → that domain; indeterminate arcuate line → Expected benefit', () => {
    assert.deepEqual(keys(input({ config: 'na', access: 'na' })), ['config', 'access']);
    assert.deepEqual(keys(input({ arcuateMethod: 'indeterminate' })), ['benefit']);
  });
});

/* ------------------------------------------------------------------------- */
/* Side evaluation                                                           */
/* ------------------------------------------------------------------------- */

describe('evaluateSide', () => {
  test('the fixed example is complete and suggests robotic harvest', () => {
    const ev = L.evaluateSide(fixedExample());
    assert.equal(ev.status, 'complete');
    assert.equal(ev.course, 'moderate');
    assert.equal(ev.courseSource, 'auto');
    assert.equal(ev.benefit, 'substantial');
    assert.equal(ev.benefitSource, 'suggested');
    assert.equal(ev.suggestion.rule, 'i');
    assert.equal(ev.exportable, true);
  });

  test('course grade: auto until overridden; an override equal to auto counts as auto', () => {
    const side = fixedExample();
    side.cx.courseOverride = 'high';
    let ev = L.evaluateSide(side);
    assert.equal(ev.course, 'high');
    assert.equal(ev.courseSource, 'overridden');
    side.cx.courseOverride = 'moderate';
    ev = L.evaluateSide(side);
    assert.equal(ev.courseSource, 'auto');
  });

  test('benefit grade: suggested until overridden', () => {
    const side = fixedExample();
    side.benefitOverride = 'moderate';
    const ev = L.evaluateSide(side);
    assert.equal(ev.benefit, 'moderate');
    assert.equal(ev.benefitSource, 'overridden');
  });

  test('steps unlock in order', () => {
    const side = L.createSide('Right');
    let ev = L.evaluateSide(side);
    assert.deepEqual(ev.reachable, [true, false, false, false, false, false]);
    Object.assign(side.gate1, allYes);
    ev = L.evaluateSide(side);
    assert.deepEqual(ev.reachable, [true, true, false, false, false, false]);
  });

  test('a unilateral case needs a side; a bilateral one does not', () => {
    const side = L.createSide(null);
    Object.assign(side.gate1, allYes);
    assert.equal(L.evaluateSide(side).steps[0].errors.side, FW.messages.sideRequired);
    assert.equal(L.evaluateSide(side, { bilateral: true }).steps[0].valid, true);
  });

  test('Gate 1 failure locks steps 2–5 but allows the summary', () => {
    const side = fixedExample();
    side.gate1.perforators = 'no';
    const ev = L.evaluateSide(side);
    assert.equal(ev.status, 'failed');
    assert.deepEqual(ev.reachable, [true, false, false, false, false, true]);
  });

  test('the rationale is required only when the selected plan differs', () => {
    const side = fixedExample();
    side.plan.rationale = '';
    assert.equal(L.evaluateSide(side).steps[4].valid, true);
    side.plan.selected = 'hybrid';
    const ev = L.evaluateSide(side);
    assert.equal(ev.differs, true);
    assert.equal(ev.steps[4].errors.rationale, FW.messages.rationaleRequired);
  });

  test('"Other" needs a description', () => {
    const side = fixedExample();
    side.plan.limiting = 'other';
    assert.equal(L.evaluateSide(side).steps[4].errors.limitingOther, FW.messages.otherRequired);
  });

  test('the route is not required when no robotic route is feasible', () => {
    const side = fixedExample();
    side.cx.route = null;
    assert.equal(L.evaluateSide(side).steps[2].errors.route, FW.messages.routeRequired);
    side.cx.access = 'none';
    const ev = L.evaluateSide(side);
    assert.equal(ev.steps[2].valid, true);
    assert.equal(ev.route, null);
    assert.equal(ev.suggestion.rule, 'd');
  });
});

/* ------------------------------------------------------------------------- */
/* Copy note                                                                 */
/* ------------------------------------------------------------------------- */

describe('Copy note', () => {
  test('matches the template exactly for a fixed example', () => {
    assert.equal(L.noteForSide(fixedExample()), [
      'ROBOTIC DIEP SELECTION – Left',
      'Gate 1 (flap safety): passed',
      'CTA: A 3.1 cm | C 12.2 cm | B 9.1 cm (B/C 74.6%) | 3D course 4.0 cm | Arcuate: Above, Identified on imaging',
      'Complexity: configuration Low; course Moderate; access (TAPP) Low',
      'Expected benefit: Substantial (suggested)',
      'Team: Established',
      'Suggested (unvalidated): Consider robotic harvest – Substantial benefit with moderate complexity (course) and an established team',
      'Selected: Consider robotic harvest | Limiting factor: Intramuscular course | Rationale: Single dominant perforator; short intramuscular course.',
      'Tool: Robotic DIEP Selection Calculator v1.0.1; research use only.'
    ].join('\n'));
  });

  test('Gate 1 not confirmed, paramuscular course, no 3D length, overridden benefit', () => {
    const side = fixedExample();
    side.side = 'Right';
    side.gate1.flow = 'uncertain';
    Object.assign(side.m, { A: '', paramuscular: true, course3d: '', arcuateRelation: 'crossing', arcuateMethod: 'estimated' });
    side.benefitOverride = 'moderate';
    Object.assign(side.plan, { selected: 'assess', limiting: 'other', limitingOther: 'SIEV  dominance\nunclear', rationale: '' });
    const lines = L.noteForSide(side).split('\n');
    assert.equal(lines[0], 'ROBOTIC DIEP SELECTION – Right');
    assert.equal(lines[1], 'Gate 1 (flap safety): not confirmed');
    assert.equal(lines[2], 'CTA: A 0.0 cm (paramuscular or subfascial) | C 12.2 cm | B 12.2 cm (B/C 100.0%) | 3D course not recorded | Arcuate: Crossing, Estimated (one-third of the umbilicus–pubis distance)');
    assert.equal(lines[3], 'Complexity: configuration Low; course Low; access (TAPP) Low');
    assert.equal(lines[4], 'Expected benefit: Moderate (overridden)');
    assert.equal(lines[6], 'Suggested (unvalidated): Additional assessment needed – Flap safety not confirmed');
    assert.equal(lines[7], 'Selected: Additional assessment needed | Limiting factor: Other: SIEV dominance unclear | Rationale: not recorded');
  });

  test('a Gate 1 failure gives no grades or plan', () => {
    const side = fixedExample();
    side.gate1.perforators = 'no';
    assert.equal(L.noteForSide(side), [
      'ROBOTIC DIEP SELECTION – Left',
      'Gate 1 (flap safety): failed',
      'Not met: Perforators adequate for the planned flap',
      FW.gate1.failMessage,
      'Tool: Robotic DIEP Selection Calculator v1.0.1; research use only.'
    ].join('\n'));
  });

  test('the early-stop note lists every failed item and the optional note', () => {
    const side = fixedExample();
    side.gate1.perforators = 'no';
    side.gate1.notCompromised = 'no';
    side.stopNote = '  Plan  SIEA flap\ninstead ';
    const lines = L.noteForSide(side).split('\n');
    assert.equal(lines[2], 'Not met: Perforators adequate for the planned flap; Perforator choice not compromised for robotic access');
    assert.equal(lines[4], 'Note: Plan SIEA flap instead');
    assert.deepEqual(L.failedGateItems(side), [FW.gate1.items[0].short, FW.gate1.items[2].short]);
  });

  test('the outside-typical-scenarios flag is carried into the note', () => {
    const side = fixedExample();
    side.cx.config = 'high';
    side.benefitOverride = 'moderate';
    const line = L.noteForSide(side).split('\n')[6];
    assert.equal(line, 'Suggested (unvalidated): Individualized or expert review – Moderate benefit with high complexity (configuration). Outside the typical scenarios; nearest match shown.');
  });

  test('bilateral notes are joined by a blank line', () => {
    const left = fixedExample();
    const right = fixedExample();
    right.side = 'Right';
    const note = L.buildNote([left, right], { bilateral: true });
    assert.equal(note.split('\n\n').length, 2);
    assert.ok(note.split('\n\n')[1].startsWith('ROBOTIC DIEP SELECTION – Right'));
  });
});

/* ------------------------------------------------------------------------- */
/* CSV                                                                       */
/* ------------------------------------------------------------------------- */

describe('CSV export', () => {
  const columns = [
    'tool_version', 'case_label', 'side', 'route', 'gate1_perforators', 'gate1_flow',
    'gate1_not_compromised', 'A_cm', 'C_cm', 'B_cm', 'B_over_C', 'course_3d_cm', 'paramuscular',
    'arcuate_relation', 'arcuate_method', 'config_grade', 'course_grade', 'course_grade_source',
    'access_grade', 'team_experience', 'benefit_grade', 'benefit_grade_source', 'suggested_plan',
    'suggestion_reason', 'selected_plan', 'limiting_factor', 'rationale'
  ];

  test('the header lists the specified columns in order', () => {
    assert.deepEqual([...FW.summary.csvColumns], columns);
    const csv = L.buildCSV([fixedExample()], 'Case 1');
    assert.equal(csv.split('\r\n')[0], columns.join(','));
  });

  test('a full row for the fixed example', () => {
    const csv = L.buildCSV([fixedExample()], 'Case 1');
    assert.equal(csv.split('\r\n')[1], [
      '1.0.1', 'Case 1', 'Left', 'TAPP', 'Yes', 'Yes', 'Yes', '3.1', '12.2', '9.1', '0.746', '4.0', 'no',
      'Above', 'Identified on imaging', 'Low', 'Moderate', 'auto', 'Low', 'Established', 'Substantial',
      'suggested', 'Consider robotic harvest',
      'Substantial benefit with moderate complexity (course) and an established team',
      'Consider robotic harvest', 'Intramuscular course', 'Single dominant perforator; short intramuscular course.'
    ].join(','));
    assert.ok(csv.endsWith('\r\n'));
  });

  test('RFC 4180 escaping of commas, quotes and line breaks in the rationale', () => {
    const side = fixedExample();
    side.plan.rationale = 'Short course, one "dominant" perforator\nsecond line\r\nthird line';
    const csv = L.buildCSV([side], 'Case 1');
    assert.ok(csv.includes('"Short course, one ""dominant"" perforator\nsecond line\r\nthird line"'));
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].length, columns.length);
    assert.equal(rows[1][columns.indexOf('rationale')], side.plan.rationale);
  });

  test('csvEscape quotes only when needed', () => {
    assert.equal(L.csvEscape('plain text'), 'plain text');
    assert.equal(L.csvEscape('a,b'), '"a,b"');
    assert.equal(L.csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(L.csvEscape('line1\nline2'), '"line1\nline2"');
    assert.equal(L.csvEscape(null), '');
  });

  test('free text that looks like a spreadsheet formula is neutralised', () => {
    const side = fixedExample();
    side.plan.rationale = '=HYPERLINK("x")';
    const rows = parseCsv(L.buildCSV([side], '+label'));
    assert.equal(rows[1][columns.indexOf('rationale')], '\'=HYPERLINK("x")');
    assert.equal(rows[1][columns.indexOf('case_label')], '\'+label');
  });

  test('a Gate 1 failure exports the Gate 1 answers and the reassess message only', () => {
    const side = fixedExample();
    side.gate1.flow = 'no';
    const row = parseCsv(L.buildCSV([side], ''))[1];
    assert.equal(row[columns.indexOf('gate1_flow')], 'No');
    assert.equal(row[columns.indexOf('A_cm')], '');
    assert.equal(row[columns.indexOf('suggested_plan')], '');
    assert.equal(row[columns.indexOf('suggestion_reason')], FW.gate1.failMessage);
  });

  test('a Gate 1 failure exports the early-stop note in the rationale column', () => {
    const side = fixedExample();
    side.gate1.flow = 'no';
    side.stopNote = '=Consider SIEA';
    const row = parseCsv(L.buildCSV([side], ''))[1];
    assert.equal(row[columns.indexOf('rationale')], "'=Consider SIEA");
  });

  test('one row per side', () => {
    const right = fixedExample();
    right.side = 'Right';
    const rows = parseCsv(L.buildCSV([fixedExample(), right], 'Bilateral', { bilateral: true }));
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.slice(1).map((r) => r[columns.indexOf('side')]), ['Left', 'Right']);
  });
});

/* ------------------------------------------------------------------------- */
/* Framework strings: must match the specification word for word             */
/* ------------------------------------------------------------------------- */

describe('Plain-language questions', () => {
  test('every Gate 1 item keeps its framework wording and adds a question, short label and explanation', () => {
    FW.gate1.items.forEach((item) => {
      ['text', 'question', 'short', 'explain'].forEach((k) => assert.ok(item[k] && item[k].length > 5, item.id + '.' + k));
      assert.notEqual(item.question, item.text);
    });
  });

  test('every input on screen has a plain question', () => {
    const C = FW.ct;
    [C.A, C.C, C.course3d, C.paramuscular, C.arcuateRelation, C.arcuateMethod].forEach((f) => assert.ok(f.question && f.explain, f.label));
    Object.values(FW.complexity.domains).forEach((d) => assert.ok(d.question && d.explain, d.label));
    assert.ok(FW.complexity.team.question && FW.benefit.question && FW.benefit.explain);
    assert.deepEqual(Object.keys(C.arcuateMethod.short), Object.keys(C.arcuateMethod.options));
    assert.ok(FW.plan.selectedQuestion && FW.plan.limitingQuestion && FW.plan.rationaleQuestion);
  });
});

describe('Framework strings match the specification exactly', () => {
  test('safety and privacy', () => {
    assert.equal(FW.disclaimer, 'Research and educational tool. Not a medical device. Not validated for clinical decision-making. Does not replace surgical judgment. Intraoperative findings always take precedence.');
    assert.equal(FW.suggestionLabel, 'Suggestion (unvalidated)');
    assert.equal(FW.caseLabel.label, 'Case label');
    assert.equal(FW.caseLabel.hint, 'Do not enter patient identifiers.');
    assert.equal(FW.privacy, 'All calculations run in your browser; nothing is stored or sent');
    assert.equal(FW.bilateralToggle, 'Assess both sides');
    assert.deepEqual({ ...FW.tabs }, { calculator: 'Calculator', info: 'Evidence & About' });
    assert.equal(FW.pages.length, 3);
  });

  test('Step 1, Gate 1', () => {
    assert.equal(FW.gate1.title, 'Gate 1 — Flap safety (hard stop)');
    assert.deepEqual(FW.gate1.items.map((i) => i.text), [
      'Perforators adequate for the planned flap volume and territory',
      'Arterial inflow and venous drainage judged adequate for the planned flap (vein caliber, SIEV, superficial–deep connection); unresolved concerns require reassessment',
      'Perforator selection not compromised solely to facilitate robotic harvest'
    ]);
    assert.deepEqual({ ...FW.gate1.answers }, { yes: 'Yes', no: 'No', uncertain: 'Uncertain' });
    assert.equal(FW.gate1.failMessage, 'Reassess the flap and perforator plan. Consider conventional DIEP only if an adequately perfused alternative harvest is feasible; otherwise consider another reconstructive option.');
    assert.equal(FW.gate1.uncertainReason, 'Flap safety not confirmed');
  });

  test('Step 2, CT measurements', () => {
    assert.equal(FW.ct.A.label, 'A = intramuscular course, craniocaudal extent (projected on sagittal MIP)');
    assert.equal(FW.ct.A.requirement, 'required unless the course is paramuscular/subfascial');
    assert.equal(FW.ct.paramuscular.label, 'Paramuscular or subfascial course');
    assert.equal(FW.ct.C.label, 'C = perforator to external iliac origin, craniocaudal projection, same projection and reference convention as A');
    assert.equal(FW.ct.course3d.label, '3D intramuscular course length (optional; recorded only, never used in calculations)');
    assert.equal(FW.ct.course3d.help, 'Do not mix 3D length with the projected A.');
    assert.equal(FW.ct.arcuateRelation.label, 'Arcuate line relation of the predicted robotic incision');
    assert.deepEqual({ ...FW.ct.arcuateRelation.options }, { above: 'Above', crossing: 'Crossing', below: 'Below' });
    assert.equal(FW.ct.arcuateMethod.label, 'Arcuate line located by');
    assert.deepEqual({ ...FW.ct.arcuateMethod.options }, {
      identified: 'Identified on imaging',
      estimated: 'Estimated (one-third of the umbilicus–pubis distance)',
      indeterminate: 'Indeterminate'
    });
    assert.equal(FW.ct.B.label, 'B = C − A (projected fascial saving, cm)');
    assert.equal(FW.ct.surrogateLabel, 'Projected surrogate; not validated against outcomes.');
    assert.equal(FW.messages.aGeC, 'A cannot equal or exceed C. Check that both use the same craniocaudal projection.');
    assert.equal(FW.ct.help, 'A = intramuscular course and C = perforator to external iliac origin, both as craniocaudal projections; B = C − A is the projected fascial saving. Record 3D course length separately; do not mix the two. 2.5 and 5 cm are reported research anchors, not validated boundaries.');
  });

  test('Step 3, technical complexity', () => {
    const d = FW.complexity.domains;
    assert.deepEqual({ ...FW.complexity.grades }, { low: 'Low', moderate: 'Moderate', high: 'High', na: 'Not assessable' });
    assert.equal(d.config.label, 'Required perforator configuration');
    assert.deepEqual({ ...d.config.descriptors }, {
      low: 'All required perforators in one fascial window on one DIEA branch',
      moderate: 'Required perforators on one DIEA branch, in separate fascial windows',
      high: 'Required perforators on separate DIEA trunks'
    });
    assert.equal(d.course.label, 'Intramuscular course (A)');
    assert.deepEqual({ ...d.course.descriptors }, { low: '≤2.5 cm, or paramuscular or subfascial', moderate: '>2.5 to 5 cm', high: '>5 cm' });
    assert.deepEqual({ ...d.course.tags }, { auto: 'auto', overridden: 'overridden' });
    assert.equal(d.access.label, 'Access for the planned route (TAPP or TEP)');
    assert.deepEqual({ ...d.access.routes }, { TAPP: 'TAPP', TEP: 'TEP' });
    assert.deepEqual({ ...d.access.descriptors }, {
      low: 'No scar, mesh or suspected adhesions affecting the planned route',
      moderate: 'Scar or suspected adhesions affect the planned route, which remains feasible',
      high: 'Mesh, dense scar or extensive adhesions affect the planned route; feasible only for an experienced team'
    });
    assert.equal(d.access.noRoute, 'No feasible robotic route');
    assert.equal(d.access.help, 'Grade by the consequences for the planned route, not by surgical-history labels alone.');
    assert.equal(FW.complexity.team.label, 'Team experience with robotic DIEP harvest');
    assert.deepEqual({ ...FW.complexity.team.options }, { established: 'Established', early: 'Early in program' });
    assert.equal(FW.complexity.team.help, 'Published learning curves describe dissection time, not validated competence.');
  });

  test('Step 4, expected benefit', () => {
    assert.equal(FW.benefit.domainLabel, 'Projected fascial saving (B = C − A)');
    assert.deepEqual({ ...FW.benefit.grades }, { substantial: 'Substantial', moderate: 'Moderate', small: 'Small', na: 'Not assessable' });
    assert.deepEqual({ ...FW.benefit.descriptors }, {
      substantial: 'Most of the conventional exposure spared',
      moderate: 'Part of the conventional exposure spared',
      small: 'Little spared; A approaches C'
    });
    assert.equal(FW.benefit.suggestedLabel, 'Suggested from B/C using author-proposed example cutoffs; not validated. Override if your assessment differs.');
    assert.equal(FW.benefit.arcuateNote, 'Part of the incision lies at or below the arcuate line; record this when weighing the benefit.');
    assert.equal(FW.benefit.notAssessableRule, 'Not assessable (for example, an indeterminate arcuate line or an uncertain access plane): obtain further assessment; do not assume a grade.');
  });

  test('Step 5, integrated plan', () => {
    const p = FW.plan;
    assert.equal(p.intro, 'Integrated assessment: weigh complexity, expected benefit and team experience together. Document the principal limiting factor and the rationale for the plan. No validated rule combines the domains.');
    assert.deepEqual(p.order.map((k) => [p.plans[k].label, p.plans[k].scenario]), [
      ['Consider robotic harvest', 'Substantial or moderate benefit with low or moderate complexity'],
      ['Individualized or expert review', 'Substantial benefit with high complexity, or moderate complexity early in a program'],
      ['Consider hybrid or conventional harvest', 'Small expected benefit, or no feasible robotic route'],
      ['Additional assessment needed', 'Any domain not assessable']
    ]);
    assert.equal(p.footnote, 'Typical scenarios are author-proposed examples for prospective evaluation, not rules.');
    assert.equal(p.whyTitle, 'Why this suggestion');
    assert.equal(p.outsideFlag, 'Outside the typical scenarios; nearest match shown.');
    assert.equal(p.highestNote, 'the highest complexity grade across the three domains is used only to match a typical scenario; it is not an overall category.');
    assert.equal(p.smallBenefitFactor, 'Small expected benefit');
    assert.equal(p.selectedLabel, 'Selected plan');
    assert.equal(p.limitingLabel, 'Principal limiting factor');
    assert.deepEqual(p.limitingOrder.map((k) => p.limitingOptions[k]), [
      'Perforator configuration', 'Intramuscular course', 'Access', 'Expected benefit', 'Team experience', 'Flap safety', 'Other'
    ]);
    assert.equal(p.rationaleLabel, 'Rationale');
    assert.equal(p.rationaleMax, 500);
    assert.equal(p.differs, 'Differs from suggestion');
    assert.equal(p.override, 'Intraoperative override: perfusion assessment (clinical or ICG) and the anatomy found at surgery take precedence; convert to hybrid or open harvest at any step.');
    assert.deepEqual(p.rules.map((r) => r.id), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  });

  test('Step 6, summary and export', () => {
    assert.deepEqual({ ...FW.summary.actions }, {
      print: 'Print / Save as PDF', copy: 'Copy note', csv: 'Download CSV', reset: 'Start new case'
    });
  });

  test('How to measure and Evidence', () => {
    assert.equal(FW.measure.schematicCaption, 'Schematic, not to scale.');
    assert.deepEqual({ ...FW.evidence.points }, {
      review: 'Systematic review of 27 reports (2018–2026) from 18 programs in 9 countries; about 126–171 robotic patients; none randomized.',
      criteria: 'No selection criterion has been validated against outcomes. Intramuscular-course cutoffs ranged from 2.5 to 5 cm; perforator size cutoffs from 1 to 2.7 mm.',
      eligibility: 'In one cohort, eligibility rose from 46% (≤2.5 cm) to 93% (≤5 cm).',
      fascia: 'Fascial incision about 65% shorter with robotic harvest (ratio of means 0.35; robotic about 3.5 cm). Low certainty.',
      periop: 'Operative time about 75 minutes longer; hospital stay about 0.6 days shorter; early pain lower. Very low certainty.',
      safety: 'Total flap loss 1 of 135 robotic flaps; conversion 1 of 79 robotic flaps; no hernia in 60 or bulge in 41 explicitly assessed patients, over about 5–15 months of follow-up. Long-term abdominal-wall benefit is unproven.'
    });
    assert.equal(FW.evidence.note, 'The B/C cutoffs and plan-matching order used in this calculator are tool defaults for prospective evaluation and are not part of the published framework.');
  });

  test('cutoffs', () => {
    assert.deepEqual({ ...FW.benefit.cutoffs }, { substantialMin: 0.67, moderateMin: 0.33 });
    assert.deepEqual({ ...FW.complexity.courseCutoffs }, { lowMaxCm: 2.5, moderateMaxCm: 5 });
  });

  test('typographic characters are the intended code points', () => {
    assert.ok(FW.ct.B.label.includes('C − A'), 'minus sign U+2212');
    assert.ok(FW.gate1.title.includes('—'), 'em dash U+2014');
    assert.ok(FW.gate1.items[1].text.includes('superficial–deep'), 'en dash U+2013');
    assert.ok(FW.summary.note.header.includes(' – '), 'en dash in the note header');
    assert.ok(FW.complexity.domains.course.descriptors.low.startsWith('≤'), '≤ U+2264');
  });

  test('the article citation stays hidden until it is switched on', () => {
    assert.equal(FW.citation.show, false);
    assert.equal(L.citationText(), '');
  });

  test('the framework is frozen', () => {
    assert.ok(Object.isFrozen(FW));
    assert.ok(Object.isFrozen(FW.benefit.cutoffs));
  });
});

/* ------------------------------------------------------------------------- */
/* Privacy and packaging guards                                              */
/* ------------------------------------------------------------------------- */

describe('Privacy and packaging', () => {
  const scripts = ['../assets/js/app.js', '../assets/js/logic.js', '../assets/js/framework.js'];

  test('no storage, cookies or network APIs in the scripts', () => {
    for (const file of scripts) {
      const src = read(file);
      for (const pattern of [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/]) {
        assert.ok(!pattern.test(src), `${file} must not use ${pattern}`);
      }
    }
  });

  test('index.html loads only local files, in the right order', () => {
    const html = read('../index.html');
    const resources = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    for (const url of resources) {
      assert.ok(!/^(https?:)?\/\//.test(url), `external resource: ${url}`);
    }
    const order = ['assets/js/framework.js', 'assets/js/logic.js', 'assets/js/app.js'].map((s) => html.indexOf(s));
    assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], 'script order');
  });
});
