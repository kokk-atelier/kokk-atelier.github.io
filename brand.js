// KOKK for brands: CI in (logo, colours) -> one luggage design out.
// One design is shown, the rule engine's Signature (12 Nov, user: "Signature is enough"). It is deterministic and drawn in
// the browser: no AI call anywhere, so the design button never uses Claude tokens. The other recipes stay in the engine, unused.
// On the card the visitor can tap which CI colour is the frame and how large the logo is (tune); still no AI.
const $ = id => document.getElementById(id);
// drawn arrow (east), same shape as app.js: arrows are never typed, every device would borrow a different glyph
const AR_E = '<svg class="ar" viewBox="0 0 100 100" aria-hidden="true"><path d="M3 50H97M70.8 23.8 97 50 70.8 76.2"/></svg>';
const HEX = /^#[0-9a-f]{6}$/i;
const NATURAL = '#e9d9bd', IVORY = '#f7f1e7', ESPRESSO = '#35271f';
const SEDGE = '#e6d0a6';   // natural sedge as the Signature shows it: a little warmer than the atelier's swatch, close to the undyed mat
const METALS = { champagne: '#c5a16a', titanium: '#a89c87', silver: '#bec2c6', black: '#232323', ivory: '#e8e4dc', graphite: '#4a4642' };
const COLOR_NAMES = { '#c5a16a': 'แชมเปญ', '#a89c87': 'ไทเทเนียม', '#bec2c6': 'เงิน', '#232323': 'ดำด้าน', '#e8e4dc': 'ไอวอรี', '#4a4642': 'กราไฟต์', '#e9d9bd': 'ธรรมชาติ', '#e6d0a6': 'ธรรมชาติ', '#f7f1e7': 'งาช้าง', '#35271f': 'เอสเปรสโซ', '#77745b': 'โอลีฟ' };
const PATTERN_TH = { twill: 'ขัดสอง', herringbone: 'ก้างปลา', grid: 'ตาราง', minimal: 'มินิมอล V', diamond: 'ข้าวหลามตัด' };
const TONES = ['quiet', 'warm', 'bold', 'natural'];
const FONTS = ['sans', 'serif', 'signature', 'mono', 'bold'];

// ---------- colour helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function hsl(hex) {
  let [r, g, b] = rgb(hex).map(v => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function lum(hex) { return rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0); }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function bestInk(bg) { return contrast(IVORY, bg) >= contrast(ESPRESSO, bg) ? IVORY : ESPRESSO; }
function colorLabel(hex) { return COLOR_NAMES[hex.toLowerCase()] || hex.toUpperCase(); }
function normHex(v) { if (typeof v !== 'string') return null; let t = v.trim().toLowerCase(); if (!t.startsWith('#')) t = '#' + t; if (/^#[0-9a-f]{3}$/.test(t)) t = '#' + [...t.slice(1)].map(c => c + c).join(''); return HEX.test(t) ? t : null; }
function dyedSedge(hex) { const [h, s, l] = hsl(hex); return fromHsl(h, Math.min(s, .55), clamp(l, .25, .78)); }
function seeded(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- logo and CI image intake ----------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => resolve({ img, url }); img.onerror = () => { URL.revokeObjectURL(url); reject(Error('decode')); }; img.src = url;
  });
}
export async function readLogo(file) {
  const { img, url } = await loadImage(file);
  try {
    let w = img.naturalWidth || 512, h = img.naturalHeight || 512;
    const k = Math.min(1, 700 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h); c.width = c.height = 0;
    return analyseLogo(data);
  } finally { URL.revokeObjectURL(url); }
}
function analyseLogo(data) {
  const { width: w, height: h, data: px } = data;
  let transparent = false;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { transparent = true; break; }
  // Border: one colour, give or take a texture or a gentle gradient? (17 Nov: a logo on a woven blue was not seen as plain)
  const border = []; const push = (x, y) => { const i = (y * w + x) * 4; border.push([px[i], px[i + 1], px[i + 2], x / w - .5, y / h - .5]); };
  for (let x = 0; x < w; x += Math.max(1, w / 120 | 0)) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += Math.max(1, h / 120 | 0)) { push(0, y); push(w - 1, y); }
  const mid = [0, 1, 2].map(j => border.map(p => p[j]).sort((a, b) => a - b)[border.length >> 1]);
  const flat = border.filter(p => Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]) < 44).length / border.length > .9;
  // 18 Nov: a gradient backdrop (straight or round) is plain too, so it is cut without the customer ticking anything
  const smooth = !transparent && !flat && !!borderFit(border);
  const back = transparent ? null : backdropOf(data);
  return { source: data, plainBg: !transparent && (flat || smooth) && !!back && back.share > .2, back };
}
// Is the border one smooth sheet of colour (flat, a straight or a round gradient)? A quadratic surface per channel is fitted to
// the border samples twice, the second time without the samples the first fit missed by 44 or more (a logo touching the edge);
// smooth when nine in ten samples sit within 44 of it. A photo or two colours meeting at the edge do not fit.
function borderFit(border) {
  const pts = border, feat = j => { const u = pts[j][3], v = pts[j][4]; return [1, u, v, u * u, v * v, u * v]; };
  const solve = idx => {
    const A = Array.from({ length: 6 }, () => new Float64Array(9));
    for (const j of idx) { const f = feat(j), p = pts[j]; for (let r = 0; r < 6; r++) { for (let c = 0; c < 6; c++) A[r][c] += f[r] * f[c]; for (let k = 0; k < 3; k++) A[r][6 + k] += f[r] * p[k]; } }
    for (let r = 0; r < 6; r++) A[r][r] += 1e-6;
    for (let c = 0; c < 6; c++) {
      let piv = c; for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-12) return null;
      for (let k = c; k < 9; k++) A[c][k] /= d;
      for (let r = 0; r < 6; r++) if (r !== c && A[r][c]) { const m = A[r][c]; for (let k = c; k < 9; k++) A[r][k] -= m * A[c][k]; }
    }
    return [0, 1, 2].map(k => A.map(row => row[6 + k]));
  };
  const miss = (coef, j) => { const f = feat(j); return Math.hypot(...[0, 1, 2].map(k => pts[j][k] - coef[k].reduce((s, c, m) => s + c * f[m], 0))); };
  const all = pts.map((_, j) => j); let coef = solve(all); if (!coef) return null;
  const keep = all.filter(j => miss(coef, j) < 44); if (keep.length < 12) return null;
  coef = solve(keep); if (!coef) return null;
  return all.filter(j => miss(coef, j) < 44).length / all.length > .9 ? coef : null;
}

