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

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing Info", "Please enter both username and password.");
      return;
    };
    setLoading(true);
    try {
      await authService.login({ username: username.trim(), password });
      router.replace("/home");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Banner */}
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

      {/* Login Form Area */}
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
              <Text style={styles.title}>WELCOME BACK</Text>
              <Text style={styles.subtitle}>
                It's nice to see you again. Let's get you logged in before we continue
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400)} style={styles.form}>
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
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.signupPrompt}>
                <Text style={styles.promptText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/auth/signup")}>
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.loginBtnText}>Log In</Text>
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
    height: height * 0.4,
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
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    color: "#000000",
    fontWeight: "bold",
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    height: 60,
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
    fontSize: 16,
    color: "#000000",
  },
  signupPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  promptText: {
    color: "#666666",
    fontSize: 14,
  },
  signupLink: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: "#000000",
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
