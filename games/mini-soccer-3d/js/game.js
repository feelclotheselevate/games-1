(function () {
  'use strict';
  const $=id=>document.getElementById(id),{TEAMS,DIFFICULTY,Match,clamp}=SoccerCore;
  const SETTINGS_KEY='mapi_mini_soccer_settings_1',CUP_KEY='mapi_mini_soccer_cup_1';
  const defaults={music:true,sfx:true,difficulty:1,quality:2,weather:0,lighting:0,pitch:0};
  // Portal adapter (GamePix / GameMonetize builds replace window.PORTAL); the standalone page has no ads.
  const PORTAL=window.PORTAL||{};
  const storage=PORTAL.storage||{get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}},remove:k=>{try{localStorage.removeItem(k);}catch{}}};
  const portal=(name,...args)=>{try{if(typeof PORTAL[name]==='function')return PORTAL[name](...args);}catch(e){}};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(storage.get(SETTINGS_KEY)||'{}')};}catch{}
  for(const [key,max] of [['difficulty',3],['quality',3],['weather',5],['lighting',3],['pitch',6]])settings[key]=Number.isInteger(settings[key])?clamp(settings[key],0,max-1):defaults[key];
  settings.music=!!settings.music;settings.sfx=!!settings.sfx;
  const icons={
    play:'<path d="M7 3L29 17 7 31z"/>',
    trophy:'<path d="M9 2h16v14c0 7-5 9-6 9v5h7v3H8v-3h7v-5c-4-1-6-4-6-9zm-1 3H2v7c0 7 5 8 9 8v-4c-4 0-6-2-6-5V8h3zm18 0h6v7c0 7-5 8-9 8v-4c4 0 6-2 6-5V8h-3z"/>',
    gear:'<path fill-rule="evenodd" d="M13 1h8l1 6 4 2 5-2 4 7-5 4v4l5 3-4 7-5-2-4 2-1 6h-8l-1-6-4-2-5 2-4-7 5-3v-4l-5-4 4-7 5 2 4-2zm4 12a7 7 0 100 14 7 7 0 000-14z" transform="translate(0 -3) scale(.9)"/>',
    back:'<path d="M25 2L5 17l20 15z"/>',check:'<path d="M3 16l7 7L28 4l6 6L11 33 0 22z"/>',
    dice:'<path d="M4 2h26v30H4z"/><g fill="#1974e8"><circle cx="10" cy="8" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="17" cy="17" r="3"/><circle cx="10" cy="26" r="3"/><circle cx="24" cy="26" r="3"/></g>',
    music:'<path d="M13 6l19-4v24c0 7-11 9-11 2 0-3 3-5 7-5V9l-11 3v18c0 7-12 8-12 2 0-3 4-5 8-5z"/>',
    sound:'<path d="M2 11h7L20 2v30L9 24H2zM24 9c6 5 6 12 0 17l-2-3c4-3 4-7 0-11zm4-7c12 9 12 23 0 31l-2-3c9-6 9-17 0-24z"/>',
    bars:'<path d="M2 21h7v12H2zm11-10h7v22h-7zM24 1h7v32h-7z"/>',
    pitch:'<path d="M2 32V12l8 9V6l8 16V1l6 20 8-11v22z"/>',
    monitor:'<path fill-rule="evenodd" d="M1 2h32v24H20v4h7v3H7v-3h7v-4H1zm4 4v16h24V6z"/>',
    fullscreen:'<path d="M0 0h12v5H5v7H0zm22 0h12v12h-5V5h-7zM0 22h5v7h7v5H0zm29 0h5v12H22v-5h7z"/>',
    save:'<path fill-rule="evenodd" d="M1 1h26l6 6v27H1zm6 0v12h20V1zm0 20v10h20V21z"/>',
    pause:'<rect x="3" y="1" width="9" height="32" rx="2"/><rect x="22" y="1" width="9" height="32" rx="2"/>'
  };
  function icon(name){return '<svg viewBox="0 0 34 34" aria-hidden="true">'+(icons[name]||'')+'</svg>';}
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  const audio=new SoccerAudio(settings);
  let view;
  try{view=new SoccerView($('scene'));view.setQuality(settings.quality);}catch(e){$('load-error').hidden=false;console.error(e);return;}
  let screen='splash',started=false,match=null,mode='quick',home=0,away=1,pick='home',cup=null;
  let paused=false,modalKind=null,returnFocus=null,optionsOrigin='menu',toastTime=0,bannerTime=0,previousCount=-1;
  let input={x:0,z:0},keys=new Map(),joyPointer=null,shootPointer=null,passPointer=null,boostPointer=null;
  let stepTimer=0,menuIntroDone=false,continueUsed=false,adBusy=false,bullet={scale:1,used:0},sessionGoals=0,lastHud='';
  let accumulator=0,lastFrame=performance.now(),fps=60;
  let replay=null,pendingReplay=null,replayHistory=[],recordClock=0;
  const weatherNames=['RANDOM','SUNNY','RAIN','WIND','SNOW'],lightingNames=['RANDOM','DAY','NIGHT'],pitchNames=['RANDOM','CHECKER','LONG STRIPES','WIDE STRIPES','DIAMONDS','CHEVRON'];
  let environment={weather:'SUNNY',night:false,pitch:'CHECKER'};
  function store(key,data){try{storage.set(key,JSON.stringify(data));}catch{}}
  function loadCup(){try{const c=JSON.parse(storage.get(CUP_KEY)||'null');if(c&&Number.isInteger(c.round)&&c.round>=0&&c.round<3&&Number.isInteger(c.user)&&c.user>=0&&c.user<TEAMS.length&&Array.isArray(c.rounds)&&c.rounds.length===3&&c.rounds[c.round]?.every(g=>Number.isInteger(g.a)&&Number.isInteger(g.b)&&TEAMS[g.a]&&TEAMS[g.b]))return c;}catch{}return null;}
  function clearCup(){try{storage.remove(CUP_KEY);}catch{}}
  const flag=t=>'images/flags/'+TEAMS[t].flag+'.svg';
  function fit(){const r=Math.min(window.innerWidth/1280,window.innerHeight/720);$('game').style.transform='scale('+r+')';$('game').style.left=(window.innerWidth-1280*r)/2+'px';$('game').style.top=(window.innerHeight-720*r)/2+'px';view.setQuality(settings.quality);}
  window.addEventListener('resize',fit);fit();
  function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastTime=2;}
  function focusGame(){try{$('game').focus({preventScroll:true});}catch{$('game').focus();}try{window.focus();}catch{}}
  function clearInput(){keys.clear();input.x=input.z=0;joyPointer=shootPointer=passPointer=boostPointer=null;$('joy-knob').style.transform='';for(const id of ['shoot-button','pass-button','boost-button'])$(id).classList.remove('pressed');if(match){match.cancelCharge();match.setSprint(false);}}
  function setScreen(id){
    screen=id;clearInput();document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));
    audio.inMatch=id==='match';audio.paused=paused;audio.sync();
    if(id!=='match')$('charge-meter').hidden=true;
    if(id==='menu'){
      $('menu').classList.toggle('intro',!menuIntroDone);menuIntroDone=true;
      view.setEnvironment('SUNNY',false);
      const btn=document.querySelector('[data-action="cup"] span:last-child');btn.textContent=loadCup()?'CONTINUE CUP':'TOURNAMENT';
    }
    document.querySelectorAll('.kb-focus').forEach(b=>b.classList.remove('kb-focus'));
    focusGame();
  }
  function banner(text,sub='',goal=false,duration=1.7){
    $('banner').innerHTML=text+(sub?'<small>'+sub+'</small>':'');$('banner').className='match-banner'+(goal?' goal':'');
    $('banner').style.animation='none';void $('banner').offsetWidth;$('banner').style.animation='';bannerTime=duration;
  }
  function chooseEnvironment(){
    environment.weather=settings.weather===0?weatherNames[1+Math.floor(Math.random()*4)]:weatherNames[settings.weather];
    environment.night=settings.lighting===0?Math.random()<.42:settings.lighting===2;
    const pitch=settings.pitch===0?1+Math.floor(Math.random()*5):settings.pitch;environment.pitch=pitchNames[pitch];view.setPitch(pitch-1);
    view.setEnvironment(environment.weather,environment.night);
    const symbols={SUNNY:'☀',RAIN:'☂',WIND:'≋',SNOW:'❄'};
    $('weather-badge').textContent=(environment.night?'☾ NIGHT':symbols[environment.weather]+' DAY')+' · '+environment.weather;
  }
  function startGame(){
    if(started)return;started=true;audio.unlock();audio.play('buttons',.5);setScreen('menu');portal('onSplash');
  }
  $('splash').addEventListener('pointerdown',startGame);
  function buildTeamCards(){
    $('team-grid').innerHTML=TEAMS.map(t=>'<button class="team-card" data-team="'+t.id+'" aria-label="'+t.name+'"><img class="flag" src="'+flag(t.id)+'" alt=""><img class="preview" src="'+view.thumbnail(t.id)+'" alt="'+t.name+' 3D kit"><span class="name">'+t.name+'</span></button>').join('');
  }
  buildTeamCards();view.setTeams(0,1);view.setQuality(settings.quality);
  const demo=new Match({teams:[0,1]});
  function selectTeams(cupMode){mode=cupMode?'cup':'quick';home=0;away=1;pick='home';continueUsed=false;setScreen('selection');updateSelection();}
  // Every match starts behind an interstitial: the match is built only inside the callback.
  function playMatch(tournament){
    if(adBusy)return;adBusy=true;clearInput();
    const go=()=>{adBusy=false;beginMatch(tournament);};
    if(typeof PORTAL.interstitial==='function'){try{PORTAL.interstitial(go);}catch(e){go();}}else go();
  }
  function updateSelection(){
    $('selection-title').innerHTML=mode==='cup'?icon('trophy')+' WORLD CUP TOURNAMENT '+icon('trophy'):'PLAY MATCH';
    $('selection-title').querySelectorAll('svg').forEach(s=>{s.style.width='36px';s.style.height='36px';s.style.color='#ffe836';});
    $('pick-label').textContent=pick==='home'?'SELECT YOUR TEAM':'SELECT YOUR OPPONENT';
    $('fixture').innerHTML=TEAMS[home].name+' <b>VS</b> '+(mode==='cup'?'THE WORLD':TEAMS[away].name);
    $('confirm-team').innerHTML=icon('check')+' '+(pick==='home'&&mode==='quick'?'NEXT':'CONFIRM');
    $('team-grid').querySelectorAll('.team-card').forEach(b=>{
      const id=+b.dataset.team;b.classList.toggle('selected',id===home);b.classList.toggle('opponent',mode==='quick'&&pick==='away'&&id===away);
      b.querySelector('.team-check')?.remove();
      if(id===home||mode==='quick'&&pick==='away'&&id===away){const tag=document.createElement('span');tag.className='team-check';tag.textContent=id===home?'✓':'2';b.appendChild(tag);}
      b.setAttribute('aria-pressed',String(id===(pick==='home'?home:away)));
    });
  }
  function confirmTeam(){
    if(mode==='cup'){makeCup();setScreen('bracket');renderBracket();}
    else if(pick==='home'){pick='away';if(away===home)away=(home+1)%TEAMS.length;updateSelection();}
    else playMatch(false);
  }
  function beginMatch(tournament){
    paused=false;modalKind=null;$('modal').hidden=true;
    replay=pendingReplay=null;replayHistory=[];recordClock=0;$('replay-hud').hidden=true;$('match').classList.remove('replay-mode');
    if(tournament){const g=cup.rounds[cup.round].find(g=>g.a===cup.user||g.b===cup.user);home=cup.user;away=g.a===home?g.b:g.a;}
    match=new Match({teams:[home,away],difficulty:settings.difficulty,tournament});
    view.setTeams(home,away);chooseEnvironment();setScreen('match');previousCount=-1;bannerTime=0;accumulator=0;
    $('home-name').textContent=TEAMS[home].name;$('away-name').textContent=TEAMS[away].name;
    $('home-flag').src=flag(home);$('away-flag').src=flag(away);$('home-score').textContent=$('away-score').textContent='0';
    const awayKit=SoccerCore.kitsFor(home,away)[1],awayColor=new THREE.Color(awayKit.shirt),bg=awayColor.clone().multiplyScalar(.65).getStyle();
    document.querySelector('.score-team.away').style.background='linear-gradient('+awayKit.shirt+','+bg+')';
    document.querySelector('.score-team.away').style.color=awayColor.r+awayColor.g+awayColor.b>2?'#123657':'#ffffff';
    $('phase').textContent=tournament?['QUARTERFINAL','SEMIFINAL','FINAL'][cup.round]:'4 VS 4';
    bullet={scale:1,used:0};lastHud='';$('match').classList.remove('bullet-time');endShootoutUI();
    portal('updateLevel',tournament?cup.round+1:1);
    audio.play('fischio_breve',.55);focusGame();
  }
  function capturePose(){return{players:match.players.map(p=>({...p})),ball:{...match.ball},controlled:match.controlled,charging:false,charge:0,goalDelay:match.goalDelay,goalBall:match.goalBall?{...match.goalBall}:null};}
  function recordPose(dt){
    recordClock+=dt;if(recordClock<1/30)return;recordClock-=1/30;
    const pose=capturePose();
    if(pendingReplay&&match.goalDelay>0){if(pendingReplay.net.length<30)pendingReplay.net.push(pose);}
    else if(match.countdown===0){replayHistory.push(pose);if(replayHistory.length>75)replayHistory.shift();}
  }
  function startReplay(){
    const frames=[...pendingReplay.frames,...pendingReplay.net];pendingReplay=null;
    if(frames.length<3)return;
    replay={frames,time:0,duration:(frames.length-1)/30/.9,pose:null};
    clearInput();accumulator=0;bannerTime=0;$('banner').innerHTML='';$('charge-meter').hidden=true;$('replay-hud').hidden=false;$('match').classList.add('replay-mode');
  }
  function endReplay(){
    if(!replay)return;replay=null;$('replay-hud').hidden=true;$('match').classList.remove('replay-mode');clearInput();accumulator=0;focusGame();
  }
  function replayPose(dt){
    if(!paused&&!document.hidden&&!audio.ad)replay.time+=dt;
    if(replay.time>=replay.duration){endReplay();return match;}
    const index=replay.time*.9*30,a=replay.frames[Math.floor(index)],b=replay.frames[Math.min(replay.frames.length-1,Math.floor(index)+1)],f=index%1;
    const blend=(a,b,keys)=>{const p={...a};for(const k of keys)p[k]=a[k]+(b[k]-a[k])*f;return p;};
    const pose={...a,replay:true,players:a.players.map((p,i)=>{
      const q=blend(p,b.players[i],['x','z','vx','vz','dive']);const from=Math.atan2(p.fx,p.fz),to=Math.atan2(b.players[i].fx,b.players[i].fz),angle=from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*f;q.fx=Math.sin(angle);q.fz=Math.cos(angle);return q;
    }),ball:blend(a.ball,b.ball,['x','z','y','vx','vz','super'])};
    replay.pose=pose;return pose;
  }
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function makeCup(){
    const entrants=[home,...shuffle(TEAMS.map(t=>t.id).filter(id=>id!==home)).slice(0,7)];
    cup={user:home,round:0,rounds:[[],[],[]],eliminated:false,champion:null,continueUsed:false};
    for(let i=0;i<8;i+=2)cup.rounds[0].push({a:entrants[i],b:entrants[i+1],score:null,winner:null});
    store(CUP_KEY,cup);
  }
  function renderBracket(){
    const titles=['QUARTERFINALS','SEMIFINALS','FINAL'];$('cup-progress').textContent=cup.champion!==null?(TEAMS[cup.champion].name+' · WORLD CHAMPIONS'):cup.eliminated?'TOURNAMENT COMPLETE':titles[cup.round];
    $('bracket-grid').innerHTML=titles.map((title,r)=>{
      const games=cup.rounds[r].length?cup.rounds[r]:Array.from({length:4/2**r},()=>null);
      return '<div class="bracket-column"><h3>'+title+'</h3>'+games.map(g=>{
        const current=g&&r===cup.round&&(g.a===cup.user||g.b===cup.user)&&g.winner===null&&!cup.eliminated;
        return '<div class="bracket-match'+(current?' current':'')+'">'+[0,1].map(i=>{
          const id=g?(i===0?g.a:g.b):null;
          return '<div class="bracket-row'+(g&&g.winner===id?' winner':'')+'">'+(id!==null?'<img src="'+flag(id)+'" alt="">':'')+'<span>'+(id!==null?TEAMS[id].name:'WINNER')+'</span><b>'+(g?.score?g.score[i]:'–')+'</b></div>';
        }).join('')+'</div>';
      }).join('')+'</div>';
    }).join('');
    $('cup-next').textContent=cup.eliminated||cup.champion!==null?'NEW TOURNAMENT':'PLAY '+['QUARTERFINAL','SEMIFINAL','FINAL'][cup.round];
  }
  function simulate(g){
    const a=Math.floor(Math.random()*5),b=Math.floor(Math.random()*5);g.score=[a,b];if(a===b)g.score[Math.random()<.5?0:1]++;g.winner=g.score[0]>g.score[1]?g.a:g.b;
  }
  function resolveCup(){
    const games=cup.rounds[cup.round],g=games.find(g=>g.a===cup.user||g.b===cup.user);
    const scores=g.a===home?match.score.slice():match.score.slice().reverse();g.score=scores;const r=outcome();g.winner=r>0?cup.user:(g.a===cup.user?g.b:g.a);if(match.pens)g.pens=true;
    games.filter(q=>q!==g).forEach(simulate);
    const won=g.winner===cup.user;
    if(!won){cup.eliminated=true;for(let r=cup.round+1;r<3;r++){
      const prev=cup.rounds[r-1];cup.rounds[r]=[];for(let i=0;i<prev.length;i+=2){const q={a:prev[i].winner,b:prev[i+1].winner,score:null,winner:null};simulate(q);cup.rounds[r].push(q);}
    }cup.champion=cup.rounds[2][0].winner;clearCup();}
    else if(cup.round===2){cup.champion=cup.user;clearCup();}
    else{const next=[];for(let i=0;i<games.length;i+=2)next.push({a:games[i].winner,b:games[i+1].winner,score:null,winner:null});cup.round++;cup.rounds[cup.round]=next;store(CUP_KEY,cup);}
    return won;
  }
  // Winner including the penalty shootout: 1 = player, -1 = CPU, 0 = draw.
  function outcome(){if(match.score[0]!==match.score[1])return match.score[0]>match.score[1]?1:-1;if(match.pens)return match.pens.winner===0?1:-1;return 0;}
  function results(){
    audio.inMatch=false;audio.sync();const res=outcome(),win=res>0,draw=res===0;
    if(mode==='cup')resolveCup();setScreen('results');
    const champion=mode==='cup'&&cup.champion===cup.user;
    if(champion){audio.play('medaglie',.55);celebrateTimer=setTimeout(()=>{if(screen==='results')startCelebration();},5200);}
    $('result-icon').innerHTML=icon(champion||win?'trophy':'dice');
    $('result-title').textContent=champion?'WORLD CHAMPIONS!':draw?'HONOURS EVEN':win?'VICTORY!':'FULL TIME';
    $('result-subtitle').textContent=mode==='cup'?(win?(champion?'THE CUP IS YOURS':'ON TO THE NEXT ROUND'):'THANKS FOR PLAYING THE CUP'):'QUICK MATCH';
    const team=(id)=>'<div class="result-team"><img src="'+flag(id)+'" alt=""><span>'+TEAMS[id].name+'</span></div>';
    $('result-score').innerHTML=team(home)+'<b>'+match.score[0]+' – '+match.score[1]+(match.pens?'<small class="pen-result">PENALTIES '+match.pens.goals[0]+' – '+match.pens.goals[1]+'</small>':'')+'</b>'+team(away);
    const s=match.stats,total=s.possession[0]+s.possession[1]||1;
    $('result-stats').innerHTML=[['SHOTS',s.shots],['SUPER SHOTS',s.supers],['PASSES',s.passes],['TACKLES WON',s.steals],['SAVES',s.saves],['POSSESSION',[Math.round(s.possession[0]/total*100)+'%',Math.round(s.possession[1]/total*100)+'%']]].map(([name,v])=>'<div class="stat-row"><b>'+v[0]+'</b><span>'+name+'</span><b>'+v[1]+'</b></div>').join('');
    $('result-next').textContent=mode==='cup'?(champion?'CELEBRATE ▸':!win?'VIEW BRACKET':'CONTINUE'):'REPLAY';
    if(!champion)audio.play(win?'jingle':draw?'fischio_lungo':'hai_perso',.55);
    if(win||champion)portal('happyMoment');
  }
  function updateSettings(){
    for(const key of ['music','sfx']){const b=$(key+'-toggle');b.textContent=settings[key]?'ON':'OFF';b.classList.toggle('off',!settings[key]);}
    $('difficulty-value').textContent=DIFFICULTY[settings.difficulty].name;$('quality-value').textContent=['LOW','MEDIUM','HIGH'][settings.quality];
    $('weather-value').textContent=weatherNames[settings.weather];$('lighting-value').textContent=lightingNames[settings.lighting];
    $('pitch-value').textContent=pitchNames[settings.pitch];
    $('fullscreen-toggle').textContent=document.fullscreenElement?'EXIT':'ENTER';
  }
  function openOptions(){optionsOrigin=screen;setScreen('options');updateSettings();}
  function openModal(kind,title,body,buttons){
    modalKind=kind;returnFocus=document.activeElement;clearInput();paused=screen==='match';audio.paused=paused;audio.sync();
    $('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-actions').innerHTML=buttons.map(b=>'<button class="chunk '+b.color+'" data-action="'+b.action+'">'+b.label+'</button>').join('');$('modal').hidden=false;
    $('modal-actions').querySelector('button').focus({preventScroll:true});
  }
  function closeModal(){const wasPause=paused;paused=false;modalKind=null;$('modal').hidden=true;audio.paused=false;audio.sync();clearInput();if(wasPause)focusGame();else if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function pause(){if(screen!=='match'||paused||!match||(match.end&&!shootout))return;
    openModal('pause','PAUSED','<p>TAKE A BREATHER.</p><div class="control-row"><button class="toggle '+(!settings.music?'off':'')+'" data-setting="music">MUSIC '+(settings.music?'ON':'OFF')+'</button><button class="toggle '+(!settings.sfx?'off':'')+'" data-setting="sfx">SFX '+(settings.sfx?'ON':'OFF')+'</button></div><p class="muted">WASD / ARROWS MOVE · X PASS / TACKLE<br>SPACE SHOOT / SWITCH / SAVE · SHIFT BOOST</p>',[{label:'RESUME',action:'resume',color:'green'},{label:'HOW TO PLAY',action:'help',color:'blue'},{label:'MAIN MENU',action:'quit',color:'slate'}]);
  }
  function help(){
    openModal(screen==='match'?'help-match':'help','HOW TO PLAY','<p class="help-keys"><kbd>WASD</kbd>/<kbd>ARROWS</kbd> MOVE · <kbd>X</kbd> PASS / TACKLE<br><kbd>SPACE</kbd>/<kbd>C</kbd> SHOOT / SWITCH / SAVE<br><kbd>SHIFT</kbd> BOOST · <kbd>Q</kbd> SWITCH · <kbd>ESC</kbd> PAUSE</p><p class="muted">MOBILE: JOYSTICK + PASS/TACKLE + SHOOT + BOOST.</p><p>HOLD SHOOT FOR POWER. FULL BAR = SUPER SHOT:<br>IT BOWLS OVER A DEFENDER AND DAZES THE KEEPER!<br>STEER RIGHT AFTER THE SHOT TO CURVE IT.<br>NO BALL? PASS BECOMES A SLIDE TACKLE.<br>BOOST NEAR A DEFENDER = SKILL MOVE.<br>SHOT ON YOUR GOAL? PRESS SAVE TO HELP THE KEEPER.<br>YOUR KEEPER HOLDS THE BALL: X PASS, SPACE LONG KICK.</p><p class="muted">THE GREEN ARROW SHOWS WHO GETS YOUR PASS.<br>A DRAW GOES TO PENALTIES. LOSE AND YOU CAN CONTINUE ONCE.</p>',[{label:screen==='match'?'RESUME':'GOT IT',action:'resume',color:'green'}]);
  }
  const actions={
    quick:()=>selectTeams(false),cup:()=>{const saved=loadCup();if(saved)openModal('saved','YOUR CUP IS WAITING',TEAMS[saved.user].name+' · '+['QUARTERFINAL','SEMIFINAL','FINAL'][saved.round],[{label:'CONTINUE CUP',action:'load-cup',color:'green'},{label:'NEW TOURNAMENT',action:'new-cup',color:'purple'},{label:'BACK',action:'resume',color:'slate'}]);else selectTeams(true);},
    'load-cup':()=>{closeModal();cup=loadCup();mode='cup';setScreen('bracket');renderBracket();},
    'new-cup':()=>{closeModal();clearCup();selectTeams(true);},
    options:openOptions,help,confirm:confirmTeam,
    'select-back':()=>{if(pick==='away'){pick='home';updateSelection();}else setScreen('menu');},
    random:()=>{let id=Math.floor(Math.random()*TEAMS.length);if(pick==='away'&&id===home)id=(id+1)%TEAMS.length;if(pick==='home')home=id;else away=id;updateSelection();},
    'options-back':()=>setScreen(optionsOrigin),save:()=>{store(SETTINGS_KEY,settings);setScreen(optionsOrigin);toast('OPTIONS SAVED');},
    fullscreen:()=>{const promise=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();if(promise)promise.then(()=>{fit();updateSettings();}).catch(()=>toast('FULLSCREEN UNAVAILABLE'));else toast('USE YOUR BROWSER FULLSCREEN');},
    pause,resume:closeModal,'skip-replay':endReplay,quit:()=>{endReplay();pendingReplay=null;closeModal();endShootoutUI();match=null;setScreen('menu');},
    menu:()=>{clearTimeout(celebrateTimer);endReplay();pendingReplay=null;endShootoutUI();if(celebration)endCelebration();match=null;setScreen('menu');},
    'cup-next':()=>{if(cup.eliminated||cup.champion!==null)selectTeams(true);else playMatch(true);},
    'result-next':()=>{if(mode==='cup'&&cup&&cup.champion===cup.user&&$('result-next').textContent.startsWith('CELEBRATE')){clearTimeout(celebrateTimer);startCelebration();return;}if(mode==='cup'){setScreen('bracket');renderBracket();}else{continueUsed=false;playMatch(false);}}
  };
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||!started)return;
    if(button.id==='pass-button'||button.id==='shoot-button'||button.id==='boost-button'||button.id==='start')return;
    audio.play('buttons',.38);
    if(button.dataset.team!==undefined){const id=+button.dataset.team;if(pick==='away'&&id===home){toast('CHOOSE A DIFFERENT OPPONENT');return;}if(pick==='home')home=id;else away=id;updateSelection();return;}
    if(button.dataset.setting){const key=button.dataset.setting;settings[key]=!settings[key];store(SETTINGS_KEY,settings);audio.sync();updateSettings();button.textContent=(modalKind?' '+key.toUpperCase()+' ':'')+(settings[key]?'ON':'OFF');button.classList.toggle('off',!settings[key]);return;}
    if(button.dataset.cycle){const k=button.dataset.cycle,max={difficulty:3,quality:3,weather:5,lighting:3,pitch:6}[k];settings[k]=(settings[k]+(+button.dataset.dir)+max)%max;if(k==='quality')view.setQuality(settings.quality);updateSettings();return;}
    actions[button.dataset.action]?.();
  });
  document.addEventListener('fullscreenchange',()=>{fit();requestAnimationFrame(fit);updateSettings();});
  function inputActive(){return screen==='match'&&!replay&&!paused&&!document.hidden&&!audio.ad&&!adBusy&&match&&!match.end;}
  function user(){return match?match.players[match.controlled]:null;}
  function stickVector(){
    if(joyPointer!==null)return {x:input.x,z:input.z};
    const h=a=>[...keys.values()].includes(a);
    return {x:(h('right')?1:0)-(h('left')?1:0),z:(h('down')?1:0)-(h('up')?1:0)};
  }
  /* ---------- Context actions (shared by touch buttons and keyboard) ---------- */
  function actPass(){if(!inputActive())return;const v=stickVector();const r=match.userPassOrTackle(v.x,v.z);}
  function actShoot(){if(!inputActive())return;const v=stickVector(),r=match.userAction(v.x,v.z);if(r==='save')banner('SAVE!','',false,.7);}
  function actShootRelease(){
    if(!match||!match.charging)return;
    if(!inputActive()){match.cancelCharge();return;}
    match.releaseCharge();
  }
  function actBoost(on){
    if(!match)return;
    if(!on||!inputActive()){match.setSprint(false);return;}
    match.setSprint(true);
    const p=user();if(match.ball.owner===p.id){const n=match.nearestEnemy(p);if(n.d<3.6)match.skillMove(p);}
  }
  /* ---------- Focus: the game must own keyboard focus inside the portal iframe ---------- */
  function grabFocus(){try{$('game').focus({preventScroll:true});}catch{}try{window.focus();}catch{}}
  // Never preventDefault on mouse presses: it would stop the browser giving focus to the iframe.
  window.addEventListener('mousedown',e=>{document.querySelectorAll('.kb-focus').forEach(b=>b.classList.remove('kb-focus'));if(!e.target.closest('button'))grabFocus();else try{window.focus();}catch{}},true);
  window.addEventListener('touchstart',e=>{if(!e.target.closest('button'))grabFocus();},{capture:true,passive:true});
  $('game').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')$('game').classList.add('touch');});
  const touchOnly=e=>{if(e.pointerType==='touch'&&e.cancelable)e.preventDefault();};
  $('joystick').addEventListener('pointerdown',e=>{if(!inputActive()||joyPointer!==null)return;touchOnly(e);joyPointer=e.pointerId;try{$('joystick').setPointerCapture(e.pointerId);}catch{}updateJoystick(e);});
  function updateJoystick(e){if(e.pointerId!==joyPointer)return;const rect=$('joystick').getBoundingClientRect(),r=rect.width/2,dx=(e.clientX-rect.left-r)/r,dz=(e.clientY-rect.top-r)/r,mag=Math.hypot(dx,dz),scale=Math.max(1,mag);input.x=dx/scale;input.z=dz/scale;$('joy-knob').style.transform='translate('+input.x*43+'px,'+input.z*43+'px)';}
  $('joystick').addEventListener('pointermove',updateJoystick);
  function endJoystick(e){if(e.pointerId!==joyPointer)return;joyPointer=null;input.x=input.z=0;$('joy-knob').style.transform='';}
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(ev,endJoystick);
  // SHOOT: hold to charge, release to shoot (full bar = Super Shot).
  $('shoot-button').addEventListener('pointerdown',e=>{if(!inputActive()||shootPointer!==null)return;touchOnly(e);shootPointer=e.pointerId;try{$('shoot-button').setPointerCapture(e.pointerId);}catch{}$('shoot-button').classList.add('pressed');actShoot();});
  function endShot(e){if(e.pointerId!==shootPointer)return;shootPointer=null;$('shoot-button').classList.remove('pressed');if(e.type==='pointerup')actShootRelease();else match?.cancelCharge();}
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('shoot-button').addEventListener(ev,endShot);
  $('pass-button').addEventListener('pointerdown',e=>{if(!inputActive()||passPointer!==null)return;touchOnly(e);passPointer=e.pointerId;try{$('pass-button').setPointerCapture(e.pointerId);}catch{}$('pass-button').classList.add('pressed');actPass();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('pass-button').addEventListener(ev,e=>{if(e.pointerId===passPointer){passPointer=null;$('pass-button').classList.remove('pressed');}});
  $('boost-button').addEventListener('pointerdown',e=>{if(!inputActive()||boostPointer!==null)return;touchOnly(e);boostPointer=e.pointerId;try{$('boost-button').setPointerCapture(e.pointerId);}catch{}$('boost-button').classList.add('pressed');actBoost(true);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('boost-button').addEventListener(ev,e=>{if(e.pointerId===boostPointer){boostPointer=null;$('boost-button').classList.remove('pressed');actBoost(false);}});
  /* ---------- Keyboard: physical codes first, then key names, then legacy keyCodes ---------- */
  const CODE={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',KeyX:'pass',KeyZ:'pass',Space:'shoot',KeyC:'shoot',KeyQ:'switch',ShiftLeft:'boost',ShiftRight:'boost',KeyE:'boost',Escape:'back',KeyP:'pause',Enter:'enter',NumpadEnter:'enter',Tab:'tab'};
  const KEY={arrowup:'up',up:'up',w:'up',arrowdown:'down',down:'down',s:'down',arrowleft:'left',left:'left',a:'left',arrowright:'right',right:'right',d:'right',x:'pass',z:'pass',' ':'shoot',spacebar:'shoot',c:'shoot',q:'switch',shift:'boost',e:'boost',escape:'back',esc:'back',p:'pause',enter:'enter',tab:'tab'};
  const KC={38:'up',87:'up',40:'down',83:'down',37:'left',65:'left',39:'right',68:'right',88:'pass',90:'pass',32:'shoot',67:'shoot',81:'switch',16:'boost',69:'boost',27:'back',80:'pause',13:'enter',9:'tab'};
  const keyId=e=>e.code||e.key||String(e.keyCode);
  const keyAction=e=>CODE[e.code]||KEY[(e.key||'').toLowerCase()]||KC[e.keyCode]||null;
  function navButtons(){
    const root=modalKind?$('modal'):document.querySelector('.screen.active');if(!root)return [];
    return [...root.querySelectorAll('button')].filter(b=>!b.disabled&&b.offsetParent!==null&&!b.closest('.action-buttons')&&b.id!=='pause-button'&&!(screen==='match'&&!modalKind));
  }
  function kbFocus(b){document.querySelectorAll('.kb-focus').forEach(x=>x.classList.remove('kb-focus'));if(!b)return;b.classList.add('kb-focus');try{b.focus({preventScroll:true});}catch{b.focus();}}
  function moveFocus(dir){
    const list=navButtons();if(!list.length)return;
    const cur=list.includes(document.activeElement)?document.activeElement:null;
    if(!cur){kbFocus(list[0]);return;}
    const c=cur.getBoundingClientRect(),cx=c.left+c.width/2,cy=c.top+c.height/2,v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir];
    let best=null,bs=Infinity;
    for(const b of list){if(b===cur)continue;const r=b.getBoundingClientRect(),dx=r.left+r.width/2-cx,dy=r.top+r.height/2-cy,along=dx*v[0]+dy*v[1];if(along<=4)continue;const side=Math.abs(dx*v[1]-dy*v[0]),sc=along+side*4;if(sc<bs){bs=sc;best=b;}}
    kbFocus(best||cur);
  }
  function goBack(){
    if(modalKind){if(['pause','help','help-match','saved'].includes(modalKind))closeModal();return;}
    if(screen==='match'){pause();return;}
    if(screen==='selection')actions['select-back']();else if(screen==='options')actions['options-back']();else if(screen==='bracket'||screen==='results')actions.menu();
  }
  window.addEventListener('keydown',e=>{
    const a=keyAction(e);
    if(['up','down','left','right','shoot','tab'].includes(a)&&!(e.target&&e.target.tagName==='INPUT'))e.preventDefault();
    if(!started){if(screen==='splash'&&!e.repeat){e.preventDefault();grabFocus();startGame();}return;}
    if(replay&&(a==='enter'||a==='shoot')){e.preventDefault();if(!e.repeat&&!paused&&!audio.ad)endReplay();return;}
    if(audio.ad||adBusy)return;
    if(screen==='match'&&!modalKind&&(a==='back'||a==='pause')){e.preventDefault();if(!e.repeat)pause();return;}
    if(shootout&&screen==='match'&&!modalKind&&!paused){
      e.preventDefault();if(e.repeat)return;
      if(a==='shoot'||a==='pass'||a==='enter')penPress();
      else if(a==='left')penDive(-1);else if(a==='right')penDive(1);else if(a==='down'||a==='up')penDive(0);
      return;
    }
    if(!inputActive()){
      if(e.repeat&&!['up','down','left','right'].includes(a))return;
      if(['up','down','left','right','tab'].includes(a)){moveFocus(a==='tab'?(e.shiftKey?'up':'down'):a);return;}
      if(a==='enter'||a==='shoot'){e.preventDefault();const list=navButtons();const b=list.includes(document.activeElement)?document.activeElement:list[0];if(b){if(!b.classList.contains('kb-focus'))kbFocus(b);b.click();}return;}
      if(a==='back'||a==='pause'){e.preventDefault();goBack();}
      return;
    }
    if(!a)return;e.preventDefault();if(e.repeat)return;
    keys.set(keyId(e),a);
    if(a==='pass')actPass();
    if(a==='shoot')actShoot();
    if(a==='switch')match.switchPlayer(true);
    if(a==='boost')actBoost(true);
  },true);
  window.addEventListener('keyup',e=>{
    const id=keyId(e),a=keys.get(id)||keyAction(e);keys.delete(id);
    if(a==='shoot'&&match&&![...keys.values()].includes('shoot')){if(inputActive())e.preventDefault();actShootRelease();}
    if(a==='boost'&&match&&![...keys.values()].includes('boost'))match.setSprint(false);
  },true);
  // Losing focus: drop held keys/touches (the keyup never arrives) and hard-mute everything.
  window.addEventListener('blur',()=>{clearInput();if(screen==='match'&&!paused&&match&&(!match.end||shootout)&&!replay)pause();audio.sync();});
  window.addEventListener('focus',()=>{audio.hidden=document.hidden;if(!audio.ad)audio.sync();});
  document.addEventListener('visibilitychange',()=>{clearInput();audio.hidden=document.hidden;if(document.hidden&&screen==='match'&&!paused&&match&&(!match.end||shootout))pause();audio.sync();lastFrame=performance.now();accumulator=0;});
  /* ---------- Penalty shootout: camera behind the taker, keeper in front ---------- */
  let shootout=null;
  const PEN={spot:16.2,goalX:24,keeperX:23.3,runFrom:13.6};
  const penZone=z=>z<-1.15?-1:z>1.15?1:0;
  function endShootoutUI(){shootout=null;if(match)match.penalty=null;$('penalty-hud').hidden=true;$('match').classList.remove('penalties');}
  function startShootout(){
    const pens={kicks:[[],[]],goals:[0,0],winner:null};match.pens=pens;
    shootout={round:0,turn:0,phase:'intro',t:0,pens,kick:null};
    match.end=true;match.penalty={cam:{x:6.2,y:7.4,z:-5.2,lx:23.6,ly:1.1,lz:.3,fov:30},target:null};
    $('match').classList.add('penalties');$('penalty-hud').hidden=false;$('charge-meter').hidden=true;
    $('pen-home-flag').src=flag(home);$('pen-away-flag').src=flag(away);
    renderPenBoard();banner('PENALTIES!','BEST OF FIVE',false,2.2);audio.play('fischio_lungo',.55);
    // Everyone not involved waits around the centre circle.
    parkPlayers();
    match.ball.owner=null;
  }
  // Everyone not involved waits around the centre circle.
  function parkPlayers(){match.players.forEach(p=>{p.vx=p.vz=0;p.dive=0;p.ko=0;p.slide=0;p.down=0;p.kickTime=0;p.x=p.keeper?(p.team===0?-22:-21):-1.5-p.slot*1.6;p.z=p.keeper?0:(p.team===0?-5:5)+p.slot*.8;p.fx=1;p.fz=0;});}
  function renderPenBoard(){
    for(const t of [0,1]){
      const k=shootout.pens.kicks[t],slots=Math.max(5,k.length+(t===0&&shootout.turn===0?1:0));
      let html='';for(let i=0;i<Math.max(5,shootout.pens.kicks[0].length,shootout.pens.kicks[1].length);i++)html+='<i class="'+(k[i]===undefined?'':k[i]?'scored':'missed')+'"></i>';
      $(t===0?'pen-home':'pen-away').innerHTML=html;$(t===0?'pen-home-score':'pen-away-score').textContent=shootout.pens.goals[t];
    }
  }
  function setupKick(){
    parkPlayers();
    const team=shootout.turn,taker=match.players[team*4+(shootout.round%3)],keeper=match.players[(1-team)*4+3],other=match.players[team*4+3];
    // park the other keeper out of the way
    other.x=team===0?-22:-21.5;other.z=0;other.dive=0;
    Object.assign(taker,{x:PEN.runFrom,z:2.8,fx:1,fz:0,vx:0,vz:0,kickTime:0,ko:0,down:0});
    Object.assign(keeper,{x:PEN.keeperX,z:0,fx:-1,fz:0,vx:0,vz:0,dive:0,ko:0});
    Object.assign(match.ball,{x:PEN.spot,y:SoccerCore.BALL_RADIUS*.9,z:0,vx:0,vz:0,vy:0,owner:null,super:0,shot:false,fullShot:false});
    {const dx=PEN.spot-taker.x,dz=-taker.z,l=Math.hypot(dx,dz);taker.fx=dx/l;taker.fz=dz/l;}
    shootout.kick={team,taker,keeper,aimZ:null,aimY:null,dive:null,t:0,result:null,swayPhase:Math.random()*6.28};
    match.penalty.cam={x:6.2,y:7.4,z:-5.2,lx:23.6,ly:1.1,lz:.3,fov:30};
    // Nobody kicks before the referee whistles.
    shootout.phase='ready';shootout.next=team===0?'aimX':'cpuRun';match.penalty.target=null;$('pen-kick').hidden=true;$('pen-dive').hidden=true;
    $('pen-tip').innerHTML=team===0?'YOUR PENALTY · WAIT FOR THE <b>WHISTLE</b>...':'YOU ARE IN GOAL · WAIT FOR THE <b>WHISTLE</b>...';
    if(team===1){
      $('pen-dive').querySelectorAll('button').forEach(b=>b.classList.remove('chosen'));
      const d=DIFFICULTY[settings.difficulty];let z=[-1,0,1][Math.floor(Math.random()*3)]*2.5+(Math.random()-.5)*1.5,y=.6+Math.random()*2;
      if(Math.random()<d.error*.8){if(Math.random()<.5)z=(Math.random()<.5?-1:1)*(4+Math.random()*.8);else y=3.2+Math.random()*.6;}
      shootout.kick.aimZ=z;shootout.kick.aimY=y;
    }
    shootout.t=0;
  }
  function penPress(){
    if(!shootout||!shootout.kick||shootout.kick.team!==0)return;
    const k=shootout.kick,tg=match.penalty.target;
    if(shootout.phase==='aimX'){k.aimZ=tg.z;shootout.phase='aimY';shootout.t=0;$('pen-tip').innerHTML='NOW LOCK THE <b>HEIGHT</b>';audio.play('buttons',.4);}
    else if(shootout.phase==='aimY'){k.aimY=tg.y;shootout.phase='run';shootout.t=0;tg.color='#7dff6a';$('pen-tip').innerHTML='';$('pen-kick').hidden=true;
      // CPU keeper guesses a side; smarter keepers read it more often.
      const d=DIFFICULTY[settings.difficulty],zone=penZone(k.aimZ),read=Math.random()<.3+d.smart*.3;k.dive=read?zone:[-1,0,1].filter(v=>v!==zone)[Math.floor(Math.random()*2)];}
  }
  function penDive(dir){
    if(!shootout||!shootout.kick||shootout.kick.team!==1||shootout.phase!=='cpuRun'||shootout.kick.dive!==null)return;
    shootout.kick.dive=dir;audio.play('buttons',.4);
    $('pen-dive').querySelectorAll('button').forEach(b=>b.classList.toggle('chosen',+b.dataset.dive===dir));
  }
  $('pen-kick').addEventListener('pointerdown',e=>{touchOnly(e);penPress();});
  $('pen-dive').querySelectorAll('button').forEach(b=>b.addEventListener('pointerdown',e=>{touchOnly(e);penDive(+b.dataset.dive);}));
  function judge(k){
    const z=k.aimZ,y=k.aimY,az=Math.abs(z);
    if(az>4.25||y>3.8)return 'wide';
    if(az>3.36||y>2.88)return az>3.36?'post':'bar';
    const zone=penZone(z);
    if(k.dive===zone){if(zone===0?y<2.3:(az<2.8||y<1.95))return 'saved';}
    return 'goal';
  }
  function updateShootout(dt){
    const s=shootout;s.t+=dt;const k=s.kick;
    if(s.phase==='intro'){if(s.t>2.2)setupKick();return;}
    if(s.phase==='ready'){
      if(s.t<1.2)return;
      audio.play('fischio_breve',.75);s.phase=s.next;s.t=0;
      if(s.phase==='aimX'){match.penalty.target={visible:true,z:0,y:1.4,color:'#ffe94c'};$('pen-tip').innerHTML='WHISTLE! TAP <b>KICK</b> TO LOCK THE DIRECTION';$('pen-kick').hidden=false;}
      else{$('pen-tip').innerHTML='WHISTLE! HE IS RUNNING UP · <b>DIVE!</b>';$('pen-dive').hidden=false;}
      return;
    }
    const tg=match.penalty.target;
    if(s.phase==='aimX'){tg.z=Math.sin(s.t*2.8+k.swayPhase)*4.4;tg.y=1.5;return;}
    if(s.phase==='aimY'){tg.y=1.9+Math.sin(s.t*3.2-1.2)*1.7;return;}
    const p=k.taker,kp=k.keeper,b=match.ball;
    if(s.phase==='run'||s.phase==='cpuRun'){
      const runTime=s.phase==='cpuRun'?1.6:.7,u=Math.min(1,s.t/runTime);
      // slow dolly-in on the run-up
      match.penalty.cam.x=6.2+u*1.4;match.penalty.cam.y=7.4-u*.4;
      p.x=PEN.runFrom+(PEN.spot-1.0-PEN.runFrom)*u;p.z=2.8-2.4*u;const lenR=Math.hypot(PEN.spot-p.x,-p.z)||1;p.fx=(PEN.spot-p.x)/lenR;p.fz=-p.z/lenR;p.vx=u<1?5:0;
      if(s.phase==='cpuRun'&&u>.15)p.vx=4;
      kp.z=Math.sin(s.t*7)*.25;// keeper shuffles on the line
      if(u>=1){
        if(k.dive===null)k.dive=0;
        k.result=judge(k);s.phase='flight';s.t=0;p.kickKind='shot';p.kickDuration=.34;p.kickTime=.34;p.vx=0;
        audio.play('pallina_2',.6);$('pen-dive').hidden=true;$('pen-tip').innerHTML='';
        if(match.penalty.target)match.penalty.target.visible=false;
        kp.diveDir=k.dive||1;if(k.dive!==0){kp.dive=1;}
      }
      return;
    }
    if(s.phase==='flight'){
      const T=.48,u=Math.min(1,s.t/T),r=k.result;
      // keeper dive across the line
      if(k.dive!==0){kp.dive=Math.max(0,1-s.t/1.1);kp.z=k.dive*Math.min(2.4,s.t*9);}
      else kp.z=0;
      let endX=r==='wide'?25.6:r==='goal'?25.8:PEN.goalX-.6;
      if(r==='saved'||r==='post'||r==='bar')endX=r==='saved'?PEN.keeperX-.3:PEN.goalX-.2;
      const ez=r==='saved'?kp.z+(k.aimZ-kp.z)*.3:k.aimZ,ey=r==='saved'?Math.min(k.aimY,2):k.aimY;
      b.x=PEN.spot+(endX-PEN.spot)*u;b.z=ez*u;b.y=SoccerCore.BALL_RADIUS*.9+(ey-SoccerCore.BALL_RADIUS*.9)*u+Math.sin(u*Math.PI)*.35;b.vx=30;b.vz=ez*2;
      if(u>=1){
        s.phase='after';s.t=0;const scored=r==='goal';
        s.pens.kicks[k.team].push(scored);if(scored)s.pens.goals[k.team]++;
        b.vx=r==='goal'?2:-7;b.vz=(Math.random()-.5)*6;b.vy=r==='goal'?0:3;
        if(scored){audio.play('rete_porta',.85);view.burst(24.5,k.aimZ,'#ffd935',50,1.6);view.goalWobble[1]=.9;audio.play('goooal_voice',1);audio.play('gooal',.35);banner(k.team===0?'GOAL!':'THEY SCORE','',k.team===0,1.4);}
        else{const txt={saved:k.team===0?'SAVED!':'GREAT SAVE!',post:'OFF THE POST!',bar:'OFF THE BAR!',wide:'MISSED!'}[r];banner(txt,'',k.team===1,1.4);audio.play(r==='post'||r==='bar'?'palo':'nooo',.6);if(r==='saved')view.burst(kp.x,kp.z,'#67faff',24,1.1);if(k.team===1)view.burst(24,0,'#ffe94c',30,1.4);}
        if(k.team===1&&!scored)portal('happyMoment');
        renderPenBoard();
      }
      return;
    }
    if(s.phase==='after'){
      // the ball settles in the net or rolls away
      b.x+=b.vx*dt;b.z+=b.vz*dt;b.y=Math.max(SoccerCore.BALL_RADIUS*.9,b.y+b.vy*dt);b.vy-=9*dt;b.vx*=Math.exp(-3*dt);b.vz*=Math.exp(-3*dt);
      if(b.x>26.1){b.x=26.1;b.vx=0;}
      if(k.dive!==0)kp.dive=Math.max(0,kp.dive-dt);
      if(s.t<1.8)return;
      // decide: best of five, then sudden death
      const [a,c]=s.pens.goals,na=s.pens.kicks[0].length,nc=s.pens.kicks[1].length;
      let winner=null;
      if(na<=5&&nc<=5){const leftA=5-na,leftC=5-nc;if(a>c+leftC)winner=0;else if(c>a+leftA)winner=1;else if(na===5&&nc===5&&a!==c)winner=a>c?0:1;}
      else if(na===nc&&a!==c)winner=a>c?0:1;
      if(winner!==null){
        s.pens.winner=winner;s.phase='done';s.t=0;
        banner(winner===0?'YOU WIN THE SHOOTOUT!':'SHOOTOUT LOST',s.pens.goals[0]+' – '+s.pens.goals[1],winner===0,2.2);
        audio.play(winner===0?'jingle':'hai_perso',.6);
        setTimeout(()=>{if(shootout&&shootout.phase==='done'){const keep=match.pens;endShootoutUI();match.pens=keep;endOfMatch();}},2300);
        return;
      }
      if(s.turn===0)s.turn=1;else{s.turn=0;s.round++;}
      if(na===5&&nc===5&&s.turn===0&&s.round===5)banner('SUDDEN DEATH','',false,1.6);
      setupKick();
    }
  }
  /* ---------- World champions celebration ---------- */
  let celebration=null,celebrateTimer=null;
  function startCelebration(){
    if(!match)return;
    const kit=SoccerCore.kitsFor(home,away)[0],palette=[kit.shirt,kit.shorts,kit.trim,'#ffd23a','#ffffff'];
    // The champions line up facing the camera, captain in the middle.
    const spots=[[0,1.2],[-2.6,.6],[2.6,.6],[0,-1.6]];
    match.players.forEach(p=>{p.vx=p.vz=0;p.dive=0;p.ko=0;p.slide=0;p.down=0;p.kickTime=0;p.skill=0;
      if(p.team===0){const sp=spots[p.slot];p.x=sp[0];p.z=sp[1];p.fx=0;p.fz=1;}else{p.x=-30;p.z=0;}});
    match.ball.owner=null;match.ball.x=-30;match.ball.y=-5;match.ball.vx=match.ball.vz=0;
    match.celebrate={t:0,captainY:0};
    celebration={t:0,next:1.2,palette,confetti:[]};
    for(let i=0;i<170;i++)celebration.confetti.push(newConfetti(true));
    $('champ-flag').src=flag(home);$('champ-name').textContent=TEAMS[home].name;
    setScreen('celebration');
    audio.celebrate=true;audio.inMatch=false;audio.sync();
    portal('happyMoment');
  }
  function newConfetti(anywhere){
    const c=celebration.palette;
    return {x:Math.random()*1280,y:anywhere?-Math.random()*720:-20-Math.random()*80,w:8+Math.random()*9,h:5+Math.random()*6,vy:70+Math.random()*110,vx:(Math.random()-.5)*60,r:Math.random()*6.28,vr:(Math.random()-.5)*8,sway:Math.random()*6.28,color:c[Math.floor(Math.random()*c.length)]};
  }
  function updateCelebration(dt){
    const c=celebration;c.t+=dt;match.celebrate.t=c.t;
    // fireworks in the team colours once the cup has been lifted
    if(c.t>2.2){c.next-=dt;if(c.next<=0){c.next=.32+Math.random()*.45;view.firework(-9+Math.random()*18,7+Math.random()*4,-7+Math.random()*4,c.palette.slice().sort(()=>Math.random()-.5));if(Math.random()<.5)audio.play('bonus',.25,.6+Math.random()*.3);}}
    if(c.t>2.4&&!c.lifted){c.lifted=true;audio.play('gooal',.5);view.burst(0,1.2,'#ffe14a',60,2.2);}
    const cv=$('confetti'),g=cv.getContext('2d');g.clearRect(0,0,1280,720);
    if(c.t<1.6)return;
    for(let i=0;i<c.confetti.length;i++){const p=c.confetti[i];
      p.y+=p.vy*dt;p.x+=(p.vx+Math.sin(c.t*2+p.sway)*30)*dt;p.r+=p.vr*dt;
      if(p.y>740)c.confetti[i]=newConfetti(false);
      g.save();g.translate(p.x,p.y);g.rotate(p.r);g.scale(1,Math.abs(Math.cos(p.r*1.3))+.15);g.fillStyle=p.color;g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore();}
  }
  function endCelebration(){celebration=null;if(match)match.celebrate=null;audio.celebrate=false;try{audio.winner.pause();audio.winner.currentTime=0;}catch(e){}audio.sync();const cv=$('confetti');cv.getContext('2d').clearRect(0,0,1280,720);}
  actions['celebrate-next']=()=>{endCelebration();$('result-next').textContent='VIEW BRACKET';setScreen('bracket');renderBracket();};
  /* ---------- Continue after a defeat (once per run) ---------- */
  function endOfMatch(){
    const lost=outcome()<0,used=mode==='cup'?!!cup?.continueUsed:continueUsed;
    if(lost&&!used){offerContinue();return;}
    results();
  }
  function offerContinue(){
    const video=typeof PORTAL.rewarded==='function';
    openModal('continue','YOU LOST!','<p class="lost-score"><img src="'+flag(home)+'" alt=""> '+match.score[0]+' – '+match.score[1]+' <img src="'+flag(away)+'" alt=""></p><p>'+(video?'WATCH A VIDEO TO PLAY THIS MATCH AGAIN.':'PLAY THIS MATCH AGAIN?')+'<br>YOU CAN CONTINUE ONLY ONCE.</p><p class="muted">'+(mode==='cup'?'GIVE UP AND YOUR WORLD CUP STARTS AGAIN FROM THE BEGINNING.':'GIVE UP TO SEE THE FINAL RESULT.')+'</p>',[{label:video?'▶ WATCH VIDEO · CONTINUE':'CONTINUE',action:'continue',color:'green'},{label:'GIVE UP',action:'give-up',color:'slate'}]);
  }
  function useContinue(){if(mode==='cup'){cup.continueUsed=true;store(CUP_KEY,cup);}else continueUsed=true;}
  actions.continue=()=>{
    if(adBusy)return;
    if(typeof PORTAL.rewarded==='function'){
      adBusy=true;
      try{PORTAL.rewarded(ok=>{adBusy=false;if(!ok){toast('VIDEO NOT AVAILABLE · TRY AGAIN');return;}useContinue();modalKind=null;$('modal').hidden=true;beginMatch(mode==='cup');toast('SECOND CHANCE!');});}
      catch(e){adBusy=false;toast('VIDEO NOT AVAILABLE · TRY AGAIN');}
    } else {useContinue();modalKind=null;$('modal').hidden=true;playMatch(mode==='cup');}
  };
  actions['give-up']=()=>{modalKind=null;$('modal').hidden=true;paused=false;audio.paused=false;results();};
  function event(e){
    view.onEvent(e);
    const sounds={pass:'pallina_1',shot:'pallina_2',super:'wush',charged:'bonus',tackle:'rimbalzo',impact:'rimbalzo',post:'palo',save:'nooo',bounce:'rimbalzo',net:'rete_porta',slide:'wush',skill:'wush',usersave:'bonus',intercept:'pallina_2'};
    if(sounds[e.type])audio.play(sounds[e.type],e.type==='super'?.8:e.type==='net'?.85:e.type==='slide'||e.type==='skill'?.32:.45,e.type==='pass'?1.1:e.type==='slide'?.75:e.type==='skill'?1.35:1);
    if(e.type==='tackle'&&e.slide&&!e.loose&&e.team===0)banner('TACKLE!','',false,.6);
    if(e.type==='skill'&&e.team===0)banner('SKILL!','',false,.5);
    if(e.type==='playerko'){banner('BOWLED OVER!','',false,1);audio.play('palo',.6,.8);audio.play('bonus',.45,.9);}
    if(e.type==='keeperko'){banner('PARRIED!','THE KEEPER IS DAZED',false,1.3);audio.play('palo',.7,.7);audio.play('bonus',.5,.8);}
    if(e.type==='goal'){
      pendingReplay={frames:[...replayHistory,capturePose()],net:[]};
      $('home-score').textContent=match.score[0];$('away-score').textContent=match.score[1];
      const el=$(e.team===0?'home-score':'away-score');el.classList.remove('score-flash');void el.offsetWidth;el.classList.add('score-flash');
      banner(e.super?'SUPER GOAL!':'GOOOAL!',TEAMS[e.team===0?home:away].name+(e.super?' · SUPER SHOT!':''),true,e.super?3.1:2.6);audio.play(e.super?'super_goal_voice':'goooal_voice',1);audio.play('gooal',.45);clearInput();
      $('match').classList.remove('goal-impact','super-impact');void $('match').offsetWidth;$('match').classList.add(e.super?'super-impact':'goal-impact');
      if(e.team===0){sessionGoals++;portal('updateScore',sessionGoals);}
    }
    if(e.type==='kickoff'){replayHistory=[];recordClock=0;previousCount=-1;audio.play('fischio_breve',.5);}
    if(e.type==='overtime'){banner('GOLDEN GOAL','NEXT GOAL WINS',false,2);$('phase').textContent='GOLDEN GOAL';audio.play('fischio_lungo',.55);}
    if(e.type==='end'){audio.play('fischio_lungo',.55);if(match.needsPenalties&&!match.pens)startShootout();else endOfMatch();}
  }
  function hud(){
    const seconds=Math.ceil(match.time);
    $('timer').textContent=match.overtime?'GOLDEN':Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');
    if(match.countdown>0){const count=Math.ceil(match.countdown);if(count!==previousCount){previousCount=count;banner(count===1?'GO!':String(count),'ATTACK THE RIGHT GOAL',false,.8);}}
    const c=$('charge-meter');c.hidden=!match.charging;
    if(match.charging){const superShot=match.charge>=1.12;c.classList.toggle('super',superShot);c.classList.toggle('over',match.charge>1.45);$('charge-fill').style.width=Math.min(100,match.charge/1.12*100)+'%';$('charge-text').textContent=match.charge>1.45?'OVERCHARGED':superShot?'SUPER SHOT!':match.charge>.55?'POWER SHOT':'HOLD TO CHARGE';}
    // Context labels: the same two buttons attack and defend.
    const p=user(),keeperBall=match.userKeeperHolds(),own=match.ball.owner===p.id||keeperBall,save=!own&&match.saveWindow();
    const state=keeperBall?'keeper':own?'attack':save?'save':'defend';
    if(state!==lastHud){
      lastHud=state;
      $('shoot-button').firstChild.textContent=state==='keeper'?'KICK':state==='attack'?'SHOOT':state==='save'?'SAVE!':'SWITCH';
      $('shoot-button').querySelector('small').textContent=state==='keeper'?'LONG KICK':state==='attack'?'HOLD FOR POWER':state==='save'?'HELP THE KEEPER':'CHANGE PLAYER';
      if(state==='keeper')banner('YOUR BALL','PASS OR KICK IT LONG',false,1.1);
      $('pass-button').firstChild.textContent=own?'PASS':'TACKLE';
      $('pass-button').querySelector('small').textContent=own?'X':'X · SLIDE';
      $('shoot-button').classList.toggle('switch',state==='defend');$('shoot-button').classList.toggle('save',state==='save');
      $('pass-button').classList.toggle('defend',!own);
    }
    $('boost-fill').style.transform='scaleY('+match.stamina.toFixed(3)+')';
    $('boost-button').classList.toggle('empty',match.stamina<.05);
  }
  // Bullet time: a short slow motion while charging a shot on a real scoring chance.
  function updateBullet(dt){
    let target=1;
    if(match&&match.charging&&!replay){
      const p=user(),toGoal=24-p.x;
      if(toGoal<15&&Math.abs(p.z)<9&&match.charge>.3&&bullet.used<1.3){target=.5;bullet.used+=dt;}
    } else if(match&&!match.charging)bullet.used=Math.max(0,bullet.used-dt*.25);
    bullet.scale+=(target-bullet.scale)*Math.min(1,dt*10);
    if(match)match.timeScale=bullet.scale;
    $('match').classList.toggle('bullet-time',bullet.scale<.8);
  }
  function frame(now){
    const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;fps=fps*.95+(1/Math.max(dt,.001))*.05;
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
    if(bannerTime>0&&!paused){bannerTime-=dt;if(bannerTime<=0)$('banner').innerHTML='';}
    if(inputActive()){
      const v=stickVector();
      updateBullet(dt);
      accumulator+=dt*bullet.scale;
      while(accumulator>=1/120&&screen==='match'&&!replay&&inputActive()){match.update(1/120,v);recordPose(1/120);match.drainEvents().forEach(event);accumulator-=1/120;if(pendingReplay&&match.goalDelay>0&&match.goalDelay<.09)startReplay();}
      if(match&&!match.end){hud();
        // Ball at the player's feet: a little tic-tic-tic on every step.
        const up=user();if(up&&match.ball.owner===up.id&&match.countdown<=0){const sp=Math.hypot(up.vx,up.vz);if(sp>1.2){stepTimer-=dt*bullet.scale;if(stepTimer<=0){audio.play('pl1_steps',.38,.94+Math.random()*.14);stepTimer=Math.max(.16,Math.min(.4,2/sp));}}else stepTimer=0;}
      }
    } else accumulator=0;
    const shown=replay?replayPose(dt):match||demo;
    if(shootout&&!paused&&!audio.ad&&!document.hidden)updateShootout(dt);
    if(celebration&&screen==='celebration'&&!paused&&!audio.ad&&!document.hidden)updateCelebration(dt);
    if(!document.hidden&&!['splash','menu','options'].includes(screen))view.render(shown,dt*(replay?1:bullet.scale),paused||audio.ad||!!(match&&match.end&&!shootout&&!match.celebrate));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updateSettings();
  // Platform adapters gate all audio, input and match time through beginAd/endAd.
  // endAd unlocks lazily: it never calls play() itself and re-checks that no ad is still running.
  let priorAdPaused=false,adRelease=null;
  window.MiniSoccer={
    skipReplay:endReplay,
    pause:()=>{if(screen==='match')pause();},
    beginAd:()=>{clearTimeout(adRelease);adRelease=null;if(!audio.ad){priorAdPaused=paused;}audio.ad=true;clearInput();audio.sync();audio.holdMute(true);},
    endAd:(delay=900,after=null)=>{
      clearTimeout(adRelease);
      if(!audio.ad){adRelease=null;if(after)after();return;}
      adRelease=setTimeout(()=>{
        adRelease=null;
        if(PORTAL.adInProgress&&PORTAL.adInProgress()){if(after)after();return;}
        audio.ad=false;audio.holdMute(false);paused=priorAdPaused;audio.paused=paused;clearInput();lastFrame=performance.now();accumulator=0;grabFocus();audio.sync();
        if(after)after();
      },delay);
    },
    isAdActive:()=>audio.ad,
    snapshot:()=>({pen:shootout?{phase:shootout.phase,goals:shootout.pens.goals.slice(),turn:shootout.turn}:null,pens:match&&match.pens?{goals:match.pens.goals.slice(),winner:match.pens.winner}:null,screen,paused,started,modal:modalKind,adBusy,continueUsed:mode==='cup'?!!cup?.continueUsed:continueUsed,environment:{...environment},fps:Math.round(fps),replay:replay?{time:replay.time,duration:replay.duration,frames:replay.frames.length}:null,score:match?.score.slice(),time:match?.time,end:match?.end,controlled:match?.controlled,stamina:match?.stamina,bullet:bullet.scale,players:match?.players.map(p=>({id:p.id,team:p.team,keeper:p.keeper,x:p.x,z:p.z,fx:p.fx,fz:p.fz,dive:p.dive,slide:p.slide,down:p.down,skill:p.skill})),ball:match?{...match.ball}:null,charging:match?.charging,charge:match?.charge,cup:cup?JSON.parse(JSON.stringify(cup)):null,hasFocus:document.hasFocus(),audio:{gate:audio.gated,ad:audio.ad,music:settings.music,sfx:settings.sfx,audible:audio.all().filter(a=>!a.paused&&!a.muted&&a.volume>0).length}}),
    debug:{view,results:()=>results(),celebrate:()=>startCelebration(),get match(){return match;},set match(m){match=m;},end:()=>{if(match){match.time=0.01;}},forceScore:(a,b)=>{if(match){match.score=[a,b];$('home-score').textContent=a;$('away-score').textContent=b;}}}
  };
})();
