import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
          position: 'absolute',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: "Meds",
          tabBarIcon: ({ color }) => <Ionicons name="medkit-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color }) => (
            <View style={{
              width: 64,
              height: 64,
              backgroundColor: '#000000',
              borderRadius: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 35,
              borderWidth: 4,
              borderColor: '#FFF',
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}>
              <Ionicons name="chatbubble-ellipses" size={28} color="#FFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="iot"
        options={{
          title: "IoT",
          tabBarIcon: ({ color }) => <Ionicons name="flash-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          tabBarIcon: ({ color }) => <Ionicons name="help-circle-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
