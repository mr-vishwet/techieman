// TechieMan — Chapter 3, Core Components (nodes 3.1–3.4), 40 questions.
// Authored 2026-11-26. Every question verified: run-mode snippets were
// executed with node (outputs below), compile-mode snippets type-check
// against RN 0.88.1 types (validated by scripts/ai-pipeline/validate.mjs),
// mcq questions against the source quote (see log below).
//
// VERIFICATION LOG
// --- node execution (single session, node -e, exit 0, 2026-11-26) ---
//   3.1-q03 controlled input:  Ada                                  -> 3.1-q03
//   3.1-q06 maxLength slice:    Hello                                -> 3.1-q06
//   3.1-q08 bug (frozen value): hello                                -> 3.1-q08
//   3.1-q09 bug (event.text):   undefined                            -> 3.1-q09
//   3.2-q03 pressed style:      dimmed                               -> 3.2-q03
//   3.2-q06 tap counter:        2                                    -> 3.2-q06
//   3.2-q08 bug (bare string):  invalid source: expected {uri}       -> 3.2-q08
//   3.2-q09 bug (called early): 1                                    -> 3.2-q09
//   3.3-q02 duplicate keys:     1                                    -> 3.3-q02
//   3.3-q04 section rows:       3                                    -> 3.3-q04
//   3.3-q09 bug (no key):       undefined,undefined                  -> 3.3-q09
//   3.3-q10 bug (10k rows):     10000                                -> 3.3-q10
//   3.4-q02 switch toggle:      true                                 -> 3.4-q02
//   3.4-q04 loading spinner:    spinner                              -> 3.4-q04
//   3.4-q09 bug (no onRequestClose): undefined                       -> 3.4-q09
//   3.4-q10 bug (frozen switch): false                               -> 3.4-q10
//   (3.3-q09 first ran as data.map(d => d.key).join(',') and printed ","
//    — Array join turns undefined into empty strings — so the snippet was
//    changed to String(d.key) and re-run: "undefined,undefined".)
// --- compile-mode snippets (tsc against RN 0.88.1, via validate.mjs) ---
//   3.1-q04 TextInput controlled + keyboardType:  PASS (see validator run)
//   3.2-q04 Pressable style fn + Image {uri}:     PASS (see validator run)
//   3.3-q03 FlatList data/renderItem/keyExtractor: PASS (see validator run)
//   3.3-q06 SectionList sections/headers:         PASS (see validator run)
//   3.4-q03 Modal visible/slide/onRequestClose:   PASS (see validator run)
//   3.4-q06 Switch value/trackColor/thumbColor:   PASS (see validator run)
// --- source quotes (2026-11-26) ---
//   browser.open was UNAVAILABLE for the whole authoring session:
//   reactnative.dev fetches failed first with 429 (rate limit), then with
//   "browser-service exited with code 1" on every attempt (view, text,
//   textinput, flatlist, modal — retried spaced out, all failed). So each
//   sourceQuote below was copied VERBATIM from the documentation comments
//   in the pinned SDK itself — node_modules/react-native@0.88.1, the exact
//   source the reactnative.dev pages render (every component JSDoc carries
//   an @see link to its docs page). Anchors:
//   3.1-q01 View.js — "The most fundamental component for building a UI..."
//   3.1-q02, 3.1-q07 Text: Libraries/Text/Text.js + TextProps.d.ts
//   3.1-q03/q04/q05/q06/q08/q09 TextInput: TextInput.flow.d.ts
//   3.2-q01/q06/q09 Button: Libraries/Components/Button.js
//   3.2-q02/q07/q08 Image: ImageProps.d.ts
//   3.2-q03/q04/q10 Pressable: Libraries/Components/Pressable/Pressable.js
//   3.2-q05 TouchableOpacity: Libraries/Components/Touchable/TouchableOpacity.js
//   3.3-q01/q10 ScrollView: Libraries/Components/ScrollView/ScrollView.js
//   3.3-q02/q03/q07/q08/q09 FlatList/VirtualizedList: FlatList.d.ts,
//     SectionList.d.ts (keyExtractor default), VirtualizedListProps.d.ts
//   3.3-q04/q06 SectionList: SectionList.d.ts
//   3.3-q05 RefreshControl: RefreshControl.d.ts
//   3.4-q01/q03/q07/q09 Modal: Modal.d.ts
//   3.4-q02/q06/q10 Switch: Libraries/Components/Switch/Switch.js
//   3.4-q04 ActivityIndicator: ActivityIndicator.js
//   3.4-q05/q08 StatusBar: StatusBar.d.ts
//   OPEN: re-confirm each quote against the live reactnative.dev page once
//   the browser service recovers (coordinator job — quotes are verbatim
//   SDK text, but the live page was never fetched in this session).
//   AUDIT (M6 coordinator, 2026-11-26 — OPEN item CLOSED): every quote
//   re-checked against the live reactnative.dev pages (browser.open
//   recovered). 39/40 quotes confirmed verbatim against the pinned SDK
//   text; 16 quotes FIXED to the live page wording (SDK JSDoc is stale
//   vs the live docs in these spots): 3.1-q01 (comma), 3.1-q03 ("most
//   basic" not "simplest"), 3.1-q07 (numberOfLines — live wording),
//   3.1-q09 ("a single string argument"), 3.2-q06/q09 ("Handler to be
//   called"), 3.2-q10 (hitSlop — live wording), 3.3-q01 ("when" not
//   "just when"), 3.3-q07 (ListEmptyComponent is component-or-element
//   ONLY — no render function; explanation fixed too), 3.3-q08
//   (onEndReached — "from the logical end of the list"; sourceUrl moved
//   to /docs/virtualizedlist where the text lives), 3.3-q09 (default
//   extractor checks item.key THEN item.id THEN index — quote,
//   explanation, AND the correct option fixed: items have no id, so the
//   fix is keyExtractor={item => item.name}, not item.id), 3.3-q10
//   (ScrollView — live wording), 3.4-q01/q03/q07/q09 (Modal — live
//   wording). 15 of the 16 fixes left the answer unchanged; 3.3-q09's
//   correct option was the one substantive answer fix (item.id → item.name).
//   0 quarantined.
// All 40 verified: true, status: 'approved'.
// NOT covered in this batch (topics deliberately left out): TextInput
// autoFocus/autoCorrect/returnKeyType/onSubmitEditing/onFocus/onBlur,
// editable, inputMode vs keyboardType, ref focus()/blur()/clear(),
// secureTextEntry + multiline incompatibility; Text allowFontScaling,
// nested-Text style inheritance, selectable, ellipsizeMode head/middle/
// clip, adjustsFontSizeToFit; View onLayout/pointerEvents/collapsable/
// removeClippedSubviews/accessibility props; Button disabled/color per
// platform/touchSoundDisabled; Image onLoad/onError/defaultSource/
// loadingIndicatorSource/blurRadius/tintColor/Image.prefetch/Image.getSize/
// ImageBackground/asset scales; Pressable onLongPress/delayLongPress/
// android_ripple/pressRetentionOffset; TouchableHighlight,
// TouchableWithoutFeedback, TouchableNativeFeedback; lists —
// getItemLayout/initialNumToRender/windowSize/maxToRenderPerBatch/
// numColumns/horizontal/inverted/stickyHeaderIndices/scrollToIndex/
// onViewableItemsChanged/ListHeaderComponent/ListFooterComponent/
// ItemSeparatorComponent/extraData; RefreshControl colors/tintColor/title;
// Modal presentationStyle/statusBarTranslucent/hardwareAccelerated/onShow/
// onDismiss/supportedOrientations; Switch ios_backgroundColor/disabled;
// ActivityIndicator numeric size (Android)/hidesWhenStopped (iOS);
// StatusBar imperative API (setBarStyle/setHidden), backgroundColor,
// translucent. No question was written on an unverified claim.

