import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Roadmap: undefined;
  Fight: { nodeId: string };
  Login: undefined;
  League: undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type FightScreenProps = NativeStackScreenProps<RootStackParamList, 'Fight'>;
