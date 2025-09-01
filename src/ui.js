// src/ui.js —— 完整替换版（私库优先 + 稳健绘图 + KPI前端积分）
/* -------------------- 小工具 -------------------- */
const $ = (id) => document.getElementById(id);
const kv = (n, d=2) => Number.isFinite(+n) ? (+n).toFixed(d) : '0';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const num = (id, def=0) => {
  const el = $(id); if (!el) return def;
  const v = +el.value; return Number.isFinite(v) ? v : def;
};

const COL = {
  pv:'#E69F00', wind:'#D55E00', load:'#374151',
  diesel:'#0072B2', bess:'#009E73', freq:'#6A3D9A',
  soc:'#009E73', grid:'#9ca3af'
};
const SFC_L_PER_MWH = 220;   // 柴油比油耗（L/MWh）
const ALLOW_SHIM = true;     // 如需强制只能用私库，把它改成 false

function logLine(s){
  const el=$('log'); const ts=new Date().toLocaleTimeString('en-CA',{hour12:false});
  if (el) el.textContent = `[${ts}] ${s}\n` + el.textContent;
  // console.log(`[UI] ${s}`);
}

/* -------------------- 引擎检测 / shim -------------------- */
function detectEngine() {
  if (window.emsEngine?.createEngine) return window.emsEngine;
  if (window.createEngine) return { createEngine: window.createEngine };
  return null;
}

function createShimEngine(){
  // 仅当缺私库时兜底用；保证 UI 有曲线可看
  let timer=null, running=false, cb=()=>{};
  const S={ t:0, hz:60, soc:60, pv:0, wind:0, load:12, diesel:8, bess:0 };
  const K={ fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
            pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true };

  function integ(dt){
    const ren = Math.max(0,S.pv+S.wind);
    const curt = Math.max(0, ren - S.load);
    K.curtailMWh    += curt * dt/3600;
    K.pvEnergyMWh   += Math.max(0,S.pv)   * dt/3600;
    K.windEnergyMWh += Math.max(0,S.wind) * dt/3600;
    K.fuelUsedL     += Math.max(0,S.diesel) * SFC_L_PER_MWH * (dt/3600);
    K.fuelBaselineL += Math.max(0,S.load)   * SFC_L_PER_MWH * (dt/3600);
    K.fuelSavedL = Math.max(0, K.fuelBaselineL - K.fuelUsedL);
    const total = (K.pvEnergyMWh+K.windEnergyMWh) + (K.fuelUsedL/SFC_L_PER_MWH);
    K.renewableShare = total>1e-9 ? (K.pvEnergyMWh+K.windEnergyMWh)/total : 0;
  }

  return {
    start(dt){
      if (running) return; running=true;
      const step = Math.max(0.05, +dt||0.5);
      timer = setInterval(()=>{
        const h=S.t%24;

        // PV
        const pvMax=num('PpvMax',30), pvShape=num('pvShape',1.5), cloud=num('pvCloud',0.35);
        const day=(h>6&&h<18) ? Math.sin(Math.PI*(h-6)/12)**pvShape : 0;
        S.pv = pvMax * day * (1 - cloud*0.7);

        // Wind
        const wLim=num('PwindMax',6), wMean=num('windMean',8), wVar=num('windVar',0.4);
        S.wind = clamp((wMean/3)+Math.sin(S.t*0.6)*wVar*2 + Math.cos(S.t*0.33)*wVar, 0, 1) * wLim;

        // Load
        const L0=num('Pload',12), Lva=num('loadVar',1.2);
        S.load = L0 + Math.sin(S.t*2*Math.PI/4)*Lva;

        // Diesel（有 ramp，跟随缺口）
        const net = S.load - (S.pv + S.wind);
        const dgCap = num('dg33n',3)*3.3 + num('dg12n',0)*1.25;
        const tgt = clamp(net, 0, Math.max(0, dgCap));
        const rup = num('rampUp',0.2)*step, rdn=num('rampDn',1.0)*step;
        S.diesel = (S.diesel < tgt) ? Math.min(tgt, S.diesel+rup) : Math.max(tgt, S.diesel-rdn);

        // BESS（放电正、充电负）
        const rest = net - S.diesel;
        const PbMax=num('PbMax',8); S.bess = clamp(-rest, -PbMax, PbMax);

        // SOC
        const Eb=num('EbMax',20);
        S.soc = clamp(S.soc + (-S.bess)*step/3600/Eb*100, 10, 95);

        // 频率（简化）
        const f0=num('f0',60), alpha=num('alphaLoad',2)/100;
        const df = (-rest)*0.02 - alpha*(S.hz - f0);
        S.hz = clamp(S.hz + df, f0-5, f0+5);

        S.t += step/3600;
        integ(step);
        cb({...S});
      }, Math.max(50, step*1000));
    },
    pause(){ if (timer) clearInterval(timer); timer=null; running=false; },
    reset(){ this.pause(); Object.assign(S,{t:0,hz:60,soc:60,pv:0,wind:0,load:12,diesel:8,bess:0});
             Object.assign(K,{ fuelUsedL:0,fuelBaselineL:0,fuelSavedL:0,renewableShare:0,pvEnergyMWh:0,windEnergyMWh:0,curtailMWh:0,n1ok:true}); },
    onTick(fn){ cb=fn; },
    getKpis(){ return {...K}; }
  };
}

