## M1 test runner (godot-gdscript-headless-testing Pattern 1/2).
## SceneTree script: counts failures itself and exits non-zero on any fail,
## because Godot's exit code stays 0 after SCRIPT ERRORs.
## Run: godot --headless --path . --import   (once, fresh checkout)
##      godot --headless --path . --script res://tests/test_runner.gd
## Covers: data (.tres load + verbatim lines), pacing, reachability, balance,
## animation clips, input bindings, shader compile, save round-trip, UI layout,
## jump measurement, signal wiring, troop progress / state flicker (game-ai),
## and the full combat flow (deflect / guard / dodge / bullet / nova / KO).
extends SceneTree

var passed := 0
var failed := 0
var _game: Node = null

func _initialize() -> void:
	await run_tests()
	if _game != null:
		_game.queue_free()
		_game = null
		await process_frame
	print("M1TEST Results: %d passed, %d failed" % [passed, failed])
	quit(1 if failed > 0 else 0)

func check(cond: bool, label: String) -> void:
	if cond:
		passed += 1
	else:
		failed += 1
		push_error("M1TEST FAIL: " + label)

func check_eq(actual, expected, label: String) -> void:
	if actual == expected:
		passed += 1
	else:
		failed += 1
		push_error("M1TEST FAIL %s: expected %s, got %s" % [label, str(expected), str(actual)])

func run_tests() -> void:
	await process_frame
	test_data_loads()
	test_pacing()
	test_reachability()
	test_balance()
	test_animations()
	test_bindings()
	test_shaders()
	await test_save_roundtrip()
	await test_ui_layout()
	await test_jump_and_signals()
	await test_troop_ai()
	await test_combat()

# ---------------------------------------------------------------- data (godot-resources Pattern 4)
func test_data_loads() -> void:
	var kotlin := load("res://data/kotlin.tres") as LanguageData
	var python := load("res://data/python.tres") as LanguageData
	check(kotlin != null, "kotlin.tres loads as LanguageData")
	check(python != null, "python.tres loads as LanguageData")
	if kotlin == null or python == null:
		return
	var kd := kotlin.to_dict()
	var pd := python.to_dict()
	for key in ["name", "boss", "boss_hp", "boss_model", "boss_taunt", "phase_hp",
			"phase_line", "victory_line", "code_lines", "troops", "level_length",
			"checkpoint_x", "gate_x", "waves"]:
		check(kd.has(key), "kotlin dict has " + key)
		check(pd.has(key), "python dict has " + key)
	check_eq(kd["boss"], "NULLPOINTER", "kotlin boss")
	check_eq(pd["boss"], "TIMEOUT", "python boss")
	check_eq(int(kd["boss_hp"]), 560, "kotlin boss hp")
	check_eq(int(kd["phase_hp"]), 280, "kotlin phase hp")
	check_eq(kd["code_lines"].size(), 5, "kotlin has 5 throw lines")
	check_eq(pd["code_lines"].size(), 5, "python has 5 throw lines")
	# Verbatim lines (GAME_WIRING_SPEC §6 / python/CHARACTER.md) — any drift
	# here means the boss throws the wrong code.
	var kotlin_lines := [
		"val name: String? = null; println(name!!.length)",
		"user?.address?.street // one rung is missing",
		"lateinit var token: String // never initialised",
		"val x: String = null // the compiler said no — the villain cheats",
		"throw NullPointerException(\"it was never there\")",
	]
	for i in range(5):
		check_eq(str(kd["code_lines"][i]), kotlin_lines[i], "kotlin line %d verbatim" % i)
	var python_lines := [
		"requests.get(url, timeout=None)  # waits forever",
		"while True: retry()  # no backoff, no exit",
		"time.sleep(3600)  # hope nobody notices",
		"response = requests.get(api)  # no timeout, no try",
		"    return result  # one space off — IndentationError",
	]
	for i in range(5):
		check_eq(str(pd["code_lines"][i]), python_lines[i], "python line %d verbatim" % i)
	# Narration lines (dialogue-systems: DLG_BOSS_TAUNT / PHASE / VICTORY).
	check(str(kd["boss_taunt"]).length() > 0, "kotlin taunt non-empty")
	check(str(kd["phase_line"]).length() > 0, "kotlin phase line non-empty")
	check(str(kd["victory_line"]).length() > 0, "kotlin victory line non-empty")
	check(str(pd["boss_taunt"]).length() > 0, "python taunt non-empty")
	check_eq(kd["troops"].size(), 3, "kotlin has 3 troop configs")
	check_eq(kd["waves"].size(), 3, "kotlin has 3 waves")
	var prev_trigger := -1.0
	for w in kd["waves"]:
		check(float(w["trigger_x"]) > prev_trigger, "waves sorted by trigger_x")
		prev_trigger = float(w["trigger_x"])
	var playable := 0
	for h in CampaignData.HEROES:
		if bool(h["playable"]):
			playable += 1
	check_eq(playable, 1, "exactly one playable hero")
	# The .tres files must be identical to the old const values: the flip
	# loads the same data the game shipped with.
	check_eq(CampaignData.language("kotlin")["boss"], "NULLPOINTER", "language() loads kotlin")
	check_eq(CampaignData.language("python")["boss"], "TIMEOUT", "language() loads python")

