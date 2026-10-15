// Environment milestones are independent of gameplay spawning and difficulty.
const WORLD_CYCLE_LENGTH=2600;
const LONG_RUN_THRESHOLD_SECONDS=120;
const RUN_WORLDS=[
  {id:'BRIGHT_CITY',start:0,end:500,label:'BRIGHT MORNING CITY'},
  {id:'TUNNEL',start:500,end:850,approach:50,entryLength:14,label:'VIRUS TUNNEL'},
  {id:'GREEN_DISTRICT',start:850,end:1400,approach:70,entryLength:14,skyApproach:145,label:'GREEN HEALTH DISTRICT'},
  {id:'VILLAGE_VACCINATION_MISSION',start:1400,end:2000,label:'VILLAGE VACCINATION MISSION',subtitle:'EVERY DROP COUNTS'},
  {id:'JUNGLE_IMMUNITY_TRAIL',start:2000,end:WORLD_CYCLE_LENGTH,approach:60,label:'JUNGLE IMMUNITY TRAIL',subtitle:'KEEP IMMUNITY STRONG'}
];
function getWorldForDistance(distance){
  const local=distance%WORLD_CYCLE_LENGTH;
  return RUN_WORLDS.find(w=>local>=w.start&&local<w.end).id;
}
function getEnvironment(distance){
  const cycle=Math.floor(distance/WORLD_CYCLE_LENGTH),base=cycle*WORLD_CYCLE_LENGTH;
  const local=distance-base,tunnel=RUN_WORLDS[1],green=RUN_WORLDS[2],village=RUN_WORLDS[3],jungle=RUN_WORLDS[4];
  const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
  // Spatial windows include the next/previous cycle near the seam. No scenery
  // object lists grow with distance, and gameplay never uses this local clock.
  const visibleWorlds=[];
  for(let c=Math.max(0,Math.floor((distance-32)/WORLD_CYCLE_LENGTH));c<=Math.floor((distance+164)/WORLD_CYCLE_LENGTH);c++){
    for(const w of RUN_WORLDS){
      const start=c*WORLD_CYCLE_LENGTH+w.start,end=c*WORLD_CYCLE_LENGTH+w.end;
      const startZ=4+distance-start,endZ=4+distance-end;
      if(startZ>=-160&&endZ<=32)visibleWorlds.push({id:w.id,start,end,startZ,endZ,cycle:c});
    }
  }
  return {id:getWorldForDistance(distance),cycle,worldDistance:local,visibleWorlds,
    tunnelStart:base+tunnel.start,tunnelEnd:base+green.start,
    greenStart:base+green.start,greenEnd:base+green.end,exitZ:4+local-green.start,
    exitTransition:smooth((local-green.start+green.approach)/(green.approach+green.entryLength)),
    exitSky:smooth((local-green.start+green.skyApproach)/(green.skyApproach-green.approach)),
    jungleTransition:smooth((local-jungle.start+jungle.approach)/jungle.approach),
    villageTransition:smooth((local-village.start+60)/60),cityReturn:smooth((local-WORLD_CYCLE_LENGTH+60)/60),
    portalZ:4+local-tunnel.start,approaching:local>=tunnel.start-tunnel.approach,
    transition:smooth((local-tunnel.start)/tunnel.entryLength)};
}
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
  reset(){this.maxLives=5;this.lives=this.maxLives;this.lifeHitTime=0;this.lifePulse=0;this.lostHeart=-1;this.updateLifeHUD();this.x=M_TRACK;this.lane=0;this.jumpY=0;this.velocityY=0;this.slide=0;this.time=0;this.runDuration=0;this.travel=0;this.distance=0;this.score=0;this.drops=0;this.vaccinePower=0;this.vaccinePowerMax=10;this.warriorModeReady=false;this.vaccineReadyPulse=0;this.speed=12;this.spawnIn=12;this.powerIn=40;this.items=[];this.particles=[];this.collectionEffects=[];this.footstepRipples=[];this.lastFootstepStep=0;this.invincible=0;this.shieldBreak=0;this.powers={shield:0,boost:0,double:0,magnet:0,flight:0};this.powerIndex=0;this.virusIn=.5;this.waveId=0;this.deathTime=0;this.runPhase=0;this.rollDuration=.68;this.airPose=0;this.landingImpact=0;this.playerCollisionHeight=2.4;this.animationState='IDLE';this.jumpTime=0;this.laneVelocity=0;this.flightMode=false;this.flightCameraY=0;this.flightPathIn=0;this.flightTrailIn=0;this.dangerPulse=0;this.tutorialActive=false;this.tutorialStage='NORMAL';this.tutorialTime=0;this.tutorialFlightSpawned=false;this.tutorialFlightCollected=false;this.tutorialVaccines=0;this.tutorialVaccineGoal=3;this.tutorialFeedbackTime=0;this.tutorialFlightMoved=false;this.tutorialLaneMove=null;this.tutorialAction=false;this.updateTutorialHUD();this.environment=getEnvironment(0);this.worldLabelTime=0;this.worldApproachShown=false;this.worldEntryShown=false;this.greenEntryShown=false;this.worldLabelKey='0:BRIGHT_CITY';this.worldApproachCycle=-1;this.updateWorldHUD();}
  seedPreview(){for(let i=0;i<20;i++)this.items.push({type:'drop',lane:i%5===0?-1:0,z:-5-i*4});this.items.push({type:'virus',lane:1,z:-13},{type:'virus',lane:-1,z:-26},{type:'barrier',lane:1,z:-38},{type:'overhead',lane:-1,z:-53},{type:'shield',lane:1,z:-24});}
  bind(){document.querySelector('#instructions-ok').onclick=()=>{document.querySelector('#instructions-overlay').hidden=true;this.start();};document.querySelector('#pause-resume').onclick=()=>this.resume();document.querySelector('#pause-restart').onclick=()=>this.start();document.querySelector('#pause-menu').onclick=()=>this.mainMenu();document.querySelector('#tutorial-skip').onclick=()=>{this.endTutorial();document.activeElement?.blur();};document.querySelector('#start').onclick=()=>this.state==='paused'?this.resume():this.state==='start'?this.showInstructions():this.start();document.querySelector('#run-again').onclick=()=>this.start();document.querySelector('#run-home').onclick=()=>this.mainMenu();document.querySelector('#pause').onclick=()=>this.togglePause();document.querySelector('#secondary').onclick=()=>this.mainMenu();document.querySelector('#records').onclick=()=>{if(this.state==='running')this.togglePause();this.showOverlay('records');};document.querySelector('#sound').onclick=()=>{this.muted=!this.muted;document.querySelector('#sound').innerHTML=this.muted?'\u266b <span>SOUND OFF</span>':'\u266b <span>SOUND ON</span>';document.querySelector('#sound').setAttribute('aria-label',this.muted?'Enable music':'Mute music');this.syncAudio();};audio.loop=true;audio.volume=.22;}
  showInstructions(){document.querySelector('#instructions-overlay').hidden=false;document.querySelector('#instructions-ok').focus?.();}
  syncAudio(){
    if(this.state==='running'&&!this.muted)audio.play().catch(()=>this.toast('Tap sound to enable music'));else audio.pause();}
  start(){this.cancelRunnerTouch?.();this.last=null;document.querySelector('#instructions-overlay').hidden=true;document.querySelector('#run-results').hidden=true;document.querySelector('#pause-overlay').hidden=true;this.reset();this.state='running';this.animationState='RUN';this.beginTutorial();document.querySelector('#overlay').classList.add('hidden');document.activeElement?.blur();this.syncAudio();this.updateHUD();}
  beginTutorial(){
    this.tutorialActive=true;this.tutorialVaccines=0;this.tutorialVaccineGoal=3;
    this.tutorialFeedbackTime=0;this.tutorialFlightMoved=false;this.tutorialLaneMove=null;
    this.toastTime=0;document.querySelector('#message').classList.remove('visible');
    this.setTutorialStage('MOVE_LEFT');
  }
  setTutorialStage(stage){
    this.items=this.items.filter(o=>!o.training);
    this.tutorialStage=stage;this.tutorialTime=0;this.tutorialLaneMove=null;
    this.tutorialAction=false;this.tutorialFlightMoved=false;
    const instructions={
      MOVE_LEFT:['\u2190','MOVE LEFT','Left Arrow / Swipe Left'],
      MOVE_RIGHT:['\u2192','MOVE RIGHT','Right Arrow / Swipe Right'],
      JUMP:['\u2191','JUMP!','Up Arrow / Swipe Up / Clear the barrier'],
      ROLL:['\u2193','ROLL!','Down Arrow / Swipe Down / Roll under the bar'],
      VACCINE:['','COLLECT THE VACCINE DROPS','Follow the drops in the target lane'],
      SHIELD_COLLECT:['','COLLECT THE PROTECTOR','Follow the shield in the target lane'],
      SHIELD_DEMO:['','THE SHIELD PROTECTS YOU!','Stay in the virus lane to try your shield'],
      FLIGHT_COLLECT:['','COLLECT FLIGHT POWER','Follow the wings in the target lane'],
      FLIGHT_CONTROL:['\u2190 \u2192','FLY!','Move left or right while flying'],
      COMPLETE:['\u2713','TRAINING COMPLETE!',"LET'S FIGHT POLIO!"]
    };
    const [arrow,message,hint]=instructions[stage];
    document.querySelector('#tutorial-arrow').textContent=arrow;
    document.querySelector('#tutorial-message').textContent=message;
    document.querySelector('#tutorial-hint').textContent=hint;
    this.updateTutorialHUD();
  }
  tutorialFeedback(message){
    document.querySelector('#tutorial-feedback').textContent=message;this.tutorialFeedbackTime=1.2;
  }
  updateTutorialHUD(){
    const visible=this.tutorialActive&&this.state==='running';
    document.querySelector('#tutorial').hidden=!visible;
    document.querySelector('#tutorial-feedback').hidden=!visible||!this.tutorialFeedbackTime;
    document.querySelector('#tutorial-progress').textContent=this.tutorialStage==='VACCINE'?'VACCINES '+this.tutorialVaccines+'/'+this.tutorialVaccineGoal:'';
  }
  spawnTutorialChallenge(){
    const types={JUMP:'barrier',ROLL:'overhead',VACCINE:'vaccine',SHIELD_COLLECT:'shield',SHIELD_DEMO:'virus',FLIGHT_COLLECT:'flight'};
    const type=types[this.tutorialStage];if(!type)return;
    const count=type==='vaccine'?this.tutorialVaccineGoal-this.tutorialVaccines:1;
    for(let i=0;i<count;i++)this.items.push({type,lane:this.lane,z:4-this.speed*(2.5+i*.65),training:true});
    this.tutorialAction=false;
    if(type==='flight')this.tutorialFlightSpawned=true;
  }
  updateTutorial(dt){
    if(!this.tutorialActive)return;
    this.tutorialTime+=dt;this.tutorialFeedbackTime=Math.max(0,this.tutorialFeedbackTime-dt);
    const stage=this.tutorialStage,move=this.tutorialLaneMove;
    if(move&&this.lane===move.to&&Math.abs(this.x-move.to*R_TRACK)<.12){
      if(stage==='MOVE_LEFT'&&move.from===0&&move.to===-1){this.tutorialFeedback('\u2713 MOVE LEFT');this.setTutorialStage('MOVE_RIGHT');}
      else if(stage==='MOVE_RIGHT'&&move.to>move.from){this.tutorialFeedback('\u2713 MOVE RIGHT');this.setTutorialStage('JUMP');}
      else if(stage==='FLIGHT_CONTROL'&&this.powers.flight>0){this.tutorialFlightMoved=true;this.tutorialFeedback('\u2713 FLIGHT CONTROL');}
      this.tutorialLaneMove=null;
    }
    if(stage==='FLIGHT_CONTROL'){
      if(this.tutorialTime>=1)document.querySelector('#tutorial-message').textContent=this.tutorialFlightMoved?'FLIGHT CONTROL \u2713':'MOVE WHILE FLYING';
      if(!this.flightMode){
        if(this.tutorialFlightMoved)this.setTutorialStage('COMPLETE');
        else{this.setTutorialStage('FLIGHT_COLLECT');this.tutorialFeedback('Try again: move left or right in flight');}
      }
    }else if(stage==='COMPLETE'){
      if(this.tutorialTime>=.7)document.querySelector('#tutorial-message').textContent="LET'S FIGHT POLIO!";
      if(this.tutorialTime>=1.8){this.endTutorial();return;}
    }
    const challenges=this.items.filter(o=>o.training&&!o.airDrop);
    for(const o of challenges){
      if(o.type==='vaccine'&&o.collected){
        this.tutorialVaccines++;o.training=false;
        if(this.tutorialVaccines>=this.tutorialVaccineGoal){this.tutorialFeedback('VACCINES 3/3 \u2713');this.setTutorialStage('SHIELD_COLLECT');break;}
      }else if(o.type==='shield'&&o.collected){this.tutorialFeedback('PROTECTED!');this.setTutorialStage('SHIELD_DEMO');break;}
      else if(o.type==='flight'&&o.collected){this.tutorialFlightCollected=true;this.setTutorialStage('FLIGHT_CONTROL');break;}
      else if(o.shieldAbsorbed){this.tutorialFeedback('\u2713 SHIELD BROKEN!');this.setTutorialStage('FLIGHT_COLLECT');break;}
      else if(o.trainingFailed||o.z>5){
        if(o.trainingCleared&&!o.trainingFailed){this.tutorialFeedback('\u2713 '+stage);this.setTutorialStage(stage==='JUMP'?'ROLL':'VACCINE');break;}
        o.collected=true;o.training=false;
        if(['JUMP','ROLL'].includes(stage))this.tutorialFeedback('Try again - '+(stage==='JUMP'?'JUMP!':'ROLL!'));
      }
    }
    if(!this.items.some(o=>o.training&&!o.airDrop&&!o.collected))this.spawnTutorialChallenge();
    this.updateTutorialHUD();
  }
  endTutorial(){
    if(!this.tutorialActive)return;
    this.tutorialActive=false;this.tutorialStage='NORMAL';this.tutorialLaneMove=null;this.tutorialFeedbackTime=0;
    this.items=this.items.filter(o=>!o.training);
    for(const id of ['tutorial-message','tutorial-arrow','tutorial-hint','tutorial-feedback','tutorial-progress'])document.querySelector('#'+id).textContent='';
    this.toastTime=0;document.querySelector('#message').classList.remove('visible');
    this.updateTutorialHUD();
    // Original spawn clocks resume; score, powers, physics and the run continue.
  }
  mainMenu(){
    this.cancelRunnerTouch?.();document.querySelector('#run-results').hidden=true;this.state='start';this.last=null;this.toastTime=0;document.querySelector('#message').classList.remove('visible');
    document.querySelector('#instructions-overlay').hidden=true;
    document.querySelector('#pause-overlay').hidden=true;
    this.reset();this.seedPreview();this.showOverlay('start');this.syncAudio();this.updateHUD();
  }
  pause(){
    if(this.state!=='running')return;
    this.state='paused';this.cancelRunnerTouch?.();this.showOverlay('paused');this.syncAudio();this.updateHUD();
    document.querySelector('#pause-resume').focus?.();
  }
  resume(){
    if(this.state!=='paused'||document.hidden)return;
    this.state='running';this.last=null;this.cancelRunnerTouch?.();
    document.querySelector('#pause-overlay').hidden=true;document.querySelector('#overlay').classList.add('hidden');
    document.activeElement?.blur();this.syncAudio();this.updateHUD();
  }
  togglePause(){if(this.state==='running')this.pause();else if(this.state==='paused')this.resume();}
  showOverlay(mode){
    document.querySelector('#pause-overlay').hidden=mode!=='paused';
    if(mode==='paused'){document.querySelector('#overlay').classList.add('hidden');return;}
    const titles={start:'Small drops.<br><em>Big impact.</em>',paused:'Take a breath.<br><em>You’ve got this.</em>',over:'A great run.<br><em>Go again?</em>',records:'Your personal<br><em>best run.</em>'};
    const copy={start:'Outrun the virus. Collect every drop.<br>Race toward a polio-free tomorrow.',paused:'Your journey is right here waiting.<br>Jump low barricades. Slide under high ones.',over:'Every run is a new chance to go further.<br>Keep your eyes on the tracks ahead.',records:'A little further. A little faster.<br>Your best score is saved on this device.'};
    document.querySelector('#overlay').classList.remove('hidden');document.querySelector('#overlay-title').innerHTML=titles[mode];document.querySelector('#overlay-copy').innerHTML=copy[mode];document.querySelector('#overlay-tag').textContent=mode==='over'&&this.newBest?'NEW PERSONAL BEST':{start:'THE CITY NEEDS A HERO',paused:'RUN PAUSED',over:'RUN COMPLETE',records:'THE RECORD BOOK'}[mode];document.querySelector('#start').innerHTML=(this.state==='paused'?'CONTINUE RUN':mode==='start'?'LET’S RUN':'RUN AGAIN')+' <span>&#8594;</span>';document.querySelector('#secondary').hidden=mode==='start';const result=document.querySelector('#results');result.hidden=!['over','records'].includes(mode);result.textContent=mode==='records'?this.best.toLocaleString()+' points':Math.floor(this.score).toLocaleString()+' pts · '+Math.floor(this.distance)+' m · '+this.drops+' drops';
  }
  showRunResults(run){
    const longRun=run.duration>=LONG_RUN_THRESHOLD_SECONDS;
    const duration=Math.floor(run.duration),minutes=Math.floor(duration/60),seconds=duration%60;
    document.querySelector('#run-results-title').textContent=longRun?'POLIO HERO!':'NICE TRY, WARRIOR!';
    document.querySelector('#run-results-kicker').textContent=longRun?'GREAT RUN!':'RUN COMPLETE';
    document.querySelector('#run-results-subtitle').textContent=longRun?`Thank you for collecting Polio Drops! You collected ${run.drops} drops and kept going for ${minutes}:${String(seconds).padStart(2,'0')}.`:`You collected ${run.drops} Polio Drops.`;
    document.querySelector('#run-results-copy').textContent=longRun?'Every drop counts. Every child protected brings us one step closer to a polio-free world. Thank you for being a Polio Warrior!':'Every drop makes a difference. Keep running and see how far you can go!';
    document.querySelector('#result-drops').textContent=run.drops.toLocaleString();
    document.querySelector('#result-duration').textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    document.querySelector('#result-score').textContent=run.score.toLocaleString();
    document.querySelector('#result-distance').textContent=run.distance.toLocaleString();
    document.querySelector('#new-best-badge').hidden=!run.newBest;
    document.querySelector('#run-results').hidden=false;
  }
  finish(){if(this.state!=='running')return;const run={duration:this.runDuration,drops:this.drops,score:Math.floor(this.score),distance:Math.floor(this.distance)};this.deathTime=0;this.state='over';this.animationState='HIT';this.footstepRipples=[];this.newBest=run.score>this.best;if(this.newBest){this.best=run.score;try{localStorage.setItem('dropdash-best',String(this.best));}catch{/* Continue without persistent storage. */}}run.newBest=this.newBest;this.showOverlay('over');this.showRunResults(run);this.syncAudio();this.updateHUD();}
  action(action){
    if(this.state!=='running')return;
    const fromLane=this.lane,settled=Math.abs(this.x-this.lane*R_TRACK)<.12;
    if(action==='left')this.lane=Math.max(-1,this.lane-1);
    if(action==='right')this.lane=Math.min(1,this.lane+1);
    if(this.tutorialActive&&settled&&fromLane!==this.lane&&['left','right'].includes(action))this.tutorialLaneMove={from:fromLane,to:this.lane};
    if(action==='jump'&&!this.flightMode&&this.jumpY===0&&this.velocityY===0&&this.slide===0){this.velocityY=8.8;if(this.tutorialActive&&this.tutorialStage==='JUMP')this.tutorialAction=true;this.jumpTime=0;this.animationState='JUMP';}
    // An active evasive move cannot restart or accumulate repeated key presses.
    if(action==='slide'&&!this.flightMode&&this.slide===0){
      this.slide=this.rollDuration;if(this.tutorialActive&&this.tutorialStage==='ROLL')this.tutorialAction=true;this.playerCollisionHeight=.95;this.animationState='SOMERSAULT';
      this.velocityY=this.jumpY>0?-12:0;
    }
  }
  loseLife(){
    if(this.state!=='running'||this.tutorialActive||this.lives<=0||this.invincible>0)return false;
    this.lives=Math.max(0,this.lives-1);this.lostHeart=this.lives;
    this.lifeHitTime=.22;this.lifePulse=.65;this.invincible=1.5;
    this.deathTime=.1;this.animationState='HIT';
    this.burst(this.x,this.jumpY+1,4,'#dc74e3');this.updateLifeHUD();
    if(this.lives===0)this.finish();
    return true;
  }
  updateLifeHUD(){
    const hud=document.querySelector('#life-hud');
    hud.hidden=this.state==='start';
    const label=`${this.lives} of ${this.maxLives} lives remaining`;
    if(this.lifeHUDLabel!==label){hud.setAttribute('aria-label',label);this.lifeHUDLabel=label;}
    for(let i=0;i<this.maxLives;i++){
      const heart=document.querySelector('#life-heart-'+i),filled=i<this.lives;
      heart.textContent=filled?'\u2665':'\u2661';
      heart.classList[filled?'add':'remove']('filled');
      heart.classList[this.lifePulse>0&&i===this.lostHeart?'add':'remove']('lost');
    }
    hud.classList[this.lifePulse>0?'add':'remove']('damaged');
    document.querySelector('#life-feedback').hidden=this.lifePulse<=0;
  }
  toast(message){document.querySelector('#message').textContent=message;this.toastTime=2.5;document.querySelector('#message').classList.add('visible');}
  burst(x,y,z,color,count=16,minLife=.6,maxLife=1,size=.07,accent=null){for(let i=0;i<count;i++)this.particles.push({x,y,z,vx:(Math.random()-.5)*5,vy:Math.random()*5,vz:(Math.random()-.5)*4,life:minLife+Math.random()*(maxLife-minLife),color:accent&&i%3===0?accent:color,size});}
  spawnRow(){
    const clear=getRandomInt(-1,1),z=-105,types=['barrier','overhead'];
    const obstacles=[];
    for(let lane=-1;lane<=1;lane++)if(lane!==clear&&(Math.random()<.72||this.distance>450))obstacles.push({type:types[getRandomInt(0,1)],lane,z});
    // Keep the established collectible cadence; only reject unsafe hazards.
    if(this.canSchedule(obstacles))this.items.push(...obstacles);
    for(let i=0;i<6;i++)this.items.push({type:'drop',lane:clear,z:z-3-i*2.6});
  }
  spawnVaccine(){
    // Share the existing safe-lane query and row cadence, not the power-up rotation.
    const z=-60,lane=this.shieldLane(z);
    if(lane!==null)this.items.push({type:'vaccine',lane,z,y:1.05});
  }
  collectVaccine(o){
    if(o.collected)return;
    o.collected=true;
    this.burst(o.lane*3,o.y??1.05,o.z,'#62f5ed');
    if(this.vaccinePower<this.vaccinePowerMax){
      this.vaccinePower=Math.min(this.vaccinePowerMax,this.vaccinePower+1);
      if(this.vaccinePower===this.vaccinePowerMax&&!this.warriorModeReady){
        this.warriorModeReady=true;this.vaccineReadyPulse=.8;
        this.burst(this.x,this.jumpY+1,4,'#ffd766');
        this.toast('WARRIOR MODE READY!');
      }
    }
    this.updateVaccineHUD();
  }
  updateVaccineHUD(){
    const panel=document.querySelector('#vaccine-hud');
    panel.hidden=this.state==='start';
    panel.classList[this.warriorModeReady?'add':'remove']('ready');
    const meter=document.querySelector('#vaccine-meter');
    meter.max=this.vaccinePowerMax;meter.value=this.vaccinePower;
    document.querySelector('#vaccine-count').textContent=this.vaccinePower+'/'+this.vaccinePowerMax;
    document.querySelector('#vaccine-ready').hidden=!this.warriorModeReady;
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
  shieldLane(z){
    // Reuse the hazard reachability graph; skip this pickup if no safe lane
    // stays reachable across its possible arrival window (including boost).
    this.canSchedule([]);
    const first=Math.max(0,Math.floor(((4-z)/37.7-.4)/.1));
    const last=Math.min(125,Math.ceil(((4-z)/12+.4)/.1));
    const lanes=[-1,0,1].filter(lane=>{
      for(let t=first;t<=last;t++)if(!this.scheduleReachable[t*3+lane+1])return false;
      return true;
    });
    return lanes.length?lanes[getRandomInt(0,lanes.length-1)]:null;
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
    this.flightPathIn=0;if(!this.tutorialActive)this.toast('Flight on - steer between the aerial viruses');
  }
  spawnFlightPath(){
    for(let i=0;i<12;i++)this.items.push({type:'drop',lane:[this.lane,0,-this.lane||1][Math.floor(i/4)],z:-12-i*3,y:5.9+Math.sin(i*.5)*.4,airDrop:true,training:this.tutorialActive});
    if(!this.tutorialActive){
    const high=this.makeVirus('flying',getRandomInt(-1,1),3.4,this.virusDifficulty(),'high');
    if(this.canSchedule([high]))this.items.push(high);
    }
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
    if(this.state!=='running')return;
    this.lifeHitTime=Math.max(0,this.lifeHitTime-dt);this.lifePulse=Math.max(0,this.lifePulse-dt);
    const previousX=this.x,previousHeight=this.jumpY;
    this.time+=dt;this.runDuration+=dt;this.speed=(12+Math.min(14,this.distance/160))*(this.powers.boost>0?1.45:1);const step=this.speed*dt;this.travel+=step;this.distance+=step;this.score+=step*(this.powers.double>0?2:1);this.x+=(this.lane*R_TRACK-this.x)*(1-Math.exp(-14*dt));this.slide=Math.max(0,this.slide-dt);this.invincible=Math.max(0,this.invincible-dt);this.shieldBreak=Math.max(0,this.shieldBreak-dt);this.vaccineReadyPulse=Math.max(0,this.vaccineReadyPulse-dt);
    this.updateWorld(dt);
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
    const stepIndex=Math.floor(this.runPhase/Math.PI),groundedRun=this.state==='running'&&this.animationState==='RUN'&&!this.flightMode;
    if(groundedRun&&stepIndex!==this.lastFootstepStep){
      const side=stepIndex%2===0?-1:1;
      this.footstepRipples.push({x:this.x+side*.16,z:4.22,age:0});
      if(this.footstepRipples.length>8)this.footstepRipples.shift();
    }
    this.lastFootstepStep=stepIndex;
    for(const key of Object.keys(this.powers))if(key!=='shield')this.powers[key]=Math.max(0,this.powers[key]-dt);
    if(!this.tutorialActive){
    this.virusIn-=dt;if(this.virusIn<=0)this.spawnVirusWave();this.spawnIn-=step;if(this.spawnIn<=0){this.spawnRow();this.spawnVaccine();this.spawnIn=32-Math.min(5,this.distance/500);}
    this.powerIn-=step;if(this.powerIn<=0){const type=['magnet','double','flight','boost','shield'][this.powerIndex++%5];const lane=type==='shield'?this.shieldLane(-94):getRandomInt(-1,1);if(lane!==null)this.items.push({type,lane,z:-94});this.powerIn=90;}
    }
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
      else if(o.type==='vaccine'){const y=o.y??1.05;if(contactHeight<=y+.35&&contactHeight+this.playerCollisionHeight>=y-.35)this.collectVaccine(o);}
      else if(Object.hasOwn(this.powers,o.type)&&(!this.flightMode||Math.abs((o.y??1.05)-(this.jumpY+1))<1.5)){o.collected=true;o.collectTime=0;if(o.type==='shield'){this.powers.shield=1;this.toast('POLIO PROTECTOR ACTIVATED');this.burst(this.x,this.jumpY+1,4,'#ffd766');continue;}if(o.type==='flight'){this.activateFlight();this.burst(this.x,this.jumpY+1,4,'#75e9ff');continue;}this.powers[o.type]=10;this.toast({shield:'Shield on · one hit protected',boost:'Speed boost · invincible for 10s',double:'Double score · make it count!',magnet:'Magnet · bring on the drops!'}[o.type]);this.burst(o.lane*3,1.4,4,'#c3ff89');}
      else if(!o.passed&&['virus','barrier','overhead'].includes(o.type)){const safe=isVirus?this.virusSafe(o,contactHeight,this.time-dt+dt*contact):o.type==='overhead'?(this.jumpY>2.7||(this.slide>0&&this.playerCollisionHeight<1.2&&this.jumpY<.3)):this.jumpY>1.05;if(this.tutorialActive&&o.training&&['JUMP','ROLL'].includes(this.tutorialStage)){if(safe&&this.tutorialAction&&(this.tutorialStage==='JUMP'||this.slide>0))o.trainingCleared=true;else o.trainingFailed=true;continue;}if(!safe){o.passed=true;if(this.powers.boost>0||this.invincible>0){o.collected=true;this.burst(o.lane*3,1,4,'#ffcf6a');}else if(this.powers.shield>0){this.powers.shield=0;this.invincible=1.2;o.collected=true;this.shieldBreak=.45;this.burst(this.x,this.jumpY+1,4,'#ffd766');this.burst(this.x,this.jumpY+1,4,'#e21f32');this.toast('SHIELD BROKEN!');if(this.tutorialActive&&o.training)o.shieldAbsorbed=true;}else{if(this.tutorialActive){o.trainingFailed=true;continue;}if(isVirus){o.collected=true;this.loseLife();if(this.state!=='running')break;continue;}this.burst(this.x,1,4,'#dc74e3');this.finish();break;}}}}
    }
    if(this.lifeHitTime>0&&this.state==='running')this.animationState='HIT';
    this.updateTutorial(dt);
    for(const o of this.items)if(o.collected)o.collectTime=(o.collectTime||0)+dt;
    this.items=this.items.filter(o=>o.z<12&&(!o.collected||(o.collected&&['boost','double','magnet'].includes(o.type)&&(o.collectTime||0)<.3)));
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=8*dt;}
    this.particles=this.particles.filter(p=>p.life>0);
    for(const effect of this.collectionEffects)effect.age+=dt;
    this.collectionEffects=this.collectionEffects.filter(effect=>effect.age<.65);
    for(const ripple of this.footstepRipples)ripple.age+=dt;
    this.footstepRipples=this.footstepRipples.filter(ripple=>ripple.age<.38);
  }
  updateWorld(dt){
    this.worldLabelTime=Math.max(0,this.worldLabelTime-dt);
    this.environment=getEnvironment(this.distance);
    const env=this.environment,key=env.cycle+':'+env.id;
    if(key!==this.worldLabelKey){
      this.worldLabelKey=key;this.worldLabelTime=2;
      const world=RUN_WORLDS.find(w=>w.id===env.id);
      document.querySelector('#world-label').textContent=world.label;
      document.querySelector('#world-subtitle').textContent=world.subtitle||'';
      this.worldEntryShown=env.id!=='BRIGHT_CITY';this.greenEntryShown=env.id==='GREEN_DISTRICT';
      this.worldApproachShown=env.id!=='BRIGHT_CITY';
    }else if(env.id==='BRIGHT_CITY'&&env.approaching&&this.worldApproachCycle!==env.cycle){
      this.worldApproachCycle=env.cycle;this.worldApproachShown=true;this.worldLabelTime=2;
      document.querySelector('#world-label').textContent='VIRUS TUNNEL AHEAD';
      document.querySelector('#world-subtitle').textContent='';
    }
    this.updateWorldHUD();
  }
  updateWorldHUD(){
    document.querySelector('#world-label-panel').hidden=this.state!=='running'||this.worldLabelTime<=0;
    document.querySelector('#world-label').hidden=this.state!=='running'||this.worldLabelTime<=0;
  }
  collect(o){
    this.drops++;this.score+=25*(this.powers.double>0?2:1);
    const x=o.lane*3,y=(o.y??1.05)+Math.sin(this.time*2.7+o.z*.055)*.10;
    this.collectionEffects.push({x,y,z:o.z,playerX:this.x,playerY:this.jumpY,age:0});
    if(this.collectionEffects.length>24)this.collectionEffects.shift();
    this.burst(x,y,o.z,'#35dff5',8,.30,.46,.12,'#f4ffff');
  }
  updateHUD(){document.querySelector('.game-shell').classList[this.state==='paused'?'add':'remove']('is-paused');document.querySelector('#pause').hidden=this.state!=='running';this.updateLifeHUD();this.updateWorldHUD();this.updateTutorialHUD();this.updateVaccineHUD();document.querySelector('#score').textContent=String(Math.floor(this.score)).padStart(6,'0');document.querySelector('#distance').textContent=Math.floor(this.distance).toLocaleString();document.querySelector('#best').textContent=this.best.toLocaleString();document.querySelector('#header-best').textContent=this.best.toLocaleString();document.querySelector('#multiplier').textContent=this.powers.double>0?'×2':'×1';document.querySelector('#pace').textContent=this.state==='running'?Math.round(this.speed*3.6)+' KM/H':'MORNING RUN';document.querySelector('#pause').textContent=this.state==='paused'?'\u25b6':'\u2161';document.querySelector('#pause').setAttribute('aria-label',this.state==='paused'?'Resume game':'Pause game');const names={boost:'\u26a1 Speed boost',double:'×2 Double score',magnet:'n Magnet',flight:'\u2726 Flight'};document.querySelector('#power-hud').innerHTML=Object.entries(this.powers).filter(([,n])=>n>0).map(([key,n])=>key==='shield'?'<div class="active-power shield" role="status">&#128737; PROTECTED</div>':`<div class="active-power ${key}">${names[key]} · ${Math.ceil(n)}s<progress max="${key==='flight'?7:10}" value="${n}"></progress></div>`).join('');}
  frame(now){const dt=this.last===null?0:Math.min((now-this.last)/1000||0,.04);this.last=now;if(this.state==='running')this.update(dt);else if(this.state==='start'){this.time+=dt;this.travel+=dt*2.2;}else if(this.state==='over'){this.deathTime=Math.min(1,this.deathTime+dt);this.animationState=this.deathTime<.18?'HIT':'DEATH';}if(this.state==='running'&&this.toastTime>0){this.toastTime-=dt;if(this.toastTime<=0)document.querySelector('#message').classList.remove('visible');}this.scene.render(this);this.updateHUD();requestAnimationFrame(t=>this.frame(t));}
}
try{window.runner=new DropDash();}catch(error){document.querySelector('#overlay-title').textContent='Let’s get you running.';document.querySelector('#overlay-copy').textContent=error.message;document.querySelector('#start').hidden=true;console.error(error);}


