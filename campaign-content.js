'use strict';

// Static campaign content only: factions, contacts, equipment, frames and perk trees.
// CampaignController owns persistence, rules and UI behaviour; it no longer owns these authored tables.
globalThis.AgentXCampaignContent={
  apply(target){
    target.factions={
      trade:{id:'trade',name:'Free Traders Compact',rep:0,description:'Independent freight houses, hauliers and station merchants.',relations:{security:25,jackals:-80,helix:35}},
      security:{id:'security',name:'Orbital Security Directorate',rep:0,description:'System defence, patrol and infrastructure security authority.',relations:{trade:35,jackals:-90,helix:15}},
      jackals:{id:'jackals',name:'Red Jackal Combine',rep:0,description:'Smugglers, raiders and deniable operators outside conventional law.',relations:{trade:-75,security:-95,helix:-10}},
      helix:{id:'helix',name:'Helix Industrial Group',rep:0,description:'Engineering combine operating mines, shipyards and research facilities.',relations:{trade:30,security:10,jackals:-15}},
      quickbite:{id:'quickbite',name:'QuickBite Orbital',rep:0,description:'Low-margin orbital food courier platform serving stations, ships and remote industrial sites.',relations:{trade:20,helix:35,jackals:-5}}
    };
    // Each organisation has one principal named human contact. Routine contract
    // administration is deliberately faceless; these people appear only when a
    // result warrants personal involvement. Keep the shared future slang sparse:
    // fronk/fronking/fronked, drass, skell, grint, clast/clasting, nerk.
    target.mailContacts={
      corvella_pallis:{id:'corvella_pallis',faction:'trade',name:'Corvella Pallis',role:'Route Coordinator',tone:'flirty'},
      kudo_shang:{id:'kudo_shang',faction:'security',name:'Kudo Shang',role:'Operations Control',tone:'hardline'},
      cassian_erivan_snade:{id:'cassian_erivan_snade',faction:'jackals',name:'Cassian Erivan-Snade',role:'Private Contracts',tone:'indirect'},
      navira_derris:{id:'navira_derris',faction:'helix',name:'Navira Derris',role:'Research Liaison',tone:'curious'},
      nyxo_malloc:{id:'nyxo_malloc',faction:'quickbite',name:'Nyxo Malloc',role:'Dispatch',tone:'slacker'}
    };
    target.contactIdsByFaction={};
    for(const c of Object.values(target.mailContacts))(target.contactIdsByFaction[c.faction]??=[]).push(c.id);
    target.missions=[];
    const tierInfo={
      1:{roman:'I',colour:'White'},2:{roman:'II',colour:'Green'},3:{roman:'III',colour:'Blue'},4:{roman:'IV',colour:'Purple'},5:{roman:'V',colour:'Orange'}
    };
    const slotLabel={consumable:'Consumable',internal:'Internal',weapon:'Weapon'};
    const gear=(id,name,price,slot,tier,note,extra={})=>({id,name,price,slot,tier,kind:`${slotLabel[slot]||'Internal'} · Tier ${tierInfo[tier].roman} · ${tierInfo[tier].colour}`,note,...extra});
    // v300 progression: consumables are sold per CHARGE and fitted as a PACK (a slot
    // holds `pack` charges). Charge prices double per tier (hardware quadruples), so a
    // shield boost is an everyday tool rather than a once-a-mission luxury.
    const per=(base,tier,from=1)=>Math.round(base*Math.pow(2,tier-from)/10)*10;
    const R=['','I','II','III','IV','V'],mk=n=>n>1?` Mk ${R[n]}`:'';
    target.items={};
    const add=it=>{target.items[it.id]=it};
    // Primary weapon: one per frame. Mk I is always fitted for free and never sold.
    [[1,0,1],[2,6000,1.5],[3,24000,2],[4,90000,2.75],[5,360000,3.5]].forEach(([t,price,dmg])=>add(gear(t===1?'laser1':`laser${t}`,`Pulse Laser${mk(t)}`,price,'weapon',t,
      t===1?'Standard-issue twin pulse laser. 1 damage per pulse. Always available.':`Upgraded emitter pair. ${dmg} damage per pulse.`,{hud:`LASER ${R[t]}`,icon:'pulseLaser',damage:dmg,free:t===1})));
    // Everyday consumables, Mk I–V.
    [2,3,4,5,6].forEach((restore,i)=>{const t=i+1;add(gear(t===1?'shieldBooster':`shieldBooster${t}`,`Shield Boost${mk(t)}`,per(150,t),'consumable',t,
      `Emergency field capacitor. Restores ${restore} shields instantly.`,{hud:`BOOST${t>1?' '+R[t]:''}`,icon:'shieldBooster',effect:'shieldBoost',restore,pack:3}))});
    [[6,72],[9,76],[13,82],[18,88],[25,96]].forEach(([dmg,spd],i)=>{const t=i+1;add(gear(t===1?'homingMissile':`homingMissile${t}`,`Homing Missile${mk(t)}`,per(200,t),'consumable',t,
      `Guided missile at your locked target. ${dmg} damage.`,{hud:`MISSILE${t>1?' '+R[t]:''}`,icon:'homingMissile',effect:'homingMissile',missileDamage:dmg,missileSpeed:spd,pack:4}))});
    // Tactical consumables.
    [[1,3,1],[2,4,2],[3,6,3]].forEach(([n,total,t])=>add(gear(`nanitePatch${n}`,`Nanite Patch${mk(n)}`,per(250,t),'consumable',t,
      `Slow field repair: restores ${total} shields, one every 1.2 s. More in total than a boost, but not instant.`,{hud:`NANITE${n>1?' '+R[n]:''}`,icon:'nanitePatch',effect:'nanite',total,pack:2})));
    [[1,4,1],[2,6,3]].forEach(([n,dur,t])=>add(gear(`decoyFlare${n}`,`Decoy Flare${mk(n)}`,per(250,t),'consumable',t,
      `Pulls hostile fire off you for ${dur} s. Projectiles already in flight are drawn away.`,{hud:`FLARE${n>1?' '+R[n]:''}`,icon:'decoyFlare',effect:'flare',duration:dur,pack:3})));
    [[1,6,2],[2,8,3],[3,10,4]].forEach(([n,dur,t])=>add(gear(`overcharge${n}`,`Overcharge Cell${mk(n)}`,per(500,t,2),'consumable',t,
      `Double laser damage for ${dur} s.`,{hud:`OVERCHARGE${n>1?' '+R[n]:''}`,icon:'overcharge',effect:'overcharge',duration:dur,pack:2})));
    [[1,3,2],[2,4.5,3],[3,6,4]].forEach(([n,dur,t])=>add(gear(`empBurst${n}`,`EMP Burst${mk(n)}`,per(600,t,2),'consumable',t,
      `Stalls every hostile in view for ${dur} s: they cannot fire. Clears projectiles in flight.`,{hud:`EMP${n>1?' '+R[n]:''}`,icon:'empBurst',effect:'emp',duration:dur,pack:2})));
    [[1,6,3],[2,9,4],[3,13,5]].forEach(([n,dmg,t])=>add(gear(`clusterMissile${n}`,`Cluster Missile${mk(n)}`,per(1200,t,3),'consumable',t,
      `Splits into four seekers, one per hostile in view (${dmg} damage each).`,{hud:`CLUSTER${n>1?' '+R[n]:''}`,icon:'clusterMissile',effect:'cluster',missileDamage:dmg,missileSpeed:80,pack:2})));
    // Internals (unchanged numbers). Flight Stabilisers are retired: in this arcade
    // flight model turn rate is fixed and response changes are imperceptible.
    add(gear('shieldExtender','Shield Extender',1200,'internal',1,'Adds 1 maximum shield while installed.',{hud:'EXTENDER',icon:'shieldExtender',shieldBonus:1}));
    add(gear('shieldRecharger','Shield Recharger',1500,'internal',1,'Rebuilds damaged shields 25% faster once regeneration begins.',{hud:'RECHARGE',icon:'shieldRecharger',regenMult:.75}));
    add(gear('laserCooler','Laser Cooler',1300,'internal',1,'Allows 2 extra laser pulses in each uninterrupted trigger burst.',{hud:'COOLER',icon:'laserCooler',burstBonus:2}));
    add(gear('shieldExtender2','Shield Extender Mk II',4800,'internal',2,'Adds 2 maximum shields while installed.',{hud:'EXTENDER II',icon:'shieldExtender',shieldBonus:2}));
    add(gear('shieldRecharger2','Shield Recharger Mk II',6000,'internal',2,'Rebuilds damaged shields 38% faster.',{hud:'RECHARGE II',icon:'shieldRecharger',regenMult:.62}));
    add(gear('laserCooler2','Laser Cooler Mk II',5200,'internal',2,'Adds 3 pulses to each uninterrupted laser burst.',{hud:'COOLER II',icon:'laserCooler',burstBonus:3}));
    add(gear('targetingComputer2','Targeting Computer',5600,'internal',2,'Widens the hit tolerance on fighters and incoming projectiles by 5%.',{hud:'TARGET',icon:'targetingComputer',aimMult:1.05}));
    add(gear('shieldExtender3','Shield Extender Mk III',19200,'internal',3,'Adds 3 maximum shields while installed.',{hud:'EXTENDER III',icon:'shieldExtender',shieldBonus:3}));
    add(gear('shieldRecharger3','Shield Recharger Mk III',24000,'internal',3,'Rebuilds damaged shields twice as fast.',{hud:'RECHARGE III',icon:'shieldRecharger',regenMult:.50}));
    add(gear('laserCooler3','Laser Cooler Mk III',20800,'internal',3,'Adds 4 pulses to each uninterrupted laser burst.',{hud:'COOLER III',icon:'laserCooler',burstBonus:4}));
    add(gear('targetingComputer3','Targeting Computer Mk II',22400,'internal',3,'Widens hit tolerance by 9%.',{hud:'TARGET II',icon:'targetingComputer',aimMult:1.09}));
    add(gear('shieldExtender4','Shield Extender Mk IV',76800,'internal',4,'Adds 4 maximum shields while installed.',{hud:'EXTENDER IV',icon:'shieldExtender',shieldBonus:4}));
    add(gear('shieldRecharger4','Shield Recharger Mk IV',96000,'internal',4,'Rebuilds damaged shields 2.5× as fast.',{hud:'RECHARGE IV',icon:'shieldRecharger',regenMult:.40}));
    add(gear('laserCooler4','Laser Cooler Mk IV',83200,'internal',4,'Adds 5 pulses to each uninterrupted laser burst.',{hud:'COOLER IV',icon:'laserCooler',burstBonus:5}));
    add(gear('targetingComputer4','Targeting Computer Mk III',89600,'internal',4,'Widens hit tolerance by 13%.',{hud:'TARGET III',icon:'targetingComputer',aimMult:1.13}));
    add(gear('shieldExtender5','Shield Extender Mk V',307200,'internal',5,'Adds 5 maximum shields while installed.',{hud:'EXTENDER V',icon:'shieldExtender',shieldBonus:5}));
    add(gear('shieldRecharger5','Shield Recharger Mk V',384000,'internal',5,'Rebuilds damaged shields three times as fast.',{hud:'RECHARGE V',icon:'shieldRecharger',regenMult:.32}));
    add(gear('laserCooler5','Laser Cooler Mk V',332800,'internal',5,'Adds 7 pulses to each uninterrupted laser burst.',{hud:'COOLER V',icon:'laserCooler',burstBonus:7}));
    add(gear('targetingComputer5','Targeting Computer Mk IV',358400,'internal',5,'Widens hit tolerance by 18%.',{hud:'TARGET IV',icon:'targetingComputer',aimMult:1.18}));
    // Retired ids kept only so old saves can be refunded on load.
    target.retiredItems={flightStabilizer2:5200,flightStabilizer3:20800,flightStabilizer4:83200,flightStabilizer5:332800};
    target.shop=Object.values(target.items).filter(it=>!it.free);

    // Frames are choices, not a single linear ladder. Slot layout is the main identity;
    // built-in bonuses are intentionally modest so fitted equipment still matters.
    target.frames={
      'AX-1':{id:'AX-1',name:'AX-1 Standard',tier:1,price:3500,shields:6,consumables:1,internals:1,note:'Disposable starter combat frame. Replacement is always free.',bonusText:'No built-in bonus.'},
      'AX-2I':{id:'AX-2I',name:'AX-2I Integrator',tier:2,price:18000,shields:7,consumables:1,internals:2,regenMult:.95,note:'Green-tier systems frame with room for two passive internals.',bonusText:'Shield rebuild 5% faster.'},
      'AX-2R':{id:'AX-2R',name:'AX-2R Runner',tier:2,price:17000,shields:6,consumables:2,internals:1,packBonus:1,note:'Green-tier attack frame with a second consumable hardpoint.',bonusText:'+1 charge in every consumable pack.'},
      'OSD-2S':{id:'OSD-2S',name:'OSD-2 Sentinel',tier:2,price:22000,shields:8,consumables:1,internals:2,enemyHitMult:.96,faction:'security',repReq:25,note:'Orbital Security derivative built around survivability.',bonusText:'Enemy hit intent -4%.',factionName:'Orbital Security Directorate'},

      'AX-3B':{id:'AX-3B',name:'AX-3B Bastion',tier:3,price:72000,shields:9,consumables:1,internals:3,regenMult:.95,note:'Blue-tier defensive chassis with extensive internal capacity.',bonusText:'Shield rebuild 5% faster.'},
      'AX-3S':{id:'AX-3S',name:'AX-3S Striker',tier:3,price:68000,shields:8,consumables:2,internals:2,burstBonus:1,note:'Blue-tier balanced combat frame with two active stores.',bonusText:'+1 laser pulse per burst.'},
      'HIG-3V':{id:'HIG-3V',name:'HIG-3 Vector',tier:3,price:84000,shields:8,consumables:1,internals:3,regenMult:.85,faction:'helix',repReq:35,note:'Helix Industrial engineering derivative with an unusually efficient field bus.',bonusText:'Shield rebuild 15% faster.',factionName:'Helix Industrial Group'},

      'AX-4W':{id:'AX-4W',name:'AX-4W Warden',tier:4,price:288000,shields:10,consumables:2,internals:3,enemyHitMult:.94,note:'Purple-tier defensive frame designed to survive sustained hostile attention.',bonusText:'Enemy hit intent -6%.'},
      'AX-4L':{id:'AX-4L',name:'AX-4L Lancer',tier:4,price:272000,shields:9,consumables:3,internals:2,fireIntervalMult:.95,note:'Purple-tier assault frame favouring active stores and sustained firing.',bonusText:'Laser firing cycle 5% faster.'},
      'RJC-4M':{id:'RJC-4M',name:'RJC-4 Marauder',tier:4,price:320000,shields:8,consumables:3,internals:2,burstBonus:2,lockMult:.5,faction:'jackals',repReq:45,note:'Red Jackal hot-rod frame: lightly protected, heavily biased toward attack.',bonusText:'+2 laser pulses. Locks in half the time.',factionName:'Red Jackal Combine'},

      'AX-5A':{id:'AX-5A',name:'AX-5A Apex',tier:5,price:1080000,shields:11,consumables:3,internals:3,aimMult:1.05,boltTolMult:1.25,note:'Orange-tier balanced endgame frame with no obvious weak system.',bonusText:'Aim tolerance +5%. Incoming projectiles 25% easier to shoot down.'},
      'AX-5C':{id:'AX-5C',name:'AX-5C Citadel',tier:5,price:1160000,shields:12,consumables:2,internals:4,regenMult:.88,note:'Orange-tier systems fortress with four internal bays.',bonusText:'Shield rebuild 12% faster.'},
      'FTC-5N':{id:'FTC-5N',name:'FTC-5 Nomad',tier:5,price:1280000,shields:10,consumables:3,internals:3,packBonus:1,lockMult:.6,faction:'trade',repReq:60,note:'Free Traders premium long-range combat courier derivative.',bonusText:'+1 charge in every pack. Faster lock.',factionName:'Free Traders Compact'}
    };
    target.marketTierView='accessible';
    target.marketKindView='all';
    target.selectedMissionId=null;
    target.selectedMarketProductId=null;
    // v300 skills: twelve arcade skills in four columns. Skills change what the core
    // verbs do (burst, fireballs, lock/missiles, contracts); raw stat numbers belong to
    // gear. Rows cost 1/2/2 points; a second rank costs the same again. No gates.
    target.skillColumns=[
      {id:'gunnery',name:'Gunnery',blurb:'Your guns'},
      {id:'defence',name:'Defence',blurb:'Projectiles and shields'},
      {id:'ordnance',name:'Ordnance',blurb:'Lock, missiles and stores'},
      {id:'operator',name:'Operator',blurb:'Contracts and standing'}
    ];
    target.skillCards=[
      {id:'hotTrigger',col:'gunnery',row:1,name:'Hot Trigger',icon:'trigger',ranks:[{id:'hotTrigger',cost:1,text:'Keep holding fire after a burst and the guns carry on at half rate instead of stopping.'}]},
      {id:'executioner',col:'gunnery',row:2,name:'Executioner',icon:'skull',ranks:[{id:'executioner',cost:2,text:'+50% laser damage against anything below 30% hull.'}]},
      {id:'killingStreak',col:'gunnery',row:3,name:'Killing Streak',icon:'streak',ranks:[{id:'killingStreak',cost:2,text:'Each kill without taking a hit adds +10% laser damage, up to +50%. Any hit resets it.'}]},
      {id:'pointDefence',col:'defence',row:1,name:'Point Defence',icon:'fireball',ranks:[{id:'pointDefence',cost:1,text:'Incoming projectiles are 50% easier to shoot down.'},{id:'pointDefence2',cost:1,text:'Every third projectile you shoot down restores 1 shield.'}]},
      {id:'quickRegen',col:'defence',row:2,name:'Quick Regen',icon:'regen',ranks:[{id:'quickRegen',cost:2,text:'Shields start rebuilding 2 s after a hit instead of 4 s.'}]},
      {id:'lastStand',col:'defence',row:3,name:'Last Stand',icon:'laststand',ranks:[{id:'lastStand',cost:2,text:'Once per mission, a killing hit leaves you on 1 shield with 2 s of grace instead.'}]},
      {id:'fastLock',col:'ordnance',row:1,name:'Fast Lock',icon:'lock',ranks:[{id:'fastLock',cost:1,text:'Locks in half the time and holds twice as long out of sight.'}]},
      {id:'quartermaster',col:'ordnance',row:2,name:'Quartermaster',icon:'crate',ranks:[{id:'quartermaster',cost:2,text:'+1 charge in every consumable pack. Auto-restock buys at 15% off.'}]},
      {id:'chainWarhead',col:'ordnance',row:3,name:'Chain Warhead',icon:'chain',ranks:[{id:'chainWarhead',cost:2,text:'A missile that kills its target flies on to the nearest other hostile.'}]},
      {id:'negotiator',col:'operator',row:1,name:'Negotiator',icon:'handshake',ranks:[{id:'negotiator',cost:1,text:'+10% pay on board contracts (story jobs pay a fixed fee).'},{id:'negotiator2',cost:1,text:'+20% pay on board contracts in total.'}]},
      {id:'connections',col:'operator',row:2,name:'Connections',icon:'network',ranks:[{id:'connections',cost:2,text:'Standing gains +25%, one extra contract slot, and gear opens a grade earlier.'}]},
      {id:'insurance',col:'operator',row:3,name:'Insurance',icon:'policy',ranks:[{id:'insurance',cost:2,text:'Lost hardware excess drops from 30% to 20%.'},{id:'insurance2',cost:2,text:'Excess drops to 10%.'}]}
    ];
  }
};