// ---------- logo background removal (17 Nov) ----------
// User: a chrome star on black kept a dark smear of its glow, and a white logo on a textured blue was not cut at all ("cut it to
// the shape, make it smarter"). Three steps:
// 1) Backdrop: grown from the image edge in small colour steps, so a gradient or a woven texture is followed but a glow or the
//    logo is not (a pixel joins only within STEP of its neighbour and within REACH of the edge colour it grew from). The grown
//    pixels are averaged on a coarse grid and filled in across the logo: every pixel gets its own backdrop colour.
// 2) Colour-to-alpha (as in GIMP): a pixel is read as a colour laid over its backdrop at some opacity, and the backdrop's share
//    is taken out. A glow fading into black becomes light that fades out, so no grey ring is left on the sedge.
// 3) Only the backdrop and what melts into it changes. Holes in the backdrop colour (inside a ring or a star, the counter of an O)
//    are backdrop too. On a near-black backdrop a glow is followed outward-in while it rises gently (CLIMB per pixel): the sharp
//    edge of the logo stops it, so a chrome body keeps its dark reflections. Then a thin edge band (BAND px) round all of that is
//    softened, scaled to the most solid colour next to it, so edges stay smooth and a pale fill on white keeps its colour with no
//    darker rim (paper does not glow, so on a light backdrop there is no climbing). The logo's body keeps its exact colours.
const STEP = 20, REACH = 56, CORE = 16, SOFT = .85, CLIMB = .1, BAND = 3, DARK = .08;
// 18 Nov: on a backdrop that is not near-black, the colour a pixel is measured against drifts a little (DRIFT) towards each
// pixel it passes, so the growth follows a straight or a round gradient all the way in (a spotlight behind the logo). On black it
// stays the edge colour: there a smooth brightening is the logo's glow, which must stay (see step 3).
const DRIFT = 1 / 24;
function backdropOf(src) {
  const { width: w, height: h, data: px } = src, N = w * h;
  const seed = new Int32Array(N).fill(-1), queue = new Int32Array(N), ref = new Float32Array(N * 3); let head = 0, tail = 0;
  const d2 = (i, j) => { const a = i * 4, b = j * 4, r = px[a] - px[b], g = px[a + 1] - px[b + 1], c = px[a + 2] - px[b + 2]; return r * r + g * g + c * c; };
  const off = i => { const a = i * 4, b = i * 3, r = px[a] - ref[b], g = px[a + 1] - ref[b + 1], c = px[a + 2] - ref[b + 2]; return r * r + g * g + c * c; };
  const start = i => { if (seed[i] < 0 && px[i * 4 + 3] > 200) { seed[i] = i; ref[i * 3] = px[i * 4]; ref[i * 3 + 1] = px[i * 4 + 1]; ref[i * 3 + 2] = px[i * 4 + 2]; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { start(x); start((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { start(y * w); start(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++], s = seed[i], x = i % w;
    const lam = (.2126 * px[s * 4] + .7152 * px[s * 4 + 1] + .0722 * px[s * 4 + 2]) / 255 < DARK ? 0 : DRIFT;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= N || seed[j] >= 0 || px[j * 4 + 3] <= 200 || d2(i, j) >= STEP * STEP) continue;
      const a = i * 3, b = j * 3, r = px[j * 4] - ref[a], g = px[j * 4 + 1] - ref[a + 1], c = px[j * 4 + 2] - ref[a + 2];
      if (r * r + g * g + c * c >= REACH * REACH) continue;
      // drift only where the colour changes gently all round (a gradient): at an edge (a step of more than 8 to a neighbour) it
      // walked along a pale ring's soft rim and into the ring; nor into a plain darkening of the carried colour (one ratio on every
      // channel): that is a shadow, and following it led the growth into a grey panel the shadow fell from
      let l = lam;
      if (l) { const jx = j % w; for (const k of [jx > 0 ? j - 1 : -1, jx < w - 1 ? j + 1 : -1, j - w, j + w]) if (k >= 0 && k < N && d2(j, k) > 64) { l = 0; break; } }
      if (l) {
        let lo = 9, hi = -9, m = 0, k = 0;
        for (let q = 0; q < 3; q++) if (ref[a + q] >= 40) { const t = px[j * 4 + q] / ref[a + q]; lo = Math.min(lo, t); hi = Math.max(hi, t); m += t; k++; }
        if (k && hi - lo < .06 && m / k < .995) l = 0;
      }
      seed[j] = s; ref[b] = ref[a] + r * l; ref[b + 1] = ref[a + 1] + g * l; ref[b + 2] = ref[a + 2] + c * l; queue[tail++] = j;
    }
  }
  if (!tail) return null;
  const cs = Math.max(6, Math.ceil(Math.max(w, h) / 24)), gw = Math.ceil(w / cs), gh = Math.ceil(h / cs), G = gw * gh;
  let cell = new Float32Array(G * 4);
  // only core pixels (close to the colour they were measured against) set the colour: a glow's dim rim must not lift a black
  // backdrop to grey
  const core = i => seed[i] >= 0 && off(i) < CORE * CORE;
  for (let i = 0; i < N; i++) if (core(i)) { const c = (((i / w) | 0) / cs | 0) * gw + ((i % w) / cs | 0) << 2; cell[c] += px[i * 4]; cell[c + 1] += px[i * 4 + 1]; cell[c + 2] += px[i * 4 + 2]; cell[c + 3]++; }
  for (let c = 0; c < G * 4; c += 4) if (cell[c + 3]) { const n = cell[c + 3]; cell[c] /= n; cell[c + 1] /= n; cell[c + 2] /= n; cell[c + 3] = 1; }
  for (let pass = 0; pass < gw + gh; pass++) {            // cells under the logo take the mean of their filled neighbours
    const next = cell.slice(); let empty = 0;
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
      const c = (cy * gw + cx) * 4; if (cell[c + 3]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const k = (ny * gw + nx) * 4; if (cell[k + 3]) { r += cell[k]; g += cell[k + 1]; b += cell[k + 2]; n++; }
      }
      if (n) { next[c] = r / n; next[c + 1] = g / n; next[c + 2] = b / n; next[c + 3] = 1; } else empty++;
    }
    cell = next; if (!empty) break;
  }
  // texture of the backdrop: how far its own pixels stray from the grown pixels round them (sets the noise floor of step 2;
  // 18 Nov: measured locally, so a gradient or a shadow's soft rim is not taken for texture)
  const at = backdropAt({ cell, gw, gh, cs });
  const stray = [];
  for (let i = 0; i < N; i += 7) {
    if (seed[i] < 0) continue;
    const x = i % w, y = (i / w) | 0; let r = 0, g = 0, b = 0, n = 0, s = seed[i];
    if ((.2126 * px[s * 4] + .7152 * px[s * 4 + 1] + .0722 * px[s * 4 + 2]) / 255 < DARK) {   // on black as before: from the smooth colour
      const f = at(x, y); stray.push(Math.hypot(px[i * 4] - f[0], px[i * 4 + 1] - f[1], px[i * 4 + 2] - f[2])); continue;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && seed[j] >= 0) { r += px[j * 4]; g += px[j * 4 + 1]; b += px[j * 4 + 2]; n++; } }
    if (n) stray.push(Math.hypot(px[i * 4] - r / n, px[i * 4 + 1] - g / n, px[i * 4 + 2] - b / n));
  }
  stray.sort((a, b) => a - b);
  return { grown: seed, ref, share: tail / N, at, noise: Math.max(8, Math.min(48, (stray[Math.floor(stray.length * .95)] || 0) * 1.3)) };
}
// bilinear backdrop colour at a pixel, from the coarse grid
function backdropAt({ cell, gw, gh, cs }) {
  const out = [0, 0, 0];
  return (x, y) => {
    const fx = Math.max(0, Math.min(gw - 1, x / cs - .5)), fy = Math.max(0, Math.min(gh - 1, y / cs - .5));
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    for (let k = 0; k < 3; k++) {
      const a = cell[(y0 * gw + x0) * 4 + k], b = cell[(y0 * gw + x1) * 4 + k], c = cell[(y1 * gw + x0) * 4 + k], d = cell[(y1 * gw + x1) * 4 + k];
      out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
    return out;
  };
}
// Removes the backdrop in place (ImageData pixels). Returns nothing; see the notes above backdropOf, and these, added 18 Nov
// after a test with hard made-up logos (user: "make it smarter, but keep it simple: customers bring their own logo files"):
// - off black, a grown pixel is backdrop outright (measured against the coarse grid, the sharp edge of a white card on a grey
//   page left a faint outline, and the faint rim of a shadow a thin line); on black it still fades, as a glow's rim must;
// - a soft drop shadow on a light or mid backdrop (the backdrop's own colour, only darker, that fades in from the backdrop side
//   and meets the logo) is taken out like backdrop, and the logo's edge next to it is cut against the shadow's colour. A grey part
//   of the logo has a crisp edge, so it stays;
// - on a light or mid backdrop a hole of 4 px is a hole (the counter of a small A), and a slit 1-2 px wide that holds no pure
//   backdrop pixel (the gap inside a letter of a small or soft image) is found as a run of pixels far more see-through than the
//   logo on both sides and coloured as a blend of the two. On black a small dark speck stays: it is a chrome reflection;
// - loose specks of the backdrop's texture (a dark thread of a weave) left standing alone are cleared.
function cutBackdrop(px, w, h, back, debug) {
  const N = w * h, { grown, ref, at, noise } = back, src = px.slice();
  const alpha = new Float32Array(N), bgR = new Float32Array(N), bgG = new Float32Array(N), bgB = new Float32Array(N), dark = new Uint8Array(N);
  // colour-to-alpha against a backdrop colour (as in GIMP), gated by the backdrop's own texture
  const c2a = (i, b0, b1, b2) => {
    const r = px[i * 4], g = px[i * 4 + 1], bl = px[i * 4 + 2];
    const a = Math.max(r > b0 ? (r - b0) / (255 - b0 || 1) : (b0 - r) / (b0 || 1), g > b1 ? (g - b1) / (255 - b1 || 1) : (b1 - g) / (b1 || 1), bl > b2 ? (bl - b2) / (255 - b2 || 1) : (b2 - bl) / (b2 || 1));
    return Math.min(1, a) * Math.max(0, Math.min(1, (Math.hypot(r - b0, g - b1, bl - b2) - noise) / noise));
  };
  for (let i = 0; i < N; i++) {
    const b = at(i % w, (i / w) | 0);
    dark[i] = (.2126 * b[0] + .7152 * b[1] + .0722 * b[2]) / 255 < DARK ? 1 : 0;
    bgR[i] = b[0]; bgG[i] = b[1]; bgB[i] = b[2]; alpha[i] = c2a(i, b[0], b[1], b[2]);
    if (grown[i] < 0) continue;
    const r0 = ref[i * 3], r1 = ref[i * 3 + 1], r2 = ref[i * 3 + 2];
    if (!dark[i]) { alpha[i] = 0; bgR[i] = r0; bgG[i] = r1; bgB[i] = r2; continue; }   // off black, grown is backdrop: all of it goes
    const a = c2a(i, r0, r1, r2); if (a < alpha[i]) { alpha[i] = a; bgR[i] = r0; bgG[i] = r1; bgB[i] = r2; }   // on black: a glow's rim fades
  }
  const seen = new Uint8Array(N), queue = new Int32Array(N), depth = new Uint8Array(N), own = new Uint8Array(N), comp = new Int32Array(N); let tail = 0;
  const near = i => { const x = i % w; return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]; };
  // seeds: the grown backdrop, plus holes of backdrop colour that the edge could not reach
  for (let i = 0; i < N; i++) if (grown[i] >= 0) { seen[i] = 2; queue[tail++] = i; }
  for (let i = 0; i < N; i++) {
    if (seen[i] || alpha[i] >= .1 || px[i * 4 + 3] <= 200) continue;
    let n = 0, qh = 0; comp[n++] = i; seen[i] = 3;
    while (qh < n) { const p = comp[qh++]; for (const j of near(p)) if (j >= 0 && j < N && !seen[j] && alpha[j] < .1 && px[j * 4 + 3] > 200) { seen[j] = 3; comp[n++] = j; } }
    if (n >= (dark[i] ? 12 : 4)) for (let k = 0; k < n; k++) { seen[comp[k]] = 2; queue[tail++] = comp[k]; }
    else for (let k = 0; k < n; k++) seen[comp[k]] = 4;   // a speck inside the logo: keep it (unless it is part of a slit)
  }
  // drop shadow: how much darker than its backdrop a pixel is, when it is the backdrop's own colour, only darker
  const shade = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (seen[i] !== 0 || dark[i] || px[i * 4 + 3] <= 200) continue;
    let lo = 9, hi = -9, sum = 0, n = 0, ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const c = px[i * 4 + k], b = k === 0 ? bgR[i] : k === 1 ? bgG[i] : bgB[i];
      if (c > b + 8) ok = false; else if (b >= 40) { const r = c / b; lo = Math.min(lo, r); hi = Math.max(hi, r); sum += r; n++; }
    }
    if (!ok || !n || hi - lo > .1) continue;
    const s = 1 - sum / n; if (s > .03 && s < .65) shade[i] = s;   // a shadow is see-through: darker than .65 is a dark part of the logo (brown letters on yellow)
  }
  // a flat grey panel of the logo is one even shade (5 x 5 round a pixel within .012), a shadow never is: panels of 64 px or
  // more, with their edges, are logo, and the shadow they cast is read apart from them
  const flat = new Uint8Array(N), pd = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!shade[i]) continue;
    const x = i % w, y = (i / w) | 0; if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
    let lo = 9, hi = -9, ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { const s = shade[i + dy * w + dx]; if (!s) { ok = false; break; } lo = Math.min(lo, s); hi = Math.max(hi, s); }
    if (ok && hi - lo < .012) flat[i] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (flat[i] !== 1) continue;
    let n = 0, qh = 0, sum = 0; comp[n++] = i; flat[i] = 2;
    while (qh < n) { const p = comp[qh++]; sum += shade[p]; for (const j of near(p)) if (j >= 0 && j < N && flat[j] === 1) { flat[j] = 2; comp[n++] = j; } }
    if (n < 64) continue;
    // with its edge pixels of the same shade (2 px at most): a panel has a crisp rim (the backdrop, or a step of .05 to the shadow
    // it casts) along at least half of its outline; where shadows of several strokes overlap they are flat too, but fade out
    const s0 = sum / n, core = n;
    for (let k = 0; k < n; k++) {
      const p = comp[k], d = k < core ? 0 : pd[p]; if (d >= 2) continue;
      for (const j of near(p)) if (j >= 0 && j < N && shade[j] && flat[j] !== 2 && flat[j] !== 3 && Math.abs(shade[j] - s0) < .02) { flat[j] = 3; pd[j] = d + 1; comp[n++] = j; }
    }
    let rim = 0, crisp = 0;
    for (let k = 0; k < n; k++) { const p = comp[k]; for (const j of near(p)) { if (j < 0 || j >= N || flat[j] === 2 || flat[j] === 3 || (seen[j] !== 2 && !shade[j])) continue; rim++; if (Math.hypot(px[p * 4] - px[j * 4], px[p * 4 + 1] - px[j * 4 + 1], px[p * 4 + 2] - px[j * 4 + 2]) >= 20) crisp++; } }
    if (rim && crisp / rim >= .5) for (let k = 0; k < n; k++) shade[comp[k]] = 0;
  }
  const done = new Uint8Array(N), cid = new Int32Array(N), vals = [], steps = [], rest = []; let mainTop = 0, id = 0;
  const toShadow = list => { for (const p of list) { seen[p] = 6; own[p] = 1; bgR[p] = px[p * 4]; bgG[p] = px[p * 4 + 1]; bgB[p] = px[p * 4 + 2]; alpha[p] = 0; queue[tail++] = p; } };
  for (let i = 0; i < N; i++) {
    if (!shade[i] || done[i]) continue;
    let n = 0, qh = 0, body = 0; comp[n++] = i; done[i] = 1; cid[i] = ++id;
    while (qh < n) { const p = comp[qh++]; for (const j of near(p)) if (j >= 0 && j < N && !done[j] && shade[j]) { done[j] = 1; cid[j] = id; comp[n++] = j; } }
    // where it meets the backdrop, the colour step: a shadow goes on fading across that line, the edge of a grey part does not
    steps.length = 0;
    for (let k = 0; k < n; k++) {
      const p = comp[k];
      for (const j of near(p)) {
        if (j < 0 || j >= N || cid[j] === id) continue;
        if (seen[j] === 2) steps.push(Math.hypot(px[p * 4] - px[j * 4], px[p * 4 + 1] - px[j * 4 + 1], px[p * 4 + 2] - px[j * 4 + 2]));
        else if ((seen[j] === 0 || seen[j] === 4) && alpha[j] >= .1) body++;
      }
    }
    if (!body) continue;                                      // a shadow meets the shape that casts it
    vals.length = 0; for (let k = 0; k < n; k++) vals.push(shade[comp[k]]);
    vals.sort((a, b) => a - b); const top = vals[Math.floor(n * .9)], most = vals[n - 1];
    const pix = Array.from(comp.subarray(0, n)), spread = vals[Math.floor(n * .75)] - vals[Math.floor(n * .25)];
    if (n < 8 || !steps.length) { rest.push({ pix, top, spread }); continue; }
    steps.sort((a, b) => a - b);
    if (steps[steps.length >> 1] < 12) { toShadow(pix); mainTop = Math.max(mainTop, most); } else rest.push({ pix, top, spread });
  }
  // once the logo is known to cast a soft shadow, the pieces of it caught in a counter or between letters go too: no darker
  // than that shadow, meeting the logo, and either touching the backdrop or the shadow, or a patch at least 3 px across (a
  // counter wholly in shadow). The 1 px blend round a dark letter on a grey panel is neither, so it stays.
  if (mainTop) for (const { pix } of rest) {
    if (pix.length < 4 || pix.some(p => shade[p] > mainTop * 1.1)) continue;
    const mine = new Set(pix);
    const meets = pix.some(p => near(p).some(j => j >= 0 && j < N && (seen[j] === 2 || seen[j] === 6)));
    const patch = meets || pix.some(p => { const x = p % w; return x > 0 && x < w - 1 && [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1].every(d => mine.has(p + d)); });
    if (patch) toShadow(pix);
  }
  // glow on a near-black backdrop: climb while it rises gently
  let head = 0;
  while (head < tail) {
    const i = queue[head++];
    for (const j of near(i)) {
      if (j < 0 || j >= N || (seen[j] !== 0 && seen[j] !== 4) || !dark[j] || alpha[j] >= SOFT || alpha[j] - alpha[i] >= CLIMB) continue;
      seen[j] = 1; queue[tail++] = j;
    }
  }
  // edge band round the backdrop, the glow and the shadow (next to a shadow the edge is read against the shadow's colour)
  head = 0;
  while (head < tail) {
    const i = queue[head++];
    if (depth[i] >= BAND) continue;
    for (const j of near(i)) {
      if (j < 0 || j >= N || seen[j] === 1 || seen[j] === 2 || seen[j] === 5 || seen[j] === 6) continue;
      if (own[i]) { const a = c2a(j, bgR[i], bgG[i], bgB[i]); if (a >= SOFT) continue; own[j] = 1; bgR[j] = bgR[i]; bgG[j] = bgG[i]; bgB[j] = bgB[i]; alpha[j] = a; }
      else if (alpha[j] >= SOFT) continue;
      seen[j] = 5; depth[j] = depth[i] + 1; queue[tail++] = j;
    }
  }
  // slits on a light or mid backdrop (inside the logo: the edge band is done)
  const slit = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if ((seen[i] !== 0 && seen[i] !== 4) || dark[i] || alpha[i] > .7 || px[i * 4 + 3] <= 200) continue;
    const x = i % w, y = (i / w) | 0; let best = 0, p0 = -1, q0 = -1;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (let d = 1; d <= 2; d++) {
      const ax = x - dx * d, ay = y - dy * d, bx = x + dx * d, by = y + dy * d;
      if (ax < 0 || bx < 0 || ax >= w || bx >= w || ay < 0 || by < 0 || ay >= h || by >= h) continue;
      const p = ay * w + ax, q = by * w + bx; if ((seen[p] !== 0 && seen[p] !== 4) || (seen[q] !== 0 && seen[q] !== 4)) continue;
      const v = Math.min(alpha[p], alpha[q]) - alpha[i]; if (v > best) { best = v; p0 = p; q0 = q; }
    }
    if (best < .3) continue;
    if (Math.hypot(px[p0 * 4] - px[q0 * 4], px[p0 * 4 + 1] - px[q0 * 4 + 1], px[p0 * 4 + 2] - px[q0 * 4 + 2]) > 80) continue;   // one colour on both sides
    const s0 = (px[p0 * 4] + px[q0 * 4]) / 2 - bgR[i], s1 = (px[p0 * 4 + 1] + px[q0 * 4 + 1]) / 2 - bgG[i], s2 = (px[p0 * 4 + 2] + px[q0 * 4 + 2]) / 2 - bgB[i];
    const ee = s0 * s0 + s1 * s1 + s2 * s2; if (ee < 900) continue;
    const c0 = px[i * 4] - bgR[i], c1 = px[i * 4 + 1] - bgG[i], c2 = px[i * 4 + 2] - bgB[i], t = (c0 * s0 + c1 * s1 + c2 * s2) / ee;
    if (t > -.1 && t < .85 && Math.hypot(c0 - t * s0, c1 - t * s1, c2 - t * s2) < 28) slit[i] = 1;   // a blend of the two
  }
  // three or more together make a slit (a lone pixel is texture), and it opens into few pale pixels: a pale run that belongs to a
  // wide pale area (a grey panel the letters sit on, where two strokes nearly meet) is that area, not a gap
  const pale = j => (seen[j] === 0 || seen[j] === 4) && !slit[j] && alpha[j] >= .03 && alpha[j] < .7;
  const pv = new Int32Array(N), pq = new Int32Array(N); let sid = 0;
  for (let i = 0; i < N; i++) {
    if (slit[i] !== 1) continue;
    let n = 0, qh = 0; comp[n++] = i; slit[i] = 2;
    while (qh < n) { const p = comp[qh++], x = p % w, y = (p / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && slit[j] === 1) { slit[j] = 2; comp[n++] = j; } } }
    if (n < 3) continue;
    const cap = 4 * n + 24; let m = 0, ph = 0; sid++;
    const reach = p => { const x = p % w, y = (p / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && pv[j] !== sid && pale(j)) { pv[j] = sid; pq[m++] = j; if (m > cap) return; } } };
    for (let k = 0; k < n && m <= cap; k++) reach(comp[k]);
    while (ph < m && m <= cap) reach(pq[ph++]);
    if (m <= cap) for (let k = 0; k < n; k++) { seen[comp[k]] = 5; depth[comp[k]] = BAND; slit[comp[k]] = 3; }
  }
  // a slit 2 px wide holds a second row that is mostly logo: the soft pixels right beside a slit are its edge, read the same way
  // (and a speck of pure backdrop at its end, kept so far as a dot of the design, is part of it)
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < N; i++) {
    if (slit[i] !== 3) continue;
    for (const j of near(i)) {
      if (j < 0 || j >= N || dark[j]) continue;
      if (seen[j] === 4) { seen[j] = 5; depth[j] = BAND; slit[j] = 3; }
      else if (!pass && !seen[j] && alpha[j] < SOFT && alpha[j] > alpha[i]) { seen[j] = 5; depth[j] = BAND; }
    }
  }
  if (debug) Object.assign(debug, { seen: seen.slice(), alpha: alpha.slice(), w, h, px });   // test page only: px ends up as the result
  for (let i = 0; i < N; i++) {
    if (seen[i] === 6) { px[i * 4 + 3] = 0; continue; }
    if (seen[i] !== 1 && seen[i] !== 2 && seen[i] !== 5) continue;
    let a = alpha[i];
    if (seen[i] === 5) {                                     // edge band: scale to the logo's own solid colour (unreached, within
      const x = i % w, y = (i / w) | 0; let top = 0;          // BAND + 1 px); none near: a stray thread of a texture, left as it is
      // (next to a shadow the solid colour is read against the same shadow colour as this pixel: against a dark shadow a dark
      // letter never looks solid, and its edge was being made see-through, 18 Nov)
      for (let dy = -BAND - 1; dy <= BAND + 1; dy++) for (let dx = -BAND - 1; dx <= BAND + 1; dx++) { const nx = x + dx, ny = y + dy, k = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[k]) top = Math.max(top, own[i] ? c2a(k, bgR[i], bgG[i], bgB[i]) : alpha[k]); }
      if (top > 0) a = Math.min(1, a / top);
    }
    if (a <= .004) { px[i * 4 + 3] = 0; continue; }
    const b = [bgR[i], bgG[i], bgB[i]];
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.max(0, Math.min(255, Math.round(b[k] + (px[i * 4 + k] - b[k]) / a)));
    px[i * 4 + 3] = Math.round(px[i * 4 + 3] * a);
  }
  // loose specks: up to 12 px standing alone (nothing else visible within 3 px), in the backdrop's colour or a darker shade of it
  let total = 0; for (let i = 0; i < N; i++) if (px[i * 4 + 3] > 8) total++;
  const S = Math.min(12, Math.max(3, Math.round(total * .0015))), mark = new Int32Array(N); id = 0;
  for (let i = 0; i < N; i++) {
    if (mark[i] || px[i * 4 + 3] <= 8) continue;
    let n = 0, qh = 0; comp[n++] = i; mark[i] = ++id;
    while (qh < n) { const p = comp[qh++], x = p % w, y = (p / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !mark[j] && px[j * 4 + 3] > 8) { mark[j] = id; comp[n++] = j; } } }
    if (n > S) continue;
    let alone = true;
    for (let k = 0; k < n && alone; k++) { const x = comp[k] % w, y = (comp[k] / w) | 0; for (let dy = -3; dy <= 3 && alone; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy, j = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && mark[j] !== id && px[j * 4 + 3] > 8) { alone = false; break; } } }
    if (!alone) continue;
    const c = [0, 0, 0], b = [0, 0, 0];
    for (let k = 0; k < n; k++) { const p = comp[k]; for (let m = 0; m < 3; m++) c[m] += src[p * 4 + m] / n; b[0] += bgR[p] / n; b[1] += bgG[p] / n; b[2] += bgB[p] / n; }
    const rs = [0, 1, 2].filter(m => b[m] >= 40).map(m => c[m] / b[m]);
    const darker = c.every((v, m) => v <= b[m] + 8) && rs.length && Math.max(...rs) - Math.min(...rs) < .15;
    if (darker || Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]) < 3.5 * noise) for (let k = 0; k < n; k++) px[comp[k] * 4 + 3] = 0;
  }
}
// Brand colours in a block of pixels: up to 3, ranked by area x saturation and at least 60 apart in RGB. See-through
// pixels are skipped. Paper never counts: white, grey and black are left out, and the "big enough" bar is a share of
// the coloured pixels only, so a small swatch on a large white sheet still counts whether or not the sheet's edge is
// clean (12 Nov: a screenshot with a border line gave 1 colour instead of 3 when the bar was a share of all pixels).
// Bins that are really one colour (JPEG noise at a bin edge) are merged; a gradient's steps sit further apart than
// that, so a flat swatch still outranks a gradient.
function findPalette(px, w, x0, y0, x1, y1) {
  const bins = new Map(); let lsum = 0, count = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((x1 - x0 + 1) * (y1 - y0 + 1) / 40000)));
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
    const i = (y * w + x) * 4; if (px[i + 3] < 200) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 }; bin.n++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
    lsum += (.2126 * r + .7152 * g + .0722 * b) / 255; count++;
  }
  const groups = [];
  for (const b of [...bins.values()].sort((p, q) => q.n - p.n)) {
    const c = [b.r / b.n, b.g / b.n, b.b / b.n], near = groups.find(g => Math.hypot(g.c[0] - c[0], g.c[1] - c[1], g.c[2] - c[2]) < 14);
    if (near) near.n += b.n; else groups.push({ c, n: b.n });
  }
  const list = groups.map(g => { const hex = toHex(...g.c), [, s, l] = hsl(hex); return { hex, n: g.n, s, l, score: g.n * (.35 + s) }; });
  const dominant = list[0]?.hex || '#35271f';
  const pick = pool => { const res = []; for (const c of pool.sort((a, b) => b.score - a.score)) { if (res.every(r => Math.hypot(...rgb(r).map((v, j) => v - rgb(c.hex)[j])) > 60)) res.push(c.hex); if (res.length === 3) break; } return res; };
  const vivid = list.filter(c => c.l < .92 && c.l > .08 && c.s > .12), share = vivid.reduce((sum, c) => sum + c.n, 0) * .02;
  let palette = pick(vivid.filter(c => c.n >= share));            // 2% of the coloured pixels: drops anti-aliased edge blends
  if (!palette.length) { const solid = list.filter(c => c.n >= count * .03); palette = pick(solid.length ? solid : list); }   // a black, white or grey identity
  const shades = list.slice().sort((a, b) => b.n - a.n).slice(0, 8).map(c => ({ hex: c.hex, share: c.n / count }));   // biggest colour groups, with their share of the pixels
  return { palette, dominant, lightness: count ? lsum / count : .5, shades };
}
// The CI image (a logo, a colour chart, a whole CI sheet, a photo) is read for colour only: it never goes onto the
// luggage. A coloured backdrop counts as a brand colour; white, grey or black paper does not.
export function readPalette(logo) {
  const { source } = logo, w = source.width, h = source.height;
  const { palette } = findPalette(source.data, w, 0, 0, w - 1, h - 1);
  const full = document.createElement('canvas'); full.width = w; full.height = h; full.getContext('2d').putImageData(source, 0, 0);
  const k = Math.min(1, 320 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fbf8f2'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(full, 0, 0, c.width, c.height);
  const thumb = c.toDataURL('image/jpeg', .84); full.width = full.height = c.width = c.height = 0;
  return { palette, thumb };
}
// Returns { dataUrl, palette, dominant, lightness, aspect } from an analysed logo.
export function processLogo(logo, knockout) {
  const { source } = logo, w = source.width, h = source.height;
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h), px = out.data;
  if (knockout && logo.back) {
    cutBackdrop(px, w, h, logo.back, globalThis.__kokkCutDebug);
    // safety net (18 Nov): a cut that leaves next to nothing took the logo for backdrop, so the logo is shown as it came
    let left = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 8) left++;
    if (left < Math.max(24, w * h * .002)) px.set(source.data);
  }
  // trim transparent margins
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const full = document.createElement('canvas'); full.width = w; full.height = h; full.getContext('2d').putImageData(out, 0, 0);
  let scale = 1, dataUrl = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(tw * scale)); c.height = Math.max(1, Math.round(th * scale));
    c.getContext('2d').drawImage(full, x0, y0, tw, th, 0, 0, c.width, c.height);
    dataUrl = c.toDataURL('image/png'); c.width = c.height = 0;
    if (dataUrl.length < 2400000) break; scale *= .7;
  }
  full.width = full.height = 0;
  return { dataUrl, ...findPalette(px, w, x0, y0, x1, y1), aspect: tw / th };
}

