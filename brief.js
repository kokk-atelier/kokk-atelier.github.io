// KOKK design brief as a one-page A4 PDF (14 Nov, user: the download should be one PDF with the picture and the order
// details, designed to look calm and uncluttered). The page is drawn on a canvas with the site's own fonts, so Thai
// text is shaped by the browser, then the page is wrapped as a JPEG in a minimal PDF written here. No library, no network.
const W = 1654, H = 2339, M = 120;                     // A4 at 200 dpi
const INK = '#35271f', MUTED = '#8a7f74', LINE = 'rgba(53,39,31,.16)', PAPER = '#f7f1e7', PANEL = '#ede4d6';
const SANS = "'DM Sans','Noto Sans Thai',sans-serif", SERIF = "'Playfair Display',Georgia,serif";

function text(ctx, s, x, y, { size = 24, weight = 400, font = SANS, color = INK, align = 'left', spacing = 0, max } = {}) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  let str = String(s);
  if (max) while (str.length > 1 && ctx.measureText(str).width > max) str = str.slice(0, -2) + '…';
  ctx.fillText(str, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return ctx.measureText(str).width;
}
const rule = (ctx, x0, x1, y, color = LINE, width = 2) => { ctx.fillStyle = color; ctx.fillRect(x0, y, x1 - x0, width); };
function chip(ctx, x, y, color) {
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(53,39,31,.22)'; ctx.stroke();
}

async function fontsReady() {
  if (!document.fonts) return;
  const want = [`400 60px 'Playfair Display'`, `400 24px 'DM Sans'`, `500 24px 'DM Sans'`, `400 24px 'Noto Sans Thai'`, `500 24px 'Noto Sans Thai'`];
  await Promise.race([Promise.all(want.map(f => document.fonts.load(f, 'Aa ก').catch(() => null))), new Promise(r => setTimeout(r, 1500))]);
}

/**
 * brief = { date, ref, model, dims, spec: [{ label, value, sub?, color? }], price: [{ label, detail?, amount, base? }],
 *           total, money(n), render(canvas) -> Promise, artwork: CanvasImageSource|null, artNote }
 * Returns the page canvas.
 */
