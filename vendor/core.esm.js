// src/engine.js
var buildInfo = {
  name: "ems-engine",
  version: "1.0.0",
  rev: "5e62f53",
  builtAt: "2025-09-07T02:52:44.601Z"
};
var R = {
  config: null,
  scenario: null,
  t: 0,
  // 状态（示例）：SOC [0..1]、累计油耗(L)、当前油耗(L/h)
  soc: 0.5,
  cumFuel: 0,
  fuelLph: 0,
  // 输出缓存
  last: null
};
async function init(config) {
  R.config = structuredClone(config || {});
  return true;
}
async function reset(config, scenario) {
  if (config) R.config = structuredClone(config);
  const d = R.config?.scenarioDefaults || {};
  R.scenario = Object.assign({}, d, scenario || {});
  R.t = 0;
  R.soc = Math.min(1, Math.max(0, (R.scenario.bessMWh ?? d.bessMWh ?? 10) * 0.08));
  R.cumFuel = 0;
  R.fuelLph = 0;
  R.last = null;
  return true;
}
async function step(dtSeconds = 1) {
  if (!R.config) throw new Error("engine not initialized");
  const out = _simulateStep(dtSeconds);
  R.last = out;
  return out;
}
function metrics() {
  if (!R.last) return {};
  return {
    p_load_kw: R.last.load,
    p_pv_kw: R.last.pv,
    p_wind_kw: R.last.wind,
    p_diesel_kw: R.last.diesel,
    p_bess_kw: R.last.bess,
    fuel_lph: R.last.fuelLph,
    fuel_cum_l: R.last.cumFuel,
    soc: R.last.soc
  };
}
function state() {
  return {
    t_s: R.t,
    scenario: R.scenario
  };
}
function _simulateStep(dt) {
  R.t += dt;
  const loadMW = (R.scenario.loadMW ?? 12) + 0.2 * Math.sin(R.t / 60);
  const loadKW = loadMW * 1e3;
  const pvKW = Math.max(0, (R.scenario.pvMW ?? 5) * 1e3 * 0.8 * (0.5 + 0.5 * Math.sin(R.t / 1800)));
  const windKW = Math.max(0, (R.scenario.windMW ?? 6) * 1e3 * 0.6 * (0.5 + 0.5 * Math.sin(R.t / 1200 + 1.2)));
  let residKW = loadKW - pvKW - windKW;
  const dieselFleetMW = (R.scenario.dieselCount ?? 8) * 1;
  const dieselCapKW = dieselFleetMW * 1e3;
  const minLoadingPct = Math.min(80, Math.max(0, R.scenario.dieselMinLoadingPct ?? 30)) / 100;
  const dieselMinKW = dieselCapKW * minLoadingPct;
  let dieselKW = 0;
  if (residKW > 0) {
    dieselKW = Math.min(dieselCapKW, Math.max(dieselMinKW, residKW));
    residKW -= dieselKW;
  }
  const bessMW = R.scenario.bessMW ?? 5;
  const bessMWh = R.scenario.bessMWh ?? 10;
  const bessCapKW = bessMW * 1e3;
  const bessMaxKWh = bessMWh * 1e3;
  const eff = 0.95;
  const hours = dt / 3600;
  let bessKW = 0;
  if (residKW > 0) {
    bessKW = Math.min(bessCapKW, residKW);
    const dE = bessKW * hours / eff;
    const avail = R.soc * bessMaxKWh;
    const real = Math.min(avail, dE);
    bessKW = real / hours * eff;
    R.soc = Math.max(0, (avail - real) / bessMaxKWh);
    residKW -= bessKW;
  } else if (residKW < 0) {
    const chg = Math.min(bessCapKW, -residKW);
    const dE = chg * hours * eff;
    const avail = (1 - R.soc) * bessMaxKWh;
    const real = Math.min(avail, dE);
    bessKW = -(real / hours) / eff;
    R.soc = Math.min(1, (R.soc * bessMaxKWh + real) / bessMaxKWh);
    residKW += chg;
  }
  const l_per_kwh = 0.25;
  const idle_penalty = dieselKW > 0 ? Math.max(0, (dieselMinKW - dieselKW) / 1e3) * 0.02 : 0;
  const fuelLph = dieselKW * l_per_kwh + idle_penalty * 1e3;
  R.fuelLph = fuelLph;
  R.cumFuel += fuelLph * hours;
  return {
    load: Math.max(0, loadKW),
    pv: Math.max(0, pvKW),
    wind: Math.max(0, windKW),
    diesel: Math.max(0, dieselKW),
    bess: bessKW,
    // 充电为负、放电为正
    fuelLph: R.fuelLph,
    soc: R.soc,
    cumFuel: R.cumFuel,
    metrics: metrics(),
    state: state()
  };
}
export {
  buildInfo,
  init,
  metrics,
  reset,
  state,
  step
};
