class_name GameUI
extends CanvasLayer
## All M1 screens, built in code. Pure black-and-white ink-manga UI.
## Title -> hero select (TechieMan playable; Byte / Kernel / Cipher locked)
## -> HUD (hero HP, boss HP as a NUMBER + bar, combo, controls) -> pause ->
## victory / defeat. Subtitles carry the boss's lines (no audio in M1).

signal start_requested
signal hero_confirmed
signal continue_requested
signal resume_requested
signal restart_requested
signal quit_to_title_requested

var _title: Control
var _select: Control
var _hud: Control
var _pause: Control
var _end: Control
var _hero_hp_fill: ColorRect
var _hero_hp_label: Label
var _boss_bar: Control
var _boss_fill: ColorRect
var _boss_label: Label
var _boss_name: Label
var _combo_label: Label
var _subtitle: Label
var _toast: Label
var _deflect_cue: Label
var _flash_rect: ColorRect
var _end_title: Label
var _end_body: Label
var _select_model: Node3D
var _select_viewport: SubViewport
var _select_cards: Array[Button] = []
var _selected_hero: int = 0
var _time: float = 0.0
# Primary buttons, for keyboard/gamepad focus (godot-ui-control: a menu
# with nothing focused cannot be navigated without a mouse).
var _title_button: Button
var _confirm_button: Button
var _resume_button: Button
var _end_button: Button
var _continue_button: Button

func _ready() -> void:
	layer = 10
	_build_title()
	_build_select()
	_build_hud()
	_build_pause()
	_build_end()
	show_title()

func _process(delta: float) -> void:
	_time += delta
	if _select.visible and _select_model != null:
		_select_model.rotation.y += delta * 0.6

# ---------------------------------------------------------------- construction
func _full_rect() -> Control:
	var c := Control.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(c)
	return c

func _label(text: String, size: int, color: Color = Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	# Black outline on every label: the world is white paper and grey mist,
	# so white text with no outline washes out wherever a white ruin or the
	# pale ground sits behind it (boss HP number, subtitles, hero name).
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	return l

func _button(text: String, size: int = 24) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.custom_minimum_size = Vector2(240, 52)
	return b

func _build_title() -> void:
	_title = _full_rect()
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_title.add_child(bg)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.grow_horizontal = Control.GROW_DIRECTION_BOTH
	v.grow_vertical = Control.GROW_DIRECTION_BOTH
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 18)
	_title.add_child(v)
	var t := _label("TECHIEMAN", 84)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var sub := _label("A programming-language learning game  —  M1 vertical slice", 22, Color(0.75, 0.75, 0.75))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(sub)
	var lang := _label("Kotlin road  •  End boss: NULLPOINTER  •  560 HP  •  Deflect to win", 20, Color(0.65, 0.65, 0.65))
	lang.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(lang)
	var b := _button("PRESS ENTER — SELECT HERO", 26)
	b.pressed.connect(func() -> void: start_requested.emit())
	_title_button = b
	v.add_child(b)
	# Continue from the checkpoint autosave (save-systems). Hidden until a
	# save exists; the game sets its label via set_continue_available().
	var cont := _button("CONTINUE", 22)
	cont.pressed.connect(func() -> void: continue_requested.emit())
	cont.visible = false
	_continue_button = cont
	v.add_child(cont)
	var hint := _label("A/D move  •  J slash  •  S guard  •  Space jump  •  K 'if' bullet  •  Q Nova  •  P pause", 16, Color(0.55, 0.55, 0.55))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(hint)
	var note := _label("Real 3D models, built in Blender. Pure black-and-white ink-manga.", 16, Color(0.5, 0.5, 0.5))
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(note)

