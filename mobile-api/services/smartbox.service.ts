import api from "./api";
import { Device, DeviceEvent } from "./types";
export type SmartboxEvent = DeviceEvent;
export const smartboxService = {
  async getLatest() {
    return (await api.get<DeviceEvent>("/api/smartbox/latest")).data;
  },
  async getDevices() {
    return (await api.get<Device[]>("/api/smartbox/devices")).data;
  },
};
