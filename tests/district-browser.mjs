import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { districtRoutes } from './fixtures/district-routes.mjs';
import { lab, researchPad } from '../src/world/researchPlan.ts';
const destination=process.argv.includes('--final')?'test-results/next-pass-world':'test-results/district-p2';
await mkdir(destination,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const report={errors:[],points:[],checks:[]};
try {
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error') report.errors.push(e.text());});
 const state=()=>page.evaluate(()=>window.raidQA.state());
 const pose=(feet,yaw=0,pitch=0)=>page.evaluate(p=>window.raidQA.pose(p.feet,p.yaw,p.pitch),{feet,yaw,pitch});
 const enter=async()=>{await page.locator('#primary').click();await page.waitForFunction(()=>window.raidQA.state().locked);};
 const route=districtRoutes.find(candidate=>candidate.id==='N-D');
 await page.goto('http://127.0.0.1:4173/?qa=1&seed='+route.seed);
 await page.locator('#primary:not([disabled])').waitFor();
 report.bundle=await page.locator('script[type=module]').getAttribute('src');
 await enter();
 if(!process.argv.includes('--captures-only')) {
 assert.equal((await state()).spawn.id,route.id);
 await page.screenshot({path:destination+'/01-south-road.png'});
 for(const [x,z] of route.waypoints) {
  const feet=(await state()).feet;
  await pose(feet,Math.atan2(feet[0]-x,feet[2]-z));
  await page.keyboard.down('Shift');await page.keyboard.down('w');
  await page.waitForFunction(({x,z})=>{const p=window.raidQA.state().feet;return Math.hypot(p[0]-x,p[2]-z)<.5;},{x,z},{timeout:45000});
  await page.keyboard.up('w');await page.keyboard.up('Shift');report.points.push((await state()).feet);
 }
 await page.waitForFunction(()=>window.raidQA.state().result?.outcome==='extracted');
 assert.equal((await state()).result.exitId,'highway');
 report.checks.push('North-east spawn to south highway: W/Shift movement and successful extraction');
 await page.locator('#primary').click();
 await enter();
 await pose([40.5,researchPad.height,-132]);
 await page.keyboard.down('w');
 await page.waitForFunction(y=>{const {feet}=window.raidQA.state();return Math.abs(feet[1]-y)<.2&&feet[2]<-152;},lab.y,{timeout:14000});
 await page.keyboard.up('w');
 await page.screenshot({path:destination+'/02-lab-ramp.png'});
 report.checks.push('Real walk down relocated underground ramp');
 }
 await page.keyboard.press('Escape');await page.locator('#overlay').evaluate(e=>e.style.visibility='hidden');
 for(const [name,feet,yaw] of [['03-wharf',[-129,-.8,27],.7],['04-warehouse',[-4,0,30],0],['05-plant',[140,3.2,-34],.6],['06-transfer',[-78,0,31],0],['07-workshop',[-41,0,18],0],['08-ocean',[-163,0,28],Math.PI/2],['10-plant-workshop',[90,0,-10],0],['11-research-wing',[7,0,-96],0],['09-tactical-map',[-24,0,143],0]]) {
  if(process.argv.includes('--map-only') && !name.includes('tactical')) continue;
  await pose(feet,yaw);await page.waitForTimeout(100);
  if(name.includes('tactical')) {await page.waitForTimeout(400);await page.locator('#overlay').evaluate(e=>e.style.visibility='visible');await enter();await page.waitForTimeout(150);await page.keyboard.press('m');await page.locator('#tactical-map').waitFor({state:'visible'});}
  await page.screenshot({path:destination+'/'+name+'.png'});
 }
 assert.deepEqual(report.errors,[]);
 console.log('P1 district routes and production captures passed');
} finally {await writeFile(destination+(process.argv.includes('--captures-only')?process.argv.includes('--map-only')?'/map-capture.json':'/captures.json':'/report.json'),JSON.stringify(report,null,2));await browser.close();}

