import type { CombatFrame, ExitZone, ItemId, Vec3, WeaponId } from '../contracts/demo.ts';
import type { Inventory, RaidResult } from '../raid/raid.ts';

const items: Record<ItemId, string> = {
  'pistol-ammo': '手枪弹药', medkit: '医疗包', salvage: '普通物资',
  'research-sample': '研究样本', 'service-card': '维修卡',
};
const spawnNames: Record<string, string> = {
  'south-loading': '南侧卸货口', 'warehouse-alley': '仓库外巷', 'scrap-shelter': '废车棚',
};

export const itemName = (item: ItemId) => items[item];
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
  const progress = byId<HTMLProgressElement>('extraction');
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
      overlay.hidden = true;
      hud.hidden = false;
    },
    showPaused() {
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
      abandon.hidden = true;
      controls.hidden = true;
      label(stage, exitLabel ?? '出击结算');
      label(title, result.outcome === 'extracted' ? '撤离成功' : result.outcome === 'dead' ? '出击失败' : '已放弃出击');
      label(summary, result.outcome === 'extracted'
        ? (list(result.items) || '本局携带栏为空。')
        : '本局携带的战利品已丢失。');
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
    updateRoutes(exits: readonly ExitZone[], blockedReason: (exit: ExitZone) => string | undefined, feet?: Vec3) {
      for (const exit of exits) {
        const state = routeStates.get(exit.id)!;
        const blocked = blockedReason(exit);
        state.row.toggleAttribute('data-blocked', !!blocked);
        const distance = feet ? ` · ${Math.round(Math.hypot(exit.position[0] - feet[0], exit.position[2] - feet[2]))} m` : '';
        label(state.status, (blocked ? (blocked.includes('维修卡') ? '需维修卡' : '未通电') : '可撤离') + distance);
      }
    },
    updateHud(frame: CombatFrame, spawnId: string, underground: boolean, inventory: Readonly<Inventory>, region?: string) {
      label(floor, underground ? '地下实验室 · B1' : region ?? '盐港隔离区');
      label(spawn, spawnNames[spawnId] ?? spawnId);
      label(health, String(frame.health));
      bar.style.width = `${frame.health}%`;
      label(pack, list(inventory) || '局内携带栏为空');
      const state = frame.weapon;
      const names: Record<WeaponId, string> = { rifle: '1 / 制式步枪', shotgun: '2 / 泵动霰弹枪', pistol: '3 / 手枪', knife: '4 / 战术刀' };
      label(weapon, names[state.id]);
      label(ammo, state.id !== 'knife' ? `${state.loaded} / ${state.reserve}` : '近战');
      label(action, state.action === 'reloading' ? '换弹中' : state.aiming ? '举枪' : state.action === 'slashing' ? '挥击' : '');
    },
    feedback(message: string, interaction: string, remaining: number | undefined, hit: boolean, damage: number, aiming: boolean) {
      label(notice, message);
      notice.hidden = !message;
      label(prompt, interaction);
      prompt.hidden = !interaction;
      progress.hidden = remaining === undefined;
      if (remaining !== undefined) progress.value = progress.max - remaining;
      crosshair.hidden = aiming && !hit;
      crosshair.toggleAttribute('data-hit', hit);
      hurt.style.opacity = String(damage);
    },
  };
}
