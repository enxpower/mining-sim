let els={}, handlers={};

export function mount(){
  els = {
    start: document.getElementById('btnStart'),
    pause: document.getElementById('btnPause'),
    reset: document.getElementById('btnReset'),
    live:  document.getElementById('live'),
    log:   document.getElementById('log'),
    pOverlay: document.getElementById('pOverlay'),
    fOverlay: document.getElementById('fOverlay'),
    kpi: {
      fuel: 'kpiFuel', fuelBase:'kpiFuelBase', fuelSave:'kpiFuelSave',
      re:'kpiRE', pv:'kpiPVgen', wd:'kpiWDgen', curt:'kpiCurt', n1:'kpiN1', win:'kpiWin'
    }
  };
  els.start.onclick = () => handlers.start && handlers.start();
  els.pause.onclick = () => handlers.pause && handlers.pause();
  els.reset.onclick = () => handlers.reset && handlers.reset();
}

export function onStart(fn){ handlers.start=fn; }
export function onPause(fn){ handlers.pause=fn; }
export function onReset(fn){ handlers.reset=fn; }

export function setIdle(isIdle){
  [els.pOverlay, els.fOverlay].forEach(x=> x.style.display = isIdle?'flex':'none');
  if(isIdle){ els.live.textContent='—'; els.log.textContent='[Idle] Press Start…'; els.log.classList.add('muted'); }
  else { els.log.classList.remove('muted'); }
}

export function updateLive(text){ els.live.textContent=text; }
export function logLine(s){ els.log.textContent += s+'\n'; els.log.scrollTop=els.log.scrollHeight; }

export function updateKPI(snapshot){
  const q = (id)=>document.getElementById(id);
  const fmt=(v,u)=>v.toLocaleString(undefined,{maximumFractionDigits:(Math.abs(v)<10?2:1)})+(u?(" "+u):"");
  const k = snapshot.kpi;
  q(els.kpi.fuel).textContent=fmt(k.fuelL,'L');
  q(els.kpi.fuelBase).textContent=fmt(k.fuelBase,'L');
  q(els.kpi.fuelSave).textContent=fmt(Math.max(0,k.fuelBase-k.fuelL),'L');
  const RE = k.pvDir + k.windDir;
  q(els.kpi.re).textContent=fmt(k.Eload>0?100*RE/k.Eload:0,'%');
  q(els.kpi.pv).textContent=fmt(k.pvWh,'MWh');
  q(els.kpi.wd).textContent=fmt(k.windWh,'MWh');
  q(els.kpi.curt).textContent=fmt(k.curtWh,'MWh');
  q(els.kpi.n1).textContent=k.n1?'OK':'Not Met';
  q(els.kpi.win).textContent=`t=${(snapshot.t/3600).toFixed(2)} h`;
}
