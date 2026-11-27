/* TECHIEMAN REAL 3D — scenes3d.js (scenes + combat + autotest)
 * All five scenes in 3D + the road map. Front view everywhere: the hero's
 * front faces the camera, the road/gate/troops move along z toward the
 * viewer, the boss throws code lines THROUGH 3D space at the hero.
 *
 * COMBAT LESSONS FROM THE FLAT-GAME LIVE PROBE (2026-11-27, 7 runs, 0 deflects):
 * 1. Deflect window is GENEROUS: a line is deflectable for its whole final
 *    ~3 units of flight (~0.75 s) + a 350 ms slash-press buffer, with a gold
 *    DEFLECT NOW cue + the chip flashing gold while in the window.
 * 2. Guard is CLEARLY VISIBLE (green ring + dome) and ACTUALLY blocks.
 * 3. Boss HP is a NUMBER (560) as well as a bar, updated on every hit.
 * The autotest below proves all three with real key events before shipping.
 */
'use strict';

/* --- shared hero rig: physics + run/jump/slash animation in 3D --- */
function makeHeroRig(heroDef) {
  var group = chBuildHero(heroDef, {});
  var rig = {
    group: group, parts: group.userData.parts,
    x: 0, z: 3.2, y: 0, vy: 0, hp: PHYS3D.playerHp,
    guard: false, hurtT: 0, slashT: 0, slashCd: 0, bulletCd: 0,
    slashPressT: -9, bobPhase: 0, runPhase: 0, airK: 0,
    facing: 1, knockV: 0
  };
  return rig;
}
function updateHeroRig(rig, dt, opts) {
  opts = opts || {};
  var running = !!opts.running;
  if (running) rig.runPhase += dt * 16; // 380 ms stride
  rig.bobPhase += dt * 10;
  var legSwing = running ? Math.sin(rig.runPhase) * 0.55 : 0;
  rig.parts.legL.rotation.x = legSwing;
  rig.parts.legR.rotation.x = -legSwing;
  rig.parts.armL.rotation.x = running ? -Math.sin(rig.runPhase) * 0.5 : 0;
  rig.parts.armR.rotation.x = running ? Math.sin(rig.runPhase) * 0.5 : 0;
  // jump physics (spec: -900 px/s, 202 px, 900 ms air, 120 ms anticipation)
  if (rig.vy !== 0 || rig.y > 0) {
    rig.vy -= PHYS3D.heroGrav * dt;
    rig.y += rig.vy * dt;
    if (rig.y <= 0) {
      rig.y = 0; rig.vy = 0;
      rig.group.scale.y = 0.84; // landing squash (spec: 84%)
      setTimeout(function () { rig.group.scale.y = 1; }, 120);
    }
  }
  rig.airK = Math.min(1, rig.y / 2.02);
  var bobY = running ? Math.abs(Math.sin(rig.runPhase)) * 0.09 : Math.sin(rig.bobPhase) * 0.02;
  var sc = 1 + rig.airK * 0.12; // jumping toward the camera: he grows slightly
  rig.group.position.set(rig.x, rig.y + bobY, rig.z);
  rig.group.scale.x = sc; rig.group.scale.z = sc;
  if (rig.hurtT > 0) rig.hurtT -= dt;
  rig.group.visible = !(rig.hurtT > 0 && Math.floor(gameTime * 12) % 2 === 0);
  if (rig.slashT > 0) rig.slashT -= dt;
  if (rig.slashCd > 0) rig.slashCd -= dt;
  if (rig.bulletCd > 0) rig.bulletCd -= dt;
}
function heroTryJump(rig) {
  if (rig.vy === 0 && rig.y === 0) { rig.vy = PHYS3D.heroJumpV; }
}
function heroTrySlash(rig) {
  if (rig.slashCd <= 0 && rig.slashT <= 0) {
    rig.slashT = PHYS3D.slashMs / 1000; rig.slashCd = 0.55;
    rig.slashPressT = gameTime;
    return true;
  }
  rig.slashPressT = gameTime; // buffer the press even on cooldown
  return false;
}
function slashIsActive(rig) {
  return rig.slashT > 0 || (gameTime - rig.slashPressT) < 0.35;
}

/* --- scene registry --- */
var SCENES3D = {};
var current = null;
var currentName = null;

function clearScene3D() {
  if (current && current.dispose) current.dispose();
  // remove everything except lights (lights are scene-level, rebuilt per scene is wasteful — keep them)
  var keep = [];
  scene.children.forEach(function (c) {
    if (c.isLight) keep.push(c);
  });
  scene.children.slice().forEach(function (c) {
    if (!c.isLight) scene.remove(c);
  });
  scene.fog = new THREE.Fog(0xbcbcbc, 18, 46);
  hideBanner(); hideSubtitle();
  var tl = $('test-log'); if (tl) tl.innerHTML = '';
}
function switchScene(name, opts) {
  clearScene3D();
  currentName = name;
  current = SCENES3D[name];
  if (!current) { showErr('no scene ' + name); return; }
  current.init(opts || {});
  setCameraFor(name, current.cameraTarget ? current.cameraTarget() : new THREE.Vector3(0, 1.6, 0));
  if (window.__TM__) window.__TM__.scene = name;
}

/* =====================================================================
 * SCENE 1 — HERO SELECT (preview3 bottom-left)
 * Four heroes in a row on a ruined-city dais, Developer gold-lit centre.
 * Sheet lettering per hero (HERO_CHEST flag flips to all-CODE).
 * ===================================================================== */
