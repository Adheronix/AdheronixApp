import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "./session";
import { Brand, C, Companion, T } from "./ui";
import { useMotionAllowed } from "../hooks/use-motion-allowed";

const navigation = [
  {
    path: "/home",
    href: "/(tabs)/home",
    label: "Today",
    icon: "sunny-outline",
    selectedIcon: "sunny",
  },
  {
    path: "/meds",
    href: "/(tabs)/meds",
    label: "Medicines",
    icon: "medkit-outline",
    selectedIcon: "medkit",
  },
  {
    path: "/ai",
    href: "/(tabs)/ai",
    label: "Assistant",
    icon: "chatbubble-ellipses-outline",
    selectedIcon: "chatbubble-ellipses",
  },
  {
    path: "/iot",
    href: "/(tabs)/iot",
    label: "MediBox",
    icon: "cube-outline",
    selectedIcon: "cube",
  },
  {
    path: "/support",
    href: "/(tabs)/support",
    label: "You",
    icon: "person-outline",
    selectedIcon: "person",
  },
] as const;

function BottomNavigation({ active }: { active: string }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const index = Math.max(
    0,
    navigation.findIndex((item) => item.path === active),
  );
  const selection = useRef(new Animated.Value(index)).current;
  const motion = useMotionAllowed();
  const itemWidth = (width - 16) / navigation.length;
  useEffect(() => {
    if (!motion) {
      selection.setValue(index);
      return;
    }
    const transition = Animated.spring(selection, {
      toValue: index,
      damping: 23,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [index, motion, selection]);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Main navigation"
      style={{
        backgroundColor: C.white,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingHorizontal: 8,
        paddingTop: 5,
        paddingBottom: Math.max(6, insets.bottom),
      }}
    >
      <View style={{ flexDirection: "row", height: 64 }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 3,
            left: (itemWidth - 48) / 2,
            width: 48,
            height: 31,
            borderRadius: 16,
            backgroundColor: C.mint,
            transform: [
              { translateX: Animated.multiply(selection, itemWidth) },
            ],
          }}
        />
        {navigation.map((item) => {
          const selected = item.path === active;
          return (
            <Pressable
              key={item.path}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-start",
                paddingTop: 3,
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 31,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={selected ? item.selectedIcon : item.icon}
                  size={22}
                  color={selected ? C.primary : C.muted}
                />
              </View>
              <T
                variant="small"
                color={selected ? C.primary : C.muted}
                style={{
                  fontSize: 10.5,
                  lineHeight: 16,
                  fontFamily: selected
                    ? "Inter_600SemiBold"
                    : "Inter_500Medium",
                }}
              >
                {item.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const wide = useWindowDimensions().width >= 960;
  const publicRoute = pathname.startsWith("/auth") || pathname === "/";
  const showNavigation = !!user && !publicRoute;
  useEffect(() => {
    if (!loading && !user && !publicRoute) router.replace("/auth/login");
  }, [loading, user, publicRoute]);
  const active = ["/add-medication", "/scan"].includes(pathname)
    ? "/meds"
    : ["/reports", "/notifications"].includes(pathname)
      ? "/home"
      : pathname;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: wide ? "row" : "column",
        backgroundColor: C.bg,
      }}
    >
      {wide && showNavigation && (
        <View
          style={{
            width: 230,
            padding: 22,
            paddingTop: 32,
            backgroundColor: C.white,
            borderRightWidth: 1,
            borderColor: C.line,
          }}
        >
          <Brand />
          <View style={{ height: 46 }} />
          <T variant="label" color={C.muted}>
            YOUR CARE, EVERY DAY
          </T>
          <View style={{ gap: 7, marginTop: 18 }}>
            {navigation.map((item) => {
              const selected = active === item.path;
              return (
                <Pressable
                  key={item.path}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => router.navigate(item.href)}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: selected
                      ? C.mint
                      : pressed
                        ? C.pale
                        : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  })}
                >
                  <Ionicons
                    name={selected ? item.selectedIcon : item.icon}
                    size={20}
                    color={selected ? C.primary : C.muted}
                  />
                  <T
                    color={selected ? C.primary : C.muted}
                    style={{
                      fontFamily: selected
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                    }}
                  >
                    {item.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1 }} />
          <Companion size={110} />
          <T variant="h3">One step at a time.</T>
          <T variant="small" color={C.muted}>
            A little support for your everyday.
          </T>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {!wide && showNavigation && <BottomNavigation active={active} />}
    </View>
  );
}
