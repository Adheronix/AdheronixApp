import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, C, Card, Field, Notice, Row, T } from "./ui";
import { errorMessage } from "../services/api";
import { scheduleService } from "../services/schedule.service";
import {
  buildDoseNote,
  doseReason,
  personalDoseNote,
  ReportStatus,
  SKIP_REASONS,
} from "../services/dose-reporting";
import { displayTime, Dose, medicationName } from "../services/types";

export function DoseReportSheet({
  dose,
  onClose,
  onSaved,
}: {
  dose: Dose;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ReportStatus>(
    dose.status === "pending"
      ? "pending"
      : dose.status === "taken"
        ? "taken"
        : "skipped",
  );
  const [reason, setReason] = useState<string>(doseReason(dose.notes));
  const [note, setNote] = useState(personalDoseNote(dose.notes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const help =
    status === "skipped"
      ? SKIP_REASONS.find((r) => r.label === reason)?.help
      : undefined;
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await scheduleService.updateStatus(
        dose.schedule_id,
        status,
        buildDoseNote(status, reason, note),
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: "#15374E66",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "100%",
            padding: 0,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 22, gap: 16 }}
          >
            <View style={{ gap: 5 }}>
              <T variant="h2">Your dose record</T>
              <T color={C.muted}>
                {medicationName(dose.medication ?? dose.prescription)} ·{" "}
                {displayTime(dose.scheduled_time)}
              </T>
              <T variant="small" color={C.muted}>
                Record what happened, at your own pace.
              </T>
            </View>
            <Row style={{ flexWrap: "wrap", gap: 8 }}>
              {(
                [
                  { value: "taken", label: "Taken" },
                  { value: "skipped", label: "Skipped" },
                  { value: "pending", label: "Unsure" },
                ] as const
              ).map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{
                    checked: status === option.value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => setStatus(option.value)}
                  style={{
                    paddingHorizontal: 15,
                    paddingVertical: 11,
                    borderRadius: 14,
                    backgroundColor: status === option.value ? C.mint : C.bg,
                    borderWidth: 1,
                    borderColor: status === option.value ? C.primary : C.line,
                  }}
                >
                  <T
                    variant="small"
                    color={status === option.value ? C.primary : C.ink}
                  >
                    {option.label}
                  </T>
                </Pressable>
              ))}
            </Row>
            {status === "skipped" && (
              <View style={{ gap: 10 }}>
                <T variant="h3">Anything you’d like to note?</T>
                <T variant="small" color={C.muted}>
                  Optional. You can save without choosing a reason.
                </T>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {SKIP_REASONS.map((option) => (
                    <Pressable
                      key={option.label}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{
                        selected: reason === option.label,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() =>
                        setReason(reason === option.label ? "" : option.label)
                      }
                      style={{
                        paddingHorizontal: 13,
                        paddingVertical: 11,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor:
                          reason === option.label ? C.primary : C.line,
                        backgroundColor:
                          reason === option.label ? C.mint : C.white,
                      }}
                    >
                      <T
                        variant="small"
                        color={reason === option.label ? C.primary : C.ink}
                      >
                        {option.label}
                      </T>
                    </Pressable>
                  ))}
                </View>
                {help && (
                  <T variant="small" color={C.muted}>
                    {help}
                  </T>
                )}
              </View>
            )}
            {status === "pending" && (
              <T variant="small" color={C.muted}>
                This entry will stay unknown. Changing a record is not an
                instruction to take another dose.
              </T>
            )}
            <Field
              label="Personal note (optional)"
              value={note}
              onChangeText={setNote}
              editable={!busy}
              maxLength={1000}
              multiline
              placeholder="Anything you want to remember or discuss"
            />
            <T variant="small" color={C.muted}>
              Saved to your record. Nobody is contacted automatically. Notes
              appear in summaries you choose to share.
            </T>
            {error && <Notice message={error} error />}
            <Row style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button
                label="Cancel"
                variant="ghost"
                disabled={busy}
                onPress={onClose}
              />
              <Button
                label="Save entry"
                loading={busy}
                onPress={() => void save()}
              />
            </Row>
          </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}
