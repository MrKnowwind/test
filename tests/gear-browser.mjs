import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const address=process.env.OUTPOST_QA_URL??'http://127.0.0.1:4281/';
const output='test-results/phase-three';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{channel:'chrome'}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('wasteland-raid.market.v1',JSON.stringify({starterGranted:true,credits:3000}));
    localStorage.setItem('wasteland-raid.warehouse.v1:qa-loot',JSON.stringify({coil:1,terminal:1,'shield-blue':1,instances:[{item:'shield-blue',quantity:1,instance:'qa-shield',charge:40}]}));
    let jobs=new Map(),count=0,time,painting=true;window.requestAnimationFrame=job=>{jobs.set(++count,job);return count;};window.cancelAnimationFrame=id=>jobs.delete(id);
    for(const key of ['drawArrays','drawElements','drawElementsInstanced','drawArraysInstanced']){const draw=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){if(painting)return draw.apply(this,args);};}
    window.tickRaid=(frames,paint)=>{time??=performance.now();for(let i=0;i<frames;i++){const queue=jobs;jobs=new Map();painting=paint&&i===frames-1;time+=1000/60;for(const job of queue.values())job(time);}painting=true;};
  });
  const wait=(fn,arg)=>page.waitForFunction(fn,arg,{polling:25,timeout:90000}),tick=(n=4,paint=false)=>page.evaluate(([n,paint])=>window.tickRaid(n,paint),[n,paint]),state=()=>page.evaluate(()=>raidQA.state()),snap=name=>page.screenshot({path:`${output}/${name}.jpg`,quality:88,timeout:90000});
  await page.goto(address+'?qa=1&seed=42',{timeout:90000});await page.locator('#primary:enabled').waitFor({timeout:90000});
  await page.locator('.outpost-nav [data-outpost=buy]').click();
  const armorIcons=await page.locator('[data-buy^=shield-]:not([data-buy=shield-cell])').evaluateAll(buttons=>buttons.map(b=>{const c=b.closest('article').querySelector('canvas');const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {url:c.toDataURL(),opaque:[...data.filter((_,i)=>i%4===3)].filter(x=>x>0).length};}));assert.equal(armorIcons.length,5);assert.equal(new Set(armorIcons.map(o=>o.url)).size,5);assert.ok(armorIcons.every(o=>o.opaque>300));
  await page.locator('[data-buy=head-survey]').click();await wait(()=>raidQA.state().warehouse['head-survey']===1);await page.locator('[data-buy=daypack]').click();await wait(()=>raidQA.state().warehouse.daypack===1);await snap('merchant');
  await page.locator('.merchant-side [data-outpost=exchange]').click();await page.getByRole('button',{name:'兑换',exact:true}).first().click();await wait(()=>raidQA.state().warehouse['shield-cell']===3);await page.locator('#repair-stock button').click();await wait(()=>document.querySelector('#repair-stock').textContent.includes('没有需要'));
  await page.locator('.outpost-nav [data-outpost=prepare]').click();await page.locator('#stash-expand').click();await wait(()=>document.querySelector('#stash-capacity').textContent.includes('/ 160 格'));
  const stock=name=>page.locator('#stash-grid').getByRole('button',{name,exact:true});const portrait=page.locator('#prepare-pane .outpost-operator'),before=await portrait.evaluate(c=>c.toDataURL());
  for(const name of ['基础小包','蓝阶能量护甲','矿灯安全帽','护盾充能单元'])await stock(name).click({modifiers:['Shift']});
  await tick(1,true);assert.notEqual(await portrait.evaluate(c=>c.toDataURL()),before);assert.ok(await portrait.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((x,i)=>i%4===3&&x>0)));assert.equal(await page.locator('[data-gear-slot^=primary]').count(),2);assert.match(await page.locator('[data-gear-slot=shield]').textContent(),/75\/75/);await snap('equipment');
  await page.locator('#primary').click();await wait(()=>raidQA.state().locked);await tick(4,true);assert.equal((await state()).shield.charge,75);assert.equal((await state()).headlamp,true);assert.match(await page.locator('#shield-charge').textContent(),/75\/75/);
  await page.keyboard.press('Tab');await tick(1,true);await page.locator('#backpack-panel').waitFor({state:'visible'});await tick(1,true);assert.match(await page.locator('#loadout [data-gear-slot=head]').textContent(),/矿灯安全帽/);await snap('raid-gear');
  await page.locator('#bag-close').click();await wait(()=>raidQA.state().locked);await tick();const raid=await state();const exit=raid.exits.find(e=>e.openForSpawnSide===raid.spawn.side);await page.evaluate(pos=>raidQA.pose(pos,0),exit.position);await tick(320);await page.locator('#summary').waitFor({state:'visible'});assert.match(await page.locator('#summary').textContent(),/净收益/);assert.match(await page.locator('#summary').textContent(),/蓝阶能量护甲/);await snap('settlement');
  await page.locator('#primary').click();await page.locator('.outpost-nav [data-outpost=base]').click();assert.match(await page.locator('#raid-history').textContent(),/撤离成功/);await snap('history');assert.deepEqual(errors,[]);
  console.log('Phase III browser gear, model thumbnails, capacity, exchange, repair, lamp and settlement passed.');
}finally{await browser.close();}
