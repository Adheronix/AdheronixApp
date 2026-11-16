import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AssistantSessionProvider } from "../components/assistant-session";
import { AppShell } from "../components/app-shell";
import { SessionProvider } from "../components/session";
import { ActivityIndicator, View } from "react-native";
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F9FC",
        }}
      >
        <ActivityIndicator color="#176B92" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <AssistantSessionProvider>
          <AppShell>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "fade",
                animationDuration: 140,
              }}
            />
          </AppShell>
        </AssistantSessionProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
