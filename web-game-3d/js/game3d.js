/* TECHIEMAN REAL 3D — game3d.js (core)
 * Three.js r149 UMD (vendored, no CDN, no build step, works from file://).
 * Front view, realistic 3D: the camera sees the hero from the front and the
 * hero's front faces the camera. Depth is real: characters are extruded
 * letter geometry, the road/gate/troops move along the z-axis toward and
 * away from the camera, shadows shift with the lights.
 *
 * Deep links: ?scene=hero|map|run|narrate|troops|boss &road=kotlin|java|
 * android|python|react-native &chapter=N &t=<sec> &seed=N &cam=front|side
 * &autotest=boss|run|smoke
 */
'use strict';

/* --- URL params --- */
var QS = new URLSearchParams(location.search);
var SCENE = (QS.get('scene') || 'hero').toLowerCase();
if (['hero', 'map', 'run', 'narrate', 'troops', 'boss'].indexOf(SCENE) < 0) SCENE = 'hero';
var ROAD = (QS.get('road') || 'kotlin').toLowerCase();
if (!ROADS[ROAD]) ROAD = 'kotlin';
var CHAPTER_N = Math.max(1, Math.min(50, parseInt(QS.get('chapter') || '1', 10) || 1));
var FREEZE_T = QS.has('t') ? Math.max(0, parseFloat(QS.get('t')) || 0) : null;
var SEED = QS.has('seed') ? (parseInt(QS.get('seed'), 10) || 1) : 20261127;
var CAM_MODE = (QS.get('cam') || 'front').toLowerCase();
var AUTOTEST = (QS.get('autotest') || '').toLowerCase();
if (['kotlin', 'nullpointer', 'concurrentchaos'].indexOf(QS.get('codeset')) >= 0) CODE_SET = QS.get('codeset');
if (QS.get('chest') === 'all-code' || QS.get('chest') === 'canon') HERO_CHEST = QS.get('chest');

/* --- seeded RNG --- */
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
  var e = $('err'); if (e) { e.classList.remove('hidden'); e.textContent = 'TECHIEMAN 3D error: ' + msg; }
  if (window.__TM__) window.__TM__.errors.push(String(msg));
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* --- renderer / scene / camera / lights --- */
var renderer, scene, camera, clock;
var dirLight, hemiLight;
var WORLD = { ground: null, towers: [], islands: [], gate: null, roadTiles: [] };
var gameTime = 0, booted = false, paused = false, frozen = false;

function initGL() {
  var canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcbcbc);
  scene.fog = new THREE.Fog(0xbcbcbc, 18, 46);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
  setCameraFront(new THREE.Vector3(0, 1.6, 0));
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.85);
  scene.add(hemiLight);
  dirLight = new THREE.DirectionalLight(0xfff2d0, 1.35);
  dirLight.position.set(6, 12, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -14; dirLight.shadow.camera.right = 14;
  dirLight.shadow.camera.top = 14; dirLight.shadow.camera.bottom = -14;
  dirLight.shadow.camera.far = 40;
  scene.add(dirLight);
  var fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
  fill.position.set(-6, 4, 6);
  scene.add(fill);
  window.addEventListener('resize', onResize);
}
function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function setCameraFront(target) {
  if (CAM_MODE === 'side') {
    camera.position.set(8.5, 3.4, 5.5);
  } else {
    camera.position.set(0, 2.5, 10.8);
  }
  camera.lookAt(target || new THREE.Vector3(0, 1.6, 0));
}
function setCameraFor(sceneName, target) {
  var t = target || new THREE.Vector3(0, 1.6, 0);
  if (CAM_MODE === 'side') {
    if (sceneName === 'boss') { camera.position.set(9.0, 3.0, 2.0); }
    else if (sceneName === 'run' || sceneName === 'troops') { camera.position.set(7.5, 2.8, 7.5); }
    else if (sceneName === 'map') { camera.position.set(10, 12, 12); }
    else { camera.position.set(7.0, 2.6, 6.0); }
  } else {
    if (sceneName === 'map') { camera.position.set(0, 13.5, 8); }
    else if (sceneName === 'hero') { camera.position.set(0, 2.0, 8.8); }
    else if (sceneName === 'narrate') { camera.position.set(0, 2.0, 7.2); }
    else if (sceneName === 'troops') { camera.position.set(0, 2.6, 11.5); }
    else if (sceneName === 'boss') { camera.position.set(0, 2.8, 11.5); }
    else { camera.position.set(0, 2.4, 10.0); }
  }
  camera.lookAt(t);
}

