import "./src/i18n/i18n";
import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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

try {
  Sentry.init({
    dsn: "https://4e8b2bd816cbce3f73b0cd6923530d53@o4511129011093504.ingest.us.sentry.io/4511129020334080",
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
  });
} catch (e) {
  console.warn("Sentry.init failed:", e);
}

export type RootStackParamList = {
  Home: undefined;
  Game: { initialState: GameState };
  FruitMerge: undefined;
  Blackjack: undefined;
  Ludo: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppCrashFallback() {
  return (
    <View style={styles.crash}>
      <Text style={styles.crashText}>Something went wrong.</Text>
      <Text style={styles.crashHint}>Please force-quit and reopen the app.</Text>
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
      <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
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
    marginBottom: 8,
  },
  crashHint: {
    fontSize: 14,
    color: "#666",
  },
});

export default Sentry.wrap(App);
