## One-off rate probe (physics-tuning Pattern 6): the same 2 s run must land
## the hero at the same x at 30 Hz and 144 Hz physics. Simulation lives in
## _physics_process, so the position must not depend on the tick rate.
## --fixed-fps does NOT change Engine.physics_ticks_per_second when running
## a --script, so the rate is set here from a user arg instead.
## Run: godot --headless --path . --script res://tools/rate_probe.gd -- --fps=30
extends SceneTree

func _initialize() -> void:
	var fps := 60
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--fps="):
			fps = int(a.trim_prefix("--fps="))
	Engine.physics_ticks_per_second = fps
	var game: Node = load("res://main.tscn").instantiate()
	root.add_child(game)
	current_scene = game
	await process_frame
	game._start_level()
	var hero = game._hero
	var frames := int(2.0 * fps)
	Input.action_press("move_right")
	for i in frames:
		await physics_frame
	Input.action_release("move_right")
	print("RATEPROBE fps=%d frames=%d hero_x=%.4f hero_y=%.4f" % [
		fps, frames, hero.global_position.x, hero.global_position.y])
	quit(0)
