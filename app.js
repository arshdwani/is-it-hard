// Is It Actually Hard? Reads the controls, runs GateMath and redraws everything on each change.
const DEFAULTS = { n: 5, k: 1, p: 30, miss: 0, pn: 20, pk: 3 };
const HARD = 0.1, EASY = 0.5;

const $ = (id) => document.getElementById(id);
const pct = (x) => {
  const v = x * 100;
  if (v > 0 && v < 1) return "<1%";
  if (v < 100 && v > 99) return ">99%";
  return Math.round(v) + "%";
};
const solves = (k) => `${k} ${k === 1 ? "solve" : "solves"}`;
const gateName = (n, k) => `${n} ${n === 1 ? "run" : "runs"}, at most ${solves(k)}`;

// ---- state, shareable through the URL ----
const query = new URLSearchParams(location.search);
const num = (key, min, max) => {
  const v = query.has(key) ? Number(query.get(key)) : DEFAULTS[key];
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : DEFAULTS[key];
};
const state = { n: num("n", 1, 40), k: num("k", 0, 40), p: num("p", 0, 100), miss: num("miss", 0, 25), pin: null };
if (![0, 10, 25].includes(state.miss)) state.miss = 0;
state.k = Math.min(state.k, state.n);
if (query.get("pin") !== "off") {
  const pn = num("pn", 1, 40);
  state.pin = { n: pn, k: Math.min(num("pk", 0, 40), pn) };
}
if (["light", "dark"].includes(query.get("theme"))) document.documentElement.dataset.theme = query.get("theme");

// Debounced: Safari throws if replaceState runs more than 100 times in 30 seconds, and a slider drag fires far more.
let urlTimer;
function saveUrl() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const q = new URLSearchParams(location.search);
    q.set("n", state.n); q.set("k", state.k); q.set("p", state.p); q.set("miss", state.miss);
    if (state.pin) { q.set("pn", state.pin.n); q.set("pk", state.pin.k); q.delete("pin"); }
    else { q.delete("pn"); q.delete("pk"); q.set("pin", "off"); }
    history.replaceState(null, "", "?" + q);
  }, 300);
}

// ---- small SVG helper ----
const NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}
function label(parent, x, y, text, cls, anchor = "middle") {
  const t = svgEl("text", { x, y, class: cls, "text-anchor": anchor }, parent);
  t.textContent = text;
  return t;
}

