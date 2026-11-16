import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  C,
  Card,
  Chip,
  Empty,
  Loading,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
} from "../components/ui";
import { notificationService } from "../services/notification.service";
import { useResource } from "../hooks/use-resource";
import { useSession } from "../components/session";
import { errorMessage } from "../services/api";
export default function Notifications() {
  const { refreshUnread } = useSession();
  const { data, loading, error, refresh } = useResource(
    useCallback(() => notificationService.list(), []),
  );
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const inbox = (data ?? []).filter((n) => n.status !== "pending");
  const scheduled = (data ?? []).filter(
    (n) =>
      n.status === "pending" &&
      n.scheduled_for &&
      new Date(n.scheduled_for) > new Date(),
  );
  async function read(id?: string) {
    setBusy(true);
    try {
      if (id) await notificationService.markRead(id);
      else await notificationService.markAllAsRead();
      await refresh();
      await refreshUnread();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen back>
      <PageTitle
        eyebrow="SMALL UPDATES, ALL TOGETHER"
        title="Your inbox"
        body="Reminders and updates from your care space."
        action={
          <Button
            small
            variant="secondary"
            icon="checkmark-done-outline"
            label="Mark all as read"
            loading={busy}
            disabled={!inbox.some((n) => !n.read_at)}
            onPress={() => void read()}
          />
        }
      />
      {(error || actionError) && (
        <Notice message={error || actionError} error />
      )}
      {loading && !data ? (
        <Loading />
      ) : (
        <View style={{ gap: 22 }}>
          <Card style={{ padding: 0, gap: 0 }}>
            {!inbox.length ? (
              <Empty
                icon="notifications-outline"
                title="A quiet moment"
                body="There are no updates in your inbox. Medication reminders will appear here when they are due."
              />
            ) : (
              inbox.map((n, i) => (
                <Pressable
                  key={n.notification_id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    n.title + (n.read_at ? ", read" : ", unread")
                  }
                  onPress={() => {
                    if (!n.read_at) void read(n.notification_id);
                  }}
                  style={({ pressed }) => ({
                    padding: 22,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: C.line,
                    backgroundColor: pressed
                      ? C.pale
                      : n.read_at
                        ? C.white
                        : "#FAFCF8",
                    gap: 9,
                  })}
                >
                  <Row style={{ alignItems: "flex-start" }}>
                    <View
                      style={{
                        width: 37,
                        height: 37,
                        borderRadius: 12,
                        backgroundColor: C.mint,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          n.type === "medication_reminder"
                            ? "time-outline"
                            : "leaf-outline"
                        }
                        color={C.primary}
                        size={19}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Row
                        style={{
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <T variant="h3" style={{ flex: 1 }}>
                          {n.title}
                        </T>
                        {!n.read_at && (
                          <View
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: C.primary,
                              marginTop: 7,
                            }}
                          />
                        )}
                      </Row>
                      <T color={C.muted}>{n.message}</T>
                      <T variant="small" color={C.muted}>
                        {new Date(n.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </T>
                    </View>
                  </Row>
                </Pressable>
              ))
            )}
          </Card>
          {scheduled.length > 0 && (
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <T variant="h3">Coming up</T>
                <Chip label={scheduled.length + " scheduled"} />
              </Row>
              {scheduled.slice(0, 3).map((n) => (
                <Row
                  key={n.notification_id}
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <T color={C.muted} style={{ flex: 1 }}>
                    {n.title}
                  </T>
                  <T variant="small" color={C.muted}>
                    {new Date(n.scheduled_for!).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </T>
                </Row>
              ))}
              <T variant="small" color={C.muted}>
                These reminders are scheduled. They have not been sent yet.
              </T>
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
