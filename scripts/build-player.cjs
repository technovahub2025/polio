/* Reproducible, dependency-free mesh authoring for the reference doctor boy.
   The PNG is an appearance reference only; no pixels become a billboard.
   Output is a standard glTF 2.0 binary skin with editable named bones. */
const fs=require('node:fs'),path=require('node:path');
const OUT=path.resolve(__dirname,'../assets/doctor-boy.glb');
const bones=[
 ['Root',-1,[0,0,0]],['Pelvis',0,[0,1.23,0]],['Spine',1,[0,.25,0]],['Chest',2,[0,.48,0]],['Neck',3,[0,.22,0]],['Head',4,[0,.12,0]],
 ['Thigh.L',1,[-.20,0,0]],['Shin.L',6,[0,-.56,0]],['Foot.L',7,[0,-.54,0]],
 ['Thigh.R',1,[.20,0,0]],['Shin.R',9,[0,-.56,0]],['Foot.R',10,[0,-.54,0]],
 ['UpperArm.L',3,[-.43,.04,0]],['Forearm.L',12,[0,-.34,0]],['Hand.L',13,[0,-.32,0]],
 ['UpperArm.R',3,[.43,.04,0]],['Forearm.R',15,[0,-.34,0]],['Hand.R',16,[0,-.32,0]],
 ['CoatTail.L',1,[-.24,.13,.015]],['CoatTail.R',1,[.24,.13,.015]],['Stethoscope',3,[.34,-.10,.27]]
];
const world=bones.map((b,i)=>b[2].map((v,k)=>v+(b[1]<0?0:parentOffset(i,k))));
function parentOffset(i,k){let value=0,parent=bones[i][1];while(parent>=0){value+=bones[parent][2][k];parent=bones[parent][1];}return value;}
const P=[],N=[],C=[],J=[],W=[],I=[];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const color=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const white=color('#f7f5ff'),blue=color('#0570c6'),skin=color('#f4aa66'),navy=color('#073769'),brown=color('#663018');
function weight(j,w=1,j2=j){return {j:[j,j2,0,0],w:[w,1-w,0,0]};}
// Parametric patches use numerical derivatives for smooth normals, including
// wrinkles and locks. Vertices and weights are authored once, offline.
function surface(nu,nv,fn,col,weights,flip=false){
 const first=P.length/3;
 for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
  const s=u/nu,t=v/nv,p=fn(s,t),e=.0001;
  const sampleT=Math.max(e,Math.min(1-e,t));
  const du=sub(fn(Math.min(1,s+e),sampleT),fn(Math.max(0,s-e),sampleT)),dv=sub(fn(s,Math.min(1,sampleT+e)),fn(s,Math.max(0,sampleT-e)));
  let normal=norm(cross(du,dv));if(flip)normal=mul(normal,-1);
  const c=typeof col==='function'?col(s,t,p):col,b=typeof weights==='function'?weights(p,s,t):weight(weights);
  P.push(...p);N.push(...normal);C.push(...c);J.push(...b.j);W.push(...b.w);
  if(u<nu&&v<nv){const k=first+v*(nu+1)+u;if(flip)I.push(k,k+nu+2,k+1,k,k+nu+1,k+nu+2);else I.push(k,k+1,k+nu+2,k,k+nu+2,k+nu+1);}
 }
}
function ellipsoid(center,size,col,bone,nu=24,nv=14){surface(nu,nv,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI;return add(center,[size[0]*Math.cos(a)*Math.sin(b),size[1]*Math.cos(b),size[2]*Math.sin(a)*Math.sin(b)]);},col,bone);}
function tube(points,radii,col,bone,steps=30,sides=12){
 function curve(t){const f=t*(points.length-1),i=Math.min(points.length-2,Math.floor(f)),u=f-i;const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];return b.map((x,k)=>.5*((2*x)+(-a[k]+c[k])*u+(2*a[k]-5*x+4*c[k]-d[k])*u*u+(-a[k]+3*x-3*c[k]+d[k])*u*u*u));}
 surface(sides,steps,(u,t)=>{const p=curve(t),tangent=norm(sub(curve(Math.min(1,t+.001)),curve(Math.max(0,t-.001)))),side=norm(cross(tangent,Math.abs(tangent[1])>.95?[1,0,0]:[0,1,0])),up=cross(tangent,side),f=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(f)),r=radii[i]+(radii[i+1]-radii[i])*(f-i),a=u*Math.PI*2;return add(p,add(mul(side,r*Math.cos(a)),mul(up,r*Math.sin(a))));},col,bone);
}
function ring(center,rx,ry,r,col,bone){surface(32,8,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI*2;return add(center,[(rx+r*Math.cos(b))*Math.cos(a),(ry+r*Math.cos(b))*Math.sin(a),r*Math.sin(b)]);},col,bone);}
function box(center,size,col,bone){for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const a=(axis+1)%3,b=(axis+2)%3;surface(1,1,(u,v)=>{const p=[...center];p[axis]+=sign*size[axis];p[a]+=(u*2-1)*size[a];p[b]+=(v*2-1)*size[b];return p;},col,bone,sign<0);}}
function blendHeight(y,lo,hi,a,b){return weight(b,smooth((y-lo)/(hi-lo)),a);}
// Trousers: continuous surfaces across each weighted knee, with sewn creases.
for(let side=0;side<2;side++){
 const x=side?.20:-.20,thigh=side?9:6,shin=thigh+1,foot=thigh+2;
 surface(28,30,(u,v)=>{const y=.19+v*1.08,a=u*Math.PI*2,r=.125+.058*smooth(v),fold=.009*Math.sin(v*51+Math.cos(a)*2)*Math.pow(Math.sin(Math.PI*v),3);return [x+(r+fold)*Math.cos(a),y,(r*.94+fold)*Math.sin(a)];},(u,v)=>mul(blue,.84+.16*Math.sin(u*Math.PI*2)**2),p=>blendHeight(p[1],.58,.79,shin,thigh));
 // Sculpted sneaker volumes, outsole tread, side stripe, heel tab, and laces.
 const center=[x,.155,-.065];
 function shoe(y0,sy,rx,rz,col){surface(32,14,(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI,s=Math.sin(b);const z=Math.sin(a);return [x+rx*Math.cos(a)*s*(1-.10*z),y0+sy*Math.cos(b),-.075+rz*z*s];},col,foot);}
 shoe(.07,.055,.184,.295,color('#242733'));shoe(.113,.06,.19,.302,color('#f4f0fc'));shoe(.19,.10,.163,.265,blue);
 tube([[x-.16,.19,-.02],[x-.16,.20,.04],[x-.12,.21,.10],[x,.21,.12],[x+.12,.21,.10],[x+.16,.20,.04],[x+.16,.19,-.02]],[.027,.027],white,foot,22,8);
 for(let k=0;k<4;k++)tube([[x-.083,.245-k*.01,-.08-k*.034],[x,.256-k*.01,-.085-k*.034],[x+.083,.245-k*.01,-.09-k*.034]],[.011,.011],white,foot,8,6);
 for(let k=0;k<7;k++)box([x,.021,-.28+k*.067],[.125,.009,.012],color('#41404b'),foot);
}
// Torso coat is tailored rather than assembled from spheres. Circumference
// expands at the shoulders; subtle folds are part of the smooth mesh.
surface(48,30,(u,v)=>{const y=1.38+v*.71,a=u*Math.PI*2,rx=.33+.12*Math.sin(v*Math.PI*.78),rz=.235+.02*Math.sin(v*Math.PI);const fold=.007*Math.sin(a*7+v*12)*Math.sin(v*Math.PI);return [(rx+fold)*Math.cos(a),y,(rz+fold)*Math.sin(a)];},white,p=>blendHeight(p[1],1.55,1.92,2,3));
// Open coat skirt; the center-back slit forms two pointed moving panels.
for(let side=0;side<2;side++){
 const bone=side?19:18;
 surface(30,24,(u,v)=>{const a=(side?-.5:.5)*Math.PI+u*Math.PI,back=Math.max(0,Math.sin(a)),split=Math.pow(Math.max(0,1-Math.abs(Math.cos(a))/.18),2)*back;
 const rx=.35+.22*(1-v),rz=.24+.12*(1-v),y=.83+v*.69+.30*split*(1-v),flute=.02*Math.sin(a*5+v*2)*(1-v);
 return [(rx+flute)*Math.cos(a),y,(rz+flute)*Math.sin(a)+.035*(1-v)];},(u,v)=>mul(white,.92+.08*v),p=>blendHeight(p[1],1.28,1.48,bone,2));
}
// Back center seam, round embroidered patch, raised red cross.
tube([[0,1.50,.252],[0,1.66,.262],[0,1.77,.258]],[.004,.004],color('#d8d5e7'),3,12,6);
ellipsoid([0,1.86,.267],[.22,.225,.017],color('#d0cce1'),3,32,16);
ellipsoid([0,1.86,.279],[.207,.211,.014],white,3,32,16);
box([0,1.86,.299],[.048,.147,.01],color('#e60927'),3);box([0,1.86,.300],[.143,.046,.011],color('#e60927'),3);
// Sleeve + exposed forearm + fist, weighted at the elbow and wrist.
for(let side=0;side<2;side++){
 const sign=side?1:-1,upper=side?15:12,fore=upper+1,hand=upper+2,x=sign*.43;
 surface(28,24,(u,v)=>{const y=1.62+v*.40,a=u*Math.PI*2,r=.14+.055*v+.004*Math.sin(v*18)*Math.sin(v*Math.PI);return [x+r*Math.cos(a),y,r*Math.sin(a)];},white,p=>blendHeight(p[1],1.60,1.75,fore,upper));
 surface(24,20,(u,v)=>{const y=1.35+v*.34,a=u*Math.PI*2,r=.087+.027*v;return [x+r*Math.cos(a),y,r*Math.sin(a)];},skin,p=>blendHeight(p[1],1.35,1.43,hand,fore));
 if(!side){surface(24,5,(u,v)=>[x+.115*Math.cos(u*Math.PI*2),1.38+v*.065,.12*Math.sin(u*Math.PI*2)],navy,fore);box([x,1.42,.123],[.065,.040,.02],navy,fore);}
 ellipsoid([x,1.275,0],[.115,.14,.105],skin,hand);
 for(let k=0;k<4;k++)ellipsoid([x+(k-1.5)*.044,1.255,.065],[.025,.065,.047],mul(skin,1.01),hand,12,8);
 ellipsoid([x-sign*.075,1.30,-.025],[.057,.080,.058],skin,hand,14,10);
}
// Collar, stable head, warm ears and cheeks. The unseen front is reconstructed.
ellipsoid([0,2.18,0],[.13,.19,.14],skin,4);
ellipsoid([0,2.11,0],[.245,.065,.19],white,4);
ellipsoid([0,2.60,-.02],[.43,.48,.39],skin,5,40,30);
for(const sign of [-1,1]){
 ellipsoid([sign*.428,2.47,.005],[.092,.139,.086],skin,5,20,14);
 ellipsoid([sign*.461,2.48,.056],[.043,.08,.025],color('#e78c53'),5,16,10);
 ellipsoid([sign*.17,2.62,-.367],[.086,.11,.025],white,5,20,14);
 ellipsoid([sign*.17,2.62,-.389],[.044,.071,.016],color('#543120'),5,20,14);
 ellipsoid([sign*.17,2.625,-.402],[.023,.048,.011],color('#19202a'),5,16,10);
 ellipsoid([sign*.155,2.654,-.414],[.011,.015,.005],white,5,12,8);
 tube([[sign*.085,2.75,-.354],[sign*.17,2.78,-.356],[sign*.255,2.75,-.331]],[.022,.025,.013],brown,5,12,8);
}
ellipsoid([0,2.48,-.410],[.062,.073,.072],skin,5,20,14);
tube([[-.08,2.35,-.351],[0,2.33,-.371],[.08,2.35,-.351]],[.010,.010],color('#ad6146'),5,16,6);
// Hair cap stops above the ears in front and sweeps down to the nape in back.
surface(48,24,(u,v)=>{const a=u*Math.PI*2,back=(Math.sin(a)+1)/2,b=v*(1.39+back*.96);return [.451*Math.cos(a)*Math.sin(b),2.70+.45*Math.cos(b),.024+.419*Math.sin(a)*Math.sin(b)];},brown,5);
// Broad tapered locks follow cubic sweeps; longitudinal grooves are actual
// geometry, with warm ridges and dark creases instead of separate round blobs.
function lock(points,width,depth,tint){
 function curve(t){const s=1-t;return points[0].map((_,k)=>s*s*s*points[0][k]+3*s*s*t*points[1][k]+3*s*t*t*points[2][k]+t*t*t*points[3][k]);}
 surface(20,24,(u,t)=>{const p=curve(t),tangent=norm(sub(curve(Math.min(1,t+.001)),curve(Math.max(0,t-.001)))),normal=norm([p[0]/.45,(p[1]-2.7)/.45,(p[2]-.024)/.42]),side=norm(cross(tangent,normal)),out=norm(cross(side,tangent)),a=u*Math.PI*2,taper=Math.pow(Math.sin(Math.PI*(.08+.92*t)),.72),groove=1+.045*Math.cos(a*9+t*4);return add(p,add(mul(side,width*taper*Math.cos(a)),mul(out,depth*taper*Math.sin(a)*groove)));},(u,t)=>mul(tint,.78+.22*Math.sin(u*Math.PI)**2+.07*Math.sin(t*Math.PI)),5);
}
// Shingled, broad locks hug the scalp. Each has a tapered point and a
// gently raised ridge; their silhouette follows the reference's swept hair.
for(let row=0;row<3;row++)for(let k=0;k<8;k++){
 const angle=k/8*Math.PI*2+row*.29,start=.20+row*.48;
 surface(16,20,(u,t)=>{
  const width=.40*Math.pow(Math.sin(Math.PI*(.025+.975*t)),.7),a=angle+.42*t+(u-.5)*width*2;
  const back=(Math.sin(a)+1)/2,b=start+t*(.73+back*.12),ridge=Math.sin(u*Math.PI)**.7;
  const raise=.013+.042*Math.sin(Math.PI*t)*ridge+.002*Math.cos(u*22+t*3)*ridge;
  return [( .451+raise)*Math.cos(a)*Math.sin(b),2.70+(.45+raise)*Math.cos(b),.024+(.419+raise)*Math.sin(a)*Math.sin(b)];
 },(u,t)=>mul(color(k%3===0?'#824122':k%3===1?'#6b3018':'#5c2916'),.86+.14*Math.sin(u*Math.PI)+.08*Math.sin(t*Math.PI)),5);
}
lock([[-.27,3.03,.02],[-.28,3.20,.03],[-.08,3.29,.02],[.03,3.25,.0]],.15,.035,color('#743719'));
lock([[-.09,3.08,.13],[.08,3.26,.13],[.32,3.19,.13],[.40,3.10,.09]],.16,.035,color('#844020'));
lock([[.12,3.02,.21],[.29,3.16,.19],[.44,3.09,.16],[.47,3.06,.11]],.12,.028,color('#743419'));
// Blue stethoscope wraps the collar; its dangling section gets a swing bone.
tube([[-.19,2.12,.08],[-.16,2.16,.21],[.05,2.18,.235],[.28,2.10,.23],[.34,1.98,.25]],[.026,.027],navy,3,32,10);
tube([[.34,1.99,.26],[.37,1.75,.275],[.39,1.48,.30],[.48,1.22,.32],[.50,1.10,.34]],[.026,.025],navy,20,28,10);
tube([[.40,1.45,.30],[.52,1.24,.30],[.54,1.05,.34],[.43,.98,.34],[.34,1.04,.34]],[.015,.015],color('#bac5d5'),20,26,8);
ring([.50,1.13,.355],.068,.077,.016,color('#c8d5e1'),20);ellipsoid([.50,1.13,.354],[.046,.054,.012],navy,20,20,12);
for(const x of [.34,.54])ellipsoid([x,1.035,.34],[.039,.040,.032],navy,20,14,10);
// Serialize standard GLB accessors and a named, editable skeleton.
const parts=[],views=[],accessors=[];let offset=0;
function accessor(values,ArrayType,type,componentType,target){const a=new ArrayType(values),bytes=Buffer.from(a.buffer),pad=(4-bytes.length%4)%4;const view=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});parts.push(bytes,Buffer.alloc(pad));offset+=bytes.length+pad;const components={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type];const obj={bufferView:view,componentType,count:values.length/components,type};if(type==='VEC3'&&values===P){obj.min=[0,1,2].map(k=>Math.min(...values.filter((_,i)=>i%3===k)));obj.max=[0,1,2].map(k=>Math.max(...values.filter((_,i)=>i%3===k)));}accessors.push(obj);return accessors.length-1;}
const attributes={POSITION:accessor(P,Float32Array,'VEC3',5126,34962),NORMAL:accessor(N,Float32Array,'VEC3',5126,34962),COLOR_0:accessor(C,Float32Array,'VEC3',5126,34962),JOINTS_0:accessor(J,Uint8Array,'VEC4',5121,34962),WEIGHTS_0:accessor(W,Float32Array,'VEC4',5126,34962)};
if(P.length/3>65535)throw Error('Mesh exceeds WebGL 1 index budget');
const indices=accessor(I,Uint16Array,'SCALAR',5123,34963);
const inverse=world.flatMap(p=>[1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1]);const inverseBindMatrices=accessor(inverse,Float32Array,'MAT4',5126);
const nodes=bones.map(([name,parent,translation],i)=>{const children=bones.map((b,j)=>b[1]===i?j:-1).filter(j=>j>=0);return {name,translation,...(children.length?{children}:{})};});nodes.push({name:'DoctorBoy_SkinnedMesh',mesh:0,skin:0});
const json={asset:{version:'2.0',generator:'Drop Dash reference character mesh authoring',extras:{reference:'texture/player.png',appearance:'Reconstruction from a single rear view; hidden surfaces inferred.'}},scene:0,scenes:[{nodes:[0,bones.length]}],nodes,skins:[{name:'DoctorBoy_Skeleton',joints:bones.map((_,i)=>i),skeleton:0,inverseBindMatrices}],meshes:[{name:'DoctorBoy',primitives:[{attributes,indices,material:0}]}],materials:[{name:'VertexPaintedDoctor',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.57},doubleSided:true}],buffers:[{byteLength:offset}],bufferViews:views,accessors};
// Bake portable glTF clips from the same pose/skeleton evaluator used in-game.
// Runtime keeps procedural foot placement so speed/lane changes stay responsive.
const vm=require('node:vm'),math=require('../gl-matrix.js'),context={...math};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../player-rig.js'),'utf8')+';this.Rig=PlayerRig;',context);
const rig=Object.create(context.Rig.prototype);rig.asset={json,skin:json.skins[0],parents:bones.map(b=>b[1]),inverse:new Float32Array(inverse)};
rig.local=bones.map(()=>math.mat4.create());rig.world=bones.map(()=>math.mat4.create());rig.palette=new Float32Array(bones.length*16);rig.skinMatrices=bones.map((_,i)=>rig.palette.subarray(i*16,i*16+16));
json.animations=[];
for(const [name,duration] of [['RUN',Math.PI*2/8.64],['JUMP',.8],['LAND',.16],['SOMERSAULT',.68],['IDLE',2],['DEATH',.5]]){
 const frames=Math.ceil(duration*60),times=Array.from({length:frames+1},(_,i)=>i/frames*duration),translations=bones.map(()=>[]),rotations=bones.map(()=>[]);
 for(const time of times){const t=time/duration,g={animationState:name,runPhase:time*8.64,time,slide:name==='SOMERSAULT'?duration-time:0,rollDuration:.68,airPose:0,landingImpact:name==='LAND'?1-t:0,jumpTime:time,deathTime:name==='DEATH'?time:0};
  if(name==='JUMP'){g.animationState=t<.5?'JUMP':'FALL';g.airPose=Math.min(1,Math.max(0,8.8*time-11*time*time)*2);}
  rig.skeleton(context.Rig.pose(g));
  // Export clips with surface contact and ballistic root motion, so the GLB
  // is also playable in an editor without the game's physics controller.
  let minimum=Infinity;
  for(let v=0;v<P.length/3;v++){let height=0;for(let k=0;k<4;k++){const w=W[v*4+k];if(!w)continue;const b=J[v*4+k]*16;height+=w*(rig.palette[b+1]*P[v*3]+rig.palette[b+5]*P[v*3+1]+rig.palette[b+9]*P[v*3+2]+rig.palette[b+13]);}minimum=Math.min(minimum,height);}
  rig.local[0][13]+=.025-minimum+(name==='JUMP'?Math.max(0,8.8*time-11*time*time):0);
  for(let i=0;i<bones.length;i++){const m=rig.local[i],q=math.quat.create();math.mat4.getRotation(q,m);math.quat.normalize(q,q);
   if(rotations[i].length&&rotations[i].slice(-4).reduce((sum,v,k)=>sum+v*q[k],0)<0)for(let k=0;k<4;k++)q[k]=-q[k];
   translations[i].push(m[12],m[13],m[14]);rotations[i].push(...q);
  }
 }
 const input=accessor(times,Float32Array,'SCALAR',5126);accessors[input].min=[0];accessors[input].max=[duration];
 const clip={name,samplers:[],channels:[]};
 for(let i=0;i<bones.length;i++)for(const [target,values,type] of [['translation',translations[i],'VEC3'],['rotation',rotations[i],'VEC4']]){
  clip.channels.push({sampler:clip.samplers.length,target:{node:i,path:target}});clip.samplers.push({input,output:accessor(values,Float32Array,type,5126),interpolation:'LINEAR'});
 }
 json.animations.push(clip);
}
json.buffers[0].byteLength=offset;
let js=Buffer.from(JSON.stringify(json));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,32)]);const bin=Buffer.concat(parts),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+js.length+bin.length,8);jh.writeUInt32LE(js.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,Buffer.concat([header,jh,js,bh,bin]));console.log(JSON.stringify({asset:OUT,vertices:P.length/3,triangles:I.length/3,bones:bones.length,bytes:28+js.length+bin.length}));
