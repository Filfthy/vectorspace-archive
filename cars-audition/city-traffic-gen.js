'use strict';
// City traffic audition. Convention: X right, Y up, nose at -Z (as the current set).
// Bodies are single-colour (the caller's colour); lamps carry their own edge colours:
// red tail lamps, yellow head lamps, so direction of travel reads at a glance.
const RED='#FF0000',YEL='#FFFF00';
function M(name){
  const v=[],e=[],faces=[],ec=[],es=new Map();
  const V=p=>{v.push(p.map(n=>+n.toFixed(4)));return v.length-1};
  const E=(a,b,col=null)=>{if(a===b)return;const k=a<b?`${a},${b}`:`${b},${a}`;if(es.has(k)){if(col)ec[es.get(k)]=col;return}es.set(k,e.length);e.push([a,b]);ec.push(col)};
  const F=ids=>{faces.push(ids);for(let i=0;i<ids.length;i++)E(ids[i],ids[(i+1)%ids.length])};
  const loft=(rings,{capStart=true,capEnd=true}={})=>{
    const idx=rings.map(r=>Array.isArray(r[0])?r.map(V):[V(r)]);
    for(let k=0;k<idx.length-1;k++){const A=idx[k],B=idx[k+1];
      if(A.length===1){for(let i=0;i<B.length;i++)F([A[0],B[(i+1)%B.length],B[i]]);continue}
      if(B.length===1){for(let i=0;i<A.length;i++)F([A[i],A[(i+1)%A.length],B[0]]);continue}
      for(let i=0;i<A.length;i++){const j=(i+1)%A.length;F([A[i],A[j],B[j],B[i]])}}
    if(capStart&&idx[0].length>2)F([...idx[0]].reverse());
    if(capEnd&&idx[idx.length-1].length>2)F(idx[idx.length-1]);return idx};
  const line=(a,b,col=null)=>E(V(a),V(b),col);
  const lamp=(x0,x1,y,z,col,h=.05)=>{const s=Math.sign(z)*.004;line([x0,y,z+s],[x1,y,z+s],col);if(h)line([x0,y-h,z+s],[x1,y-h,z+s],col)};
  return{name,v,e,faces,ec,V,E,F,loft,line,lamp,out(extra={}){
    const xs=v.map(p=>p[0]),ys=v.map(p=>p[1]),zs=v.map(p=>p[2]);
    return{name,v,e,faces,edgeColors:ec,trafficWidth:+(Math.max(...xs)-Math.min(...xs)).toFixed(3),trafficHeight:+(Math.max(...ys)-Math.min(...ys)).toFixed(3),trafficDepth:+(Math.max(...zs)-Math.min(...zs)).toFixed(3),...extra}}}
}
// Hull cross-section: skirt, shoulder, deck. w = half width at shoulder.
const sec=(z,w,h,y0=-.3,top=.78)=>[[-w*.78,y0,z],[w*.78,y0,z],[w,y0+h*.5,z],[w*top,y0+h,z],[-w*top,y0+h,z],[-w,y0+h*.5,z]];
// Cabin cross-section (glasshouse): sits on the deck and sinks into it slightly.
const cab=(z,w,y0,h,top=.72)=>[[-w,y0,z],[w,y0,z],[w*top,y0+h,z],[-w*top,y0+h,z]];
const ring=(x,y,z,r,n=8)=>Array.from({length:n},(_,i)=>{const t=Math.PI/n+2*Math.PI*i/n;return[x+Math.cos(t)*r,y+Math.sin(t)*r,z]});
const nozzle=(m,x,y,z0,z1,r)=>{m.loft([ring(x,y,z0,r*.9),ring(x,y,z1,r),ring(x,y,z1+.02,r*.6)],{capStart:false})};

