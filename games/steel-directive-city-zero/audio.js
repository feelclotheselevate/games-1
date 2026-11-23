'use strict';
function audioPreference(){try{return JSON.parse(localStorage.getItem('steel-directive-audio-v1'))||{};}catch{return{};}}
const audioPrefs=audioPreference();
const AudioBank={enabled:false,preference:audioPrefs.enabled!==false,suspended:false,pools:{},loops:{},lastStep:0,lastImpact:0,lastError:null,
 musicVolume:typeof audioPrefs.music==='number'?Math.max(0,Math.min(1,audioPrefs.music)):.18,
 effectsVolume:typeof audioPrefs.effects==='number'?Math.max(0,Math.min(1,audioPrefs.effects)):.9,
 remember(){try{localStorage.setItem('steel-directive-audio-v1',JSON.stringify({enabled:this.preference,music:this.musicVolume,effects:this.effectsVolume}));}catch{}},
 start(a){try{const result=a.play();if(result?.catch)result.catch(e=>{this.lastError=e.name+': '+e.message;});}catch(e){this.lastError=e.message;}},
 play(name,volume=.4){if(!this.enabled||this.suspended)return false;const list=(window.STEEL_DIRECTIVE_AUDIO||{})[name];if(!list?.length)return false;try{const file=list[Math.floor(Math.random()*list.length)];let pool=this.pools[file]??=[];let a=pool.find(a=>a.paused||a.ended);if(!a&&pool.length<8){a=new Audio(file);a.preload='auto';pool.push(a);}if(!a){a=pool.reduce((oldest,item)=>item.currentTime>oldest.currentTime?item:oldest);a.pause();}a.currentTime=0;a.volume=Math.max(0,Math.min(1,volume*this.effectsVolume));this.start(a);return true;}catch(e){this.lastError=e.message;return false;}},
 setEnabled(value){this.enabled=value;this.preference=value;this.remember();if(!value){Object.values(this.pools).flat().forEach(a=>a.pause());Object.values(this.loops).forEach(a=>a.pause());}else if(!this.suspended)this.ambient();},
 loop(key,volume){let file=(window.STEEL_DIRECTIVE_AUDIO||{})[key]?.[0];if(!file)return;let a=this.loops[key];if(!a){a=new Audio(file);a.loop=true;a.preload='auto';this.loops[key]=a;}a.volume=Math.max(0,Math.min(1,volume));if(this.enabled&&!this.suspended&&a.volume>0){if(a.paused)this.start(a);}else a.pause();},
 ambient(){if(!this.enabled||this.suspended)return;this.loop('music',this.musicVolume);this.loop('ambience',.10*this.effectsVolume);this.loop('machinery',.085*this.effectsVolume);},
 setVolume(channel,value){this[channel==='music'?'musicVolume':'effectsVolume']=Math.max(0,Math.min(1,Number(value)));this.remember();this.ambient();},
 trapLevels(electric,steam){this.loop('electric',electric*this.effectsVolume*.42);this.loop('steam',steam*this.effectsVolume*.42);},
 resetTraps(){for(const key of ['electric','steam']){let a=this.loops[key];if(a){a.pause();a.currentTime=0;a.volume=0;}}},
 pause(){this.suspended=true;Object.values(this.pools).flat().forEach(a=>a.pause());Object.values(this.loops).forEach(a=>a.pause());},
 resume(){this.suspended=false;if(this.enabled)this.ambient();}
};
