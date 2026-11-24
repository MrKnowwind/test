import type { CombatFrame, ExitZone, ItemId, Vec3, WeaponId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from '../raid/raid.ts';

import type { TreatmentPose } from '../combat/treatment.ts';
import { itemSpecs } from '../raid/catalog.ts';

const spawnNames: Record<string, string> = {
  'south-loading': '南侧卸货口', 'warehouse-alley': '仓库外巷', 'scrap-shelter': '废车棚',
};

export const itemName = (item: ItemId) => itemSpecs[item].name;
const list = (inventory: Readonly<Inventory>) => (Object.keys(inventory) as ItemId[])
  .map((item) => `${itemName(item)} × ${inventory[item]}`).join(' · ');
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function createGameView() {
  const overlay = byId('overlay');
  const hud = byId('hud');
  const stage = byId('stage');
  const title = byId('title');
  const summary = byId('summary');
  const controls = byId('controls');
  const primary = byId<HTMLButtonElement>('primary');
  const abandon = byId<HTMLButtonElement>('abandon');
  const warehouse = byId('warehouse');
  const error = byId('error');
  const routeList = byId('routes');
  const floor = byId('floor');
  const spawn = byId('spawn');
  const health = byId('health');
  const bar = byId('health-bar');
  const pack = byId('pack');
  const weapon = byId('weapon');
  const ammo = byId('ammo');
  const action = byId('weapon-action');
  const notice = byId('notice');
  const prompt = byId('prompt');
  const clock = byId('exfil-clock');
  const crosshair = byId('crosshair');
  const hurt = byId('hurt');
  const routeStates = new Map<string, { row: HTMLElement; status: HTMLElement }>();

  function label(element: HTMLElement, value: string) {
    if (element.textContent !== value) element.textContent = value;
  }

  return {
    primary, abandon,
    setWarehouse(inventory: Inventory | undefined) {
      label(warehouse, inventory ? list(inventory) || '空' : '仓库暂不可读');
    },
    setError(message = '') {
      label(error, message);
      error.hidden = !message;
    },
    showPlaying() {
      byId('creative-panel').hidden=true;
      overlay.hidden = true;
      hud.hidden = false;
    },
    showPaused() {
      byId('creative-panel').hidden=false;
      overlay.hidden = false;
      hud.hidden = true;
      label(stage, '出击中');
      label(title, '已暂停');
      label(summary, '继续出击可恢复当前进度。放弃会丢失本局携带的战利品。');
      label(primary, '继续出击');
      abandon.hidden = false;
      controls.hidden = false;
    },
    showResult(result: RaidResult, saved: boolean, exitLabel?: string) {
      overlay.hidden = false;
      hud.hidden = true;
      byId('creative-panel').hidden=true;
      abandon.hidden = true;
      controls.hidden = true;
      label(stage, exitLabel ?? '出击结算');
      label(title, result.outcome === 'extracted' ? '撤离成功' : result.outcome === 'dead' ? '出击失败' : '已放弃出击');
      label(summary, result.outcome === 'extracted'
        ? (list(result.items) || '本局携带栏为空。')
        : '未带出：'+(list(result.lost??{})||'空'));
      summary.textContent+='　出击 '+Math.floor(result.seconds??0)+' 秒 · 搜索 '+(result.visited?.length??0)+' 处'+(result.damage?' · 最近受伤：'+result.damage:'');
      const wear=(result.instances??[]).reduce((v,e)=>v+(e.item==='healing-injector'?30*(3-(e.durability??3)):0),0);
      const value=-wear+Object.entries(result.items).reduce((n,[id,q])=>n+itemSpecs[id as ItemId].price*q,0);
      if(result.practice)summary.textContent+=' · 创造练习，物资不入仓';
      else if(result.outcome==='extracted')summary.textContent+=' · 预计变卖 '+value+' 券';
      const log=result.log;
      if(log)summary.textContent+='　种子 '+result.seed+' · '+(spawnNames[result.spawn??'']??'')+' · 首件 '+(log.first??'无')+' · 实发 '+log.shots+' / 命中 '+log.hits+' / 击倒 '+log.kills+' / 用药 '+log.heals+(log.cancellations.length?' · 计时取消：'+log.cancellations.join('、'):'');
      label(primary, saved ? '再次出击' : '重试入库');
    },
    setRoutes(exits: readonly ExitZone[]) {
      routeList.replaceChildren();
      routeStates.clear();
      for (const exit of exits) {
        const row = document.createElement('div');
        row.className = 'route';
        const name = document.createElement('span');
        const status = document.createElement('span');
        name.textContent = exit.label;
        row.append(name, status);
        routeList.append(row);
        routeStates.set(exit.id, { row, status });
      }
    },
    updateRoutes(exits: readonly ExitZone[], statusFor: (exit: ExitZone) => {kind:string;label:string}, feet?: Vec3) {
      for (const exit of exits) {
        const state = routeStates.get(exit.id)!;
        const status = statusFor(exit);
        state.row.toggleAttribute('data-blocked', status.kind === 'locked');
        const distance = feet ? ` · ${Math.round(Math.hypot(exit.position[0] - feet[0], exit.position[2] - feet[2]))} m` : '';
        label(state.status, status.label + distance);
      }
    },
    updateHud(frame: CombatFrame, spawnId: string, underground: boolean, inventory: Readonly<Inventory>, region?: string, treatment?:TreatmentPose) {
      label(floor, underground ? '地下实验室 · B1' : region ?? '盐港隔离区');
      label(spawn, (frame.creative?'创造模式 · ':'')+(spawnNames[spawnId] ?? spawnId));
      label(health, frame.creative?'∞':String(frame.health));
      bar.style.width = `${frame.health}%`;
      label(pack, list(inventory) || '局内携带栏为空');
      if(treatment){
        label(weapon,itemName(treatment.item));
        label(ammo,Math.floor(treatment.progress*100)+'%');
        label(action,treatment.preview?'动作演示':'使用中');
        return;
      }
      const state = frame.weapon;
      const names: Record<WeaponId, string> = { rifle: '1 / 制式步枪', shotgun: '2 / 泵动霰弹枪', pistol: '3 / 港卫 P8', knife: '4 / 战术刀' };
      label(weapon,state.unarmed?'未持武器':names[state.id]);
      label(ammo, state.unarmed?'—':state.id !== 'knife' ? `${state.loaded} / ${state.reserve}` : '近战');
      label(action, state.action === 'reloading' ? '换弹中' : state.aiming ? '举枪' : state.action === 'slashing' ? '挥击' : '');
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
