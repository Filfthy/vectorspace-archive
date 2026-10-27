'use strict';

// AUTHORED STORY MISSIONS
// Missions compose reusable environment presets and reusable gameplay systems.
// Environment recipes live in environment-presets.js; mechanics live in the system/environment controller files.

const sourceTrace = {
  id:'sourceTrace',

  campaign:{
    contract:{
      id:'story_kudo_bunker_2',storyContractId:'kudo_bunker_2',storyFlag:'kudo2',private:true,
      clientName:'Orbital Security Directorate',agentName:'Kudo Shang',faction:null,
      title:'Source Trace',kind:'story',family:'bunker_recovery_osd',risk:4,minLevel:1,minRep:-100,
      pay:10800,xp:850,difficulty:3,implemented:true,
      planetaryRequirements:{landingBody:'planet',landingColour:'green',moonCount:{min:0,max:2}},
      description:'OSD traced the rogue drones to a fortified planetary installation. Descend to the surface, cross its defences, breach the bunker and investigate the interior. Recover anything that may be important, then deliver the recovered equipment directly to the OSD compound.',
      modules:[
        {type:'planet_descent',label:'Source World Descent',difficulty:3},
        {type:'bunker_recovery_osd',label:'Bunker Investigation and Recovery',difficulty:3,startMessage:'BUNKER ASSAULT',contentId:'kudo_bunker_2'}
      ],
      stages:['Descend to Source World','Cross the Defences','Breach and Investigate Bunker','Recover Equipment','Deliver to OSD Compound']
    },
    offerMail:{
      id:'kudo_offer_2',from:'Kudo Shang · Orbital Security Directorate',subject:'Source trace — planetary installation',category:'story',priority:'high',
      body:[
        'The routing fragment from Relay 10 led somewhere useful. We have a probable source location on a planetary body.',
        'Descend to the site. Cross the defences and breach the bunker.',
        'Investigate the installation. Recover anything that may be important.',
        'Bring whatever you recover directly to the OSD compound. No detours.'
      ],
      action:{type:'story',contractId:'kudo_bunker_2',label:'ACCEPT OSD TASKING'}
    },
    completionMail:{
      id:'kudo_wait_2',from:'Kudo Shang · Orbital Security Directorate',subject:'Analysis complete',category:'story',priority:'high',
      body:[
        'OSD analysis is complete. The recovered assembly is based on Partition War military architecture.',
        'It is not surviving Partition War hardware. Several components are of recent manufacture.',
        'We can identify the materials and fabrication processes involved. We cannot identify their source. The supply chain is civilian, fragmented and largely outside OSD visibility.',
        'Corvella Pallis has better access to that information than we do. I forwarded the relevant material profile. She will contact you.'
      ]
    },
    devMailOption:{contractId:'kudo_bunker_2',label:'4 · Source Trace'}
  },

  presentation:{
    messages:{
      start:{text:'BUNKER ASSAULT',hold:.9},
      bunkerApproach:{text:'BUNKER APPROACH',hold:.55},
      accessTunnel:{text:'BUNKER ACCESS TUNNEL',hold:.65},
      recoverEquipment:{text:'RECOVER EQUIPMENT',hold:.75},
      turningForExit:{text:'TURNING FOR EXIT',hold:.7},
      returnThroughBunker:{text:'RETURN THROUGH BUNKER',hold:.65},
      clearOfBunker:{text:'CLEAR OF BUNKER',hold:.45},
      equipmentRecovered:{text:'EQUIPMENT RECOVERED',hold:.8},
      osdDestination:{text:'OSD DESTINATION',hold:.72},
      osdAutopilot:{text:'AUTOPILOT · OSD DELIVERY',hold:.62}
    },
    hud:{
      osdPlanet:'OSD PLANET',osdDescent:'OSD DESCENT',openingHatch:'OPENING DELIVERY HATCH',
      delivering:'DELIVERING EQUIPMENT',closingHatch:'CLOSING DELIVERY HATCH',departingFacility:'DEPARTING OSD FACILITY',
      osdFacility:'OSD FACILITY',deliveryComplete:'DELIVERY COMPLETE',equipmentSecured:'EQUIPMENT SECURED',
      equipmentRecovery:'EQUIPMENT RECOVERY',exitRoute:'EXIT ROUTE',equipmentDistancePrefix:'EQUIPMENT'
    },
    damage:{tesla:'TESLA PERIMETER',surfaceCollision:'COLLISION',tunnelObstacle:'OBSTACLE'}
  },

  speech:{
    surfaceStart:'crossDefences',
    recoverEquipment:'recoverEquipment',
    deliveryComplete:'deliveryComplete'
  },

  surfaceAssault:{
    start:{...globalThis.AgentXEnvironments.get('fortified_plains'),shipY:-1.55,tunnelStartOffset:.65,musicMode:'violent'},
    bunkerDistance:920,
    bunkerLateral:{min:145,span:30},
    entryRadius:44,
    doorHp:3,
    corridorHalfWidth:{start:84,end:48},

    guns:{
      population:{initial:30,far:28,mid:29,near:30,midDistance:390,nearDistance:210},
      stopSpawningDistance:172,
      breachHandoffDistance:148,
      projectileCap:3,
      initialField:{
        forwardStart:96,forwardSpan:744,forwardJitter:7,
        lanes:[-.72,.18,.66,-.28,.43,-.58,.04,.76,-.12,.54,-.43,.31],laneJitter:.08,
        scaleBase:.82,scaleSpan:.16,minimumUsableHalfWidth:22,edgeInset:10,laneClamp:.84
      },
      replacements:{
        minimumRemaining:78,minForwardBase:34,bunkerClearance:48,nearThreshold:300,
        nearForward:{near:58,far:190},farForward:{near:96,far:245},attempts:18,
        minimumUsableHalfWidth:22,edgeInset:9,edgeEvery:5,edgeMin:.68,edgeSpan:.22,randomWidth:.82
      },
      emplacement:{
        hp:3,floorY:-3.5,pivotHeightFactor:.76,initialFireMin:.35,initialFireSpan:2.15,
        trackingYawRate:3.15,trackingPitchRate:2.25,pitchMin:-.72,pitchMax:.30,
        readablePaddingX:70,readablePaddingY:60,fireDepthMin:6,fireDepthMax:86,yawTolerance:.16,pitchTolerance:.13,
        fireCooldownMin:2.20,fireCooldownSpan:1.10,retryCooldownMin:.52,retryCooldownSpan:.44,
        defaultCooldownMin:.65,defaultCooldownSpan:.65,boltArgs:[.95,1.85,.10],
        collisionRadius:1.65,resetPassedRadius:2.8,retireBehind:82,
        spawnCooldownMin:.12,spawnCooldownSpan:.12,spawnFailureCooldown:.5,
        returnCaptureNear:5,returnCaptureFar:265,returnVisibleNear:.28,returnVisibleFar:235
      },
      ballistics:{
        speedBase:10.4,speedPerLevel:.12,solveMinTime:.04,fallbackTimeCap:2.35,fallbackSpeedFloor:5.5,
        leadScale:.90,leadTimeMin:.10,leadTimeMax:2.85,minimumDistance:.2,minimumFlightTime:.16,
        hitJitter:[.46,.36,.38],missDistanceMin:2.8,missDistanceSpan:3.8,missYScale:.62,lifeMargin:2.0
      }
    },

    tesla:{
      endBeforeBunker:58,spacing:48,sideOffset:14.5,rowStagger:2.2,rearSteps:8,
      warningInset:11,dangerDepth:18,pan:.72,warmup:.55,shieldDrainSeconds:3.05,
      hitIntervalMin:.24,hitIntervalMax:.48,deepIntervalScale:.78,exposureDecay:3.2,
      visual:{
        floorY:-3.5,scale:1.02,mastTop:8.38,ringDrop:.28,ringRadius:.64,
        tipRadius:.54,tipRise:.72,baseRadius:.30,sceneCentreHeight:4.35,
        sceneCullNear:-8,sceneCullFar:430,arcTarget:[0,-.82,1.15]
      }
    },

    breach:{
      cameraY:-2.2,projectNear:.18,minimumDepth:22,
      screenBounds:{left:.18,right:.82,top:.12,bottom:.88}
    }
  },

  bunker:{
    tunnelLength:360,
    roomLength:26,
    pickupStopLocal:342.5,
    equipmentLocal:356.2,

    path:{
      centreY:-2.2,gatePower:.64,straightenDistance:18,
      xWaves:[{frequency:.034,amplitude:3.25,phase:0},{frequency:.073,amplitude:1.28,phase:.72}],
      yWaves:[{frequency:.029,amplitude:.88,phase:.82},{frequency:.061,amplitude:.40,phase:.18}]
    },

    movement:{tunnelSpeedMultiplier:1.42,surfaceClearSpeedMultiplier:.92},

    wallGuns:{
      positions:[34,51,68,85,102,119,136,153],scaleBase:.56,scaleStep:.025,hp:2,
      yOffsets:{left:.08,right:-.06},initialFireMin:.70,initialFireSpan:1.25,returnFireMin:.65,returnFireSpan:1.10,
      maxBolts:2,fireDepthMin:4.5,fireDepthMax:46,yawRate:1.85,pitchRate:1.05,pitchMin:-.72,pitchMax:.52,
      yawTolerance:.26,pitchTolerance:.24,defaultCooldownMin:.8,defaultCooldownSpan:1,
      fireCooldownMin:1.45,fireCooldownSpan:.80,retryCooldownMin:.38,retryCooldownSpan:.42,
      boltArgs:[.92,1.72,.09],boltMaxLife:5.25,boltTunnelDepthMin:.12,boltTunnelDepthMax:72,
      boltWallRadius:.18,boltCullBehind:-2,boltCullAhead:76,
      supportVisibleNear:.18,supportVisibleFar:54,supportPortalNear:.72,supportPortalStep:2.30,mountInset:.05
    },

    obstacles:{
      positions:[160,169,178,187,196,205,214,223,232,241,250,259,268,277,286,295,304,313],
      horizontalLevels:[-.72,.66,-.28,.34,-.58,.52],verticalLevels:[-.92,.88,-.58,.62,-1.02,.98],
      verticalEvery:3,verticalRemainder:1,horizontalThickness:.50,verticalThickness:.46,
      horizontalClearance:.56,verticalClearance:.54,heavyEvery:4,heavyRemainder:3,normalHp:14,heavyHp:18,
      collisionDepthMin:.16,collisionDepthMax:1.42,passScore:100
    },

    recoveryRoom:{
      architecture:{
        widenTransition:7.5,widthFactor:2.65,heightFactor:2.15,fixtureVisibleDistance:55,backWallInset:.10
      },
      statusDisplay:{
        yFraction:.55,halfWidth:2.45,halfHeight:1.05,barCount:9,
        innerLeft:.82,innerRight:.82,bottomFraction:.80,topFraction:.84,minAmount:.08,amountSpan:.88,
        barWidthFraction:.46,phaseStep:.91,baseRate:.72,rateStep:.17
      },
      table:{
        fromEnd:3.8,topFromFloor:1.18,width:2.55,depth:1.10,topThickness:.14,floorOffset:.05,
        legInsetX:.42,legInsetZ:.35,legThickness:.10
      },
      crates:[
        {fromEnd:12.8,x:-3.20,floorOffset:.67,size:[1.05,1.15,1.00]},
        {fromEnd:11.0,x: 3.28,floorOffset:.53,size:[.90,.88,.92]},
        {fromEnd: 8.7,x:-3.42,floorOffset:.50,size:[.82,.82,.78]},
        {fromEnd: 7.9,x:-2.66,floorOffset:.48,size:[.72,.78,.72]},
        {fromEnd: 6.5,x: 3.32,floorOffset:.63,size:[1.18,1.08,.96]},
        {fromEnd: 5.0,x: 2.55,floorOffset:.46,size:[.70,.72,.68]},
        {fromEnd: 3.0,x:-3.15,floorOffset:.48,size:[.82,.78,.76]}
      ],
      equipmentBox:{dimensions:[1.55,.48,.72]},
      pickup:{
        tableHeightFromFloor:1.38,tractorStart:.48,tractorDuration:2.15,shipYOffset:-.78,shipDepth:1.28,
        approachSpeed:4.2,positionEase:5,yawRate:1.4,pitchRate:1.2,rollRate:1.8,arrivalEpsilon:.04,
        securedAt:2.63,turnAt:3.45,triggerBeforeStop:.72,
        tractorVisual:{sourceBottomMin:70,sourceBottomFraction:.18,waves:5,flowRate:.34,easePower:2.05,halfWidthStart:8,halfWidthEnd:34,bowStart:5,bowEnd:16,clipAbove:-40,clipBelow:60,alpha:.70}
      },
      turn:{duration:1.78,completeAt:1.98,rollAmount:.13},
      surfaceClear:{shipY:-1.6,shipYRate:.52,yawRate:2,pitchRate:2,rollRate:2.4,exitAt:1.35,returnExitThreshold:.72},
      render:{
        sectionStep:2.30,visibleDepth:54,fixtureClipNear:.28,fixtureNearPlane:.24,fixtureFarPadding:.06,
        minimumNear:.32,physicalNear:.20,backWallNear:.24,sectionEndEpsilon:.08,sectionStartEpsilon:.16,
        turnClipStep:1.15,turnTunnelStartGap:.65,turnTunnelDepth:34,turnObstacleDepth:30,returnPortalNear:.74
      }
    }
  },

  osdDelivery:{
    planet:{
      worldZ:112,lateralMin:19,lateralSpan:10,verticalSpan:9,radius:6.45,tiltMin:.55,tiltSpan:.72,
      landingAzimuthMin:.28,landingAzimuthSpan:.42,colour:'o',holdSeconds:1.35,musicMode:'calm',
      rollLevelRate:.8,shipYLevelRate:2
    },
    facility:{
      model:'twinTowerFortress',scale:22,routeLength:520,targetWorldZ:520,lateralMin:42,lateralSpan:18,
      ...globalThis.AgentXEnvironments.get('rocky_osd_plains'),rockClumps:12,entryRadius:24,deliveryFrontOffset:24,
      sceneryReservation:{footprintMargin:12,approachLength:150,approachHalfWidth:28},
      visual:{visibleFar:680,crossbarEdges:[[138,139],[140,141]],logoVertexStart:142,logoVertexEnd:182}
    },
    hatch:{
      cargoWidthFraction:.255,recessFloorOffset:.54,frontClearanceMin:.45,frontClearanceWidthFraction:.045,backClearance:.35,
      standOffYOffset:-.20,standOffZOffset:-16,departGroundYOffset:1.90,departZOffset:-36,
      recessCentreYOffsetFraction:.10,recessScale:.88,doorScale:.84,doorLift:1.02,doorFrontOffset:.035,doorDepth:.12
    },
    sequence:{
      approachSpeed:11.5,approachYRate:2.4,approachYawRate:.72,approachPitchRate:.52,approachRollRate:1.3,approachEpsilon:.05,
      settleYawRate:.62,settlePitchRate:1.1,settleRollRate:1.8,settleSeconds:.45,settleYawTolerance:.025,
      doorOpenRate:1.7,doorAimYawRate:.8,doorOpenComplete:.999,
      deliveryDelay:.2,deliveryDuration:2.15,deliveryComplete:.999,
      closeDelay:.28,doorCloseRate:1.8,closeComplete:.001,closeHold:.72,
      turnYawRate:1.75,turnPitchRate:1.35,turnRollRate:2.2,turnHold:.92,turnYawTolerance:.04,
      departFallbackDistance:28,departSpeed:18.5,departYRate:2.2,departYawRate:1.4,departPitchRate:1.2,departRollRate:2.4,departEpsilon:.1
    },
    tractor:{
      cargoOrigin:[0,-.34,1.05],beamOrigin:[0,-.34,.62],arcHeight:.12,waves:7,flowRate:.72,
      startFraction:.10,spanFraction:.82,halfWidthStart:8,halfWidthMax:34,halfWidthBase:10,halfWidthDistanceScale:.055,
      bowStart:5,bowEnd:18
    }
  }
};