function getEngine(){
  const ext = detectEngine();
  if (ext && typeof ext.createEngine === 'function') {
    logLine('✔ Private engine detected.');
    return ext.createEngine();
  }
  if (!ALLOW_SHIM) {
    logLine('❌ No private engine. Aborting (shim disabled).');
    throw new Error('Private engine missing');
  }
  logLine('⚠ Using shim engine (no private engine found).');
  return createShimEngine();
}

/* -------------------- 缓冲与绘图 -------------------- */
const buf={ t:[], pv:[], wind:[], load:[], diesel:[], bess:[], hz:[], soc:[] };
function pushBuf(s,cap=24*60*6){
  const put=(k,v)=>{ if(!Number.isFinite(v)) return; buf[k].push(v); if(buf[k].length>cap) buf[k].shift(); };
  put('t',s.t); put('pv',s.pv); put('wind',s.wind); put('load',s.load); put('diesel',s.diesel); put('bess',s.bess); put('hz',s.hz); put('soc',s.soc);
}
function dpiCanvas(c){
  const dpr = window.devicePixelRatio||1;
  c.width  = Math.max(10, c.clientWidth*dpr);
  c.height = Math.max(10, c.clientHeight*dpr);
  const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
}
function line(ctx,xs,ys,color,dash=false){
  if(xs.length<2) return;
  ctx.strokeStyle=color; ctx.lineWidth=1.6;
  ctx.setLineDash(dash?[6,4]:[]);
  ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
  for(let i=1;i<xs.length;i++) ctx.lineTo(xs[i],ys[i]);   // ★ 之前丢了 ys[i]，这里已修复
  ctx.stroke(); ctx.setLineDash([]);
}
function drawFrame(ctx,w,h){ ctx.clearRect(0,0,w,h); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,w,h); }

function drawPower(c,x0,x1){
  const ctx=c.getContext('2d'); const w=c.width, h=c.height; drawFrame(ctx,w,h);
  const idx=buf.t.map((v,i)=>(v>=x0-1e-6&&v<=x1+1e-6)?i:-1).filter(i=>i>=0);
  const series=['pv','wind','load','diesel','bess'];
  const all = series.flatMap(k=>idx.map(i=>buf[k][i])).map(v=>+v||0);
  const maxAbs = Math.max(1, ...all.map(v=>Math.abs(v)));  // 对称纵轴，便于上下对齐
  const minY = -maxAbs, maxY=maxAbs;

  const X=t=>(t-x0)/(x1-x0+1e-9)*(w-28)+14;
  const Y=v=>h-14-(v-minY)/(maxY-minY+1e-9)*(h-28);

  // 零线
  ctx.strokeStyle='#e5e7eb'; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0,Y(0)); ctx.lineTo(w,Y(0)); ctx.stroke(); ctx.setLineDash([]);

  const color={pv:COL.pv, wind:COL.wind, load:COL.load, diesel:COL.diesel, bess:COL.bess};
  series.forEach(k=>{
    const xs=[], ys=[]; idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Y(buf[k][i])); });
    line(ctx,xs,ys,color[k], (k==='wind'||k==='bess'));
  });
}

function drawFreq(c,x0,x1){
  const ctx=c.getContext('2d'); const w=c.width, h=c.height; drawFrame(ctx,w,h);
  const idx=buf.t.map((v,i)=>(v>=x0-1e-6&&v<=x1+1e-6)?i:-1).filter(i=>i>=0);
  const f0=num('f0',60), minF=59, maxF=61;

  const X=t=>(t-x0)/(x1-x0+1e-9)*(w-28)+14;
  const Yf=v=>h-14-(v-minF)/(maxF-minF+1e-9)*(h-28);
  const Ys=v=>h-14-(v-0)/(100-0+1e-9)*(h-28);

  // f0 基线
  ctx.strokeStyle=COL.grid; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(0,Yf(f0)); ctx.lineTo(w,Yf(f0)); ctx.stroke(); ctx.setLineDash([]);

  const xf=[],yf=[], xs=[],ys=[];
  idx.forEach(i=>{ xf.push(X(buf.t[i])); yf.push(Yf(buf.hz[i])); xs.push(X(buf.t[i])); ys.push(Ys(buf.soc[i])); });
  line(ctx,xf,yf,COL.freq,false);
  line(ctx,xs,ys,COL.soc,true);
}