func _build_select() -> void:
	_select = _full_rect()
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.05, 0.05)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_select.add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 48)
	margin.add_theme_constant_override("margin_right", 48)
	margin.add_theme_constant_override("margin_top", 28)
	margin.add_theme_constant_override("margin_bottom", 28)
	_select.add_child(margin)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	margin.add_child(v)
	var title := _label("SELECT HERO", 44)
	v.add_child(title)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(row)
	# 3D turntable for TechieMan (real model, rotating).
	var vp_container := SubViewportContainer.new()
	vp_container.custom_minimum_size = Vector2(300, 400)
	vp_container.stretch = true
	row.add_child(vp_container)
	_select_viewport = SubViewport.new()
	_select_viewport.size = Vector2(300, 400)
	_select_viewport.transparent_bg = false
	vp_container.add_child(_select_viewport)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.08, 0.08, 0.08)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color.WHITE
	e.ambient_light_energy = 1.0
	env.environment = e
	_select_viewport.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation = Vector3(-0.6, -0.5, 0)
	_select_viewport.add_child(light)
	var cam := Camera3D.new()
	cam.look_at_from_position(Vector3(0, 1.3, 3.4), Vector3(0, 1.0, 0))
	_select_viewport.add_child(cam)
	_select_model = load("res://models/hero.glb").instantiate()
	_select_model.position = Vector3(0, 0, 0)
	_select_viewport.add_child(_select_model)
	var anim := _select_model.find_child("AnimationPlayer", true, false)
	if anim != null and anim.has_animation("idle"):
		anim.play("idle")
	# Hero cards.
	var cards := VBoxContainer.new()
	cards.add_theme_constant_override("separation", 10)
	row.add_child(cards)
	for i in range(CampaignData.HEROES.size()):
		var h: Dictionary = CampaignData.HEROES[i]
		var card := _button("", 20)
		card.custom_minimum_size = Vector2(430, 84)
		var lock := "" if bool(h["playable"]) else "   —  LOCKED / COMING SOON"
		card.text = "%s — %s%s\n%s   HP %d  ATK %d  DEF %d  SPD %d" % [
			h["name"], h["title"], lock, h["desc"],
			h["hp"], h["atk"], h["def"], h["speed"]]
		card.toggle_mode = true
		card.pressed.connect(_on_card_pressed.bind(i))
		cards.add_child(card)
		_select_cards.append(card)
	_select_cards[0].button_pressed = true
	var bottom := HBoxContainer.new()
	bottom.alignment = BoxContainer.ALIGNMENT_CENTER
	bottom.add_theme_constant_override("separation", 16)
	v.add_child(bottom)
	var confirm := _button("SELECT — ENTER", 24)
	confirm.pressed.connect(func() -> void: hero_confirmed.emit())
	_confirm_button = confirm
	bottom.add_child(confirm)
	var back := _button("BACK", 24)
	back.pressed.connect(func() -> void: quit_to_title_requested.emit())
	bottom.add_child(back)

func _on_card_pressed(i: int) -> void:
	var h: Dictionary = CampaignData.HEROES[i]
	if not bool(h["playable"]):
		_select_cards[_selected_hero].button_pressed = true
		_show_toast("That hero is locked in M1 — TechieMan is the playable hero.")
		return
	_selected_hero = i
	for j in range(_select_cards.size()):
		_select_cards[j].button_pressed = (j == i)

