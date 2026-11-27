# TechieMan — Art Direction Brief (M1)

Source skill: `create-game-assets` (style guide + asset QA). The hero model is
the approved visual target; the LEAK family and NULLPOINTER are the same
family (same builder, same materials, same palette).

## Technical frame

- Engine: Godot 4.7.2 (Compatibility renderer, WebGL 2.0), 1280x720 landscape.
- Characters: real 3D models built procedurally in Blender 4.5.0 via
  `tools/blender/build_characters.py`, exported as .glb (glTF 2.0, Y-up).
- World scale: 1 m = 100 px of the reference physics. Hero 1.8 m, scamp 1.4 m,
  skitter 1.7 m, brute 2.4 m, NULLPOINTER 3.6 m.
- Camera: side view for the level run, 3/4 front view for the boss fight.

## Visual system (HARD RULE — overrides everything earlier)

- Pure black-and-white ink-manga. Black, white and grayscale ONLY for
  characters, environments, UI and ordinary effects.
- Materials (shared palette, all four): `ink_black` (0.02), `ink_gloss`
  (0.01, low roughness), `paper_white` (0.95), `white_glow` (emissive white,
  strength 2.5). No other colours anywhere.
- Guard ring WHITE (not green). Fire / sparks / embers WHITE. Boss eyes WHITE
  (not red). No coloured costumes, no coloured world palettes, no purple
  magic, no rainbow.
- World: black ink, white paper, grey mist, cracked rocky ground.
- Shape language: bold letter-forms as bodies (CODE across the hero's chest,
  L-E-A-K as the troops' bodies, NULL + POINTER down the boss's cloak),
  heavy black masses, white lettering, tapered capes/cloaks, ink drips and
  pools. Silhouettes must read at game scale (1280x720, characters 1.4–3.6 m).

## Asset manifest

`verification/asset-manifest.json` — every model, its source (the bpy script),
licence (original work, no third-party assets), size, animations, and
approval status. Production assets only; no greybox placeholders ship in M1.

## QA (create-game-assets)

- Every model: GLB JSON parsed (meshes, animations, skins, materials) +
  Blender preview renders (3/4 + side) inspected by eye + in-engine frames.
- `scripts/asset_report.py` over the preview PNGs (size + colour limits) and
  a contact sheet via `scripts/build_preview_sheet.py`, in
  `verification/blender-previews/`.
- Known look gap (honest): these are procedural low-poly ink-style models
  built via bpy scripts. They will NOT look like the RND sheets' cinematic
  rendered illustrations. That gap remains; M2 look-gap work is a toon/ink
  shader pass (godot-shaders) + model polish, not a re-render of the brief.
