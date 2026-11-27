class_name Troop
extends CharacterBody3D
## LEAK troop — a reusable template, configured from CampaignData.
## Real 3D GLB model (letter-built body, ink-pool rise). States:
## ENTER (rise from the ink pool) -> PATROL -> DETECT -> APPROACH ->
## ATTACK -> RECOVER -> DIE (sink back into the ink). HIT flinches.
## Variants differ by configuration + model + attack pattern, never by copying
## the whole troop: scamp chases, skitter lunges erratically, brute slams.

signal died(troop: Troop)

var config: Dictionary = {}
var hero_ref: Node3D = null
var game_ref: Node = null

var hp: int = 1
var max_hp: int = 1
var dead: bool = false
var frozen_until: float = 0.0

var _state: String = "enter"
var _time: float = 0.0
var _state_time: float = 0.0
var _attack_cooldown_until: float = 0.0
var _patrol_dir: int = 1
var _patrol_center: float = 0.0
var _skitter_pause_until: float = 0.0
var _model: Node3D = null
var _anim: AnimationPlayer = null
var _model_root: Node3D = null
var _bar_bg: Sprite3D = null
var _bar_fg: Sprite3D = null
var _pool: MeshInstance3D = null

func setup(p_config: Dictionary, hero: Node3D, game: Node) -> void:
	config = p_config
	hero_ref = hero
	game_ref = game
	hp = int(config.get("hp", 1))
	max_hp = hp

func is_dead() -> bool:
	return dead

func _ready() -> void:
	add_to_group("troops")
	# Layer matrix: enemy is ON layer 3 (value 4), scans world + player.
	collision_layer = 4
	collision_mask = 3
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = float(config.get("height", 1.4))
	col.shape = cap
	col.position = Vector3(0, float(config.get("height", 1.4)) * 0.5, 0)
	add_child(col)
	# Ink pool the troop rises out of.
	_pool = MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.7
	cyl.bottom_radius = 0.9
	cyl.height = 0.12
	_pool.mesh = cyl
	var pm := StandardMaterial3D.new()
	pm.albedo_color = Color(0.01, 0.01, 0.01)
	pm.roughness = 0.1
	_pool.material_override = pm
	_pool.position = Vector3(0, 0.06, 0)
	add_child(_pool)
	_model_root = Node3D.new()
	_model_root.name = "ModelRoot"
	add_child(_model_root)
	_model = load(str(config.get("model", "res://models/leak_scamp.glb"))).instantiate()
	_model_root.add_child(_model)
	_anim = _model.find_child("AnimationPlayer", true, false)
	# glTF import does not guarantee loop flags: force idle/walk to loop
	# (godot-animation) so patrol never freezes mid-pose.
	if _anim != null:
		for loop_name in ["idle", "walk"]:
			if _anim.has_animation(loop_name):
				_anim.get_animation(loop_name).loop_mode = Animation.LOOP_LINEAR
	# Start sunk in the pool; ENTER raises the model out of it.
	_model_root.position.y = -1.2
	_play_anim("idle")
	# HP bar above the troop (white fill on black track, billboarded).
	_bar_bg = _make_bar(Color(0.05, 0.05, 0.05), Vector3(1.0, 0.12, 0))
	_bar_fg = _make_bar(Color.WHITE, Vector3(1.0, 0.12, 0))
	_bar_bg.position = Vector3(0, float(config.get("height", 1.4)) + 0.5, 0)
	_bar_fg.position = Vector3(0, float(config.get("height", 1.4)) + 0.5, 0.05)
	_update_bar()

func _make_bar(color: Color, size: Vector3) -> Sprite3D:
	var s := Sprite3D.new()
	var img := Image.create(8, 8, false, Image.FORMAT_RGBA8)
	img.fill(Color.WHITE)
	var tex := ImageTexture.create_from_image(img)
	s.texture = tex
	s.modulate = color
	s.pixel_size = 0.02
	s.scale = Vector3(size.x / 0.16, size.y / 0.16, 1)
	s.shaded = false
	s.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	s.no_depth_test = false
	add_child(s)
	return s

func _update_bar() -> void:
	if _bar_fg == null:
		return
	var frac := float(hp) / float(maxi(1, max_hp))
	_bar_fg.scale.x = (1.0 / 0.16) * frac
	_bar_fg.visible = hp < max_hp or true

