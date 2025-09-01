// Read DOM inputs -> engine config object.

export function readConfig() {
  const g = id => document.getElementById(id).value;
  return {
    // time & system
    horizonHours: +g('simHours'),
    dt: +g('dt'),
    f0: +g('f0'),
    D: +g('Dsys'),
    alphaLoad: +g('alphaLoad') / 100,

    // geo
    latDeg: +g('latDeg'),
    dayOfYear: +g('doy'),
    pvSoiling: +g('pvSoil'),

    // load
    PloadBase: +g('Pload'),
    PloadVar: +g('loadVar'),

    // pv
    PpvMax: +g('PpvMax'),
    pvShape: +g('pvShape'),
    pvCloud: +g('pvCloud'),

    // wind
    PwindMax: +g('PwindMax'),
    windMean: +g('windMean'),
    windVar: +g('windVar'),

    // diesel
    dg33n: +g('dg33n'),
    dg12n: +g('dg12n'),
    RdgPct: +g('Rdg'),
    dgMinPu: +g('dgMinPu'),
    rampUp: +g('rampUp'),
    rampDn: +g('rampDn'),
    dgDelay: +g('dgDelay'),
    dgHyst: +g('dgHyst'),
    allowDieselOff: (document.getElementById('allowDieselOff').value === 'true'),

    // bess
    PbMax: +g('PbMax'),
    EbMax: +g('EbMax'),
    soc0: +g('soc0'),
    RvsgPct: +g('Rvsg'),
    Hvsg: +g('Hvsg'),
    socTarget: +g('socTarget') / 100,
    socBand: +g('socBand') / 100,
    femg: +g('femg'),
    overMul: +g('overMul'),
    overSec: +g('overSec'),

    // protection
    rocMax: +g('rocMax'),
    kof1: +g('kof1'),
    kof2: +g('kof2'),
    of1f: +g('of1f'),
    of1t: +g('of1t'),
    of2f: +g('of2f'),
    of2t: +g('of2t'),
    reclose: +g('reclose')
  };
}
