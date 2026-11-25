import type { CombatFrame, ItemId, WeaponId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from '../raid/raid.ts';
import type { TreatmentPose } from '../combat/treatment.ts';
import { itemSpecs } from '../raid/catalog.ts';

const spawnNames: Record<string, string> = {
  'south-loading': '南侧卸货口', 'warehouse-alley': '仓库外巷', 'scrap-shelter': '废车棚',
};
export const itemName = (item: ItemId) => itemSpecs[item].name;
const list = (inventory: Readonly<Inventory>) => (Object.keys(inventory) as ItemId[])
  .map(item => itemName(item) + ' × ' + inventory[item]).join('　');
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
    showResult(result: RaidResult, saved: boolean, exitLabel?: string) {
      menu('result', result.outcome === 'extracted' ? '撤离成功' : result.outcome === 'dead' ? '出击失败' : '已放弃出击',
        saved ? '返回整备' : '重试入库');
      label(stage, exitLabel ?? '出击结算');
      const items = result.outcome === 'extracted' ? list(result.items) : list(result.lost ?? {});
      const score = [Math.floor(result.seconds ?? 0) + ' 秒', '击倒 ' + (result.log?.kills ?? 0), '搜索 ' + (result.visited?.length ?? 0)];
      if (result.practice) score.push('练习');
      summary.replaceChildren(document.createTextNode(score.join('　')), document.createElement('br'),
        document.createTextNode((result.outcome === 'extracted' ? '带出　' : '损失　') + (items || '空')));
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
    updateHud(frame: CombatFrame, spawnId: string, underground: boolean, region?: string, treatment?:TreatmentPose, inspectAmmo = false) {
      label(floor, underground ? '地下实验室 · B1' : (region ?? '盐港隔离区').replace(/^\d+ /, ''));
      label(spawn, frame.creative ? '创造模式' : spawnNames[spawnId] ?? spawnId);
      label(health, frame.creative ? '∞' : String(frame.health));
      bar.style.width = frame.health + '%';
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
