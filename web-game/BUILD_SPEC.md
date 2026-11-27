# TechieMan semi3d-mode — BUILD SPEC (web-game/)

Branch: `semi3d-mode` in mr-vishwet/techieman, from main @ 4af7ed81ac3b7a94c5086af8a8845529c5b4d7e9 (confirmed head).
Source dir for pushes (NO git metadata — explicit manifest only): `~/workspace/techieman/semi3d-web-game/`
Repo layout pushed: `web-game/` at the repo root.

## The bar
A screenshot of each of the 5 scenes must be visually indistinguishable from the
corresponding preview panel (rnd-drive/gameplay_preview1/2/3.png). Same characters,
same ruined-city ink world, same HUD, same black-and-white ink style with
fire-orange and guard-green ONLY where the previews use them. v15 matched layout
only — this build must match the actual LOOK. Do not claim pixel-to-pixel until a
screenshot comparison says so; report honest per-panel verdicts (match / close /
miss + what differs).

## Asset plan (stated up front)
- PUSHED via connector (text only): all code + ALL art as inline SVG / .svg files
  + CSS + README. The game runs out of the box from the branch with zero binaries.
- NOT pushed (binary, needs the user's machine): the 73 sprite PNGs (opaque,
  on white), the preview PNGs, audio MP3s (roars/theme/SFX/narration). Staged at
  `~/workspace/techieman/semi3d-staging/` with a manifest + push instructions for
  the user (local git push or GitHub web upload).
- AUTO-UPGRADE: the game tries to load `assets/sprites/<slug>.png` (relative path)
  and uses the real sprite (multiply-blended so the white drops out) when present;
  otherwise it uses the SVG recreation. The SVG art IS the default look and must
  match on its own. Same for audio: if `assets/audio/*.mp3` exist, play them;
  otherwise silent. Never synthesize fake audio, never invent art.
- Push rules: `github push-files` only (never gh auth / device flow / PATs).
  Manifest = explicit NUL-delimited repo-relative paths, ends in NUL, ≤1 MiB.
  Limits: ≤2000 files, ≤16 MiB UTF-8 content. EXCLUDE `.github/workflows/` (App
  lacks the Workflows permission — a workflow file 403s the whole push) and
  `*.muse-github-snapshot-sync.json`. Sync record lives adjacent to the source
  dir. Re-verify branch head before each push; record the confirmed commit SHA.

## File layout (repo-relative, under web-game/)
- `web-game/index.html` — single entry, no build step. Open it in a browser.
- `web-game/css/game.css` — all styling, HUD, auto-landscape.
- `web-game/js/game.js` — engine + all 5 scenes (one file keeps the push small;
  split only if it exceeds sane size).
- `web-game/assets/backdrops/*.svg` — painted ruined-city backdrops (layered,
  parallax): boss arena, level-run road + checkpoint gate, hero-select dais,
  narration castle, ink-pool field.
- `web-game/assets/characters/*.svg` — letter-built SVG figures (extruded glyphs):
  4 heroes + 4 bosses + guide + troops used on screen.
- `web-game/assets/sprites/` — EMPTY on the branch (placeholder .gitkeep + README).
  Real PNGs land here only when the user pushes them from his machine.
- `web-game/assets/audio/` — EMPTY on the branch (same). Real MP3s land here only
  from the user's machine.
- `web-game/README.md` — how to run, controls, asset plan, scene deep-links.
- `web-game/ASSET_PLAN.md` — this asset plan, kept in the repo.

## Camera / perspective — CORRECTED by the user (2026-11-27 19:51 IST)
The game is NOT side-view and NOT a 2D side-scroller (hero in profile running
left-to-right). It is MORE REALISTIC 3D, THIRD-PERSON, FRONT VIEW: the camera
sees the hero from the front and the hero's front faces the camera — the same
framing as the reference images (hero-select panels have the heroes facing the
viewer; in the fights the hero faces toward the camera/enemy with his front
visible). EVERY scene must be staged from this front-view 3D perspective.
- Hero Select: heroes face the viewer (front/3/4-front, chest lettering visible).
- Boss Fight: hero in 3/4 FRONT view (chest CODE + face visible, facing toward
  the camera-right / toward the boss), boss to the side. Never profile, never
  back-to-camera.
