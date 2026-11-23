(function () {
  'use strict';
  // The page counts as active only when visible AND focused: an ad overlay is an iframe on top of the
  // page, so document.hidden stays false while it plays but the iframe takes the focus.
  function pageActive(){
    if(document.hidden)return false;
    try{if(typeof document.hasFocus==='function'&&!document.hasFocus())return false;}catch(e){}
    return true;
  }
  class AudioBus {
    constructor(settings) {
      this.settings=settings;this.started=false;this.paused=false;this.hidden=false;this.ad=false;this.blocked=false;
      this.musicIndex=Math.random()<.5?0:1;this.tracks=[new Audio('audio/music/music1.ogg'),new Audio('audio/music/music2.ogg')];
      this.tracks.forEach((a,i)=>{a.preload='none';a.volume=.22;a.addEventListener('ended',()=>{this.musicIndex=1-i;this.sync();});});
      this.crowd=new Audio('audio/sfx/stadium.ogg');this.crowd.loop=true;this.crowd.volume=.13;this.crowd.preload='none';this.inMatch=false;
      this.voices=[];this.cooldowns={};this.sfx={};
      for(const n of ['buttons','fischio_breve','fischio_lungo','gooal','hai_perso','medaglie','nooo','pallina_1','pallina_2','palo','rimbalzo','jingle','wush','bonus','goooal_voice','super_goal_voice','pl1_steps','rete_porta'])this.sfx[n]=new Audio('audio/sfx/'+n+'.ogg');
      this.winner=new Audio('audio/sfx/winner.ogg');this.winner.preload='none';this.winner.volume=.8;this.celebrate=false;
      this.muteTimer=null;
    }
    get gated(){return !this.started||this.paused||this.hidden||this.ad||this.blocked||!pageActive();}
    unlock(){this.started=true;this.sync();}
    play(name,volume=.6,rate=1) {
      if(this.gated||!this.settings.sfx||!this.sfx[name])return;
      const now=performance.now();if(now-(this.cooldowns[name]||0)<(name==='rimbalzo'?130:name==='pl1_steps'?120:65))return;this.cooldowns[name]=now;
      this.voices=this.voices.filter(a=>!a.ended&&!a.paused);
      if(this.voices.length>=6){const old=this.voices.shift();old.pause();old.currentTime=0;}
      const a=this.sfx[name].cloneNode();a.volume=volume;a.playbackRate=rate;a.muted=false;this.voices.push(a);a.play().catch(()=>{});
    }
    all(){return [...this.tracks,this.crowd,this.winner,...this.voices];}
    // Hard mute: pause + muted + zero volume, so an in-flight play() promise cannot become audible.
    hardMute(){
      this.all().forEach(a=>{try{a.pause();a.muted=true;a.volume=0;}catch(e){}});
      this.voices.forEach(a=>{try{a.currentTime=0;}catch(e){}});this.voices=[];
    }
    // While an ad is on screen the mute is repeated, because play() is asynchronous.
    holdMute(on){
      if(on&&!this.muteTimer){this.hardMute();this.muteTimer=setInterval(()=>{if(this.ad||this.blocked)this.hardMute();else this.holdMute(false);},200);}
      if(!on&&this.muteTimer){clearInterval(this.muteTimer);this.muteTimer=null;}
    }
    sync() {
      if(this.gated){this.hardMute();return;}
      // Champions celebration: WINNER replaces the background music.
      if(this.celebrate&&this.settings.music){this.winner.muted=false;this.winner.volume=.8;this.winner.play().catch(()=>{});}else this.winner.pause();
      this.tracks.forEach((a,i)=>{if(this.settings.music&&!this.celebrate&&i===this.musicIndex){a.muted=false;a.volume=this.inMatch?.14:.22;a.play().catch(()=>{});}else a.pause();});
      if(this.settings.sfx&&this.inMatch){this.crowd.muted=false;this.crowd.volume=.13;this.crowd.play().catch(()=>{});}else this.crowd.pause();
      if(!this.settings.sfx){this.voices.forEach(a=>a.pause());this.voices=[];}
    }
  }
  AudioBus.pageActive=pageActive;
  window.SoccerAudio=AudioBus;
})();
