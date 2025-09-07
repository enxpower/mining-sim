/* modules/loader.js — DOM 安全启动、读取 endpoint、导出引导对象 */

import { mountPowerPlotById, mountFreqSocPlotById } from './plots.js';

function showOverlay(msg, detail = '') {
  const ovl = document.getElementById('overlay');
  const m   = document.getElementById('overlay-msg');
  const log = document.getElementById('overlay-log');
  if (!ovl) return;
  ovl.classList.add('show');
  if (m)   m.textContent = msg || '';
  if (log) log.textContent = detail || '';
}
function hideOverlay() {
  const ovl = document.getElementById('overlay');
  if (ovl) ovl.classList.remove('show');
}

export async function boot() {
  // 等 DOM 就绪
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once:true }));
  }

  // 顶部版本角标
  const verEl = document.getElementById('engine-version');

  // 1) 安全挂载两张图：ID 对应你的 index.html
  const power = mountPowerPlotById('plot-power');
  const freq  = mountFreqSocPlotById('plot-energy'); // 右侧面板：频率+SOC

  // 2) 读取 endpoint.json（公库 CI 写入）
  let base = null;
  try {
    const resp = await fetch('./vendor/endpoint.json', { cache: 'no-cache' });
    const cfg  = await resp.json();
    base = (cfg && cfg.base) ? String(cfg.base).replace(/\/+$/, '') : null;
  } catch (e) {
    console.warn('[loader] endpoint.json not found/invalid', e);
  }
  if (verEl) verEl.innerHTML = base
    ? `Engine: <span class="ok">online</span> · <span style="font-family:ui-monospace">${base}</span>`
    : `Engine: <span class="warn">offline</span>`;

  // 3) 绑定控制按钮（ID 对应你的 index.html）
  const startBtn = document.getElementById('btn-start');
  const pauseBtn = document.getElementById('btn-pause');
  const resetBtn = document.getElementById('btn-reset');

  // 4) 返回给 glue.js 使用的句柄
  return {
    charts: { power, freq },
    endpoint: base,
    ui: { startBtn, pauseBtn, resetBtn, verEl, overlay: { showOverlay, hideOverlay } },
    out: {
      liveMetrics: document.getElementById('live-metrics'),
      liveState:   document.getElementById('live-state'),
    }
  };
}
