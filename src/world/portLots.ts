export type DistrictName = 'harbor' | 'logistics' | 'industrial' | 'research' | 'residential';
export type Fixture = 'counter' | 'rack' | 'packing' | 'files' | 'bench' | 'pump' | 'switchboard' |
  'wash' | 'lockers' | 'break' | 'kitchen' | 'bunks' | 'laundry' | 'testing' | 'dispatch' | 'seating';
export type Roof = 'flat' | 'gable' | 'monitor' | 'sawtooth' | 'stepped';
export type Side = 'north' | 'east' | 'south' | 'west';
export type Yard = 'landing' | 'turning' | 'garden' | 'queue' | 'drainage';
type Rooms = readonly [Fixture, Fixture, Fixture];
type Site = readonly [id:number, x:number, z:number, width:number, depth:number, district:DistrictName, name:string];
type Building = readonly [roof:Roof, entry:Side, grid:string, rooms:Rooms];
type Lot = readonly [...Site, use:Building | Yard];

// Each row clears one surveyed street-building envelope. The nine plan cells
// are read north to south. A–C identify separately furnished rooms and dots are open air.
export const streetLots = [
  [0,-18,82,12,11,'logistics','货运司机休息所',['stepped','south','aaa.bc.bc',['seating','bunks','break']]],
  [1,-38,80,16,10,'logistics','空托盘回收场','turning'],
  [2,-18,61,14,14,'logistics','卸货签收所',['gable','south','bbbac.aaa',['counter','packing','files']]],
  [3,-22,41,19,11,'logistics','包裹复核间',['monitor','west','aabbc.ab.',['packing','testing','dispatch']]],
  [4,18,74,12,10,'logistics','车队交接处',['flat','east','baa.ca...',['dispatch','files','lockers']]],
  [5,38,78,16,14,'logistics','冷机维保间',['sawtooth','north','a..ab.bcc',['bench','pump','switchboard']]],
  [9,-87,132,16,11,'residential','缝补与洗衣间',['gable','east','bba.ca.cc',['counter','laundry','rack']]],
  [10,-132,72,14,10,'harbor','水手接驳候车处','queue'],
  [11,-71,-67,14,14,'harbor','码头防护用品库',['stepped','south','abcabb.a.',['counter','lockers','rack']]],
  [12,-77,-87,19,11,'harbor','吊索巡查工棚',['sawtooth','south','bbcabaaa.',['bench','rack','wash']]],
  [13,-44,-82,12,10,'logistics','计价与封签办公室',['flat','south','.bbac..a.',['counter','files','packing']]],
  [14,-40,-105,16,14,'research','访客证件交接处',['monitor','west','aaba.cb.c',['counter','files','seating']]],
  [15,0,-80,14,11,'logistics','搬运调度间',['stepped','east','aaccb..bb',['dispatch','lockers','files']]],
  [16,17,-63,19,10,'logistics','过磅维修场','turning'],
  [17,19,-40,12,14,'logistics','周转件清点室',['monitor','north','aaab.cbcc',['counter','packing','rack']]],
  [18,40,-18,16,11,'logistics','货柜铅封检查站',['gable','west','aabb.b..c',['packing','counter','rack']]],
  [19,75,31,14,10,'industrial','检修清洗间',['stepped','north','aac.bb.bb',['wash','bench','rack']]],
  [20,80,62,19,14,'industrial','设备校验班组房',['monitor','south','b.cbccaaa',['dispatch','testing','switchboard']]],
  [21,103,59,12,11,'industrial','工具领还处',['flat','south','bcca.a...',['counter','lockers','bench']]],
  [22,115,77,16,10,'industrial','厂区轮班前庭','queue'],
  [23,124,56,14,14,'industrial','绝缘工装库',['gable','west','abba.a..c',['counter','rack','lockers']]],
  [24,113,31,19,11,'industrial','传感器标定站',['sawtooth','east','aa.bbccc.',['testing','switchboard','bench']]],
  [25,101,12,12,10,'industrial','电缆端接工作间',['flat','north','aab.b.bc.',['bench','switchboard','rack']]],
  [26,127,11,16,14,'industrial','泵组检修车间',['sawtooth','north','aa.abb.cc',['pump','bench','wash']]],
  [27,201,-56,14,11,'industrial','排水边井前场','drainage'],
  [28,195,-107,19,10,'industrial','外线维护站',['monitor','east','baabb..cc',['dispatch','switchboard','lockers']]],
  [29,161,-122,12,14,'research','野外记录回收室',['gable','south','a..abccbb',['counter','files','packing']]],
  [30,141,-127,16,11,'research','观测器件维修房',['sawtooth','west','bc.abaabb',['bench','testing','lockers']]],
  [31,120,-143,14,10,'research','楼间缓冲庭院','garden'],
  [32,121,-162,19,14,'research','实验器具交接点',['monitor','south','bb.abac.a',['counter','wash','rack']]],
  [33,100,-183,12,11,'research','园区运务值班室',['flat','east','b.aacab..',['dispatch','files','break']]],
  [34,68,-180,16,10,'research','园区班车停靠场','queue'],
  [35,47,-184,14,14,'research','楼宇弱电间',['stepped','east','a.aabbbcc',['dispatch','switchboard','lockers']]],
  [36,22,-188,19,11,'research','北门申报站',['gable','west','abbacc.a.',['counter','files','lockers']]],
  [37,-6,-150,12,10,'research','无线电交接所',['flat','north','ab.abc.cc',['dispatch','switchboard','files']]],
  [38,-17,-173,16,14,'research','地面巡测整备所',['sawtooth','south','bcc.b.aaa',['bench','testing','packing']]],
  [39,-75,-148,14,11,'research','设备清点与发还室',['stepped','south','b.bacaac.',['counter','rack','packing']]],
  [40,-83,-127,19,10,'research','巡测车周转场','turning'],
  [41,14,170,12,14,'residential','公路候车屋',['monitor','north','aabaa.cc.',['seating','files','lockers']]],
  [42,-42,170,16,11,'residential','街坊配餐房',['gable','north','aa.cb.ccb',['counter','kitchen','wash']]],
  [45,188,82,12,11,'residential','自行车停放场','landing'],
  [46,202,40,16,10,'industrial','绝缘测试工棚',['sawtooth','south','b.cbaa.aa',['testing','switchboard','rack']]],
  [47,201,13,14,14,'industrial','东线巡检班房',['stepped','east','baa.baccc',['dispatch','wash','break']]],
] as const satisfies readonly Lot[];

export type StreetLot = typeof streetLots[number];
