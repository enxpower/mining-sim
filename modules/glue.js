let raf=null, running=false;

export function run(core, plots, ui, config){
  if(running) return; running=true; ui.setIdle(false);
  const dt = Number(document.getElementById('dt').value || config.dt);
  const windowHours = Number(document.getElementById('simHours').value || config.windowHours);

  const loop = () => {
    if(!running) return;
    const snap = core.step(dt);
    // Live 行与 KPI 文本完全基于 snapshot（单一事实来源）
    const df=(snap.f-60).toFixed(3);
    ui.updateLive(
      `t=${(snap.t/3600).toFixed(2)} h | f=${snap.f.toFixed(3)} Hz | Δf=${df>=0?'+':''}${df} Hz | `+
      `PV=${snap.Ppv.toFixed(2)} | Wind=${snap.Pwind.toFixed(2)} | Diesel=${snap.Pdg.toFixed(2)} | `+
      `BESS=${snap.Pb.toFixed(2)} | SOC=${snap.soc.toFixed(1)}% | Load=${snap.Pload.toFixed(2)} MW`
    );
    ui.updateKPI(snap);
    plots.draw(snap, windowHours);
    raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
}

export function pause(){ if(!raf) return; cancelAnimationFrame(raf); raf=null; running=false; }
export function reset(core, plots, ui, config){ pause(); core.reset(); ui.setIdle(true); }
