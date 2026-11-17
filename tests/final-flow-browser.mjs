import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {createRaid} from '../src/raid/raid.ts';
const dir='test-results/next-pass-flow';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}),report={errors:[],checks:[],routes:[]};
try {
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
 const state=()=>page.evaluate(()=>window.raidQA.state());
 const pose=(feet,yaw=0,pitch=0)=>page.evaluate(p=>window.raidQA.pose(p.feet,p.yaw,p.pitch),{feet,yaw,pitch});
 const enter=async()=>{await page.locator('#primary').click();await page.waitForFunction(()=>window.raidQA.state().locked);};
 const fresh=async(seed=42)=>{await page.goto('http://127.0.0.1:4173/?qa=1&seed='+seed);await page.locator('#primary:not([disabled])').waitFor();await enter();};
 const routeSeeds=new Map();
 const spawns=['south-loading','warehouse-alley','scrap-shelter'].map(id=>({id,position:[0,0,0],yaw:0}));
 for(let seed=0;seed<32;seed++) {const id=createRaid('seed',seed,{spawnPoints:spawns,interactions:[],exits:[]}).spawn.id;if(!routeSeeds.has(id))routeSeeds.set(id,seed);}
 const routes={
  'warehouse-alley':[[149,95],[-151,95],[-151,145]],
  'scrap-shelter':[[-129,24],[-129,27],[-120,27],[-120,95],[-151,95],[-151,145]],
 };
 for(const [id,route] of Object.entries(routes)) {
  await fresh(routeSeeds.get(id));assert.equal((await state()).spawn.id,id);
  const record={spawn:id,seed:routeSeeds.get(id),points:[]};
  for(const [x,z] of route) {
   const feet=(await state()).feet;await pose(feet,Math.atan2(feet[0]-x,feet[2]-z));
   await page.keyboard.down('Shift');await page.keyboard.down('w');
   await page.waitForFunction(({x,z})=>{const p=window.raidQA.state().feet;return Math.hypot(p[0]-x,p[2]-z)<.5;},{x,z},{timeout:60000});
   await page.keyboard.up('w');await page.keyboard.up('Shift');record.points.push((await state()).feet);
  }
  await page.keyboard.press('e');await page.waitForFunction(()=>window.raidQA.state().result?.outcome==='extracted');
  report.routes.push(record);
 }
 report.checks.push('East and wharf spawns: full real movement to highway and successful extraction; only turning uses pose');
 await fresh();report.bundle=await page.locator('script[type=module]').getAttribute('src');
 await pose([15.4,-5.4,-155]);await page.keyboard.press('e');
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('配电'));
 assert.equal((await state()).countdown,undefined);
 await pose([16,-5.4,-166.7],0,-.16);await page.keyboard.press('e');
 await page.waitForFunction(()=>window.raidQA.state().flags.includes('lab-power'));
 await pose([15.4,-5.4,-155]);await page.keyboard.press('e');
 await page.waitForFunction(()=>window.raidQA.state().result?.outcome==='extracted');
 report.checks.push('Relocated lab lift rejects before power, accepts actual physical panel and extracts');
 await fresh();await pose([-9,0,14.5],0,-.32);await page.keyboard.press('e');
 await page.locator('.source-item.revealed').first().waitFor();await page.locator('.source-item.revealed').first().dblclick();
 await page.waitForTimeout(350);await page.locator('#bag-close').click();await page.waitForFunction(()=>window.raidQA.state().locked);
 await pose([189,0,-90]);await page.keyboard.press('e');await page.waitForFunction(()=>!!window.raidQA.state().countdown);
 await page.keyboard.press('Tab');await page.locator('#backpack-panel').waitFor({state:'visible'});
 const card=(await state()).backpack.find(e=>e.item==='service-card');await page.locator('[data-entry="'+card.id+'"]').click();await page.locator('#bag-drop').click();
 await page.waitForFunction(()=>!window.raidQA.state().countdown);assert.equal((await state()).result,undefined);
 await page.screenshot({path:dir+'/card-drop-cancels.png'});
 report.checks.push('Discarding the card through the actual backpack cancels an active extraction while the world runs');
 assert.deepEqual(report.errors,[]);console.log('P5 remaining spawn routes, lab power and card-drop regressions passed');
} catch(error){report.failure=String(error);throw error;}
finally{await writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
