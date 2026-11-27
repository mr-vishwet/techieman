extends Node3D
## TechieMan M1 — the vertical slice. Game root + state machine.
## TITLE -> HERO_SELECT -> LEVEL (waves, checkpoint, stone gate) ->
## BOSS (intro -> fight -> KO) -> VICTORY / DEFEAT.
## Pure black-and-white ink-manga. 1280x720 landscape. Real 3D GLB models.
## Language is data-driven (CampaignData): DEFAULT_LANGUAGE = "kotlin";
## flip one word for Python. Self-test: run with --selftest (or ?selftest=1
## on web) — drives the real combat and prints M1SELFTEST lines.
## Photo mode: --photo=hero_select|level|troop|boss|boss_side|victory
## (local runs save PNGs to verification/frames/).

const HeroScript := preload("res://scripts/hero.gd")
const TroopScript := preload("res://scripts/troop.gd")
const BossScript := preload("res://scripts/boss.gd")
const LevelScript := preload("res://scripts/level.gd")
const UIScript := preload("res://scripts/ui.gd")

const FRAMES_DIR := "/home/hatch/workspace/techieman/technieman-game/verification/frames"

enum State { TITLE, SELECT, LEVEL, BOSS_INTRO, BOSS, VICTORY, DEFEAT, PAUSED }

var state: int = State.TITLE
var lang_key: String = CampaignData.DEFAULT_LANGUAGE
var lang: Dictionary = CampaignData.language(lang_key)

var _hero: Hero = null
var _boss: Boss = null
var _level: Level = null
var _ui: GameUI = null
var _camera: Camera3D = null
var _paused_state: int = State.TITLE
var _waves_done: Array[bool] = []
var _troops_alive: int = 0
var _checkpoint_reached: bool = false
var _gate_open: bool = false
var _combo: int = 0
var _combo_until: float = 0.0
var _deflects: int = 0
var _run_time: float = 0.0
var _time: float = 0.0
var _photo_mode: String = ""
var _photo_angle: String = "front"
var _photo_taken: bool = false
var _selftest: bool = false
var _debris: Array = []
# Game feel (game-feel): trauma-based shake + hit-stop. Shake = trauma^2,
# decayed in REAL time so it never freezes off-centre during hit-stop.
var _trauma: float = 0.0
var _shake_t: float = 0.0
var _hit_stop_id: int = 0

func _ready() -> void:
	randomize()
	_parse_params()
	_camera = $Camera3D
	_ui = GameUI.new()
	add_child(_ui)
	_ui.start_requested.connect(_on_start_requested)
	_ui.hero_confirmed.connect(_on_hero_confirmed)
	_ui.continue_requested.connect(_on_continue_requested)
	_ui.resume_requested.connect(_on_resume)
	_ui.restart_requested.connect(_on_restart)
	_ui.quit_to_title_requested.connect(_on_quit_to_title)
	_level = LevelScript.new()
	add_child(_level)
	_level.build(float(lang["level_length"]), float(lang["checkpoint_x"]), float(lang["gate_x"]))
	_level.visible = false
	_spawn_hero(Vector3(2, 0.1, 0))
	_hero.visible = false
	_hero.set_physics_process(false)
	_ui.show_title()
	# Continue is offered only when a checkpoint autosave exists.
	if SaveGame.has_save():
		var saved := SaveGame.load_checkpoint()
		var road := str(CampaignData.language(str(saved.get("language", CampaignData.DEFAULT_LANGUAGE))).get("road", ""))
		_ui.set_continue_available(true, road)
	if _selftest:
		_run_selftest()
	elif _photo_mode != "":
		_setup_photo_mode()

