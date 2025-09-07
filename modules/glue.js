/* modules/glue.js */
import { renderMetrics, renderState, getScenario } from "./ui.js";
import { appendPoint } from "./plots.js";

let rafId = 0;
let running = false;
let t = 0; // seconds

export async function run(core, plots, ui, conf) {
  if (running) return;
  running = true;

  // 根据 UI 表单拿 scenario（不污染私库）
  const scenario = getScenario();
  await core.reset(conf, scenario);
  t = 0;

  const stepLoop = async () => {
    if (!running) return;
    // dt = 1s 基准（可升级为自适应/倍速）
    const out = await core.step(1);
    t += 1;

    // out 需至少包含以下字段，私库可在内部映射
    // { load, pv, wind, diesel, bess, fuelLph, soc, cumFuel, metrics, state }
    appendPoint(t, out);
    renderMetrics(out.metrics || {});
    renderState(out.state || {});

    rafId = requestAnimationFrame(stepLoop);
  };

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(stepLoop);
}

export function pause() {
  running = false;
  cancelAnimationFrame(rafId);
}

export async function reset(core, plots, ui, conf) {
  pause();
  const scenario = getScenario();
  await core.reset(conf, scenario);
  // 清空 UI 面板数据展示
  renderMetrics({});
  renderState({});
}
