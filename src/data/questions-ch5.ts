// TechieMan — Chapter 5, nodes 5.1 (Gesture Handling) + 5.2 (Screen Navigation)
// + 5.3 (Animations) + 5.4 (DeepLinking), 40 questions.
// Authored 2026-11-26. Every question verified: run-mode snippets were executed
// with node, compile-mode snippets type-checked against the pinned SDK
// (validator runs tsc), mcq/bug questions against the fetched source page
// (see log below).
//
// VERIFICATION LOG
// --- node execution (single run, node -e, exit 0) ---
//   5.1-q06 swipe threshold: dx=120, dy=15 -> swipe-right
//   5.1-q07 fling threshold: vx=1.5 -> fling
//   5.1-q09 moveX bug: startX=200, moveX=210, moveX>100 -> true (buggy: finger moved 10px)
//   5.1-q10 pageX bug: pageX=350 in a 100-wide box at x=300 -> out-of-bounds
//   5.2-q06 stack push/pop: Home>Profile>Settings, pop -> Home>Profile
//   5.2-q07 navigate-to-existing: go('Profile') on [Home,Profile] -> Home>Profile (no duplicate)
//   5.2-q09 missing param: new URL('techieman://profile').searchParams.get('userId') -> no-user
//   5.2-q10 login stack: [Login] push Home -> screen under top is Login
//   5.3-q05 interpolation: lerp 0->100 at t=0.5 -> 50
//   5.3-q06 rotation units: 90 -> 90deg
//   5.3-q09 timing without start: started flag stays false
//   5.3-q10 extrapolate extend: 0->100 at input 1.5 -> 150 (not clamped)
//   5.4-q05 URL parse: new URL('techieman://fight/react-native?chapter=5') -> pathname
//     '/react-native' (host is 'fight'), chapter '5' -> /react-native|5
//   5.4-q06 scheme: new URL('techieman://profile/42').protocol -> techieman:
//   5.4-q09 cold-start bug: no 'url' event fired -> link-lost
//   5.4-q10 unencoded &: 'techieman://search?q=react native&chapter=5' -> q is 'react native'
// --- compile-mode snippets (tsc against RN 0.88.1 types, via validator) ---
//   5.1-q08 PanResponder.create + panHandlers spread on View
//   5.2-q08 hand-rolled two-screen navigator: useState<Screen> + conditional render
//   5.3-q07 Animated.timing with useNativeDriver: true
//   5.3-q08 Animated.event mapping ScrollView onScroll to Animated.Value
//   5.4-q07 Linking.addEventListener('url') + getInitialURL() in a hook
//   5.4-q08 Linking.canOpenURL() guard before openURL()
// --- source pages fetched (browser.open, 2026-11-25/26) ---
//   5.1-q01/q02/q10 RN gesture responder https://reactnative.dev/docs/gesture-responder-system
//   5.1-q03/q04 RN Pressable             https://reactnative.dev/docs/pressable
//   5.1-q05/q06/q07/q08/q09 RN PanResponder https://reactnative.dev/docs/panresponder
//   5.1-q10 (locationX/pageX) also on the gesture-responder page above
//   5.2-q01/q08 react.dev useState       https://react.dev/reference/react/useState
//   5.2-q02/q03/q05/q06/q07/q10 Android deep links
//     https://developer.android.com/training/app-links/deep-linking
//   5.2-q04 RN Linking (custom scheme vs https)
//     https://reactnative.dev/docs/linking
//   5.2-q09 MDN URL                     https://developer.mozilla.org/en-US/docs/Web/API/URL
//   5.3-q01..q10 RN animations          https://reactnative.dev/docs/animations
//   5.4-q01/q02/q07/q08/q09 RN Linking  https://reactnative.dev/docs/linking
//   5.4-q03 Android deep links (App Links) — same Android URL as above
//   5.4-q04 Apple associated domains    https://developer.apple.com/documentation/xcode/supporting-associated-domains
//   5.4-q05/q06/q10 MDN URL             https://developer.mozilla.org/en-US/docs/Web/API/URL
//   ScrollView docs (https://reactnative.dev/docs/scrollview) also fetched; used only as
//   background for the 5.3-q08 onScroll mapping, whose quote comes from the animations page.
//   HOST LESSON (validator run 1, 2026-11-26): the validator's allowed list contains
//   bare `expo.dev` but NOT `docs.expo.dev` (it strips only a `www.` prefix), so the
//   Expo Router intro, Expo linking guide and Expo Linking SDK pages — all fetched and
//   quoted in run 1 — FAIL G1. Those 11 questions were re-sourced to react.dev,
//   developer.android.com, reactnative.dev and MDN (see above); no docs.expo.dev URL
//   remains in this file. Do not cite docs.expo.dev in future chapters unless the
//   validator's ALLOWED_HOSTS gains it.
// --- API names checked against the installed SDK (not just docs) ---
//   `useAnimatedValue` does NOT exist in react-native 0.88.1 types (grep of the
//   Animated .d.ts files finds nothing) — no question uses it.
//   react-native-reanimated 4.8.0 types DO export useSharedValue, withTiming,
//   withSpring, useAnimatedStyle, withRepeat, withDelay, withSequence, runOnJS
//   (confirmed by grep of node_modules/react-native-reanimated/lib/typescript).
//   AUDIT (M6 coordinator, 2026-11-26): the 5.2-q06/q07/q10 quote ("Follow
//   the design guidance described in Navigation with Back and Up…") is
//   VERBATIM on the live Android deep-linking page. Sourcing is SOFT — the
//   quote states back-navigation expectations, while the questions test
//   stack push/pop/replace semantics — but those semantics are
//   execution-verified by the run-mode snippets. No fix, 0 quarantined.
// All 40 verified: true, status: 'approved'.
// NOT covered in this batch (topics deliberately left out): react-native-reanimated
// API details (useSharedValue/withTiming) — the Expo Reanimated SDK page fetch hit a
// 429 rate limit and its upstream docs (docs.swmansion.com) are not on the pipeline's
// allowed-host list, so no question ships on reanimated specifics despite the API
// names being confirmed present in the installed 4.8.0 types; react-native-gesture-handler
// (TapGestureHandler etc.) — same reason, its docs host is not allowed; React Navigation
// stack/tab/drawer API details (navigate vs push, goBack, createNativeStackNavigator,
// tab bar) — those facts live only on reactnavigation.org, which is not an allowed
// source host, and @react-navigation/native 7.5.2 / native-stack 7.21.1 are installed
// but no question may cite them without an allowed-host source; Expo Router file-based
// routing (file becomes route, every screen deep linkable) — the facts live on
// docs.expo.dev, which the validator rejects as a host (see HOST LESSON above), so
// no question ships on them; swipe-to-go-back / iOS interactive pop gesture;
// LayoutAnimation presets (easeInEaseOut etc.) beyond the Android UIManager flag.
// No question was written on an unverified claim.