func _parse_params() -> void:
	# get_cmdline_args() does NOT include the args after "--" — those live
	# only in get_cmdline_user_args(). Reading only the first meant
	# --selftest / --photo= were silently ignored and the game sat at the
	# title screen forever. Read both.
	var args := OS.get_cmdline_args() + OS.get_cmdline_user_args()
	for a in args:
		if a == "--selftest":
			_selftest = true
		elif a.begins_with("--photo="):
			_photo_mode = a.trim_prefix("--photo=")
		elif a.begins_with("--angle="):
			_photo_angle = a.trim_prefix("--angle=")
	# Web: read the URL query string (?selftest=1, ?photo=boss, ?angle=side).
	# Engine.get_singleton avoids a hard JavaScriptBridge reference, which
	# does not exist on desktop builds.
	var bridge = Engine.get_singleton("JavaScriptBridge")
	if bridge != null:
		var q: String = str(bridge.eval("window.location.search", true))
		if "selftest" in q:
			_selftest = true
		for key in ["photo=", "angle="]:
			var i := q.find(key)
			if i >= 0:
				var rest := q.substr(i + key.length())
				var amp := rest.find("&")
				if amp >= 0:
					rest = rest.substr(0, amp)
				if key == "photo=":
					_photo_mode = rest
				else:
					_photo_angle = rest

func _spawn_hero(pos: Vector3) -> void:
	if _hero != null:
		_hero.queue_free()
	_hero = HeroScript.new()
	_hero.game_ref = self
	add_child(_hero)
	_hero.global_position = pos
	# Teleport + physics interpolation: without this reset the rendered
	# hero smears from the old position across the screen (physics-tuning).
	_hero.reset_physics_interpolation()
	_hero.hp_changed.connect(_on_hero_hp)
	_hero.died.connect(_on_hero_died)
	_hero.nova_cast.connect(_on_nova_cast)

# ---------------------------------------------------------------- state flow
func _on_start_requested() -> void:
	state = State.SELECT
	_ui.show_select()

func _on_hero_confirmed() -> void:
	_start_level()

## Checkpoint save / continue (save-systems). Capture is plain data, never
## objects; apply rebuilds the run from it (hero at the checkpoint, cleared
## waves stay cleared, the gate re-opens if it was open).
func _capture_checkpoint() -> Dictionary:
	return {
		"language": lang_key,
		"hero_hp": _hero.hp if _hero != null else CampaignData.HERO_HP,
		"checkpoint_reached": _checkpoint_reached,
		"waves_done": _waves_done,
		"deflects": _deflects,
		"run_time": _run_time,
	}

func _apply_checkpoint(data: Dictionary) -> void:
	_checkpoint_reached = bool(data.get("checkpoint_reached", false))
	var saved_waves: Array = data.get("waves_done", [])
	for i in range(mini(saved_waves.size(), _waves_done.size())):
		_waves_done[i] = bool(saved_waves[i])
	_deflects = int(data.get("deflects", 0))
	_run_time = float(data.get("run_time", 0.0))
	_hero.global_position = Vector3(float(lang["checkpoint_x"]), 0.1, 0)
	_hero.reset_physics_interpolation()
	_hero.hp = clampi(int(data.get("hero_hp", CampaignData.HERO_HP)), 1, _hero.max_hp)
	_hero.hp_changed.emit(_hero.hp)
	_level.set_checkpoint_reached(true)
	_check_gate_open()
	_snap_camera()

func _on_continue_requested() -> void:
	var data := SaveGame.load_checkpoint()
	if data.is_empty():
		_ui.show_title()
		return
	lang_key = str(data.get("language", CampaignData.DEFAULT_LANGUAGE))
	_start_level()
	_apply_checkpoint(data)
	_ui.toast("Continued from the checkpoint.")

func _start_level() -> void:
	lang = CampaignData.language(lang_key)
	_waves_done = []
	for w in lang["waves"]:
		_waves_done.append(false)
	_troops_alive = 0
	_checkpoint_reached = false
	_gate_open = false
	_combo = 0
	_deflects = 0
	_run_time = 0.0
	_level.visible = true
	_level.set_gate_open(false)
	_spawn_hero(Vector3(2, 0.1, 0))
	_hero.visible = true
	_hero.set_physics_process(true)
	_hero.reset_for_fight(true)
	_hero.in_boss_fight = false
	_hero.boss_ref = null
	state = State.LEVEL
	_ui.show_hud()
	_ui.hide_boss_bar()
	_ui.set_hero_hp(_hero.hp, _hero.max_hp)
	_ui.show_subtitle("Kotlin road — reach the stone gate. The LEAKs are rising.", 3.5)
	_snap_camera()

