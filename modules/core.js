// 只是占位，避免本地空白；真正的 core.js 由 ems-engine 的 Release 下发覆盖
export async function init(){ /* no-op */ }
export function reset(){ t=0; }
let t=0;
export function step(dt){
  t+=dt;
  // 简单波形占位（用来验证装配，不含算法逻辑）
  const Pload=12+Math.sin(t/60)*1.2, Ppv=Math.max(0,8*Math.sin(t/3600*2*Math.PI)), Pwind=2+Math.sin(t/45);
  const Pdg=Math.max(0,Pload-(Ppv+Pwind)); const Pb=(Ppv+Pwind+Pdg)-Pload; // 电平衡
  const f=60+(Math.random()-0.5)*0.01; const soc=50+10*Math.sin(t/600);
  const zero=0;
  return { t, Ppv, Pwind, Pload, Pdg, Pb, f, soc,
    kpi:{ fuelL:zero, fuelBase:zero, fuelSaved:zero, pvWh:zero, windWh:zero, curtWh:zero, n1:true, Eload:zero, pvDir:zero, windDir:zero } };
}
