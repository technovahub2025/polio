const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('player-rig.js','utf8')+';this.Rig=PlayerRig;',ctx);
const base={animationState:'RUN',runPhase:0,slide:0,rollDuration:.68,airPose:0,landingImpact:0};
const pose=(changes={})=>ctx.Rig.pose({...base,...changes});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('alternating gait keeps stance soles grounded and both leg bones constant',()=>{
 for(let i=0;i<240;i++){
  const p=pose({runPhase:i*Math.PI*2/240});
  assert.notEqual(p.legs[0].stance,p.legs[1].stance);
  for(const l of p.legs){if(l.stance)assert.equal(l.foot[1],.13);assert.ok(Math.abs(distance(l.hip,l.knee)-.56)<1e-8);assert.ok(Math.abs(distance(l.knee,l.foot)-.54)<1e-8);assert.ok(l.knee[2]<l.foot[2]*(l.knee[1]-l.hip[1])/(l.foot[1]-l.hip[1]),'knees bend forward relative to the hip-to-ankle line');}
 }
});
test('gait loops seamlessly with opposite shoulders',()=>{
 const a=pose(),b=pose({runPhase:Math.PI*2});
 for(let i=0;i<2;i++){assert.ok(distance(a.legs[i].foot,b.legs[i].foot)<1e-9);assert.ok(Math.abs(a.arms[i].shoulder-b.arms[i].shoulder)<1e-9);}
 assert.ok(a.arms[0].shoulder<0&&a.arms[1].shoulder>0);
});
test('roll folds individual joints, completes one forward revolution and releases',()=>{
 const mid=pose({animationState:'SOMERSAULT',slide:.34});assert.equal(mid.tuck,1);assert.ok(mid.turn< -Math.PI&&mid.turn> -Math.PI*1.3);assert.ok(mid.arms.every(a=>a.elbow>2));
 const end=pose({animationState:'SOMERSAULT',slide:0});assert.equal(end.tuck,0);assert.equal(end.turn,-Math.PI*2);assert.equal(pose().turn,0);
});
test('airborne joints remain active and poses stay finite across action boundaries',()=>{
 const a=pose({animationState:'JUMP',airPose:1}),b=pose({animationState:'FALL',airPose:1,runPhase:1});assert.notEqual(a.legs[0].foot[1],b.legs[0].foot[1]);
 for(const state of ['IDLE','RUN','JUMP','FALL','LAND','SOMERSAULT','HIT','DEATH'])for(let i=0;i<=50;i++){
  const p=pose({animationState:state,slide:.68*i/50,runPhase:i*.5,deathTime:i/50});
  for(const leg of p.legs)for(const joint of [leg.hip,leg.knee,leg.foot])assert.ok(joint.every(Number.isFinite));
 }
});