func _start_boss_intro() -> void:
	# Clear the level troops; move the hero into the arena.
	for t in get_tree().get_nodes_in_group("troops"):
		t.queue_free()
	_troops_alive = 0
	_hero.global_position = Vector3(50, 0.1, 0)
	_hero.reset_physics_interpolation()
	_hero.velocity = Vector3.ZERO
	_hero.in_boss_fight = true
	_spawn_boss()
	state = State.BOSS_INTRO
	_ui.set_boss_hp(_boss.hp, _boss.max_hp, str(lang["boss"]))
	_ui.show_subtitle("Something is standing where the code used to be...", 2.5)
	_boss.start_intro()
	_snap_camera()

func _spawn_boss() -> void:
	if _boss != null:
		_boss.queue_free()
	_boss = BossScript.new()
	_boss.game_ref = self
	# Setup BEFORE add_child: _ready() loads the boss model from lang, and
	# add_child runs _ready() immediately (godot-nodes-scenes Pattern 1).
	_boss.setup(lang, _hero, self)
	add_child(_boss)
	_boss.global_position = Vector3(56, 0.1, 0)
	_boss.hp_changed.connect(_on_boss_hp)
	_hero.boss_ref = _boss

func _on_boss_intro_done() -> void:
	state = State.BOSS
	_ui.show_subtitle("", 0.1)

func on_boss_defeated() -> void:
	# Public callback (no underscore): the boss calls game_ref
	# .on_boss_defeated() — the old _on_boss_defeated name never matched
	# the call, so has_method() was false and killing the boss silently
	# never showed VICTORY.
	state = State.VICTORY
	# The run is over — a finished run has no checkpoint to continue from.
	SaveGame.clear()
	_ui.set_continue_available(false, "")
	add_trauma(1.0)
	hit_stop(0.12, 0.05)
	_spawn_demolition(_boss.global_position)
	_ui.show_end(true, "%s\nDeflects: %d   •   Time: %s   •   M1 vertical slice complete." % [
		lang.get("victory_line", ""), _deflects, _fmt_time(_run_time)])
	if _photo_mode == "victory":
		_take_photo("victory")

func _on_hero_died() -> void:
	if state == State.BOSS or state == State.BOSS_INTRO:
		state = State.DEFEAT
		_ui.show_end(false, "NULLPOINTER stands over the ink.\nPress PLAY AGAIN to retry the boss fight.")
	elif state == State.LEVEL:
		# Respawn at the checkpoint (or the start) with full HP.
		_ui.toast("You fell. Back to the checkpoint.")
		var x := float(lang["checkpoint_x"]) if _checkpoint_reached else 2.0
		_spawn_hero(Vector3(x, 0.1, 0))
		_hero.visible = true
		_hero.set_physics_process(true)
		_hero.reset_for_fight(true)
		_hero.in_boss_fight = false
		_snap_camera()

func _on_restart() -> void:
	if _boss != null:
		_boss.queue_free()
		_boss = null
	_start_level()

func _on_resume() -> void:
	get_tree().paused = false
	_ui.show_pause(false)
	state = _paused_state

func _on_quit_to_title() -> void:
	get_tree().paused = false
	if _boss != null:
		_boss.queue_free()
		_boss = null
	for t in get_tree().get_nodes_in_group("troops"):
		t.queue_free()
	_level.visible = false
	_hero.visible = false
	_hero.set_physics_process(false)
	state = State.TITLE
	_ui.show_title()

# ---------------------------------------------------------------- combat hooks
func _on_hero_hp(hp: int) -> void:
	_ui.set_hero_hp(hp, _hero.max_hp)

func _on_boss_hp(hp: int, max_hp: int) -> void:
	_ui.set_boss_hp(hp, max_hp, str(lang["boss"]))

func _on_nova_cast() -> void:
	add_trauma(0.3)
	_spawn_nova_ring(_hero.global_position)
	_ui.toast("DEBUG NOVA — the troops freeze.")

func on_hero_damaged(amount: int, source: String) -> void:
	_combo = 0
	_ui.set_combo(0)
	add_trauma(0.4)

func on_boss_damaged(amount: int, source: String) -> void:
	_add_combo()
	if source == "deflect":
		_deflects += 1
		# Deflect is the signature moment: large-tier juice (game-feel).
		add_trauma(0.5)
		hit_stop(0.06, 0.05)
		_ui.flash(0.35)

