// Bridge to the private engine. Prefer the IIFE build that sets window.emsEngine.
// Fallback to ESM at ./vendor/ems-engine.esm.js (optional; not included).


export async function getEngine(seed, overrides={}) {
let engNS = window.emsEngine;
if (!engNS) {
try {
// Attempt ESM fallback if available
engNS = await import('./vendor/ems-engine.esm.js');
} catch (e) {
console.error('Engine not found. Ensure ../ems-engine/dist/ems-engine.min.js exists or provide ./vendor/ems-engine.esm.js');
throw e;
}
}
const cfg = { ...engNS.defaultConfig, seed, ...overrides };
// Important: don’t mutate defaultConfig; pass a fresh copy
const engine = engNS.createEngine(cfg);
return { engine, ns: engNS };
}
