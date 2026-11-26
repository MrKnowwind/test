// Design-only plan validation and reproducible vector drawing. No runtime imports or changes.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const plan=JSON.parse(readFileSync(new URL('./blueprint.json',import.meta.url),'utf8'));
const {bounds,water,districts,lots,roads,openSpaces,spawns,exits,lab,routeRule}=plan;
const [xmin,zmin,xmax,zmax]=bounds;
const inside=([x,z],[a,b,c,d])=>x>=a&&x<=c&&z>=b&&z<=d;
const encloses=(outer,[a,b,c,d])=>inside([a,b],outer)&&inside([c,d],outer)&&c>a&&d>b;
const overlap=([a,b,c,d],[e,f,g,h])=>a<g&&c>e&&b<h&&d>f;
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const key=p=>p.join(',');
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const on=(p,r)=>inside(p,[Math.min(r.from[0],r.to[0]),Math.min(r.from[1],r.to[1]),Math.max(r.from[0],r.to[0]),Math.max(r.from[1],r.to[1])]);

assert.equal(xmax-xmin,400);assert.equal(zmax-zmin,400);
assert.equal(new Set([...lots,...roads,...districts,...spawns,...exits].map(e=>e.id)).size,lots.length+roads.length+districts.length+spawns.length+exits.length);
assert.equal(lots.filter(l=>l.name==='极光药局').length,1);
for(const d of districts)assert.ok(encloses(bounds,d.area),d.id);
for(const l of lots){
  assert.ok(encloses(districts.find(d=>d.id===l.district).area,l.rect),`${l.id} outside district`);
  assert.equal(l.id==='W1',overlap(l.rect,water),`${l.id}: water footprint`);
  for(const other of lots)if(other!==l)assert.ok(!overlap(l.rect,other.rect),`${l.id} overlaps ${other.id}`);
}
assert.ok(encloses(water,lots.find(l=>l.id==='W1').rect));
assert.ok(encloses(lots.find(l=>l.id===lab.host).rect,lab.rect));
assert.ok(inside(exits.find(e=>e.id==='lab-lift').at,lab.rect));
for(const space of openSpaces){assert.ok(space.outline.every(p=>inside(p,districts.find(d=>d.id===space.district).area)),space.id);}

for(const r of roads){
  assert.ok((r.from[0]===r.to[0])!==(r.from[1]===r.to[1]),`${r.id} must be a nonempty axis-aligned segment`);
  assert.ok(inside(r.from,bounds)&&inside(r.to,bounds),r.id);
  const [a,b,c,d]=[Math.min(r.from[0],r.to[0]),Math.min(r.from[1],r.to[1]),Math.max(r.from[0],r.to[0]),Math.max(r.from[1],r.to[1])];
  const half=r.width/2;
  const band=a===c?[a-half,b,c+half,d]:[a,b-half,c,d+half];
  for(const l of lots)assert.ok(!overlap(band,l.rect),`${r.id} crosses reserved lot ${l.id}`);
  if(r.type!=='gangway')assert.ok(!overlap(band,water),`${r.id} crosses water without gangway`);
}
for(const r of roads.filter(r=>r.type==='gangway')){
  const ship=lots.find(l=>l.id==='W1');
  assert.equal(r.from[0],ship.rect[2]);assert.ok(inside(r.from,ship.rect));assert.ok(roads.some(s=>s.id==='quay-walk'&&on(r.to,s)));
}

// Split the abstract road network at intersections and markers. This validates
// connectivity/reservations only, not the actual walking controller or future collision mesh.
const points=[...roads.flatMap(r=>[r.from,r.to]),...spawns.map(s=>s.at),...exits.filter(e=>e.floor==='1F').map(e=>e.at),lab.rampEntry];
for(const a of roads)for(const b of roads){
  if(a.from[0]===a.to[0]&&b.from[1]===b.to[1]){const p=[a.from[0],b.from[1]];if(on(p,a)&&on(p,b))points.push(p);}
}
const unique=[...new Map(points.map(p=>[key(p),p])).values()];
const graph=new Map();
function link(a,b){if(!graph.has(key(a)))graph.set(key(a),[]);graph.get(key(a)).push([key(b),distance(a,b)]);}
for(const r of roads){const nodes=unique.filter(p=>on(p,r)).sort((a,b)=>distance(a,r.from)-distance(b,r.from));for(let i=1;i<nodes.length;i++){link(nodes[i-1],nodes[i]);link(nodes[i],nodes[i-1]);}}
function shortest(start,end){const frontier=new Map([[key(start),0]]),done=new Set();while(frontier.size){const [id,dist]=[...frontier].sort((a,b)=>a[1]-b[1])[0];frontier.delete(id);if(id===key(end))return dist;if(done.has(id))continue;done.add(id);for(const [other,len] of graph.get(id)??[])if(!done.has(other)&&dist+len<(frontier.get(other)??Infinity))frontier.set(other,dist+len);}return Infinity;}

