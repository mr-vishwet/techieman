/* TECHIEMAN REAL 3D — three-text.js
 * The vendored three.min.js (r149 UMD core) has NO FontLoader / TextGeometry
 * (those lived in examples/js, removed after r147). So this module parses the
 * vendored helvetiker typeface outlines (window.HELVETIKER_FONT, typeface.js
 * format: "m x y q cx cy x y b ..." absolute coords, y-up) straight into
 * THREE.Shape -> THREE.ExtrudeGeometry. Letters are REAL extruded 3D
 * geometry with depth, bevel and shadows — not textures, not flat planes.
 * Code lines (long, small) use canvas-texture planes instead: they must stay
 * readable at distance, and a plane flying through 3D space is still a 3D
 * object with depth, parallax and lighting on its edges.
 */
'use strict';

var TM_FONT = null;
var _glyphCache = {};   // char|size|depth -> {shapes, advance}
var _textCache = {};    // text|size|depth|matKey -> geometry group (cloned on use)

function tmInitFont() {
  if (TM_FONT) return TM_FONT;
  if (typeof window === 'undefined' || !window.HELVETIKER_FONT) {
    throw new Error('HELVETIKER_FONT not loaded — vendor/helvetiker_font.js must load first');
  }
  TM_FONT = window.HELVETIKER_FONT;
  return TM_FONT;
}

/* Parse one glyph outline string into {solids:[THREE.Shape], holes per solid}
 * Subpaths with opposite winding to the first subpath are holes (O, A, D, B...);
 * subpaths with the same winding are separate solids (i-dot, :, %, =). */
function tmGlyphShapes(ch) {
  var font = tmInitFont();
  var glyph = font.glyphs[ch];
  if (!glyph || !glyph.o) return { shapes: [], advance: glyph ? glyph.ha : (font.glyphs[' '] ? font.glyphs[' '].ha : 500) };
  var res = font.resolution || 1000;
  var tokens = glyph.o.split(/\s+/).filter(Boolean);
  var subpaths = [];   // {path: THREE.Path, pts: [Vector2...]}
  var cur = null, cmd = null, i = 0;
  function newSub() { cur = { path: new THREE.Path(), pts: [] }; subpaths.push(cur); }
  newSub();
  function num() { return parseFloat(tokens[i++]); }
  while (i < tokens.length) {
    var t = tokens[i];
    if (/^[mlqb]$/.test(t)) { cmd = t; i++; }
    if (!cmd) { i++; continue; }
    if (cmd === 'm') {
      var mx = num(), my = num();
      if (cur.pts.length > 0) newSub();
      cur.path.moveTo(mx, my); cur.pts.push(new THREE.Vector2(mx, my));
    } else if (cmd === 'l') {
      var lx = num(), ly = num();
      cur.path.lineTo(lx, ly); cur.pts.push(new THREE.Vector2(lx, ly));
    } else if (cmd === 'q') {
      var qx1 = num(), qy1 = num(), qx2 = num(), qy2 = num();
      cur.path.quadraticCurveTo(qx1, qy1, qx2, qy2);
      cur.pts.push(new THREE.Vector2(qx1, qy1), new THREE.Vector2(qx2, qy2));
    } else if (cmd === 'b') {
      var bx1 = num(), by1 = num(), bx2 = num(), by2 = num(), bx3 = num(), by3 = num();
      cur.path.bezierCurveTo(bx1, by1, bx2, by2, bx3, by3);
      cur.pts.push(new THREE.Vector2(bx1, by1), new THREE.Vector2(bx2, by2), new THREE.Vector2(bx3, by3));
    }
  }
  // winding: THREE.ShapeUtils.isClockWise expects [Vector2] of the outline.
  var shapes = [];
  var firstCW = null;
  subpaths.forEach(function (sp) {
    if (sp.pts.length < 2) return;
    var sampled = sp.path.getPoints(10);
    var cw = THREE.ShapeUtils.isClockWise(sampled);
    if (firstCW === null) {
      firstCW = cw;
      var s = new THREE.Shape(sp.path.getPoints(10));
      // rebuild the shape from the actual path curves (not the sampled polyline)
      s = new THREE.Shape(); s.curves = sp.path.curves.slice(); s.currentPoint.copy(sp.path.currentPoint);
      shapes.push(s);
    } else if (cw !== firstCW) {
      var hole = new THREE.Path(); hole.curves = sp.path.curves.slice(); hole.currentPoint.copy(sp.path.currentPoint);
      shapes[shapes.length - 1].holes.push(hole);
    } else {
      var s2 = new THREE.Shape(); s2.curves = sp.path.curves.slice(); s2.currentPoint.copy(sp.path.currentPoint);
      shapes.push(s2);
    }
  });
  return { shapes: shapes, advance: glyph.ha, res: res };
}

