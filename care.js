import { saveFile } from './host.js?v=3';

const REQUEST_KEY = 'kokk-care-request-v1';

const parts = {
  panel: 'แผงกกสาน',
  wheels: 'ชุดล้อ',
  handle: 'หูจับและคันชัก',
  corners: 'มุมกันกระแทก',
  lining: 'ซับในและอุปกรณ์ภายใน'
};

const careStyles = `
#care-content{color:var(--ink,#35271F);font-family:inherit}
#care-content *{box-sizing:border-box}
#care-content .care-tabs{display:flex;gap:30px;border-bottom:1px solid #35271f26;margin:0 0 36px;overflow-x:auto}
#care-content .care-tab{appearance:none;border:0;border-radius:0;background:none;padding:13px 0 17px;color:inherit;font:inherit;white-space:nowrap;cursor:pointer;border-bottom:2px solid transparent;opacity:.6}
#care-content .care-tab[aria-selected=true]{opacity:1;border-color:var(--ink,#35271F)}
#care-content button:focus-visible,#care-content input:focus-visible,#care-content textarea:focus-visible,#care-content select:focus-visible,#care-content summary:focus-visible{outline:2px solid var(--gold,#C69A57);outline-offset:5px}
#care-content [hidden]{display:none!important}
#care-content .care-kicker{display:block;font-size:10px;letter-spacing:.18em;font-weight:600;text-transform:uppercase;color:#75634f;margin:0 0 12px}
#care-content .care-split{display:grid;grid-template-columns:1.05fr 1fr;gap:64px;align-items:start}
#care-content h3{font-family:inherit;font-size:clamp(22px,2.3vw,32px);font-weight:400;line-height:1.5;margin:0 0 18px}
#care-content p{font-size:14px;line-height:1.9;margin:0 0 18px;color:#6e5d4c}
#care-content .care-guides{display:grid;gap:22px}
#care-content .care-guide{display:grid;grid-template-columns:28px 1fr;gap:15px}
#care-content .care-num{font-size:11px;letter-spacing:.08em;color:#9e7946;padding-top:4px}
#care-content .care-guide h4{font-size:15px;line-height:1.7;margin:0 0 4px;font-weight:500}
#care-content .care-guide p{font-size:13px;margin:0}
#care-content .care-note{font-size:12px;line-height:1.8;border-top:1px solid #35271f26;padding-top:18px;margin-top:28px;color:#786a5b}
#care-content .care-parts{display:flex;flex-wrap:wrap;gap:8px;margin:23px 0}
#care-content .care-parts span{border:1px solid #35271f26;padding:8px 12px;font-size:11px;letter-spacing:.02em}
#care-content .care-form{display:grid;grid-template-columns:1fr 1fr;gap:19px}
#care-content .care-field{display:grid;gap:8px;font-size:12px;color:var(--ink,#35271F)}
#care-content .care-full{grid-column:1/-1}
#care-content input,#care-content select,#care-content textarea{width:100%;border:1px solid #35271f35;background:transparent;border-radius:0;padding:12px;color:var(--ink,#35271F);font:inherit;font-size:14px}
#care-content textarea{resize:vertical;min-height:118px}
#care-content .care-actions{display:flex;gap:10px;flex-wrap:wrap}
#care-content .care-button{appearance:none;background:var(--ink,#35271F);border:1px solid var(--ink,#35271F);color:var(--paper,#F7F1E7);padding:13px 19px;font:inherit;font-size:12px;cursor:pointer;line-height:1.6;transition:background .2s}
#care-content .care-button:hover{background:#514034}
#care-content .care-button.secondary{background:transparent;color:var(--ink,#35271F)}
#care-content .care-button.secondary:hover{background:#35271f0a}
#care-content .care-status{font-size:12px;margin:0;min-height:1.8em;color:#65704b}
#care-content .care-timeline{margin:0;padding:0;list-style:none}
#care-content .care-timeline li{position:relative;padding:0 0 28px 40px;border-left:1px solid #35271f30;margin-left:13px}
#care-content .care-timeline li:last-child{padding-bottom:0;border-color:transparent}
#care-content .care-step{position:absolute;left:-14px;top:0;width:28px;height:28px;display:grid;place-items:center;border:1px solid #a98c65;background:var(--paper,#F7F1E7);border-radius:50%;font-size:10px;color:#8e6e45}
#care-content .care-step-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:5px}
#care-content .care-step-title h4{margin:0;font-size:14px;font-weight:500}
#care-content .care-step-title span{font-size:11px;color:#8b765b;white-space:nowrap}
#care-content .care-timeline p{font-size:12px;margin:0;line-height:1.8}
#care-content .care-duration{font-size:42px;font-weight:300;letter-spacing:-.04em;margin:22px 0 0}
#care-content .care-duration span{font-size:13px;letter-spacing:0;margin-left:10px}
#care-content .care-faq{margin-top:45px;border-top:1px solid #35271f26}
#care-content .care-faq details{border-bottom:1px solid #35271f26}
#care-content .care-faq summary{padding:18px 2px;cursor:pointer;font-size:13px;line-height:1.8}
#care-content .care-faq details p{font-size:12px;max-width:720px;padding:0 2px 16px;margin:0}
@media(max-width:700px){#care-content input,#care-content select,#care-content textarea{font-size:16px;min-height:48px}#care-content .care-tabs{gap:22px;margin-bottom:28px}#care-content .care-tab{font-size:12px}#care-content .care-split{grid-template-columns:1fr;gap:28px}#care-content .care-form{grid-template-columns:1fr}#care-content .care-faq{margin-top:30px}#care-content h3{font-size:24px}}
`;

