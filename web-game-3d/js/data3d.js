/* TECHIEMAN REAL 3D — data3d.js
 * All game data. No invented code lines, names or numbers: every code-line
 * set below is copied VERBATIM from the character folder named in the comment.
 * Physics numbers are from GAME_WIRING_SPEC.md §3 / troop-physics-data.json
 * on a 1920x1080 stage; SCALE3D converts px -> 3D units (1 unit = 100 px).
 *
 * CHAPTER MAPS — honest derivation note:
 * The character folders document the Kotlin road as 4 chapters + Final
 * (digest §5.1), Java 4 + Final, Android 6 + End, Python 4 + Final, RN 8 +
 * Final. This build expands each road to 50 playable chapters whose TOPICS
 * are the real curriculum progression of that language (Kotlin topics follow
 * kotlinlang.org doc order; Java/Android/Python topics follow their standard
 * curricula; React Native topics follow the app's roadmap.sh node list in
 * app/src/data/roadmap.ts, extended in the same order). The folders' chapter
 * TROOP rosters are preserved as the five ACTS (10 chapters each) — e.g. the
 * Kotlin road's Ch.1 NULL wisps become Act 1 (ch. 1-10), Ch.2 skitterers Act 2,
 * Ch.3 EXCEPTION brutes Act 3, Ch.4 lateinit golem Act 4, Final waves Act 5.
 * The 50-chapter granularity is new scaffolding, not folder canon.
 */
'use strict';

/* --- global flags (the two open user decisions) --- */
var CODE_SET = 'kotlin';   // 'kotlin' | 'nullpointer' — which 5-line set NULLPOINTER throws
var HERO_CHEST = 'canon';  // 'canon' (sheet lettering per hero) | 'all-code' (every chest CODE)

/* --- physics: spec px numbers on 1920x1080 -> 3D units (1 unit = 100 px) --- */
var PX = 1 / 100;
var PHYS3D = {
  heroRun: 520 * PX,        // 5.2 u/s
  heroJumpV: 900 * PX,      // 9 u/s up (202 px high on the spec stage)
  heroGrav: 2000 * PX,      // 20 u/s^2
  heroAccel: 2600 * PX,
  slashMs: 460,             // 180 wind-up / 80 strike / 200 recover
  slashReach: 2.6,          // 3D units in front of the hero
  bulletSpeed: 1100 * PX,   // 11 u/s — code bullets / thrown lines
  knockbackTaken: 420 * PX, // 4.2 u/s
  knockbackDealt: 300 * PX,
  bossRun: 340 * PX,        // NULLPOINTER 3.4 u/s
  bossJumpV: 780 * PX,
  throwTotalMs: 1200,       // orb/code throw total
  throwWindupMs: 420,       // wind-up before the throw
  voidTelegraphMs: 500, voidVanishMs: 1200, voidReturnMs: 400,
  bossHp: 560, bossScale: 2.0,
  deflectDamage: 30, meleeDamage: 10, bulletDamage: 10,
  playerHp: 100, lineHitDamage: 10,
  guideGlide: 140 * PX,
  heroHeight: 1.9           // hero ~1.9 units tall (spec: ~90 px on 1080 stage -> 1.9u at our scale)
};