// ---- tooltip ----
const tip = $("tip");
function showTip(clientX, clientY, head, rows) {
  tip.replaceChildren();
  const h = document.createElement("div");
  h.className = "tip-head";
  h.textContent = head;
  tip.append(h);
  for (const row of rows) {
    const r = document.createElement("div");
    r.className = "tip-row";
    if (row.color) { const key = document.createElement("i"); key.style.background = row.color; r.append(key); }
    const value = document.createElement("b");
    value.textContent = row.value;
    const name = document.createElement("span");
    name.textContent = row.name;
    r.append(value, name);
    tip.append(r);
  }
  tip.hidden = false;
  const w = tip.offsetWidth, h2 = tip.offsetHeight;
  const x = Math.min(innerWidth - w - 8, Math.max(8, clientX + 14));
  const y = Math.max(8, clientY - h2 - 12);
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
const hideTip = () => { tip.hidden = true; };
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---- chart 1: the gate curve ----
const curveBox = $("curve");
let curveScale = null;
let curveHover = null;

function drawCurve() {
  const W = Math.max(280, curveBox.clientWidth), H = W < 480 ? 250 : 300;
  const m = { l: 42, r: 12, t: 12, b: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = (v) => m.l + v * iw, y = (v) => m.t + (1 - v) * ih;
  curveScale = { W, m, iw, ih, x, y };

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`, tabindex: 0, role: "img",
    "aria-label": `Line chart of pass chance against true solve rate. At ${state.p}% the gate passes ${pct(gatePass(state.n, state.k, state.p / 100))} of tasks. Use left and right arrow keys to change the rate.`,
  });
  for (const t of [0, .25, .5, .75, 1]) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: "grid-line" }, svg);
    label(svg, m.l - 8, y(t) + 4, Math.round(t * 100) + "%", "axis-text", "end");
  }
  for (const t of [0, .2, .4, .6, .8, 1]) label(svg, x(t), H - m.b + 18, Math.round(t * 100) + "%", "axis-text");
  label(svg, m.l + iw / 2, H - 6, "True solve rate", "axis-title");

  const path = (gate) => {
    let d = "";
    for (let i = 0; i <= 200; i++) {
      const v = i / 200;
      d += `${i ? "L" : "M"}${x(v).toFixed(1)} ${y(gatePass(gate.n, gate.k, v)).toFixed(1)}`;
    }
    return d;
  };
  const yours = path(state);
  svgEl("path", { d: `${yours}L${x(1)} ${y(0)}L${x(0)} ${y(0)}Z`, class: "wash" }, svg);
  if (state.pin) svgEl("path", { d: path(state.pin), class: "line s2" }, svg);
  svgEl("path", { d: yours, class: "line s1" }, svg);

  const v = state.p / 100, pass = gatePass(state.n, state.k, v);
  svgEl("line", { x1: x(v), x2: x(v), y1: m.t, y2: y(0), class: "now-line" }, svg);
  if (state.pin) svgEl("circle", { cx: x(v), cy: y(gatePass(state.pin.n, state.pin.k, v)), r: 5, class: "marker s2" }, svg);
  svgEl("circle", { cx: x(v), cy: y(pass), r: 6, class: "marker s1" }, svg);
  const right = v < .8;
  label(svg, x(v) + (right ? 11 : -11), Math.max(m.t + 12, y(pass) - 9), pct(pass), "value-label", right ? "start" : "end");

  curveHover = svgEl("line", { y1: m.t, y2: y(0), class: "hover-line", visibility: "hidden" }, svg);
  svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, class: "hit" }, svg);
  curveBox.replaceChildren(svg);
  wireCurve(svg);
}

const gatePass = (n, k, trueRate) => GateMath.passChance(n, k, GateMath.seenRate(trueRate, state.miss / 100));

function rateAt(svg, clientX) {
  const box = svg.getBoundingClientRect();
  const px = ((clientX - box.left) / box.width) * curveScale.W;
  return Math.round(Math.min(1, Math.max(0, (px - curveScale.m.l) / curveScale.iw)) * 100) / 100;
}

function curveTip(rate, clientX, clientY) {
  const rows = [{ value: pct(gatePass(state.n, state.k, rate)), name: "Your gate", color: cssVar("--series-1") }];
  if (state.pin) rows.push({ value: pct(gatePass(state.pin.n, state.pin.k, rate)), name: "Pinned gate", color: cssVar("--series-2") });
  showTip(clientX, clientY, `True solve rate ${Math.round(rate * 100)}%`, rows);
}

let dragging = false;
function wireCurve(svg) {
  if (dragging) svg.setPointerCapture?.(activePointer);
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    activePointer = e.pointerId;
    setRate(rateAt(svg, e.clientX), e);
  });
  svg.addEventListener("pointermove", (e) => {
    const rate = rateAt(svg, e.clientX);
    if (dragging) { setRate(rate, e); return; }
    curveHover.setAttribute("x1", curveScale.x(rate));
    curveHover.setAttribute("x2", curveScale.x(rate));
    curveHover.setAttribute("visibility", "visible");
    curveTip(rate, e.clientX, e.clientY);
  });
  svg.addEventListener("pointerleave", () => {
    if (dragging) return;
    curveHover.setAttribute("visibility", "hidden");
    hideTip();
  });
  svg.addEventListener("focus", () => {
    if (!svg.matches(":focus-visible")) return;
    const box = svg.getBoundingClientRect();
    curveTip(state.p / 100, box.left + (curveScale.x(state.p / 100) / curveScale.W) * box.width, box.top + 30);
  });
  svg.addEventListener("blur", hideTip);
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    state.p = Math.min(100, Math.max(0, state.p + step));
    render();
    const next = curveBox.querySelector("svg");
    next.focus();
  });
}
let activePointer = null;
function setRate(rate, e) {
  state.p = Math.round(rate * 100);
  render();
  curveTip(state.p / 100, e.clientX, e.clientY);
}
addEventListener("pointerup", () => { if (dragging) { dragging = false; hideTip(); } });
addEventListener("pointercancel", () => { dragging = false; hideTip(); });

// ---- chart 2: spread of possible results ----
const barsBox = $("bars");
function drawBars() {
  const seen = GateMath.seenRate(state.p / 100, state.miss / 100);
  const probs = GateMath.pmf(state.n, seen);
  const W = Math.max(280, barsBox.clientWidth), H = W < 480 ? 210 : 230;
  const m = { l: 42, r: 8, t: 22, b: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const top = Math.max(.1, Math.ceil(Math.max(...probs) * 10) / 10);
  const y = (v) => m.t + (1 - v / top) * ih;
  const slot = iw / probs.length;
  const barW = Math.min(24, Math.max(3, slot - 2));
  const every = Math.ceil(probs.length / (W < 480 ? 9 : 16));

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`, tabindex: 0, role: "img",
    "aria-label": `Column chart of how many solves ${state.n} attempts could produce. Use left and right arrow keys to read each column.`,
  });
  for (const t of [0, top / 2, top]) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: "grid-line" }, svg);
    label(svg, m.l - 8, y(t) + 4, Math.round(t * 100) + "%", "axis-text", "end");
  }

  const hits = [];
  probs.forEach((prob, i) => {
    const cx = m.l + slot * (i + .5);
    const h = Math.max(prob > 0 ? 1 : 0, y(0) - y(prob));
    const r = Math.min(4, barW / 2, h);
    const left = cx - barW / 2, base = y(0), tip0 = base - h;
    const d = `M${left} ${base}V${tip0 + r}Q${left} ${tip0} ${left + r} ${tip0}H${left + barW - r}Q${left + barW} ${tip0} ${left + barW} ${tip0 + r}V${base}Z`;
    const bar = svgEl("path", { d, class: `bar ${i <= state.k ? "pass" : "fail"}` }, svg);
    if (i % every === 0) label(svg, cx, H - m.b + 18, i, "axis-text");
    const hit = svgEl("rect", { x: m.l + slot * i, y: m.t, width: slot, height: ih, class: "hit" }, svg);
    hits.push({ bar, hit, i, prob });
  });
  label(svg, m.l + iw / 2, H - 6, `Solves out of ${state.n}`, "axis-title");

  if (state.k < state.n) {
    const gx = m.l + slot * (state.k + 1);
    svgEl("line", { x1: gx, x2: gx, y1: m.t - 8, y2: y(0), class: "gate-line" }, svg);
    const onRight = state.k + 1 < probs.length / 2;
    label(svg, gx + (onRight ? 6 : -6), m.t + 3, "Gate", "gate-text", onRight ? "start" : "end");
  }

  const peak = probs.indexOf(Math.max(...probs));
  const peakX = m.l + slot * (peak + .5);
  label(svg, peakX, y(probs[peak]) - 6, pct(probs[peak]), "value-label");

  const barTip = ({ bar, i, prob }, clientX, clientY) => {
    hits.forEach((item) => item.bar.classList.remove("active"));
    bar.classList.add("active");
    showTip(clientX, clientY, solves(i), [{ value: pct(prob), name: i <= state.k ? "passes the gate" : "fails the gate" }]);
  };
  hits.forEach((item) => {
    item.hit.addEventListener("pointermove", (e) => barTip(item, e.clientX, e.clientY));
    item.hit.addEventListener("pointerleave", () => { item.bar.classList.remove("active"); hideTip(); });
  });
  let cursor = 0;
  const atCursor = () => {
    const box = svg.getBoundingClientRect();
    barTip(hits[cursor], box.left + ((m.l + slot * (cursor + .5)) / W) * box.width, box.top + 40);
  };
  svg.addEventListener("focus", () => { if (svg.matches(":focus-visible")) atCursor(); });
  svg.addEventListener("blur", () => { hits.forEach((item) => item.bar.classList.remove("active")); hideTip(); });
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    cursor = Math.min(hits.length - 1, Math.max(0, cursor + step));
    atCursor();
  });
  barsBox.replaceChildren(svg);
}