func _build_hud() -> void:
	_hud = _full_rect()
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Hero HP, top-left.
	var hero_panel := VBoxContainer.new()
	hero_panel.position = Vector2(16, 12)
	hero_panel.add_theme_constant_override("separation", 4)
	_hud.add_child(hero_panel)
	var hl := _label("CODE  —  Lv. 1", 20)
	hero_panel.add_child(hl)
	_hero_hp_fill = _bar(hero_panel, 220, 16, Color.WHITE)
	_hero_hp_label = _label("100 / 100", 16, Color(0.8, 0.8, 0.8))
	hero_panel.add_child(_hero_hp_label)
	# Boss HP, top-center (number + bar). Anchored to the horizontal centre
	# (godot-ui-control): a fixed 1280-based x would sit left of centre on
	# a wider browser window (stretch aspect "expand").
	_boss_bar = VBoxContainer.new()
	_boss_bar.anchor_left = 0.5
	_boss_bar.anchor_right = 0.5
	_boss_bar.position = Vector2(-220, 12)
	_boss_bar.add_theme_constant_override("separation", 4)
	_hud.add_child(_boss_bar)
	_boss_name = _label("NULLPOINTER", 22)
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_bar.add_child(_boss_name)
	_boss_fill = _bar(_boss_bar, 440, 18, Color.WHITE)
	_boss_label = _label("560 / 560", 18, Color(0.85, 0.85, 0.85))
	_boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_bar.add_child(_boss_label)
	_boss_bar.visible = false
	# Combo, right side (anchored to the right edge).
	_combo_label = _label("", 28)
	_combo_label.anchor_left = 1.0
	_combo_label.anchor_right = 1.0
	_combo_label.position = Vector2(-236, 90)
	_combo_label.size = Vector2(220, 28)
	_combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_hud.add_child(_combo_label)
	# DEFLECT NOW cue, centre screen (mirrors the in-world cue; anchored
	# to the horizontal centre).
	_deflect_cue = _label("DEFLECT NOW  —  J", 40)
	_deflect_cue.anchor_left = 0.5
	_deflect_cue.anchor_right = 0.5
	_deflect_cue.position = Vector2(-160, 300)
	_deflect_cue.size = Vector2(320, 40)
	_deflect_cue.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_deflect_cue.visible = false
	_hud.add_child(_deflect_cue)
	# Controls hint, bottom-left (anchored to the bottom edge).
	var hint := _label("A/D move (x2 = dodge dash)   J slash / deflect   S guard   Space jump   K 'if' bullet   Q Nova   P pause", 15, Color(0.6, 0.6, 0.6))
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.position = Vector2(16, -28)
	_hud.add_child(hint)
	# Subtitle line, centre-bottom (anchored centre + bottom).
	_subtitle = _label("", 24)
	_subtitle.anchor_left = 0.5
	_subtitle.anchor_right = 0.5
	_subtitle.anchor_top = 1.0
	_subtitle.anchor_bottom = 1.0
	_subtitle.position = Vector2(-500, -110)
	_subtitle.size = Vector2(1000, 40)
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud.add_child(_subtitle)
	# Toast, centre (anchored to the horizontal centre).
	_toast = _label("", 22, Color(0.85, 0.85, 0.85))
	_toast.anchor_left = 0.5
	_toast.anchor_right = 0.5
	_toast.position = Vector2(-500, 200)
	_toast.size = Vector2(1000, 36)
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud.add_child(_toast)
	# White flash overlay (game-feel): one brief flash per big impact,
	# well under the 3-flashes-per-second photosensitivity limit. Added
	# last so it sits above every other HUD element.
	_flash_rect = ColorRect.new()
	_flash_rect.color = Color(1, 1, 1, 0)
	_flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(_flash_rect)

func flash(strength: float = 0.35) -> void:
	if _flash_rect == null:
		return
	_flash_rect.color = Color(1, 1, 1, strength)
	# Ignore time scale: the flash must fade even during hit-stop, or it
	# would freeze the screen white (game-feel gotcha).
	var tw := create_tween().set_ignore_time_scale(true)
	tw.tween_property(_flash_rect, "color:a", 0.0, 0.25)

func _bar(parent: Control, w: int, h: int, color: Color) -> ColorRect:
	var track := ColorRect.new()
	track.color = Color(0.18, 0.18, 0.18)
	track.custom_minimum_size = Vector2(w, h)
	parent.add_child(track)
	var fill := ColorRect.new()
	fill.color = color
	fill.set_anchors_preset(Control.PRESET_FULL_RECT)
	track.add_child(fill)
	return fill

func _build_pause() -> void:
	_pause = _full_rect()
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.75)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_pause.add_child(bg)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.grow_horizontal = Control.GROW_DIRECTION_BOTH
	v.grow_vertical = Control.GROW_DIRECTION_BOTH
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 14)
	_pause.add_child(v)
	var t := _label("PAUSED", 48)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var resume := _button("RESUME — P", 24)
	resume.pressed.connect(func() -> void: resume_requested.emit())
	_resume_button = resume
	v.add_child(resume)
	var restart := _button("RESTART RUN", 24)
	restart.pressed.connect(func() -> void: restart_requested.emit())
	v.add_child(restart)
	var quit := _button("QUIT TO TITLE", 24)
	quit.pressed.connect(func() -> void: quit_to_title_requested.emit())
	v.add_child(quit)

