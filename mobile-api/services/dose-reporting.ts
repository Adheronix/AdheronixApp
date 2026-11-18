import type { Dose } from "./types";
import { displayTime, medicationName } from "./types";

export const SKIP_REASONS = [
  {
    label: "Forgot",
    help: "Think about what would make the reminder easier to notice in your daily routine.",
  },
  {
    label: "Ran out",
    help: "Contact your pharmacy or care team about your next supply.",
  },
  {
    label: "Cost or access",
    help: "Ask your pharmacist or care team about available supply or cost support.",
  },
  {
    label: "Concerns or side effects",
    help: "Share your concerns with your pharmacist or clinician so they can review them with you.",
  },
  {
    label: "Routine changed",
    help: "Discuss timing difficulties with your pharmacist or clinician before changing your prescribed schedule.",
  },
  {
    label: "Difficulty taking it",
    help: "Ask your pharmacist or clinician about the difficulty you are having with this medicine.",
  },
  {
    label: "Prefer not to say",
    help: "You can record a skipped dose without explaining why.",
  },
] as const;
export type ReportStatus = "taken" | "skipped" | "pending";

// Schedule wall-clock times follow the API's Africa/Kigali timezone.
function reportingClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function reportingPeriod(now = new Date()) {
  const end = reportingClock(now).date;
  const start = new Date(end + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: start.toISOString().slice(0, 10), end };
}

export function summarizeDoseReports(history: Dose[], now = new Date()) {
  const period = reportingPeriod(now);
  const time = reportingClock(now).time;
  const inPeriod = history.filter(
    (d) => d.scheduled_date >= period.start && d.scheduled_date <= period.end,
  );
  const doses = inPeriod.filter(
    (d) =>
      d.status !== "pending" ||
      d.scheduled_date < period.end ||
      d.scheduled_time.slice(0, 5) <= time,
  );
  const reportedTaken = doses.filter(
    (d) => d.status === "taken" && d.confirmation_source === "patient",
  ).length;
  const unattributedTaken = doses.filter(
    (d) => d.status === "taken" && d.confirmation_source !== "patient",
  ).length;
  const unreported = doses.filter((d) => d.status === "pending").length;
  return {
    period,
    doses,
    total: doses.length,
    reportedTaken,
    unattributedTaken,
    unreported,
    unknown: unreported + unattributedTaken,
    skipped: doses.filter((d) => d.status === "skipped").length,
    missed: doses.filter((d) => d.status === "missed").length,
    upcoming: inPeriod.length - doses.length,
    percent: doses.length
      ? Math.round((reportedTaken / doses.length) * 100)
      : null,
  };
}

export function doseReportLabel(dose: Dose): string {
  if (dose.status === "taken")
    return dose.confirmation_source === "patient"
      ? "Reported taken"
      : "Taken — source unknown";
  if (dose.status === "skipped")
    return dose.confirmation_source === "patient"
      ? "Reported skipped"
      : "Recorded skipped";
  if (dose.status === "missed")
    return dose.confirmation_source === "patient"
      ? "Reported missed"
      : "Recorded missed";
  return dose.notes?.startsWith("Unsure whether this dose was taken.")
    ? "Unsure"
    : "No report yet";
}

export function doseReason(notes?: string | null) {
  return (
    SKIP_REASONS.find((r) => notes?.split("\n")[0] === `Reason: ${r.label}`)
      ?.label ?? ""
  );
}

export function personalDoseNote(notes?: string | null) {
  if (doseReason(notes)) return notes!.split("\n").slice(1).join("\n");
  if (notes?.startsWith("Unsure whether this dose was taken."))
    return notes.split("\n").slice(1).join("\n");
  if (
    notes === "Confirmed by patient in Adheronix" ||
    notes === "Patient recorded this dose as skipped"
  )
    return "";
  return notes ?? "";
}

export function buildDoseNote(
  status: ReportStatus,
  reason: string,
  note: string,
) {
  const prefix =
    status === "skipped" && SKIP_REASONS.some((r) => r.label === reason)
      ? `Reason: ${reason}`
      : status === "pending"
        ? "Unsure whether this dose was taken."
        : "";
  // Older deployed APIs only replace truthy notes. A neutral marker prevents
  // a correction with no personal note from retaining a previous skipped reason.
  return (
    [prefix, note.trim()].filter(Boolean).join("\n") ||
    (status === "taken"
      ? "Confirmed by patient in Adheronix"
      : "Patient recorded this dose as skipped")
  );
}

export function doseHistoryLine(dose: Dose) {
  return `${dose.scheduled_date} ${displayTime(dose.scheduled_time)} — ${medicationName(dose.medication)} — ${doseReportLabel(dose)}${dose.notes ? " — " + dose.notes : ""}`;
}
