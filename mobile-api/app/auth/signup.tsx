import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";

const { height } = Dimensions.get("window");

export default function SignUpScreen() {
  const [fullNames, setFullNames] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullNames || !username || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await authService.signup({
        full_names: fullNames,
        username,
        email: email || undefined,
        phone_number: phoneNumber || undefined,
        password,
      });
      Alert.alert("Success", "Account created successfully! Please log in.", [
        { text: "OK", onPress: () => router.push("/auth/login") }
      ]);
    } catch (error: any) {
      console.error("Signup error:", error);
      const message = error.response?.data?.message || "Something went wrong. Please try again.";
      Alert.alert("Signup Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 🔹 Image (Scrollable) */}
        <View style={styles.imageContainer}>
          <Image
            source={require("../../assets/images/meda.png")}
            style={styles.image}
          />
        </View>

        {/* 🔹 Content */}
        <View style={styles.content}>
          <Text style={styles.title}>WELCOME</Text>
          <Text style={styles.subtitle}>
            Hello! Lets get you signed up before you continue
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Fullnames"
              value={fullNames}
              onChangeText={setFullNames}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Create password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Text style={styles.footerText} onPress={() => router.push("/auth/login")}>
              Already have an account?{" "}
              <Text style={styles.link}>Log In</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  scrollContent: {
    paddingBottom: 30, // prevents cutoff
  },

  imageContainer: {
    height: 400, // ✅ exactly 50% of screen
  },

  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  content: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },

  title: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },

  form: {
    gap: 14,
  },

  input: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#444",
    borderWidth: 1,
    borderColor: "#EFEFEF",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  footerText: {
    textAlign: "center",
    fontSize: 17,
    color: "#555",
    marginTop: 10,
    fontFamily: "Inter_400Regular",
  },

  link: {
    color: "#000",
    fontFamily: "Inter_700Bold",
  },

  button: {
    marginTop: 20,
    height: 54,
    width: "70%",
    backgroundColor: "#000",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "DMSerifDisplay_400Regular",
  },
});