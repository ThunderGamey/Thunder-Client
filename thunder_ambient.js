/* Thunder Client Ambient Audio
   Procedural ambient layer for the menus: wind + low air + occasional distant thunder, and a
   close thunder crack when you click the storm on the title screen (ThunderAmbient.crack).
   No external audio assets required. Controls are exposed on window.ThunderAmbient; Thunder
   Client blocks it (setBlocked) while a world or server is open, so it never plays in game.
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
  var startedAt = 0;
  var thunderTimer = 0;

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
    return ctx;
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

    startedAt = performance.now();
    updateGain(true);
  }

  function updateGain(snap){
    if(!ctx || !master) return;
    var target = state.enabled ? state.volume : 0;
    target *= (0.55 + state.intensity * 0.65);
    if(snap){
      master.gain.setValueAtTime(Math.max(0.0001, target), ctx.currentTime);
    }else{
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(Math.max(0.0001, target), ctx.currentTime, 0.12);
    }
  }

  function distantThunder(){
    if(!ctx || !master || !state.enabled || document.hidden) return;
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
    if(!state.enabled || state.blocked) return;

    var c = getContext();
    if(!c) return;

    try{
      if(c.state === "suspended"){
        c.resume().catch(function(){});
      }
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

  function waitForStormToEnd(){
    if(!state.enabled || state.blocked) return;
    if(document.getElementById("stormCanvas")){
      setTimeout(waitForStormToEnd, 750);
      return;
    }
    setTimeout(start, 800);
  }

  // A close strike: a sharp crack, then a rolling rumble. Plays straight to the speakers (not
  // through the ambient layer), so it works on the first click too.
  function crack(){
    if(!state.enabled || state.blocked || document.hidden) return;
    var c = getContext();
    if(!c) return;
    try{
      if(c.state === "suspended") c.resume().catch(function(){});
      var now = c.currentTime, loud = Math.min(0.6, state.volume * 3);
      var hit = c.createBufferSource(), hitBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.35), c.sampleRate);
      var hd = hitBuf.getChannelData(0);
      for(var i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hd.length, 3);
      hit.buffer = hitBuf;
      var hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      var hg = c.createGain(); hg.gain.setValueAtTime(loud, now); hg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      hit.connect(hp); hp.connect(hg); hg.connect(c.destination);
      hit.start(now); hit.stop(now + 0.4);
      var dur = 2.2 + Math.random() * 1.5;
      var rum = c.createBufferSource(), rumBuf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      var rd = rumBuf.getChannelData(0), last = 0;
      for(var j = 0; j < rd.length; j++){ last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; rd[j] = last * 3.5; }
      rum.buffer = rumBuf;
      var lp = c.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(420, now); lp.frequency.exponentialRampToValueAtTime(60, now + dur);
      var rg = c.createGain(); rg.gain.setValueAtTime(0.0001, now);
      rg.gain.linearRampToValueAtTime(loud * 0.9, now + 0.08); rg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      rum.connect(lp); lp.connect(rg); rg.connect(c.destination);
      rum.start(now); rum.stop(now + dur + 0.05);
    }catch(e){}
  }

  window.ThunderAmbient = {
    start: start,
    stop: stop,
    crack: crack,
    // true while a world or server is open: fades out and stays silent until set back to false
    setBlocked: function(v){
      v = !!v;
      if(v === state.blocked) return;
      state.blocked = v;
      if(v) stop();
      else if(state.unlocked) start();
    },
    getBlocked: function(){ return state.blocked; },
    setEnabled: function(v){
      state.enabled = !!v;
      save();
      if(state.enabled){
        start();
      }else{
        stop();
      }
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
    getIntensity: function(){ return state.intensity; }
  };

  function unlock(){
    state.unlocked = true;
    var c = getContext();
    if(c && c.state === "suspended") c.resume().catch(function(){});
    waitForStormToEnd();
  }

  ["pointerdown","keydown","touchstart"].forEach(function(evt){
    window.addEventListener(evt, unlock, {passive:true});
  });

  document.addEventListener("visibilitychange", function(){
    if(!ctx) return;
    if(document.hidden){
      if(ctx.state === "running"){
        ctx.suspend().catch(function(){});
        state.suspended = true;
      }
    }else if(state.started && state.suspended){
      ctx.resume().catch(function(){});
      state.suspended = false;
    }
  });

  waitForStormToEnd();
})();