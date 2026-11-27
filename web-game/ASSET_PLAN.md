# ASSET PLAN — semi3d-mode web-game

## What is pushed on this branch (text only — GitHub connector)

Everything the game needs to run out of the box, with zero binaries:

- `index.html` — single entry, no build step
- `css/game.css` — all styling, HUD, auto-landscape
- `js/game.js` — engine + all 5 scenes (one file keeps the push small)
- `assets/backdrops/*.svg` — layered painted ruined-city backdrops (parallax system):
  `arena.svg` (boss fight), `road.svg` (level run, centred perspective road — the
  CHECKPOINT gate is a DOM element that grows toward the viewer, not painted),
  `dais.svg` (hero select, gold beams), `castle.svg` (narration), `inkpool.svg` (troop entrance)
- `assets/characters/*.svg` — letter-built SVG figures (extruded glyphs: stacked
  offset letter copies + drop shadow):
  `developer.svg` (CODE chest, LEARN/CONQUER legs, cape, spiky hair, Code Sword
  `?.let { }`), `developer-run.svg` (FRONT-VIEW run toward the camera: cape
  streaming behind, one leg driving forward, CODE chest + face visible),
  `coder.svg` (DEBUG torso, running pose), `wizard.svg` (LOGIC chest, IF/ELSE robe,
  `</>` above hand), `algorithm.svg` (ALGO chest, bow drawn),
  `nullpointer.svg` (NULL POINTER stone-block letters, red eyes, Hollow Orb),
  `guide.svg` (hooded, glowing gold book), `leak.svg` (LEAK stone letters, dripping),
  `scamp.svg` / `skitter.svg` / `wisp.svg` (NULLPOINTER troops, bodies built from N-U-L-L)
- `assets/sprites/.gitkeep` + `assets/sprites/README.md` (empty dir marker + plan)
- `assets/audio/.gitkeep` + `assets/audio/README.md` (empty dir marker + plan)
- `README.md`, `ASSET_PLAN.md` (this file)

## What is NOT pushed (binary — needs the user's machine)

The GitHub connector pushes text only; binaries need a local git push from the
user's machine or a GitHub web upload.

- **73 sprite PNGs** — opaque, on white, in `game-reference/generated/sprites/`
  (22.4 MB total incl. contact sheet). Full list, sizes, dimensions and crop
  caveats: `REFERENCE_DIGEST.md` §6 / `game-reference/generated/sprites/SPRITES_MANIFEST.md`.
  Destination in repo: `web-game/assets/sprites/<road>/<file>.png` (same relative
  layout as the manifest). Push instructions + manifest live in the staging dir
  `~/workspace/techieman/semi3d-staging/` (parent agent's area, not this branch).
- **Preview PNGs** (`gameplay_preview1/2/3.png`) — reference only, never shipped in
  the game.
- **Audio MP3s** — roars, theme, SFX, narration re-record. See
  `assets/audio/README.md` for the expected filenames. Rejected files (never wire):
  flat TTS (`tts1min-*.mp3`), Ken Burns intro videos (`generated/videos/intro-*.mp4`).

## Auto-upgrade (how the game uses staged art when it arrives)

- **Sprites:** on load the game probes `assets/sprites/<slug>.png` per figure
  (see the table in `assets/sprites/README.md`). A PNG that loads replaces the
  matching SVG `<img>` and is rendered with `mix-blend-mode: multiply`, so the
  white sheet background drops out against the painted backdrop. A missing PNG
  (404) is silent — the SVG stays. The SVG art IS the default look and must match
  on its own; sprites are an upgrade, not a requirement.
- **Audio:** the game probes `assets/audio/*.mp3` (theme, roar-nullpointer,
  hero-rally, narration-ep01, sfx-*). Present files play (only after a user
  gesture); missing files mean silence for that cue. Never synthesize fake audio.

## Push rules (for the parent agent)

- `github push-files` only (never gh auth / device flow / PATs).
- Manifest = explicit NUL-delimited repo-relative paths, ends in NUL, ≤1 MiB.
- Limits: ≤2000 files, ≤16 MiB UTF-8 content.
- EXCLUDE `.github/workflows/` (the Muse GitHub App lacks the Workflows permission —
  a workflow file 403s the whole push) and `*.muse-github-snapshot-sync.json`.
- Re-verify the branch head before each push; record the confirmed commit SHA.
- Branch is `semi3d-mode` — never main.
