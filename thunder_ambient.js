/* Thunder Client Ambient Audio
   Procedural ambient layer: wind + low air + occasional distant thunder.
   No external audio assets required. Controls are exposed on window.ThunderAmbient
   for the in-game module menu to use later.
*/
(function(){
  "use strict";

  var state = {
    enabled: true,
    volume: 0.16,
    intensity: 0.55,
    started: false,
    suspended: false
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
    if(!state.enabled) return;

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
    if(!state.enabled) return;
    if(document.getElementById("stormCanvas")){
      setTimeout(waitForStormToEnd, 750);
      return;
    }
    setTimeout(start, 800);
  }

  window.ThunderAmbient = {
    start: start,
    stop: stop,
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