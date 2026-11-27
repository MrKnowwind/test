export const qualities = ['plain', 'military', 'blue', 'purple', 'gold', 'red'] as const;
export type Quality = (typeof qualities)[number];
export const qualityLabels = ['普通','军用','精良','稀有','珍贵','机密'] as const;
export const tagLabels = {
  mechanical:'工业零件', electronics:'电子元件', shipping:'港务货材', research:'科研样品', medical:'医疗物资',
  provisions:'餐饮补给', personal:'生活用品', documents:'文件档案', nautical:'航海仪器', tactical:'军械耗材',
  ammo:'弹药', carry:'背包', weapon:'武器', protection:'防护装备',
} as const;
export type Tag = keyof typeof tagLabels;
export type Section = { id: string; name: string; w: number; h: number };
const colors = ['#91a5aa', '#85ba94', '#79aecf', '#b390cc', '#edbb66', '#ed8081'];
function spec(name: string, w: number, h: number, price: number, tag: Tag, rank: number, stack = 1) {
  return { name, w, h, price, tag, quality: qualities[rank], rank, stack, color: colors[rank] };
}
function goods(name:string, w:number, h:number, price:number, tag:Tag, rank:number, tint:string) {
  return { ...spec(name,w,h,price,tag,rank), art:tint };
}
export const itemSpecs = {
  'pistol-ammo': spec('9mm 弹药', 1, 1, 8, 'ammo', 0, 60),
  'healing-injector': spec('基础治疗针剂',1,2,90,'medical',1),
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
  'shield-white': {...spec('白阶能量护甲',3,2,210,'protection',0),color:'#e5e8e6'},
  'shield-green': {...spec('绿阶能量护甲',3,2,360,'protection',1),color:'#79cf9a'},
  'shield-blue': {...spec('蓝阶能量护甲',3,2,650,'protection',2),color:'#75b9ef'},
  'shield-purple': {...spec('紫阶能量护甲',3,2,1100,'protection',3),color:'#b49af0'},
  'shield-red': {...spec('红阶能量护甲',3,2,1850,'protection',5),color:'#ff777c'},
  'head-scout': spec('工地安全帽',2,2,85,'protection',0),
  'head-survey': spec('矿灯安全帽',2,2,180,'protection',1),
  'shield-cell': spec('护盾充能单元',1,1,36,'medical',1,4),
  'mounting-clamp': goods('快拆管夹',1,1,36,'mechanical',0,'#b8c5ad'),
  'bearing-set': goods('耐盐轴承组',2,1,94,'mechanical',1,'#74a4ab'),
  'ceramic-impeller': goods('陶瓷泵叶',2,2,215,'mechanical',2,'#c9ddd4'),
  'hydraulic-module': goods('液压换向块',2,2,385,'mechanical',3,'#718da3'),
  'alloy-spindle': goods('试制合金主轴',3,1,670,'mechanical',4,'#c8a9e2'),
  'phase-coupler': goods('相位联轴器',2,2,1230,'mechanical',5,'#c97591'),
  'fuse-strip': goods('工业保险丝排',1,1,29,'electronics',0,'#a8c6d5'),
  'signal-relay': goods('光电继电器',1,1,74,'electronics',1,'#a8bfd8'),
  'fiber-module': goods('光纤收发模组',2,1,180,'electronics',2,'#72bea6'),
  'pulse-logger': goods('瞬态脉冲记录仪',2,2,435,'electronics',3,'#9e88c6'),
  'field-processor': goods('野外测控处理器',2,1,720,'electronics',4,'#e2af72'),
  'cargo-straps': goods('货运绑带',1,1,27,'shipping',0,'#d19964'),
  'desiccant-kit': goods('防潮干燥包',1,1,54,'shipping',1,'#9cbdc5'),
  'cargo-transponder': goods('货运识别应答器',2,1,185,'shipping',2,'#65beaf'),
  'reefer-controller': goods('冷箱温控总成',2,2,430,'shipping',3,'#a48ec6'),
  'sealed-waybill': goods('保税舱运单册',2,1,598,'shipping',4,'#e0b076'),
  'field-swabs': goods('封装采样拭子',1,1,49,'research',0,'#a8c7bd'),
  'optical-standard': goods('光学校验片',1,1,135,'research',1,'#8dbacb'),
  'salt-crystals': goods('盐蚀晶体切片',1,2,246,'research',2,'#a7c8e5'),
  'inert-substrate': goods('惰性复合基片',2,1,428,'research',3,'#af92b9'),
  'brine-reference': goods('深海盐度参照瓶',1,2,710,'research',4,'#71c2c2'),
  'spectral-master': goods('绝版光谱标定片',2,2,1420,'research',5,'#d08bae'),
  'gauze-roll': goods('无菌纱布卷',1,1,34,'medical',0,'#d5ded1'),
  'saline-pouch': goods('密封盐水袋',1,2,58,'medical',1,'#89bdda'),
  'trauma-dressing': goods('加压敷料组',2,1,137,'medical',2,'#e47b76'),
  'diagnostic-cartridge': goods('便携诊断匣',2,1,348,'medical',3,'#c690c2'),
  'surgical-optics': goods('手术照明镜组',2,2,685,'medical',4,'#edbba5'),
  'clinic-memory': goods('监护仪加密记录盘',2,1,1180,'medical',5,'#dd7b93'),
  'meal-tin': goods('炖鱼罐头',1,1,30,'provisions',0,'#cfa369'),
  'tea-packet': goods('盐柠茶包',1,1,25,'provisions',0,'#a9c389'),
  'ration-brick': goods('远航口粮块',1,2,55,'provisions',1,'#e5ab6f'),
  'brewer-cartridge': goods('高压冲煮滤匣',2,1,142,'provisions',2,'#b99bcf'),
  'provision-crate': goods('海员节日礼盒',2,2,330,'provisions',3,'#d08e7c'),
  'travel-towel': goods('折叠旅行巾',1,1,26,'personal',0,'#91bfd2'),
  'sewing-roll': goods('随身缝补卷',1,1,44,'personal',0,'#d18f94'),
  'pocket-radio': goods('袖珍收音机',1,1,83,'personal',1,'#89b4ad'),
  'film-camera': goods('便携胶片相机',2,1,184,'personal',2,'#d4ad80'),
  'crew-chronometer': goods('船员纪念怀表',1,1,335,'personal',3,'#e2b55f'),
  'luggage-brooch': goods('首航纪念珐琅章',1,1,570,'personal',4,'#75c1b4'),
  'tally-slip': goods('手写货件签收单',1,1,28,'documents',0,'#b4c6c0'),
  'crew-register': goods('船员值班簿',2,1,69,'documents',1,'#d3ae84'),
  'survey-plates': goods('测绘底图夹',2,1,186,'documents',2,'#80abc5'),
  'insurance-ledger': goods('保全审计底册',2,2,380,'documents',3,'#b08cc4'),
  'first-voyage-log': goods('首航原始航海日志',2,1,740,'documents',4,'#dfac79'),
  'sealed-port-deed': goods('港务馆封存契约',2,2,1330,'documents',5,'#d98290'),
  'navigation-divider': goods('海图分规',1,1,46,'nautical',0,'#c9bc98'),
  'deck-compass': goods('磁针罗盘',1,1,90,'nautical',1,'#89b7b2'),
  'tide-sensor': goods('潮位计探头',2,1,188,'nautical',2,'#51bbb8'),
  'gyro-sight': goods('陀螺观测镜',2,2,412,'nautical',3,'#9a9ecf'),
  'beacon-oscillator': goods('领航信标振荡器',2,1,770,'nautical',4,'#e8ac73'),
  'navigator-keepsake': goods('远洋领航仪原型',2,2,1400,'nautical',5,'#cb8590'),
  'cleaning-kit': goods('枪械清洁包',1,1,38,'tactical',0,'#92a289'),
  'range-earplugs': goods('靶场防噪塞',1,1,47,'tactical',1,'#7da796'),
  'rangefinder-sleeve': goods('测距镜护套',2,1,139,'tactical',2,'#7f9dc2'),
  'range-calibrator': goods('测距校准器',2,2,355,'tactical',3,'#ab8dbd'),
};
export type ItemId = keyof typeof itemSpecs;
export const shields = {
  'shield-white':25, 'shield-green':50, 'shield-blue':75, 'shield-purple':100, 'shield-red':125,
} as const;
export const headDevices = {'head-scout':false,'head-survey':true} as const;
export type ShieldId = keyof typeof shields;
export type HeadId = keyof typeof headDevices;
export type EquipSlot = 'pistol' | 'knife' | 'shield' | 'head';
export type GearSlot = EquipSlot | 'pack' | 'primary1' | 'primary2';
export const isShield = (item:ItemId): item is ShieldId => Object.hasOwn(shields,item);
export const isHead = (item:ItemId): item is HeadId => Object.hasOwn(headDevices,item);
export const shieldCharge = (item:ShieldId,charge?:number) => Math.max(0,Math.min(shields[item],Number.isFinite(charge)?charge!:shields[item]));
export function equipSlot(item:ItemId):EquipSlot|undefined {
  if(item==='pistol'||item==='knife')return item;
  if(isShield(item))return 'shield';
  if(isHead(item))return 'head';
}
export const gearLayout = [
  ['head','头部设备'],['shield','能量护甲'],['pack','背包'],
  ['primary1','主武器 I · 1'],['primary2','主武器 II · 2'],['pistol','副武器 · 3'],['knife','近战 · 4'],
] as const satisfies readonly (readonly [GearSlot,string])[];
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
