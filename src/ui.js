// src/ui.js —— 严格私库 + 稳健绘图 + KPI前端积分版
const $ = (id) => document.getElementById(id);
const kv = (n, d = 2) => Number.isFinite(+n) ? (+n).toFixed(d) : '0';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const STRICT_ENGINE = true;          // 必须使用私库；缺失直接报错
const SFC_L_PER_MWH = 220;           // 柴油比油耗（L/MWh，可按机组修正）

const COL = {
  pv:'#E69F00', wind:'#D55E00', load:'#374151',
  diesel:'#0072B2', bess:'#009E73', freq:'#6A3D9A',
  soc:'#009E73', grid:'#9ca3af'
};

// ---------- 安全取值 ----------
const num = (id, def = 0) => {
  const el = $(id); if (!el) return def;
  const n = +el.value; return Number.isFinite(n) ? n : def;
};
const boolFromStr = (id, def = false) => {
  const el = $(id); if (!el) return def;
  const s = String(el.value ?? '').toLowerCase();
  if (s==='true') return true; if (s==='false') return false;
  if ('checked' in el) return !!el.checked; return def;
};

// ---------- UI 日志 ----------
function logLine(s){
  const el=$('log');
  const ts=new Date().toLocaleTimeString('en-CA',{hour12:false});
  if (el) el.textContent = `[${ts}] ${s}\n` + el.textContent;
  console.log(`[UI] ${s}`);
}

// ---------- 强制私库引擎 ----------
function ensurePrivateEngine(){
  const ok = !!(window.emsEngine?.createEngine);
  if (!ok && STRICT_ENGINE){
    logLine('❌ 未检测到私库引擎 window.emsEngine.createEngine；请确认 public/vendor/ems-engine.min.js 加载成功');
    const live = $('live'); if (live) live.textContent = 'ENGINE MISSING';
    throw new Error('Private EMS engine missing');
  }
  return ok ? window.emsEngine : null;
}

// ---------- 配置（与引擎契约一致） ----------
function readCfgFromUI(){
  return {
    // 系统与负荷
    f0: num('f0', 60),
    D: num('Dsys', 2.2),
    alphaLoad: num('alphaLoad', 2)/100,
    PloadBase: num('Pload', 12),
    PloadVar: num('loadVar', 1.2),

    // PV
    PpvMax: num('PpvMax', 24),
    pvShape: num('pvShape', 1.5),
    pvCloud: num('pvCloud', 0.35),
    latDeg: num('lat', 25),
    dayOfYear: num('doy', 172),
    pvSoiling: num('pvSoil', 0.9),

    // 风电
    wind: {
      Pmax:  num('PwindMax', 6),
      vmean: num('windMean', 8),
      vvar:  num('windVar', 0.4),
    },

    // 柴油（单位修正）
    dg: {
      allowOff: boolFromStr('allowDieselOff', true),
      Rdg:      num('Rdg', 4)/100,     // % → pu
      rampUp:   num('rampUp', 0.2),
      rampDn:   num('rampDn', 1.0),
      delay:    num('dgDelay', 600),
      hyst:     num('dgHyst', 1.5),
      n33:      num('dg33n', 4),
      n12:      num('dg12n', 1),
      minPu:    num('dgMinPu', 0.35),
    },

    // 储能
    bess: {
      Pmax:      num('PbMax', 8),
      Emax:      num('EbMax', 20),
      soc0:      num('soc0', 60)/100,
      R:         num('Rvsg', 3)/100,
      Hv:        num('Hvsg', 6.0),
      socTarget: num('socTarget', 55)/100,
      socBand:   num('socBand', 10)/100,
      femg:      num('femg', 0.2),
      overMul:   num('overMul', 1.4),
      overSec:   num('overSec', 8),
    },

    // 保护
    rocMax: num('rocMax', 0.9),
    kof1:   num('kof1', 1.2),
    kof2:   num('kof2', 2.0),
    of1f:   num('of1f', 60.5),
    of1t:   num('of1t', 10),
    of2f:   num('of2f', 61.0),
    of2t:   num('of2t', 0.2),
    reclose: 30,
  };
}