assert.equal(exits.filter(e=>e.kind==='regular').length,2);
assert.equal(spawns.filter(s=>s.group==='north').length,4);assert.equal(spawns.filter(s=>s.group==='south').length,4);
const distances=spawns.map(s=>{
  assert.ok(inside(s.at,bounds)&&!lots.some(l=>inside(s.at,l.rect))&&roads.some(r=>on(s.at,r)),s.id);
  const allowed=exits.filter(e=>e.kind==='regular'&&e.openFor===s.group);
  assert.equal(allowed.length,1,s.id);assert.equal(allowed[0].id,routeRule[s.group]);
  assert.ok(s.group==='north'?allowed[0].at[1]>100:allowed[0].at[1]<-180);
  const estimate=shortest(s.at,allowed[0].at);assert.ok(Number.isFinite(estimate)&&estimate>=350&&estimate<=550,`${s.id}: ${estimate}`);
  assert.ok(Number.isFinite(shortest(s.at,lab.rampEntry)),`${s.id}: B1 surface entry disconnected`);
  assert.ok(Number.isFinite(shortest(s.at,exits.find(e=>e.id==='service-passage').at)),`${s.id}: conditional exit disconnected`);
  return {spawn:s.id,exit:allowed[0].name,straight:Math.round(distance(s.at,allowed[0].at)),roadEstimate:Math.round(estimate)};
});
for(const l of lots.filter(l=>l.id!=='W1')){
  // Lots have a short frontage connection allowance. Doors within lots are B/C work.
  const [a,b,c,d]=l.rect;
  const gap=(p,q)=>Math.max(0,a-Math.max(p[0],q[0]),Math.min(p[0],q[0])-c)+Math.max(0,b-Math.max(p[1],q[1]),Math.min(p[1],q[1])-d);
  const closest=Math.min(...roads.filter(r=>r.type!=='gangway').map(r=>gap(r.from,r.to)-r.width/2));
  assert.ok(closest<=30,`${l.id} isolated frontage (${closest}m)`);
}
console.log(`${lots.length} reserved lots, ${roads.length} road/connection segments, ${spawns.length} spawn candidates, ${exits.length} exits; bounds, reservations and graph checks passed.`);
console.table(distances);

