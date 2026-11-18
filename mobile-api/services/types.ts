export interface Patient {
  patient_id: string;
  full_names?: string;
  username: string;
  email?: string;
  age?: number | null;
  gender?: string | null;
  conditions?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  push_notifications_enabled?: boolean;
  email_notifications_enabled?: boolean;
}
export interface Medication {
  medication_id: string;
  prescription: Record<string, unknown>;
  intake_recommendation: string;
  period: string;
  frequency: number;
  source: string;
  schedules?: Dose[];
}
export interface Dose {
  schedule_id: string;
  medication_id?: string;
  medication_name?: string;
  medication?: Medication;
  prescription?: Record<string, unknown>;
  scheduled_date: string;
  scheduled_time: string;
  status: "pending" | "taken" | "missed" | "skipped";
  taken_at?: string | null;
  notes?: string | null;
  confirmation_source?: "patient" | null;
  time_until?: string;
}
export interface Adherence {
  total_scheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  adherence_rate: number;
  patient_reported_taken?: number;
  unattributed_taken?: number;
  unreported?: number;
  upcoming?: number;
  period: { start: string; end: string };
}
export interface NotificationItem {
  notification_id: string;
  title: string;
  message: string;
  type: string;
  status?: string;
  created_at: string;
  scheduled_for?: string;
  read_at?: string | null;
  metadata?: Record<string, unknown> | null;
}
export interface DeviceEvent {
  status: "waiting" | "removal_detected" | "uncertain";
  eventId?: string;
  deviceId?: string;
  timestamp?: string;
  receivedAt?: string;
  medicine?: string;
  weightLeftG?: number;
  patientConfirmed?: boolean;
}
export interface Device {
  deviceId: string;
  latestWeight: {
    status: string;
    weightG?: number;
    pillsEst?: number | null;
    reportedAt?: string;
  };
  latestEvent: DeviceEvent | null;
}
export function medicationName(
  m?: Medication | Record<string, unknown>,
): string {
  if (!m) return "Medication";
  const p = ("prescription" in m ? m.prescription : m) as
    | Record<string, unknown>
    | undefined;
  if (!p) return "Medication";
  if (typeof p.name === "string") return p.name;
  if (typeof p.medicine === "string") return p.medicine;
  if (Array.isArray(p.prescription))
    return medicationName(p.prescription[0] as Record<string, unknown>);
  return "Medication";
}
export function dosage(m: Medication): string {
  const value = m.prescription.dose ?? m.prescription.dosage;
  return typeof value === "string" ? value : "See your prescription";
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function displayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
