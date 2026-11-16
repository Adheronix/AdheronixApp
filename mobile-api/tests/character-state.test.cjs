const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const compiled = ts.transpileModule(
  readFileSync(resolve(__dirname, "../services/character-state.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
runInNewContext(compiled, context);
const { routineState, boxConnection, SIGNAL_FRESHNESS_MS } = context.exports;
const dose = (status, source, time_until) => ({
  status,
  confirmation_source: source,
  time_until,
});

test("empty plan welcomes and future doses keep a calm ready expression", () => {
  assert.equal(routineState([]).mood, "welcome");
  assert.equal(routineState([dose("pending")]).mood, "ready");
});
test("only patient confirmations produce progress or celebration", () => {
  assert.equal(routineState([dose("taken", null)]).confirmed, 0);
  assert.equal(
    routineState([dose("taken", "patient"), dose("pending")]).mood,
    "progress",
  );
  assert.equal(routineState([dose("taken", "patient")]).mood, "celebrate");
});
test("missed, skipped and overdue entries get a supportive check-in expression", () => {
  for (const d of [
    dose("missed"),
    dose("skipped"),
    dose("pending", null, "Overdue"),
  ])
    assert.equal(routineState([d]).mood, "gentle");
  assert.equal(
    routineState([dose("taken", "patient"), dose("skipped")]).mood,
    "gentle",
  );
});
test("MediBox turns on only with a recent valid signal and switches off at expiry", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  const device = (age) => ({
    latestWeight: { reportedAt: new Date(now - age).toISOString() },
  });
  assert.equal(boxConnection(device(0), now), "online");
  assert.equal(boxConnection(device(SIGNAL_FRESHNESS_MS - 1), now), "online");
  assert.equal(boxConnection(device(SIGNAL_FRESHNESS_MS), now), "offline");
  assert.equal(
    boxConnection(device(SIGNAL_FRESHNESS_MS + 30_000), now),
    "offline",
  );
});
test("missing, malformed, and far-future device times never appear connected", () => {
  const now = Date.now();
  assert.equal(boxConnection({ latestWeight: {} }, now), "waiting");
  assert.equal(
    boxConnection({ latestWeight: { reportedAt: "bad" } }, now),
    "waiting",
  );
  assert.equal(
    boxConnection(
      { latestWeight: { reportedAt: new Date(now + 60_000).toISOString() } },
      now,
    ),
    "offline",
  );
});
