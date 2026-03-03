import api from './api';

export const medicationService = {
  async getAll() {
    const response = await api.get('/medications');
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get(`/medications/${id}`);
    return response.data;
  },

  async scanQR(payload: any) {
    const response = await api.post('/medications/scan-qr', payload);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await api.patch(`/medications/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await api.delete(`/medications/${id}`);
    return response.data;
  }
};
