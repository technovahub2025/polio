const fs=require('node:fs');const cp=require('node:child_process');
const files=['globals.js','objects.js','initBuffers.js','draw.js','shaders.js','player-asset.js','player-rig.js','runner-scene.js','inputHandler.js','main.js'];
for(const file of files)cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^\"]+)"/g)){if(!fs.existsSync(match[1]))throw new Error('Missing asset: '+match[1]);}
if(!fs.existsSync('assets/doctor-boy.glb'))throw new Error('Missing skinned player asset; run npm run build:player');
console.log('Validated all application scripts and local entry-point assets. Static site requires no bundling.');
