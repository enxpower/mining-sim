/* modules/loader.js
 * 动态装配：相对路径，适配 GitHub Pages 项目子路径
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

async function loadManifest() {
  // 相对路径，避免 /repo 子路径 404
  const res = await fetch("./modules/manifest.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest fetch ${res.status}`);
  return res.json();
}

// 全局诊断标志（可用于外部截图监控）
window.__engineReady = false;
window.__engineError = null;

(async () => {
  try {
    showOverlay("Loading simulator…");

    const M = await loadManifest();
    const baseConfig = M?.modules;
    if (!baseConfig) throw new Error("manifest modules missing");

    // 并行加载所有模块
    const [core, ui, plots, glue, config] = await Promise.all([
      import(baseConfig.core),
      import(baseConfig.ui),
      import(baseConfig.plots),
      import(baseConfig.glue),
      import(baseConfig.config)
    ]);

    // 引擎版本号（可由私库导出 buildInfo）
    const buildInfo = core?.buildInfo ?? { name: "ems-engine", version: "unknown", rev: "-", builtAt: "-" };
    engVer.innerHTML = `Engine: <span class="ok">${buildInfo.name} v${buildInfo.version}</span> <span class="muted">(${buildInfo.rev}, ${buildInfo.builtAt})</span>`;

    // 初始化 UI & PLOTS & GLUE
    ui.mount("#config-form", {
      onStart: () => glue.run(core, plots, ui, config.default || config),
      onPause: () => glue.pause(),
      onReset: () => glue.reset(core, plots, ui, config.default || config),
    });

    plots.mount("#plot-power", "#plot-energy");

    // 预初始化引擎（加载配置、准备内部缓存）
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
