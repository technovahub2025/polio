/* Player-only articulated model. Coordinates face -Z; all joints are local to
   their parent. Reference: texture/player.png (not a billboard or skin warp). */
class PlayerRig {
  static smooth(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
  static mix(a,b,t){return a+(b-a)*t;}
  static pose(g){
    const S=this.smooth,M=this.mix,phase=g.runPhase||0;
    const state=g.animationState||'IDLE',idle=state==='IDLE';
    const roll=state==='SOMERSAULT',p=roll?Math.max(0,Math.min(1,1-g.slide/g.rollDuration)):0;
    const tuck=roll?S(p/.16)*(1-S((p-.78)/.22)):0;
    const turn=roll?-Math.PI*2*S((p-.14)/.66):0;
    const air=g.airPose||0,land=g.landingImpact||0;
    const takeoff=state==='JUMP'?1-S((g.jumpTime||0)/.14):0;
    const death=state==='HIT'||state==='DEATH'?S((g.deathTime||0)/.5):0;
    const flying=state==='FLYING';
    const running=idle?0:flying?.20:1;
    const pelvis=M(1.07+.025*Math.cos(phase*2)*running+(idle?.006*Math.sin((g.time||0)*2):0)-.10*land-.12*takeoff,.51,tuck);
    const legs=[];
    for(let side=0;side<2;side++){
      const cycle=((phase/(Math.PI*2)+side*.5)%1+1)%1;
      // Linear stance and raised swing; the shared phase follows travelled distance.
      const stance=cycle<.5,u=stance?cycle*2:(cycle-.5)*2;
      let z=stance?M(-.48,.48,u):M(.48,-.48,S(u));
      let y=.13+(stance?0:.44*Math.sin(Math.PI*u));
      if(idle){z=0;y=.13;}
      const airborneY=.36+.12*Math.sin(phase+side*Math.PI);
      y=M(y,airborneY,air*.8);z=M(z,side===0?-.32:.30,air*.65);
      y=M(y,pelvis-.05,tuck);z=M(z,-.34,tuck);
      const dy=y-pelvis,dz=z,d=Math.min(1.095,Math.hypot(dy,dz));
      const upper=.56,lower=.54,a=(upper*upper-lower*lower+d*d)/(2*d),h=Math.sqrt(Math.max(0,upper*upper-a*a));
      const ny=dy/Math.hypot(dy,dz),nz=dz/Math.hypot(dy,dz);
      legs.push({hip:[side===0?-.20:.20,pelvis,0],knee:[side===0?-.20:.20,pelvis+ny*a-nz*h,nz*a+ny*h],foot:[side===0?-.20:.20,y,z],stance,cycle});
    }
    return {state,phase,pelvis,legs,tuck,turn,land,air,death,flying,activity:running,
      torsoPitch:M((flying?-.22:-.10)-.08*takeoff, -1.70,tuck),
      yaw:Math.sin(phase)*.065*running*(1-tuck)*(1-air*.5),
      lean:Math.max(-.22,Math.min(.22,-(g.laneVelocity||0)*.014))*(1-tuck)*(1-death),
      arms:[0,1].map(i=>({shoulder:M(-Math.cos(phase+i*Math.PI)*.65*running,1.55,tuck),elbow:M(idle?.24:flying?.50:.85+.22*Math.cos(phase+i*Math.PI),2.05,tuck)}))};
  }
  constructor(scene){
    this.s=scene;this.asset=new PlayerAsset(scene.gl);
    this.asset.loaded.catch(error=>{this.error=error;console.error('Player asset:',error);});
    this.local=Array.from({length:21},()=>mat4.create());this.world=Array.from({length:21},()=>mat4.create());
    this.palette=new Float32Array(21*16);this.skinMatrices=Array.from({length:21},(_,i)=>this.palette.subarray(i*16,i*16+16));
  }
  skeleton(q){
    const {asset}=this;
    for(let i=0;i<this.local.length;i++){mat4.identity(this.local[i]);mat4.translate(this.local[i],this.local[i],asset.json.nodes[asset.skin.joints[i]].translation);}
    const rot=(i,x=0,y=0,z=0)=>{if(x)mat4.rotateX(this.local[i],this.local[i],x);if(y)mat4.rotateY(this.local[i],this.local[i],y);if(z)mat4.rotateZ(this.local[i],this.local[i],z);};
    this.local[1][13]=q.pelvis;
    this.local[2][14]+=.22*q.tuck;
    rot(2,q.torsoPitch*(.40+.35*q.tuck),q.yaw*.4,q.lean*.6);rot(3,q.torsoPitch*(.60-.35*q.tuck),q.yaw*.6,q.lean*.4);
    rot(4,-q.torsoPitch*(1-q.tuck)*.65-q.tuck*1.20,-q.yaw*.6,-q.lean*.6);
    rot(5,-q.torsoPitch*(1-q.tuck)*.35,-q.yaw*.4,-q.lean*.4);
    for(let side=0;side<2;side++){
      const leg=q.legs[side],hip=side?9:6,knee=hip+1,foot=hip+2;
      const thighAngle=Math.atan2(-(leg.knee[2]-leg.hip[2]),-(leg.knee[1]-leg.hip[1]));
      const shinAngle=Math.atan2(-(leg.foot[2]-leg.knee[2]),-(leg.foot[1]-leg.knee[1]));
      rot(hip,thighAngle);rot(knee,shinAngle-thighAngle);
      const toe=leg.stance?0:-.5*Math.sin(Math.PI*(leg.cycle-.5)*2)*q.activity*(1-q.tuck);
      rot(foot,-shinAngle+toe);
      const shoulder=side?15:12,arm=q.arms[side];
      rot(shoulder,arm.shoulder-q.air*.18,0,(side?1:-1)*(.10+q.tuck*.16+(q.flying?.32:0)));rot(shoulder+1,-arm.elbow);rot(shoulder+2,q.tuck*.3);
      rot(side?19:18,.08+Math.sin(q.phase+side*Math.PI-.6)*.17*q.activity*(1-q.tuck)+q.tuck*.7,0,(side?1:-1)*.05);
    }
    rot(20,Math.sin(q.phase-.4)*.12*q.activity*(1-q.tuck)+2.6*q.tuck,0,Math.sin(q.phase)*.04*q.activity*(1-q.tuck));
    // The root carries the athletic tumble; the independently folded spine,
    // hips, knees, elbows and neck keep it a skeleton animation, not a spin.
    mat4.identity(this.local[0]);mat4.translate(this.local[0],this.local[0],[0,q.pelvis,0]);
    mat4.rotateX(this.local[0],this.local[0],q.turn);mat4.rotateZ(this.local[0],this.local[0],q.death*1.32);
    mat4.translate(this.local[0],this.local[0],[0,-q.pelvis,0]);
    for(let i=0;i<this.local.length;i++){
      const parent=asset.parents[i];if(parent<0)mat4.copy(this.world[i],this.local[i]);else mat4.multiply(this.world[i],this.world[parent],this.local[i]);
      mat4.multiply(this.skinMatrices[i],this.world[i],asset.inverse.subarray(i*16,i*16+16));
    }
  }
  render(g){
    if(!this.asset.ready)return;
    const s=this.s,q=PlayerRig.pose(g);this.skeleton(q);
    const bounds=this.asset.bounds(this.palette),support=.025-bounds.bottom;
    q.visualHeight=bounds.top-bounds.bottom;q.ground=bounds.bottom+support;
    q.bones=this.asset.skin.joints.length;q.skinned=true;s.playerPose=q;
    s.orb(g.x,.025,4,.48,.022,.32,'#575d58');
    this.asset.draw(s,this.palette,g.x,g.jumpY+support,4);
  }
}
