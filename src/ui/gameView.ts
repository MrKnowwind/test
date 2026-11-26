import type { CombatFrame, ItemId, WeaponId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from '../raid/raid.ts';
import type { TreatmentPose } from '../combat/treatment.ts';
import { itemSpecs } from '../raid/catalog.ts';
import type { Settlement } from '../raid/warehouse.ts';
import { itemIcon } from './itemArt.ts';

export const itemName = (item: ItemId) => itemSpecs[item].name;
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function createGameView() {
  const overlay = byId('overlay'), hud = byId('hud'), stage = byId('stage'), title = byId('title');
  const summary = byId('summary'), outpost = byId('outpost'), creative = byId('creative-panel');
  const primary = byId<HTMLButtonElement>('primary'), abandon = byId<HTMLButtonElement>('abandon');
  const error = byId('error'), floor = byId('floor'), spawn = byId('spawn');
  const health = byId('health'), bar = byId('health-bar'), weapon = byId('weapon'), action = byId('weapon-action');
  const ammo = byId('ammo'), ammoPopup = byId('ammo-popup'), ammoType = byId('ammo-type'), ammoLabel = byId('ammo-label');
  const notice = byId('notice'), prompt = byId('prompt'), clock = byId('exfil-clock');
  const crosshair = byId('crosshair'), hurt = byId('hurt');
  const objectives = byId('raid-objectives'), objectiveList = byId('objective-list');
  let objectiveKey = '';

  function label(element: HTMLElement, value: string) {
    if (element.textContent !== value) element.textContent = value;
  }
  function menu(mode: 'home' | 'paused' | 'result', heading: string, action: string) {
    overlay.dataset.mode = mode;
    overlay.hidden = false;
    hud.hidden = true;
    outpost.hidden = mode !== 'home';
    stage.hidden = summary.hidden = mode !== 'result';
    creative.hidden = abandon.hidden = mode !== 'paused';
    label(title, heading); label(primary, action);
  }
  return {
    primary, abandon,
    setError(message = '') {
      label(error, message);
      error.hidden = !message;
    },
    showHome() { menu('home', '盐港隔离区', '出击'); },
    showPlaying() {
      creative.hidden = overlay.hidden = true;
      hud.hidden = false;
    },
    showPaused() { menu('paused', '已暂停', '继续出击'); },
    showResult(result: RaidResult, saved: boolean, exitLabel?: string, settlement?:Settlement) {
      menu('result', result.outcome === 'extracted' ? '撤离成功' : result.outcome === 'dead' ? '出击失败' : '已放弃出击',
        saved ? '返回整备' : '重试入库');
      label(stage, exitLabel ?? '出击结算');
      const score = [Math.floor(result.seconds ?? 0) + ' 秒', '击倒 ' + (result.log?.kills ?? 0), '搜索 ' + (result.visited?.length ?? 0)];
      if (result.practice) score.push('练习');
      const stats=document.createElement('div');stats.className='settlement-stats';stats.textContent=score.join('　');
      const amounts=document.createElement('div');amounts.className='settlement-amounts';
      for(const [name,value] of [['带回估值',settlement?.returned??0],['出击投入',settlement?.deployed??0],['净收益',settlement?.net??0]] as const){const cell=document.createElement('div'),title=document.createElement('small'),number=document.createElement('strong');title.textContent=name;number.textContent=result.practice?'—':(name==='净收益'&&value>0?'+':'')+value+' 券';cell.append(title,number);amounts.append(cell);}
      function inventory(title:string,items:Inventory){const section=document.createElement('section'),heading=document.createElement('h3'),grid=document.createElement('div');heading.textContent=title;grid.className='settlement-items';for(const item of Object.keys(items) as ItemId[]){if(!items[item])continue;const tile=document.createElement('div'),name=document.createElement('span');name.textContent=itemName(item)+' ×'+items[item];tile.style.setProperty('--item-color',itemSpecs[item].color);tile.append(itemIcon(item),name);grid.append(tile);}if(!grid.children.length)grid.textContent='无';section.append(heading,grid);return section;}
      const inventories=document.createElement('div');inventories.className='settlement-inventories';inventories.append(inventory('带出物资',result.outcome==='extracted'?result.items:{}),inventory('损失 / 消耗',settlement?.lost??result.lost??{}));summary.replaceChildren(stats,amounts,inventories);
    },
    updateObjectives(tasks: readonly { title: string; detail: string }[]) {
      objectives.hidden = tasks.length === 0;
      const key = JSON.stringify(tasks);
      if (key === objectiveKey) return;
      objectiveKey = key;
      objectiveList.replaceChildren(...tasks.map(task => {
        const article = document.createElement('article'), name = document.createElement('b'), detail = document.createElement('span');
        name.textContent = task.title; detail.textContent = task.detail;
        article.append(name, detail);
        return article;
      }));
    },
    updateHud(frame: CombatFrame, spawnLabel: string, underground: boolean, region?: string, treatment?:TreatmentPose, inspectAmmo = false) {
      label(floor, underground ? '地下实验室 · B1' : (region ?? '盐港隔离区').replace(/^\d+ /, ''));
      label(spawn, frame.creative ? '创造模式' : spawnLabel);
      label(health, frame.creative ? '∞' : String(frame.health));
      bar.style.width = frame.health + '%';
      const shield=frame.shield,shieldHud=byId('shield-hud');shieldHud.hidden=!shield;
      if(shield){label(byId('shield-name'),itemSpecs[shield.item].name);label(byId('shield-charge'),Math.ceil(shield.charge)+'/'+shield.capacity);const track=byId('shield-bar');track.style.width=100*shield.charge/shield.capacity+'%';track.style.background=itemSpecs[shield.item].color;shieldHud.style.setProperty('--shield-segments',String(shield.capacity/25));}
      const state = frame.weapon;
      const names: Record<WeaponId, string> = { rifle: '制式步枪', shotgun: '泵动霰弹枪', pistol: itemName('pistol'), knife: itemName('knife') };
      label(weapon, treatment ? itemName(treatment.item) : state.unarmed ? '空手' : names[state.id]);
      label(action, treatment ? Math.floor(treatment.progress * 100) + '%' :
        state.action === 'reloading' ? '换弹中' : '');
      ammoPopup.hidden = !!treatment || !(inspectAmmo || state.action === 'reloading') || !!state.unarmed || state.id === 'knife';
      if (!ammoPopup.hidden) {
        label(ammoType, itemName('pistol-ammo'));
        label(ammo, state.loaded + ' / ' + state.reserve);
        label(ammoLabel, '弹匣 / 备弹');
      }
    },
    feedback(message: string, interaction: string, timerText: string, hit: boolean, damage: number, aiming: boolean) {
      label(notice, message);
      notice.hidden = !message;
      label(prompt, interaction);
      prompt.hidden = !interaction;
      clock.hidden = !timerText;
      label(clock, timerText);
      crosshair.hidden = aiming && !hit;
      crosshair.toggleAttribute('data-hit', hit);
      hurt.style.opacity = String(damage);
    },
  };
}
