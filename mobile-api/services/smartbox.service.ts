import api from './api';

export interface SmartboxEvent {
  status: 'waiting' | 'verified' | 'unconfirmed';
  message?: string;
  eventId?: string;
  deviceId?: string;
  binIndex?: number;
  timestamp?: string;
  confirmed?: boolean;
  verified?: boolean;
  weightBefore?: number | null;
  weightAfter?: number | null;
  weightLeftG?: number;
  scoreImpact?: number;
  medicine?: string;
  dosage?: string;
  condition?: string;
  scheduledTime?: string;
  pillsRemaining?: number;
  receivedAt?: string;
}

export const smartboxService = {
  async getLatest(): Promise<SmartboxEvent> {
    const response = await api.get<SmartboxEvent>('/api/smartbox/latest');
    return response.data;
  },

  async sendDemoDose(): Promise<{ event: SmartboxEvent; scoreUpdated: boolean }> {
    const response = await api.post('/api/smartbox/demo-dose');
    return response.data;
  },
};
