import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Image } from "expo-image";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier: string | null; password: string | null }>({
    identifier: null,
    password: null,
  });

  const validate = () => {
    const next = {
      identifier: !identifier.trim() ? "Email or Username is required" : null,
      password: !password ? "Password is required" : null,
    };
    setErrors(next);
    return !next.identifier && !next.password;
  };

  const clearError = (field: keyof typeof errors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      const credentials = isEmail
        ? { email: identifier.trim().toLowerCase(), password }
        : { username: identifier.trim().toLowerCase(), password };

      await authService.login(credentials);
      router.replace("/home");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Invalid credentials. Please try again.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={["#F8FAFC", "#EEF2FF"]}
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
            <Animated.View entering={FadeInUp.duration(800)} style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </TouchableOpacity>
              <Image
                source={require("../../assets/images/logo_premium.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.titleSection}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Enter your details to access your health dashboard</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.formCard}>
              {/* Identifier Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL OR USERNAME</Text>
                <View style={[styles.inputContainer, errors.identifier && styles.inputError]}>
                  <Feather name="user" size={20} color="#94A3B8" />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email or username"
                    placeholderTextColor="#94A3B8"
                    value={identifier}
                    onChangeText={(v) => { setIdentifier(v); clearError("identifier"); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}
              </View>

              {/* Password Field */}
              <View style={[styles.inputGroup, { marginTop: 20 }]}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <TouchableOpacity>
                    <Text style={styles.forgotText}>Forgot?</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                  <Feather name="lock" size={20} color="#94A3B8" />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(v) => { setPassword(v); clearError("password"); }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(600)} style={styles.footer}>
              <Text style={styles.footerText}>New to Adheronix? </Text>
              <TouchableOpacity onPress={() => router.push("/auth/signup")}>
                <Text style={styles.signUpLink}>Create Account</Text>
              </TouchableOpacity>
            </Animated.View>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logo: {
    width: 50,
    height: 50,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: "DMSerifDisplay_400Regular",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  inputGroup: {
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#475569",
    letterSpacing: 1,
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#4F46E5",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  loginBtn: {
    marginTop: 32,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
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
  signUpLink: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#4F46E5",
  },
});
