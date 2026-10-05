  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     World Backup (Right Shift > Utility). Included into the client scope of thunder-client.js by
     build.js.
     Browser worlds live in this browser's storage, and they are gone when its data is cleared
     (which school Chromebooks often do). Save backup puts every singleplayer world and the
     settings in one file; Load backup puts them back, here or on another computer.
       - The file (.thunderbackup) is gzip of: "THUNDERBKP1\n", a u32 length and a JSON header
         (when it was made, which worlds, the settings), then each world file as [u32 path
         length][path][u32 data length][data], and a u32 0xFFFFFFFF at the end.
       - The settings in it: the game's options, profile (name and skin) and server list, and
         Thunder's own settings, HUD layout and waypoints. Never the game's server cookies (server
         logins), the Thunder Friends sign-in key or chats, the worlds' sharing-code keys, or what
         belongs to one computer (Always open, relays and TURN, shader auto quality, built-in packs),
         so a backup can be given to a friend.
       - Load backup never overwrites a world: one whose folder name is already used here comes
         back as "Name (2)". The settings replace the current ones, except that waypoints are added
         to the ones here and the server list is only put back when this browser has none. Then
         the page reloads so the game reads everything again. Only from the menus.
       - A file that is not a Thunder backup, is cut off, or names a file outside the worlds
         folder is refused before anything is written.
     World rescue: the game saves level.dat by writing level.dat_new, renaming level.dat to
     level.dat_old and then level.dat_new to level.dat. A tab closed between the last two steps
     left a world without level.dat, and the Singleplayer screen then silently refused to open it.
     When the game reaches its menus, and whenever the Singleplayer screen opens, a world missing
     level.dat gets it back from level.dat_new (complete: it is written before the renames) or else
     level.dat_old. Never while a world is running.
  ------------------------------------------------------------------------------------------- */
  var BK_DB='_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_12_2_',BK_STORE='filesystem';
  var BK_WORLDS='eaglercraft/worlds/',BK_LIST='worlds_list.txt',BK_MAGIC='THUNDERBKP1\n',BK_AT='thunderBackupAt';
  var BK_GAME=/^_eaglercraft_1\.12\.[gps]$/,BK_SERVERS='_eaglercraft_1.12.s';
  var BK_SKIP=/^thunder(?:Social_v1|SocialChats_v1|Offline|BuiltinPacks|Pack121On|BackupAt|WorldCodes_v1|AlwaysOpen_v1|LanIce|LanRelays|LanSiteRelay|ShaderAuto_v1|ClientSettings_v3|Sync_v1)/;
  function bkKeyOk(k){return typeof k==='string'&&(BK_GAME.test(k)||(/^thunder/.test(k)&&!BK_SKIP.test(k)));}
  var BK={busy:false,state:'',msg:'',pending:null,rescued:[],rescueAt:-1e9,want:false,boot:false,lastScr:null,done:false};

  function bkOpen(){
    return new Promise(function(ok,no){
      var req,fresh=false;
      try{req=W.indexedDB.open(BK_DB);}catch(e){no(e);return;}
      req.onupgradeneeded=function(){fresh=true;try{req.transaction.abort();}catch(_){}};    // the game has not made it yet
      req.onerror=function(ev){if(ev&&ev.preventDefault)ev.preventDefault();no(fresh?new Error('there are no worlds in this browser yet'):req.error);};
      req.onblocked=function(){no(new Error('the game storage is busy, try again'));};
      req.onsuccess=function(){
        var db=req.result;
        if(!db.objectStoreNames.contains(BK_STORE)){db.close();no(new Error('there are no worlds in this browser yet'));return;}
        db.onversionchange=function(){db.close();};
        ok(db);
      };
    });
  }
  function bkReq(r){return new Promise(function(ok,no){r.onsuccess=function(){ok(r.result);};r.onerror=function(){no(r.error);};});}
  function bkGet(db,path){return bkReq(db.transaction(BK_STORE,'readonly').objectStore(BK_STORE).get([path])).then(function(r){return r||null;});}
  function bkRange(f){return W.IDBKeyRange.bound([BK_WORLDS+f+'/'],[BK_WORLDS+f+'/\uffff']);}
  var bkTE=new W.TextEncoder(),bkTD=new W.TextDecoder('utf-8');
  function bkLines(data){return bkTD.decode(data).split('\n').map(function(s){return s.replace(/\r$/,'');}).filter(function(s){return s.length>0;});}
  // the worlds the game lists (worlds_list.txt: one folder name per line)
  function bkFolders(db){return bkGet(db,BK_LIST).then(function(r){return r&&r.data?bkLines(r.data):[];});}
  function bkFolderOk(f){return typeof f==='string'&&f.length>0&&f.length<=200&&f!=='.'&&f!=='..'&&!/[\/\\\u0000-\u001f]/.test(f);}
  // HFB > 0: the integrated server has a world loaded or is busy with one
  function bkWorldRunning(){return !!(HEN&&HEN.X)||HFB>0||!!LJ.active;}
  function bkGz(d){var b=d&&d.data&&new Uint8Array(d.data);return !!(b&&b.length>18&&b[0]===0x1f&&b[1]===0x8b);}

  // ---- World rescue ----
  function bkRescue(){
    if(bkWorldRunning()||BK.busy||now()-BK.rescueAt<5000)return Promise.resolve([]);
    BK.rescueAt=now();
    return bkOpen().then(function(db){
      return bkFolders(db).then(function(folders){
        var fixed=[];
        return folders.reduce(function(p,f){
          return p.then(function(){
            var base=BK_WORLDS+f+'/';
            return bkGet(db,base+'level.dat').then(function(cur){
              if(cur)return null;
              return Promise.all([bkGet(db,base+'level.dat_new'),bkGet(db,base+'level.dat_old')]).then(function(r){
                var src=bkGz(r[0])?r[0]:bkGz(r[1])?r[1]:null;
                if(!src||bkWorldRunning())return null;
                var tx=db.transaction(BK_STORE,'readwrite');
                tx.objectStore(BK_STORE).put({path:base+'level.dat',data:src.data});
                return new Promise(function(ok){tx.oncomplete=function(){fixed.push(f);ok();};tx.onerror=tx.onabort=function(){ok();};});
              });
            });
          });
        },Promise.resolve()).then(function(){db.close();return fixed;},function(e){db.close();throw e;});
      });
    }).then(function(fixed){
      if(fixed.length){
        BK.rescued=BK.rescued.concat(fixed);
        if(W.console&&W.console.log)W.console.log('[Thunder] World Backup: repaired '+fixed.join(', '));
        soToast({kind:'info',title:'World repaired',text:(fixed.length===1?'"'+fixed[0]+'"':fixed.length+' worlds')+' had a save that was cut off (the tab closed while saving). Thunder put it back, so it opens again.'});
        if(menuOpen)runLive();
      }
      return fixed;
    },function(){return [];});
  }
  // once the game is at its menus, and whenever the Singleplayer screen opens (when the
  // integrated server is not busy, which it is for a moment while the screen lists the worlds)
  frameTasks.push(function(){
    var scr=HEN&&HEN.cm;
    if(!BK.boot&&scr&&BOOT.frames>=3){BK.boot=true;BK.want=true;}
    if(scr!==BK.lastScr){BK.lastScr=scr;if(scr instanceof A_3)BK.want=true;}
    if(BK.want&&scr&&!bkWorldRunning()&&!BK.busy){BK.want=false;bkRescue();}
  });

  // ---- Save backup ----
  function bkU32(n){var b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b;}
  function bkSettings(){
    var o={},i,k;
    try{for(i=0;i<W.localStorage.length;i++){k=W.localStorage.key(i);if(bkKeyOk(k))o[k]=W.localStorage.getItem(k);}}catch(_){}
    return o;
  }
  // state: '' (nothing to say), busy, saved, loaded (a backup is ready to restore), restored, error
  function bkSay(state,msg){BK.state=state;BK.msg=msg||'';if(menuOpen)runLive();}
  function bkSave(){
    if(BK.busy)return;
    BK.busy=true;BK.pending=null;BK.done=false;bkSay('busy','reading your worlds\u2026');
    var parts=[],worlds=[],files=0;
    bkOpen()['catch'](function(e){if(/no worlds/.test(String(e&&e.message)))return null;throw e;}).then(function(db){
      if(!db)return null;
      return bkFolders(db).then(function(folders){
        return folders.reduce(function(p,f){
          return p.then(function(){
            var w={folder:f,files:0,bytes:0};
            if(!bkFolderOk(f))return null;
            return new Promise(function(ok,no){
              var cur=db.transaction(BK_STORE,'readonly').objectStore(BK_STORE).openCursor(bkRange(f));
              cur.onsuccess=function(){
                var c=cur.result;
                if(!c){ok();return;}
                var v=c.value,d=v&&v.data;
                if(v&&typeof v.path==='string'&&d&&d.byteLength!=null){
                  var pb=bkTE.encode(v.path);
                  parts.push(bkU32(pb.length),pb,bkU32(d.byteLength),new Uint8Array(d));
                  w.files++;w.bytes+=d.byteLength;
                  if((++files&255)===0)bkSay('busy','reading your worlds\u2026 '+files+' files');
                }
                c['continue']();
              };
              cur.onerror=function(){no(cur.error);};
            }).then(function(){if(w.files)worlds.push(w);});
          });
        },Promise.resolve()).then(function(){db.close();},function(e){db.close();throw e;});
      });
    }).then(function(){
      var head={format:1,made:new Date().toISOString(),client:'Thunder Client',game:'Eaglercraft 1.12.2',worlds:worlds,settings:bkSettings()};
      var hb=bkTE.encode(JSON.stringify(head));
      var all=[bkTE.encode(BK_MAGIC),bkU32(hb.length),hb].concat(parts,[bkU32(0xFFFFFFFF)]);
      parts=null;
      bkSay('busy','packing '+files+' files\u2026');
      var blob=new W.Blob(all,{type:'application/octet-stream'});
      if(typeof W.CompressionStream!=='function')return blob;
      return new W.Response(blob.stream().pipeThrough(new W.CompressionStream('gzip'))).blob();
    }).then(function(out){
      var d=new Date(),name='thunder-backup-'+d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)+'.thunderbackup';
      var url=W.URL.createObjectURL(out),a=D.createElement('a');
      a.href=url;a.download=name;a.style.display='none';D.body.appendChild(a);a.click();
      W.setTimeout(function(){try{W.URL.revokeObjectURL(url);if(a.parentNode)a.parentNode.removeChild(a);}catch(_){}},60000);
      try{W.localStorage.setItem(BK_AT,String(Date.now()));}catch(_){}
      BK.busy=false;
      bkSay('saved',name+' ('+bkSize(out.size)+'): '+(worlds.length===1?'1 world':worlds.length+' worlds')+' and your settings. Keep it somewhere safe, like Google Drive or a USB stick.');
    })['catch'](function(e){BK.busy=false;bkSay('error','could not save the backup: '+String(e&&e.message||e));});
  }
  function bkSize(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':n+' bytes';}

  // ---- Load backup: read and check the whole file, show what is in it, then put it back ----
  function bkRead(file){
    if(BK.busy||!file)return;
    BK.busy=true;BK.pending=null;BK.done=false;bkSay('busy','reading '+file.name+'\u2026');
    file.arrayBuffer().then(function(buf){
      var b=new Uint8Array(buf);
      if(b.length>1&&b[0]===0x1f&&b[1]===0x8b){
        if(typeof W.DecompressionStream!=='function')throw new Error('this browser cannot unpack backups; use a recent Chrome, Edge, Firefox or Safari');
        return new W.Response(new W.Blob([buf]).stream().pipeThrough(new W.DecompressionStream('gzip'))).arrayBuffer();
      }
      return buf;
    }).then(function(buf){
      var b=new Uint8Array(buf),dv=new DataView(buf),p=BK_MAGIC.length,bad='the backup has a file it should not have';
      if(b.length<p+4||bkTD.decode(b.subarray(0,p))!==BK_MAGIC)throw new Error('this is not a Thunder backup');
      var hl=dv.getUint32(p,true);p+=4;
      if(p+hl>b.length)throw new Error('the backup file is cut off');
      var head=JSON.parse(bkTD.decode(b.subarray(p,p+hl)));p+=hl;
      if(!head||typeof head!=='object')throw new Error('this is not a Thunder backup');
      if(head.format!==1)throw new Error('this backup is from a newer Thunder; update Thunder first');
      var known={},folders=[],recs=[];
      (Array.isArray(head.worlds)?head.worlds:[]).forEach(function(w){
        if(!w||!bkFolderOk(w.folder)||known[w.folder])throw new Error(bad);
        known[w.folder]=1;
      });
      for(;;){
        if(p+4>b.length)throw new Error('the backup file is cut off');
        var pl=dv.getUint32(p,true);p+=4;
        if(pl===0xFFFFFFFF)break;
        if(p+pl+4>b.length)throw new Error('the backup file is cut off');
        var path=bkTD.decode(b.subarray(p,p+pl));p+=pl;
        var dl=dv.getUint32(p,true);p+=4;
        if(p+dl>b.length)throw new Error('the backup file is cut off');
        if(path.indexOf(BK_WORLDS)!==0)throw new Error(bad);
        var segs=path.slice(BK_WORLDS.length).split('/'),f=segs[0];
        if(segs.length<2||!known[f]||segs.some(function(s){return s===''||s==='.'||s==='..';}))throw new Error(bad);
        if(known[f]===1){known[f]=2;folders.push(f);}
        recs.push({folder:f,rest:segs.slice(1).join('/'),data:buf.slice(p,p+dl)});p+=dl;
      }
      BK.busy=false;
      BK.pending={name:file.name,head:head,recs:recs,folders:folders};
      bkSay('loaded','this backup ('+String(head.made||'').slice(0,10)+') has '+(folders.length?(folders.length===1?'1 world: ':folders.length+' worlds: ')+folders.join(', '):'no worlds')+', and the settings. Restore adds them (the worlds you have now stay) and reloads the page.');
    })['catch'](function(e){BK.busy=false;bkSay('error','could not read the backup: '+String(e&&e.message||e));});
  }
  // a folder name nobody uses here: not in the game's list, and no file under it. "World" comes
  // back as "World (2)", and "World (2)" as "World (3)"
  function bkFreeName(db,f,taken){
    var m=/^(.+) \((\d{1,4})\)$/.exec(f),base=m?m[1]:f,k=m?Number(m[2])+1:2,to=f;
    function bump(){to=base+' ('+(k++)+')';return next();}
    function next(){
      if(taken[to.toLowerCase()])return bump();
      return bkReq(db.transaction(BK_STORE,'readonly').objectStore(BK_STORE).count(bkRange(to))).then(function(c){return c?bump():to;});
    }
    return next();
  }
  // waypoints in a backup are added to the ones here (the same one is not added twice)
  function bkMergeWaypoints(json){
    var mine={},theirs=null;
    try{theirs=JSON.parse(json);}catch(_){}
    if(!theirs||typeof theirs!=='object'||Array.isArray(theirs))return;
    try{mine=JSON.parse(W.localStorage.getItem(WPT_STORE)||'{}')||{};}catch(_){mine={};}
    if(typeof mine!=='object'||Array.isArray(mine))mine={};
    Object.keys(theirs).forEach(function(k){
      var add=theirs[k];
      if(!Array.isArray(add))return;
      var have=Array.isArray(mine[k])?mine[k]:(mine[k]=[]);
      var death=have.some(function(w){return w&&w.death;});
      add.forEach(function(w){
        if(!w||typeof w!=='object'||have.length>=200||(w.death&&death))return;
        if(have.some(function(h){return h&&h.n===w.n&&h.x===w.x&&h.y===w.y&&h.z===w.z;}))return;
        have.push(w);
      });
    });
    W.localStorage.setItem(WPT_STORE,JSON.stringify(mine));
    WPT.all=null;
  }
  function bkPutSettings(set){
    if(!set||typeof set!=='object')return;
    Object.keys(set).forEach(function(k){
      var v=set[k];
      if(!bkKeyOk(k)||typeof v!=='string')return;
      try{
        if(k===WPT_STORE)bkMergeWaypoints(v);
        else if(k===BK_SERVERS){if(W.localStorage.getItem(k)===null)W.localStorage.setItem(k,v);}
        else W.localStorage.setItem(k,v);
      }catch(_){}
    });
  }
  function bkRestore(){
    var pk=BK.pending;
    if(!pk||BK.busy)return;
    if(bkWorldRunning()){bkSay('error','leave your world first (Esc \u2192 Save and Quit, or Disconnect), then press Restore.');return;}
    BK.busy=true;bkSay('busy','restoring\u2026');
    var map={},added=[],renamed=[];
    bkOpen().then(function(db){
      function fail(e){db.close();throw e;}
      return bkFolders(db).then(function(have){
        var taken={};
        have.forEach(function(f){taken[f.toLowerCase()]=1;});
        return pk.folders.reduce(function(p,f){
          return p.then(function(){
            return bkFreeName(db,f,taken).then(function(to){
              taken[to.toLowerCase()]=1;map[f]=to;added.push(to);
              if(to!==f)renamed.push(f+' \u2192 '+to);
            });
          });
        },Promise.resolve());
      }).then(function(){
        // the files, a few hundred at a time
        var i=0,recs=pk.recs;
        function batch(){
          if(i>=recs.length)return Promise.resolve();
          if(bkWorldRunning())return Promise.reject(new Error('a world was opened, so Restore stopped; leave it and press Restore again'));
          var tx=db.transaction(BK_STORE,'readwrite'),st=tx.objectStore(BK_STORE),end=Math.min(recs.length,i+400);
          for(;i<end;i++)st.put({path:BK_WORLDS+map[recs[i].folder]+'/'+recs[i].rest,data:recs[i].data});
          bkSay('busy','restoring\u2026 '+i+' of '+recs.length+' files');
          return new Promise(function(ok,no){
            tx.oncomplete=function(){ok();};
            tx.onerror=tx.onabort=function(){no(tx.error||new Error('the browser refused to save (is its storage full?)'));};
          }).then(batch);
        }
        return batch();
      }).then(function(){
        // the game's list of worlds: read and written in one go, so a world made meanwhile stays
        return new Promise(function(ok,no){
          var tx=db.transaction(BK_STORE,'readwrite'),st=tx.objectStore(BK_STORE),g=st.get([BK_LIST]);
          g.onsuccess=function(){
            var r=g.result,list=r&&r.data?bkLines(r.data):[];
            added.forEach(function(f){if(list.indexOf(f)<0)list.push(f);});
            st.put({path:BK_LIST,data:bkTE.encode(list.join('\n')).buffer});
          };
          tx.oncomplete=function(){db.close();ok();};
          tx.onerror=tx.onabort=function(){no(tx.error||new Error('the browser refused to save'));};
        });
      })['catch'](function(e){
        // what was written for the new folders is taken away again (nobody else uses them)
        return new Promise(function(ok){
          try{
            var tx=db.transaction(BK_STORE,'readwrite'),st=tx.objectStore(BK_STORE);
            added.forEach(function(f){st['delete'](bkRange(f));});
            tx.oncomplete=tx.onerror=tx.onabort=function(){ok();};
          }catch(_){ok();}
        }).then(function(){fail(e);});
      });
    }).then(function(){
      bkPutSettings(pk.head.settings);
      BK.pending=null;BK.busy=false;BK.done=true;
      bkSay('restored',(added.length===1?'1 world':added.length+' worlds')+(added.length?' ('+added.join(', ')+')':'')+' and your settings'+
        (renamed.length?'; worlds with a name already used here came back as copies: '+renamed.join(', '):'')+'. Reloading\u2026');
      W.setTimeout(function(){W.location.reload();},2500);
    })['catch'](function(e){BK.busy=false;bkSay('error','could not restore: '+String(e&&e.message||e));});
  }

  SPECIALS.backup=function(box){
    var act=el('div','tcm-actions'),pick=D.createElement('input');
    pick.type='file';pick.style.display='none';   // no accept filter: some Chromebooks grey out unknown file types
    pick.addEventListener('change',function(){var f=pick.files&&pick.files[0];pick.value='';if(f)bkRead(f);});
    var save=lanBtn('Save backup',function(){bkSave();}),load=lanBtn('Load backup',function(){pick.click();});
    var go=lanBtn('Restore',function(){bkRestore();}),no=lanBtn('Cancel',function(){BK.pending=null;bkSay('','');}),rl=lanBtn('Reload now',function(){W.location.reload();});
    lanStatusRow(box,function(){
      var at=0;try{at=Number(W.localStorage.getItem(BK_AT))||0;}catch(_){}
      switch(BK.state){
        case 'busy':return ['tcm-warn','Working',BK.msg];
        case 'saved':return ['tcm-ok','Saved',BK.msg];
        case 'loaded':return ['tcm-ok','Ready to restore',BK.msg];
        case 'restored':return ['tcm-ok','Restored',BK.msg];
        case 'error':return ['tcm-bad','Did not work',BK.msg];
      }
      return [at?'tcm-ok':'',at?'Last backup':'No backup yet',(at?new Date(at).toLocaleString():'none made in this browser')+
        (BK.rescued.length?'; repaired when the game started: '+BK.rescued.join(', '):'')];
    });
    act.appendChild(save);act.appendChild(load);act.appendChild(go);act.appendChild(no);act.appendChild(rl);
    box.appendChild(act);box.appendChild(pick);
    addLive(function(){
      save.disabled=load.disabled=BK.busy||BK.done;
      go.style.display=no.style.display=BK.pending&&!BK.busy?'':'none';
      rl.style.display=BK.done?'':'none';
    });
  };
  TC.backup={state:function(){return {busy:BK.busy,state:BK.state,msg:BK.msg,done:BK.done,rescued:BK.rescued.slice(),
      pending:BK.pending?{folders:BK.pending.folders.slice(),files:BK.pending.recs.length}:null};},
    save:bkSave,read:bkRead,restore:bkRestore,rescue:bkRescue};
  MODULES.push({cat:'utility',id:null,special:'backup',name:'World Backup',wide:true,
    desc:'Save backup puts all your singleplayer worlds and your settings in one file; Load backup brings them back, here or on another computer. Worlds in a browser are lost when its data is cleared, so keep a backup. Your Thunder Friends login, chats and server logins are never in it.'});
