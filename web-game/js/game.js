/* TECHIEMAN semi3d-mode — game.js
 * Single-file engine + all 5 scenes. No build step, no external requests.
 *
 * PHYSICS: numbers from GAME_WIRING_SPEC.md §3 are for a 1920x1080 stage.
 * This stage is 1280x720, so every px/s number is scaled by SCALE = 2/3.
 * The factor is recorded here and nowhere else is a raw spec number used.
 *
 * CODE-SET CONFLICT — DO NOT MERGE SILENTLY (REFERENCE_DIGEST.md §3.1 vs §3.2):
 * The Kotlin set and the NULLPOINTER own set are DIFFERENT 5-line sets for the
 * same villain. The boss fight throws CODE_SET below (default 'kotlin', the
 * spec §6 set). The other set is kept verbatim as the clearly-marked alternate.
 * The user will be asked which set the fight throws.
 */
'use strict';

var SCALE = 2 / 3; // 1280/1920 — spec physics (1920x1080 stage) -> this stage
var W = 1280, H = 720, GROUND_Y = 560; // feet rest on the flagstones here

var PHYS = {
  heroRun: 520 * SCALE,        // 347 px/s
  heroJump: -900 * SCALE,      // -600 px/s (202 px high on the spec stage)
  heroGrav: 2000 * SCALE,      // 1333 px/s^2
  slashMs: 460,                // slash duration
  bulletSpeed: 1100 * SCALE,   // 733 px/s — code bullets / thrown lines
  knockbackTaken: 420 * SCALE, // 280 px/s
  bossRun: 340 * SCALE,        // 227 px/s (NULLPOINTER)
  bossJump: -780 * SCALE,      // -520 px/s
  throwTotalMs: 1200,          // orb/code throw, total
  throwWindupMs: 420,          // wind-up before the throw
  voidTelegraphMs: 500, voidVanishMs: 1200, voidReturnMs: 400,
  bossHp: 560, bossScale: 2.0, // end boss: 2.0x, 560 HP
  deflectDamage: 30,           // slash-deflect a thrown line back at the boss
  meleeDamage: 10,             // close slash on the boss
  playerHp: 100, lineHitDamage: 10,
  guideGlide: 140 * SCALE
};

/* --- code-line sets (verbatim from REFERENCE_DIGEST.md §3) --- */
var CODE_SETS = {
  kotlin: [ // §3.1 — Kotlin / NULLPOINTER set (spec §6). THROWN BY DEFAULT.
    'val name: String? = null; println(name!!.length)',
    'user?.address?.street // one rung is missing',
    'lateinit var token: String // never initialised',
    'val x: String = null // the compiler said no — the villain cheats',
    'throw NullPointerException("it was never there")'
  ],
  nullpointer: [ // §3.2 — NULLPOINTER own set. ALTERNATE — flip CODE_SET to use.
    'if (null) { throw; }',
    'NullPointerException',
    'Cannot read properties of undefined',
    'items.map is not a function',
    'val name: String = null'
  ]
};
var CODE_SET = 'kotlin'; // 'kotlin' | 'nullpointer' — user to decide which the boss throws

/* --- narration text (preview3 canonical, REFERENCE_DIGEST.md §1.4 / §4.5) --- */
var NARRATION = [
  'In a world where code is power,\na great villain rises —\nNullPointer.',
  'He corrupts logic, breaks rules,\nand spreads chaos through\nthe land of Algorithms.'
];
var NARRATION_BOTTOM = 'And so, the Code Warriors shall rise…';

/* --- heroes (sheet lettering per hero — NOT all-CODE chests; see digest §7) --- */
var HEROES = [
  { id: 'coder',     name: 'The Coder',        svg: 'assets/characters/coder.svg',
    sprite: 'assets/sprites/hero/the-coder.png',
    stats: { HP: .62, ATK: .58, DEF: .45, SPEED: .95 },
    role: 'Run the code, read the error.' },
  { id: 'developer', name: 'The Developer',    svg: 'assets/characters/developer.svg',
    sprite: 'assets/sprites/hero/run.png',
    stats: { HP: .85, ATK: .9, DEF: .8, SPEED: .7 },
    role: 'Turn ideas into reality.' },
  { id: 'algorithm', name: 'The Algorithm',    svg: 'assets/characters/algorithm.svg',
    sprite: 'assets/sprites/hero/the-algorithm.png',
    stats: { HP: .7, ATK: .85, DEF: .6, SPEED: .8 },
    role: 'Plan before you swing.' },
  { id: 'wizard',    name: 'The Logic Wizard', svg: 'assets/characters/wizard.svg',
    sprite: 'assets/sprites/hero/the-logic-wizard.png',
    stats: { HP: .65, ATK: .95, DEF: .55, SPEED: .5 },
    role: 'Branch before you assume.' }
];
var LEVELS = { hero: 12, troops: 14, run: 15, boss: 12 }; // preview3 levels

/* --- URL params: deep links + deterministic freeze + seed --- */
var QS = new URLSearchParams(location.search);
var SCENE = (QS.get('scene') || 'hero').toLowerCase();
if (['hero', 'run', 'narrate', 'troops', 'boss'].indexOf(SCENE) < 0) SCENE = 'hero';
var FREEZE_T = QS.has('t') ? Math.max(0, parseFloat(QS.get('t')) || 0) : null;
var SEED = QS.has('seed') ? (parseInt(QS.get('seed'), 10) || 1) : 20261127;

/* --- seeded RNG (mulberry32) --- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var rng = mulberry32(SEED);

/* --- dom helpers --- */
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function showErr(msg) {
  var e = $('err'); e.classList.remove('hidden');
  e.textContent = 'TECHIEMAN error: ' + msg;
}

/* --- sprite auto-upgrade: real PNG (multiply-blended) replaces SVG when present --- */
var SPRITE_MAP = {
  developer: 'assets/sprites/hero/run.png',
  coder: 'assets/sprites/hero/the-coder.png',
  wizard: 'assets/sprites/hero/the-logic-wizard.png',
  algorithm: 'assets/sprites/hero/the-algorithm.png',
  guide: 'assets/sprites/guide/narrate.png',
  scamp: 'assets/sprites/nullpointer/scamps.png',
  skitter: 'assets/sprites/nullpointer/skitters.png',
  wisp: 'assets/sprites/nullpointer/wisps.png'
};
function upgradeFigure(img, key) {
  var png = SPRITE_MAP[key];
  if (!png || !img) return;
  var probe = new Image();
  probe.onload = function () { img.src = png; img.classList.add('sprite-png'); };
  probe.onerror = function () { /* missing PNG: SVG stays, silently */ };
  probe.src = png;
}

/* --- audio auto-upgrade: real MP3s only, silent otherwise, never synthesized --- */
var AUDIO_FILES = {
  theme: 'assets/audio/theme.mp3',
  roar: 'assets/audio/roar-nullpointer.mp3',
  rally: 'assets/audio/hero-rally.mp3',
  narration: 'assets/audio/narration-ep01.mp3',
  slash: 'assets/audio/sfx-slash.mp3',
  guard: 'assets/audio/sfx-guard.mp3',
  deflect: 'assets/audio/sfx-deflect.mp3',
  checkpoint: 'assets/audio/sfx-checkpoint.mp3'
};
var audioAvailable = {}, audioProbed = false, themePlaying = false;
function probeAudio() {
  if (audioProbed) return; audioProbed = true;
  Object.keys(AUDIO_FILES).forEach(function (k) {
    var a = new Audio();
    a.addEventListener('canplaythrough', function () { audioAvailable[k] = true; if (k === 'theme') playTheme(); });
    a.addEventListener('error', function () { audioAvailable[k] = false; });
    a.preload = 'auto'; a.src = AUDIO_FILES[k];
  });
}
function playTheme() {
  if (!audioAvailable.theme || themePlaying) return;
  try {
    var a = new Audio(AUDIO_FILES.theme); a.loop = true; a.volume = 0.5;
    var p = a.play(); if (p && p.catch) p.catch(function () {});
    themePlaying = true;
  } catch (e) { /* silent without audio */ }
}
function playSfx(key) {
  if (!audioAvailable[key]) return;
  try { var a = new Audio(AUDIO_FILES[key]); a.volume = 0.8; a.play().catch(function () {}); } catch (e) {}
}

