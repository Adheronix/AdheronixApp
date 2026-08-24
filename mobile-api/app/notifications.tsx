import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { notificationService, NotificationItem } from "../services/notification.service";

export default function NotificationsScreen() {
    const router = useRouter();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingRead, setMarkingRead] = useState(false);

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.list();
            setNotifications(data);
        } catch (error) {
            console.error("Failed to load notifications", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case "medication_reminder": return "medkit";
            case "system_alert": return "alert-circle";
            case "medication_update": return "refresh";
            case "medication_expiry": return "time";
            default: return "notifications";
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case "medication_reminder": return "#4CAF50";
            case "system_alert": return "#FF3B30";
            case "medication_update": return "#2196F3";
            case "medication_expiry": return "#FF9800";
            default: return "#000";
        }
    };

    const formatTime = (createdAt: string) => {
        const created = new Date(createdAt);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes < 1) return "Just now";
        if (diffMinutes < 60) return `${diffMinutes} min ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    };

    const handleMarkAllRead = async () => {
        try {
            setMarkingRead(true);
            await notificationService.markAllAsRead();
            await fetchNotifications();
        } finally {
            setMarkingRead(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity onPress={handleMarkAllRead} disabled={markingRead}>
                    <Text style={styles.markReadText}>{markingRead ? "..." : "Read all"}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {notifications.map((item) => (
                        <TouchableOpacity
                            key={item.notification_id}
                            style={[
                                styles.notificationCard,
                                !item.read_at && styles.unreadCard,
                            ]}
                        >
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: getIconColor(item.type) + "15" },
                                ]}
                            >
                                <Ionicons
                                    name={getIcon(item.type)}
                                    size={24}
                                    color={getIconColor(item.type)}
                                />
                            </View>
                            <View style={styles.contentContainer}>
                                <View style={styles.topRow}>
                                    <Text style={styles.notifTitle}>{item.title}</Text>
                                    <Text style={styles.notifTime}>
                                        {formatTime(item.created_at)}
                                    </Text>
                                </View>
                                <Text style={styles.notifMessage} numberOfLines={2}>
                                    {item.message}
                                </Text>
                            </View>
                            {!item.read_at && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    ))}
                    {notifications.length === 0 && (
                        <Text style={{ textAlign: "center", color: "#999", marginTop: 20 }}>
                            No notifications yet.
                        </Text>
                    )}
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: "#000",
    },
    markReadText: {
        fontSize: 14,
        color: "#666",
    },
    scrollContent: {
        padding: 20,
    },
    notificationCard: {
        flexDirection: "row",
        padding: 15,
        borderRadius: 15,
        backgroundColor: "#fff",
        marginBottom: 15,
        borderWidth: 1,
        borderColor: "#F0F0F0",
        alignItems: "center",
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    unreadCard: {
        backgroundColor: "#F9F9F9",
        borderColor: "#E0E0E0",
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 15,
    },
    contentContainer: {
        flex: 1,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    notifTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#000",
    },
    notifTime: {
        fontSize: 11,
        color: "#AAA",
    },
    notifMessage: {
        fontSize: 14,
        color: "#666",
        lineHeight: 18,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#FF3B30",
        marginLeft: 10,
    },
});