// ---------- 引擎包装（稳健 tick） ----------
function getEngine(){
  const ext = ensurePrivateEngine();           // 未加载会抛错
  const createFn = ext.createEngine;
  let core = createFn(readCfgFromUI());

  let timer=null, running=false, cb=()=>{};
  let badCount = 0;

  function tick(dt){
    try{ core.step?.(dt); }catch(err){ logLine(`❌ core.step 异常：${err?.message||err}`); throw err; }
    let p={}; try{ p = core.getLastPoint?.() || {}; }catch(err){ logLine(`❌ getLastPoint 异常：${err?.message||err}`); throw err; }

    const f = +p.f, t = +p.t;
    if (!Number.isFinite(f) || !Number.isFinite(t)){
      if (++badCount >= 30){ logLine('❌ 连续 30 次无效采样，自动暂停'); api.pause(); }
      return;
    }
    badCount=0;

    const bessUI = -(+p.Pb || 0); // 引擎多为+充电；UI约定+放电/−充电
    let socVal = +p.soc; if (Number.isFinite(socVal) && socVal <= 1.0001) socVal *= 100;

    const s = {
      t: (t||0)/3600, pv:+p.Ppv||0, wind:+p.Pwind||0, load:+p.Pload||0,
      diesel:+p.Pdg||0, bess:bessUI, hz:f||num('f0',60),
      soc: Number.isFinite(socVal) ? socVal : 60
    };
    cb(s);
  }

  const api = {
    start(){
      if (running) return;
      let useDt = num('dt', 0.5);
      if (!Number.isFinite(useDt) || useDt <= 0) useDt = 0.5;
      useDt = Math.max(0.05, useDt);

      try{ core = createFn(readCfgFromUI()); }
      catch(err){ logLine(`❌ createEngine 失败：${err?.message||err}`); throw err; }

      running = true;
      const follow = $('followLive'); if (follow) follow.checked = true;
      timer = setInterval(()=>tick(useDt), Math.max(50, useDt*1000));
      logLine(`✅ 引擎开始运行（dt=${useDt}s，STRICT_ENGINE=on）`);
    },
    pause(){ if (timer) clearInterval(timer); timer=null; running=false; },
    reset(){ this.pause(); try{ core = createFn(readCfgFromUI()); }catch{}; logLine('↺ 引擎已重置'); },
    onTick(fn){ cb=fn; },
    getKpis(){ return core.getKpis?.() || {}; }
  };
  return api;
}

// ---------- 绘图缓冲 ----------
const buf={ t:[], pv:[], wind:[], load:[], diesel:[], bess:[], hz:[], soc:[] };
function pushBuf(s,cap=24*60*6){
  const push=(k,v)=>{ if(!Number.isFinite(v)) return; buf[k].push(v); if(buf[k].length>cap) buf[k].shift(); };
  push('t',s.t); push('pv',s.pv); push('wind',s.wind);
  push('load',s.load); push('diesel',s.diesel); push('bess',s.bess);
  push('hz',s.hz); push('soc',s.soc);
}

// ---------- KPI：前端积分器（引擎无KPI时使用） ----------
const K = {
  fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
  pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true,
  _lastTh:null
};
function integK(s){
  const th = s.t;
  if (!Number.isFinite(th)) return;
  if (K._lastTh == null){ K._lastTh = th; return; }
  let dt = th - K._lastTh; if (!Number.isFinite(dt) || dt<=0) return;
  K._lastTh = th;

  const Ppv = Math.max(0, s.pv), Pwd = Math.max(0, s.wind);
  const Pload = Math.max(0, s.load), Pdg = Math.max(0, s.diesel);
  const ren = Ppv + Pwd;
  const curt = Math.max(0, ren - Pload);
  K.curtailMWh    += curt * dt;
  K.pvEnergyMWh   += Ppv  * dt;
  K.windEnergyMWh += Pwd  * dt;

  K.fuelUsedL     += Pdg   * SFC_L_PER_MWH * dt;
  K.fuelBaselineL += Pload * SFC_L_PER_MWH * dt;
  K.fuelSavedL     = Math.max(0, K.fuelBaselineL - K.fuelUsedL);

  const totalMWh = (K.pvEnergyMWh + K.windEnergyMWh) + (K.fuelUsedL / SFC_L_PER_MWH);
  K.renewableShare = totalMWh > 1e-9 ? (K.pvEnergyMWh + K.windEnergyMWh) / totalMWh : 0;
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

// ---------- 画布 ----------
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
  for(let i=1;i<xs.length;i++) ctx.lineTo(xs[i]);
  ctx.stroke(); ctx.setLineDash([]);
}
function drawFrame(ctx,w,h){ ctx.clearRect(0,0,w,h); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,w,h); }

