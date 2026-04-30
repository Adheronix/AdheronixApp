import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HeroArt() {
  return (
    <LinearGradient
      colors={["#060610", "#0C0C1C", "#0A0A0E"]}
      locations={[0, 0.55, 1]}
      style={styles.root}
    >
      {/* Ambient orb — top right, indigo */}
      <View style={styles.orbTopRight} />

      {/* Ambient orb — bottom left, teal */}
      <View style={styles.orbBottomLeft} />

      {/* Ambient orb — small, upper-left */}
      <View style={styles.orbAccent} />

      {/* Subtle horizontal scan-lines */}
      <View style={[styles.scanLine, { top: "28%" }]} />
      <View style={[styles.scanLine, { top: "58%" }]} />

      {/* Diagonal accent line, top-left */}
      <View style={styles.diagLine} />

      {/* Central brand mark */}
      <View style={styles.center}>
        {/* Emblem ring + cross */}
        <View style={styles.emblem}>
          <View style={styles.crossH} />
          <View style={styles.crossV} />
          {/* Corner dots */}
          <View style={[styles.cornerDot, { top: 6, left: 6 }]} />
          <View style={[styles.cornerDot, { top: 6, right: 6 }]} />
          <View style={[styles.cornerDot, { bottom: 6, left: 6 }]} />
          <View style={[styles.cornerDot, { bottom: 6, right: 6 }]} />
        </View>

        <Text style={styles.wordmark}>MEDISAFE</Text>
        <Text style={styles.tagline}>Health with no limits</Text>
      </View>

      {/* Dot grid — bottom-right corner detail */}
      <View style={styles.dotGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },

  // Orbs
  orbTopRight: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -100,
    right: -100,
    backgroundColor: "rgba(72, 96, 255, 0.11)",
  },
  orbBottomLeft: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    bottom: -30,
    left: -80,
    backgroundColor: "rgba(0, 185, 145, 0.08)",
  },
  orbAccent: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    top: 24,
    left: "38%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },

  // Scan lines
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },

  // Diagonal accent
  diagLine: {
    position: "absolute",
    width: 1,
    height: 80,
    top: 20,
    left: 32,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    transform: [{ rotate: "30deg" }],
  },

  // Central brand
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
  },
  emblem: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  crossH: {
    position: "absolute",
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  crossV: {
    position: "absolute",
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  cornerDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.30)",
  },
  wordmark: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255, 255, 255, 0.80)",
    letterSpacing: 5,
  },
  tagline: {
    fontSize: 9,
    fontFamily: "Inter_300Light",
    color: "rgba(255, 255, 255, 0.30)",
    letterSpacing: 1.2,
    marginTop: 6,
  },

  // Dot grid — decorative bottom-right
  dotGrid: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 42,
    height: 30,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
});
