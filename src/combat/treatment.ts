import type { createBackpack } from '../raid/backpack.ts';
export type TreatmentPose = {item:'medkit'|'healing-injector';elapsed:number;progress:number;preview:boolean};
export function createTreatment(pack: ReturnType<typeof createBackpack>) {
  let active: { id: number; elapsed: number; ticks: number; duration: number; item:TreatmentPose['item'];preview:boolean } | undefined;
  const available = () => pack.entries.filter((e) => e.item === 'medkit' || e.item === 'healing-injector');
  return {
    available,
    get pose():TreatmentPose|undefined{
      return active && {item:active.item,elapsed:active.elapsed,progress:active.elapsed/active.duration,preview:active.preview};
    },
    get remaining() {
      return active ? active.duration - active.elapsed : 0;
    },
    start(id: number, health: number, allowPreview=false) {
      const entry = available().find((e) => e.id === id);
      if (active || health <= 0 || (health >= 100 && !allowPreview) || !entry) return false;
      active = {
        id,
        elapsed: 0,
        ticks: 0,
        item:entry.item==='medkit'?'medkit':'healing-injector',preview:allowPreview && health>=100,
        duration: entry.item === 'medkit' ? 2.5 : Math.min(3, entry.durability ?? 3),
      };
      return true;
    },
    cancel() {
      active = undefined;
    },
    advance(dt: number, damaged: boolean, health: number) {
      if (!active) return 0;
      const entry = available().find((e) => e.id === active?.id);
      if (!entry || health <= 0 || (health >= 100 && !active.preview) || (damaged && entry.item === 'medkit')) {
        active = undefined;
        return 0;
      }
      active.elapsed += dt;
      if(active.preview){
        if(active.elapsed+1e-8>=active.duration)active=undefined;
        return 0;
      }
      if (entry.item === 'medkit') {
        if (active.elapsed + 1e-8 < active.duration) return 0;
        pack.remove(entry.id);
        active = undefined;
        return Math.min(40, 100 - health);
      }
      const charges = Math.min(
        Math.floor(active.elapsed + 1e-8) - active.ticks,
        entry.durability ?? 3,
        Math.ceil((100 - health) / 10),
      );
      active.ticks += charges;
      entry.durability = (entry.durability ?? 3) - charges;
      if (!entry.durability) pack.remove(entry.id);
      const restored = Math.min(100 - health, charges * 10);
      if (!entry.durability || health + restored >= 100 || active.elapsed >= active.duration)
        active = undefined;
      return restored;
    },
  };
}