func on_deflect() -> void:
	_add_combo()

func _add_combo() -> void:
	_combo += 1
	_combo_until = _time + 3.0
	_ui.set_combo(_combo)

func on_boss_threw(_line_text: String) -> void:
	pass

func freeze_troops(seconds: float) -> void:
	for t in get_tree().get_nodes_in_group("troops"):
		if t.has_method("freeze"):
			t.freeze(seconds)

func spawn_shockwave(pos: Vector3) -> void:
	# White expanding ring on the ground (slam shockwave).
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.4
	torus.outer_radius = 0.55
	ring.mesh = torus
	var m := StandardMaterial3D.new()
	m.albedo_color = Color.WHITE
	m.emission_enabled = true
	m.emission = Color.WHITE
	m.emission_energy_multiplier = 2.0
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = m
	ring.rotation.x = PI / 2
	ring.position = Vector3(pos.x, 0.1, 0)
	add_child(ring)
	_debris.append({"node": ring, "t": 0.0, "life": 0.6, "grow": true})

func _spawn_nova_ring(pos: Vector3) -> void:
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.9
	torus.outer_radius = 1.0
	ring.mesh = torus
	var m := StandardMaterial3D.new()
	m.albedo_color = Color.WHITE
	m.emission_enabled = true
	m.emission = Color.WHITE
	m.emission_energy_multiplier = 2.0
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = m
	ring.rotation.x = PI / 2
	ring.position = Vector3(pos.x, 0.15, 0)
	add_child(ring)
	_debris.append({"node": ring, "t": 0.0, "life": 0.8, "grow": true})

func _spawn_demolition(pos: Vector3) -> void:
	# Tumbling letter pieces + ink splash: small white/black boxes with
	# manual ballistic motion, freed after 2 s.
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for i in range(26):
		var piece := MeshInstance3D.new()
		var box := BoxMesh.new()
		var s := rng.randf_range(0.12, 0.3)
		box.size = Vector3(s, s, 0.06)
		piece.mesh = box
		var m := StandardMaterial3D.new()
		if i % 2 == 0:
			m.albedo_color = Color.WHITE
			m.emission_enabled = true
			m.emission = Color.WHITE
			m.emission_energy_multiplier = 0.8
		else:
			m.albedo_color = Color(0.02, 0.02, 0.02)
		piece.material_override = m
		piece.position = Vector3(pos.x + rng.randf_range(-0.6, 0.6), pos.y + rng.randf_range(1.0, 3.2), rng.randf_range(-0.5, 0.5))
		add_child(piece)
		_debris.append({"node": piece, "t": 0.0, "life": 2.0,
			"vel": Vector3(rng.randf_range(-2.5, 2.5), rng.randf_range(1.0, 4.0), rng.randf_range(-1.5, 1.5)),
			"spin": rng.randf_range(-4.0, 4.0)})

func show_subtitle(text: String, seconds: float) -> void:
	_ui.show_subtitle(text, seconds)

func clamp_hero_position(hero: Hero) -> void:
	var min_x := 0.5
	var max_x := float(lang["level_length"]) - 2.0
	if state == State.BOSS or state == State.BOSS_INTRO:
		min_x = 48.5
		max_x = 58.0
	elif state == State.LEVEL and not _gate_open and hero.global_position.x > float(lang["gate_x"]) - 0.5:
		max_x = float(lang["gate_x"]) - 0.5
	hero.global_position.x = clampf(hero.global_position.x, min_x, max_x)
	hero.global_position.z = clampf(hero.global_position.z, -3.2, 3.2)

# ---------------------------------------------------------------- waves
func _spawn_wave(i: int) -> void:
	var waves: Array = lang["waves"]
	if i >= waves.size():
		return
	_waves_done[i] = true
	var wave: Dictionary = waves[i]
	for entry in wave["spawn"]:
		var cfg := CampaignData.troop_config(lang, str(entry[0]))
		var troop := TroopScript.new()
		troop.setup(cfg, _hero, self)
		add_child(troop)
		troop.global_position = Vector3(float(entry[1]), 0.1, randf_range(-1.5, 1.5))
		troop.died.connect(_on_troop_died)
		_troops_alive += 1
	_ui.toast("LEAKs rising from the ink — %d in this wave." % _troops_alive)