const careMarkup = `
  <div class="care-tabs" role="tablist" aria-label="บริการดูแล KOKK">
    <button class="care-tab" type="button" id="care-tab-guide" role="tab" aria-selected="true" aria-controls="care-panel-guide" data-care-tab="guide">การดูแล</button>
    <button class="care-tab" type="button" id="care-tab-request" role="tab" aria-selected="false" aria-controls="care-panel-request" tabindex="-1" data-care-tab="request">เตรียมคำขอซ่อม</button>
    <button class="care-tab" type="button" id="care-tab-journey" role="tab" aria-selected="false" aria-controls="care-panel-journey" tabindex="-1" data-care-tab="journey">เส้นทางงานคราฟท์</button>
  </div>
  <section id="care-panel-guide" role="tabpanel" aria-labelledby="care-tab-guide">
    <div class="care-split">
      <div>
        <span class="care-kicker">Made to be cared for</span>
        <h3>ดูแลเส้นใย<br>ให้เดินทางไปด้วยกัน</h3>
        <p>เสน่ห์ของกกอยู่ที่ผิวสัมผัสและความต่างเล็กน้อยของเส้นใย การดูแลอย่างอ่อนโยนช่วยรักษารายละเอียดของงานสานในทุกการเดินทาง</p>
        <div class="care-parts" aria-label="ชิ้นส่วนที่ออกแบบให้ดูแลเป็นส่วนได้"><span>แผงกกสาน</span><span>ชุดล้อ</span><span>หูจับ</span><span>มุมกันกระแทก</span><span>ซับใน</span></div>
        <p class="care-note">แนวทางบริการตลอดอายุการใช้งาน • เงื่อนไขรับประกันจะระบุเมื่อเปิดจำหน่าย</p>
      </div>
      <div class="care-guides">
        <article class="care-guide"><span class="care-num">01</span><div><h4>เช็ดเบา ๆ หลังการเดินทาง</h4><p>ปัดฝุ่นด้วยแปรงขนนุ่ม ใช้ผ้านุ่มหมาดกับคราบเล็กน้อย แล้วเช็ดให้แห้ง หลีกเลี่ยงการขัดแรง การแช่น้ำ และน้ำยาที่มีฤทธิ์รุนแรง</p></div></article>
        <article class="care-guide"><span class="care-num">02</span><div><h4>พักให้แห้งก่อนเก็บ</h4><p>วางในที่ร่มและอากาศถ่ายเทให้แห้งสนิท เก็บให้พ้นความชื้นและแสงแดดจัดเป็นเวลานาน</p></div></article>
        <article class="care-guide"><span class="care-num">03</span><div><h4>ใส่ใจชิ้นส่วนที่เคลื่อนไหว</h4><p>เช็ดเศษฝุ่นรอบล้อ ตรวจหูจับและตัวล็อกก่อนเดินทาง หากชิ้นส่วนหลวมหรือฝืด ควรให้ทีมบริการตรวจสอบ</p></div></article>
      </div>
    </div>
  </section>
  <section id="care-panel-request" role="tabpanel" aria-labelledby="care-tab-request" hidden>
    <div class="care-split">
      <div><span class="care-kicker">Your care request</span><h3>ทุกชิ้นส่วน<br>มีเรื่องราวต่อได้</h3><p>เลือกชิ้นส่วนและเล่าอาการที่พบ เพื่อเตรียมข้อมูลสำหรับการประเมินงานดูแล ซ่อมแซม หรือเปลี่ยนแผงกก</p><p class="care-note">บันทึกบนอุปกรณ์นี้ และดาวน์โหลดคำขอเก็บไว้ได้<br>ส่งข้อมูลให้ทีมบริการเมื่อช่องทางติดต่อพร้อม</p></div>
      <form id="kokk-care-form" class="care-form">
        <label class="care-field">ชิ้นส่วนที่ต้องการดูแล<select name="part" required><option value="">เลือกชิ้นส่วน</option><option value="panel">แผงกกสาน</option><option value="wheels">ชุดล้อ</option><option value="handle">หูจับและคันชัก</option><option value="corners">มุมกันกระแทก</option><option value="lining">ซับในและอุปกรณ์ภายใน</option></select></label>
        <label class="care-field">วันที่สะดวก (ถ้ามี)<input type="date" name="preferredDate" aria-label="วันที่สะดวก ไม่จำเป็นต้องระบุ"></label>
        <label class="care-field care-full">อาการหรือบริการที่ต้องการ<textarea name="description" required maxlength="1500" placeholder="เช่น ล้อหน้าขวาหมุนฝืด หรือต้องการเปลี่ยนลายแผงกก"></textarea></label>
        <div class="care-actions care-full"><button type="submit" class="care-button">บันทึกคำขอบนอุปกรณ์</button><button type="button" class="care-button secondary" id="care-download">ดาวน์โหลดคำขอ</button></div>
        <p class="care-status care-full" id="care-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </section>
  <section id="care-panel-journey" role="tabpanel" aria-labelledby="care-tab-journey" hidden>
    <div class="care-split">
      <div><span class="care-kicker">From fibre to your journey</span><h3>ความประณีต<br>มีจังหวะของตัวเอง</h3><p>ตัวอย่างเส้นทางการทำแผงกก ตั้งแต่คัดเส้นใยจนถึงตรวจงานก่อนส่งมอบ ให้คุณมองเห็นคุณค่าในแต่ละขั้นตอน</p><div class="care-duration">10–14<span>วันทำการ</span></div><p class="care-note">ระยะเวลาตัวอย่างสำหรับงานสั่งทำแผงกก<br>ทีมงานจะยืนยันกำหนดส่งตามลาย วัสดุ และคิวงานจริง</p></div>
      <ol class="care-timeline" aria-label="ตัวอย่างขั้นตอนงานคราฟท์">
        <li><span class="care-step">01</span><div class="care-step-title"><h4>คัดสรรและย้อมเส้นกก</h4><span>2–3 วัน</span></div><p>คัดเส้นใย เลือกเฉดสี และเตรียมวัสดุให้เหมาะกับลาย</p></li>
        <li><span class="care-step">02</span><div class="care-step-title"><h4>สานด้วยมือ</h4><span>4–5 วัน</span></div><p>ขึ้นลายและเก็บรายละเอียดของเส้นพุ่งกับเส้นยืน</p></li>
        <li><span class="care-step">03</span><div class="care-step-title"><h4>เคลือบและพักผิว</h4><span>2–3 วัน</span></div><p>เตรียมผิวสัมผัสตามรูปแบบวัสดุที่เลือก</p></li>
        <li><span class="care-step">04</span><div class="care-step-title"><h4>ประกอบแผงเข้ากับโครง</h4><span>1–2 วัน</span></div><p>เก็บขอบและตรวจความเรียบร้อยของจุดยึด</p></li>
        <li><span class="care-step">05</span><div class="care-step-title"><h4>ตรวจงานและเตรียมส่งมอบ</h4><span>1 วัน</span></div><p>ตรวจลาย สี และรายละเอียดเฉพาะตัวก่อนบรรจุ</p></li>
      </ol>
    </div>
  </section>
  <div class="care-faq">
    <details><summary>กระเป๋า Cabin ใช้ขึ้นเครื่องได้ทุกสายการบินหรือไม่</summary><p>ข้อกำหนดขนาดและน้ำหนักแตกต่างกันตามสายการบินและประเภทตั๋ว ควรตรวจสอบขนาดภายนอกรวมล้อและหูจับเทียบกับข้อกำหนดของเที่ยวบินก่อนเดินทาง</p></details>
    <details><summary>งานสานและสีจริงจะเหมือนภาพบนหน้าจอเพียงใด</summary><p>ภาพใน Atelier ใช้สำหรับจำลองดีไซน์ เส้นใยและงานฝีมือมีรายละเอียดแตกต่างกันได้ สีอาจคลาดเคลื่อนตามหน้าจอ ควรยืนยันตัวอย่างวัสดุ สี และภาพสกรีนกับทีมงานก่อนผลิต</p></details>
    <details><summary>การจัดส่ง การคืนสินค้า และการรับประกันเป็นอย่างไร</summary><p>รายละเอียดจะระบุเมื่อเปิดจำหน่าย รวมถึงพื้นที่จัดส่ง ค่าใช้จ่าย และเงื่อนไขของสินค้าสั่งทำเฉพาะบุคคล โดยยืนยันข้อมูลให้ลูกค้าทราบก่อนสั่งซื้อ</p></details>
  </div>
`;

