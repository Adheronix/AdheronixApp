import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleService } from "../../services/schedule.service";
import { authService } from "../../services/auth.service";
import { notificationService } from "../../services/notification.service";
import Animated, { FadeInUp } from "react-native-reanimated";

const { width } = Dimensions.get("window");
const GRID_SPACING = 15;
const MODULE_SIZE = (width - 40 - GRID_SPACING) / 2;

// Simple visual trend indicator using standard Views
const VisualTrend = ({ color = "#E2E8F0" }) => {
    return (
        <View style={styles.trendContainer}>
            <View style={[styles.trendBar, { height: '40%', backgroundColor: color }]} />
            <View style={[styles.trendBar, { height: '70%', backgroundColor: color }]} />
            <View style={[styles.trendBar, { height: '50%', backgroundColor: color }]} />
            <View style={[styles.trendBar, { height: '90%', backgroundColor: color }]} />
        </View>
    );
};

export default function HomeScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState<number>(0);

    const fetchData = async () => {
        try {
            const userData = await authService.getUser();
            setUser(userData);
            const [stats, unread] = await Promise.all([
                scheduleService.getStatus(),
                notificationService.getUnreadCount(),
            ]);
            setStatus(stats);
            setUnreadCount(unread);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const taken = status?.medications_taken_today || 0;
    const pending = status?.medications_pending || 0;
    const missed = status?.medications_missed || 0;
    const total = status?.total_scheduled || 0;
    const adherence = total > 0 ? Math.round((taken / total) * 100) : 0;

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="small" color="#000" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerLabel}>GOOD MORNING</Text>
                            <Text style={styles.userName}>{user?.full_names || 'User'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.notificationBtn}>
                            <Ionicons name="notifications-outline" size={24} color="#000" />
                            {unreadCount > 0 && <View style={styles.badge} />}
                        </TouchableOpacity>
                    </View>

                    {/* Adherence Card */}
                    <Animated.View entering={FadeInUp.delay(100)} style={styles.mainCard}>
                        <View>
                            <Text style={styles.cardLabel}>Daily Adherence</Text>
                            <Text style={styles.cardValue}>{adherence}%</Text>
                        </View>
                        <VisualTrend color="#FFFFFF50" />
                    </Animated.View>

                    {/* Bento Grid */}
                    <View style={styles.grid}>
                        <Animated.View entering={FadeInUp.delay(200)} style={styles.module}>
                            <Text style={styles.moduleLabel}>Taken</Text>
                            <Text style={styles.moduleValue}>{taken}</Text>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(300)} style={styles.module}>
                            <Text style={styles.moduleLabel}>Pending</Text>
                            <Text style={[styles.moduleValue, { color: '#64748B' }]}>
                                {pending}
                            </Text>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(400)} style={styles.module}>
                            <Text style={styles.moduleLabel}>Missed</Text>
                            <View style={styles.dataRow}>
                                <Text style={styles.moduleValue}>{missed}</Text>
                                <Text style={styles.unit}>doses</Text>
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(500)} style={styles.module}>
                            <Text style={styles.moduleLabel}>Scheduled</Text>
                            <View style={styles.dataRow}>
                                <Text style={styles.moduleValue}>{total}</Text>
                                <Text style={styles.unit}>today</Text>
                            </View>
                        </Animated.View>
                    </View>

                    <TouchableOpacity style={styles.logbookBtn} onPress={() => router.push('/meds')}>
                        <Text style={styles.logbookText}>View Medication Logbook</Text>
                        <Ionicons name="arrow-forward" size={18} color="#000" />
                    </TouchableOpacity>

                </ScrollView>
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 110,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 30,
    },
    headerLabel: {
        fontSize: 12,
        color: "#64748B",
        letterSpacing: 1,
    },
    userName: {
        fontSize: 24,
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: "#000",
        marginTop: 2,
    },
    notificationBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#FFF",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    badge: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#000",
    },
    mainCard: {
        backgroundColor: "#000",
        borderRadius: 30,
        padding: 30,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: GRID_SPACING,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    cardLabel: {
        color: "#FFFFFF90",
        fontSize: 14,
    },
    cardValue: {
        color: "#FFF",
        fontSize: 42,
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        marginTop: 5,
    },
    trendContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 4,
        height: 40,
    },
    trendBar: {
        width: 4,
        borderRadius: 2,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_SPACING,
    },
    module: {
        width: MODULE_SIZE,
        height: MODULE_SIZE,
        backgroundColor: "#FFF",
        borderRadius: 25,
        padding: 20,
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    moduleLabel: {
        fontSize: 14,
        color: "#64748B",
    },
    moduleValue: {
        fontSize: 28,
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: "#000",
    },
    dataRow: {
        flexDirection: "row",
        alignItems: "baseline",
    },
    unit: {
        fontSize: 12,
        color: "#64748B",
        marginLeft: 4,
    },
    logbookBtn: {
        marginTop: 25,
        backgroundColor: "#FFF",
        height: 60,
        borderRadius: 30,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 10,
    },
    logbookText: {
        fontSize: 15,
        color: "#000",
        fontWeight: "700",
    }
});