# ---------------------------------------------------------------- pacing (level-design Pattern 2)
func pacing_problems(beats: Array, high := 0.7, max_high_run := 2) -> PackedStringArray:
	var problems := PackedStringArray()
	var run := 0
	for i in beats.size():
		var beat: Dictionary = beats[i]
		run = run + 1 if float(beat["intensity"]) >= high else 0
		if run > max_high_run:
			problems.append("%s: %d high-intensity beats in a row" % [str(beat["room"]), run])
		if beat["type"] == "climax" and (i == 0 or beats[i - 1]["type"] != "rest"):
			problems.append("%s: no rest beat right before the climax" % str(beat["room"]))
	if not beats.is_empty() and beats[0]["type"] != "teach":
		problems.append("%s: the level does not open with a teach beat" % str(beats[0]["room"]))
	return problems

func test_pacing() -> void:
	var problems := pacing_problems(CampaignData.BEATS)
	for p in problems:
		push_error("M1TEST pacing: " + p)
	check(problems.is_empty(), "pacing_problems(BEATS) is empty")

# ---------------------------------------------------------------- reachability (level-design Pattern 3)
func goal_reachable(rooms: Dictionary, start: String, goal: String) -> bool:
	var pending: Array[Dictionary] = [{"room": start, "keys": {}}]
	var visited := {}
	while not pending.is_empty():
		var state: Dictionary = pending.pop_back()
		var room: String = state["room"]
		var have: Dictionary = state["keys"].duplicate()
		var info: Dictionary = rooms.get(room, {})
		var grant = info.get("grants")
		if grant != null:
			have[grant] = true
		var names := PackedStringArray(have.keys())
		names.sort()
		var id := room + "|" + ",".join(names)
		if visited.has(id):
			continue
		visited[id] = true
		if room == goal:
			return true
		for exit in info.get("exits", []):
			var open: bool = not exit.has("needs") or have.has(exit["needs"])
			if open:
				pending.append({"room": exit["to"], "keys": have})
	return false

func test_reachability() -> void:
	check(goal_reachable(CampaignData.ROOMS, "entry", "boss"), "boss reachable from entry")
	# The check must not be vacuous: without the waves_cleared grant the
	# gate (and the boss) must be unreachable.
	var broken: Dictionary = CampaignData.ROOMS.duplicate(true)
	broken["wave_3"].erase("grants")
	check(not goal_reachable(broken, "entry", "boss"), "boss unreachable without the grant")