const voxCourier = {
  id:'voxCourierRecovery',

  campaign:{
    contract:{
      id:'story_mara_signal_1',storyContractId:'mara_signal_1',storyFlag:'mara1',private:true,
      clientName:'Vector Operations Exchange',agentName:'Mara Venn',faction:null,
      title:'Courier Recovery',kind:'story',family:'combat_recovery',risk:2,minLevel:1,minRep:-100,
      pay:6000,xp:500,difficulty:2,implemented:true,
      description:"A VOX courier failed to make its hand-off. Clear the recovery area, scan its scattered wreckage for recoverable navigation data, reach the VOX communications centre, authenticate with its perimeter security drone, then close on the station and dock for the secure upload.",
      modules:[
        {
          type:'combat_recovery',label:'Clear and Scan Wreckage',target:5,fighterHp:12,difficulty:2,profile:'hostile',
          recoveryLabel:'recoverable VOX navigation data',wreckageSearch:true,wreckageCount:6,inspectSeconds:1.70,
          markerGrowRange:125,captureRadius:24,foundHold:.72,

          // The VOX courier's debris field is deliberately a broad 360-degree search,
          // with long travel legs between contacts rather than a local cluster.
          wreckageField:{
            ranges:[175,275,375,495,615,755,895,1040],
            azimuths:[.30,1.28,2.20,3.15,4.15,5.28,.78,3.72],
            elevations:[-.12,.17,.11,-.16,.13,-.19,.08,.16],
            fieldYawSpan:.34,distanceScaleMin:.94,distanceScaleSpan:.12,
            azimuthJitterSpan:.14,elevationJitterSpan:.08,
            scaleMin:1.90,scaleSpan:1.00
          },

          wreckageSearchFlow:{
            firstResultAlwaysMiss:true,
            clearSideChance:.5,clearanceMin:12,clearanceScale:5.6,
            clearForwardMin:19,clearForwardOffset:2.5,clearDuration:.34
          },

          wreckagePresentation:{
            searchPromptVoice:'searchWreckageForNavigationData',
            missVoice:'noRecoverableNavigationData',
            foundVoice:'navigationDataRecovered',
            searchingText:'SEARCHING WRECKAGE',searchingHold:.58,
            markerLabel:'WRECKAGE',contactsPrefix:'WRECKAGE CONTACTS',
            foundHud:'DATA RECOVERED'
          }
        },
        {type:'space_transit',label:'Proceed to Comms Centre',duration:3.4,message:'VOX COMMS CENTRE',voice:'proceedToVoxCommsCentre'},
        {type:'station_approach',label:'VOX Comms Centre Approach',stationModel:'vox_comms',approachDistance:340,difficulty:2},
        {type:'security_checkpoint',label:'Perimeter Security',transferSeconds:3.25,difficulty:2},
        {type:'station_cleared_approach',label:'Close on Comms Centre',stationModel:'vox_comms',difficulty:2},
        {type:'station_entry',label:'Autopilot Docking',stationModel:'vox_comms',difficulty:2},
        {type:'station_secure_transfer',label:'Secure Courier Upload',stationModel:'vox_comms',transferSeconds:4.5,difficulty:2},
        {type:'station_departure',label:'Depart VOX Comms Centre',stationModel:'vox_comms',difficulty:2}
      ],
      stages:['Clear and Scan Wreckage','Proceed to Comms Centre','VOX Comms Centre Approach','Perimeter Security','Close on Comms Centre','Autopilot Docking','Secure Courier Upload','Depart']
    },

    offerMail:{
      id:'mara_offer_1',from:'Mara Venn · Contractor Services, VOX',subject:'Courier recovery',category:'story',priority:'high',
      body:[
        'A VOX courier failed to make its last hand-off. The recovery area is full of scattered wreckage, and an armed group is still sitting on it.',
        'Clear them out and scan the wreckage for recoverable navigation data. Once you have it, proceed to the VOX communications centre. Its perimeter security drone will authenticate your credentials before docking clearance is granted.',
        'Once inside, upload the recovered navigation data to the secure terminal and leave.',
        'Simple job. Keep it that way.'
      ],
      action:{type:'story',contractId:'mara_signal_1',label:'OPEN VOX CONTRACT'}
    },

    completionMail:{
      id:'mara_wait_1',from:'Mara Venn · Contractor Services, VOX',subject:'One loose end',category:'story',priority:'high',
      body:[
        'Courier navigation data reached the secure comms node intact. Thanks.',
        'There is one thing I do not understand. Shortly before it dropped off the network, the courier changed course toward a set of coordinates in a remote swamp region. That destination does not appear anywhere in the filed route.',
        'VOX has no registered site there. I want to know why the courier was heading for it.',
        'Follow the coordinates, investigate whatever you find, make a full scan and bring the data back to VOX.'
      ],
      action:{type:'story',contractId:'mara_signal_2',label:'OPEN VOX CONTRACT'}
    },

    devMailOption:{contractId:'mara_signal_1',label:'1 · Courier Recovery'}
  }
};



