/* Campaign progression reuses the approved movement, human combat and compact HUD. */
const Campaign={
 missions:[
 ['The gang is moving weapons through the market.','SEIZE THE WEAPON CACHE','DISABLE THE GETAWAY VAN','use','use'],
 ['A rooftop courier carries the buyer list.','RECOVER THE BUYER LIST','UPLOAD THE EVIDENCE','use','scan'],
 ['The gang captain has sealed the metro.','RESTORE METRO POWER','OPEN THE PLATFORM GATE','scan','use','human'],
 ['Follow the shipment into the freight depot.','CHECK THE SHIPPING MANIFEST','STOP THE ARMS SHIPMENT','scan','use'],
 ['The assembly line is building illegal security robots.','SCAN THE ROBOT PROTOTYPE','SHUT DOWN THE ASSEMBLY LINE','scan','use'],
 ['Security units are guarding the outbound train.','CHANGE THE RAIL SWITCH','DISABLE THE ARMORED TRAIN','use','scan','patrol'],
 ['The factory commander protects the production core.','CUT THE COOLING SYSTEM','OVERLOAD THE FURNACE','use','scan','boss'],
 ['The lab staff are trapped behind a security lockdown.','FREE THE MEDICAL STAFF','RESTORE EMERGENCY ACCESS','rescue','use'],
 ['Find what the corporation is doing to its patients.','RECOVER THE SURGERY RECORDS','DISABLE THE SURGICAL UNITS','use','scan'],
 ['A witness is being held in cryogenic storage.','LOCATE THE WITNESS','RELEASE THE CRYO LOCK','scan','rescue','patrol'],
 ['The lab commander is linked to the neural network.','DOWNLOAD THE NEURAL KEY','SEVER THE CONTROL LINK','scan','use','boss'],
 ['Enter the blacksite without leaving its defenses online.','DISABLE THE WATCH SENSORS','UNLOCK THE SERVICE ENTRANCE','scan','use'],
 ['Prisoners can identify the people behind City Zero.','RELEASE THE PRISONERS','OPEN THE EVACUATION ROUTE','rescue','use'],
 ['An enforcement patrol has entered the exercise yard.','RECOVER THE GUARD KEY','OPEN THE YARD GATE','use','scan','patrol'],
 ['The warden controls every cell and every exit.','CUT THE PRISON UPLINK','UNLOCK THE CONTROL ROOM','scan','use','boss'],
 ['The evidence leads to the corporate citadel.','LOWER THE PLAZA BARRIERS','SECURE THE CITADEL ENTRANCE','use','scan'],
 ['The original directive is stored in the data vault.','BREACH THE VAULT','COPY THE ORIGINAL DIRECTIVE','use','scan','patrol'],
 ['Cross the skybridge before the command unit escapes.','RESTORE BRIDGE POWER','LOCK THE ESCAPE ROUTE','use','scan'],
 ['End the command signal and return the city to its people.','DISABLE THE DEFENSE GRID','SHUT DOWN CITY ZERO','scan','use','boss']
 ].map(([story,a,b,ka,kb,boss])=>({story,labels:[a,b],kinds:[ka,kb],boss})),
 get mission(){return this.missions[sector-1];},
 human(x,role,floor=620){const e=Object.assign(actor(x,floor-94),{tacticalRole:role,phase:'idle',phaseTime:0,cooldown:1,alert:false,face:-1,home:x,rounds:0});e.hp=e.max={gunman:48,shotgun:80,grenadier:65,sniper:60,heavy:300}[role];if(role==='heavy'){e.isCaptain=true;e.h=110;e.w=53;e.name='GANG CAPTAIN';}e.y=floor-e.h;if(floor<620)e.balcony=true;return e;},
 setup(){
  const s=FirstResponse.state={rescued:true,relay:true,scanned:false,bossDown:false,scanUntil:0,scanReady:0,grenades:[],done:0,spawned:false};
  s.points=[1320+(sector%3)*110,2490+(sector%4)*80];
  world=4400;platforms=platforms.filter(p=>!p.ground&&!p.elevator);platforms.push({x:0,y:620,w:world,h:130,ground:true});
  platforms.forEach(p=>{if(!p.ground){p.projectilePassThrough=true;p.moving=false;}});
  covers.forEach(c=>c.hp=c.max=420);traps=[];enemies=[];
  const roles=['gunman','shotgun','grenadier'];
  for(let i=0;i<7;i++){
   const x=590+i*460+(sector%3)*25;
   const robot=sector>=5&&(sector>=12?i%4!==0:sector>=8?i%3!==0:i<sector-4);
   if(robot){const e=actor(x,526);outfitEnemy(e,sector<7?'shield':['shield','gatling','hound'][(i+sector)%3]);e.face=-1;enemies.push(e);}
   else enemies.push(this.human(x,roles[(i+sector)%3]));
  }
  for(const i of [1,4]){const p=platforms.filter(p=>!p.ground)[i];if(p)enemies.push(this.human(p.x+35,'sniper',p.y));}
  // One extra patrol at mission 7, up to seven at mission 19–20.
  if(sector>=6){const extra=1+Math.floor((sector-6)/2);for(let i=0;i<extra;i++){
   const x=850+i*400+(sector%2)*70;
   if(i%3===2)enemies.push(this.human(x,i%2?'grenadier':'shotgun'));
   else{const e=actor(x,526);outfitEnemy(e,['shield','gatling','hound'][(i+sector)%3]);e.face=-1;enemies.push(e);}
  }addPickup(1950,583,'ammo');addPickup(3200,583,'ammo');}
  player.h=94;player.y=526;player.crouching=false;player.tacticalCover=false;
  document.querySelector('#stage').dataset.mission='tactical';
 },
 snapshot(){const s=FirstResponse.state;return {done:s.done,spawned:s.spawned,bossDown:s.bossDown};},
 restore(data){if(!data)return;const s=FirstResponse.state;s.done=Math.max(0,Math.min(2,data.done||0));s.bossDown=!!data.bossDown;s.spawned=false;},
 task(){const s=FirstResponse.state;return s.done<2?this.mission.labels[s.done]:this.mission.boss&&!s.bossDown?'DEFEAT THE COMMAND UNIT':'REACH EXTRACTION';},
 target(){const s=FirstResponse.state;return s.done<2?s.points[s.done]:this.mission.boss&&!s.bossDown?3500:world-120;},
 hint(){const s=FirstResponse.state;return s.done<2?(this.mission.kinds[s.done]==='scan'?'V / SCAN':'E / INTERACT'):'';},
 interact(scan=false){const s=FirstResponse.state;if(s.done>=2||Math.abs(player.x-this.target())>100||!player.ground)return false;
  const kind=this.mission.kinds[s.done];if((kind==='scan')!==scan){tell(this.hint(),2);return true;}
  if(enemies.some(e=>!e.death&&Math.abs(e.x-this.target())<230)){tell('SECURE THE AREA FIRST',2);return true;}
  s.done++;save();tell(s.done<2?this.task():this.mission.boss?'COMMAND UNIT INBOUND':'OBJECTIVES COMPLETE / EXTRACT',3);return true;
 },
 update(){const s=FirstResponse.state;if(this.mission.boss&&!s.spawned&&!s.bossDown&&(player.x>2950||s.done===2)){
  s.spawned=true;let e;if(this.mission.boss==='human')e=this.human(3500,'heavy');else e=makeWarden(Math.min(5,Math.floor(sector/4)+1),this.mission.boss==='patrol'?3260:world-410,this.mission.boss==='patrol');
  e.missionBoss=true;enemies.push(e);tell(this.mission.boss==='human'?'GANG CAPTAIN AHEAD':'WARNING / COMMAND UNIT INBOUND',3);save();
 }},
 ready(){const s=FirstResponse.state;return s.done===2&&(!this.mission.boss||s.bossDown);},
 drawWorld(){const s=FirstResponse.state;for(let i=0;i<2;i++){const x=s.points[i]-camera;if(x<-100||x>W+100)continue;const done=i<s.done,kind=this.mission.kinds[i];if(kind==='rescue')drawGenerated('technician',done?'idle':'captive',time,x,620,1,96);else packArt('terminal',done?1:0,x-25,528,60,92);label(done?'DONE':i===s.done?(kind==='scan'?'V / SCAN':'E / USE'):'LOCKED',x,504,14,done?'#8ee7ab':'#c3f2ff','center');}
 for(const e of enemies){if(e.tacticalRole&&e.phase==='windup'){const x=e.x+e.w/2-camera;label(e.tacticalRole==='grenadier'?'GRENADE!':'!',x,e.y-20,14,'#ffd080','center');if(e.tacticalRole==='sniper')line(x,FirstResponse.muzzleY(e),e.aimX-camera,e.aimY,'#ff677988',1);}}
 },
 complete(){if(sector<19){const carry={...player,weapons:player.weapons};loadLevel(sector+1,carry);save();sound(600,.25,'triangle');window.GameMonetize?.requestAd();}else{mode='win';clearInput();try{localStorage.removeItem(SAVE_KEY);}catch{}panel('CITY ZERO<br><em>RECLAIMED.</em>','The command signal is gone. The city is free.','NEW CAMPAIGN');}}
};
for(const name of ['setup','snapshot','restore','ready','drawWorld']){const original=FirstResponse[name];FirstResponse[name]=function(...args){return sector===0?original.apply(this,args):Campaign[name](...args);};}
const originalInteract=FirstResponse.interact,originalScan=FirstResponse.scan,originalUpdate=FirstResponse.update,originalKilled=FirstResponse.killed;
FirstResponse.interact=function(){return sector===0?originalInteract.call(this):Campaign.interact();};
FirstResponse.scan=function(){if(sector===0)return originalScan.call(this);if(mode==='play')Campaign.interact(true);};
FirstResponse.update=function(dt){if(sector===0)return originalUpdate.call(this,dt);const s=this.state;for(const g of s.grenades){g.life-=dt;g.vy+=780*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;if(g.y>610){g.y=610;g.vx=0;g.vy=0;}if(g.life<=0)explode(g.x,g.y,105,24,true);}s.grenades=s.grenades.filter(g=>g.life>0);Campaign.update();};
FirstResponse.killed=function(e){if(sector===0)return originalKilled.call(this,e);if(e.missionBoss){this.state.bossDown=true;save();tell('COMMAND UNIT DOWN / EXTRACT',3);}};
FirstResponse.complete=()=>Campaign.complete();
