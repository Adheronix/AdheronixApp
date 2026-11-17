import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  C,
  Card,
  Field,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
  go,
} from "../components/ui";
import { medicationService } from "../services/medication.service";
import { scheduleService } from "../services/schedule.service";
import { dosage, localDate, medicationName } from "../services/types";
import { errorMessage } from "../services/api";
import { clearScanDraft, getScanDraft } from "../services/scan-draft";
import { useSession } from "../components/session";
export default function AddMedication() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const draft = getScanDraft();
  const { refreshUnread } = useSession();
  const [name, setName] = useState(draft?.name ?? ""),
    [dose, setDose] = useState(draft?.dose ?? ""),
    [instruction, setInstruction] = useState(draft?.instruction ?? ""),
    [frequency, setFrequency] = useState(String(draft?.frequency ?? 1)),
    [days, setDays] = useState(draft?.period?.match(/^(\d+)/)?.[1] ?? "30"),
    [times, setTimes] = useState("08:00"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [savedId, setSavedId] = useState(id ?? "");
  useEffect(() => {
    if (!id) return;
    let active = true;
    void medicationService
      .getById(id)
      .then((m) => {
        if (!active) return;
        setName(medicationName(m));
        setDose(dosage(m));
        setInstruction(m.intake_recommendation);
        setFrequency(String(m.frequency));
        setDays(m.period.match(/^(\d+)/)?.[1] ?? "7");
        setTimes(
          [
            ...new Set(
              m.schedules
                ?.filter(
                  (s) =>
                    s.status === "pending" && s.scheduled_date >= localDate(),
                )
                .map((s) => s.scheduled_time.slice(0, 5)) ?? [],
            ),
          ]
            .sort()
            .join(", "),
        );
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);
  async function save() {
    setError("");
    const count = Number(frequency),
      duration = Number(days),
      slots = times.split(",").map((t) => t.trim());
    if (!name.trim() || !dose.trim() || !instruction.trim()) {
      setError("Add the medication name, prescribed dose, and instructions.");
      return;
    }
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 24 ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 90
    ) {
      setError(
        "Use 1–24 daily times and a planning period between 1 and 90 days.",
      );
      return;
    }
    if (
      slots.length !== count ||
      new Set(slots).size !== slots.length ||
      slots.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    ) {
      setError("Choose one unique 24-hour time for each daily dose.");
      return;
    }
    setBusy(true);
    let medicationId = savedId;
    try {
      const body = {
        prescription: { name: name.trim(), dose: dose.trim() },
        intake_recommendation: instruction.trim(),
        period: duration + " days",
        source: "patient",
        frequency: count,
      };
      if (!medicationId) {
        const med = await medicationService.create(body);
        medicationId = med.medication_id;
        setSavedId(medicationId);
      } else await medicationService.update(medicationId, body);
      await scheduleService.create(medicationId, slots);
      clearScanDraft();
      await refreshUnread();
      router.replace("/meds");
    } catch (e) {
      setError(
        (medicationId
          ? "Your medication record is saved, but its schedule needs attention. "
          : "") + errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen back>
      <View style={{ maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <PageTitle
          eyebrow="BUILD A ROUTINE THAT FITS"
          title={id ? "Your medication schedule" : "Add a medication"}
          body="Use the details on your prescription. Adheronix helps you organize them, not choose your treatment."
          action={
            !id ? (
              <Button
                variant="secondary"
                small
                icon="qr-code-outline"
                label="Scan a QR"
                onPress={() => go("/scan")}
              />
            ) : undefined
          }
        />
        {error && (
          <View style={{ marginBottom: 18 }}>
            <Notice message={error} error />
          </View>
        )}
        <Card style={{ gap: 21 }}>
          <Row>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                backgroundColor: C.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T variant="small" color={C.primary}>
                01
              </T>
            </View>
            <T variant="h3">Your prescription</T>
          </Row>
          <Field
            label="Medication name"
            placeholder="As written on your prescription"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Prescribed dose"
            placeholder="Copy the dose from your prescription"
            value={dose}
            onChangeText={setDose}
          />
          <Field
            label="Your clinician’s instructions"
            placeholder="For example, the instructions on your label"
            value={instruction}
            onChangeText={setInstruction}
            multiline
          />
          <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Field
                label="Times per day"
                value={frequency}
                onChangeText={(value) => {
                  setFrequency(value);
                  const count = Number(value);
                  if (Number.isInteger(count) && count >= 1 && count <= 24) {
                    const slots = times.split(",");
                    while (slots.length < count) slots.push("");
                    setTimes(slots.slice(0, count).join(","));
                  }
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Field
                label="Days to plan"
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
                hint="Up to 90 days. Match your prescription."
              />
            </View>
          </Row>
          <View style={{ height: 1, backgroundColor: C.line }} />
          <Row>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                backgroundColor: C.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T variant="small" color={C.primary}>
                02
              </T>
            </View>
            <T variant="h3">Make room in your day</T>
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {Array.from(
              { length: Math.min(24, Math.max(1, Number(frequency) || 1)) },
              (_, i) => (
                <View key={i} style={{ width: "46%", minWidth: 115 }}>
                  <Field
                    label={"Dose " + (i + 1) + " time"}
                    placeholder="HH:MM"
                    value={times.split(",")[i]?.trim() ?? ""}
                    onChangeText={(value) => {
                      const slots = times.split(",");
                      while (slots.length < Number(frequency)) slots.push("");
                      slots[i] = value;
                      setTimes(slots.slice(0, Number(frequency)).join(","));
                    }}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              ),
            )}
          </View>
          <T variant="small" color={C.muted}>
            Use 24-hour times, for example 08:00 or 20:00. Your reminders follow
            Kigali time (CAT).
          </T>
          <Notice message="Updating a schedule replaces future unconfirmed reminders. Your previously recorded doses stay in your history." />
          <Row style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                clearScanDraft();
                go("/meds");
              }}
            />
            <Button
              label={id ? "Save schedule" : "Save medication & schedule"}
              icon="checkmark"
              loading={busy}
              onPress={() => void save()}
            />
          </Row>
        </Card>
      </View>
    </Screen>
  );
}