const envStage=(id,overrides={})=>globalThis.AgentXEnvironments.stage(id,overrides);

const node42={
  id:'node42',
  campaign:{
    contract:{
      id:'story_mara_signal_2',storyContractId:'mara_signal_2',storyFlag:'mara2',private:true,
      clientName:'Vector Operations Exchange',agentName:'Mara Venn',faction:null,
      title:'Loose End',kind:'story',family:'investigation',risk:2,minLevel:1,minRep:-100,
      pay:7000,xp:580,difficulty:2,implemented:true,musicMode:'calm',
      planetaryRequirements:{landingBody:'either',landingColour:'cyan',moonCount:{min:1,max:2}},
      description:'The courier navigation log contains one unexplained destination in a remote swamp region. Follow the coordinates, investigate whatever is there, scan it in detail, then return the scan data to a VOX communications centre for secure analysis.',
      modules:[
        {type:'planet_descent',label:'Cyan World Descent',difficulty:2},
        envStage('swamp_approach',{type:'surface_destination_approach',label:'Swamp Approach',difficulty:2}),
        envStage('alien_swamp',{
          type:'forest_corridor',label:'Deep Swamp Coordinates',difficulty:2,
          terminalDestination:'swamp_monolith_scan',entryFrom:'surface_destination',
          terminalConfig:{
            gladeStartBeforeEnd:52,anchorAhead:7,worldZAhead:10.5,
            monolith:{yaw:.08,spinRate:.18,inscription:'42',yOffset:5.34,scale:.5,mx:3.45,my:7.25,mz:1.30,standOffDistance:14.8,standOffHeight:1.96},
            stars:{count:22,radiusMin:.40,radiusSpan:1.65,speedMin:.18,speedSpan:.16,sizeMin:.13,sizeSpan:.14},
            scanSeconds:8.0
          },
          presentation:{
            start:'FOLLOW SWAMP COORDINATES',scanStart:'SCANNING MONOLITH',scanComplete:'SCAN COMPLETE · RETURN DATA TO VOX',
            hudAhead:'MONOLITH AHEAD',hudAutopilot:'AUTOPILOT · MONOLITH',hudScan:'MONOLITH SCAN',hudComplete:'SCAN COMPLETE'
          }
        }),
        {type:'space_transit',label:'Return to VOX',duration:3.4,message:'VOX COMMS CENTRE',voice:'proceedToVoxCommsCentre'},
        {type:'station_approach',label:'VOX Comms Centre Approach',stationModel:'vox_comms',approachDistance:340,difficulty:2},
        {type:'security_checkpoint',label:'Perimeter Security',transferSeconds:3.25,difficulty:2},
        {type:'station_cleared_approach',label:'Close on Comms Centre',stationModel:'vox_comms',difficulty:2},
        {type:'station_entry',label:'Autopilot Docking',stationModel:'vox_comms',difficulty:2},
        {type:'station_secure_transfer',label:'Upload Monolith Scan',stationModel:'vox_comms',transferSeconds:4.5,difficulty:2},
        {type:'station_departure',label:'Depart VOX Comms Centre',stationModel:'vox_comms',difficulty:2}
      ],
      stages:['Descend to Cyan World','Cross the Plains','Follow Deep Swamp Trail','Return to VOX','VOX Comms Centre Approach','Perimeter Security','Close on Comms Centre','Autopilot Docking','Upload Monolith Scan','Depart']
    },
    offerMail:{
      id:'mara_offer_2',from:'Mara Venn · Contractor Services, VOX',subject:'Loose end',category:'story',priority:'high',
      body:[
        'The courier navigation log has one destination that does not belong on its route: a set of coordinates in a remote swamp region.',
        'VOX has no registered site at those coordinates. I want to know why the courier was heading there.',
        'Follow the coordinates, investigate whatever you find, and make a full scan. Bring the scan data back to a VOX communications centre for secure analysis.',
        'Do not improvise a theory. Bring me evidence.'
      ],
      action:{type:'story',contractId:'mara_signal_2',label:'OPEN VOX CONTRACT'}
    },
    completionMail:{
      id:'mara_wait_2',from:'Mara Venn · Contractor Services, VOX',subject:'Node 42',category:'story',priority:'high',
      body:[
        'The scan is conclusive. The object is a genuine military relay from the Partition War. Its network designation is Node 42.',
        'That network was decommissioned after the armistice. Node 42 should have been dead for decades. It is not. The relay was active when you scanned it.',
        'I forwarded the military traffic data to Kudo Shang at OSD. He says it may be relevant to a problem they are already dealing with.',
        'He has asked for you directly. Apparently it is urgent.'
      ]
    },
    devMailOption:{contractId:'mara_signal_2',label:'2 · Loose End'}
  }
};