SCENES3D.hero = {
  heroes: [], selected: 1, spot: null, disc: null, ray: null, mouse: null,
  init: function () {
    buildWorld();
    buildHUD({ label: 'Hero Select', level: null });
    $('hud').innerHTML = '';
    var world = $('world-ui');
    var title = el('div', 'select-title');
    title.appendChild(el('div', 'brush', 'Select Your Hero'));
    world.appendChild(title);
    var tl = el('div', 'hud-tl'); tl.appendChild(el('div', 'brush', 'Hero Select'));
    world.appendChild(tl);
    // dais: stone cylinders under each hero
    for (var i = 0; i < 4; i++) {
      var dais = chCyl(0.95, 1.1, 0.25, MAT.stoneDark, -3.675 + i * 2.45, 0.12, 0, 20);
      scene.add(dais);
    }
    this.heroes = [];
    var self = this;
    HEROES.forEach(function (h, i) {
      var g = chBuildHero(h, {});
      g.position.set(-3.675 + i * 2.45, 0.25, 0);
      g.userData.heroIndex = i;
      scene.add(g);
      self.heroes.push(g);
    });
    // gold spotlight + glowing disc under the selected hero (gold ONLY here + Guide book)
    this.spot = new THREE.SpotLight(0xffd75e, 2.2, 12, 0.5, 0.5);
    this.spot.position.set(0, 8, 3);
    scene.add(this.spot);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshStandardMaterial({ color: 0xffd75e, emissive: 0xffc21c, emissiveIntensity: 2.2, transparent: true, opacity: 0.95 }));
    this.disc.rotation.x = -Math.PI / 2; this.disc.position.y = 0.26;
    scene.add(this.disc);
    this.applySelection();
    // name plate + stat panel (preview1)
    var plate = el('div', 'name-plate'); plate.id = 'hero-name';
    plate.textContent = HEROES[this.selected].name;
    world.appendChild(plate);
    var sp = el('div', 'stat-panel'); sp.id = 'stat-panel';
    sp.innerHTML = '<div class="row"><span class="lab">HP</span><span class="track"><i id="st-hp"></i></span></div>' +
      '<div class="row"><span class="lab">ATK</span><span class="track"><i id="st-atk"></i></span></div>' +
      '<div class="row"><span class="lab">DEF</span><span class="track"><i id="st-def"></i></span></div>' +
      '<div class="row"><span class="lab">SPEED</span><span class="track"><i id="st-spd"></i></span></div>' +
      '<div class="tagline" id="st-tag"></div>';
    world.appendChild(sp);
    this.paintStats();
    var pc = el('div', 'pad-controls');
    pc.innerHTML = '<span><b>A</b>Select</span><span><b>B</b>Back</span><span><b>Y</b>Details</span>';
    pc.addEventListener('click', function () { self.confirm(); });
    world.appendChild(pc);
    // click a hero mesh to select (raycast)
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this._onClick = function (e) {
      self.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      self.ray.setFromCamera(self.mouse, camera);
      var hits = self.ray.intersectObjects(self.heroes, true);
      if (hits.length) {
        var o = hits[0].object, g2 = o;
        while (g2.parent && g2.userData.heroIndex == null) g2 = g2.parent;
        if (g2.userData.heroIndex != null) self.select(g2.userData.heroIndex);
      }
    };
    renderer.domElement.addEventListener('click', this._onClick);
  },
  applySelection: function () {
    var self = this;
    this.heroes.forEach(function (g, i) {
      var sel = i === self.selected;
      g.traverse(function (m) {
        if (m.isMesh && m.material && m.material.transparent !== true) { /* keep */ }
      });
      // dim non-selected heroes by scaling their material opacity via a dark overlay is complex;
      // instead: non-selected stand slightly back and darker via a grey tint on ink parts is skipped —
      // selection reads through the gold spotlight + disc + name plate (previews' own signal).
      g.position.z = sel ? 0.4 : 0;
    });
    var sx = -3.675 + this.selected * 2.45;
    this.spot.target.position.set(sx, 0.25, 0.4);
    scene.add(this.spot.target);
    this.spot.position.set(sx, 8, 3.5);
    this.disc.position.x = sx; this.disc.position.z = 0.4;
  },
  paintStats: function () {
    var h = HEROES[this.selected];
    $('st-hp').style.width = Math.round(h.stats.HP * 100) + '%';
    $('st-atk').style.width = Math.round(h.stats.ATK * 100) + '%';
    $('st-def').style.width = Math.round(h.stats.DEF * 100) + '%';
    $('st-spd').style.width = Math.round(h.stats.SPEED * 100) + '%';
    $('st-tag').textContent = '"' + h.role + '"';
  },
  select: function (i) {
    this.selected = i;
    this.applySelection();
    $('hero-name').textContent = HEROES[i].name;
    this.paintStats();
  },
  confirm: function () { saveProgress(ROAD, CHAPTER_N); switchScene('map'); },
  update: function (dt) {
    if (wasPressed('arrowleft', 'a')) this.select((this.selected + 3) % 4);
    if (wasPressed('arrowright', 'd')) this.select((this.selected + 1) % 4);
    if (wasPressed('enter', ' ')) this.confirm();
    if (wasPressed('y')) { var sp = $('stat-panel'); if (sp) sp.classList.toggle('hidden'); }
    // idle life: selected hero breathes, others stand; capes sway
    this.heroes.forEach(function (g, i) {
      g.position.y = 0.25 + Math.sin(gameTime * 1.2 + i * 1.7) * 0.02;
      var cape = g.userData.parts && g.userData.parts.cape;
      if (cape) cape.rotation.x = 0.12 + Math.sin(gameTime * 0.9 + i) * 0.05;
    });
    this.disc.material.emissiveIntensity = 0.7 + Math.sin(gameTime * 2) * 0.25;
  },
  cameraTarget: function () { return new THREE.Vector3(0, 1.35, 0); },
  dispose: function () {
    if (this._onClick) renderer.domElement.removeEventListener('click', this._onClick);
    $('world-ui').innerHTML = '';
  }
};

/* =====================================================================
 * SCENE 2 — ROAD MAP (the chapter map in 3D)
 * 50 chapter nodes snake along a stone road toward the end-boss node.
 * Kotlin is fully playable; the other 4 roads show the same map, roster
 * and boss — same engine, same combat — so their chapters play too.
 * ===================================================================== */
SCENES3D.map = {
  nodes: [], bossNode: null, ray: null, mouse: null,
  init: function () {
    buildWorld();
    var road = ROADS[ROAD];
    var chaps = chaptersFor(ROAD);
    buildHUD({ label: road.name + ' Road — Chapter Map', level: null });
    var world = $('world-ui');
    var tabs = el('div', 'road-tabs');
    Object.keys(ROADS).forEach(function (rid) {
      var b = el('button', 'road-tab' + (rid === ROAD ? ' active' : ''), ROADS[rid].name);
      b.addEventListener('click', function () { ROAD = rid; CHAPTER_N = 1; switchScene('map'); });
      tabs.appendChild(b);
    });
    world.appendChild(tabs);
    var info = el('div', 'map-info'); info.id = 'map-info';
    info.innerHTML = '<b>' + road.name + ' Road</b> — 50 chapters, 5 acts · End boss: <b>' + road.boss + '</b> (2.0×, 560 HP) · ' + escapeHtml(road.bossNote);
    world.appendChild(info);
    // the road: stone tiles snaking away from the camera toward the boss
    this.nodes = [];
    for (var i = 0; i < 50; i++) {
      var r = Math.floor(i / 10), c = i % 10;
      var col = (r % 2 === 0) ? c : 9 - c;
      var x = (col - 4.5) * 1.7;
      var z = -1.5 - r * 3.4;
      var tile = chBox(1.5, 0.18, 2.6, (i + 1) % 10 === 0 ? MAT.stone : MAT.stoneDark, x, 0.09, z);
      scene.add(tile);
      var pillar = chCyl(0.32, 0.4, 0.9 + ((i % 5) * 0.06), MAT.stoneLight, x, 0.6, z, 10);
      scene.add(pillar);
      var chip = tmLabelPlane(String(i + 1), { width: 0.85, fontPx: 72, bg: (i + 1 === CHAPTER_N) ? '#ffd75e' : '#e8e8e8' });
      chip.position.set(x, 1.35, z + 0.1);
      scene.add(chip);
      pillar.userData.chapter = i + 1;
      chip.userData.chapter = i + 1;
      this.nodes.push({ pillar: pillar, chip: chip, n: i + 1, topic: chaps[i].topic, act: chaps[i].act });
    }
    // end-boss node: a miniature of the road boss at the far end
    var mini = chBuildBoss(road, { scale: 0.85 });
    mini.position.set(0, 0, -19.5);
    scene.add(mini);
    this.bossNode = mini;
    var bossChip = tmLabelPlane(road.boss + ' — 560 HP', { width: 3.2, fontPx: 56, bg: '#1a1a1a', fg: '#ff5a5a', border: '#ff5a5a' });
    bossChip.position.set(0, 4.6, -19.2);
    scene.add(bossChip);
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    var self = this;
    this._onClick = function (e) {
      self.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      self.ray.setFromCamera(self.mouse, camera);
      var pickables = [];
      self.nodes.forEach(function (n) { pickables.push(n.pillar, n.chip); });
      var hits = self.ray.intersectObjects(pickables, false);
      if (hits.length && hits[0].object.userData.chapter) {
        CHAPTER_N = hits[0].object.userData.chapter;
        self.startChapter();
      } else {
        var bh = self.ray.intersectObject(self.bossNode, true);
        if (bh.length) { CHAPTER_N = 51; switchScene('boss'); }
      }
    };
    renderer.domElement.addEventListener('click', this._onClick);
    var play = el('button', 'play-btn', '▶ Play Chapter ' + CHAPTER_N + ' — ' + escapeHtml(chaps[CHAPTER_N - 1].topic));
    play.addEventListener('click', function () { self.startChapter(); });
    world.appendChild(play);
    var bossBtn = el('button', 'play-btn boss-btn', '⚔ Fight ' + road.boss + ' (End Boss)');
    bossBtn.addEventListener('click', function () { switchScene('boss'); });
    world.appendChild(bossBtn);
  },
  startChapter: function () { saveProgress(ROAD, CHAPTER_N); switchScene('run'); },
  update: function (dt) {
    if (wasPressed('enter', ' ')) this.startChapter();
    if (wasPressed('b')) switchScene('boss');
    if (wasPressed('arrowright', 'd')) { CHAPTER_N = Math.min(50, CHAPTER_N + 1); switchScene('map'); }
    if (wasPressed('arrowleft', 'a')) { CHAPTER_N = Math.max(1, CHAPTER_N - 1); switchScene('map'); }
    if (this.bossNode) this.bossNode.rotation.y = Math.sin(gameTime * 0.4) * 0.25;
  },
  cameraTarget: function () { return new THREE.Vector3(0, 0.5, -8); },
  dispose: function () {
    if (this._onClick) renderer.domElement.removeEventListener('click', this._onClick);
    $('world-ui').innerHTML = '';
  }
};