/* --- input: keyboard + virtual joystick + skill buttons --- */
var keys = {};
var joy = { x: 0, y: 0, active: false };
var pressed = {}; // edge-triggered actions, consumed each frame
window.addEventListener('keydown', function (e) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(e.key) >= 0) e.preventDefault();
  if (!keys[e.key.toLowerCase()]) pressed[e.key.toLowerCase()] = true;
  keys[e.key.toLowerCase()] = true;
  probeAudio();
});
window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
window.addEventListener('pointerdown', probeAudio, { once: true });
function keyDown() {
  for (var i = 0; i < arguments.length; i++) if (keys[arguments[i]]) return true;
  return false;
}
function wasPressed() {
  for (var i = 0; i < arguments.length; i++) if (pressed[arguments[i]]) return true;
  return false;
}
function clearPressed() { pressed = {}; }

/* --- orientation: auto-landscape — rotate the stage on portrait, NO prompt --- */
function fitStage() {
  var vw = window.innerWidth, vh = window.innerHeight;
  var wrap = $('stage-wrap'), stage = $('stage');
  if (vh > vw) { // portrait phone: rotate 90deg so the 16:9 game fills the screen
    var s = Math.min(vw / 720, vh / 1280);
    wrap.style.width = vh + 'px'; wrap.style.height = vw + 'px';
    stage.style.transform = 'rotate(90deg) scale(' + s + ')';
  } else {
    var s2 = Math.min(vw / 1280, vh / 720);
    wrap.style.width = (1280 * s2) + 'px'; wrap.style.height = (720 * s2) + 'px';
    stage.style.transform = 'scale(' + s2 + ')';
  }
}
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', function () { setTimeout(fitStage, 60); });

/* --- FX canvas: flame sparks ONLY (core #FFE45C / mid #FF9F1C / edge #FF5A00) --- */
var fx = null, fctx = null;
var particles = [];
function spawnSparks(x, y, n, spread) {
  for (var i = 0; i < n; i++) {
    var a = rng() * Math.PI * 2, sp = 60 + rng() * 260;
    particles.push({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
      life: 0.35 + rng() * 0.4, age: 0, r: 2 + rng() * 4,
      c: ['#FFE45C', '#FF9F1C', '#FF5A00'][i % 3]
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}
/* Fire-trail burst at the runner's feet: a dense orange flame cluster
 * (flame colours ONLY: core #FFE45C / mid #FF9F1C / edge #FF5A00), big
 * embers that rise and fade — not the old few tiny dots. */
function spawnTrailFlame(x, y) {
  for (var i = 0; i < 9; i++) {
    particles.push({
      x: x + (rng() - 0.5) * 70, y: y - rng() * 14,
      vx: (rng() - 0.5) * 220, vy: -40 - rng() * 180,
      life: 0.45 + rng() * 0.45, age: 0, r: 5 + rng() * 8,
      c: ['#FFE45C', '#FF9F1C', '#FF5A00', '#FF9F1C'][i % 4]
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}
/* Road streaks: grey debris/scenery rushing TOWARD the viewer from the
 * vanishing point (Level Run front view). Grayscale only — never flame. */
function spawnStreak() {
  var x = 640 + (rng() - 0.5) * 220, y = 470 + rng() * 60;
  particles.push({
    x: x, y: y, vx: (x - 640) * 2.6, vy: 300 + rng() * 260,
    life: 0.45 + rng() * 0.2, age: 0, r: 2 + rng() * 3,
    c: ['#d8d8d8', '#9a9a9a', '#ffffff'][Math.floor(rng() * 3)]
  });
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}
function updateFx(dt) {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i]; p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
  }
}
function drawFx() {
  if (!fctx) return;
  fctx.clearRect(0, 0, W, H);
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i], a = 1 - p.age / p.life;
    fctx.globalAlpha = a; fctx.fillStyle = p.c;
    fctx.beginPath(); fctx.arc(p.x, p.y, p.r * a + 0.6, 0, Math.PI * 2); fctx.fill();
  }
  fctx.globalAlpha = 1;
}

/* --- HUD (preview3) --- */
var PORTRAIT_SVG = '<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#1a1a1a"/>' +
  '<path d="M20 34 L14 18 L24 24 L26 8 L32 20 L40 6 L42 22 L52 14 L48 30 L56 26 L46 38 Q32 44 20 34 Z" fill="#000"/>' +
  '<ellipse cx="32" cy="38" rx="14" ry="15" fill="#050505"/>' +
  '<ellipse cx="26" cy="38" rx="3.4" ry="2" fill="#fff"/><ellipse cx="39" cy="38" rx="3.4" ry="2" fill="#fff"/>' +
  '<path d="M18 52 L46 52 L44 64 L20 64 Z" fill="#050505"/></svg>';
var MINIMAP_SVG = '<svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="52" fill="#262626"/>' +
  '<path d="M14 78 L40 54 L54 60 L74 34 L94 30" stroke="#555" stroke-width="3" fill="none"/>' +
  '<path d="M20 40 L46 52 L70 70 L92 78" stroke="#444" stroke-width="3" fill="none"/>' +
  '<circle cx="54" cy="60" r="5" fill="#e8e8e8"/><circle cx="74" cy="34" r="4" fill="#ff2a2a"/>' +
  '<path d="M70 30 L78 38 M78 30 L70 38" stroke="#ff2a2a" stroke-width="2.5"/>' +
  '<rect x="50" y="20" width="8" height="8" fill="#ffd75e" transform="rotate(45 54 24)"/></svg>';

var SKILL_ICONS = {
  slash: '<svg viewBox="0 0 34 34"><path d="M6 28 L26 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M26 8 L30 4 L28 12 Z" fill="#fff"/><path d="M8 30 L14 24" stroke="#bbb" stroke-width="2"/></svg>',
  guard: '<svg viewBox="0 0 34 34"><path d="M17 4 L28 8 L28 17 Q28 26 17 30 Q6 26 6 17 L6 8 Z" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 17 L16 21 L23 12" stroke="#fff" stroke-width="2.5" fill="none"/></svg>',
  nova: '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="5" fill="#fff"/><path d="M17 3 L17 9 M17 25 L17 31 M3 17 L9 17 M25 17 L31 17 M7 7 L11 11 M23 23 L27 27 M27 7 L23 11 M11 23 L7 27" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>',
  bullet: '<svg viewBox="0 0 34 34"><path d="M8 26 L24 10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M20 8 L26 6 L24 12 Z" fill="#fff"/><text x="8" y="30" font-family="monospace" font-size="8" fill="#ddd">if</text></svg>'
};

function buildHUD(opts) {
  // opts: {label, level, showBoss, bossName, bossHpPct, objective, combo, skills:'round'|'qer'|null, joystick:bool, pause:bool}
  var hud = $('hud'); hud.innerHTML = '';
  var tl = el('div', 'hud-tl');
  if (opts.label) tl.appendChild(el('div', 'brush', opts.label));
  var row = el('div', 'hud-portrait-row');
  row.appendChild(el('div', 'portrait', PORTRAIT_SVG));
  var col = el('div');
  col.appendChild(el('div', 'hud-level', 'Lv. ' + (opts.level || 12)));
  var hp = el('div', 'bar'); hp.innerHTML = '<i style="width:' + (opts.hpPct != null ? opts.hpPct : 100) + '%"></i>';
  col.appendChild(hp);
  var blue = el('div', 'bar blue'); blue.innerHTML = '<i style="width:82%"></i>';
  col.appendChild(blue);
  col.appendChild(el('div', 'weapon-line', '🖊 Pen-Staff ∞'));
  row.appendChild(col); tl.appendChild(row); hud.appendChild(tl);
  if (opts.showBoss) {
    var tc = el('div', 'hud-tc');
    tc.appendChild(el('div', 'boss-name', opts.bossName || 'NullPointer'));
    var bb = el('div', 'bar boss'); bb.id = 'boss-bar';
    bb.innerHTML = '<i id="boss-bar-fill" style="width:' + (opts.bossHpPct != null ? opts.bossHpPct : 100) + '%"></i>';
    tc.appendChild(bb); hud.appendChild(tc);
  }
  var tr = el('div', 'hud-tr');
  tr.appendChild(el('div', 'minimap', MINIMAP_SVG));
  var gear = el('button', 'gear', '⚙'); gear.setAttribute('aria-label', 'Settings');
  gear.addEventListener('click', function () { togglePause(); });
  tr.appendChild(gear); hud.appendChild(tr);
  if (opts.objective) hud.appendChild(el('div', 'objective', opts.objective));
  if (opts.combo) {
    var c = el('div', 'combo'); c.id = 'combo';
    c.innerHTML = '<span id="combo-n">' + opts.combo + '</span> HIT COMBO!<small>KEEP IT GOING</small>';
    hud.appendChild(c);
  }
  if (opts.joystick) hud.appendChild(buildJoystick());
  if (opts.skills === 'round') hud.appendChild(buildSkillsRound());
  if (opts.skills === 'qer') hud.appendChild(buildSkillsQer());
  if (opts.pause) {
    var p = el('button', 'gear', '⏸');
    p.style.cssText = 'position:absolute;top:14px;right:140px;pointer-events:auto;';
    p.setAttribute('aria-label', 'Pause');
    p.addEventListener('click', function () { togglePause(); });
    hud.appendChild(p);
  }
}
function buildJoystick() {
  var j = el('div', 'joystick'); j.id = 'joystick';
  var knob = el('div', 'knob'); j.appendChild(knob);
  var move = function (e) {
    var r = j.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    var len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    joy.x = dx; joy.y = dy; joy.active = true;
    knob.style.transform = 'translate(calc(-50% + ' + (dx * 34) + 'px), calc(-50% + ' + (dy * 34) + 'px))';
  };
  var end = function () {
    joy.x = 0; joy.y = 0; joy.active = false;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  j.addEventListener('pointerdown', function (e) { j.setPointerCapture(e.pointerId); move(e); });
  j.addEventListener('pointermove', function (e) { if (joy.active) move(e); });
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
  return j;
}
function skillButton(key, icon, label, action) {
  var b = el('button', 'skill', SKILL_ICONS[icon] + '<span class="key">' + label + '</span>');
  b.setAttribute('aria-label', key);
  b.addEventListener('pointerdown', function (e) { e.preventDefault(); action(); });
  return b;
}
function buildSkillsRound() {
  var g = el('div', 'skills');
  g.appendChild(skillButton('slash', 'slash', 'J', function () { pressed['j'] = true; }));
  g.appendChild(skillButton('guard', 'guard', 'S', function () { keys['s'] = true; setTimeout(function () { keys['s'] = false; }, 350); }));
  g.appendChild(skillButton('nova', 'nova', 'Q', function () { pressed['q'] = true; }));
  var bullet = skillButton('bullet', 'bullet', 'K', function () { pressed['k'] = true; });
  bullet.classList.add('active'); // gold-ringed active button, per preview3
  g.appendChild(bullet);
  return g;
}
function buildSkillsQer() {
  var g = el('div', 'qer');
  [['Q', 'nova', 'q'], ['E', 'guard', 'e'], ['R', 'slash', 'r']].forEach(function (t) {
    var b = el('button', 'skill', '<span class="glyph">' + SKILL_ICONS[t[1]] + '</span><span class="key">' + t[0] + '</span>');
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); pressed[t[2]] = true; if (t[1] === 'guard') { keys['s'] = true; setTimeout(function () { keys['s'] = false; }, 350); } });
    g.appendChild(b);
  });
  return g;
}

