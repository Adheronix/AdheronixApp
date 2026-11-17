import { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
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
  const [review, setReview] = useState(false);
  const [sharing, setSharing] = useState(false);
  const recorded = (data?.history ?? []).filter((d) => d.status !== "pending");
  const confirmed = recorded.filter(
    (d) => d.status === "taken" && d.confirmation_source === "patient",
  ).length;
  const message = data
    ? [
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
      ].join("\n")
    : "";
  async function share() {
    if (!data || sharing) return;
    setSharing(true);
    setShareError("");
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        await window.navigator.clipboard.writeText(message);
        setShareError(
          "Summary copied. Review it before sharing with your clinician.",
        );
      } else {
        const result = await Share.share(
          { title: "Adheronix medication summary", message },
          { dialogTitle: "Share your medication summary" },
        );
        setShareError(
          result.action === Share.dismissedAction
            ? "Sharing cancelled. Your summary is still here."
            : "Your device’s sharing options were opened. Choose an app there to continue.",
        );
      }
    } catch {
      setShareError(
        "Your device could not share this summary. You can still review it here.",
      );
    } finally {
      setSharing(false);
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
            label="Share summary"
            disabled={!data}
            onPress={() => {
              setShareError("");
              setReview(true);
            }}
          />
        }
      />
      {error && <Notice message={error} error />}

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
              <Row style={{ gap: 12, alignItems: "stretch", marginTop: 12 }}>
                {[
                  {
                    value: confirmed,
                    label: "Patient-confirmed doses",
                    note: "Last 7 days",
                  },
                  {
                    value: data?.medications.length ?? 0,
                    label: "Medication records",
                    note: "Current list",
                  },
                ].map((metric) => (
                  <View
                    key={metric.label}
                    style={{
                      flex: 1,
                      padding: 15,
                      borderRadius: 16,
                      backgroundColor: C.bg,
                      gap: 5,
                    }}
                  >
                    <T variant="display">{metric.value}</T>
                    <T
                      variant="small"
                      style={{ fontFamily: "Inter_600SemiBold" }}
                    >
                      {metric.label}
                    </T>
                    <T variant="small" color={C.muted}>
                      {metric.note}
                    </T>
                  </View>
                ))}
              </Row>
              {!recorded.length && (
                <T variant="small" color={C.muted}>
                  No dose entries in this period yet. This isn’t an assessment
                  of your health or adherence.
                </T>
              )}
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
      <Modal
        visible={review}
        transparent
        animationType="fade"
        onRequestClose={() => setReview(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#15374E66",
            justifyContent: "flex-end",
            padding: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close summary preview"
            style={{ flex: 1 }}
            onPress={() => setReview(false)}
          />
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: "85%",
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
              borderRadius: 24,
              backgroundColor: C.white,
              padding: 22,
              gap: 15,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="h2">Review before sharing</T>
              <Button
                small
                variant="ghost"
                label="Close"
                onPress={() => setReview(false)}
              />
            </Row>
            <T variant="small" color={C.muted}>
              This contains your name and medication records. Choose who you
              want to share it with.
            </T>
            <ScrollView style={{ flexShrink: 1 }}>
              <T selectable>{message}</T>
            </ScrollView>
            {!!shareError && <Notice message={shareError} />}
            <Button
              icon="share-outline"
              loading={sharing}
              label={
                Platform.OS === "web"
                  ? "Copy summary text"
                  : "Choose an app to share"
              }
              onPress={() => void share()}
            />
            <T variant="small" color={C.muted}>
              You can also press and hold the text to select and copy it.
            </T>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
