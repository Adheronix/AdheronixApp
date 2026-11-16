const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const compiled = ts.transpileModule(
  readFileSync(resolve(__dirname, "../constants/theme.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
runInNewContext(compiled, context);
const { C } = context.exports;
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("essential text and navigation pairs meet WCAG AA normal-text contrast", () => {
  for (const [fg, bg] of [
    [C.text, C.bg],
    [C.muted, C.bg],
    [C.primary, C.white],
    [C.primary, C.mint],
    [C.white, C.ink],
    [C.white, C.primary],
    ["#B9EEE1", C.ink],
    ["#BDD0DC", C.ink],
    [C.red, C.redBg],
    [C.amber, C.amberBg],
  ])
    assert.ok(
      contrast(fg, bg) >= 4.5,
      `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}`,
    );
});
test("input boundaries can be distinguished against white fields", () =>
  assert.ok(contrast(C.fieldBorder, C.white) >= 3));