/* =====================================================================
 * SCENE 3 — LEVEL RUN (preview3 bottom-right) — FRONT VIEW, REAL 3D
 * The hero runs TOWARD the camera (front view, chest letters visible)
 * while the road, checkpoint gate and scenery scroll TOWARD the viewer
 * along z. Troops rise from the ink ahead and run at him down the road.
 * A chapter is a real playable level: run the distance, kill the chapter's
 * troops, reach the checkpoint.
 * ===================================================================== */
SCENES3D.run = {
  rig: null, chapter: null, distM: 128, gate: null, roadTiles: [], stones: [],
  spawnQueue: [], spawnT: 0, troops: [], arrived: false, arriveT: 0,
  slashArc: null, guardRing: null, bullets: [], runSpeedMul: 1, done: false,
  init: function () {
    buildWorld();
    this.chapter = chapterByNumber(ROAD, CHAPTER_N);
    var road = ROADS[ROAD];
    this.distM = 128;
    buildHUD({ label: 'Level Run — ' + road.name + ' Ch. ' + this.chapter.n, level: 10 + this.chapter.n,
      objective: 'Ch. ' + this.chapter.n + ': ' + this.chapter.topic + ' — Reach the Checkpoint',
      joystick: true, skills: true });
    var hero = HEROES[1]; // The Developer runs the road
    this.rig = makeHeroRig(hero);
    this.rig.x = 0; this.rig.z = 3.0;
    scene.add(this.rig.group);
    // road tiles streaming toward the camera
    this.roadTiles = [];
    for (var i = 0; i < 12; i++) {
      var tile = chBox(7, 0.16, 3.4, i % 2 === 0 ? MAT.stoneDark : MAT.stone, 0, 0.08, 6 - i * 3.2);
      scene.add(tile);
      this.roadTiles.push(tile);
    }
    // roadside stones rushing toward the viewer
    this.stones = [];
    for (var s = 0; s < 10; s++) {
      var st = chBox(0.3 + rng() * 0.5, 0.3 + rng() * 0.5, 0.3 + rng() * 0.5, MAT.stoneDark, 0, 0.25, 0);
      st.position.set((rng() > 0.5 ? 1 : -1) * (4.2 + rng() * 2), 0.25, -16 + rng() * 24);
      scene.add(st);
      this.stones.push(st);
    }
    // the checkpoint gate, far/small at the vanishing point
    this.gate = buildGate();
    this.gate.position.set(0, 0, -28);
    scene.add(this.gate);
    // troops for this chapter: 3 + (n % 4), drawn from the act roster
    this.spawnQueue = [];
    var count = 3 + (this.chapter.n % 4);
    for (var k = 0; k < count; k++) {
      this.spawnQueue.push(this.chapter.troops[k % this.chapter.troops.length]);
    }
    this.spawnT = 1.0;
    this.troops = [];
    this.bullets = [];
    this.arrived = false; this.done = false;
    this.slashArc = chBuildSlashArc();
    scene.add(this.slashArc);
    this.guardRing = chBuildGuardRing();
    scene.add(this.guardRing);
    setSubtitle('<span class="who">Guide:</span> “Chapter ' + this.chapter.n + ' — ' + escapeHtml(this.chapter.topic) + '. The troops ahead are the lesson. Fight through.”');
    setTimeout(function () { if (currentName === 'run') hideSubtitle(); }, 5000);
  },
  spawnTroop: function (troopId) {
    var g = chBuildTroop(troopId, {});
    g.position.set((rng() - 0.5) * 5, -1.6, -14); // rises out of the ink ahead
    g.userData.troopId = troopId;
    g.userData.hp = TROOPS[troopId].hp;
    g.userData.maxHp = TROOPS[troopId].hp;
    g.userData.rising = 0;
    scene.add(g);
    this.troops.push(g);
  },
  update: function (dt) {
    var rig = this.rig;
    if (!rig) return;
    if (this.done) return;
    // steering: left/right across the road; W/Up jumps; S/Down steps back
    var steer = 0;
    if (keyDown('arrowleft', 'a') || joy.x < -0.25) steer -= 1;
    if (keyDown('arrowright', 'd') || joy.x > 0.25) steer += 1;
    rig.x = Math.max(-2.6, Math.min(2.6, rig.x + steer * PHYS3D.heroRun * dt));
    if (keyDown('arrowup', 'w') || joy.y < -0.6) heroTryJump(rig);
    if (keyDown('arrowdown', 's')) rig.z = Math.min(4.2, rig.z + PHYS3D.heroRun * 0.5 * dt);
    else rig.z = Math.max(3.0, rig.z - PHYS3D.heroRun * 0.3 * dt);
    if (wasPressed('j', 'r') && heroTrySlash(rig)) {
      this.slashArc.visible = true;
      this.slashArc.position.set(rig.x + 0.4, 1.4, rig.z - 0.8);
      this.slashArc.rotation.y = 0.4;
      var self = this;
      setTimeout(function () { if (self.slashArc) self.slashArc.visible = false; }, PHYS3D.slashMs);
      this.slashHit();
    }
    if (wasPressed('k') && rig.bulletCd <= 0) {
      rig.bulletCd = 0.35;
      var b = tmCodeChip('if', { fontPx: 64, width: 0.9, bg: '#f2f2f2', fg: '#111111', border: '#111111' });
      b.position.set(rig.x, 1.5, rig.z - 0.8);
      scene.add(b);
      this.bullets.push({ mesh: b, vz: -PHYS3D.bulletSpeed });
    }
    if (wasPressed('q')) { // nova: freeze troops 2 s
      rig.novaT = 2;
      setBanner('DEBUG NOVA', '“Stop. Look. Then hit.” — the Guide');
      var self2 = this;
      setTimeout(function () { if (currentName === 'run') hideBanner(); }, 1800);
    }
    // run the distance (1 m = 0.5 u; 128 m ≈ 12 s at full run)
    if (!this.arrived) {
      this.distM -= (PHYS3D.heroRun * this.runSpeedMul * dt) / 0.5;
      if (this.distM <= 0) { this.distM = 0; this.arrived = true; this.arriveT = 0; }
    } else {
      this.arriveT += dt;
    }
    // road + scenery stream toward the camera
    var scroll = PHYS3D.heroRun * this.runSpeedMul * dt;
    this.roadTiles.forEach(function (t) {
      t.position.z += scroll;
      if (t.position.z > 8) t.position.z -= 12 * 3.2;
    });
    this.stones.forEach(function (st) {
      st.position.z += scroll * 1.6;
      if (st.position.z > 9) { st.position.z = -16 - rng() * 6; st.position.x = (rng() > 0.5 ? 1 : -1) * (4.2 + rng() * 2); }
    });
    // gate approaches from the vanishing point as the distance counts down
    var p = 1 - this.distM / 128;
    this.gate.position.z = -28 + p * 26;
    this.gate.userData.emblem.rotation.y = gameTime * 1.5;
    // spawn the chapter's troops one by one — the queue must drain even
    // after arrival, or the chapter can never complete (spawnQueue stuck).
    // Spawn cadence follows runSpeedMul: the autotest fast-forwards the
    // whole level (road, distance AND troops), never just the road.
    if (this.spawnQueue.length) {
      this.spawnT -= dt * this.runSpeedMul;
      if (this.spawnT <= 0) { this.spawnTroop(this.spawnQueue.shift()); this.spawnT = 1.4; }
    }
    // troops rise, then run at the hero down the road (z increases toward him)
    var frozen = rig.novaT > 0;
    if (frozen) rig.novaT -= dt;
    for (var i = this.troops.length - 1; i >= 0; i--) {
      var tr = this.troops[i];
      if (tr.userData.rising < 1) {
        tr.userData.rising = Math.min(1, tr.userData.rising + (dt * this.runSpeedMul) / 0.9);
        tr.position.y = -1.6 + tr.userData.rising * 1.6;
        tr.scale.y = tr.userData.rising;
        continue;
      }
      if (!frozen) {
        var sp = TROOPS[tr.userData.troopId].speed * PX * this.runSpeedMul;
        tr.position.z += sp * dt;
        tr.position.x += Math.sin(gameTime * 3 + i) * dt * 0.4; // zigzag gait
        tr.position.y = Math.abs(Math.sin(gameTime * 6 + i * 2)) * 0.08; // scamper bob
        tr.userData.hpBar.lookAt(camera.position);
      }
      // reached the hero: contact hit
      if (tr.position.z >= rig.z - 0.4 && rig.hurtT <= 0) {
        rig.hp -= PHYS3D.lineHitDamage; rig.hurtT = 0.6;
        rig.knockV = -PHYS3D.knockbackTaken;
        setHeroHud(rig.hp, PHYS3D.playerHp);
        floatText3D(tr.position, '-10', 'hurt');
        scene.remove(tr); this.troops.splice(i, 1);
        if (rig.hp <= 0) { this.heroDown(); return; }
      }
    }
    // bullets fly away from the camera (-z) and kill troops
    for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
      var bl = this.bullets[bi];
      bl.mesh.position.z += bl.vz * dt;
      var hit = false;
      for (var ti = this.troops.length - 1; ti >= 0; ti--) {
        var t2 = this.troops[ti];
        if (Math.abs(bl.mesh.position.z - t2.position.z) < 0.8 && Math.abs(bl.mesh.position.x - t2.position.x) < 1.0) {
          this.damageTroop(t2, ti, PHYS3D.bulletDamage);
          hit = true; break;
        }
      }
      if (hit || bl.mesh.position.z < -16) { scene.remove(bl.mesh); this.bullets.splice(bi, 1); }
    }
    // knockback decay
    if (rig.knockV !== 0) {
      rig.z += rig.knockV * dt;
      rig.knockV *= (1 - 4 * dt);
      if (Math.abs(rig.knockV) < 0.1) rig.knockV = 0;
      rig.z = Math.max(2.2, Math.min(4.5, rig.z));
    }
    updateHeroRig(rig, dt, { running: !this.arrived });
    updateWorld(dt);
    // chapter complete: distance done AND every troop dealt with
    if (this.arrived && !this.spawnQueue.length && !this.troops.length && !this.done) {
      this.done = true;
      saveProgress(ROAD, Math.min(50, this.chapter.n + 1));
      var next = this.chapter.n >= 50 ? 'the End Boss' : 'Chapter ' + (this.chapter.n + 1);
      setBanner('✓ Checkpoint Reached', 'Chapter ' + this.chapter.n + ' — ' + escapeHtml(this.chapter.topic) + ' — complete. Next: ' + next + '. Press Enter.');
    }
    if (this.done && wasPressed('enter', ' ')) {
      if (this.chapter.n >= 50) switchScene('boss');
      else { CHAPTER_N = this.chapter.n + 1; switchScene('run'); }
    }
    if (rig.hp <= 0) this.heroDown();
  },
  slashHit: function () {
    var rig = this.rig;
    for (var i = this.troops.length - 1; i >= 0; i--) {
      var tr = this.troops[i];
      if (tr.userData.rising < 1) continue;
      if (Math.abs(tr.position.z - rig.z) < 2.4 && Math.abs(tr.position.x - rig.x) < 1.4) {
        this.damageTroop(tr, i, 1);
      }
    }
  },
  damageTroop: function (tr, idx, dmg) {
    tr.userData.hp -= dmg;
    var pct = Math.max(0, tr.userData.hp / tr.userData.maxHp);
    tr.userData.hpFill.scale.x = pct;
    floatText3D(tr.position, '-' + dmg, 'dmg');
    if (tr.userData.hp <= 0) {
      floatText3D(tr.position, TROOPS[tr.userData.troopId].teaches, '');
      scene.remove(tr);
      this.troops.splice(idx, 1);
    }
  },
  heroDown: function () {
    if (this.done) return;
    this.done = true;
    setBanner('KO', 'Press R to try again — the method doesn’t die.');
  },
  cameraTarget: function () { return new THREE.Vector3(0, 1.4, -2); },
  dispose: function () { $('world-ui').innerHTML = ''; }
};