const relay10={
  id:'relay10Defence',
  campaign:{
    contract:{
      id:'story_kudo_defence_1',storyContractId:'kudo_defence_1',storyFlag:'kudo1',private:true,
      clientName:'Orbital Security Directorate',agentName:'Kudo Shang',faction:null,
      title:'Emergency Defence',kind:'story',family:'station_defence_recovery',risk:3,minLevel:1,minRep:-100,
      pay:8500,xp:700,difficulty:3,implemented:true,
      description:'Relay 10 is under immediate attack by rogue Partition War-pattern military drones. Defend the station, search the destroyed attackers for recoverable routing data, then upload anything useful through the station terminal before returning to base.',
      modules:[{
        type:'station_defence_recovery',label:'Defend Station, Search Wreckage and Upload Data',stationModel:'relay',approachDistance:275,
        encounterChance:1,target:6,fighterHp:13,difficulty:3,profile:'rogue',startMessage:'Defend the station',
        wreckageSearch:true,useCombatWrecks:true,stationAnchor:true,wreckageCount:6,inspectSeconds:1.70,markerGrowRange:110,captureRadius:26,
        searchPromptText:'Search the drone wreckage for anything useful',missText:'No useful data recovered',foundText:'Partial routing record recovered',
        foundHud:'Routing record recovered',foundHold:1.15,wreckageSearchFlow:{firstResultAlwaysMiss:true},
        wreckagePresentation:{searchingText:'SEARCHING WRECKAGE',searchingHold:.58,markerLabel:'WRECKAGE',contactsPrefix:'WRECKAGE CONTACTS'},
        externalDataTerminal:true,terminalCaptureRadius:30,terminalStandOff:13,transferSeconds:3.2
      }],
      stages:['Defend Relay 10','Search Drone Wreckage','Upload Recovered Data','Clear Station and Return']
    },
    offerMail:{
      id:'kudo_offer_1',from:'Kudo Shang · Orbital Security Directorate',subject:'Immediate tasking — station under attack',category:'story',priority:'high',
      body:[
        'Venn forwarded your relay scan. We have seen Partition War-pattern drones making appearances recently. I will explain what we know when there is time.',
        'There is not time now. Relay 10 is under attack by those drones.',
        'Defend the station. Destroy every hostile. Then search the wreckage for anything that tells us where they came from.',
        'No quarter. Move.'
      ],
      action:{type:'story',contractId:'kudo_defence_1',label:'ACCEPT OSD TASKING'}
    },
    devMailOption:{contractId:'kudo_defence_1',label:'3 · Emergency Defence'}
  }
};

const corvellaManifest={
  id:'corvellaManifest',
  campaign:{
    contract:{
      id:'story_corvella_manifest_1',storyContractId:'corvella_manifest_1',storyFlag:'corvella1',private:true,
      clientName:'Free Traders Compact',agentName:'Corvella Pallis',faction:'trade',
      title:'Missing Manifest',kind:'story',family:'asteroid_wreck_recovery',risk:3,minLevel:1,minRep:-100,
      pay:9000,xp:720,difficulty:3,implemented:true,musicMode:'calm',
      description:'Follow an old Free Trader survey nav through an asteroid field to the last known position of a missing carrier. Enter the wreck, download its flight recorder data, then return the recovered records to a Free Traders freight depot exterior terminal.',
      modules:[{
        type:'asteroid_wreck_recovery',label:'Missing Manifest',difficulty:3,target:5,fighterHp:12,profile:'pirate',
        combatVoice:'pirateAmbushDestroyPirates',ambushMessage:'Pirate ambush! Destroy the pirates.',
        route:{navDistance:540,navX:18,navY:-4,ambushDelay:4.2,navCaptureRadius:68,
          startMessage:'Proceed to the wreck',
          resumeMessage:'Wreck located. Continue through the field',
          thinMessage:'Wreck ahead. Continue through the asteroid belt'},
        wreck:{asset:'leviathanTrueSeparation04',scale:22,spawnDistance:1050,spawnX:8,spawnY:-1,
          rot:[.08,.16,-.07],revealDistance:700,
          gapLocal:[0,-.12,2.75],gapCaptureRadius:20,
          entryLocal:[0,-.15,-.18],entryAutopilotSpeed:16.5,entryAutopilotStop:1.55,
          blackBoxLocal:[0,-.13,-2.64],recorderStopLocal:[0,-.15,-2.10],recorderStopRadius:.65,
          transferSeconds:3.0,turnSeconds:1.75,interiorAutopilotSpeed:12.5,
          exitLocal:[0,-.15,.92],exitRevealRadius:54,exitCaptureRadius:3.5},
        returnTransit:{duration:3.15,message:'RETURNING TO FREE TRADERS FREIGHT DEPOT',hud:'TO FREIGHT DEPOT'}
      },{
        type:'free_traders_depot_terminal',label:'Upload Recorder Data',difficulty:1,scale:26,
        // Deliberately arrive on a clear three-quarter view rather than presenting the
        // warehouse facade square-on.  The lateral spawn is opposite the depot yaw so
        // the camera does not accidentally line back up with the rotated front face.
        spawnDistance:475,spawnX:-36,spawnY:-12,pitch:-.085,yaw:.58,roll:.05,
        startMessage:'Free Traders freight depot ahead',depotRevealRadius:205,terminalStageDistance:82,terminalCaptureRadius:86,
        terminalStandOff:15.5,transferSeconds:3.1,turnSeconds:1.75,clearDistance:52
      }],
      stages:['Cross the Asteroid Field','Destroy the Pirates','Continue to the Wreck','Reach the Wreck','Autopilot Into the Freighter','Download Flight Recorder Data','Exit the Wreck','Return to Free Traders Depot','Upload Recorder Data']
    },
    offerMail:{
      id:'corvella_offer_1',from:'Corvella Pallis · Free Traders Compact',subject:'Well, this is interesting',category:'story',priority:'high',
      body:[
        'Sweetie, your friend Shang sent me a shopping list with all the warmth of a search warrant.',
        'One of the materials in that equipment is specialised enough to follow. Not unique, unfortunately, but it moves in small quantities and the people moving it tend to remember who paid for it.',
        'I found a shipment that should not be where it ended up. A Free Traders carrier moved it off the books six months ago. The carrier never reached its declared destination.',
        'I have its last transponder position. It is inside an asteroid field. Follow the old survey nav in, find the wreck and download its flight recorder. If the carrier kept a local copy of the cargo manifest, it should be in there. Bring the recovered data back to our freight depot terminal. Six months out there means anything obvious was probably stripped long ago, but the recorder may still have what I need.',
        'Try not to shoot the paperwork.'
      ],
      action:{type:'story',contractId:'corvella_manifest_1',label:'OPEN FREE TRADERS CONTRACT'}
    },
    completionMail:{
      id:'corvella_wait_1',from:'Corvella Pallis · Free Traders Compact',subject:'Got it',category:'story',priority:'normal',
      body:[
        'Sweetie, I get a little dizzy just thinking about you and that big muscly drone of yours kicking those nasty pirates\' asses. Then you went crawling through that wreck for me. You really do know how to make an impression.',
        'The recorder transfer is complete and I have already got my hands all over the manifest. Give me a little time to work out what it actually tells us.',
        'The carrier was not making the run shown on its filed route. That much is already obvious. Naughty thing.'
      ]
    },
    devMailOption:{contractId:'corvella_manifest_1',label:'5 · Missing Manifest'}
  }
};


