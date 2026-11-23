/* MINI SOCCER 3D — deterministic, lightweight arcade match simulation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoccerCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const BALL_RADIUS=.648,CARRY_OFFSET=1.152,GOAL_DEPTH=2.35,ARCADE_PACE=1.24,PLAYER_SPEED=6.5*ARCADE_PACE;
  const CARRY_SPEED=.93,SLIDE_TIME=.45,SLIDE_SPEED=18.5,SPRINT_MULT=1.3,SKILL_TIME=.45;
  const DIFFICULTY = [
    { name: 'EASY', reaction: .66, aim: 2.1, passing: .3, aggression: .22, error: .32, slide: .07, smart: .28 },
    { name: 'NORMAL', reaction: .52, aim: 1.7, passing: .4, aggression: .3, error: .24, slide: .12, smart: .42 },
    { name: 'HARD', reaction: .36, aim: 1.2, passing: .55, aggression: .46, error: .15, slide: .28, smart: .62 }
  ];
  // The player's own AI teammates (and keeper) always play at a solid, friendly level.
  const ALLY = { name: 'ALLY', reaction: .28, aim: 1.0, passing: .65, aggression: .6, error: .08, slide: .35, smart: .8 };
  const TEAMS = [
    ['ITALY','ITA','#0862f4','#ffffff','#eeeeee','italy'],
    ['BRAZIL','BRA','#ffdc21','#08793e','#10924d','brazil'],
    ['ARGENTINA','ARG','#69c6ff','#f4faff','#ffffff','argentina'],
    ['FRANCE','FRA','#1248d8','#f5f5ff','#ffffff','france'],
    ['GERMANY','GER','#f3f4f5','#222634','#222634','germany'],
    ['SPAIN','ESP','#e51b36','#173c83','#f4ca22','spain'],
    ['ENGLAND','ENG','#ffffff','#153884','#ffffff','england'],
    ['PORTUGAL','POR','#cf2236','#17653d','#17653d','portugal'],
    ['NETHERLANDS','NED','#ff8420','#182948','#182948','netherlands'],
    ['BELGIUM','BEL','#d82235','#19222f','#f6cd30','belgium'],
    ['CROATIA','CRO','#ffffff','#1360d3','#e62739','croatia'],
    ['URUGUAY','URU','#68c8f1','#24293a','#ffffff','uruguay'],
    ['MEXICO','MEX','#12834c','#ffffff','#ca2634','mexico'],
    ['USA','USA','#f3f6ff','#172d65','#d82235','usa'],
    ['JAPAN','JPN','#193fd2','#ffffff','#ffffff','japan'],
    ['SOUTH KOREA','KOR','#e3434d','#232735','#ffffff','korea'],
    ['MOROCCO','MAR','#d5283b','#0d7c4b','#0d7c4b','morocco'],
    ['AUSTRALIA','AUS','#ffcf29','#07613f','#07613f','australia']
  ].map((t, id) => ({ id, name:t[0], code:t[1], shirt:t[2], shorts:t[3], trim:t[4], flag:t[5] }));
  // Away kits: used automatically whenever the two first kits would look alike.
  const ALT = {
    ITA:['#f6f7fb','#0b3fb3','#0862f4'], BRA:['#1b4fd1','#ffffff','#ffdc21'], ARG:['#1d2340','#111522','#69c6ff'],
    FRA:['#f6f7fb','#13245c','#e51b36'], GER:['#20232b','#111317','#e51b36'], ESP:['#f6f2e4','#173c83','#e51b36'],
    ENG:['#d32030','#ffffff','#153884'], POR:['#f6f7fb','#17653d','#cf2236'], NED:['#1f2b57','#ff8420','#ff8420'],
    BEL:['#f6f7fb','#d82235','#d82235'], CRO:['#1a2a5c','#1a2a5c','#e62739'], URU:['#f6f7fb','#24293a','#68c8f1'],
    MEX:['#f6f7fb','#8c1d2c','#12834c'], USA:['#1a2d6b','#1a2d6b','#d82235'], JPN:['#f6f7fb','#193fd2','#193fd2'],
    KOR:['#232735','#232735','#e3434d'], MAR:['#f6f7fb','#0d7c4b','#d5283b'], AUS:['#102a5c','#102a5c','#ffcf29']
  };
  function rgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
  // Weighted RGB distance (close to perceived difference for kit colours).
  function colorGap(a,b){const x=rgb(a),y=rgb(b),r=(x[0]+y[0])/2,dr=x[0]-y[0],dg=x[1]-y[1],db=x[2]-y[2];return Math.sqrt((2+r/256)*dr*dr+4*dg*dg+(2+(255-r)/256)*db*db);}
  const CLASH=260;
  function kitsFor(a,b){
    const home={...TEAMS[a]},away={...TEAMS[b]};
    if(colorGap(home.shirt,away.shirt)<CLASH){
      const alt=ALT[away.code];
      const options=[[alt[0],alt[1],alt[2]],['#f6f7fb','#2a2f3d','#2a2f3d'],['#20232b','#111317','#ffffff'],['#ff8a00','#20232b','#20232b'],['#d32030','#ffffff','#ffffff']];
      let best=options[0],gap=-1;
      for(const o of options){const g=colorGap(home.shirt,o[0]);if(g>=CLASH){best=o;gap=g;break;}if(g>gap){gap=g;best=o;}}
      away.shirt=best[0];away.shorts=best[1];away.trim=best[2];away.alt=true;
    }
    return [home,away];
  }
  // Distance from point c to segment a-b (used to read blocked passing and shooting lanes).
  function segmentDistance(a,b,c){
    const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz||1,t=clamp(((c.x-a.x)*dx+(c.z-a.z)*dz)/len,0,1);
    return Math.hypot(a.x+dx*t-c.x,a.z+dz*t-c.z);
  }
  class Match {
    constructor(options = {}) {
      this.rng = options.random || Math.random;
      this.difficulty = DIFFICULTY[options.difficulty ?? 1];
      this.teams = options.teams || [0, 1];
      this.duration = options.duration || 150;
      this.autoPlay = !!options.autoPlay;
      this.time = this.duration;
      this.elapsed = 0;
      this.score = [0,0];
      this.stats = { shots:[0,0], supers:[0,0], passes:[0,0], saves:[0,0], steals:[0,0], possession:[0,0], tackles:[0,0] };
      this.events = [];
      this.players = [];
      for (let team=0; team<2; team++) for (let slot=0; slot<4; slot++) {
        this.players.push({ id:team*4+slot, team, slot, keeper:slot===3,
          x:0,z:0,vx:0,vz:0,fx:team===0?1:-1,fz:0,
          tx:0,tz:0,think:0,stun:0,lock:0,holding:0,aiCharge:0,chargeTarget:0,aimZ:null,dive:0,diveDir:1,diveTarget:0,diveWait:0,diveCooldown:0,readBias:0,bumpTime:0,kickTime:0,kickDuration:.32,kickKind:'pass',
          slide:0,slideX:1,slideZ:0,slideCool:0,slideHit:false,down:0,chase:null,skill:0,skillCool:0,skillDir:1,saveBoost:0,ko:0,koTotal:2.6,lunge:0,backoff:0,lungeClock:0,protect:0,phase:this.rng()*6.28 });
      }
      this.ball = {x:0,z:0,y:BALL_RADIUS,vx:0,vz:0,vy:0,owner:null,lock:0,super:0,flight:0,passTo:null,lastTouch:0,shot:false,fullShot:false,after:0,spin:0};
      this.stamina = 1;
      this.sprinting = false;
      this.timeScale = 1;
      this.controlled = 0;
      this.charging = false;
      this.charge = 0;
      this.bufferPass = 0;
      this.end = false;
      this.overtime = false;
      this.tournament = !!options.tournament;
      this.goalDelay = 0;
      this.goalBall=null;
      this.countdown = 2.2;
      this.kickoff(0);
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { return this.events.splice(0); }
    isUser(p) { return !this.autoPlay && p.team===0 && p.id===this.controlled; }
    kickoff(team) {
      this.players.forEach(p => {
        const d=p.team===0?1:-1;
        p.x = p.keeper ? -d*22.0 : [-3,-10,-10][p.slot]*d;
        p.z = p.keeper ? 0 : [0,-8,8][p.slot];
        p.tx=p.x;p.tz=p.z;p.vx=p.vz=p.stun=p.holding=p.aiCharge=p.lock=p.dive=p.diveWait=p.diveCooldown=p.readBias=p.bumpTime=p.kickTime=0;
        p.slide=p.slideCool=p.down=p.skill=p.skillCool=p.saveBoost=p.ko=p.lunge=p.backoff=p.protect=0;p.lungeClock=.5;p.chase=null;p.aimZ=null;
        p.fx=d;p.fz=0;p.think=.35+this.rng()*.3;
      });
      const p=this.players[team*4];p.x=-.7*(team===0?1:-1);p.z=0;
      Object.assign(this.ball,{x:0,z:0,y:BALL_RADIUS,vx:0,vz:0,vy:0,owner:p.id,lock:0,super:0,flight:0,passTo:null,lastTouch:team,shot:false,fullShot:false,after:0,spin:0});this.goalBall=null;
      this.controlled=0;this.cancelCharge();this.bufferPass=0;
    }
    cancelCharge() { this.charging=false;this.charge=0; }
    startCharge() {
      if(this.end || this.goalDelay>0 || this.countdown>0) return;
      if (this.ball.owner === this.controlled) { this.charging=true;this.charge=0; }
    }
    releaseCharge() {
      if (!this.charging) return;
      const p=this.players[this.controlled], charge=this.charge;
      this.cancelCharge();
      if (this.ball.owner===p.id) this.shoot(p,charge);
    }
    // Context action for the SHOOT button: shoot when holding the ball, slide tackle when defending.
    userAction(dx=0,dz=0) {
      if(this.end || this.goalDelay>0 || this.countdown>0) return 'none';
      const p=this.players[this.controlled];
      if(this.ball.owner===p.id){this.startCharge();return 'charge';}
      if(this.userKeeperHolds()){this.keeperDistribute(true);return 'longkick';}
      // Defending: SHOOT never tackles. It helps the keeper only when a shot is flying in, otherwise switches player.
      if(this.saveWindow()&&this.userSave())return 'save';
      this.switchPlayer(true);return 'switch';
    }
    // PASS button: pass with the ball, slide tackle without it.
    userPassOrTackle(dx=0,dz=0) {
      if(this.end || this.goalDelay>0 || this.countdown>0) return 'none';
      const p=this.players[this.controlled];
      if(this.ball.owner===p.id){this.cancelCharge();this.passFrom(p);return 'pass';}
      if(this.userKeeperHolds()){this.keeperDistribute(false,dx,dz);return 'pass';}
      if(this.ball.owner===null&&this.ball.passTo!==null&&this.players[this.ball.passTo].team===0){this.bufferPass=.5;return 'buffer';}
      return this.tackle(p,dx,dz)?'tackle':'none';
    }
    // "Help the keeper": a shot is flying at our goal and the keeper can still be told where to dive.
    saveWindow() {
      const b=this.ball,k=this.players[3];
      if(this.autoPlay||b.owner!==null||!b.shot||b.vx>-8||b.x>4||k.dive>0||k.saveBoost>0)return false;
      const arrival=(k.x-b.x)/b.vx;
      return arrival>0&&arrival<1.1&&Math.abs(b.z+b.vz*arrival)<5;
    }
    userSave() {
      const b=this.ball,k=this.players[3];
      const arrival=clamp((k.x-b.x)/b.vx,0,2),z=clamp(b.z+b.vz*arrival,-3.9,3.9);
      k.diveCooldown=0;k.dive=0;k.readBias=0;k.diveWait=-.001;k.saveBoost=.9;
      if(arrival<.45)this.startDive(k,z);else{k.tz=z;k.think=arrival-.4;}
      this.emit('usersave',{x:k.x,z:k.z});return true;
    }
    setSprint(on) { this.sprinting=!!on; }
    userKeeperHolds() { return !this.autoPlay&&this.ball.owner===3&&this.players[3].dive===0; }
    keeperDistribute(long,dx=0,dz=0) {
      const k=this.players[3];if(k.holding<.25)return;
      const m=Math.hypot(dx,dz);if(m>.2){k.fx=dx/m;k.fz=dz/m;}else{k.fx=1;k.fz=0;}
      if(long){const mates=this.fieldPlayers(0).filter(q=>q.down<=0);const far=mates.sort((a,b)=>b.x-a.x)[0];if(far)this.passFrom(k,far);}
      else this.passFrom(k);
      k.fx=1;k.fz=0;
    }
    // Skill move (trick turn): a short burst that beats a tackle.
    skillMove(p) {
      if(p.skillCool>0||p.slide>0||p.down>0||this.ball.owner!==p.id||p.keeper)return false;
      const {q:e,d}=this.nearestEnemy(p);
      p.skill=SKILL_TIME;p.skillCool=2.2;
      p.skillDir=e&&d<4?(((e.z-p.z)*p.fx-(e.x-p.x)*p.fz)>0?-1:1):(this.rng()<.5?-1:1);
      this.emit('skill',{player:p.id,x:p.x,z:p.z,team:p.team});return true;
    }
    choosePassTarget(p) {
      const mates=this.players.filter(q=>q.team===p.team&&!q.keeper&&q.id!==p.id&&q.down<=0);
      if(!mates.length)return null;
      const d=p.team===0?1:-1,human=this.isUser(p)||(p.team===0&&!this.autoPlay&&p.keeper);
      let target=mates[0],best=-Infinity;
      for(const q of mates){
        const dx=q.x-p.x,dz=q.z-p.z,dist=Math.hypot(dx,dz)||1;
        const facing=(dx*p.fx+dz*p.fz)/dist;
        const open=Math.min(...this.players.filter(o=>o.team!==p.team).map(o=>distance(q,o)));
        const lane=this.laneOpen(p,q,p.team);
        const s=(human?facing*7:facing*1.5+d*(q.x-p.x)*.22)+Math.min(open,7)*.65-dist*.12+(lane<1.1?-3.5:0);
        if(s>best){best=s;target=q;}
      }
      return target;
    }
    // Deterministic part of the player's aim, shared by the shot and the on-pitch aiming line.
    aimFor(p) {
      const direction=p.team===0?1:-1,goalX=direction*24.8;
      if(p.fx*direction<.25)return {x:p.x+p.fx*25,z:p.z+p.fz*25};
      return {x:goalX,z:clamp(p.z*.16+Math.sign(p.fz)*Math.min(2.45,Math.abs(p.fz)*6.5),-4.6,4.6)};
    }
    switchPlayer(force=false) {
      if (this.ball.owner!==null && this.players[this.ball.owner].team===0 && !this.players[this.ball.owner].keeper) {
        this.controlled=this.ball.owner;return;
      }
      const cur=this.players[this.controlled];
      if(!force&&cur.slide>0)return;
      const b=this.ball,target=b.owner===null?{x:b.x+b.vx*.3,z:b.z+b.vz*.3}:this.players[b.owner];
      let best=this.controlled,bestScore=Infinity;
      for(const p of this.players.filter(p=>p.team===0&&!p.keeper)) {
        const goalSide=b.owner!==null&&this.players[b.owner].team===1&&p.x<target.x?-1.2:0;
        const s=distance(p,target)+(p.id===this.controlled&&!force?-2.8:0)+(p.id===this.controlled&&force?50:0)+(p.stun+p.down)*6+goalSide;
        if(s<bestScore){best=p.id;bestScore=s;}
      }
      if(best!==this.controlled) { this.controlled=best;this.cancelCharge();this.emit('switch'); }
    }
    pass() {
      if(this.countdown>0 || this.goalDelay>0 || this.end) return;
      const p=this.players[this.controlled];
      if(this.ball.owner===p.id){this.cancelCharge();this.passFrom(p);}
      else if(this.ball.owner===null && this.ball.passTo!==null) this.bufferPass=.5;
      else this.switchPlayer(true);
    }
    laneOpen(from,to,team){
      let open=Infinity;
      for(const o of this.players)if(o.team!==team)open=Math.min(open,segmentDistance(from,to,o));
      return open;
    }
    passFrom(p,forced=null) {
      const target=forced||this.choosePassTarget(p);
      if(!target)return;
      const error=p.team===1||this.autoPlay?(this.rng()-.5)*this.difficulty.aim*.9:0;
      // Lead the receiver: through balls into the space ahead of a running mate.
      const lead=.24+Math.min(.25,distance(p,target)/90);
      const tx=clamp(target.x+target.vx*lead,-22.5,22.5),tz=clamp(target.z+target.vz*lead+error,-12.6,12.6);
      const far=distance(p,{x:tx,z:tz});
      this.kick(p,tx,tz,clamp(15+far*.55,18,27),far>15?2.2:0,false,'pass');
      this.ball.passTo=target.id;
      this.stats.passes[p.team]++;
      this.emit('pass',{team:p.team,x:p.x,z:p.z,target:target.id});
    }
    kick(p,tx,tz,speed,lift,superShot,kind='shot') {
      const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz)||1;
      speed*=ARCADE_PACE;
      Object.assign(this.ball,{owner:null,x:p.x+dx/d*1.278,z:p.z+dz/d*1.278,y:BALL_RADIUS,vx:dx/d*speed,vz:dz/d*speed,vy:lift,lock:kind==='shot'?.025:.06,super:superShot?1.25:0,flight:1.5,passTo:null,lastTouch:p.team,shot:kind==='shot',fullShot:superShot,after:0,spin:0,koUsed:false});
      p.lock=.42;p.holding=0;p.aiCharge=0;p.aimZ=null;
      p.kickKind=superShot?'super':kind;p.kickDuration=superShot?.44:kind==='pass'?.25:.34;p.kickTime=p.kickDuration;
    }
    shoot(p,held,aimZ=null) {
      const c=clamp(held/1.12,0,1),superShot=held>=1.12;
      const over=Math.max(0,held-1.45);
      const direction=p.team===0?1:-1,goalX=direction*24.8,range=Math.abs(goalX-p.x);
      const pressure=Math.max(0,1-Math.min(...this.players.filter(q=>q.team!==p.team&&!q.keeper).map(q=>distance(q,p)))/3.5);
      const longRange=Math.max(0,range-10);
      let tx=goalX,tz;
      const human=this.isUser(p);
      if(human) {
        // Close goal assist follows the player's steering; it never chooses an empty corner.
        // Facing away from the goal means a real shot in that direction, not a magic turn.
        const aim=this.aimFor(p);tx=aim.x;tz=aim.z;
        const spread=.35+Math.pow(longRange/8,1.45)*2.3+pressure*1.15+Math.max(0,Math.abs(p.z)-7)*.3+over*4;
        tz+=(this.rng()-.5)*spread;
      } else {
        const keeper=this.players[(1-p.team)*4+3];
        const corner=aimZ??(keeper.z>.35?-2:keeper.z<-.35?2:(this.rng()<.5?-2:2));
        const err=(this.rng()-.5)*(this.difficulty.aim*1.7+Math.pow(longRange/8,1.45)*2.2+pressure*1.2+over*4);
        tz=corner+err;
        if(this.rng()<this.difficulty.error) tz+=(this.rng()>.5?1:-1)*3.3;
      }
      this.kick(p,tx,tz,superShot?41:19+c*15,superShot?1.5:c*1.1,superShot);
      if(human)this.ball.after=.34;
      else this.ball.spin=(this.rng()-.5)*5*this.difficulty.smart;
      this.ball.userSuper=human&&superShot;
      this.stats.shots[p.team]++;if(superShot)this.stats.supers[p.team]++;
      this.emit(superShot?'super':'shot',{team:p.team,x:p.x,z:p.z,power:c,over});
    }
    claim(p) {
      const holder=this.ball.owner===null?null:this.players[this.ball.owner];
      if(holder?.keeper&&holder.id!==p.id)return false;
      if(p.keeper&&this.ball.fullShot)return false;
      this.ball.owner=p.id;this.ball.vx=this.ball.vz=this.ball.vy=0;this.ball.y=BALL_RADIUS;
      this.ball.passTo=null;this.ball.super=0;this.ball.shot=false;this.ball.fullShot=false;this.ball.after=0;this.ball.spin=0;p.holding=0;p.chase=null;
      if(p.keeper)this.players.forEach(q=>{if(!q.keeper)q.think=0;});
      if(p.team===0&&!p.keeper&&!this.autoPlay) {
        p.protect=.75; // a moment of control after winning the ball
        this.controlled=p.id;this.cancelCharge();
        if(this.bufferPass>0){this.bufferPass=0;this.passFrom(p);}
      }
      // Everyone re-reads the game the moment possession changes.
      this.players.forEach(q=>{if(q.id!==p.id&&!q.keeper)q.think=Math.min(q.think,.08+this.rng()*.12);});
      return true;
    }
    inKeeperArea(p,keeper){const side=keeper.team===0?-1:1;return side*p.x>17.1&&Math.abs(p.z)<8;}
    exitKeeperArea(p,keeper) {
      const side=keeper.team===0?-1:1;
      if(side*p.x-16.6<8.4-Math.abs(p.z)){p.tx=side*16.6;p.tz=p.z;}
      else{p.tx=p.x;p.tz=(p.z>=0?1:-1)*8.4;}
    }
    startDive(p,z) {
      if(p.dive>0||p.diveCooldown>0)return;
      p.dive=1;p.diveCooldown=1.4;p.diveWait=0;
      p.diveDir=Math.sign(z-p.z)||(this.rng()>.5?1:-1);p.diveTarget=clamp(z,-3.9,3.9);
      this.emit('dive',{player:p.id,x:p.x,z:p.z});
    }
    keeperReaction(p,dt) {
      const b=this.ball,side=p.team===0?-1:1;
      if(b.owner!==null||!b.shot||side*b.vx<8||side*b.x<1||side*(p.x-b.x)<0||p.dive>0||p.diveCooldown>0){p.diveWait=0;if(b.owner!==null||!b.shot)p.readBias=0;return;}
      const arrival=clamp((p.x-b.x)/b.vx,0,2),target=b.z+b.vz*arrival;
      if(Math.abs(target)>4.3){p.diveWait=0;return;}
      if(p.diveWait===0){
        p.diveWait=this.difficulty.reaction*.6+.025+this.rng()*.11+Math.max(0,Math.hypot(b.vx,b.vz)-20)*.008;
        p.readBias=(this.rng()-.5)*this.difficulty.aim*.8;
        if(this.rng()<this.difficulty.error)p.readBias=(this.rng()>.5?1:-1)*(2.4+this.rng()*.8);
      }
      p.diveWait-=dt;
      // React to the flight early, then commit to a fallible dive as the shot arrives.
      if(p.diveWait<=0){
        p.diveWait=-.001;
        if(arrival<.36)this.startDive(p,target+p.readBias);
      }
    }
    /* ---------- Slide tackle ---------- */
    tackle(p,dx=0,dz=0) {
      if(this.countdown>0||this.goalDelay>0||this.end)return false;
      if(p.keeper||p.slide>0||p.slideCool>0||p.stun>0||p.down>0||this.ball.owner===p.id)return false;
      let m=Math.hypot(dx,dz);
      if(m<.15){dx=p.fx;dz=p.fz;m=1;}
      dx/=m;dz/=m;
      // Gentle assist: a tackle launched roughly at the ball goes straight for it.
      const b=this.ball,own=b.owner!==null?this.players[b.owner]:null,lead=own?.22:.12;
      const bx=b.x+(own?own.vx:b.vx)*lead-p.x,bz=b.z+(own?own.vz:b.vz)*lead-p.z,bd=Math.hypot(bx,bz);
      if(bd>.01&&bd<6.8&&(bx*dx+bz*dz)/bd>.35){dx=bx/bd;dz=bz/bd;}
      p.slide=SLIDE_TIME;p.slideX=dx;p.slideZ=dz;p.fx=dx;p.fz=dz;p.slideHit=false;p.slideCool=p.team===0&&!this.autoPlay?.7:1.35;p.chase=null;
      if(this.isUser(p))this.cancelCharge();
      this.emit('slide',{player:p.id,team:p.team,x:p.x,z:p.z});
      return true;
    }
    updateSlide(p,dt) {
      const k=clamp(p.slide/SLIDE_TIME,0,1),speed=SLIDE_SPEED*ARCADE_PACE*(.3+.7*k);
      p.vx=p.slideX*speed;p.vz=p.slideZ*speed;
      p.x=clamp(p.x+p.vx*dt,-23.3,23.3);p.z=clamp(p.z+p.vz*dt,-13.3,13.3);
      if(!p.slideHit)this.slideContact(p);
      p.slide=Math.max(0,p.slide-dt);
      if(p.slide===0&&!p.slideHit){p.down=.32;p.vx=p.vz=0;} // a missed tackle costs a moment on the floor
    }
    slideContact(p) {
      const b=this.ball,holder=b.owner!==null?this.players[b.owner]:null;
      const footX=p.x+p.slideX*.9,footZ=p.z+p.slideZ*.9;
      if(holder&&holder.team!==p.team&&!holder.keeper&&holder.skill<=0){
        const dBall=Math.hypot(b.x-footX,b.z-footZ),dHolder=distance(p,holder);
        if(dBall<1.7||dHolder<1.55){
          // Timing matters: from the front you usually win it, from behind the dribbler often rides it.
          const side=((p.x-holder.x)*holder.fx+(p.z-holder.z)*holder.fz)/(dHolder||1);
          const chance=(holder.protect>0?-.45:0)+(side>.3?.86:side>-.3?.74:.5)+(p.team===1?(this.difficulty.smart-.75)*.35-.08:(.12-this.difficulty.smart*.2));
          if(this.rng()>chance){p.slideHit=true;p.slide=Math.min(p.slide,.08);p.down=.5;holder.stun=Math.max(holder.stun,.12);this.emit('impact',{x:holder.x,z:holder.z});this.emit('dodge',{team:holder.team,x:holder.x,z:holder.z});return;}
          holder.down=.8;holder.stun=.8;holder.lock=.8;holder.holding=0;holder.aiCharge=0;
          if(this.isUser(holder))this.cancelCharge();
          p.slideHit=true;this.claim(p);p.slide=Math.min(p.slide,.1);
          this.stats.steals[p.team]++;this.stats.tackles[p.team]++;
          this.emit('tackle',{x:holder.x,z:holder.z,slide:true,team:p.team});
          return;
        }
      }
      if(b.owner===null&&b.lock<=0&&b.y<1.35&&!(b.fullShot&&Math.hypot(b.vx,b.vz)>28)){
        if(Math.hypot(b.x-footX,b.z-footZ)<1.3){p.slideHit=true;this.claim(p);p.slide=Math.min(p.slide,.1);this.emit('tackle',{x:b.x,z:b.z,slide:true,team:p.team,loose:true});return;}
      }
      for(const q of this.players){
        if(q.team===p.team||q.keeper||q.down>0||q.id===b.owner)continue;
        if(distance(p,q)<1.25){q.down=.55;q.stun=.55;p.slideHit=true;this.emit('impact',{x:q.x,z:q.z});}
      }
    }
    collidePlayers(dt) {
      const diameter=1.52;
      for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
        const a=this.players[i],b=this.players[j],dist=distance(a,b);
        if(dist>2.2)continue;
        const holder=this.ball.owner===a.id?a:this.ball.owner===b.id?b:null,defender=holder===a?b:a;
        if(holder&&!holder.keeper&&holder.skill<=0&&holder.protect<=0&&!(defender.team===1&&!this.autoPlay&&defender.lunge<=0)&&holder.team!==defender.team&&holder.lock<=0&&defender.stun<=0&&defender.lock<=0&&defender.down<=0&&defender.slide<=0){
          const dx=defender.x-holder.x,dz=defender.z-holder.z,front=(dx*holder.fx+dz*holder.fz)/(dist||1);
          const ballDistance=Math.hypot(defender.x-(holder.x+holder.fx*CARRY_OFFSET),defender.z-(holder.z+holder.fz*CARRY_OFFSET));
          const rate=this.isUser(defender)?4.5-this.difficulty.smart*2:defender.team===0&&!this.autoPlay?ALLY.aggression*4:this.difficulty.aggression*5.5;
          if(front>.2&&ballDistance<1.35&&this.rng()<rate*dt){
            holder.stun=.28;holder.lock=.6;defender.lock=.4;defender.lunge=0;this.claim(defender);this.stats.steals[defender.team]++;
            this.emit('tackle',{x:holder.x,z:holder.z,team:defender.team});
          }
        }
        if(dist<diameter&&a.bumpTime===0&&b.bumpTime===0&&Math.hypot(a.vx-b.vx,a.vz-b.vz)>9){
          a.bumpTime=b.bumpTime=.3;this.emit('impact',{x:(a.x+b.x)/2,z:(a.z+b.z)/2});
        }
      }
      // Solid bodies: repeated separation also resolves three-player tackles.
      for(let iteration=0;iteration<6;iteration++)for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
        const a=this.players[i],b=this.players[j],dist=distance(a,b);if(dist>2.2)continue;
        if((a.slide>0||a.down>0)&&(b.slide>0||b.down>0))continue;
        const dx=a.x-b.x,dz=a.z-b.z;let nx=dx/(dist||1),nz=dz/(dist||1),overlap=diameter-dist,boxOverlap=true,penetration=Infinity,bx=0,bz=0;
        // Oriented head boxes prevent the cubic models clipping while turning.
        for(let axis=0;axis<4;axis++){
          const p=axis<2?a:b,xx=axis%2?p.fz:p.fx,zz=axis%2?-p.fx:p.fz;
          const extent=.8*(Math.abs(xx*a.fz-zz*a.fx)+Math.abs(xx*b.fz-zz*b.fx))+.7*(Math.abs(xx*a.fx+zz*a.fz)+Math.abs(xx*b.fx+zz*b.fz));
          const projection=dx*xx+dz*zz,depth=extent-Math.abs(projection);
          if(depth<=0){boxOverlap=false;break;}
          if(depth<penetration){penetration=depth;const sign=projection<0?-1:1;bx=xx*sign;bz=zz*sign;}
        }
        if(boxOverlap&&penetration>overlap){nx=bx;nz=bz;overlap=penetration;}
        if(overlap<=0)continue;if(dist<.001&&Math.abs(nx)+Math.abs(nz)<.001){nx=bx||((i%2)?1:-1);nz=bz;}
        overlap+=.001;let aw=a.keeper?0:b.keeper?1:.5;
        if(!a.keeper&&!b.keeper){if(a.slide>0)aw=.15;else if(b.slide>0)aw=.85;else if(this.isUser(a)&&b.team===1)aw=.15;else if(this.isUser(b)&&a.team===1)aw=.85;}
        const bw=1-aw;
        if(aw){a.x=clamp(a.x+nx*overlap*aw,-23.3,23.3);a.z=clamp(a.z+nz*overlap*aw,-13.3,13.3);}
        if(bw){b.x=clamp(b.x-nx*overlap*bw,-23.3,23.3);b.z=clamp(b.z-nz*overlap*bw,-13.3,13.3);}
      }
    }
    move(p,tx,tz,dt,speed=PLAYER_SPEED) {
      if(this.ball.owner===p.id)speed*=CARRY_SPEED;
      if(p.chase!==null&&!this.isUser(p))speed*=1+(p.team===0?.05:Math.max(0,this.difficulty.smart-.5)*.2);
      const dx=tx-p.x,dz=tz-p.z,dist=Math.hypot(dx,dz);
      // Players accelerate briefly instead of snapping to top speed.
      const cur=Math.hypot(p.vx,p.vz),limit=Math.min(speed,cur+speed*dt*7+.6);
      const amount=Math.min(dist,limit*dt)*(p.stun>0?.18:1);
      p.vx=dist>.05?dx/dist*amount/dt:0;p.vz=dist>.05?dz/dist*amount/dt:0;
      p.x=clamp(p.x+p.vx*dt,-23.3,23.3);p.z=clamp(p.z+p.vz*dt,-13.3,13.3);
      if(dist>.1&&!p.keeper){p.fx=dx/dist;p.fz=dz/dist;}
    }
    fieldPlayers(team){return this.players.filter(q=>q.team===team&&!q.keeper);}
    nearestEnemy(p){let best=null,bd=Infinity;for(const q of this.players)if(q.team!==p.team&&!q.keeper){const d=distance(p,q);if(d<bd){bd=d;best=q;}}return {q:best,d:bd};}
    // Rough interception time for a moving ball (exponential drag, constant run speed).
    interceptTime(p){
      const b=this.ball;let t=0;
      for(let i=0;i<10;i++){const k=Math.exp(-.5*t),px=b.x+b.vx*(1-k)/.5,pz=b.z+b.vz*(1-k)/.5;t=Math.hypot(px-p.x,pz-p.z)/PLAYER_SPEED;}
      return t+(p.stun+p.down)*2;
    }
    decide(p) {
      const d=p.team===0?1:-1,owner=this.ball.owner===null?null:this.players[this.ball.owner];
      const smart=this.difficulty.smart,noise=(this.rng()-.5)*this.difficulty.aim*2*(1.15-smart);
      p.chase=null;
      if(p.keeper) {
        p.tx=-d*(Math.abs(this.ball.x)>16?21.5:22.2);
        const b=this.ball,incoming=b.owner===null&&b.shot&&b.vx*-d>8;
        const read=incoming&&p.diveWait<0?b.z+b.vz*clamp((p.x-b.x)/b.vx,0,2)+p.readBias:b.z*.68;
        p.tz=clamp(read+noise*.4,-3.3,3.3);
        return;
      }
      if(owner?.keeper){
        if(this.inKeeperArea(p,owner))this.exitKeeperArea(p,owner);
        else if(owner.team===p.team){p.tx=clamp(owner.x+d*(9+p.slot*2),-15.5,15.5);p.tz=(p.slot===1?-1:p.slot===2?1:0)*7+noise;}
        else{p.tx=clamp(-d*8+d*p.slot,-15,15);p.tz=(p.slot===1?-5:p.slot===2?5:0)+noise;}
        return;
      }
      if(owner && owner.id===p.id) { this.decideHolder(p,d,noise); return; }
      if(owner && owner.team===p.team) { this.decideSupport(p,owner,d,noise); return; }
      if(owner) { this.decideDefend(p,owner,d,noise); return; }
      this.decideLoose(p,d,noise);
    }
    decideHolder(p,d,noise){
      const smart=this.difficulty.smart,gx=d*24,toGoal=Math.abs(gx-p.x);
      const {q:enemy,d:pressure}=this.nearestEnemy(p);
      const keeper=this.players[(1-p.team)*4+3];
      const corner=keeper.z>.35?-2:keeper.z<-.35?2:(this.rng()<.5?-2:2);
      // 1. Shoot from a sensible position, at the corner away from the keeper.
      if(toGoal<11.5+smart*2.5&&Math.abs(p.z)<9.5&&p.holding>.15){
        const lane=this.laneOpen(p,{x:gx,z:corner},p.team);
        if(lane>1.2||toGoal<6.5||pressure<1.8||this.rng()<.22){
          if(pressure>4&&toGoal>7.5&&this.rng()<.3+smart*.25){p.chargeTarget=.85+this.rng()*.5;p.aiCharge=.001;p.aimZ=corner;}
          else this.shoot(p,.25+this.rng()*.65,corner);
          return;
        }
      }
      // 2. Pass when pressed or when a mate is in a much better spot.
      const mates=this.fieldPlayers(p.team).filter(q=>q.id!==p.id&&q.down<=0);
      let best=null,bestScore=-Infinity;
      for(const q of mates){
        const open=Math.min(...this.fieldPlayers(1-p.team).map(o=>distance(o,q)));
        const lane=this.laneOpen(p,q,p.team),progress=d*(q.x-p.x);
        const s=progress*.32+Math.min(open,7)*.55-distance(p,q)*.05+(lane>1.5?1.5:lane<.9?-5:-1)+(Math.abs(d*24-q.x)<12?1.2:0);
        if(s>bestScore){bestScore=s;best=q;}
      }
      const pressed=pressure<2.7&&enemy&&((enemy.x-p.x)*p.fx+(enemy.z-p.z)*p.fz)>-.5;
      if(pressed&&p.skillCool<=0&&this.rng()<this.difficulty.smart*.4){this.skillMove(p);return;}
      if(best&&p.holding>.28&&((pressed&&bestScore>-.5)||(bestScore>3.6&&p.holding>.7))&&this.rng()<this.difficulty.passing+.15){this.passFrom(p,best);return;}
      // 3. Dribble towards goal, steering around defenders.
      let sx=d,sz=clamp(-p.z*.05,-.4,.4);
      for(const o of this.fieldPlayers(1-p.team).concat([keeper])){
        const ox=p.x-o.x,oz=p.z-o.z,od=Math.hypot(ox,oz);if(od>6.5||od<.01)continue;
        const ahead=(o.x-p.x)*d>-1;if(!ahead)continue;
        const push=(6.5-od)/6.5*(1.2+smart*1.1);
        sz+=(Math.abs(oz)<.3?(p.z>0?-1:1):Math.sign(oz))*push;sx-=d*push*.25;
      }
      if(Math.abs(p.z)>10)sz-=Math.sign(p.z)*.8;
      const m=Math.hypot(sx,sz)||1;
      p.tx=clamp(p.x+sx/m*5,-21.5,21.5);p.tz=clamp(p.z+sz/m*5+noise*.4,-12,12);
      if(this.rng()<this.difficulty.error*.5){p.tx=p.x+noise*2;p.tz=p.z+noise*2;}
    }
    decideSupport(p,owner,d,noise){
      // Off-ball runs into open lanes ahead of the ball carrier.
      const order=this.fieldPlayers(p.team).filter(q=>q.id!==owner.id).sort((a,b)=>a.slot-b.slot);
      const role=order.indexOf(p);
      let tx,tz;
      if(role===0){tx=owner.x+d*(7+this.rng()*3);tz=owner.z>0?owner.z-6:owner.z+6;}
      else{const other=order[0];tx=owner.x+d*(2+this.rng()*4);tz=other&&other.z>0?-7.5:7.5;if(Math.abs(owner.z)>6)tz=-Math.sign(owner.z)*3;}
      tx=clamp(tx,-19.5,19.5);tz=clamp(tz,-11.5,11.5);
      // Drift away from the closest marker.
      for(const o of this.fieldPlayers(1-p.team)){const od=Math.hypot(tx-o.x,tz-o.z);if(od<3){tz+=(tz>o.z?1:-1)*(3-od);}}
      p.tx=clamp(tx+noise*.5,-19.5,19.5);p.tz=clamp(tz+noise*.5,-12,12);
    }
    decideDefend(p,owner,d,noise){
      const own=-d*24,team=this.fieldPlayers(p.team);
      const userPresses=p.team===0&&!this.autoPlay;
      let order=team.slice().sort((a,b)=>distance(a,owner)+(a.down+a.stun)*8-(distance(b,owner)+(b.down+b.stun)*8));
      if(userPresses)order=[this.players[this.controlled],...order.filter(q=>q.id!==this.controlled)];
      const role=order.indexOf(p);
      if(role===0){p.chase=owner.id;return;}
      if(role===1){
        // Mark the most dangerous runner: the attacker nearest our goal.
        const runners=this.fieldPlayers(owner.team).filter(q=>q.id!==owner.id).sort((a,b)=>Math.abs(own-a.x)-Math.abs(own-b.x));
        const r=runners[0]||owner;
        const k=.3+this.difficulty.smart*.12;
        p.tx=clamp(r.x+(owner.x-r.x)*k-d*1.4,-21,21);p.tz=clamp(r.z+(owner.z-r.z)*k,-12,12);
        return;
      }
      // Cover: sit between the ball and our goal.
      const k=.5;p.tx=clamp(owner.x+(own-owner.x)*k,-20.5,20.5);p.tz=clamp(owner.z*.45+noise,-7,7);
    }
    decideLoose(p,d,noise){
      const team=this.fieldPlayers(p.team);
      const passTo=this.ball.passTo!==null?this.players[this.ball.passTo]:null;
      if(passTo&&passTo.team===p.team){if(passTo.id===p.id)p.chase='ball';else{p.tx=clamp(this.ball.x+d*(4+p.slot),-19,19);p.tz=(p.slot===1?-6:6)+noise;}return;}
      let best=null,bt=Infinity;
      for(const q of team){if(p.team===0&&!this.autoPlay&&q.id===this.controlled)continue;const t=this.interceptTime(q);if(t<bt){bt=t;best=q;}}
      const userChases=p.team===0&&!this.autoPlay&&this.interceptTime(this.players[this.controlled])<=bt+.15;
      if(best&&best.id===p.id&&!userChases){p.chase='ball';return;}
      const attacking=this.ball.lastTouch===p.team;
      if(attacking){p.tx=clamp(this.ball.x+d*(4+this.rng()*3),-19,19);p.tz=(p.slot===1?-6:p.slot===2?6:0)+this.ball.z*.2+noise;}
      else{p.tx=clamp(this.ball.x-d*(5+this.rng()*3),-20,20);p.tz=(p.slot===1?-5:p.slot===2?5:0)+this.ball.z*.35+noise;}
    }
    // Live targets for players chasing the ball or pressing the carrier.
    liveChase(p,dt){
      const b=this.ball;
      if(p.chase==='ball'){
        if(b.owner!==null){p.chase=null;p.think=0;return;}
        const t=Math.min(.6,this.interceptTime(p)*.8),k=Math.exp(-.5*t);
        p.tx=clamp(b.x+b.vx*(1-k)/.5,-23,23);p.tz=clamp(b.z+b.vz*(1-k)/.5,-13,13);return;
      }
      const h=this.players[p.chase];
      if(!h||b.owner!==h.id){p.chase=null;p.think=0;return;}
      const own=p.team===0?-24:24,gx=own-h.x,gz=-h.z,gd=Math.hypot(gx,gz)||1;
      const dist=distance(p,h);
      if(p.team===1&&!this.autoPlay){
        // CPU defenders jockey: they hold a gap goal-side and only now and then step in for the ball,
        // then back off. Nobody glues himself to the player.
        const gap=2.75-this.difficulty.smart*1.1;
        if(p.lunge>0){p.tx=b.x+h.vx*.12;p.tz=b.z+h.vz*.12;}
        else{
          const g=p.backoff>0?gap+1.6:gap;
          p.tx=h.x+h.vx*.25+gx/gd*g;p.tz=h.z+h.vz*.25+gz/gd*g;
          if(p.backoff<=0&&p.lungeClock<=0&&dist<gap+1.2){
            p.lungeClock=1.1+this.rng()*(2.2-this.difficulty.aggression*1.6);
            if(this.rng()<.35+this.difficulty.aggression*.6)p.lunge=.5;
          }
        }
        if(p.lunge>0&&p.slideCool<=0&&p.stun<=0&&dist<2.6&&dist>.9&&!h.keeper&&h.protect<=0){
          const rate=this.difficulty.slide*6*((this.charging&&b.owner===this.controlled)?1.8:1);
          if(this.rng()<rate*dt){this.tackle(p,b.x-p.x,b.z-p.z);p.lunge=0;}
        }
        return;
      }
      // Goal-side approach, then go for the ball itself.
      const offset=dist>3.2?1.6:.35;
      p.tx=h.x+h.vx*.18+gx/gd*offset+h.fx*CARRY_OFFSET*(dist<3.2?.8:0);
      p.tz=h.z+h.vz*.18+gz/gd*offset+h.fz*CARRY_OFFSET*(dist<3.2?.8:0);
      // Slide tackles when close enough; smarter sides time it from the front or side.
      if(p.slideCool<=0&&p.stun<=0&&dist<2.6&&dist>.9&&!h.keeper){
        const rate=this.difficulty.slide*(p.team===0&&!this.autoPlay?.35:1)*3.2*((this.charging&&this.ball.owner===this.controlled)||h.aiCharge>0?1.9:1);
        const ang=((p.x-h.x)*h.fx+(p.z-h.z)*h.fz)/dist;
        const good=ang>-.3||this.rng()>this.difficulty.smart;
        if(good&&this.rng()<rate*dt){const bx=b.x-p.x,bz=b.z-p.z;this.tackle(p,bx,bz);}
      }
    }
    update(dt,input={x:0,z:0}) {
      if(this.end) return;
      this.elapsed+=dt;
      if(this.goalDelay>0) {
        this.updateGoalBall(dt);
        const slowed=this.goalBall.age<(this.goalBall.superShot?1.15:.85)?(this.goalBall.superShot?.18:.25):1;
        this.players.forEach(p=>{p.kickTime=Math.max(0,p.kickTime-dt*slowed);p.dive=Math.max(0,p.dive-dt*slowed);p.slide=Math.max(0,p.slide-dt);p.down=Math.max(0,p.down-dt);p.ko=Math.max(0,p.ko-dt);});
        this.time=Math.max(0,this.time-dt);
        this.goalDelay-=dt;
        if(this.goalDelay<=0) {
          // A draw at full time goes to a penalty shootout (quick match and cup alike).
          if(this.time===0){this.needsPenalties=this.score[0]===this.score[1];this.finish();return;}
          this.kickoff(this.nextKickoff);this.countdown=1.5;this.emit('kickoff');
        }
        return;
      }
      if(this.countdown>0){if(this.elapsed>2.3)this.time=Math.max(0,this.time-dt);this.countdown=Math.max(0,this.countdown-dt);return;}
      this.time=Math.max(0,this.time-dt);
      if(this.time===0) {
        this.needsPenalties=this.score[0]===this.score[1];this.finish();return;
      }
      this.bufferPass=Math.max(0,this.bufferPass-dt);
      const b0=this.ball;
      b0.lock=Math.max(0,b0.lock-dt);b0.super=Math.max(0,b0.super-dt);b0.flight=Math.max(0,b0.flight-dt);
      if(b0.owner!==null)this.stats.possession[this.players[b0.owner].team]+=dt;
      if(this.charging) {
        if(b0.owner===this.controlled){const before=this.charge;this.charge+=dt/Math.max(.2,this.timeScale);if(before<1.12&&this.charge>=1.12)this.emit('charged');}
        else this.cancelCharge();
      }
      if(!this.autoPlay&&b0.owner!==this.controlled) this.switchPlayer();
      const userP=this.players[this.controlled];
      const sprintOn=!this.autoPlay&&this.sprinting&&this.stamina>.02&&!this.charging&&userP.slide<=0&&userP.down<=0&&Math.hypot(input.x,input.z)>.2;
      this.stamina=sprintOn?Math.max(0,this.stamina-dt*.42):Math.min(1,this.stamina+dt*.2);
      this.sprintActive=sprintOn;
      const user=this.autoPlay?null:this.players[this.controlled];
      const keeperHolder=b0.owner!==null&&this.players[b0.owner].keeper?this.players[b0.owner]:null;
      const mag=Math.hypot(input.x,input.z);
      const ix=input.x/Math.max(1,mag),iz=input.z/Math.max(1,mag);
      // Aftertouch: steering right after a shot bends the ball.
      if(b0.after>0){b0.after=Math.max(0,b0.after-dt);if(b0.owner===null&&b0.shot)b0.vz+=iz*24*dt;}
      this.players.forEach(p=>{
        p.stun=Math.max(0,p.stun-dt);p.lock=Math.max(0,p.lock-dt);p.bumpTime=Math.max(0,p.bumpTime-dt);p.kickTime=Math.max(0,p.kickTime-dt);p.think-=dt;
        p.slideCool=Math.max(0,p.slideCool-dt);p.down=Math.max(0,p.down-dt);
        p.skillCool=Math.max(0,p.skillCool-dt);p.saveBoost=Math.max(0,p.saveBoost-dt);p.protect=Math.max(0,p.protect-dt);
        if(p.lunge>0){p.lunge=Math.max(0,p.lunge-dt);if(p.lunge===0)p.backoff=.8+this.rng()*.5;}p.backoff=Math.max(0,p.backoff-dt);p.lungeClock-=dt;
        if(p.ko>0){
          const t=p.koTotal-p.ko;p.ko=Math.max(0,p.ko-dt);
          if(p.koFlip&&t<.5){const back=p.team===0?-1:1;p.x=clamp(p.x+back*2.6*dt,-23.6,23.6);}
          p.vx=p.vz=0;if(p.ko===0){p.lock=0;p.think=0;}return;
        }
        if(p.skill>0){
          p.skill=Math.max(0,p.skill-dt);
          if(b0.owner===p.id){const sp=PLAYER_SPEED*1.25,d=p.team===0?1:-1,sx=p.fx*.55+(-p.fz*p.skillDir)*.8+d*.25,sz=p.fz*.55+(p.fx*p.skillDir)*.8,m=Math.hypot(sx,sz)||1;
            p.vx=sx/m*sp;p.vz=sz/m*sp;p.x=clamp(p.x+p.vx*dt,-23.3,23.3);p.z=clamp(p.z+p.vz*dt,-13.3,13.3);return;}
          p.skill=0;
        }
        p.dive=Math.max(0,p.dive-dt);if(p.dive<.0001)p.dive=0;p.diveCooldown=Math.max(0,p.diveCooldown-dt);
        const savedDiff=this.difficulty;if(p.team===0&&!this.autoPlay)this.difficulty=ALLY;
        if(p.keeper)this.keeperReaction(p,dt);
        this.difficulty=savedDiff;
        if(b0.owner===p.id)p.holding+=dt;
        if(p.slide>0){this.updateSlide(p,dt);return;}
        if(p.down>0){p.vx=p.vz=0;return;}
        if(keeperHolder&&!p.keeper&&this.inKeeperArea(p,keeperHolder)){
          this.exitKeeperArea(p,keeperHolder);this.move(p,p.tx,p.tz,dt);return;
        }
        if(user&&p.id===user.id) {
          const oldX=p.x,oldZ=p.z;
          if(mag>.05)this.move(p,p.x+ix*3,p.z+iz*3,dt,1.07*PLAYER_SPEED*(this.charging?.8:sprintOn?SPRINT_MULT:1)*Math.min(1,mag));
          else p.vx=p.vz=0;
          if(keeperHolder&&this.inKeeperArea(p,keeperHolder)){p.x=oldX;p.z=oldZ;p.vx=p.vz=0;}
        } else {
          if(this.ball.owner===p.id&&p.keeper) {
            p.vx=p.vz=0;
            const clearing=this.players.some(q=>!q.keeper&&this.inKeeperArea(q,p));
            // The player's own keeper never clears on his own: he waits for PASS or LONG KICK.
            if((p.team===1||this.autoPlay)&&p.holding>1.05&&p.dive===0&&(!clearing||p.holding>2.2))this.passFrom(p);
          } else if(p.keeper&&p.dive>.64){
            this.move(p,p.x,p.diveTarget,dt,PLAYER_SPEED*1.3);
          } else if(p.keeper&&p.dive>0){
            p.vx=p.vz=0;
          } else {
            const keepDiff=this.difficulty;if(p.team===0&&!this.autoPlay)this.difficulty=ALLY;
            if(p.think<=0){this.decide(p);p.think=this.difficulty.reaction*(.8+this.rng()*.7)+(p.keeper&&this.ball.super>0?.18:0);}
            if(p.chase!==null)this.liveChase(p,dt);
            this.difficulty=keepDiff;
            if(p.slide>0)return;
            if(p.aiCharge>0 && this.ball.owner===p.id) {
              p.aiCharge+=dt;
              this.move(p,p.tx,p.tz,dt,3.9*ARCADE_PACE);
              if(p.aiCharge>=p.chargeTarget)this.shoot(p,p.aiCharge,p.aimZ);
            } else this.move(p,p.tx,p.tz,dt);
          }
        }
        if(keeperHolder&&!p.keeper&&this.inKeeperArea(p,keeperHolder)){
          this.exitKeeperArea(p,keeperHolder);this.move(p,p.tx,p.tz,dt);
        }
      });
      this.collidePlayers(dt);
      if(this.ball.owner!==null) {
        const p=this.players[this.ball.owner];
        this.ball.x=p.x+p.fx*CARRY_OFFSET;this.ball.z=p.z+p.fz*CARRY_OFFSET;this.ball.y=BALL_RADIUS;
      } else this.updateBall(dt);
    }
    updateBall(dt) {
      const b=this.ball;
      if(b.spin&&b.shot&&b.flight>.9)b.vz+=b.spin*dt;
      b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=8.5*dt;
      if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;b.vy=Math.abs(b.vy)>.9?-b.vy*.3:0;}
      const drag=Math.exp(-(b.passTo!==null?.34:b.shot?.78:.52)*dt);b.vx*=drag;b.vz*=drag;
      // Actual posts and crossbar, with rebounds instead of dead-ball rules.
      for(const gx of [-24,24])for(const gz of [-3.5,3.5]){
        const dist=Math.hypot(b.x-gx,b.z-gz);
        if(dist<.8&&b.y<3.5){
          const nx=(b.x-gx)/(dist||1),nz=(b.z-gz)/(dist||1),dot=b.vx*nx+b.vz*nz;
          if(dot<0){b.vx-=1.85*dot*nx;b.vz-=1.85*dot*nz;b.x=gx+nx*.81;b.z=gz+nz*.81;b.after=0;b.spin=0;this.emit('post',{x:gx,z:gz});}
        }
      }
      const goalMouth=Math.abs(b.z)<3.5-BALL_RADIUS-.05&&b.y<3.15-BALL_RADIUS-.05;
      if(Math.abs(b.x)>=24+BALL_RADIUS && goalMouth){this.goal(b.x>0?0:1);return;}
      if(Math.abs(b.x)>24-BALL_RADIUS&&!goalMouth){b.x=clamp(b.x,-24+BALL_RADIUS,24-BALL_RADIUS);b.vx=-b.vx*.8;b.after=0;b.spin=0;this.emit('bounce',{x:b.x,z:b.z});}
      if(Math.abs(b.z)>14-BALL_RADIUS){b.z=clamp(b.z,-14+BALL_RADIUS,14-BALL_RADIUS);b.vz=-b.vz*.82;b.after=0;b.spin=0;this.emit('bounce',{x:b.x,z:b.z});}
      if(b.lock>0)return;
      const speed=Math.hypot(b.vx,b.vz);
      const candidates=this.players.filter(p=>p.lock<=0&&p.stun<=0&&p.down<=0&&p.ko<=0).sort((a,c)=>distance(a,b)-distance(c,b));
      for(const p of candidates) {
        const dist=distance(p,b),radius=p.keeper?(p.dive>.58?(p.saveBoost>0?2.25:1.85):1.02):1.17;
        if(dist>radius||b.y>(p.keeper?2.5:1.5))continue;
        if(p.keeper&&b.fullShot&&b.userSuper&&p.team===1&&dist<1.3) {
          // A full-bar Super Shot cannot knock the keeper out: he can only parry it, and is left dazed for a moment.
          const rebound=clamp(speed*.42,7,20),deflect=clamp((b.z-p.z)/Math.max(dist,.4)*.7,-.75,.75);
          b.x=Math.min(b.x,p.x-1.12);b.vx=-rebound*Math.sqrt(1-deflect*deflect);b.vz=rebound*deflect;b.vy=2.4;b.y=clamp(b.y,BALL_RADIUS,1.8);
          b.owner=null;b.passTo=null;b.super=0;b.fullShot=false;b.shot=false;b.flight=.45;b.lock=.2;b.lastTouch=p.team;b.after=0;b.spin=0;
          p.ko=p.koTotal=1.5;p.koFlip=false;p.dive=0;p.diveWait=0;p.vx=p.vz=0;p.holding=0;p.lock=1.5;
          this.stats.saves[p.team]++;
          this.emit('keeperko',{player:p.id,x:p.x,z:p.z,daze:true});this.emit('save',{player:p.id,x:p.x,z:p.z,parry:true,super:true});this.emit('impact',{x:p.x,z:p.z,super:true});
          break;
        }
        if(p.keeper) {
          // A prepared dive can save a Super Shot; an unprepared keeper still blocks his body.
          if(b.fullShot && speed>28 && p.dive<=.58 && dist>.88 && p.saveBoost<=0)continue;
          if(speed>10&&p.dive===0)this.startDive(p,b.z);
          this.stats.saves[p.team]++;
          if(b.fullShot){
            // Full-charge shots can only be parried, even after the visual trail expires.
            const side=p.team===0?-1:1,rebound=clamp(speed*.48,7.5,23.5);
            const deflect=clamp((b.z-p.z)/Math.max(dist,.4)*.72-b.vz/Math.max(1,speed)*.2,-.78,.78);
            b.x=side*Math.min(side*b.x,side*p.x-1.12);
            b.vx=-side*rebound*Math.sqrt(1-deflect*deflect);b.vz=rebound*deflect;
            b.vy=Math.max(1.4,Math.abs(b.vy)*.25);b.y=clamp(b.y,BALL_RADIUS,1.8);
            b.owner=null;b.passTo=null;b.super=0;b.fullShot=false;b.shot=false;b.flight=.45;b.lock=.18;b.lastTouch=p.team;b.after=0;b.spin=0;
            p.lock=.6;p.holding=0;
            this.emit('save',{player:p.id,x:p.x,z:p.z,parry:true,super:true});this.emit('impact',{x:p.x,z:p.z,super:true});
          }else{this.claim(p);p.lock=.45;this.emit('save',{player:p.id,x:p.x,z:p.z});}
          break;
        }
        if(b.fullShot&&b.userSuper&&!b.koUsed&&p.team===1&&!p.keeper&&speed>18) {
          // A full-bar Super Shot bowls over any defender in its path: he flips back and sees stars.
          p.ko=p.koTotal=2.4;p.koFlip=true;p.vx=p.vz=0;p.holding=0;p.lock=2.4;p.slide=0;p.chase=null;p.aiCharge=0;
          b.vx*=.86;b.vz*=.86;b.lock=.08;b.koUsed=true; // only ONE player per Super Shot
          this.emit('playerko',{player:p.id,x:p.x,z:p.z});this.emit('impact',{x:p.x,z:p.z,super:true});
          break;
        }
        if(speed>26 && b.passTo!==p.id) {
          const nx=(b.x-p.x)/(dist||1),nz=(b.z-p.z)/(dist||1),dot=b.vx*nx+b.vz*nz;
          if(dot<0){b.vx-=1.45*dot*nx;b.vz-=1.45*dot*nz;b.x=p.x+nx*1.1;b.z=p.z+nz*1.1;b.after=0;b.spin=0;p.stun=.32;p.lock=.25;b.lock=.07;this.emit('impact',{x:p.x,z:p.z});break;}
        } else {
          if(b.passTo!==null&&b.passTo!==p.id&&this.players[b.passTo].team!==p.team){this.stats.steals[p.team]++;this.emit('intercept',{x:p.x,z:p.z,team:p.team});}
          this.claim(p);break;
        }
      }
    }
    goal(team) {
      const superShot=this.ball.fullShot||this.ball.super>0;
      this.score[team]++;this.goalDelay=superShot?3.2:2.7;this.nextKickoff=1-team;this.cancelCharge();
      this.emit('goal',{team,super:superShot,x:this.ball.x,z:this.ball.z});
      const side=team===0?1:-1;this.goalBall={side,team,hitBack:false,age:0,superShot};
      this.players.forEach(p=>{p.vx=p.vz=0;});
      this.ball.owner=null;this.ball.after=0;this.ball.spin=0;this.ball.vx=side*Math.max(5,Math.min(12,Math.abs(this.ball.vx)*.45));this.ball.vz*=.3;
    }
    updateGoalBall(dt) {
      if(!this.goalBall)return;
      const b=this.ball,{side,team}=this.goalBall,back=24+GOAL_DEPTH-BALL_RADIUS-.12,front=24+BALL_RADIUS+.08;
      this.goalBall.age+=dt;
      const slowPeriod=this.goalBall.superShot?1.15:.85;
      if(this.goalBall.age<slowPeriod)dt*=this.goalBall.superShot?.18:.25;
      b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;b.vy-=8.5*dt;
      if(b.y<BALL_RADIUS){b.y=BALL_RADIUS;b.vy=Math.abs(b.vy)>.7?-b.vy*.2:0;}
      if(side*b.x>back){b.x=side*back;b.vx=-side*Math.min(.7,Math.abs(b.vx)*.08);if(!this.goalBall.hitBack){this.goalBall.hitBack=true;this.emit('net',{team,x:b.x,z:b.z});}}
      if(side*b.x<front){b.x=side*front;b.vx=side*Math.abs(b.vx)*.15;}
      const maxZ=3.5-BALL_RADIUS-.12;
      if(Math.abs(b.z)>maxZ){b.z=clamp(b.z,-maxZ,maxZ);b.vz=-b.vz*.25;}
      b.vx*=Math.exp(-2*dt);b.vz*=Math.exp(-3*dt);b.super=Math.max(0,b.super-dt);
      if(Math.abs(b.vx)<.035)b.vx=0;if(Math.abs(b.vz)<.035)b.vz=0;
    }
    finish(){this.end=true;this.cancelCharge();this.emit('end');}
  }
  return {Match,TEAMS,kitsFor,colorGap,DIFFICULTY,clamp,distance,BALL_RADIUS,CARRY_OFFSET,GOAL_DEPTH,ARCADE_PACE,PLAYER_SPEED,SLIDE_TIME,SKILL_TIME};
});
