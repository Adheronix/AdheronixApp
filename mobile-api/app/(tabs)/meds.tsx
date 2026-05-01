import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { medicationService } from "../../services/medication.service";
import Animated, { FadeInUp } from "react-native-reanimated";

export default function MedsScreen() {
    const router = useRouter();
    const [meds, setMeds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMeds = async () => {
        try {
            const data = await medicationService.getAll();
            setMeds(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchMeds(); }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMeds();
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator color="#000" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Medications</Text>
                        <Text style={styles.subtitle}>Your active prescriptions</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => router.push('/scan')}
                    >
                        <Ionicons name="add" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
                >
                    {meds.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="medkit-outline" size={80} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No medications found</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/scan')}>
                                <Text style={styles.emptyBtnText}>Scan a Prescription</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        meds.map((med, index) => (
                            <Animated.View
                                key={med.medication_id}
                                entering={FadeInUp.delay(index * 100)}
                                style={styles.medCard}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.iconBox}>
                                        <Ionicons name="medical" size={24} color="#FFF" />
                                    </View>
                                    <View style={styles.medInfo}>
                                        <Text style={styles.medName}>{(med.prescription?.name || 'Medication')}</Text>
                                        <Text style={styles.medDosage}>{med.dosage || 'Take as directed'}</Text>
                                    </View>
                                    <View style={styles.statusBadge}>
                                        <Text style={styles.statusText}>Active</Text>
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.footerItem}>
                                        <Ionicons name="time-outline" size={16} color="#64748B" />
                                        <Text style={styles.footerText}>{med.frequency || 'Daily'}</Text>
                                    </View>
                                    <View style={styles.footerItem}>
                                        <Ionicons name="calendar-outline" size={16} color="#64748B" />
                                        <Text style={styles.footerText}>{med.period || 'On-going'}</Text>
                                    </View>
                                </View>
                            </Animated.View>
                        ))
                    )}
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
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 25,
        paddingTop: 20,
        paddingBottom: 30,
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: "#000",
    },
    subtitle: {
        fontSize: 14,
        color: "#64748B",
    },
    addBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingBottom: 100,
    },
    medCard: {
        backgroundColor: "#FFF",
        borderRadius: 25,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    medInfo: {
        flex: 1,
        marginLeft: 15,
    },
    medName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
    },
    medDosage: {
        fontSize: 14,
        color: "#64748B",
        marginTop: 2,
    },
    statusBadge: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#0F172A",
    },
    cardFooter: {
        flexDirection: "row",
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        gap: 20,
    },
    footerItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    footerText: {
        fontSize: 13,
        color: "#64748B",
    },
    emptyState: {
        paddingTop: 60,
        alignItems: "center",
    },
    emptyText: {
        color: "#94A3B8",
        fontSize: 18,
        fontWeight: "700",
        marginTop: 20,
        marginBottom: 20,
    },
    emptyBtn: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 20,
    },
    emptyBtnText: {
        color: "#0F172A",
        fontWeight: "700",
    }
});