func _on_troop_died(_troop: Troop) -> void:
	_troops_alive = maxi(0, _troops_alive - 1)
	add_trauma(0.2)
	_add_combo()
	_check_gate_open()

func _check_gate_open() -> void:
	# The gate opens only when every wave is cleared and no troop is left
	# alive. Factored out so the checkpoint-restore path reuses it.
	if _gate_open or _troops_alive != 0 or state != State.LEVEL:
		return
	var all_done := true
	for d in _waves_done:
		if not d:
			all_done = false
	if all_done:
		_gate_open = true
		_level.set_gate_open(true)
		_ui.toast("The gate is open. Walk through to face NULLPOINTER.")

func _process(delta: float) -> void:
	_time += delta
	if state == State.LEVEL or state == State.BOSS or state == State.BOSS_INTRO:
		_run_time += delta
	if _combo > 0 and _time > _combo_until:
		_combo = 0
		_ui.set_combo(0)
	_update_camera(delta)
	_update_level(delta)
	_update_deflect_cue()
	_update_debris(delta)
	if _photo_mode != "" and not _photo_taken and state != State.TITLE:
		_photo_taken = true
		# Let the scene settle one frame, then capture.
		await get_tree().process_frame
		await get_tree().process_frame
		_take_photo(_photo_mode)

func _camera_target() -> Array:
	var target_pos := Vector3.ZERO
	var target_look := Vector3.ZERO
	match state:
		State.TITLE, State.SELECT:
			target_pos = Vector3(2, 2.0, 7.5)
			target_look = Vector3(2, 1.2, 0)
		State.LEVEL:
			var hx := _hero.global_position.x if _hero != null else 2.0
			# Look-ahead (camera-systems): lead the run by ~1.5 m so the
			# player sees the next troop before it arrives.
			var lead := 1.5 * float(_hero.facing) if _hero != null else 0.0
			target_pos = Vector3(hx + 1.0 + lead, 2.6, 8.0)
			target_look = Vector3(hx + 1.0 + lead, 1.3, 0)
		State.BOSS_INTRO, State.BOSS:
			# 3/4 front view: both fighters visible, face to face. The
			# camera sits on the hero's side (-X +Z) so the boss's chest
			# letters (NULL / POINTER, facing -X at the hero) read at an
			# angle — a pure side-on (+Z) camera showed only the cloak's
			# edge and the boss read as a plain cone.
			target_pos = Vector3(46.0, 2.6, 7.5)
			target_look = Vector3(53.0, 1.8, 0)
			if _photo_angle == "side":
				# Opposite side (-Z), INSIDE the ruin row: the ruins stand
				# at z -7.5, so a camera at z -8.5 sits behind them and a
				# tower fills the frame. z -6.5 is in front of the row.
				target_pos = Vector3(53.0, 2.5, -6.5)
				target_look = Vector3(53.0, 1.8, 0)
		State.VICTORY, State.DEFEAT:
			target_pos = Vector3(46.0, 2.6, 7.5)
			target_look = Vector3(53.0, 1.8, 0)
	if _photo_angle == "side" and (state == State.LEVEL):
		var hx := _hero.global_position.x if _hero != null else 2.0
		target_pos = Vector3(hx + 1.0, 2.2, -8.0)
		target_look = Vector3(hx + 1.0, 1.3, 0)
	return [target_pos, target_look]

func _update_camera(delta: float) -> void:
	if _camera == null:
		return
	var t := _camera_target()
	var target_pos: Vector3 = t[0]
	var target_look: Vector3 = t[1]
	# Exponential smoothing (camera-systems): 1 - exp(-rate*dt) is the same
	# feel at any frame rate; a fixed lerp factor is not.
	var k := 1.0 - exp(-5.0 * delta)
	_camera.position = _camera.position.lerp(target_pos, k)
	# Trauma shake (game-feel): summed sines, decayed in real time, added
	# ON TOP of the smooth follow — never written into the follow target.
	if _trauma > 0.0:
		var real_dt := delta / maxf(Engine.time_scale, 0.0001)
		_trauma = maxf(_trauma - 1.2 * real_dt, 0.0)
		_shake_t += real_dt * 30.0
		var shake := _trauma * _trauma
		_camera.position += Vector3(0.35 * shake * sin(_shake_t * 1.7), 0.25 * shake * sin(_shake_t * 2.3), 0.0)
	_camera.look_at(target_look, Vector3.UP)

