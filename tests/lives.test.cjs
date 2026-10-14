const {test}=require('node:test'),assert=require('node:assert/strict');
const {game}=require('./helpers/game.cjs');
function quiet(nodes=new Map(),training=false){const g=game(93,nodes,training);g.items=[];g.spawnIn=g.virusIn=g.powerIn=1e9;return g;}
function hit(g,type='virus'){const o={type,lane:g.lane,z:4};g.items.push(o);g.update(.01);return o;}
function advance(g,t){for(let n=0;n<Math.ceil(t/.01);n++)g.update(.01);}
test('five lives decrement once per valid virus hit, update hearts immediately, and finish only at zero',()=>{
 const nodes=new Map(),g=quiet(nodes);assert.equal(g.maxLives,5);assert.equal(g.lives,5);
 for(let lives=4;lives>=0;lives--){
  const virus=hit(g);assert.equal(g.lives,lives);assert.equal(g.state,lives?'running':'over');
  assert.ok(virus.passed&&virus.collected);assert.ok(!g.items.includes(virus));
  assert.equal(g.animationState,'HIT');assert.equal(g.invincible,1.5);assert.equal(nodes.get('#life-feedback').hidden,false);
  for(let i=0;i<5;i++)assert.equal(nodes.get('#life-heart-'+i).textContent,i<lives?'♥':'♡');
  if(lives){const distance=g.distance;advance(g,1.51);assert.ok(g.distance>distance);assert.equal(g.invincible,0);assert.equal(g.lifeHitTime,0);assert.equal(g.lifePulse,0);}
 }
 assert.equal(g.loseLife(),false);assert.equal(g.lives,0);
});
test('overlapping hazards and repeated contact cannot drain hearts; upcoming viruses remain',()=>{
 const g=quiet(),upcoming={type:'virus',lane:1,z:-80};g.items=[upcoming,{type:'virus',lane:0,z:4},{type:'virus',lane:0,z:4},{type:'barrier',lane:0,z:4}];
 g.update(.01);assert.equal(g.lives,4);assert.equal(g.state,'running');assert.ok(g.items.includes(upcoming));assert.equal(g.items.length,1);
 advance(g,1.3);hit(g);assert.equal(g.lives,4);advance(g,.21);hit(g);assert.equal(g.lives,3);
});
test('shield consumes no life, boost preserves shield, and readiness grants no immunity',()=>{
 const g=quiet();g.powers.shield=1;hit(g);assert.equal(g.powers.shield,0);assert.equal(g.lives,5);assert.equal(g.invincible,1.2);
 advance(g,1.21);hit(g);assert.equal(g.lives,4);
 const b=quiet();b.powers.boost=1;b.powers.shield=1;hit(b);assert.equal(b.lives,5);assert.equal(b.powers.shield,1);
 const ready=quiet();ready.warriorModeReady=true;ready.vaccinePower=10;hit(ready);assert.equal(ready.lives,4);
});
test('training retries and shield demo do not consume lives, including stray viruses',()=>{
 for(const stage of ['JUMP','ROLL','SHIELD_DEMO']){
  const g=quiet(new Map(),true);g.setTutorialStage(stage);
  g.items=[{type:stage==='JUMP'?'barrier':stage==='ROLL'?'overhead':'virus',lane:0,z:4,training:true}];
  g.update(.01);assert.equal(g.lives,5);assert.equal(g.state,'running');
  hit(g);assert.equal(g.lives,5);g.endTutorial();assert.equal(g.lives,5);
 }
});
test('life count persists through all worlds, looping, pause, flight and vaccines',()=>{
 const g=quiet();hit(g);advance(g,1.51);
 for(const distance of [500,850,1400,2000,2600,3100,5200]){g.distance=distance;g.updateWorld(0);assert.equal(g.lives,4);}
 const score=g.score;g.collectVaccine({type:'vaccine',lane:0,z:4});assert.equal(g.lives,4);assert.equal(g.vaccinePower,1);assert.ok(g.score>=score);
 g.activateFlight();g.flightPathIn=1e9;g.update(.02);assert.equal(g.lives,4);
 g.togglePause();g.frame(1000);assert.equal(g.lives,4);
});
test('pause freezes damage timers; restart and home clear life feedback',()=>{
 const nodes=new Map(),g=quiet(nodes);hit(g);g.togglePause();g.frame(1000);assert.equal(g.invincible,1.5);assert.equal(g.lifePulse,.65);
 g.start();assert.equal(g.lives,5);assert.equal(g.invincible,0);assert.equal(g.lifePulse,0);assert.equal(g.lifeHitTime,0);assert.equal(g.lostHeart,-1);assert.equal(nodes.get('#life-feedback').hidden,true);
 g.endTutorial();hit(g);nodes.get('#secondary').onclick();assert.equal(g.lives,5);assert.equal(nodes.get('#life-hud').hidden,true);
});
test('barriers and overheads retain fatal collisions even with hearts remaining',()=>{
 for(const type of ['barrier','overhead']){const g=quiet();hit(g,type);assert.equal(g.state,'over');assert.equal(g.lives,5);}
});
