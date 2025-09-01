// src/adapter.js
// Bridge between UI and engine bundle (ems-engine.min.js).
// Provides start/pause/reset/onTick/getState and a safe shim when bundle fails.

const ENGINE_PATH = '../public/vendor/ems-engine.min.js';

function toast(msg){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1500);
}

export async function createAdapter(config = {}){
  let engineMod = null;
  try {
    // bust cache each load
    engineMod = await import(`${ENGINE_PATH}?v=${Date.now()}`);
  } catch (e) {
    console.error('[adapter] bundle load failed:', e);
    toast('Engine bundle not found, using demo shim');
    return shim();
  }

  const factory =
    engineMod.createEngine ||
    engineMod.default?.createEngine ||
    engineMod.default ||
    null;

  if (!factory || typeof factory !== 'function'){
    console.error('[adapter] engine factory createEngine() missing.');
    toast('Engine factory missing, using demo shim');
    return shim();
  }

  const engine = factory(config);
  const api = {
    start: () => engine.start?.(),
    pause: () => engine.pause?.(),
    reset: () => engine.reset?.(),
    onTick: (cb) => engine.onTick?.(cb),
    getState: () => engine.getState?.()
  };
  return api;
}

// --- fallback shim so UI still works visually ---
function shim(){
  let ticking = false, timer=null;
  let tickCb = ()=>{};
  const S = { t:0, hz:60, soc:70, pv:0, wind:0, load:12, diesel:12, bess:0 };
  return {
    start(){
      if (ticking) return;
      ticking = true;
      timer = setInterval(()=>{
        S.t += 1/12; // 5s → 0.083h；这里用 0.083h/秒只是演示
        // 生成近似工况：风、负载波动、BESS 对频率的支撑
        S.load = 12 + Math.sin(S.t*2*Math.PI/4)*1.2;       // 4h 周期
        S.pv = Math.max(0, 24*Math.sin(Math.PI*(S.t%24)/24)); // 白天有 PV
        S.wind = 3 + Math.sin(S.t*3)*0.7 + Math.cos(S.t*1.3)*0.5;
        const renewable = Math.max(0, S.pv + S.wind);
        const net = S.load - renewable;
        // 简化：柴油承担净负荷的一部分，BESS 缓冲剩余（充负号/放正号）
        S.diesel = Math.max(0, Math.min(10, net*0.8));
        const rest = net - S.diesel;
        S.bess = -rest; // 放电正值、充电负值
        S.soc = Math.max(15, Math.min(95, S.soc + (-rest)*0.05));
        S.hz = 60 + ( -rest ) * 0.02 + Math.sin(S.t*4)*0.02;
        tickCb(structuredClone(S));
      }, 1000);
    },
    pause(){ ticking=false; clearInterval(timer); },
    reset(){ this.pause(); S.t=0; S.soc=70; },
    onTick(cb){ tickCb = cb; },
    getState(){ return structuredClone(S); }
  };
}