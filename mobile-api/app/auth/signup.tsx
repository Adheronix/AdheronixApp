import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Errors = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phoneNumber: string | null;
  password: string | null;
  confirmPassword: string | null;
};

const CLEAR: Errors = {
  firstName: null,
  lastName: null,
  username: null,
  email: null,
  phoneNumber: null,
  password: null,
  confirmPassword: null,
};

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>(CLEAR);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const next: Errors = {
      firstName: !firstName.trim() ? "Required" : null,
      lastName: !lastName.trim() ? "Required" : null,
      username: !username.trim()
        ? "Username is required"
        : username.length < 3
          ? "Min. 3 chars"
          : null,
      email: !email.trim() ? "Email is required" : null,
      phoneNumber: null, // Optional
      password: !password
        ? "Password is required"
        : password.length < 6
          ? "Min. 6 chars"
          : null,
      confirmPassword: !confirmPassword
        ? "Please confirm"
        : confirmPassword !== password
          ? "Mismatch"
          : null,
    };
    setErrors(next);
    return Object.values(next).every((v) => v === null);
  };

  const clearError = (field: keyof Errors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.signup({
        full_names: `${firstName.trim()} ${lastName.trim()}`,
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone_number: phoneNumber.trim(),
        password,
      });
      router.replace("/auth/profile-setup");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Signup failed. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={["#F8FAFC", "#F1F5F9"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={22} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Create Account</Text>
              <View style={{ width: 44 }} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200)} style={styles.infoSection}>
              <Text style={styles.title}>Join Adheronix</Text>
              <Text style={styles.subtitle}>Start managing your health journey today.</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
              {/* Names Row */}
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>FIRST NAME</Text>
                  <View style={[styles.inputBox, errors.firstName && styles.inputBoxError]}>
                    <TextInput
                      style={styles.input}
                      placeholder="John"
                      value={firstName}
                      onChangeText={(v) => { setFirstName(v); clearError("firstName"); }}
                      autoCapitalize="words"
                      onSubmitEditing={() => lastNameRef.current?.focus()}
                    />
                  </View>
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>LAST NAME</Text>
                  <View style={[styles.inputBox, errors.lastName && styles.inputBoxError]}>
                    <TextInput
                      ref={lastNameRef}
                      style={styles.input}
                      placeholder="Doe"
                      value={lastName}
                      onChangeText={(v) => { setLastName(v); clearError("lastName"); }}
                      autoCapitalize="words"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>
                </View>
              </View>

              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
                  <Feather name="mail" size={18} color="#94A3B8" />
                  <TextInput
                    ref={emailRef}
                    style={styles.inputWithIcon}
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={(v) => { setEmail(v); clearError("email"); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                  />
                </View>
              </View>

              {/* Username & Phone */}
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>USERNAME</Text>
                  <View style={[styles.inputBox, errors.username && styles.inputBoxError]}>
                    <TextInput
                      ref={usernameRef}
                      style={styles.input}
                      placeholder="johndoe"
                      value={username}
                      onChangeText={(v) => { setUsername(v.replace(/\s/g, "")); clearError("username"); }}
                      autoCapitalize="none"
                      onSubmitEditing={() => phoneRef.current?.focus()}
                    />
                  </View>
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>PHONE (OPT)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      ref={phoneRef}
                      style={styles.input}
                      placeholder="+250..."
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
                  <Feather name="lock" size={18} color="#94A3B8" />
                  <TextInput
                    ref={passwordRef}
                    style={styles.inputWithIcon}
                    placeholder="Min. 6 chars"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearError("password"); }}
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={[styles.inputBox, errors.confirmPassword && styles.inputBoxError]}>
                  <Feather name="shield" size={18} color="#94A3B8" />
                  <TextInput
                    ref={confirmRef}
                    style={styles.inputWithIcon}
                    placeholder="Repeat password"
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); clearError("confirmPassword"); }}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Feather name={showConfirm ? "eye" : "eye-off"} size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Create Account</Text>}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/auth/login")}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  infoSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: "DMSerifDisplay_400Regular",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#475569",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  inputBoxError: {
    borderColor: "#EF4444",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  inputWithIcon: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  btn: {
    marginTop: 16,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  loginLink: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#4F46E5",
  },
});
