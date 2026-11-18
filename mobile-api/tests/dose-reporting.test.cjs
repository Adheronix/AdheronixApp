const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
function load(name) {
  const context = {
    exports: {},
    Date,
    require: (path) => load(path.replace("./", "")),
  };
  runInNewContext(
    ts.transpileModule(
      readFileSync(resolve(__dirname, `../services/${name}.ts`), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    context,
  );
  return context.exports;
}
const {
  summarizeDoseReports,
  doseReportLabel,
  buildDoseNote,
  doseReason,
  personalDoseNote,
  doseHistoryLine,
} = load("dose-reporting");
const now = new Date(2026, 10, 18, 12, 0);
const dose = (status, source, time = "09:00:00", date = "2026-11-18") => ({
  status,
  confirmation_source: source,
  scheduled_time: time,
  scheduled_date: date,
});

test("weekly report includes due unknowns and legacy taken entries without inflating reported intake", () => {
  const summary = summarizeDoseReports(
    [
      dose("taken", "patient"),
      dose("taken", null),
      dose("skipped", "patient"),
      dose("pending", null),
      dose("pending", null, "23:00:00"),
      dose("taken", "patient", "09:00:00", "2026-11-11"),
      dose("taken", "patient", "09:00:00", "2026-11-19"),
    ],
    now,
  );
  assert.equal(summary.total, 4);
  assert.equal(summary.reportedTaken, 1);
  assert.equal(summary.unknown, 2);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.upcoming, 1);
  assert.equal(summary.percent, 25);
});
test("an empty or future-only plan has no percentage; it is not zero adherence", () => {
  assert.equal(summarizeDoseReports([], now).percent, null);
  assert.equal(
    summarizeDoseReports([dose("pending", null, "23:00:00")], now).percent,
    null,
  );
});
test("the reporting date and due cutoff follow the schedule timezone at midnight", () => {
  const summary = summarizeDoseReports(
    [
      dose("pending", null, "00:15:00", "2026-11-19"),
      dose("pending", null, "01:00:00", "2026-11-19"),
    ],
    new Date("2026-11-18T22:30:00Z"),
  );
  assert.equal(summary.period.end, "2026-11-19");
  assert.equal(summary.total, 1);
  assert.equal(summary.upcoming, 1);
});
test("an unanswered past dose remains unknown and is not relabelled missed", () => {
  const d = dose("pending", null, "09:00:00", "2026-11-17");
  assert.equal(summarizeDoseReports([d], now).unreported, 1);
  assert.equal(doseReportLabel(d), "No report yet");
  assert.equal(d.status, "pending");
});
test("reason and note round-trip, and a correction does not carry a reason to another status", () => {
  const note = buildDoseNote(
    "skipped",
    "Cost or access",
    "  Ask about supply  ",
  );
  assert.equal(doseReason(note), "Cost or access");
  assert.equal(personalDoseNote(note), "Ask about supply");
  assert.equal(
    buildDoseNote("taken", "Cost or access", ""),
    "Confirmed by patient in Adheronix",
  );
  assert.equal(
    buildDoseNote("skipped", "", ""),
    "Patient recorded this dose as skipped",
  );
  assert.equal(doseReason(buildDoseNote("skipped", "invented", "")), "");
  assert.equal(personalDoseNote(buildDoseNote("taken", "", "")), "");
});
test("unsure remains unknown, while share text preserves the source of taken entries", () => {
  const unsure = {
    ...dose("pending", null),
    notes: buildDoseNote("pending", "", "Check my record"),
  };
  assert.equal(doseReportLabel(unsure), "Unsure");
  assert.equal(personalDoseNote(unsure.notes), "Check my record");
  assert.match(doseHistoryLine(dose("taken", null)), /Taken — source unknown/);
  assert.match(doseHistoryLine(dose("taken", "patient")), /Reported taken/);
  assert.doesNotMatch(doseHistoryLine(unsure), /Reported taken/);
});
