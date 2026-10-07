/* Narrow glTF 2.0 loader for the bundled, uncompressed skinned GLB.
   Keeps the scenery renderer and its lighting untouched. No runtime packages. */
class PlayerAsset {
  static decode(buffer){
    const header=new DataView(buffer);
    if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid player GLB');
    let json,bin;
    for(let at=12;at<buffer.byteLength;){const size=header.getUint32(at,true),type=header.getUint32(at+4,true);at+=8;if(at+size>buffer.byteLength)throw Error('Truncated player GLB');if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,at,size)));if(type===0x004e4942)bin=at;at+=size;}
    if(!json||bin===undefined||json.skins.length!==1)throw Error('Player GLB requires one skin');
    const types={5121:Uint8Array,5123:Uint16Array,5126:Float32Array},width={SCALAR:1,VEC3:3,VEC4:4,MAT4:16};
    const read=index=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],Type=types[a.componentType];if(!Type||v.byteStride||a.sparse)throw Error('Unsupported player accessor');return new Type(buffer,bin+(v.byteOffset||0)+(a.byteOffset||0),a.count*width[a.type]);};
    const primitive=json.meshes[0].primitives[0],skin=json.skins[0],parents=skin.joints.map(()=>-1);
    skin.joints.forEach((node,i)=>(json.nodes[node].children||[]).forEach(child=>{const j=skin.joints.indexOf(child);if(j>=0)parents[j]=i;}));
    return {json,skin,parents,attributes:Object.fromEntries(Object.entries(primitive.attributes).map(([k,v])=>[k,read(v)])),indices:read(primitive.indices),inverse:read(skin.inverseBindMatrices)};
  }
  constructor(gl){this.gl=gl;this.ready=false;this.loaded=this.load();}
  async load(){
    const response=await fetch('./assets/doctor-boy.glb');if(!response.ok)throw Error('Cannot load doctor-boy.glb: '+response.status);
    const data=PlayerAsset.decode(await response.arrayBuffer());Object.assign(this,data);
    const gl=this.gl,count=this.skin.joints.length;
    if(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)<count*4+12)throw Error('Insufficient vertex uniforms for player skeleton');
    const vertex=`attribute vec3 position,normal,color;attribute vec4 joints,weights;
      uniform mat4 bones[${count}],view,projection;uniform vec3 origin;
      varying vec3 vColor,vNormal,vPosition;
      void main(){mat4 skin=weights.x*bones[int(joints.x)]+weights.y*bones[int(joints.y)]+weights.z*bones[int(joints.z)]+weights.w*bones[int(joints.w)];
      vec4 p=view*vec4((skin*vec4(position,1.)).xyz+origin,1.);vPosition=p.xyz;vNormal=mat3(view)*mat3(skin)*normal;vColor=color;gl_Position=projection*p;}`;
    const fragment=`precision mediump float;varying vec3 vColor,vNormal,vPosition;uniform bool grayscale,flash;
      void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
      vec3 light=normalize(vec3(-.45,.8,.65)),eye=normalize(-vPosition),halfway=normalize(light+eye);
      float diffuse=max(dot(n,light),0.),fill=max(dot(n,normalize(vec3(.7,.3,-.5))),0.);
      float sheen=pow(max(dot(n,halfway),0.),36.)*.15;
      float rim=pow(1.-max(dot(n,eye),0.),3.)*.12;
      vec3 c=vColor*(.54+.48*diffuse+.15*fill)+vec3(sheen)+vec3(.20,.32,.48)*rim;
      if(grayscale)c=vec3(dot(c,vec3(.3,.59,.11)));if(flash)c+=.18;gl_FragColor=vec4(c,1.);}`;
    this.program=initShaderProgram(gl,vertex,fragment);if(!this.program)throw Error('Player skin shader failed');
    this.bindings=[];
    for(const [semantic,name,size,type] of [['POSITION','position',3,gl.FLOAT],['NORMAL','normal',3,gl.FLOAT],['COLOR_0','color',3,gl.FLOAT],['JOINTS_0','joints',4,gl.UNSIGNED_BYTE],['WEIGHTS_0','weights',4,gl.FLOAT]]){
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,this.attributes[semantic],gl.STATIC_DRAW);this.bindings.push({buffer,location:gl.getAttribLocation(this.program,name),size,type});
    }
    this.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.indices,gl.STATIC_DRAW);
    this.uniforms=Object.fromEntries(['bones[0]','view','projection','origin','grayscale','flash'].map(name=>[name,gl.getUniformLocation(this.program,name)]));
    this.prepareSupport();
    this.ready=true;return this;
  }
  prepareSupport(){
    const count=this.skin.joints.length;
    // Precompute extremal surface vertices in many directions. Unlike joint
    // boxes, these points belong to the real weighted mesh, including soles.
    const a=this.attributes,selected=new Set(),directions=[];
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const d=[0,0,0];d[axis]=sign;directions.push(d);}
    for(let i=0;i<128;i++){const y=1-2*(i+.5)/128,r=Math.sqrt(1-y*y),angle=i*2.399963;directions.push([r*Math.cos(angle),y,r*Math.sin(angle)]);}
    const candidates=Array.from({length:count},()=>[]);
    for(let i=0;i<a.POSITION.length/3;i++)for(let k=0;k<4;k++)if(a.WEIGHTS_0[i*4+k]>=.999)candidates[a.JOINTS_0[i*4+k]].push(i);
    for(const group of candidates)for(const d of directions){let best=-Infinity,index=-1;for(const i of group){const dot=a.POSITION[i*3]*d[0]+a.POSITION[i*3+1]*d[1]+a.POSITION[i*3+2]*d[2];if(dot>best){best=dot;index=i;}}if(index>=0)selected.add(index);}
    // Blended vertices can become extremal between two moving bones even if
    // they were interior to both bind-pose hulls (notably the folding coat).
    for(let i=0;i<a.POSITION.length/3;i++)if(a.WEIGHTS_0[i*4+1]>.001&&a.WEIGHTS_0[i*4+1]<.999)selected.add(i);
    this.supportVertices=Uint32Array.from(selected);
  }
  bounds(palette){
    let bottom=Infinity,top=-Infinity;
    const a=this.attributes;
    for(const i of this.supportVertices){
      const x=a.POSITION[i*3],y=a.POSITION[i*3+1],z=a.POSITION[i*3+2];let height=0;
      for(let k=0;k<4;k++){const w=a.WEIGHTS_0[i*4+k];if(!w)continue;const b=a.JOINTS_0[i*4+k]*16;height+=w*(palette[b+1]*x+palette[b+5]*y+palette[b+9]*z+palette[b+13]);}
      bottom=Math.min(bottom,height);top=Math.max(top,height);
    }return {bottom,top};
  }
  draw(scene,palette,x,y,z){
    const gl=this.gl;gl.useProgram(this.program);
    for(const b of this.bindings){gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.vertexAttribPointer(b.location,b.size,b.type,false,0,0);gl.enableVertexAttribArray(b.location);}
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer);
    gl.uniformMatrix4fv(this.uniforms['bones[0]'],false,palette);gl.uniformMatrix4fv(this.uniforms.view,false,scene.view);gl.uniformMatrix4fv(this.uniforms.projection,false,scene.projection);gl.uniform3f(this.uniforms.origin,x,y,z);gl.uniform1i(this.uniforms.grayscale,grayscale);gl.uniform1i(this.uniforms.flash,flash);
    gl.drawElements(gl.TRIANGLES,this.indices.length,gl.UNSIGNED_SHORT,0);
    // Restore enabled attribute state before returning to the scenery pipeline.
    for(const b of this.bindings)gl.disableVertexAttribArray(b.location);
  }
}
