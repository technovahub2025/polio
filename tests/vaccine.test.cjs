const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game.cjs');
function quiet(nodes){const g=game(93,nodes);g.items=[];g.spawnIn=g.virusIn=g.powerIn=1e9;return g;}
function pickup(g,extra={}){const o={type:'vaccine',lane:0,z:4,...extra};g.items=[o];g.update(.01);return o;}
test('new run and restart reset vaccine state, ready effect, and HUD immediately',()=>{
 const nodes=new Map(),g=quiet(nodes);
 assert.equal(g.vaccinePower,0);assert.equal(g.vaccinePowerMax,10);assert.equal(g.warriorModeReady,false);
 for(let i=0;i<10;i++)pickup(g);
 g.start();assert.equal(g.vaccinePower,0);assert.equal(g.warriorModeReady,false);assert.equal(g.vaccineReadyPulse,0);
 assert.equal(nodes.get('#vaccine-meter').value,0);assert.equal(nodes.get('#vaccine-count').textContent,'0/10');assert.equal(nodes.get('#vaccine-ready').hidden,true);
});
test('physical vaccine pickup counts once, removes item, updates HUD and preserves score',()=>{
 const nodes=new Map(),g=quiet(nodes),control=quiet();
 const o=pickup(g);control.update(.01);
 assert.equal(g.vaccinePower,1);assert.equal(o.collected,true);assert.equal(g.items.length,0);
 assert.equal(nodes.get('#vaccine-meter').value,1);assert.equal(nodes.get('#vaccine-count').textContent,'1/10');
 assert.equal(g.score,control.score);assert.equal(g.drops,0);assert.equal(g.powers.shield,0);assert.equal(g.invincible,0);
 g.items=[o];g.update(.01);assert.equal(g.vaccinePower,1);
});
test('tenth pickup marks ready once, caps at ten, and grants no gameplay powers',()=>{
 const nodes=new Map(),g=quiet(nodes);
 let announcements=0;const toast=g.toast.bind(g);g.toast=m=>{if(m==='WARRIOR MODE READY!')announcements++;toast(m);};
 for(let i=1;i<=12;i++){
  pickup(g);assert.equal(g.vaccinePower,Math.min(i,10));assert.equal(g.warriorModeReady,i>=10);
  if(i===10)assert.equal(g.vaccineReadyPulse,.8);
 }
 assert.equal(announcements,1);assert.equal(g.invincible,0);assert.equal(g.powers.shield,0);assert.equal(g.powers.boost,0);
 assert.equal(nodes.get('#vaccine-meter').value,10);assert.equal(nodes.get('#vaccine-ready').hidden,false);
 assert.equal(g.state,'running');assert.equal(g.animationState,'RUN');
});
test('magnet attracts ordinary drops but never vaccines, including same-lane distant pickups',()=>{
 const g=quiet();g.powers.magnet=10;
 g.items=[{type:'drop',lane:1,z:0},{type:'vaccine',lane:1,z:0},{type:'vaccine',lane:0,z:0}];g.update(.01);
 assert.equal(g.drops,1);assert.equal(g.vaccinePower,0);assert.equal(g.items.length,2);
 pickup(g);assert.equal(g.vaccinePower,1);
});
test('vaccine requires physical lane and height contact through jump, roll and flight',()=>{
 const g=quiet();pickup(g,{lane:1});assert.equal(g.vaccinePower,0);
 g.jumpY=3;pickup(g);assert.equal(g.vaccinePower,0);
 g.jumpY=0;g.action('slide');pickup(g);assert.equal(g.vaccinePower,1);
 g.activateFlight();g.jumpY=5;pickup(g);assert.equal(g.vaccinePower,1);
 pickup(g,{y:6.05});assert.equal(g.vaccinePower,2);assert.equal(g.animationState,'FLYING');
});
test('ready state leaves ordinary virus damage intact and shield still absorbs exactly one hit',()=>{
 for(const protectedRun of [false,true]){
  const g=quiet();for(let i=0;i<10;i++)pickup(g);
  if(protectedRun){g.items=[{type:'shield',lane:0,z:4}];g.update(.01);}
  g.items=[{type:'virus',lane:0,z:4}];g.update(.01);
  assert.equal(g.state,'running');assert.equal(g.lives,protectedRun?5:4);assert.equal(g.powers.shield,0);
  assert.equal(g.vaccinePower,10);assert.equal(g.warriorModeReady,true);
  if(protectedRun){assert.equal(g.invincible,1.2);for(let i=0;i<31;i++)g.update(.04);g.items=[{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.state,'over');}
 }
});
test('vaccines do not change boost, double score, flight or shield durations and strength',()=>{
 const g=quiet(),control=quiet();
 for(const p of [g,control])Object.assign(p.powers,{shield:1,boost:4,double:4,magnet:4});
 pickup(g);control.update(.01);
 assert.deepEqual({...g.powers},{...control.powers});assert.equal(g.score,control.score);assert.equal(g.speed,control.speed);
 assert.equal(g.vaccinePower,1);
});
test('vaccine uses existing row cadence, reachable lanes and world motion; skips unsafe rows',()=>{
 const g=quiet();g.spawnIn=0;g.update(.01);
 const vaccine=g.items.find(o=>o.type==='vaccine');assert.ok(vaccine);assert.ok(vaccine.z<0);assert.ok([-1,0,1].includes(vaccine.lane));
 const z=vaccine.z;g.update(.01);assert.ok(vaccine.z>z);assert.equal(g.items.filter(o=>o.type==='vaccine').length,1);
 g.items=[-1,0,1].map(lane=>({type:'barrier',lane,z:-60}));g.spawnVaccine();assert.equal(g.items.some(o=>o.type==='vaccine'),false);
});
test('pause preserves meter and freezes ready effect',()=>{
 const g=quiet();for(let i=0;i<10;i++)pickup(g);g.togglePause();g.frame(1000);
 assert.equal(g.vaccinePower,10);assert.equal(g.warriorModeReady,true);assert.equal(g.vaccineReadyPulse,.8);
});
