import api from './api';
import * as SecureStore from 'expo-secure-store';

export const authService = {
  async login(credentials: { username?: string; email?: string; phone_number?: string; password: string }) {
    const response = await api.post('/patient/login', credentials);
    if (response.data.access_token) {
      await SecureStore.setItemAsync('userToken', response.data.access_token);
      await SecureStore.setItemAsync('userData', JSON.stringify(response.data.user || response.data.patient));
    }
    return response.data;
  },

  async signup(data: { full_names: string; username: string; password: string; email?: string; phone_number?: string }) {
    const response = await api.post('/patient/register', data);
    if (response.data.access_token) {
      await SecureStore.setItemAsync('userToken', response.data.access_token);
      await SecureStore.setItemAsync('userData', JSON.stringify(response.data.user || response.data.patient));
    }
    return response.data;
  },

  async logout() {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
  },

  async isAuthenticated() {
    const token = await SecureStore.getItemAsync('userToken');
    return !!token;
  },

  async getUser() {
    const data = await SecureStore.getItemAsync('userData');
    return data ? JSON.parse(data) : null;
  }
};
