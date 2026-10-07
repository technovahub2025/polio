const {test}=require('node:test'),assert=require('node:assert/strict');const {game}=require('./helpers/game.cjs');
function quiet(seed=93){const g=game(seed);g.items=[];g.spawnIn=g.virusIn=g.powerIn=g.flightPathIn=1e9;return g;}
function advance(g,seconds,dt=1/60){for(let t=0;t<seconds-1e-8;t+=dt)g.update(Math.min(dt,seconds-t));}
function hazard(variant,height=0){const g=quiet();g.jumpY=height;const o=g.makeVirus(variant,0,3);o.z=4;g.items=[o];return {g,o};}
test('weighted waves cover every stable variant and all five patterns with reaction time',()=>{
 const variants=new Set(),patterns=new Set();let elites=0,total=0,earlyNormal=0,earlyTotal=0;
 for(let seed=1;seed<=160;seed++)for(const score of [0,6000,18000]){
  const g=quiet(seed*1021);g.score=score;g.lane=seed%3-1;g.x=g.lane*3;
  assert.ok(g.spawnVirusWave());assert.ok(g.canSchedule([]));patterns.add(g.lastVirusPattern);
  for(const o of g.items){variants.add(o.variant);elites+=o.variant==='elite';total++;assert.ok((4-o.z)/o.approachSpeed>=3.1);assert.ok(o.z< -45);if(score===0){earlyTotal++;earlyNormal+=o.variant==='normal';}
   const style=g.virusStyle(o);g.time+=.1;assert.equal(g.virusStyle(o),style);
  }
 }
 assert.equal(variants.size,7);assert.equal(patterns.size,5);assert.ok(elites/total<.15);assert.ok(earlyNormal/earlyTotal>.7);
});
test('scheduler considers the actual starting lane and prevents late unavoidable spawns',()=>{
 const g=quiet();g.lane=0;g.x=0;assert.equal(g.canSchedule([{type:'virus',lane:0,z:3,approachSpeed:30}]),false);
 assert.equal(g.canSchedule([{type:'virus',lane:1,z:3,approachSpeed:30}]),true);
});
test('elite scale is rare-sized and its collision footprint grows with its visible mesh',()=>{
 const {g,o}=hazard('elite',1.65);assert.ok(o.scale>=1.5&&o.scale<=2);g.update(.01);assert.equal(g.state,'over');
 const dodge=hazard('elite');dodge.g.x=3;dodge.g.lane=1;dodge.g.update(.01);assert.equal(dodge.g.state,'running');
});
test('chaser observes, delays, moves smoothly, and stops tracking before contact',()=>{
 const g=quiet(),o=g.makeVirus('chaser',0,8);g.items=[o];g.action('right');advance(g,.4);assert.equal(o.x,0);
 advance(g,.35);assert.ok(o.x>0&&o.x<3);advance(g,.65);assert.equal(o.x,3);
 o.z=4-o.approachSpeed*1.5;g.action('left');advance(g,.1);assert.equal(o.x,3);assert.equal(o.trackingLocked,true);
});
test('rapid lane changes outrun the observation delay and unsafe chase proposals are rejected',()=>{
 const g=quiet(),o=g.makeVirus('chaser',0,8);g.items=[o];for(let i=0;i<6;i++){g.lane=i%2?-1:1;advance(g,.15);}assert.equal(o.x,0);
 g.lane=1;g.x=3;o.lane=0;o.x=0;o.z=4-o.approachSpeed*4;o.observedLane=1;o.noticeIn=0;
 g.items=[o,{type:'virus',lane:-1,z:4-30*4,approachSpeed:30}];g.updateChaser(o,.01);assert.ok(!o.laneMove);assert.equal(o.lane,0);
});
test('low, medium and high flyers collide at actual heights and support different evasions',()=>{
 for(const altitude of ['low','medium','high'])for(const action of ['run','jump','slide','flight']){
  const g=quiet(),o=g.makeVirus('flying',0,3,0,altitude);o.z=4;o.phase=0;g.items=[o];
  if(action==='jump')g.jumpY=1.7;if(action==='slide')g.action('slide');if(action==='flight'){g.activateFlight();g.flightPathIn=1e9;g.jumpY=5;}
  g.update(.01);
  const hit=altitude==='low'?action==='run'||action==='slide':altitude==='medium'?action==='run'||action==='jump':action==='flight';
  assert.equal(g.state,hit?'over':'running',`${altitude} / ${action}`);
 }
});
test('flight pickup rises smoothly for seven seconds, allows lanes, descends and restores collision',()=>{
 const g=quiet();g.items=[{type:'flight',lane:0,z:4}];g.update(.01);assert.equal(g.powers.flight,7);assert.equal(g.flightMode,true);assert.equal(g.jumpY,0);
 g.items=[];g.flightPathIn=1e9;g.update(.05);assert.ok(g.jumpY>0&&g.jumpY<1);assert.equal(g.animationState,'FLYING');
 g.action('right');advance(g,1);assert.ok(g.x>2.9);assert.ok(g.jumpY>4.8);g.action('jump');g.action('slide');assert.equal(g.slide,0);
 advance(g,6);assert.equal(g.powers.flight,0);assert.ok(g.jumpY>4);let previous=g.jumpY;
 for(let i=0;i<110;i++){g.update(.02);assert.ok(g.jumpY<=previous);assert.ok(previous-g.jumpY<.4);previous=g.jumpY;}
 assert.equal(g.flightMode,false);assert.equal(g.jumpY,0);advance(g,.2);assert.equal(g.animationState,'RUN');
 g.items=[{type:'virus',lane:1,z:4}];g.update(.01);assert.equal(g.state,'over');
});
test('flight ignores ground hazards but does not disable high-virus collision or shields',()=>{
 const g=quiet();g.activateFlight();g.flightPathIn=1e9;g.jumpY=5;g.items=[{type:'virus',lane:0,z:4},{type:'overhead',lane:0,z:4},{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.state,'running');
 const high=g.makeVirus('flying',0,3,0,'high');high.z=4;g.powers.shield=5;g.items=[high];g.update(.01);assert.equal(g.powers.shield,0);assert.equal(g.state,'running');
 g.invincible=0;high.z=4;high.passed=false;high.collected=false;g.items=[high];g.update(.01);assert.equal(g.state,'over');
});
test('aerial paths use existing scoring, magnet checks height and pause/restart reset flight',()=>{
 const g=quiet();g.activateFlight();g.spawnFlightPath();const drops=g.items.filter(o=>o.airDrop);assert.equal(drops.length,12);assert.ok(new Set(drops.map(o=>o.y)).size>3);
 g.jumpY=5;g.powers.magnet=5;g.items=[{type:'drop',lane:0,z:4},{type:'drop',lane:0,z:4,y:6,airDrop:true}];g.update(.01);assert.equal(g.drops,1);assert.ok(g.score>=25);
 g.togglePause();const y=g.jumpY,t=g.powers.flight;g.frame(100);assert.equal(g.jumpY,y);assert.equal(g.powers.flight,t);
 g.start();assert.equal(g.jumpY,0);assert.equal(g.flightMode,false);assert.equal(g.powers.flight,0);assert.equal(g.flightCameraY,0);
});
test('extended play at low, medium and high speeds stays bounded with rapid lane changes',()=>{
 for(const distance of [0,1000,3000]){
  const g=game(812+distance);g.distance=distance;g.score=distance*8;
  for(let i=0;i<1800;i++){g.invincible=1;if(i%13===0)g.action(i%26?'left':'right');if(i%360===0)g.activateFlight();g.update(1/30);assert.equal(g.state,'running');assert.ok(g.items.length<180);assert.ok(g.particles.length<200);}
 }
});
test('relative swept collision catches edge crossings during lane changes',()=>{
 const g=quiet();g.x=.2;
 const o={type:'virus',lane:0,x:0,z:6,scale:1,approachSpeed:50};
 // Start outside the lateral box, enter it after the enemy crosses Z=4.
 const at=g.contactTime(o,3.8,0,1.2);assert.ok(at>0&&at<1);
 assert.equal(g.contactTime({...o,x:3,lane:1},3.8,3,0),-1);
});
test('ordinary jumping preserves existing ground power-up and magnet collection',()=>{
 const g=quiet();g.jumpY=1.7;g.powers.magnet=5;g.items=[{type:'drop',lane:1,z:0},{type:'shield',lane:0,z:4}];g.update(.01);assert.equal(g.drops,1);assert.equal(g.powers.shield,18);
});
