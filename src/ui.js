// src/ui.js
// UI layout + charts + windowing + button feedback

import { createAdapter } from './adapter.js';

const colors = {
  pv:'#E69F00',             // orange
  wind:'#D55E00',           // vermillion
  load:'#000000',           // black
  diesel:'#0072B2',         // blue
  bess:'#009E73',           // green
  freq:'#6A5ACD',           // slate
  soc:'#2E8B57',            // sea green
  dotted:'#9aa4b2'
};

function busy(btn, on=true){ if(!btn) return; btn.classList.toggle('is-busy',on); btn.disabled = on; }
function toast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1100); }

// ------- chart helpers --------
let powerChart, freqChart;
function createCharts(){
  const ctxP = document.getElementById('powerChart');
  const ctxF = document.getElementById('freqChart');
  const common = {responsive:true, animation:false, parsing:false, normalized:true, maintainAspectRatio:false};

  powerChart = new Chart(ctxP, {
    type:'line',
    data:{
      datasets:[
        {label:'PV',   data:[], borderColor:colors.pv,   backgroundColor:colors.pv,   tension:.25, fill:false, pointRadius:0},
        {label:'Wind', data:[], borderColor:colors.wind, backgroundColor:colors.wind, tension:.25, fill:false, pointRadius:0, borderDash:[6,4]},
        {label:'Load', data:[], borderColor:colors.load, backgroundColor:colors.load, tension:.25, fill:false, pointRadius:0, borderWidth:1.5},
        {label:'Diesel',data:[], borderColor:colors.diesel,backgroundColor:colors.diesel, tension:.25, fill:false, pointRadius:0},
        {label:'BESS (+dis/-ch)', data:[], borderColor:colors.bess, backgroundColor:colors.bess, tension:.25, fill:false, pointRadius:0}
      ]
    },
    options:{
      ...common,
      scales:{
        x:{type:'linear', min:0, max:4, ticks:{callback:v=>v.toFixed(1)+'h'}},
        y:{title:{display:true,text:'MW'}}
      },
      plugins:{legend:{position:'right'}}
    }
  });

  freqChart = new Chart(ctxF,{
    type:'line',
    data:{
      datasets:[
        {label:'Freq', data:[], borderColor:colors.freq, backgroundColor:colors.freq, tension:.15, pointRadius:0},
        {label:'SOC',  data:[], borderColor:colors.soc,  backgroundColor:colors.soc,  tension:.15, pointRadius:0, yAxisID:'y2'},
        {label:'f₀=60 Hz baseline', data:[{x:0,y:60},{x:4,y:60}], borderColor:colors.dotted, borderDash:[4,4], pointRadius:0, fill:false}
      ]
    },
    options:{
      ...common,
      scales:{
        x:{type:'linear', min:0, max:4, ticks:{callback:v=>v.toFixed(1)+'h'}},
        y:{title:{display:true,text:'Hz'}, min:55, max:65},
        y2:{position:'right', title:{display:true,text:'SOC %'}, min:0,max:100, grid:{display:false}}
      },
      plugins:{legend:{position:'right'}}
    }
  });
}

function updateWindow(xmin, xmax){
  powerChart.options.scales.x.min = xmin;
  powerChart.options.scales.x.max = xmax;
  // baseline 线段也要跟着缩放
  const base = freqChart.data.datasets[2];
  base.data = [{x:xmin,y:60},{x:xmax,y:60}];

  freqChart.options.scales.x.min = xmin;
  freqChart.options.scales.x.max = xmax;

  powerChart.update('none');
  freqChart.update('none');
}

// ------- data buffer (24h) -------
const buf = {
  times:[], pv:[], wind:[], load:[], diesel:[], bess:[], hz:[], soc:[]
};
function pushPoint(t, s){
  const cap = 24*60*6; // 24h, 每分钟 6 点（10s 分辨率）— 仅演示
  function push(arr,v){ arr.push(v); if(arr.length>cap) arr.shift(); }
  push(buf.times, t);
  push(buf.pv, s.pv); push(buf.wind, s.wind); push(buf.load, s.load);
  push(buf.diesel, s.diesel); push(buf.bess, s.bess);
  push(buf.hz, s.hz); push(buf.soc, s.soc);
}

function redraw(xmin, xmax){
  // 过滤窗口内的数据
  const idx = buf.times.reduce((acc,tm,i)=>{ if(tm>=xmin && tm<=xmax) acc.push(i); return acc; },[]);
  function pack(arr){ return idx.map(i=>({x:buf.times[i], y:arr[i]})); }

  powerChart.data.datasets[0].data = pack(buf.pv);
  powerChart.data.datasets[1].data = pack(buf.wind);
  powerChart.data.datasets[2].data = pack(buf.load);
  powerChart.data.datasets[3].data = pack(buf.diesel);
  powerChart.data.datasets[4].data = pack(buf.bess);
  powerChart.update('none');

  freqChart.data.datasets[0].data = pack(buf.hz);
  freqChart.data.datasets[1].data = pack(buf.soc);
  // baseline 数据在 updateWindow() 已处理
  freqChart.update('none');
}

