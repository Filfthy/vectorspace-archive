'use strict';

// Carrier Intercept (story mission 11) — Rogue Carrier B "Manta".
//
// Three phases, built for Starstrike's forward-flying controls:
//   1 FIGHT  — the carrier holds the area on a slow, turning cruise while its escort
//              engages X. Its turrets track X and fire heavy rounds on their own
//              budget; reserves drop from the ventral hangar. Turrets are red and
//              shootable throughout.
//   2 FLEE   — when the escort dies the carrier lights its engines and runs directly
//              away. X chases from behind: the stern vents turn red; each one knocks
//              thrust down a step. Losing touch triggers a warning, a countdown and
//              mission failure. All vents and turrets must go.
//   3 BOARD  — defenceless and limping (still moving), the stern hatch turns red.
//              Blowing it off hands over to autopilot: match velocity, enter the
//              hatch, fly the keel corridor to the core terminal, download the nav
//              core. The scuttle charge arms; turn, sprint out, flip, and watch the
//              hull break into sections that drift apart in 3-D.
//
// Colour: magenta hull, red for anything shootable, cyan for the terminal/opening,
// white exhaust. 1 px lines, no depth fades; only disintegrating fragments fade.
// Local model units: X left/right, Y up, Z fore/aft, bow toward -Z.

const CARRIER_HULL_COL=C.m,CARRIER_PORT_COL=C.c,CARRIER_FX_COL=C.w;

// ---------------------------------------------------------------------------
// Geometry
function carrierMeshBuilder(){
  const v=[],e=[],faces=[],edgeSet=new Set();
  const V=p=>{v.push([p[0],p[1],p[2]]);return v.length-1};
  const E=(a,b)=>{if(a===b)return;const k=a<b?`${a},${b}`:`${b},${a}`;if(edgeSet.has(k))return;edgeSet.add(k);e.push([a,b])};
  const F=ids=>{faces.push(ids);for(let i=0;i<ids.length;i++)E(ids[i],ids[(i+1)%ids.length])};
  const loft=(rings,{capStart=true,capEnd=true}={})=>{
    const idx=rings.map(r=>Array.isArray(r[0])?r.map(V):[V(r)]);
    for(let k=0;k<idx.length-1;k++){
      const A=idx[k],B=idx[k+1];
      if(A.length===1){for(let i=0;i<B.length;i++)F([A[0],B[(i+1)%B.length],B[i]]);continue}
      if(B.length===1){for(let i=0;i<A.length;i++)F([A[i],A[(i+1)%A.length],B[0]]);continue}
      for(let i=0;i<A.length;i++){const j=(i+1)%A.length;F([A[i],A[j],B[j],B[i]])}
    }
    if(capStart&&idx[0].length>2)F([...idx[0]].reverse());
    if(capEnd&&idx[idx.length-1].length>2)F(idx[idx.length-1]);
    return idx
  };
  const line=(a,b)=>E(V(a),V(b));
  const poly=pts=>{const ids=pts.map(V);for(let i=0;i<ids.length;i++)E(ids[i],ids[(i+1)%ids.length])};
  const ring=(cx,cy,z,rx,ry,n,off=0)=>Array.from({length:n},(_,i)=>{const t=off+Math.PI*2*i/n;return[cx+Math.cos(t)*rx,cy+Math.sin(t)*ry,z]});
  return{v,e,faces,V,E,F,loft,line,poly,ring,mesh(name){return{name,v,e,faces}}}
}

const MANTA={
  nose:[0,.02,-4.4],ridgeF:[0,.46,-1.6],ridgeA:[0,.50,2.6],
  tipP:[-2.5,0,1.6],tipS:[2.5,0,1.6],rearP:[-1.45,.18,3.2],rearS:[1.45,.18,3.2],rearTop:[0,.50,3.2],
  kF:[0,-.22,-3.6],kP:[-1.7,-.30,1.3],kS:[1.7,-.30,1.3],kRP:[-1.25,-.30,3.2],kRS:[1.25,-.30,3.2],
  sternZ:3.2,mouthsX:[-.95,-.32,.32,.95],mouthY:-.05
};

function buildMantaHull(){
  const B=carrierMeshBuilder(),M=MANTA,P={};
  for(const k of['nose','ridgeF','ridgeA','tipP','tipS','rearP','rearS','rearTop','kF','kP','kS','kRP','kRS'])P[k]=B.V(M[k]);
  const F=B.F;
  F([P.nose,P.tipS,P.ridgeF]);F([P.nose,P.ridgeF,P.tipP]);
  F([P.ridgeF,P.tipS,P.ridgeA]);F([P.ridgeF,P.ridgeA,P.tipP]);
  F([P.ridgeA,P.tipS,P.rearS]);F([P.ridgeA,P.rearS,P.rearTop]);F([P.ridgeA,P.rearTop,P.rearP]);F([P.ridgeA,P.rearP,P.tipP]);
  F([P.nose,P.kF,P.tipS]);F([P.nose,P.tipP,P.kF]);F([P.kF,P.kS,P.tipS]);F([P.kF,P.tipP,P.kP]);F([P.kF,P.kP,P.kS]);
  F([P.kP,P.kRP,P.kRS,P.kS]);F([P.kS,P.kRS,P.rearS,P.tipS]);F([P.kP,P.tipP,P.rearP,P.kRP]);
  F([P.rearP,P.rearTop,P.rearS,P.kRS,P.kRP]);
  // Raised bridge fused to the aft ridge.
  B.loft([[[-.26,.47,1.1],[.26,.47,1.1],[.20,.84,1.55],[-.20,.84,1.55]],[[-.30,.49,2.5],[.30,.49,2.5],[.22,.90,2.35],[-.22,.90,2.35]]]);
  // Four recessed engine mouths in the stern face.
  for(const ex of M.mouthsX){
    const o=B.ring(ex,M.mouthY,M.sternZ+.005,.22,.16,8,Math.PI/8).map(B.V),d=B.ring(ex,M.mouthY,M.sternZ-.25,.22,.16,8,Math.PI/8).map(B.V);
    for(let k=0;k<8;k++){const j=(k+1)%8;F([o[k],o[j],d[j],d[k]])}F([...d].reverse())
  }
  // Ventral hangar mouth under the nose.
  B.poly([[-.42,-.282,-.1],[.42,-.282,-.1],[.46,-.297,1.0],[-.46,-.297,1.0]]);
  B.poly([[-.32,-.28,.02],[.32,-.28,.02],[.35,-.294,.88],[-.35,-.294,.88]]);
  return B.mesh('Rogue Carrier B — Manta (hull)')
}

// Turret in its own local frame: origin on the mounting surface, up +Y, barrels
// toward -Z. Body and barrels are separate so the barrels can elevate.
const CARRIER_TURRET_PIVOT=[0,.17,-.10];
function buildCarrierTurretBody(){
  const B=carrierMeshBuilder(),r=.20;
  B.loft([B.ring(0,0,0,r,r,6).map(p=>[p[0],-.08,p[1]]),B.ring(0,0,0,r,r,6).map(p=>[p[0],.10,p[1]])]);
  B.loft([[[-.14,.10,.14],[.14,.10,.14],[.10,.23,.10],[-.10,.23,.10]],[[-.12,.10,-.14],[.12,.10,-.14],[.07,.23,-.08],[-.07,.23,-.08]]]);
  return B.mesh('Carrier turret body')
}
function buildCarrierTurretBarrels(){
  const B=carrierMeshBuilder(),t=.022,[px,py,pz]=CARRIER_TURRET_PIVOT;
  for(const bx of[-.05,.05])B.loft([[[bx-t,py-t,pz],[bx+t,py-t,pz],[bx+t,py+t,pz],[bx-t,py+t,pz]],[[bx-t,py-t,pz-.50],[bx+t,py-t,pz-.50],[bx+t,py+t,pz-.50],[bx-t,py+t,pz-.50]]]);
  return B.mesh('Carrier turret barrels')
}
// Stern vent: a thin grilled plate proud of the stern face above an engine mouth.
function buildCarrierVent(ex){
  const B=carrierMeshBuilder(),z0=MANTA.sternZ-.01,z1=MANTA.sternZ+.035,y0=.14,y1=.25;
  B.loft([[[ex-.11,y0,z0],[ex+.11,y0,z0],[ex+.11,y1,z0],[ex-.11,y1,z0]],[[ex-.11,y0,z1],[ex+.11,y0,z1],[ex+.11,y1,z1],[ex-.11,y1,z1]]]);
  for(const y of[.165,.195,.225])B.line([ex-.08,y,z1+.002],[ex+.08,y,z1+.002]);
  return B.mesh('Carrier stern vent')
}

// Surface height of the hull at (x,z), top or bottom, from its real faces.
function carrierSurfaceY(hull,x,z,top=true){
  let best=null;
  for(const f of hull.faces){
    for(let i=1;i<f.length-1;i++){
      const A=hull.v[f[0]],B=hull.v[f[i]],Cc=hull.v[f[i+1]];
      const d=(B[2]-Cc[2])*(A[0]-Cc[0])+(Cc[0]-B[0])*(A[2]-Cc[2]);if(Math.abs(d)<1e-9)continue;
      const l1=((B[2]-Cc[2])*(x-Cc[0])+(Cc[0]-B[0])*(z-Cc[2]))/d,l2=((Cc[2]-A[2])*(x-Cc[0])+(A[0]-Cc[0])*(z-Cc[2]))/d,l3=1-l1-l2;
      if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;
      const y=l1*A[1]+l2*B[1]+l3*Cc[1];
      if(best==null||(top?y>best:y<best))best=y
    }
  }
  return best??0
}


// Stern access hatch: armoured plate between/above the engine mouths, facing aft
// so a pursuer can shoot it off from directly behind, and the corridor behind it
// runs forward along the keel to the core terminal.
const CARRIER_HATCH={x0:-.19,x1:.19,y0:.27,y1:.45,z:MANTA.sternZ};
function buildCarrierHatch(){
  const B=carrierMeshBuilder(),h=CARRIER_HATCH;
  B.loft([[[h.x0,h.y0,h.z-.01],[h.x1,h.y0,h.z-.01],[h.x1,h.y1,h.z-.01],[h.x0,h.y1,h.z-.01]],[[h.x0+.02,h.y0+.02,h.z+.045],[h.x1-.02,h.y0+.02,h.z+.045],[h.x1-.02,h.y1-.02,h.z+.045],[h.x0+.02,h.y1-.02,h.z+.045]]]);
  for(const [sx,sy] of[[0,0],[1,0],[1,1],[0,1]]){const x=sx?h.x1-.05:h.x0+.05,y=sy?h.y1-.05:h.y0+.05;B.line([x-.015,y,h.z+.047],[x+.015,y,h.z+.047])}
  return B.mesh('Carrier stern hatch')
}
function buildCarrierHatchOpening(){
  // Just the torn frame in the hull plane: the duct behind it is real interior
  // geometry, drawn hidden-line, so nothing here may reach inside the hull.
  const B=carrierMeshBuilder(),h=CARRIER_HATCH,z=h.z+.006;
  B.poly([[h.x0,h.y0,z],[h.x1,h.y0,z],[h.x1,h.y1,z],[h.x0,h.y1,z]]);
  return B.mesh('Carrier hatch opening')
}

