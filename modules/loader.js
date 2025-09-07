/* modules/loader.js
 * 以 manifest.json 的实际 URL 为基准解析所有模块路径，避免 /repo 子路径和二次叠加
 */
const $ = (s) => document.querySelector(s);

const overlay = $("#overlay");
const ovlMsg  = $("#overlay-msg");
const ovlLog  = $("#overlay-log");
const engVer  = $("#engine-version");

function showOverlay(msg, detail) {
  ovlMsg.textContent = msg || "";
  ovlLog.textContent = detail || "";
  overlay.classList.add("show");
}
function hideOverlay() {
  overlay.classList.remove("show");
  ovlMsg.textContent = "";
  ovlLog.textContent = "";
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

// 关键：用 manifest 的目录作为解析基准
const manifestURL = new URL("./manifest.json", import.meta.url);
const baseURL = new URL(".", manifestURL);

async function dynImport(relPath) {
  // 支持绝对/相对；相对路径按 manifest 目录解析
  const url = new URL(relPath, baseURL).href;
  return import(url);
}

window.__engineReady = false;
window.__engineError = null;

(async () => {
  try {
    showOverlay("Loading simulator…");

    const M = await loadJSON(manifestURL.href);
    const mod = M?.modules;
    if (!mod) throw new Error("manifest.modules missing");

    // 并行加载（全部以 manifest 目录为基准解析）
    const [core, ui, plots, glue, config] = await Promise.all([
      dynImport(mod.core),
      dynImport(mod.ui),
      dynImport(mod.plots),
      dynImport(mod.glue),
      dynImport(mod.config)
    ]);

    const buildInfo = core?.buildInfo ?? { name: "ems-engine", version: "unknown", rev: "-", builtAt: "-" };
    engVer.innerHTML = `Engine: <span class="ok">${buildInfo.name} v${buildInfo.version}</span> <span class="muted">(${buildInfo.rev}, ${buildInfo.builtAt})</span>`;

    // UI/Plots/Glue 装配
    ui.mount("#config-form", {
      onStart: () => glue.run(core, plots, ui, config.default || config),
      onPause: () => glue.pause(),
      onReset: () => glue.reset(core, plots, ui, config.default || config),
    });
    plots.mount("#plot-power", "#plot-energy");

    // 引擎预初始化
    await core.init(config.default || config);

    window.__engineReady = true;
    hideOverlay();
  } catch (e) {
    console.error(e);
    window.__engineError = String(e?.stack || e?.message || e);
    showOverlay("Failed to load simulator", window.__engineError);
    engVer.innerHTML = `Engine: <span class="err">failed</span>`;
  }
})();
