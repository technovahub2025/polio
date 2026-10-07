const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const {game}=require('./helpers/game.cjs');
test('lane boundaries, jump physics and slide',()=>{const g=game();g.action('left');g.action('left');assert.equal(g.lane,-1);g.action('jump');g.update(.1);assert.ok(g.jumpY>0);g.action('slide');g.update(.1);assert.equal(g.jumpY,0);assert.ok(g.slide>0);});
test('collectible scoring and double score',()=>{const g=game();g.items=[{type:'drop',lane:0,z:4}];g.powers.double=5;g.update(.01);assert.equal(g.drops,1);assert.ok(g.score>=50);assert.equal(g.items.length,0);});
test('shield absorbs collision and next unprotected collision ends run',()=>{const g=game();g.items=[{type:'virus',lane:0,z:4}];g.powers.shield=5;g.update(.01);assert.equal(g.state,'running');assert.equal(g.powers.shield,0);g.invincible=0;g.items=[{type:'virus',lane:0,z:4}];g.update(.01);assert.equal(g.state,'over');});
test('jump clears barricade and slide clears overhead',()=>{for(const type of ['barrier','overhead']){const g=game();g.items=[{type,lane:0,z:4}];if(type==='barrier')g.jumpY=1.6;else g.slide=.8;g.update(.01);assert.equal(g.state,'running');}});
test('magnet attracts adjacent drops, boost protects and expires',()=>{const g=game();g.items=[{type:'drop',lane:1,z:0},{type:'virus',lane:0,z:4}];g.powers.magnet=5;g.powers.boost=.5;g.update(.01);assert.equal(g.drops,1);assert.equal(g.state,'running');g.update(.6);assert.equal(g.powers.boost,0);});
test('pause and restart preserve state or reset run as appropriate',()=>{const g=game();g.update(.1);const d=g.distance;g.togglePause();assert.equal(g.state,'paused');g.frame(16);assert.equal(g.distance,d);g.resume();assert.equal(g.state,'running');g.start();assert.equal(g.distance,0);assert.equal(g.score,0);});
test('obstacle rows leave at least one free lane and bounded objects',()=>{const g=game();g.items=[];g.spawnRow();const lanes=new Set(g.items.filter(o=>o.type!=='drop').map(o=>o.lane));assert.ok(lanes.size<=2);g.powers.boost=10000;for(let i=0;i<10000;i++){g.invincible=10;g.update(.04);}assert.ok(g.items.length<100);assert.ok(g.speed<=37.7);});

test('early virus waves contain four or five enemies with a reachable escape route',()=>{
  const counts=new Set(),lanes=new Set(),speeds=new Set();
  for(let seed=1;seed<=80;seed++){
    const g=game(seed*7919);g.items=[];assert.equal(g.spawnVirusWave(),true);
    counts.add(g.items.length);const occupied=new Set();
    for(const o of g.items){assert.equal(o.type,'virus');assert.ok(o.z< -50);assert.ok(o.approachSpeed>=25);occupied.add(o.lane);lanes.add(o.lane);speeds.add(o.approachSpeed);}
    assert.ok(g.canSchedule([]));
  }
  assert.equal(counts.size,2);assert.equal(lanes.size,3);assert.ok(speeds.size>50);
});
test('scheduler rejects a three-lane wall and allows a navigable sequence',()=>{
  const g=game();g.items=[];
  const wall=[-1,0,1].map(lane=>({type:'virus',lane,z:-86,approachSpeed:30}));
  assert.equal(g.canSchedule(wall),false);assert.equal(g.canSchedule(wall.slice(0,2)),true);
  g.items=[{type:'barrier',lane:0,z:-50},{type:'overhead',lane:1,z:-50}];
  assert.equal(g.canSchedule([{type:'virus',lane:-1,z:-56,approachSpeed:30}]),false);
});
test('virus speed and ordinary wave frequency grow with score',()=>{
  const slow=game(6),fast=game(6);slow.items=[];fast.items=[];fast.score=20000;
  slow.spawnVirusWave();fast.spawnVirusWave();
  assert.ok(fast.items[0].approachSpeed>slow.items[0].approachSpeed);assert.ok(fast.virusIn<=slow.virusIn);
});
test('fast virus swept collision preserves shield and game-over behavior',()=>{
  const g=game();g.items=[{type:'virus',lane:0,z:0,approachSpeed:140}];g.update(.1);assert.equal(g.state,'over');
  const protectedGame=game();protectedGame.items=[{type:'virus',lane:0,z:0,approachSpeed:140}];protectedGame.powers.shield=5;protectedGame.update(.1);
  assert.equal(protectedGame.state,'running');assert.equal(protectedGame.powers.shield,0);
});
test('waves stay bounded, continuous and never form a three-lane contact wall',()=>{
  const g=game(912);g.powers.boost=0;let previousWave=0,waves=0;
  for(let step=0;step<3000;step++){
    g.invincible=1;g.update(.04);
    if(g.waveId!==previousWave){waves++;previousWave=g.waveId;}
    const danger=new Set(g.items.filter(o=>['virus','barrier','overhead'].includes(o.type)&&Math.abs(o.z-4)<2).map(o=>o.lane));
    assert.ok(danger.size<3);assert.ok(g.items.length<120);assert.equal(g.items.some(o=>o.type==='train'),false);
  }
  assert.ok(waves>15,'slower early waves should keep arriving throughout a two-minute run');
  g.start();assert.equal(g.waveId,0);assert.equal(g.virusIn,.5);
});
test('all-lane collision walls are rejected across many random seeds',()=>{
  for(let seed=1;seed<=12;seed++){
    const g=game(seed);g.score=15000;g.powers.boost=seed%2?100:0;
    for(let t=0;t<1200;t++){
      g.invincible=1;g.update(.04);
      const lanes=new Set(g.items.filter(o=>['virus','barrier','overhead'].includes(o.type)&&Math.abs(o.z-4)<1.5).map(o=>o.lane));
      assert.ok(lanes.size<3,`seed ${seed}, frame ${t}`);
    }
  }
});