// ---------- rule engine ----------
function ciColors(ci) {
  const primary = ci.colors[0] || ci.logo?.dominant || '#35271f';
  const [h, s, l] = hsl(primary);
  const secondary = ci.colors[1] || fromHsl(h, s, Math.max(.12, l - .3));
  const accent = ci.colors[2] || secondary;
  const given = ci.colors.length ? [...new Set(ci.colors.map(v => v.toLowerCase()))] : [primary.toLowerCase()];
  // dark: the brand's own dark colour as dyed sedge, the ground for a pale or white logo (before plain espresso)
  const deepest = given.slice().sort((a, b) => lum(a) - lum(b))[0], [dh, ds, dl] = hsl(deepest);
  const dark = lum(deepest) < .15 ? fromHsl(dh, Math.min(ds, .55), clamp(dl, .17, .3)) : null;   // kept deep (dyedSedge would lift a midnight navy to royal blue)
  return { primary: primary.toLowerCase(), secondary, accent, h, s, l, given, dark };
}
const isWarm = h => h < 75 || h >= 300;
const apart = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));   // plain RGB distance: tells gold from beige, which contrast() cannot
// Logo size is the root of its area in panel widths, so a wide wordmark and a square emblem look the same size.
const MARK = { s: .22, m: .3, l: .4 };
// The logo always keeps its own colours (12 Nov, user: "the logo must stay as it is, its colours must not disappear").
// So nothing here ever sets artInk for a logo. When the logo would not show on a sedge colour, the sedge changes instead.
// reads(): how much of the logo stays visible on a sedge colour, as the share of its pixels that contrast with it.
const READS = .25;   // a quarter of the logo contrasting is enough to read it: a pale outline must not count against a dark body
function reads(logo, weave) {
  const shades = logo?.shades; if (!shades?.length) return 1;
  let hit = 0, all = 0;
  for (const g of shades) { all += g.share; if (contrast(g.hex, weave) >= 1.6) hit += g.share; }
  return all ? hit / all : 1;
}
// First sedge colour in the list on which the logo reads (and, when a frame is given, which differs from it); else the best of them.
function sedgeFor(ci, shell, candidates) {
  const list = [...new Set(candidates.filter(Boolean))];
  if (!ci.logo) return list[0];
  return list.find(w => reads(ci.logo, w) >= READS && (!shell || contrast(shell, w) >= 1.15)) || list.slice().sort((a, b) => reads(ci.logo, b) - reads(ci.logo, a))[0];
}
const sedgeTh = w => w === NATURAL || w === SEDGE ? 'กกสีธรรมชาติ' : w === IVORY ? 'กกสีงาช้าง' : w === ESPRESSO ? 'กกโทนเอสเปรสโซ' : 'กกย้อมสีเข้มของแบรนด์';
function baseCfg() { return { size: 'cabin', finish: 'matte', name: '', nameColor: ESPRESSO, nameSize: 21, nameX: 50, nameY: 18, font: 'sans', flag: 'none', flagPosition: 'side', artwork: null, artScale: 62, artPosition: 'center', artInk: null, artX: null, artY: null, accent: null, accent2: null, trim: null, patch: null, plate: false }; }
function withMark(cfg, ci, mark) {
  // mark: {scale, position, ink|null}; ink colours lettering only, a logo keeps its own colours. With no logo the brand name becomes centred lettering.
  if (ci.logo) { Object.assign(cfg, { artwork: ci.logo.dataUrl, artScale: mark.scale, artPosition: mark.position || 'center', artInk: null }); }
  else if (ci.name && !cfg.name) { Object.assign(cfg, { name: ci.name, font: mark.font || 'serif', nameSize: clamp(Math.round(18 + mark.scale * .3), 22, 44), nameX: 50, nameY: mark.position === 'upper' ? 30 : 50, nameColor: mark.ink || bestInk(cfg.weave) }); }
  return cfg;
}
// A motif dyed in CI colours and the brand mark share the panel, so the mark sits in the clear space above the motif
// and a short name below it. CLEAR gives that space per motif (renderer.js patternAccents): centre line y and widest
// mark w as shares of the panel, foot = lettering line below the motif. The chevron's top edge drops toward the
// centre, so a wide mark fits above it. All-over motifs (herringbone) leave no clear space.
const PANEL_RATIO = 334 / 462;                              // cabin panel, width / height
// A grid cell is too small for a logo: there the space is for lettering only.
const CLEAR = { minimal: { y: .22, w: .72, foot: 88, type: 34 }, diamond: { y: .13, w: .72, foot: 93, type: 30 }, grid: { y: .125, w: .27, foot: 87.5, type: 22 } };
function markWidth(pattern, aspect) {
  const z = CLEAR[pattern]; if (!z) return 0;
  let w = Math.min(z.w, 2 * (z.y - .03) * aspect / PANEL_RATIO);
  if (pattern === 'minimal') w = Math.min(w, (.58 - z.y - .05) / (.2895 + .5 * PANEL_RATIO / aspect));   // .58 = chevron point, .2895 = half its slope
  return w;
}
// Places the logo (or, with no logo, the lettering) clear of a dyed motif. False when it cannot fit there.
function clearOfMotif(cfg, ci, text) {
  const z = CLEAR[cfg.pattern]; if (!z) return false;
  const ink = contrast(cfg.accent, cfg.weave) >= 3 ? cfg.accent : bestInk(cfg.weave), short = text && (cfg.pattern !== 'grid' || text.length <= 9);
  if (ci.logo) {
    const w = cfg.pattern === 'grid' ? 0 : markWidth(cfg.pattern, ci.logo.aspect); if (w < .2) return false;
    Object.assign(cfg, { artwork: ci.logo.dataUrl, artScale: clamp(Math.round(w * 100), 25, 100), artPosition: 'upper', artX: null, artY: z.y * 100, artInk: null });
    Object.assign(cfg, short ? { name: text, font: 'sans', nameSize: 16, nameX: 50, nameY: z.foot, nameColor: bestInk(cfg.weave) } : { name: '' });
  } else if (text) {
    const size = Math.floor(z.w * 334 / (text.length * .64)); if (size < 14) return false;
    Object.assign(cfg, { name: text, font: cfg.font === 'serif' ? 'serif' : 'bold', nameSize: Math.min(z.type, size), nameX: 50, nameY: z.y * 100, nameColor: ink });
  }
  return true;
}
// The motif woven in CI colours: main strands in the brand colour that shows best on the sedge, the motif's second
// element in another CI colour. A brand colour too pale for natural sedge is woven on dark sedge instead.
function wovenCI(ci, c, base, pattern, weaves = [NATURAL, c.dark, ESPRESSO]) {
  for (const weave of weaves) {
    if (!weave || (ci.logo && reads(ci.logo, weave) < READS)) continue;
    const dye = c.given.find(v => contrast(v, weave) >= 1.5); if (!dye) continue;
    const cfg = { ...base, weave, pattern, accent: dye, accent2: c.given.find(v => v !== dye && contrast(v, weave) >= 1.6) || null };
    if (clearOfMotif(cfg, ci, ci.name)) return cfg;
  }
  return null;
}
const RECIPES = {
  // Signature splits a CI into roles the way a designer would (12 Nov, user's reference: a natural sedge body, the brand
  // colour as the structure, a fine line of the accent, a small emblem). Natural sedge is most of the case. The brand's
  // deepest colour is the frame. The colour that stands furthest from both is a piping line round the panel. The logo
  // is a small emblem in its own colours; when it would not show on the sedge it sits on a woven label in a brand
  // colour, so the sedge stays natural. The KOKK name plate keeps its own metal: the two names read as a pair.
  // ci.frame (a CI colour or 'metal') and ci.mark ('s' 'm' 'l') are the visitor's own choices on the card.
  signature(ci, c) {
    const shows = c.given.filter(v => contrast(v, SEDGE) >= 1.6).sort((a, b) => lum(a) - lum(b));   // colours that stand out from the sedge, darkest first
    const metal = ci.frame === 'metal', picked = !metal && c.given.includes(ci.frame) ? ci.frame : null;
    if (!picked && !metal && !shows.length) return this.signaturePale(ci, c);
    const shell = metal ? METALS.champagne : picked || shows[0];
    const lead = metal ? 'โครงแชมเปญ' : picked && picked !== shows[0] ? 'โครงใช้สี CI ที่คุณเลือก' : shows.length > 1 ? 'โครงใช้สีเข้มที่สุดของแบรนด์' : 'โครงใช้สีของแบรนด์';
    const trim = c.given.filter(v => v !== shell).map(v => ({ v, d: Math.min(apart(v, shell), apart(v, SEDGE)) })).filter(t => t.d >= 70).sort((a, b) => b.d - a.d)[0]?.v || null;
    const cfg = { ...baseCfg(), shell, weave: SEDGE, pattern: 'twill', trim, plate: true }, size = MARK[ci.mark] ? ci.mark : 'm';
    let mark = '';
    if (ci.logo) {
      Object.assign(cfg, { artwork: ci.logo.dataUrl, artScale: clamp(Math.round(MARK[size] * Math.sqrt(ci.logo.aspect || 1) * 100), 15, 80), artPosition: 'center', artY: 46, artInk: null });
      if (reads(ci.logo, SEDGE) < READS) cfg.patch = sedgeFor(ci, null, [contrast(shell, SEDGE) >= 1.6 ? shell : null, ...shows, c.dark, ESPRESSO]);
      mark = cfg.patch ? 'โลโก้สีจริงขนาดเล็ก ขอบสีแบรนด์ตามรูปทรงโลโก้ให้เห็นชัดบนกก ' : 'โลโก้สีจริงขนาดเล็กแบบตราสัญลักษณ์ ';
    } else if (ci.name) {
      Object.assign(cfg, { name: ci.name, font: 'serif', nameSize: { s: 24, m: 30, l: 38 }[size], nameX: 50, nameY: 46, nameColor: !metal && contrast(shell, SEDGE) >= 3 ? shell : ESPRESSO });
      mark = 'ชื่อแบรนด์อยู่กลางแผง ';
    }
    return { key: 'signature', name_en: 'Signature', name_th: 'ตรงตาม CI', why_th: `${lead} กกสีธรรมชาติเป็นพื้นหลัก ${trim ? 'เดินเส้นกุ๊นด้วยสีเน้นของแบรนด์ ' : ''}${mark}คู่กับป้าย KOKK`, cfg };
  },
  // A CI of pale colours only (nothing stands out from natural sedge): the earlier Signature, where the sedge takes a tone the colours show on.
  signaturePale(ci, c) {
    let weave = NATURAL; if (contrast(c.primary, NATURAL) < 1.6) weave = contrast(c.primary, IVORY) >= contrast(c.primary, ESPRESSO) ? IVORY : ESPRESSO;
    let shell = c.primary, lead = 'ใช้สีหลักของแบรนด์เป็นโครง';
    weave = sedgeFor(ci, null, [weave, c.dark, ESPRESSO, IVORY]);
    if (contrast(shell, weave) < 1.5) {   // the sedge had to take the brand's dark colour (a pale or white logo): the frame takes another CI colour
      const other = c.given.filter(v => v !== c.primary && contrast(v, weave) >= 1.5).sort((a, b) => contrast(b, weave) - contrast(a, weave))[0];
      shell = other || METALS.champagne; lead = other ? 'ใช้สี CI อีกสีหนึ่งเป็นโครง' : 'โครงแชมเปญ';
    }
    const size = MARK[ci.mark] ? ci.mark : 'm';
    const cfg = withMark({ ...baseCfg(), shell, weave, pattern: 'twill', plate: true }, ci, { scale: ci.logo ? clamp(Math.round(MARK[size] * Math.sqrt(ci.logo.aspect || 1) * 100), 15, 80) : { s: 20, m: 40, l: 66 }[size] });
    return { key: 'signature', name_en: 'Signature', name_th: 'ตรงตาม CI', why_th: `${lead} คู่กับ${sedgeTh(weave)} ${ci.logo ? 'โลโก้สีจริงขนาดเล็กแบบตราสัญลักษณ์' : 'ชื่อแบรนด์อยู่กลางแผง'} คู่กับป้าย KOKK`, cfg };
  },
  tonal(ci, c) {
    let shell = c.l < .18 ? METALS.black : isWarm(c.h) ? (c.l > .5 ? METALS.champagne : METALS.titanium) : METALS.silver;
    // sedge dyed in the brand colour; if the logo would vanish into it, a pale tint or a deep shade of the same colour
    const weave = sedgeFor(ci, null, [dyedSedge(c.primary), fromHsl(c.h, Math.min(c.s, .45), .8), fromHsl(c.h, Math.min(c.s, .55), .25), c.dark, NATURAL]), ink = hsl(weave)[2] < .5 ? IVORY : ESPRESSO;
    if (contrast(shell, weave) < 1.3) shell = lum(weave) > .4 ? METALS.graphite : METALS.silver;   // the frame steps away from a tint or shade it would blend into
    const cfg = withMark({ ...baseCfg(), shell, weave, pattern: 'herringbone' }, ci, { scale: 38, position: 'upper', ink });
    if (ci.name && ci.logo) Object.assign(cfg, { name: ci.name, font: 'sans', nameSize: 16, nameX: 50, nameY: 88, nameColor: ink });
    return { key: 'tonal', name_en: 'Tonal', name_th: 'โทนเดียว สุขุม', why_th: `กกย้อมเฉดสีแบรนด์บนโครงโลหะโทนกลาง ${ci.logo ? 'โลโก้สีจริงขนาดเล็ก' : 'ตัวอักษรสีเดียว'} เรียบ ดูดีได้นาน`, cfg };
  },
  statement(ci, c) {
    const pattern = ci.tone === 'bold' ? (ci.logo ? 'minimal' : 'grid') : ci.tone === 'warm' ? 'minimal' : 'diamond';   // a logo is too small inside one grid cell
    // frame: another CI colour (the darkest that is not the primary), else a deep shade of the primary, else black
    const other = c.given.filter(v => v !== c.primary && contrast(v, NATURAL) >= 1.5).sort((a, b) => lum(a) - lum(b))[0];
    const shell = other || (hsl(c.secondary)[2] < .35 ? c.secondary : METALS.black), base = { ...baseCfg(), shell, finish: 'satin' };
    const woven = wovenCI(ci, c, base, pattern) || (pattern !== 'minimal' && wovenCI(ci, c, base, 'minimal'));
    if (woven) {
      if (contrast(woven.shell, woven.weave) < 1.3) woven.shell = METALS.graphite;
      const mark = ci.logo ? 'โลโก้อยู่เหนือลาย ' : ci.name ? 'ชื่อแบรนด์อยู่เหนือลาย ' : '';
      return { key: 'statement', name_en: 'Statement', name_th: 'โดดเด่น', why_th: `สานลาย${PATTERN_TH[woven.pattern]} ด้วยสีของแบรนด์บนกก${woven.weave === NATURAL ? 'ธรรมชาติ' : 'โทนเข้ม'} ${mark}โครง${other ? 'ใช้สี CI อีกสีหนึ่ง' : 'สีเข้ม'} เด่นชัดในงานอีเวนต์และที่สนามบิน`, cfg: woven };
    }
    const cfg = withMark({ ...base, weave: NATURAL, pattern }, ci, { scale: 86, font: 'bold' });
    if (ci.name && ci.logo) Object.assign(cfg, { name: ci.name, font: 'bold', nameSize: 22, nameX: 50, nameY: 14, nameColor: contrast(c.primary, NATURAL) >= 2.2 ? c.primary : ESPRESSO });
    return { key: 'statement', name_en: 'Statement', name_th: 'โดดเด่น', why_th: `${ci.logo ? 'โลโก้ใหญ่' : 'ชื่อแบรนด์ตัวใหญ่'}บนกกธรรมชาติ ตัดกับโครงสีเข้ม เด่นชัดในงานอีเวนต์และที่สนามบิน`, cfg };
  },
  heritage(ci, c) {
    const woven = wovenCI(ci, c, { ...baseCfg(), shell: METALS.champagne, font: 'serif' }, 'diamond');
    if (woven) return { key: 'heritage', name_en: 'Heritage', name_th: 'คลาสสิกแบบงานคราฟท์', why_th: `โครงแชมเปญกับกก${woven.weave === NATURAL ? 'ธรรมชาติ' : 'โทนเข้ม'} สานลายข้าวหลามตัดด้วยสีของแบรนด์ รายละเอียดเล็กและสุภาพ ให้ความรู้สึกของที่ระลึกงานฝีมือ`, cfg: woven };
    const cfg = withMark({ ...baseCfg(), shell: METALS.champagne, weave: NATURAL, pattern: 'diamond' }, ci, { scale: 40, position: 'upper' });
    if (ci.name && ci.logo) Object.assign(cfg, { name: ci.name, font: 'serif', nameSize: 20, nameX: 50, nameY: 86, nameColor: ESPRESSO });
    return { key: 'heritage', name_en: 'Heritage', name_th: 'คลาสสิกแบบงานคราฟท์', why_th: 'โครงแชมเปญกับกกธรรมชาติลายข้าวหลามตัด รายละเอียดแบรนด์เล็กและสุภาพ ให้ความรู้สึกของที่ระลึกงานฝีมือ', cfg };
  },
  mono(ci, c) {
    const shell = isWarm(c.h) ? METALS.ivory : METALS.silver;
    const weave = sedgeFor(ci, shell, [IVORY, NATURAL, c.dark, ESPRESSO]), light = lum(weave) > .4;
    const cfg = withMark({ ...baseCfg(), shell, weave, pattern: 'twill' }, ci, { scale: 80, ink: c.primary });
    if (!ci.logo) return { key: 'mono', name_en: 'Monochrome', name_th: 'ขาวนวล เส้นสีแบรนด์', why_th: 'ทั้งใบเป็นโทนงาช้าง ชื่อแบรนด์เป็นสีหลักของแบรนด์สีเดียว สะอาด ทันสมัย', cfg };
    return { key: 'mono', name_en: 'Monochrome', name_th: light ? 'ขาวนวล โลโก้เด่น' : 'เรียบ โลโก้เด่น', why_th: `${light ? 'ทั้งใบเป็นโทนงาช้าง' : 'กกสีเข้มของแบรนด์กับโครงโลหะสีอ่อน'} ไม่มีลายอื่น ให้โลโก้สีจริงเป็นจุดเด่นเดียว สะอาด ทันสมัย`, cfg };
  },
  inverse(ci, c, rnd) {
    // a dark logo cannot sit on dark sedge in its own colours: with a brand name, the name is lettered in a light ink instead
    if (ci.logo && ci.name && reads(ci.logo, ESPRESSO) < READS) ci = { ...ci, logo: null };
    const woven = wovenCI(ci, c, { ...baseCfg(), shell: METALS.titanium }, 'minimal', [ESPRESSO]);
    if (woven) return { key: 'inverse', name_en: 'Inverse', name_th: 'กกเข้ม ลายสีแบรนด์', why_th: 'กกโทนเอสเปรสโซบนโครงไทเทเนียม สานลาย V ด้วยสีของแบรนด์ เด่นบนพื้นเข้ม เหมาะเป็นของขวัญผู้บริหาร', cfg: woven };
    const tint = fromHsl(c.h, Math.min(c.s, .4), .85), ink = rnd() < .5 && contrast(tint, ESPRESSO) >= 4 ? tint : IVORY;
    const cfg = withMark({ ...baseCfg(), shell: METALS.titanium, weave: ESPRESSO, pattern: 'minimal' }, ci, { scale: 58, ink });
    if (ci.name && ci.logo) Object.assign(cfg, { name: ci.name, font: 'sans', nameSize: 16, nameX: 50, nameY: 86, nameColor: ink });
    return { key: 'inverse', name_en: 'Inverse', name_th: 'กกเข้ม รายละเอียดสว่าง', why_th: 'กกโทนเอสเปรสโซบนโครงไทเทเนียม รายละเอียดแบรนด์สีอ่อนเด่นบนพื้นเข้ม เหมาะเป็นของขวัญผู้บริหาร', cfg };
  }
};
const POOL = Object.keys(RECIPES).filter(k => k !== 'signaturePale');
function repair(cfg, ci) {
  if (contrast(cfg.shell, cfg.weave) < 1.15) { const [h, s, l] = hsl(cfg.weave); cfg.weave = fromHsl(h, s, l > .5 ? l - .25 : l + .25); }
  if (cfg.artwork && ci.logo) {   // the logo keeps its own colours; if it would not show here, the sedge moves
    cfg.artInk = null;
    if (!cfg.patch && reads(ci.logo, cfg.weave) < READS) cfg.weave = sedgeFor(ci, cfg.shell, [ciColors(ci).dark, NATURAL, IVORY, ESPRESSO]);   // a logo on its own label needs no change of sedge
  }
  if (cfg.name && contrast(cfg.nameColor, cfg.weave) < 1.8) cfg.nameColor = bestInk(cfg.weave);
  if (cfg.accent && contrast(cfg.accent, cfg.weave) < 1.3) cfg.accent = cfg.accent2 = null;   // a dye that does not show
  if (cfg.accent2 && contrast(cfg.accent2, cfg.weave) < 1.2) cfg.accent2 = null;
  if (!cfg.artwork && !cfg.name && ci.name) withMark(cfg, ci, { scale: 60 });
  return cfg;
}
export function ruleSet(ci, setIndex, seed = 1) {
  const rnd = seeded(seed * 7919 + setIndex * 104729);
  let keys;
  if (setIndex === 0) keys = ['signature', 'tonal', 'statement'];
  else if (setIndex === 1) keys = ['heritage', 'mono', 'inverse'];
  else { const order = POOL.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } keys = order.slice(0, 3); }
  const c = ciColors(ci);
  return keys.map(k => {
    const concept = RECIPES[k](ci, c, rnd);
    if (setIndex > 1) { // vary later sets so they never repeat exactly (a dyed motif keeps its composition)
      const pats = Object.keys(PATTERN_TH), dyed = !!concept.cfg.accent, roll = [rnd(), rnd(), rnd()];
      if (!dyed) concept.cfg.pattern = pats[Math.floor(roll[0] * pats.length)];
      concept.cfg.finish = roll[1] < .5 ? 'matte' : 'satin';
      if (concept.cfg.artwork && !dyed) concept.cfg.artScale = clamp(Math.round(concept.cfg.artScale + (roll[2] - .5) * 20), 25, 100);
    }
    if (!ci.logo && !ci.name) Object.assign(concept, { why_th: concept.why_th.replace(/ชื่อแบรนด์[^ ]*/, 'ลายสาน') });
    concept.cfg = repair(concept.cfg, ci); return concept;
  });
}

