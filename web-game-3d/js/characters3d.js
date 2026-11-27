/* TECHIEMAN REAL 3D — characters3d.js
 * "Text IS the character": every body is built from its concept's own letters
 * as EXTRUDED 3D geometry (tmTextMesh) plus 3D limbs — real depth, real
 * shadows, real parallax. A screenshot from a second camera angle shows a
 * different face of the same letters: that is the proof this is not flat.
 *
 * Palette (digest §1, previews): grayscale ink world; gold light only on the
 * hero-select spotlight + Guide's book; green ONLY on the guard circle + hero
 * HP; red ONLY on boss HP bar + boss eyes; fire orange ONLY on slash sparks
 * and the dodge trail. Everything else black / white / grey stone.
 */
'use strict';

var MAT = {};
function chInitMaterials() {
  if (MAT.ink) return MAT;
  MAT.ink = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.55, metalness: 0.15 });
  MAT.inkSoft = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.7 });
  MAT.stone = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 0.85, metalness: 0.05 });
  MAT.stoneDark = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });
  MAT.stoneLight = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.8 });
  MAT.letterWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.1 });
  MAT.letterBlack = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.45 });
  MAT.gold = new THREE.MeshStandardMaterial({ color: 0xffd75e, emissive: 0xa67c00, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.6 });
  MAT.goldGlow = new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffc21c, emissiveIntensity: 1.6, roughness: 0.3 });
  MAT.eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 });
  MAT.eyeRed = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 2.2 });
  MAT.green = new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  MAT.greenGhost = new THREE.MeshStandardMaterial({ color: 0x69f0ae, emissive: 0x00e676, emissiveIntensity: 0.5, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  MAT.fireCore = new THREE.MeshStandardMaterial({ color: 0xffe45c, emissive: 0xff9f1c, emissiveIntensity: 2.0 });
  MAT.fireMid = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0xff5a00, emissiveIntensity: 1.4 });
  MAT.inkPool = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.15, metalness: 0.6 });
  MAT.ground = null; // set by world builder (canvas texture)
  return MAT;
}

