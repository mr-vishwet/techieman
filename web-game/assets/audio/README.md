# assets/audio/ — real MP3 audio (staged, NOT on this branch yet)

Real audio MP3s land here only when the user pushes them from his machine (the
GitHub connector is text-only and cannot push binaries). Until then this directory
stays empty and the game runs SILENT. Never synthesize fake audio, never substitute
TTS/AI narration for a real recording.

## How the auto-upgrade works

On load, the game probes for the files below (relative path, same origin, `HEAD`/
audio-element probe). When a file exists it is wired in; when it is missing the
game simply stays silent for that cue. Audio only ever starts after a user gesture
(click / key / tap), per browser autoplay rules.

## Expected files (relative to web-game/)

| Cue | File (when pushed) |
|---|---|
| Theme / title music | `theme.mp3` |
| NULLPOINTER roar — "THE VOID ROAR" | `roar-nullpointer.mp3` |
| Hero rally cry | `hero-rally.mp3` |
| Episode-01 narration (cinematic re-record, deep narrator voice ONLY) | `narration-ep01.mp3` |
| Slash SFX | `sfx-slash.mp3` |
| Guard SFX | `sfx-guard.mp3` |
| Deflect SFX | `sfx-deflect.mp3` |
| Checkpoint SFX | `sfx-checkpoint.mp3` |

Rejected — NEVER wire these: the flat TTS files (`tts1min-*.mp3`); the Ken Burns
intro videos are video, not audio, and are rejected placeholders too. The game's old
"24 narration MP3s" are not on disk and unverified — do not claim them as wired.
Audio mix rule (from the intros): narration at −12 dB, SFX peaking at −3 dB.
