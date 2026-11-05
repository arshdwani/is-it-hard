# Is It Actually Hard?

**Live: https://arshdwani.github.io/is-it-hard/**

A model failed your benchmark task a few times. Is the task hard, or did you just not run it enough?

This simulator answers that with exact binomial maths. Set how many attempts you run and how many solves a task
can have and still count as hard, then drag the true solve rate and watch what your test can and can't tell you.

## What it shows

- **Pass chance:** how often a task with a given true solve rate gets through your gate.
- **Gate curve:** pass chance at every solve rate. Pin a gate to compare two designs side by side.
- **Possible results:** the spread of solve counts one test of the task could produce.
- **What a clean sheet proves:** the highest true solve rate still consistent with zero solves, at 95% confidence.
- **Broken grader toggle:** a grader that misses correct solutions makes easy tasks look hard.

Two results worth trying:

- A task that goes **0 for 5 can still have a true solve rate up to 45%**.
- It takes **29 clean runs** to show a solve rate is under 10%.

## How it works

Plain HTML, CSS and JavaScript with no dependencies and no build step. All the maths is in `math.js`. The model
assumes attempts are independent and the solve rate stays fixed, which real agents only roughly do. It contains no
real benchmark data.

```bash
node math.test.js                # check the maths
python3 -m http.server 8000      # run it locally
```

Settings live in the URL, so you can share a scenario: `?n=12&k=2&p=15&miss=25`.
