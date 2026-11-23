/* Five district commanders, scaled enforcement variants and returning weaker units. */
'use strict';
const FOUR=[0,280,560,840,1122],FIVE=[0,225,450,675,900,1122];
const BOSS_ROSTER=[{"name": "BULWARK / PRECINCT COMMAND", "hp": 420, "w": 100, "h": 156, "style": "hammer", "speed": 65, "art": 2}, {"name": "CRUCIBLE / FACTORY GUARD", "hp": 520, "w": 116, "h": 155, "style": "gatling", "speed": 55, "art": 1}, {"name": "HELIX / AUGMENTATION PRIME", "hp": 600, "w": 105, "h": 160, "style": "claw", "speed": 90, "art": 3}, {"name": "RAZOR / BLACKSITE WARDEN", "hp": 660, "w": 95, "h": 154, "style": "hook", "speed": 95, "art": 4}, {"name": "ARCHON / ZERO COMMAND", "hp": 800, "w": 125, "h": 165, "style": "wyrm", "speed": 60, "art": 0}];
function makeWarden(id,x,returning=false,cycle=0){const d=BOSS_ROSTER[id-1],e=actor(x,450,returning?null:'boss','warden'),scale=returning?.78:1;
 Object.assign(e,{bossId:id,returning,pack:null,name:d.name+(cycle?' / OVERDRIVE':''),w:d.w*scale,h:d.h*scale,scale,baseHP:d.hp,hp:returning?d.hp/2:Math.round(d.hp*(1+cycle*.35)),max:returning?d.hp/2:Math.round(d.hp*(1+cycle*.35)),phase:'approach',phaseTime:0,attackCount:0,attackCD:returning?1.8:1.2,shotCD:0,pattern:'shot',face:-1,lockedFace:-1,arenaLeft:returning?Math.max(0,x-180):world-650,arenaRight:returning?Math.min(world-80,x+230):world-120,home:x,damageScale:returning?.7:1,death:false,engaged:false});
 e.y=620-e.h;return e;
}
function addCampaignWardens(){const id=Math.floor(sector/4)+1,climax=sector%4===3;
 const final=makeWarden(id,world-410,false,0);final.commander=climax;
 if(!climax){final.hp=Math.round(final.hp*(.48+(sector%4)*.1));final.max=final.hp;final.w*=.85;final.h*=.85;final.y=620-final.h;final.name=final.name.split(' / ')[0]+' / ENFORCEMENT UNIT';final.damageScale=.8;}
 enemies.push(final);
 if(sector>=4){const old=Math.max(1,id-1),x=sector%2?2940:1790;const ordinary=enemies.find(e=>!e.boss&&Math.abs(e.x-x)<160);if(ordinary)enemies.splice(enemies.indexOf(ordinary),1);enemies.push(makeWarden(old,x,true));}
 platforms.push({x:world-720,y:485,w:145,h:24,oneWay:true,balcony:true});
 traps=traps.filter(t=>t.x<world-750);addPickup(world-680,583,'health');addPickup(world-640,583,'ammo');addPickup(world-600,583,'grenade');
}
function chooseWardenAttack(e,dist){const s=BOSS_ROSTER[e.bossId-1].style;e.attackCount++;
 if(s==='charge')return e.attackCount%2?'charge':'flame';if(s==='hook'||s==='fist')return e.attackCount%2?'hook':'slam';
 if(s==='priest')return e.attackCount%3?'orbs':'beam';if(s==='wyrm')return e.attackCount%2?'beam':'charge';
 if(s==='spider')return e.attackCount%2?'beam':'orbs';if(s==='gatling')return dist<135?'slam':'burst';
 if(s==='hammer')return dist<190||e.attackCount%2===0?'slam':'shot';if(s==='claw')return dist<180?'claw':'burst';return dist<170?'claw':'shot';
}
function wardenAttackBox(e){const reach=e.pattern==='hook'?260:e.pattern==='slam'?155:e.pattern==='claw'?145:e.pattern==='flame'?260:620;return{x:e.lockedFace>0?e.x+e.w-15:e.x-reach+15,y:e.pattern==='slam'?e.y+e.h-35:e.y+e.h*.32,w:reach,h:e.pattern==='slam'?35:e.pattern==='beam'?12:60};}
function wardenShot(e,count=1){const x=e.x+e.w/2+e.lockedFace*e.w*.45,y=e.y+e.h*.4;const a=Math.atan2(e.aimY-y,e.aimX-x);for(let i=0;i<count;i++){const ang=a+(i-(count-1)/2)*.19;bullets.push({x,y,vx:Math.cos(ang)*340,vy:Math.sin(ang)*340,life:2.5,enemy:true,damage:(e.pattern==='burst'?8:13)*e.damageScale,color:'#ffaf53',w:8,h:8});}enemyVoice(e,'enemy-shot',.35);}
function wardenAI(e,dt){
 const d=BOSS_ROSTER[e.bossId-1],dist=Math.abs(player.x-e.x);e.hit=Math.max(0,e.hit-dt);e.phaseTime+=dt;e.attackCD-=dt;e.shotCD-=dt;e.shootTime=Math.max(0,e.shootTime-dt);e.vx=0;
 if(!e.engaged&&dist<640&&!player.death){e.engaged=true;if(!e.returning)tell(e.name+' / WARDEN ENGAGED',3);}
 if(!e.engaged||player.death){e.phase='approach';e.attackCD=Math.max(e.attackCD,.8);}
 else if(e.phase==='windup'){if(e.phaseTime>= (e.pattern==='beam'?1.05:e.pattern==='charge'?.85:.65)){e.phase='attack';e.phaseTime=0;e.shotCD=0;e.struck=false;enemyVoice(e,'enemy-attack',.7);}}
 else if(e.phase==='attack'){
  e.face=e.lockedFace;e.shootTime=.2;
  if(e.pattern==='charge'){e.vx=e.lockedFace*(e.returning?270:340);if(overlap(player,e))damage(24*e.damageScale);}
  else if(['shot','burst','orbs'].includes(e.pattern)){if(e.shotCD<=0){wardenShot(e,e.pattern==='orbs'?3:1);e.shotCD=e.pattern==='burst'?.18:.5;}}
  else{const box=wardenAttackBox(e);if(overlap(player,box)&&!blocked(e.x+e.w/2,e.y+e.h*.4,player.x+20,player.y+40))damage((e.pattern==='slam'?28:e.pattern==='beam'?20:22)*e.damageScale);if(!e.struck){e.struck=true;if(['slam','claw','hook'].includes(e.pattern)){burst(e.x+e.w/2+e.face*90,e.y+e.h-5,'#ffbc71',18);enemyVoice(e,'press',.5);}}}
  const duration=e.pattern==='burst'?1.1:e.pattern==='beam'?.7:e.pattern==='charge'?.7:.5;if(e.phaseTime>duration){e.phase='recover';e.phaseTime=0;e.attackCD=e.returning?2.1:1.4;}
 }else if(e.phase==='recover'){if(e.phaseTime>(e.returning?1.1:.85)){e.phase='approach';e.phaseTime=0;}}
 else{e.face=player.x+20>e.x+e.w/2?1:-1;const range=['gatling','priest','spider','wyrm'].includes(d.style)?390:230;if(dist>range)e.vx=e.face*d.speed;else if(dist<100)e.vx=-e.face*d.speed*.6;
  if(e.attackCD<=0&&dist<620){e.pattern=chooseWardenAttack(e,dist);e.phase='windup';e.phaseTime=0;e.lockedFace=e.face;e.aimX=player.x+20;e.aimY=player.y+40;e.vx=0;}
 }
 const feet=e.x+e.w/2+Math.sign(e.vx)*(e.w/2+20);if(e.ground&&e.vx&&!platforms.some(p=>feet>p.x&&feet<p.x+p.w&&Math.abs(p.y-e.y-e.h)<14))e.vx=0;
 physics(e,dt);e.x=clamp(e.x,e.arenaLeft,e.arenaRight-e.w);if(e.y>800){e.x=e.home;e.y=620-e.h;e.vy=0;}
 if(d.style==='priest'&&e.ground){e.hover=Math.sin(time*2)*6;}if(overlap(player,e))damage(10*e.damageScale);animate(e,dt);
}
function drawWarden(e){const x=e.x+e.w/2-camera;drawCityBoss(e,x,e.y+e.h-(e.hover||0));
 if(!e.death){rect(x-35,e.y-20,70,4,'#131b1e');rect(x-35,e.y-20,70*e.hp/e.max,4,e.returning?'#cda576':'#ff8950');if(e.returning)label('VETERAN',x,e.y-26,8,'#cbbda3','center');
  if(e.phase==='windup'){label('!',x,e.y-30,22,'#ffe1a1','center');const b=wardenAttackBox(e);if(['beam','hook','flame','slam'].includes(e.pattern))rect(b.x-camera,b.y,b.w,b.h,'#ffb75020');}
  if(e.phase==='attack'&&['beam','hook','flame','slam'].includes(e.pattern)){const b=wardenAttackBox(e);if(e.pattern==='beam')line(b.x-camera,b.y+6,b.x+b.w-camera,b.y+6,'#ffd7a0',5);else if(e.pattern==='hook')line(e.x+e.w/2-camera,b.y+20,e.lockedFace>0?b.x+b.w-camera:b.x-camera,b.y+20,'#c7a675',4);else if(e.pattern==='flame')for(let j=0;j<9;j++)ellipse(b.x-camera+j*b.w/9,b.y+30,18,20+Math.sin(time*25+j)*8,'#ff8d3544');else line(b.x-camera,b.y+b.h-3,b.x+b.w-camera,b.y+b.h-3,'#ffb652',4);}
 }return true;
}
