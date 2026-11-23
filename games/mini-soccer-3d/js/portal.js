/* GameMonetize build: ad after the splash and before every match (showAd(); startLevel();). No rewarded video. */
window.PORTAL={
  name:'gamemonetize',
  onSplash:function(){showAd();},
  interstitial:function(cb){showAd();if(cb)cb();},
  adInProgress:function(){return _adPaused;}
};