// ---------------------------------------------------------------------------
// Interior: real geometry inside the hull, in the same carrier-local units, so the
// blown hatch looks straight into it and the autopilot flies in without a cut.
// A cramped maintenance duct runs forward from the stern hatch (ceiling conduits,
// cable tray, a bulkhead ring half way), then opens into a low service bay where the
// navigation core stands between floor and ceiling, fed by conduits, with a small
// service port and readout on its aft face.
const CARRIER_DUCT={x:.17,y0:.29,y1:.43,z0:MANTA.sternZ,z1:2.30,cy:.36};
const CARRIER_BAY={x:.42,y0:.12,y1:.40,z0:2.30,z1:1.50};
const CARRIER_CORE={x:0,z:1.84,r:.085,faceZ:1.84+.085*Math.cos(Math.PI/6)};
const CARRIER_STOP_Z=2.26;
function buildCarrierInterior(){
  const polys=[],lines=[],W=CARRIER_HULL_COL;
  const quad=(pts,col=W,detail=null)=>polys.push({pts,col,detail});
  const D=CARRIER_DUCT,B=CARRIER_BAY;
  // Duct shell, sectioned so the painter's sort stays honest along its length.
  const dz=[D.z0,3.08,2.96,2.84,2.72,2.60,2.48,D.z1];
  for(let i=0;i<dz.length-1;i++){
    const a=dz[i],b=dz[i+1],grate=[];for(const z of[a-(a-b)*.33,a-(a-b)*.66])grate.push([[-D.x,D.y0+.001,z],[D.x,D.y0+.001,z]]);
    quad([[-D.x,D.y0,a],[D.x,D.y0,a],[D.x,D.y0,b],[-D.x,D.y0,b]],W,grate);
    quad([[-D.x,D.y1,a],[-D.x,D.y1,b],[D.x,D.y1,b],[D.x,D.y1,a]]);
    quad([[-D.x,D.y0,a],[-D.x,D.y0,b],[-D.x,D.y1,b],[-D.x,D.y1,a]],W,[[[-D.x+.001,.335,a],[-D.x+.001,.335,b]]]);
    quad([[D.x,D.y0,a],[D.x,D.y1,a],[D.x,D.y1,b],[D.x,D.y0,b]]);
    // Cable tray along the port wall.
    quad([[-D.x,.318,a],[-D.x+.03,.318,a],[-D.x+.03,.318,b],[-D.x,.318,b]]);
  }
  // Flange: the hull plate between the blown aperture and the (smaller) duct mouth.
  {const h=CARRIER_HATCH,z=D.z0;
   quad([[h.x0,h.y0,z],[h.x1,h.y0,z],[D.x,D.y0,z],[-D.x,D.y0,z]]);
   quad([[-D.x,D.y1,z],[D.x,D.y1,z],[h.x1,h.y1,z],[h.x0,h.y1,z]]);
   quad([[h.x0,h.y0,z],[-D.x,D.y0,z],[-D.x,D.y1,z],[h.x0,h.y1,z]]);
   quad([[D.x,D.y0,z],[h.x1,h.y0,z],[h.x1,h.y1,z],[D.x,D.y1,z]])}
  // Square conduits along both upper corners of the duct, continuing into the bay.
  const pipe=(p0,p1,w=.011)=>{
    const d=v3norm(v3sub(p1,p0));let u=Math.abs(d[1])<.9?[0,1,0]:[1,0,0];const r=v3norm(v3cross(d,u));u=v3cross(r,d);
    const c=(p,sr,su)=>v3add(p,v3add(v3scale(r,sr*w),v3scale(u,su*w)));
    const ring=p=>[c(p,-1,-1),c(p,1,-1),c(p,1,1),c(p,-1,1)],A=ring(p0),Bq=ring(p1);
    for(let k=0;k<4;k++){const j=(k+1)%4;quad([A[k],A[j],Bq[j],Bq[k]])}
  };
  for(const sx of[-1,1]){
    for(let i=0;i<dz.length-1;i++)pipe([sx*.135,.405,dz[i]],[sx*.135,.405,dz[i+1]]);
    pipe([sx*.135,.405,D.z1],[sx*.07,.385,CARRIER_CORE.z+.02]);
  }
  // Bulkhead ring: the duct pinches through a frame half way along.
  const bz=2.72,ix=.135,iy0=.305,iy1=.415;
  quad([[-D.x,D.y0,bz],[D.x,D.y0,bz],[D.x,iy0,bz],[-D.x,iy0,bz]]);
  quad([[-D.x,iy1,bz],[D.x,iy1,bz],[D.x,D.y1,bz],[-D.x,D.y1,bz]]);
  quad([[-D.x,iy0,bz],[-ix,iy0,bz],[-ix,iy1,bz],[-D.x,iy1,bz]]);
  quad([[ix,iy0,bz],[D.x,iy0,bz],[D.x,iy1,bz],[ix,iy1,bz]]);
  // Service bay: low chamber, sectioned walls, grated floor.
  const bzs=[B.z0,2.03,1.76,B.z1];
  for(let i=0;i<bzs.length-1;i++){
    const a=bzs[i],b=bzs[i+1],grate=[];for(let x=-B.x+.08;x<B.x;x+=.08)grate.push([[x,B.y0+.001,a],[x,B.y0+.001,b]]);
    quad([[-B.x,B.y0,a],[B.x,B.y0,a],[B.x,B.y0,b],[-B.x,B.y0,b]],W,grate);
    quad([[-B.x,B.y1,a],[-B.x,B.y1,b],[B.x,B.y1,b],[B.x,B.y1,a]]);
    quad([[-B.x,B.y0,a],[-B.x,B.y0,b],[-B.x,B.y1,b],[-B.x,B.y1,a]],W,[[[-B.x+.001,.20,a],[-B.x+.001,.20,b]],[[-B.x+.001,.30,a],[-B.x+.001,.30,b]]]);
    quad([[B.x,B.y0,a],[B.x,B.y1,a],[B.x,B.y1,b],[B.x,B.y0,b]],W,[[[B.x-.001,.20,a],[B.x-.001,.20,b]],[[B.x-.001,.30,a],[B.x-.001,.30,b]]]);
  }
  quad([[-B.x,B.y0,B.z1],[-B.x,B.y1,B.z1],[B.x,B.y1,B.z1],[B.x,B.y0,B.z1]]);
  // Bay front wall around the duct mouth.
  const fz=B.z0;
  quad([[-B.x,B.y0,fz],[-D.x,B.y0,fz],[-D.x,B.y1,fz],[-B.x,B.y1,fz]]);
  quad([[D.x,B.y0,fz],[B.x,B.y0,fz],[B.x,B.y1,fz],[D.x,B.y1,fz]]);
  quad([[-D.x,D.y1,fz],[D.x,D.y1,fz],[D.x,B.y1,fz],[-D.x,B.y1,fz]]);
  quad([[-D.x,B.y0,fz],[D.x,B.y0,fz],[D.x,D.y0,fz],[-D.x,D.y0,fz]]);
  // Navigation core: hex column, floor to ceiling, with heavy collars.
  const hex=(y0,y1,r)=>{
    const P=(i,y)=>{const t=i*Math.PI/3;return[CARRIER_CORE.x+Math.cos(t)*r,y,CARRIER_CORE.z+Math.sin(t)*r]};
    for(let i=0;i<6;i++)quad([P(i,y0),P(i+1,y0),P(i+1,y1),P(i,y1)],W,bands?bandLines(P,i):null);
    polys.push({pts:Array.from({length:6},(_,i)=>P(i,y1)),col:W});
  };
  // Machinery detail on the core column: banding low down, panel seams on the
  // non-service faces. The aft face (i=1) keeps clear for the port and readout.
  const bandLines=(P,i)=>{
    const out=[],lift=(p,y)=>[p[0]+(p[0]-CARRIER_CORE.x)*.01,y,p[2]+(p[2]-CARRIER_CORE.z)*.01];
    for(const y of[.168,.192,.352])out.push([lift(P(i,y),y),lift(P(i+1,y),y)]);
    if(i!==1){const a=P(i,.2),b=P(i+1,.2),m=[(a[0]+b[0])/2,0,(a[2]+b[2])/2];out.push([lift([m[0],.2,m[2]],.2),lift([m[0],.345,m[2]],.345)])}
    return out
  };
  let bands=true;hex(B.y0,B.y1,CARRIER_CORE.r);bands=false;hex(B.y0,B.y0+.04,CARRIER_CORE.r*1.28);hex(B.y1-.04,B.y1,CARRIER_CORE.r*1.28);hex(.255,.265,CARRIER_CORE.r*1.1);
  // Feeds: ceiling conduits into the top collar, and one floor trunk to the port wall.
  pipe([-.30,B.y1-.012,2.10],[-.075,B.y1-.03,CARRIER_CORE.z]);pipe([.30,B.y1-.012,2.10],[.075,B.y1-.03,CARRIER_CORE.z]);
  pipe([0,B.y1-.012,B.z1],[0,B.y1-.03,CARRIER_CORE.z-.07]);
  pipe([-B.x,B.y0+.02,1.70],[-.09,B.y0+.02,CARRIER_CORE.z-.02],.016);
  return{polys,lines}
}

// ---------------------------------------------------------------------------
class RogueCarrierInterceptController{
  constructor(){this.reset()}
  reset(){
    this.active=false;this.stage=null;this.state='idle';this.t=0;this.stateT=0;
    this.carrier=null;this.heading=[0,0,1];this.speed=0;this.vents=[];this.turrets=[];this.hatch=null;
    this.escortsCleared=false;this.collisionCD=0;this.turnRate=0;this.fleeFrom=null;this.fleeTo=null;
    this.exteriorDockRoute=null;this.exteriorDockLeg=0;this.exteriorDockPhase='route';
    this.dataPackets=[];this.dataSpawnT=0;this.dataDraining=false;this.transferT=0;
    this.inside=false;this.turnStart=null;this.scuttleT=0;this.chaseGap=140;this._ipts=null;this.blasts=[];this.rays=[];this.hullFlash=0;this.cookEvents=null;this.breakCentre=null;this.recoil=0;this.frameMove=[0,0,0];this.dustVel=[0,0,0];
    this.exhaust=[];this.debris=[];this.fragments=[];this.rings=[];this.sections=[];
    this.leash='ok';this.lostT=0;this.announced={};this.launchSeen=new WeakSet()
  }
  cfg(){return this.stage||{}}
  num(k,d){const v=Number(this.cfg()[k]);return Number.isFinite(v)?v:d}
  static meshSet(){
    if(!RogueCarrierInterceptController.meshes){
      RogueCarrierInterceptController.meshes={hull:buildMantaHull(),turretBody:buildCarrierTurretBody(),turretBarrels:buildCarrierTurretBarrels(),
        vents:MANTA.mouthsX.map(buildCarrierVent),hatch:buildCarrierHatch(),hatchOpen:buildCarrierHatchOpening(),interior:buildCarrierInterior()}
    }
    return RogueCarrierInterceptController.meshes
  }

