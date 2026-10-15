/* Keyboard, swipe, and button controls share one action path. */
function setupRunnerInput(game) {
  const keys={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',w:'jump',' ':'jump',ArrowDown:'slide',s:'slide'};
  document.addEventListener('keydown',event=>{
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(event.target.closest('input,textarea,[contenteditable="true"]'))return;
    const instructions=document.querySelector('#instructions-overlay');
    if(instructions&&!instructions.hidden)return;
    if(key==='p'||key==='Escape'){event.preventDefault();if(!event.repeat)game.togglePause();return;}
    if(game.state==='paused'&&key==='Tab'){
      const buttons=[...document.querySelectorAll('#pause-overlay button')];
      if(!document.querySelector('#pause-overlay').hidden){
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      return;
    }
    if(event.target.closest('button,a'))return;
    if(game.state==='paused'){if(key==='Enter'){event.preventDefault();game.resume();}return;}
    if(keys[key]){event.preventDefault();if(!event.repeat)game.action(keys[key]);}
    else if(key==='Enter'&&game.state==='start')game.showInstructions();
    else if(key==='Enter'&&game.state!=='running')game.start();
    else if(key==='g')grayscale=!grayscale;
    else if(key==='f'){flash=true;setTimeout(()=>{flash=false;},180);}
    else if(key==='q'&&game.state==='running')game.finish();
  });
  let touch=null;
  game.cancelRunnerTouch=()=>{touch=null;};
  game.canvas.addEventListener('pointerdown',e=>{if(game.state!=='running')return;touch={x:e.clientX,y:e.clientY};game.canvas.setPointerCapture(e.pointerId);});
  game.canvas.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;game.action(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'slide':'jump'));});
  game.canvas.addEventListener('pointercancel',()=>{touch=null;});
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>game.action(b.dataset.action)));
  document.addEventListener('visibilitychange',()=>{touch=null;if(document.hidden)game.pause();});
}
