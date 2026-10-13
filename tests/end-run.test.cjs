const {test}=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/game.cjs');

test('short run presents encouraging results with actual stats and replay/home actions',()=>{
 const nodes=new Map(),g=game(3,nodes);g.runDuration=19.8;g.drops=4;g.score=1234.7;g.distance=98.9;g.finish();
 assert.equal(g.state,'over');assert.equal(nodes.get('#run-results-title').textContent,'NICE TRY, WARRIOR!');
 assert.equal(nodes.get('#run-results-subtitle').textContent,'You collected 4 Polio Drops.');
 assert.equal(nodes.get('#result-drops').textContent,'4');assert.equal(nodes.get('#result-duration').textContent,'00:19');
 assert.equal(nodes.get('#result-score').textContent,'1,234');assert.equal(nodes.get('#result-distance').textContent,'98');
 assert.equal(nodes.get('#run-results-copy').textContent,'Every drop makes a difference. Keep running and see how far you can go!');
 nodes.get('#run-again').onclick();assert.equal(g.state,'running');assert.equal(g.runDuration,0);assert.equal(nodes.get('#run-results').hidden,true);
 nodes.get('#run-home').onclick();assert.equal(g.state,'start');assert.equal(nodes.get('#run-results').hidden,true);assert.equal(nodes.get('#overlay').classList.add instanceof Function,true);
});

test('120 seconds selects Polio Hero copy and new best badge; over state freezes gameplay',()=>{
 const nodes=new Map(),g=game(7,nodes);g.runDuration=120;g.drops=42;g.score=12850;g.distance=1420;g.newBest=true;g.state='running';g.finish();
 assert.equal(nodes.get('#run-results-title').textContent,'POLIO HERO!');assert.equal(nodes.get('#run-results-kicker').textContent,'GREAT RUN!');
 assert.match(nodes.get('#run-results-subtitle').textContent,/You collected 42 drops and kept going for 2:00/);
 assert.match(nodes.get('#run-results-copy').textContent,/Every drop counts/);assert.equal(nodes.get('#new-best-badge').hidden,false);
 const d=g.distance,s=g.score;g.frame(1000);assert.equal(g.distance,d);assert.equal(g.score,s);
});
