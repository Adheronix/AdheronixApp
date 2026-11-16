import { Platform } from "react-native";
const normalizeUrl = (url: string) => url.replace(/\/+$/, "");
export const BASE_URL =
  Platform.OS === "web" && __DEV__
    ? "/care-api"
    : normalizeUrl(
        process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:3000",
      );
