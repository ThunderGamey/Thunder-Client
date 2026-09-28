/* Thunder Client page audio. Part of Thunder Client, created and owned by Jayvardhan Ginni
   (ThunderGamey). Everything the page plays outside the game's own sounds, made in the browser
   (Web Audio, no sound files), on window.ThunderAmbient:
   - thunder(big, far): one lightning strike. A zap and a crackle at the flash, a distorted crack,
     then a rolling rumble with sub-bass, through a compressor so every strike is loud and clear.
     The loading screen and the title screen (automatic strikes and the ones you click) all use it.
     big: a close, heavier strike; far: only a distant rumble (lightning inside the clouds).
   - rain(on): the loading screen's rain.
   - the menu ambience: wind, low air and now and then a distant rumble.
   Browsers allow sound only after the first click or key press on the page. Until then nothing is
   scheduled (sounds queued while the audio is locked would all play at once when it unlocks).
   Thunder Client blocks all of it (setBlocked) while a world or server is open, and switches it
   with the "Storm sounds (menus only)" setting.
*/
(function(){
  "use strict";

  var state = {
    enabled: true,
    volume: 0.16,
    intensity: 0.55,
    started: false,
    suspended: false,
    blocked: false,     // a world or server is open: stay silent
    unlocked: false     // the browser allows sound (after the first click or key)
  };
  var BASE_VOLUME = 0.16;       // state.volume the thunder level below was tuned at
  var THUNDER_VOLUME = 0.38;

  try {
    state.enabled = localStorage.getItem("thunder.ambient.enabled") !== "0";
    var storedVolume = parseFloat(localStorage.getItem("thunder.ambient.volume"));
    var storedIntensity = parseFloat(localStorage.getItem("thunder.ambient.intensity"));
    if (isFinite(storedVolume)) state.volume = Math.max(0, Math.min(0.6, storedVolume));
    if (isFinite(storedIntensity)) state.intensity = Math.max(0, Math.min(1, storedIntensity));
  } catch(e){}

  var ctx = null;
  var master = null;
  var windGain = null;
  var airGain = null;
  var windSource = null;
  var airSource = null;
  var windFilter = null;
  var airFilter = null;
  var thunderTimer = 0;
  var thunderBus = null, thunderMaster = null, distortion = {};
  var rainSource = null, rainGain = null;
  var unlockCallbacks = [];

  function clamp(v){ return Math.max(0, Math.min(1, v)); }

  function save(){
    try {
      localStorage.setItem("thunder.ambient.enabled", state.enabled ? "1" : "0");
      localStorage.setItem("thunder.ambient.volume", String(state.volume));
      localStorage.setItem("thunder.ambient.intensity", String(state.intensity));
    } catch(e){}
  }

  function getContext(){
    if(ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try { ctx = new AC(); } catch(e){ return null; }
    ctx.onstatechange = function(){ if(ctx.state === "running") unlocked(); };
    return ctx;
  }
  // true when sound can play right now
  function running(){ return !!ctx && ctx.state === "running"; }
  function unlocked(){
    if(state.unlocked) return;
    state.unlocked = true;
    var cbs = unlockCallbacks; unlockCallbacks = [];
    cbs.forEach(function(cb){ try{ cb(); }catch(e){} });
    waitForStormToEnd();
  }

  function makeNoiseBuffer(seconds, color){
    var c = ctx;
    var length = Math.max(1, Math.floor(c.sampleRate * seconds));
    var buffer = c.createBuffer(1, length, c.sampleRate);
    var data = buffer.getChannelData(0);
    var last = 0;
    for(var i=0;i<length;i++){
      var white = Math.random() * 2 - 1;
      if(color === "brown"){
        last = (last + 0.018 * white) / 1.018;
        data[i] = last * 3.4;
      }else{
        data[i] = white;
      }
    }
    return buffer;
  }

  // ---- menu ambience ---------------------------------------------------------------------------
  function buildGraph(){
    if(!ctx || master) return;

    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    windSource = ctx.createBufferSource();
    windSource.buffer = makeNoiseBuffer(5, "white");
    windSource.loop = true;

    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 950;
    windFilter.Q.value = 0.42;

    windGain = ctx.createGain();
    windGain.gain.value = 0.18;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);

    airSource = ctx.createBufferSource();
    airSource.buffer = makeNoiseBuffer(6, "brown");
    airSource.loop = true;

    airFilter = ctx.createBiquadFilter();
    airFilter.type = "lowpass";
    airFilter.frequency.value = 180;

    airGain = ctx.createGain();
    airGain.gain.value = 0.22;

    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(master);

    windSource.start();
    airSource.start();

    updateGain(true);
  }

  function updateGain(snap){
    if(!ctx) return;
    if(thunderMaster) thunderMaster.gain.value = THUNDER_VOLUME * Math.min(1.5, state.volume / BASE_VOLUME);
    if(!master) return;
    var target = state.enabled && state.started ? state.volume : 0;
    target *= (0.55 + state.intensity * 0.65);
    if(snap){
      master.gain.setValueAtTime(Math.max(0.0001, target), ctx.currentTime);
    }else{
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(Math.max(0.0001, target), ctx.currentTime, 0.12);
    }
  }

  function distantThunder(){
    if(!running() || !master || !state.enabled || state.blocked || document.hidden) return;
    try{
      var now = ctx.currentTime;
      var duration = 1.8 + Math.random() * 2.8;

      var buf = makeNoiseBuffer(duration, "brown");
      var src = ctx.createBufferSource();
      src.buffer = buf;

      var low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.setValueAtTime(160 + Math.random() * 80, now);
      low.frequency.exponentialRampToValueAtTime(45, now + duration);

      var gain = ctx.createGain();
      var strength = state.volume * (0.18 + state.intensity * 0.22) * (0.7 + Math.random() * 0.5);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(strength, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      src.connect(low);
      low.connect(gain);
      gain.connect(master);
      src.start(now);
      src.stop(now + duration + 0.05);
    }catch(e){}
  }

  function scheduleThunder(){
    clearTimeout(thunderTimer);
    if(!state.started || !state.enabled){
      thunderTimer = 0;
      return;
    }
    var minMs = 18000;
    var maxMs = 42000;
    var delay = minMs + Math.random() * (maxMs - minMs);
    thunderTimer = setTimeout(function(){
      distantThunder();
      scheduleThunder();
    }, delay);
  }

  function start(){
    if(state.started) return;
    if(!state.enabled || state.blocked || !state.unlocked) return;
    if(document.getElementById("stormCanvas")){ waitForStormToEnd(); return; }   // the loading screen is still up
    var c = getContext();
    if(!c) return;
    try{
      if(c.state === "suspended") c.resume().catch(function(){});
      buildGraph();
      state.started = true;
      state.suspended = false;
      updateGain(false);
      scheduleThunder();
    }catch(e){}
  }

  function stop(){
    state.started = false;
    clearTimeout(thunderTimer);
    thunderTimer = 0;
    if(ctx && master){
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    }
  }

  var waitTimer = 0;
  function waitForStormToEnd(){
    clearTimeout(waitTimer);
    if(!state.enabled || state.blocked || state.started) return;
    if(document.getElementById("stormCanvas")){
      waitTimer = setTimeout(waitForStormToEnd, 750);
      return;
    }
    waitTimer = setTimeout(start, 800);
  }

  // ---- thunder ---------------------------------------------------------------------------------
  // a distortion curve for the gritty, electric edge of the crack
  function distortionCurve(amount){
    if(distortion[amount]) return distortion[amount];
    var n = 44100, curve = new Float32Array(n);
    for(var i = 0; i < n; i++){
      var x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return (distortion[amount] = curve);
  }
  // compressor and master level shared by every strike
  function getThunderBus(c){
    if(!thunderBus){
      thunderBus = c.createDynamicsCompressor();
      thunderBus.threshold.value = -18;
      thunderBus.knee.value = 12;
      thunderBus.ratio.value = 6;
      thunderBus.attack.value = 0.003;
      thunderBus.release.value = 0.25;
      thunderMaster = c.createGain();
      thunderBus.connect(thunderMaster);
      thunderMaster.connect(c.destination);
      updateGain(true);
    }
    return thunderBus;
  }

  function playThunder(big, far){
    var c = ctx, now = c.currentTime, bus = getThunderBus(c);

    if(!far){
      // zap: a fast falling sawtooth sweep, the spark of the strike
      var zap = c.createOscillator();
      zap.type = "sawtooth";
      zap.frequency.setValueAtTime(big ? 2600 : 1900, now);
      zap.frequency.exponentialRampToValueAtTime(140, now + 0.045);
      var zapGain = c.createGain();
      zapGain.gain.setValueAtTime(big ? 0.5 : 0.35, now);
      zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      zap.connect(zapGain);
      zapGain.connect(bus);
      zap.start(now);
      zap.stop(now + 0.06);

      // crackle: tiny random noise clicks right at the strike, before the boom
      var hits = 5 + Math.floor(Math.random() * 4);
      for(var i = 0; i < hits; i++){
        var t = now + Math.random() * 0.09, dur = 0.006 + Math.random() * 0.01;
        var buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
        var d = buf.getChannelData(0);
        for(var j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
        var src = c.createBufferSource();
        src.buffer = buf;
        var hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 2500;
        var g = c.createGain();
        g.gain.value = (big ? 0.5 : 0.35) * (0.5 + Math.random() * 0.5);
        src.connect(hp); hp.connect(g); g.connect(bus);
        src.start(t);
      }

      // main crack: a distorted band of noise, the loudest single hit
      var crackDur = 0.2;
      var crackBuf = c.createBuffer(1, Math.floor(c.sampleRate * crackDur), c.sampleRate);
      var cd = crackBuf.getChannelData(0);
      for(var k = 0; k < cd.length; k++) cd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / cd.length, 0.28);
      var crackSrc = c.createBufferSource();
      crackSrc.buffer = crackBuf;
      var crackHP = c.createBiquadFilter();
      crackHP.type = "highpass";
      crackHP.frequency.value = 700;
      var crackPeak = c.createBiquadFilter();
      crackPeak.type = "peaking";
      crackPeak.frequency.value = 2200 + Math.random() * 900;
      crackPeak.Q.value = 1.3;
      crackPeak.gain.value = 9;
      var shaper = c.createWaveShaper();
      shaper.curve = distortionCurve(big ? 32 : 18);
      shaper.oversample = "2x";
      var crackGain = c.createGain();
      crackGain.gain.setValueAtTime(big ? 1.1 : 0.8, now + 0.005);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
      crackSrc.connect(crackHP); crackHP.connect(crackPeak); crackPeak.connect(shaper);
      shaper.connect(crackGain); crackGain.connect(bus);
      crackSrc.start(now + 0.01);
    }

    // rolling low rumble (brown noise) with a slow tremolo
    var rumbleDur = (big ? 3.8 : 2.1) + Math.random() * 0.9 + (far ? 0.6 : 0);
    var rumbleBuf = c.createBuffer(1, Math.floor(c.sampleRate * rumbleDur), c.sampleRate);
    var rd = rumbleBuf.getChannelData(0), last = 0;
    for(var m = 0; m < rd.length; m++){
      last = (last + 0.018 * (Math.random() * 2 - 1)) / 1.018;
      rd[m] = last * Math.pow(1 - m / rd.length, 1.1);
    }
    var rumbleSrc = c.createBufferSource();
    rumbleSrc.buffer = rumbleBuf;
    var rumbleFilter = c.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.setValueAtTime(far ? 120 : big ? 260 : 170, now);
    rumbleFilter.frequency.exponentialRampToValueAtTime(50, now + rumbleDur);
    rumbleFilter.Q.value = 0.9;
    var tremolo = c.createOscillator();
    tremolo.type = "sine";
    tremolo.frequency.value = 3.5 + Math.random() * 2;
    var tremoloDepth = c.createGain();
    tremoloDepth.gain.value = big ? 0.35 : 0.25;
    var rumbleGain = c.createGain(), peak = far ? 0.45 : big ? 1.1 : 0.7;
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.linearRampToValueAtTime(peak, now + (far ? 0.45 : 0.2));
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDur);
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(rumbleGain.gain);
    rumbleSrc.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(bus);

    // sub-bass weight underneath
    var sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(big ? 62 : 48, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + rumbleDur * 0.85);
    var subGain = c.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(far ? 0.12 : big ? 0.4 : 0.22, now + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDur * 0.9);
    sub.connect(subGain); subGain.connect(bus);

    rumbleSrc.start(now);
    tremolo.start(now); tremolo.stop(now + rumbleDur);
    sub.start(now); sub.stop(now + rumbleDur * 0.9 + 0.05);
  }

  // One strike. Plays at once when sound is allowed; inside a click or key press that is the first
  // one on the page, it plays as soon as the browser has switched the sound on (a moment later).
  function thunder(big, far){
    if(!state.enabled || state.blocked || document.hidden) return false;
    var c = getContext();
    if(!c) return false;
    try{
      if(c.state === "running"){ playThunder(!!big, !!far); return true; }
      var ua = navigator.userActivation;
      if(ua && !ua.isActive) return false;             // no click or key press: stay silent
      var asked = Date.now();
      c.resume().then(function(){
        if(c.state === "running" && Date.now() - asked < 400) playThunder(!!big, !!far);
      }).catch(function(){});
    }catch(e){}
    return false;
  }

  // ---- rain (loading screen) -------------------------------------------------------------------
  var rainWanted = false;
  function rain(on){
    rainWanted = !!on;
    if(!on){
      if(rainGain && ctx){
        try{
          rainGain.gain.cancelScheduledValues(ctx.currentTime);
          rainGain.gain.setValueAtTime(Math.max(0.0001, rainGain.gain.value), ctx.currentTime);
          rainGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1);
        }catch(e){}
        var s = rainSource;
        setTimeout(function(){ try{ s.stop(); }catch(e){} }, 1050);
      }
      rainSource = rainGain = null;
      return;
    }
    if(rainSource || !state.enabled || state.blocked || !running()) return;
    try{
      var c = ctx, buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), data = buffer.getChannelData(0);
      for(var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      var bandpass = c.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 3000;
      bandpass.Q.value = 0.55;
      var shelf = c.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 6500;
      shelf.gain.value = -8;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.linearRampToValueAtTime(0.15, c.currentTime + 3.5);
      src.connect(bandpass); bandpass.connect(shelf); shelf.connect(g); g.connect(c.destination);
      src.start();
      rainSource = src; rainGain = g;
    }catch(e){}
  }
  unlockCallbacks.push(function(){ if(rainWanted) rain(true); });

  window.ThunderAmbient = {
    start: start,
    stop: stop,
    thunder: thunder,
    crack: function(){ return thunder(true); },
    rain: rain,
    // true when the browser lets the page play sound right now
    canPlay: function(){ getContext(); return running(); },
    // cb runs once, when sound becomes available (at once if it already is)
    onUnlock: function(cb){ if(state.unlocked) { try{ cb(); }catch(e){} } else unlockCallbacks.push(cb); },
    // true while a world or server is open: fades out and stays silent until set back to false
    setBlocked: function(v){
      v = !!v;
      if(v === state.blocked) return;
      state.blocked = v;
      if(v){ stop(); rain(false); }
      else waitForStormToEnd();
    },
    getBlocked: function(){ return state.blocked; },
    setEnabled: function(v){
      state.enabled = !!v;
      save();
      if(state.enabled) waitForStormToEnd();
      else { stop(); rain(false); }
    },
    setVolume: function(v){
      state.volume = Math.max(0, Math.min(0.6, Number(v) || 0));
      save();
      updateGain(false);
    },
    setIntensity: function(v){
      state.intensity = clamp(Number(v) || 0);
      save();
      updateGain(false);
      if(windFilter) windFilter.frequency.value = 700 + state.intensity * 700;
      if(airFilter) airFilter.frequency.value = 120 + state.intensity * 140;
    },
    getEnabled: function(){ return state.enabled; },
    getVolume: function(){ return state.volume; },
    getIntensity: function(){ return state.intensity; },
    getState: function(){ return { unlocked: state.unlocked, running: running(), started: state.started, blocked: state.blocked, enabled: state.enabled }; }
  };

  // the first click, tap or key press lets the page play sound
  function onInput(){
    var c = getContext();
    if(!c) return;
    if(c.state === "running") unlocked();
    else c.resume().then(function(){ if(c.state === "running") unlocked(); }).catch(function(){});
  }
  ["pointerdown","keydown","touchstart"].forEach(function(evt){
    window.addEventListener(evt, onInput, {passive:true, capture:true});
  });

  document.addEventListener("visibilitychange", function(){
    if(!ctx) return;
    if(document.hidden){
      if(ctx.state === "running"){
        ctx.suspend().catch(function(){});
        state.suspended = true;
      }
    }else if(state.suspended){
      ctx.resume().catch(function(){});
      state.suspended = false;
    }
  });

  // browsers that already allow sound (the page was opened with a click, or sound is allowed for
  // this site) are running from the start
  var c0 = getContext();
  if(c0 && c0.state === "running") unlocked();
})();