func _snap_camera() -> void:
	# Hard-cut the camera (camera-systems): after a teleport/respawn the
	# smoothed camera would whip across the level (slingshot).
	if _camera == null:
		return
	var t := _camera_target()
	_camera.position = t[0]
	_camera.look_at(t[1], Vector3.UP)

func add_trauma(amount: float) -> void:
	_trauma = clampf(_trauma + amount, 0.0, 1.0)

func hit_stop(duration: float = 0.08, slow: float = 0.05) -> void:
	# Hit-stop (game-feel Pattern 2): slow time, restore after a REAL-TIME
	# delay; only the newest call restores (overlapping hits).
	_hit_stop_id += 1
	var my_id := _hit_stop_id
	Engine.time_scale = slow
	await get_tree().create_timer(duration, true, false, true).timeout
	if my_id == _hit_stop_id:
		Engine.time_scale = 1.0

func _update_level(delta: float) -> void:
	if state != State.LEVEL or _hero == null:
		return
	var waves: Array = lang["waves"]
	for i in range(waves.size()):
		if not _waves_done[i] and _hero.global_position.x >= float(waves[i]["trigger_x"]):
			_spawn_wave(i)
	if not _checkpoint_reached and _hero.global_position.x >= float(lang["checkpoint_x"]):
		_checkpoint_reached = true
		_level.set_checkpoint_reached(true)
		_ui.toast("CHECKPOINT — progress saved.")
		# Autosave at the safe boundary (save-systems): the checkpoint.
		var err := SaveGame.save_checkpoint(_capture_checkpoint())
		if err != OK:
			_ui.toast("CHECKPOINT reached, but the autosave failed (%s)." % str(err))
	if _gate_open and _hero.global_position.x >= float(lang["gate_x"]) - 0.4:
		_start_boss_intro()

func _update_deflect_cue() -> void:
	var show := false
	if (state == State.BOSS or state == State.BOSS_INTRO) and _hero != null:
		# CodeLines are scene children; scan for a hostile line in the window.
		for child in get_children():
			if child is CodeLine and child.active and not child.friendly and not child.deflected_back:
				if child.global_position.distance_to(_hero.global_position + Vector3(0, 1.0, 0)) <= CampaignData.DEFLECT_WINDOW_M:
					show = true
					break
	_ui.set_deflect_cue(show)

func _update_debris(delta: float) -> void:
	for i in range(_debris.size() - 1, -1, -1):
		var d: Dictionary = _debris[i]
		d["t"] = float(d["t"]) + delta
		var node: Node3D = d["node"]
		if not is_instance_valid(node):
			_debris.remove_at(i)
			continue
		if float(d["t"]) >= float(d["life"]):
			node.queue_free()
			_debris.remove_at(i)
			continue
		if d.get("grow", false):
			var s := 1.0 + float(d["t"]) * 6.0
			node.scale = Vector3(s, s, 1.0)
		elif d.has("vel"):
			var vel: Vector3 = d["vel"]
			vel.y -= 9.0 * delta
			d["vel"] = vel
			node.position += vel * delta
			node.rotation.z += float(d["spin"]) * delta

func _fmt_time(t: float) -> String:
	var m := int(t) / 60
	var s := int(t) % 60
	return "%d:%02d" % [m, s]

# ---------------------------------------------------------------- input
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if state == State.LEVEL or state == State.BOSS:
			_paused_state = state
			state = State.PAUSED
			get_tree().paused = true
			_ui.show_pause(true)
		elif state == State.PAUSED:
			_on_resume()
	if event.is_action_pressed("confirm"):
		if state == State.TITLE:
			_on_start_requested()
		elif state == State.SELECT:
			_on_hero_confirmed()
		elif state == State.VICTORY or state == State.DEFEAT:
			_on_restart()

