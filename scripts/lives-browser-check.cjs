const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'dropdash-lives-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--no-first-run','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9242','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,server;
 try{
  try{await fetch('http://127.0.0.1:4173/');}catch{server=spawn(process.execPath,['scripts/serve.cjs'],{windowsHide:true,stdio:'ignore'});}
  let pages;
  for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9242/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
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
  fs.mkdirSync('artifacts/player-animation/lives',{recursive:true});
  const setup=()=>evaluate(`(()=>{runner.start();runner.endTutorial();runner.items=[];runner.spawnIn=runner.virusIn=runner.powerIn=1e9;runner.updateHUD();return runner.lives;})()`);
  for(const [width,height,mobile] of [[1100,850,false],[390,844,true],[320,740,true]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    assert.equal(await setup(),5);
    for(const lives of [5,4,1,0]){
      const result=await evaluate(`(()=>{
        while(runner.lives>${lives}){runner.invincible=0;runner.items=[{type:'virus',lane:0,z:4}];runner.update(.01);}
        runner.powers.shield=1;runner.updateHUD();runner.scene.render(runner);
        const hud=document.querySelector('#life-hud'),a=hud.getBoundingClientRect();
        const overlap=['.score-group','.run-stats','#vaccine-hud','#power-hud'].filter(selector=>{const n=document.querySelector(selector),b=n.getBoundingClientRect();return !n.hidden&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});
        return {lives:runner.lives,state:runner.state,hearts:[...document.querySelectorAll('.life-hearts>span')].map(n=>n.textContent).join(''),overlap,fits:a.left>=0&&a.right<=innerWidth&&hud.scrollWidth<=hud.clientWidth,gl:runner.scene.gl.getError()};
      })()`);
      assert.equal(result.lives,lives);assert.equal(result.state,lives?'running':'over');assert.equal(result.hearts,'\u2665'.repeat(lives)+'\u2661'.repeat(5-lives));assert.deepEqual(result.overlap,[]);assert.ok(result.fits);assert.equal(result.gl,0);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`artifacts/player-animation/lives/${width}-${lives}.png`,Buffer.from(shot.data,'base64'));
      // Remove the displayed shield before the next ordinary virus collision.
      await evaluate("runner.powers.shield=0");
    }
  }
  assert.equal(await setup(),5);
  const ordinary=await evaluate(`(()=>{
    runner.powers.shield=1;runner.items=[{type:'virus',lane:0,z:4}];runner.update(.01);
    const shield=runner.lives===5&&runner.powers.shield===0;runner.invincible=0;
    runner.items=[{type:'virus',lane:0,z:4}];runner.update(.01);const damage=runner.lives===4&&runner.state==='running';
    runner.items=[{type:'vaccine',lane:0,z:4}];runner.update(.01);const vaccine=runner.vaccinePower===1&&runner.lives===4;
    const renders=[];const original=runner.scene.virus;
    try{runner.scene.virus=function(...args){renders.push(args);return original.apply(this,args)};
      runner.items=[{type:'virus',variant:'normal',lane:1,z:-10}];
      for(const distance of [300,600,1000,1600,2200,2800]){runner.distance=distance;runner.updateWorld(0);runner.scene.render(runner);}
    }finally{runner.scene.virus=original;}
    return {shield,damage,vaccine,onlyTrackViruses:renders.length===6&&renders.every(args=>args[2]===-10)};
  })()`);
  assert.ok(Object.values(ordinary).every(Boolean),JSON.stringify(ordinary));
  assert.deepEqual(errors,[]);console.log('Life HUD and collisions passed at desktop, 390px and 320px; no overlap or browser errors.');
 }finally{ws?.close();chrome.kill();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
