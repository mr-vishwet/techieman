# TechieMan — Godot 4 rebuild

**M1: the vertical slice — PLAYABLE.** One hero (TechieMan / The Developer),
a level run with LEAK troops, a checkpoint, a stone gate, and the direct
NULLPOINTER boss fight (Kotlin road, 560 HP, code-throwing, deflect to win).
Title → hero select → level → boss → victory/defeat, end to end.

## M1 — what is real

- **Real 3D models, built in Blender** (`tools/blender/build_characters.py`,
  Blender 4.5.0): hero (CODE across the chest, cape, pen-staff, 8 animations),
  3 LEAK troop variants (letter-built L-E-A-K bodies, ink-pool rise,
  5 animations each), NULLPOINTER boss (NULL chest, POINTER down the cloak,
  horned hood, claws, Hollow Orb, 8 animations). **Honest look gap:** these
  are procedural low-poly ink-style models — they do NOT look like the
  cinematic rendered illustrations in the reference previews.
- **Combat (verified by the in-game self-test, `--selftest`):** slash (J)
  deflects a thrown code line back for 30 damage — 19 deflects × 30 = 570 ≥
  560 → KO. Guard (hold S) blocks with a WHITE ring. Double-tap A/D dodges
  with i-frames. K fires an `if` bullet (10 dmg). Q is Debug Nova, once per
  fight (25 boss dmg + freezes troops 2 s). Boss HP is a NUMBER (560) + bar.
  Deflect window: the line's whole final 3 m of flight + a 350 ms slash
  buffer, with a flashing white DEFLECT NOW cue.
- **Boss attacks (all telegraphed):** letter projectile (real Kotlin lines,
  verbatim), ink slam (jump or guard), charge (dodge or guard). Phase 2 at
  280 HP: roar + subtitle line, faster throws. Boss lines are subtitles in
  M1 — no audio yet.
- **Data-driven campaign** (`scripts/campaign_data.gd`): the engine reads
  per-language data. Default language is **Kotlin** (RND canon; the thread's
  Python-first was ChatGPT's suggestion, not the user's words) — flip
  `DEFAULT_LANGUAGE` to `"python"` for the Python road (TIMEOUT boss + its
  five real lines are already in the data; the TIMEOUT model is an M2 asset).
- **Binary assets are NOT in this repo** (the connector push is text-only).
  The `.glb` files live in `models/` and the `.blend` sources in `models/src/`
  locally — see `BINARY_ASSETS.md` for the list, sizes, and how they reach
  the repo (GitHub web upload or the user's machine). `models/src/` carries
  a `.gdignore`: a `.blend` under `res://` makes the headless editor query
  the Blender importer, which fails with no Blender path and aborts the
  whole project import, so the `.glb` files never get imported.

## M1 verification (2026-11-28, all green)

- **Test runner** (`tests/test_runner.gd`, headless SceneTree script):
  **137 checks, 0 failed, exit 0** — data (.tres load + verbatim code
  lines), pacing, reachability, balance, animation clips, input bindings,
  shaders (M1 has none), save round-trip (atomic write, `.bak` fallback,
  newer-version refusal), UI layout at 1280×720 and 1536×720, jump arc
  (apex 2.03 m, coyote + buffer), signal wiring (exactly 1 connection
  each), troop AI (progress + no state flicker), and the full combat flow
  (deflect 560→530, guard blocks, dodge avoids the charge, bullet −10,
  nova −25, KO after exactly 19 deflects, 0/560, VICTORY). The runner was
  itself verified: one assertion broken on purpose → exit 1, restored.
- **In-game self-test** (`--selftest`, also `?selftest=1` on web):
  `M1SELFTEST ... RESULT=PASS` — deflect, guard, dodge, bullet, nova,
  ko19, 19 deflects. Runs headless in ~6 s and in the browser via CDP.
- **Rate probe** (`tools/rate_probe.gd`): the same 2 s run lands the hero
  at the same x at 30 Hz and 144 Hz physics (12.227 m vs 12.364 m — the
  0.14 m gap is exactly the one-tick input latency, 5.2/fps, not
  simulation drift; movement is instant-velocity + delta-scaled damping).
- **Web export** (`build/web/`, 41 MB): smoke 0 console errors; the full
  `verify_m1.mjs all` (smoke + self-test + 6 frames) passes in headless
  Chromium. **Android APK** (`build/android/techieman.apk`, 28 MB,
  `dev.nadimetla.techieman` v0.2.0-m1): signed (v2+v3 schemes verify),
  contains all 5 model `.scn` files; not run on a device here (no
  emulator on the build VM) — install on his phone to play-test.
- **Bugs found by the checks and fixed in this session:** `.blend` files
  under `res://` aborting the whole import (moved to `models/src/` +
  `.gdignore`); the boss's `on_boss_defeated` callback never matching the
  game's `_on_boss_defeated` (killing the boss silently never showed
  VICTORY); thrown lines spawning at y 2.4 and flying 1.4 m over the
  hero's chest so the hit/guard check could never fire (now y 1.3);
  the `if` bullet tunnelling past the boss at the browser's frame rate
  (all code-line hits are now swept segment tests); `--selftest` /
  `--photo=` silently ignored because `OS.get_cmdline_args()` excludes
  args after `--` (now reads `get_cmdline_user_args()` too); the
  boss-fight camera showing only the cloak's edge (now a 3/4 angle so
  NULL/POINTER read) and the side camera sitting behind the ruin row
  (now inside it); white HUD text washing out on the white paper (every
  label now carries a black outline).

