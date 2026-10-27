'use strict';

// BOOTSTRAP + SHARED MATH HELPERS ONLY.
// Mechanics, environments and render/game controllers are loaded in separate files.
const campaign=new CampaignController();
const camera=new Camera();
const flight=new FlightController();
const weapons=new WeaponController();
const mission=new MissionController();
const renderer=new SceneRenderer();
const game=new Game();
const audio=new AudioManager();
const options=new OptionsController();
const world=new World();
const corridorEnvironment=new CorridorEnvironmentController();
const forest=corridorEnvironment; // compatibility alias for existing shared code
const surfaceDestination=new SurfaceDestinationApproachController();

const {
  fighters,asteroids,groundTargets,bolts,shots,playerMissiles,sparks,fragments,hazards,doorPieces
}=world;
const asteroidField=new AsteroidFieldController();
const courier=new CourierController();
const jackalDelivery=new RedJackalDeliveryController();
const stationDelivery=new StationDeliveryController();
const scenarioFlow=new ScenarioFlowController();
const asteroidWreckRun=new AsteroidWreckMissionController();
const freeTradersDepot=new FreeTradersDepotController();
const carrierIntercept=new RogueCarrierInterceptController();
const tacoBeaconDelivery=new TacoBeaconDeliveryController();
const missionTransit=new MissionTransitController();
const spaceTransfer=new SpaceTransferController();

function hermite(p0,p1,m0,m1,t){const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*p0+(t3-2*t2+t)*m0+(-2*t3+3*t2)*p1+(t3-t2)*m1}
function hermiteD(p0,p1,m0,m1,t){const t2=t*t;return(6*t2-6*t)*p0+(3*t2-4*t+1)*m0+(-6*t2+6*t)*p1+(3*t2-2*t)*m1}
function autopilotAimLock(){return weapons.autopilotAimLock()}
function freeAutopilotWeaponAim(){return weapons.freeAutopilotWeaponAim()}
// 3D vector helpers used by the planet and hidden-line geometry.
// Generic large-object autopilot utilities. These are deliberately not asteroid-
// specific so future stations, capital ships and other host objects can use the same
// rule: free-space route first, authorised doorway penetration only on the final leg.
// HARD WORLD RULE: persistent large objects are never silently recycled, teleported
// or reframed to help navigation. Recovery changes the route/marker, never the object.
function segmentClearsProtectedSphere(a,b,centre,radius){
  const ab=v3sub(b,a),ac=v3sub(centre,a),den=v3dot(ab,ab);
  const t=den>1e-8?clamp(v3dot(ac,ab)/den,0,1):0,closest=v3add(a,v3scale(ab,t));
  return v3len(v3sub(closest,centre))>=radius
}
function largeObjectArcDirection(a,b,t,preferred){
  a=v3norm(a);b=v3norm(b);const d=clamp(v3dot(a,b),-1,1),ang=Math.acos(d);
  if(ang<1e-5)return a;
  if(Math.PI-ang<.025){
    let side=v3sub(preferred||[0,1,0],v3scale(a,v3dot(preferred||[0,1,0],a)));
    if(v3len(side)<.08){const seed=Math.abs(a[1])<.85?[0,1,0]:[1,0,0];side=v3sub(seed,v3scale(a,v3dot(seed,a)))}
    side=v3norm(side);return v3norm(v3add(v3scale(a,Math.cos(Math.PI*t)),v3scale(side,Math.sin(Math.PI*t))))
  }
  const sa=Math.sin((1-t)*ang)/Math.sin(ang),sb=Math.sin(t*ang)/Math.sin(ang);
  return v3norm(v3add(v3scale(a,sa),v3scale(b,sb)))
}
// Shared exterior-target autopilot used by orbital stations and other large
// objects. This is the proven Free Traders terminal behaviour factored into one
// place: smoothly turn the existing space-flight basis toward the real target,
// translate the host world toward the player only once the nose is sufficiently
// aligned, then brake into the requested stand-off point.
function steerExteriorAutopilot(controller,point,dt,maxRate=1.25){
  if(!point)return Infinity;ensureSpaceOrientation();
  const desired=v3norm([point[0]-shipX,point[1]-shipY,point[2]]);
  if(v3len(desired)<.0001)return 0;
  const angle=Math.acos(clamp(v3dot(spaceForward,desired),-1,1));
  if(angle>.0015){
    let axis=v3cross(spaceForward,desired);if(v3len(axis)<.001)axis=spaceUp;axis=v3norm(axis);
    const wanted=Math.min(maxRate,Math.max(.14,angle*2.8)),follow=1-Math.exp(-dt*4.8);
    controller.turnRate=lerp(controller.turnRate||0,wanted,follow);
    if(angle<.04)controller.turnRate=Math.min(controller.turnRate,Math.max(.09,angle*3.7));
    const turn=Math.min(angle,controller.turnRate*dt);
    spaceForward=rotateAroundAxis(spaceForward,axis,turn);spaceRight=rotateAroundAxis(spaceRight,axis,turn);spaceUp=rotateAroundAxis(spaceUp,axis,turn);
    orthonormaliseSpaceOrientation();syncEulerFromSpaceOrientation()
  }else controller.turnRate=(controller.turnRate||0)*Math.exp(-dt*7);
  viewRoll=moveToward(viewRoll,0,dt*3.1);return angle
}
function updateExteriorTargetAutopilot(controller,target,stop,shiftFn,dt,options={}){
  if(!target||!stop||typeof shiftFn!=='function')return{angle:Infinity,dist:Infinity,arrived:false};
  const maxRate=Number.isFinite(options.maxRate)?options.maxRate:1.20;
  const moveAngle=Number.isFinite(options.moveAngle)?options.moveAngle:.16;
  const farDistance=Number.isFinite(options.farDistance)?options.farDistance:38;
  const farSpeed=Number.isFinite(options.farSpeed)?options.farSpeed:22;
  const minSpeed=Number.isFinite(options.minSpeed)?options.minSpeed:3.0;
  const maxSpeed=Number.isFinite(options.maxSpeed)?options.maxSpeed:10.5;
  const speedScale=Number.isFinite(options.speedScale)?options.speedScale:1.35;
  const arrivalDistance=Number.isFinite(options.arrivalDistance)?options.arrivalDistance:.48;
  const arrivalAngle=Number.isFinite(options.arrivalAngle)?options.arrivalAngle:.025;
  const arrivalRoll=Number.isFinite(options.arrivalRoll)?options.arrivalRoll:.025;
  const angle=steerExteriorAutopilot(controller,target,dt,maxRate),toStop=v3sub(stop,[shipX,shipY,0]),dist=v3len(toStop);
  if(angle<moveAngle&&dist>.20){
    const speed=dist>farDistance?farSpeed:Math.max(minSpeed,Math.min(maxSpeed,dist*speedScale)),step=Math.min(dist,speed*dt);
    shiftFn(v3scale(toStop,step/Math.max(.001,dist)))
  }
  return{angle,dist,arrived:dist<arrivalDistance&&angle<arrivalAngle&&Math.abs(viewRoll)<arrivalRoll}
}