const cassianFavour={
  id:'cassianFavour',
  campaign:{
    contract:{
      id:'story_cassian_favour_1',storyContractId:'cassian_favour_1',storyFlag:'cassian1',private:true,
      clientName:'Red Jackal Combine',agentName:'Cassian Erivan-Snade',faction:'jackals',
      title:'A Small Favour',kind:'story',family:'urban_penthouse_delivery',risk:3,minLevel:1,minRep:-100,
      pay:4500,xp:680,difficulty:3,implemented:true,musicMode:'calm',
      description:'Cassian will trace the freight missing from the Free Traders manifest, but first he wants a sealed case delivered to a private Aurelia City penthouse. Customs must not inspect it. Clear the interception, descend to the city and make the handoff in the penthouse receiving room.',
      modules:[
        {type:'customs_drones',label:'Customs Intercept',difficulty:3,target:7,fighterHp:12},
        {type:'planet_descent',label:'Planet Descent',difficulty:3},
        {type:'surface_destination_approach',label:'Aurelia City Approach',difficulty:3,terrain:'plains',destination:'city',routeLength:430,treeClumps:9},
        {type:'jackal_city_delivery',label:'Penthouse Delivery',difficulty:3,cityLength:620}
      ],
      stages:['Customs Intercept','Planet Descent','Cross the Plains','Aurelia City','Penthouse Delivery']
    },
    offerMail:{
      id:'cassian_offer_1',from:'Cassian Erivan-Snade · Red Jackal Combine',subject:'A modest consideration',category:'story',priority:'high',
      body:[
        'X. Mara Venn has asked me to pursue a trail that sensible people have taken considerable trouble to erase. Naturally, I am intrigued.',
        'I can find out who bought your missing cargo. Before I begin pulling on that thread, I require a small consideration.',
        'A sealed case must reach a private penthouse in Aurelia City. It is not to be opened, scanned or surrendered. The Customs Authority may exhibit an unhelpful interest in it.',
        'Place it in the penthouse receiving room and leave. Do that, and I shall discover where your freighter\'s cargo went.'
      ],
      action:{type:'story',contractId:'cassian_favour_1',label:'ACCEPT RED JACKAL FAVOUR'}
    },
    completionMail:{
      id:'cassian_wait_1',from:'Cassian Erivan-Snade · Red Jackal Combine',subject:'The Custodian',category:'story',priority:'high',
      body:[
        'Your parcel arrived. The Customs Authority\'s objections, I gather, did not. A pleasingly concise performance.',
        'I have kept my side of the bargain. Your missing cargo was split across shell carriers after the rendezvous: fabrication feedstock, power-control hardware and several pieces of obsolete Partition War command equipment.',
        'The purchases converge on a buyer known in less reputable ledgers as the Custodian. I had assumed an obsessive collector. Collectors accumulate relics. This individual is assembling capability.',
        'One consignment is odder still: specialist biological containment equipment. Its destination sits on the edge of known xeno territory.',
        'I suggest you give that last detail back to Ms Venn. Biology is not my preferred form of ugliness.'
      ]
    },
    devMailOption:{contractId:'cassian_favour_1',label:'6 · A Small Favour'}
  }
};


const helixFieldSamples={
  id:'helixFieldSamples',
  campaign:{
    contract:{
      id:'story_helix_xeno_samples_1',storyContractId:'helix_xeno_samples_1',storyFlag:'helix1',private:true,
      clientName:'Helix Industrial Group',agentName:'Navira Derris',faction:'helix',
      title:'Field Samples',kind:'story',family:'station_defence_recovery',risk:3,minLevel:1,minRep:-100,
      pay:6500,xp:650,difficulty:3,implemented:true,musicMode:'calm',
      description:'A station on the edge of xeno territory is under attack. Destroy the xenoforms, recover fresh biological material after the battle, then return the sample to the Helix orbital biolab for analysis.',
      modules:[{
        type:'station_defence_recovery',label:'Xeno Clearance and Sample Recovery',stationModel:'relay',approachDistance:305,
        encounterChance:1,target:7,fighterHp:12,difficulty:3,profile:'xeno',startMessage:'Xeno attack — clear the station',
        combatVoiceSequence:['helixArrivingAtStation','helixDestroyXenos'],recoveryPromptVoice:'helixCollectTissueSample',
        stationAnchor:true,useCombatWrecks:true,biologicalRecovery:true,recoveryLabel:'xeno material',markerLabel:'XENO SAMPLE',
        recoveryHudPrefix:'XENO SAMPLE',captureRadius:21,markerGrowRange:105,tractorSeconds:2.2,recoveredMessage:'XENO MATERIAL SECURED'
      },{
        type:'space_transit',label:'Return to Helix',duration:3.25,message:'HEADING TO HELIX LAB',hud:'TO HELIX LAB',playZoomSound:true,
        voice:'helixDeliverTissueSampleToBiolab',waitForVoice:true
      },{
        type:'helix_biolab_approach',label:'Helix Orbital Biolab',navDistance:720,navX:48,navY:-12,labScale:34,planetRadius:290,
        revealRadius:220,hatchCaptureRadius:92,hatchStandOff:15.5,hatchOpenSeconds:.82,deliverySeconds:2.35,hatchCloseSeconds:.74,turnSeconds:1.78,clearDistance:58,
        message:'PROCEED TO HELIX ORBITAL BIOLAB',hud:'HELIX BIOLAB',markerLabel:'HELIX BIOLAB',deliveryVoice:'helixSampleDelivered'
      }],
      stages:['Defend the Station','Recover Xeno Material','Return to Helix','Approach Helix Biolab','Deliver Sample']
    },
    offerMail:{
      id:'helix_offer_1',from:'Navira Derris · Helix Industrial Group',subject:'Fresh material',category:'story',priority:'high',
      body:[
        'Mara Venn sent me the biological-containment entry from Cassian\'s procurement trace. It is suggestive, but not sufficient to tell us what the buyer wanted to contain.',
        'I need fresh comparative material. A station on the edge of xeno territory is currently under attack. The timing is unusually convenient.',
        'Destroy the attacking xenoforms. Once the area is clear, recover intact biological material from one of them.',
        'Bring the sample to our orbital biolab. I would prefer it not be shot again after you have recovered it.'
      ],
      action:{type:'story',contractId:'helix_xeno_samples_1',label:'ACCEPT HELIX TASK'}
    },
    devMailOption:{contractId:'helix_xeno_samples_1',label:'7 · Field Samples'}
  }
};


const tacoBeaconFalseLead={
  id:'tacoBeaconFalseLead',
  campaign:{
    contract:{
      id:'story_taco_beacon_false_lead_1',storyContractId:'taco_beacon_false_lead_1',storyFlag:'nyxo1',private:true,
      clientName:'QuickBite Orbital',agentName:'Nyxo Malloc',faction:'quickbite',
      title:'Hot Delivery',kind:'story',family:'food_delivery',risk:3,minLevel:1,minRep:-100,
      pay:5500,xp:580,difficulty:3,implemented:true,musicMode:'calm',
      description:'Mara suspects the repeated attacks on a Taco Beacon route may involve rogue drones. Collect the waiting order, take it to an isolated asteroid base, identify the attackers and complete the delivery.',
      modules:[{
        type:'taco_beacon_pickup',label:'Taco Beacon Pickup',spawnDistance:520,spawnX:-78,spawnY:-14,scale:18,pitch:-.04,yaw:.50,roll:.025,
        revealRadius:220,captureRadius:92,stageDistance:92,standOff:17,transferSeconds:2.5,pickupSeconds:2.15,turnSeconds:1.65,clearDistance:54,
        startMessage:'Proceed to Taco Beacon',hud:'TACO BEACON',markerLabel:'TACO BEACON'
      },{
        type:'space_transit',label:'Asteroid Base Transit',duration:3.35,voice:'headingToAsteroidMine',waitForVoice:true,message:'HEADING TO ASTEROID MINE',hud:'TO ASTEROID BASE',playZoomSound:true
      },{
        type:'taco_asteroid_delivery',label:'Asteroid Base Delivery',routeSeconds:22,cargoStyle:'food',
        target:6,fighterHp:12,difficulty:3,profile:'pirate',combatVoice:'destroyThePirates',ambushMessage:'Destroy the pirates.',
        startMessage:'Destroy the pirates.',hud:'ASTEROID DELIVERY'
      }],
      stages:['Go to Taco Beacon','Transmit Order Data','Collect Order','Head to Asteroid Base','Destroy the Pirates','Deliver Food']
    },
    offerMail:{
      id:'taco_beacon_offer_1',from:'Mara Venn · Contractor Services, VOX',subject:'Possible drone activity',category:'story',priority:'high',
      body:[
        'Helix has the tissue sample. Navira needs time to locate the nest and work out whether she can mask you with the right pheromones.',
        'While she does that, I have another lead. Taco Beacon has lost several deliveries on a route into an asteroid field. The reports are confused, but some descriptions sound like small automated attackers.',
        'It may be nothing. I want you on the next run so we can see what actually turns up.',
        'I have put you in touch with Nyxo Malloc at QuickBite Orbital. He has the route and the order details.'
      ],
      action:{type:'storyBriefing',contractId:'taco_beacon_false_lead_1',label:'CONTACT QUICKBITE'}
    },
    briefingMail:{
      id:'taco_beacon_briefing_1',from:'Nyxo Malloc · Dispatch, QuickBite Orbital',subject:'Your food run, dude',category:'story',priority:'high',
      body:[
        'Dude, Mara says you are taking the asteroid-base run. Awesome. Taco Beacon has an order sitting there getting older while our normal drivers suddenly remember they have survival instincts.',
        'Come to Taco Beacon, hit the service-wing terminal so the order knows who you are, then grab the food from the hatch next to it. You do not need to move between them.',
        'Take it through the asteroid field to the mining base. If something starts shooting at you, deal with that first. The base can wait five minutes. Apparently tacos can survive that. Corporate checked.',
        'Then get the food into the normal delivery bay. Try not to eat it. They count everything.'
      ],
      action:{type:'story',contractId:'taco_beacon_false_lead_1',label:'TAKE THE DELIVERY'}
    },
    completionMail:{
      id:'taco_beacon_wait_1',from:'Mara Venn · Contractor Services, VOX',subject:'False lead',category:'story',priority:'normal',
      body:[
        'I checked the combat telemetry. Pirates. Ordinary ships, ordinary weapons, no Partition War command hardware and nothing tying them to the Custodian.',
        'So that route is a dead end. Helix is still working on the tissue sample.',
        'Nyxo has your contact details now. Apparently getting somebody\'s dinner through a pirate attack made an impression.'
      ]
    },
    devMailOption:{contractId:'taco_beacon_false_lead_1',label:'8 · Hot Delivery'}
  }
};

