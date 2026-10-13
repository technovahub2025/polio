const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'dropdash-shield-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9236','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;
 try{
  let pages;
  for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9236/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  assert.ok(pages,'Chrome debugging endpoint available');
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const callbacks=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const c=callbacks.get(m.id);callbacks.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out: '+method)),15000);callbacks.set(++id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});await new Promise(r=>setTimeout(r,1800));
  assert.equal(await evaluate('runner.scene.playerPose.warrior'),true);
  const shieldChecks=await evaluate(`(()=>{
    runner.start();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;
    runner.items=[{type:'shield',lane:0,z:4}];runner.update(.01);runner.updateHUD();
    const pickup=runner.powers.shield===1&&document.querySelector('#message').textContent==='POLIO PROTECTOR ACTIVATED';
    const hud=document.querySelector('#power-hud').textContent.includes('PROTECTED')&&!document.querySelector('#power-hud progress');
    runner.items=[{type:'shield',lane:0,z:4}];runner.update(.01);const noStack=runner.powers.shield===1;
    runner.items=[{type:'virus',lane:0,z:4}];runner.update(.01);runner.scene.render(runner);
    const survived=runner.state==='running'&&runner.animationState!=='HIT'&&runner.powers.shield===0&&document.querySelector('#message').textContent==='SHIELD BROKEN!';
    runner.update(.01);const grace=runner.state==='running';
    for(let i=0;i<31;i++)runner.update(.04);
    runner.items=[{type:'barrier',lane:0,z:4}];runner.update(.01);
    return {pickup,hud,noStack,survived,grace,death:runner.state==='over'};
  })()`);
  assert.ok(Object.values(shieldChecks).every(Boolean),JSON.stringify(shieldChecks));
  console.log('Shield checks:',shieldChecks);
  const reachable=await evaluate(`(()=>{
    const seen=new Set([runner.animationState]);runner.start();seen.add(runner.animationState);
    runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;
    runner.action('jump');for(let i=0;i<90;i++){runner.update(1/60);seen.add(runner.animationState);}
    runner.action('slide');seen.add(runner.animationState);
    runner.slide=0;runner.powers.flight=3;runner.flightMode=true;runner.update(1/60);seen.add(runner.animationState);
    runner.finish();seen.add(runner.animationState);runner.deathTime=.8;
    runner.state='paused';document.querySelector('#overlay').classList.add('hidden');return [...seen];})()`);
  for(const state of ['IDLE','RUN','JUMP','FALL','LAND','SOMERSAULT','FLYING','HIT'])assert.ok(reachable.includes(state),state+' reachable');
  fs.mkdirSync('artifacts/player-animation/shield',{recursive:true});
  for(const state of ['IDLE','RUN','JUMP','FALL','LAND','SOMERSAULT','FLYING','HIT','DEATH']){
    const result=await evaluate(`(()=>{Object.assign(runner,{animationState:'${state}',x:0,jumpY:${['JUMP','FALL','FLYING'].includes(state)?1:0},runPhase:1.2,time:1.3,slide:.34,deathTime:${state==='HIT'?.1:.7},landingImpact:${state==='LAND'?1:0},laneVelocity:0,flightCameraY:0});runner.powers.shield=1;runner.items=[{type:'shield',lane:-1,z:0}];runner.scene.render(runner);return {height:runner.scene.playerPose.visualHeight,error:runner.scene.gl.getError()};})()`);
    assert.equal(result.error,0);assert.ok(Number.isFinite(result.height));
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/player-animation/shield/'+state+'.png',Buffer.from(shot.data,'base64'));
    console.log(state,result);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("runner.animationState='RUN';runner.landingImpact=0;runner.scene.render(runner)");
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/player-animation/shield/mobile.png',Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);console.log('No browser console/runtime errors; states reachable:',reachable.join(', '));
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
