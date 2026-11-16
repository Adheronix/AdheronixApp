import type { Dose, Device } from "./types";

export type CareMood =
  | "welcome"
  | "ready"
  | "progress"
  | "celebrate"
  | "gentle";
export function routineState(
  doses: Pick<Dose, "status" | "confirmation_source" | "time_until">[],
) {
  const confirmed = doses.filter(
    (d) => d.status === "taken" && d.confirmation_source === "patient",
  ).length;
  let mood: CareMood = "welcome";
  let message = "Here for your first small step.";
  if (doses.length && confirmed === doses.length) {
    mood = "celebrate";
    message = "Today’s doses, recorded by you. A little moment for yourself.";
  } else if (
    doses.some(
      (d) =>
        d.status === "skipped" ||
        d.status === "missed" ||
        (d.status === "pending" && d.time_until === "Overdue"),
    )
  ) {
    mood = "gentle";
    message = "A dose needs a check-in. Take a moment to review your plan.";
  } else if (confirmed > 0) {
    mood = "progress";
    message = "One small step recorded. We’re here for the rest of your day.";
  } else if (doses.length) {
    mood = "ready";
    message = "Your plan is here. One step at a time, at your own pace.";
  }
  return { mood, message, confirmed, total: doses.length };
}

export const SIGNAL_FRESHNESS_MS = 120_000;
export type BoxConnection = "online" | "offline" | "waiting";
export function boxConnection(
  device: Pick<Device, "latestWeight">,
  now = Date.now(),
): BoxConnection {
  if (!device.latestWeight.reportedAt) return "waiting";
  const last = Date.parse(device.latestWeight.reportedAt);
  if (!Number.isFinite(last)) return "waiting";
  // Small clock drift is tolerated; far-future timestamps cannot keep a box online.
  const age = now - last;
  return age >= -30_000 && age < SIGNAL_FRESHNESS_MS ? "online" : "offline";
}
