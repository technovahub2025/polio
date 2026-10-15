const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'dropdash-training-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9237','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,server;
 try{
  try{await fetch('http://127.0.0.1:4173/');}catch{server=spawn(process.execPath,['scripts/serve.cjs'],{windowsHide:true,stdio:'ignore'});}
  let pages;
  for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9237/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  assert.ok(pages,'Chrome debugging endpoint available');
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const callbacks=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const c=callbacks.get(m.id);callbacks.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out: '+method)),15000);callbacks.set(++id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4173/'});await new Promise(r=>setTimeout(r,1800));
  await evaluate("document.querySelector('#instructions-ok').click();window.requestAnimationFrame=()=>0");
  await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#start').click();window.advance=n=>{for(let i=0;i<n;i++)runner.update(.01)};window.until=predicate=>{for(let i=0;i<2000&&!predicate();i++)runner.update(.01);if(!predicate())throw Error('Training stalled: '+runner.tutorialStage)};");
  const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});};
  assert.equal(await evaluate('runner.tutorialStage'),'MOVE_LEFT');
  await key('ArrowLeft');await evaluate('advance(35)');assert.equal(await evaluate('runner.tutorialStage'),'MOVE_RIGHT');
  await key('ArrowRight');await evaluate('advance(35)');assert.equal(await evaluate('runner.tutorialStage'),'JUMP');
  for(const [stage,action,lead] of [['JUMP','ArrowUp',.4],['ROLL','ArrowDown',.23]]){
    assert.equal(await evaluate('runner.tutorialStage'),stage);
    await evaluate(`window.challenge=runner.items.find(o=>o.training);until(()=>challenge.z>=4-runner.speed*${lead})`);
    await key(action);await evaluate('until(()=>!runner.items.includes(challenge))');
  }
  assert.equal(await evaluate('runner.tutorialStage'),'VACCINE');
  await evaluate("until(()=>runner.tutorialStage==='FLIGHT_CONTROL')");
  await key('ArrowLeft');await evaluate('advance(120);runner.scene.render(runner);runner.updateHUD()');
  assert.equal(await evaluate('runner.tutorialFlightMoved'),true);
  assert.equal(await evaluate('runner.scene.playerPose.flight>0'),true);
  fs.mkdirSync('artifacts/player-animation/training',{recursive:true});
  const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/player-animation/training/'+name+'.png',Buffer.from(result.data,'base64'));};
  await shot('desktop-flight');
  await evaluate("until(()=>runner.tutorialStage==='NORMAL')");
  assert.equal(await evaluate('runner.vaccinePower'),3);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("runner.start();runner.scene.render(runner);runner.updateHUD()");
  const mobile=await evaluate(`(()=>{const r=document.querySelector('#tutorial').getBoundingClientRect(),b=document.querySelector('#tutorial-skip').getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth&&b.right<=innerWidth,arrow:document.querySelector('#tutorial-arrow').textContent};})()`);
  assert.equal(mobile.fits,true);assert.equal(mobile.arrow,'\u2190');await shot('mobile-move');
  const point=await evaluate("(()=>{const r=runner.canvas.getBoundingClientRect();return {x:r.x+r.width*.7,y:r.y+r.height*.7,end:r.x+r.width*.3}})()");
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.end,y:point.y}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await evaluate('advance(35)');
  assert.equal(await evaluate('runner.tutorialStage'),'MOVE_RIGHT');
  await evaluate("document.querySelector('#tutorial-skip').click()");assert.equal(await evaluate('runner.tutorialStage'),'NORMAL');
  assert.equal(await evaluate('runner.scene.gl.getError()'),0);
  assert.deepEqual(errors,[]);console.log('PASS: desktop keyboard training flow, flight pose, mobile layout/swipe, skip, WebGL and browser errors.');
 }finally{ws?.close();chrome.kill();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
