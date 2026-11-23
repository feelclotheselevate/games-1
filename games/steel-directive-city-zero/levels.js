/* Editable campaign data. Six distinct encounter modules form each mission. */
'use strict';
const THEMES = [{"name": "NEON PRECINCT", "sky": "#111729", "fog": "#143d51", "accent": "#6fe8ff", "hazard": "#6fe8ff", "tint": "none", "detail": "city", "art": 0}, {"name": "FOUNDRY BELT", "sky": "#241c26", "fog": "#65432c", "accent": "#ffc079", "hazard": "#ffc079", "tint": "none", "detail": "city", "art": 1}, {"name": "HELIX LABS", "sky": "#10252c", "fog": "#245c66", "accent": "#77f4ec", "hazard": "#77f4ec", "tint": "none", "detail": "city", "art": 2}, {"name": "BLACKSITE NINE", "sky": "#131c2a", "fog": "#303e52", "accent": "#98bada", "hazard": "#98bada", "tint": "none", "detail": "city", "art": 3}, {"name": "CROWN DISTRICT", "sky": "#253441", "fog": "#4f6876", "accent": "#f4d798", "hazard": "#f4d798", "tint": "none", "detail": "city", "art": 4}, {"name": "ZERO CITADEL", "sky": "#182235", "fog": "#344f73", "accent": "#90bfff", "hazard": "#90bfff", "tint": "none", "detail": "city", "art": 4}];
const LEVELS = [
 ['First Response',0,'ACBDAC','rifle',null],
 ['Lockdown Avenue',0,'BDACDB','shotgun',null],
 ['Warden Protocol',0,'CABDCA','plasma','mini'],
 ['Railhead Breach',0,'DCABBD','rocket','boss'],
 ['Freight Intercept',1,'BECADB','shotgun',null],
 ['Furnace District',1,'CEBDEC','rail',null],
 ['Smelter Control',1,'EDBACE','plasma','mini'],
 ['Crucible Override',2,'BEECDA','rocket','boss'],
 ['Medical Quarantine',2,'DFAECB','plasma',null],
 ['Memory Vault',2,'FDBEAF','shotgun',null],
 ['Helix Conspiracy',3,'AFDECF','rail','mini'],
 ['Neural Shutdown',3,'FCEBDF','rocket','boss'],
 ['Silent Perimeter',3,'ECFADB','rail',null],
 ['Prison Uprising',4,'DEFCBE','plasma',null],
 ['The Watchtower',4,'CFBEDF','shotgun','mini'],
 ['Sentinel Down',4,'FEDECF','rocket','boss'],
 ['Citadel Approach',5,'FEDCBA','plasma',null],
 ['Executive Order',5,'EFDCFE','rail',null],
 ['Last Directive',5,'DCFEFD','rocket','mini'],
 ['City Zero',5,'FEDFEF','rocket','boss']
].map(([name,theme,layout,weapon,boss],index)=>({name,theme,layout,weapon,boss,index,world:4400,indexDifficulty:1+index*.075}));
const WEAPONS = {
 pistol:{name:'VIGIL / SIDEARM',short:'PISTOL',mag:12,reserve:Infinity,damage:24,rate:.28,reload:1.05,speed:1050,pellets:1,spread:0,color:'#ffe2ad',freq:140},
 rifle:{name:'AR-09 / ASSAULT',short:'RIFLE',mag:30,reserve:150,damage:18,rate:.105,reload:1.5,speed:1300,pellets:1,spread:.018,color:'#ffe2ad',freq:110},
 shotgun:{name:'BREACH / SHOTGUN',short:'SHOTGUN',mag:8,reserve:48,damage:17,rate:.65,reload:1.8,speed:1000,pellets:6,spread:.075,color:'#ffc579',freq:65},
 plasma:{name:'ION / PLASMA',short:'PLASMA',mag:36,reserve:180,damage:23,rate:.14,reload:1.7,speed:780,pellets:1,spread:.008,color:'#86efff',freq:340},
 rail:{name:'LANCE / RAILGUN',short:'RAILGUN',mag:5,reserve:30,damage:110,rate:1.05,reload:2.1,speed:2400,pellets:1,spread:0,color:'#edabff',freq:510,pierce:true},
 rocket:{name:'RUIN / LAUNCHER',short:'ROCKET',mag:3,reserve:18,damage:120,rate:.95,reload:2.2,speed:600,pellets:1,spread:0,color:'#ff8a42',freq:55,blast:115}
};
const ANIMATIONS={idle:{frames:[0,1,2,3,4,5],fps:6,loop:true},run:{frames:[6,7,8,9,10,11],fps:12,loop:true},jump:{frames:[12,13],fps:5,loop:false},fall:{frames:[14],fps:1,loop:false},dodge:{frames:[15,16,16],fps:11,loop:false},shoot:{frames:[18,19],fps:14,loop:false},reload:{frames:[20,21,22,23],fps:3,loop:false},hit:{frames:[17],fps:8,loop:false},death:{frames:[24,25,26,27,28,29],fps:7,loop:false}};

// Every mission ends with a district enforcement unit; every fourth mission faces its commander.
LEVELS.forEach((level,index)=>{level.boss="boss";level.wardenId=Math.floor(index/4)+1;});

LEVELS.forEach((level,i)=>{level.theme=i===19?5:Math.floor(i/4);});

const ENVIRONMENT_NAMES=["First Response", "Night Market", "Rooftop Pursuit", "Metro Breach", "Freight Intercept", "Assembly Line", "Rail Yard", "Crucible Override", "Medical Quarantine", "Surgical Theater", "Cryogenic Archive", "Neural Shutdown", "Silent Perimeter", "Cellblock Uprising", "Exercise Yard", "Warden Control", "Citadel Plaza", "Data Vault", "Skybridge Assault", "City Zero"];
LEVELS.forEach((level,i)=>{level.name=ENVIRONMENT_NAMES[i];level.environment="env"+i;level.outdoors=[0,1,2,6,12,14,16,18].includes(i);});
