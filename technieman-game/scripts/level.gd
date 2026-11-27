class_name Level
extends Node3D
## The M1 level environment: pure black-and-white ink-manga world.
## Cracked rocky ground, grey mist, black ink ribbons, a stone checkpoint
## gate. Built procedurally in code (no binary textures) — grayscale only.
## The level runs along +X: hero starts at x=2, checkpoint at 42, the stone
## gate at 46, the boss arena at x=48..58.

var length: float = 60.0
var checkpoint_x: float = 42.0
var gate_x: float = 46.0
var _mist: Array[MeshInstance3D] = []
var _time: float = 0.0
var _gate_open: bool = false
var _checkpoint_reached: bool = false
var _flag: MeshInstance3D = null

func build(p_length: float, p_checkpoint_x: float, p_gate_x: float) -> void:
	length = p_length
	checkpoint_x = p_checkpoint_x
	gate_x = p_gate_x
	_ground()
	_ink_ribbons()
	_mist_planes()
	_ruins()
	_checkpoint()
	_gate()

func _cracked_texture() -> ImageTexture:
	# Procedural cracked rock: mid-grey stone, dark cracks, white paper flecks.
	var size := 512
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1337
	img.fill(Color(0.32, 0.32, 0.32))
	# Stone slabs: large soft blotches.
	for i in range(90):
		var cx := rng.randi_range(0, size - 1)
		var cy := rng.randi_range(0, size - 1)
		var r := rng.randi_range(20, 70)
		var shade := rng.randf_range(0.22, 0.45)
		for y in range(maxi(0, cy - r), mini(size, cy + r)):
			for x in range(maxi(0, cx - r), mini(size, cx + r)):
				if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r:
					img.set_pixel(x, y, Color(shade, shade, shade))
	# Cracks: dark jagged polylines.
	for i in range(46):
		var x := rng.randi_range(0, size - 1)
		var y := rng.randi_range(0, size - 1)
		var angle := rng.randf_range(0, TAU)
		for step in range(rng.randi_range(30, 120)):
			angle += rng.randf_range(-0.5, 0.5)
			x += int(cos(angle) * 3)
			y += int(sin(angle) * 3)
			if x < 0 or x >= size or y < 0 or y >= size:
				break
			img.set_pixel(x, y, Color(0.05, 0.05, 0.05))
			if x + 1 < size:
				img.set_pixel(x + 1, y, Color(0.08, 0.08, 0.08))
	# White paper flecks.
	for i in range(220):
		var x := rng.randi_range(0, size - 1)
		var y := rng.randi_range(0, size - 1)
		img.set_pixel(x, y, Color(0.85, 0.85, 0.85))
	return ImageTexture.create_from_image(img)

func _ground() -> void:
	var ground := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(length + 16, 1.0, 9.0)
	ground.mesh = box
	var m := StandardMaterial3D.new()
	m.albedo_texture = _cracked_texture()
	m.roughness = 0.9
	# Tile the crack texture along the run.
	m.uv1_scale = Vector3(length / 8.0, 1.0, 1.0)
	ground.material_override = m
	ground.position = Vector3(length / 2.0 - 4, -0.5, 0)
	add_child(ground)
	# Physics floor: the visual ground above is only a mesh. CharacterBody3D
	# needs a real StaticBody3D or is_on_floor() is never true (hero falls
	# forever, jump never fires). One box, same size/position as the visual.
	var floor_body := StaticBody3D.new()
	floor_body.name = "FloorBody"
	floor_body.collision_layer = 1
	floor_body.collision_mask = 0
	var floor_shape := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(length + 16, 1.0, 9.0)
	floor_shape.shape = floor_box
	floor_body.add_child(floor_shape)
	floor_body.position = Vector3(length / 2.0 - 4, -0.5, 0)
	add_child(floor_body)
	# A pale paper strip at the far edge (the world is drawn on paper).
	var edge := MeshInstance3D.new()
	var ebox := BoxMesh.new()
	ebox.size = Vector3(length + 16, 0.1, 0.6)
	edge.mesh = ebox
	var em := StandardMaterial3D.new()
	em.albedo_color = Color(0.9, 0.9, 0.88)
	edge.material_override = em
	edge.position = Vector3(length / 2.0 - 4, 0.02, -4.4)
	add_child(edge)

