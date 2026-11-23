export const qualities = ['plain', 'military', 'blue', 'purple', 'gold', 'red'] as const;
export type Quality = (typeof qualities)[number];
export type Tag =
  'mechanical' | 'electronics' | 'shipping' | 'research' | 'medical' | 'ammo' | 'carry' | 'weapon';
export type Section = { id: string; name: string; w: number; h: number };
const colors = ['#91a5aa', '#85ba94', '#79aecf', '#b390cc', '#edbb66', '#ed8081'];
function spec(name: string, w: number, h: number, price: number, tag: Tag, rank: number, stack = 1) {
  return { name, w, h, price, tag, quality: qualities[rank], rank, stack, color: colors[rank] };
}
export const itemSpecs = {
  'pistol-ammo': spec('9mm 弹药', 1, 1, 8, 'ammo', 0, 60),
  medkit: spec('急救包', 2, 2, 75, 'medical', 1),
  'service-card': spec('维修卡', 1, 1, 40, 'shipping', 0),
  salvage: spec('工业零件', 2, 2, 140, 'mechanical', 2),
  'research-sample': spec('研究样本', 1, 2, 900, 'research', 4),
  coil: spec('铜线圈', 2, 1, 70, 'mechanical', 0),
  seals: spec('密封圈套件', 1, 1, 55, 'mechanical', 1),
  valve: spec('精密阀芯', 2, 1, 165, 'mechanical', 2),
  turbine: spec('涡轮叶轮', 3, 2, 420, 'mechanical', 3),
  terminal: spec('端子排', 1, 1, 32, 'electronics', 0),
  board: spec('控制器扩展板', 2, 1, 175, 'electronics', 2),
  servo: spec('密封伺服驱动器', 2, 2, 340, 'electronics', 3),
  core: spec('抗蚀逻辑核心', 2, 1, 1600, 'electronics', 5),
  sealbag: spec('铅封袋', 1, 1, 32, 'shipping', 0),
  manual: spec('港区操作手册', 2, 2, 105, 'shipping', 1),
  lens: spec('航标透镜', 2, 2, 360, 'shipping', 3),
  recorder: spec('船舶测绘记录仪', 4, 2, 980, 'shipping', 4),
  tray: spec('无菌取样盘', 2, 1, 90, 'research', 0),
  calibration: spec('冷链校准模块', 2, 2, 420, 'research', 3),
  spectrum: spec('低温光谱盒', 3, 2, 760, 'research', 4),
  archive: spec('生物档案原盘', 2, 2, 1800, 'research', 5),
  pump: spec('泵组壳体', 4, 3, 490, 'mechanical', 2),
  rail: spec('装卸导轨', 7, 2, 1170, 'shipping', 2),
  wrench: spec('长柄校准扳手', 4, 1, 150, 'mechanical', 1),
  gauge: spec('计量仪表', 2, 2, 115, 'electronics', 1),
  sling: spec('巡检挎包', 2, 2, 65, 'carry', 0),
  daypack: spec('基础小包', 2, 2, 80, 'carry', 0),
  repairpack: spec('分格维修包', 3, 2, 115, 'carry', 1),
  tube: spec('长舱运输包', 3, 2, 120, 'carry', 1),
  school: spec('书包', 3, 2, 155, 'carry', 2),
  alpine: spec('登山包', 3, 3, 260, 'carry', 3),
  longpack: spec('长条包', 4, 2, 285, 'carry', 3),
  pistol: spec('港卫 P8', 2, 2, 150, 'weapon', 1),
  knife: spec('战术刀', 2, 1, 60, 'weapon', 0),
};
export type ItemId = keyof typeof itemSpecs;
export const pockets: Section[] = [
  { id: 'left', name: '左随身袋', w: 2, h: 2 },
  { id: 'center', name: '前随身袋', w: 3, h: 2 },
  { id: 'right', name: '右随身袋', w: 2, h: 2 },
];
const section = (id: string, name: string, w: number, h: number): Section => ({ id, name, w, h });
const main = (w: number, h: number) => section('main', '主仓', w, h);
const small = section('side', '副袋', 2, 2);
export const packs = {
  sling: [main(3, 2), small],
  daypack: [main(4, 4)],
  repairpack: [main(4, 3), small],
  tube: [main(6, 2), small],
  school: [main(6, 5)],
  alpine: [
    main(6, 6),
    section('l', '左侧袋', 2, 3),
    section('r', '右侧袋', 2, 3),
    section('top', '顶袋', 6, 1),
  ],
  longpack: [main(6, 8), section('l', '左上袋', 2, 2), section('r', '右上袋', 2, 2)],
};
export type PackId = keyof typeof packs;
export function isPack(item: ItemId): item is PackId {
  return Object.hasOwn(packs, item);
}
export const searchSeconds = [0.64, 1.02, 1.42, 1.92, 2.5, 3.2];
