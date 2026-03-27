import "./src/i18n/i18n";
import React, { Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import GameScreen from "./src/screens/GameScreen";
import FruitMergeScreen from "./src/screens/FruitMergeScreen";
import { GameState } from "./src/api/client";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useHtmlAttributes } from "./src/i18n/useHtmlAttributes";

export type RootStackParamList = {
  Home: undefined;
  Game: { initialState: GameState };
  FruitMerge: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppInner() {
  useHtmlAttributes();
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="FruitMerge" component={FruitMergeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense
        fallback={
          <View style={{ flex: 1 }}>
            <ActivityIndicator style={{ flex: 1 }} />
          </View>
        }
      >
        <AppInner />
      </Suspense>
    </GestureHandlerRootView>
  );
}
