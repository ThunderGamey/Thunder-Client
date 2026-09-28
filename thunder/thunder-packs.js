  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Built-in resource packs: Thunder 1.21.11 and Thunder PvP (built by thunder/packs/build_packs.py,
     served next to the page in packs/). On the first start they are added to the game's resource
     pack list exactly like Options > Resource Packs > "Open resource pack folder" would add them
     (files under resourcepacks/<folder>/ in the game's IndexedDB filesystem, plus an entry in
     resourcepacks/manifest.json), so they show up there.

     Writing the packs uses no game code. It only opens the filesystem database after the game has
     created it (the open is aborted if the database does not exist yet), writes each pack in one
     transaction, and never touches worlds or other packs. A pack the player deletes stays
     deleted. packs/packs.json (written by the build script) lists each pack with a hash of its zip;
     when that changes, a pack the player still has is replaced in place (same folder, so it stays
     switched on if it was).

     Thunder 1.21.11 is switched on once per browser, the way Options > Resource Packs > Done does
     it: put into the selected list (below the packs already on, so Thunder PvP and others stay on
     top), saved to options.txt, resources reloaded. Switched off later, it stays off. Thunder PvP
     is never switched on for the player. When a built-in pack that is switched on was updated in
     place, the resources are reloaded once so the new version shows straight away.
     @use CAR net.minecraft.client.resources.ResourcePackRepository.updateRepositoryEntriesAll
     @use CqD net.minecraft.client.resources.ResourcePackRepository.setRepositories
     @use E1W net.minecraft.client.Minecraft.refreshResources
     @field H$ net.minecraft.client.gui.GuiScreenResourcePacks.actionPerformed Minecraft.mcResourcePackRepository
     @field B3 net.minecraft.client.resources.ResourcePackRepository.updateRepositoryEntriesAll ResourcePackRepository.repositoryEntriesAll
     @field bGf net.minecraft.client.resources.ResourcePackRepository.setRepositories ResourcePackRepository.repositoryEntries (switched on, bottom first)
     @field AA net.minecraft.client.gui.GuiScreenResourcePacks.actionPerformed GameSettings.resourcePacks
     @field Tj net.minecraft.client.resources.ResourcePackRepository$Entry.getResourcePackName Entry.reResourcePack
     @field UL net.minecraft.client.resources.ResourcePackRepository$Entry.getResourcePackName EaglerFolderResourcePack folder name
     ------------------------------------------------------------------------------------------- */
  (function(){
    var DB_NAME='_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_12_2_';
    var STORE='filesystem',ROOT='resourcepacks/',MANIFEST=ROOT+'manifest.json';
    var MARK='thunderBuiltinPacks';               // localStorage: {folder: installed version}
    var LIST='packs/packs.json';
    // names for the menu card until packs.json has been read
    var PACKS=[{folder:'Thunder-1_21_11',name:'Thunder 1.21.11'},{folder:'Thunder-PvP',name:'Thunder PvP'}];
    var state={status:'waiting',installed:[],skipped:[],error:null,tries:0,enabled:''};
    var AUTO='thunderPack121On',MAIN='Thunder-1_21_11';
    var enabling=false;          // the switch-on / reload steps are queued or running
    // true while the packs are being checked, written or switched on (the loading screen waits)
    function busy(){return enabling||state.status==='waiting'||state.status==='opening'||state.status==='installing';}
    var IDB=W.indexedDB;

    function readMark(){try{return JSON.parse(W.localStorage.getItem(MARK)||'{}')||{};}catch(_){return {};}}
    function writeMark(m){try{W.localStorage.setItem(MARK,JSON.stringify(m));}catch(_){}}

    // Opens the game's filesystem database only if it already exists with its store.
    function openExisting(){
      return new Promise(function(resolve){
        var req;
        try{req=IDB.open(DB_NAME);}catch(e){resolve(null);return;}
        req.onupgradeneeded=function(){try{req.transaction.abort();}catch(_){}};   // not created yet: leave it to the game
        req.onerror=function(ev){if(ev&&ev.preventDefault)ev.preventDefault();resolve(null);};
        req.onblocked=function(){resolve(null);};
        req.onsuccess=function(){
          var db=req.result;
          if(!db.objectStoreNames.contains(STORE)){db.close();resolve(null);return;}
          db.onversionchange=function(){db.close();};
          resolve(db);
        };
      });
    }
    function reqP(r){return new Promise(function(ok,no){r.onsuccess=function(){ok(r.result);};r.onerror=function(){no(r.error);};});}

    // Minimal zip reader: stored entries, or deflated ones when the browser can inflate.
    function u16(b,o){return b[o]|(b[o+1]<<8);}
    function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
    function inflate(bytes){
      if(typeof W.DecompressionStream!=='function')return Promise.reject(new Error('compressed zip entry and no DecompressionStream'));
      var s=new W.Blob([bytes]).stream().pipeThrough(new W.DecompressionStream('deflate-raw'));
      return new W.Response(s).arrayBuffer();
    }
    function readZip(buf){
      var b=new Uint8Array(buf),e=-1,i;
      for(i=b.length-22;i>=0&&i>=b.length-65557;i--)if(u32(b,i)===0x06054b50){e=i;break;}
      if(e<0)return Promise.reject(new Error('not a zip file'));
      var n=u16(b,e+10),p=u32(b,e+16),list=[];
      for(i=0;i<n;i++){
        if(u32(b,p)!==0x02014b50)return Promise.reject(new Error('bad zip directory'));
        var method=u16(b,p+10),csize=u32(b,p+20),nl=u16(b,p+28),xl=u16(b,p+30),cl=u16(b,p+32),lo=u32(b,p+42);
        var name=new W.TextDecoder().decode(b.subarray(p+46,p+46+nl));
        p+=46+nl+xl+cl;
        if(name.charAt(name.length-1)==='/')continue;
        var start=lo+30+u16(b,lo+26)+u16(b,lo+28);
        list.push({name:name,method:method,raw:b.subarray(start,start+csize)});
      }
      return Promise.all(list.map(function(f){
        if(f.method===0)return {name:f.name,data:f.raw.slice().buffer};
        if(f.method===8)return inflate(f.raw).then(function(d){return {name:f.name,data:d};});
        throw new Error('unsupported zip method '+f.method+' ('+f.name+')');
      }));
    }

    // Same layout the game's own importer writes: the folder holding pack.mcmeta is the pack root.
    function packFiles(files){
      var root=null;
      files.forEach(function(f){
        if(/(^|\/)pack\.mcmeta$/.test(f.name)){var r=f.name.slice(0,f.name.length-11);if(root===null||r.length<root.length)root=r;}
      });
      if(root===null)throw new Error('no pack.mcmeta');
      return files.filter(function(f){return f.name.indexOf(root)===0;}).map(function(f){return {name:f.name.slice(root.length),data:f.data};});
    }

    function writePack(db,pk,files){
      return new Promise(function(ok,no){
        var tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE),pre=ROOT+pk.folder+'/';
        tx.oncomplete=function(){ok();};
        tx.onerror=function(){no(tx.error);};
        tx.onabort=function(){no(tx.error||new Error('write aborted'));};
        var g=st.get([MANIFEST]);
        g.onsuccess=function(){
          var man={resourcePacks:[]};
          try{if(g.result&&g.result.data)man=JSON.parse(new W.TextDecoder().decode(g.result.data));}catch(_){man={resourcePacks:[]};}
          if(!man||!Array.isArray(man.resourcePacks))man={resourcePacks:[]};
          st.delete(W.IDBKeyRange.bound([pre],[pre+'\uffff']));          // an older version's files
          files.forEach(function(f){st.put({path:pre+f.name,data:f.data});});
          man.resourcePacks=man.resourcePacks.filter(function(p){return p&&p.folder!==pk.folder;});
          man.resourcePacks.push({folder:pk.folder,name:pk.name,timestamp:Date.now(),domains:['minecraft']});
          st.put({path:MANIFEST,data:new W.TextEncoder().encode(JSON.stringify(man)).buffer});
        };
      });
    }

    function listed(db){
      return reqP(db.transaction(STORE,'readonly').objectStore(STORE).get([MANIFEST])).then(function(r){
        var out={};
        try{JSON.parse(new W.TextDecoder().decode(r.data)).resourcePacks.forEach(function(p){out[p.folder]=1;});}catch(_){}
        return out;
      });
    }

    // packs.json: {packs:[{file, folder, name, version}]}; names are checked so a bad list cannot
    // write outside resourcepacks/<folder>/
    function loadList(){
      return W.fetch(LIST,{cache:'no-cache'}).then(function(r){
        if(!r.ok)throw new Error(LIST+': HTTP '+r.status);
        return r.json();
      }).then(function(j){
        var list=(j&&j.packs||[]).filter(function(p){
          return p&&/^[A-Za-z0-9._-]+\.zip$/.test(p.file)&&/^[A-Za-z0-9_\- ()]+$/.test(p.folder)&&typeof p.name==='string'&&p.version;
        }).map(function(p){return {file:'packs/'+p.file,folder:p.folder,name:p.name,version:String(p.version)};});
        if(!list.length)throw new Error(LIST+' lists no packs');
        PACKS=list;
        return list;
      });
    }

    function run(force){
      var mark=readMark(),todo;
      return loadList().then(function(list){
        todo=list.filter(function(p){return force||mark[p.folder]!==p.version;});
        if(!todo.length){state.status='done';autoEnable([]);return null;}
        state.status='opening';
        return openExisting();
      }).then(function(db){
        if(!todo.length)return state;
        if(!db){
          if(++state.tries<40){state.status='waiting';W.setTimeout(function(){run(force);},2000);}
          else state.status='gave up (filesystem not found)';
          return state;
        }
        state.status='installing';
        return listed(db).then(function(have){
          return todo.reduce(function(chain,pk){
            return chain.then(function(){
              // installed before and since deleted by the player: leave it deleted
              if(!force&&mark[pk.folder]&&!have[pk.folder]){state.skipped.push(pk.name);return;}
              return W.fetch(pk.file,{cache:'no-cache'}).then(function(r){
                if(!r.ok)throw new Error(pk.file+': HTTP '+r.status);
                return r.arrayBuffer();
              }).then(readZip).then(function(files){
                return writePack(db,pk,packFiles(files));
              }).then(function(){
                mark[pk.folder]=pk.version;writeMark(mark);
                state.installed.push(pk.name);
              });
            });
          },Promise.resolve());
        }).then(function(){
          db.close();state.status='done';
          autoEnable(todo.filter(function(p){return state.installed.indexOf(p.name)>=0;}).map(function(p){return p.folder;}));
          return state;
        },function(e){
          try{db.close();}catch(_){}
          throw e;
        });
      }).catch(function(e){
        state.status='failed';state.error=String(e&&e.message||e);
        if(W.console&&W.console.warn)W.console.warn('[Thunder] built-in packs: '+state.error);
        return state;
      });
    }

    // Thunder 1.21.11 on (see the header). Steps run on the game thread between frames; a step that
    // makes a game call makes exactly one, and makes it again when the game resumes it.
    // updated: folders of the built-in packs just written again (a pack that is switched on and was
    // updated gets the resources reloaded once, so the new version shows straight away)
    function autoEnable(updated){
      var want=false;
      try{want=!W.localStorage.getItem(AUTO);}catch(_){}
      if(!want&&!updated.length)return;
      enabling=true;
      var repo=null,gs=null,list=null,apply=false,reload=false;
      function folder(x){return x&&x.Tj&&x.Tj.UL?$rt_ustr(x.Tj.UL):null;}
      runOnGame([
        function(){
          if(!$rt_resuming()){repo=HEN&&HEN.H$;gs=HEN&&HEN.G;}
          if($rt_resuming()||repo)CAR(repo);                 // read the pack list again
        },
        function(){
          if(!repo||!gs)return;
          var all=repo.B3,sel=repo.bGf,e=null,on=false,i,f;
          for(i=0;i<EH(all);i++)if(folder(Bm(all,i))===MAIN){e=Bm(all,i);break;}
          for(i=0;i<EH(sel);i++){
            f=folder(Bm(sel,i));
            if(f===MAIN)on=true;
            if(f!==null&&updated.indexOf(f)>=0)reload=true;  // switched on and just updated
          }
          if(e&&want&&!on){                                   // (not in the list: the player deleted it)
            list=Bq();Y(list,e);
            for(i=0;i<EH(sel);i++)Y(list,Bm(sel,i));
            apply=reload=true;
          }
          if(e)try{W.localStorage.setItem(AUTO,'1');}catch(_){}
        },
        function(){if($rt_resuming()||apply)CqD(repo,list);},
        function(){
          if(!apply)return;
          CA(gs.AA);
          for(var i=0;i<EH(list);i++)Y(gs.AA,Bm(list,i).Tj.UL);
        },
        function(){if($rt_resuming()||apply)DuB(gs);},       // options.txt
        function(){if($rt_resuming()||reload)E1W(HEN);},      // reload textures and models
        function(){state.enabled=apply?'switched on':reload?'reloaded after an update':'already on';enabling=false;}
      ]);
    }

    function reinstall(){state.installed=[];state.skipped=[];state.error=null;state.tries=0;return run(true);}
    TC.packs={
      state:function(){var o=JSON.parse(JSON.stringify(state));o.busy=busy();return o;},
      busy:busy,
      list:function(){return JSON.parse(JSON.stringify(PACKS));},
      reinstall:reinstall
    };

    // Right Shift > Utility card: what is in the pack list, and a way to add a deleted pack back.
    MODULES.push({cat:'utility',id:null,special:'builtinpacks',name:'Built-in Resource Packs',
      desc:'Thunder 1.21.11 (the Minecraft 1.21.11 look, plus maces, spears, wind charges and other newer items on servers) is switched on for you. Thunder PvP (plain armor, small totem, low fire, clean hotbar) is in Options > Resource Packs: put it above Thunder 1.21.11.'});
    SPECIALS.builtinpacks=function(box){
      var n=el('div','tcm-note','Checking your resource pack list...');
      box.appendChild(n);
      function show(){
        if(state.status==='installing'||state.status==='opening'){n.textContent='Adding the packs...';return;}
        if(state.status==='failed'){n.textContent='Could not add the packs: '+state.error;return;}
        openExisting().then(function(db){
          if(!db){n.textContent='The game has not opened its storage yet.';return;}
          return listed(db).then(function(have){
            db.close();
            var inList=PACKS.filter(function(p){return have[p.folder];}).map(function(p){return p.name;});
            var gone=PACKS.filter(function(p){return !have[p.folder];}).map(function(p){return p.name;});
            n.textContent=(inList.length?'In your pack list: '+inList.join(', ')+'.':'')+
              (gone.length?(inList.length?' ':'')+'Not in your list: '+gone.join(', ')+' (Add them again brings them back).':'');
          });
        }).catch(function(e){n.textContent='Could not read the pack list: '+(e&&e.message||e);});
      }
      show();
      var row=el('div','tcm-actions');
      row.appendChild(confirmButton('Add them again','Click again to add them',function(){
        n.textContent='Adding the packs...';
        reinstall().then(show);
      }));
      box.appendChild(row);
    };
    if(IDB&&W.fetch&&W.Promise&&W.TextDecoder)W.setTimeout(function(){run(false);},2500);
    else state.status='unsupported browser';
  })();
