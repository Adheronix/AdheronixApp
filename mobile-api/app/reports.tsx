import { useCallback, useState } from "react";
import { Platform, Share, View } from "react-native";
import {
  Button,
  C,
  Card,
  Chip,
  Companion,
  Empty,
  Loading,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
} from "../components/ui";
import { useResource } from "../hooks/use-resource";
import { useSession } from "../components/session";
import { medicationService } from "../services/medication.service";
import { scheduleService } from "../services/schedule.service";
import { smartboxService } from "../services/smartbox.service";
import {
  displayTime,
  dosage,
  localDate,
  medicationName,
} from "../services/types";
const load = async () => {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const [medications, history, devices] = await Promise.all([
    medicationService.getAll(),
    scheduleService.getSchedules(localDate(start), localDate()),
    smartboxService.getDevices(),
  ]);
  return { medications, history, devices };
};
export default function Reports() {
  const { user } = useSession();
  const { data, loading, error } = useResource(useCallback(load, []));
  const [shareError, setShareError] = useState("");
  const recorded = (data?.history ?? []).filter((d) => d.status !== "pending");
  const confirmed = recorded.filter(
    (d) => d.status === "taken" && d.confirmation_source === "patient",
  ).length;
  async function share() {
    if (!data) return;
    const message = [
      "Adheronix — medication summary",
      user?.full_names ?? "Patient",
      "Generated " + new Date().toLocaleDateString("en-GB"),
      "Patient-confirmed doses (last 7 days): " + confirmed,
      ...data.medications.map(
        (m) =>
          medicationName(m) +
          " — " +
          dosage(m) +
          " — " +
          m.frequency +
          " times daily",
      ),
      ...recorded.map(
        (d) =>
          d.scheduled_date +
          " " +
          displayTime(d.scheduled_time) +
          " — " +
          medicationName(d.medication) +
          " — " +
          d.status +
          (d.notes ? " — " + d.notes : ""),
      ),
      "Patient-entered records and device observations. Not a diagnosis or a replacement for a clinical record.",
    ].join("\n");
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        await window.navigator.clipboard.writeText(message);
        setShareError(
          "Summary copied. Review it before sharing with your clinician.",
        );
      } else await Share.share({ message });
    } catch {
      setShareError(
        "Your device could not share this summary. You can still review it here.",
      );
    }
  }
  return (
    <Screen back>
      <PageTitle
        eyebrow="YOUR CARE STORY, MADE CLEARER"
        title="Medication summary"
        body="A useful conversation starter for your next appointment."
        action={
          <Button
            small
            variant="secondary"
            icon="share-outline"
            label={Platform.OS === "web" ? "Copy summary" : "Share summary"}
            disabled={!data}
            onPress={() => void share()}
          />
        }
      />
      {error && <Notice message={error} error />}
      {shareError && <Notice message={shareError} />}
      <View style={{ gap: 22, marginTop: 12 }}>
        {loading && !data ? (
          <Loading />
        ) : (
          <>
            <Card>
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <View style={{ gap: 5 }}>
                  <T variant="h2">{user?.full_names || "Your care record"}</T>
                  <T color={C.muted}>
                    Generated{" "}
                    {new Date().toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </T>
                </View>
                <Chip label="Last 7 days" tone="green" />
              </Row>
              <Row style={{ flexWrap: "wrap", gap: 45, marginTop: 10 }}>
                <View>
                  <T variant="display">{confirmed}</T>
                  <T variant="small" color={C.muted}>
                    Patient-confirmed doses
                  </T>
                </View>
                <View>
                  <T variant="display">{data?.medications.length ?? 0}</T>
                  <T variant="small" color={C.muted}>
                    Medication records
                  </T>
                </View>
                <View>
                  <T variant="display">
                    {data?.devices.reduce(
                      (n, d) => n + (d.latestEvent ? 1 : 0),
                      0,
                    ) ?? 0}
                  </T>
                  <T variant="small" color={C.muted}>
                    Boxes with recent event records
                  </T>
                </View>
              </Row>
            </Card>
            <Card>
              <Row>
                <Companion kind="journal" size={64} />
                <T variant="h2">Medication list</T>
              </Row>
              {!data?.medications.length ? (
                <T color={C.muted}>No medication records have been added.</T>
              ) : (
                data.medications.map((m) => (
                  <View
                    key={m.medication_id}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: C.line,
                      gap: 5,
                    }}
                  >
                    <T variant="h3">{medicationName(m)}</T>
                    <T color={C.muted}>
                      {dosage(m)} · {m.frequency} times daily · {m.period}
                    </T>
                    <T variant="small" color={C.muted}>
                      {m.intake_recommendation}
                    </T>
                    <Chip
                      label={
                        m.source === "patient"
                          ? "Patient-entered record"
                          : "Imported record"
                      }
                    />
                  </View>
                ))
              )}
            </Card>
            <Card>
              <T variant="h2">Recorded dose history</T>
              {!recorded.length ? (
                <Empty
                  title="Your history grows with your routine"
                  body="Dose confirmations and skipped entries will appear here as you record them."
                />
              ) : (
                recorded.slice(0, 40).map((d) => (
                  <View
                    key={d.schedule_id}
                    style={{
                      paddingVertical: 13,
                      borderTopWidth: 1,
                      borderTopColor: C.line,
                      gap: 6,
                    }}
                  >
                    <Row
                      style={{
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <T variant="h3">{medicationName(d.medication)}</T>
                        <T variant="small" color={C.muted}>
                          {d.scheduled_date} · {displayTime(d.scheduled_time)}
                        </T>
                      </View>
                      <Chip
                        label={
                          d.status === "taken"
                            ? "Taken"
                            : d.status === "skipped"
                              ? "Skipped"
                              : "Missed"
                        }
                        tone={d.status === "taken" ? "green" : "neutral"}
                      />
                    </Row>
                    <T variant="small" color={C.muted}>
                      {d.confirmation_source === "patient"
                        ? "Confirmed by patient"
                        : d.status === "taken"
                          ? "Previously recorded — confirmation source unavailable"
                          : "Patient status record"}
                      {d.notes ? " · " + d.notes : ""}
                    </T>
                  </View>
                ))
              )}
            </Card>
            <Notice message="This summary reflects app records, not verified ingestion or a diagnosis. Device observations remain separate from patient confirmations. Review this information with your clinician." />
          </>
        )}
      </View>
    </Screen>
  );
}
