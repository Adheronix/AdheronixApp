import { useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Button,
  C,
  Card,
  Empty,
  Notice,
  PageTitle,
  Screen,
  go,
} from "../components/ui";
import { setScanDraft } from "../services/scan-draft";
export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false),
    [error, setError] = useState("");
  function scan({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    try {
      if (data.length > 16000) throw new Error();
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const p = (
        Array.isArray(parsed.prescription)
          ? parsed.prescription[0]
          : (parsed.prescription ?? parsed)
      ) as Record<string, unknown>;
      if (!p || typeof p.name !== "string") throw new Error();
      setScanDraft({
        name: p.name,
        dose:
          typeof (p.dose ?? p.dosage) === "string"
            ? String(p.dose ?? p.dosage)
            : undefined,
        instruction:
          typeof parsed.intake_recommendation === "string"
            ? parsed.intake_recommendation
            : undefined,
        frequency:
          typeof parsed.frequency === "number" ? parsed.frequency : undefined,
        period: typeof parsed.period === "string" ? parsed.period : undefined,
      });
      go("/add-medication");
    } catch {
      setError(
        "We couldn’t read medication details from this QR. You can try again or enter the prescription manually.",
      );
    }
  }
  return (
    <Screen back>
      <PageTitle
        eyebrow="BRING YOUR DETAILS TOGETHER"
        title="Scan medication details"
        body="Review everything against your prescription before saving."
      />
      <Card style={{ maxWidth: 650, width: "100%", alignSelf: "center" }}>
        {error && <Notice message={error} error />}
        {permission?.granted ? (
          <View
            style={{
              height: 350,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: C.ink,
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={scanned ? undefined : scan}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
          </View>
        ) : (
          <Empty
            icon="qr-code-outline"
            title="Bring the QR into view"
            body="Camera access is used to read medication details. You can also enter them manually."
            action={
              <Button
                label="Allow camera access"
                onPress={() => void requestPermission()}
              />
            }
          />
        )}
        <Notice message="A scanned QR is imported information. It is not proof of who prescribed the medication. No dose or treatment duration is assumed." />
        {scanned && (
          <Button
            label="Try another QR"
            variant="secondary"
            onPress={() => {
              setScanned(false);
              setError("");
            }}
          />
        )}
        <Button
          label="Enter details manually"
          variant="ghost"
          onPress={() => go("/add-medication")}
        />
      </Card>
    </Screen>
  );
}
