/* Thunder Client offline file: the loader (put in the page by thunder/offline.js; see there).
   Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey). */
(function(){
  "use strict";
  var W=window,D=document;
  var EMB=__EMB__;               // the copy in this file: {seq, classes, packs, built}
  var SOURCES=__SOURCES__;       // where updates come from, in order
  var FILES=__FILES__;           // the files served from this page: [{path, type}]
  var DBN='thunderOffline',ST='files',LS='thunderOffline_v1';
  var urls={},waiting=[],started=false,base=String(W.location.href).replace(/[?#].*$/,'').replace(/[^\/]*$/,'');
  var T=W.__thunderOffline={file:EMB,running:'',update:null,checked:'',error:''};

  // ---- the files inside the page (base64 blocks at its end)
  function bytesOf(id){
    var e=D.getElementById('tc-file-'+id);
    if(!e)return null;
    var bin=W.atob((e.textContent||'').replace(/\s+/g,'')),n=bin.length,a=new Uint8Array(n),i;
    for(i=0;i<n;i++)a[i]=bin.charCodeAt(i);
    e.parentNode.removeChild(e);
    return a;
  }
  function blobUrl(b,type){return W.URL.createObjectURL(new W.Blob([b],{type:type||'application/octet-stream'}));}
  // what the game and Thunder ask for next to the page (assets.epk, lang/..., packs/...) comes from
  // here: a page opened from a folder cannot read the files next to it
  function map(u){
    try{
      var s=typeof u==='string'?u:(u&&u.url)||String(u);
      if(/^(blob|data):/i.test(s))return null;
      var a=new W.URL(s,W.location.href).href.replace(/[?#].*$/,'');
      return a.indexOf(base)===0&&urls[a.slice(base.length)]||null;
    }catch(e){return null;}
  }
  if(W.fetch){var f0=W.fetch;W.fetch=function(u){var m=map(u);return m?f0.call(W,m):f0.apply(W,arguments);};}
  if(W.XMLHttpRequest){
    var X=W.XMLHttpRequest.prototype,o0=X.open;
    X.open=function(meth,u){var m=map(u);if(m){var a=[].slice.call(arguments);a[1]=m;return o0.apply(this,a);}return o0.apply(this,arguments);};
  }

  // ---- updates kept in this browser
  function db(){
    return new Promise(function(ok,no){
      try{
        var r=W.indexedDB.open(DBN,1);
        r.onupgradeneeded=function(){r.result.createObjectStore(ST);};
        r.onsuccess=function(){ok(r.result);};r.onerror=function(){no(r.error);};
      }catch(e){no(e);}
    });
  }
  function get(d,k){return new Promise(function(ok){try{var q=d.transaction(ST).objectStore(ST).get(k);q.onsuccess=function(){ok(q.result||null);};q.onerror=function(){ok(null);};}catch(e){ok(null);}});}
  function put(d,k,v){return new Promise(function(ok){try{var t=d.transaction(ST,'readwrite');t.objectStore(ST).put(v,k);t.oncomplete=function(){ok(true);};t.onerror=t.onabort=function(){ok(false);};}catch(e){ok(false);}});}
  function state(){try{return JSON.parse(W.localStorage.getItem(LS)||'{}')||{};}catch(e){return {};}}
  function save(o){try{W.localStorage.setItem(LS,JSON.stringify(o));}catch(e){}}

  // ---- start the game: an update downloaded before when there is one (and it started fine), else
  // the copy in this file. The game code runs as an inline script, and eaglercraftXClientScriptElement
  // tells the game where it is: it starts its singleplayer worker from that text.
  function inject(text){
    var s=D.createElement('script');s.type='text/javascript';s.text=text;
    W.eaglercraftXClientScriptElement=s;      // (the game reads its own code from here for the worker)
    (D.body||D.documentElement).appendChild(s);
    return typeof W.main==='function';
  }
  function boot(d,upd){
    var st=state(),use=null,i;
    if(upd&&upd.seq>EMB.seq&&upd.code&&st.bad!==upd.classes){
      // (an update that did not get the game to its first menu twice is skipped from then on)
      if(st.trying!==upd.classes){st.trying=upd.classes;st.tries=0;}
      if((st.tries|0)>=2){st.bad=upd.classes;save(st);}
      else{st.tries=(st.tries|0)+1;save(st);use=upd;}
    }
    // (an update's packs replace the ones in the file while it runs)
    var mine={},p;
    if(use&&use.files)for(p in use.files)if(use.files[p]){mine[p]=urls[p];urls[p]=blobUrl(use.files[p],/\.json$/.test(p)?'application/json':'application/zip');}
    var ok=false;
    if(use){T.running=use.classes;ok=inject(use.code);if(!ok){st.bad=use.classes;save(st);T.error='the update '+use.classes+' did not load';}}
    if(!ok){
      for(p in mine)urls[p]=mine[p];
      T.running=EMB.classes;
      inject(new W.TextDecoder('utf-8').decode(bytesOf('classes.js')));
      use=null;
    }
    started=true;
    var q=waiting;waiting=[];
    for(i=0;i<q.length;i++)q[i]();
    watch(use);
    // (compared with what runs: an update skipped as bad does not count)
    if(d)W.setTimeout(function(){check(d,use);},30000);
  }
  W.__thunderReady=function(fn){if(started)fn();else waiting.push(fn);};

  // the game reached its first menu: an update that did is kept
  function watch(use){
    var n=0,t=W.setInterval(function(){
      var up=false;
      try{up=!!(W.ThunderClient&&W.ThunderClient.boot&&W.ThunderClient.boot().menu);}catch(e){}
      if(!up&&++n<300)return;
      W.clearInterval(t);
      if(up&&use){var st=state();st.tries=0;st.ok=use.classes;save(st);}
    },2000);
  }

  // ---- updates: thunder-version.json on GitHub; a higher number means a newer Thunder, whose
  // classes.js is checked against its size and SHA-256 before it is kept
  function hex(b){var a=new Uint8Array(b),s='',i;for(i=0;i<a.length;i++)s+=('0'+a[i].toString(16)).slice(-2);return s;}
  function fetchOk(u,how){return W.fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error(u+': '+r.status);return how==='json'?r.json():r.arrayBuffer();});}
  function check(d,upd){
    var cs=W.crypto&&W.crypto.subtle,i=0,have=Math.max(EMB.seq,upd&&upd.seq||0);
    if(!cs||!W.fetch)return;
    (function next(){
      if(i>=SOURCES.length)return;
      var src=SOURCES[i++],v=null,code=null;
      fetchOk(src+'thunder-version.json?t='+Date.now(),'json').then(function(o){
        v=o;T.checked=src;
        if(!v||!(v.seq>have)||state().bad===v.classes||!/^t6-[0-9a-f]{10}$/.test(v.classes||''))throw 'none';
        return fetchOk(src+'classes.js?v='+v.classes);
      }).then(function(buf){
        if(buf.byteLength!==v.size)throw new Error('classes.js is '+buf.byteLength+' bytes, not '+v.size);
        code=buf;
        return cs.digest('SHA-256',buf);
      }).then(function(h){
        if(hex(h)!==v.sha256)throw new Error('classes.js does not match its SHA-256');
        if(v.packs===EMB.packs)return null;
        // the built-in packs changed too
        return fetchOk(src+'packs/packs.json?v='+v.packs,'json').then(function(list){
          if(!list||!list.packs||!list.packs.length)throw new Error('packs.json lists no packs');
          var json=new W.TextEncoder().encode(JSON.stringify(list)),out={'packs/packs.json':json.buffer};
          return Promise.all((list.packs||[]).map(function(p){
            if(!/^[A-Za-z0-9._-]+\.zip$/.test(p.file||''))throw new Error('bad pack name');
            return fetchOk(src+'packs/'+p.file+'?v='+p.version).then(function(b){out['packs/'+p.file]=b;});
          })).then(function(){return out;});
        });
      }).then(function(files){
        var rec={seq:v.seq,classes:v.classes,packs:v.packs,code:new W.TextDecoder('utf-8').decode(code),files:files,at:Date.now(),from:src};
        return put(d,'update',rec).then(function(ok){if(ok){T.update=v.classes;tell(v);}});
      }).catch(function(e){
        if(e!=='none'){T.error=String(e&&e.message||e);next();}
      });
    })();
  }
  // a small note at the bottom: the update starts next time (or now)
  function tell(v){
    var b=D.createElement('div');
    b.setAttribute('style','position:fixed;left:10px;bottom:10px;z-index:2147483646;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;'+
      'border-radius:999px;background:rgba(8,14,22,.92);border:1px solid rgba(79,209,255,.5);color:#e8f6ff;font:12px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4)');
    var t=D.createElement('span');t.textContent='Thunder Client update '+v.seq+' is ready: it starts the next time you open this file.';
    var r=D.createElement('button');r.textContent='Restart now';
    r.setAttribute('style','border:1px solid rgba(79,209,255,.6);background:rgba(47,169,255,.35);color:#fff;border-radius:999px;padding:3px 10px;font:600 11px system-ui,sans-serif;cursor:pointer');
    r.onclick=function(){W.location.reload();};
    var x=D.createElement('button');x.textContent='Later';
    x.setAttribute('style','border:0;background:none;color:#9fc3d8;font:600 11px system-ui,sans-serif;cursor:pointer');
    x.onclick=function(){b.parentNode&&b.parentNode.removeChild(b);};
    b.appendChild(t);b.appendChild(r);b.appendChild(x);
    (D.body||D.documentElement).appendChild(b);
  }

  // ---- when the page has been read: unpack the files, then start
  function ready(){
    for(var i=0;i<FILES.length;i++){var b=bytesOf(FILES[i].path);if(b)urls[FILES[i].path]=blobUrl(b,FILES[i].type);}
    W.__thunderAssets=urls['assets.epk'];
    db().then(function(d){return get(d,'update').then(function(u){boot(d,u);});},function(){boot(null,null);})
      .catch(function(e){T.error=String(e&&e.message||e);if(!started)boot(null,null);});
  }
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',ready);else ready();
})();
