/* -------------------------------------------------------
   POLIO WARRIOR
   Code-built articulated hero for Drop Dash.

   Uses the existing PlayerRig.pose(g) animation system,
   but renders the character with RailwayScene primitives.
-------------------------------------------------------- */

class PolioWarrior {
  constructor(scene) {
    this.s = scene;
    this.bodyView = mat4.create();
  }

  // All authored geometry faces local +Z. Only the root maps it to track -Z.
  pose(g) {
    const q = PlayerRig.pose(g), M = PlayerRig.mix, S = PlayerRig.smooth;
    const phase = g.runPhase || 0, time = g.time || 0;
    const idle = q.state === "IDLE", dead = q.state === "HIT" || q.state === "DEATH";
    // Presentation only: ease in over .45s and settle during the final .55s.
    // The gameplay timer, altitude and collision body remain untouched.
    const remaining=g.powers?.flight;
    const flight=q.flying?(remaining===undefined?1:S((7-remaining)/.45)*S(remaining/.55)):0;
    const flightPitch=flight*75*Math.PI/180;
    const gait=q.flying?PlayerRig.pose({...g,animationState:'RUN'}):q;
    const activity = idle || dead ? 0 : 1;
    const tuck = q.tuck, land = g.landingImpact || 0;
    const air = q.state === "JUMP" || q.state === "FALL";
    const takeoff = q.state === "JUMP" ? 1 - S((g.jumpTime || 0) / .14) : 0;
    const death = dead ? S((g.deathTime || 0) / .85) : 0;
    const recoil = dead ? Math.sin(Math.min(1, (g.deathTime || 0) / .32) * Math.PI) : 0;
    const lean = q.lean;
    const pelvis = 1.02 + (idle ? Math.sin(time * 2) * .008 : Math.cos(phase * 2) * .025 * activity)
      - land * .12 - takeoff * .08;
    const legs = [0, 1].map(i => {
      const side = i ? 1 : -1;
      const source = gait.legs[i];
      const hip = [side * .18, pelvis, 0];
      let foot = [side * .18, source.foot[1], -source.foot[2]];
      if (air) foot = [side * .18, q.state === "FALL" ? .22 + i * .06 : .40 + i * .13,
        q.state === "FALL" ? (i ? -.12 : .18) : (i ? -.30 : .26)];
      if (q.flying) foot = foot.map((v,k)=>M(v,[side*.18,pelvis-1.055+i*.10,-.08-i*.10][k],flight));
      if (dead) foot = [side * (.18 + death * .08), .14 + i * recoil * .15, (i ? -.22 : .22) * death];
      // Two-bone IK keeps thigh and shin lengths fixed; knees bend forward.
      const dy = foot[1] - hip[1], dz = foot[2] - hip[2];
      const distance = Math.max(.01, Math.min(1.075, Math.hypot(dy, dz)));
      const ny = dy / Math.hypot(dy, dz), nz = dz / Math.hypot(dy, dz);
      foot = [hip[0], hip[1] + ny * distance, hip[2] + nz * distance];
      const along = (.55 * .55 - .53 * .53 + distance * distance) / (2 * distance);
      const bend = Math.sqrt(Math.max(0, .55 * .55 - along * along));
      let knee = [hip[0], hip[1] + ny * along + nz * bend, hip[2] + nz * along - ny * bend];
      knee = knee.map((v,k) => M(v, [side * .20, 1.28, .43][k], tuck));
      foot = foot.map((v,k) => M(v, [side * .20, .92, .50][k], tuck));
      return {hip,knee,foot};
    });
    const arms = [0,1].map(i => {
      const side = i ? 1 : -1;
      const shoulder = [side * .38, 1.72, 0];
      const swing = -Math.cos(phase + i * Math.PI) * .85 * activity * (1 - tuck);
      let angle = swing - takeoff * .35 + land * .20;
      if (air) angle = i ? -.45 : .35;
      let elbow = [side * .46, 1.72 - Math.cos(angle) * .35, Math.sin(angle) * .35];
      let hand = [side * .44, elbow[1] - Math.cos(angle + 1.05) * .32,
        elbow[2] + Math.sin(angle + 1.05) * .32];
      if (q.flying) {
        elbow=elbow.map((v,k)=>M(v,[side*.44,2.055,.07][k],flight));
        hand=hand.map((v,k)=>M(v,[side*.45,2.365-i*.035,.12+i*.04][k],flight));
      }
      if (dead) { elbow = [side * (.48 + death * .12), 1.40 + recoil * .15, -.22 * recoil];
        hand = [side * (.52 + death * .22), 1.15, .25 * death - .35 * recoil]; }
      elbow = elbow.map((v,k) => M(v, [side * .39, 1.40, .25][k], tuck));
      hand = hand.map((v,k) => M(v, [side * .25, 1.25, .43][k], tuck));
      return {shoulder,elbow,hand};
    });
    return {...q, legs, arms, pelvis, lean, death, recoil, phase, time, land, takeoff, flight, flightPitch,
      pitch: M(M(idle ? 0 : .12 + takeoff * .08 + land * .12,0,flight), .85, tuck),
      twist: Math.sin(phase) * .075 * activity * (1 - tuck) * (1-flight),
      hipShift: lean * .18, roll: -q.turn, activity};
  }