const helixNestStrike={
  id:'helixNestStrike',
  campaign:{
    contract:{
      id:'story_helix_xeno_nest_2',storyContractId:'helix_xeno_nest_2',storyFlag:'helix2',private:true,
      clientName:'Helix Industrial Group',agentName:'Navira Derris',faction:'helix',
      title:'Nest Strike',kind:'story',family:'xeno_nest',risk:5,minLevel:1,minRep:-100,
      pay:10500,xp:1080,difficulty:5,implemented:true,musicMode:'calm',
      description:'Helix has traced the recovered tissue to a probable parent nest and synthesised a pheromone mask. Collect the compound from the orbital biolab, then penetrate and destroy the nest.',
      modules:[{
        type:'helix_biolab_approach',label:'Collect Pheromone Mask',transferMode:'pickup',payloadKind:'pheromone',
        navDistance:720,navX:48,navY:-12,labScale:34,planetRadius:290,revealRadius:220,hatchCaptureRadius:92,hatchStandOff:15.5,
        hatchOpenSeconds:.82,deliverySeconds:2.35,hatchCloseSeconds:.74,turnSeconds:1.78,clearDistance:58,
        message:'PROCEED TO HELIX ORBITAL BIOLAB',hud:'HELIX BIOLAB',markerLabel:'HELIX BIOLAB',
        hatchLabel:'PHEROMONE PICKUP',hatchPrompt:'PROCEED TO PHEROMONE PICKUP',securedMessage:'PHEROMONE MASK SECURED'
      },{
        type:'space_transit',label:'Proceed to Xeno Nest',duration:3.35,message:'HEADING TO XENO NEST',hud:'TO XENO NEST',playZoomSound:true
      },{
        type:'xeno_nest',label:'Destroy Xeno Nest',message:'XENO NEST · APPROACH',hud:'XENO NEST'
      }],
      stages:['Go to Helix Biolab','Collect Pheromone Mask','Proceed to Xeno Nest','Destroy the Nest']
    },
    offerMail:{
      id:'helix_nest_offer_2',from:'Navira Derris · Helix Industrial Group',subject:'Pheromone mask ready',category:'story',priority:'high',
      body:[
        'The tissue analysis is complete. We isolated the recognition compounds used by the nest and can reproduce them closely enough to suppress its initial response.',
        'The same chemical signature let us trace the sample back to a probable parent organism. We have a location.',
        'The masking compound is ready at the Helix orbital biolab. Collect it there, then proceed directly to the nest.',
        'Do not confuse masking with immunity. Damage a xenoform or brood cell and the organism will recognise the intrusion.'
      ],
      action:{type:'story',contractId:'helix_xeno_nest_2',label:'COLLECT PHEROMONE MASK'}
    },
    completionMail:{
      id:'helix_nest_wait_2',from:'Navira Derris · Helix Industrial Group',subject:'What the nest was hiding',category:'story',priority:'high',
      body:[
        'The nest is destroyed. Your flight telemetry from inside it has been through analysis, and it shows something I did not expect.',
        'Several brood chambers show clean surgical extraction. Something removed the homing organ from mature xenoforms, precisely and repeatedly. Xenos do not do that to each other.',
        'The homing organ lets a xenoform find its nest across enormous distances without any beacon or navigation network. The biological containment equipment in Cassian\'s trace is exactly what you would need to keep that tissue alive in transit.',
        'My conclusion is that someone is teaching the drone network to navigate the way xenos do: independently, with nothing that can be switched off or traced. I have sent the full analysis to Mara Venn.'
      ]
    },
    devMailOption:{contractId:'helix_xeno_nest_2',label:'9 · Nest Strike'}
  }
};


const quickbiteRouteAnomaly={
  id:'quickbiteRouteAnomaly',
  campaign:{
    contract:{
      id:'story_quickbite_route_anomaly_2',storyContractId:'quickbite_route_anomaly_2',storyFlag:'nyxo2',private:true,
      clientName:'QuickBite Orbital',agentName:'Nyxo Malloc',faction:'quickbite',
      title:'Route Interference',kind:'story',family:'secure_terminal_intrusion',risk:4,minLevel:1,minRep:-100,
      pay:9800,xp:860,difficulty:4,implemented:true,musicMode:'calm',
      description:'QuickBite routing is being repeatedly diverted around an old relay beacon. Investigate the affected route, deal with whatever is guarding the beacon, hack its routing system and return home.',
      modules:[{
        type:'station_minefield_approach',label:'Routing Beacon Perimeter',stationModel:'Crossroads Outpost',difficulty:4,
        routeSeconds:22,mineCount:64,minefieldActivationDistance:1000,mineTriggerRadius:15.5,mineBlastRadius:22,
        combatBeforeApproach:true,target:6,fighterHp:14,profile:'rogue',encounterId:'quickbite_route_rogue_drones',
        combatMessage:'Rogue drones on the beacon perimeter',postCombatMessage:'Rogue drones destroyed · proceed to beacon',
        navLabel:'BEACON NAV',dockLabel:'BEACON ACCESS',hud:'ROUTING BEACON'
      },{
        type:'station_terminal_hack',label:'Hack Routing Beacon',difficulty:4,hackSeconds:4.8,
        acquiredMessage:'ROUTING BEACON INTERFACE ACQUIRED',completeMessage:'BEACON HACK COMPLETE · ROUTES RESTORED',
        hackHudPrefix:'BEACON HACK',completeHud:'BEACON HACK COMPLETE'
      },{
        type:'station_hack_escape',label:'Return Home',difficulty:4,escapeDistance:260,
        escapeMessage:'CLEAR THE ROUTING BEACON'
      }],
      stages:['Destroy the Rogue Drones','Cross the Minefield','Hack the Routing Beacon','Return Home']
    },
    offerMail:{
      id:'quickbite_route_offer_2',from:'Nyxo Malloc · Dispatch, QuickBite Orbital',subject:'Route is screwed again',category:'story',priority:'high',
      body:[
        'Dude, remember that asteroid run? Different problem this time. One of our delivery routes keeps diverting everybody around an old relay beacon.',
        'That would just be normal terrible route planning, except the beacon is still feeding live changes into the network. Every time Dispatch works around it, the route gets bent again.',
        'Can you go there and make it stop? If somebody is actively running the thing, that is way above my pay grade. I just need our drivers to stop taking an extra forty minutes to deliver noodles.',
        'I do not know what is actually out there. Dispatch just keeps getting told to go somewhere else.'
      ],
      action:{type:'story',contractId:'quickbite_route_anomaly_2',label:'CHECK THE ROUTING BEACON'}
    },
    completionMail:{
      id:'quickbite_route_wait_2',from:'Nyxo Malloc · Dispatch, QuickBite Orbital',subject:'Routes are normal',category:'story',priority:'normal',
      body:[
        'Dude. Routes are normal again. That is genuinely the best thing that has happened to Dispatch all week.',
        'Also, rogue drones guarding a hacked military beacon is apparently not a normal routing fault. I sent the beacon logs and your combat telemetry to Mara because I am extremely not qualified for antique murder-network archaeology.',
        'QuickBite can deliver food again. Whatever the hell you found out there is somebody else\'s problem now. Awesome.'
      ]
    },
    devMailOption:{contractId:'quickbite_route_anomaly_2',label:'10 · Route Interference'}
  }
};

