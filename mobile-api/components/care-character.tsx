import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CareMood } from "../services/character-state";

type Kind = "care" | "assistant" | "box" | "journal";
type Props = {
  size?: number;
  kind?: Kind;
  mood?: CareMood;
  connected?: boolean;
  active?: boolean;
  style?: ViewStyle;
};
const ink = "#173D50";
const s = StyleSheet.create({
  eye: { width: 8, height: 13, borderRadius: 6, backgroundColor: ink },
  happyEye: {
    width: 12,
    height: 9,
    borderRadius: 9,
    borderTopWidth: 3,
    borderColor: ink,
    backgroundColor: "transparent",
  },
  smile: {
    width: 17,
    height: 10,
    borderBottomWidth: 3,
    borderColor: ink,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    alignSelf: "center",
    marginTop: 9,
  },
});

function Face({
  mood = "welcome",
  light = false,
  resting = false,
}: {
  mood?: CareMood;
  light?: boolean;
  resting?: boolean;
}) {
  const happy = mood === "celebrate";
  return (
    <View style={{ width: 58, alignItems: "center" }}>
      <View
        style={{
          flexDirection: "row",
          gap: happy ? 18 : 22,
          alignItems: "center",
          height: 15,
        }}
      >
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              happy ? s.happyEye : s.eye,
              light
                ? {
                    backgroundColor: happy ? "transparent" : "#A4F5E0",
                    borderColor: "#A4F5E0",
                  }
                : null,
              resting ? { backgroundColor: "#86A5B4" } : null,
              mood === "gentle" && i === 1
                ? { height: 10, transform: [{ rotate: "-9deg" }] }
                : null,
            ]}
          >
            {!happy && (
              <View
                style={{
                  width: 2,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: "#FFFFFF99",
                  top: 2,
                  left: 2,
                }}
              />
            )}
          </View>
        ))}
      </View>
      <View
        style={[
          s.smile,
          resting ? { borderColor: "#86A5B4" } : null,
          light ? { borderColor: "#A4F5E0" } : null,
          mood === "ready" ? { width: 11, height: 5, marginTop: 10 } : null,
          mood === "gentle"
            ? {
                width: 8,
                height: 8,
                borderWidth: 2,
                borderRadius: 6,
                borderColor: light ? "#A4F5E0" : ink,
              }
            : null,
          mood === "progress" ? { width: 20, height: 12 } : null,
        ]}
      />
    </View>
  );
}

