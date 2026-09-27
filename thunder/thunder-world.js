  /* -------------------------------------------------------------------------------------------
     Part of Thunder Client, created and owned by Jayvardhan Ginni (ThunderGamey).
     World shader effects: Waving Plants, Water (waves, sky reflections, sun glints) and
     See-through Leaves. Included into the client scope of thunder-client.js by build.js.

     The world is drawn by Eaglercraft's own shader (assets/eagler/glsl/core.vsh + core.fsh),
     compiled once per GL state combination. Waving and water are extra GLSL added to that source:
       - The additions are inside #if blocks that are only true for the block-terrain states
         (texture + color + lightmap attributes, fog, no normals), so every other shader (GUI,
         entities, items, particles, sky) compiles exactly as before.
       - Which vertices belong to a plant, leaves or water is written into the vertex alpha while a
         chunk is built: alpha 254..250 instead of 255 (renderBlock wrapper below). The added GLSL
         restores alpha 255, so textures and blending are unchanged. Without the added GLSL the
         marks are invisible (at most 2% alpha on those vertices).
       - The added GLSL reads one small uniform buffer (time, strengths, sun). It is bound as
         "on" only while chunk layers draw (renderBlockLayer wrapper), so nothing else can move.
       - Waves repeat every 16 blocks (whole-number wave vectors), so they meet exactly across
         chunk borders, whose vertices are chunk-relative.
       - WebGL 2 only. The patched source is test-compiled first; if the game ever fails to compile
         it, the game's own shader is used again and the effect turns itself off.
     See-through Leaves keeps leaves in their transparent (Fancy) form on Fast graphics.

     Game functions this module replaces (each wrapper always runs the original):
     @hook C_0 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline.makeNewPipeline
     @hook DCQ net.minecraft.client.renderer.RenderGlobal.renderBlockLayer
     @hook Dt2 net.minecraft.client.renderer.BlockRendererDispatcher.renderBlock
     @hook DbQ net.minecraft.client.renderer.RenderGlobal.loadRenderers

     Game functions it calls:
     @use CC6 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline.destroy
     @use CA java.util.ArrayList.clear

     Static fields:
     @set HE0 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline shaderSourceCacheVSH (core.vsh text; Thunder swaps in the patched text)
     @set HE1 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline shaderSourceCacheFSH (core.fsh text)
     @static HE2 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline pipelineStateCache
     @static HE3 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline pipelineExtStateCache
     @static HE4 net.lax1dude.eaglercraft.opengl.FixedFunctionPipeline pipelineListTracker
     @staticset H1M net.lax1dude.eaglercraft.opengl.GLSLHeader.init (GLSL version header)
     @staticset H1N net.lax1dude.eaglercraft.opengl.GLSLHeader.init (gles2_compat.glsl text)
     @static H5O net.minecraft.init.Blocks LEAVES
     @static H5P net.minecraft.init.Blocks LEAVES2

     Classes, virtual methods and fields:
     @class Ln net.minecraft.block.BlockBush
     @class Bax net.minecraft.block.BlockLilyPad
     @class APk net.minecraft.block.BlockDoublePlant
     @class U6 net.minecraft.block.BlockLeaves
     @class Rp net.minecraft.block.BlockVine
     @class Qz net.minecraft.block.BlockLiquid
     @virtual cV net.minecraft.block.Block getMetaFromState
     @field n net.minecraft.block.state.BlockStateContainer$StateImplementation.getBlock StateImplementation.block
     @field eX net.minecraft.block.state.BlockStateContainer$StateImplementation.getMaterial Block.blockMaterial
     @field i net.minecraft.util.math.Vec3i.getY Vec3i.y
     @field sX net.lax1dude.eaglercraft.opengl.WorldRenderer.getColorIndex WorldRenderer.vertexCount
     @field sp net.lax1dude.eaglercraft.opengl.WorldRenderer.getColorIndex WorldRenderer.vertexFormat
     @field s0 net.lax1dude.eaglercraft.opengl.WorldRenderer.getColorIndex VertexFormat.nextOffset (bytes per vertex)
     @field ctV net.lax1dude.eaglercraft.opengl.WorldRenderer.getColorIndex VertexFormat.colorElementOffset
     @field j3 net.lax1dude.eaglercraft.opengl.WorldRenderer.putColorMultiplier WorldRenderer.rawIntBuffer
     @field bUV net.lax1dude.eaglercraft.opengl.WorldRenderer.setTranslation WorldRenderer.yOffset
     @field v5 net.lax1dude.eaglercraft.internal.buffer.EaglerArrayIntBuffer.put EaglerArrayIntBuffer.typedArray (Int32Array)
     @field t3 net.lax1dude.eaglercraft.internal.buffer.EaglerArrayIntBuffer.put EaglerArrayIntBuffer.limit
     @field bAC net.minecraft.client.renderer.RenderGlobal.loadRenderers BlockLeaves.leavesFancy
     @field d7 net.minecraft.client.renderer.RenderGlobal.loadRenderers RenderGlobal.world
     @field fK net.minecraft.client.Minecraft.startGame Minecraft.renderGlobal
     (Minecraft.world X, World.provider b4, getCelestialAngle Q$, getRainStrength R$, the GL
     context HEl and its version HEv are declared in thunder-shaders.js; Minecraft HEN in
     thunder-lan.js; Material.WATER HGM in thunder-client.js.)
     ------------------------------------------------------------------------------------------- */
  // vertex alpha marks written while chunks are built (255 = untouched)
  var WV_PLANT=254,WV_WATER=250,WV_LEAVES=251;   // plants: 254 still, 253 sways, 252 sways twice as far
  // the terrain shader states the additions compile into
  var WV_IF='#if defined(EAGLER_HAS_GLES_300) && defined(COMPILE_TEXTURE_ATTRIB) && defined(COMPILE_COLOR_ATTRIB) && '+
    'defined(COMPILE_LIGHTMAP_ATTRIB) && defined(COMPILE_ENABLE_FOG) && !defined(COMPILE_NORMAL_ATTRIB) && !defined(COMPILE_ENABLE_TEX_GEN)\n'+
    '#define THUNDER_WORLD\n'+
    // tw_a: time, plant sway, leaf sway, water wave height; tw_b: reflection strength, 1 while
    // chunk layers draw; tw_sun: sun (or moon) direction in world space, glint strength
    'layout(std140) uniform ThunderWorld { vec4 tw_a; vec4 tw_b; vec4 tw_sun; vec4 tw_c; };\n';
  var WV_VS_DECL=WV_IF+
    'flat out float v_twKind;\nout vec3 v_twPos;\nout vec3 v_twX;\nout vec3 v_twY;\nout vec3 v_twZ;\n'+
    'vec4 twColor;\n'+
    'float twWater(vec2 q, float t) {\n'+
    '\tconst float K = 0.39269908;\n'+
    '\treturn 0.5 * sin(K * (2.0 * q.x + q.y) + t * 1.3) + 0.3 * sin(K * (3.0 * q.y - q.x) + t * 1.9) + 0.2 * sin(K * (5.0 * q.x - 3.0 * q.y) + t * 2.7);\n'+
    '}\n'+
    'vec3 twVertex(vec3 p) {\n'+
    '\ttwColor = a_color4f;\n'+
    '\tv_twKind = 0.0;\n'+
    '\tv_twPos = p;\n'+
    '\tmat3 m = mat3(u_modelviewMat4f);\n'+
    '\tv_twX = m[0];\n\tv_twY = m[1];\n\tv_twZ = m[2];\n'+
    '\tfloat code = floor(a_color4f.a * 255.0 + 0.5);\n'+
    '\tif (tw_b.y < 0.5 || code < 249.5 || code > 254.5) return p;\n'+
    '\ttwColor.a = 1.0;\n'+
    '\tfloat t = tw_a.x;\n'+
    '\tconst float K = 0.39269908;\n'+          // 2 pi / 16: every wave repeats each 16 blocks
    '\tif (code > 251.5) {\n'+
    // plants: the top moves, the base stays; out of the wind (low sky light) they stay still
    '\t\tvec3 lm = TEX_MAT3(u_textureMat4f02) * vec3(a_lightmap2f, 1.0);\n'+
    '\t\tfloat open = smoothstep(0.45, 0.9, lm.y / lm.z);\n'+
    '\t\tvec2 w = vec2(sin(K * (p.x + p.z) + t * 1.9) + 0.45 * sin(K * (3.0 * p.x - 2.0 * p.z) + t * 3.3),\n'+
    '\t\t\tsin(K * (p.z - 2.0 * p.x) + t * 1.5) + 0.45 * sin(K * (2.0 * p.x + 3.0 * p.z) + t * 2.9));\n'+
    '\t\tp.xz += w * (tw_a.y * (254.0 - code) * open);\n'+
    '\t\tv_twKind = 1.0;\n'+
    '\t} else if (code > 250.5) {\n'+
    // leaves and vines: every vertex sways by where it is, so neighbouring blocks stay joined
    '\t\tp += vec3(sin(K * (p.x + 2.0 * p.y + p.z) + t * 1.7), 0.5 * sin(K * (p.x - p.z + 2.0 * p.y) + t * 2.3),\n'+
    '\t\t\tsin(K * (2.0 * p.x - p.y + 3.0 * p.z) + t * 1.3)) * tw_a.z;\n'+
    '\t\tv_twKind = 2.0;\n'+
    '\t} else {\n'+
    // water: only the surface moves (whole-block heights such as the bottom stay put)
    '\t\tv_twKind = 3.0;\n'+
    '\t\tif (abs(p.y - floor(p.y + 0.5)) > 0.01) p.y += tw_a.w * twWater(p.xz, t);\n'+
    '\t}\n'+
    '\treturn p;\n'+
    '}\n'+
    '#endif\n';
  var WV_VS_MAIN='\n#ifdef THUNDER_WORLD\n\tvec3 twP = twVertex(a_position3f);\n#define a_position3f twP\n#define a_color4f twColor\n#endif\n';
  var WV_FS_DECL=WV_IF+
    'flat in float v_twKind;\nin vec3 v_twPos;\nin vec3 v_twX;\nin vec3 v_twY;\nin vec3 v_twZ;\n'+
    // slope of fine ripples (world space), for the reflection and glints
    'vec2 twSlope(vec2 q, float t) {\n'+
    '\tconst float K = 0.39269908;\n'+
    '\tvec2 d = vec2(9.0, 4.0) * (0.020 * cos(K * dot(vec2(9.0, 4.0), q) + t * 2.1));\n'+
    '\td += vec2(-5.0, 11.0) * (0.016 * cos(K * dot(vec2(-5.0, 11.0), q) + t * 2.6));\n'+
    '\td += vec2(14.0, -7.0) * (0.010 * cos(K * dot(vec2(14.0, -7.0), q) + t * 3.4));\n'+
    '\td += vec2(3.0, 17.0) * (0.008 * cos(K * dot(vec2(3.0, 17.0), q) + t * 3.9));\n'+
    '\treturn d * K;\n'+
    '}\n'+
    '#endif\n';
  // water surfaces reflect the sky (the fog color is the horizon color the game already uses),
  // more at low angles (Fresnel), less under cover; the sun or moon leaves a glint
  var WV_FS_WATER='#ifdef THUNDER_WORLD\n'+
    '\tif (v_twKind > 2.5 && tw_b.x > 0.0) {\n'+
    '\t\tvec3 twV = v_position4f.xyz / v_position4f.w;\n'+
    '\t\tvec3 twG = normalize(cross(dFdx(twV), dFdy(twV)));\n'+
    '\t\tfloat twTop = smoothstep(0.75, 0.95, abs(dot(twG, normalize(v_twY))));\n'+
    '\t\tif (twTop > 0.0) {\n'+
    '\t\t\tvec2 twD = twSlope(v_twPos.xz, tw_a.x);\n'+
    '\t\t\tvec3 twN = normalize(v_twY - v_twX * twD.x - v_twZ * twD.y);\n'+
    '\t\t\tvec3 twE = normalize(-twV);\n'+
    '\t\t\tif (dot(twN, twE) < 0.0) twN = -twN;\n'+
    '\t\t\tfloat twF = 0.08 + 0.92 * pow(1.0 - clamp(dot(twN, twE), 0.0, 1.0), 5.0);\n'+
    '\t\t\tfloat twSky = smoothstep(0.35, 0.9, v_lightmap2f.y);\n'+
    '\t\t\tvec3 twS = normalize(v_twX * tw_sun.x + v_twY * tw_sun.y + v_twZ * tw_sun.z);\n'+
    '\t\t\tfloat twSp = pow(max(dot(reflect(-twE, twN), twS), 0.0), 240.0) * tw_sun.w * twSky;\n'+
    '\t\t\tfloat twK = tw_b.x * twTop;\n'+
    '\t\t\tcolor.rgb = mix(color.rgb, u_fogColor4f.rgb * mix(0.4, 1.05, twSky), clamp(twF * twK * 1.2, 0.0, 0.85));\n'+
    '\t\t\tcolor.rgb += vec3(1.0, 0.92, 0.78) * (twSp * 2.5 * twK);\n'+
    '\t\t\tcolor.a = clamp(max(color.a, twF * twK) + twSp * twK, 0.0, 1.0);\n'+
    '\t\t}\n'+
    '\t}\n'+
    '#endif\n';

  var WV={patched:false,failed:null,needFlush:false,ov:null,of:null,ovText:'',pv:null,pf:null,
    uOn:null,uOff:null,data:new Float32Array(16),frame:-1,frameNo:0,on:false,marks:0,compiled:0};

  // the patched shader text for the game's core.vsh / core.fsh text, or null if it is not the
  // layout this was written for
  function wvPatch(vs,fs){
    var vm=vs.indexOf('void main() {'),fo=fs.indexOf('EAGLER_FRAG_OUT()');
    var fog=/#ifdef COMPILE_ENABLE_FOG\r?\n\s*vec3 fogPos/.exec(fs);
    if(vm<0||vs.indexOf('void main() {',vm+1)>=0||vs.indexOf('TEX_MAT3(')<0||fo<0||!fog||
      vs.indexOf('a_color4f')<0||fs.indexOf('vec4 color')<0)return null;
    var vm2=vm+'void main() {'.length;
    return {
      vs:vs.slice(0,vm)+WV_VS_DECL+vs.slice(vm,vm2)+WV_VS_MAIN+vs.slice(vm2),
      fs:fs.slice(0,fo)+WV_FS_DECL+fs.slice(fo,fog.index)+WV_FS_WATER+fs.slice(fog.index)
    };
  }
  // compile and link the patched text the way the game assembles it (GLSLHeader: version header,
  // stage define, state defines, compat header, source) for terrain states and for an entity
  // state, before the game ever sees it
  var WV_TEST=[
    ['TEXTURE_ATTRIB','COLOR_ATTRIB','LIGHTMAP_ATTRIB','ENABLE_TEXTURE2D','ENABLE_LIGHTMAP','ENABLE_FOG'],
    ['TEXTURE_ATTRIB','COLOR_ATTRIB','LIGHTMAP_ATTRIB','ENABLE_TEXTURE2D','ENABLE_LIGHTMAP','ENABLE_ALPHA_TEST',
      'ENABLE_MC_LIGHTING','ENABLE_ANISOTROPIC_FIX','ENABLE_FOG','BLEND_ADD'],
    ['TEXTURE_ATTRIB','COLOR_ATTRIB','NORMAL_ATTRIB','ENABLE_TEXTURE2D','ENABLE_LIGHTMAP','ENABLE_ALPHA_TEST',
      'ENABLE_MC_LIGHTING','ENABLE_FOG']
  ];
  function wvTest(p){
    var gl=HEl,head=$rt_ustr(H1M),compat=$rt_ustr(H1N),i,j,ok=true,log='';
    for(i=0;i<WV_TEST.length&&ok;i++){
      var defs='';
      for(j=0;j<WV_TEST[i].length;j++)defs+='#define COMPILE_'+WV_TEST[i][j]+'\n';
      defs+='precision lowp int;\nprecision highp float;\nprecision mediump sampler2D;\n\n';
      var v=gl.createShader(gl.VERTEX_SHADER),f=gl.createShader(gl.FRAGMENT_SHADER),pr=gl.createProgram();
      gl.shaderSource(v,head+'#define EAGLER_IS_VERTEX_SHADER\n'+defs+'\n'+compat+'\n'+p.vs);gl.compileShader(v);
      gl.shaderSource(f,head+'#define EAGLER_IS_FRAGMENT_SHADER\n'+defs+'\n'+compat+'\n'+p.fs);gl.compileShader(f);
      gl.attachShader(pr,v);gl.attachShader(pr,f);gl.linkProgram(pr);
      if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){
        ok=false;log=(gl.getShaderInfoLog(v)||'')+(gl.getShaderInfoLog(f)||'')+(gl.getProgramInfoLog(pr)||'');
      }
      gl.deleteProgram(pr);gl.deleteShader(v);gl.deleteShader(f);
    }
    if(!ok&&W.console&&W.console.warn)W.console.warn('[Thunder] world shader test compile failed:',log);
    return ok;
  }
  // the game's own cache flush (inlined in Minecraft.refreshResources): every compiled shader
  // state is deleted and compiled again from the current text the next time it is needed
  function wvFlush(){
    var a=HE2.data,e=HE3.data,i,j,x;
    for(i=0;i<a.length;i++)if(a[i]!==null){CC6(a[i]);a[i]=null;}
    for(i=0;i<e.length;i++){
      x=e[i];if(x===null)continue;
      for(j=0;j<x.data.length;j++)if(x.data[j]!==null){CC6(x.data[j]);x.data[j]=null;}
      e[i]=null;
    }
    CA(HE4);
  }
  function wvBuffers(){
    if(WV.uOn)return;
    var gl=HEl;
    WV.uOn=gl.createBuffer();WV.uOff=gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER,WV.uOn);gl.bufferData(gl.UNIFORM_BUFFER,64,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER,WV.uOff);gl.bufferData(gl.UNIFORM_BUFFER,64,gl.STATIC_DRAW);
    // binding point 0 always has a buffer, so a patched shader can never draw without one
    // (the game itself uses no uniform buffers)
    gl.bindBufferBase(gl.UNIFORM_BUFFER,0,WV.uOff);
  }
  function wvWant(){return !!(S.shaders&&(S.shWave||S.shWater))&&HEv===300&&!WV.failed&&!!HEl;}
  // once per frame, between frames: put the patched or the original text in place
  function wvSync(){
    if(WV.needFlush){WV.needFlush=false;wvFlush();}
    if(wvWant()){
      if(WV.patched&&HE0===WV.pv&&HE1===WV.pf)return;
      if(HE0===null||HE1===null)return;                  // the game loads them with its first shader
      if(HE0!==WV.pv||HE1!==WV.pf){
        var vs=$rt_ustr(HE0),fs=$rt_ustr(HE1);
        if(!WV.pv||vs!==WV.ovText){                       // first time, or a reload brought new text
          var p=wvPatch(vs,fs);
          if(!p){WV.failed='This game version\'s world shader has a different layout.';return;}
          if(!wvTest(p)){WV.failed='The world shader did not compile on this device.';return;}
          WV.ovText=vs;WV.pv=$rt_str(p.vs);WV.pf=$rt_str(p.fs);
        }
        WV.ov=HE0;WV.of=HE1;
      }
      wvBuffers();
      wvFlush();HE0=WV.pv;HE1=WV.pf;WV.patched=true;
    }else if(WV.patched){
      wvFlush();
      if(HE0===WV.pv)HE0=WV.ov;
      if(HE1===WV.pf)HE1=WV.of;
      WV.patched=false;
    }
  }
  frameTasks.push(function(){WV.frameNo++;try{wvSync();}catch(e){WV.failed='Error: '+(e&&e.message||e);report(e);}});

  // uniform buffer values for this frame
  function wvUpdate(pt){
    var d=WV.data,mc=HEN,w=mc&&mc.X,rain=0,sx=0,sy=1,sun=0;
    try{
      if(w&&w.b4&&w.b4.Tv()){
        if(!(pt>=0&&pt<=1))pt=1;
        var ang=Q$(w,pt)*6.283185307179586;
        sx=-Math.sin(ang);sy=Math.cos(ang);rain=clamp(Number(R$(w,pt))||0,0,1);
        if(sy>-0.05)sun=clamp((sy+0.05)*6,0,1);
        else{sx=-sx;sy=-sy;sun=0.3*clamp((sy-0.05)*6,0,1);}   // the moon
        sun*=1-rain;
      }
    }catch(_){}
    var wave=S.shWave?clamp(Number(S.shWaveStr)||0,0,100)/100:0,water=S.shWater?clamp(Number(S.shWaterStr)||0,0,100)/100:0;
    var wind=1+rain*0.8;
    d[0]=(now()/1000)%3600;d[1]=0.075*wave*wind;d[2]=0.035*wave*wind;d[3]=0.06*water;
    d[4]=water;d[5]=1;d[6]=0;d[7]=0;
    d[8]=sx;d[9]=sy;d[10]=0;d[11]=sun;
    d[12]=rain;d[13]=0;d[14]=0;d[15]=0;
    var gl=HEl;
    gl.bindBuffer(gl.UNIFORM_BUFFER,WV.uOn);gl.bufferSubData(gl.UNIFORM_BUFFER,0,d);
  }
  // chunk layers: the added GLSL is only active while these draw
  var origDCQ=DCQ;
  DCQ=function(a,b,c,d,e){
    if(!WV.patched||!WV.uOn)return origDCQ(a,b,c,d,e);
    var gl=HEl;
    try{if(WV.frame!==WV.frameNo){WV.frame=WV.frameNo;wvUpdate(c);}gl.bindBufferBase(gl.UNIFORM_BUFFER,0,WV.uOn);}catch(x){report(x);}
    var r=origDCQ(a,b,c,d,e);
    gl.bindBufferBase(gl.UNIFORM_BUFFER,0,WV.uOff);
    return r;
  };
  // If the game ever fails to compile the patched text for some state, that state (and, from
  // the next frame, every other) goes back to the game's own shader and the effect turns off.
  var origC_0=C_0;
  C_0=function(b,c,d){
    if(!WV.patched||$rt_resuming())return origC_0(b,c,d);
    try{var r=origC_0(b,c,d);if(!$rt_suspending())WV.compiled++;return r;}
    catch(e){
      WV.failed='The world shader did not compile for one of the game\'s states.';report(e);
      if(HE0===WV.pv)HE0=WV.ov;
      if(HE1===WV.pf)HE1=WV.of;
      WV.patched=false;WV.needFlush=true;
      return origC_0(b,c,d);
    }
  };

  // ---- vertex marks, written while a chunk is built ----------------------------------------
  var wvI32=null,wvF32=null;
  function wvFloats(a){if(a!==wvI32){wvI32=a;wvF32=new Float32Array(a.buffer,a.byteOffset,a.length);}return wvF32;}
  function wvMark(state,pos,buf,n0){
    var blk=state.n,kind;
    if(!blk)return;
    if(blk instanceof Ln){if(blk instanceof Bax||!S.shWave)return;kind=1;}   // plants, not lily pads
    else if(blk instanceof U6||blk instanceof Rp){if(!S.shWave)return;kind=2;}
    else if(blk instanceof Qz){if(blk.eX!==HGM||!S.shWater)return;kind=3;}   // water, not lava
    else return;
    var fmt=buf.sp,ib=buf.j3,a=ib&&ib.v5,n1=buf.sX;
    if(!fmt||fmt.s0!==28||fmt.ctV!==12||!a||n1*7>ib.t3)return;   // block vertex layout only
    var f=wvFloats(a),v,o,code=kind===2?WV_LEAVES:WV_WATER,by=0,top=0;
    if(kind===1){
      by=pos.i+buf.bUV+0.5;                               // half way up the block, chunk-relative
      if(blk instanceof APk&&(blk.cV(state)&8))top=1;      // upper half of a tall plant
    }
    for(v=n0;v<n1;v++){
      o=v*7;
      if(kind===1)code=WV_PLANT-top-(f[o+1]>by?1:0);
      a[o+3]=(a[o+3]&0xFFFFFF)|(code<<24);
    }
    WV.marks++;
  }
  var origDt2=Dt2;
  Dt2=function(a,b,c,d,e){
    var n0;
    if($rt_resuming())n0=$rt_nativeThread().pop();
    else n0=e?e.sX|0:0;
    var r=origDt2(a,b,c,d,e);
    if($rt_suspending()){$rt_nativeThread().push(n0);return r;}
    if(r&&e&&(S.shWave||S.shWater)&&e.sX>n0){try{wvMark(b,c,e,n0);}catch(x){report(x);}}
    return r;
  };

  // ---- See-through Leaves -------------------------------------------------------------------
  // loadRenderers copies Fancy/Fast graphics into both leaf blocks, then chunks are rebuilt over
  // the next frames; setting the flag right after keeps leaves transparent in that rebuild.
  var origDbQ=DbQ;
  DbQ=function(a){
    origDbQ(a);
    if($rt_suspending())return;
    if(S.clearLeaves){if(H5O)H5O.bAC=1;if(H5P)H5P.bAC=1;}
  };
  // rebuild every chunk (what changing Graphics does), on the game thread
  function wvReload(){
    runOnGame([function(){
      var rg=HEN&&HEN.fK;
      if($rt_resuming()||(rg&&rg.d7!==null))DbQ(rg);
    }]);
  }
  function wvToggled(){
    // turning a kind on needs its marks, which are only written while chunks are built
    var want=!!(S.shWave||S.shWater);
    if(want)wvReload();
  }

  TC.world={
    state:function(){return {patched:WV.patched,failed:WV.failed,marks:WV.marks,compiled:WV.compiled,webgl2:HEv===300};},
    reload:wvReload
  };

  MODULES.push(
    {cat:'shaders',id:'shWave',name:'Waving Plants',onChange:wvToggled,
      desc:'Grass, flowers, crops, saplings, leaves and vines sway in the wind, a little more in rain. Plants in caves stay still. Needs WebGL 2.',
      opts:[{id:'shWaveStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'shaders',id:'shWater',name:'Water',onChange:wvToggled,
      desc:'Gentle waves on the water surface, sky reflections that grow at low angles, and a glint from the sun or moon. Needs WebGL 2.',
      opts:[{id:'shWaterStr',name:'Strength',min:0,max:100,step:1,fmt:shPct}]},
    {cat:'visual',id:'clearLeaves',name:'See-through Leaves',onChange:wvReload,
      desc:'Leaves you can see through, even on Fast graphics. Off: leaves follow the Graphics setting.'}
  );