func _ink_ribbons() -> void:
	# Black ink ribbons pool along the ground — glossy, still, dangerous-looking.
	var rng := RandomNumberGenerator.new()
	rng.seed = 777
	for i in range(7):
		var ribbon := MeshInstance3D.new()
		var box := BoxMesh.new()
		var w := rng.randf_range(2.5, 6.0)
		box.size = Vector3(w, 0.06, rng.randf_range(0.5, 1.1))
		ribbon.mesh = box
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.01, 0.01, 0.01)
		m.roughness = 0.08
		ribbon.material_override = m
		ribbon.position = Vector3(rng.randf_range(2, length - 4), 0.03,
			rng.randf_range(-3.2, 3.2))
		ribbon.rotation.y = rng.randf_range(-0.4, 0.4)
		add_child(ribbon)

func _mist_planes() -> void:
	# Grey mist: large translucent white planes drifting slowly.
	for i in range(6):
		var p := MeshInstance3D.new()
		var quad := QuadMesh.new()
		quad.size = Vector2(14, 4)
		p.mesh = quad
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(1, 1, 1, 0.07)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		p.material_override = m
		p.position = Vector3(6 + i * 9.0, 2.2 + (i % 3) * 0.8, -3.0 - (i % 2))
		add_child(p)
		_mist.append(p)

func _ruins() -> void:
	# Distant ruined towers, grey silhouettes in the mist.
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	for i in range(10):
		var t := MeshInstance3D.new()
		var box := BoxMesh.new()
		var h := rng.randf_range(4.0, 11.0)
		box.size = Vector3(rng.randf_range(1.2, 2.6), h, 1.2)
		t.mesh = box
		var m := StandardMaterial3D.new()
		var g := rng.randf_range(0.35, 0.6)
		m.albedo_color = Color(g, g, g)
		m.roughness = 1.0
		t.material_override = m
		t.position = Vector3(rng.randf_range(-2, length), h / 2.0, -7.5)
		add_child(t)

func _checkpoint() -> void:
	# Stone pillar + white flag + floating label.
	var pillar := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.7, 3.0, 0.7)
	pillar.mesh = box
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.55, 0.55, 0.55)
	pillar.material_override = m
	pillar.position = Vector3(checkpoint_x, 1.5, -2.6)
	add_child(pillar)
	_flag = MeshInstance3D.new()
	var fbox := BoxMesh.new()
	fbox.size = Vector3(0.9, 0.55, 0.04)
	_flag.mesh = fbox
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color.WHITE
	fm.emission_enabled = true
	fm.emission = Color.WHITE
	fm.emission_energy_multiplier = 0.6
	_flag.material_override = fm
	_flag.position = Vector3(checkpoint_x + 0.45, 2.7, -2.6)
	add_child(_flag)
	var label := Label3D.new()
	label.text = "CHECKPOINT"
	label.font_size = 48
	label.pixel_size = 0.008
	label.modulate = Color.WHITE
	label.outline_size = 8
	label.outline_modulate = Color.BLACK
	label.position = Vector3(checkpoint_x, 3.6, -2.6)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(label)

func _gate() -> void:
	# The stone gate the hero walks through to the boss arena.
	for sx in [-1.6, 1.6]:
		var pillar := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.9, 6.0, 0.9)
		pillar.mesh = box
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.45, 0.45, 0.45)
		pillar.material_override = m
		pillar.position = Vector3(gate_x, 3.0, sx)
		add_child(pillar)
	var lintel := MeshInstance3D.new()
	var lbox := BoxMesh.new()
	lbox.size = Vector3(1.0, 1.0, 4.1)
	lintel.mesh = lbox
	var lm := StandardMaterial3D.new()
	lm.albedo_color = Color(0.4, 0.4, 0.4)
	lintel.material_override = lm
	lintel.position = Vector3(gate_x, 6.2, 0)
	add_child(lintel)
	var label := Label3D.new()
	label.text = "NULLPOINTER"
	label.font_size = 64
	label.pixel_size = 0.01
	label.modulate = Color.WHITE
	label.outline_size = 8
	label.outline_modulate = Color.BLACK
	label.position = Vector3(gate_x, 7.2, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(label)

func set_gate_open(open: bool) -> void:
	_gate_open = open

func is_gate_open() -> bool:
	return _gate_open

func set_checkpoint_reached(reached: bool) -> void:
	_checkpoint_reached = reached
	if _flag != null:
		_flag.visible = not reached  # flag lowers once claimed... (kept simple)

func _process(delta: float) -> void:
	_time += delta
	for i in range(_mist.size()):
		_mist[i].position.x += sin(_time * 0.11 + i * 1.7) * delta * 0.25
		_mist[i].position.y += cos(_time * 0.07 + i) * delta * 0.12