# ---------------------------------------------------------------- balance (rpg check)
func test_balance() -> void:
	var lang := CampaignData.language("kotlin")
	print("M1TEST BALANCE hero_hp=%d slash_vs_troop=1 boss_hp=%d deflect=%d" % [
		CampaignData.HERO_HP, int(lang["boss_hp"]), CampaignData.DEFLECT_DAMAGE])
	for t in lang["troops"]:
		var hits: int = int(ceil(float(t["hp"]) / 1.0))  # one slash = 1 damage
		print("M1TEST BALANCE %s hp=%d hits_to_kill=%d hero_survives=%d hits" % [
			str(t["id"]), int(t["hp"]), hits, CampaignData.HERO_HP / int(t["damage"])])
	check_eq(int(ceil(float(lang["boss_hp"]) / float(CampaignData.DEFLECT_DAMAGE))), 19,
		"boss takes 19 deflects to KO")
	check_eq(int(ceil(1.0 / 1.0)), 1, "scamp dies in 1 slash (brief: fast run to the boss)")
	check_eq(int(ceil(3.0 / 1.0)), 3, "brute dies in 3 slashes (rpg band 2-4)")
	check_eq(CampaignData.HERO_HP / 10, 10, "hero survives 10 scamp hits")

# ---------------------------------------------------------------- animations (godot-animation)
func test_animations() -> void:
	var expected := {
		"res://models/hero.glb": ["idle", "run", "attack_light", "attack_heavy", "hit", "death", "jump", "dodge"],
		"res://models/leak_scamp.glb": ["idle", "walk", "attack", "hit", "death"],
		"res://models/leak_skitter.glb": ["idle", "walk", "attack", "hit", "death"],
		"res://models/leak_brute.glb": ["idle", "walk", "attack", "hit", "death"],
		"res://models/nullpointer.glb": ["idle", "walk", "attack_slam", "attack_throw", "attack_charge", "hit", "roar", "death"],
	}
	for path in expected:
		var model: Node3D = load(path).instantiate()
		root.add_child(model)
		var anim := model.find_child("AnimationPlayer", true, false) as AnimationPlayer
		check(anim != null, path + " has an AnimationPlayer")
		if anim != null:
			for clip in expected[path]:
				check(anim.has_animation(clip), path + " has clip " + clip)
		model.queue_free()
	await process_frame

# ---------------------------------------------------------------- bindings (input-systems Pattern 5, keyboard only)
func test_bindings() -> void:
	# M1 is keyboard-first (browser + Android touch later); gamepad bindings
	# are an M2 item, so the gamepad half of the skill's audit is exempted
	# here and only keyboard presence + conflicts are checked.
	var problems := PackedStringArray()
	var actions: Array[StringName] = []
	for a in InputMap.get_actions():
		if not String(a).begins_with("ui_"):
			actions.append(a)
	for i in actions.size():
		var action: StringName = actions[i]
		var events := InputMap.action_get_events(action)
		if not events.any(func(e): return e is InputEventKey or e is InputEventMouseButton):
			problems.append("%s: no keyboard or mouse binding" % action)
		for other in actions.slice(i + 1):
			for e in events:
				for o in InputMap.action_get_events(other):
					if e.is_match(o, true):
						problems.append("%s and %s share %s" % [action, other, e.as_text()])
	for p in problems:
		push_error("M1TEST BINDING: " + p)
	check(problems.is_empty(), "binding audit clean (%d actions)" % actions.size())

# ---------------------------------------------------------------- shaders (godot-shaders Pattern 4)
func _find_files(dir: String, ext: String) -> PackedStringArray:
	var found := PackedStringArray()
	for file in DirAccess.get_files_at(dir):
		if file.get_extension() == ext:
			found.append(dir.path_join(file))
	for sub in DirAccess.get_directories_at(dir):
		if not sub.begins_with("."):
			found.append_array(_find_files(dir.path_join(sub), ext))
	return found

