/*
 * Robotic DIEP Selection Calculator: user interface
 * ----------------------------------------------------------------------------
 * UI wiring only. Every clinical string comes from framework.js and every
 * decision from logic.js. The case lives only in this page's memory: there is
 * no storage of any kind and no network access (the Content-Security-Policy in
 * index.html blocks connections).
 */
(function () {
  'use strict';

  const NS = window.RoboDIEP || {};
  const FW = NS.FRAMEWORK;
  const L = NS.logic;
  if (!FW || !L) {
    const main = document.getElementById('main');
    if (main) main.append('The calculator could not start because a script file is missing. Reload the page or download a fresh copy.');
    return;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  const STEP_COUNT = FW.steps.length;
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const desktop = mq('(min-width: 1024px)');

  /* ======================================================================= */
  /* DOM helpers                                                             */
  /* ======================================================================= */

  const byId = (id) => document.getElementById(id);

  function append(el, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) append(el, child);
      else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  const PROPS = new Set(['checked', 'value', 'disabled', 'hidden', 'selected', 'open']);

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        const val = props[key];
        if (val === undefined || val === null || val === false) continue;
        if (key === 'class') el.className = val;
        else if (key === 'text') el.textContent = val;
        else if (key === 'on') for (const ev of Object.keys(val)) el.addEventListener(ev, val[ev]);
        else if (PROPS.has(key)) el[key] = val;
        else el.setAttribute(key, val === true ? '' : String(val));
      }
    }
    return append(el, children);
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVGNS, tag);
    for (const key of Object.keys(attrs || {})) {
      if (attrs[key] !== null && attrs[key] !== undefined) el.setAttribute(key, String(attrs[key]));
    }
    children.forEach((c) => c && el.appendChild(c));
    return el;
  }

  /** Re-render a container only when its content key changes. */
  function renderOnce(el, key, build) {
    const k = typeof key === 'string' ? key : JSON.stringify(key);
    if (el.dataset.key === k) return false;
    el.dataset.key = k;
    el.replaceChildren();
    append(el, [build()]);
    return true;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function scrollBehavior() {
    return reduceMotion.matches ? 'auto' : 'smooth';
  }

  /* ======================================================================= */
  /* Icons (original line icons, 24×24, stroke = currentColor)               */
  /* ======================================================================= */

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.2 1-1.2 1.8v.5"/><path d="M12 17.2h.01"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.7 18.3L18.3 5.7"/>',
    minus: '<path d="M6 12h12"/>',
    dot: '<circle cx="12" cy="12" r="2.2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    alert: '<path d="M12 3.8L2.6 19.8h18.8L12 3.8z"/><path d="M12 10v4.2"/><path d="M12 17.1h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/>',
    shield: '<path d="M12 3l7.5 3v5.6c0 4.4-3.1 8.1-7.5 9.4-4.4-1.3-7.5-5-7.5-9.4V6L12 3z"/><path d="M12 8.2v4.6"/><path d="M12 15.7h.01"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
    'chevron-up': '<path d="M6 14.5l6-6 6 6"/>',
    print: '<path d="M7 9V3.8h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.2H7z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6.2C5 5 6 4 7.2 4H15"/>',
    download: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
    refresh: '<path d="M19.5 12A7.5 7.5 0 1 1 17 6.4"/><path d="M19.5 4v4.5H15"/>',
    sparkle: '<path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    robot: '<path d="M4 20.5h9"/><path d="M8.5 20.5v-5.2"/><circle cx="8.5" cy="13" r="2.3"/><path d="M10.2 11.4l5.3-5.3"/><circle cx="16.6" cy="5" r="1.6"/><path d="M17.7 6.2l2.3 2.6"/><path d="M20 8.8l-1.6 1.4"/><path d="M20 8.8l.6 2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.2" r="2.5"/><path d="M15.8 14.1a4.6 4.6 0 0 1 5.7 4.4"/>',
    fork: '<path d="M12 21v-7"/><path d="M12 14L6.5 8.5"/><path d="M12 14l5.5-5.5"/><path d="M5 4.5v4.5h4.5"/><path d="M19 4.5v4.5h-4.5"/>',
    scan: '<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5l-4.8-4.8"/><path d="M11 8.2v5.6M8.2 11h5.6"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01"/>',
    ruler: '<path d="M3.5 16.5L16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
    book: '<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v15H7a2.5 2.5 0 0 0-2.5 2.5z"/><path d="M4.5 20.5v-15"/><path d="M8.5 7.5h7M8.5 11h5"/>',
    quote: '<path d="M7 7h4v4.2c0 3.1-1.6 5.3-4.3 6.3"/><path d="M14 7h4v4.2c0 3.1-1.6 5.3-4.3 6.3"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4.5h11.5l-2.2 4 2.2 4H5"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
    layers: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 5v14"/>',
    pencil: '<path d="M4 20h4.2L19 9.2 14.8 5 4 15.8z"/><path d="M13 6.8l4.2 4.2"/>',
    arrow: '<path d="M5 12h14"/><path d="M13.5 6.5L19 12l-5.5 5.5"/>',
    clipboard: '<rect x="5.5" y="4.5" width="13" height="16.5" rx="2.2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 13l2.2 2.2L15.5 11"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'
  };

  function icon(name, cls) {
    const el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    el.innerHTML = ICONS[name] || '';
    return el;
  }

  /** Three ascending bars; `level` of them filled (1–3). */
  function levelIcon(level) {
    const el = s('svg', { viewBox: '0 0 16 16', class: 'icon level', 'aria-hidden': 'true', focusable: 'false' });
    [[1, 9, 5], [6, 6, 8], [11, 3, 11]].forEach(([x, y, height], i) => {
      el.appendChild(s('rect', { x, y, width: 4, height, rx: 1.2, class: i < level ? 'on' : 'off' }));
    });
    return el;
  }

  /* ======================================================================= */
  /* Grade chips: the grade word is always shown (never color alone)          */
  /* ======================================================================= */

  const TONE = {
    cx: { low: 'good', moderate: 'mid', high: 'warn', na: 'na', none: 'none' },
    benefit: { substantial: 'good', moderate: 'mid', small: 'warn', na: 'na' },
    gate: { passed: 'good', notConfirmed: 'warn', failed: 'fail', incomplete: 'na' },
    answer: { yes: 'good', no: 'fail', uncertain: 'warn' }
  };
  const LEVEL = {
    cx: { low: 1, moderate: 2, high: 3 },
    benefit: { small: 1, moderate: 2, substantial: 3 }
  };
  const GLYPH = {
    na: 'question', none: 'ban', passed: 'check', yes: 'check', failed: 'x', no: 'x',
    notConfirmed: 'question', uncertain: 'question', incomplete: 'minus'
  };
  const PLAN_ICON = { robotic: 'robot', expert: 'users', hybrid: 'fork', assess: 'scan' };

  function gateText(key) {
    if (key === 'incomplete') return 'Not answered';
    return L.capitalize(FW.gate1.statusText[key] || '');
  }

  function chipLabel(kind, key) {
    if (kind === 'cx') return L.complexityLabel(key);
    if (kind === 'benefit') return L.benefitLabel(key);
    if (kind === 'gate') return gateText(key);
    if (kind === 'answer') return FW.gate1.answers[key];
    return String(key);
  }

  function chip(kind, key, extraClass) {
    if (!key) return h('span', { class: 'empty-val' }, '—', h('span', { class: 'sr-only' }, 'not yet graded'));
    const tone = (TONE[kind] && TONE[kind][key]) || 'na';
    const level = LEVEL[kind] && LEVEL[kind][key];
    const glyph = level ? levelIcon(level) : icon(GLYPH[key] || 'dot');
    return h('span', { class: 'chip tone-' + tone + (extraClass ? ' ' + extraClass : '') }, glyph, h('span', { class: 'chip-text' }, chipLabel(kind, key)));
  }

  function tag(kind, key) {
    if (!key) return null;
    const text = kind === 'course' ? FW.complexity.domains.course.tags[key] : FW.benefit.tags[key];
    return h('span', { class: 'tag tag-' + key }, text);
  }

  function callout(tone, iconName, title, body, extra) {
    return h('div', { class: 'callout callout-' + tone },
      icon(iconName, 'callout-icon'),
      h('div', { class: 'callout-content' },
        title ? h('p', { class: 'callout-title' }, title) : null,
        body ? h('p', { class: 'callout-text' }, body) : null,
        extra || null));
  }

  /* ---- (?) tips: help text shown on hover, keyboard focus, or tap ---- */
  let tipSeq = 0;
  let pinnedTip = null;

  function placeTip(wrap) {
    const btn = wrap.firstChild;
    const pop = wrap.lastChild;
    const r = btn.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + 'px';
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    pop.style.left = left + 'px';
    const below = r.bottom + 8;
    const h0 = pop.offsetHeight;
    pop.style.top = (below + h0 > window.innerHeight - 8 && r.top - h0 - 8 > 8 ? r.top - h0 - 8 : below) + 'px';
  }

  function setTip(wrap, open) {
    const btn = wrap.firstChild;
    const pop = wrap.lastChild;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('is-open', open);
    if (open) placeTip(wrap);
  }

  function closePinned() {
    if (pinnedTip) { setTip(pinnedTip, false); pinnedTip = null; }
  }

  /** A small (?) button that reveals `text`. Returns { el, id } (id for aria-describedby). */
  function tip(text, label) {
    const id = 'tip-' + (++tipSeq);
    const btn = h('button', { type: 'button', class: 'tip-btn', 'aria-label': label || 'More information', 'aria-expanded': 'false', 'aria-controls': id }, '?');
    const pop = h('span', { class: 'tip-pop', id, role: 'tooltip', hidden: true },
      [].concat(text).map((t) => h('span', { class: 'tip-para' }, t)));
    const wrap = h('span', { class: 'tip' }, btn, pop);
    const hoverable = mq('(hover: hover)').matches;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pinnedTip === wrap) { closePinned(); return; }
      closePinned();
      pinnedTip = wrap;
      setTip(wrap, true);
    });
    if (hoverable) {
      wrap.addEventListener('mouseenter', () => setTip(wrap, true));
      wrap.addEventListener('mouseleave', () => { if (pinnedTip !== wrap) setTip(wrap, false); });
    }
    btn.addEventListener('focus', () => setTip(wrap, true));
    btn.addEventListener('blur', () => { if (pinnedTip !== wrap) setTip(wrap, false); });
    return { el: wrap, id };
  }

  document.addEventListener('click', (e) => { if (pinnedTip && !pinnedTip.contains(e.target)) closePinned(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePinned(); });
  window.addEventListener('scroll', () => { if (pinnedTip) placeTip(pinnedTip); }, { passive: true });

  function extLink(href, text) {
    return h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'ext-link' }, text, icon('external', 'ext-icon'), h('span', { class: 'sr-only' }, ' (opens in a new tab)'));
  }

  /* ======================================================================= */
  /* State (memory only)                                                     */
  /* ======================================================================= */

  function newSide(name) {
    const side = L.createSide(name);
    // maxStep: the furthest step visited. Steps are opened in order at least once,
    // so the pre-suggested benefit grade (Step 4) is always seen before Step 5.
    side.ui = { step: 1, maxStep: 1, attempted: {}, touched: {} };
    return side;
  }

  /** Per-step display status for the stepper and the progress ring. */
  function stepStatuses(side, ev) {
    const statuses = FW.steps.map((title, i) => {
      const n = i + 1;
      const open = ev.reachable[i] && n <= side.ui.maxStep + 1;
      if (n === 1 && ev.gate === 'failed') return 'failed';
      if (n <= 5 && ev.steps[i].valid && ev.reachable[i] && n <= side.ui.maxStep) {
        return n === 1 && ev.gate === 'notConfirmed' ? 'warn' : 'done';
      }
      if (n === 6 && ev.gate === 'failed' && ev.reachable[5]) return 'open';
      return open ? 'open' : 'locked';
    });
    const completed = statuses.slice(0, 5).filter((st) => st === 'done' || st === 'warn').length;
    return { statuses, completed };
  }

  const state = {
    caseLabel: '',
    bilateral: false,
    active: 0,
    sides: [newSide(null)],
    example: null,
    tab: 'calculator'
  };
  let dirty = false;

  const opts = () => ({ bilateral: state.bilateral });
  const evalSide = (side) => L.evaluateSide(side, opts());
  const sideName = (side) => (side.side ? FW.sideLong[side.side] : 'Side not chosen');

  function showError(side, step, field) {
    return !!(side.ui.attempted[step] || side.ui.touched[field]);
  }

  /* ======================================================================= */
  /* Fictional teaching examples (not patient data)                          */
  /* ======================================================================= */

  const YES = { perforators: 'yes', flow: 'yes', notCompromised: 'yes' };
  const EXAMPLES = [
    {
      id: 'robotic',
      title: 'Robotic candidate',
      desc: 'One side · short intramuscular course, no scar',
      label: 'Example 1 (fictional)',
      bilateral: false,
      sides: [{
        side: 'Left', gate1: YES,
        m: { A: '2.1', C: '11.8', course3d: '2.6', paramuscular: false, arcuateRelation: 'above', arcuateMethod: 'identified' },
        cx: { config: 'low', route: 'TAPP', access: 'low', team: 'established' }
      }]
    },
    {
      id: 'bilateral',
      title: 'Both sides, different plans',
      desc: 'Bilateral · small projected saving on the right',
      label: 'Example 2 (fictional)',
      bilateral: true,
      sides: [
        {
          side: 'Left', gate1: YES,
          m: { A: '2.8', C: '12.4', course3d: '3.4', paramuscular: false, arcuateRelation: 'above', arcuateMethod: 'identified' },
          cx: { config: 'low', route: 'TEP', access: 'low', team: 'established' }
        },
        {
          side: 'Right', gate1: YES,
          m: { A: '7.4', C: '9.6', course3d: '', paramuscular: false, arcuateRelation: 'crossing', arcuateMethod: 'estimated' },
          cx: { config: 'moderate', route: 'TEP', access: 'low', team: 'established' }
        }
      ]
    },
    {
      id: 'mesh',
      title: 'Prior mesh repair',
      desc: 'One side · high access complexity, large projected saving',
      label: 'Example 3 (fictional)',
      bilateral: false,
      sides: [{
        side: 'Right', gate1: YES,
        m: { A: '3.0', C: '13.1', course3d: '3.6', paramuscular: false, arcuateRelation: 'crossing', arcuateMethod: 'identified' },
        cx: { config: 'low', route: 'TAPP', access: 'high', team: 'established' }
      }]
    },
    {
      id: 'uncertain',
      title: 'Flap safety uncertain',
      desc: 'One side · venous drainage concern unresolved',
      label: 'Example 4 (fictional)',
      bilateral: false,
      sides: [{
        side: 'Left', gate1: { perforators: 'yes', flow: 'uncertain', notCompromised: 'yes' },
        m: { A: '4.2', C: '12.9', course3d: '', paramuscular: false, arcuateRelation: 'above', arcuateMethod: 'identified' },
        cx: { config: 'moderate', route: 'TEP', access: 'low', team: 'established' }
      }]
    }
  ];

  /* ======================================================================= */
  /* Elements                                                                */
  /* ======================================================================= */

  const els = {
    tablist: byId('tablist'),
    disclaimer: byId('disclaimer'),
    footer: byId('footer'),
    toast: byId('toast'),
    live: byId('live'),
    dialog: byId('dialog'),
    printRoot: byId('print-root'),
    panels: {
      calculator: byId('panel-calculator'),
      measure: byId('panel-measure'),
      evidence: byId('panel-evidence'),
      about: byId('panel-about')
    }
  };
  let calc = null; // calculator chrome (case bar, side switch, views host, live panel)
  let views = []; // one view per side

  /* ======================================================================= */
  /* Live region, toast, dialog                                              */
  /* ======================================================================= */

  function announce(message) {
    els.live.textContent = '';
    window.setTimeout(() => { els.live.textContent = message; }, 40);
  }

  let toastTimer = 0;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2800);
  }

  /** In-page confirmation dialog (never the browser's confirm()). Resolves true/false. */
  function confirmDialog(cfg) {
    return new Promise((resolve) => {
      const dialog = els.dialog;
      const ok = byId('dialog-confirm');
      const cancel = byId('dialog-cancel');
      byId('dialog-title').textContent = cfg.title;
      byId('dialog-body').replaceChildren(...[].concat(cfg.body).filter(Boolean));
      ok.textContent = cfg.confirm || 'Confirm';
      ok.hidden = cfg.confirm === null;
      cancel.textContent = cfg.cancel || 'Cancel';
      const previous = document.activeElement;
      const finish = (value) => {
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        dialog.removeEventListener('cancel', onEscape);
        if (dialog.open) dialog.close();
        resolve(value);
        if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onEscape = (e) => { e.preventDefault(); finish(false); };
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      dialog.addEventListener('cancel', onEscape);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      (cfg.focus === 'confirm' ? ok : cancel).focus();
    });
  }

  /* ======================================================================= */
  /* Tabs (hash routing; the hash never carries case data)                   */
  /* ======================================================================= */

  const TABS = [
    { id: 'calculator', hash: 'calculator', icon: 'calculator' },
    { id: 'measure', hash: 'how-to-measure', icon: 'ruler' },
    { id: 'evidence', hash: 'evidence', icon: 'book' },
    { id: 'about', hash: 'about', icon: 'quote' }
  ];

  function tabFromHash() {
    const hash = (window.location.hash || '').replace('#', '');
    const tab = TABS.find((t) => t.hash === hash);
    return tab ? tab.id : null;
  }

  function buildTabs() {
    TABS.forEach((t, i) => {
      const btn = h('button', {
        type: 'button', role: 'tab', id: 'tab-' + t.id, class: 'tab',
        'aria-controls': 'panel-' + t.id, 'aria-selected': 'false', tabindex: '-1'
      }, icon(t.icon, 'tab-icon'), h('span', { class: 'tab-label' }, FW.tabs[t.id]));
      btn.addEventListener('click', () => selectTab(t.id, true));
      btn.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = TABS.length - 1;
        if (next === null) return;
        e.preventDefault();
        selectTab(TABS[next].id, true);
        byId('tab-' + TABS[next].id).focus();
      });
      els.tablist.append(btn);
    });
  }

  function selectTab(id, fromUser) {
    state.tab = id;
    TABS.forEach((t) => {
      const selected = t.id === id;
      const btn = byId('tab-' + t.id);
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      els.panels[t.id].hidden = !selected;
    });
    const tab = TABS.find((t) => t.id === id);
    if (fromUser) {
      if (window.location.hash !== '#' + tab.hash) {
        try { window.history.pushState(null, '', '#' + tab.hash); } catch (e) { window.location.hash = tab.hash; }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    document.title = id === 'calculator' ? FW.meta.toolName : FW.tabs[id] + ' · ' + FW.meta.toolName;
    if (id === 'calculator') refresh();
  }

  /* ======================================================================= */
  /* Static chrome: header text, disclaimer, footer                          */
  /* ======================================================================= */

  function authorLine() {
    const a = FW.meta.authors;
    const aff = FW.meta.affiliations || [];
    return a.map((name, i) => (aff[i] ? name + ' (' + aff[i] + ')' : name)).join(', ');
  }

  function renderStatic() {
    byId('brand-word').textContent = FW.meta.wordmark;
    byId('brand-title').textContent = FW.meta.toolName;
    byId('version-pill').textContent = 'v' + FW.version;
    els.disclaimer.replaceChildren(icon('shield', 'disclaimer-icon'), h('p', null, FW.disclaimer));
    const lic = FW.meta.license;
    els.footer.replaceChildren(h('div', { class: 'wrap footer-grid' },
      h('div', { class: 'footer-col' },
        h('p', { class: 'footer-title' }, FW.meta.wordmark + ' · ' + FW.meta.toolName + ' v' + FW.version),
        h('p', null, FW.disclaimer),
        h('p', { class: 'footer-privacy' }, icon('lock', 'inline-icon'), FW.privacy + '.')),
      h('div', { class: 'footer-col' },
        h('p', null, h('span', { class: 'footer-k' }, 'Authors: '), authorLine()),
        h('p', null, '© ' + FW.meta.copyrightYear + ' ' + FW.meta.authors.join(' and ') + '. Code: ' + lic.code + '. Clinical text and figures: ' + lic.content + '.'),
        h('p', { class: 'footer-links' },
          h('a', { href: '#about' }, 'How to cite'), ' · ',
          extLink(FW.meta.issuesUrl, FW.about.reportIssue), ' · ',
          extLink(FW.meta.repoUrl, 'Source code'), ' · ',
          extLink(FW.meta.changelogUrl, 'Changelog')))));
  }

  /* ======================================================================= */
  /* Form building blocks                                                    */
  /* ======================================================================= */

  function setFieldError(errEl, inputs, message, helpId) {
    const msg = message || '';
    if (errEl.dataset.msg !== msg) {
      errEl.dataset.msg = msg;
      errEl.hidden = !msg;
      errEl.replaceChildren(...(msg ? [icon('alert', 'error-icon'), h('span', null, msg)] : []));
    }
    inputs.forEach((input) => {
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      const ids = [helpId, msg ? errEl.id : null].filter(Boolean).join(' ');
      if (ids) input.setAttribute('aria-describedby', ids);
      else input.removeAttribute('aria-describedby');
    });
  }

  /**
   * A radio group inside a fieldset with a legend.
   * variant: 'cards' (stacked option cards), 'pills' (segmented), 'plans'.
   */
  function choiceGroup(cfg) {
    const errId = cfg.name + '-error';
    const tipObj = cfg.tip ? tip(cfg.tip) : null;
    const helpId = tipObj ? tipObj.id : (cfg.help ? cfg.name + '-help' : null);
    const inputs = [];
    const list = h('div', { class: 'choices choices-' + (cfg.variant || 'cards') });
    cfg.options.forEach((opt) => {
      const id = cfg.name + '-' + opt.value;
      const input = h('input', { type: 'radio', class: 'choice-input', name: cfg.name, id, value: opt.value });
      input.addEventListener('change', () => { if (input.checked) cfg.onChange(opt.value); });
      inputs.push(input);
      const body = h('span', { class: 'choice-body' },
        opt.content || [
          opt.chip || null,
          !opt.chip && opt.iconName ? icon(opt.iconName, 'choice-icon') : null,
          !opt.chip && opt.label ? h('span', { class: 'choice-label' }, opt.label) : null,
          opt.desc ? h('span', { class: 'choice-desc' }, opt.desc) : null,
          opt.extra || null
        ]);
      list.append(h('label', { class: 'choice', for: id, 'data-tone': opt.tone || null, 'data-value': opt.value },
        input, body, h('span', { class: 'choice-mark', 'aria-hidden': 'true' }, icon('check'))));
    });
    const err = h('p', { class: 'field-error', id: errId, hidden: true });
    const fieldset = h('fieldset', { class: 'group' + (cfg.cls ? ' ' + cfg.cls : '') },
      h('legend', { class: 'group-legend' }, cfg.legend, tipObj ? tipObj.el : null),
      cfg.before || null,
      list,
      cfg.help ? h('p', { class: 'field-help', id: helpId }, cfg.help) : null,
      cfg.after || null,
      err);
    if (helpId) inputs.forEach((input) => input.setAttribute('aria-describedby', helpId));
    return {
      el: fieldset,
      inputs,
      setValue(value) { inputs.forEach((input) => { input.checked = input.value === value; }); },
      setError(message) { setFieldError(err, inputs, message, helpId); },
      option(value) { return list.querySelector('[data-value="' + value + '"]'); },
      focus() { (inputs.find((i) => i.checked) || inputs[0]).focus(); }
    };
  }

  /** Text input with an optional unit suffix ("cm"). */
  function textField(cfg) {
    const input = h('input', {
      id: cfg.id, type: 'text', class: 'input' + (cfg.unit ? ' input-num' : ''),
      inputmode: cfg.inputmode || null, autocomplete: 'off', spellcheck: 'false',
      maxlength: cfg.maxlength ? String(cfg.maxlength) : null
    });
    const tipObj = cfg.tip ? tip(cfg.tip) : null;
    const helpId = tipObj ? tipObj.id : (cfg.help ? cfg.id + '-help' : null);
    const err = h('p', { class: 'field-error', id: cfg.id + '-error', hidden: true });
    input.addEventListener('input', () => cfg.onInput(input.value));
    if (cfg.onBlur) input.addEventListener('blur', () => cfg.onBlur(input.value));
    const el = h('div', { class: 'field' + (cfg.cls ? ' ' + cfg.cls : '') },
      h('div', { class: 'field-head' },
        h('label', { class: 'field-label', for: cfg.id },
          cfg.label,
          cfg.unit ? h('span', { class: 'sr-only' }, ' (' + cfg.unit + ')') : null,
          cfg.req ? h('span', { class: 'field-req' }, ' ' + cfg.req) : null,
          tipObj ? tipObj.el : null)),
      cfg.unit
        ? h('div', { class: 'input-group' }, input, h('span', { class: 'input-unit', 'aria-hidden': 'true' }, cfg.unit))
        : input,
      cfg.help ? h('p', { class: 'field-help', id: helpId }, cfg.help) : null,
      err);
    if (helpId) input.setAttribute('aria-describedby', helpId);
    return {
      el,
      input,
      setValue(value, force) {
        if (force || document.activeElement !== input) {
          if (input.value !== value) input.value = value;
        }
      },
      setError(message) { setFieldError(err, [input], message, helpId); }
    };
  }

  function checkboxField(cfg) {
    const input = h('input', { type: 'checkbox', id: cfg.id, class: 'check-input' });
    input.addEventListener('change', () => cfg.onChange(input.checked));
    const tipObj = cfg.tip ? tip(cfg.tip) : null;
    const helpId = tipObj ? tipObj.id : (cfg.help ? cfg.id + '-help' : null);
    if (helpId) input.setAttribute('aria-describedby', helpId);
    const el = h('div', { class: 'check-field' },
      h('div', { class: 'field-head' },
        h('label', { class: 'check', for: cfg.id }, input,
          h('span', { class: 'check-box', 'aria-hidden': 'true' }, icon('check')),
          h('span', { class: 'check-label' }, cfg.label, tipObj ? tipObj.el : null))),
      cfg.help ? h('p', { class: 'field-help check-help', id: helpId }, cfg.help) : null);
    return { el, input, setChecked(v) { input.checked = !!v; } };
  }

  /* ======================================================================= */
  /* Visualisations                                                          */
  /* ======================================================================= */

  /** Tall segmented bar: C split into A (intramuscular) and B (projected saving). */
  function segBar() {
    const labelA = h('span', { class: 'seg-label' });
    const labelB = h('span', { class: 'seg-label' });
    const segA = h('div', { class: 'seg seg-a' }, labelA);
    const segB = h('div', { class: 'seg seg-b' }, labelB);
    const anchors = FW.complexity.courseCutoffs;
    const anchorCm = [anchors.lowMaxCm, anchors.moderateMaxCm];
    const ticks = anchorCm.map(() => h('span', { class: 'seg-tick', 'aria-hidden': 'true' }));
    const tickLabels = anchorCm.map((cm) => h('span', { class: 'seg-tick-label' }, cm + ' cm'));
    const bar = h('div', { class: 'segbar', role: 'img' }, segA, segB, ticks);
    const el = h('figure', { class: 'viz', hidden: true },
      h('figcaption', { class: 'viz-title' }, 'C split into A and B'),
      h('div', { class: 'segbar-ticks', 'aria-hidden': 'true' }, tickLabels),
      bar,
      h('div', { class: 'segbar-axis', 'aria-hidden': 'true' },
        h('span', null, 'Perforator'), h('span', null, 'External iliac origin')),
      h('ul', { class: 'legend' },
        h('li', null, h('span', { class: 'swatch swatch-a' }), 'A · intramuscular course'),
        h('li', null, h('span', { class: 'swatch swatch-b' }), 'B · projected fascial saving'),
        h('li', null, h('span', { class: 'swatch swatch-tick' }), anchorCm.join(' and ') + ' cm research anchors (on A)')));
    return {
      el,
      update(v) {
        el.hidden = !v;
        if (!v) return;
        const width = bar.getBoundingClientRect().width || 320;
        const aPct = (v.aTenths / v.cTenths) * 100;
        // Two blocks separated by a 2px surface gap (flex gap); widths share it.
        segA.hidden = v.aTenths === 0;
        segA.style.width = 'calc(' + aPct + '% - 1px)';
        segB.style.width = v.aTenths === 0 ? '100%' : 'calc(' + (100 - aPct) + '% - 1px)';
        labelA.textContent = 'A ' + L.formatCm(v.aTenths);
        labelB.textContent = 'B ' + L.formatCm(v.bTenths);
        labelA.hidden = (aPct / 100) * width < 52;
        labelB.hidden = ((100 - aPct) / 100) * width < 52;
        let lastPx = -100;
        anchorCm.forEach((cm, i) => {
          const t = Math.round(cm * 10);
          const inside = t < v.cTenths;
          ticks[i].hidden = !inside;
          tickLabels[i].hidden = true;
          if (!inside) return;
          const pct = (t / v.cTenths) * 100;
          ticks[i].style.left = pct + '%';
          tickLabels[i].style.left = pct + '%';
          const px = (pct / 100) * width;
          if (px - lastPx > 48 && px > 18 && width - px > 18) { tickLabels[i].hidden = false; lastPx = px; }
        });
        bar.setAttribute('aria-label', 'C ' + L.formatCm(v.cTenths) + ' cm, split into A ' + L.formatCm(v.aTenths) +
          ' cm (intramuscular course) and B ' + L.formatCm(v.bTenths) + ' cm (projected fascial saving, ' +
          L.formatPercent(v.bTenths, v.cTenths) + ' of C).');
      }
    };
  }

  /** B/C meter with the example cutoffs as ticks and the benefit words beneath. */
  function ratioMeter(large) {
    const cut = FW.benefit.cutoffs;
    const fill = h('div', { class: 'meter-fill' });
    const ticks = [cut.moderateMin, cut.substantialMin].map((c) => {
      const t = h('span', { class: 'meter-tick', 'aria-hidden': 'true' });
      t.style.left = c * 100 + '%';
      return t;
    });
    const track = h('div', { class: 'meter-track', role: 'img' }, fill, ticks);
    const value = h('span', { class: 'meter-value' });
    const zones = [
      ['small', 0, cut.moderateMin],
      ['moderate', cut.moderateMin, cut.substantialMin],
      ['substantial', cut.substantialMin, 1]
    ].map(([key, from, to]) => {
      const z = h('span', { class: 'meter-zone', 'data-zone': key }, FW.benefit.grades[key]);
      z.style.width = (to - from) * 100 + '%';
      return z;
    });
    const el = h('figure', { class: 'viz meter' + (large ? ' meter-large' : ''), hidden: true },
      h('div', { class: 'meter-head' }, h('figcaption', { class: 'viz-title' }, 'B/C, projected fascial saving'), value),
      track,
      h('div', { class: 'meter-zones', 'aria-hidden': 'true' }, zones),
      null);
    el.querySelector('.meter-head').firstChild.after(tip('Ticks at ' + cut.moderateMin + ' and ' + cut.substantialMin + ': example cutoffs, not validated.', 'About the cutoffs').el);
    return {
      el,
      update(v) {
        el.hidden = !v;
        if (!v) return;
        const pct = (v.bTenths / v.cTenths) * 100;
        fill.style.width = pct + '%';
        value.textContent = L.formatPercent(v.bTenths, v.cTenths);
        const grade = L.suggestBenefit(v.ratio);
        zones.forEach((z) => z.classList.toggle('is-active', z.dataset.zone === grade));
        track.setAttribute('aria-label', 'B/C ' + L.formatPercent(v.bTenths, v.cTenths) +
          '. Example cutoffs ' + cut.moderateMin + ' and ' + cut.substantialMin + ', not validated.');
      }
    };
  }

  /** Progress ring for the live panel. */
  function ring(side, ev, size) {
    const r = 17;
    const c = 2 * Math.PI * r;
    const failed = ev.status === 'failed';
    const done = ev.status === 'complete';
    const frac = failed ? 1 : stepStatuses(side, ev).completed / 5;
    const el = s('svg', { viewBox: '0 0 44 44', class: 'ring' + (size ? ' ring-' + size : '') + (failed ? ' is-failed' : '') + (done ? ' is-done' : ''), 'aria-hidden': 'true' },
      s('circle', { cx: 22, cy: 22, r, class: 'ring-track' }),
      s('circle', { cx: 22, cy: 22, r, class: 'ring-bar', 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': (c * (1 - frac)).toFixed(2), transform: 'rotate(-90 22 22)' }));
    const center = s('text', { x: 22, y: 22, class: 'ring-text', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    center.textContent = failed ? '!' : done ? '✓' : Math.round(frac * 100) + '%';
    el.appendChild(center);
    return el;
  }

  /* ======================================================================= */
  /* Calculator chrome                                                       */
  /* ======================================================================= */

  function buildExamplesMenu() {
    const details = h('details', { class: 'menu' });
    const summary = h('summary', { class: 'btn btn-secondary btn-sm menu-summary' }, icon('sparkle'), 'Try an example', icon('chevron-down', 'menu-caret'));
    const list = h('div', { class: 'menu-list' },
      h('p', { class: 'menu-note' }, 'Fictional cases for teaching. Loading one replaces the current case.'),
      EXAMPLES.map((ex) => h('button', {
        type: 'button', class: 'menu-item',
        on: { click: () => { details.open = false; loadExample(ex); } }
      }, h('span', { class: 'menu-item-title' }, ex.title), h('span', { class: 'menu-item-desc' }, ex.desc))));
    details.append(summary, list);
    document.addEventListener('click', (e) => { if (details.open && !details.contains(e.target)) details.open = false; });
    details.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
    });
    return details;
  }

  function buildCalculator() {
    const label = h('input', {
      id: 'case-label', type: 'text', class: 'input', autocomplete: 'off', spellcheck: 'false',
      maxlength: String(FW.caseLabel.maxLength), 'aria-describedby': 'case-label-hint'
    });
    label.addEventListener('input', () => { state.caseLabel = label.value; markDirty(); refresh(); });

    const toggle = h('input', { type: 'checkbox', role: 'switch', id: 'bilateral', class: 'switch-input' });
    toggle.addEventListener('change', () => setBilateral(toggle.checked));

    const exampleBadge = h('p', { class: 'example-badge', hidden: true }, icon('sparkle'), 'Fictional example loaded: not patient data');

    const caseBar = h('section', { class: 'case-bar card', 'aria-label': 'Case' },
      h('div', { class: 'field case-field' },
        h('label', { class: 'field-label', for: 'case-label' }, FW.caseLabel.label, h('span', { class: 'field-req' }, ' (optional)')),
        label,
        h('p', { class: 'field-help', id: 'case-label-hint' }, icon('lock', 'inline-icon'), FW.caseLabel.hint)),
      h('div', { class: 'case-actions' },
        h('label', { class: 'switch', for: 'bilateral' }, toggle,
          h('span', { class: 'switch-track', 'aria-hidden': 'true' }, h('span', { class: 'switch-thumb' })),
          h('span', { class: 'switch-label' }, FW.bilateralToggle)),
        buildExamplesMenu(),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: startNewCase } }, icon('refresh'), FW.summary.actions.reset)),
      exampleBadge);

    const sideSwitch = h('div', { class: 'side-switch', role: 'tablist', 'aria-label': 'Hemiabdomen', hidden: true });
    const viewsHost = h('div', { class: 'views' });

    const panelToggle = h('button', { type: 'button', class: 'panel-toggle', 'aria-expanded': 'false', 'aria-controls': 'panel-body' });
    const panelBody = h('div', { class: 'panel-body', id: 'panel-body' });
    const panel = h('aside', { class: 'panel', 'aria-label': 'Live summary' }, panelToggle, panelBody);
    panelToggle.addEventListener('click', () => setPanelOpen(!panel.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open') && !desktop.matches) {
        setPanelOpen(false);
        panelToggle.focus();
      }
    });

    els.panels.calculator.append(h('div', { class: 'wrap' },
      caseBar,
      h('div', { class: 'calc-layout' },
        h('div', { class: 'calc-main' }, sideSwitch, viewsHost),
        panel)));

    calc = { label, toggle, exampleBadge, sideSwitch, viewsHost, panel, panelToggle, panelBody, lastPanel: {} };
  }

  function setPanelOpen(open) {
    calc.panel.classList.toggle('is-open', open);
    calc.panelToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('panel-open', open && !desktop.matches);
  }

  /* ======================================================================= */
  /* One side: stepper and six steps                                         */
  /* ======================================================================= */

  function buildSideView(idx) {
    const pid = 's' + idx;
    const S = () => state.sides[idx];
    const root = h('section', { class: 'side-view', id: pid + '-view' });
    if (state.bilateral) {
      root.setAttribute('role', 'tabpanel');
      root.setAttribute('aria-labelledby', 'side-tab-' + idx);
    } else {
      root.setAttribute('aria-label', 'Assessment');
    }

    const changed = (o) => { markDirty(); refresh(o); };
    const touch = (field) => { S().ui.touched[field] = true; refresh(); };

    /* ---- Stepper ---- */
    const stepButtons = [];
    const stepper = h('nav', { class: 'stepper', 'aria-label': 'Calculator steps' },
      h('ol', { class: 'stepper-list' }, FW.steps.map((title, i) => {
        const btn = h('button', { type: 'button', class: 'stepper-btn', on: { click: () => goStep(idx, i + 1) } },
          h('span', { class: 'stepper-dot' },
            h('span', { class: 'stepper-num' }, String(i + 1)),
            icon('check', 'stepper-glyph stepper-done'),
            icon('x', 'stepper-glyph stepper-failed'),
            icon('question', 'stepper-glyph stepper-warn')),
          h('span', { class: 'stepper-label' }, title),
          h('span', { class: 'sr-only stepper-status' }));
        stepButtons.push(btn);
        return h('li', { class: 'stepper-item' }, btn);
      })));
    const progress = h('div', { class: 'progress', 'aria-hidden': 'true' }, h('span', { class: 'progress-fill' }));
    const caption = h('p', { class: 'stepper-caption', 'aria-hidden': 'true' });
    root.append(stepper, progress, caption);

    /* ---- Step shell ---- */
    function shell(n, title, subtitle, body, cfg) {
      cfg = cfg || {};
      const headingId = pid + '-step' + n + '-title';
      const heading = h('h2', { id: headingId, class: 'step-title', tabindex: '-1' }, title);
      const sideBadge = state.bilateral ? h('span', { class: 'side-badge' }, icon('layers'), FW.sideLong[S().side]) : null;
      const back = n > 1
        ? h('button', { type: 'button', class: 'btn btn-secondary', on: { click: () => goStep(idx, n - 1) } }, icon('chevron-left'), 'Back')
        : h('span', { class: 'nav-spacer' });
      const next = cfg.noNext ? null : h('button', { type: 'button', class: 'btn btn-primary btn-next', on: { click: () => goNext(idx) } },
        h('span', null, cfg.nextLabel || 'Next: ' + FW.steps[n]), icon('chevron-right'));
      const el = h('section', { class: 'step card', 'aria-labelledby': headingId, 'data-step': String(n), hidden: true },
        h('header', { class: 'step-head' },
          h('span', { class: 'step-badge', 'aria-hidden': 'true' }, String(n)),
          h('div', { class: 'step-headings' },
            h('p', { class: 'step-kicker' }, 'Step ' + n + ' of ' + STEP_COUNT, sideBadge),
            h('div', { class: 'step-title-row' }, heading, cfg.tip ? tip(cfg.tip, 'About this step').el : null),
            subtitle ? h('p', { class: 'step-sub' }, subtitle) : null)),
        h('div', { class: 'step-body' }, body),
        h('div', { class: 'step-nav' }, back, cfg.extra || null, next));
      return { el, heading, next };
    }

    /* ---- Step 1: Gate 1 ---- */
    function step1() {
      const sideGroup = state.bilateral ? null : choiceGroup({
        name: pid + '-side', legend: FW.sideQuestion, variant: 'pills', cls: 'side-group',
        options: FW.sides.map((v) => ({ value: v, label: v })),
        onChange: (v) => { S().side = v; changed(); }
      });
      const gates = FW.gate1.items.map((item, i) => choiceGroup({
        name: pid + '-gate-' + item.id, variant: 'pills', cls: 'gate-item',
        legend: [h('span', { class: 'gate-num', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'gate-text' }, item.text)],
        options: ['yes', 'no', 'uncertain'].map((v) => ({
          value: v, label: FW.gate1.answers[v], iconName: GLYPH[v], tone: TONE.answer[v]
        })),
        onChange: (v) => { S().gate1[item.id] = v; changed(); }
      }));
      const status = h('div', { class: 'gate-status' });
      const docBtn = h('button', { type: 'button', class: 'btn btn-primary', hidden: true, on: { click: () => goStep(idx, 6) } },
        h('span', null, 'Document this outcome'), icon('chevron-right'));
      const sh = shell(1, FW.gate1.title, null,
        [sideGroup ? sideGroup.el : null, h('div', { class: 'gate-list' }, gates.map((g) => g.el)), status],
        { extra: docBtn, tip: 'Answer all three items. Any “No” stops the assessment for this side; any “Uncertain” lets you continue, but the suggestion becomes “' + FW.plan.plans.assess.label + '”.' });

      function statusContent(ev) {
        if (ev.gate === 'passed') {
          return callout('good', 'check', 'Gate 1 passed', 'All three items answered Yes.');
        }
        if (ev.gate === 'notConfirmed') {
          return callout('warn', 'question', FW.gate1.uncertainReason,
            'You can continue. The suggestion will be “' + FW.plan.plans.assess.label + '”.');
        }
        if (ev.gate === 'failed') {
          const box = callout('fail', 'x', 'Gate 1 failed: hard stop', FW.gate1.failMessage,
            h('p', { class: 'callout-text callout-sub' }, 'Grades and a plan are not shown for this side. Change an answer to continue, or document this outcome.'));
          box.setAttribute('role', 'alert');
          return box;
        }
        return null;
      }

      return {
        el: sh.el, heading: sh.heading,
        firstError() {
          if (sideGroup && !S().side) return sideGroup;
          return gates.find((g, i) => !S().gate1[FW.gate1.items[i].id]);
        },
        update(ev) {
          const side = S();
          const errs = ev.steps[0].errors;
          if (sideGroup) {
            sideGroup.setValue(side.side);
            sideGroup.setError(showError(side, 1, 'side') ? errs.side : null);
          }
          gates.forEach((g, i) => {
            const id = FW.gate1.items[i].id;
            g.setValue(side.gate1[id]);
            g.setError(showError(side, 1, 'gate1.' + id) ? errs['gate1.' + id] : null);
          });
          renderOnce(status, ev.gate, () => statusContent(ev));
          sh.next.hidden = ev.gate === 'failed';
          docBtn.hidden = !(ev.gate === 'failed' && ev.reachable[5]);
        }
      };
    }

    /* ---- Step 2: CT measurements ---- */
    function step2() {
      const C = FW.ct;
      const fA = textField({
        id: pid + '-A', label: C.A.label, tip: L.capitalize(C.A.requirement) + '.', unit: C.unit, inputmode: 'decimal', cls: 'field-num',
        onInput: (v) => { S().m.A = v; changed(); },
        onBlur: (v) => { if (v.trim()) touch('A'); }
      });
      const para = checkboxField({
        id: pid + '-para', label: C.paramuscular.label, tip: L.capitalize(C.paramuscular.hint) + '.',
        onChange: (v) => { S().m.paramuscular = v; changed(); }
      });
      const fC = textField({
        id: pid + '-C', label: C.C.label, unit: C.unit, inputmode: 'decimal', cls: 'field-num',
        onInput: (v) => { S().m.C = v; changed(); },
        onBlur: (v) => { if (v.trim()) touch('C'); }
      });
      const f3 = textField({
        id: pid + '-3d', label: C.course3d.label, tip: C.course3d.help, unit: C.unit, inputmode: 'decimal', cls: 'field-num',
        onInput: (v) => { S().m.course3d = v; changed(); },
        onBlur: (v) => { if (v.trim()) touch('course3d'); }
      });
      const rel = choiceGroup({
        name: pid + '-rel', legend: C.arcuateRelation.label, variant: 'pills',
        options: Object.keys(C.arcuateRelation.options).map((k) => ({ value: k, label: C.arcuateRelation.options[k] })),
        onChange: (v) => { S().m.arcuateRelation = v; changed(); }
      });
      const relOptional = h('p', { class: 'field-help', hidden: true }, 'Not required when the arcuate line is indeterminate.');
      rel.el.append(relOptional);
      const meth = choiceGroup({
        name: pid + '-meth', legend: C.arcuateMethod.label, variant: 'list',
        options: Object.keys(C.arcuateMethod.options).map((k) => ({ value: k, label: C.arcuateMethod.options[k] })),
        onChange: (v) => { S().m.arcuateMethod = v; changed(); }
      });

      // Live calculation card
      const bOut = h('span', { class: 'calc-num' });
      const rOut = h('span', { class: 'calc-num' });
      const empty = h('p', { class: 'calc-empty' }, icon('ruler'), 'Enter A and C to see B and B/C.');
      const bar = segBar();
      const meter = ratioMeter(false);
      const calcCard = h('div', { class: 'calc' },
        h('p', { class: 'calc-kicker' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), 'Calculated live'),
        h('div', { class: 'calc-grid' },
          h('div', { class: 'calc-item' }, h('span', { class: 'calc-label' }, C.B.label), bOut),
          h('div', { class: 'calc-item' }, h('span', { class: 'calc-label' }, C.ratio.label), rOut)),
        h('p', { class: 'surrogate' }, icon('info', 'inline-icon'), C.surrogateLabel),
        empty, bar.el, meter.el);

      const sh = shell(2, C.title, 'Values in cm with one decimal place.', [
        h('div', { class: 'split' },
          h('div', { class: 'stack' }, fA.el, para.el, fC.el, f3.el, rel.el, meth.el),
          h('div', { class: 'split-aside' }, calcCard))
      ], { tip: C.help });

      return {
        el: sh.el, heading: sh.heading,
        firstError() {
          const errs = evalSide(S()).m.errors;
          if (errs.A) return { focus: () => fA.input.focus() };
          if (errs.C) return { focus: () => fC.input.focus() };
          if (errs.course3d) return { focus: () => f3.input.focus() };
          if (errs.arcuateRelation) return rel;
          if (errs.arcuateMethod) return meth;
          return null;
        },
        update(ev, o) {
          const side = S();
          const m = side.m;
          const errs = ev.m.errors;
          const att = side.ui.attempted[2];
          fA.setValue(m.A, o.syncInputs);
          fC.setValue(m.C, o.syncInputs);
          f3.setValue(m.course3d, o.syncInputs);
          para.setChecked(m.paramuscular);
          rel.setValue(m.arcuateRelation);
          meth.setValue(m.arcuateMethod);
          const liveAgeC = errs.A === FW.messages.aGeC;
          fA.setError(att || side.ui.touched.A || liveAgeC ? errs.A : null);
          fC.setError(att || side.ui.touched.C ? errs.C : null);
          f3.setError(att || side.ui.touched.course3d ? errs.course3d : null);
          rel.setError(att ? errs.arcuateRelation : null);
          meth.setError(att ? errs.arcuateMethod : null);
          relOptional.hidden = m.arcuateMethod !== 'indeterminate';
          const v = ev.values;
          empty.hidden = !!v;
          bOut.textContent = v ? L.formatCm(v.bTenths) + ' cm' : '—';
          rOut.textContent = v ? L.formatPercent(v.bTenths, v.cTenths) : '—';
          bar.update(v);
          meter.update(v);
        }
      };
    }

    /* ---- Step 3: Technical complexity ---- */
    function step3() {
      const D = FW.complexity.domains;
      const gradeOptions = (domain, keys) => keys.map((k) => ({
        value: k, chip: chip('cx', k), desc: (D[domain] && D[domain].descriptors[k]) || '', tone: TONE.cx[k]
      }));
      const config = choiceGroup({
        name: pid + '-config', legend: D.config.label, cls: 'domain',
        options: gradeOptions('config', ['low', 'moderate', 'high', 'na']),
        onChange: (v) => { S().cx.config = v; changed(); }
      });

      const courseTag = h('span', { class: 'tag' });
      const courseNote = h('p', { class: 'group-note' });
      const courseReset = h('button', {
        type: 'button', class: 'btn-link', hidden: true,
        on: { click: () => { S().cx.courseOverride = null; changed(); } }
      }, icon('refresh'), 'Reset to auto');
      const course = choiceGroup({
        name: pid + '-course', legend: [D.course.label, ' ', courseTag], cls: 'domain',
        before: courseNote, after: courseReset,
        options: gradeOptions('course', ['low', 'moderate', 'high', 'na']),
        onChange: (v) => {
          const auto = evalSide(S()).courseAuto;
          S().cx.courseOverride = v === auto ? null : v;
          changed();
        }
      });

      const route = choiceGroup({
        name: pid + '-route', legend: D.access.routeLabel, variant: 'pills', cls: 'route-group',
        options: Object.keys(D.access.routes).map((k) => ({ value: k, label: D.access.routes[k] })),
        onChange: (v) => { S().cx.route = v; changed(); }
      });
      const routeNote = h('p', { class: 'field-help', hidden: true }, 'No route is needed when no robotic route is feasible.');
      route.el.append(routeNote);
      const access = choiceGroup({
        name: pid + '-access', legend: D.access.label, cls: 'domain', before: route.el, tip: D.access.help,
        options: gradeOptions('access', ['low', 'moderate', 'high']).concat([
          { value: 'none', chip: chip('cx', 'none'), tone: 'none' },
          { value: 'na', chip: chip('cx', 'na'), tone: 'na' }
        ]),
        onChange: (v) => { S().cx.access = v; changed(); }
      });

      const team = choiceGroup({
        name: pid + '-team', legend: FW.complexity.team.label, variant: 'pills', cls: 'domain',
        tip: FW.complexity.team.help,
        options: Object.keys(FW.complexity.team.options).map((k) => ({ value: k, label: FW.complexity.team.options[k] })),
        onChange: (v) => { S().cx.team = v; changed(); }
      });

      const sh = shell(3, FW.complexity.title, FW.complexity.subtitle,
        [config.el, course.el, access.el, team.el], { tip: FW.benefit.notAssessableRule });

      return {
        el: sh.el, heading: sh.heading,
        firstError() {
          const errs = evalSide(S()).steps[2].errors;
          if (errs.config) return config;
          if (errs.route) return route;
          if (errs.access) return access;
          if (errs.team) return team;
          return null;
        },
        update(ev) {
          const side = S();
          const errs = ev.steps[2].errors;
          const att = side.ui.attempted[3];
          config.setValue(side.cx.config);
          config.setError(att ? errs.config : null);
          course.setValue(ev.course);
          courseTag.textContent = ev.courseSource ? D.course.tags[ev.courseSource] : '';
          courseTag.className = 'tag tag-' + (ev.courseSource || 'none');
          courseTag.hidden = !ev.courseSource;
          renderOnce(courseNote, [ev.courseAuto, side.m.paramuscular, ev.values && ev.values.aTenths], () => {
            if (!ev.courseAuto) return null;
            const from = side.m.paramuscular ? FW.ct.paramuscular.label : 'A = ' + L.formatCm(ev.values.aTenths) + ' cm';
            return [icon('arrow', 'inline-icon'), 'Auto-filled from Step 2: ' + from + ' → ', chip('cx', ev.courseAuto, 'chip-sm')];
          });
          courseReset.hidden = ev.courseSource !== 'overridden';
          ['low', 'moderate', 'high'].forEach((k) => course.option(k).classList.toggle('is-auto', k === ev.courseAuto));
          route.setValue(side.cx.route);
          route.setError(att ? errs.route : null);
          const noRoute = side.cx.access === 'none';
          route.el.classList.toggle('is-muted', noRoute);
          routeNote.hidden = !noRoute;
          access.setValue(side.cx.access);
          access.setError(att ? errs.access : null);
          team.setValue(side.cx.team);
          team.setError(att ? errs.team : null);
        }
      };
    }

    /* ---- Step 4: Expected benefit ---- */
    function step4() {
      const B = FW.benefit;
      const meter = ratioMeter(true);
      const benefitTag = h('span', { class: 'tag' });
      const reset = h('button', {
        type: 'button', class: 'btn-link', hidden: true,
        on: { click: () => { S().benefitOverride = null; changed(); } }
      }, icon('refresh'), 'Reset to suggested');
      const group = choiceGroup({
        name: pid + '-benefit', legend: [B.domainLabel, ' ', benefitTag], cls: 'domain',
        before: meter.el, after: reset, tip: B.suggestedLabel,
        options: ['substantial', 'moderate', 'small', 'na'].map((k) => ({
          value: k, chip: chip('benefit', k), desc: B.descriptors[k] || '', tone: TONE.benefit[k],
          extra: h('span', { class: 'sug-badge', hidden: true }, icon('sparkle'), B.tags.suggested)
        })),
        onChange: (v) => {
          const suggested = evalSide(S()).benefitSuggested;
          S().benefitOverride = v === suggested ? null : v;
          changed();
        }
      });
      const modifier = h('div', { class: 'modifier' });
      const sh = shell(4, B.title, B.subtitle, [group.el, modifier], { tip: B.notAssessableRule });

      return {
        el: sh.el, heading: sh.heading,
        firstError() { return null; },
        update(ev) {
          const side = S();
          meter.update(ev.values);
          group.setValue(ev.benefit);
          benefitTag.textContent = ev.benefitSource ? B.tags[ev.benefitSource] : '';
          benefitTag.className = 'tag tag-' + (ev.benefitSource || 'none');
          benefitTag.hidden = !ev.benefitSource;
          reset.hidden = ev.benefitSource !== 'overridden';
          ['substantial', 'moderate', 'small', 'na'].forEach((k) => {
            group.option(k).querySelector('.sug-badge').hidden = k !== ev.benefitSuggested;
          });
          renderOnce(modifier, [side.m.arcuateRelation, side.m.arcuateMethod], () => {
            const rel = side.m.arcuateRelation ? FW.ct.arcuateRelation.options[side.m.arcuateRelation] : 'Not recorded';
            const meth = side.m.arcuateMethod ? FW.ct.arcuateMethod.options[side.m.arcuateMethod] : '';
            return h('div', { class: 'modifier-card' },
              h('p', { class: 'modifier-label' }, B.arcuateModifierLabel),
              h('p', { class: 'modifier-value' }, h('strong', null, rel), meth ? ' · ' + meth : ''),
              ev.arcuateBelow ? callout('info', 'info', null, B.arcuateNote) : null);
          });
        }
      };
    }

    /* ---- Step 5: Integrated plan ---- */
    function step5() {
      const P = FW.plan;
      const hero = h('div', { class: 'hero' });
      let traceOpen = false;

      const planGroup = choiceGroup({
        name: pid + '-plan', variant: 'plans', cls: 'plans-group', tip: P.footnote,
        legend: [P.selectedLabel, h('span', { class: 'field-req' }, ' (required)')],
        before: h('p', { class: 'group-note' }, icon('pencil', 'inline-icon'), FW.finalPlanNote),
        options: P.order.map((k) => ({
          value: k, tone: 'plan',
          content: [
            h('span', { class: 'plan-top' },
              h('span', { class: 'plan-badge plan-' + k }, icon(PLAN_ICON[k])),
              h('span', { class: 'ribbon', hidden: true }, icon('sparkle'), FW.suggestionLabel)),
            h('span', { class: 'plan-name' }, P.plans[k].label),
            h('span', { class: 'plan-scenario' }, P.plans[k].scenario)
          ]
        })),
        onChange: (v) => { S().plan.selected = v; changed(); }
      });
      const differs = h('div', { class: 'differs', hidden: true, role: 'status' }, icon('alert'),
        h('span', null, h('strong', null, P.differs), ': a rationale is required.'));

      const limSuggest = h('div', { class: 'lim-suggest' });
      const select = h('select', { id: pid + '-lim', class: 'select' },
        h('option', { value: '' }, 'Choose…'),
        P.limitingOrder.map((k) => h('option', { value: k }, P.limitingOptions[k])));
      select.addEventListener('change', () => { S().plan.limiting = select.value || null; changed(); });
      const limErr = h('p', { class: 'field-error', id: pid + '-lim-error', hidden: true });
      const other = textField({
        id: pid + '-lim-other', label: P.otherLabel, maxlength: 120,
        onInput: (v) => { S().plan.limitingOther = v; changed(); },
        onBlur: () => touch('limitingOther')
      });
      const limField = h('div', { class: 'field' },
        h('label', { class: 'field-label', for: pid + '-lim' }, P.limitingLabel, h('span', { class: 'field-req' }, ' (required)')),
        limSuggest,
        h('div', { class: 'select-wrap' }, select, icon('chevron-down', 'select-caret')),
        limErr,
        other.el);

      const ta = h('textarea', {
        id: pid + '-rat', class: 'textarea', rows: '4', maxlength: String(P.rationaleMax), autocomplete: 'off'
      });
      ta.addEventListener('input', () => { S().plan.rationale = ta.value; changed(); });
      const counter = h('span', { class: 'counter', 'aria-hidden': 'true' });
      const ratReq = h('span', { class: 'field-req' });
      const ratErr = h('p', { class: 'field-error', id: pid + '-rat-error', hidden: true });
      const ratHelpId = pid + '-rat-help';
      const ratField = h('div', { class: 'field' },
        h('label', { class: 'field-label', for: pid + '-rat' }, P.rationaleLabel, ratReq),
        ta,
        h('div', { class: 'field-meta' },
          h('p', { class: 'field-help', id: ratHelpId }, icon('lock', 'inline-icon'), FW.caseLabel.hint, ' Up to ' + P.rationaleMax + ' characters.'),
          counter),
        ratErr);

      const sh = shell(5, P.title, null, [
        hero,
        planGroup.el,
        differs,
        h('div', { class: 'surgeon-grid' }, limField, ratField),
        h('div', { class: 'override' }, icon('eye', 'override-icon'), h('p', null, P.override))
      ], { nextLabel: 'View summary', tip: P.intro });

      function outcomeText(rule) {
        if (!rule.outcome) return P.noPlanOutcome;
        return L.planLabel(rule.outcome) + (rule.id === 'g' ? ' (flagged)' : '');
      }

      function heroContent(ev) {
        const sug = ev.suggestion;
        if (sug.status !== 'complete') {
          return h('p', { class: 'hero-empty' }, 'Complete the earlier steps to see the suggestion.');
        }
        const statusText = { notMet: 'not met', matched: 'matched', notReached: 'not reached', pending: 'pending' };
        const statusIcon = { notMet: 'minus', matched: 'target', notReached: 'dot', pending: 'dot' };
        const details = h('details', { class: 'trace-box', open: traceOpen },
          h('summary', null, icon('list', 'inline-icon'), 'How the suggestion was matched (rules a–i, first match wins)', icon('chevron-down', 'trace-caret')),
          h('ol', { class: 'trace' }, sug.trace.map((t) => {
            const rule = P.rules.find((r) => r.id === t.id);
            return h('li', { class: 'trace-item is-' + t.status },
              h('span', { class: 'trace-icon' }, icon(statusIcon[t.status])),
              h('span', { class: 'trace-id' }, t.id + '.'),
              h('span', { class: 'trace-text' },
                h('span', { class: 'trace-cond' }, t.condition),
                h('span', { class: 'trace-out' }, ' → ' + outcomeText(rule))),
              h('span', { class: 'sr-only' }, ' (' + statusText[t.status] + ')'));
          })));
        details.addEventListener('toggle', () => { traceOpen = details.open; });
        return [
          h('div', { class: 'hero-top' },
            h('span', { class: 'hero-kicker' }, icon('sparkle', 'inline-icon'), FW.suggestionLabel),
            h('span', { class: 'hero-top-right' }, h('span', { class: 'rule-pill' }, 'Matched rule ' + sug.rule), tip(['Note: ' + P.highestNote, P.footnote], 'About the suggestion').el)),
          h('div', { class: 'hero-plan' },
            h('span', { class: 'plan-badge plan-badge-lg plan-' + sug.plan }, icon(PLAN_ICON[sug.plan])),
            h('div', null,
              h('h3', { class: 'hero-title' }, sug.planLabel),
              h('p', { class: 'hero-reason' }, sug.reason))),
          sug.flag ? h('p', { class: 'hero-flag' }, icon('alert', 'inline-icon'), sug.flag) : null,
          h('div', { class: 'hero-why' },
            h('h4', { class: 'hero-why-title' }, P.whyTitle),
            h('ul', { class: 'drivers' }, sug.drivers.map((d) => h('li', { class: 'driver' },
              h('span', { class: 'driver-label' }, d.label),
              h('span', { class: 'driver-value' }, d.value))))),
          details
        ];
      }

      function limContent(ev) {
        if (!ev.limiting.length) return null;
        return [
          h('p', { class: 'lim-k' }, icon('sparkle', 'inline-icon'), FW.suggestionLabel + ':'),
          h('div', { class: 'lim-chips' }, ev.limiting.map((f) => {
            const text = f.label === P.smallBenefitFactor ? f.label : f.label + ' (' + f.detail + ')';
            return h('button', {
              type: 'button', class: 'lim-chip', title: 'Use as the principal limiting factor',
              on: { click: () => { S().plan.limiting = f.key; changed({ syncInputs: true }); select.focus(); } }
            }, text, h('span', { class: 'lim-use' }, 'Use'));
          }))
        ];
      }

      return {
        el: sh.el, heading: sh.heading,
        firstError() {
          const errs = evalSide(S()).steps[4].errors;
          if (errs.selected) return planGroup;
          if (errs.limiting) return { focus: () => select.focus() };
          if (errs.limitingOther) return { focus: () => other.input.focus() };
          if (errs.rationale) return { focus: () => ta.focus() };
          return null;
        },
        update(ev, o) {
          const side = S();
          const errs = ev.steps[4].errors;
          const att = side.ui.attempted[5];
          const sug = ev.suggestion;
          renderOnce(hero, [sug.status, sug.plan, sug.rule, sug.reason, sug.flag, sug.drivers], () => heroContent(ev));
          hero.classList.toggle('is-ready', sug.status === 'complete');
          planGroup.setValue(side.plan.selected);
          P.order.forEach((k) => {
            const opt = planGroup.option(k);
            const isSuggested = sug.plan === k;
            opt.classList.toggle('is-suggested', isSuggested);
            opt.querySelector('.ribbon').hidden = !isSuggested;
          });
          planGroup.setError(att ? errs.selected : null);
          differs.hidden = !ev.differs;
          renderOnce(limSuggest, [ev.limiting], () => limContent(ev));
          if (o.syncInputs || document.activeElement !== select) select.value = side.plan.limiting || '';
          setFieldError(limErr, [select], att ? errs.limiting : null);
          other.el.hidden = side.plan.limiting !== 'other';
          other.setValue(side.plan.limitingOther, o.syncInputs);
          other.setError(att || side.ui.touched.limitingOther ? errs.limitingOther : null);
          if (o.syncInputs || document.activeElement !== ta) {
            if (ta.value !== side.plan.rationale) ta.value = side.plan.rationale;
          }
          counter.textContent = side.plan.rationale.length + ' / ' + P.rationaleMax;
          ratReq.textContent = ev.differs ? ' (required: differs from suggestion)' : ' (optional)';
          setFieldError(ratErr, [ta], att ? errs.rationale : null, ratHelpId);
        }
      };
    }

    /* ---- Step 6: Summary and export ---- */
    function step6() {
      const A = FW.summary.actions;
      const mk = (iconName, text, handler, cls) => h('button', { type: 'button', class: 'btn ' + (cls || 'btn-primary'), on: { click: handler } }, icon(iconName), text);
      const printBtn = mk('print', A.print, doPrint);
      const copyBtn = mk('copy', A.copy, doCopy, 'btn-secondary');
      const csvBtn = mk('download', A.csv, doCsv, 'btn-secondary');
      const resetBtn = mk('refresh', A.reset, startNewCase, 'btn-ghost');
      const exportNote = h('p', { class: 'export-note', hidden: true }, icon('info', 'inline-icon'),
        'Finish every side (or document a Gate 1 failure) to print or export.');
      const content = h('div', { class: 'summary' });
      const sh = shell(6, FW.summary.title, 'Review, then print, copy or download. Nothing is saved.', [
        h('div', { class: 'actions' }, printBtn, copyBtn, csvBtn, resetBtn),
        exportNote,
        content
      ], { noNext: true });

      return {
        el: sh.el, heading: sh.heading,
        firstError() { return null; },
        update() {
          if (S().ui.step !== 6) return;
          const evs = state.sides.map(evalSide);
          const ready = evs.every((e) => e.exportable);
          [printBtn, copyBtn, csvBtn].forEach((b) => { b.disabled = !ready; });
          exportNote.hidden = ready;
          renderOnce(content, [state.sides.map(stripUi), state.caseLabel, state.bilateral], () => summaryContent(evs, false));
        }
      };
    }

    const steps = [step1(), step2(), step3(), step4(), step5(), step6()];
    steps.forEach((st) => root.append(st.el));

    function update(ev, o) {
      const side = S();
      if (!ev.reachable[side.ui.step - 1]) {
        let n = side.ui.step;
        while (n > 1 && !ev.reachable[n - 1]) n--;
        side.ui.step = n;
      }
      const current = side.ui.step;
      steps.forEach((st, i) => {
        const show = i + 1 === current;
        if (st.el.hidden === show) {
          st.el.hidden = !show;
          if (show) st.el.classList.add('is-entering');
        }
      });
      const prog = stepStatuses(side, ev);
      stepButtons.forEach((btn, i) => {
        const n = i + 1;
        const status = prog.statuses[i];
        btn.dataset.status = status;
        btn.classList.toggle('is-current', n === current);
        btn.disabled = status === 'locked';
        if (n === current) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
        btn.querySelector('.stepper-status').textContent = ', ' + {
          done: 'completed', warn: 'completed, flap safety not confirmed', open: 'available',
          locked: 'locked', failed: 'Gate 1 failed'
        }[status];
        btn.parentNode.classList.toggle('is-done', status === 'done' || status === 'warn');
      });
      const pct = ev.status === 'failed' ? 100 : (prog.completed / 5) * 100;
      const fill = progress.firstChild;
      fill.style.width = pct + '%';
      progress.classList.toggle('is-failed', ev.status === 'failed');
      caption.textContent = 'Step ' + current + ' of ' + STEP_COUNT + ' · ' + FW.steps[current - 1];
      steps.forEach((st) => st.update(ev, o));
    }

    return {
      root,
      update,
      focusStep(n) {
        const st = steps[n - 1];
        st.heading.focus({ preventScroll: true });
        const top = root.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.6) root.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      },
      focusFirstError(n) {
        const target = steps[n - 1].firstError();
        if (target && target.focus) target.focus();
        const el = document.activeElement;
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      }
    };
  }

  /* ======================================================================= */
  /* Summary (screen and print)                                              */
  /* ======================================================================= */

  function stripUi(side) {
    return { side: side.side, gate1: side.gate1, m: side.m, cx: side.cx, benefitOverride: side.benefitOverride, plan: side.plan };
  }

  function dlRow(label, value) {
    return h('div', { class: 'sum-row' }, h('dt', null, label), h('dd', null, value === '' || value === null || value === undefined ? '—' : value));
  }

  function sumCard(side, ev, idx, forPrint) {
    const C = FW.ct;
    const D = FW.complexity.domains;
    const v = ev.values;
    const head = h('header', { class: 'sum-head' },
      h('h3', { class: 'sum-title' }, sideName(side)),
      ev.status === 'complete' ? h('span', { class: 'chip tone-good' }, icon('check'), h('span', { class: 'chip-text' }, 'Complete'))
        : ev.status === 'failed' ? h('span', { class: 'chip tone-fail' }, icon('x'), h('span', { class: 'chip-text' }, 'Gate 1 failed'))
          : h('span', { class: 'chip tone-na' }, icon('minus'), h('span', { class: 'chip-text' }, 'Incomplete')));

    const gate = h('section', { class: 'sum-section' },
      h('h4', null, 'Gate 1 (flap safety)', ' ', chip('gate', ev.gate === 'incomplete' ? 'incomplete' : ev.gate, 'chip-sm')),
      h('ul', { class: 'sum-gate' }, FW.gate1.items.map((item) => h('li', null,
        h('span', { class: 'sum-gate-text' }, item.text),
        chip('answer', side.gate1[item.id], 'chip-sm')))));

    if (ev.status === 'inProgress') {
      return h('article', { class: 'sum-card' }, head,
        h('p', { class: 'sum-incomplete' }, 'This side is not finished yet.'),
        forPrint ? null : h('button', {
          type: 'button', class: 'btn btn-secondary btn-sm',
          on: { click: () => { setActive(idx); goStep(idx, ev.firstIncompleteStep); } }
        }, 'Continue at Step ' + ev.firstIncompleteStep, icon('chevron-right')));
    }
    if (ev.status === 'failed') {
      return h('article', { class: 'sum-card is-failed' }, head, gate,
        callout('fail', 'x', 'Reassess', FW.gate1.failMessage),
        h('p', { class: 'sum-muted' }, 'No grades or plan are shown for this side.'));
    }

    const ct = h('section', { class: 'sum-section' }, h('h4', null, C.title),
      h('dl', { class: 'sum-dl' },
        dlRow('A (projected)', L.formatCm(v.aTenths) + ' cm' + (side.m.paramuscular ? ' · ' + C.paramuscular.label.toLowerCase() : '')),
        dlRow('C (projected)', L.formatCm(v.cTenths) + ' cm'),
        dlRow('B = C − A', L.formatCm(v.bTenths) + ' cm'),
        dlRow('B/C', L.formatPercent(v.bTenths, v.cTenths)),
        dlRow('3D course length', v.course3dTenths ? L.formatCm(v.course3dTenths) + ' cm (recorded only)' : 'Not recorded'),
        dlRow('Arcuate line', [side.m.arcuateRelation ? C.arcuateRelation.options[side.m.arcuateRelation] : 'Relation not recorded',
          ' · ', C.arcuateMethod.options[side.m.arcuateMethod]])));

    const cx = h('section', { class: 'sum-section' }, h('h4', null, FW.complexity.title),
      h('dl', { class: 'sum-dl' },
        dlRow(D.config.label, chip('cx', ev.config, 'chip-sm')),
        dlRow(D.course.label, [chip('cx', ev.course, 'chip-sm'), ' ', tag('course', ev.courseSource)]),
        dlRow(D.access.label, [ev.route ? h('span', { class: 'route' }, ev.route) : null, ' ', chip('cx', ev.access, 'chip-sm')]),
        dlRow(FW.complexity.team.label, FW.complexity.team.options[ev.team])));

    const ben = h('section', { class: 'sum-section' }, h('h4', null, FW.benefit.title),
      h('dl', { class: 'sum-dl' },
        dlRow(FW.benefit.domainLabel, [chip('benefit', ev.benefit, 'chip-sm'), ' ', tag('benefit', ev.benefitSource)]),
        ev.arcuateBelow ? dlRow('Arcuate modifier', FW.benefit.arcuateNote) : null));

    const sug = ev.suggestion;
    const plan = h('section', { class: 'sum-section sum-plan' }, h('h4', null, FW.plan.title),
      h('div', { class: 'sum-suggestion' },
        h('p', { class: 'sum-kicker' }, icon('sparkle', 'inline-icon'), FW.suggestionLabel),
        h('p', { class: 'sum-plan-name' }, sug.planLabel),
        h('p', { class: 'sum-reason' }, L.fullReason(sug))),
      h('dl', { class: 'sum-dl' },
        dlRow(FW.plan.selectedLabel, [h('strong', null, L.planLabel(side.plan.selected)),
          ev.differs ? h('span', { class: 'differs-tag' }, icon('alert', 'inline-icon'), FW.plan.differs) : null]),
        dlRow(FW.plan.limitingLabel, limitingText(side.plan)),
        dlRow(FW.plan.rationaleLabel, side.plan.rationale.trim() ? h('span', { class: 'pre' }, side.plan.rationale.trim()) : 'Not recorded')));

    return h('article', { class: 'sum-card' }, head, gate, ct, cx, ben, plan,
      h('p', { class: 'sum-override' }, icon('eye', 'inline-icon'), FW.plan.override));
  }

  function limitingText(plan) {
    if (!plan.limiting) return '';
    const label = FW.plan.limitingOptions[plan.limiting];
    return plan.limiting === 'other' && plan.limitingOther.trim() ? label + ': ' + plan.limitingOther.trim() : label;
  }

  function combinedTable(evs) {
    const cells = (fn) => state.sides.map((side, i) => h('td', null, fn(side, evs[i])));
    const ok = (ev) => ev.status !== 'failed' && ev.values;
    const row = (label, fn) => h('tr', null, h('th', { scope: 'row' }, label), cells(fn));
    return h('div', { class: 'combined-wrap' },
      h('table', { class: 'combined' },
        h('caption', null, 'Combined summary'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Item'), state.sides.map((side) => h('th', { scope: 'col' }, side.side)))),
        h('tbody', null,
          row('Gate 1', (side, ev) => chip('gate', ev.gate, 'chip-sm')),
          row('A · C · B (B/C)', (side, ev) => ok(ev) ? L.formatCm(ev.values.aTenths) + ' · ' + L.formatCm(ev.values.cTenths) + ' · ' + L.formatCm(ev.values.bTenths) + ' cm (' + L.formatPercent(ev.values.bTenths, ev.values.cTenths) + ')' : '—'),
          row('Configuration · course · access', (side, ev) => ev.status === 'failed' ? '—' : h('span', { class: 'chip-row' }, chip('cx', ev.config, 'chip-sm'), chip('cx', ev.course, 'chip-sm'), chip('cx', ev.access, 'chip-sm'))),
          row('Expected benefit', (side, ev) => ev.status === 'failed' ? '—' : chip('benefit', ev.benefit, 'chip-sm')),
          row(FW.suggestionLabel, (side, ev) => ev.status === 'failed' ? FW.plan.noPlanOutcome : (ev.suggestion.planLabel || '—')),
          row(FW.plan.selectedLabel, (side, ev) => L.planLabel(side.plan.selected) || '—'))));
  }

  function summaryContent(evs, forPrint) {
    const meta = h('p', { class: 'sum-meta' }, FW.meta.toolName + ' v' + FW.version + ' · framework dated ' + FW.date +
      (state.caseLabel.trim() ? ' · ' + FW.caseLabel.label + ': ' + state.caseLabel.trim() : ''));
    return [
      state.bilateral ? combinedTable(evs) : null,
      h('div', { class: 'sum-cards' }, state.sides.map((side, i) => sumCard(side, evs[i], i, forPrint))),
      meta
    ];
  }

  /* ---- Print: one page per side ---- */
  function renderPrint() {
    const evs = state.sides.map(evalSide);
    const other = (i) => state.sides.length > 1 ? state.sides[1 - i] : null;
    els.printRoot.replaceChildren(...state.sides.map((side, i) => {
      const ev = evs[i];
      const o = other(i);
      const oev = o ? evs[1 - i] : null;
      return h('article', { class: 'print-page' },
        h('header', { class: 'pp-head' },
          h('div', null, h('strong', null, FW.meta.toolName), ' v' + FW.version + ' · framework dated ' + FW.date),
          h('div', null, state.caseLabel.trim() ? FW.caseLabel.label + ': ' + state.caseLabel.trim() : '')),
        h('h1', { class: 'pp-title' }, L.fill(FW.summary.note.header, { side: side.side || '' })),
        o ? h('p', { class: 'pp-other' }, 'Bilateral assessment. ' + o.side + ' side: ' +
          (oev.status === 'failed' ? 'Gate 1 failed' : (oev.suggestion.planLabel ? FW.suggestionLabel + ' ' + oev.suggestion.planLabel : 'incomplete')) +
          (o.plan.selected ? '; selected ' + L.planLabel(o.plan.selected) : '') + '.') : null,
        sumCard(side, ev, i, true),
        h('footer', { class: 'pp-foot' },
          h('p', null, h('strong', null, 'Disclaimer: '), FW.disclaimer),
          h('p', null, h('strong', null, 'Cite: '), L.citationText()),
          h('p', null, FW.privacy + '. ' + FW.meta.siteUrl)));
    }));
  }

  /* ======================================================================= */
  /* Live panel                                                              */
  /* ======================================================================= */

  function suggestionBlock(ev) {
    if (ev.gate === 'failed') {
      return h('div', { class: 'psug is-failed' },
        h('p', { class: 'psug-k' }, icon('x', 'inline-icon'), 'No plan: hard stop'),
        h('p', { class: 'psug-reason' }, FW.gate1.failMessage));
    }
    const sug = ev.suggestion;
    if (sug.status !== 'complete') {
      return h('div', { class: 'psug is-empty' },
        h('p', { class: 'psug-k' }, icon('sparkle', 'inline-icon'), FW.suggestionLabel),
        h('p', { class: 'psug-reason' }, 'Appears as soon as the inputs allow a match.'));
    }
    return h('div', { class: 'psug' },
      h('p', { class: 'psug-k' }, icon('sparkle', 'inline-icon'), FW.suggestionLabel),
      h('p', { class: 'psug-plan', 'data-k': 'plan' }, h('span', { class: 'plan-badge plan-badge-sm plan-' + sug.plan }, icon(PLAN_ICON[sug.plan])), sug.planLabel),
      h('p', { class: 'psug-reason' }, L.fullReason(sug)));
  }

  function panelRow(key, label, value) {
    return h('div', { class: 'prow', 'data-k': key }, h('dt', null, label), h('dd', null, value));
  }

  function panelSide(side, ev, i) {
    const v = ev.values;
    const rows = [panelRow('gate', 'Gate 1', chip('gate', ev.gate, 'chip-sm'))];
    if (ev.gate !== 'failed') {
      rows.push(
        panelRow('ac', 'A · C', v ? L.formatCm(v.aTenths) + ' · ' + L.formatCm(v.cTenths) + ' cm' : '—'),
        panelRow('b', 'B (B/C)', v ? L.formatCm(v.bTenths) + ' cm (' + L.formatPercent(v.bTenths, v.cTenths) + ')' : '—'),
        panelRow('config', 'Configuration', chip('cx', ev.config, 'chip-sm')),
        panelRow('course', 'Course', [chip('cx', ev.course, 'chip-sm'), tag('course', ev.courseSource)]),
        panelRow('access', 'Access', [ev.route ? h('span', { class: 'route' }, ev.route) : null, chip('cx', ev.access, 'chip-sm')]),
        panelRow('team', 'Team', ev.team ? FW.complexity.team.options[ev.team] : '—'),
        panelRow('benefit', 'Benefit', [chip('benefit', ev.benefit, 'chip-sm'), tag('benefit', ev.benefitSource)]));
    }
    const stepNow = side.ui.step;
    const status = ev.status === 'failed' ? 'Gate 1 failed'
      : ev.status === 'complete' ? 'All inputs complete'
        : 'Step ' + stepNow + ' of ' + STEP_COUNT + ' · ' + FW.steps[stepNow - 1];
    const headInner = [ring(side, ev), h('span', { class: 'pside-text' },
      h('span', { class: 'pside-name' }, sideName(side)),
      h('span', { class: 'pside-status' }, status))];
    const head = state.bilateral && i !== state.active
      ? h('button', { type: 'button', class: 'pside-head is-button', 'data-fkey': 'pside-' + i, on: { click: () => setActive(i) } }, headInner, h('span', { class: 'pside-go' }, 'Open', icon('chevron-right')))
      : h('div', { class: 'pside-head' }, headInner);
    const selected = side.plan.selected
      ? h('p', { class: 'psel' }, h('span', { class: 'psel-k' }, 'Selected: '), L.planLabel(side.plan.selected),
        ev.differs ? h('span', { class: 'differs-tag' }, icon('alert', 'inline-icon'), FW.plan.differs) : null)
      : null;
    return h('section', { class: 'pside' + (i === state.active ? ' is-active' : ''), 'aria-label': sideName(side) },
      head,
      h('dl', { class: 'prows', 'data-side': String(i) }, rows),
      suggestionBlock(ev),
      selected);
  }

  function renderPanel(evs) {
    const active = state.sides[state.active];
    const aev = evs[state.active];
    const sug = aev.suggestion;
    const sub = aev.gate === 'failed' ? 'Gate 1 failed: no plan'
      : sug.status === 'complete' ? sug.planLabel
        : 'Suggestion appears when inputs allow';
    calc.panelToggle.replaceChildren(
      ring(active, aev, 'sm'),
      h('span', { class: 'pt-text' },
        h('span', { class: 'pt-title' }, 'Live summary · ' + (state.bilateral ? active.side : 'Step ' + active.ui.step + ' of ' + STEP_COUNT)),
        h('span', { class: 'pt-sub' }, sub)),
      icon('chevron-up', 'pt-caret'));

    const focusKey = document.activeElement && calc.panelBody.contains(document.activeElement) ? document.activeElement.dataset.fkey : null;
    calc.panelBody.replaceChildren();
    append(calc.panelBody, [
      h('div', { class: 'panel-head' },
        h('h2', { class: 'panel-title' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), 'Live summary'),
        state.caseLabel.trim() ? h('p', { class: 'panel-case' }, FW.caseLabel.label + ': ' + state.caseLabel.trim()) : null),
      state.sides.map((side, i) => panelSide(side, evs[i], i)),
      h('p', { class: 'panel-foot' }, FW.finalPlanNote)
    ]);
    if (focusKey) {
      const target = calc.panelBody.querySelector('[data-fkey="' + focusKey + '"]');
      if (target) target.focus();
    }

    // Briefly highlight rows whose values changed (skipped when motion is reduced).
    const next = {};
    calc.panelBody.querySelectorAll('.prow, .psug-plan').forEach((row) => {
      const dl = row.closest('[data-side]');
      const key = (dl ? dl.dataset.side : state.active) + ':' + row.dataset.k;
      next[key] = row.textContent;
      if (calc.lastPanel[key] !== undefined && calc.lastPanel[key] !== next[key] && !reduceMotion.matches) {
        row.classList.add('flash');
      }
    });
    calc.lastPanel = next;
  }

  /* ======================================================================= */
  /* Side switch (bilateral)                                                 */
  /* ======================================================================= */

  function renderSideSwitch(evs) {
    const host = calc.sideSwitch;
    host.hidden = !state.bilateral;
    if (!state.bilateral) { host.replaceChildren(); return; }
    if (host.children.length !== state.sides.length) {
      host.replaceChildren(...state.sides.map((side, i) => {
        const btn = h('button', {
          type: 'button', role: 'tab', class: 'side-tab', id: 'side-tab-' + i, 'aria-controls': 's' + i + '-view'
        }, h('span', { class: 'side-tab-name' }), h('span', { class: 'side-tab-status' }));
        btn.addEventListener('click', () => setActive(i));
        btn.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const j = (i + 1) % state.sides.length;
          setActive(j);
          byId('side-tab-' + j).focus();
        });
        return btn;
      }));
    }
    state.sides.forEach((side, i) => {
      const btn = host.children[i];
      const selected = i === state.active;
      btn.setAttribute('aria-selected', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      btn.querySelector('.side-tab-name').textContent = FW.sideLong[side.side];
      const ev = evs[i];
      renderOnce(btn.querySelector('.side-tab-status'), [ev.status, side.ui.step], () =>
        ev.status === 'failed' ? h('span', { class: 'mini tone-fail' }, icon('x', 'inline-icon'), 'Gate 1 failed')
          : ev.status === 'complete' ? h('span', { class: 'mini tone-good' }, icon('check', 'inline-icon'), 'Complete')
            : h('span', { class: 'mini tone-na' }, 'Step ' + side.ui.step + ' of ' + STEP_COUNT));
    });
  }

  /* ======================================================================= */
  /* Refresh and navigation                                                  */
  /* ======================================================================= */

  const lastSuggestion = new Map();

  function refresh(o) {
    if (!calc) return;
    o = o || {};
    const evs = state.sides.map(evalSide);
    views.forEach((view, i) => {
      view.root.hidden = i !== state.active;
      view.update(evs[i], o);
    });
    renderSideSwitch(evs);
    renderPanel(evs);
    calc.exampleBadge.hidden = !state.example;
    calc.toggle.checked = state.bilateral;
    if (o.syncInputs && calc.label.value !== state.caseLabel) calc.label.value = state.caseLabel;

    // Announce a changed suggestion for the active side.
    const aev = evs[state.active];
    const text = aev.gate === 'failed' ? 'Gate 1 failed. ' + FW.gate1.failMessage
      : aev.suggestion.status === 'complete' ? FW.suggestionLabel + ': ' + aev.suggestion.planLabel + '.' : '';
    const key = state.active + ':' + state.sides.length;
    if (lastSuggestion.has(key) && lastSuggestion.get(key) !== text && text) announce(text);
    lastSuggestion.set(key, text);
  }

  function markDirty() { dirty = true; }

  function rebuildViews() {
    views.forEach((view) => view.root.remove());
    calc.sideSwitch.replaceChildren();
    lastSuggestion.clear();
    calc.lastPanel = {};
    views = state.sides.map((side, i) => buildSideView(i));
    views.forEach((view) => calc.viewsHost.append(view.root));
    refresh({ syncInputs: true });
  }

  function setActive(i) {
    if (i === state.active || !state.sides[i]) return;
    state.active = i;
    refresh();
  }

  function goStep(idx, n) {
    const side = state.sides[idx];
    const ev = evalSide(side);
    if (!ev.reachable[n - 1]) return;
    side.ui.step = n;
    side.ui.maxStep = Math.max(side.ui.maxStep, n);
    refresh();
    views[idx].focusStep(n);
  }

  function goNext(idx) {
    const side = state.sides[idx];
    const ev = evalSide(side);
    const n = side.ui.step;
    const info = ev.steps[n - 1];
    if (!info.valid) {
      side.ui.attempted[n] = true;
      refresh();
      const count = Object.keys(info.errors).length;
      announce(count === 1 ? 'One item needs attention.' : count + ' items need attention.');
      views[idx].focusFirstError(n);
      return;
    }
    goStep(idx, n + 1);
  }

  /* ======================================================================= */
  /* Case actions                                                            */
  /* ======================================================================= */

  async function setBilateral(on) {
    if (on === state.bilateral) return;
    if (on) {
      const current = state.sides[0];
      if (!current.side) current.side = 'Left';
      const other = newSide(current.side === 'Left' ? 'Right' : 'Left');
      state.sides = current.side === 'Left' ? [current, other] : [other, current];
      state.active = state.sides.indexOf(current);
      state.bilateral = true;
    } else {
      const keep = state.sides[state.active];
      const drop = state.sides[1 - state.active];
      if (drop && JSON.stringify(stripUi(drop)) !== JSON.stringify(stripUi(newSide(drop.side)))) {
        const ok = await confirmDialog({
          title: 'Assess one side only?',
          body: 'The ' + drop.side + ' assessment will be removed. The ' + keep.side + ' assessment is kept.',
          confirm: 'Remove ' + drop.side + ' assessment'
        });
        if (!ok) { calc.toggle.checked = true; return; }
      }
      state.sides = [keep];
      state.active = 0;
      state.bilateral = false;
    }
    markDirty();
    rebuildViews();
    announce(state.bilateral ? 'Both sides will be assessed separately.' : 'One side will be assessed.');
  }

  function resetState() {
    state.caseLabel = '';
    state.bilateral = false;
    state.active = 0;
    state.sides = [newSide(null)];
    state.example = null;
    dirty = false;
  }

  async function startNewCase() {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Start a new case?',
        body: 'This clears every answer for this case. Nothing is saved, so this cannot be undone.',
        confirm: 'Clear and start new'
      });
      if (!ok) return;
    }
    resetState();
    rebuildViews();
    selectTab('calculator', true);
    toast('New case started');
    calc.label.focus();
  }

  async function loadExample(ex) {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Load a fictional example?',
        body: 'The example replaces the current case. Nothing is saved, so the current answers will be lost.',
        confirm: 'Load example'
      });
      if (!ok) return;
    }
    resetState();
    state.bilateral = ex.bilateral;
    state.caseLabel = ex.label;
    state.example = ex.id;
    state.sides = ex.sides.map((spec) => {
      const side = newSide(spec.side);
      Object.assign(side.gate1, spec.gate1);
      Object.assign(side.m, spec.m);
      Object.assign(side.cx, spec.cx);
      return side;
    });
    state.sides.forEach((side) => {
      const ev = evalSide(side);
      side.ui.step = ev.reachable[4] ? 5 : ev.firstIncompleteStep;
      side.ui.maxStep = side.ui.step;
    });
    rebuildViews();
    selectTab('calculator', true);
    toast('Loaded fictional example: ' + ex.title);
    views[state.active].focusStep(state.sides[state.active].ui.step);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall back below */ }
    try {
      const buffer = h('textarea', { class: 'copy-buffer', readonly: true, 'aria-hidden': 'true' });
      buffer.value = text;
      document.body.append(buffer);
      buffer.select();
      const ok = document.execCommand('copy');
      buffer.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function doCopy() {
    const text = L.buildNote(state.sides, opts());
    if (await copyText(text)) {
      toast('Note copied to the clipboard');
      return;
    }
    const area = h('textarea', { class: 'textarea copy-fallback', rows: '10', readonly: true, 'aria-label': 'Note text' });
    area.value = text;
    confirmDialog({
      title: 'Copy the note',
      body: [h('p', null, 'Your browser blocked automatic copying. Select the text below and copy it.'), area],
      confirm: null, cancel: 'Close'
    });
    window.setTimeout(() => { area.focus(); area.select(); }, 50);
  }

  function doCsv() {
    const csv = L.buildCSV(state.sides, state.caseLabel, opts());
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: 'robotic-diep-selection-v' + FW.version + '.csv', class: 'sr-only' });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('CSV file created');
  }

  function doPrint() {
    renderPrint();
    document.body.classList.add('print-case');
    window.print();
  }

  /* ======================================================================= */
  /* Info tabs                                                               */
  /* ======================================================================= */

  function pageHead(iconName, title, intro) {
    return h('header', { class: 'page-head' },
      h('span', { class: 'page-icon', 'aria-hidden': 'true' }, icon(iconName)),
      h('div', null, h('h2', { class: 'page-title' }, title), intro ? h('p', { class: 'page-intro' }, intro) : null));
  }

  function renderMeasure() {
    const M = FW.measure;
    els.panels.measure.append(h('div', { class: 'wrap info' },
      pageHead('ruler', M.title, M.intro),
      h('div', { class: 'measure-grid' },
        h('figure', { class: 'card schematic' },
          h('div', { class: 'schematic-scroll', tabindex: '0', role: 'group', 'aria-label': 'Schematic; scrolls sideways on small screens' },
            h('img', { src: 'assets/img/measurements.svg', alt: M.schematicAlt, width: '820', height: '600', decoding: 'async' })),
          h('figcaption', null, M.schematicCaption, ' ',
            h('a', { href: 'assets/img/measurements.svg', target: '_blank', rel: 'noopener noreferrer', class: 'zoom-link' },
              'Open full size', h('span', { class: 'sr-only' }, ' (opens in a new tab)')))),
        h('div', { class: 'stack' },
          h('section', { class: 'card pad' },
            h('h3', { class: 'card-title' }, 'What is measured'),
            h('dl', { class: 'defs' }, M.definitions.map((d) => h('div', { class: 'def' },
              h('dt', null, h('span', { class: 'def-term def-' + d.term.charAt(0).toLowerCase() }, d.term)),
              h('dd', null, d.text))))),
          h('section', { class: 'card pad' },
            h('h3', { class: 'card-title' }, 'Measuring steps'),
            h('ol', { class: 'num-steps' }, M.steps.map((t) => h('li', null, t)))),
          callout('info', 'info', null, FW.ct.help)))));
  }

  function meterRow(label, percent, valueText) {
    const fill = h('span', { class: 'mrow-fill' });
    fill.style.width = percent + '%';
    return h('div', { class: 'mrow' },
      h('span', { class: 'mrow-label' }, label),
      h('span', { class: 'mrow-track', role: 'img', 'aria-label': label + ': ' + valueText }, fill),
      h('span', { class: 'mrow-value' }, valueText));
  }

  function unitChart(item) {
    const cols = 27;
    const gap = 8.6;
    const rows = Math.ceil(item.total / cols);
    const label = item.label + ': ' + item.events + ' of ' + item.total + (item.unit ? ' ' + item.unit : '');
    const chart = s('svg', { viewBox: '0 0 ' + (cols * gap) + ' ' + (rows * gap), class: 'units', role: 'img', 'aria-label': label });
    for (let i = 0; i < item.total; i++) {
      chart.appendChild(s('circle', {
        cx: (i % cols) * gap + gap / 2, cy: Math.floor(i / cols) * gap + gap / 2, r: 3.1,
        class: i < item.events ? 'unit is-event' : 'unit'
      }));
    }
    return h('div', { class: 'unit-block' },
      h('p', { class: 'unit-head' },
        h('span', { class: 'unit-label' }, item.label),
        h('span', { class: 'unit-value' }, (item.events === 0 ? 'None' : item.events) + ' of ' + item.total)),
      chart,
      item.unit ? h('p', { class: 'unit-sub' }, item.unit) : null);
  }

  function certainty(text) {
    return text ? h('span', { class: 'certainty' }, icon('alert', 'inline-icon'), text) : null;
  }

  function evCard(title, text, viz, cert, wide) {
    return h('section', { class: 'card pad ev-card' + (wide ? ' is-wide' : '') },
      h('div', { class: 'ev-card-head' }, h('h3', { class: 'card-title' }, title), certainty(cert)),
      h('p', { class: 'ev-text' }, text),
      viz);
  }

  function renderEvidence() {
    const E = FW.evidence;
    const F = E.figures;
    const T = E.cardTitles;
    els.panels.evidence.append(h('div', { class: 'wrap info' },
      pageHead('book', E.title, E.intro),
      h('section', { class: 'card pad ev-hero' },
        h('h3', { class: 'card-title' }, T.review),
        h('ul', { class: 'kpis' }, F.kpis.map((k) => h('li', { class: 'kpi' },
          h('span', { class: 'kpi-value' }, k.value),
          h('span', { class: 'kpi-label' }, k.label)))),
        h('p', { class: 'ev-text' }, E.points.review)),
      h('div', { class: 'ev-grid' },
        evCard(T.criteria, E.points.criteria, h('dl', { class: 'ranges' }, F.ranges.map((r) => h('div', { class: 'range' },
          h('dt', null, r.label), h('dd', null, r.value))))),
        evCard(T.eligibility, E.points.eligibility, h('div', { class: 'mrows' },
          F.eligibility.map((e) => meterRow('Cutoff ' + e.label, e.percent, e.percent + '%')))),
        evCard(T.fascia, E.points.fascia, h('div', { class: 'mrows' },
          meterRow('Conventional (reference)', 100, '1.00'),
          meterRow('Robotic, ratio of means', F.fascia.ratio * 100, String(F.fascia.ratio))), F.fascia.certainty),
        evCard(T.periop, E.points.periop, h('ul', { class: 'mini-tiles' }, F.periop.items.map((it) => h('li', { class: 'mini-tile' },
          h('span', { class: 'mini-value' }, it.value), h('span', { class: 'mini-label' }, it.label)))), F.periop.certainty),
        evCard(T.safety, E.points.safety, h('div', { class: 'units-grid' }, F.safety.items.map(unitChart)), null, true)),
      callout('warn', 'info', T.note, E.note)));
  }

  function renderAbout() {
    const A = FW.about;
    const T = A.cardTitles;
    const citation = L.citationText();
    const copyBtn = h('button', {
      type: 'button', class: 'btn btn-secondary btn-sm',
      on: { click: async () => { toast(await copyText(citation) ? 'Citation copied' : 'Select the citation text to copy it'); } }
    }, icon('copy'), 'Copy citation');
    const lic = FW.meta.license;
    els.panels.about.append(h('div', { class: 'wrap info' },
      pageHead('quote', A.title, null),
      h('div', { class: 'about-grid' },
        h('section', { class: 'card pad about-lead' },
          h('h3', { class: 'card-title' }, T.purpose),
          h('p', null, A.purpose),
          h('p', null, h('strong', null, FW.finalPlanNote))),
        h('section', { class: 'card pad' },
          h('h3', { class: 'card-title' }, T.disclaimer),
          callout('warn', 'shield', null, FW.disclaimer)),
        h('section', { class: 'card pad' },
          h('h3', { class: 'card-title' }, T.privacy),
          h('p', { class: 'privacy-line' }, icon('lock', 'inline-icon'), h('strong', null, FW.privacy + '.')),
          h('ul', { class: 'bullets' }, A.privacyDetails.map((t) => h('li', null, t)))),
        h('section', { class: 'card pad' },
          h('h3', { class: 'card-title' }, T.cite),
          h('p', { class: 'cite-box' }, citation),
          h('div', { class: 'row-actions' }, copyBtn),
          h('p', { class: 'muted' }, 'Calculator version ' + FW.version + ' (framework dated ' + FW.date + '). Machine-readable citation: CITATION.cff in the repository.')),
        h('section', { class: 'card pad' },
          h('h3', { class: 'card-title' }, T.version),
          h('dl', { class: 'sum-dl' },
            dlRow('Version', FW.version + ' (' + FW.date + ')'),
            dlRow('Authors', authorLine()),
            dlRow('Code license', lic.code),
            dlRow('Content license', [lic.content, ' (clinical text, documentation, schematic)'])),
          h('p', { class: 'row-links' }, extLink(FW.meta.changelogUrl, 'Changelog'), ' · ', extLink(FW.meta.repoUrl, 'Source code'))),
        h('section', { class: 'card pad is-wide' },
          h('h3', { class: 'card-title' }, T.rules),
          h('p', null, 'Rules are applied in this order; the first match wins. ', FW.plan.highestNote.charAt(0).toUpperCase() + FW.plan.highestNote.slice(1)),
          h('ol', { class: 'rules' }, FW.plan.rules.map((r) => h('li', null,
            h('span', { class: 'rule-id' }, r.id + '.'),
            h('span', null, r.condition, ' → ', h('strong', null, r.outcome ? L.planLabel(r.outcome) + (r.id === 'g' ? ' (flagged: ' + FW.plan.outsideFlag.replace(/\.$/, '') + ')' : '') : FW.plan.noPlanOutcome))))),
          callout('warn', 'info', null, FW.evidence.note)),
        h('section', { class: 'card pad is-wide feedback' },
          h('div', null,
            h('h3', { class: 'card-title' }, T.feedback),
            h('p', null, 'Found a problem or have a suggestion? Please do not include patient information.')),
          h('a', { class: 'btn btn-primary', href: FW.meta.issuesUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('flag'), A.reportIssue, h('span', { class: 'sr-only' }, ' (opens in a new tab)'))))));
  }

  /* ======================================================================= */
  /* Init                                                                    */
  /* ======================================================================= */

  function init() {
    renderStatic();
    buildTabs();
    buildCalculator();
    renderMeasure();
    renderEvidence();
    renderAbout();
    rebuildViews();
    selectTab(tabFromHash() || 'calculator', false);

    const onHash = () => {
      const t = tabFromHash();
      if (t && t !== state.tab) {
        selectTab(t, false);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    window.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
    window.addEventListener('resize', debounce(() => refresh(), 120));
    window.addEventListener('beforeprint', () => {
      if (state.tab === 'calculator' && !document.body.classList.contains('print-case')) {
        renderPrint();
        document.body.classList.add('print-case');
      }
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('print-case'));
    desktop.addEventListener && desktop.addEventListener('change', () => setPanelOpen(false));

    // Keep the bottom panel out of the way while typing on small screens.
    document.addEventListener('focusin', (e) => {
      if (e.target.matches && e.target.matches('input[type="text"], textarea, select')) document.body.classList.add('is-typing');
    });
    document.addEventListener('focusout', () => {
      window.setTimeout(() => {
        const a = document.activeElement;
        if (!a || !a.matches || !a.matches('input[type="text"], textarea, select')) document.body.classList.remove('is-typing');
      }, 60);
    });

    // Remove the one-shot entrance animation class once it has played.
    document.addEventListener('animationend', (e) => {
      if (e.target.classList) {
        e.target.classList.remove('is-entering');
        e.target.classList.remove('flash');
      }
    });

    document.documentElement.classList.add('js');
  }

  init();
})();