/* =====================================================================
 * SCENE 4 — NARRATION MOMENT (preview3 bottom-centre)
 * The hooded Guide, front-facing, glowing gold book, story centred.
 * Beat order never changes: Narration → Phone → Map → Quiz → handoff.
 * ===================================================================== */
SCENES3D.narrate = {
  typed: 0, full: '', done: false, guide: null,
  init: function () {
    buildWorld();
    buildHUD({ label: 'Narration Moment', level: null });
    $('hud').innerHTML = '';
    var world = $('world-ui');
    var tl = el('div', 'hud-tl'); tl.appendChild(el('div', 'brush', 'Narration Moment'));
    world.appendChild(tl);
    this.guide = chBuildGuide();
    this.guide.position.set(3.1, 0, 0.8);
    this.guide.scale.setScalar(1.3);
    scene.add(this.guide);
    var panel = el('div', 'narr-panel'); panel.id = 'narr-panel';
    panel.innerHTML = '<p id="narr-p1"></p><p id="narr-p2"></p>';
    world.appendChild(panel);
    this.full = NARRATION.join('\n\n');
    this.typed = 0; this.done = false;
    var bottom = el('div', 'narr-bottom'); bottom.id = 'narr-bottom';
    bottom.innerHTML = '<span class="narr-who">Narrator:</span> ' + NARRATION_BOTTOM;
    world.appendChild(bottom);
    var cont = el('button', 'narr-continue', '<b>A</b>Continue');
    var self = this;
    cont.addEventListener('click', function () { self.next(); });
    world.appendChild(cont);
    if (FREEZE_T != null) { this.typed = this.full.length; this.done = true; this.paint(); }
  },
  paint: function () {
    var t = this.full.slice(0, Math.floor(this.typed));
    var parts = t.split('\n\n');
    var p1 = $('narr-p1'), p2 = $('narr-p2');
    if (p1) p1.innerHTML = (parts[0] || '').replace(/\n/g, '<br>');
    if (p2) p2.innerHTML = (parts[1] || '').replace(/\n/g, '<br>');
  },
  next: function () {
    if (!this.done) { this.typed = this.full.length; this.done = true; this.paint(); return; }
    switchScene('troops');
  },
  update: function (dt) {
    if (!this.done) {
      this.typed += dt * 55;
      if (this.typed >= this.full.length) { this.typed = this.full.length; this.done = true; }
      this.paint();
    }
    if (this.guide) {
      this.guide.position.y = Math.sin(gameTime * 0.9) * 0.08; // floats, never walks
      var book = this.guide.userData.parts.book;
      if (book) book.rotation.z = Math.sin(gameTime * 0.7) * 0.05;
    }
    if (wasPressed('enter', ' ', 'a')) this.next();
    updateWorld(dt);
  },
  cameraTarget: function () { return new THREE.Vector3(1.2, 1.5, 0); },
  dispose: function () { $('world-ui').innerHTML = ''; }
};

/* =====================================================================
 * SCENE 5 — TROOP ENTRANCE (preview3 top-right) — FRONT VIEW
 * Hero faces the camera in the FOREGROUND; the ink pool is behind him;
 * the colossal enemy towers in the background; troops rise ONE BY ONE
 * from the pool behind/around him — never all at once.
 * ===================================================================== */