  prepare(stage){
    this.reset();this.active=true;this.stage=stage||{};
    const Ms=RogueCarrierInterceptController.meshSet(),hull=Ms.hull;
    const turretHp=Math.max(1,Math.round(this.num('turretHp',10))),ventHp=Math.max(1,Math.round(this.num('ventHp',8)));
    // All turrets sit aft so the chase view (from behind) can reach every one.
    const mounts=[['turretDorsalAft',0,2.95,1],['turretSternPort',-.9,2.45,1],['turretSternStbd',.9,2.45,1],['turretVentralAft',0,2.2,-1]];
    this.turrets=mounts.map(([id,x,z,sign])=>({id,kind:'turret',sign,pos:[x,carrierSurfaceY(hull,x,z,sign>0),z],normal:[0,sign,0],
      hp:turretHp,maxHp:turretHp,alive:true,hitFx:0,yaw:0,pitch:.15,fireCD:1.5+Math.random()*1.5,flash:0,radius:.30}));
    this.vents=MANTA.mouthsX.map((ex,i)=>({id:`vent${i+1}`,kind:'vent',mesh:Ms.vents[i],pos:[ex,.195,MANTA.sternZ+.035],normal:[0,0,1],
      mouth:[ex,MANTA.mouthY,MANTA.sternZ],hp:ventHp,maxHp:ventHp,alive:true,hitFx:0,radius:.16,emitT:Math.random()*.1}));
    const h=CARRIER_HATCH;
    this.hatch={id:'hatch',kind:'hatch',pos:[(h.x0+h.x1)/2,(h.y0+h.y1)/2,h.z+.045],normal:[0,0,1],hp:Math.max(1,Math.round(this.num('hatchHp',6))),alive:true,hitFx:0,radius:.26};
    return true
  }
  begin(stage=this.stage){
    if(!this.active||stage!==this.stage)this.prepare(stage);
    fighters.length=0;asteroids.length=0;bolts.length=0;groundTargets.length=0;hazards.length=0;shots.length=0;playerMissiles.length=0;
    shipX=shipY=0;inputX=inputY=aimX=aimY=0;spaceYawVel=spacePitchVel=0;viewYaw=viewPitch=viewRoll=0;
    resetPlanetBearing();resetSpaceDogfightDirector();
    scenarioFlow.startFighterStage(stage,'rogue');
    const w=cameraPointToWorld([this.num('spawnX',-150),this.num('spawnY',-30),Math.max(250,this.num('spawnDistance',430))]);
    const hl=Array.isArray(this.cfg().headingLocal)?this.cfg().headingLocal:[1,0,.15];
    this.carrier={x:w[0],y:w[1],z:w[2],s:Math.max(10,this.num('scale',26)),rot:[0,0,0]};
    this.setHeading(v3norm(cameraVectorToWorld(hl)));
    this.speed=this.num('holdSpeed',8);
    this.state='engage';this.t=0;this.stateT=0;
    audio.music.setMode('violent');
    say('CARRIER CONTACT · DESTROY ESCORT',.9);
    return true
  }
  stop(){const had=this.active;this.reset();if(had&&typeof resetSpaceMotes==='function')resetSpaceMotes()}
  setHeading(h){this.heading=v3norm(h);if(this.carrier)this.carrier.rot=[Math.asin(clamp(this.heading[1],-1,1)),Math.atan2(-this.heading[0],-this.heading[2]),0]}

  // ---- transforms ----
  localToWorld(p){const c=this.carrier;if(!c||!p)return null;const q=rotate([p[0]*c.s,p[1]*c.s,p[2]*c.s],c.rot);return[c.x+q[0],c.y+q[1],c.z+q[2]]}
  localDir(p){return v3norm(rotate(p,this.carrier?.rot||[0,0,0]))}
  worldToLocal(p){
    const c=this.carrier;if(!c||!p)return null;
    let q=[p[0]-c.x,p[1]-c.y,p[2]-c.z];q=rz(q,-c.rot[2]);q=ry(q,-c.rot[1]);q=rx(q,-c.rot[0]);
    const inv=1/Math.max(.001,c.s);return[q[0]*inv,q[1]*inv,q[2]*inv]
  }
  centre(){return this.carrier?[this.carrier.x,this.carrier.y,this.carrier.z]:null}
  distanceTo(p){return p?Math.hypot(p[0]-shipX,p[1]-shipY,p[2]):Infinity}
  toPlayerLocalDir(fromLocal){const lp=this.worldToLocal([shipX,shipY,0]);if(!lp)return[0,0,-1];return v3norm(v3sub(lp,fromLocal))}
  facing(localPos,localNormal,slack=.05){return v3dot(this.toPlayerLocalDir(localPos),localNormal)>slack}
  shift(delta){
    const c=this.carrier;if(!delta)return;
    this.frameMove[0]+=delta[0];this.frameMove[1]+=delta[1];this.frameMove[2]+=delta[2];
    if(c){c.x-=delta[0];c.y-=delta[1];c.z-=delta[2]}
    const mv=p=>{p[0]-=delta[0];p[1]-=delta[1];p[2]-=delta[2]};
    for(const p of this.exhaust)mv(p.p);for(const d of this.debris)mv(d.c);
    for(const f of this.fragments){mv(f.a);mv(f.b)}for(const r of this.rings)mv(r.c);for(const b of this.blasts)mv(b.c);for(const r of this.rays)mv(r.c);for(const s of this.sections)mv(s.c);if(this.breakCentre)mv(this.breakCentre)
  }
  moveWithPlayer(dt){const s=OPEN_SPACE_CRUISE*dt;this.shift([spaceMoveX*s,spaceMoveY*s,spaceMoveZ*s])}
  setCameraBasis(forward,up){
    spaceForward=v3norm(forward);spaceUp=v3norm(v3sub(up,v3scale(spaceForward,v3dot(up,spaceForward))));spaceRight=v3norm(v3cross(spaceUp,spaceForward));
    spaceOrientationReady=true;orthonormaliseSpaceOrientation();syncEulerFromSpaceOrientation();viewRoll=0;
    spaceMoveX=spaceForward[0];spaceMoveY=spaceForward[1];spaceMoveZ=spaceForward[2]
  }

  // ---- phase logic ----
  phase(){if(this.state==='engage')return 1;if(this.state==='flee')return 2;return 3}
  turretsAlive(){return this.turrets.filter(t=>t.alive).length}
  ventsAlive(){return this.vents.filter(v=>v.alive).length}
  hatchTargetable(){return this.state==='flee'&&this.hatch.alive&&this.ventsAlive()===0&&this.turretsAlive()===0}
  targetable(t){
    if(!t.alive)return false;
    if(t.kind==='turret')return this.state==='engage'||this.state==='flee';
    if(t.kind==='vent')return this.state==='flee';
    if(t.kind==='hatch')return this.hatchTargetable();
    return false
  }
  targets(){return[...this.turrets,...this.vents,this.hatch].filter(t=>t&&this.targetable(t))}
  thrustFraction(){
    if(this.state==='engage')return 1;
    const n=this.vents.length||1,lost=n-this.ventsAlive(),limp=this.num('limpFraction',.3);
    return lost>=n?limp:1-lost*(1-limp)/n*.9
  }
  // Chase gap: how far the stern is ahead of X along the carrier's track.
  sternGap(){const st=this.localToWorld([0,.2,MANTA.sternZ]);return st?v3dot(v3sub(st,[shipX,shipY,0]),this.heading):Infinity}
  updateChaseGap(dt){
    // The range is the chase: it opens or closes at the speed difference between the
    // carrier and X's cruise. It never closes inside boarding distance.
    const close=this.num('boardingGap',55);
    if(this.ventsAlive())this.chaseGap+=(this.speed-OPEN_SPACE_CRUISE)*dt;
    else this.chaseGap=moveToward(this.chaseGap,close,this.num('limpCloseRate',30)*dt);
    this.chaseGap=Math.max(close,this.chaseGap);
    const warn=this.num('escapeWarn',340),lost=this.num('escapeRange',520);
    if(this.chaseGap>warn)this.say1('escaping','carrierPullingAway','CARRIER ESCAPING · HIT THE VENTS');
    else if(this.chaseGap<warn*.85)this.announced.escaping=false;
    if(this.chaseGap>=lost)this.fail('Carrier escaped.')
  }
  // Carrier pace during the chase. With its engines intact it is FASTER than X, so the
  // range opens and it will escape; every vent destroyed takes a step off; with two
  // gone X starts to reel it in; crippled, it limps.
  chasePace(){
    const paces=Array.isArray(this.cfg().chaseSpeeds)?this.cfg().chaseSpeeds:[60,52,42,34];
    const alive=this.ventsAlive();if(!alive)return this.num('limpSpeed',12);
    return paces[Math.min(paces.length-1,this.vents.length-alive)]
  }
  wantedSpeed(){
    if(this.state==='engage')return this.num('holdSpeed',8);
    if(this.state==='flee')return this.chasePace();
    return this.num('limpSpeed',12)
  }
  combatActive(){return !!(this.active&&this.state==='engage')}
  // Phase 2 is an autopilot pursuit with free weapon aim (the bunker-breach rule):
  // the autopilot owns the flying, X owns the gun.
  chaseAutopilot(){return !!(this.active&&this.state==='flee')}
  flightLocked(){return this.chaseAutopilot()||this.autopilotActive()}
  autopilotActive(){return !!(this.active&&['dock','inside','download','alarm','turn','sprint','exitRun','flip','cookoff','breakup','complete'].includes(this.state))}
  ownsFrame(){return this.autopilotActive()}
  onEscortsCleared(){
    if(!this.active||this.escortsCleared)return;
    this.escortsCleared=true;
    if(typeof releaseSpaceLock==='function')releaseSpaceLock();
    if(typeof releaseSpacePursuit==='function')releaseSpacePursuit();
    if(this.state==='engage')this.beginFlee()
  }
  beginFlee(){
    // Escort gone: the carrier lights its engines and runs directly away from X.
    this.state='flee';this.stateT=0;this.fleeFrom=this.heading.slice();this.chaseGap=this.num('chaseStartGap',150);
    const away=v3sub(this.centre(),[shipX,shipY,0]);away[1]*=.25;this.fleeTo=v3norm(away);
    audio.playVoice('carrierFleeing',{once:false,priority:true});
    inputX=inputY=0;aimX=aimY=0;spaceYawVel=spacePitchVel=0;this.turnRate=0;
    say('CARRIER RUNNING · AUTOPILOT PURSUIT · WEAPONS FREE',.9)
  }
  checkHatchReady(){
    if(this.state==='flee'&&this.ventsAlive()===0&&this.turretsAlive()===0&&this.hatch.alive&&!this.announced.hatch){
      this.announced.hatch=true;SoundFX.objectiveComplete();audio.playVoice('carrierDefencesDown',{once:false,priority:true});say('CARRIER DEFENCELESS · BLOW THE STERN HATCH',.9)
    }
  }
  say1(key,voice,text){if(this.announced[key])return;this.announced[key]=true;if(voice)audio.playVoice(voice,{once:false,priority:true});if(text)say(text,.8)}

