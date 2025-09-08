// modules/ui.js
// 负责渲染“Scenario Config”表单，并提供读取配置的方法
// 只暴露公开参数；核心算法仍在私库里

/** 渲染配置表单 */
export function mountUI(root) {
  if (!root) return;
  root.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <label>Diesel Min Loading (%)<br>
        <input id="cfg_dgMin" type="number" value="30" step="1" min="0" max="70">
      </label>
      <label>BESS Energy (MWh)<br>
        <input id="cfg_Eb" type="number" value="10" step="1" min="0">
      </label>
      <label>PV Cap (MW)<br>
        <input id="cfg_Ppv" type="number" value="5" step="0.5" min="0">
      </label>
      <label>Wind Cap (MW)<br>
        <input id="cfg_Pw" type="number" value="6" step="0.5" min="0">
      </label>
    </div>
  `;
}

/** 读取表单配置，返回给私库引擎作为“公开形参” */
export function readConfig() {
  const num = (id, def = 0) => {
    const el = document.getElementById(id);
    const v = el?.value ?? def;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
  };

  return {
    dieselMinLoadingPct: num('cfg_dgMin', 30),
    bessMWh:             num('cfg_Eb',   10),
    pvMW:                num('cfg_Ppv',   5),
    windMW:              num('cfg_Pw',    6),

    // UI 层可见的一些默认运行常量；真正算法仍在私库里
    tickSeconds: 0.5,
    f0: 60,
  };
}

// 为了兼容你之前粘贴的 mountConfig 名称（可有可无）
export const mountConfig = mountUI;