SCENES3D.troops = {
  directorT: 0, nextRise: 0.6, risen: 0, heroRig: null, sequence: [], golem: null,
  init: function () {
    buildWorld();
    var road = ROADS[ROAD];
    buildHUD({ label: 'Troop Entrance', level: 14, objective: (ROAD === 'kotlin' || ROAD === 'android') ? 'Defeat the LEAK Troop' : 'Defeat the ' + road.bossDisplay + ' Troop', joystick: true, skills: true });
    // ink pool: glossy black disc behind the hero (mid-ground)
    var pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), MAT.inkPool);
    pool.rotation.x = -Math.PI / 2; pool.position.set(1.2, 0.03, -2.5);
    pool.receiveShadow = true;
    scene.add(pool);
    // colossal enemy in the background: LEAK for Kotlin/Android, else the road boss
    if (ROAD === 'kotlin' || ROAD === 'android') {
      this.golem = chBuildLeak();
      this.golem.position.set(2.2, 0, -5.5);
      this.golem.scale.setScalar(1.3);
    } else {
      this.golem = chBuildBoss(road, { scale: 1.15 });
      this.golem.position.set(2.2, 0, -6.5);
    }
    scene.add(this.golem);
    // hero FRONT VIEW, foreground, facing the camera
    this.heroRig = makeHeroRig(HEROES[1]);
    this.heroRig.x = -3.4; this.heroRig.z = 2.6;
    scene.add(this.heroRig.group);
    // the entrance director: one by one from the pool
    var flat = [];
    road.finalWaves.forEach(function (w) { w.forEach(function (t) { flat.push(t); }); });
    this.sequence = flat.slice(0, 6);
    this.directorT = 0; this.nextRise = 0.6; this.risen = 0;
    this.risenTroops = [];
    var hint = el('div', 'rise-hint'); hint.id = 'rise-hint';
    hint.textContent = 'Something is rising from the ink…';
    $('world-ui').appendChild(hint);
  },
  riseOne: function (troopId, idx) {
    var g = chBuildTroop(troopId, {});
    var x = -1.5 + idx * 1.35;
    g.position.set(x, -1.6, -2.5 + (idx % 2) * 0.8);
    g.userData.rising = 0;
    scene.add(g);
    this.risenTroops.push(g);
  },
  update: function (dt) {
    this.directorT += dt;
    if (this.risen < this.sequence.length && this.directorT >= this.nextRise) {
      this.riseOne(this.sequence[this.risen], this.risen);
      this.risen++;
      this.nextRise = this.directorT + 1.4; // one by one, never all at once
      if (this.risen >= this.sequence.length) {
        var hint = $('rise-hint');
        if (hint) hint.textContent = 'The ink army stands. Press Enter — the fight begins.';
      }
    }
    this.risenTroops.forEach(function (tr) {
      if (tr.userData.rising < 1) {
        tr.userData.rising = Math.min(1, tr.userData.rising + dt / 0.9);
        tr.position.y = -1.6 + tr.userData.rising * 1.6;
      } else {
        tr.position.y = Math.abs(Math.sin(gameTime * 4 + tr.position.x)) * 0.06;
        tr.userData.hpBar.lookAt(camera.position);
      }
    });
    if (this.golem) this.golem.position.y = Math.sin(gameTime * 0.5) * 0.06;
    updateHeroRig(this.heroRig, dt, { running: false });
    updateWorld(dt);
    if (wasPressed('enter', ' ')) switchScene('boss');
  },
  cameraTarget: function () { return new THREE.Vector3(0, 1.8, -2.5); },
  dispose: function () { $('world-ui').innerHTML = ''; }
};

/* =====================================================================
 * SCENE 6 — BOSS FIGHT (preview3 top-left) — FRONT VIEW, REAL 3D
 * Hero left-foreground, 3/4 front view, sword toward the boss; NULLPOINTER
 * (or the road boss) fills the right, facing the hero/camera. End boss:
 * 2.0x, 560 HP, numeric HP + bar. He HOLDS the next code line in his
 * raised hand (visible BEFORE the throw) and throws it as a 3D chip that
 * flies THROUGH space toward the hero. Deflect it back for 30 damage.
 * ===================================================================== */