/* --- procedural ruined-city world (no fetched assets) --- */
function groundTexture() {
  var c = document.createElement('canvas'); c.width = 512; c.height = 512;
  var x = c.getContext('2d');
  x.fillStyle = '#8f8f8f'; x.fillRect(0, 0, 512, 512);
  // cracked flagstones
  for (var r = 0; r < 8; r++) {
    for (var col = 0; col < 8; col++) {
      var v = 128 + Math.floor(rng() * 40) - 20;
      x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      x.fillRect(col * 64 + 2, r * 64 + 2, 60, 60);
    }
  }
  x.strokeStyle = 'rgba(20,20,20,0.55)'; x.lineWidth = 2;
  for (var k = 0; k < 26; k++) { // cracks
    x.beginPath();
    var px = rng() * 512, py = rng() * 512;
    x.moveTo(px, py);
    for (var s = 0; s < 4; s++) { px += (rng() - 0.5) * 70; py += (rng() - 0.5) * 70; x.lineTo(px, py); }
    x.stroke();
  }
  x.fillStyle = 'rgba(0,0,0,0.10)';
  for (var b = 0; b < 40; b++) { x.beginPath(); x.arc(rng() * 512, rng() * 512, 3 + rng() * 14, 0, 7); x.fill(); }
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}
function buildWorld(opts) {
  opts = opts || {};
  chInitMaterials();
  // ground
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  WORLD.ground = ground;
  // ruined gothic towers at the edges (grey boxes + broken tops)
  WORLD.towers = [];
  for (var i = 0; i < 12; i++) {
    var h = 4 + rng() * 9;
    var w = 1.6 + rng() * 1.6;
    var tower = chBox(w, h, w, rng() > 0.5 ? MAT.stoneDark : MAT.stone, 0, h / 2, 0);
    var side = i % 2 === 0 ? -1 : 1;
    tower.position.set(side * (11 + rng() * 6), h / 2, -16 + (i * 2.4) - rng() * 2);
    tower.rotation.y = (rng() - 0.5) * 0.5;
    tower.rotation.z = (rng() - 0.5) * 0.06; // broken lean
    scene.add(tower);
    WORLD.towers.push(tower);
    if (rng() > 0.6) { // broken top slab
      var slab = chBox(w * 0.7, 0.4, w * 0.7, MAT.stoneDark, 0, 0, 0);
      slab.position.copy(tower.position); slab.position.y = h + 0.2; slab.rotation.z = 0.2;
      scene.add(slab); WORLD.towers.push(slab);
    }
  }
  // floating islands (previews: broken towers on floating rock)
  WORLD.islands = [];
  for (var j = 0; j < 5; j++) {
    var isl = new THREE.Group();
    var rock = chCone(1.6 + rng(), 2.2, MAT.stoneDark, 0, 0, 0, Math.PI, 0);
    var top = chBox(2.6, 0.5, 2.0, MAT.stone, 0, 1.2, 0);
    var mini = chBox(0.5, 1.6 + rng(), 0.5, MAT.stoneDark, (rng() - 0.5), 2.2, 0);
    isl.add(rock, top, mini);
    isl.position.set(-11 + j * 5.5 + (rng() - 0.5) * 2, 7.5 + rng() * 2.5, -12 - rng() * 6);
    isl.userData.baseY = isl.position.y;
    isl.userData.phase = rng() * 6;
    scene.add(isl);
    WORLD.islands.push(isl);
  }
  // mist bands: large translucent planes drifting low
  WORLD.mist = [];
  for (var m = 0; m < 4; m++) {
    var mist = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, depthWrite: false })
    );
    mist.position.set((rng() - 0.5) * 10, 0.8 + m * 0.5, -6 - m * 3);
    scene.add(mist);
    WORLD.mist.push(mist);
  }
}
function updateWorld(dt) {
  WORLD.islands.forEach(function (isl) {
    isl.position.y = isl.userData.baseY + Math.sin(gameTime * 0.4 + isl.userData.phase) * 0.35;
  });
  WORLD.mist.forEach(function (mist, i) {
    mist.position.x += Math.sin(gameTime * 0.1 + i) * dt * 0.3;
  });
}