import type { NodeEnemy, Question } from './questions';

export const QUESTIONS_CH5: Question[] = [
  // ---- Node 5.1 — Gesture Handling (10 questions: 5 mcq, 3 code, 2 bug) ----
  {
    id: '5.1-q01',
    nodeId: '5.1-gestures',
    type: 'mcq',
    stem: 'A View wants to become the touch responder as soon as a finger touches it. Which handler should return true?',
    options: [
      'onResponderGrant',
      'onStartShouldSetResponder',
      'onResponderRelease',
      'onResponderTerminate',
    ],
    correctIndex: 1,
    explanation: 'onStartShouldSetResponder is the negotiation question the system asks at touch start: return true to claim the touch.',
    sourceUrl: 'https://reactnative.dev/docs/gesture-responder-system',
    sourceQuote: 'View.props.onStartShouldSetResponder: evt => true, - Does this view want to become responder on the start of a touch?',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.1-q02',
    nodeId: '5.1-gestures',
    type: 'mcq',
    stem: 'A parent View contains a tappable child, but the parent must claim every touch before the child can. Which handler does the parent use?',
    options: [
      'onMoveShouldSetResponder on the child',
      'onResponderTerminationRequest returning false',
      'onStartShouldSetResponderCapture returning true',
      'onResponderGrant on the child',
    ],
    correctIndex: 2,
    explanation: 'The capture phase runs before bubbling, so a parent returning true from onStartShouldSetResponderCapture claims the touch first.',
    sourceUrl: 'https://reactnative.dev/docs/gesture-responder-system',
    sourceQuote: 'if a parent View wants to prevent the child from becoming responder on a touch start, it should have a `onStartShouldSetResponderCapture` handler which returns true.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.1-q03',
    nodeId: '5.1-gestures',
    type: 'mcq',
    stem: 'How long must a user hold a Pressable before `onLongPress` fires, by default?',
    options: [
      '100 milliseconds',
      '250 milliseconds',
      '500 milliseconds',
      '1000 milliseconds',
    ],
    correctIndex: 2,
    explanation: 'Pressable waits 500ms after onPressIn before firing onLongPress — customise it with the delayLongPress prop.',
    sourceUrl: 'https://reactnative.dev/docs/pressable',
    sourceQuote: 'If the person leaves their finger longer than 500 milliseconds before removing it, `onLongPress` is triggered.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.1-q04',
    nodeId: '5.1-gestures',
    type: 'mcq',
    stem: 'A button is too small to tap reliably. Which Pressable prop grows the tappable area beyond the visible element?',
    options: [
      'pressRetentionOffset',
      'android_ripple',
      'hitSlop',
      'delayLongPress',
    ],
    correctIndex: 2,
    explanation: 'hitSlop adds distance outside the element where a press can still be detected — the touch area never extends past the parent bounds.',
    sourceUrl: 'https://reactnative.dev/docs/pressable',
    sourceQuote: 'Sets additional distance outside of element in which a press can be detected.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.1-q05',
    nodeId: '5.1-gestures',
    type: 'mcq',
    stem: 'In a PanResponder `gestureState`, what do `dx` and `dy` measure?',
    options: [
      'The velocity of the gesture in pixels per second',
      'The latest screen coordinates of the touch',
      'The accumulated distance of the gesture since the touch started',
      'The size of the view being dragged',
    ],
    correctIndex: 2,
    explanation: 'dx/dy accumulate from the touch start, while moveX/moveY are the latest absolute screen coordinates and vx/vy are velocities.',
    sourceUrl: 'https://reactnative.dev/docs/panresponder',
    sourceQuote: '`dx` - accumulated distance of the gesture since the touch started',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.1-q06',
    nodeId: '5.1-gestures',
    type: 'code',
    stem: 'A swipe is a mostly-horizontal move of more than 100 points. What does this print for dx = 120, dy = 15? `console.log(Math.abs(dx) > 100 && Math.abs(dx) > Math.abs(dy) ? \'swipe-right\' : \'tap\');`',
    options: ['swipe-right', 'tap', 'swipe-left', 'swipe-up'],
    correctIndex: 0,
    explanation: '120 beats the 100-point threshold and dominates the 15-point vertical drift, so the gesture classifies as a horizontal swipe.',
    sourceUrl: 'https://reactnative.dev/docs/panresponder',
    sourceQuote: 'The accumulated gesture distance since becoming responder is `gestureState.d{x,y}`',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const dx = 120; const dy = 15; console.log(Math.abs(dx) > 100 && Math.abs(dx) > Math.abs(dy) ? 'swipe-right' : 'tap');`,
    checkMode: 'run',
    expectedStdout: 'swipe-right',
  },
  {
    id: '5.1-q07',
    nodeId: '5.1-gestures',
    type: 'code',
    stem: 'A fling is a release with |velocity| over 1. What does this print for vx = 1.5? `console.log(Math.abs(vx) > 1 ? \'fling\' : \'drag\');`',
    options: ['fling', 'drag', 'tap', 'long-press'],
    correctIndex: 0,
    explanation: 'gestureState.vx is the current horizontal velocity, so 1.5 clears the fling threshold — a slow release would be a plain drag.',
    sourceUrl: 'https://reactnative.dev/docs/panresponder',
    sourceQuote: '`vx` - current velocity of the gesture',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const vx = 1.5; console.log(Math.abs(vx) > 1 ? 'fling' : 'drag');`,
    checkMode: 'run',
    expectedStdout: 'fling',
  },
  {
    id: '5.1-q08',
    nodeId: '5.1-gestures',
    type: 'code',
    stem: 'Which snippet correctly wires a PanResponder to a View so it can be dragged?',
    options: [
      'Pass `panResponder` itself as the `style` prop of the View',
      'Spread `panResponder.panHandlers` onto the View: `<View {...panResponder.panHandlers} />`',
      'Call `PanResponder.create()` inside `onPanResponderMove` on every move',
      'Attach the handlers with `View.addEventListener(\'pan\', panResponder)`',
    ],
    correctIndex: 1,
    explanation: 'PanResponder.create returns an object whose panHandlers carry the responder props — spreading them onto the View is the documented usage pattern.',
    sourceUrl: 'https://reactnative.dev/docs/panresponder',
    sourceQuote: 'return <View {...panResponder.panHandlers} />;',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { useRef } from 'react';
import { PanResponder, View } from 'react-native';

export function DraggableCard() {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        console.log(gestureState.dx, gestureState.dy);
      },
      onPanResponderRelease: () => {},
    }),
  ).current;
  return <View {...panResponder.panHandlers} />;
}`,
    checkMode: 'compile',
  },
  {
    id: '5.1-q09',
    nodeId: '5.1-gestures',
    type: 'bug',
    stem: 'A swipe detector fires when the finger has moved only 10 points. The check is `if (gestureState.moveX > 100) swipe()`. The touch started at x = 200 and is now at x = 210. What does `console.log(moveX > 100)` print, and what is the bug?',
    options: [
      'Prints false — moveX is measured from the touch start, so the threshold is never reached',
      'Prints true — `moveX` is the absolute screen coordinate, so use `dx`, the distance moved since the touch started',
      'Prints true — PanResponder only updates moveX after 100 points, so lower the threshold to 10',
      'Prints false — the touch started outside the view, so moveX is always 0 inside a view',
    ],
    correctIndex: 1,
    explanation: 'moveX is where the finger is on screen (210), not how far it travelled (10). dx is the accumulated distance since the touch started — that is the swipe signal.',
    sourceUrl: 'https://reactnative.dev/docs/panresponder',
    sourceQuote: '`moveX` - the latest screen coordinates of the recently-moved touch',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const startX = 200; const moveX = 210; const swiped = moveX > 100; console.log(swiped);`,
    checkMode: 'run',
    expectedStdout: 'true',
  },
  {
    id: '5.1-q10',
    nodeId: '5.1-gestures',
    type: 'bug',
    stem: 'A drag handle lives in a 100-point-wide box whose left edge is at page x = 300. The code positions the handle at `evt.nativeEvent.pageX`, and a touch lands at pageX = 350. What does the position check print, and what is the bug?',
    options: [
      'Prints inside — pageX already accounts for the box offset',
      'Prints out-of-bounds — the box is too small, widen it to 350 points',
      'Prints out-of-bounds — `pageX` is relative to the root element, so use `locationX`, which is relative to the element',
      'Prints inside — locationX is measured from the screen edge, so add the box offset',
    ],
    correctIndex: 2,
    explanation: 'pageX = 350 is the touch position on the whole screen; inside the box that is only 50 points in. locationX gives the position relative to the element itself.',
    sourceUrl: 'https://reactnative.dev/docs/gesture-responder-system',
    sourceQuote: '`pageX` - The X position of the touch, relative to the root element',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const pageX = 350; const boxLeft = 300; const dotX = pageX; console.log(dotX > 100 ? 'out-of-bounds' : 'inside');`,
    checkMode: 'run',
    expectedStdout: 'out-of-bounds',
  },
  // ---- Node 5.2 — Screen Navigation (10 questions: 5 mcq, 3 code, 2 bug) ----
  {
    id: '5.2-q01',
    nodeId: '5.2-navigation',
    type: 'mcq',
    stem: 'In React Native, what is the simplest way to switch between two screens without installing a navigation library?',
    options: [
      'Keep the current screen in state and conditionally render the matching screen',
      'Call `Linking.openURL()` with the screen name',
      'Render both screens at once and hide one with `display: none`',
      'Reload the app with a different entry file per screen',
    ],
    correctIndex: 0,
    explanation: 'A state variable holding the current screen plus conditional rendering is a complete minimal navigator — the setter triggers a re-render with the new screen.',
    sourceUrl: 'https://react.dev/reference/react/useState',
    sourceQuote: 'The `set` function returned by `useState` lets you update the state to a different value and trigger a re-render.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.2-q02',
    nodeId: '5.2-navigation',
    type: 'mcq',
    stem: 'Two apps on a phone both register the same deep-link URI, and the user has set no default. What does Android do when the link is tapped?',
    options: [
      'It opens the app that was installed first',
      'It crashes — two apps may not register the same URI',
      'It lets the user pick an app from a disambiguation dialog',
      'It always opens the web browser instead',
    ],
    correctIndex: 2,
    explanation: 'Android routes in order: the user default first, then the only matching app, then a disambiguation dialog when several match.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Allow the user to select an app from a *disambiguation dialog*.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.2-q03',
    nodeId: '5.2-navigation',
    type: 'mcq',
    stem: 'Your Android intent filter matches a deep link, but tapping the link in a browser never opens your app. Which missing category is the cause?',
    options: [
      'DEFAULT — without it the activity cannot be started at all',
      'BROWSABLE — without it, clicking a link in a browser cannot resolve to your app',
      'LAUNCHER — without it the app has no icon',
      'VIEWABLE — without it the intent is treated as a phone call',
    ],
    correctIndex: 1,
    explanation: 'BROWSABLE is what makes an intent filter reachable from a web browser; DEFAULT lets the app answer implicit intents.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Include the `BROWSABLE` category. It is required in order for the intent filter to be accessible from a web browser. Without it, clicking a link in a browser cannot resolve to your app.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.2-q04',
    nodeId: '5.2-navigation',
    type: 'mcq',
    stem: 'You email a user a link to a product inside your app. Why should that link use `https` instead of your custom scheme like `myapp://product/42`?',
    options: [
      'Custom schemes are blocked on Android 12 and higher',
      'A custom-scheme link does nothing if the user opens the email on a desktop, where the link would not work — an https link opens your website there and your app on mobile',
      'https links are shorter than custom-scheme links',
      'Custom schemes cannot carry a path, only a host',
    ],
    correctIndex: 1,
    explanation: 'A custom scheme only means something on a device with your app installed; a standard https link degrades gracefully to the web everywhere else.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'Instead, you should use standard `https` links, such as `https://www.myapp.io/records/1234546`. On mobile, these links can be configured to open your app. On Android, this feature is called **Deep Links**, while on iOS, it is known as **Universal Links**.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.2-q05',
    nodeId: '5.2-navigation',
    type: 'mcq',
    stem: 'A user taps a deep link to a product while logged out. What should the app do first, according to Android deep-link best practice?',
    options: [
      'Show a login wall — the link can wait until after sign-in',
      'Show an interstitial ad, then the product',
      'Take the user directly to the product content, without any prompts, interstitial pages, or logins',
      'Open the home screen and show a toast saying a link was received',
    ],
    correctIndex: 2,
    explanation: 'A deep link is a promise to show specific content — blocking it with prompts or a login breaks the expectation that the link goes straight there.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'The deep link should take users directly to the content, without any prompts, interstitial pages, or logins.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.2-q06',
    nodeId: '5.2-navigation',
    type: 'code',
    stem: 'A navigation stack holds screens like a pile: push adds on top, pop removes the top. Starting from `[\'Home\']`, what does this print? `stack.push(\'Profile\'); stack.push(\'Settings\'); stack.pop(); console.log(stack.join(\'>\'));`',
    options: ['Home>Profile', 'Home>Profile>Settings', 'Home>Settings', 'Home'],
    correctIndex: 0,
    explanation: 'Push Profile, push Settings, pop removes Settings — the top is Profile again, and Back from there returns to Home.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Follow the design guidance described in Navigation with Back and Up so that your app matches users\' expectations for backward navigation after they enter your app through a deep link.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const stack = ['Home']; stack.push('Profile'); stack.push('Settings'); stack.pop(); console.log(stack.join('>'));`,
    checkMode: 'run',
    expectedStdout: 'Home>Profile',
  },
  {
    id: '5.2-q07',
    nodeId: '5.2-navigation',
    type: 'code',
    stem: 'Navigating to a screen already on the stack should reuse it, not duplicate it. What does this print for stack `[\'Home\', \'Profile\']` and `go(\'Profile\')`? `const go = (s) => stack.includes(s) ? stack.slice(0, stack.indexOf(s) + 1) : [...stack, s]; console.log(go(\'Profile\').join(\'>\'));`',
    options: ['Home>Profile', 'Home>Profile>Profile', 'Profile>Home', 'Home'],
    correctIndex: 0,
    explanation: 'Profile is already on the stack, so navigation returns to the existing instance instead of pushing a second copy.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Follow the design guidance described in Navigation with Back and Up so that your app matches users\' expectations for backward navigation after they enter your app through a deep link.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const stack = ['Home', 'Profile']; const go = (s) => stack.includes(s) ? stack.slice(0, stack.indexOf(s) + 1) : [...stack, s]; console.log(go('Profile').join('>'));`,
    checkMode: 'run',
    expectedStdout: 'Home>Profile',
  },
  {
    id: '5.2-q08',
    nodeId: '5.2-navigation',
    type: 'code',
    stem: 'Which snippet implements a minimal two-screen navigator with no navigation library — Home, plus a button that goes to Profile?',
    options: [
      'Hold the screen in `useState` and conditionally render: `{screen === \'Home\' ? <Text>Home</Text> : <Text>Profile</Text>}` with a Button that calls `setScreen(\'Profile\')`',
      'Render both screens and toggle them with `Linking.openURL(\'Home\')`',
      'Store the screen in a plain `let` variable and reassign it in the Button handler',
      'Keep the screen in `useRef` and read `screen.current` in the JSX',
    ],
    correctIndex: 0,
    explanation: 'State drives the render: setScreen schedules a re-render and the conditional shows the new screen. A plain let or a ref would not re-render.',
    sourceUrl: 'https://react.dev/reference/react/useState',
    sourceQuote: 'The `set` function returned by `useState` lets you update the state to a different value and trigger a re-render.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { useState } from 'react';
import { Button, Text, View } from 'react-native';

type Screen = 'Home' | 'Profile';

export function MiniNavigator() {
  const [screen, setScreen] = useState<Screen>('Home');
  return (
    <View>
      {screen === 'Home' ? <Text>Home</Text> : <Text>Profile</Text>}
      <Button title="Go to Profile" onPress={() => setScreen('Profile')} />
    </View>
  );
}`,
    checkMode: 'compile',
  },
  {
    id: '5.2-q09',
    nodeId: '5.2-navigation',
    type: 'bug',
    stem: 'A Profile screen reads the user id from its deep link, but the link that opened it was just `techieman://profile` with no query string. What does `console.log(url.searchParams.get(\'userId\') ?? \'no-user\')` print, and what is the bug?',
    options: [
      'Prints no-user — the link carried no `?userId=...` query parameter, so the screen must handle the missing case (or the link must include it)',
      'Prints no-user — URLSearchParams only works on https URLs, not custom schemes',
      'Prints no-user — the `?` must come before the scheme, not after the path',
      'Prints the whole URL — searchParams.get returns the full URL when the key is missing',
    ],
    correctIndex: 0,
    explanation: 'get() returns null for a missing key, so the fallback prints. A screen opened by a link must never assume its params exist.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',
    sourceQuote: 'A `URLSearchParams` object which can be used to access the individual query parameters found in `search`.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const url = new URL('techieman://profile'); console.log(url.searchParams.get('userId') ?? 'no-user');`,
    checkMode: 'run',
    expectedStdout: 'no-user',
  },
  {
    id: '5.2-q10',
    nodeId: '5.2-navigation',
    type: 'bug',
    stem: 'After login the app pushes Home on top of Login. The user presses Back on Home and lands on the Login screen again. What does `console.log(stack[stack.length - 2])` print for stack `[\'Login\', \'Home\']`, and what is the bug?',
    options: [
      'Prints Home — Back always exits the app, so Login can never reappear',
      'Prints Login — push() replaced Login with Home automatically, so this cannot happen',
      'Prints Login — Login is still underneath Home on the stack; reset/replace the stack at login so Back has nowhere to go',
      'Prints Login — the stack is capped at one screen, so Home overwrote Login',
    ],
    correctIndex: 2,
    explanation: 'Pushing Home leaves Login below it. After a successful login the auth screens should be removed from the stack with a reset or replace.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Follow the design guidance described in Navigation with Back and Up so that your app matches users\' expectations for backward navigation after they enter your app through a deep link.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const stack = ['Login']; stack.push('Home'); console.log(stack[stack.length - 2]);`,
    checkMode: 'run',
    expectedStdout: 'Login',
  },
  // ---- Node 5.3 — Animations (10 questions: 4 mcq, 4 code, 2 bug) ----
  {
    id: '5.3-q01',
    nodeId: '5.3-animations',
    type: 'mcq',
    stem: 'React Native provides two complementary animation systems. Which is which?',
    options: [
      '`Animated` for granular control of specific values, `LayoutAnimation` for global layout transactions',
      '`Animated` for layout transactions, `LayoutAnimation` for granular value control',
      '`Animated` runs only on iOS, `LayoutAnimation` only on Android',
      'Both do the same thing — `LayoutAnimation` is just the old name for `Animated`',
    ],
    correctIndex: 0,
    explanation: 'Use Animated when you drive a specific value (opacity, position); use LayoutAnimation when the next layout pass itself should animate.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'React Native provides two complementary animation systems: `Animated` for granular and interactive control of specific values, and `LayoutAnimation` for animated global layout transactions.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.3-q02',
    nodeId: '5.3-animations',
    type: 'mcq',
    stem: 'What is the main benefit of `useNativeDriver: true` on an animation?',
    options: [
      'It makes the animation run in JavaScript instead of native code',
      'It lets the animation run on the UI thread, so a blocked JS thread does not freeze it',
      'It automatically adds easing to every animation',
      'It lets you animate Flexbox layout properties like width and flex',
    ],
    correctIndex: 1,
    explanation: 'With the native driver the whole animation is sent to native before it starts, so it keeps running even while JS is busy.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'allowing native code to perform the animation on the UI thread without having to go through the bridge on every frame. Once the animation has started, the JS thread can be blocked without affecting the animation.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.3-q03',
    nodeId: '5.3-animations',
    type: 'mcq',
    stem: 'With the native driver, which properties can you animate?',
    options: [
      'Only non-layout properties like transform and opacity — Flexbox and position properties will not work',
      'Any style property, including flex, width and position',
      'Only opacity — transforms need the JS driver',
      'Only layout properties — opacity and transform are JS-only',
    ],
    correctIndex: 0,
    explanation: 'The native driver cannot animate layout: if you need width or flex to move, use LayoutAnimation or drive it in JS.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'you can only animate non-layout properties: things like `transform` and `opacity` will work, but Flexbox and position properties will not.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.3-q04',
    nodeId: '5.3-animations',
    type: 'mcq',
    stem: 'Your LayoutAnimation works on iOS but does nothing on Android. What is missing?',
    options: [
      'Nothing — LayoutAnimation is iOS-only by design',
      'The Android manifest needs an intent filter for animations',
      '`UIManager.setLayoutAnimationEnabledExperimental(true)` must be called on Android',
      'Animations must be wrapped in `Animated.event` on Android',
    ],
    correctIndex: 2,
    explanation: 'LayoutAnimation needs an experimental flag switched on via UIManager on Android; iOS needs no such step.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'Note that in order to get this to work on **Android** you need to set the following flags via `UIManager`',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.3-q05',
    nodeId: '5.3-animations',
    type: 'code',
    stem: 'Interpolation maps an input range to an output range. With input [0, 1] mapped to output [0, 100], what value does input 0.5 produce? `const lerp = (t) => 0 + (100 - 0) * t; console.log(lerp(0.5));`',
    options: ['50', '100', '0', '150'],
    correctIndex: 0,
    explanation: 'Linear interpolation halfway through [0, 1] is halfway through [0, 100] — 50.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'An interpolation maps input ranges to output ranges, typically using a linear interpolation',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const lerp = (t) => 0 + (100 - 0) * t; console.log(lerp(0.5));`,
    checkMode: 'run',
    expectedStdout: '50',
  },
  {
    id: '5.3-q06',
    nodeId: '5.3-animations',
    type: 'code',
    stem: 'Interpolation can map to strings, so rotations animate with units. What does this print for a 90-degree rotation? `const deg = (v) => v + \'deg\'; console.log(deg(90));`',
    options: ['90deg', '0deg', '360deg', '180deg'],
    correctIndex: 0,
    explanation: 'Mapping 0–360 to \'0deg\'–\'360deg\' keeps the unit attached, so 90 becomes the string \'90deg\'.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: '`interpolate()` also supports mapping to strings, allowing you to animate colors as well as values with units.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const deg = (v) => v + 'deg'; console.log(deg(90));`,
    checkMode: 'run',
    expectedStdout: '90deg',
  },
  {
    id: '5.3-q07',
    nodeId: '5.3-animations',
    type: 'code',
    stem: 'Which snippet correctly fades an Animated.Value from 0 to 1 over 500ms on the native driver?',
    options: [
      '`Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();`',
      '`Animated.timing(fade, { toValue: 1, duration: 500 }).play();`',
      '`fade.animate({ toValue: 1, duration: 500, useNativeDriver: true });`',
      '`Animated.spring(fade, { toValue: 1, useNativeDriver: false }).start(500);`',
    ],
    correctIndex: 0,
    explanation: 'timing animates a value over time with a duration; start() kicks it off, and useNativeDriver moves it to the UI thread.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: '`Animated` provides several animation types, the most commonly used one being `Animated.timing()`. It supports animating a value over time using one of various predefined easing functions, or you can use your own.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Animated } from 'react-native';

const fade = new Animated.Value(0);
Animated.timing(fade, {
  toValue: 1,
  duration: 500,
  useNativeDriver: true,
}).start();`,
    checkMode: 'compile',
  },
  {
    id: '5.3-q08',
    nodeId: '5.3-animations',
    type: 'code',
    stem: 'Which snippet correctly maps a ScrollView scroll position straight into an Animated.Value, with no per-frame setState?',
    options: [
      '`onScroll={(e) => scrollX.setValue(e.nativeEvent.contentOffset.x)}` with `scrollEventThrottle={16}`',
      '`onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}`',
      '`onScroll={Animated.event([{ contentOffset: { x: scrollX } }])}` — the nativeEvent wrapper is optional',
      '`onScroll={scrollX}` — an Animated.Value can be passed directly as the handler',
    ],
    correctIndex: 1,
    explanation: 'Animated.event extracts values from the event object via a structured map — the nativeEvent.contentOffset.x path is the documented scroll mapping.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'Gestures, like panning or scrolling, and other events can map directly to animated values using `Animated.event`.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Animated } from 'react-native';