# ---------------------------------------------------------------- photo mode
func _setup_photo_mode() -> void:
	match _photo_mode:
		"hero_select":
			state = State.SELECT
			_ui.show_select()
		"level":
			_start_level()
			_hero.global_position = Vector3(12, 0.1, 0)
			_spawn_wave(0)
		"troop":
			_start_level()
			_hero.global_position = Vector3(36, 0.1, 0)
			_spawn_wave(2)
			_hero.set_physics_process(false)
		"boss", "boss_side":
			_start_level()
			_start_boss_intro()
			_boss.test_mode = true
			_boss.start_fight()
			_boss.throw_code_line()
			if _photo_mode == "boss_side":
				_photo_angle = "side"
		"victory":
			_start_level()
			_start_boss_intro()
			_boss.test_mode = true
			_boss.start_fight()
			_boss.take_damage(560, "photo")

func _take_photo(name: String) -> void:
	if OS.has_feature("web"):
		return  # web frames come from headless Chromium, not from in-game saves
	DirAccess.make_dir_recursive_absolute(FRAMES_DIR)
	# Let the action develop (a thrown line in flight, a death fall) before
	# capturing, so the frame shows the moment, not the setup.
	await get_tree().create_timer(1.2).timeout
	var img := get_viewport().get_texture().get_image()
	var path := "%s/%s.png" % [FRAMES_DIR, name]
	img.save_png(path)
	print("M1PHOTO saved ", path)
	get_tree().quit()

# ---------------------------------------------------------------- self-test
func _run_selftest() -> void:
	# Runs the real combat flow headlessly and prints M1SELFTEST lines.
	# Sequence: boss fight -> deflect (560->530) -> guard block -> dodge ->
	# bullet (-10) -> nova (-25) -> 19 deflects from 560 -> KO / VICTORY.
	_start_level()
	_start_boss_intro()
	_boss.test_mode = true
	_boss.start_fight()
	_hero.in_boss_fight = true
	_hero.boss_ref = _boss
	var results := {}
	await get_tree().create_timer(0.5).timeout
	# 1) Deflect: throw a line, slash when it is in the window. The deflect
	# lands mid-flight; the damage lands ~0.3 s later when the line reaches
	# the boss, so wait for the HP before checking it.
	_boss.throw_code_line()
	var ok_deflect := await _selftest_wait_deflect()
	var hp_ok := await _selftest_wait_hp(530, 3.0)
	results["deflect_560_to_530"] = ok_deflect and hp_ok and _boss.hp == 530
	# 2) Guard: hold guard, let a line hit the hero.
	_boss.throw_code_line()
	var hp_before := _hero.hp
	var guard_ok := await _selftest_wait_line_resolved(true)
	results["guard_blocks_hp_unchanged"] = guard_ok and _hero.hp == hp_before
	# 3) Dodge: boss charges while the hero dodge-dashes. Drive the dodge
	# off the boss's PHYSICS state, not a wall-clock wait — the telegraph
	# is physics time and drifts against a process-time wait under load.
	# Dodge INTO the boss as he closes: the dash shortens the gap, so he
	# reaches the 1.4 m hit band while the 0.30 s i-frames are still up.
	_boss._set_state("telegraph_charge")
	var waited := 0.0
	while _boss._state != "charge" and waited < 5.0:
		await get_tree().physics_frame
		waited += 1.0 / 60.0
	while absf(_boss.global_position.x - _hero.global_position.x) > 2.5 and waited < 8.0:
		await get_tree().physics_frame
		waited += 1.0 / 60.0
	_hero.try_dodge(1)
	hp_before = _hero.hp
	var dodge_ok := await _selftest_wait_seconds(1.4)
	results["dodge_avoids_charge"] = dodge_ok and _hero.hp == hp_before
	# 4) Bullet: 'if' bullet hits the boss for 10.
	_hero.facing = 1
	var bullet_fired := _hero.try_bullet()
	print("M1SELFTEST bullet: fired=%s hero_x=%.2f boss_x=%.2f facing=%d hp=%d" % [
		str(bullet_fired), _hero.global_position.x, _boss.global_position.x, _hero.facing, _boss.hp])
	var bullet_ok := await _selftest_wait_hp(_boss.hp - 10, 3.0)
	results["bullet_minus_10"] = bullet_ok
	# 5) Nova: 25 damage to the boss.
	var hp_before_nova := _boss.hp
	_hero.try_nova()
	var nova_ok := await _selftest_wait_hp(hp_before_nova - 25, 3.0)
	results["nova_minus_25"] = nova_ok
	# 6) KO: reset to 560, then exactly 19 deflects. Move the hero to the
	# arena's left edge first: the slash also deals 10 melee damage when
	# the boss is within SLASH_RANGE + 0.6 (2.8 m), and after the dodge the
	# hero stands 1.2 m from the boss — every KO slash would add +10 and
	# break the exact -30-per-deflect accounting.
	_hero.global_position = Vector3(48.0, 0, 0)
	_hero.reset_physics_interpolation()
	await get_tree().process_frame
	_boss.set_hp(560)
	_deflects = 0
	var ko_ok := true
	for i in range(19):
		_boss.throw_code_line()
		if not await _selftest_wait_deflect():
			ko_ok = false
			break
		# The deflect lands mid-flight; the damage lands ~0.3 s later.
		if not await _selftest_wait_hp(maxi(0, 560 - (i + 1) * 30), 3.0):
			ko_ok = false
			break
		if _boss.hp != 560 - (i + 1) * 30 and _boss.hp != 0:
			ko_ok = false
			break
		if _boss.hp == 0:
			break
	ko_ok = ko_ok and _boss.hp == 0 and state == State.VICTORY
	results["ko_after_19_deflects"] = ko_ok
	results["deflects_counted"] = _deflects
	var all_pass := true
	for k in results:
		if results[k] is bool and not results[k]:
			all_pass = false
	print("M1SELFTEST deflect_560_to_530=", results["deflect_560_to_530"],
		" guard=", results["guard_blocks_hp_unchanged"],
		" dodge=", results["dodge_avoids_charge"],
		" bullet=", results["bullet_minus_10"],
		" nova=", results["nova_minus_25"],
		" ko19=", results["ko_after_19_deflects"],
		" deflects=", results["deflects_counted"],
		" RESULT=", "PASS" if all_pass else "FAIL")
	if OS.has_feature("web"):
		var bridge = Engine.get_singleton("JavaScriptBridge")
		if bridge != null:
			bridge.eval("document.title = 'M1SELFTEST " + ("PASS" if all_pass else "FAIL") + "';", true)
	get_tree().quit()