// ---- tables ----
function cell(row, text, tag = "td", scope) {
  const c = document.createElement(tag);
  c.textContent = text;
  if (scope) c.scope = scope;
  row.append(c);
}
function drawTables() {
  const head = $("curve-head");
  head.replaceChildren();
  cell(head, "True rate", "th", "col");
  cell(head, "Your gate", "th", "col");
  if (state.pin) cell(head, "Pinned gate", "th", "col");
  const rows = $("curve-rows");
  rows.replaceChildren();
  for (let v = 0; v <= 100; v += 10) {
    const row = document.createElement("tr");
    cell(row, v + "%");
    cell(row, pct(gatePass(state.n, state.k, v / 100)));
    if (state.pin) cell(row, pct(gatePass(state.pin.n, state.pin.k, v / 100)));
    rows.append(row);
  }
  $("bars-caption").textContent = `Solves out of ${state.n} at a ${state.p}% true solve rate`;
  const body = $("bars-rows");
  body.replaceChildren();
  GateMath.pmf(state.n, GateMath.seenRate(state.p / 100, state.miss / 100)).forEach((prob, i) => {
    const row = document.createElement("tr");
    cell(row, i);
    cell(row, pct(prob));
    cell(row, i <= state.k ? "Pass" : "Fail");
    body.append(row);
  });
}

