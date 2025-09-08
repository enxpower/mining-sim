// modules/loader.js —— 公库唯一入口（完整替换版）
import { mountUI, readConfig }   from './ui.js';
import { initPlots, updatePlots } from './plots.js';

/* ---------- 简易 DOM 绑定 ---------- */
const q = (sel) => document.querySelector(sel);

const elStart   = q('#btn-start');
const elPause   = q('#btn-pause');
const elReset   = q('#btn-reset');
const elVersion = q('#engine-version');

const overlay    = q('#overlay');
const overlayMsg = q('#overlay-msg');
const overlayLog = q('#overlay-log');

/* ---------- 运行态 ---------- */
let engine = null;      // 由 createEngine() 产生
let running = false;
let tickMs = 200;
let tHandle = null;

/* 可选：用于渲染“Live Metrics / Engine State”的快照缓存 */
let state = { samples: [] };

/* ---------- UI/Overlay ---------- */
function showOverlay(title, log) {
  overlay.classList.add('show');
  overlayMsg.textContent = title || '...';
  overlayLog.textContent = String(log || '');
}
function hideOverlay() {
  overlay.classList.remove('show');
}
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

/* 可选：把快照里的摘要渲染到页面底部两个“kv”框（如果你在 ui.js 里留了挂点，也可以在那里处理） */
function renderPanels(snap) {
  state = snap; // 直接覆盖，或自行做裁剪
}

/* ---------- 读取后端地址 & 加载引擎（关键修复） ---------- */
async function getBase() {
  const res = await fetch('./vendor/endpoint.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`read endpoint.json failed: ${res.status}`);
  const { base } = await res.json();
  if (!base) throw new Error('endpoint.json missing "base"');
  return String(base).replace(/\/+$/, ''); // 去尾部 /
}

async function loadEngine() {
  const base = await getBase();

  // 1) 获取版本信息，显示在右上角
  try {
    const s = await fetch(`${base}/status.json`, { cache: 'no-store' }).then(r => r.json());
    renderVersion(`${s.version || 'unknown'} @ ${new Date(s.time || Date.now()).toLocaleString()}`);
  } catch (e) {
    renderVersion('unknown');
    console.warn('status.json fetch failed:', e);
  }

  // 2) 动态 import ESM 模块，并**按导出签名**调用 createEngine() —— 这是修复点
  try {
    const mod = await import(/* @vite-ignore */`${base}/v1/engine.mjs`);
    if (!mod || typeof mod.createEngine !== 'function') {
      throw new Error('engine ESM missing export: createEngine()');
    }
    // 传入当前 UI 配置（如果引擎不需要，可忽略）
    const cfg = readConfig ? readConfig() : {};
    engine = mod.createEngine(cfg);
  } catch (e) {
    throw new Error(`Failed to import engine: ${e.message || e}`);
  }
}

/* ---------- 主循环 ---------- */
function loop() {
  if (!engine) return;

  try {
    // 引擎推进一步并取快照
    engine.step();
    const snap = engine.getState();

    // 画图 & 面板
    updatePlots(snap);
    renderPanels(snap);
  } catch (e) {
    running = false;
    clearInterval(tHandle);
    tHandle = null;
    setIdle(true);
    showOverlay('Runtime error', e.stack || String(e));
    console.error(e);
  }
}

/* ---------- 入口按钮逻辑 ---------- */
async function start() {
  if (running) return;
  setButtons({ start: false, pause: true });

  try {
    hideOverlay();

    // 初始化表单/画布（幂等即可）
    mountUI && mountUI();
    initPlots && initPlots();

    // 若尚未加载引擎，先加载
    if (!engine) {
      showOverlay('Loading engine…');
      await loadEngine();
      hideOverlay();
    }

    // 读一遍最新配置，有需要可重建引擎（你的引擎若支持热更新也可改为 setConfig）
    const cfg = readConfig ? readConfig() : null;
    if (cfg && engine && typeof engine.setConfig === 'function') {
      engine.setConfig(cfg);
    }

    running = true;
    setIdle(false);
    tHandle = setInterval(loop, tickMs);
  } catch (e) {
    running = false;
    setIdle(true);
    showOverlay('Engine load failed', e.stack || String(e));
    console.error(e);
  }
}

function pause() {
  if (!running) return;
  running = false;
  if (tHandle) clearInterval(tHandle);
  tHandle = null;
  setIdle(true);
}

async function reset() {
  // 停止循环
  if (tHandle) clearInterval(tHandle);
  running = false;
  tHandle = null;
  setIdle(true);

  // 重新实例化引擎（保持与“开始”一致）
  try {
    const base = await getBase();
    const mod  = await import(/* @vite-ignore */`${base}/v1/engine.mjs`);
    const cfg  = readConfig ? readConfig() : {};
    engine     = mod.createEngine(cfg);

    // 清空并重画
    initPlots && initPlots();
    renderPanels(engine.getState());
    hideOverlay();
  } catch (e) {
    showOverlay('Reset failed', e.stack || String(e));
  }
}

/* ---------- 事件绑定 ---------- */
elStart?.addEventListener('click', start);
elPause?.addEventListener('click', pause);
elReset?.addEventListener('click', reset);

/* 初始 UI 状态 */
setIdle(true);
renderVersion('<em>loading…</em>');
