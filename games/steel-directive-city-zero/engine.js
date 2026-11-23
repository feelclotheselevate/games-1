/* Steel Directive engine, adapted from the user's Hellforge engine — deterministic 2D campaign, fixed-step simulation. */
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d',{alpha:false});
const overlay=document.querySelector('#overlay'),start=document.querySelector('#start'),statusLabel=document.querySelector('#status');
const W=960,H=720,SAVE_KEY='steel-directive-campaign-v1';
const keys={},mouse={x:850,y:380,down:false,active:false};
let mode='title',sector=0,player,enemies=[],bullets=[],particles=[],pickups=[],platforms=[],covers=[],traps=[],flags=[],grenades=[],corpses=[];
let camera=0,world=4400,kills=0,score=0,time=0,shake=0,checkpoint=100,secrets=0,notice='',noticeTime=0,audio=null,muted=true,pendingPickup=null;
let levelSeed=1,transition=0,deathTime=0,quality='high',assetFailures=[];
const assets={},assetReady=[];
for(const [key,file] of Object.entries(CITY_FILES)){
 const img=new Image();assets[key]=img;assetReady.push(new Promise(resolve=>{img.onload=()=>{try{if(key==='machines'||key==='hazards')PACK_TEXTURES[key]=img;resolve(true);}catch(error){assetFailures.push(file);console.error(error);resolve(false);}};img.onerror=()=>{assetFailures.push(file);resolve(false);};}));img.src='assets/'+file;
}
function tacticalMission(){return typeof FirstResponse!=='undefined';}
function worldZoom(){return tacticalMission()?1.4:1;}
function viewWidth(){return W/worldZoom();}
function extractionReady(){return tacticalMission()?FirstResponse.ready():enemies.length===0;}
function random(){levelSeed=(Math.imul(levelSeed,1664525)+1013904223)>>>0;return levelSeed/4294967296;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function sound(freq=100,duration=.12,type='sawtooth',volume=.035){if(muted||AudioBank.suspended||document.hidden)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.35),audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function tell(text,duration=3){notice=text;noticeTime=duration;}
function burst(x,y,color,n=12,smoke=false){for(let i=0;i<n&&particles.length<(quality==='high'?240:100);i++)particles.push({x,y,vx:(random()-.5)*(smoke?60:420),vy:smoke?-20-random()*35:(random()-.65)*360,life:smoke?1.4: .25+random()*.5,max:smoke?1.4: .75,size:smoke?10+random()*20:2+random()*3,color,smoke});}
function weapon(id){let w=WEAPONS[id];return{id,ammo:w.mag,reserve:w.reserve===Infinity?-1:w.reserve};}
function activeWeapon(){return player.weapons[player.slot];}
function actor(x,y,boss=null,role='trooper'){
 let scale=boss==='boss'?1.6:boss==='mini'?1.25:1;
 let hp=boss?(boss==='boss'?520+sector*35:260+sector*20):52+sector*4+(role==='heavy'?45:0);
 return {x,y,w:40*scale,h:94*scale,vx:0,vy:0,face:1,hp,max:hp,ground:false,jumps:0,anim:'idle',animTime:0,hit:0,shootTime:0,reload:0,fire:1.2+random(),inv:0,dash:0,dashCD:0,boss,role,state:'patrol',stateTime:0,home:x,patrol:1,think:0,cover:null,rounds:role==='heavy'?5:3,death:false,scale};
}
function setAnim(o,name){if(o.anim!==name){o.anim=name;o.animTime=0;}}
function animate(o,dt){if(tacticalMission()){const step=Math.abs(o.x-(o.motionX??o.x));o.motionX=o.x;o.motionSpeed=step<60?step/Math.max(dt,.001):0;if(o.ground&&!o.death&&step<60)o.gaitDistance=(o.gaitDistance||0)+step;o.shotAge=(o.shotAge||0)+dt;}let state=o.death?'death':o.dash>0?'dodge':o.hit>0?'hit':o.reload>0?'reload':!o.ground?(o.vy<0?'jump':'fall'):o.shootTime>0?'shoot':Math.abs(tacticalMission()?o.motionSpeed:o.vx)>10?'run':'idle';setAnim(o,state);o.animTime+=dt;}
function addPickup(x,y,kind,id){pickups.push({x,y,w:28,h:28,kind,id,taken:false});}
function loadLevel(index=sector,carry=null){
 AudioBank.resetTraps();sector=clamp(index,0,19);levelSeed=91009+sector*177;const L=LEVELS[sector];world=L.world;
 enemies=[];bullets=[];particles=[];pickups=[];platforms=[];covers=[];traps=[];flags=[];grenades=[];corpses=[];camera=0;checkpoint=100;pendingPickup=null;
 let gaps=[];
 const patterns={A:[[80,490,230]],B:[[245,450,235]],C:[[110,475,260]],D:[[300,480,220]],E:[[90,460,245]],F:[[210,490,240]]};
 L.layout.split('').forEach((code,i)=>{
  const x=500+i*570;if([2,6].includes(sector)&&i===3)gaps.push({a:x+240,b:x+330});
  patterns[code].forEach(([ox,y,w],j)=>platforms.push({x:x+ox,baseX:x+ox,y,w,h:24,moving:code==='E'&&sector>=4&&sector<8,phase:i,dx:0,oneWay:true}));
  covers.push({x:x+100,y:562,w:58,h:58,hp:100+sector*2,max:100+sector*2});
  const groundEnemy=actor(x+195,520,null,i%3===0&&sector>2?'heavy':i%3===1?'scout':'trooper');const archetype=campaignMonster(i);if(archetype!=='trooper')outfitEnemy(groundEnemy,archetype);groundEnemy.face=-1;enemies.push(groundEnemy);
  if(i%3===1||sector>11&&i===3){let p=platforms[platforms.length-1];let e=actor(p.x+30,p.y-94,null,'sniper');e.home=e.x;enemies.push(e);}
  if(i%2===1||sector>7&&i===2){const pool=sector<4?['steam','barrel','turret']:sector<8?['press','saw','piston','flame','barrel']:sector<12?['electric','acid','tesla','steam']:sector<16?['laser','mine','turret','ceiling']:['laser','electric','turret','tesla'];traps.push(createPackTrap(pool[(i+sector)%pool.length],x+430,i));}
  if(code==='B'&&sector>=4&&sector<12)platforms.push({x:x+220,baseX:x+220,y:485,baseY:485,w:115,h:24,elevator:true,phase:i,dx:0,dy:0,oneWay:true});
  addPickup(x+35,583,'ammo');if(i%2===0)addPickup(x+375,583,'health');else addPickup(x+385,583,'armor');
 });
 gaps.sort((a,b)=>a.a-b.a);let edge=0;for(const g of gaps){platforms.push({x:edge,y:620,w:g.a-edge,h:130,ground:true});edge=g.b;}platforms.push({x:edge,y:620,w:world-edge,h:130,ground:true});
 flags=[{x:1680,y:620,active:false},{x:2820,y:620,active:false}];
 for(const f of flags){addPickup(f.x+50,583,'health');addPickup(f.x+88,583,'ammo');}
 addPickup(335,584,'weapon',sector===0?'rifle':L.weapon);addPickup(2060,584,'weapon',L.weapon);addPickup(3050,584,'weapon',['shotgun','plasma','rail','rocket'][Math.floor(sector/5)]);
 addPickup(445,450,'armor');addPickup(1230,584,'grenade');addPickup(2540,584,'shield');
 const high=platforms.filter(p=>p.oneWay)[Math.min(3,platforms.filter(p=>p.oneWay).length-1)];addPickup(high.x+high.w-35,high.y-32,'secret');
 addCampaignWardens();
 player=Object.assign(actor(100,526),{hp:carry?Math.max(65,carry.hp):100,max:100,armor:carry?carry.armor:25,lives:carry?carry.lives:3,weapons:carry?carry.weapons:[weapon('pistol')],slot:carry?carry.slot:0,grenadeCount:carry?Math.max(2,carry.grenadeCount):3,shieldCharges:carry?carry.shieldCharges:1,shield:0,shieldCD:0,boss:null,role:'player',scale:1,fire:0});
 if(tacticalMission())FirstResponse.setup();else if(typeof FirstResponse!=='undefined')FirstResponse.reset();
 mode='play';overlay.style.display='none';statusLabel.textContent=`MISSION ${String(sector+1).padStart(2,'0')} / 20 — ${L.name.toUpperCase()}`;tell(tacticalMission()?(sector===0?'DISPATCH: A GANG TOOK OUR TECHNICIAN. GET HIM OUT.':Campaign.missions[sector-1].story):`${L.name.toUpperCase()}  /  ELIMINATE HOSTILES & EXTRACT`,4);
}
function begin(){canvas.focus?.();activateAudio();kills=0;score=0;secrets=0;loadLevel(0);save();sound(180,.25);window.GameMonetize?.requestAd();}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,sector,checkpoint,kills,score,secrets,operation:tacticalMission()?FirstResponse.snapshot():null,player:{hp:player.hp,armor:player.armor,lives:player.lives,weapons:player.weapons,slot:player.slot,grenadeCount:player.grenadeCount,shieldCharges:player.shieldCharges}}));}catch{}}
function readSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s?.version!==2||!Number.isInteger(s.sector)||s.sector<0||s.sector>19||!s.player||s.player.lives<1||s.player.lives>3||!Array.isArray(s.player.weapons)||s.player.weapons.length<1||s.player.weapons.length>2||s.player.weapons.some(w=>!WEAPONS[w.id]))return null;return s;}catch{return null;}}
function continueGame(){activateAudio();const s=readSave();if(!s)return begin();kills=s.kills||0;score=s.score||0;secrets=s.secrets||0;loadLevel(s.sector,s.player);checkpoint=[100,1680,2820].includes(s.checkpoint)?s.checkpoint:100;if(tacticalMission()){FirstResponse.restore(s.operation);if(!s.operation)checkpoint=100;}player.x=checkpoint;player.y=526;for(const f of flags)f.active=f.x<=checkpoint;camera=clamp(player.x-viewWidth()*.36,0,world-viewWidth());tell('CHECKPOINT RESTORED — HOSTILES REINFORCED');window.GameMonetize?.requestAd();}
function panel(title,message,button){overlay.style.display='flex';overlay.querySelector('.small').textContent=mode==='win'?'CAMPAIGN COMPLETE':'STEEL DIRECTIVE / CITY ZERO';overlay.querySelector('h2').innerHTML=title;overlay.querySelector('p').textContent=message;start.innerHTML=button+' <span>→</span>';document.querySelector('#continue').style.display=mode==='title'&&readSave()?'inline-block':'none';}
start.onclick=()=>{if(mode==='pause')pause();else begin();};document.querySelector('#continue').onclick=continueGame;
function pause(){if(mode==='play'){mode='pause';clearInput();AudioBank.pause();audio?.suspend?.();panel('HOLD<br><em>POSITION.</em>','P to resume · E collect weapon · Q swap · R reload · G grenade · F shield','RESUME MISSION');}else if(mode==='pause'){mode='play';AudioBank.resume();if(!muted)audio?.resume?.();overlay.style.display='none';canvas.focus?.();}}
document.querySelector('#pause-game').onclick=pause;
function jump(){if(mode==='play'&&player.jumps<(tacticalMission()?1:2)&&(!tacticalMission()||player.ground)&&!player.death){if(tacticalMission())FirstResponse.stand();player.vy=tacticalMission()?-580:-600;player.jumps++;player.ground=false;sfx('jump',300,.08,'triangle');burst(player.x+20,player.y+94,'#b8c8ad',5);}}
function dodge(){if(mode==='play'&&player.dashCD<=0&&!player.death){player.dash=tacticalMission()?.18:.3;player.inv=Math.max(player.inv,tacticalMission()?.22:.34);player.dashCD=tacticalMission()?1.5:1.15;if(tacticalMission()){FirstResponse.stand();if(player.ground&&covers.some(c=>c.hp>0&&(c.x-player.x)*player.face>-40&&Math.abs(c.x-player.x)<120)){player.vy=-520;player.dash=.5;player.ground=false;}}player.reload=0;sfx('dodge',100,.2,'triangle');}}
function reload(){if(mode!=='play'||player.reload>0||player.dash>0)return;const w=activeWeapon(),d=WEAPONS[w.id];if(w.ammo>=d.mag||w.reserve===0)return;player.reload=d.reload;player.reloadTotal=d.reload;sfx('reload',280,.08,'square',.012);}
function swap(slot){if(mode!=='play')return;player.slot=slot===undefined?(player.slot+1)%player.weapons.length:Math.min(slot,player.weapons.length-1);player.reload=0;player.fire=.16;sound(210,.08,'triangle');}
function collectWeapon(){if(mode!=='play')return;if(tacticalMission()&&FirstResponse.interact())return;if(!pendingPickup){const terminal=flags.find(f=>Math.abs(f.x-player.x)<85&&Math.abs(player.y+player.h-f.y)<100);if(terminal){if((terminal.cooldown||0)>time){tell('TERMINAL RECHARGING',1);return;}terminal.cooldown=time+25;terminal.offline=time+12;for(const t of traps)if(Math.abs(t.x-terminal.x)<750)t.disabled=12;AudioBank.play('shield',.3);tell('LOCAL HAZARDS OFFLINE / 12 SECONDS',2);}return;}const p=pendingPickup;let existing=player.weapons.find(w=>w.id===p.id);if(existing){if(existing.reserve!==-1)existing.reserve+=WEAPONS[p.id].mag*3;}else if(player.weapons.length<2){player.weapons.push(weapon(p.id));player.slot=player.weapons.length-1;}else{let old=activeWeapon();player.weapons[player.slot]=weapon(p.id);addPickup(p.x+50,p.y,'weapon',old.id);}player.reload=0;p.taken=true;pendingPickup=null;sound(550,.12,'triangle');tell(WEAPONS[p.id].short+' EQUIPPED');}
function useShield(){if(mode==='play'&&player.shieldCharges>0&&player.shield<=0){player.shieldCharges--;player.shield=4;sfx('shield',620,.4,'sine');tell('ENERGY SHIELD ACTIVE',1.5);}}
function throwGrenade(){if(mode!=='play'||player.grenadeCount<=0||player.grenadeCD>0)return;player.grenadeCount--;player.grenadeCD=.6;grenades.push({x:player.x+20,y:player.y+35,vx:player.face*440,vy:-380,life:1.2,w:12,h:12});sound(260,.08,'triangle');}
function action(key){if(key==='v'&&tacticalMission())FirstResponse.scan();if((key==='fire'||key==='j')&&mode==='play'&&player.fire<=0)firePlayer();if(key===' '||key==='w'||key==='arrowup')jump();if(key==='shift')dodge();if(key==='r')reload();if(key==='q')swap();if(key==='1')swap(0);if(key==='2')swap(1);if(key==='e')collectWeapon();if(key==='g')throwGrenade();if(key==='f')useShield();if(key==='p'||key==='escape')pause();if(key==='enter'&&['title','dead','win','review'].includes(mode))begin();}
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys[k]=true;if(!e.repeat)action(k);});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function clearInput(){Object.keys(keys).forEach(k=>keys[k]=false);mouse.down=false;}
window.addEventListener('blur',()=>{clearInput();if(mode==='play')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(mode==='play')pause();}});
function pointer(e){const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/W,r.height/H),ox=(r.width-W*scale)/2,oy=(r.height-H*scale)/2;mouse.x=(e.clientX-r.left-ox)/scale;mouse.y=(e.clientY-r.top-oy)/scale;const z=worldZoom();mouse.x/=z;mouse.y=(mouse.y-620*(1-z))/z;mouse.active=e.pointerType==='mouse';}
canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{pointer(e);mouse.down=true;if(mode==='play'&&player.fire<=0)firePlayer();canvas.setPointerCapture(e.pointerId);});window.addEventListener('pointerup',()=>mouse.down=false);canvas.addEventListener('pointercancel',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key.toLowerCase();b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[k]=true;mouse.active=false;action(k);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys[k]=false;});
document.querySelector('#sound').onclick=()=>{muted=!muted;AudioBank.setEnabled(!muted);document.querySelector('#sound').textContent=muted?'SOUND OFF':'SOUND ON';sound(350,.1,'triangle');};
document.querySelector('#fullscreen').onclick=()=>{const p=document.fullscreenElement?document.exitFullscreen():document.querySelector('#stage').requestFullscreen();p?.catch(()=>tell('Use your browser fullscreen control.'));};
document.querySelector('#quality').onclick=()=>{quality=quality==='high'?'low':'high';document.querySelector('#quality').textContent='FX '+quality.toUpperCase();};
function physics(o,dt){let oldY=o.y,oldX=o.x;o.x=clamp(o.x+o.vx*dt,0,world-o.w);for(const c of covers){if(c.hp>0&&overlap(o,c)){if(oldX+o.w<=c.x+2)o.x=c.x-o.w;else if(oldX>=c.x+c.w-2)o.x=c.x+c.w;}}
 o.vy=Math.min(o.vy+1600*dt,1100);o.y+=o.vy*dt;o.ground=false;
 for(const p of [...platforms,...covers.filter(c=>c.hp>0)]){if(o.x+o.w>p.x&&o.x<p.x+p.w&&oldY+o.h<=p.y+3&&o.y+o.h>=p.y&&o.vy>=0){o.y=p.y-o.h;o.vy=0;o.ground=true;if(p.dx)o.x+=p.dx;if(o===player)o.jumps=0;}}
}
function damage(amount,bypass=false){if(player.death||mode!=='play'||(!bypass&&(player.inv>0||player.shield>0)))return;if(!bypass){let absorbed=Math.min(player.armor,amount*.65);player.armor-=absorbed;amount-=absorbed;}player.hp=Math.max(0,player.hp-amount);player.hit=.2;player.inv=.65;shake=7;burst(player.x+20,player.y+35,'#ffc27c',8);sfx('hit',65,.16);if(player.hp<=0){sfx('death',45,.45);player.death=true;player.vx=0;player.lives--;deathTime=1.3;setAnim(player,'death');}}
function respawn(){if(player.lives<=0){mode='dead';try{localStorage.removeItem(SAVE_KEY);}catch{}panel('ENFORCER<br><em>OFFLINE.</em>',`Mission ${sector+1}/20 · ${kills} hostiles eliminated · Score ${score}`,'NEW CAMPAIGN');return;}player.x=checkpoint;if(tacticalMission()){player.h=94;player.crouching=false;}player.y=526;player.vx=player.vy=0;player.hp=100;player.armor=25;player.death=false;player.inv=2.5;player.hit=0;player.reload=0;player.dash=0;player.jumps=0;player.shield=0;for(const w of player.weapons){w.ammo=WEAPONS[w.id].mag;if(w.reserve!==-1)w.reserve=Math.max(w.reserve,WEAPONS[w.id].mag*2);}bullets=[];grenades=[];tell(`CHECKPOINT REDEPLOYMENT / ${player.lives} ${player.lives===1?'LIFE':'LIVES'} LEFT`,3);save();}
function killEnemy(e){if(e.death)return;e.death=true;e.hp=0;e.vx=0;if(tacticalMission())FirstResponse.killed(e);setAnim(e,'death');corpses.push(e);kills++;score+=e.boss==='boss'?1500:e.boss?700:100;addPickup(e.x,e.y+e.h-30,'ammo');if(random()<.22)addPickup(e.x+30,e.y+e.h-30,'health');burst(e.x+e.w/2,e.y+40,'#d9945d',16);enemyVoice(e,'enemy-death',.95);}
function hitEnemy(e,n,sourceX=null){if(e.death)return;if(tacticalMission())n*=FirstResponse.damageMultiplier(e);if(e.pack==='shield'&&sourceX!==null&&(sourceX-e.x-e.w/2)*e.face>0&&e.reload<=0){n*=.22;e.blockFlash=.18;AudioBank.play('impact',.14);}e.hp-=n;if(e.hp>0&&time>=(e.nextVoice||0)){enemyVoice(e,'enemy-hit',.55);e.nextVoice=time+.65;}e.hit=.16;e.fire=Math.max(.16,e.fire);if(e.hp<=0)killEnemy(e);}
function rayBox(x1,y1,x2,y2,r){let t0=0,t1=1,dx=x2-x1,dy=y2-y1;for(const [p,q] of [[-dx,x1-r.x],[dx,r.x+r.w-x1],[-dy,y1-r.y],[dy,r.y+r.h-y1]]){if(Math.abs(p)<1e-9){if(q<0)return false;}else{let t=q/p;if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1)return false;}}return true;}
function blocked(x1,y1,x2,y2){return covers.some(c=>c.hp>0&&rayBox(x1,y1,x2,y2,c));}
function firePlayer(){if(player.reload>0||player.dash>0||player.death)return;if(tacticalMission())FirstResponse.stance();const w=activeWeapon(),d=WEAPONS[w.id];if(w.ammo<=0){reload();if(w.reserve===0&&player.fire<=0){tell('OUT OF AMMO — SWAP WEAPON / COLLECT AMMO',1);player.fire=.4;}return;}w.ammo--;player.fire=d.rate;player.shootTime=.16;player.shotAge=0;
 const muzzleY=tacticalMission()&&player.crouching?player.y+player.h-62:player.y+34;
 let a=mouse.active?Math.atan2(mouse.y-(muzzleY),mouse.x+camera-(player.x+20)):(player.face>0?0:Math.PI);if(!mouse.active){const target=enemies.filter(e=>!e.death&&(e.x-player.x)*player.face>0&&Math.abs(e.x-player.x)<650&&Math.abs(e.y+e.h*.45-muzzleY)<(tacticalMission()?370:190)&&!blocked(player.x+20,muzzleY,e.x+e.w/2,e.y+e.h*.45)).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];if(target)a=Math.atan2(target.y+target.h*.45-muzzleY,target.x+target.w/2-player.x-20);}player.face=Math.cos(a)>=0?1:-1;
 for(let i=0;i<d.pellets;i++){let spread=(d.pellets>1?i-(d.pellets-1)/2:random()-.5)*d.spread,ang=a+spread;bullets.push({x:player.x+20+Math.cos(a)*40,y:muzzleY+Math.sin(a)*40,vx:Math.cos(ang)*d.speed,vy:Math.sin(ang)*d.speed,life:w.id==='shotgun'?.46:1.3,damage:d.damage,enemy:false,color:d.color,blast:d.blast||0,pierce:!!d.pierce,hits:new Set(),w:5,h:5});}shake=d.blast?5:d.pellets>1?3:1;sfx(w.id,d.freq,.1);burst(player.x+20+Math.cos(a)*60,muzzleY+Math.sin(a)*60,d.color,3);
}
function explode(x,y,radius,damageValue,enemy=false){burst(x,y,'#ffc575',32);burst(x,y,'#64544b',10,true);shake=9;sfx('explosion',45,.35);if(enemy){if(Math.hypot(player.x+20-x,player.y+47-y)<radius)damage(damageValue);}else for(const e of enemies){let dist=Math.hypot(e.x+e.w/2-x,e.y+e.h/2-y);if(!e.death&&dist<radius)hitEnemy(e,damageValue*(1-dist/radius*.5));}for(const c of covers){if(Math.hypot(c.x+c.w/2-x,c.y+c.h/2-y)<radius)c.hp-=damageValue;}for(const t of traps)if(t.kind==='barrel'&&!t.destroyed&&Math.hypot(t.x+t.w/2-x,t.y-35-y)<radius)detonateBarrel(t);}
function changeState(e,state){if(e.state!==state){e.state=state;e.stateTime=0;}}
function enemyAI(e,dt){if(tacticalMission()&&e.tacticalRole){FirstResponse.enemy(e,dt);return;}if(e.bossId){wardenAI(e,dt);return;}if(e.pack&&packEnemyAI(e,dt))return;e.stateTime+=dt;e.think-=dt;e.fire-=dt;e.hit=Math.max(0,e.hit-dt);e.shootTime=Math.max(0,e.shootTime-dt);if(e.reload>0){e.reload-=dt;if(e.reload<=0)e.rounds=e.boss?7:e.role==='heavy'?5:3;}
 const dx=player.x-e.x,dy=player.y-e.y,dist=Math.abs(dx),awareness=e.role==='sniper'?950:sector>=6?980:720;
 const sight=!blocked(e.x+e.w/2,e.y+30,player.x+20,player.y+40);
 if(e.think<=0){e.think=.18+random()*.12;
  if(dist>awareness||player.death)changeState(e,'patrol');
  else if(e.hp/e.max<.3&&dist<330&&!e.boss)changeState(e,'retreat');
  else if(sector>=6&&!e.boss&&!sight&&e.reload<=0)changeState(e,'chase');
  else if(!e.boss&&(e.reload>0||e.hit>0||!sight)&&dist<650){e.cover=covers.filter(c=>c.hp>0&&Math.abs(c.x-e.x)<340&&Math.abs(c.y+c.h-e.y-e.h)<50).sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];changeState(e,e.cover?'cover':'chase');}
  else if(dist< (e.role==='sniper'?820:470)&&Math.abs(dy)<260&&sight)changeState(e,'attack');else changeState(e,'chase');
 }
 e.vx=0;let speed=e.pack==='gatling'?55:e.pack==='shield'?65:e.role==='scout'?140:90+sector*2;if(sector>=6)speed*=1+Math.min(.3,(sector-5)*.025);
 if(e.state==='patrol'){if(e.x>e.home+100)e.patrol=-1;if(e.x<e.home-100)e.patrol=1;e.vx=e.patrol*40;e.face=e.patrol;}
 else{e.face=dx>=0?1:-1;if(e.state==='chase')e.vx=e.face*speed;if(e.state==='retreat')e.vx=-e.face*speed*1.25;if(e.state==='cover'&&e.cover){let target=dx>0?e.cover.x-e.w-6:e.cover.x+e.cover.w+6;if(Math.abs(e.x-target)>9)e.vx=Math.sign(target-e.x)*speed;else if(e.reload<=0&&e.stateTime>1.2)changeState(e,'attack');}}
 let feet=e.x+e.w/2+Math.sign(e.vx)*45;
 if(e.ground&&e.vx&&!platforms.some(p=>feet>p.x&&feet<p.x+p.w&&Math.abs(p.y-e.y-e.h)<12)){
  let landing=platforms.some(p=>p.y>=e.y+e.h-70&&p.y<=e.y+e.h+110&&((e.vx>0&&p.x>e.x&&p.x-e.x<220)||(e.vx<0&&p.x+p.w<e.x&&e.x-p.x-p.w<220)));
  if(landing&&e.state!=='patrol'){e.vy=-550;e.ground=false;}else{e.vx=0;e.patrol*=-1;}
 }
 if(e.ground&&e.state==='chase'&&covers.some(c=>c.hp>0&&Math.abs((e.face>0?c.x:c.x+c.w)-(e.face>0?e.x+e.w:e.x))<16))e.vy=-480;
 if(e.boss&&e.hp/e.max<.45&&e.ground&&e.stateTime>2.5&&dist<500){e.vy=-460;e.vx=e.face*210;e.stateTime=0;burst(e.x+e.w/2,e.y+e.h,'#ffc593',14);}
 physics(e,dt);if(e.y>800){killEnemy(e);return;}
 if(e.pack==='gatling'){if(e.state==='attack'&&sight&&e.reload<=0)e.spin=Math.min(1,e.spin+dt);else e.spin=Math.max(0,e.spin-dt*2);}
 if((e.state==='attack'||e.state==='retreat'||(e.boss&&dist<900))&&e.fire<=0&&e.reload<=0&&sight&&(sector<6||(e.x+e.w>=camera&&e.x<=camera+viewWidth()))&&(e.pack!=='gatling'||e.spin>=.85)){
  const a=Math.atan2(player.y+38-(e.y+33),player.x+20-(e.x+e.w/2)),count=e.boss==='boss'?(e.hp/e.max<.45?5:3):e.boss?3:1;
  for(let i=0;i<count;i++){let angle=a+(i-(count-1)/2)*.16;bullets.push({x:e.x+e.w/2+Math.cos(angle)*40,y:e.y+33,vx:Math.cos(angle)*(310+sector*5),vy:Math.sin(angle)*(310+sector*5),life:3,enemy:true,damage:e.boss?18:10+sector*.35,color:e.boss?'#ff764e':'#ffc765',w:10,h:10});}
  if(Math.abs(e.x-player.x)<800)AudioBank.play('enemy-shot',.25);e.shootTime=.2;e.rounds--;e.fire=e.pack==='gatling'?.12:e.boss?.65:Math.max(.55,1.4-sector*.025);if(e.pack==='gatling'){e.burstShots++;if(e.burstShots>=10){e.reload=2.2;e.burstShots=0;e.spin=0;}}else if(e.rounds<=0)e.reload=e.boss?1.6:1.8;e.reloadTotal=e.reload;
 }if(overlap(player,e))damage(e.boss?22:12);animate(e,dt);
}
function updateProjectiles(dt){for(const b of bullets){let x=b.x,y=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(!b.enemy){const barrel=traps.find(t=>t.kind==='barrel'&&!t.destroyed&&rayBox(x,y,b.x,b.y,{x:t.x,y:t.y-68,w:t.w,h:68}));if(barrel){barrel.hp-=b.damage;if(barrel.hp<=0)detonateBarrel(barrel);b.life=0;continue;}}
  let obstacle=covers.find(c=>c.hp>0&&rayBox(x,y,b.x,b.y,c));if(!obstacle)obstacle=platforms.find(p=>!p.projectilePassThrough&&rayBox(x,y,b.x,b.y,p));
  if(obstacle){if(time-AudioBank.lastImpact>.08&&Math.abs(b.x-player.x)<700){AudioBank.play('impact',.22);AudioBank.lastImpact=time;}if(obstacle.hp)obstacle.hp-=b.damage||10;if(b.blast)explode(b.x,b.y,b.blast,b.damage);else burst(b.x,b.y,b.color,4);b.life=0;continue;}
  if(b.enemy){if(rayBox(x,y,b.x,b.y,{x:player.x,y:player.y+(player.dash>0?45:0),w:player.w,h:player.dash>0?49:player.h})){damage(b.damage);b.life=0;}}
  else for(const e of enemies){if(e.death||b.life<=0||b.hits.has(e))continue;const target=e.state==='cover'&&Math.abs(e.vx)<5?{x:e.x,y:e.y+38,w:e.w,h:e.h-38}:e;if(rayBox(x,y,b.x,b.y,target)){b.hits.add(e);if(b.blast)explode(b.x,b.y,b.blast,b.damage);else hitEnemy(e,b.damage,x);burst(b.x,b.y,b.color,5);if(!b.pierce)b.life=0;}}
 }bullets=bullets.filter(b=>b.life>0&&b.x>-100&&b.x<world+100);
 for(const g of grenades){let py=g.y;g.vy+=1100*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.life-=dt;for(const p of platforms){if(g.x>p.x&&g.x<p.x+p.w&&py+12<=p.y&&g.y+12>=p.y){g.y=p.y-12;g.vy=-Math.abs(g.vy)*.45;g.vx*=.6;}}if(g.life<=0)explode(g.x,g.y,180,160);}grenades=grenades.filter(g=>g.life>0);
}
function updatePickups(){pendingPickup=null;for(const p of pickups){if(p.taken)continue;if(p.kind==='weapon'){if(Math.hypot(p.x-player.x,p.y-player.y-60)<85)pendingPickup=p;continue;}if(!overlap(player,p))continue;
 if(p.kind==='health'){if(player.hp>=100)continue;player.hp=Math.min(100,player.hp+35);}
 if(p.kind==='armor'){if(player.armor>=100)continue;player.armor=Math.min(100,player.armor+40);}
 if(p.kind==='ammo')for(const w of player.weapons)if(w.reserve!==-1)w.reserve=Math.min(WEAPONS[w.id].reserve*2,w.reserve+WEAPONS[w.id].mag*2);
 if(p.kind==='grenade')player.grenadeCount=Math.min(9,player.grenadeCount+2);
 if(p.kind==='shield')player.shieldCharges=Math.min(5,player.shieldCharges+1);
 if(p.kind==='secret'){secrets++;score+=500;player.shieldCharges=Math.min(5,player.shieldCharges+1);tell('ENCRYPTED EVIDENCE / +500 SCORE +1 SHIELD');}
 p.taken=true;sfx('pickup',650,.09,'triangle');burst(p.x+14,p.y+14,'#afd5bc',8);
 }pickups=pickups.filter(p=>!p.taken);
}
function update(dt){if(mode==='title'){time+=dt;return;}if(mode!=='play'&&mode!=='dying')return;time+=dt;noticeTime-=dt;shake=Math.max(0,shake-dt*25);
 for(const p of platforms){if(p.moving){let old=p.x;p.x=p.baseX+Math.sin(time*.8+p.phase)*42;p.dx=p.x-old;}if(p.elevator){const old=p.y;p.y=p.baseY+Math.sin(time*.8+p.phase)*60;p.dy=p.y-old;for(const o of [player,...enemies])if(o.ground&&o.x+o.w>p.x&&o.x<p.x+p.w&&Math.abs(o.y+o.h-old)<4)o.y+=p.dy;}}
 let electricLevel=0,steamLevel=0;
 for(const t of traps){if(t.pack){updatePackTrap(t,dt);const gain=Math.max(0,1-Math.abs(t.x-player.x)/650);if(t.active&&['electric','tesla','laser'].includes(t.kind))electricLevel=Math.max(electricLevel,gain);if(t.active&&['steam','acid','flame','geyser','saw'].includes(t.kind))steamLevel=Math.max(steamLevel,gain*.6);continue;}const wasActive=t.active,wasWarn=t.warn;let phase=(time+t.phase)%t.period;t.active=phase>t.period*.68;t.warn=phase>t.period*.48&&!t.active;
 const gain=Math.max(0,1-Math.abs(t.x+t.w/2-player.x-player.w/2)/650);
 if(gain>0){if(t.warn&&!wasWarn)AudioBank.play('trap-warning',gain*.2);if(t.kind==='press'&&t.active&&!wasActive)AudioBank.play('press',gain*.75);if(t.kind==='press'&&wasActive&&!t.active)AudioBank.play('press-release',gain*.38);}
 if(t.active&&t.kind==='electric')electricLevel=Math.max(electricLevel,gain);if(t.active&&t.kind==='steam')steamLevel=Math.max(steamLevel,gain);
 if(t.active&&overlap(player,{x:t.x,y:t.y-t.h,w:t.w,h:t.h}))damage(t.kind==='press'?38:16);}
 AudioBank.trapLevels(electricLevel,steamLevel);
 for(const name of ['fire','inv','hit','shootTime','dash','dashCD','shield','shieldCD','grenadeCD'])player[name]=Math.max(0,(player[name]||0)-dt);
 if(player.death){deathTime-=dt;animate(player,dt);if(deathTime<=0)respawn();}
 else{
  if(player.reload>0){player.reload-=dt;if(player.reload<=0){let w=activeWeapon(),d=WEAPONS[w.id],n=w.reserve===-1?d.mag-w.ammo:Math.min(d.mag-w.ammo,w.reserve);w.ammo+=n;if(w.reserve!==-1)w.reserve-=n;sound(360,.06,'square',.01);}}
  if(tacticalMission())FirstResponse.stance();
  const dir=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);if(dir&&!mouse.down)player.face=dir;if(tacticalMission()){const desired=dir*155;if(player.crouching)player.vx=0;else if(player.dash>0)player.vx=player.face*410;else{const acceleration=dir?780:1500;player.vx+=clamp(desired-player.vx,-acceleration*dt,acceleration*dt);if(!dir&&Math.abs(player.vx)<1)player.vx=0;}}else player.vx=player.dash>0?player.face*730:dir*265;if(player.dash>0)player.vy=Math.min(0,player.vy);
  physics(player,dt);if(tacticalMission()){const step=Math.abs(player.x-(player.motionX??player.x));if(player.ground&&step<60){player.stepTravel=(player.stepTravel||0)+step;if(player.stepTravel>=55){player.stepTravel%=55;AudioBank.play('footsteps',.12);}}}else if(player.ground&&Math.abs(player.vx)>20&&time-AudioBank.lastStep>.31){AudioBank.play('footsteps',.12);AudioBank.lastStep=time;}if(player.y>800){player.inv=0;damage(1000,true);}
  if((mouse.down||keys.j||keys.fire)&&player.fire<=0)firePlayer();
  updatePickups();for(const f of flags){if(!f.active&&player.x>f.x&&player.ground){f.active=true;checkpoint=f.x;save();tell('CHECKPOINT SECURED / PROGRESS SAVED');sound(550,.2,'sine');}}
  animate(player,dt);
 }
 for(const e of enemies)if(!e.death&&Math.abs(e.x-player.x)<1500)enemyAI(e,dt);enemies=enemies.filter(e=>!e.death);
 for(const e of corpses){e.animTime+=dt;if(e.y+e.h<620)physics(e,dt);}corpses=corpses.filter(e=>e.animTime<8).slice(-16);
 updateProjectiles(dt);if(tacticalMission())FirstResponse.update(dt);for(const s of particles){s.x+=s.vx*dt;s.y+=s.vy*dt;if(!s.smoke)s.vy+=680*dt;s.life-=dt;}particles=particles.filter(s=>s.life>0);
 camera+= (clamp(player.x-viewWidth()*.36,0,world-viewWidth())-camera)*Math.min(1,dt*8);
 if(!player.death&&extractionReady()&&player.x>world-180){if(tacticalMission()){FirstResponse.complete();return;}if(sector<19){const carry={...player,weapons:player.weapons};loadLevel(sector+1,carry);save();sound(600,.25,'triangle');window.GameMonetize?.requestAd();}else{mode='win';try{localStorage.removeItem(SAVE_KEY);}catch{}panel('CITY ZERO<br><em>RECLAIMED.</em>',`20 missions complete · ${kills} kills · ${secrets} secrets · Score ${score}`,'NEW CAMPAIGN');}}
}

function sfx(name,freq=150,duration=.1,type='sawtooth',volume=.035){if(!muted&&AudioBank.play(name,WEAPONS[name] ? .65 : name==='explosion' ? .58 : .4))return;sound(freq,duration,type,volume);}

function activateAudio(){muted=!AudioBank.preference;AudioBank.suspended=false;AudioBank.setEnabled(!muted);document.querySelector('#sound').textContent=muted?'SOUND OFF':'SOUND ON';}
for(const channel of ['music','effects']){const slider=document.querySelector('#'+channel+'-volume');slider.value=String(Math.round(AudioBank[channel==='music'?'musicVolume':'effectsVolume']*100));slider.oninput=()=>AudioBank.setVolume(channel,Number(slider.value)/100);}

function enemyVoice(e,key,volume){const distance=Math.abs(e.x-player.x);if(distance>1000)return;AudioBank.play(key,volume*Math.max(.25,1-distance/1200));}
