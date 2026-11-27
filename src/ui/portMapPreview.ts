import { regularExits } from '../world/raidPlan.ts';
import { servicePosition } from '../world/layout.ts';
import { centerOf, drawMapLabel, drawMapLayer, fitMap, layerBounds, mapLandmarks, mapProjection } from './mapGeometry.ts';

export function renderPortMapPreviews() {
  for(const canvas of document.querySelectorAll<HTMLCanvasElement>('.port-map')){
    const ctx=canvas.getContext('2d')!, bounds=layerBounds('ground');
    const p=mapProjection(centerOf(bounds),canvas.width,canvas.height,fitMap(bounds,canvas.width,canvas.height,23));
    drawMapLayer(ctx,p,'ground',true);
    for(const landmark of mapLandmarks){
      const [x,y]=p.project(...centerOf(landmark.bounds));
      drawMapLabel(ctx,x,y-10,landmark.label,11);
    }
    for(const [x,,z] of [...regularExits.map(exit=>exit.position),servicePosition]){
      const [px,py]=p.project(x,z);
      ctx.lineWidth=2;ctx.strokeStyle='#a8e6cc';ctx.strokeRect(px-4,py-4,8,8);
    }
    drawMapLabel(ctx,canvas.width-25,14,'N ↑',12);
  }
}
