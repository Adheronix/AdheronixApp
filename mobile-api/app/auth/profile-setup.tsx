import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  C,
  Field,
  Notice,
  PageTitle,
  Row,
  Screen,
  T,
} from "../../components/ui";
import { authService } from "../../services/auth.service";
import { errorMessage } from "../../services/api";
import { useSession } from "../../components/session";
export default function Setup() {
  const { refresh } = useSession();
  const [conditions, setConditions] = useState(""),
    [contact, setContact] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    try {
      await authService.updateProfile({
        conditions,
        emergency_contact_name: contact,
        emergency_contact_phone: phone,
      });
      await refresh();
      router.replace("/home");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View
        style={{
          maxWidth: 600,
          width: "100%",
          alignSelf: "center",
          paddingVertical: 25,
        }}
      >
        <PageTitle
          eyebrow="MAKE YOURSELF AT HOME"
          title="Care, on your terms."
          body="A few optional details help you keep your information together. You can update them any time."
        />
        <Card>
          {error && <Notice message={error} error />}
          <Field
            label="Conditions you manage (optional)"
            placeholder="For example, a long-term condition"
            value={conditions}
            onChangeText={setConditions}
          />
          <T variant="h3" style={{ marginTop: 12 }}>
            Your emergency contact
          </T>
          <T color={C.muted} variant="small">
            Keep someone’s details close at hand. This does not automatically
            share your records or contact them.
          </T>
          <Field
            label="Contact name"
            value={contact}
            onChangeText={setContact}
            placeholder="Their full name"
          />
          <Field
            label="Contact phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
          <Row style={{ justifyContent: "flex-end", marginTop: 10 }}>
            <Button
              variant="ghost"
              label="Skip for now"
              onPress={() => router.replace("/home")}
            />
            <Button
              label="Save and continue"
              loading={busy}
              onPress={() => void save()}
            />
          </Row>
        </Card>
      </View>
    </Screen>
  );
}
