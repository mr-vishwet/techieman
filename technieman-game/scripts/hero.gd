class_name Hero
extends CharacterBody3D
## TechieMan / The Developer — the playable hero.
## Real 3D GLB model (procedural ink-style, built in Blender) with an
## AnimationPlayer: idle / run / attack_light / attack_heavy / hit / death /
## jump / dodge. Combat (physics.md, 1 m = 100 px):
## run 5.2 m/s, jump 9.0 m/s, slash 460 ms, 'if' bullet 11 m/s, Debug Nova
## once per fight (600 ms cast, freezes troops 2 s, 25 damage to the boss).
## Guard (hold S / down) shows a WHITE guard ring and blocks code lines.
## Dodge is a double-tap of A / D (or left / right): a quick dash with i-frames.

signal hp_changed(hp: int)
signal died
signal nova_cast

const CodeLineScript := preload("res://scripts/code_line.gd")

var hp: int = CampaignData.HERO_HP
var max_hp: int = CampaignData.HERO_HP
var facing: int = 1  # +1 faces +X (right), -1 faces -X
var dead: bool = false
var frozen: bool = false  # frozen by a boss effect (not used in M1)
var nova_available: bool = true
var in_boss_fight: bool = false
var boss_ref: Node3D = null
var game_ref: Node = null

var _model: Node3D = null
var _anim: AnimationPlayer = null
var _model_root: Node3D = null
var _guard_ring: MeshInstance3D = null
var _slash_until: float = 0.0
var _slash_cooldown_until: float = 0.0
var _bullet_cooldown_until: float = 0.0
var _dodge_until: float = 0.0
var _dodge_cooldown_until: float = 0.0
var _last_tap_dir: int = 0
var _last_tap_time: float = 0.0
var _hit_stun_until: float = 0.0
var _invuln_until: float = 0.0
var _time: float = 0.0
var _current_anim: String = ""
var _was_in_air: bool = false
# Slash buffer (input-systems Pattern 3): a J pressed up to 0.15 s before
# the cooldown ends still fires — an early deflect press is not lost.
var _slash_buffer_until: float = 0.0
# Jump feel core (platformer Pattern 1): coyote 0.1 s (6 ticks) + buffer
# 0.12 s (7 ticks) at the 60 Hz physics tick. Tick stamps, not float
# countdowns — a float timer silently loses a tick at some rates.
const NEVER_TICK := -1000000000
var _tick: int = 0
var _last_ground_tick: int = NEVER_TICK
var _last_jump_press_tick: int = NEVER_TICK
var _squash_tween: Tween = null

func _ready() -> void:
	add_to_group("hero")
	# Collision layer matrix (physics-tuning Pattern 4): layer 1 = world,
	# 2 = player, 3 = enemy (named in project.godot [layer_names]).
	# Hero is ON player, scans world + enemy.
	collision_layer = 2
	collision_mask = 5
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	col.shape = cap
	col.position = Vector3(0, 0.9, 0)
	add_child(col)
	_model_root = Node3D.new()
	_model_root.name = "ModelRoot"
	add_child(_model_root)
	_model = load("res://models/hero.glb").instantiate()
	_model_root.add_child(_model)
	_anim = _model.find_child("AnimationPlayer", true, false)
	# glTF import does not guarantee loop flags: force locomotion clips to
	# loop (godot-animation) so the hero never freezes mid-pose.
	if _anim != null:
		for loop_name in ["idle", "run", "jump", "dodge"]:
			if _anim.has_animation(loop_name):
				_anim.get_animation(loop_name).loop_mode = Animation.LOOP_LINEAR
	# The model faces +Z in Godot space; side view needs it facing +/-X.
	_model_root.rotation.y = PI / 2
	_play_anim("idle")
	# WHITE guard ring (torus, emissive white) — visible only while guarding.
	_guard_ring = MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.75
	torus.outer_radius = 0.9
	_guard_ring.mesh = torus
	var m := StandardMaterial3D.new()
	m.albedo_color = Color.WHITE
	m.emission_enabled = true
	m.emission = Color.WHITE
	m.emission_energy_multiplier = 1.5
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_guard_ring.material_override = m
	_guard_ring.position = Vector3(0, 1.0, 0)
	_guard_ring.visible = false
	add_child(_guard_ring)

