import "./src/i18n/i18n";
import React, { Suspense } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Sentry from "@sentry/react-native";
import HomeScreen from "./src/screens/HomeScreen";
import GameScreen from "./src/screens/GameScreen";
import FruitMergeScreen from "./src/screens/FruitMergeScreen";
import BlackjackScreen from "./src/screens/BlackjackScreen";
import LudoScreen from "./src/screens/LudoScreen";
import { GameState } from "./src/api/client";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useHtmlAttributes } from "./src/i18n/useHtmlAttributes";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!dsn) {
  console.error("[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set — error reporting disabled.");
} else {
  try {
    Sentry.init({
      dsn,
      sendDefaultPii: true,
      enableLogs: true,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1,
      // mobileReplayIntegration and feedbackIntegration are native-only;
      // they throw on web and would silently prevent Sentry from initialising.
      integrations: Platform.OS !== "web"
        ? [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()]
        : [],
    });
  } catch (e) {
    console.error("[Sentry] init failed:", e);
  }
}

export type RootStackParamList = {
  Home: undefined;
  Game: { initialState: GameState };
  FruitMerge: undefined;
  Blackjack: undefined;
  Ludo: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="FruitMerge" component={FruitMergeScreen} />
          <Stack.Screen name="Blackjack" component={BlackjackScreen} />
          <Stack.Screen name="Ludo" component={LudoScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

function App() {
  return (
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