  // Orient a vertical box along any 3D segment, including spread flight arms.
  limb(a, b, width, depth, color) {
    const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2];
    const length=Math.hypot(dx,dy,dz);
    if(length<.001)return;
    this.drawer.box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,
      width,length/2,depth,color,[Math.atan2(dz,dy),0,-Math.atan2(dx,Math.hypot(dy,dz))]);
  }

  render(g) {
    const s=this.s, q=this.pose(g), root=mat4.create();
    mat4.rotateY(root,root,Math.PI); // Preserve the corrected forward direction.
    // A small visual increase; tuck compression keeps the roll compact.
    const scale = 1.06 * (1 - q.tuck * .16);
    mat4.scale(root,root,[scale,scale,scale]);
    mat4.translate(root,root,[q.hipShift,1.12,0]);
    mat4.rotateZ(root,root,-q.lean + q.death * 1.25);
    mat4.rotateX(root,root,q.roll + q.flightPitch - q.death * 1.05 - q.recoil * .20);
    mat4.translate(root,root,[0,-1.12,0]);
    this.root=root;
    this.upper=mat4.clone(root);
    mat4.translate(this.upper,this.upper,[0,q.pelvis-1.02,0]);
    mat4.translate(this.upper,this.upper,[0,1.03,0]);
    mat4.rotateX(this.upper,this.upper,q.pitch);
    mat4.rotateY(this.upper,this.upper,q.twist);
    mat4.rotateZ(this.upper,this.upper,-q.lean*.20);
    mat4.scale(this.upper,this.upper,[1,1-q.land*.035,1]);
    mat4.translate(this.upper,this.upper,[0,-1.03,0]);
    this.headView=mat4.clone(this.upper);
    mat4.translate(this.headView,this.headView,[0,1.78,0]);
    mat4.rotateY(this.headView,this.headView,-q.twist*.8);
    mat4.rotateX(this.headView,this.headView,-q.pitch*.75*(1-q.tuck)-q.flightPitch*.85);
    mat4.translate(this.headView,this.headView,[0,-1.78,0]);
    this.part=this.upper;
    const commands=[];
    this.drawer={};
    for(const kind of ['box','orb','capCrown','capVisor'])this.drawer[kind]=(...args)=>commands.push({kind,args,part:this.part});
    const [l,r]=q.legs,[la,ra]=q.arms;
    this.drawBody(g,q,q.state,q.phase,q.flying,l.hip,r.hip,l.knee,r.knee,l.foot,r.foot,
      la.shoulder,ra.shoulder,la.elbow,ra.elbow,la.hand,ra.hand);

    // Exact primitive support keeps the tumble/fall above the railway surface.
    let bottom=Infinity,top=-Infinity;
    for(const c of commands){
      const m=mat4.clone(c.part),a=c.args,rotation=a[7]||[0,0,0];
      mat4.translate(m,m,a.slice(0,3));
      mat4.rotateX(m,m,rotation[0]);mat4.rotateY(m,m,rotation[1]);mat4.rotateZ(m,m,rotation[2]);
      const ext=[m[1]*a[3],m[5]*a[4],m[9]*a[5]];
      const radius=['orb','capCrown','capVisor'].includes(c.kind)?Math.hypot(...ext):ext.reduce((sum,v)=>sum+Math.abs(v),0);
      bottom=Math.min(bottom,m[13]-radius);top=Math.max(top,m[13]+radius);
    }
    const support=.025-bottom;
    // Omit the always-on oval ground shadow during normal running; the
    // state-timed water ripples provide the only running foot feedback.
    if(g.animationState!=='RUN'||g.flightMode)s.orb(g.x,.025,4,q.tuck?.60:.48,.022,.32,'#575d58');
    const previous=s.actorView;
    try {
      for(const c of commands){
        mat4.copy(this.bodyView,previous||s.view);
        mat4.translate(this.bodyView,this.bodyView,[g.x,g.jumpY+support,4]);
        mat4.multiply(this.bodyView,this.bodyView,c.part);
        s.actorView=this.bodyView;
        s[c.kind](...c.args);
      }
    } finally {s.actorView=previous;}
    s.playerPose={...q,warrior:true,visualHeight:top-bottom,ground:.025,support};
  }

  drawBody(g, q, state, phase, flying, LH, RH, LK, RK, LF, RF,
    LS, RS, LE, RE, LHand, RHand) {
    const s = this.drawer;

    // Overlapping cloth sections form a continuous shoulder-wide cape,
    // flaring toward the hem. The anchored top stays fixed as the hem waves.
    const airborne = state === "JUMP" ? .22 : state === "FALL" ? .10 : 0;
    const windPhase=PlayerRig.mix(phase*2,q.time*7,q.flight);
    const capeWave = Math.sin(windPhase - .5) * PlayerRig.mix(.055,.14,q.flight) * q.activity;
    const sections = 20;
    for (let i = 0; i < sections; i++) {
      const t = (i + .5) / sections;
      const drop = PlayerRig.mix(1.02,1.85,q.flight) - airborne + q.land * .10;
      const trail = PlayerRig.mix(.34+airborne,.48,q.flight);
      const fold = 1 - q.tuck * .70;
      s.box(
        (capeWave - q.lean * .8) * t * t,
        1.70 - drop * t * fold,
        -.25 - trail * t * fold + Math.sin(t * 5 - windPhase) * .035 * t * q.activity,
        .38 + (.28 + q.flight*.22 - q.tuck * .20) * t,
        drop * fold / sections * .65,
        .045 + trail * fold / sections * .5,
        i % 5 === 0 ? "#d7192d" : "#e21f32",
        [0,0,0], i // Rear-face UV strip follows this exact animated cape box.
      );
    }

    /* Gold cape clasps */
    const leftClasp = [-0.29, 1.70, 0.13];
    const rightClasp = [0.29, 1.70, 0.13];

    s.orb(
      leftClasp[0],
      leftClasp[1],
      leftClasp[2],
      0.075,
      0.075,
      0.035,
      "#f2bd3d"
    );

    s.orb(
      rightClasp[0],
      rightClasp[1],
      rightClasp[2],
      0.075,
      0.075,
      0.035,
      "#f2bd3d"
    );
    /* ------------------------------
       LEGS
    ------------------------------ */

    this.part = this.root;

    // White upper legs
    this.limb(LH, LK, 0.135, 0.135, "#f6f6f2");
    this.limb(RH, RK, 0.135, 0.135, "#f6f6f2");

    // Red lower-leg / boots
    this.limb(LK, LF, 0.145, 0.15, "#d92338");
    this.limb(RK, RF, 0.145, 0.15, "#d92338");

    // Gold boot trim
    s.orb(LK[0], LK[1], LK[2], 0.155, 0.055, 0.155, "#e9b83f");
    s.orb(RK[0], RK[1], RK[2], 0.155, 0.055, 0.155, "#e9b83f");

    // Feet
    s.orb(LF[0], LF[1], LF[2] + 0.08*(1-q.flight), 0.16, 0.11+q.flight*.14, 0.25-q.flight*.12, "#c91f32");
    s.orb(RF[0], RF[1], RF[2] + 0.08*(1-q.flight), 0.16, 0.11+q.flight*.14, 0.25-q.flight*.12, "#c91f32");

    /* ------------------------------
       TORSO
    ------------------------------ */

    this.part = this.upper;

    const body = [0, 1.40, 0];

    // White superhero body
    s.box(
      body[0],
      body[1],
      body[2],
      0.34,
      0.40,
      0.20,
      "#faf9f3",
      [0, 0, 0]
    );

    // Red shoulder collar
    const collar = [0, 1.72, 0.01];

    s.box(
      collar[0],
      collar[1],
      collar[2],
      0.38,
      0.065,
      0.22,
      "#d92338",
      [0, 0, 0]
    );

    // Gold belt
    const belt = [0, 1.03, 0.01];

    s.box(
      belt[0],
      belt[1],
      belt[2],
      0.35,
      0.055,
      0.215,
      "#e5b63e",
      [0, 0, 0]
    );

    // Belt buckle
    const buckle = [0, 1.04, 0.23];

    s.orb(
      buckle[0],
      buckle[1],
      buckle[2],
      0.105,
      0.105,
      0.035,
      "#ffd766"
    );

    /* ------------------------------
       CHEST EMBLEM
    ------------------------------ */

    const emblem = [0, 1.48, 0.225];

    s.orb(
      emblem[0],
      emblem[1],
      emblem[2],
      0.14,
      0.14,
      0.035,
      "#e4b33d"
    );

    s.orb(
      emblem[0],
      emblem[1],
      emblem[2] + 0.025,
      0.075,
      0.075,
      0.025,
      "#ffffff"
    );

    /* ------------------------------
       ARMS
    ------------------------------ */

    // White upper arms
    this.limb(LS, LE, 0.115, 0.115, "#faf9f3");
    this.limb(RS, RE, 0.115, 0.115, "#faf9f3");

    // Red forearm guards
    this.limb(LE, LHand, 0.125, 0.125, "#d92338");
    this.limb(RE, RHand, 0.125, 0.125, "#d92338");

    // Gold wrist bands
    s.orb(
      LHand[0],
      LHand[1] + 0.08,
      LHand[2],
      0.13,
      0.055,
      0.13,
      "#e6b63d"
    );

    s.orb(
      RHand[0],
      RHand[1] + 0.08,
      RHand[2],
      0.13,
      0.055,
      0.13,
      "#e6b63d"
    );

    // Hands
    s.orb(
      LHand[0],
      LHand[1],
      LHand[2],
      0.12,
      0.14,
      0.12,
      "#d99872"
    );

    s.orb(
      RHand[0],
      RHand[1],
      RHand[2],
      0.12,
      0.14,
      0.12,
      "#d99872"
    );

    /* ------------------------------
       HEAD
    ------------------------------ */

    this.part = this.headView;

    const head = [0, 2.08, 0];

    // Large premium cartoon-style head
    s.orb(
      head[0],
      head[1],
      head[2],
      0.39,
      0.43,
      0.34,
      "#d99a74"
    );

    // Ears
    s.orb(
      head[0] - 0.38,
      head[1],
      head[2],
      0.09,
      0.13,
      0.08,
      "#cf8e6b"
    );

    s.orb(
      head[0] + 0.38,
      head[1],
      head[2],
      0.09,
      0.13,
      0.08,
      "#cf8e6b"
    );

    /* ------------------------------
       EYES
       Front details stay on local +Z, facing away from the camera.
    ------------------------------ */

    for (const side of [-1, 1]) {
      s.orb(
        head[0] + side * 0.145,
        head[1] + 0.055,
        head[2] + 0.305,
        0.105,
        0.12,
        0.035,
        "#fffaf4"
      );

      s.orb(
        head[0] + side * 0.145,
        head[1] + 0.045,
        head[2] + 0.34,
        0.055,
        0.07,
        0.025,
        "#4a291d"
      );

      s.orb(
        head[0] + side * 0.13,
        head[1] + 0.075,
        head[2] + 0.36,
        0.017,
        0.022,
        0.012,
        "#ffffff"
      );
    }

    /* Nose */
    s.orb(
      head[0],
      head[1] - 0.035,
      head[2] + 0.35,
      0.045,
      0.055,
      0.035,
      "#c98263"
    );

    /* Smile */
    s.box(
      head[0],
      head[1] - 0.17,
      head[2] + 0.337,
      0.095,
      0.018,
      0.015,
      "#7c332f"
    );

    /* ------------------------------
       SHORT HAIR UNDER RED BASEBALL CAP
    ------------------------------ */

    // A single low-poly oval follows the skull. The cap covers its upper
    // portion, leaving the short back and sides visible underneath.
    s.orb(head[0], head[1] + 0.035, head[2] - 0.025,
      0.375, 0.325, 0.34, "#241b20");

    /* ------------------------------
       RED BASEBALL CAP
    ------------------------------ */

    // A shaped open-bottom shell has a raised curved rear cutout, so the
    // underlying hair remains visible instead of being hidden by a back patch.
    s.capCrown(head[0], head[1] + 0.12, head[2] - 0.005,
      0.43, 0.37, 0.37, "#d92338");
    // Character faces local +Z: this low-profile curved brim projects forward.
    s.capVisor(head[0], head[1] + 0.015, head[2] + 0.265,
      0.34, 0.32, 0.37, "#b7192c");
    // Thin red adjustable strap follows the rear opening without filling it.
    s.box(head[0], head[1] + 0.055, head[2] - 0.372,
      0.20, 0.024, 0.012, "#a51b2b");

  }
}
