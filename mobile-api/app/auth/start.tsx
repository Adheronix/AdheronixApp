import { router } from "expo-router";
import { useEffect } from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function StartScreen() {
    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await authService.isAuthenticated();
            if (authenticated) {
                router.replace("/home");
            }
        };
        checkAuth();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Top Image Section */}
            <View style={styles.heroContainer}>
                <Image
                    source={require("../../assets/images/healthcare_hero.png")}
                    style={styles.heroImage}
                    contentFit="cover"
                />
                <LinearGradient
                    colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.1)", "transparent"]}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.brandingContainer}>
                    <Animated.View entering={FadeInDown.delay(200)}>
                        <Text style={styles.brandingTitle}>ADHERONIX</Text>
                        <Text style={styles.brandingSubtitle}>Health with no limits</Text>
                    </Animated.View>
                </View>
            </View>

            {/* Bottom White Section with Curve */}
            <View style={styles.contentContainer}>
                <View style={styles.curve} />
                <SafeAreaView style={styles.safe}>
                    <Animated.View entering={FadeInUp.delay(400)} style={styles.textContent}>
                        <Text style={styles.welcomeTitle}>WELCOME</Text>
                        <Text style={styles.description}>
                            An amazing experience where you no longer need to spend hours looking for your medical papers as you now go with them in your phone
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(600)} style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.loginBtn}
                            onPress={() => router.push("/auth/login")}
                        >
                            <Text style={styles.loginBtnText}>Log In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.signupBtn}
                            onPress={() => router.push("/auth/signup")}
                        >
                            <Text style={styles.signupBtnText}>Sign Up</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </SafeAreaView>
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
        height: height * 0.55,
        width: width,
    },
    heroImage: {
        flex: 1,
    },
    brandingContainer: {
        position: "absolute",
        bottom: 100,
        width: "100%",
        alignItems: "center",
    },
    brandingTitle: {
        fontSize: 48,
        color: "#FFFFFF",
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        textAlign: "center",
    },
    brandingSubtitle: {
        fontSize: 14,
        color: "#FFFFFF",
        fontFamily: "monospace",
        textAlign: "center",
        letterSpacing: 2,
        marginTop: 5,
    },
    contentContainer: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        marginTop: -60,
    },
    curve: {
        position: "absolute",
        top: -40,
        backgroundColor: "#FFFFFF",
        height: 100,
        width: width * 1.5,
        left: -width * 0.25,
        borderTopLeftRadius: width,
        borderTopRightRadius: width,
    },
    safe: {
        flex: 1,
        paddingHorizontal: 30,
        justifyContent: "space-between",
        paddingBottom: 40,
    },
    textContent: {
        alignItems: "center",
        marginTop: 20,
    },
    welcomeTitle: {
        fontSize: 34,
        color: "#000000",
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        marginBottom: 15,
    },
    description: {
        fontSize: 14,
        color: "#666666",
        textAlign: "center",
        lineHeight: 22,
    },
    buttonContainer: {
        gap: 15,
    },
    loginBtn: {
        backgroundColor: "#000000",
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    loginBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "600",
    },
    signupBtn: {
        backgroundColor: "#FFFFFF",
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    signupBtnText: {
        color: "#000000",
        fontSize: 16,
        fontWeight: "600",
    },
});
