
'use strict';

const SAMPLE_META = [
  {
    "file": "sample-01.csv",
    "name": "Training 01 - Capable centred process",
    "lsl": 9.9,
    "usl": 10.1
  },
  {
    "file": "sample-02.csv",
    "name": "Training 02 - Capable but high",
    "lsl": 9.9,
    "usl": 10.1
  },
  {
    "file": "sample-03.csv",
    "name": "Training 03 - Marginal process",
    "lsl": 9.9,
    "usl": 10.1
  },
  {
    "file": "sample-04.csv",
    "name": "Training 04 - Not capable / high variation",
    "lsl": 9.9,
    "usl": 10.1
  },
  {
    "file": "sample-05.csv",
    "name": "Training 05 - Drift over time",
    "lsl": 9.9,
    "usl": 10.1
  },
  {
    "file": "sample-06.csv",
    "name": "Training 06 - Outliers included",
    "lsl": 9.9,
    "usl": 10.1
  }
];
const $ = id => document.getElementById(id);

const state = {
  spc: null,
  surface: null,
  trig: null
};

function dec() { return Number($('decimals').value || 3); }
function fmt(x, d = null) { return Number.isFinite(Number(x)) ? Number(x).toFixed(d === null ? dec() : d) : '—'; }
function num(id) { const v = Number($(id).value); return Number.isFinite(v) ? v : 0; }

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
  $('page-' + page).classList.add('active');
  setTimeout(() => {
    if (page === 'spc' && state.spc) renderSpc(state.spc);
    if (page === 'surface') renderSurface();
    if (page === 'trig') renderTrig();
  }, 50);
}

function parseValues(text) {
  return text.split(/[\s,;\t]+/).map(v => Number(v.trim())).filter(Number.isFinite);
}
function mean(a) { return a.reduce((s,x)=>s+x,0)/a.length; }
function sd(a, sample=true) {
  const m = mean(a);
  const div = a.length - (sample ? 1 : 0);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/div);
}
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  const t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}
function normCdf(z) { return 0.5*(1+erf(z/Math.SQRT2)); }
function capClass(v) { return v >= 1.33 ? 'good' : v >= 1.0 ? 'warn' : 'bad'; }

// ---------------- SPC ----------------
function analyseSpc() {
  const values = parseValues($('dataBox').value);
  const lsl = num('lsl'), usl = num('usl'), target = num('target');
  if (values.length < 2 || !Number.isFinite(lsl) || !Number.isFinite(usl) || usl <= lsl) return;

  const n = values.length;
  const xbar = mean(values);
  const s = sd(values, true);
  const spop = sd(values, false);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max-min;
  const cp = (usl-lsl)/(6*s);
  const cpu = (usl-xbar)/(3*s);
  const cpl = (xbar-lsl)/(3*s);
  const cpk = Math.min(cpu,cpl);
  const pp = (usl-lsl)/(6*spop);
  const ppu = (usl-xbar)/(3*spop);
  const ppl = (xbar-lsl)/(3*spop);
  const ppk = Math.min(ppu,ppl);
  const pBelow = normCdf((lsl-xbar)/s);
  const pAbove = 1-normCdf((usl-xbar)/s);
  const ppm = (pBelow+pAbove)*1e6;
  const yieldPct = (1-pBelow-pAbove)*100;
  const zbench = Math.min((xbar-lsl)/s,(usl-xbar)/s);

  state.spc = {values,lsl,usl,target,n,xbar,s,spop,min,max,range,cp,cpu,cpl,cpk,pp,ppk,ppm,yieldPct,zbench};
  renderSpc(state.spc);
}

