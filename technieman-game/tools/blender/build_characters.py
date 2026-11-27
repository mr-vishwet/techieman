# TechieMan M1 — Blender character builder (procedural low-poly ink-style models)
# Builds REAL 3D modelled characters via bpy: TechieMan hero, 3 LEAK troop
# variants, NULLPOINTER boss. Each gets an armature + named actions
# (idle/run/walk, attack, hit, death + extras) exported as .glb with NLA strips.
# Honest note: these are procedural low-poly ink-style models, NOT the cinematic
# rendered illustrations from the reference previews. The look gap remains.
# Usage: blender -b --python build_characters.py -- --char hero|leak_scamp|leak_skitter|leak_brute|nullpointer
# Output: ~/workspace/techieman/technieman-game/models/<char>.glb (+ .blend)
#         previews in ~/workspace/techieman/technieman-game/verification/blender-previews/
import bpy, math, os, sys, mathutils

OUT_DIR = "/home/hatch/workspace/techieman/technieman-game/models"
PREVIEW_DIR = "/home/hatch/workspace/techieman/technieman-game/verification/blender-previews"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.6, emission=None, emission_strength=0.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return m

INK   = None  # set in main (materials are per-file)
WHITE = None
GLOW  = None
GREY  = None
GLOSS = None

# ---------------------------------------------------------------- helpers
def clean():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.actions):
        pass

