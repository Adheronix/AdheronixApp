import { careChanged } from "./care-events";
import api from "./api";
import { Adherence, Dose } from "./types";
export const scheduleService = {
  async getSchedules(startDate?: string, endDate?: string) {
    return (
      await api.get<Dose[]>("/medication-schedules/history", {
        params: { startDate, endDate },
      })
    ).data;
  },
  async getUpcoming() {
    return (await api.get<Dose[]>("/medication-schedules/upcoming")).data;
  },
  async getStatus() {
    return (
      await api.get<{
        medications_taken_today: number;
        medications_pending: number;
        medications_missed: number;
        total_scheduled: number;
      }>("/medication-schedules/status")
    ).data;
  },
  async getAdherence() {
    return (await api.get<Adherence>("/medication-schedules/adherence")).data;
  },
  async create(medication_id: string, times: string[]) {
    const result = (
      await api.post<{ schedules: Dose[] }>("/medication-schedules", {
        medication_id,
        times,
        replace_pending: true,
      })
    ).data;
    careChanged();
    return result;
  },
  async markAsTaken(id: string, notes?: string) {
    const result = (
      await api.patch<Dose>(`/medication-schedules/${id}/taken`, { notes })
    ).data;
    careChanged();
    return result;
  },
  async updateStatus(id: string, status: Dose["status"], notes?: string) {
    const result = (
      await api.patch<Dose>(`/medication-schedules/${id}`, { status, notes })
    ).data;
    careChanged();
    return result;
  },
};
