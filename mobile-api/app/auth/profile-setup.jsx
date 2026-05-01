import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";

export default function ProfileSetupScreen() {
    const [user, setUser] = useState(null);
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("");
    const [conditions, setConditions] = useState("");
    const [emergencyName, setEmergencyName] = useState("");
    const [emergencyPhone, setEmergencyPhone] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        authService.getUser().then(setUser);
    }, []);

    const handleContinue = async () => {
        setLoading(true);
        try {
            await authService.updateProfile({
                age: parseInt(age) || undefined,
                gender,
                conditions,
                emergency_contact_name: emergencyName,
                emergency_contact_phone: emergencyPhone,
            });
            router.replace("/home");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Image */}
                <View style={styles.headerImageContainer}>
                    <Image
                        source={require("../../assets/images/meda.png")}
                        style={styles.image}
                    />
                    <View style={styles.overlay} />
                    <Text style={styles.headerText}>HEALTH</Text>
                </View>

                {/* Form Section */}
                <View style={styles.formContainer}>
                    <Text style={styles.title}>PROFILE SETUP</Text>
                    <Text style={styles.subtitle}>
                        Hello! Let's get you set up before you continue
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.userInfoContainer}>
                            <Text style={styles.label}>NAMES:</Text>
                            <Text style={styles.userNameText}>{user?.full_names || "Loading..."}</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Age:</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ex: 48"
                                placeholderTextColor={"#888"}
                                keyboardType="numeric"
                                value={age}
                                onChangeText={setAge}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Gender:</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ex: Male"
                                placeholderTextColor={"#888"}
                                value={gender}
                                onChangeText={setGender}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Conditions (if any):</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ex: Diabetes, Hypertension"
                                placeholderTextColor={"#888"}
                                value={conditions}
                                onChangeText={setConditions}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Emergency Contact Name:</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor={"#888"}
                                value={emergencyName}
                                onChangeText={setEmergencyName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Emergency Phone number:</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ex: +250..."
                                placeholderTextColor={"#888"}
                                keyboardType="phone-pad"
                                value={emergencyPhone}
                                onChangeText={setEmergencyPhone}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && { opacity: 0.7 }]}
                        onPress={handleContinue}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Continue</Text>
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
        flexGrow: 1,
    },
    headerImageContainer: {
        height: 250,
        width: "100%",
        position: "relative",
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.3)",
    },
    headerText: {
        position: "absolute",
        top: 40,
        fontSize: 24,
        color: "#fff",
        fontFamily: "Inter_700Bold",
        letterSpacing: 4,
    },
    formContainer: {
        flex: 1,
        backgroundColor: "#fff",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
        paddingHorizontal: 30,
        paddingTop: 30,
    },
    title: {
        fontSize: 28,
        fontFamily: "DMSerifDisplay_400Regular",
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#666",
        textAlign: "center",
        marginBottom: 30,
    },
    form: {
        gap: 15,
        marginBottom: 30,
    },
    userInfoContainer: {
        marginBottom: 10,
    },
    userNameText: {
        fontSize: 18,
        fontFamily: "Inter_700Bold",
        color: "#000",
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontFamily: "Inter_700Bold",
        color: "#333",
    },
    input: {
        height: 50,
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: "#eee",
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    button: {
        backgroundColor: "#000",
        height: 54,
        borderRadius: 27,
        justifyContent: "center",
        alignItems: "center",
        width: "80%",
        alignSelf: "center",
        marginBottom: 40,
    },
    buttonText: {
        color: "#fff",
        fontSize: 18,
        fontFamily: "DMSerifDisplay_400Regular",
    },
});
