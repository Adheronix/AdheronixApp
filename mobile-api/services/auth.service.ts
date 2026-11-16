import api from "./api";
import { deleteItemAsync, getItemAsync, setItemAsync } from "./storage";
import { Patient } from "./types";
import { registerForPushNotificationsAsync } from "./push.service";

interface AuthResponse {
  access_token: string;
  patient: Patient;
}
async function persist(data: AuthResponse) {
  await setItemAsync("userToken", data.access_token);
  await setItemAsync("userData", JSON.stringify(data.patient));
  void registerForPushNotificationsAsync().catch(() => null);
}
export const authService = {
  async login(credentials: {
    username?: string;
    email?: string;
    phone_number?: string;
    password: string;
  }) {
    const { data } = await api.post<AuthResponse>(
      "/patient/login",
      credentials,
    );
    await persist(data);
    return data;
  },
  async signup(body: {
    full_names: string;
    username: string;
    password: string;
    email?: string;
    phone_number?: string;
  }) {
    const { data } = await api.post<AuthResponse>("/patient/register", body);
    await persist(data);
    return data;
  },
  async logout() {
    await Promise.all(
      ["userToken", "userData", "access_token", "patient", "user"].map(
        deleteItemAsync,
      ),
    );
  },
  async isAuthenticated() {
    return Boolean(await getItemAsync("userToken"));
  },
  async getUser(): Promise<Patient | null> {
    const value = await getItemAsync("userData");
    try {
      return value ? (JSON.parse(value) as Patient) : null;
    } catch {
      return null;
    }
  },
  async getProfile() {
    const { data } = await api.get<Patient>("/patient/profile");
    await setItemAsync("userData", JSON.stringify(data));
    return data;
  },
  async updateProfile(body: Partial<Patient>) {
    const { data } = await api.patch<Patient>("/patient/profile", body);
    await setItemAsync("userData", JSON.stringify(data));
    return data;
  },
};
