import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir='test-results/search-p3';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'}), report={errors:[],checks:[]};
try {
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')report.errors.push(e.text());});
 const state=()=>page.evaluate(()=>window.raidQA.state());
 const pose=(feet,yaw=0,pitch=0)=>page.evaluate(p=>window.raidQA.pose(p.feet,p.yaw,p.pitch),{feet,yaw,pitch});
 const enter=async()=>{await page.locator('#primary').click();await page.waitForFunction(()=>window.raidQA.state().locked);};
 const close=async()=>{await page.waitForTimeout(350);await page.locator('#bag-close').click();await page.waitForFunction(()=>window.raidQA.state().locked);};
 const open=async(id)=>{
  const target=(await state()).interactions.find(t=>t.id===id);
  await pose([target.position[0],target.position[1]<0?-5.4:target.position[1]<.8?-.8:target.position[1]>4?3.2:0,target.position[2]+1.5],0,-.32);
  await page.keyboard.press('e');await page.locator('#backpack-panel').waitFor({state:'visible'});
 };
 const shot=async(name)=>page.screenshot({path:dir+'/'+name+'.png'});
 await page.goto('http://127.0.0.1:4173/?qa=1&seed=42');await page.locator('#primary:not([disabled])').waitFor();await enter();
 report.bundle=await page.locator('script[type=module]').getAttribute('src');
 await open('duty-card');
 assert.ok(await page.locator('.source-item.unknown').count()>0);await shot('01-unknown');
 const initial=(await state()).containers.find(c=>c.id==='duty-card');
 assert.ok(!initial.entries[0].revealed);
 await close();
 const paused=(await state()).containers.find(c=>c.id==='duty-card').entries[0].progress;
 await page.waitForTimeout(500);
 assert.equal((await state()).containers.find(c=>c.id==='duty-card').entries[0].progress,paused);
 await open('duty-card');
 await page.locator('.source-item.revealed').first().waitFor();
 assert.ok(await page.locator('.source-item.unknown').count()>0);await shot('02-first-revealed');
 await page.locator('.source-item.revealed').first().click();
 await page.locator('.bag-cell[data-x="4"][data-y="4"]').hover();await shot('03-fit-preview');
 await page.locator('.bag-cell[data-x="4"][data-y="4"]').click();
 assert.ok((await state()).backpack.some(e=>e.item==='service-card'&&e.x===4&&e.y===4));
 // Move away while the container is open: the world and distance condition remain active.
 const before=(await state()).containers.find(c=>c.id==='duty-card').entries.find(e=>!e.revealed)?.progress;
 await pose([-4,0,32]);await page.waitForTimeout(150);
 assert.ok((await page.locator('#search-status').textContent()).includes('暂停'));
 report.checks.push('unknown footprints, sequential reveal, early manual placement, interrupted/reopened search, distance feedback');
 await close();await pose([189,0,-90]);await page.keyboard.press('e');
 await page.waitForFunction(()=>window.raidQA.state().result?.outcome==='extracted');
 const credit=(await state()).credits;await page.locator('[data-sell="service-card"]').click();
 await page.waitForFunction(c=>window.raidQA.state().credits===c+40,credit);
 await page.reload();await page.locator('#primary:not([disabled])').waitFor();assert.equal((await state()).credits,credit+40);
 report.checks.push('early searched card enables extraction, stash, sale and persisted currency');
 await enter();
 await open('lab-research');await page.locator('.source-item.revealed').first().waitFor();
 await page.locator('.source-item.revealed').first().click();await page.keyboard.press('r');
 await page.locator('.source-item.revealed').first().dragTo(page.locator('.bag-cell[data-x="4"][data-y="3"]'));
 assert.ok((await state()).backpack.some(e=>e.item==='research-sample'&&e.x===4&&e.y===3&&e.rotated));
 report.checks.push('A revealed container sample rotates with R and drags into the exact backpack cells');
 await page.reload();await page.locator('#primary:not([disabled])').waitFor();await enter();
 // Physically open and transfer supplies until the 6x5 backpack cannot accept another piece.
 let rejected=false;
 for(const id of ['yard-salvage','factory-salvage','transit-tools','workshop-supplies']) {
  await open(id);await page.waitForFunction(id=>window.raidQA.state().containers.find(c=>c.id===id).entries.every(e=>e.revealed),id);
  const entries=(await state()).containers.find(c=>c.id===id).entries;
  for(const entry of entries) {
    const before=(await state()).backpack.length;
    await page.locator('[data-source="'+entry.id+'"]').dblclick();
    const remains=(await state()).containers.find(c=>c.id===id).entries.some(e=>e.id===entry.id);
    if(remains) {rejected=true;assert.equal((await state()).backpack.length,before);await shot('04-full-retained');break;}
  }
  await close();if(rejected)break;
 }
 assert.equal(rejected,true,'full bag must reject and retain a revealed item');
 report.checks.push('full backpack rejection retains the exact item in its container');
 assert.deepEqual(report.errors,[]);console.log('P3 actual browser search/transfer/extraction passed');
} catch(error){report.failure=String(error);throw error;}
finally {await writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
