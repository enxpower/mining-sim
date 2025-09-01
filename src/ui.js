// UI wiring: import engine from vendor, draw charts, KPIs. English comments only.

/* global window, document */
import { COLORS } from './colors.js';
import { readConfig } from './adapter.js';
import { applyText } from './i18n.js';

// Import engine module (already loaded as separate <script type="module">)
// We access via dynamic import to ensure it is parsed.
const engineMod = await import('../public/vendor/ems-engine.min.js');

export function setupUI() {
  const E = {
    start: byId('startBtn'), pause: byId('pauseBtn'), reset: byId('resetBtn'),
    simHours: byId('simHours'), viewHours: byId('viewHours'), viewStart: byId('viewStart'),
    follow: byId('followLive'), viewLabel: byId('viewLabel'),
    pCanvas: byId('pPlot'), fCanvas: byId('fPlot'),
    kFuel: byId('kpiFuel'), kFuelBase: byId('kpiFuelBase'), kFuelSave: byId('kpiFuelSave'),
    kRE: byId('kpiRE'), kPV: byId('kpiPVgen'), kWD: byId('kpiWDgen'), kCurt: byId('kpiCurt'),
    kN1: byId('kpiN1'), kWin: byId('kpiWin'), live: byId('live'), log: byId('log'),
    geoPreset: byId('geoPreset')
  };

  let eng = null, running = false, baselineFn = baselineFuelLitersPerHour;

  // Engine creation
  function create() {
    const cfg = readConfig();
    eng = engineMod.createEngine(cfg);
    applyText(); // ensure labels ok after reset
    updateViewMax();
    drawAll();
  }
  create();

  // Controls
  E.start.onclick = () => { if (!running) { running = true; loop(); } };
  E.pause.onclick = () => { running = false; };
  E.reset.onclick = () => { running = false; create(); };

  E.viewHours.addEventListener('input', onViewChange);
  E.viewStart.addEventListener('input', () => { E.follow.checked = false; onViewChange(); });
  E.follow.addEventListener('change', onViewChange);
  window.addEventListener('resize', drawAll);

  E.geoPreset.addEventListener('change', () => {
    const v = E.geoPreset.value;
    const lat = byId('latDeg'), doy = byId('doy'), soil = byId('pvSoil');
    if (v === 'arctic') { lat.value = 70; doy.value = 10; soil.value = 0.95; }
    else if (v === 'desert') { lat.value = 25; doy.value = 172; soil.value = 0.88; }
    else if (v === 'africa') { lat.value = 10; doy.value = 200; soil.value = 0.85; }
    else if (v === 'andes')  { lat.value = -20; doy.value = 250; soil.value = 0.90; }
  });

  function loop() {
    if (!running) return;
    const st = eng.getState();
    eng.step(+byId('dt').value);
    drawAll();

    // KPIs including baseline (shadow all-diesel)
    const s = eng.getState();
    const last = eng.getLastPoint();
    const dt = +byId('dt').value;
    const Lh_base = baselineFn(s, last.Pload);
    s.fuelBaselineL += Lh_base * dt / 3600;

    // Show KPIs
    E.kFuel.textContent = fmt(s.fuelL, 'L');
    E.kFuelBase.textContent = fmt(s.fuelBaselineL, 'L');
    E.kFuelSave.textContent = fmt(Math.max(0, s.fuelBaselineL - s.fuelL), 'L');
    const RE = (s.pvDir + s.windDir) / Math.max(1e-9, s.E_load) * 100;
    E.kRE.textContent = fmt(RE, '%');
    E.kPV.textContent = fmt(s.pv.genWh, 'MWh');
    E.kWD.textContent = fmt(s.wind.genWh, 'MWh');
    E.kCurt.textContent = fmt(s.curtWh, 'MWh');
    E.kN1.textContent = s.n1_ok ? 'OK' : 'Not Met';

    const { f0 } = s;
    const df = last ? (last.f - f0) : 0;
    if (last) {
      E.live.textContent =
        `t=${(last.t/3600).toFixed(2)} h | f=${last.f.toFixed(3)} Hz | Δf=${(df>=0?'+':'')}${df.toFixed(3)} Hz | `
        + `PV=${last.Ppv.toFixed(2)} MW | Wind=${last.Pwind.toFixed(2)} MW | Diesel=${last.Pdg.toFixed(2)} MW | `
        + `BESS=${last.Pb.toFixed(2)} MW | SOC=${last.soc.toFixed(1)}% | Load=${last.Pload.toFixed(2)} MW`;
    }

    requestAnimationFrame(loop);
  }

  function drawAll() { plotPower(); plotFreq(); refreshKPIOnce(); }

  function refreshKPIOnce() {
    const s = eng.getState();
    E.kFuel.textContent = fmt(s.fuelL, 'L');
    E.kFuelBase.textContent = fmt(s.fuelBaselineL, 'L');
    E.kFuelSave.textContent = fmt(Math.max(0, s.fuelBaselineL - s.fuelL), 'L');
    const RE = (s.pvDir + s.windDir) / Math.max(1e-9, s.E_load) * 100;
    E.kRE.textContent = fmt(RE, '%');
    E.kPV.textContent = fmt(s.pv.genWh, 'MWh');
    E.kWD.textContent = fmt(s.wind.genWh, 'MWh');
    E.kCurt.textContent = fmt(s.curtWh, 'MWh');
    E.kN1.textContent = s.n1_ok ? 'OK' : 'Not Met';
  }

  function currentWindow() {
    const Hsim = +E.simHours.value;
    const Hwin = Math.min(+E.viewHours.value, Hsim);
    let Hstart = +E.viewStart.value;
    if (E.follow.checked) {
      const tH = eng.getState().t / 3600;
      Hstart = clamp(tH - Hwin, 0, Math.max(0, Hsim - Hwin));
      E.viewStart.value = String(Hstart);
    }
    E.viewLabel.textContent = `[${Hstart.toFixed(1)}, ${(Hstart+Hwin).toFixed(1)}] h`;
    return { t0: Hstart * 3600, t1: (Hstart + Hwin) * 3600, Hwin };
  }

  function plotPower() {
    const s = eng.getState();
    const ctx = E.pCanvas.getContext('2d');
    adjustCanvas(E.pCanvas);
    const w = E.pCanvas.width, h = E.pCanvas.height;
    ctx.clearRect(0,0,w,h);
    const win = currentWindow();
    const seg = s.series.filter(d => d.t >= win.t0 && d.t <= win.t1);
    if (seg.length < 2) return;

    const xs = seg.map(d => 40 + ((d.t - win.t0) / (win.t1 - win.t0)) * (w - 60));
    const allP = seg.flatMap(d => [d.Ppv,d.Pwind,d.Pload,d.Pdg,d.Pb]);
    const pmin = Math.min(0, ...allP), pmax = Math.max(1, ...allP);
    const y = v => (1 - (v - pmin) / (pmax - pmin || 1)) * (h - 36) + 18;

    grid(ctx, w, h);
    zeroLine(ctx, w, y(0));

    drawLine(ctx, xs, seg.map(d => y(d.Ppv)), COLORS.pv);
    drawLine(ctx, xs, seg.map(d => y(d.Pwind)), COLORS.wind, true);
    drawLine(ctx, xs, seg.map(d => y(d.Pload)), COLORS.load);
    drawLine(ctx, xs, seg.map(d => y(d.Pdg)), COLORS.diesel);
    drawLine(ctx, xs, seg.map(d => y(d.Pb)), COLORS.bess);
    tickTime(ctx, w, h, win);
  }

  function plotFreq() {
    const s = eng.getState();
    const ctx = E.fCanvas.getContext('2d');
    adjustCanvas(E.fCanvas);
    const w = E.fCanvas.width, h = E.fCanvas.height;
    ctx.clearRect(0,0,w,h);
    const win = currentWindow();
    const seg = s.series.filter(d => d.t >= win.t0 && d.t <= win.t1);
    if (seg.length < 2) return;
    const xs = seg.map(d => 40 + ((d.t - win.t0) / (win.t1 - win.t0)) * (w - 60));

    const fVals = seg.map(d => d.f);
    let fmin = Math.min(...fVals, s.f0 - 0.8), fmax = Math.max(...fVals, s.f0 + 0.8);
    if (!isFinite(fmin) || !isFinite(fmax) || fmax - fmin < 0.1) { fmin = s.f0 - 0.8; fmax = s.f0 + 0.8; }
    const yF = v => (1 - (v - fmin) / (fmax - fmin || 1)) * (h - 36) + 18;
    const yS = v => (1 - (v - 0) / 100) * (h - 36) + 18;

    grid(ctx, w, h);
    baseLine(ctx, w, yF(s.f0));
    drawLine(ctx, xs, seg.map(d => yF(d.f)), COLORS.freq);
    drawLine(ctx, xs, seg.map(d => yS(d.soc)), COLORS.bess, true);
    tickTime(ctx, w, h, win);

    const fmaxSeg = Math.max(...fVals), fminSeg = Math.min(...fVals);
    const pbMax = Math.max(...seg.map(d => Math.abs(d.Pb)));
    E.kWin.textContent = `f∈[${fminSeg.toFixed(2)}, ${fmaxSeg.toFixed(2)}] Hz · |BESS|_max=${pbMax.toFixed(2)} MW`;
  }

  function onViewChange() { drawAll(); }
  function updateViewMax() {
    const maxStart = Math.max(0, +E.simHours.value - +E.viewHours.value);
    E.viewStart.max = String(maxStart);
  }

  // Diesel baseline approx (same model family as engine; private formula simplified)
  function baselineFuelLitersPerHour(st, Pload) {
    const units = [];
    for (let i=0;i<6;i++) units.push({cap:3.3});
    for (let i=0;i<2;i++) units.push({cap:1.25});
    const minPu = st.dg.minPu;
    if (Pload <= 0) return 0;
    units.sort((a,b)=>b.cap-a.cap);
    let chosen = [], sumCap = 0, targetPu = 0.7;
    for (const u of units) { chosen.push({cap:u.cap}); sumCap += u.cap; const per = Pload/sumCap; if (sumCap>=Pload && per<=0.9) break; }
    const n = chosen.length;
    let per = Math.max(Pload/sumCap, minPu);
    per = clamp(Math.max(per, targetPu-0.1), minPu, 0.95);
    const rho=0.84;
    function sfc(pu){ if(pu<=0)return 0; if(pu<=0.25)return 350*pu/0.25;
      if(pu<=0.5)return 300-(300-230)*((pu-0.25)/0.25);
      if(pu<=0.75)return 230-(230-205)*((pu-0.5)/0.25);
      return 205-(205-200)*((pu-0.75)/0.25); }
    let Lh=0;
    for (const x of chosen) {
      const kW = per*x.cap*1000;
      const kgph = (sfc(per)/1000)*kW;
      Lh += kgph/rho;
    }
    const supplied = chosen.reduce((a,x)=>a+per*x.cap,0);
    if (Pload>supplied) {
      const extraKW=(Pload-supplied)*1000;
      Lh += (200/1000)*extraKW / rho;
    }
    return Lh;
  }

  // Drawing helpers
  function drawLine(ctx, xs, ys, color, dashed=false) {
    ctx.beginPath();
    if (dashed) ctx.setLineDash([6,6]); else ctx.setLineDash([]);
    for (let i=0;i<xs.length;i++) { if (i===0) ctx.moveTo(xs[i], ys[i]); else ctx.lineTo(xs[i], ys[i]); }
    ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke(); ctx.setLineDash([]);
  }
  function grid(ctx,w,h){ ctx.strokeStyle='#f3f4f6'; ctx.lineWidth=1; for(let i=0;i<5;i++){ const yy=(i/4)*(h-36)+18; ctx.beginPath(); ctx.moveTo(40,yy); ctx.lineTo(w-12,yy); ctx.stroke(); } }
  function zeroLine(ctx,w,y0){ ctx.beginPath(); ctx.moveTo(40,y0); ctx.lineTo(w-12,y0); ctx.setLineDash([5,5]); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=1.2; ctx.stroke(); ctx.setLineDash([]); }
  function baseLine(ctx,w,y){ ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(w-12,y); ctx.setLineDash([]); ctx.strokeStyle='#9ca3af'; ctx.lineWidth=1; ctx.stroke(); }
  function tickTime(ctx,w,h,win){ ctx.fillStyle='#374151'; ctx.font='11px sans-serif'; const ticks=Math.max(3,Math.round(win.Hwin)); for(let k=0;k<=ticks;k++){ const tk=win.t0+(k/ticks)*(win.t1-win.t0); const x=40+(k/ticks)*(w-60); ctx.fillText(`${(tk/3600).toFixed(1)}h`, x-14, h-6);} }
  function adjustCanvas(canvas){ const DPR=window.devicePixelRatio||1; canvas.width=Math.floor(canvas.clientWidth*DPR); canvas.height=Math.floor(canvas.clientHeight*DPR); }
  function fmt(v,u){ return v.toLocaleString(undefined,{maximumFractionDigits:(Math.abs(v)<10?2:1)}) + (u?(' '+u):''); }
  function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
  function byId(id){ return document.getElementById(id); }
}
