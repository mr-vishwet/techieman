# TechieMan — REAL 3D (web-game-3d/)

A real 3D browser game. **Not flat SVG, not flat images moved around.**
Every hero, troop and boss is converted into a genuine 3D character: its
body is built from its concept's own letters as **extruded 3D geometry**
(`js/three-text.js` parses the vendored Helvetiker typeface outlines into
`THREE.ExtrudeGeometry`), with real lighting, real shadows and real depth —
the camera can move to a second angle and the characters show a different
face, parallax and shifting shadows. That is the proof, and
`verify/verify3d.mjs` captures it (front + side frames of the same scene).

## Run it

Open `index.html` in a browser. No build step, no CDN, no network, no fetch
of local files — Three.js r149 UMD and the Helvetiker font are vendored under
`vendor/`. Works from `file://`.

## Controls

| Key | Action |
|---|---|
| J / R | Slash — deflect a thrown code line back for **30 damage** |
| S / ↓ (hold) | Guard — green circle, blocks a thrown line, **no damage** |
| A / D or ← / → | Dodge — hero moves in 3D (strafe + depth) |
| W / ↑ | Step toward the boss in 3D — how melee range is reached (boss fight); jump (Level Run) |
| Space | Jump (3D: hero grows slightly toward the camera while airborne) |
| Q | DEBUG NOVA — freeze the boss 2 s, once per fight |
| K | "if" bullet — 10 damage |
| P / gear | Pause · R retry after KO · Enter next chapter / confirm |

On-screen joystick + skill buttons do the same things (same code path).

## Deep links (screenshots + verification)

- `?scene=hero|map|run|narrate|troops|boss` — the six scenes (map = chapter map)
- `&road=kotlin|java|android|python|react-native` `&chapter=1..50`
- `&t=<seconds>` — freeze the scene deterministically at that time
- `&cam=front|side` — side camera proves the depth (same scene, second angle)
- `&codeset=kotlin|nullpointer` — which 5-line set NULLPOINTER throws
- `&chest=canon|all-code` — hero chest lettering (sheet canon vs all-CODE)
- `&autotest=boss|run|smoke` — in-page driver: real key events, real asserts

## What is playable

