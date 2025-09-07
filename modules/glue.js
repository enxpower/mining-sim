/* modules/glue.js — 将 UI ↔ 图表 ↔ 私库引擎 API 串起来 */

import { boot } from './loader.js';

let st = {
  f0: 60,
  t: 0,
  series: [], // {t, Ppv,Pwind,Pload,Pdg,Pb,f,soc}
  endpoint: null,
  timer: null,
  running: false,
};

async function api(base, path, payload) {
  if (!base) throw new Error('endpoint missing');
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : '{}',
  });
  if (!r.ok) {
    const text = await r.text().catch(()=>r.statusText);
    throw new Error(`${r.status} ${r.statusText}: ${text}`);
  }
  return r.json();
}

function sampleToRow(s) {
  // 兼容你的 Worker 字段；按需继续扩
  const t   = s.t_s ?? s.t ?? 0;
  const soc = s.soc ?? ((s.bess_soc ?? 0) * 100);
  return {
    t,
    Ppv:   s.p_pv_kw     ? s.p_pv_kw/1000     : (s.Ppv ?? 0),
    Pwind: s.p_wind_kw   ? s.p_wind_kw/1000   : (s.Pwind ?? 0),
    Pload: s.p_load_kw   ? s.p_load_kw/1000   : (s.Pload ?? 0),
    Pdg:   s.p_diesel_kw ? s.p_diesel_kw/1000 : (s.Pdg ?? 0),
    Pb:    s.p_bess_kw   ? s.p_bess_kw/1000   : (s.Pb ?? 0),
    f:     s.f_hz ?? s.f ?? 60,
    soc:   isFinite(soc) ? soc : 0
  };
}

async function main() {
  const { charts, endpoint, ui, out } = await boot();
  st.endpoint = endpoint;

  const setBtns = (running) => {
    if (ui.startBtn) ui.startBtn.disabled = running;
    if (ui.pauseBtn) ui.pauseBtn.disabled = !running;
  };

  async function initEngine() {
    if (!st.endpoint) {
      ui.overlay.showOverlay('Failed to load simulator', 'Engine endpoint missing. Check /vendor/endpoint.json');
      return false;
    }
    try {
      // 你的 Worker 可实现 /api/init；若无需参数可发空对象
      await api(st.endpoint, '/api/init', { preset: 'default' });
      st.series = [];
      st.t = 0;
      out.liveMetrics && (out.liveMetrics.textContent = '[OK] Engine initialized');
      ui.overlay.hideOverlay();
      return true;
    } catch (e) {
      console.warn('[init] failed', e);
      ui.overlay.showOverlay('Failed to init engine', String(e));
      return false;
    }
  }

  async function stepOnce() {
    try {
      const s = await api(st.endpoint, '/api/step', { dt: 0.5 });
      const row = sampleToRow(s);
      st.series.push(row);
      st.t = row.t;

      // 绘图窗口：最近 ~20 分钟
      const seg = st.series.slice(-1200);
      charts.power.draw(seg);
      charts.freq.draw(seg, st.f0);

      // Live 区
      out.liveMetrics && (out.liveMetrics.textContent =
        `t=${(row.t/3600).toFixed(2)}h | f=${row.f.toFixed(3)}Hz | PV=${row.Ppv.toFixed(2)}MW | Wind=${row.Pwind.toFixed(2)}MW | Diesel=${row.Pdg.toFixed(2)}MW | BESS=${row.Pb.toFixed(2)}MW | Load=${row.Pload.toFixed(2)}MW`);
      out.liveState && (out.liveState.textContent = JSON.stringify(s, null, 2));
    } catch (e) {
      console.warn('[step] failed', e);
      stopLoop();
      ui.overlay.showOverlay('Simulator stopped', String(e));
    }
  }

  function loop() { st.timer = setInterval(stepOnce, 500); }
  function stopLoop() {
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
    st.running = false;
    setBtns(false);
  }

  // 绑定按钮（使用你的真实 ID）
  ui.startBtn?.addEventListener('click', async () => {
    if (st.running) return;
    const ok = await initEngine();
    if (!ok) return;
    st.running = true;
    setBtns(true);
    loop();
  });
  ui.pauseBtn?.addEventListener('click', stopLoop);
  ui.resetBtn?.addEventListener('click', async () => {
    stopLoop();
    st.series = [];
    charts.power.draw([]);
    charts.freq.draw([]);
    await initEngine();
  });

  // 初始态
  setBtns(false);

  // 如果 endpoint 缺失，直接给出覆盖提示
  if (!st.endpoint) {
    ui.overlay.showOverlay('Engine offline', 'Missing /vendor/endpoint.json or invalid format.');
  }
}

main().catch(err => {
  console.error(err);
  const ovl = document.getElementById('overlay');
  if (ovl) {
    ovl.classList.add('show');
    const m = document.getElementById('overlay-msg');
    const l = document.getElementById('overlay-log');
    if (m) m.textContent = 'Boot error';
    if (l) l.textContent = String(err.stack || err);
  }
});
