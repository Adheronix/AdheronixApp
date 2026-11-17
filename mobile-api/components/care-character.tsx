import { Image } from "expo-image";
import { useCareProgress } from "./care-progress";
import { memo, useEffect, useRef } from "react";
import { Animated, Easing, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { CareMood } from "../services/character-state";
import { useMotionAllowed } from "../hooks/use-motion-allowed";

type Kind = "care" | "assistant" | "box" | "journal";
type Props = {
  size?: number;
  kind?: Kind;
  mood?: CareMood;
  connected?: boolean;
  active?: boolean;
  style?: ViewStyle;
};
const artwork = {
  care: require("../assets/characters/care-body-v2.png"),
  assistant: require("../assets/characters/assistant-body-v2.png"),
  box: require("../assets/characters/box-body-v2.png"),
  journal: require("../assets/characters/journal-body-v2.png"),
};
const encouraging = {
  care: require("../assets/characters/care-encouraging-v3.png"),
  assistant: require("../assets/characters/assistant-encouraging-v3.png"),
  box: require("../assets/characters/box-encouraging-v3.png"),
  journal: require("../assets/characters/journal-encouraging-v3.png"),
};
const attentive = {
  care: require("../assets/characters/care-attentive-v3.png"),
  assistant: require("../assets/characters/assistant-attentive-v3.png"),
  box: require("../assets/characters/box-attentive-v3.png"),
  journal: require("../assets/characters/journal-attentive-v3.png"),
};
const faceTop = { care: 77, assistant: 82, box: 94, journal: 80 };
const ink = "#16394B";

function Face({
  mood,
  blink,
  emotion,
  light,
  resting,
}: {
  mood: CareMood;
  blink: Animated.Value;
  emotion: Animated.Value;
  light: boolean;
  resting: boolean;
}) {
  const color = light ? "#A8F0DB" : resting ? "#86A9B8" : ink;
  const celebrating = mood === "celebrate";
  const cheerful = celebrating
    ? 1
    : emotion.interpolate({
        inputRange: [0, 1],
        outputRange: [0, mood === "gentle" ? 0.35 : 0.92],
      });
  const normal = celebrating
    ? 0
    : emotion.interpolate({
        inputRange: [0, 1],
        outputRange: [1, mood === "gentle" ? 0.85 : 0.08],
      });
  return (
    <View style={{ width: 70, height: 57, alignItems: "center" }}>
      <Animated.View
        style={{
          width: 60,
          height: 21,
          transform: [
            { scaleY: blink },
            {
              translateX: emotion.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0, -1, 1.6],
              }),
            },
          ],
        }}
      >
        {[9, 43].map((left, i) => (
          <View
            key={left}
            style={{
              position: "absolute",
              left,
              top: 1,
              width: 12,
              height: 18,
            }}
          >
            <Animated.View style={{ opacity: normal }}>
              <LinearGradient
                colors={
                  light
                    ? ["#BDF9E7", "#82DCC5"]
                    : resting
                      ? ["#9AB7C3", "#6F939F"]
                      : ["#244C5A", "#102B39"]
                }
                style={{
                  width: 10,
                  height: resting ? 11 : 16,
                  borderRadius: 7,
                  marginTop: resting ? 3 : 0,
                  transform: [
                    {
                      rotate:
                        mood === "gentle" ? (i ? "-5deg" : "5deg") : "0deg",
                    },
                  ],
                }}
              >
                <View
                  style={{
                    width: 2.5,
                    height: 3.5,
                    borderRadius: 3,
                    backgroundColor: "#FFFFFFB8",
                    top: 2,
                    left: 2,
                  }}
                />
              </LinearGradient>
            </Animated.View>
            <Animated.View
              style={{
                position: "absolute",
                top: 5,
                left: -1,
                width: 13,
                height: 10,
                borderTopWidth: 2.7,
                borderColor: color,
                borderRadius: 12,
                opacity: cheerful,
              }}
            />
          </View>
        ))}
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: 4,
          top: 23,
          width: 10,
          height: 5,
          borderRadius: 6,
          backgroundColor: light ? "#9AEBD4" : "#E8F6F5",
          opacity: emotion.interpolate({
            inputRange: [0, 1],
            outputRange: [0.02, resting ? 0.02 : 0.3],
          }),
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          right: 4,
          top: 23,
          width: 10,
          height: 5,
          borderRadius: 6,
          backgroundColor: light ? "#9AEBD4" : "#E8F6F5",
          opacity: emotion.interpolate({
            inputRange: [0, 1],
            outputRange: [0.02, resting ? 0.02 : 0.3],
          }),
        }}
      />
      <Animated.View
        style={{
          marginTop: 6,
          width: celebrating ? 23 : mood === "gentle" ? 13 : 20,
          height: celebrating ? 14 : mood === "ready" ? 8 : 11,
          borderBottomWidth: celebrating ? 0 : 2.7,
          borderColor: color,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          backgroundColor: celebrating ? color : "transparent",
          transform: [
            {
              scaleX: emotion.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.14],
              }),
            },
            {
              scaleY: emotion.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.2],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