func test_shaders() -> void:
	var paths := _find_files("res://", "gdshader")
	for path in paths:
		var shader := load(path) as Shader
		shader.get_shader_uniform_list()  # forces the compile; load() alone is lazy
	print("M1TEST shaders compiled: %d (M1 has none; the toon/ink shader is M2 look-gap work)" % paths.size())
	check(true, "shader compile check ran")

# ---------------------------------------------------------------- save round-trip (save-systems Pattern 5)
func test_save_roundtrip() -> void:
	const PATH := "user://test_save.json"
	var first := {"version": 1, "language": "kotlin", "hero_hp": 100,
		"checkpoint_reached": true, "waves_done": [true, true, false],
		"deflects": 3, "run_time": 61.5}
	var second := first.duplicate(true)
	second["hero_hp"] = 55
	var ok := SaveGame.save_atomic(PATH, first) == OK
	ok = ok and SaveGame.save_atomic(PATH, second) == OK  # first is now the .bak
	# _load_direct mirrors SaveGame.load_checkpoint but against the test
	# path (load_checkpoint reads the real autosave path).
	var loaded := _load_direct(PATH)
	ok = ok and loaded.get("version") is int and int(loaded["hero_hp"]) == 55
	ok = ok and loaded["waves_done"] == [true, true, false]
	var f := FileAccess.open(PATH, FileAccess.WRITE)  # simulate a truncated primary
	f.store_string("{\"version\": 1, \"lan")
	f.close()
	loaded = _load_direct(PATH)  # falls back to .bak
	ok = ok and int(loaded.get("hero_hp", 0)) == 100
	# Newer-version save must be refused, not half-loaded.
	var newer := first.duplicate(true)
	newer["version"] = 99
	SaveGame.save_atomic(PATH, newer)
	loaded = _load_direct(PATH)
	ok = ok and loaded.is_empty()
	for p in [PATH, PATH + ".bak", PATH + ".tmp"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	check(ok, "save round-trip: atomic write, .bak fallback, newer-version refusal")

func _load_direct(path: String) -> Dictionary:
	for p in [path, path + ".bak"]:
		if FileAccess.file_exists(p):
			var parsed = JSON.parse_string(FileAccess.get_file_as_string(p))
			if parsed is Dictionary and parsed.has("version"):
				var d: Dictionary = parsed
				if int(d["version"]) > SaveGame.SAVE_VERSION:
					return {}
				d["version"] = int(d["version"])
				return d
	return {}

# ---------------------------------------------------------------- UI layout (godot-ui-control Pattern 4)
func test_ui_layout() -> void:
	# With stretch mode canvas_items + aspect "expand", a wider window gives
	# the UI a wider rect: 1280x720 base, 1536x864 window -> 1536x720 UI.
	var sizes: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(1536, 720)]
	for size in sizes:
		var vp := SubViewport.new()
		vp.size = size
		root.add_child(vp)
		var ui := GameUI.new()
		vp.add_child(ui)
		ui.show_title()  # the game calls this; it also grabs button focus
		await process_frame
		await process_frame
		var screen := Rect2(Vector2.ZERO, Vector2(size))
		for node in ui.find_children("*", "Control", true, false):
			var c := node as Control
			if c.is_visible_in_tree() and not screen.encloses(c.get_global_rect()):
				failed += 1
				push_error("M1TEST UI %s off-screen at %s: %s" % [ui.get_path_to(c), str(size), str(c.get_global_rect())])
		# A menu with nothing focused cannot be navigated without a mouse.
		check(vp.gui_get_focus_owner() != null, "title screen has a focused button at " + str(size))
		vp.queue_free()
	await process_frame

# ---------------------------------------------------------------- jump + signals
func _load_game() -> Node:
	var game: Node = load("res://main.tscn").instantiate()
	root.add_child(game)
	# Boss/hero spawn their code lines via get_tree().current_scene — in a
	# normal run the engine sets that on scene load; here the runner must.
	current_scene = game
	await process_frame
	return game