  // ---- turrets ----
  turretLocalVerts(t,mesh,barrels){
    const cy=Math.cos(t.yaw),sy=Math.sin(t.yaw),cp=Math.cos(t.pitch),sp=Math.sin(t.pitch),[,py,pz]=CARRIER_TURRET_PIVOT;
    return mesh.v.map(p=>{
      let [x,y,z]=p;
      if(barrels){const dy=y-py,dz=z-pz;y=py+dy*cp-dz*sp;z=pz+dy*sp+dz*cp}
      return[t.pos[0]+x*cy-z*sy,t.pos[1]+y*t.sign,t.pos[2]+x*sy+z*cy]
    })
  }
  turretMuzzleLocal(t){
    const [,py,pz]=CARRIER_TURRET_PIVOT,cp=Math.cos(t.pitch),sp=Math.sin(t.pitch),dz=-.52,y=py-dz*sp,z=pz+dz*cp,cy=Math.cos(t.yaw),sy=Math.sin(t.yaw);
    return[t.pos[0]-z*sy,t.pos[1]+y*t.sign,t.pos[2]+z*cy]
  }
  turretWorldVerts(t,barrels){const Ms=RogueCarrierInterceptController.meshSet();return this.turretLocalVerts(t,barrels?Ms.turretBarrels:Ms.turretBody,barrels).map(p=>this.localToWorld(p))}
  updateTurrets(dt,canFire){
    const range=this.num('turretRange',240),budget=Math.max(1,Math.round(this.num('turretBoltCap',3)));
    const lp=this.worldToLocal([shipX,shipY,0]);if(!lp)return;
    for(const t of this.turrets){
      t.hitFx=Math.max(0,t.hitFx-dt);t.flash=Math.max(0,t.flash-dt);if(!t.alive)continue;
      const d=v3sub(lp,t.pos),dy=d[1]*t.sign,flat=Math.hypot(d[0],d[2]);
      const wantYaw=Math.atan2(-d[0],-d[2]),wantPitch=clamp(Math.atan2(dy,flat),.02,1.15);
      let dYaw=wantYaw-t.yaw;while(dYaw>Math.PI)dYaw-=Math.PI*2;while(dYaw<-Math.PI)dYaw+=Math.PI*2;
      t.yaw+=clamp(dYaw,-1.1*dt,1.1*dt);t.pitch=moveToward(t.pitch,wantPitch,.8*dt);
      if(!canFire)continue;
      t.fireCD-=dt;if(t.fireCD>0)continue;
      const aimed=Math.abs(dYaw)<.12&&Math.abs(wantPitch-t.pitch)<.10,muzzle=this.localToWorld(this.turretMuzzleLocal(t));
      const live=bolts.filter(b=>!b.dead&&b.carrierRound).length;
      if(!aimed||this.distanceTo(muzzle)>range||dy<=.02||live>=budget){t.fireCD=.25;continue}
      if(this.fireRound(muzzle)){t.flash=.12;t.fireCD=this.num('turretFireMin',2.1)+Math.random()*this.num('turretFireSpan',1.2)}else t.fireCD=.3
    }
  }
  fireRound(muzzle){
    if(typeof tutorialConsumables!=='undefined'&&tutorialConsumables.blockHostileFire?.())return false;
    const [x,y,z]=muzzle,distance=Math.max(1,Math.hypot(shipX-x,shipY-y,z)),speed=this.num('roundSpeed',26),tti=Math.max(.3,distance/speed);
    const err=this.num('roundError',1.35),a=Math.random()*Math.PI*2,m=err*Math.pow(Math.random(),.8);
    const off=cameraVectorToWorld([Math.cos(a)*m,Math.sin(a)*m*.8,0]),tx=shipX+off[0],ty=shipY+off[1],tz=off[2];
    bolts.push({x,y,z,spawnDistance:distance,targetX:tx,targetY:ty,targetZ:tz,hitIntent:Math.hypot(tx-shipX,ty-shipY,tz)<1.55,leadShot:false,
      vx:(tx-x)/tti,vy:(ty-y)/tti,vz:(tz-z)/tti,homing:0,rot:Math.random()*6.28,rotSpeed:2.6,dead:false,visibleFor:0,visibleNow:false,
      age:0,maxLife:tti+1.4,maxCullRange:Math.max(260,distance+40),style:'plasma',col:C.r,accentCol:C.w,visualScale:1.2,carrierRound:true,damageLabel:'CARRIER TURRET'});
    SoundFX.laser?.();return true
  }

  // ---- exhaust / launches ----
  updateExhaust(dt){
    const back=this.localDir([0,0,1]),vel=v3scale(this.heading,this.speed);
    for(let i=this.exhaust.length-1;i>=0;i--){const p=this.exhaust[i];p.age+=dt;p.p[0]+=p.v[0]*dt;p.p[1]+=p.v[1]*dt;p.p[2]+=p.v[2]*dt;if(p.age>=p.life)this.exhaust.splice(i,1)}
    if(!this.carrier||this.carrier.dead||this.inside)return;
    const running=this.state!=='engage',base=running?26:8,thrust=clamp(this.speed/60,.2,1);
    for(const v of this.vents){
      // A destroyed engine is dead: its plume stops.
      const rate=v.alive?base:0;
      v.emitT-=dt*rate;
      while(v.emitT<=0&&this.exhaust.length<220){
        v.emitT+=1;
        const j=[(Math.random()-.5)*.26,(Math.random()-.5)*.18,.02],o=this.localToWorld(v3add(v.mouth,j));
        const sp=this.num('exhaustSpeed',42)*(running?1:.55)*(.75+Math.random()*.5);
        this.exhaust.push({vent:v.id,p:o,v:v3add(vel,v3scale(back,sp)),age:0,life:.9+Math.random()*.6,len:(running?3+6*thrust:2.5)+Math.random()*4})
      }
    }
  }
  hangarWorld(){return this.localToWorld([0,-.34,.45])}
  adoptLaunches(){
    if(!this.carrier||this.state!=='engage')return;
    const H=this.hangarWorld(),near=this.distanceTo(H)<this.num('launchRange',360);
    for(const f of fighters){
      if(this.launchSeen.has(f))continue;this.launchSeen.add(f);
      if(!near||f.dead||!Array.isArray(f.route)||f.route.length<2)continue;
      const down=this.localDir([0,-1,0]),out=v3add(H,v3add(v3scale(down,28),v3scale(this.heading,18)));
      f.route=[H.slice(),out,...f.route.slice(1)];f.pts=f.route;f.routeIndex=1;f.x=H[0];f.y=H[1];f.z=H[2];
      const dir=v3norm(v3sub(out,H)),sp=f.routeSpeed||25;f.vx=dir[0]*sp;f.vy=dir[1]*sp;f.vz=dir[2]*sp
    }
  }

  // ---- autopilot pursuit ----
  chaseHeight(){
    // Sit above the stern while dorsal guns remain, drop below for the ventral gun,
    // then settle just above the keel line for the hatch.
    if(this.turrets.some(t=>t.alive&&t.sign>0))return this.num('chaseHeightAbove',1.7);
    if(this.turrets.some(t=>t.alive&&t.sign<0))return -this.num('chaseHeightBelow',1.4);
    return this.num('chaseHeightHatch',.9)
  }
  chaseFly(dt){
    const c=this.carrier,lp=this.worldToLocal([shipX,shipY,0]);if(!c||!lp)return;
    const h=this.chaseHeight(),gapL=this.chaseGap/c.s,sway=Math.sin(this.t*.45)*this.num('chaseSway',.35);
    let tgtL=[sway,h,MANTA.sternZ+gapL];
    // Never cut through the hull: if X starts ahead of the stern, climb (or dive) clear first.
    if(lp[2]<MANTA.sternZ+.6&&Math.abs(lp[1])<2.0&&Math.abs(lp[0])<2.8)tgtL=[lp[0],h>=0?2.6:-2.3,lp[2]];
    const tgt=this.localToWorld(tgtL),d=v3sub(tgt,[shipX,shipY,0]),dist=v3len(d);
    const close=Math.min(dist,Math.max(10,dist*1.3)*dt,this.num('chaseCatchUpSpeed',110)*dt);
    // Formation with the carrier's own motion plus a closing step toward the chase slot.
    this.shift(v3add(v3scale(this.heading,this.speed*dt),dist>.001?v3scale(d,close/dist):[0,0,0]));
    steerExteriorAutopilot(this,this.localToWorld([0,.2,MANTA.sternZ-1.3]),dt,1.5);
    alignExteriorAutopilotRoll(this.localDir([0,1,0]),dt,.8)
  }

  // ---- leash (only once it runs) ----
  updateLeash(dt){
    const d=this.distanceTo(this.centre()),warn=this.num('leashWarn',700),lose=this.num('leashLose',950),grace=this.num('leashSeconds',10);
    if(d<warn*.92){if(this.leash!=='ok'){this.leash='ok';this.lostT=0;this.announced.pull=false;this.announced.nearly=false}return}
    if(d<lose){if(this.leash==='ok'){this.leash='warn';this.say1('pull','carrierPullingAway','CARRIER PULLING AWAY · STAY WITH IT')}if(this.leash==='lost'){this.leash='warn';this.lostT=0}return}
    if(this.leash!=='lost'){this.leash='lost';this.lostT=0;this.say1('nearly','carrierContactNearlyLost','CARRIER CONTACT NEARLY LOST')}
    this.lostT+=dt;if(this.lostT>=grace)this.fail()
  }
  fail(reason='Carrier contact lost.'){
    audio.playVoice('carrierContactLost',{once:false,priority:true});
    fighters.length=0;bolts.length=0;playerMissiles.length=0;
    if(typeof releaseSpaceLock==='function')releaseSpaceLock();if(typeof releaseSpacePursuit==='function')releaseSpacePursuit();resetSpaceDogfightDirector();
    this.reset();paused=false;document.body.classList.remove('paused','playing');
    campaign.failCurrentMission(reason)
  }

  // ---- boarding ----
  hatchWorld(){return this.localToWorld(this.hatch.pos)}
  hatchNormal(){return this.localDir([0,0,1])}
  beginDock(){
    const c=this.carrier;this.state='dock';this.stateT=0;this.turnRate=0;
    inputX=inputY=aimX=aimY=0;spaceYawVel=spacePitchVel=0;laserBurstRemaining=0;endLaserTrigger();
    fighters.length=0;bolts.length=0;playerMissiles.length=0;
    const lp=this.worldToLocal([shipX,shipY,0])||[0,1,6],hz=CARRIER_HATCH.z,stageL=[0,this.hatch.pos[1],hz+Math.max(40,this.num('hatchStageDistance',70))/c.s];
    const route=[];
    if(lp[2]>=hz+.6)route.length=0;
    else{
      // Not yet astern: swing over (or under) the hull, then drop onto the keel line.
      const side=lp[1]>=0?1:-1;
      route.push([clamp(lp[0],-2.2,2.2),side*2.4,clamp(lp[2],-4,3)],[0,side*1.4,hz+2.2],stageL)
    }
    const centre=this.centre();
    this.exteriorDockRoute=route.map(p=>v3sub(this.localToWorld(p),centre));this.exteriorDockLeg=0;this.exteriorDockPhase='route';
    say('AUTOPILOT · MATCHING CARRIER VELOCITY',.7)
  }
  ductAxisPoint(z){return this.localToWorld([0,CARRIER_DUCT.cy,z])}
  beginEntry(){
    // Lined up on the open hatch: the autopilot now flies straight down the duct.
    this.state='inside';this.stateT=0;this.entrySpeed=10;bolts.length=0;spaceMotes.length=0
  }
  // Move X along the duct axis (in carrier space) with gentle centring, keeping the
  // current view direction. Returns X's local z.
  ductMove(targetZ,speed,dt){
    const lp=this.worldToLocal([shipX,shipY,0]);if(!lp)return 0;
    const dzl=targetZ-lp[2],stepL=Math.sign(dzl)*Math.min(Math.abs(dzl),speed*dt/this.carrier.s);
    // Centre in the duct; in the bay, drop to eye level with the core's readout.
    const wantY=lerp(CARRIER_DUCT.cy,.30,clamp((CARRIER_DUCT.z1+.10-lp[2])/.14,0,1));
    const want=[lp[0]*(1-Math.min(1,dt*3)),lp[1]+(wantY-lp[1])*Math.min(1,dt*3),lp[2]+stepL];
    const to=this.localToWorld(want);this.shift(v3sub(to,[shipX,shipY,0]));
    return want[2]
  }
  playerInsideHull(){const lp=this.worldToLocal([shipX,shipY,0]);return !!lp&&lp[2]<MANTA.sternZ+.02&&lp[2]>1.4&&Math.abs(lp[0])<.4&&lp[1]>.1&&lp[1]<.47}
  beginDownload(){
    this.state='download';this.stateT=0;this.transferT=0;this.dataPackets.length=0;this.dataSpawnT=.08;this.dataDraining=false;
    for(let i=0;i<5;i++)this.dataPackets.push(...stationHack.makeDataPacketGroup(true));
    audio?.hackChirp?.start?.();audio.playVoice('downloadingNavigationCore',{once:false,priority:true});
    say('DOWNLOADING NAVIGATION CORE',.8)
  }
  updateDownload(dt){
    this.transferT+=dt;const seconds=Math.max(1.6,this.num('transferSeconds',4.5));
    for(let i=this.dataPackets.length-1;i>=0;i--){const p=this.dataPackets[i];p.u+=p.speed*dt;if(p.u>=1)this.dataPackets.splice(i,1)}
    if(this.transferT>=seconds)this.dataDraining=true;
    if(!this.dataDraining){this.dataSpawnT-=dt;while(this.dataSpawnT<=0&&this.dataPackets.length<18){this.dataPackets.push(...stationHack.makeDataPacketGroup(false));this.dataSpawnT+=.14+Math.random()*.34}}
    if(!this.dataDraining||this.dataPackets.length)return;
    audio?.hackChirp?.stop?.();SoundFX.terminalRed?.();audio.playVoice('scuttleChargeDetected',{once:false,priority:true});
    this.state='alarm';this.stateT=0;this.scuttleT=0;say('SCUTTLE CHARGE ARMED · GET OUT',.9)
  }
  scuttleTotal(){return Math.max(5,this.num('scuttleSeconds',7))}