def box(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = o.modifiers.new("bev", 'BEVEL'); bev.width = 0.02; bev.segments = 2
    o.data.materials.append(material)
    return o

def sphere(name, loc, r, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc, radius=r, segments=24, ring_count=16)
    o = bpy.context.active_object; o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o

def cyl_between(name, p1, p2, r, material):
    p1 = mathutils.Vector(p1); p2 = mathutils.Vector(p2)
    d = p2 - p1; length = d.length
    mid = (p1 + p2) / 2
    bpy.ops.mesh.primitive_cylinder_add(location=mid, radius=r, depth=length, vertices=12)
    o = bpy.context.active_object; o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = mathutils.Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o

def cone(name, loc, r, depth, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(location=loc, radius1=r, radius2=0.005, depth=depth, vertices=12)
    o = bpy.context.active_object; o.name = name
    o.rotation_euler = rot
    o.data.materials.append(material)
    return o

def frustum(name, loc, r_bottom, r_top, depth, material):
    """Tapered cylinder (wide base, narrow top) — e.g. an ink skirt."""
    bpy.ops.mesh.primitive_cone_add(location=loc, radius1=r_bottom, radius2=r_top, depth=depth, vertices=16)
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(material)
    return o

def text_mesh(name, text, size, depth, material, loc, rot=(math.radians(90), 0, 0)):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = text
    cu.size = size
    cu.extrude = depth
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except Exception:
        pass
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o

def disc(name, loc, r, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(location=loc, radius=r, depth=depth, vertices=32)
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(material)
    return o

# ---------------------------------------------------------------- armature
def make_armature(name, bones):
    """bones: list of (name, head(x,y,z), tail(x,y,z), parent_name or None)"""
    arm = bpy.data.armatures.new(name)
    ao = bpy.data.objects.new(name, arm)
    bpy.context.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for bname, head, tail, parent in bones:
        b = arm.edit_bones.new(bname)
        b.head = head; b.tail = tail
        if parent: b.parent = eb[parent]
        eb[bname] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return ao

def parent_to_bone(obj, arm_obj, bone_name):
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    arm_obj.data.bones.active = arm_obj.data.bones[bone_name]
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='BONE')

def set_rest(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

def key(arm_obj, frame, poses):
    """poses: {bone: (rx,ry,rz)} or {bone: ('loc', (x,y,z))}"""
    bpy.context.scene.frame_set(frame)
    for bname, v in poses.items():
        pb = arm_obj.pose.bones[bname]
        if isinstance(v, tuple) and len(v) == 2 and v[0] == 'loc':
            pb.location = v[1]
            pb.keyframe_insert(data_path='location', frame=frame)
        else:
            pb.rotation_euler = v
            pb.keyframe_insert(data_path='rotation_euler', frame=frame)

def make_action(arm_obj, name, length, frames):
    """frames: list of (frame, poses-dict). Keyframes every animated bone at frame 0."""
    arm_obj.animation_data_create()
    act = bpy.data.actions.new(name)
    arm_obj.animation_data.action = act
    set_rest(arm_obj)
    for frame, poses in frames:
        key(arm_obj, frame, poses)
    bpy.context.scene.frame_set(0)
    track = arm_obj.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, act)
    strip.action_frame_start = 0
    strip.action_frame_end = length
    track.mute = True  # unmuted at export; keeps authoring clean
    arm_obj.animation_data.action = None
    return act

def finish_actions(arm_obj):
    ad = arm_obj.animation_data
    for t in ad.nla_tracks:
        t.mute = False
    ad.action = None
    ad.use_nla = True

# ---------------------------------------------------------------- HERO: TechieMan / The Developer
def build_hero():
    clean()
    bones = [
        ("root",  (0, 0, 0.02),   (0, 0, 0.30),  None),
        ("hips",  (0, 0, 0.95),   (0, 0, 1.05),  "root"),
        ("spine", (0, 0, 1.05),   (0, 0, 1.22),  "hips"),
        ("chest", (0, 0, 1.22),   (0, 0, 1.42),  "spine"),
        ("neck",  (0, 0, 1.42),   (0, 0, 1.50),  "chest"),
        ("head",  (0, 0, 1.50),   (0, 0, 1.68),  "neck"),
        ("shoulder.L", (0.20, 0, 1.40), (0.34, 0, 1.24), "chest"),
        ("forearm.L",  (0.34, 0, 1.24), (0.38, 0, 1.00), "shoulder.L"),
        ("hand.L",     (0.38, 0, 1.00), (0.38, 0, 0.90), "forearm.L"),
        ("shoulder.R", (-0.20, 0, 1.40), (-0.34, 0, 1.24), "chest"),
        ("forearm.R",  (-0.34, 0, 1.24), (-0.38, 0, 1.00), "shoulder.R"),
        ("hand.R",     (-0.38, 0, 1.00), (-0.38, 0, 0.90), "forearm.R"),
        ("thigh.L", (0.11, 0, 0.92), (0.12, 0, 0.50), "hips"),
        ("shin.L",  (0.12, 0, 0.50), (0.12, 0, 0.08), "thigh.L"),
        ("foot.L",  (0.12, 0, 0.08), (0.12, -0.10, 0.02), "shin.L"),
        ("thigh.R", (-0.11, 0, 0.92), (-0.12, 0, 0.50), "hips"),
        ("shin.R",  (-0.12, 0, 0.50), (-0.12, 0, 0.08), "thigh.R"),
        ("foot.R",  (-0.12, 0, 0.08), (-0.12, -0.10, 0.02), "shin.R"),
        ("cape1", (0, 0.10, 1.40), (0, 0.16, 1.05), "chest"),
        ("cape2", (0, 0.16, 1.05), (0, 0.22, 0.70), "cape1"),
        ("cape3", (0, 0.22, 0.70), (0, 0.28, 0.35), "cape2"),
    ]
    arm = make_armature("TechieManRig", bones)
    # --- torso / pelvis ---
    pelvis = box("pelvis", (0, 0, 0.95), (0.17, 0.11, 0.12), INK); parent_to_bone(pelvis, arm, "hips")
    torso = box("torso", (0, 0, 1.22), (0.19, 0.12, 0.17), INK); parent_to_bone(torso, arm, "chest")
    # CODE across the chest, bold white capitals (front = -Y)
    code = text_mesh("CODE_chest", "CODE", 0.20, 0.02, WHITE, (0, -0.145, 1.30))
    parent_to_bone(code, arm, "chest")
    # --- neck (fills the torso/head gap) ---
    neck = cyl_between("neck", (0, 0, 1.38), (0, 0, 1.52), 0.055, INK)
    parent_to_bone(neck, arm, "neck")
    # --- head: ink-black, spiky hair, white eye slits ---
    head = sphere("head", (0, 0, 1.59), 0.13, INK); parent_to_bone(head, arm, "head")
    for i, (x, z, r, dep) in enumerate([(-0.07, 1.70, 0.05, 0.16), (0.0, 1.73, 0.055, 0.18), (0.07, 1.70, 0.05, 0.16),
                                        (-0.11, 1.64, 0.04, 0.12), (0.11, 1.64, 0.04, 0.12)]):
        spike = cone(f"hair{i}", (x, 0.05, z), r, dep, INK, rot=(math.radians(-35), 0, 0))
        parent_to_bone(spike, arm, "head")
    for sx in (-0.05, 0.05):
        eye = box(f"eye{'+' if sx > 0 else '-'}", (sx, -0.125, 1.60), (0.018, 0.006, 0.008), GLOW)
        parent_to_bone(eye, arm, "head")
    # --- arms / legs (limbs between joints) ---
    for s in ("L", "R"):
        sx = 0.27 if s == "L" else -0.27
        ua = cyl_between(f"upper_arm.{s}", (sx * 0.78, 0, 1.40), (sx * 1.26, 0, 1.24), 0.05, INK)
        parent_to_bone(ua, arm, f"shoulder.{s}")
        fa = cyl_between(f"forearm.{s}", (sx * 1.26, 0, 1.24), (sx * 1.41, 0, 1.00), 0.045, INK)
        parent_to_bone(fa, arm, f"forearm.{s}")
        hand = box(f"hand.{s}", (sx * 1.41, 0, 0.95), (0.04, 0.035, 0.05), INK)
        parent_to_bone(hand, arm, f"hand.{s}")
        th = cyl_between(f"thigh.{s}", (sx * 0.41, 0, 0.92), (sx * 0.44, 0, 0.50), 0.065, INK)
        parent_to_bone(th, arm, f"thigh.{s}")
        sh = cyl_between(f"shin.{s}", (sx * 0.44, 0, 0.50), (sx * 0.44, 0, 0.08), 0.055, INK)
        parent_to_bone(sh, arm, f"shin.{s}")
        boot = box(f"boot.{s}", (sx * 0.44, -0.03, 0.05), (0.06, 0.09, 0.035), INK)
        parent_to_bone(boot, arm, f"foot.{s}")
    # --- pen-staff in the RIGHT hand: glowing white nib (staff passes through the hand) ---
    staff = cyl_between("pen_staff", (-0.38, -0.06, 0.72), (-0.38, -0.06, 1.92), 0.022, INK)
    parent_to_bone(staff, arm, "hand.R")
    nib = cone("pen_nib", (-0.38, -0.06, 1.99), 0.035, 0.14, GLOW)
    parent_to_bone(nib, arm, "hand.R")
    # --- cape: vertical subdivided plane behind the back, weighted to cape1/2/3 ---
    bpy.ops.mesh.primitive_plane_add(location=(0, 0.17, 0.90), size=1)
    cape = bpy.context.active_object; cape.name = "cape"
    cape.rotation_euler = (math.radians(90), 0, 0)
    cape.scale = (0.34, 1.0, 0.62)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=7)
    bpy.ops.object.mode_set(mode='OBJECT')
    cape.data.materials.append(INK)
    # Taper + drape: narrow at the shoulders, wide at the hem, hem kicked back.
    # (Mesh vertices carry the baked location, so z here is world-ish 0.4..1.4.)
    for v in cape.data.vertices:
        t = (1.52 - v.co.z) / 1.24  # ~0.1 top -> ~0.9 bottom
        v.co.y += t * t * 0.30
        v.co.x *= (0.62 + t * 0.85)
    grp = {"cape1": cape.vertex_groups.new(name="cape1"),
           "cape2": cape.vertex_groups.new(name="cape2"),
           "cape3": cape.vertex_groups.new(name="cape3")}
    for v in cape.data.vertices:
        z = v.co.z
        if z > 1.15: grp["cape1"].add([v.index], 1.0, 'REPLACE')
        elif z > 0.80: grp["cape2"].add([v.index], 1.0, 'REPLACE')
        else: grp["cape3"].add([v.index], 1.0, 'REPLACE')
    mod = cape.modifiers.new("arm", 'ARMATURE'); mod.object = arm
    # --- animations ---
    A = math.radians
    make_action(arm, "idle", 48, [
        (0,  {"chest": (0, 0, 0), "cape1": (0, 0, 0), "cape2": (0, 0, 0), "cape3": (0, 0, 0),
              "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "head": (0, 0, 0)}),
        (24, {"chest": (A(2), 0, 0), "cape1": (A(4), 0, 0), "cape2": (A(7), 0, 0), "cape3": (A(10), 0, 0),
              "shoulder.L": (A(2), 0, 0), "shoulder.R": (A(-2), 0, 0), "head": (A(-2), 0, 0)}),
        (48, {"chest": (0, 0, 0), "cape1": (0, 0, 0), "cape2": (0, 0, 0), "cape3": (0, 0, 0),
              "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "head": (0, 0, 0)}),
    ])
    make_action(arm, "run", 24, [
        (0,  {"thigh.L": (A(-35), 0, 0), "thigh.R": (A(35), 0, 0), "shin.L": (A(10), 0, 0), "shin.R": (A(45), 0, 0),
              "shoulder.L": (A(25), 0, 0), "shoulder.R": (A(-25), 0, 0), "chest": (A(8), 0, 0),
              "cape1": (A(-55), 0, 0), "cape2": (A(-70), 0, 0), "cape3": (A(-80), 0, 0),
              "root": ('loc', (0, 0, 0.02)), "hips": (0, 0, 0)}),
        (6,  {"thigh.L": (A(0), 0, 0), "thigh.R": (A(0), 0, 0), "shin.L": (A(30), 0, 0), "shin.R": (A(15), 0, 0),
              "shoulder.L": (A(0), 0, 0), "shoulder.R": (A(0), 0, 0), "chest": (A(8), 0, 0),
              "cape1": (A(-55), 0, 0), "cape2": (A(-70), 0, 0), "cape3": (A(-80), 0, 0),
              "root": ('loc', (0, 0, 0.06)), "hips": (0, 0, 0)}),
        (12, {"thigh.L": (A(35), 0, 0), "thigh.R": (A(-35), 0, 0), "shin.L": (A(45), 0, 0), "shin.R": (A(10), 0, 0),
              "shoulder.L": (A(-25), 0, 0), "shoulder.R": (A(25), 0, 0), "chest": (A(8), 0, 0),
              "cape1": (A(-55), 0, 0), "cape2": (A(-70), 0, 0), "cape3": (A(-80), 0, 0),
              "root": ('loc', (0, 0, 0.02)), "hips": (0, 0, 0)}),
        (18, {"thigh.L": (A(0), 0, 0), "thigh.R": (A(0), 0, 0), "shin.L": (A(15), 0, 0), "shin.R": (A(30), 0, 0),
              "shoulder.L": (A(0), 0, 0), "shoulder.R": (A(0), 0, 0), "chest": (A(8), 0, 0),
              "cape1": (A(-55), 0, 0), "cape2": (A(-70), 0, 0), "cape3": (A(-80), 0, 0),
              "root": ('loc', (0, 0, 0.06)), "hips": (0, 0, 0)}),
        (24, {"thigh.L": (A(-35), 0, 0), "thigh.R": (A(35), 0, 0), "shin.L": (A(10), 0, 0), "shin.R": (A(45), 0, 0),
              "shoulder.L": (A(25), 0, 0), "shoulder.R": (A(-25), 0, 0), "chest": (A(8), 0, 0),
              "cape1": (A(-55), 0, 0), "cape2": (A(-70), 0, 0), "cape3": (A(-80), 0, 0),
              "root": ('loc', (0, 0, 0.02)), "hips": (0, 0, 0)}),
    ])
    make_action(arm, "attack_light", 24, [
        (0,  {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0), "shoulder.L": (0, 0, 0)}),
        (8,  {"shoulder.R": (A(-70), 0, A(35)), "forearm.R": (A(-50), 0, 0), "chest": (0, A(18), 0), "shoulder.L": (A(15), 0, 0)}),
        (13, {"shoulder.R": (A(55), 0, A(-60)), "forearm.R": (A(-5), 0, 0), "chest": (0, A(-22), 0), "shoulder.L": (A(-15), 0, 0)}),
        (24, {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0), "shoulder.L": (0, 0, 0)}),
    ])
    make_action(arm, "attack_heavy", 36, [
        (0,  {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
        (12, {"shoulder.R": (A(-120), 0, A(20)), "forearm.R": (A(-80), 0, 0), "chest": (A(-8), A(20), 0), "hips": (A(-5), 0, 0)}),
        (20, {"shoulder.R": (A(80), 0, A(-15)), "forearm.R": (A(-5), 0, 0), "chest": (A(14), A(-25), 0), "hips": (A(8), 0, 0)}),
        (36, {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
    ])
    make_action(arm, "hit", 12, [
        (0, {"chest": (0, 0, 0), "head": (0, 0, 0), "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "hips": (0, 0, 0)}),
        (4, {"chest": (A(-16), 0, 0), "head": (A(-20), 0, 0), "shoulder.L": (A(-30), 0, 0), "shoulder.R": (A(-30), 0, 0),
             "hips": ('loc', (0, 0.06, 0))}),
        (12, {"chest": (0, 0, 0), "head": (0, 0, 0), "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0),
              "hips": ('loc', (0, 0, 0))}),
    ])
    make_action(arm, "death", 36, [
        (0,  {"root": (0, 0, 0), "hips": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0),
              "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "thigh.L": (0, 0, 0), "thigh.R": (0, 0, 0)}),
        (18, {"root": (A(-45), 0, 0), "hips": (A(-10), 0, 0), "chest": (A(-15), 0, 0), "head": (A(-25), 0, 0),
              "shoulder.L": (A(-40), 0, A(30)), "shoulder.R": (A(-40), 0, A(-30)),
              "thigh.L": (A(10), 0, 0), "thigh.R": (A(10), 0, 0)}),
        (36, {"root": (A(-88), 0, 0), "hips": (A(-5), 0, 0), "chest": (A(-5), 0, 0), "head": (A(-10), 0, 0),
              "shoulder.L": (A(-70), 0, A(40)), "shoulder.R": (A(-70), 0, A(-40)),
              "thigh.L": (A(5), 0, 0), "thigh.R": (A(5), 0, 0)}),
    ])
    make_action(arm, "jump", 24, [
        (0,  {"root": ('loc', (0, 0, 0.02)), "thigh.L": (0, 0, 0), "thigh.R": (0, 0, 0),
              "shin.L": (0, 0, 0), "shin.R": (0, 0, 0), "chest": (0, 0, 0)}),
        (5,  {"root": ('loc', (0, 0, -0.06)), "thigh.L": (A(-25), 0, 0), "thigh.R": (A(-25), 0, 0),
              "shin.L": (A(35), 0, 0), "shin.R": (A(35), 0, 0), "chest": (A(6), 0, 0)}),
        (12, {"root": ('loc', (0, 0, 0.55)), "thigh.L": (A(-40), 0, 0), "thigh.R": (A(-15), 0, 0),
              "shin.L": (A(60), 0, 0), "shin.R": (A(40), 0, 0), "chest": (A(-4), 0, 0)}),
        (19, {"root": ('loc', (0, 0, 0.10)), "thigh.L": (A(-10), 0, 0), "thigh.R": (A(-10), 0, 0),
              "shin.L": (A(20), 0, 0), "shin.R": (A(20), 0, 0), "chest": (A(4), 0, 0)}),
        (24, {"root": ('loc', (0, 0, 0.02)), "thigh.L": (0, 0, 0), "thigh.R": (0, 0, 0),
              "shin.L": (0, 0, 0), "shin.R": (0, 0, 0), "chest": (0, 0, 0)}),
    ])
    make_action(arm, "dodge", 18, [
        (0,  {"root": ('loc', (0, 0, 0.02)), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
        (6,  {"root": ('loc', (0.35, 0, 0.02)), "chest": (A(10), 0, A(25)), "hips": (A(0), 0, A(10))}),
        (12, {"root": ('loc', (0.55, 0, 0.02)), "chest": (A(6), 0, A(12)), "hips": (A(0), 0, A(5))}),
        (18, {"root": ('loc', (0, 0, 0.02)), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
    ])
    finish_actions(arm)
    return arm

# ---------------------------------------------------------------- LEAK troops (letter-built, ink-pool rise)
def build_leak(variant):
    clean()
    cfg = {
        "leak_scamp":  dict(scale=0.85, letter=0.48, pool=0.75, arm_r=0.05, name="LEAK Scamp"),
        "leak_skitter": dict(scale=1.10, letter=0.58, pool=0.95, arm_r=0.06, name="LEAK Skitter"),
        "leak_brute":  dict(scale=1.60, letter=0.85, pool=1.30, arm_r=0.09, name="LEAK Brute"),
    }[variant]
    s = cfg["scale"]; ls = cfg["letter"]
    bones = [
        ("root",  (0, 0, 0.02),  (0, 0, 0.30),  None),
        ("torso", (0, 0, 0.55 * s), (0, 0, 1.15 * s), "root"),
        ("arm.L", (0.30 * s, 0, 1.05 * s), (0.55 * s, 0, 0.85 * s), "torso"),
        ("arm.R", (-0.30 * s, 0, 1.05 * s), (-0.55 * s, 0, 0.85 * s), "torso"),
    ]
    arm = make_armature("LeakRig", bones)
    # ink pool the troop rises out of (matte ink — the glossy disc blew out
    # to grey under the sun in the preview)
    pool = disc("ink_pool", (0, 0, 0.04), cfg["pool"], 0.08, INK)
    # dark ink body mass behind the letters — the letters sit ON one body.
    # Backing front face is exactly at the letters' backs (y=-0.10*s), so the
    # letters read proud of the body instead of sinking into it.
    backing = box("leak_body", (0, -0.02 * s, 1.00 * s), (0.34 * s, 0.08 * s, 0.42 * s), INK)
    parent_to_bone(backing, arm, "torso")
    # letter body: L E on top row, A K below — WHITE letters on the black
    # ink body (same canon as the boss's white NULL on his black cloak;
    # black-on-black was unreadable in the preview)
    positions = [("L", (-0.26 * s, -0.10 * s, 1.24 * s)), ("E", (0.26 * s, -0.10 * s, 1.24 * s)),
                 ("A", (-0.26 * s, -0.10 * s, 0.76 * s)), ("K", (0.26 * s, -0.10 * s, 0.76 * s))]
    for letter, loc in positions:
        lm = text_mesh(f"letter_{letter}", letter, ls, 0.06, WHITE, loc)
        parent_to_bone(lm, arm, "torso")
    # white eye slits on the A (the face) — proud of the letter front
    for sx in (-0.32, -0.20):
        eye = box(f"eye{sx}", (sx * s, -0.17 * s, 0.82 * s), (0.02, 0.008, 0.01), GLOW)
        parent_to_bone(eye, arm, "torso")
    # dripping ink below the letters (brute: forward of the ink skirt front)
    drip_y = -0.30 * s if variant == "leak_brute" else 0
    for i, (dx, dz, dl) in enumerate([(-0.45, 0.42, 0.16), (-0.10, 0.40, 0.22), (0.18, 0.42, 0.14),
                                      (0.45, 0.40, 0.20), (0.0, 0.44, 0.12)]):
        drip = cone(f"drip{i}", (dx * s, drip_y, dz * s), 0.035 * s, dl * s, GLOSS,
                    rot=(math.radians(180), 0, 0))
        parent_to_bone(drip, arm, "torso")
    # reaching arms with 3 claws each (rooted in the body mass so they connect)
    for side, sx in (("L", 1), ("R", -1)):
        a = cyl_between(f"arm.{side}", (sx * 0.28 * s, 0, 1.05 * s), (sx * 0.62 * s, -0.18 * s, 0.95 * s),
                        cfg["arm_r"], INK)
        parent_to_bone(a, arm, f"arm.{side}")
        for ci, cy in enumerate((-0.06, 0.0, 0.06)):
            claw = cone(f"claw.{side}.{ci}", (sx * 0.66 * s, -0.24 * s, (0.95 + cy) * s), 0.025 * s,
                        0.16 * s, INK, rot=(math.radians(80), 0, 0))
            parent_to_bone(claw, arm, f"arm.{side}")
    # stubby ink legs / tendrils for brute + skitter; scamp hovers on the pool
    if variant != "leak_scamp":
        leg_r = 0.09 * s if variant == "leak_brute" else 0.06 * s
        for sx in (0.18, -0.18):
            leg = cyl_between(f"leg{sx}", (sx * s, 0, 0.45 * s), (sx * s, 0, 0.08), leg_r, INK)
            parent_to_bone(leg, arm, "root")
    # BRUTE ONLY — ink skirt: a solid tapered mass from the pool up into the
    # body. Art QA (create-game-assets): the first brute preview showed the
    # letter slab FLOATING above the pool on two stick legs; the brute must
    # read as rising OUT of the ink. The skirt is shifted BACK (+Y) so its
    # front stays behind the letters' backs — a centered cone swallowed the
    # A/K row in the second preview. Top overlaps into the backing box so
    # the idle bob never opens a gap. Drips move forward of the skirt front.
    if variant == "leak_brute":
        skirt_top = 1.00 * s
        skirt = frustum("ink_skirt", (0, 0.28 * s, (0.08 + skirt_top) / 2),
                        0.50 * s, 0.26 * s, skirt_top - 0.08, INK)
        parent_to_bone(skirt, arm, "root")
    A = math.radians
    make_action(arm, "idle", 48, [
        (0,  {"torso": (0, 0, 0), "arm.L": (0, 0, 0), "arm.R": (0, 0, 0), "root": ('loc', (0, 0, 0.02))}),
        (24, {"torso": (A(3), 0, A(2)), "arm.L": (A(-8), 0, 0), "arm.R": (A(8), 0, 0), "root": ('loc', (0, 0, 0.06))}),
        (48, {"torso": (0, 0, 0), "arm.L": (0, 0, 0), "arm.R": (0, 0, 0), "root": ('loc', (0, 0, 0.02))}),
    ])
    make_action(arm, "walk", 24, [
        (0,  {"torso": (A(6), 0, A(4)), "arm.L": (A(-20), 0, 0), "arm.R": (A(20), 0, 0), "root": ('loc', (0, 0, 0.02))}),
        (12, {"torso": (A(-6), 0, A(-4)), "arm.L": (A(20), 0, 0), "arm.R": (A(-20), 0, 0), "root": ('loc', (0, 0, 0.10))}),
        (24, {"torso": (A(6), 0, A(4)), "arm.L": (A(-20), 0, 0), "arm.R": (A(20), 0, 0), "root": ('loc', (0, 0, 0.02))}),
    ])
    make_action(arm, "attack", 24, [
        (0,  {"arm.L": (0, 0, 0), "arm.R": (0, 0, 0), "torso": (0, 0, 0)}),
        (8,  {"arm.L": (A(-70), 0, 0), "arm.R": (A(-70), 0, 0), "torso": (A(-10), 0, 0)}),
        (13, {"arm.L": (A(60), 0, 0), "arm.R": (A(60), 0, 0), "torso": (A(14), 0, 0)}),
        (24, {"arm.L": (0, 0, 0), "arm.R": (0, 0, 0), "torso": (0, 0, 0)}),
    ])
    make_action(arm, "hit", 12, [
        (0, {"torso": (0, 0, 0)}),
        (4, {"torso": (A(-18), 0, A(8))}),
        (12, {"torso": (0, 0, 0)}),
    ])
    make_action(arm, "death", 30, [
        (0,  {"root": ('loc', (0, 0, 0.02)), "torso": (0, 0, 0), "arm.L": (0, 0, 0), "arm.R": (0, 0, 0)}),
        (15, {"root": ('loc', (0, 0, -0.25)), "torso": (A(20), 0, A(15)), "arm.L": (A(-50), 0, 0), "arm.R": (A(50), 0, 0)}),
        (30, {"root": ('loc', (0, 0, -0.70)), "torso": (A(35), 0, A(25)), "arm.L": (A(-70), 0, 0), "arm.R": (A(70), 0, 0)}),
    ])
    finish_actions(arm)
    return arm

# ---------------------------------------------------------------- BOSS: NULLPOINTER
def build_boss():
    clean()
    bones = [
        ("root",  (0, 0, 0.02),   (0, 0, 0.40),  None),
        ("hips",  (0, 0, 1.90),   (0, 0, 2.05),  "root"),
        ("spine", (0, 0, 2.05),   (0, 0, 2.45),  "hips"),
        ("chest", (0, 0, 2.45),   (0, 0, 2.85),  "spine"),
        ("neck",  (0, 0, 2.85),   (0, 0, 2.95),  "chest"),
        ("head",  (0, 0, 2.95),   (0, 0, 3.35),  "neck"),
        ("shoulder.L", (0.42, 0, 2.80), (0.72, 0, 2.45), "chest"),
        ("forearm.L",  (0.72, 0, 2.45), (0.78, 0, 2.05), "shoulder.L"),
        ("hand.L",     (0.78, 0, 2.05), (0.78, 0, 1.92), "forearm.L"),
        ("shoulder.R", (-0.42, 0, 2.80), (-0.72, 0, 2.45), "chest"),
        ("forearm.R",  (-0.72, 0, 2.45), (-0.78, 0, 2.05), "shoulder.R"),
        ("hand.R",     (-0.78, 0, 2.05), (-0.78, 0, 1.92), "forearm.R"),
        ("thigh.L", (0.22, 0, 1.85), (0.24, 0, 1.00), "hips"),
        ("shin.L",  (0.24, 0, 1.00), (0.24, 0, 0.15), "thigh.L"),
        ("thigh.R", (-0.22, 0, 1.85), (-0.24, 0, 1.00), "hips"),
        ("shin.R",  (-0.24, 0, 1.00), (-0.24, 0, 0.15), "thigh.R"),
        ("cloak1", (0, 0.18, 2.75), (0, 0.30, 2.10), "chest"),
        ("cloak2", (0, 0.30, 2.10), (0, 0.45, 1.20), "cloak1"),
        ("cloak3", (0, 0.45, 1.20), (0, 0.60, 0.40), "cloak2"),
    ]
    arm = make_armature("NullpointerRig", bones)
    # cloak: great tapered cone, the body of the void
    bpy.ops.mesh.primitive_cone_add(location=(0, 0.10, 1.45), radius1=0.95, radius2=0.42, depth=2.9, vertices=24)
    cloak = bpy.context.active_object; cloak.name = "cloak"
    cloak.data.materials.append(INK)
    # NULL across the chest in white capitals; POINTER down the cloak front.
    # Cloak cone: radius 0.95 at z=0 -> 0.42 at z=2.9; letters sit just
    # outside the cloak surface at their height.
    def cloak_front_y(zz):
        return -(0.95 - (zz / 2.9) * 0.53 + 0.04)
    null_txt = text_mesh("NULL_chest", "NULL", 0.42, 0.05, WHITE, (0, cloak_front_y(2.62), 2.62))
    parent_to_bone(null_txt, arm, "chest")
    for i, letter in enumerate("POINTER"):
        zz = 2.28 - i * 0.26
        lm = text_mesh(f"ptr_{letter}", letter, 0.30, 0.04, WHITE, (0, cloak_front_y(zz), zz))
        parent_to_bone(lm, arm, "chest")
    # hood + hollow face: white eye slits only (NOT red)
    hood = cone("hood", (0, 0, 3.18), 0.34, 0.75, INK)
    parent_to_bone(hood, arm, "head")
    face = sphere("face", (0, -0.06, 3.05), 0.20, INK, scale=(1, 0.8, 1.1))
    parent_to_bone(face, arm, "head")
    for sx in (-0.08, 0.08):
        eye = box(f"eye{sx}", (sx, -0.24, 3.08), (0.03, 0.01, 0.012), GLOW)
        parent_to_bone(eye, arm, "head")
    # horns
    for sx, rz in ((-0.28, -28), (0.28, 28)):
        horn = cone(f"horn{sx}", (sx, 0, 3.38), 0.07, 0.45, INK,
                    rot=(0, 0, math.radians(rz)))
        parent_to_bone(horn, arm, "head")
    # spiked shoulders
    for sx in (-0.48, 0.48):
        spike = cone(f"shoulder_spike{sx}", (sx, 0, 2.92), 0.09, 0.35, INK, rot=(0, 0, math.radians(-25 if sx > 0 else 25)))
        parent_to_bone(spike, arm, "chest")
    # arms + clawed hands
    for s in ("L", "R"):
        sx = 0.57 if s == "L" else -0.57
        ua = cyl_between(f"upper_arm.{s}", (sx * 0.74, 0, 2.80), (sx * 1.26, 0, 2.45), 0.11, INK)
        parent_to_bone(ua, arm, f"shoulder.{s}")
        fa = cyl_between(f"forearm.{s}", (sx * 1.26, 0, 2.45), (sx * 1.37, 0, 2.05), 0.09, INK)
        parent_to_bone(fa, arm, f"forearm.{s}")
        hand = box(f"hand.{s}", (sx * 1.37, 0, 1.98), (0.09, 0.08, 0.11), INK)
        parent_to_bone(hand, arm, f"hand.{s}")
        for ci, cy in enumerate((-0.07, 0.0, 0.07)):
            claw = cone(f"claw.{s}.{ci}", (sx * 1.37, -0.10, 1.92 + cy), 0.035, 0.22, INK,
                        rot=(math.radians(75), 0, 0))
            parent_to_bone(claw, arm, f"hand.{s}")
    # legs (mostly hidden by the cloak, but modelled)
    for sx in (0.23, -0.23):
        leg = cyl_between(f"leg{sx}", (sx, 0, 1.85), (sx, 0, 0.15), 0.13, INK)
        parent_to_bone(leg, arm, "hips")
    # the Hollow Orb — white glowing sphere in the LEFT hand
    orb = sphere("hollow_orb", (0.80, -0.05, 1.95), 0.17, GLOW)
    parent_to_bone(orb, arm, "hand.L")
    # code chips held in the RIGHT hand (white chips; readable lines fly in-game)
    chip = text_mesh("code_chip", "if (null)", 0.14, 0.015, WHITE, (-0.80, -0.12, 2.02))
    parent_to_bone(chip, arm, "hand.R")
    A = math.radians
    make_action(arm, "idle", 48, [
        (0,  {"chest": (0, 0, 0), "cloak1": (0, 0, 0), "cloak2": (0, 0, 0), "cloak3": (0, 0, 0),
              "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "head": (0, 0, 0)}),
        (24, {"chest": (A(2), 0, 0), "cloak1": (A(3), 0, 0), "cloak2": (A(5), 0, 0), "cloak3": (A(8), 0, 0),
              "shoulder.L": (A(3), 0, 0), "shoulder.R": (A(-3), 0, 0), "head": (A(-2), 0, 0)}),
        (48, {"chest": (0, 0, 0), "cloak1": (0, 0, 0), "cloak2": (0, 0, 0), "cloak3": (0, 0, 0),
              "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "head": (0, 0, 0)}),
    ])
    make_action(arm, "walk", 36, [
        (0,  {"thigh.L": (A(-22), 0, 0), "thigh.R": (A(22), 0, 0), "chest": (A(6), 0, 0),
              "cloak1": (A(-8), 0, 0), "cloak2": (A(-12), 0, 0), "cloak3": (A(-16), 0, 0),
              "root": ('loc', (0, 0, 0.02))}),
        (18, {"thigh.L": (A(22), 0, 0), "thigh.R": (A(-22), 0, 0), "chest": (A(6), 0, 0),
              "cloak1": (A(-8), 0, 0), "cloak2": (A(-12), 0, 0), "cloak3": (A(-16), 0, 0),
              "root": ('loc', (0, 0, 0.08))}),
        (36, {"thigh.L": (A(-22), 0, 0), "thigh.R": (A(22), 0, 0), "chest": (A(6), 0, 0),
              "cloak1": (A(-8), 0, 0), "cloak2": (A(-12), 0, 0), "cloak3": (A(-16), 0, 0),
              "root": ('loc', (0, 0, 0.02))}),
    ])
    make_action(arm, "attack_slam", 36, [
        (0,  {"shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
        (14, {"shoulder.L": (A(-110), 0, A(15)), "shoulder.R": (A(-110), 0, A(-15)), "chest": (A(-10), 0, 0), "hips": (A(-6), 0, 0)}),
        (20, {"shoulder.L": (A(70), 0, 0), "shoulder.R": (A(70), 0, 0), "chest": (A(18), 0, 0), "hips": (A(10), 0, 0)}),
        (36, {"shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "chest": (0, 0, 0), "hips": (0, 0, 0)}),
    ])
    make_action(arm, "attack_throw", 30, [
        (0,  {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0)}),
        (12, {"shoulder.R": (A(-95), 0, A(30)), "forearm.R": (A(-60), 0, 0), "chest": (0, A(20), 0)}),
        (17, {"shoulder.R": (A(60), 0, A(-40)), "forearm.R": (A(-5), 0, 0), "chest": (0, A(-25), 0)}),
        (30, {"shoulder.R": (0, 0, 0), "forearm.R": (0, 0, 0), "chest": (0, 0, 0)}),
    ])
    make_action(arm, "attack_charge", 30, [
        (0,  {"chest": (0, 0, 0), "root": ('loc', (0, 0, 0.02)), "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0)}),
        (10, {"chest": (A(-12), 0, 0), "root": ('loc', (0, 0, -0.10)), "shoulder.L": (A(-40), 0, 0), "shoulder.R": (A(-40), 0, 0)}),
        (18, {"chest": (A(22), 0, 0), "root": ('loc', (0, -0.9, 0.05)), "shoulder.L": (A(30), 0, 0), "shoulder.R": (A(30), 0, 0)}),
        (30, {"chest": (0, 0, 0), "root": ('loc', (0, 0, 0.02)), "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0)}),
    ])
    make_action(arm, "hit", 12, [
        (0, {"chest": (0, 0, 0), "head": (0, 0, 0)}),
        (4, {"chest": (A(-10), 0, 0), "head": (A(-14), 0, 0)}),
        (12, {"chest": (0, 0, 0), "head": (0, 0, 0)}),
    ])
    make_action(arm, "roar", 48, [
        (0,  {"shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0)}),
        (16, {"shoulder.L": (A(-140), 0, A(40)), "shoulder.R": (A(-140), 0, A(-40)), "chest": (A(-14), 0, 0), "head": (A(-22), 0, 0)}),
        (32, {"shoulder.L": (A(-150), 0, A(45)), "shoulder.R": (A(-150), 0, A(-45)), "chest": (A(-18), 0, 0), "head": (A(-28), 0, 0)}),
        (48, {"shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0)}),
    ])
    make_action(arm, "death", 48, [
        (0,  {"root": (0, 0, 0), "chest": (0, 0, 0), "head": (0, 0, 0), "shoulder.L": (0, 0, 0), "shoulder.R": (0, 0, 0)}),
        (24, {"root": (A(-40), 0, 0), "chest": (A(-18), 0, 0), "head": (A(-25), 0, 0),
              "shoulder.L": (A(-60), 0, A(40)), "shoulder.R": (A(-60), 0, A(-40))}),
        (48, {"root": (A(-88), 0, 0), "chest": (A(-8), 0, 0), "head": (A(-12), 0, 0),
              "shoulder.L": (A(-80), 0, A(50)), "shoulder.R": (A(-80), 0, A(-50))}),
    ])
    finish_actions(arm)
    return arm

# ---------------------------------------------------------------- export + preview + main
def render_preview(char_name, height, arm_obj):
    # Render at the REST pose: disable the NLA stack first, or the run strip's
    # frame-0 cape swing (-55 deg) bleeds into the preview. Restored after.
    ad = arm_obj.animation_data
    ad.use_nla = False
    ad.action = None
    set_rest(arm_obj)
    bpy.context.scene.frame_set(0)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = 640; sc.render.resolution_y = 400
    sc.render.filepath = os.path.join(PREVIEW_DIR, char_name + "_34.png")
    world = bpy.data.worlds.new("w"); sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.92, 0.90, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    bpy.ops.object.light_add(type='SUN', location=(3, -4, 6))
    sun = bpy.context.active_object; sun.data.energy = 2.0
    bpy.ops.object.light_add(type='SUN', location=(-3, 3, 4))
    sun2 = bpy.context.active_object; sun2.data.energy = 1.2
    # Pull the camera back for tall characters (k scales the horizontal
    # offset): at a fixed distance the 3.6 m boss's horns + NULL letters
    # clipped out of the 640x400 frame. k=1 up to 2.4 m, 1.5 at 3.6 m.
    k = max(1.0, height / 2.4)
    bpy.ops.object.camera_add(location=(3.2 * k, -4.2 * k, height * 0.62))
    cam = bpy.context.active_object; sc.camera = cam
    cam.rotation_euler = (math.radians(78), 0, math.radians(37))
    # point camera at character mid-height
    direction = mathutils.Vector((0, 0, height * 0.5)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.render.render(write_still=True)
    # side view (proves depth / real 3D)
    cam.location = (4.6 * k, 0.6 * k, height * 0.55)
    direction = mathutils.Vector((0, 0, height * 0.5)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(PREVIEW_DIR, char_name + "_side.png")
    bpy.ops.render.render(write_still=True)
    # Restore the NLA stack for the GLB export (animations live in the strips).
    ad.use_nla = True

def export_glb(char_name, arm):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type in ('MESH', 'ARMATURE'):
            o.select_set(True)
    path = os.path.join(OUT_DIR, char_name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_animations=True, export_nla_strips=True,
                              export_yup=True, export_apply=True)
    print("EXPORTED", path, os.path.getsize(path), "bytes")
    # save the .blend too (staged locally, binary — not pushed)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, char_name + ".blend"))
    return path

def main():
    global INK, WHITE, GLOW, GREY, GLOSS
    INK = mat("ink_black", (0.02, 0.02, 0.02), 0.55)
    WHITE = mat("paper_white", (0.95, 0.95, 0.93), 0.5)
    GLOW = mat("white_glow", (0.9, 0.9, 0.9), 0.3, emission=(1, 1, 1), emission_strength=2.5)
    GREY = mat("ink_grey", (0.25, 0.25, 0.25), 0.7)
    GLOSS = mat("ink_gloss", (0.01, 0.01, 0.01), 0.30)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    char = "hero"
    for a in argv:
        if a.startswith("--char="): char = a.split("=", 1)[1]
    heights = {"hero": 1.8, "leak_scamp": 1.4, "leak_skitter": 1.7, "leak_brute": 2.4, "nullpointer": 3.6}
    if char == "hero":
        arm = build_hero()
    elif char.startswith("leak_"):
        arm = build_leak(char)
    elif char == "nullpointer":
        arm = build_boss()
    else:
        raise ValueError("unknown char " + char)
    render_preview(char, heights[char], arm)
    export_glb(char, arm)
    print("DONE", char, "actions:", [a.name for a in bpy.data.actions])

main()