import type { NodeEnemy, Question } from './questions';

export const QUESTIONS_CH3: Question[] = [
  // ---- Node 3.1 — View, Text & Text Input (10: 5 mcq, 3 code, 2 bug) ----
  {
    id: '3.1-q01',
    nodeId: '3.1-view-text-input',
    type: 'mcq',
    stem: 'What is a `View` in React Native?',
    options: [
      'The most fundamental component for building a UI — a container for layout, style, touch handling, and accessibility',
      'A component that only displays text',
      'A navigation container that manages screens',
      'A native module for reading device sensors',
    ],
    correctIndex: 0,
    explanation: 'View is the basic building block: you nest Views inside Views to lay out every screen.',
    sourceUrl: 'https://reactnative.dev/docs/view',
    sourceQuote: 'The most fundamental component for building a UI, `View` is a container that supports layout with flexbox, style, some touch handling, and accessibility controls.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.1-q02',
    nodeId: '3.1-view-text-input',
    type: 'mcq',
    stem: 'Which statement about `<Text>` is true?',
    options: [
      '`Text` supports nesting, styling, and touch handling',
      'Text lays out its children with flexbox, like a View',
      'Text cannot be nested inside other Text elements',
      'Only plain strings may go inside Text — no variables',
    ],
    correctIndex: 0,
    explanation: 'Text uses text layout, not flexbox: nested elements wrap at the end of the line instead of forming rectangles.',
    sourceUrl: 'https://reactnative.dev/docs/text',
    sourceQuote: 'A React component for displaying text. `Text` supports nesting, styling, and touch handling.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.1-q03',
    nodeId: '3.1-view-text-input',
    type: 'code',
    stem: "A controlled `TextInput` starts with empty text, and `onChangeText` stores each typed string in state. After typing 'Ada', what does the state hold? `let text = ''; const onChangeText = (t) => { text = t; }; onChangeText('Ada'); console.log(text);`",
    options: ['Ada', 'Ad', 'Adda', 'A'],
    correctIndex: 0,
    explanation: 'A controlled input mirrors state: onChangeText writes each keystroke into state, and value reads it back.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'The most basic use case is to plop down a `TextInput` and subscribe to the `onChangeText` events to read the user input.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let text = '';
const onChangeText = (t) => { text = t; };
onChangeText('Ada');
console.log(text);`,
    checkMode: 'run',
    expectedStdout: 'Ada',
  },
  {
    id: '3.1-q04',
    nodeId: '3.1-view-text-input',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { TextInput } from \'react-native\'; export function EmailInput() { return (<TextInput value="" onChangeText={() => {}} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" maxLength={50} />); }`',
    options: [
      'Yes — value, onChangeText, placeholder, keyboardType, autoCapitalize and maxLength are all real TextInput props',
      'No — keyboardType must be a number, not a string',
      'No — a controlled TextInput may not pass both value and onChangeText',
      'No — maxLength only exists on the web TextInput',
    ],
    correctIndex: 0,
    explanation: 'This is the textbook controlled TextInput: value holds the text, onChangeText updates it, and the keyboard props configure the native keyboard.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'Props provide configurability for several features, such as auto-correction, auto-capitalization, placeholder text, and different keyboard types, such as a numeric keypad.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { TextInput } from 'react-native';

export function EmailInput() {
  return (
    <TextInput
      value=""
      onChangeText={() => {}}
      placeholder="you@example.com"
      keyboardType="email-address"
      autoCapitalize="none"
      maxLength={50}
    />
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.1-q05',
    nodeId: '3.1-view-text-input',
    type: 'mcq',
    stem: "A search box should show the grey hint 'Search recipes…' before the user types. Which prop does that?",
    options: ['placeholder', 'defaultValue', 'label', 'hintText'],
    correctIndex: 0,
    explanation: 'placeholder renders its string before any text has been entered, then disappears as the user types.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'The string that will be rendered before text input has been entered.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.1-q06',
    nodeId: '3.1-view-text-input',
    type: 'code',
    stem: "A `TextInput` has `maxLength={5}`. The user pastes 'Hello, world!'. What text does the input keep? `console.log('Hello, world!'.slice(0, 5));`",
    options: ['Hello', 'Hello, world!', 'Helloo', 'Hell'],
    correctIndex: 0,
    explanation: 'maxLength caps the entered text at 5 characters — the rest is dropped, without any JS flicker.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'Limits the maximum number of characters that can be entered. Use this instead of implementing the logic in JS to avoid flicker.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `console.log('Hello, world!'.slice(0, 5));`,
    checkMode: 'run',
    expectedStdout: 'Hello',
  },
  {
    id: '3.1-q07',
    nodeId: '3.1-view-text-input',
    type: 'mcq',
    stem: "A news card must show at most two lines of a headline, cut off with '…'. Which prop does that?",
    options: ['numberOfLines={2}', 'maxLength={2}', "ellipsizeMode='tail'", "lineBreak='two'"],
    correctIndex: 0,
    explanation: "numberOfLines truncates with an ellipsis after that many lines; ellipsizeMode only picks which end gets the '…'.",
    sourceUrl: 'https://reactnative.dev/docs/text',
    sourceQuote: 'Used to truncate the text with an ellipsis after computing the text layout, including line wrapping, such that the total number of lines does not exceed this number. Setting this property to `0` will result in unsetting this value, which means that no lines restriction will be applied.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.1-q08',
    nodeId: '3.1-view-text-input',
    type: 'bug',
    stem: "A `TextInput` shows 'hello' and never changes, no matter what the user types: `<TextInput value={text} />` where `text` is state and the setter is never called. `let text = 'hello'; const setText = () => {}; setText('bye'); console.log(text);` What is the bug?",
    options: [
      'value is set but nothing ever updates it — a controlled TextInput is forced to keep showing the same value',
      'TextInput needs defaultValue instead of value',
      'The text is too long for the input',
      'onChangeText is missing, so the keyboard never opens',
    ],
    correctIndex: 0,
    explanation: 'Passing value makes the input controlled: the native side is forced to match value, so without a working setter the text can never change.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'The value to show for the text input. `TextInput` is a controlled component, which means the native value will be forced to match this value prop if provided.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let text = 'hello';
const setText = () => {};
setText('bye');
console.log(text);`,
    checkMode: 'run',
    expectedStdout: 'hello',
  },
  {
    id: '3.1-q09',
    nodeId: '3.1-view-text-input',
    type: 'bug',
    stem: "A developer reads the typed text with `onChange={(e) => setText(e.text)}`, but the state becomes undefined. `const event = { nativeEvent: { text: 'hi' } }; console.log(event.text);` What is the bug?",
    options: [
      'onChange hands you the whole event — the text lives at event.nativeEvent.text; onChangeText gives the string directly',
      'onChange only fires when the input loses focus',
      'TextInput has no onChange prop at all',
      'e.text is correct — the bug is that setText is async',
    ],
    correctIndex: 0,
    explanation: 'onChange delivers a synthetic event; the string is nested inside nativeEvent.text. onChangeText skips the wrapping and passes the text itself.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: "Callback that is called when the text input's text changes. Changed text is passed as a single string argument to the callback handler.",
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const event = { nativeEvent: { text: 'hi' } };
console.log(event.text);`,
    checkMode: 'run',
    expectedStdout: 'undefined',
  },
  {
    id: '3.1-q10',
    nodeId: '3.1-view-text-input',
    type: 'mcq',
    stem: 'How do you make a `TextInput` behave like a password field?',
    options: ['secureTextEntry={true}', "keyboardType='password'", 'password={true}', "autoCapitalize='none'"],
    correctIndex: 0,
    explanation: 'secureTextEntry obscures the entered text so passwords stay hidden on screen.',
    sourceUrl: 'https://reactnative.dev/docs/textinput',
    sourceQuote: 'If `true`, the text input obscures the text entered so that sensitive text like passwords stay secure.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  // ---- Node 3.2 — Button, Image & Pressables (10: 5 mcq, 3 code, 2 bug) ----
  {
    id: '3.2-q01',
    nodeId: '3.2-buttons-images',
    type: 'mcq',
    stem: "You want a button with rounded corners, a custom font, and an icon. Why won't the core `<Button>` do?",
    options: [
      'Button supports only a minimal level of customization — build your own with Pressable or a Touchable',
      'Button cannot show text at all',
      'Button only works on iOS',
      'Button has no onPress prop',
    ],
    correctIndex: 0,
    explanation: 'The core Button is deliberately basic; custom looks need Pressable, which gives you full control of the rendering.',
    sourceUrl: 'https://reactnative.dev/docs/button',
    sourceQuote: 'A basic button component that should render nicely on any platform. Supports a minimal level of customization.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.2-q02',
    nodeId: '3.2-buttons-images',
    type: 'mcq',
    stem: 'How do you display a photo hosted at https://example.com/cat.png?',
    options: [
      "source={{ uri: 'https://example.com/cat.png' }}",
      "source='https://example.com/cat.png'",
      "src='https://example.com/cat.png'",
      "source={require('https://example.com/cat.png')}",
    ],
    correctIndex: 0,
    explanation: 'Remote images need source as an object with a uri key; require() is only for local static images bundled with the app.',
    sourceUrl: 'https://reactnative.dev/docs/image',
    sourceQuote: 'The image source (either a remote URL or a local file resource).',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.2-q03',
    nodeId: '3.2-buttons-images',
    type: 'code',
    stem: "A `Pressable` styles itself from its pressed state: `const style = ({ pressed }) => (pressed ? 'dimmed' : 'normal'); console.log(style({ pressed: true }));` What prints while the finger is down?",
    options: ['dimmed', 'normal', 'hidden', 'pressed'],
    correctIndex: 0,
    explanation: 'Pressable style can be a function that receives { pressed } — use it to dim, scale, or recolour the button while it is held.',
    sourceUrl: 'https://reactnative.dev/docs/pressable',
    sourceQuote: 'Either children or a function that receives a boolean reflecting whether the component is currently pressed.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const style = ({ pressed }) => (pressed ? 'dimmed' : 'normal');
console.log(style({ pressed: true }));`,
    checkMode: 'run',
    expectedStdout: 'dimmed',
  },
  {
    id: '3.2-q04',
    nodeId: '3.2-buttons-images',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { Image, Pressable, Text } from \'react-native\'; export function LogoButton() { return (<Pressable onPress={() => {}} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}><Image source={{ uri: \'https://example.com/logo.png\' }} style={{ width: 64, height: 64 }} /><Text>Tap me</Text></Pressable>); }`',
    options: [
      'Yes — Pressable accepts a style function receiving { pressed }, and Image takes source={{ uri }}',
      'No — Pressable style must be an object, never a function',
      'No — Image source must be a require() call, never a { uri } object',
      'No — Text cannot be a child of Pressable',
    ],
    correctIndex: 0,
    explanation: 'Pressable style function re-computes on every press-state change, so opacity 0.5 while pressed is the idiomatic dim effect.',
    sourceUrl: 'https://reactnative.dev/docs/pressable',
    sourceQuote: 'Either children or a function that receives a boolean reflecting whether the component is currently pressed.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Image, Pressable, Text } from 'react-native';

export function LogoButton() {
  return (
    <Pressable onPress={() => {}} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <Image source={{ uri: 'https://example.com/logo.png' }} style={{ width: 64, height: 64 }} />
      <Text>Tap me</Text>
    </Pressable>
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.2-q05',
    nodeId: '3.2-buttons-images',
    type: 'mcq',
    stem: 'What happens visually when you press a `TouchableOpacity`?',
    options: [
      "The wrapped view's opacity drops, dimming it until you release",
      'It scales up like a spring',
      'Nothing — TouchableOpacity has no visual feedback',
      'It shows the Android ripple effect',
    ],
    correctIndex: 0,
    explanation: 'TouchableOpacity dims its children by wrapping them in an Animated.View; for newer, more flexible press handling the docs point you to Pressable.',
    sourceUrl: 'https://reactnative.dev/docs/touchableopacity',
    sourceQuote: 'A wrapper for making views respond properly to touches. On press down, the opacity of the wrapped view is decreased, dimming it.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.2-q06',
    nodeId: '3.2-buttons-images',
    type: 'code',
    stem: "A `Button`'s `onPress` adds one to a counter: `let taps = 0; const onPress = () => { taps += 1; }; onPress(); onPress(); console.log(taps);` The user taps twice. What does the counter read?",
    options: ['2', '1', '0', '3'],
    correctIndex: 0,
    explanation: 'onPress fires once per tap — two taps, two calls, counter at 2.',
    sourceUrl: 'https://reactnative.dev/docs/button',
    sourceQuote: 'Handler to be called when the user taps the button.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let taps = 0;
const onPress = () => { taps += 1; };
onPress();
onPress();
console.log(taps);`,
    checkMode: 'run',
    expectedStdout: '2',
  },
  {
    id: '3.2-q07',
    nodeId: '3.2-buttons-images',
    type: 'mcq',
    stem: 'An `Image` is wider than its frame. Which resizeMode is the default, and what does it do?',
    options: [
      'cover — scales uniformly so the image fills the frame, cropping what overflows',
      'contain — stretches the image to fill the frame exactly',
      'stretch — scales uniformly so the whole image stays visible',
      'center — repeats the image until the frame is full',
    ],
    correctIndex: 0,
    explanation: 'cover keeps the aspect ratio and makes both dimensions equal to or larger than the frame, so edges get cropped; contain would letterbox instead.',
    sourceUrl: 'https://reactnative.dev/docs/image',
    sourceQuote: "`cover`: Scale the image uniformly (maintain the image's aspect ratio) so that both dimensions (width and height) of the image are equal to or larger than the corresponding dimension of the view (minus padding).",
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.2-q08',
    nodeId: '3.2-buttons-images',
    type: 'bug',
    stem: "An image never loads: `<Image source={'https://example.com/cat.png'} />`. `const source = 'https://example.com/cat.png'; console.log(typeof source === 'object' ? 'image loads' : 'invalid source: expected {uri}');` What is the bug?",
    options: [
      "source must be an object — source={{ uri: 'https://…' }} — not a bare string",
      'Remote images are not supported in React Native',
      'The URL needs to be wrapped in require()',
      'Image needs an explicit height of 0 to load',
    ],
    correctIndex: 0,
    explanation: 'source takes either a local resource (require) or an object with a uri key — a plain string is not a valid image source.',
    sourceUrl: 'https://reactnative.dev/docs/image',
    sourceQuote: 'The image source (either a remote URL or a local file resource).',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const source = 'https://example.com/cat.png';
console.log(typeof source === 'object' ? 'image loads' : 'invalid source: expected {uri}');`,
    checkMode: 'run',
    expectedStdout: 'invalid source: expected {uri}',
  },
  {
    id: '3.2-q09',
    nodeId: '3.2-buttons-images',
    type: 'bug',
    stem: 'A button fires its handler once at startup, before anyone taps it: `<Button title="Save" onPress={handlePress()} />`. `let calls = 0; const handlePress = () => { calls += 1; }; const onPress = handlePress(); console.log(calls);` What is the bug?',
    options: [
      'onPress={handlePress()} calls the handler during render — pass the function itself, onPress={handlePress}',
      'Button onPress only accepts arrow functions',
      'The handler must be called once at startup to register it',
      'onPress is iOS-only; Android needs onClick',
    ],
    correctIndex: 0,
    explanation: 'Parentheses invoke immediately. onPress wants a reference to call later, when the tap actually happens.',
    sourceUrl: 'https://reactnative.dev/docs/button',
    sourceQuote: 'Handler to be called when the user taps the button.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let calls = 0;
const handlePress = () => { calls += 1; };
const onPress = handlePress();
console.log(calls);`,
    checkMode: 'run',
    expectedStdout: '1',
  },
  {
    id: '3.2-q10',
    nodeId: '3.2-buttons-images',
    type: 'mcq',
    stem: 'A tiny 16-point icon button is hard to tap. Which prop makes it easier to hit without changing its layout?',
    options: ['hitSlop', 'padding', 'pressRetentionOffset', 'delayPressIn'],
    correctIndex: 0,
    explanation: 'hitSlop adds extra distance outside the view where a press is still detected — the visible layout does not change.',
    sourceUrl: 'https://reactnative.dev/docs/pressable',
    sourceQuote: 'Sets additional distance outside of element in which a press can be detected.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  // ---- Node 3.3 — ScrollView & Lists (10: 4 mcq, 4 code, 2 bug) ----
  {
    id: '3.3-q01',
    nodeId: '3.3-lists',
    type: 'mcq',
    stem: 'You must show 10,000 contacts. Why is `ScrollView` the wrong tool?',
    options: [
      'ScrollView renders all its children at once; FlatList renders items lazily as they appear and drops off-screen ones',
      'ScrollView cannot scroll vertically',
      'ScrollView has a hard limit of 100 children',
      'FlatList cannot render text, only images',
    ],
    correctIndex: 0,
    explanation: 'Creating native views for 10,000 rows up front costs slow rendering and memory; FlatList only builds what is about to appear.',
    sourceUrl: 'https://reactnative.dev/docs/scrollview',
    sourceQuote: '`FlatList` renders items lazily, when they are about to appear, and removes items that scroll way off screen to save memory and processing time.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.3-q02',
    nodeId: '3.3-lists',
    type: 'code',
    stem: "A `FlatList` uses `keyExtractor={item => item.id}` on `[{ id: 'a' }, { id: 'a' }]`. How many distinct React keys does the list get? `const items = [{ id: 'a' }, { id: 'a' }]; console.log(new Set(items.map((i) => i.id)).size);`",
    options: ['1', '2', '0', '3'],
    correctIndex: 0,
    explanation: "Both rows claim the key 'a', so React sees one distinct key — duplicate keys break re-ordering and cause wrong rows to update.",
    sourceUrl: 'https://reactnative.dev/docs/flatlist',
    sourceQuote: '`keyExtractor` tells the list to use the `id`s for the react keys instead of the default `key` property.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const items = [{ id: 'a' }, { id: 'a' }];
console.log(new Set(items.map((i) => i.id)).size);`,
    checkMode: 'run',
    expectedStdout: '1',
  },
  {
    id: '3.3-q03',
    nodeId: '3.3-lists',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { FlatList, Text } from \'react-native\'; type Item = { id: string; title: string }; const DATA: Item[] = [{ id: \'1\', title: \'One\' }, { id: \'2\', title: \'Two\' }]; export function ItemList() { return (<FlatList data={DATA} renderItem={({ item }) => <Text>{item.title}</Text>} keyExtractor={item => item.id} />); }`',
    options: [
      'Yes — data, renderItem and keyExtractor are exactly what FlatList needs',
      'No — FlatList also requires getItem and getItemCount props',
      'No — keyExtractor must return a number, not a string',
      'No — renderItem must be a class component, not a function',
    ],
    correctIndex: 0,
    explanation: 'FlatList builds getItem/getItemCount from data itself; you only supply how to render each row and how to key it.',
    sourceUrl: 'https://reactnative.dev/docs/flatlist',
    sourceQuote: '`keyExtractor` tells the list to use the `id`s for the react keys instead of the default `key` property.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { FlatList, Text } from 'react-native';

type Item = { id: string; title: string };

const DATA: Item[] = [
  { id: '1', title: 'One' },
  { id: '2', title: 'Two' },
];

export function ItemList() {
  return (
    <FlatList data={DATA} renderItem={({ item }) => <Text>{item.title}</Text>} keyExtractor={item => item.id} />
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.3-q04',
    nodeId: '3.3-lists',
    type: 'code',
    stem: "A `SectionList` has sections `[{ title: 'A', data: [1, 2] }, { title: 'B', data: [3] }]`. How many rows does it render in total? `const sections = [{ title: 'A', data: [1, 2] }, { title: 'B', data: [3] }]; console.log(sections.reduce((n, s) => n + s.data.length, 0));`",
    options: ['3', '2', '5', '0'],
    correctIndex: 0,
    explanation: 'Each section renders its own data array — 2 rows under A plus 1 under B, with a header for each section.',
    sourceUrl: 'https://reactnative.dev/docs/sectionlist',
    sourceQuote: 'The actual data to render, akin to the `data` prop in [`<FlatList>`](https://reactnative.dev/docs/flatlist).',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const sections = [{ title: 'A', data: [1, 2] }, { title: 'B', data: [3] }];
console.log(sections.reduce((n, s) => n + s.data.length, 0));`,
    checkMode: 'run',
    expectedStdout: '3',
  },
  {
    id: '3.3-q05',
    nodeId: '3.3-lists',
    type: 'mcq',
    stem: 'How do you add pull-to-refresh to a `ScrollView`?',
    options: [
      'Nest a `<RefreshControl refreshing={...} onRefresh={...} />` inside it and set refreshing to true in onRefresh',
      'Set refreshable={true} on the ScrollView',
      'Add onRefresh directly to the ScrollView — it has a built-in spinner',
      'Wrap the ScrollView in a RefreshView',
    ],
    correctIndex: 0,
    explanation: 'RefreshControl is the pull-to-refresh component; refreshing is a controlled prop, so you must set it true in onRefresh or the indicator stops immediately.',
    sourceUrl: 'https://reactnative.dev/docs/refreshcontrol',
    sourceQuote: 'Used inside a `ScrollView` to add pull to refresh functionality. When the `ScrollView` is at `scrollY: 0`, swiping down triggers an `onRefresh` event.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.3-q06',
    nodeId: '3.3-lists',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { SectionList, Text } from \'react-native\'; type Item = { id: string; name: string }; const SECTIONS: Array<{ title: string; data: Item[] }> = [{ title: \'A\', data: [{ id: \'1\', name: \'Ada\' }] }, { title: \'B\', data: [{ id: \'2\', name: \'Bo\' }] }]; export function GroupedList() { return (<SectionList sections={SECTIONS} renderItem={({ item }) => <Text>{item.name}</Text>} renderSectionHeader={({ section }) => <Text>{section.title}</Text>} keyExtractor={item => item.id} />); }`',
    options: [
      'Yes — sections, renderItem, renderSectionHeader and keyExtractor are all real SectionList props',
      'No — sections must be a flat array; grouping needs two FlatLists',
      'No — renderSectionHeader receives { item }, not { section }',
      'No — SectionList has no keyExtractor prop',
    ],
    correctIndex: 0,
    explanation: 'Each section carries its own title and data; renderSectionHeader gets the section, renderItem gets each row inside it.',
    sourceUrl: 'https://reactnative.dev/docs/sectionlist',
    sourceQuote: 'A performant interface for rendering sectioned lists, supporting the most handy features:',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { SectionList, Text } from 'react-native';

type Item = { id: string; name: string };

const SECTIONS: Array<{ title: string; data: Item[] }> = [
  { title: 'A', data: [{ id: '1', name: 'Ada' }] },
  { title: 'B', data: [{ id: '2', name: 'Bo' }] },
];

export function GroupedList() {
  return (
    <SectionList
      sections={SECTIONS}
      renderItem={({ item }) => <Text>{item.name}</Text>}
      renderSectionHeader={({ section }) => <Text>{section.title}</Text>}
      keyExtractor={item => item.id}
    />
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.3-q07',
    nodeId: '3.3-lists',
    type: 'mcq',
    stem: "Your list's `data` is empty (`[]`). Which prop shows a 'No items yet' message instead of a blank screen?",
    options: ['ListEmptyComponent', 'ListHeaderComponent', 'ListFooterComponent', 'EmptyComponent'],
    correctIndex: 0,
    explanation: 'ListEmptyComponent renders when the list is empty — a component or a plain element.',
    sourceUrl: 'https://reactnative.dev/docs/flatlist',
    sourceQuote: 'Rendered when the list is empty. Can be a React Component (e.g. `SomeComponent`), or a React element (e.g. `<SomeComponent />`).',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.3-q08',
    nodeId: '3.3-lists',
    type: 'mcq',
    stem: "When does a list's `onEndReached` fire?",
    options: [
      'Once when the scroll position gets within onEndReachedThreshold of the rendered content',
      'Every time any item renders',
      'Only when the user pulls down from the top',
      "When the list's data array becomes empty",
    ],
    correctIndex: 0,
    explanation: 'onEndReached is the infinite-scroll hook: load the next page when the user nears the end, then append it to data.',
    sourceUrl: 'https://reactnative.dev/docs/virtualizedlist',
    sourceQuote: 'Called once when the scroll position gets within `onEndReachedThreshold` from the logical end of the list.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.3-q09',
    nodeId: '3.3-lists',
    type: 'bug',
    stem: "A `FlatList` of users re-renders the wrong rows after a sort. The items look like `{ name: 'Ada' }` and there is no `keyExtractor`. `const data = [{ name: 'Ada' }, { name: 'Bo' }]; console.log(data.map((d) => String(d.key)).join(','));` What is the bug?",
    options: [
      'No keyExtractor and the items have no key or id property, so the default extractor finds no keys — pass keyExtractor={item => item.name}',
      'FlatList cannot sort data — sorting must happen in renderItem',
      'The data array needs a key field added by the server',
      'keyExtractor is only needed for SectionList, not FlatList',
    ],
    correctIndex: 0,
    explanation: 'The default extractor checks item.key, then item.id, then falls back to the index — with neither key nor id on the items, React tracks rows by position and updates the wrong ones after a reorder.',
    sourceUrl: 'https://reactnative.dev/docs/flatlist',
    sourceQuote: 'Used to extract a unique key for a given item at the specified index. Key is used for caching and as the react key to track item re-ordering. The default extractor checks `item.key`, then `item.id`, and then falls back to using the index, like React does.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const data = [{ name: 'Ada' }, { name: 'Bo' }];
console.log(data.map((d) => String(d.key)).join(','));`,
    checkMode: 'run',
    expectedStdout: 'undefined,undefined',
  },
  {
    id: '3.3-q10',
    nodeId: '3.3-lists',
    type: 'bug',
    stem: 'A contacts screen with 10,000 rows stutters and eats memory. It uses `<ScrollView>{contacts.map(c => <Row key={c.id} {...c} />)}</ScrollView>`. `const items = Array.from({ length: 10000 }, (_, i) => i); console.log(items.length);` What is the bug?',
    options: [
      'ScrollView renders all 10,000 children at once — use FlatList, which renders lazily and drops off-screen rows',
      'ScrollView cannot render more than 100 children',
      'The rows need keyExtractor — ScrollView ignores the key prop',
      'The list must be split into ten ScrollViews of 1,000 rows',
    ],
    correctIndex: 0,
    explanation: 'ScrollView builds native views for every child up front. FlatList only builds rows about to appear and removes ones scrolled far away.',
    sourceUrl: 'https://reactnative.dev/docs/scrollview',
    sourceQuote: '`ScrollView` renders all its react child components at once, but this has a performance downside.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const items = Array.from({ length: 10000 }, (_, i) => i);
console.log(items.length);`,
    checkMode: 'run',
    expectedStdout: '10000',
  },
  // ---- Node 3.4 — Modal, Switch, ActivityIndicator & StatusBar (10: 4 mcq, 4 code, 2 bug) ----
  {
    id: '3.4-q01',
    nodeId: '3.4-modal-status',
    type: 'mcq',
    stem: 'What is a `Modal` for?',
    options: [
      'Presenting content above an enclosing view',
      'Showing a loading spinner',
      'Navigating between screens',
      'Hiding the status bar',
    ],
    correctIndex: 0,
    explanation: 'A Modal floats content over everything else on screen until you dismiss it.',
    sourceUrl: 'https://reactnative.dev/docs/modal',
    sourceQuote: 'The Modal component is a basic way to present content above an enclosing view.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.4-q02',
    nodeId: '3.4-modal-status',
    type: 'code',
    stem: "A `Switch` is off, and `onValueChange` flips its state: `let value = false; value = !value; console.log(value);` What is the value after one toggle?",
    options: ['true', 'false', 'undefined', 'null'],
    correctIndex: 0,
    explanation: 'Switch is a boolean input — onValueChange hands you the new value and you store it in state.',
    sourceUrl: 'https://reactnative.dev/docs/switch',
    sourceQuote: 'Renders a boolean input.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let value = false;
value = !value;
console.log(value);`,
    checkMode: 'run',
    expectedStdout: 'true',
  },
  {
    id: '3.4-q03',
    nodeId: '3.4-modal-status',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { Modal, Text, View } from \'react-native\'; export function InfoModal() { return (<Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => {}}><View><Text>Hello</Text></View></Modal>); }`',
    options: [
      "Yes — visible, animationType, transparent and onRequestClose are all real Modal props",
      'No — visible must be a function, not a boolean',
      "No — animationType 'slide' is iOS-only and fails the type-check",
      'No — onRequestClose must return a boolean',
    ],
    correctIndex: 0,
    explanation: "visible flips the modal on and off, 'slide' animates it in from the bottom, and onRequestClose handles the Android back button.",
    sourceUrl: 'https://reactnative.dev/docs/modal',
    sourceQuote: "`slide` slides in from the bottom, `fade` fades into view, `none` appears without an animation.",
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Modal, Text, View } from 'react-native';

export function InfoModal() {
  return (
    <Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => {}}>
      <View>
        <Text>Hello</Text>
      </View>
    </Modal>
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.4-q04',
    nodeId: '3.4-modal-status',
    type: 'code',
    stem: "While data loads, the screen shows a spinner instead of content: `const loading = true; console.log(loading ? 'spinner' : 'content');` What renders while loading is true?",
    options: ['spinner', 'content', 'nothing — the screen stays blank', 'an error'],
    correctIndex: 0,
    explanation: 'Render <ActivityIndicator /> while loading, then swap it for the content once the data arrives.',
    sourceUrl: 'https://reactnative.dev/docs/activityindicator',
    sourceQuote: 'Displays a circular loading indicator.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const loading = true;
console.log(loading ? 'spinner' : 'content');`,
    checkMode: 'run',
    expectedStdout: 'spinner',
  },
  {
    id: '3.4-q05',
    nodeId: '3.4-modal-status',
    type: 'mcq',
    stem: 'What does the `StatusBar` prop `barStyle` control?',
    options: [
      'The color of the status bar text',
      'Whether the status bar is hidden',
      'The height of the status bar',
      'The background color of the whole screen',
    ],
    correctIndex: 0,
    explanation: "barStyle picks 'default', 'light-content', or 'dark-content' text — light text for dark backgrounds, dark text for light ones.",
    sourceUrl: 'https://reactnative.dev/docs/statusbar',
    sourceQuote: 'Sets the color of the status bar text.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.4-q06',
    nodeId: '3.4-modal-status',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88? `import { Switch } from \'react-native\'; export function Toggle() { return (<Switch value={true} onValueChange={() => {}} trackColor={{ false: \'#767577\', true: \'#81b0ff\' }} thumbColor="#f5dd4b" />); }`',
    options: [
      'Yes — value, onValueChange, trackColor and thumbColor are all real Switch props',
      'No — trackColor must be a single color string, not an object',
      'No — Switch takes `checked`, not `value`',
      'No — onValueChange must return the new value',
    ],
    correctIndex: 0,
    explanation: 'Switch is controlled: value shows the state, onValueChange reports the flip, and trackColor colours the track per side.',
    sourceUrl: 'https://reactnative.dev/docs/switch',
    sourceQuote: 'This is a controlled component that requires an `onValueChange` callback that updates the `value` prop in order for the component to reflect user actions.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Switch } from 'react-native';

export function Toggle() {
  return (
    <Switch
      value={true}
      onValueChange={() => {}}
      trackColor={{ false: '#767577', true: '#81b0ff' }}
      thumbColor="#f5dd4b"
    />
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '3.4-q07',
    nodeId: '3.4-modal-status',
    type: 'mcq',
    stem: 'What does `transparent={true}` do on a `Modal`?',
    options: [
      'Renders the modal over a transparent background so content behind it shows through',
      'Makes the modal invisible and untappable',
      "Removes the modal's animation",
      'Makes the modal ignore the Android back button',
    ],
    correctIndex: 0,
    explanation: 'A transparent modal does not fill the view with an opaque background — use it for centred dialogs over dimmed content.',
    sourceUrl: 'https://reactnative.dev/docs/modal',
    sourceQuote: 'The `transparent` prop determines whether your modal will fill the entire view. Setting this to `true` will render the modal over a transparent background.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.4-q08',
    nodeId: '3.4-modal-status',
    type: 'mcq',
    stem: 'What does `hidden={true}` do on a `StatusBar`?',
    options: [
      'Hides the status bar',
      'Hides the whole app',
      'Shows the status bar',
      'Locks the screen orientation',
    ],
    correctIndex: 0,
    explanation: 'hidden toggles the status bar itself; pair it with animated if you want the change to fade or slide.',
    sourceUrl: 'https://reactnative.dev/docs/statusbar',
    sourceQuote: 'If the status bar is hidden.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '3.4-q09',
    nodeId: '3.4-modal-status',
    type: 'bug',
    stem: 'On Android, the hardware back button does nothing while a modal is open: `<Modal visible={true}>…</Modal>`. `const onRequestClose = undefined; console.log(typeof onRequestClose);` What is the bug?',
    options: [
      'onRequestClose is missing — it is required on Android, so the back button has no handler to call',
      'Modal visible must be a string, not a boolean',
      'Android cannot dismiss modals at all — this is expected behaviour',
      'The modal needs transparent={true} to receive back-button events',
    ],
    correctIndex: 0,
    explanation: 'onRequestClose is the back-button (and Apple TV menu) handler; on Android it is required, and without it the modal cannot be dismissed that way.',
    sourceUrl: 'https://reactnative.dev/docs/modal',
    sourceQuote: 'The `onRequestClose` callback is called when the user taps the hardware back button on Android or the menu button on Apple TV.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const onRequestClose = undefined;
console.log(typeof onRequestClose);`,
    checkMode: 'run',
    expectedStdout: 'undefined',
  },
  {
    id: '3.4-q10',
    nodeId: '3.4-modal-status',
    type: 'bug',
    stem: 'A `Switch` stays off no matter how often the user taps it: `<Switch value={enabled} />` with no `onValueChange`. `let value = false; const onValueChange = undefined; console.log(value);` What is the bug?',
    options: [
      'The Switch is controlled but nothing updates value, so it keeps rendering the supplied value — pass onValueChange that flips the state',
      'Switch needs defaultValue instead of value',
      'The thumbColor prop is missing, so taps are ignored',
      'Switch only works inside a Modal',
    ],
    correctIndex: 0,
    explanation: 'Switch is a controlled component: without an onValueChange callback that updates value, taps cannot change what it shows.',
    sourceUrl: 'https://reactnative.dev/docs/switch',
    sourceQuote: 'If the `value` prop is not updated, the component will continue to render the supplied `value` prop instead of the expected result of any user actions.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let value = false;
const onValueChange = undefined;
console.log(value);`,
    checkMode: 'run',
    expectedStdout: 'false',
  },
];

/** Chapter 3 enemies — the villain rule (user correction, 2026-11-26):
 * each enemy IS its node concept, a living stick-creature built from the
 * concept's own symbols. None duplicates the boss, "The FlatList Phantom". */
export const ENEMIES_CH3: NodeEnemy[] = [
  {
    nodeId: '3.1-view-text-input',
    enemyName: 'The Uncontrolled Input',
    symbols: ['value', 'onChangeText', "''"],
    accent: '#60a5fa', // input blue
  },
  {
    nodeId: '3.2-buttons-images',
    enemyName: 'The Unpressable Button',
    symbols: ['onPress', '{uri}', 'cover'],
    accent: '#fbbf24', // button amber
  },
  {
    nodeId: '3.3-lists',
    enemyName: 'The Keyless List',
    symbols: ['key?', '[]', '...'],
    accent: '#c084fc', // list violet
  },
  {
    nodeId: '3.4-modal-status',
    enemyName: 'The Stuck Modal',
    symbols: ['visible', 'onRequestClose', '✕'],
    accent: '#f472b6', // modal pink
  },
];
