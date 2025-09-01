// src/ui.js
// Wires the fixed HTML layout you provided, draws with Canvas2D (no Chart.js).
// If private engine bundle (vendor/ems-engine.min.js) is missing,
// we run a lightweight shim so the page still works.

// ---------- utilities ----------
const $ = (id) => document.getElementById(id);
const kv = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '0';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// palette (color-blind friendly)
const COL = {
  pv: '#E69F00', wind: '#D55E00', load: '#374151',
  diesel: '#0072B2', bess: '#009E73', freq: '#6A3D9A',
  soc: '#009E73', grid: '#9ca3af'
};

// ---------- engine adapter + shim ----------
function detectEngine() {
  // private bundle could attach global or export via module; keep robust
  if (window.emsEngine?.createEngine) return window.emsEngine;
  if (window.createEngine) return { createEngine: window.createEngine };
  return null;
}

function createShimEngine() {
  let timer=null, cb=()=>{}, running=false;
  // state
  const S = { t:0, hz:60, soc:70, pv:0, wind:0, load:12, diesel:12, bess:0 };

  // KPI accumulator
  const K = { fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
              pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true };

  function integrate(dt){
    // energies in MWh (dt in seconds)
    const ren = Math.max(0, S.pv + S.wind);
    const curt = Math.max(0, ren - S.load);
    K.curtailMWh   += curt * dt / 3600;
    K.pvEnergyMWh  += Math.max(0,S.pv) * dt / 3600;
    K.windEnergyMWh+= Math.max(0,S.wind)* dt / 3600;

    // simple specific fuel rate (proxy)
    // 0.22 L/kWh -> per MW * h -> L/h ; multiply dt(h)
    K.fuelUsedL    += Math.max(0,S.diesel) * 220 * (dt/3600);
    K.fuelBaselineL+= Math.max(0,S.load)   * 220 * (dt/3600);
    K.fuelSavedL    = Math.max(0, K.fuelBaselineL - K.fuelUsedL);

    const totalMWh = (K.pvEnergyMWh + K.windEnergyMWh) + (K.fuelUsedL/220);
    K.renewableShare = totalMWh>1e-6 ? (K.pvEnergyMWh+K.windEnergyMWh)/totalMWh : 0;
    K.n1ok = true;
  }

  return {
    start(dt, f0) {
      if (running) return;
      running = true;
      timer = setInterval(() => {
        const h = S.t % 24;
        const pvMax = +$('PpvMax').value || 30;
        const pvShape = +$('pvShape').value || 1.5;
        const cloud = +$('pvCloud').value || 0.35;
        // simple day shape with cloud attenuation
        const day = (h>6 && h<18) ? Math.sin(Math.PI*(h-6)/12)**pvShape : 0;
        S.pv = pvMax * day * (1 - cloud*0.7);

        const wLim = +$('PwindMax').value || 6;
        const wMean = +$('windMean').value || 8;
        const wVar = +$('windVar').value || 0.4;
        S.wind = clamp((wMean/3)+Math.sin(S.t*0.6)*wVar*2 + Math.cos(S.t*0.33)*wVar, 0, 1) * wLim;

        const L0 = +$('Pload').value || 12;
        const Lvar = +$('loadVar').value || 1.2;
        S.load = L0 + Math.sin(S.t*2*Math.PI/4) * Lvar;

        // dispatch: diesel + bess hold frequency
        const ren = Math.max(0, S.pv+S.wind);
        const net = S.load - ren;
        // diesel as slower mover
        const dgCap = (+$('dg33n').value||0)*3.3 + (+$('dg12n').value||0)*1.25;
        const dgTarget = clamp(net, 0, Math.max(0,dgCap));
        const rate = (+$('rampUp').value||0.2) * dt; // MW per sec * sec = MW
        if (S.diesel < dgTarget) S.diesel = Math.min(dgTarget, S.diesel + rate);
        else S.diesel = Math.max(dgTarget, S.diesel - rate*1.5);

        const rest = net - S.diesel;    // leftover to BESS
        S.bess = -rest;                 // 放电为正、充电为负（约定）
        const Pb_max = +$('PbMax').value || 8;
        S.bess = clamp(S.bess, -Pb_max, Pb_max);

        // SOC integrate: sign opposite to power (充电增加SOC)
        const Eb = +$('EbMax').value || 20; // MWh
        const dSOC = (-S.bess) * dt / 3600 / Eb * 100;
        S.soc = clamp(S.soc + dSOC, 10, 95);

        // frequency proxy: droop on net power mismatch handled by BESS
        const f0 = +$('f0').value || 60;
        const D  = +$('Dsys').value || 2.2;
        const alpha = (+$('alphaLoad').value||2.0)/100; // %/Hz -> pu/Hz
        const imbalance = rest; // MW not covered by diesel -> BESS/residual
        const df = (-imbalance) * 0.02 - (alpha*(S.hz - f0)); // simple closed-loop
        S.hz = clamp(S.hz + df, f0-5, f0+5);

        S.t += dt/3600; // hours
        integrate(dt);
        cb({ ...S });
      }, Math.max(50, dt*1000));
    },
    pause(){ if (timer) clearInterval(timer); timer=null; running=false; },
    reset(){
      this.pause();
      Object.assign(S,{ t:0, hz:60, soc:70, pv:0, wind:0, load:12, diesel:12, bess:0 });
      Object.assign(K,{ fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
                        pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true });
    },
    onTick(fn){ cb = fn; },
    getState(){ return { ...S }; },
    getKpis(){ return { ...K }; }
  };
}

