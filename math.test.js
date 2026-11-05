// Run with: node math.test.js
const assert = require("node:assert/strict");
const M = require("./math.js");

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} is not ${b}`);

// Hand-worked binomial values.
near(M.passChance(5, 1, 0.1), 0.91854);
near(M.passChance(5, 1, 0.3), 0.52822);
near(M.passChance(5, 1, 0.5), 0.1875);
near(M.passChance(5, 0, 0.5), 1 / 32);
near(M.passChance(20, 3, 0.5), 1351 / 1048576);

// Every distribution sums to 1, including the edges.
for (const n of [1, 5, 20, 40]) for (const p of [0, 0.01, 0.3, 0.5, 0.99, 1]) {
  near(M.pmf(n, p).reduce((a, b) => a + b, 0), 1, 1e-9);
}

// Allowing every outcome always passes.
near(M.passChance(7, 7, 0.4), 1, 1e-9);

// Zero solves has a closed form: 1 - 0.05^(1/n).
near(M.upperBound(5, 0), 1 - Math.pow(0.05, 1 / 5));
near(M.upperBound(5, 0), 0.4507, 1e-4);
near(M.upperBound(29, 0), 1 - Math.pow(0.05, 1 / 29));
assert.equal(M.upperBound(5, 5), 1);

// The bound really is where the pass chance hits 5%.
near(M.passChance(12, 2, M.upperBound(12, 2)), 0.05, 1e-9);

// Runs needed: 29 clean runs for 10%, and more if the grader misses solutions.
assert.equal(M.runsToProve(0.1), 29);
assert.equal(M.runsToProve(0.05), 59);
assert.equal(M.runsToProve(0.1, 0.25), 39);
assert.ok(M.upperBound(29, 0) < 0.1 && M.upperBound(28, 0) > 0.1);

// Grader misses raise the ceiling on the true rate and cap at 100%.
near(M.trueUpperBound(5, 0, 0.25), M.upperBound(5, 0) / 0.75);
assert.equal(M.trueUpperBound(1, 0, 0.25), 1);

// Each control moves the answer the way it should.
const pass = (n, k, p, miss = 0) => M.passChance(n, k, M.seenRate(p, miss));
assert.ok(pass(5, 1, 0.2) > pass(5, 1, 0.4), "a higher solve rate lowers the pass chance");
assert.ok(pass(5, 2, 0.3) > pass(5, 1, 0.3), "allowing more solves raises the pass chance");
assert.ok(pass(10, 1, 0.3) < pass(5, 1, 0.3), "more attempts lower the pass chance");
assert.ok(pass(5, 1, 0.3, 0.25) > pass(5, 1, 0.3), "a grader that misses solutions raises the pass chance");

console.log("all maths checks pass");
