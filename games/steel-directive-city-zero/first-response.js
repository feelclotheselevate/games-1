/* Mission-one tactical trial. Later missions keep their existing rules. */
'use strict';
const FirstResponse={
 state:null,
 setup(){
  world=3500;LEVELS[0].name='First Response';
  this.state={rescued:false,relay:false,scanned:false,bossDown:false,scanUntil:0,scanReady:0,exposedUntil:0,grenades:[],civilianX:1390,rescueTime:0};
  platforms=[{x:0,y:620,w:world,h:130,ground:true},{x:795,y:545,w:70,h:20,oneWay:true},{x:840,y:465,w:260,h:24,oneWay:true}];
  platforms.push(...[{x:1808,y:349,w:288},{x:2152,y:347,w:288},{x:2510,y:348,w:350}].map(p=>({...p,h:12,oneWay:true,authoredBalcony:true,projectilePassThrough:true})));
  covers=[390,740,1160,1670,2180,2720,3100].map(x=>({x,y:562,w:74,h:58,hp:600,max:600}));
  flags=[{x:1680,y:620,active:false},{x:2820,y:620,active:false}];
  traps=[];pickups=[];enemies=[];
  const spawn=(x,type,options={})=>{
   const e=Object.assign(actor(x,526),{tacticalRole:type,phase:'idle',phaseTime:0,cooldown:1,alert:false,face:-1,home:x,rounds:0},options);
   const hp={gunman:48,shotgun:80,grenadier:65,sniper:60,heavy:300}[type];e.hp=e.max=hp;e.h=type==='heavy'?110:94;e.y=620-e.h;
   if(options.floor!==undefined){e.y=options.floor-e.h;e.balcony=true;}
   if(type==='heavy'){e.isCaptain=true;e.name='GANG LEADER / ARMORED';e.w=53;}
   enemies.push(e);return e;
  };
  spawn(570,'gunman');spawn(865,'sniper',{floor:465});spawn(1250,'shotgun');
  spawn(1590,'gunman');spawn(1920,'grenadier');spawn(1850,'sniper',{floor:349});spawn(2200,'sniper',{floor:347});spawn(2560,'sniper',{floor:348});
  spawn(2480,'shotgun');spawn(2860,'gunman');spawn(3150,'heavy');
  addPickup(260,583,'weapon','rifle');addPickup(1090,583,'ammo');addPickup(1460,583,'health');
  addPickup(1730,583,'ammo');addPickup(1765,583,'health');addPickup(2250,583,'weapon','shotgun');
  addPickup(2590,583,'grenade');addPickup(2850,583,'health');addPickup(2885,583,'ammo');
  addPickup(1030,430,'secret');
  player.crouching=false;player.h=94;player.y=526;player.tacticalCover=false;
  document.querySelector('#stage').dataset.mission='tactical';
 },
 reset(){this.state=null;document.querySelector('#stage').dataset.mission='campaign';},
 snapshot(){const s=this.state;return s?{rescued:s.rescued,relay:s.relay,scanned:s.scanned,bossDown:s.bossDown}:null;},
 restore(data){if(!data)return;for(const k of ['rescued','relay','scanned','bossDown'])this.state[k]=data[k]===true;
  if(this.state.bossDown)enemies=enemies.filter(e=>!e.isCaptain);if(this.state.rescued)this.state.civilianX=1490;
 },
 ready(){const s=this.state;return !!(s?.rescued&&s.relay&&s.bossDown);},
 stand(){const feet=player.y+player.h;player.h=94;player.y=feet-94;player.crouching=false;},
 stance(){const s=this.state;const crouch=(keys.s||keys.c||keys.arrowdown)&&player.ground&&player.dash<=0;
  const feet=player.y+player.h;player.h=crouch?60:94;player.y=feet-player.h;player.crouching=!!crouch;
  player.tacticalCover=!!(crouch&&covers.some(c=>c.hp>0&&Math.abs(c.x+c.w/2-player.x-player.w/2)<125&&Math.abs(feet-c.y-c.h)<8));
 },
 scan(){const s=this.state;if(!s||mode!=='play'||player.death)return;
  if(time<s.scanReady){tell('SCAN RECHARGING',1);return;}s.scanUntil=time+5;s.scanReady=time+8;
  if(Math.abs(player.x-2340)<520){s.scanned=true;tell('SECURITY RELAY IDENTIFIED / E TO OVERRIDE',2);save();}
  else tell('TACTICAL SCAN / THREATS & WEAK POINTS MARKED',2);
  AudioBank.play('shield',.2);
 },
 interact(){const s=this.state;if(!s||player.death)return false;
  if(!s.rescued&&Math.abs(player.x-1390)<100&&player.ground){
   if(enemies.some(e=>!e.death&&Math.abs(e.x-1390)<260)){tell('CLEAR THE TECHNICIAN\'S IMMEDIATE AREA',2);return true;}
   s.rescued=true;s.rescueTime=time;score+=750;save();tell('TECHNICIAN: I CAN OPEN THE GATE. FIND THE RELAY.',3.5);return true;
  }
  if(Math.abs(player.x-2340)<100&&player.ground&&!s.relay){
   if(!s.rescued){tell('RESCUE THE TECHNICIAN TO GET ACCESS',2);return true;}
   if(!s.scanned){tell('V / SCAN THE SECURITY RELAY FIRST',2);return true;}
   s.relay=true;score+=750;save();tell('DISPATCH: THE GATE IS OPEN. STOP THE GANG LEADER.',3.5);return true;
  }
  return false;
 },
 killed(e){if(e.isCaptain){this.state.bossDown=true;score+=1200;save();tell('DISPATCH: STREET SECURED. GET TO EXTRACTION.',3);}},
 damageMultiplier(e){if(!e.isCaptain)return 1;return e.phase==='reload'?1.8:.45;},
 update(dt){const s=this.state;if(!s)return;
  if(s.rescued&&s.civilianX<1510)s.civilianX=Math.min(1510,s.civilianX+65*dt);
  for(const g of s.grenades){const oldY=g.y;g.life-=dt;g.vy+=780*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;
   for(const p of [...platforms,...covers.filter(c=>c.hp>0)])if(g.x>=p.x&&g.x<=p.x+p.w&&oldY<=p.y&&g.y>=p.y){g.y=p.y-2;g.vx*=.45;g.vy=-Math.abs(g.vy)*.32;}
   if(g.life<=0)explode(g.x,g.y,105,24,true);
  }s.grenades=s.grenades.filter(g=>g.life>0);
 },
 muzzleY(e){return e.y+(['gunman','shotgun'].includes(e.tacticalRole)?17:34);},
 enemy(e,dt){
  const s=this.state,dx=player.x-e.x,dist=Math.abs(dx);e.hit=Math.max(0,e.hit-dt);e.shootTime=Math.max(0,e.shootTime-dt);e.phaseTime+=dt;e.cooldown-=dt;e.vx=0;
  const advanced=sector>=6,visible=e.x+e.w>=camera&&e.x<=camera+viewWidth()-30;
  if(dist>(advanced?1050:850)||(!visible&&(!advanced||!e.alert||e.balcony))||player.death){e.phase='idle';e.phaseTime=0;animate(e,dt);return;}
  e.face=dx>=0?1:-1;e.alert=true;
  const sight=!blocked(e.x+e.w/2,this.muzzleY(e),player.x+20,player.y+30);
  const range={gunman:510,shotgun:320,grenadier:640,sniper:820,heavy:650}[e.tacticalRole];
  const enter=p=>{e.phase=p;e.phaseTime=0;};
  if(e.phase==='idle'){
   if(!e.balcony&&e.tacticalRole!=='sniper'&&!e.isCaptain&&(dist>range||(advanced&&!sight)))e.vx=e.face*(e.tacticalRole==='shotgun'?112:72)*(advanced?1+Math.min(.3,(sector-5)*.025):1);
   if((dist<range&&sight||e.tacticalRole==='grenadier'&&dist<range)&&e.cooldown<=0&&(!advanced||visible)){enter('windup');e.aimX=player.x+20;e.aimY=player.y+30;e.warnDuration={gunman:.48,shotgun:.8,grenadier:.9,sniper:1.2,heavy:1.15}[e.tacticalRole];}
  }else if(e.phase==='windup'&&e.phaseTime<e.warnDuration){
   // Track early in the warning, then commit to a dodgeable shot.
   if(advanced&&sight&&e.phaseTime<e.warnDuration*.55){e.aimX=player.x+20+clamp(player.vx*.12,-24,24);e.aimY=player.y+30;}
  }else if(e.phase==='windup'&&e.phaseTime>=e.warnDuration){
   if(e.tacticalRole==='grenadier'){
    const flight=.95,target=clamp(e.aimX-e.x,-620,620);s.grenades.push({x:e.x+20,y:e.y+25,vx:target/flight,vy:(620-e.y-25-.5*780*flight*flight)/flight,life:1.65});e.shootTime=.35;e.shotAge=0;enter('reload');
   }else{e.rounds=e.isCaptain?7:e.tacticalRole==='gunman'?2:1;e.nextShot=0;enter('burst');}
  }else if(e.phase==='burst'){
   e.nextShot-=dt;if(e.nextShot<=0&&e.rounds>0){
    if(advanced&&e.tacticalRole==='gunman'&&sight){e.aimX=player.x+20;e.aimY=player.y+30;}
    const aim=Math.atan2(e.aimY-(this.muzzleY(e)),e.aimX-(e.x+e.w/2));const count=e.tacticalRole==='shotgun'?5:1;
    for(let i=0;i<count;i++){const a=aim+(i-(count-1)/2)*.065;const speed=e.tacticalRole==='sniper'?670:e.isCaptain?430:380;
     bullets.push({x:e.x+e.w/2+Math.cos(a)*35,y:this.muzzleY(e),vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:e.tacticalRole==='shotgun'?.85:2.3,enemy:true,damage:e.isCaptain?8:e.tacticalRole==='sniper'?20:e.tacticalRole==='shotgun'?7:10,color:e.tacticalRole==='sniper'?'#ff6584':'#ffcf7a',w:6,h:6});
    }e.shootTime=.18;e.shotAge=0;e.rounds--;e.nextShot=e.isCaptain?.14:.3;AudioBank.play('enemy-shot',.18);
   }if(e.rounds<=0){enter('reload');e.reload=1;}
  }else if(e.phase==='reload'){
   e.reload=1;
   if(e.phaseTime>(e.isCaptain?2.6:e.tacticalRole==='grenadier'?2.5:e.tacticalRole==='shotgun'?2:1.5)){e.reload=0;e.cooldown=.35;enter('idle');}
  }
  if(e.ground&&Math.abs(e.vx)>0&&covers.some(c=>c.hp>0&&Math.abs((e.face>0?c.x:c.x+c.w)-(e.face>0?e.x+e.w:e.x))<14))e.vy=-400;
  physics(e,dt);if(e.y>800)killEnemy(e);if(overlap(player,e))damage(8);animate(e,dt);
 },
 drawWorld(){const s=this.state;if(!s)return;
  const civilianX=s.civilianX-camera;
  if(civilianX>-100&&civilianX<W+100){
   const state=s.rescued?(s.civilianX<1510?'run':'idle'):'captive';drawGenerated('technician',state,time,civilianX,620,1,96);
   label(s.rescued?'SAFE':'TECHNICIAN',civilianX,493,10,s.rescued?'#8ee7ab':'#ffc77b','center');
   if(!s.rescued&&Math.abs(player.x-1390)<130)label('E / RESCUE',civilianX,511,12,'#fff0cb','center');
  }
  const relayX=2340-camera;if(relayX>-80&&relayX<W+80){packArt('terminal',s.relay?1:0,relayX-25,528,60,92);label(s.relay?'RELAY OFFLINE':s.scanned?'E / OVERRIDE':'V / SCAN',relayX,506,11,s.relay?'#88ecbb':'#83e5ff','center');}
  for(const e of enemies){if(e.x-camera<-120||e.x-camera>W+120)continue;const x=e.x+e.w/2-camera;
   if(e.phase==='windup'){
    label(e.tacticalRole==='grenadier'?'GRENADE!':e.tacticalRole==='shotgun'?'SPREAD!':e.isCaptain?'BURST INCOMING':'!',x,e.y-22,12,'#ffd080','center');
    if(e.tacticalRole==='sniper'||e.isCaptain){line(x,this.muzzleY(e),e.aimX-camera,e.aimY,'#ff677988',1);ellipse(e.aimX-camera,e.aimY,6,6,'#ff677966');}
   }
   if(time<s.scanUntil){const names={gunman:'PISTOL / 2 SHOTS',shotgun:'SHOTGUN / CLOSE RANGE',grenadier:'GRENADIER / MOVE AWAY',sniper:'SNIPER / LASER WARNING',heavy:s.relay?'LEADER / HIT ON RELOAD':'ARMORED GANG LEADER'};
    label(names[e.tacticalRole],x,e.y-41,12,'#92edff','center');ctx.strokeStyle='#80eaff88';ctx.strokeRect(e.x-camera-6,e.y-6,e.w+12,e.h+12);
   }
   if(e.isCaptain&&s.relay&&e.phase==='reload'){label('RELOADING / ATTACK',x,e.y-21,12,'#8dffc1','center');glow(x,e.y+45,32,'#6dffad55');}
  }
  for(const g of s.grenades){const x=g.x-camera;ellipse(x,g.y,6,8,'#cf9e55');const pulse=.3+.2*Math.sin(time*18);ellipse(x,616,105,6,`rgba(255,98,75,${pulse})`);label('MOVE',x,g.y-15,12,'#ffb492','center');}
 },
 hud(){const s=this.state;if(!s)return;
  const w=activeWeapon(),d=WEAPONS[w.id],other=player.weapons[1-player.slot];
  // Keep information outside the balcony combat area (top 64, bottom 628 onwards).
  rect(0,0,W,64,'#081522');line(0,63,W,63,'#39586d');
  label('VOSS',16,19,14,'#89b4c9');label(String(Math.ceil(player.hp)).padStart(3,'0'),16,47,25,'#e3f6fa');
  rect(78,26,136,6,'#273441');rect(78,26,136*player.hp/100,6,player.hp>30?'#75e4f1':'#ff6c8f');
  label('ARMOR '+Math.ceil(player.armor)+' / '+player.lives+' LIVES',78,49,14,'#9bb9d2');
  label(LEVELS[sector].name.toUpperCase(),W/2,25,16,'#ecf2f6','center');label(enemies.filter(e=>!e.death).length+' HOSTILES / '+String(score).padStart(6,'0'),W/2,48,14,'#92a8bb','center');
  label(d.short+'  '+(player.reload>0?'RELOADING':w.ammo+' / '+(w.reserve===-1?'∞':w.reserve)),W-68,27,18,'#e3f6fa','right');
  label('Q '+(other?WEAPONS[other.id].short:'EMPTY')+' / R RELOAD',W-68,49,14,'#89a5bb','right');
  rect(0,628,W,92,'#081522');line(0,628,W,628,'#39586d');
  const task=sector>0?Campaign.task():!s.rescued?'RESCUE THE TECHNICIAN':!s.relay?'SCAN & DISABLE THE RELAY':!s.bossDown?'STOP THE GANG LEADER':'REACH EXTRACTION';
  const target=sector>0?Campaign.target():!s.rescued?1390:!s.relay?2340:!s.bossDown?3150:world-120;
  label((target>player.x?'→ ':'← ')+task,16,653,18,'#c3f2ff');
  let hint=player.x<600?'S / KNEEL & FIRE':!s.relay&&Math.abs(player.x-2340)<450?(time<s.scanReady?'SCAN RECHARGING':'V: SCAN / E: USE'):'';
  if(sector>0)hint=Campaign.hint();if(noticeTime>0)hint=notice;
  if(player.crouching)hint=player.tacticalCover?'IN COVER / KNEELING FIRE':'KNEELING / FIRE IN PLACE';
  if(pendingPickup)hint='E / TAKE '+WEAPONS[pendingPickup.id].short+(player.weapons.length===2?' / SWAP':'');
  label(hint,16,676,14,'#a9cede');
  label('G '+player.grenadeCount+' GRENADES / F '+player.shieldCharges+' SHIELDS',16,703,14,'#bad0db');
  label(player.dashCD<=0?'SHIFT / DODGE':'DODGE RECHARGING',W/2,703,14,'#7ee4ec','center');
  const boss=enemies.find(e=>(e.isCaptain||e.bossId)&&!e.death&&Math.abs(e.x-player.x)<850);
  if(boss){label(boss.bossId?'COMMAND UNIT':boss.phase==='reload'?'LEADER / RELOADING':'ARMORED GANG LEADER',W-16,688,14,'#ffc080','right');rect(W-220,698,204,5,'#263549');rect(W-220,698,204*boss.hp/boss.max,5,'#ed9971');}
  else label('EVIDENCE '+secrets+' / KILLS '+kills,W-16,703,14,'#adc5d2','right');
  if(player.death)label(player.lives>0?'SIGNAL LOST / REDEPLOYING':'SIGNAL LOST',W/2,H/2,23,'#fc95ae','center');
 },
 complete(){mode='review';clearInput();AudioBank.pause();audio?.suspend?.();panel('FIRST RESPONSE<br><em>COMPLETE.</em>',`Technician safe. Street secured. Score ${score}.`,'REPLAY MISSION 1');document.querySelector('#continue').style.display='none';}
};
