// src/i18n.js
// Simple i18n helper: set language and apply texts by element id.

const dict = {
  en: {
    title: "Off-Grid Mining Microgrid — 35 kV",
    lblGlobal: "Global",
    lblHours: "Simulation length (hours)",
    lblDt: "Timestep dt (s)",
    lblF0: "Nominal frequency f₀ (Hz)",
    lblD: "System damping D (pu)",
    lblAlpha: "Load freq. coeff α (%/Hz)",
    startBtn: "▶ Start",
    pauseBtn: "⏸ Pause",
    resetBtn: "↺ Reset",
    langBtn: "中文",

    lblGeo: "Geo/Insulation",
    lblPreset: "Preset",
    lblLat: "Latitude φ (°N + / °S −)",
    lblDoy: "Day-of-year (1–365)",
    lblSoil: "PV soiling (0.7–1)",

    lblLoadRes: "Load / Renewables",
    lblLoadBase: "Load base (MW)",
    lblLoadVar: "Load variability (MW)",
    lblPpvMax: "PV limit (MW)",
    lblPvShape: "PV day shape (1–3)",
    lblPvCloud: "Cloudiness (0–1)",
    lblPwindMax: "Wind limit (MW)",
    lblWindMean: "Wind mean (m/s)",
    lblWindVar: "Wind variability (0–1)",

    lblDiesel: "Diesel (VF)",
    lblDg33: "3.3 MW online (0–6)",
    lblDg12: "1.25 MW online (0–2)",
    lblRdg: "Droop Rₚ (%)",
    lblMinPu: "Min loading (pu)",
    lblRampUp: "Ramp up (MW/s)",
    lblRampDn: "Ramp down (MW/s)",
    lblDelay: "Start/stop delay (s)",
    lblHyst: "Hysteresis (MW)",
    lblAllowOff: "Allow all-off",

    lblBess: "BESS (VSG)",
    lblSoc0: "Initial SOC (%)",
    lblRvsg: "Droop Rₚ (%)",
    lblHvsg: "Virtual inertia H (s)",
    lblSocTar: "SOC target / band (%/%)",
    lblEmg: "Emergency |Δf| / Mult / Sec (Hz/x/s)",

    lblProt: "Protection / Limits",

    lblWindow: "View window",
    lblWinLen: "Window length (hours)",
    lblWinStart: "Window start (hours)",
    lblFollow: "Follow live",

    lblPplot: "Power (MW) · Window",
    lgLoad: "Load",
    lblFplot: "Frequency (Hz) / SOC (%) · Window",

    lblKpi: "KPIs & Log",
    kpiFuelB: "Fuel used",
    kpiFuelBaseB: "Fuel baseline",
    kpiFuelSaveB: "Fuel saved",
    kpiREB: "Renewable share",
    kpiPVgenB: "PV energy",
    kpiWDgenB: "Wind energy",
    kpiCurtB: "Curtailment",
    kpiN1B: "N−1 check",
    kpiWinB: "Window"
  },

  zh: {
    title: "离网矿区微电网 — 35 kV",
    lblGlobal: "全局参数",
    lblHours: "仿真时长（小时）",
    lblDt: "步长 dt（秒）",
    lblF0: "额定频率 f₀（Hz）",
    lblD: "系统阻尼 D（pu）",
    lblAlpha: "负载频率系数 α（%/Hz）",
    startBtn: "▶ 开始",
    pauseBtn: "⏸ 暂停",
    resetBtn: "↺ 重置",
    langBtn: "English",

    lblGeo: "地理/太阳辐照",
    lblPreset: "预设",
    lblLat: "纬度 φ（北+ / 南−）",
    lblDoy: "一年中的第 N 天（1–365）",
    lblSoil: "光伏污染系数（0.7–1）",

    lblLoadRes: "负载 / 可再生",
    lblLoadBase: "负载基值（MW）",
    lblLoadVar: "负载波动（MW）",
    lblPpvMax: "光伏上限（MW）",
    lblPvShape: "日照形状（1–3）",
    lblPvCloud: "云量（0–1）",
    lblPwindMax: "风电上限（MW）",
    lblWindMean: "平均风速（m/s）",
    lblWindVar: "风速波动（0–1）",

    lblDiesel: "柴油机（VF 成网）",
    lblDg33: "3.3 MW 并网台数（0–6）",
    lblDg12: "1.25 MW 并网台数（0–2）",
    lblRdg: "下垂 Rₚ（%）",
    lblMinPu: "最低负载（pu）",
    lblRampUp: "爬坡上升（MW/s）",
    lblRampDn: "爬坡下降（MW/s）",
    lblDelay: "启停延时（s）",
    lblHyst: "回差（MW）",
    lblAllowOff: "允许全停",

    lblBess: "储能（VSG）",
    lblSoc0: "初始 SOC（%）",
    lblRvsg: "下垂 Rₚ（%）",
    lblHvsg: "虚拟惯量 H（s）",
    lblSocTar: "SOC 目标/带宽（%/%）",
    lblEmg: "紧急 |Δf| / 倍率 / 秒（Hz/x/s）",

    lblProt: "保护/限值",

    lblWindow: "查看窗口",
    lblWinLen: "窗口长度（小时）",
    lblWinStart: "窗口起点（小时）",
    lblFollow: "跟随实时",

    lblPplot: "功率（MW）· 窗口",
    lgLoad: "负载",
    lblFplot: "频率（Hz）/ SOC（%）· 窗口",

    lblKpi: "运行指标与日志",
    kpiFuelB: "燃油消耗",
    kpiFuelBaseB: "燃油对照",
    kpiFuelSaveB: "燃油节省",
    kpiREB: "可再生占比",
    kpiPVgenB: "光伏发电量",
    kpiWDgenB: "风电发电量",
    kpiCurtB: "弃电（光伏+风）",
    kpiN1B: "N−1 校核",
    kpiWinB: "窗口"
  }
};

let current = 'en';

export function setLang(lang) {
  if (!dict[lang]) return;
  current = lang;
}
export function getLang() { return current; }

export function applyText(lang = current) {
  const t = dict[lang] || dict.en;
  Object.entries(t).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

export const i18n = { setLang, applyText, getLang };
export default i18n;
