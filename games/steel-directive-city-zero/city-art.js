/* All actors are supplied raster artwork. Frames are exported at a shared floor anchor. */
const CITY_RATES={idle:6,run:12,jump:14,fall:10,shoot:14,reload:5,dodge:26,hit:12,death:7};
function cityPose(image,frames,state,phase,x,feet,face=1,scale=1){
 if(!image?.complete||!image.naturalWidth)return;
 const list=frames[state]||frames.idle;let index=Math.floor(phase*(CITY_RATES[state]||8));
 index=['idle','run'].includes(state)?index%list.length:Math.min(index,list.length-1);
 const r=list[Math.max(0,index)];ctx.save();ctx.translate(x,feet);ctx.scale(face*scale,scale);ctx.drawImage(image,...r,-96,-150,192,160);ctx.restore();
}
function cityCutout(key,x,feet,height,face=1,lean=0,opacity=1){
 const img=assets[key];if(!img?.complete||!img.naturalWidth)return;const width=height*img.naturalWidth/img.naturalHeight;
 ctx.save();ctx.globalAlpha*=opacity;ctx.translate(x,feet);ctx.scale(face,1);if(lean)ctx.rotate(lean);ctx.drawImage(img,-width*.5,-height,width,height);ctx.restore();
}
function drawCityBoss(e,x,feet){
 ellipse(x,feet+2,e.w*.55,5,'#0008');
 const key='boss'+BOSS_ROSTER[e.bossId-1].art;
 const state=e.death?'death':e.hit>0?'hit':['windup','attack','recover'].includes(e.phase)?'shoot':Math.abs(e.vx)>5?'run':'idle';
 const clock=e.phase==='windup'?0:e.phase==='attack'?.14+e.phaseTime:e.phase==='recover'?.48:e.animTime||0;
 drawGenerated(key,state,clock,x,feet,e.face,e.h+22);
}
function drawGenerated(key,state,clock,x,feet,face,height){
 const def=GENERATED_ATLAS[key],image=assets[key];if(!def||!image?.complete||!image.naturalWidth)return;
 const list=def.frames[state]||def.frames.idle||def.frames.shoot;
 let i=Math.floor(clock*(state==='run'?10:state==='death'?6:state==='idle'?5:8));i=['run','idle'].includes(state)?i%list.length:Math.min(i,list.length-1);
 const r=list[Math.max(0,i)],scale=height/def.nativeHeight;
 ctx.save();ctx.translate(x,feet);ctx.scale(face*scale,scale);ctx.drawImage(image,...r,-def.anchor[0],-def.anchor[1],r[2],r[3]);ctx.restore();
}
function drawTacticalWalk(key,clock,x,feet,face,height){
 const waist=feet-height*.47;
 ctx.save();ctx.beginPath();ctx.rect(x-height,waist,height*2,height);ctx.clip();drawGenerated(key,'run',clock,x,feet,face,height);ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(x-height,feet-height*1.15,height*2,height*.68);ctx.clip();drawGenerated(key,'idle',0,x,feet,face,height);ctx.restore();
}
function drawCityActor(o,enemy=false,title=false){
 if(title){cityCutout('portrait',W*.77,646,510,1);return;}
 if(o.x-camera<-230||o.x-camera>W+230)return;
 if(enemy&&o.bossId){drawWarden(o);return;}
 const x=o.x-camera+o.w/2,feet=o.y+o.h;
 ellipse(x,feet+2,o.w*.65,4,'#0008');ctx.save();
 if(!enemy&&o.inv>0&&Math.floor(time*16)%2)ctx.globalAlpha=.5;
 if(!enemy){let state=o.anim||'idle',phase=o.animTime||0;
  if(state==='reload'&&o.reloadTotal)phase=(1-o.reload/o.reloadTotal)*CITY_PLAYER.reload.length/CITY_RATES.reload;
  if(o.ground&&Math.abs(tacticalMission()?o.motionSpeed:o.vx)>10&&(state==='shoot'||tacticalMission()&&state==='reload')){state='run';phase=time;}
  if(tacticalMission()&&state==='run')phase=(o.gaitDistance||0)/110*CITY_PLAYER.run.length/CITY_RATES.run;
  if(tacticalMission()&&state==='shoot')phase=o.shotAge||0;
  if(tacticalMission()&&(o.crouching||['run','idle'].includes(state))){const pose=o.crouching?(o.shootTime>0?'crouchFire':'crouch'):state;const clock=o.crouching&&o.shootTime>0?(o.shotAge||0):state==='run'?(o.gaitDistance||0)/110*.8:0;if(pose==='run')drawTacticalWalk('player-tactical',clock,x,feet,o.face||1,121);else drawGenerated('player-tactical',pose,clock,x,feet,o.face||1,121);}else cityPose(assets.enforcer,CITY_PLAYER,state,phase,x,feet,o.face||1,1.12);
 }else if(o.tacticalRole){
  const art={gunman:'street-gunman',shotgun:'street-shotgun',grenadier:'street-grenadier',sniper:'street-shotgun',heavy:'street-shotgun'}[o.tacticalRole];
  let state=o.death?'death':o.hit>0?'hit':o.shootTime>0?'shoot':o.phase==='reload'?'reload':o.phase==='windup'?'idle':Math.abs(o.motionSpeed||0)>10?'run':'idle';
  {if(o.isCaptain)ctx.filter='saturate(.45) brightness(.85)';if(o.death)ctx.globalAlpha*=Math.max(0,Math.min(1,(8-o.animTime)/2));
   const moving=state==='run',key=moving||state==='reload'||state==='idle'&&o.phase!=='windup'?art+'-walk':state==='death'?art+'-fall':art;
   const clock=moving?(o.gaitDistance||0)/85*.8:state==='shoot'?(o.shotAge||0):o.animTime||0;
   if(moving)drawTacticalWalk(key,clock,x,feet,o.face,o.h+10);else drawGenerated(key,state,clock,x,feet,o.face,o.h+10);}
 }else if(o.pack){
  const key={shield:'boss2',gatling:'black-heavy',hound:'boss4',berserker:'boss3'}[o.pack];
  const state=o.death?'death':o.hit>0?'hit':o.specialTime>0||o.shootTime>0?'shoot':o.reload>0&&o.pack==='gatling'?'reload':Math.abs(o.vx)>10?'run':'idle';
  drawGenerated(key,state,o.animTime||0,x,feet,o.face,o.h+16);
 }else{
  const state=o.death?'death':o.hit>0?'hit':o.reload>0?'reload':o.shootTime>0?'shoot':Math.abs(o.vx)>10?'run':'idle';
  if(['idle','run'].includes(state))cityPose(assets.sentinel,CITY_ENEMY,state,o.animTime||0,x,feet,o.face||1,o.h/100);
  else drawGenerated('gray-combat',state,o.animTime||0,x,feet,o.face,o.h+10);
 }
 ctx.restore();
 if(enemy&&!o.death){if(o.hp<o.max){rect(x-22,o.y-13,44,3,'#14202c');rect(x-22,o.y-13,44*o.hp/o.max,3,'#fc6b8a');}if(o.windup>0)label('!',x,o.y-20,19,'#ffd995','center');if(o.pack==='shield'&&o.blockFlash>0)glow(x+o.face*20,o.y+35,28,'#6cdcff66');}
 if(!enemy&&o.shield>0){ctx.strokeStyle='#81e5ffbb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,feet-48,43,63,0,0,Math.PI*2);ctx.stroke();}
}