- Level Run: hero runs TOWARD the camera (front view, chest CODE visible,
  running in place toward the viewer) while the road, gate and scenery scroll
  toward the camera (parallax toward the viewer). The checkpoint gate starts
  far/small in the background and grows as the hero approaches; the distance
  marker counts down; "✓ Checkpoint Reached" on arrival.
- Troop Entrance: hero faces the camera (front view, chest CODE visible) in the
  foreground; the ink pool is behind him (mid-ground); the LEAK golem rises in
  the background; troops rise one by one from the pool behind/around him.
  NOT the back view (the developer-back.svg back-view hero is removed).
- Narration Moment: Guide faces the camera (3/4 front, book visible), story centred.
- Where a preview panel shows the hero from behind (Troop Entrance) or in
  profile (Level Run), the user has EXPLICITLY overridden it to front view —
  follow the user, and note the deviation in the report (do not silently pretend
  the panel shows a front view).
- The hero art must be front-facing throughout: front-view hero SVGs only.
  No profile runner, no back-view hero anywhere in the game.

## Rendering approach
- DOM + inline SVG, JS game loop (requestAnimationFrame). NO canvas for characters
  (SVG is first-class, sharp, and pushable). A <canvas> only if needed for particles.
- Stage: 1280x720 (16:9). Physics numbers in GAME_WIRING_SPEC.md are for a
  1920x1080 stage — scale uniformly by 2/3 (1280/1920) and record the factor in code.
- Semi-3D = layered extruded-glyph figures: each letter-built body is drawn as
  stacked offset letter copies (extrusion) + drop shadow for depth. Capes flow
  (sine-wave verlet approximation), squash-and-stretch on landings, recoil on hits.
- Backdrops: layered SVG — gradient grey sky + clouds, distant floating islands,
  ruined gothic towers/castle, cracked stone ground with perspective, mist bands,
  chains. One reusable ruined-city system, tuned per scene.
- HUD is an HTML/CSS overlay, exact per preview 3: top-left hero portrait + Lv +
  green HP bar + "Pen-Staff ∞"; top-centre red boss bar with name; top-right
  circular minimap + pause/settings gear; objective line under the minimap;
  bottom-left virtual joystick; bottom-right skill diamonds (circular buttons with
  icons + Q/E/R key labels); combo counter ("12 HIT COMBO!"); "✓ Checkpoint
  Reached" banner; checkpoint marker "Checkpoint (128 m)".
- Auto-landscape: on portrait phones the whole stage rotates 90° (wrapper stays
  mounted so a run never restarts). NO rotate prompt, no "turn your device" text
  anywhere. Best-effort orientation lock on first touch.
