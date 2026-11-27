# TechieMan — Godot 4 rebuild

**M0: project foundation ONLY.** The empty game launches and exports to Web
and Android. There is no hero, no troops, no boss, no levels, no art, no
audio and no gameplay code yet. M1 builds the vertical slice on top of this.

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
| `main.tscn` | Minimal main scene — black background, white "TECHIEMAN — M0 FOUNDATION" text. Honestly labelled as foundation, not a game screen |
| `main.gd` | Tiny main-scene script; only prints a renderer-OK line |
| `export_presets.cfg` | Export presets: **Web** (HTML5/WebAssembly) and **Android** (`dev.nadimetla.techieman`) |
| `tools/` (repo root sibling) | Godot binary + export templates live in `~/workspace/techieman/tools/godot-4.7.2/` on the build VM, not in this repo |

## Open / run

```sh
# Godot binary (Linux x86_64, 4.7.2-stable):
~/workspace/techieman/tools/godot-4.7.2/Godot_v4.7.2-stable_linux.x86_64 --path technieman-game
# Headless smoke test:
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --quit-after 60
```

## Export

```sh
# Web (HTML5) — output: build/web/index.html (+ .js/.wasm/.pck)
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --export-release Web ../build/web/index.html
# Android — needs Android SDK + JDK (see below)
Godot_v4.7.2-stable_linux.x86_64 --headless --path technieman-game --export-release Android ../build/android/techieman.apk
```

**Android note (M0):** the APK builds on the build VM now — the Android SDK
+ JDK 17 were installed to `~/workspace/techieman/tools/android/` (Temurin
JDK 17.0.21, cmdline-tools, platform-tools r37, build-tools 34.0.0,
platform android-34; sdkmanager could not fetch its manifest through the
egress proxy, so the packages were downloaded directly from
dl.google.com and laid out by hand). Godot's editor settings point at them
(`~/.config/godot/editor_settings-4.7.tres`). The preset is configured
(`dev.nadimetla.techieman`, arm64-v8a). A **dev-only** release keystore was
generated at `tools/android/release.keystore` (alias `techieman`, self-signed,
NOT the production key) and the preset's `keystore/release` points at it;
the password is intentionally blank in the committed preset — fill it in
locally for a signed release export, or use `--export-debug` (debug keystore
is auto-generated). On a fresh machine, install Android Studio /
cmdline-tools + JDK 17, point Godot's Android SDK / Java SDK paths at them,
and re-run the export above.

## What M1 builds next

- Vertical slice: one playable hero (roster choice open — RND: The
  Developer / The Coder / The Logic Wizard / The Algorithm vs thread:
  TechieMan / Byte / Kernel / Cipher), one language campaign (Python vs
  Kotlin — open), first LEAK troops + a code-throwing end boss.
- Data-driven campaign: the shared engine reads separate per-language
  curriculum / level / boss data — never hard-code one language and copy
  the game. Data sources: `game-reference/generated/troop-physics-data.json`
  and `GAME_WIRING_SPEC.md` (in the parent `techieman/` workspace), plus the
  reference sheets in `game-reference/` (heroes/bosses canon, lettering)
  and `game-reference/rnd-drive/gameplay_preview1/2/3.png` (target look).

## Why Godot

The Three.js web prototype was rejected (0% match to the reference game
world — white letter-blocks in a pale room, not the dark ink world; Three.js
is not a real game engine). Settled stack: Godot 4 + GDScript + Blender +
Muse. $0, free/open-source, browser + Android together, Windows PC.