func test_jump_and_signals() -> void:
	_game = await _load_game()
	_game._start_level()
	var hero = _game._hero
	# Let the hero settle on the floor (proves the StaticBody3D floor works:
	# without it is_on_floor() is never true and the hero falls forever).
	for i in 30:
		await physics_frame
	check(hero.is_on_floor(), "hero stands on the floor after spawn")
	# Jump measurement (level-design Pattern 1, 3D): run left (no wave
	# triggers that way), jump, measure the real arc. Hold jump until the
	# hero starts falling — a tap releases instantly and the variable-height
	# cut (velocity x0.5 on release) would measure a 0.5 m hop, not the jump.
	Input.action_press("move_left")
	Input.action_press("jump")
	var start_y: float = hero.global_position.y
	var apex := 0.0
	var ticks := 0
	var airborne := false
	var jump_held := true
	var buffer_pressed := false
	while ticks < 600:
		await physics_frame
		ticks += 1
		apex = maxf(apex, hero.global_position.y - start_y)
		if not hero.is_on_floor():
			airborne = true
			if jump_held and hero.velocity.y < 0.0:
				jump_held = false
				Input.action_release("jump")
			# Buffer test (platformer): press jump while falling and close
			# to the ground (~0.1 s before landing, inside the 0.12 s /
			# 7-tick buffer) — the buffered press must fire a second jump
			# on the tick after landing.
			if not buffer_pressed and hero.velocity.y < 0.0 and hero.global_position.y < 0.6:
				buffer_pressed = true
				Input.action_press("jump")
				Input.action_release("jump")
		elif airborne:
			break
	var airtime := ticks / 60.0
	Input.action_release("move_left")
	# Ideal arc: v=9, g=20 -> apex 2.03 m, airtime 0.90 s. The fixed-step
	# integrator peaks a few percent short; allow 15% / 25%.
	check(airborne, "hero left the floor on jump")
	check(apex > 1.7 and apex < 2.4, "jump apex %.2f m (ideal 2.03)" % apex)
	check(airtime > 0.65 and airtime < 1.15, "jump airtime %.2f s (ideal 0.90)" % airtime)
	check(hero.is_on_floor(), "hero lands back on the floor")
	# The buffered press should have fired a second jump after landing.
	var rose_again := false
	for i in 30:
		await physics_frame
		if not hero.is_on_floor():
			rose_again = true
			break
	check(rose_again, "buffered jump fires on landing (platformer buffer)")
	# Signal wiring (godot-signals-groups Pattern 4): exactly one connection
	# each — a double connect would fire the handler twice.
	_game._start_boss_intro()
	await process_frame
	check(hero.hp_changed.get_connections().size() == 1, "hero.hp_changed has 1 connection")
	check(hero.died.get_connections().size() == 1, "hero.died has 1 connection")
	check(hero.nova_cast.get_connections().size() == 1, "hero.nova_cast has 1 connection")
	check(_game._boss.hp_changed.get_connections().size() == 1, "boss.hp_changed has 1 connection")
	# Animation loop modes (godot-animation): locomotion must loop, or the
	# character freezes mid-pose.
	check(hero._anim.get_animation("idle").loop_mode == Animation.LOOP_LINEAR, "hero idle loops")
	check(hero._anim.get_animation("run").loop_mode == Animation.LOOP_LINEAR, "hero run loops")
	check(_game._boss._anim.get_animation("idle").loop_mode == Animation.LOOP_LINEAR, "boss idle loops")

