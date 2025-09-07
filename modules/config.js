/* modules/config.js */
const config = {
  tickSeconds: 1,
  // 默认场景（UI 可覆盖）
  scenarioDefaults: {
    loadMW: 12,           // 典型矿区 12 MW 基线
    dieselCount: 8,       // 6x3.3 + 2x1.25（示意；实际在私库映射）
    dieselMinLoadingPct: 30,
    pvMW: 5,
    windMW: 6,
    bessMW: 5,
    bessMWh: 10
  }
};

export default config;
