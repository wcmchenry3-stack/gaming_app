import "./src/i18n/i18n";
import React, { Suspense } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Sentry from "@sentry/react-native";
import HomeScreen from "./src/screens/HomeScreen";
import GameScreen from "./src/screens/GameScreen";
import CascadeScreen from "./src/screens/CascadeScreen";
import BlackjackBettingScreen from "./src/screens/BlackjackBettingScreen";
import BlackjackTableScreen from "./src/screens/BlackjackTableScreen";
import Twenty48Screen from "./src/screens/Twenty48Screen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import BottomTabBar from "./src/components/shared/BottomTabBar";
import { GameState } from "./src/game/yacht/types";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useHtmlAttributes } from "./src/i18n/useHtmlAttributes";
import { NetworkProvider } from "./src/game/_shared/NetworkContext";
import { BlackjackGameProvider } from "./src/game/blackjack/BlackjackGameContext";
import FeedbackButton from "./src/components/FeedbackWidget/FeedbackButton";
import { SessionLogger } from "./src/components/FeedbackWidget/SessionLogger";

// Start capturing console.warn / console.error for feedback submissions
SessionLogger.init();

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!dsn) {
  console.error("[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set — error reporting disabled.");
} else {
  try {
    Sentry.init({
      dsn,
      sendDefaultPii: true,
    });
  } catch (e) {
    console.error("[Sentry] init failed:", e);
  }
}

export type RootStackParamList = {
  MainTabs: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Game: { initialState: GameState };
  Cascade: undefined;
  BlackjackBetting: undefined;
  BlackjackTable: undefined;
  Pachisi: undefined;
  Twenty48: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator();

function LobbyStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Game" component={GameScreen} />
      <HomeStack.Screen name="Cascade" component={CascadeScreen} />
      <HomeStack.Screen name="BlackjackBetting" component={BlackjackBettingScreen} />
      <HomeStack.Screen name="BlackjackTable" component={BlackjackTableScreen} />
      {/* Pachisi disabled — needs total rewrite before re-enabling */}
      {/* <HomeStack.Screen name="Pachisi" component={PachisiScreen} /> */}
      <HomeStack.Screen name="Twenty48" component={Twenty48Screen} />
    </HomeStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Lobby" component={LobbyStack} />
      <Tab.Screen name="Ranks" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppCrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.crash}>
      <Text style={styles.crashText}>Something went wrong.</Text>
      <Pressable style={styles.retryButton} onPress={resetError}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function AppInner() {
  useHtmlAttributes();
  return (
    <NetworkProvider>
      <ThemeProvider>
        <BlackjackGameProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs" component={MainTabs} />
            </Stack.Navigator>
          </NavigationContainer>
          <FeedbackButton />
        </BlackjackGameProvider>
      </ThemeProvider>
    </NetworkProvider>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1 }}>
        <ActivityIndicator style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Sentry.ErrorBoundary fallback={(props) => <AppCrashFallback {...props} />}>
          <Suspense
            fallback={
              <View style={{ flex: 1 }}>
                <ActivityIndicator style={{ flex: 1 }} />
              </View>
            }
          >
            <AppInner />
          </Suspense>
        </Sentry.ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  crashText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default Sentry.wrap(App);