- **Kotlin road — COMPLETE:** 50 playable chapters (curriculum topics, see
  `js/data3d.js` header for the honest derivation note: the folders document
  4 chapters + Final; the 50-chapter granularity is a curriculum expansion,
  the troop rosters are the folders' acts), each a real level (run toward the
  camera, fight the chapter's troops, checkpoint), then the direct
  NULLPOINTER end-boss fight (2.0×, 560 HP, VOID GRAB, midpoint twist at
  280 HP).
- **Java / Android / Python / React Native — PLAYABLE on the same engine:**
  50-chapter maps, troop rosters, boss definitions and verbatim code-line
  sets (CONCURRENTCHAOS, MEMORYLEAK, TIMEOUT, THE GATEKEEPER). Same combat,
  same verification path. They are "scaffolded" only in the sense that the
  Kotlin road is the verified proof road; the other four run the identical
  code with their own data.
- All 6 scenes in 3D: Hero Select, Road Map, Level Run, Narration Moment
  (Guide + glowing book), Troop Entrance (one-by-one rise from the ink pool),
  Boss Fight.

## Combat — the three lessons from the flat-game live probe

The flat game's live probe (2026-11-27, 7 runs) produced **0 deflects**,
a guard that never visibly worked, and no numeric boss HP. This build fixes
all three, and `?autotest=boss` proves each with real key events:

1. **Generous deflect window** — a thrown line is deflectable for its whole
   final ~3 units of flight (~0.75 s) plus a 350 ms slash-press buffer,
   with a gold **DEFLECT NOW** cue and the chip flashing gold in the window.
   One deflect: boss HP number **560 → 530**.
2. **Guard actually blocks** — green ring + translucent dome, clearly
   visible while held; a guarded line is destroyed, hero HP unchanged.
3. **Boss HP is a number** (560 / 560) as well as a red bar, updated on
   every hit. 19 deflects × 30 = 570 ≥ 560 → KO, demolition, victory line.

## Physics (documented numbers, scaled to 3D)

1 unit = 100 px. Hero run 520 px/s → 5.2 u/s; jump −900 px/s → 9 u/s up,
gravity 2000 px/s² → 20 u/s²; slash 460 ms (180/80/200); bullets 1100 px/s
→ 11 u/s; knockback taken 420 px/s → 4.2 u/s; NULLPOINTER orb throw
~1200 ms (420 ms wind-up); VOID GRAB 500 ms telegraph → 1.2 s vanish →
400 ms return. Troop speeds from `troop-physics-data.json` / the folders,
same conversion. See `js/data3d.js` (`PHYS3D`).

## Asset plan — what is in the game vs what still needs the user's machine

- **In the game (no binaries):** all characters (extruded letters), ruined
  city (procedural flagstone texture + towers + floating islands + mist),
  all code lines (verbatim from the character folders), all physics.
- **NOT in the game, NOT needed:** the 73 sprite PNGs staged at
  `~/workspace/techieman/semi3d-staging/` (binaries the connector cannot
  push) and the audio MP3s (`game-reference/generated/audio/` — roars,
  theme, SFX, narration). The 3D game does not depend on them.
- **Upgrade path when they land:** a sprite PNG would upgrade a character
  only as a *texture* on the extruded letter body (never as a flat
  billboard — that would break the 3D proof); roar/theme/SFX MP3s would
  wire into the existing silent hooks (boss entry, throw, deflect, guard,
  checkpoint, KO). No fake audio is synthesized and no placeholder video
  is wired — the Ken Burns intros stay rejected.

## Open decisions (NOT decided here — flags, not silent choices)

1. **Code set** — NULLPOINTER throws the Kotlin set by default
   (`CODE_SET='kotlin'`, digest §3.1). The NULLPOINTER own set (§3.2) is
   kept verbatim as the alternate: `?codeset=nullpointer` flips it. The
   Java boss has the same shape: `java` set by default (spec §6),
   `concurrentchaos` set as the alternate.
2. **Hero chests** — sheet lettering per hero by default
   (`HERO_CHEST='canon'`: CODE / DEBUG / LOGIC / ALGO). The previews show
   all four CODE-chested: `?chest=all-code` flips it.

## Verification

`verify/verify3d.mjs` (Node + CDP + system Chromium, no extra installs):

```
node verify/verify3d.mjs shots   # every scene, front + side camera
node verify/verify3d.mjs smoke   # geometry build check (all letter-bodies)
node verify/verify3d.mjs run     # Kotlin Ch.1 played end to end by key events
node verify/verify3d.mjs boss    # deflect 560->530, guard block, dodge, bullet, nova, KO
node verify/verify3d.mjs all     # everything
```

Frames land in `verify/frames/`. The two-angle proof is
`boss-front.png` vs `boss-side.png` (same scene, same time — different
face of the same extruded letters, shifted shadows, parallax).

## Files

- `index.html` — entry, no build step
- `css/game3d.css` — HUD (preview3 language)
- `js/data3d.js` — roads, 50-chapter curricula, troops, bosses, verbatim code lines
- `js/three-text.js` — typeface outline → extruded 3D letters (no FontLoader in core)
- `js/characters3d.js` — letter-built heroes, bosses, troops, Guide, LEAK
- `js/game3d.js` — renderer, procedural ruined-city world, HUD, input
- `js/scenes3d.js` — six scenes, boss combat, autotests, boot/loop
- `vendor/three.min.js` — Three.js 0.149.0 UMD (608 KB)
- `vendor/helvetiker_font.js` — Helvetiker typeface as JS (63 KB)
- `verify/verify3d.mjs` — CDP verification driver
