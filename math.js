// Exact binomial maths behind the simulator. No sampling and no made-up data.
const GateMath = (() => {
  // P(exactly i solves) for i = 0..n, built by recurrence.
  function pmf(n, p) {
    if (p <= 0) return Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 1 : 0));
    if (p >= 1) return Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : 0));
    const out = [Math.pow(1 - p, n)];
    for (let i = 1; i <= n; i++) out[i] = out[i - 1] * ((n - i + 1) / i) * (p / (1 - p));
    return out;
  }

  // Chance of at most k solves in n attempts: the task passes a "too hard for the model" gate.
  function passChance(n, k, p) {
    return pmf(n, p).slice(0, k + 1).reduce((a, b) => a + b, 0);
  }

  // A grader that misses a share of correct solutions lowers the solve rate you get to see.
  const seenRate = (p, miss) => p * (1 - miss);

  // One-sided Clopper-Pearson upper bound: the highest solve rate still consistent with s solves in n.
  function upperBound(n, s, conf = 0.95) {
    if (s >= n) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (passChance(n, s, mid) > 1 - conf) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // Same bound once you allow for the grader: the true rate can sit above the rate you saw.
  const trueUpperBound = (n, s, miss, conf = 0.95) => Math.min(1, upperBound(n, s, conf) / (1 - miss));

  // Clean runs (zero solves) needed before the true rate is shown to be under `bar`.
  function runsToProve(bar, miss = 0, conf = 0.95) {
    return Math.ceil(Math.log(1 - conf) / Math.log(1 - seenRate(bar, miss)));
  }

  return { pmf, passChance, seenRate, upperBound, trueUpperBound, runsToProve };
})();

if (typeof module !== "undefined") module.exports = GateMath;
