class_name LanguageData
extends Resource
## One language road: boss, throw lines, troops, level layout, narration.
## Saved as text .tres files under res://data/ (godot-resources Pattern 1/2).
## The engine never hard-codes a language: it loads one of these and reads
## the same fields, so a new road is a new .tres, not a rebuild.
## Line IDs (dialogue-systems): the narration fields below are DLG_BOSS_TAUNT,
## DLG_BOSS_PHASE and DLG_BOSS_VICTORY; the text lives in the .tres so it can
## be re-voiced / localised without touching code.
## NOTE: the old `boss_scale` field is gone — it was dead data (never applied;
## the boss model is 3.6 m as built, already towering).

@export var id: String = ""
@export var display_name: String = ""
@export var road: String = ""
@export var boss: String = ""
@export var boss_title: String = ""
@export var boss_hp: int = 560
@export var boss_model: String = "res://models/nullpointer.glb"
@export var boss_taunt: String = ""
@export var phase_hp: int = 280
@export var phase_line: String = ""
@export var victory_line: String = ""
@export var code_lines: Array[String] = []
@export var troops: Array[Dictionary] = []
@export var level_length: float = 60.0
@export var checkpoint_x: float = 42.0
@export var gate_x: float = 46.0
@export var waves: Array[Dictionary] = []

## The engine reads a plain Dictionary (same shape the old const table had),
## so no reader changes when the data moves to .tres files.
func to_dict() -> Dictionary:
	return {
		"name": display_name,
		"road": road,
		"boss": boss,
		"boss_title": boss_title,
		"boss_hp": boss_hp,
		"boss_model": boss_model,
		"boss_taunt": boss_taunt,
		"phase_hp": phase_hp,
		"phase_line": phase_line,
		"victory_line": victory_line,
		"code_lines": code_lines,
		"troops": troops,
		"level_length": level_length,
		"checkpoint_x": checkpoint_x,
		"gate_x": gate_x,
		"waves": waves,
	}