function chBox(w, h, d, mat, x, y, z) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function chCone(r, h, mat, x, y, z, rx, rz) {
  var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz;
  m.castShadow = true;
  return m;
}
function chSphere(r, mat, x, y, z, sx, sy, sz) {
  var m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (sx) m.scale.set(sx, sy || sx, sz || sx);
  m.castShadow = true;
  return m;
}
function chCyl(rt, rb, h, mat, x, y, z, seg) {
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* --- hero: torso = chest letters, legs = leg letters (vertical columns),
 * spiky hair cones, cape plane, sword whose blade IS the chapter code line. --- */
function chBuildHero(hero, opts) {
  opts = opts || {};
  chInitMaterials();
  var g = new THREE.Group();
  var chest = (HERO_CHEST === 'all-code') ? 'CODE' : hero.chest;
  var S = opts.scale || 1;
  // legs: two columns of small extruded letters (LEARN / CONQUER down each leg)
  var legL = tmTextMesh(hero.legs[0], { size: 0.16, depth: 0.05, material: MAT.letterWhite });
  legL.group.rotation.z = -Math.PI / 2; // letters run DOWN the leg
  legL.group.position.set(-0.30, 0.80, 0.10);
  var legR = tmTextMesh(hero.legs[1], { size: 0.16, depth: 0.05, material: MAT.letterWhite });
  legR.group.rotation.z = -Math.PI / 2;
  legR.group.position.set(0.02, 0.80, 0.10);
  g.add(legL.group, legR.group);
  // leg bodies (dark, under the letters)
  var legLb = chBox(0.20, 0.85, 0.16, MAT.ink, -0.16, 0.42, 0);
  var legRb = chBox(0.20, 0.85, 0.16, MAT.ink, 0.16, 0.42, 0);
  legLb.name = 'legL'; legRb.name = 'legR';
  g.add(legLb, legRb);
  g.add(chBox(0.24, 0.08, 0.3, MAT.ink, -0.16, 0.04, 0.05)); // boots
  g.add(chBox(0.24, 0.08, 0.3, MAT.ink, 0.16, 0.04, 0.05));
  // torso: the chest word as big extruded letters — the torso IS the word
  var torso = tmTextMesh(chest, { size: 0.42, depth: 0.16, material: MAT.letterWhite, align: 'center' });
  torso.group.position.set(-torso.width / 2, 1.02, 0.10);
  g.add(torso.group);
  var torsoBack = chBox(Math.max(0.7, torso.width + 0.1), 0.55, 0.24, MAT.ink, 0, 1.18, -0.02);
  g.add(torsoBack);
  // arms
  var armL = chBox(0.13, 0.62, 0.13, MAT.ink, -0.48, 1.15, 0); armL.name = 'armL';
  var armR = chBox(0.13, 0.62, 0.13, MAT.ink, 0.48, 1.15, 0); armR.name = 'armR';
  g.add(armL, armR);
  g.add(chSphere(0.07, MAT.letterWhite, -0.48, 0.82, 0.02)); // fists
  g.add(chSphere(0.07, MAT.letterWhite, 0.48, 0.82, 0.02));
  // head: shadowed face + white eyes + spiky hair
  var head = chSphere(0.24, MAT.ink, 0, 1.72, 0, 1, 1.05, 0.92); head.name = 'head';
  g.add(head);
  g.add(chSphere(0.035, MAT.eyeWhite, -0.09, 1.74, 0.20));
  g.add(chSphere(0.035, MAT.eyeWhite, 0.09, 1.74, 0.20));
  if (hero.hair === 'spiky') {
    for (var i = 0; i < 6; i++) {
      var a = -0.7 + i * 0.28;
      g.add(chCone(0.06, 0.34, MAT.ink, Math.sin(a) * 0.2, 1.95 + Math.abs(Math.cos(a)) * 0.06, -0.02, 0, -a * 0.7));
    }
  } else if (hero.hair === 'long') {
    g.add(chBox(0.5, 0.7, 0.1, MAT.ink, 0, 1.55, -0.22)); // long hair down the back
    g.add(chCone(0.05, 0.3, MAT.ink, 0, 2.0, 0, 0, 0));
  } else { // hood
    g.add(chCone(0.32, 0.55, MAT.ink, 0, 1.92, -0.02));
  }
  // cape: dark plane behind, flowing
  var cape = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.35, 1, 6), new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, side: THREE.DoubleSide }));
  cape.position.set(0, 1.0, -0.22); cape.rotation.x = 0.12; cape.castShadow = true;
  cape.name = 'cape';
  g.add(cape);
  // weapon: the Code Sword — a thin steel blade carrying the chapter code
  // line as a small plate (the line changes with the chapter / road).
  var sword = new THREE.Group(); sword.name = 'sword';
  var hilt = chBox(0.05, 0.28, 0.05, MAT.stoneDark, 0, 0, 0);
  var blade = chBox(0.07, 1.15, 0.03, MAT.stoneLight, 0, 0.85, 0);
  var code = tmCodeChip(hero.blade, { fontPx: 40, width: 0.85, bg: '#f2f2f2', fg: '#111111', border: '#111111' });
  code.position.set(0, 0.85, 0.05);
  sword.add(hilt, blade, code);
  sword.position.set(0.55, 0.85, 0.25);
  sword.rotation.z = -0.5;
  g.add(sword);
  if (hero.bow) { // Algorithm's bow: torus arc + string
    var bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24, Math.PI * 1.2), MAT.ink);
    bow.position.set(-0.55, 1.1, 0.15); bow.rotation.z = -0.6;
    g.add(bow);
  }
  if (hero.focus) { // Wizard's </> focus floating above one hand
    var foc = tmTextMesh(hero.focus, { size: 0.22, depth: 0.05, material: MAT.goldGlow, align: 'center' });
    foc.group.position.set(-0.55 - foc.width / 2, 1.75, 0.1);
    foc.group.name = 'focus';
    g.add(foc.group);
  }
  g.scale.setScalar(S);
  g.userData.heroId = hero.id;
  g.userData.parts = { legL: legLb, legR: legRb, armL: armL, armR: armR, head: head, cape: cape, sword: sword };
  return g;
}

