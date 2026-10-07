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

 fs.mkdirSync('artifacts/level2',{recursive:true});
 const shot=async name=>{await evaluate('runner.scene.render(runner)');const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/level2/'+name+'.png',Buffer.from(r.data,'base64'));};
 const reset=()=>evaluate("runner.start();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=runner.flightPathIn=1e9;runner.state='paused'");
 await reset();
 await evaluate("runner.items=['normal','elite','fast','small','special','chaser','flying'].map((type,i)=>{const o=runner.makeVirus(type,i%3-1,4,.8,i===6?'medium':null);o.z=-7-Math.floor(i/3)*17;return o;});runner.scene.render(runner)");
 await shot('virus-variants');
 const checks={};
 await reset();
 checks.flightPickup=await evaluate("runner.items=[{type:'flight',lane:0,z:4}];runner.update(.01);runner.flightMode&&runner.powers.flight===7&&runner.jumpY===0");
 await evaluate("runner.flightPathIn=0;for(let i=0;i<90;i++)runner.update(1/60)");
 checks.ascent=await evaluate("runner.jumpY>4.8&&runner.animationState==='FLYING'&&runner.flightCameraY>4&&runner.items.some(o=>o.airDrop)");
 await shot('flight-cruise');
 await evaluate("runner.state='running'");await key('ArrowLeft');await evaluate("runner.update(.1);runner.state='paused'");
 checks.flyingLane=await evaluate("runner.lane===-1&&runner.x<0&&runner.flightMode");
 await shot('flight-lane-change');
 await reset();
 await evaluate("runner.activateFlight();runner.flightPathIn=1e9;runner.jumpY=5;runner.items=[{type:'virus',lane:0,z:4}];runner.state='running';runner.update(.01);runner.state='paused'");
 checks.groundImmunity=await evaluate('!runner.items[0].passed&&runner.jumpY>4.9');
 checks.highCollision=await evaluate("runner.state='running';runner.powers.shield=0;runner.invincible=0;const high=runner.makeVirus('flying',0,4,0,'high');high.z=4;runner.items=[high];runner.update(.01);runner.state==='over'");
 await reset();
 checks.descent=await evaluate("(()=>{runner.activateFlight();runner.flightPathIn=1e9;let smooth=true,last=0;for(let i=0;i<580;i++){runner.update(1/60);smooth&&=Math.abs(runner.jumpY-last)<.3;last=runner.jumpY;}return smooth&&!runner.flightMode&&runner.jumpY===0&&runner.animationState==='RUN';})()");
 await shot('flight-landed');
 await evaluate("runner.state='running'");await key('ArrowDown');checks.rollRestored=await evaluate("runner.animationState==='SOMERSAULT'");
 await reset();
 await evaluate("runner.items=[runner.makeVirus('chaser',0,7,.6)];runner.state='running'");await key('ArrowRight');
 checks.delayedChase=await evaluate("(()=>{runner.state='paused';for(let i=0;i<20;i++)runner.update(1/60);const stayed=runner.items[0].x===0;for(let i=0;i<35;i++)runner.update(1/60);return stayed&&runner.items[0].x>0&&runner.items[0].x<3;})()");
 await shot('chaser-following');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await reset();await evaluate("runner.activateFlight();runner.flightPathIn=0;for(let i=0;i<90;i++)runner.update(1/60);runner.updateHUD()");await shot('flight-mobile');
 checks.hud=await evaluate("document.querySelector('#power-hud').textContent.includes('Flight')");
 checks.webgl=await evaluate('runner.scene.gl.getError()===0');
 assert.ok(Object.values(checks).every(Boolean),JSON.stringify(checks));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks,consoleErrors:errors,screenshots:'artifacts/level2'},null,2));

 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
