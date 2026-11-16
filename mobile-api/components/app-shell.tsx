import { router, usePathname } from "expo-router";
import { useEffect } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "./session";
import { Brand, C, Companion, T } from "./ui";

const navigation = [
  { path: "/home", label: "Today", icon: "grid-outline" as const },
  { path: "/meds", label: "Medication", icon: "medical-outline" as const },
  { path: "/ai", label: "Assistant", icon: "sparkles-outline" as const },
  { path: "/iot", label: "Pill box", icon: "cube-outline" as const },
  { path: "/support", label: "You", icon: "person-outline" as const },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const wide = useWindowDimensions().width >= 960;
  const insets = useSafeAreaInsets();
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
            width: 232,
            padding: 24,
            paddingTop: 36,
            backgroundColor: C.bg,
            borderRightWidth: 1,
            borderColor: C.line,
          }}
        >
          <Brand />
          <View style={{ height: 48 }} />
          <T variant="label" color={C.muted}>
            YOUR EVERYDAY CARE
          </T>
          <View style={{ gap: 6, marginTop: 18 }}>
            {navigation.map((item) => (
              <Pressable
                key={item.path}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active === item.path }}
                onPress={() => router.navigate(item.path)}
                style={{
                  padding: 15,
                  borderRadius: 16,
                  backgroundColor: active === item.path ? C.ink : "transparent",
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active === item.path ? C.accent : C.muted}
                />
                <T color={active === item.path ? C.white : C.muted}>
                  {item.label}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Companion size={140} />
          <T variant="h3">Small steps. Better days.</T>
          <T variant="small" color={C.muted}>
            A little support for your everyday.
          </T>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {!wide && showNavigation && (
        <View
          accessibilityLabel="Main navigation"
          style={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: Math.max(10, insets.bottom),
            backgroundColor: C.bg,
            borderTopWidth: 1,
            borderColor: C.line,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: C.ink,
              borderRadius: 24,
              padding: 5,
              minHeight: 66,
            }}
          >
            {navigation.map((item) => {
              const selected = active === item.path;
              return (
                <Pressable
                  key={item.path}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => router.navigate(item.path)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 56,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    backgroundColor: selected ? "#FFFFFF13" : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={selected ? "#9AE8D8" : "#BDD0DC"}
                  />
                  <T
                    variant="small"
                    color={selected ? "#B9EEE1" : "#BDD0DC"}
                    style={{
                      fontSize: 9,
                      lineHeight: 14,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {item.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
