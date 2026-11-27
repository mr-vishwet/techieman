# Binary assets — staged locally, NOT in this repo push

The GitHub connector push is **text-only** (it rejects binaries), so the
`.glb` / `.blend` model files are staged locally in `models/` (`.glb` files)
and `models/src/` (`.blend` sources) and listed
here. The Godot project references them at `res://models/<name>.glb` — those
paths must exist once the files are uploaded.

## How they reach the repo

1. **GitHub web upload** (easiest): open the repo at
   `github.com/mr-vishwet/techieman`, branch `godot-game`, navigate to
   `technieman-game/models/`, use **Add file → Upload files**, and drop the
   `.glb` files below. One commit, no size problem (all files are < 1 MB).
2. **Local git push from the user's machine**: copy the whole
   `technieman-game/` folder (including `models/`) to a machine with a git
   checkout of `mr-vishwet/techieman` on branch `godot-game`, then
   `git add technieman-game/models/*.glb && git commit && git push`.
3. The `.blend` sources are optional — upload them too if the repo should
   keep them (they live in `models/src/`, with a `.gdignore` so Godot never
   tries to import them — a `.blend` under `res://` makes the headless
   editor query the Blender importer, which fails with no Blender path and
   aborts the whole project import, so the `.glb` files never get imported).
   keep the editable sources, or keep them local-only.

**Do NOT push via the connector** (`github push-files` rejects non-UTF-8
content). **Do NOT include `.github/workflows/`** in any connector push
(the Muse GitHub App lacks the Workflows permission and GitHub 403s the
whole tree). There is no workflow file in this change.

## Files (sizes from the M1 build VM, 2026-11-28)

| File | Size | What it is |
| --- | --- | --- |
| `models/hero.glb` | 367,372 B | TechieMan / The Developer — CODE chest, cape, pen-staff; 8 animations (idle, run, attack_light, attack_heavy, hit, death, jump, dodge) |
| `models/src/hero.blend` | 1,008,906 B | Editable Blender source for the hero |
| `models/leak_scamp.glb` | 105,048 B | LEAK Scamp (small, fast, 1 HP) — letter-built L-E-A-K body, ink pool; 5 animations (idle, walk, attack, hit, death) |
| `models/src/leak_scamp.blend` | 712,170 B | Editable Blender source |
| `models/leak_skitter.glb` | 111,472 B | LEAK Skitter (erratic lunge, 1 HP); 5 animations |
| `models/src/leak_skitter.blend` | 725,156 B | Editable Blender source |
| `models/leak_brute.glb` | 115,872 B | LEAK Brute (big, slow slam, 3 HP); 5 animations |
| `models/src/leak_brute.blend` | 732,269 B | Editable Blender source |
| `models/nullpointer.glb` | 482,244 B | NULLPOINTER boss — NULL chest, POINTER down the cloak, horned hood, claws, Hollow Orb; 8 animations (idle, walk, attack_slam, attack_throw, attack_charge, hit, roar, death) |
| `models/src/nullpointer.blend` | 1,212,494 B | Editable Blender source |

## Builder

All models are procedural low-poly ink-style models built by
`tools/blender/build_characters.py` (Blender 4.5.0, DejaVu Sans Bold for the
letter meshes). Rebuild on the VM with:

```sh
cd ~/workspace/techieman/tools/blender
./blender-4.5.0-linux-x64/blender -b --python build_characters.py -- --char=hero
# ... leak_scamp | leak_skitter | leak_brute | nullpointer
```

**Honest look gap:** these are procedural low-poly models, not the cinematic
rendered illustrations in `game-reference/` — the look gap remains and is an
M2 polish item, not a hidden limitation.
