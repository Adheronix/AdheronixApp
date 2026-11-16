import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { resolveApiBaseUrl } from "./api-url";

function nativeScriptUrl(): string | undefined {
  if (!__DEV__ || Platform.OS === "web") return undefined;
  try {
    const source = NativeModules.SourceCode as
      | { getConstants?: () => { scriptURL?: string }; scriptURL?: string }
      | undefined;
    return source?.getConstants?.().scriptURL ?? source?.scriptURL;
  } catch {
    return undefined;
  }
}

// Development requests share Metro's reachable origin on web and native devices.
// The Metro proxy alone chooses the backend, avoiding stale LAN URLs in bundles.
export const BASE_URL = resolveApiBaseUrl({
  development: __DEV__,
  platform: Platform.OS,
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  scriptUrl: nativeScriptUrl(),
  manifestHost: __DEV__ ? Constants.expoConfig?.hostUri : undefined,
});
