extends Control
## TechieMan — M0 FOUNDATION main scene script.
## Proves the renderer works. No gameplay code lives here.
## M1 adds the real main menu / hero select on top of this foundation.


func _ready() -> void:
	print("TechieMan M0 foundation — renderer OK (Godot %s)" % Engine.get_version_info()["string"])
