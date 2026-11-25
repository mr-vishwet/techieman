module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 / Worklets: the worklets plugin MUST be last in the list.
  plugins: ['react-native-worklets/plugin'],
};
