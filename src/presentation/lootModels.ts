import * as THREE from 'three';
import { box, cylinder, mesh, strut } from '../world/detail/geometry.ts';
import { enamel } from '../world/detail/materialLibrary.ts';
import { itemSpecs, isPack, isShield, isHead, type ItemId, type PackId } from '../raid/catalog.ts';
import { makeGearModel } from './gearModels.ts';
import { makePistol, makeKnife } from './viewmodelModels.ts';
import { styleCharacter } from './celShading.ts';

// Models use metres, +Y up, and the same principal colours and fittings as itemArt/lootArt.
// The reusable primitives are components, not a generic fallback model.
const paints = new Map<THREE.ColorRepresentation, THREE.Material>();
function paint(color: THREE.ColorRepresentation) {
  let value = paints.get(color);
  if (!value) { value = enamel(color); paints.set(color, value); }
  return value;
}
const ink=paint(0x26394b), metal=paint(0xa9c6ca), pale=paint(0xe9f0df), brass=paint(0xe6a65a), glass=paint(0x64bec7), red=paint(0xe76f68);
const torus=new THREE.TorusGeometry(1,.19,6,18), sphere=new THREE.SphereGeometry(1,12,8);
const prototypes=new Map<ItemId,THREE.Group>();
const packLooks: Record<PackId,readonly [number,number,number,number]> = {
  sling:[.44,.25,.18,0x469f94],daypack:[.35,.43,.23,0x6799ac],repairpack:[.51,.32,.27,0xd4904e],
  tube:[.30,.60,.30,0x849d75],school:[.40,.49,.25,0xc46c63],alpine:[.41,.66,.30,0x9475ac],longpack:[.34,.76,.25,0x546c88],
};
function pack(root:THREE.Group,id:PackId){
  const [w,h,d,color]=packLooks[id], fabric=paint(color);
  if(id==='tube'){
    cylinder(root,fabric,d/2,h,0,d*.52,0,16).rotation.z=Math.PI/2;
    for(const x of [-.24,.24])cylinder(root,ink,d*.52,.035,x,d*.52,0,16).rotation.z=Math.PI/2;
    box(root,metal,.13,.03,.08,0,d+.015,0,.01);return;
  }
  box(root,fabric,w,h,d,0,h/2,0,Math.min(h*.22,.09));
  function pocket(x:number,y:number,width:number,height:number){
    box(root,fabric,width,height,.095,x,y,d/2,.027);
    box(root,ink,width*.86,.016,.014,x,y+height*.26,d/2+.049,.004);
    box(root,metal,.026,.023,.013,x+width*.24,y+height*.26,d/2+.056,.004);
  }
  for(const side of [-1,1]){
    box(root,ink,.034,h*.77,.035,side*w*.29,h*.51,-d/2,.012);
    box(root,ink,.023,.068,.04,side*.065,h,-.018,.008);
  }
  box(root,ink,.15,.024,.042,0,h+.034,-.018,.01);
  if(id==='repairpack'){
    for(const x of [-.155,0,.155])pocket(x,h*.47,.125,.18);
    box(root,ink,w*.94,.055,d+.025,0,.03,0,.012);
  }else if(id==='alpine'){
    for(const x of [-1,1])box(root,fabric,.112,.31,.20,x*w*.52,.19,0,.04);
    box(root,ink,w*.99,.118,d*1.08,0,h*.92,.011,.045);pocket(0,h*.46,w*.65,.30);
  }else if(id==='longpack'){
    for(const y of [.21,.51])box(root,ink,w*1.04,.035,d*1.04,0,y,0,.009);
    for(const x of [-.09,.09])box(root,metal,.022,.54,.018,x,.41,d/2,.008);
  }else{
    pocket(0,h*.35,w*.76,h*.46);
    if(id!=='daypack')box(root,ink,w*.89,h*.26,.084,0,h*.74,d/2,.025);
    if(id==='school')for(const x of [-.09,.09])box(root,metal,.038,.044,.025,x,h*.66,d/2+.047,.009);
  }
}

