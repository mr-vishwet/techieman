class_name SaveGame
extends RefCounted
## Checkpoint autosave (save-systems): version-stamped JSON, atomic
## temp + .bak + rename, user:// path, defensive load.
## What is saved (data, not objects): language, hero HP, checkpoint flag,
## which waves are cleared, deflects, run time. Nodes are rebuilt from it.
## M1 has one autosave slot (the checkpoint); manual slots are M2.

const SAVE_VERSION := 1
const PATH := "user://techieman_autosave.json"

static func has_save() -> bool:
	return FileAccess.file_exists(PATH)

static func save_checkpoint(data: Dictionary) -> Error:
	var payload := data.duplicate(true)
	payload["version"] = SAVE_VERSION
	return save_atomic(PATH, payload)

## Atomic, crash-safe write (save-systems Pattern 2): temp file, keep the
## previous save as .bak, rename into place. An in-place write would leave
## a truncated, unloadable save if the game crashed mid-write.
static func save_atomic(path: String, data: Dictionary) -> Error:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return FileAccess.get_open_error()
	if not f.store_string(JSON.stringify(data)):
		return ERR_FILE_CANT_WRITE
	f.close()  # flushes Godot's buffer to the OS
	if FileAccess.file_exists(path):
		DirAccess.rename_absolute(path, path + ".bak")
	return DirAccess.rename_absolute(tmp, path)

## Defensive load: tries the primary, then the .bak (covers a crash between
## the two renames). Refuses saves from a newer build instead of half-loading.
static func load_checkpoint() -> Dictionary:
	for p in [PATH, PATH + ".bak"]:
		if FileAccess.file_exists(p):
			var parsed = JSON.parse_string(FileAccess.get_file_as_string(p))
			if parsed is Dictionary and parsed.has("version"):
				var d: Dictionary = parsed
				if int(d["version"]) > SAVE_VERSION:
					push_error("SaveGame: save is from a newer build, refusing.")
					return {}
				d["version"] = int(d["version"])  # JSON numbers load as float
				return d
	return {}

static func clear() -> void:
	for p in [PATH, PATH + ".bak", PATH + ".tmp"]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