## Stack

- **Godot 4.7.2-stable** (latest stable 4.x at M0 time), GDScript
- **Compatibility renderer** (`gl_compatibility`) — WebGL 2.0 browser export
- **16:9 landscape**, 1280×720, stretch `canvas_items`, aspect `expand`
- **Visual rule:** pure black-and-white ink-manga art direction — black,
  white and grayscale only, restrained white fire / sparks / ink splashes.
  No green guard, no yellow-orange fire, no red eyes, no coloured palettes.

## Project layout

| File | What it is |
| --- | --- |
| `project.godot` | Project settings: name, 1280×720 landscape, Compatibility renderer, black clear colour, named input actions (`move_left`, `move_right`, `slash`, `guard`, `jump`, `nova`, `bullet`, `pause`, `confirm`) |
| `main.tscn` | Main scene — Game root (game.gd), Camera3D, WorldEnvironment (white paper + grey fog), sun |
| `scripts/game.gd` | State machine (title → select → level → boss → victory/defeat), camera, waves, checkpoint, gate, debris, self-test (`--selftest`), photo mode (`--photo=...`) |
| `scripts/hero.gd` | TechieMan: run 5.2 m/s, jump, slash/deflect, guard (white ring), double-tap dodge, `if` bullet, Debug Nova |
| `scripts/troop.gd` | LEAK troop template: enter (ink-pool rise) → patrol → detect → approach → attack → recover → die; config-driven variants |
| `scripts/boss.gd` | NULLPOINTER: 560 HP, intro, throw / slam / charge (telegraphed), phase 2 at 280 HP, KO demolition |
| `scripts/code_line.gd` | Thrown code projectile: deflectable in its final 3 m + 350 ms buffer, guard-blockable, 30 dmg back |
| `scripts/level.gd` | Procedural ink-manga world: cracked ground, ink ribbons, grey mist, ruins, checkpoint, stone gate |
| `scripts/campaign_data.gd` | Data-driven campaign: loads `data/*.tres` (LanguageData resources); Kotlin (default) + Python entries, heroes, combat numbers |
| `scripts/language_data.gd` | `LanguageData` Resource (typed @export fields + `to_dict()`) — the per-language data the engine reads |
| `scripts/save_game.gd` | Checkpoint autosave: atomic write (temp + `.bak` + rename), newer-version refusal |
| `data/kotlin.tres`, `data/python.tres` | Per-language campaign data (boss, HP, code lines, troops, waves, level length, checkpoint/gate) |
| `tests/test_runner.gd` | Headless test runner: 137 checks, exit 1 on any failure (data, pacing, reachability, balance, animations, bindings, shaders, save, UI layout, jump, signals, troop AI, combat) |
| `tools/rate_probe.gd` | Frame-rate probe: same 2 s run at 30 Hz vs 144 Hz physics must land the hero at the same x |
| `scripts/ui.gd` | All screens in code: title, hero select (live 3D turntable), HUD, pause, victory/defeat |
| `models/` | **Local only, binary — NOT pushed.** hero.glb, leak_scamp/skitter/brute.glb, nullpointer.glb |
| `models/src/` | **Local only, binary — NOT pushed.** the `.blend` sources (+ a `.gdignore` so Godot never tries to import them) |
| `verification/` | `verify_m1.mjs` (headless-Chromium CDP driver: smoke + self-test + frames), `frames/` (captured PNGs) |
| `export_presets.cfg` | Export presets: **Web** (HTML5/WebAssembly) and **Android** (`dev.nadimetla.techieman`) |
| `tools/` (repo root sibling) | Godot binary + export templates live in `~/workspace/techieman/tools/godot-4.7.2/` on the build VM, not in this repo |