// ---- controls ----
const nIn = $("n"), kIn = $("k"), pIn = $("p");
const setFill = (el) => el.style.setProperty("--fill", ((el.value - el.min) / (el.max - el.min || 1)) * 100 + "%");

function renderLegend() {
  const legend = $("curve-legend");
  legend.replaceChildren();
  const add = (text, color) => {
    const key = document.createElement("span");
    key.className = "key";
    const line = document.createElement("i");
    line.className = "line";
    line.style.background = color;
    key.append(line, document.createTextNode(text));
    legend.append(key);
  };
  add(`Your gate: ${gateName(state.n, state.k)}`, "var(--series-1)");
  if (state.pin) add(`Pinned: ${gateName(state.pin.n, state.pin.k)}`, "var(--series-2)");
}

function render() {
  state.k = Math.min(state.k, state.n);
  nIn.value = state.n; kIn.max = state.n; kIn.value = state.k; pIn.value = state.p;
  [nIn, kIn, pIn].forEach(setFill);
  $("n-out").textContent = state.n;
  $("k-out").textContent = state.k === 0 ? "None" : `Up to ${state.k}`;
  $("p-out").textContent = state.p + "%";
  document.querySelector(`input[name="miss"][value="${state.miss}"]`).checked = true;

  const miss = state.miss / 100;
  const pass = gatePass(state.n, state.k, state.p / 100);
  $("hero-value").textContent = pct(pass);
  $("hero-note").textContent = `chance that a task solved ${state.p}% of the time passes this gate`;

  $("t-hard").textContent = pct(gatePass(state.n, state.k, HARD));
  $("t-easy").textContent = pct(gatePass(state.n, state.k, EASY));
  $("t-clean-label").textContent = `A clean 0 for ${state.n} still allows`;
  $("t-clean").textContent = pct(GateMath.trueUpperBound(state.n, 0, miss));
  $("t-runs").textContent = GateMath.runsToProve(HARD, miss);

  const seen = GateMath.seenRate(state.p / 100, miss);
  $("bars-sub").textContent = miss
    ? `If the true rate is ${state.p}% and the grader misses ${state.miss}% of correct solutions, you'd see about ${Math.round(seen * 100)}%.`
    : `Run a ${state.p}% task ${state.n} ${state.n === 1 ? "time" : "times"} and this is how the result could land.`;

  renderLegend();
  drawCurve();
  drawBars();
  drawTables();
  $("pin").textContent = state.pin ? "Pin this gate instead" : "Pin this gate to compare";
  saveUrl();
}

nIn.addEventListener("input", () => { state.n = Number(nIn.value); render(); });
kIn.addEventListener("input", () => { state.k = Number(kIn.value); render(); });
pIn.addEventListener("input", () => { state.p = Number(pIn.value); render(); });
$("miss").addEventListener("change", (e) => { state.miss = Number(e.target.value); render(); });
$("pin").addEventListener("click", () => { state.pin = { n: state.n, k: state.k }; render(); });
$("reset").addEventListener("click", () => {
  Object.assign(state, { n: DEFAULTS.n, k: DEFAULTS.k, p: DEFAULTS.p, miss: DEFAULTS.miss, pin: { n: DEFAULTS.pn, k: DEFAULTS.pk } });
  render();
});

let resizeTimer;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawCurve(); drawBars(); }, 60);
}).observe(document.querySelector(".board"));

render();
