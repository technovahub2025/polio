/* Procedural scenery uses the original mesh/buffer/draw pipeline. No background image. */
class RailwayScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {antialias:true, alpha:false});
    if (!this.gl) throw new Error('WebGL is unavailable. Please enable hardware acceleration.');
    const gl = this.gl;
    const vs = `attribute vec4 aVertexPosition; attribute vec3 aVertexNormal; attribute vec2 aTextureCoord;
      uniform mat4 uModelViewMatrix,uProjectionMatrix,uNormalMatrix; varying vec2 uv; varying vec3 light; varying float depth;
      void main(){vec4 p=uModelViewMatrix*aVertexPosition;gl_Position=uProjectionMatrix*p;uv=aTextureCoord;
      vec3 n=normalize((uNormalMatrix*vec4(aVertexNormal,0.)).xyz);light=vec3(.69)+vec3(.36,.32,.24)*max(dot(n,normalize(vec3(-.4,.8,.6))),0.);depth=-p.z;}`;
    const fs = `precision mediump float;varying vec2 uv;varying vec3 light;varying float depth;uniform sampler2D uSampler;uniform bool grayscale,flash;
      void main(){vec4 t=texture2D(uSampler,uv);if(t.a<.1)discard;vec3 c=t.rgb*light;if(grayscale)c=vec3(dot(c,vec3(.3,.59,.11)));if(flash)c+=.18;gl_FragColor=vec4(mix(c,vec3(.64,.83,.84),smoothstep(45.,150.,depth)),t.a);}`;
    const program=initShaderProgram(gl,vs,fs);
    this.info={program,attribLocations:{},uniformLocations:{}};
    for(const [key,name] of Object.entries({vertexPosition:'aVertexPosition',vertexNormal:'aVertexNormal',textureCoord:'aTextureCoord'})) this.info.attribLocations[key]=gl.getAttribLocation(program,name);
    for(const [key,name] of Object.entries({projectionMatrix:'uProjectionMatrix',modelViewMatrix:'uModelViewMatrix',normalMatrix:'uNormalMatrix',uSampler:'uSampler',grayscale:'grayscale',flash:'flash'})) this.info.uniformLocations[key]=gl.getUniformLocation(program,name);
    this.textures={};
    this.cube=createCube(0,0,0,[0,0,0],1,gl);this.cubeBuffer=initBuffers(gl,this.cube);
    this.ball=this.sphere();this.ballBuffer=initBuffers(gl,this.ball);
    this.virusBall=this.sphere(20);this.virusBallBuffer=initBuffers(gl,this.virusBall);
    this.playerRig=new PlayerRig(this);
    this.makeTextures();this.flightTexture();this.virusView=mat4.create();this.projection=mat4.create();this.view=mat4.create();
  }
  texture(name,paint) {
    const gl=this.gl,c=document.createElement('canvas');c.width=c.height=256;paint(c.getContext('2d'));
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);this.textures[name]=t;
    if(name.startsWith('poster')&&!name.endsWith('R'))this.texture(name+'R',ctx=>{ctx.translate(256,0);ctx.scale(-1,1);ctx.drawImage(c,0,0);});
    return t;
  }
  color(c){if(!this.textures[c])this.texture(c,x=>{x.fillStyle=c;x.fillRect(0,0,256,256);});return this.textures[c];}
  makeTextures(){
    this.texture('brick',c=>{c.fillStyle='#e2b094';c.fillRect(0,0,256,256);for(let y=0;y<8;y++)for(let x=-1;x<4;x++){c.fillStyle=['#b85e43','#cc7650','#d3835d','#c36a4d'][(x+y+4)%4];c.fillRect(x*86+(y%2)*43,y*32,82,28);c.fillStyle='#efad77';c.fillRect(x*86+(y%2)*43,y*32,82,3);}});
    this.texture('gravel',c=>{c.fillStyle='#8a8274';c.fillRect(0,0,256,256);let seed=91;for(let i=0;i<1900;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%256;c.fillStyle=['#aca18c','#6d7067','#d3bd9d'][i%3];c.fillRect(x,y,3+i%5,2+i%3);}});
    this.texture('stripe',c=>{c.fillStyle='#ffcf4a';c.fillRect(0,0,256,256);c.fillStyle='#233442';for(let x=-256;x<512;x+=90){c.beginPath();c.moveTo(x,0);c.lineTo(x+45,0);c.lineTo(x-60,256);c.lineTo(x-105,256);c.fill();}});
    ['END|POLIO|NOW','TWO DROPS.|A BRIGHTER|TOMORROW','POLIO|FREE|WORLD'].forEach((text,i)=>this.texture('poster'+i,c=>{c.fillStyle='#fff4df';c.fillRect(0,0,256,256);c.textAlign='center';c.font='900 42px sans-serif';text.split('|').forEach((line,j)=>{c.fillStyle=j===1?'#d64347':'#153a58';c.font=i===1?'900 25px sans-serif':'900 43px sans-serif';c.fillText(line,128,60+j*52);});c.fillStyle='#27bde4';c.beginPath();c.arc(128,220,15,0,Math.PI*2);c.fill();}));
    this.texture('drop',c=>{c.clearRect(0,0,256,256);c.shadowColor='#35eaff';c.shadowBlur=22;const g=c.createLinearGradient(0,20,0,230);g.addColorStop(0,'#ccffff');g.addColorStop(.4,'#21dfff');g.addColorStop(1,'#068dd7');c.fillStyle=g;c.beginPath();c.moveTo(128,17);c.bezierCurveTo(109,62,50,127,55,169);c.bezierCurveTo(58,250,198,250,201,169);c.bezierCurveTo(204,127,147,62,128,17);c.fill();c.strokeStyle='#c6ffff';c.lineWidth=5;c.stroke();c.shadowBlur=0;c.fillStyle='#f4ffff';c.beginPath();c.roundRect(93,133,70,73,12);c.fill();c.fillStyle='#106ea2';c.fillRect(103,120,50,18);c.font='bold 19px sans-serif';c.textAlign='center';c.fillText('POLIO',128,176);c.fillStyle='#ffffffb0';c.beginPath();c.ellipse(90,141,8,22,.4,0,7);c.fill();});
    [['shield','#63d9ff'],['boost','#ffce65'],['double','#c3a0ff'],['magnet','#ff8eac']].forEach(([name,color])=>{this.texture(name,c=>{c.fillStyle='#173e51';c.fillRect(0,0,256,256);const bg=c.createRadialGradient(128,128,0,128,128,120);bg.addColorStop(0,'#2a4a6a');bg.addColorStop(1,'#0a1a2a');c.fillStyle=bg;c.beginPath();c.arc(128,128,118,0,Math.PI*2);c.fill();c.save();c.shadowColor=color;c.shadowBlur=30;if(name==='shield'){c.fillStyle=color;c.beginPath();for(let i=0;i<6;i++){const a=i/3*Math.PI;c.lineTo(128+Math.cos(a)*74,128+Math.sin(a)*74);}c.closePath();c.fill();c.fillStyle='#a0e8ff';c.beginPath();for(let i=0;i<6;i++){const a=i/3*Math.PI;c.lineTo(128+Math.cos(a)*38,128+Math.sin(a)*38);}c.closePath();c.fill();c.fillStyle='#60d8ff';c.beginPath();c.moveTo(128,90);c.lineTo(166,132);c.lineTo(128,132);c.lineTo(162,178);c.lineTo(92,178);c.lineTo(128,132);c.lineTo(92,132);c.closePath();c.fill();}else if(name==='boost'){c.fillStyle=color;c.beginPath();c.moveTo(118,50);c.lineTo(178,135);c.lineTo(138,135);c.lineTo(175,205);c.lineTo(98,205);c.lineTo(132,135);c.lineTo(98,135);c.closePath();c.fill();c.strokeStyle=color;c.lineWidth=4;c.shadowBlur=20;c.beginPath();c.moveTo(140,100);c.lineTo(170,140);c.stroke();c.beginPath();c.moveTo(108,112);c.lineTo(132,140);c.stroke();}else if(name==='double'){c.fillStyle=color;c.font='900 98px "Arial Black",sans-serif';c.textAlign='center';c.fillText('\u00d72',128,165);c.strokeStyle=color;c.lineWidth=5;c.shadowBlur=20;c.beginPath();c.arc(128,128,105,0,Math.PI*2);c.stroke();}else if(name==='magnet'){c.fillRect(58,126,140,14);c.fillRect(58,140,26,44);c.fillRect(140,140,26,44);c.fillStyle='#ffb3d9';c.beginPath();c.arc(72,160,8,0,Math.PI*2);c.fill();c.beginPath();c.arc(156,160,8,0,Math.PI*2);c.fill();c.strokeStyle='#b0c0ff';c.lineWidth=2;c.shadowBlur=12;c.beginPath();c.bezierCurveTo(156,126,72,126,72,162);c.stroke();c.beginPath();c.bezierCurveTo(156,136,72,136,72,156);c.stroke();}c.restore();c.strokeStyle=color;c.lineWidth=8;c.shadowBlur=15;c.beginPath();c.arc(128,128,115,0,Math.PI*2);c.stroke();c.shadowBlur=0;for(let i=0;i<6;i++){const a=i/3*Math.PI+0.5;c.beginPath();c.arc(128+Math.cos(a)*88,128+Math.sin(a)*88,2.5,0,Math.PI*2);c.fillStyle=color;c.fill();}this.texture(name+'-ring',rc=>{rc.clearRect(0,0,256,256);rc.shadowColor=color;rc.shadowBlur=25;rc.strokeStyle=color;rc.lineWidth=12;rc.beginPath();rc.arc(128,128,92,0.4,Math.PI*2-0.4);rc.stroke();rc.shadowBlur=0;rc.fillStyle=color;for(let i=0;i<8;i++){const a=0.4+(Math.PI*2-0.8)*i/7;rc.beginPath();rc.arc(128+Math.cos(a)*92,128+Math.sin(a)*92,2.5,0,Math.PI*2);rc.fill();}})})});
  }
  flightTexture(){
    this.texture('flight',c=>{
      c.clearRect(0,0,256,256);c.shadowColor='#5ae4ff';c.shadowBlur=22;c.fillStyle='#107db4';c.beginPath();c.arc(128,128,78,0,Math.PI*2);c.fill();
      c.strokeStyle='#9cffff';c.lineWidth=7;c.stroke();c.shadowBlur=0;c.fillStyle='#e6ffff';
      for(const side of [-1,1]){c.save();c.translate(128,118);c.scale(side,1);c.beginPath();c.moveTo(18,-8);c.lineTo(111,-51);c.lineTo(86,-1);c.lineTo(35,29);c.closePath();c.fill();c.restore();}
      c.fillRect(116,84,24,70);c.fillRect(94,107,68,24);c.font='bold 27px sans-serif';c.textAlign='center';c.fillText('FLY',128,187);
    });
  }
  sphere(n=12){const o={positions:[],vertexNormals:[],textureCoordinates:[],indices:[]};for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const a=y/n*Math.PI,b=x/n*Math.PI*2,p=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];o.positions.push(...p);o.vertexNormals.push(...p);o.textureCoordinates.push(x/n,y/n);if(y<n&&x<n){const k=y*(n+1)+x;o.indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}}return o;}
  mesh(shape,x,y,z,sx,sy,sz,color,rotation=0){const ball=shape==='ball',o=ball?this.ball:this.cube;o.translation=[x,y,z];o.rotation=Array.isArray(rotation)?rotation:[0,0,rotation];o.scale=[sx,sy,sz];o.view=this.actorView||this.view;o.texture=this.textures[color]||this.color(color);drawScene(this.gl,this.info,ball?this.ballBuffer:this.cubeBuffer,0,o,this.projection);}
  box(x,y,z,sx,sy,sz,c,r=0){this.mesh('box',x,y,z,sx,sy,sz,c,r);}
  orb(x,y,z,sx,sy,sz,c){this.mesh('ball',x,y,z,sx,sy,sz,c);}
  player(g){this.playerRig.render(g);}
  render(g){
    const gl=this.gl,dpr=Math.min(devicePixelRatio||1,1.7),w=Math.round(this.canvas.clientWidth*dpr),h=Math.round(this.canvas.clientHeight*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.49,.78,.88,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    mat4.perspective(this.projection,(w/h<1?69:55)*Math.PI/180,w/h,.1,230);const cameraY=g.flightCameraY||0,warning=Math.sin(g.time*34)*(g.dangerPulse||0)*.018;mat4.lookAt(this.view,[g.x*.12+warning,5.8+cameraY,14],[g.x*.04,1+cameraY,-22],[0,1,0]);
    this.box(0,-.3,-70,35,.25,110,'gravel');
    // Distant skyline and tree canopies create several independently moving depth layers.
    for(let i=0;i<24;i++){const x=(i-11.5)*4.4,z=-100-((i*19-g.travel*.1)%35+35)%35,height=7+(i*7%13);this.box(x,height/2,z,1.8,height/2,2.2,['#88b5c6','#9aaece','#76a7ba','#c2c6c8'][i%4]);for(let yy=2;yy<height;yy+=2.2)for(let xx=-1;xx<=1;xx+=1)this.box(x+xx,yy,z+2.22,.18,.42,.03,'#c9e3df');}
    this.orb(25,31,-130,9,9,3,'#fff3c9');
    for(let i=0;i<9;i++){const z=-25-i*17;this.orb(-27+i*7,22+(i%3)*3,z,5,1.5,2,'#e3f3ed');}
    this.box(0,6,-88,27,.55,2,'#638b8e');this.box(-7,2.5,-88,.5,3,1,'#638b8e');this.box(7,2.5,-88,.5,3,1,'#638b8e');
    for(let i=0;i<48;i++){const z=12-i*3+(g.travel%3);for(let lane=-1;lane<=1;lane++){this.box(lane*3,.03,z,1.24,.11,.19,'#bc8955');}}
    for(let lane=-1;lane<=1;lane++)for(const side of [-1,1]){this.box(lane*3+side*.85,.17,-68,.075,.12,85,'#c2d7da');this.box(lane*3+side*.85,.08,-68,.14,.07,85,'#596369');}
    for(let i=0;i<19;i++){const z=16-i*8+(g.travel%8);for(const side of [-1,1]){this.box(side*6.05,1.35,z,.35,1.6,4,'brick');this.box(side*6.05,3.03,z,.46,.13,4,'#e5cbb0');this.box(side*5.3,.03,z,.4,.14,4,'#b5b594');for(let t=0;t<3;t++){this.orb(side*(6.5+t*.3),3.5+(t%2)*.65,z+t*1.4,.9,1,.95,['#4c9361','#72ad62','#92bd62'][t]);this.orb(side*5.5,.35,z+t*2,.43,.6,.58,'#69a34e');}}}
    for(let i=0;i<7;i++){const z=8-i*22+(g.travel%22);for(const side of [-1,1]){this.box(side*5.7,3.9,z,.06,3,.06,'#294452');this.box(side*5.15,6.85,z,.65,.07,.09,'#294452');this.orb(side*4.6,6.7,z,.35,.13,.24,'#fff0b8');this.box(side*5.63,4.8,z,.08,.63,.42,'#1686a4');this.box(side*5.65,1.75,z-5,.05,1.06,.74,'poster'+(i%3)+(side===1?'R':''));}}
    for(const o of g.items){const x=o.x??o.lane*3,z=o.z;if(z>12||z< -145)continue;
      if(o.type==='virus')this.virus(x,g.virusHeight(o),z,g.time+(o.phase||0),o,g.virusStyle(o));
      else if(o.type==='barrier'||o.type==='overhead'){const y=o.type==='overhead'?2.2:.75;this.box(x,y,z,1.12,.43,.21,'stripe');for(const s of [-1,1]){this.box(x+s*.9,y/2,z,.09,y/2,.12,'#344954');this.orb(x+s*.9,y+.52,z,.12,.12,.12,'#fa705a');}}
      else {
        if(['shield','boost','double','magnet'].includes(o.type)){
          const y=(o.y??1.05)+Math.sin(g.time*2+z*.3)*.08+Math.sin(g.time*.7)*.03;
          const ct=o.collected?Math.min(1,(o.collectTime||0)*5):0;
          const e=ct>0?1-Math.pow(1-ct,2):0;
          this.box(x,y,z,.58+e*.4,.64+e*.2,.035,o.type,[0,Math.sin(g.time*.7)*.15,g.time*.6]);
          if(o.collected){
            this.box(x,y,z+.025,.7+e*1.8,.7+e*1.8,.005,o.type+'-ring',[0,0,g.time*4]);
            const fc=o.type==='boost'?'#ffd966':o.type==='magnet'?'#ffb3d9':o.type==='double'?'#e0bbff':'#a0f0ff';
            for(let i=0;i<12;i++){const a=e*Math.PI*6+i*Math.PI/6,r=e*2.2;this.orb(x+Math.cos(a)*r,y+Math.sin(a)*r,z+.03,i%2===0?.05:.04,i%2===0?.05:.04,.01,i%2===0?'#ffffff':fc);}}
          else{
            const rs=.85+Math.sin(g.time*5)*.03;
            this.box(x,y,z+.025,rs,rs,.005,o.type+'-ring',[0,0,g.time*2.5]);
            const pc={shield:{n:4,c:'#63d9ff'},boost:{n:6,c:'#ffce65'},double:{n:5,c:'#c3a0ff'},magnet:{n:4,c:'#ff8eac'}};
            const p=pc[o.type];
            for(let i=0;i<p.n;i++){const a=g.time*1.3+i/p.n*Math.PI*2+z*.1,r=.72+Math.sin(g.time*2+i)*.04;this.orb(x+Math.cos(a)*r,y+Math.sin(a*.7)*.12,z,.03,.03,.01,p.c);}}
        }else{
        const y=(o.y??1.05)+Math.sin(g.time*3+z)*.14;this.box(x,y,z,o.type==='drop'?.46:.58,.64,.035,o.type);if(o.airDrop||o.type==='flight')for(let i=0;i<3;i++){const a=g.time*2+i*2.094;this.orb(x+Math.cos(a)*.62,y+Math.sin(a)*.72,z,.04,.04,.04,'#8feeff');}}
      }
    }
    this.player(g);
    const px=g.x,py=g.jumpY;
    if(g.powers.shield>0||g.powers.boost>0){for(let i=0;i<12;i++){const a=i/12*Math.PI*2+g.time*2;this.orb(px+Math.cos(a)*.76,py+1+Math.sin(a)*.95,4,.055,.055,.055,g.powers.boost?'#ffdf75':'#6ce8ff');}}
    if(g.flightMode){for(let i=0;i<8;i++){const a=i*Math.PI/4+g.time*2;this.orb(px+Math.cos(a)*.58,py+.12,4+Math.sin(a)*.36,.055,.055,.055,'#90efff');}}
    for(const p of g.particles){const size=p.life*(p.flight?.20:.07);this.orb(p.x,p.y,p.z,size,size,size,p.color);}
  }
  virus(x,y,z,t,o={},style={body:'#a833b5',light:'#c452c9',tip:'#e285d6'}){
    const distance=z,scale=o.scale||1;
    mat4.copy(this.virusView,this.view);mat4.translate(this.virusView,this.virusView,[x,y,z]);mat4.scale(this.virusView,this.virusView,[scale,scale,scale]);
    if(o.variant==='elite')mat4.rotateZ(this.virusView,this.virusView,Math.sin(t*2)*.075);
    this.actorView=this.virusView;x=y=z=0;
    const previousBall=this.ball,previousBuffer=this.ballBuffer;
    this.ball=distance< -45?previousBall:this.virusBall;this.ballBuffer=distance< -45?previousBuffer:this.virusBallBuffer;
    this.orb(x,y,z,.66,.66,.66,style.body);
    this.orb(x-.15,y+.22,z+.48,.4,.32,.2,style.light);
    const spikes=distance< -65?6:10;
    for(let i=0;i<spikes;i++){
      const a=i*Math.PI*2/spikes+Math.sin(t*.6)*.07,dx=Math.cos(a),dy=Math.sin(a);
      this.mesh('ball',x+dx*.73,y+dy*.73,z,.075,.24,.075,style.body,a-Math.PI/2);
      this.orb(x+dx*.93,y+dy*.93,z,.13,.12,.13,style.light);
      this.orb(x+dx*.94-.025,y+dy*.93+.035,z+.065,.055,.035,.05,style.tip);
    }
    if(o.variant&&o.variant!=='normal')for(let i=0;i<5;i++){
      const a=t*1.6+i*Math.PI*2/5;this.orb(Math.cos(a)*1.15,Math.sin(a)*1.15,0,.035,.035,.035,style.tip);
    }
    if(o.variant==='fast'||o.variant==='small')for(let i=0;i<3;i++)this.orb(0,0,-1-i*.5,.11-i*.025,.11-i*.025,.23,style.tip);
    if(o.variant==='flying')for(const side of [-1,1])this.mesh('ball',side*.91,.14,0,.42,.07,.16,style.tip,side*Math.sin(t*9)*.32);
    for(const side of [-1,1]){
      this.orb(x+side*.23,y+.1,z+.59,.19,.18,.075,'#fff3ed');
      this.orb(x+side*.21,y+.07,z+.66,.077,.10,.026,'#24203e');
      this.orb(x+side*.20-.02,y+.10,z+.684,.022,.027,.01,'#ffffff');
      this.box(x+side*.23,y+.26,z+.67,.22,.055,.035,'#51214c',side*.28);
    }
    this.orb(x,y-.28,z+.61,.3,.17,.075,'#3b164c');
    for(let i=0;i<4;i++)this.box(x-.18+i*.12,y-.20,z+.685,.043,.06,.015,'#fff4ea',Math.PI/4);
    this.orb(x,y-.38,z+.666,.13,.035,.025,'#e179b6');
    for(let i=0;i<5;i++){const a=i*2.4;this.orb(x+Math.cos(a)*.44,y+Math.sin(a)*.44,z+.43,.044,.055,.025,'#843399');}
    this.ball=previousBall;this.ballBuffer=previousBuffer;this.actorView=null;
  }
}
