const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game.cjs');
function isolated(){const g=game();g.items=[];g.spawnIn=g.virusIn=g.powerIn=1e9;return g;}
function pickup(g){g.items=[{type:'shield',lane:0,z:4}];g.update(.01);}
test('protector pickup lasts until hit, does not stack, and resets',()=>{
 const g=isolated();pickup(g);assert.equal(g.powers.shield,1);assert.equal(g.items.length,0);
 for(let i=0;i<600;i++)g.update(.04);
 assert.equal(g.powers.shield,1);pickup(g);assert.equal(g.powers.shield,1);
 g.start();assert.equal(g.powers.shield,0);assert.equal(g.shieldBreak,0);
});
test('each hazard breaks protection without HIT, then virus life loss or obstacle death returns',()=>{
 for(const type of ['virus','barrier','overhead']){
  const g=isolated();pickup(g);const hazard={type,lane:0,z:4};g.items=[hazard];g.update(.01);
  assert.equal(g.state,'running');assert.equal(g.animationState,'RUN');assert.equal(g.powers.shield,0);
  assert.equal(g.lives,5);assert.equal(g.invincible,1.2);assert.ok(g.shieldBreak>0);assert.ok(hazard.passed&&hazard.collected);
  g.items.push(hazard);g.update(.01);assert.equal(g.state,'running');
  g.items.push({type,lane:0,z:4});g.update(.01);assert.equal(g.state,'running');
  for(let i=0;i<31;i++)g.update(.04);
  g.items=[{type,lane:0,z:4}];g.update(.01);assert.equal(g.state,type==='virus'?'running':'over');assert.equal(g.lives,type==='virus'?4:5);assert.equal(g.animationState,'HIT');
 }
});
test('unprotected hazard still ends run; boost takes priority over shield',()=>{
 const g=isolated();g.items=[{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.state,'over');
 const p=isolated();pickup(p);p.powers.boost=1;p.powers.magnet=4;p.powers.double=4;
 p.items=[{type:'virus',lane:0,z:4}];p.update(.01);assert.equal(p.powers.shield,1);assert.equal(p.state,'running');
 assert.ok(p.powers.magnet<4&&p.powers.double<4);
 p.activateFlight();p.items=[];p.update(.04);assert.equal(p.powers.shield,1);assert.equal(p.animationState,'FLYING');
});
test('shield pause freezes grace and break timers',()=>{
 const g=isolated();pickup(g);g.items=[{type:'virus',lane:0,z:4}];g.update(.01);g.togglePause();
 g.frame(1000);assert.equal(g.lives,5);assert.equal(g.invincible,1.2);assert.equal(g.shieldBreak,.45);
});
test('shield uses existing cadence and skips blocked pickup lanes',()=>{
 const g=isolated();g.powerIndex=4;g.powerIn=0;g.update(.01);
 assert.equal(g.items.filter(o=>o.type==='shield').length,1);assert.equal(g.powerIn,90);
 assert.ok([-1,0,1].includes(g.items[0].lane));
 g.items=[-1,0,1].map(lane=>({type:'barrier',lane,z:-94}));
 assert.equal(g.shieldLane(-94),null);
 g.powerIndex=4;g.powerIn=0;g.update(.01);assert.equal(g.items.some(o=>o.type==='shield'),false);
});