/* --- boss: body IS its word(s) in huge extruded letters, monstrous humanoid --- */
function chBuildBoss(road, opts) {
  opts = opts || {};
  chInitMaterials();
  var g = new THREE.Group();
  var scale = (opts.scale || PHYS3D.bossScale);
  var words = road.bossWords;
  // legs: thick stone pillars
  g.add(chBox(0.5, 1.1, 0.5, MAT.stoneDark, -0.45, 0.55, 0));
  g.add(chBox(0.5, 1.1, 0.5, MAT.stoneDark, 0.45, 0.55, 0));
  g.add(chBox(0.62, 0.22, 0.8, MAT.stoneDark, -0.45, 0.11, 0.12));
  g.add(chBox(0.62, 0.22, 0.8, MAT.stoneDark, 0.45, 0.11, 0.12));
  // torso: the boss word(s) as huge extruded letters — FIRST word on TOP
  // (NULL above POINTER), the torso IS the word.
  var y = 2.1, maxW = 0;
  words.forEach(function (w, wi) {
    var sz = wi === 0 ? 0.85 : 0.62;
    var t = tmTextMesh(w, { size: sz, depth: 0.42, material: wi === 0 ? MAT.letterWhite : MAT.stoneLight, align: 'center' });
    t.group.position.set(-t.width / 2, y, 0.22);
    g.add(t.group);
    if (t.width > maxW) maxW = t.width;
    y -= (sz + 0.08);
  });
  var topY = 2.1 + 0.85; // top of the first word
  var torsoBack = chBox(Math.max(2.6, maxW + 0.3), topY - 1.05, 0.7, MAT.stone, 0, (topY + 1.05) / 2, -0.15);
  g.add(torsoBack);
  // arms: massive, clawed
  var armL = chBox(0.5, 1.9, 0.5, MAT.stone, -1.55, 2.0, 0); armL.name = 'armL';
  var armR = chBox(0.5, 1.9, 0.5, MAT.stone, 1.55, 2.0, 0); armR.name = 'armR';
  g.add(armL, armR);
  var fistL = chBox(0.62, 0.55, 0.62, MAT.stoneDark, -1.55, 0.95, 0.1);
  var fistR = chBox(0.62, 0.55, 0.62, MAT.stoneDark, 1.55, 0.95, 0.1);
  fistL.name = 'fistL'; fistR.name = 'fistR';
  g.add(fistL, fistR);
  for (var c = 0; c < 3; c++) {
    g.add(chCone(0.09, 0.35, MAT.letterBlack, -1.55 - 0.2 + c * 0.2, 0.55, 0.35, Math.PI, 0));
    g.add(chCone(0.09, 0.35, MAT.letterBlack, 1.55 - 0.2 + c * 0.2, 0.55, 0.35, Math.PI, 0));
  }
  // spiked shoulders
  g.add(chCone(0.28, 0.7, MAT.stoneDark, -1.55, 3.25, 0));
  g.add(chCone(0.28, 0.7, MAT.stoneDark, 1.55, 3.25, 0));
  // head: hollow mask + glowing red eyes (boss eyes are red — the ONLY red)
  var head = chBox(0.7, 0.6, 0.55, MAT.ink, 0, topY + 0.3, 0.05); head.name = 'head';
  g.add(head);
  g.add(chSphere(0.09, MAT.eyeRed, -0.17, topY + 0.33, 0.36));
  g.add(chSphere(0.09, MAT.eyeRed, 0.17, topY + 0.33, 0.36));
  // crown of spikes for NULLPOINTER / TIMEOUT's clock hand / GATEKEEPER atom
  if (road.id === 'kotlin') {
    for (var s = 0; s < 5; s++) g.add(chCone(0.1, 0.5, MAT.ink, -0.4 + s * 0.2, topY + 0.8, 0));
  }
  if (road.id === 'python') { // TIMEOUT: a second hand sweeping above the head
    var hand = chBox(0.08, 1.1, 0.06, MAT.letterWhite, 0, topY + 0.95, 0.1);
    hand.name = 'secondHand'; g.add(hand);
  }
  if (road.id === 'react-native') { // GATEKEEPER: React atom face — rings + nucleus eye
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40), MAT.letterWhite);
    ring1.position.set(0, topY + 0.3, 0.1); ring1.rotation.x = 0.6; ring1.name = 'atomRing1';
    var ring2 = ring1.clone(); ring2.rotation.x = -0.6; ring2.rotation.y = 0.8; ring2.name = 'atomRing2';
    var nuc = chSphere(0.12, MAT.eyeRed, 0, topY + 0.3, 0.35);
    g.add(ring1, ring2, nuc);
  }
  if (road.id === 'android') { // MEMORYLEAK: drips
    for (var d = 0; d < 4; d++) g.add(chCone(0.08, 0.4 + d * 0.1, MAT.inkPool, -0.8 + d * 0.55, 0.9 - d * 0.12, 0.4, Math.PI, 0));
  }
  // held-line anchor: empty group at the raised right hand; the boss holds the
  // next code line here, VISIBLE before throwing (locked mechanic).
  var heldAnchor = new THREE.Group();
  heldAnchor.position.set(1.7, 3.1, 0.6);
  heldAnchor.name = 'heldAnchor';
  g.add(heldAnchor);
  // cape chips anchor: small chips pinned on the cape (next 3 lines, visible early)
  // — at the boss's right side, IN FRONT of the letters so they read from the front.
  var chipsAnchor = new THREE.Group();
  chipsAnchor.position.set(2.0, 2.0, 0.85);
  chipsAnchor.name = 'chipsAnchor';
  g.add(chipsAnchor);
  g.scale.setScalar(scale);
  g.userData.roadId = road.id;
  g.userData.parts = { armL: armL, armR: armR, fistL: fistL, fistR: fistR, head: head, heldAnchor: heldAnchor, chipsAnchor: chipsAnchor };
  g.userData.headTopY = (topY + 0.65) * scale;
  return g;
}

