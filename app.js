import * as R from './renderer.js?v=3';
import { initCare } from './care.js?v=3';
import * as host from './host.js?v=3';
import { initBrands } from './brand.js?v=3';
import { briefPdf } from './brief.js?v=3';
const renderLuggage = (canvas, cfg, options = {}) => R.renderLuggage(canvas, cfg, options);
const panelRect = (w, h, cfg, options = {}) => (typeof R.panelRect === 'function' ? R.panelRect(w, h, cfg, options) : null) || {x:.18*w, y:.15*h, w:.57*w, h:.70*h};
if (typeof R.preload === 'function') { try { Promise.resolve(R.preload()).catch(() => {}); } catch {} }
const $ = (id) => document.getElementById(id);
// Arrows are drawn as SVG, never typed: no site font has them, so every device borrowed its own glyph (thin on a Mac,
// heavier elsewhere, and the north-east arrow U+2197 became a blue emoji tile on iPhone). One hairline shape everywhere.
const arrow = d => `<svg class="ar" viewBox="0 0 100 100" aria-hidden="true"><path d="${d}"/></svg>`;
const AR = arrow('M3 97 97 3M60 3h37v37'), AR_E = arrow('M3 50H97M70.8 23.8 97 50 70.8 76.2'), AR_S = arrow('M50 3V97M23.8 70.8 50 97 76.2 70.8');   // north-east, east, south
const money = (value) => '฿' + value.toLocaleString('th-TH');
const sizes = {
  cabin: { label:'Cabin 20', inches:'20 นิ้ว', price:20000, dimensions:'55 × 36 × 23 ซม.', volume:'ประมาณ 35 ลิตร', trip:'2–4 วัน', note:'กะทัดรัดสำหรับทริปสั้น • การนำขึ้นเครื่องขึ้นอยู่กับข้อกำหนดของแต่ละสายการบิน' },
  checkin: { label:'Check-in 24', inches:'24 นิ้ว', price:24000, dimensions:'66 × 44 × 27 ซม.', volume:'ประมาณ 60 ลิตร', trip:'5–7 วัน', note:'พื้นที่สำหรับวันพักผ่อน • ออกแบบสำหรับสัมภาระโหลดใต้เครื่อง' },
  trunk: { label:'Trunk 28', inches:'28 นิ้ว', price:28000, dimensions:'76 × 50 × 30 ซม.', volume:'ประมาณ 90 ลิตร', trip:'8–14 วัน', note:'พร้อมสำหรับการเดินทางยาว • ออกแบบสำหรับสัมภาระโหลดใต้เครื่อง' }
};
// 14 Nov (user): the standard model is Champagne, Titanium or Graphite with Natural Sedge. Those come first in each row;
// every other shell or sedge colour (in the row or picked freely) is charged, see EXTRA.
const palette = [{name:'Natural Sedge',color:'#e9d9bd'},{name:'Espresso',color:'#35271f'},{name:'Champagne',color:'#c69a57'},{name:'Warm Ivory',color:'#f7f1e7'},{name:'Muted Olive',color:'#77745b'}];
// Wheel hub colours (null = hubs follow the shell). Champagne #c5a16a is the photo's own metal.
const wheelPalette = [{name:'Matte Black · ดำด้าน',color:'#232323'},{name:'Champagne · แชมเปญ',color:'#c5a16a'},{name:'Espresso · เอสเปรสโซ',color:'#4a3527'},{name:'Muted Olive · โอลีฟ',color:'#77745b'},{name:'Terracotta · ดินเผา',color:'#9c5a3c'}];
const shellPalette = [{name:'Champagne · แชมเปญ',color:'#c5a16a'},{name:'Titanium · ไทเทเนียม',color:'#a89c87'},{name:'Graphite · กราไฟต์',color:'#4a4642'},{name:'Silver · เงิน',color:'#bec2c6'},{name:'Matte Black · ดำด้าน',color:'#232323'},{name:'Navy · กรมท่า',color:'#25364c'},{name:'Ivory · ไอวอรี',color:'#e8e4dc'}];
const FREE_SHELL=['#c5a16a','#a89c87','#4a4642'], FREE_WEAVE=['#e9d9bd'];
const patterns = {twill:'ลายขัดสอง',herringbone:'ลายก้างปลา',grid:'ตารางโอลีฟ',minimal:'มินิมอล V',diamond:'ข้าวหลามตัด'};
const fontNames = {sans:'Modern',serif:'Classic',signature:'Signature',mono:'Typewriter',bold:'Bold'};
const flagNames = {none:'ไม่มี',th:'ไทย',jp:'ญี่ปุ่น',fr:'ฝรั่งเศส',gb:'สหราชอาณาจักร',us:'สหรัฐอเมริกา'};
const initial = {size:'cabin',shell:'#c5a16a',weave:'#e9d9bd',pattern:'twill',name:'',nameColor:'#35271f',nameSize:21,nameX:50,nameY:18,font:'sans',flag:'none',flagPosition:'side',artwork:null,artCut:false,artScale:65,artPosition:'center',artInk:null,artX:null,artY:null,accent:null,accent2:null,trim:null,patch:null,plate:false,finish:'matte',wheel:null};
let config = {...initial};
let currentStep = 0;
const mobileLayout = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
let previewVisible = false, previewFrame = 0, persistTimer = 0, pendingSwap = false, lastPreview = null, dimUntil = 0, dimTimer = 0;
const previewCanvas = $('luggage');
previewCanvas.width = mobileLayout ? 640 : 900;
previewCanvas.height = mobileLayout ? 800 : 1125;
function schedulePreview() {
  if (!previewVisible || previewFrame) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = 0;
    const next = {...config}, options = performance.now() < dimUntil ? {dimension:true} : {};
    const from = pendingSwap ? lastPreview : null; pendingSwap = false; lastPreview = next;
    swapRender(previewCanvas, from, next, options).catch(() => toast('แสดงภาพไม่สำเร็จ กรุณาลองอีกครั้ง'));
  });
}
// Panel-swap animation: old look stays, the new panel wipes in from the right while the rest cross-fades.
const swapTokens = new WeakMap();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function onScreen(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 && document.visibilityState !== 'hidden'; }
async function swapRender(canvas, from, to, options = {}) {
  const token = {}; swapTokens.set(canvas, token);
  if (!from || reducedMotion.matches || !onScreen(canvas)) return renderLuggage(canvas, to, options);
  const a = document.createElement('canvas'), b = document.createElement('canvas');
  a.width = b.width = canvas.width; a.height = b.height = canvas.height;
  try {
    await Promise.all([renderLuggage(a, from, options), renderLuggage(b, to, options)]);
    if (swapTokens.get(canvas) !== token) return;
    const rect = panelRect(canvas.width, canvas.height, to, options), ctx = canvas.getContext('2d'), start = performance.now(), D = 420;
    await new Promise(resolve => {
      const frame = now => {
        if (swapTokens.get(canvas) !== token) return resolve();
        const p = Math.min(1, (now - start) / D), e = 1 - Math.pow(1 - p, 3);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(a, 0, 0); ctx.globalAlpha = e; ctx.drawImage(b, 0, 0); ctx.globalAlpha = 1;
        ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); ctx.clearRect(rect.x, rect.y, rect.w, rect.h); ctx.drawImage(a, 0, 0);
        const edge = rect.x + rect.w * (1 - e);
        ctx.beginPath(); ctx.rect(edge, rect.y, rect.x + rect.w - edge, rect.h); ctx.clip(); ctx.drawImage(b, 0, 0); ctx.restore();
        if (p < 1) { ctx.fillStyle = 'rgba(53,39,31,.55)'; ctx.fillRect(Math.round(edge) - 1, rect.y, 2, rect.h); }
        ctx.restore();
        if (p < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    if (swapTokens.get(canvas) === token) { const ctx = canvas.getContext('2d'); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(b, 0, 0); ctx.restore(); }
  } finally { a.width = a.height = b.width = b.height = 0; }
}
function renderWhenVisible(canvas, settings, options = {}) {
  const paint = () => requestAnimationFrame(() => {
    if (canvas.isConnected) renderLuggage(canvas, settings, options).catch(() => {});
  });
  if (!('IntersectionObserver' in window)) { paint(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); paint(); }
  }, {rootMargin:'120px'});
  observer.observe(canvas);
}
const storedDesigns = readStorage('kokk-designs-v1', []);
let saved = (Array.isArray(storedDesigns) ? storedDesigns : []).filter(validDesign).slice(0,8).map(item => ({...item, config:cleanConfig(item.config)}));
let uploadVersion = 0;
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function validDesign(item) { return item && item.config && Object.prototype.hasOwnProperty.call(sizes,item.config.size) && Object.prototype.hasOwnProperty.call(patterns,item.config.pattern); }
function cleanConfig(raw) {
 const out={...initial};
 for(const key of ['size','pattern','font','flag','flagPosition','artPosition','finish']) {
  const valid={size:Object.keys(sizes),pattern:Object.keys(patterns),font:Object.keys(fontNames),flag:Object.keys(flagNames),flagPosition:['top','side'],artPosition:['center','upper','lower'],finish:['matte','satin']};
  if(valid[key].includes(raw?.[key])) out[key]=raw[key];
 }
 for(const key of ['shell','weave','nameColor']) if(/^#[0-9a-f]{6}$/i.test(raw?.[key])) out[key]=raw[key];
 if(typeof raw?.name==='string') out.name=raw.name.slice(0,20);
 const oldPanel = {cabin:{w:334,h:462},checkin:{w:346,h:542},trunk:{w:320,h:590}}[out.size];
 const oldSideRibbon = out.flagPosition==='side' && ['th','fr'].includes(out.flag);
 out.nameSize = Number.isFinite(raw?.nameSize) ? Math.max(12,Math.min(44,raw.nameSize)) : 21;
 out.nameX = Number.isFinite(raw?.nameX) ? Math.max(0,Math.min(100,raw.nameX)) : (oldPanel.w-(oldSideRibbon?54:0))/oldPanel.w*50;
 out.nameY = Number.isFinite(raw?.nameY) ? Math.max(0,Math.min(100,raw.nameY)) : (out.flag!=='none'?94:59)/oldPanel.h*100;
 if(Number.isFinite(Number(raw?.artScale))) out.artScale=Math.max(15,Math.min(100,Number(raw.artScale)));
 if(typeof raw?.artwork==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(raw.artwork) && raw.artwork.length<2500000) out.artwork=raw.artwork;
 out.artCut = raw?.artCut === true;   // die-cut: the renderer cuts the backdrop away along the shape (renderer.js dieCut)
 out.artInk = typeof raw?.artInk === 'string' && /^#[0-9a-f]{6}$/i.test(raw.artInk) ? raw.artInk : null;
 for (const key of ['artX','artY']) out[key] = Number.isFinite(raw?.[key]) ? Math.max(0, Math.min(100, raw[key])) : null;
 // accent/accent2: motif strands dyed in a brand's CI colours (set by KOKK for brands, see renderer.js patternAccents)
 for (const key of ['accent','accent2']) out[key] = typeof raw?.[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key]) ? raw[key] : null;
 // trim (piping round the panel), patch (woven label behind the logo), plate (KOKK plate keeps its metal): set by the brand Signature, see renderer.js
 for (const key of ['trim','patch']) out[key] = typeof raw?.[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key]) ? raw[key] : null;
 out.plate = raw?.plate === true;
 out.wheel = typeof raw?.wheel === 'string' && /^#[0-9a-f]{6}$/i.test(raw.wheel) ? raw.wheel.toLowerCase() : null;   // wheel hub colour, null = follows the shell
 return out;
}
const draft=readStorage('kokk-draft-v1',null);if(draft) config=cleanConfig(draft);
// 14 Nov (user, option A + standard model): the base price covers the standard model (FREE_SHELL + Natural Sedge), every
// weave pattern, both finishes and wheels in the shell's colour; each other choice adds its own amount. Concept prices, not factory costs.
const EXTRA={shell:4000,weave:2500,wheel:1500,name:1500,flag:1000,artwork:3000};
const EXTRA_LABEL={shell:'สีโครง',weave:'สีกก',wheel:'สีล้อ',name:'สกรีนชื่อ',flag:'แถบธง',artwork:'ภาพสกรีน'};
const isFree=(list,color)=>list.includes(String(color).toLowerCase());
function extras(c=config){
 const on={shell:!isFree(FREE_SHELL,c.shell),weave:!isFree(FREE_WEAVE,c.weave),wheel:!!c.wheel&&c.wheel.toLowerCase()!==String(c.shell).toLowerCase(),name:!!c.name.trim(),flag:c.flag!=='none',artwork:!!c.artwork};
 return Object.keys(EXTRA).filter(k=>on[k]);
}
// Price breakdown (14 Nov, user): the size's base price, then one line per charged item with what was chosen.
function priceLines(c=config){
 const what={shell:()=>colorName(c.shell),weave:()=>colorName(c.weave),wheel:()=>colorName(c.wheel),name:()=>c.name.trim(),flag:()=>flagNames[c.flag],artwork:()=>c.artCut?'รวมไดคัท':''};
 return [{label:sizes[c.size].label+' · ราคาตั้งต้น',amount:sizes[c.size].price,base:true},...extras(c).map(k=>({label:EXTRA_LABEL[k],detail:what[k](),amount:EXTRA[k]}))];
}
function total(c=config){return sizes[c.size].price+extras(c).reduce((sum,k)=>sum+EXTRA[k],0);}
function priceDetail(c=config){const list=extras(c);return list.length?'รวม '+list.map(k=>EXTRA_LABEL[k]+' +'+EXTRA[k].toLocaleString('en-US')).join(' · '):'รวมลายสานและสีที่เลือก';}
function toast(message,action){const t=$('toast');t.textContent=message;t.classList.toggle('has-action',!!action);if(action){const b=document.createElement('button');b.type='button';b.className='toast-action';b.textContent=action.label;b.onclick=()=>{clearTimeout(toast.timer);t.classList.remove('show','has-action');action.run();};t.append(b);}t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show','has-action'),action?6000:3400);}
function colorName(color){return [...shellPalette,...palette,...wheelPalette].find(p=>p.color.toLowerCase()===color.toLowerCase())?.name || color.toUpperCase();}
function persistDraft(){try{localStorage.setItem('kokk-draft-v1',JSON.stringify(config));}catch{/* Preview remains usable when storage is full. */}}
function update(){
 schedulePreview();
 $('price').textContent=money(total());{const list=extras();$('price-detail').innerHTML=list.length?'รวม '+list.map(k=>`<span class="nowrap">${EXTRA_LABEL[k]} +${EXTRA[k].toLocaleString('en-US')}</span>`).join(' · '):priceDetail();}
 $('preview-title').textContent='KOKK / '+sizes[config.size].label.toUpperCase();
 $('size-note').textContent=sizes[config.size].dimensions+' · '+sizes[config.size].volume+'\n'+sizes[config.size].note;
 const ex=extras(),plus=k=>ex.includes(k)?' · +฿'+EXTRA[k].toLocaleString('en-US'):' · รวมในราคา';
 $('shell-label').textContent=colorName(config.shell)+plus('shell');$('weave-label').textContent=colorName(config.weave)+plus('weave');$('wheel-label').textContent=(config.wheel?colorName(config.wheel):'ตามสีโครง')+plus('wheel');
 document.querySelectorAll('[data-wheel]').forEach(el=>el.setAttribute('aria-pressed',String((el.dataset.wheel||null)===config.wheel)));$('wheel-default').style.setProperty('--color',config.shell);
 document.querySelectorAll('[data-size]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.size===config.size)));
 document.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.color===config[el.dataset.kind])));
 document.querySelectorAll('[data-pattern]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.pattern===config.pattern)));
 document.querySelectorAll('[data-look]').forEach(el=>{const l=looks[Number(el.dataset.look)];el.setAttribute('aria-pressed',String(l.shell===config.shell&&l.weave===config.weave&&l.pattern===config.pattern));});
 document.querySelectorAll('[data-font]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.font===config.font)));
 document.querySelectorAll('[data-name-position]').forEach(el=>{const [x,y]=el.dataset.namePosition.split(',').map(Number);el.setAttribute('aria-pressed',String(Math.abs(config.nameX-x)<.1&&Math.abs(config.nameY-y)<.1));});
 $('name-size-value').textContent=Math.round(config.nameSize/21*100)+'%';
 $('name-x-value').textContent=Math.round(config.nameX)+'%';$('name-y-value').textContent=Math.round(config.nameY)+'%';
 {const [ax,ay]=artCentre();$('art-x').value=ax;$('art-y').value=ay;$('art-x-value').textContent=Math.round(ax)+'%';$('art-y-value').textContent=Math.round(ay)+'%';$('art-cut').checked=config.artCut;
  document.querySelectorAll('[data-art-position]').forEach(el=>{const [x,y]=el.dataset.artPosition.split(',').map(Number);el.setAttribute('aria-pressed',String(Math.abs(ax-x)<.1&&Math.abs(ay-y)<.1));});
  previewCanvas.style.cursor=config.artwork&&!mobileLayout?'move':'';}
 $('art-controls').hidden=!config.artwork;$('upload-label').textContent=config.artwork?'เปลี่ยนภาพสกรีน':'เลือกภาพหรือลายของคุณ';clearTimeout(persistTimer);persistTimer=setTimeout(persistDraft,250);
}
function syncInputs(){
 const mapping={name:'name','name-size':'nameSize','name-x':'nameX','name-y':'nameY',font:'font',flag:'flag','flag-position':'flagPosition','name-color':'nameColor','art-scale':'artScale',finish:'finish','shell-custom':'shell','weave-custom':'weave'};
 for(const [id,key] of Object.entries(mapping)) $(id).value=config[key];
}
function setStep(step){currentStep=step;document.querySelectorAll('[data-step]').forEach(b=>{b.setAttribute('aria-selected',String(Number(b.dataset.step)===step));b.tabIndex=Number(b.dataset.step)===step?0:-1;});document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=Number(p.dataset.panel)!==step);$('next-step').innerHTML='<span>'+['เลือกงานสาน '+AR_E,'ใส่ความเป็นคุณ '+AR_E,'ดูสรุปดีไซน์ '+AR][step]+'</span>';}
document.querySelectorAll('[data-step]').forEach(b=>{b.addEventListener('click',()=>setStep(Number(b.dataset.step)));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setStep((currentStep+(e.key==='ArrowRight'?1:2))%3);document.querySelector(`[data-step="${currentStep}"]`).focus();}});});
$('next-step').onclick=()=>currentStep<2?setStep(currentStep+1):showSummary();
$('size-options').innerHTML=Object.entries(sizes).map(([key,s])=>`<button class="size-choice" data-size="${key}" aria-pressed="false"><span><strong>${s.label}</strong><small>${s.dimensions} · ${s.trip}</small></span><span>${money(s.price)}</span></button>`).join('');
function markSizeChange(){dimUntil=performance.now()+2500;clearTimeout(dimTimer);dimTimer=setTimeout(schedulePreview,2600);}
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{if(config.size!==b.dataset.size)markSizeChange();config.size=b.dataset.size;update();});
// the three quick looks are the three standard models (no extra cost); they differ by weave pattern only
const looks=[{shell:'#c5a16a',weave:'#e9d9bd',pattern:'twill'},{shell:'#a89c87',weave:'#e9d9bd',pattern:'grid'},{shell:'#4a4642',weave:'#e9d9bd',pattern:'minimal'}];
function applyLook(look,size){const prev={...config};Object.assign(config,{accent:null,accent2:null,trim:null,patch:null,plate:false},look);if(size){if(config.size!==size)markSizeChange();config.size=size;}if(prev.weave!==config.weave||prev.pattern!==config.pattern)pendingSwap=true;$('shell-custom').value=config.shell;$('weave-custom').value=config.weave;update();}
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>applyLook(looks[Number(b.dataset.look)]));
for(const kind of ['shell','weave']){
 $(kind+'-options').innerHTML=(kind==='shell'?shellPalette:palette).map(p=>`<button class="swatch" data-kind="${kind}" data-color="${p.color}" style="--color:${p.color}" title="${p.name}" aria-label="${kind==='shell'?'สีโครง':'สีกก'} ${p.name}" aria-pressed="false"></button>`).join('');
 $(kind+'-options').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(kind==='weave'&&config.weave!==b.dataset.color)pendingSwap=true;config[kind]=b.dataset.color;$(kind+'-custom').value=config[kind];update();});
 $(kind+'-custom').addEventListener('input',e=>{config[kind]=e.target.value;update();});
}
$('wheel-options').innerHTML=`<button class="swatch wheel-default" id="wheel-default" data-wheel="" title="ตามสีโครง (รวมในราคา)" aria-label="สีล้อ ตามสีโครง" aria-pressed="true"></button>`+wheelPalette.map(p=>`<button class="swatch" data-wheel="${p.color}" style="--color:${p.color}" title="${p.name}" aria-label="สีล้อ ${p.name}" aria-pressed="false"></button>`).join('');
$('wheel-options').querySelectorAll('button').forEach(b=>b.onclick=()=>{config.wheel=b.dataset.wheel||null;update();});
$('pattern-options').innerHTML=Object.entries(patterns).map(([key,label])=>`<button class="pattern-button" data-pattern="${key}" aria-pressed="false"><span class="pattern-chip ${key}" aria-hidden="true"></span>${label}</button>`).join('');
document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{if(config.pattern!==b.dataset.pattern)pendingSwap=true;config.pattern=b.dataset.pattern;update();});
for(const [id,key] of Object.entries({name:'name','name-size':'nameSize','name-x':'nameX','name-y':'nameY',font:'font',flag:'flag','flag-position':'flagPosition','name-color':'nameColor','art-scale':'artScale',finish:'finish'})) $(id).addEventListener('input',e=>{config[key]=['artScale','nameSize','nameX','nameY'].includes(key)?Number(e.target.value):e.target.value;update();});
document.querySelectorAll('[data-font]').forEach(button=>button.onclick=()=>{config.font=button.dataset.font;$('font').value=config.font;update();if(config.font==='signature' && document.fonts)document.fonts.load('500 24px Caveat').then(schedulePreview).catch(()=>{});});
 document.querySelectorAll('[data-name-position]').forEach(button=>button.onclick=()=>{const [x,y]=button.dataset.namePosition.split(',').map(Number);config.nameX=x;config.nameY=y;$('name-x').value=x;$('name-y').value=y;update();});
