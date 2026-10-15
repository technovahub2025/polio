const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'dropdash-home-ui-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9241','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,server;
 try{
  try{await fetch('http://127.0.0.1:4173/');}catch{server=spawn(process.execPath,['scripts/serve.cjs'],{windowsHide:true,stdio:'ignore'});}
  let pages;
  for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9241/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  assert.ok(pages,'Chrome available');ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const callbacks=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const c=callbacks.get(m.id);callbacks.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timed out: '+method)),15000);callbacks.set(++id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:4173/test_polio/'});await new Promise(r=>setTimeout(r,1800));
  await evaluate('window.requestAnimationFrame=()=>0');await new Promise(r=>setTimeout(r,100));
  await evaluate("document.querySelector('#instructions-ok').click();window.advance=n=>{for(let i=0;i<n;i++)runner.update(.01)}");
  fs.mkdirSync('artifacts/home-image',{recursive:true});
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/home-image/'+name+'.png',Buffer.from(r.data,'base64'));};
  const swipe=async(dx,dy)=>{
    const x=await evaluate('innerWidth*.5'),y=await evaluate('innerHeight*.60');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  for(const [width,height] of [[1366,768],[1440,900],[390,844],[393,852]]){
    const mobile=width<600;
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await evaluate('runner.mainMenu();runner.scene.render(runner)');
    assert.equal(await evaluate('runner.scene.playerPose'),null);
    const home=await evaluate(`(()=>{
      const img=document.querySelector('#home-warrior'),image=img.getBoundingClientRect(),text=document.querySelector('.intro-card').getBoundingClientRect(),hud=document.querySelector('.hud').getBoundingClientRect();
      return {loaded:img.complete&&img.naturalWidth>0,src:img.src,fits:image.x>=0&&image.right<=innerWidth&&image.bottom<=innerHeight,separate:innerWidth>600?image.x>=text.right:image.bottom<=text.y,belowHUD:image.y>=hud.bottom,scroll:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert.equal(home.loaded,true,'exact supplied image loads');
    assert.ok(home.src.endsWith('/test_polio/assets/polio-warrior-home.png'));
    assert.ok(home.fits&&home.separate&&home.belowHUD&&!home.scroll,'responsive home image fits clear of text and HUD');
    assert.equal(await evaluate("document.querySelectorAll('.touch-controls,[data-action]').length"),0);
    await shot(width+'-home');
    await evaluate("document.querySelector('#start').click();runner.scene.render(runner)");
    assert.equal(await evaluate('runner.scene.playerPose.warrior'),true);
    assert.equal(await evaluate("document.querySelector('#home-warrior').getBoundingClientRect().width"),0,'image disappears with home');
    assert.equal(await evaluate('runner.animationState'),'RUN');
    const rects=await evaluate(`(()=>{
      const ids=['tutorial','tutorial-skip','pause','sound','life-hud','vaccine-hud','score','distance','multiplier'];
      const result=Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,visible:r.width>0&&r.height>0}]}));
      const r=document.querySelector('.scene-caption').getBoundingClientRect();result.caption={y:r.y};return result;
    })()`);
    for(const [id,r] of Object.entries(rects))if(id!=='caption'){
      assert.ok(r.visible,id+' visible');assert.ok(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=height,id+' fits');
    }
    assert.ok(rects.tutorial.y>height*.7,'tutorial near bottom');
    assert.ok(rects.tutorial.bottom<rects.caption.y,'tutorial above caption');
    assert.ok(rects['vaccine-hud'].bottom<rects.tutorial.y,'tutorial clear of HUD');
    assert.ok(rects.score.bottom<rects['vaccine-hud'].y,'vaccine below score');
    assert.ok(rects['vaccine-hud'].right<=rects['life-hud'].x,'vaccine and hearts separate');
    assert.ok(rects.pause.right<=rects.sound.x,'pause and audio separate');
    await shot(width+'-training');
    if(mobile){
      await swipe(-80,0);await evaluate('advance(35)');assert.equal(await evaluate('runner.tutorialStage'),'MOVE_RIGHT');
      await swipe(80,0);await evaluate('advance(35)');assert.equal(await evaluate('runner.tutorialStage'),'JUMP');
      await swipe(0,-80);assert.equal(await evaluate('runner.animationState'),'JUMP');
      await evaluate('advance(150)');
      await swipe(0,80);assert.equal(await evaluate('runner.animationState'),'SOMERSAULT');
      assert.ok(await evaluate('runner.slide>0'));
    }
    await evaluate("document.querySelector('#pause').click()");assert.equal(await evaluate('runner.state'),'paused');
    assert.equal(await evaluate("document.querySelector('#tutorial').hidden"),true);
    await evaluate("document.querySelector('#pause-resume').click()");assert.equal(await evaluate('runner.state'),'running');
    assert.equal(await evaluate('runner.scene.gl.getError()'),0);
    console.log('PASS',width+'x'+height,'home/start, layout, HUD, pause'+(mobile?', all four touch swipes':''));
  }
  await send('Page.reload');await new Promise(r=>setTimeout(r,1800));
  assert.equal(await evaluate("runner.state==='start'&&document.querySelector('#home-warrior').naturalWidth>0"),true,'refresh restores home image');
  assert.deepEqual(errors,[]);
 }finally{ws?.close();chrome.kill();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
