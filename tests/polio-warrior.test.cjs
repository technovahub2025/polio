const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {mat4,vec3}=require('../gl-matrix.js');
const ctx={mat4};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('player-rig.js','utf8')+'\n'+fs.readFileSync('polio-warrior.js','utf8')+'\nthis.Warrior=PolioWarrior;',ctx);
function render(changes={}) {
  const draws=[];
  const scene={view:mat4.create(),actorView:null};
  for(const kind of ['box','orb','capCrown','capVisor']) scene[kind]=(...args)=>{
    const matrix=mat4.clone(scene.actorView||scene.view);
    draws.push({kind,args,matrix,world:vec3.transformMat4([],args.slice(0,3),matrix)});
  };
  new ctx.Warrior(scene).render({x:0,jumpY:0,animationState:'RUN',runPhase:0,
    slide:0,rollDuration:.68,...changes});
  return {scene,draws};
}
test('front details face down the railway, cape faces the camera, and cap layers over short hair',()=>{
  const {draws}=render();
  for(const color of ['#c98263','#7c332f','#e4b33d','#ffd766']) {
    assert.ok(draws.find(d=>d.args[6]===color).world[2]<4,color);
  }
  const cape=draws.filter(d=>['#e21f32','#d7192d'].includes(d.args[6]));
  assert.equal(cape.length,20);
  assert.ok(cape.every(d=>d.world[2]>4));
  assert.ok(cape.at(-1).args[3]>cape[0].args[3]);
  const hair=draws.find(d=>d.kind==='orb'&&d.args[6]==='#241b20'
    &&d.args[3]===0.375&&d.args[4]===0.325);
  assert.ok(hair);
  const cap=draws.filter(d=>d.kind==='capCrown'||d.kind==='capVisor'
    ||d.args[6]==='#a51b2b'&&d.args[3]===0.20&&d.args[4]===0.024);
  assert.equal(cap.length,3);
  const crown=cap.find(d=>d.kind==='capCrown');
  const visor=cap.find(d=>d.kind==='capVisor');
  const strap=cap.find(d=>d.args[6]==='#a51b2b');
  assert.ok(crown.world[2]>draws.find(p=>p.args[6]==='#d99a74').world[2]);
  assert.ok(visor.world[2]<crown.world[2]);
  assert.ok(strap.world[2]>crown.world[2]);
  assert.ok(hair.world[2]>crown.world[2]);
});
test('normal grounded RUN omits the old dark oval shadow while airborne states keep it',()=>{
  const hasGroundShadow=draws=>draws.some(d=>d.kind==='orb'&&d.args[6]==='#575d58'
    &&d.args[4]===0.022&&d.args[5]===0.32);
  assert.equal(hasGroundShadow(render({animationState:'RUN'}).draws),false);
  assert.equal(hasGroundShadow(render({animationState:'FLYING',powers:{flight:4},jumpY:5}).draws),true);
  assert.equal(hasGroundShadow(render({animationState:'JUMP',jumpY:1}).draws),true);
});

test('home renders no procedural hero, and gameplay keeps the existing character',()=>{
  const home=render({state:'start',animationState:'IDLE'});
  assert.equal(home.draws.length,0,'no home hero or shadow behind the image');
  assert.equal(home.scene.playerPose,null);
  for(const animationState of ['RUN','JUMP','SOMERSAULT','FLYING','HIT','DEATH']){
    const game=render({state:'running',animationState});
    assert.equal(game.scene.playerPose.warrior,true);
    assert.ok(!game.draws.some(d=>String(d.args[6]).startsWith('home-')));
    assert.ok(game.draws.some(d=>d.kind==='capCrown'),'existing gameplay cap preserved');
  }
});
test('all animation states render finite geometry with connected body groups',()=>{
  for(const state of ['IDLE','RUN','JUMP','FALL','LAND','SOMERSAULT','FLYING','HIT','DEATH']) {
    const {scene,draws}=render({animationState:state,x:3,jumpY:1.2,
      runPhase:1.7,slide:.34,deathTime:.5,landingImpact:1});
    assert.equal(scene.actorView,null);
    assert.equal(scene.playerPose.state,state);
    for(const d of draws.slice(1)) {
      assert.ok(d.world.every(Number.isFinite),state);
      assert.ok(Array.from(d.matrix).every(Number.isFinite),state);
    }
  }
});
test('running cape moves and lane/jump translation carries every body part',()=>{
  const base=render().draws;
  const shifted=render({x:-3,jumpY:2}).draws;
  for(let i=1;i<base.length;i++) {
    assert.ok(Math.abs(shifted[i].world[0]-base[i].world[0]+3)<1e-6);
    assert.ok(Math.abs(shifted[i].world[1]-base[i].world[1]-2)<1e-6);
  }
  assert.notEqual(render({runPhase:1}).draws[20].world[0],base[20].world[0]);
});

