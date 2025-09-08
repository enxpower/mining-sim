// modules/ui.js

// 生成“Scenario Config”表单（与你 index.html 的结构解耦）
// 注意：只提供公开参数；核心算法在私库里
export function mountConfig(root) {
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

// ✅ 与 loader.js 保持兼容：提供 mountUI()
export function mountUI() {
  const root = document.querySelector('#scenario-config');
  mountConfig(root);
}

// 读取配置参数
export function readConfig() {
  const val = id => parseFloat(document.getElementById(id)?.value ?? '0') || 0;
  return {
    dieselMinLoadingPct: val('cfg_dgMin'),
    bessMWh: val('cfg_Eb'),
    pvMW: val('cfg_Ppv'),
    windMW: val('cfg_Pw'),

    // 默认运行常量
    tickSeconds: 0.5,
    f0: 60,
  };
}