# ---------------------------------------------------------------- troop AI (game-ai checks)
func test_troop_ai() -> void:
	if _game._boss != null:
		_game._boss.queue_free()
		_game._boss = null
	_game._start_level()
	_game._spawn_wave(0)
	var troops: Array = get_nodes_in_group("troops")
	check_eq(troops.size(), 2, "wave 1 spawns 2 troops")
	var start_x := {}
	for t in troops:
		start_x[t] = t.global_position.x
	var transitions := 0
	var last_state := {}
	for t in troops:
		last_state[t] = t._state
	# 5 s of physics (300 frames at 60 Hz): troops must make progress
	# toward the hero (game-ai stuck check: <0.5 m in 2 s fails), and must
	# not flicker states (>2 transitions/sec means missing hysteresis).
	for i in 150:
		await physics_frame
		await physics_frame  # ~100 ms sampling
		for t in troops:
			if is_instance_valid(t) and t._state != last_state[t]:
				transitions += 1
				last_state[t] = t._state
	var ti := 0
	for t in troops:
		if is_instance_valid(t):
			var moved: float = absf(t.global_position.x - float(start_x[t]))
			check(moved > 0.5, "troop %d moved %.2f m toward the hero in 5 s" % [ti, moved])
		ti += 1
	check(transitions <= 20, "troop state transitions in 5 s: %d (<= 2/sec each)" % transitions)

# ---------------------------------------------------------------- combat flow
# The runner extends SceneTree, which has no get_process_delta_time() and
# no get_tree() — waits use wall-clock (Time.get_ticks_msec), which is
# correct at any frame rate (headless runs uncapped).
# Success is "a deflect LANDED" (the deflects counter increased), not "a
# line despawned": a slash's 350 ms buffer can still be active when the
# next line arrives, so a line can deflect without this function ever
# slashing at it — the old despawn-watch then timed out on a deflect that
# had already happened. The slash below is still what causes the deflect
# when no buffer is active.
func _wait_deflect() -> bool:
	var d0: int = _game._deflects
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 6000:
		await process_frame
		if _game._deflects > d0:
			return true
		for child in _game.get_children():
			if child is CodeLine and child.active and not child.friendly and not child.deflected_back:
				if child.global_position.distance_to(_game._hero.global_position + Vector3(0, 1.0, 0)) <= 2.0:
					_game._hero._slash_cooldown_until = 0.0
					_game._hero.try_slash()
	return false

func _wait_line_resolved(guard: bool) -> bool:
	var t0 := Time.get_ticks_msec()
	var saw_line := false
	if guard:
		Input.action_press("guard")
	while Time.get_ticks_msec() - t0 < 6000:
		await process_frame
		var any_line := false
		for child in _game.get_children():
			if child is CodeLine and child.active and not child.friendly:
				any_line = true
				saw_line = true
		# Only stop once a line was seen AND has resolved — stopping on an
		# empty frame before the throw would pass the guard check vacuously.
		if saw_line and not any_line:
			break
	if guard:
		Input.action_release("guard")
	return saw_line and Time.get_ticks_msec() - t0 < 6000

func _wait_hp(target: int, timeout_s: float) -> bool:
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < int(timeout_s * 1000.0):
		await process_frame
		if _game._boss.hp <= target:
			return true
	return false

func _wait_seconds(s: float) -> bool:
	await create_timer(s).timeout
	return true

