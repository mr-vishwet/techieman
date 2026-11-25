// TechieMan — app entry (M1 scaffold, v1.1 React Native).
// GestureHandlerRootView is required by react-native-gesture-handler;
// NavigationContainer hosts the Roadmap → Fight stack (plan §7.1).

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { RoadmapMapScreen } from './src/screens/RoadmapMapScreen';
import { FightScreen } from './src/screens/FightScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { LeagueScreen } from './src/screens/LeagueScreen';
import { useGameStore } from './src/store/useGameStore';
import type { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NavTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.crimson,
    background: colors.void,
    card: colors.voidCard,
    text: colors.cream,
    border: colors.voidSoft,
    notification: colors.crimson,
  },
};

function App() {
  const hydrate = useGameStore(s => s.hydrate);
  // M3/M4: seed the question bank + load the progression snapshot once.
  // hydrate() never throws — on failure the store runs in-memory.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.void }}>
      <StatusBar barStyle="light-content" />
      <NavigationContainer theme={NavTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: colors.void },
            headerTintColor: colors.cream,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.void },
          }}>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'TechieMan' }}
          />
          <Stack.Screen
            name="Roadmap"
            component={RoadmapMapScreen}
            options={{ title: 'Roadmap' }}
          />
          <Stack.Screen
            name="Fight"
            component={FightScreen}
            options={{ title: 'Fight' }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Save your progress' }}
          />
          <Stack.Screen
            name="League"
            component={LeagueScreen}
            options={{ title: 'Weekly league' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
