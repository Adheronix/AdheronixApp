const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const compiled = ts.transpileModule(
  readFileSync(resolve(__dirname, "../services/markdown.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {} };
runInNewContext(compiled, context);
const { normalizeMarkdown, markdownBlocks } = context.exports;

test("decodes the reported transport artifacts without leaking entities or escapes", () => {
  const input =
    "**Sure! Let’s build a routine. &#x20;**\\\n\\\n**1. \\*\\*Medications\\*\\* &#x20;**\\&#xA;**&#x20;  - What meds do you take? &#x20;**\\\n\\\n**2. \\*\\*Current Schedule\\*\\* &#x20;**\\&#xA;**&#x20;  - When do you usually take them? &#x20;**";
  const result = normalizeMarkdown(input);
  assert.doesNotMatch(result, /&#|\\/);
  const blocks = markdownBlocks(input);
  assert.equal(blocks.filter((b) => b.kind === "list").length, 4);
  assert.ok(
    blocks.some((b) => b.marker === "1." && b.text === "**Medications**"),
  );
  assert.ok(
    blocks.some((b) => b.marker === "•" && b.text === "What meds do you take?"),
  );
});
test("keeps ordinary Markdown headings, emphasis, ordered and unordered lists", () => {
  const blocks = markdownBlocks(
    "# Your plan\n\n**Start small.**\n1. Set a reminder\n- Keep a record",
  );
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[2].text, "**Start small.**");
  assert.equal(blocks[3].marker, "1.");
  assert.equal(blocks[4].marker, "•");
});
test("decodes twice-escaped entities and literal newline transport", () => {
  assert.equal(normalizeMarkdown("One&amp;#xA;Two\\nThree"), "One\nTwo\nThree");
});
test("invalid Unicode entities remain harmless text", () => {
  assert.equal(normalizeMarkdown("&#x110000; &#xD800;"), "&#x110000; &#xD800;");
});
test("HTML and script-looking content remain text blocks", () => {
  const blocks = markdownBlocks("&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(blocks[0].kind, "paragraph");
  assert.equal(blocks[0].text, "<script>alert(1)</script>");
});
test("preserves fenced code and closes an unfinished fence safely", () => {
  const blocks = markdownBlocks(
    "```text\n**literal**\n1. not a list\n```\n\nNext\n```\nunfinished",
  );
  assert.equal(blocks[0].kind, "code");
  assert.equal(blocks[0].text, "**literal**\n1. not a list");
  assert.equal(blocks.at(-1).kind, "code");
});
test("empty responses and Windows line endings are handled", () => {
  assert.equal(normalizeMarkdown("  \r\n\r\n "), "");
  assert.equal(normalizeMarkdown("one\r\ntwo\rthree"), "one\ntwo\nthree");
});

test("reported appointment table becomes labeled rows, not pipe paragraphs", () => {
  const blocks = markdownBlocks(
    "Here’s a check-list:\n\n| Item | Why it matters |\n|---|---|\n| **Photo ID** | Registration |\n| **List of medications** | Full picture |\n\nBring your questions.",
  );
  const table = blocks.find((b) => b.kind === "table");
  assert.equal(table.headers.join(","), "Item,Why it matters");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[1][1], "Full picture");
  assert.equal(blocks.at(-1).text, "Bring your questions.");
});
test("table handles escaped pipes and pipes inside inline code", () => {
  const table = markdownBlocks(
    "Name | Notes\n:---|---:\nA \\| B | `x|y`\nC | D",
  )[0];
  assert.equal(table.kind, "table");
  assert.equal(table.rows[0][0], "A | B");
  assert.equal(table.rows[0][1], "`x|y`");
});
test("fenced tables remain inert code; ordinary pipes remain prose", () => {
  assert.equal(
    markdownBlocks("```\n|A|B|\n|---|---|\n|x|y|\n```")[0].kind,
    "code",
  );
  assert.equal(markdownBlocks("Either A | B is fine.")[0].kind, "paragraph");
});
