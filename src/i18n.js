// Simple i18n without framework. All code comments in English.

export const i18n = {
  en: {
    title: 'Off-Grid Mining Microgrid — 35 kV',
    Global: 'Global',
    'Simulation length (hours)': 'Simulation length (hours)',
    'Timestep dt (s)': 'Timestep dt (s)',
    'Nominal frequency f₀ (Hz)': 'Nominal frequency f₀ (Hz)',
    'System damping D (pu)': 'System damping D (pu)',
    'Load freq. coeff α (%/Hz)': 'Load freq. coeff α (%/Hz)',
    'Geo/Insulation': 'Geo/Insulation',
    Preset: 'Preset',
    'Latitude φ (°N + / °S −)': 'Latitude φ (°N + / °S −)',
    'Day-of-year (1–365)': 'Day-of-year (1–365)',
    'PV soiling (0.7–1)': 'PV soiling (0.7–1)',
    'Load / Renewables': 'Load / Renewables',
    'Load base (MW)': 'Load base (MW)',
    'Load variability (MW)': 'Load variability (MW)',
    'PV limit (MW)': 'PV limit (MW)',
    'PV day shape (1–3)': 'PV day shape (1–3)',
    'Cloudiness (0–1)': 'Cloudiness (0–1)',
    'Wind limit (MW)': 'Wind limit (MW)',
    'Wind mean (m/s)': 'Wind mean (m/s)',
    'Wind variability (0–1)': 'Wind variability (0–1)',
    'Diesel (VF)': 'Diesel (VF)',
    '3.3 MW online (0–6)': '3.3 MW online (0–6)',
    '1.25 MW online (0–2)': '1.25 MW online (0–2)',
    'Droop RP (%)': 'Droop R\u209A (%)',
    'Min loading (pu)': 'Min loading (pu)',
    'Ramp up (MW/s)': 'Ramp up (MW/s)',
    'Ramp down (MW/s)': 'Ramp down (MW/s)',
    'Start/stop delay (s)': 'Start/stop delay (s)',
    'Hysteresis (MW)': 'Hysteresis (MW)',
    'Allow all-off': 'Allow all-off',
    'BESS (VSG)': 'BESS (VSG)',
    'Initial SOC (%)': 'Initial SOC (%)',
    'Droop (% )': 'Droop (%)',
    'Virtual inertia H (s)': 'Virtual inertia H (s)',
    'SOC target / band (%/%)': 'SOC target / band (%/%)',
    'Emergency |Δf| / Mult / Sec (Hz/x/s)': 'Emergency |Δf| / Mult / Sec (Hz/x/s)',
    'Protection / Limits': 'Protection / Limits',
    'View window': 'View window',
    'Window length (hours)': 'Window length (hours)',
    'Window start (hours)': 'Window start (hours)',
    'Follow live': 'Follow live',
    'Power (MW) · Window': 'Power (MW) · Window',
    'Frequency (Hz) / SOC (%) · Window': 'Frequency (Hz) / SOC (%) · Window',
    'KPIs & Log': 'KPIs & Log',
    'Fuel used': 'Fuel used',
    'Fuel baseline': 'Fuel baseline',
    'Fuel saved': 'Fuel saved',
    'Renewable share': 'Renewable share',
    'PV energy': 'PV energy',
    'Wind energy': 'Wind energy',
    'Curtailment': 'Curtailment',
    'N−1 check': 'N−1 check',
    Window: 'Window',
    Load: 'Load'
  },
  zh: {
    title: '离网矿区微电网 — 35 kV',
    Global: '全局',
    'Simulation length (hours)': '仿真时长（小时）',
    'Timestep dt (s)': '步长 dt（秒）',
    'Nominal frequency f₀ (Hz)': '名义频率 f₀（Hz）',
    'System damping D (pu)': '系统阻尼 D（pu）',
    'Load freq. coeff α (%/Hz)': '负荷随频系数 α（%/Hz）',
    'Geo/Insulation': '地理/日照',
    Preset: '预设',
    'Latitude φ (°N + / °S −)': '纬度 φ（°N 正 / °S 负）',
    'Day-of-year (1–365)': '年内日序（1–365）',
    'PV soiling (0.7–1)': 'PV 污染/积尘（0.7–1）',
    'Load / Renewables': '负载 / 可再生',
    'Load base (MW)': '负载基线（MW）',
    'Load variability (MW)': '负载波动（MW）',
    'PV limit (MW)': 'PV 上限（MW）',
    'PV day shape (1–3)': 'PV 日形（1–3）',
    'Cloudiness (0–1)': '云影强度（0–1）',
    'Wind limit (MW)': '风电上限（MW）',
    'Wind mean (m/s)': '平均风速（m/s）',
    'Wind variability (0–1)': '风速波动（0–1）',
    'Diesel (VF)': '柴油（VF）',
    '3.3 MW online (0–6)': '3.3MW 初始在网（0–6）',
    '1.25 MW online (0–2)': '1.25MW 初始在网（0–2）',
    'Droop RP (%)': '有功下垂 R\u209A（%）',
    'Min loading (pu)': '单台最低负载（pu）',
    'Ramp up (MW/s)': '上调爬坡（MW/s）',
    'Ramp down (MW/s)': '下调爬坡（MW/s）',
    'Start/stop delay (s)': '启停延时（s）',
    'Hysteresis (MW)': '启停迟滞（MW）',
    'Allow all-off': '允许全停',
    'BESS (VSG)': '储能（VSG）',
    'Initial SOC (%)': '初始 SOC（%）',
    'Droop (% )': '下垂（%）',
    'Virtual inertia H (s)': '虚拟惯量 H（s）',
    'SOC target / band (%/%)': 'SOC 目标/窗口（%/%）',
    'Emergency |Δf| / Mult / Sec (Hz/x/s)': '应急 |Δf| / 倍数 / 秒（Hz/x/s）',
    'Protection / Limits': '保护/限功',
    'View window': '视窗',
    'Window length (hours)': '视窗长度（小时）',
    'Window start (hours)': '视窗起点（小时）',
    'Follow live': '跟随实时',
    'Power (MW) · Window': '功率（MW）· 视窗',
    'Frequency (Hz) / SOC (%) · Window': '频率（Hz）/ SOC（%）· 视窗',
    'KPIs & Log': '指标 & 日志',
    'Fuel used': '燃油消耗',
    'Fuel baseline': '燃油对照',
    'Fuel saved': '燃油节省',
    'Renewable share': '可再生占比',
    'PV energy': 'PV 发电量',
    'Wind energy': '风电发电量',
    'Curtailment': '弃电',
    'N−1 check': 'N−1 校核',
    Window: '窗口',
    Load: '负载'
  }
};

