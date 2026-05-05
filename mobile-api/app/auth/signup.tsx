import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !username || !email || !password || password !== confirmPassword) {
      Alert.alert("Error", "Please fill in all fields correctly.");
      return;
    }
    setLoading(true);
    try {
      const trimmedPhoneNumber = phoneNumber.trim();

      await authService.signup({
        full_names: `${firstName.trim()} ${lastName.trim()}`,
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        ...(trimmedPhoneNumber ? { phone_number: trimmedPhoneNumber } : {}),
        password,
      });
      router.replace("/auth/profile-setup");
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        (error.request
          ? "Cannot reach the backend API. Check that the backend is running and EXPO_PUBLIC_API_URL matches your computer IP."
          : "Registration failed.");

      Alert.alert("Error", Array.isArray(message) ? message.join("\n") : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.heroContainer}>
        <Image
          source={require("../../assets/images/healthcare_hero.png")}
          style={styles.heroImage}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.4)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.curve} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.delay(200)} style={styles.textHeader}>
              <Text style={styles.title}>WELCOME</Text>
              <Text style={styles.subtitle}>
                Hello! Let's get you signed up before you continue
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400)} style={styles.form}>
              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor="#94A3B8"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Last name"
                    placeholderTextColor="#94A3B8"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  placeholderTextColor="#94A3B8"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Create password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.loginPrompt}>
                <Text style={styles.promptText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/auth/login")}>
                  <Text style={styles.loginLink}>Log In</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.signupBtn, loading && { opacity: 0.7 }]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.signupBtnText}>Sign Up</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  heroContainer: {
    height: height * 0.3,
    width: width,
  },
  heroImage: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: -40,
  },
  curve: {
    position: "absolute",
    top: -40,
    backgroundColor: "#FFFFFF",
    height: 80,
    width: width * 1.5,
    left: -width * 0.25,
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 40,
  },
  textHeader: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    color: "#000000",
    fontWeight: "bold",
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    gap: 15,
  },
  row: {
    flexDirection: "row",
  },
  inputContainer: {
    height: 55,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 20,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  input: {
    fontSize: 14,
    color: "#000000",
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 5,
  },
  promptText: {
    color: "#666666",
    fontSize: 13,
  },
  loginLink: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
  },
  signupBtn: {
    backgroundColor: "#000000",
    height: 55,
    borderRadius: 27.5,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  signupBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
