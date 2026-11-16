const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const http = require("http");
const https = require("https");
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (request, response, next) => {
    const prefix = "/care-api";
    if (request.url === prefix || request.url.startsWith(prefix + "/")) {
      const base = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000";
      const target = new URL(request.url.slice(prefix.length) || "/", base);
      if (target.origin !== new URL(base).origin) {
        response.writeHead(400);
        response.end("Invalid API path");
        return;
      }
      const transport = target.protocol === "https:" ? https : http;
      const forwarded = transport.request(
        target,
        {
          method: request.method,
          headers: { ...request.headers, host: target.host },
        },
        (upstream) => {
          response.writeHead(upstream.statusCode || 502, upstream.headers);
          upstream.pipe(response);
        },
      );
      forwarded.on("error", () => {
        if (!response.headersSent)
          response.writeHead(503, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            message: "The care service is temporarily unavailable.",
          }),
        );
      });
      request.pipe(forwarded);
      return;
    }
    return middleware(request, response, next);
  },
};
module.exports = config;
