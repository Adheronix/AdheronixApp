import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    PanResponder,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleService } from "../../services/schedule.service";
import { notificationService } from "../../services/notification.service";

export default function IotScreen() {
    const router = useRouter();
    const [usageData, setUsageData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [batteryLevel, setBatteryLevel] = useState(69);
    const [barWidth, setBarWidth] = useState(0);
    const [unreadCount, setUnreadCount] = useState<number>(0);

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (evt, gestureState) => {
                if (barWidth > 0) {
                    const newLevel = Math.min(100, Math.max(0, (evt.nativeEvent.locationX / barWidth) * 100));
                    setBatteryLevel(Math.round(newLevel));
                }
            },
            onPanResponderGrant: (evt) => {
                if (barWidth > 0) {
                    const newLevel = Math.min(100, Math.max(0, (evt.nativeEvent.locationX / barWidth) * 100));
                    setBatteryLevel(Math.round(newLevel));
                }
            }
        })
    ).current;

    const fetchUsageData = async () => {
        try {
            const data = await scheduleService.getSchedules();
            // Map backend data to UI format
            const mappedData = data
                .filter((item: any) => item.status === 'taken')
                .map((item: any) => ({
                    id: item.schedule_id,
                    action: "Dose detected",
                    time: item.scheduled_time,
                    date: new Date(item.scheduled_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }),
                    raw: item
                }));
            setUsageData(mappedData.slice(0, 10)); // Just show recent 10
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to fetch usage data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUsageData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchUsageData();
    };

    const filteredUsageData = usageData.filter((item) => {
        const medicationName = item.raw.medication?.prescription?.name?.toLowerCase() || "";
        const action = item.action.toLowerCase();
        const query = searchQuery.toLowerCase();
        return medicationName.includes(query) || action.includes(query);
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchWrapper}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search . . ."
                        placeholderTextColor="#AAA"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <View style={styles.searchIconContainer}>
                        <Ionicons name="search" size={18} color="#000" />
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.notificationButton}
                    onPress={() => router.push('/notifications')}
                >
                    <Ionicons name="notifications" size={24} color="#000" />
                    {unreadCount > 0 && <View style={styles.redDot} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
                    <Ionicons name="person" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <Text style={styles.title}>iot Device</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connection Status</Text>
                    <View style={styles.connectionStatus}>
                        <View style={styles.dotBlack} />
                        <Text style={styles.connectionText}>Connected</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Battery level</Text>
                    <View style={styles.batteryLabels}>
                        <Text style={styles.batteryLabelGreen}>Full</Text>
                        <Text style={styles.batteryLabelRed}>Low</Text>
                    </View>

                    <View
                        style={styles.batteryBarWrapper}
                        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                        {...panResponder.panHandlers}
                    >
                        <LinearGradient
                            colors={['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#F44336']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.batteryGradient}
                        />
                        <View style={[styles.batteryPointer, { left: `${batteryLevel}%` }]} pointerEvents="none">
                            <View style={styles.pointerLine} />
                            <Ionicons name="caret-down" size={12} color="#000" style={styles.pointerIcon} />
                        </View>
                    </View>
                    <Text style={[styles.batteryValueText, { left: `${batteryLevel}%`, marginLeft: -15 }]}>{batteryLevel}%</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Last sync time</Text>
                    <Text style={styles.syncTime}>{usageData.length > 0 ? usageData[0].time : 'N/A'}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Snooze options</Text>
                    <View style={styles.snoozeOptions}>
                        <View style={styles.optionItem}>
                            <Ionicons name="checkbox" size={24} color="#000" />
                            <Text style={styles.optionText}>Resync</Text>
                        </View>
                        <View style={styles.optionItem}>
                            <Ionicons name="square-outline" size={24} color="#CCC" />
                            <Text style={styles.optionText}>Calibrate</Text>
                        </View>
                        <View style={styles.optionItem}>
                            <Ionicons name="square-outline" size={24} color="#CCC" />
                            <Text style={styles.optionText}>Test alert</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Usage data</Text>
                    <Text style={styles.usageSubtitle}>
                        {usageData.length > 0 ? `Device last synced at ${usageData[0].time}` : 'No usage data detected yet'}
                    </Text>

                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : filteredUsageData.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: '#999', marginTop: 10 }}>
                            {searchQuery ? "No matching data found." : "No doses detected recently."}
                        </Text>
                    ) : (
                        filteredUsageData.map((item) => (
                            <View key={item.id} style={styles.usageCard}>
                                <View style={styles.usageCardLeft}>
                                    <View style={styles.bellIconContainer}>
                                        <Ionicons name="notifications" size={24} color="#000" />
                                        <View style={styles.cardRedDot} />
                                    </View>
                                    <View>
                                        <Text style={styles.usageActionText}>{item.action}</Text>
                                        <Text style={{ fontSize: 11, color: '#999' }}>{item.raw.medication?.prescription?.name || 'Medication'}</Text>
                                    </View>
                                </View>
                                <View style={styles.usageCardRight}>
                                    <Text style={styles.usageTimestamp}>{item.time}   {item.date}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        gap: 15,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 25,
        height: 45,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#EEE',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: '#000',
    },
    searchIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#D1D1D1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationButton: {
        position: 'relative',
    },
    redDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
        borderWidth: 1,
        borderColor: '#fff',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontFamily: "DMSerifDisplay_400Regular",
        marginBottom: 30,
        color: '#000',
        textTransform: 'capitalize',
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "Inter_400Regular",
        color: '#333',
        marginBottom: 10,
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dotBlack: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#000',
    },
    connectionText: {
        fontSize: 13,
        color: '#999',
        fontFamily: "Inter_400Regular",
    },
    batteryLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    batteryLabelGreen: {
        fontSize: 11,
        color: '#4CAF50',
        fontFamily: "Inter_400Regular",
    },
    batteryLabelRed: {
        fontSize: 11,
        color: '#F44336',
        fontFamily: "Inter_400Regular",
    },
    batteryBarWrapper: {
        height: 12,
        borderRadius: 6,
        overflow: 'visible',
        position: 'relative',
    },
    batteryGradient: {
        height: '100%',
        borderRadius: 6,
    },
    batteryPointer: {
        position: 'absolute',
        top: -2,
        alignItems: 'center',
        height: 16,
    },
    pointerLine: {
        width: 2,
        height: 14,
        backgroundColor: '#000',
    },
    pointerIcon: {
        marginTop: -3,
    },
    batteryValueText: {
        position: 'relative',
        fontSize: 12,
        color: '#4CAF50',
        fontFamily: "Inter_700Bold",
        textAlign: 'center',
        width: 30,
        marginTop: 5,
    },
    syncTime: {
        fontSize: 14,
        color: '#666',
        fontFamily: "Inter_400Regular",
    },
    snoozeOptions: {
        gap: 12,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    optionText: {
        fontSize: 14,
        color: '#666',
        fontFamily: "Inter_400Regular",
    },
    usageSubtitle: {
        fontSize: 12,
        color: '#AAA',
        fontFamily: "Inter_400Regular",
        marginBottom: 15,
    },
    usageCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    usageCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    bellIconContainer: {
        position: 'relative',
    },
    cardRedDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
        borderWidth: 1,
        borderColor: '#fff',
    },
    usageActionText: {
        fontSize: 14,
        color: '#555',
        fontFamily: "Inter_400Regular",
    },
    usageCardRight: {
        justifyContent: 'flex-end',
    },
    usageTimestamp: {
        fontSize: 10,
        color: '#AAA',
        fontFamily: "Inter_400Regular",
    },
});