/* Extruded 3D text. Returns {group, width, height}.
 * size = cap-height-ish world units for the font's em; depth = extrusion.
 * align: 'left' | 'center'. Material shared by all letters. */
function tmTextMesh(text, opts) {
  opts = opts || {};
  var size = opts.size || 1, depth = opts.depth != null ? opts.depth : size * 0.22;
  var material = opts.material;
  var key = text + '|' + size + '|' + depth;
  var font = tmInitFont();
  var res = font.resolution || 1000;
  var scale = size / res;
  var group = new THREE.Group();
  var x = 0, maxY = 0, minY = 0;
  var letters = String(text).split('');
  letters.forEach(function (ch) {
    var gk = ch + '|' + size + '|' + depth;
    var g = _glyphCache[gk];
    if (!g) { g = tmGlyphShapes(ch); _glyphCache[gk] = g; }
    if (g.shapes.length) {
      g.shapes.forEach(function (shape) {
        var geo = new THREE.ExtrudeGeometry(shape, {
          depth: depth / scale, bevelEnabled: true,
          bevelThickness: depth * 0.12 / scale, bevelSize: size * 0.015 / scale,
          bevelSegments: 1, curveSegments: 6
        });
        geo.scale(scale, scale, scale);
        var mesh = new THREE.Mesh(geo, material);
        mesh.position.x = x;
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
      });
    }
    x += (g.advance || 500) * scale;
  });
  var width = x;
  // height estimate: cap height ~0.72 em
  var height = size * 0.72;
  if (opts.align === 'center') group.position.x = -width / 2;
  group.userData.width = width; group.userData.height = height;
  return { group: group, width: width, height: height };
}

/* Readable code line as a 3D plane: canvas texture on a thin box so the chip
 * has real thickness + edges that catch light as it flies toward the camera. */
function tmCodeChip(text, opts) {
  opts = opts || {};
  var fontPx = opts.fontPx || 44;
  var pad = 26;
  var c = document.createElement('canvas');
  var ctx = c.getContext('2d');
  ctx.font = 'bold ' + fontPx + 'px "Courier New", monospace';
  var tw = Math.ceil(ctx.measureText(text).width);
  c.width = tw + pad * 2; c.height = fontPx + pad * 2;
  var ctx2 = c.getContext('2d');
  ctx2.fillStyle = opts.bg || '#141414';
  ctx2.fillRect(0, 0, c.width, c.height);
  ctx2.strokeStyle = opts.border || '#f2f2f2'; ctx2.lineWidth = 4;
  ctx2.strokeRect(3, 3, c.width - 6, c.height - 6);
  ctx2.font = 'bold ' + fontPx + 'px "Courier New", monospace';
  ctx2.fillStyle = opts.fg || '#ffffff';
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, pad, c.height / 2 + 2);
  var tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  var w = (opts.width || 3.4), h = w * (c.height / c.width);
  var geo = new THREE.BoxGeometry(w, h, 0.08);
  var mats = [];
  var edge = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  var face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  var mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, face, face]);
  mesh.castShadow = true;
  mesh.userData.planeW = w; mesh.userData.planeH = h;
  return mesh;
}

/* Simple flat label plane (chapter numbers, signs) — canvas texture, thin box. */
function tmLabelPlane(text, opts) {
  opts = opts || {};
  var chip = tmCodeChip(text, {
    fontPx: opts.fontPx || 64, bg: opts.bg || '#e8e8e8',
    fg: opts.fg || '#111111', border: opts.border || '#111111', width: opts.width || 2.2
  });
  return chip;
}