  // ---- damage ----
  targetFacing(t){return this.facing(t.pos,t.normal,t.kind==='turret'?-.15:-.05)}
  shotCandidate(a,bestDistance=1e9){
    if(!this.active||!this.carrier||this.carrier.dead||!(this.state==='engage'||this.state==='flee'))return null;let best=null;
    for(const t of this.targets()){
      if(!this.targetFacing(t))continue;const p=proj(this.localToWorld(t.pos));if(!p)continue;
      const r=clamp(t.radius*this.carrier.s*p.k*.62,12,92),d=Math.hypot(a.x-p.x,a.y-p.y);
      if(d<r&&d<bestDistance&&(!best||d<best.distance))best={target:t,point:p,distance:d}
    }
    return best
  }
  hitHardpoint(t,bp){
    if(!t?.alive||!this.targetable(t))return;t.hp--;t.hitFx=.10;
    if(t.hp>0){SoundFX.hit();return}
    const Ms=RogueCarrierInterceptController.meshSet();
    t.alive=false;SoundFX.explosion();shake=Math.max(shake,t.kind==='hatch'?1.6:2.2);
    const out=this.localDir(t.normal);this.addRing(this.localToWorld(t.pos),t.kind==='turret'?26:18);
    if(t.kind==='turret'){score+=500;this.spawnDebris(this.turretWorldVerts(t,false),Ms.turretBody,out,10);this.spawnDebris(this.turretWorldVerts(t,true),Ms.turretBarrels,out,14)}
    else if(t.kind==='vent'){
      score+=400;this.spawnDebris(t.mesh.v.map(p=>this.localToWorld(p)),t.mesh,out,9);
      // The engine is dead: its plume goes out with it.
      this.exhaust=this.exhaust.filter(p=>p.vent!==t.id);
      if(this.ventsAlive()===0)this.say1('limp','carrierThrustCritical','CARRIER THRUST CRITICAL');
      else say(`VENT DESTROYED · THRUST ${Math.round(this.thrustFraction()*100)}%`,.6)
    }else if(t.kind==='hatch'){
      score+=300;this.spawnDebris(Ms.hatch.v.map(p=>this.localToWorld(p)),Ms.hatch,out,16,1.6);
      audio.playVoice('accessPanelBreached',{once:false,priority:true});say('HATCH BREACHED · BOARDING',.8);
      this.beginDock();return
    }
    this.checkHatchReady()
  }

