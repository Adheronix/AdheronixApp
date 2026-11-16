import { useEffect, useState } from "react";
import { Switch, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  C,
  Card,
  Chip,
  Field,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
} from "../../components/ui";
import { useSession } from "../../components/session";
import { authService } from "../../services/auth.service";
import { errorMessage } from "../../services/api";
export default function Settings() {
  const { user, refresh, logout } = useSession();
  const wide = useWindowDimensions().width >= 1180;
  const [name, setName] = useState(""),
    [age, setAge] = useState(""),
    [conditions, setConditions] = useState(""),
    [allergies, setAllergies] = useState(""),
    [contact, setContact] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.full_names ?? "");
      setAge(user.age ? String(user.age) : "");
      setConditions(user.conditions ?? "");
      setAllergies(user.allergies ?? "");
      setContact(user.emergency_contact_name ?? "");
      setPhone(user.emergency_contact_phone ?? "");
    }
  }, [user]);
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        age &&
        (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 130)
      )
        throw new Error("Enter an age between 0 and 130.");
      await authService.updateProfile({
        full_names: name,
        age: age ? Number(age) : null,
        conditions,
        allergies,
        emergency_contact_name: contact,
        emergency_contact_phone: phone,
      });
      await refresh();
      setMessage("Your profile has been saved.");
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith("Enter an age")
          ? e.message
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function push(value: boolean) {
    setError("");
    try {
      await authService.updateProfile({ push_notifications_enabled: value });
      await refresh();
      setMessage("Your reminder preference has been saved.");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Screen>
      <PageTitle
        eyebrow="CARE, ON YOUR TERMS"
        title="Your profile & preferences"
        body="Keep the details that matter close, and make this space yours."
      />
      {error && <Notice message={error} error />}
      {message && <Notice message={message} />}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          marginTop: 18,
        }}
      >
        <View style={{ flex: wide ? 1.6 : undefined, gap: 22 }}>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="h2">About you</T>
              <Chip
                label={
                  user?.username.startsWith("preview_")
                    ? "Preview profile"
                    : "Personal profile"
                }
              />
            </Row>
            <Field label="Full name" value={name} onChangeText={setName} />
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ flex: 2, minWidth: 180 }}>
                <Field
                  label="Email address"
                  value={user?.email ?? ""}
                  editable={false}
                  hint="Your sign-in email"
                />
              </View>
              <View style={{ flex: 1, minWidth: 110 }}>
                <Field
                  label="Age (optional)"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
              </View>
            </Row>
            <Field
              label="Conditions you manage (optional)"
              value={conditions}
              onChangeText={setConditions}
              multiline
              placeholder="The details you want in your care record"
            />
            <Field
              label="Allergies (optional)"
              value={allergies}
              onChangeText={setAllergies}
              placeholder="Known allergies, if any"
            />
            <View
              style={{ height: 1, backgroundColor: C.line, marginVertical: 5 }}
            />
            <T variant="h3">Your emergency contact</T>
            <T variant="small" color={C.muted}>
              These details stay in your profile. Saving them does not contact
              anyone or share access to your health records.
            </T>
            <Field
              label="Contact name"
              value={contact}
              onChangeText={setContact}
              placeholder="Full name"
            />
            <Field
              label="Contact phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone number"
            />
            <Row style={{ justifyContent: "flex-end" }}>
              <Button
                label="Save profile"
                icon="checkmark"
                loading={busy}
                onPress={() => void save()}
              />
            </Row>
          </Card>
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 22 }}>
          <Card>
            <T variant="h3">Your reminders</T>
            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1, gap: 6, paddingRight: 10 }}>
                <T style={{ fontFamily: "Inter_500Medium" }}>Push reminders</T>
                <T variant="small" color={C.muted}>
                  Your preference is saved to your account. Delivery requires
                  notification permission in the native mobile app.
                </T>
              </View>
              <Switch
                accessibilityLabel="Push reminder preference"
                value={user?.push_notifications_enabled ?? false}
                onValueChange={(value) => void push(value)}
                trackColor={{ false: C.line, true: "#82AB92" }}
                thumbColor={C.white}
              />
            </Row>
            <View style={{ height: 1, backgroundColor: C.line }} />
            <T variant="small" color={C.muted}>
              In-app notifications are available in your inbox. Email reminders
              are not available yet.
            </T>
          </Card>
          <Card style={{ backgroundColor: C.pale }}>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={C.primary}
            />
            <T variant="h3">You choose what to share</T>
            <T color={C.muted}>
              Medication context is off by default in the assistant. You can
              choose to include it for a conversation.
            </T>
          </Card>
          <Button
            label="Sign out"
            variant="secondary"
            icon="log-out-outline"
            onPress={() => {
              void logout().then(() => router.replace("/auth/login"));
            }}
          />
          <T variant="small" color={C.muted} style={{ textAlign: "center" }}>
            Adheronix · Made for your everyday.
          </T>
        </View>
      </View>
    </Screen>
  );
}