/* --- checkpoint gate (3D arch + CHECKPOINT letters, grows as you approach) --- */
function buildGate() {
  chInitMaterials();
  var g = new THREE.Group();
  var pillarL = chBox(0.9, 5.2, 0.9, MAT.stone, -2.4, 2.6, 0);
  var pillarR = chBox(0.9, 5.2, 0.9, MAT.stone, 2.4, 2.6, 0);
  var lintel = chBox(5.7, 0.9, 0.9, MAT.stone, 0, 5.4, 0);
  var archTop = chBox(3.6, 0.8, 0.7, MAT.stoneDark, 0, 4.7, 0);
  g.add(pillarL, pillarR, lintel, archTop);
  var label = tmTextMesh('CHECKPOINT', { size: 0.55, depth: 0.18, material: MAT.letterWhite, align: 'center' });
  label.group.position.set(0, 5.9, 0.2);
  g.add(label.group);
  var emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), MAT.goldGlow);
  emblem.position.set(0, 4.7, 0.5);
  emblem.name = 'emblem';
  g.add(emblem);
  g.userData.emblem = emblem;
  return g;
}

/* --- HUD (DOM overlay, preview3 language) --- */
var HUD = { bossFill: null, bossNum: null, heroFill: null, comboEl: null, cueEl: null };
function buildHUD(opts) {
  opts = opts || {};
  var hud = $('hud'); hud.innerHTML = '';
  // top-left: brush label + portrait + Lv + HP + Pen-Staff
  var tl = el('div', 'hud-tl');
  if (opts.label) tl.appendChild(el('div', 'brush', opts.label));
  var row = el('div', 'hud-portrait-row');
  row.appendChild(el('div', 'portrait', '<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#1a1a1a"/><path d="M20 34 L14 18 L24 24 L26 8 L32 20 L40 6 L42 22 L52 14 L48 30 L56 26 L46 38 Q32 44 20 34 Z" fill="#000"/><ellipse cx="32" cy="38" rx="14" ry="15" fill="#050505"/><ellipse cx="26" cy="38" rx="3.4" ry="2" fill="#fff"/><ellipse cx="39" cy="38" rx="3.4" ry="2" fill="#fff"/><path d="M18 52 L46 52 L44 64 L20 64 Z" fill="#050505"/></svg>'));
  var col = el('div');
  col.appendChild(el('div', 'hud-level', 'Lv. ' + (opts.level || 12)));
  var hp = el('div', 'bar'); hp.innerHTML = '<i id="hero-hp-fill" style="width:100%"></i>';
  col.appendChild(hp);
  col.appendChild(el('div', 'bar blue', '<i style="width:82%"></i>'));
  col.appendChild(el('div', 'weapon-line', '🖊 Pen-Staff ∞'));
  row.appendChild(col); tl.appendChild(row); hud.appendChild(tl);
  // top-centre: boss name + red bar + NUMERIC HP (locked lesson from the live probe)
  if (opts.showBoss) {
    var tc = el('div', 'hud-tc');
    tc.appendChild(el('div', 'boss-name', opts.bossName || 'NullPointer'));
    var bb = el('div', 'bar boss'); bb.innerHTML = '<i id="boss-bar-fill" style="width:100%"></i>';
    tc.appendChild(bb);
    var num = el('div', 'boss-hp-num', '<span id="boss-hp-num">560</span> / 560 HP');
    tc.appendChild(num);
    hud.appendChild(tc);
  }
  // top-right: minimap + gear
  var tr = el('div', 'hud-tr');
  tr.appendChild(el('div', 'minimap', '<svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="52" fill="#262626"/><path d="M14 78 L40 54 L54 60 L74 34 L94 30" stroke="#555" stroke-width="3" fill="none"/><circle cx="54" cy="60" r="5" fill="#e8e8e8"/><circle cx="74" cy="34" r="4" fill="#ff2a2a"/></svg>'));
  var gear = el('button', 'gear', '⚙'); gear.setAttribute('aria-label', 'Pause');
  gear.addEventListener('click', function () { togglePause(); });
  tr.appendChild(gear); hud.appendChild(tr);
  if (opts.objective) hud.appendChild(el('div', 'objective', opts.objective));
  // combo
  var c = el('div', 'combo'); c.id = 'combo'; c.style.display = 'none';
  c.innerHTML = '<span id="combo-n">0</span> HIT COMBO!<small>KEEP IT GOING</small>';
  hud.appendChild(c);
  // deflect cue — the generous-window signal (gold flash, unmissable)
  var cue = el('div', 'deflect-cue hidden'); cue.id = 'deflect-cue'; cue.textContent = '⚔ DEFLECT NOW — press J / R !';
  hud.appendChild(cue);
  if (opts.joystick) hud.appendChild(buildJoystick());
  if (opts.skills) hud.appendChild(buildSkills());
  HUD.bossFill = $('boss-bar-fill'); HUD.bossNum = $('boss-hp-num');
  HUD.heroFill = $('hero-hp-fill'); HUD.comboEl = $('combo'); HUD.cueEl = $('deflect-cue');
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
function skillButton(action, iconHtml, label) {
  var b = el('button', 'skill', iconHtml + '<span class="key">' + label + '</span>');
  b.setAttribute('aria-label', action);
  b.addEventListener('pointerdown', function (e) { e.preventDefault(); doAction(action, 'down'); });
  b.addEventListener('pointerup', function (e) { e.preventDefault(); doAction(action, 'up'); });
  b.addEventListener('pointerleave', function () { doAction(action, 'up'); });
  return b;
}
function buildSkills() {
  var g = el('div', 'skills');
  g.appendChild(skillButton('slash', '<svg viewBox="0 0 34 34"><path d="M6 28 L26 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M26 8 L30 4 L28 12 Z" fill="#fff"/></svg>', 'J'));
  g.appendChild(skillButton('guard', '<svg viewBox="0 0 34 34"><path d="M17 4 L28 8 L28 17 Q28 26 17 30 Q6 26 6 17 L6 8 Z" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 17 L16 21 L23 12" stroke="#fff" stroke-width="2.5" fill="none"/></svg>', 'S'));
  g.appendChild(skillButton('nova', '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="5" fill="#fff"/><path d="M17 3 L17 9 M17 25 L17 31 M3 17 L9 17 M25 17 L31 17" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>', 'Q'));
  g.appendChild(skillButton('bullet', '<svg viewBox="0 0 34 34"><path d="M8 26 L24 10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><text x="8" y="30" font-family="monospace" font-size="9" fill="#ddd">if</text></svg>', 'K'));
  return g;
}
function setBanner(text, sub) {
  var b = $('banner');
  b.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
  b.classList.remove('hidden');
}
function hideBanner() { $('banner').classList.add('hidden'); }
function setSubtitle(html) {
  var s = $('subtitle'); s.innerHTML = html; s.classList.remove('hidden');
}
function hideSubtitle() { $('subtitle').classList.add('hidden'); }
function floatText3D(worldPos, text, cls) {
  // project a 3D point to screen and float a DOM label there
  var v = worldPos.clone().project(camera);
  if (v.z > 1) return;
  var x = (v.x * 0.5 + 0.5) * window.innerWidth;
  var y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  var f = el('div', 'float-text ' + (cls || ''), text);
  f.style.left = x + 'px'; f.style.top = y + 'px';
  document.body.appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1100);
}
function togglePause() {
  paused = !paused;
  if (paused) setBanner('PAUSED', 'Press P or the gear to resume.');
  else hideBanner();
}
function setBossHud(hp, max) {
  var pct = Math.max(0, hp / max * 100);
  if (HUD.bossFill) HUD.bossFill.style.width = pct + '%';
  if (HUD.bossNum) HUD.bossNum.textContent = String(Math.max(0, Math.round(hp)));
}
function setHeroHud(hp, max) {
  if (HUD.heroFill) HUD.heroFill.style.width = Math.max(0, hp / max * 100) + '%';
}
function setCombo(n) {
  var cn = $('combo-n');
  if (cn) cn.textContent = n;
  if (HUD.comboEl) HUD.comboEl.style.display = n >= 2 ? 'block' : 'none';
}
function showDeflectCue(on) {
  if (HUD.cueEl) HUD.cueEl.classList.toggle('hidden', !on);
}

