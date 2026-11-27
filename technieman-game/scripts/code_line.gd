class_name CodeLine
extends Node3D
## A thrown line of real code — a black ink chip with white text.
## Thrown by the boss (hostile) or by the hero's 'if' bullet (friendly).
## Deflect rule (from the Three.js combat proof): a hostile line is deflectable
## for its whole final ~3 m of flight, plus a 350 ms slash-press buffer.
## Guard (held) blocks it with no damage. Dodge i-frames avoid it.
## A deflected line flies back and deals 30 damage to the boss.

signal hit_boss(amount: int)
signal hit_hero(amount: int)
signal blocked
signal deflected

var text: String = ""
var speed: float = 5.0
var direction: Vector3 = Vector3.LEFT
var friendly: bool = false
var damage: int = 20
var active: bool = true
var deflected_back: bool = false

var _hero: Node3D = null
var _boss: Node3D = null
var _label: Label3D = null
var _chip: MeshInstance3D = null
var _cue: Label3D = null
var _life: float = 0.0
var _prev_position: Vector3 = Vector3.ZERO

func setup(p_text: String, p_speed: float, p_dir: Vector3, p_friendly: bool,
		p_damage: int, hero: Node3D, boss: Node3D) -> void:
	text = p_text
	speed = p_speed
	direction = p_dir.normalized()
	friendly = p_friendly
	damage = p_damage
	_hero = hero
	_boss = boss

func _ready() -> void:
	_prev_position = global_position
	# Black ink chip (thin box) with the white code text on its face.
	# The chip is wide and the text wraps (longest Kotlin line is 49 chars).
	_chip = MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(3.6, 1.0, 0.08)
	_chip.mesh = box
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.02, 0.02, 0.02)
	m.roughness = 0.4
	_chip.material_override = m
	add_child(_chip)
	_label = Label3D.new()
	_label.text = text
	_label.font_size = 64
	_label.pixel_size = 0.0022
	_label.width = 1500.0
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.modulate = Color.WHITE
	_label.outline_size = 0
	_label.position = Vector3(0, 0, 0.06)
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(_label)
	# "DEFLECT NOW" cue — WHITE flashing text above the chip (white per the
	# ink-manga rule; the proof's gold/white cue is honoured in white).
	_cue = Label3D.new()
	_cue.text = "DEFLECT NOW"
	_cue.font_size = 48
	_cue.pixel_size = 0.008
	_cue.modulate = Color.WHITE
	_cue.position = Vector3(0, 0.95, 0)
	_cue.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_cue.visible = false
	add_child(_cue)

func _process(delta: float) -> void:
	if not active:
		return
	_life += delta
	# Swept movement (physics-tuning CCD): remember where the chip was so
	# the hit tests below measure the segment it travelled this frame, not
	# just the point it landed on. A fast chip at a low frame rate jumps
	# past its target between samples and a point test misses it entirely
	# (the browser 'if' bullet did exactly this: fired true, hero 1 m
	# from the boss, yet never registered a hit).
	_prev_position = global_position
	position += direction * speed * delta
	# Spin the chip slightly as it flies (paper-chip tumble).
	_chip.rotation.z += delta * 2.0
	if friendly:
		_update_friendly()
	else:
		_update_hostile()
	# A deflected line homes on the boss; its hit is swept too (the
	# _physics_process point check below stays as a safety net).
	if active and deflected_back and _boss != null:
		if _seg_dist_to(_boss.global_position + Vector3(0, 2.0, 0)) <= 1.4:
			hit_boss.emit(CampaignData.DEFLECT_DAMAGE)
			_despawn()
	# Lifetime safety: never fly forever.
	if _life > 12.0:
		_despawn()

func _seg_dist_to(p: Vector3) -> float:
	# Distance from point p to the segment [_prev_position, global_position].
	var a := _prev_position
	var b := global_position
	var ab := b - a
	var denom := ab.length_squared()
	if denom <= 0.000001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / denom, 0.0, 1.0)
	return p.distance_to(a + ab * t)

func _dist_to_hero() -> float:
	if _hero == null:
		return 999.0
	return global_position.distance_to(_hero.global_position + Vector3(0, 1.0, 0))

func _dist_to_boss() -> float:
	if _boss == null:
		return 999.0
	return global_position.distance_to(_boss.global_position + Vector3(0, 2.0, 0))

func _update_hostile() -> void:
	# A deflected line is already flying back at the boss; it can no longer
	# hit the hero (its boss hit is resolved in _physics_process).
	if deflected_back:
		return
	var d := _dist_to_hero()
	# Deflect cue: visible while the line is inside the deflect window.
	var in_window := d <= CampaignData.DEFLECT_WINDOW_M
	_cue.visible = in_window and not deflected_back
	if _cue.visible:
		# Flash the cue + the chip so the window is unmistakable.
		var pulse := 0.65 + 0.35 * sin(_life * 14.0)
		_cue.modulate = Color(pulse, pulse, pulse)
	# 1) Slash deflect: the hero's slash is active (pressed within the buffer)
	#    and the line is inside slash range (swept: the line may have
	#    crossed the range between frames at a low frame rate).
	if _hero != null and _hero.has_method("slash_is_active") and _hero.slash_is_active():
		if _seg_dist_to(_hero.global_position + Vector3(0, 1.0, 0)) <= CampaignData.SLASH_RANGE:
			_deflect()
			return
	# 2) Hit the hero (swept).
	if _seg_dist_to(_hero.global_position + Vector3(0, 1.0, 0)) <= 0.9:
		if _hero.has_method("is_guarding") and _hero.is_guarding():
			blocked.emit()
			_despawn()
			return
		if _hero.has_method("is_dodging") and _hero.is_dodging():
			return  # i-frames: the line passes through
		hit_hero.emit(damage)
		_despawn()

func _update_friendly() -> void:
	# Hero 'if' bullet: damages the boss, kills 1-HP troops on contact.
	# Swept: a fast bullet at a low frame rate jumps past the boss's chest
	# between samples, so the hit is measured against the segment it
	# travelled this frame, not the point it landed on.
	if _boss != null and _seg_dist_to(_boss.global_position + Vector3(0, 2.0, 0)) <= 1.2:
		hit_boss.emit(damage)
		_despawn()
		return
	# Troop hits are resolved by the game (it tracks live troops).
	if _hero != null and _hero.has_method("check_bullet_troop_hit"):
		if _hero.check_bullet_troop_hit(self):
			_despawn()

func _deflect() -> void:
	deflected_back = true
	direction = -direction
	speed = 9.0
	_cue.visible = false
	_label.modulate = Color.WHITE
	deflected.emit()
	# A deflected line now homes on the boss: steer straight at him.
	if _boss != null:
		var target: Vector3 = _boss.global_position + Vector3(0, 2.0, 0)
		direction = (target - global_position).normalized()

func _physics_process(_delta: float) -> void:
	# Deflected lines check the boss hit in physics (stable timing).
	if active and deflected_back and _boss != null and _dist_to_boss() <= 1.4:
		hit_boss.emit(CampaignData.DEFLECT_DAMAGE)
		_despawn()

func _despawn() -> void:
	active = false
	queue_free()