// ---------- brand colour table (field 03) ----------
// A brand name typed in field 03 is looked up in brand-colors.js (Simple Icons, one main colour per brand). The table ships
// with the site and loads on the first keystroke: a Claude Artifact cannot call any outside service, and nothing here uses AI.
// brandKey: the same rule as tools/build-brand-colors.cjs (lower case, Latin accents dropped, only letters, digits, vowel marks).
export const brandKey = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '');
// words a visitor may add after the brand itself ("Toyota Thailand", "Hilton Hotels"); dropped one at a time from the end.
// Company forms (co, inc, ltd) are NOT dropped: made-up names often end with them and "TEAL CO" would match the brand "Teal".
const TAIL = new Set(['thailand', 'thai', 'th', 'group', 'global', 'international', 'official', 'hotel', 'hotels', 'resorts']);
// A load that fails is not kept (13 Nov: the first request for the new file failed once on the Claude link and the page then held
// an empty table until reload): the next keystroke asks again. The '#n' makes the retry a new module address, because a browser
// may remember a failed module; a fragment is never sent to the server, so the same file is fetched.
let tablePromise = null, tableTries = 0;
const brandTable = () => tablePromise ||= import('./brand-colors.js?v=3' + (tableTries++ ? '#' + tableTries : ''))
  .then(m => new Map(m.BRAND_COLORS.split(',').map(e => { const i = e.lastIndexOf('='); return [e.slice(0, i), '#' + e.slice(i + 1)]; })))
  .catch(() => { tablePromise = null; return new Map(); });
