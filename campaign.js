'use strict';
class CampaignController {
  constructor(){
    this.storageKey='agentXCampaignV1';
    this.currentMission=null;
    this.open=false;
    this.returnPauseState=false;
    globalThis.AgentXCampaignContent.apply(this);
    this.state=this.load();
    this.state.inventory={...this.emptyInventory(),...(this.state.inventory||{})};
    this.state.ownedFrames=Array.isArray(this.state.ownedFrames)?this.state.ownedFrames.filter(id=>this.frames[id]):['AX-1'];
    if(!this.state.ownedFrames.includes('AX-1'))this.state.ownedFrames.unshift('AX-1');
    if(!this.frames[this.state.drone])this.state.drone='AX-1';
    if(!this.state.ownedFrames.includes(this.state.drone))this.state.ownedFrames.push(this.state.drone);
    this.state.loadout=Array.isArray(this.state.loadout)?this.state.loadout.slice(0,4):[null,null,null,null];
    while(this.state.loadout.length<4)this.state.loadout.push(null);
    this.state.internalLoadout=Array.isArray(this.state.internalLoadout)?this.state.internalLoadout.slice(0,4):[null,null,null,null];
    while(this.state.internalLoadout.length<4)this.state.internalLoadout.push(null);
    this.state.frameLoadouts=(this.state.frameLoadouts&&typeof this.state.frameLoadouts==='object')?this.state.frameLoadouts:{};
    this.state.mail=Array.isArray(this.state.mail)?this.state.mail:[];
    this.state.mail=this.state.mail.map(m=>({...m,priority:this.mailPriority(m)}));
    this.state.mailFlags=(this.state.mailFlags&&typeof this.state.mailFlags==='object')?this.state.mailFlags:{};
    this.state.discounts=(this.state.discounts&&typeof this.state.discounts==='object')?this.state.discounts:{};
    this.state.mailSeq=Math.max(0,Number(this.state.mailSeq)||0);
    this.selectedMailId=null;
    this.mailFilter='all';
    this.pendingMailVoicePriority=null;
    this.deferHubVoiceNotifications=false;
    this.pendingSkillPointVoice=false;
    this.pendingMission=null;
    this.activeLoadout=[null,null,null,null];
    this.activeCharges=[0,0,0,0];
    this.activeInternalLoadout=[null,null,null,null];
    this.activeWeapon='laser1';
    this.resetCombatEffects();
    for(const f of Object.values(this.factions))f.rep=this.state.reputation[f.id]??0;
    this.currentStageIndex=0;
    this.migrateProgressionV300();
    if(this.state.deployedKit){this.recoverOrphanedKit();this.restoreFrameLoadout(this.state.drone,false);this.save()}
    this.normalizeLoadout();
    this.topUpLoadout(false);
    if(!this.state.frameLoadouts[this.state.drone])this.rememberCurrentFrameLoadout();
    this.ensureContractBoard();
    this.ensureWelcomeMail();
    this.evaluateMailTriggers();
  }
  emptyInventory(){return Object.fromEntries(Object.keys(this.items||{}).map(id=>[id,0]))}
  defaultState(){
    return {money:12000,xp:0,drone:'AX-1',ownedFrames:['AX-1'],reputation:{trade:0,security:0,jackals:0,helix:0,quickbite:0},completed:0,failed:0,skills:[],inventory:this.emptyInventory(),weaponLoadout:null,loadoutCharges:[0,0,0,0],autoRestock:true,loadout:[null,null,null,null],internalLoadout:[null,null,null,null],frameLoadouts:{},boardGeneration:0,contractBoard:null,mail:[],mailSeq:0,mailFlags:{introShown:false},discounts:{},trainingInsuranceBenefit:false};
  }
  tierInfo(tier){return ({1:{name:'White',roman:'I'},2:{name:'Green',roman:'II'},3:{name:'Blue',roman:'III'},4:{name:'Purple',roman:'IV'},5:{name:'Orange',roman:'V'}})[clamp(Number(tier)||1,1,5)]}
  tierClass(tier){return `tier${this.tierInfo(tier).name}`}
  xpThresholds(){return [0,600,1500,2800,4500,6500,9000,12000,15500,19500,24000,29000,34500,40500,47000,54000,61500,69500,78000,87000]}
  xpForLevel(level){const a=this.xpThresholds(),n=clamp(Math.round(Number(level)||1),1,a.length);return a[n-1]}
  normalMarketTier(level=this.levelForXP()){
    if(level>=14)return 5;if(level>=9)return 4;if(level>=5)return 3;if(level>=2)return 2;return 1
  }
  bestReputation(){return Math.max(...Object.values(this.factions).filter(f=>f.id!=='quickbite').map(f=>Number(f.rep)||0))}
  favourTierBoost(){
    const rep=this.bestReputation();let boost=rep>=60?2:(rep>=25?1:0);
    if(this.hasSkill('connections'))boost++;
    // Connections always adds a grade, even on top of top standing.
    return Math.min(3,boost)
  }
  marketAccessTier(){return clamp(this.normalMarketTier()+this.favourTierBoost(),1,5)}
  productAccess(product){
    if(!product)return {ok:false,reason:'Unavailable'};
    if(product.faction){
      const rep=this.factions[product.faction]?.rep||0,need=product.repReq||25;
      return rep>=need?{ok:true,reason:`Faction access · rep ${rep}` }:{ok:false,reason:`${product.factionName||this.factions[product.faction]?.name||'Faction'} rep ${need} required`}
    }
    const access=this.marketAccessTier();
    return product.tier<=access?{ok:true,reason:product.tier>this.normalMarketTier()?'Early access through favour':'Standard access'}:{ok:false,reason:`Normally opens around level ${product.tier===2?2:(product.tier===3?5:(product.tier===4?9:14))} · favour can open it earlier`}
  }
  activeFrame(){return this.frames[this.state.drone]||this.frames['AX-1']}
  fittedInternalItems(){return (this.fittedInternalIds()||[]).map(id=>this.items[id]).filter(Boolean)}
  internalSum(prop){return this.fittedInternalItems().reduce((n,it)=>n+(Number(it[prop])||0),0)}
  internalProduct(prop){return this.fittedInternalItems().reduce((n,it)=>n*(Number(it[prop])||1),1)}

  // ---- v300 skills: cards with ranks; each rank id is stored in state.skills ----
  skillCard(id){return this.skillCards.find(c=>c.id===id||c.ranks.some(r=>r.id===id))||null}
  skillRankDef(id){for(const c of this.skillCards)for(const r of c.ranks)if(r.id===id)return r;return null}
  hasSkill(id){return this.state.skills.includes(id)}
  skillRank(cardId){const c=this.skillCard(cardId);return c?c.ranks.filter(r=>this.hasSkill(r.id)).length:0}
  nextSkillRank(cardId){const c=this.skillCard(cardId);return c?c.ranks.find(r=>!this.hasSkill(r.id))||null:null}
  skillPointsTotal(){return Math.max(1,this.levelForXP())}
  skillPointsSpent(){return this.state.skills.reduce((n,id)=>n+(this.skillRankDef(id)?.cost||0),0)}
  skillPointsAvailable(){return Math.max(0,this.skillPointsTotal()-this.skillPointsSpent())}
  skillCanBuy(cardId){const r=this.nextSkillRank(cardId);return !!r&&this.skillPointsAvailable()>=r.cost}
  purchaseSkill(cardId){
    const r=this.nextSkillRank(cardId);if(!r||!this.skillCanBuy(cardId))return false;
    this.state.skills.push(r.id);this.normalizeLoadout();
    if(r.id==='connections'||r.id.startsWith('insurance')||r.id.startsWith('negotiator'))this.generateContractBoard();
    this.save();this.renderHeader();this.renderPerks();this.renderWorkshop();return true
  }
  respecCost(){return 250*this.levelForXP()}
  respecSkills(free=false){
    if(this.equipmentLocked()||!this.state.skills.length)return false;
    const cost=free?0:this.respecCost();if(this.state.money<cost)return false;
    this.state.money-=cost;this.state.skills=[];this.normalizeLoadout();this.generateContractBoard();
    this.save();this.renderHeader();this.renderPerks();this.renderWorkshop();return true
  }
  // ---- v300 equipment ----
  weaponItem(){const id=this.currentMission?this.activeWeapon:this.state.weaponLoadout;return this.items[id]||this.items.laser1}
  laserDamagePerPulse(){return Number(this.weaponItem().damage)||1}
  laserDamageAgainst(target){
    let d=this.laserDamagePerPulse();
    if(this.fx.overchargeT>0)d*=2;
    if(this.hasSkill('killingStreak'))d*=1+.10*Math.min(5,this.fx.streak);
    if(this.hasSkill('executioner')&&target&&target.maxHp>0&&target.hp/target.maxHp<.30)d*=1.5;
    return d
  }
  packSize(item){if(!item||item.slot!=='consumable')return 0;return (Number(item.pack)||1)+(this.hasSkill('quartermaster')?1:0)+(Number(this.activeFrame().packBonus)||0)}
  lockTimeMultiplier(){return (this.hasSkill('fastLock')?.5:1)*(Number(this.activeFrame().lockMult)||1)}
  lockHoldMultiplier(){return this.hasSkill('fastLock')?2:1}
  boltToleranceMultiplier(){return (this.hasSkill('pointDefence')?1.5:1)*(Number(this.activeFrame().boltTolMult)||1)*this.internalProduct('aimMult')}
  restockDiscount(){return this.hasSkill('quartermaster')?.85:1}

  // ---------- Operator record: stats and achievements (v58) ----------
  // Only real contracts count (not DEV tests or the simulator). Contract results
  // are bumped with force because currentMission is being cleared at that moment.
  statsLive(){const m=this.currentMission;return !!m&&!m.devTest&&!m.devTemplateTest&&!m.devGroundTest&&!m.training}
  stats(){
    const s=this.state.stats||(this.state.stats={});
    s.contracts=s.contracts||{done:0,failed:0,abandoned:0,byFaction:{}};s.kills=s.kills||{fighters:0,armour:{},generators:0,reactors:0,moons:0,knees:0};
    for(const k of['shotDown','dronesLost','creditsEarned','insurancePaid','cleanRuns'])s[k]=s[k]||0;
    if(!this.state.achievements)this.state.achievements={};return s
  }
  bumpStat(path,n=1,force=false){
    if(!force&&!this.statsLive())return;
    const s=this.stats(),keys=path.split('.');let o=s;
    for(let i=0;i<keys.length-1;i++)o=o[keys[i]]||(o[keys[i]]={});
    const k=keys[keys.length-1];o[k]=(o[k]||0)+n;this.checkAchievements()
  }
  armourKills(){return Object.values(this.stats().kills.armour).reduce((a,b)=>a+b,0)}
  storyArcs(){
    const f=this.state.mailFlags||{},arc=(name,flags)=>({name,done:flags.filter(x=>f[x+'Done']).length,total:flags.length});
    return[arc('Mara Venn · VOX',['mara1','mara2','mara3']),arc('Kudo Shang · OSD',['kudo1','kudo2','kudo3']),arc('Corvella Pallis · Free Traders',['corvella1']),
      arc('Cassian Erivan-Snade · Red Jackals',['cassian1']),arc('Navira Derris · Helix',['helix1','helix2']),arc('Nyxo Malloc · QuickBite',['nyxo1','nyxo2'])]
  }
  achievementDefs(){
    const s=this.stats(),k=s.kills,heavy=(k.armour.strider||0)+(k.armour.crab||0)+(k.armour.tesla||0),f=this.state.mailFlags||{};
    const minRep=Math.min(...Object.values(this.factions).map(x=>x.rep));
    return[
      {id:'firstContract',name:'On the Books',text:'Complete a contract.',v:s.contracts.done,goal:1},
      {id:'contractor',name:'Contractor',text:'Complete 25 contracts.',v:s.contracts.done,goal:25},
      {id:'veteran',name:'Veteran Operator',text:'Complete 100 contracts.',v:s.contracts.done,goal:100},
      {id:'ace',name:'Ace',text:'Destroy 50 fighters.',v:k.fighters,goal:50},
      {id:'swarmBreaker',name:'Swarm Breaker',text:'Destroy 250 fighters.',v:k.fighters,goal:250},
      {id:'pointDefence',name:'Point Defence',text:'Shoot down 250 projectiles.',v:s.shotDown,goal:250},
      {id:'wallOfFire',name:'Wall of Fire',text:'Shoot down 1,000 projectiles.',v:s.shotDown,goal:1000},
      {id:'kneeCapper',name:'Knee Capper',text:'Break 50 walker knees.',v:k.knees,goal:50},
      {id:'armourBreaker',name:'Armour Breaker',text:'Destroy 100 ground armour.',v:this.armourKills(),goal:100},
      {id:'toppler',name:'Toppler',text:'Bring down 10 heavy walkers.',v:heavy,goal:10},
      {id:'cleanRun',name:'Clean Run',text:'Complete a contract without taking a hit.',v:s.cleanRuns,goal:1},
      {id:'untouchable',name:'Untouchable',text:'Complete 10 contracts without taking a hit.',v:s.cleanRuns,goal:10},
      {id:'reactorSpecialist',name:'Reactor Specialist',text:'Destroy 3 reactors.',v:k.reactors,goal:3},
      {id:'moonbreaker',name:'Moonbreaker',text:'Destroy a moon.',v:k.moons,goal:1},
      {id:'longGame',name:'The Long Game',text:'Finish the VOX story.',v:f.kudo3Done?1:0,goal:1},
      {id:'wellConnected',name:'Well Connected',text:'Reach Favoured with every network.',v:Math.max(0,minRep),goal:25}
    ]
  }
  checkAchievements(){
    const got=this.state.achievements||(this.state.achievements={});
    for(const a of this.achievementDefs())if(!got[a.id]&&a.v>=a.goal){got[a.id]=this.state.completed||0;if(typeof mode!=='undefined'&&mode==='play')say(`ACHIEVEMENT · ${a.name.toUpperCase()}`,1.2)}
  }
  // ---- v300 in-mission combat effects (consumables and skills) ----
  resetCombatEffects(){this.fx={overchargeT:0,flareT:0,naniteLeft:0,naniteT:0,streak:0,lastStandUsed:false,graceT:0,boltsShot:0,hotCD:0}}
  updateCombatEffects(dt){
    const fx=this.fx;if(!fx)return;
    fx.overchargeT=Math.max(0,fx.overchargeT-dt);fx.flareT=Math.max(0,fx.flareT-dt);fx.graceT=Math.max(0,fx.graceT-dt);fx.hotCD=Math.max(0,fx.hotCD-dt);
    if(fx.naniteLeft>0){fx.naniteT-=dt;if(fx.naniteT<=0){fx.naniteT=1.2;if(shield<this.maxShield()){shield++;hud()}fx.naniteLeft--;}}
    if(typeof fighters!=='undefined')for(const f of fighters)if(f.stunT>0)f.stunT=Math.max(0,f.stunT-dt);
  }
  onFighterKilled(){this.fx.streak++;this.bumpStat('kills.fighters')}
  onPlayerHit(){this.fx.streak=0;this.missionHits=(this.missionHits||0)+1}
  onBoltShotDown(){
    this.bumpStat('shotDown');
    if(!this.hasSkill('pointDefence2'))return;
    this.fx.boltsShot++;
    if(this.fx.boltsShot%3===0&&shield<this.maxShield()){shield++;hud();say('POINT DEFENCE · SHIELD +1',.45)}
  }
  tryLastStand(){
    if(!this.hasSkill('lastStand')||this.fx.lastStandUsed||!this.currentMission)return false;
    this.fx.lastStandUsed=true;this.fx.graceT=2;say('LAST STAND',.7);return true
  }
  hotTriggerReady(){return this.hasSkill('hotTrigger')&&this.fx.hotCD<=0}
  armHotTrigger(){this.fx.hotCD=BASE_LASER_INTERVAL*this.laserIntervalMultiplier()*2}
  // v300: hostile toughness follows the gear band a contract's risk expects, so a
  // correctly equipped drone always needs ~10-14 pulses per kill, under-gearing hurts
  // and over-gearing shreds. Pay is computed before this and is unaffected.
  contractToughnessScale(risk){
    const dmg=[1,1.5,2,2.75,3.5],band=clamp(1+Math.floor((Math.max(1,Number(risk)||1)-1)/2),1,5);
    return dmg[band-1]
  }
  scaleContractToughness(modules,risk){
    const k=this.contractToughnessScale(risk);
    for(const m of modules||[])if((m.type==='fighters'||m.type==='customs_drones')&&!m.toughnessScaled){
      const base=Math.max(12,Number(m.fighterHp)||12);m.fighterHp=Math.round((12+(base-12)*.5)*k);m.toughnessScaled=true
    }
    return modules
  }
  maxContractRisk(){
    // Risk rises mainly with experience; strong favour can surface harder work early.
    const lvl=this.levelForXP(),rep=this.bestReputation();
    let cap=clamp(3+Math.floor((lvl-1)/2),3,9);
    if(rep>=25)cap++;if(rep>=60)cap++;
    return clamp(cap,3,9)
  }
  fittedInternalIds(){return this.currentMission?this.activeInternalLoadout:this.state.internalLoadout}
  hasInternal(id){return (this.fittedInternalIds()||[]).includes(id)}
  maxShield(){return this.activeFrame().shields+this.internalSum('shieldBonus')}
  shieldRegeneration(){
    // The consumables lesson deliberately demonstrates shield loss and recovery, so
    // automatic repair is disabled for that simulator stage. Earlier training keeps
    // the forgiving fast recharge used for movement/aim practice.
    if(this.currentMission?.training&&(this.currentStage?.()?.tutorialConsumables||this.currentStage?.()?.tutorialAbandon))return null;
    if(this.currentMission?.training)return {delay:.28,interval:.42};
    let interval=8;
    interval*=Number(this.activeFrame().regenMult)||1;
    interval*=this.internalProduct('regenMult');
    return {delay:this.hasSkill('quickRegen')?2:4,interval:Math.max(1.2,interval)}
  }
  enemyHitIntentMultiplier(){return Number(this.activeFrame().enemyHitMult)||1}
  weaponAimMultiplier(){return (Number(this.activeFrame().aimMult)||1)*this.internalProduct('aimMult')}
  laserIntervalMultiplier(){return Number(this.activeFrame().fireIntervalMult)||1}
  laserBurstSize(){return 4+(Number(this.activeFrame().burstBonus)||0)+this.internalSum('burstBonus')}
  activeSlotCount(){
    return clamp(this.activeFrame().consumables||1,1,4)
  }
  internalSlotCount(){return clamp(this.activeFrame().internals||1,1,4)}
  blankFrameProfile(){return {consumables:[null,null,null,null],internals:[null,null,null,null],weapon:null}}
  normaliseFrameProfile(profile){
    const p=profile&&typeof profile==='object'?profile:{};
    const consumables=Array.isArray(p.consumables)?p.consumables.slice(0,4):[null,null,null,null];
    const internals=Array.isArray(p.internals)?p.internals.slice(0,4):[null,null,null,null];
    while(consumables.length<4)consumables.push(null);while(internals.length<4)internals.push(null);
    return {consumables,internals,weapon:typeof p.weapon==='string'?p.weapon:null}
  }
  rememberCurrentFrameLoadout(){
    if(!this.state.frameLoadouts||typeof this.state.frameLoadouts!=='object')this.state.frameLoadouts={};
    this.state.frameLoadouts[this.state.drone]={consumables:this.state.loadout.slice(0,4),internals:this.state.internalLoadout.slice(0,4),weapon:this.state.weaponLoadout||null};
  }
  addStock(id,n=1){if(id&&n>0&&this.items[id]&&!this.items[id].free)this.state.inventory[id]=(this.state.inventory[id]||0)+n}
  takeStock(id,n){const have=this.state.inventory[id]||0,take=Math.max(0,Math.min(have,n));this.state.inventory[id]=have-take;return take}
  unloadBaseLoadoutToInventory(){
    for(let i=0;i<4;i++){this.addStock(this.state.loadout[i],this.state.loadoutCharges[i]||0)}
    for(const id of this.state.internalLoadout)this.addStock(id,1);
    this.addStock(this.state.weaponLoadout,1);
    this.state.loadout=[null,null,null,null];this.state.loadoutCharges=[0,0,0,0];this.state.internalLoadout=[null,null,null,null];this.state.weaponLoadout=null;
  }
  restoreFrameLoadout(frameId=this.state.drone,buy=false){
    if(this.equipmentLocked()||frameId!==this.state.drone)return false;
    this.normalizeLoadout();
    const profile=this.normaliseFrameProfile(this.state.frameLoadouts?.[frameId]);
    const cap=this.activeSlotCount(),internalCap=this.internalSlotCount();
    // Consumable slots remember WHAT they carry even when empty, so auto-restock knows
    // what to buy; charges come from stock up to the pack size.
    for(let i=0;i<cap;i++){
      if(this.state.loadout[i])continue;
      const id=profile.consumables[i],item=id?this.items[id]:null;
      if(!item||item.slot!=='consumable')continue;
      this.state.loadout[i]=id;this.state.loadoutCharges[i]=this.takeStock(id,this.packSize(item));
    }
    for(let i=0;i<internalCap;i++){
      if(this.state.internalLoadout[i])continue;
      const id=profile.internals[i],item=id?this.items[id]:null;
      if(!item||item.slot!=='internal'||(this.state.inventory[id]||0)<1)continue;
      this.state.inventory[id]--;this.state.internalLoadout[i]=id;
    }
    if(!this.state.weaponLoadout&&profile.weapon&&this.items[profile.weapon]?.slot==='weapon'&&!this.items[profile.weapon].free&&(this.state.inventory[profile.weapon]||0)>0){
      this.state.inventory[profile.weapon]--;this.state.weaponLoadout=profile.weapon
    }
    // Back at base after a run: packs are refilled (stock first, then market when
    // auto-restock is on and funds allow) so the bay shows what will launch.
    const r=this.topUpLoadout(buy);if(buy)this.returnRestock=r;
    return true
  }
  normalizeLoadout(){
    const cap=this.activeSlotCount(),internalCap=this.internalSlotCount();
    this.state.inventory={...this.emptyInventory(),...(this.state.inventory||{})};
    this.state.loadout=Array.isArray(this.state.loadout)?this.state.loadout.slice(0,4):[null,null,null,null];
    while(this.state.loadout.length<4)this.state.loadout.push(null);
    this.state.loadoutCharges=Array.isArray(this.state.loadoutCharges)?this.state.loadoutCharges.slice(0,4).map(n=>Math.max(0,Math.round(Number(n)||0))):[0,0,0,0];
    while(this.state.loadoutCharges.length<4)this.state.loadoutCharges.push(0);
    this.state.internalLoadout=Array.isArray(this.state.internalLoadout)?this.state.internalLoadout.slice(0,4):[null,null,null,null];
    while(this.state.internalLoadout.length<4)this.state.internalLoadout.push(null);
    for(let i=0;i<4;i++){
      const id=this.state.loadout[i],item=id?this.items[id]:null;
      if(id&&(!item||item.slot!=='consumable'||i>=cap)){this.addStock(item?id:null,this.state.loadoutCharges[i]);this.state.loadout[i]=null;this.state.loadoutCharges[i]=0;continue}
      if(!id){this.state.loadoutCharges[i]=0;continue}
      const pack=this.packSize(item);
      if(this.state.loadoutCharges[i]>pack){this.addStock(id,this.state.loadoutCharges[i]-pack);this.state.loadoutCharges[i]=pack}
    }
    for(let i=0;i<4;i++){
      const id=this.state.internalLoadout[i],item=id?this.items[id]:null;
      if(id&&(!item||item.slot!=='internal'||i>=internalCap)){this.addStock(item?id:null,1);this.state.internalLoadout[i]=null}
    }
    const w=this.state.weaponLoadout,wi=w?this.items[w]:null;
    if(w&&(!wi||wi.slot!=='weapon'||wi.free)){if(wi&&!wi.free)this.addStock(w,1);this.state.weaponLoadout=null}
  }
  equipmentLocked(){return !!this.currentMission}
  // Market purchase. `units` are charges for consumables, single pieces otherwise.
  buyItem(id,units=1){
    const item=this.items[id],access=this.productAccess(item);if(!item||item.free||!access.ok)return false;
    units=Math.max(1,Math.round(units));
    const first=this.marketPrice(item),rest=Number(item.price)||0,total=first+rest*(units-1);
    if(this.state.money<total){
      // Buy as many as the balance allows rather than refusing outright.
      if(this.state.money<first)return false;
      units=1+Math.floor((this.state.money-first)/Math.max(1,rest));return this.buyItem(id,units)
    }
    this.state.money-=total;this.consumeMarketDiscount(id);this.addStock(id,units);
    if(item.slot==='consumable')this.topUpLoadout(false);
    this.save();this.renderHeader();this.renderShop();this.renderWorkshop();this.renderProgressionSandbox();this.renderMail();return true
  }
  buyFrame(id){
    const frame=this.frames[id],access=this.productAccess(frame);if(!frame||id==='AX-1'||!access.ok||this.state.ownedFrames.includes(id)||this.state.money<frame.price)return false;
    this.state.money-=frame.price;this.state.ownedFrames.push(id);if(!this.state.frameLoadouts[id])this.state.frameLoadouts[id]=this.blankFrameProfile();this.save();this.renderHeader();this.renderShop();this.renderWorkshop();this.renderProgressionSandbox();return true
  }
  selectFrame(id){
    if(this.equipmentLocked()||!this.frames[id]||!this.state.ownedFrames.includes(id)||this.state.drone===id)return false;
    this.normalizeLoadout();this.rememberCurrentFrameLoadout();this.unloadBaseLoadoutToInventory();
    this.state.drone=id;this.restoreFrameLoadout(id);this.save();this.renderHeader();this.renderWorkshop();this.renderShop();return true
  }
  equipItem(id,slotIndex=null){
    if(this.equipmentLocked())return false;
    this.normalizeLoadout();const item=this.items[id];if(!item)return false;
    if(item.slot==='weapon'){
      if(item.free){this.addStock(this.state.weaponLoadout,1);this.state.weaponLoadout=null}
      else{if(!(this.state.inventory[id]>0))return false;this.addStock(this.state.weaponLoadout,1);this.state.inventory[id]--;this.state.weaponLoadout=id}
    }else if(item.slot==='internal'){
      if(!(this.state.inventory[id]>0))return false;
      const target=this.state.internalLoadout;let slot=slotIndex??-1;
      if(slot<0)for(let i=0;i<this.internalSlotCount();i++)if(!target[i]){slot=i;break}
      if(slot<0||slot>=this.internalSlotCount())return false;
      if(target[slot])this.addStock(target[slot],1);
      this.state.inventory[id]--;target[slot]=id;
    }else{
      if(!(this.state.inventory[id]>0))return false;
      const cap=this.activeSlotCount(),L=this.state.loadout,Cc=this.state.loadoutCharges,pack=this.packSize(item);
      let slot=slotIndex??-1;
      if(slot<0)for(let i=0;i<cap;i++)if(L[i]===id&&Cc[i]<pack){slot=i;break}
      if(slot<0)for(let i=0;i<cap;i++)if(!L[i]||Cc[i]===0){slot=i;break}
      if(slot<0||slot>=cap)return false;
      if(L[slot]!==id){this.addStock(L[slot],Cc[slot]);L[slot]=id;Cc[slot]=0}
      Cc[slot]+=this.takeStock(id,pack-Cc[slot]);
    }
    this.rememberCurrentFrameLoadout();this.save();this.renderWorkshop();this.renderShop();return true
  }
  unloadSlot(i,slotType='consumable'){
    if(this.equipmentLocked())return false;
    if(slotType==='weapon'){if(!this.state.weaponLoadout)return false;this.addStock(this.state.weaponLoadout,1);this.state.weaponLoadout=null}
    else{
      const limit=slotType==='internal'?this.internalSlotCount():this.activeSlotCount();if(i<0||i>=limit)return false;
      if(slotType==='internal'){const id=this.state.internalLoadout[i];if(!id)return false;this.addStock(id,1);this.state.internalLoadout[i]=null}
      else{const id=this.state.loadout[i];if(!id)return false;this.addStock(id,this.state.loadoutCharges[i]);this.state.loadout[i]=null;this.state.loadoutCharges[i]=0}
    }
    this.rememberCurrentFrameLoadout();this.save();this.renderWorkshop();this.renderShop();return true
  }
  // Fill every assigned consumable slot to its pack size: stock first, then (when
  // `buy` and auto-restock is on) the shortfall from the market at restock price.
  restockPlan(){
    const cap=this.activeSlotCount(),plan=[];let cost=0;const stock={...this.state.inventory};
    for(let i=0;i<cap;i++){
      const id=this.state.loadout[i],item=id?this.items[id]:null;if(!item)continue;
      const need=Math.max(0,this.packSize(item)-(this.state.loadoutCharges[i]||0));if(!need)continue;
      const fromStock=Math.min(need,stock[id]||0);stock[id]=(stock[id]||0)-fromStock;
      const short=need-fromStock,access=this.productAccess(item),unit=Math.round((Number(item.price)||0)*this.restockDiscount());
      const buy=access.ok?short:0;cost+=buy*unit;plan.push({slot:i,id,fromStock,buy,unit,blocked:short-buy});
    }
    return {plan,cost}
  }
  topUpLoadout(buy=false){
    const {plan}=this.restockPlan();let spent=0,missing=0;
    for(const p of plan){
      this.state.loadoutCharges[p.slot]+=this.takeStock(p.id,p.fromStock);
      if(buy&&this.state.autoRestock&&p.buy>0){
        const afford=Math.min(p.buy,Math.floor((this.state.money-spent)/Math.max(1,p.unit)));
        if(afford>0){spent+=afford*p.unit;this.state.loadoutCharges[p.slot]+=afford}
        missing+=p.buy-Math.max(0,afford)
      }
    }
    if(spent>0)this.state.money-=spent;
    return {spent,missing}
  }
  // Put back any slot that lost its item (a failed run, a skipped debrief, a frame
  // swap) from the frame's remembered profile, falling back to the last kit that
  // actually launched, so auto-restock always knows what to buy.
  refillSlotIdsFromProfile(){
    const cap=this.activeSlotCount(),internalCap=this.internalSlotCount();
    const own=this.normaliseFrameProfile(this.state.frameLoadouts?.[this.state.drone]);
    const lastRaw=this.state.lastLaunchLoadout,useLast=lastRaw&&lastRaw.frame!==this.state.drone&&!own.consumables.some(Boolean);
    const last=this.normaliseFrameProfile(useLast?lastRaw:null);
    for(let i=0;i<cap;i++){
      if(this.state.loadout[i])continue;
      const id=own.consumables[i]||last.consumables[i],item=id?this.items[id]:null;
      if(!item||item.slot!=='consumable'||this.state.loadout.includes(id))continue;
      this.state.loadout[i]=id;this.state.loadoutCharges[i]=this.takeStock(id,this.packSize(item));
    }
    for(let i=0;i<internalCap;i++){
      if(this.state.internalLoadout[i])continue;
      const id=own.internals[i],item=id?this.items[id]:null;
      if(!item||item.slot!=='internal'||(this.state.inventory[id]||0)<1)continue;
      this.state.inventory[id]--;this.state.internalLoadout[i]=id;
    }
    const w=own.weapon;
    if(!this.state.weaponLoadout&&w&&this.items[w]?.slot==='weapon'&&!this.items[w].free&&(this.state.inventory[w]||0)>0){this.state.inventory[w]--;this.state.weaponLoadout=w}
  }
  deployLoadout(){
    this.normalizeLoadout();
    this.refillSlotIdsFromProfile();
    const restock=this.topUpLoadout(true);this.lastRestock=restock;
    this.rememberCurrentFrameLoadout();this.state.lastLaunchLoadout={...this.state.frameLoadouts[this.state.drone],frame:this.state.drone};
    this.activeLoadout=this.state.loadout.slice(0,4);this.activeCharges=this.state.loadoutCharges.slice(0,4);
    this.activeInternalLoadout=this.state.internalLoadout.slice(0,4);this.activeWeapon=this.state.weaponLoadout||'laser1';
    this.state.deployedKit={frame:this.state.drone,loadout:this.activeLoadout.slice(),charges:this.activeCharges.slice(),internals:this.activeInternalLoadout.slice(),weapon:this.activeWeapon,dead:false};
    this.state.loadout=[null,null,null,null];this.state.loadoutCharges=[0,0,0,0];this.state.internalLoadout=[null,null,null,null];this.state.weaponLoadout=null;
    this.resetCombatEffects();this.save()
  }
  recoverUnusedLoadout(recover=true){
    if(recover){
      for(let i=0;i<4;i++)this.addStock(this.activeLoadout[i],this.slotCharges(i));
      for(const id of this.activeInternalLoadout)this.addStock(id,1);
      if(this.activeWeapon&&this.activeWeapon!=='laser1')this.addStock(this.activeWeapon,1);
    }
    this.clearActiveLoadout()
  }
  // v307: the deployed kit lives in memory during a run, so it is mirrored into
  // the save. A reload mid-mission returns it to stores (as an abandon); a reload
  // after the drone was destroyed reopens the insurance claims instead.
  syncDeployedKit(){const k=this.state.deployedKit;if(!k||!this.currentMission)return;k.charges=this.activeCharges.slice();k.loadout=this.activeLoadout.slice()}
  markDeployedKitLost(){const k=this.state.deployedKit;if(!k)return;this.syncDeployedKit();k.dead=true;this.save()}
  recoverOrphanedKit(){
    const k=this.state.deployedKit;if(!k||typeof k!=='object'){delete this.state.deployedKit;return false}
    delete this.state.deployedKit;
    const internals=(k.internals||[]).filter(id=>this.items[id]),weapon=k.weapon&&k.weapon!=='laser1'&&this.items[k.weapon]?k.weapon:null;
    if(k.dead){
      const frameId=this.frames[k.frame]?k.frame:'AX-1',lost=(k.loadout||[]).filter((id,i)=>id&&(k.charges?.[i]||0)>0);
      if(frameId!=='AX-1'){this.state.ownedFrames=this.state.ownedFrames.filter(id=>id!==frameId);if(!this.state.ownedFrames.includes('AX-1'))this.state.ownedFrames.unshift('AX-1');if(this.state.drone===frameId)this.state.drone='AX-1'}
      this.state.pendingInsurance={title:'Contract interrupted',reason:'Drone destroyed',destroyedFrameId:frameId,frameExcess:this.frameReplacementExcess(frameId),lostConsumables:lost,insuredItems:[...internals,...(weapon?[weapon]:[])],returnPanel:'missions',resolved:{}};
    }else{
      (k.loadout||[]).forEach((id,i)=>{if(id&&this.items[id])this.addStock(id,Math.max(0,k.charges?.[i]|0))});
      internals.forEach(id=>this.addStock(id,1));if(weapon)this.addStock(weapon,1);
    }
    this.normalizeLoadout();return true
  }
  boardRefreshFee(){return this.state.freeBoardRefresh===false?150*this.levelForXP():0}
  clearActiveLoadout(){if(this.state){if(this.state.deployedKit)delete this.state.deployedKit;this.state.freeBoardRefresh=true}this.activeLoadout=[null,null,null,null];this.activeCharges=[0,0,0,0];this.activeInternalLoadout=[null,null,null,null];this.activeWeapon='laser1'}
  slotCharges(i){const id=this.activeLoadout[i];if(!id)return 0;const c=this.activeCharges?.[i];return Number.isFinite(c)?Math.max(0,c):1}
  updateGearHud(){
    if(!gearHudEl)return;
    // Training hides consumables until the dedicated consumables lesson. That stage
    // deliberately exposes slot 1 so the player learns the numbered-slot control.
    const tutorialConsumables=!!(this.currentMission?.training&&this.currentStage?.()?.tutorialConsumables);
    const active=!!this.currentMission&&!this.open&&mode!=='simulatorCut'&&mode!=='dead'&&(!this.currentMission.training||tutorialConsumables);
    gearHudEl.classList.toggle('show',active);gearHudEl.innerHTML='';if(!active)return;
    const cap=this.activeSlotCount();
    for(let i=0;i<cap;i++){
      const id=this.activeLoadout[i],item=id?this.items[id]:null,n=this.slotCharges(i),ready=!!item&&n>0,el=document.createElement('div');
      el.className='gearHudSlot'+(ready?' ready':' empty used');
      el.setAttribute('aria-label',`Consumable ${i+1}: ${item?`${item.name}, ${n} left`:'empty'}`);
      const key=tutorialConsumables?String(i+1):(i===0?'MMB':String(i+1));
      el.innerHTML=`<span class="gearHudKey">${key}</span><span class="gearHudIcon">${item?this.itemIcon(item.id):this.itemIcon(null)}</span><span class="gearHudLabel">${item?`${item.hud}${n>1||!ready?` ×${n}`:''}`:'EMPTY'}</span>`;
      gearHudEl.appendChild(el)
    }
  }
  currentMissileTarget(){
    if(mode==='play'&&phase==='surface'&&groundAssault?.active)return groundAssault.missileTarget();
    if(mode!=='play'||phase!=='space')return null;
    const id=spaceLockId||spacePursuitId;
    return id?fighters.find(f=>f.id===id&&!f.dead&&!f.dying)||null:null
  }
  hostilesInView(max=99){
    if(typeof fighters==='undefined')return [];
    if(mode==='play'&&phase==='surface'&&groundAssault?.active)return groundAssault.inView(max);
    return fighters.filter(f=>!f.dead&&!f.dying&&f.t>=0).map(f=>({f,q:camPoint([f.x,f.y,f.z])})).filter(o=>{if(o.q[2]<=1)return false;const p=projectCam(o.q);return p&&p.x>-40&&p.x<W+40&&p.y>-40&&p.y<viewH+40}).sort((a,b)=>a.q[2]-b.q[2]).slice(0,max).map(o=>o.f)
  }
  useActiveSlot(i){
    if(!this.currentMission||this.open||i<0||i>=this.activeSlotCount())return false;
    const id=this.activeLoadout[i],item=id?this.items[id]:null;if(!item||this.slotCharges(i)<1)return false;
    const spend=(msg,hold=.6)=>{this.activeCharges[i]=this.slotCharges(i)-1;this.syncDeployedKit();this.save();this.updateGearHud();if(msg)say(msg,hold);return true};
    const fx=this.fx;
    if(item.effect==='shieldBoost'){
      if(shield>=this.maxShield()){say('SHIELDS FULL',.45);return false}
      const before=shield;shield=Math.min(this.maxShield(),shield+(item.restore||2));shieldRegenDelay=shieldRegenTick=0;hud();
      return spend(`SHIELD BOOST +${shield-before}`)
    }
    if(item.effect==='homingMissile'){
      const target=this.currentMissileTarget();if(!target){say('NO MISSILE TARGET',.45);return false}
      if(!launchHomingMissile(target,item.missileDamage||6,item.missileSpeed||72)){say('MISSILE NOT AVAILABLE',.45);return false}
      return spend(`${item.name.toUpperCase()} AWAY`,.55)
    }
    if(item.effect==='cluster'){
      const targets=this.hostilesInView(4);if(!targets.length){say('NO TARGETS IN VIEW',.45);return false}
      for(let k=0;k<4;k++)launchHomingMissile(targets[k%targets.length],item.missileDamage||6,item.missileSpeed||80);
      return spend(`CLUSTER AWAY · ${targets.length} TARGET${targets.length>1?'S':''}`,.55)
    }
    if(item.effect==='nanite'){
      if(fx.naniteLeft>0){say('NANITES ALREADY WORKING',.45);return false}
      if(shield>=this.maxShield()){say('SHIELDS FULL',.45);return false}
      fx.naniteLeft=item.total||3;fx.naniteT=.35;return spend('NANITE REPAIR ACTIVE')
    }
    if(item.effect==='overcharge'){fx.overchargeT=Math.max(fx.overchargeT,item.duration||6);return spend('LASERS OVERCHARGED')}
    if(item.effect==='flare'){fx.flareT=Math.max(fx.flareT,item.duration||4);for(const b of bolts)b.flared=false;flash=Math.max(flash,.05);return spend('DECOY FLARE')}
    if(item.effect==='emp'){
      const hit=this.hostilesInView();for(const f of hit)f.stunT=Math.max(f.stunT||0,item.duration||3);
      let cleared=0;for(const b of bolts)if(!b.dead){b.dead=true;cleared++;const p=boltScreenPoint?.(b);if(p)spark(p.x,p.y,C.c,8)}
      flash=Math.max(flash,.14);shake=Math.max(shake,2.5);SoundFX.projectileDestroyed?.();
      return spend(`EMP · ${hit.length} STALLED${cleared?` · ${cleared} PROJECTILES CLEARED`:''}`)
    }
    return false
  }
  useSecondaryFire(){
    for(let i=0;i<this.activeSlotCount();i++)if(this.activeLoadout[i]&&this.slotCharges(i)>0)return this.useActiveSlot(i);
    say('SECONDARY EMPTY',.35);return false
  }
  insuranceExcessRate(){
    if(this.hasSkill('insurance2'))return .10;
    if(this.hasSkill('insurance'))return .20;
    return .30
  }
  trainingInsuranceDiscount(){return this.state.trainingInsuranceBenefit?.01:0}
  insuredLiability(base){
    const excess=Math.max(0,Number(base)||0)*this.insuranceExcessRate();
    return Math.round(excess*(1-this.trainingInsuranceDiscount()))
  }
  frameReplacementExcess(frameId=this.state.drone){const f=this.frames[frameId]||this.frames['AX-1'];return f.id==='AX-1'?0:this.insuredLiability(f.price)}
  contractPayMultiplier(risk=1){
    let m=1;
    if(this.hasSkill('negotiator'))m+=.10;
    if(this.hasSkill('negotiator2'))m+=.10;
    return m
  }
  positiveRepMultiplier(){return this.hasSkill('connections')?1.25:1}
  contractSlotCount(){return this.hasSkill('connections')?7:6}

