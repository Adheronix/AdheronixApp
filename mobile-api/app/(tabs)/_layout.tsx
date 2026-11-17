import { Tabs } from "expo-router";
export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" />
      <Tabs.Screen name="meds" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="iot" />
      <Tabs.Screen name="support" />
    </Tabs>
  );
}
