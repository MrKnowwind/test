import { roads, footpaths } from '../world/roads.ts';
import { portBlocks } from '../world/portBlocks.ts';
import { freightHalls } from '../world/upperRoutes.ts';
import { districtOffsets, highwayPosition, servicePosition } from '../world/layout.ts';
import { mapBounds, mapViewBounds, dock, lab } from '../world/worldQueries.ts';
import {gangways,harborBuildings,shipEnvelope} from '../world/harborPlan.ts';

export function renderPortMapPreviews() {
  for(const canvas of document.querySelectorAll<HTMLCanvasElement>('.port-map')){
    const c=canvas.getContext('2d')!, size=canvas.width, margin=24, scale=(size-2*margin)/(mapViewBounds.maxX-mapViewBounds.minX);
    const x=(value:number)=>margin+(value-mapViewBounds.minX)*scale;
    const z=(value:number)=>(size-400*scale)/2+(value-mapBounds.minZ)*scale;
    function rect(x1:number,z1:number,x2:number,z2:number,color:string,stroke?:string){
      c.fillStyle=color;c.fillRect(x(x1),z(z1),(x2-x1)*scale,(z2-z1)*scale);
      if(stroke){c.strokeStyle=stroke;c.strokeRect(x(x1),z(z1),(x2-x1)*scale,(z2-z1)*scale);}
    }
    c.fillStyle='#0f242d';c.fillRect(0,0,size,size);
    rect(mapViewBounds.minX,mapBounds.minZ,mapBounds.minX,mapBounds.maxZ,'#184251');
    c.strokeStyle='#315059';c.lineWidth=.7;
    for(let n=0;n<=10;n++){
      const p=margin+n*(size-2*margin)/10;
      c.beginPath();c.moveTo(p,margin);c.lineTo(p,size-margin);c.moveTo(margin,p);c.lineTo(size-margin,p);c.stroke();
    }
    rect(dock.minX,dock.minZ,dock.maxX,dock.maxZ,'#326170','#629f9e');
    rect(lab.minX,lab.minZ,lab.maxX,lab.maxZ,'#564d66','#94839e');
    for(const r of footpaths)rect(r.x1,r.z1,r.x2,r.z2,'#3b5055');
    for(const r of roads)rect(r.x1,r.z1,r.x2,r.z2,'#6f8887');
    for(const [px,pz,w,d] of [...portBlocks,...freightHalls])rect(px-w/2,pz-d/2,px+w/2,pz+d/2,'#adc0b7','#d2ddd72e');
    for(const r of harborBuildings)rect(r.minX,r.minZ,r.maxX,r.maxZ,'#5c9b9b','#c7dfd8');
    for(const r of gangways)rect(r.minX,r.minZ,r.maxX,r.maxZ,'#91c8c2');
    rect(shipEnvelope.minX,shipEnvelope.minZ,shipEnvelope.maxX,shipEnvelope.maxZ,'#d0e0d9','#71caca');
    c.font='bold 12px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
    for(const [name,px,pz] of [['码头',-135,-5],['仓储',0,0],['处理厂',districtOffsets.plant[0]+42,-42],['研究区',40,-147],['公路',-40,155]] as const){
      c.fillStyle='#12232be8';c.fillRect(x(px)-27,z(pz)-10,54,20);
      c.fillStyle='#e5eee7';c.fillText(name,x(px),z(pz));
    }
    for(const [px,,pz] of [highwayPosition,servicePosition,[15.4,-5.4,-155]]){
      c.strokeStyle='#a7e6c5';c.lineWidth=2;c.strokeRect(x(px)-4,z(pz)-4,8,8);
    }
    c.fillStyle='#c6e0db';c.font='bold 12px monospace';c.fillText('N ↑',size-margin-14,13);
    c.strokeStyle='#618286';c.lineWidth=1;c.strokeRect(margin,margin,size-2*margin,size-2*margin);
  }
}
