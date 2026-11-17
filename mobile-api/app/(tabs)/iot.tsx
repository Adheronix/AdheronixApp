import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
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
} from "../../components/ui";
import { useResource } from "../../hooks/use-resource";
import { smartboxService } from "../../services/smartbox.service";
import { boxConnection } from "../../services/character-state";

export default function PillBox() {
  const { data, loading, error, refresh } = useResource(
    useCallback(() => smartboxService.getDevices(), []),
  );
  const [now, setNow] = useState(Date.now());
  const focused = useIsFocused();
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const clock = setInterval(() => setNow(Date.now()), 5_000);
      const poll = setInterval(() => void refresh(), 15_000);
      return () => {
        clearInterval(clock);
        clearInterval(poll);
      };
    }, [refresh]),
  );

  return (
    <Screen>
      <PageTitle
        eyebrow="YOUR MEDIBOX COMPANION"
        title="A little box. Extra support."
        body="Your medication routine, with a little connection."
        action={
          <Button
            variant="secondary"
            small
            icon="refresh-outline"
            label="Refresh activity"
            loading={loading}
            onPress={() => {
              setNow(Date.now());
              void refresh();
            }}
          />
        }
      />
      {error && <Notice error message={error} />}
      <View style={{ gap: 22 }}>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <Companion kind="box" size={200} active={focused} />
            <Chip label="No box linked" />
            <T variant="h2" style={{ textAlign: "center" }}>
              Meet your MediBox companion.
            </T>
            <T color={C.muted} style={{ textAlign: "center" }}>
              When your care team links a box to your account, its light will
              follow real device activity here.
            </T>
            <T variant="small" color={C.muted} style={{ textAlign: "center" }}>
              Your plan and dose confirmations work with or without a box.
            </T>
          </Card>
        ) : (
          data.map((device) => {
            const reading = device.latestWeight;
            const last =
              reading.reportedAt &&
              Number.isFinite(Date.parse(reading.reportedAt))
                ? new Date(reading.reportedAt)
                : null;
            const connection = boxConnection(device, now);
            const connected = connection === "online";
            return (
              <Card key={device.deviceId} style={{ padding: 24 }}>
                <View
                  style={{ alignItems: "center", gap: 10, paddingBottom: 8 }}
                >
                  <Companion
                    kind="box"
                    size={205}
                    connected={connected}
                    active={focused}
                  />
                  <Row style={{ gap: 7 }}>
                    <Ionicons
                      name={
                        connected
                          ? "wifi"
                          : connection === "offline"
                            ? "cloud-offline-outline"
                            : "hourglass-outline"
                      }
                      size={16}
                      color={connected ? C.success : C.muted}
                    />
                    <Chip
                      tone={connected ? "green" : "neutral"}
                      label={
                        connected
                          ? "Connected · recent signal"
                          : connection === "offline"
                            ? "Offline · no recent signal"
                            : "Waiting for first signal"
                      }
                    />
                  </Row>
                  <T variant="h2">
                    {connected
                      ? "Your MediBox is here."
                      : connection === "offline"
                        ? "Your MediBox is resting."
                        : "Ready when your box is."}
                  </T>
                  <T
                    variant="small"
                    color={C.muted}
                    style={{ textAlign: "center" }}
                  >
                    {connected
                      ? "A signal arrived in the last 2 minutes. The light updates as new readings arrive."
                      : connection === "offline"
                        ? "No signal in the last 2 minutes. Check the box’s power and network connection."
                        : "Your box is linked. Its light will turn on after a recent device signal."}
                  </T>
                  <T variant="small" color={C.muted}>
                    {device.deviceId}
                  </T>
                </View>
                <Row
                  style={{
                    flexWrap: "wrap",
                    gap: 32,
                    paddingVertical: 20,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: C.line,
                  }}
                >
                  <View style={{ gap: 5 }}>
                    <T variant="label" color={C.muted}>
                      LAST WEIGHT
                    </T>
                    <T variant="h1">
                      {typeof reading.weightG === "number"
                        ? reading.weightG.toFixed(1) + " g"
                        : "—"}
                    </T>
                    <T variant="small" color={C.muted}>
                      Reported by your box
                    </T>
                  </View>
                  <View style={{ gap: 5 }}>
                    <T variant="label" color={C.muted}>
                      ESTIMATED PILLS
                    </T>
                    <T variant="h1">{reading.pillsEst ?? "—"}</T>
                    <T variant="small" color={C.muted}>
                      An estimate, not a confirmed count
                    </T>
                  </View>
                  <View style={{ gap: 5 }}>
                    <T variant="label" color={C.muted}>
                      LAST SEEN
                    </T>
                    <T variant="h3">
                      {last
                        ? last.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not yet"}
                    </T>
                    <T variant="small" color={C.muted}>
                      {last
                        ? last.toLocaleDateString("en-GB")
                        : "Your next reading will appear here"}
                    </T>
                  </View>
                </Row>
                {device.latestEvent ? (
                  <View style={{ gap: 8 }}>
                    <T variant="h3">Latest device activity</T>
                    <T color={C.muted}>
                      {device.latestEvent.medicine ||
                        "Medication compartment activity"}{" "}
                      ·{" "}
                      {device.latestEvent.timestamp
                        ? new Date(device.latestEvent.timestamp).toLocaleString(
                            "en-GB",
                          )
                        : ""}
                    </T>
                    <Chip
                      label={
                        device.latestEvent.status === "removal_detected"
                          ? "Removal detected · not intake confirmation"
                          : "Activity needs review"
                      }
                      tone="amber"
                    />
                  </View>
                ) : (
                  <T color={C.muted}>
                    No removal events have been recorded for this box.
                  </T>
                )}
              </Card>
            );
          })
        )}
        <Notice message="The connection light reflects recent device signals. A pill box can detect activity or a weight change; it cannot confirm that you swallowed medication. Only confirm doses you actually took." />
        <Card style={{ backgroundColor: C.pale }}>
          <Row style={{ alignItems: "flex-start" }}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color={C.primary}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <T variant="h3">A clearer picture, together</T>
              <T color={C.muted}>
                Your box’s observations stay separate from your own
                confirmations. Your care companion responds to the doses you
                record yourself.
              </T>
            </View>
          </Row>
        </Card>
      </View>
    </Screen>
  );
}
