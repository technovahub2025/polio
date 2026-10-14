const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {game}=require('./helpers/game.cjs');
function quiet(nodes=new Map()){const g=game(93,nodes);g.items=[];g.spawnIn=g.virusIn=g.powerIn=1e9;return g;}
function snapshot(g){const {state,last,canvas,scene,...simulation}=g;return JSON.stringify(simulation);}
function frozen(g){g.pause();const before=snapshot(g);for(let i=0;i<100;i++){g.update(.04);g.frame(10000+i*40);g.action('left');g.action('jump');g.action('slide');g.loseLife();}assert.equal(snapshot(g),before);assert.equal(g.state,'paused');return before;}
test('pause freezes all simulation, collisions, lives, power timers, particles and toast feedback',()=>{
 const nodes=new Map(),g=quiet(nodes);g.items=[{type:'virus',lane:0,z:4},{type:'shield',lane:0,z:4},{type:'vaccine',lane:0,z:4}];
 Object.assign(g.powers,{shield:1,boost:3,double:4,magnet:5});g.invincible=.7;g.lifePulse=.4;g.shieldBreak=.2;
 g.action('right');g.action('jump');g.burst(0,1,4,'#fff');g.toast('test');g.updateHUD();assert.equal(nodes.get('#pause').hidden,false);
 nodes.get('#pause').onclick();assert.equal(nodes.get('#pause-overlay').hidden,false);const before=frozen(g);
 nodes.get('#pause-resume').onclick();assert.equal(g.state,'running');assert.equal(snapshot(g),before);assert.equal(nodes.get('#pause-overlay').hidden,true);
 const d=g.distance;g.frame(999999);assert.equal(g.distance,d);g.frame(1000015);assert.ok(g.distance>d);assert.ok(g.powers.double<4);
});
test('jump, roll and flight resume from the same pose and timers',()=>{
 for(const action of ['jump','slide','flight']){const g=quiet();if(action==='flight'){g.activateFlight();g.flightPathIn=1e9;}else g.action(action);g.update(.1);
  const before=frozen(g);g.resume();assert.equal(snapshot(g),before);g.update(.02);assert.notEqual(snapshot(g),before);
 }
});
test('world transitions and cycle boundaries freeze without skipping ahead on resume',()=>{
 for(const distance of [449,499,849,1399,1999,2599]){const g=quiet();g.distance=distance;g.updateWorld(0);const before=frozen(g);g.resume();assert.equal(snapshot(g),before);g.update(.01);assert.ok(g.distance>distance&&g.distance<distance+1);}
});
test('pause restart and menu reuse full reset and never resume from non-paused states',()=>{
 const nodes=new Map(),g=quiet(nodes);g.lives=2;g.distance=3000;g.score=900;g.vaccinePower=8;g.powers.shield=1;g.pause();
 nodes.get('#pause-restart').onclick();assert.equal(g.state,'running');assert.equal(g.lives,5);assert.equal(g.distance,0);assert.equal(g.score,0);assert.equal(g.vaccinePower,0);assert.equal(g.powers.shield,0);assert.equal(g.tutorialStage,'MOVE_LEFT');assert.equal(nodes.get('#pause-overlay').hidden,true);
 g.pause();nodes.get('#pause-menu').onclick();assert.equal(g.state,'start');assert.equal(g.lives,5);assert.ok(g.items.length>0);g.resume();assert.equal(g.state,'start');
 const d=g.distance;g.frame(1000);g.frame(1040);assert.equal(g.distance,d);assert.ok(g.travel>0);
});
test('Escape/P ignore key repeats, work with focused buttons; visibility and stale swipes are safe',()=>{
 const nodes=new Map(),g=quiet(nodes),listeners={},pointer={};
 g.canvas.addEventListener=(key,fn)=>pointer[key]=fn;g.canvas.setPointerCapture=()=>{};
 const document={hidden:false,addEventListener:(key,fn)=>listeners[key]=fn,querySelectorAll:()=>[],querySelector:key=>nodes.get(key)};
 const ctx={document};vm.createContext(ctx);vm.runInContext(fs.readFileSync('inputHandler.js','utf8')+'\nthis.setup=setupRunnerInput;',ctx);ctx.setup(g);
 const key=(key,repeat=false,button=false)=>listeners.keydown({key,repeat,preventDefault(){},target:{closest:selector=>button&&selector==='button,a'}});
 pointer.pointerdown({clientX:0,clientY:0,pointerId:1});key('Escape',false,true);assert.equal(g.state,'paused');key('Escape',true);assert.equal(g.state,'paused');key('ArrowRight');assert.equal(g.lane,0);
 key('p',false,true);assert.equal(g.state,'running');pointer.pointerup({clientX:100,clientY:0});assert.equal(g.lane,0);
 document.hidden=true;listeners.visibilitychange();assert.equal(g.state,'paused');document.hidden=false;listeners.visibilitychange();assert.equal(g.state,'paused');key('Enter');assert.equal(g.state,'running');
 g.mainMenu();key('Escape');assert.equal(g.state,'start');
});
