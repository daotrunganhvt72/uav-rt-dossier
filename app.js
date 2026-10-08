'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const format = (value) => new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(value);

// Progressive enhancement: the dossier remains readable without motion support.
if ('IntersectionObserver' in window && !reducedMotion) {
  document.body.classList.add('js-motion');
  const reveals = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        reveals.unobserve(entry.target);
      }
    });
  }, {threshold: 0.08});
  $$('.reveal').forEach((element) => reveals.observe(element));
}

function closeMenu() {
  $('#chapter-menu').hidden = true;
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}
$('#menu-toggle').addEventListener('click', () => {
  const opened = $('#menu-toggle').getAttribute('aria-expanded') === 'true';
  $('#chapter-menu').hidden = opened;
  $('#menu-toggle').setAttribute('aria-expanded', String(!opened));
});
$$('#chapter-menu a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
document.addEventListener('click', (event) => {
  if (!$('#chapter-menu').contains(event.target) && !$('#menu-toggle').contains(event.target)) closeMenu();
});

let queuedScroll = false;
const chapters = $$('[data-chapter]');
const journeySteps = $$('.journey-step');
const sessionSteps = $$('.session-step');
function updateReading() {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  const progress = distance > 0 ? Math.min(100, Math.max(0, window.scrollY / distance * 100)) : 0;
  $('#progress').style.width = `${progress}%`;
  $('#reading-percent').textContent = `${Math.round(progress)}%`;
  let current = chapters[0];
  chapters.forEach((chapter) => {
    if (chapter.getBoundingClientRect().top <= window.innerHeight * 0.36) current = chapter;
  });
  $('#chapter-name').textContent = current.dataset.chapter;
  let activeStep = journeySteps[0];
  if (document.body.classList.contains('cinema-ready') && $('.journey').dataset.active !== undefined) {
    activeStep = journeySteps[Number($('.journey').dataset.active)] || activeStep;
  } else journeySteps.forEach((step) => {
    if (step.getBoundingClientRect().top <= window.innerHeight * 0.45) activeStep = step;
  });
  $('#journey-month').textContent = activeStep.dataset.code;
  $('#journey-year').textContent = activeStep.dataset.phase;
  $$('.timeline-nav a').forEach((link) => {
    const active = link.hash === `#${activeStep.id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
  });
  let activeSession = sessionSteps[0];
  if (document.body.classList.contains('cinema-ready') && $('.session-scene').dataset.active !== undefined) {
    activeSession = sessionSteps[Number($('.session-scene').dataset.active)] || activeSession;
  } else sessionSteps.forEach((step) => {
    if (step.getBoundingClientRect().top <= window.innerHeight * 0.52) activeSession = step;
  });
  $('#session-day').textContent = activeSession.dataset.day;
  $('#session-event').textContent = activeSession.dataset.event;
  sessionSteps.forEach((step) => step.classList.toggle('active', step === activeSession));
  const phase = sessionSteps.indexOf(activeSession);
  if (phase >= 0) $('.session-stage')?.setAttribute('data-phase', String(phase));
  queuedScroll = false;
}
window.addEventListener('scroll', () => {
  if (!queuedScroll) {queuedScroll = true; requestAnimationFrame(updateReading);}
}, {passive: true});
window.addEventListener('resize', updateReading);
window.addEventListener('cinema:scene', updateReading);
updateReading();

// ----- Reference latency chart: 8 policies x 2 kernels, Pi 5 data [1, table 4] -----
const svgNS = 'http://www.w3.org/2000/svg';
const policies = [
  {short: 'OTHER · nice 0', name: 'SCHED_OTHER', param: 'nice 0', std: 8626, rt: 9015},
  {short: 'OTHER · nice −19', name: 'SCHED_OTHER', param: 'nice −19', std: 9424, rt: 4351},
  {short: 'FIFO · prio 50', name: 'SCHED_FIFO', param: 'priority 50', std: 700, rt: 160},
  {short: 'FIFO · prio 99', name: 'SCHED_FIFO', param: 'priority 99', std: 1848, rt: 224},
  {short: 'RR · prio 50', name: 'SCHED_RR', param: 'priority 50', std: 787, rt: 225},
  {short: 'RR · prio 99', name: 'SCHED_RR', param: 'priority 99', std: 472, rt: 182},
  {short: 'DL · Q 400 µs', name: 'SCHED_DEADLINE', param: 'Q = 400 µs', std: 345, rt: 209},
  {short: 'DL · Q 800 µs', name: 'SCHED_DEADLINE', param: 'Q = 800 µs', std: 443, rt: 197}
];
const reduction = (p) => (p.std - p.rt) / p.std * 100;
const COLOR_STD = '#98a2b3';
const COLOR_RT = '#5ce8c5';
const COLOR_BAD = '#ff7188';
const LEFT = 128;        // label gutter
const RIGHT = 700;       // plot right edge
const TOP = 34;
const ROW = 46;
const modes = {
  maxlat: {label: 'Maximum wake-up latency L (µs) — log scale [1, table 4]'},
  share: {label: 'Maximum L as share of the 4,000 µs deadline (%)'},
  reduction: {label: 'Reduction of maximum L with PREEMPT_RT, Δ = (std − RT) / std × 100 (%)'}
};
let chartMode = 'maxlat';
let selectedPolicy = -1;

const el = (tag, attrs = {}, text) => {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = text;
  return node;
};
const logX = (v) => LEFT + (Math.log10(Math.max(v, 90)) - 2) / 2 * (RIGHT - LEFT);
const linX = (v, max) => LEFT + Math.min(v, max) / max * (RIGHT - LEFT);

function xFor(mode, policy, which) {
  if (mode === 'maxlat') return logX(which === 'std' ? policy.std : policy.rt);
  if (mode === 'share') return linX((which === 'std' ? policy.std : policy.rt) / 40, 250);
  return linX(reduction(policy) + 20, 120); // reduction: domain −20…100 %
}
function gridFor(mode) {
  if (mode === 'maxlat') return [100, 300, 1000, 4000, 10000].map(v => ({x: logX(v), label: format(v)}));
  if (mode === 'share') return [0, 50, 100, 150, 200, 250].map(v => ({x: linX(v, 250), label: `${v}%`}));
  return [-20, 0, 25, 50, 75, 100].map(v => ({x: linX(v + 20, 120), label: v === 0 ? '0' : `${v > 0 ? '+' : ''}${v}%`}));
}

function drawGrid() {
  const grid = $('#chart-grid');
  grid.replaceChildren();
  const bottom = TOP + policies.length * ROW + 4;
  grid.append(el('line', {x1: LEFT, y1: bottom, x2: RIGHT, y2: bottom, stroke: '#ffffff18'}));
  gridFor(chartMode).forEach(({x, label}) => {
    grid.append(el('line', {x1: x, y1: TOP - 12, x2: x, y2: bottom, stroke: '#ffffff0b'}));
    grid.append(el('text', {x, y: bottom + 16, fill: '#5c6a70', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5, 'text-anchor': 'middle'}, label));
  });
  const marks = $('#chart-marks');
  marks.replaceChildren();
  if (chartMode === 'maxlat') {
    marks.append(el('line', {x1: logX(4000), y1: TOP - 14, x2: logX(4000), y2: bottom, stroke: COLOR_BAD, 'stroke-width': 1.4, 'stroke-dasharray': '7 6', opacity: .8}));
    marks.append(el('text', {x: logX(4000) + 5, y: TOP - 2, fill: COLOR_BAD, 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5}, 'DEADLINE 4,000'));
    marks.append(el('line', {x1: logX(500), y1: TOP - 14, x2: logX(500), y2: bottom, stroke: COLOR_RT, 'stroke-width': 1, 'stroke-dasharray': '2 6', opacity: .6}));
    marks.append(el('text', {x: logX(500) + 5, y: TOP - 2, fill: '#8ff0d8', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5, opacity: .8}, 'TC05 500'));
  } else if (chartMode === 'share') {
    marks.append(el('line', {x1: linX(100, 250), y1: TOP - 14, x2: linX(100, 250), y2: bottom, stroke: COLOR_BAD, 'stroke-width': 1.4, 'stroke-dasharray': '7 6', opacity: .8}));
    marks.append(el('text', {x: linX(100, 250) + 5, y: TOP - 2, fill: COLOR_BAD, 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5}, 'DEADLINE 100%'));
  } else {
    marks.append(el('line', {x1: linX(20, 120), y1: TOP - 14, x2: linX(20, 120), y2: bottom, stroke: '#ffffff30', 'stroke-width': 1}));
    marks.append(el('text', {x: linX(20, 120) - 5, y: TOP - 2, fill: '#8a97a0', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5, 'text-anchor': 'end'}, 'no change'));
  }
  // kernel legend chips
  const chip = (x, color, label) => {
    marks.append(el('rect', {x, y: TOP - 30, width: 10, height: 10, fill: color, rx: 2}));
    marks.append(el('text', {x: x + 15, y: TOP - 21, fill: '#9aa6ad', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5}, label));
  };
  if (chartMode !== 'reduction') {
    chip(RIGHT - 218, COLOR_STD, 'STANDARD');
    chip(RIGHT - 108, COLOR_RT, 'PREEMPT_RT');
  } else {
    chip(RIGHT - 108, COLOR_RT, 'IMPROVED');
  }
}

function drawBars() {
  const group = $('#chart-bars');
  group.replaceChildren();
  policies.forEach((policy, index) => {
    const y = TOP + index * ROW;
    const focused = selectedPolicy < 0 || index === selectedPolicy;
    const row = el('g', {opacity: focused ? 1 : 0.22});
    row.append(el('text', {x: LEFT - 10, y: y + 17, fill: focused ? '#dfe6ea' : '#8a97a0', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 10.5, 'text-anchor': 'end'}, policy.name.replace('SCHED_', '')));
    row.append(el('text', {x: LEFT - 10, y: y + 31, fill: '#5c6a70', 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5, 'text-anchor': 'end'}, policy.param));
    const labelFor = (which) => chartMode === 'share' ? `${format((which === 'std' ? policy.std : policy.rt) / 40)}%`
      : chartMode === 'reduction' ? `${reduction(policy) > 0 ? '+' : ''}${format(reduction(policy))}%`
      : format(which === 'std' ? policy.std : policy.rt);
    // Bar-end value label, clamped inside the plot and tinted red past the deadline.
    const valueLabel = (x1, text, yText, fill, over) => {
      const clipped = x1 > RIGHT - 74;
      row.append(el('text', {x: clipped ? Math.min(x1 - 5, RIGHT - 2) : x1 + 6, y: yText,
        fill: over ? COLOR_BAD : fill, 'font-family': 'Spline Sans Mono,monospace', 'font-size': 9.5,
        'text-anchor': clipped ? 'end' : 'start', stroke: '#04070d', 'stroke-width': 3, 'paint-order': 'stroke',
        opacity: over ? 1 : undefined}, (over ? '✕ ' : '') + text));
    };
    if (chartMode === 'reduction') {
      const value = reduction(policy);
      const x0 = linX(20, 120);
      const x1 = xFor('reduction', policy);
      const good = value >= 0;
      row.append(el('rect', {x: Math.min(x0, x1), y: y + 8, width: Math.max(2, Math.abs(x1 - x0)), height: 20, fill: good ? COLOR_RT : COLOR_BAD, opacity: .85, rx: 2}));
      valueLabel(x1, labelFor('rt'), y + 23, good ? '#8ff0d8' : COLOR_BAD, false);
    } else {
      const draw = (which, yOff, color) => {
        const x1 = xFor(chartMode, policy, which);
        const valueUs = which === 'std' ? policy.std : policy.rt;
        // ✕ marks any maximum beyond the 4,000 µs deadline, in every mode.
        const over = valueUs > 4000;
        row.append(el('rect', {x: LEFT, y: y + yOff, width: Math.max(2, x1 - LEFT), height: 13, fill: color, opacity: which === 'std' ? .55 : .9, rx: 2}));
        valueLabel(x1, labelFor(which), y + yOff + 10.5, which === 'std' ? '#aab6bd' : '#bff1e0', over);
      };
      draw('std', 4, COLOR_STD);
      draw('rt', 20, COLOR_RT);
    }
    const hit = el('rect', {x: LEFT - 120, y: y + 1, width: RIGHT - LEFT + 120, height: ROW - 6, fill: 'transparent', style: 'cursor:pointer'});
    hit.addEventListener('click', () => {selectedPolicy = selectedPolicy === index ? -1 : index; paintChart();});
    row.append(hit);
    group.append(row);
  });
}

function paintChart() {
  drawGrid();
  drawBars();
  const selection = selectedPolicy < 0 ? policies.reduce((a, b) => reduction(b) > reduction(a) ? b : a) : policies[selectedPolicy];
  const value = chartMode === 'reduction'
    ? `${reduction(selection) > 0 ? '+' : ''}${format(reduction(selection))}%`
    : chartMode === 'share' ? `${format(selection.rt / 40)}%` : format(selection.rt);
  $('#highlight-count').textContent = value;
  $('#highlight-label').textContent = `${selection.short.toUpperCase()} · ${chartMode === 'reduction' ? 'Δ WITH RT' : chartMode === 'share' ? 'RT · SHARE OF DEADLINE' : 'RT MAX (µs)'}`;
  $('#chart-focus').style.setProperty('--focus-color', reduction(selection) >= 0 ? COLOR_RT : COLOR_BAD);
  $('#chart-focus-eyebrow').textContent = selectedPolicy < 0 ? 'BIGGEST RT GAIN' : 'POLICY IN FOCUS';
  $('#chart-focus-name').textContent = `${selection.name} · ${selection.param}`;
  $('#chart-focus-count').textContent = `${format(selection.std)} → ${format(selection.rt)}`;
  $('#chart-focus-percent').replaceChildren(document.createTextNode(`${reduction(selection) > 0 ? '−' : '+'}${format(Math.abs(reduction(selection)))}`), Object.assign(document.createElement('small'), {textContent: '%'}));
  $('#chart-focus-bar').style.width = `${Math.min(100, Math.abs(reduction(selection)))}%`;
  $('#chart-focus-context').textContent = selectedPolicy < 0
    ? 'Maximum wake-up latency under stress on Pi 5 [1, table 4]. Select a policy row or legend entry to focus.'
    : `Focused: ${selection.name} ${selection.param}. Standard ${format(selection.std)} µs → PREEMPT_RT ${format(selection.rt)} µs; RT share of deadline ${format(selection.rt / 40)}%.`;
  $('#chart-status').textContent = selectedPolicy < 0
    ? `${modes[chartMode].label}. 8 policies, 2 kernels — Pi 5 reference.`
    : `${selection.short}: std ${format(selection.std)} µs → RT ${format(selection.rt)} µs (Δ ${format(reduction(selection))}%). ${modes[chartMode].label}.`;
  $('#chart-desc').textContent = `Chart mode: ${modes[chartMode].label}. ${policies.map((p) => `${p.short}: ${p.std} → ${p.rt} µs`).join('; ')}. Source [1, table 4], Pi 5 under stress.`;
  $$('#chart-legend button').forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === selectedPolicy));
    button.classList.toggle('selected', index === selectedPolicy);
  });
}

function setChartMode(mode) {
  chartMode = mode;
  $$('.chart-tabs button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  paintChart();
}
$$('.chart-tabs button').forEach((button) => button.addEventListener('click', () => setChartMode(button.dataset.mode)));

policies.forEach((policy, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'legend-item';
  const good = reduction(policy) >= 0;
  button.style.setProperty('--group-color', good ? COLOR_RT : COLOR_BAD);
  button.setAttribute('aria-label', `${policy.short}: standard ${format(policy.std)} microseconds, RT ${format(policy.rt)} microseconds`);
  const swatch = document.createElement('i');
  swatch.style.background = `linear-gradient(180deg,${COLOR_STD} 0 50%,${good ? COLOR_RT : COLOR_BAD} 50% 100%)`;
  const label = document.createElement('span'); label.textContent = policy.short;
  const count = document.createElement('b'); count.textContent = `${format(policy.std)} → ${format(policy.rt)}`;
  const percentage = document.createElement('small'); percentage.textContent = `${reduction(policy) > 0 ? '−' : '+'}${format(Math.abs(reduction(policy)))}%`;
  button.append(swatch, label, count, percentage);
  button.addEventListener('click', () => {selectedPolicy = selectedPolicy === index ? -1 : index; paintChart();});
  $('#chart-legend').append(button);
});
$('#chart-reset').addEventListener('click', () => {selectedPolicy = -1; paintChart();});
paintChart();

// ----- Configuration browser: the eight scheduling files -----
const configs = [
  {
    short: 'OTHER · nice 0', category: 'SCHED_OTHER · NICE 0', title: 'The baseline everyone runs', source: 4,
    body: '<p>The ordinary scheduling class of every stock Linux process, at <strong>nice 0</strong>. The task shares CPU time inside the fair class — CFS or EEVDF depending on kernel version, which the run must record [8].</p><p><strong>Pi 5 reference [1]:</strong> max L 8,626 µs on the standard kernel → <strong>9,015 µs on PREEMPT_RT — worse</strong>. Both exceed the 4,000 µs deadline.</p><div class="document-insight"><span>READ THE SIGN</span><p>Real-time patching did not help this class on Pi 5. A fair-share policy offers weight, never a deadline contract [4].</p></div>'
  },
  {
    short: 'OTHER · nice −19', category: 'SCHED_OTHER · NICE −19', title: 'Weight, not a warranty', source: 4,
    body: '<p>Nice <strong>−19</strong> — the value chosen in the paper, one step above the −20 endpoint of the range. It raises the task\'s weight inside the ordinary class, ahead of SCHED_OTHER n0.</p><p><strong>Pi 5 reference [1]:</strong> 9,424 µs standard → <strong>4,351 µs RT</strong> (Δ ≈ 53.8%). Still beyond the 4,000 µs deadline at the maximum.</p><div class="document-insight"><span>WHAT NICE DOES NOT DO</span><p>Increasing weight never provides a deadline guarantee, and the fair algorithm itself depends on the kernel version [4, 8].</p></div>'
  },
  {
    short: 'FIFO · prio 50', category: 'SCHED_FIFO · PRIORITY 50', title: 'Static priority, no time slices', source: 4,
    body: '<p>Real-time priority <strong>50</strong>: FIFO keeps a static priority and no round-robin slicing among equal-priority threads [4]. With one control thread on a dedicated CPU, slicing effects stay small.</p><p><strong>Pi 5 reference [1]:</strong> 700 µs standard → <strong>160 µs RT</strong> (Δ ≈ 77.1%) — the smallest RT maximum of the whole table.</p><div class="document-insight"><span>WHY 50, NOT 99</span><p>On Pi 5 under RT, priority 50 actually beat priority 99 (160 vs 224 µs). Every configuration earns its own verdict.</p></div>'
  },
  {
    short: 'FIFO · prio 99', category: 'SCHED_FIFO · PRIORITY 99', title: 'Top of the real-time range', source: 4,
    body: '<p>Priority <strong>99</strong> — the top of the 1–99 real-time range [4]. The highest static claim the control thread can make on the scheduler.</p><p><strong>Pi 5 reference [1]:</strong> 1,848 µs standard → <strong>224 µs RT</strong> (Δ ≈ 87.9%). 224 µs is 5.6% of the 4,000 µs period — comfortably inside the 500 µs wake-up target.</p><div class="document-insight"><span>THE PAPER\'S HEADLINE CASE</span><p>Δ = (1,848 − 224) / 1,848 × 100 ≈ 87.9% — the reduction this replication will re-test on Pi 4 [1].</p></div>'
  },
  {
    short: 'RR · prio 50', category: 'SCHED_RR · PRIORITY 50', title: 'FIFO, plus time slices', source: 4,
    body: '<p>Round-robin at priority <strong>50</strong>: like FIFO, but threads at the same priority share the CPU in slices [4].</p><p><strong>Pi 5 reference [1]:</strong> 787 µs standard → <strong>225 µs RT</strong> (Δ ≈ 71.4%).</p><div class="document-insight"><span>WHEN RR MATTERS</span><p>With a single control thread pinned to CPU 2, RR slicing rarely engages — conclusions follow the measured results, not the label [4].</p></div>'
  },
  {
    short: 'RR · prio 99', category: 'SCHED_RR · PRIORITY 99', title: 'Round-robin at the top', source: 4,
    body: '<p>Priority <strong>99</strong> with RR semantics — the strongest round-robin claim in the matrix [4].</p><p><strong>Pi 5 reference [1]:</strong> 472 µs standard → <strong>182 µs RT</strong> (Δ ≈ 61.4%).</p><div class="document-insight"><span>COMPARE, DON\'T ASSUME</span><p>Its standard-kernel maximum (472 µs) was already the lowest of the table — the RT gain is smaller precisely because the baseline was calmer.</p></div>'
  },
  {
    short: 'DL · Q 400 µs', category: 'SCHED_DEADLINE · Q = 400 µs', title: 'EDF with a tight budget', source: 5,
    body: '<p>Earliest-Deadline-First with a Constant Bandwidth Server budget of <strong>Q = 400 µs</strong> — 10% of the 4 ms period [5].</p><p><strong>Pi 5 reference [1]:</strong> 345 µs standard → <strong>209 µs RT</strong> (Δ ≈ 39.4%).</p><div class="document-insight"><span>CBS RULES TO RESPECT</span><p>A task that exhausts its budget waits for replenishment; pinning requires a proper cpuset root domain, and the actual policy must be verified after setup — a rejected request is recorded, never silently ignored [5].</p></div>'
  },
  {
    short: 'DL · Q 800 µs', category: 'SCHED_DEADLINE · Q = 800 µs', title: 'EDF with headroom', source: 5,
    body: '<p>The same deadline scheduler with a doubled budget: <strong>Q = 800 µs</strong> — 20% of the period [5].</p><p><strong>Pi 5 reference [1]:</strong> 443 µs standard → <strong>197 µs RT</strong> (Δ ≈ 55.5%).</p><div class="document-insight"><span>BUDGETS ≠ ELAPSED TIME</span><p>E may include preemption, so it cannot directly size a CPU budget; the pilot watches for budget exhaustion or adds CLOCK_THREAD_CPUTIME_ID measurements.</p></div>'
  }
];
let activeConfig = 0;
function renderConfig(index, focus = false) {
  activeConfig = index;
  const config = configs[index];
  $$('#decree-tabs button').forEach((button, tabIndex) => {
    const selected = tabIndex === index;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  $('#decree-panel').setAttribute('aria-labelledby', `decree-tab-${index}`);
  $('#decree-num').textContent = String(index + 1).padStart(2, '0');
  $('#decree-category').textContent = config.category;
  $('#decree-title').textContent = config.title;
  $('#decree-body').innerHTML = config.body; // Authored static editorial content only.
  $('#decree-source').href = `#s${config.source}`;
  $('#decree-source').textContent = `Check source [${config.source}]`;
}
configs.forEach((config, index) => {
  const button = document.createElement('button');
  button.id = `decree-tab-${index}`;
  button.className = 'decree-tab';
  button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'decree-panel');
  const number = document.createElement('span'); number.className = 'tab-number'; number.textContent = String(index + 1).padStart(2, '0');
  const label = document.createElement('strong'); label.textContent = config.short;
  const arrow = document.createElement('i'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
  button.append(number, label, arrow);
  button.addEventListener('click', () => renderConfig(index));
  button.addEventListener('keydown', (event) => {
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (activeConfig + 1) % configs.length;
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (activeConfig + configs.length - 1) % configs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = configs.length - 1;
    if (next !== undefined) {event.preventDefault(); renderConfig(next, true);}
  });
  $('#decree-tabs').append(button);
});
renderConfig(0);

$$('#quiz button').forEach((button) => button.addEventListener('click', () => {
  $$('#quiz button').forEach((other) => {
    const selected = other === button;
    other.setAttribute('aria-pressed', String(selected));
    other.classList.toggle('selected', selected);
  });
  $('#quiz-feedback').hidden = false;
  $('#quiz-feedback').innerHTML = (button.dataset.answer === 'no' ? '<strong>Right — RT shrinks kernel-side delay, not the whole pipeline.</strong> ' : '<strong>Look at the whole pipeline first.</strong> ')
    + 'PREEMPT_RT makes many kernel paths preemptible and threads many interrupt handlers, cutting the time a task waits for kernel work [2, 3]. But the deadline is a property of the entire configuration: the payload\'s CPU demand, memory interference from other cores, DEADLINE admission and CBS budgets [5], thermal and power throttling, even RT bandwidth settings. That is why this project measures 32 configurations instead of assuming one. <a href="#s2">Re-read source [2]</a>.';
}));

const photoDialog = $('#photo-dialog');
let photoTrigger;
$$('[data-image]').forEach((button) => button.addEventListener('click', () => {
  photoTrigger = button;
  $('#dialog-image').src = button.dataset.image;
  $('#dialog-image').alt = button.querySelector('img')?.alt || button.dataset.alt || 'Archive photo';
  $('#dialog-caption').textContent = button.dataset.caption;
  photoDialog.showModal();
}));
$('.dialog-close').addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', (event) => {if (event.target === photoDialog) photoDialog.close();});
photoDialog.addEventListener('close', () => photoTrigger?.focus());
