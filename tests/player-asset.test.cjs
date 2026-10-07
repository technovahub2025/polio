const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const math=require('../gl-matrix.js'),context={...math,TextDecoder};vm.createContext(context);
vm.runInContext(fs.readFileSync('player-asset.js','utf8')+';this.Asset=PlayerAsset;',context);
vm.runInContext(fs.readFileSync('player-rig.js','utf8')+';this.Rig=PlayerRig;',context);
const bytes=fs.readFileSync('assets/doctor-boy.glb'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),asset=context.Asset.decode(buffer);
function rig(){const r=Object.create(context.Rig.prototype);r.asset=asset;r.local=asset.parents.map(()=>math.mat4.create());r.world=asset.parents.map(()=>math.mat4.create());r.palette=new Float32Array(asset.parents.length*16);r.skinMatrices=asset.parents.map((_,i)=>r.palette.subarray(i*16,i*16+16));return r;}
function bounds(r){const a=asset.attributes;let bottom=Infinity,top=-Infinity;for(let i=0;i<a.POSITION.length/3;i++){let y=0;for(let k=0;k<4;k++){const w=a.WEIGHTS_0[i*4+k],m=a.JOINTS_0[i*4+k]*16;y+=w*(r.palette[m+1]*a.POSITION[i*3]+r.palette[m+5]*a.POSITION[i*3+1]+r.palette[m+9]*a.POSITION[i*3+2]+r.palette[m+13]);}bottom=Math.min(bottom,y);top=Math.max(top,y);}return {bottom,top};}
test('bundled GLB contains weighted geometry, a valid hierarchy and portable animation clips',()=>{
 assert.equal(asset.skin.joints.length,21);assert.equal(asset.parents.filter(p=>p===-1).length,1);
 asset.parents.forEach((p,i)=>assert.ok(p<i));
 const a=asset.attributes,count=a.POSITION.length/3;assert.ok(count>10000&&count<65536);assert.equal(a.WEIGHTS_0.length,count*4);
 let blended=0;for(let i=0;i<count;i++){
  let sum=0;for(let k=0;k<4;k++){const j=a.JOINTS_0[i*4+k],w=a.WEIGHTS_0[i*4+k];assert.ok(j<21&&w>=0&&w<=1);sum+=w;}
  assert.ok(Math.abs(sum-1)<1e-6);if(a.WEIGHTS_0[i*4+1]>0&&a.WEIGHTS_0[i*4+1]<1)blended++;
  const length=Math.hypot(...a.NORMAL.subarray(i*3,i*3+3));assert.ok(Math.abs(length-1)<1e-4,`normal ${i}: ${length}`);
 }
 assert.ok(blended>1000);assert.ok(asset.indices.every(i=>i<count));
 for(const name of ['RUN','JUMP','LAND','SOMERSAULT','IDLE','DEATH'])assert.ok(asset.json.animations.some(a=>a.name===name));
 assert.throws(()=>context.Asset.decode(new ArrayBuffer(12)),/Invalid/);
});
test('rendered bone endpoints follow the foot IK rather than detached rigid parts',()=>{
 const r=rig();for(let frame=0;frame<60;frame++){
  const q=context.Rig.pose({animationState:'RUN',runPhase:frame*Math.PI/30});r.skeleton(q);
  for(let side=0;side<2;side++)for(const [index,target] of [[side?9:6,q.legs[side].hip],[side?10:7,q.legs[side].knee],[side?11:8,q.legs[side].foot]])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(r.world[index][12+axis]-target[axis])<1e-5);
 }
});
test('the fully tucked skinned body fits below an overhead, throughout its revolution',()=>{
 const r=rig();let max=0;
 for(let frame=16;frame<=78;frame+=2){const q=context.Rig.pose({animationState:'SOMERSAULT',slide:.68*(1-frame/100),rollDuration:.68,runPhase:1});r.skeleton(q);const b=bounds(r);max=Math.max(max,b.top-b.bottom);}
 assert.ok(max<1.745,`actual tucked mesh height ${max.toFixed(3)} exceeds overhead underside 1.77`);
});
test('lane lean follows movement, leaves run phase intact, and is neutral after restart',()=>{
 for(const v of [-20,20]){const q=context.Rig.pose({animationState:'RUN',runPhase:2,laneVelocity:v});assert.equal(Math.sign(q.lean),-Math.sign(v));assert.equal(q.phase,2);}
 assert.ok(context.Rig.pose({animationState:'RUN',runPhase:0,laneVelocity:0}).lean===0);
});

test('contact support samples agree with the actual weighted mesh during roll entry, inversion and exit',()=>{
 Object.setPrototypeOf(asset,context.Asset.prototype);asset.prepareSupport();
 const r=rig();let maxError=0;
 for(let frame=1;frame<40;frame++){const q=context.Rig.pose({animationState:'SOMERSAULT',slide:.68*(1-frame/40),rollDuration:.68,runPhase:7});r.skeleton(q);maxError=Math.max(maxError,Math.abs(bounds(r).bottom-asset.bounds(r.palette).bottom));}
 assert.ok(maxError<.015,`contact surface error ${maxError}`);
});
