import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import GameScreen from "./src/screens/GameScreen";
import FruitMergeScreen from "./src/screens/FruitMergeScreen";
import { GameState } from "./src/api/client";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

export type RootStackParamList = {
  Home: undefined;
  Game: { initialState: GameState };
  FruitMerge: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
            <Stack.Screen name="FruitMerge" component={FruitMergeScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
