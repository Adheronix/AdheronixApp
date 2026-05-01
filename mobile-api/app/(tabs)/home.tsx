import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ImageBackground,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleService } from "../../services/schedule.service";
import { authService } from "../../services/auth.service";
import { notificationService } from "../../services/notification.service";

export default function HomeScreen() {
    const router = useRouter();
    const [upcomingMeds, setUpcomingMeds] = useState<any[]>([]);
    const [status, setStatus] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [marking, setMarking] = useState<string | null>(null);

    const handleMarkTaken = async (scheduleId: string) => {
        setMarking(scheduleId);
        try {
            await scheduleService.markAsTaken(scheduleId);
            await fetchData();
        } catch {
            Alert.alert("Error", "Could not mark medication as taken. Please try again.");
        } finally {
            setMarking(null);
        }
    };

    const fetchData = async () => {
        try {
            const userData = await authService.getUser();
            setUser(userData);

            const [upcoming, stats, unread] = await Promise.all([
                scheduleService.getUpcoming(),
                scheduleService.getStatus(),
                notificationService.getUnreadCount(),
            ]);

            setUpcomingMeds(upcoming.slice(0, 2));
            setStatus({
                taken: stats.medications_taken_today,
                missed: stats.medications_missed,
                total: stats.total_scheduled
            });
            setUnreadCount(unread);
        } catch (error) {
            console.error("Failed to fetch home data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.appName}>Adheronix</Text>
                        <View style={styles.headerRight}>
                            <TouchableOpacity onPress={() => router.push('/notifications')}>
                                <Ionicons name="notifications" size={28} color="#000" />
                                {unreadCount > 0 && <View style={styles.notificationBadge} />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/profile')}>
                                <View style={styles.profileIconContainer}>
                                    <Ionicons name="person" size={24} color="#000" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={{ fontSize: 24, fontFamily: "DMSerifDisplay_400Regular", marginBottom: 10 }}>
                        Hello, {user?.full_names || 'User'}
                    </Text>

                    {/* Upcoming Medications Card */}
                    <ImageBackground
                        source={require('../../assets/images/rightMeds.png')}
                        style={styles.card}
                        imageStyle={styles.cardBackgroundImage}
                    >
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>Upcoming Medications</Text>

                            {upcomingMeds.length === 0 ? (
                                <Text style={styles.medSubText}>No upcoming meds for today.</Text>
                            ) : (
                                upcomingMeds.map((med, index) => (
                                    <View key={med.schedule_id || index} style={styles.medicationItem}>
                                        <Text style={styles.medName}>{med.medication_name || 'Medication'}</Text>
                                        <View style={styles.medStatusRow}>
                                            <Text style={styles.medSubText}>{med.scheduled_time}</Text>
                                            <View style={med.status === 'taken' ? styles.statusBadgeGreen : styles.statusBadgeRed}>
                                                {med.status === 'taken' ? (
                                                    <>
                                                        <View style={styles.dotGreen} />
                                                        <Text style={styles.statusTextGreen}>Taken</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ionicons name="time-outline" size={12} color="#FF3B30" />
                                                        <Text style={styles.statusTextRed}>{med.time_until || 'Soon'}</Text>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                        {med.status !== 'taken' && (
                                            <TouchableOpacity
                                                style={styles.markBtn}
                                                onPress={() => handleMarkTaken(med.schedule_id)}
                                                disabled={marking === med.schedule_id}
                                            >
                                                <Text style={styles.markBtnText}>
                                                    {marking === med.schedule_id ? 'Marking…' : 'Mark as Taken'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    </ImageBackground>

                    {/* General Status */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>General Status</Text>
                        <Text style={styles.label}>Medication Taken Today:</Text>
                        <View style={styles.pillRow}>
                            {[...Array(status?.total || 3)].map((_, i) => (
                                <View key={i} style={i < (status?.taken || 0) ? styles.checkedPill : styles.uncheckedPill}>
                                    {i < (status?.taken || 0) ? (
                                        <Ionicons name="checkmark-circle" size={20} color="#000" />
                                    ) : (
                                        <View style={styles.pillOutline} />
                                    )}
                                    <Text style={styles.pillNumber}>{i + 1}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.label}>Missed medication:</Text>
                        <Text style={styles.statusValue}>{status?.missed > 0 ? 'Yes' : 'None'}</Text>
                    </View>

                    {/* IoT Device Status */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>IoT Device Status</Text>
                        <View style={styles.iotStatusRow}>
                            <View style={styles.dotBlack} />
                            <Text style={styles.iotStatusText}>Connected</Text>
                        </View>
                        <Text style={styles.label}>Battery Level:</Text>
                        <Text style={styles.batteryValue}>69%</Text>
                    </View>

                    {/* My Medications Card */}
                    <ImageBackground
                        source={require('../../assets/images/leftMeds.png')}
                        style={styles.card}
                        imageStyle={styles.cardBackgroundImage}
                    >
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { textAlign: 'right' }]}>My medications</Text>
                            <TouchableOpacity
                                style={styles.viewMoreContainer}
                                onPress={() => router.push('/meds')}
                            >
                                <Text style={styles.viewMoreText}>View all medications</Text>
                                <View style={styles.viewMoreLine} />
                            </TouchableOpacity>
                        </View>
                    </ImageBackground>

                    {/* Motivational Footer */}
                    <Text style={styles.footerQuote}>
                        Taking your medication at the same time every day helps your body respond better and makes it easier to remember.
                    </Text>

                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 150, // Space for custom tab bar
    },
    appName: {
        fontSize: 20,
        fontFamily: "DMSerifDisplay_400Regular",
        color: "#000",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 15,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 15,
    },
    notificationBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'red',
        borderWidth: 2,
        borderColor: '#fff',
    },
    profileIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderRadius: 24,
        height: 180,
        marginVertical: 15,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
    },
    cardBackgroundImage: {
        position: 'absolute',
        right: 0,
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        zIndex: 0,
    },
    cardContent: {
        zIndex: 1,
        paddingHorizontal: 20,
        width: '100%',
    },
    cardTitle: {
        fontSize: 18,
        fontFamily: "DMSerifDisplay_400Regular",
        marginBottom: 15,
        color: '#000',
    },
    medicationItem: {
        marginBottom: 10,
    },
    markBtn: {
        alignSelf: 'flex-start',
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#000',
        borderRadius: 6,
    },
    markBtnText: {
        fontSize: 11,
        color: '#fff',
        fontFamily: 'Inter_400Regular',
    },
    medName: {
        fontSize: 16,
        fontFamily: "Inter_400Regular",
        color: '#000',
    },
    medStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 2,
    },
    medSubText: {
        fontSize: 12,
        color: '#666',
        fontFamily: "Inter_400Regular",
    },
    statusBadgeGreen: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    dotGreen: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4CAF50',
    },
    statusTextGreen: {
        fontSize: 10,
        color: '#4CAF50',
        fontFamily: "Inter_400Regular",
    },
    statusBadgeRed: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusTextRed: {
        fontSize: 10,
        color: '#FF3B30',
        fontFamily: "Inter_400Regular",
    },
    section: {
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "DMSerifDisplay_400Regular",
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        color: '#888',
        fontFamily: "Inter_400Regular",
        marginBottom: 8,
    },
    pillRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 15,
    },
    checkedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    uncheckedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pillOutline: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#000',
    },
    pillNumber: {
        fontSize: 16,
        fontFamily: "Inter_700Bold",
    },
    statusValue: {
        fontSize: 16,
        fontFamily: "Inter_400Regular",
        color: '#000',
    },
    iotStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    dotBlack: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#000',
    },
    iotStatusText: {
        fontSize: 14,
        color: '#666',
        fontFamily: "Inter_400Regular",
    },
    batteryValue: {
        fontSize: 24,
        color: '#4CAF50',
        fontFamily: "Inter_700Bold",
    },
    medicationAlignRight: {
        alignItems: 'flex-end',
    },
    divider: {
        height: 1,
        backgroundColor: '#ddd',
        width: '50%',
        alignSelf: 'flex-end',
    },
    viewMoreContainer: {
        alignSelf: 'center',
        marginTop: 15,
        alignItems: 'center',
    },
    viewMoreText: {
        fontSize: 12,
        color: '#000',
        fontFamily: "Inter_700Bold",
    },
    viewMoreLine: {
        height: 1,
        backgroundColor: '#000',
        width: '100%',
        marginTop: 2,
    },
    footerQuote: {
        fontSize: 13,
        color: '#AAA',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 40,
        marginTop: 30,
        fontFamily: "Inter_400Regular",
    },
});