- No external requests: all art/audio local. No invented code lines, names,
  numbers, or dates. No fusion villain, ever. Flame shades ONLY at sword-clash
  sparks and dodge trail (core #FFE45C, mid #FF9F1C, edge #FF5A00); guard circle
  ONLY green (ring #00E676, inner #69F0AE, outer #00A651). Everything else grayscale.

## The 5 scenes (all present and playable, one mode, direct fullscreen)
1. HERO SELECT — 4 heroes in a row on a ruined-city dais, Developer focused with
   golden light + "The Developer" plate, HP/ATK/DEF/SPEED bars, tagline,
   A Select / B Back / Y Details. Heroes per the sheet: DEVELOPER (CODE chest,
   LEARN/CONQUER legs, cape, spiky hair), CODER (DEBUG torso, running pose),
   LOGIC WIZARD (LOGIC chest, IF/ELSE robe, </> above one hand), ALGORITHM
   (ALGO chest, bow drawn, long hair). All four CODE-chested is NOT the build
   (sheet lettering per hero stands; the CODE-chest question is still open with
   the user — do not decide it here).
2. LEVEL RUN — FRONT VIEW: hero runs TOWARD the camera (front view, CODE chest
   visible) while the road, gate and scenery scroll toward the viewer; the
   checkpoint gate starts far/small and grows as he approaches, with distance
   markers ("Checkpoint (128 m)"), "✓ Checkpoint Reached" banner on arrival,
   objective "Reach the Checkpoint".
3. NARRATION MOMENT — hooded Guide at the side with the glowing book, story
   centred, "Narrator:" subtitle at the bottom, Ⓐ Continue. Story text from the
   digest (episode 01). Guide beat order never changes.
4. TROOP ENTRANCE — FRONT VIEW: hero faces the camera in the foreground; the
   ink pool is behind him (mid-ground), the LEAK golem in the background;
   troops rise ONE BY ONE from the pool behind/around him (sequential,
   entrance director; never all at once). Troops per the 5 roads from the digest.
5. BOSS FIGHT — vs NULLPOINTER (2.0x, 560 HP). Red boss bar top-centre, combo
   counter, boss holds real code lines (chips on cape + raised hand, visible
   BEFORE throwing) and throws them as paper-chip projectiles. Player: dodge,
   hold GUARD (S / ↓) for the green protection circle, or slash a line mid-flight
   to deflect it back for 30 damage. Code lines VERBATIM from the digest/spec §6
   (Kotlin/NULLPOINTER 5 lines); never invent a line.

## Deep links (for screenshots + verification)
- `?scene=hero` / `?scene=run` / `?scene=narrate` / `?scene=troops` / `?scene=boss`
- `&t=<seconds>` freezes the scene at that time (deterministic screenshots).
- `&seed=<n>` fixes any randomness. Default scene flow when no param: hero select.

## Physics (from GAME_WIRING_SPEC.md §3 — use the documented numbers, scaled 2/3)
Hero: run 520 px/s, jump -900 px/s (202 px), slash 460 ms, bullets 1100 px/s,
combo 3-slash, knockback taken 420 px/s. NULLPOINTER: run 340, jump -780 (127 px),
orb throw ~1200 ms (420 ms wind-up), VOID GRAB (500 ms telegraph → 1.2 s
floor-vanish → 400 ms return). Spring-damper rig, anticipation before every move,
overshoot-and-settle, arcs not straight lines. Troops enter via the entrance
director (one by one, concept-matched). Hands move; capes flow.

## Verification protocol (separate verifier subagent)
Render index.html in headless Chromium locally (NOT via muse.ai — the old-game
browser comparison is blocked: muse.ai is blocked in both browsers), screenshot
each of the 5 scenes at 1280x720 via the ?scene= deep links, crop the matching
panel from each gameplay preview, and compare side-by-side. Honest verdict per
panel: match / close / miss + exactly what differs + what it needs (more art, a
different renderer, the user's own image uploads). Never claim pixel-to-pixel
until the comparison says so.

VERIFIED screenshot command (2026-11-27 14:07 IST — works; the
hatch-chromium-sandbox --screenshot path does NOT produce a file, do not use it):
  mkdir -p /tmp/chrome-verify-profile
  ~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome --headless=new \
    --disable-gpu --no-sandbox --user-data-dir=/tmp/chrome-verify-profile \
    --screenshot=<out.png> --window-size=1280,720 --virtual-time-budget=3000 \
    "file://<abs-path>/web-game/index.html?scene=<scene>&t=<seconds>"
Use a FRESH --user-data-dir per run (or delete it first) so a stale profile
cannot poison the run. Confirm the PNG exists and is non-trivially sized after
every capture — never trust the exit code alone.

## Constraints (hard)
- All work on branch `semi3d-mode` — never main. Text files only via the connector.
- Do NOT run git commands inside ~/workspace/techieman/app (that directory failed
  an execution-risk check in this session — do not clone, check out, or execute
  its content). Build in the clean source dir; push via the connector only.
- The write-block flickers: author via file tools; any exec write must be atomic
  (temp + size assert + os.replace) and verified after every write.
- /tmp is NOT stable storage. Keep all intermediates in the workspace.
