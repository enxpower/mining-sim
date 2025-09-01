// src/ui.js
import { createAdapter } from './adapter.js';

// 工具：按钮忙碌态
function busy(btn, yes=true){
  if(!btn) return;
  btn.classList.toggle('is-busy', !!yes);
  btn.disabled = !!yes;
}
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1200);
}

// 你原本的图表刷新函数名（如果不同，换成你自己的）
function updateCharts(state){
  // 假设你在别处初始化了两张图，这里只负责把数据推进去
  const ev = new CustomEvent('sim-tick', { detail: state });
  window.dispatchEvent(ev);
}
function updateKpis(state){
  const ev = new CustomEvent('sim-kpi', { detail: state });
  window.dispatchEvent(ev);
}

(async function bootstrap(){
  // 1) 读取初始配置（从表单或默认值）
  const cfg = {}; // 如果有需要，从 DOM 读入参数填到 cfg

  // 2) 创建适配器
  const sim = await createAdapter(cfg);

  // 3) 绑定按钮
  const btnStart = document.querySelector('#btnStart');
  const btnPause = document.querySelector('#btnPause');
  const btnReset = document.querySelector('#btnReset');

  btnStart?.addEventListener('click', async ()=>{
    busy(btnStart, true);
    try{
      await sim.start();
      toast('Simulation started');
    } finally {
      busy(btnStart, false);
    }
  });

  btnPause?.addEventListener('click', async ()=>{
    busy(btnPause, true);
    try{
      await sim.pause();
      toast('Paused');
    } finally {
      busy(btnPause, false);
    }
  });

  btnReset?.addEventListener('click', async ()=>{
    busy(btnReset, true);
    try{
      await sim.reset();
      toast('Reset done');
    } finally {
      busy(btnReset, false);
    }
  });

  // 4) 订阅 tick，刷新图表与 KPI
  sim.onTick((state)=>{
    updateCharts(state);
    updateKpis(state);
  });

  // 可选：页面加载后自动开始
  // sim.start();
})();