test('sprint gait loops with fixed leg lengths, raised feet and opposed arms',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(let i=0;i<80;i++){
    const q=render({runPhase:i*Math.PI/40}).scene.playerPose;
    for(const leg of q.legs){
      assert.ok(Math.abs(distance(leg.hip,leg.knee)-.55)<1e-6);
      assert.ok(Math.abs(distance(leg.knee,leg.foot)-.53)<1e-6);
    }
  }
  const a=render({runPhase:0}).scene.playerPose,b=render({runPhase:Math.PI*2}).scene.playerPose;
  assert.ok(distance(a.legs[0].foot,b.legs[0].foot)<1e-6);
  assert.ok(a.arms[0].elbow[2]<0 && a.legs[0].foot[2]>0);
  assert.ok(render({runPhase:Math.PI/2}).scene.playerPose.legs.some(l=>l.foot[1]>.4));
});
test('lane lean responds in both directions and returns to neutral',()=>{
  const head=v=>render({laneVelocity:v}).draws.find(d=>d.args[6]==='#d99a74').world[0];
  assert.ok(head(16)>head(0));assert.ok(head(-16)<head(0));
  assert.ok(Math.abs(render({laneVelocity:0}).scene.playerPose.lean)<1e-9);
});
test('roll completes a forward revolution, landing compresses, and flight cape moves',()=>{
  const mid=render({animationState:'SOMERSAULT',slide:.34}).scene.playerPose;
  assert.equal(mid.tuck,1);assert.ok(mid.roll>Math.PI);
  assert.equal(render({animationState:'SOMERSAULT',slide:0}).scene.playerPose.roll,Math.PI*2);
  assert.ok(render({animationState:'LAND',landingImpact:1}).scene.playerPose.pelvis<render().scene.playerPose.pelvis);
  const a=render({animationState:'FLYING',time:0}).draws[20];
  const b=render({animationState:'FLYING',time:.3}).draws[20];
  assert.notEqual(a.world[0],b.world[0]);
});

test('tucked roll stays compact and rendered primitives remain above the ground',()=>{
  for(let i=0;i<=40;i++){
    const {draws,scene}=render({animationState:'SOMERSAULT',slide:.68*(1-i/40)});
    if(scene.playerPose.tuck===1)assert.ok(scene.playerPose.visualHeight<1.65);
    let bottom=Infinity;
    for(const d of draws.slice(1)){
      const a=d.args,m=mat4.clone(d.matrix),r=a[7]||[0,0,0];
      mat4.translate(m,m,a.slice(0,3));mat4.rotateX(m,m,r[0]);mat4.rotateY(m,m,r[1]);mat4.rotateZ(m,m,r[2]);
      const ext=[m[1]*a[3],m[5]*a[4],m[9]*a[5]];
      const radius=['orb','capCrown','capVisor'].includes(d.kind)?Math.hypot(...ext):ext.reduce((sum,v)=>sum+Math.abs(v),0);
      bottom=Math.min(bottom,m[13]-radius);
    }
    assert.ok(Math.abs(bottom-.025)<1e-5);
  }
});

test('superhero flight pitches body forward, reaches down-track and trails connected legs/cape',()=>{
  const {draws,scene}=render({animationState:'FLYING',powers:{flight:5},jumpY:5});
  const q=scene.playerPose;
  assert.ok(Math.abs(q.flightPitch-75*Math.PI/180)<1e-8);
  const torso=draws.find(d=>d.args[6]==='#faf9f3'&&d.kind==='box');
  assert.ok(Math.abs(torso.matrix[5]/1.06)<.3,'torso near horizontal');
  assert.ok(torso.matrix[6]<-.95,'body points down track');
  const arms=draws.filter(d=>d.kind==='orb'&&d.args[6]==='#d99872');
  assert.equal(arms.length,2);assert.ok(arms.every(d=>d.world[2]<torso.world[2]-.65));
  const feet=draws.filter(d=>d.args[6]==='#c91f32');
  assert.ok(feet.every(d=>d.world[2]>torso.world[2]+.8));
  const cape=draws.filter(d=>['#e21f32','#d7192d'].includes(d.args[6]));
  assert.ok(cape.at(-1).world[2]>cape[0].world[2]+1.5);
  assert.ok(cape.at(-1).args[3]>.8);
  const head=draws.find(d=>d.args[6]==='#d99a74'),nose=draws.find(d=>d.args[6]==='#c98263');
  assert.ok(nose.world[2]<head.world[2],'head still faces forward');
  for(const leg of q.legs){
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    assert.ok(Math.abs(distance(leg.hip,leg.knee)-.55)<1e-6);
    assert.ok(Math.abs(distance(leg.knee,leg.foot)-.53)<1e-6);
  }
});
test('flight entry and exit blend continuously, pause is deterministic, normal pose returns',()=>{
  const pose=n=>render({animationState:'FLYING',powers:{flight:n}}).scene.playerPose;
  assert.equal(pose(7).flight,0);assert.ok(pose(6.8).flight>0&&pose(6.8).flight<1);assert.equal(pose(6.5).flight,1);
  assert.ok(pose(.25).flight>0&&pose(.25).flight<1);assert.equal(pose(0).flight,0);
  assert.deepEqual(pose(.25),pose(.25));
  const bodyOnly=draws=>draws.filter(d=>d.args[6]!=='#575d58');
  const run=bodyOnly(render().draws),exit=bodyOnly(render({animationState:'FLYING',powers:{flight:0}}).draws);
  assert.equal(run.length,exit.length);
  for(let i=0;i<run.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(run[i].world[k]-exit[i].world[k])<1e-6);
});
test('flight keeps lane banking and translates whole character with player altitude',()=>{
  const base={animationState:'FLYING',powers:{flight:4},jumpY:5};
  const a=render(base),b=render({...base,x:3,jumpY:6});
  for(let i=1;i<a.draws.length;i++){
    assert.ok(Math.abs(b.draws[i].world[0]-a.draws[i].world[0]-3)<1e-6);
    assert.ok(Math.abs(b.draws[i].world[1]-a.draws[i].world[1]-1)<1e-6);
  }
  assert.ok(render({...base,laneVelocity:16}).scene.playerPose.lean<0);
  assert.ok(render({...base,laneVelocity:-16}).scene.playerPose.lean>0);
});