/* --- code-line sets, VERBATIM from the folders --- */
var CODE_SETS = {
  /* REFERENCE_DIGEST §3.1 / GAME_WIRING_SPEC §6 — Kotlin / NULLPOINTER set. THROWN BY DEFAULT. */
  kotlin: [
    'val name: String? = null; println(name!!.length)',
    'user?.address?.street // one rung is missing',
    'lateinit var token: String // never initialised',
    'val x: String = null // the compiler said no — the villain cheats',
    'throw NullPointerException("it was never there")'
  ],
  /* REFERENCE_DIGEST §3.2 — NULLPOINTER own set (characters/nullpointer/CHARACTER.md §"Attacks"). ALTERNATE. */
  nullpointer: [
    'if (null) { throw; }',
    'NullPointerException',
    'Cannot read properties of undefined',
    'items.map is not a function',
    'val name: String = null'
  ],
  /* characters/java/CHARACTER.md §"Code lines he throws" (per spec §6: Java / CONCURRENTCHAOS). */
  java: [
    'new Thread(() -> { balance -= 100; }).start();',
    'synchronized (lockA) { synchronized (lockB) { lockA.wait(); } }',
    'executor.submit(task); executor.submit(task); // the same task, twice',
    'if (orderCount++ == 1) { chargeCustomer(); }',
    'volatile boolean running = true; // volatile is not a lock'
  ],
  /* characters/concurrentchaos/CHARACTER.md §"Code lines it throws". ALTERNATE for the Java boss. */
  concurrentchaos: [
    'if (!exists) create(); // two threads enter',
    'balance = balance + amount; // read, add, write — another thread in between',
    'count++; // not atomic — increments get lost',
    'if (cache.get(key) == null) cache.put(key, load()); // loaded twice',
    'lockA.lock(); lockB.lock(); // the other thread holds them in reverse'
  ],
  /* characters/python/CHARACTER.md §"Code lines he throws". */
  python: [
    'requests.get(url, timeout=None)  # waits forever',
    'while True: retry()  # no backoff, no exit',
    'time.sleep(3600)  # hope nobody notices',
    'response = requests.get(api)  # no timeout, no try',
    '    return result  # one space off — IndentationError'
  ],
  /* characters/memoryleak/CHARACTER.md §"Code lines it throws". */
  memoryleak: [
    'activityRef = this; // never released',
    'listener = new Listener() { /* never unregistered */ };',
    'static Bitmap cache; // grows forever, never cleared',
    'handler.postDelayed(task, 60000); // Activity held for a minute after exit',
    'imageCache.put(key, bitmap); // no size limit, no eviction'
  ],
  /* characters/timeout/CHARACTER.md §"Code lines they throw". */
  timeout: [
    'setTimeout(() => {}, 30000); // still waiting',
    'TimeoutError: operation timed out',
    'requests.get(url, timeout=30)  # raised after 30s — if you set it',
    'await response  # 30,000ms and counting...',
    '504 Gateway Time-out — the server did not respond in time'
  ],
  /* characters/react-native/CHARACTER.md §"Code-snippet throws" (4 lines documented). */
  gatekeeper: [
    'const user = undefined; user.name;',
    '<FlatList data={items} /> // no keyExtractor',
    "navigation.navigate('Checkout') // route not found",
    'fetch(url).then(r => r.json()) // no catch, no retry guard'
  ],
  /* characters/android/CHARACTER.md §"Code-snippet throws" (4 lines documented). */
  android: [
    'static var activity: Activity? = null',
    'registerReceiver(receiver, filter) // no unregisterReceiver()',
    'val bitmap = BitmapFactory.decodeResource(resources, R.drawable.huge)',
    'override fun onDestroy() { /* forgot super.onDestroy() */ }'
  ]
};

/* --- narration (preview3 canonical, REFERENCE_DIGEST §1.4) --- */
var NARRATION = [
  'In a world where code is power,\na great villain rises —\nNullPointer.',
  'He corrupts logic, breaks rules,\nand spreads chaos through\nthe land of Algorithms.'
];
var NARRATION_BOTTOM = 'And so, the Code Warriors shall rise…';

/* --- heroes: sheet lettering per hero (digest §2). HERO_CHEST='all-code' overrides chests to CODE. --- */
var HEROES = [
  { id: 'coder', name: 'The Coder', chest: 'DEBUG', legs: ['DEBUG', 'RUN'],
    blade: 'if (x != null)', stats: { HP: .62, ATK: .58, DEF: .45, SPEED: .95 },
    role: 'Run the code, read the error.', hair: 'spiky', cape: true },
  { id: 'developer', name: 'The Developer', chest: 'CODE', legs: ['LEARN', 'CONQUER'],
    blade: '?.let { }', stats: { HP: .85, ATK: .9, DEF: .8, SPEED: .7 },
    role: 'Turn ideas into reality.', hair: 'spiky', cape: true },
  { id: 'algorithm', name: 'The Algorithm', chest: 'ALGO', legs: ['SORT', 'SEARCH'],
    blade: 'sort()', stats: { HP: .7, ATK: .85, DEF: .6, SPEED: .8 },
    role: 'Plan before you swing.', hair: 'long', cape: true, bow: true },
  { id: 'wizard', name: 'The Logic Wizard', chest: 'LOGIC', legs: ['IF', 'ELSE'],
    blade: 'if / else', stats: { HP: .65, ATK: .95, DEF: .55, SPEED: .5 },
    role: 'Branch before you assume.', hair: 'hood', cape: true, focus: '</>' }
];

