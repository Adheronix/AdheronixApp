import api from './api';

export const scheduleService = {
  async getSchedules(startDate?: string, endDate?: string) {
    const response = await api.get('/medication-schedules/history', {
      params: { startDate, endDate }
    });
    return response.data;
  },

  async getUpcoming() {
    const response = await api.get('/medication-schedules/upcoming');
    return response.data;
  },

  async getStatus() {
    const response = await api.get('/medication-schedules/status');
    return response.data;
  },

  async getAdherence() {
    const response = await api.get('/medication-schedules/adherence');
    return response.data;
  },

  async markAsTaken(scheduleId: string, notes?: string) {
    const response = await api.patch(`/medication-schedules/${scheduleId}/taken`, { notes });
    return response.data;
  }
};