// Shared large-object docking route used when the final exterior target can be on
// the far side of a station, asteroid or carrier. The route planner keeps every
// outer leg outside a conservative protected sphere, then the final leg runs down
// the authored surface normal to the stand-off point. This prevents any mission
// from taking a diagonal shortcut through its host geometry.
function beginExteriorDockRoute(controller,centre,stage,protectedRadius,preferredUp=[0,1,0]){
  const planned=planLargeObjectApproach([shipX,shipY,0],centre,stage,protectedRadius,preferredUp);
  controller.exteriorDockRoute=planned.map(p=>v3sub(p,centre));controller.exteriorDockLeg=0;controller.exteriorDockPhase='route';controller.turnRate=0;
  return controller.exteriorDockRoute
}
function alignExteriorAutopilotRoll(targetUp,dt,rate=.72){
  ensureSpaceOrientation();const f=v3norm(spaceForward),up0=v3norm(targetUp||[0,1,0]);
  let wanted=v3sub(up0,v3scale(f,v3dot(up0,f)));
  if(v3len(wanted)<.001){viewRoll=moveToward(viewRoll,0,dt*.42);return Math.abs(viewRoll)}
  wanted=v3norm(wanted);const c=clamp(v3dot(spaceUp,wanted),-1,1),s=v3dot(v3cross(spaceUp,wanted),spaceForward),error=Math.atan2(s,c),angle=Math.abs(error);
  if(angle>.0025){const step=clamp(error,-rate*dt,rate*dt);spaceRight=rotateAroundAxis(spaceRight,spaceForward,step);spaceUp=rotateAroundAxis(spaceUp,spaceForward,step);orthonormaliseSpaceOrientation();syncEulerFromSpaceOrientation()}
  viewRoll=moveToward(viewRoll,0,dt*.42);return angle
}
function updateExteriorDockRoute(controller,centre,target,stop,shiftFn,targetUp,dt,options={}){
  if(!centre||!target||!stop||typeof shiftFn!=='function')return{arrived:false,phase:'invalid'};
  const routeRate=Number.isFinite(options.routeRate)?options.routeRate:1.40,finalRate=Number.isFinite(options.finalRate)?options.finalRate:1.18;
  const routeMoveAngle=Number.isFinite(options.routeMoveAngle)?options.routeMoveAngle:.16,finalMoveAngle=Number.isFinite(options.finalMoveAngle)?options.finalMoveAngle:.16;
  const arrivalDistance=Number.isFinite(options.arrivalDistance)?options.arrivalDistance:.48,arrivalAngle=Number.isFinite(options.arrivalAngle)?options.arrivalAngle:.025,arrivalRoll=Number.isFinite(options.arrivalRoll)?options.arrivalRoll:.025;
  if(controller.exteriorDockPhase!=='final'){
    const off=controller.exteriorDockRoute?.[controller.exteriorDockLeg];
    if(!off)controller.exteriorDockPhase='final';
    else{
      const routeTarget=v3add(centre,off),toTarget=v3sub(routeTarget,[shipX,shipY,0]),dist=v3len(toTarget),angle=steerExteriorAutopilot(controller,routeTarget,dt,routeRate),rollError=alignExteriorAutopilotRoll(targetUp,dt,.62);
      if(angle<=routeMoveAngle&&dist>.20){const speed=dist>55?28:lerp(11,22,clamp(dist/55,0,1)),step=Math.min(dist,speed*dt);shiftFn(v3scale(toTarget,step/Math.max(.001,dist)))}
      if(dist<=1.15){controller.exteriorDockLeg++;if(controller.exteriorDockLeg>=controller.exteriorDockRoute.length)controller.exteriorDockPhase='final'}
      return{arrived:false,phase:'route',dist,angle,rollError}
    }
  }
  const toStop=v3sub(stop,[shipX,shipY,0]),dist=v3len(toStop),angle=steerExteriorAutopilot(controller,target,dt,finalRate),rollError=alignExteriorAutopilotRoll(targetUp,dt,.72);
  if(angle<=finalMoveAngle&&dist>.20){const step=Math.min(dist,Math.max(2.8,Math.min(10,dist*1.35))*dt);shiftFn(v3scale(toStop,step/Math.max(.001,dist)))}
  return{arrived:dist<arrivalDistance&&angle<arrivalAngle&&rollError<arrivalRoll,phase:'final',dist,angle,rollError}
}

