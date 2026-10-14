const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'dropdash-pause-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--no-first-run','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9244','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,server;
 try{
  try{await fetch('http://127.0.0.1:4173/');}catch{server=spawn(process.execPath,['scripts/serve.cjs'],{windowsHide:true,stdio:'ignore'});}
  let pages;
  for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9244/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  assert.ok(pages,'Chrome debugging endpoint available');
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const callbacks=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const c=callbacks.get(m.id);callbacks.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out: '+method)),15000);callbacks.set(++id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});await new Promise(r=>setTimeout(r,1800));
  await evaluate('window.requestAnimationFrame=()=>0');await new Promise(r=>setTimeout(r,100));
  fs.mkdirSync('artifacts/player-animation/pause',{recursive:true});
  await evaluate(`window.pauseSnapshot=()=>JSON.stringify({distance:runner.distance,score:runner.score,lives:runner.lives,time:runner.time,travel:runner.travel,x:runner.x,jumpY:runner.jumpY,slide:runner.slide,phase:runner.runPhase,powers:runner.powers,items:runner.items,particles:runner.particles,environment:runner.environment,grace:runner.invincible});`);
  for(const [width,height,mobile] of [[1100,850,false],[390,844,true],[320,740,true]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
    const position=await evaluate(`(()=>{runner.start();runner.endTutorial();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;runner.powers.double=4;runner.action('jump');runner.update(.1);runner.updateHUD();runner.scene.render(runner);const a=document.querySelector('#pause').getBoundingClientRect(),shell=document.querySelector('.game-shell').getBoundingClientRect();const overlap=['.score-group','#distance','#multiplier','#life-hud','#vaccine-hud','#power-hud'].filter(selector=>{const n=document.querySelector(selector),b=n.getBoundingClientRect();return !n.hidden&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});return {x:(a.left+a.right)/2,y:(a.top+a.bottom)/2,width:a.width,height:a.height,fits:a.right<=shell.right&&a.left>=shell.left,overlap};})()`);
    assert.ok(position.width>=44&&position.height>=44&&position.fits,JSON.stringify(position));assert.deepEqual(position.overlap,[]);
    if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:position.x,y:position.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else await evaluate("document.querySelector('#pause').click()");
    assert.equal(await evaluate('runner.state'),'paused');
    const before=await evaluate('pauseSnapshot()');
    await evaluate("for(let i=0;i<100;i++){runner.frame(10000+i*40);runner.update(.04);runner.action('left');}");
    assert.equal(await evaluate('pauseSnapshot()'),before);
    const layout=await evaluate(`(()=>{const a=document.querySelector('#pause-overlay').getBoundingClientRect();return [...document.querySelectorAll('#pause-overlay button')].every(b=>{const r=b.getBoundingClientRect();return r.height>=44&&r.left>=a.left&&r.right<=a.right&&r.bottom<=a.bottom});})()`);assert.ok(layout);
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/player-animation/pause/'+width+'.png',Buffer.from(shot.data,'base64'));
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
    assert.equal(await evaluate('runner.state'),'running');assert.equal(await evaluate('pauseSnapshot()'),before);
    await evaluate('runner.frame(900000)');assert.equal(await evaluate('pauseSnapshot()'),before);
    await evaluate('runner.frame(900016)');assert.notEqual(await evaluate('pauseSnapshot()'),before);
  }
  const behavior=await evaluate(`(()=>{
    const calls=[];audio.pause=()=>calls.push('pause');audio.play=()=>{calls.push('play');return Promise.resolve()};runner.muted=false;audio.currentTime=12;
    runner.pause();const pausedAudio=audio.currentTime;runner.resume();const sameAudio=audio.currentTime===pausedAudio;
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));const hiddenPaused=runner.state==='paused';
    Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));const staysPaused=runner.state==='paused';delete document.hidden;
    runner.lives=2;document.querySelector('#pause-restart').click();const restart=runner.lives===5&&runner.distance===0&&runner.tutorialActive;
    runner.pause();document.querySelector('#pause-menu').click();return {calls,sameAudio,hiddenPaused,staysPaused,restart,menu:runner.state==='start'&&runner.lives===5};
  })()`);
  assert.ok(behavior.sameAudio&&behavior.hiddenPaused&&behavior.staysPaused&&behavior.restart&&behavior.menu,JSON.stringify(behavior));assert.deepEqual(behavior.calls.slice(0,3),['pause','play','pause']);
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile touch pause, 44px target, frozen simulation, Escape resume, no catch-up, audio, visibility, restart and menu.');
 }finally{ws?.close();chrome.kill();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