func reset_for_fight(full_hp: bool = true) -> void:
	if full_hp:
		hp = max_hp
	dead = false
	frozen = false
	nova_available = true
	_invuln_until = 0.0
	# Clear input buffers on (re)spawn (input-systems: a buffered press
	# must not fire after a respawn).
	_slash_buffer_until = 0.0
	_last_jump_press_tick = NEVER_TICK
	_last_ground_tick = NEVER_TICK
	_hit_stun_until = 0.0
	velocity = Vector3.ZERO
	hp_changed.emit(hp)
	_play_anim("idle")

func _play_anim(name: String) -> void:
	if _anim == null:
		return
	if name == _current_anim and _anim.is_playing():
		return
	if not _anim.has_animation(name):
		return
	_current_anim = name
	_anim.play(name)

func slash_is_active() -> bool:
	return _time < _slash_until

func is_guarding() -> bool:
	return Input.is_action_pressed("guard") and is_on_floor() and not dead

func is_dodging() -> bool:
	return _time < _dodge_until

func try_slash() -> bool:
	if dead or _time < _slash_cooldown_until or _time < _hit_stun_until:
		return false
	_slash_until = _time + CampaignData.SLASH_BUFFER_MS / 1000.0
	_slash_cooldown_until = _time + CampaignData.SLASH_MS / 1000.0
	_play_anim("attack_light")
	# Melee hit on nearby troops (1 damage; brutes need 3).
	for troop in get_tree().get_nodes_in_group("troops"):
		if not is_instance_valid(troop) or troop.is_dead():
			continue
		var d: Vector3 = troop.global_position - global_position
		if abs(d.x) <= CampaignData.SLASH_RANGE and abs(d.y) <= 2.0 and signf(d.x) == facing:
			troop.take_damage(1, self)
	# Melee hit on the boss when close enough (slash is a secondary path;
	# the intended boss damage is the deflect, 30).
	if in_boss_fight and boss_ref != null and boss_ref.has_method("take_damage"):
		var d: Vector3 = boss_ref.global_position - global_position
		if abs(d.x) <= CampaignData.SLASH_RANGE + 0.6 and abs(d.y) <= 3.0:
			boss_ref.take_damage(10, "slash")
	return true

func try_bullet() -> bool:
	if dead or _time < _bullet_cooldown_until or _time < _hit_stun_until:
		return false
	_bullet_cooldown_until = _time + CampaignData.BULLET_COOLDOWN_MS / 1000.0
	var line: CodeLine = CodeLineScript.new()
	line.setup("if (x != null)", CampaignData.BULLET_SPEED,
		Vector3(facing, 0, 0), true, CampaignData.BULLET_DAMAGE, self, boss_ref)
	line.position = global_position + Vector3(facing * 0.8, 1.3, 0)
	line.hit_boss.connect(_on_bullet_hit_boss)
	get_tree().current_scene.add_child(line)
	return true

func _on_bullet_hit_boss(amount: int) -> void:
	if boss_ref != null and boss_ref.has_method("take_damage"):
		boss_ref.take_damage(amount, "bullet")

func check_bullet_troop_hit(line: Node3D) -> bool:
	for troop in get_tree().get_nodes_in_group("troops"):
		if not is_instance_valid(troop) or troop.is_dead():
			continue
		if line.global_position.distance_to(troop.global_position + Vector3(0, 1.0, 0)) <= 1.0:
			troop.take_damage(1, self)
			return true
	return false

func try_nova() -> bool:
	if dead or not nova_available or _time < _hit_stun_until:
		return false
	nova_available = false
	nova_cast.emit()
	_play_anim("attack_heavy")
	if boss_ref != null and boss_ref.has_method("take_damage"):
		boss_ref.take_damage(CampaignData.NOVA_DAMAGE, "nova")
	if game_ref != null and game_ref.has_method("freeze_troops"):
		game_ref.freeze_troops(2.0)
	return true

func try_dodge(dir: int) -> bool:
	if dead or _time < _dodge_cooldown_until or _time < _hit_stun_until:
		return false
	_dodge_cooldown_until = _time + 0.6
	_dodge_until = _time + 0.30
	velocity.x = dir * 9.0
	facing = dir
	_play_anim("dodge")
	return true

func take_damage(amount: int, source: String = "") -> void:
	if dead or _time < _invuln_until or is_dodging():
		return
	hp = maxi(0, hp - amount)
	_invuln_until = _time + 0.4
	_hit_stun_until = _time + 0.2
	hp_changed.emit(hp)
	_play_anim("hit")
	if game_ref != null and game_ref.has_method("on_hero_damaged"):
		game_ref.on_hero_damaged(amount, source)
	if hp <= 0:
		dead = true
		_play_anim("death")
		died.emit()

