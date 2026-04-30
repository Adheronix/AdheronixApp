import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
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

type Errors = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  password: string | null;
  confirmPassword: string | null;
};

const CLEAR: Errors = {
  firstName: null,
  lastName: null,
  email: null,
  password: null,
  confirmPassword: null,
};

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>(CLEAR);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const next: Errors = {
      firstName: !firstName.trim() ? "Required" : null,
      lastName: !lastName.trim() ? "Required" : null,
      email: !email.trim() ? "Email is required" : null,
      password: !password
        ? "Password is required"
        : password.length < 6
        ? "At least 6 characters"
        : null,
      confirmPassword: !confirmPassword
        ? "Please confirm your password"
        : confirmPassword !== password
        ? "Passwords do not match"
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
      const suffix = Math.random().toString(36).slice(2, 6);
      const username =
        email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_") +
        "_" +
        suffix;
      await authService.signup({
        full_names: `${firstName.trim()} ${lastName.trim()}`,
        username,
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace("/home");
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Something went wrong. Please try again.";
      Alert.alert("Signup Failed", message);
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
        {/* Hero — shorter on signup to give more room to the form */}
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

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join MediSafe — it's free</Text>

          <View style={styles.divider} />

          {/* First + Last name */}
          <View style={styles.nameRow}>
            <View style={[styles.field, styles.nameField]}>
              <Text style={styles.label}>FIRST NAME</Text>
              <View style={[styles.inputWrap, errors.firstName ? styles.inputErr : null]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="John"
                  placeholderTextColor="#B0B8CC"
                  value={firstName}
                  onChangeText={(v) => { setFirstName(v); clearError("firstName"); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              {errors.firstName ? (
                <Text style={styles.errText}>{errors.firstName}</Text>
              ) : null}
            </View>

            <View style={[styles.field, styles.nameField]}>
              <Text style={styles.label}>LAST NAME</Text>
              <View style={[styles.inputWrap, errors.lastName ? styles.inputErr : null]}>
                <TextInput
                  ref={lastNameRef}
                  style={styles.inputInner}
                  placeholder="Doe"
                  placeholderTextColor="#B0B8CC"
                  value={lastName}
                  onChangeText={(v) => { setLastName(v); clearError("lastName"); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
              {errors.lastName ? (
                <Text style={styles.errText}>{errors.lastName}</Text>
              ) : null}
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, errors.email ? styles.inputErr : null]}>
              <Feather name="mail" size={15} color="#9BA3B8" style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={styles.inputInner}
                placeholder="you@example.com"
                placeholderTextColor="#B0B8CC"
                value={email}
                onChangeText={(v) => { setEmail(v); clearError("email"); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
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
                ref={passwordRef}
                style={styles.inputInner}
                placeholder="Min. 6 characters"
                placeholderTextColor="#B0B8CC"
                value={password}
                onChangeText={(v) => { setPassword(v); clearError("password"); }}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
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

          {/* Confirm password */}
          <View style={styles.field}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputWrap, errors.confirmPassword ? styles.inputErr : null]}>
              <Feather name="shield" size={15} color="#9BA3B8" style={styles.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={styles.inputInner}
                placeholder="Repeat password"
                placeholderTextColor="#B0B8CC"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); clearError("confirmPassword"); }}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eye}>
                <Feather
                  name={showConfirm ? "eye" : "eye-off"}
                  size={16}
                  color="#9BA3B8"
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text style={styles.errText}>{errors.confirmPassword}</Text>
            ) : null}
          </View>

          {/* Create account button */}
          <TouchableOpacity style={styles.btn} onPress={handleSignUp} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footer}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={styles.footerLink}>Sign In</Text>
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
    height: SCREEN_HEIGHT * 0.30,
    overflow: "hidden",
  },
  orbLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -70,
    right: -60,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  orbMedium: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    bottom: 0,
    left: -40,
    backgroundColor: "rgba(160,196,235,0.38)",
  },
  orbSmall: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    top: 20,
    left: SCREEN_WIDTH * 0.32,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  heroImage: {
    width: "50%",
    height: "80%",
    alignSelf: "center",
    marginTop: 14,
  },
  heroFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0D6E8",
    alignSelf: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_300Light",
    color: "#64748B",
    marginBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E7F2",
    marginBottom: 18,
  },

  // Name row
  nameRow: {
    flexDirection: "row",
    gap: 10,
  },
  nameField: {
    flex: 1,
  },

  // Fields
  field: {
    marginBottom: 13,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#8C93A8",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputWrap: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E7F2",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    shadowColor: "#8AA0C8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputInner: {
    flex: 1,
    fontSize: 14,
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
    marginTop: 3,
    marginLeft: 2,
  },

  btn: {
    height: 54,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 18,
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