/* --- troops: word IS the body (word-derivation law). speed/hp from digest §5 / folders. --- */
var TROOPS = {
  /* Kotlin road (digest §5.1 + characters/kotlin/troops/troops.md) */
  nullWisp:   { word: '?',         hp: 1,  speed: 340, size: 0.55, kind: 'wisp',     teaches: 'A null slips past unnoticed — check before you reach.' },
  skitterer:  { word: '-1',        hp: 2,  speed: 200, size: 0.7,  kind: 'skitter',  teaches: 'Off by one — the index one past the end.' },
  elvisImp:   { word: '?:',        hp: 1,  speed: 220, size: 0.6,  kind: 'support',  teaches: 'Elvis ?: supplies a safe default instead of crashing.' },
  exception:  { word: 'EXCEPTION', hp: 10, speed: 110, size: 1.5,  kind: 'brute',    teaches: 'try { } catch (e) { } — catch the fall.' },
  lateinit:   { word: 'lateinit',  hp: 8,  speed: 140, size: 1.4,  kind: 'golem',    teaches: 'lateinit — a promise to initialise before use.' },
  scamp:      { word: 'NULL',      hp: 1,  speed: 420, size: 0.55, kind: 'scamp',    teaches: 'A null can be anywhere.' },
  skitter:    { word: 'NULL',      hp: 1,  speed: 380, size: 0.6,  kind: 'skitter',  teaches: 'A null never moves the way you expect — hit it in the pause.' },
  wisp:       { word: 'NULL',      hp: 1,  speed: 400, size: 0.55, kind: 'wisp',     teaches: 'A null phases through everything.' },
  indexBrute: { word: 'INDEX',     hp: 3,  speed: 140, size: 1.3,  kind: 'brute',    teaches: 'One step past the end is a crash — caught.' },
  /* Java road (digest §5.2) */
  raceShard:  { word: 'i++',       hp: 1,  speed: 260, size: 0.55, kind: 'scamp',    teaches: 'Two threads, one counter — increments get lost.' },
  threadRacer:{ word: 'THREAD',    hp: 2,  speed: 300, size: 0.7,  kind: 'skitter',  teaches: 'Threads arrive in any order.' },
  staleWisp:  { word: 'x',         hp: 1,  speed: 90,  size: 0.55, kind: 'wisp',     teaches: 'A stale read shows yesterday’s value.' },
  deadlock:   { word: 'LOCK',      hp: 8,  speed: 120, size: 1.4,  kind: 'brute',    teaches: 'Locks need one order — A before B, always.' },
  executor:   { word: 'EXECUTOR',  hp: 6,  speed: 0,   size: 1.3,  kind: 'golem',    teaches: 'Kill the spawner, stop the swarm.' },
  /* Android road (digest §5.3) */
  leakDrip:   { word: 'leak',      hp: 1,  speed: 60,  size: 0.55, kind: 'scamp',    teaches: 'A drip left alone splits in two.' },
  zombie:     { word: 'LIFE',      hp: 2,  speed: 80,  size: 0.8,  kind: 'skitter',  teaches: 'Finish it while it is down — it rises again.' },
  ghostRef:   { word: 'static',    hp: 2,  speed: 110, size: 0.7,  kind: 'wisp',     teaches: 'A static reference holds the whole screen hostage.' },
  anrFiend:   { word: 'ANR',       hp: 3,  speed: 40,  size: 1.0,  kind: 'brute',    teaches: 'Frozen frames — keep moving or freeze with it.' },
  configWraith:{ word: 'CONFIG',   hp: 3,  speed: 100, size: 0.8,  kind: 'wisp',     teaches: 'Rotation destroys and recreates — save your state.' },
  fragmentGhost:{ word: 'FRAGMENT',hp: 2,  speed: 130, size: 0.7,  kind: 'wisp',     teaches: 'It phases — strike in the visible window.' },
  /* Python road (digest §5.4) */
  timeoutClock:{ word: 'TIME',     hp: 1,  speed: 140, size: 0.7,  kind: 'scamp',    teaches: 'A request with no timeout waits forever.' },
  indentImp:  { word: 'INDENT',    hp: 1,  speed: 260, size: 0.6,  kind: 'skitter',  teaches: 'One space off — IndentationError.' },
  retrySprite:{ word: 'RETRY',     hp: 1,  speed: 200, size: 0.6,  kind: 'support',  teaches: 'Kill the retry sprite first, or the troop comes back.' },
  hangingBrute:{ word: 'HANG',     hp: 8,  speed: 100, size: 1.4,  kind: 'brute',    teaches: 'Escape with timeout=5.' },
  gil:        { word: 'GIL',       hp: 6,  speed: 0,   size: 1.3,  kind: 'golem',    teaches: 'One attack per second while it tightens.' },
  /* React Native road (digest §5.5) */
  undefWisp:  { word: 'undefined', hp: 1,  speed: 90,  size: 0.6,  kind: 'wisp',     teaches: 'undefined is not a function.' },
  redShard:   { word: 'ERROR',     hp: 2,  speed: 260, size: 0.7,  kind: 'scamp',    teaches: 'The red screen — read it, don’t fear it.' },
  flatlist:   { word: 'FlatList',  hp: 3,  speed: 70,  size: 1.0,  kind: 'brute',    teaches: '1000 rows, no keys, 6fps — keyExtractor.' },
  flexGremlin:{ word: 'flex',      hp: 2,  speed: 200, size: 0.6,  kind: 'skitter',  teaches: 'Everything is flex: 1 and nothing fits.' },
  lostRoute:  { word: 'ROUTE',     hp: 2,  speed: 0,   size: 0.9,  kind: 'golem',    teaches: 'Pick the right signpost first.' },
  retryDouble:{ word: 'RETRY',     hp: 2,  speed: 240, size: 0.7,  kind: 'skitter',  teaches: 'Two identical lunges — answer both.' },
  tokenGhost: { word: 'TOKEN',     hp: 2,  speed: 120, size: 0.7,  kind: 'wisp',     teaches: 'Session expired — power-ups grey out.' },
  reviewWall: { word: 'REVIEW',    hp: 99, speed: 0,   size: 1.8,  kind: 'gate',     teaches: 'Three correct answers open the gate.' }
};