// Native geometry keeps expressions and connection lights responsive to real state.
export function CareCharacter({
  size = 140,
  kind = "care",
  mood = "welcome",
  connected = false,
  active = true,
  style,
}: Props) {
  const glow = useRef(new Animated.Value(0.4)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const preference = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const app = AppState.addEventListener("change", (value) =>
      setForeground(value === "active"),
    );
    return () => {
      mounted = false;
      preference.remove();
      app.remove();
    };
  }, []);
  useEffect(() => {
    glow.setValue(0.4);
    if (kind !== "box" || !connected || reduceMotion || !active || !foreground)
      return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.75,
          duration: 1800,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(glow, {
          toValue: 0.3,
          duration: 1800,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [kind, connected, reduceMotion, active, foreground, glow]);
  const box = kind === "box";
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        box
          ? connected
            ? "Pill-box companion glowing: recent device signal"
            : "Pill-box companion resting: no recent device signal"
          : kind === "care"
            ? `Care companion, ${mood === "celebrate" ? "happy after today’s patient confirmations" : mood === "progress" ? "encouraging as you record your doses" : mood === "gentle" ? "gently checking in" : "ready to support you"}`
            : `${kind === "assistant" ? "Blue conversation" : "Lavender journal"} companion`
      }
      style={[{ width: size, height: size }, style]}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{
          width: 200,
          height: 200,
          position: "absolute",
          left: (size - 200) / 2,
          top: (size - 200) / 2,
          transform: [{ scale: size / 200 }],
        }}
      >
        {box ? (
          <>
            {connected && (
              <Animated.View
                style={{
                  position: "absolute",
                  left: 16,
                  top: 18,
                  width: 170,
                  height: 170,
                  borderRadius: 90,
                  backgroundColor: "#A6EFDD",
                  opacity: glow,
                  borderWidth: 2,
                  borderColor: "#6CD5BB",
                }}
              />
            )}
            <View
              style={{
                position: "absolute",
                left: 44,
                top: 171,
                width: 113,
                height: 13,
                borderRadius: 60,
                backgroundColor: "#23465D14",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 21,
                top: 104,
                width: 23,
                height: 33,
                borderRadius: 12,
                backgroundColor: "#A5C9D5",
                transform: [{ rotate: "15deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 157,
                top: 104,
                width: 23,
                height: 33,
                borderRadius: 12,
                backgroundColor: "#A5C9D5",
                transform: [{ rotate: "-15deg" }],
              }}
            />
            {[57, 125].map((left) => (
              <View
                key={left}
                style={{
                  position: "absolute",
                  left,
                  top: 157,
                  width: 22,
                  height: 21,
                  borderRadius: 9,
                  backgroundColor: "#497E91",
                }}
              />
            ))}
            <LinearGradient
              colors={["#FFFFFF", "#E7F2F7", "#BDD6E0"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                left: 35,
                top: 62,
                width: 132,
                height: 104,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: "#ACCED9",
              }}
            />
            <LinearGradient
              colors={["#F5FFFF", "#CBE6EA"]}
              style={{
                position: "absolute",
                left: 29,
                top: 43,
                width: 144,
                height: 35,
                borderRadius: 18,
                borderBottomWidth: 4,
                borderColor: "#7CA9B8",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 58,
                top: 36,
                width: 87,
                height: 9,
                borderRadius: 8,
                backgroundColor: "#DFEDF3",
                borderWidth: 1,
                borderColor: "#A9C8D3",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 54,
                top: 87,
                width: 95,
                height: 55,
                borderRadius: 20,
                backgroundColor: "#19445A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Face
                mood={connected ? "celebrate" : "ready"}
                light={connected}
                resting={!connected}
              />
            </View>
            <View
              style={{
                position: "absolute",
                left: 57,
                top: 151,
                width: 89,
                height: 5,
                borderRadius: 4,
                backgroundColor: connected ? "#35B88F" : "#8EA8B4",
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                left: 149,
                top: 55,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: connected ? "#2AB68C" : "#829DAA",
                opacity: connected ? glow : 1,
              }}
            />
          </>
        ) : kind === "assistant" ? (
          <>
            <View
              style={{
                position: "absolute",
                left: 42,
                top: 158,
                width: 117,
                height: 15,
                borderRadius: 60,
                backgroundColor: "#19457110",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 55,
                top: 128,
                width: 31,
                height: 31,
                borderRadius: 7,
                backgroundColor: "#6D9EE1",
                transform: [{ rotate: "25deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 25,
                top: 54,
                width: 34,
                height: 34,
                borderRadius: 20,
                backgroundColor: "#C8DFFF",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 151,
                top: 89,
                width: 24,
                height: 24,
                borderRadius: 14,
                backgroundColor: "#94BCEC",
              }}
            />
            <LinearGradient
              colors={["#DEEFFF", "#A0C9FA", "#6B9CDE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                left: 37,
                top: 42,
                width: 130,
                height: 105,
                borderRadius: 45,
                borderWidth: 1,
                borderColor: "#A5C6F1",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 51,
                top: 52,
                width: 43,
                height: 13,
                borderRadius: 20,
                backgroundColor: "#FFFFFF66",
                transform: [{ rotate: "-16deg" }],
              }}
            />
            <View style={{ position: "absolute", left: 72, top: 84 }}>
              <Face mood="progress" />
            </View>
            <View
              style={{
                position: "absolute",
                left: 156,
                top: 25,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: "#74B5C5",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 172,
                top: 40,
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: "#9FC9E8",
              }}
            />
          </>
        ) : kind === "journal" ? (
          <>
            <View
              style={{
                position: "absolute",
                left: 48,
                top: 170,
                width: 108,
                height: 12,
                borderRadius: 60,
                backgroundColor: "#23355C12",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 63,
                top: 151,
                width: 23,
                height: 26,
                borderRadius: 9,
                backgroundColor: "#7C8CC8",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 119,
                top: 151,
                width: 23,
                height: 26,
                borderRadius: 9,
                backgroundColor: "#7C8CC8",
              }}
            />
            <LinearGradient
              colors={["#E8E9FF", "#B6C2F4", "#8D9EDB"]}
              style={{
                position: "absolute",
                left: 48,
                top: 27,
                width: 109,
                height: 139,
                borderRadius: 25,
                borderLeftWidth: 9,
                borderColor: "#758ABF",
                transform: [{ rotate: "6deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 127,
                top: 29,
                width: 10,
                height: 34,
                backgroundColor: "#4E7F96",
                borderBottomLeftRadius: 5,
                borderBottomRightRadius: 5,
              }}
            />
            <View style={{ position: "absolute", left: 70, top: 78 }}>
              <Face mood="welcome" />
            </View>
            <View
              style={{
                position: "absolute",
                left: 79,
                top: 48,
                width: 49,
                height: 4,
                borderRadius: 4,
                backgroundColor: "#FFFFFF88",
              }}
            />
          </>
        ) : (
          <>
            <View
              style={{
                position: "absolute",
                left: 56,
                top: 177,
                width: 101,
                height: 11,
                borderRadius: 60,
                backgroundColor: "#1E5B5615",
              }}
            />
            {[64, 118].map((left) => (
              <LinearGradient
                key={left}
                colors={["#88D9C9", "#399C96"]}
                style={{
                  position: "absolute",
                  left,
                  top: 153,
                  width: 31,
                  height: 27,
                  borderRadius: 13,
                  transform: [{ rotate: left === 64 ? "-9deg" : "9deg" }],
                }}
              />
            ))}
            <LinearGradient
              colors={["#BBF2DF", "#54BDB0"]}
              style={{
                position: "absolute",
                left: 29,
                top: 95,
                width: 28,
                height: 49,
                borderRadius: 18,
                transform: [{ rotate: "-22deg" }],
              }}
            />
            <LinearGradient
              colors={["#C4F5E5", "#59BFB0"]}
              style={{
                position: "absolute",
                left: 149,
                top: mood === "celebrate" ? 65 : 90,
                width: 27,
                height: 49,
                borderRadius: 18,
                transform: [
                  { rotate: mood === "celebrate" ? "40deg" : "20deg" },
                ],
              }}
            />
            <LinearGradient
              colors={["#D6FAEC", "#8BDDC8", "#42ACA3"]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                left: 47,
                top: 23,
                width: 113,
                height: 141,
                borderTopLeftRadius: 70,
                borderTopRightRadius: 75,
                borderBottomLeftRadius: 60,
                borderBottomRightRadius: 62,
                borderWidth: 1,
                borderColor: "#85CDBF",
                transform: [{ rotate: "-6deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 62,
                top: 36,
                width: 18,
                height: 60,
                borderRadius: 20,
                backgroundColor: "#FFFFFF44",
                transform: [{ rotate: "17deg" }],
              }}
            />
            <View style={{ position: "absolute", left: 78, top: 78 }}>
              <Face mood={mood} />
            </View>
            {mood === "celebrate" &&
              [20, 167, 153].map((left, i) => (
                <View
                  key={left}
                  style={{
                    position: "absolute",
                    left,
                    top: [48, 31, 13][i],
                    width: 7,
                    height: 13,
                    borderRadius: 3,
                    backgroundColor: ["#79B9DE", "#9BD9C5", "#A8B8ED"][i],
                    transform: [{ rotate: `${i * 37}deg` }],
                  }}
                />
              ))}
          </>
        )}
      </View>
    </View>
  );
}
