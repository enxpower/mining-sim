/* modules/glue.js — wire UI <-> charts <-> engine API */

import { boot } from './loader.js';

let state = {
  t: 0,
  f0: 60,
  series: [],    // {t, Ppv, Pwind, Pload, Pdg, Pb, f}
  timer: null,
  running: false,
  endpoint: null,
};

async function api(base, path, payload) {
  if (!base) return null;
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function sampleToSeries(s) {
  // 兼容私库 Worker 的返回字段；字段名按你后端为准
  return {
    t: s.t_s ?? s.t ?? 0,
    Ppv:   s.p_pv_kw   ? s.p_pv_kw/1000   : (s.Ppv ?? 0),
    Pwind: s.p_wind_kw ? s.p_wind_kw/1000 : (s.Pwind ?? 0),
    Pload: s.p_load_kw ? s.p_load_kw/1000 : (s.Pload ?? 0),
    Pdg:   s.p_diesel_kw ? s.p_diesel_kw/1000 : (s.Pdg ?? 0),
    Pb:    s.p_bess_kw ? s.p_bess_kw/1000 : (s.Pb ?? 0),
    f:     s.f_hz ?? s.f ?? 60,
  };
}

async function main() {
  const { charts, endpoint } = await boot();
  state.endpoint = endpoint;

  const startBtn = document.querySelector('[data-act=start]');
  const pauseBtn = document.querySelector('[data-act=pause]');
  const resetBtn = document.querySelector('[data-act=reset]');
  const liveEl   = document.getElementById('live') || document.querySelector('#live');

  // 设置按钮可用性
  function setButtons(running) {
    startBtn?.toggleAttribute('disabled', running);
    pauseBtn?.toggleAttribute('disabled', !running);
  }

  async function initEngine() {
    if (!endpoint) {
      liveEl && (liveEl.textContent = 'Engine offline: missing endpoint');
      return false;
    }
    try {
      // 你的 Worker /api/init 可按需调整
      const resp = await api(endpoint, '/api/init', { preset: 'default' });
      state.series = [];
      state.t = 0;
      liveEl && (liveEl.textContent = 'Engine ready');
      return true;
    } catch (e) {
      console.warn('[glue] init failed', e);
      liveEl && (liveEl.textContent = 'Engine init failed');
      return false;
    }
  }

  async function stepOnce() {
    try {
      const s = await api(state.endpoint, '/api/step', { dt: 0.5 });
      const row = sampleToSeries(s);
      state.series.push(row);
      state.t = row.t;
      charts.power.draw(state.series.slice(-1200)); // 20 分钟窗口
      charts.freq.draw(state.series.slice(-1200), state.f0);

      // 右下 live 文本
      liveEl && (liveEl.textContent =
        `t=${(row.t/3600).toFixed(2)}h | f=${row.f.toFixed(3)}Hz | PV=${row.Ppv.toFixed(2)}MW | Wind=${row.Pwind.toFixed(2)}MW | Diesel=${row.Pdg.toFixed(2)}MW | BESS=${row.Pb.toFixed(2)}MW | Load=${row.Pload.toFixed(2)}MW`);
    } catch (e) {
      console.warn('[glue] step failed', e);
      stopLoop();
      liveEl && (liveEl.textContent = 'Engine step failed');
    }
  }

  function loop() {
    state.timer = setInterval(stepOnce, 500);
  }

  function stopLoop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.running = false;
    setButtons(false);
  }

  // 绑定按钮
  startBtn?.addEventListener('click', async () => {
    if (state.running) return;
    const ok = await initEngine();
    if (!ok) return;
    state.running = true;
    setButtons(true);
    loop();
  });

  pauseBtn?.addEventListener('click', stopLoop);
  resetBtn?.addEventListener('click', async () => {
    stopLoop();
    state.series = [];
    charts.power.draw([]);
    charts.freq.draw([]);
    await initEngine();
  });

  // 初始按钮态
  setButtons(false);
}

main().catch(err => console.error(err));
