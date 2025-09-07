// modules/loader.js
// Glue：读 endpoint、初始化 UI、绑定按钮、驱动绘图 & 状态面板
import { mountConfig, readConfig } from './ui.js';
import { initPlots, updatePlots, setIdle } from './plots.js';

const OVL = {
  root: document.getElementById('overlay'),
  msg: document.getElementById('overlay-msg'),
  log: document.getElementById('overlay-log'),
};
const E = {
  ver: document.getElementById('engine-version'),
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnReset: document.getElementById('btn-reset'),
  liveMetrics: document.getElementById('live-metrics'),
  liveState: document.getElementById('live-state'),
};

let running = false;
let tHandle = null;
let engine = null;        // 从私库 Worker 暴露的 ESM 模块
let state = null;         // 引擎内部状态（由私库实现）
let tickMs = 200;         // 前端刷新节拍
let endpointBase = null;  // /vendor/endpoint.json 里的 base

function showOverlay(text, extra) {
  if (!OVL.root) return;
  OVL.root.classList.add('show');
  if (OVL.msg) OVL.msg.textContent = text || '';
  if (OVL.log && extra) OVL.log.textContent = String(extra);
}
function hideOverlay() {
  if (!OVL.root) return;
  OVL.root.classList.remove('show');
  if (OVL.msg) OVL.msg.textContent = '';
  if (OVL.log) OVL.log.textContent = '';
}

async function fetchEndpoint() {
  const res = await fetch('./vendor/endpoint.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`endpoint.json ${res.status}`);
  const j = await res.json();
  if (!j.base) throw new Error('endpoint.json missing "base"');
  endpointBase = j.base.replace(/\/+$/, '');
  return endpointBase;
}

async function loadEngine() {
  // 私库 Worker 提供的模块入口统一：/v1/engine.mjs
  // 允许 CORS：Worker 端需设置 ALLOWED_ORIGIN 为你的 Pages 域名
  const url = `${endpointBase}/v1/engine.mjs`;
  try {
    const m = await import(/* @vite-ignore */ url);
    if (!m || typeof m.createEngine !== 'function') {
      throw new Error('engine.mjs missing createEngine()');
    }
    return m;
  } catch (e) {
    throw new Error(`Failed to import engine: ${url}\n${e?.message || e}`);
  }
}

function setButtons({ start, pause }) {
  if (E.btnStart) E.btnStart.disabled = !start;
  if (E.btnPause) E.btnPause.disabled = !pause;
}

function renderVersion(v) {
  if (!E.ver) return;
  const text = v ? `Engine: ${v}` : 'Engine: loading...';
  E.ver.innerHTML = text;
}

function fmt(n, unit) {
  if (n==null || Number.isNaN(n)) return '—';
  const s = n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n)<10?2:1 });
  return unit ? `${s} ${unit}` : s;
}

function renderPanels(s) {
  if (E.liveState) {
    E.liveState.textContent = JSON.stringify({
      t_s: s?.t_s, scenario: s?.scenario, flags: s?.flags,
    }, null, 2);
  }
  if (E.liveMetrics) {
    E.liveMetrics.textContent = [
      `p_load_kW : ${fmt(s?.kW?.load, 'kW')}`,
      `p_pv_kW  : ${fmt(s?.kW?.pv, 'kW')}`,
      `p_wind_kW: ${fmt(s?.kW?.wind, 'kW')}`,
      `p_diesel_kW: ${fmt(s?.kW?.diesel, 'kW')}`,
      `p_bess_kW: ${fmt(s?.kW?.bess, 'kW')}`,
      `fuel_lph : ${fmt(s?.fuel?.lph, 'L/h')}`,
      `fuel_cum : ${fmt(s?.fuel?.cum_l, 'L')}`,
      `soc      : ${fmt(s?.bess?.soc*100, '%')}`,
    ].join('  ');
  }
}

async function start() {
  if (!engine) {
    showOverlay('Loading engine…');
    try {
      await fetchEndpoint();
      engine = await loadEngine();
      hideOverlay();
    } catch (e) {
      showOverlay('Engine load failed', e?.stack || e);
      console.error(e);
      return;
    }
  }

  // 读取表单为场景参数（公库 UI -> 私库引擎）
  const scenario = readConfig();
  try {
    // 私库必须实现 createEngine(scenario)
    state = await engine.createEngine(scenario);
    renderVersion(state?.version || '(unknown)');
  } catch (e) {
    showOverlay('createEngine() failed', e?.stack || e);
    console.error(e);
    return;
  }

  // 启动画图
  initPlots();
  setIdle(false);
  setButtons({ start:false, pause:true });
  running = true;

  const loop = async () => {
    if (!running) return;
    try {
      // 私库必须实现 step(state)
      const snap = await engine.step(state);
      updatePlots(snap);
      renderPanels(snap);
      tHandle = setTimeout(loop, tickMs);
    } catch (e) {
      console.error(e);
      showOverlay('Runtime error', e?.stack || e);
      setButtons({ start:true, pause:false });
      running = false;
    }
  };
  loop();
}

function pause() {
  running = false;
  if (tHandle) clearTimeout(tHandle);
  setButtons({ start:true, pause:false });
}

function reset() {
  pause();
  setIdle(true);
  renderPanels(null);
  renderVersion(null);
}

function safeBind(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
}

function boot() {
  // 装表单
  mountConfig(document.getElementById('config-form'));
  // 绑按钮
  safeBind(E.btnStart, 'click', start);
  safeBind(E.btnPause, 'click', pause);
  safeBind(E.btnReset, 'click', reset);
  // 初始空闲态
  setIdle(true);
  setButtons({ start:true, pause:false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// 便于你在控制台自检
window.__sim = {
  ping() { return { ok: true, endpointBase }; },
  pause, reset,
};