func _build_end() -> void:
	_end = _full_rect()
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_end.add_child(bg)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.grow_horizontal = Control.GROW_DIRECTION_BOTH
	v.grow_vertical = Control.GROW_DIRECTION_BOTH
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 16)
	_end.add_child(v)
	_end_title = _label("", 56)
	_end_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_end_title)
	_end_body = _label("", 22, Color(0.75, 0.75, 0.75))
	_end_body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_end_body)
	var again := _button("PLAY AGAIN — ENTER", 24)
	again.pressed.connect(func() -> void: restart_requested.emit())
	_end_button = again
	v.add_child(again)
	var quit := _button("QUIT TO TITLE", 24)
	quit.pressed.connect(func() -> void: quit_to_title_requested.emit())
	v.add_child(quit)

# ---------------------------------------------------------------- state API
func set_continue_available(on: bool, road: String = "") -> void:
	if _continue_button == null:
		return
	_continue_button.visible = on
	if on:
		_continue_button.text = "CONTINUE — %s, checkpoint" % road if road != "" else "CONTINUE — CHECKPOINT"

func show_title() -> void:
	_title.visible = true
	_select.visible = false
	_hud.visible = false
	_pause.visible = false
	_end.visible = false
	if _title_button != null:
		_title_button.grab_focus()

func show_select() -> void:
	_title.visible = false
	_select.visible = true
	_hud.visible = false
	_pause.visible = false
	_end.visible = false
	if _confirm_button != null:
		_confirm_button.grab_focus()

func show_hud() -> void:
	_title.visible = false
	_select.visible = false
	_hud.visible = true
	_pause.visible = false
	_end.visible = false

func show_pause(on: bool) -> void:
	_pause.visible = on
	if on and _resume_button != null:
		_resume_button.grab_focus()

func show_end(victory: bool, body: String) -> void:
	_hud.visible = false
	_pause.visible = false
	_end.visible = true
	if _end_button != null:
		_end_button.grab_focus()
	if victory:
		_end_title.text = "NULLPOINTER DEFEATED"
	else:
		_end_title.text = "YOU FELL"
	_end_body.text = body

func set_hero_hp(hp: int, max_hp: int) -> void:
	_hero_hp_label.text = "%d / %d" % [hp, max_hp]
	if _hero_hp_fill != null and _hero_hp_fill.get_parent() != null:
		var track: Control = _hero_hp_fill.get_parent()
		_hero_hp_fill.anchor_right = float(hp) / float(maxi(1, max_hp))

func set_boss_hp(hp: int, max_hp: int, boss_name: String) -> void:
	_boss_bar.visible = true
	_boss_name.text = boss_name
	_boss_label.text = "%d / %d" % [hp, max_hp]
	_boss_fill.anchor_right = float(hp) / float(maxi(1, max_hp))

func hide_boss_bar() -> void:
	_boss_bar.visible = false

func set_combo(n: int) -> void:
	_combo_label.text = "%d HIT COMBO!" % n if n >= 2 else ""

func set_deflect_cue(on: bool) -> void:
	_deflect_cue.visible = on
	if on:
		var pulse := 0.7 + 0.3 * sin(_time * 14.0)
		_deflect_cue.add_theme_color_override("font_color", Color(pulse, pulse, pulse))

func show_subtitle(text: String, _seconds: float = 3.0) -> void:
	_subtitle.text = text
	var t := get_tree().create_timer(_seconds)
	t.timeout.connect(func() -> void:
		if _subtitle.text == text:
			_subtitle.text = "")

func _show_toast(text: String) -> void:
	_toast.text = text
	var t := get_tree().create_timer(2.5)
	t.timeout.connect(func() -> void:
		if _toast.text == text:
			_toast.text = "")

func toast(text: String) -> void:
	_show_toast(text)
