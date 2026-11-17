interface ApiEnvironment {
  development: boolean;
  platform: string;
  configuredUrl?: string | null;
  scriptUrl?: string | null;
  manifestHost?: string | null;
}

function metroOrigin(value?: string | null): string | null {
  if (!value?.trim()) return null;
  let address = value
    .trim()
    .replace(/^exp:\/\//i, "http://")
    .replace(/^exps:\/\//i, "https://");
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(address)) address = "http://" + address;
  try {
    const url = new URL(address);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveApiBaseUrl(environment: ApiEnvironment): string {
  if (environment.development) {
    if (environment.platform === "web") return "/care-api";
    const origin =
      metroOrigin(environment.scriptUrl) ??
      metroOrigin(environment.manifestHost);
    if (origin) return origin + "/care-api";
  }
  return (environment.configuredUrl?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}