test('cape branding belongs only to the existing animated cloth in all poses',()=>{
  for(const state of ['IDLE','RUN','JUMP','FALL','LAND','SOMERSAULT','FLYING','HIT','DEATH']){
    for(const phase of [0,1.3,3.7]){
      const {draws}=render({animationState:state,runPhase:phase,time:phase,x:3,jumpY:1,
        laneVelocity:12,slide:.34,deathTime:.5,landingImpact:.5,powers:{flight:4}});
      const cloth=draws.filter(d=>d.args[8]!==undefined);
      assert.equal(cloth.length,20);
      cloth.forEach((d,i)=>{
        assert.equal(d.args[8],i);
        assert.ok(['#e21f32','#d7192d'].includes(d.args[6]));
        assert.ok(d.args[2]<0,'print belongs on rear cape geometry');
      });
      const chest=draws.find(d=>d.args[6]==='#e4b33d');
      assert.deepEqual(chest.args.slice(0,6),[0,1.48,.225,.14,.14,.035]);
      assert.equal(chest.args[8],undefined);
    }
  }
});

test('cape UV strips are upright and unmirrored from rear, with unprinted front and edges',()=>{
  vm.runInContext(fs.readFileSync('runner-scene.js','utf8')+'\nthis.Scene=RailwayScene;',ctx);
  const scene=Object.create(ctx.Scene.prototype);
  for(let i=0;i<20;i++){
    const uv=scene.capeUV(i);assert.equal(uv.length,48);
    // Rear vertices: local (-X,-Y), (+X,-Y), (+X,+Y), (-X,+Y).
    // The existing 180-degree root rotation maps local -X to screen right.
    assert.equal(uv[8],1);assert.equal(uv[10],0);
    assert.ok(uv[9]<uv[15],'canvas top maps to the upper cape edge');
    assert.ok(Math.abs((uv[9]+uv[15])/2-(1-(i+.5)/20))<1e-8);
    for(let vertex=0;vertex<24;vertex++)if(vertex<4||vertex>7)
      assert.equal(uv[vertex*2],.005,'non-rear faces sample plain red margin');
  }
});

test('canvas atlas paints both title lines and a smaller centered gear, and builds reusable strips',()=>{
  const text=[],arcs=[],translations=[],buffers=[];
  const paint=new Proxy({}, {get(target,key){
    if(key==='fillText')return (...args)=>text.push(args);
    if(key==='arc')return (...args)=>arcs.push(args);
    if(key==='translate')return (...args)=>translations.push(args);
    return ()=>{};
  }});
  ctx.initBuffers=(gl,mesh)=>{buffers.push(mesh);return mesh;};
  const scene=Object.create(ctx.Scene.prototype);scene.cube={positions:[1,2,3]};
  scene.texture=(name,fn)=>{assert.equal(name,'cape-branding');fn(paint);};
  scene.capeBranding();
  assert.deepEqual(text.map(t=>t[0]),['POLIO','WARRIOR']);
  assert.ok(text.every(t=>t[1]===128));assert.ok(text[0][2]<text[1][2]);
  assert.deepEqual(translations,[[128,163]]);assert.ok(arcs.every(a=>a[2]<30));
  assert.equal(buffers.length,20);assert.ok(buffers.every(b=>b.positions===scene.cube.positions));
});
