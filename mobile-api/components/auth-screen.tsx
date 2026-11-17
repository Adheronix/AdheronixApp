import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand, Button, C, Companion, Field, Notice, Row, T, go } from "./ui";
import { authService } from "../services/auth.service";
import { errorMessage } from "../services/api";
import { useSession } from "./session";
export function AuthScreen({ signup = false }: { signup?: boolean }) {
  const wide = useWindowDimensions().width >= 900;
  const { refresh } = useSession();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setError("");
    if (!email.trim() || !password || (signup && !name.trim())) {
      setError("Please complete the fields below.");
      return;
    }
    if (
      signup &&
      (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8)
    ) {
      setError(
        "Enter a valid email and a password with at least 8 characters.",
      );
      return;
    }
    setBusy(true);
    try {
      if (signup)
        await authService.signup({
          full_names: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          username:
            "patient_" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 6),
        });
      else
        await authService.login({
          ...(email.includes("@")
            ? { email: email.trim().toLowerCase() }
            : { username: email.trim().toLowerCase() }),
          password,
        });
      await refresh();
      router.replace(signup ? "/auth/profile-setup" : "/home");
    } catch (e) {
      setError(errorMessage(e, "We couldn’t sign you in. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  const benefits = [
    {
      icon: "time-outline" as const,
      title: "A plan that fits your day",
      body: "See what’s next and record what you’ve taken.",
    },
    {
      icon: "sparkles-outline" as const,
      title: "A little more clarity",
      body: "Ask your assistant about your daily routine.",
    },
    {
      icon: "document-text-outline" as const,
      title: "Better prepared for appointments",
      body: "Bring a clear summary of your recent history.",
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {wide && (
          <View
            style={{
              width: "45%",
              backgroundColor: C.ink,
              padding: 48,
              justifyContent: "space-between",
            }}
          >
            <Brand light />
            <View style={{ maxWidth: 430, gap: 24, paddingVertical: 40 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: "#FFFFFF14",
                }}
              >
                <T variant="small" color="#B9EEE1">
                  A LITTLE SUPPORT. EVERY DAY.
                </T>
              </View>
              <T
                variant="display"
                color={C.white}
                style={{ fontSize: 49, lineHeight: 59, letterSpacing: -2 }}
              >
                Your everyday, supported.
              </T>
              <T color="#C2D5E0" style={{ fontSize: 16, lineHeight: 27 }}>
                Keep your medication, your questions, and your care history in
                one thoughtful space.
              </T>
              <Companion size={220} />
              <View style={{ marginTop: 18, gap: 22 }}>
                {benefits.map((item) => (
                  <Row
                    key={item.title}
                    style={{ alignItems: "flex-start", gap: 15 }}
                  >
                    <View
                      style={{
                        width: 39,
                        height: 39,
                        borderRadius: 12,
                        backgroundColor: "#FFFFFF12",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={item.icon} size={20} color="#B9EEE1" />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T
                        color={C.white}
                        style={{ fontFamily: "Inter_500Medium" }}
                      >
                        {item.title}
                      </T>
                      <T variant="small" color="#C2D5E0">
                        {item.body}
                      </T>
                    </View>
                  </Row>
                ))}
              </View>
            </View>
            <Row style={{ justifyContent: "space-between" }}>
              <T variant="small" color="#BDD0DC">
                Thoughtful care, between visits.
              </T>
              <T variant="small" color="#BDD0DC">
                Kigali, Rwanda
              </T>
            </Row>
          </View>
        )}
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: wide ? 52 : 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 410,
              alignSelf: "center",
              gap: 22,
            }}
          >
            {!wide && (
              <View style={{ gap: 10 }}>
                <Brand />
                <View
                  style={{ alignItems: "center", height: 164, marginTop: 12 }}
                >
                  <View
                    style={{
                      width: 150,
                      height: 150,
                      borderRadius: 75,
                      backgroundColor: C.mint,
                      position: "absolute",
                      top: 10,
                    }}
                  />
                  <Companion size={178} />
                  <View
                    style={{
                      position: "absolute",
                      right: -4,
                      top: 132,
                      backgroundColor: C.white,
                      borderRadius: 14,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      transform: [{ rotate: "7deg" }],
                    }}
                  >
                    <T variant="small" color={C.primary}>
                      A little support. Every day.
                    </T>
                  </View>
                </View>
              </View>
            )}
            <View style={{ gap: 10 }}>
              <T variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
                {signup
                  ? "Small steps.\nBetter days."
                  : "Your day,\na little lighter."}
              </T>
              <T color={C.muted}>
                {signup
                  ? "Create your account. Build a routine that works for you."
                  : "Sign in to pick up where you left off."}
              </T>
            </View>
            {error ? <Notice message={error} error /> : null}
            <View style={{ gap: 18 }}>
              {signup && (
                <Field
                  label="Full name"
                  placeholder="How should we call you?"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                />
              )}
              <Field
                label={signup ? "Email address" : "Email or username"}
                placeholder={
                  signup ? "you@example.com" : "Enter your email or username"
                }
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <View style={{ gap: 8 }}>
                <Field
                  label="Password"
                  placeholder={
                    signup ? "At least 8 characters" : "Enter your password"
                  }
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!show}
                  autoComplete={signup ? "new-password" : "current-password"}
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={show ? "Hide password" : "Show password"}
                  onPress={() => setShow(!show)}
                  style={{ alignSelf: "flex-end", padding: 4 }}
                >
                  <T variant="small" color={C.primary}>
                    {show ? "Hide password" : "Show password"}
                  </T>
                </Pressable>
              </View>
              <Button
                label={signup ? "Create account" : "Sign in"}
                icon="arrow-forward"
                onPress={() => void submit()}
                loading={busy}
              />
            </View>
            <Row style={{ justifyContent: "center", flexWrap: "wrap", gap: 4 }}>
              <T variant="small" color={C.muted}>
                {signup ? "Already have an account?" : "New to Adheronix?"}
              </T>
              <Button
                small
                variant="ghost"
                label={signup ? "Sign in" : "Create an account"}
                onPress={() => go(signup ? "/auth/login" : "/auth/signup")}
              />
            </Row>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: C.line,
                paddingTop: 20,
              }}
            >
              <Row style={{ justifyContent: "center", gap: 7 }}>
                <Ionicons
                  name="lock-closed-outline"
                  size={13}
                  color={C.muted}
                />
                <T variant="small" color={C.muted}>
                  Your care space. Your choices.
                </T>
              </Row>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