let lang = 'en';

export function setLang(l) { lang = (l === 'zh' ? 'zh' : 'en'); }

export function applyText(l = lang) {
  lang = l;
  const t = i18n[lang];
  const map = {
    title: 'title', lblGlobal: 'Global',
    lblHours: 'Simulation length (hours)', lblDt: 'Timestep dt (s)', lblF0: 'Nominal frequency f₀ (Hz)',
    lblD: 'System damping D (pu)', lblAlpha: 'Load freq. coeff α (%/Hz)',

    lblGeo: 'Geo/Insulation', lblPreset: 'Preset', lblLat: 'Latitude φ (°N + / °S −)',
    lblDoy: 'Day-of-year (1–365)', lblSoil: 'PV soiling (0.7–1)',

    lblLoadRes: 'Load / Renewables', lblLoadBase: 'Load base (MW)', lblLoadVar: 'Load variability (MW)',
    lblPpvMax: 'PV limit (MW)', lblPvShape: 'PV day shape (1–3)', lblPvCloud: 'Cloudiness (0–1)',
    lblPwindMax: 'Wind limit (MW)', lblWindMean: 'Wind mean (m/s)', lblWindVar: 'Wind variability (0–1)',

    lblDiesel: 'Diesel (VF)', lblDg33: '3.3 MW online (0–6)', lblDg12: '1.25 MW online (0–2)',
    lblRdg: 'Droop RP (%)', lblMinPu: 'Min loading (pu)', lblRampUp: 'Ramp up (MW/s)', lblRampDn: 'Ramp down (MW/s)',
    lblDelay: 'Start/stop delay (s)', lblHyst: 'Hysteresis (MW)', lblAllowOff: 'Allow all-off',

    lblBess: 'BESS (VSG)', lblSoc0: 'Initial SOC (%)', lblRvsg: 'Droop (% )', lblHvsg: 'Virtual inertia H (s)',
    lblSocTar: 'SOC target / band (%/%)', lblEmg: 'Emergency |Δf| / Mult / Sec (Hz/x/s)',

    lblProt: 'Protection / Limits', lblWindow: 'View window', lblWinLen: 'Window length (hours)',
    lblWinStart: 'Window start (hours)', lblFollow: 'Follow live',
    lblPplot: 'Power (MW) · Window', lblFplot: 'Frequency (Hz) / SOC (%) · Window',

    lblKpi: 'KPIs & Log', kpiFuelB: 'Fuel used', kpiFuelBaseB: 'Fuel baseline', kpiFuelSaveB: 'Fuel saved',
    kpiREB: 'Renewable share', kpiPVgenB: 'PV energy', kpiWDgenB: 'Wind energy',
    kpiCurtB: 'Curtailment', kpiN1B: 'N−1 check', kpiWinB: 'Window', lgLoad: 'Load'
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t[key];
  });

  const langBtn = document.getElementById('langBtn');
  if (langBtn) langBtn.textContent = (lang === 'en' ? '中文' : 'English');
}
