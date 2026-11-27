# TECHIEMAN — semi3d-mode browser game

**Code. Learn. Conquer.** A single-file-entry browser game (no build step) that
rebuilds TechieMan's five scenes in the previews' rich painted semi-3D style:
ruined-city ink world, volumetric light, detailed letter-built characters, full HUD.
This is the fix for the v15 Space game (rated 0): flat extruded glyphs on blank
paper are gone — these scenes are layered painted backdrops with shaded,
extruded-glyph figures.

Branch: `semi3d-mode` in `mr-vishwet/techieman`. Source of truth for the look:
`game-reference/rnd-drive/gameplay_preview3.png` (labelled; governs where the
previews disagree) and `REFERENCE_DIGEST.md` in `~/workspace/techieman/semi3d/`.

## Run it

Open `web-game/index.html` in any modern browser (Chrome recommended). No server,
no build step, no external requests — all art and code is local.

## Scenes (deep links — for screenshots and verification)

| Link | Scene |
|---|---|
| `index.html` or `?scene=hero` | Hero Select — 4 heroes on the dais, Developer focused in gold light |
| `?scene=run` | Level Run — hero runs TOWARD the camera; the CHECKPOINT gate grows from the vanishing point (128 m) |
| `?scene=narrate` | Narration Moment — the Guide, glowing book, episode-01 story |
| `?scene=troops` | Troop Entrance — hero faces the camera in the foreground; troops rise one by one from the black ink pool behind him |
| `?scene=boss` | Boss Fight — NULLPOINTER, 2.0×, 560 HP; hero left-foreground in 3/4 front view |

- `&t=<seconds>` freezes a scene at that time (deterministic screenshots).
- `&seed=<n>` fixes the random seed.
- With no `?scene=`, the game opens on Hero Select. Selecting a hero (Enter / tap)
  continues to the Level Run; Continue / victory flows onward in order
  hero → run → narrate → troops → boss.

## Controls

- **Move:** A / D or ← / → (virtual joystick, bottom-left, works the same).
  In the Level Run the hero runs toward the camera automatically — ← / →
  only steer him across the road; ↑ adds a small speed push.
- **Jump:** W / Space (Level Run + Boss Fight)
- **Slash:** J / X / K, or tap the sword skill button
- **Guard:** hold S / ↓ — green protection circle, blocks thrown code lines
- **Deflect:** slash a code line mid-flight to send it back for **30 damage**
- **Debug Nova:** Q, once per boss fight — freezes the boss for 2 s
- **Hero Select:** ← / → to browse, Enter to select, Y for details
- **Pause:** P or the ⏸ button (boss / run scenes)

## Boss fight — NULLPOINTER

560 HP, 2.0× scale. He visibly holds real code lines (chips pinned on his cape and
raised in his hand) **before** throwing them as paper-chip projectiles (~1,200 ms
throw, 420 ms wind-up). Dodge, guard, or slash-deflect. He also uses **VOID GRAB**:
500 ms telegraph → the floor panel under you vanishes for 1.2 s → 400 ms return.

**Code-set conflict (unresolved — see below):** the fight throws the Kotlin set by
default. The NULLPOINTER own set is in the code as a clearly-marked alternate
(`CODE_SET: 'kotlin' | 'nullpointer'` in `js/game.js`); flip one flag to switch.
The user will be asked which set the fight throws — do not merge the two sets.

Kotlin set (thrown by default):
1. `val name: String? = null; println(name!!.length)`
2. `user?.address?.street // one rung is missing`
3. `lateinit var token: String // never initialised`
4. `val x: String = null // the compiler said no — the villain cheats`
5. `throw NullPointerException("it was never there")`

## Colour rules (locked)

Grayscale ink world. The ONLY colours: green (hero HP bar + guard circle),
red (boss HP bar + boss eyes), fiery yellow-orange (sword, clash sparks, dodge
trail — core `#FFE45C`, mid `#FF9F1C`, edge `#FF5A00`), gold (hero-select
spotlight + the Guide's book glow). Flame shades appear ONLY at clash/dodge;
green ONLY at the guard circle.

## Asset plan

- **Pushed on this branch (text only):** all code + all art as SVG (backdrops in
  `assets/backdrops/`, letter-built figures in `assets/characters/`).
- **NOT pushed (binary, needs the user's machine):** the 73 sprite PNGs and the
  MP3s. See `ASSET_PLAN.md`, `assets/sprites/README.md`, `assets/audio/README.md`.
- **Auto-upgrade:** when `assets/sprites/<slug>.png` exists, the game swaps it in
  (multiply-blended so the white sheet drops out); when `assets/audio/*.mp3`
  exists, it plays. Otherwise the SVG art runs and the game is silent. Nothing is
  faked.

## Physics

Numbers come from `GAME_WIRING_SPEC.md` §3 for a 1920×1080 stage, scaled by
**2/3** for this 1280×720 stage (recorded as `SCALE = 2/3` in `js/game.js`):
hero run 347 px/s, jump −600 px/s, slash 460 ms, code bullets 733 px/s, combo
3-slash, knockback taken 280 px/s; NULLPOINTER run 227 px/s, jump −520 px/s,
orb throw ~1,200 ms (420 ms wind-up), VOID GRAB as above.

## Camera — front view (user correction, 2026-11-27)

The game is third-person FRONT VIEW throughout: the camera sees the hero from
the front and the hero's front (chest lettering + face) faces the camera in
every scene. It is NOT a side-view or 2D side-scroller. **Known deviation from
the previews, by the user's explicit instruction:** preview3 shows the hero
from behind in Troop Entrance and in profile sprinting in Level Run — both
scenes were re-staged to front view anyway (hero faces the camera; in Level
Run he runs toward the viewer while the road and gate scroll toward the
camera). The back-view hero SVG (`developer-back.svg`) was deleted; no
back-view or profile hero exists anywhere in the game.

## Known gaps (honest list)

- The figures are SVG recreations of the sheets' letter-built bodies, rendered in
  the previews' shaded style — they are not the rendered PNG illustrations from
  the previews. The real 73 PNG sprites (when pushed) upgrade the figures.
- Hero Select uses the sheets' per-hero lettering (CODE / DEBUG / LOGIC / ALGO);
  the previews show all four chests reading CODE. That question is still open
  with the user — the build follows the sheets, it does not decide it.
- The LEAK golem is an SVG recreation, not the preview's rendered golem.
- No fusion villain, ever. Only one language road is playable in this build
  (Kotlin → NULLPOINTER); the other lords exist as SVG figures only where drawn.
