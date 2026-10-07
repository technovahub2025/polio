// Stable per-spawn palettes and physical sizes; all variants share the original mesh.
const VIRUS_VARIANTS={
  normal:{scale:1,pace:1,body:'#a833b5',light:'#c452c9',tip:'#e285d6'},
  elite:{scale:1.75,pace:.84,body:'#892259',light:'#e5538e',tip:'#ffbea5'},
  fast:{scale:.90,pace:1.30,body:'#7039bb',light:'#827df5',tip:'#9feaff'},
  small:{scale:.62,pace:1.48,body:'#962fa7',light:'#ee75dc',tip:'#ffd4f4'},
  special:{scale:1,pace:1.05,body:'#763cac',light:'#b478ed',tip:'#90f4c7'},
  chaser:{scale:1,pace:.95,body:'#6935ad',light:'#a26de0',tip:'#83f2bd'},
  flying:{scale:.78,pace:1.10,body:'#7951b9',light:'#b599f5',tip:'#95eaff'}
};
/* Endless runner lifecycle; retains the original lane constants, audio and WebGL helpers. */
class DropDash {
  constructor(){
    this.canvas=document.querySelector('#glcanvas');this.scene=new RailwayScene(this.canvas);this.state='start';this.best=0;
    try{this.best=Number(localStorage.getItem('dropdash-best'))||0;}catch{/* Storage is optional in private browsing. */}
    this.muted=true;this.last=0;this.toastTime=0;this.reset();this.seedPreview();this.bind();this.updateHUD();setupRunnerInput(this);
    requestAnimationFrame(t=>this.frame(t));
  }
  reset(){this.x=M_TRACK;this.lane=0;this.jumpY=0;this.velocityY=0;this.slide=0;this.time=0;this.travel=0;this.distance=0;this.score=0;this.drops=0;this.speed=12;this.spawnIn=12;this.powerIn=40;this.items=[];this.particles=[];this.invincible=0;this.powers={shield:0,boost:0,double:0,magnet:0,flight:0};this.powerIndex=0;this.virusIn=.5;this.waveId=0;this.deathTime=0;this.runPhase=0;this.rollDuration=.68;this.airPose=0;this.landingImpact=0;this.playerCollisionHeight=2.4;this.animationState='IDLE';this.jumpTime=0;this.laneVelocity=0;this.flightMode=false;this.flightCameraY=0;this.flightPathIn=0;this.flightTrailIn=0;this.dangerPulse=0;}
  seedPreview(){for(let i=0;i<20;i++)this.items.push({type:'drop',lane:i%5===0?-1:0,z:-5-i*4});this.items.push({type:'virus',lane:1,z:-13},{type:'virus',lane:-1,z:-26},{type:'barrier',lane:1,z:-38},{type:'overhead',lane:-1,z:-53},{type:'shield',lane:1,z:-24});}
  bind(){document.querySelector('#start').onclick=()=>this.state==='paused'?this.resume():this.start();document.querySelector('#pause').onclick=()=>this.togglePause();document.querySelector('#secondary').onclick=()=>{this.state='start';this.reset();this.seedPreview();this.showOverlay('start');this.updateHUD();};document.querySelector('#records').onclick=()=>{if(this.state==='running')this.togglePause();this.showOverlay('records');};document.querySelector('#sound').onclick=()=>{this.muted=!this.muted;document.querySelector('#sound').innerHTML=this.muted?'\u266b <span>SOUND OFF</span>':'\u266b <span>SOUND ON</span>';document.querySelector('#sound').setAttribute('aria-label',this.muted?'Enable music':'Mute music');this.syncAudio();};audio.loop=true;audio.volume=.22;}
  syncAudio(){
    if(this.state==='running'&&!this.muted)audio.play().catch(()=>this.toast('Tap sound to enable music'));else audio.pause();}
  start(){this.reset();this.state='running';this.animationState='RUN';this.items.push({type:'shield',lane:0,z:-23});for(let i=0;i<8;i++)this.items.push({type:'drop',lane:0,z:-4-i*3});document.querySelector('#overlay').classList.add('hidden');document.activeElement?.blur();this.syncAudio();this.toast('Collect the blue drops. Find your rhythm.');}
  resume(){this.state='running';document.querySelector('#overlay').classList.add('hidden');document.activeElement?.blur();this.syncAudio();}
  togglePause(){if(this.state==='running'){this.state='paused';this.showOverlay('paused');this.syncAudio();}else if(this.state==='paused')this.resume();}
  showOverlay(mode){
    const titles={start:'Small drops.<br><em>Big impact.</em>',paused:'Take a breath.<br><em>You’ve got this.</em>',over:'A great run.<br><em>Go again?</em>',records:'Your personal<br><em>best run.</em>'};
    const copy={start:'Outrun the virus. Collect every drop.<br>Race toward a polio-free tomorrow.',paused:'Your journey is right here waiting.<br>Jump low barricades. Slide under high ones.',over:'Every run is a new chance to go further.<br>Keep your eyes on the tracks ahead.',records:'A little further. A little faster.<br>Your best score is saved on this device.'};
    document.querySelector('#overlay').classList.remove('hidden');document.querySelector('#overlay-title').innerHTML=titles[mode];document.querySelector('#overlay-copy').innerHTML=copy[mode];document.querySelector('#overlay-tag').textContent=mode==='over'&&this.newBest?'NEW PERSONAL BEST':{start:'THE CITY NEEDS A HERO',paused:'RUN PAUSED',over:'RUN COMPLETE',records:'THE RECORD BOOK'}[mode];document.querySelector('#start').innerHTML=(this.state==='paused'?'CONTINUE RUN':mode==='start'?'LET’S RUN':'RUN AGAIN')+' <span>&#8594;</span>';document.querySelector('#secondary').hidden=mode==='start';const result=document.querySelector('#results');result.hidden=!['over','records'].includes(mode);result.textContent=mode==='records'?this.best.toLocaleString()+' points':Math.floor(this.score).toLocaleString()+' pts · '+Math.floor(this.distance)+' m · '+this.drops+' drops';
  }
  finish(){if(this.state!=='running')return;this.state='over';this.animationState='HIT';this.newBest=Math.floor(this.score)>this.best;if(this.newBest){this.best=Math.floor(this.score);try{localStorage.setItem('dropdash-best',String(this.best));}catch{/* Continue without persistent storage. */}}this.showOverlay('over');this.syncAudio();this.updateHUD();}
  action(action){
    if(this.state!=='running')return;
    if(action==='left')this.lane=Math.max(-1,this.lane-1);
    if(action==='right')this.lane=Math.min(1,this.lane+1);
    if(action==='jump'&&!this.flightMode&&this.jumpY===0&&this.velocityY===0&&this.slide===0){this.velocityY=8.8;this.jumpTime=0;this.animationState='JUMP';}
    // An active evasive move cannot restart or accumulate repeated key presses.
    if(action==='slide'&&!this.flightMode&&this.slide===0){
      this.slide=this.rollDuration;this.playerCollisionHeight=.95;this.animationState='SOMERSAULT';
      this.velocityY=this.jumpY>0?-12:0;
    }
  }
  toast(message){document.querySelector('#message').textContent=message;this.toastTime=2.5;document.querySelector('#message').classList.add('visible');}
  burst(x,y,z,color){for(let i=0;i<16;i++)this.particles.push({x,y,z,vx:(Math.random()-.5)*5,vy:Math.random()*5,vz:(Math.random()-.5)*4,life:.6+Math.random()*.4,color});}
  spawnRow(){
    const clear=getRandomInt(-1,1),z=-105,types=['barrier','overhead'];
    const obstacles=[];
    for(let lane=-1;lane<=1;lane++)if(lane!==clear&&(Math.random()<.72||this.distance>450))obstacles.push({type:types[getRandomInt(0,1)],lane,z});
    // Keep the established collectible cadence; only reject unsafe hazards.
    if(this.canSchedule(obstacles))this.items.push(...obstacles);
    for(let i=0;i<6;i++)this.items.push({type:'drop',lane:clear,z:z-3-i*2.6});
  }
  canSchedule(candidates,ignore=null){
    // Reachability graph: a lane change occupies both lanes for 0.4 seconds.
    // Existing barricades reserve their full possible arrival interval even if
    // a speed boost starts or ends. Virus closing speeds are fixed at spawn.
    const tick=.1,steps=125;
    const blocked=this.scheduleBlocked||(this.scheduleBlocked=new Uint8Array((steps+1)*3));blocked.fill(0);
    for(const o of [...this.items,...candidates]){
      if(o===ignore||!['virus','barrier','overhead'].includes(o.type)||o.collected||o.passed||o.z>5.8)continue;
      const distance=Math.max(0,4-o.z),margin=.32+(o.scale||1)*.035;
      const fast=o.approachSpeed||37.7,slow=o.approachSpeed||12;
      const first=Math.max(0,Math.floor((distance/fast-margin)/tick));
      const last=Math.min(steps,Math.ceil((distance/slow+margin)/tick));
      const reserved=o.reservedLanes||[o.lane];
      for(let t=first;t<=last;t++)for(const lane of reserved)blocked[t*3+lane+1]=true;
    }
    const reachable=this.scheduleReachable||(this.scheduleReachable=new Uint8Array((steps+1)*3));reachable.fill(0);
    // Start from the player's actual position. Do not invent a route in a
    // lane the player cannot currently reach, even while jumping/flying.
    const current=Math.max(0,Math.min(2,Math.round(this.x/3)+1));
    reachable[current]=!blocked[current];
    for(let t=0;t<steps;t++)for(let lane=0;lane<3;lane++)if(reachable[t*3+lane]){
      if(!blocked[(t+1)*3+lane])reachable[(t+1)*3+lane]=true;
      if(t+4>steps)continue;
      for(const next of [lane-1,lane+1])if(next>=0&&next<3){
        let safe=true;
        for(let k=t;k<=t+4;k++)if(blocked[k*3+lane]||blocked[k*3+next])safe=false;
        if(safe)reachable[(t+4)*3+next]=true;
      }
    }
    return !!(reachable[steps*3]||reachable[steps*3+1]||reachable[steps*3+2]);
  }
  virusStyle(o){return VIRUS_VARIANTS[o.variant]||VIRUS_VARIANTS.normal;}
  virusHeight(o,time=this.time){return (o.y??.9*(o.scale||1))+Math.sin(time*(o.variant==='elite'?2.4:4)+(o.phase||0))*(o.variant==='flying'?.12:.055);}
  virusDifficulty(){return Math.min(1,this.score/12000);}
  weighted(options){let pick=Math.random()*options.reduce((sum,o)=>sum+o[1],0);for(const [value,weight] of options){pick-=weight;if(pick<0)return value;}return options[0][0];}
  makeVirus(variant,lane,arrival,difficulty=this.virusDifficulty(),altitude=null){
    const style=VIRUS_VARIANTS[variant],approachSpeed=Math.min(60,(25+difficulty*18+Math.random()*4)*style.pace);
    const o={type:'virus',variant,lane,x:lane*3,z:4-arrival*approachSpeed,approachSpeed,scale:style.scale,wave:this.waveId,phase:Math.random()*Math.PI*2};
    if(variant==='flying'){o.altitude=altitude||this.weighted([['low',4],['medium',4],['high',2]]);o.y={low:1.05,medium:2.2,high:6.15}[o.altitude]+(Math.random()-.5)*.10;}
    if(variant==='chaser'){o.observedLane=this.lane;o.noticeIn=.5;o.trackingLocked=false;}
    return o;
  }
  spawnVirusWave(){
    const d=this.virusDifficulty();
    const variant=()=>this.weighted([['normal',80-d*48],['fast',5+d*16],['small',4+d*9],['special',4+d*7],['elite',d*7],['flying',d*13],['chaser',Math.max(0,d-.25)*17]]);
    for(let attempt=0;attempt<24;attempt++){
      const pattern=this.weighted([['scatter',8],['slalom',2+d*5],['pulse',d*4],['elite',Math.max(0,d-.2)*4],['mixed',d*5]]);
      const direction=Math.random()<.5?1:-1,clear=getRandomInt(-1,1),lanes=[-1,0,1].filter(l=>l!==clear),lead=3.7-d*.6+Math.random()*.3,wave=[];
      const push=(type,lane,delay,altitude)=>wave.push(this.makeVirus(type,lane,lead+delay+(type==='elite'?.45:0),d,altitude));
      if(pattern==='scatter')for(let i=0,n=getRandomInt(4,5);i<n;i++)push(variant(),lanes[i%2],Math.floor(i/2)*.85+Math.random()*.1);
      if(pattern==='slalom')for(let i=0;i<4;i++)push(i%2?'normal':'fast',[-1,0,1,-1][i]*direction,i*1.5);
      // The three-member group is deliberately staggered: never a solid wall.
      if(pattern==='pulse')for(let i=0;i<7;i++)push(i%3?'normal':'fast',[-1,1,0,1,-1,0,1][i],[0,0,1.5,1.5,3.0,4.5,4.5][i]);
      if(pattern==='elite'){push('elite',0,0);push('normal',-1,1.25);push('normal',1,2.5);}
      if(pattern==='mixed'){push('fast',lanes[0],0);push('normal',lanes[1],.8);push('flying',clear,1.75);}
      if(this.canSchedule(wave)){
        this.items.push(...wave);this.waveId++;this.lastVirusPattern=pattern;
        this.virusIn=4.4-d*2.1+Math.random()*.4;return true;
      }
    }
    this.virusIn=.35;return false;
  }
  updateChaser(o,dt){
    if(o.variant!=='chaser')return;
    if(o.laneMove){
      const move=o.laneMove;move.time=Math.min(.65,move.time+dt);const t=move.time/.65,u=t*t*(3-2*t);
      o.x=move.from+(o.lane*3-move.from)*u;
      if(t===1){o.laneMove=null;o.reservedLanes=null;}
      return;
    }
    const arrival=(4-o.z)/o.approachSpeed;
    // Commit no later than 2.25s out; complete the .65s move then leave at
    // least 1.6 seconds for the player's final escape. Never track at contact.
    if(arrival<=2.25){o.trackingLocked=true;return;}
    if(o.observedLane!==this.lane){o.observedLane=this.lane;o.noticeIn=.5;return;}
    o.noticeIn-=dt;if(o.noticeIn>0||o.lane===o.observedLane)return;
    const next=o.lane+Math.sign(o.observedLane-o.lane),reservedLanes=[o.lane,next];
    const proposed={...o,lane:next,reservedLanes};
    if(this.canSchedule([proposed],o)){o.laneMove={from:o.x??o.lane*3,time:0};o.lane=next;o.reservedLanes=reservedLanes;}
    o.noticeIn=.5;
  }
  activateFlight(){
    this.powers.flight=7;this.flightMode=true;this.velocityY=0;this.slide=0;this.playerCollisionHeight=2.4;this.animationState='FLYING';
    this.flightPathIn=0;this.toast('Flight on - steer between the aerial viruses');
  }
  spawnFlightPath(){
    for(let i=0;i<12;i++)this.items.push({type:'drop',lane:[this.lane,0,-this.lane||1][Math.floor(i/4)],z:-12-i*3,y:5.9+Math.sin(i*.5)*.4,airDrop:true});
    const high=this.makeVirus('flying',getRandomInt(-1,1),3.4,this.virusDifficulty(),'high');
    if(this.canSchedule([high]))this.items.push(high);
    this.flightPathIn=42;
  }
  contactTime(o,previousZ,oldEnemyX,previousPlayerX){
    // Intersect the relative X/Z motion with the contact rectangle. This
    // catches fast crossings at the edge as well as across the center plane.
    const virus=o.type==='virus',size=o.scale||1,depth=.85*size,width=virus?.32+.46*size:.78;
    const dz=o.z-previousZ,relative=oldEnemyX-previousPlayerX,dx=(o.x??o.lane*3)-this.x-relative;
    let enter=0,exit=1;
    if(dz===0){if(Math.abs(previousZ-4)>depth)return -1;}
    else{const a=(4-depth-previousZ)/dz,b=(4+depth-previousZ)/dz;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
    if(dx===0){if(Math.abs(relative)>width)return -1;}
    else{const a=(-width-relative)/dx,b=(width-relative)/dx;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
    return enter<=exit?enter:-1;
  }
  virusSafe(o,height=this.jumpY,time=this.time){
    if(o.variant!=='flying')return height>1.45*(o.scale||1);
    const y=this.virusHeight(o,time),radius=.58*(o.scale||1);
    return height>y+radius||height+this.playerCollisionHeight<y-radius;
  }
  update(dt){
    const previousX=this.x,previousHeight=this.jumpY;
    this.time+=dt;this.speed=(12+Math.min(14,this.distance/160))*(this.powers.boost>0?1.45:1);const step=this.speed*dt;this.travel+=step;this.distance+=step;this.score+=step*(this.powers.double>0?2:1);this.x+=(this.lane*R_TRACK-this.x)*(1-Math.exp(-14*dt));this.slide=Math.max(0,this.slide-dt);this.invincible=Math.max(0,this.invincible-dt);
    this.laneVelocity+=((dt>0?(this.x-previousX)/dt:0)-this.laneVelocity)*(1-Math.exp(-18*dt));
    const wasAirborne=this.jumpY>0;
    if(this.flightMode){
      this.jumpY+=((this.powers.flight>0?5:0)-this.jumpY)*(1-Math.exp(-3.5*dt));this.velocityY=0;
      if(this.powers.flight===0&&this.jumpY<.025){this.jumpY=0;this.flightMode=false;}
    }else{this.velocityY-=22*dt;this.jumpY=Math.max(0,this.jumpY+this.velocityY*dt);if(this.jumpY===0)this.velocityY=0;}
    this.flightCameraY+=((this.flightMode?this.jumpY*.9:0)-this.flightCameraY)*(1-Math.exp(-6*dt));
    this.runPhase+=step*.72;
    this.jumpTime+=dt;
    this.airPose+=(Math.min(1,this.jumpY*2)-this.airPose)*(1-Math.exp(-18*dt));
    this.landingImpact=wasAirborne&&this.jumpY===0?1:Math.max(0,this.landingImpact-dt*7);
    this.playerCollisionHeight=this.slide>0?.95:2.4;
    this.animationState=this.flightMode?'FLYING':this.slide>0?'SOMERSAULT':this.jumpY>0?(this.velocityY>0?'JUMP':'FALL'):this.landingImpact>0?'LAND':'RUN';
    for(const key of Object.keys(this.powers))this.powers[key]=Math.max(0,this.powers[key]-dt);
    this.virusIn-=dt;if(this.virusIn<=0)this.spawnVirusWave();this.spawnIn-=step;if(this.spawnIn<=0){this.spawnRow();this.spawnIn=32-Math.min(5,this.distance/500);}
    this.powerIn-=step;if(this.powerIn<=0){const type=['magnet','double','flight','boost','shield'][this.powerIndex++%5];this.items.push({type,lane:getRandomInt(-1,1),z:-94});this.powerIn=90;}
    if(this.flightMode&&this.powers.flight>1){this.flightPathIn-=step;if(this.flightPathIn<=0)this.spawnFlightPath();}
    this.flightTrailIn-=dt;
    if(this.flightMode&&this.flightTrailIn<=0){this.flightTrailIn=.06;if(this.particles.length<100)this.particles.push({x:this.x,y:this.jumpY+.4,z:4.2,vx:0,vy:-.2,vz:4,life:.5,color:'#75e9ff',flight:true});}
    this.dangerPulse=0;
    for(const o of this.items){
      const oldEnemyX=o.x??o.lane*3;
      this.updateChaser(o,dt);
      const previousZ=o.z,isVirus=o.type==='virus';
      if(!o.collected)o.z+=isVirus&&o.approachSpeed?o.approachSpeed*dt:step;
      const contact=this.contactTime(o,previousZ,oldEnemyX,previousX),near=contact>=0;
      const contactHeight=previousHeight+(this.jumpY-previousHeight)*Math.max(0,contact);
      if(o.variant==='elite'&&(4-o.z)/o.approachSpeed<1.5&&o.z<4)this.dangerPulse=Math.max(this.dangerPulse,1-(4-o.z)/(o.approachSpeed*1.5));
      if(!o.collected&&o.type==='drop'&&this.powers.magnet>0&&Math.abs(o.z-4)<12&&((!this.flightMode&&!o.airDrop)||Math.abs((o.y??1.05)-(this.jumpY+1))<1.5)){o.collected=true;o.collectTime=0;this.collect(o);}
      else if(near&&!o.collected){if(o.type==='drop'){if(o.airDrop?Math.abs((o.y??1.05)-(this.jumpY+1))<1:this.jumpY<1.5){o.collected=true;o.collectTime=0;this.collect(o);}}
      else if(Object.hasOwn(this.powers,o.type)&&(!this.flightMode||Math.abs((o.y??1.05)-(this.jumpY+1))<1.5)){o.collected=true;o.collectTime=0;if(o.type==='flight'){this.activateFlight();this.burst(this.x,this.jumpY+1,4,'#75e9ff');continue;}this.powers[o.type]=o.type==='shield'?18:10;this.toast({shield:'Shield on · one hit protected',boost:'Speed boost · invincible for 10s',double:'Double score · make it count!',magnet:'Magnet · bring on the drops!'}[o.type]);this.burst(o.lane*3,1.4,4,'#c3ff89');}
      else if(!o.passed&&['virus','barrier','overhead'].includes(o.type)){const safe=isVirus?this.virusSafe(o,contactHeight,this.time-dt+dt*contact):o.type==='overhead'?(this.jumpY>2.7||(this.slide>0&&this.playerCollisionHeight<1.2&&this.jumpY<.3)):this.jumpY>1.05;if(!safe){o.passed=true;if(this.powers.boost>0||this.invincible>0){o.collected=true;this.burst(o.lane*3,1,4,'#ffcf6a');}else if(this.powers.shield>0){this.powers.shield=0;this.invincible=1.2;o.collected=true;this.burst(o.lane*3,1,4,'#69deff');this.toast('Shield saved you!');}else{this.burst(this.x,1,4,'#dc74e3');this.finish();break;}}}}
    }
    for(const o of this.items)if(o.collected)o.collectTime=(o.collectTime||0)+dt;this.items=this.items.filter(o=>o.z<12&&(!o.collected||(o.collected&&['shield','boost','double','magnet'].includes(o.type)&&(o.collectTime||0)<.3)));this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=8*dt;}
  }
  collect(o){this.drops++;this.score+=25*(this.powers.double>0?2:1);this.burst(o.lane*3,o.y??1.1,o.z,'#61e8ff');}
  updateHUD(){document.querySelector('#score').textContent=String(Math.floor(this.score)).padStart(6,'0');document.querySelector('#distance').textContent=Math.floor(this.distance).toLocaleString();document.querySelector('#best').textContent=this.best.toLocaleString();document.querySelector('#header-best').textContent=this.best.toLocaleString();document.querySelector('#multiplier').textContent=this.powers.double>0?'×2':'×1';document.querySelector('#pace').textContent=this.state==='running'?Math.round(this.speed*3.6)+' KM/H':'MORNING RUN';document.querySelector('#pause').textContent=this.state==='paused'?'\u25b6':'\u2161';document.querySelector('#pause').setAttribute('aria-label',this.state==='paused'?'Resume game':'Pause game');const names={shield:'\u25c7 Shield',boost:'\u26a1 Speed boost',double:'×2 Double score',magnet:'n Magnet',flight:'\u2726 Flight'};document.querySelector('#power-hud').innerHTML=Object.entries(this.powers).filter(([,n])=>n>0).map(([key,n])=>`<div class="active-power ${key}">${names[key]} · ${Math.ceil(n)}s<progress max="${key==='shield'?18:key==='flight'?7:10}" value="${n}"></progress></div>`).join('');}
  frame(now){const dt=Math.min((now-this.last)/1000||0,.04);this.last=now;if(this.state==='running')this.update(dt);else if(this.state==='start'){this.time+=dt;this.travel+=dt*2.2;}else if(this.state==='over'){this.deathTime=Math.min(1,this.deathTime+dt);this.animationState=this.deathTime<.18?'HIT':'DEATH';}if(this.toastTime>0){this.toastTime-=dt;if(this.toastTime<=0)document.querySelector('#message').classList.remove('visible');}this.scene.render(this);this.updateHUD();requestAnimationFrame(t=>this.frame(t));}
}
try{window.runner=new DropDash();}catch(error){document.querySelector('#overlay-title').textContent='Let’s get you running.';document.querySelector('#overlay-copy').textContent=error.message;document.querySelector('#start').hidden=true;console.error(error);}


