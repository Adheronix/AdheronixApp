import { careChanged } from "./care-events";
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
    const result = (await api.post<Medication>("/medications", body)).data;
    careChanged();
    return result;
  },
  async scanQR(body: MedicationInput) {
    const result = (await api.post<Medication>("/medications/scan-qr", body))
      .data;
    careChanged();
    return result;
  },
  async update(id: string, body: Partial<MedicationInput>) {
    const result = (await api.patch<Medication>(`/medications/${id}`, body))
      .data;
    careChanged();
    return result;
  },
  async delete(id: string) {
    await api.delete(`/medications/${id}`);
    careChanged();
  },
};
