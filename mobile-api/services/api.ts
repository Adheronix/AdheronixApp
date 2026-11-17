import { create, isAxiosError } from "axios";
import { deleteItemAsync, getItemAsync } from "./storage";
import { BASE_URL } from "../constants/api";
import { expireSession } from "./session-events";

const api = create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use(async (config) => {
  const token = await getItemAsync("userToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    if (
      isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/patient/login")
    ) {
      await Promise.all([
        deleteItemAsync("userToken"),
        deleteItemAsync("userData"),
      ]);
      expireSession();
    }
    return Promise.reject(error);
  },
);
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    if (!error.response)
      return "We couldn’t connect. Check your connection and try again.";
    const message = error.response.data?.message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string" && error.response.status < 500)
      return message;
    if (error.response.status === 503)
      return "The assistant is temporarily unavailable. Please try again in a moment.";
  }
  return fallback;
}
export default api;