test('Down is a short non-stacking evasive move with a lowered hitbox',()=>{
  const g=game();g.items=[];g.action('slide');assert.equal(g.slide,.68);assert.equal(g.playerCollisionHeight,.95);
  g.update(.1);const remaining=g.slide;for(let i=0;i<20;i++)g.action('slide');assert.equal(g.slide,remaining);
  g.action('jump');assert.equal(g.velocityY,0);
  for(let i=0;i<16;i++)g.update(.04);
  assert.equal(g.slide,0);assert.equal(g.playerCollisionHeight,2.4);
  g.action('slide');assert.equal(g.slide,.68);
});
test('run cycle cadence follows speed without restarting at boost transitions',()=>{
  const slow=game(),fast=game();slow.items=[];fast.items=[];fast.distance=2500;fast.powers.boost=10;
  for(let i=0;i<10;i++){slow.update(.02);fast.update(.02);}
  assert.ok(fast.runPhase>slow.runPhase*1.5);
  const before=fast.runPhase;fast.powers.boost=0;fast.update(.02);assert.ok(fast.runPhase>before);assert.ok(fast.runPhase-before<.5);
});
test('animation timing is stable at 30, 60 and 120 updates per second',()=>{
  const phases=[];
  for(const fps of [30,60,120]){
    const g=game();g.items=[];g.spawnIn=1e6;g.virusIn=1e6;g.powerIn=1e6;
    g.action('slide');for(let i=0;i<fps;i++)g.update(1/fps);
    assert.equal(g.slide,0);assert.equal(g.playerCollisionHeight,2.4);phases.push(g.runPhase);
  }
  assert.ok(Math.max(...phases)-Math.min(...phases)<.005);
});
test('paused roll freezes, restart resets pose, and landing creates a brief recovery',()=>{
  const g=game();g.items=[];g.action('slide');g.update(.1);g.togglePause();const remaining=g.slide,phase=g.runPhase;
  g.frame(1000);assert.equal(g.slide,remaining);assert.equal(g.runPhase,phase);
  g.start();assert.equal(g.slide,0);assert.equal(g.runPhase,0);assert.equal(g.airPose,0);
  g.action('jump');for(let i=0;i<45;i++)g.update(.02);assert.equal(g.jumpY,0);assert.ok(g.landingImpact>0);
});

test('Down cancels a jump requested before the next physics frame',()=>{
  const g=game();g.items=[];g.action('jump');g.action('slide');
  g.update(1/60);assert.equal(g.jumpY,0);assert.equal(g.velocityY,0);assert.equal(g.animationState,'SOMERSAULT');
});
