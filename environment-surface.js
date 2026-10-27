'use strict';
function sharedSurfaceMountainHeight(a,layer=0){
  const p=layer*.73;
  const broad=6.8*Math.pow(Math.abs(Math.sin(a*4+p+.35)),2.0);
  const peaks=11.5*Math.pow(Math.abs(Math.sin(a*9-p*.7+1.15)),5.0);
  const teeth=6.2*Math.pow(Math.abs(Math.sin(a*19+p*.45+.55)),7.5);
  const crags=3.4*Math.pow(Math.abs(Math.sin(a*33-p*.3+2.1)),10);
  return 4.8+broad+peaks+teeth+crags;
}
let sharedSurfaceHorizonCache=null;
function sharedSurfaceHorizonSamples(){
  if(sharedSurfaceHorizonCache)return sharedSurfaceHorizonCache;
  const steps=300;
  sharedSurfaceHorizonCache=[0,1].map(layer=>{
    const samples=[];
    for(let i=0;i<=steps;i++){
      const a=-Math.PI+i*Math.PI*2/steps;
      samples.push({sa:Math.sin(a),ca:Math.cos(a),h:sharedSurfaceMountainHeight(a,layer)})
    }
    return samples
  });
  return sharedSurfaceHorizonCache
}
function drawSharedSurfaceHorizon(floor=-3.5,far=380,alpha=1,ridgeCol=C.gd,baseCol=C.g){
  const cached=sharedSurfaceHorizonSamples();
  const drawLayer=(layer)=>{
    const radius=far*(layer?1.10:1),scale=layer?.70:1,samples=cached[layer];
    let peaks=[],bases=[];
    const flush=()=>{
      if(peaks.length<2){peaks=[];bases=[];return}
      const poly=peaks.concat([...bases].reverse());
      fillPoly(poly);
      for(let j=1;j<peaks.length;j++){
        line(peaks[j-1].x,peaks[j-1].y,peaks[j].x,peaks[j].y,ridgeCol,layer?.72:.98,layer?.42*alpha:.82*alpha);
      }
      if(!layer){
        for(let j=1;j<bases.length;j++){
          line(bases[j-1].x,bases[j-1].y,bases[j].x,bases[j].y,baseCol,.82,.34*alpha);
        }
      }
      peaks=[];bases=[];
    };
    for(const s of samples){
      const x=shipX+s.sa*radius,z=s.ca*radius,h=s.h*scale;
      const b=proj([x,floor,z]),pk=proj([x,floor+h,z]);
      if(!(b&&pk)){flush();continue}
      peaks.push(pk);bases.push(b);
    }
    flush();
  };
  drawLayer(1);
  drawLayer(0);
}

// Draw a straight, evenly sampled line on the flat plains using exactly the same
// first/last near-plane samples as the old per-point loop. Perspective preserves a
// 3-D straight line as a screen-space straight line, so projecting the two surviving
// endpoints produces the same visible grid geometry without projecting every 8-unit
// intermediate sample.
function drawFlatSampledGridLine(a,b,segments,near=.18){
  if(segments<1)return false;
  const qa=camPoint(a),qb=camPoint(b),dz=(qb[2]-qa[2])/segments;
  let first=0,last=segments;
  if(Math.abs(dz)<1e-12){
    if(qa[2]<=near)return false
  }else if(dz>0){
    if(qb[2]<=near)return false;
    if(qa[2]<=near)first=Math.max(0,Math.floor((near-qa[2])/dz)+1)
  }else{
    if(qa[2]<=near)return false;
    if(qb[2]<=near)last=Math.min(segments,Math.ceil((near-qa[2])/dz)-1)
  }
  if(last<=first)return false;
  const inv=1/segments;
  const q0=[
    qa[0]+(qb[0]-qa[0])*(first*inv),
    qa[1]+(qb[1]-qa[1])*(first*inv),
    qa[2]+(qb[2]-qa[2])*(first*inv)
  ];
  const q1=[
    qa[0]+(qb[0]-qa[0])*(last*inv),
    qa[1]+(qb[1]-qa[1])*(last*inv),
    qa[2]+(qb[2]-qa[2])*(last*inv)
  ];
  const p0=projectCam(q0),p1=projectCam(q1);if(!(p0&&p1))return false;
  ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);return true
}

