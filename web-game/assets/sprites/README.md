# assets/sprites/ — real PNG sprites (staged, NOT on this branch yet)

The 73 sprite PNGs (opaque, on white — see `REFERENCE_DIGEST.md` §6) land here
only when the user pushes them from his machine (the GitHub connector is text-only
and cannot push binaries). Until then this directory stays empty and the game uses
its built-in letter-built SVG art, which is the default look and must match on its own.

## How the auto-upgrade works

On load, the game tries to fetch each sprite below (relative path, same origin).
When a PNG loads, it replaces the matching SVG figure and is blended with
`mix-blend-mode: multiply` so the white sheet background drops out. When a PNG is
missing (404), the SVG stays — no error, no placeholder, no console spam.

## Expected files (relative to web-game/)

| Game figure | Sprite file (when pushed) |
|---|---|
| The Developer (hero poses) | `hero/run.png`, `hero/jump.png`, `hero/attack.png`, `hero/hurt.png`, `hero/ko.png` |
| The Coder | `hero/the-coder.png` |
| The Logic Wizard | `hero/the-logic-wizard.png` |
| The Algorithm | `hero/the-algorithm.png` |
| The Guide | `guide/glide.png`, `guide/narrate.png`, `guide/point.png`, `guide/summon.png`, `guide/fade.png`, `guide/the-narration.png`, `guide/the-worlds-map.png`, `guide/the-quiz.png` |
| Kotlin troops | `kotlin/null-wisps.png`, `kotlin/minus-one-skitterers.png`, `kotlin/elvis-imps.png`, `kotlin/exception-brutes.png`, `kotlin/lateinit-golem.png` |
| NULLPOINTER troops | `nullpointer/scamps.png`, `nullpointer/skitters.png`, `nullpointer/wisps.png`, `nullpointer/index-out-of-bounds-brute.png` |
| Java troops | `java/race-condition-shards.png`, `java/thread-racers.png`, `java/stale-read-wisps.png`, `java/deadlock-chains.png`, `java/executor-swarm-host.png` |
| Android troops | `android/leak-drip.png`, `android/lifecycle-zombie.png`, `android/retained-reference-ghost.png`, `android/anr-frost-fiend.png`, `android/config-change-wraith.png`, `android/fragment-ghost.png` |
| Python troops | `python/timeout-clocks.png`, `python/indentation-imps.png`, `python/retry-sprites.png`, `python/hanging-request-brutes.png`, `python/gil-constrictor.png` |
| React Native troops | `react-native/*.png` (8 files, see the manifest) |
| Other roads | `indexoutofbounds/*.png`, `lambda/*.png`, `memoryleak/*.png`, `classcast/*.png`, `concurrentchaos/*.png`, `asyncawait/*.png`, `timeout/*.png` |
| Kotlin lord art | `kotlin/k-ninja.png`, `kotlin/thrown-k.png` |

Full list (73 files, sizes, dimensions, crop caveats): `REFERENCE_DIGEST.md` §6 and
`game-reference/generated/sprites/SPRITES_MANIFEST.md` in the workspace.
Do NOT invent or generate sprite art to fill this directory — real PNGs only, from
the user's machine.
