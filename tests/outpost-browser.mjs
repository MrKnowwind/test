import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const address = process.env.OUTPOST_QA_URL ?? 'http://127.0.0.1:4281/';
const output = 'test-results/outpost';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: 'chrome' }),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    let jobs = new Map(), count = 0, time, painting = true;
    window.requestAnimationFrame = job => { jobs.set(++count, job); return count; };
    window.cancelAnimationFrame = id => jobs.delete(id);
    window.keysSeen = [];
    window.loadingStages = [];
    new MutationObserver(records => {
      for(const record of records){
        if(record.attributeName!=='aria-valuenow')continue;
        const screen=record.target.closest('#launch-screen');
        if(screen)window.loadingStages.push({mode:screen.dataset.mode,value:Number(record.target.getAttribute('aria-valuenow')),stage:screen.querySelector('#launch-stage').textContent});
      }
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['aria-valuenow']});
    for (const name of ['keydown', 'keyup', 'blur'])
      window.addEventListener(name, event => window.keysSeen.push([name, event.code, event.shiftKey]));
    for (const key of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const draw = WebGL2RenderingContext.prototype[key];
      WebGL2RenderingContext.prototype[key] = function(...args) { if (painting) return draw.apply(this, args); };
    }
    window.tickRaid = (frames, paint) => {
      time ??= performance.now();
      for (let i = 0; i < frames; i++) {
        const queue = jobs;
        jobs = new Map();
        painting = paint && i === frames - 1;
        time += 1000 / 60;
        for (const job of queue.values()) job(time);
      }
      painting = true;
    };
  });
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { polling: 25, timeout: 60000 });
  const tick = (n = 3, render = false) => page.evaluate(([n, render]) => window.tickRaid(n, render), [n, render]);
  const state = () => page.evaluate(() => raidQA.state());
  const pose = async (feet, yaw, pitch = 0) => {
    await page.evaluate(([feet, yaw, pitch]) => raidQA.pose(feet, yaw, pitch), [feet, yaw, pitch]);
    await tick();
  };
  const snap = name => page.screenshot({ path: output + '/' + name + '.jpg', quality: 85, timeout: 60000 });
  const press = async key => { await page.keyboard.press(key); await tick(); };
  const enter = async () => {
    await page.locator('#primary').click();
    try { await wait(() => raidQA.state().locked); }
    catch (error) {
      await snap('enter-failure');
      console.error(await page.evaluate(() => ({
        pointerLocked: !!document.pointerLockElement,
        error: document.querySelector('#error')?.textContent,
        title: document.querySelector('#title')?.textContent,
        primary: document.querySelector('#primary')?.textContent,
      })));
      throw error;
    }
    await tick();
  };
  const openBag = async () => { await wait(() => !document.querySelector('#backpack-panel').hidden && !document.pointerLockElement); };
  const closeBag = async () => {
    await wait(() => !document.pointerLockElement);
    await page.locator('#bag-close').click();
    await wait(() => raidQA.state().locked);
    await tick();
  };
  await page.goto(address + '?qa=1&seed=42', { timeout: 90000 });
  await page.locator('#launch-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('.launch-orbit').evaluate(el=>getComputedStyle(el).animationName),'launch-spin');
  await snap('startup-loading');
  await page.locator('#primary:enabled').waitFor({ timeout: 90000 });
  assert.equal((await state()).credits, 600);
  await snap('lobby');
  const bootStages=await page.evaluate(()=>window.loadingStages.filter(s=>s.mode==='boot'));
  assert.ok(new Set(bootStages.map(s=>s.value)).size>=8 && bootStages.at(-1).value===100);
  assert.ok(bootStages.every((s,i)=>i===0||s.value>=bootStages[i-1].value));
  await page.locator('#map-open').click();
  await page.locator('#map-dialog').waitFor({state:'visible'});
  await snap('map-selection');
  await page.locator('#map-select').click();
  const portrait=page.locator('#home-pane .outpost-operator');
  const beforePortrait=await portrait.evaluate(el=>el.toDataURL());
  await portrait.focus();await page.keyboard.press('ArrowRight');await tick(1,true);
  assert.notEqual(await portrait.evaluate(el=>el.toDataURL()),beforePortrait);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.locator('#quality').selectOption('low');
  await tick(2, true);
  await page.locator('[data-binding=ammo]').click();
  await page.keyboard.press('KeyW');
  assert.match(await page.locator('#binding-status').textContent(), /已用于前进/);
  await page.keyboard.press('KeyN');
  await snap('settings');
  await page.locator('#settings-close').click();

  await page.locator('.outpost-nav [data-outpost=buy]').click();
  await page.locator('[data-buy=repairpack]').click();
  await page.locator('[data-buy=medkit]').click();
  await page.locator('[data-buy=pistol-ammo]').click();
  await wait(() => raidQA.state().warehouse.medkit === 1);
  await snap('shop');
  await page.locator('.outpost-nav [data-outpost=prepare]').click();
  const stock = name => page.locator('#stash-grid').getByRole('button',{name,exact:true});
  await stock('分格维修包').click();
  await page.getByRole('button',{name:'旋转',exact:true}).click();
  assert.ok(await stock('分格维修包').locator('canvas.rotated').count());
  await stock('分格维修包').click({modifiers:['Shift']});
  assert.equal(await page.getByLabel('背包',{exact:true}).inputValue(),'repairpack');
  await stock('急救包').dragTo(page.locator('[data-carry-section=main]'),{targetPosition:{x:10,y:10}});
  assert.equal(await page.locator('[data-supply=medkit]').inputValue(),'1');
  const preparedMedkit=page.locator('[data-carry-section=main]').getByRole('button',{name:'急救包',exact:true});
  await preparedMedkit.dragTo(page.locator('#stash-grid'),{targetPosition:{x:20,y:100}});
  assert.equal(await page.locator('[data-supply=medkit]').inputValue(),'0');
  await stock('急救包').dragTo(page.locator('[data-carry-section=main]'),{targetPosition:{x:10,y:10}});
  assert.equal(await page.locator('[data-supply=medkit]').inputValue(),'1');
  await stock('9mm 弹药').click();
  await page.getByLabel('拆分数量').fill('5');
  await page.getByRole('button',{name:'拆分',exact:true}).click();
  assert.equal(await stock('9mm 弹药').count(),2);
  await stock('9mm 弹药').first().dragTo(page.locator('#stash-grid'),{targetPosition:{x:55,y:235}});
  await page.locator('#stash-category').selectOption('ammo');
  assert.equal(await page.locator('#stash-grid .inventory-tile').count(),2);
  await page.locator('#stash-sort').click();
  assert.equal(await stock('9mm 弹药').count(),1);
  await page.locator('#stash-category').selectOption('');
  await snap('prepare');
  await page.setViewportSize({width:768,height:620});
  await snap('prepare-compact');
  await page.setViewportSize({width:1280,height:720});
  await page.locator('#primary').click();
  await page.locator('#launch-screen[data-mode=raid]').waitFor({state:'visible',timeout:15000});
  await snap('sortie-loading');
  await wait(()=>raidQA.state().locked);
  await tick();
  const sortieStages=await page.evaluate(()=>window.loadingStages.filter(s=>s.mode==='raid'));
  assert.ok(new Set(sortieStages.map(s=>s.value)).size>=8 && sortieStages.at(-1).value===100);
  assert.ok(sortieStages.some(s=>s.stage==='确认已加载港区')&&!sortieStages.some(s=>s.stage==='生成港区地形与建筑'));
  assert.equal((await state()).backpack.some(e => e.item === 'medkit'), true);
  assert.equal((await state()).backpack.find(e => e.item === 'medkit').section,'main');
  assert.deepEqual((await state()).warehouse, {'pistol-ammo':12});
  assert.ok(await page.locator('#hud-minimap').isVisible());
  assert.ok(await page.locator('#raid-objectives').isHidden());
  assert.ok(await page.locator('#ammo-popup').isHidden());
  await press('KeyN');
  assert.ok(await page.locator('#ammo-popup').isVisible());
  await press('Tab'); await openBag();
  assert.equal(await page.locator('.pack-layout[data-pack=repairpack]').count(), 1);
  await page.getByRole('button', { name: '9mm 弹药', exact: true }).click();
  assert.ok(await page.locator('#bag-detail').isVisible());
  assert.match(await page.locator('#selected-item').textContent(), /×15/);
  await closeBag();

  await pose([-24, 0, 142.1], 0, -.78);
  await tick(2, true);
  assert.match(await page.locator('#prompt').textContent(), /基础小包/, JSON.stringify({
    feet:(await state()).feet, yaw:(await state()).yaw, pitch:(await state()).pitch, eye:(await state()).eye, locked:(await state()).locked,
  }));
  await snap('ground-pack');
  await press('KeyE'); await openBag();
  await page.locator('button.pack-source').click();
  assert.ok(await page.getByRole('button', { name: '装备此包' }).isVisible());
  await closeBag();

  const target = (await state()).interactions.find(t => t.id === 'duty-card');
  const [x, y, z] = target.position;
  await pose([x, y-1.12, z + 1.5], 0, -.34);
  assert.match(await page.locator('#prompt').textContent(), /值班室文件盒/);
  await press('KeyE'); await openBag();
  await tick(260, true);
  const cards = page.locator('#container-content .source-item.revealed');
  assert.ok(await cards.count() > 1);
  const fitted = await cards.evaluateAll(tiles => tiles.every(tile => {
    const b = tile.getBoundingClientRect(), i = tile.firstElementChild.getBoundingClientRect();
    return i.width > 10 && i.height > 10 && i.top >= b.top && i.bottom <= b.bottom && i.left >= b.left && i.right <= b.right;
  }));
  assert.equal(fitted, true);
  const card = page.getByRole('button', { name: '维修卡', exact: true });
  await card.click();
  const anchor = await card.boundingBox(), detail = await page.locator('#bag-detail').boundingBox();
  const source = await page.locator('#container-content .section-grid').boundingBox();
  assert.ok(Math.abs(detail.y - anchor.y) < 3 && Math.abs(detail.x - source.x - source.width) < 10);
  assert.ok(await page.getByRole('button', { name: '丢弃', exact: true }).isVisible());
  await snap('loot-detail');
  await page.setViewportSize({ width: 768, height: 620 });
  await tick();
  const compact = await page.locator('#bag-detail').boundingBox();
  assert.ok(compact.x >= 0 && compact.x + compact.width <= 768 && compact.y + compact.height <= 620);
  await snap('loot-compact');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: '拾取', exact: true }).click();
  assert.equal((await state()).items['service-card'], 1);
  await closeBag();
  assert.match(await page.locator('#raid-objectives').textContent(), /维修通道/);

  await pose([-24, 0, 149], 0);
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await tick(18);
  const sprint = await state();
  assert.ok(sprint.feet[2] < 147.75, JSON.stringify({feet: sprint.feet, health: sprint.health, weapon: sprint.weapon}));
  await page.keyboard.down('c'); await tick(); await page.keyboard.up('c');
  const afterSlide = await state();
  assert.equal(afterSlide.stance, 'slide', JSON.stringify({
    sprint: sprint.feet, now: afterSlide.feet, yaw: afterSlide.yaw, weapon: afterSlide.weapon,
    events: await page.evaluate(() => window.keysSeen.slice(-15)),
  }));
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await press('Space');
  assert.ok((await state()).feet[1] > .1);
  assert.equal((await state()).stance, 'stand');
  await tick(60);
  await press('ControlLeft');
  assert.equal((await state()).stance, 'crouch');
  await press('ControlLeft');
  assert.equal((await state()).stance, 'stand');
  await tick(6, true); await snap('hud');
  await press('Escape');
  await page.locator('#settings-open').click();
  await page.locator('#stance-mode').selectOption('hold');
  await page.locator('#vertical-fov').fill('70');
  await page.locator('#setting-cameraMotion').fill('50');
  await page.locator('#settings-close').click();
  await enter();
  await page.keyboard.down('c'); await tick();
  assert.equal((await state()).stance, 'crouch');
  await page.keyboard.up('c'); await tick();
  assert.equal((await state()).stance, 'stand');

  const deployed = await state();
  const road = deployed.exits.find(e => e.openForSpawnSide === deployed.spawn.side);
  await pose(road.position, 0);
  await tick(315, true);
  assert.equal((await state()).result.outcome, 'extracted');
  await page.locator('#primary').click();
  await page.locator('.outpost-nav [data-outpost=buy]').click();
  await page.locator('.merchant-side [data-outpost=sell]').click();
  const sale = page.locator('[data-sell=service-card]');
  const price = Number((await sale.textContent()).match(/\d+/)[0]), before = (await state()).credits;
  await snap('warehouse');
  await sale.click();
  await wait(credits => raidQA.state().credits === credits, before + price);
  assert.deepEqual((await state()).warehouse, { 'pistol-ammo':12,medkit: 1, repairpack: 1 });
  await page.evaluate(()=>{window.loadingStages=[];});
  await page.locator('#primary').click();
  await page.locator('#launch-screen[data-mode=raid]').waitFor({state:'visible',timeout:15000});
  await wait(()=>raidQA.state().locked);
  await tick();
  const rebuiltStages=await page.evaluate(()=>window.loadingStages.filter(s=>s.mode==='raid'));
  assert.ok(rebuiltStages.some(s=>s.stage==='生成港区地形与建筑')&&rebuiltStages.at(-1).value===100);
  await press('Escape');
  await page.locator('#abandon').click();
  await page.locator('#primary').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await page.locator('#launch-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('.launch-orbit').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#primary:enabled').waitFor({ timeout: 90000 });
  await page.locator('#settings-open').click();
  assert.equal(await page.locator('[data-binding=ammo]').textContent(), 'N');
  assert.equal(await page.locator('#stance-mode').inputValue(), 'hold');
  assert.equal(await page.locator('#vertical-fov').inputValue(), '70');
  assert.equal(await page.locator('#setting-cameraMotion').inputValue(), '50');
  assert.equal((await state()).credits, before + price);
  assert.deepEqual(errors, []);
  await writeFile(output + '/report.json', JSON.stringify({ seed: 42, bootStages, sortieStages, rebuiltStages, sale: price, errors }, null, 2));
  console.log('Verified outpost checkout, loot detail bounds, slide jump, opt-in objectives and extraction-to-sale.');
} finally {
  await browser.close();
}
