import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet, Text } from "react-native";
import DashboardScreen from "./src/screens/DashboardScreen";
import ContactsScreen from "./src/screens/ContactsScreen";
import DealsScreen from "./src/screens/DealsScreen";
import ActivitiesScreen from "./src/screens/ActivitiesScreen";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Dashboard: "📊",
  Contacts: "👥",
  Deals: "💰",
  Activities: "📝",
};

function TabIcon({ name }: { name: keyof typeof icons }) {
  return <Text style={styles.icon}>{icons[name] ?? "•"}</Text>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarIcon: () => <TabIcon name={route.name as keyof typeof icons} />,
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Contacts" component={ContactsScreen} />
          <Tab.Screen name="Deals" component={DealsScreen} />
          <Tab.Screen name="Activities" component={ActivitiesScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18 },
});