// src/ui.js
const $ = (id) => document.getElementById(id);
const kv = (n, d=2) => Number.isFinite(n) ? n.toFixed(d) : '0';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const COL = {
  pv:'#E69F00', wind:'#D55E00', load:'#374151',
  diesel:'#0072B2', bess:'#009E73', freq:'#6A3D9A',
  soc:'#009E73', grid:'#9ca3af'
};

// ==== 引擎适配 + shim（缺私库也能跑） ====
function detectEngine() {
  if (window.emsEngine?.createEngine) return window.emsEngine;
  if (window.createEngine) return { createEngine: window.createEngine };
  return null;
}
function createShimEngine() {
  let timer=null, cb=()=>{}, running=false;
  const S={ t:0, hz:60, soc:70, pv:0, wind:0, load:12, diesel:12, bess:0 };
  const K={ fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0,
            pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true };

  function integ(dt){
    const ren=Math.max(0,S.pv+S.wind);
    const curt=Math.max(0,ren-S.load);
    K.curtailMWh += curt*dt/3600;
    K.pvEnergyMWh += Math.max(0,S.pv)*dt/3600;
    K.windEnergyMWh+= Math.max(0,S.wind)*dt/3600;
    K.fuelUsedL    += Math.max(0,S.diesel)*220*(dt/3600);
    K.fuelBaselineL+= Math.max(0,S.load)*220*(dt/3600);
    K.fuelSavedL = Math.max(0,K.fuelBaselineL-K.fuelUsedL);
    const total = (K.pvEnergyMWh+K.windEnergyMWh)+(K.fuelUsedL/220);
    K.renewableShare = total>1e-6 ? (K.pvEnergyMWh+K.windEnergyMWh)/total : 0;
  }

  return {
    start(dt){
      if (running) return;
      running = true;
      timer = setInterval(()=>{
        const h = S.t % 24;
        const pvMax= +$('PpvMax').value || 30;
        const pvShape= +$('pvShape').value || 1.5;
        const cloud = +$('pvCloud').value || 0.35;
        const day=(h>6&&h<18)? Math.sin(Math.PI*(h-6)/12)**pvShape : 0;
        S.pv = pvMax * day * (1 - cloud*0.7);

        const wLim= +$('PwindMax').value || 6;
        const wMean= +$('windMean').value || 8;
        const wVar= +$('windVar').value || 0.4;
        S.wind = clamp((wMean/3)+Math.sin(S.t*0.6)*wVar*2 + Math.cos(S.t*0.33)*wVar,0,1)*wLim;

        const L0  = +$('Pload').value || 12;
        const Lva = +$('loadVar').value || 1.2;
        S.load = L0 + Math.sin(S.t*2*Math.PI/4)*Lva;

        const ren = Math.max(0,S.pv+S.wind);
        const net = S.load - ren;

        const dgCap = (+$('dg33n').value||0)*3.3 + (+$('dg12n').value||0)*1.25;
        const dgTarget = clamp(net, 0, Math.max(0,dgCap));
        const rate = (+$('rampUp').value||0.2) * dt;
        if (S.diesel < dgTarget) S.diesel = Math.min(dgTarget, S.diesel + rate);
        else S.diesel = Math.max(dgTarget, S.diesel - rate*1.5);

        const rest = net - S.diesel;
        const PbMax = +$('PbMax').value || 8;
        S.bess = clamp(-rest, -PbMax, PbMax); // 放电正、充电负

        const Eb= +$('EbMax').value || 20;
        S.soc = clamp(S.soc + (-S.bess)*dt/3600/Eb*100, 10, 95);

        const f0= +$('f0').value || 60;
        const alpha = (+$('alphaLoad').value||2)/100;
        const df = (-rest)*0.02 - (alpha*(S.hz - f0));
        S.hz = clamp(S.hz + df, f0-5, f0+5);

        S.t += dt/3600;
        integ(dt);
        cb({...S});
      }, Math.max(50, dt*1000));
    },
    pause(){ if (timer) clearInterval(timer); timer=null; running=false; },
    reset(){ this.pause(); Object.assign(S,{ t:0, hz:60, soc:70, pv:0, wind:0, load:12, diesel:12, bess:0 });
             Object.assign(K,{ fuelUsedL:0, fuelBaselineL:0, fuelSavedL:0, renewableShare:0, pvEnergyMWh:0, windEnergyMWh:0, curtailMWh:0, n1ok:true }); },
    onTick(fn){ cb=fn; },
    getKpis(){ return {...K}; }
  };
}
function getEngine(){
  const ext = detectEngine();
  return ext ? (ext.createEngine ? ext.createEngine() : createShimEngine()) : createShimEngine();
}

// ==== buffer & 绘图 ====
const buf={ t:[], pv:[], wind:[], load:[], diesel:[], bess:[], hz:[], soc:[] };
function pushBuf(s,cap=24*60*6){
  const push=(k,v)=>{ buf[k].push(v); if(buf[k].length>cap) buf[k].shift(); };
  push('t',s.t); push('pv',s.pv); push('wind',s.wind);
  push('load',s.load); push('diesel',s.diesel); push('bess',s.bess);
  push('hz',s.hz); push('soc',s.soc);
}

