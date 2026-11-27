class_name Boss
extends CharacterBody3D
## NULLPOINTER — the code-throwing end boss (Kotlin road).
## Real 3D GLB model (letter-built body: NULL across the chest, POINTER down
## the cloak, horned hood, clawed hands, white eye-slits, the Hollow Orb).
## HP is a NUMBER (560) plus a bar. Three reliable attacks, all telegraphed:
## ink slam (shockwave), letter projectile (real Kotlin code lines), charge.
## Phase transition at 280 HP: roar + subtitle line, faster throws.
## Deflect a thrown line back for 30 damage; 19 deflects x 30 = 570 >= 560 -> KO.

signal hp_changed(hp: int, max_hp: int)
signal defeated
signal phase_reached

const CodeLineScript := preload("res://scripts/code_line.gd")

var hp: int = 560
var max_hp: int = 560
var lang: Dictionary = {}
var hero_ref: Node3D = null
var game_ref: Node = null
var test_mode: bool = false  # self-test: no autonomous attacks

var _state: String = "intro"
var _time: float = 0.0
var _state_time: float = 0.0
var _attack_timer: float = 0.0
var _line_index: int = 0
var _phase2: bool = false
var _attack_index: int = 0
var _model: Node3D = null
var _anim: AnimationPlayer = null
var _model_root: Node3D = null
var _orb: Node3D = null
var _telegraph: MeshInstance3D = null
var _dead: bool = false

func setup(p_lang: Dictionary, hero: Node3D, game: Node) -> void:
	lang = p_lang
	hero_ref = hero
	game_ref = game
	max_hp = int(lang.get("boss_hp", 560))
	hp = max_hp

func is_dead() -> bool:
	return _dead

func _ready() -> void:
	add_to_group("boss")
	# Layer matrix: enemy is ON layer 3 (value 4), scans world + player.
	collision_layer = 4
	collision_mask = 3
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7
	cap.height = 3.6
	col.shape = cap
	col.position = Vector3(0, 1.8, 0)
	add_child(col)
	_model_root = Node3D.new()
	_model_root.name = "ModelRoot"
	add_child(_model_root)
	_model = load(str(lang.get("boss_model", "res://models/nullpointer.glb"))).instantiate()
	_model_root.add_child(_model)
	_anim = _model.find_child("AnimationPlayer", true, false)
	# glTF import does not guarantee loop flags: force idle/walk to loop
	# (godot-animation) so the boss never freezes mid-pose.
	if _anim != null:
		for loop_name in ["idle", "walk"]:
			if _anim.has_animation(loop_name):
				_anim.get_animation(loop_name).loop_mode = Animation.LOOP_LINEAR
	_orb = _model.find_child("hollow_orb", true, false)
	# Boss faces -X (toward the hero, who stands to his left).
	_model_root.rotation.y = -PI / 2
	_play_anim("idle")
	# WHITE telegraph ring on the ground (slam / charge warning).
	_telegraph = MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 1.1
	torus.outer_radius = 1.3
	_telegraph.mesh = torus
	var m := StandardMaterial3D.new()
	m.albedo_color = Color.WHITE
	m.emission_enabled = true
	m.emission = Color.WHITE
	m.emission_energy_multiplier = 2.0
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_telegraph.material_override = m
	_telegraph.rotation.x = PI / 2
	_telegraph.position = Vector3(0, 0.08, 0)
	_telegraph.visible = false
	add_child(_telegraph)

func start_intro() -> void:
	_set_state("intro")
	_play_anim("roar")
	if game_ref != null and game_ref.has_method("show_subtitle"):
		game_ref.show_subtitle(str(lang.get("boss_taunt", "")), 3.0)

func start_fight() -> void:
	_set_state("idle")
	_attack_timer = 1.2
	_play_anim("idle")

func set_hp(value: int) -> void:
	hp = value
	hp_changed.emit(hp, max_hp)

func take_damage(amount: int, source: String = "") -> void:
	if _dead or _state == "intro":
		return
	hp = maxi(0, hp - amount)
	hp_changed.emit(hp, max_hp)
	if game_ref != null and game_ref.has_method("on_boss_damaged"):
		game_ref.on_boss_damaged(amount, source)
	if hp <= 0:
		_die()
		return
	_play_anim("hit")
	if not _phase2 and hp <= int(lang.get("phase_hp", 280)):
		_phase2 = true
		_enter_phase2()

func _enter_phase2() -> void:
	_set_state("phase")
	_play_anim("roar")
	phase_reached.emit()
	if game_ref != null and game_ref.has_method("show_subtitle"):
		game_ref.show_subtitle(str(lang.get("phase_line", "")), 4.0)

func _die() -> void:
	_dead = true
	_set_state("dead")
	_play_anim("death")
	_telegraph.visible = false
	if game_ref != null and game_ref.has_method("on_boss_defeated"):
		game_ref.on_boss_defeated()

func _play_anim(name: String) -> void:
	if _anim == null or not _anim.has_animation(name):
		return
	if _anim.current_animation == name and _anim.is_playing():
		return
	_anim.play(name)

func _set_state(s: String) -> void:
	_state = s
	_state_time = 0.0

