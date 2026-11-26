// Design-only geometry, terrain and connection checks, plus reproducible vector art.
// This is a planning model, not the playable collision mesh.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const plan=JSON.parse(readFileSync(new URL('./blueprint.json',import.meta.url),'utf8'));
const {bounds,seaEnvelope,landOutline,districts,lots,roads,openSpaces,spawns,exits,lab,routeRule,terrain,offshore}=plan;
const [xmin,zmin,xmax,zmax]=bounds, ship=lots.find(l=>l.id===offshore.lot), EPS=1e-7;
const inside=([x,z],[a,b,c,d])=>x>=a-EPS&&x<=c+EPS&&z>=b-EPS&&z<=d+EPS;
const corners=([a,b,c,d])=>[[a,b],[c,b],[c,d],[a,d]];
const encloses=(outer,box)=>corners(box).every(p=>inside(p,outer))&&box[2]>box[0]&&box[3]>box[1];
const overlap=([a,b,c,d],[e,f,g,h])=>a<g&&c>e&&b<h&&d>f;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const key=p=>p.join(',');
const same=(a,b)=>distance(a,b)<EPS;
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
const edges=poly=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return distance(p,mix(a,b,t));};
const on=(p,a,b)=>pointSegment(p,a,b)<EPS;
function inPolygon(p,poly){if(edges(poly).some(([a,b])=>on(p,a,b)))return true;let hit=false;for(const [a,b] of edges(poly)){if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function intersection(a,b,c,d){const rx=b[0]-a[0],rz=b[1]-a[1],sx=d[0]-c[0],sz=d[1]-c[1],den=rx*sz-rz*sx;if(Math.abs(den)<EPS)return;const ux=c[0]-a[0],uz=c[1]-a[1],t=(ux*sz-uz*sx)/den,u=(ux*rz-uz*rx)/den;if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)return mix(a,b,Math.max(0,Math.min(1,t)));}
function segRectDistance(a,b,rect){const cs=corners(rect);if(inside(a,rect)||inside(b,rect)||edges(cs).some(([c,d])=>intersection(a,b,c,d)))return 0;return Math.min(...cs.map(p=>pointSegment(p,a,b)),...edges(cs).flatMap(([c,d])=>[pointSegment(a,c,d),pointSegment(b,c,d)]));}
const segments=roads.flatMap(r=>r.points.slice(1).map((b,i)=>({road:r,a:r.points[i],b})));
const quay=roads.find(r=>r.type==='quay');

// The land grid yields a continuous elevation. Building platforms and roads are
// explicit reservations at planned heights and will be blended at their edges.
function terrainY([x,z]){
  const idx=(axis,v)=>Math.max(0,Math.min(axis.length-2,axis.findIndex(a=>a>v)<0?axis.length-2:axis.findIndex(a=>a>v)-1));
  const i=idx(terrain.x,x),j=idx(terrain.z,z),u=(x-terrain.x[i])/(terrain.x[i+1]-terrain.x[i]),v=(z-terrain.z[j])/(terrain.z[j+1]-terrain.z[j]);
  return lerp(lerp(terrain.y[j][i],terrain.y[j][i+1],u),lerp(terrain.y[j+1][i],terrain.y[j+1][i+1],u),v);
}
function nodeY(p){if(inside(p,ship.rect))return offshore.cabinY;if(same(p,lab.rampEntry))return lab.surfaceY;if(quay.points.slice(1).some((b,i)=>on(p,quay.points[i],b)))return offshore.quayY;return terrainY(p);}
const yValues=terrain.y.flat(),minY=Math.min(...yValues),maxY=Math.max(...yValues);
assert.equal(xmax-xmin,400);assert.equal(zmax-zmin,400);
assert.ok(landOutline.every(p=>inside(p,bounds)));
assert.ok(ship.rect[2]<xmin&&encloses(seaEnvelope,ship.rect),'ship must be wholly outside 400x400 land');
assert.ok(corners(ship.rect).every(p=>!inPolygon(p,landOutline)));
assert.equal(terrain.x.length,terrain.y[0].length);assert.equal(terrain.z.length,terrain.y.length);assert.ok(maxY-minY>=18,'terrain relief');
assert.equal(new Set([...lots,...roads,...districts,...spawns,...exits].map(e=>e.id)).size,lots.length+roads.length+districts.length+spawns.length+exits.length);
assert.equal(lots.filter(l=>l.name==='极光药局').length,1);
for(const d of districts){assert.ok(encloses(bounds,d.area),d.id);assert.ok(d.outline.every(p=>inside(p,bounds)),d.id);}
for(const l of lots){
  if(l!==ship){assert.ok(encloses(districts.find(d=>d.id===l.district).area,l.rect),`${l.id} outside district`);assert.ok(corners(l.rect).every(p=>inPolygon(p,landOutline)),`${l.id} outside land`);}
  assert.ok(Number.isFinite(l.padY));for(const other of lots)if(other!==l)assert.ok(!overlap(l.rect,other.rect),`${l.id} overlaps ${other.id}`);
}
assert.ok(encloses(lots.find(l=>l.id===lab.host).rect,lab.rect));assert.ok(inside(exits.find(e=>e.id==='lab-lift').at,lab.rect));assert.ok(Math.abs(lab.surfaceY-lab.floorY-lab.depthBelowLocalGround)<EPS);
for(const s of openSpaces){assert.ok(s.outline.every(p=>inside(p,districts.find(d=>d.id===s.district).area)),s.id);assert.ok(s.outline.every(p=>inPolygon(p,landOutline)),s.id);}
let maxGrade=0,maxGradeRoad='';
for(const {road:r,a,b} of segments){
  assert.ok(distance(a,b)>0,r.id);
  if(r.type==='gangway'){
    assert.equal(a[0],ship.rect[2]);assert.ok(inside(a,ship.rect)&&a[0]<xmin);assert.ok(inPolygon(b,landOutline)&&quay.points.some(p=>same(p,b)));assert.ok(!inPolygon(a,landOutline));
  }else{
    for(let t=0;t<=1.001;t+=.05)assert.ok(inPolygon(mix(a,b,Math.min(t,1)),landOutline),`${r.id} centreline leaves land`);
  }
  for(const l of lots){if(r.type==='gangway'&&l===ship)continue;assert.ok(segRectDistance(a,b,l.rect)>=r.width/2-EPS,`${r.id} crosses reserved lot ${l.id}`);}
  const grade=Math.abs(nodeY(b)-nodeY(a))/distance(a,b);if(grade>maxGrade){maxGrade=grade;maxGradeRoad=r.id;}
  assert.ok(grade<=terrain.roadGradeLimit+EPS,`${r.id} grade ${(grade*100).toFixed(1)}%`);
}
assert.equal(roads.filter(r=>r.type==='gangway').length,2);

// Split the curved abstract road graph at shared points and actual intersections.
const pts=[...segments.flatMap(s=>[s.a,s.b]),...spawns.map(s=>s.at),...exits.filter(e=>e.floor==='1F').map(e=>e.at),lab.rampEntry];
for(const [i,a] of segments.entries())for(const b of segments.slice(i+1)){const p=intersection(a.a,a.b,b.a,b.b);if(p)pts.push(p);}
const unique=[...new Map(pts.map(p=>[key(p.map(n=>Math.round(n*1e7)/1e7)),p.map(n=>Math.round(n*1e7)/1e7)])).values()];
const graph=new Map();
function link(a,b,len){if(!graph.has(key(a)))graph.set(key(a),[]);graph.get(key(a)).push([key(b),len]);}
for(const {a,b} of segments){const nodes=unique.filter(p=>on(p,a,b)).sort((p,q)=>distance(p,a)-distance(q,a));for(let i=1;i<nodes.length;i++){const len=distance(nodes[i-1],nodes[i])*Math.hypot(1,(nodeY(b)-nodeY(a))/distance(a,b));link(nodes[i-1],nodes[i],len);link(nodes[i],nodes[i-1],len);}}
function shortest(start,end){const frontier=new Map([[key(start),0]]),done=new Set();while(frontier.size){const [id,dist]=[...frontier].sort((a,b)=>a[1]-b[1])[0];frontier.delete(id);if(id===key(end))return dist;if(done.has(id))continue;done.add(id);for(const [other,len] of graph.get(id)??[])if(!done.has(other)&&dist+len<(frontier.get(other)??Infinity))frontier.set(other,dist+len);}return Infinity;}
assert.equal(exits.filter(e=>e.kind==='regular').length,2);assert.equal(spawns.filter(s=>s.group==='north').length,4);assert.equal(spawns.filter(s=>s.group==='south').length,4);
const distances=spawns.map(s=>{
  assert.ok(inPolygon(s.at,landOutline)&&!lots.some(l=>inside(s.at,l.rect))&&segments.some(r=>on(s.at,r.a,r.b)),s.id);
  const allowed=exits.filter(e=>e.kind==='regular'&&e.openFor===s.group);assert.equal(allowed.length,1);assert.equal(allowed[0].id,routeRule[s.group]);
  assert.ok(s.group==='north'?allowed[0].at[1]>100:allowed[0].at[1]<-180);
  const estimate=shortest(s.at,allowed[0].at);assert.ok(Number.isFinite(estimate)&&estimate>=350&&estimate<=575,`${s.id}: ${estimate}`);
  for(const target of [lab.rampEntry,exits.find(e=>e.id==='service-passage').at,...roads.filter(r=>r.type==='gangway').map(r=>r.points[0])])assert.ok(Number.isFinite(shortest(s.at,target)),`${s.id}: disconnected target ${target}`);
  return {spawn:s.id,exit:allowed[0].name,straight:Math.round(distance(s.at,allowed[0].at)),roadEstimate:Math.round(estimate),height:+nodeY(s.at).toFixed(1)};
});
for(const l of lots.filter(l=>l!==ship))assert.ok(Math.min(...segments.filter(s=>s.road.type!=='gangway').map(s=>segRectDistance(s.a,s.b,l.rect)-s.road.width/2))<=30,`${l.id} isolated frontage`);
console.log(`V2: ${lots.length} lots, ${roads.length} curved road/connection lines, ${spawns.length} spawns, ${exits.length} exits; offshore ship, land/clearance, heights and abstract graph passed.`);
console.log(`Terrain ${minY}–${maxY}m (${maxY-minY}m relief); largest planned road segment grade ${(maxGrade*100).toFixed(1)}% (${maxGradeRoad}).`);console.table(distances);

if(process.argv.includes('--render')){
  const worldX=seaEnvelope[0],scale=1.88,X=x=>65+(x-worldX)*scale,Z=z=>106+(z-zmin)*scale;
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const rect=(p,attrs='')=>`<rect x="${X(p[0])}" y="${Z(p[1])}" width="${(p[2]-p[0])*scale}" height="${(p[3]-p[1])*scale}" ${attrs}/>`;
  const line=(a,b,attrs='')=>`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" ${attrs}/>`;
  const polygon=(p,attrs='')=>`<polygon points="${p.map(a=>`${X(a[0])},${Z(a[1])}`).join(' ')}" ${attrs}/>`;
  const polyline=(p,attrs='')=>`<polyline points="${p.map(a=>`${X(a[0])},${Z(a[1])}`).join(' ')}" fill="none" ${attrs}/>`;
  const label=(x,y,text,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(text)}</text>`;
  const bands=['#24434c','#345352','#40594e','#4e6049','#605f48','#706346'];
  const palette=y=>bands[Math.max(0,Math.min(5,Math.floor(y/4)))];
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="1430" height="1130" viewBox="0 0 1430 1130" role="img" aria-labelledby="title desc"><title id="title">盐港隔离区 3.5A 总体规划 V2</title><desc id="desc">400×400米陆地参考范围、外海邮轮凸出、地形等高线、五个地面区、八个出生候选及四个撤离口的游戏设计草案。</desc><defs><clipPath id="land">${polygon(landOutline)}</clipPath><pattern id="waves" width="22" height="16" patternUnits="userSpaceOnUse"><path d="M0 10Q5 5 11 10T22 10" fill="none" stroke="#67b7c8" stroke-opacity=".23" stroke-width="1"/></pattern><pattern id="grid" width="94" height="94" patternUnits="userSpaceOnUse" x="${X(xmin)}" y="106"><path d="M94 0H0V94" fill="none" stroke="#839ba0" stroke-opacity=".16" stroke-width="1"/></pattern></defs><style>text{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;fill:#e9f0ee}.mono{font-family:monospace}.muted{fill:#a4b9bb}.small{font-size:13px}.poi{font-weight:700;font-size:14px;text-anchor:middle;paint-order:stroke;stroke:#172e33;stroke-width:3px;stroke-linejoin:round}.zone{font-weight:700;font-size:14px;text-anchor:middle;paint-order:stroke;stroke:#14252d;stroke-width:4px;stroke-linejoin:round}.marker{font-size:12px;font-weight:700;paint-order:stroke;stroke:#12232d;stroke-width:3px;stroke-linejoin:round}</style>`,
    `<rect width="1430" height="1130" fill="#102129"/><rect x="0" width="9" height="1130" fill="#74d6c9"/><path d="M55 88H1380" stroke="#354d56"/>`,label(35,35,'SALTLINE  /  LEVEL DESIGN',`class="mono" font-size="13" letter-spacing="3" fill="#99d7ca"`),label(35,73,'盐港隔离区 · 立体地形规划',`font-size="29" font-weight="700"`),label(1110,37,'3.5A  /  草案 V2',`font-size="16" font-weight="700" fill="#a2d7c7"`),label(1110,65,'400 × 400 m 陆地 ＋ 海上延伸区',`class="small muted"`),
    rect([worldX,zmin,xmax,zmax],`fill="#172b33"`),rect(seaEnvelope,`fill="#123d53"`),rect(seaEnvelope,`fill="url(#waves)"`),polygon(landOutline,`fill="${bands[0]}"`),`<g clip-path="url(#land)">`];
  // Draw sampled elevation bands in 5m tiles, then vector isolines (4m intervals).
  const tiles=bands.map(()=>[]),bandAt=(x,z)=>Math.min(5,Math.max(0,Math.floor(terrainY([x+2.5,z+2.5])/4)));
  for(let z=zmin;z<zmax;z+=5){let start=xmin,band=bandAt(xmin,z);for(let x=xmin+5;x<=xmax;x+=5){const next=x===xmax?-1:bandAt(x,z);if(next===band)continue;const w=((x-start)*scale+.1).toFixed(2);tiles[band].push(`M${X(start).toFixed(2)} ${Z(z).toFixed(2)}h${w}v${(5*scale+.1).toFixed(2)}h-${w}z`);start=x;band=next;}}
  tiles.forEach((paths,i)=>out.push(`<path d="${paths.join('')}" fill="${bands[i]}"/>`));
  for(let height=4;height<=20;height+=4){const paths=[];for(let z=zmin;z<zmax;z+=5)for(let x=xmin;x<xmax;x+=5){const cs=[[x,z],[x+5,z],[x+5,z+5],[x,z+5]],ys=cs.map(terrainY),cross=[];for(let i=0;i<4;i++){const j=(i+1)%4;if((ys[i]>=height)!==(ys[j]>=height))cross.push(mix(cs[i],cs[j],(height-ys[i])/(ys[j]-ys[i])));}for(let i=0;i+1<cross.length;i+=2)paths.push(`M${X(cross[i][0]).toFixed(1)} ${Z(cross[i][1]).toFixed(1)}L${X(cross[i+1][0]).toFixed(1)} ${Z(cross[i+1][1]).toFixed(1)}`);}out.push(`<path d="${paths.join('')}" stroke="#d6d3a0" stroke-width="1.05" stroke-opacity=".56" fill="none"/>`);}
  for(const d of districts)out.push(polygon(d.outline,`fill="${d.color}" fill-opacity=".055" stroke="${d.color}" stroke-opacity=".50" stroke-dasharray="5 5" stroke-width="1.2"`));
  out.push(rect(bounds,`fill="url(#grid)"`),`</g>`,polygon(landOutline,`fill="none" stroke="#87a8a6" stroke-width="2.2" stroke-linejoin="round"`),rect(bounds,`fill="none" stroke="#accad0" stroke-width="1.2" stroke-dasharray="7 5" opacity=".75"`));
  for(let n=0;n<=400;n+=100){out.push(label(X(xmin+n),97,String(xmin+n),`class="small muted mono" text-anchor="middle"`),label(57,Z(zmin+n)+4,String(zmin+n),`class="small muted mono" text-anchor="end"`));}
  out.push(label(X(-218),Z(75),'外 海',`font-size="16" letter-spacing="3" text-anchor="middle" fill="#8ec6d7" transform="rotate(-90 ${X(-218)} ${Z(75)})"`));
  // Draw the curved circulation with connected segment geometry and no rectangular road grid.
  for(const r of roads){out.push(polyline(r.points,r.type==='gangway'?`stroke="#72d4d0" stroke-width="${r.width*scale}" stroke-linecap="round" stroke-dasharray="4 2"`:`stroke="#263e43" stroke-width="${(r.width+1)*scale}" stroke-linecap="round" stroke-linejoin="round"`));if(r.type!=='gangway')out.push(polyline(r.points,`stroke="#83968c" stroke-opacity=".76" stroke-width="${r.width*scale}" stroke-linecap="round" stroke-linejoin="round"`));if(r.width>=8)out.push(polyline(r.points,`stroke="#dce2d1" stroke-opacity=".6" stroke-width="1" stroke-dasharray="8 8"`));}
  const color=id=>districts.find(d=>d.id===id).color;
  for(const space of openSpaces){const cx=space.outline.reduce((s,p)=>s+X(p[0]),0)/space.outline.length,cy=space.outline.reduce((s,p)=>s+Z(p[1]),0)/space.outline.length;out.push(polygon(space.outline,`fill="#648774" fill-opacity=".28" stroke="#a4cbae" stroke-opacity=".62" stroke-dasharray="3 3"`),label(cx,cy+3,space.label,`font-size="10.5" text-anchor="middle" fill="#e2ebd0"`));}
  function lotArt(l){
    const c=color(l.district),[x1,z1,x2,z2]=l.rect,w=x2-x1,h=z2-z1,cx=(X(x1)+X(x2))/2,cy=(Z(z1)+Z(z2))/2;
    const p=(u,v)=>[x1+u*w,z1+v*h],R=(u,v,s,t,a='')=>rect([...p(u,v),...p(s,t)],a),P=(arr,a='')=>polygon(arr.map(([u,v])=>p(u,v)),a),style=`fill="${c}" fill-opacity=".66" stroke="#142b32" stroke-width="1.2"`;
    out.push(rect(l.rect,`fill="${c}" fill-opacity=".06" stroke="${c}" stroke-opacity=".40" stroke-dasharray="3 3"`));
    switch(l.shape){
      case 'yard':for(let i=0;i<4;i++)out.push(R(.07+i*.23,.10,.20+i*.23,.34,style),R(.07+i*.23,.67,.20+i*.23,.89,style));break;
      case 'row':for(let i=0;i<3;i++)out.push(R(.08+i*.31,.12,.32+i*.31,.48,style),R(.10+i*.28,.63,.28+i*.28,.87,style));break;
      case 'courtyard':out.push(P([[.08,.1],[.91,.1],[.91,.85],[.68,.85],[.68,.38],[.30,.38],[.30,.85],[.08,.85]],style));break;
      case 'lshape':out.push(P([[.08,.10],[.9,.10],[.9,.48],[.44,.48],[.44,.89],[.08,.89]],style));break;
      case 'split':out.push(R(.10,.1,.44,.88,style),R(.53,.1,.9,.67,style));break;
      case 'terminal':out.push(P([[.07,.27],[.24,.1],[.79,.1],[.92,.27],[.92,.82],[.07,.82]],style),R(.32,.73,.68,.9,style));break;
      case 'tanks':for(const [u,v,r] of [[.25,.27,8],[.68,.3,9],[.29,.74,7],[.73,.73,6]])out.push(`<circle cx="${X(p(u,v)[0])}" cy="${Z(p(u,v)[1])}" r="${r*scale}" ${style}/>`);break;
      case 'tower':out.push(P([[.50,.07],[.82,.23],[.91,.57],[.65,.90],[.25,.86],[.08,.55],[.16,.22]],style),`<circle cx="${cx}" cy="${cy}" r="${Math.min(w,h)*scale*.22}" fill="#162e36" fill-opacity=".75" stroke="${c}"/>`);break;
      default:out.push(R(.08,.10,.91,.89,style));for(let i=1;i<4;i++)out.push(line(p(.08,.10+i*.19),p(.91,.10+i*.19),`stroke="#243b40" stroke-opacity=".75" stroke-width="1.2"`));
    }
    out.push(label(cx,l.id==='N3'?Z(z1)+16:cy+4,l.id,`class="poi"`));
    if(h>=26)out.push(label(cx,l.id==='N3'?Z(z1)+29:cy+18,`+${l.padY}m`,`font-size="10.5" text-anchor="middle" paint-order="stroke" stroke="#142b32" stroke-width="2"`));
  }
  for(const l of lots)if(l!==ship)lotArt(l);
  // Tapered hull, deck outline and windows outside the dotted land bounds.
  {const [x1,z1,x2,z2]=ship.rect,cx=(X(x1)+X(x2))/2,cy=(Z(z1)+Z(z2))/2;out.push(rect(ship.rect,`fill="none" stroke="#62d4d0" stroke-dasharray="4 3" opacity=".6"`),`<path d="M${X(x1+1)} ${Z(z1+10)}Q${cx} ${Z(z1-4)} ${X(x2-1)} ${Z(z1+10)}V${Z(z2-7)}Q${cx} ${Z(z2+2)} ${X(x1+1)} ${Z(z2-7)}Z" fill="#c2dadd" stroke="#61d1ce" stroke-width="2"/>`,rect([x1+3,z1+15,x2-3,z2-13],`rx="10" fill="#315b66" stroke="#f1eee1" stroke-width="1.6"`),rect([x1+5,z1+20,x2-5,z1+35],`rx="2" fill="#7ab7ba"`),label(cx,cy,'W1 邮轮',`class="poi" transform="rotate(-90 ${cx} ${cy})"`),label(cx,Z(z2)+17,'外海扩展',`font-size="11.5" text-anchor="middle" fill="#87d8d8"`));}
  out.push(rect(lab.rect,`fill="#856cba" fill-opacity=".17" stroke="#dfd0ff" stroke-width="1.5" stroke-dasharray="4 4"`));
  const ramp=lab.rampEntry;out.push(`<path d="M${X(ramp[0])-4} ${Z(ramp[1])-8}l8 0v8h5l-9 9-9-9h5z" fill="#d8bff6"/>`,label(X(ramp[0])+12,Z(ramp[1])+4,'↓ B1',`class="marker" fill="#f1dcff"`));
  for(const [id,x,z] of [['W',-132,59],['C',-6,-86],['E',144,-85],['N',-1,-215],['S',-115,95]])out.push(label(X(x),Z(z)+4,districts.find(d=>d.id===id).name,`class="zone" fill="${color(id)}"`));
  // Contour labels provide elevation anchors without cluttering every isoline.
  for(const [x,z] of [[-158,-114],[-107,-135],[6,-119],[165,-126],[172,-189],[34,90],[-46,169]])out.push(label(X(x),Z(z),`+${Math.round(terrainY([x,z]))}`,`font-size="11" class="marker" fill="#e4dbad" text-anchor="middle"`));
  for(const s of spawns){const x=X(s.at[0]),y=Z(s.at[1]),n=s.group==='north',c=n?'#6fdaf0':'#f9d17b',end=s.id.endsWith('-D');out.push(`<circle cx="${x}" cy="${y}" r="7.7" fill="#152a32" stroke="${c}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="2.8" fill="${c}"/>`,label(x+(end?-11:11),y-9,s.id,`class="marker" text-anchor="${end?'end':'start'}" fill="${c}"`));}
  for(const e of exits){const x=X(e.at[0]),y=Z(e.at[1]),c=e.kind==='regular'?'#9af0ac':'#ffbd7c',name=e.id==='north-gate'?'北部撤离 N':e.id==='highway'?'南部撤离 S':e.id==='service-passage'?'持卡维修口':'B1 货梯';const end=e.id==='service-passage';out.push(`<path d="M${x} ${y-9}l9 9-9 9-9-9Z" fill="#17363b" stroke="${c}" stroke-width="2.5"/>`,label(x+(end?-12:12),y+(e.id==='north-gate'?5:-9),name,`class="marker" text-anchor="${end?'end':'start'}" fill="${c}"`));}
  out.push(`<path d="M910 139l-7 17 7-5 7 5Z" fill="#dce8e3"/>`,label(910,130,'N',`class="small" text-anchor="middle"`));
  // POI and terrain key.
  out.push(`<rect x="951" y="106" width="443" height="752" rx="7" fill="#162b33" stroke="#354f58"/>`,label(973,136,'功能地块  /  基础平台高程',`font-size="19" font-weight="700"`),label(973,159,'不同轮廓为建筑体量示意，不是最终外墙。',`class="small muted"`));
  let y=185;
  for(const id of ['W','C','E','N','S']){const d=districts.find(d=>d.id===id);out.push(`<rect x="973" y="${y-12}" width="5" height="15" fill="${d.color}"/>`,label(986,y,d.name,`font-size="15" font-weight="700" fill="${d.color}"`));y+=21;for(const l of lots.filter(l=>l.district===id)){out.push(label(974,y,l.id,`class="small mono" fill="${d.color}"`),label(1014,y,l.name,`font-size="14"`),label(1370,y,l===ship?'+2.8 / +6.2m':`+${l.padY}m`,`class="small muted mono" text-anchor="end"`));y+=18;}y+=9;}
  assert.ok(y<858);
  out.push(`<path d="M65 880H1394" stroke="#3c5559"/>`,label(65,907,'海拔示意 · 等高线间隔 4m',`font-size="14" font-weight="700"`));
  bands.forEach((c,i)=>out.push(`<rect x="${65+i*54}" y="923" width="54" height="14" fill="${c}" stroke="#758c85" stroke-width=".5"/>`,label(65+i*54,954,`+${i*4}m`,`font-size="11" class="muted"`)));
  out.push(`<circle cx="421" cy="930" r="6.5" stroke="#6fdaf0" fill="none" stroke-width="2"/>`,label(434,935,'北组出生',`class="small"`),`<circle cx="517" cy="930" r="6.5" stroke="#f9d17b" fill="none" stroke-width="2"/>`,label(530,935,'南组出生',`class="small"`),`<path d="M615 922l8 8-8 8-8-8Z" fill="none" stroke="#92efb9" stroke-width="2"/>`,label(628,935,'常规撤离',`class="small"`),`<path d="M720 922l8 8-8 8-8-8Z" fill="none" stroke="#ffc184" stroke-width="2"/>`,label(734,935,'条件撤离',`class="small"`),`<line x1="829" y1="930" x2="855" y2="930" stroke="#77e0db" stroke-width="3" stroke-dasharray="4 3"/>`,label(863,935,'登船连桥',`class="small"`),`<line x1="960" y1="930" x2="990" y2="930" stroke="#accad0" stroke-dasharray="7 5"/>`,label(998,935,'400m 陆地参考范围',`class="small"`));
  // Compact section views from the same height grid, not arbitrary illustrations.
  function section(x,y,w,title,start,end){const yBase=y+104,fy=v=>yBase-v*3.2,pts=Array.from({length:81},(_,i)=>mix(start,end,i/80)),data=pts.map((p,i)=>[x+i*w/80,terrainY(p)]);out.push(label(x,y,title,`font-size="13" font-weight="700" fill="#c1d9d2"`),`<path d="M${x} ${fy(0)}H${x+w}" stroke="#57777f" stroke-dasharray="4 4"/>`,`<path d="M${x} ${fy(0)}L${data.map(([px,h])=>`${px} ${fy(h)}`).join('L')}L${x+w} ${fy(0)}Z" fill="#455c52" stroke="none"/>`,`<polyline points="${data.map(([px,h])=>`${px},${fy(h)}`).join(' ')}" fill="none" stroke="#bbd1a4" stroke-width="2"/>`);for(const i of [0,20,40,60,80]){const [px,h]=data[i];out.push(label(px,fy(h)-6,`+${h.toFixed(1)}m`,`font-size="10.5" text-anchor="${i===0?'start':i===80?'end':'middle'}"`));}}
  section(65,978,610,'西岸 → 物流台地 → 工业盆地（Z = −20m）',[-172,-20],[228,-20]);section(742,978,652,'南部缓丘 → 中部 → 北部科研坡地（X = 128m）',[128,180],[128,-220]);
  out.push(label(65,1110,'虚线只表示陆地参考边界；船和连桥为真实外海可玩附属区域，水面本身不扩大可通行范围。',`class="small muted"`),label(1394,1110,'V2 · 设计预留，灰盒实走待 B/C',`class="small muted" text-anchor="end"`),`</svg>`);
  writeFileSync(new URL('./overview.svg',import.meta.url),out.join('\n')+'\n');

  // Companion axonometric massing view: same sampled height grid and reservations.
  // Vertical scale is deliberately exaggerated so the relief is visible at map size.
  const iso=(x,z,y=0)=>[611+(x-28+z+20)*1.15,439+(z+20-(x-28))*.48-y*3.0];
  const ipoly=(points,attrs='')=>`<polygon points="${points.map(([x,z,y])=>iso(x,z,y).map(n=>n.toFixed(1)).join(',')).join(' ')}" ${attrs}/>`;
  const iline=(points,attrs='')=>`<polyline points="${points.map(([x,z,y])=>iso(x,z,y).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" ${attrs}/>`;
  const elev=p=>[p[0],p[1],terrainY(p)];
  const ax=[`<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="780" viewBox="0 0 1260 780" role="img" aria-label="盐港地图三维体量和高程示意"><style>text{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;fill:#e9f3ef}</style><rect width="1260" height="780" fill="#102129"/><rect width="9" height="780" fill="#74d6c9"/>`,label(31,35,'SALTLINE  /  3.5A V2',`font-size="13" letter-spacing="3" fill="#9edbd2"`),label(31,73,'地形体量 · 轴测示意',`font-size="29" font-weight="700"`),label(1228,47,'垂直比例约 2.5× · 非最终场景',`font-size="14" text-anchor="end" fill="#a4c7c7"`),`<path d="M31 91H1228" stroke="#354b54"/>`];
  ax.push(ipoly([[-232,-220,0],[-172,-220,0],[-172,180,0],[-232,180,0]],`fill="#16485a" stroke="#316575"`));
  for(let z=zmin;z<=zmax;z+=22)ax.push(iline([[-232,z,0],[-193,z+2,0],[-172,z,0]],`stroke="#6ab0bb" stroke-opacity=".32" stroke-width="1"`));
  // Clip each coarse surface tile to the shaped land boundary. Terrain faces use
  // the shared grid values; building pads and road gradients are separate layers.
  function clipPlane(poly,axis,cut,side){const result=[];for(const [a,b] of edges(poly)){const da=side*(a[axis]-cut),db=side*(b[axis]-cut);if(da>=0)result.push(a);if((da>=0)!==(db>=0))result.push(mix(a,b,da/(da-db)));}return result;}
  const cells=[];for(let z=zmin;z<zmax;z+=20)for(let x=xmin;x<xmax;x+=20){let p=landOutline;for(const [a,c,s] of [[0,x,1],[0,x+20,-1],[1,z,1],[1,z+20,-1]]){if(p.length)p=clipPlane(p,a,c,s);}if(p.length>=3)cells.push({p,depth:z-x,h:terrainY([x+10,z+10])});}
  // A continuous cutaway edge makes the slope above sea level legible.
  ax.push(ipoly([...landOutline.map(p=>[...p,-.4])],`fill="#263d43" stroke="#587171"`));
  for(const [a,b] of edges(landOutline)){if((b[0]-a[0])+(b[1]-a[1])<0)ax.push(ipoly([[...a,-.4],[...b,-.4],elev(b),elev(a)],`fill="#293e42" stroke="#43565a" stroke-width=".6"`));}
  for(const c of cells.sort((a,b)=>a.depth-b.depth))ax.push(ipoly(c.p.map(elev),`fill="${palette(c.h)}" stroke="#809387" stroke-opacity=".17" stroke-width=".6"`));
  for(const r of roads)ax.push(iline(r.points.map(p=>[...p,nodeY(p)+.18]),r.type==='gangway'?`stroke="#b5e2dc" stroke-width="3.2" stroke-linecap="round"`:`stroke="#9faaa0" stroke-width="${r.width*.76}" stroke-linejoin="round" stroke-linecap="round"`));
  function mass(rectangle,y,h,c){const [a,b,d,e]=rectangle,A=[a,b,y],B=[d,b,y],C=[d,e,y],D=[a,e,y],top=p=>[p[0],p[1],y+h];return [ipoly([A,D,top(D),top(A)],`fill="${c}" fill-opacity=".63" stroke="#152a32" stroke-width=".8"`),ipoly([D,C,top(C),top(D)],`fill="${c}" fill-opacity=".80" stroke="#152a32" stroke-width=".8"`),ipoly([top(A),top(B),top(C),top(D)],`fill="${c}" stroke="#d9e6d5" stroke-opacity=".50" stroke-width=".8"`)];}
  const masses=[];for(const l of lots.filter(l=>l!==ship)){const [a,b,c,d]=l.rect,w=c-a,h=d-b,y=l.padY,shade=color(l.district);const add=(u,v,s,t,height)=>{const box=[a+w*u,b+h*v,a+w*s,b+h*t];masses.push({box,y,h:height,c:shade,depth:(box[1]+box[3]-box[0]-box[2])/2});};
    if(l.shape==='yard'){for(let i=0;i<3;i++)add(.1+i*.28,.15,.27+i*.28,.40,2.2);for(let i=0;i<3;i++)add(.12+i*.29,.66,.28+i*.29,.88,2.2);}
    else if(l.shape==='row'){for(let i=0;i<3;i++)add(.08+i*.31,.10,.32+i*.31,.8,5.5);}
    else if(l.shape==='courtyard'){add(.08,.1,.92,.38,5);add(.08,.38,.29,.88,4.5);add(.71,.38,.92,.88,4.5);}
    else if(l.shape==='split'){add(.08,.1,.43,.88,7);add(.54,.1,.9,.66,5.8);}
    else if(l.shape==='lshape'){add(.08,.1,.91,.45,6.4);add(.08,.45,.45,.88,5.7);}
    else if(l.shape==='tanks'){for(let i=0;i<2;i++)for(let j=0;j<2;j++)add(.13+i*.48,.12+j*.49,.42+i*.48,.39+j*.49,5+i*2);}
    else if(l.shape==='tower'){add(.21,.22,.8,.8,9);add(.38,.38,.63,.63,13);}
    else add(.08,.10,.92,.88,l.floors.length>1?6.5:4.8);
  }
  // Ship masses have two deck elevations; the blue sea remains non-walkable.
  const [sx,sz,ex,ez]=ship.rect;ax.push(...mass([sx+1,sz+4,ex-1,ez-3],.0,offshore.cabinY,'#9dbcbc'),...mass([sx+3,sz+12,ex-3,ez-12],offshore.cabinY,offshore.upperDeckY-offshore.cabinY,'#d9e8df'),...mass([sx+5,sz+19,ex-5,sz+37],offshore.upperDeckY,3.4,'#77aeb0'));
  for(const m of masses.sort((a,b)=>a.depth-b.depth))ax.push(...mass(m.box,m.y,m.h,m.c));
  for(const p of [[-165,-48],[-165,0]])ax.push(iline([[...p,offshore.quayY+.35],[-186,p[1],offshore.cabinY+.35]],`stroke="#e1f3e8" stroke-width="3"`));
  const annotations=[['外海邮轮 · 双层',[-196,-33,9],[-90,-25]],['西部低岸 +0.8m',[-135,35,3],[-115,22]],['中央物流台地 +4–6m',[2,-37,12],[0,-46]],['东部工业盆地 +2m',[174,-44,10],[113,15]],['北部科研高地 +10–23m',[128,-178,31],[56,-27]],['南部缓丘 +6–10m',[-30,126,15],[25,42]]];
  for(const [name,p,[dx,dy]] of annotations){const [x,y]=iso(...p),tx=x+dx,ty=y+dy;ax.push(`<path d="M${x} ${y}L${tx} ${ty-4}" stroke="#c3e3d8" stroke-width="1" opacity=".85"/>`,label(tx,ty,name,`font-size="14" text-anchor="${dx<0?'end':dx>0?'start':'middle'}" font-weight="700" paint-order="stroke" stroke="#102129" stroke-width="5" stroke-linejoin="round"`));}
  ax.push(label(31,750,'陆地／海面／桥面分离 · 仅标示地形、道路和建筑体量，内景与最终碰撞待灰盒。',`font-size="13" fill="#a9c3c2"`),`</svg>`);
  writeFileSync(new URL('./relief.svg',import.meta.url),ax.join('\n')+'\n');
}
