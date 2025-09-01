// src/adapter.js
// Bridge between UI and engine bundle (ems-engine.min.js).
// It guarantees start/pause/reset and tick callback are always available.

const ENGINE_PATH = '../public/vendor/ems-engine.min.js';

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

export async function createAdapter(configFromUI = {}) {
  // 1) Load engine bundle
  let engineMod = null;
  try {
    engineMod = await import(`${ENGINE_PATH}?v=${Date.now()}`);
  } catch (e) {
    console.error('[adapter] failed to load engine bundle:', e);
    toast('Engine bundle failed to load. Check public/vendor/ems-engine.min.js');
    // Provide a no-op shim so UI 不至于崩
    return makeShim();
  }

  // 2) Obtain factory (兼容默认导出/命名导出两种写法)
  const factory =
    engineMod.createEngine ||
    engineMod.default?.createEngine ||
    engineMod.default ||
    null;

  if (!factory || typeof factory !== 'function') {
    console.error('[adapter] engine factory not found. Export createEngine() or default.');
    toast('Engine factory not found in bundle');
    return makeShim();
  }

  // 3) Create engine instance
  const engine = factory(configFromUI);

  // 4) Normalize interface
  const api = {
    start: () => engine.start?.(),
    pause: () => engine.pause?.(),
    reset: () => engine.reset?.(),
    onTick: (cb) => engine.onTick?.(cb),
    // 用于 UI 侧日志与 KPI
    getState: () => engine.getState?.()
  };

  // 基本健壮性
  ['start','pause','reset','onTick','getState'].forEach(k=>{
    if (typeof api[k] !== 'function' && k !== 'getState') {
      console.warn(`[adapter] engine API missing: ${k}()`);
    }
  });

  return api;
}

// --- No-op fallback (engine bundle missing) ---
function makeShim(){
  let ticking = false, timer = null;
  let tickCb = ()=>{};
  const fakeState = {
    t: 0, hz: 60, soc: 70, pv: 0, wind: 0, load: 0, diesel: 0, bess: 0
  };
  return {
    start(){
      if (ticking) return;
      ticking = true;
      timer = setInterval(()=>{
        // 生成轻微波动，UI 能看到曲线
        fakeState.t += 1;
        fakeState.hz = 60 + Math.sin(fakeState.t/7)*0.05;
        tickCb({...fakeState});
      }, 1000);
    },
    pause(){ ticking=false; clearInterval(timer); },
    reset(){ this.pause(); fakeState.t = 0; },
    onTick(cb){ tickCb = cb; },
    getState(){ return {...fakeState}; }
  };
}