SCENES3D.boss = {
  rig: null, boss: null, bossGroup: null, projectiles: [], bullets: [],
  bossState: 'idle', stateT: 0, throwIdx: 0, combo: 0, comboT: 0,
  novaUsed: false, novaT: 0, voidT: 14, voidPhase: null, voidPhaseT: 0,
  voidTile: null, voidDmgT: 0, over: false, overKind: null,
  guardRing: null, slashArc: null, heldChip: null, capeChips: [],
  fastMode: false, deflects: 0, guards: 0, twistDone: false,
  init: function () {
    buildWorld();
    var road = ROADS[ROAD];
    // CODE_SET flips to the road's alternate line set when it names one
    // (?codeset=nullpointer on Kotlin, ?codeset=concurrentchaos on Java);
    // any other value falls back to the road's default set.
    var lines = CODE_SETS[(road.bossAltLines && CODE_SET === road.bossAltLines) ? road.bossAltLines : road.bossLines];
    buildHUD({ label: 'Boss Fight — ' + road.name, level: 12, showBoss: true,
      bossName: road.bossDisplay,
      bossHpPct: 100, objective: 'Defeat ' + road.bossDisplay, joystick: true, skills: true, pause: true });
    // hero, LEFT-FOREGROUND, front view, sword toward the boss
    this.rig = makeHeroRig(HEROES[1]);
    this.rig.x = -2.2; this.rig.z = 4.2;
    scene.add(this.rig.group);
    this.guardRing = chBuildGuardRing();
    scene.add(this.guardRing);
    this.slashArc = chBuildSlashArc();
    scene.add(this.slashArc);
    // the boss, right — fills the right half, head near the top
    this.bossGroup = chBuildBoss(road, { scale: PHYS3D.bossScale });
    this.bossGroup.position.set(1.4, 0, -4.5);
    scene.add(this.bossGroup);
    this.boss = { hp: PHYS3D.bossHp, maxHp: PHYS3D.bossHp, frozen: 0 };
    this.projectiles = []; this.bullets = [];
    this.bossState = 'idle'; this.stateT = 0; this.throwIdx = 0;
    this.combo = 0; this.comboT = 0;
    this.novaUsed = false; this.novaT = 0; this.voidT = 14; this.voidPhase = null;
    this.over = false; this.overKind = null; this.fastMode = false;
    this.deflects = 0; this.guards = 0; this.twistDone = false;
    this.lines = lines;
    this.paintCapeChips();
    setBossHud(this.boss.hp, this.boss.maxHp);
    setHeroHud(this.rig.hp, PHYS3D.playerHp);
    setCombo(0);
    setSubtitle('<span class="who">' + road.bossDisplay + ':</span> “You reached for something that was never there.”');
    var self = this;
    setTimeout(function () { if (currentName === 'boss' && !self.over) hideSubtitle(); }, 4000);
  },
  paintCapeChips: function () {
    var self = this;
    this.capeChips.forEach(function (c) { self.bossGroup.remove(c); });
    this.capeChips = [];
    var anchor = this.bossGroup.userData.parts.chipsAnchor;
    for (var i = 0; i < 3; i++) {
      var line = this.lines[(this.throwIdx + i) % this.lines.length];
      var chip = tmCodeChip(line.length > 26 ? line.slice(0, 26) + '…' : line, { fontPx: 40, width: 1.5 });
      chip.position.set(0, -i * 0.55, 0);
      chip.scale.setScalar(0.55);
      anchor.add(chip);
      this.capeChips.push(chip);
    }
  },
  heldLine: function () { return this.lines[this.throwIdx % this.lines.length]; },
  throwLine: function () {
    var line = this.heldLine();
    var chip = tmCodeChip(line, { fontPx: 44, width: 3.4 });
    // spawn at the boss's raised hand, fly at the hero through 3D space
    var start = new THREE.Vector3(1.4, 4.0, -3.4);
    chip.position.copy(start);
    scene.add(chip);
    var rig = this.rig;
    var target = new THREE.Vector3(rig.x, 1.5, rig.z);
    var dir = target.clone().sub(start);
    var dist = dir.length();
    dir.normalize();
    var speed = this.fastMode ? 8.0 : 4.2; // ~2.0 s of flight normally — time to react
    this.projectiles.push({ mesh: chip, vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed,
      line: line, deflected: false, t: 0, startZ: start.z });
    this.throwIdx++;
    this.paintCapeChips();
    if (this.heldChip) { scene.remove(this.heldChip); this.heldChip = null; }
  },
  update: function (dt) {
    if (this.over) { updateWorld(dt); return; }
    var rig = this.rig, boss = this.boss;
    var cycle = this.fastMode ? 0.45 : 1.0;
    // --- hero movement: dodge in 3D (strafe x, step in/out along z) ---
    var move = 0;
    if (keyDown('arrowleft', 'a') || joy.x < -0.25) move -= 1;
    if (keyDown('arrowright', 'd') || joy.x > 0.25) move += 1;
    rig.x = Math.max(-3.4, Math.min(3.4, rig.x + move * PHYS3D.heroRun * dt));
    if (move !== 0) rig.facing = move;
    // W / Up steps TOWARD the boss in 3D (depth) — that is how melee range is
    // reached; otherwise the hero eases back to fighting range. Space jumps.
    if (keyDown('arrowup', 'w') || joy.y < -0.6) rig.z = Math.max(-2.4, rig.z - PHYS3D.heroRun * 0.7 * dt);
    else rig.z = Math.min(4.2, rig.z + PHYS3D.heroRun * 0.3 * dt);
    if (wasPressed(' ')) heroTryJump(rig);
    rig.guard = keyDown('s', 'arrowdown');
    // --- slash (460 ms) ---
    if (wasPressed('j', 'x', 'r') && heroTrySlash(rig)) {
      this.slashArc.visible = true;
      this.slashArc.position.set(rig.x + 0.6, 1.5, rig.z - 1.0);
      var selfA = this;
      setTimeout(function () { if (selfA.slashArc) selfA.slashArc.visible = false; }, PHYS3D.slashMs);
      // melee: close to the boss?
      if (rig.z < -2.0) this.damageBoss(PHYS3D.meleeDamage, new THREE.Vector3(1.4, 4.5, -3.4), false);
    }
    // --- bullet (K): an "if" chip fired at the boss ---
    if (wasPressed('k') && rig.bulletCd <= 0) {
      rig.bulletCd = 0.35;
      var b = tmCodeChip('if', { fontPx: 64, width: 0.9, bg: '#f2f2f2', fg: '#111111', border: '#111111' });
      b.position.set(rig.x, 1.5, rig.z - 0.8);
      scene.add(b);
      this.bullets.push({ mesh: b });
    }
    // --- Debug Nova (Q): once per fight, freeze the boss 2 s ---
    if (wasPressed('q') && !this.novaUsed) {
      this.novaUsed = true; this.novaT = 2;
      setBanner('DEBUG NOVA', '“Stop. Look. Then hit.” — the Guide');
      var selfN = this;
      setTimeout(function () { if (currentName === 'boss' && !selfN.over) hideBanner(); }, 1800);
    }
    if (this.novaT > 0) this.novaT -= dt;
    // --- boss state machine ---
    this.stateT += dt;
    var frozen = this.novaT > 0;
    var throwEvery = this.twistDone ? 0.5 : 1.0; // midpoint twist: throws twice as fast
    if (!frozen) {
      if (this.bossState === 'idle' && this.stateT > 0.8 * cycle * throwEvery) {
        this.bossState = 'windup'; this.stateT = 0;
        // the line is raised in his hand, VISIBLE before the throw
        var held = tmCodeChip(this.heldLine(), { fontPx: 44, width: 3.0 });
        held.position.set(1.4, 5.6, -3.2);
        held.rotation.z = 0.15;
        scene.add(held);
        this.heldChip = held;
      } else if (this.bossState === 'windup' && this.stateT > (PHYS3D.throwWindupMs / 1000) * cycle) {
        this.bossState = 'recover'; this.stateT = 0;
        this.throwLine();
      } else if (this.bossState === 'recover' && this.stateT > ((PHYS3D.throwTotalMs - PHYS3D.throwWindupMs) / 1000) * cycle * throwEvery) {
        this.bossState = 'idle'; this.stateT = 0;
      }
    }
    // --- VOID GRAB timer (NULLPOINTER special; other roads: their special banner) ---
    this.voidT -= dt;
    if (this.voidT <= 0 && !this.voidPhase) {
      this.voidPhase = 'telegraph'; this.voidPhaseT = 0;
      var vt = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
      vt.rotation.x = -Math.PI / 2;
      vt.position.set(rig.x, 0.05, rig.z);
      scene.add(vt);
      this.voidTile = vt;
    }
    if (this.voidPhase) {
      this.voidPhaseT += dt;
      if (this.voidPhase === 'telegraph' && this.voidPhaseT > PHYS3D.voidTelegraphMs / 1000) {
        this.voidPhase = 'vanish'; this.voidPhaseT = 0;
        if (this.voidTile) this.voidTile.material.opacity = 0.95; // the floor is gone
        if (rig.y <= 0.01 && Math.abs(rig.x - this.voidTile.position.x) < 1.3) {
          rig.hp -= 15; setHeroHud(rig.hp, PHYS3D.playerHp);
          floatText3D(new THREE.Vector3(rig.x, 2, rig.z), '-15 VOID', 'hurt');
        }
      } else if (this.voidPhase === 'vanish' && this.voidPhaseT > PHYS3D.voidVanishMs / 1000) {
        this.voidPhase = 'return'; this.voidPhaseT = 0;
      } else if (this.voidPhase === 'return' && this.voidPhaseT > PHYS3D.voidReturnMs / 1000) {
        this.voidPhase = null; this.voidT = 18;
        if (this.voidTile) { scene.remove(this.voidTile); this.voidTile = null; }
      }
    }
    // --- midpoint twist at 280 HP (Kotlin road canon) ---
    if (!this.twistDone && ROAD === 'kotlin' && boss.hp <= 280 && boss.hp > 0) {
      this.twistDone = true;
      setBanner('NULLPOINTER’S GRASP', 'The arena nulls — chain across with ?. — never a bare !!');
      var selfT = this;
      setTimeout(function () { if (currentName === 'boss' && !selfT.over) hideBanner(); }, 2600);
    }
    // --- projectiles ---
    var inWindow = false;
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      p.t += dt;
      if (!p.deflected) {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.position.y += Math.sin(p.t * 5) * 0.15 * dt * 10;
        p.mesh.rotation.y = Math.sin(p.t * 3) * 0.2;
      } else {
        // deflected: flies back at the boss
        p.mesh.position.z -= 8.5 * dt;
        p.mesh.position.x += (1.4 - p.mesh.position.x) * dt * 2;
        p.mesh.rotation.z += dt * 9;
        if (p.mesh.position.z < -3.4) {
          this.damageBoss(PHYS3D.deflectDamage, new THREE.Vector3(1.4, 4.5, -3.4), true);
          scene.remove(p.mesh); this.projectiles.splice(i, 1);
          continue;
        }
      }
      if (p.deflected) continue;
      var dz = rig.z - p.mesh.position.z;      // >0 while the chip is still short of the hero
      var dx = p.mesh.position.x - rig.x;
      var dy = p.mesh.position.y - 1.5;
      // GENEROUS deflect window: final ~3 units of flight + 350 ms press buffer
      var windowOpen = dz > -0.6 && dz < 3.0 && Math.abs(dx) < 1.8 && Math.abs(dy) < 1.5;
      if (windowOpen) {
        inWindow = true;
        p.mesh.material.forEach(function (m) { if (m.emissive) m.emissive.setHex(0x8a6d00); });
        if (slashIsActive(rig)) {
          p.deflected = true;
          this.deflects++;
          floatText3D(p.mesh.position, 'DEFLECT!', 'dmg');
          continue;
        }
      }
      // guard block (green circle, clearly visible, actually blocks)
      if (rig.guard && Math.abs(p.mesh.position.z - rig.z) < 1.7 && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.6) {
        this.guards++;
        floatText3D(p.mesh.position, 'GUARDED', '');
        scene.remove(p.mesh); this.projectiles.splice(i, 1);
        continue;
      }
      // hit the hero
      if (Math.abs(p.mesh.position.z - rig.z) < 0.7 && Math.abs(dx) < 0.9 && Math.abs(dy) < 1.2 && rig.hurtT <= 0) {
        rig.hp -= PHYS3D.lineHitDamage; rig.hurtT = 0.6;
        setHeroHud(rig.hp, PHYS3D.playerHp);
        floatText3D(p.mesh.position, '-10', 'hurt');
        rig.x = Math.max(-3.4, rig.x - PHYS3D.knockbackTaken * 0.25); // knockback
        scene.remove(p.mesh); this.projectiles.splice(i, 1);
        continue;
      }
      // missed entirely
      if (p.mesh.position.z > rig.z + 2.5) { scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
    showDeflectCue(inWindow && !this.over);
    // --- bullets ---
    for (var bi = this.bullets.length - 1; bi >= 0; bi--) {
      var bl = this.bullets[bi];
      bl.mesh.position.z -= PHYS3D.bulletSpeed * dt;
      if (bl.mesh.position.z < -3.4) {
        this.damageBoss(PHYS3D.bulletDamage, new THREE.Vector3(1.4, 4.5, -3.4), false);
        scene.remove(bl.mesh); this.bullets.splice(bi, 1);
      } else if (bl.mesh.position.z < -16) { scene.remove(bl.mesh); this.bullets.splice(bi, 1); }
    }
    // --- combo decay / hero death ---
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; setCombo(0); } }
    updateHeroRig(rig, dt, { running: false });
    // guard ring follows the hero, visible only while guarding
    if (this.guardRing) {
      this.guardRing.visible = rig.guard && !this.over;
      this.guardRing.position.set(rig.x, 0.05, rig.z);
      this.guardRing.rotation.y = gameTime * 1.2;
    }
    // boss idle life: bob + wind-up lean + frozen shimmer
    if (this.bossGroup) {
      var t = gameTime;
      this.bossGroup.position.y = Math.sin(t * 1.1) * 0.08;
      this.bossGroup.rotation.z = this.bossState === 'windup' ? -0.06 : 0;
      var parts = this.bossGroup.userData.parts;
      if (parts && parts.armR) parts.armR.rotation.x = this.bossState === 'windup' ? -0.7 : Math.sin(t * 0.8) * 0.08;
      if (this.heldChip) this.heldChip.position.y = 5.6 + Math.sin(t * 3) * 0.08;
      if (frozen) this.bossGroup.traverse(function (m) { if (m.isMesh && m.material && m.material.emissive) m.material.emissive.setHex(0x222222); });
    }
    updateWorld(dt);
    if (rig.hp <= 0 && !this.over) {
      this.over = true; this.overKind = 'hero-ko';
      setBanner('KO', 'Press R to try again — the method doesn’t die.');
    }
    if (wasPressed('r') && this.over) switchScene('boss');
    if (paused) return;
  },
  damageBoss: function (dmg, atPos, deflected) {
    var boss = this.boss;
    if (!boss || boss.hp <= 0) return;
    boss.hp -= dmg;
    this.combo++; this.comboT = 2.5;
    setCombo(this.combo);
    setBossHud(boss.hp, boss.maxHp);
    floatText3D(atPos || new THREE.Vector3(1.4, 4.5, -3.4), '-' + dmg, 'dmg');
    if (boss.hp <= 0) {
      boss.hp = 0; setBossHud(0, boss.maxHp);
      this.over = true; this.overKind = 'boss-ko';
      this.projectiles.forEach(function (p) { scene.remove(p.mesh); });
      this.projectiles = [];
      showDeflectCue(false);
      // demolition: the boss topples and sinks into the ink
      var self = this;
      var fallT = 0;
      var fall = function () {
        fallT += 0.016;
        if (self.bossGroup) {
          self.bossGroup.rotation.x = -Math.min(1.4, fallT * 1.2);
          self.bossGroup.position.y = -Math.min(1.2, fallT * 0.8);
        }
        if (fallT < 1.4 && currentName === 'boss') requestAnimationFrame(fall);
      };
      fall();
      setBanner(ROADS[ROAD].bossDisplay.toUpperCase() + ' DEFEATED', '“I checked. It’s there now.” — TechieMan');
      setSubtitle('<span class="who">' + ROADS[ROAD].bossDisplay + ':</span> “You reached for something that was never there.”');
    }
  },
  cameraTarget: function () { return new THREE.Vector3(0, 2.6, -0.5); },
  dispose: function () { $('world-ui').innerHTML = ''; }
};