/* --- 50-chapter curriculum topics per road (real curriculum progressions; see header note) --- */
var TOPICS = {
kotlin: ['Hello World & main()','Variables: val vs var','Types & numbers','Strings & templates','Booleans & conditions','When expressions','Ranges & progressions','for & while loops','Functions','Parameters & defaults','Nullable types ?','Safe call ?.','Elvis operator ?:','Not-null assertion !!','let & scoping','lateinit & lazy','Lists','Sets','Maps','Filtering','Mapping & transforming','Folding & reducing','Classes & constructors','Properties','Inheritance','Interfaces','Data classes','Sealed classes','Objects & companions','Visibility modifiers','Lambdas','Higher-order functions','Extension functions','Infix & operator','Inline functions','Tail recursion','Generics','Variance in & out','Delegated properties','by lazy & observable','suspend & launch','async & await','Dispatchers','Flows','Channels','Structured concurrency','Kotlin for Android','ViewModel & state','Compose basics','Coroutines in the UI','Shipping the app'],
java: ['Hello Java & main()','Primitive types','Strings','Conditionals','Loops','Methods','Arrays','Classes & objects','Inheritance','Interfaces','Abstract classes','Enums','Exceptions','Collections','Generics','Streams','Threads & Runnable','Thread lifecycle','synchronized','Locks & ReentrantLock','volatile','Atomic variables','ExecutorService','Futures','Thread pools','Deadlock','Race conditions','Lost updates','Check-then-act','Lock ordering','wait & notify','Blocking queues','ConcurrentHashMap','CountDownLatch','Semaphore','Fork & Join','Immutability','Thread confinement','Safe publication','Double-checked locking','Happens-before','Memory model','Profiling races','Testing concurrency','CompletableFuture','Virtual threads','Reactive streams','Structured concurrency','Records','Sealed types','Pattern matching','Shipping concurrent code'],
android: ['Activities','Intents','Views & layouts','Fragments','RecyclerView','Resources','Manifest','Gradle','Debugging','Material design','Lifecycle states','onSaveInstanceState','ViewModel','LiveData','Navigation','Services','Broadcast receivers','Content providers','Permissions','Notifications','Bitmaps & memory','Static references','Listeners & leaks','Handlers & messages','WeakReference','LeakCanary','Profiling memory','Garbage collection','Caching','Image loading','Configuration changes','Process death','ANR','Background work','WorkManager','Coroutines on Android','Room','DataStore','Testing','Performance','App startup','ProGuard & R8','App bundles','Play publishing','Crash reporting','Analytics','Accessibility','Security','Release checklist','Shipping the app'],
python: ['Hello Python','Variables & types','Strings','Lists & dicts','Conditionals','Loops','Functions','Modules','Exceptions','File I/O','Classes','Decorators','Generators','Comprehensions','Lambdas','Context managers','Typing','Virtual envs','pip','Testing','requests basics','GET & POST','Headers & auth','JSON','Timeouts','Retries','Backoff','Idempotency keys','Sessions','Status codes','asyncio','await','Tasks','Event loop','aiohttp','Concurrency vs parallelism','The GIL','Threading','Multiprocessing','Queues','Logging','Monitoring','Circuit breakers','Rate limiting','Caching','Webhooks','WebSockets','Deployment','Profiling slow calls','Shipping reliable services'],
'react-native': ['JavaScript basics','CSS basics','JSX','Components, State & Props','What is React Native?','CLI & Metro bundler','Expo & Snack','Debugging & Fast Refresh','View, Text & Text Input','Buttons, Images & Pressables','ScrollView & Lists','Modal, Switch & StatusBar','Stylesheets','Layouts & Flexbox','Platform-specific code','Dimensions & PixelRatio','Gesture handling','Scrolling & swiping','Screen navigation','Stack, tab & drawer','Deep linking','Animations','Reanimated','Shared elements','Fetch & networking','REST APIs','Push notifications','AsyncStorage','Secure storage','SQLite','State management','Context & Redux','Forms & validation','Images & media','Camera','Permissions','Maps','WebView','Performance','Hermes & profiling','Testing','Jest & RNTL','E2E with Detox','CI & CD','CodePush & OTA','App icons & splash','Play Store','App Store','Store review','Shipping the app']
};