func _selftest_wait_deflect() -> bool:
	# Wait for a live hostile line to enter the deflect window, then slash.
	# Success is "a deflect LANDED" (the deflects counter increased): a
	# slash's 350 ms buffer can still be active when the next line arrives,
	# so a line can deflect without this function ever slashing at it.
	var d0: int = _deflects
	var waited := 0.0
	while waited < 6.0:
		await get_tree().process_frame
		waited += get_process_delta_time()
		if _deflects > d0:
			return true
		for child in get_children():
			if child is CodeLine and child.active and not child.friendly and not child.deflected_back:
				if child.global_position.distance_to(_hero.global_position + Vector3(0, 1.0, 0)) <= 2.0:
					_hero._slash_cooldown_until = 0.0
					_hero.try_slash()
	return false

func _selftest_wait_line_resolved(guard: bool) -> bool:
	# Hold guard (via simulated input state) until the line is gone.
	# Only stop once a line was seen AND has resolved — stopping on an
	# empty frame before the throw would pass the guard check vacuously.
	var waited := 0.0
	var saw_line := false
	if guard:
		# Drive the guard through the hero's own input path: emulate by
		# forcing the action state with Input.action_press.
		Input.action_press("guard")
	while waited < 6.0:
		await get_tree().process_frame
		waited += get_process_delta_time()
		var any_line := false
		for child in get_children():
			if child is CodeLine and child.active and not child.friendly:
				any_line = true
				saw_line = true
		if saw_line and not any_line:
			break
	if guard:
		Input.action_release("guard")
	return saw_line and waited < 6.0

func _selftest_wait_seconds(s: float) -> bool:
	await get_tree().create_timer(s).timeout
	return true

func _selftest_wait_hp(target: int, timeout_s: float) -> bool:
	var waited := 0.0
	while waited < timeout_s:
		await get_tree().process_frame
		waited += get_process_delta_time()
		if _boss.hp <= target:
			return true
	return false
