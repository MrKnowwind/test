import type { ExitZone, FirstMap, Vec3 } from '../contracts/demo.ts';
import { centerOf, drawMapLabel, drawMapLayer, drawPlayerMark, fitMap, floorNames, layerBounds, mapFloor, mapFloorLabel,
  mapLandmarks, mapProjection, type MapFloor, type MapProjection, type PlanPoint } from './mapGeometry.ts';

type ExitState = (exit: ExitZone) => {kind:string; label:string};
const exitColor = (kind: string) => kind==='locked' ? '#e6a58f' : kind==='active' ? '#f8d190' : '#95e8c7';
const q = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (n: number, low: number, high: number) => Math.min(high,Math.max(low,n));

function drawExit(ctx: CanvasRenderingContext2D, projection: MapProjection, exit: ExitZone, state: string, selected = false) {
  const [x,y]=projection.project(exit.position[0],exit.position[2]);
  ctx.strokeStyle=exitColor(state);ctx.fillStyle='#17313a';ctx.lineWidth=2;
  const size=selected?8:5;
  ctx.fillRect(x-size,y-size,size*2,size*2);
  ctx.strokeRect(x-size,y-size,size*2,size*2);
  if(state==='locked'){
    ctx.beginPath();ctx.moveTo(x-3,y+3);ctx.lineTo(x+3,y-3);ctx.stroke();
  }
}

function drawContacts(ctx: CanvasRenderingContext2D, {project}: MapProjection, floor: MapFloor,
  map: FirstMap, discovered: ReadonlySet<string>, consumed: ReadonlySet<string>) {
  ctx.fillStyle=ctx.strokeStyle='#a5e2d5';ctx.lineWidth=1.2;
  for(const contact of map.interactions){
    if(!discovered.has(contact.id)||mapFloor(contact.position)!==floor)continue;
    if(contact.kind==='door')continue;
    const [x,y]=project(contact.position[0],contact.position[2]);
    if(contact.kind==='switch')ctx.fillRect(x-3,y-3,6,6);
    else {
      ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);
      if(consumed.has(contact.id))ctx.stroke();else ctx.fill();
    }
  }
}

