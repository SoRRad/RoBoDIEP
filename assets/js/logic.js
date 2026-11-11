/*
 * Robotic DIEP Selection Calculator: decision logic
 * ----------------------------------------------------------------------------
 * Pure functions only: no DOM, no storage, no network. Every clinical string
 * and cutoff comes from framework.js, so this file never needs editing to
 * change wording or cutoffs.
 *
 * Measurements are handled in integer tenths of a centimetre, so that, for
 * example, 12.2 − 3.1 is exactly 9.1 (plain floating point gives 9.0999…).
 *
 * Loads as a classic browser script (window.RoboDIEP.logic) after
 * framework.js, or in Node (globalThis.RoboDIEP.logic or require()).
 */
(function (root, factory) {
  'use strict';
  var isCjs = typeof module === 'object' && module && typeof module.exports === 'object';
  var FW = isCjs ? require('./framework.js').FRAMEWORK : (root.RoboDIEP && root.RoboDIEP.FRAMEWORK);
  if (!FW) throw new Error('framework.js must be loaded before logic.js');
  var api = factory(FW);
  root.RoboDIEP = root.RoboDIEP || {};
  root.RoboDIEP.logic = api;
  if (isCjs) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (FW) {
  'use strict';

  var EPS = 1e-9; // absorbs floating-point noise only; real B/C values differ from a cutoff by > 1e-6
  var DOMAINS = FW.complexity.order; // ['config', 'course', 'access']
  var RANK = { low: 1, moderate: 2, high: 3 };
  var GATE_IDS = FW.gate1.items.map(function (item) { return item.id; });

  /* ----------------------------------------------------------------------- */
  /* Small helpers                                                            */
  /* ----------------------------------------------------------------------- */

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
    });
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function cutoffTenths(cm) {
    return Math.round(cm * 10);
  }

  function formatCm(tenths) {
    return (tenths / 10).toFixed(1);
  }

  function planLabel(key) {
    return key && FW.plan.plans[key] ? FW.plan.plans[key].label : '';
  }

  function complexityLabel(grade) {
    if (grade === 'none') return FW.complexity.domains.access.noRoute;
    return grade ? FW.complexity.grades[grade] || '' : '';
  }

  function benefitLabel(grade) {
    return grade ? FW.benefit.grades[grade] || '' : '';
  }

  /* ----------------------------------------------------------------------- */
  /* Parsing and measurements                                                 */
  /* ----------------------------------------------------------------------- */

  /**
   * Parse a centimetre value typed by the user (or a number).
   * Accepts a decimal comma. Returns {empty:true}, {error:code} or
   * {tenths, value}. Error codes: format | negative | decimals | max.
   * Values with more than one decimal are rejected, not rounded, because
   * rounding could move a value across the 2.5 or 5 cm anchors.
   */
  function parseCm(raw) {
    if (raw === null || raw === undefined) return { empty: true };
    var text = String(raw).trim().replace(',', '.');
    if (text === '') return { empty: true };
    var match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text);
    if (!match || (match[2] === '' && !match[3])) return { error: 'format' };
    var whole = match[2] === '' ? 0 : parseInt(match[2], 10);
    var fraction = (match[3] || '').replace(/0+$/, '');
    if (match[1] === '-' && (whole > 0 || fraction.length > 0)) return { error: 'negative' };
    if (fraction.length > 1) return { error: 'decimals' };
    var tenths = whole * 10 + (fraction ? parseInt(fraction, 10) : 0);
    if (tenths > cutoffTenths(FW.ct.maxCm)) return { error: 'max' };
    return { tenths: tenths, value: tenths / 10 };
  }

  function parseError(code, overrides) {
    var msg = FW.messages;
    if (overrides && overrides[code]) return overrides[code];
    return msg[code] || msg.format;
  }

  /**
   * Validate the Step 2 inputs. Returns {valid, errors, values}.
   * `values` (A, C, B and B/C) is available as soon as A and C are valid,
   * even before the arcuate-line questions are answered.
   */
  function validateMeasurements(m) {
    m = m || {};
    var msg = FW.messages;
    var errors = {};
    var a = parseCm(m.A);
    var c = parseCm(m.C);
    var d3 = parseCm(m.course3d);

    var cT = null;
    if (c.empty) errors.C = msg.cRequired;
    else if (c.error) errors.C = parseError(c.error, { negative: msg.cPositive });
    else if (c.tenths <= 0) errors.C = msg.cPositive;
    else cT = c.tenths;

    var aT = null;
    if (a.empty) {
      if (m.paramuscular) aT = 0;
      else errors.A = msg.aRequired;
    } else if (a.error) {
      errors.A = parseError(a.error, { negative: msg.aNegative });
    } else {
      aT = a.tenths;
    }
    if (aT !== null && cT !== null && aT >= cT) {
      errors.A = msg.aGeC;
    }

    var d3T = null;
    if (!d3.empty) {
      if (d3.error) errors.course3d = parseError(d3.error, { negative: msg.course3dPositive });
      else if (d3.tenths <= 0) errors.course3d = msg.course3dPositive;
      else d3T = d3.tenths;
    }

    if (!m.arcuateMethod) errors.arcuateMethod = msg.methodRequired;
    if (!m.arcuateRelation && m.arcuateMethod !== 'indeterminate') errors.arcuateRelation = msg.relationRequired;

    var values = null;
    if (aT !== null && cT !== null && aT < cT) {
      var bT = cT - aT;
      values = {
        aTenths: aT,
        cTenths: cT,
        bTenths: bT,
        A: aT / 10,
        C: cT / 10,
        B: bT / 10,
        ratio: bT / cT,
        aBlank: !!a.empty,
        course3dTenths: d3T
      };
    }

    return { valid: Object.keys(errors).length === 0, errors: errors, values: values };
  }

  /** B = C − A and B/C from two valid values (numbers or strings), or null. */
  function computeSaving(A, C) {
    var a = parseCm(A);
    var c = parseCm(C);
    if (a.empty || a.error || c.empty || c.error) return null;
    if (c.tenths <= 0 || a.tenths >= c.tenths) return null;
    var bT = c.tenths - a.tenths;
    return { A: a.tenths / 10, C: c.tenths / 10, B: bT / 10, bTenths: bT, cTenths: c.tenths, ratio: bT / c.tenths };
  }

  /* ----------------------------------------------------------------------- */
  /* Grading                                                                  */
  /* ----------------------------------------------------------------------- */

  /** Intramuscular-course auto-grade from A (cm). Paramuscular/subfascial → low. */
  function gradeCourse(A, paramuscular) {
    if (paramuscular) return 'low';
    var a = parseCm(A);
    if (a.empty || a.error) return null;
    var cut = FW.complexity.courseCutoffs;
    if (a.tenths <= cutoffTenths(cut.lowMaxCm)) return 'low';
    if (a.tenths <= cutoffTenths(cut.moderateMaxCm)) return 'moderate';
    return 'high';
  }

  /** Suggested benefit grade from B/C using the example cutoffs in framework.js. */
  function suggestBenefit(ratio) {
    if (typeof ratio !== 'number' || !isFinite(ratio)) return null;
    var cut = FW.benefit.cutoffs;
    if (ratio + EPS >= cut.substantialMin) return 'substantial';
    if (ratio + EPS >= cut.moderateMin) return 'moderate';
    return 'small';
  }

  function crossesCutoff(exact, shown) {
    var cut = FW.benefit.cutoffs;
    return [cut.moderateMin, cut.substantialMin].some(function (k) {
      return (exact + EPS >= k) !== (shown + EPS >= k);
    });
  }

  function formatAdaptive(bTenths, cTenths, baseDecimals, scale) {
    var exact = bTenths / cTenths;
    for (var d = baseDecimals; d <= baseDecimals + 4; d++) {
      var f = Math.pow(10, d);
      var shown = Math.round((bTenths * scale * f) / cTenths) / f;
      if (!crossesCutoff(exact, shown / scale)) return shown.toFixed(d);
    }
    return (exact * scale).toFixed(baseDecimals + 4);
  }

  /**
   * B/C as a percentage with one decimal (e.g. "74.6%"). In the rare case
   * where rounding would cross a benefit cutoff, extra decimals are shown
   * (e.g. "66.99%") so the number never contradicts the suggested grade.
   */
  function formatPercent(bTenths, cTenths) {
    return formatAdaptive(bTenths, cTenths, 1, 100) + '%';
  }

  /** B/C as a ratio with three decimals (e.g. "0.746"), same safeguard. */
  function formatRatio(bTenths, cTenths) {
    return formatAdaptive(bTenths, cTenths, 3, 1);
  }

  /** Gate 1 status: passed | notConfirmed | failed | incomplete. */
  function gateStatus(gate1) {
    var values = GATE_IDS.map(function (id) { return gate1 ? gate1[id] : null; });
    if (values.indexOf('no') !== -1) return 'failed';
    if (values.some(function (v) { return v === null || v === undefined; })) return 'incomplete';
    if (values.indexOf('uncertain') !== -1) return 'notConfirmed';
    return 'passed';
  }

  /**
   * Highest complexity grade across the three domains (low | moderate | high),
   * or null when any domain is missing or not gradable. It is used only to
   * match a typical scenario; it is not an overall category.
   */
  function highestComplexity(input) {
    var best = 0;
    for (var i = 0; i < DOMAINS.length; i++) {
      var rank = RANK[input[DOMAINS[i]]];
      if (!rank) return null;
      if (rank > best) best = rank;
    }
    return ['low', 'moderate', 'high'][best - 1];
  }

  function domainsAt(input, grade) {
    return DOMAINS.filter(function (d) { return input[d] === grade; });
  }

  function shortList(domains) {
    return domains.map(function (d) { return FW.complexity.domains[d].short; }).join(', ');
  }

  function domainDriver(d, input) {
    return { label: FW.complexity.domains[d].label, value: complexityLabel(input[d]) };
  }

  function benefitDriver(input) {
    return { label: FW.benefit.domainLabel, value: benefitLabel(input.benefit) };
  }

  function teamDriver(input) {
    return { label: FW.complexity.team.label, value: FW.complexity.team.options[input.team] };
  }

  /* ----------------------------------------------------------------------- */
  /* Plan suggestion                                                          */
  /* ----------------------------------------------------------------------- */

  /**
   * Suggest a plan. Rules a–i from framework.js are applied in order; the
   * first match wins.
   *
   * input = {
   *   gate1: { perforators, flow, notCompromised }   // 'yes' | 'no' | 'uncertain'
   *   config, course: 'low' | 'moderate' | 'high' | 'na'
   *   access: 'low' | 'moderate' | 'high' | 'na' | 'none'
   *   benefit: 'substantial' | 'moderate' | 'small' | 'na'
   *   team: 'established' | 'early'
   *   arcuateMethod: 'identified' | 'estimated' | 'indeterminate'
   * }
   *
   * Returns { status: 'complete' | 'gateFailed' | 'incomplete', plan, planLabel,
   *           rule, reason, flag, drivers: [{label, value}], trace, highest }.
   */
  function suggestPlan(input) {
    input = input || {};
    var rules = FW.plan.rules;
    var reasons = FW.plan.reasons;
    var trace = rules.map(function (r) {
      return { id: r.id, condition: r.condition, outcome: r.outcome, status: 'notReached' };
    });

    function settle(index, status) {
      for (var i = 0; i < index; i++) trace[i].status = 'notMet';
      trace[index].status = status;
    }

    function match(index, result) {
      settle(index, 'matched');
      return {
        status: result.plan ? 'complete' : 'gateFailed',
        plan: result.plan,
        planLabel: planLabel(result.plan),
        rule: rules[index].id,
        reason: result.reason,
        flag: result.flag || null,
        drivers: result.drivers || [],
        trace: trace,
        highest: result.highest || null
      };
    }

    function pending(index, missing) {
      settle(index, 'pending');
      return {
        status: 'incomplete', plan: null, planLabel: '', rule: null, reason: '',
        flag: null, drivers: [], trace: trace, highest: null, missing: missing
      };
    }

    var gate = input.gate1 || {};
    var items = FW.gate1.items;
    var answers = FW.gate1.answers;

    // a. Any Gate 1 item = No → no plan.
    var noItems = items.filter(function (it) { return gate[it.id] === 'no'; });
    if (noItems.length) {
      return match(0, {
        plan: null,
        reason: FW.gate1.failMessage,
        drivers: noItems.map(function (it) { return { label: it.text, value: answers.no }; })
      });
    }
    var missingGate = items.filter(function (it) { return gate[it.id] === null || gate[it.id] === undefined; });
    if (missingGate.length) {
      return pending(0, missingGate.map(function (it) { return 'gate1.' + it.id; }));
    }

    // b. Any Gate 1 item = Uncertain → Additional assessment needed.
    var uncertain = items.filter(function (it) { return gate[it.id] === 'uncertain'; });
    if (uncertain.length) {
      return match(1, {
        plan: 'assess',
        reason: reasons.b,
        drivers: uncertain.map(function (it) { return { label: it.text, value: answers.uncertain }; })
      });
    }

    // c. Any domain = Not assessable, or arcuate line indeterminate → Additional assessment needed.
    var naDomains = DOMAINS.filter(function (d) { return input[d] === 'na'; });
    var benefitNa = input.benefit === 'na';
    var arcuateIndeterminate = input.arcuateMethod === 'indeterminate';
    if (naDomains.length || benefitNa || arcuateIndeterminate) {
      var names = naDomains.map(function (d) { return FW.complexity.domains[d].short; });
      if (benefitNa) names.push(FW.plan.benefitShort);
      var parts = [];
      if (names.length) parts.push(fill(reasons.cDomains, { domains: names.join(', ') }));
      if (arcuateIndeterminate) parts.push(reasons.cArcuate);
      var drivers = naDomains.map(function (d) { return domainDriver(d, input); });
      if (benefitNa) drivers.push(benefitDriver(input));
      if (arcuateIndeterminate) {
        drivers.push({ label: FW.ct.arcuateMethod.label, value: FW.ct.arcuateMethod.options.indeterminate });
      }
      return match(2, { plan: 'assess', reason: capitalize(parts.join('; ')), drivers: drivers });
    }
    var missing = ['config', 'course', 'access', 'benefit', 'arcuateMethod'].filter(function (k) {
      return input[k] === null || input[k] === undefined;
    });
    if (missing.length) return pending(2, missing);

    // d. Access = No feasible robotic route → Consider hybrid or conventional harvest.
    if (input.access === 'none') {
      return match(3, { plan: 'hybrid', reason: reasons.d, drivers: [domainDriver('access', input)] });
    }

    // e. Benefit = Small → Consider hybrid or conventional harvest.
    if (input.benefit === 'small') {
      return match(4, { plan: 'hybrid', reason: reasons.e, drivers: [benefitDriver(input)] });
    }

    var highest = highestComplexity(input);
    if (!highest) return pending(5, DOMAINS.slice());

    // f. Highest = High and benefit = Substantial → Individualized or expert review.
    if (highest === 'high' && input.benefit === 'substantial') {
      var highF = domainsAt(input, 'high');
      return match(5, {
        plan: 'expert',
        highest: highest,
        reason: fill(reasons.f, { domains: shortList(highF) }),
        drivers: highF.map(function (d) { return domainDriver(d, input); }).concat([benefitDriver(input)])
      });
    }

    // g. Highest = High and benefit = Moderate → Individualized or expert review (flagged).
    if (highest === 'high' && input.benefit === 'moderate') {
      var highG = domainsAt(input, 'high');
      return match(6, {
        plan: 'expert',
        highest: highest,
        flag: FW.plan.outsideFlag,
        reason: fill(reasons.g, { domains: shortList(highG) }),
        drivers: highG.map(function (d) { return domainDriver(d, input); }).concat([benefitDriver(input)])
      });
    }

    if (!input.team) return pending(7, ['team']);

    // h. Highest = Moderate and team = Early in program → Individualized or expert review.
    if (highest === 'moderate' && input.team === 'early') {
      var modH = domainsAt(input, 'moderate');
      return match(7, {
        plan: 'expert',
        highest: highest,
        reason: fill(reasons.h, { domains: shortList(modH) }),
        drivers: modH.map(function (d) { return domainDriver(d, input); }).concat([teamDriver(input)])
      });
    }

    // i. Otherwise → Consider robotic harvest.
    var benefitWord = benefitLabel(input.benefit);
    var reasonI = highest === 'low'
      ? fill(reasons.iLow, { benefit: benefitWord })
      : fill(reasons.iModerate, { benefit: benefitWord, domains: shortList(domainsAt(input, highest)) });
    return match(8, {
      plan: 'robotic',
      highest: highest,
      reason: reasonI,
      drivers: DOMAINS.map(function (d) { return domainDriver(d, input); })
        .concat([benefitDriver(input), teamDriver(input)])
    });
  }

  /** Reason plus the "outside the typical scenarios" flag, when present. */
  function fullReason(suggestion) {
    if (!suggestion || !suggestion.reason) return '';
    return suggestion.flag ? suggestion.reason + '. ' + suggestion.flag : suggestion.reason;
  }

  /**
   * Suggested principal limiting factor(s). Mirrors the matched rule:
   *   b → Flap safety; c → the not-assessable domain(s) (an indeterminate
   *   arcuate line → Expected benefit); No feasible robotic route → Access;
   *   Small benefit → "Small expected benefit"; otherwise the complexity
   *   domain(s) with the least favorable grade, with ties all listed. When every
   *   complexity domain is Low, nothing is suggested, or Expected benefit when the
   *   benefit is Moderate.
   * Team experience is never suggested automatically.
   * Returns [{ key, label, detail }], where key matches the dropdown options.
   */
  function suggestLimitingFactor(input, suggestion) {
    suggestion = suggestion || suggestPlan(input);
    var options = FW.plan.limitingOptions;
    if (suggestion.status !== 'complete') return [];
    if (suggestion.rule === 'b') {
      return [{ key: 'flapSafety', label: options.flapSafety, detail: FW.gate1.uncertainReason }];
    }
    if (suggestion.rule === 'c') {
      var out = DOMAINS.filter(function (d) { return input[d] === 'na'; }).map(function (d) {
        return { key: d, label: options[d], detail: complexityLabel('na') };
      });
      if (input.benefit === 'na' || input.arcuateMethod === 'indeterminate') {
        out.push({
          key: 'benefit',
          label: options.benefit,
          detail: input.benefit === 'na' ? benefitLabel('na') : FW.ct.arcuateMethod.label + ': ' + FW.ct.arcuateMethod.options.indeterminate
        });
      }
      return out;
    }
    var factors = [];
    if (input.access === 'none') {
      factors.push({ key: 'access', label: options.access, detail: complexityLabel('none') });
    }
    if (input.benefit === 'small') {
      factors.push({ key: 'benefit', label: FW.plan.smallBenefitFactor, detail: benefitLabel('small') });
    }
    if (factors.length) return factors;
    var worst = 0;
    DOMAINS.forEach(function (d) { worst = Math.max(worst, RANK[input[d]] || 0); });
    if (worst === RANK.low) {
      return input.benefit === 'moderate'
        ? [{ key: 'benefit', label: options.benefit, detail: benefitLabel('moderate') }]
        : [];
    }
    return DOMAINS.filter(function (d) { return RANK[input[d]] === worst; }).map(function (d) {
      return { key: d, label: options[d], detail: complexityLabel(input[d]) };
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Side state and evaluation                                                */
  /* ----------------------------------------------------------------------- */

  /** A fresh, empty assessment for one hemiabdomen. */
  function createSide(sideName) {
    return {
      side: sideName || null,
      gate1: { perforators: null, flow: null, notCompromised: null },
      m: { A: '', C: '', course3d: '', paramuscular: false, arcuateRelation: null, arcuateMethod: null },
      cx: { config: null, courseOverride: null, route: null, access: null, team: null },
      benefitOverride: null,
      plan: { selected: null, limiting: null, limitingOther: '', rationale: '' }
    };
  }

  /**
   * Evaluate one side: derived grades, the suggestion, per-step validity and
   * which steps can be visited. opts.bilateral = true when both sides are assessed.
   */
  function evaluateSide(side, opts) {
    opts = opts || {};
    var msg = FW.messages;
    var gate = gateStatus(side.gate1);
    var m = validateMeasurements(side.m);
    var values = m.valid ? m.values : null;

    var courseAuto = values ? gradeCourse(values.A, side.m.paramuscular) : null;
    var courseOverride = side.cx.courseOverride || null;
    var course = values ? (courseOverride || courseAuto) : null;
    var courseSource = course ? (courseOverride && courseOverride !== courseAuto ? 'overridden' : 'auto') : null;

    var benefitSuggested = values ? suggestBenefit(values.ratio) : null;
    var benefitOverride = side.benefitOverride || null;
    var benefit = values ? (benefitOverride || benefitSuggested) : null;
    var benefitSource = benefit ? (benefitOverride && benefitOverride !== benefitSuggested ? 'overridden' : 'suggested') : null;

    var access = side.cx.access || null;
    var route = access === 'none' ? null : (side.cx.route || null);

    var input = {
      gate1: side.gate1,
      config: side.cx.config || null,
      course: course,
      access: access,
      benefit: benefit,
      team: side.cx.team || null,
      arcuateMethod: values ? side.m.arcuateMethod : null
    };
    var suggestion = suggestPlan(input);
    var limiting = suggestLimitingFactor(input, suggestion);

    // Step 1
    var errors1 = {};
    if (!opts.bilateral && !side.side) errors1.side = msg.sideRequired;
    GATE_IDS.forEach(function (id) {
      if (!side.gate1[id]) errors1['gate1.' + id] = msg.answerRequired;
    });
    // Step 3
    var errors3 = {};
    if (!side.cx.config) errors3.config = msg.gradeRequired;
    if (!side.cx.route && access !== 'none' && access !== 'na') errors3.route = msg.routeRequired;
    if (!access) errors3.access = msg.gradeRequired;
    if (!side.cx.team) errors3.team = msg.teamRequired;
    // Step 5
    var errors5 = {};
    var plan = side.plan;
    var differs = !!(plan.selected && suggestion.plan && plan.selected !== suggestion.plan);
    if (!plan.selected) errors5.selected = msg.planRequired;
    if (!plan.limiting) errors5.limiting = msg.limitingRequired;
    else if (plan.limiting === 'other' && !String(plan.limitingOther || '').trim()) errors5.limitingOther = msg.otherRequired;
    if (differs && !String(plan.rationale || '').trim()) errors5.rationale = msg.rationaleRequired;

    var steps = [
      { errors: errors1, valid: Object.keys(errors1).length === 0 && gate !== 'failed' },
      { errors: m.errors, valid: m.valid },
      { errors: errors3, valid: Object.keys(errors3).length === 0 },
      { errors: {}, valid: benefit !== null },
      { errors: errors5, valid: Object.keys(errors5).length === 0 && suggestion.status === 'complete' },
      { errors: {}, valid: true }
    ];
    var inputsValid = steps.slice(0, 5).every(function (s) { return s.valid; });

    var reachable = [true];
    for (var k = 1; k < 5; k++) {
      reachable[k] = gate !== 'failed' && steps.slice(0, k).every(function (s) { return s.valid; });
    }
    var gateAnswered = GATE_IDS.every(function (id) { return !!side.gate1[id]; });
    reachable[5] = inputsValid || (gate === 'failed' && gateAnswered && (opts.bilateral || !!side.side));

    var completed = steps.slice(0, 5).filter(function (s) { return s.valid; }).length;
    var firstIncomplete = 0;
    while (firstIncomplete < 5 && steps[firstIncomplete].valid) firstIncomplete++;

    var status = gate === 'failed' ? 'failed' : (inputsValid ? 'complete' : 'inProgress');

    return {
      side: side.side,
      gate: gate,
      m: m,
      values: m.values,
      courseAuto: courseAuto,
      course: course,
      courseSource: courseSource,
      benefitSuggested: benefitSuggested,
      benefit: benefit,
      benefitSource: benefitSource,
      config: side.cx.config || null,
      access: access,
      route: route,
      team: side.cx.team || null,
      arcuateBelow: side.m.arcuateRelation === 'crossing' || side.m.arcuateRelation === 'below',
      input: input,
      suggestion: suggestion,
      limiting: limiting,
      differs: differs,
      steps: steps,
      reachable: reachable,
      completedSteps: completed,
      firstIncompleteStep: firstIncomplete + 1,
      status: status,
      exportable: status === 'complete' || (status === 'failed' && reachable[5])
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Exports: copy note and CSV                                               */
  /* ----------------------------------------------------------------------- */

  function limitingText(plan) {
    if (!plan.limiting) return '';
    var label = FW.plan.limitingOptions[plan.limiting] || '';
    if (plan.limiting === 'other') {
      var other = String(plan.limitingOther || '').replace(/\s+/g, ' ').trim();
      return other ? label + ': ' + other : label;
    }
    return label;
  }

  /** Plain-text structured note for one side (template in framework.js). */
  function noteForSide(side, opts) {
    var ev = evaluateSide(side, opts);
    var N = FW.summary.note;
    var notRecorded = N.notRecorded;
    var lines = [fill(N.header, { side: side.side || '' })];
    lines.push(fill(N.gate, { status: FW.gate1.statusText[ev.gate] || notRecorded }));

    if (ev.gate === 'failed') {
      lines.push(FW.gate1.failMessage);
      lines.push(fill(N.tool, { version: FW.version }));
      return lines.join('\n');
    }

    var v = ev.values;
    var relation = side.m.arcuateRelation ? FW.ct.arcuateRelation.options[side.m.arcuateRelation] : notRecorded;
    var method = side.m.arcuateMethod ? FW.ct.arcuateMethod.options[side.m.arcuateMethod] : notRecorded;
    lines.push(fill(N.cta, {
      A: v ? formatCm(v.aTenths) : notRecorded,
      paramuscular: side.m.paramuscular ? N.paramuscular : '',
      C: v ? formatCm(v.cTenths) : notRecorded,
      B: v ? formatCm(v.bTenths) : notRecorded,
      ratio: v ? formatPercent(v.bTenths, v.cTenths) : notRecorded,
      course3d: v && v.course3dTenths ? formatCm(v.course3dTenths) + ' cm' : notRecorded,
      relation: relation,
      method: method
    }));
    lines.push(fill(N.complexity, {
      config: complexityLabel(ev.config) || notRecorded,
      course: complexityLabel(ev.course) || notRecorded,
      route: ev.route ? ' (' + ev.route + ')' : '',
      access: complexityLabel(ev.access) || notRecorded
    }));
    lines.push(fill(N.benefit, {
      benefit: benefitLabel(ev.benefit) || notRecorded,
      source: ev.benefitSource ? FW.benefit.tags[ev.benefitSource] : notRecorded
    }));
    lines.push(fill(N.team, { team: ev.team ? FW.complexity.team.options[ev.team] : notRecorded }));
    lines.push(fill(N.suggested, {
      plan: ev.suggestion.planLabel || notRecorded,
      reason: fullReason(ev.suggestion) || notRecorded
    }));
    var rationale = String(side.plan.rationale || '').replace(/\s+/g, ' ').trim();
    lines.push(fill(N.selected, {
      plan: planLabel(side.plan.selected) || notRecorded,
      factor: limitingText(side.plan) || notRecorded,
      rationale: rationale || notRecorded
    }));
    lines.push(fill(N.tool, { version: FW.version }));
    return lines.join('\n');
  }

  /** Notes for all sides, separated by a blank line. */
  function buildNote(sides, opts) {
    return sides.map(function (s) { return noteForSide(s, opts); }).join('\n\n');
  }

  var FORMULA_START = /^[=+\-@\t\r]/;

  /**
   * RFC 4180 field quoting: fields containing a comma, double quote, CR or LF
   * are wrapped in double quotes and inner quotes are doubled.
   */
  function csvEscape(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  /** Free text gets a leading apostrophe if it starts like a spreadsheet formula. */
  function csvSafeText(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return FORMULA_START.test(text) ? "'" + text : text;
  }

  /** Header plus one line per row, CRLF line endings (RFC 4180). */
  function toCSV(rows, columns) {
    columns = columns || FW.summary.csvColumns;
    var lines = [columns.map(csvEscape).join(',')];
    rows.forEach(function (row) {
      lines.push(columns.map(function (col) { return csvEscape(row[col]); }).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /** One CSV row (object keyed by column name) for one side. */
  function csvRowForSide(side, caseLabel, opts) {
    var ev = evaluateSide(side, opts);
    var answers = FW.gate1.answers;
    var row = {};
    FW.summary.csvColumns.forEach(function (col) { row[col] = ''; });
    row.tool_version = FW.version;
    row.case_label = csvSafeText(String(caseLabel || '').trim());
    row.side = side.side || '';
    row.gate1_perforators = side.gate1.perforators ? answers[side.gate1.perforators] : '';
    row.gate1_flow = side.gate1.flow ? answers[side.gate1.flow] : '';
    row.gate1_not_compromised = side.gate1.notCompromised ? answers[side.gate1.notCompromised] : '';

    if (ev.gate === 'failed') {
      row.suggestion_reason = FW.gate1.failMessage;
      return row;
    }

    var v = ev.values;
    var bool = FW.summary.csvBoolean;
    row.route = ev.route || '';
    if (v) {
      row.A_cm = formatCm(v.aTenths);
      row.C_cm = formatCm(v.cTenths);
      row.B_cm = formatCm(v.bTenths);
      row.B_over_C = formatRatio(v.bTenths, v.cTenths);
      row.course_3d_cm = v.course3dTenths ? formatCm(v.course3dTenths) : '';
    }
    row.paramuscular = side.m.paramuscular ? bool['true'] : bool['false'];
    row.arcuate_relation = side.m.arcuateRelation ? FW.ct.arcuateRelation.options[side.m.arcuateRelation] : '';
    row.arcuate_method = side.m.arcuateMethod ? FW.ct.arcuateMethod.options[side.m.arcuateMethod] : '';
    row.config_grade = complexityLabel(ev.config);
    row.course_grade = complexityLabel(ev.course);
    row.course_grade_source = ev.courseSource ? FW.complexity.domains.course.tags[ev.courseSource] : '';
    row.access_grade = complexityLabel(ev.access);
    row.team_experience = ev.team ? FW.complexity.team.options[ev.team] : '';
    row.benefit_grade = benefitLabel(ev.benefit);
    row.benefit_grade_source = ev.benefitSource ? FW.benefit.tags[ev.benefitSource] : '';
    row.suggested_plan = ev.suggestion.planLabel || '';
    row.suggestion_reason = fullReason(ev.suggestion);
    row.selected_plan = planLabel(side.plan.selected);
    row.limiting_factor = csvSafeText(limitingText(side.plan));
    row.rationale = csvSafeText(side.plan.rationale || '');
    return row;
  }

  /** CSV text for all sides (one row per side). */
  function buildCSV(sides, caseLabel, opts) {
    return toCSV(sides.map(function (s) { return csvRowForSide(s, caseLabel, opts); }));
  }

  /* ----------------------------------------------------------------------- */
  /* Citation                                                                 */
  /* ----------------------------------------------------------------------- */

  /** Citation text, or '' while the citation is hidden (citation.show false). */
  function citationText() {
    var c = FW.citation;
    if (!c.show || !c.title) return '';
    var parts = [c.authors, c.title, c.journal].filter(Boolean).join('. ') + '.';
    if (c.yearVolumeArticle) parts += ' ' + c.yearVolumeArticle + '.';
    if (c.doi) parts += ' doi:' + c.doi;
    return parts;
  }

  return Object.freeze({
    parseCm: parseCm,
    formatCm: formatCm,
    validateMeasurements: validateMeasurements,
    computeSaving: computeSaving,
    gradeCourse: gradeCourse,
    suggestBenefit: suggestBenefit,
    formatPercent: formatPercent,
    formatRatio: formatRatio,
    gateStatus: gateStatus,
    highestComplexity: highestComplexity,
    suggestPlan: suggestPlan,
    fullReason: fullReason,
    suggestLimitingFactor: suggestLimitingFactor,
    createSide: createSide,
    evaluateSide: evaluateSide,
    noteForSide: noteForSide,
    buildNote: buildNote,
    csvEscape: csvEscape,
    csvSafeText: csvSafeText,
    toCSV: toCSV,
    csvRowForSide: csvRowForSide,
    buildCSV: buildCSV,
    citationText: citationText,
    planLabel: planLabel,
    complexityLabel: complexityLabel,
    benefitLabel: benefitLabel,
    fill: fill,
    capitalize: capitalize
  });
});