/* --- pause --- */
var paused = false;
function togglePause() {
  paused = !paused;
  var b = $('banner');
  if (paused) { b.textContent = 'PAUSED'; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

/* --- shared scene helpers --- */
function setBackdrop(file) { $('backdrop').src = 'assets/backdrops/' + file; }
function clearWorld() { $('world').innerHTML = ''; $('banner').classList.add('hidden'); $('subtitle').classList.add('hidden'); }
function setBanner(text, sub) {
  var b = $('banner');
  b.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
  b.classList.remove('hidden');
}
function setSubtitle(html) {
  var s = $('subtitle'); s.innerHTML = html; s.classList.remove('hidden');
}
function floatText(x, y, text, cls) {
  var f = el('div', 'float-text ' + (cls || ''), text);
  f.style.left = x + 'px'; f.style.top = y + 'px';
  $('world').appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1100);
}
function goScene(name) {
  history.replaceState(null, '', '?scene=' + name);
  location.reload();
}

/* =====================================================================
 * SCENE 1 — HERO SELECT (preview3 bottom-left)
 * Four heroes in a row on the ruined-city dais; the Developer focused on
 * the glowing gold platform. Sheet lettering per hero (CODE / DEBUG /
 * LOGIC / ALGO) — the all-CODE-chest question is still open with the user.
 * FRONT VIEW (verified 2026-11-27): all four face the viewer, chest
 * lettering + faces visible; no profile poses. This scene needed no
 * rework — the correction only confirmed it.
 * ===================================================================== */
var heroScene = {
  selected: 1, // The Developer, second from the left, gold-lit — per preview3
  init: function () {
    setBackdrop('dais.svg');
    clearWorld();
    $('stage').className = 'scene-hero';
    buildHUD({ label: null, level: null, joystick: false, skills: null });
    $('hud').innerHTML = ''; // hero select has no combat HUD
    var world = $('world');
    var title = el('div', 'select-title');
    title.appendChild(el('div', 'brush', 'Select Your Hero'));
    world.appendChild(title);
    var tl = el('div', 'hud-tl');
    tl.appendChild(el('div', 'brush', 'Hero Select'));
    world.appendChild(tl);
    // hero row
    var row = el('div', 'hero-row');
    HEROES.forEach(function (h, i) {
      var slot = el('div', 'hero-slot' + (i === heroScene.selected ? ' focused' : ' dim'));
      slot.dataset.index = i;
      var img = el('img'); img.src = h.svg; img.alt = h.name; img.draggable = false;
      upgradeFigure(img, h.id);
      slot.appendChild(img);
      if (i === heroScene.selected) slot.appendChild(el('div', 'gold-platform'));
      slot.addEventListener('click', function () { heroScene.select(i); });
      row.appendChild(slot);
    });
    world.appendChild(row);
    // name plate under the focused hero
    var plate = el('div', 'name-plate'); plate.id = 'hero-name';
    plate.textContent = HEROES[heroScene.selected].name;
    world.appendChild(plate);
    // stat panel (preview1): HP / ATK / DEF / SPEED + tagline
    var sp = el('div', 'stat-panel'); sp.id = 'stat-panel';
    sp.innerHTML = '<div class="row"><span class="lab">HP</span><span class="track"><i id="st-hp"></i></span></div>' +
      '<div class="row"><span class="lab">ATK</span><span class="track"><i id="st-atk"></i></span></div>' +
      '<div class="row"><span class="lab">DEF</span><span class="track"><i id="st-def"></i></span></div>' +
      '<div class="row"><span class="lab">SPEED</span><span class="track"><i id="st-spd"></i></span></div>' +
      '<div class="tagline" id="st-tag"></div>';
    world.appendChild(sp);
    heroScene.paintStats();
    // chevrons
    var cl = el('button', 'chev left', '‹'); cl.setAttribute('aria-label', 'Previous hero');
    cl.addEventListener('click', function () { heroScene.select((heroScene.selected + HEROES.length - 1) % HEROES.length); });
    var cr = el('button', 'chev right', '›'); cr.setAttribute('aria-label', 'Next hero');
    cr.addEventListener('click', function () { heroScene.select((heroScene.selected + 1) % HEROES.length); });
    world.appendChild(cl); world.appendChild(cr);
    // pad controls (preview3 bottom centre)
    var pc = el('div', 'pad-controls');
    pc.innerHTML = '<span><b>A</b>Select</span><span><b>B</b>Back</span><span><b>Y</b>Details</span>';
    pc.addEventListener('click', function () { heroScene.confirm(); });
    world.appendChild(pc);
  },
  paintStats: function () {
    var h = HEROES[heroScene.selected];
    $('st-hp').style.width = Math.round(h.stats.HP * 100) + '%';
    $('st-atk').style.width = Math.round(h.stats.ATK * 100) + '%';
    $('st-def').style.width = Math.round(h.stats.DEF * 100) + '%';
    $('st-spd').style.width = Math.round(h.stats.SPEED * 100) + '%';
    $('st-tag').textContent = '"' + h.role + '"';
  },
  select: function (i) {
    heroScene.selected = i;
    var slots = document.querySelectorAll('.hero-slot');
    slots.forEach(function (s, j) {
      s.classList.toggle('focused', j === i);
      s.classList.toggle('dim', j !== i);
      var gp = s.querySelector('.gold-platform');
      if (j === i && !gp) s.appendChild(el('div', 'gold-platform'));
      if (j !== i && gp) s.removeChild(gp);
    });
    $('hero-name').textContent = HEROES[i].name;
    heroScene.paintStats();
  },
  confirm: function () { goScene('run'); },
  update: function (dt) {
    if (wasPressed('arrowleft', 'a')) heroScene.select((heroScene.selected + HEROES.length - 1) % HEROES.length);
    if (wasPressed('arrowright', 'd')) heroScene.select((heroScene.selected + 1) % HEROES.length);
    if (wasPressed('enter', ' ')) heroScene.confirm();
    if (wasPressed('y')) {
      var sp = $('stat-panel'); if (sp) sp.classList.toggle('hidden');
    }
  },
  render: function () {}
};

/* The CHECKPOINT gate as a DOM element (not painted in road.svg): it starts
 * far/small at the vanishing point and grows toward the viewer as the hero
 * runs — the road, gate and scenery scroll TOWARD the camera. */
var GATE_SVG = '<svg viewBox="0 0 340 300"><defs><radialGradient id="gateGlowDom" cx=".5" cy=".5" r=".5">' +
  '<stop offset="0" stop-color="#ffffff" stop-opacity=".8"/><stop offset=".6" stop-color="#e8e8e8" stop-opacity=".28"/>' +
  '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>' +
  '<ellipse cx="170" cy="292" rx="150" ry="14" fill="#0f0f0f" opacity=".4"/>' +
  '<path d="M40 292 L40 130 Q40 40 170 36 Q300 40 300 130 L300 292 L262 292 L262 140 Q262 82 170 80 Q78 82 78 140 L78 292 Z" fill="#6b6b6b" stroke="#2a2a2a" stroke-width="3"/>' +
  '<path d="M70 292 L70 150 Q70 105 170 102 Q270 105 270 150 L270 292 L232 292 L232 158 Q232 128 170 126 Q108 128 108 158 L108 292 Z" fill="#3f3f3f" stroke="#222" stroke-width="2"/>' +
  '<ellipse cx="170" cy="190" rx="78" ry="90" fill="url(#gateGlowDom)"/>' +
  /* CHECKPOINT lettering sits ABOVE the arch (y 26), never behind the hero:
     at the near-gate freeze the hero's legs struck through the K when the
     text sat at y 262 inside the arch opening. */
  '<text x="170" y="26" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="3" fill="#e8e8e8" stroke="#111" stroke-width="1">CHECKPOINT</text>' +
  /* diamond/rune emblem ON the arch band (y 64, on the stone between the
     outer and inner arch tops) — the old centre-of-arch emblem was hidden
     behind the hero's head/chest at the near-gate freeze. */
  '<g transform="translate(170,64)"><polygon points="0,-24 18,0 0,24 -18,0" fill="#e8e8e8" stroke="#111" stroke-width="2.5"/>' +
  '<polygon points="0,-13 9,0 0,13 -9,0" fill="#111"/><polygon points="0,-6 4,0 0,6 -4,0" fill="#e8e8e8"/></g></svg>';

/* =====================================================================
 * SCENE 2 — LEVEL RUN (preview3 bottom-right) — FRONT VIEW (reworked
 * 2026-11-27 per the user's correction; preview3 shows the hero in
 * profile sprinting left→right — the user EXPLICITLY overrode that to
 * front view, so this scene no longer matches the panel's orientation).
 * The hero runs IN PLACE TOWARD the camera (front view, CODE chest +
 * face visible, developer-run.svg) while the road, checkpoint gate and
 * scenery scroll TOWARD the viewer. The gate starts far/small at the
 * vanishing point and grows as he approaches; the distance marker counts
 * down live from 128 m; on arrival the "✓ Checkpoint Reached" banner
 * shows (preview2 element, kept as the arrival state) and the run hands
 * off to the Narration Moment.
 * ===================================================================== */
var runScene = {
  distM: 128, pxPerM: 20, heroX: 520, y: GROUND_Y, vy: 0, bob: 0,
  arrived: false, arriveT: 0, sparkT: 0, streakT: 0,
  heroEl: null, markerEl: null, gateEl: null, shadowEl: null,
  init: function () {
    setBackdrop('road.svg');
    clearWorld();
    $('stage').className = 'scene-run';
    buildHUD({ label: 'Level Run', level: LEVELS.run, objective: 'Reach the Checkpoint', joystick: true, skills: 'round' });
    var world = $('world');
    // the checkpoint gate, far/small at the vanishing point (grows in render)
    var gate = el('div', 'run-gate'); gate.id = 'run-gate';
    gate.innerHTML = GATE_SVG;
    world.appendChild(gate);
    runScene.gateEl = gate;
    // hero, CENTRED, running toward the camera — front view, never profile
    var hero = el('div', 'fig'); hero.id = 'run-hero';
    hero.style.cssText = 'left:520px;top:' + (GROUND_Y - 320) + 'px;width:240px;height:320px;';
    var img = el('img'); img.src = 'assets/characters/developer-run.svg'; img.alt = 'The Developer, running toward the camera';
    upgradeFigure(img, 'developer');
    hero.appendChild(img); world.appendChild(hero);
    runScene.heroEl = hero;
    var shadow = el('div', 'hero-shadow'); shadow.id = 'run-shadow';
    shadow.style.cssText = 'left:550px;top:648px;width:180px;height:20px;';
    world.appendChild(shadow);
    runScene.shadowEl = shadow;
    // distance marker floats above the gate; its position tracks the gate
    var marker = el('div', 'gate-marker'); marker.id = 'gate-marker';
    marker.innerHTML = '<span class="diamond">◆</span>Checkpoint<br>( <span id="dist-n">128</span> m )';
    world.appendChild(marker);
    runScene.markerEl = marker;
  },
  update: function (dt) {
    if (runScene.arrived) {
      runScene.arriveT += dt;
      if (runScene.arriveT > 2.5 && FREEZE_T == null) goScene('narrate');
      return;
    }
    runScene.bob += dt * 14;
    // run in place toward the camera: left/right (or joystick) only steers
    // the hero a little across the road — he never runs sideways.
    var steer = 0;
    if (keyDown('arrowleft', 'a') || joy.x < -0.25) steer -= 1;
    if (keyDown('arrowright', 'd') || joy.x > 0.25) steer += 1;
    runScene.heroX = Math.max(440, Math.min(600, runScene.heroX + steer * 260 * dt));
    var speed = PHYS.heroRun; // auto-run; holding ↑ adds a small push
    if (keyDown('arrowup')) speed *= 1.15;
    runScene.distM -= (speed * dt) / runScene.pxPerM;
    if (runScene.distM <= 0) {
      runScene.distM = 0; runScene.arrived = true; runScene.arriveT = 0;
      setBanner('✓ Checkpoint Reached', 'The road to Kotlin Kingdom is open.');
      playSfx('checkpoint');
      spawnSparks(runScene.heroX + 120, GROUND_Y - 40, 26);
    }
    var dn = $('dist-n'); if (dn) dn.textContent = Math.ceil(runScene.distM);
    // jump — toward the camera (he grows slightly while airborne, see render)
    if ((wasPressed('w', ' ') || joy.y < -0.6) && runScene.vy === 0) runScene.vy = PHYS.heroJump;
    if (runScene.vy !== 0 || runScene.y < GROUND_Y) {
      runScene.vy += PHYS.heroGrav * dt;
      runScene.y += runScene.vy * dt;
      if (runScene.y >= GROUND_Y) { runScene.y = GROUND_Y; runScene.vy = 0; spawnSparks(runScene.heroX + 120, GROUND_Y, 6); }
    }
    // fire burst at the hero's feet while sprinting (flame ONLY here)
    runScene.sparkT -= dt;
    if (runScene.sparkT <= 0) {
      runScene.sparkT = 0.09;
      spawnTrailFlame(runScene.heroX + 120, GROUND_Y - 6);
    }
    // scenery rushes toward the viewer: grey streaks out of the vanishing point
    runScene.streakT -= dt;
    if (runScene.streakT <= 0) {
      runScene.streakT = 0.09;
      spawnStreak(); spawnStreak();
    }
    updateFx(dt);
  },
  render: function () {
    var h = runScene.heroEl; if (!h) return;
    // running in place toward the viewer: vertical bob + slight side rock
    var bobY = Math.abs(Math.sin(runScene.bob)) * -12;
    var rock = Math.sin(runScene.bob) * 3;
    var airK = (GROUND_Y - runScene.y) / 220; // 0 on the ground, ~0.9 at jump apex
    var sc = 1 + airK * 0.12; // jumping toward the camera: he grows slightly
    h.style.left = runScene.heroX + 'px';
    h.style.top = (runScene.y - 320 + bobY) + 'px';
    h.style.transform = 'rotate(' + rock + 'deg) scale(' + sc.toFixed(3) + ')';
    if (runScene.shadowEl) {
      runScene.shadowEl.style.left = (runScene.heroX + 30) + 'px';
      runScene.shadowEl.style.opacity = String(0.55 - airK * 0.3);
    }
    // the gate starts far/small at the vanishing point and grows toward the
    // viewer as the distance counts down — the road scrolls toward the camera
    var p = 1 - runScene.distM / 128; // 0 far -> 1 at the gate
    var s = 0.32 + p * 1.25;
    if (runScene.gateEl) runScene.gateEl.style.transform = 'translateX(-50%) scale(' + s.toFixed(3) + ')';
    if (runScene.markerEl) {
      // anchored to the gate's upper-right so it never covers the hero's
      // face/chest (he runs dead-centre, straight at the camera)
      runScene.markerEl.style.left = (640 + 170 * s + 24) + 'px';
      runScene.markerEl.style.top = (560 - 150 * s - 20) + 'px';
    }
    if (runScene.arrived && runScene.markerEl) runScene.markerEl.innerHTML = '<span class="diamond">◆</span>Checkpoint<br>Reached ✓';
    drawFx();
  }
};

/* =====================================================================
 * SCENE 3 — NARRATION MOMENT (preview3 bottom-centre)
 * Split frame: story text on the left over the ruined city, the Guide on
 * the right with the glowing gold book. Canonical preview3 text.
 * Guide beat order never changes: Narration → Phone → Map → Quiz → handoff.
 * FRONT VIEW (verified 2026-11-27): the Guide already faces the camera
 * (3/4 front, glowing book visible) — kept as-is; only the "Narrator:"
 * subtitle label was added to the bottom line.
 * ===================================================================== */
var narrateScene = {
  typed: 0, full: '', done: false, guideEl: null,
  init: function () {
    setBackdrop('castle.svg');
    clearWorld();
    $('stage').className = 'scene-narrate';
    buildHUD({ label: null, level: null, joystick: false, skills: null });
    $('hud').innerHTML = '';
    var world = $('world');
    var tl = el('div', 'hud-tl');
    tl.appendChild(el('div', 'brush', 'Narration Moment'));
    world.appendChild(tl);
    var panel = el('div', 'narr-panel'); panel.id = 'narr-panel';
    panel.innerHTML = '<p id="narr-p1"></p><p id="narr-p2"></p>';
    world.appendChild(panel);
    var guide = el('div', 'fig'); guide.id = 'narr-guide';
    guide.style.cssText = 'right:70px;top:150px;width:300px;height:470px;';
    var img = el('img'); img.src = 'assets/characters/guide.svg'; img.alt = 'The Guide';
    upgradeFigure(img, 'guide');
    guide.appendChild(img); world.appendChild(guide);
    narrateScene.guideEl = guide;
    narrateScene.full = NARRATION.join('\n\n');
    var bottom = el('div', 'narr-bottom'); bottom.id = 'narr-bottom';
    bottom.innerHTML = '<span class="narr-who">Narrator:</span> ' + NARRATION_BOTTOM;
    world.appendChild(bottom);
    var cont = el('button', 'narr-continue', '<b>A</b>Continue');
    cont.addEventListener('click', function () { narrateScene.next(); });
    world.appendChild(cont);
    if (FREEZE_T != null) narrateScene.typed = narrateScene.full.length;
  },
  next: function () {
    if (!narrateScene.done) { narrateScene.typed = narrateScene.full.length; narrateScene.done = true; narrateScene.paint(); return; }
    goScene('troops');
  },
  paint: function () {
    var t = narrateScene.full.slice(0, Math.floor(narrateScene.typed));
    var parts = t.split('\n\n');
    var p1 = $('narr-p1'), p2 = $('narr-p2');
    if (p1) p1.innerHTML = (parts[0] || '').replace(/\n/g, '<br>');
    if (p2) p2.innerHTML = (parts[1] || '').replace(/\n/g, '<br>');
  },
  update: function (dt) {
    if (!narrateScene.done) {
      narrateScene.typed += dt * 55; // ~55 chars/s typewriter
      if (narrateScene.typed >= narrateScene.full.length) { narrateScene.typed = narrateScene.full.length; narrateScene.done = true; }
      narrateScene.paint();
    }
    if (wasPressed('enter', ' ', 'a')) narrateScene.next();
  },
  render: function () {
    if (narrateScene.guideEl) {
      var t = performance.now() / 1000;
      narrateScene.guideEl.style.transform = 'translateY(' + Math.sin(t * 0.9) * 5 + 'px)';
    }
  }
};

/* =====================================================================
 * SCENE 4 — TROOP ENTRANCE (preview3 top-right) — FRONT VIEW (reworked
 * 2026-11-27 per the user's correction; preview3 shows the hero from
 * BEHIND walking toward the golem — the user EXPLICITLY overrode that to
 * front view, so this scene no longer matches the panel's orientation).
 * The hero faces the camera in the FOREGROUND (front view, CODE chest
 * visible); the black ink pool is BEHIND him (mid-ground); the colossal
 * LEAK golem rises in the BACKGROUND; NULLPOINTER's troops rise ONE BY
 * ONE from the pool behind/around him — the entrance director never puts
 * them all on screen at once. The back-view hero (developer-back.svg)
 * is DELETED — no back-view hero exists anywhere in the game.
 * Troops: SCAMP / SKITTER / WISP waves (REFERENCE_DIGEST.md §5.1).
 * ===================================================================== */
var troopsScene = {
  directorT: 0, nextRise: 0.6, risen: 0, heroEl: null,
  sequence: [ // spread across the pool edge, feet ON the ink line (y ~610),
    // bodies standing UP out of the pool against the grey ground/sky —
    // never sunk in the black ink. Larger than before so each troop reads.
    { key: 'scamp',   name: 'SCAMP',   x: 470,  w: 135, h: 95 },
    { key: 'skitter', name: 'SKITTER', x: 605,  w: 135, h: 95 },
    { key: 'wisp',    name: 'WISP',    x: 740,  w: 135, h: 108 },
    { key: 'scamp',   name: 'SCAMP',   x: 875,  w: 135, h: 95 },
    { key: 'skitter', name: 'SKITTER', x: 1005, w: 135, h: 95 },
    { key: 'wisp',    name: 'WISP',    x: 1130, w: 135, h: 108 }
  ],
  init: function () {
    setBackdrop('inkpool.svg');
    clearWorld();
    $('stage').className = 'scene-troops';
    buildHUD({ label: 'Troop Entrance', level: LEVELS.troops, objective: 'Defeat the LEAK Troop', joystick: true, skills: 'round' });
    var world = $('world');
    // ink pool sheen
    world.appendChild(el('div', 'ink-pool'));
    // LEAK golem — towers over the right two-thirds
    var leak = el('div', 'fig'); leak.id = 'leak-golem';
    leak.style.cssText = 'right:60px;top:60px;width:430px;height:530px;';
    var limg = el('img'); limg.src = 'assets/characters/leak.svg'; limg.alt = 'LEAK';
    leak.appendChild(limg);
    leak.appendChild(el('div', 'hpbar', '<i style="width:100%"></i>'));
    leak.appendChild(el('div', 'tag', 'LEAK — MEMORYLEAK TROOP'));
    world.appendChild(leak);
    // hero FRONT VIEW, foreground, facing the camera — the ink pool is
    // behind him (mid-ground) and the LEAK golem towers in the background.
    var hero = el('div', 'fig'); hero.id = 'troops-hero';
    hero.style.cssText = 'left:150px;top:' + (GROUND_Y - 320) + 'px;width:240px;height:320px;';
    var himg = el('img'); himg.src = 'assets/characters/developer.svg'; himg.alt = 'The Developer, facing the camera';
    upgradeFigure(himg, 'developer');
    hero.appendChild(himg); world.appendChild(hero);
    troopsScene.heroEl = hero;
    var shadow = el('div', 'hero-shadow');
    shadow.style.cssText = 'left:175px;top:648px;width:190px;height:20px;';
    world.appendChild(shadow);
    var hint = el('div', 'rise-hint'); hint.id = 'rise-hint';
    hint.textContent = 'Something is rising from the ink…';
    world.appendChild(hint);
  },
  riseOne: function (spec) {
    var f = el('div', 'fig risen'); f.dataset.risen = '1';
    // feet stand ON the pool edge (y ~590), rising out of the ink — never sunk
    f.style.cssText = 'left:' + spec.x + 'px;top:' + (590 - spec.h) + 'px;width:' + spec.w + 'px;height:' + spec.h + 'px;opacity:0;';
    var img = el('img'); img.src = 'assets/characters/' + spec.key + '.svg'; img.alt = spec.name;
    upgradeFigure(img, spec.key);
    f.appendChild(img);
    f.appendChild(el('div', 'hpbar', '<i style="width:100%"></i>'));
    f.appendChild(el('div', 'tag', spec.name));
    $('world').appendChild(f);
    // rise animation: out of the pool over 0.9 s
    var start = performance.now();
    var step = function () {
      var k = Math.min(1, (performance.now() - start) / 900);
      f.style.opacity = String(k);
      f.style.transform = 'translateY(' + ((1 - k) * 70) + 'px)';
      if (k < 1 && FREEZE_T == null) requestAnimationFrame(step);
      else { f.style.opacity = '1'; f.style.transform = 'translateY(0)'; }
    };
    if (FREEZE_T != null) { f.style.opacity = '1'; f.style.transform = 'translateY(0)'; }
    else step();
  },
  update: function (dt) {
    troopsScene.directorT += dt;
    if (troopsScene.risen < troopsScene.sequence.length && troopsScene.directorT >= troopsScene.nextRise) {
      troopsScene.riseOne(troopsScene.sequence[troopsScene.risen]);
      troopsScene.risen++;
      troopsScene.nextRise = troopsScene.directorT + 1.4; // one by one, never all at once
      if (troopsScene.risen >= troopsScene.sequence.length) {
        var hint = $('rise-hint'); if (hint) hint.textContent = 'The ink army stands. Defeat the LEAK Troop.';
      }
    }
    // hero stands his ground in the foreground, facing the camera — idle
    // bob only; he does not walk away from the viewer toward the golem.
    if (wasPressed('enter', ' ')) goScene('boss');
  },
  render: function () {
    if (troopsScene.heroEl) {
      troopsScene.heroEl.style.transform = 'translateY(' + Math.abs(Math.sin(performance.now() / 260)) * -4 + 'px)';
    }
  }
};

/* =====================================================================
 * SCENE 5 — BOSS FIGHT vs NULLPOINTER (preview3 top-left) — FRONT VIEW
 * (strengthened 2026-11-27 per the user's correction). The hero stands
 * LEFT-FOREGROUND in 3/4 FRONT view (CODE chest + face visible, sword
 * extended toward the boss, facing camera-right) — never profile, never
 * back-to-camera; his facing is LOCKED toward the boss (moving left does
 * not flip him). NULLPOINTER fills the right half, facing the hero/camera.
 * End boss: 2.0x, 560 HP. He holds real code lines visibly (chips on his
 * cape + raised hand) BEFORE throwing them as paper-chip projectiles.
 * Player: dodge, hold GUARD (S / ↓) for the green circle, or slash a line
 * mid-flight to deflect it back for 30 damage. VOID GRAB on a timer.
 * ===================================================================== */
var bossScene = {
  hero: null, boss: null, projectiles: [], heroEl: null, bossEl: null,
  guardEl: null, heldEl: null, chipsEl: null, arcEl: null,
  bossState: 'idle', stateT: 0, throwIdx: 0, combo: 0, comboT: 0,
  novaUsed: false, novaT: 0, voidT: 14, voidPhase: null, voidPhaseT: 0,
  over: false, slashT: 0, slashCd: 0, bob: 0,
  init: function () {
    setBackdrop('arena.svg');
    clearWorld();
    $('stage').className = 'scene-boss';
    buildHUD({ label: 'Boss Fight', level: LEVELS.boss, showBoss: true, bossName: 'NullPointer',
      bossHpPct: 100, objective: 'Defeat NullPointer', joystick: true, skills: 'round', pause: true });
    var world = $('world');
    // hero, LEFT-FOREGROUND, 3/4 front view — CODE chest + face visible,
    // sword extended toward the boss (camera-right)
    var hero = el('div', 'fig'); hero.id = 'boss-hero';
    hero.style.cssText = 'left:110px;top:' + (GROUND_Y - 300) + 'px;width:230px;height:300px;';
    var himg = el('img'); himg.src = 'assets/characters/developer.svg'; himg.alt = 'The Developer';
    upgradeFigure(himg, 'developer');
    hero.appendChild(himg);
    hero.appendChild(el('div', 'hpbar hero-hp', '<i id="hero-hp-fill" style="width:100%"></i>'));
    world.appendChild(hero);
    bossScene.heroEl = hero;
    // guard circle (green ONLY here)
    var guard = el('div', 'guard-ring hidden'); guard.id = 'guard-ring';
    world.appendChild(guard);
    bossScene.guardEl = guard;
    // fiery slash arc (flame ONLY here + dodge trail): shown during a slash
    var arc = el('div', 'slash-arc'); arc.id = 'slash-arc';
    arc.innerHTML = '<svg viewBox="0 0 320 180"><path d="M30 160 Q 160 20 290 70" fill="none" stroke="#FF5A00" stroke-width="16" opacity=".45" stroke-linecap="round"/><path d="M30 160 Q 160 20 290 70" fill="none" stroke="#FF9F1C" stroke-width="9" stroke-linecap="round"/><path d="M30 160 Q 160 20 290 70" fill="none" stroke="#FFE45C" stroke-width="4" stroke-linecap="round"/></svg>';
    world.appendChild(arc);
    bossScene.arcEl = arc;
    // NULLPOINTER, right — fills the right half, head near the top edge
    var boss = el('div', 'fig'); boss.id = 'boss-figure';
    boss.style.cssText = 'right:90px;top:60px;width:400px;height:520px;';
    var bimg = el('img'); bimg.src = 'assets/characters/nullpointer.svg'; bimg.alt = 'NULLPOINTER';
    boss.appendChild(bimg);
    world.appendChild(boss);
    bossScene.bossEl = boss;
    // code chips pinned on the cape (the next three lines, visible early)
    var chips = el('div', 'boss-chips'); chips.id = 'boss-chips';
    chips.style.cssText = 'right:330px;top:556px;'; // below the torso, over the ground — never over the POINTER lettering or the subtitle
    world.appendChild(chips);
    bossScene.chipsEl = chips;
    bossScene.paintChips();
    bossScene.hero = { x: 110, y: GROUND_Y, vy: 0, hp: PHYS.playerHp, facing: 1, guard: false, hurtT: 0 };
    bossScene.boss = { hp: PHYS.bossHp, x: 790, state: 'idle', frozen: 0 };
    bossScene.projectiles = []; bossScene.combo = 0; bossScene.comboT = 0;
    bossScene.bossState = 'idle'; bossScene.stateT = 0; bossScene.throwIdx = 0;
    bossScene.novaUsed = false; bossScene.voidT = 14; bossScene.voidPhase = null;
    bossScene.over = false; bossScene.slashT = 0;
    setSubtitle('<span class="who">NullPointer:</span> “You reached for something that was never there.”');
    setTimeout(function () { var s = $('subtitle'); if (s && SCENE === 'boss' && !bossScene.over) s.classList.add('hidden'); }, 4000);
  },
  paintChips: function () {
    var lines = CODE_SETS[CODE_SET];
    var html = '';
    for (var i = 0; i < 3; i++) {
      var line = lines[(bossScene.throwIdx + i) % lines.length];
      html += '<div class="mini-chip">' + escapeHtml(line.length > 26 ? line.slice(0, 26) + '…' : line) + '</div>';
    }
    if (bossScene.chipsEl) bossScene.chipsEl.innerHTML = html;
  },
  heldLine: function () { return CODE_SETS[CODE_SET][bossScene.throwIdx % CODE_SETS[CODE_SET].length]; },
  throwLine: function () {
    var line = bossScene.heldLine();
    var chip = el('div', 'code-chip', escapeHtml(line));
    chip.style.left = '820px'; chip.style.top = '210px';
    $('world').appendChild(chip);
    bossScene.projectiles.push({ el: chip, x: 820, y: 210, vx: -PHYS.bulletSpeed, vy: 0, line: line, deflected: false, baseY: 210, t: 0 });
    bossScene.throwIdx++;
    bossScene.paintChips();
    if (bossScene.heldEl) { bossScene.heldEl.remove(); bossScene.heldEl = null; }
  },
  update: function (dt) {
    if (bossScene.over) { updateFx(dt); return; }
    var hero = bossScene.hero, boss = bossScene.boss;
    // --- hero movement ---
    var move = 0;
    if (keyDown('arrowleft', 'a') || joy.x < -0.25) move -= 1;
    if (keyDown('arrowright', 'd') || joy.x > 0.25) move += 1;
    hero.x = Math.max(50, Math.min(1080, hero.x + move * PHYS.heroRun * dt));
    if (move !== 0) hero.facing = move;
    if ((wasPressed('arrowup', 'w', ' ') || joy.y < -0.6) && hero.vy === 0) hero.vy = PHYS.heroJump;
    if (hero.vy !== 0 || hero.y < GROUND_Y) {
      hero.vy += PHYS.heroGrav * dt; hero.y += hero.vy * dt;
      if (hero.y >= GROUND_Y) { hero.y = GROUND_Y; hero.vy = 0; }
    }
    hero.guard = keyDown('s', 'arrowdown');
    if (hero.hurtT > 0) hero.hurtT -= dt;
    // --- slash (460 ms) ---
    bossScene.slashCd -= dt;
    if ((wasPressed('j', 'x', 'k', 'r') || pressed['slash']) && bossScene.slashCd <= 0 && bossScene.slashT <= 0) {
      bossScene.slashT = PHYS.slashMs / 1000; bossScene.slashCd = 0.55;
      playSfx('slash');
      spawnSparks(hero.x + 150, hero.y - 130, 10);
      // melee: boss in reach?
      if (hero.x > 560) bossScene.damageBoss(PHYS.meleeDamage, hero.x + 160, hero.y - 150, false);
    }
    if (bossScene.slashT > 0) bossScene.slashT -= dt;
    // --- Debug Nova (once per fight) ---
    if (wasPressed('q') && !bossScene.novaUsed) {
      bossScene.novaUsed = true; boss.novaT = 2;
      setBanner('DEBUG NOVA', '“Stop. Look. Then hit.” — the Guide');
      setTimeout(function () { if (!bossScene.over) $('banner').classList.add('hidden'); }, 1800);
      spawnSparks(hero.x + 90, hero.y - 140, 30);
    }
    if (boss.novaT > 0) boss.novaT -= dt;
    // --- boss state machine ---
    bossScene.stateT += dt;
    var frozen = boss.novaT > 0;
    if (!frozen) {
      if (bossScene.bossState === 'idle' && bossScene.stateT > 0.8) {
        bossScene.bossState = 'windup'; bossScene.stateT = 0;
        // the line is raised in his hand, VISIBLE before the throw
        var held = el('div', 'code-chip held', escapeHtml(bossScene.heldLine()));
        held.style.left = '880px'; held.style.top = '150px';
        $('world').appendChild(held); bossScene.heldEl = held;
      } else if (bossScene.bossState === 'windup' && bossScene.stateT > PHYS.throwWindupMs / 1000) {
        bossScene.bossState = 'recover'; bossScene.stateT = 0;
        bossScene.throwLine();
      } else if (bossScene.bossState === 'recover' && bossScene.stateT > (PHYS.throwTotalMs - PHYS.throwWindupMs) / 1000) {
        bossScene.bossState = 'idle'; bossScene.stateT = 0;
      }
    }
    // --- VOID GRAB timer ---
    bossScene.voidT -= dt;
    if (bossScene.voidT <= 0 && !bossScene.voidPhase) {
      bossScene.voidPhase = 'telegraph'; bossScene.voidPhaseT = 0;
      var vt = el('div', 'void-telegraph'); vt.id = 'void-telegraph';
      vt.style.cssText = 'left:' + (hero.x - 20) + 'px;top:' + (GROUND_Y - 6) + 'px;width:220px;height:60px;';
      $('world').appendChild(vt);
    }
    if (bossScene.voidPhase) {
      bossScene.voidPhaseT += dt;
      if (bossScene.voidPhase === 'telegraph' && bossScene.voidPhaseT > PHYS.voidTelegraphMs / 1000) {
        bossScene.voidPhase = 'vanish'; bossScene.voidPhaseT = 0;
        var tel = $('void-telegraph'); if (tel) tel.style.background = 'rgba(0,0,0,.92)';
        if (hero.y >= GROUND_Y - 1) { // still standing on the vanished panel
          hero.hp -= 15; bossScene.hurtHero(hero.x + 90, hero.y - 140);
        }
      } else if (bossScene.voidPhase === 'vanish' && bossScene.voidPhaseT > PHYS.voidVanishMs / 1000) {
        bossScene.voidPhase = 'return'; bossScene.voidPhaseT = 0;
      } else if (bossScene.voidPhase === 'return' && bossScene.voidPhaseT > PHYS.voidReturnMs / 1000) {
        bossScene.voidPhase = null; bossScene.voidT = 18;
        var tel2 = $('void-telegraph'); if (tel2) tel2.remove();
      }
    }
    // --- projectiles ---
    for (var i = bossScene.projectiles.length - 1; i >= 0; i--) {
      var p = bossScene.projectiles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y = p.baseY + Math.sin(p.t * 5) * 14 + (p.deflected ? 0 : p.t * 30);
      p.el.style.left = p.x + 'px'; p.el.style.top = p.y + 'px';
      var hx = hero.x + 90, hy = hero.y - 120;
      if (!p.deflected) {
        // slash deflect: line in front of the hero during a slash
        if (bossScene.slashT > 0 && Math.abs(p.x - hx) < 150 && Math.abs(p.y - hy) < 110) {
          p.deflected = true; p.vx = PHYS.bulletSpeed * 1.4;
          p.el.classList.add('deflected');
          playSfx('deflect');
          spawnSparks(p.x, p.y, 14);
          floatText(p.x, p.y - 30, 'DEFLECT!', 'dmg');
          continue;
        }
        // guard block (green circle)
        if (hero.guard && Math.abs(p.x - hx) < 130 && Math.abs(p.y - hy) < 130) {
          playSfx('guard');
          spawnSparks(p.x, p.y, 8);
          p.el.remove(); bossScene.projectiles.splice(i, 1);
          floatText(hx, hy - 60, 'GUARDED', '');
          continue;
        }
        // hit the hero
        if (Math.abs(p.x - hx) < 70 && Math.abs(p.y - hy) < 100 && hero.hurtT <= 0) {
          hero.hp -= PHYS.lineHitDamage; hero.hurtT = 0.6;
          bossScene.hurtHero(hx, hy);
          p.el.remove(); bossScene.projectiles.splice(i, 1);
          continue;
        }
        if (p.x < -80) { p.el.remove(); bossScene.projectiles.splice(i, 1); continue; }
      } else {
        // deflected line flies back and hits the boss
        if (p.x > 820) {
          bossScene.damageBoss(PHYS.deflectDamage, 860, 300, true);
          p.el.remove(); bossScene.projectiles.splice(i, 1);
          continue;
        }
      }
    }
    // --- combo decay ---
    if (bossScene.comboT > 0) {
      bossScene.comboT -= dt;
      if (bossScene.comboT <= 0) bossScene.combo = 0;
    }
    var cn = $('combo-n'); if (cn) cn.textContent = bossScene.combo;
    var comboEl = $('combo'); if (comboEl) comboEl.style.display = bossScene.combo >= 2 ? 'block' : 'none';
    // --- hero death ---
    if (hero.hp <= 0 && !bossScene.over) {
      hero.hp = 0; bossScene.over = true;
      setBanner('KO', 'Press R to try again — the method doesn’t die.');
    }
    var hpf = $('hero-hp-fill'); if (hpf) hpf.style.width = Math.max(0, hero.hp) + '%';
    updateFx(dt);
  },
  hurtHero: function (x, y) {
    floatText(x, y, '-' + PHYS.lineHitDamage, 'hurt');
    spawnSparks(x, y, 6);
    if (bossScene.hero) bossScene.hero.x = Math.max(50, bossScene.hero.x - PHYS.knockbackTaken * 0.25);
  },
  damageBoss: function (dmg, x, y, deflected) {
    var boss = bossScene.boss; if (!boss || boss.hp <= 0) return;
    boss.hp -= dmg;
    bossScene.combo++; bossScene.comboT = 2.5;
    floatText(x, y, '-' + dmg, 'dmg');
    spawnSparks(x, y, deflected ? 18 : 8);
    var fill = $('boss-bar-fill');
    if (fill) fill.style.width = Math.max(0, boss.hp / PHYS.bossHp * 100) + '%';
    if (boss.hp <= 0) {
      boss.hp = 0; bossScene.over = true;
      bossScene.projectiles.forEach(function (p) { p.el.remove(); });
      bossScene.projectiles = [];
      setBanner('NULLPOINTER DEFEATED', '“I checked. It’s there now.” — TechieMan');
      setSubtitle('<span class="who">NullPointer:</span> “You reached for something that was never there.”');
      spawnSparks(900, 300, 40);
    }
  },
  render: function () {
    var hero = bossScene.hero, bossEl = bossScene.bossEl, heroEl = bossScene.heroEl;
    if (!hero || !heroEl) return;
    heroEl.style.left = hero.x + 'px';
    heroEl.style.top = (hero.y - 300 + Math.sin(performance.now() / 300) * 2) + 'px';
    // FRONT VIEW, always facing camera-right toward the boss — never flipped
    heroEl.style.transform = (bossScene.slashT > 0 ? 'rotate(-8deg)' : '');
    heroEl.style.opacity = hero.hurtT > 0 && Math.floor(performance.now() / 90) % 2 === 0 ? '0.45' : '1';
    // guard ring follows the hero, visible only while guarding
    if (bossScene.guardEl) {
      if (hero.guard) {
        bossScene.guardEl.classList.remove('hidden');
        bossScene.guardEl.style.left = (hero.x - 15) + 'px';
        bossScene.guardEl.style.top = (hero.y - 300) + 'px';
        bossScene.guardEl.style.width = '260px'; bossScene.guardEl.style.height = '260px';
      } else bossScene.guardEl.classList.add('hidden');
    }
    // fiery slash arc, visible only during a slash, reaching toward the boss
    if (bossScene.arcEl) {
      bossScene.arcEl.style.opacity = bossScene.slashT > 0 ? '1' : '0';
      bossScene.arcEl.style.left = (hero.x + 150) + 'px';
      bossScene.arcEl.style.top = (hero.y - 240) + 'px';
    }
    if (bossEl) {
      var t = performance.now() / 1000;
      var bobY = Math.sin(t * 1.1) * 5;
      var wind = bossScene.bossState === 'windup' ? -14 : 0;
      bossEl.style.top = (60 + bobY + wind) + 'px';
      bossEl.style.filter = bossScene.boss && bossScene.boss.novaT > 0 ? 'brightness(1.8) drop-shadow(0 0 30px #fff)' : '';
    }
    drawFx();
  }
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* =====================================================================
 * MAIN LOOP + BOOT
 * &t=<seconds> freezes the scene at that time: the scene is simulated
 * forward from 0 to t in fixed 1/60 steps before the first paint, then
 * the clock stops (CSS animations are paused via .frozen).
 * ===================================================================== */
var SCENES = { hero: heroScene, run: runScene, narrate: narrateScene, troops: troopsScene, boss: bossScene };
var current = SCENES[SCENE];
var gameTime = 0, lastNow = 0, frozen = false, booted = false;

function stepScene(dt) {
  gameTime += dt;
  if (current && current.update) current.update(dt);
  if (current && current.render) current.render();
  clearPressed();
}
function loop(now) {
  if (frozen || paused) { requestAnimationFrame(loop); return; }
  var dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
  lastNow = now;
  stepScene(dt);
  requestAnimationFrame(loop);
}
function boot() {
  if (booted) return; booted = true;
  try {
    fx = $('fx'); fctx = fx.getContext('2d');
    fitStage();
    if (FREEZE_T != null) $('stage').classList.add('frozen');
    current.init();
    if (FREEZE_T != null) {
      // deterministic freeze: simulate to t, then stop the clock
      var steps = Math.round(FREEZE_T * 60);
      for (var i = 0; i < steps; i++) stepScene(1 / 60);
      frozen = true;
      if (current.render) current.render();
      drawFx();
    } else {
      lastNow = performance.now();
      requestAnimationFrame(loop);
    }
    // R restarts a lost boss fight
    window.addEventListener('keydown', function (e) {
      if (e.key.toLowerCase() === 'r' && SCENE === 'boss' && bossScene.over) goScene('boss');
    });
  } catch (err) {
    showErr(err && err.message ? err.message : String(err));
    throw err;
  }
}
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