function readSavedRequest() {
  try {
    const saved = JSON.parse(localStorage.getItem(REQUEST_KEY));
    if (!saved || typeof saved !== 'object') return null;
    return {
      part: Object.prototype.hasOwnProperty.call(parts, saved.part) ? saved.part : '',
      preferredDate: typeof saved.preferredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.preferredDate) ? saved.preferredDate : '',
      description: typeof saved.description === 'string' ? saved.description.slice(0, 1500) : ''
    };
  } catch {
    return null;
  }
}

export function initCare() {
  const root = document.getElementById('care-content');
  if (!root || root.dataset.careInitialized) return;
  root.dataset.careInitialized = 'true';
  root.innerHTML = `<style>${careStyles}</style>${careMarkup}`;

  const tabs = [...root.querySelectorAll('[data-care-tab]')];
  function activateTab(tab) {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      root.querySelector(`#${item.getAttribute('aria-controls')}`).hidden = !active;
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      const moves = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!Object.prototype.hasOwnProperty.call(moves, event.key)) return;
      event.preventDefault();
      const target = tabs[moves[event.key]];
      activateTab(target);
      target.focus();
    });
  });

  const form = root.querySelector('#kokk-care-form');
  const status = root.querySelector('#care-status');
  const saved = readSavedRequest();
  if (saved) {
    for (const [key, value] of Object.entries(saved)) form.elements[key].value = value;
    status.textContent = 'เปิดคำขอที่บันทึกบนอุปกรณ์นี้แล้ว';
  }

  function getRequest() {
    form.elements.description.setCustomValidity('');
    if (!form.elements.description.value.trim()) form.elements.description.setCustomValidity('กรุณาระบุอาการหรือบริการที่ต้องการ');
    if (!form.reportValidity()) return null;
    return {
      part: form.elements.part.value,
      preferredDate: form.elements.preferredDate.value,
      description: form.elements.description.value.trim(),
      savedAt: new Date().toISOString()
    };
  }
  form.elements.description.addEventListener('input', () => form.elements.description.setCustomValidity(''));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const request = getRequest();
    if (!request) return;
    try {
      localStorage.setItem(REQUEST_KEY, JSON.stringify(request));
      status.textContent = 'บันทึกคำขอบนอุปกรณ์นี้แล้ว พร้อมดาวน์โหลดเพื่อส่งให้ทีมบริการ';
    } catch {
      status.textContent = 'อุปกรณ์นี้บันทึกข้อมูลไม่ได้ คุณยังดาวน์โหลดคำขอเก็บไว้ได้';
    }
  });
  root.querySelector('#care-download').addEventListener('click', () => {
    const request = getRequest();
    if (!request) return;
    const lines = [
      'KOKK — CARE REQUEST',
      'คำขอที่เตรียมไว้สำหรับทีมบริการ',
      '',
      `ชิ้นส่วน — ${parts[request.part]}`,
      `วันที่สะดวก — ${request.preferredDate || 'ยังไม่ได้ระบุ'}`,
      '',
      'อาการหรือบริการที่ต้องการ',
      request.description,
      '',
      'ส่งข้อมูลให้ทีมบริการเมื่อช่องทางติดต่อพร้อม',
      'ทีมงานจะยืนยันขอบเขตบริการ ค่าใช้จ่าย และกำหนดการหลังประเมินงาน'
    ];
    const text = lines.join('\n');
    const blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
    // Some hosts cannot save files from the page: then show the request as text to copy instead of claiming a download.
    saveFile(blob, 'KOKK-care-request.txt').then(result => {
      if (result === 'saved') { status.textContent = 'เตรียมไฟล์คำขอให้ดาวน์โหลดแล้ว เก็บไว้ส่งให้ทีมบริการได้'; return; }
      let box = form.querySelector('#care-copy');
      if (!box) {
        box = document.createElement('textarea');
        box.id = 'care-copy'; box.readOnly = true; box.className = 'care-full';
        box.setAttribute('aria-label', 'ข้อความคำขอสำหรับคัดลอก');
        box.addEventListener('focus', () => box.select());
        form.append(box);
      }
      box.value = text;
      status.textContent = 'ยังไม่ได้บันทึกเป็นไฟล์ คัดลอกข้อความด้านล่างเก็บไว้ส่งให้ทีมบริการได้';
    });
  });
}
