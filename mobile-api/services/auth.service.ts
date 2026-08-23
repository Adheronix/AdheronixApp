import api from './api';
import { deleteItemAsync, getItemAsync, setItemAsync } from './storage';
import { registerForPushNotificationsAsync } from './push.service';

export const authService = {
  async login(credentials: { username?: string; email?: string; phone_number?: string; password: string }) {
    console.log('API Request: POST /patient/login', credentials);
    const response = await api.post('/patient/login', credentials);
    if (response.data.access_token) {
      await setItemAsync('userToken', response.data.access_token);
      await setItemAsync('userData', JSON.stringify(response.data.user || response.data.patient));
      // Best-effort push registration; ignore failures
      void registerForPushNotificationsAsync();
    }
    return response.data;
  },

  async signup(data: { full_names: string; username: string; password: string; email?: string; phone_number?: string }) {
    const response = await api.post('/patient/register', data);
    if (response.data.access_token) {
      await setItemAsync('userToken', response.data.access_token);
      await setItemAsync('userData', JSON.stringify(response.data.user || response.data.patient));
      // Best-effort push registration for new users
      void registerForPushNotificationsAsync();
    }
    return response.data;
  },

  async logout() {
    await Promise.all([
      deleteItemAsync('userToken'),
      deleteItemAsync('userData'),
      deleteItemAsync('access_token'),
      deleteItemAsync('patient'),
      deleteItemAsync('user'),
    ]);
  },

  async isAuthenticated() {
    const token = await getItemAsync('userToken');
    return !!token;
  },

  async getUser() {
    const data = await getItemAsync('userData');
    return data ? JSON.parse(data) : null;
  },

  async updateProfile(data: any) {
    const response = await api.patch('/patient/profile', data);
    if (response.data) {
      await setItemAsync('userData', JSON.stringify(response.data.patient || response.data));
    }
    return response.data;
  }
};