/* -------------------- KPI（前端积分兜底） -------------------- */
const K = {
  fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
  pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true,
  _lastTh:null
};
function integK(s){     // s.t 以小时为单位
  const th = s.t; if (!Number.isFinite(th)) return;
  if (K._lastTh == null){ K._lastTh = th; return; }
  let dt = th - K._lastTh; if (!Number.isFinite(dt) || dt<=0) return;
  K._lastTh = th;

  const Ppv=Math.max(0,s.pv), Pwd=Math.max(0,s.wind), Pload=Math.max(0,s.load), Pdg=Math.max(0,s.diesel);
  const curt=Math.max(0,Ppv+Pwd-Pload);
  K.curtailMWh+=curt*dt; K.pvEnergyMWh+=Ppv*dt; K.windEnergyMWh+=Pwd*dt;
  K.fuelUsedL+=Pdg*SFC_L_PER_MWH*dt; K.fuelBaselineL+=Pload*SFC_L_PER_MWH*dt;
  K.fuelSavedL=Math.max(0, K.fuelBaselineL - K.fuelUsedL);
  const total=(K.pvEnergyMWh+K.windEnergyMWh)+(K.fuelUsedL/SFC_L_PER_MWH);
  K.renewableShare = total>1e-9 ? (K.pvEnergyMWh+K.windEnergyMWh)/total : 0;
}
function setK(id,txt){ const el=$(id); if(el) el.textContent=txt; }
function renderK(k){
  setK('kpiFuel', `${kv(k.fuelUsedL,0)} L`);
  setK('kpiFuelBase', `${kv(k.fuelBaselineL,0)} L`);
  setK('kpiFuelSave', `${kv(k.fuelSavedL,0)} L`);
  setK('kpiRE', `${kv((k.renewableShare||0)*100,1)}%`);
  setK('kpiPVgen', `${kv(k.pvEnergyMWh,2)} MWh`);
  setK('kpiWDgen', `${kv(k.windEnergyMWh,2)} MWh`);
  setK('kpiCurt', `${kv(k.curtailMWh,2)} MWh`);
  setK('kpiN1', k.n1ok===false?'Not Met':'OK');
}

/* -------------------- 主装配 -------------------- */
export function setupUI(){
  const pC=$('pPlot'), fC=$('fPlot');
  const fix=()=>{ if(pC) dpiCanvas(pC); if(fC) dpiCanvas(fC); };
  fix(); new ResizeObserver(fix).observe(pC?.parentElement ?? document.body);

  let eng;
  try { eng = getEngine(); } catch (e){ return; }

  const viewLen=$('viewHours'), viewStart=$('viewStart'), viewLabel=$('viewLabel'), follow=$('followLive');

  function sanitizeView(){
    let L=+viewLen.value; if(!Number.isFinite(L)||L<=0){ L=0.5; viewLen.value=L; }
    const tNow = buf.t.length? buf.t[buf.t.length-1]:0;
    const maxRange = Math.max(20, Math.ceil(tNow+1));
    if (+viewStart.max < maxRange) viewStart.max = String(maxRange);
    if (follow?.checked){ viewStart.value = Math.max(0, tNow - L); }
  }
  function refreshWin(){
    sanitizeView();
    const L=+viewLen.value, S=+viewStart.value;
    if (viewLabel) viewLabel.textContent=`[${kv(S,1)}, ${kv(S+L,1)}] h`;
    const kw=$('kpiWin'); if (kw) kw.textContent=viewLabel?.textContent ?? '';
    drawPower(pC,S,S+L); drawFreq(fC,S,S+L);
  }
  viewLen?.addEventListener('change', refreshWin);
  viewStart?.addEventListener('input', ()=>{ if(follow) follow.checked=false; refreshWin(); });

  $('startBtn').onclick = () => {
    const dt = Math.max(0.05, num('dt',0.5));
    if (eng.start) eng.start(dt);
    logLine(`▶ Start (dt=${dt}s)`);
  };
  $('pauseBtn').onclick = () => { eng.pause?.(); logLine('⏸ Pause'); };
  $('resetBtn').onclick = () => {
    Object.keys(buf).forEach(k=>buf[k]=[]);
    Object.assign(K,{ fuelUsedL:0,fuelBaselineL:0,fuelSavedL:0,renewableShare:0,
      pvEnergyMWh:0,windEnergyMWh:0,curtailMWh:0,n1ok:true,_lastTh:null});
    eng.reset?.(); refreshWin(); logLine('↺ Reset');
  };

  let firstTick=true;
  eng.onTick?.((s)=>{
    // s: {t(h), pv, wind, load, diesel, bess(+放电), hz, soc(% 0-100)}
    pushBuf(s);
    // KPI：无条件积分（保证不为 0）；若引擎另有 KPI，你也可以在这里改成 merge 覆盖
    integK(s);
    renderK(K);

    if (follow?.checked){
      const L=+viewLen.value||4, tNow=s.t||0;
      viewStart.value = Math.max(0, tNow - L);
    }
    refreshWin();

    const f0=num('f0',60);
    const live = $('live');
    if (live) live.textContent =
      `t=${kv(s.t,2)} h | f=${kv(s.hz,3)} Hz | Δf=${kv(s.hz-f0,3)} Hz | `+
      `PV=${kv(s.pv,2)} MW | Wind=${kv(s.wind,2)} MW | Diesel=${kv(s.diesel,2)} MW | `+
      `BESS=${kv(s.bess,2)} MW | SOC=${kv(s.soc,1)} % | Load=${kv(s.load,2)} MW`;

    if (firstTick){ logLine('Engine tick received'); firstTick=false; }
  });

  refreshWin();
  logLine('UI loaded');
}