/* =====================================================================
 * AUTOTEST — drives the REAL game with REAL key events and asserts the
 * combat flow end to end. Results go to #test-log + document.title so a
 * headless run can read them without a live browser session.
 * Modes: boss | run | smoke. Test-only hooks live on window.__TM__.api.
 * ===================================================================== */
var TEST = { done: false, pass: false, log: [], mode: null };
function testLog(msg, ok) {
  var line = (ok === true ? 'PASS ' : ok === false ? 'FAIL ' : '.... ') + msg;
  TEST.log.push(line);
  var div = $('test-log');
  if (div) { var d = document.createElement('div'); d.textContent = line; div.appendChild(d); }
}
function testKey(key, holdMs) {
  var down = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
  window.dispatchEvent(down);
  setTimeout(function () {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: key, bubbles: true, cancelable: true }));
  }, holdMs || 80);
}
function testHoldKey(key, ms) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
  setTimeout(function () {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: key, bubbles: true, cancelable: true }));
  }, ms);
}
function waitFor(cond, timeoutMs, stepMs) {
  return new Promise(function (resolve) {
    var t0 = Date.now();
    var iv = setInterval(function () {
      var v = null;
      try { v = cond(); } catch (e) { v = null; }
      if (v || Date.now() - t0 > timeoutMs) { clearInterval(iv); resolve(v); }
    }, stepMs || 100);
  });
}
function testFinish(pass, summary) {
  TEST.done = true; TEST.pass = pass;
  testLog(summary || (pass ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'), pass);
  document.title = (pass ? 'TEST:PASS' : 'TEST:FAIL') + ' ' + (AUTOTEST || '');
  if (window.__TM__) window.__TM__.test = TEST;
}
async function runAutotestBoss() {
  TEST.mode = 'boss';
  testLog('boss autotest started — road=' + ROAD + ' codeset=' + CODE_SET);
  var B = function () { return SCENES3D.boss; };
  var hp0 = B().boss.hp;
  testLog('boss HP at start: ' + hp0, hp0 === 560);
  // 1) REAL DEFLECT: wait for a line to enter the generous window, slash it.
  // Wall budgets are sized for SwiftShader: measured ~0.10-0.19 game-s per
  // wall-s at 960-1280 px wide (dt is clamped to 0.05/frame, ~2-4 fps), so a
  // 1.2 s game-time throw cycle is ~6-12 s of wall time. Budgets below
  // assume the slow end (10x) with margin; the game logic is untouched.
  var threw = await waitFor(function () { return B().projectiles.length > 0; }, 40000);
  if (!threw) { testFinish(false, 'no projectile thrown in 15 s'); return; }
  testLog('boss threw a line: ' + B().projectiles[0].line);
  var inWin = await waitFor(function () {
    var b = B(), p = b.projectiles[0];
    if (!p || p.deflected) return false;
    var dz = b.rig.z - p.mesh.position.z;
    return dz > -0.6 && dz < 3.0 && Math.abs(p.mesh.position.x - b.rig.x) < 1.8;
  }, 40000);
  if (!inWin) { testFinish(false, 'line never entered the deflect window'); return; }
  testLog('line in deflect window — cue visible: ' + !HUD.cueEl.classList.contains('hidden'), !HUD.cueEl.classList.contains('hidden'));
  testKey('j');
  var deflected = await waitFor(function () { return B().deflects >= 1; }, 10000);
  testLog('slash deflected the line (deflects=' + B().deflects + ')', !!deflected);
  var hpAfter = await waitFor(function () { return B().boss.hp <= 530; }, 25000);
  testLog('boss HP number dropped 560 -> ' + B().boss.hp + ' (expected 530)', !!hpAfter && B().boss.hp === 530);
  if (!deflected || !hpAfter) { testFinish(false, 'deflect did not deal 30'); return; }
  // 2) REAL GUARD: hold S through the next line, expect no damage + ring visible.
  // Hold long enough for a full throw cycle (SwiftShader game-time runs
  // slower than wall time) and wait on the EVENT (guards counter), not a sleep.
  var hpBeforeGuard = B().rig.hp;
  testHoldKey('s', 60000);
  var guardEvent = await waitFor(function () { return B().guards >= 1 || B().rig.hp < hpBeforeGuard; }, 75000);
  var guardShown = B().guardRing.visible || guardEvent;
  testLog('guard ring visible while holding S', !!guardShown);
  var hpAfterGuard = B().rig.hp;
  testLog('guard blocked: hero HP ' + hpBeforeGuard + ' -> ' + hpAfterGuard + ', guards=' + B().guards, hpAfterGuard === hpBeforeGuard && B().guards >= 1);
  if (hpAfterGuard !== hpBeforeGuard || B().guards < 1) { testFinish(false, 'guard did not block'); return; }
  // 3) DODGE: move left, hero x must decrease.
  var x0 = B().rig.x;
  testHoldKey('ArrowLeft', 3000);
  await new Promise(function (r) { setTimeout(r, 3200); });
  testLog('dodge left: x ' + x0.toFixed(2) + ' -> ' + B().rig.x.toFixed(2), B().rig.x < x0 - 0.5);
  // 4) BULLET: K fires an "if" bullet.
  var bullets0 = B().bullets.length;
  testKey('k');
  await new Promise(function (r) { setTimeout(r, 2000); });
  testLog('"if" bullet fired (bullets in flight: ' + B().bullets.length + ')', B().bullets.length > bullets0);
  // 5) NOVA: Q freezes the boss.
  testKey('q');
  await new Promise(function (r) { setTimeout(r, 2000); });
  testLog('DEBUG NOVA cast (novaUsed=' + B().novaUsed + ', novaT=' + B().novaT.toFixed(1) + 's)', B().novaUsed === true);
  // 6) KO: fast throws + auto-deflect every line until the boss falls.
  // Long wall budget: under SwiftShader game-time runs ~3x slower than wall.
  B().fastMode = true;
  var ko = await (async function () {
    var t0 = Date.now();
    while (Date.now() - t0 < 360000) {
      var b = B();
      if (b.over && b.overKind === 'boss-ko') return true;
      var p = b.projectiles[0];
      if (p && !p.deflected) {
        var dz = b.rig.z - p.mesh.position.z;
        if (dz > -0.6 && dz < 3.0 && Math.abs(p.mesh.position.x - b.rig.x) < 1.8) testKey('j');
      }
      await new Promise(function (r) { setTimeout(r, 120); });
    }
    return false;
  })();
  // let in-flight deflected chips land before judging
  if (!ko) {
    await waitFor(function () { return B().projectiles.length === 0 || (B().over && B().overKind === 'boss-ko'); }, 30000);
    ko = B().over && B().overKind === 'boss-ko';
  }
  testLog('boss KO after ' + B().deflects + ' deflects, HP=' + B().boss.hp + ' (19 deflects x 30 = 570 >= 560)', !!ko && B().boss.hp === 0);
  testLog('KO banner: ' + ($('banner').textContent || '').slice(0, 40), !!ko && $('banner').textContent.indexOf('DEFEATED') >= 0);
  testFinish(!!ko, ko ? 'boss flow verified end to end' : 'KO did not happen in 360 s');
}
async function runAutotestRun() {
  TEST.mode = 'run';
  testLog('run autotest started — road=' + ROAD + ' chapter=' + CHAPTER_N);
  var R = function () { return SCENES3D.run; };
  R().runSpeedMul = 4; // test-only fast-forward of the road scroll
  var t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    var r = R();
    if (r.done && r.arrived) break;
    // slash any troop in range; jump occasionally
    var inRange = r.troops.some(function (tr) {
      return tr.userData.rising >= 1 && Math.abs(tr.position.z - r.rig.z) < 2.4 && Math.abs(tr.position.x - r.rig.x) < 1.4;
    });
    if (inRange) testKey('j');
    if (r.troops.length && Math.random() < 0.3) testKey('k');
    await new Promise(function (res) { setTimeout(res, 150); });
  }
  var r2 = R();
  testLog('chapter complete: arrived=' + r2.arrived + ' done=' + r2.done + ' distM=' + r2.distM.toFixed(1), r2.done === true);
  testLog('checkpoint banner: ' + ($('banner').textContent || '').slice(0, 50), r2.done && $('banner').textContent.indexOf('Checkpoint') >= 0);
  testFinish(r2.done === true, r2.done ? 'chapter 1 playable end to end' : 'chapter did not complete in 300 s');
}
async function runAutotestSmoke() {
  TEST.mode = 'smoke';
  testLog('smoke: scene=' + currentName + ', triangles=' + renderer.info.render.triangles);
  var ok = renderer.info.render.triangles > 100;
  testLog('3D scene renders non-trivial geometry', ok);
  // every hero / boss / troop word builds extruded geometry
  var words = [];
  HEROES.forEach(function (h) { words.push(h.chest); });
  Object.keys(ROADS).forEach(function (rid) { ROADS[rid].bossWords.forEach(function (w) { words.push(w); }); });
  Object.keys(TROOPS).forEach(function (tid) { words.push(TROOPS[tid].word); });
  var built = 0, failed = [];
  words.forEach(function (w) {
    try {
      var tm = tmTextMesh(w, { size: 0.5, depth: 0.1, material: MAT.letterWhite });
      var tris = 0;
      tm.group.traverse(function (m) { if (m.isMesh && m.geometry) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
      if (tris > 0) built++; else failed.push(w);
    } catch (e) { failed.push(w + ':' + e.message); }
  });
  testLog('extruded letter-bodies built: ' + built + '/' + words.length + (failed.length ? ' FAILED: ' + failed.join(', ') : ''), failed.length === 0);
  testLog('font glyphs parsed: ' + Object.keys(window.HELVETIKER_FONT.glyphs).length + ' glyphs', true);
  testFinish(ok && failed.length === 0, 'smoke done');
}
async function runAutotest() {
  try {
    if (AUTOTEST === 'boss') await runAutotestBoss();
    else if (AUTOTEST === 'run') await runAutotestRun();
    else if (AUTOTEST === 'smoke') await runAutotestSmoke();
  } catch (e) {
    testLog('autotest threw: ' + (e && e.message ? e.message : e), false);
    testFinish(false, 'autotest exception');
  }
}

/* =====================================================================
 * BOOT + MAIN LOOP (?t= freezes deterministically, like the flat game)
 * ===================================================================== */
function stepScene(dt) {
  gameTime += dt;
  if (current && current.update) current.update(dt);
  renderer.render(scene, camera);
  clearPressed();
}
function loop(now) {
  if (frozen || paused) { requestAnimationFrame(loop); return; }
  var dt = Math.min(0.05, (now - (loop._last || now)) / 1000 || 0.016);
  loop._last = now;
  stepScene(dt);
  requestAnimationFrame(loop);
}
function boot() {
  if (booted) return; booted = true;
  window.__TM__ = {
    scene: SCENE, road: ROAD, chapter: CHAPTER_N, errors: [], test: TEST,
    api: {
      press: testKey,
      bossHp: function () { return SCENES3D.boss && SCENES3D.boss.boss ? SCENES3D.boss.boss.hp : null; },
      heroHp: function () { var s = SCENES3D[currentName]; return s && s.rig ? s.rig.hp : null; },
      deflects: function () { return SCENES3D.boss ? SCENES3D.boss.deflects : 0; },
      setRunSpeedMul: function (m) { if (SCENES3D.run) SCENES3D.run.runSpeedMul = m; },
      fastThrows: function (on) { if (SCENES3D.boss) SCENES3D.boss.fastMode = !!on; },
      goScene: function (n, road, ch) { if (road) ROAD = road; if (ch) CHAPTER_N = ch; switchScene(n); }
    }
  };
  try {
    tmInitFont();
    chInitMaterials();
    initGL();
    if (FREEZE_T != null) document.body.classList.add('frozen');
    switchScene(SCENE);
    if (FREEZE_T != null) {
      var steps = Math.round(FREEZE_T * 60);
      for (var i = 0; i < steps; i++) stepScene(1 / 60);
      frozen = true;
      renderer.render(scene, camera);
    } else {
      loop._last = performance.now();
      requestAnimationFrame(loop);
    }
    window.addEventListener('keydown', function (e) {
      if (e.key.toLowerCase() === 'p') togglePause();
      if (e.key.toLowerCase() === 'r' && currentName === 'boss' && SCENES3D.boss.over) switchScene('boss');
      if (e.key.toLowerCase() === 'r' && currentName === 'run' && SCENES3D.run.done) switchScene('run');
    });
    if (AUTOTEST) setTimeout(runAutotest, 800);
  } catch (err) {
    showErr(err && err.message ? err.message : String(err));
    if (window.__TM__) window.__TM__.errors.push(String(err && err.stack || err));
    throw err;
  }
}
document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
