import { getEngine } from './engine-adapter.js';
import { Plot } from './plot.js';
import { exportCSV, exportPNG } from './export.js';

const els = sel({
  seed:'#inpSeed', horizon:'#inpHorizon', dt:'#inpDt', sampleEvery:'#inpSampleEvery', speed:'#inpSpeed',
  start:'#btnStart', pause:'#btnPause', step:'#btnStep', reset:'#btnReset', apply:'#btnApply',
  loadBase:'#pLoadBase', loadVar:'#pLoadVar', pvMax:'#pPvMax', pvShape:'#pPvShape', pvCloud:'#pPvCloud',
  windMax:'#pWindMax', windMean:'#pWindMean', windVar:'#pWindVar', pbMax:'#pPbMax', ebMax:'#pEbMax', soc0:'#pSoc0',
  kpiF:'#kpiF', kpiSOC:'#kpiSOC', kpiFuel:'#kpiFuel', kpiDG:'#kpiDG', kpiPVCurt:'#kpiPVCurt', kpiWindCurt:'#kpiWindCurt',
  exportCSV:'#btnExportCSV', exportPNG:'#btnExportPNG', status:'#status'
});

const cPower = document.getElementById('chartPower');
const cOther = document.getElementById('chartOther');
const plotP = new Plot(cPower, { yMin: 0 });
const plotO = new Plot(cOther, {});

let engine = null; let ns = null; let raf = null; let running = false;
let lastPointCount = 0, lastT = 0;

init().catch(err => showError(err.message || String(err)));

async function init(){
  await createOrResetEngine(true); // warmup
  wireEvents();
  render(true);
}

async function createOrResetEngine(warmup = false){
  try{
    toggleBusy(true);
    const seed = toInt(els.seed.value, 20250902);
    const overrides = getOverridesFromUI();
    const pair = await getEngine(seed, overrides);
    engine = pair.engine; ns = pair.ns;
    if (warmup) engine.run(600); // 10 min to ensure non-empty series
    statusOK(`Engine ready · points=${engine.getState().series.length}`);
  }catch(e){
    showError('Failed to load engine: ' + (e.message || e));
    throw e;
  }finally{
    toggleBusy(false);
  }
}

function getOverridesFromUI(){
  return {
    horizonHours: clamp(toNum(els.horizon.value, 24), 1, 120),
    dt: clamp(toNum(els.dt.value, 0.5), 0.05, 5),
    sampleEvery: clamp(toInt(els.sampleEvery.value, 2), 1, 20),
    PloadBase: toNum(els.loadBase.value, 12),
    PloadVar: toNum(els.loadVar.value, 2.5),
    PpvMax: toNum(els.pvMax.value, 6),
    pvShape: toNum(els.pvShape.value, 1.3),
    pvCloud: clamp(toNum(els.pvCloud.value, 0.5), 0, 1),
    PwindMax: toNum(els.windMax.value, 6),
    windMean: toNum(els.windMean.value, 9),
    windVar: clamp(toNum(els.windVar.value, 0.25), 0, 1),
    PbMax: toNum(els.pbMax.value, 8),
    EbMax: toNum(els.ebMax.value, 24),
    soc0: clamp(toInt(els.soc0.value, 60), 0, 100),
  };
}

function wireEvents(){
  els.start.addEventListener('click', ()=>{
    if (!engine) return;
    running = true; els.start.disabled = true; els.pause.disabled = false;
    tick();
  });
  els.pause.addEventListener('click', ()=>{
    running = false; els.start.disabled = false; els.pause.disabled = true;
    if (raf) cancelAnimationFrame(raf);
  });
  els.step.addEventListener('click', ()=>{
    if (!engine) return;
    engine.run(60); render(true);
  });
  els.reset.addEventListener('click', async ()=>{
    running=false; if (raf) cancelAnimationFrame(raf);
    await createOrResetEngine(true); render(true);
  });
  els.apply.addEventListener('click', async ()=>{
    running=false; if (raf) cancelAnimationFrame(raf);
    await createOrResetEngine(true); render(true);
  });
  els.exportCSV.addEventListener('click', ()=>{
    const st = engine?.getState(); if (!st?.series?.length) return showError('No data to export.');
    exportCSV(st.series);
  });
  els.exportPNG.addEventListener('click', ()=> exportPNG([cPower, cOther]));
}

function tick(){
  if (!running) return;
  const simSec = clamp(toInt(els.speed.value, 60), 1, 3600);
  engine.run(simSec);
  render();
  raf = requestAnimationFrame(tick);
}

function render(force=false){
  const st = engine.getState();
  const series = st.series || [];
  if (!series.length){ showError('Series empty. Click Start or Step.'); return; }
  if (!force && lastPointCount === series.length && lastT === st.t) return;
  lastPointCount = series.length; lastT = st.t;

  const last = series[series.length-1];
  els.kpiF.textContent = `${last.f.toFixed(3)} Hz`;
  els.kpiSOC.textContent = `${last.soc.toFixed(1)} %`;
  els.kpiFuel.textContent = `${(last.fuelLh ?? 0).toFixed(1)}`;
  els.kpiPVCurt.textContent = `${Math.max(0, Math.round((last.pvCurtMW ?? 0) * 1000))}`;
  els.kpiWindCurt.textContent = `${Math.max(0, Math.round((last.windCurtMW ?? 0) * 1000))}`;
  const online = st.dg?.units?.filter(x=>x.online).length ?? 0;
  els.kpiDG.textContent = String(online);

  const xs = series.map(p=>p.t);
  plotP.setData(xs, [
    { name:'PV',     color:'#f59e0b', values: series.map(p=>p.Ppv) },
    { name:'Wind',   color:'#60a5fa', values: series.map(p=>p.Pwind) },
    { name:'Load',   color:'#111827', values: series.map(p=>p.Pload) },
    { name:'Diesel', color:'#ef4444', values: series.map(p=>p.Pdg) },
    { name:'BESS',   color:'#10b981', values: series.map(p=>p.Pb) },
  ]);
  plotO.setData(xs, [
    { name:'Freq',  color:'#0ea5e9', values: series.map(p=>p.f) },
    { name:'SOC',   color:'#16a34a', values: series.map(p=>p.soc) },
    { name:'Fuel',  color:'#7c3aed', values: series.map(p=>p.fuelLh) },
  ]);
  statusOK(`t=${st.t.toFixed(1)}s · points=${series.length}`);
}

function toggleBusy(b){ document.body.style.cursor = b ? 'progress' : 'default'; }
function showError(msg){ els.status.textContent = msg; els.status.hidden = false; els.status.style.color = '#b91c1c'; }
function statusOK(msg){ els.status.textContent = msg; els.status.hidden = false; els.status.style.color = '#0f766e'; }
function sel(map){ const out={}; for (const k in map) out[k]=document.querySelector(map[k]); return out; }
const toNum=(v,def)=>{ const x=Number(v); return Number.isFinite(x)?x:def; };
const toInt=(v,def)=>{ const x=parseInt(v,10); return Number.isFinite(x)?x:def; };
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
