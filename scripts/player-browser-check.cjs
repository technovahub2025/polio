const {spawn}=require('node:child_process');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9223','--user-data-dir=E:/subway_surfers/.browser-test-animation','about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;
 try{
 let pages;for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9223/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const callbacks=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const cb=callbacks.get(m.id);callbacks.delete(m.id);m.error?cb.reject(m.error):cb.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{callbacks.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:4173'});await new Promise(r=>setTimeout(r,1800));
 assert.equal(await evaluate('!!window.runner?.scene.playerRig'),true);
 await evaluate('runner.scene.playerRig.asset.loaded.then(()=>true)');
 await evaluate("runner.start();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;runner.invincible=100");
 await key('ArrowRight');assert.equal(await evaluate('runner.lane'),1);
 await key('ArrowUp');assert.equal(await evaluate("['JUMP','FALL'].includes(runner.animationState)"),true);
 await key('ArrowDown');assert.equal(await evaluate('runner.animationState'),'SOMERSAULT');
 await evaluate('runner.togglePause()');const frozen=await evaluate('runner.slide');await new Promise(r=>setTimeout(r,150));assert.equal(await evaluate('runner.slide'),frozen);
 fs.mkdirSync('artifacts/player-animation',{recursive:true});
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/player-animation/'+name+'.png',Buffer.from(r.data,'base64'));};
 for(const [name,code] of [
 ['run-contact',"runner.start();runner.state='paused';runner.items=[];runner.runPhase=0;"],
 ['run-swing',"runner.runPhase=Math.PI*.5;"],
 ['run-opposite',"runner.runPhase=Math.PI;"],
 ['lane-left',"runner.laneVelocity=-16;"],
 ['lane-right',"runner.laneVelocity=16;"],
 ['landing',"runner.laneVelocity=0;runner.animationState='LAND';runner.landingImpact=1;"],
 ['jump',"runner.landingImpact=0;runner.animationState='JUMP';runner.jumpY=1.4;runner.airPose=1;runner.jumpTime=.2;"],
 ['roll-entry',"runner.jumpY=0;runner.airPose=0;runner.animationState='SOMERSAULT';runner.slide=runner.rollDuration*.80;"],
 ['roll-inverted',"runner.slide=runner.rollDuration*.53;"],
 ['roll-exit',"runner.slide=runner.rollDuration*.12;"],
 ['recovered',"runner.slide=0;runner.animationState='RUN';"]]){
 await evaluate(code+'runner.scene.render(runner)');await shot(name);
 }
 const checks=await evaluate(`(()=>{
 runner.start();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;
 const states=[];runner.action('jump');for(let i=0;i<70;i++){runner.update(1/60);states.push(runner.animationState);runner.scene.player(runner);}
 const jump=['JUMP','FALL','LAND','RUN'].every(s=>states.includes(s));
 let grounded=true,maxSurfaceGap=0;for(let i=1;i<40;i++){runner.animationState='SOMERSAULT';runner.slide=runner.rollDuration*(1-i/40);runner.scene.player(runner);const rig=runner.scene.playerRig,a=rig.asset.attributes,b=rig.asset.bounds(rig.palette);let minimum=Infinity;
 for(let vertex=0;vertex<a.POSITION.length/3;vertex++){let y=0;for(let k=0;k<4;k++){const w=a.WEIGHTS_0[vertex*4+k];if(!w)continue;const m=a.JOINTS_0[vertex*4+k]*16;y+=w*(rig.palette[m+1]*a.POSITION[vertex*3]+rig.palette[m+5]*a.POSITION[vertex*3+1]+rig.palette[m+9]*a.POSITION[vertex*3+2]+rig.palette[m+13]);}minimum=Math.min(minimum,y);}
 maxSurfaceGap=Math.max(maxSurfaceGap,Math.abs(minimum-b.bottom));grounded&&=Math.abs(minimum-b.bottom)<.025;}
 runner.slide=0;runner.animationState='RUN';
 let repeats=true;for(let n=0;n<12;n++){runner.action('slide');for(let i=0;i<42;i++){runner.update(1/60);runner.scene.player(runner);}repeats&&=runner.animationState==='RUN'&&runner.scene.playerPose.turn===0&&runner.playerCollisionHeight===2.4;}
 runner.action('slide');runner.items=[{type:'overhead',lane:0,z:4}];runner.update(.01);const overhead=runner.state==='running';
 runner.start();runner.items=[{type:'overhead',lane:0,z:4}];runner.update(.01);const hit=runner.animationState==='HIT';
 runner.start();const restart=runner.animationState==='RUN'&&runner.slide===0&&runner.jumpY===0&&runner.runPhase===0;
 runner.state='paused';runner.scene.render(runner);window.playerContactError=maxSurfaceGap;
 return {jump,grounded,repeats,overhead,hit,restart,skinned:runner.scene.playerRig.asset.ready&&runner.scene.playerPose.bones===21,gl:runner.scene.gl.getError()===0};})()`);
 console.log('Maximum surface contact error:',await evaluate('window.playerContactError'));
 assert.ok(Object.values(checks).every(Boolean),JSON.stringify(checks));
 await evaluate('runner.resume();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9');
 await key('ArrowLeft');await evaluate('runner.update(.03);runner.scene.render(runner)');assert.ok(await evaluate('runner.scene.playerPose.lean>0'));
 await key('ArrowRight');await key('ArrowRight');await evaluate('runner.update(.12);runner.scene.render(runner)');assert.ok(await evaluate('runner.scene.playerPose.lean<0'));
 await key('s');assert.equal(await evaluate('runner.animationState'),'SOMERSAULT');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("runner.start();runner.state='paused';runner.scene.render(runner)");await shot('mobile');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,consoleErrors:errors,screenshots:'artifacts/player-animation'},null,2));
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
