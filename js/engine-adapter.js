// Robust loader: supports both ESM and IIFE builds placed under /vendor or ../ems-engine/dist

export async function getEngine(seed, overrides = {}) {
  const ns = await getNamespace();
  const cfg = { ...ns.defaultConfig, seed, ...overrides };
  const engine = ns.createEngine(cfg);
  return { engine, ns };
}

async function getNamespace() {
  // 1) already present (IIFE attached to window)
  if (window.emsEngine) return window.emsEngine;

  // 2) ESM candidates
  for (const p of ['./vendor/ems-engine.esm.js', './vendor/ems-engine.min.js']) {
    try {
      const m = await import(p);
      if (m?.createEngine && m?.defaultConfig) return m;
    } catch (_) {}
  }

  // 3) IIFE candidates (attach to window)
  for (const p of ['../ems-engine/dist/ems-engine.min.js', './vendor/ems-engine.iife.min.js', './vendor/ems-engine.min.js']) {
    const ok = await injectScript(p, false);
    if (ok && window.emsEngine) return window.emsEngine;
  }

  throw new Error('EMS engine not found. Put ESM at vendor/ems-engine.esm.js，或 IIFE at vendor/ems-engine.iife.min.js / ../ems-engine/dist/ems-engine.min.js');
}

function injectScript(src, typeModule = false) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    if (typeModule) s.type = 'module';
    s.src = src; s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