  contractRiskForSlot(slot){
    const lvl=this.levelForXP(),centre=1+Math.floor((lvl-1)*.55);
    const offsets=[-2,-1,0,0,1,2,1];
    return clamp(centre+(offsets[slot%offsets.length]||0),1,this.maxContractRisk())
  }
  pickFaction(allowed=null,templateWeights=null){
    const ids=Array.isArray(allowed)&&allowed.length?allowed.filter(id=>this.factions[id]):Object.keys(this.factions).filter(id=>id!=='quickbite');
    if(!ids.length)return'trade';
    // Most templates keep the original reputation-weighted faction draw. A template
    // may additionally express that its premise is naturally more common for some
    // clients; multiply that authored weight by the existing reputation weight rather
    // than replacing reputation as a campaign influence.
    if(templateWeights&&typeof templateWeights==='object'){
      const weighted=ids.map(id=>{
        const rep=this.factions[id].rep||0,repWeight=rep>=60?5:(rep>=25?4:(rep>=-20?3:(rep>=-55?2:1)));
        return{id,weight:repWeight*Math.max(0,Number(templateWeights[id]??1)||0)}
      }).filter(x=>x.weight>0);
      if(weighted.length){
        const total=weighted.reduce((n,x)=>n+x.weight,0),roll=Math.random()*total;let acc=0;
        for(const x of weighted){acc+=x.weight;if(roll<=acc)return x.id}
        return weighted[weighted.length-1].id
      }
    }
    const weighted=[];
    for(const id of ids){
      const rep=this.factions[id].rep||0;
      const weight=rep>=60?5:(rep>=25?4:(rep>=-20?3:(rep>=-55?2:1)));
      for(let i=0;i<weight;i++)weighted.push(id)
    }
    return weighted[(Math.random()*weighted.length)|0]||ids[0]||'trade'
  }
  missionTemplate(id){return globalThis.AgentXMissionData?.templates?.[id]||null}
  templateChoice(values,fallback=''){
    const a=Array.isArray(values)?values:[];return a.length?a[(Math.random()*a.length)|0]:fallback
  }
  formatTemplateText(text,vars={}){
    return String(text??'').replace(/\{([A-Za-z0-9_]+)\}/g,(all,key)=>Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):all)
  }
  templateRisk(template){
    const cfg=template?.risk||{},level=this.levelForXP(),minLevel=Math.max(1,Number(template?.minLevel)||1),step=Math.max(1,Math.round(Number(cfg.levelsPerStep)||2));
    const floorRisk=Math.max(1,Math.round(Number(cfg.min)||1));
    let risk=(Number(cfg.base)||1)+Math.floor(Math.max(0,level-minLevel)/step);
    const jitter=Math.max(0,Math.round(Number(cfg.jitter)||0));
    if(jitter)risk+=((Math.random()*(jitter*2+1))|0)-jitter;
    const cap=Math.max(floorRisk,Math.min(Math.max(1,Number(cfg.max)||9),this.maxContractRisk()));
    return clamp(Math.round(risk),floorRisk,cap)
  }
  resolveTemplateValue(value,vars={}){
    if(typeof value==='string'&&value.charAt(0)==='$')return vars[value.slice(1)]??value;
    if(Array.isArray(value))return value.map(v=>this.resolveTemplateValue(v,vars));
    if(value&&typeof value==='object'){
      // Resolve a data-authored random choice once when the contract is generated.
      // This is useful for true mission requirements such as planet-vs-moon landing,
      // where the runtime must receive one stable answer rather than reroll per frame.
      if(Array.isArray(value.choices)&&value.choices.length){
        const choices=value.choices,weights=Array.isArray(value.weights)?value.weights:[];
        const weighted=choices.map((choice,i)=>({choice,weight:Math.max(0,Number(weights[i]??1)||0)})).filter(x=>x.weight>0);
        if(weighted.length){
          const total=weighted.reduce((n,x)=>n+x.weight,0),roll=Math.random()*total;let acc=0;
          for(const x of weighted){acc+=x.weight;if(roll<=acc)return this.resolveTemplateValue(x.choice,vars)}
          return this.resolveTemplateValue(weighted[weighted.length-1].choice,vars)
        }
        return this.resolveTemplateValue(choices[0],vars)
      }
      if(Object.prototype.hasOwnProperty.call(value,'base')&&(Object.prototype.hasOwnProperty.call(value,'perRisk')||Object.prototype.hasOwnProperty.call(value,'random'))){
        const base=Number(value.base)||0,perRisk=Number(value.perRisk)||0,random=Math.max(0,Number(value.random)||0);
        let result=base+perRisk*(Number(vars.risk)||0)+Math.random()*random;
        if(value.round)result=Math.round(result);
        if(Number.isFinite(Number(value.min)))result=Math.max(Number(value.min),result);
        if(Number.isFinite(Number(value.max)))result=Math.min(Number(value.max),result);
        return result
      }
      return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,this.resolveTemplateValue(v,vars)]))
    }
    return value
  }
  templateEncounterChoice(template,faction){
    const table=template?.encounterTable,weights=table?.weightsByFaction?.[faction]||table?.weights||{},entries=table?.entries||{};
    const choices=[];
    for(const [id,rawWeight] of Object.entries(weights)){
      const weight=Math.max(0,Number(rawWeight)||0);
      if(!weight)continue;
      const entry=id==='none'?{id:'none'}:entries[id];
      if(!entry)continue;
      choices.push({id,weight,entry})
    }
    if(!choices.length)return null;
    const total=choices.reduce((n,x)=>n+x.weight,0),roll=Math.random()*total;
    let acc=0;
    for(const choice of choices){acc+=choice.weight;if(roll<=acc)return{id:choice.id,...choice.entry}}
    const last=choices[choices.length-1];return{id:last.id,...last.entry}
  }
  makeTemplateContract(template,slot=0,options={}){
    if(!template)return null;
    const allowed=Array.isArray(template.allowedFactions)?template.allowedFactions.filter(id=>this.factions[id]):[];
    const requestedFaction=String(options?.faction||'');
    const faction=(requestedFaction&&this.factions[requestedFaction]&&(!allowed.length||allowed.includes(requestedFaction))&&template.presentation?.[requestedFaction])
      ?requestedFaction
      :this.pickFaction(template.allowedFactions,template.factionWeights);
    const risk=this.templateRisk(template),pack=template.presentation?.[faction]||{},defaults=template.defaults||{},encounter=this.templateEncounterChoice(template,faction),brief=this.templateChoice(pack.briefs,null);
    const destination=String(brief?.destination||this.templateChoice(pack.destinations,defaults.destination||'Contract Destination')||defaults.destination||'Contract Destination'),cargo=this.templateChoice(pack.cargo,defaults.cargo||'sealed cargo'),targetGroup=String(brief?.target||defaults.target||'hostile group'),motive=String(brief?.motive||''),situation=String(brief?.situation||''),targetProfile=String(brief?.profile||'standard'),title=this.templateChoice(brief?.titles||pack.titles,template.id||'Contract');
    const textVars={...defaults,cargo,destination,target:targetGroup,motive,situation,profile:targetProfile,faction:this.factions[faction]?.name||faction,risk};
    const description=this.formatTemplateText(this.templateChoice(brief?.descriptions||pack.descriptions,'Complete the assigned contract.'),textVars);
    const sectionVars={...defaults,risk,cargo,destination,target:targetGroup,motive,situation,profile:targetProfile,faction};
    const planetaryRequirements=this.resolveTemplateValue(template.planetaryRequirements||{},sectionVars);
    const modules=(template.sections||[]).filter(section=>{
      const only=Array.isArray(section?.onlyFactions)?section.onlyFactions:null,exclude=Array.isArray(section?.excludeFactions)?section.excludeFactions:null;
      return (!only||only.includes(faction))&&(!exclude||!exclude.includes(faction))
    }).flatMap(section=>{
      if(section.type==='template_encounter'){
        if(!encounter)return[];
        const selected=encounter.id==='none'?(section.none||null):encounter;
        if(!selected)return[];
        const params=this.resolveTemplateValue(selected.params||{},sectionVars);
        const module={type:selected.type||'fighters',label:section.label||selected.label||'Approach Encounter',difficulty:risk,...params};
        if(encounter.id!=='none')module.encounterId=encounter.id;
        if(selected.profile)module.profile=selected.profile;
        if(pack.cargoStyle)module.cargoStyle=pack.cargoStyle;
        return[module]
      }
      const params=this.resolveTemplateValue(section.params||{},sectionVars);
      const module={type:section.type,label:section.label||section.type,difficulty:risk,...params};
      if(pack.cargoStyle)module.cargoStyle=pack.cargoStyle;
      return[module]
    });
    const reward=template.reward||{},roundPay=Math.max(1,Math.round(Number(reward.roundPay)||50)),fighterModule=modules.find(x=>x.type==='fighters'||x.type==='customs_drones'),asteroidModule=modules.find(x=>x.type==='asteroids');
    const fighterWork=fighterModule?Math.max(0,Number(fighterModule.target)||0)*(1.45+Math.max(0,Number(fighterModule.fighterHp)||12)*.36):0;
    const asteroidWork=asteroidModule?Math.max(0,Number(asteroidModule.target)||0):0;
    const rawPay=(Number(reward.basePay)||0)+(Number(reward.payPerRisk)||0)*risk+(Number(reward.payRiskSquare)||0)*risk*risk+(Number(reward.payPerFighterWork)||0)*fighterWork+(Number(reward.payPerAsteroidWork)||0)*asteroidWork+Math.random()*Math.max(0,Number(reward.randomPay)||0);
    const pay=Math.round((rawPay*this.contractPayMultiplier(risk))/roundPay)*roundPay;
    const xp=Math.round((Number(reward.baseXp)||0)+(Number(reward.xpPerRisk)||0)*risk+(Number(reward.xpRiskSquare)||0)*risk*risk+(Number(reward.xpPerFighterWork)||0)*fighterWork+(Number(reward.xpPerAsteroidWork)||0)*asteroidWork);
    const difficulty=risk<=1?1:(risk<=3?2:(risk<=5?3:5)),serial=(this.state.boardGeneration||0)*10+slot;
    return{
      id:`proc_${Date.now().toString(36)}_${serial}_${((Math.random()*0xffffff)|0).toString(36)}`,
      faction,title,kind:'procedural',family:template.family||template.id,templateId:template.id,templateVersion:template.version||1,
      cargo,destination,cargoStyle:pack.cargoStyle||'',targetGroup,motive,situation,targetProfile,musicMode:template.musicMode||null,
      planetaryRequirements,
      risk,minLevel:template.minLevel||1,minRep:-100,pay,xp,difficulty,implemented:true,intelStyle:template.intelStyle||'hiddenGroup',scenarioVersion:11,boardSchemaVersion:this.contractBoardSchemaVersion(),
      description,modules:this.scaleContractToughness(modules,risk),stages:modules.map(x=>x.label)
    }
  }
  contractBoardSchemaVersion(){return 3}
  boardRules(){return globalThis.AgentXMissionData?.boardRules||{}}
  eligibleMissionTemplates(){
    const lvl=this.levelForXP(),templates=Object.values(globalThis.AgentXMissionData?.templates||{});
    return templates.filter(template=>{
      if(!template||template.board?.enabled===false)return false;
      const minLevel=Math.max(1,Number(template.minLevel)||1);
      if(lvl<minLevel)return false;
      if(template.maxLevel!=null&&lvl>Number(template.maxLevel))return false;
      const allowed=Array.isArray(template.allowedFactions)?template.allowedFactions:[];
      return !allowed.length||allowed.some(id=>this.factions[id]);
    })
  }
  templateBoardCategory(template){return String(template?.board?.category||template?.family||template?.id||'other')}
  templateBoardWeight(template){
    const fallback=Math.max(0,Number(this.boardRules().defaultWeight)||1);
    return Math.max(0,Number(template?.board?.weight??fallback)||0)
  }
  templateBoardMaxPerBoard(template){
    const fallback=Math.max(1,Math.round(Number(this.boardRules().defaultMaxPerTemplate)||2));
    return Math.max(1,Math.round(Number(template?.board?.maxPerBoard)||fallback))
  }
  requiredBoardCategories(eligible=this.eligibleMissionTemplates()){
    const available=new Set(eligible.map(t=>this.templateBoardCategory(t)));
    return (Array.isArray(this.boardRules().requiredCategories)?this.boardRules().requiredCategories:[]).filter(category=>available.has(String(category))).map(String)
  }
  weightedMissionTemplate(candidates){
    const weighted=(candidates||[]).map(template=>({template,weight:this.templateBoardWeight(template)})).filter(x=>x.weight>0);
    if(!weighted.length)return null;
    const total=weighted.reduce((sum,x)=>sum+x.weight,0),roll=Math.random()*total;
    let acc=0;
    for(const x of weighted){acc+=x.weight;if(roll<=acc)return x.template}
    return weighted[weighted.length-1].template
  }
  pickMissionTemplate(existingContracts=[],options={}){
    const eligible=this.eligibleMissionTemplates();
    if(!eligible.length)return null;
    const counts=new Map(),categories=new Set();
    for(const mission of existingContracts||[]){
      const id=String(mission?.templateId||'');
      if(id)counts.set(id,(counts.get(id)||0)+1);
      const template=id?this.missionTemplate(id):null;
      if(template)categories.add(this.templateBoardCategory(template))
    }
    let candidates=eligible.filter(template=>(counts.get(template.id)||0)<this.templateBoardMaxPerBoard(template));
    if(!candidates.length)candidates=eligible.slice();

    // Do not let pure RNG produce a one-note board. When the final open slots
    // are needed to preserve one of the configured core categories, reserve
    // those slots for the missing categories. The order is shuffled afterwards,
    // so this does not create visible fixed-category positions.
    const missing=this.requiredBoardCategories(eligible).filter(category=>!categories.has(category));
    const remaining=Math.max(1,Math.round(Number(options.remainingSlots)||1));
    if(missing.length&&remaining<=missing.length){
      const required=candidates.filter(template=>missing.includes(this.templateBoardCategory(template)));
      if(required.length)candidates=required
    }

    const avoidId=String(options.avoidTemplateId||'');
    if(avoidId){
      const alternatives=candidates.filter(template=>template.id!==avoidId);
      if(alternatives.length)candidates=alternatives
    }
    return this.weightedMissionTemplate(candidates)
  }
  shuffleContractBoard(board){
    for(let i=board.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[board[i],board[j]]=[board[j],board[i]]}
    return board
  }
  boardTemplateSignature(board){
    return (Array.isArray(board)?board:[]).map(m=>String(m?.templateId||m?.family||'')).sort().join('|')
  }
  proceduralTitle(faction,family){
    const titles={
      trade:{
        asteroids:['Lane Clearance','Hazard Removal','Shipping Lane Sweep'],
        fighters:['Pirate Suppression','Escort Route Sweep','Free Trader Defence'],
        combo:['Route Sanitisation','Dangerous Passage','Priority Corridor'],
        deep_core:['Contracted Strike','Hostile Facility Removal']
      },
      security:{
        asteroids:['Orbital Debris Sweep','Navigation Hazard Clearance','Approach Lane Security'],
        fighters:['Interceptor Sweep','Outer Patrol','Hostile Contact Sweep'],
        combo:['Corridor Pacification','Security Route Clearance','Threat Suppression'],
        deep_core:['Deep Core Strike','Strategic Denial']
      },
      jackals:{
        asteroids:['Breakout Lane','Quiet Passage','Smuggler Route Clearance'],
        fighters:['Pursuit Breaker','No Questions Asked','Rival Sweep'],
        combo:['Escape Corridor','Hot Route','Clear the Way'],
        deep_core:['Black Site Raid','Hard Target'],
        jackal_party_delivery:['Party Supplies','After Hours Delivery','Penthouse Drop']
      },
      helix:{
        asteroids:['Survey Corridor Clearance','Mining Approach Sweep','Debris Suppression'],
        fighters:['Asset Defence','Perimeter Sweep','Security Clearance'],
        combo:['Prospecting Route','Industrial Corridor','Survey Route Security'],
        deep_core:['Asset Denial','Facility Strike']
      },
      quickbite:{
        food_delivery:["Miner's Lunch",'Hot Food Run','Belt Lunch Delivery']
      }
    };
    const a=titles[faction]?.[family]||['Contract'];
    return a[(Math.random()*a.length)|0]
  }
  makeProceduralContract(slot=0,forcedFamily=null,boardContext=[]){
    const template=forcedFamily?this.missionTemplate(forcedFamily):this.pickMissionTemplate(boardContext,{remainingSlots:1});
    if(template)return this.makeTemplateContract(template,slot);
    const family=forcedFamily||'fighters';
    const risk=family==='food_delivery'?1:(family==='jackal_party_delivery'?clamp(this.contractRiskForSlot(slot),2,5):this.contractRiskForSlot(slot));
    const faction=family==='food_delivery'?'quickbite':(family==='jackal_party_delivery'?'jackals':this.pickFaction());
    const asteroidTarget=clamp(7+risk*3+((Math.random()*6)|0),8,42);
    // The contract knows the real size and toughness of the hostile group, but the
    // operator is not given a game-like kill quota. Pay is the practical clue.
    const fighterTarget=clamp(4+risk+((Math.random()*3)|0),5,18);
    const fighterHp=clamp(12+Math.floor((risk-1)/3)*2,12,18);
    const modules=[];
    if(family==='food_delivery'){
      modules.push({type:'courier_food',label:'Food Delivery',difficulty:1,routeSeconds:21+Math.random()*4})
    }else if(family==='jackal_party_delivery'){
      const customsTarget=clamp(5+risk,7,10);
      const customsHp=clamp(12+Math.floor(Math.max(0,risk-2)/2)*2,12,16);
      // v215 scenario engine: the old monolithic customs/descent/city mission is
      // expressed as reusable pieces. The flow controller owns the hand-offs.
      modules.push({type:'customs_drones',label:'Customs Intercept',difficulty:risk,target:customsTarget,fighterHp:customsHp});
      modules.push({type:'planet_descent',label:'Planet Descent',difficulty:risk});
      // Reusable surface destination approach: land on open terrain, acquire a
      // world-space destination marker, and physically travel to the city before
      // the urban traffic module takes over. This is deliberately a generic piece
      // rather than bespoke party-delivery choreography.
      modules.push({type:'surface_destination_approach',label:'Plains Approach',difficulty:risk,terrain:'plains',destination:'city',routeLength:430,treeClumps:9});
      modules.push({type:'jackal_city_delivery',label:'Penthouse Delivery',difficulty:risk,cityLength:620})
    }else if(family==='asteroids'){
      modules.push({type:'asteroids',label:'Asteroid Clearance',target:asteroidTarget,difficulty:risk})
    }else if(family==='fighters'){
      modules.push({type:'fighters',label:'Interceptor Sweep',target:fighterTarget,fighterHp,difficulty:risk})
    }else if(family==='combo'){
      modules.push({type:'asteroids',label:'Marked Hazard Clearance',target:asteroidTarget,difficulty:risk,markedTargets:true});
      modules.push({type:'fighters',label:'Pirate Defence',target:fighterTarget,fighterHp,difficulty:risk})
    }else{
      // Deep-core contracts are also composed: ordinary fighter combat can now
      // be reused independently from the descent and the surface/base assault.
      modules.push({type:'fighters',label:'Orbital Defenders',target:clamp(fighterTarget+2,8,18),fighterHp,difficulty:risk});
      modules.push({type:'planet_descent',label:'Planet Descent',difficulty:risk});
      modules.push({type:'deep_core_surface',label:'Surface / Reactor Strike',difficulty:risk})
    }

    const asteroid=modules.find(x=>x.type==='asteroids');
    const fighters=modules.find(x=>x.type==='fighters');
    let description='';
    if(family==='food_delivery'){
      description='A miner at a remote belt site has ordered lunch. Get the sandwich through the rocks and into the mine while it is still recognisably food.'
    }else if(family==='jackal_party_delivery'){
      description='A Red Jackal client wants a sealed case of “party supplies” delivered directly to a city penthouse. Customs are expected to object. Fight through the customs drones, descend to the plains, navigate to the city and make the hatch delivery.'
    }else if(family==='asteroids'){
      const where=faction==='helix'?'industrial approach':(faction==='trade'?'commercial lane':(faction==='security'?'navigation corridor':'covert route'));
      description=`Clear ${asteroid.target} hazardous asteroids from a ${where}.`
    }else if(family==='fighters'){
      const who=faction==='jackals'?'pursuit craft':'hostile raiders';
      description=`A group of ${who} is threatening operations in the sector. Clear them out.`
    }else if(family==='combo'){
      description='Clear the marked hazards from the route, then deal with the hostile group operating beyond it.'
    }else{
      description='Break through orbital defenders, descend to the surface, breach the installation and destroy its reactor.'
    }

    // Fighter pay derives from the hidden real group: more hulls and tougher hulls
    // both push the offer upward, so the reward itself becomes useful intelligence.
    const fighterWork=fighters?fighters.target*(1.45+fighters.fighterHp*.36):0;
    const customs=modules.find(x=>x.type==='customs_drones'||x.type==='jackal_party_delivery');
    const customsWork=customs?customs.target*(1.55+customs.fighterHp*.38)+28:0;
    const workload=(asteroid?.target||0)*1.0+fighterWork+customsWork+(family==='deep_core'?38+risk*5:0);
    const basePay=family==='food_delivery'?(250+((Math.random()*3)|0)*50):(family==='jackal_party_delivery'?Math.round((1400+workload*78+risk*risk*110)/50)*50:Math.round((500+workload*82+risk*risk*95)/50)*50);
    // Costs rise about x4 per equipment tier; ordinary earnings rise more gently.
    // The workload/risk formula already grows naturally, so these modest tier multipliers
    // bring the overall result close to the intended ~x2 money / ~x1.5-1.7 XP rhythm.
    const rewardTier=clamp(1+Math.floor((risk-1)/2),1,5),payScale=[0,1,1.35,1.8,2.5,3.5][rewardTier],xpScale=[0,1,1.15,1.35,1.60,1.90][rewardTier];
    const pay=family==='food_delivery'?Math.round(basePay*this.contractPayMultiplier(risk)):Math.round((basePay*payScale*this.contractPayMultiplier(risk))/50)*50;
    const xp=family==='food_delivery'?55:Math.round((55+workload*(family==='jackal_party_delivery'?6.2:7)+risk*18)*xpScale);
    const difficulty=family==='food_delivery'?1:(risk<=1?1:(risk<=3?2:(risk<=5?3:5)));
    const serial=(this.state.boardGeneration||0)*10+slot;
    return{
      id:`proc_${Date.now().toString(36)}_${serial}_${((Math.random()*0xffffff)|0).toString(36)}`,
      faction,title:this.proceduralTitle(faction,family),kind:'procedural',
      family,risk,minLevel:1,minRep:-100,pay,xp,difficulty,implemented:true,intelStyle:'hiddenGroup',scenarioVersion:11,boardSchemaVersion:this.contractBoardSchemaVersion(),
      description,modules:this.scaleContractToughness(modules,risk),stages:modules.map(x=>x.label)
    }
  }
  generateContractBoardCandidate(){
    const board=[],slots=this.contractSlotCount();
    for(let i=0;i<slots;i++){
      const template=this.pickMissionTemplate(board,{remainingSlots:slots-i});
      if(!template)break;
      board.push(this.makeTemplateContract(template,i))
    }
    return this.shuffleContractBoard(board)
  }
  generateContractBoard(){
    this.state.boardGeneration=(this.state.boardGeneration||0)+1;
    const previous=this.boardTemplateSignature(this.state.contractBoard),slots=this.contractSlotCount();
    let board=[];
    // Refresh should normally change the actual mix of mission families, not just
    // reroll titles and payouts. A few retries are enough while still allowing an
    // identical mix when the eligible catalogue is temporarily very small.
    for(let attempt=0;attempt<8;attempt++){
      const candidate=this.generateContractBoardCandidate();
      board=candidate;
      if(candidate.length!==slots||!previous||this.boardTemplateSignature(candidate)!==previous)break
    }
    // Defensive fallback: all current ordinary mission families are templates,
    // but never leave the board short if malformed future data removes them all.
    while(board.length<slots)board.push(this.makeProceduralContract(board.length,'fighters',board));
    this.missions=board;
    this.state.contractBoard=JSON.parse(JSON.stringify(board));
    return board
  }
  ensureContractBoard(){
    const b=this.state.contractBoard,lvl=this.levelForXP(),schema=this.contractBoardSchemaVersion(),templates=Object.values(globalThis.AgentXMissionData?.templates||{});
    const templatedFamilies=new Map(templates.map(t=>[String(t?.family||t?.id||''),t]));
    const templateCoverageOk=Array.isArray(b)&&b.every(m=>{
      const t=templatedFamilies.get(String(m?.family||''));
      return !t||(m?.templateId===t.id&&m?.templateVersion===(t.version||1))
    });
    const eligibilityOk=Array.isArray(b)&&b.every(m=>{
      const t=m?.templateId?this.missionTemplate(m.templateId):null;
      if(!t)return false;
      return lvl>=(Number(t.minLevel)||1)&&(t.maxLevel==null||lvl<=Number(t.maxLevel))
    });
    if(Array.isArray(b)&&b.length===this.contractSlotCount()&&templateCoverageOk&&eligibilityOk&&b.every(m=>m&&m.boardSchemaVersion===schema&&m.implemented&&m.intelStyle&&m.scenarioVersion===11&&Array.isArray(m.modules)&&m.modules.length&&(m.risk||1)<=this.maxContractRisk())){
      this.missions=b;
      return
    }
    this.generateContractBoard();
    this.save()
  }
  refreshContracts(){
    this.generateContractBoard();
    this.save();
    if(this.open)this.renderMissions()
  }
  replaceContract(id){
    const i=this.missions.findIndex(m=>m.id===id);
    if(i<0)return;
    const old=this.missions[i],context=this.missions.filter((_,index)=>index!==i);
    this.state.boardGeneration=(this.state.boardGeneration||0)+1;
    const template=this.pickMissionTemplate(context,{remainingSlots:1,avoidTemplateId:old?.templateId});
    this.missions[i]=template?this.makeTemplateContract(template,i):this.makeProceduralContract(i,'fighters',context);
    this.state.contractBoard=JSON.parse(JSON.stringify(this.missions))
  }
  currentStage(){
    return this.currentMission?.modules?.[this.currentStageIndex]||null
  }
  hasMoreStages(){
    return !!this.currentMission&&this.currentStageIndex<(this.currentMission.modules?.length||1)-1
  }
  advanceCurrentMissionStage(){
    if(!this.currentMission)return false;
    // v215: Campaign records progress/rewards; ScenarioFlow owns how one piece
    // hands off to the next and how a terminal piece leaves the mission area.
    return scenarioFlow.completeCurrentStage()
  }

  escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
  }
  hashText(value){
    let h=2166136261>>>0;for(const ch of String(value??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h>>>0
  }
  contactForMission(m){
    const template=m?.templateId?this.missionTemplate(m.templateId):null,pack=template?.presentation?.[m?.faction]||null;
    const explicit=this.contactFromId(pack?.contactId);if(explicit)return explicit;
    const ids=this.contactIdsByFaction?.[m?.faction]||[];if(!ids.length)return null;
    return this.mailContacts[ids[0]]||null
  }
  contactFromId(id){return this.mailContacts?.[id]||null}
  missionEncounterTag(m){
    const a=Array.isArray(m?.encounters)?m.encounters:[];
    const preferred=['customs_intercept','pirate_ambush','rogue_drones','xeno_swarm','station_xeno'];
    return preferred.find(id=>a.includes(id))||a[0]||''
  }
  templateCivilianSettlement(m){
    const template=m?.templateId?this.missionTemplate(m.templateId):null,policy=template?.civilianTrafficPolicy;
    if(!policy||typeof jackalDelivery==='undefined'||!jackalDelivery?.settlement)return null;
    const raw=jackalDelivery.settlement(),incidents=Math.max(0,Number(raw?.incidents)||0),assaults=Math.max(0,Number(raw?.shots)||0),collisions=Math.max(0,Number(raw?.collisions)||0);
    if(!incidents)return{incidents:0,assaults,collisions,severity:0,payMultiplier:1,repMultiplier:1,allowGift:true,failureRepPenalty:0};
    const severity=Math.max(1,collisions*Math.max(0,Number(policy.collisionWeight)||1)+assaults*Math.max(0,Number(policy.assaultWeight)||2));
    const tiers=Array.isArray(policy.tiers)?policy.tiers:[];
    const tier=tiers.filter(t=>severity>=(Number(t.min)||1)&&(t.max==null||severity<=Number(t.max))).sort((a,b)=>(Number(b.min)||0)-(Number(a.min)||0))[0]||{};
    return{incidents,assaults,collisions,severity,payMultiplier:Number.isFinite(Number(tier.payMultiplier))?Number(tier.payMultiplier):1,repMultiplier:Number.isFinite(Number(tier.repMultiplier))?Number(tier.repMultiplier):1,allowGift:tier.allowGift!==false,failureRepPenalty:Math.max(0,Math.round(Number(tier.failureRepPenalty)||0))}
  }
  routineMailText(templateId,vars={}){
    if(templateId==='mission_template_complete_v1'){
      const template=this.missionTemplate(vars.missionTemplateId),f=this.factions[vars.faction],pack=template?.presentation?.[vars.faction]||{};
      const subjects=Array.isArray(pack.completionSubjects)?pack.completionSubjects:[],bodies=Array.isArray(pack.completionBodies)?pack.completionBodies:[];
      const subject=subjects.length?subjects[Math.abs(Number(vars.subjectVariant)||0)%subjects.length]:`Contract complete: ${vars.title||'Contract'}`;
      const bodyTemplate=bodies.length?bodies[Math.abs(Number(vars.bodyVariant)||0)%bodies.length]:'Contract completion confirmed. Payment: CR {credits}. Standing: +{rep}.';
      const textVars={cargo:vars.cargo||'',destination:vars.destination||'',target:vars.target||'',motive:vars.motive||'',situation:vars.situation||'',credits:Number(vars.credits||0).toLocaleString(),rep:Math.max(0,Number(vars.repGain)||0),faction:f?.name||vars.faction||''};
      const body=[this.formatTemplateText(bodyTemplate,textVars)],encounter=String(vars.encounter||'');
      const encounterPool=Array.isArray(pack.encounterAcknowledgements?.[encounter])?pack.encounterAcknowledgements[encounter]:[];
      if(encounterPool.length){
        const line=encounterPool[Math.abs(Number(vars.encounterVariant)||0)%encounterPool.length];
        body.splice(Math.min(1,body.length),0,this.formatTemplateText(line,textVars))
      }
      return{from:`${f?.name||'Client Network'} · Contract Desk`,subject,body}
    }
    if(templateId==='mission_template_failure_v1'){
      const template=this.missionTemplate(vars.missionTemplateId),pack=template?.presentation?.[vars.faction]||{},outcome=vars.outcome==='abandoned'?'abandoned':'failed';
      const reaction=outcome==='abandoned'?(pack.abandonMail||{}):(pack.failureMail||{}),contact=this.contactFromId(vars.contactId||reaction.contactId||pack.contactId),f=this.factions[vars.faction];
      const subjects=Array.isArray(reaction.subjects)?reaction.subjects:[],bodies=Array.isArray(reaction.bodies)?reaction.bodies:[];
      const subject=subjects.length?subjects[Math.abs(Number(vars.subjectVariant)||0)%subjects.length]:(outcome==='abandoned'?'CONTRACT ABANDONED':'MISSION FAILED');
      const bodyTemplate=bodies.length?bodies[Math.abs(Number(vars.bodyVariant)||0)%bodies.length]:(outcome==='abandoned'?'You abandoned the contract. Do not repeat that performance.':'The contract failed. Your performance was unacceptable.');
      const textVars={cargo:vars.cargo||'',destination:vars.destination||'',target:vars.target||'',motive:vars.motive||'',situation:vars.situation||'',reason:vars.reason||'',faction:f?.name||vars.faction||'',incidents:Math.max(0,Number(vars.civilianIncidents)||0),assaults:Math.max(0,Number(vars.civilianAssaults)||0),collisions:Math.max(0,Number(vars.civilianCollisions)||0)};
      const body=this.formatTemplateText(bodyTemplate,textVars),mailBody=[body],civil=reaction===pack.abandonMail?(pack.civilianTrafficMail?.abandonAddenda||[]):(pack.civilianTrafficMail?.failureAddenda||[]);
      if(textVars.incidents>0&&Array.isArray(civil)&&civil.length)mailBody.push(this.formatTemplateText(civil[Math.abs(Number(vars.civilianVariant)||0)%civil.length],textVars));
      const from=contact?`${contact.name} · ${contact.role}, ${f?.name||''}`.replace(/, $/,''):`${f?.name||'Client Network'} · Contract Liaison`;
      return{from,subject,body:mailBody}
    }
    if(templateId==='mission_template_civilian_v1'){
      const template=this.missionTemplate(vars.missionTemplateId),pack=template?.presentation?.[vars.faction]||{},reaction=pack.civilianTrafficMail||{},contact=this.contactFromId(vars.contactId||reaction.contactId||pack.contactId),f=this.factions[vars.faction];
      const assaults=Math.max(0,Number(vars.assaults)||0),collisions=Math.max(0,Number(vars.collisions)||0),incidents=Math.max(0,Number(vars.incidents)||0),assault=assaults>0;
      const subjects=assault?(reaction.assaultSubjects||reaction.subjects||[]):(reaction.incidentSubjects||reaction.subjects||[]),bodies=assault?(reaction.assaultBodies||reaction.bodies||[]):(reaction.incidentBodies||reaction.bodies||[]);
      const subject=subjects.length?subjects[Math.abs(Number(vars.subjectVariant)||0)%subjects.length]:(assault?'CIVILIAN TRAFFIC ASSAULT':'CIVILIAN TRAFFIC INCIDENT');
      const bodyTemplate=bodies.length?bodies[Math.abs(Number(vars.bodyVariant)||0)%bodies.length]:'Civilian traffic was involved during the contract. The settlement has been reduced.';
      const textVars={cargo:vars.cargo||'',destination:vars.destination||'',credits:Number(vars.credits||0).toLocaleString(),fullCredits:Number(vars.fullCredits||0).toLocaleString(),incidents,assaults,collisions,incidentWord:incidents===1?'incident':'incidents',assaultWord:assaults===1?'assault':'assaults',collisionWord:collisions===1?'collision':'collisions',faction:f?.name||vars.faction||''};
      const body=this.formatTemplateText(bodyTemplate,textVars),from=contact?`${contact.name} · ${contact.role}, ${f?.name||''}`.replace(/, $/,''):`${f?.name||'Client Network'} · Contract Liaison`;
      return{from,subject,body:[body]}
    }
    if(templateId==='mission_template_personal_v1'){
      const template=this.missionTemplate(vars.missionTemplateId),pack=template?.presentation?.[vars.faction]||{},personal=pack.personalFollowUp||{},contact=this.contactFromId(vars.contactId||personal.contactId||pack.contactId),f=this.factions[vars.faction],encounter=String(vars.encounter||'');
      const encounterFollowups=Array.isArray(personal.encounterBodies?.[encounter])?personal.encounterBodies[encounter]:[];
      const followups=encounterFollowups.length?encounterFollowups:(Array.isArray(personal.bodies)?personal.bodies:(Array.isArray(pack.personalFollowups)?pack.personalFollowups:[])),subjects=Array.isArray(personal.subjects)?personal.subjects:[];
      const bodyTemplate=followups.length?followups[Math.abs(Number(vars.bodyVariant)||0)%followups.length]:'Good work, X.',subject=subjects.length?subjects[Math.abs(Number(vars.subjectVariant)||0)%subjects.length]:`Re: ${vars.title||'Contract'}`;
      const body=this.formatTemplateText(bodyTemplate,{cargo:vars.cargo||'',destination:vars.destination||'',target:vars.target||'',motive:vars.motive||'',situation:vars.situation||'',credits:Number(vars.credits||0).toLocaleString(),rep:Math.max(0,Number(vars.repGain)||0),faction:f?.name||vars.faction||''});
      const from=contact?`${contact.name} · ${contact.role}, ${f?.name||''}`.replace(/, $/,''):`${f?.name||'Client Network'} · Contract Liaison`;
      return{from,subject,body:[body]}
    }
    const rewardPack=globalThis.AgentXMissionData?.rewardMail?.[vars.faction]||null,isRewardMail=templateId==='gift_credits_v1'||templateId==='gift_item_v1'||templateId==='gift_discount_v1';
    const contact=this.contactFromId((isRewardMail?rewardPack?.contactId:null)||vars.contactId||rewardPack?.contactId),f=this.factions[vars.faction],name=contact?.name||(f?.name||'Contract Desk'),role=contact?.role||'Contract Desk';
    const from=contact?`${name} · ${role}, ${f?.name||''}`.replace(/, $/,''):`${f?.name||'Client Network'} · Contract Desk`;
    const title=String(vars.title||'Contract'),rep=Math.max(0,Number(vars.repGain)||0),encounter=vars.encounter||'',tone=contact?.tone||'formal',variantRaw=Math.abs(Number(vars.variant)||0),variant=variantRaw%3;
    const renderRewardMail=(kind,textVars,fallbackSubject,fallbackBody)=>{
      const spec=rewardPack?.[kind]||null,subjects=Array.isArray(spec?.subjects)?spec.subjects:[],variants=Array.isArray(spec?.bodies)?spec.bodies:[];
      if(!spec)return{from,subject:fallbackSubject,body:fallbackBody};
      const subject=subjects.length?subjects[variantRaw%subjects.length]:fallbackSubject,selected=variants.length?variants[variantRaw%variants.length]:fallbackBody;
      const lines=(Array.isArray(selected)?selected:[selected]).filter(v=>v!=null&&String(v)!=='').map(v=>this.formatTemplateText(v,textVars));
      return{from,subject,body:lines.length?lines:fallbackBody}
    };
    const encounterLine=encounter==='station_xeno'
      ?({flirty:'Sweetie, Relay 10 says you cleared a whole xeno infestation on the way in. Big guns, nasty xenos, parcel still delivered. You do know how to show off for me.',warm:'Babe, Relay 10 also logged the xeno infestation. You were hired to move freight, not clear a swarm, but you handled it anyway.',terse:'Relay 10 also logged the xeno infestation. That was outside the delivery brief. Noted.',polished:'Relay 10 reported the xeno infestation on your approach. Clearing it was beyond the contracted delivery scope, and it has been noted.',clipped:'Additional action recorded: xeno infestation cleared at Relay 10. Outside tasking. Good work.',rough:'Those xeno grints at Relay 10 were not in the brief. You cleared them anyway. Fronking good work.',formal:'Relay 10 recorded an unplanned xeno infestation during your approach. Your successful clearance action has been added to the completion record.',warmrough:'Sweetie, Relay 10 says you cleared a whole xeno mess on the way in. That was not the job, but it was fronking appreciated.',dry:'Relay 10 appended “xeno infestation” to an otherwise routine delivery record. Apparently routine was too much to ask.',casual:'Relay 10 says you had xenos all over the approach. Nice work clearing the drass before you landed.'}[tone]||'An unplanned xeno infestation was cleared during the contract. The additional action has been noted.')
      :'';
    if(templateId==='contract_complete_v1'){
      let subject=`Contract complete: ${title}`,body=[];
      if(tone==='flirty')body=[variant===0?`Sweetie, ${title} is signed off. I do enjoy watching you make dangerous work look attractive.`:(variant===1?`Babe, that one is closed. You and that big armed drone are becoming terribly good at making me happy.`:`${title} is done, gorgeous. Try not to look too pleased with yourself.`),`VOX has released the contract payment. Standing change: +${rep}.`];
      else if(tone==='warm')body=[variant===0?`Sweetie, ${title} is signed off.`:(variant===1?`Babe, that one is closed.`:`${title} is done and dusted, sweetie.`),`VOX has released the contract payment. Standing change: +${rep}.`];
      else if(tone==='terse')body=[`${title}: closed.`,`Payment released through VOX. Standing +${rep}.`];
      else if(tone==='polished')body=[`Completion of “${title}” has been confirmed.`,`Payment has been released through VOX. Standing change: +${rep}.`];
      else if(tone==='clipped')body=[`Confirmed complete: ${title}.`,`Settlement released. Standing +${rep}.`];
      else if(tone==='rough')body=[variant===0?`That was fronking solid work on ${title}.`:`${title} is closed. No drass left for us to clean up.`,`VOX has the settlement moving. Standing +${rep}.`];
      else if(tone==='formal')body=[`Completion of “${title}” is confirmed.`,`The agreed settlement has been released through VOX. Standing change: +${rep}.`];
      else if(tone==='warmrough')body=[variant===0?`Babe, that was fronking nice work.`:`Sweetie, ${title} is closed and nobody important is shouting at me. Perfect.`,`Payment is released. Standing +${rep}.`];
      else if(tone==='dry')body=[variant===0?`Against several reasonable expectations, ${title} is complete.`:`${title} has reached the unlikely state of being finished.`,`VOX has released payment. Standing +${rep}.`];
      else body=[variant===0?`Nice one, X. ${title} is closed.`:`All sorted on ${title}.`,`Payment is through VOX. Standing +${rep}.`];
      if(encounterLine)body.splice(1,0,encounterLine);
      return{from,subject,body}
    }
    if(templateId==='quickbite_complete_v1'){
      const body=[`Dude, ${title} is done.`,encounterLine||'Nobody is yelling at me right now. Awesome.','Payment is through.'].filter(Boolean);
      return{from,subject:`DONE: ${title}`,body}
    }
    if(templateId==='gift_credits_v1'){
      const amount=Math.max(0,Number(vars.amount)||0),amountText=amount.toLocaleString();
      return renderRewardMail('credits',{amount:amountText,faction:f?.name||vars.faction||''},'Small discretionary bonus',[`CR ${amountText} has been attached to your VOX account. This is separate from the contract settlement.`])
    }
    if(templateId==='gift_item_v1'){
      const item=this.items[vars.itemId],itemName=item?.name||'equipment';
      return renderRewardMail('item',{item:itemName,faction:f?.name||vars.faction||''},`Courtesy issue: ${itemName}`,[`One ${itemName} has been released to your VOX workshop account. No invoice.`])
    }
    if(templateId==='gift_discount_v1'){
      const item=this.items[vars.itemId],itemName=item?.name||'equipment',pct=Math.round((Number(vars.percent)||.10)*100);
      return renderRewardMail('discount',{item:itemName,percent:pct,faction:f?.name||vars.faction||''},`Supplier concession: ${itemName}`,[`${pct}% off one purchase of ${itemName}.`])
    }
    return{from:vars.from||'VOX SYSTEM',subject:vars.subject||'Message',body:['Message template unavailable.']}
  }
  naturalMailSubject(subject){
    const raw=String(subject||'Message').trim();
    const letters=raw.match(/[A-Za-z]/g)||[];
    if(!letters.length||letters.some(ch=>ch>='a'&&ch<='z'))return raw;
    let out=raw.toLowerCase();
    out=out.replace(/\b(vox|osd|xp|cr|ai|rmb|lmb)\b/g,token=>token.toUpperCase());
    out=out.replace(/\bax-1\b/g,'AX-1');
    return out.replace(/[a-z]/,ch=>ch.toUpperCase())
  }
  resolveMail(message){
    if(!message)return message;
    if(!message.templateId)return{...message,subject:this.naturalMailSubject(message.subject)};
    const r=this.routineMailText(message.templateId,message.vars||{});
    return{...message,...r,subject:this.naturalMailSubject(r.subject),body:Array.isArray(r.body)?r.body:[String(r.body||'')]}
  }
  mailPriority(message){
    const p=String(message?.priority||'').toLowerCase();
    if(p==='medium')return 'normal';
    if(p==='low'||p==='normal'||p==='high')return p;
    if(message?.category==='story'||message?.action?.type==='story')return 'high';
    if(message?.reward||message?.category==='gift'||message?.category==='network'||message?.category==='system')return 'normal';
    if(message?.category==='faction')return 'low';
    return 'normal'
  }
  mailPriorityLabel(message){const p=this.mailPriority(message);return p==='high'?'HIGH':(p==='low'?'LOW':'NORMAL')}
  unreadMailCount(){return this.state.mail.reduce((n,m)=>n+(!m.read&&this.mailPriority(m)!=='low'?1:0),0)}
  unreadMailHasHigh(){return this.state.mail.some(m=>!m.read&&this.mailPriority(m)==='high')}
  noteMailVoice(priority){
    const p=String(priority||'').toLowerCase();
    if(p==='low')return;
    if(p==='high'||this.pendingMailVoicePriority!=='high')this.pendingMailVoicePriority=p==='high'?'high':'normal'
  }
  beginPostMissionVoiceHold(){this.deferHubVoiceNotifications=true}
  queueSkillPointReminder(){if(this.skillPointsAvailable()>0)this.pendingSkillPointVoice=true}
  flushHubVoiceNotifications(){
    if(this.deferHubVoiceNotifications)return;
    const mailPriority=this.pendingMailVoicePriority,skill=!!this.pendingSkillPointVoice&&this.skillPointsAvailable()>0;
    this.pendingMailVoicePriority=null;this.pendingSkillPointVoice=false;
    if(mailPriority){audio.playVoice(mailPriority==='high'?'mailImportant':'mailNormal',{once:false,priority:false})}
    if(skill)audio.playVoice('unspentSkillPoints',{once:false,priority:false,delayBeforeMs:mailPriority?1000:350})
  }
  closeMissionDebrief(returnPanel){
    this.deferHubVoiceNotifications=false;
    this.render();this.setPanel(returnPanel||'missions');
    this.flushHubVoiceNotifications()
  }
  enqueueMail(message){
    if(!message||!message.id)return false;
    if(this.state.mail.some(m=>m.id===message.id))return false;
    const compact=!!message.templateId;
    const entry={
      id:message.id,seq:++this.state.mailSeq,
      ...(compact?{templateId:message.templateId,vars:(message.vars&&typeof message.vars==='object')?message.vars:{}}:{from:message.from||'VOX SYSTEM',subject:message.subject||'Message',body:Array.isArray(message.body)?message.body:[String(message.body||'')]}),
      category:message.category||'general',priority:this.mailPriority(message),
      read:!!message.read,action:message.action||null,actions:Array.isArray(message.actions)?message.actions:null,reward:message.reward||null,claimed:!!message.claimed,
      ...(message.contract?{contract:message.contract,contractDone:!!message.contractDone}:{})
    };
    this.state.mail.push(entry);
    this.noteMailVoice(entry.priority);
    if(this.state.mail.length>100){
      // Never prune the welcome mail (it would be re-sent as new) or anything with live actions;
      // a reward that has already been claimed no longer needs keeping.
      const removable=[...this.state.mail].sort((a,b)=>a.seq-b.seq).find(m=>m.read&&m.category!=='story'&&m.id!=='welcome_vox'&&(!m.reward||m.claimed)&&!m.action&&!(Array.isArray(m.actions)&&m.actions.length));
      if(removable)this.state.mail=this.state.mail.filter(m=>m.id!==removable.id)
    }
    this.save();this.updateMailBadge();return true
  }
  ensureWelcomeMail(){
    const body=[
      'Your Vector Operations Exchange remote-combat contractor account is now active.',
      'VOX brokers work between independent operators and client networks, holds contract payments, records reputation and provides access to approved equipment suppliers.',
      'You have been allocated one AX-1 general-purpose drone under the basic replacement scheme. The AX-1 frame is replaced free if destroyed. Consumables are expendable and permanent fitted hardware is subject to your current insurance excess.',
      'Complete ordinary work to build experience, credits and standing. Better relationships can expose equipment before your operator level would normally bring it to market.',
      'Try not to destroy anything the client did not ask you to destroy.'
    ];
    const actions=[
      {type:'tutorial',tutorialId:'movement_shooting',label:'START SIMULATOR'},
      {type:'panel',panel:'missions',label:'VIEW AVAILABLE CONTRACTS'}
    ];
    const existing=this.state.mail.find(m=>m.id==='welcome_vox');
    if(existing){
      // Upgrade old saves as well as fresh accounts, otherwise Dave's existing
      // welcome message would never gain the simulator button because mail IDs are unique.
      let changed=false;
      if(JSON.stringify(existing.body)!==JSON.stringify(body)){existing.body=body;changed=true}
      if(JSON.stringify(existing.actions)!==JSON.stringify(actions)){existing.actions=actions;changed=true}
      if(existing.action){existing.action=null;changed=true}
      if(changed)this.save();
      return false
    }
    return this.enqueueMail({
      id:'welcome_vox',from:'Mara Venn · Contractor Services, VOX',subject:'Welcome to VOX / AX-1 allocation',category:'system',priority:'normal',
      body,actions
    })
  }
  tutorialMission(id='movement_shooting'){
    if(id!=='movement_shooting')return null;
    return{
      id:'tutorial_movement_shooting',title:'VOX Simulator',kind:'tutorial',family:'tutorial',training:true,private:true,
      faction:null,risk:0,minLevel:1,minRep:-100,pay:0,xp:0,difficulty:3,implemented:true,
      description:'VOX contractor simulator.',
      modules:[
        {type:'asteroids',label:'Movement & Shooting',target:5,difficulty:3,tutorial:true,tutorialStaticCut:true},
        // Stage 2 teaches hostile-projectile interception, sustained RMB target lock,
        // and using the locked target's double-chevron off-screen direction cue.
        {type:'fighters',label:'Pirate Combat',target:999,fighterHp:12,difficulty:2,tutorial:true,tutorialPreview:true,tutorialCombat:true},
        // Stage 3 teaches numbered consumable use under pressure. Pirate drones use
        // the planetary-drone meshes for visual variety while retaining space-combat AI.
        {type:'fighters',label:'Consumables',target:999,fighterHp:20,difficulty:2,tutorial:true,tutorialPreview:true,tutorialConsumables:true,tutorialDroneSwarm:true},
        // Stage 4 demonstrates mission abandonment as the survival option when the
        // operator is already at critical shields and has no recovery consumable.
        {type:'fighters',label:'Emergency Withdrawal',target:999,fighterHp:20,difficulty:3,tutorial:true,tutorialPreview:true,tutorialAbandon:true},
        // Stage 5 is one continuous final exercise: normal planet descent, open-plains
        // navigation to a bunker, autopilot entry, tunnel obstacle run, reactor and escape.
        {type:'tutorial_final_run',label:'Navigation / Reactor Run',difficulty:2,tutorial:true,tutorialFinalRun:true}
      ],
      stages:['Movement & Shooting','Pirate Combat','Consumables','Emergency Withdrawal','Navigation / Reactor Run']
    }
  }
  launchTutorial(id='movement_shooting'){
    if(this.currentMission||this.pendingMission)return false;
    const m=this.tutorialMission(id);if(!m)return false;
    this.currentMission=m;this.pendingMission=null;this.currentStageIndex=0;
    this.clearActiveLoadout();
    this.open=false;campaignShell.classList.remove('open');this.updateGearHud();
    level=1;
    audio.music.setMode('calm');audio.resetMissionVoices();
    reset({deferMissionStart:true});paused=false;document.body.classList.remove('paused');last=performance.now();
    const stage=m.modules[0];scenarioFlow.prepareStage(stage);scenarioFlow.enterStage(stage,{via:'simulator',mission:m});
    return true
  }
  finishTraining(success=true,reason=''){
    const m=this.currentMission;if(!m?.training)return false;
    asteroidField.stop();
    this.clearActiveLoadout();
    this.currentMission=null;this.currentStageIndex=0;this.updateGearHud();

    // The VOX training insurance benefit is awarded exactly once. Re-running the
    // simulator must never stack additional discounts or generate duplicate mail.
    if(success&&!this.state.trainingInsuranceBenefit){
      this.state.trainingInsuranceBenefit=true;
      this.beginPostMissionVoiceHold();
      this.enqueueMail({
        id:'vox_training_insurance_benefit',
        from:'VOX Insurance Services',
        subject:'Training completion / insurance benefit applied',
        category:'system',
        priority:'high',
        body:[
          'Congratulations on completing the VOX Drone Training Simulation.',
          'VOX Insurance Services has applied a training-completion benefit to your contractor account.',
          'Future insurance excess payments are reduced by 1%.',
          'TRAINING BENEFIT: INSURANCE EXCESS PAYMENTS -1%'
        ]
      });
      this.save();
    }

    paused=true;document.body.classList.add('paused');
    this.showDebrief({training:true,success,heading:success?'SIMULATOR COMPLETE':'SIMULATION ENDED',title:m.title,pay:0,xp:0,liability:0,reason,returnPanel:'mail'});
    return true
  }
  updateSkillBadge(){
    const badge=document.getElementById('skillPointsBadge'),tab=document.querySelector('.campaignTab[data-tab="perks"]'),n=Math.max(0,this.skillPointsAvailable()|0);
    if(badge){badge.textContent=String(n);badge.hidden=n<1}
    if(tab)tab.classList.toggle('hasSkillPoints',n>0)
  }
  updateMailBadge(){
    this.updateSkillBadge?.();
    const badge=document.getElementById('mailUnreadBadge'),tab=document.querySelector('.campaignTab[data-tab="mail"]'),n=this.unreadMailCount(),high=this.unreadMailHasHigh();
    if(badge){badge.textContent=String(n);badge.hidden=n<1;badge.classList.toggle('high',high);badge.classList.toggle('normal',n>0&&!high)}
    if(tab){tab.classList.toggle('hasUnread',n>0);tab.classList.toggle('hasHighUnread',high);tab.classList.toggle('hasNormalUnread',n>0&&!high)}
  }
  markMailRead(id){
    const m=this.state.mail.find(x=>x.id===id);if(!m||m.read)return false;
    m.read=true;this.save();this.updateMailBadge();return true
  }
  missionClientName(m){return m?.clientName||this.factions[m?.faction]?.name||'Private client'}
  storyContract(id){return globalThis.AgentXStoryContent.contract(id)}
  storyOfferMail(id){return globalThis.AgentXStoryContent.offerMail(id)}
  storyBriefingMail(id){return globalThis.AgentXStoryContent.briefingMail?.(id)||null}
  devStoryMailOptions(){return globalThis.AgentXStoryContent.devMailOptions()}
  devSendStoryMail(contractId){
    if(this.currentMission||this.pendingMission)return{ok:false,reason:'Finish or abandon the active/prepared mission first.'};
    const offer=this.storyOfferMail(contractId),contract=this.storyContract(contractId);
    if(!offer||!contract)return{ok:false,reason:'That story mission is not implemented yet.'};

    // Reset only this story contract's mail/progression so the offer can be tested
    // repeatedly without disturbing ordinary faction reputation, money or contracts.
    if(contractId==='mara_signal_1'){
      const ids=new Set(['mara_offer_1','mara_wait_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.maraOffer1;
      delete this.state.mailFlags.mara1Done;
      delete this.state.mailFlags.mara1CompletedAt;
      this.state.mailFlags.maraOffer1=true;
    }else if(contractId==='mara_signal_2'){
      const ids=new Set(['mara_offer_2','mara_wait_2']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.maraOffer2;
      delete this.state.mailFlags.mara2Done;
      delete this.state.mailFlags.mara2CompletedAt;
      this.state.mailFlags.maraOffer2=true;
    }
    else if(contractId==='kudo_defence_1'){
      const ids=new Set(['kudo_offer_1','kudo_wait_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.kudoOffer1;
      delete this.state.mailFlags.kudo1Done;
      delete this.state.mailFlags.kudo1CompletedAt;
      this.state.mailFlags.kudoOffer1=true;
    }
    else if(contractId==='kudo_bunker_2'){
      const ids=new Set(['kudo_offer_2','kudo_wait_2']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.kudoOffer2;
      delete this.state.mailFlags.kudo2Done;
      delete this.state.mailFlags.kudo2CompletedAt;
      this.state.mailFlags.kudoOffer2=true;
    }
    else if(contractId==='corvella_manifest_1'){
      const ids=new Set(['corvella_offer_1','corvella_wait_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.corvellaOffer1;
      delete this.state.mailFlags.corvella1Done;
      delete this.state.mailFlags.corvella1CompletedAt;
      this.state.mailFlags.corvellaOffer1=true;
    }
    else if(contractId==='cassian_favour_1'){
      const ids=new Set(['mara_manifest_1','cassian_offer_1','cassian_wait_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.cassianOffer1;
      delete this.state.mailFlags.cassian1Done;
      delete this.state.mailFlags.cassian1CompletedAt;
      this.state.mailFlags.cassianOffer1=true;
    }
    else if(contractId==='helix_xeno_samples_1'){
      const ids=new Set(['mara_xeno_1','helix_offer_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.helixOffer1;
      delete this.state.mailFlags.helix1Done;
      delete this.state.mailFlags.helix1CompletedAt;
      this.state.mailFlags.helixOffer1=true;
    }
    else if(contractId==='taco_beacon_false_lead_1'){
      const ids=new Set(['taco_beacon_offer_1','taco_beacon_briefing_1','taco_beacon_wait_1']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.tacoBeaconOffer1;
      delete this.state.mailFlags.nyxo1Done;
      delete this.state.mailFlags.nyxo1CompletedAt;
      this.state.mailFlags.tacoBeaconOffer1=true;
    }
    else if(contractId==='helix_xeno_nest_2'){
      const ids=new Set(['helix_nest_offer_2','helix_nest_wait_2']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.helixNestOffer2;
      delete this.state.mailFlags.helix2Done;
      delete this.state.mailFlags.helix2CompletedAt;
      this.state.mailFlags.helixNestOffer2=true;
    }
    else if(contractId==='quickbite_route_anomaly_2'){
      const ids=new Set(['quickbite_route_offer_2','quickbite_route_wait_2']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.quickbiteRouteOffer2;
      delete this.state.mailFlags.nyxo2Done;
      delete this.state.mailFlags.nyxo2CompletedAt;
      this.state.mailFlags.quickbiteRouteOffer2=true;
    }
    else if(contractId==='mara_signal_3'){
      const ids=new Set(['mara_offer_3','mara_wait_3']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.maraOffer3;
      delete this.state.mailFlags.mara3Done;
      delete this.state.mailFlags.mara3CompletedAt;
      this.state.mailFlags.maraOffer3=true;
    }
    else if(contractId==='kudo_factory_3'){
      const ids=new Set(['kudo_offer_3','kudo_wait_3','mara_epilogue_3']);
      this.state.mail=this.state.mail.filter(m=>!ids.has(m.id));
      delete this.state.mailFlags.kudoOffer3;
      delete this.state.mailFlags.kudo3Done;
      delete this.state.mailFlags.kudo3CompletedAt;
      this.state.mailFlags.kudoOffer3=true;this.state.mailFlags.factoryMoonRevision=1;
    }

    if(!this.enqueueMail(offer))return{ok:false,reason:'Could not enqueue story email.'};
    this.selectedMailId=offer.id;
    this.mailFilter='all';
    this.save();
    this.renderMail();
    return{ok:true,mailId:offer.id,label:offer.subject}
  }
  openStoryBriefing(id){
    if(this.currentMission||this.pendingMission)return false;
    const mail=this.storyBriefingMail(id);if(!mail)return false;
    const existing=this.state.mail.find(m=>m.id===mail.id);
    if(!existing)this.enqueueMail(mail);
    this.selectedMailId=mail.id;this.mailFilter='all';this.save();this.renderMail();return true
  }
  prepareStoryContract(id){
    if(this.currentMission||this.pendingMission)return false;
    const m=this.storyContract(id);if(!m)return false;
    this.pendingMission=m;this.save();this.render();this.setPanel('workshop');return true
  }
  evaluateMailTriggers(){
    this.ensureWelcomeMail();
    const flags=this.state.mailFlags,lvl=this.levelForXP();
    // Retire the two placeholder VOX story missions from earlier development saves.
    // Story mission 1 has now been replaced by the real courier-recovery opener, so
    // stale prototype mail/flags must not hide it or launch the discarded follow-up.
    if(!flags.voxStoryRecoveryRevision){
      const legacyStoryMail=new Set(['mara_offer_1','mara_offer_2','mara_wait_1','mara_wait_2']);
      this.state.mail=this.state.mail.filter(m=>!legacyStoryMail.has(m.id));
      delete flags.maraOffer1;delete flags.mara1Done;delete flags.mara1CompletedAt;
      delete flags.maraOffer2;delete flags.mara2Done;delete flags.mara2CompletedAt;
      flags.voxStoryRecoveryRevision=1;
    }
    // Mission 2 now has a real authored implementation. Remove only stale prototype
    // mission-2 mail from saves that passed the earlier recovery migration before this
    // version existed; mission 1 completion will enqueue the new concrete follow-up.
    if(!flags.voxStoryMonolithRevision){
      if(!flags.mara2Done){
        const staleM2=new Set(['mara_offer_2','mara_wait_2']);
        this.state.mail=this.state.mail.filter(m=>!staleM2.has(m.id));
        delete flags.maraOffer2;delete flags.mara2CompletedAt;
      }
      flags.voxStoryMonolithRevision=1;
    }
    // Replace the superseded mission-2 reveal on existing saves. Node 42 is
    // genuine Partition War hardware; the mystery is that it is active. Completing
    // that mission now hands the thread to Kudo for an immediate station defence.
    if(!flags.voxStoryKudoHandoffRevision){
      if(flags.mara2Done&&!flags.kudo1Done){
        this.state.mail=this.state.mail.filter(m=>m.id!=='mara_wait_2'&&m.id!=='kudo_offer_1');
        this.enqueueMail(globalThis.AgentXStoryContent.completionMail('mara_signal_2'));
        flags.kudoOffer1=true;
        this.enqueueMail(this.storyOfferMail('kudo_defence_1'))
      }
      flags.voxStoryKudoHandoffRevision=1;
    }
    if(!flags.voxStoryKudoBunkerRevision){
      if(flags.kudo1Done&&!flags.kudo2Done&&!this.state.mail.some(m=>m.id==='kudo_offer_2')){
        flags.kudoOffer2=true;
        this.enqueueMail(this.storyOfferMail('kudo_bunker_2'))
      }
      flags.voxStoryKudoBunkerRevision=1;
    }
    // Existing saves that already completed Source Trace should receive the new
    // OSD analysis and Free Traders hand-off once, just like a newly completed run.
    if(!flags.freeTraderManifestRevision){
      if(flags.kudo2Done&&!flags.corvella1Done){
        if(!this.state.mail.some(m=>m.id==='kudo_wait_2'))this.enqueueMail(globalThis.AgentXStoryContent.completionMail('kudo_bunker_2'));
        if(!this.state.mail.some(m=>m.id==='corvella_offer_1')){
          flags.corvellaOffer1=true;this.enqueueMail(this.storyOfferMail('corvella_manifest_1'))
        }
      }
      flags.freeTraderManifestRevision=1;
    }
    // Continue the VOX story after Missing Manifest. Existing saves that already
    // completed Corvella's recovery receive Mara's referral and Cassian's favour once.
    if(!flags.cassianFavourRevision){
      if(flags.corvella1Done&&!flags.cassian1Done){
        if(!this.state.mail.some(m=>m.id==='mara_manifest_1'))this.enqueueMail({
          id:'mara_manifest_1',from:'Mara Venn · Contractor Services, VOX',subject:'Off the books',category:'story',priority:'high',
          body:[
            'Corvella sent me the recorder extract. The carrier made an undeclared transfer during the diversion. Part of the cargo left the ship there and vanished from the legitimate freight system.',
            'VOX can follow paperwork. There is no paperwork after that point.',
            'I need someone who works comfortably without it. Cassian Erivan-Snade has agreed to look. “Agreed” may be generous. He knows you are coming and will almost certainly want something first.',
            'Do the minimum necessary. I want his information, not a Red Jackal apprenticeship.'
          ]
        });
        if(!this.state.mail.some(m=>m.id==='cassian_offer_1')){
          flags.cassianOffer1=true;this.enqueueMail(this.storyOfferMail('cassian_favour_1'))
        }
      }
      flags.cassianFavourRevision=1;
    }
    // Cassian's procurement trace hands the biological lead back to Mara, who
    // refers it to Navira Derris. Existing saves that already completed the favour
    // should receive the referral and Helix field-sample mission once.
    if(!flags.helixFieldSamplesRevision){
      if(flags.cassian1Done&&!flags.helix1Done){
        if(!this.state.mail.some(m=>m.id==='mara_xeno_1'))this.enqueueMail({
          id:'mara_xeno_1',from:'Mara Venn · Contractor Services, VOX',subject:'Biological lead',category:'story',priority:'high',
          body:[
            'Cassian found the biological-containment shipment. That is the first part of his trace I cannot use without specialist help.',
            'I sent the details to Navira Derris at Helix. She wants fresh xeno material before she tells me what the equipment may have been intended for.',
            'There is a station under xeno attack in the same broad region. Navira thinks it gives us a cleaner sample than deliberately provoking a nest.',
            'She will brief you directly.'
          ]
        });
        if(!this.state.mail.some(m=>m.id==='helix_offer_1')){
          flags.helixOffer1=true;this.enqueueMail(this.storyOfferMail('helix_xeno_samples_1'))
        }
      }
      flags.helixFieldSamplesRevision=1;
    }
    // Helix now needs real research time before the nest operation. During that
    // pause Mara follows a possible rogue-drone report on a Taco Beacon route.
    // Existing saves that already completed Field Samples receive the same lead.
    if(!flags.tacoBeaconFalseLeadRevision){
      if(flags.helix1Done&&!flags.nyxo1Done&&!this.state.mail.some(m=>m.id==='taco_beacon_offer_1')){
        flags.tacoBeaconOffer1=true;this.enqueueMail(this.storyOfferMail('taco_beacon_false_lead_1'))
      }
      flags.tacoBeaconFalseLeadRevision=1;
    }
    // The Taco Beacon introduction now deliberately chains Mara -> Nyxo before
    // the contract is prepared. Refresh an older stored offer so existing saves get
    // the same two-email briefing instead of launching the job directly from Mara.
    if(!flags.tacoBeaconBriefingRevision){
      if(!flags.nyxo1Done){
        const fresh=this.storyOfferMail('taco_beacon_false_lead_1'),i=this.state.mail.findIndex(m=>m.id==='taco_beacon_offer_1');
        if(i>=0&&fresh){fresh.read=!!this.state.mail[i].read;this.state.mail[i]=fresh}
        else if(flags.helix1Done&&fresh){flags.tacoBeaconOffer1=true;this.enqueueMail(fresh)}
      }
      flags.tacoBeaconBriefingRevision=1;
    }
    // Once the QuickBite false lead has been closed, Navira's tissue analysis is
    // ready. Existing saves that already completed Hot Delivery receive the same
    // Helix follow-up and can launch the authored nest operation from that email.
    if(!flags.helixNestStrikeRevision){
      if(flags.nyxo1Done&&!flags.helix2Done&&!this.state.mail.some(m=>m.id==='helix_nest_offer_2')){
        flags.helixNestOffer2=true;this.enqueueMail(this.storyOfferMail('helix_xeno_nest_2'))
      }
      flags.helixNestStrikeRevision=1;
    }
    // Nyxo's earlier asteroid job established him as a real logistics contact rather
    // than a one-off gag. Once Helix's nest operation is complete, a genuine routing
    // anomaly in QuickBite's network points X at the existing mined relay/beacon.
    if(!flags.quickbiteRouteAnomalyRevision){
      if(flags.helix2Done&&!flags.nyxo2Done&&!this.state.mail.some(m=>m.id==='quickbite_route_offer_2')){
        flags.quickbiteRouteOffer2=true;this.enqueueMail(this.storyOfferMail('quickbite_route_anomaly_2'))
      }
      flags.quickbiteRouteAnomalyRevision=1;
    }
    // Nest Strike now has Navira's debrief (surgical homing-organ extraction).
    // Saves that finished the nest before it existed receive it once.
    if(!flags.helixNestDebriefRevision){
      if(flags.helix2Done&&!this.state.mail.some(m=>m.id==='helix_nest_wait_2')){
        const debrief=globalThis.AgentXStoryContent.completionMail('helix_xeno_nest_2');
        if(debrief)this.enqueueMail(debrief)
      }
      flags.helixNestDebriefRevision=1;
    }
    // Mission 12 (final): saves that finished the carrier before the factory existed get Kudo's offer once.
    if(!flags.factoryMoonRevision){
      if(flags.mara3Done&&!flags.kudo3Done&&!this.state.mail.some(m=>m.id==='kudo_offer_3')){
        flags.kudoOffer3=true;this.enqueueMail(this.storyOfferMail('kudo_factory_3'))
      }
      flags.factoryMoonRevision=1;
    }
    // Mission 11: Mara pulls the threads together and sends X after the carrier.
    if(!flags.maraCarrierInterceptRevision){
      if(flags.nyxo2Done&&!flags.mara3Done&&!this.state.mail.some(m=>m.id==='mara_offer_3')){
        flags.maraOffer3=true;this.enqueueMail(this.storyOfferMail('mara_signal_3'))
      }
      flags.maraCarrierInterceptRevision=1;
    }
    if(this.state.completed>=2&&lvl>=2&&!flags.maraOffer1&&!flags.mara1Done){
      flags.maraOffer1=true;
      this.enqueueMail(this.storyOfferMail('mara_signal_1'))
    }
    // Story mission 2 is handed out directly by Mara's completion mail for mission 1.
    // It deliberately does not also auto-enqueue here, which would duplicate the offer.
  }
  handleStoryCompletion(m){
    if(!m?.storyFlag)return;
    const flags=this.state.mailFlags;
    if(m.storyFlag==='mara1'&&!flags.mara1Done){
      flags.mara1Done=true;flags.mara1CompletedAt=this.state.completed;
      flags.maraOffer2=true;
      const authored=globalThis.AgentXStoryContent.completionMail('mara_signal_1');
      if(authored)this.enqueueMail(authored)
    }
    if(m.storyFlag==='mara2'&&!flags.mara2Done){
      flags.mara2Done=true;flags.mara2CompletedAt=this.state.completed;flags.kudoOffer1=true;flags.voxStoryKudoHandoffRevision=1;
      this.enqueueMail(globalThis.AgentXStoryContent.completionMail('mara_signal_2'));
      this.enqueueMail(this.storyOfferMail('kudo_defence_1'))
    }
    if(m.storyFlag==='kudo1'&&!flags.kudo1Done){
      flags.kudo1Done=true;flags.kudo1CompletedAt=this.state.completed;flags.kudoOffer2=true;flags.voxStoryKudoBunkerRevision=1;
      this.enqueueMail(this.storyOfferMail('kudo_bunker_2'))
    }
    if(m.storyFlag==='kudo2'&&!flags.kudo2Done){
      flags.kudo2Done=true;flags.kudo2CompletedAt=this.state.completed;flags.corvellaOffer1=true;flags.freeTraderManifestRevision=1;
      this.enqueueMail(globalThis.AgentXStoryContent.completionMail('kudo_bunker_2'));
      this.enqueueMail(this.storyOfferMail('corvella_manifest_1'))
    }
    if(m.storyFlag==='corvella1'&&!flags.corvella1Done){
      flags.corvella1Done=true;flags.corvella1CompletedAt=this.state.completed;flags.cassianOffer1=true;flags.cassianFavourRevision=1;
      const authored=globalThis.AgentXStoryContent.completionMail('corvella_manifest_1');
      if(authored)this.enqueueMail(authored);
      this.enqueueMail({
        id:'mara_manifest_1',from:'Mara Venn · Contractor Services, VOX',subject:'Off the books',category:'story',priority:'high',
        body:[
          'Corvella sent me the recorder extract. The carrier made an undeclared transfer during the diversion. Part of the cargo left the ship there and vanished from the legitimate freight system.',
          'VOX can follow paperwork. There is no paperwork after that point.',
          'I need someone who works comfortably without it. Cassian Erivan-Snade has agreed to look. “Agreed” may be generous. He knows you are coming and will almost certainly want something first.',
          'Do the minimum necessary. I want his information, not a Red Jackal apprenticeship.'
        ]
      });
      this.enqueueMail(this.storyOfferMail('cassian_favour_1'))
    }
    if(m.storyFlag==='cassian1'&&!flags.cassian1Done){
      flags.cassian1Done=true;flags.cassian1CompletedAt=this.state.completed;flags.helixOffer1=true;flags.helixFieldSamplesRevision=1;
      const authored=globalThis.AgentXStoryContent.completionMail('cassian_favour_1');
      if(authored)this.enqueueMail(authored);
      this.enqueueMail({
        id:'mara_xeno_1',from:'Mara Venn · Contractor Services, VOX',subject:'Biological lead',category:'story',priority:'high',
        body:[
          'Cassian found the biological-containment shipment. That is the first part of his trace I cannot use without specialist help.',
          'I sent the details to Navira Derris at Helix. She wants fresh xeno material before she tells me what the equipment may have been intended for.',
          'There is a station under xeno attack in the same broad region. Navira thinks it gives us a cleaner sample than deliberately provoking a nest.',
          'She will brief you directly.'
        ]
      });
      this.enqueueMail(this.storyOfferMail('helix_xeno_samples_1'))
    }
    if(m.storyFlag==='helix1'&&!flags.helix1Done){
      flags.helix1Done=true;flags.helix1CompletedAt=this.state.completed;flags.tacoBeaconOffer1=true;flags.tacoBeaconFalseLeadRevision=1;
      this.enqueueMail(this.storyOfferMail('taco_beacon_false_lead_1'))
    }
    if(m.storyFlag==='nyxo1'&&!flags.nyxo1Done){
      flags.nyxo1Done=true;flags.nyxo1CompletedAt=this.state.completed;flags.helixNestOffer2=true;flags.helixNestStrikeRevision=1;
      const authored=globalThis.AgentXStoryContent.completionMail('taco_beacon_false_lead_1');
      if(authored)this.enqueueMail(authored);
      this.enqueueMail(this.storyOfferMail('helix_xeno_nest_2'))
    }
    if(m.storyFlag==='helix2'&&!flags.helix2Done){
      flags.helix2Done=true;flags.helix2CompletedAt=this.state.completed;flags.quickbiteRouteOffer2=true;flags.quickbiteRouteAnomalyRevision=1;flags.helixNestDebriefRevision=1;
      const debrief=globalThis.AgentXStoryContent.completionMail('helix_xeno_nest_2');
      if(debrief)this.enqueueMail(debrief);
      this.enqueueMail(this.storyOfferMail('quickbite_route_anomaly_2'))
    }
    if(m.storyFlag==='nyxo2'&&!flags.nyxo2Done){
      flags.nyxo2Done=true;flags.nyxo2CompletedAt=this.state.completed;flags.maraOffer3=true;flags.maraCarrierInterceptRevision=1;
      const authored=globalThis.AgentXStoryContent.completionMail('quickbite_route_anomaly_2');
      if(authored)this.enqueueMail(authored);
      this.enqueueMail(this.storyOfferMail('mara_signal_3'))
    }
    if(m.storyFlag==='mara3'&&!flags.mara3Done){
      flags.mara3Done=true;flags.mara3CompletedAt=this.state.completed;
      const authored=globalThis.AgentXStoryContent.completionMail('mara_signal_3');
      if(authored)this.enqueueMail(authored);
      // Mission 12 (final): Kudo's strike order follows Mara's "We found the factory".
      flags.kudoOffer3=true;flags.factoryMoonRevision=1;this.enqueueMail(this.storyOfferMail('kudo_factory_3'))
    }
    if(m.storyFlag==='kudo3'&&!flags.kudo3Done){
      flags.kudo3Done=true;flags.kudo3CompletedAt=this.state.completed;
      const authored=globalThis.AgentXStoryContent.completionMail('kudo_factory_3');
      if(authored)this.enqueueMail(authored);
      // Story reward (Dave): a standing boost with every network and a nominal title.
      for(const f of Object.values(this.factions))this.applyRep(f.id,15);
      this.state.title='Moonbreaker';
      const epilogue=globalThis.AgentXStoryContent.epilogueMail?.('kudo_factory_3');
      if(epilogue)this.enqueueMail(epilogue);
      flags.voxNextAt=this.state.completed+2
    }
  }
  queueContractMail(m,repGain){
    const f=this.factions[m?.faction];if(!f||m.private)return;
    const template=m?.templateId?this.missionTemplate(m.templateId):null,pack=template?.presentation?.[m.faction]||null;
    if(template&&pack){
      const encounter=this.missionEncounterTag(m),completionSeed=this.hashText(`${m.id}|template-complete`),subjectCount=Math.max(1,pack.completionSubjects?.length||0),bodyCount=Math.max(1,pack.completionBodies?.length||0),encounterCount=Math.max(1,pack.encounterAcknowledgements?.[encounter]?.length||0);
      this.enqueueMail({
        id:`complete_${this.state.completed}_${m.id}`,templateId:'mission_template_complete_v1',
        vars:{missionTemplateId:m.templateId,faction:m.faction,title:m.title,cargo:m.cargo||'',destination:m.destination||'',target:m.targetGroup||'',motive:m.motive||'',situation:m.situation||'',credits:m.pay,repGain,encounter,subjectVariant:completionSeed%subjectCount,bodyVariant:Math.floor(completionSeed/7)%bodyCount,encounterVariant:Math.floor(completionSeed/13)%encounterCount},
        category:'faction',priority:encounter?'normal':'low'
      });
      const personal=pack.personalFollowUp||{},encounterFollowups=Array.isArray(personal.encounterBodies?.[encounter])?personal.encounterBodies[encounter]:[],followups=encounterFollowups.length?encounterFollowups:(Array.isArray(personal.bodies)?personal.bodies:(Array.isArray(pack.personalFollowups)?pack.personalFollowups:[]));
      const baseChance=Math.max(0,Math.min(1,Number(personal.chance??pack.personalChance)||0)),personalChance=encounter?Math.max(baseChance,Math.max(0,Math.min(1,Number(personal.encounterChance)||0))):baseChance,minRisk=Math.max(1,Number(personal.minRisk)||5),encounterMinRisk=Math.max(1,Number(personal.encounterMinRisk)||1);
      const forceFollowUp=!!m.devForceFollowUp;
      if(followups.length&&(forceFollowUp||((m.risk||1)>=(encounter?encounterMinRisk:minRisk)&&Math.random()<personalChance))){
        const contact=this.contactFromId(personal.contactId||pack.contactId)||this.contactForMission(m),personalSeed=this.hashText(`${m.id}|template-personal|${encounter}`),subjectCount=Math.max(1,personal.subjects?.length||0);
        this.enqueueMail({
          id:`personal_${this.state.completed}_${m.id}`,templateId:'mission_template_personal_v1',
          vars:{missionTemplateId:m.templateId,contactId:contact?.id||'',faction:m.faction,title:m.title,cargo:m.cargo||'',destination:m.destination||'',target:m.targetGroup||'',motive:m.motive||'',situation:m.situation||'',credits:m.pay,repGain,encounter,subjectVariant:personalSeed%subjectCount,bodyVariant:Math.floor(personalSeed/7)%followups.length},
          category:'faction',priority:'normal'
        })
      }
      return
    }
    const contact=this.contactForMission(m),encounter=this.missionEncounterTag(m),variant=this.hashText(`${m.id}|complete`)%3;
    this.enqueueMail({
      id:`complete_${this.state.completed}_${m.id}`,
      templateId:m.faction==='quickbite'?'quickbite_complete_v1':'contract_complete_v1',
      vars:{contactId:contact?.id||'',faction:m.faction,title:m.title,repGain,encounter,variant},
      category:'faction',priority:encounter?'normal':'low'
    })
  }
  // v307: a failed/abandoned story job stays open; the agent sends one short
  // in-voice line explaining why, with the same accept button. Older retry
  // notes for the same job are replaced, so the inbox never piles up.
  queueStoryRetryMail(m,outcome='failed'){
    const id=m?.storyContractId;if(!id||m.devTest||m.devTemplateTest||m.training)return false;
    const key=`${id}Retries`,n=(Number(this.state.mailFlags[key])||0)+1;this.state.mailFlags[key]=n;
    this.state.mail=this.state.mail.filter(x=>!String(x.id).startsWith(`${id}_retry_`));
    const mail=globalThis.AgentXStoryContent?.retryMail?.(id,outcome,n);
    return mail?this.enqueueMail(mail):false
  }
  queueContractFailureMail(m,outcome='failed',reason=''){
    const f=this.factions[m?.faction];if(!f||m.private)return;
    const template=m?.templateId?this.missionTemplate(m.templateId):null,pack=template?.presentation?.[m.faction]||null;
    if(!template||!pack)return;
    const abandoned=outcome==='abandoned',reaction=abandoned?(pack.abandonMail||{}):(pack.failureMail||{}),bodies=Array.isArray(reaction.bodies)?reaction.bodies:[],civilian=this.templateCivilianSettlement(m);
    if(!bodies.length)return;
    const contact=this.contactFromId(reaction.contactId||pack.contactId)||this.contactForMission(m),seed=this.hashText(`${m.id}|template-${abandoned?'abandoned':'failed'}`),subjects=Array.isArray(reaction.subjects)?reaction.subjects:[];
    this.enqueueMail({
      id:`${abandoned?'abandon':'failed'}_${this.state.failed}_${m.id}`,
      templateId:'mission_template_failure_v1',
      vars:{missionTemplateId:m.templateId,contactId:contact?.id||'',faction:m.faction,title:m.title,cargo:m.cargo||'',destination:m.destination||'',target:m.targetGroup||'',motive:m.motive||'',situation:m.situation||'',reason:String(reason||''),outcome:abandoned?'abandoned':'failed',subjectVariant:seed%Math.max(1,subjects.length),bodyVariant:Math.floor(seed/7)%bodies.length,civilianIncidents:civilian?.incidents||0,civilianAssaults:civilian?.assaults||0,civilianCollisions:civilian?.collisions||0,civilianVariant:Math.floor(seed/13)},
      category:'faction',priority:'normal'
    })
  }
  queueTemplateCivilianIncidentMail(m,settlement,actualPay){
    const template=m?.templateId?this.missionTemplate(m.templateId):null,pack=template?.presentation?.[m?.faction]||null,reaction=pack?.civilianTrafficMail||null;
    if(!template||!pack||!reaction||!(settlement?.incidents>0))return false;
    const contact=this.contactFromId(reaction.contactId||pack.contactId)||this.contactForMission(m),assault=settlement.assaults>0,subjects=assault?(reaction.assaultSubjects||reaction.subjects||[]):(reaction.incidentSubjects||reaction.subjects||[]),bodies=assault?(reaction.assaultBodies||reaction.bodies||[]):(reaction.incidentBodies||reaction.bodies||[]);
    if(!bodies.length)return false;
    const seed=this.hashText(`${m.id}|civilian-traffic|${settlement.assaults}|${settlement.collisions}`);
    this.enqueueMail({
      id:`civilian_${this.state.completed}_${m.id}`,templateId:'mission_template_civilian_v1',
      vars:{missionTemplateId:m.templateId,contactId:contact?.id||'',faction:m.faction,cargo:m.cargo||'',destination:m.destination||'',credits:actualPay,fullCredits:m.pay,incidents:settlement.incidents,assaults:settlement.assaults,collisions:settlement.collisions,subjectVariant:seed%Math.max(1,subjects.length),bodyVariant:Math.floor(seed/7)%bodies.length},
      category:'faction',priority:'high'
    });
    return true
  }
  queueJackalCivilianIncidentMail(m,settlement,actualPay){
    const n=Math.max(1,settlement?.incidents|0),full=Number(m?.pay)||0;
    let subject='Keep it quiet',body=[];
    if(n===1){
      subject='You brought heat onto the route';
      body=[
        'One civilian incident on a quiet delivery is one too many. That kind of attention gets routes watched and doors closed.',
        `We cut the settlement from CR ${full.toLocaleString()} to CR ${actualPay.toLocaleString()}. Do cleaner work next time.`,
        'There will be no courtesy bonus on this run.'
      ]
    }else if(n===2){
      subject='Too much heat';
      body=[
        'Two civilian incidents on one delivery is not subtle. We had to spend contacts cooling the route down after you left.',
        `Your CR ${full.toLocaleString()} contract has been cut to CR ${actualPay.toLocaleString()}.`,
        'No bonus. No gift. Next time keep the traffic out of your guns and your flight path.'
      ]
    }else{
      subject='No payment. You made a mess.';
      body=[
        `${n} civilian incidents turned a discreet delivery into exactly the sort of public spectacle we paid you to avoid.`,
        `The CR ${full.toLocaleString()} settlement has been cancelled. We are not paying for a job that brings that much heat onto a Jackal route.`,
        'If you want future work, learn the difference between customs and civilians.'
      ]
    }
    this.enqueueMail({id:`jackal_heat_${this.state.completed}_${m.id}`,from:'Red Jackal Combine · Route Handler',subject,category:'network',priority:'normal',body})
  }
  maybeQueueFactionGift(m){
    const f=this.factions[m?.faction];if(!f||m.private)return;
    const encounter=this.missionEncounterTag(m),chance=encounter?0.58:0.28;
    if(Math.random()>=chance)return;
    const contact=this.contactForMission(m),roll=Math.random(),id=`gift_${this.state.completed}_${m.id}`,variant=this.hashText(id);
    if(roll<.40){
      const amount=Math.round((125+Math.min(6,m.risk||1)*55+Math.random()*150+(encounter?175:0))/25)*25;
      this.enqueueMail({id,templateId:'gift_credits_v1',vars:{contactId:contact?.id||'',faction:m.faction,title:m.title,encounter,amount,variant},category:'gift',priority:'normal',reward:{type:'credits',amount}})
    }else if(roll<.75){
      const tier=this.marketAccessTier()>=2&&Math.random()>.55?2:1;
      const choices=tier===2?['shieldBooster2','homingMissile2']:['shieldBooster','homingMissile'];
      const itemId=choices[(Math.random()*choices.length)|0];
      this.enqueueMail({id,templateId:'gift_item_v1',vars:{contactId:contact?.id||'',faction:m.faction,title:m.title,encounter,itemId,variant},category:'gift',priority:'normal',reward:{type:'item',itemId,count:1}})
    }else{
      const candidates=this.shop.filter(it=>it.slot==='internal'&&this.productAccess(it).ok&&it.tier<=Math.max(1,this.normalMarketTier()));
      const item=candidates[(Math.random()*candidates.length)|0]||this.items.shieldExtender;
      this.enqueueMail({id,templateId:'gift_discount_v1',vars:{contactId:contact?.id||'',faction:m.faction,title:m.title,encounter,itemId:item.id,percent:.10,variant},category:'gift',priority:'normal',reward:{type:'discount',itemId:item.id,percent:.10,uses:1}})
    }
  }
  // ---------- After the story (Dave): Mara keeps in touch ----------
  // Every few completed contracts she sends either an off-board VOX contract that pays
  // well above the board, or a gift from VOX stores. The story is over; the job is not.
  maybeQueueVoxFollowUp(m){
    const flags=this.state.mailFlags;
    if(m?.voxMailId){const mail=this.state.mail.find(x=>x.id===m.voxMailId);if(mail)mail.contractDone=true}
    if(!flags.kudo3Done||m?.storyFlag==='kudo3')return;
    if(!Number.isFinite(flags.voxNextAt))flags.voxNextAt=this.state.completed+2;
    if(this.state.completed<flags.voxNextAt)return;
    flags.voxNextAt=this.state.completed+2+((Math.random()*3)|0);
    if(Math.random()<.55)this.queueVoxContractMail();else this.queueVoxGiftMail()
  }
  voxPick(a){return a[(Math.random()*a.length)|0]}
  queueVoxContractMail(){
    const template=this.pickMissionTemplate([],{remainingSlots:1});if(!template)return false;
    const c=this.makeTemplateContract(template,0);if(!c)return false;
    const flags=this.state.mailFlags,n=flags.voxSeq=(flags.voxSeq||0)+1;
    Object.assign(c,{id:`vox_contract_${n}_${Date.now().toString(36)}`,private:true,voxContract:true,clientName:'Vector Operations Exchange',agentName:'Mara Venn',
      pay:Math.round(c.pay*2.2/50)*50,xp:Math.round(c.xp*1.5)});
    const P=this.voxPick.bind(this);
    this.enqueueMail({id:`vox_offer_${n}_${Date.now().toString(36)}`,from:'Mara Venn · Contractor Services, VOX',category:'vox',priority:'high',contract:c,
      subject:P(['Something off the books','A VOX job, if you want it','Paid properly, for once','One for you']),
      body:[P(['VOX has a job that does not belong on the public board. The client asked for you by name, which these days is not unusual.',
               'The committee closed the factory file, but they did not close their wallet. This one pays properly.',
               'I have a contract here that I would rather give to someone who finishes things.',
               'Nothing world-ending this time. Just well paid.']),
            `${c.title}. ${c.description}`,
            `VOX rate: CR ${c.pay.toLocaleString()} and ${c.xp} XP.`,
            P(['Usual rules. Bring the drone back if you can.','Take it or leave it. I will not be offended either way.','The pay is real. The danger probably is too.'])],
      action:{type:'vox',label:'OPEN VOX CONTRACT'}});
    return true
  }
  queueVoxGiftMail(){
    const flags=this.state.mailFlags,n=flags.voxSeq=(flags.voxSeq||0)+1,id=`vox_gift_${n}_${Date.now().toString(36)}`,roll=Math.random(),P=this.voxPick.bind(this);
    const from='Mara Venn · Contractor Services, VOX',subject=P(['Something for the hangar','On the house','A small thank you','From the VOX stores']);
    const tier=Math.min(5,this.normalMarketTier()+1),pool=this.shop.filter(it=>(it.slot==='internal'||it.slot==='consumable')&&(it.tier||1)<=tier&&(it.tier||1)>=Math.max(1,tier-1));
    if(roll<.45||!pool.length){
      const amount=Math.round((1500+this.levelForXP()*450+Math.random()*1500)/50)*50;
      this.enqueueMail({id,from,subject,category:'vox',priority:'normal',reward:{type:'credits',amount},
        body:['VOX had a budget line nobody was using. I used it.',`CR ${amount.toLocaleString()} is yours. Do not tell the committee.`]});
    }else if(roll<.8){
      const item=P(pool);
      this.enqueueMail({id,from,subject,category:'vox',priority:'normal',reward:{type:'item',itemId:item.id,count:1},
        body:[`Stores had a ${item.name} going spare. I signed it out in your name before anyone asked what it was for.`,'Fit it or sell it. Either way it is not coming back.']});
    }else{
      const item=P(pool.filter(it=>it.slot==='internal').length?pool.filter(it=>it.slot==='internal'):pool);
      this.enqueueMail({id,from,subject,category:'vox',priority:'normal',reward:{type:'discount',itemId:item.id,percent:.25,uses:1},
        body:[`I talked to the market desk. Your next ${item.name} is a quarter off.`,'Do not ask what I promised them.']});
    }
    return true
  }
  prepareVoxContract(mailId){
    if(this.currentMission||this.pendingMission)return false;
    const mail=this.state.mail.find(x=>x.id===mailId);if(!mail?.contract||mail.contractDone)return false;
    const c=JSON.parse(JSON.stringify(mail.contract));c.voxMailId=mailId;
    this.pendingMission=c;this.save();this.render();this.setPanel('workshop');return true
  }
  claimMailReward(mailId){
    const m=this.state.mail.find(x=>x.id===mailId),r=m?.reward;if(!m||!r||m.claimed)return false;
    if(r.type==='credits')this.state.money+=Math.max(0,Math.round(Number(r.amount)||0));
    else if(r.type==='item'&&this.items[r.itemId])this.state.inventory[r.itemId]=(this.state.inventory[r.itemId]||0)+Math.max(1,Math.round(Number(r.count)||1));
    else if(r.type==='discount'&&this.items[r.itemId]){
      const old=this.state.discounts[r.itemId]||{percent:0,uses:0};
      this.state.discounts[r.itemId]={percent:Math.max(Number(old.percent)||0,Number(r.percent)||.10),uses:(Number(old.uses)||0)+Math.max(1,Math.round(Number(r.uses)||1))}
    }else return false;
    m.claimed=true;m.read=true;this.save();this.renderHeader();this.renderShop();this.renderWorkshop();this.renderProgressionSandbox();this.renderMail();return true
  }
  marketPrice(product){
    if(!product||product.productType==='frame')return Number(product?.price)||0;
    const d=this.state.discounts?.[product.id];if(!d||!(d.uses>0)||!(d.percent>0))return Number(product.price)||0;
    return Math.max(0,Math.round((product.price*(1-d.percent))/10)*10)
  }
  consumeMarketDiscount(id){
    const d=this.state.discounts?.[id];if(!d||!(d.uses>0))return;
    d.uses--;if(d.uses<=0)delete this.state.discounts[id]
  }
  renderMail(){
    const host=document.getElementById('mailGrid');if(!host)return;
    this.updateMailBadge();host.innerHTML='';
    const all=[...this.state.mail].sort((a,b)=>(b.seq||0)-(a.seq||0));
    if(!all.length){host.innerHTML='<div class="catalogEmptyDetail">No mail.</div>';return}
    // Mail filters (Dave, v56): by kind, plus a persistent HIDE ROUTINE toggle that drops
    // low-priority chatter, standing notices and gifts already claimed.
    const filters=[['all','ALL'],['story','STORY'],['contracts','CONTRACTS'],['gifts','GIFTS'],['unread','UNREAD']];
    const bar=document.createElement('div');bar.className='mailFilters';
    for(const [id,label] of filters){
      const b=document.createElement('button');b.type='button';b.className=`mailFilter${this.mailFilter===id?' active':''}`;b.textContent=label;
      b.addEventListener('click',()=>{this.mailFilter=id;this.renderMail()});bar.appendChild(b)
    }
    const hide=!!this.state.mailHideRoutine,tb=document.createElement('button');tb.type='button';tb.className=`mailFilter mailToggle${hide?' active':''}`;tb.textContent=hide?'ROUTINE HIDDEN':'HIDE ROUTINE';
    tb.addEventListener('click',()=>{this.state.mailHideRoutine=!this.state.mailHideRoutine;this.save();this.renderMail()});bar.appendChild(tb);
    const isStory=m=>m.category==='story'||m.category==='vox'||m.action?.type==='story'||m.action?.type==='vox';
    const routine=m=>!isStory(m)&&(this.mailPriority(m)==='low'||m.category==='network'||(m.reward&&m.claimed));
    const matches=m=>{
      if(hide&&routine(m)&&m.id!==this.selectedMailId)return false;
      const f=this.mailFilter;
      if(f==='story')return isStory(m);
      if(f==='contracts')return m.category==='faction'||m.category==='network'||!!m.contract;
      if(f==='gifts')return !!m.reward;
      if(f==='unread')return !m.read||m.id===this.selectedMailId;
      return true};
    const mails=all.filter(matches);
    if(!mails.some(m=>m.id===this.selectedMailId))this.selectedMailId=(mails.find(m=>!m.read)||mails[0]||null)?.id||null;
    const layout=document.createElement('div');layout.className='mailLayout';
    const list=document.createElement('div');list.className='mailList cabinetScrollBody';list.setAttribute('aria-label','Mail inbox');list.tabIndex=0;
    const detail=document.createElement('section');detail.className='mailDetail cabinetScrollBody';detail.tabIndex=0;
    const wrapMailScroller=(body,kind)=>{
      const shell=document.createElement('div');shell.className=`mailScrollHost ${kind} cabinetScrollHost`;
      const track=document.createElement('div');track.className='cabinetScrollbar';track.setAttribute('aria-hidden','true');track.innerHTML='<div class="cabinetScrollThumb" tabindex="-1"></div>';
      shell.append(body,track);return{shell,track}
    };
    if(!mails.length){list.innerHTML='<div class="mailEmpty">No messages in this filter.</div>';detail.innerHTML='<div class="catalogEmptyDetail">Choose another mail filter.</div>'}
    for(const m of mails){
      const view=this.resolveMail(m),p=this.mailPriority(m),label=this.mailPriorityLabel(m);
      const row=document.createElement('button');row.type='button';row.className=`mailRow priority-${p}${m.id===this.selectedMailId?' selected':''}${m.read?'':' unread'}`;
      row.innerHTML=`<span class="mailRowSubject">${this.escapeHtml(view.subject)}</span><span class="mailRowFrom">${this.escapeHtml(view.from)}</span><span class="mailPriority">${label}</span>${m.read?'':'<span class="mailNew">NEW</span>'}`;
      row.addEventListener('click',()=>{this.selectedMailId=m.id;this.markMailRead(m.id);this.renderMail()});list.appendChild(row)
    }
    const m=mails.find(x=>x.id===this.selectedMailId);
    if(m){
      const view=this.resolveMail(m),body=view.body.map(p=>`<p>${this.escapeHtml(p)}</p>`).join(''),priority=this.mailPriorityLabel(m);
      const welcomeSimulator=m.id==='welcome_vox'&&Array.isArray(m.actions)&&m.actions.some(a=>a?.type==='tutorial');
      detail.innerHTML=`<div class="mailDetailKicker priority-${this.mailPriority(m)}">${this.escapeHtml(m.category.toUpperCase())} · ${priority} PRIORITY</div><h2>${this.escapeHtml(view.subject)}</h2><div class="mailFrom">FROM ${this.escapeHtml(view.from)}</div><div class="mailBody">${body}</div><div class="mailActions${welcomeSimulator?' welcomeSimulatorActions':''}"></div>`;
      const actions=detail.querySelector('.mailActions');
      if(welcomeSimulator){
        const recommendation=document.createElement('div');
        recommendation.className='mailSimulatorRecommendation';
        recommendation.textContent='New pilots: simulator training strongly recommended';
        actions.appendChild(recommendation);
      }
      if(m.reward){
        const r=m.reward;let label='CLAIM';
        if(r.type==='credits')label=`CLAIM CR ${Number(r.amount||0).toLocaleString()}`;
        else if(r.type==='item')label=`CLAIM ${this.items[r.itemId]?.name||'ITEM'}`;
        else if(r.type==='discount')label=`CLAIM ${Math.round((r.percent||.10)*100)}% DISCOUNT`;
        const b=document.createElement('button');b.type='button';b.className='mailPrimaryAction';b.textContent=m.claimed?'CLAIMED':label;b.disabled=!!m.claimed;b.addEventListener('click',()=>this.claimMailReward(m.id));actions.appendChild(b)
      }
      const mailActions=Array.isArray(m.actions)&&m.actions.length?m.actions:(m.action?[m.action]:[]);
      for(const action of mailActions){
        if(action?.type==='vox'){
          const done=!!m.contractDone,busy=!!(this.currentMission||this.pendingMission);
          const b=document.createElement('button');b.type='button';b.className='mailPrimaryAction';b.textContent=done?'CONTRACT COMPLETE':(busy?'FINISH CURRENT CONTRACT FIRST':(action.label||'OPEN VOX CONTRACT'));b.disabled=done||busy;b.addEventListener('click',()=>this.prepareVoxContract(m.id));actions.appendChild(b);continue
        }
        if(action?.type==='panel'){
          const b=document.createElement('button');b.type='button';b.className=`mailPrimaryAction${welcomeSimulator?' mailSecondaryAction':''}`;b.textContent=action.label||'OPEN';b.addEventListener('click',()=>this.setPanel(action.panel||'missions'));actions.appendChild(b)
        }else if(action?.type==='tutorial'){
          const active=!!this.currentMission,prepared=!!this.pendingMission;
          const b=document.createElement('button');b.type='button';b.className=`mailPrimaryAction${welcomeSimulator?' mailSimulatorAction':''}`;b.textContent=active?'SIMULATOR UNAVAILABLE':(action.label||'START SIMULATOR');b.disabled=active||prepared;b.addEventListener('click',()=>this.launchTutorial(action.tutorialId||'movement_shooting'));actions.appendChild(b)
          if(welcomeSimulator){
            const skipNote=document.createElement('div');
            skipNote.className='mailBody mailSimulatorSkipNote';
            skipNote.textContent='Or if you are experienced with the drone controls, you may go straight to available contracts.';
            actions.appendChild(skipNote);
          }
        }else if(action?.type==='storyBriefing'){
          const contract=this.storyContract(action.contractId),done=contract&&this.state.mailFlags[`${contract.storyFlag}Done`],active=this.currentMission?.storyContractId===action.contractId,prepared=this.pendingMission?.storyContractId===action.contractId;
          const b=document.createElement('button');b.type='button';b.className='mailPrimaryAction';b.textContent=done?'ASSIGNMENT COMPLETE':(active?'ASSIGNMENT IN FLIGHT':(prepared?'ASSIGNMENT PREPARED':(action.label||'OPEN BRIEFING')));b.disabled=!!done||!!active||!!prepared||!!this.currentMission||!!this.pendingMission;b.addEventListener('click',()=>this.openStoryBriefing(action.contractId));actions.appendChild(b)
        }else if(action?.type==='story'){
          const contract=this.storyContract(action.contractId),done=contract&&this.state.mailFlags[`${contract.storyFlag}Done`],active=this.currentMission?.storyContractId===action.contractId,prepared=this.pendingMission?.storyContractId===action.contractId;
          const b=document.createElement('button');b.type='button';b.className='mailPrimaryAction';b.textContent=done?'ASSIGNMENT COMPLETE':(active?'ASSIGNMENT IN FLIGHT':(prepared?'ASSIGNMENT PREPARED':(action.label||'OPEN PRIVATE CONTRACT')));b.disabled=!!done||!!active||!!prepared||!!this.currentMission||!!this.pendingMission;b.addEventListener('click',()=>this.prepareStoryContract(action.contractId));actions.appendChild(b)
        }
      }
    }
    const listScroll=wrapMailScroller(list,'mailListScrollHost'),detailScroll=wrapMailScroller(detail,'mailDetailScrollHost');
    layout.append(listScroll.shell,detailScroll.shell);host.append(bar,layout);
    // Use the exact same draggable outline scrollbar component as the rest of the
    // cabinet UI. The inbox/detail panes are dynamic, so initialise after insertion.
    requestAnimationFrame(()=>{
      if(typeof CabinetScrollbar==='function'){
        new CabinetScrollbar(list,listScroll.track);new CabinetScrollbar(detail,detailScroll.track)
      }
    });
    this.updateMailBadge()
  }


  // v300 progression migration: new skill tree (points refunded), consumables become
  // charges, Flight Stabilisers are retired and refunded at full price.
  migrateProgressionV300(){
    const st=this.state;if((st.progressionVersion||0)>=300)return;
    const retired=this.retiredItems||{};let refund=0;
    for(const [id,price] of Object.entries(retired)){
      refund+=(Number(st.inventory?.[id])||0)*price;if(st.inventory)delete st.inventory[id];
      for(let i=0;i<(st.internalLoadout||[]).length;i++)if(st.internalLoadout[i]===id){refund+=price;st.internalLoadout[i]=null}
      for(const prof of Object.values(st.frameLoadouts||{}))if(Array.isArray(prof?.internals))prof.internals=prof.internals.map(x=>x===id?null:x);
    }
    st.money=(Number(st.money)||0)+refund;
    st.loadoutCharges=(st.loadout||[]).slice(0,4).map(id=>id?1:0);while(st.loadoutCharges.length<4)st.loadoutCharges.push(0);
    const hadSkills=Array.isArray(st.skills)&&st.skills.length>0;
    st.skills=[];st.skillRefundNotice=hadSkills;
    if(typeof st.autoRestock!=='boolean')st.autoRestock=true;
    if(!('weaponLoadout' in st))st.weaponLoadout=null;
    st.progressionVersion=300;st.progressionRefund=refund;
    this.save()
  }
  load(){
    try{
      const raw=localStorage.getItem(this.storageKey);
      if(!raw)return this.defaultState();
      const saved=JSON.parse(raw),base=this.defaultState();
      return this.sanitiseState({...base,...saved,skills:Array.isArray(saved.skills)?saved.skills:[],ownedFrames:Array.isArray(saved.ownedFrames)?saved.ownedFrames:['AX-1'],inventory:{...base.inventory,...(saved.inventory||{})},frameLoadouts:(saved.frameLoadouts&&typeof saved.frameLoadouts==='object')?saved.frameLoadouts:{},reputation:{...base.reputation,...(saved.reputation||{})},mail:Array.isArray(saved.mail)?saved.mail:base.mail,mailFlags:{...base.mailFlags,...(saved.mailFlags||{})},discounts:{...base.discounts,...(saved.discounts||{})}});
    }catch(_){return this.defaultState()}
  }
  // v307: a hand-edited or damaged save must not leave text/NaN where numbers
  // are expected (a NaN balance made every purchase free).
  sanitiseState(st){
    const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
    st.money=Math.max(0,Math.round(num(st.money)));st.xp=Math.max(0,Math.round(num(st.xp)));
    st.completed=Math.max(0,num(st.completed)|0);st.failed=Math.max(0,num(st.failed)|0);
    for(const k of Object.keys(st.reputation||{}))st.reputation[k]=Math.max(-100,Math.min(100,num(st.reputation[k])));
    for(const k of Object.keys(st.inventory||{}))st.inventory[k]=Math.max(0,num(st.inventory[k])|0);
    if(!st.frameLoadouts||typeof st.frameLoadouts!=='object'||Array.isArray(st.frameLoadouts))st.frameLoadouts={};
    st.skills=[...new Set((st.skills||[]).filter(x=>typeof x==='string'))];
    st.ownedFrames=[...new Set((st.ownedFrames||[]).filter(x=>typeof x==='string'))];if(!st.ownedFrames.length)st.ownedFrames=['AX-1'];
    if(!Array.isArray(st.loadoutCharges))st.loadoutCharges=[0,0,0,0];
    st.loadoutCharges=st.loadoutCharges.slice(0,4).map(v=>Math.max(0,num(v)|0));while(st.loadoutCharges.length<4)st.loadoutCharges.push(0);
    return st
  }
  save(){
    for(const f of Object.values(this.factions))this.state.reputation[f.id]=f.rep;
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.state))}catch(_){}
  }
  levelForXP(xp=this.state.xp){
    const thresholds=this.xpThresholds(),value=Math.max(0,Number(xp)||0);
    let n=1;while(n<thresholds.length&&value>=thresholds[n])n++;
    if(n===thresholds.length&&value>=thresholds[thresholds.length-1])n+=Math.floor((value-thresholds[thresholds.length-1])/10000);
    return n
  }
  repLabel(rep){
    if(rep>=60)return 'Trusted';
    if(rep>=25)return 'Favoured';
    if(rep>=-20)return 'Neutral';
    if(rep>=-55)return 'Distrusted';
    return 'Hostile';
  }
  missionEligibility(m){
    const lvl=this.levelForXP(),rep=this.factions[m.faction].rep;
    if(lvl<m.minLevel)return {ok:false,reason:`Experience level ${m.minLevel} required`};
    if(rep<m.minRep)return {ok:false,reason:`Reputation ${m.minRep} required for this contract tier`};
    return {ok:true,reason:m.implemented?'Available':'Available · stage module not yet built'};
  }
  isOpen(){return this.open}
  setPanel(name){
    document.querySelectorAll('.campaignTab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    document.querySelectorAll('.campaignPanel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));
    if(name==='mail'){
      this.mailFilter='all';
      const rank=m=>this.mailPriority(m)==='high'?2:(this.mailPriority(m)==='normal'?1:0);
      const unread=[...this.state.mail].filter(m=>!m.read).sort((a,b)=>rank(b)-rank(a)||(b.seq||0)-(a.seq||0))[0];
      if(unread)this.selectedMailId=unread.id;this.renderMail();if(this.selectedMailId&&this.markMailRead(this.selectedMailId))this.renderMail()
    }
    if(campaignBodyEl){campaignBodyEl.scrollTop=0;requestAnimationFrame(()=>campaignScrollbar?.update())}
  }
  showHub(panel='missions'){
    // The hub itself is calm, but remember the exact mission music mode so closing
    // it does not incorrectly force every active contract into the violent playlist.
    this.returnMusicMode=audio.music.mode||this.currentMission?.musicMode||'calm';
    audio.music.setMode('calm');
    this.evaluateMailTriggers();
    if(panel==='missions'&&!this.state.mailFlags.introShown){panel='mail';this.state.mailFlags.introShown=true;this.save()}
    this.open=true;campaignShell.classList.add('open');keys.clear();fireHeld=false;
    this.returnPauseState=paused;paused=true;document.body.classList.add('paused');
    campaignResumeBtn.style.display=this.currentMission?'inline-block':'none';
    this.render();this.setPanel(panel);this.updateGearHud();
    if(panel!=='debrief')this.flushHubVoiceNotifications();
  }
  hideHub(){
    this.open=false;campaignShell.classList.remove('open');
    if(this.currentMission){audio.music.setMode(this.returnMusicMode||this.currentMission.musicMode||'calm');paused=false;document.body.classList.remove('paused');last=performance.now();canvas.focus()}
    else audio.music.setMode('calm');
    this.returnMusicMode=null;
    this.updateGearHud();
  }
  renderHeader(){
    agentLevelEl.textContent=this.levelForXP();
    agentXPEl.textContent=`${this.state.xp.toLocaleString()} XP`;
    agentMoneyEl.textContent=`CR ${this.state.money.toLocaleString()}`;
    agentDroneEl.textContent=this.state.drone;
    const titleEl=document.getElementById('agentTitle');if(titleEl){const t=this.state.title||'';titleEl.textContent=t.toUpperCase();titleEl.hidden=!t}
    this.updateSkillBadge();
  }
  wrapCatalogScroller(body,kind='catalogScrollHost'){
    body.classList.add('cabinetScrollBody');body.tabIndex=0;
    const shell=document.createElement('div');shell.className=`${kind} cabinetScrollHost`;
    const track=document.createElement('div');track.className='cabinetScrollbar';track.setAttribute('aria-hidden','true');track.innerHTML='<div class="cabinetScrollThumb" tabindex="-1"></div>';
    shell.append(body,track);
    requestAnimationFrame(()=>{
      if(typeof CabinetScrollbar==='function'){
        const bar=new CabinetScrollbar(body,track);
        if(String(kind).includes('contractScrollHost'))this.contractScrollbar=bar
      }
    });
    return shell
  }
  renderMissions(){
    missionBoardEl.innerHTML='';
    const toolbar=document.createElement('div');
    toolbar.className='contractBoardToolbar';
    // v307: one free board refresh after each run; further redraws cost a small
    // broker fee so the board can't be re-rolled endlessly for the best pay.
    const fee=this.boardRefreshFee(),afford=this.state.money>=fee;
    toolbar.innerHTML=`<button type="button"${afford?'':' disabled'}>Request new contracts${fee?` · CR ${fee.toLocaleString()}`:' · free'}</button>`;
    toolbar.querySelector('button').addEventListener('click',()=>{
      const f=this.boardRefreshFee();if(this.state.money<f)return;
      this.state.money-=f;this.state.freeBoardRefresh=false;this.selectedMissionId=null;this.refreshContracts();this.renderHeader();this.save()
    });
    missionBoardEl.appendChild(toolbar);

    if(!this.missions.some(m=>m.id===this.selectedMissionId))this.selectedMissionId=this.missions[0]?.id||null;
    const layout=document.createElement('div');layout.className='catalogLayout contractCatalog';
    const list=document.createElement('div');list.className='catalogList contractList';list.setAttribute('aria-label','Contracts');
    const detail=document.createElement('section');detail.className='catalogDetail contractDetail';

    // Contracts are a catalogue, not seven elastic rows squeezed into whatever
    // height happens to remain.  Give each job enough room to read and let the
    // existing cabinet/vector scrollbar do the navigation.
    list.style.display='block';
    list.style.overflowY='auto';
    list.style.overflowX='hidden';
    list.style.minHeight='0';

    for(const m of this.missions){
      const f=this.factions[m.faction],riskText=m.risk>=7?'Extreme':(m.risk>=5?'High':(m.risk>=3?'Moderate':'Routine'));
      const row=document.createElement('button');row.type='button';row.className=`catalogRow contractRow${m.id===this.selectedMissionId?' selected':''}`;
      row.style.minHeight='96px';row.style.height='auto';row.style.width='100%';
      row.innerHTML=`<span class="catalogRowTitle">${m.title}</span><span class="catalogRowSub">${f.name}</span><span class="catalogRowBlurb">${m.description}</span><span class="catalogRowFacts"><b>CR ${m.pay.toLocaleString()}</b><b>${m.xp} XP</b><b>${riskText} ${m.risk}</b></span>`;
      row.addEventListener('click',()=>{this.selectedMissionId=m.id;this.renderMissions()});list.appendChild(row)
    }

    const m=this.missions.find(x=>x.id===this.selectedMissionId);
    if(m){
      const f=this.factions[m.faction],riskText=m.risk>=7?'Extreme':(m.risk>=5?'High':(m.risk>=3?'Moderate':'Routine'));
      detail.innerHTML=`<div class="catalogDetailKicker">CONTRACT DETAILS</div><h3>${m.title}</h3><div class="missionFaction">${f.name} · Rep ${f.rep} ${this.repLabel(f.rep)}</div><div class="catalogDetailDesc">${m.description}</div><div class="missionMeta"><span>Pay <b>CR ${m.pay.toLocaleString()}</b></span><span>XP <b>${m.xp}</b></span><span>Risk <b>${riskText} ${m.risk}</b></span></div><div class="stageLine">${m.stages.join(' → ')}</div><div class="missionStatus">Available</div><button class="missionLaunch" type="button">Accept contract</button>`;
      detail.querySelector('.missionLaunch').addEventListener('click',()=>this.prepareMission(m.id));
    }else detail.innerHTML='<div class="catalogEmptyDetail">No contract selected.</div>';
    const listHost=this.wrapCatalogScroller(list,'catalogScrollHost contractScrollHost');
    listHost.style.minHeight='0';listHost.style.overflow='hidden';
    list.style.height='100%';
    layout.append(listHost,detail);missionBoardEl.appendChild(layout);
    requestAnimationFrame(()=>this.contractScrollbar?.update?.())
  }
  // Networks + Operator on one page (Dave, v58): compact standing rows on the left,
  // the operator record (storylines, stats, achievements) on the right.
  renderFactions(){
    factionGridEl.innerHTML='';const st=this.stats(),esc=t=>this.escapeHtml(String(t)),n=v=>Number(v||0).toLocaleString();
    const nets=document.createElement('section');nets.className='netColumn';
    nets.innerHTML='<h3 class="opHeading">Networks</h3>'+Object.values(this.factions).map(f=>{const rep=clamp(f.rep,-100,100),jobs=st.contracts.byFaction[f.id]||0;
      return `<div class="netRow"><div class="netName">${esc(f.name)}</div><div class="repTrack"><span style="left:${(rep+100)/2}%"></span></div><div class="netMeta"><span>${rep>0?'+':''}${rep} · ${esc(this.repLabel(rep))}</span><span>${jobs} contract${jobs===1?'':'s'}</span></div></div>`}).join('');
    const op=document.createElement('section');op.className='opColumn';
    const arcs=this.storyArcs(),main=arcs.reduce((a,x)=>a+x.done,0),mainT=arcs.reduce((a,x)=>a+x.total,0),k=st.kills;
    const rec=[['Contracts completed',n(st.contracts.done)],['Contracts failed',n(st.contracts.failed)],['Contracts abandoned',n(st.contracts.abandoned)],['Clean runs',n(st.cleanRuns)],
      ['Credits earned',`CR ${n(st.creditsEarned)}`],['Insurance paid',`CR ${n(st.insurancePaid)}`],['Drones lost',n(st.dronesLost)],['Projectiles shot down',n(st.shotDown)],
      ['Fighters destroyed',n(k.fighters)],['Ground armour destroyed',n(this.armourKills())],['Walker knees broken',n(k.knees)],['Generators destroyed',n(k.generators)],
      ['Reactors destroyed',n(k.reactors)],['Moons destroyed',n(k.moons)]];
    const got=this.state.achievements||{},ach=this.achievementDefs();
    op.innerHTML=`<div class="opIdent"><h3 class="opHeading">Operator</h3><div class="opName">AGENT X${this.state.title?` · <b>${esc(this.state.title.toUpperCase())}</b>`:''}</div>
        <div class="opLine">Level ${this.levelForXP()} · ${n(this.state.xp)} XP · ${esc(this.state.drone)}</div></div>
      <div class="opBlock"><h4>Storylines <span>${main}/${mainT}</span></h4>${arcs.map(a=>`<div class="opArc${a.done>=a.total?' done':''}"><span>${esc(a.name)}</span><span class="opTicks">${'<i class="tick on"></i>'.repeat(a.done)}${'<i class="tick"></i>'.repeat(a.total-a.done)}<em>${a.done}/${a.total}</em></span></div>`).join('')}</div>
      <div class="opBlock"><h4>Record</h4><div class="opStats">${rec.map(([l,v])=>`<div><span>${l}</span><b>${v}</b></div>`).join('')}</div></div>
      <div class="opBlock"><h4>Achievements <span>${ach.filter(a=>got[a.id]!=null).length}/${ach.length}</span></h4><div class="opAch">${ach.map(a=>{const on=got[a.id]!=null;
        return `<div class="achBadge${on?' on':''}" title="${esc(a.text)}"><b>${esc(a.name)}</b><span>${on?esc(a.text):`${n(Math.min(a.v,a.goal))} / ${n(a.goal)}`}</span></div>`}).join('')}</div></div>`;
    factionGridEl.append(nets,op)
  }
  itemIcon(id){
    const common='viewBox="0 0 48 48" aria-hidden="true" focusable="false"';
    const key=this.items[id]?.icon||id;
    const paths={
      shieldBooster:'<path d="M24 3 40 9v12c0 11-6 18-16 24C14 39 8 32 8 21V9Z"/><path d="M17 20h14v12H17Z"/><path d="M20 17v3M28 17v3M20 32v3M28 32v3"/><path d="M24 22v8M20 26h8"/><path d="M12 13h5M31 13h5"/>',
      homingMissile:'<path d="M8 25 35 11l5 5-14 27-5-13Z"/><path d="m21 30-9 8 4-12M27 22l8 8"/><circle cx="35" cy="16" r="2"/>',
      shieldExtender:'<path d="M24 3 40 9v12c0 11-6 18-16 24C14 39 8 32 8 21V9Z"/><path d="M24 13v16M16 21h16"/><path d="M8 10 3 8v12M40 10l5-2v12"/>',
      shieldRecharger:'<path d="M24 4 39 10v11c0 10-6 17-15 22C15 38 9 31 9 21V10Z"/><path d="M16 26a9 9 0 1 1 4 5"/><path d="m14 29 6 2-2 6"/>',
      laserCooler:'<path d="M8 14h32v20H8Z"/><path d="M14 20h20M14 28h20"/><path d="M16 9v5M24 7v7M32 9v5M16 34v5M24 34v7M32 34v5"/>',
      targetingComputer:'<circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="4"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8"/>',
      pulseLaser:'<path d="M4 20h18v8H4Z"/><path d="M22 22h8M22 26h8"/><path d="M32 22h12M32 26h12" stroke-dasharray="3 3"/><path d="M8 20v-5h8v5"/>',
      nanitePatch:'<path d="M24 3 40 9v12c0 11-6 18-16 24C14 39 8 32 8 21V9Z"/><circle cx="18" cy="20" r="2"/><circle cx="28" cy="18" r="2"/><circle cx="23" cy="28" r="2"/><path d="M18 20l10-2-5 10Z"/>',
      decoyFlare:'<circle cx="24" cy="12" r="5"/><path d="M24 17v24M24 41l-8-8M24 41l8-8"/><path d="M12 10l-6-3M36 10l6-3M14 18l-7 2M34 18l7 2"/>',
      overcharge:'<path d="M26 3 10 26h11l-4 19 19-27H25Z"/>',
      empBurst:'<circle cx="24" cy="24" r="5"/><circle cx="24" cy="24" r="12" stroke-dasharray="4 3"/><circle cx="24" cy="24" r="19" stroke-dasharray="3 5"/>',
      clusterMissile:'<path d="M6 30 22 18l3 3-12 16Z"/><path d="M26 14l6-6M30 18l8-4M22 10l4-8M32 22l8 2"/>',
      flightStabilizer:'<path d="M6 24h36M24 6v36"/><path d="m10 17 14-8 14 8-14 5Z"/><path d="m12 31 12 8 12-8"/>'
    };
    const body=paths[key]||'<path d="M8 8h32v32H8Z"/><path d="M13 24h22"/>';
    return `<svg ${common}>${body}</svg>`
  }
  frameIcon(frame){
    const c=frame?.consumables||1,i=frame?.internals||1;
    return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M5 30 24 8l19 22-19-7Z"/><path d="M11 30h26M24 23v14"/><text x="5" y="44">${c}/${i}</text></svg>`
  }
  marketProducts(){const order={frame:0,weapon:1,consumable:2,internal:3};return [...Object.values(this.frames).filter(f=>f.id!=='AX-1').map(f=>({...f,productType:'frame'})),...this.shop.map(it=>({...it,productType:it.slot}))].sort((a,b)=>a.tier-b.tier+(a.tier===b.tier?((order[a.productType]??9)-(order[b.productType]??9)||a.price-b.price):0))}
  renderShop(){
    shopGridEl.innerHTML='';
    const toolbar=document.createElement('div');toolbar.className='marketToolbar';
    const tierButtons=[['accessible','Accessible'],['1','White'],['2','Green'],['3','Blue'],['4','Purple'],['5','Orange'],['all','All']];
    const kindButtons=[['all','All gear'],['frame','Frames'],['weapon','Weapons'],['consumable','Consumables'],['internal','Internals']];
    toolbar.innerHTML=`<div class="marketAccessSummary">MARKET ACCESS <b>${this.tierInfo(this.marketAccessTier()).name.toUpperCase()}</b> · NORMAL LEVEL BAND ${this.tierInfo(this.normalMarketTier()).name.toUpperCase()}${this.favourTierBoost()?` · FAVOUR +${this.favourTierBoost()} TIER${this.favourTierBoost()===1?'':'S'}`:''}</div><div class="marketFilterRow tierFilters">${tierButtons.map(([v,l])=>`<button type="button" data-market-tier="${v}" class="${this.marketTierView===v?'active':''}">${l}</button>`).join('')}</div><div class="marketFilterRow kindFilters">${kindButtons.map(([v,l])=>`<button type="button" data-market-kind="${v}" class="${this.marketKindView===v?'active':''}">${l}</button>`).join('')}</div>`;
    toolbar.querySelectorAll('[data-market-tier]').forEach(btn=>btn.addEventListener('click',()=>{this.marketTierView=btn.dataset.marketTier;this.selectedMarketProductId=null;this.renderShop()}));
    toolbar.querySelectorAll('[data-market-kind]').forEach(btn=>btn.addEventListener('click',()=>{this.marketKindView=btn.dataset.marketKind;this.selectedMarketProductId=null;this.renderShop()}));
    shopGridEl.appendChild(toolbar);

    const products=this.marketProducts().filter(p=>{
      if(this.marketKindView!=='all'&&p.productType!==this.marketKindView)return false;
      if(this.marketTierView==='accessible')return this.productAccess(p).ok;
      if(this.marketTierView!=='all'&&Number(this.marketTierView)!==p.tier)return false;
      return true
    });
    if(!products.length){const empty=document.createElement('div');empty.className='marketEmpty';empty.textContent='No products match this view.';shopGridEl.appendChild(empty);return}
    if(!products.some(p=>p.id===this.selectedMarketProductId))this.selectedMarketProductId=products[0].id;

    const layout=document.createElement('div');layout.className='catalogLayout marketCatalog';
    const list=document.createElement('div');list.className='catalogList marketList';list.setAttribute('aria-label','Market products');
    const detail=document.createElement('section');detail.className='catalogDetail marketDetail';

    for(const p of products){
      const access=this.productAccess(p),isFrame=p.productType==='frame',tier=this.tierInfo(p.tier);
      const price=this.marketPrice(p),discounted=price<p.price;
      const row=document.createElement('button');row.type='button';row.className=`catalogRow marketRow ${this.tierClass(p.tier)}${access.ok?'':' locked'}${p.id===this.selectedMarketProductId?' selected':''}`;
      row.innerHTML=`<span class="catalogRowTitle">${p.name}</span><span class="catalogRowSub">${isFrame?'Frame':({consumable:'Consumable',weapon:'Weapon',internal:'Internal'}[p.slot])} · Tier ${tier.roman} · ${tier.name}</span><span class="catalogRowBlurb">${p.note}</span><span class="catalogRowFacts"><b>CR ${price.toLocaleString()}${p.slot==='consumable'?' / charge':''}${discounted?' · DISCOUNT':''}</b>${!isFrame&&(this.state.inventory[p.id]||0)?`<b>IN STORES ×${this.state.inventory[p.id]}</b>`:''}<b class="${access.ok?'':'bad'}">${access.ok?'AVAILABLE':'LOCKED'}</b></span>`;
      row.addEventListener('click',()=>{this.selectedMarketProductId=p.id;this.renderShop()});list.appendChild(row)
    }

    const p=products.find(x=>x.id===this.selectedMarketProductId);
    if(p){
      const access=this.productAccess(p),isFrame=p.productType==='frame',owned=isFrame?this.state.ownedFrames.includes(p.id):(this.state.inventory[p.id]||0),active=isFrame&&this.state.drone===p.id;
      const tier=this.tierInfo(p.tier),icon=isFrame?this.frameIcon(p):this.itemIcon(p.id),meta=isFrame?`Frame · Tier ${tier.roman} · ${tier.name}`:p.kind;
      const specs=isFrame?`<div class="frameSpecs"><span>${p.shields} shields</span><span>${p.consumables} consumable</span><span>${p.internals} internal</span></div><div class="frameBonus">${p.bonusText}</div>`:'';
      const faction=p.faction?`<div class="factionAccess">${p.factionName} · REP ${p.repReq}</div>`:'';
      const price=this.marketPrice(p),discounted=price<p.price;
      detail.className=`catalogDetail marketDetail ${this.tierClass(p.tier)}${access.ok?'':' locked'}`;
      detail.innerHTML=`<div class="catalogDetailKicker">MARKET ITEM</div><div class="shopItemHead"><div class="itemIconFrame"><div class="shopItemIcon">${icon}</div></div><div><h3>${p.name}</h3><div class="missionFaction">${meta}</div></div></div>${faction}<div class="catalogDetailDesc">${p.note}</div>${specs}<div class="shopAccess ${access.ok?'':'bad'}">${access.reason}</div><div class="shopPrice">CR ${price.toLocaleString()}${discounted?` <span class="mailDiscount">MAIL DISCOUNT · WAS CR ${p.price.toLocaleString()}</span>`:''}</div><div class="shopOwned">${isFrame?(active?'ACTIVE FRAME':(owned?'OWNED · SELECT IN DRONE BAY':'NOT OWNED')):`Workshop stock X${owned}`}</div><button class="marketBuyPrimary" type="button" ${(!access.ok||active||owned&&isFrame||this.state.money<price)?'disabled':''}>${isFrame?'Buy frame':'Buy one'}</button>`;
      const buyBtn=detail.querySelector('.marketBuyPrimary');
      if(!isFrame&&p.slot==='consumable'){
        const pack=this.packSize(p)||Number(p.pack)||1,unit=Number(p.price)||0;
        buyBtn.textContent=`BUY PACK OF ${pack} · CR ${(price+unit*(pack-1)).toLocaleString()}`;
        const five=document.createElement('button');five.type='button';five.className='marketBuySecondary';five.disabled=buyBtn.disabled;
        five.textContent=`BUY 5 PACKS · CR ${(price+unit*(pack*5-1)).toLocaleString()}`;buyBtn.after(five);
        buyBtn.addEventListener('click',()=>this.buyItem(p.id,pack));five.addEventListener('click',()=>this.buyItem(p.id,pack*5));
        const own=detail.querySelector('.shopOwned');if(own)own.textContent=`In stores ×${this.state.inventory[p.id]||0} charges · pack of ${this.packSize(p)} per slot`;
      }else buyBtn.addEventListener('click',()=>isFrame?this.buyFrame(p.id):this.buyItem(p.id));
    }
    layout.append(this.wrapCatalogScroller(list,'catalogScrollHost marketScrollHost'),detail);shopGridEl.appendChild(layout)
  }
  // Pure stat calculation for the drone bay (and hover comparisons): no state change.
  droneStats({weapon=null,internals=null}={}){
    const frame=this.activeFrame(),w=this.items[weapon||this.state.weaponLoadout]||this.items.laser1;
    const ints=(internals||this.state.internalLoadout.slice(0,this.internalSlotCount())).map(id=>this.items[id]).filter(Boolean);
    const sum=k=>ints.reduce((n,it)=>n+(Number(it[k])||0),0),prod=k=>ints.reduce((n,it)=>n*(Number(it[k])||1),1);
    return {
      shields:frame.shields+sum('shieldBonus'),
      regen:Math.max(1.2,8*(Number(frame.regenMult)||1)*prod('regenMult')),regenDelay:this.hasSkill('quickRegen')?2:4,
      damage:Number(w.damage)||1,burst:4+(Number(frame.burstBonus)||0)+sum('burstBonus'),
      aim:(Number(frame.aimMult)||1)*prod('aimMult'),
      bolt:(this.hasSkill('pointDefence')?1.5:1)*(Number(frame.boltTolMult)||1)*prod('aimMult'),
      lock:.48*(this.hasSkill('fastLock')?.5:1)*(Number(frame.lockMult)||1)
    }
  }
  statRows(st){
    const pct=v=>`${v>=1?'+':''}${Math.round((v-1)*100)}%`;
    return [
      ['shields','SHIELDS',st.shields,String(st.shields),true],
      ['damage','DAMAGE / PULSE',st.damage,String(st.damage),true],
      ['burst','PULSES / BURST',st.burst,String(st.burst),true],
      ['regen','SHIELD REBUILD',-st.regen,`${st.regen.toFixed(1)} s each · starts ${st.regenDelay} s`,true],
      ['aim','HIT TOLERANCE',st.aim,pct(st.aim),true],
      ['bolt','PROJECTILE TOLERANCE',st.bolt,pct(st.bolt),true],
      ['lock','LOCK TIME',-st.lock,`${st.lock.toFixed(2)} s`,true]
    ]
  }
  renderWorkshop(){
    if(!workshopGridEl)return;this.normalizeLoadout();workshopGridEl.innerHTML='';
    const locked=this.equipmentLocked(),cap=this.activeSlotCount(),internalCap=this.internalSlotCount(),frame=this.activeFrame();
    const leftColumn=document.createElement('div');leftColumn.className='workshopColumn workshopColumnLeft';
    const rightColumn=document.createElement('div');rightColumn.className='workshopColumn workshopColumnRight';
    workshopGridEl.append(leftColumn,rightColumn);
    if(this.pendingMission&&!this.currentMission){
      const m=this.pendingMission,card=document.createElement('article');card.className='workshopCard workshopMission';
      card.innerHTML=`<h3>Contract prepared</h3><div class="missionFaction">${this.missionClientName(m)} · ${m.title}</div><div class="missionDesc">${m.description}</div><div class="stageLine">${m.stages.join(' → ')}</div><div class="missionMeta"><span>Pay <b>CR ${m.pay.toLocaleString()}</b></span><span>XP <b>${m.xp}</b></span><span>Risk <b>${m.risk}</b></span></div><div class="workshopActions"><button type="button" data-cancel>Cancel contract</button></div>`;
      card.querySelector('[data-cancel]').addEventListener('click',()=>{const back=m.private?'mail':'missions';this.pendingMission=null;this.render();this.setPanel(back)});leftColumn.appendChild(card);
    }
    // ---- Drone card: frame, live stats, slots ----
    const drone=document.createElement('article');drone.className=`workshopCard bayDrone ${this.tierClass(frame.tier)}`;
    const ownedFrames=this.state.ownedFrames.map(id=>this.frames[id]).filter(Boolean).sort((a,b)=>a.tier-b.tier||a.price-b.price);
    const stats=this.droneStats();
    drone.innerHTML=`<div class="bayHead"><div><h3>${frame.name}</h3><div class="missionFaction">${locked?'DEPLOYED · BAY LOCKED':'AT BASE · READY FOR FITTING'}</div></div><div class="bayFrames">${ownedFrames.map(f=>`<button type="button" data-frame-select="${f.id}" class="${this.tierClass(f.tier)} ${f.id===frame.id?'active':''}" ${locked?'disabled':''}>${f.id}</button>`).join('')}</div></div>
      <div class="frameTrait">${frame.bonusText}</div>
      <div class="bayStats">${this.statRows(stats).map(([k,label,,text])=>`<div class="bayStat" data-stat="${k}"><span>${label}</span><b>${text}</b><i></i></div>`).join('')}</div>
      <div class="baySlotHead">WEAPON</div><div class="baySlots weaponSlot"></div>
      <div class="baySlotHead">CONSUMABLES <span>MMB fires slot 1 · keys 1–${cap}</span></div><div class="baySlots consumableSlots"></div>
      <div class="baySlotHead">INTERNALS</div><div class="baySlots internalSlots"></div>
      <div class="bayRestock"></div>`;
    drone.querySelectorAll('[data-frame-select]').forEach(b=>b.addEventListener('click',()=>this.selectFrame(b.dataset.frameSelect)));
    const slotBtn=(cls,key,item,label,sub,onClick,extra='')=>{
      const b=document.createElement('button');b.type='button';b.className=`baySlot ${cls}${item?' '+this.tierClass(item.tier):' empty'}${!onClick&&!locked?' static':''}`;b.disabled=locked;if(!onClick)b.tabIndex=-1;
      b.innerHTML=`<span class="baySlotKey">${key}</span><span class="baySlotIcon">${this.itemIcon(item?.id||null)}</span><span class="baySlotName">${label}</span><span class="baySlotSub">${sub}</span>${extra}`;
      if(onClick)b.addEventListener('click',onClick);return b
    };
    const wId=locked?this.activeWeapon:(this.state.weaponLoadout||'laser1'),wItem=this.items[wId]||this.items.laser1;
    drone.querySelector('.weaponSlot').appendChild(slotBtn('weapon','W',wItem,wItem.name,`${wItem.damage} dmg / pulse${wItem.free?'':' · click to unfit'}`,!wItem.free&&!locked?()=>this.unloadSlot(0,'weapon'):null));
    const cWrap=drone.querySelector('.consumableSlots');
    for(let i=0;i<cap;i++){
      const id=(locked?this.activeLoadout:this.state.loadout)[i],item=id?this.items[id]:null;
      const n=locked?this.slotCharges(i):(this.state.loadoutCharges[i]||0),pack=this.packSize(item);
      const pips=item?`<span class="packPips">${Array.from({length:pack},(_,k)=>`<i class="${k<n?'on':''}"></i>`).join('')}</span>`:'';
      cWrap.appendChild(slotBtn('consumable',i===0?'MMB':String(i+1),item,item?item.name:'EMPTY',item?`${n}/${pack} charges${n<pack?' · restock':''}`:'fit from stock',item&&!locked?()=>this.unloadSlot(i,'consumable'):null,pips));
    }
    const iWrap=drone.querySelector('.internalSlots');
    for(let i=0;i<internalCap;i++){
      const id=(locked?this.activeInternalLoadout:this.state.internalLoadout)[i],item=id?this.items[id]:null;
      iWrap.appendChild(slotBtn('internal',`I${i+1}`,item,item?item.name:'EMPTY',item?item.note:'fit from stock',item&&!locked?()=>this.unloadSlot(i,'internal'):null));
    }
    const rs=drone.querySelector('.bayRestock');
    if(!locked){
      const plan=this.restockPlan(),buys=plan.plan.reduce((n,p)=>n+p.buy,0),blocked=plan.plan.reduce((n,p)=>n+p.blocked,0);
      const msg=!plan.plan.length?'All packs full.':(buys?`Launch will buy ${buys} charge${buys===1?'':'s'} · CR ${plan.cost.toLocaleString()}${this.hasSkill('quartermaster')?' (15% off)':''}`:'Stock covers every pack.');
      rs.innerHTML=`<label class="restockToggle"><input type="checkbox" ${this.state.autoRestock?'checked':''}> AUTO-RESTOCK BEFORE LAUNCH</label><span class="restockNote ${this.state.autoRestock?'':'off'}">${this.state.autoRestock?msg:'Off · packs launch as they are.'}${blocked?` · ${blocked} not on sale to you`:''}</span>`;
      rs.querySelector('input').addEventListener('change',e=>{this.state.autoRestock=e.target.checked;this.save();this.renderWorkshop()});
    }
    rightColumn.appendChild(drone);
    // ---- Inventory: stacked, grouped, sorted best first ----
    const inv=document.createElement('article');inv.className='workshopCard bayInventory';
    const groups=[['weapon','WEAPONS'],['consumable','CONSUMABLES · stock in charges'],['internal','INTERNALS']];
    const stockTotal=Object.entries(this.state.inventory||{}).filter(([id,n])=>n>0&&this.items[id]).length;
    inv.innerHTML=`<div class="inventoryHeader"><div><h3>Stores</h3><div class="missionFaction">${locked?'LOCKED WHILE DEPLOYED':'CLICK TO FIT · POINT AT AN ITEM TO COMPARE'}</div></div><div class="inventoryCount">${stockTotal} LINE${stockTotal===1?'':'S'}</div></div>${groups.map(([g,l])=>`<div class="bayGroupHead">${l}</div><div class="bayGroup" data-group="${g}"></div>`).join('')}`;
    const statEls=[...drone.querySelectorAll('.bayStat')];
    const clearCompare=()=>statEls.forEach(el=>{el.classList.remove('up','down');el.querySelector('i').textContent=''});
    const compare=item=>{
      clearCompare();let alt=null;
      if(item.slot==='weapon')alt=this.droneStats({weapon:item.id});
      else if(item.slot==='internal'){
        const ints=this.state.internalLoadout.slice(0,internalCap),free=ints.indexOf(null);
        if(free<0)return;ints[free]=item.id;alt=this.droneStats({internals:ints})
      }else return;
      const now=this.statRows(stats),next=this.statRows(alt);
      next.forEach(([k,,v,text],i)=>{const d=v-now[i][2];if(Math.abs(d)<1e-6)return;const el=statEls[i];el.classList.add(d>0?'up':'down');el.querySelector('i').textContent=`→ ${text}`})
    };
    for(const [g] of groups){
      const host=inv.querySelector(`[data-group="${g}"]`);
      const items=Object.values(this.items).filter(it=>it.slot===g&&!it.free&&(this.state.inventory[it.id]||0)>0).sort((a,b)=>b.tier-a.tier||a.name.localeCompare(b.name));
      if(!items.length){host.innerHTML=`<div class="bayEmpty">${g==='weapon'?'Mk I pulse laser is always fitted. Better emitters are sold in the market.':'Nothing in stores.'}</div>`;continue}
      for(const it of items){
        const n=this.state.inventory[it.id]||0,b=document.createElement('button');b.type='button';b.className=`bayItem ${this.tierClass(it.tier)}`;
        const fitted=g==='consumable'?this.state.loadout.slice(0,cap).includes(it.id):false;
        b.disabled=locked;
        b.innerHTML=`<span class="bayItemIcon">${this.itemIcon(it.id)}</span><span class="bayItemName">${it.name}</span><span class="bayItemCount">×${n}</span><span class="bayItemNote">${it.note}</span><span class="bayItemAct">${g==='consumable'?(fitted?'TOP UP PACK':`FIT PACK OF ${this.packSize(it)}`):(g==='weapon'?'FIT WEAPON':'FIT')}</span>`;
        b.addEventListener('click',()=>this.equipItem(it.id));
        b.addEventListener('pointerenter',()=>compare(it));b.addEventListener('pointerleave',clearCompare);
        host.appendChild(b)
      }
    }
    leftColumn.appendChild(inv);
    if(this.pendingMission&&!this.currentMission){
      const launchDock=document.createElement('div');launchDock.className='workshopLaunchDock';
      launchDock.innerHTML='<button type="button" class="workshopLaunchPrimary" data-workshop-launch>LAUNCH MISSION</button>';
      launchDock.querySelector('[data-workshop-launch]').addEventListener('click',()=>this.launchMission(this.pendingMission.id));workshopGridEl.appendChild(launchDock)
    }
  }
  skillIcon(kind){
    const common='viewBox="0 0 32 32" aria-hidden="true"';
    const paths={
      wrench:'<path d="M20 4a7 7 0 0 0-7 9L4 22l6 6 9-9a7 7 0 0 0 9-7l-5 3-4-4 3-5a7 7 0 0 0-2-2Z"/><path d="M7 22l3 3"/>',
      power:'<path d="M18 2 7 18h8l-2 12 12-17h-8Z"/>',
      coil:'<path d="M4 9h5c5 0 5 14 10 14h9"/><path d="M4 23h5c5 0 5-14 10-14h9"/><path d="M8 5v22M24 5v22"/>',
      burst:'<path d="M3 8h16M3 16h22M3 24h16"/><path d="m20 5 7 3-7 3M26 13l4 3-4 3M20 21l7 3-7 3"/>',
      shield:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="M10 12h12"/>',
      repair:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="M16 10v11M10.5 15.5h11"/>',
      repairFast:'<path d="M16 4a11 11 0 1 1-8 3"/><path d="M4 4v7h7"/><path d="M16 10v12M10 16h12"/>',
      bus:'<path d="M6 6h20v20H6Z"/><path d="M10 2v4M16 2v4M22 2v4M10 26v4M16 26v4M22 26v4M2 10h4M2 16h4M2 22h4M26 10h4M26 16h4M26 22h4"/>',
      rack:'<path d="M5 8h22v18H5Z"/><path d="M5 14h22M16 17v7M12.5 20.5h7"/><path d="M10 5h12"/>',
      plug:'<path d="M10 3v8M22 3v8M7 10h18v5a9 9 0 0 1-18 0Z"/><path d="M16 24v6"/>',
      drone:'<path d="M4 22 16 6l12 16-12-5Z"/><path d="M8 22h16M16 17v10"/>',
      dronePlus:'<path d="M3 22 14 7l11 15-11-5Z"/><path d="M7 22h14M14 17v10M25 6v8M21 10h8"/>',
      briefcase:'<path d="M4 10h24v17H4Z"/><path d="M11 10V6h10v4M4 17h24M13 17v3h6v-3"/>',
      insurance:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="M11 16h10M16 10v12"/>',
      down:'<path d="M6 8h20M8 14h16M11 20h10"/><path d="m12 24 4 4 4-4"/>',
      cover:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="m10 16 4 4 8-9"/>',
      handshake:'<path d="m3 13 7-6 6 4 6-2 7 6"/><path d="m7 17 7 7c2 2 4 1 5-1l2 1c2 1 4-1 3-3l2-1c2-1 1-4-1-5l-7-5"/><path d="m10 7-6 10"/>',
      credits:'<circle cx="16" cy="16" r="11"/><path d="M21 11c-2-2-8-2-8 1 0 4 8 2 8 6 0 3-6 4-10 1M16 7v18"/>',
      starCoin:'<circle cx="16" cy="16" r="12"/><path d="m16 8 2.2 5 5.5.5-4.2 3.6 1.3 5.4-4.8-2.9-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5Z"/>',
      rep:'<path d="M5 25h22M7 21l6-6 4 3 8-10"/><path d="M20 8h5v5"/>',
      network:'<circle cx="6" cy="16" r="3"/><circle cx="16" cy="7" r="3"/><circle cx="26" cy="16" r="3"/><circle cx="16" cy="25" r="3"/><path d="m8 14 6-5M18 9l6 5M24 18l-6 5M14 23l-6-5"/>',
      dossier:'<path d="M7 4h18v24H7Z"/><path d="M11 9h10M11 14h7M11 23l3-3 3 3 5-6"/>',
      priority:'<path d="M6 5h20v22H6Z"/><path d="M10 10h12M10 15h8"/><path d="m20 20 2 4 4 .5-3 2.5"/>',
      agent:'<circle cx="16" cy="9" r="5"/><path d="M7 28c1-8 4-12 9-12s8 4 9 12M4 28h24"/>',
      joystick:'<circle cx="16" cy="7" r="3"/><path d="M16 10v11M8 27h16M11 21h10l3 6H8Z"/>',
      turn:'<path d="M5 23c3-10 9-15 19-14"/><path d="m20 5 5 4-4 5"/><circle cx="8" cy="23" r="2"/>',
      threat:'<path d="M16 3 29 25H3Z"/><path d="M16 10v8M16 22v1"/>',
      ace:'<path d="m16 3 3.4 8.2 8.9.7-6.8 5.8 2.1 8.7-7.6-4.6-7.6 4.6 2.1-8.7-6.8-5.8 8.9-.7Z"/>',
      crosshair:'<circle cx="16" cy="16" r="8"/><path d="M16 2v8M16 22v8M2 16h8M22 16h8"/>',
      trigger:'<path d="M4 16h16M4 11h12M4 21h12"/><path d="m22 10 7 6-7 6"/>',
      skull:'<path d="M8 20c-3-2-4-5-4-8a12 12 0 0 1 24 0c0 3-1 6-4 8v5H8Z"/><circle cx="12" cy="13" r="2.5"/><circle cx="20" cy="13" r="2.5"/><path d="M13 25v-3M19 25v-3"/>',
      streak:'<path d="M4 26 11 16l5 5 12-15"/><path d="M22 6h6v6"/><path d="M4 30h24"/>',
      fireball:'<circle cx="19" cy="13" r="6"/><path d="M14 17 4 27M15 21l-6 8M11 14 3 19"/><path d="m18 8 3 5-3 5"/>',
      regen:'<path d="M16 4a11 11 0 1 1-8 3"/><path d="M4 4v7h7"/><path d="M16 10v12M10 16h12"/>',
      laststand:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="M16 9v9M16 22v1"/>',
      lock:'<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6"/><path d="m8 8 3 3M24 8l-3 3"/>',
      crate:'<path d="M4 10h24v17H4Z"/><path d="M4 10 9 4h14l5 6M12 16h8M16 10v17"/>',
      chain:'<path d="M5 25 17 13"/><path d="m13 13h4v4"/><path d="M19 13 27 5"/><path d="m23 5h4v4"/><circle cx="18" cy="12" r="3"/>',
      policy:'<path d="M16 3 27 7v8c0 7-4 11-11 14C9 26 5 22 5 15V7Z"/><path d="m10 16 4 4 8-8"/>',
      cycle:'<path d="M7 10a11 11 0 0 1 18-2"/><path d="m25 3 1 7-7-1"/><path d="M25 22a11 11 0 0 1-18 2"/><path d="m7 29-1-7 7 1"/>'
    };
    return `<svg ${common}>${paths[kind]||paths.wrench}</svg>`
  }
  renderPerks(){
    const avail=this.skillPointsAvailable(),total=this.skillPointsTotal(),spent=this.skillPointsSpent(),locked=this.equipmentLocked();
    const notice=this.state.skillRefundNotice?`<div class="skillNotice"><span>THE SKILL TREE HAS BEEN REBUILT. YOUR POINTS HAVE BEEN REFUNDED: SPEND THEM AGAIN BELOW.</span><button type="button" data-dismiss-notice>OK</button></div>`:'';
    perkGridEl.innerHTML=`${notice}<div class="skillTreeStatus"><span>SKILL POINTS <b>${avail}</b> / ${total}</span><span>SPENT <b>${spent}</b></span><span>1 POINT PER LEVEL · ROW 1 COSTS 1 · ROWS 2–3 COST 2</span><button type="button" data-respec ${locked||!this.state.skills.length||this.state.money<this.respecCost()?'disabled':''}>RESET SKILLS · CR ${this.respecCost().toLocaleString()}</button></div><div class="skillColumns"></div>`;
    perkGridEl.querySelector('[data-dismiss-notice]')?.addEventListener('click',()=>{this.state.skillRefundNotice=false;this.save();this.renderPerks()});
    perkGridEl.querySelector('[data-respec]')?.addEventListener('click',()=>this.respecSkills());
    const host=perkGridEl.querySelector('.skillColumns');
    for(const col of this.skillColumns){
      const c=document.createElement('section');c.className=`skillColumn col-${col.id}`;
      c.innerHTML=`<div class="skillColumnHead"><h3>${col.name}</h3><span>${col.blurb}</span></div>`;
      for(const card of this.skillCards.filter(k=>k.col===col.id).sort((a,b)=>a.row-b.row)){
        const rank=this.skillRank(card.id),max=card.ranks.length,next=this.nextSkillRank(card.id),can=this.skillCanBuy(card.id)&&!locked;
        const el=document.createElement('article');el.className=`skillCard${rank?' owned':''}${rank===max?' maxed':''}${can?' available':''}`;
        el.innerHTML=`<div class="skillCardHead"><span class="skillCardIcon">${this.skillIcon(card.icon)}</span><b>${card.name}</b><span class="rankPips">${card.ranks.map((r,i)=>`<i class="${i<rank?'on':''}"></i>`).join('')}</span></div>
          ${card.ranks.map((r,i)=>`<p class="${i<rank?'have':''}">${max>1?`<em>R${i+1}</em> `:''}${r.text}</p>`).join('')}
          <button type="button" ${can?'':'disabled'}>${rank===max?'LEARNED':(can?`LEARN · ${next.cost} SP`:(locked?'LOCKED WHILE DEPLOYED':`NEEDS ${next.cost} SP`))}</button>`;
        el.querySelector('button').addEventListener('click',()=>this.purchaseSkill(card.id));
        c.appendChild(el)
      }
      host.appendChild(c)
    }
  }
  renderProgressionSandbox(){
    const host=document.getElementById('progressionSandbox');if(!host)return;
    const lvl=this.levelForXP(),normal=this.normalMarketTier(),access=this.marketAccessTier(),reps=Object.values(this.factions);
    host.innerHTML=`<div class="sandboxSummary"><span>LEVEL <b>${lvl}</b></span><span>XP <b>${this.state.xp.toLocaleString()}</b></span><span>MARKET <b>${this.tierInfo(access).name.toUpperCase()}</b></span><span>RISK CEILING <b>${this.maxContractRisk()}</b></span></div>
      <div class="sandboxRow"><label>Level <input type="range" min="1" max="20" step="1" value="${clamp(lvl,1,20)}" data-sandbox-level><output data-sandbox-level-value>${lvl}</output></label><button type="button" data-sandbox-level-apply>Set level</button></div>
      <div class="sandboxRow"><label>XP <input type="number" min="0" step="100" value="${Math.round(this.state.xp)}" data-sandbox-xp></label><button type="button" data-sandbox-xp-apply>Apply XP</button></div>
      <div class="sandboxRow"><label>Credits <input type="number" min="0" step="1000" value="${Math.round(this.state.money)}" data-sandbox-money></label><button type="button" data-sandbox-money-apply>Apply credits</button></div>
      <div class="sandboxPresets"><span>JUMP TO TEST BAND</span>${[[1,'White',12000],[3,'Green',40000],[6,'Blue',140000],[10,'Purple',480000],[15,'Orange',1600000]].map(([l,n,c])=>`<button type="button" data-sandbox-preset="${l}" data-cash="${c}">${n}</button>`).join('')}</div>
      <div class="sandboxRepGrid">${reps.map(f=>`<label><span>${f.name}</span><input type="range" min="-100" max="100" step="5" value="${f.rep}" data-sandbox-rep="${f.id}"><output>${f.rep>0?'+':''}${f.rep}</output></label>`).join('')}</div>
      <div class="sandboxNote">TEMPORARY TEST CONTROLS · normal market band ${this.tierInfo(normal).name}; favour/skills currently lift access by ${this.favourTierBoost()} tier${this.favourTierBoost()===1?'':'s'}.</div>`;
    const levelSlider=host.querySelector('[data-sandbox-level]'),levelOut=host.querySelector('[data-sandbox-level-value]');
    levelSlider.addEventListener('input',()=>levelOut.textContent=levelSlider.value);
    const refresh=()=>{this.generateContractBoard();this.normalizeLoadout();this.save();this.render()};
    host.querySelector('[data-sandbox-level-apply]').addEventListener('click',()=>{this.state.xp=this.xpForLevel(levelSlider.value);refresh()});
    host.querySelector('[data-sandbox-xp-apply]').addEventListener('click',()=>{this.state.xp=Math.max(0,Number(host.querySelector('[data-sandbox-xp]').value)||0);refresh()});
    host.querySelector('[data-sandbox-money-apply]').addEventListener('click',()=>{this.state.money=Math.max(0,Math.round(Number(host.querySelector('[data-sandbox-money]').value)||0));this.save();this.render()});
    host.querySelectorAll('[data-sandbox-preset]').forEach(b=>b.addEventListener('click',()=>{this.state.xp=this.xpForLevel(Number(b.dataset.sandboxPreset));this.state.money=Number(b.dataset.cash)||this.state.money;refresh()}));
    host.querySelectorAll('[data-sandbox-rep]').forEach(sl=>{const out=sl.parentElement.querySelector('output');sl.addEventListener('input',()=>out.textContent=`${Number(sl.value)>0?'+':''}${sl.value}`);sl.addEventListener('change',()=>{const f=this.factions[sl.dataset.sandboxRep];if(f)f.rep=Number(sl.value)||0;refresh()})})
  }
  render(){this.evaluateMailTriggers();this.renderHeader();this.renderMissions();this.renderFactions();this.renderMail();this.renderShop();this.renderWorkshop();this.renderPerks();this.renderProgressionSandbox();this.updateMailBadge()}
  prepareMission(id){
    if(this.currentMission)return false;const m=this.missions.find(x=>x.id===id);if(!m||!m.implemented)return false;
    this.pendingMission=m;this.render();this.setPanel('workshop');return true
  }
  // DEV ground tests (factory assault / dune trial) go through the normal workshop so
  // the tester picks a loadout (Dave), then launch straight into the scene: no
  // checkpoint transit, no rewards, gear returned afterwards.
  prepareDevGroundTest(kind){
    if(this.currentMission||this.pendingMission)return false;
    const factory=kind==='factory';
    this.pendingMission={id:`dev_ground_${kind}_${Date.now().toString(36)}`,devGroundTest:kind,implemented:true,private:false,clientName:'DEV test',
      title:factory?'Factory assault (test)':'Dune armour trial (test)',
      description:factory?'Mission 12 prototype. Six red generators, shield domes, bunker, long tunnel, reactor, escape.':'Dune field armour trial.',
      stages:factory?['Surface','Bunker','Tunnel','Reactor','Escape']:['Dunes'],pay:0,xp:0,risk:'DEV',difficulty:3};
    this.render();this.showHub('workshop');this.setPanel('workshop');return true
  }
  launchDevGroundTest(m){
    this.currentMission=m;this.pendingMission=null;this.currentStageIndex=0;this.deployLoadout();this.open=false;campaignShell.classList.remove('open');this.updateGearHud();
    level=Math.max(1,Number(m.difficulty)||1);audio.music.setMode('violent');audio.resetMissionVoices();
    reset({deferMissionStart:true});paused=false;document.body.classList.remove('paused','cheating');last=performance.now();
    if(typeof requestFlightPointerLock==='function')requestFlightPointerLock(true);
    if(m.devGroundTest==='factory')groundAssault.beginFactory();else groundAssault.begin();
    canvas.focus()
  }
  finishDevGroundTest(success,lost=false,abandoned=false){
    const m=this.currentMission;if(!m?.devGroundTest)return false;
    if(typeof groundAssault!=='undefined'&&groundAssault.active){groundAssault.reset();surfaceBunkerActive=false;entryBunkerWorldZ=Infinity}
    this.beginPostMissionVoiceHold();this.recoverUnusedLoadout(true);
    this.currentMission=null;this.pendingMission=null;this.currentStageIndex=0;this.returnRestock=null;this.restoreFrameLoadout();this.updateGearHud();this.save();
    if(!success)audio.playVoice('missionFailed',{once:true,priority:true});
    mode=success?'victory':'idle';paused=true;document.body.classList.add('paused');
    const note=success&&lost?'Reactor down, drone lost. As the story mission this is a success plus an insurance claim. DEV test: nothing charged, gear returned.':'DEV test. Rewards, reputation and equipment unchanged; unused gear returned.';
    this.showDebrief({success,heading:success?'DEV TEST COMPLETE':(abandoned?'DEV TEST ABANDONED':'DEV TEST ENDED'),title:m.title,pay:0,xp:0,liability:0,reason:note,returnPanel:'dev'});
    return true
  }
  launchMission(id){
    const m=this.pendingMission?.id===id?this.pendingMission:this.missions.find(x=>x.id===id);if(!m||!m.implemented||this.currentMission)return;
    if(m.devGroundTest){this.launchDevGroundTest(m);return}
    this.missionHits=0;
    this.currentMission=m;this.pendingMission=null;this.currentStageIndex=0;this.deployLoadout();this.open=false;campaignShell.classList.remove('open');this.updateGearHud();
    level=Math.max(1,Number(m.difficulty)||1);

    // Every contract and every composed stage enters through one shared checkpoint transit.
    audio.music.setMode(m.musicMode||(m.family==='food_delivery'?'calm':'violent'));
    audio.resetMissionVoices();
    reset({deferMissionStart:true});
    paused=false;document.body.classList.remove('paused');last=performance.now();
    // launchMission is entered from the player's launch click, so this is the
    // reliable browser user gesture for Pointer Lock. The lock is retained across
    // transit/autopilot but only direct flight consumes relative mouse movement.
    if(typeof requestFlightPointerLock==='function')requestFlightPointerLock(true);
    missionTransit.start(m);
  }
  applyRep(factionId,delta){
    const f=this.factions[factionId];if(!f)return;
    const before=f.rep,oldLabel=this.repLabel(before);f.rep=clamp(f.rep+delta,-100,100);const newLabel=this.repLabel(f.rep);
    if(oldLabel!==newLabel){
      const direction=f.rep>before?'improved':'dropped';
      this.enqueueMail({id:`rep_${f.id}_${this.state.completed}_${f.rep}_${Date.now().toString(36)}`,from:`${f.name} · Network Office`,subject:`Standing ${direction}: ${newLabel}`,category:'network',priority:'normal',body:[`Your standing with ${f.name} has ${direction}.`,`Current status: ${newLabel} (${f.rep>0?'+':''}${f.rep}).`]})
    }
  }
  makeDevTemplatePreview(templateId,factionId){
    const template=this.missionTemplate(templateId);if(!template)return null;
    const m=this.makeTemplateContract(template,999,{faction:factionId});if(!m)return null;
    // A DEV preview is a real generated contract, but it is not put on the public
    // board or made pending until the tester explicitly accepts it.
    m.id=`dev_template_${template.id}_${Date.now().toString(36)}_${((Math.random()*0xffff)|0).toString(36)}`;
    m.devTemplateTest=true;
    return m
  }
  launchDevTemplateTest(templateId,factionId,options={}){
    if(this.currentMission||this.pendingMission)return false;
    const template=this.missionTemplate(templateId);if(!template)return false;
    let m=options?.mission||null;
    // Only accept a supplied preview if it still matches the selected template/faction.
    if(!m||m.templateId!==templateId||m.faction!==factionId)m=this.makeDevTemplatePreview(templateId,factionId);
    if(!m)return false;
    m.devTemplateTest=true;m.devForceFollowUp=!!options.forceFollowUp;
    this.pendingMission=m;
    this.launchMission(m.id);
    return true
  }
  finishDevTemplateTest(success,reason='',abandoned=false){
    const m=this.currentMission;if(m?.devGroundTest)return this.finishDevGroundTest(success,false,abandoned);if(!m?.devTemplateTest)return false;
    this.beginPostMissionVoiceHold();asteroidField.stop();
    if(success)this.queueContractMail(m,0);
    else this.queueContractFailureMail(m,abandoned?'abandoned':'failed',reason||'DEV template test ended.');
    this.recoverUnusedLoadout(true);
    this.currentMission=null;this.pendingMission=null;this.currentStageIndex=0;this.returnRestock=null;this.restoreFrameLoadout();this.updateGearHud();
    this.save();
    if(!success)audio.playVoice('missionFailed',{once:true,priority:true});
    mode=success?'victory':'idle';paused=true;document.body.classList.add('paused');
    this.showDebrief({success,heading:success?'DEV TEMPLATE TEST COMPLETE':(abandoned?'DEV TEMPLATE TEST ABANDONED':'DEV TEMPLATE TEST ENDED'),title:m.title,pay:0,xp:0,liability:0,reason:'DEV test. Campaign rewards, reputation, equipment and contract board unchanged.',returnPanel:'dev'});
    return true
  }
  // opts.droneLost: the objective was achieved but the drone was destroyed after it
  // (Dave: kill the reactor, die on the way out = success + an insurance bill).
  completeCurrentMission(opts={}){
    if(!this.currentMission)return false;const droneLost=!!opts.droneLost;
    if(this.currentMission.devGroundTest)return this.finishDevGroundTest(true,droneLost);
    if(this.currentMission.devTest&&typeof scenarioFlow!=='undefined')return scenarioFlow.finishDevelopmentMission(true);
    if(this.currentMission.devTemplateTest)return this.finishDevTemplateTest(true);
    if(this.currentMission.training)return this.finishTraining(true,'Exercise objectives completed.');
    this.beginPostMissionVoiceHold();
    const lostFrameId=this.state.drone,lostFrameExcess=droneLost?this.frameReplacementExcess(lostFrameId):0;
    const lostConsumables=droneLost?this.activeLoadout.filter((id,i)=>id&&this.slotCharges(i)>0):[],lostInsured=droneLost?[...this.activeInternalLoadout.filter(Boolean),...(this.activeWeapon&&this.activeWeapon!=='laser1'?[this.activeWeapon]:[])]:[];
    const m=this.currentMission,faction=this.factions[m.faction]||null;
    const jackalSettlement=(m.family==='jackal_party_delivery'&&typeof jackalDelivery!=='undefined'&&jackalDelivery?.settlement)?jackalDelivery.settlement():null;
    const templateCivilian=this.templateCivilianSettlement(m),settlement=jackalSettlement||templateCivilian;
    const actualPay=settlement?Math.max(0,Math.round((m.pay*settlement.payMultiplier)/50)*50):m.pay;
    asteroidField.stop();
    this.state.money+=actualPay;this.state.xp+=m.xp;this.state.completed++;
    {const st=this.stats();st.contracts.done++;if(m.faction)st.contracts.byFaction[m.faction]=(st.contracts.byFaction[m.faction]||0)+1;st.creditsEarned+=actualPay;if(!this.missionHits&&!droneLost)st.cleanRuns++;if(droneLost)st.dronesLost++}this.queueSkillPointReminder();
    let repGain=0;
    if(faction){
      const normalRepGain=Math.max(1,Math.round(8*this.positiveRepMultiplier()));
      repGain=settlement?Math.max(0,Math.round(normalRepGain*settlement.repMultiplier)):normalRepGain;
      if(repGain){
        // Standing is independent per faction (Dave: "it's not EVE Online"): a job only
        // moves the client's standing, never its friends' or rivals'.
        this.applyRep(m.faction,repGain);
      }
      if(templateCivilian?.incidents>0)this.queueTemplateCivilianIncidentMail(m,templateCivilian,actualPay);
      else if(jackalSettlement?.incidents>0)this.queueJackalCivilianIncidentMail(m,jackalSettlement,actualPay);
      else this.queueContractMail(m,repGain);
      if(!settlement||settlement.allowGift)this.maybeQueueFactionGift(m)
    }
    if(m.private)this.handleStoryCompletion(m);
    this.maybeQueueVoxFollowUp(m);
    this.checkAchievements();
    if(droneLost){
      if(lostFrameId!=='AX-1'){this.state.ownedFrames=this.state.ownedFrames.filter(id=>id!==lostFrameId);if(!this.state.ownedFrames.includes('AX-1'))this.state.ownedFrames.unshift('AX-1');this.state.drone='AX-1'}
      this.clearActiveLoadout();this.currentMission=null;this.currentStageIndex=0;this.returnRestock=null;this.normalizeLoadout();this.updateGearHud();
      if(!m.private)this.replaceContract(m.id);
      this.evaluateMailTriggers();paused=true;document.body.classList.add('paused');
      this.state.pendingInsurance={title:m.title,reason:`Objective complete · CR ${actualPay.toLocaleString()} paid · drone destroyed`,destroyedFrameId:lostFrameId,frameExcess:lostFrameExcess,lostConsumables,insuredItems:lostInsured,returnPanel:m.private?'mail':'missions',resolved:{}};this.save();
      this.showInsuranceRecovery(this.state.pendingInsurance);return true
    }
    this.recoverUnusedLoadout(true);
    this.currentMission=null;this.currentStageIndex=0;this.returnRestock=null;this.restoreFrameLoadout(this.state.drone,true);this.updateGearHud();
    if(!m.private)this.replaceContract(m.id);
    this.evaluateMailTriggers();this.save();
    mode='victory';paused=true;document.body.classList.add('paused');
    const penalty=templateCivilian?.incidents>0
      ?(templateCivilian.assaults>0?`${templateCivilian.assaults} civilian traffic assault${templateCivilian.assaults===1?'':'s'} · settlement penalised`:`${templateCivilian.collisions} civilian traffic incident${templateCivilian.collisions===1?'':'s'} · settlement penalised`)
      :(jackalSettlement?.incidents>0?(jackalSettlement.incidents>=3?`${jackalSettlement.incidents} civilian incidents · Red Jackal refused payment`:`${jackalSettlement.incidents} civilian incident${jackalSettlement.incidents===1?'':'s'} · Red Jackal cut the settlement`):'');
    this.showDebrief({success:true,title:m.title,pay:actualPay,xp:m.xp,liability:0,reason:penalty,returnPanel:m.private?'mail':'missions'});
    return true;
  }
  failCurrentMission(reason='Mission failed'){
    if(!this.currentMission)return false;
    if(this.currentMission.devGroundTest)return this.finishDevGroundTest(false,true);
    if(this.currentMission.devTest&&typeof scenarioFlow!=='undefined')return scenarioFlow.finishDevelopmentMission(false,reason);
    if(this.currentMission.devTemplateTest)return this.finishDevTemplateTest(false,reason,false);
    if(this.currentMission.training)return this.finishTraining(false,reason||'Simulation ended.');
    this.beginPostMissionVoiceHold();this.queueSkillPointReminder();
    const m=this.currentMission,destroyedFrameId=this.state.drone,frameExcess=this.frameReplacementExcess(destroyedFrameId);
    const lostConsumables=this.activeLoadout.filter((id,i)=>id&&this.slotCharges(i)>0).map((id,i)=>id),insuredItems=[...this.activeInternalLoadout.filter(Boolean),...(this.activeWeapon&&this.activeWeapon!=='laser1'?[this.activeWeapon]:[])];
    asteroidField.stop();this.state.failed++;{const st=this.stats();st.contracts.failed++;if(/destroy/i.test(reason))st.dronesLost++}const civilian=this.templateCivilianSettlement(m);if(this.factions[m.faction])this.applyRep(m.faction,-2-(civilian?.failureRepPenalty||0));this.queueContractFailureMail(m,'failed',reason);this.queueStoryRetryMail(m,'failed');
    // AX-1 is always supplied free. A destroyed premium frame must be claimed at
    // the same excess rate as permanent hardware or the operator falls back to AX-1.
    if(destroyedFrameId!=='AX-1'){
      this.state.ownedFrames=this.state.ownedFrames.filter(id=>id!==destroyedFrameId);
      if(!this.state.ownedFrames.includes('AX-1'))this.state.ownedFrames.unshift('AX-1');
      this.state.drone='AX-1';
    }
    this.clearActiveLoadout();
    this.currentMission=null;this.currentStageIndex=0;this.normalizeLoadout();this.updateGearHud();if(!m.private)this.replaceContract(m.id);this.save();
    audio.playVoice('missionFailed',{once:true,priority:true});paused=true;document.body.classList.add('paused');
    this.state.pendingInsurance={title:m.title,reason,destroyedFrameId,frameExcess,lostConsumables,insuredItems,returnPanel:m.private?'mail':'missions',resolved:{}};this.save();
    this.showInsuranceRecovery(this.state.pendingInsurance);return true
  }
  abandonCurrentMission(reason='Contract abandoned'){
    if(!this.currentMission)return false;
    if(this.currentMission.devGroundTest)return this.finishDevGroundTest(false,false,true);
    if(this.currentMission.devTest&&typeof scenarioFlow!=='undefined')return scenarioFlow.finishDevelopmentMission(false,reason);
    if(this.currentMission.devTemplateTest)return this.finishDevTemplateTest(false,reason,true);
    if(this.currentMission.training)return this.finishTraining(false,'Simulator exited.');
    this.beginPostMissionVoiceHold();this.queueSkillPointReminder();
    const m=this.currentMission;
    asteroidField.stop();
    this.state.failed++;this.stats().contracts.abandoned++;
    const civilian=this.templateCivilianSettlement(m);
    if(this.factions[m.faction])this.applyRep(m.faction,-2-(civilian?.failureRepPenalty||0));
    this.queueContractFailureMail(m,'abandoned',reason);this.queueStoryRetryMail(m,'abandoned');
    this.recoverUnusedLoadout(true);
    this.currentMission=null;this.currentStageIndex=0;this.returnRestock=null;this.restoreFrameLoadout(this.state.drone,true);this.updateGearHud();
    if(!m.private)this.replaceContract(m.id);
    this.save();
    audio.playVoice('missionFailed',{once:true,priority:true});
    paused=true;document.body.classList.add('paused');
    this.showDebrief({success:false,heading:'Mission abandoned',title:m.title,pay:0,xp:0,liability:0,reason:`${reason} · drone recovered`,returnPanel:m.private?'mail':'missions'});
    return true
  }
  showInsuranceRecovery(d){
    audio.music.setMode('calm');this.open=true;campaignShell.classList.add('open');campaignResumeBtn.style.display='none';this.updateGearHud();this.renderHeader();this.setPanel('debrief');
    const rate=this.insuranceExcessRate(),trainingDiscount=this.trainingInsuranceDiscount(),destroyedFrame=this.frames[d.destroyedFrameId]||this.frames['AX-1'];
    const claims=(d.insuredItems||[]).map((id,index)=>({index,type:'item',id,item:this.items[id],excess:this.insuredLiability(this.items[id]?.price||0),status:null})).filter(c=>c.item);
    if(destroyedFrame.id!=='AX-1')claims.unshift({index:-1,type:'frame',id:destroyedFrame.id,item:destroyedFrame,excess:d.frameExcess,status:null});
    // Claims already settled before a reload keep their outcome (no double charge).
    const done=(d.resolved&&typeof d.resolved==='object')?d.resolved:{};for(const c of claims)if(done[c.index])c.status=done[c.index];
    const lostNames=(d.lostConsumables||[]).map(id=>this.items[id]?.name||id);
    const claimRows=claims.length?claims.map(c=>`<div class="insuranceItem${c.status?' '+c.status:''}" data-claim="${c.index}"><div><b>${c.item.name}</b><span>${c.type==='frame'?'Frame':'Replacement'} CR ${c.item.price.toLocaleString()} · excess ${Math.round(rate*100)}%${trainingDiscount?' · training benefit -1%':''}</span></div><strong>CR ${c.excess.toLocaleString()}</strong><div class="insuranceActions">${c.status?`<span>${c.status==='recovered'?'RECOVERED':'DECLINED'}</span>`:`<button type="button" data-recover="${c.index}">Pay excess</button><button type="button" data-decline="${c.index}">Decline</button>`}</div></div>`).join(''):'<div class="insuranceNone">No premium frame or permanent fitted equipment was lost.</div>';
    debriefBoxEl.innerHTML=`<h2>Insurance / recovery</h2><div class="missionFaction">${d.title}</div><div class="missionStatus bad">${d.reason||'Drone destroyed'}</div>
      <div class="insuranceFrame"><span>Fallback AX-1 frame</span><b>ALWAYS AVAILABLE · CR 0</b></div>
      <div class="insuranceConsumables"><span>Consumables</span><b>${lostNames.length?`${lostNames.join(' · ')} · LOST`:'NONE FITTED'}</b></div>
      <div class="insuranceHeading">FRAME / PERMANENT EQUIPMENT CLAIMS</div>${claimRows}
      <div class="debriefRow debriefTotal"><span>Current funds</span><span data-insurance-funds>CR ${this.state.money.toLocaleString()}</span></div>
      <div class="insuranceFooter"><span data-insurance-status>${claims.length?'Resolve each claim to continue.':'No claims to resolve.'}</span><button type="button" id="insuranceContinue" ${claims.length?'disabled':''}>${d.returnPanel==='mail'?'Return to mail':'Return to mission board'}</button></div>`;
    const fundsEl=debriefBoxEl.querySelector('[data-insurance-funds]'),statusEl=debriefBoxEl.querySelector('[data-insurance-status]'),continueBtn=debriefBoxEl.querySelector('#insuranceContinue');
    const refresh=()=>{
      fundsEl.textContent=`CR ${this.state.money.toLocaleString()}`;this.renderHeader();
      const unresolved=claims.filter(c=>!c.status).length;continueBtn.disabled=unresolved>0;
      statusEl.textContent=unresolved?`${unresolved} claim${unresolved===1?'':'s'} still to resolve.`:'Claim complete.'
    };
    const resolve=(index,recover)=>{
      const c=claims.find(x=>x.index===index);if(!c||c.status)return;
      const row=debriefBoxEl.querySelector(`[data-claim="${index}"]`);
      if(recover){
        if(this.state.money<c.excess){statusEl.textContent=`Not enough credits to recover ${c.item.name}.`;return}
        this.state.money-=c.excess;this.stats().insurancePaid+=c.excess;
        if(c.type==='frame'){if(!this.state.ownedFrames.includes(c.id))this.state.ownedFrames.push(c.id);this.state.drone=c.id}else this.state.inventory[c.id]=(this.state.inventory[c.id]||0)+1;
        c.status='recovered'
      }else c.status='declined';
      if(this.state.pendingInsurance){this.state.pendingInsurance.resolved=this.state.pendingInsurance.resolved||{};this.state.pendingInsurance.resolved[c.index]=c.status}
      row.classList.add(c.status);row.querySelector('.insuranceActions').innerHTML=`<span>${c.status==='recovered'?'RECOVERED':'DECLINED'}</span>`;this.normalizeLoadout();this.save();refresh()
    };
    debriefBoxEl.querySelectorAll('[data-recover]').forEach(b=>b.addEventListener('click',()=>resolve(Number(b.dataset.recover),true)));
    debriefBoxEl.querySelectorAll('[data-decline]').forEach(b=>b.addEventListener('click',()=>resolve(Number(b.dataset.decline),false)));
    continueBtn.addEventListener('click',()=>{delete this.state.pendingInsurance;this.restoreFrameLoadout(this.state.drone,true);this.save();this.closeMissionDebrief(d.returnPanel||'missions')});refresh()
  }
  showDebrief(d){
    audio.music.setMode('calm');
    this.open=true;campaignShell.classList.add('open');campaignResumeBtn.style.display='none';this.updateGearHud();this.renderHeader();this.setPanel('debrief');
    if(d.training){
      debriefBoxEl.innerHTML=`<h2>${d.heading||(d.success?'SIMULATOR COMPLETE':'SIMULATION ENDED')}</h2>
        <div class="missionFaction">${d.title}</div>
        <div class="missionStatus ${d.success?'good':'bad'}">${d.reason||'Training session complete.'}</div>
        <div class="catalogDetailDesc">Simulator sessions do not affect credits, experience, reputation, equipment or contract history.</div>
        <div style="margin-top:16px"><button id="debriefReturn" type="button">Return to mail</button></div>`;
      debriefBoxEl.querySelector('#debriefReturn').addEventListener('click',()=>this.closeMissionDebrief('mail'));return
    }
    debriefBoxEl.innerHTML=`<h2>${d.heading||(d.success?'Contract complete':'Drone lost')}</h2>
      <div class="missionFaction">${d.title}</div>
      ${d.reason?`<div class="missionStatus bad">${d.reason}</div>`:''}
      <div class="debriefRow"><span>Contract payment</span><span>CR ${d.pay.toLocaleString()}</span></div>
      <div class="debriefRow"><span>Experience</span><span>${d.xp} XP</span></div>
      <div class="debriefRow"><span>Drone liability</span><span>${d.liability?'- CR '+d.liability.toLocaleString():'CR 0'}</span></div>
      ${this.returnRestock?.spent>0?`<div class="debriefRow"><span>Consumables restocked</span><span>- CR ${this.returnRestock.spent.toLocaleString()}</span></div>`:''}
      ${this.returnRestock?.missing>0?`<div class="debriefRow"><span>Could not afford</span><span>${this.returnRestock.missing} charge${this.returnRestock.missing===1?'':'s'}</span></div>`:''}
      <div class="debriefRow debriefTotal"><span>Current funds</span><span>CR ${this.state.money.toLocaleString()}</span></div>
      <div style="margin-top:16px"><button id="debriefReturn" type="button">${d.returnPanel==='mail'?'Return to mail':(d.returnPanel==='dev'?'Return to DEV':'Return to mission board')}</button></div>`;
    debriefBoxEl.querySelector('#debriefReturn').addEventListener('click',()=>this.closeMissionDebrief(d.returnPanel||'missions'));
  }
  resetCampaign(){
    this.state=this.defaultState();
    for(const f of Object.values(this.factions))f.rep=this.state.reputation[f.id]||0;
    this.currentMission=null;this.pendingMission=null;this.clearActiveLoadout();this.currentStageIndex=0;this.updateGearHud();
    this.generateContractBoard();this.ensureWelcomeMail();this.state.mailFlags.introShown=false;this.save();this.render();this.setPanel('mail');
  }
}