function renderSpc(r) {
  const items = [
    ['Cp',r.cp,capClass(r.cp)], ['Cpk',r.cpk,capClass(r.cpk)], ['Pp',r.pp,capClass(r.pp)], ['Ppk',r.ppk,capClass(r.ppk)],
    ['Mean',r.xbar,''], ['Std Dev',r.s,''], ['PPM',r.ppm,''], ['Yield %',r.yieldPct,'']
  ];
  $('cards').innerHTML = items.map(([k,v,c]) => `<div class="card ${c}"><div class="k">${k}</div><div class="v">${k==='PPM'?fmt(v,0):fmt(v)}</div></div>`).join('');
  const verdict = r.cpk >= 1.33 ? ['good','Capable'] : r.cpk >= 1.0 ? ['warn','Marginal'] : ['bad','Not capable'];
  $('summary').innerHTML = `
    <span class="status ${verdict[0]}">${verdict[1]}</span><br>
    Count: <b>${r.n}</b><br>
    Mean: <b>${fmt(r.xbar)}</b><br>
    Sample σ: <b>${fmt(r.s)}</b><br>
    Population σ: <b>${fmt(r.spop)}</b><br>
    Min / Max: <b>${fmt(r.min)} / ${fmt(r.max)}</b><br>
    Range: <b>${fmt(r.range)}</b><br>
    CPU / CPL: <b>${fmt(r.cpu)} / ${fmt(r.cpl)}</b><br>
    PPM outside spec: <b>${fmt(r.ppm,0)}</b><br>
    Z bench: <b>${fmt(r.zbench)}</b>`;
  renderDataTable(r.values);
  drawHistogram(r);
  drawRunChart(r);
  drawMRChart(r);
}

