const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {mat4}=require('../gl-matrix.js');
const {game}=require('./helpers/game.cjs');
const context={mat4,devicePixelRatio:1};vm.createContext(context);
vm.runInContext(fs.readFileSync('runner-scene.js','utf8')+'\nthis.Scene=RailwayScene;',context);
function quiet(){const g=game();g.items=[];g.spawnIn=g.powerIn=g.virusIn=1e9;return g;}
function at(g,d){g.distance=d;g.travel=d;g.updateWorld(0);return g.environment;}
function scenery(g,tunnelOnly=false){const calls=[],scene=Object.create(context.Scene.prototype);for(const kind of ['box','orb'])scene[kind]=(...args)=>calls.push({kind,args});if(tunnelOnly)scene.renderTunnel(g,g.environment);else scene.renderEnvironment(g);return calls;}
test('world threshold, approaching portal and smooth entry are centralized distance state',()=>{
 const g=quiet();assert.equal(g.environment.id,'BRIGHT_CITY');assert.equal(at(g,449).approaching,false);
 assert.equal(at(g,450).approaching,true);assert.equal(g.environment.portalZ,-46);
 assert.equal(at(g,499.9).id,'BRIGHT_CITY');assert.equal(at(g,500).id,'TUNNEL');assert.equal(g.environment.portalZ,4);assert.equal(g.environment.transition,0);
 const blend=at(g,507).transition;assert.ok(blend>0&&blend<1);assert.equal(at(g,514).transition,1);
 assert.equal(at(g,1040000).id,'BRIGHT_CITY');g.start();assert.equal(g.environment.id,'BRIGHT_CITY');assert.equal(g.worldEntryShown,false);
});
test('world messages last two active seconds, do not repeat and pause with gameplay',()=>{
 const nodes=new Map(),g=game(93,nodes);at(g,450);assert.equal(nodes.get('#world-label').textContent,'VIRUS TUNNEL AHEAD');
 g.updateWorld(1);assert.equal(g.worldLabelTime,1);g.updateWorld(1.1);assert.equal(nodes.get('#world-label').hidden,true);
 at(g,500);assert.equal(nodes.get('#world-label').textContent,'VIRUS TUNNEL');assert.equal(g.worldLabelTime,2);
 g.togglePause();g.frame(1000);assert.equal(g.worldLabelTime,2);assert.equal(nodes.get('#world-label').hidden,true);
 g.resume();g.updateWorld(2.1);assert.equal(g.worldLabelTime,0);g.updateWorld(0);assert.equal(g.worldLabelTime,0);
});
test('crossing keeps score, distance, shield, vaccine readiness and all power timers',()=>{
 const g=quiet();at(g,499.95);g.score=900;g.powers.shield=1;g.vaccinePower=10;g.warriorModeReady=true;
 g.powers.double=4;g.powers.magnet=3;g.activateFlight();g.flightPathIn=1e9;g.update(.02);
 assert.equal(g.environment.id,'TUNNEL');assert.ok(g.distance>500);assert.ok(g.score>900);assert.equal(g.powers.shield,1);
 assert.equal(g.vaccinePower,10);assert.equal(g.warriorModeReady,true);assert.ok(g.powers.double>3.9);assert.ok(g.powers.magnet>2.9);assert.ok(g.powers.flight>6.9);assert.equal(g.flightMode,true);
 g.action('right');for(let i=0;i<100;i++)g.update(.02);assert.ok(g.x>2.9);assert.ok(g.jumpY>4.9);assert.equal(g.animationState,'FLYING');
});
test('tunnel preserves ordinary collisions, shield absorption and vaccine collection',()=>{
 const g=quiet();at(g,600);g.items=[{type:'vaccine',lane:0,z:4}];g.update(.01);assert.equal(g.vaccinePower,1);
 g.powers.shield=1;g.items=[{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.powers.shield,0);assert.equal(g.state,'running');
 g.invincible=0;g.items=[{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.state,'over');
});
test('portal physically approaches, ceiling clears flight camera, outdoor scenery stops inside',()=>{
 const g=quiet();at(g,450);let calls=scenery(g);const portal=calls.find(c=>c.args[6]==='#7496aa');assert.equal(portal.args[2],-46);
 at(g,460);calls=scenery(g);assert.equal(calls.find(c=>c.args[6]==='#7496aa').args[2],portal.args[2]+10);
 assert.ok(calls.some(c=>c.args[6]==='brick'));assert.ok(calls.some(c=>c.args[6]==='#233d56'));
 at(g,520);calls=scenery(g);for(const color of ['brick','#55aa64','#86c969','#b0d982','#f8fdff','#9cd7e8'])assert.equal(calls.some(c=>c.args[6]===color),false,color);
 const roof=calls.filter(c=>c.args[6]==='#233d56');assert.ok(roof.length>0);assert.ok(roof.every(c=>c.args[1]-c.args[4]>10.3));
 assert.ok(calls.some(c=>c.args[6]==='#fff0be'));assert.ok(calls.some(c=>c.args[6]==='stripe'));
});
test('tunnel section count stays bounded and absolute section spacing is continuous',()=>{
 const g=quiet();for(const distance of [500,520,600,650]){
  at(g,distance);const calls=scenery(g,true);const roofs=calls.filter(c=>c.args[6]==='#233d56');
  assert.ok(roofs.length>=10&&roofs.length<=16);assert.ok(calls.length<500);
  for(let i=1;i<roofs.length;i++)assert.ok(Math.abs(roofs[i-1].args[2]-roofs[i].args[2]-12)<1e-8);
 }
 at(g,601);const a=scenery(g).filter(c=>c.args[6]==='#233d56').map(c=>c.args[2]);at(g,601.1);const b=scenery(g).filter(c=>c.args[6]==='#233d56').map(c=>c.args[2]);assert.ok(a.every((z,i)=>Math.abs(b[i]-z-.1)<1e-6));
});
test('bright city render uses cyan sky and fresh palette, then blends to readable tunnel fog',()=>{
 const g=quiet(),scene=Object.create(context.Scene.prototype),clear=[],fog=[];
 scene.canvas={clientWidth:800,clientHeight:600,width:800,height:600};scene.projection=mat4.create();scene.view=mat4.create();
 scene.info={uniformLocations:{}};scene.gl=new Proxy({}, {get(_,key){if(key==='clearColor')return (...args)=>clear.push(args);if(key==='uniform3fv')return (_,value)=>fog.push(value);return ()=>{};}});
 scene.box=scene.orb=scene.player=()=>{};
 scene.render(g);assert.ok(Math.abs(clear[0][1]-.863)<1e-6);assert.equal(clear[0][2],1);
 at(g,507);scene.render(g);at(g,520);scene.render(g);assert.ok(clear[1][2]>clear[2][2]);assert.ok(fog[2][2]>=.39);
 at(g,0);const colors=scenery(g).map(c=>c.args[6]);assert.ok(colors.includes('#55aa64'));assert.ok(colors.includes('#e4f1f4'));assert.ok(colors.includes('#f8fdff'));
});


test('finite tunnel exit approaches and green district starts at configured boundary',()=>{
 const nodes=new Map(),g=game(93,nodes);
 at(g,780);assert.equal(g.environment.id,'TUNNEL');assert.equal(g.environment.exitZ,-66);
 let calls=scenery(g);assert.ok(calls.some(c=>c.args[6]==='#7496aa'&&c.args[2]===-66));
 assert.ok(calls.some(c=>c.args[6]==='#92c976'),'green landscape visible beyond exit');
 const roofs=calls.filter(c=>c.args[6]==='#233d56');assert.ok(roofs.every(c=>c.args[2]-c.args[5]>=g.environment.exitZ-1e-8));
 at(g,800);assert.equal(g.environment.exitZ,-46);assert.ok(g.environment.exitTransition>0&&g.environment.exitTransition<1);
 at(g,849.9);assert.equal(g.environment.id,'TUNNEL');at(g,850);assert.equal(g.environment.id,'GREEN_DISTRICT');assert.equal(g.environment.exitZ,4);
 assert.equal(nodes.get('#world-label').textContent,'GREEN HEALTH DISTRICT');assert.equal(g.worldLabelTime,2);g.updateWorld(2.1);assert.equal(nodes.get('#world-label').hidden,true);
 at(g,864);assert.equal(g.environment.exitTransition,1);assert.equal(g.environment.greenEnd,1400);
 at(g,900);calls=scenery(g);assert.equal(calls.some(c=>['#233d56','#29475f','#fff0be','#75d9e9','brick'].includes(c.args[6])),false);
 assert.ok(calls.some(c=>c.args[6]==='#92c976'));g.start();assert.equal(g.environment.id,'BRIGHT_CITY');assert.equal(g.greenEntryShown,false);
});
test('green scenery is deterministic, varied, bounded and outside the three lanes',()=>{
 const g=quiet();for(const distance of [800,850,900,1200,3600,10400900]){
  at(g,distance);const calls=scenery(g);assert.ok(calls.length<1200);assert.deepEqual(scenery(g),calls);
  const greens=calls.filter(c=>['#459b68','#79be62','#a0d375'].includes(c.args[6]));assert.ok(greens.length>0);
  assert.ok(greens.every(c=>Math.abs(c.args[0])-c.args[3]>4.5));
  assert.ok(calls.some(c=>c.args[6]==='poster0'));assert.ok(calls.some(c=>c.args[6]==='#e9f3df'));
 }
 at(g,900);const a=scenery(g).filter(c=>c.args[6]==='#92c976');at(g,900.1);const b=scenery(g).filter(c=>c.args[6]==='#92c976');
 assert.ok(a.every((c,i)=>Math.abs(b[i].args[2]-c.args[2]-.1)<1e-6));
 at(g,849.9);const rails=scenery(g).filter(c=>c.args[6]==='#e4f1f4');at(g,850.1);assert.deepEqual(scenery(g).filter(c=>c.args[6]==='#e4f1f4'),rails);
});
test('flight and all progression survive exit; ordinary collisions and pickups remain active',()=>{
 const g=quiet();at(g,849.9);g.score=2500;g.vaccinePower=10;g.warriorModeReady=true;g.powers.shield=1;g.powers.double=4;g.powers.magnet=4;g.activateFlight();g.flightPathIn=1e9;
 g.update(.02);assert.equal(g.environment.id,'GREEN_DISTRICT');assert.ok(g.distance>850);assert.ok(g.score>2500);assert.equal(g.powers.shield,1);assert.equal(g.vaccinePower,10);assert.equal(g.warriorModeReady,true);assert.ok(g.powers.double>3.9);assert.ok(g.powers.magnet>3.9);assert.ok(g.powers.flight>6.9);
 g.action('left');for(let i=0;i<500;i++)g.update(.02);assert.equal(g.flightMode,false);assert.ok(g.x< -2.9);assert.equal(g.environment.id,'GREEN_DISTRICT');
 g.items=[{type:'barrier',lane:-1,z:4}];g.update(.01);assert.equal(g.powers.shield,0);assert.equal(g.state,'running');g.invincible=0;g.items=[{type:'barrier',lane:-1,z:4}];g.update(.01);assert.equal(g.state,'over');
});
test('exit sky and atmospheric transition increase smoothly rather than cutting at boundary',()=>{
 const g=quiet();let previousSky=0,previousLight=0;
 for(let distance=700;distance<=870;distance++){
  at(g,distance);assert.ok(g.environment.exitSky>=previousSky);assert.ok(g.environment.exitTransition>=previousLight);assert.ok(g.environment.exitTransition-previousLight<.03);
  previousSky=g.environment.exitSky;previousLight=g.environment.exitTransition;
 }
 assert.equal(previousSky,1);assert.equal(previousLight,1);
});


test('five-world selection repeats at 2600m',()=>{
 const g=quiet();const cases=[[100,'BRIGHT_CITY'],[600,'TUNNEL'],[1000,'GREEN_DISTRICT'],[1600,'VILLAGE_VACCINATION_MISSION'],[2200,'JUNGLE_IMMUNITY_TRAIL'],[2700,'BRIGHT_CITY'],[3200,'TUNNEL'],[3600,'GREEN_DISTRICT'],[4200,'VILLAGE_VACCINATION_MISSION'],[4800,'JUNGLE_IMMUNITY_TRAIL'],[5300,'BRIGHT_CITY']];
 for(const [distance,id] of cases){assert.equal(at(g,distance).id,id);assert.equal(g.distance,distance);assert.equal(g.environment.worldDistance,distance%2600);}
 for(const [distance,id] of [[1399.99,'GREEN_DISTRICT'],[1400,'VILLAGE_VACCINATION_MISSION'],[1999.99,'VILLAGE_VACCINATION_MISSION'],[2000,'JUNGLE_IMMUNITY_TRAIL'],[2599.99,'JUNGLE_IMMUNITY_TRAIL'],[2600,'BRIGHT_CITY']])assert.equal(at(g,distance).id,id);
});
test('village contains camps, homes, farms and varied bounded scenery safely beside railway',()=>{
 const g=quiet();for(const distance of [1550,1600,1700,4200,10401600]){
  at(g,distance);const calls=scenery(g);assert.ok(calls.length<1500);assert.deepEqual(calls,scenery(g));
  for(const color of ['#71cdc5','#a8cd74','#cd9569','#58a96b','poster0','drop'])assert.ok(calls.some(c=>c.args[6]===color),color);
  for(const c of calls.filter(c=>['#71cdc5','#cd9569','#58a96b'].includes(c.args[6])))assert.ok(Math.abs(c.args[0])-c.args[3]>4.5);
  assert.equal(calls.some(c=>c.args[6]==='#233d56'),false);
 }
});
test('green-to-village and jungle-to-city render both sides before and after physical boundaries',()=>{
 const g=quiet();at(g,1350);let calls=scenery(g);assert.ok(calls.some(c=>c.args[6]==='#92c976'));assert.ok(calls.some(c=>c.args[6]==='#a8cd74'));
 assert.equal(g.environment.visibleWorlds.length,2);
 at(g,2550);calls=scenery(g);assert.ok(calls.some(c=>c.args[6]==='#a4cc76'));assert.ok(calls.some(c=>c.args[6]==='brick'));
 at(g,2600.1);calls=scenery(g);assert.ok(calls.some(c=>c.args[6]==='#a4cc76'));assert.ok(calls.some(c=>c.args[6]==='brick'));
 at(g,2640);assert.equal(scenery(g).some(c=>c.args[6]==='#a4cc76'),false);
 at(g,2599.99);const rails=scenery(g).filter(c=>c.args[6]==='#e4f1f4');at(g,2600.01);assert.deepEqual(scenery(g).filter(c=>c.args[6]==='#e4f1f4'),rails);
});
test('labels and tunnel approach replay each cycle, village subtitle is nonblocking',()=>{
 const nodes=new Map(),g=game(93,nodes);at(g,1400);assert.equal(nodes.get('#world-label').textContent,'VILLAGE VACCINATION MISSION');assert.equal(nodes.get('#world-subtitle').textContent,'EVERY DROP COUNTS');assert.equal(g.worldLabelTime,2);g.updateWorld(2.1);assert.equal(nodes.get('#world-label-panel').hidden,true);
 at(g,2600);assert.equal(nodes.get('#world-label').textContent,'BRIGHT MORNING CITY');assert.equal(nodes.get('#world-subtitle').textContent,'');
 at(g,3050);assert.equal(nodes.get('#world-label').textContent,'VIRUS TUNNEL AHEAD');at(g,3100);assert.equal(nodes.get('#world-label').textContent,'VIRUS TUNNEL');
 at(g,3450);assert.equal(nodes.get('#world-label').textContent,'GREEN HEALTH DISTRICT');at(g,4000);assert.equal(nodes.get('#world-label').textContent,'VILLAGE VACCINATION MISSION');
 g.start();assert.equal(g.environment.cycle,0);assert.equal(g.tutorialStage,'MOVE_LEFT');assert.equal(nodes.get('#world-label-panel').hidden,true);
});
test('village entry and cycle wrap preserve total progress, difficulty, tutorial and every power',()=>{
 for(const distance of [1399.9,1999.9,2599.9,5199.9]){
  const g=quiet();at(g,distance);g.score=8000;g.vaccinePower=10;g.warriorModeReady=true;g.powers.shield=1;g.powers.boost=4;g.powers.double=4;g.powers.magnet=4;g.activateFlight();g.flightPathIn=1e9;
  const difficulty=g.virusDifficulty();g.update(.02);assert.ok(g.distance>distance);assert.ok(g.score>8000);assert.ok(g.virusDifficulty()>=difficulty);assert.ok(g.speed>20);assert.equal(g.tutorialActive,false);assert.equal(g.tutorialStage,'NORMAL');assert.equal(g.vaccinePower,10);assert.equal(g.warriorModeReady,true);assert.equal(g.powers.shield,1);assert.equal(g.flightMode,true);assert.ok(g.powers.flight>6.9);for(const power of ['boost','double','magnet'])assert.ok(g.powers[power]>3.9);
 }
});
test('later cycles reuse identical tunnel and village geometry rather than growing scenery',()=>{
 const g=quiet();for(const distance of [600,1600]){
  at(g,distance);const first=scenery(g,distance===600).filter(c=>!['#d3aa76'].includes(c.args[6]));
  at(g,distance+2600);const next=scenery(g,distance===600).filter(c=>!['#d3aa76'].includes(c.args[6]));
  assert.deepEqual(next,first);
 }
});


test('jungle entry shows its subtitle and blends without restarting the tutorial',()=>{
 const nodes=new Map(),g=game(93,nodes);at(g,1940);const first=g.environment.jungleTransition;at(g,1970);assert.ok(g.environment.jungleTransition>first);assert.ok(g.environment.jungleTransition<1);
 assert.ok(g.environment.visibleWorlds.some(w=>w.id==='JUNGLE_IMMUNITY_TRAIL'));const calls=scenery(g);assert.ok(calls.some(c=>c.args[6]==='#a8cd74'));assert.ok(calls.some(c=>c.args[6]==='#9a7855'));
 at(g,2000);assert.equal(nodes.get('#world-label').textContent,'JUNGLE IMMUNITY TRAIL');assert.equal(nodes.get('#world-subtitle').textContent,'KEEP IMMUNITY STRONG');assert.equal(g.worldLabelTime,2);assert.equal(g.tutorialActive,false);g.updateWorld(2.1);assert.equal(nodes.get('#world-label-panel').hidden,true);
 at(g,4600);assert.equal(nodes.get('#world-label').textContent,'JUNGLE IMMUNITY TRAIL');assert.equal(g.worldLabelTime,2);
});
test('jungle has bounded deterministic near/mid/far plants, rocks, mushrooms, vines and trees',()=>{
 const g=quiet();for(const distance of [2200,4800,10402200]){
  at(g,distance);const calls=scenery(g);assert.ok(calls.length<1500);assert.deepEqual(calls,scenery(g));
  for(const color of ['#9a7855','#87bd94','#57934f','#9fae9c','#e6a267','#80c177','#a4cc76'])assert.ok(calls.some(c=>c.args[6]===color),color);
  assert.ok(calls.some(c=>Math.abs(c.args[0])===23));assert.ok(calls.some(c=>Math.abs(c.args[0])===6.5));
  const decorations=calls.filter(c=>['#9a7855','#57934f','#9fae9c','#e6a267','#80c177','#87bd94'].includes(c.args[6]));
  assert.ok(decorations.every(c=>Math.abs(c.args[0])-c.args[3]>4.5));
  const arches=calls.filter(c=>c.args[6]==='#a3895f'&&Math.abs(c.args[0])<5);assert.ok(arches.length>0);assert.ok(arches.every(c=>c.args[1]-c.args[4]-c.args[3]*Math.sin(.06)>14));
 }
 at(g,2200);const a=scenery(g).filter(c=>c.args[6]==='#9a7855');at(g,4800);const b=scenery(g).filter(c=>c.args[6]==='#9a7855');assert.deepEqual(a,b);
});
test('jungle exit opens the canopy and returns its palette smoothly before cycle wraps',()=>{
 const g=quiet();at(g,2500);let previous=g.environment.cityReturn;
 for(let d=2501;d<2600;d++){at(g,d);assert.ok(g.environment.cityReturn>=previous);assert.ok(g.environment.cityReturn-previous<.04);previous=g.environment.cityReturn;}
 assert.ok(previous>.99);at(g,2600);assert.equal(g.environment.id,'BRIGHT_CITY');assert.equal(g.environment.worldDistance,0);assert.equal(g.distance,2600);
 g.start();assert.equal(g.environment.id,'BRIGHT_CITY');assert.equal(g.environment.cycle,0);
});
