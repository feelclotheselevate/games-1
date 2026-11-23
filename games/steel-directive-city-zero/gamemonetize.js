/* Official integration: https://gamemonetize.com/sdk
   Keep the editor sources local; this is the runtime SDK adapter only. */
'use strict';
window.GameMonetize={
 gameId:'2htlt0jzz98u493u3z9jt9wsykiqtv0a',ready:false,advertising:false,
 pending:false,lastRequest:-Infinity,previous:null,error:null,
 requestAd(){
  if(!this.ready||this.advertising||this.pending||Date.now()-this.lastRequest<120000||typeof window.sdk?.showBanner!=='function')return false;
  this.pending=true;this.lastRequest=Date.now();
  try{window.sdk.showBanner();setTimeout(()=>{if(!this.advertising)this.pending=false;},12000);return true;}
  catch(error){this.pending=false;this.error=String(error);return false;}
 },
 onEvent(event){
  if(event.name==='SDK_READY'){this.ready=true;return;}
  if(event.name==='SDK_GAME_PAUSE'){
   if(this.advertising)return;
   this.previous={mode,muted,suspended:AudioBank.suspended};this.advertising=true;this.pending=false;
   clearInput();mode='ad';muted=true;AudioBank.pause();audio?.suspend?.();return;
  }
  if(event.name==='SDK_GAME_START'){
   this.pending=false;if(!this.advertising||!this.previous)return;
   const prior=this.previous;this.previous=null;this.advertising=false;clearInput();muted=prior.muted;mode=prior.mode;
   if(document.hidden&&mode==='play'){mode='pause';panel('PAUSED','P to resume','RESUME');}
   if(prior.suspended||mode==='pause'||document.hidden)AudioBank.pause();else{AudioBank.resume();if(!muted)audio?.resume?.();}
  }
 }
};
window.SDK_OPTIONS={gameId:window.GameMonetize.gameId,onEvent:event=>window.GameMonetize.onEvent(event)};
if(window.GameMonetize.gameId&&!document.getElementById('gamemonetize-sdk')){
 const script=document.createElement('script');script.id='gamemonetize-sdk';script.async=true;
 script.src='https://api.gamemonetize.com/sdk.js';
 script.onerror=()=>{window.GameMonetize.error='SDK unavailable';window.GameMonetize.ready=false;};
 document.head.appendChild(script);
}
