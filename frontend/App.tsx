import "./src/utils/appTiming"; // must be first — captures JS-side cold-start timestamp
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
import ProfileScreen from "./src/screens/ProfileScreen";
import BottomTabBar from "./src/components/shared/BottomTabBar";
import { GameState } from "./src/game/yacht/types";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useHtmlAttributes } from "./src/i18n/useHtmlAttributes";
import { NetworkProvider } from "./src/game/_shared/NetworkContext";
import { BlackjackGameProvider } from "./src/game/blackjack/BlackjackGameContext";
import { SessionLogger } from "./src/components/FeedbackWidget/SessionLogger";

const CascadeScreen = React.lazy(() => import("./src/screens/CascadeScreen"));
const BlackjackBettingScreen = React.lazy(() => import("./src/screens/BlackjackBettingScreen"));
const BlackjackTableScreen = React.lazy(() => import("./src/screens/BlackjackTableScreen"));
const Twenty48Screen = React.lazy(() => import("./src/screens/Twenty48Screen"));
const SolitaireScreen = React.lazy(() => import("./src/screens/SolitaireScreen"));
const HeartsScreen = React.lazy(() => import("./src/screens/HeartsScreen"));
const SudokuScreen = React.lazy(() => import("./src/screens/SudokuScreen"));
const LeaderboardScreen = React.lazy(() => import("./src/screens/LeaderboardScreen"));
const GameDetailScreen = React.lazy(() => import("./src/screens/GameDetailScreen"));
const SettingsScreen = React.lazy(() => import("./src/screens/SettingsScreen"));

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
  Twenty48: undefined;
  Solitaire: undefined;
  Hearts: undefined;
  Sudoku: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  GameDetail: { gameId: string };
};

function withSuspense<P extends object>(Component: React.ComponentType<P>): React.FC<P> {
  const Wrapped = (props: P) => (
    <Suspense
      fallback={
        <View style={{ flex: 1 }}>
          <ActivityIndicator style={{ flex: 1 }} />
        </View>
      }
    >
      <Component {...props} />
    </Suspense>
  );
  Wrapped.displayName = `WithSuspense(${Component.displayName ?? Component.name ?? "Component"})`;
  return Wrapped;
}

const LazyCascadeScreen = withSuspense(CascadeScreen);
const LazyBlackjackBettingScreen = withSuspense(BlackjackBettingScreen);
const LazyBlackjackTableScreen = withSuspense(BlackjackTableScreen);
const LazyTwenty48Screen = withSuspense(Twenty48Screen);
const LazySolitaireScreen = withSuspense(SolitaireScreen);
const LazyHeartsScreen = withSuspense(HeartsScreen);
const LazySudokuScreen = withSuspense(SudokuScreen);
const LazyLeaderboardScreen = withSuspense(LeaderboardScreen);
const LazyGameDetailScreen = withSuspense(GameDetailScreen);
const LazySettingsScreen = withSuspense(SettingsScreen);

const Stack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator();

function LobbyStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Game" component={GameScreen} />
      <HomeStack.Screen name="Cascade" component={LazyCascadeScreen} />
      <HomeStack.Screen name="BlackjackBetting" component={LazyBlackjackBettingScreen} />
      <HomeStack.Screen name="BlackjackTable" component={LazyBlackjackTableScreen} />
      <HomeStack.Screen name="Twenty48" component={LazyTwenty48Screen} />
      <HomeStack.Screen name="Solitaire" component={LazySolitaireScreen} />
      <HomeStack.Screen name="Hearts" component={LazyHeartsScreen} />
      <HomeStack.Screen name="Sudoku" component={LazySudokuScreen} />
    </HomeStack.Navigator>
  );
}

function ProfileStack() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStackNav.Screen name="GameDetail" component={LazyGameDetailScreen} />
    </ProfileStackNav.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Lobby" component={LobbyStack} />
      <Tab.Screen name="Ranks" component={LazyLeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} />
      <Tab.Screen name="Settings" component={LazySettingsScreen} />
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