func throw_code_line() -> void:
	# The boss HOLDS the line before throwing: the next line is shown above
	# his hand for the telegraph beat, then it flies.
	var lines: Array = lang.get("code_lines", [])
	if lines.is_empty():
		return
	var line_text: String = lines[_line_index % lines.size()]
	_line_index += 1
	var line: CodeLine = CodeLineScript.new()
	# Spawn at the hero's chest height (y 1.3, chest is y 1.0): the line must
	# be able to REACH the hero — at the old y 2.4 it flew 1.4 m over the
	# chest, so the d <= 0.9 hit check never fired, guard could never block
	# it, and the hero could never take line damage. The deflect window
	# (3 m + 350 ms) is unchanged; the line still reads as thrown at him.
	var start: Vector3 = global_position + Vector3(-1.0, 1.3, 0)
	line.setup(line_text, 5.0, Vector3(-1, 0, 0), false, 20, hero_ref, self)
	line.position = start
	line.hit_hero.connect(_on_line_hit_hero)
	line.hit_boss.connect(_on_line_hit_boss)
	line.deflected.connect(_on_line_deflected)
	get_tree().current_scene.add_child(line)
	if game_ref != null and game_ref.has_method("on_boss_threw"):
		game_ref.on_boss_threw(line_text)

func _on_line_hit_hero(amount: int) -> void:
	if hero_ref != null and hero_ref.has_method("take_damage"):
		hero_ref.take_damage(amount, "code_line")

func _on_line_hit_boss(amount: int) -> void:
	take_damage(amount, "deflect")

func _on_line_deflected() -> void:
	if game_ref != null and game_ref.has_method("on_deflect"):
		game_ref.on_deflect()

func _physics_process(delta: float) -> void:
	_time += delta
	_state_time += delta
	if _dead:
		return
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0.0
	match _state:
		"intro":
			velocity.x = 0.0
			_play_anim("roar")
			if _state_time > 2.5 and not test_mode:
				# Intro cinematic: 2.5 s roar + taunt, then the fight starts.
				start_fight()
				if game_ref != null and game_ref.has_method("_on_boss_intro_done"):
					game_ref._on_boss_intro_done()
		"phase":
			velocity.x = 0.0
			if _state_time > 2.0:
				start_fight()
		"idle":
			velocity.x = 0.0
			_play_anim("idle")
			# Keep a fighting distance of ~4 m from the hero.
			if hero_ref != null:
				var dx: float = hero_ref.global_position.x - global_position.x
				if abs(dx) > 5.5:
					_set_state("walk")
			if not test_mode:
				_attack_timer -= delta
				if _attack_timer <= 0.0:
					_pick_attack()
		"walk":
			_play_anim("walk")
			if hero_ref != null:
				var dir: float = signf(hero_ref.global_position.x - global_position.x)
				velocity.x = dir * 3.4
				if abs(hero_ref.global_position.x - global_position.x) <= 4.5:
					_set_state("idle")
		"telegraph_throw":
			velocity.x = 0.0
			_play_anim("attack_throw")
			# Orb flares white during the 420 ms wind-up.
			if _orb != null:
				var s := 1.0 + 0.6 * sin(_state_time * 20.0)
				_orb.scale = Vector3(s, s, s)
			if _state_time >= 0.42:
				if _orb != null:
					_orb.scale = Vector3.ONE
				throw_code_line()
				_set_state("recover")
		"telegraph_slam":
			velocity.x = 0.0
			_play_anim("attack_slam")
			_telegraph.visible = true
			_telegraph.scale = Vector3(1.0 + _state_time, 1.0 + _state_time, 1.0)
			if _state_time >= 0.5:
				_telegraph.visible = false
				_do_slam()
				_set_state("recover")
		"telegraph_charge":
			velocity.x = 0.0
			_play_anim("attack_charge")
			_telegraph.visible = true
			if _state_time >= 0.5:
				_telegraph.visible = false
				_set_state("charge")
		"charge":
			_play_anim("walk")
			velocity.x = -6.2  # charges toward the hero (-X)
			if hero_ref != null and abs(hero_ref.global_position.x - global_position.x) <= 1.4:
				if not (hero_ref.has_method("is_guarding") and hero_ref.is_guarding()) \
						and not (hero_ref.has_method("is_dodging") and hero_ref.is_dodging()):
					hero_ref.take_damage(20, "charge")
				_set_state("recover")
			if _state_time > 1.2:
				_set_state("recover")
		"recover":
			velocity.x = 0.0
			_play_anim("idle")
			if _state_time > 0.7:
				_set_state("idle")
				_attack_timer = _throw_interval()
	move_and_slide()
	# Boss always faces the hero.
	if hero_ref != null:
		var dir: float = signf(hero_ref.global_position.x - global_position.x)
		if dir != 0:
			_model_root.rotation.y = -PI / 2 if dir < 0 else PI / 2

func _throw_interval() -> float:
	return 1.6 if _phase2 else 2.2

func _pick_attack() -> void:
	# Cycle: throw, throw, slam, charge — throws dominate so deflects stay
	# the main path to the KO.
	var pick := _attack_index % 4
	_attack_index += 1
	if pick <= 1:
		_set_state("telegraph_throw")
	elif pick == 2:
		_set_state("telegraph_slam")
	else:
		_set_state("telegraph_charge")

func _do_slam() -> void:
	# Ink slam: shockwave — the hero must be jumping or guarding.
	if hero_ref == null:
		return
	var dx: float = absf(hero_ref.global_position.x - global_position.x)
	if dx <= 3.5:
		if hero_ref.has_method("is_guarding") and hero_ref.is_guarding():
			return
		if not hero_ref.is_on_floor():
			return  # jumped over the shockwave
		hero_ref.take_damage(25, "slam")
	if game_ref != null and game_ref.has_method("spawn_shockwave"):
		game_ref.spawn_shockwave(global_position)
