(function () {
  'use strict';
  const T=THREE, TAU=Math.PI*2;
  const materials=new Map();
  const mat=color=>{if(!materials.has(color))materials.set(color,new T.MeshLambertMaterial({color}));return materials.get(color);};
  const cubeGeo=new T.BoxGeometry(1,1,1);
  const voxelMaterial=new T.MeshLambertMaterial({vertexColors:true});
  const box=(parent,x,y,z,w,h,d,color)=>{const m=new T.Mesh(cubeGeo,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;};
  function mergeBlocks(parent) {
    const blocks=parent.children.filter(o=>o.isMesh),pos=[],normal=[],colors=[];
    for(const block of blocks) {
      block.updateMatrix();const geometry=cubeGeo.toNonIndexed();geometry.applyMatrix4(block.matrix);
      pos.push(...geometry.attributes.position.array);normal.push(...geometry.attributes.normal.array);
      const color=block.material.color;for(let i=0;i<geometry.attributes.position.count;i++)colors.push(color.r,color.g,color.b);
      geometry.dispose();parent.remove(block);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
    parent.add(new T.Mesh(geometry,voxelMaterial));
  }
  function model(team,slot,keeper=false) {
    const root=new T.Group(),body=new T.Group();root.add(body);
    const skin=['#ffbc79','#f8b277','#c9814d'][slot%3],hair=['#683b24','#ffcf3a','#222633','#87442b'][slot%4];
    const shirt=keeper?team.keeperColor:team.shirt;
    box(body,0,.65,0,.86,.9,.65,shirt);
    box(body,0,.18,0,.85,.22,.65,keeper?'#242735':team.shorts);
    box(body,0,1.08,0,1.02,.12,.74,shirt);
    box(body,0,1.58,0,1.2,1.03,1.04,skin);
    box(body,0,2.11,-.01,1.24,.23,1.08,hair);
    box(body,0,1.74,-.48,1.24,.64,.14,hair);
    box(body,-.53,1.9,.3,.19,.28,.45,hair);
    box(body,.5,1.97,.27,.26,.2,.5,hair);
    box(body,-.23,1.54,.535,.11,.28,.025,'#151a22');
    box(body,.23,1.54,.535,.11,.28,.025,'#151a22');
    box(body,0,1.17,.08,.3,.08,.1,skin);
    const arms=[];
    for(const sign of [-1,1]) {
      const arm=new T.Group();arm.position.set(sign*.56,.84,0);body.add(arm);
      box(arm,0,0,0,.27,.3,.4,shirt);box(arm,0,-.13,.04,.28,.06,.37,keeper?'#f9ffff':team.trim);
      box(arm,0,-.23,.04,.27,.22,.35,keeper?'#ffffff':skin);arms.push(arm);
    }
    // Shorts are a single compact block. This model intentionally has no legs or feet.
    mergeBlocks(body);arms.forEach(mergeBlocks);
    root.userData={body,arms};return root;
  }
  function canvasTexture(draw,w=1024,h=512) {
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=16;return t;
  }
  const radial=canvasTexture((c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,210,.9)');g.addColorStop(.2,'rgba(255,240,140,.5)');g.addColorStop(1,'rgba(255,224,100,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},128,128);
  function football(radius) {
    // A real truncated icosahedron: twelve black pentagons and twenty white hexagons.
    const ico=new T.IcosahedronGeometry(1,0),arr=ico.attributes.position.array,vertices=[],faces=[],lookup=new Map();
    for(let i=0;i<arr.length;i+=9){const face=[];for(let j=0;j<3;j++){
      const p=new T.Vector3(arr[i+j*3],arr[i+j*3+1],arr[i+j*3+2]),key=p.toArray().map(x=>x.toFixed(5)).join(',');
      if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p);}face.push(lookup.get(key));
    }faces.push(face);}ico.dispose();
    const neighbors=vertices.map(()=>new Set()),edge=(a,b)=>vertices[a].clone().multiplyScalar(2/3).addScaledVector(vertices[b],1/3);
    const scale=radius/edge(faces[0][0],faces[0][1]).length(),polygons=[];
    for(const [a,b,c] of faces){neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);polygons.push({color:'#ffffff',points:[edge(a,b),edge(b,a),edge(b,c),edge(c,b),edge(c,a),edge(a,c)]});}
    vertices.forEach((center,i)=>{
      const points=[...neighbors[i]].map(j=>edge(i,j)),normal=center.clone().normalize(),u=points[0].clone().sub(center).projectOnPlane(normal).normalize(),v=new T.Vector3().crossVectors(normal,u);
      points.sort((a,b)=>Math.atan2(a.dot(v),a.dot(u))-Math.atan2(b.dot(v),b.dot(u)));polygons.push({color:'#111a27',points});
    });
    const positions=[],normals=[],colors=[],seams=[];
    for(const polygon of polygons){
      const points=polygon.points.map(p=>p.multiplyScalar(scale)),center=points.reduce((a,p)=>a.add(p),new T.Vector3()).multiplyScalar(1/points.length);
      let normal=new T.Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0])).normalize();
      if(normal.dot(center)<0){points.reverse();normal.negate();}
      const color=new T.Color(polygon.color);
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];for(const p of [center,a,b]){positions.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);colors.push(color.r,color.g,color.b);}
        seams.push(...a.clone().multiplyScalar(1.003).toArray(),...b.clone().multiplyScalar(1.003).toArray());
      }
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,new T.MeshLambertMaterial({vertexColors:true}));mesh.castShadow=true;
    const seamGeometry=new T.BufferGeometry();seamGeometry.setAttribute('position',new T.Float32BufferAttribute(seams,3));mesh.add(new T.LineSegments(seamGeometry,new T.LineBasicMaterial({color:'#536475',transparent:true,opacity:.32})));
    mesh.rotation.set(.25,.6,.15);return mesh;
  }
  class View {
    constructor(canvas) {
      this.canvas=canvas;
      this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      this.renderer.outputColorSpace=T.SRGBColorSpace;
      this.renderer.setClearColor('#65bfff');
      this.scene=new T.Scene();
      this.camera=new T.PerspectiveCamera(20,16/9,.1,260);
      this.camera.position.set(0,62,66);this.camera.lookAt(0,0,0);
      this.baseCamera=this.camera.position.clone();
      this.hemi=new T.HemisphereLight('#f9fcff','#7e98c1',1.4);this.scene.add(this.hemi);
      this.sun=new T.DirectionalLight('#fff6d0',2);this.sun.position.set(-15,30,12);this.scene.add(this.sun);
      this.fill=new T.DirectionalLight('#eff9ff',.55);this.fill.position.set(0,24,48);this.scene.add(this.fill);
      this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-28,right:28,top:20,bottom:-20,near:1,far:80});this.sun.shadow.bias=-.0007;this.sun.shadow.normalBias=.035;
      this.field=new T.Group();this.scene.add(this.field);this.buildArena();
      this.playerGroup=new T.Group();this.scene.add(this.playerGroup);this.models=[];this.shadows=[];
      this.ballGroup=new T.Group();this.scene.add(this.ballGroup);
      this.ballMesh=football(SoccerCore.BALL_RADIUS);this.ballGroup.add(this.ballMesh);this.rollAxis=new T.Vector3();this.rollQuaternion=new T.Quaternion();
      this.ballShadow=this.shadow(.837);this.scene.add(this.ballShadow);
      this.ring=new T.Mesh(new T.RingGeometry(.73,.86,32),new T.MeshBasicMaterial({color:'#67f9ff',side:T.DoubleSide,transparent:true,opacity:.95}));this.ring.rotation.x=-Math.PI/2;this.scene.add(this.ring);
      this.marker=new T.Mesh(new T.ConeGeometry(.24,.4,3),new T.MeshBasicMaterial({color:'#75faff'}));this.scene.add(this.marker);
      // Pass target hint (teammate arrow) and the dashed aiming line shown while charging a shot.
      this.passMarker=new T.Mesh(new T.ConeGeometry(.3,.55,4),new T.MeshBasicMaterial({color:'#7dff6a'}));this.passMarker.visible=false;this.scene.add(this.passMarker);
      this.passRing=new T.Mesh(new T.RingGeometry(.7,.84,32),new T.MeshBasicMaterial({color:'#7dff6a',side:T.DoubleSide,transparent:true,opacity:.75,depthWrite:false}));this.passRing.rotation.x=-Math.PI/2;this.passRing.visible=false;this.scene.add(this.passRing);
      this.saveRing=new T.Mesh(new T.RingGeometry(1.2,1.45,40),new T.MeshBasicMaterial({color:'#ffef4a',side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));this.saveRing.rotation.x=-Math.PI/2;this.saveRing.visible=false;this.scene.add(this.saveRing);
      // Knockout stars circling a keeper bowled over by a full-bar Super Shot.
      const starTex=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);c.translate(w/2,h/2);c.beginPath();for(let i=0;i<10;i++){const r=i%2?w*.2:w*.46,a=i*Math.PI/5-Math.PI/2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fillStyle='#ffe23a';c.strokeStyle='#a35a00';c.lineWidth=w*.06;c.fill();c.stroke();},64,64);
      this.stars=[];for(let i=0;i<20;i++){const sp=new T.Sprite(new T.SpriteMaterial({map:starTex,transparent:true,depthWrite:false}));sp.scale.setScalar(1.25);sp.renderOrder=5;sp.material.depthTest=false;sp.visible=false;this.scene.add(sp);this.stars.push(sp);}
      // Penalty aiming reticle, drawn in the goal mouth facing the taker.
      const retTex=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#ffffff';c.lineWidth=w*.07;c.beginPath();c.arc(w/2,h/2,w*.36,0,Math.PI*2);c.stroke();c.lineWidth=w*.05;for(const [a,b,cx,cy] of [[.5,.02,.5,.3],[.5,.7,.5,.98],[.02,.5,.3,.5],[.7,.5,.98,.5]]){c.beginPath();c.moveTo(a*w,b*h);c.lineTo(cx*w,cy*h);c.stroke();}c.beginPath();c.arc(w/2,h/2,w*.06,0,Math.PI*2);c.fillStyle='#fff';c.fill();},128,128);
      this.penTarget=new T.Mesh(new T.PlaneGeometry(1.25,1.25),new T.MeshBasicMaterial({map:retTex,color:'#ffe94c',transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide}));this.penTarget.rotation.y=-Math.PI/2;this.penTarget.renderOrder=10;this.penTarget.visible=false;this.scene.add(this.penTarget);
      this.aimDots=[];const dotGeo=new T.CircleGeometry(.2,12);
      for(let i=0;i<18;i++){const m=new T.Mesh(dotGeo,new T.MeshBasicMaterial({color:'#fff35a',transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;m.visible=false;this.scene.add(m);this.aimDots.push(m);}
      this.particles=[];
      for(let i=0;i<320;i++){const m=new T.Mesh(cubeGeo,new T.MeshBasicMaterial({color:'#ffe142',transparent:true}));m.visible=false;this.scene.add(m);this.particles.push({m,life:0,vx:0,vy:0,vz:0,max:1});}
      this.trail=[];
      for(let i=0;i<24;i++) {
        const m=new T.Mesh(new T.IcosahedronGeometry(.33,0),new T.MeshBasicMaterial({color:'#f8eb79',transparent:true,opacity:0,depthWrite:false}));this.scene.add(m);this.trail.push(m);
      }
      this.trailHistory=[];this.shake=0;this.weather='SUNNY';this.night=false;this.quality=2;
      this.shockwaves=[];
      for(let i=0;i<4;i++){const m=new T.Mesh(new T.RingGeometry(.85,1,40),new T.MeshBasicMaterial({color:'#ffe655',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));m.rotation.x=-Math.PI/2;m.visible=false;this.scene.add(m);this.shockwaves.push({m,life:0});}
      this.ballGlow=new T.Sprite(new T.SpriteMaterial({map:radial,color:'#ffe655',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.ballGlow.scale.set(4,4,1);this.ballGroup.add(this.ballGlow);
      this.weatherSeeds=[];this.weatherDummy=new T.Object3D();
      for(let i=0;i<1100;i++)this.weatherSeeds.push({x:Math.random()*64-32,y:Math.random()*22,z:Math.random()*40-20,phase:Math.random()*TAU,length:.55+Math.random()*.55,width:.072+Math.random()*.018});
      // Short tapered drops face the camera and fall vertically, without diagonal ribbons.
      const drop=canvasTexture((c,w,h)=>{
        c.clearRect(0,0,w,h);const x=w/2,g=c.createLinearGradient(0,0,0,h);
        g.addColorStop(0,'#e1f3ff00');g.addColorStop(.18,'#e1f3ff28');g.addColorStop(.64,'#e1f3ffb8');g.addColorStop(.88,'#f1fbfff0');g.addColorStop(1,'#e1f3ff00');
        c.fillStyle=g;c.beginPath();c.moveTo(x,2);c.lineTo(x-w*.28,h*.77);c.bezierCurveTo(x-w*.34,h*.95,x-w*.15,h*.99,x,h*.99);c.bezierCurveTo(x+w*.15,h*.99,x+w*.34,h*.95,x+w*.28,h*.77);c.closePath();c.fill();
      },48,128);
      this.rain=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:drop,color:'#e4f5ff',transparent:true,opacity:.62,side:T.DoubleSide,depthWrite:false,alphaTest:.01}),1100);this.rain.instanceMatrix.setUsage(T.DynamicDrawUsage);this.rain.frustumCulled=false;this.scene.add(this.rain);
      const flake=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.48);g.addColorStop(0,'#ffffff');g.addColorStop(.55,'#ffffff');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,h);},64,64);
      const snowGeo=new T.BufferGeometry();snowGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(1100*3),3));
      this.snow=new T.Points(snowGeo,new T.PointsMaterial({map:flake,color:'#ffffff',size:1.35,transparent:true,opacity:.65,depthWrite:false,alphaTest:.03}));this.snow.frustumCulled=false;this.scene.add(this.snow);
      this.buildWeatherSurface();
      this.time=0;this.setEnvironment('SUNNY',false);this.setQuality(2);
    }
    shadow(size) {
      const m=new T.Mesh(new T.CircleGeometry(size,20),new T.MeshBasicMaterial({color:'#193b29',transparent:true,opacity:.24,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.035;return m;
    }
    buildArena() {
      this.drawPitch=(c,w,h,style)=>{
        c.fillStyle='#65cd30';c.fillRect(0,0,w,h);
        const light='rgba(172,247,77,.16)',dark='rgba(25,127,30,.075)';
        if(style===0)for(let x=0;x<12;x++)for(let y=0;y<7;y++){c.fillStyle=(x+y)%2?light:dark;c.fillRect(x*w/12,y*h/7,w/12,h/7);}
        if(style===1)for(let y=0;y<9;y++){c.fillStyle=y%2?light:dark;c.fillRect(0,y*h/9,w,h/9);}
        if(style===2)for(let x=0;x<14;x++){c.fillStyle=x%2?light:dark;c.fillRect(x*w/14,0,w/14,h);}
        if(style===3){c.save();c.translate(w/2,h/2);c.rotate(Math.PI/4);const tile=w/13;for(let x=-13;x<13;x++)for(let y=-13;y<13;y++){c.fillStyle=(x+y)%2?light:dark;c.fillRect(x*tile,y*tile,tile,tile);}c.restore();}
        if(style===4){const band=h/9;for(let row=-2;row<12;row++){c.fillStyle=row%2?light:dark;c.beginPath();for(let col=0;col<=12;col++){const x=col*w/12,y=row*band+(col%2?band*.6:0);if(col===0)c.moveTo(x,y);else c.lineTo(x,y);}for(let col=12;col>=0;col--)c.lineTo(col*w/12,(row+1)*band+(col%2?band*.6:0));c.closePath();c.fill();}}
        // Tiny grass flecks keep the surface readable without an expensive texture.
        let seed=193;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
        for(let i=0;i<100000;i++){c.fillStyle=r()>.5?'rgba(223,255,157,.16)':'rgba(17,112,24,.1)';const x=r()*w,y=r()*h;c.fillRect(x,y,1+r()*2,2+r()*3);}
        const sx=w/52,sz=h/32,x=v=>(v+26)*sx,z=v=>(v+16)*sz;
        c.strokeStyle='#f6ffe9';c.lineWidth=w/52*.135;c.lineJoin='miter';
        const line=(x1,z1,x2,z2)=>{c.beginPath();c.moveTo(x(x1),z(z1));c.lineTo(x(x2),z(z2));c.stroke();};
        c.strokeRect(x(-24),z(-14),48*sx,28*sz);line(0,-14,0,14);
        c.beginPath();c.ellipse(x(0),z(0),4.5*sx,4.5*sz,0,0,TAU);c.stroke();
        c.fillStyle='#eeffda';c.beginPath();c.ellipse(x(0),z(0),.25*sx,.25*sz,0,0,TAU);c.fill();
        for(const sign of [-1,1]){
          const gx=sign===-1?-24:17.3;c.strokeRect(x(gx),z(-7.7),6.7*sx,15.4*sz);
          const bx=sign===-1?-24:21.5;c.strokeRect(x(bx),z(-4.6),2.5*sx,9.2*sz);
          c.beginPath();c.ellipse(x(sign*19),z(0),.2*sx,.2*sz,0,0,TAU);c.fill();
        }
      };
      const pitch=canvasTexture((c,w,h)=>this.drawPitch(c,w,h,0),3072,1890);this.pitchStyle=0;
      this.pitchMaterial=new T.MeshLambertMaterial({map:pitch});
      const plane=new T.Mesh(new T.PlaneGeometry(52,32),this.pitchMaterial);plane.rotation.x=-Math.PI/2;plane.receiveShadow=true;this.field.add(plane);
      box(this.field,0,-.3,0,65,.5,44,'#344b3b');
      this.goalNets=[];this.goalGroups=[];this.goalWobble=[0,0];
      for(const side of [-1,1])this.goal(side);
      for(const z of [-18,18])for(let row=0;row<4;row++){
        const zz=z+Math.sign(z)*row*1.55;box(this.field,0,.6+row*.72,zz,64,1.2,1.65,row%2?'#526e9a':'#395887');box(this.field,0,1.22+row*.72,zz-.8*Math.sign(z),64,.12,.2,'#7c99bf');
      }
      for(const x of [-30,30])for(let row=0;row<3;row++)box(this.field,x+Math.sign(x)*row*1.5,.6+row*.72,0,1.65,1.2,34,'#42679a');
      this.buildCrowd();
      const boardTex=canvasTexture((c,w,h)=>{
        c.fillStyle='#ed1637';c.fillRect(0,0,w,h);c.fillStyle='#ffffff';c.font='900 138px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('MAPI GAMES',w/2,h*.54);
      },2048,192);
      for(const z of [-16.7,16.7]){
        box(this.field,0,.78,z,57,1.56,.3,'#075dea');box(this.field,0,1.57,z,57,.1,.35,'#b8d4f5');
        const b=new T.Mesh(new T.PlaneGeometry(17,1.56),new T.MeshBasicMaterial({map:boardTex}));b.position.set(0,.78,z+(z<0?.16:-.16));if(z>0)b.rotation.y=Math.PI;this.field.add(b);
        for(const side of [-1,1])for(let i=0;i<3;i++){
          const xx=side*(11.83+i*6.67),blue=i%2===0,panel=box(this.field,xx,.78,z+(z<0?.02:-.02),6.65,1.56,.35,blue?'#075cff':'#ffe02b');panel.material=new T.MeshBasicMaterial({color:blue?'#075cff':'#ffe02b'});
          if(blue)for(const [dx,dy] of [[-.25,.18],[.25,.18],[0,-.25]])box(this.field,xx+dx,.78+dy,z+(z<0?.21:-.21),.25,.25,.025,'#ffffff');
        }
      }
      for(const x of [-28.5,28.5])box(this.field,x,.7,0,.3,1.4,32,'#1165e5');
      this.floodlights=[];this.glows=[];
      for(const x of [-26.2,26.2]) {
        const z=-17.4;
        box(this.field,x,2.4,z,.35,4.8,.35,'#364256');box(this.field,x,4.8,z,3.1,1.65,.3,'#293c53');
        for(let i=0;i<3;i++)for(let j=0;j<2;j++){
          const light=box(this.field,x-1+i,4.43+j*.7,z+.2,.75,.54,.12,'#fffaaf');light.material=new T.MeshBasicMaterial({color:'#fffcc6'});
        }
        const glow=new T.Sprite(new T.SpriteMaterial({map:radial,color:'#ffe997',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));glow.position.set(x,4.8,z+.4);glow.scale.set(6,6,1);this.scene.add(glow);this.glows.push(glow);
        const point=new T.SpotLight('#e7f2ff',0,85,Math.PI/3,.45,1);point.position.set(x,8,z);point.target.position.set(0,0,0);this.scene.add(point,point.target);this.floodlights.push(point);
      }
    }
    setPitch(style){
      style=SoccerCore.clamp(Math.floor(style),0,4);if(this.pitchStyle===style)return;
      this.pitchStyle=style;const texture=this.pitchMaterial.map,canvas=texture.image;
      this.drawPitch(canvas.getContext('2d'),canvas.width,canvas.height,style);texture.needsUpdate=true;
    }
    buildWeatherSurface(){
      this.snowSurface=new T.Group();this.wetSurface=new T.Group();this.scene.add(this.snowSurface,this.wetSurface);
      const patch=canvasTexture((c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,w*.15,w/2,h/2,w*.49);g.addColorStop(0,'#ffffff');g.addColorStop(.65,'#ffffffdd');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,h);},128,128);
      const spots=[[-14,-7.3,2.25,1.35],[15,5.8,2.2,1.2],[-2,10,2.45,1.3]];
      const dummy=new T.Object3D(),white=new T.Color();
      this.snowPatches=new T.InstancedMesh(new T.PlaneGeometry(2,2),new T.MeshLambertMaterial({map:patch,color:'#f1f8ff',transparent:true,opacity:.94,depthWrite:false,alphaTest:.035}),spots.length);this.snowPatches.receiveShadow=true;this.snowSurface.add(this.snowPatches);
      this.snowMounds=new T.InstancedMesh(new T.SphereGeometry(1,10,5,0,TAU,0,Math.PI/2),new T.MeshLambertMaterial({color:'#ffffff'}),spots.length*3);this.snowMounds.castShadow=this.snowMounds.receiveShadow=true;this.snowSurface.add(this.snowMounds);
      spots.forEach(([x,z,w,d],i)=>{
        dummy.position.set(x,.047,z);dummy.rotation.set(-Math.PI/2,0,i*.71);dummy.scale.set(w*1.3,d*1.3,1);dummy.updateMatrix();this.snowPatches.setMatrixAt(i,dummy.matrix);
        for(let j=0;j<3;j++){const scale=j===0?1:.55;dummy.position.set(x+(j===1?-w*.55:j===2?w*.5:0),.048,z+(j===1?d*.2:j===2?-d*.28:0));dummy.rotation.set(0,i*.71,0);dummy.scale.set(w*.68*scale,(j===0?.42:.25)*(1+(i%3)*.14),d*.72*scale);dummy.updateMatrix();this.snowMounds.setMatrixAt(i*3+j,dummy.matrix);this.snowMounds.setColorAt(i*3+j,white.set(j===1?'#e2efff':'#f8fcff'));}
      });
      const pools=[[-14,-5.8,2.0,1.15],[11,6.3,2.1,1.3],[-2,9.3,1.7,.95]],shape=new T.Shape();for(let i=0;i<=24;i++){const angle=i/24*TAU,r=1+Math.sin(angle*3)*.095+Math.cos(angle*5)*.065,x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
      const poolGeometry=new T.ShapeGeometry(shape);
      this.puddles=new T.InstancedMesh(poolGeometry,new T.MeshPhongMaterial({color:'#6bb4d5',specular:'#eefaff',shininess:100,transparent:true,opacity:.72,depthWrite:false}),pools.length);this.wetSurface.add(this.puddles);
      this.waterEdges=new T.InstancedMesh(poolGeometry,new T.MeshBasicMaterial({color:'#153b50',transparent:true,opacity:.24,depthWrite:false}),pools.length);this.wetSurface.add(this.waterEdges);
      this.waterGlints=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#d8f6ff',transparent:true,opacity:.43,depthWrite:false}),pools.length*2);this.wetSurface.add(this.waterGlints);
      pools.forEach(([x,z,w,d],i)=>{
        for(const [mesh,scale,y] of [[this.waterEdges,1.055,.021],[this.puddles,1,.028]]){dummy.position.set(x,y,z);dummy.rotation.set(-Math.PI/2,0,i*.71);dummy.scale.set(w*scale,d*scale,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
        for(let j=0;j<2;j++){dummy.position.set(x+(j-.5)*w*.65,.036,z+(j-.5)*d*.45);dummy.rotation.set(-Math.PI/2,0,.08);dummy.scale.set(w*(j?.42:.7),.07,1);dummy.updateMatrix();this.waterGlints.setMatrixAt(i*2+j,dummy.matrix);}
      });
      this.puddleSpots=pools;this.waterRipples=new T.InstancedMesh(new T.RingGeometry(.45,.49,20),new T.MeshBasicMaterial({color:'#dbf8ff',side:T.DoubleSide,transparent:true,opacity:.36,depthWrite:false}),pools.length);this.waterRipples.instanceMatrix.setUsage(T.DynamicDrawUsage);this.wetSurface.add(this.waterRipples);
    }
    buildCrowd() {
      const fans=[];
      for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<52;col++)fans.push({x:(col-25.5)*1.17,z:side*(18+row*1.55),y:1.24+row*.72,yaw:side<0?0:Math.PI});
      for(const side of [-1,1])for(let row=0;row<3;row++)for(let col=0;col<25;col++)fans.push({x:side*(30+row*1.5),z:(col-12)*1.3,y:1.24+row*.72,yaw:side<0?Math.PI/2:-Math.PI/2});
      const count=fans.length,white=mat('#ffffff'),parts={};
      for(const [name,mult] of [['heads',1],['shirts',1],['shorts',1],['caps',1],['fringe',1],['eyes',2],['sleeves',2],['hands',2]]){const mesh=new T.InstancedMesh(cubeGeo,white,count*mult);mesh.frustumCulled=false;this.scene.add(mesh);parts[name]=mesh;}
      const dummy=new T.Object3D(),color=new T.Color(),palette=['#075aff','#ffe020','#fa2443','#12c06b','#2387ff','#fff9dd','#9645eb','#ff8330'],hairs=['#36282a','#ffcb2e','#81402c','#202837','#d26926'],skins=['#ffc58b','#f5b074','#d18b57','#ad693f'];
      const place=(name,index,f,x,y,z,w,h,d,tint,tilt=0)=>{
        const cos=Math.cos(f.yaw),sin=Math.sin(f.yaw);dummy.position.set(f.x+x*cos+z*sin,f.y+y,f.z-x*sin+z*cos);dummy.rotation.set(0,f.yaw,tilt);dummy.scale.set(w,h,d);dummy.updateMatrix();parts[name].setMatrixAt(index,dummy.matrix);parts[name].setColorAt(index,color.set(tint));
      };
      fans.forEach((f,i)=>{
        const shirt=palette[Math.floor(Math.random()*palette.length)],hair=hairs[i%hairs.length],skin=skins[Math.floor(Math.random()*skins.length)],tall=1+(i%4)*.025;
        place('shirts',i,f,0,.45,0,.72,.65,.52,shirt);place('shorts',i,f,0,.12,0,.71,.2,.52,'#24436a');
        place('heads',i,f,0,1.18*tall,0,.91,.8,.79,skin);place('caps',i,f,0,1.6*tall,-.02,.95,.25,.83,hair);
        place('fringe',i,f,(i%3-1)*.2,1.48*tall,.385,.4,.22,.06,hair);
        for(const [j,sign] of [[0,-1],[1,1]]){
          place('eyes',i*2+j,f,sign*.2,1.16*tall,.407,.09,.22,.028,'#111621');
          const cheer=i%7===0,yy=cheer?.87:.5,tilt=cheer?-sign*.6:sign*.08;
          place('sleeves',i*2+j,f,sign*.48,yy,0,.23,.3,.34,shirt,tilt);place('hands',i*2+j,f,sign*(cheer?.59:.49),yy+(cheer?.17:-.23),.035,.22,.22,.3,skin,tilt);
        }
      });
      this.crowd={parts,count};this.crowdRoots=Object.values(parts);
    }
    goal(side) {
      const g=new T.Group();this.field.add(g);const x=side*24;
      const depth=2.35,front=3.15,rear=2.65;
      const beam=(a,b,thickness=.23)=>{
        const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),m=new T.Mesh(cubeGeo,mat('#ffffff'));
        m.position.copy(start.add(end).multiplyScalar(.5));m.scale.set(thickness,delta.length(),thickness);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());m.castShadow=true;g.add(m);
      };
      for(const z of [-3.5,3.5]){
        beam([x,0,z],[x,front,z],.3);beam([x+side*depth,0,z],[x+side*depth,rear,z],.23);
        beam([x,front,z],[x+side*depth,rear,z],.26);beam([x,.1,z],[x+side*depth,.1,z],.22);
      }
      beam([x,front,-3.5],[x,front,3.5],.3);beam([x+side*depth,rear,-3.5],[x+side*depth,rear,3.5],.23);
      const points=[];
      for(let z=-3.5;z<=3.5;z+=.5){points.push(x+side*depth,0,z,x+side*depth,rear,z);points.push(x,front,z,x+side*depth,rear,z);}
      for(let y=0;y<=rear;y+=.44){points.push(x+side*depth,y,-3.5,x+side*depth,y,3.5);for(const z of [-3.5,3.5])points.push(x,y,z,x+side*depth,y,z);}
      for(let gx=0;gx<=depth;gx+=.47){const y=front+(rear-front)*(gx/depth);points.push(x+side*gx,y,-3.5,x+side*gx,y,3.5);for(const z of [-3.5,3.5])points.push(x+side*gx,0,z,x+side*gx,y,z);}
      const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(points,3));
      const net=new T.LineSegments(geom,new T.LineBasicMaterial({color:'#f2f8ff',transparent:true,opacity:.78}));g.add(net);this.goalNets.push(net);this.goalGroups.push({g,x,net});
    }
    setTeams(a,b) {
      this.models.forEach(model=>model.traverse(o=>{if(o.isMesh&&o.geometry!==cubeGeo)o.geometry.dispose();}));
      this.shadows.forEach(m=>m.geometry.dispose());(this.teamRings||[]).forEach(m=>{m.geometry.dispose();m.material.dispose();});
      this.playerGroup.clear();this.models=[];this.shadows=[];this.teamRings=[];
      const kits=SoccerCore.kitsFor(a,b),teams=[{...kits[0],keeperColor:'#f03543'},{...kits[1],keeperColor:'#303349'}];
      // Keeper colours must stand apart from BOTH outfield kits.
      const pool=['#f03543','#303349','#24d4b5','#ff8a00','#b14dff','#c8ff3a'];
      for(const t of teams){if(Math.min(...teams.map(o=>SoccerCore.colorGap(o.shirt,t.keeperColor)))<220)t.keeperColor=pool.find(c=>teams.every(o=>SoccerCore.colorGap(o.shirt,c)>=220)&&c!==teams.find(x=>x!==t).keeperColor)||'#24d4b5';}
      for(let i=0;i<8;i++){
        const m=model(teams[i<4?0:1],i%4,i%4===3);m.scale.setScalar(1.215);m.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.playerGroup.add(m);this.models.push(m);
        const shadow=this.shadow(.85);this.playerGroup.add(shadow);this.shadows.push(shadow);
        // Team ring on the grass: tells the sides apart at a glance from the high camera.
        const kit=teams[i<4?0:1],ring=new T.Mesh(new T.RingGeometry(.7,.98,28),new T.MeshBasicMaterial({color:i%4===3?kit.keeperColor:kit.shirt,transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide}));
        ring.rotation.x=-Math.PI/2;ring.position.y=.05;this.playerGroup.add(ring);this.teamRings.push(ring);
      }
      this.trailHistory=[];
    }
    thumbnail(id) {
      const team={...SoccerCore.TEAMS[id],keeperColor:'#d82235'},s=new T.Scene();
      const cam=new T.OrthographicCamera(-1.6,1.6,2.7,-.5,.1,20);cam.position.set(3,3,6);cam.lookAt(0,1.1,0);
      s.add(new T.HemisphereLight('#ffffff','#6a91a0',2.5));const sun=new T.DirectionalLight('#fff5dc',2);sun.position.set(-3,5,4);s.add(sun);
      const m=model(team,id%4);m.rotation.y=-.2;s.add(m);
      const oldColor=this.renderer.getClearColor(new T.Color()),oldAlpha=this.renderer.getClearAlpha(),oldSize=this.renderer.getSize(new T.Vector2()),oldPixel=this.renderer.getPixelRatio();
      this.renderer.setPixelRatio(1);this.renderer.setSize(144,144,false);this.renderer.setClearColor('#000000',0);this.renderer.render(s,cam);
      const url=this.canvas.toDataURL('image/png');this.renderer.setClearColor(oldColor,oldAlpha);this.renderer.setPixelRatio(oldPixel);this.renderer.setSize(oldSize.x,oldSize.y,false);
      m.traverse(o=>{if(o.geometry&&o.geometry!==cubeGeo)o.geometry.dispose();});return url;
    }
    setQuality(level) {
      this.quality=level;
      const fit=Math.min(window.innerWidth/1280,window.innerHeight/720),native=Math.max(.75,fit*(window.devicePixelRatio||1));
      const ratio=[Math.min(.8,native),Math.min(1.15,native),Math.min(2,Math.max(1,native))][level];
      if(this.renderer.getPixelRatio()!==ratio||this.renderer.domElement.width!==Math.floor(1280*ratio)){this.renderer.setPixelRatio(ratio);this.renderer.setSize(1280,720,false);}
      this.renderer.shadowMap.enabled=level===2;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.rain.count=[150,260,420][level];this.snow.geometry.setDrawRange(0,[320,640,1100][level]);
    }
    setEnvironment(weather,night) {
      this.weather=weather;this.night=night;
      this.renderer.setClearColor(night?'#101d42':weather==='SNOW'?'#9ab9d1':weather==='RAIN'?'#728fab':'#65bfff');
      this.hemi.color.set(night?'#bed7ff':weather==='SUNNY'?'#f9fcff':'#eaf6ff');this.hemi.intensity=night?1.15:1.4;this.hemi.groundColor.set(night?'#476a99':'#7e98c1');
      this.fill.intensity=night?.18:.55;this.sun.intensity=night?.35:weather==='SUNNY'?1.55:1.1;
      this.sun.color.set(night?'#99baff':'#fff6d0');
      this.floodlights.forEach(l=>l.intensity=night?65:0);this.glows.forEach(g=>{g.material.opacity=night?.9:.35;});
      this.pitchMaterial.color.set(weather==='SNOW'?'#d8edf0':weather==='RAIN'?'#c3e1d1':night?'#c4e7dd':'#ffffff');
      this.rain.visible=weather==='RAIN';this.snow.visible=weather==='SNOW'||weather==='WIND';
      this.snowSurface.visible=weather==='SNOW';this.wetSurface.visible=weather==='RAIN';
      this.snow.material.color.set(weather==='WIND'?'#e4ed9b':'#ffffff');this.snow.material.size=weather==='WIND'?.65:1.35;
      this.scene.fog=new T.Fog(night?'#142346':weather==='SNOW'?'#c0dceb':'#72bcff',weather==='SUNNY'?160:115,230);
    }
    // Firework shell bursting in the sky: a sphere of sparks in the given colours.
    firework(x,y,z,colors,count=48) {
      let made=0;
      for(const p of this.particles){if(p.life>0)continue;
        const u=Math.random()*2-1,a=Math.random()*TAU,r=Math.sqrt(1-u*u),sp=5+Math.random()*3.5;
        p.life=p.max=1.1+Math.random()*.7;p.m.visible=true;p.m.position.set(x,y,z);p.m.scale.setScalar(.3+Math.random()*.2);p.m.material.color.set(colors[made%colors.length]);
        p.vx=Math.cos(a)*r*sp;p.vz=Math.sin(a)*r*sp;p.vy=u*sp+3;
        if(++made>=Math.min(count,[24,40,60][this.quality]))break;
      }
    }
    // Lazily built celebration props: golden cup and the light beam it descends in.
    buildTrophy(){
      if(this.trophy)return;
      const gold=new T.MeshPhongMaterial({color:'#f7b81e',emissive:'#5a3600',specular:'#fff4c4',shininess:120}),g=new T.Group();
      const prof=[[0,0],[.55,0],[.55,.12],[.22,.2],[.16,.55],[.2,.75],[.42,.95],[.62,1.35],[.66,1.7],[.6,1.72],[.0,1.6]].map(([x,y])=>new T.Vector2(x,y));
      const cup=new T.Mesh(new T.LatheGeometry(prof,28),gold);g.add(cup);
      for(const s of [-1,1]){const h=new T.Mesh(new T.TorusGeometry(.32,.07,10,20,Math.PI*1.2),gold);h.position.set(s*.62,1.32,0);h.rotation.z=s>0?-Math.PI*.6:Math.PI*1.6;g.add(h);}
      const base=new T.Mesh(new T.BoxGeometry(.9,.22,.9),new T.MeshLambertMaterial({color:'#3a2a12'}));base.position.y=.05;g.add(base);
      g.scale.setScalar(1.25);g.visible=false;this.scene.add(g);this.trophy=g;
      const beam=new T.Mesh(new T.CylinderGeometry(1.1,2.8,18,32,1,true),new T.MeshBasicMaterial({color:'#fff2a8',transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));
      beam.visible=false;this.scene.add(beam);this.beam=beam;
      // Key light that makes the gold sparkle, plus a glint sprite that sweeps across the cup.
      this.trophyLight=new T.PointLight('#fff2cc',60,14,1.6);this.trophyLight.visible=false;this.scene.add(this.trophyLight);
      this.glint=new T.Sprite(new T.SpriteMaterial({map:radial,color:'#ffffff',transparent:true,depthWrite:false,blending:T.AdditiveBlending}));this.glint.visible=false;this.scene.add(this.glint);
      // Sunburst as a real 3D backdrop: it sits BEHIND the players and the cup.
      const sun=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);c.translate(w/2,h/2);const n=22;for(let i=0;i<n;i++){c.rotate(Math.PI*2/n);c.beginPath();c.moveTo(0,0);c.lineTo(w*.75,-w*.07);c.lineTo(w*.75,w*.07);c.closePath();c.fillStyle='rgba(255,246,200,.9)';c.fill();}
        c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-in';const g2=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g2.addColorStop(0,'rgba(0,0,0,1)');g2.addColorStop(.35,'rgba(0,0,0,.7)');g2.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g2;c.fillRect(0,0,w,h);
        c.globalCompositeOperation='source-over';const g3=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.16);g3.addColorStop(0,'rgba(255,250,220,1)');g3.addColorStop(1,'rgba(255,240,170,0)');c.fillStyle=g3;c.fillRect(0,0,w,h);},512,512);
      this.sunburst=new T.Mesh(new T.PlaneGeometry(38,38),new T.MeshBasicMaterial({map:sun,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.sunburst.visible=false;this.sunburst.renderOrder=-1;this.scene.add(this.sunburst);
    }
    burst(x,z,color,count=18,force=1) {
      let made=0;
      for(const p of this.particles){if(p.life>0)continue;const angle=Math.random()*TAU;
        p.life=p.max=.35+Math.random()*.55;p.m.visible=true;p.m.position.set(x,.5,z);p.m.scale.setScalar(.12+Math.random()*.14);p.m.material.color.set(color);
        p.vx=Math.cos(angle)*(2+Math.random()*4)*force;p.vz=Math.sin(angle)*(2+Math.random()*4)*force;p.vy=2+Math.random()*6;
        if(++made>=Math.min(count,[18,45,90][this.quality]))break;
      }
    }
    onEvent(e) {
      if(e.type==='super'){this.burst(e.x,e.z,'#fff37c',36,1.2);this.shake=Math.max(this.shake,.28);}
      if(e.type==='shot'){this.burst(e.x,e.z,'#dcffb3',8,.6);this.shake=Math.max(this.shake,.06);}
      if(['tackle','impact','post','save'].includes(e.type)){this.burst(e.x,e.z,e.type==='save'?'#67faff':'#ffdd5f',e.parry?26:15,e.parry?1.2:1);this.shake=Math.max(this.shake,e.parry?.22:e.type==='impact'?.2:.1);}
      if(e.type==='goal'){
        this.burst(e.x,e.z,e.super?'#fff19a':'#ffd935',e.super?100:75,e.super?2.8:2);this.shake=e.super?.85:.38;
        const waves=e.super?3:1;for(let i=0;i<waves;i++){const wave=this.shockwaves.find(w=>w.life<=0);if(wave){wave.life=1+i*.14;wave.m.visible=true;wave.m.position.set(e.x,.12,e.z);wave.m.scale.setScalar(1+i*.7);wave.m.material.color.set(i%2?'#67eaff':'#ffe94c');}}
      }
      if(e.type==='net'){this.burst(e.x,e.z,'#f1ffff',12,.3);this.shake=Math.max(this.shake,.08);}
      if(e.type==='pass')this.burst(e.x,e.z,'#b9ffff',5,.4);
      if(e.type==='slide')this.burst(e.x,e.z,'#5fd14a',10,.7);
      if(e.type==='skill')this.burst(e.x,e.z,'#7df8ff',14,.8);
      if(e.type==='playerko'){this.burst(e.x,e.z,'#fff07a',40,1.6);this.shake=Math.max(this.shake,.45);}
      if(e.type==='keeperko'){this.burst(e.x,e.z,'#fff07a',45,1.8);this.burst(e.x,e.z,'#ffffff',22,1.2);this.shake=Math.max(this.shake,.55);this.goalWobble[e.x>0?1:0]=1.3;}
      if(e.type==='goal'&&e.super)this.goalWobble[e.team===0?1:0]=1.8;
      if(e.type==='usersave'){this.burst(e.x,e.z,'#ffef4a',20,1);this.shake=Math.max(this.shake,.12);}
    }
    render(match,dt,paused=false) {
      if(!paused)this.time+=dt;
      const crowdBob=Math.sin(this.time*3)*.035;this.crowdRoots.forEach(m=>m.position.y=crowdBob);
      if(match&&this.models.length){
        const koPlayers=[];
        match.players.forEach((p,i)=>{
          const m=this.models[i],speed=Math.hypot(p.vx,p.vz),celebrate=match.goalDelay>0&&match.goalBall?.team===p.team;
          const bob=paused?0:celebrate?Math.abs(Math.sin(this.time*8+p.phase))*.23:Math.sin(this.time*18+p.phase)*Math.min(speed*.011,.055);
          m.position.set(p.x,.035+bob,p.z);
          const target=Math.atan2(p.fx,p.fz),dif=Math.atan2(Math.sin(target-m.rotation.y),Math.cos(target-m.rotation.y));m.rotation.y+=dif*Math.min(1,dt*16);
          let dive=0;
          if(p.keeper&&p.dive>0){const progress=1-p.dive;dive=progress<.25?Math.sin(progress/.25*Math.PI/2):progress<.58?1:Math.cos((progress-.58)/.42*Math.PI/2);}
          const kicking=p.kickTime>0?Math.sin((1-p.kickTime/p.kickDuration)*Math.PI):0,power=p.kickKind==='super'?1.6:p.kickKind==='pass'?.7:1;
          const winding=(match.charging&&match.controlled===p.id)||p.aiCharge>0;
          m.scale.set(1.215*(1+kicking*.07),1.215*(1-kicking*.06),1.215*(1+kicking*.07));
          m.userData.body.rotation.x=dive?0:winding?-.18:Math.sin(this.time*18+p.phase)*speed*.002+kicking*.29*power;
          m.userData.body.rotation.y=dive?0:kicking*power*.18;
          m.userData.body.rotation.z=dive*p.diveDir*((p.fx||0)>=0?1:-1)*1.34+(dive?0:p.stun>0?Math.sin(this.time*30)*.1:Math.sin(this.time*14+p.phase)*speed*.004);
          m.userData.body.position.y=dive*.58;
          m.userData.body.position.z=dive?0:kicking*.16*power-(winding?.07:0);
          m.userData.arms.forEach((a,j)=>{a.rotation.x=dive?-.6:winding?-.55:kicking*(j===0?-.7:.85)*power+Math.sin(this.time*16+p.phase+j*Math.PI)*Math.min(.35,speed*.05);a.rotation.z=dive*(j===0?.45:-.45);});
          // Slide tackle (lean back, feet first), floored players (face down) and skill-move spins.
          const ud=m.userData,slideT=(p.slide||0)>0?1:0,downT=(p.down||0)>0?1:0;
          ud.slideK=(ud.slideK||0)+(slideT-(ud.slideK||0))*Math.min(1,dt*(paused?0:18));
          ud.downK=(ud.downK||0)+(downT-(ud.downK||0))*Math.min(1,dt*(paused?0:(downT?16:7)));
          if(ud.slideK>.01){ud.body.rotation.x=-1.12*ud.slideK;ud.body.position.y=.12*ud.slideK;ud.body.position.z=0;ud.arms.forEach((a,j)=>{a.rotation.x=-1.9*ud.slideK;a.rotation.z=(j?-.5:.5)*ud.slideK;});}
          if(ud.downK>.01){ud.body.rotation.x=1.42*ud.downK;ud.body.position.y=.48*ud.downK;ud.body.rotation.z=0;ud.arms.forEach(a=>{a.rotation.x=-2.6*ud.downK;});}
          if((p.skill||0)>0){ud.body.rotation.y=(1-p.skill/SoccerCore.SKILL_TIME)*Math.PI*2*(p.skillDir||1);}
          if((p.ko||0)>0&&!p.koFlip){
            // Dazed keeper: wobbles on his feet under the stars.
            ud.body.rotation.set(.12,0,Math.sin(this.time*9)*.22);ud.body.position.set(0,0,0);ud.arms.forEach((a,j)=>{a.rotation.x=-.3;a.rotation.z=(j?-1:1)*(.5+Math.sin(this.time*9+j)*.3);});
            koPlayers.push(p);
          } else if((p.ko||0)>0){
            // Backflip, then flat on his back until the stars fade.
            const t=(p.koTotal||2.6)-p.ko,flip=Math.min(1,t/.55);
            ud.body.rotation.set(-(flip*Math.PI*2+flip*1.45),0,0);
            ud.body.position.set(0,Math.sin(flip*Math.PI)*1.7+flip*.5,0);
            ud.arms.forEach((a,j)=>{a.rotation.x=-2.8;a.rotation.z=(j?-.6:.6);});
            koPlayers.push(p);
          }
          if(match.celebrate&&p.team===0){
            // Champions: the whole team jumps for joy, arms up; the captain lifts the cup.
            const c=match.celebrate,jumpOn=c.t>2.4,ph=c.t*7.5+i*1.3,jump=jumpOn?Math.abs(Math.sin(ph))*(i===0?.9:1.4):0;
            m.position.y=.035+jump;m.rotation.y=0;ud.body.rotation.set(0,0,jumpOn?Math.sin(ph)*.12:0);ud.body.position.set(0,0,0);
            ud.arms.forEach((a,j)=>{a.rotation.x=-.3;a.rotation.z=(j?1:-1)*(2.45+(jumpOn?Math.sin(ph+j)*.3:0));});
            if(i===0)c.captainY=jump;
          }
          if(match.celebrate&&p.team===1)m.visible=false;else m.visible=true;
          this.shadows[i].position.set(p.x,.04,p.z);if(this.teamRings&&this.teamRings[i])this.teamRings[i].position.set(p.x,.05,p.z);
        });
        this.stars.forEach((st,n)=>{const koPlayer=koPlayers[Math.floor(n/5)],i=n%5;st.visible=!!koPlayer&&(!koPlayer.koFlip||((koPlayer.koTotal||2.6)-koPlayer.ko)>.5);if(!st.visible)return;
          const off=koPlayer.koFlip?1.3:0,a=this.time*5+i*Math.PI*2/5,hx=koPlayer.x-(koPlayer.fx||0)*off,hz=koPlayer.z-(koPlayer.fz||0)*off;
          st.position.set(hx+Math.cos(a)*(koPlayer.koFlip?1.15:.9),(koPlayer.koFlip?2.3:3.5)+Math.sin(a*2)*.18,hz+Math.sin(a)*(koPlayer.koFlip?1.15:.9));st.material.opacity=Math.min(1,koPlayer.ko*1.5);st.material.rotation=a;});
        const b=match.ball;this.ballGroup.position.set(b.x,b.y,b.z);
        const carrier=b.owner!==null?match.players[b.owner]:null,rollX=carrier?carrier.vx:b.vx,rollZ=carrier?carrier.vz:b.vz,rollSpeed=Math.hypot(rollX,rollZ);
        const slow=match.goalBall&&match.goalBall.age<(match.goalBall.superShot?1.15:.85)?(match.goalBall.superShot?.18:.25):1;
        if(rollSpeed>.02&&!paused){this.rollAxis.set(rollZ,0,-rollX).normalize();this.rollQuaternion.setFromAxisAngle(this.rollAxis,rollSpeed*dt*slow/SoccerCore.BALL_RADIUS);this.ballMesh.quaternion.premultiply(this.rollQuaternion);}
        this.ballGlow.material.opacity=b.super>0?.55:match.goalBall?.superShot&&match.goalBall.age<1.3?.4:0;
        this.ballShadow.position.set(b.x,.045,b.z);this.ballShadow.scale.setScalar(1+Math.max(0,b.y-.34)*.2);
        const p=match.players[match.controlled];this.ring.visible=this.marker.visible=!match.replay&&!match.penalty;this.ring.position.set(p.x,.06,p.z);this.ring.material.color.set(match.charging?'#fff048':'#62f8ff');this.ring.scale.setScalar(1+Math.sin(this.time*6)*.04);
        this.marker.position.set(p.x,3.3+Math.sin(this.time*4)*.1,p.z);this.marker.rotation.z=Math.PI;
        const userBall=!match.replay&&match.ball.owner===p.id&&match.goalDelay<=0&&!match.end&&!match.autoPlay;
        let target=null;
        if(userBall&&!match.charging&&match.choosePassTarget)target=match.choosePassTarget(p);
        else if(!match.replay&&match.userKeeperHolds&&match.userKeeperHolds()&&match.goalDelay<=0)target=match.choosePassTarget(match.players[3]);
        this.passMarker.visible=this.passRing.visible=!!target;
        if(target){this.passMarker.position.set(target.x,3.5+Math.sin(this.time*6)*.15,target.z);this.passMarker.rotation.set(Math.PI,this.time*3,0);this.passRing.position.set(target.x,.07,target.z);}
        const aiming=userBall&&match.charging&&match.aimFor;
        if(aiming){
          const aim=match.aimFor(p),sx=match.ball.x,sz=match.ball.z,len=Math.min(Math.hypot(aim.x-sx,aim.z-sz),16+match.charge*10),dx=(aim.x-sx)/(Math.hypot(aim.x-sx,aim.z-sz)||1),dz=(aim.z-sz)/(Math.hypot(aim.x-sx,aim.z-sz)||1);
          const superShot=match.charge>=1.12,scroll=(this.time*2.2)%1;
          this.aimDots.forEach((d,i)=>{const t=(i+scroll)/this.aimDots.length,dist=1.2+t*len;d.visible=dist<len+1.2;d.position.set(sx+dx*dist,.09,sz+dz*dist);d.material.color.set(superShot?'#ffd23a':match.charge>1.45?'#ff6a6a':'#eaffff');d.material.opacity=.95*(1-t*.55);d.scale.setScalar(superShot?1.25:1);});
        } else this.aimDots.forEach(d=>d.visible=false);
        const save=!match.replay&&match.saveWindow&&match.saveWindow();
        this.saveRing.visible=!!save;if(save){const k=match.players[3];this.saveRing.position.set(k.x,.08,k.z);this.saveRing.scale.setScalar(1+Math.sin(this.time*20)*.12);}
        if(match.sprintActive&&!paused&&Math.floor(this.time*40)%2===0)this.burst(p.x-p.fx*.5,p.z-p.fz*.5,'#d9f7c5',1,.25);
        this.trailHistory.unshift(new T.Vector3(b.x,b.y,b.z));if(this.trailHistory.length>24)this.trailHistory.pop();
        const speed=Math.hypot(b.vx,b.vz),active=b.owner===null&&speed>13;
        this.trail.forEach((m,i)=>{
          m.visible=active&&i<this.trailHistory.length&&i<(b.super>0?24:12);if(!m.visible)return;
          m.position.copy(this.trailHistory[i]);m.material.color.set(b.super>0?'#ffed66':'#c0f8ff');m.material.opacity=(1-i/24)*(b.super>0?.6:.26);m.scale.setScalar((1-i/27)*(b.super>0?1.15:.55));
        });
        if(match.charging && Math.floor(this.time*30)%3===0&&!paused)this.burst(p.x,p.z,match.charge>=1.12?'#ffdd2b':'#5beeff',1,.3);
      }
      this.particles.forEach(p=>{
        if(p.life<=0)return;p.life-=dt;p.m.visible=p.life>0;p.m.position.x+=p.vx*dt;p.m.position.z+=p.vz*dt;p.m.position.y+=p.vy*dt;p.vy-=12*dt;
        if(p.m.position.y<.05){p.m.position.y=.05;p.vy=-p.vy*.3;}p.m.rotation.x+=dt*4;p.m.rotation.z+=dt*3;p.m.material.opacity=Math.max(0,p.life/p.max);
      });
      this.shockwaves.forEach(w=>{if(w.life<=0)return;w.life-=dt;w.m.visible=w.life>0;w.m.scale.multiplyScalar(1+dt*2.5);w.m.material.opacity=Math.max(0,w.life)*.65;});
      if(!paused&&this.weather!=='SUNNY') {
        const count=this.rain.visible?this.rain.count:[320,640,1100][this.quality],snow=this.weather==='SNOW',wind=this.weather==='WIND',dummy=this.weatherDummy;
        const positions=this.snow.geometry.attributes.position.array;
        for(let i=0;i<count;i++){
          const p=this.weatherSeeds[i];p.y-=dt*(snow?2.6:wind?1:28);p.x+=dt*(snow?.7:wind?7:0);
          if(p.y<.1)p.y+=22;if(p.x>32)p.x-=64;
          if(this.rain.visible){dummy.position.set(p.x,p.y,p.z);dummy.quaternion.copy(this.camera.quaternion);dummy.scale.set(p.width,p.length,1);dummy.updateMatrix();this.rain.setMatrixAt(i,dummy.matrix);}
          else {const n=i*3;positions[n]=p.x+Math.sin(this.time*1.4+p.phase)*.5;positions[n+1]=p.y;positions[n+2]=p.z;}
        }
        if(this.rain.visible){this.rain.instanceMatrix.needsUpdate=true;this.puddleSpots.forEach(([x,z,w,d],i)=>{const progress=(this.time*.75+i*.371)%1;dummy.position.set(x+Math.sin(i*7)*w*.4,.044,z+Math.cos(i*13)*d*.4);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(.25+progress*2.3);dummy.updateMatrix();this.waterRipples.setMatrixAt(i,dummy.matrix);});this.waterRipples.instanceMatrix.needsUpdate=true;}
        else this.snow.geometry.attributes.position.needsUpdate=true;
      }
      // Super Shot impact: the goal frame wobbles like jelly and the net flashes.
      this.goalGroups.forEach((G,i)=>{
        const w=this.goalWobble[i],base=match&&match.penalty&&i===1?1.1:1; // penalty goal is 10% bigger
        if(w>0){if(!paused)this.goalWobble[i]=Math.max(0,w-dt);const amp=.2*Math.min(1,w/1.2),t=this.time;
          const sx=base*(1+amp*Math.sin(t*31)),sy=base*(1-amp*.9*Math.sin(t*27+1.1)),sz=base*(1+amp*.7*Math.sin(t*23+2.3));
          G.g.scale.set(sx,sy,sz);G.g.position.set(G.x-sx*G.x,0,0);G.net.material.color.set(Math.sin(t*20)>0?'#fff27a':'#f2f8ff');}
        else if(G.g.scale.x!==base||G.g.scale.y!==base){G.g.scale.set(base,base,base);G.g.position.set(G.x-base*G.x,0,0);G.net.material.color.set('#f2f8ff');}
      });
      this.shake=Math.max(0,this.shake-dt*1.3);
      if(match?.celebrate){
        this.buildTrophy();const c=match.celebrate,cap=match.players[0];
        const hold=3.3+(c.captainY||0),fall=Math.min(1,c.t/2.4),ease=1-Math.pow(1-fall,3);
        this.trophy.visible=true;this.trophy.position.set(cap.x,14+(hold-14)*ease,cap.z+.15);this.trophy.rotation.y=c.t*(fall<1?3:1.2);
        this.beam.visible=c.t<4.2;this.beam.position.set(cap.x,9+3.05,cap.z);this.beam.material.opacity=.3*Math.min(1,c.t*2)*Math.max(0,Math.min(1,(4.2-c.t)/1.2));
        this.sunburst.visible=true;this.sunburst.position.set(0,4.2,-8);this.sunburst.rotation.set(0,0,c.t*.25);this.sunburst.material.opacity=Math.min(.6,Math.max(0,(c.t-.4)*.6));
        this.trophyLight.visible=true;this.trophyLight.position.set(this.trophy.position.x+2.2,this.trophy.position.y+2.6,this.trophy.position.z+3.5);
        const gl=(c.t*.6)%1;this.glint.visible=gl<.35;if(this.glint.visible){this.glint.position.set(this.trophy.position.x-.7+gl*4,this.trophy.position.y+1.5+Math.sin(gl*9)*.3,this.trophy.position.z+.9);this.glint.scale.setScalar(1.6*Math.sin(gl/.35*Math.PI));}
        const orbit=Math.sin(c.t*.22)*4;if(this.camera.fov!==34){this.camera.fov=34;this.camera.updateProjectionMatrix();}
        this.camera.position.set(orbit,3.6,17.5);this.camera.lookAt(0,3.7,0);
        this.ring.visible=this.marker.visible=this.passMarker.visible=this.passRing.visible=this.saveRing.visible=false;this.aimDots.forEach(d=>d.visible=false);
        this.renderer.render(this.scene,this.camera);return;
      }
      if(this.trophy){this.trophy.visible=false;this.beam.visible=false;this.sunburst.visible=false;this.trophyLight.visible=false;this.glint.visible=false;}
      if(match?.penalty){
        // Penalty shootout: broadcast camera behind the taker, keeper in front.
        this.ballMesh.scale.setScalar(.9); // penalty ball 10% smaller
        const c=match.penalty.cam;if(this.camera.fov!==c.fov){this.camera.fov=c.fov;this.camera.updateProjectionMatrix();}
        this.camera.position.set(c.x,c.y,c.z);this.camera.lookAt(c.lx,c.ly,c.lz);
        if(this.shake>0&&!paused){this.camera.position.y+=(Math.random()-.5)*this.shake*.5;this.camera.position.z+=(Math.random()-.5)*this.shake*.5;}
        const tg=match.penalty.target;this.penTarget.visible=!!tg&&tg.visible;
        if(this.penTarget.visible){this.penTarget.position.set(24.05,tg.y,tg.z);this.penTarget.material.color.set(tg.color||'#ffe94c');this.penTarget.scale.setScalar(1+Math.sin(this.time*12)*.06);}
        this.renderer.render(this.scene,this.camera);return;
      }
      this.penTarget.visible=false;if(this.ballMesh.scale.x!==1)this.ballMesh.scale.setScalar(1);
      if(this.camera.fov!==20){this.camera.fov=20;this.camera.updateProjectionMatrix();}
      if(match?.replay){const center=SoccerCore.clamp(match.ball.x*.35,-8,8);this.camera.position.set(center,55,59);this.camera.lookAt(center,0,0);}
      else{this.camera.position.copy(this.baseCamera);this.camera.lookAt(0,0,0);if(this.shake>0&&!paused){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.z+=(Math.random()-.5)*this.shake;}}
      this.renderer.render(this.scene,this.camera);
    }
  }
  window.SoccerView=View;
})();