// ------- KPI & status -------
function setText(id, val){ const el=document.getElementById(id); if(el) el.textContent=val; }
function updateKpisFromState(s){
  // 这些 KPI 数值示例化；若你的引擎有成熟 KPI，请把这里改成调用 engine.getState() 里的字段
  // 下面简单滚动累加（演示）
  window.__E ||= {Epv:0,Ew:0,curt:0,fuel:0,base:0};
  const E = window.__E;
  E.Epv += Math.max(0, s.pv)/360;   // 粗略换算到 MWh（10s/3600h≈1/360）
  E.Ew  += Math.max(0, s.wind)/360;
  const ren = Math.max(0, s.pv + s.wind);
  const curt = Math.max(0, ren - s.load); E.curt += curt/360;
  // 粗略燃油（演示）：柴油 MW * 0.22 L/s（假设比油耗）*10s → L
  E.fuel += Math.max(0,s.diesel) * 0.22 * 10;
  // 基准（全柴）：负荷 * 同样系数
  E.base += Math.max(0,s.load) * 0.22 * 10;

  const share = (E.Epv+E.Ew) / Math.max(1e-6, (E.Epv+E.Ew) + (E.fuel/0.22/1000)); // 仅演示口径
  setText('k_pvE',    `${E.Epv.toFixed(2)} MWh`);
  setText('k_windE',  `${E.Ew.toFixed(2)} MWh`);
  setText('k_curtail',`${E.curt.toFixed(2)} MWh`);
  setText('k_fuelUsed', `${E.fuel.toFixed(0)} L`);
  setText('k_fuelBase', `${E.base.toFixed(0)} L`);
  setText('k_fuelSaved', `${Math.max(0,E.base-E.fuel).toFixed(0)} L`);
  setText('k_renShare', `${(share*100).toFixed(1)} %`);
}

// ------- bootstrap -------
(async function main(){
  createCharts();

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const winLen = document.getElementById('winLen');
  const winStart = document.getElementById('winStart');
  const follow = document.getElementById('followLive');
  const winText = document.getElementById('winText');
  const statusEl = document.getElementById('status');

  function refreshWindowLabel(){
    const w = Number(winLen.value||4);
    const s = Number(winStart.value||0);
    winText.textContent = `[${s.toFixed(1)}, ${(s+w).toFixed(1)}] h`;
    updateWindow(s, s+w);
    redraw(s, s+w);
  }

  // 引擎
  const sim = await createAdapter({/* TODO: pass config from form */});
  let tHour = 0;

  sim.onTick((s)=>{
    // 时间轴使用小时（演示：每秒≈0.083h，在 shim 里已做；真实引擎请按实际换算）
    tHour = s.t ?? (tHour + 1/12);
    pushPoint(tHour, s);

    if (follow.checked){
      const w = Number(winLen.value||4);
      const s0 = Math.max(0, tHour - w);
      winStart.value = s0;
    }
    refreshWindowLabel();

    statusEl.textContent =
      `t=${tHour.toFixed(2)} h | f=${(s.hz??0).toFixed(3)} Hz | Δf=${((s.hz??0)-60).toFixed(3)} Hz | `+
      `PV=${(s.pv??0).toFixed(2)} MW | Wind=${(s.wind??0).toFixed(2)} MW | Diesel=${(s.diesel??0).toFixed(2)} MW | `+
      `BESS=${(s.bess??0).toFixed(2)} MW | SOC=${(s.soc??0).toFixed(1)} % | Load=${(s.load??0).toFixed(2)} MW`;

    updateKpisFromState(s);
  });

  // 交互
  btnStart.addEventListener('click', async()=>{ busy(btnStart,true); try{ await sim.start(); toast('Started'); } finally{ busy(btnStart,false);} });
  btnPause.addEventListener('click', async()=>{ busy(btnPause,true); try{ await sim.pause(); toast('Paused'); } finally{ busy(btnPause,false);} });
  btnReset.addEventListener('click', async()=>{
    busy(btnReset,true);
    try{
      await sim.reset();
      // 清空 buffer
      Object.keys(buf).forEach(k=>buf[k]=[]);
      window.__E = {Epv:0,Ew:0,curt:0,fuel:0,base:0};
      tHour = 0; refreshWindowLabel(); redraw(0, Number(winLen.value||4));
      toast('Reset');
    } finally { busy(btnReset,false); }
  });

  winLen.addEventListener('change', refreshWindowLabel);
  winStart.addEventListener('input',()=>{ follow.checked=false; refreshWindowLabel(); });

  // 初始刷新一次
  refreshWindowLabel();

  // 若你希望自动开始，在下面解开注释
  // sim.start();
})();