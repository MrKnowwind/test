import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(process.argv[2] ?? 'dist');
const output = path.resolve(process.argv[3] ?? 'test-results/field-pass');
const cases = new Set((process.argv[4] ?? 'districts,bags,movement,exits,service,routes,controls').split(','));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 896, height: 504 }, deviceScaleFactor: 1 });
const errors = [], report = {};
page.on('pageerror', e => errors.push(e.message));
await page.route('http://127.0.0.1:4173/**', async route => {
  const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
  await route.fulfill({ body: await readFile(path.join(root,file)),
    contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
});
// Drive the production animation loop at 60 Hz. Render every frame used as evidence;
// stepping between captures skips rasterization to avoid timing bias on software WebGL.
await page.addInitScript(() => {
  const liveUI = new URL(location.href).searchParams.has('liveUI');
  const nativeFrame = window.requestAnimationFrame.bind(window);
  let queue = new Map(), id = 0, time;
  if (!liveUI) window.requestAnimationFrame = callback => { queue.set(++id,callback); return id; };
  if (!liveUI) window.cancelAnimationFrame = key => queue.delete(key);
  let painting = true;
  for (const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
    const draw = WebGL2RenderingContext.prototype[key];
    WebGL2RenderingContext.prototype[key] = function(...args) { if (painting) return draw.apply(this,args); };
  }
  window.advanceRaid = (count, paint) => {
    if (liveUI) {
      painting = paint;
      return new Promise(resolve => {
        let left = Math.max(3,count);
        const next = () => --left ? nativeFrame(next) : resolve();
        nativeFrame(next);
      });
    }
    time ??= performance.now();
    for(let i=0;i<count;i++) {
      painting = paint && i===count-1;
      const frame = queue; queue = new Map(); time += 1000/60;
      for(const cb of frame.values()) cb(time);
    }
    painting = true;
  };
});
const tick = (n=2, paint=false) => page.evaluate(([n,paint]) => window.advanceRaid(n,paint),[n,paint]);
const state = () => page.evaluate(() => {
  const {feet,stance,climb,eye,countdown,result,flags,weapon,locked,backpack,items,spawn} = window.raidQA.state();
  return {feet,stance,climb,eye,countdown,result,flags,weapon,locked,backpack,items,spawn};
});
const pose = (feet,yaw=0,pitch=0) => page.evaluate(([p,y,t]) => window.raidQA.pose(p,y,t),[feet,yaw,pitch]);
const press = async key => { await page.keyboard.press(key); await tick(); };
const click = selector => page.locator(selector).click({force:true});
const capture = async (name, quality=80) => {
  await tick(1,true);
  await page.screenshot({path:path.join(output,name+'.jpg'),quality,timeout:60000});
};
async function start(seed=42, liveUI=false) {
  await page.goto('http://127.0.0.1:4173/?qa=1&seed='+seed+(liveUI?'&liveUI=1':''),{timeout:90000});
  await page.locator('#primary:enabled').waitFor({timeout:90000});
  await page.selectOption('#quality','balanced');await click('#primary');
  await page.waitForFunction(()=>document.pointerLockElement,undefined,{polling:10});
  await tick();
}
async function resume() {
  await click('#primary');await page.waitForFunction(()=>document.pointerLockElement && document.querySelector('#overlay').hidden,undefined,{polling:10});await tick();
}
async function practice() {
  await press('Escape');await click('#creative-toggle');
  if(await page.locator('#creative-flight').isChecked()) await click('#creative-flight');
  await resume();
}
async function closeBag() {
  await page.keyboard.press('Tab');
  try {await page.waitForFunction(()=>document.pointerLockElement,undefined,{polling:15,timeout:2000});}
  catch(error){
    if(await page.locator('#overlay').isVisible()) await resume();
    else {await page.screenshot({path:path.join(output,'bag-return.jpg')}); throw error;}
  }
  await tick();
}
async function districts() {
  await start();await practice();
  const views=[
    ['wharf',[-127,0,26],.85,.12],['warehouse-front',[-4,0,39],0,.12],
    ['warehouse-table',[-9,0,3.2],.52,-.11],['plant',[140.5,0,-10],0,.14],
    ['research',[40.5,0,-120],0,.06],['exit',[-151,0,150],0,-.15],
  ];
  for(const [name,p,y,t] of views){await pose(p,y,t);await tick(12);await capture(name);}
  report.viewpoints=views;
}
async function bags() {
  await start(42,true);await practice();
  report.bags=[];
  for(const [i,pack] of ['none','daypack','repairpack','alpine','longpack'].entries()){
    if(pack!=='none'){
      await pose([-100-i*9,0,155],0,-1.03);
      await press('Escape');
      await page.selectOption('#creative-item',pack); await click('#creative-drop'); await resume();
      await page.waitForFunction(()=>document.querySelector('#prompt').textContent.includes('拾取'),undefined,{polling:25,timeout:5000});
      await press('e');await page.getByRole('button',{name:'装备此包'}).click({force:true,timeout:5000});
      const confirm=page.getByRole('button',{name:'确认装备'});
      if(await confirm.isVisible())await confirm.click({force:true});
    }else await press('Tab');
    await page.locator('#backpack-panel:not([hidden])').waitFor({timeout:4000});
    for(const [w,h] of [[1280,720],[1920,1080]]){
      await page.setViewportSize({width:w,height:h});await tick(1);
      const rect=await page.evaluate(()=>{
        const box=el=>{const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom].map(Math.round);};
        return {grids:Object.fromEntries([...document.querySelectorAll('#carry-grids .section-grid')].map(g=>[g.dataset.section,box(g)])),
          discard:box(document.querySelector('#drop-zone')),source:box(document.querySelector('.bag-container'))};
      });
      const g=rect.grids;
      assert.equal(Object.keys(g).length,({none:3,daypack:4,repairpack:5,alpine:7,longpack:6})[pack],JSON.stringify({pack,w,rect}));
      for(const r of Object.values(g)){assert.ok(r[0]>=0 && r[1]>=0 && r[2]<=rect.discard[0] && r[3]<=h,JSON.stringify({pack,w,rect}));}
      if(g.side)assert.ok(g.side[0]>=g.main[2]);
      if(g.l)assert.ok(g.l[2]<=g.main[0] && g.r[0]>=g.main[2]);
      if(g.top)assert.ok(g.top[3]<=g.main[1] && Math.abs(g.top[0]-g.main[0])<=1);
      if(pack==='alpine' || pack==='longpack')await capture('bag-'+pack+'-'+w);
      report.bags.push({pack,w,h,rect});
    }
    await closeBag();
    await page.setViewportSize({width:896,height:504});
  }
}
async function movement() {
  await start();await practice();
  const frames=path.join(output,'motion');await mkdir(frames,{recursive:true});
  let index=0;report.motion=[];
  const record=async n=>{for(let i=0;i<n;i++){await tick(3);await capture('motion/'+String(index++).padStart(3,'0'),77);
    const s=await state();report.motion.push({i:index-1,stance:s.stance,h:s.eye[1]-s.feet[1],p:s.climb?.progress,feet:s.feet});}};
  await pose([-11.1,0,1.70],0,-.07);await record(2);await press('x');await record(4);
  await page.keyboard.down('w');await record(23);await page.keyboard.up('w');
  await press('x');await record(2);
  await page.keyboard.down('w');await record(6);await page.keyboard.up('w');await record(3);
  assert.equal((await state()).stance,'stand');
  await pose([-4,0,19],0,-.04);await page.keyboard.down('Shift');await page.keyboard.down('w');await record(5);
  await press('x');await record(10);await page.keyboard.up('Shift');await page.keyboard.up('w');await record(3);
  await pose([-38,0,123.85],0,-.12);await record(2);await press('Space');await record(2);
  await press('Space');await record(12);
  assert.ok(report.motion.some(s=>s.stance==='slide'));assert.ok(report.motion.some(s=>s.stance==='climb'));
}
async function exits() {
  await start();await pose([-151,0,145]);await tick(72);
  assert.ok((await state()).countdown.remaining<4);await pose([-146,0,145]);await tick();assert.ok(!(await state()).countdown);
  await pose([189,0,-90]);await tick();assert.ok(!(await state()).countdown);
  await pose([15.4,-5.4,-155]);await tick();assert.ok(!(await state()).countdown);
  await pose([16,-5.4,-166.7],0,-.16);await press('e');assert.ok((await state()).flags.includes('lab-power'));
  await pose([15.4,0,-155]);await tick(730);assert.ok(!(await state()).result && !(await state()).countdown);
  await pose([16,-5.4,-166.7],0,-.16);await press('e');await pose([15.4,-5.4,-155]);
  await tick(360);await capture('lift-countdown');await tick(370);assert.equal((await state()).result?.exitId,'lab-lift');
  report.exits='Automatic road entry and exit, missing card, locked lift, wrong-floor departure, recall and successful B1 extraction.';
}
async function service() {
  await start();
  await pose([-9,0,14.5],0,-.32);await tick();await press('e');await tick(300);
  const card=page.locator('.source-item.revealed').filter({has:page.locator('[alt="维修卡"]')});
  const item=page.getByRole('button',{name:'维修卡',exact:true});
  if(await item.count())await item.click({modifiers:['Shift'],force:true});
  else await card.click({modifiers:['Shift'],force:true,timeout:2500});
  await closeBag();assert.equal((await state()).items['service-card'],1);
  await pose([189,0,-90]);await tick(24);assert.ok((await state()).countdown);
  await press('Tab');
  const entry=(await state()).backpack.find(x=>x.item==='service-card');
  await page.locator('[data-entry="'+entry.id+'"]').click({force:true});
  await press('Delete');await tick(2);assert.ok(!(await state()).countdown);
  await closeBag();await pose([189,0,-90],0,-1.06);await tick();await press('e');
  assert.equal((await state()).items['service-card'],1);
  await tick(310);const result=(await state()).result;
  assert.equal(result.exitId,'service-passage');
  assert.equal(result.items['service-card'],1);
  report.service='Carried card was searched, quick-transferred, dropped during countdown, recovered, then extracted.';
}
async function controls() {
  await start(42); await practice();
  await pose([-4,0,20]);
  await page.mouse.down({button:'right'}); await tick(22);
  assert.ok((await state()).weapon.aiming); await page.mouse.up({button:'right'}); await tick(8);
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await tick(14); await press('x');
  assert.equal((await state()).stance,'slide');
  const loaded=(await state()).weapon.loaded;
  await page.mouse.click(448,252); await press('r'); await press('Tab');
  assert.ok(await page.locator('#backpack-panel').isHidden());
  assert.equal((await state()).weapon.loaded,loaded); assert.equal((await state()).weapon.action,'ready');
  await page.keyboard.up('Shift'); await page.keyboard.up('w'); await press('Escape');
  await page.locator('#overlay:not([hidden]) #primary:visible').waitFor({timeout:4000});
  assert.notEqual((await state()).stance,'slide'); await resume();
  await press('Digit4'); assert.equal((await state()).weapon.id,'knife',JSON.stringify(await state()));
  await press('Digit3'); assert.equal((await state()).weapon.id,'pistol');
  await pose([-110,0,155]); // clear air above the public road
  await press('Escape'); await page.locator('#creative-flight:visible').check(); await page.selectOption('#quality','high'); await resume();
  const y=(await state()).feet[1]; await page.keyboard.down('Space'); await tick(20); await page.keyboard.up('Space');
  assert.ok((await state()).feet[1]>y+1.1,JSON.stringify({y,after:await state()})); await press('x'); assert.equal((await state()).stance,'stand');
  await tick(1,true);
  report.controls='ADS, slide blocks fire/reload/bag, pause interrupts movement, pistol/knife switching and creative flight at High.';
}
async function routes() {
  report.routes = [];
  const paths = [
    {seed:2, spawn:'south-loading', name:'南侧外围至公路', points:[[-24,155],[-151,155],[-151,145]]},
    {seed:0, spawn:'warehouse-alley', name:'东侧至仓储卡位和维修口', points:[[149,95],[-4,95],[-4,18],[-10,18],[-10,15],[-9,14],[-10,15],[-10,18],[-4,18],[-4,95],[175,95],[175,-90],[189,-90]]},
    {seed:5, spawn:'scrap-shelter', name:'西侧码头经仓储至厂区平台', points:[[-129,24],[-129,27],[-120,27],[-4,27],[-4,15],[-4,27],[-4,95],[149,95],[149,-16],[140.5,-16],[140.5,-34]]},
    {seed:32, start:[40.5,0,-130], name:'研究坡道至样本柜、配电柜和货梯', points:[[40.5,-159],[27.2,-159],[27.2,-167.4],[27.2,-159],[16,-159],[16,-167.6],[16,-159],[15.4,-155]]},
  ];
  for (const route of paths) {
    await start(route.seed);
    await practice();
    if (route.start) await pose(route.start);
    else assert.equal((await state()).spawn.id,route.spawn);
    let ticks = 0;
    for (const [x,z] of route.points) {
      const { feet } = await state();
      await pose(feet,Math.atan2(feet[0]-x,feet[2]-z)); // turn in place
      await page.keyboard.down('Shift'); await page.keyboard.down('w');
      const frames = Math.round(Math.hypot(feet[0]-x,feet[2]-z)*60/6.25);
      await tick(frames); ticks += frames;
      await page.keyboard.up('w'); await page.keyboard.up('Shift');
      const end = (await state()).feet;
      assert.ok(Math.hypot(end[0]-x,end[2]-z)<.2,JSON.stringify({route:route.name,target:[x,z],end}));
    }
    report.routes.push({seed:route.seed,route:route.name,seconds:ticks/60,end:(await state()).feet});
    if(route.seed===2) {
      await tick(310);assert.equal((await state()).result?.exitId,'highway');
    }
  }
}
try {
  for(const [name,fn] of Object.entries({districts,bags,movement,exits,service,routes,controls})){
    if(cases.has(name)){await fn();console.log(name+' passed');}
  }
  assert.deepEqual(errors,[]);
} finally {await writeFile(path.join(output,'report-'+[...cases].join('-')+'.json'),JSON.stringify({errors,...report}));await browser.close();}