// Mission 11: the final investigation mission. The carrier is a real set-piece
// (system-carrier-intercept.js): escort fight, destructible turrets and engines,
// autopilot dock at its data port, core download, then the scuttle charge.
// The VOX upload chain afterwards is the established secure-transfer run.
const maraCarrierIntercept={
  id:'maraCarrierIntercept',
  campaign:{
    contract:{
      id:'story_mara_signal_3',storyContractId:'mara_signal_3',storyFlag:'mara3',private:true,
      clientName:'Vector Operations Exchange',agentName:'Mara Venn',faction:null,
      title:'Carrier Intercept',kind:'story',family:'carrier_intercept',risk:4,minLevel:1,minRep:-100,
      pay:11500,xp:940,difficulty:4,implemented:true,
      description:'An unregistered Partition War logistics carrier is in the corridor the hacked beacon kept clear. Destroy its drone escort under fire from its turrets. When it runs, chase it down, shoot out its stern vents and turrets, blow the stern hatch and board it. Download the navigation core from its terminal and get out before the scuttle charge fires, then upload the core at a VOX communications centre.',
      modules:[
        {
          type:'carrier_intercept',label:'Intercept the Carrier',difficulty:4,
          target:5,fighterHp:14,profile:'rogue',combatVoiceSequence:['rogueDronesDetected','carrierContactDestroyEscort'],
          // Rogue Carrier B (Manta). Phase 1: holds the area on a slow turning cruise.
          scale:26,spawnDistance:430,spawnX:-150,spawnY:-30,headingLocal:[1,0,.15],holdSpeed:8,holdTurnRate:.10,
          // Phase 2: autopilot pursuit with free aim. With engines intact the carrier is FASTER
          // than X (cruise 45): the range opens and at escapeRange it is gone. Each vent destroyed
          // takes it down a step (60 -> 52 -> 42 -> 34); after two X starts closing. Crippled it
          // limps at 12 and the autopilot closes to boarding range.
          chaseSpeeds:[60,52,42,34],limpSpeed:12,chaseStartGap:150,boardingGap:55,limpCloseRate:30,escapeWarn:340,escapeRange:520,
          chaseHeightAbove:1.7,chaseHeightBelow:1.4,chaseHeightHatch:.9,chaseSway:.35,chaseCatchUpSpeed:110,
          turretHp:10,ventHp:6,hatchHp:6,turretRange:240,turretBoltCap:3,roundSpeed:26,roundError:1.35,turretFireMin:2.1,turretFireSpan:1.2,
          launchRange:360,
          // Phase 3: board through the stern hatch, download, escape the scuttle charge.
          hatchStageDistance:70,transferSeconds:4.5,scuttleSeconds:7
        },
        {type:'space_transit',label:'Proceed to Comms Centre',duration:3.4,message:'VOX COMMS CENTRE',voice:'proceedToVoxCommsCentre'},
        {type:'station_approach',label:'VOX Comms Centre Approach',stationModel:'vox_comms',approachDistance:340,difficulty:3},
        {type:'security_checkpoint',label:'Perimeter Security',transferSeconds:3.25,difficulty:3},
        {type:'station_cleared_approach',label:'Close on Comms Centre',stationModel:'vox_comms',difficulty:3},
        {type:'station_entry',label:'Autopilot Docking',stationModel:'vox_comms',difficulty:3},
        {type:'station_secure_transfer',label:'Upload Carrier Nav Core',stationModel:'vox_comms',transferSeconds:4.5,difficulty:3},
        {type:'station_departure',label:'Depart VOX Comms Centre',stationModel:'vox_comms',difficulty:3}
      ],
      stages:['Destroy the Escort','Chase the Carrier','Knock Out Vents and Turrets','Blow the Stern Hatch','Board and Download the Nav Core','Escape the Scuttle Charge','Proceed to Comms Centre','Perimeter Security','Autopilot Docking','Upload Nav Core','Depart']
    },

    offerMail:{
      id:'mara_offer_3',from:'Mara Venn · Contractor Services, VOX',subject:'The corridor',category:'story',priority:'high',
      body:[
        'Nyxo sent me the beacon logs. The rerouting was not random. Every change pushed civilian traffic out of one narrow corridor through the outer lanes.',
        'Put that next to Corvella\'s manifest, Cassian\'s buyer and Navira\'s analysis and there is a pattern. Something large uses that corridor, it navigates without the relay network, and somebody is working hard to keep witnesses out of its way.',
        'VOX long-range tracking has a heavy contact moving through the corridor now, with a drone escort. The profile matches a Partition War logistics carrier. It is not on any register.',
        'Intercept it. While its escort is flying it will stand and fight, and its turrets are real. Once the escort is gone it will run, so stay with it.',
        'Its stern vents are its weak point: shoot them out and it will be reduced to a crawl. Clear its turrets, blow the stern hatch and go inside. The navigation core terminal is at the end of the keel corridor.',
        'Military carriers were built to scuttle rather than be captured. The moment you are inside its systems, expect it to try. Do not still be aboard when it goes.',
        'Bring the data to a VOX communications centre. That core knows where the carrier has been going.'
      ],
      action:{type:'story',contractId:'mara_signal_3',label:'OPEN VOX CONTRACT'}
    },

    completionMail:{
      id:'mara_wait_3',from:'Mara Venn · Contractor Services, VOX',subject:'We found the factory',category:'story',priority:'high',
      body:[
        'Good work on the carrier. The scuttle charge took the hull, but the core you pulled is intact and it decrypted.',
        'Every route it logged starts and ends at the same place: a Partition War manufacturing complex on an outer-system moon. It was listed as destroyed at the armistice.',
        'It was not destroyed. Power output is climbing, traffic is regular, and that carrier was feeding it.',
        'The core also carried a command authorisation that does not belong to the war. Somebody new has been given the keys. That is the Custodian.',
        'We found the factory, X. I am taking this to Kudo and OSD now. Get your drone repaired. You will hear from me soon.'
      ]
    },

    devMailOption:{contractId:'mara_signal_3',label:'11 · Carrier Intercept'}
  }
};

// Mission 12 (FINAL): the factory moon. Kudo's strike. Rogue drone screen in orbit,
// moon descent, then the ground assault set-piece (system-ground-assault.js, variant
// 'factory'): six generators, shield domes, bunker, tunnel, antimatter reactor, escape,
// and the moon going up behind you. Ending (Dave): well done and thanks, nothing changes.
const kudoFactoryMoon={
  id:'kudoFactoryMoon',
  campaign:{
    contract:{
      id:'story_kudo_factory_3',storyContractId:'kudo_factory_3',storyFlag:'kudo3',private:true,
      clientName:'Orbital Security Directorate',agentName:'Kudo Shang',faction:null,
      title:'Factory Moon',kind:'story',family:'factory_assault',risk:5,minLevel:1,minRep:-100,
      pay:15000,xp:1250,difficulty:5,implemented:true,
      planetaryRequirements:{landingBody:'moon',landingColour:'orange',moonCount:{min:1,max:2}},
      description:'The carrier fed a Partition War factory on an orange outer-system moon. Break the rogue drone screen in orbit and descend. Destroy the six generators powering the site: armour guards some, Tesla Striders hold shield domes over the rest. With all six down the bunker shield fails. Run the tunnel, destroy the antimatter reactor and get out before the moon goes with it.',
      modules:[
        {type:'fighters',label:'Rogue Drone Screen',target:12,fighterHp:16,profile:'rogue',difficulty:5},
        {type:'planet_descent',label:'Factory Moon Descent',difficulty:5},
        {type:'factory_assault',label:'Factory Assault',difficulty:5}
      ],
      stages:['Break the Rogue Drone Screen','Descend to the Factory Moon','Destroy the Six Generators','Enter the Bunker','Tunnel Run','Destroy the Reactor','Escape','Clear the Moon']
    },

    offerMail:{
      id:'kudo_offer_3',from:'Kudo Shang · Orbital Security Directorate',subject:'Factory moon — strike order',category:'story',priority:'high',
      body:[
        'VOX passed me the carrier data. The factory is real, it is running, and it sits on an orange moon in the outer system. The armistice list says it was destroyed. The armistice list is wrong.',
        'OSD is not waiting for a committee to find its nerve. You are the strike.',
        'Rogue drones are screening the moon. Cut through them and descend.',
        'Six generators power the site. Armour guards some of them. Tesla Striders hold shield domes over the rest. Kill the Strider and its dome drops. Kill all six generators and the bunker shield drops.',
        'The bunker runs down to the reactor. It is a Partition War antimatter lattice: antimatter held in suspension fields threaded through the moon\'s mantle. The builders used the moon itself as the containment vessel. It was banned at the armistice for exactly the reason you are about to exploit.',
        'Destroy the core and the suspension fields collapse. The antimatter meets the rock. The moon does not survive that. Neither will you, if you are still underground.',
        'Decisive force. No quarter. Finish it.'
      ],
      action:{type:'story',contractId:'kudo_factory_3',label:'ACCEPT OSD STRIKE ORDER'}
    },

    completionMail:{
      id:'kudo_wait_3',from:'Kudo Shang · Orbital Security Directorate',subject:'Factory moon — confirmed destroyed',category:'story',priority:'high',
      body:[
        'Confirmed. The moon is debris. The factory is gone. Payment released.',
        'Decisive. That is how force is applied.',
        'The Custodian authorisation was not recovered and OSD will not be chasing a name. There are older installations out there. None of them are my problem until they shoot at something that is.',
        'Standard tasking resumes.'
      ]
    },

    epilogueMail:{
      id:'mara_epilogue_3',from:'Mara Venn · Contractor Services, VOX',subject:'Afterwards',category:'story',priority:'normal',
      body:[
        'Kudo sent me the footage. I watched the moon go three times. Thank you, X. I mean that.',
        'Now the part nobody puts in the report. VOX closed the file this morning. The Custodian key never answered again, the carrier network went quiet and the committee called it resolved.',
        'The corridor is open. The traders are back in it. Nyxo tells me the lunch runs are on time.',
        'Every network on the board has seen the footage. Your standing has gone up everywhere, and somebody at VOX has started calling you Moonbreaker. I did not stop them.',
        'Tomorrow somebody will find another beacon nobody remembered to switch off, and there will be another contract on the board. That is the job. This was a good one.',
        'Go and get paid.'
      ]
    },

    devMailOption:{contractId:'kudo_factory_3',label:'12 · Factory Moon'}
  }
};