function getEngine() {
  const ext = detectEngine();
  if (ext) return ext.createEngine ? ext.createEngine() : createShimEngine();
  return createShimEngine();
}

// ---------- buffer & canvas drawing ----------
const buf = { t:[], pv:[], wind:[], load:[], diesel:[], bess:[], hz:[], soc:[] };
function pushBuf(s, cap=24*60*6) {
  const push = (k,v)=>{ buf[k].push(v); if (buf[k].length>cap) buf[k].shift(); };
  push('t', s.t); push('pv', s.pv); push('wind', s.wind);
  push('load', s.load); push('diesel', s.diesel); push('bess', s.bess);
  push('hz', s.hz); push('soc', s.soc);
}

function line(ctx, xs, ys, color, dashed=false){
  if(xs.length<2) return;
  ctx.strokeStyle=color; ctx.lineWidth=1.6;
  if(dashed) ctx.setLineDash([6,4]); else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for(let i=1;i<xs.length;i++) ctx.lineTo(xs[i], ys[i]);
  ctx.stroke();
}

function drawAxes(ctx, w, h){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
  // border
  ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,w,h);
}

function drawPowerWindow(canvas, x0, x1){
  const ctx=canvas.getContext('2d'); const w=canvas.width, h=canvas.height;
  drawAxes(ctx,w,h);
  // y scale (auto from data in window)
  const idx = buf.t.map((v,i)=> (v>=x0 && v<=x1) ? i : -1).filter(i=>i>=0);
  const series = ['pv','wind','load','diesel','bess'];
  const all = series.flatMap(k => idx.map(i=> buf[k][i]));
  const minY = Math.min(0, ...all), maxY = Math.max(1, ...all);
  const X = t => (t-x0)/(x1-x0) * (w-28) + 14;
  const Y = v => h-14 - (v-minY)/(maxY-minY+1e-9) * (h-28);

  // grid zero
  ctx.strokeStyle='#e5e7eb'; ctx.setLineDash([4,4]);
  const yz = Y(0); ctx.beginPath(); ctx.moveTo(0,yz); ctx.lineTo(w,yz); ctx.stroke();
  ctx.setLineDash([]);

  series.forEach(k=>{
    const xs=[], ys=[];
    idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Y(buf[k][i])); });
    const col = ({pv:COL.pv, wind:COL.wind, load:COL.load, diesel:COL.diesel, bess:COL.bess})[k];
    const dash = (k==='wind'||k==='bess');
    line(ctx, xs, ys, col, dash);
  });
}

function drawFreqWindow(canvas, x0, x1){
  const ctx=canvas.getContext('2d'); const w=canvas.width, h=canvas.height;
  drawAxes(ctx,w,h);
  const idx = buf.t.map((v,i)=> (v>=x0 && v<=x1) ? i : -1).filter(i=>i>=0);

  // y scales: freq and SOC (dual but drawn on same canvas)
  const f0 = +$('f0').value || 60;
  const ysF = idx.map(i=> buf.hz[i]);
  const minF = Math.min(f0-5, ...ysF), maxF = Math.max(f0+5, ...ysF);
  const ysS = idx.map(i=> buf.soc[i]);
  const minS = 0, maxS = 100;

  const X = t => (t-x0)/(x1-x0) * (w-28) + 14;
  const Yf = v => h-14 - (v-minF)/(maxF-minF+1e-9) * (h-28);
  const Ys = v => h-14 - (v-minS)/(maxS-minS) * (h-28);

  // 60 Hz baseline
  ctx.strokeStyle=COL.grid; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0, Yf(f0)); ctx.lineTo(w, Yf(f0)); ctx.stroke();
  ctx.setLineDash([]);

  // freq
  const xf=[], yf=[];
  idx.forEach(i=>{ xf.push(X(buf.t[i])); yf.push(Yf(buf.hz[i])); });
  line(ctx, xf, yf, COL.freq, false);

  // SOC (dashed)
  const xs=[], ys=[];
  idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Ys(buf.soc[i])); });
  line(ctx, xs, ys, COL.soc, true);
}

