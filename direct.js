// Direct manipulation on the design preview (19 Nov, user: "drag it easily, cooler UX/UI, 60 fps, very smooth").
// The name and the picture are picked, moved and resized right on the bag: mouse, pen and touch alike. A drag only
// changes nameX/nameY/nameSize or artX/artY/artScale, which the renderer redraws through its dirty-rectangle path, so
// every frame repaints just the area the object covered and covers now. The selection frame, handles and centre guides
// are drawn on a separate overlay canvas and never reach the exported image.

const NAME_SIZE = [12, 44], ART_SCALE = [15, 100];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function initDirect({ canvas, overlay, bar, hint, R, getConfig, apply, commit, artCentre, isActive, toast, onEdit }) {
  const ui = overlay.getContext('2d');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null;          // 'name' | 'art' | null
  let hover = null;             // { kind, mode } under the mouse
  let gesture = null;           // active drag / scale / pinch
  let guides = { x: false, y: false };
  let fade = 0, fadeTarget = 0, frame = 0, tipDone = readTip();
  const pointers = new Map();

  function readTip() { try { return localStorage.getItem('kokk-drag-tip') === '1'; } catch { return false; } }
  function doneTip() { if (tipDone) return; tipDone = true; try { localStorage.setItem('kokk-drag-tip', '1'); } catch { /* fine */ } syncHint(); }

  // ---- geometry: client px <-> canvas px <-> panel units -------------------------------------------------------------
  // The canvas may be letterboxed by object-fit: contain, so map through its drawn content box, not its element box.
  function content() {
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / canvas.width, r.height / canvas.height);
    const w = canvas.width * s, h = canvas.height * s;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, s };
  }
  const toCanvas = (cx, cy, c = content()) => [(cx - c.x) / c.s, (cy - c.y) / c.s];
  const has = kind => { const cfg = getConfig(); return kind === 'name' ? !!String(cfg.name || '').trim() : !!cfg.artwork; };
  function box(G, kind) { const b = kind === 'name' ? G.name : G.art; return b && has(kind) ? b : null; }
  // the four corners of an object's box (plus a margin), through the panel's perspective, in canvas px
  function quad(G, b, margin) { return [[b.x - margin, b.y - margin], [b.x + b.w + margin, b.y - margin], [b.x + b.w + margin, b.y + b.h + margin], [b.x - margin, b.y + b.h + margin]].map(([u, v]) => G.toCanvas(u, v)); }
  function unitsPerCss(G, c) { return G.pw / G.span / c.s; }

  function hitTest(clientX, clientY) {
    const G = R.geometry(canvas); if (!G) return null;
    const c = content(), [x, y] = toCanvas(clientX, clientY, c);
    // handles of the selected object come first
    const [u, v] = G.toPanel(x, y), k = unitsPerCss(G, c), minSide = (coarse ? 48 : 30) * k;
    if (selected && box(G, selected)) {
      // a press inside the object itself always moves it; handles win only around the frame (small names on phones)
      const b = box(G, selected), inside = u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h;
      const near = Math.min(...quad(G, b, marginUnits(G, c)).map(([hx, hy]) => Math.hypot(hx - x, hy - y))) * c.s;
      if (near < (inside ? 8 : coarse ? 24 : 14)) return { kind: selected, mode: 'scale' };
    }
    for (const kind of ['name', 'art']) {        // the name is printed on top of the picture
      const b = box(G, kind); if (!b) continue;
      const padX = Math.max(6 * k, (minSide - b.w) / 2), padY = Math.max(6 * k, (minSide - b.h) / 2);
      if (u >= b.x - padX && u <= b.x + b.w + padX && v >= b.y - padY && v <= b.y + b.h + padY) return { kind, mode: 'move' };
    }
    return null;
  }
  const marginUnits = (G, c) => (coarse ? 11 : 7) * unitsPerCss(G, c);

  // centre of an object as it is actually drawn, in % of the panel (the renderer keeps a name inside the panel)
  function drawnCentre(G, kind) {
    const b = box(G, kind); if (!b) return kind === 'name' ? [getConfig().nameX, getConfig().nameY] : artCentre();
    return [(b.x + b.w / 2) / G.pw * 100, (b.y + b.h / 2) / G.ph * 100];
  }

  // ---- gestures ------------------------------------------------------------------------------------------------------
  function begin(e, hit) {
    const G = R.geometry(canvas), c = content(), [x, y] = toCanvas(e.clientX, e.clientY, c), cfg = getConfig();
    select(hit.kind);
    const [u, v] = G.toPanel(x, y), centre = drawnCentre(G, hit.kind);
    const b = box(G, hit.kind), [bx, by] = G.toCanvas(b.x + b.w / 2, b.y + b.h / 2);
    gesture = {
      kind: hit.kind, mode: hit.mode, id: e.pointerId, u0: u, v0: v, centre, moved: false,
      size0: hit.kind === 'name' ? cfg.nameSize : cfg.artScale, cx: bx, cy: by, d0: Math.max(4, Math.hypot(x - bx, y - by)),
      snapX: 1.6 + 6 * unitsPerCss(G, c) / G.pw * 100, snapY: 1.2 + 6 * unitsPerCss(G, c) / G.ph * 100,
    };
    canvas.classList.add('is-dragging'); bar.classList.add('is-hidden');
  }
  function move(e) {
    const g = gesture, G = R.geometry(canvas); if (!g || !G) return;
    const c = content(), [x, y] = toCanvas(e.clientX, e.clientY, c);
    if (g.mode === 'pinch') return pinchMove();
    if (g.mode === 'scale') {
      const ratio = Math.hypot(x - g.cx, y - g.cy) / g.d0;
      setSize(g.kind, g.size0 * ratio);
    } else {
      const [u, v] = G.toPanel(x, y);
      let px = g.centre[0] + (u - g.u0) / G.pw * 100, py = g.centre[1] + (v - g.v0) / G.ph * 100;
      const sx = Math.abs(px - 50) < g.snapX, sy = Math.abs(py - 50) < g.snapY;
      if (sx) px = 50; if (sy) py = 50;
      if ((sx && !guides.x) || (sy && !guides.y)) buzz();
      guides = { x: sx, y: sy };
      setPos(g.kind, clamp(px, 0, 100), clamp(py, 0, 100));
    }
    g.moved = true;
  }
  function end() {
    if (!gesture) return;
    const moved = gesture.moved; gesture = null; guides = { x: false, y: false };
    canvas.classList.remove('is-dragging'); bar.classList.remove('is-hidden');
    if (moved) { commit(); doneTip(); }
    paintSoon();
  }
  function pinchStart() {
    const [a, b] = [...pointers.values()], G = R.geometry(canvas), cfg = getConfig();
    const kind = gesture?.kind || selected; if (!kind || !G) return;
    gesture = { kind, mode: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), m0: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      size0: kind === 'name' ? cfg.nameSize : cfg.artScale, centre: drawnCentre(G, kind), moved: false };
    canvas.classList.add('is-dragging'); bar.classList.add('is-hidden');
  }
  function pinchMove() {
    const g = gesture, [a, b] = [...pointers.values()], G = R.geometry(canvas); if (!a || !b || !G) return;
    const c = content();
    setSize(g.kind, g.size0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0);
    const [mx0, my0] = G.toPanel(...toCanvas(...g.m0, c)), [mx, my] = G.toPanel(...toCanvas((a.x + b.x) / 2, (a.y + b.y) / 2, c));
    setPos(g.kind, clamp(g.centre[0] + (mx - mx0) / G.pw * 100, 0, 100), clamp(g.centre[1] + (my - my0) / G.ph * 100, 0, 100));
    g.moved = true;
  }
  function setPos(kind, x, y) { apply(kind === 'name' ? { nameX: x, nameY: y } : { artX: x, artY: y }); }
  function setSize(kind, s) {
    apply(kind === 'name' ? { nameSize: Math.round(clamp(s, ...NAME_SIZE) * 10) / 10 } : { artScale: Math.round(clamp(s, ...ART_SCALE)) });
  }
  function buzz() { try { navigator.vibrate?.(6); } catch { /* not supported */ } }

  canvas.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && (gesture || selected) && e.pointerType === 'touch') { canvas.setPointerCapture(e.pointerId); pinchStart(); e.preventDefault(); return; }
    if (e.button !== 0 || gesture) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) { if (e.pointerType !== 'touch' && selected) { select(null); } return; }
    canvas.setPointerCapture(e.pointerId); e.preventDefault(); canvas.focus({ preventScroll: true });
    begin(e, hit); paintSoon();
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture) { if (gesture.mode === 'pinch' || e.pointerId === gesture.id) move(e); return; }
    if (e.pointerType === 'mouse') {
      const h = hitTest(e.clientX, e.clientY), key = h ? h.kind + h.mode : '';
      if (key !== (hover ? hover.kind + hover.mode : '')) { hover = h; canvas.style.cursor = !h ? '' : h.mode === 'scale' ? 'nwse-resize' : 'grab'; paintSoon(); }
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, e => {
    pointers.delete(e.pointerId);
    if (gesture?.mode === 'pinch') { if (pointers.size < 2) end(); return; }
    if (gesture && e.pointerId === gesture.id) end();
  });
  canvas.addEventListener('pointerleave', () => { if (hover && !gesture) { hover = null; canvas.style.cursor = ''; paintSoon(); } });
  // touch: a finger on the name or the picture holds the page still; anywhere else it scrolls as usual
  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (e.touches.length > 1 ? (gesture || selected) : hitTest(t.clientX, t.clientY)) e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => { if (gesture) e.preventDefault(); }, { passive: false });
  // trackpad pinch (ctrl + wheel) resizes the selected object
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey || !selected || !has(selected)) return;
    e.preventDefault(); const cfg = getConfig();
    setSize(selected, (selected === 'name' ? cfg.nameSize : cfg.artScale) * Math.exp(-e.deltaY * 0.01));
    clearTimeout(wheelTimer); wheelTimer = setTimeout(commit, 220);
  }, { passive: false });
  let wheelTimer = 0;
  canvas.addEventListener('keydown', e => {
    const kind = selected && has(selected) ? selected : has('name') ? 'name' : has('art') ? 'art' : null; if (!kind) return;
    const G = R.geometry(canvas); if (!G) return;
    const step = e.shiftKey ? 5 : 1, [x, y] = drawnCentre(G, kind), cfg = getConfig();
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); select(kind); setPos(kind, clamp(x + d[0], 0, 100), clamp(y + d[1], 0, 100)); commit(); }
    else if (e.key === '+' || e.key === '=' || e.key === '-') { e.preventDefault(); select(kind); setSize(kind, (kind === 'name' ? cfg.nameSize : cfg.artScale) * (e.key === '-' ? 0.92 : 1.08)); commit(); }
    else if (e.key === 'Escape') select(null);
  });

  // ---- toolbar on the selection ----------------------------------------------------------------------------------------
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !selected) return;
    const G = R.geometry(canvas), cfg = getConfig(), kind = selected;
    if (b.dataset.act === 'center') { const [, y] = G ? drawnCentre(G, kind) : [50, 50]; setPos(kind, 50, y); }
    if (b.dataset.act === 'smaller' || b.dataset.act === 'bigger') setSize(kind, (kind === 'name' ? cfg.nameSize : cfg.artScale) * (b.dataset.act === 'bigger' ? 1.12 : 0.89));
    if (b.dataset.act === 'remove') { apply(kind === 'name' ? { name: '' } : { artwork: null }); select(null); toast?.(kind === 'name' ? 'ลบชื่อแล้ว' : 'ลบภาพแล้ว'); }
    commit(); paintSoon();
  });

  // ---- drawing ----------------------------------------------------------------------------------------------------------
  function select(kind) { if (selected === kind) return; selected = kind; paintSoon(); }
  function paintSoon() { if (!frame) frame = requestAnimationFrame(paint); }
  function paint() {
    frame = 0;
    const host = overlay.parentElement.getBoundingClientRect(), dpr = Math.min(2.5, devicePixelRatio || 1);
    const W = Math.round(host.width * dpr), H = Math.round(host.height * dpr);
    if (overlay.width !== W || overlay.height !== H) { overlay.width = W; overlay.height = H; }
    ui.setTransform(1, 0, 0, 1, 0, 0); ui.clearRect(0, 0, W, H);
    const G = R.geometry(canvas), active = isActive() || !!gesture;
    const show = G && (gesture ? gesture.kind : (active && selected && has(selected)) ? selected : hover?.kind);
    fadeTarget = show ? 1 : 0;
    fade += (fadeTarget - fade) * (reduced.matches ? 1 : 0.35);
    if (Math.abs(fadeTarget - fade) < 0.02) fade = fadeTarget; else paintSoon();
    placeBar(null);
    if (!G || !show || !box(G, show)) { syncHint(); return; }
    const c = content(), off = [(c.x - host.left) * dpr, (c.y - host.top) * dpr], sc = c.s * dpr;
    const P = ([x, y]) => [off[0] + x * sc, off[1] + y * sc];
    ui.globalAlpha = fade;
    // centre guides while snapped
    if (gesture && (guides.x || guides.y)) {
      ui.save(); ui.strokeStyle = '#c69a57'; ui.lineWidth = 1.25 * dpr; ui.setLineDash([5 * dpr, 4 * dpr]);
      if (guides.x) { const a = P(G.toCanvas(G.pw / 2, 0)), b = P(G.toCanvas(G.pw / 2, G.ph)); ui.beginPath(); ui.moveTo(...a); ui.lineTo(...b); ui.stroke(); }
      if (guides.y) { const a = P(G.toCanvas(0, G.ph / 2)), b = P(G.toCanvas(G.pw, G.ph / 2)); ui.beginPath(); ui.moveTo(...a); ui.lineTo(...b); ui.stroke(); }
      ui.restore();
    }
    const q = quad(G, box(G, show), marginUnits(G, c)).map(P), firm = selected === show || !!gesture;
    ui.save(); ui.lineJoin = 'round';
    const path = () => { ui.beginPath(); q.forEach((p, i) => i ? ui.lineTo(...p) : ui.moveTo(...p)); ui.closePath(); };
    if (gesture) { path(); ui.fillStyle = 'rgba(255,250,240,.10)'; ui.fill(); }
    if (!firm) ui.setLineDash([4 * dpr, 4 * dpr]);
    path(); ui.strokeStyle = 'rgba(35,26,20,.35)'; ui.lineWidth = 3 * dpr; ui.stroke();
    path(); ui.strokeStyle = '#fffaf2'; ui.lineWidth = 1.25 * dpr; ui.stroke();
    ui.setLineDash([]);
    if (firm) for (const [x, y] of q) {
      const r = (coarse ? 5.5 : 4.5) * dpr;
      ui.beginPath(); ui.arc(x, y, r + 1.2 * dpr, 0, Math.PI * 2); ui.fillStyle = 'rgba(35,26,20,.28)'; ui.fill();
      ui.beginPath(); ui.arc(x, y, r, 0, Math.PI * 2); ui.fillStyle = '#fffaf2'; ui.fill();
      ui.lineWidth = 1.25 * dpr; ui.strokeStyle = '#35271f'; ui.stroke();
    }
    ui.restore();
    // live read-out while dragging
    if (gesture) {
      const cfg = getConfig(), [x, y] = drawnCentre(G, gesture.kind);
      const text = gesture.mode === 'move' ? (guides.x && guides.y ? 'กึ่งกลางพอดี' : guides.x ? 'กึ่งกลางแนวนอน' : guides.y ? 'กึ่งกลางแนวตั้ง' : `${Math.round(x)}% · ${Math.round(y)}%`)
        : `ขนาด ${Math.round(gesture.kind === 'name' ? cfg.nameSize / 21 * 100 : cfg.artScale)}%`;
      pill(text, (q[0][0] + q[1][0]) / 2, Math.min(q[0][1], q[1][1]) - 12 * dpr, dpr);
    } else if (firm && isActive()) placeBar(q.map(([x, y]) => [x / dpr, y / dpr]));
    ui.globalAlpha = 1;
    syncHint();
  }
  function pill(text, x, y, dpr) {
    ui.save(); ui.font = `500 ${11.5 * dpr}px "DM Sans","Noto Sans Thai",sans-serif`; ui.textAlign = 'center'; ui.textBaseline = 'middle';
    const w = ui.measureText(text).width + 18 * dpr, h = 24 * dpr, top = Math.max(4 * dpr, y - h);
    ui.beginPath(); ui.roundRect ? ui.roundRect(x - w / 2, top, w, h, h / 2) : ui.rect(x - w / 2, top, w, h);
    ui.fillStyle = 'rgba(35,27,22,.86)'; ui.fill(); ui.fillStyle = '#f7f1e7'; ui.fillText(text, x, top + h / 2 + 0.5 * dpr); ui.restore();
  }
  function placeBar(q) {
    if (!q) { bar.hidden = true; return; }
    const host = overlay.parentElement.getBoundingClientRect();
    bar.hidden = false;
    bar.querySelector('[data-label]').textContent = selected === 'name' ? 'ชื่อ' : 'ภาพ';
    const top = Math.min(...q.map(p => p[1])), bottom = Math.max(...q.map(p => p[1])), mid = q.reduce((t, p) => t + p[0], 0) / 4;
    const w = bar.offsetWidth, h = bar.offsetHeight, dock = host.width < 520;   // phones: docked under the bag, clear of the print
    bar.classList.toggle('is-docked', dock);
    const x = dock ? (host.width - w) / 2 : clamp(mid - w / 2, 6, host.width - w - 6);
    const y = dock ? host.height - h - 10 : top - h - 12 >= 4 ? top - h - 12 : Math.min(host.height - h - 4, bottom + 12);
    bar.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  function syncHint() {
    const show = !tipDone && isActive() && (has('name') || has('art')) && !gesture;
    hint.classList.toggle('show', show);
  }

  new ResizeObserver(paintSoon).observe(canvas);
  // double-click the name to type it
  canvas.addEventListener('dblclick', e => { const h = hitTest(e.clientX, e.clientY); if (h?.kind === 'name') onEdit?.('name'); });
  if (coarse) { const t = hint.lastChild; if (t && t.nodeType === 3) t.textContent = 'ลากชื่อหรือภาพได้เลย · ใช้สองนิ้วหรือจับมุมเพื่อย่อขยาย'; }
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-roledescription', 'พื้นที่ออกแบบ');
  canvas.setAttribute('aria-label', 'ภาพกระเป๋าตามตัวเลือกของคุณ · ลากชื่อหรือภาพเพื่อย้าย จับมุมเพื่อย่อขยาย · ปุ่มลูกศรเพื่อเลื่อน ปุ่ม + − เพื่อปรับขนาด');

  return {
    paint: paintSoon,
    select(kind) { select(kind && has(kind) ? kind : null); },
    get selected() { return selected; },
    get dragging() { return !!gesture; },
  };
}
