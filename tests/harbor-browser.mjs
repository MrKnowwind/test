import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]??'dist'), output=path.resolve('test-results/harbor');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:4173/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1)||'index.html';await route.fulfill({body:await readFile(path.join(root,file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});});
  await page.addInitScript(()=>{let queue=new Map(),id=0,time,paint=true;window.requestAnimationFrame=cb=>{queue.set(++id,cb);return id;};window.cancelAnimationFrame=i=>queue.delete(i);for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const draw=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){if(paint)return draw.apply(this,args);};}window.tickHarbor=(n,render)=>{time??=performance.now();for(let i=0;i<n;i++){const q=queue;queue=new Map();time+=1000/60;paint=render&&i===n-1;for(const cb of q.values())cb(time);}paint=true;};});
  const tick=(n=2,render=false)=>page.evaluate(([n,render])=>window.tickHarbor(n,render),[n,render]),state=()=>page.evaluate(()=>raidQA.state());
  const pose=async (p,yaw=0,pitch=0)=>{await page.evaluate(([p,y,t])=>raidQA.pose(p,y,t),[p,yaw,pitch]);await tick();};
  const screenshot=async (name)=>{await tick(1,true);await page.screenshot({path:path.join(output,name+'.jpg'),quality:87,timeout:90000});};
  await page.goto('http://127.0.0.1:4173/?qa=1&seed=42',{timeout:90000});await page.locator('#primary:enabled').waitFor({timeout:90000});await page.locator('#primary').click();await page.waitForFunction(()=>raidQA.state().locked,undefined,{polling:25,timeout:90000});await tick();
  // Viewpoints use the QA camera for visual evidence only. Travel below uses normal
  // movement input, without teleporting across the bridge or staircase.
  await pose([-164,0,-54],Math.PI/2,.06);await screenshot('01-shore-ship');
  await pose([-164.7,0,-48],Math.PI/2,0);await page.keyboard.down('w');await tick(315);await page.keyboard.up('w');await tick(6);const boarded=await state();assert.ok(boarded.feet[0]<-186.5&&boarded.feet[0]>-190,JSON.stringify(boarded.feet));assert.ok(Math.abs(boarded.feet[1]-.7)<.06);checks.push({boarded:boarded.feet});await screenshot('02-cabin-corridor');
  await pose([-195,.7,-61],Math.PI/2,0);await screenshot('03-reception');
  await pose([-194,.7,-50],Math.PI/2,-.04);await screenshot('04-cabin');
  await pose([-194,.7,-22],Math.PI/2,0);await screenshot('05-lounge');
  await pose([-202,.7,1.4],0,.12);await page.keyboard.down('w');await tick(205);await page.keyboard.up('w');await tick(6);const upper=await state();assert.ok(upper.feet[2]<-13&&Math.abs(upper.feet[1]-4.1)<.08,JSON.stringify(upper.feet));checks.push({upper:upper.feet});await screenshot('06-upper-deck');
  await pose([-188,4.1,-39],Math.PI/2,.01);await screenshot('07-upper-terrace');
  await pose([-141,0,-83],Math.PI/2,.0);await screenshot('08-terminal');
  await pose([-143,-.8,18.1],0,.02);await screenshot('09-open-container');
  await pose([-188,.7,0],-Math.PI/2,0);await page.keyboard.down('w');await tick(320);await page.keyboard.up('w');await tick(6);const returned=await state();assert.ok(returned.feet[0]>-166&&Math.abs(returned.feet[1])<.08,JSON.stringify(returned.feet));checks.push({returned:returned.feet});
  await page.keyboard.press('m');await tick(10,true);await screenshot('10-map');await page.keyboard.press('m');await tick(8);
  await pose([-161,27,-112],2.64,-.22);await screenshot('11-expanded-ship-overview');
  await pose([-212.8,.7,-67],Math.PI/2,0);await screenshot('12-dining-room');
  await pose([-212.8,.7,-16],Math.PI/2,0);await screenshot('13-screening-room');
  await pose([-188,.7,-70],0,0);await page.keyboard.down('w');await tick(248);await page.keyboard.up('w');await tick(6);const bow=await state();assert.ok(Math.abs(bow.feet[1]-4.1)<.08&&bow.feet[2]<-87,JSON.stringify(bow.feet));checks.push({bowStair:bow.feet});
  await pose([-222,4.1,9],Math.PI,.08);await page.keyboard.down('w');await tick(242);await page.keyboard.up('w');await tick(7);const sun=await state();assert.ok(Math.abs(sun.feet[1]-7.65)<.08&&sun.feet[2]>25,JSON.stringify(sun.feet));checks.push({sunDeck:sun.feet});await screenshot('14-third-deck');
  await pose([-188,4.1,22],Math.PI/2,0);await screenshot('15-upper-hall');
  await pose([-115,0,-107],0,.02);await screenshot('16-north-slope');await page.keyboard.down('w');await tick(875);await page.keyboard.up('w');await tick(8);const terrace=await state();assert.ok(terrace.feet[2]<-166&&Math.abs(terrace.feet[1]-8)<.08,JSON.stringify(terrace.feet));checks.push({terrace:terrace.feet});await screenshot('17-north-highland');
  await pose([-124,8,-179],Math.PI/2,0);await screenshot('18-customs-hall');
  await pose([-108,1.8,134.5],Math.PI/2,.06);await screenshot('19-residential-row');
  await pose([-129,0,134.5],Math.PI/2,0);await screenshot('20-residential-interior');
  await pose([-88,20,-133],.63,-.26);await screenshot('21-north-terrace-overview');
  assert.deepEqual(errors,[]);await writeFile(path.join(output,'report.json'),JSON.stringify({checks,errors},null,2));console.log('Harbor/Civic browser: bridges, three decks, grade and scene views passed.');
}finally{await browser.close();}
