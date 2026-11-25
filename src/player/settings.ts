export const actions = {
  forward: ['前进', 'KeyW'], backward: ['后退', 'KeyS'],
  left: ['向左', 'KeyA'], right: ['向右', 'KeyD'],
  sprint: ['冲刺', 'ShiftLeft', 'ShiftRight'], quiet: ['静走', 'AltLeft'],
  stance: ['下蹲 / 滑铲', 'ControlLeft', 'KeyC', 'ControlRight'],
  jump: ['跳跃 / 攀爬', 'Space'], interact: ['交互', 'KeyE'],
  attack: ['攻击', 'Mouse0'], aim: ['瞄准', 'Mouse2'], reload: ['换弹', 'KeyR'],
  primaryA: ['主武器 I', 'Digit1'], primaryB: ['主武器 II', 'Digit2'],
  pistol: ['手枪', 'Digit3'], knife: ['近战', 'Digit4'],
  heal: ['治疗 / 取消', 'KeyH'], medicine: ['选药', 'Digit5'],
  backpack: ['背包', 'Tab'], map: ['地图', 'KeyM'], ammo: ['检查弹药', 'KeyB'],
  descend: ['飞行下降', 'KeyQ'],
} as const;
export type InputAction = keyof typeof actions;
export const inputActions = Object.keys(actions) as InputAction[];
type Bindings = Record<InputAction, string[]>;

export function defaultSettings() {
  return {
    stance: 'toggle' as 'toggle' | 'hold',
    sensitivity: 1, master: .85, effects: 1, ambience: .8,
    quality: 'balanced', minimap: true,
    bindings: Object.fromEntries(inputActions.map(action => [action, actions[action].slice(1)])) as Bindings,
  };
}
export type Settings = ReturnType<typeof defaultSettings>;
const key = 'wasteland-raid.settings.v1';
export const reservedBinding = (code: string) => ['Escape', 'F3', 'Delete'].includes(code) || code.startsWith('Arrow');
export function bindingName(code?: string) {
  if (!code) return '—';
  const labels: Record<string, string> = {
    Mouse0: '鼠标左键', Mouse1: '鼠标中键', Mouse2: '鼠标右键', Mouse3: '鼠标侧键 1', Mouse4: '鼠标侧键 2',
    ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', AltLeft: '左 Alt',
  };
  return labels[code] ?? code.replace(/^(Key|Digit)/, '');
}
export function readSettings(storage: Pick<Storage, 'getItem'>) {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(storage.getItem(key) ?? '{}');
    for (const [name, min, max] of [['sensitivity', .2, 3], ['master', 0, 1], ['effects', 0, 1], ['ambience', 0, 1]] as const)
      if (typeof saved[name] === 'number') settings[name] = Math.max(min, Math.min(max, saved[name]));
    if (saved.stance === 'hold') settings.stance = 'hold';
    if (['high', 'balanced', 'low'].includes(saved.quality)) settings.quality = saved.quality;
    if (typeof saved.minimap === 'boolean') settings.minimap = saved.minimap;
    const bindings = {} as Bindings;
    const codes = new Set<string>();
    for (const action of inputActions) {
      const stored = saved.bindings?.[action] ?? settings.bindings[action];
      if (!Array.isArray(stored) || !stored.length || stored.length > 3 ||
        stored.some(code => typeof code !== 'string' || reservedBinding(code) || codes.has(code))) return settings;
      bindings[action] = stored;
      stored.forEach(code => codes.add(code));
    }
    settings.bindings = bindings;
  } catch { /* use defaults */ }
  return settings;
}
export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: Settings) {
  try { storage.setItem(key, JSON.stringify(settings)); } catch { /* session settings remain active */ }
}
