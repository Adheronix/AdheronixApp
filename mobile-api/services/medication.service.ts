import api from "./api";
import { Medication } from "./types";
export interface MedicationInput {
  prescription: Record<string, unknown>;
  intake_recommendation: string;
  period: string;
  source: string;
  frequency: number;
}
export const medicationService = {
  async getAll() {
    return (await api.get<Medication[]>("/medications")).data;
  },
  async getById(id: string) {
    return (await api.get<Medication>(`/medications/${id}`)).data;
  },
  async create(body: MedicationInput) {
    return (await api.post<Medication>("/medications", body)).data;
  },
  async scanQR(body: MedicationInput) {
    return (await api.post<Medication>("/medications/scan-qr", body)).data;
  },
  async update(id: string, body: Partial<MedicationInput>) {
    return (await api.patch<Medication>(`/medications/${id}`, body)).data;
  },
  async delete(id: string) {
    await api.delete(`/medications/${id}`);
  },
};