func _play_anim(name: String) -> void:
	if _anim == null or not _anim.has_animation(name):
		return
	if _anim.current_animation == name and _anim.is_playing():
		return
	_anim.play(name)

func take_damage(amount: int, _from: Node = null) -> void:
	if dead:
		return
	hp -= amount
	_update_bar()
	if hp <= 0:
		_die()
	else:
		_set_state("hit")
		_play_anim("hit")

func _die() -> void:
	dead = true
	_set_state("die")
	_play_anim("death")
	died.emit(self)

func freeze(seconds: float) -> void:
	frozen_until = _time + seconds

func _set_state(s: String) -> void:
	_state = s
	_state_time = 0.0

func _physics_process(delta: float) -> void:
	_time += delta
	_state_time += delta
	if dead:
		if _state == "die":
			_model_root.position.y = move_toward(_model_root.position.y, -1.4, delta * 1.5)
			if _state_time > 1.2:
				queue_free()
		return
	if _time < frozen_until:
		_play_anim("idle")
		velocity = Vector3.ZERO
		move_and_slide()
		return
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0.0
	match _state:
		"enter":
			_model_root.position.y = move_toward(_model_root.position.y, 0.0, delta * 1.6)
			velocity.x = 0.0
			if _model_root.position.y >= -0.01:
				_set_state("patrol")
				_patrol_center = global_position.x
		"patrol":
			_play_anim("walk")
			velocity.x = _patrol_dir * float(config.get("speed", 3.0)) * 0.35
			if abs(global_position.x - _patrol_center) > 2.5:
				_patrol_dir = -_patrol_dir
			if _hero_near(6.0):
				_set_state("detect")
		"detect":
			_play_anim("idle")
			velocity.x = 0.0
			if _state_time > 0.35:
				_set_state("approach")
		"approach":
			_play_anim("walk")
			_face_hero()
			var behavior := str(config.get("behavior", "chase"))
			if behavior == "skitter":
				_skitter_move(delta)
			else:
				velocity.x = sign(hero_ref.global_position.x - global_position.x) * float(config.get("speed", 3.0))
			if _hero_near(float(config.get("attack_range", 1.5))):
				_set_state("attack")
			elif not _hero_near(9.0):
				_set_state("patrol")
		"attack":
			velocity.x = 0.0
			if _state_time < 0.2:
				_play_anim("idle")  # telegraph: rear up
			elif _state_time < 0.45:
				_play_anim("attack")
				if _hero_near(float(config.get("attack_range", 1.5)) + 0.5):
					_hit_hero()
			else:
				_set_state("recover")
		"recover":
			_play_anim("idle")
			velocity.x = 0.0
			if _state_time > 0.6:
				_set_state("approach")
		"hit":
			velocity.x = 0.0
			if _state_time > 0.25:
				_set_state("approach")
	move_and_slide()
	# Face the hero while fighting.
	if _state in ["approach", "attack"]:
		_face_hero()

func _skitter_move(delta: float) -> void:
	# Stop-start skitter: 300 ms dash, 150 ms pause, direction flips.
	if _time < _skitter_pause_until:
		velocity.x = 0.0
		return
	var dir: float = signf(hero_ref.global_position.x - global_position.x)
	velocity.x = dir * float(config.get("speed", 3.8)) * 1.6
	if _state_time > 0.3 and randf() < 0.5:
		_skitter_pause_until = _time + 0.15
		_state_time = 0.0

func _hero_near(dist: float) -> bool:
	if hero_ref == null:
		return false
	return abs(hero_ref.global_position.x - global_position.x) <= dist and abs(hero_ref.global_position.y - global_position.y) <= 2.5

func _face_hero() -> void:
	if hero_ref == null:
		return
	var dir: float = signf(hero_ref.global_position.x - global_position.x)
	if dir != 0:
		_model_root.rotation.y = PI / 2 if dir > 0 else -PI / 2

func _hit_hero() -> void:
	if hero_ref == null or not hero_ref.has_method("take_damage"):
		return
	if _time < _attack_cooldown_until:
		return
	_attack_cooldown_until = _time + float(config.get("cooldown", 1.0))
	if hero_ref.has_method("is_guarding") and hero_ref.is_guarding():
		return  # guard blocks the troop hit entirely
	hero_ref.take_damage(int(config.get("damage", 10)), "troop")