  // ---- world-space destruction effects ----
  spawnDebris(worldVerts,mesh,outDir,speed=10,spin=1){
    const c=worldVerts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(x=>x/worldVerts.length);
    const jitter=[(Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6];
    this.debris.push({c,rel:worldVerts.map(p=>v3sub(p,c)),mesh,v:v3add(v3scale(this.heading,this.speed),v3scale(v3norm(v3add(outDir,jitter)),speed)),
      axis:v3norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),w:(1.2+Math.random()*1.8)*spin,ang:0,age:0,life:1.3+Math.random()*.5,tmp:{name:mesh.name,v:[],e:mesh.e,faces:mesh.faces}})
  }
  disintegrate(worldVerts,edges,count,vel,col=CARRIER_HULL_COL){
    const picks=edges.length<=count?edges:Array.from({length:count},()=>edges[(Math.random()*edges.length)|0]);
    for(const [ia,ib] of picks){
      const a=worldVerts[ia],b=worldVerts[ib];if(!a||!b)continue;
      const m=v3scale(v3add(a,b),.5),half=v3scale(v3sub(b,a),.5*Math.min(1,6/Math.max(.001,v3len(v3sub(b,a))))),out=v3norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]);
      this.fragments.push({a:v3sub(m,half),b:v3add(m,half),v:v3add(vel,v3scale(out,6+Math.random()*16)),age:0,life:.8+Math.random()*.7,col})
    }
  }
  addRing(c,maxR){if(c)this.rings.push({c:c.slice(),age:0,life:.55,maxR})}
  // ---- scuttle: cook-off, detonation, break-up ----
  // Internal blast: white starburst + shock ring + burning debris, all in world space.
  addBlast(c,size,{debris=10,col=C.o,sound=true,flash=.07}={}){
    if(!c)return;
    this.blasts.push({c:c.slice(),age:0,life:.42,size});
    this.addRing(c,size*1.6);
    const cv=v3scale(this.heading,this.speed);
    for(let i=0;i<debris;i++){
      const d=v3norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),len=size*(.08+Math.random()*.12),sp=size*(1.2+Math.random()*2.2);
      this.fragments.push({a:c.slice(),b:v3add(c,v3scale(d,len)),v:v3add(cv,v3scale(d,sp)),age:0,life:.6+Math.random()*.7,col:Math.random()<.5?col:C.y})
    }
    this.hullFlash=Math.max(this.hullFlash,flash);
    if(sound)SoundFX.explosion();shake=Math.max(shake,1.2+size*.02)
  }
  hullPoint(zMin,zMax){
    // A random point on the hull surface between two stations (local z), top or bottom.
    const z=zMin+Math.random()*(zMax-zMin),halfW=z<1.6?2.5*(z+4.4)/6.0:2.5-(z-1.6)/1.6*1.05,x=(Math.random()*2-1)*halfW*.8;
    const top=Math.random()<.65,y=top?carrierSurfaceY(RogueCarrierInterceptController.meshSet().hull,x,z,true):-.3;
    return this.localToWorld([x,y+(top?.02:-.02),z])
  }
  beginCookoff(){
    // The scuttle charge chains through the ship bow to stern before the main blast.
    this.state='cookoff';this.stateT=0;
    const n=this.num('cookoffBlasts',8),span=this.num('cookoffSeconds',1.7);
    this.cookEvents=Array.from({length:n},(_,i)=>{const u=i/(n-1);return{t:.05+u*(span-.25)+(Math.random()-.5)*.08,z0:-3.8+u*6.2,z1:-3.2+u*6.4,done:false}})
  }
  updateCookoff(dt){
    // Keep backing off while it cooks: the whole hull has to fit the frame when it goes.
    this.shift(v3scale(this.hatchNormal(),this.num('cookoffBackSpeed',22)*dt));
    for(const e of this.cookEvents){if(e.done||this.stateT<e.t)continue;e.done=true;this.addBlast(this.hullPoint(e.z0,e.z1),this.carrier.s*(.9+Math.random()*.6),{debris:12,flash:.035})}
    // Engines cough their last as the charge reaches the stern.
    if(this.stateT>=this.num('cookoffSeconds',1.7))this.beginBreakup()
  }
  beginBreakup(){
    this.state='breakup';this.stateT=0;
    const Ms=RogueCarrierInterceptController.meshSet(),hull=Ms.hull,c0=this.centre(),cv=v3scale(this.heading,this.speed),S=this.carrier.s;
    // Detonation flash: the whole hull goes white for a beat before it tears apart.
    this.hullFlash=.14;
    // Split the real hull faces into armour sections by station and side.
    const region=p=>{
      if(p[1]>.52&&p[2]>1.0&&p[2]<2.6)return'bridge';
      if(p[2]<-2.0)return'bow';
      const side=p[0]<-.9?'P':(p[0]>.9?'S':'C');
      return(p[2]<1.0?'mid':'aft')+side
    };
    const groups={};
    hull.faces.forEach(f=>{const c=f.reduce((a,i)=>v3add(a,hull.v[i]),[0,0,0]).map(x=>x/f.length),r=region(c);(groups[r]=groups[r]||[]).push(f)});
    const loose=hull.e.filter(([a,b])=>!hull.faces.some(f=>f.includes(a)&&f.includes(b)));
    const camDir=v3norm(v3sub([shipX,shipY,0],c0));let towardCam=null;
    for(const [name,fs] of Object.entries(groups)){
      const map=new Map(),v=[],faces=[],eset=new Set(),e=[],idx=i=>{if(!map.has(i)){map.set(i,v.length);v.push(hull.v[i])}return map.get(i)};
      for(const f of fs){const nf=f.map(idx);faces.push(nf);for(let k=0;k<nf.length;k++){const a=nf[k],b=nf[(k+1)%nf.length],key=a<b?`${a},${b}`:`${b},${a}`;if(!eset.has(key)){eset.add(key);e.push([a,b])}}}
      for(const [a,b] of loose){if(region(v3scale(v3add(hull.v[a],hull.v[b]),.5))===name)e.push([idx(a),idx(b)])}
      const world=v.map(p=>this.localToWorld(p)),c=world.reduce((a,p)=>v3add(a,p),[0,0,0]).map(x=>x/world.length);
      let out=v3sub(c,c0);if(v3len(out)<1)out=[Math.random()-.5,Math.random()-.5,Math.random()-.5];out=v3norm(v3add(v3norm(out),v3scale([Math.random()-.5,Math.random()-.5,Math.random()-.5],.5)));
      {const k=v3dot(out,camDir);if(k>0)out=v3norm(v3sub(out,v3scale(camDir,k*1.1)))}
      const sec={name,c,rel:world.map(p=>v3sub(p,c)),mesh:{v,e,faces},v:v3add(cv,v3scale(out,this.num('sectionSpeedMin',44)+Math.random()*this.num('sectionSpeedSpan',40))),
        axis:v3norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),w:(.25+Math.random()*.5)*(Math.random()<.5?-1:1),ang:0,flash:.16,
        blastAt:[.35+Math.random()*.8,1.3+Math.random()*1.0],dieAt:3.0+Math.random()*1.9,tmp:{name:`section ${name}`,v:[],e,faces}};
      this.sections.push(sec);
      if(name==='aftC'||(!towardCam&&name.startsWith('aft')))towardCam=sec;
      this.disintegrate(world,e,40,cv)
    }
    // One stern plate is hurled past the drone: close, fast, unmissable.
    if(towardCam){
      const pass=v3add([shipX,shipY,0],v3add(v3scale(spaceRight,S*.55),v3scale(spaceUp,S*.25))),d=v3norm(v3sub(pass,towardCam.c));
      towardCam.v=v3add(cv,v3scale(d,this.num('sectionSpeedMin',44)*2.2));towardCam.w*=3
    }
    // Burning spray: hundreds of short fragments flung from the core of the blast.
    for(let i=0;i<this.num('burstFragments',180);i++){
      const d=v3norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),start=v3add(c0,v3scale(d,S*Math.random()*1.4)),len=S*(.05+Math.random()*.14),sp=S*(.8+Math.random()*3.2);
      this.fragments.push({a:start,b:v3add(start,v3scale(d,len)),v:v3add(cv,v3scale(d,sp)),age:0,life:1.0+Math.random()*1.4,col:[C.o,C.y,C.w,CARRIER_HULL_COL][i%4]})
    }
    // Shock: three solid rings and a burst of rays from the core.
    this.rings.push({c:c0.slice(),age:0,life:.9,maxR:S*5.2,solid:true},{c:c0.slice(),age:0,life:.65,maxR:S*3.4,solid:true},{c:c0.slice(),age:-.12,life:.8,maxR:S*4.3,solid:true});
    this.rays.push({c:c0.slice(),age:0,life:.45,len:S*6,n:18,off:Math.random()});
    this.addBlast(c0,S*2.2,{debris:0,flash:.14});
    shake=Math.max(shake,10);SoundFX.explosion();setTimeout(()=>SoundFX.explosion(),140);setTimeout(()=>SoundFX.explosion(),380);setTimeout(()=>{if(this.active)audio.playVoice('carrierDestroyed',{once:false,priority:true})},1500);
    this.breakCentre=c0.slice();this.recoil=this.num('recoilSpeed',70);
    this.carrier.dead=true;this.exhaust.length=0
  }
  updateBreakup(dt){
    const t=this.stateT;
    if(this.recoil>.1&&this.breakCentre){const away=v3norm(v3sub([shipX,shipY,0],this.breakCentre));this.shift(v3scale(away,this.recoil*dt));this.recoil*=Math.exp(-.85*dt)}
    for(let i=this.sections.length-1;i>=0;i--){
      const s=this.sections[i];s.flash=Math.max(0,s.flash-dt);
      // Blown out hard, then dragged down so the pieces hang and tumble in view.
      const drag=Math.exp(-this.num('sectionDrag',.55)*dt);s.v=v3scale(s.v,drag);
      for(let k=0;k<s.blastAt.length;k++){if(s.blastAt[k]!=null&&t>=s.blastAt[k]){s.blastAt[k]=null;s.flash=.1;this.addBlast(v3add(s.c,v3scale(s.rel[(Math.random()*s.rel.length)|0],.6)),this.carrier.s*(.6+Math.random()*.5),{debris:8,sound:Math.random()<.6})}}
      if(t>=s.dieAt){const w=this.bodyWorld(s);this.disintegrate(w,s.mesh.e,s.mesh.e.length,s.v);this.addBlast(s.c,this.carrier.s*.9,{debris:10,sound:Math.random()<.5});this.sections.splice(i,1)}
    }
  }
  updateEffects(dt){
    const drift=(o)=>{o.ang+=o.w*dt;o.c[0]+=o.v[0]*dt;o.c[1]+=o.v[1]*dt;o.c[2]+=o.v[2]*dt};
    for(let i=this.debris.length-1;i>=0;i--){const d=this.debris[i];d.age+=dt;drift(d);if(d.age>=d.life){this.disintegrate(this.bodyWorld(d),d.mesh.e,40,d.v);this.debris.splice(i,1)}}
    for(const s of this.sections)drift(s);
    for(let i=this.fragments.length-1;i>=0;i--){const f=this.fragments[i];f.age+=dt;for(const p of[f.a,f.b]){p[0]+=f.v[0]*dt;p[1]+=f.v[1]*dt;p[2]+=f.v[2]*dt}if(f.age>=f.life)this.fragments.splice(i,1)}
    for(let i=this.rings.length-1;i>=0;i--){const r=this.rings[i];r.age+=dt;if(r.age>=r.life)this.rings.splice(i,1)}
    for(let i=this.blasts.length-1;i>=0;i--){const b=this.blasts[i];b.age+=dt;if(b.age>=b.life)this.blasts.splice(i,1)}
    for(let i=this.rays.length-1;i>=0;i--){const r=this.rays[i];r.age+=dt;if(r.age>=r.life)this.rays.splice(i,1)}
    this.hullFlash=Math.max(0,this.hullFlash-dt)
  }
  bodyWorld(o){return o.rel.map(p=>v3add(o.c,rotateAroundAxis(p,o.axis,o.ang)))}

  // ---- collision ----
  updateHullCollision(){
    const lp=this.worldToLocal([shipX,shipY,0]);if(!lp||lp[2]<-4.4||lp[2]>3.25)return;
    const half=lp[2]<1.6?2.5*(lp[2]+4.4)/6.0:2.5-(lp[2]-1.6)/1.6*1.05;if(Math.abs(lp[0])>half+.05)return;
    const top=carrierSurfaceY(RogueCarrierInterceptController.meshSet().hull,clamp(lp[0],-half,half),lp[2],true)+.12,bottom=-.36;
    if(lp[1]>top||lp[1]<bottom)return;
    const up=top-lp[1],down=lp[1]-bottom,dir=up<down?[0,1,0]:[0,-1,0];
    this.shift(v3scale(this.localDir(dir),(Math.min(up,down)+.02)*this.carrier.s));
    if(this.collisionCD<=0){this.collisionCD=1.1;damage('CARRIER HULL')}
  }

  // ---- motion dust ----
  // Outside the free-flight fight the normal dust update is off (it assumes the drone
  // is cruising along its nose). Here the dust follows X's REAL motion instead: the sum
  // of every move this controller made to the drone this frame, at the same 4x optic
  // exaggeration as normal flight. So the chase streams, a crippled carrier leaves you
  // crawling, the back-off and blast push flow the right way, and nothing freezes.
  ownsDust(){return !!(this.active&&mode==='play'&&phase==='space'&&this.state!=='engage'&&this.state!=='idle')}
  dustVisible(q,grow=0){return q[2]>.7-grow*.3&&q[2]<190+grow*10&&Math.abs(q[0])<q[2]*(.9+grow*.1)+4+grow*6&&Math.abs(q[1])<q[2]*(.6+grow*.1)+4+grow*6}
  respawnDust(m,up){
    // Random point in view, then carried upstream until it just leaves view, so it
    // drifts in from the side the drone is heading towards.
    const z=4+Math.random()*150,local=[(Math.random()*2-1)*(z*.9+4),(Math.random()*2-1)*(z*.6+4),z];
    let q=local;
    if(up)for(let i=0;i<140&&this.dustVisible(q);i++)q=[q[0]+up[0]*2.2,q[1]+up[1]*2.2,q[2]+up[2]*2.2];
    const w=cameraPointToWorld(q);m.x=w[0];m.y=w[1];m.z=w[2];m.dx=0;m.dy=0;m.dz=1;m.b=.42+Math.random()*.46;m.col=C.x;return m
  }
  updateDust(dt){
    const want=this.state==='flee'?this.num('chaseDustCount',190):SPACE_MOTE_COUNT;
    while(spaceMotes.length<want)spaceMotes.push(this.respawnDust({},null));
    if(spaceMotes.length>want)spaceMotes.length=want;
    // Velocity from this frame's moves, lightly smoothed so collision nudges don't spike it.
    const v=dt>0?v3scale(this.frameMove,1/dt):[0,0,0];this.frameMove=[0,0,0];
    const k=1-Math.exp(-dt*10);this.dustVel=v3add(this.dustVel,v3scale(v3sub(v,this.dustVel),k));
    const K=this.num('dustExaggeration',4),step=v3scale(this.dustVel,K*dt),speed=v3len(this.dustVel);
    const lv=cameraVectorToLocal(this.dustVel),ln=Math.hypot(lv[0],lv[1],lv[2]),up=ln>.5?[lv[0]/ln,lv[1]/ln,lv[2]/ln]:null;
    for(const m of spaceMotes){
      m.x-=step[0];m.y-=step[1];m.z-=step[2];
      if(speed<.5)continue;
      if(!this.dustVisible(camPoint([m.x,m.y,m.z]),1))this.respawnDust(m,up)
    }
  }

  // ---- per-frame ----
  update(dt){
    if(!this.active||mode!=='play')return;
    if(!this.ownsDust())this.frameMove=[0,0,0];
    this.t+=dt;this.stateT+=dt;this.collisionCD=Math.max(0,this.collisionCD-dt);
    for(const t of[...this.turrets,...this.vents,this.hatch])t.hitFx=Math.max(0,t.hitFx-dt);
    const s=this.state,free=(s==='engage'||s==='flee');
    this.inside=this.carrier&&!this.carrier.dead&&this.playerInsideHull();
    if(this.carrier&&!this.carrier.dead){
      if(s==='engage'){
        // Holding the fight: a slow cruise that keeps swinging its broadside round.
        const up=this.localDir([0,1,0]);this.setHeading(rotateAroundAxis(this.heading,up,this.num('holdTurnRate',.10)*dt))
      }else if(s==='flee'&&this.fleeTo&&this.stateT<3.5){
        const u=ease(clamp(this.stateT/3.2,0,1));this.setHeading(v3norm(v3add(v3scale(this.fleeFrom,1-u),v3scale(this.fleeTo,u))))
      }
      const want=this.wantedSpeed();this.speed=moveToward(this.speed,want,dt*(s==='flee'?45:(want<this.speed?6:4)));
      const c=this.carrier;c.x+=this.heading[0]*this.speed*dt;c.y+=this.heading[1]*this.speed*dt;c.z+=this.heading[2]*this.speed*dt;
      // Formation: while docking or leaving the hatch the whole scene holds station.
      if(['dock','inside','download','alarm','turn','sprint','exitRun','flip','cookoff'].includes(s))this.shift(v3scale(this.heading,this.speed*dt))
    }
    if(s==='engage'){this.moveWithPlayer(dt);this.updateHullCollision();this.adoptLaunches()}
    else if(s==='flee'){this.updateChaseGap(dt);if(!this.active)return;this.chaseFly(dt)}
    this.updateExhaust(dt);this.updateEffects(dt);
    if(this.carrier&&!this.carrier.dead&&!this.inside)this.updateTurrets(dt,free);
    if(s==='engage'||s==='flee'){this.checkHatchReady();return}
    if(s==='dock'){
      // Line up on the duct axis just outside the open hatch, looking straight in.
      const n=this.hatchNormal(),in_=this.ductAxisPoint(CARRIER_DUCT.z1),stop=v3add(this.ductAxisPoint(MANTA.sternZ),v3scale(n,6));
      const auto=updateExteriorDockRoute(this,this.centre(),in_,stop,d=>this.shift(d),this.localDir([0,1,0]),dt,{arrivalDistance:1.0,arrivalAngle:.03,arrivalRoll:.04});
      if(auto.arrived||this.stateT>40)this.beginEntry();
      return
    }
    if(s==='inside'){
      // Ease in through the hatch and down the duct, slowing into the service bay.
      const lp=this.worldToLocal([shipX,shipY,0]),remain=Math.max(0,(lp?lp[2]:CARRIER_STOP_Z)-CARRIER_STOP_Z)*this.carrier.s;
      this.entrySpeed=moveToward(this.entrySpeed,clamp(remain*.55,2.2,11),dt*8);
      steerExteriorAutopilot(this,this.localToWorld([0,.26,CARRIER_CORE.z-.6]),dt,.8);
      const z=this.ductMove(CARRIER_STOP_Z,this.entrySpeed,dt);
      if(z<=CARRIER_STOP_Z+.002)this.beginDownload();return
    }
    if(s==='download'){this.updateDownload(dt);return}
    if(s!=='breakup'&&s!=='complete'&&s!=='download')this.scuttleT+=dt;
    if(s==='alarm'){if(this.stateT>=.9){this.state='turn';this.stateT=0;this.turnStart={f:[...spaceForward],r:[...spaceRight],u:[...spaceUp]}}return}
    if(s==='turn'){
      // Pivot in the bay to face back down the duct toward the hatch.
      const u=clamp(this.stateT/1.3,0,1),q=ease(u),st=this.turnStart;
      spaceForward=rotateAroundAxis(st.f,st.u,Math.PI*q);spaceRight=rotateAroundAxis(st.r,st.u,Math.PI*q);spaceUp=[...st.u];orthonormaliseSpaceOrientation();syncEulerFromSpaceOrientation();viewRoll=-Math.sin(u*Math.PI)*.08;
      if(u>=1){viewRoll=0;this.state='sprint';this.stateT=0;this.entrySpeed=4}return
    }
    if(s==='sprint'){
      // Flat out for the hatch; the opening grows ahead with open space beyond it.
      this.entrySpeed=moveToward(this.entrySpeed,26,dt*22);
      const z=this.ductMove(MANTA.sternZ+2,this.entrySpeed,dt);
      if(z>MANTA.sternZ+.25){this.state='exitRun';this.stateT=0;spaceMotes.length=0}return
    }
    if(s==='exitRun'){this.shift(v3scale(this.hatchNormal(),this.num('exitRunSpeed',60)*dt));if(this.stateT>=this.num('exitRunSeconds',1.4)){this.state='flip';this.stateT=0;this.turnStart={f:[...spaceForward],r:[...spaceRight],u:[...spaceUp]}}return}
    if(s==='flip'){
      this.shift(v3scale(this.hatchNormal(),this.num('flipBackSpeed',45)*dt));
      const u=clamp(this.stateT/1.4,0,1),q=ease(u),st=this.turnStart;
      spaceForward=rotateAroundAxis(st.f,st.u,Math.PI*q);spaceRight=rotateAroundAxis(st.r,st.u,Math.PI*q);spaceUp=[...st.u];orthonormaliseSpaceOrientation();syncEulerFromSpaceOrientation();viewRoll=-Math.sin(u*Math.PI)*.1;
      if(u>=1){viewRoll=0;this.beginCookoff()}return
    }
    if(s==='cookoff'){this.updateCookoff(dt);return}
    if(s==='breakup'){this.updateBreakup(dt);
      // v307: let the last pieces burn out rather than vanish mid-air (hard cap 9 s).
      const settled=!this.sections.length&&!this.debris.length&&this.fragments.length<12;
      if(this.stateT>=this.num('breakupSeconds',5.8)&&(settled||this.stateT>=9)){this.state='complete';SoundFX.objectiveComplete();scenarioFlow.completeCurrentStage()}}
  }

  // ---- drawing: exterior ----
  drawWorld(tmp,worldVerts,col){tmp.v=worldVerts;drawMesh({x:0,y:0,z:0,s:1,rot:[0,0,0],mx:1,my:1,mz:1},tmp,col,1)}
  medianDepth(w){const d=[];for(let i=0;i<w.length;i+=2){const q=camPoint(w[i]);if(q[2]>.18)d.push(q[2])}if(!d.length)return null;d.sort((a,b)=>a-b);return d[(d.length/2)|0]}
  partColour(t){return t.hitFx>0?C.w:(this.targetable(t)?C.r:CARRIER_HULL_COL)}
  drawTurrets(){
    const Ms=RogueCarrierInterceptController.meshSet();
    for(const t of this.turrets){
      if(!t.alive||!this.facing(t.pos,t.normal,-.15))continue;const col=this.partColour(t);
      t._tb=t._tb||{name:'tb',v:[],e:Ms.turretBody.e,faces:Ms.turretBody.faces};t._tr=t._tr||{name:'tr',v:[],e:Ms.turretBarrels.e,faces:Ms.turretBarrels.faces};
      this.drawWorld(t._tb,this.turretWorldVerts(t,false),col);this.drawWorld(t._tr,this.turretWorldVerts(t,true),col);
      if(t.flash>0){const m=proj(this.localToWorld(this.turretMuzzleLocal(t)));if(m){const r=clamp(.10*this.carrier.s*m.k,3,26);for(let k=0;k<4;k++){const a=k*Math.PI/4;line(m.x-Math.cos(a)*r,m.y-Math.sin(a)*r,m.x+Math.cos(a)*r,m.y+Math.sin(a)*r,C.w,1,1)}}}
    }
  }
  drawParts(){
    const Ms=RogueCarrierInterceptController.meshSet();
    for(const v of this.vents){if(!v.alive||!this.facing(v.pos,v.normal,-.05))continue;v._t=v._t||{name:'vent',v:[],e:v.mesh.e,faces:v.mesh.faces};this.drawWorld(v._t,v.mesh.v.map(p=>this.localToWorld(p)),this.partColour(v))}
    if(this.facing(this.hatch.alive?this.hatch.pos:[0,CARRIER_DUCT.cy,CARRIER_HATCH.z],this.hatch.normal,this.hatch.alive?-.05:0)){
      if(this.hatch.alive){this._ht=this._ht||{name:'hatch',v:[],e:Ms.hatch.e,faces:Ms.hatch.faces};this.drawWorld(this._ht,Ms.hatch.v.map(p=>this.localToWorld(p)),this.partColour(this.hatch))}
      else{const P=Ms.hatchOpen.v.map(p=>proj(this.localToWorld(p)));for(const [a,b] of Ms.hatchOpen.e)if(P[a]&&P[b])line(P[a].x,P[a].y,P[b].x,P[b].y,CARRIER_PORT_COL,1,1)}
    }
  }
  drawExhaust(splitDepth=null,behind=null){
    const back=this.localDir([0,0,1]);
    for(const p of this.exhaust){
      if(splitDepth!=null){const z=camPoint(p.p)[2];if(behind?z<splitDepth:z>=splitDepth)continue}
      const u=p.age/p.life,len=p.len*(1-u*.7),a=proj(p.p),b=proj(v3sub(p.p,v3scale(back,len)));if(a&&b)line(a.x,a.y,b.x,b.y,CARRIER_FX_COL,1,1)
    }
  }
  drawFragments(){
    for(const f of this.fragments){const a=proj(f.a),b=proj(f.b);if(a&&b)line(a.x,a.y,b.x,b.y,f.col,1,clamp(1-f.age/f.life,0,1))}
    ensureSpaceOrientation();
    for(const r of this.rings){
      const u=r.age/r.life,rad=r.maxR*(.25+.75*Math.sin(u*Math.PI/2)),pts=[];
      for(let k=0;k<=20;k++){const a=k/20*Math.PI*2;pts.push(proj(v3add(r.c,v3add(v3scale(spaceRight,Math.cos(a)*rad),v3scale(spaceUp,Math.sin(a)*rad)))))}
      if(r.age<0)continue;
      for(let k=0;k<20;k+=(r.solid?1:2))if(pts[k]&&pts[k+1])line(pts[k].x,pts[k].y,pts[k+1].x,pts[k+1].y,C.w,1,clamp(1-u,0,1))
    }
    // Blast starbursts and detonation rays, drawn in the camera plane at the blast.
    for(const b of this.blasts){
      const u=b.age/b.life,r=b.size*(.35+.9*Math.sin(u*Math.PI/2)),a=clamp(1-u,0,1),c=proj(b.c);if(!c)continue;
      for(let k=0;k<8;k++){const ang=k*Math.PI/4+.2,d=v3add(v3scale(spaceRight,Math.cos(ang)),v3scale(spaceUp,Math.sin(ang))),p0=proj(v3add(b.c,v3scale(d,r*.25))),p1=proj(v3add(b.c,v3scale(d,r)));if(p0&&p1)line(p0.x,p0.y,p1.x,p1.y,u<.3?C.w:C.y,1,a)}
    }
    for(const ry of this.rays){
      const u=ry.age/ry.life,a=clamp(1-u,0,1),L=ry.len*(.3+.7*Math.sin(u*Math.PI/2));
      for(let k=0;k<ry.n;k++){const ang=(k+ry.off)*Math.PI*2/ry.n,d=v3add(v3scale(spaceRight,Math.cos(ang)),v3scale(spaceUp,Math.sin(ang))),p0=proj(v3add(ry.c,v3scale(d,L*.35))),p1=proj(v3add(ry.c,v3scale(d,L)));if(p0&&p1)line(p0.x,p0.y,p1.x,p1.y,C.w,1,a)}
    }
  }

  // ---- drawing: interior (world space, same geometry from outside and inside) ----
  interiorWorld(){
    // Transform the static interior once per frame.
    const I=RogueCarrierInterceptController.meshSet().interior;
    return I.polys.map(p=>({w:p.pts.map(q=>this.localToWorld(q)),col:p.col,detail:p.detail?p.detail.map(([a,b])=>[this.localToWorld(a),this.localToWorld(b)]):null}))
  }
  edgeWorld(a,b,col){
    const near=.24;let A=camPoint(a),B=camPoint(b);const ai=A[2]>near,bi=B[2]>near;if(!ai&&!bi)return;
    if(ai!==bi){const k=(near-A[2])/(B[2]-A[2]),I=[lerp(A[0],B[0],k),lerp(A[1],B[1],k),near+.0001];if(!ai)A=I;else B=I}
    const p0=projectCam(A),p1=projectCam(B);if(p0&&p1)line(p0.x,p0.y,p1.x,p1.y,col,1,1)
  }
  // Hidden-line interior: every edge is depth-tested in short sections against all
  // interior faces (the same rule drawMesh applies to a single model), so collars,
  // pipes and grating can never bleed through each other the way a painter's sort
  // of big floor/wall panels allows.
  buildOccluders(items,near){
    const f=Math.min(W,viewH)*1.09,cx=W*.5,cy=viewH*.48,GX=24,GY=14,grid=Array.from({length:GX*GY},()=>[]);
    items.forEach((it,pi)=>{
      let q=it.w.map(camPoint),out=[];
      for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length],ain=a[2]>near,bin=b[2]>near;if(ain)out.push(a);if(ain!==bin){const t=(near-a[2])/(b[2]-a[2]);out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),near])}}
      if(out.length<3)return;
      const S=out.map(c=>({x:cx+c[0]*f/c[2],y:cy-c[1]*f/c[2],iz:1/c[2]}));
      it.screen=S;
      for(let i=1;i<S.length-1;i++){
        const a=S[0],b=S[i],c=S[i+1],d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(d)<1e-6)continue;
        const tr={a,b,c,d,pi,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y)};
        if(tr.maxX<0||tr.minX>W||tr.maxY<0||tr.minY>H)continue;
        const x0=clamp(Math.floor(tr.minX/W*GX),0,GX-1),x1=clamp(Math.floor(tr.maxX/W*GX),0,GX-1),y0=clamp(Math.floor(tr.minY/H*GY),0,GY-1),y1=clamp(Math.floor(tr.maxY/H*GY),0,GY-1);
        for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++)grid[gy*GX+gx].push(tr)
      }
    });
    return{f,cx,cy,near,GX,GY,grid}
  }
  occluded(O,q,own){
    const f=O.f,x=O.cx+q[0]*f/q[2],y=O.cy-q[1]*f/q[2];if(x<0||x>=W||y<0||y>=H)return false;
    const cell=O.grid[Math.floor(y/H*O.GY)*O.GX+Math.floor(x/W*O.GX)],lim=q[2]-Math.max(.02,q[2]*.004);
    for(const t of cell){
      if(t.pi===own||x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;
      const a=t.a,b=t.b,c=t.c,l1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/t.d,l2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/t.d,l3=1-l1-l2;
      if(l1<-1e-4||l2<-1e-4||l3<-1e-4)continue;
      const iz=l1*a.iz+l2*b.iz+l3*c.iz;if(iz>0&&1/iz<lim)return true
    }
    return false
  }
  hlEdge(O,a,b,col,own=-1){
    const near=O.near;let A=camPoint(a),B=camPoint(b);const ai=A[2]>near,bi=B[2]>near;if(!ai&&!bi)return;
    if(ai!==bi){const k=(near-A[2])/(B[2]-A[2]),I=[lerp(A[0],B[0],k),lerp(A[1],B[1],k),near+.0001];if(!ai)A=I;else B=I}
    const P=q=>({x:O.cx+q[0]*O.f/q[2],y:O.cy-q[1]*O.f/q[2]}),pa=P(A),pb=P(B);
    const n=clamp(Math.ceil(Math.hypot(pb.x-pa.x,pb.y-pa.y)/7),1,90);
    const path=this._hlPaths[col]||(this._hlPaths[col]=[]);let run=null;
    for(let k=0;k<n;k++){
      const t0=k/n,t1=(k+1)/n,tm=(t0+t1)/2,m=[lerp(A[0],B[0],tm),lerp(A[1],B[1],tm),lerp(A[2],B[2],tm)];
      if(this.occluded(O,m,own)){run=null;continue}
      const q1=[lerp(A[0],B[0],t1),lerp(A[1],B[1],t1),lerp(A[2],B[2],t1)];
      if(!run){const q0=[lerp(A[0],B[0],t0),lerp(A[1],B[1],t0),lerp(A[2],B[2],t0)];run=[P(q0)];path.push(run)}
      run.push(P(q1))
    }
  }
  flushHl(){
    for(const [col,runs] of Object.entries(this._hlPaths)){
      ctx.globalAlpha=1;ctx.strokeStyle=col;ctx.lineWidth=VECTOR_LINE_WIDTH;ctx.beginPath();
      for(const r of runs){ctx.moveTo(r[0].x,r[0].y);for(let i=1;i<r.length;i++)ctx.lineTo(r[i].x,r[i].y)}
      ctx.stroke()
    }
    this._hlPaths={}
  }
  drawInterior(){
    const near=.24,items=this.interiorWorld(),O=this.buildOccluders(items,near);this._hlPaths={};
    // Black out the interior surfaces (order is irrelevant: all fills are black).
    for(const it of items)if(it.screen)fillPoly(it.screen);
    items.forEach((it,pi)=>{
      if(!it.screen)return;
      for(let k=0;k<it.w.length;k++)this.hlEdge(O,it.w[k],it.w[(k+1)%it.w.length],it.col,pi);
      if(it.detail)for(const [a,b] of it.detail)this.hlEdge(O,a,b,it.col,pi)
    });
    this.flushHl();
    // Core service port and readout (the only accent colour in here).
    const fz=CARRIER_CORE.faceZ+.0015,L=p=>this.localToWorld(p);
    const port=[[-.03,.228,fz],[.03,.228,fz],[.03,.25,fz],[-.03,.25,fz]].map(L),sock=[[-.012,.233,fz],[.012,.233,fz],[.012,.245,fz],[-.012,.245,fz]].map(L);
    for(const q of[port,sock])for(let k=0;k<4;k++)this.hlEdge(O,q[k],q[(k+1)%4],CARRIER_PORT_COL);
    const alarm=['alarm','turn','sprint'].includes(this.state);
    // Small service readout above the port: a maintenance display, not a console.
    const disp=[[-.03,.29,fz],[.03,.29,fz],[.03,.328,fz],[-.03,.328,fz]].map(L);for(let k=0;k<4;k++)this.hlEdge(O,disp[k],disp[(k+1)%4],alarm?C.r:CARRIER_PORT_COL);
    stationHack.drawLineDisplay((x,y)=>proj(L([x*.043,.309+y*.03,fz+.0005])),{left:-.62,right:.62,bottom:-.5,top:.5,alarm,time:this.t});
    // Scuttle alarm: strobing lamps along the duct and bay ceilings.
    if(alarm&&Math.sin(this.t*12)>0)for(const [z,y] of[[3.02,CARRIER_DUCT.y1],[2.54,CARRIER_DUCT.y1],[2.12,CARRIER_BAY.y1],[1.62,CARRIER_BAY.y1]]){
      const q=[[-.03,y-.002,z-.03],[.03,y-.002,z-.03],[.03,y-.002,z+.03],[-.03,y-.002,z+.03]].map(L);for(let k=0;k<4;k++)this.hlEdge(O,q[k],q[(k+1)%4],C.r)
    }
    if(this.state==='download'){const src=camPoint(L([0,.239,fz]));if(src[2]>.2)stationHack.drawDataRamp(src,[0,-.62,.82],this.dataPackets,{sourceHalf:.43,targetHalf:.90})};this.flushHl()
  }
  drawInteriorThroughHatch(){
    // Seen from outside, the interior only shows through the blown hatch aperture.
    const h=CARRIER_HATCH,z=h.z+.004,ap=[[h.x0,h.y0,z],[h.x1,h.y0,z],[h.x1,h.y1,z],[h.x0,h.y1,z]].map(p=>this.localToWorld(p));
    const cl=camera.clipWorldPolyNear(ap,.24);if(cl.length<3)return;
    ctx.save();ctx.beginPath();ctx.moveTo(cl[0].x,cl[0].y);for(let i=1;i<cl.length;i++)ctx.lineTo(cl[i].x,cl[i].y);ctx.closePath();ctx.clip();
    fillPoly(cl);this.drawInterior();ctx.restore()
  }

  appendScene(scene){
    if(!this.active)return;
    if(this.inside){scene.push({z:.05,draw:()=>this.drawInterior()});return}
    const Ms=RogueCarrierInterceptController.meshSet();
    if(this.carrier&&!this.carrier.dead){
      const c=this.carrier,q=camPoint(this.centre());
      // The opening's own plane (not the blown plate's outer face) decides visibility,
      // so the view down the duct holds right up to the threshold.
      const open=!this.hatch.alive&&this.facing([0,CARRIER_DUCT.cy,CARRIER_HATCH.z],[0,0,1],0);
      if(q[2]>-c.s*6)scene.push({z:Math.max(.2,q[2]),draw:()=>{this.drawExhaust(q[2],true);drawMesh(c,Ms.hull,this.hullFlash>0?C.w:CARRIER_HULL_COL,1);if(open)this.drawInteriorThroughHatch();this.drawTurrets();this.drawParts();this.drawExhaust(q[2],false)}})
    }else if(this.exhaust.length)scene.push({z:.1,draw:()=>this.drawExhaust()})
    for(const s of this.sections){const w=this.bodyWorld(s),d=this.medianDepth(w);if(d!=null)scene.push({z:d,draw:()=>this.drawWorld(s.tmp,w,s.flash>0?C.w:CARRIER_HULL_COL)})}
    for(const d of this.debris){const w=this.bodyWorld(d),z=this.medianDepth(w);if(z!=null)scene.push({z,draw:()=>this.drawWorld(d.tmp,w,C.r)})}
    if(this.fragments.length||this.rings.length||this.blasts.length||this.rays.length)scene.push({z:.1,draw:()=>this.drawFragments()})
  }
  drawDiamond(point,label,size=13,col=C.y){
    const q=camPoint(point),r=size;let p=null,on=false;
    if(q[2]>.15){p=projectCam(q);on=!!(p&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=viewH)}if(!on)p=hudEdgeCue(q,r);if(!p)return;
    const x=p.x,y=p.y;line(x-r,y,x,y-r,col,1.2,1);line(x,y-r,x+r,y,col,1.2,1);line(x+r,y,x,y+r,col,1.2,1);line(x,y+r,x-r,y,col,1.2,1);if(label)drawHudMarkerLabel(label,x,y,r,col)
  }
  drawMarker(){
    if(!this.active||!this.carrier||this.carrier.dead||mode!=='play'||this.autopilotActive())return;
    const centre=this.centre(),d=this.distanceTo(centre),q=camPoint(centre);
    const onScreen=q[2]>.15&&(()=>{const p=projectCam(q);return p&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=viewH})();
    if(d>420||!onScreen){const pulse=this.leash!=='ok'?13+Math.round((Math.sin(this.t*10)*.5+.5)*7):13;this.drawDiamond(this.localToWorld([0,1.2,0]),'CARRIER',pulse,this.leash==='lost'?C.r:C.y)}
    if(d>520)return;
    for(const t of this.targets()){
      if(!this.targetFacing(t))continue;const p=proj(this.localToWorld(t.pos));if(!p||p.x<-40||p.x>W+40||p.y<-40||p.y>viewH+40)continue;
      const r=clamp(t.radius*this.carrier.s*p.k*.62,8,64),k=r*.38;
      for(const [sx,sy] of[[-1,-1],[1,-1],[-1,1],[1,1]]){line(p.x+sx*r,p.y+sy*r,p.x+sx*(r-k),p.y+sy*r,C.r,1,1);line(p.x+sx*r,p.y+sy*r,p.x+sx*r,p.y+sy*(r-k),C.r,1,1)}
      if(r>16)drawHudMarkerLabel(t.kind.toUpperCase(),p.x,p.y,r,C.r)
    }
  }
  escortsLeft(){return Math.max(0,(interceptorGoal||0)-(interceptorsDestroyed||0))}
  hudLeft(){return this.active?'CARRIER INTERCEPT':''}
  hudRight(){
    if(!this.active)return'';
    const s=this.state,scuttleLeft=Math.max(0,Math.ceil(this.scuttleTotal()-this.scuttleT));
    if(s==='engage')return`ESCORT ${this.escortsLeft()} · TURRETS ${this.turretsAlive()}`;
    if(s==='flee'){
      if(this.hatchTargetable())return'DEFENCES DOWN · BLOW STERN HATCH';
      const r=Math.round(this.chaseGap),escaping=this.ventsAlive()&&r>this.num('escapeWarn',340);
      const parts=[escaping?`CARRIER ESCAPING · RANGE ${r}`:`RANGE ${r}`,this.ventsAlive()?`VENTS ${this.ventsAlive()}`:'CRIPPLED'];
      if(this.turretsAlive())parts.push(`TURRETS ${this.turretsAlive()}`);return parts.join(' · ')
    }
    if(s==='dock')return'AUTOPILOT · MATCHING VELOCITY';
    if(s==='inside')return this.inside?'MAINTENANCE DUCT · NAV CORE':'AUTOPILOT · ENTERING HATCH';
    if(s==='download')return`NAV CORE DOWNLOAD ${Math.round(clamp(this.transferT/Math.max(1.6,this.num('transferSeconds',4.5)),0,1)*100)}%`;
    if(s==='alarm'||s==='turn'||s==='sprint'||s==='exitRun'||s==='flip')return`SCUTTLE CHARGE · ${scuttleLeft}`;
    if(s==='cookoff')return'SCUTTLE CHARGE DETONATING';
    if(s==='breakup'||s==='complete')return'CARRIER DESTROYED';
    return''
  }
}