func heal_full() -> void:
	hp = max_hp
	hp_changed.emit(hp)

func _physics_process(delta: float) -> void:
	_time += delta
	_tick += 1
	if dead:
		return
	# Gravity.
	if not is_on_floor():
		velocity.y -= CampaignData.HERO_GRAVITY * delta
	# Horizontal movement.
	var dir := 0
	if not frozen and _time >= _hit_stun_until:
		if Input.is_action_pressed("move_left"):
			dir = -1
		elif Input.is_action_pressed("move_right"):
			dir = 1
	# Double-tap dodge: a second press of the same direction within 250 ms.
	if dir != 0 and _time < _dodge_until:
		# Dodge dash keeps its velocity; no steering during i-frames.
		pass
	elif dir != 0:
		velocity.x = dir * CampaignData.HERO_RUN_SPEED
		facing = dir
	else:
		velocity.x = move_toward(velocity.x, 0.0, CampaignData.HERO_RUN_SPEED * 6.0 * delta)
	# Jump — platformer feel core: coyote + buffer + variable height
	# (release cut). Consume both stamps on jump so coyote can't double-fire.
	if is_on_floor() and velocity.y >= 0:
		_last_ground_tick = _tick
	if Input.is_action_just_pressed("jump"):
		_last_jump_press_tick = _tick
	if _time >= _hit_stun_until and _tick - _last_jump_press_tick <= 7 and _tick - _last_ground_tick <= 6:
		velocity.y = CampaignData.HERO_JUMP_VELOCITY
		_last_jump_press_tick = NEVER_TICK
		_last_ground_tick = NEVER_TICK
		_play_anim("jump")
	if Input.is_action_just_released("jump") and velocity.y > 0:
		velocity.y *= 0.5  # tap = short hop; hold = full jump
	# Combat inputs. Slash goes through the buffer (input-systems): an
	# early press fires the moment the cooldown ends.
	if Input.is_action_just_pressed("slash"):
		_slash_buffer_until = _time + 0.15
	if _time <= _slash_buffer_until and try_slash():
		_slash_buffer_until = 0.0
	if Input.is_action_just_pressed("bullet"):
		try_bullet()
	if Input.is_action_just_pressed("nova"):
		try_nova()
	# Guard ring follows the guard input (WHITE, not green).
	_guard_ring.visible = is_guarding()
	if _guard_ring.visible:
		_guard_ring.rotation.y += delta * 2.0
	# Facing: model root turns to face the run / fight direction.
	var target_rot := PI / 2 if facing == 1 else -PI / 2
	_model_root.rotation.y = lerp_angle(_model_root.rotation.y, target_rot, 12.0 * delta)
	# Animation selection.
	if _time < _hit_stun_until:
		pass  # hit anim already playing
	elif not is_on_floor():
		if _current_anim != "jump":
			_play_anim("jump")
	elif abs(velocity.x) > 0.5:
		_play_anim("run")
	elif _time >= _slash_cooldown_until and _current_anim not in ["idle", "run", "jump"]:
		_play_anim("idle")
	elif _current_anim == "":
		_play_anim("idle")
	move_and_slide()
	# Clamp to the level / arena bounds (the game sets these).
	if game_ref != null and game_ref.has_method("clamp_hero_position"):
		game_ref.clamp_hero_position(self)
	# Landing squash (game-feel): brief squash, spring back with overshoot.
	# Keep area roughly constant: stretch x/z, squash y.
	if is_on_floor() and _was_in_air:
		_was_in_air = false
		if _squash_tween != null:
			_squash_tween.kill()
		_model_root.scale = Vector3(1.15, 0.82, 1.15)
		_squash_tween = create_tween()
		_squash_tween.tween_property(_model_root, "scale", Vector3.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if not is_on_floor():
		_was_in_air = true

func _input(event: InputEvent) -> void:
	if dead:
		return
	if event is InputEventKey and event.echo:
		return
	# Double-tap detection for the dodge dash.
	if event.is_action_pressed("move_left") or event.is_action_pressed("move_right"):
		var dir := -1 if event.is_action_pressed("move_left") else 1
		if dir == _last_tap_dir and (_time - _last_tap_time) <= 0.25:
			try_dodge(dir)
			_last_tap_dir = 0
		else:
			_last_tap_dir = dir
			_last_tap_time = _time