async function decodeUpload(file) {
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
    const scale=Math.min(1,900/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,canvas.width,canvas.height);
    // a picture on one flat, opaque backdrop (a logo on white paper) gets die-cut by default; photos and see-through PNGs do not
    const W=canvas.width,H=canvas.height,d=g.getImageData(0,0,W,H).data,edge=[];
    for(let x=0;x<W;x+=Math.max(1,W/120|0))edge.push(x,(H-1)*W+x);for(let y=0;y<H;y+=Math.max(1,H/120|0))edge.push(y*W,y*W+W-1);
    const avg=[0,1,2].map(k=>edge.reduce((t,i)=>t+d[i*4+k],0)/edge.length);
    const flat=edge.every(i=>d[i*4+3]>240)&&edge.filter(i=>Math.hypot(d[i*4]-avg[0],d[i*4+1]-avg[1],d[i*4+2]-avg[2])<24).length/edge.length>.94;
    const result=canvas.toDataURL('image/webp',.88);
    canvas.width=canvas.height=1;
    return {data:result,flat};
  } finally {URL.revokeObjectURL(url);}
}
$('artwork').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;const ticket=++uploadVersion;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){toast('เลือกภาพ PNG, JPG หรือ WEBP ขนาดไม่เกิน 8 MB');e.target.value='';return;}
 try{const image=await decodeUpload(file);if(ticket!==uploadVersion)return;config.artwork=image.data;config.artCut=image.flat;update();toast(image.flat?'เพิ่มภาพแล้ว · ไดคัทพื้นหลังให้แล้ว (ปิดได้)':'เพิ่มภาพสกรีนแล้ว');}catch{toast('เปิดภาพนี้ไม่ได้ กรุณาลองไฟล์อื่น');}finally{e.target.value='';}
});
// Artwork position (14 Nov, user: pictures and logos can be moved): 9-point grid + sliders like the name, and on a
// mouse or pen, drag on the preview (relative drag anywhere on the panel; touch keeps the page scroll, so phones use the controls).
function artCentre(c=config){return [c.artX??50, c.artY??({upper:32,lower:72}[c.artPosition]??54)];}
function setArt(x,y){config.artX=Math.max(0,Math.min(100,x));config.artY=Math.max(0,Math.min(100,y));update();}
$('art-grid').innerHTML=document.querySelector('[aria-label="เลือกตำแหน่งชื่อ"]').innerHTML.replaceAll('data-name-position','data-art-position').replaceAll('ชื่อ','ภาพ').replace(/"(\d+),15"/g,'"$1,20"').replace(/"(\d+),85"/g,'"$1,80"');
document.querySelectorAll('[data-art-position]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.artPosition.split(',').map(Number);setArt(x,y);});
for(const axis of ['x','y'])$('art-'+axis).addEventListener('input',e=>{const [x,y]=artCentre();axis==='x'?setArt(Number(e.target.value),y):setArt(x,Number(e.target.value));});
$('art-cut').addEventListener('change',e=>{config.artCut=e.target.checked;update();});
let artDrag=null;
previewCanvas.addEventListener('pointerdown',e=>{
 if(!config.artwork||e.pointerType==='touch'||e.button!==0)return;
 const box=previewCanvas.getBoundingClientRect(),k=previewCanvas.width/box.width,p=panelRect(previewCanvas.width,previewCanvas.height,config,{});
 const cx=(e.clientX-box.left)*k,cy=(e.clientY-box.top)*k;
 if(cx<p.x||cx>p.x+p.w||cy<p.y||cy>p.y+p.h)return;
 artDrag={sx:e.clientX,sy:e.clientY,k,p,start:artCentre()};previewCanvas.setPointerCapture(e.pointerId);e.preventDefault();
});
previewCanvas.addEventListener('pointermove',e=>{if(!artDrag)return;const d=artDrag;setArt(d.start[0]+(e.clientX-d.sx)*d.k/d.p.w*100,d.start[1]+(e.clientY-d.sy)*d.k/d.p.h*100);});
for(const type of ['pointerup','pointercancel'])previewCanvas.addEventListener(type,()=>{artDrag=null;});
$('remove-art').onclick=()=>{uploadVersion++;config.artwork=null;update();};
$('reset').onclick=()=>{uploadVersion++;const before={...config};config={...initial};syncInputs();setStep(0);update();toast('เริ่มออกแบบใหม่แล้ว',{label:'เลิกทำ',run:()=>{config=cleanConfig(before);syncInputs();update();toast('กลับไปที่แบบเดิมแล้ว');}});};
// Every download goes through host.saveFile; inside a host without downloads the image dialog takes over.
async function saveBlob(blob,name){const result=await host.saveFile(blob,name);if(result==='manual'){if(blob.type.startsWith('image/'))showImageActions(blob);else showModal('<p class="eyebrow">DESIGN BRIEF</p><h2 class="modal-title">สรุปดีไซน์ของคุณ</h2><p class="fineprint">คัดลอกข้อความด้านล่างเก็บไว้ได้เลย</p><pre class="brief-text">'+esc(await blob.text())+'</pre>');}return result;}
async function exportImage(c=config){
 const snapshot={...c};
 if(document.fonts)await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1200))]);
 const canvas=document.createElement('canvas');canvas.width=mobileLayout?1200:1600;canvas.height=mobileLayout?1500:2000;
 await renderLuggage(canvas,snapshot,{export:true});
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('export')),'image/png'));
 canvas.width=canvas.height=1;
 return blob;
}
let imageDialogUrl=null;
function clearImageDialog(){if(imageDialogUrl){URL.revokeObjectURL(imageDialogUrl);imageDialogUrl=null;}}
function showImageActions(blob){
 showModal('<p class="eyebrow">YOUR PERSONAL KOKK</p><h2 class="modal-title">เก็บภาพใบที่เป็นคุณ</h2><img id="export-preview" class="export-preview" alt="ภาพกระเป๋าที่คุณออกแบบ"><p class="fineprint">'+(host.inClaude?'แตะภาพค้าง หรือคลิกขวาที่ภาพ เพื่อบันทึก':'แตะดาวน์โหลด หรือแตะภาพค้างเพื่อบันทึกลงมือถือ')+'</p><div class="export-actions"><a id="ready-download" class="button dark" download="My-KOKK.png"><span>'+AR_S+' ดาวน์โหลดภาพ</span></a><button class="button outline" id="ready-share" hidden><span>'+AR+' แชร์ / บันทึกลงรูปภาพ</span></button></div>');
 imageDialogUrl=URL.createObjectURL(blob);$('export-preview').src=imageDialogUrl;$('ready-download').href=imageDialogUrl;$('ready-download').hidden=host.inClaude;
 const file=new File([blob],'My-KOKK.png',{type:'image/png'});
 if(navigator.share && navigator.canShare?.({files:[file]})){
  $('ready-share').hidden=false;
  $('ready-share').onclick=()=>navigator.share({files:[file],title:'My KOKK',text:'A journey, woven mine. — KOKK'}).catch(e=>{if(e.name!=='AbortError')toast('กรุณาแตะดาวน์โหลด หรือแตะภาพค้างเพื่อบันทึก');});
 }
}
$('download-image').onclick=async()=>{const b=$('download-image');b.disabled=true;try{const blob=await exportImage();if(mobileLayout)showImageActions(blob);else{const r=await saveBlob(blob,'KOKK-'+sizes[config.size].label.replace(/ /g,'-')+'-My-Design.png');if(r==='saved')toast('เตรียมภาพสำหรับดาวน์โหลดแล้ว');}}catch{toast('บันทึกภาพไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{b.disabled=false;}};
$('share-design').onclick=async()=>{const b=$('share-design');b.disabled=true;try{showImageActions(await exportImage());}catch{toast('เตรียมภาพไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{b.disabled=false;}};
function saveDesign(){if(saved.length>=8){toast('เก็บได้ 8 แบบ ลบแบบเก่าก่อนเพิ่มแบบใหม่');return;}const item={id:(crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)),date:new Date().toISOString(),config:{...config}};const next=[item,...saved];try{localStorage.setItem('kokk-designs-v1',JSON.stringify(next));saved=next;$('saved-count').textContent=saved.length;toast('เก็บดีไซน์ไว้บนอุปกรณ์นี้แล้ว');}catch{toast('พื้นที่บันทึกเต็ม กรุณาบันทึกเป็นภาพแทน');}}
$('save-design').onclick=saveDesign;
const modal=$('modal');
document.querySelector('.modal-close').onclick=()=>closeModal();modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function closeModal(){if(typeof modal.close==='function')modal.close();else{modal.removeAttribute('open');document.body.classList.remove('modal-open');}clearImageDialog();}
modal.addEventListener('close',clearImageDialog);
function showModal(html){clearImageDialog();$('modal-content').innerHTML=html;if(!modal.open){if(typeof modal.showModal==='function')modal.showModal();else{modal.setAttribute('open','');modal.classList.add('dialog-fallback');document.body.classList.add('modal-open');}}}

function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Design brief PDF (14 Nov, user): one calm A4 page with the picture, the details to order it and the price breakdown.
const inPalettes=color=>[...shellPalette,...palette,...wheelPalette].some(p=>p.color.toLowerCase()===String(color).toLowerCase());
const colourLabel=color=>inPalettes(color)?colorName(color):'สีพิเศษ '+String(color).toUpperCase();
function briefRef(c){const s=JSON.stringify({...c,artwork:c.artwork?c.artwork.length:0});let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return 'No. KOKK-'+h.toString(36).toUpperCase().slice(0,6);}
async function briefArtwork(c){
 if(!c.artwork)return null;
 const img=await new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=c.artwork;});
 return img&&c.artCut?R.dieCut(img):img;
}
async function makeBrief(c){
 const [ax,ay]=artCentre(c),pct=v=>Math.round(v)+'%';
 const spec=[
  {label:'สีโครง',value:colourLabel(c.shell),color:c.shell},
  {label:'สีกก',value:colourLabel(c.weave),color:c.weave},
  {label:'ลายสาน',value:patterns[c.pattern]},
  {label:'ผิวสัมผัส',value:c.finish==='satin'?'Satin · เงานุ่ม':'Matte · แมตต์ธรรมชาติ'},
  {label:'สีล้อ',value:c.wheel?colourLabel(c.wheel):'ตามสีโครง',color:c.wheel||c.shell},
 ];
 if(c.name.trim())spec.push({label:'สกรีนชื่อ',value:c.name.trim(),color:c.nameColor,sub:fontNames[c.font]+' · ขนาด '+pct(c.nameSize/21*100)+' · ตำแหน่ง '+pct(c.nameX)+', '+pct(c.nameY)});
 if(c.flag!=='none')spec.push({label:'แถบธง',value:flagNames[c.flag],sub:c.flagPosition==='top'?'แถบด้านบน':'แถบด้านข้าง'});
 if(c.artwork)spec.push({label:'ภาพสกรีน',value:c.artCut?'ภาพของคุณ · ไดคัท':'ภาพของคุณ',sub:'ขนาด '+pct(c.artScale)+' · ตำแหน่ง '+pct(ax)+', '+pct(ay)});
 return briefPdf({date:new Date().toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}),ref:briefRef(c),model:sizes[c.size].label,dims:sizes[c.size].dimensions+' · '+sizes[c.size].volume,
  spec,price:priceLines(c),total:total(c),money,render:canvas=>renderLuggage(canvas,c),artwork:await briefArtwork(c),artNote:c.artCut?'ไดคัทตามรูปทรง · ใช้ไฟล์ต้นฉบับตอนผลิต':'ใช้ไฟล์ต้นฉบับตอนผลิต'});
}
async function downloadBrief(c,button){
 button.disabled=true;
 try{const {pdf,page}=await makeBrief(c);const r=await host.saveFile(pdf,'KOKK-'+sizes[c.size].label.replace(/ /g,'-')+'-Design-Brief.pdf');
  if(r==='manual')showImageActions(page);else if(r==='saved')toast('บันทึกสรุปดีไซน์ (PDF) แล้ว');}
 catch{toast('สร้างไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง');}
 finally{button.disabled=false;}
}
function showSummary(){const c={...config};showModal(`<p class="eyebrow">YOUR PERSONAL EDITION</p><h2 class="modal-title">One of your own.</h2><div class="summary-layout"><canvas id="summary-canvas" width="640" height="800"></canvas><div><dl><dt>รุ่น</dt><dd>${sizes[c.size].label}</dd><dt>ลายสาน</dt><dd>${patterns[c.pattern]}</dd><dt>สีโครง</dt><dd>${colorName(c.shell)}</dd><dt>สีกก</dt><dd>${colorName(c.weave)}</dd><dt>สีล้อ</dt><dd>${c.wheel?colorName(c.wheel):'ตามสีโครง'}</dd><dt>ชื่อสกรีน</dt><dd>${esc(c.name.trim()||'ไม่มี')}</dd><dt>ฟอนต์ / ขนาดชื่อ</dt><dd>${fontNames[c.font]} / ${Math.round(c.nameSize/21*100)}%</dd><dt>ตำแหน่งชื่อ</dt><dd>${Math.round(c.nameX)}% · ${Math.round(c.nameY)}%</dd><dt>แถบธง</dt><dd>${flagNames[c.flag]}</dd><dt>ภาพสกรีน</dt><dd>${c.artwork?'ภาพของคุณ'+(c.artCut?' · ไดคัท':''):'ไม่มี'}</dd></dl><div class="price-break" aria-label="แจกแจงราคา"><p class="price-break-title">แจกแจงราคา</p>${priceLines(c).map(l=>`<div class="price-row${l.base?' base':''}"><span>${esc(l.label)}${l.detail?` <small>${esc(l.detail)}</small>`:''}</span><span>${l.base?'':'+'}${money(l.amount)}</span></div>`).join('')}<div class="price-row total"><span>ราคารวมแนวคิด</span><strong>${money(total(c))}</strong></div></div><button class="button dark" id="brief-download"><span>${AR_S} ดาวน์โหลดสรุปดีไซน์ (PDF)</span></button><button class="button outline" id="summary-save">♡ เก็บใน My designs</button><p class="fineprint">สรุปแบบสำหรับปรึกษาการผลิต<br>ยืนยันตัวอย่างวัสดุ ขนาด ราคา และเงื่อนไขก่อนสั่งผลิต</p></div></div>`);renderLuggage($('summary-canvas'),c);$('brief-download').onclick=()=>downloadBrief(c,$('brief-download'));$('summary-save').onclick=saveDesign;}
$('open-saved').onclick=showSaved;
function showSaved(){showModal(`<p class="eyebrow">YOUR PRIVATE COLLECTION</p><h2 class="modal-title">My designs <em>(${saved.length})</em></h2><p class="fineprint">เก็บบนเบราว์เซอร์และอุปกรณ์นี้ • สูงสุด 8 แบบ</p>${saved.length?'<div class="saved-grid">'+saved.map((item,i)=>`<article class="saved-item"><canvas id="saved-${i}" width="480" height="600" aria-label="ดีไซน์ที่บันทึก ${i+1}"></canvas><strong>${sizes[item.config.size].label}</strong><br><small>${esc(item.config.name||patterns[item.config.pattern])} · ${money(total(item.config))}</small><div><button class="text-link" data-load="${i}">แก้ไขแบบ ${AR}</button><button class="text-link" data-delete="${i}">ลบแบบ ×</button></div></article>`).join('')+'</div>':'<p class="modal-body">เมื่อเจอดีไซน์ที่ชอบ กด “เก็บแบบนี้” ในหน้าออกแบบ<br>แล้วกลับมาต่อยอดได้ทุกเมื่อ</p><a class="button dark" id="empty-create" href="#atelier"><span>เริ่มออกแบบ '+AR+'</span></a>'}`);saved.forEach((item,i)=>renderWhenVisible($('saved-'+i),cleanConfig(item.config)));document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{uploadVersion++;config=cleanConfig(saved[Number(b.dataset.load)].config);syncInputs();update();closeModal();location.hash='atelier';toast('โหลดดีไซน์แล้ว');});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const next=saved.filter((_,i)=>i!==Number(b.dataset.delete));try{localStorage.setItem('kokk-designs-v1',JSON.stringify(next));saved=next;$('saved-count').textContent=saved.length;showSaved();}catch{toast('ลบไม่สำเร็จ กรุณาลองอีกครั้ง');}});if($('empty-create'))$('empty-create').onclick=()=>closeModal();}
$('size-guide').onclick=()=>showModal(`<p class="eyebrow">FIND YOUR FIT</p><h2 class="modal-title">Room for your journey.</h2><div class="modal-body"><table><thead><tr><th>รุ่น</th><th>ขนาดรวมล้อ</th><th>ความจุโดยประมาณ</th><th>ราคาเริ่มต้น</th></tr></thead><tbody>${Object.values(sizes).map(s=>`<tr><td>${s.label}<br>${s.trip}</td><td>${s.dimensions}</td><td>${s.volume}</td><td>${money(s.price)}</td></tr>`).join('')}</tbody></table><p class="fineprint">สเปกเพื่อการออกแบบ ยังต้องยืนยันกับต้นแบบจริง ความจุเป็นค่าประมาณ<br>การนำขึ้นเครื่องและน้ำหนักสัมภาระขึ้นอยู่กับสายการบินและชั้นโดยสาร</p></div>`);
$('show-collection').onclick=()=>showModal('<p class="eyebrow">THE SEDGE COLLECTION</p><h2 class="modal-title">Ten expressions of KOKK.</h2><div class="modal-body"><img src="assets/collection.png" alt="ภาพคอนเซ็ปต์กระเป๋า KOKK ทั้ง 10 แบบ"><p class="fineprint">คอลเลกชันภาพแนวคิดที่ร่วมกันพัฒนา • ใช้ Personal Atelier ทดลองสี ลายสาน และรายละเอียดเฉพาะตัวได้</p></div>');
$('privacy').onclick=()=>showModal('<h2 class="modal-title">Your designs, with you.</h2><div class="modal-body"><p>ภาพที่อัปโหลดจะประมวลผลในเบราว์เซอร์ ดีไซน์และคำขอซ่อมที่บันทึกจะอยู่ในพื้นที่เก็บข้อมูลของเบราว์เซอร์นี้ เมื่อเปลี่ยนอุปกรณ์หรือล้างข้อมูลเบราว์เซอร์ ข้อมูลอาจหายได้</p><p>คุณสามารถดาวน์โหลดภาพและสรุปดีไซน์เก็บไว้เอง การแชร์ผ่านเมนูอุปกรณ์จะส่งภาพไปยังแอปที่คุณเลือก</p><p>แบบฟอร์มบริการใช้เตรียมข้อมูลสำหรับติดต่อทีมบริการ การสั่งซื้อ ชำระเงิน และติดตามงานจริงจะเชื่อมต่อเมื่อแบรนด์พร้อมเปิดบริการ</p></div>');
$('products').innerHTML=Object.entries(sizes).map(([key,s],i)=>`<article class="product"><div class="product-image"><span class="product-badge">0${i+1} / ${['THE EVERYDAY','THE EXPLORER','THE LONG JOURNEY'][i]}</span><canvas id="product-${key}" width="600" height="700" aria-label="KOKK ${s.label}"></canvas></div><div class="product-bottom"><h3>${s.label}</h3><button data-choose="${key}" aria-label="ออกแบบ ${s.label}">${AR}</button></div><div class="product-detail"><span>${s.inches} · ${s.trip}</span><span>เริ่มต้น ${money(s.price)}</span></div></article>`).join('');
const productConfigs=[looks[0],looks[1],looks[2]];
Object.keys(sizes).forEach((size,i)=>renderWhenVisible($('product-'+size),{...initial,...productConfigs[i],size},{dimension:true}));
document.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{const i=Object.keys(sizes).indexOf(b.dataset.choose);applyLook(productConfigs[i],b.dataset.choose);setStep(0);goAtelier();});
function goAtelier(){const el=$('atelier');el.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});}
// Interchangeable weave: one champagne frame, three panels.
const swapLooks=[{shell:'#c5a16a',weave:'#e9d9bd',pattern:'twill'},{shell:'#c5a16a',weave:'#77745b',pattern:'grid'},{shell:'#c5a16a',weave:'#f7f1e7',pattern:'herringbone'}];
let swapIndex=0,swapShown=null;const swapCanvas=$('swap-canvas');
const swapConfig=i=>({...initial,size:'cabin',...swapLooks[i]});
function paintSwap(animate){const next=swapConfig(swapIndex);const from=animate?swapShown:null;swapShown=next;return swapRender(swapCanvas,from,next).catch(()=>{});}
if('IntersectionObserver' in window){const o=new IntersectionObserver(en=>{if(en.some(x=>x.isIntersecting)){o.disconnect();if(!swapShown)paintSwap(false);}},{rootMargin:'200px'});o.observe(swapCanvas);}else paintSwap(false);
document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.swap);if(i===swapIndex&&swapShown)return;swapIndex=i;document.querySelectorAll('[data-swap]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintSwap(true);});
$('swap-continue').onclick=()=>{applyLook(swapLooks[swapIndex]);setStep(1);goAtelier();toast('นำหน้ากกนี้ไปออกแบบต่อแล้ว');};
// On phones the export buttons sit under the controls so the sticky preview stays compact.
const phoneQuery=matchMedia('(max-width: 700px)');
function placeExport(){const block=$('export-block');if(phoneQuery.matches)document.querySelector('.studio').append(block);else $('design-preview').append(block);}
placeExport();phoneQuery.addEventListener?.('change',placeExport);
initBrands({R,host,toast,showImage:showImageActions,applyDesign:(c,message)=>{uploadVersion++;config=cleanConfig({...initial,...c});syncInputs();setStep(0);update();goAtelier();toast(message||'โหลดแบบนี้เข้าหน้าออกแบบแล้ว');}});
$('saved-count').textContent=saved.length;syncInputs();setStep(0);update();initCare();

if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{previewVisible=entries[0].isIntersecting;if(previewVisible)schedulePreview();},{rootMargin:'180px'});
 observer.observe(previewCanvas);
}else{previewVisible=true;schedulePreview();}
window.addEventListener('pagehide',persistDraft);
if(document.fonts){document.fonts.ready.then(schedulePreview);document.fonts.addEventListener?.('loadingdone',schedulePreview);}