/* --- troop: body built from its word's letters, eyes, legs, HP bar --- */
function chBuildTroop(troopId, opts) {
  opts = opts || {};
  chInitMaterials();
  var t = TROOPS[troopId];
  if (!t) throw new Error('unknown troop ' + troopId);
  var g = new THREE.Group();
  var size = t.size * (opts.sizeMul || 1);
  // body: the word as extruded letters (one row; long words wrap to two rows)
  var word = t.word;
  var rows = word.length > 6 ? [word.slice(0, Math.ceil(word.length / 2)), word.slice(Math.ceil(word.length / 2))] : [word];
  var letterSize = Math.min(0.55, 2.2 / Math.max.apply(null, rows.map(function (r) { return r.length; })));
  var y = rows.length > 1 ? 0.55 : 0.35;
  rows.forEach(function (row) {
    var tm = tmTextMesh(row, { size: letterSize, depth: 0.12, material: t.kind === 'brute' || t.kind === 'golem' ? MAT.stoneLight : MAT.letterWhite, align: 'center' });
    tm.group.position.set(-tm.width / 2, y, 0.06);
    g.add(tm.group);
    y -= letterSize * 0.85;
  });
  var bodyH = rows.length > 1 ? 1.1 : 0.75;
  g.add(chBox(Math.min(1.6, word.length * 0.32), bodyH, 0.2, MAT.ink, 0, 0.55, -0.08));
  // eyes: white slits (hollow eyes for villains are white; red is boss-only)
  g.add(chSphere(0.05, MAT.eyeWhite, -0.14, 0.85, 0.2));
  g.add(chSphere(0.05, MAT.eyeWhite, 0.14, 0.85, 0.2));
  // legs: little brackets / stubs
  var nLegs = t.kind === 'skitter' ? 4 : 2;
  for (var i = 0; i < nLegs; i++) {
    g.add(chBox(0.07, 0.3, 0.07, MAT.ink, -0.2 + i * (0.4 / Math.max(1, nLegs - 1)), 0.15, 0));
  }
  if (t.kind === 'wisp') { // wisps trail erased ink — a fading tail plane
    var tail = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x666666, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    tail.position.set(0, 0.5, -0.25); tail.rotation.x = 0.3;
    g.add(tail);
  }
  // HP bar above every troop (locked rule): green bg + red fill, billboarded per-frame
  var hpBar = new THREE.Group(); hpBar.name = 'hpbar';
  var bg = chBox(0.9, 0.09, 0.02, new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, 0, 0);
  var fg = chBox(0.86, 0.06, 0.03, new THREE.MeshBasicMaterial({ color: 0x2aff5a }), 0, 0, 0.005);
  fg.name = 'hpfill';
  hpBar.add(bg, fg);
  hpBar.position.set(0, 1.35, 0);
  g.add(hpBar);
  g.userData.hpBar = hpBar;
  g.userData.hpFill = fg;
  g.scale.setScalar(size);
  g.userData.troopId = troopId;
  g.userData.baseY = 0;
  return g;
}