class SurfaceDestinationApproachController {
  constructor(){this.reset()}
  reset(){
    this.active=false;this.stage=null;this.terrain='plains';this.destination='city';this.scenery='forest';
    this.groundY=-3.50;this.routeLength=430;this.targetWorldZ=430;this.targetX=0;
    this.speed=22.0;this.navPulse=0;this.seed=0x504c4149;this.trees=[];this.skyline=[];this.forestBands=[];this.forestFront=[];this.treeHitCD=0;
    this.visibleTrees=[];this.visibleForestFront=[];
    this.baseCache=new WeakMap();this.finishing=false;this.finishT=0;this.entryRadius=36;
    this.lastHandoff=null;this.manualComplete=false
  }
  rand(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
  // Shared surface-object mechanism. Environments and missions submit discrete
  // world objects here; the compositor owns their far-to-near ordering.
  appendWorldObject(scene,{x=0,y=0,worldZ=0,draw,minDepth=.18,maxDepth=Infinity,sortBias=0}={}){
    if(!Array.isArray(scene)||typeof draw!=='function')return false;
    const d=camPoint([x,y,worldZ-travel])[2];
    if(!(d>minDepth&&d<=maxDepth))return false;
    scene.push({z:d+sortBias,draw});return true
  }
  drawObjectScene(scene){
    if(!Array.isArray(scene)||!scene.length)return;
    scene.sort((a,b)=>b.z-a.z);for(const it of scene)it.draw()
  }
  sceneryReserved(x,wz,padding=0){
    const zones=this.stage?.reservedSceneryZones;if(!Array.isArray(zones))return false;
    for(const zone of zones){
      if(!zone)continue;const type=zone.type||'box';
      if(type==='box'){
        const cx=Number(zone.centerX)||0,cz=Number(zone.centerZ)||0,hw=Math.max(0,Number(zone.halfWidth)||0)+padding,hd=Math.max(0,Number(zone.halfDepth)||0)+padding;
        if(Math.abs(x-cx)<=hw&&Math.abs(wz-cz)<=hd)return true
      }else if(type==='circle'){
        const cx=Number(zone.centerX)||0,cz=Number(zone.centerZ)||0,r=Math.max(0,Number(zone.radius)||0)+padding;
        if((x-cx)*(x-cx)+(wz-cz)*(wz-cz)<=r*r)return true
      }else if(type==='corridor'){
        const x0=Number(zone.x0)||0,z0=Number(zone.z0)||0,x1=Number(zone.x1)||0,z1=Number(zone.z1)||0;
        const vx=x1-x0,vz=z1-z0,l2=vx*vx+vz*vz,t=l2>1e-9?clamp(((x-x0)*vx+(wz-z0)*vz)/l2,0,1):0;
        const px=x0+vx*t,pz=z0+vz*t,r=Math.max(0,Number(zone.halfWidth)||0)+padding;
        if((x-px)*(x-px)+(wz-pz)*(wz-pz)<=r*r)return true
      }
    }
    return false
  }
  prepare(stage){
    this.reset();this.active=true;this.stage=globalThis.AgentXEnvironments?.resolve?.(stage||{})||(stage||{});
    const resolved=this.stage;
    this.terrain=resolved?.terrain||'plains';this.destination=resolved?.destination||'city';this.scenery=resolved?.scenery||(this.destination==='swamp'?'swamp':'forest');
    this.routeLength=Math.max(240,Number(resolved?.routeLength)||430);
    this.targetWorldZ=Number.isFinite(Number(resolved?.targetWorldZ))?Number(resolved.targetWorldZ):this.routeLength;
    this.targetX=Number.isFinite(Number(resolved?.targetX))?Number(resolved.targetX):0;
    this.entryRadius=clamp(Number(resolved?.entryRadius)||36,24,60);
    this.buildScenery();
    if(this.destination==='forest')this.buildForestBoundary();
    else if(this.destination==='swamp')this.buildSwampBoundary();
    else if(this.destination==='bunker'||this.destination==='osd'){this.skyline.length=0;this.forestBands.length=0;this.forestFront.length=0}
    else this.buildSkyline()
  }
  meshBaseY(mesh){
    if(this.baseCache.has(mesh))return this.baseCache.get(mesh);
    let y=0;if(mesh?.v?.length)y=Math.min(...mesh.v.map(v=>v[1]));this.baseCache.set(mesh,y);return y
  }
  buildScenery(){
    this.trees.length=0;this.seed=0x504c4149;
    const rockMode=this.scenery==='rocks';
    const swamp=this.scenery==='swamp';
    const registry=swamp?globalThis.AgentXAlienSwampScenery:globalThis.AgentXForestScenery;
    const ids=swamp
      ?['swampReedTall','swampReedFan','swampReedWide','swampReedSpike','alienBulbPlantConnected','alienUmbrellaPlantConnected','alienEggPodFat','alienEggClusterFat']
      :['pineTall','pineBroad','pineYoung','pineDeadSparse'];
    const addTree=(id,x,wz,scale)=>{
      const fallback=swamp?(typeof alienSwampSceneryMesh==='function'?alienSwampSceneryMesh(id):null):(typeof forestSceneryMesh==='function'?forestSceneryMesh(id):null);
      const baseMesh=registry?.get?.(id)||fallback;if(!baseMesh)return;
      // The swamp approach uses the existing non-hostile alien foliage assets in the
      // same clump generator as the forest plains. No spitter-flower combat actors are
      // created here; this is scenery only.
      const mesh=swamp?baseMesh:forestShortTrunkMesh(baseMesh,id),y=this.groundY-this.meshBaseY(baseMesh)*scale;
      const obj={assetId:id,mesh,x,y,worldZ:wz,s:scale,rot:[0,this.rand()*Math.PI*2,0],col:resolvePaletteColor(baseMesh.singleColorKey)||C.g,hit:false};
      if(swamp&&String(id).startsWith('swampReed')){obj.my=1.55+this.rand()*.65;obj.mx=1.08+this.rand()*.22;obj.mz=1.0+this.rand()*.16}
      this.trees.push(obj)
    };
    const addRock=(x,wz,scale)=>{
      const mesh=asteroidMesh;if(!mesh)return;
      // Landmarks reserve physical space in the environment. Do not generate
      // rocks/trees there and then rely on a render-time hide/mask trick.
      if(this.sceneryReserved(x,wz,Math.max(1.5,scale*1.9)))return;
      const mx=1.05+this.rand()*1.25,my=.45+this.rand()*.62,mz=.95+this.rand()*1.1;
      const bury=.12+this.rand()*.18;
      const y=this.groundY-(this.meshBaseY(mesh)+bury)*scale*my;
      const col=C.o;
      const obj={kind:'rock',mesh,x,y,worldZ:wz,s:scale,rot:[(this.rand()-.5)*.28,this.rand()*Math.PI*2,(this.rand()-.5)*.24],col,mx,my,mz,hit:false};
      this.trees.push(obj)
    };
    const addClump=(centreX,centreWZ,count,xSpread,zSpread,baseScale=1,allowSingles=false)=>{
      for(let i=0;i<count;i++){
        const x=centreX+(this.rand()-.5)*xSpread,wz=centreWZ+(this.rand()-.5)*zSpread;
        if(rockMode)addRock(x,wz,baseScale*(.86+this.rand()*.46));
        else {
          const id=ids[Math.floor(this.rand()*ids.length)];
          addTree(id,x,wz,baseScale*(.88+this.rand()*.34))
        }
      }
      if(allowSingles&&this.rand()<.18){
        const sx=centreX+(this.rand()<.5?-1:1)*(xSpread*.85+2+this.rand()*5),sz=centreWZ+(this.rand()-.5)*(zSpread*1.6),ss=baseScale*(.84+this.rand()*.26);
        if(rockMode)addRock(sx,sz,ss);else addTree(ids[Math.floor(this.rand()*ids.length)],sx,sz,ss)
      }
    };
    const requestedClumps=Number(rockMode?(this.stage?.rockClumps??this.stage?.treeClumps):this.stage?.treeClumps);
    const clumps=clamp(Math.round(Number.isFinite(requestedClumps)?requestedClumps:9),0,18);
    if(clumps<=0)return;
    // Preserve the original route-side clumps. These are the nearer decorative groups
    // that keep the surface from reading as a billiard table.
    for(let c=0;c<clumps;c++){
      const u=38+(this.routeLength-92)*(c+.28+this.rand()*.44)/Math.max(1,clumps);
      const side=this.rand()<.5?-1:1,centreX=side*(12+this.rand()*30),count=rockMode?(2+Math.floor(this.rand()*3)):(3+Math.floor(this.rand()*4));
      addClump(centreX,u,count,rockMode?(12+this.rand()*8):8.0,rockMode?(10+this.rand()*8):9.0,rockMode?(1.12+this.rand()*.52):1.0,false)
    }
    // Fill the *sides* of the plains with grouped scenery rather than lone objects.
    // For the OSD delivery run this becomes desert-like rock clusters instead of trees.
    const sideClumps=Math.max(10,Math.min(18,clumps+6));
    for(const side of[-1,1])for(let c=0;c<sideClumps;c++){
      const centreWZ=-86+(this.routeLength+210)*(c+.12+this.rand()*.76)/sideClumps;
      const lane=(c%3),nearFar=lane===0?34:lane===1?56:82;
      const centreX=side*(nearFar+this.rand()*(lane===2?18:14));
      const count=rockMode?(2+Math.floor(this.rand()*3)+(lane===2?1:0)):(4+Math.floor(this.rand()*5)+(lane===2?1:0));
      const xSpread=rockMode?(10+this.rand()*12+(lane===2?5:0)):(6.5+this.rand()*6.0+(lane===2?4.0:0));
      const zSpread=rockMode?(12+this.rand()*16+(lane===2?10:0)):(10+this.rand()*14+(lane===2?8:0));
      const baseScale=rockMode?(1.02+this.rand()*.48):(.92+this.rand()*.28);
      addClump(centreX,centreWZ,count,xSpread,zSpread,baseScale,true)
    }
    // A few extra distant side masses keep the horizon from feeling empty without
    // creating another planted strip straight ahead.
    const farMasses=4+Math.floor(clumps*.35);
    for(const side of[-1,1])for(let i=0;i<farMasses;i++){
      const centreX=side*(78+this.rand()*48),centreWZ=this.routeLength-12+i*18+this.rand()*42;
      addClump(centreX,centreWZ,rockMode?(4+Math.floor(this.rand()*3)):(6+Math.floor(this.rand()*4)),rockMode?(18+this.rand()*16):(12+this.rand()*10),rockMode?(22+this.rand()*24):(18+this.rand()*20),rockMode?(1.08+this.rand()*.44):(.96+this.rand()*.24),false)
    }
  }
  buildSkyline(){
    this.skyline.length=0;
    const all=globalThis.AgentXCityBuildings?.list||[];
    const usable=all.filter(m=>m?.id!=='penthousehatchtower');
    const pick=()=>usable.length?usable[Math.floor(this.rand()*usable.length)]:null;
    // Broad skyline at the destination boundary. At very long range these are drawn
    // as simple tower boxes; as they approach, the real city meshes take over.
    for(let i=0;i<19;i++){
      const band=(i-9)/9;
      const mesh=pick();
      const h=11+this.rand()*17+(1-Math.abs(band))*7;
      const scale=mesh?h/Math.max(.001,mesh.cityHeight||6):1;
      const w=mesh?(mesh.cityWidth||3)*scale:(4+this.rand()*3);
      const d=mesh?(mesh.cityDepth||2)*scale:(4+this.rand()*4);
      const x=this.targetX+band*48+(this.rand()-.5)*4.5;
      const wz=this.targetWorldZ+22+this.rand()*72;
      const roll=this.rand();
      this.skyline.push({x,worldZ:wz,h,w,d,mesh,scale,col:roll>.90?C.w:(roll>.78?C.y:C.g)})
    }
  }
  buildForestBoundary(){
    this.skyline.length=0;this.forestBands.length=0;this.forestFront.length=0;
    this.seed=0x46525354;
    // The destination forest is made from real pine geometry, not a mountain-like
    // canopy silhouette. Several staggered rows build a readable woodland mass at
    // distance while leaving a genuine opening around Forest Nav for the route in.
    const registry=globalThis.AgentXForestScenery,ids=['pineTall','pineBroad','pineYoung'];
    for(let row=0;row<3;row++)for(const side of [-1,1])for(let i=0;i<10;i++){
      const id=ids[Math.floor(this.rand()*ids.length)],base=registry?.get?.(id)||(typeof forestSceneryMesh==='function'?forestSceneryMesh(id):null);
      if(!base)continue;
      const scale=1.18+this.rand()*1.42+(i%5===0?.48:0),gap=6.8+row*1.15;
      const x=this.targetX+side*(gap+i*4.55+this.rand()*2.15);
      const wz=this.targetWorldZ+4+row*12+this.rand()*13;
      const mesh=forestShortTrunkMesh(base,id),y=this.groundY-this.meshBaseY(base)*scale;
      this.forestFront.push({assetId:id,mesh,x,y,worldZ:wz,s:scale,rot:[0,this.rand()*Math.PI*2,0]})
    }
  }
  buildSwampBoundary(){
    this.skyline.length=0;this.forestBands.length=0;this.forestFront.length=0;
    this.seed=0x5357414d;
    const registry=globalThis.AgentXAlienSwampScenery;
    const reeds=['swampReedTall','swampReedFan','swampReedWide','swampReedSpike'];
    const accents=['alienBulbPlantConnected','alienUmbrellaPlantConnected','alienEggPodFat','alienEggClusterFat'];
    for(let row=0;row<3;row++)for(const side of[-1,1])for(let i=0;i<11;i++){
      const accent=(i+row)%5===2,id=accent?accents[(i+row)%accents.length]:reeds[(i*3+row)%reeds.length];
      const base=registry?.get?.(id)||(typeof alienSwampSceneryMesh==='function'?alienSwampSceneryMesh(id):null);if(!base)continue;
      const scale=(accent?.98:1.18)+this.rand()*(accent?.42:.80),gap=7.4+row*1.4;
      const x=this.targetX+side*(gap+i*3.95+this.rand()*1.8),wz=this.targetWorldZ+3+row*11+this.rand()*12;
      const y=this.groundY-this.meshBaseY(base)*scale,obj={assetId:id,mesh:base,x,y,worldZ:wz,s:scale,rot:[0,this.rand()*Math.PI*2,0],col:resolvePaletteColor(base.singleColorKey)||C.g};
      if(String(id).startsWith('swampReed')){obj.my=1.65+this.rand()*.58;obj.mx=1.12+this.rand()*.20;obj.mz=1.0+this.rand()*.16}
      this.forestFront.push(obj)
    }
  }
  treeWithinTurnMargin(q,scale=1){
    // Reject trees well outside the current view before hidden-line removal. The
    // extra 22% screen-width guard band keeps scenery active ahead of a turn, while
    // avoiding the much larger off-screen workload of the previous 36% margin.
    if(!q||q[2]<=.3)return false;
    const f=Math.min(W,viewH)*1.09,k=f/q[2],px=W*.5+q[0]*k;
    const treePad=Math.min(W*.16,Math.max(16,3.2*scale*k));
    const turnPad=W*.22+treePad;
    return px>=-turnPad&&px<=W+turnPad
  }
  drawForestBoundary(){
    const front=this.visibleForestFront;front.length=0;
    for(const t of this.forestFront){
      const z=t.worldZ-travel,q=camPoint([t.x,t.y,z]),d=q[2];
      if(d>.3&&d<390&&this.treeWithinTurnMargin(q,t.s)){t._plainsDepth=d;t._plainsViewZ=z;front.push(t)}
    }
    front.sort((a,b)=>b._plainsDepth-a._plainsDepth);
    for(const t of front)drawLayeredForestTree({type:'forestApproachTree',assetId:t.assetId,x:t.x,y:t.y,z:t._plainsViewZ,s:t.s,rot:t.rot},t.mesh,t.assetId,.90)
  }
  begin(stage=this.stage){
    if(!this.active)this.prepare(stage);
    this.active=true;this.finishing=false;this.finishT=0;this.navPulse=0;this.lastHandoff=null;this.manualComplete=false;
    mode='play';phase='destinationApproach';modeT=phaseT=0;travel=0;
    fighters.length=0;asteroids.length=0;groundTargets.length=0;bolts.length=0;hazards.length=0;shots.length=0;playerMissiles.length=0;
    inputX=inputY=aimX=aimY=0;spaceYawVel=spacePitchVel=0;surfaceVX=surfaceVY=0;
    // Do not land neatly opposite the destination. Start laterally displaced and
    // looking farther away from it so the player actually has to acquire the marker.
    const side=this.rand()<.5?-1:1;
    shipX=side*(17+this.rand()*13);shipY=-1.42;
    viewYaw=side*(.28+this.rand()*.28);viewPitch=.015;viewRoll=0;
    audio.music.setMode('calm');
    if(this.destination==='swamp')say('PROCEED TO SWAMP',.85);
    else if(this.destination==='osd')say('PROCEED TO OSD FACILITY',.85);
    else audio.playVoice(this.destination==='forest'?'proceedToForest':'proceedToCity',{once:false,priority:true})
  }
  stopForJump(){this.active=false;this.finishing=false;this.trees.length=0;this.skyline.length=0;this.forestBands.length=0;this.forestFront.length=0}
  consumeHandoff(){const h=this.lastHandoff;this.lastHandoff=null;return h}
  distance(){return Math.hypot(this.targetX-shipX,this.targetWorldZ-travel)}
  bearing(){return Math.atan2(this.targetX-shipX,this.targetWorldZ-travel)}
  updateSteering(dt,magX,magY){
    if(!this.active||phase!=='destinationApproach')return;
    if(this.finishing){
      // Final city-limit convergence is gentle autopilot, not a teleport. It makes
      // the modular hand-off into the +Z city street continuous after an arbitrary
      // plains arrival heading.
      const err=wrapAngle(this.bearing()-viewYaw);
      viewYaw=wrapAngle(viewYaw+clamp(err,-.72*dt,.72*dt));
      shipX=lerp(shipX,this.targetX,clamp(dt*.62,0,1));
      inputX=moveToward(inputX,0,dt*3.5);inputY=moveToward(inputY,0,dt*3.5)
    }else{
      viewYaw=wrapAngle(viewYaw+magX*dt*1.24)
    }
    viewPitch=lerp(viewPitch,(this.finishing?0:magY*.30),clamp(dt*4.0,0,1));
    viewRoll=lerp(viewRoll,this.finishing?0:-magX*.42,clamp(dt*4.4,0,1));
    const runSpeed=this.speed*(this.finishing?.90:1),vx=Math.sin(viewYaw)*runSpeed,vz=Math.cos(viewYaw)*runSpeed;
    surfaceVX=vx;shipX+=vx*dt;travel+=vz*dt;surfaceDistance+=runSpeed*dt;
    const finishY=(this.destination==='forest'||this.destination==='swamp')?-1.88:-1.22;
    const targetY=this.finishing?finishY:(-1.48-magY*1.12),targetVY=clamp((targetY-shipY)*2.35,-2.8,2.8);
    surfaceVY=moveToward(surfaceVY,targetVY,dt*4.6);shipY+=surfaceVY*dt
  }
  update(dt){
    if(!this.active||phase!=='destinationApproach')return;
    this.navPulse+=dt;this.treeHitCD=Math.max(0,this.treeHitCD-dt);
    if(this.treeHitCD<=0){
      for(const t of this.trees){
        if(t.hit)continue;const dz=t.worldZ-travel,dx=t.x-shipX,radius=.34+.34*t.s,top=this.groundY+4.8*t.s;
        if(Math.abs(dz)<1.15&&Math.abs(dx)<radius&&shipY<top){t.hit=true;this.treeHitCD=.82;damage(t.kind==='rock'?'ROCK':'TREE');if(mode==='dead')return;break}
      }
    }
    const d=this.distance();
    if(!this.finishing&&d<78){this.finishing=true;this.finishT=0;say(this.destination==='forest'?'FOREST EDGE':(this.destination==='swamp'?'SWAMP EDGE':(this.destination==='osd'?'OSD FACILITY AHEAD':'CITY LIMITS')),.60)}
    if(this.finishing){
      this.finishT+=dt;
      const headingError=Math.abs(wrapAngle(this.bearing()-viewYaw));
      if(d<=this.entryRadius&&(headingError<.20||this.finishT>2.8)){
        this.lastHandoff={x:shipX,y:shipY,yaw:viewYaw,pitch:viewPitch,roll:viewRoll,distance:d,destination:this.destination};
        if(this.stage?.manualCompletion)this.manualComplete=true;
        else scenarioFlow.completeCurrentStage()
      }
    }
  }
  drawGround(){
    surfaceMask(this.groundY,560);
    const spacing=8,far=250,x0=Math.floor((shipX-far)/spacing)*spacing,x1=shipX+far;
    const wz0=Math.floor((travel-far)/spacing)*spacing,wz1=travel+far;
    const nx=Math.floor((x1-x0)/spacing),nz=Math.floor((wz1-wz0)/spacing);
    const xLast=x0+nx*spacing,wzLast=wz0+nz*spacing;
    const gridCol=this.destination==='osd'?C.o:C.gd,baseCol=this.destination==='osd'?C.o:C.g;
    ctx.save();ctx.strokeStyle=gridCol;ctx.lineWidth=VECTOR_LINE_WIDTH;ctx.globalAlpha=.55;ctx.beginPath();let any=false;
    for(let ix=0;ix<=nx;ix++){
      const x=x0+ix*spacing;
      if(drawFlatSampledGridLine([x,this.groundY,wz0-travel],[x,this.groundY,wzLast-travel],nz))any=true
    }
    for(let iz=0;iz<=nz;iz++){
      const wz=wz0+iz*spacing;
      if(drawFlatSampledGridLine([x0,this.groundY,wz-travel],[xLast,this.groundY,wz-travel],nx))any=true
    }
    if(any)ctx.stroke();ctx.restore();
    drawSharedSurfaceHorizon(this.groundY,405,1,gridCol,baseCol)
  }
  appendScenery(scene,{minDepth=-Infinity,maxDepth=Infinity}={}){
    if(!Array.isArray(scene))return scene;
    for(const t of this.trees){
      const z=t.worldZ-travel,q=camPoint([t.x,t.y,z]),d=q[2];
      if(!(d>.3&&d<205&&d>minDepth&&d<=maxDepth&&this.treeWithinTurnMargin(q,t.s*Math.max(t.mx||1,t.mz||1))))continue;
      // Store the camera depth on the painter entry, not as render order hidden
      // inside drawTrees(). This lets a destination object (the tutorial bunker)
      // and its foreground scenery participate in one far-to-near surface list.
      scene.push({z:d,draw:()=>{
        if(t.kind==='rock'){
          drawMesh({type:'plainsRock',x:t.x,y:t.y,z,s:t.s,mx:t.mx||1,my:t.my||1,mz:t.mz||1,rot:t.rot||[0,0,0]},t.mesh,t.col||C.o,clamp(1.02-d/220,.28,.84));
          return
        }
        drawLayeredForestTree({type:'plainsTree',assetId:t.assetId,x:t.x,y:t.y,z,s:t.s,rot:t.rot},t.mesh,t.assetId,.88)
      }})
    }
    return scene
  }
  appendTrees(scene,options={}){return this.appendScenery(scene,options)} // compatibility
  drawTrees(options={}){
    const scene=[];this.appendScenery(scene,options);this.drawObjectScene(scene)
  }
  appendSkyline(scene){
    if(this.destination==='osd')return scene;
    if(this.destination==='forest'||this.destination==='swamp'){
      for(const t of this.forestFront){
        const z=t.worldZ-travel,q=camPoint([t.x,t.y,z]),d=q[2];
        if(!(d>.3&&d<390&&this.treeWithinTurnMargin(q,t.s)))continue;
        scene.push({z:d,draw:()=>drawLayeredForestTree({type:'forestApproachTree',assetId:t.assetId,x:t.x,y:t.y,z:t.worldZ-travel,s:t.s,rot:t.rot},t.mesh,t.assetId,.90)})
      }
      return scene
    }
    for(const b of this.skyline){
      const z=b.worldZ-travel,d=camPoint([b.x,this.groundY+b.h*.5,z])[2];if(d<=.3||d>560)continue;
      scene.push({z:d,draw:()=>{
        if(d>135)drawMesh({type:'citySkylineOccluder',x:b.x,y:this.groundY+b.h*.5,z,s:.5,mx:b.w,my:b.h,mz:b.d,rot:[0,0,0]},courierFixtureBoxMesh,'#000',1);
        if(d>305||!b.mesh)drawMesh({type:'farCityTower',x:b.x,y:this.groundY+b.h*.5,z,s:.5,mx:b.w,my:b.h,mz:b.d,rot:[0,0,0]},courierFixtureBoxMesh,b.col,clamp(1.05-d/720,.38,.72));
        else jackalDelivery.drawBuilding(b,d)
      }})
    }
    return scene
  }
  drawSkyline(){const scene=[];this.appendSkyline(scene);this.drawObjectScene(scene)}
  appendEnvironmentObjects(scene){this.appendSkyline(scene);this.appendScenery(scene);return scene}
  drawNavigation(){
    const q=camPoint([this.targetX,this.groundY+6.8,this.targetWorldZ-travel]);
    const p=q[2]>.2?projectCam(q):null,on=!!(p&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=viewH);
    if(on){
      const pulse=1.5+Math.sin(this.navPulse*4.2)*1.5,r=9+pulse;
      line(p.x,p.y-r,p.x+r,p.y,C.y,1.15,.92);line(p.x+r,p.y,p.x,p.y+r,C.y,1.15,.92);
      line(p.x,p.y+r,p.x-r,p.y,C.y,1.15,.92);line(p.x-r,p.y,p.x,p.y-r,C.y,1.15,.92);
      line(p.x-3,p.y,p.x+3,p.y,C.c,1,.9);line(p.x,p.y-3,p.x,p.y+3,C.c,1,.9);
      const navLabel=this.destination==='bunker'?'BUNKER NAV':(this.destination==='forest'?'FOREST NAV':(this.destination==='swamp'?'SWAMP NAV':(this.destination==='osd'?'OSD NAV':'CITY NAV')));
      ctx.textAlign='center';ctx.font='400 8px Consolas,monospace';ctx.strokeStyle=C.y;ctx.strokeText(navLabel,p.x,p.y-r-7);ctx.textAlign='left'
    }else{
      const edge=hudEdgeCue(q,0),x=edge.x,y=edge.y,dx=edge.dx,dy=edge.dy,tx=-dy,ty=dx,depth=8,width=12,bx=x-dx*depth;
      line(bx+tx*width*.5,y-dy*depth+ty*width*.5,x,y,C.y,1.3,.88);line(x,y,bx-tx*width*.5,y-dy*depth-ty*width*.5,C.y,1.3,.88)
    }
  }
  draw(){
    this.drawGround();const scene=[];this.appendEnvironmentObjects(scene);
    if(this.destination==='osd'&&bunkerRaid?.active)bunkerRaid.appendOsdSurfaceObjects(scene);
    this.drawObjectScene(scene);this.drawNavigation()
  }
  hudRight(){
    const label=this.destination==='bunker'?'BUNKER':(this.destination==='forest'?'FOREST':(this.destination==='swamp'?'SWAMP':(this.destination==='osd'?'OSD':'CITY')));
    return this.active?`${label} ${Math.max(0,Math.round(this.distance()))}`:''
  }
}



// ---------- VOX simulator: final navigation / bunker / reactor run ----------
// This is one continuous tutorial stage built from the normal deep-core machinery:
// normal planet approach, open-surface flight, the established bunker autopilot,
// tunnel barriers, reactor, exit door and surface-to-space extraction.
const tutorialFinalRun={
  active:false,stage:null,step:'idle',reminderKey:null,reminderT:0,reminderArmed:false,completionVoicePlayed:false,
  isActive(){return !!(this.active&&campaign.currentMission?.training&&campaign.currentStage?.()?.tutorialFinalRun)},
  isSurfaceActive(){return !!(this.isActive()&&phase==='surface'&&mode==='play')},
  reset(){this.active=false;this.stage=null;this.step='idle';this.reminderKey=null;this.reminderT=0;this.reminderArmed=false;this.completionVoicePlayed=false},
  begin(stage){
    this.reset();this.active=true;this.stage=stage||{};this.step='descent';
    campaign.clearActiveLoadout();campaign.updateGearHud();
    shield=campaign.maxShield();shieldRegenDelay=0;shieldRegenTick=0;shieldRestoreFlashIndex=-1;shieldRestoreFlashT=0;hud();
    fighters.length=0;bolts.length=0;groundTargets.length=0;hazards.length=0;shots.length=0;playerMissiles.length=0;
    resetPlanetBearing();resetSpaceMotion();
    beginApproach()
  },
  setObjective(key,{repeat=true}={}){
    // Some tutorial instructions benefit from a reminder if the player has not yet
    // demonstrated the action. Purely descriptive corridor guidance does not: once
    // the player is already flying the tunnel, repeating "avoid obstacles" adds
    // nothing and sounds mechanical.
    this.reminderKey=repeat?key:null;this.reminderT=repeat?10:0;this.reminderArmed=false;
    audio.playVoice(key,{once:false,priority:false})
  },
  clearObjective(key){
    this.reminderKey=null;this.reminderT=0;this.reminderArmed=false;
    completeTutorialObjective(key)
  },
  updateReminder(dt){
    if(!this.reminderKey)return;
    if(!this.reminderArmed){
      if(audio.voicePlaying||audio.voiceQueue?.length||audio.voiceDelayTimer||audio.objectiveCuePendingOrBusy?.())return;
      this.reminderArmed=true;this.reminderT=10;return
    }
    this.reminderT-=dt;if(this.reminderT>0)return;
    if(audio.voicePlaying||audio.voiceQueue?.length||audio.voiceDelayTimer||audio.objectiveCuePendingOrBusy?.())return;
    audio.playVoice(this.reminderKey,{once:false,priority:false});this.reminderT=10;this.reminderArmed=false
  },
  beginSurface(){
    if(!this.isActive())return false;
    this.step='navigation';spaceOrientationReady=false;spaceYawVel=spacePitchVel=0;
    mode='play';phase='surface';phaseT=0;modeT=0;travel=0;
    surfaceNeutralYaw=viewYaw;surfaceNeutralPitch=viewPitch;
    inputX=inputY=aimX=aimY=0;surfaceVX=0;surfaceVY=0;surfaceDistance=0;
    surfaceSpawn=999;shots.length=0;playerMissiles.length=0;fighters.length=0;groundTargets.length=0;bolts.length=0;hazards.length=0;
    // Put the target well ahead but noticeably off the initial heading so the nav
    // marker has a real job to do. Unlike the combat surface, no distance collapse occurs.
    const side=Math.random()<.5?-1:1;
    entryBunkerWorldZ=318;entryBunkerX=side*(62+Math.random()*18);
    tunnelOriginX=entryBunkerX;tunnelStartWorld=entryBunkerWorldZ+.65;surfaceBunkerActive=true;
    bunkerDoorHp=BUNKER_DOOR_BASE_HP;bunkerDoorOpen=false;doorFlash=0;doorBreachAt=-1;doorBreachPending=0;doorPylonsDestroyed=BUNKER_PYLON_GOAL;
    reactorBoundaryWorld=escapeBoundaryWorld=exitDoorWorld=Infinity;reactorAnnounced=false;
    // Reuse the established plains/tree/nav renderer, but point it at the bunker.
    surfaceDestination.prepare({terrain:'plains',destination:'bunker',routeLength:318,treeClumps:11,entryRadius:36});
    surfaceDestination.targetX=entryBunkerX;surfaceDestination.targetWorldZ=entryBunkerWorldZ;surfaceDestination.destination='bunker';surfaceDestination.navPulse=0;
    this.setObjective('tutorialFollowNav');hud();return true
  },
  updateSurface(dt){
    if(!this.isSurfaceActive())return false;
    surfaceDestination.navPulse+=dt;
    const dist=surfaceBunkerDistance(),bz=entryBunkerZ(),q=camPoint([entryBunkerX,-2.2,bz]),bp=q[2]>.18?projectCam(q):null;
    const lined=bp&&bp.x>W*.18&&bp.x<W*.82&&bp.y>viewH*.12&&bp.y<viewH*.88;
    if(dist<148&&q[2]>22&&lined){
      this.clearObjective('tutorialFollowNav');this.step='entry';beginTrenchEntry();return true
    }
    return false
  },
  onTunnelBegin(){
    if(!this.isActive())return;
    // The plains helper has finished its job; retire its HUD ownership once the
    // drone is physically inside the bunker so tunnel HUD data is not polluted.
    surfaceDestination.active=false;
    this.step='corridor';this.setObjective('tutorialAvoidCorridor',{repeat:false})
  },
  onReactorReached(){
    if(!this.isActive())return;
    this.clearObjective('tutorialAvoidCorridor');this.step='reactor';this.setObjective('tutorialDestroyReactor')
  },
  onReactorDestroyed(){
    if(!this.isActive()||this.step!=='reactor')return;
    this.clearObjective('tutorialDestroyReactor');this.step='escape'
  },
  update(dt){if(this.isActive())this.updateReminder(dt)},
  drawSurfaceScene(showNav=true,{deferObjects=false}={}){
    if(!this.isActive())return false;
    surfaceDestination.drawGround();
    if(!deferObjects)surfaceDestination.drawTrees();
    if(showNav&&this.step==='navigation')surfaceDestination.drawNavigation();return true
  },
  beginCompletionZoom(){
    if(!this.isActive()||this.completionVoicePlayed)return;
    this.completionVoicePlayed=true;this.step='complete';audio.playVoice('tutorialTrainingComplete',{once:false,priority:true})
  },
  completionSpeechBusy(){return !!(this.isActive()&&(audio.voicePlaying||audio.voiceQueue?.length||audio.voiceDelayTimer||audio.objectiveCuePendingOrBusy?.()))},
  protectShieldFloor(){return !!this.isActive()}
};

// v192 — Forest corridor test stage.
// This is deliberately built as an open-air cousin of the tunnel: forward travel
// follows a fixed bending/undulating route, but the ground is the ordinary vector
// grid and the lateral boundaries are dense tree banks rather than solid walls.