// ---------- KPIs & log ----------
function setKpi(id, txt){ const el=$(id); if (el) el.textContent = txt; }
function renderKpis(k){
  setKpi('kpiFuel', `${kv(k.fuelUsedL,0)} L`);
  setKpi('kpiFuelBase', `${kv(k.fuelBaselineL,0)} L`);
  setKpi('kpiFuelSave', `${kv(k.fuelSavedL,0)} L`);
  setKpi('kpiRE', `${kv((k.renewableShare||0)*100,1)}%`);
  setKpi('kpiPVgen', `${kv(k.pvEnergyMWh,2)} MWh`);
  setKpi('kpiWDgen', `${kv(k.windEnergyMWh,2)} MWh`);
  setKpi('kpiCurt', `${kv(k.curtailMWh,2)} MWh`);
  setKpi('kpiN1', k.n1ok===false ? 'Not Met' : 'OK');
}

function logLine(s){
  const el = $('log');
  const ts = new Date().toLocaleTimeString('en-CA',{hour12:false});
  el.textContent = `[${ts}] ${s}\n` + el.textContent;
}

// ---------- main wiring ----------
export function setupUI(){
  // canvas dpi fix
  const fixDPI = (c)=>{ const dpr=window.devicePixelRatio||1; c.width=c.clientWidth*dpr; c.height=c.clientHeight*dpr; const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); };
  const pC = $('pPlot'), fC = $('fPlot'); fixDPI(pC); fixDPI(fC); new ResizeObserver(()=>{fixDPI(pC);fixDPI(fC);}).observe(pC.parentElement);

  const eng = getEngine();

  // window controls
  const viewLen = $('viewHours'); const viewStart = $('viewStart'); const viewLabel = $('viewLabel'); const follow = $('followLive');
  function refreshWindowLabel(){
    const l = +viewLen.value || 4, s = +viewStart.value || 0;
    viewLabel.textContent = `[${kv(s,1)}, ${kv(s+l,1)}] h`;
    setKpi('kpiWin', viewLabel.textContent);
    drawPowerWindow(pC, s, s+l);
    drawFreqWindow(fC, s, s+l);
  }
  viewLen.addEventListener('change', refreshWindowLabel);
  viewStart.addEventListener('input', ()=>{ follow.checked=false; refreshWindowLabel(); });

  // buttons
  $('startBtn').onclick = ()=>{
    const dt = +$('dt').value || 0.5;
    const f0 = +$('f0').value || 60;
    eng.start(dt, f0);
    logLine('启动仿真');
  };
  $('pauseBtn').onclick = ()=>{ eng.pause(); logLine('暂停'); };
  $('resetBtn').onclick = ()=>{
    eng.reset();
    Object.keys(buf).forEach(k=>buf[k]=[]);
    refreshWindowLabel();
    logLine('重置');
  };

  // language button文字由 i18n 控制，这里只负责功能
  $('langBtn').onclick = $('langBtn').onclick || (()=>{});

  // engine tick
  eng.onTick((s)=>{
    pushBuf(s);
    if (follow.checked){
      const l = +viewLen.value || 4;
      viewStart.value = Math.max(0, s.t - l);
    }
    refreshWindowLabel();
    $('live').textContent =
      `t=${kv(s.t,2)} h | f=${kv(s.hz,3)} Hz | Δf=${kv(s.hz-(+$('f0').value||60),3)} Hz | `+
      `PV=${kv(s.pv,2)} MW | Wind=${kv(s.wind,2)} MW | Diesel=${kv(s.diesel,2)} MW | `+
      `BESS=${kv(s.bess,2)} MW | SOC=${kv(s.soc,1)} % | Load=${kv(s.load,2)} MW`;

    if (typeof eng.getKpis === 'function') renderKpis(eng.getKpis());
  });

  // first render
  refreshWindowLabel();
}