function dpiCanvas(c){
  const dpr = window.devicePixelRatio||1;
  c.width  = c.clientWidth*dpr;
  c.height = c.clientHeight*dpr;
  const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
}

function line(ctx,xs,ys,color,dash=false){
  if(xs.length<2) return;
  ctx.strokeStyle=color; ctx.lineWidth=1.6;
  ctx.setLineDash(dash?[6,4]:[]);
  ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
  for(let i=1;i<xs.length;i++) ctx.lineTo(xs[i],ys[i]);
  ctx.stroke(); ctx.setLineDash([]);
}
function drawFrame(ctx,w,h){ ctx.clearRect(0,0,w,h); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,w,h); }

function drawPower(c,x0,x1){
  const ctx=c.getContext('2d'); const w=c.width, h=c.height; drawFrame(ctx,w,h);
  const idx=buf.t.map((v,i)=>(v>=x0&&v<=x1)?i:-1).filter(i=>i>=0);
  const series=['pv','wind','load','diesel','bess'];
  const all=series.flatMap(k=>idx.map(i=>buf[k][i]));
  const minY=Math.min(0,...all), maxY=Math.max(1,...all);
  const X=t=>(t-x0)/(x1-x0)*(w-28)+14;
  const Y=v=>h-14-(v-minY)/(maxY-minY+1e-9)*(h-28);
  // zero line
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
  const idx=buf.t.map((v,i)=>(v>=x0&&v<=x1)?i:-1).filter(i=>i>=0);
  const f0= +$('f0').value||60;
  const ysF=idx.map(i=>buf.hz[i]); const minF=Math.min(f0-5,...ysF), maxF=Math.max(f0+5,...ysF);
  const X=t=>(t-x0)/(x1-x0)*(w-28)+14;
  const Yf=v=>h-14-(v-minF)/(maxF-minF+1e-9)*(h-28);
  const Ys=v=>h-14-(v-0)/(100-0)*(h-28);

  // baseline
  ctx.strokeStyle=COL.grid; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(0,Yf(f0)); ctx.lineTo(w,Yf(f0)); ctx.stroke(); ctx.setLineDash([]);

  const xf=[],yf=[]; idx.forEach(i=>{ xf.push(X(buf.t[i])); yf.push(Yf(buf.hz[i])); });
  line(ctx,xf,yf,COL.freq,false);

  const xs=[],ys=[]; idx.forEach(i=>{ xs.push(X(buf.t[i])); ys.push(Ys(buf.soc[i])); });
  line(ctx,xs,ys,COL.soc,true);
}

// ==== KPI & 日志 ====
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
function logLine(s){ const el=$('log'); const ts=new Date().toLocaleTimeString('en-CA',{hour12:false}); el.textContent = `[${ts}] ${s}\n` + el.textContent; }

// ==== 主装配 ====
export function setupUI(){
  const pC=$('pPlot'), fC=$('fPlot');
  const fix=()=>{ dpiCanvas(pC); dpiCanvas(fC); };
  fix(); new ResizeObserver(fix).observe(pC.parentElement);

  const eng=getEngine();

  const viewLen=$('viewHours'), viewStart=$('viewStart'), viewLabel=$('viewLabel'), follow=$('followLive');
  function refreshWin(){
    const L=+viewLen.value||4, S=+viewStart.value||0;
    viewLabel.textContent=`[${kv(S,1)}, ${kv(S+L,1)}] h`;
    document.getElementById('kpiWin').textContent=viewLabel.textContent;
    drawPower(pC,S,S+L); drawFreq(fC,S,S+L);
  }
  viewLen.addEventListener('change', refreshWin);
  viewStart.addEventListener('input', ()=>{ follow.checked=false; refreshWin(); });

  $('startBtn').onclick=()=>{ const dt= +$('dt').value||0.5; eng.start(dt); logLine('启动仿真'); };
  $('pauseBtn').onclick=()=>{ eng.pause(); logLine('暂停'); };
  $('resetBtn').onclick=()=>{ eng.reset(); Object.keys(buf).forEach(k=>buf[k]=[]); refreshWin(); logLine('重置'); };

  let firstTick=true;
  eng.onTick((s)=>{
    pushBuf(s);
    if (follow.checked){ const L=+viewLen.value||4; viewStart.value=Math.max(0,s.t-L); }
    refreshWin();
    $('live').textContent =
      `t=${kv(s.t,2)} h | f=${kv(s.hz,3)} Hz | Δf=${kv(s.hz-(+$('f0').value||60),3)} Hz | `+
      `PV=${kv(s.pv,2)} MW | Wind=${kv(s.wind,2)} MW | Diesel=${kv(s.diesel,2)} MW | `+
      `BESS=${kv(s.bess,2)} MW | SOC=${kv(s.soc,1)} % | Load=${kv(s.load,2)} MW`;
    if (firstTick){ logLine('Engine tick received'); firstTick=false; }
    if (typeof eng.getKpis==='function') renderK(eng.getKpis());
  });

  // 首次刷新
  refreshWin();
  logLine('UI loaded');
}