const scrollX = new Animated.Value(0);
const onScroll = Animated.event(
  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
  { useNativeDriver: true },
);
export { onScroll };`,
    checkMode: 'compile',
  },
  {
    id: '5.3-q09',
    nodeId: '5.3-animations',
    type: 'bug',
    stem: 'A fade-in never plays. The code creates the animation but the view stays at opacity 0: `const anim = { start: () => { started = true; } }; let started = false;` — `anim.start()` was never called. What does `console.log(started)` print, and what is the bug?',
    options: [
      'Prints true — timing animations start themselves when created',
      'Prints false — `Animated.timing()` only builds the animation; you must call `.start()` on it',
      'Prints false — the duration defaults to 0, so the animation finishes instantly at opacity 0',
      'Prints undefined — `started` is never assigned without a re-render',
    ],
    correctIndex: 1,
    explanation: 'Creating a timing/spring/decay animation does nothing on its own — start() is what runs it. Forgetting it is the classic silent no-animation bug.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: '`start`/`stop` methods to control time-based animation execution.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let started = false; const anim = { start: () => { started = true; } }; console.log(started);`,
    checkMode: 'run',
    expectedStdout: 'false',
  },
  {
    id: '5.3-q10',
    nodeId: '5.3-animations',
    type: 'bug',
    stem: 'An opacity interpolation maps input [0, 1] to output [0, 100], but during an overshoot the input hits 1.5 and the opacity value becomes 150. What does the linear map print for input 1.5, and what is the bug?',
    options: [
      'Prints 150 — interpolate extrapolates by default (`extend`); set `extrapolate: \'clamp\'` to keep the output inside the range',
      'Prints 100 — interpolate always clamps, so the value must come from somewhere else',
      'Prints 150 — the inputRange is wrong; it should be [0, 100] instead of [0, 1]',
      'Prints 0 — inputs outside the range map back to the start',
    ],
    correctIndex: 0,
    explanation: 'By default interpolate extends the curve past the ranges, so 1.5 maps to 150. Clamp stops the output at the range edges.',
    sourceUrl: 'https://reactnative.dev/docs/animations',
    sourceQuote: 'The default value is `extend` but you can use `clamp` to prevent the output value from exceeding `outputRange`.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const out = 0 + (100 - 0) * 1.5; console.log(out);`,
    checkMode: 'run',
    expectedStdout: '150',
  },
  // ---- Node 5.4 — DeepLinking (10 questions: 4 mcq, 4 code, 2 bug) ----
  {
    id: '5.4-q01',
    nodeId: '5.4-deeplinking',
    type: 'mcq',
    stem: 'The app is already open when the user taps a deep link. Which API receives the URL?',
    options: [
      '`Linking.getInitialURL()`',
      '`Linking.addEventListener(\'url\', callback)`',
      '`Linking.canOpenURL()`',
      '`Linking.openSettings()`',
    ],
    correctIndex: 1,
    explanation: 'While the app is running, a tapped link fires a Linking url event; getInitialURL is only for links that launched a cold app.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'You can handle these events with `Linking.addEventListener(\'url\', callback)` - it calls `callback({url})` with the linked URL',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.4-q02',
    nodeId: '5.4-deeplinking',
    type: 'mcq',
    stem: 'What does `Linking.getInitialURL()` resolve to when the app was NOT launched from a link?',
    options: [
      'The app home screen URL',
      'An empty string',
      '`null`',
      'It rejects the promise',
    ],
    correctIndex: 2,
    explanation: 'No launching link means no initial URL — the promise resolves to null, so always null-check before routing on it.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'If the app launch was triggered by an app link, it will give the link url, otherwise it will give `null`.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.4-q03',
    nodeId: '5.4-deeplinking',
    type: 'mcq',
    stem: 'Why use a verified Android App Link (`https://yourapp.com/...`) instead of a plain custom-scheme deep link?',
    options: [
      'App Links work without any website — no domain needed at all',
      'A verified App Link always opens your app directly instead of asking the user to choose between the browser and other handlers',
      'Custom-scheme links are blocked on Android 12 and higher',
      'App Links are faster because they skip the internet entirely',
    ],
    correctIndex: 1,
    explanation: 'Verification proves you own the domain, so Android routes the link straight to your app and skips the disambiguation dialog.',
    sourceUrl: 'https://developer.android.com/training/app-links/deep-linking',
    sourceQuote: 'Once verified, the system automatically routes links for that domain directly to your app, skipping the disambiguation dialog entirely.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.4-q04',
    nodeId: '5.4-deeplinking',
    type: 'mcq',
    stem: 'For iOS Universal Links, what two things must exist for a website to be associated with your app?',
    options: [
      'An intent filter in AndroidManifest.xml and a queries block',
      'The `apple-app-site-association` file on your website and the matching Associated Domains entitlement in your app',
      'A custom URL scheme in Info.plist and LSApplicationQueriesSchemes',
      'A Firebase Dynamic Link and a universal link in the App Store listing',
    ],
    correctIndex: 1,
    explanation: 'Apple verifies the association both ways: the file hosted on your domain and the entitlement in the app must match.',
    sourceUrl: 'https://developer.apple.com/documentation/xcode/supporting-associated-domains',
    sourceQuote: 'To associate a website with your app, you need to have the associated domain file on your website and the appropriate entitlement in your app.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '5.4-q05',
    nodeId: '5.4-deeplinking',
    type: 'code',
    stem: 'What does this print? `const u = new URL(\'techieman://fight/react-native?chapter=5\'); console.log(u.pathname + \'|\' + u.searchParams.get(\'chapter\'));`',
    options: ['/react-native|5', '/fight/react-native|5', 'fight|5', 'techieman|5'],
    correctIndex: 0,
    explanation: 'For a custom scheme the part after `://` up to the first slash is the host (`fight`), so the pathname is only `/react-native` — the chapter param is `5`.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',
    sourceQuote: 'The `URL` interface is used to parse, construct, normalize, and encode URLs.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const u = new URL('techieman://fight/react-native?chapter=5'); console.log(u.pathname + '|' + u.searchParams.get('chapter'));`,
    checkMode: 'run',
    expectedStdout: '/react-native|5',
  },
  {
    id: '5.4-q06',
    nodeId: '5.4-deeplinking',
    type: 'code',
    stem: 'A router checks the scheme before handling a link. What does this print? `console.log(new URL(\'techieman://profile/42\').protocol);`',
    options: ['techieman:', 'https:', 'profile', '42'],
    correctIndex: 0,
    explanation: 'protocol is the scheme including its trailing colon — `techieman:` — which is how you tell your own links apart from https or mailto links.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',
    sourceQuote: 'A string containing the protocol scheme of the URL, including the final `:`',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `console.log(new URL('techieman://profile/42').protocol);`,
    checkMode: 'run',
    expectedStdout: 'techieman:',
  },
  {
    id: '5.4-q07',
    nodeId: '5.4-deeplinking',
    type: 'code',
    stem: 'Which hook correctly handles deep links both while the app is open AND when a link cold-starts it?',
    options: [
      'Only `Linking.addEventListener(\'url\', ...)` — it also fires for cold starts',
      'Only `Linking.getInitialURL()` — it also fires for links tapped while open',
      'Both: `addEventListener(\'url\', ...)` for links while open, plus `getInitialURL()` on mount for cold starts',
      'Neither — deep links are handled automatically by the OS with no code',
    ],
    correctIndex: 2,
    explanation: 'Two entry paths need two handlers: the url event for a running app, getInitialURL for the URL that launched it.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'You can handle these events with `Linking.addEventListener(\'url\', callback)` - it calls `callback({url})` with the linked URL',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { useEffect } from 'react';
import { Linking } from 'react-native';

export function useDeepLink(onUrl: (url: string) => void) {
  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => onUrl(event.url));
    Linking.getInitialURL().then((url) => {
      if (url) {
        onUrl(url);
      }
    });
    return () => sub.remove();
  }, [onUrl]);
}`,
    checkMode: 'compile',
  },
  {
    id: '5.4-q08',
    nodeId: '5.4-deeplinking',
    type: 'code',
    stem: 'Which snippet correctly opens an external URL only when some installed app can handle it?',
    options: [
      '`Linking.openURL(url)` on its own — it never fails for unknown schemes',
      'Check `Linking.canOpenURL(url)` first, and only call `Linking.openURL(url)` when it resolves true',
      '`Linking.getInitialURL()` first, then `openURL` with whatever it returns',
      '`Linking.sendIntent(url)` — the only API that checks for a handler',
    ],
    correctIndex: 1,
    explanation: 'openURL rejects when no app handles the URL, so guard non-http(s) URLs with canOpenURL first — that is the documented pattern.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'This method will fail if the system doesn\'t know how to open the specified URL. If you\'re passing in a non-http(s) URL, it\'s best to check `canOpenURL()` first.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Linking } from 'react-native';

export async function openExternal(url: string): Promise<boolean> {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }
  await Linking.openURL(url);
  return true;
}`,
    checkMode: 'compile',
  },
  {
    id: '5.4-q09',
    nodeId: '5.4-deeplinking',
    type: 'bug',
    stem: 'A fight invite link `techieman://fight/5` works when the app is already open, but does nothing on a cold start. The code only registers `Linking.addEventListener(\'url\', ...)`. What does the cold-start handler print, and what is the bug?',
    options: [
      'Prints link-lost — cold starts fire no `url` event; also call `Linking.getInitialURL()` on launch',
      'Prints link-lost — addEventListener only works on iOS, not Android',
      'Prints techieman://fight/5 — the listener fires on cold start too, so the bug is elsewhere',
      'Prints link-lost — the listener must be registered before the app bundle loads',
    ],
    correctIndex: 0,
    explanation: 'The url event only fires while the app runs. A link that launches the app delivers its URL once via getInitialURL — miss that call and the link is lost.',
    sourceUrl: 'https://reactnative.dev/docs/linking',
    sourceQuote: 'You can handle these events with `Linking.getInitialURL()` - it returns a Promise that resolves to the URL, if there is one.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let handled: string | null = null; const eventFired = false; if (eventFired) { handled = 'techieman://fight/5'; } console.log(handled ?? 'link-lost');`,
    checkMode: 'run',
    expectedStdout: 'link-lost',
  },
  {
    id: '5.4-q10',
    nodeId: '5.4-deeplinking',
    type: 'bug',
    stem: 'A search link is hand-built as `techieman://search?q=react native&chapter=5`, but the search screen only sees `q = \'react native\'` and chapter is lost from the query. What does `new URL(url).searchParams.get(\'q\')` print, and what is the bug?',
    options: [
      'Prints react native — the raw `&` in the value splits the query; encode values with `encodeURIComponent` (or build the query with `URLSearchParams`) instead of concatenating raw text',
      'Prints react native — URLSearchParams.get only returns the first word of any value',
      'Prints react native — custom schemes cannot carry query strings at all',
      'Prints react native&chapter=5 — the `&` is kept, so the bug is in the search screen',
    ],
    correctIndex: 0,
    explanation: 'An unencoded `&` is a parameter separator, so `chapter=5` became its own param and `q` was cut short. encodeURIComponent (or URLSearchParams) keeps the value intact.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/URL',
    sourceQuote: 'The `URLSearchParams` interface can be used to build and manipulate the URL query string.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const q = 'react native&chapter=5'; const url = 'techieman://search?q=' + q; console.log(new URL(url).searchParams.get('q'));`,
    checkMode: 'run',
    expectedStdout: 'react native',
  },
];

export const ENEMIES_CH5: NodeEnemy[] = [
  {
    nodeId: '5.1-gestures',
    enemyName: 'The Responder Thief',
    symbols: ['dx', 'dy', 'vx', 'grant', 'terminate'],
    accent: '#f59e0b',
  },
  {
    nodeId: '5.2-navigation',
    enemyName: 'The Stack Navigator',
    symbols: ['→', 'push', 'pop', '⟨⟩'],
    accent: '#22d3ee',
  },
  {
    nodeId: '5.3-animations',
    enemyName: 'The Interpolator',
    symbols: ['0→1', 'easeInOut', 'interpolate', '360deg'],
    accent: '#f472b6',
  },
  {
    nodeId: '5.4-deeplinking',
    enemyName: 'The Broken Scheme',
    symbols: ['://', 'myapp://', '?', 'applinks'],
    accent: '#a3e635',
  },
];
