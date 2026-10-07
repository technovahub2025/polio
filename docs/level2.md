# Level 2 gameplay upgrade

This extends the existing endless run; it does not introduce a separate level selector or reset progress. Virus difficulty follows the existing score-based progression. Player assets, scene geometry, scoring, and input bindings are unchanged.

Virus variants share the original mesh: normal purple, 1.75x red-purple elite, fast blue-purple, small pink-purple, green-purple special, delayed chaser, and low/medium/high flyers. Each spawn keeps its palette. Five weighted wave templates include scatter, slalom, staggered 2/3/2 pulses, elite groups, and mixed ground/air groups. The three-member pulse is staggered rather than an unavoidable three-lane wall.

The scheduler starts from the player's actual lane and reserves a 0.4-second lane-change interval. It conservatively reserves hazards across all heights, so its escape route remains usable during jumping or flight expiration. Chasers observe for 0.5 seconds, move one lane over 0.65 seconds, and cannot initiate a turn within 2.25 seconds of contact. Each proposed chase rechecks the route while reserving both lanes. Relative swept collision checks account for enemy and player lateral movement; flying-virus collisions also use height at contact.

The winged blue FLY pickup joins the existing power-up rotation. Flight lasts seven seconds, with smooth ascent, airborne lane controls, elevated drop paths, high-virus hazards, the existing HUD countdown, and a smooth descent. Up/Down do not interrupt powered flight; normal jump/roll control returns on landing. Ground hazards are cleared by altitude, not by disabling collisions. Shields and boosts keep their existing behavior.

Validation: `npm test`, `npm run build`, and (with `npm run dev` running) `npm run test:level2:browser`. The original player browser regression is `npm run test:browser`. Browser screenshots are saved under `artifacts/level2/`. Chrome uses software WebGL in this harness, so those checks do not establish a hardware-GPU FPS guarantee.