/* --- roads: 5 acts x 10 chapters; boss after ch. 50 --- */
function roadActs(troopSets) {
  var acts = [];
  for (var a = 0; a < 5; a++) {
    acts.push({ act: a + 1, from: a * 10 + 1, to: (a + 1) * 10, troops: troopSets[a] });
  }
  return acts;
}
var ROADS = {
  kotlin: {
    id: 'kotlin', bossDisplay: 'NullPointer', name: 'Kotlin', boss: 'NULLPOINTER', bossWords: ['NULL', 'POINTER'],
    bossLines: 'kotlin', bossAltLines: 'nullpointer', bossSpecial: 'VOID GRAB',
    bossNote: 'Midpoint twist at 280 HP: the arena nulls — counter with ?., never a bare !!.',
    acts: roadActs([['nullWisp', 'elvisImp'], ['skitterer', 'nullWisp'], ['exception', 'elvisImp'], ['lateinit', 'skitterer', 'nullWisp'], ['scamp', 'skitter', 'wisp', 'indexBrute']]),
    finalWaves: [['scamp', 'scamp', 'scamp', 'scamp', 'scamp', 'scamp'], ['wisp', 'wisp', 'wisp', 'wisp', 'skitter', 'skitter', 'skitter', 'skitter'], ['indexBrute'], ['scamp', 'scamp', 'scamp', 'scamp', 'scamp', 'scamp', 'wisp', 'wisp', 'indexBrute'], ['skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'skitter', 'indexBrute']]
  },
  java: {
    id: 'java', bossDisplay: 'ConcurrentChaos', name: 'Java', boss: 'CONCURRENTCHAOS', bossWords: ['CHAOS'],
    bossLines: 'java', bossAltLines: 'concurrentchaos', bossSpecial: 'THE RACE',
    bossNote: 'The Race every 12 s — one thing happens twice.',
    acts: roadActs([['raceShard'], ['threadRacer'], ['deadlock', 'staleWisp'], ['executor', 'threadRacer'], ['raceShard', 'threadRacer', 'deadlock']]),
    finalWaves: [['raceShard', 'raceShard'], ['threadRacer', 'threadRacer', 'threadRacer'], ['deadlock'], ['raceShard', 'threadRacer', 'deadlock']]
  },
  android: {
    id: 'android', bossDisplay: 'MemoryLeak', name: 'Android', boss: 'MEMORYLEAK', bossWords: ['LEAK'],
    bossLines: 'memoryleak', bossAltLines: 'android', bossSpecial: 'HOARD GROWTH',
    bossNote: 'Hoard grows every 10 s unless interrupted.',
    acts: roadActs([['leakDrip'], ['zombie'], ['ghostRef'], ['anrFiend'], ['configWraith', 'fragmentGhost', 'leakDrip']]),
    finalWaves: [['leakDrip', 'leakDrip', 'leakDrip'], ['zombie', 'zombie'], ['ghostRef', 'anrFiend'], ['configWraith', 'fragmentGhost']]
  },
  python: {
    id: 'python', bossDisplay: 'Timeout', name: 'Python', boss: 'TIMEOUT', bossWords: ['TIME'],
    bossLines: 'timeout', bossAltLines: null, bossSpecial: 'HOURGLASS SLOW FIELD',
    bossNote: 'Hourglass slow field: player half speed for 3 s.',
    acts: roadActs([['timeoutClock'], ['indentImp'], ['hangingBrute', 'retrySprite'], ['gil', 'timeoutClock'], ['timeoutClock', 'indentImp', 'hangingBrute']]),
    finalWaves: [['timeoutClock', 'timeoutClock', 'timeoutClock'], ['indentImp', 'indentImp'], ['hangingBrute'], ['timeoutClock', 'indentImp', 'hangingBrute']]
  },
  'react-native': {
    id: 'react-native', bossDisplay: 'The Gatekeeper', name: 'React Native', boss: 'THE GATEKEEPER', bossWords: ['GATE'],
    bossLines: 'gatekeeper', bossAltLines: null, bossSpecial: 'RED SCREEN WALL',
    bossNote: 'Boss after ch. 50 (ch. 8 in folder canon). Atom face, glowing eye at the nucleus.',
    acts: roadActs([['undefWisp'], ['redShard'], ['flatlist'], ['flexGremlin'], ['lostRoute', 'retryDouble', 'tokenGhost', 'reviewWall']]),
    finalWaves: [['undefWisp', 'undefWisp'], ['redShard', 'redShard'], ['flatlist'], ['retryDouble', 'retryDouble', 'tokenGhost']]
  }
};

function chaptersFor(roadId) {
  var road = ROADS[roadId], out = [];
  for (var i = 0; i < 50; i++) {
    var act = road.acts[Math.floor(i / 10)];
    out.push({ n: i + 1, topic: TOPICS[roadId][i], act: act.act, troops: act.troops, road: roadId });
  }
  return out;
}
function chapterByNumber(roadId, n) { return chaptersFor(roadId)[Math.max(0, Math.min(49, (n || 1) - 1))]; }
