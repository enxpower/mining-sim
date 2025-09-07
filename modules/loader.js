/* modules/loader.js — DOM-safe boot, read endpoint.json, expose engine hooks */

import { mountPowerPlot, mountFreqPlot } from './plots.js';

export async function boot() {
  // 等 DOM 就绪
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once:true }));
  }

  // 1) 安全挂载两个图表（容器 id 用现有布局里的）
  //    你页面里左右两个图表卡片的容器，请确认 id：
  //    - 功率曲线容器：#pPlot
  //    - 频率/SOC 容器：#fPlot
  const power = mountPowerPlot('#pPlot');
  const freq  = mountFreqPlot('#fPlot');

  // 2) 拉取 endpoint.json
  let base = null;
  try {
    const resp = await fetch('./vendor/endpoint.json', { cache: 'no-cache' });
    const cfg  = await resp.json();
    base = (cfg && cfg.base) ? String(cfg.base).replace(/\/+$/, '') : null;
  } catch (e) {
    console.warn('[loader] endpoint.json not found or invalid', e);
  }

  // 在右上角 “Engine: …” 位置打个标记
  const eg = document.querySelector('[data-engine-stamp]') || document.body;
  eg.dataset.engineStamp = base ? `ok: ${base}` : 'offline';

  // 3) 提供接口给 glue.js 调用
  return {
    charts: {
      power, freq
    },
    endpoint: base,
  };
}