export async function brandColor(name) {
  const table = await brandTable(), words = String(name).trim().split(/\s+/).filter(w => brandKey(w));
  while (words.length) {
    const hex = table.get(brandKey(words.join(' '))); if (hex) return hex;
    if (words.length < 2 || !TAIL.has(brandKey(words[words.length - 1]))) break;
    words.pop();
  }
  return null;
}

// ---------- UI ----------
export function initBrands({ R, host, toast, showImage, applyDesign }) {
  // slots: the three brand colours; src: where each came from ('image' = the CI image, 'logo', null = typed by hand)
  const state = { logo: null, logoInfo: null, swatch: null, tone: null, slots: [null, null, null], src: [null, null, null], set: 0, seed: 1, concepts: [], ci: null, engine: 'rule', example: true, busy: false, avoid: [] };
  const EXAMPLE = { name: 'ARUNA', colors: ['#1f6f6b', '#e2725b'], tone: 'warm', logo: null };
  const cards = $('brand-cards'), go = $('brand-go'), err = $('brand-error');

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); e.target._paint?.(); } }), { rootMargin: '200px' }) : null;
  function specLine(cfg) {
    const mark = cfg.artwork ? (cfg.artInk ? 'สีเดียว ' : 'สีจริง ') + ({ upper: 'ด้านบน', center: 'กลางแผง', lower: 'ด้านล่าง' })[cfg.artPosition] : cfg.name ? 'ตัวอักษร ' + cfg.name : 'ไม่มี';
    return `โครง ${colorLabel(cfg.shell)} · กก ${colorLabel(cfg.weave)} · ลาย${PATTERN_TH[cfg.pattern]}${cfg.accent && cfg.pattern !== 'twill' ? ' สี ' + colorLabel(cfg.accent) : ''}${cfg.trim ? ' · เส้นกุ๊น ' + colorLabel(cfg.trim) : ''} · โลโก้ ${mark}${cfg.artwork && cfg.patch ? ' ขอบตามรูปทรง ' + colorLabel(cfg.patch) : ''}`;
  }
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Tune: the visitor's own choices on the Signature card. frame = a CI colour, 'metal' (champagne) or null (the engine decides); mark = logo size.
  const tune = { frame: null, mark: 'm' };
  const source = () => state.example ? EXAMPLE : state.ci;
  function tuneRows(c) {
    if (c.key !== 'signature') return '';
    const ci = source(), given = [...new Set(ci.colors.map(v => v.toLowerCase()))], shell = c.cfg.shell.toLowerCase();
    const dot = (value, hex, label) => `<button type="button" class="tune-dot" data-frame="${value}" style="--dot:${hex}" aria-pressed="${shell === hex}" aria-label="${label}" title="${label}"></button>`;
    const frames = given.map(v => dot(v, v, `ใช้สี ${v.toUpperCase()} เป็นโครง`)).join('') + dot('metal', METALS.champagne, 'โครงแชมเปญ');
    const sizes = c.cfg.artwork || c.cfg.name ? `<div class="tune-row"><span class="tune-label">${c.cfg.artwork ? 'ขนาดโลโก้' : 'ขนาดชื่อ'}</span><div class="tune-opts">${[['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']].map(([k, t]) => `<button type="button" class="tune-size" data-mark="${k}" aria-pressed="${tune.mark === k}">${t}</button>`).join('')}</div></div>` : '';
    return `<div class="brand-tune" role="group" aria-label="ปรับแบบเอง"><div class="tune-row"><span class="tune-label">สีโครง</span><div class="tune-opts">${frames}</div></div>${sizes}</div>`;
  }
  function retune(change, refocus) {
    Object.assign(tune, change); state.concepts = signatureOf(source()); renderCards();
    cards.querySelector(refocus)?.focus({ preventScroll: true });
  }
  function renderCards() {
    cards.innerHTML = state.concepts.map((c, i) => `<article class="brand-card">${state.example ? '<span class="brand-tag">ตัวอย่าง</span>' : ''}<div class="brand-canvas"><canvas width="720" height="900" data-card="${i}" aria-label="แบบ ${esc(c.name_en)}"></canvas></div><div class="brand-copy"><h3>${esc(c.name_en)}</h3><p class="brand-th">${esc(c.name_th)}</p><p class="brand-why">${esc(c.why_th)}</p><p class="brand-spec">${esc(specLine(c.cfg))}</p>${tuneRows(c)}<div class="brand-actions"><button type="button" class="button dark" data-pick="${i}"><span>เลือกแบบนี้ ${AR_E}</span></button><button type="button" class="text-link" data-save="${i}">บันทึกภาพ</button></div></div></article>`).join('');
    cards.querySelectorAll('canvas[data-card]').forEach(cv => {
      const cfg = state.concepts[Number(cv.dataset.card)].cfg;
      cv._paint = () => R.renderLuggage(cv, cfg).catch(() => {});
      if (io) io.observe(cv); else cv._paint();
    });
    cards.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const c = state.concepts[Number(b.dataset.pick)]; applyDesign({ ...c.cfg }, `โหลดแบบ ${c.name_en} เข้าหน้าออกแบบแล้ว`); });
    cards.querySelectorAll('[data-save]').forEach(b => b.onclick = () => saveOne(Number(b.dataset.save), b));
    cards.querySelectorAll('[data-frame]').forEach(b => b.onclick = () => retune({ frame: b.dataset.frame }, `[data-frame="${b.dataset.frame}"]`));
    cards.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => retune({ mark: b.dataset.mark }, `[data-mark="${b.dataset.mark}"]`));
    $('brand-status').textContent = state.example ? 'ตัวอย่างจาก CI สมมติ ARUNA · เขียวหัวเป็ดกับส้มอิฐ' : `ออกแบบสำหรับ ${state.ci.name || 'แบรนด์ของคุณ'}`;
  }
  function showSkeleton() {
    cards.innerHTML = [0].map(() => '<article class="brand-card skeleton" aria-hidden="true"><div class="brand-canvas"></div><div class="brand-copy"><i></i><i></i><i></i></div></article>').join('');
    $('brand-status').textContent = 'กำลังออกแบบจาก CI ของคุณ…';
  }
  function setEngine(kind) {
    state.engine = kind;
    $('brand-engine').textContent = kind === 'ai' ? 'ออกแบบโดย AI (Claude) จาก CI ที่ให้มา' : kind === 'fallback' ? 'AI ไม่พร้อมใช้งานตอนนี้ จึงออกแบบอัตโนมัติจากสีและโลโก้ใน CI' : 'ออกแบบอัตโนมัติจากสีและโลโก้ใน CI';
  }
  function readCI() {
    const colors = state.slots.filter(Boolean);
    return { name: $('brand-name').value.trim().slice(0, 20), colors, tone: state.tone || 'quiet', logo: state.logoInfo ? { ...state.logoInfo } : null };
  }
  const signatureOf = ci => ruleSet({ ...ci, frame: tune.frame, mark: tune.mark }, 0, 1).slice(0, 1);
  async function design() {
    if (state.busy) return;
    const ci = readCI();
    if (!ci.colors.length && !ci.logo) { err.textContent = 'ใส่โลโก้ ภาพ CI หรือสีแบรนด์อย่างน้อย 1 อย่างก่อน'; err.hidden = false; $('brand-form').querySelector('[data-hex="0"]').focus(); return; }
    err.hidden = true; state.busy = true; go.disabled = true;
    state.ci = ci; state.example = false; showSkeleton();
    await new Promise(r => setTimeout(r, 450));
    tune.frame = null;   // a new CI: the engine assigns the roles again
    state.concepts = signatureOf(ci); setEngine('rule'); renderCards();
    state.busy = false; go.disabled = false;
    if (innerWidth <= 700) $('brand-status').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function exportBlob(canvas) { return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(Error('export')), 'image/png')); }
  async function deliver(blob, filename) {
    const r = await host.saveFile(blob, filename);
    if (r === 'manual') showImage(blob); else if (r === 'saved') toast('บันทึกภาพแล้ว');
  }
  const slug = () => ((state.example ? 'ARUNA' : state.ci?.name) || 'Brand').replace(/[^\w฀-๿-]+/g, '-');
  async function saveOne(i, button) {
    const c = state.concepts[i]; if (!c) return; button.disabled = true;
    try {
      const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 1500;
      await R.renderLuggage(cv, c.cfg, { export: { title: c.name_en, subtitle: (state.example ? 'ARUNA' : state.ci?.name) || c.name_th, footer: 'KOKK FOR BRANDS · CONCEPT' } });
      const blob = await exportBlob(cv); cv.width = cv.height = 0;
      await deliver(blob, `KOKK-for-brands-${slug()}-${c.name_en.replace(/\W+/g, '-')}.png`);
    } catch { toast('บันทึกภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); } finally { button.disabled = false; }
  }
  // ----- form wiring -----
  const colorInputs = [...document.querySelectorAll('[data-slot]')], hexInputs = [...document.querySelectorAll('[data-hex]')];
  // Field 03 offer: the main colour of a brand whose name is in the table (brandColor). Nothing changes until the visitor taps it.
  const nameInput = $('brand-name'); let offer = null, nameTicket = 0;
  function showOffer() {
    $('brand-match').hidden = !offer; if (!offer) return;
    const used = !!state.slots[0] && state.slots[0].toLowerCase() === offer;
    $('brand-match-dot').style.setProperty('--dot', offer);
    $('brand-match-text').textContent = used ? `ใช้สีแบรนด์ ${offer.toUpperCase()} เป็นสีหลักแล้ว` : `พบสีของแบรนด์ชื่อนี้ ${offer.toUpperCase()}`;
    $('brand-match-use').hidden = used;
  }
  function setSlot(i, hex, src = null) {
    state.slots[i] = hex; state.src[i] = hex ? src : null;
    hexInputs[i].value = hex ? hex.toUpperCase() : ''; if (hex) colorInputs[i].value = hex;
    hexInputs[i].closest('.color-slot').classList.toggle('filled', !!hex);
    showOffer();
  }
  nameInput.addEventListener('input', async () => {
    const t = ++nameTicket, hex = nameInput.value.trim().length >= 2 ? await brandColor(nameInput.value) : null;
    if (t === nameTicket) { offer = hex; showOffer(); }
  });
  $('brand-match-use').onclick = () => {
    if (!offer) return;
    // the brand colour becomes "หลัก"; the colours already in the slots move down one place (one that is nearly the same colour is dropped)
    const near = hex => Math.hypot(...rgb(hex).map((v, k) => v - rgb(offer)[k])) < 28;
    const rest = state.slots.map((hex, i) => hex && !near(hex) ? [hex, state.src[i]] : null).filter(Boolean);
    setSlot(0, offer); for (let i = 1; i < 3; i++) setSlot(i, rest[i - 1] ? rest[i - 1][0] : null, rest[i - 1] ? rest[i - 1][1] : null);
    err.hidden = true; toast('เติมสีหลักจากสีแบรนด์แล้ว แก้รหัสสีได้');
  };
  colorInputs.forEach((inp, i) => inp.addEventListener('input', () => { setSlot(i, inp.value); err.hidden = true; }));
  hexInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => { const v = normHex(inp.value); if (v && inp.value.replace('#', '').length >= 6) { state.slots[i] = v; state.src[i] = null; colorInputs[i].value = v; inp.closest('.color-slot').classList.add('filled'); err.hidden = true; } else if (!inp.value.trim()) { state.slots[i] = null; state.src[i] = null; inp.closest('.color-slot').classList.remove('filled'); } showOffer(); });
    inp.addEventListener('change', () => { const v = normHex(inp.value); if (v) setSlot(i, v); else if (inp.value.trim()) { inp.value = state.slots[i] ? state.slots[i].toUpperCase() : ''; toast('รหัสสีต้องเป็นแบบ #0A3D62'); } else setSlot(i, null); });
  });
  function applyLogo() {
    if (!state.logo) return;
    state.logoInfo = processLogo(state.logo, $('logo-knockout').checked);
    $('logo-preview').src = state.logoInfo.dataUrl; $('logo-tile').hidden = false; $('logo-empty').hidden = true; $('logo-tools').hidden = false;
    $('logo-drop').classList.add('has-logo');
    $('logo-tile').classList.toggle('on-dark', state.logoInfo.lightness > .72);   // a white or silver logo is shown on a dark checkerboard, so the cut can be judged
    logoColours();
  }
  function logoColours() {
    if (state.swatch || !state.logoInfo) return;
    const pal = state.logoInfo.palette; let k = 0;
    for (let i = 0; i < 3; i++) if (!state.slots[i] || state.src[i] === 'logo') setSlot(i, pal[k++] || null, 'logo');
  }
  const okFile = file => ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type) && file.size <= 8 * 1024 * 1024;
  let ticket = 0;
  $('brand-logo').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return; const t = ++ticket;
    if (!okFile(file)) { toast('เลือกไฟล์ PNG, JPG, WEBP หรือ SVG ขนาดไม่เกิน 8 MB'); e.target.value = ''; return; }
    try {
      const logo = await readLogo(file); if (t !== ticket) return;
      state.logo = logo; $('logo-knockout').checked = logo.plainBg; applyLogo(); err.hidden = true;
      toast(logo.plainBg ? 'เพิ่มโลโก้และลบพื้นหลังแล้ว' : 'เพิ่มโลโก้แล้ว');
    } catch { toast('เปิดไฟล์นี้ไม่ได้ กรุณาลองไฟล์อื่น'); } finally { e.target.value = ''; }
  });
  $('logo-knockout').addEventListener('change', applyLogo);
  $('logo-remove').onclick = () => {
    ticket++; state.logo = state.logoInfo = null; $('logo-tile').hidden = true; $('logo-empty').hidden = false; $('logo-tools').hidden = true; $('logo-drop').classList.remove('has-logo'); $('logo-preview').removeAttribute('src');
    for (let i = 0; i < 3; i++) if (state.src[i] === 'logo') setSlot(i, null);
  };
  // CI image slot: colour only. Its picture never reaches the luggage; its colours replace whatever the slots held.
  function showSwatch() {
    const on = !!state.swatch;
    $('ci-tile').hidden = !on; $('ci-empty').hidden = on; $('ci-tools').hidden = !on; $('ci-drop').classList.toggle('has-logo', on);
    if (on) { $('ci-preview').src = state.swatch.thumb; $('ci-note').textContent = `ดึงสีจากภาพนี้ ${state.swatch.palette.length} สี แก้รหัสสีได้`; } else $('ci-preview').removeAttribute('src');
  }
  let ciTicket = 0;
  $('brand-ci').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return; const t = ++ciTicket;
    if (!okFile(file)) { toast('เลือกไฟล์ PNG, JPG, WEBP หรือ SVG ขนาดไม่เกิน 8 MB'); e.target.value = ''; return; }
    try {
      const swatch = readPalette(await readLogo(file)); if (t !== ciTicket) return;
      if (!swatch.palette.length) { toast('ไม่พบสีในภาพนี้ กรุณาลองภาพอื่น'); return; }
      state.swatch = swatch; for (let i = 0; i < 3; i++) setSlot(i, swatch.palette[i] || null, 'image');
      showSwatch(); err.hidden = true; toast(`ดึงสี CI จากภาพแล้ว ${swatch.palette.length} สี`);
    } catch { toast('เปิดไฟล์นี้ไม่ได้ กรุณาลองไฟล์อื่น'); } finally { e.target.value = ''; }
  });
  $('ci-remove').onclick = () => {
    ciTicket++; state.swatch = null; showSwatch();
    for (let i = 0; i < 3; i++) if (state.src[i] === 'image') setSlot(i, null);
    logoColours();
  };
  for (const drop of [$('logo-drop'), $('ci-drop')]) {
    ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, () => drop.classList.add('drag')));
    ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, () => drop.classList.remove('drag')));
  }
  $('brand-form').addEventListener('submit', e => { e.preventDefault(); design(); });

  // Page looks complete before any input: an example set for a made-up CI.
  state.concepts = signatureOf(EXAMPLE); setEngine('rule'); renderCards();
}