function drawPower(c,x0,x1){
  const ctx=c.getContext('2d'); const w=c.width, h=c.height; drawFrame(ctx,w,h);
  const eps=1e-6;
  const idx=buf.t.map((v,i)=>(v>=x0-eps&&v<=x1+eps)?i:-1).filter(i=>i>=0);
  const series=['pv','wind','load','diesel','bess'];

  // 对称范围（也可固定：const minY=-10, maxY=30）
  const all=series.flatMap(k=>idx.map(i=>buf[k][i])).map(v=>+v||0);
  const maxAbs=Math.max(1, ...all.map(v=>Math.abs(v)));
  const minY=-maxAbs, maxY=maxAbs;

  const X=t=>(t-x0)/(x1-x0+1e-9)*(w-28)+14;
  const Y=v=>h-14-(v-minY)/(maxY-minY+1e-9)*(h-28);

  ctx.strokeStyle='#e5e7eb'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,Y(0)); ctx.lineTo(w,Y(0)); ctx.stroke(); ctx.setLineDash([]);

  const color={pv:COL.pv, wind:COL.wind, load:COL.load, diesel:COL.diesel, bess:COL.bess};
  series.forEach(k=>{
    const xs=[], ys=[];
    idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Y(buf[k][i])); });
    line(ctx,xs,ys,color[k], (k==='wind'||k==='bess'));
  });
}

function drawFreq(c,x0,x1){
  const ctx=c.getContext('2d'); const w=c.width,h=c.height; drawFrame(ctx,w,h);
  const eps=1e-6;
  const idx=buf.t.map((v,i)=>(v>=x0-eps&&v<=x1+eps)?i:-1).filter(i=>i>=0);
  const f0 = num('f0',60);
  const minF = 59, maxF = 61;
  const X=t=>(t-x0)/(x1-x0+1e-9)*(w-28)+14;
  const Yf=v=>h-14-(v-minF)/(maxF-minF+1e-9)*(h-28);
  const Ys=v=>h-14-(v-0)/(100-0+1e-9)*(h-28);

  ctx.strokeStyle=COL.grid; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,Yf(f0)); ctx.lineTo(w,Yf(f0)); ctx.stroke(); ctx.setLineDash([]);

  const xf=[],yf=[]; idx.forEach(i=>{ xf.push(X(buf.t[i])); yf.push(Yf(buf.hz[i])); });
  line(ctx,xf,yf,COL.freq,false);

  const xs=[],ys=[]; idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Ys(buf.soc[i])); });
  line(ctx,xs,ys,COL.soc,true);
}

// ---------- 主装配 ----------
export function setupUI(){
  const pC=$('pPlot'), fC=$('fPlot');
  const fix=()=>{ dpiCanvas(pC); dpiCanvas(fC); };
  fix(); new ResizeObserver(fix).observe(pC?.parentElement ?? document.body);

  let eng;
  try{ eng = getEngine(); }
  catch(e){ return; }

  const viewLen=$('viewHours'), viewStart=$('viewStart'), viewLabel=$('viewLabel'), follow=$('followLive');

  function sanitizeView(){
    let L = +viewLen.value; if (!Number.isFinite(L) || L <= 0) { L = 0.5; viewLen.value = L; }
    const tNow = buf.t.length ? buf.t[buf.t.length-1] : 0;
    const targetMax = Math.max(20, Math.ceil(tNow + 1));
    if (+viewStart.max < targetMax) viewStart.max = String(targetMax);
    if (follow?.checked){
      const s = Math.max(0, tNow - L);
      viewStart.value = s;
    }
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

  $('startBtn').onclick=()=>{ eng.start(); logLine('▶ 启动仿真'); };
  $('pauseBtn').onclick=()=>{ eng.pause(); logLine('⏸ 暂停'); };
  $('resetBtn').onclick=()=>{ Object.keys(buf).forEach(k=>buf[k]=[]); Object.assign(K,{fuelUsedL:0,fuelBaselineL:0,fuelSavedL:0,renewableShare:0,pvEnergyMWh:0,windEnergyMWh:0,curtailMWh:0,n1ok:true,_lastTh:null}); eng.reset(); refreshWin(); logLine('↺ 重置'); };

  let firstTick=true;
  eng.onTick((s)=>{
    pushBuf(s);
    refreshWin();

    // KPI：优先用引擎；若无/全零，则前端积分
    const kFromEngine = eng.getKpis?.() || {};
    const allZero = !kFromEngine || Object.values(kFromEngine).every(v => !Number.isFinite(+v) || +v===0);
    if (allZero) integK(s); // 自己积
    renderK(allZero ? K : kFromEngine);

    $('live').textContent =
      `t=${kv(s.t,2)} h | f=${kv(s.hz,3)} Hz | Δf=${kv(s.hz-num('f0',60),3)} Hz | `+
      `PV=${kv(s.pv,2)} MW | Wind=${kv(s.wind,2)} MW | Diesel=${kv(s.diesel,2)} MW | `+
      `BESS=${kv(s.bess,2)} MW | SOC=${kv(s.soc,1)} % | Load=${kv(s.load,2)} MW`;
    if (firstTick){ logLine('Engine tick received'); firstTick=false; }
  });

  refreshWin();
  logLine('UI loaded (STRICT_ENGINE on, KPI integrator active)');
}