/* --- input: keyboard + joystick + skill buttons (one path for all) --- */
var keys = {};
var joy = { x: 0, y: 0, active: false };
var pressed = {}; // edge-triggered, consumed each frame
window.addEventListener('keydown', function (e) {
  var k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) >= 0) e.preventDefault();
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
});
window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
function keyDown() {
  for (var i = 0; i < arguments.length; i++) if (keys[arguments[i]]) return true;
  return false;
}
function wasPressed() {
  for (var i = 0; i < arguments.length; i++) if (pressed[arguments[i]]) return true;
  return false;
}
function clearPressed() { pressed = {}; }
/* doAction routes both keyboard and on-screen buttons through the same queue */
function doAction(action, phase) {
  if (action === 'slash' && phase === 'down') pressed['j'] = true;
  if (action === 'bullet' && phase === 'down') pressed['k'] = true;
  if (action === 'nova' && phase === 'down') pressed['q'] = true;
  if (action === 'guard') keys['s'] = (phase === 'down');
}
function goScene(name, extra) {
  var q = '?scene=' + name;
  if (extra) q += extra;
  history.replaceState(null, '', q);
  location.reload();
}
function saveProgress(road, chapter) {
  try { localStorage.setItem('techieman3d-save', JSON.stringify({ road: road, chapter: chapter, at: Date.now() })); } catch (e) {}
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem('techieman3d-save') || 'null'); } catch (e) { return null; }
}
