// Gold Robbers raid plan (GFF 1.3+): difficulty ramps with raid number (every 15 levels).
// Raid 1 = L15, raid 18 = L270, raid 28 = L420. Shared by the mini-game and tools/robbersim.js.
// Wave count: 3 at raid 1, +1 wave every 3rd raid, cap 10.
(function(root){
'use strict';
function raidNum(lv){const n=Math.round((+lv||15)/15);return Math.max(1,n|0)}
function waveCount(r){r=Math.max(1,+r||1);return Math.min(10,3+Math.floor((r-1)/3))}
function levelOf(r){return Math.max(1,r)*15}
// Ease 0..1, reaching 1 at raid 22 (L330) and holding (ceiling).
function ease(r){const t=Math.max(0,Math.min(1,(r-1)/21));return t*(2-t)}
function speedMul(r){return +(1+0.28*ease(r)).toFixed(3)}          // 1.00 → 1.28
function gapMul(r){return +(1-0.28*ease(r)).toFixed(3)}            // 1.00 → 0.72
function wobbleMul(r){return +(1+0.55*ease(r)).toFixed(3)}         // 1.00 → 1.55
function defendMax(r){const W=waveCount(r);return Math.max(95,40+W*20+(W-1)*3)}
const TAKE={norm:15,fast:15,sneak:15,tough:20,brute:25,boss:30};
const TYPE_HP={norm:1,fast:1,sneak:1,tough:2,brute:3,boss:4};
const TYPE_SPD={norm:1,fast:1.75,sneak:1.25,tough:.8,brute:.7,boss:.6};
const BREAK_S=3;
function clampTypes(tot,c){
  const order=['brute','sneak','tough','fast'];
  let s=order.reduce((a,k)=>a+(c[k]||0),0);
  if(s<=tot)return c;
  for(const k of order){
    if(s<=tot)break;
    const cut=Math.min(c[k]||0,s-tot);c[k]-=cut;s-=cut;
  }
  return c;
}
// Body robbers (not bosses): 42 at raid 1, about +7 for each added wave, plus a gentle raid-speed ramp, ceiling ~112.
function targetBody(r){return Math.round(42+(waveCount(r)-3)*7+20*ease(r))}
function groupsFor(tot,prefer4){
  const n=prefer4&&tot>=14?4:3;
  const g=Array(n).fill(Math.floor(tot/n));
  let left=tot-g.reduce((a,b)=>a+b,0);
  for(let i=n-1;i>=0&&left>0;i--,left--)g[i]++;
  return g.map(x=>Math.max(2,Math.min(6,x)));
}
function waveDef(r,wi,W){
  // Raid 1 stays the original v7 3-wave fight.
  if(r===1){
    const v7=[{g:[3,3,4],gap:3.0,fast:1,tough:0,sneak:0,brute:0,boss:0,sub:'Here they come!'},
              {g:[4,5,5],gap:2.7,fast:4,tough:3,sneak:0,brute:0,boss:0,sub:'Fast ones and tough guys!'},
              {g:[4,4,5,5],gap:2.4,fast:5,tough:5,sneak:0,brute:0,boss:1,sub:'Big gang + the boss!'}];
    return v7[wi];
  }
  const intra=wi/Math.max(1,W-1);
  const t=ease(r);
  // Split the raid's body across waves, later waves a bit heavier. Last wave may use 4 groups.
  const body=targetBody(r);
  const weights=[];
  for(let i=0;i<W;i++)weights.push(1-0.18+0.36*(i/Math.max(1,W-1)));
  const wsum=weights.reduce((a,b)=>a+b,0);
  const sizes=weights.map(w=>Math.max(8,Math.round(body*w/wsum)));
  let drift=sizes.reduce((a,b)=>a+b,0)-body;
  while(drift>0){for(let i=0;i<W&&drift>0;i++){if(sizes[i]>8){sizes[i]--;drift--}}}
  while(drift<0){sizes[W-1]++;drift++}
  const tot=sizes[wi];
  const g=groupsFor(tot,wi===W-1&&r>=7);
  // If clamp changed the sum, keep the planned tot by adjusting the last group (still 2-6).
  let gs=g.reduce((a,b)=>a+b,0);
  if(gs!==tot){g[g.length-1]=Math.max(2,Math.min(6,g[g.length-1]+(tot-gs)));}
  let gap=(3.05-0.75*intra)*gapMul(r);
  gap=Math.max(1.65,Math.round(gap*20)/20);
  let fast=Math.round(tot*(0.12+0.14*t+0.12*intra));
  let tough=Math.round(tot*(0.12+0.10*t+0.14*intra));
  let sneak=r>=4?Math.round(tot*(0.10+0.08*t+0.08*intra)):0;
  let brute=r>=7?Math.round(tot*(0.06+0.07*t+0.08*intra)):0;
  if(r===4&&wi===0)sneak=Math.max(2,sneak);
  if(r===7&&wi>=1)brute=Math.max(1,brute);
  if(wi===0){fast=Math.max(1,fast);if(r<3)tough=Math.min(tough,2)}
  const c=clampTypes(g.reduce((a,b)=>a+b,0),{fast,tough,sneak,brute});
  const boss=wi===W-1?(r>=16?2:1):0;
  const sub=wi===0?(r>=4&&r<7?'Sneaky ones in the mix!':r>=7?'A bigger, bolder gang!':'Here they come!')
    :wi===W-1?(boss>1?'Two bosses leading the gang!':'Big gang + the boss!'):
    (c.brute?'Brutes in the pack!':c.sneak?'They are weaving in!':'Fast ones and tough guys!');
  return {g,gap,fast:c.fast,tough:c.tough,sneak:c.sneak,brute:c.brute,boss,sub};
}
function blurb(r){
  if(r<=1)return 'The first gang is riding in!';
  if(r<4)return 'They are coming in faster now!';
  if(r<7)return 'Watch for sneaky ones weaving in from the sides!';
  if(r<10)return 'Big brutes are with them — they take 3 hits!';
  if(r<16)return 'A bigger, bolder gang. Stay sharp and reload in the breaks!';
  return 'The whole outlaw crew is here — more than one boss on the last wave!';
}
function introLine(r){return 'Raid #'+r+': robbers are getting bolder!'}
function buildWaves(r){
  r=Math.max(1,+r||1);
  const W=waveCount(r);
  const waves=[];
  for(let i=0;i<W;i++)waves.push(waveDef(r,i,W));
  return waves;
}
function counts(waves){
  const t={norm:0,fast:0,tough:0,sneak:0,brute:0,boss:0,total:0};
  for(const w of waves){
    const g=w.g.reduce((a,b)=>a+b,0);
    t.fast+=w.fast||0;t.tough+=w.tough||0;t.sneak+=w.sneak||0;t.brute+=w.brute||0;t.boss+=w.boss||0;
    t.total+=g+(w.boss||0);
  }
  t.norm=t.total-t.fast-t.tough-t.sneak-t.brute-t.boss;
  return t;
}
function plan(r){
  r=Math.max(1,+r||1);
  const waves=buildWaves(r),c=counts(waves);
  return {raid:r,lv:levelOf(r),waves:waves.length,spd:speedMul(r),gap:gapMul(r),wob:wobbleMul(r),
    defendMax:defendMax(r),blurb:blurb(r),intro:introLine(r),counts:c,waveDefs:waves};
}
function table(maxR){
  maxR=maxR||28;
  const rows=[];
  for(let r=1;r<=maxR;r++){
    const p=plan(r),c=p.counts;
    rows.push({raid:r,lv:p.lv,waves:p.waves,robbers:c.total,norm:c.norm,fast:c.fast,tough:c.tough,sneak:c.sneak,brute:c.brute,boss:c.boss,speed:p.spd,gaps:p.gap,wobble:p.wob,defendMax:p.defendMax,intro:p.intro});
  }
  return rows;
}
// Dynamite: free in-raid drops (never sold, no random paid items). Shared by the mini-game and the sim.
// The wave/speed/density ramp above is unchanged; dynamite is the late-raid helper.
const DYN={cap:5,radius:110,dmg:4,cool:.55,fly:.4};
function dynChance(r,type){
  r=Math.max(1,+r||1);
  // 0 through raid 6 (L90), about 0.35 at raid 12 (L180), 1 at raid 18+ (L270).
  // Late raids drop about half as much dynamite; early raids stay the same.
  const late=r<=6?0:r<=12?(r-6)/6*0.35:Math.min(1,0.35+(r-12)/6*0.65);
  if(type==='brute')return +(1-0.6*late).toFixed(3);
  if(type==='boss')return r<7?0.25:r<10?0.6:+(1-0.5*late).toFixed(3);
  return +(0.03+0.03*late).toFixed(3);
}
const api={raidNum,waveCount,levelOf,ease,speedMul,gapMul,wobbleMul,defendMax,TAKE,TYPE_HP,TYPE_SPD,BREAK_S,waveDef,blurb,introLine,buildWaves,counts,plan,table,DYN,dynChance};
if(typeof module==='object'&&module.exports)module.exports=api;
root.GFFRaid=api;
})(typeof globalThis!=='undefined'?globalThis:this);