if(process.argv.includes('--render')){
  const X=x=>76+(x-xmin)*1.9,Z=z=>106+(z-zmin)*1.9;
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const rect=(p,attrs='')=>`<rect x="${X(p[0])}" y="${Z(p[1])}" width="${(p[2]-p[0])*1.9}" height="${(p[3]-p[1])*1.9}" ${attrs}/>`;
  const line=(a,b,attrs='')=>`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" ${attrs}/>`;
  const label=(x,y,text,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(text)}</text>`;
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="1340" height="1000" viewBox="0 0 1340 1000" role="img" aria-labelledby="title desc"><title id="title">盐港隔离区 3.5A 总体规划</title><desc id="desc">400×400米、五个地面地区、二层邮轮、B1、八个出生候选与四个撤离口的游戏地图设计草案。</desc><defs><pattern id="grid" width="95" height="95" patternUnits="userSpaceOnUse" x="76" y="106"><path d="M95 0H0V95" fill="none" stroke="#66818a" stroke-opacity=".26" stroke-width="1"/></pattern><pattern id="waves" width="18" height="13" patternUnits="userSpaceOnUse"><path d="M0 8 Q4 4 9 8T18 8" fill="none" stroke="#76d6df" stroke-opacity=".22" stroke-width="1"/></pattern></defs><style>text{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;fill:#e9f0ee} .mono{font-family:monospace} .muted{fill:#9aafb3} .small{font-size:13px} .poi{font-weight:700;font-size:15px;text-anchor:middle} .zone{font-weight:700;font-size:14px;text-anchor:middle} .marker{font-size:12px;font-weight:700;paint-order:stroke;stroke:#12232d;stroke-width:3px;stroke-linejoin:round}</style>`,
  `<rect width="1340" height="1000" fill="#102129"/><rect x="0" width="9" height="1000" fill="#74d6c9"/><path d="M54 88H1290" stroke="#324950"/>`,
  label(35,37,'SALTLINE  /  LEVEL DESIGN',`class="mono" font-size="13" letter-spacing="3" fill="#99d7ca"`),label(35,73,'盐港隔离区 · 总体规划',`font-size="29" font-weight="700"`),label(1080,38,'3.5A  /  草案 V1',`font-size="15" font-weight="700" fill="#9bd6c6"`),label(1080,66,'400 × 400 m · 未上线',`class="small muted"`),
  rect(bounds,`fill="#1c333a" stroke="#80979a" stroke-width="2"`)];
  for(const d of districts)out.push(rect(d.area,`fill="${d.color}" fill-opacity=".10" stroke="${d.color}" stroke-opacity=".30" stroke-dasharray="5 4"`));
  out.push(rect(water,`fill="#16475c"`),rect(water,`fill="url(#waves)"`),line([-142,-103],[-142,44],`stroke="#82d3cd" stroke-width="2"`),rect(bounds,`fill="url(#grid)"`));
  // Grid coordinates and north arrow.
  for(let n=0;n<=400;n+=100){out.push(label(X(xmin+n),97,String(xmin+n),`class="small muted mono" text-anchor="middle"`));out.push(label(66,Z(zmin+n)+4,String(zmin+n),`class="small muted mono" text-anchor="end"`));}
  for(const r of roads){const attrs=r.type==='gangway'?`stroke="#77e0db" stroke-width="${r.width*1.9}" stroke-dasharray="4 3"`:`stroke="#5f777a" stroke-opacity=".72" stroke-width="${r.width*1.9}" stroke-linecap="round"`;out.push(line(r.from,r.to,attrs));if(r.type!=='gangway'&&r.width>=8)out.push(line(r.from,r.to,`stroke="#c5d4cb" stroke-opacity=".55" stroke-width="1" stroke-dasharray="7 8"`));}
  const color=id=>districts.find(d=>d.id===id).color;
  for(const space of openSpaces){const cx=space.outline.reduce((s,p)=>s+X(p[0]),0)/space.outline.length,cy=space.outline.reduce((s,p)=>s+Z(p[1]),0)/space.outline.length;out.push(`<polygon points="${space.outline.map(p=>`${X(p[0])},${Z(p[1])}`).join(' ')}" fill="${color(space.district)}" fill-opacity=".12" stroke="${color(space.district)}" stroke-opacity=".55" stroke-dasharray="3 3"/>`,label(cx,cy+3,space.label,`font-size="11" text-anchor="middle" fill="#b0cbc6"`));}
  for(const l of lots){const c=color(l.district),[x1,z1,x2,z2]=l.rect,cx=(X(x1)+X(x2))/2,cy=(Z(z1)+Z(z2))/2;
    if(l.id==='W1'){
      // The ship footprint is tapered only as a symbol; its reserved envelope remains exact.
      out.push(rect(l.rect,`fill="none" stroke="${c}" stroke-dasharray="4 3" opacity=".6"`),`<path d="M${X(x1+1)} ${Z(z1+8)}Q${cx} ${Z(z1-4)} ${X(x2-1)} ${Z(z1+8)}V${Z(z2-6)}Q${cx} ${Z(z2+1)} ${X(x1+1)} ${Z(z2-6)}Z" fill="#3b747c" stroke="${c}" stroke-width="2"/>`,label(cx,cy,'W1 邮轮',`class="poi" transform="rotate(-90 ${cx} ${cy})"`));
    }else{
      out.push(rect(l.rect,`rx="4" fill="${c}" fill-opacity=".24" stroke="${c}" stroke-width="1.5"`),label(cx,l.id==='N3'?Z(z1)+15:cy+4,l.id,`class="poi"`));
    }
  }
  // Only the below-ground envelope: a separate floor in gameplay, not surface geometry.
  out.push(rect(lab.rect,`fill="#7962b4" fill-opacity=".13" stroke="#ded0ff" stroke-width="1.5" stroke-dasharray="4 4"`));
  const ramp=lab.rampEntry;out.push(`<path d="M${X(ramp[0])-4} ${Z(ramp[1])-8}l8 0v8h5l-9 9-9-9h5z" fill="#d6bdf6"/>`,label(X(ramp[0])+11,Z(ramp[1])+4,'↓ B1',`class="marker" fill="#f1dcff"`));
  const regionLabels=[['W',-135,61],['C',-6,-86],['E',143,-84],['N',4,-214],['S',-110,94]];
  for(const [id,x,z] of regionLabels)out.push(label(X(x),Z(z)+4,districts.find(d=>d.id===id).name,`class="zone" fill="${color(id)}" style="paint-order:stroke;stroke:#102129;stroke-width:4;stroke-linejoin:round"`));
  for(const s of spawns){const x=X(s.at[0]),y=Z(s.at[1]),n=s.group==='north',c=n?'#6fdaf0':'#f9d17b';out.push(`<circle cx="${x}" cy="${y}" r="8" fill="#11252c" stroke="${c}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`,label(x+(s.id==='N-D'||s.id==='S-D'?-11:12),y-9,s.id,`class="marker" text-anchor="${s.id==='N-D'||s.id==='S-D'?'end':'start'}" fill="${c}"`));}
  for(const e of exits){const x=X(e.at[0]),y=Z(e.at[1]),c=e.kind==='regular'?'#92efb9':'#ffc184',name=e.id==='north-gate'?'北部撤离 N':e.id==='highway'?'南部撤离 S':e.id==='service-passage'?'持卡维修口':'B1 货梯';out.push(`<path d="M${x} ${y-9}l9 9-9 9-9-9Z" fill="#17363b" stroke="${c}" stroke-width="2.5"/>`,label(x+(e.id==='service-passage'?-12:12),y-9,name,`class="marker" text-anchor="${e.id==='service-passage'?'end':'start'}" fill="${c}"`));}
  out.push(`<path d="M811 139l-7 17 7-5 7 5Z" fill="#dce8e3"/>`,label(811,130,'N',`class="small" text-anchor="middle"`));
  // Sidebar POI key paired by stable IDs.
  out.push(`<rect x="862" y="106" width="442" height="760" rx="7" fill="#162b33" stroke="#354f58"/>`,label(884,136,'区块与重点地标',`font-size="19" font-weight="700"`),label(884,158,'方框为预留建设范围，不代表最终建筑外墙。',`class="small muted"`));
  let y=188;
  for(const id of ['W','C','E','N','S']){const d=districts.find(d=>d.id===id);out.push(`<rect x="884" y="${y-12}" width="5" height="15" fill="${d.color}"/>`,label(898,y,d.name,`font-size="15" font-weight="700" fill="${d.color}"`));y+=21;for(const l of lots.filter(l=>l.district===id)){out.push(label(884,y,l.id,`class="small mono" fill="${d.color}"`),label(924,y,l.name,`font-size="14"`),label(1280,y,l.work==='new'?'新建':'重构',`class="small muted" text-anchor="end"`));y+=19;}y+=11;}
  assert.ok(y<=866,`legend overflow: ${y}`);
  out.push(`<path d="M76 891H1304" stroke="#3c5559"/>`,
    `<circle cx="87" cy="918" r="7" stroke="#6fdaf0" fill="none" stroke-width="2"/>`,label(102,923,'N-A～D 北组出生',`class="small"`),`<circle cx="267" cy="918" r="7" stroke="#f9d17b" fill="none" stroke-width="2"/>`,label(282,923,'S-A～D 南组出生',`class="small"`),`<path d="M452 909l9 9-9 9-9-9Z" fill="none" stroke="#92efb9" stroke-width="2"/>`,label(467,923,'常规撤离',`class="small"`),`<path d="M565 909l9 9-9 9-9-9Z" fill="none" stroke="#ffc184" stroke-width="2"/>`,label(580,923,'条件撤离',`class="small"`),`<rect x="684" y="910" width="17" height="15" fill="none" stroke="#ded0ff" stroke-dasharray="4 3"/>`,label(710,923,'B1 投影',`class="small"`),`<line x1="815" y1="918" x2="845" y2="918" stroke="#77e0db" stroke-width="3" stroke-dasharray="4 3"/>`,label(852,923,'登船连桥',`class="small"`),
    `<path d="M76 951h95m-95-5v10m95-10v10" stroke="#c1d9d4" stroke-width="1.5"/>`,label(76,973,'0',`class="small muted"`),label(171,973,'50 m',`class="small muted" text-anchor="end"`),label(203,956,'北组仅南部常规口开放；南组仅北部常规口开放。两处条件口规则独立。',`font-size="14" fill="#b0d9cb"`),label(1304,972,'设计预留 · 场景、碰撞与实走距离待 B/C 验证',`class="small muted" text-anchor="end"`),`</svg>`);
  writeFileSync(new URL('./overview.svg',import.meta.url),out.join('\n')+'\n');
}
