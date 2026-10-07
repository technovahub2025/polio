const {spawn}=require('node:child_process');const fs=require('node:fs');
(async()=>{const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9222','--user-data-dir=E:/subway_surfers/.browser-test','about:blank'],{windowsHide:true,stdio:'ignore'});
let pages;for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9222/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const callbacks=new Map();const errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){callbacks.get(m.id)?.(m.result);callbacks.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};const send=(method,params={})=>new Promise(r=>{callbacks.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:4173'});await new Promise(r=>setTimeout(r,4500));
console.log(JSON.stringify(await send('Runtime.evaluate',{expression:'JSON.stringify({state:runner.state,webgl:!!runner.scene.gl,body:document.body.innerText.slice(0,500)})',returnByValue:true})));
let shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('desktop-preview.png',Buffer.from(shot.data,'base64'));
await send('Runtime.evaluate',{expression:'runner.start();runner.powers.shield=18'});await new Promise(r=>setTimeout(r,1500));await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});console.log(JSON.stringify(await send('Runtime.evaluate',{expression:'JSON.stringify({state:runner.state,lane:runner.lane,distance:runner.distance,score:runner.score,glError:runner.scene.gl.getError()})',returnByValue:true})));
await send('Runtime.evaluate',{expression:"runner.items=[];runner.spawnVirusWave();runner.items.forEach((o,i)=>o.z=-8-i*7);runner.lane=0;runner.x=0;runner.time=1;runner.state='paused';runner.scene.render(runner)"});
shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('virus-preview.png',Buffer.from(shot.data,'base64'));
const actorCheck=await send('Runtime.evaluate',{expression:"JSON.stringify({viruses:runner.items.length,playerReady:!!runner.scene.playerRig,glError:runner.scene.gl.getError()})",returnByValue:true});console.log('Virus wave and articulated character:',actorCheck.result.value);if(!JSON.parse(actorCheck.result.value).playerReady)errors.push('Player rig failed to initialize');
// Joint, transition, repeated-roll and ground-contact checks live in
// scripts/player-browser-check.cjs and tests/player-rig.test.cjs.
await send('Runtime.evaluate',{expression:"runner.resume();runner.togglePause()"});await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,1000));shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('mobile-preview.png',Buffer.from(shot.data,'base64'));await send('Runtime.evaluate',{expression:'runner.resume();runner.lane=0;runner.x=0'});
await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:410}]});
await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:270,y:410}]});
await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const swipe=await send('Runtime.evaluate',{expression:'runner.lane',returnByValue:true});
console.log('Mobile swipe lane:',swipe.result.value);if(swipe.result.value!==1)errors.push('Swipe did not move right');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
await send('Runtime.evaluate',{expression:"runner.state='paused';runner.items=[];runner.lane=0;runner.x=0;runner.slide=runner.rollDuration*.5;runner.animationState='SOMERSAULT';runner.scene.render(runner)"});
shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('flip-preview.png',Buffer.from(shot.data,'base64'));
console.log('Runtime errors:',JSON.stringify(errors));ws.close();chrome.kill();process.exit(errors.length?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

