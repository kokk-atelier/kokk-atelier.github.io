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
  // Border: is it one flat colour?
  const border = []; const push = (x, y) => { const i = (y * w + x) * 4; border.push([px[i], px[i + 1], px[i + 2]]); };
  for (let x = 0; x < w; x += Math.max(1, w / 120 | 0)) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += Math.max(1, h / 120 | 0)) { push(0, y); push(w - 1, y); }
  const avg = [0, 1, 2].map(j => border.reduce((s, p) => s + p[j], 0) / border.length);
  const flat = border.filter(p => Math.hypot(p[0] - avg[0], p[1] - avg[1], p[2] - avg[2]) < 24).length / border.length > .94;
  return { source: data, plainBg: !transparent && flat, bg: avg };
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
  const { source, bg } = logo, w = source.width, h = source.height;
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h), px = out.data;
  if (knockout && logo.plainBg) {
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
      if (d < 20) px[i + 3] = 0; else if (d < 56) px[i + 3] = Math.round(px[i + 3] * (d - 20) / 36);
    }
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
      mark = cfg.patch ? 'โลโก้สีจริงขนาดเล็กบนป้ายสานสีแบรนด์ ' : 'โลโก้สีจริงขนาดเล็กแบบตราสัญลักษณ์ ';
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
    return `โครง ${colorLabel(cfg.shell)} · กก ${colorLabel(cfg.weave)} · ลาย${PATTERN_TH[cfg.pattern]}${cfg.accent && cfg.pattern !== 'twill' ? ' สี ' + colorLabel(cfg.accent) : ''}${cfg.trim ? ' · เส้นกุ๊น ' + colorLabel(cfg.trim) : ''} · โลโก้ ${mark}${cfg.artwork && cfg.patch ? ' บนป้าย ' + colorLabel(cfg.patch) : ''}`;
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