/* --- the Guide: hooded, glowing gold book (gold light ONLY here + hero select) --- */
function chBuildGuide() {
  chInitMaterials();
  var g = new THREE.Group();
  var robe = chCyl(0.28, 0.55, 1.7, MAT.ink, 0, 0.85, 0, 10);
  robe.name = 'robe';
  g.add(robe);
  var hood = chCone(0.42, 0.85, MAT.ink, 0, 1.95, 0);
  g.add(hood);
  var face = chSphere(0.24, MAT.ink, 0, 1.82, 0.08, 1, 1.1, 0.8);
  g.add(face);
  g.add(chSphere(0.03, MAT.eyeWhite, -0.07, 1.84, 0.26));
  g.add(chSphere(0.03, MAT.eyeWhite, 0.07, 1.84, 0.26));
  // open book, glowing warm gold
  var book = new THREE.Group(); book.name = 'book';
  var cover = chBox(0.55, 0.08, 0.4, MAT.ink, 0, 0, 0);
  var pageL = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), MAT.goldGlow);
  pageL.position.set(-0.13, 0.05, 0); pageL.rotation.set(-0.5, 0.15, 0.25);
  var pageR = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), MAT.goldGlow);
  pageR.position.set(0.13, 0.05, 0); pageR.rotation.set(-0.5, -0.15, -0.25);
  book.add(cover, pageL, pageR);
  book.position.set(0, 1.25, 0.35);
  book.rotation.x = -0.35;
  g.add(book);
  var light = new THREE.PointLight(0xffc21c, 1.4, 6);
  light.position.set(0, 1.5, 0.8);
  g.add(light);
  // arms holding the book
  g.add(chBox(0.11, 0.5, 0.11, MAT.ink, -0.3, 1.25, 0.15));
  g.add(chBox(0.11, 0.5, 0.11, MAT.ink, 0.3, 1.25, 0.15));
  g.userData.parts = { book: book, robe: robe };
  return g;
}

/* --- LEAK golem for the Troop Entrance scene (body IS the word LEAK) --- */
function chBuildLeak() {
  chInitMaterials();
  var g = new THREE.Group();
  var t = tmTextMesh('LEAK', { size: 1.0, depth: 0.5, material: MAT.stoneLight, align: 'center' });
  t.group.position.set(0, 1.6, 0.2);
  g.add(t.group);
  g.add(chBox(3.4, 2.2, 0.8, MAT.stone, 0, 2.2, -0.2));
  g.add(chBox(0.6, 2.4, 0.6, MAT.stone, -1.9, 1.6, 0));
  g.add(chBox(0.6, 2.4, 0.6, MAT.stone, 1.9, 1.6, 0));
  g.add(chBox(0.5, 0.9, 0.5, MAT.stoneDark, -2.0, 0.45, 0.1));
  g.add(chBox(0.5, 0.9, 0.5, MAT.stoneDark, 2.0, 0.45, 0.1));
  var head = chBox(0.8, 0.7, 0.6, MAT.ink, 0, 3.55, 0.1);
  g.add(head);
  g.add(chSphere(0.09, MAT.eyeWhite, -0.18, 3.6, 0.45));
  g.add(chSphere(0.09, MAT.eyeWhite, 0.18, 3.6, 0.45));
  for (var s = 0; s < 4; s++) g.add(chCone(0.12, 0.55, MAT.ink, -0.45 + s * 0.3, 4.1, 0));
  // ink drips
  for (var d = 0; d < 5; d++) g.add(chCone(0.09, 0.5, MAT.inkPool, -1.2 + d * 0.6, 0.7, 0.45, Math.PI, 0));
  var hpBar = new THREE.Group(); hpBar.name = 'hpbar';
  hpBar.add(chBox(1.6, 0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, 0, 0));
  var fg = chBox(1.54, 0.08, 0.04, new THREE.MeshBasicMaterial({ color: 0x2aff5a }), 0, 0, 0.005);
  fg.name = 'hpfill'; hpBar.add(fg);
  hpBar.position.set(0, 5.3, 0);
  g.add(hpBar);
  g.userData.hpFill = fg;
  return g;
}

/* --- guard circle: green ring + translucent dome (green ONLY here) --- */
function chBuildGuardRing() {
  var g = new THREE.Group();
  var ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 10, 48), MAT.green);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
  var dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.greenGhost);
  dome.position.y = 0.02;
  g.add(ring, dome);
  g.visible = false;
  return g;
}

/* --- slash arc: fiery torus segment (fire ONLY here + dodge trail) --- */
function chBuildSlashArc() {
  var g = new THREE.Group();
  var arc = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 32, Math.PI * 0.9), MAT.fireCore);
  arc.rotation.z = Math.PI * 0.15;
  var arc2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 32, Math.PI * 0.9), MAT.fireMid);
  arc2.rotation.z = Math.PI * 0.15; arc2.position.z = 0.05;
  g.add(arc, arc2);
  g.visible = false;
  return g;
}
