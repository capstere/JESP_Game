// Audited, self-contained baseline used as an optional tool by the agent.
// It is not model-generated code: independent tests must still validate delivery.
export function fpsStarter(){
const html = `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JESP FPS · prototyp</title><style>body{margin:0;background:#101523;color:#f5f5f5;font:16px system-ui;text-align:center}header{padding:10px}canvas{display:block;margin:0 auto;width:min(96vw,900px);height:auto;image-rendering:pixelated;border:2px solid #71819b}#score{font-weight:bold}p{margin:8px}</style></head>
<body><header><strong>JESP FPS</strong> · <span id="score">Poäng: 0</span><p>W/S = gå · A/D = rotera · Mellanslag = skjut · R = återställ</p></header>
<canvas id="gameCanvas" width="320" height="200" aria-label="FPS förstapersonsvy"></canvas>
<script src="logic.js"></script><script defer src="game.js"></script></body></html>`;
const logic=`// Portabel, DOM-fri spelmekanik. Inga paket eller externa anrop.
const MAP=[
'11111111',
'10000001',
'10000001',
'10000001',
'10001001',
'10000001',
'10000001',
'11111111'];
const START={x:2.5,y:2.5,angle:0,score:0,target:{x:4.5,y:2.5,active:true}};
const gameState={x:START.x,y:START.y,angle:START.angle,score:START.score,target:{...START.target}};
function normalizeAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function isWall(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return true;const ix=Math.floor(x),iy=Math.floor(y);return !MAP[iy]||MAP[iy][ix]!=='0';}
function resetGame(){gameState.x=START.x;gameState.y=START.y;gameState.angle=START.angle;gameState.score=0;gameState.target={...START.target};return gameState;}
function moveForward(amount=0.13){if(!Number.isFinite(amount))return false;const dx=Math.cos(gameState.angle)*amount,dy=Math.sin(gameState.angle)*amount;let moved=false;
const nx=gameState.x+dx,ny=gameState.y+dy;if(!isWall(nx,gameState.y)){gameState.x=nx;moved=true;}if(!isWall(gameState.x,ny)){gameState.y=ny;moved=true;}return moved;}
function moveBackward(amount=0.13){return moveForward(-amount);}
function rotateLeft(amount=0.12){gameState.angle=normalizeAngle(gameState.angle-amount);return gameState.angle;}
function rotateRight(amount=0.12){gameState.angle=normalizeAngle(gameState.angle+amount);return gameState.angle;}
function castRay(angle,maxDistance=9){const dx=Math.cos(angle),dy=Math.sin(angle);for(let d=0.02;d<=maxDistance;d+=0.035){if(isWall(gameState.x+d*dx,gameState.y+d*dy))return d;}return maxDistance;}
function targetVisible(){const t=gameState.target;if(!t.active)return false;const dx=t.x-gameState.x,dy=t.y-gameState.y,d=Math.hypot(dx,dy);if(d<0.1||d>6)return false;const delta=normalizeAngle(Math.atan2(dy,dx)-gameState.angle);return Math.abs(delta)<0.14&&castRay(Math.atan2(dy,dx))>d-0.06;}
function shoot(){if(!targetVisible())return false;gameState.target.active=false;gameState.score+=10;return true;}
Object.assign(globalThis,{gameState,isWall,resetGame,moveForward,moveBackward,rotateLeft,rotateRight,castRay,targetVisible,shoot});`;
const game=`// Browseradapter: input och canvas. DOM-fri logik finns i logic.js.
(()=>{'use strict';
const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d'),scoreElement=document.getElementById('score');
const active=new Set();
function keyOf(e){const code=typeof e.code==='string'&&/^Key[WASDR]$/.test(e.code)?e.code.slice(3).toLowerCase():'';return code||(e.key===' '?'space':String(e.key||'').toLowerCase());}
function action(key){if(key==='w')moveForward();else if(key==='s')moveBackward();else if(key==='a')rotateLeft();else if(key==='d')rotateRight();else if(key==='space')shoot();else if(key==='r')resetGame();}
window.addEventListener('keydown',e=>{const k=keyOf(e);if(['w','s','a','d','space','r'].includes(k)){e.preventDefault();if(!active.has(k)||k==='space')action(k);active.add(k);}});
window.addEventListener('keyup',e=>active.delete(keyOf(e)));
window.addEventListener('blur',()=>active.clear());
let previous=0;
function render(now){const elapsed=Math.min(0.06,Math.max(0,(now-previous)/1000));previous=now;
for(const k of active)if('wasd'.includes(k)&&k.length===1){if(k==='w')moveForward(elapsed*1.2);if(k==='s')moveBackward(elapsed*1.2);if(k==='a')rotateLeft(elapsed*1.1);if(k==='d')rotateRight(elapsed*1.1);}
const w=canvas.width,h=canvas.height;ctx.fillStyle='#344260';ctx.fillRect(0,0,w,h/2);ctx.fillStyle='#2c2d34';ctx.fillRect(0,h/2,w,h/2);
const fov=Math.PI/3;const depths=[];
for(let x=0;x<w;x+=2){const angle=gameState.angle+(x/w-0.5)*fov,dist=castRay(angle),corrected=Math.max(0.1,dist*Math.cos(angle-gameState.angle));depths[x/2]=dist;
const wallHeight=Math.min(h*2,h/corrected*0.95),sh=Math.max(12,Math.floor(180/(1+corrected*0.42)));
ctx.fillStyle='rgb('+sh+','+Math.min(220,sh+10)+','+Math.min(240,sh+25)+')';ctx.fillRect(x,(h-wallHeight)/2,2,wallHeight);}
const t=gameState.target;
if(t.active){const dx=t.x-gameState.x,dy=t.y-gameState.y,dist=Math.hypot(dx,dy),relative=normalizeAngle(Math.atan2(dy,dx)-gameState.angle);
if(dist>0.12&&Math.abs(relative)<fov/2&&castRay(Math.atan2(dy,dx))>dist-0.06){const centerX=w/2+(relative/(fov/2))*(w/2),radius=Math.max(4,15/dist);
ctx.fillStyle='#ffb928';ctx.fillRect(centerX-radius,(h/2)-radius*1.4,radius*2,radius*2.8);
ctx.fillStyle='#d42534';ctx.fillRect(centerX-radius*0.55,h/2-radius*0.7,radius*1.1,radius*1.4);}}
ctx.strokeStyle='white';ctx.beginPath();ctx.moveTo(w/2-5,h/2);ctx.lineTo(w/2+5,h/2);ctx.moveTo(w/2,h/2-5);ctx.lineTo(w/2,h/2+5);ctx.stroke();
scoreElement.textContent='Poäng: '+gameState.score;
requestAnimationFrame(render);}
requestAnimationFrame(render);
})();`;
return Object.freeze({'index.html':html,'logic.js':logic,'game.js':game});
}