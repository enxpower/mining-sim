// Find and initialize the private engine with robust fallbacks.
// 1) window.emsEngine (IIFE build present)
// 2) inject <script src="../ems-engine/dist/ems-engine.min.js">
// 3) inject <script src="./vendor/ems-engine.min.js">
// If all fail, throw.

export async function getEngine(seed, overrides = {}) {
  let ns = await getNamespace();
  const cfg = { ...ns.defaultConfig, seed, ...overrides };
  const engine = ns.createEngine(cfg);
  return { engine, ns };
}

async function getNamespace() {
  if (window.emsEngine) return window.emsEngine;

  // Try sibling repo dist
  const cand1 = "../ems-engine/dist/ems-engine.min.js";
  const ok1 = await tryInject(cand1);
  if (ok1 && window.emsEngine) return window.emsEngine;

  // Try local vendor fallback
  const cand2 = "./vendor/ems-engine.min.js";
  const ok2 = await tryInject(cand2);
  if (ok2 && window.emsEngine) return window.emsEngine;

  throw new Error(
    "EMS engine not found. Put dist/ems-engine.min.js at ../ems-engine/ or vendor/ems-engine.min.js"
  );
}

function tryInject(src) {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
