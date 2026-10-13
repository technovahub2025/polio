const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game.cjs');
function training(){const nodes=new Map();return {g:game(93,nodes,true),nodes};}
function advance(g,seconds){for(let i=0;i<Math.ceil(seconds/.01);i++)g.update(.01);}
function until(g,condition,max=1500){for(let i=0;i<max&&!condition();i++)g.update(.01);assert.ok(condition(),'condition reached in bounded time');}
function move(g,direction){g.action(direction);advance(g,.3);}
function jumpStage(g){move(g,'left');move(g,'right');assert.equal(g.tutorialStage,'JUMP');}
function clear(g,action){const o=g.items.find(o=>o.training&&!o.airDrop);until(g,()=>o.z>=4-g.speed*(action==='jump'?.4:.23));g.action(action);until(g,()=>!g.items.includes(o));}
function vaccines(g){jumpStage(g);clear(g,'jump');assert.equal(g.tutorialStage,'ROLL');clear(g,'slide');assert.equal(g.tutorialStage,'VACCINE');}
function flight(g){vaccines(g);until(g,()=>g.tutorialStage==='SHIELD_COLLECT');until(g,()=>g.tutorialStage==='SHIELD_DEMO');until(g,()=>g.tutorialStage==='FLIGHT_COLLECT');until(g,()=>g.tutorialStage==='FLIGHT_CONTROL');}
test('starts centered at MOVE_LEFT; time, wrong input and unfinished movement cannot advance',()=>{
 const {g,nodes}=training();nodes.get('#start').onclick();assert.equal(g.lane,0);assert.equal(g.tutorialStage,'MOVE_LEFT');advance(g,10);assert.equal(g.tutorialStage,'MOVE_LEFT');assert.equal(g.items.length,0);
 move(g,'right');assert.equal(g.tutorialStage,'MOVE_LEFT');move(g,'left');assert.equal(g.tutorialStage,'MOVE_LEFT');g.action('left');assert.equal(g.tutorialStage,'MOVE_LEFT');g.update(.01);assert.equal(g.tutorialStage,'MOVE_LEFT');advance(g,.3);assert.equal(g.tutorialStage,'MOVE_RIGHT');assert.match(nodes.get('#tutorial-feedback').textContent,/✓/);
 g.action('left');advance(g,1);assert.equal(g.tutorialStage,'MOVE_RIGHT');move(g,'right');assert.equal(g.tutorialStage,'JUMP');assert.equal(g.items[0].type,'barrier');
});
test('jump press alone and failed barrier retry only JUMP, without game-over',()=>{
 const {g}=training();jumpStage(g);const original=g.items[0];g.action('jump');advance(g,1);assert.equal(g.tutorialStage,'JUMP');until(g,()=>!g.items.includes(original));assert.equal(g.tutorialStage,'JUMP');assert.equal(g.state,'running');assert.equal(g.items.filter(o=>o.training).length,1);assert.ok(g.items[0].z<0);clear(g,'jump');assert.equal(g.tutorialStage,'ROLL');
});
test('dodging tutorial obstacles cannot substitute for jumping or rolling',()=>{
 const {g}=training();jumpStage(g);let old=g.items[0];move(g,'right');until(g,()=>!g.items.includes(old));assert.equal(g.tutorialStage,'JUMP');clear(g,'jump');assert.equal(g.tutorialStage,'ROLL');old=g.items[0];move(g,'left');until(g,()=>!g.items.includes(old));assert.equal(g.tutorialStage,'ROLL');assert.equal(g.state,'running');
});
test('roll press alone does not count; failed roll retries and a real somersault clear advances',()=>{
 const {g}=training();jumpStage(g);clear(g,'jump');const old=g.items[0];g.action('slide');advance(g,1);assert.equal(g.tutorialStage,'ROLL');until(g,()=>!g.items.includes(old));assert.equal(g.tutorialStage,'ROLL');assert.equal(g.state,'running');clear(g,'slide');assert.equal(g.tutorialStage,'VACCINE');
});
test('three real vaccine contacts update the existing meter and progress; missed drops reoffer',()=>{
 const {g,nodes}=training();vaccines(g);until(g,()=>g.tutorialVaccines===1);assert.equal(g.vaccinePower,1);assert.equal(nodes.get('#tutorial-progress').textContent,'VACCINES 1/3');move(g,'right');advance(g,2);assert.equal(g.tutorialVaccines,1);assert.equal(g.tutorialStage,'VACCINE');until(g,()=>g.tutorialStage==='SHIELD_COLLECT');assert.equal(g.vaccinePower,3);assert.equal(g.tutorialVaccines,3);assert.equal(nodes.get('#vaccine-count').textContent,'3/10');assert.equal(nodes.get('#tutorial-feedback').textContent,'VACCINES 3/3 ✓');
});
test('guaranteed shield pickup uses existing protection and real absorbed collision to advance',()=>{
 const {g,nodes}=training();vaccines(g);until(g,()=>g.tutorialStage==='SHIELD_COLLECT');let o=g.items.find(o=>o.type==='shield');assert.equal(o.lane,g.lane);assert.ok(o.z<0);move(g,'right');until(g,()=>!g.items.includes(o));assert.equal(g.tutorialStage,'SHIELD_COLLECT');until(g,()=>g.tutorialStage==='SHIELD_DEMO');assert.equal(g.powers.shield,1);assert.equal(nodes.get('#tutorial-feedback').textContent,'PROTECTED!');
 o=g.items.find(o=>o.type==='virus');move(g,'left');until(g,()=>!g.items.includes(o));assert.equal(g.tutorialStage,'SHIELD_DEMO');assert.equal(g.powers.shield,1);until(g,()=>g.tutorialStage==='FLIGHT_COLLECT');assert.equal(g.powers.shield,0);assert.ok(g.shieldBreak>0);assert.ok(g.invincible>0);assert.equal(nodes.get('#message').textContent,'SHIELD BROKEN!');assert.equal(g.state,'running');
});
test('flight reuses existing activation, requires settled steering during powered flight and waits for landing',()=>{
 const {g,nodes}=training();let calls=0;const activate=g.activateFlight.bind(g);g.activateFlight=()=>{calls++;activate();};flight(g);assert.equal(calls,1);assert.equal(g.powers.flight,7);assert.equal(g.animationState,'FLYING');assert.equal(nodes.get('#tutorial-message').textContent,'FLY!');
 until(g,()=>g.powers.flight===0);assert.equal(g.tutorialFlightMoved,false);assert.equal(g.tutorialStage,'FLIGHT_CONTROL');move(g,'right');assert.equal(g.tutorialFlightMoved,false);until(g,()=>g.tutorialStage==='FLIGHT_COLLECT');assert.equal(g.jumpY,0);until(g,()=>g.tutorialStage==='FLIGHT_CONTROL');assert.equal(calls,2);move(g,'left');assert.equal(g.tutorialFlightMoved,true);until(g,()=>g.powers.flight===0);assert.equal(g.tutorialStage,'FLIGHT_CONTROL');until(g,()=>g.tutorialStage==='COMPLETE');assert.equal(g.flightMode,false);assert.equal(g.jumpY,0);assert.equal(nodes.get('#tutorial-message').textContent,'TRAINING COMPLETE!');
 const score=g.score,travel=g.travel;advance(g,.8);assert.equal(nodes.get('#tutorial-message').textContent,"LET'S FIGHT POLIO!");advance(g,1.1);assert.equal(g.tutorialStage,'NORMAL');assert.ok(g.score>score&&g.travel>travel);assert.equal(g.vaccinePower,3);assert.equal(nodes.get('#tutorial').hidden,true);advance(g,1);assert.ok(g.items.some(o=>o.type==='virus'));g.items=[{type:'barrier',lane:g.lane,z:4}];g.update(.01);assert.equal(g.state,'over');
});
test('normal spawn clocks freeze in training; missed flight reoffers in a reachable lane',()=>{
 const {g}=training();vaccines(g);until(g,()=>g.tutorialStage==='FLIGHT_COLLECT');const old=g.items.find(o=>o.type==='flight');move(g,'right');until(g,()=>!g.items.includes(old));assert.equal(g.tutorialStage,'FLIGHT_COLLECT');const next=g.items.find(o=>o.type==='flight');assert.equal(next.lane,g.lane);assert.ok(next.z<0);assert.equal(g.virusIn,.5);assert.equal(g.spawnIn,12);assert.equal(g.powerIn,40);assert.equal(g.powerIndex,0);
});
test('skip in every stage removes training objects, keeps powers/score and restores ordinary death',()=>{
 for(const stage of ['MOVE_LEFT','MOVE_RIGHT','JUMP','ROLL','VACCINE','SHIELD_COLLECT','SHIELD_DEMO','FLIGHT_COLLECT','FLIGHT_CONTROL','COMPLETE']){
  const {g,nodes}=training();g.setTutorialStage(stage);g.update(.01);g.items.push({type:'drop',lane:0,z:-10,training:true});g.score=123;g.vaccinePower=3;nodes.get('#tutorial-skip').onclick();assert.equal(g.tutorialStage,'NORMAL');assert.equal(g.tutorialActive,false);assert.equal(g.items.some(o=>o.training),false);assert.equal(g.score,123);assert.equal(g.vaccinePower,3);assert.equal(nodes.get('#tutorial-message').textContent,'');assert.equal(nodes.get('#tutorial').hidden,true);g.items=[{type:'barrier',lane:0,z:4}];g.update(.01);assert.equal(g.state,'over');
 }
 const {g}=training();flight(g);g.endTutorial();assert.equal(g.powers.flight,7);assert.equal(g.flightMode,true);
});
test('pause freezes tutorial and restart clears progress and returns to MOVE_LEFT',()=>{
 const {g,nodes}=training();vaccines(g);advance(g,.3);g.togglePause();g.frame(1000);const time=g.tutorialTime,z=g.items[0].z;g.frame(2000);assert.equal(g.tutorialTime,time);assert.equal(g.items[0].z,z);assert.equal(nodes.get('#tutorial').hidden,true);g.resume();g.frame(2020);assert.equal(nodes.get('#tutorial').hidden,false);g.start();assert.equal(g.tutorialStage,'MOVE_LEFT');assert.equal(g.tutorialVaccines,0);assert.equal(g.tutorialFlightMoved,false);assert.equal(g.vaccinePower,0);assert.equal(g.lane,0);assert.equal(g.items.length,0);
});
