import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { medicationService } from "../../services/medication.service";

export default function MedsScreen() {
    const router = useRouter();
    const [medications, setMedications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchMedications = async () => {
        try {
            const data = await medicationService.getAll();
            // Map backend data to UI format
            const mappedData = data.map((med: any) => {
                const prescriptionObj = med.prescription || {};
                const prescriptionArray = Array.isArray(prescriptionObj.prescription) ? prescriptionObj.prescription : [];
                const firstMed = prescriptionArray.length > 0 ? prescriptionArray[0] : prescriptionObj;

                // Get unique times from schedules
                const schedules = med.schedules || [];
                const uniqueTimes = [...new Set(schedules.map((s: any) => s.scheduled_time))].sort();

                return {
                    id: med.medication_id,
                    name: firstMed.name || "Medication",
                    duration: med.period,
                    frequency: `${med.frequency} times / day`,
                    times: uniqueTimes,
                    type: med.intake_recommendation?.toLowerCase().includes('pill') ? 'pills' : 'bottle',
                    timeLeft: med.period,
                    time: firstMed.time || (uniqueTimes.length > 0 ? uniqueTimes[0] : 'N/A'),
                    recommendation: med.intake_recommendation
                };
            });
            setMedications(mappedData);
        } catch (error) {
            console.error("Failed to fetch medications:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMedications();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMedications();
    };

    const filteredMedications = medications.filter((med) =>
        med.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <View style={styles.redDot} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
                    <Ionicons name="person" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>Your Medications</Text>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
                    {filteredMedications.length === 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <Text style={{ fontFamily: "Inter_400Regular", color: "#666" }}>
                                {searchQuery ? "No matching medications found." : "No medications found."}
                            </Text>
                        </View>
                    ) : (
                        filteredMedications.map((med) => (
                            <View key={med.id} style={styles.card}>
                                {med.type === 'bottle' ? (
                                    <View style={styles.cardRow}>
                                        <View style={styles.medDetailsLeft}>
                                            <Text style={styles.label}>Name:</Text>
                                            <Text style={styles.value}>{med.name}</Text>

                                            <Text style={[styles.label, { marginTop: 10 }]}>Time for intake:</Text>
                                            <Text style={styles.value}>{med.duration}</Text>

                                            <View style={styles.row}>
                                                <View>
                                                    <Text style={[styles.label, { marginTop: 10 }]}>Frequency:</Text>
                                                    <Text style={styles.value}>{med.frequency}</Text>
                                                </View>
                                                <View style={{ marginLeft: 30 }}>
                                                    <Text style={[styles.label, { marginTop: 10 }]}>Time(s):</Text>
                                                    {med.times && med.times.length > 0 ? med.times.map((t: any, i: number) => (
                                                        <Text key={i} style={styles.value}>{t}</Text>
                                                    )) : <Text style={styles.value}>N/A</Text>}
                                                </View>
                                            </View>

                                            {med.recommendation && (
                                                <>
                                                    <Text style={[styles.label, { marginTop: 10 }]}>Recommendation:</Text>
                                                    <Text style={styles.value}>{med.recommendation}</Text>
                                                </>
                                            )}
                                        </View>
                                        <Image
                                            source={require('../../assets/images/imiti.png')}
                                            style={styles.cardImageBottle}
                                            resizeMode="contain"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.cardRow}>
                                        <Image
                                            source={require('../../assets/images/ibinini.png')}
                                            style={styles.cardImagePills}
                                            resizeMode="contain"
                                        />
                                        <View style={styles.medDetailsRight}>
                                            <Text style={[styles.label, { textAlign: 'right' }]}>Name:</Text>
                                            <Text style={[styles.value, { textAlign: 'right' }]}>{med.name}</Text>

                                            <Text style={[styles.label, { marginTop: 10, textAlign: 'right' }]}>Time for intake:</Text>
                                            <Text style={[styles.value, { textAlign: 'right' }]}>{med.duration}</Text>

                                            <View style={styles.rowRight}>
                                                <View style={{ marginRight: 30 }}>
                                                    <Text style={[styles.label, { marginTop: 10, textAlign: 'right' }]}>Time(s):</Text>
                                                    <Text style={[styles.value, { textAlign: 'right' }]}>{med.time || 'N/A'}</Text>
                                                </View>
                                                <View>
                                                    <Text style={[styles.label, { marginTop: 10, textAlign: 'right' }]}>Time left:</Text>
                                                    <Text style={[styles.value, { textAlign: 'right' }]}>{med.timeLeft}</Text>
                                                </View>
                                            </View>

                                            {med.recommendation && (
                                                <>
                                                    <Text style={[styles.label, { marginTop: 10, textAlign: 'right' }]}>Recommendation:</Text>
                                                    <Text style={[styles.value, { textAlign: 'right' }]}>{med.recommendation}</Text>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        ))
                    )}

                    {/* FAB */}
                    <TouchableOpacity style={styles.fab} onPress={() => router.push('/scan')}>
                        <View style={styles.fabIconContainer}>
                            <Ionicons name="add" size={24} color="#000" />
                        </View>
                        <Text style={styles.fabText}>Add medications</Text>
                    </TouchableOpacity>

                    <View style={{ height: 20 }} />
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
        // Shadow for search
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
    title: {
        fontSize: 28,
        fontFamily: "DMSerifDisplay_400Regular",
        paddingHorizontal: 20,
        marginBottom: 20,
        color: '#000',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    medDetailsLeft: {
        flex: 1,
    },
    medDetailsRight: {
        flex: 1,
    },
    label: {
        fontSize: 11,
        color: '#999',
        fontFamily: "Inter_400Regular",
    },
    value: {
        fontSize: 14,
        color: '#000',
        fontFamily: "Inter_400Regular",
    },
    row: {
        flexDirection: 'row',
    },
    rowRight: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    cardImageBottle: {
        width: 120,
        height: 120,
    },
    cardImagePills: {
        width: 120,
        height: 120,
    },
    fab: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        gap: 12,
        alignSelf: 'center',
        marginVertical: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 70,
    },
    fabIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fabText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: "DMSerifDisplay_400Regular",
    },
});
