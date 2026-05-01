import { router } from "expo-router";
import { useEffect } from "react";
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    withTiming,
    FadeInUp,
    FadeInDown
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

const { width, height } = Dimensions.get("window");

export default function LandingScreen() {
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
            <LinearGradient
                colors={["#F8FAFC", "#EEF2FF", "#E0E7FF"]}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <Animated.View
                        entering={FadeInDown.duration(1000).springify()}
                        style={styles.imageContainer}
                    >
                        <Image
                            source={require('../../assets/images/healthcare_hero.png')}
                            style={styles.heroImage}
                            contentFit="contain"
                        />
                    </Animated.View>

                    <View style={styles.textContainer}>
                        <Animated.Text
                            entering={FadeInUp.delay(300).duration(800)}
                            style={styles.brandName}
                        >
                            ADHERONIX
                        </Animated.Text>

                        <Animated.Text
                            entering={FadeInUp.delay(500).duration(800)}
                            style={styles.title}
                        >
                            Your Health{"\n"}
                            <Text style={styles.titleAccent}>Simplified.</Text>
                        </Animated.Text>

                        <Animated.Text
                            entering={FadeInUp.delay(700).duration(800)}
                            style={styles.description}
                        >
                            The smarter way to manage your medications, appointments, and health records in one secure place.
                        </Animated.Text>
                    </View>

                    <Animated.View
                        entering={FadeInUp.delay(900).duration(800)}
                        style={styles.buttonContainer}
                    >
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => router.push("/auth/login")}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={["#1E293B", "#0F172A"]}
                                style={styles.gradientButton}
                            >
                                <Text style={styles.primaryButtonText}>Get Started</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => router.push("/auth/signup")}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.secondaryButtonText}>Create Account</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                <Animated.Text
                    entering={FadeInUp.delay(1100).duration(1000)}
                    style={styles.footerText}
                >
                    Trusted by 10k+ users worldwide
                </Animated.Text>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        justifyContent: "center",
        alignItems: "center",
    },
    imageContainer: {
        width: width * 0.85,
        height: height * 0.35,
        marginBottom: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    heroImage: {
        width: "100%",
        height: "100%",
    },
    textContainer: {
        width: "100%",
        alignItems: "flex-start",
        marginBottom: 50,
    },
    brandName: {
        fontSize: 14,
        fontFamily: "Inter_700Bold",
        color: "#6366F1",
        letterSpacing: 4,
        marginBottom: 12,
    },
    title: {
        fontSize: 48,
        fontFamily: "DMSerifDisplay_400Regular",
        color: "#0F172A",
        lineHeight: 56,
        marginBottom: 16,
    },
    titleAccent: {
        color: "#4F46E5",
    },
    description: {
        fontSize: 16,
        fontFamily: "Inter_300Light",
        color: "#64748B",
        lineHeight: 26,
    },
    buttonContainer: {
        width: "100%",
        gap: 16,
    },
    primaryButton: {
        width: "100%",
        height: 64,
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
    },
    gradientButton: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontFamily: "Inter_400Regular",
        letterSpacing: 0.5,
    },
    secondaryButton: {
        width: "100%",
        height: 64,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
    },
    secondaryButtonText: {
        color: "#0F172A",
        fontSize: 18,
        fontFamily: "Inter_400Regular",
    },
    footerText: {
        textAlign: "center",
        fontSize: 12,
        color: "#94A3B8",
        fontFamily: "Inter_400Regular",
        marginBottom: 20,
    }
});
