/* ===== UI-only code. Requires window.EMS from modules/core.js ===== */
(function(){
  /* ---------- i18n（与原版一致，略微精简） ---------- */
  const i18n = {
    en:{title:"Off-Grid Mining Microgrid — 35 kV",start:"▶ Start",pause:"⏸ Pause",reset:"↺ Reset",
        global:"Global",powerPlot:"Power (MW) · Window",freqPlot:"Frequency (Hz) / SOC (%) · Window",
        metrics:"Metrics & Log",leg_pv:"PV",leg_wind:"Wind",leg_load:"Load",leg_diesel:"Diesel",leg_bess:"BESS (+dis/−ch)",leg_sun:"Sunrise/Sunset",
        leg_freq:"Freq",leg_soc:"SOC",leg_f0:"f₀=60 Hz baseline",kpiFuel:"Fuel use",kpiFuelBase:"Fuel (diesel baseline)",kpiFuelSave:"Fuel saved",
        kpiRE:"Renewables share",kpiPVgen:"PV energy",kpiWDgen:"Wind energy",kpiCurt:"Curtailment (PV+Wind)",kpiN1:"N−1 check",kpiWin:"Recent window",
        followLive:"Follow live",view:"Window control (draggable)",viewHours:"Window length (hours)",viewStart:"Window start (hours)"},
    zh:{title:"离网矿区微电网 — 35 kV",start:"▶ 开始",pause:"⏸ 暂停",reset:"↺ 重置",
        global:"全局",powerPlot:"功率（MW） · 视窗",freqPlot:"频率（Hz）/ SOC（%） · 视窗",
        metrics:"指标 & 日志",leg_pv:"PV",leg_wind:"Wind",leg_load:"Load",leg_diesel:"Diesel",leg_bess:"BESS（+放/−充）",leg_sun:"日出/日落",
        leg_freq:"Freq",leg_soc:"SOC",leg_f0:"f₀=60 Hz 基线",kpiFuel:"燃油消耗",kpiFuelBase:"燃油对照（全柴油）",kpiFuelSave:"燃油节省",
        kpiRE:"可再生占比",kpiPVgen:"PV 发电量",kpiWDgen:"Wind 发电量",kpiCurt:"弃电（PV+风）",kpiN1:"N−1 校核",kpiWin:"最近窗口",
        followLive:"跟随实时",view:"视窗控制（可滑动）",viewHours:"视窗长度（小时）",viewStart:"视窗起点（小时）"}
  };
  let currentLang='en';
  function applyI18n(){
    document.documentElement.lang = currentLang==='zh'?'zh':'en';
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const k=el.getAttribute('data-i18n'); const map=i18n[currentLang];
      if(map[k]!=null) el.innerHTML = map[k];
    });
    const lb=document.getElementById('langBtn'); if(lb) lb.textContent = currentLang==='en' ? 'EN | 中文' : '中文 | EN';
  }
  const lb=document.getElementById('langBtn'); if(lb) lb.addEventListener('click',()=>{ currentLang=(currentLang==='en')?'zh':'en'; applyI18n(); });

  /* ---------- 工具 ---------- */
  const el=id=>document.getElementById(id);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const fmt=(v,u)=>v.toLocaleString(undefined,{maximumFractionDigits:(Math.abs(v)<10?2:1)})+(u?(" "+u):"");
  const COLORS={ pv:'#E69F00', wind:'#D55E00', load:'#374151', diesel:'#0072B2', bess:'#009E73', freq:'#6A3D9A' };
  function ts(t){const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60);const pad=n=>String(n).padStart(2,'0');return `[${pad(h)}:${pad(m)}:${pad(s)}]`;}

  /* ---------- DOM refs（按你原 HTML 的 id） ---------- */
  const E={
    simHours:el('simHours'), dt:el('dt'), f0:el('f0'), Dsys:el('Dsys'), alphaLoad:el('alphaLoad'),
    geoPreset:el('geoPreset'), latDeg:el('latDeg'), doy:el('doy'), pvSoil:el('pvSoil'),
    Pload:el('Pload'), loadVar:el('loadVar'),
    PpvMax:el('PpvMax'), pvShape:el('pvShape'), pvCloud:el('pvCloud'),
    PwindMax:el('PwindMax'), windMean:el('windMean'), windVar:el('windVar'),
    dg33n:el('dg33n'), dg12n:el('dg12n'), Rdg:el('Rdg'), dgMinPu:el('dgMinPu'),
    rampUp:el('rampUp'), rampDn:el('rampDn'), dgDelay:el('dgDelay'), dgHyst:el('dgHyst'), allowDieselOff:el('allowDieselOff'),
    PbMax:el('PbMax'), EbMax:el('EbMax'), soc0:el('soc0'), Rvsg:el('Rvsg'), Hvsg:el('Hvsg'), socTarget:el('socTarget'), socBand:el('socBand'),
    femg:el('femg'), overMul:el('overMul'), overSec:el('overSec'),
    rocMax:el('rocMax'), kof1:el('kof1'), kof2:el('kof2'), of1f:el('of1f'), of1t:el('of1t'), of2f:el('of2f'), of2t:el('of2t'), reclose:el('reclose'),
    startBtn:el('startBtn'), pauseBtn:el('pauseBtn'), resetBtn:el('resetBtn'),
    pPlot:el('pPlot'), fPlot:el('fPlot'), live:el('live'),
    kpiFuel:el('kpiFuel'), kpiFuelBase:el('kpiFuelBase'), kpiFuelSave:el('kpiFuelSave'),
    kpiRE:el('kpiRE'), kpiPVgen:el('kpiPVgen'), kpiWDgen:el('kpiWDgen'),
    kpiCurt:el('kpiCurt'), kpiN1:el('kpiN1'), kpiWin:el('kpiWin'),
    viewHours:el('viewHours'), viewStart:el('viewStart'), followLive:el('followLive'), viewLabel:el('viewLabel'),
    log:el('log'), pOverlay:el('pOverlay'), fOverlay:el('fOverlay')
  };
  const PCTX=E.pPlot.getContext('2d'), FCTX=E.fPlot.getContext('2d');

  /* ---------- 本地仅用于画日出点（不涉及引擎算法泄露） ---------- */
  function declination(doy){return 23.44*Math.PI/180*Math.sin(2*Math.PI*(284+doy)/365);}
  function sunTimes(latRad,doy){
    const δ=declination(doy),φ=latRad;const x=-Math.tan(φ)*Math.tan(δ);
    if(x<=-1)return{day:24,rise:0,set:24}; if(x>=1)return{day:0,rise:12,set:12};
    const ω=Math.acos(x);const day=24*ω/Math.PI;return{day,rise:12-day/2,set:12+day/2};
  }

  /* ---------- 运行态 ---------- */
  let engine=null, running=false, started=false, series=[], windowState=null;

  function readCfg(){
    return {
      simHours:+E.simHours.value, f0:+E.f0.value, Dsys:+E.Dsys.value, alphaLoad:+E.alphaLoad.value,
      latDeg:+E.latDeg.value, doy:(+E.doy.value|0), pvSoil:+E.pvSoil.value,
      Pload:+E.Pload.value, loadVar:+E.loadVar.value,
      PpvMax:+E.PpvMax.value, pvShape:+E.pvShape.value, pvCloud:+E.pvCloud.value,
      PwindMax:+E.PwindMax.value, windMean:+E.windMean.value, windVar:+E.windVar.value,
      dg33n:+E.dg33n.value, dg12n:+E.dg12n.value, Rdg:+E.Rdg.value, dgMinPu:+E.dgMinPu.value,
      rampUp:+E.rampUp.value, rampDn:+E.rampDn.value, dgDelay:+E.dgDelay.value, dgHyst:+E.dgHyst.value,
      allowDieselOff:(E.allowDieselOff && E.allowDieselOff.value==='true'),
      PbMax:+E.PbMax.value, EbMax:+E.EbMax.value, soc0:+E.soc0.value, Rvsg:+E.Rvsg.value, Hvsg:+E.Hvsg.value,
      socTarget:+E.socTarget.value, socBand:+E.socBand.value,
      femg:+E.femg.value, overMul:+E.overMul.value, overSec:+E.overSec.value,
      rocMax:+E.rocMax.value, kof1:+E.kof1.value, kof2:+E.kof2.value, of1f:+E.of1f.value, of1t:+E.of1t.value, of2f:+E.of2f.value, of2t:+E.of2t.value, reclose:+E.reclose.value
    };
  }

  function setIdleUI(isIdle){
    [E.viewHours,E.viewStart,E.followLive].forEach(elm=>elm.disabled=isIdle);
    E.viewLabel.textContent = isIdle ? "[—, —] h" : E.viewLabel.textContent;
    const DPR=window.devicePixelRatio||1;
    if(isIdle){
      E.pOverlay.style.display='flex'; E.fOverlay.style.display='flex';
      E.live.textContent='—'; E.live.classList.add('muted');
      const w1=E.pPlot.width=E.pPlot.clientWidth*DPR, h1=E.pPlot.height=E.pPlot.clientHeight*DPR; PCTX.clearRect(0,0,w1,h1);
      const w2=E.fPlot.width=E.fPlot.clientWidth*DPR, h2=E.fPlot.height=E.fPlot.clientHeight*DPR; FCTX.clearRect(0,0,w2,h2);
    }else{
      E.pOverlay.style.display='none'; E.fOverlay.style.display='none';
    }
  }

  function initState(){
    engine = EMS.createEngine(readCfg());
    engine.init();
    series=[]; E.log.textContent="[Idle] Press Start to begin simulation…"; E.log.classList.add('muted');
    const maxStart=Math.max(0,+E.simHours.value-+E.viewHours.value);
    E.viewStart.max=String(maxStart);E.viewStart.value="0";updateViewLabel();
    setIdleUI(true);
  }

  function computeWindow(){
    const Hwin=Math.min(+E.viewHours.value,+E.simHours.value);
    let Hstart=+E.viewStart.value; const Hsim=+E.simHours.value;
    const st=engine.metrics(); // 只为 t
    if(E.followLive.checked){const tH=st.t/3600; Hstart=clamp(tH-Hwin,0,Math.max(0,Hsim-Hwin)); E.viewStart.value=String(Hstart);}
    E.viewStart.max=String(Math.max(0,Hsim-Hwin));
    const ticks=Math.max(3,Math.round(Hwin));
    return {t0:Hstart*3600,t1:(Hstart+Hwin)*3600,Hwin,Hstart,ticks};
  }
  function updateViewLabel(){
    const Hwin=+E.viewHours.value,Hstart=+E.viewStart.value;
    E.viewLabel.textContent=`[${Hstart.toFixed(1)}, ${(Hstart+Hwin).toFixed(1)}] h`;
  }

  function drawSeries(ctx,w,h,xs,ys,color,dashed=false,width=2.5){
    ctx.beginPath(); if(dashed) ctx.setLineDash([6,6]); else ctx.setLineDash([]);
    for(let i=0;i<xs.length;i++){ if(i===0) ctx.moveTo(xs[i],ys[i]); else ctx.lineTo(xs[i],ys[i]); }
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke(); ctx.setLineDash([]);
  }
  function drawSunMarkers(ctx,w,h,t0,t1){
    const lat=(+E.latDeg.value||25)*Math.PI/180, doy=(+E.doy.value||172)|0;
    const {rise,set}=sunTimes(lat,doy); const sr=rise*3600, ss=set*3600;
    const sx=t=>40+((t-t0)/(t1-t0))*(w-60);
    ctx.fillStyle='#f59e0b';
    [sr,ss].forEach(t=>{ if(t>=t0&&t<=t1){const x=sx(t);ctx.beginPath();ctx.arc(x,18,4,0,Math.PI*2);ctx.fill();} });
  }

  function plotPower(ws){
    if(!started){ setIdleUI(true); return; }
    const DPR=window.devicePixelRatio||1;
    const w=E.pPlot.width=Math.floor(E.pPlot.clientWidth*DPR);
    const h=E.pPlot.height=Math.floor(E.pPlot.clientHeight*DPR);
    const ctx=PCTX; ctx.clearRect(0,0,w,h); if(series.length<2) return;
    const {t0,t1,ticks}=ws; const seg=series.filter(d=>d.t>=t0&&d.t<=t1); if(seg.length<2) return;
    setIdleUI(false);
    const xs=seg.map(d=>((d.t-t0)/(t1-t0))*(w-60)+40);
    const allP=seg.flatMap(d=>[d.Ppv,d.Pwind,d.Pload,d.Pdg,d.Pb]);
    const pmin=Math.min(0,...allP), pmax=Math.max(...allP,1);
    const y=v=>(1-(v-pmin)/(pmax-pmin||1))*(h-36)+18;
    ctx.strokeStyle='#f3f4f6'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){const yy=(i/4)*(h-36)+18; ctx.beginPath(); ctx.moveTo(40,yy); ctx.lineTo(w-12,yy); ctx.stroke();}
    const y0=y(0); ctx.beginPath(); ctx.moveTo(40,y0); ctx.lineTo(w-12,y0); ctx.setLineDash([5,5]); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=1.2; ctx.stroke(); ctx.setLineDash([]);
    const segMap=k=>seg.map(d=>y(d[k]));
    drawSeries(ctx,w,h,xs,segMap('Ppv'),COLORS.pv);
    drawSeries(ctx,w,h,xs,segMap('Pwind'),COLORS.wind,true);
    drawSeries(ctx,w,h,xs,segMap('Pload'),COLORS.load);
    drawSeries(ctx,w,h,xs,segMap('Pdg'),COLORS.diesel);
    drawSeries(ctx,w,h,xs,segMap('Pb'),COLORS.bess);
    drawSunMarkers(ctx,w,h,t0,t1);
    ctx.fillStyle='#374151'; ctx.font=`${11*DPR}px sans-serif`;
    for(let k=0;k<=ticks;k++){const tk=t0+(k/ticks)*(t1-t0),x=40+(k/ticks)*(w-60);ctx.fillText(`${(tk/3600).toFixed(1)}h`,x-14,h-6);}
  }

  function plotFreq(ws){
    if(!started){ setIdleUI(true); return; }
    const DPR=window.devicePixelRatio||1;
    const w=E.fPlot.width=Math.floor(E.fPlot.clientWidth*DPR);
    const h=E.fPlot.height=Math.floor(E.fPlot.clientHeight*DPR);
    const ctx=FCTX; ctx.clearRect(0,0,w,h); if(series.length<2) return;
    const {t0,t1,ticks}=ws; const seg=series.filter(d=>d.t>=t0&&d.t<=t1); if(seg.length<2) return;
    setIdleUI(false);
    const xs=seg.map(d=>((d.t-t0)/(t1-t0))*(w-60)+40);
    const fVals=seg.map(d=>d.f), sVals=seg.map(d=>d.soc);
    const f0=+E.f0.value||60;
    let fmin=Math.min(...fVals,f0-0.8), fmax=Math.max(...fVals,f0+0.8);
    if(!isFinite(fmin)||!isFinite(fmax)||fmax-fmin<0.1){ fmin=f0-0.8; fmax=f0+0.8; }
    const yF=v=>(1-(v-fmin)/(fmax-fmin||1))*(h-36)+18; const yS=v=>(1-(v-0)/(100-0||1))*(h-36)+18;
    ctx.strokeStyle='#f3f4f6'; ctx.lineWidth=1; for(let i=0;i<5;i++){const yy=(i/4)*(h-36)+18; ctx.beginPath(); ctx.moveTo(40,yy); ctx.lineTo(w-12,yy); ctx.stroke();}
    const y60=yF(f0); ctx.beginPath(); ctx.moveTo(40,y60); ctx.lineTo(w-12,y60); ctx.setLineDash([]); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#6b7280'; ctx.font=`${10*DPR}px sans-serif`; ctx.fillText('60 Hz', 44, y60-4);
    drawSeries(ctx,w,h,xs,fVals.map(yF),COLORS.freq);
    drawSeries(ctx,w,h,xs,sVals.map(yS),'#009E73',true);
    const last=series[series.length-1], df=last.f-f0;
    E.live.textContent=`t=${(last.t/3600).toFixed(2)} h | f=${last.f.toFixed(3)} Hz | Δf=${(df>=0?'+':'')}${df.toFixed(3)} Hz | PV=${last.Ppv.toFixed(2)} MW | Wind=${last.Pwind.toFixed(2)} MW | Diesel=${last.Pdg.toFixed(2)} MW | BESS=${last.Pb.toFixed(2)} MW | SOC=${last.soc.toFixed(1)}% | Load=${last.Pload.toFixed(2)} MW`;
    E.live.classList.remove('muted');
    ctx.fillStyle='#374151'; ctx.font=`${11*DPR}px sans-serif`;
    for(let k=0;k<=ticks;k++){const tk=t0+(k/ticks)*(t1-t0),x=40+(k/ticks)*(w-60);ctx.fillText(`${(tk/3600).toFixed(1)}h`,x-14,h-6);}
    if(seg.length>2){
      const fmaxSeg=Math.max(...seg.map(d=>d.f)); const fminSeg=Math.min(...seg.map(d=>d.f)); const pbMax=Math.max(...seg.map(d=>Math.abs(d.Pb)));
      E.kpiWin.textContent=`f∈[${fminSeg.toFixed(2)}, ${fmaxSeg.toFixed(2)}] Hz · |BESS|_max=${pbMax.toFixed(2)} MW`;
    }
  }

  function refreshKPI(){
    if(!started) return;
    const m=engine.metrics();
    E.kpiFuel.textContent=fmt(m.fuelL,"L");
    E.kpiFuelBase.textContent=fmt(m.fuelBaselineL,"L");
    E.kpiFuelSave.textContent=fmt(m.fuelSaved,"L");
    E.kpiRE.textContent=fmt(m.REshare,"%");
    E.kpiCurt.textContent=fmt(m.curtWh,"MWh");
    E.kpiN1.textContent=m.n1_ok?"OK":"Not Met";
    E.kpiPVgen.textContent=fmt(m.pvGenWh,"MWh");
    E.kpiWDgen.textContent=fmt(m.windGenWh,"MWh");
  }

  function loop(){
    if(!running) return;
    const dt=+E.dt.value;
    const s = engine.step(dt);
    series.push(s);
    windowState = computeWindow();
    plotPower(windowState);
    plotFreq(windowState);
    refreshKPI();
    const logEl=E.log; if(logEl && logEl.classList.contains('muted')){ logEl.classList.remove('muted'); }
    requestAnimationFrame(loop);
  }

  /* 交互 */
  E.startBtn?.addEventListener('click',()=>{
    if(!running){
      if(!started){ initState(); started=true; setIdleUI(false); }
      running=true; requestAnimationFrame(loop);
    }
  });
  E.pauseBtn?.addEventListener('click',()=>{ running=false; });
  E.resetBtn?.addEventListener('click',()=>{ running=false; started=false; initState(); });

  function onViewChange(){ updateViewLabel(); windowState=computeWindow(); plotPower(windowState); plotFreq(windowState); }
  E.viewHours?.addEventListener('input', onViewChange);
  E.viewStart?.addEventListener('input', ()=>{ if(E.followLive) E.followLive.checked=false; onViewChange(); });
  E.followLive?.addEventListener('change', onViewChange);
  window.addEventListener('resize', ()=>{ windowState=computeWindow(); plotPower(windowState); plotFreq(windowState); });

  /* 启动 */
  applyI18n();
  initState();
  setIdleUI(true);
})();
