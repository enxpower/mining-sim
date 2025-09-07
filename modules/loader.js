/* modules/loader.js — 基于 manifest 目录解析路径，装配 UI/绘图/引擎（RPC） */
const $ = (s) => document.querySelector(s);
const overlay = $("#pOverlay")?.parentElement.querySelector(".overlay");
const fOverlay = $("#fOverlay");
const live = $("#live");
const engVer = document.createElement("div"); engVer.className="muted kv"; engVer.style.marginTop="4px";
document.querySelector(".topbar")?.appendChild(engVer);

function showOverlay(msg, detail) {
  if (!overlay) return;
  overlay.innerHTML = `<div class="pill"><span>⚙️</span><span>${msg}</span></div>`;
  overlay.style.display = 'flex';
}
function hideOverlay(){ if(overlay) overlay.style.display='none'; if(fOverlay) fOverlay.style.display='none'; }

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

const manifestURL = new URL("./manifest.json", import.meta.url);
const baseURL = new URL(".", manifestURL);

async function dynImport(rel) { return import(new URL(rel, baseURL).href); }

window.__engineReady = false;
window.__engineError = null;

(async () => {
  try {
    showOverlay("Loading engine…");
    const M = await loadJSON(manifestURL.href);
    const mod = M.modules;
    const [core, ui, plots, glue, config] = await Promise.all([
      dynImport(mod.core), dynImport(mod.ui), dynImport(mod.plots), dynImport(mod.glue), dynImport(mod.config)
    ]);

    const buildInfo = core?.buildInfo ?? { name:"ems-engine (remote)", version:"rpc", rev:"-", builtAt:"-" };
    engVer.innerHTML = `Engine: <span class="kv">${buildInfo.name} ${buildInfo.version}</span> <span class="muted">(${buildInfo.rev}, ${buildInfo.builtAt})</span>`;

    ui.mount("#config-form", {
      onStart: () => glue.run(core, plots, ui, config.default || config),
      onPause: () => glue.pause(),
      onReset: () => glue.reset(core, plots, ui, config.default || config)
    });
    plots.mount("#pPlot", "#fPlot", live);

    await core.init(config.default || config);
    window.__engineReady = true;
    hideOverlay();
  } catch (e) {
    console.error(e);
    window.__engineError = String(e?.stack || e?.message || e);
    showOverlay("Failed to load engine");
    engVer.innerHTML = `Engine: <span class="kv">failed</span>`;
  }
})();