function sedan(){
  const m=M('A · Hover sedan');
  m.loft([sec(-2.0,.62,.34),sec(-1.55,.82,.46),sec(1.3,.84,.5),sec(1.95,.7,.44)]);
  m.loft([cab(-.75,.66,.12,.02),cab(-.35,.62,.12,.4),cab(.75,.6,.12,.4),cab(1.25,.64,.12,.04)]);
  for(const x of[-.42,.42])nozzle(m,x,-.06,1.8,2.12,.17);
  m.lamp(-.62,-.32,.08,1.95,RED);m.lamp(.32,.62,.08,1.95,RED);
  m.lamp(-.55,-.28,-.02,-2.0,YEL,0);m.lamp(.28,.55,-.02,-2.0,YEL,0);
  return m.out()
}
function cabTaxi(){
  const m=M('B · Cab (roof sign)');
  m.loft([sec(-1.85,.66,.42),sec(-1.45,.84,.52),sec(1.35,.84,.54),sec(1.8,.76,.5)]);
  m.loft([cab(-.9,.7,.22,.02),cab(-.45,.66,.22,.48),cab(.95,.66,.22,.48),cab(1.25,.7,.22,.04)]);
  m.loft([[[-.3,.7,-.05],[.3,.7,-.05],[.3,.7,.35],[-.3,.7,.35]],[[-.3,.88,-.05],[.3,.88,-.05],[.3,.88,.35],[-.3,.88,.35]]]);
  nozzle(m,0,-.02,1.7,2.0,.2);
  m.lamp(-.66,-.3,.14,1.8,RED);m.lamp(.3,.66,.14,1.8,RED);
  m.lamp(-.55,-.25,0,-1.85,YEL,0);m.lamp(.25,.55,0,-1.85,YEL,0);
  return m.out({taxi:true})
}
function van(){
  const m=M('C · Hover van');
  m.loft([sec(-2.0,.74,.55,-.3,.86),sec(-1.55,.86,.95,-.3,.9),sec(1.95,.86,1.05,-.3,.9)]);
  m.line([-.87,.2,-.2],[-.87,.2,1.7]);m.line([.87,.2,-.2],[.87,.2,1.7]);
  m.loft([cab(-1.75,.72,.28,.02,.86),cab(-1.45,.72,.28,.36,.86),cab(-1.05,.72,.28,.36,.86)],{capEnd:true});
  m.loft([[[-.5,-.2,1.95],[.5,-.2,1.95],[.5,.35,1.95],[-.5,.35,1.95]],[[-.46,-.17,2.12],[.46,-.17,2.12],[.46,.32,2.12],[-.46,.32,2.12]]]);
  m.lamp(-.84,-.62,.55,1.96,RED,.12);m.lamp(.62,.84,.55,1.96,RED,.12);
  m.lamp(-.6,-.3,-.05,-2.0,YEL,0);m.lamp(.3,.6,-.05,-2.0,YEL,0);
  return m.out()
}
function hauler(){
  const m=M('D · Freight hauler (tractor + box)');
  m.loft([sec(-3.2,.66,.5),sec(-2.8,.82,.78,-.3,.86),sec(-1.7,.82,.82,-.3,.86)]);
  m.loft([cab(-3.0,.7,.3,.02),cab(-2.75,.7,.3,.34),cab(-2.1,.7,.3,.34)],{capEnd:true});
  // coupling bar INTO both tractor and box
  m.loft([[[-.14,-.1,-1.85],[.14,-.1,-1.85],[.14,.05,-1.85],[-.14,.05,-1.85]],[[-.14,-.1,-1.45],[.14,-.1,-1.45],[.14,.05,-1.45],[-.14,.05,-1.45]]]);
  m.loft([sec(-1.55,.9,1.2,-.25,.96),sec(3.1,.9,1.2,-.25,.96)]);
  for(let z=-.8;z<3;z+=.95)m.line([-.91,-.2,z],[-.91,.9,z]),m.line([.91,-.2,z],[.91,.9,z]);
  for(const x of[-.5,.5])nozzle(m,x,-.1,3.05,3.3,.16);
  m.lamp(-.9,-.6,.8,3.1,RED,.1);m.lamp(.6,.9,.8,3.1,RED,.1);
  m.lamp(-.55,-.25,.0,-3.2,YEL,0);m.lamp(.25,.55,.0,-3.2,YEL,0);
  return m.out()
}
function coupe(){
  const m=M('E · Sports coupe (twin fins)');
  m.loft([sec(-2.1,.52,.24),sec(-1.3,.86,.34),sec(1.2,.92,.38),sec(1.9,.8,.34)]);
  m.loft([cab(-.5,.5,.02,.02),cab(-.1,.44,.02,.3),cab(.55,.42,.02,.28),cab(1.05,.5,.02,.03)]);
  for(const x of[-.62,.62])m.loft([[[x-.03,.02,.9],[x+.03,.02,.9],[x+.03,.02,1.85],[x-.03,.02,1.85]],[[x-.02,.45,1.5],[x+.02,.45,1.5],[x+.02,.45,1.9],[x-.02,.45,1.9]]]);
  for(const x of[-.35,.35])nozzle(m,x,-.14,1.75,2.1,.15);
  m.lamp(-.8,-.52,-.02,1.9,RED);m.lamp(.52,.8,-.02,1.9,RED);
  m.lamp(-.45,-.2,-.14,-2.1,YEL,0);m.lamp(.2,.45,-.14,-2.1,YEL,0);
  return m.out()
}
function shuttle(){
  const m=M('F · City shuttle (bus)');
  m.loft([sec(-3.0,.7,.7,-.3,.84),sec(-2.6,.9,1.15,-.3,.86),sec(2.8,.9,1.15,-.3,.86),sec(3.1,.8,1.0,-.3,.84)]);
  for(let z=-2.2;z<2.6;z+=.62){for(const x of[-.905,.905]){m.line([x,.42,z],[x,.42,z+.44]);m.line([x,.72,z],[x,.72,z+.44]);m.line([x,.42,z],[x,.72,z]);m.line([x,.42,z+.44],[x,.72,z+.44])}}
  m.loft([[[-.45,-.2,3.05],[.45,-.2,3.05],[.45,.3,3.05],[-.45,.3,3.05]],[[-.4,-.16,3.25],[.4,-.16,3.25],[.4,.26,3.25],[-.4,.26,3.25]]]);
  m.lamp(-.88,-.6,.72,3.1,RED,.12);m.lamp(.6,.88,.72,3.1,RED,.12);
  m.lamp(-.6,-.3,.0,-3.0,YEL,0);m.lamp(.3,.6,.0,-3.0,YEL,0);
  return m.out()
}
function bike(){
  const m=M('G · Hover bike');
  m.loft([sec(-1.5,.16,.2,-.2),sec(-.9,.3,.34,-.25),sec(.8,.3,.36,-.25),sec(1.3,.2,.3,-.22)]);
  m.loft([cab(-.25,.2,.1,.02),cab(.05,.2,.1,.28),cab(.45,.18,.1,.22),cab(.7,.2,.1,.02)]);
  nozzle(m,0,-.1,1.2,1.45,.14);
  m.lamp(-.2,.2,.08,1.3,RED,0);m.lamp(-.1,.1,-.02,-1.5,YEL,0);
  return m.out()
}
const models=[sedan(),cabTaxi(),van(),hauler(),coupe(),shuttle(),bike()];
// Audition colours: white bodies, the cab in yellow.
for(const m of models)m.col=m.taxi?'#FFFF00':'#FFFFFF';
require('fs').writeFileSync('audition.json',JSON.stringify({models}));
require('fs').writeFileSync('cars_final.json',JSON.stringify(models));
for(const m of models)console.log(m.name,'e',m.e.length,'wh d',m.trafficWidth,m.trafficHeight,m.trafficDepth);