function renderDataTable(values) {
  let html = '<tr><th>#</th><th>Measurement</th></tr>';
  values.forEach((v,i) => html += `<tr><td>${i+1}</td><td>${fmt(v)}</td></tr>`);
  $('dataTable').innerHTML = html;
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, Math.floor(rect.width*scale));
  canvas.height = Math.max(160, Math.floor(rect.height*scale));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale,0,0,scale,0,0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#14171b'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#454b55'; ctx.strokeRect(40,18,w-62,h-46);
  return {ctx,w,h,l:48,t:22,r:w-22,b:h-28};
}
function drawLine(ctx,x1,y1,x2,y2,color,width=2) {
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}
function drawText(ctx,text,x,y,color='#a9b0bb',align='left',size=12) {
  ctx.fillStyle=color; ctx.font=`${size}px -apple-system, Segoe UI, Arial`; ctx.textAlign=align; ctx.fillText(text,x,y);
}
function drawHistogram(r) {
  const canvas = $('hist'); if (!canvas.offsetParent) return;
  const {ctx,w,h,l,t,b} = setupCanvas(canvas);
  const plotW = w-70, plotH = h-58;
  const min = Math.min(r.min,r.lsl), max = Math.max(r.max,r.usl);
  const bins = Math.min(26, Math.max(8, Math.round(Math.sqrt(r.n))));
  const bw = (max-min)/bins;
  const counts = Array(bins).fill(0);
  r.values.forEach(v => { let k=Math.floor((v-min)/bw); if(k<0)k=0; if(k>=bins)k=bins-1; counts[k]++; });
  const maxC = Math.max(...counts);
  counts.forEach((ct,i) => {
    const x=l+i*plotW/bins+2, bh=ct/maxC*plotH;
    ctx.fillStyle='#ffcc00'; ctx.fillRect(x,b-bh,plotW/bins-4,bh);
  });
  const X = v => l+(v-min)/(max-min)*plotW;
  [r.lsl,r.usl,r.xbar].forEach((v,i) => {
    const color = i<2 ? '#ff5f5f' : '#69b7ff';
    drawLine(ctx,X(v),t,X(v),b,color,3);
    drawText(ctx,i===0?'LSL':i===1?'USL':'MEAN',X(v)+4,t+15,color,'left',12);
  });
  ctx.beginPath();
  let first=true;
  const scale=maxC*bw*Math.sqrt(2*Math.PI)*r.s;
  for(let i=0;i<240;i++){
    const xv=min+(max-min)*i/239;
    const dens=Math.exp(-0.5*((xv-r.xbar)/r.s)**2)*scale/(r.s*Math.sqrt(2*Math.PI));
    const x=X(xv), y=b-(dens/maxC)*plotH;
    if(first){ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y);
  }
  ctx.strokeStyle='#eef1f5'; ctx.lineWidth=3; ctx.stroke();
  drawText(ctx,`n=${r.n} bins=${bins}`,w-28,h-8,'#a9b0bb','right',12);
}
function drawRunChart(r) {
  const canvas = $('run'); if (!canvas.offsetParent) return;
  const {ctx,w,h,l,t,b} = setupCanvas(canvas);
  const plotW=w-70, plotH=h-58;
  const ymin=Math.min(r.min,r.lsl), ymax=Math.max(r.max,r.usl);
  const X=i=>l+i/(r.values.length-1)*plotW;
  const Y=v=>b-(v-ymin)/(ymax-ymin)*plotH;
  [r.lsl,r.usl,r.xbar].forEach((v,i)=>drawLine(ctx,l,Y(v),w-22,Y(v),i<2?'#ff5f5f':'#69b7ff',2));
  ctx.beginPath();
  r.values.forEach((v,i)=>{const x=X(i), y=Y(v); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.strokeStyle='#ffcc00'; ctx.lineWidth=2; ctx.stroke();
}
function drawMRChart(r) {
  const canvas = $('mr'); if (!canvas.offsetParent) return;
  const mr=[]; for(let i=1;i<r.values.length;i++) mr.push(Math.abs(r.values[i]-r.values[i-1]));
  const {ctx,w,h,l,t,b} = setupCanvas(canvas);
  const plotW=w-70, plotH=h-58;
  const max=Math.max(...mr,0.001);
  const X=i=>l+i/(mr.length-1)*plotW;
  const Y=v=>b-v/max*plotH;
  ctx.beginPath();
  mr.forEach((v,i)=>{const x=X(i), y=Y(v); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.strokeStyle='#ffcc00'; ctx.lineWidth=2; ctx.stroke();
  drawText(ctx,`MR avg ${fmt(mean(mr))}`,w-28,h-8,'#a9b0bb','right',12);
}

async function loadSample(index) {
  const meta = SAMPLE_META[index];
  $('lsl').value = meta.lsl;
  $('usl').value = meta.usl;
  $('target').value = ((meta.lsl+meta.usl)/2).toFixed(3);
  $('sampleNote').innerHTML = `<b>${meta.name}</b><br>Charts update immediately when this sample loads.`;
  const response = await fetch(meta.file);
  $('dataBox').value = await response.text();
  analyseSpc();
}

// ---------------- Surface Speed ----------------
function calculateSurface() {
  let d = num('ssDiameter'), r = num('ssRadius'), rpm = num('ssRpm'), speed = num('ssSpeed');
  const unit = $('ssUnit').value;
  let mmin = unit === 'mmin' ? speed : speed*60;

  if(!d && r) d = 2*r;
  if(d && !r) r = d/2;
  if(d && rpm && !mmin) mmin = Math.PI*d*rpm/1000;
  else if(d && mmin && !rpm) rpm = mmin*1000/(Math.PI*d);
  else if(rpm && mmin && !d) { d = mmin*1000/(Math.PI*rpm); r = d/2; }

  const msec = mmin/60;
  state.surface = {d,r,rpm,mmin,msec,unit};
  renderSurface();
}
function renderSurface() {
  const s = state.surface || {d:num('ssDiameter'), r:num('ssRadius'), rpm:num('ssRpm'), mmin:0, msec:0, unit:$('ssUnit').value};
  const unit = $('ssUnit').value;
  const display = unit === 'mmin' ? s.mmin : s.msec;
  const label = unit === 'mmin' ? 'm/min' : 'm/sec';
  $('ssSpeedLabel').firstChild.textContent = 'Surface speed ' + label;
  if(state.surface) {
    $('ssDiameter').value = s.d ? fmt(s.d) : '';
    $('ssRadius').value = s.r ? fmt(s.r) : '';
    $('ssRpm').value = s.rpm ? fmt(s.rpm,0) : '';
    $('ssSpeed').value = display ? fmt(display) : '';
  }
  $('ssAnswer').textContent = display ? `${fmt(display)} ${label}` : '—';
  $('ssSummary').innerHTML = `Diameter: <b>${fmt(s.d)} mm</b><br>Radius: <b>${fmt(s.r)} mm</b><br>RPM: <b>${fmt(s.rpm,0)}</b><br>Surface speed: <b>${fmt(s.msec)} m/sec</b><br>Surface speed: <b>${fmt(s.mmin)} m/min</b>`;
  drawSurfaceSvg(s);
}
function drawSurfaceSvg(s) {
  const svg = $('ssSvg');
  const d=s.d||0, rpm=s.rpm||0, msec=s.msec||0, mmin=s.mmin||0;
  svg.innerHTML = `
    <rect x="25" y="25" width="850" height="570" rx="24" fill="#171b20" stroke="#454b55"/>
    <text x="450" y="72" fill="#ffcc00" font-size="30" font-weight="900" text-anchor="middle">SURFACE SPEED</text>
    <circle cx="450" cy="285" r="155" fill="#20242a" stroke="#ffcc00" stroke-width="8"/>
    <circle cx="450" cy="285" r="18" fill="#ffcc00"/>
    <line x1="295" y1="285" x2="605" y2="285" stroke="#69b7ff" stroke-width="5"/>
    <line x1="450" y1="285" x2="605" y2="285" stroke="#eef1f5" stroke-width="5"/>
    <path d="M 305 115 A 220 220 0 0 1 635 150" fill="none" stroke="#eef1f5" stroke-width="6"/>
    <polygon points="635,150 605,146 624,174" fill="#eef1f5"/>
    <text x="450" y="294" fill="#eef1f5" font-size="30" font-weight="900" text-anchor="middle">${fmt(rpm,0)} rpm</text>
    <text x="450" y="482" fill="#69b7ff" font-size="24" font-weight="900" text-anchor="middle">Ø ${fmt(d)} mm</text>
    <text x="530" y="260" fill="#eef1f5" font-size="20" font-weight="800">R ${fmt(d/2)} mm</text>
    <rect x="70" y="515" width="760" height="54" rx="14" fill="#20242a" stroke="#454b55"/>
    <text x="90" y="548" fill="#a9b0bb" font-size="18">m/min = π × D × RPM ÷ 1000 = ${fmt(mmin)}    |    m/sec = ${fmt(msec)}</text>`;
}

// ---------------- Trig ----------------
function deg(x) { return x*180/Math.PI; }
function rad(x) { return x*Math.PI/180; }
function calculateTrig() {
  let A=num('angA'), C=num('angC'), a=num('sideA'), b=num('sideB'), c=num('sideC');
  if(A && !C) C=90-A;
  if(C && !A) A=90-C;
  if(a && c && !b) b=Math.hypot(a,c);
  if(a && b && !c) c=Math.sqrt(Math.max(0,b*b-a*a));
  if(c && b && !a) a=Math.sqrt(Math.max(0,b*b-c*c));

  if(a && c) { A=deg(Math.atan2(a,c)); C=90-A; b=Math.hypot(a,c); }
  else if(A && b) { a=b*Math.sin(rad(A)); c=b*Math.cos(rad(A)); C=90-A; }
  else if(C && b) { c=b*Math.sin(rad(C)); a=b*Math.cos(rad(C)); A=90-C; }
  else if(A && a) { b=a/Math.sin(rad(A)); c=b*Math.cos(rad(A)); C=90-A; }
  else if(A && c) { b=c/Math.cos(rad(A)); a=b*Math.sin(rad(A)); C=90-A; }
  else if(C && c) { b=c/Math.sin(rad(C)); a=b*Math.cos(rad(C)); A=90-C; }
  else if(C && a) { b=a/Math.cos(rad(C)); c=b*Math.sin(rad(C)); A=90-C; }

  state.trig = {A,C,a,b,c};
  renderTrig();
}
function renderTrig() {
  const t = state.trig || {A:0,C:0,a:0,b:0,c:0};
  if(state.trig) {
    $('angA').value = t.A ? fmt(t.A) : '';
    $('angC').value = t.C ? fmt(t.C) : '';
    $('sideA').value = t.a ? fmt(t.a) : '';
    $('sideB').value = t.b ? fmt(t.b) : '';
    $('sideC').value = t.c ? fmt(t.c) : '';
  }
  $('trigSummary').innerHTML = `Angle A: <b>${fmt(t.A)}°</b><br>Angle B: <b>90°</b><br>Angle C: <b>${fmt(t.C)}°</b><br>Side a: <b>${fmt(t.a)}</b><br>Side b / hypotenuse: <b>${fmt(t.b)}</b><br>Side c: <b>${fmt(t.c)}</b>`;
  drawTrigSvg(t);
}
function drawTrigSvg(t) {
  const svg = $('trigSvg');
  const W=900,H=620,padL=165,padR=165,padT=110,padB=110;
  const a=Math.max(t.a||0,1), c=Math.max(t.c||0,1);
  const scale=Math.min((W-padL-padR)/c,(H-padT-padB)/a);
  const triW=c*scale, triH=a*scale;
  const x0=(W-triW)/2, y0=(H+triH)/2;
  const x1=x0+triW, y1=y0, x2=x0, y2=y0-triH;
  const side = (x,y,text,anchor='middle') => `<text x="${x}" y="${y}" fill="#69b7ff" font-size="23" font-weight="900" text-anchor="${anchor}" paint-order="stroke" stroke="#14171b" stroke-width="8">${text}</text>`;
  const ang = (x,y,text,anchor='middle') => `<text x="${x}" y="${y}" fill="#eef1f5" font-size="20" font-weight="900" text-anchor="${anchor}" paint-order="stroke" stroke="#14171b" stroke-width="8">${text}</text>`;
  svg.innerHTML = `
    <rect x="25" y="25" width="850" height="570" rx="24" fill="#171b20" stroke="#454b55"/>
    <polygon points="${x0},${y0} ${x1},${y1} ${x2},${y2}" fill="#20242a" stroke="#ffcc00" stroke-width="7"/>
    <path d="M ${x0+38} ${y0} L ${x0+38} ${y0-38} L ${x0} ${y0-38}" fill="none" stroke="#eef1f5" stroke-width="4"/>
    ${side(x0-55,(y0+y2)/2,`a = ${fmt(t.a)}`,'end')}
    ${side((x0+x1)/2,y0+58,`c = ${fmt(t.c)}`)}
    ${side((x1+x2)/2+70,(y1+y2)/2-24,`b = ${fmt(t.b)}`,'start')}
    ${ang(x1-18,y1-34,`A ${fmt(t.A)}°`,'end')}
    ${ang(x2+24,y2+42,`C ${fmt(t.C)}°`,'start')}
    ${ang(x0+22,y0-18,'B 90°','start')}`;
}

// ---------------- events ----------------
function init() {
  SAMPLE_META.forEach((m,i) => $('sampleSelect').insertAdjacentHTML('beforeend', `<option value="${i}">${m.name}</option>`));
  $('sampleSelect').addEventListener('change', e => loadSample(Number(e.target.value)));
  $('analyse').addEventListener('click', analyseSpc);
  $('clearSpc').addEventListener('click', () => { $('dataBox').value=''; state.spc=null; });
  ['lsl','usl','target','dataBox'].forEach(id => $(id).addEventListener('input', () => { clearTimeout(window.spcTimer); window.spcTimer=setTimeout(analyseSpc,250); }));

  $('importCsv').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', e => {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ $('dataBox').value=reader.result; analyseSpc(); };
    reader.readAsText(file);
  });
  $('exportCsv').addEventListener('click', () => {
    const blob=new Blob([$('dataBox').value],{type:'text/csv'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='spc-data.csv'; a.click(); URL.revokeObjectURL(a.href);
  });

  $('ssCalc').addEventListener('click', calculateSurface);
  $('ssClear').addEventListener('click', () => { ['ssDiameter','ssRadius','ssRpm','ssSpeed'].forEach(id=>$(id).value=''); state.surface=null; renderSurface(); });
  $('ssUnit').addEventListener('change', renderSurface);

  $('trigCalc').addEventListener('click', calculateTrig);
  $('trigSample').addEventListener('click', () => { $('sideA').value=3; $('sideC').value=4; $('sideB').value=''; $('angA').value=''; $('angC').value=''; calculateTrig(); });
  $('trigClear').addEventListener('click', () => { ['angA','angC','sideA','sideB','sideC'].forEach(id=>$(id).value=''); state.trig=null; renderTrig(); });
  $('angA').addEventListener('blur', () => { const A=num('angA'); if(A>0 && A<90 && !$('angC').value) $('angC').value=fmt(90-A); });
  $('angC').addEventListener('blur', () => { const C=num('angC'); if(C>0 && C<90 && !$('angA').value) $('angA').value=fmt(90-C); });

  $('decimals').addEventListener('change', () => {
    if(state.spc) renderSpc(state.spc);
    renderSurface();
    renderTrig();
  });

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.go)));
  window.addEventListener('resize', () => {
    if(state.spc) renderSpc(state.spc);
    renderSurface();
    renderTrig();
  });

  loadSample(0);
  calculateSurface();
  renderTrig();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

document.addEventListener('DOMContentLoaded', init);