## Open / run

```sh
# Godot binary (Linux x86_64, 4.7.2-stable):
~/workspace/techieman/tools/godot-4.7.2/Godot_v4.7.2-stable_linux.x86_64 --path technieman-game
# Headless smoke test:
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --quit-after 60
# Combat self-test (drives the real fight: deflect 560->530, guard, dodge,
# bullet, nova, 19-deflect KO) — prints M1SELFTEST ... RESULT=PASS/FAIL:
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game -- --selftest
# Photo mode (saves verification/frames/<state>.png, needs a display/Xvfb):
xvfb-run -a Godot_v4.7.2-stable_linux.x86_64 --path technieman-game -- --photo=boss
# Web verification (smoke + self-test + frames via headless Chromium):
node verification/verify_m1.mjs all
```

## Export

```sh
# Web (HTML5) — output: build/web/index.html (+ .js/.wasm/.pck)
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --export-release Web build/web/index.html
# Android — needs Android SDK + JDK (see below)
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --export-release Android build/android/techieman.apk
```

**Android note (M0):** the APK builds on the build VM now — the Android SDK
+ JDK 17 were installed to `~/workspace/techieman/tools/android/` (Temurin
JDK 17.0.21, cmdline-tools, platform-tools r37, build-tools 34.0.0,
platform android-34; sdkmanager could not fetch its manifest through the
egress proxy, so the packages were downloaded directly from
dl.google.com and laid out by hand). Godot's editor settings point at them
(`~/.config/godot/editor_settings-4.7.tres`). The preset is configured
(`dev.nadimetla.techieman`, arm64-v8a, v0.2.0-m1). A **dev-only** release
keystore was generated at `tools/android/release.keystore` (alias
`techieman`, self-signed, NOT the production key) and the preset's
`keystore/release` points at it with the dev password filled in — replace
both with production credentials before any real release. No custom app
icon is set yet (the APK uses the Godot default icon); add one under
Application → Config → Icon. On a fresh machine, install Android Studio /
cmdline-tools + JDK 17, point Godot's Android SDK / Java SDK paths at them,
and re-run the export above.

## What M2 builds next

- Hero roster decision (RND: The Developer / The Coder / The Logic Wizard /
  The Algorithm vs thread: TechieMan / Byte / Kernel / Cipher) — M1 ships
  TechieMan only; Byte / Kernel / Cipher are shown locked.
- First-language decision for the campaign (Kotlin default vs Python-first).
- TIMEOUT boss model + Python road levels; more languages follow the same
  data pattern (Java, Android, React Native).
- Audio: boss roars + hero rally + theme (all on disk in
  `game-reference/generated/audio/`), boss voice lines as real audio instead
  of subtitles. VOID GRAB special, quiz gates, XP/progress save.
- Closer-to-preview look pass on the procedural models (the look gap).

## Why Godot

The Three.js web prototype was rejected (0% match to the reference game
world — white letter-blocks in a pale room, not the dark ink world; Three.js
is not a real game engine). Settled stack: Godot 4 + GDScript + Blender +
Muse. $0, free/open-source, browser + Android together, Windows PC.