function planLargeObjectApproach(start,centre,target,protectedRadius,preferredSide=[0,1,0]){
  // Direct flight is always preferred when it genuinely clears the host.
  if(segmentClearsProtectedSphere(start,target,centre,protectedRadius))return[target];
  let from=start,pre=[];
  // If capture occurs inside the conservative protected volume, first recover
  // radially into clear space instead of attempting to cut through the host.
  const startRad=v3sub(start,centre);
  if(v3len(startRad)<protectedRadius+2){
    let dir=v3len(startRad)>.01?v3norm(startRad):v3norm(v3scale(v3sub(target,centre),-1));
    const recovery=v3add(centre,v3scale(dir,protectedRadius+12));pre.push(recovery);from=recovery
  }
  if(segmentClearsProtectedSphere(from,target,centre,protectedRadius))return[...pre,target];
  const ra=v3norm(v3sub(from,centre)),rb=v3norm(v3sub(target,centre)),angle=Math.acos(clamp(v3dot(ra,rb),-1,1));
  const waypointCount=angle>1.22?2:1;
  // Inflate the routing shell until all chord segments remain outside the protected
  // sphere. Two waypoints are sufficient even for a near-opposite-side recovery.
  let safeRadius=protectedRadius+Math.max(11,protectedRadius*.38);
  for(let attempt=0;attempt<7;attempt++){
    const mids=[];for(let i=1;i<=waypointCount;i++){const dir=largeObjectArcDirection(ra,rb,i/(waypointCount+1),preferredSide);mids.push(v3add(centre,v3scale(dir,safeRadius)))}
    const route=[...pre,...mids,target];let p=start,ok=true;
    for(const q of route){if(!segmentClearsProtectedSphere(p,q,centre,protectedRadius)){ok=false;break}p=q}
    if(ok)return route;safeRadius*=1.16
  }
  // Conservative last resort: a very wide side waypoint. It may be inelegant, but
  // never authorises a through-object shortcut.
  let side=v3cross(ra,preferredSide);if(v3len(side)<.05)side=v3cross(ra,[1,0,0]);side=v3norm(side);
  const wide=v3add(centre,v3scale(side,protectedRadius*2.35));
  return[...pre,wide,target]
}
function rotateAroundAxis(p,axis,angle){
  const n=v3norm(axis),c=Math.cos(angle),s=Math.sin(angle),d=v3dot(n,p),x=v3cross(n,p);
  return[v3scale(p,c),v3scale(x,s),v3scale(n,d*(1-c))].reduce((a,b)=>v3add(a,b),[0,0,0])
}
function v3add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function v3sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function v3scale(a,s){return[a[0]*s,a[1]*s,a[2]*s]}
function v3dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function v3cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function v3len(a){return Math.hypot(a[0],a[1],a[2])}
function v3norm(a){const n=v3len(a)||1;return[a[0]/n,a[1]/n,a[2]/n]}
// Trench is deliberately tighter on widescreen. At 16:9 it is about 25% narrower than v9.
function trenchWall(){return world.trenchWall()}
function tunnelHalfH(){return world.tunnelHalfH()}
function tunnelCenter(z){return world.tunnelCenter(z)}
function tunnelPlayerClamp(){return flight.tunnelPlayerClamp()}
function rx(p,a){return camera.rx(p,a)}
function ry(p,a){return camera.ry(p,a)}
function rz(p,a){return camera.rz(p,a)}
function rotate(p,r){return camera.rotate(p,r)}
function camPoint(p){return camera.camPoint(p)}
function proj(p){return camera.proj(p)}

