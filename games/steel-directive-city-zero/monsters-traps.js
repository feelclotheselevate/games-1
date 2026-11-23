/* User-supplied artwork stays unchanged. Black-matte removal is cached once at load,
   never per frame; authored cells prevent neighboring poses bleeding into animation. */
'use strict';
const PACK_FILES={};
const PACK_TEXTURES={},PACK_BOUNDS={},PACK_FRAMES={};
function cells(xs,y,bottom){return xs.slice(0,-1).map((x,i)=>[x,y,xs[i+1]-x,bottom-y]);}
const six=[0,187,374,561,748,935,1122];
const MONSTER_CELLS={
 shield:{idle:cells([160,350,550,750,940],0,245),run:cells(six,245,495),brace:cells([310,530,760],495,718),shoot:cells([130,335,565,785,1000],718,950),hit:cells([340,550,780],950,1170),death:cells(six,1170,1380)},
 gatling:{idle:cells([0,230,435,665],0,300),run:cells(six,300,580),shoot:cells(six,580,840),hit:cells([0,215,435],840,1120),death:cells(six,1120,1380)},
 hound:{idle:cells([0,280,560,840,1122],50,240),run:cells(six,275,420),brace:cells([0,290,580],460,630),shoot:cells([0,300,600,875,1122],635,875),hit:cells([0,260,520],890,1120),death:cells(six,1150,1360)},
 berserker:{idle:cells([0,250,480,710,960],0,285),run:cells(six,285,550),shoot:cells([0,190,380,590,785,1122],565,835),hit:cells([0,205,425],840,1100),death:cells([0,180,365,550,805,1122],1100,1360)}
};
const TRAP_ART={
 spikes:['machines',[[12,105,188,145],[203,105,189,145],[394,100,194,150]]],
 press:['machines',[[599,12,220,248],[824,12,210,248],[1034,12,240,248]]],
 saw:['machines',[[5,273,211,181],[217,273,222,181],[440,273,240,181]]],
 piston:['machines',[[727,268,190,189],[954,268,267,189],[1244,268,204,189]]],
 pendulum:['machines',[[10,460,133,251],[167,460,181,251],[335,460,199,251]]],
 platform:['machines',[[543,532,219,110],[771,528,230,115]]],
 elevator:['machines',[[1006,525,225,182]]],
 flame:['machines',[[12,751,135,240],[148,751,153,240],[288,728,337,263]]],
 steam:['machines',[[622,769,89,220],[713,706,136,285],[849,741,222,250]]],
 barrel:['machines',[[1070,807,103,184],[1183,807,107,184],[1290,801,158,197]]],
 electric:['hazards',[[13,24,329,251],[367,24,333,251]]],
 laser:['hazards',[[724,60,341,107],[724,170,341,100]]],
 geyser:['hazards',[[1071,110,181,165],[1252,0,186,275]]],
 mine:['hazards',[[24,357,164,122],[192,352,202,129]]],
 turret:['hazards',[[421,306,209,195],[633,306,264,195]]],
 ceiling:['hazards',[[915,310,233,195],[1171,310,233,195]]],
 tesla:['hazards',[[9,500,188,284],[198,495,217,289]]],
 acid:['hazards',[[415,542,279,242],[695,542,272,242]]],
 beacon:['hazards',[[981,597,222,187],[1204,570,211,214]]],
 terminal:['hazards',[[20,809,242,255],[273,809,252,255]]]
};
const TRAP_KINDS=['spikes','press','steam','saw','piston','electric','pendulum','flame','barrel','laser','geyser','mine','turret','ceiling','tesla','acid'];
const PACK_TIPS={shield:'SHIELD TROOPER / FLANK, GRENADE OR WAIT FOR RELOAD',gatling:'GATLING BRUTE / TAKE COVER DURING THE BURST',hound:'RAZOR OPERATIVE / DODGE THE TELEGRAPHED LEAP',berserker:'ASSAULT OPERATIVE / BAIT THE CHARGE, THEN DODGE'};
const shownPackTips=new Set();
function outfitEnemy(e,kind){e.pack=kind;e.windup=0;e.specialCD=1.4;e.specialTime=0;e.specialFace=1;e.blockFlash=0;e.spin=0;e.burstShots=0;
 const stats={shield:[1,1.55,40,94],gatling:[1.18,1.95,54,111],hound:[1,.8,72,58],berserker:[1.12,1.65,48,105]}[kind];
 e.scale*=stats[0];e.w=stats[2]*(e.boss==='boss'?1.6:e.boss?1.25:1);e.h=stats[3]*(e.boss==='boss'?1.6:e.boss?1.25:1);e.hp=Math.round(e.hp*stats[1]);e.max=e.hp;e.y=620-e.h;return e;
}
function campaignMonster(i){const pool=sector===0?['shield','trooper','trooper']:sector<3?['shield','hound','trooper']:sector<6?['shield','hound','gatling','trooper']:['shield','hound','gatling','berserker','trooper'];return pool[(i+sector)%pool.length];}
function createPackTrap(kind,x,index){const wide=['electric','laser','flame','acid','pendulum'].includes(kind);return{x,y:620,w:wide?120:75,h:kind==='laser'?65:kind==='ceiling'?155:kind==='spikes'||kind==='mine'?38:110,kind,phase:index*.81+sector*.2,period:sector>12?4:5.2,active:false,warn:false,pack:true,hp:kind==='barrel'?36:Infinity,disabled:0,shotCD:0};}
function trapBoxes(t){
 if(t.kind==='barrel')return [];
 if(t.kind==='turret')return [];
 if(t.kind==='laser')return [{x:t.x+10,y:t.y-60,w:t.w-20,h:9}];
 if(t.kind==='piston')return [{x:t.x,y:t.y-72,w:t.w,h:55}];
 if(t.kind==='pendulum'){const a=Math.sin(time*2+t.phase)*.75,cx=t.x+t.w/2+Math.sin(a)*75,cy=t.y-155+Math.cos(a)*115;return [{x:cx-23,y:cy-23,w:46,h:46}];}
 if(t.kind==='tesla')return [{x:t.x-15,y:t.y-105,w:t.w+30,h:105}];
 if(t.kind==='flame')return [{x:t.x+22,y:t.y-85,w:t.w-22,h:58}];
 return [{x:t.x,y:t.y-t.h,w:t.w,h:t.h}];
}
function detonateBarrel(t){if(t.destroyed)return;t.destroyed=true;t.active=false;explode(t.x+t.w/2,t.y-35,165,150);if(Math.hypot(player.x+20-t.x-t.w/2,player.y+47-t.y+35)<165)damage(45);}
function updatePackTrap(t,dt){
 const old=t.active,oldWarn=t.warn;t.disabled=Math.max(0,(t.disabled||0)-dt);t.shotCD=Math.max(0,(t.shotCD||0)-dt);
 const p=(time+t.phase)%t.period;t.active=!t.destroyed&&!t.disabled&&p>t.period*.68;t.warn=!t.destroyed&&!t.disabled&&p>t.period*.48&&!t.active;
 if(t.kind==='barrel'){t.active=false;t.warn=false;return;}
 const gain=Math.max(0,1-Math.abs(t.x-player.x)/650);if(gain){if(t.warn&&!oldWarn)AudioBank.play('trap-warning',gain*.20);if(t.active&&!old)AudioBank.play(['press','piston','ceiling','spikes'].includes(t.kind)?'press':t.kind==='flame'||t.kind==='geyser'?'explosion':'shield',gain*.22);if(old&&!t.active&&['press','piston','ceiling'].includes(t.kind))AudioBank.play('press-release',gain*.3);}
 if(t.kind==='turret'&&t.active&&t.shotCD<=0&&gain>0){t.shotCD=.33;const dir=player.x<t.x?-1:1;bullets.push({x:t.x+t.w/2+dir*35,y:t.y-60,vx:dir*430,vy:0,life:2,enemy:true,damage:12,color:'#ffc765',w:6,h:6});AudioBank.play('enemy-shot',gain*.14);}
 if(t.active&&trapBoxes(t).some(b=>overlap(player,b))){if(t.kind==='mine'){t.destroyed=true;t.active=false;explode(t.x+t.w/2,t.y-10,115,30,true);}else damage(['press','ceiling'].includes(t.kind)?38:t.kind==='acid'?20:16);}
 if(t.active&&random()<dt*12&&Math.abs(t.x-player.x)<800)burst(t.x+t.w/2,t.y-25,t.kind==='acid'?'#aff35e':'#ffc985',1,t.kind==='steam');
}
function packEnemyAI(e,dt){
 if(!shownPackTips.has(e.pack)&&Math.abs(e.x-player.x)<550&&noticeTime<=0){shownPackTips.add(e.pack);tell(PACK_TIPS[e.pack],4);}
 e.blockFlash=Math.max(0,e.blockFlash-dt);e.specialCD=Math.max(0,e.specialCD-dt);
 if(e.pack==='shield'||e.pack==='gatling')return false;
 // Melee enemies wind up visibly, lock their direction, then commit and recover.
 e.fire-=dt;e.hit=Math.max(0,e.hit-dt);e.shootTime=Math.max(0,e.shootTime-dt);e.stateTime+=dt;
 const dx=player.x-e.x,dist=Math.abs(dx),near=dist<680&&!player.death;
 if(e.windup>0){e.windup-=dt;e.vx=0;changeState(e,'attack');if(e.windup<=0){e.specialTime=e.pack==='hound'?.52:.48;e.specialFace=e.face;if(e.pack==='hound'){e.vy=-350;e.ground=false;}e.shootTime=.55;enemyVoice(e,'enemy-attack',.7);}}
 else if(e.specialTime>0){e.specialTime-=dt;e.vx=e.specialFace*(e.pack==='hound'?380:470);e.face=e.specialFace;if(e.specialTime<=0){e.specialCD=e.boss?1.1:1.8;e.vx=0;}}
 else if(e.specialCD>1.15){e.vx=0;changeState(e,'cover');}
 else if(near){e.face=dx>=0?1:-1;if(dist<(e.pack==='hound'?245:200)&&Math.abs(player.y-e.y)<140&&e.specialCD<=0){e.windup=e.pack==='hound'?.55:.7;e.vx=0;changeState(e,'attack');}else{changeState(e,e.hp<e.max*.25&&e.specialCD>0?'retreat':'chase');e.vx=e.face*(e.pack==='hound'?175:125)*(e.state==='retreat'?-1:1);}}
 else{changeState(e,'patrol');if(e.x>e.home+80)e.patrol=-1;if(e.x<e.home-80)e.patrol=1;e.face=e.patrol;e.vx=e.patrol*35;}
 const edge=e.x+e.w/2+Math.sign(e.vx)*55;
 if(e.ground&&e.vx&&!platforms.some(p=>edge>p.x&&edge<p.x+p.w&&Math.abs(p.y-e.y-e.h)<14)){e.vx=0;e.patrol*=-1;}
 if(e.ground&&e.state==='chase'&&covers.some(c=>c.hp>0&&Math.abs(c.x-e.x)<90)){e.vy=-480;e.ground=false;}
 physics(e,dt);if(e.y>800){killEnemy(e);return true;}if(overlap(player,e))damage(e.specialTime>0?28:10);animate(e,dt);return true;
}
function packArt(kind,frame,x,y,w,h){const def=TRAP_ART[kind],img=PACK_TEXTURES[def?.[0]];if(!img)return false;const r=def[1][Math.min(frame,def[1].length-1)];ctx.drawImage(img,...r,x,y,w,h);return true;}
function drawPackTrap(t){const x=t.x-camera;if(x<-220||x>W+220)return;const active=t.active,frame=active?2:t.warn?1:0;
 if(t.kind==='barrel'){packArt('barrel',t.destroyed?2:t.hp<36?1:0,x,t.y-68,t.w,68);return;}
 if(t.destroyed){rect(x,t.y-5,t.w,5,'#242725');return;}
 if(t.kind==='pendulum'){const a=Math.sin(time*2+t.phase)*.75;const cy=t.y-155,cx=x+t.w/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(active?a:0);packArt('pendulum',0,-28,0,56,140);ctx.restore();}
 else if(t.kind==='press'||t.kind==='ceiling'){const top=t.y-175;packArt(t.kind,active?2:0,x-8,top,t.w+16,active?175:100);line(x,0,x,top,'#39443b',7);line(x+t.w,0,x+t.w,top,'#39443b',7);}
 else if(t.kind==='acid'){packArt('acid',active?1:0,x-15,t.y-140,t.w+30,140);}
 else if(t.kind==='steam'){packArt('steam',frame,x-4,t.y-120,t.w+40,120);}
 else if(t.kind==='flame'){packArt('flame',frame,x,t.y-100,t.w+(active?10:0),100);}
 else if(t.kind==='laser'){packArt('laser',active?1:0,x,t.y-90,t.w,60);}
 else if(t.kind==='turret'){ctx.save();ctx.translate(x+t.w/2,t.y-65);ctx.scale(player.x<t.x?-1:1,1);packArt('turret',active?1:0,-t.w/2,-45,t.w,90);ctx.restore();}
 else {const two=TRAP_ART[t.kind][1].length===2;packArt(t.kind,two?(active?1:0):t.kind==='saw'&&active?Math.floor(time*14)%3:frame,x,t.y-t.h,t.w,t.h);}
 if(t.warn){rect(x,t.y-t.h,t.w,t.h,'#ffb34c18');label('!',x+t.w/2,t.y-t.h-10,20,'#ffdb86','center');}
 packArt('beacon',t.warn||active?1:0,x+t.w/2-9,t.y+2,18,17);
 if(t.disabled)label('OFFLINE',x+t.w/2,t.y-14,8,'#a8e9b2','center');if(active)glow(x+t.w/2,t.y-45,65,t.kind==='acid'?'#a3e54b22':'#ff9e4822');
}