export function createTacticalMap(close: () => void) {
  const panel=q('tactical-map'), canvas=q<HTMLCanvasElement>('map-canvas'), ctx=canvas.getContext('2d')!;
  const mini=q<HTMLCanvasElement>('minimap-canvas'), radar=mini.getContext('2d')!;
  const miniFloor=q('minimap-floor'), compass=q('bearing'), heading=q('heading');
  const tabs=q('map-floors'), legend=q('map-exits'), selectedExitText=q('map-exit-detail');
  const clearMarker=q<HTMLButtonElement>('map-clear-marker'), markerText=q('map-marker-status');
  const left=q('map-location'), scaleBar=q('map-scale');
  let floor: MapFloor='ground', center=centerOf(layerBounds(floor)), zoom=1;
  let lastDraw=-Infinity,lastRadar=-Infinity, latestFeet: Vec3=[0,0,0];
  let exits: readonly ExitZone[]=[];
  let selectedExit: ExitZone|undefined;
  let selectedLandmark: string|undefined;
  let marker: { point:PlanPoint; floor:MapFloor }|undefined;
  let drag: {id:number; x:number; y:number; original:PlanPoint; moved:boolean}|undefined;

  const scale=()=>fitMap(layerBounds(floor),canvas.width,canvas.height,28)*zoom;
  const projection=()=>mapProjection(center,canvas.width,canvas.height,scale());
  const refresh=()=>{lastDraw=-Infinity;};
  function constrain() {
    const b=layerBounds(floor), halfX=canvas.width*.38/scale(), halfZ=canvas.height*.38/scale(), middle=centerOf(b);
    const x=halfX*2>=b.maxX-b.minX?middle[0]:clamp(center[0],b.minX+halfX,b.maxX-halfX);
    const z=halfZ*2>=b.maxZ-b.minZ?middle[1]:clamp(center[1],b.minZ+halfZ,b.maxZ-halfZ);
    center=[x,z];
  }
  function setFloor(value: MapFloor) {
    floor=value;
    panel.dataset.floor=floor;
    for(const tab of tabs.querySelectorAll('button'))tab.setAttribute('aria-pressed', String(tab.dataset.floor===floor));
    selectedExit=undefined;selectedLandmark=undefined;
    center=centerOf(layerBounds(floor));zoom=1;
    refresh();
  }
  for(const [id,label] of Object.entries(floorNames)){
    const button=document.createElement('button');
    button.type='button';button.textContent=label;button.dataset.floor=id;
    button.onclick=()=>setFloor(id as MapFloor);
    tabs.append(button);
  }
  function position(event: PointerEvent|WheelEvent): PlanPoint {
    const r=canvas.getBoundingClientRect();
    return [(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height];
  }
  function zoomAt(factor: number, x=canvas.width/2, y=canvas.height/2) {
    const [wx,wz]=projection().unproject(x,y);
    zoom=clamp(zoom*factor,1,14);
    center=[wx-(x-canvas.width/2)/scale(),wz-(y-canvas.height/2)/scale()];
    constrain();refresh();
  }
  function mark(point: PlanPoint) {
    const bounds=layerBounds(floor);
    if(point[0]<bounds.minX||point[0]>bounds.maxX||point[1]<bounds.minZ||point[1]>bounds.maxZ)return;
    marker={point,floor};selectedExit=undefined;selectedLandmark=undefined;refresh();
  }
  function chooseExit(exit: ExitZone, focus: boolean) {
    selectedExit=exit;selectedLandmark=undefined;
    if(focus){
      zoom=Math.max(zoom,2.15);
      center=[exit.position[0],exit.position[2]];
      constrain();
    }
    refresh();
  }
  function renderedExits() { return exits.filter(exit=>mapFloor(exit.position)===floor); }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    const [x,y]=position(event);
    drag={id:event.pointerId,x,y,original:center,moved:false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const [x,y]=position(event), dx=x-drag.x, dy=y-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    drag.moved=true;canvas.classList.add('panning');
    center=[drag.original[0]-dx/scale(),drag.original[1]-dy/scale()];
    constrain();refresh();
  });
  canvas.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const moved=drag.moved;
    drag=undefined;canvas.classList.remove('panning');
    if(moved)return;
    const [x,y]=position(event), p=projection();
    const exit=renderedExits().find(zone=>{
      const [zx,zy]=p.project(zone.position[0],zone.position[2]);
      return Math.hypot(x-zx,y-zy)<12;
    });
    if(exit){chooseExit(exit,false);return;}
    const dpr=canvas.width/canvas.clientWidth;
    const landmark=floor==='ground'&&mapLandmarks.find(spot=>{
      const [px,py]=p.project(...centerOf(spot.bounds));
      return Math.abs(px-x)<dpr*36&&Math.abs(py-13*dpr-y)<dpr*8;
    });
    if(landmark){
      selectedLandmark=landmark.label;selectedExit=undefined;
      zoom=Math.max(zoom,2.15);center=centerOf(landmark.bounds);constrain();refresh();
    }else mark(p.unproject(x,y));
  });
  canvas.addEventListener('lostpointercapture',()=>{drag=undefined;canvas.classList.remove('panning');});
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    zoomAt(Math.exp(-clamp(event.deltaY*(event.deltaMode===1?18:1),-120,120)*.0026),...position(event));
  },{passive:false});
  canvas.addEventListener('keydown',event=>{
    if(event.code==='Enter'||event.code==='Space'){event.preventDefault();mark(center);}
  });
  q('map-zoom-in').onclick=()=>zoomAt(1.45);
  q('map-zoom-out').onclick=()=>zoomAt(1/1.45);
  q('map-reset').onclick=()=>setFloor(floor);
  q('map-recenter').onclick=()=>{
    setFloor(mapFloor(latestFeet));zoom=2.25;
    center=[latestFeet[0],latestFeet[2]];constrain();refresh();
  };
  clearMarker.onclick=()=>{marker=undefined;refresh();};
  q('tactical-close').onclick=close;

  function drawMarker(target: CanvasRenderingContext2D, p: MapProjection, level: MapFloor) {
    if(!marker||marker.floor!==level)return;
    const [x,y]=p.project(...marker.point);
    target.fillStyle='#79e1f5';target.strokeStyle='#183a49';target.lineWidth=2;
    target.beginPath();target.moveTo(x,y-7);target.lineTo(x+7,y);target.lineTo(x,y+7);target.lineTo(x-7,y);
    target.closePath();target.fill();target.stroke();
  }

  let exitListKey='';
  function updateExitList(status: ExitState) {
    const shown=renderedExits(), key=shown.map(exit=>exit.id).join(',');
    if(key!==exitListKey){
      exitListKey=key;
      legend.replaceChildren(...shown.map(exit=>{
        const button=document.createElement('button');
        button.type='button';button.dataset.exit=exit.id;button.textContent=exit.label;
        button.onclick=()=>chooseExit(exit,true);
        return button;
      }));
      legend.hidden=!shown.length;
    }
    shown.forEach((exit,i)=>{
      const state=status(exit), button=legend.children[i] as HTMLButtonElement;
      button.dataset.state=state.kind;
      button.style.setProperty('--exit-color',exitColor(state.kind));
      button.setAttribute('aria-pressed',String(selectedExit===exit));
      button.setAttribute('aria-label',exit.label+' · '+state.label);
      button.title=state.label;
    });
    const detail=selectedExit ? selectedExit.label+' · '+status(selectedExit).label : selectedLandmark??'';
    if(selectedExitText.textContent!==detail)selectedExitText.textContent=detail;
  }

  return {
    get open() {return !panel.hidden;},
    show(feet: Vec3) {latestFeet=feet;setFloor(mapFloor(feet));panel.hidden=false;q<HTMLButtonElement>('tactical-close').focus();},
    hide() {panel.hidden=true;drag=undefined;canvas.classList.remove('panning');},
    reset() {this.hide();marker=undefined;lastRadar=-Infinity;refresh();},
    updateMini(map: FirstMap, feet: Vec3, yaw: number, now: number, discovered: ReadonlySet<string>, consumed: ReadonlySet<string>, status: ExitState) {
      if(now-lastRadar<90)return;
      lastRadar=now;
      const current=mapFloor(feet), p=mapProjection([feet[0],feet[2]],mini.width,mini.height,mini.width/(current==='b1'?51:90));
      const floorLabel=mapFloorLabel(feet,current);
      if(miniFloor.textContent!==floorLabel)miniFloor.textContent=floorLabel;
      drawMapLayer(radar,p,current);
      drawContacts(radar,p,current,map,discovered,consumed);
      for(const exit of map.exits)if(mapFloor(exit.position)===current)drawExit(radar,p,exit,status(exit).kind);
      drawMarker(radar,p,current);
      drawPlayerMark(radar,mini.width/2,mini.height/2,yaw);
      drawMapLabel(radar,mini.width/2,15,'N',13);
    },
    update(map: FirstMap, feet: Vec3, yaw: number, now: number, discovered: ReadonlySet<string>, consumed: ReadonlySet<string>, status: ExitState) {
      const degrees=((-yaw*180/Math.PI)%360+360)%360;
      compass.textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
      heading.textContent=Math.round(degrees).toString().padStart(3,'0')+'°';
      if(panel.hidden||now-lastDraw<90)return;
      lastDraw=now;latestFeet=feet;exits=map.exits;
      const dpr=Math.min(devicePixelRatio,2), w=Math.round(canvas.clientWidth*dpr), h=Math.round(canvas.clientHeight*dpr);
      if(w>56&&h>56&&(canvas.width!==w||canvas.height!==h)){canvas.width=w;canvas.height=h;constrain();}
      const p=projection();
      drawMapLayer(ctx,p,floor);
      if(floor==='ground') {
        for(const landmark of mapLandmarks){
          const [x,y]=p.project(...centerOf(landmark.bounds));
          drawMapLabel(ctx,x,y-13*dpr,landmark.label,12*dpr);
        }
      } else if(floor==='b1'||floor==='cabin'||floor==='deck'||floor==='sun') {
        const [x,y]=p.project(...centerOf(layerBounds(floor)));
        drawMapLabel(ctx,x,y-18*dpr,floor==='b1'?'B1 实验室':floorNames[floor],12*dpr);
      }
      drawContacts(ctx,p,floor,map,discovered,consumed);
      for(const exit of renderedExits())drawExit(ctx,p,exit,status(exit).kind,selectedExit===exit);
      drawMarker(ctx,p,floor);
      if(mapFloor(feet)===floor)drawPlayerMark(ctx,...p.project(feet[0],feet[2]),yaw);
      const meters=[100,50,20,10,5,2,1].find(val=>val*p.scale/dpr<=95)??1;
      scaleBar.style.setProperty('--scale-width',meters*p.scale/dpr+'px');
      scaleBar.textContent=meters+' m';
      left.textContent='X '+Math.round(feet[0])+' · Z '+Math.round(feet[2]);
      panel.dataset.zoom=zoom.toFixed(2);
      panel.dataset.center=center.map(n=>n.toFixed(2)).join(',');
      clearMarker.disabled=!marker;
      markerText.textContent=marker?'路标 '+Math.round(Math.hypot(feet[0]-marker.point[0],feet[2]-marker.point[1]))+' m · '+floorNames[marker.floor]:'';
      updateExitList(status);
    },
  };
}
