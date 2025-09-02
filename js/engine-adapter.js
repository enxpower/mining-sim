// js/engine-adapter.js
// Robust loader: ESM or IIFE both ok.

export async function getEngine(seed, overrides = {}) {
  const ns = await getNamespace(); // { createEngine, defaultConfig, fuelLitersPerHour, ... }
  const cfg = { ...ns.defaultConfig, seed, ...overrides };
  const engine = ns.createEngine(cfg);
  return { engine, ns };
}

async function getNamespace() {
  // 1) already on window (IIFE build loaded elsewhere)
  if (window.emsEngine) return window.emsEngine;

  // 2) Try vendor as ESM first
  const esCandidates = [
    './vendor/ems-engine.esm.js',
    './vendor/ems-engine.min.js', // if this file is actually ESM, import will succeed
  ];
  for (const p of esCandidates) {
    try {
      const m = await import(p);
      // ESM exports createEngine/defaultConfig
      if (m?.createEngine && m?.defaultConfig) return m;
    } catch (_) {/* ignore and try next */}
  }

  // 3) Try vendor as IIFE (attach to window)
  const iifeCandidates = [
    '../ems-engine/dist/ems-engine.min.js', // sibling private repo build
    './vendor/ems-engine.iife.min.js',      // explicit IIFE name if you choose to keep both
    './vendor/ems-engine.min.js',           // if this one is IIFE
  ];
  for (const p of iifeCandidates) {
    const ok = await injectScript(p, /*typeModule*/ false);
    if (ok && window.emsEngine) return window.emsEngine;
  }

  throw new Error(
    'EMS engine not found. Put ESM at ./vendor/ems-engine.esm.js (或 ems-engine.min.js 为 ESM)；' +
    '或放 IIFE 于 ../ems-engine/dist/ems-engine.min.js / ./vendor/ems-engine.iife.min.js'
  );
}

function injectScript(src, typeModule = false) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    if (typeModule) s.type = 'module';
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
