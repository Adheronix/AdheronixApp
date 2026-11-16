import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  go,
} from "../../components/ui";
import { useSession } from "../../components/session";
import { useResource } from "../../hooks/use-resource";
import { scheduleService } from "../../services/schedule.service";
import { displayTime, medicationName } from "../../services/types";
import { routineState } from "../../services/character-state";
import { errorMessage } from "../../services/api";
const load = async () => {
  const [doses, adherence] = await Promise.all([
    scheduleService.getUpcoming(),
    scheduleService.getAdherence(),
  ]);
  return { doses, adherence };
};
export default function Home() {
  const { user, refreshUnread } = useSession();
  const { data, loading, error, refresh } = useResource(load);
  const [acting, setActing] = useState(""),
    [actionError, setActionError] = useState("");
  const wide = useWindowDimensions().width >= 1180;
  const doses = data?.doses ?? [],
    taken = routineState(doses).confirmed,
    total = doses.length;
  const routine = routineState(doses);
  const percent = total ? Math.round((taken / total) * 100) : 0;
  async function confirm(id: string, status: "taken" | "skipped") {
    setActing(id);
    setActionError("");
    try {
      await scheduleService.updateStatus(
        id,
        status,
        status === "taken"
          ? "Confirmed by patient in Adheronix"
          : "Patient recorded this dose as skipped",
      );
      await refresh();
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
        eyebrow="A LITTLE SUPPORT, EVERY DAY"
        title={"Hello, " + (user?.full_names?.split(" ")[0] || "there") + "."}
        body="Let’s make room for a steadier day."
        action={
          <Button
            variant="secondary"
            small
            icon="add"
            label="Add medication"
            onPress={() => go("/add-medication")}
          />
        }
      />
      {error && <Notice message={error} error />}
      {actionError && <Notice message={actionError} error />}
      {loading && !data ? (
        <Loading />
      ) : (
        <View style={{ gap: 24 }}>
          <View
            style={{
              backgroundColor: C.ink,
              borderRadius: 28,
              padding: wide ? 30 : 22,
              overflow: "hidden",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
            }}
          >
            <View style={{ flex: 1, gap: 10 }}>
              <T variant="label" color="#A5E6D7">
                ONE DAY AT A TIME
              </T>
              <T variant="h2" color={C.white}>
                {total
                  ? taken +
                    " of " +
                    total +
                    (total === 1 ? " dose confirmed." : " doses confirmed.")
                  : "Your routine starts here."}
              </T>
              <T color="#C2D5E0" style={{ maxWidth: 460 }}>
                {total
                  ? routine.message
                  : "Add the medications you’ve been prescribed, then choose the times that fit your prescription."}
              </T>
              <Pressable
                accessibilityRole="link"
                onPress={() => go("/reports")}
                style={{ alignSelf: "flex-start", paddingVertical: 6 }}
              >
                <Row style={{ gap: 6 }}>
                  <T
                    variant="small"
                    color="#B6EDDF"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    Your care summary
                  </T>
                  <Ionicons name="arrow-forward" size={15} color="#B6EDDF" />
                </Row>
              </Pressable>
            </View>
            <View
              style={{ width: 100, alignItems: "center", alignSelf: "center" }}
            >
              <Companion
                size={130}
                mood={routine.mood}
                style={{ marginRight: -8 }}
              />
              <T variant="small" color="#A5E6D7">
                {total ? percent + "% confirmed" : "Here for you"}
              </T>
            </View>
          </View>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <View style={{ flex: wide ? 1.8 : undefined, gap: 18 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <T variant="h2">Today’s medication</T>
                <Chip
                  label={new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                />
              </Row>
              <Card style={{ padding: 0, gap: 0 }}>
                {!doses.length ? (
                  <Empty
                    icon="medical-outline"
                    title="A clearer day starts with a plan"
                    body="Add your prescribed medication and its scheduled times. You can use Adheronix with or without a pill box."
                    action={
                      <Button
                        label="Add your first medication"
                        icon="add"
                        onPress={() => go("/add-medication")}
                      />
                    }
                  />
                ) : (
                  doses.map((dose, i) => {
                    const done = dose.status === "taken",
                      skipped = dose.status === "skipped";
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
                              backgroundColor: done ? C.mint : C.bg,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons
                              name={done ? "checkmark" : "medical-outline"}
                              size={21}
                              color={done ? C.primary : C.muted}
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
                                  ? "Confirmed"
                                  : "Recorded"
                                : skipped
                                  ? "Skipped"
                                  : dose.time_until === "Overdue"
                                    ? "To review"
                                    : "Upcoming"
                            }
                            tone={
                              done
                                ? "green"
                                : dose.time_until === "Overdue"
                                  ? "amber"
                                  : "neutral"
                            }
                          />
                        </Row>
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
                            Recorded as skipped. Follow your clinician’s
                            instructions about missed doses.
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
                                void confirm(dose.schedule_id, "skipped")
                              }
                            />
                            <Button
                              small
                              label="I took this"
                              icon="checkmark"
                              loading={acting === dose.schedule_id}
                              disabled={!!acting && acting !== dose.schedule_id}
                              onPress={() =>
                                void confirm(dose.schedule_id, "taken")
                              }
                            />
                          </Row>
                        )}
                      </View>
                    );
                  })
                )}
              </Card>
              <T variant="small" color={C.muted}>
                Only confirm doses you actually took. If you’re unsure about a
                missed dose, follow your prescription or ask your clinician.
              </T>
            </View>
            <View style={{ flex: wide ? 1 : undefined, gap: 20 }}>
              <Card>
                <Row style={{ justifyContent: "space-between" }}>
                  <T variant="h3">Your week, at a glance</T>
                  <Ionicons name="calendar-outline" size={19} color={C.muted} />
                </Row>
                <Row style={{ alignItems: "baseline", gap: 8 }}>
                  <T variant="display">
                    {data?.adherence.total_scheduled
                      ? data.adherence.adherence_rate + "%"
                      : "—"}
                  </T>
                  <T variant="small" color={C.muted}>
                    recorded as taken
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
                      width: (Math.min(
                        100,
                        data?.adherence.adherence_rate ?? 0,
                      ) + "%") as `${number}%`,
                      backgroundColor: C.accent,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <T variant="small" color={C.muted}>
                  {data?.adherence.total_scheduled
                    ? data.adherence.taken +
                      " recorded taken · " +
                      data.adherence.total_scheduled +
                      " scheduled in this period"
                    : "Your history will appear as you build your routine."}
                </T>
                <Button
                  small
                  variant="ghost"
                  label="See your summary"
                  onPress={() => go("/reports")}
                />
              </Card>
              <Card style={{ backgroundColor: C.pale, borderColor: C.line }}>
                <Companion kind="assistant" size={76} />
                <T variant="h3">A question on your mind?</T>
                <T color={C.muted}>
                  Find a little clarity about your routine with your Adheronix
                  assistant.
                </T>
                <Button
                  small
                  variant="secondary"
                  label="Ask your assistant"
                  icon="arrow-forward"
                  onPress={() => go("/ai")}
                />
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
    </Screen>
  );
}
