import { useCallback, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  C,
  Card,
  Chip,
  ConfirmDialog,
  Empty,
  Field,
  Loading,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
  go,
} from "../../components/ui";
import { useResource } from "../../hooks/use-resource";
import { medicationService } from "../../services/medication.service";
import {
  Medication,
  displayTime,
  dosage,
  medicationName,
} from "../../services/types";
import { errorMessage } from "../../services/api";
export default function Medications() {
  const { data, loading, error, refresh } = useResource(
    useCallback(() => medicationService.getAll(), []),
  );
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Medication | null>(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const list = (data ?? []).filter((m) =>
    medicationName(m).toLowerCase().includes(query.toLowerCase()),
  );
  async function remove() {
    if (!selected) return;
    setBusy(true);
    try {
      await medicationService.delete(selected.medication_id);
      setSelected(null);
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <PageTitle
        eyebrow="YOUR ROUTINE, IN ONE PLACE"
        title="My medications"
        body="The details that make your daily plan yours."
        action={
          <Button
            label="Add medication"
            icon="add"
            onPress={() => go("/add-medication")}
          />
        }
      />
      <View style={{ maxWidth: 420, marginBottom: 24 }}>
        <Field
          label="Find a medication"
          placeholder="Search your medication list"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {(error || actionError) && (
        <Notice error message={error || actionError} />
      )}
      <Row style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <T variant="h3">Your medication list</T>
        <Chip label={(data?.length ?? 0) + " medications"} />
      </Row>
      {loading && !data ? (
        <Loading />
      ) : !list.length ? (
        <Card>
          <Empty
            icon="medical-outline"
            title={query ? "No matches yet" : "Let’s build your routine"}
            body={
              query
                ? "Try a different medication name."
                : "Add a medication from your prescription. Your daily plan will keep the details close."
            }
            action={
              !query ? (
                <Button
                  label="Add your first medication"
                  onPress={() => go("/add-medication")}
                  icon="add"
                />
              ) : undefined
            }
          />
        </Card>
      ) : (
        <View style={{ gap: 16 }}>
          {list.map((m) => {
            const times = [
              ...new Set(
                m.schedules?.map((s) => s.scheduled_time.slice(0, 5)) ?? [],
              ),
            ].sort();
            return (
              <Card key={m.medication_id}>
                <Row style={{ alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 47,
                      height: 47,
                      borderRadius: 15,
                      backgroundColor: C.mint,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="medical-outline"
                      size={23}
                      color={C.primary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="h2">{medicationName(m)}</T>
                    <T color={C.muted}>{dosage(m)}</T>
                  </View>
                  <Chip
                    label={
                      m.source === "patient"
                        ? "Added by you"
                        : "Imported record"
                    }
                  />
                </Row>
                <Row style={{ flexWrap: "wrap", gap: 10 }}>
                  <Chip
                    label={
                      m.frequency +
                      " " +
                      (m.frequency === 1 ? "time" : "times") +
                      " daily"
                    }
                    tone="green"
                  />
                  <Chip label={m.period} />
                  {times.map((t) => (
                    <Chip key={t} label={displayTime(t)} />
                  ))}
                </Row>
                <T color={C.muted}>{m.intake_recommendation}</T>
                <Row
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: C.line,
                    paddingTop: 13,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    small
                    variant="ghost"
                    icon="trash-outline"
                    label="Remove record"
                    onPress={() => setSelected(m)}
                  />
                  <Button
                    small
                    variant="secondary"
                    icon="time-outline"
                    label={
                      times.length ? "Manage schedule" : "Set medication times"
                    }
                    onPress={() => go("/add-medication?id=" + m.medication_id)}
                  />
                </Row>
              </Card>
            );
          })}
        </View>
      )}
      <View style={{ marginTop: 22 }}>
        <Notice message="Keep your list aligned with your prescription. Editing an app record does not change your clinician’s treatment instructions." />
      </View>
      <ConfirmDialog
        visible={!!selected}
        title="Remove this app record?"
        body="This removes the medication and its reminders from Adheronix. It does not change your prescribed treatment."
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}
