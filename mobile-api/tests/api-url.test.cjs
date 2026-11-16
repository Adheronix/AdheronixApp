const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const compiled = ts.transpileModule(
  readFileSync(resolve(__dirname, "../constants/api-url.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const context = { exports: {}, URL };
runInNewContext(compiled, context);
const { resolveApiBaseUrl } = context.exports;
const native = {
  development: true,
  platform: "android",
  configuredUrl: "http://192.0.2.50:3000",
};
test("Android development follows its loaded Metro bundle rather than a stale LAN API URL", () =>
  assert.equal(
    resolveApiBaseUrl({
      ...native,
      scriptUrl: "http://127.0.0.1:3253/entry.bundle?platform=android",
    }),
    "http://127.0.0.1:3253/care-api",
  ));
test("Expo manifest host supplies the native proxy when SourceCode is unavailable", () =>
  assert.equal(
    resolveApiBaseUrl({ ...native, manifestHost: "127.0.0.1:3253" }),
    "http://127.0.0.1:3253/care-api",
  ));
test("Expo URI schemes and HTTPS Metro hosts are supported", () => {
  assert.equal(
    resolveApiBaseUrl({ ...native, manifestHost: "exp://127.0.0.1:3253" }),
    "http://127.0.0.1:3253/care-api",
  );
  assert.equal(
    resolveApiBaseUrl({
      ...native,
      manifestHost: "exps://preview.example.test",
    }),
    "https://preview.example.test/care-api",
  );
});
test("iOS native development uses the same proxy", () =>
  assert.equal(
    resolveApiBaseUrl({
      ...native,
      platform: "ios",
      scriptUrl: "http://localhost:8081/index.bundle",
    }),
    "http://localhost:8081/care-api",
  ));
test("web development keeps a same-origin relative API route", () =>
  assert.equal(resolveApiBaseUrl({ ...native, platform: "web" }), "/care-api"));
test("release builds retain their explicitly configured API and strip trailing slashes", () =>
  assert.equal(
    resolveApiBaseUrl({
      ...native,
      development: false,
      configuredUrl: " https://api.example.test/// ",
      scriptUrl: "http://127.0.0.1:3253/entry.bundle",
    }),
    "https://api.example.test",
  ));
test("invalid, file and credential-bearing Metro addresses do not override configuration", () => {
  for (const scriptUrl of [
    "file:///data/app/index.bundle",
    "http://user:password@localhost:3253/entry.bundle",
    "http://[invalid",
  ])
    assert.equal(
      resolveApiBaseUrl({ ...native, scriptUrl }),
      native.configuredUrl,
    );
});
test("native development without a Metro host retains the existing configured fallback", () => {
  assert.equal(resolveApiBaseUrl(native), native.configuredUrl);
  assert.equal(
    resolveApiBaseUrl({ ...native, configuredUrl: "" }),
    "http://localhost:3000",
  );
});
