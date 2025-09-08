// modules/loader.js —— 公库唯一入口

import { mountUI, readConfig } from './ui.js';
import { initPlots, updatePlots } from './plots.js';

const q = sel => document.querySelector(sel);
const elStart = q('#btn-start');
const elPause = q('#btn-pause');
const elReset = q('#btn-reset');
const elVersion = q('#engine-version');
const overlay = q('#overlay');
const overlayMsg = q('#overlay-msg');
const overlayLog = q('#overlay-log');

let engine = null;
let running = false;
let tickMs = 200;
let tHandle = null;
let state = { samples: [] };

function showOverlay(title, log) {
  overlay.classList.add('show');
  overlayMsg.textContent = title || '...';
  overlayLog.textContent = String(log || '');
}
function hideOverlay() { overlay.classList.remove('show'); }

function setIdle(isIdle) {
  elStart.disabled = !isIdle;
  elPause.disabled = isIdle;
}
function setButtons({ start, pause }) {
  elStart.disabled = !start;
  elPause.disabled = !pause;
}

function renderVersion(text) {
  elVersion.innerHTML = `Engine: <em>${text}</em>`;
}
function renderPanels(snap) {
  // 你页面里“Live Metrics / Engine State”的渲染可在这里补；演示先略过
}

// 🔹 读取 endpoint
async function readEndpoint() {
  const res = await fetch('./vendor/endpoint.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`endpoint.json ${res.status}`);
  const j = await res.json();
  const base = String(j.base || '').replace(/\/+$/, '');
  if (!/^https:\/\/.*/.test(base)) throw new Error('Invalid base in endpoint.json');
  return base;
}

// 🔹 动态加载引擎
async function loadEngine() {
  const base = await readEndpoint();
  const url = new URL('/v1/engine.mjs', base);
  url.searchParams.set('v', String(Date.now())); // 防缓存

  let mod;
  try {
    mod = await import(url.toString());
  } catch (e) {
    showOverlay('Engine load failed', `import: ${url}\n\n${e.stack || e}`);
    throw e;
  }

  if (!mod || typeof mod.createEngine !== 'function') {
    const keys = Object.keys(mod || {});
    throw new Error(`createEngine not found; export keys: ${keys.join(', ')}`);
  }

  let inst;
  try {
    inst = await mod.createEngine(await readConfig());
  } catch (e) {
    showOverlay('createEngine() failed', e.stack || e);
    throw e;
  }

  if (!inst || typeof inst.step !== 'function') {
    const keys = Object.keys(inst || {});
    throw new Error(`engine.step missing; engine keys: ${keys.join(', ')}`);
  }

  engine = inst;
  renderVersion('loaded');
}

// 🔹 事件：开始
async function start() {
  try {
    hideOverlay();
    if (!engine) {
      renderVersion('loading...');
      await loadEngine();
      renderVersion('ready');
    }
  } catch (e) {
    console.error(e);
    renderVersion('load-failed');
    return;
  }

  initPlots();
  setIdle(false);
  setButtons({ start: false, pause: true });
  running = true;

  const loop = async () => {
    if (!running) return;
    try {
      const snap = await engine.step(state);
      state = snap || state;
      updatePlots(state);
      renderPanels(state);
      tHandle = setTimeout(loop, tickMs);
    } catch (e) {
      console.error(e);
      showOverlay('Runtime error', e.stack || e);
      setButtons({ start: true, pause: false });
      running = false;
    }
  };
  loop();
}

function pause() {
  running = false;
  if (tHandle) clearTimeout(tHandle);
  setButtons({ start: true, pause: false });
}

function reset() {
  pause();
  state = { samples: [] };
  renderPanels(null);
  renderVersion('<em>loading...</em>');
}

// 🔹 绑定 UI
window.addEventListener('DOMContentLoaded', () => {
  mountUI();
  setIdle(true);
  renderVersion('<em>loading...</em>');

  elStart.addEventListener('click', start);
  elPause.addEventListener('click', pause);
  elReset.addEventListener('click', reset);

  // 页面加载时先探测后端
  readEndpoint()
    .then(base => fetch(new URL('/status.json', base), { cache: 'no-store' }))
    .then(r => r.ok ? r.json() : { error: r.status })
    .then(info => renderVersion(info?.version ? `v${info.version}` : 'ready'))
    .catch(e => showOverlay('Backend probe failed', e.stack || e));
});
