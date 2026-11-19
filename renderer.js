// KOKK luggage renderer (mask-based). Same public API as renderer.js plus preload() and panelRect().
// Helpers below are copied unchanged from renderer.js; the photo path recolours assets/sedge-handle.jpg
// through alpha masks built by tools/build-masks.cjs from tools/geometry.cjs.
const textureCache = new Map();
const artworkCache = new Map();
const renderVersions = new WeakMap();

const sizes = {
  cabin: { width: 380, height: 510, label: 'CABIN · 20 INCH' },
  checkin: { width: 392, height: 590, label: 'CHECK-IN · 24 INCH' },
  trunk: { width: 366, height: 638, label: 'TRUNK · 28 INCH' }
};

function color(hex, offset = 0, alpha = 1) {
  const clean = /^#[\da-f]{6}$/i.test(hex || '') ? hex.slice(1) : '77745b';
  const channels = [0, 2, 4].map(index => Math.max(0, Math.min(255, parseInt(clean.slice(index, index + 2), 16) + offset)));
  return `rgba(${channels.join(',')},${alpha})`;
}

function rounded(ctx, x, y, width, height, radius = 12) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRound(ctx, x, y, width, height, radius, fill, stroke) {
  rounded(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function randomAt(x, y) {
  const number = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return number - Math.floor(number);
}

function metal(ctx, x, width, base, dark = false) {
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, color(base, dark ? -26 : -10));
  gradient.addColorStop(0.16, color(base, 35));
  gradient.addColorStop(0.4, color(base, 7));
  gradient.addColorStop(0.72, color(base, -16));
  gradient.addColorStop(1, color(base, -37));
  return gradient;
}

function weaveTexture(width, height, config) {
  const key = [width, height, config.weave, config.pattern, config.finish].join('|');
  if (textureCache.has(key)) return textureCache.get(key);
  const surface = document.createElement('canvas');
  surface.width = Math.ceil(width * 2);
  surface.height = Math.ceil(height * 2);
  const ctx = surface.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = color(config.weave, -38);
  ctx.fillRect(0, 0, width, height);
  const cell = 7;
  for (let row = 0; row < height / cell; row += 1) {
    for (let col = 0; col < width / cell; col += 1) {
      const x = col * cell;
      const y = row * cell;
      let shift = row;
      if (config.pattern === 'herringbone') shift = row + Math.abs((col % 16) - 8);
      if (config.pattern === 'minimal') shift = row + Math.abs(col - width / cell / 2);
      const vertical = Math.floor(col + shift) % 4 < 2;
      const variation = Math.round(randomAt(col, row) * 18 - 9);
      let accent = 0;
      if (config.pattern === 'grid') {
        const verticalBand = Math.abs(x - width / 3) < 6 || Math.abs(x - width * 2 / 3) < 6;
        const horizontalBand = [0.25, 0.5, 0.75].some(part => Math.abs(y - height * part) < 6);
        accent = verticalBand || horizontalBand ? 22 : -7;
      }
      if (config.pattern === 'minimal') {
        const chevronY = height * 0.46 + (width / 2 - Math.abs(x - width / 2)) * 0.72;
        accent = Math.abs(y - chevronY) < 13 ? 13 : 0;
      }
      if (config.pattern === 'diamond') {
        const distance = Math.abs(x - width / 2) / (width * 0.36) + Math.abs(y - height * 0.55) / (height * 0.29);
        accent = Math.abs(distance - 1) < 0.055 || Math.abs(distance - 0.83) < 0.035 ? 18 : 0;
      }
      const strandX = x + (vertical ? 0.8 : 0.1);
      const strandY = y + (vertical ? 0.1 : 0.8);
      const strandWidth = vertical ? cell - 1.6 : cell - 0.2;
      const strandHeight = vertical ? cell - 0.2 : cell - 1.6;
      const shine = vertical
        ? ctx.createLinearGradient(strandX, 0, strandX + strandWidth, 0)
        : ctx.createLinearGradient(0, strandY, 0, strandY + strandHeight);
      shine.addColorStop(0, color(config.weave, variation + accent - 15));
      shine.addColorStop(0.25, color(config.weave, variation + accent + 15));
      shine.addColorStop(0.7, color(config.weave, variation + accent + 2));
      shine.addColorStop(1, color(config.weave, variation + accent - 18));
      fillRound(ctx, strandX, strandY, strandWidth, strandHeight, 0.7, shine);
      ctx.lineWidth = 0.36;
      for (let fiber = 1; fiber < 4; fiber += 1) {
        ctx.strokeStyle = color(config.weave, randomAt(col + fiber, row + 2) > 0.5 ? 32 : -28, 0.28);
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(strandX + fiber * 1.3, strandY + 0.6);
          ctx.lineTo(strandX + fiber * 1.3 + 0.3, strandY + strandHeight - 0.6);
        } else {
          ctx.moveTo(strandX + 0.6, strandY + fiber * 1.3);
          ctx.lineTo(strandX + strandWidth - 0.6, strandY + fiber * 1.3 + 0.3);
        }
        ctx.stroke();
      }
    }
  }
  const shade = ctx.createLinearGradient(0, 0, width, height);
  shade.addColorStop(0, 'rgba(255,244,221,.12)');
  shade.addColorStop(0.5, 'rgba(255,244,221,0)');
  shade.addColorStop(1, 'rgba(28,19,12,.17)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  if (config.finish === 'satin') {
    const sheen = ctx.createLinearGradient(0, height, width, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.45, 'rgba(255,250,233,.02)');
    sheen.addColorStop(0.7, 'rgba(255,250,233,.2)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
  }
  if (textureCache.size >= 6) textureCache.delete(textureCache.keys().next().value);
  textureCache.set(key, surface);
  return surface;
}

function flag(ctx, country, x, y, width, height) {
  ctx.save();
  rounded(ctx, x, y, width, height, 1.5);
  ctx.clip();
  ctx.fillStyle = '#ede9dd';
  ctx.fillRect(x, y, width, height);
  const stripes = (colors, weights) => {
    let offset = 0;
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    colors.forEach((fill, index) => {
      const bandHeight = height * weights[index] / total;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y + offset, width, bandHeight + 0.4);
      offset += bandHeight;
    });
  };
  if (country === 'th') stripes(['#923631', '#eee9db', '#25314a', '#eee9db', '#923631'], [1, 1, 2, 1, 1]);
  if (country === 'jp') {
    ctx.fillStyle = '#a43a38';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  if (country === 'fr') {
    ctx.fillStyle = '#273d59';
    ctx.fillRect(x, y, width / 3, height);
    ctx.fillStyle = '#a13c39';
    ctx.fillRect(x + width * 2 / 3, y, width / 3, height);
  }
  if (country === 'gb') {
    ctx.fillStyle = '#29374b';
    ctx.fillRect(x, y, width, height);
    const cross = (stroke, lineWidth, diagonal) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      if (diagonal) {
        ctx.moveTo(x, y); ctx.lineTo(x + width, y + height);
        ctx.moveTo(x + width, y); ctx.lineTo(x, y + height);
      } else {
        ctx.moveTo(x + width / 2, y); ctx.lineTo(x + width / 2, y + height);
        ctx.moveTo(x, y + height / 2); ctx.lineTo(x + width, y + height / 2);
      }
      ctx.stroke();
    };
    cross('#efe9db', height * 0.18, true);
    cross('#a13c39', height * 0.07, true);
    cross('#efe9db', height * 0.3, false);
    cross('#a13c39', height * 0.17, false);
  }
  if (country === 'us') {
    stripes(Array.from({ length: 13 }, (_, i) => i % 2 ? '#efe9db' : '#a13c39'), Array(13).fill(1));
    ctx.fillStyle = '#29374b';
    ctx.fillRect(x, y, width * 0.43, height * 7 / 13);
    ctx.fillStyle = '#efe9db';
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        ctx.beginPath();
        ctx.arc(x + width * (0.035 + col * 0.069), y + height * (0.055 + row * 0.103), height * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = 'rgba(25,17,12,.1)';
  ctx.lineWidth = 0.5;
  for (let line = y + 1; line < y + height; line += 2.5) {
    ctx.beginPath(); ctx.moveTo(x, line); ctx.lineTo(x + width, line); ctx.stroke();
  }
  ctx.restore();
}

function wheel(ctx, x, y, radius, shell) {
  fillRound(ctx, x - 10, y - 28, 20, 25, 5, metal(ctx, x - 10, 20, shell));
  ctx.fillStyle = '#272521';
  ctx.beginPath(); ctx.ellipse(x + 6, y, radius, radius * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#141513';
  ctx.beginPath(); ctx.ellipse(x - 2, y, radius * 0.89, radius * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = metal(ctx, x - radius, radius * 2, shell);
  ctx.beginPath(); ctx.ellipse(x - 3, y, radius * 0.64, radius * 0.77, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(241,224,190,.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x - 3, y, radius * 0.64, radius * 0.77, 0, 0, Math.PI * 2); ctx.stroke();
}

function sedgeHandle(ctx, x, y, width, sedge, hardware) {
  ctx.save();
  ctx.translate(x,y);
  const arch = (at) => -27 - 22 * 4 * at * (1-at);
  // Metal pivots carry the load; fine sedge wraps the entire grip.
  for (const at of [0,width]) {
    fillRound(ctx,at-10,-9,20,13,4,metal(ctx,at-10,20,hardware),'#6b543a');
    fillRound(ctx,at-4,-30,8,25,3,metal(ctx,at-4,8,hardware));
  }
  ctx.beginPath();ctx.moveTo(0,-36);ctx.quadraticCurveTo(width/2,-80,width,-36);
  ctx.lineTo(width,-17);ctx.quadraticCurveTo(width/2,-61,0,-17);ctx.closePath();
  ctx.save();ctx.shadowColor='rgba(35,25,13,.25)';ctx.shadowBlur=7;ctx.shadowOffsetY=3;
  ctx.fillStyle=color(sedge,-25);ctx.fill();ctx.restore();
  ctx.save();ctx.clip();
  const shine=ctx.createLinearGradient(0,-73,0,-15);
  shine.addColorStop(0,color(sedge,34));shine.addColorStop(.35,color(sedge,12));shine.addColorStop(.7,color(sedge,-8));shine.addColorStop(1,color(sedge,-45));
  ctx.fillStyle=shine;ctx.fillRect(-4,-80,width+8,80);
  for(let at=1;at<width;at+=3.2){
    const t=at/width; const cy=arch(t);const tilt=(t-.5)*5;
    ctx.strokeStyle=color(sedge,-43,.65);ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(at+tilt,cy-11);ctx.quadraticCurveTo(at-1,cy,at-tilt,cy+12);ctx.stroke();
    ctx.strokeStyle=color(sedge,48,.7);ctx.lineWidth=.85;
    ctx.beginPath();ctx.moveTo(at+tilt+1,cy-10);ctx.quadraticCurveTo(at+1,cy,at-tilt+1,cy+10);ctx.stroke();
  }
  for(let band=-8;band<=8;band+=3.5){
    ctx.beginPath();ctx.moveTo(0,-27+band);ctx.quadraticCurveTo(width/2,-71+band,width,-27+band);
    ctx.strokeStyle=color(sedge,band<0?35:-35,.4);ctx.lineWidth=.75;ctx.stroke();
  }
  ctx.restore();
  for(const at of [-5,width-5])fillRound(ctx,at,-38,10,24,4,metal(ctx,at,10,hardware),'#7d6244');
  ctx.restore();
}

// Die-cut (14 Nov, user): cut the artwork along its outline. The backdrop is found from the image's edge and removed only
// where it is connected to the edge (a flood fill), so the same colour inside the shape (a white face on white paper)
// stays. The cut edge is softened over the colour step between backdrop and shape, then the result is trimmed to the shape.
// Images that are already see-through at the edge are only trimmed. Cached per image.
const cutCache = new WeakMap();
export function dieCut(image) {
  if (!image) return null;
  if (cutCache.has(image)) return cutCache.get(image);
  const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), px = img.data, N = w * h;
  const edge = []; for (let i = 0; i < w; i++) edge.push(i, (h - 1) * w + i); for (let j = 1; j < h - 1; j++) edge.push(j * w, j * w + w - 1);
  const clear = edge.filter(i => px[i * 4 + 3] < 16).length / edge.length;
  if (clear < 0.5) {
    const opaque = edge.filter(i => px[i * 4 + 3] >= 16);
    const bg = [0, 1, 2].map(k => { const v = opaque.map(i => px[i * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; });
    const dist = i => Math.hypot(px[i * 4] - bg[0], px[i * 4 + 1] - bg[1], px[i * 4 + 2] - bg[2]);
    const T1 = 46, T2 = 96, seen = new Uint8Array(N), stack = [];
    for (const i of edge) if (!seen[i] && (px[i * 4 + 3] < 16 || dist(i) < T1)) { seen[i] = 1; stack.push(i); }
    while (stack.length) {
      const i = stack.pop(), cx = i % w;
      for (const j of [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= N || seen[j]) continue;
        if (px[j * 4 + 3] < 16 || dist(j) < T1) { seen[j] = 1; stack.push(j); }
      }
    }
    for (let i = 0; i < N; i++) {
      if (seen[i]) { px[i * 4 + 3] = 0; continue; }
      const cx = i % w;                                         // edge of the shape: fade the blend pixels into the cut
      if ((cx > 0 && seen[i - 1]) || (cx < w - 1 && seen[i + 1]) || (i >= w && seen[i - w]) || (i + w < N && seen[i + w])) {
        const t = Math.max(0, Math.min(1, (dist(i) - T1) / (T2 - T1)));
        px[i * 4 + 3] = Math.round(px[i * 4 + 3] * t);
      }
    }
    x.putImageData(img, 0, 0);
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (px[(y * w + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let out = c;
  if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < w - 1 || y1 < h - 1)) {
    out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    c.width = c.height = 0;
  }
  cutCache.set(image, out);
  return out;
}

function loadArtwork(src) {
  if (!src || !/^data:image\/(png|jpeg|webp);/i.test(src)) return Promise.resolve(null);
  if (!artworkCache.has(src)) {
    const promise = new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
    if (artworkCache.size >= 3) artworkCache.delete(artworkCache.keys().next().value);
    artworkCache.set(src, promise);
  }
  return artworkCache.get(src);
}

function drawPanel(ctx, px, py, pw, ph, config, artwork, paintWeave = true) {
  if (paintWeave) ctx.drawImage(weaveTexture(pw, ph, config), px, py, pw, ph);
  if (artwork) {
    const maxWidth = pw * Math.max(0.25, Math.min(1, Number(config.artScale) / 100));
    const fit = Math.min(maxWidth / artwork.width, ph * 0.64 / artwork.height);
    const aw = artwork.width * fit;
    const ah = artwork.height * fit;
    const center = config.artPosition === 'upper' ? 0.32 : config.artPosition === 'lower' ? 0.72 : 0.54;
    const ay = py + Math.max(5, Math.min(ph - ah - 5, ph * center - ah / 2));
    ctx.globalAlpha = 0.89;
    ctx.drawImage(artwork, px + (pw - aw) / 2, ay, aw, ah);
    ctx.globalAlpha = 0.13;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(weaveTexture(pw, ph, config), px, py, pw, ph);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  if (config.flag !== 'none') {
    const ribbon = config.flag === 'th' || config.flag === 'fr';
    if (ribbon && config.flagPosition === 'side') {
      const ribbonWidth = 26;
      const ribbonX = px + pw - 48;
      if (config.flag === 'th') {
        ctx.save();
        ctx.translate(ribbonX + ribbonWidth, py);
        ctx.rotate(Math.PI / 2);
        flag(ctx, 'th', 0, 0, ph, ribbonWidth);
        ctx.restore();
      } else flag(ctx, 'fr', ribbonX, py, ribbonWidth, ph);
    } else if (ribbon) flag(ctx, config.flag, px, py + 20, pw, 26);
    else if (config.flagPosition === 'side') flag(ctx, config.flag, px + pw - 65, py + 24, 46, 30);
    else flag(ctx, config.flag, px + pw / 2 - 40, py + 23, 80, 42);
  }
  if (config.name) {
    const rawName = String(config.name).trim();
    const text = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(rawName), part => part.segment).slice(0, 32).join('')
      : rawName;
    const fontFamilies = {
      sans: '"DM Sans", "Noto Sans Thai", sans-serif',
      serif: '"Playfair Display", "Noto Sans Thai", serif',
      signature: '"Caveat", "Noto Sans Thai", cursive',
      mono: '"Courier New", "Noto Sans Thai", monospace',
      bold: '"DM Sans", "Noto Sans Thai", sans-serif'
    };
    const fontFamily = fontFamilies[config.font] || fontFamilies.sans;
    const fontWeight = config.font === 'bold' ? 700 : 500;
    const requestedSize = Number(config.nameSize);
    let fontSize = Number.isFinite(requestedSize) ? Math.max(12, Math.min(44, requestedSize)) : 21;
    const sideRibbon = config.flagPosition === 'side' && (config.flag === 'th' || config.flag === 'fr');
    const nameWidth = pw - 24;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    let metrics = ctx.measureText(text);
    while (Math.max(metrics.width, (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0)) > nameWidth && fontSize > 1) {
      fontSize -= 1;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      metrics = ctx.measureText(text);
    }
    const xPercent = Number(config.nameX);
    const yPercent = Number(config.nameY);
    const customX = config.nameX != null && Number.isFinite(xPercent);
    const customY = config.nameY != null && Number.isFinite(yPercent);
    const centerX = customX ? px + pw * Math.max(0, Math.min(100, xPercent)) / 100 : px + (pw - (sideRibbon ? 54 : 0)) / 2;
    const centerY = customY ? py + ph * Math.max(0, Math.min(100, yPercent)) / 100 : py + (config.flag !== 'none' ? 94 : 59);
    const leftExtent = Math.max(0, metrics.actualBoundingBoxLeft ?? metrics.width / 2);
    const rightExtent = Math.max(0, metrics.actualBoundingBoxRight ?? metrics.width / 2);
    const ascent = Math.max(0, metrics.actualBoundingBoxAscent ?? fontSize * 0.65);
    const descent = Math.max(0, metrics.actualBoundingBoxDescent ?? fontSize * 0.65);
    const nameX = Math.max(px + 12 + leftExtent, Math.min(px + pw - 12 - rightExtent, centerX));
    const nameY = Math.max(py + 12 + ascent, Math.min(py + ph - 12 - descent, centerY));
    ctx.fillStyle = color(config.nameColor);
    ctx.globalAlpha = 0.93;
    ctx.fillText(text, nameX, nameY);
    ctx.globalAlpha = 1;
    return { x: nameX - leftExtent, y: nameY - ascent, w: leftExtent + rightExtent, h: ascent + descent };
  }
  return null;
}

/** Draws a self-contained studio view. Canvas pixel size is controlled by its caller. */
async function renderIllustratedLuggage(canvas, input = {}, options = {}) {
  const version = (renderVersions.get(canvas) || 0) + 1;
  renderVersions.set(canvas, version);
  const config = {
    size: 'cabin', shell: '#35271f', weave: '#c5a878', pattern: 'twill',
    name: '', nameColor: '#35271f', font: 'sans', flag: 'none', flagPosition: 'top',
    artwork: null, artScale: 65, artPosition: 'center', finish: 'matte', ...input
  };
  const loadedArt = await loadArtwork(config.artwork), artwork = config.artCut === true ? dieCut(loadedArt) : loadedArt;
  if (renderVersions.get(canvas) !== version) return;
  const ctx = canvas.getContext('2d');
  const size = sizes[config.size] || sizes.cabin;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f1ece3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / 800, canvas.height / 1000);
  ctx.translate((canvas.width - 800 * scale) / 2, (canvas.height - 1000 * scale) / 2);
  ctx.scale(scale, scale);
  const bg = ctx.createRadialGradient(270, 290, 40, 430, 480, 670);
  bg.addColorStop(0, '#fbf8f1'); bg.addColorStop(1, '#e7dfd1');
  ctx.fillStyle = bg;
  ctx.fillRect(-1000, -1000, 2800, 3000);
  ctx.save();
  if (!options.export) {
    ctx.translate(400, 500);
    ctx.scale(1.15, 1.15);
    ctx.translate(-400, -500);
  }
  const width = size.width;
  const height = size.height;
  const x = 400 - width / 2 - 15;
  const y = 795 - height;
  const depth = 38;
  const shell = config.shell;
  const hub = /^#[0-9a-f]{6}$/i.test(config.wheel || '') ? config.wheel : shell;
  const hardware = '#aa9069';

  ctx.save();
  ctx.filter = 'blur(16px)';
  ctx.fillStyle = 'rgba(48,36,24,.18)';
  ctx.beginPath(); ctx.ellipse(422, 838, width * 0.58, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  wheel(ctx, x + 72, y + height + 26, 23, hub);
  wheel(ctx, x + width + 15, y + height + 20, 23, hub);

  sedgeHandle(ctx, x + width * .28, y - 5, width * .45, config.weave, shell);
  ctx.lineWidth = 1.5;
  fillRound(ctx, x + 20, y - 3, width + depth - 13, height + 2, 38, metal(ctx, x + width - 20, depth + 55, shell, true), color(shell, -32));
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color(shell, -44);
  ctx.beginPath(); ctx.moveTo(x + width + 18, y + 30); ctx.lineTo(x + width + 18, y + height - 27); ctx.stroke();
  ctx.strokeStyle = color(shell, 38, 0.65);
  ctx.beginPath(); ctx.moveTo(x + width + 21, y + 34); ctx.lineTo(x + width + 21, y + height - 30); ctx.stroke();
  for (const offset of [7,12,27,31]) {
    ctx.strokeStyle=color(shell,offset%2?36:-31,.55);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x+width+offset,y+31);ctx.quadraticCurveTo(x+width+offset+9,y+height*.5,x+width+offset,y+height-26);ctx.stroke();
  }
  // Sedge side grip, coordinated with the lift handle and woven panel.
  fillRound(ctx,x+width+14,y+height*.43,17,height*.17,6,metal(ctx,x+width+14,17,hardware),'#6f5c42');
  fillRound(ctx,x+width+16,y+height*.43+8,13,height*.17-16,5,color(config.weave,-12));
  for(let band=y+height*.43+10;band<y+height*.60-8;band+=3){
    ctx.strokeStyle=color(config.weave,-35,.65);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x+width+16,band);ctx.lineTo(x+width+29,band+1);ctx.stroke();
    ctx.strokeStyle=color(config.weave,35,.75);ctx.beginPath();ctx.moveTo(x+width+17,band+1);ctx.lineTo(x+width+28,band+2);ctx.stroke();
  }
  for (const at of [0.24, 0.73]) {
    const latchY = y + height * at;
    fillRound(ctx, x + width + 11, latchY, 16, 43, 4, metal(ctx, x + width + 10, 18, hardware), '#6a5942');
    fillRound(ctx, x + width + 16, latchY + 10, 5, 20, 2, '#62513e');
    ctx.fillStyle = '#dac5a0'; ctx.fillRect(x + width + 16, latchY + 11, 1.2, 16);
  }
  ctx.lineWidth = 1.5;
  fillRound(ctx, x, y, width, height, 35, metal(ctx, x, width, shell), color(shell, -34));
  ctx.lineWidth = 1;
  rounded(ctx, x + 3, y + 2, width - 6, height - 5, 32);
  ctx.strokeStyle = color(shell, 80, 0.45); ctx.stroke();
  const px = x + 23;
  const py = y + 24;
  const pw = width - 46;
  const ph = height - 48;
  fillRound(ctx, px - 6, py - 6, pw + 12, ph + 12, 22, metal(ctx, px, pw, hardware), '#59452f');
  fillRound(ctx, px - 2, py - 2, pw + 4, ph + 4, 18, '#3a2c21');
  ctx.save();
  rounded(ctx, px, py, pw, ph, 16); ctx.clip();
  drawPanel(ctx, px, py, pw, ph, config, artwork);
  const edge = ctx.createLinearGradient(px, py, px + pw, py);
  edge.addColorStop(0, 'rgba(20,13,7,.17)'); edge.addColorStop(0.05, 'rgba(20,13,7,0)');
  edge.addColorStop(0.94, 'rgba(20,13,7,0)'); edge.addColorStop(1, 'rgba(20,13,7,.2)');
  ctx.fillStyle = edge; ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  for (const [cx, cy, rotation] of [[x, y, 0], [x + width, y, 90], [x + width, y + height, 180], [x, y + height, 270]]) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation * Math.PI / 180);
    ctx.beginPath(); ctx.moveTo(0, 35); ctx.quadraticCurveTo(0, 0, 35, 0);
    ctx.lineTo(59, 0); ctx.lineTo(59, 13); ctx.lineTo(28, 16);
    ctx.quadraticCurveTo(17, 18, 15, 29); ctx.lineTo(13, 58); ctx.lineTo(0, 58); ctx.closePath();
    ctx.fillStyle = metal(ctx, 0, 54, shell); ctx.fill();
    ctx.strokeStyle = color(shell, 35, 0.55); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#c4ab7d'; ctx.beginPath(); ctx.arc(10, 42, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#58452f'; ctx.fillRect(9, 41.5, 2, 0.6);
    ctx.restore();
  }
  fillRound(ctx,x+width/2-34,py-13,68,23,3,metal(ctx,x+width/2-34,68,hardware),'#8e7859');
  ctx.fillStyle='#564330';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='13px Georgia,serif';ctx.fillText('KOKK',x+width/2,py-1);
  for(const side of [-1,1]){ctx.beginPath();ctx.arc(x+width/2+side*28,py-1,1.7,0,Math.PI*2);ctx.fill();}
  wheel(ctx, x + 32, y + height + 28, 27, hub);
  wheel(ctx, x + width - 30, y + height + 28, 27, hub);
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#35271f';
  if (options.export) {
    ctx.font = '500 55px Georgia, serif';
    ctx.fillText('K O K K', 400, 64);
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#88755e';
    ctx.fillText('THE PERSONAL ATELIER', 400, 108);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(size.label, 400, 909);
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillStyle = '#35271f';
    ctx.fillText('Designed by you.', 400, 947);
  } else {
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#9a8b78';
    ctx.fillText('K O K K   /   P E R S O N A L   A T E L I E R', 400, 914);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawPhotoPattern(ctx, width, height, config) {
 if(config.pattern==='twill')return;
 ctx.save();
 ctx.globalAlpha=config.pattern==='herringbone'?.32:.20;
 ctx.drawImage(weaveTexture(width,height,config),0,0,width,height);
 ctx.globalAlpha=.7;
 if(config.pattern==='grid'){
  for(const x of [width/3,width*2/3]){ctx.fillStyle=color(config.weave,-32,.7);ctx.fillRect(x-5,0,10,height);ctx.fillStyle=color(config.weave,35,.7);ctx.fillRect(x-3,0,5,height);}
  for(const y of [height*.25,height*.5,height*.75]){ctx.fillStyle=color(config.weave,-32,.7);ctx.fillRect(0,y-5,width,10);ctx.fillStyle=color(config.weave,35,.7);ctx.fillRect(0,y-3,width,5);}
 }
 if(config.pattern==='minimal'||config.pattern==='diamond'){
  ctx.strokeStyle=color(config.weave,-38,.7);ctx.lineWidth=2;
  ctx.beginPath();
  if(config.pattern==='minimal'){ctx.moveTo(width*.18,height*.39);ctx.lineTo(width*.5,height*.58);ctx.lineTo(width*.82,height*.39);}
  else{ctx.moveTo(width*.5,height*.25);ctx.lineTo(width*.83,height*.54);ctx.lineTo(width*.5,height*.83);ctx.lineTo(width*.17,height*.54);ctx.closePath();}
  ctx.stroke();
 }
 ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Photo path: geometry of assets/sedge-handle.jpg (see tools/geometry.cjs, measured from pixels)
// ---------------------------------------------------------------------------------------------
const PHOTO = { w: 1122, h: 1400 };
const CASE_CENTER = { x: 580, y: 703 };                       // uniform zoom pivot (the suitcase's own centre)
const SIZE_ZOOM = { cabin: 1, checkin: 1.03, trunk: 1.06 };   // 55 / 66 / 76 cm share one proportion
const SIZE_CM = { cabin: '55 cm', checkin: '66 cm', trunk: '76 cm' };
const PANEL = {
  xL: 205.6, xR: 837.85, hL: 958.8, hR: 1008.0,
  top: x => 210.274 - 0.02013 * x,
  bottom: x => 1153.077 + 0.05763 * x,
  box: { x0: 204.4, y0: 193.4, x1: 838.0, y1: 1201.4 },
};
const SHELL_BOX = { x0: 174, y0: 50, x1: 1016, y1: 1362 };
const WEAVE_BOX = { x0: 200, y0: 76, x1: 842, y1: 1206 };
const WHEEL_BOX = { x0: 200, y0: 1150, x1: 1010, y1: 1345 };   // the four hub discs (tools/geometry.cjs hubs)
const DIMENSION = { x: 118, y0: 1345, y1: 62 };

function loadImage(relative) {
  return new Promise(resolve => {
    const image = new Image(); let settled = false;
    const done = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => done(null), 7000);
    image.onload = () => done(image); image.onerror = () => done(null);
    image.src = new URL(relative, import.meta.url).href;
  });
}

let assetsPromise;
function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all(['./assets/sedge-handle.jpg', './assets/mask-shell.png', './assets/mask-panel.png', './assets/mask-grip.png', './assets/mask-hue.png', './assets/mask-wheel.png'].map(loadImage))
      .then(([photo, shell, panel, grip, hue, wheel]) => {
        if (!photo || !shell || !panel || !grip) { assetsPromise = null; return null; }
        // panel + grip are disjoint: one combined weave mask, built once at photo size.
        const weave = document.createElement('canvas');
        weave.width = PHOTO.w; weave.height = PHOTO.h;
        const wctx = weave.getContext('2d');
        wctx.drawImage(panel, 0, 0); wctx.drawImage(grip, 0, 0);
        return { photo, shell, panel, weave, hue, wheel };   // hue is optional (dark crevices/housings follow the shell hue); wheel = hub discs for config.wheel
      });
  }
  return assetsPromise;
}

/** Starts loading the photo and its three masks. Resolves to true when the photo path is available. */
export function preload() {
  return loadAssets().then(Boolean);
}

// Where the photo sits on a canvas: uniform scale k and offset (ox, oy), plus the rect it must cover.
function layout(width, height, config = {}, options = {}) {
  const header = options.export ? height * 0.115 : 0;
  const footer = options.export ? height * 0.075 : 0;
  const area = height - header - footer;
  // Preview: cover the canvas (both are 4:5). Export: fit between header and footer, as before.
  const base = options.export ? Math.min(width / PHOTO.w, area / PHOTO.h) : Math.max(width / PHOTO.w, area / PHOTO.h);
  const rect = { x: (width - PHOTO.w * base) / 2, y: header + (area - PHOTO.h * base) / 2, w: PHOTO.w * base, h: PHOTO.h * base };
  const zoom = SIZE_ZOOM[config.size] || 1;
  const k = base * zoom;
  const cx = rect.x + CASE_CENTER.x * base, cy = rect.y + CASE_CENTER.y * base;
  const clip = options.export ? rect : { x: 0, y: 0, w: width, h: height };
  return { k, ox: cx - CASE_CENTER.x * k, oy: cy - CASE_CENTER.y * k, rect, clip, header, footer };
}

/** Bounding box of the woven panel in canvas pixels for this canvas size and size option. */
export function panelRect(width, height, config = {}, options = {}) {
  const L = layout(width, height, config, options), b = PANEL.box;
  return { x: L.ox + b.x0 * L.k, y: L.oy + b.y0 * L.k, w: (b.x1 - b.x0) * L.k, h: (b.y1 - b.y0) * L.k };
}

// Scratch canvases, pooled by output size (at most 2 sizes alive; evicted ones are released).
const pool = new Map();
function scratch(width, height) {
  const key = width + 'x' + height;
  let entry = pool.get(key);
  if (entry) { pool.delete(key); pool.set(key, entry); return entry; }
  if (pool.size >= 2) {
    const [oldKey, old] = pool.entries().next().value;
    for (const c of [old.a, old.b, old.c, old.fibre, old.trim, old.print, old.ink, old.base, old.pbase]) { c.width = 0; c.height = 0; }
    pool.delete(oldKey);
  }
  const make = (w = width, h = height) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  entry = { a: make(), b: make(), c: make(), fibre: make(), fibreKey: '', trim: make(1, 1), trimKey: '', print: make(1, 1), ink: make(1, 1), base: make(), baseKey: '', pbase: make(1, 1), pbaseKey: '' };
  pool.set(key, entry);
  return entry;
}
function fit(canvas, w, h) {
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return canvas.getContext('2d'); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); return ctx;
}
function reset(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }

function placePhoto(ctx, L, image) {
  ctx.save();
  ctx.beginPath(); ctx.rect(L.clip.x, L.clip.y, L.clip.w, L.clip.h); ctx.clip();
  ctx.setTransform(L.k, 0, 0, L.k, L.ox, L.oy);
  ctx.drawImage(image, 0, 0, PHOTO.w, PHOTO.h);
  ctx.restore();
}

const NATIVE_SHELL = '#c5a16a';
const TINT = { floor: 0.14, screen: 0.85, screenMax: 0.6, pull: 0.5, pullMax: 0.4 };
// Recolour a whole layer (photo copy) to a material colour, then keep it only inside its mask.
function tintLayer(ctx, L, hex, reference, mask, box) {
  const valid = /^#[0-9a-f]{6}$/i.test(hex || '');
  ctx.save();
  ctx.setTransform(L.k, 0, 0, L.k, L.ox, L.oy);
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  if (valid) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const lightness = r * 0.2126 + g * 0.7152 + b * 0.0722;
    // 1) move the photo's lightness toward the target (keeps shading order), 2) give it the target hue/saturation,
    // 3) pull toward the flat target colour by how far the target sits from the photo's own lightness.
    if (lightness < reference) {
      const channel = Math.round(Math.max(TINT.floor, lightness / reference) * 255);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${channel},${channel},${channel})`; ctx.fillRect(box.x0, box.y0, w, h);
    } else {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(TINT.screenMax, (lightness - reference) / (255 - reference) * TINT.screen); ctx.fillStyle = '#ffffff'; ctx.fillRect(box.x0, box.y0, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'color'; ctx.fillStyle = hex; ctx.fillRect(box.x0, box.y0, w, h);
    const pull = Math.min(TINT.pullMax, Math.abs(lightness - reference) / reference * TINT.pull);
    if (pull > 0.01) { ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = pull; ctx.fillStyle = hex; ctx.fillRect(box.x0, box.y0, w, h); ctx.globalAlpha = 1; }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0, PHOTO.w, PHOTO.h);
  ctx.restore();
}

// Weave patterns as woven accents relative to the tinted weave: a darker strand plus a lighter strand on light
// weaves, lighter strands on dark weaves. Drawn into the print layer, so they also pass through the fibre multiply.
function patternAccents(ctx, pw, ph, config) {
  const pattern = config.pattern;
  if (!pattern || pattern === 'twill') return;
  const hex = /^#[0-9a-f]{6}$/i.test(config.weave || '') ? config.weave : '#e9d9bd';
  const lum = parseInt(hex.slice(1, 3), 16) * .2126 + parseInt(hex.slice(3, 5), 16) * .7152 + parseInt(hex.slice(5, 7), 16) * .0722;
  const lightWeave = lum > 120;
  // Brand weave (KOKK for brands): the motif's strands are dyed. config.accent colours the motif and config.accent2
  // its second element (grid cross bands, the chevron's echo line, the diamond's centre). Each colour keeps its own
  // strands: two colours woven strand by strand blur into grey at this size. Without them the motif stays tone-on-tone.
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
  const dye = isHex(config.accent) ? config.accent : null, dye2 = dye && isHex(config.accent2) ? config.accent2 : null;
  let deep, lite, ground;
  const inks = d => {
    deep = d ? color(d, 0, .95) : lightWeave ? color(hex, lum > 190 ? -120 : -85, .7) : 'rgba(10,7,5,.55)';
    lite = d ? color(d, 26, .92) : lightWeave ? color(hex, 45, .75) : color(hex, 105, .72);
    ground = d ? color(d, 0, .86) : lightWeave ? color(hex, -18, .5) : color(hex, 40, .45);
  };
  inks(dye);
  const unit = pw / 334;                                      // stroke sizes follow the panel, not the size option
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  // one woven band along a path: dark body, light strand, little cross-ticks that read as over/under weaving
  const band = (trace, width) => {
    ctx.strokeStyle = deep; ctx.lineWidth = width; trace(); ctx.stroke();
    ctx.strokeStyle = lite; ctx.lineWidth = width * 0.38; trace(); ctx.stroke();
    ctx.setLineDash([1.6 * unit, 3.2 * unit]); ctx.strokeStyle = deep; ctx.lineWidth = width * 0.8; trace(); ctx.stroke(); ctx.setLineDash([]);
  };
  const line = (x0, y0, x1, y1) => () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); };
  const w = 11 * unit;
  // a woven area: fill a region with paired dark/light strands at an angle, so the motif reads as a change in
  // weave direction (like herringbone) rather than a drawn outline; a thin dark edge seats it into the base weave
  const strands = (region, angle, clip2) => {
    const step = 4.4 * unit, R = Math.hypot(pw, ph);
    ctx.save(); region(); ctx.clip('evenodd');
    if (clip2) { ctx.beginPath(); clip2(); ctx.clip(); }
    ctx.translate(pw / 2, ph / 2); ctx.rotate(angle);
    ctx.fillStyle = ground; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    for (let t = -R; t < R; t += step) {
      ctx.strokeStyle = deep; ctx.lineWidth = step * .42; ctx.beginPath(); ctx.moveTo(-R, t); ctx.lineTo(R, t); ctx.stroke();
      ctx.strokeStyle = lite; ctx.lineWidth = step * .3; ctx.beginPath(); ctx.moveTo(-R, t + step * .5); ctx.lineTo(R, t + step * .5); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); region(); ctx.strokeStyle = deep; ctx.lineWidth = 1.8 * unit; ctx.stroke(); ctx.restore();
  };
  const diamondPath = (s) => { ctx.moveTo(pw * .5, ph * (.55 - .29 * s)); ctx.lineTo(pw * (.5 + .36 * s), ph * .55); ctx.lineTo(pw * .5, ph * (.55 + .29 * s)); ctx.lineTo(pw * (.5 - .36 * s), ph * .55); ctx.closePath(); };
  if (pattern === 'grid') {
    for (const x of [pw / 3, pw * 2 / 3]) band(line(x, 0, x, ph), w);
    if (dye2) inks(dye2);
    for (const y of [ph * .25, ph * .5, ph * .75]) band(line(0, y, pw, y), w);
  } else if (pattern === 'minimal') {
    // one wide chevron band; each arm's strands lean the opposite way, meeting at the point like a herringbone
    const T = ph * .085;
    const arm = (xa, xb) => () => { ctx.beginPath(); ctx.moveTo(pw * xa, ph * .36); ctx.lineTo(pw * xb, ph * .58); ctx.lineTo(pw * xb, ph * .58 + T); ctx.lineTo(pw * xa, ph * .36 + T); ctx.closePath(); };
    strands(arm(.12, .5), Math.PI / 4);
    strands(arm(.88, .5), -Math.PI / 4);
    if (dye2) {                                               // echo line under the chevron, in the second colour
      inks(dye2); const e = T + ph * .034;
      band(() => { ctx.beginPath(); ctx.moveTo(pw * .12, ph * .36 + e); ctx.lineTo(pw * .5, ph * .58 + e); ctx.lineTo(pw * .88, ph * .36 + e); }, 6.5 * unit);
    }
  } else if (pattern === 'diamond') {
    // a woven diamond ring (outer minus inner), left and right halves leaning opposite ways, plus a small woven centre
    const ring = () => { ctx.beginPath(); diamondPath(1); diamondPath(.66); };
    strands(ring, Math.PI / 4, () => ctx.rect(0, 0, pw / 2, ph));
    strands(ring, -Math.PI / 4, () => ctx.rect(pw / 2, 0, pw / 2, ph));
    if (dye2) inks(dye2);
    strands(() => { ctx.beginPath(); diamondPath(.22); }, 0);
  } else if (pattern === 'herringbone') {
    // columns of diagonal strands, alternating direction: zig-zag bands across the whole panel
    const cols = 6, cw = pw / cols, step = 15 * unit;
    for (let c = 0; c < cols; c++) {
      ctx.save(); ctx.beginPath(); ctx.rect(c * cw, 0, cw, ph); ctx.clip();
      const dir = c % 2 ? -1 : 1;
      for (let y = -cw; y < ph + cw; y += step) {
        const y0 = y, y1 = y + dir * cw * 0.9;
        ctx.strokeStyle = deep; ctx.lineWidth = 4.2 * unit; ctx.beginPath(); ctx.moveTo(c * cw, y0); ctx.lineTo(c * cw + cw, y1); ctx.stroke();
        ctx.strokeStyle = lite; ctx.lineWidth = 2.6 * unit; ctx.beginPath(); ctx.moveTo(c * cw, y0 + 4.6 * unit); ctx.lineTo(c * cw + cw, y1 + 4.6 * unit); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = deep; ctx.lineWidth = 2 * unit; ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, ph); ctx.stroke();
    }
  }
  ctx.restore();
}

// Artwork placement (same sizing as drawPanel) plus artX/artY and a single-colour ink option.
function drawArtwork(ctx, pw, ph, config, artwork, inkCanvas) {
  const maxWidth = pw * Math.max(0.15, Math.min(1, Number(config.artScale) / 100));
  const scale = Math.min(maxWidth / artwork.width, ph * 0.64 / artwork.height);
  const aw = artwork.width * scale, ah = artwork.height * scale;
  const ax = Number(config.artX), ay = Number(config.artY);
  const customX = config.artX != null && config.artX !== '' && Number.isFinite(ax);
  const customY = config.artY != null && config.artY !== '' && Number.isFinite(ay);
  const center = config.artPosition === 'upper' ? 0.32 : config.artPosition === 'lower' ? 0.72 : 0.54;
  let left = customX ? pw * Math.max(0, Math.min(100, ax)) / 100 - aw / 2 : (pw - aw) / 2;
  let top = customY ? ph * Math.max(0, Math.min(100, ay)) / 100 - ah / 2 : Math.max(5, Math.min(ph - ah - 5, ph * center - ah / 2));
  // a moved picture never runs off the panel (14 Nov: a big picture sent to a corner was cut by the frame)
  const mx = pw * 0.04, my = ph * 0.03;
  if (customX && aw < pw - 2 * mx) left = Math.max(mx, Math.min(pw - aw - mx, left));
  if (customY && ah < ph - 2 * my) top = Math.max(my, Math.min(ph - ah - my, top));
  let source = artwork;
  if (/^#[0-9a-f]{6}$/i.test(config.artInk || '')) {
    // silhouette from the artwork's alpha, rendered at the size it will be drawn
    const t = ctx.getTransform();
    const w = Math.max(1, Math.ceil(aw * Math.hypot(t.a, t.b))), h = Math.max(1, Math.ceil(ah * Math.hypot(t.c, t.d)));
    const ink = fit(inkCanvas, w, h);
    ink.drawImage(artwork, 0, 0, w, h);
    ink.globalCompositeOperation = 'source-in'; ink.fillStyle = config.artInk; ink.fillRect(0, 0, w, h);
    ink.globalCompositeOperation = 'source-over';
    source = inkCanvas;
  }
  if (HEX6.test(config.patch || '')) {
    // KOKK for brands: a logo that would not show on the sedge (white, silver) gets a contour in a brand colour that follows its
    // own shape, like a die-cut sticker (17 Nov, user: "why is there a blue frame round the logo": it was a rectangular label)
    const t = ctx.getTransform(), k = Math.max(0.5, Math.hypot(t.a, t.b)), pad = Math.max(2.4, Math.sqrt(aw * ah) * 0.055);
    const s = sticker(artwork, Math.max(1, Math.round(aw * k)), Math.max(1, Math.round(ah * k)), pad * k, config.patch);
    ctx.drawImage(s.canvas, left - s.o / k, top - s.o / k, s.canvas.width / k, s.canvas.height / k);
  }
  ctx.globalAlpha = 0.94;
  ctx.drawImage(source, left, top, aw, ah);
  ctx.globalAlpha = 1;
  return { x: left, y: top, w: aw, h: ah };
}

const HEX6 = /^#[0-9a-f]{6}$/i;
// Sticker contour for a logo, at drawing size (w x h device pixels): the logo's solid pixels (more than 40% opaque, so a faint glow
// does not swell it) widened by `pad` in 32 directions, in the brand colour with a slightly darker rim. Inner holes wider than the
// contour stay open, so the sedge still shows inside a ring. Returns { canvas, o } where o is the margin on each side. Cached per
// logo, size and colour (the cards redraw it on every tap).
const stickerCache = new WeakMap();
export function sticker(artwork, w, h, pad, hex) {
  const key = [w, h, pad.toFixed(2), hex].join('|'), hit = stickerCache.get(artwork);
  if (hit && hit.key === key) return hit;
  const o = Math.ceil(pad) + 3, W = w + 2 * o, H = h + 2 * o;
  const solid = document.createElement('canvas'); solid.width = w; solid.height = h;
  const sx = solid.getContext('2d', { willReadFrequently: true }); sx.drawImage(artwork, 0, 0, w, h);
  const img = sx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = d[i + 3] > 102 ? 255 : 0; }
  sx.putImageData(img, 0, 0);
  const grow = (r, fill) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    for (let n = 0; n < 32; n++) { const a = n / 32 * Math.PI * 2; for (const f of [1, 0.66, 0.33]) x.drawImage(solid, o + Math.cos(a) * r * f, o + Math.sin(a) * r * f); }
    x.drawImage(solid, o, o);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = fill; x.fillRect(0, 0, W, H);
    return c;
  };
  const canvas = grow(pad + 0.9, color(hex, -28)), inner = grow(pad, hex);
  canvas.getContext('2d').drawImage(inner, 0, 0);
  solid.width = solid.height = inner.width = inner.height = 0;
  const out = { key, canvas, o };
  stickerCache.set(artwork, out);
  return out;
}
// The KOKK name plate's own outline in the photo (traced at 7x): kept in its metal when config.plate is set.
const PLATE = [[448, 199], [586.5, 197.6], [586, 206], [584.6, 225], [583.2, 234.5], [580, 239.4], [575, 241.6], [520, 242.4], [470, 243], [456.5, 242.8], [451.2, 240], [448.6, 235], [447.6, 226]];
// Piping: a cord of constant width that follows the panel's whole outline (corner caps and name plate included).
// Built from the panel mask at output size: mask minus the mask shrunk by the cord's width. Cached per size and colour.
function pipingRing(S, L, mask, hex, width, height) {
  const key = [width, height, L.k.toFixed(5), L.ox.toFixed(2), L.oy.toFixed(2), hex].join('|');
  if (S.trimKey === key) return S.trim;
  const d = Math.max(2, 6.5 * L.k), edge = Math.max(0.8, 1.3 * L.k);
  const a = fit(S.a, width, height);
  a.setTransform(L.k, 0, 0, L.k, L.ox, L.oy); a.drawImage(mask, 0, 0, PHOTO.w, PHOTO.h); reset(a);
  const shrink = by => {                                    // S.c = the mask shrunk by `by` pixels
    const c = fit(S.c, width, height); c.drawImage(S.a, 0, 0); c.globalCompositeOperation = 'destination-in';
    for (let i = 0; i < 12; i++) c.drawImage(S.a, Math.cos(i * Math.PI / 6) * by, Math.sin(i * Math.PI / 6) * by);
    reset(c);
  };
  const t = fit(S.trim, width, height);
  shrink(d + edge);                                         // a thin dark line inside the cord seats it into the weave
  t.drawImage(S.a, 0, 0); t.globalCompositeOperation = 'destination-out'; t.drawImage(S.c, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = color(hex, -70, .8); t.fillRect(0, 0, width, height); reset(t);
  shrink(d);
  a.globalCompositeOperation = 'destination-out'; a.drawImage(S.c, 0, 0);
  a.globalCompositeOperation = 'source-in'; a.fillStyle = hex; a.fillRect(0, 0, width, height); reset(a);
  t.drawImage(S.a, 0, 0);
  S.trimKey = key;
  return S.trim;
}

function drawDimension(ctx, L, config, width) {
  const label = SIZE_CM[config.size] || SIZE_CM.cabin;
  const x = L.ox + DIMENSION.x * L.k, yTop = L.oy + DIMENSION.y1 * L.k, yBottom = L.oy + DIMENSION.y0 * L.k;
  const hair = Math.max(0.75, width / 1000);
  const tick = Math.max(5, 9 * L.k);
  const font = Math.max(9, Math.round(width * 0.0175));
  ctx.save();
  ctx.strokeStyle = 'rgba(53,39,31,.55)'; ctx.fillStyle = 'rgba(53,39,31,.62)';
  ctx.lineWidth = hair; ctx.lineCap = 'butt';
  ctx.font = `500 ${font}px "DM Sans", "Helvetica Neue", Arial, sans-serif`;
  const textWidth = ctx.measureText(label).width + font * 0.5;   // letter-spaced below, so leave air
  const mid = (yTop + yBottom) / 2, gap = textWidth / 2 + font * 0.6;
  const px = Math.round(x) + (hair % 2 ? 0.5 : 0);
  ctx.beginPath();
  ctx.moveTo(px, yTop); ctx.lineTo(px, mid - gap);
  ctx.moveTo(px, mid + gap); ctx.lineTo(px, yBottom);
  ctx.moveTo(px - tick / 2, yTop); ctx.lineTo(px + tick / 2, yTop);
  ctx.moveTo(px - tick / 2, yBottom); ctx.lineTo(px + tick / 2, yBottom);
  ctx.stroke();
  ctx.translate(px, mid); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(font * 0.12).toFixed(1)}px`;
  ctx.fillText(label.toUpperCase(), 0, 0);
  ctx.restore();
}

/** A static product photograph, recoloured through masks and personalised with Canvas 2D only. */
// Fields that only move or resize the name or the picture (see the dirty-rectangle path in renderLuggage).
const MOVABLE = new Set(['nameX', 'nameY', 'nameSize', 'artX', 'artY', 'artScale', 'artwork']);
const lastRender = new WeakMap();
export function invalidate(canvas) { lastRender.delete(canvas); }
export async function renderLuggage(canvas, input = {}, options = {}) {
  const ticket = (renderVersions.get(canvas) || 0) + 1; renderVersions.set(canvas, ticket);
  const config = { size: 'cabin', shell: '#c5a16a', weave: '#e9d9bd', pattern: 'twill', name: '', nameColor: '#35271f', font: 'sans', flag: 'none', flagPosition: 'top', artwork: null, artScale: 65, artPosition: 'center', finish: 'matte', artInk: null, artX: null, artY: null, accent: null, accent2: null, trim: null, patch: null, plate: false, wheel: null, artCut: false, ...input };
  const [assets, loaded] = await Promise.all([loadAssets(), loadArtwork(config.artwork)]);
  const artwork = config.artCut === true ? dieCut(loaded) : loaded;
  if (renderVersions.get(canvas) !== ticket) return;
  if (!assets) { await renderIllustratedLuggage(canvas, config, options); return; }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  // ---- everything below is synchronous: shared scratch canvases cannot interleave ----
  const width = canvas.width, height = canvas.height;
  const L = layout(width, height, config, options);
  const S = scratch(width, height);
  // 1–3b) the bag itself (photo, shell, sedge, wheels, plate) depends only on these choices: built once and reused, so dragging
  // a name or a picture repaints only the print layer (19 Nov, user: drag must be smooth, 60 fps)
  const baseKey = [width, height, L.k.toFixed(5), L.ox.toFixed(2), L.oy.toFixed(2), config.shell, config.weave, config.wheel, config.plate, !!options.export].join('|');
  if (S.baseKey !== baseKey) {
    const g = fit(S.base, width, height);
    g.fillStyle = '#ead6b8'; g.fillRect(0, 0, width, height);

    // 1) photo, uniform scale
    placePhoto(g, L, assets.photo);

    // 1b) crevices, latch pockets and swivel housings take the shell's hue/saturation only (no lightness change)
    const nativeShell = String(config.shell).toLowerCase() === NATIVE_SHELL;   // the photo already IS champagne: leave it untouched
    if (assets.hue && !nativeShell && /^#[0-9a-f]{6}$/i.test(config.shell || '')) {
      const a = fit(S.a, width, height);
      placePhoto(a, L, assets.photo);
      a.save(); a.setTransform(L.k, 0, 0, L.k, L.ox, L.oy);
      a.globalCompositeOperation = 'color'; a.fillStyle = config.shell; a.fillRect(SHELL_BOX.x0, SHELL_BOX.y0, SHELL_BOX.x1 - SHELL_BOX.x0, SHELL_BOX.y1 - SHELL_BOX.y0);
      a.globalCompositeOperation = 'destination-in'; a.drawImage(assets.hue, 0, 0, PHOTO.w, PHOTO.h);
      a.restore();
      g.drawImage(S.a, 0, 0);
    }

    // 2) shell metal  3) woven panel + handle wrap
    for (const [hex, reference, mask, box] of [[config.shell, 170, assets.shell, SHELL_BOX], [config.weave, 218, assets.weave, WEAVE_BOX]]) {
      if (nativeShell && mask === assets.shell) continue;
      const a = fit(S.a, width, height);
      placePhoto(a, L, assets.photo);
      tintLayer(a, L, hex, reference, mask, box);
      g.drawImage(S.a, 0, 0);
    }
    // 3b) wheel hub discs in their own colour (null = they follow the shell, as above)
    if (assets.wheel && HEX6.test(config.wheel || '')) {
      const a = fit(S.a, width, height);
      placePhoto(a, L, assets.photo);
      if (String(config.wheel).toLowerCase() === NATIVE_SHELL) {      // champagne hubs = the photo's own metal, untouched
        a.save(); a.setTransform(L.k, 0, 0, L.k, L.ox, L.oy); a.globalCompositeOperation = 'destination-in'; a.drawImage(assets.wheel, 0, 0, PHOTO.w, PHOTO.h); a.restore();
      } else tintLayer(a, L, config.wheel, 170, assets.wheel, WHEEL_BOX);
      g.drawImage(S.a, 0, 0);
    }
    if (config.plate && !nativeShell) {                       // the KOKK name plate stays in its own metal on a coloured frame
      g.save(); g.beginPath(); g.rect(L.clip.x, L.clip.y, L.clip.w, L.clip.h); g.clip();
      g.setTransform(L.k, 0, 0, L.k, L.ox, L.oy);
      g.beginPath(); PLATE.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
      g.drawImage(assets.photo, 0, 0, PHOTO.w, PHOTO.h); g.restore();
    }
    reset(g);
    S.baseKey = baseKey;
  }
  const piping = HEX6.test(config.trim || '') ? pipingRing(S, L, assets.panel, config.trim, width, height) : null;   // uses S.a and S.c: build it before they are needed below

  // 4) print layer: drawn flat in panel units, then mapped onto the panel in perspective
  const size = sizes[config.size] || sizes.cabin;
  const pw = size.width - 46, ph = size.height - 48;
  const dW = (PANEL.xR - PANEL.xL) * L.k, dH = Math.max(PANEL.hL, PANEL.hR) * L.k;
  const Pw = Math.max(8, Math.ceil(dW)), Ph = Math.max(8, Math.ceil(dH));
  const pbaseKey = [Pw, Ph, pw, ph, config.pattern, config.weave, config.accent, config.accent2, config.finish].join('|');
  if (S.pbaseKey !== pbaseKey) {
    const q = fit(S.pbase, Pw, Ph);
    q.scale(Pw / pw, Ph / ph);
    patternAccents(q, pw, ph, config);
    if (config.finish === 'satin') {
      const sheen = q.createLinearGradient(0, ph, pw, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.6, 'rgba(255,255,255,.18)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
      q.fillStyle = sheen; q.fillRect(0, 0, pw, ph);
    }
    reset(q);
    S.pbaseKey = pbaseKey;
  }
  const p = fit(S.print, Pw, Ph);
  p.drawImage(S.pbase, 0, 0);
  p.scale(Pw / pw, Ph / ph);
  const artBox = artwork ? drawArtwork(p, pw, ph, config, artwork, S.ink) : null;
  const nameBox = drawPanel(p, 0, 0, pw, ph, config, null, false);
  reset(p);

  // 5) map the flat print onto the panel. When only a name's or a picture's place or size changed since this canvas was last
  // drawn (a drag), only the rectangle they covered before and cover now is redrawn: the rest of the canvas is already right.
  const X0 = L.ox + PANEL.xL * L.k, X1 = L.ox + PANEL.xR * L.k, span = X1 - X0;
  const sOf = t => t * PANEL.hR / (PANEL.hL + t * (PANEL.hR - PANEL.hL));
  const toCanvas = (u, v) => {
    const s = Math.max(0, Math.min(1, u / pw)), t = s * PANEL.hL / (PANEL.hR - s * (PANEL.hR - PANEL.hL));
    const xc = PANEL.xL + t * (PANEL.xR - PANEL.xL), yT = L.oy + PANEL.top(xc) * L.k, yB = L.oy + PANEL.bottom(xc) * L.k;
    return [X0 + t * span, yT + v / ph * (yB - yT)];
  };
  const rectOf = box => {
    if (!box) return null;
    const m = 6 + 0.08 * Math.max(box.w, box.h), pts = [[box.x - m, box.y - m], [box.x + box.w + m, box.y - m], [box.x - m, box.y + box.h + m], [box.x + box.w + m, box.y + box.h + m]].map(([u, v]) => toCanvas(u, v));
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    return { x0: Math.min(...xs) - 3, y0: Math.min(...ys) - 3, x1: Math.max(...xs) + 3, y1: Math.max(...ys) + 3 };
  };
  const nameRect = rectOf(nameBox), artRect = rectOf(artBox);
  const R = (() => { const bx = PANEL.box, x = Math.max(0, Math.floor(L.ox + bx.x0 * L.k) - 4), y = Math.max(0, Math.floor(L.oy + bx.y0 * L.k) - 4);
    return { x, y, w: Math.min(width, Math.ceil(L.ox + bx.x1 * L.k) + 4) - x, h: Math.min(height, Math.ceil(L.oy + bx.y1 * L.k) + 4) - y }; })();
  const sig = [width, height, L.k.toFixed(5), L.ox.toFixed(2), L.oy.toFixed(2), !!options.export, !!options.dimension, JSON.stringify(Object.entries(config).filter(([key]) => !MOVABLE.has(key)))].join('|');
  const prev = lastRender.get(canvas);
  let D = R, fast = false;
  if (!options.export && !options.dimension && prev && prev.sig === sig && prev.art === artwork && prev.base === S.baseKey) {
    const parts = [prev.nameRect, prev.artRect, nameRect, artRect].filter(Boolean);
    if (parts.length) {
      const x0 = Math.max(R.x, Math.floor(Math.min(...parts.map(r => r.x0)))), y0 = Math.max(R.y, Math.floor(Math.min(...parts.map(r => r.y0))));
      const x1 = Math.min(R.x + R.w, Math.ceil(Math.max(...parts.map(r => r.x1)))), y1 = Math.min(R.y + R.h, Math.ceil(Math.max(...parts.map(r => r.y1))));
      D = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }; fast = true;
    } else D = { x: R.x, y: R.y, w: 1, h: 1 };
  }
  lastRender.set(canvas, { sig, art: artwork, base: S.baseKey, nameRect, artRect });
  const region = (g, src) => g.drawImage(src, D.x, D.y, D.w, D.h, D.x, D.y, D.w, D.h);
  reset(ctx);
  if (!fast) { ctx.clearRect(0, 0, width, height); ctx.drawImage(S.base, 0, 0); }

  const b = S.b.getContext('2d'); reset(b);
  b.save(); b.beginPath(); b.rect(D.x, D.y, D.w, D.h); b.clip(); b.clearRect(D.x, D.y, D.w, D.h);
  const STRIP = 2.5, first = Math.max(0, Math.floor((D.x - X0) / STRIP) * STRIP - STRIP), last = Math.min(span, D.x + D.w - X0 + STRIP);
  for (let dx = first; dx < last; dx += STRIP) {
    const t0 = dx / span, t1 = Math.min(1, (dx + STRIP) / span);
    const s0 = sOf(t0) * Pw, s1 = sOf(t1) * Pw;
    const xc = PANEL.xL + ((t0 + t1) / 2) * (PANEL.xR - PANEL.xL);      // photo x at the strip centre
    const yT = L.oy + PANEL.top(xc) * L.k, yB = L.oy + PANEL.bottom(xc) * L.k;
    let destW = (t1 - t0) * span, srcW = Math.max(0.01, s1 - s0);
    if (t1 < 1) { srcW *= (destW + 1) / destW; destW += 1; }            // 1px overlap hides seams
    b.drawImage(S.print, s0, 0, Math.min(Pw - s0, srcW), Ph, X0 + dx, yT, destW, yB - yT);
  }
  b.globalCompositeOperation = 'destination-in';
  b.setTransform(L.k, 0, 0, L.k, L.ox, L.oy); b.drawImage(assets.panel, 0, 0, PHOTO.w, PHOTO.h); b.setTransform(1, 0, 0, 1, 0, 0);
  if (piping) { b.globalCompositeOperation = 'source-over'; b.drawImage(piping, 0, 0); }
  if (options.export) { b.globalCompositeOperation = 'destination-in'; b.fillStyle = '#000'; b.fillRect(L.clip.x, L.clip.y, L.clip.w, L.clip.h); }
  b.restore(); reset(b);

  // printed on sedge: multiply a normalised fibre texture from the photo, keep the print's own alpha
  const fibreKey = [width, height, L.k.toFixed(5), L.ox.toFixed(2), L.oy.toFixed(2)].join('|');
  if (S.fibreKey !== fibreKey) {
    const f = fit(S.fibre, width, height);
    f.fillStyle = '#fff'; f.fillRect(0, 0, width, height);
    f.globalCompositeOperation = 'luminosity'; placePhoto(f, L, assets.photo);
    f.globalCompositeOperation = 'color-dodge'; f.fillStyle = 'rgb(58,58,58)'; f.fillRect(0, 0, width, height);
    reset(f);
    S.fibreKey = fibreKey;
  }
  const c = S.c.getContext('2d'); reset(c); c.clearRect(D.x, D.y, D.w, D.h);
  region(c, S.b);
  b.globalCompositeOperation = 'multiply'; region(b, S.fibre);
  b.globalCompositeOperation = 'destination-in'; region(b, S.c);
  reset(b);
  if (fast) { ctx.clearRect(D.x, D.y, D.w, D.h); region(ctx, S.base); }
  ctx.globalAlpha = 0.92; region(ctx, S.b); ctx.globalAlpha = 1;

  // export: soften the photo's sides into the paper so the fitted photo reads as a print, not a band
  if (options.export) {
    const r = L.rect, paper = [234, 214, 184];
    const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(${paper},1)`); g.addColorStop(1, `rgba(${paper},0)`);
      ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh);
    };
    const fx = r.w * 0.05, fy = r.h * 0.022;
    fade(r.x, 0, r.x + fx, 0, r.x - 1, r.y, fx + 1, r.h);
    fade(r.x + r.w, 0, r.x + r.w - fx, 0, r.x + r.w - fx, r.y, fx + 1, r.h);
    fade(0, r.y, 0, r.y + fy, r.x, r.y - 1, r.w, fy + 1);
    fade(0, r.y + r.h, 0, r.y + r.h - fy, r.x, r.y + r.h - fy, r.w, fy + 1);
    const t = typeof options.export === 'object' ? options.export : {};
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#35271f';
    ctx.font = `500 ${width * .048}px Georgia,serif`; ctx.fillText(t.title ?? 'K O K K', width / 2, height * .057);
    ctx.font = `${width * .012}px Arial,sans-serif`; ctx.fillText(t.subtitle ?? 'THE PERSONAL ATELIER · SEDGE HANDLE EDITION', width / 2, height * .09);
    ctx.font = `${width * .014}px Arial,sans-serif`; ctx.fillText(size.label, width / 2, height * .95);
    ctx.font = `italic ${width * .022}px Georgia,serif`; ctx.fillText(t.footer ?? 'Designed by you.', width / 2, height * .98);
  } else if (options.dimension) {
    drawDimension(ctx, L, config, width);
  }
  reset(ctx);  const yTop = L.oy + Math.min(PANEL.top(PANEL.xL), PANEL.top(PANEL.xR)) * L.k, yBot = L.oy + Math.max(PANEL.bottom(PANEL.xL), PANEL.bottom(PANEL.xR)) * L.k;
  geometries.set(canvas, { width, height, k: L.k, ox: L.ox, oy: L.oy, X0, span, pw, ph, name: nameBox, art: artBox, bounds: { x: X0, y: yTop, w: span, h: yBot - yTop } });
}

// Where things sit on a rendered canvas, for direct manipulation: the panel's print space (pw x ph units, the same space
// nameX/nameY and artX/artY are percentages of) mapped to canvas pixels through the panel's perspective, and back.
const geometries = new WeakMap();
export function geometry(canvas) {
  const G = geometries.get(canvas);
  if (!G || G.width !== canvas.width || G.height !== canvas.height) return null;
  const toCanvas = (u, v) => {
    const s = Math.max(0, Math.min(1, u / G.pw)), t = s * PANEL.hL / (PANEL.hR - s * (PANEL.hR - PANEL.hL));
    const xc = PANEL.xL + t * (PANEL.xR - PANEL.xL), yT = G.oy + PANEL.top(xc) * G.k, yB = G.oy + PANEL.bottom(xc) * G.k;
    return [G.X0 + t * G.span, yT + v / G.ph * (yB - yT)];
  };
  const toPanel = (x, y) => {
    const t = (x - G.X0) / G.span, s = t * PANEL.hR / (PANEL.hL + t * (PANEL.hR - PANEL.hL));
    const xc = PANEL.xL + t * (PANEL.xR - PANEL.xL), yT = G.oy + PANEL.top(xc) * G.k, yB = G.oy + PANEL.bottom(xc) * G.k;
    return [s * G.pw, (y - yT) / (yB - yT) * G.ph];
  };
  return { ...G, toCanvas, toPanel };
}

export { sizes, renderIllustratedLuggage };
