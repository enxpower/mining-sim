# Off‑Grid Wind–Solar–Diesel–BESS Simulator (Public UI)


This repo is the **public UI** that pairs with your private engine (ems-engine v2.1).
It is 100% static and GitHub Pages friendly.


> ✅ Fixes included
> - Deterministic curves (seed propagated to engine)
> - Charts never disappear on button press (no engine re‑creation on play)
> - Two stacked charts share width and align vertically
> - Fuel flow (L/h) wired from engine → UI (no more 0)
> - Robust CSV/PNG export (works on all modern browsers)
> - Uniform button sizing, responsive layout
>
> ⚠️ Requirement: ensure the private engine is available at one of these paths:
> 1. `../ems-engine/dist/ems-engine.min.js` (IIFE; exposes `window.emsEngine`)
> 2. Or `./vendor/ems-engine.esm.js` (ESM fallback; not included here)
>
> You can change the path in `js/engine-adapter.js` lines 9–25.


## Structure
```
.
├─ index.html
├─ css/
│ └─ styles.css
├─ js/
│ ├─ engine-adapter.js # find/initialize private engine
│ ├─ ui.js # DOM wiring, loop, KPIs, events
│ ├─ plot.js # tiny canvas line plotter (no deps)
│ └─ export.js # CSV / PNG export helpers
└─ README.md
