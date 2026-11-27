class_name CampaignData
extends RefCounted
## TechieMan M1 — data-driven campaign data.
## The shared engine reads per-language curriculum / level / boss data from
## res://data/<language>.tres (LanguageData resources, godot-resources).
## DEFAULT_LANGUAGE is the one-word flip: "kotlin" today, "python" when the user
## says so. Nothing in the engine hard-codes a language; every language entry
## carries its own boss, throw lines, troops and level layout.
## Units: Godot metres. 1 m = 100 px of the reference physics (spec §3).
## Boss HP 560, deflect = 30 damage, 19 deflects x 30 = 570 >= 560 -> KO.

const DEFAULT_LANGUAGE := "kotlin"

static var _cache: Dictionary = {}

static func language(key: String) -> Dictionary:
	if not _cache.has(key):
		var res := load("res://data/" + key + ".tres") as LanguageData
		if res == null:
			push_error("CampaignData: no data for '" + key + "', falling back to " + DEFAULT_LANGUAGE)
			key = DEFAULT_LANGUAGE
			res = load("res://data/" + key + ".tres") as LanguageData
		_cache[key] = res.to_dict() if res != null else {}
	return _cache.get(key, _cache.get(DEFAULT_LANGUAGE, {}))

static func troop_config(lang: Dictionary, troop_id: String) -> Dictionary:
	for t in lang["troops"]:
		if t["id"] == troop_id:
			return t
	return lang["troops"][0]

# Pacing beats (level-design Pattern 2): teach -> combat -> combat -> rest
# -> climax. Checked by the test runner (pacing_problems): at most 2
# high-intensity beats in a row, a rest beat right before the climax, and
# the level opens with a teach beat.
const BEATS := [
	{"room": "entry", "type": "teach", "intensity": 0.1},
	{"room": "wave_1", "type": "combat", "intensity": 0.4},
	{"room": "wave_2", "type": "combat", "intensity": 0.6},
	{"room": "wave_3", "type": "combat", "intensity": 0.8},
	{"room": "checkpoint", "type": "rest", "intensity": 0.1},
	{"room": "boss", "type": "climax", "intensity": 1.0},
]

# Room graph (level-design Pattern 3): the stone gate needs "waves_cleared",
# granted when the last wave is cleared. The test runner proves the boss is
# reachable with the grant and UNREACHABLE without it (no soft-lock, no
# free pass).
const ROOMS := {
	"entry": {"exits": [{"to": "wave_1"}]},
	"wave_1": {"exits": [{"to": "wave_2"}]},
	"wave_2": {"exits": [{"to": "wave_3"}]},
	"wave_3": {"exits": [{"to": "checkpoint"}], "grants": "waves_cleared"},
	"checkpoint": {"exits": [{"to": "gate", "needs": "waves_cleared"}]},
	"gate": {"exits": [{"to": "boss"}]},
	"boss": {"exits": []},
}

const HEROES := [
	{"id": "techieman", "name": "TECHIEMAN", "title": "The Developer",
		"desc": "Turn ideas into reality.", "hp": 5, "atk": 4, "def": 3, "speed": 5,
		"playable": true, "model": "res://models/hero.glb"},
	{"id": "byte", "name": "BYTE", "title": "The Hacker",
		"desc": "Fast. Dual blades. Coming soon.", "hp": 3, "atk": 4, "def": 2, "speed": 5,
		"playable": false, "model": ""},
	{"id": "kernel", "name": "KERNEL", "title": "The Guardian",
		"desc": "Heavy. Shield wall. Coming soon.", "hp": 5, "atk": 3, "def": 5, "speed": 2,
		"playable": false, "model": ""},
	{"id": "cipher", "name": "CIPHER", "title": "The Architect",
		"desc": "Ranged. Constructs. Coming soon.", "hp": 3, "atk": 5, "def": 3, "speed": 3,
		"playable": false, "model": ""},
]

# Hero combat numbers (from physics.md, 1 m = 100 px).
const HERO_RUN_SPEED := 5.2
const HERO_JUMP_VELOCITY := 9.0
const HERO_GRAVITY := 20.0
const HERO_HP := 100
const SLASH_MS := 460.0
const SLASH_RANGE := 2.2
const SLASH_BUFFER_MS := 350.0
const BULLET_SPEED := 11.0
const BULLET_DAMAGE := 10
const BULLET_COOLDOWN_MS := 350.0
const NOVA_DAMAGE := 25
const DEFLECT_DAMAGE := 30
const DEFLECT_WINDOW_M := 3.0
const TROOP_CONTACT_DAMAGE := 10
