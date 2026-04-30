import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email: string | null; password: string | null }>({
    email: null,
    password: null,
  });

  const validate = () => {
    const next = {
      email: !email.trim() ? "Email is required" : null,
      password: !password ? "Password is required" : null,
    };
    setErrors(next);
    return !next.email && !next.password;
  };

  const clearError = (field: keyof typeof errors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.login({ email: email.trim().toLowerCase(), password });
      router.replace("/home");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Something went wrong. Please try again.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={["#B8CFED", "#CDDDF5", "#E4EDF9"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Decorative circles */}
          <View style={styles.orbLarge} />
          <View style={styles.orbMedium} />
          <View style={styles.orbSmall} />

          <Image
            source={require("../../assets/images/meda.png")}
            style={styles.heroImage}
            resizeMode="contain"
          />
          <LinearGradient
            colors={["transparent", "#F2F5FC"]}
            style={styles.heroFade}
          />
        </View>

        {/* Card */}
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {/* Pull handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue to MediSafe</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, errors.email ? styles.inputErr : null]}>
              <Feather name="mail" size={15} color="#9BA3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputInner}
                placeholder="you@example.com"
                placeholderTextColor="#B0B8CC"
                value={email}
                onChangeText={(v) => { setEmail(v); clearError("email"); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            {errors.email ? <Text style={styles.errText}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.inputWrap, errors.password ? styles.inputErr : null]}>
              <Feather name="lock" size={15} color="#9BA3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputInner}
                placeholder="••••••••"
                placeholderTextColor="#B0B8CC"
                value={password}
                onChangeText={(v) => { setPassword(v); clearError("password"); }}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eye}>
                <Feather
                  name={showPassword ? "eye" : "eye-off"}
                  size={16}
                  color="#9BA3B8"
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errText}>{errors.password}</Text> : null}
          </View>

          {/* Forgot */}
          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => Alert.alert("Coming soon", "Password reset will be available soon.")}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign in button */}
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>SIGN IN</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footer}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/signup")}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#C4D6EE",
  },
  flex: {
    flex: 1,
    backgroundColor: "#F2F5FC",
  },

  // Hero
  hero: {
    height: SCREEN_HEIGHT * 0.42,
    overflow: "hidden",
  },
  orbLarge: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -70,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  orbMedium: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: 10,
    left: -50,
    backgroundColor: "rgba(160,196,235,0.38)",
  },
  orbSmall: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 30,
    left: SCREEN_WIDTH * 0.35,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroImage: {
    width: "60%",
    height: "78%",
    alignSelf: "center",
    marginTop: 28,
  },
  heroFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: "#F2F5FC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -26,
  },
  cardContent: {
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 36,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0D6E8",
    alignSelf: "center",
    marginBottom: 22,
  },

  title: {
    fontSize: 28,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_300Light",
    color: "#64748B",
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E7F2",
    marginBottom: 22,
  },

  // Fields
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#8C93A8",
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  inputWrap: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E7F2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    shadowColor: "#8AA0C8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputInner: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_300Light",
    color: "#0F172A",
  },
  inputErr: {
    borderColor: "#E53935",
    backgroundColor: "#FFF8F8",
  },
  eye: {
    padding: 4,
  },
  errText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#E53935",
    marginTop: 4,
    marginLeft: 2,
  },

  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 26,
  },
  forgot: {
    fontSize: 12,
    fontFamily: "Inter_300Light",
    color: "#64748B",
  },

  btn: {
    height: 54,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  btnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    letterSpacing: 2,
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    fontSize: 13,
    fontFamily: "Inter_300Light",
    color: "#94A3B8",
  },
  footerLink: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
});
