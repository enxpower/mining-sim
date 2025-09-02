import { getEngine } from './engine-adapter.js';
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
els.start.addEventListener('click', ()=>{ running = true; tick(); });
els.pause.addEventListener('click', ()=>{ running = false; if (raf) cancelAnimationFrame(raf); });
els.step.addEventListener('click', ()=>{ stepSim(60); render(); });
els.reset.addEventListener('click', async ()=>{ running=false; if (raf) cancelAnimationFrame(raf); await createOrResetEngine(); render(true); });
els.apply.addEventListener('click', async ()=>{ running=false; if (raf) cancelAnimationFrame(raf); await createOrResetEngine(); render(true); });
els.exportCSV.addEventListener('click', ()=>{ const st = engine.getState(); exportCSV(st.series); });
els.exportPNG.addEventListener('click', ()=>{ exportPNG([cPower, cOther]); });
}


function tick(){
if (!running) return;
// Run fixed sim seconds per frame (deterministic)
const simSec = clamp(toInt(els.speed.value, 60), 1, 3600);
stepSim(simSec);
render();
raf = requestAnimationFrame(tick);
}


function stepSim(seconds){
engine.run(seconds);
}


function render(force=false){
const st = engine.getState();
const series = st.series;
if (!series.length) return;


// Avoid re-render if nothing new
if (!force && lastPointCount === series.length && st.t === lastRenderT) return;
lastPointCount = series.length; lastRenderT = st.t;


// KPIs
const last = series[series.length-1];
els.kpiF.textContent = `${last.f.toFixed(3)} Hz`;
els.kpiSOC.textContent = `${last.soc.toFixed(1)} %`;
els.kpiFuel.textContent = `${last.fuelLh.toFixed(1)}`;
els.kpiPVCurt.textContent = `${Math.max(0,last.pvCurtMW*1000|0)}`; // kW approx
els.kpiWindCurt.textContent = `${Math.max(0,last.windCurtMW*1000|0)}`;
// Diesel online count (inspect units)
const online = engine.getState().dg?.units?.filter(x=>x.online).length ?? 0;
els.kpiDG.textContent = String(online);


// Build arrays for charts
const xs = series.map(p=>p.t);
plotP.setData(xs, [
{ name:'Load', color:'#111827', values: series.map(p=>p.Pload) },
{ name:'PV', color:'#f59e0b', values: series.map(p=>p.Ppv) },
{ name:'Wind', color:'#60a5fa', values: series.map(p=>p.Pwind) },
{ name:'Diesel', color:'#ef4444', values: series.map(p=>p.Pdg) },
{ name:'BESS', color:'#10b981', values: series.map(p=>p.Pb) },
]);
plotP.draw();


plotO.setData(xs, [
{ name:'Frequency', color:'#0ea5e9', values: series.map(p=>p.f) },
{ name:'SOC %', color:'#16a34a', values: series.map(p=>p.soc) },
{ name:'Fuel L/h', color:'#7c3aed', values: series.map(p=>p.fuelLh) },
]);
plotO.draw();
}


function selMap(map){ const out={}; for (const k in map){ out[k] = document.querySelector(map[k]); } return out; }
const toNum=(v,def)=>{ const x=Number(v); return Number.isFinite(x)?x:def; };
const toInt=(v,def)=>{ const x=parseInt(v,10); return Number.isFinite(x)?x:def; };
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
