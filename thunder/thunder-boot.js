  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     Start-up. Included into the client scope of thunder-client.js by build.js.
     - TC.boot() tells the loading screen of index-js.html how far the game has got: the game
       object exists, a menu has been on screen for a few frames, the built-in packs are busy.
     - Quick Start (Right Shift > Utility, on by default): the game opens the Eaglercraft Edit
       Profile screen every time it starts; with Quick Start it goes straight to the title screen
       (Edit Profile is a button there), and the "default username" reminder after Edit Profile
       is left out.

     Game function this module replaces (the wrapper only picks which screen is opened):
     @hook GGs net.minecraft.client.Minecraft.displayGuiScreen

     Classes and fields it uses:
     @class BV5 net.lax1dude.eaglercraft.profile.GuiScreenDefaultUsernameNote
     @field cal net.lax1dude.eaglercraft.profile.GuiScreenEditProfile.actionPerformed GuiScreenEditProfile.parent (the screen after it)
     @field cIw net.lax1dude.eaglercraft.profile.GuiScreenEditProfile.actionPerformed GuiScreenDefaultUsernameNote.cont (the screen after it)
     @field cm net.minecraft.client.Minecraft.displayGuiScreen Minecraft.currentScreen
     (GuiScreenEditProfile Zj is declared in thunder-theme.js.)
     ------------------------------------------------------------------------------------------- */
  var BOOT={frames:0,skipped:[]};
  // Minecraft.displayGuiScreen(screen). Before the first menu frame the game is still starting:
  // an Edit Profile screen then is the start-up one and its parent (the title screen) is opened
  // instead. The username reminder is replaced by the screen it would continue to.
  var origGGs=GGs;
  GGs=function(a,b){
    if(!$rt_resuming()&&S.quickStart&&b!==null){
      if(BOOT.frames===0&&b instanceof Zj&&b.cal!==null){b=b.cal;BOOT.skipped.push('Edit Profile');}
      else if(b instanceof BV5&&b.cIw!==null){b=b.cIw;BOOT.skipped.push('username reminder');}
    }
    return origGGs(a,b);
  };
  frameTasks.push(function(){if(BOOT.frames<100&&HEN&&HEN.cm!==null)BOOT.frames++;});
  TC.boot=function(){
    return {game:!!HEN,menu:BOOT.frames>=3,frames:BOOT.frames,
      packsBusy:!!(TC.packs&&TC.packs.busy&&TC.packs.busy()),skipped:BOOT.skipped.slice()};
  };
  MODULES.push({cat:'utility',id:'quickStart',name:'Quick Start',
    desc:'Starts straight on the title screen: no Eaglercraft Edit Profile screen every time the game opens (Edit Profile is still a button on the title screen) and no default-username reminder.'});