export async function drawBrief(brief) {
  await fontsReady();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  // header
  text(ctx, 'KOKK', M, 188, { size: 66, font: SERIF, spacing: 14 });
  text(ctx, 'THE SEDGE ATELIER', M + 2, 230, { size: 16, spacing: 5, color: MUTED });
  text(ctx, 'DESIGN BRIEF', W - M, 150, { size: 16, spacing: 5, color: MUTED, align: 'right' });
  text(ctx, brief.date, W - M, 196, { size: 24, align: 'right' });
  text(ctx, brief.ref, W - M, 232, { size: 20, color: MUTED, align: 'right', spacing: 1 });
  rule(ctx, M, W - M, 290);

  // picture
  const ix = M, iy = 350, iw = 700, ih = 840;
  ctx.fillStyle = PANEL; ctx.fillRect(ix, iy, iw, ih);
  const pic = document.createElement('canvas'); pic.width = iw; pic.height = ih;
  await brief.render(pic);
  ctx.drawImage(pic, ix, iy, iw, ih); pic.width = pic.height = 0;

  // title + specification
  const rx = ix + iw + 96, rw = W - M - rx;
  text(ctx, 'YOUR PERSONAL EDITION', rx, 384, { size: 16, spacing: 5, color: MUTED });
  text(ctx, 'One of your own.', rx - 3, 470, { size: 62, font: SERIF, spacing: -1 });
  text(ctx, brief.model, rx, 556, { size: 40, weight: 500 });
  text(ctx, brief.dims, rx, 602, { size: 22, color: MUTED });
  text(ctx, 'รายละเอียดสำหรับสั่งทำ', rx, 690, { size: 18, color: MUTED });
  let y = 712;
  for (const row of brief.spec) {
    const h = row.sub ? 92 : 66;
    rule(ctx, rx, rx + rw, y);
    text(ctx, row.label, rx, y + 44, { size: 22, color: MUTED });
    const vw = text(ctx, row.value, rx + rw, y + 44, { size: 24, align: 'right', max: rw * .62 });
    if (row.color) chip(ctx, rx + rw - vw - 26, y + 36, row.color);
    if (row.sub) text(ctx, row.sub, rx + rw, y + 76, { size: 18, color: MUTED, align: 'right', max: rw * .8 });
    y += h;
  }
  rule(ctx, rx, rx + rw, y);

  // artwork file (left) and price (right)
  const top = brief.artwork ? Math.max(iy + ih, y) + 90 : y + 80;   // with an artwork file both blocks start level; without, the price follows the details
  if (brief.artwork) {
    text(ctx, 'ไฟล์ภาพสกรีน', ix, top + 18, { size: 18, color: MUTED });
    const bx = ix, by = top + 44, bw = 300, bh = 300;
    ctx.fillStyle = '#fbf8f2'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    const a = brief.artwork, aw = a.width || a.naturalWidth, ah = a.height || a.naturalHeight, k = Math.min((bw - 48) / aw, (bh - 48) / ah);
    ctx.drawImage(a, bx + (bw - aw * k) / 2, by + (bh - ah * k) / 2, aw * k, ah * k);
    if (brief.artNote) text(ctx, brief.artNote, bx, by + bh + 40, { size: 18, color: MUTED, max: iw });
  }
  text(ctx, 'แจกแจงราคา', rx, top + 18, { size: 18, color: MUTED });
  let py = top + 40;
  for (const line of brief.price) {
    rule(ctx, rx, rx + rw, py);
    const lw = text(ctx, line.label, rx, py + 44, { size: 22, weight: line.base ? 500 : 400 });
    if (line.detail) text(ctx, line.detail, rx + lw + 14, py + 44, { size: 19, color: MUTED, max: rw - lw - 170 });
    text(ctx, (line.base ? '' : '+') + brief.money(line.amount), rx + rw, py + 44, { size: 22, align: 'right' });
    py += 66;
  }
  rule(ctx, rx, rx + rw, py + 6, INK, 2);
  text(ctx, 'ราคารวมแนวคิด', rx, py + 74, { size: 24, weight: 500 });
  text(ctx, brief.money(brief.total), rx + rw, py + 78, { size: 44, weight: 500, align: 'right' });

  // footer
  rule(ctx, M, W - M, H - M - 70);
  text(ctx, 'ราคาแนวคิดสำหรับประเมินดีไซน์ · ยืนยันตัวอย่างวัสดุ ขนาด ราคา และเงื่อนไขก่อนสั่งผลิต', M, H - M - 18, { size: 18, color: MUTED });
  text(ctx, 'ภาพจำลอง สีและผิววัสดุจริงอาจแตกต่าง', W - M, H - M - 18, { size: 18, color: MUTED, align: 'right' });
  return c;
}

// One page, one full-page JPEG image. Offsets in the xref table are byte offsets, so every part is built as bytes.
export function jpegPdf(jpeg, pxW, pxH, title = 'KOKK Design Brief') {
  const pw = 595.28, ph = 841.89, enc = new TextEncoder(), parts = [], offsets = [];
  let length = 0;
  const add = p => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); length += b.length; };
  const obj = (n, body) => { offsets[n] = length; add(`${n} 0 obj\n`); for (const b of [].concat(body)) add(b); add('\nendobj\n'); };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\u0080-ÿ]/g, '_'));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
  const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  obj(6, `<< /Title (${title.replace(/[()\\]/g, '')}) /Producer (KOKK Atelier) >>`);
  const xref = length;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Draws the page and returns { pdf: Blob, page: Blob (JPEG) }. */
export async function briefPdf(brief) {
  const page = await drawBrief(brief);
  const jpeg = await new Promise((resolve, reject) => page.toBlob(b => b ? resolve(b) : reject(Error('brief')), 'image/jpeg', 0.9));
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const pdf = new Blob([jpegPdf(bytes, page.width, page.height)], { type: 'application/pdf' });
  page.width = page.height = 0;
  return { pdf, page: jpeg };
}
