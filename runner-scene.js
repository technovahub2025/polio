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
    const fs = `precision mediump float;varying vec2 uv;varying vec3 light;varying float depth;uniform sampler2D uSampler;uniform bool grayscale,flash;uniform vec3 environmentFog;uniform vec2 environmentFogRange;uniform float fogStrength;
      void main(){vec4 t=texture2D(uSampler,uv);if(t.a<.1)discard;vec3 c=t.rgb*light;if(grayscale)c=vec3(dot(c,vec3(.3,.59,.11)));if(flash)c+=.18;gl_FragColor=vec4(mix(c,environmentFog,smoothstep(environmentFogRange.x,environmentFogRange.y,depth)*fogStrength),t.a);}`;
    const program=initShaderProgram(gl,vs,fs);
    this.info={program,attribLocations:{},uniformLocations:{}};
    for(const [key,name] of Object.entries({vertexPosition:'aVertexPosition',vertexNormal:'aVertexNormal',textureCoord:'aTextureCoord'})) this.info.attribLocations[key]=gl.getAttribLocation(program,name);
    for(const [key,name] of Object.entries({projectionMatrix:'uProjectionMatrix',modelViewMatrix:'uModelViewMatrix',normalMatrix:'uNormalMatrix',uSampler:'uSampler',grayscale:'grayscale',flash:'flash',environmentFog:'environmentFog',environmentFogRange:'environmentFogRange',fogStrength:'fogStrength'})) this.info.uniformLocations[key]=gl.getUniformLocation(program,name);
    this.textures={};
    this.cube=createCube(0,0,0,[0,0,0],1,gl);this.cubeBuffer=initBuffers(gl,this.cube);
    this.ball=this.sphere();this.ballBuffer=initBuffers(gl,this.ball);
    this.dropShape=this.dropGeometry();this.dropBuffer=initBuffers(gl,this.dropShape);
    this.capCrownShape=this.capCrownGeometry();this.capCrownBuffer=initBuffers(gl,this.capCrownShape);
    this.capVisorShape=this.capVisorGeometry();this.capVisorBuffer=initBuffers(gl,this.capVisorShape);
    this.virusBall=this.sphere(20);this.virusBallBuffer=initBuffers(gl,this.virusBall);
    this.playerRig=new PolioWarrior(this);
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
    this.texture('brick',c=>{c.fillStyle='#f3ceaf';c.fillRect(0,0,256,256);for(let y=0;y<8;y++)for(let x=-1;x<4;x++){c.fillStyle=['#dc9674','#e5a17d','#efb28c','#e9a383'][(x+y+4)%4];c.fillRect(x*86+(y%2)*43,y*32,82,28);c.fillStyle='#ffdab0';c.fillRect(x*86+(y%2)*43,y*32,82,3);}});
    this.texture('gravel',c=>{c.fillStyle='#d4c5a6';c.fillRect(0,0,256,256);let seed=91;for(let i=0;i<1900;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%256;c.fillStyle=['#e8dabd','#baa98a','#f3e5c8'][i%3];c.fillRect(x,y,3+i%5,2+i%3);}});
    this.texture('stripe',c=>{c.fillStyle='#ffcf4a';c.fillRect(0,0,256,256);c.fillStyle='#233442';for(let x=-256;x<512;x+=90){c.beginPath();c.moveTo(x,0);c.lineTo(x+45,0);c.lineTo(x-60,256);c.lineTo(x-105,256);c.fill();}});
    ['END|POLIO|NOW','TWO DROPS.|A BRIGHTER|TOMORROW','POLIO|FREE|WORLD'].forEach((text,i)=>this.texture('poster'+i,c=>{c.fillStyle='#fff4df';c.fillRect(0,0,256,256);c.textAlign='center';c.font='900 42px sans-serif';text.split('|').forEach((line,j)=>{c.fillStyle=j===1?'#d64347':'#153a58';c.font=i===1?'900 25px sans-serif':'900 43px sans-serif';c.fillText(line,128,60+j*52);});c.fillStyle='#27bde4';c.beginPath();c.arc(128,220,15,0,Math.PI*2);c.fill();}));
    this.texture('drop',c=>{c.clearRect(0,0,256,256);c.shadowColor='#35eaff';c.shadowBlur=22;const g=c.createLinearGradient(0,20,0,230);g.addColorStop(0,'#ccffff');g.addColorStop(.4,'#21dfff');g.addColorStop(1,'#068dd7');c.fillStyle=g;c.beginPath();c.moveTo(128,17);c.bezierCurveTo(109,62,50,127,55,169);c.bezierCurveTo(58,250,198,250,201,169);c.bezierCurveTo(204,127,147,62,128,17);c.fill();c.strokeStyle='#c6ffff';c.lineWidth=5;c.stroke();c.shadowBlur=0;c.fillStyle='#f4ffff';c.beginPath();c.roundRect(93,133,70,73,12);c.fill();c.fillStyle='#106ea2';c.fillRect(103,120,50,18);c.font='bold 19px sans-serif';c.textAlign='center';c.fillText('POLIO',128,176);c.fillStyle='#ffffffb0';c.beginPath();c.ellipse(90,141,8,22,.4,0,7);c.fill();});
    this.texture('polio-drop',c=>{
      c.clearRect(0,0,256,256);
      const body=c.createLinearGradient(0,0,0,256);body.addColorStop(0,'#a5ffff');body.addColorStop(.24,'#39f2ff');body.addColorStop(.65,'#08c9ef');body.addColorStop(1,'#087ebd');c.fillStyle=body;c.fillRect(0,0,256,256);
      const edge=c.createLinearGradient(0,0,256,0);edge.addColorStop(0,'#27dfff');edge.addColorStop(.18,'#11aeda');edge.addColorStop(.25,'#83ffff');edge.addColorStop(.32,'#18cfe9');edge.addColorStop(.5,'#0795d1');edge.addColorStop(.68,'#18cfe9');edge.addColorStop(.75,'#83ffff');edge.addColorStop(.82,'#11aeda');edge.addColorStop(1,'#27dfff');c.globalCompositeOperation='screen';c.globalAlpha=.6;c.fillStyle=edge;c.fillRect(0,0,256,256);c.globalCompositeOperation='source-over';c.globalAlpha=1;
      for(const cx of [64,192]){const shine=c.createRadialGradient(cx,112,2,cx,112,34);shine.addColorStop(0,'#ffffffd9');shine.addColorStop(.28,'#d9ffffb0');shine.addColorStop(1,'#8fffff00');c.fillStyle=shine;c.fillRect(cx-36,72,72,80);}
      // The texture is mapped around the drop; place a bold cross on its forward face.
      c.shadowColor='#ffffff';c.shadowBlur=12;c.fillStyle='#f6ffff';for(const cx of [64,192]){c.fillRect(cx-6,133,12,44);c.fillRect(cx-22,149,44,12);}c.shadowBlur=0;
    });
    this.texture('drop-ring',c=>{
      c.clearRect(0,0,256,256);c.save();c.shadowColor='#36efff';c.shadowBlur=25;c.strokeStyle='#27dfffa8';c.lineWidth=24;c.beginPath();c.arc(128,128,88,0,Math.PI*2);c.stroke();c.shadowBlur=0;c.strokeStyle='#b7ffff';c.lineWidth=7;c.beginPath();c.arc(128,128,88,0,Math.PI*2);c.stroke();
      c.fillStyle='#e9ffff';for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.arc(128+Math.cos(a)*88,128+Math.sin(a)*88,4,0,Math.PI*2);c.fill();}c.restore();
    });
    for(let i=0;i<4;i++){
      const opacity=.72-i*.18;
      this.texture('collect-ring-'+i,c=>{c.clearRect(0,0,256,256);c.save();c.globalAlpha=opacity;c.shadowColor='#43efff';c.shadowBlur=27;c.strokeStyle='#49eaff';c.lineWidth=13;c.beginPath();c.arc(128,128,91,0,Math.PI*2);c.stroke();c.shadowBlur=0;c.fillStyle='#efffff';for(let n=0;n<6;n++){const a=n*Math.PI/3;c.beginPath();c.arc(128+Math.cos(a)*91,128+Math.sin(a)*91,5,0,Math.PI*2);c.fill();}c.restore();});
      this.texture('drop-label-'+i,c=>{c.clearRect(0,0,256,256);c.save();c.globalAlpha=1-i*.24;c.textAlign='center';c.font='900 61px Arial,sans-serif';c.lineJoin='round';c.lineWidth=12;c.strokeStyle='#078aaa';c.shadowColor='#2de7ff';c.shadowBlur=17;c.strokeText('+1 DROP',128,151);c.shadowBlur=0;c.fillStyle='#f3ffff';c.fillText('+1 DROP',128,151);c.restore();});
    }
    for(let i=0;i<4;i++)this.texture('foot-ripple-'+i,c=>{
      c.clearRect(0,0,256,256);c.save();c.globalAlpha=1-i*.24;c.shadowColor='#34e8ff';c.shadowBlur=13;
      c.strokeStyle='#32dff4';c.lineWidth=8;c.beginPath();c.ellipse(128,128,83,72,0,0,Math.PI*2);c.stroke();
      c.shadowBlur=0;c.strokeStyle='#e7ffff';c.lineWidth=3;c.beginPath();c.ellipse(128,128,83,72,0,.1,Math.PI*1.85);c.stroke();
      c.strokeStyle='#70efff';c.lineWidth=5;c.beginPath();c.ellipse(128,128,49,41,0,Math.PI*.15,Math.PI*1.2);c.stroke();c.restore();
    });
    [['boost','#ffce65'],['double','#c3a0ff'],['magnet','#ff8eac']].forEach(([name,color])=>{this.texture(name,c=>{c.fillStyle='#173e51';c.fillRect(0,0,256,256);const bg=c.createRadialGradient(128,128,0,128,128,120);bg.addColorStop(0,'#2a4a6a');bg.addColorStop(1,'#0a1a2a');c.fillStyle=bg;c.beginPath();c.arc(128,128,118,0,Math.PI*2);c.fill();c.save();c.shadowColor=color;c.shadowBlur=30;if(name==='boost'){c.fillStyle=color;c.beginPath();c.moveTo(118,50);c.lineTo(178,135);c.lineTo(138,135);c.lineTo(175,205);c.lineTo(98,205);c.lineTo(132,135);c.lineTo(98,135);c.closePath();c.fill();c.strokeStyle=color;c.lineWidth=4;c.shadowBlur=20;c.beginPath();c.moveTo(140,100);c.lineTo(170,140);c.stroke();c.beginPath();c.moveTo(108,112);c.lineTo(132,140);c.stroke();}else if(name==='double'){c.fillStyle=color;c.font='900 98px "Arial Black",sans-serif';c.textAlign='center';c.fillText('\u00d72',128,165);c.strokeStyle=color;c.lineWidth=5;c.shadowBlur=20;c.beginPath();c.arc(128,128,105,0,Math.PI*2);c.stroke();}else if(name==='magnet'){c.fillRect(58,126,140,14);c.fillRect(58,140,26,44);c.fillRect(140,140,26,44);c.fillStyle='#ffb3d9';c.beginPath();c.arc(72,160,8,0,Math.PI*2);c.fill();c.beginPath();c.arc(156,160,8,0,Math.PI*2);c.fill();c.strokeStyle='#b0c0ff';c.lineWidth=2;c.shadowBlur=12;c.beginPath();c.bezierCurveTo(156,126,72,126,72,162);c.stroke();c.beginPath();c.bezierCurveTo(156,136,72,136,72,156);c.stroke();}c.restore();c.strokeStyle=color;c.lineWidth=8;c.shadowBlur=15;c.beginPath();c.arc(128,128,115,0,Math.PI*2);c.stroke();c.shadowBlur=0;for(let i=0;i<6;i++){const a=i/3*Math.PI+0.5;c.beginPath();c.arc(128+Math.cos(a)*88,128+Math.sin(a)*88,2.5,0,Math.PI*2);c.fillStyle=color;c.fill();}this.texture(name+'-ring',rc=>{rc.clearRect(0,0,256,256);rc.shadowColor=color;rc.shadowBlur=25;rc.strokeStyle=color;rc.lineWidth=12;rc.beginPath();rc.arc(128,128,92,0.4,Math.PI*2-0.4);rc.stroke();rc.shadowBlur=0;rc.fillStyle=color;for(let i=0;i<8;i++){const a=0.4+(Math.PI*2-0.8)*i/7;rc.beginPath();rc.arc(128+Math.cos(a)*92,128+Math.sin(a)*92,2.5,0,Math.PI*2);rc.fill();}})})});
  }
  vaccine(x,y,z,time){
    const previous=this.actorView,view=mat4.clone(previous||this.view);
    mat4.translate(view,view,[x,y+Math.sin(time*2.5+z)*.10,z]);
    mat4.rotateY(view,view,Math.sin(time*1.4)*.35);
    const pulse=1+Math.sin(time*3)*.05;mat4.scale(view,view,[pulse,pulse,pulse]);
    this.actorView=view;
    try{
      // A rounded cyan drop with a tapered tip and a bright medical cross.
      this.orb(0,-.10,0,.34,.36,.22,'#16cbd4');
      this.orb(0,.14,0,.24,.29,.17,'#62f5ed');
      this.box(0,.34,0,.14,.14,.10,'#62f5ed',Math.PI/4);
      this.box(0,-.07,.235,.055,.19,.025,'#f0ffff');
      this.box(0,-.07,.235,.18,.055,.025,'#f0ffff');
      for(let i=0;i<6;i++){
        const a=time*1.5+i*Math.PI/3;
        this.orb(Math.cos(a)*.56,Math.sin(a)*.61,0,.035,.035,.035,'#a6fffa');
      }
    }finally{this.actorView=previous;}
  }
  polioDrop(x,y,z,time,collectScale=1,showGroundRing=true){
    const previous=this.actorView,view=mat4.clone(previous||this.view),distanceScale=1+Math.min(.42,Math.max(0,-z-20)/125*.42),pulse=1+Math.sin(time*3.2+z*.07)*.035;
    // The lane marker stays on the railway, while only the decorative drop bobs.
    const ringPulse=1+Math.sin(time*3.2+z*.07)*.045;
    if(showGroundRing)this.box(x,.075,z,.76*distanceScale*ringPulse,.008,.58*distanceScale*ringPulse,'drop-ring',[0,time*.12,0],null,.24);
    mat4.translate(view,view,[x,y,z]);mat4.rotateY(view,view,time*.24+z*.008);mat4.scale(view,view,[distanceScale*pulse*collectScale,distanceScale*1.16*pulse*collectScale,distanceScale*pulse*collectScale]);this.actorView=view;
    try{
      this.mesh('drop',0,0,0,1.18,1.28,.9,'polio-drop',0,null,.24);
      // The textured cross and highlight face outward; a ground ring also marks
      // the lane for the existing high flight-path drops.
    }finally{
      this.actorView=previous;
      this.gl.uniform1f(this.info.uniformLocations.fogStrength,1);
    }
  }
  dropGeometry(){
    const profile=[[-.50,.015],[-.47,.15],[-.39,.28],[-.26,.39],[-.10,.45],[.02,.44],[.14,.36],[.26,.26],[.38,.15],[.48,.045],[.50,.012]],segments=12;
    const mesh={positions:[],vertexNormals:[],textureCoordinates:[],indices:[]};
    for(let j=0;j<profile.length;j++){
      const [y,r]=profile[j],before=profile[Math.max(0,j-1)],after=profile[Math.min(profile.length-1,j+1)],slope=(after[1]-before[1])/(after[0]-before[0]||1),ny=-slope,norm=Math.hypot(1,ny);
      for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,x=Math.cos(a),z=Math.sin(a);mesh.positions.push(x*r,y,z*r);mesh.vertexNormals.push(x/norm,ny/norm,z/norm);mesh.textureCoordinates.push(i/segments,(y+.5));
        if(j<profile.length-1&&i<segments){const k=j*(segments+1)+i;mesh.indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
      }
    }
    return mesh;
  }
  protector(x,y,z,time){
    // Layered existing box primitives form a pointed, beveled shield.
    const previous=this.actorView,view=mat4.clone(previous||this.view);
    mat4.translate(view,view,[x,y,z]);mat4.rotateY(view,view,Math.sin(time*1.6)*.32);
    mat4.rotateZ(view,view,Math.sin(time*.9)*.07);this.actorView=view;
    try{
      for(const [scale,depth,color] of [[1,0,'#ffd766'],[.82,.065,'#d92338']]){
        this.box(0,.18*scale,depth,.62*scale,.43*scale,.075,color);
        this.box(0,-.22*scale,depth,.44*scale,.44*scale,.075,color,Math.PI/4);
      }
      this.box(0,.20,.15,.055,.25,.025,'#ffd766');
      this.box(0,.20,.15,.23,.055,.025,'#ffd766');
    }finally{this.actorView=previous;}
  }
  flightTexture(){
    this.texture('flight',c=>{
      c.clearRect(0,0,256,256);c.shadowColor='#5ae4ff';c.shadowBlur=22;c.fillStyle='#107db4';c.beginPath();c.arc(128,128,78,0,Math.PI*2);c.fill();
      c.strokeStyle='#9cffff';c.lineWidth=7;c.stroke();c.shadowBlur=0;c.fillStyle='#e6ffff';
      for(const side of [-1,1]){c.save();c.translate(128,118);c.scale(side,1);c.beginPath();c.moveTo(18,-8);c.lineTo(111,-51);c.lineTo(86,-1);c.lineTo(35,29);c.closePath();c.fill();c.restore();}
      c.fillRect(116,84,24,70);c.fillRect(94,107,68,24);c.font='bold 27px sans-serif';c.textAlign='center';c.fillText('FLY',128,187);
    });
  }
  capeBranding(){
    // One canvas atlas, shared by all twenty unchanged cloth sections.
    this.texture('cape-branding',c=>{
      c.fillStyle='#e21f32';c.fillRect(0,0,256,256);
      for(let i=0;i<20;i++)if(i%5===0){c.fillStyle='#d7192d';c.fillRect(0,i*256/20,256,256/20);}
      c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff0b0';
      c.font='900 37px Arial, sans-serif';c.fillText('POLIO',128,65,202);
      c.font='900 32px Arial, sans-serif';c.fillText('WARRIOR',128,105,210);
      // A small gold gear with six spokes, drawn into the cloth texture.
      c.save();c.translate(128,163);c.fillStyle='#ffd766';
      for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);c.fillRect(-4,-29,8,11);c.restore();}
      c.strokeStyle='#ffd766';c.lineWidth=6;c.beginPath();c.arc(0,0,21,0,Math.PI*2);c.stroke();
      c.lineWidth=3;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(Math.cos(a)*6,Math.sin(a)*6);c.lineTo(Math.cos(a)*18,Math.sin(a)*18);c.stroke();}
      c.beginPath();c.arc(0,0,6,0,Math.PI*2);c.stroke();c.restore();
    });
    this.capeBuffers=Array.from({length:20},(_,i)=>initBuffers(this.gl,{
      ...this.cube,textureCoordinates:this.capeUV(i)
    }));
  }
  capeUV(section){
    const t=(section+.5)/20;
    // Every non-rear face samples plain red at the atlas margin. Only local
    // -Z carries print. Root rotation maps local +X to camera-left, hence U
    // decreases with local X. Uploaded canvas is already vertically flipped.
    const uv=Array.from({length:24},()=>[.005,1-t]).flat();
    uv.splice(8,8,1,1-t-.65/20,0,1-t-.65/20,0,1-t+.65/20,1,1-t+.65/20);
    return uv;
  }
  sphere(n=12){const o={positions:[],vertexNormals:[],textureCoordinates:[],indices:[]};for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const a=y/n*Math.PI,b=x/n*Math.PI*2,p=[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];o.positions.push(...p);o.vertexNormals.push(...p);o.textureCoordinates.push(x/n,y/n);if(y<n&&x<n){const k=y*(n+1)+x;o.indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}}return o;}
  capCrownGeometry(){
    const o={positions:[],vertexNormals:[],textureCoordinates:[],indices:[]},around=24,steps=9;
    for(let j=0;j<=steps;j++)for(let i=0;i<=around;i++){
      const theta=i/around*Math.PI*2;
      // The shell rises into a rounded U-shaped opening at the rear.
      const edge=1.98-.48*Math.exp(-Math.pow(Math.min(theta,Math.PI*2-theta)/.54,2));
      const phi=j/steps*edge,sn=Math.sin(phi),x=sn*Math.sin(theta),y=Math.cos(phi),z=-sn*Math.cos(theta);
      o.positions.push(x,y,z);const n=[x/1.05,y/0.86,z/1.02],d=Math.hypot(...n);o.vertexNormals.push(n[0]/d,n[1]/d,n[2]/d);
      o.textureCoordinates.push(i/around,j/steps);
      if(j<steps&&i<around){const k=j*(around+1)+i;o.indices.push(k,k+around+1,k+1,k+1,k+around+1,k+around+2);}
    }
    return o;
  }
  capVisorGeometry(){
    const o={positions:[],vertexNormals:[],textureCoordinates:[],indices:[]},around=24,rings=4;
    for(let side=0;side<2;side++)for(let j=0;j<=rings;j++)for(let i=0;i<=around;i++){
      const r=j/rings,a=i/around*Math.PI*2,x=r*Math.cos(a),z=.66*r*Math.sin(a),bulge=.045*(1-r*r);
      o.positions.push(x,side===0?bulge:-.018-bulge,z);o.vertexNormals.push(0,side===0?1:-1,0);o.textureCoordinates.push(.5+x/2,.5+z/.8);
      if(j<rings&&i<around){
        const k=side*(rings+1)*(around+1)+j*(around+1)+i;
        if(side===0)o.indices.push(k,k+1,k+around+1,k+1,k+around+2,k+around+1);
        else o.indices.push(k,k+around+1,k+1,k+1,k+around+1,k+around+2);
      }
    }
    return o;
  }
  mesh(shape,x,y,z,sx,sy,sz,color,rotation=0,capeSection=null,fogStrength=undefined){const ball=shape==='ball',drop=shape==='drop',crown=shape==='cap-crown',visor=shape==='cap-visor',o=ball?this.ball:drop?this.dropShape:crown?this.capCrownShape:visor?this.capVisorShape:this.cube;o.translation=[x,y,z];o.rotation=Array.isArray(rotation)?rotation:[0,0,rotation];o.scale=[sx,sy,sz];o.view=this.actorView||this.view;o.fogStrength=fogStrength;if(capeSection!==null&&!this.capeBuffers)this.capeBranding();o.texture=capeSection!==null?this.textures['cape-branding']:this.textures[color]||this.color(color);const buffer=capeSection!==null?this.capeBuffers[capeSection]:ball?this.ballBuffer:drop?this.dropBuffer:crown?this.capCrownBuffer:visor?this.capVisorBuffer:this.cubeBuffer;drawScene(this.gl,this.info,buffer,0,o,this.projection);}
  box(x,y,z,sx,sy,sz,c,r=0,capeSection=null,fogStrength=undefined){this.mesh('box',x,y,z,sx,sy,sz,c,r,capeSection,fogStrength);}
  orb(x,y,z,sx,sy,sz,c){this.mesh('ball',x,y,z,sx,sy,sz,c);}
  capCrown(x,y,z,sx,sy,sz,c){this.mesh('cap-crown',x,y,z,sx,sy,sz,c);}
  capVisor(x,y,z,sx,sy,sz,c){this.mesh('cap-visor',x,y,z,sx,sy,sz,c);}
  player(g){this.playerRig.render(g);}
  renderEnvironment(g){
    const env=g.environment;
    this.box(0,-.3,-70,35,.25,110,'gravel');
    for(let i=0;i<48;i++){const z=12-i*3+(g.travel%3);for(let lane=-1;lane<=1;lane++){this.box(lane*3,.03,z,1.24,.11,.19,'#d3aa76');}}
    for(let lane=-1;lane<=1;lane++)for(const side of [-1,1]){this.box(lane*3+side*.85,.17,-68,.075,.12,85,'#e4f1f4');this.box(lane*3+side*.85,.08,-68,.14,.07,85,'#8a9ca6');}
    for(const w of env.visibleWorlds){
      if(w.id==='BRIGHT_CITY'&&w.endZ<14)this.renderCity(g,w.endZ,w.cycle===0?Infinity:w.startZ);
      else if(w.id==='TUNNEL')this.renderTunnel(g,{tunnelStart:w.start,tunnelEnd:w.end,portalZ:w.startZ,exitZ:w.endZ});
      else if(w.id==='GREEN_DISTRICT')this.renderGreenDistrict(g,{greenStart:w.start,greenEnd:w.end,exitZ:w.startZ});
      else if(w.id==='VILLAGE_VACCINATION_MISSION')this.renderVillage(g,w);
      else if(w.id==='JUNGLE_IMMUNITY_TRAIL')this.renderJungle(g,w);
    }
  }
  renderCity(g,portalZ,startZ=Infinity){
    // Distant skyline and tree canopies create several independently moving depth layers.
    for(let i=0;i<24;i++){const x=(i-11.5)*4.4,z=-100-((i*19-g.travel*.1)%35+35)%35,height=7+(i*7%13);if(z+2.2>startZ)continue;this.box(x,height/2,z,1.8,height/2,2.2,['#9cd7e8','#c0c8ee','#91d6c9','#f0d3ad'][i%4]);for(let yy=2;yy<height;yy+=2.2)for(let xx=-1;xx<=1;xx+=1)this.box(x+xx,yy,z+2.22,.18,.42,.03,'#edfbff');}
    this.orb(25,31,-130,9,9,3,'#fff3c9');
    for(let i=0;i<9;i++){const z=-25-i*17;this.orb(-27+i*7,22+(i%3)*3,z,5,1.5,2,'#f8fdff');}
    if(-86<=startZ){this.box(0,6,-88,27,.55,2,'#adcdd0');this.box(-7,2.5,-88,.5,3,1,'#adcdd0');this.box(7,2.5,-88,.5,3,1,'#adcdd0');}
    for(let i=0;i<19;i++){const z=16-i*8+(g.travel%8);if(z-4<=portalZ||z+6>startZ)continue;for(const side of [-1,1]){this.box(side*6.05,1.35,z,.35,1.6,4,'brick');this.box(side*6.05,3.03,z,.46,.13,4,'#e5cbb0');this.box(side*5.3,.03,z,.4,.14,4,'#e0d2b3');for(let t=0;t<3;t++){this.orb(side*(6.5+t*.3),3.5+(t%2)*.65,z+t*1.4,.9,1,.95,['#55aa64','#86c969','#b0d982'][t]);this.orb(side*5.5,.35,z+t*2,.43,.6,.58,'#80bd65');}}}
    for(let i=0;i<7;i++){const z=8-i*22+(g.travel%22);if(z-6<=portalZ||z+1>startZ)continue;for(const side of [-1,1]){this.box(side*5.7,3.9,z,.06,3,.06,'#638597');this.box(side*5.15,6.85,z,.65,.07,.09,'#638597');this.orb(side*4.6,6.7,z,.35,.13,.24,'#fff0b8');this.box(side*5.63,4.8,z,.08,.63,.42,'#1686a4');this.box(side*5.65,1.75,z-5,.05,1.06,.74,'poster'+(i%3)+(side===1?'R':''));}}
  }
  renderTunnel(g,env){
    const ceiling=14,spacing=12;
    // Absolute section indices preserve movement at the boundary and keep
    // draw count constant even after hours of running.
    const first=Math.max(0,Math.floor((g.distance-env.tunnelStart-20)/spacing));
    for(let i=first;i<first+16;i++){
      const length=Math.min(spacing,env.tunnelEnd-env.tunnelStart-i*spacing);
      if(length<=0)break;
      const z=env.portalZ-i*spacing-length/2,ratio=length/spacing;
      if(z>26||z< -160)continue;
      this.box(0,ceiling+.3,z,6.8,.3,length/2,'#233d56');
      for(const side of [-1,1]){
        this.box(side*6.5,ceiling/2,z,.35,ceiling/2,length/2,'#29475f');
        this.box(side*6.08,6.7,z+5.6*ratio,.18,6.7,.22,'#52778b');
        this.box(side*6.08,2.8,z,.08,.16,Math.min(4.2,length/2-.1),'#78deee');
        this.box(side*6.05,.65,z+4.6*ratio,.10,.55,.5,'stripe');
        this.orb(side*5.9,4,z+4*ratio,.10,.22,.18,'#ffe5a0');
        if(i%3===0)this.box(side*6.04,4.7,z,.035,1,.7,'poster'+(i%3)+(side===1?'R':''));
      }
      this.box(0,ceiling-.25,z+5.6*ratio,6.2,.22,.22,'#52778b');
      this.box(0,ceiling-.38,z,2,.06,.55,'#fff0be');
      this.box(-4,ceiling-.35,z,.1,.07,Math.min(3,length/2-.1),'#75d9e9');
      this.box(4,ceiling-.35,z,.1,.07,Math.min(3,length/2-.1),'#75d9e9');
    }
    if(env.portalZ<=26)this.renderTunnelPortal(env.portalZ);
    if(env.exitZ>=-145&&env.exitZ<=26)this.renderTunnelPortal(env.exitZ);
  }
  renderTunnelPortal(z){
      for(const side of [-1,1]){
        this.box(side*7.8,7.5,z,1.5,7.5,1,'#7496aa');
        this.box(side*6.15,7,z,.20,7,.65,'stripe');
        this.orb(side*6.2,12.8,z+1.05,.18,.18,.1,'#ff786c');
      }
      this.box(0,15,z,9.3,1,1,'#7496aa');
      this.box(0,14.1,z+.8,6.2,.12,.12,'#ffe8a2');
  }
  renderGreenDistrict(g,env){
    // Absolute 16m parcels keep variation fixed in the world, not the camera.
    const spacing=16,first=Math.max(0,Math.floor((g.distance-env.greenStart-24)/spacing));
    this.orb(24,33,-135,8,8,3,'#fff8d5');
    for(let i=0;i<6;i++)this.orb(-23+i*9,25+(i%3)*2,-95-i*8,5,1.2,2,'#ffffff');
    for(let i=first;i<first+12;i++){
      const length=Math.min(spacing,env.greenEnd-env.greenStart-i*spacing);
      if(length<=0)break;
      const z=env.exitZ-i*spacing-length/2;
      if(z>32||z< -160)continue;
      const variant=i%5;
      // New pale ballast joins the existing floor at the exact exit plane.
      this.box(0,-.035,z,4.5,.01,length/2,'#e7dcc1');
      for(const side of [-1,1]){
        this.box(side*12,-.06,z,7.5,.05,length/2,'#92c976');
        this.box(side*5.3,.015,z,.65,.025,length/2,'#eee6ce');
        if(length<spacing)continue;
        const x=side*(8+(i%3)*.7);
        this.box(x,2,z,.19,2,.19,'#9c8157');
        this.orb(x,5,z,1.8,2,1.7,['#459b68','#79be62','#a0d375'][i%3]);
        this.orb(x+side*.9,4.6,z+.5,1.2,1.5,1.2,'#66b77d');
        this.orb(side*6.6,.55,z-3,.8,.55,1.2,'#71b86c');
        if(variant===0||variant===4){
          for(let j=0;j<4;j++){
            const fx=side*(6.5+j*.28),fz=z+1+j*.7;
            this.box(fx,.3,fz,.035,.3,.035,'#4d925b');
            this.orb(fx,.64,fz,.15,.12,.15,['#ffe18b','#c8a4e6','#f4b6ce','#faf7dc'][j]);
          }
        }
        if(variant===1){
          this.box(side*7,1.5,z+3,.08,1.5,.08,'#718c81');
          this.box(side*7,3,z+3,1.15,.85,.06,'poster0');
          this.orb(side*7,4.05,z+3,.15,.21,.1,'#35cee0');
        }
        if(variant===2){
          this.box(side*6.3,1,z,.055,.07,5,'#f1ebd3');
          for(let j=0;j<4;j++)this.box(side*6.3,.6,z-4+j*2.5,.08,.6,.08,'#e5dfc4');
        }
        if(variant===3){
          const bx=side*13;
          this.box(bx,1.7,z,2.6,1.7,2.4,'#e9f3df');
          this.box(bx,3.5,z,2.9,.18,2.7,'#59a99b');
          this.box(bx,1.2,z+2.43,.6,1.2,.04,'#77c8d1');
          this.box(bx,2.85,z+2.47,.10,.35,.03,'#268b86');
          this.box(bx,2.85,z+2.47,.35,.10,.03,'#268b86');
          this.box(bx-side*1.6,2,z+2.48,.65,.65,.03,'poster1');
        }
        if(variant===4){
          this.box(side*6.4,2.5,z+3,.07,2.5,.07,'#739c98');
          this.orb(side*6.4,5,z+3,.3,.18,.3,'#fff2bc');
          this.box(side*6.65,4,z+3,.25,.5,.03,'#8cdde0');
        }
      }
    }
  }
  renderVillage(g,w){
    if(g.environment.id==='VILLAGE_VACCINATION_MISSION'){
      this.orb(24,33,-135,8,8,3,'#fff8d5');
      for(let i=0;i<6;i++)this.orb(-23+i*9,25+(i%3)*2,-95-i*8,5,1.2,2,'#ffffff');
    }
    const spacing=20,first=Math.max(0,Math.floor((g.distance-w.start-32)/spacing));
    for(let i=first;i<first+11;i++){
      if(w.start+i*spacing>=w.end)break;
      const z=w.startZ-i*spacing-spacing/2;if(z>32||z< -160)continue;
      this.box(0,-.035,z,4.5,.01,10,'#e8ddbe');
      for(const side of [-1,1]){
        const edge=w.end-(w.start+i*spacing);
        const variant=edge<=60?1:(i+(side===1?2:0))%5,x=side*11;
        this.box(side*14,-.06,z,9.5,.05,10,'#a8cd74');
        this.box(side*5.3,.015,z,.65,.025,10,'#f3e5be');
        // Homes, farms, camp, community shade, and open countryside.
        if(variant===0||variant===3||variant===4){
          const hx=variant===4?side*19:x;
          this.box(hx,1.5,z,2,1.5,2,['#ffe3a4','#bce4dd','#dacff1'][i%3]);
          for(const roofSide of [-1,1])this.box(hx+roofSide*1.1,3.35,z,1.35,.12,2.3,'#cd9569',[0,0,-roofSide*.38]);
          this.box(hx,1,z+2.03,.45,1,.03,'#82aeb1');
          for(const sign of [-1,1])this.box(hx+sign*1.2,1.8,z+2.04,.35,.4,.03,'#e6f9ef');
        }
        if(variant===1||variant===4){
          for(let j=0;j<4;j++)this.box(side*(8+j*1.8),.06,z, .55,.06,7,['#86b85c','#c7d78a'][j%2]);
          this.box(side*8,2.8,z+4,.18,2.8,.18,'#b29468');
          for(let j=0;j<5;j++){
            const angle=j*Math.PI*2/5;
            this.orb(side*8+Math.cos(angle)*1.25,5.8,z+4+Math.sin(angle)*1.25,1.4,.22,.75,'#58a96b');
          }
        }else{
          this.box(side*7.7,1.9,z-4,.23,1.9,.23,'#9c875d');
          this.orb(side*7.7,4.5,z-4,1.8,1.9,1.7,'#70b778');
        }
        if(variant===2){
          for(const dx of [-2,2])for(const dz of [-1.8,1.8])this.box(x+dx,1.6,z+dz,.065,1.6,.065,'#e6efdc');
          this.box(x,3.3,z,2.5,.18,2.25,'#71cdc5');
          this.box(x,1.1,z+1,1.6,.10,.65,'#fff0cc');
          for(const dx of [-1.3,1.3])this.box(x+dx,.55,z+1,.065,.55,.065,'#9aaf9b');
          this.box(x,2.65,z+2.29,1.2,.5,.035,'poster0');
          this.box(x,3.7,z+2.29,.08,.25,.035,'#fff6bf');
          this.box(x,3.7,z+2.29,.25,.08,.035,'#fff6bf');
          for(const dx of [-2.6,2.6]){
            this.box(x+dx,2.4,z,.04,2.4,.04,'#e8e5bd');
            this.box(x+dx+.3,4.3,z,.3,.3,.025,'#ffe09a');
          }
          this.box(x,1.35,z+1,.22,.32,.025,'drop');
        }
        if(variant===3){
          this.box(side*6.8,2,z+4,.06,2,.06,'#91a897');
          this.box(side*6.8,3,z+4,1,.7,.04,'poster1');
        }
        if(variant!==2){
          this.box(side*6.5,.9,z,.06,.07,6,'#f6e3b7');
          for(let j=0;j<4;j++)this.box(side*6.5,.55,z-5+j*3,.06,.55,.06,'#e0cca3');
          for(let j=0;j<3;j++)this.orb(side*(7+j*.3),.35,z+3+j,.16,.22,.16,['#ffe99a','#e2b6e9','#faf8de'][j]);
        }
      }
    }
  }
  renderJungle(g,w){
    // Fixed, absolute parcels: near plants, mid trees, far canopy. All scenery
    // is cosmetic and stays outside x=+-4.5, except arches above 15m.
    const spacing=20,first=Math.max(0,Math.floor((g.distance-w.start-32)/spacing));
    if(g.environment.id==='JUNGLE_IMMUNITY_TRAIL'){
      this.orb(24,33,-135,8,8,3,'#fff8d5');
      for(let i=0;i<5;i++)this.orb(-22+i*10,27,-100-i*9,4,1,2,'#f5fcff');
    }
    for(let i=first;i<first+11;i++){
      if(w.start+i*spacing>=w.end)break;
      const z=w.startZ-i*spacing-spacing/2;if(z>32||z< -160)continue;
      const edge=w.end-(w.start+i*spacing),variant=edge<=60?3:i%5;
      this.box(0,-.035,z,4.5,.01,10,'#d5b583');
      for(const side of [-1,1]){
        this.box(side*14,-.06,z,9.5,.05,10,variant===3?'#a4cc76':'#79b66a');
        const x=side*(9+(i%3)*.6),height=variant===1?7:11+(i%3);
        if(variant!==3){
          this.box(x,height/2,z,.55+(i%3)*.12,height/2,.6,'#9a7855');
          this.orb(x,height+1,z,3.2,2.5,3,['#459668','#65af65','#90c878'][i%3]);
          this.orb(x+side*1.2,height-.4,z+1,2.2,1.8,2,'#71b77a');
          this.box(x+side*1.2,height-2,z,1.5,.22,.25,'#a3895f',[0,0,side*.2]);
          if(variant===0||variant===2||variant===4){
            for(let j=0;j<3;j++){
              const vx=x+side*(1+j*.45),top=height-1;
              this.box(vx,top-2-j*.3,z+1+j*.4,.045,2+j*.3,.045,'#57934f');
              this.orb(vx,top-3.4-j*.4,z+1+j*.4,.22,.11,.14,'#9acb72');
            }
          }
        }
        // Distant silhouettes never overhang the lanes.
        this.box(side*23,5,z-2,.65,5,.7,'#91b994');
        this.orb(side*23,11,z-2,4,3,4,'#87bd94');
        this.orb(side*6.5,.65,z+2,.85,.65,1.1,'#68a65e');
        for(let j=0;j<(variant===3?2:4);j++){
          const px=side*(6.4+j*.45),pz=z-3+j;
          this.orb(px,.45,pz,.22,.65,.2,['#80c177','#a9d27a','#539d70','#badc8b'][j]);
          this.box(px+side*.2,.65,pz,.45,.035,.14,'#8dc875',[0,0,side*.45]);
        }
        if(variant===1||variant===2){
          this.orb(side*7.5,.55,z+4,1,.6,.8,'#9fae9c');
          this.orb(side*7.3,.94,z+4,.65,.16,.55,'#719b68');
          for(let j=0;j<2;j++){
            const mx=side*(6.2+j*.55),mz=z+5+j;
            this.box(mx,.32,mz,.07,.3,.07,'#fff0d0');
            this.orb(mx,.66,mz,.29,.15,.29,'#e6a267');
          }
        }
        if(variant===3)for(let j=0;j<3;j++)this.orb(side*(6.4+j*.4),.42,z+j,.15,.15,.15,['#ffdf8e','#e7c5dd','#f7f6ce'][j]);
        if(variant===4){
          // Both framing branches remain above the maximum flight camera.
          this.box(side*3.4,16,z,3.5,.3,.35,'#a3895f',[0,0,side*.06]);
          this.orb(side*4.5,17,z,3,1,1.6,'#83bc76');
        }
        if(i%7===2&&side===1){
          this.box(7,1.2,z-5,.07,1.2,.07,'#af9867');
          this.box(7,2.3,z-5,.45,.55,.025,'drop');
        }
      }
    }
  }
  render(g){
    const blend=g.environment.transition;
    const mix=(a,b,t=blend)=>a.map((v,i)=>v+(b[i]-v)*t);
    let sky=mix(mix([.49,.863,1],[.10,.20,.30]),[.45,.84,1],g.environment.exitSky);
    let fog=mix(mix([.788,.949,1],[.17,.29,.39]),[.86,.97,.94],g.environment.exitTransition);
    sky=mix(mix(mix(sky,[.48,.85,1],g.environment.villageTransition),[.48,.86,.97],g.environment.jungleTransition),[.49,.863,1],g.environment.cityReturn);
    fog=mix(mix(mix(fog,[.91,.97,.84],g.environment.villageTransition),[.81,.94,.81],g.environment.jungleTransition),[.788,.949,1],g.environment.cityReturn);
    const fogBlend=blend*(1-g.environment.exitTransition);
    const gl=this.gl,dpr=Math.min(devicePixelRatio||1,1.7),w=Math.round(this.canvas.clientWidth*dpr),h=Math.round(this.canvas.clientHeight*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(...sky,1);gl.useProgram(this.info.program);gl.uniform1f(this.info.uniformLocations.fogStrength,1);gl.uniform3fv(this.info.uniformLocations.environmentFog,fog);gl.uniform2f(this.info.uniformLocations.environmentFogRange,45+fogBlend*30,150+fogBlend*35);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    mat4.perspective(this.projection,(w/h<1?69:55)*Math.PI/180,w/h,.1,230);const cameraY=g.flightCameraY||0,warning=Math.sin(g.time*34)*(g.dangerPulse||0)*.018;mat4.lookAt(this.view,[g.x*.12+warning,5.8+cameraY,14],[g.x*.04,1+cameraY,-22],[0,1,0]);
    this.renderEnvironment(g);
    for(const o of g.items){
      const x=o.x??o.lane*3,z=o.z;if(z>12||z< -145)continue;
      if(o.type==='virus')this.virus(x,g.virusHeight(o),z,g.time+(o.phase||0),o,g.virusStyle(o));
      else if(o.type==='barrier'||o.type==='overhead'){
        const y=o.type==='overhead'?2.2:.75;
        this.box(x,y,z,1.12,.43,.21,'stripe');
        for(const s of [-1,1]){this.box(x+s*.9,y/2,z,.09,y/2,.12,'#344954');this.orb(x+s*.9,y+.52,z,.12,.12,.12,'#fa705a');}
      }else if(o.type==='vaccine'){
        if(!o.collected)this.vaccine(x,o.y??1.05,z,g.time);
      }else if(o.type==='shield'){
        if(!o.collected)this.protector(x,(o.y??1.05)+Math.sin(g.time*2+z*.3)*.12,z,g.time);
      }else if(['boost','double','magnet'].includes(o.type)){
        const y=(o.y??1.05)+Math.sin(g.time*2+z*.3)*.08+Math.sin(g.time*.7)*.03;
        const ct=o.collected?Math.min(1,(o.collectTime||0)*5):0,e=ct>0?1-Math.pow(1-ct,2):0;
        this.box(x,y,z,.58+e*.4,.64+e*.2,.035,o.type,[0,Math.sin(g.time*.7)*.15,g.time*.6]);
        if(o.collected){
          this.box(x,y,z+.025,.7+e*1.8,.7+e*1.8,.005,o.type+'-ring',[0,0,g.time*4]);
          const fc=o.type==='boost'?'#ffd966':o.type==='magnet'?'#ffb3d9':'#e0bbff';
          for(let i=0;i<12;i++){const a=e*Math.PI*6+i*Math.PI/6,r=e*2.2;this.orb(x+Math.cos(a)*r,y+Math.sin(a)*r,z+.03,i%2===0?.05:.04,i%2===0?.05:.04,.01,i%2===0?'#ffffff':fc);}
        }else{
          const rs=.85+Math.sin(g.time*5)*.03;
          this.box(x,y,z+.025,rs,rs,.005,o.type+'-ring',[0,0,g.time*2.5]);
          const pc={boost:{n:6,c:'#ffce65'},double:{n:5,c:'#c3a0ff'},magnet:{n:4,c:'#ff8eac'}},p=pc[o.type];
          for(let i=0;i<p.n;i++){const a=g.time*1.3+i/p.n*Math.PI*2+z*.1,r=.72+Math.sin(g.time*2+i)*.04;this.orb(x+Math.cos(a)*r,y+Math.sin(a*.7)*.12,z,.03,.03,.01,p.c);}
        }
      }else if(o.type==='drop'){
        if(!o.collected){const y=(o.y??1.05)+Math.sin(g.time*2.7+z*.055)*.10;this.polioDrop(x,y,z,g.time);}
      }else{
        const y=(o.y??1.05)+Math.sin(g.time*3+z)*.14;
        this.box(x,y,z,.58,.64,.035,o.type);
        if(o.airDrop||o.type==='flight')for(let i=0;i<3;i++){const a=g.time*2+i*2.094;this.orb(x+Math.cos(a)*.62,y+Math.sin(a)*.72,z,.04,.04,.04,'#8feeff');}
      }
    }
    for(const effect of g.collectionEffects||[]){
      if(effect.age<.18){
        const scale=effect.age<.07?1+.25*effect.age/.07:1.25*Math.max(.025,1-(effect.age-.07)/.11);
        this.polioDrop(effect.x,effect.y,effect.z,g.time,scale,false);
      }
      if(effect.age<.4){
        const phase=effect.age/.4,index=Math.min(3,Math.floor(phase*4)),radius=.34+phase*.88;
        this.box(effect.playerX,effect.playerY+1.05,3.84,radius,radius,.008,'collect-ring-'+index);
      }
    }
    for(const ripple of g.footstepRipples||[])if(ripple.age<.38){
      const phase=ripple.age/.38,index=Math.min(3,Math.floor(phase*4)),radius=.15+phase*.27;
      this.box(ripple.x,.092,ripple.z,radius,.002,radius,'foot-ripple-'+index);
    }
    this.player(g);
    const px=g.x,py=g.jumpY;
    const groundedRun=g.animationState==='RUN'&&!g.flightMode;
    if(g.powers.boost>0&&!groundedRun){for(let i=0;i<12;i++){const a=i/12*Math.PI*2+g.time*2;this.orb(px+Math.cos(a)*.76,py+1+Math.sin(a)*.95,4,.055,.055,.055,g.powers.boost?'#ffdf75':'#6ce8ff');}}
    if((g.powers.shield>0||g.shieldBreak>0)&&!groundedRun){
      const breaking=g.shieldBreak>0,expand=breaking?(1-g.shieldBreak/.45)*.8:0;
      const height=this.playerPose?.visualHeight||2.5;
      for(let i=0;i<20;i++){
        const a=i/20*Math.PI*2+g.time*1.8,r=.88+expand;
        this.orb(px+Math.cos(a)*r,py+.025+height/2+Math.sin(a)*(height/2+.12+expand),4.15,
          breaking?.09:.045,breaking?.09:.045,.045,i%4===0?'#e21f32':'#ffd766');
      }
    }
    if(g.vaccineReadyPulse>0&&!groundedRun){
      const progress=1-g.vaccineReadyPulse/.8,r=.65+progress*1.2;
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8+g.time,size=.06*(1-progress);
        this.orb(px+Math.cos(a)*r,py+.65,4+Math.sin(a)*r,size,size,size,i%2?'#ffd766':'#62f5ed');
      }
    }
    if(g.flightMode){for(let i=0;i<8;i++){const a=i*Math.PI/4+g.time*2;this.orb(px+Math.cos(a)*.58,py+.12,4+Math.sin(a)*.36,.055,.055,.055,'#90efff');}}
    for(const effect of g.collectionEffects||[])if(effect.age<.65){
      const fade=Math.min(3,Math.floor(effect.age/.65*4));
      this.box(effect.playerX,effect.playerY+2.55+effect.age*.55,4.18,.57,.16,.006,'drop-label-'+fade);
    }
    for(const p of g.particles){const size=p.life*(p.flight?.20:(p.size??.07));this.orb(p.x,p.y,p.z,size,size,size,p.color);}
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
