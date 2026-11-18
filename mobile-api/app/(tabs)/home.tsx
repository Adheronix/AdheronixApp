import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  C,
  Card,
  Chip,
  Companion,
  Loading,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
  go,
} from "../../components/ui";
import { useSession } from "../../components/session";
import { useResource } from "../../hooks/use-resource";
import { scheduleService } from "../../services/schedule.service";
import { displayTime, medicationName } from "../../services/types";
import { useCareProgress } from "../../components/care-progress";
import { errorMessage } from "../../services/api";
import { DoseReportSheet } from "../../components/dose-report-sheet";
import {
  buildDoseNote,
  doseReason,
  doseReportLabel,
  personalDoseNote,
  reportingPeriod,
  summarizeDoseReports,
} from "../../services/dose-reporting";
import type { Dose } from "../../services/types";
const load = async () => {
  const period = reportingPeriod();
  const history = await scheduleService.getSchedules(period.start, period.end);
  return { report: summarizeDoseReports(history) };
};
export default function Home() {
  const { user, refreshUnread } = useSession();
  const { data, loading, error, refresh } = useResource(load);
  const [acting, setActing] = useState(""),
    [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState<Dose | null>(null);
  const wide = useWindowDimensions().width >= 1180;
  const { doses, routine, refresh: refreshCare } = useCareProgress();
  const taken = routine.confirmed,
    total = doses.length;
  const percent = total ? Math.round((taken / total) * 100) : 0;
  async function confirm(id: string) {
    setActing(id);
    setActionError("");
    try {
      await scheduleService.updateStatus(
        id,
        "taken",
        buildDoseNote("taken", "", ""),
      );
      await Promise.all([refresh(), refreshCare()]);
      await refreshUnread();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setActing("");
    }
  }
  return (
    <Screen>
      <PageTitle
        eyebrow={new Date()
          .toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Africa/Kigali",
          })
          .toUpperCase()}
        title={"Hello, " + (user?.full_names?.split(" ")[0] || "there") + "."}
        body="Here’s your day, at a glance."
      />
      {error && <Notice message={error} error />}
      {actionError && <Notice message={actionError} error />}
      {loading && !data ? (
        <Loading />
      ) : (
        <View style={{ gap: 24 }}>
          <LinearGradient
            colors={["#E3F5EF", "#F2FAF8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 25,
              borderWidth: 1,
              borderColor: "#D2EAE2",
              paddingHorizontal: 22,
              paddingVertical: 18,
              gap: 10,
              overflow: "hidden",
            }}
          >
            <Row style={{ justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <T variant="label" color={C.primary}>
                  ONE DAY AT A TIME
                </T>
                {total ? (
                  <>
                    <Row style={{ alignItems: "baseline", gap: 7 }}>
                      <T
                        variant="display"
                        color={C.ink}
                        style={{ fontSize: 42, lineHeight: 48 }}
                      >
                        {taken}
                      </T>
                      <T
                        color={C.muted}
                        style={{ fontSize: 22, lineHeight: 32 }}
                      >
                        / {total}
                      </T>
                    </Row>
                    <T
                      variant="small"
                      color={C.primary}
                      style={{ fontFamily: "Inter_500Medium" }}
                    >
                      doses reported taken today
                    </T>
                  </>
                ) : (
                  <>
                    <T variant="h2" style={{ fontSize: 25, lineHeight: 32 }}>
                      Your routine,{"\n"}your pace.
                    </T>
                    <T variant="small" color={C.primary}>
                      A little support for your day.
                    </T>
                  </>
                )}
              </View>
              <Companion
                size={145}
                mood={routine.mood}
                style={{ marginRight: -5 }}
              />
            </Row>
            <T color={C.muted} style={{ fontSize: 13, lineHeight: 21 }}>
              {total
                ? routine.message
                : "Add the medication on your prescription whenever you’re ready."}
            </T>
            {total > 0 && (
              <View
                style={{
                  height: 6,
                  borderRadius: 4,
                  backgroundColor: "#CFE8DF",
                  marginTop: 3,
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 4,
                    backgroundColor: C.success,
                    width: (percent + "%") as `${number}%`,
                  }}
                />
              </View>
            )}
            <Row style={{ justifyContent: "space-between", marginTop: 3 }}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Your care summary"
                onPress={() => go("/reports")}
                style={{ paddingVertical: 7 }}
              >
                <Row style={{ gap: 5 }}>
                  <T
                    variant="small"
                    color={C.primary}
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    Your care summary
                  </T>
                  <Ionicons name="arrow-forward" size={14} color={C.primary} />
                </Row>
              </Pressable>
              {total > 0 && (
                <T
                  variant="small"
                  color={C.success}
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {percent}% reported taken
                </T>
              )}
            </Row>
          </LinearGradient>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <View style={{ flex: wide ? 1.8 : undefined, gap: 18 }}>
              <Row style={{ justifyContent: "space-between", gap: 10 }}>
                <T variant="h2">Today’s plan</T>
                <Button
                  small
                  variant="secondary"
                  label="Add medicine"
                  icon="add"
                  onPress={() => go("/add-medication")}
                />
              </Row>
              <Card style={{ padding: 0, gap: 0 }}>
                {!doses.length ? (
                  <View style={{ padding: 23, gap: 13 }}>
                    <Row style={{ gap: 11 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 13,
                          backgroundColor: C.mint,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="medkit-outline"
                          size={21}
                          color={C.primary}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <T variant="h3">A small start. A clearer day.</T>
                        <T variant="small" color={C.muted}>
                          Your first medication will appear here.
                        </T>
                      </View>
                    </Row>
                    <T variant="small" color={C.muted}>
                      Use the details on your prescription. Your reminders and
                      dose record will grow from there.
                    </T>
                  </View>
                ) : (
                  doses.map((dose, i) => {
                    const done = dose.status === "taken",
                      skipped = dose.status === "skipped";
                    const reported =
                      done && dose.confirmation_source === "patient";
                    const unsure = doseReportLabel(dose) === "Unsure";
                    const name =
                      dose.medication_name || medicationName(dose.medication);
                    const p =
                      dose.prescription || dose.medication?.prescription;
                    const amount =
                      typeof p?.dose === "string"
                        ? p.dose
                        : typeof p?.dosage === "string"
                          ? p.dosage
                          : "";
                    return (
                      <View
                        key={dose.schedule_id}
                        style={{
                          padding: 22,
                          borderTopWidth: i ? 1 : 0,
                          borderTopColor: C.line,
                          gap: 14,
                        }}
                      >
                        <Row style={{ alignItems: "flex-start" }}>
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 13,
                              backgroundColor: reported ? C.mint : C.bg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons
                              name={reported ? "checkmark" : "medical-outline"}
                              size={21}
                              color={reported ? C.primary : C.muted}
                            />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <T variant="h3">{name}</T>
                            <T variant="small" color={C.muted}>
                              {amount ? amount + " · " : ""}
                              {displayTime(dose.scheduled_time)}
                            </T>
                          </View>
                          <Chip
                            label={
                              done
                                ? dose.confirmation_source === "patient"
                                  ? "Reported taken"
                                  : "Source unknown"
                                : skipped
                                  ? "Skipped"
                                  : unsure
                                    ? "Unsure"
                                    : dose.time_until === "Overdue"
                                      ? "To review"
                                      : "Upcoming"
                            }
                            tone={
                              reported
                                ? "green"
                                : !unsure && dose.time_until === "Overdue"
                                  ? "amber"
                                  : "neutral"
                            }
                          />
                        </Row>
                        {unsure && (
                          <T variant="small" color={C.muted}>
                            You recorded that you’re unsure. Intake remains
                            unknown.
                          </T>
                        )}
                        {done ? (
                          <T variant="small" color={C.muted}>
                            {dose.confirmation_source === "patient"
                              ? "Recorded by you"
                              : "Previously recorded — source unavailable"}
                            {dose.taken_at
                              ? " at " +
                                new Date(dose.taken_at).toLocaleTimeString(
                                  "en-GB",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : ""}
                            .
                          </T>
                        ) : skipped ? (
                          <T variant="small" color={C.muted}>
                            {doseReason(dose.notes) || "Recorded as skipped."}
                            {personalDoseNote(dose.notes)
                              ? " · " + personalDoseNote(dose.notes)
                              : ""}
                          </T>
                        ) : (
                          <Row
                            style={{
                              justifyContent: "flex-end",
                              flexWrap: "wrap",
                            }}
                          >
                            <Button
                              small
                              variant="ghost"
                              label="Record as skipped"
                              disabled={!!acting}
                              onPress={() =>
                                setEditing({ ...dose, status: "skipped" })
                              }
                            />
                            <Button
                              small
                              label="I took this"
                              icon="checkmark"
                              loading={acting === dose.schedule_id}
                              disabled={!!acting && acting !== dose.schedule_id}
                              onPress={() => void confirm(dose.schedule_id)}
                            />
                          </Row>
                        )}
                        {(done || skipped || dose.status === "missed") && (
                          <Button
                            small
                            variant="ghost"
                            label="Edit entry"
                            disabled={!!acting}
                            style={{ alignSelf: "flex-start" }}
                            onPress={() => setEditing(dose)}
                          />
                        )}
                      </View>
                    );
                  })
                )}
              </Card>
              {doses.length > 0 && (
                <T variant="small" color={C.muted}>
                  Only confirm doses you actually took. If you’re unsure about a
                  missed dose, follow your prescription or ask your clinician.
                </T>
              )}
            </View>
            <View style={{ flex: wide ? 1 : undefined, gap: 20 }}>
              <Card>
                <Row style={{ justifyContent: "space-between" }}>
                  <T variant="h3">Your week, at a glance</T>
                  <Ionicons name="calendar-outline" size={19} color={C.muted} />
                </Row>
                <Row style={{ alignItems: "baseline", gap: 8 }}>
                  <T variant="display">
                    {data?.report.total ? data.report.percent + "%" : "—"}
                  </T>
                  <T variant="small" color={C.muted}>
                    reported taken
                  </T>
                </Row>
                <View
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: C.bg,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 7,
                      width: (Math.min(100, data?.report.percent ?? 0) +
                        "%") as `${number}%`,
                      backgroundColor: C.accent,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <T variant="small" color={C.muted}>
                  {data?.report.total
                    ? data.report.reportedTaken +
                      " reported taken · " +
                      data.report.total +
                      " doses due or recorded this week"
                    : "Your history will appear as you build your routine."}
                </T>
                {data && data.report.total > 0 && (
                  <T variant="small" color={C.muted}>
                    {data.report.skipped} skipped · {data.report.missed}{" "}
                    recorded missed · {data.report.unknown} unknown. Based on
                    your records, not verified ingestion.
                  </T>
                )}
                <Button
                  small
                  variant="ghost"
                  label="See your summary"
                  onPress={() => go("/reports")}
                />
              </Card>
              <Card style={{ backgroundColor: C.white }}>
                <Row style={{ alignItems: "center", gap: 12 }}>
                  <Companion kind="assistant" size={72} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <T variant="h3">A question on your mind?</T>
                    <T variant="small" color={C.muted}>
                      A little clarity for your everyday.
                    </T>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="Open your assistant"
                      onPress={() => go("/ai")}
                      style={{ paddingVertical: 7 }}
                    >
                      <Row style={{ gap: 5 }}>
                        <T
                          variant="small"
                          color={C.primary}
                          style={{ fontFamily: "Inter_600SemiBold" }}
                        >
                          Ask your assistant
                        </T>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={C.primary}
                        />
                      </Row>
                    </Pressable>
                  </View>
                </Row>
              </Card>
              <Row style={{ paddingHorizontal: 6, alignItems: "flex-start" }}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={C.muted}
                />
                <T variant="small" color={C.muted} style={{ flex: 1 }}>
                  Your entries help tell your care story. They don’t replace
                  medical advice.
                </T>
              </Row>
            </View>
          </View>
        </View>
      )}
      {editing && (
        <DoseReportSheet
          dose={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void Promise.all([refresh(), refreshCare(), refreshUnread()]).catch(
              () =>
                setActionError(
                  "Your entry was saved. Refresh your plan to see the latest record.",
                ),
            );
          }}
        />
      )}
    </Screen>
  );
}