// v307: retry mail. A failed or abandoned story job stays open; the agent says
// why in one or two lines of their own voice. The run restarts from its start.
const MARA='Mara Venn · Contractor Services, VOX',KUDO='Kudo Shang · Orbital Security Directorate',
  CORVELLA='Corvella Pallis · Free Traders Compact',CASSIAN='Cassian Erivan-Snade · Red Jackal Combine',
  NAVIRA='Navira Derris · Helix Industrial Group',NYXO='Nyxo Malloc · Dispatch, QuickBite Orbital';
const storyRetry={
  mara_signal_1:{from:MARA,label:'OPEN VOX CONTRACT',
    failed:{subject:'Courier recovery — still open',body:['We lost the drone. The wreckage is still out there and so is whoever was sitting on it.','Allocation has another airframe ready. Go again.']},
    abandoned:{subject:'Courier recovery — you pulled out',body:['You pulled out. Fine, the wreckage is not going anywhere.','Neither is the job. It is still yours when you are ready.']}},
  mara_signal_2:{from:MARA,label:'OPEN VOX CONTRACT',
    failed:{subject:'Loose end — try again',body:['Your feed dropped in the swamp. Whatever is at those coordinates, it is still there.','I still want that scan.']},
    abandoned:{subject:'Loose end — still loose',body:['You turned back. The coordinates have not moved.','When you are ready, go and look.']}},
  kudo_defence_1:{from:KUDO,label:'ACCEPT OSD TASKING',
    failed:{subject:'Relay 10 — second wave',body:['Your drone went down. The attackers pulled back to regroup. They will hit Relay 10 again.','Be there when they do. Finish it.']},
    abandoned:{subject:'Relay 10 — you broke off',body:['You broke off. The station held, barely. The drones will return.','Hold the line this time.']}},
  kudo_bunker_2:{from:KUDO,label:'ACCEPT OSD TASKING',
    failed:{subject:'Source trace — hard target',body:['The installation killed your drone. That makes it a hard target, not an impossible one.','Go back in. Decisive force.']},
    abandoned:{subject:'Source trace — incomplete',body:['You withdrew. The installation is still standing.','That is not an outcome I accept. Return and finish the job.']}},
  corvella_manifest_1:{from:CORVELLA,label:'OPEN FREE TRADERS CONTRACT',
    failed:{subject:'Sweetie. The wreck.',body:['All those guns and you still came home without my flight recorder, sweetie. I had a whole picture in my head and you ruined it.','The wreck is still sitting out there. Go back and make it up to me.']},
    abandoned:{subject:'Babe, you walked out on me',body:['You took my job and then just turned that gorgeous machine around? Rude, babe.','The carrier is still out there. So am I. Go and get my records.']}},
  cassian_favour_1:{from:CASSIAN,label:'ACCEPT RED JACKAL FAVOUR',
    failed:{subject:'A minor setback',body:['The case did not arrive. How very disappointing for everyone concerned.','Fortunately my client is patient, and a second case has been prepared. I trust this one will enjoy a more uneventful journey.']},
    abandoned:{subject:'Second thoughts',body:['You appear to have had second thoughts. I find that people usually have third ones.','The penthouse is still expecting its delivery.']}},
  helix_xeno_samples_1:{from:NAVIRA,label:'ACCEPT HELIX TASK',
    failed:{subject:'Field samples — telemetry received',body:['Your drone was lost. The telemetry up to that point is useful. Thank you for it.','The xenoforms are still attacking the station. I still need the sample.']},
    abandoned:{subject:'Field samples — still required',body:['You withdrew before recovery. The infestation has not dispersed.','The opportunity remains. I would like the sample intact.']}},
  taco_beacon_false_lead_1:{from:NYXO,label:'CONTACT QUICKBITE',
    failed:{subject:'Dude, the tacos',body:['So the order did not make it and now Support is on my back about refunds. Awesome.','There is another order up. Same route. Please make it this time.']},
    abandoned:{subject:'You bailed?',body:['Dude, you bailed. That customer is still hungry and now I have to listen to it.','Order is still up when you want it.']}},
  helix_xeno_nest_2:{from:NAVIRA,label:'COLLECT PHEROMONE MASK',
    failed:{subject:'Nest strike — the nest responded',body:['The nest recognised the intrusion and responded decisively. That is fascinating, and inconvenient for your drone.','The masking compound is still viable. Try again.']},
    abandoned:{subject:'Nest strike — not concluded',body:['You pulled out. The nest remains. So does my curiosity.','The mask is ready whenever you are.']}},
  quickbite_route_anomaly_2:{from:NYXO,label:'CHECK THE ROUTING BEACON',
    failed:{subject:'Beacon still screwing us',body:['So the beacon is still bending the route and my drivers are still taking the scenic tour. Great.','Can you go back and make it stop? Please?']},
    abandoned:{subject:'Uh, the beacon?',body:['You turned around. The beacon did not. It is still messing with everything.','Whenever you are ready, dude.']}},
  kudo_factory_3:{from:KUDO,label:'ACCEPT OSD STRIKE ORDER',
    failed:{subject:'Factory moon — failed strike',body:['The moon is still there. So is the factory. That is a failed strike, and I do not accept failed strikes.','Another airframe is allocated. Go back in and finish it.']},
    abandoned:{subject:'Factory moon — you broke off',body:['You broke off. The factory did not stop building.','Hold your nerve this time. Finish it.']}},
  mara_signal_3:{from:MARA,label:'OPEN VOX CONTRACT',
    failed:{subject:'The corridor — one more window',body:['We lost the drone. The carrier is still in the corridor, still running slow.','We have one more window. Take it.']},
    abandoned:{subject:'The corridor — still open',body:['You broke off. The carrier did not change course. It still thinks nobody is watching.','Go back when you are ready.']}}
};

const cloneStory=value=>value==null?null:JSON.parse(JSON.stringify(value));
const stories={
  mara_signal_1:voxCourier,
  mara_signal_2:node42,
  kudo_defence_1:relay10,
  kudo_bunker_2:sourceTrace,
  corvella_manifest_1:corvellaManifest,
  cassian_favour_1:cassianFavour,
  helix_xeno_samples_1:helixFieldSamples,
  taco_beacon_false_lead_1:tacoBeaconFalseLead,
  helix_xeno_nest_2:helixNestStrike,
  quickbite_route_anomaly_2:quickbiteRouteAnomaly,
  mara_signal_3:maraCarrierIntercept,
  kudo_factory_3:kudoFactoryMoon
};

globalThis.AgentXStoryContent={
  stories,
  contract(id){return cloneStory(stories[id]?.campaign?.contract)},
  offerMail(id){return cloneStory(stories[id]?.campaign?.offerMail)},
  briefingMail(id){return cloneStory(stories[id]?.campaign?.briefingMail)},
  completionMail(id){return cloneStory(stories[id]?.campaign?.completionMail)},
  epilogueMail(id){return cloneStory(stories[id]?.campaign?.epilogueMail)},
  sectionContent(id){return cloneStory(stories[id])},
  retryMail(id,outcome='failed',n=1){
    const r=storyRetry[id];if(!r)return null;const t=r[outcome==='abandoned'?'abandoned':'failed'];
    return{id:`${id}_retry_${n}`,from:r.from,subject:t.subject,category:'story',priority:'normal',body:t.body.slice(),retryOf:id,
      action:{type:'story',contractId:id,label:r.label}}
  },
  devMailOptions(){return Object.values(stories).map(s=>cloneStory(s.campaign?.devMailOption)).filter(Boolean)}
};

// Compatibility aliases while the remaining mechanics are migrated to the registry.
globalThis.AgentXSourceTraceContent=sourceTrace;
globalThis.AgentXVoxCourierContent=voxCourier;