export const CareCharacter = memo(function CareCharacter({
  size = 140,
  kind = "care",
  mood: suppliedMood,
  connected = false,
  active = true,
  style,
}: Props) {
  const { routine } = useCareProgress();
  const mood = suppliedMood ?? routine.mood;
  const pose =
    mood === "gentle"
      ? attentive
      : mood === "progress" || mood === "celebrate"
        ? encouraging
        : artwork;
  const motion = useMotionAllowed(active);
  const blink = useRef(new Animated.Value(1)).current;
  const emotion = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.35)).current;
  const phase = useRef(Math.random()).current;
  useEffect(() => {
    blink.setValue(1);
    emotion.setValue(0);
    float.setValue(0);
    glow.setValue(0.35);
    if (!motion) return;
    const closeEyes = () =>
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.04,
          duration: 95,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(35),
        Animated.timing(blink, {
          toValue: 1,
          duration: 145,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]);
    const blinking = Animated.loop(
      Animated.sequence([
        Animated.delay(3100 + phase * 1100),
        closeEyes(),
        Animated.delay(3900),
        closeEyes(),
        Animated.delay(3300),
        closeEyes(),
        Animated.delay(170),
        closeEyes(),
      ]),
    );
    const expression = Animated.loop(
      Animated.sequence([
        Animated.delay(6200 + phase * 1300),
        Animated.timing(emotion, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(1300),
        Animated.timing(emotion, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(1600),
      ]),
    );
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2100 + phase * 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2100 + phase * 400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const lighting = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.65,
          duration: 1900,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(glow, {
          toValue: 0.3,
          duration: 1900,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const loops =
      connected && kind === "box"
        ? [blinking, expression, breathing, lighting]
        : [blinking, expression, breathing];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [motion, kind, connected, blink, emotion, float, glow, phase]);
  const box = kind === "box";
  const displayedMood = mood;
  const description = box
    ? connected
      ? "MediBox companion glowing after a recent device signal"
      : "MediBox companion resting without a recent device signal"
    : kind === "care"
      ? `Care companion, ${mood === "celebrate" ? "happy after today’s patient confirmations" : mood === "progress" ? "encouraging your progress" : mood === "gentle" ? "gently checking in" : "ready to support you"}`
      : kind === "assistant"
        ? "Blue conversation companion"
        : "Lavender journal companion";
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${description}. ${mood === "celebrate" ? "Celebrating recorded doses" : mood === "gentle" ? "A gentle check-in" : mood === "progress" ? "Encouraging your progress" : "Ready to support you"}.`}
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
        {box && connected && (
          <Animated.View
            style={{
              position: "absolute",
              left: 22,
              top: 32,
              width: 155,
              height: 148,
              borderRadius: 80,
              backgroundColor: "#B3F1DE",
              opacity: glow,
            }}
          />
        )}
        <Animated.View
          style={{
            position: "absolute",
            left: 55,
            top: box ? 177 : kind === "assistant" ? 178 : 190,
            width: 90,
            height: 7,
            borderRadius: 50,
            backgroundColor: "#194A5B0D",
            transform: [
              {
                scaleX: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.94],
                }),
              },
            ],
          }}
        />
        <Animated.View
          style={{
            width: 200,
            height: 200,
            transform: [
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, box ? -0.5 : -2.5],
                }),
              },
              {
                scale: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, box ? 1.002 : 1.008],
                }),
              },
              {
                rotate: emotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    "0deg",
                    box ? "0.5deg" : kind === "assistant" ? "-2deg" : "2deg",
                  ],
                }),
              },
            ],
          }}
        >
          <Image
            accessible={false}
            source={pose[kind]}
            contentFit="contain"
            cachePolicy="memory-disk"
            allowDownscaling
            transition={motion ? 140 : 0}
            style={{ width: 200, height: 200 }}
          />
          {box && connected && (
            <>
              <Animated.View
                style={{
                  position: "absolute",
                  left: 149,
                  top: 50,
                  width: 7.5,
                  height: 7.5,
                  borderRadius: 5,
                  backgroundColor: "#35C69D",
                  opacity: glow,
                }}
              />
              <Animated.View
                style={{
                  position: "absolute",
                  left: 70,
                  top: 144,
                  width: 60,
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: "#44C9A5",
                  opacity: glow,
                }}
              />
            </>
          )}
          <View style={{ position: "absolute", left: 65, top: faceTop[kind] }}>
            <Face
              mood={displayedMood}
              blink={blink}
              emotion={emotion}
              light={box && connected}
              resting={box && !connected}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
});