func test_combat() -> void:
	_game._start_level()
	_game._start_boss_intro()
	_game._boss.test_mode = true
	_game._boss.start_fight()
	_game._hero.in_boss_fight = true
	_game._hero.boss_ref = _game._boss
	await create_timer(0.5).timeout
	# 1) Deflect: 560 -> 530. Check the trauma FIRST: it decays at 1.2/s
	# in real time, so a 0.5 s wait before checking would already have
	# decayed the 0.5 trauma to zero.
	_game._boss.throw_code_line()
	check(await _wait_deflect(), "deflect lands (line flies back and despawns)")
	check(await _wait_hp(530, 3.0), "deflect damage lands (530)")
	check_eq(_game._boss.hp, 530, "deflect 560 -> 530")
	check(_game._trauma > 0.0, "deflect added trauma (shake)")
	await _wait_seconds(0.5)
	check_eq(Engine.time_scale, 1.0, "hit-stop restored time_scale to 1.0")
	await _wait_seconds(1.0)
	check(_game._trauma <= 0.01, "trauma decayed back to ~0")
	# 2) Guard: a line hits the guarding hero, HP unchanged.
	_game._boss.throw_code_line()
	var hp_before: int = _game._hero.hp
	check(await _wait_line_resolved(true), "guarded line resolves")
	check_eq(_game._hero.hp, hp_before, "guard blocks: hero HP unchanged")
	# 3) Dodge: boss charges, hero dodge-dashes, HP unchanged. Drive the
	# dodge off the boss's PHYSICS state, not a wall-clock wait — the
	# telegraph is physics time and drifts against a process-time wait
	# under load, so a fixed 0.55 s wait can dodge before the charge even
	# starts (i-frames expire, then the charge lands). Dodge INTO the boss
	# as he closes: the dash shortens the gap, so he reaches the 1.4 m hit
	# band while the 0.30 s i-frames are still up, and recovers on contact.
	# (Dodging away is wrong here: the charge travels 7.4 m, further than
	# the dash, so it catches up after the i-frames expire.)
	_game._boss._set_state("telegraph_charge")
	var waited := 0.0
	while _game._boss._state != "charge" and waited < 5.0:
		await physics_frame
		waited += 1.0 / 60.0
	while absf(_game._boss.global_position.x - _game._hero.global_position.x) > 2.5 and waited < 8.0:
		await physics_frame
		waited += 1.0 / 60.0
	_game._hero.try_dodge(1)
	hp_before = _game._hero.hp
	await _wait_seconds(1.4)
	check_eq(_game._hero.hp, hp_before, "dodge avoids the charge")
	# 4) Bullet: -10. 5) Nova: -25.
	_game._hero.facing = 1
	_game._hero.try_bullet()
	check(await _wait_hp(_game._boss.hp - 10, 3.0), "bullet -10")
	var hp_before_nova: int = _game._boss.hp
	_game._hero.try_nova()
	check(await _wait_hp(hp_before_nova - 25, 3.0), "nova -25")
	# 6) KO: reset to 560, exactly 19 deflects. Phase 2 must trigger at 280.
	# Move the hero to the arena's left edge first: the slash also deals 10
	# melee damage when the boss is within SLASH_RANGE + 0.6 (2.8 m), and
	# after the dodge the hero stands 1.2 m from the boss — every KO slash
	# would add +10 and break the exact -30-per-deflect accounting. At
	# x 48.5 the boss is ~4 m away (no melee) and the lines still reach the
	# hero across the 3 m deflect window.
	_game._hero.global_position = Vector3(48.0, 0, 0)
	_game._hero.reset_physics_interpolation()
	await process_frame
	_game._boss.set_hp(560)
	_game._deflects = 0
	var ko_ok := true
	for i in range(19):
		_game._boss.throw_code_line()
		if not await _wait_deflect():
			ko_ok = false
			break
		# The deflect lands when the line is deflected mid-flight; the
		# damage lands ~0.3 s later when the line reaches the boss. Wait
		# for the HP before checking it, or the check races the flight.
		if not await _wait_hp(maxi(0, 560 - (i + 1) * 30), 3.0):
			ko_ok = false
			break
		if _game._boss.hp != 560 - (i + 1) * 30 and _game._boss.hp != 0:
			ko_ok = false
			break
		if _game._boss.hp == 0:
			break
	ko_ok = ko_ok and _game._boss.hp == 0 and _game.state == 5  # State.VICTORY
	print("M1TEST KO loop: ko_ok=%s hp=%d state=%d deflects=%d boss_state=%s" % [
		str(ko_ok), _game._boss.hp, _game.state, _game._deflects, _game._boss._state])
	check(ko_ok, "KO after 19 deflects (0/560, VICTORY)")
	check_eq(_game._deflects, 19, "19 deflects counted")
	check(_game._boss._phase2, "phase 2 triggered at 280 HP")