function build(id:ItemId){
  const root=new THREE.Group();
  const spec=itemSpecs[id], tint=paint('art' in spec?spec.art:spec.color);
  const b=(w:number,h:number,d:number,x=0,y=h/2,z=0,m=tint,bevel=.012)=>box(root,m,w,h,d,x,y,z,Math.min(bevel,w*.2,h*.2,d*.2));
  const c=(r:number,h:number,x=0,y=h/2,z=0,m=tint,sides=16)=>cylinder(root,m,r,h,x,y,z,sides);
  const ring=(r:number,x=0,y=r*.19,z=0,m=metal)=>{const o=mesh(root,torus,m,x,y,z);o.scale.set(r,r,r);o.rotation.x=-Math.PI/2;return o;};
  const bar=(r:number,length:number,x=0,y=r,z=0,m=metal)=>{const o=c(r,length,x,y,z,m);o.rotation.z=Math.PI/2;return o;};
  const ball=(w:number,h:number,d:number,x:number,y:number,z:number,m=tint)=>{const o=mesh(root,sphere,m,x,y,z);o.scale.set(w,h,d);return o;};
  const line=(x1:number,z1:number,x2:number,z2:number,y:number,w:number,m=metal)=>strut(root,m,new THREE.Vector3(x1,y,z1),new THREE.Vector3(x2,y,z2),w,w);
  const label=(w:number,d:number,y:number,x=0,z=0,m=pale)=>b(w,.003,d,x,y,z,m,0);
  const screws=(w:number,d:number,y:number)=>{for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])c(.009,.005,x,y,z,metal,8);};
  const screen=(w:number,d:number,y:number,x=0,z=0)=>{b(w,.009,d,x,y,z,ink);label(w*.76,d*.58,y+.006,x,z,glass);};
  const booklet=(w:number,d:number,h:number,m=tint)=>{b(w*.94,h,d*.94,0,h/2,0,pale);b(w,.009,d,0,h+.005,0,m);b(.018,h+.012,d,-w*.46,(h+.012)/2,0,m);};
  const packet=(w:number,d:number,h:number,m=tint)=>{b(w,h,d,0,h/2,0,m,.025);for(const z of [-d*.43,d*.43])b(w*.9,.008,.021,0,h+.004,z,metal);label(w*.58,d*.47,h+.006);};
  const device=(w:number,d:number,h:number,m=tint)=>{b(w,h,d,0,h/2,0,ink);b(w*.96,.027,d*.94,0,h+.009,0,m);screws(w*.76,d*.72,h+.025);};
  const vial=(r:number,h:number,m=tint)=>{c(r,h,0,h/2,0,m);c(r*1.04,.035,0,h+.016,0,ink);c(r*1.06,.022,0,.011,0,metal);b(.026,h*.65,.006,0,h*.52,r*.99,pale);};
  const cross=(y:number,size=.085)=>{b(size,.006,size*.29,0,y,0,pale);b(size*.29,.007,size,0,y+.001,0,pale);};
  const fins=(n:number,r:number,m=metal)=>{c(r*.35,.06,0,.03,0,ink);for(let i=0;i<n;i++){const a=i*Math.PI*2/n;const blade=b(r*.63,.035,r*.33,Math.cos(a)*r*.63,.02,Math.sin(a)*r*.63,m);blade.rotation.y=-a+.45;}c(r*.23,.025,0,.065,0,brass);};
  if(isPack(id)){pack(root,id);return root;}
  if(isShield(id)||isHead(id)||id==='shield-cell'){
    const g=makeGearModel(id);root.add(g);if(isShield(id)||id==='shield-cell')g.rotation.x=-Math.PI/2;return root;
  }
  if(id==='pistol'){
    const model=new THREE.Group(), p=makePistol(model);p.right.root.removeFromParent();p.left.root.removeFromParent();p.flash.removeFromParent();styleCharacter(model);model.rotation.z=Math.PI/2;root.add(model);return root;
  }
  if(id==='knife'){
    const k=makeKnife(root);k.right.wrist.parent?.removeFromParent();styleCharacter(root);return root;
  }
  switch(id){
    case 'pistol-ammo': b(.24,.064,.15,0,.032,0,paint(0xd88a49));label(.17,.095,.066,0,0,ink);for(const x of [-.08,0,.08])b(.035,.012,.045,x,.073,0,brass);break;
    case 'medkit': b(.31,.14,.22,0,.07,0,paint(0xff8b77),.035);b(.30,.018,.21,0,.112,0,paint(0xb7485d));cross(.145);for(const x of [-.12,.12])b(.035,.013,.21,x,.15,0,ink);b(.12,.035,.023,0,.167,-.09,metal);break;
    case 'healing-injector': bar(.035,.18,0,.04,0,glass);bar(.042,.045,.098,.043,0,ink);bar(.022,.075,-.11,.034,0,metal);b(.08,.012,.024,0,.077,0,pale);break;
    case 'service-card': b(.16,.009,.10,0,.0045,0,paint(0x89cfeb));label(.15,.018,.011,0,-.033,ink);label(.037,.037,.011,-.043,.012,brass);label(.05,.008,.011,.035,.012);break;
    case 'salvage': b(.19,.13,.26,0,.065,0,metal);for(const x of [-.08,0,.08])b(.025,.14,.27,x,.07,0,ink);for(const z of [-.085,.085])b(.22,.12,.024,0,.06,z,brass);break;
    case 'research-sample': vial(.063,.23,paint(0x9359ce));break;
    case 'coil': bar(.062,.22,0,.065,0,paint(0x9e543a));for(let i=0;i<9;i++)bar(.067,.011,-.08+i*.02,.069,0,brass);for(const x of [-.12,.12])bar(.084,.018,x,.084,0,metal);break;
    case 'seals': for(const [x,z,r] of [[-.052,-.025,.062],[.063,.025,.053],[-.05,.07,.038]])ring(r,x,r*.19,z,paint(0x729b93));break;
    case 'valve': bar(.035,.25,0,.055);for(const x of [-.073,.06])bar(.06,.029,x,.062,0,brass);bar(.042,.035,.126,.049,0,metal);break;
    case 'turbine': ring(.16,0,.031,0,ink);fins(8,.15);break;
    case 'terminal': b(.22,.062,.11,0,.031,0,paint(0x49b4ab));for(const x of [-.075,0,.075]){c(.024,.012,x,.068,0,brass);b(.042,.027,.04,x,.031,.061,ink);}break;
    case 'board': b(.23,.013,.15,0,.007,0,paint(0x49b4ab));b(.075,.025,.08,.015,.027,0,ink);for(let i=0;i<7;i++)label(.009,.038,.016,-.084+i*.027,.067,brass);screws(.18,.1,.017);break;
    case 'servo': b(.24,.14,.19,0,.07,0,paint(0x9677bd));c(.074,.038,0,.155,0,metal);c(.040,.045,0,.186,0,ink);c(.019,.025,0,.22,0,brass);break;
    case 'core': device(.19,.17,.064,paint(0x9677bd));b(.083,.025,.065,0,.11,0,red);for(const x of [-.075,.075])for(const z of [-.05,0,.05])b(.034,.013,.018,x,.027,z,brass);break;
    case 'sealbag': packet(.15,.21,.06,paint(0xa6b8a2));b(.034,.014,.047,.05,.075,-.056,red);break;
    case 'manual': booklet(.20,.25,.038,paint(0x44848b));label(.09,.044,.053,0,-.027,brass);break;
    case 'lens': c(.119,.045,0,.023,0,brass);ring(.087,0,.06,0,ink);ball(.076,.025,.076,0,.055,0,paint(0x5697b5));break;
    case 'recorder': device(.34,.18,.12,brass);screen(.17,.10,.16,-.047);c(.033,.021,.12,.154,0,metal);break;
    case 'tray': b(.28,.018,.18,0,.009,0,metal);for(const x of [-.13,.13])b(.02,.045,.18,x,.04,0,metal);for(const z of [-.083,.083])b(.25,.045,.02,0,.04,z,metal);break;
    case 'calibration': device(.22,.23,.13,metal);screen(.14,.071,.168,0,-.045);for(const x of [-.045,.045])c(.023,.014,x,.165,.065,x<0?glass:red);break;
    case 'spectrum': device(.27,.21,.13,ink);for(const [i,col] of [glass,paint(0x9677bd),red].entries())b(.036,.019,.13,-.072+i*.072,.151,0,col);break;
    case 'archive': b(.22,.04,.24,0,.02,0,paint(0x9677bd));c(.086,.012,0,.048,0,metal);c(.033,.015,0,.051,0,ink);label(.09,.025,.05,-.031,.084,red);break;
    case 'pump': b(.31,.10,.27,0,.05,0,paint(0x49b4ab));ring(.11,0,.075,0,metal);c(.06,.08,0,.08,0,ink);bar(.066,.10,.17,.068,0,metal);break;
    case 'rail': b(.67,.045,.14,0,.023,0,metal);for(const z of [-.047,.047])b(.65,.047,.022,0,.066,z,ink);for(const x of [-.27,0,.27])b(.035,.014,.13,x,.008,0,brass);break;
    case 'wrench': b(.32,.032,.048,-.03,.016,0,metal);for(const s of [-1,1]){const jaw=b(.095,.036,.035,.16,.018,s*.043,metal);jaw.rotation.y=s*.46;}b(.16,.012,.025,-.10,.037,0,brass);break;
    case 'gauge': c(.10,.065,0,.035,0,ink);c(.083,.009,0,.071,0,pale);line(-.027,.028,.044,-.032,.079,.009,red);b(.044,.055,.055,0,.028,.12,brass);break;
    case 'mounting-clamp': ring(.084,0,.022,0,tint);for(const x of [-.086,.086]){b(.048,.03,.08,x,.016,.02,metal);c(.017,.012,x,.037,.04,ink);}break;
    case 'bearing-set': for(const x of [-.073,.073]){ring(.067,x,.019,0,tint);ring(.039,x,.02,0,metal);for(let i=0;i<6;i++)ball(.011,.011,.011,x+Math.cos(i*Math.PI/3)*.05,.03,Math.sin(i*Math.PI/3)*.05,ink);}break;
    case 'ceramic-impeller': fins(5,.134,tint);break;
    case 'hydraulic-module': device(.24,.18,.12,tint);for(const x of [-.074,.074])for(const z of [-.042,.042])c(.027,.025,x,.16,z,metal);break;
    case 'alloy-spindle': bar(.037,.34,0,.044,0,tint);for(const x of [-.10,.06,.13])bar(.057,.041,x,.059,0,metal);break;
    case 'phase-coupler': for(const x of [-.073,.073]){bar(.062,.082,x,.067,0,tint);for(const z of [-.056,.056])b(.053,.061,.021,x,.063,z,ink);}bar(.035,.065,0,.067,0,brass);break;
    case 'fuse-strip': b(.23,.026,.11,0,.013,0,ink);for(let i=0;i<4;i++){b(.041,.052,.073,-.075+i*.05,.039,0,tint);for(const z of [-.035,.035])b(.035,.012,.018,-.075+i*.05,.033,z,brass);}break;
    case 'signal-relay': b(.095,.12,.10,0,.06,0,tint);b(.068,.044,.005,0,.073,.052,ink);for(const x of [-.026,0,.026])b(.012,.025,.018,x,.012,.062,brass);break;
    case 'fiber-module': device(.22,.10,.045,tint);for(const z of [-.022,.022])b(.06,.036,.035,-.12,.027,z,metal);label(.06,.05,.075,.036,0,ink);break;
    case 'pulse-logger': device(.17,.23,.077,tint);screen(.106,.098,.117,0,-.034);for(const x of [-.045,0,.045])b(.024,.01,.028,x,.115,.067,metal);break;
    case 'field-processor': b(.23,.043,.17,0,.022,0,tint);b(.12,.017,.10,0,.053,0,ink);for(let i=0;i<8;i++)b(.012,.013,.031,-.091+i*.026,.019,.094,brass);screws(.18,.13,.047);break;
    case 'cargo-straps': ring(.084,0,.019,0,tint);ring(.056,0,.02,0,tint);b(.13,.022,.047,.076,.021,.05,tint);b(.041,.029,.064,.125,.025,.05,metal);break;
    case 'desiccant-kit': packet(.13,.18,.05);break;
    case 'cargo-transponder': device(.20,.13,.055,tint);b(.034,.026,.075,-.114,.035,0,ink);screen(.091,.042,.090);break;
    case 'reefer-controller': device(.24,.22,.10,tint);screen(.16,.075,.139,0,-.045);for(const x of [-.055,0,.055])c(.019,.017,x,.138,.047,metal);break;
    case 'sealed-waybill': booklet(.23,.15,.028,tint);b(.031,.039,.151,.057,.019,0,ink);label(.038,.038,.043,.057,0,red);break;
    case 'field-swabs': packet(.20,.10,.024,tint);for(const z of [-.025,.025]){b(.15,.009,.009,0,.033,z,pale);ball(.016,.009,.013,-.066,.039,z,metal);}break;
    case 'optical-standard': b(.13,.022,.13,0,.011,0,ink);c(.048,.012,0,.028,0,tint);screws(.10,.10,.025);break;
    case 'salt-crystals': for(const [x,z,r,h] of [[-.045,.02,.045,.12],[.04,.03,.034,.075],[.018,-.044,.045,.15]])c(r,h,x,h/2,z,tint,5);break;
    case 'inert-substrate': for(let i=0;i<3;i++)b(.22,.014,.12,(i-1)*.012,.008+i*.019,0,i===1?metal:tint);break;
    case 'brine-reference': vial(.055,.18,tint);break;
    case 'spectral-master': b(.17,.032,.19,0,.016,0,ink);ring(.070,0,.037,0,tint);c(.041,.01,0,.042,0,glass);for(const x of [-.07,.07])b(.022,.022,.16,x,.033,0,metal);break;
    case 'gauze-roll': bar(.047,.12,0,.048,0,tint);bar(.023,.124,0,.048,0,ink);b(.085,.014,.066,.018,.008,.058,pale);break;
    case 'saline-pouch': b(.14,.058,.22,0,.029,0,tint,.026);label(.09,.072,.06,0,.02);b(.025,.023,.039,0,.015,.125,metal);break;
    case 'trauma-dressing': packet(.21,.13,.045);cross(.056,.065);break;
    case 'diagnostic-cartridge': b(.23,.051,.10,0,.026,0,tint);b(.10,.077,.078,.062,.039,0,ink);label(.064,.040,.079,.062,0,metal);b(.05,.026,.064,-.13,.022,0,metal);break;
    case 'surgical-optics': for(const x of [-.062,.062]){bar(.05,.12,x,.058,0,tint).rotation.set(Math.PI/2,0,0);c(.033,.015,x,.108,0,glass);}b(.056,.04,.047,0,.074,0,metal);break;
    case 'clinic-memory': device(.18,.14,.049,tint);screen(.105,.068,.088);for(let i=0;i<5;i++)b(.013,.009,.028,-.055+.027*i,.025,.079,brass);break;
    case 'meal-tin': c(.072,.10,0,.05,0,tint);c(.073,.012,0,.107,0,metal);ring(.025,.006,.116,.016,metal);break;
    case 'tea-packet': packet(.12,.17,.034,tint);label(.049,.05,.042,0,0,paint(0x628d63));break;
    case 'ration-brick': packet(.12,.21,.08,tint);b(.024,.085,.21,-.038,.041,0,brass);break;
    case 'brewer-cartridge': bar(.052,.21,0,.056,0,tint);for(const x of [-.073,0,.073])bar(.057,.016,x,.059,0,metal);break;
    case 'provision-crate': b(.23,.14,.21,0,.07,0,tint);b(.042,.147,.22,0,.074,0,brass);b(.24,.148,.037,0,.074,0,brass);break;
    case 'travel-towel': for(let i=0;i<3;i++)b(.17,.032,.13,i*.008,.016+i*.031,0,tint,.015);b(.16,.006,.018,.015,.098,.038,pale);break;
    case 'sewing-roll': bar(.046,.19,0,.05,0,tint);for(const x of [-.063,.063])bar(.05,.024,x,.05,0,ink);b(.07,.025,.047,0,.098,0,metal);break;
    case 'pocket-radio': b(.12,.14,.065,0,.07,0,tint);b(.038,.025,.005,-.027,.11,.034,ink);for(let i=0;i<4;i++)b(.066,.007,.006,0,.035+i*.014,.035,ink);c(.008,.09,-.044,.182,0,metal);break;
    case 'film-camera': b(.20,.11,.080,0,.055,0,tint);b(.073,.027,.07,0,.122,0,metal);const cameraLens=c(.056,.061,0,.06,.065,ink);cameraLens.rotation.x=Math.PI/2;const cameraGlass=c(.038,.015,0,.06,.103,glass);cameraGlass.rotation.x=Math.PI/2;break;
    case 'crew-chronometer': c(.067,.032,0,.016,0,tint);c(.052,.007,0,.036,0,pale);line(0,0,.024,-.02,.042,.005,ink);ring(.017,0,.023,-.082,brass);break;
    case 'luggage-brooch': c(.066,.014,0,.008,0,tint,6);b(.075,.005,.014,0,.018,.014,brass);b(.034,.005,.036,0,.019,-.009,brass);break;
    case 'tally-slip': b(.16,.005,.10,0,.003,0,tint);for(let i=0;i<4;i++)label(.09,.005,.007,0,-.03+i*.019,ink);break;
    case 'crew-register': booklet(.17,.23,.026);for(const z of [-.07,0,.07])b(.027,.043,.019,-.079,.021,z,ink);label(.09,.065,.04);break;
    case 'survey-plates': booklet(.24,.16,.025);label(.18,.116,.040,0,0,glass);line(-.075,.033,.073,-.026,.043,.005,pale);break;
    case 'insurance-ledger': booklet(.22,.24,.06);b(.026,.067,.242,-.065,.035,0,ink);label(.09,.075,.075,0,0,brass);break;
    case 'first-voyage-log': for(const s of [-1,1]){const page=b(.12,.026,.19,s*.06,.015,0,pale);page.rotation.z=s*.07;for(let i=0;i<4;i++)label(.08,.006,.033,s*.065,-.048+i*.027,ink);}b(.023,.03,.2,0,.015,0,tint);break;
    case 'sealed-port-deed': b(.21,.019,.13,0,.0095,0,pale);for(const x of [-.105,.105])bar(.018,.14,x,.022,0,tint).rotation.set(Math.PI/2,0,0);c(.026,.012,0,.032,.02,red);break;
    case 'navigation-divider': line(0,-.09,-.064,.068,.018,.017,tint);line(0,-.09,.064,.068,.018,.017,tint);c(.026,.027,0,.022,-.085,metal);break;
    case 'deck-compass': b(.14,.057,.14,0,.029,0,tint);c(.056,.012,0,.063,0,ink);line(-.03,.03,.03,-.03,.074,.014,pale);break;
    case 'tide-sensor': bar(.031,.26,0,.038,0,tint);bar(.045,.09,-.074,.046,0,ink);for(const x of [.055,.105])bar(.035,.017,x,.038,0,metal);break;
    case 'gyro-sight': b(.18,.045,.17,0,.023,0,tint);const gyro=ring(.074,0,.12,0,metal);gyro.rotation.x=0;ball(.050,.05,.05,0,.12,0,glass);for(const x of [-.063,.063])b(.025,.12,.045,x,.083,0,ink);break;
    case 'beacon-oscillator': device(.24,.15,.075,tint);c(.019,.05,.075,.13,-.045,metal);screen(.10,.049,.113,-.035);break;
    case 'navigator-keepsake': b(.19,.042,.14,0,.021,0,tint);const compass=ring(.069,0,.12,0,brass);compass.rotation.x=0;ball(.051,.051,.028,0,.12,0,glass);b(.03,.08,.028,0,.079,0,metal);break;
    case 'cleaning-kit': b(.17,.066,.12,0,.033,0,tint);b(.125,.016,.014,0,.072,-.049,ink);for(const x of [-.045,.045])b(.023,.015,.12,x,.076,0,metal);break;
    case 'range-earplugs': b(.135,.035,.09,0,.018,0,ink,.016);for(const x of [-.037,.037]){c(.022,.028,x,.045,0,tint);c(.013,.016,x,.066,0,metal);}break;
    case 'rangefinder-sleeve': bar(.046,.23,0,.049,0,tint);for(const x of [-.080,.079])bar(.052,.025,x,.053,0,ink);b(.10,.018,.02,0,.099,0,metal);break;
    case 'range-calibrator': device(.22,.18,.09,tint);screen(.11,.069,.13,-.039);c(.034,.045,.067,.132,.018,ink);c(.017,.008,.067,.16,.018,glass);break;
    default: { const exhaustive:never=id; throw new Error(`Missing loot model: ${exhaustive}`); }
  }
  return root;
}

// Centre the footprint and ground every pose; geometry/materials remain shared between instances.
export function makeLootModel(id:ItemId):THREE.Group {
  let model=prototypes.get(id);
  if(!model){
    const content=build(id);content.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(content),center=bounds.getCenter(new THREE.Vector3());
    content.position.set(-center.x,-bounds.min.y,-center.z);
    model=new THREE.Group();model.name='loot-model-'+id;model.add(content);
    model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    prototypes.set(id,model);
  }
  return model.clone(true);
}
