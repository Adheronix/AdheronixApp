import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Alert,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../services/auth.service";
import { notificationService } from "../services/notification.service";

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [careGiverAccess, setCareGiverAccess] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const [userData, unread] = await Promise.all([
                    authService.getUser(),
                    notificationService.getUnreadCount(),
                ]);
                setUser(userData);
                setUnreadCount(unread);
            } catch (error) {
                console.error("Failed to fetch user:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    const logoutAndRedirect = async () => {
        await authService.logout();
        setUser(null);
        router.replace('/auth/login');
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window === 'undefined'
                ? true
                : window.confirm("Are you sure you want to logout?");
            if (confirmed) {
                void logoutAndRedirect();
            }
            return;
        }

        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: logoutAndRedirect,
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>User Profile</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push('/notifications')}
                    >
                        <Ionicons name="notifications" size={24} color="black" />
                        {unreadCount > 0 && <View style={styles.notificationDot} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileIconButton}>
                        <Ionicons name="person" size={20} color="black" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.avatarCard}>
                    <Ionicons name="person" size={160} color="#000" />
                </View>

                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Name:</Text>
                        <Text style={styles.infoValue}>{user?.full_names || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email:</Text>
                        <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone Number:</Text>
                        <Text style={styles.infoValue}>{user?.phone_number || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Age:</Text>
                        <Text style={styles.infoValue}>{user?.age ? `${user.age} years old` : 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.sectionDivider}>
                    <Text style={styles.sectionHeader}>Medical info</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Conditions:</Text>
                        <Text style={styles.infoValue}>{user?.conditions || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Allergies:</Text>
                        <Text style={styles.infoValue}>{user?.allergies || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.sectionDivider}>
                    <Text style={styles.sectionHeader}>Emergency Contact</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Name:</Text>
                        <Text style={styles.infoValue}>{user?.emergency_contact_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone number:</Text>
                        <Text style={styles.infoValue}>{user?.emergency_contact_phone || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setCareGiverAccess(!careGiverAccess)}
                    >
                        <Ionicons
                            name={careGiverAccess ? "checkbox" : "square-outline"}
                            size={24}
                            color="black"
                        />
                        <Text style={styles.toggleText}>CARE GIVER ACCESS</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingHorizontal: 25,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 10,
        marginBottom: 30,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: "#000",
    },
    headerIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 15,
    },
    iconButton: {
        position: "relative",
    },
    notificationDot: {
        position: "absolute",
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "red",
        borderWidth: 1,
        borderColor: "white",
    },
    profileIconButton: {
        width: 36,
        height: 36,
        borderWidth: 1.5,
        borderColor: "#000",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    scrollContent: {
        paddingBottom: 40,
    },
    avatarCard: {
        width: "100%",
        aspectRatio: 1.5,
        backgroundColor: "#fff",
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 30,
        // Shadow for iOS
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        // Elevation for Android
        elevation: 5,
        borderWidth: 1,
        borderColor: "#f0f0f0",
    },
    infoSection: {
        marginBottom: 20,
    },
    sectionDivider: {
        marginTop: 10,
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 24,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        marginBottom: 10,
        color: "#000",
    },
    infoRow: {
        marginBottom: 15,
    },
    infoLabel: {
        fontSize: 13,
        color: "#888",
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
        color: "#000",
    },
    toggleContainer: {
        marginTop: 10,
        marginBottom: 30,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    toggleText: {
        fontSize: 14,
        color: "#666",
        letterSpacing: 0.5,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 20,
        marginBottom: 40,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: '#FF3B30',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        color: '#FF3B30',
        fontWeight: 'bold',
    },
});
