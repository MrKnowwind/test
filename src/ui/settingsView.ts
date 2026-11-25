import { actions, bindingName, defaultSettings, inputActions, reservedBinding, type InputAction, type Settings } from '../player/settings.ts';

export function createSettingsView(settings: Settings, change: () => void) {
  const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog')!;
  const options = dialog.querySelector<HTMLElement>('#setting-options')!;
  const bindings = dialog.querySelector<HTMLElement>('#bindings')!;
  const status = dialog.querySelector<HTMLOutputElement>('#binding-status')!;
  let waiting: { action: InputAction; index: number; button: HTMLButtonElement } | undefined;
  function addOption(label: string, control: HTMLInputElement | HTMLSelectElement) {
    const row = document.createElement('label');
    row.append(label, control);
    options.append(row);
    return row;
  }
  function render() {
    options.replaceChildren();
    for (const [key, text, min, max] of [
      ['master', '总音量', 0, 100], ['effects', '音效', 0, 100],
      ['ambience', '环境音', 0, 100], ['sensitivity', '鼠标灵敏度', 20, 300],
      ['cameraMotion', '镜头动态效果', 0, 100],
    ] as const) {
      const slider = document.createElement('input'), output = document.createElement('output');
      slider.id = 'setting-' + key;
      slider.type = 'range'; slider.min = String(min); slider.max = String(max);
      slider.value = String(Math.round(settings[key] * 100));
      const update = () => { output.value = slider.value + '%'; };
      slider.oninput = () => { settings[key] = Number(slider.value) / 100; update(); change(); };
      update();
      addOption(text, slider).append(output);
    }
    const fov = document.createElement('input'), fovLabel = document.createElement('output');
    fov.type = 'range'; fov.min = '55'; fov.max = '80';
    fov.id = 'vertical-fov'; fov.value = String(settings.fov);
    fovLabel.value = fov.value + '°';
    fov.oninput = () => {
      settings.fov = Number(fov.value);
      fovLabel.value = fov.value + '°';
      change();
    };
    addOption('垂直视野', fov).append(fovLabel);
    const stance = document.createElement('select');
    stance.id = 'stance-mode';
    stance.add(new Option('切换', 'toggle'));
    stance.add(new Option('按住', 'hold'));
    stance.value = settings.stance;
    stance.onchange = () => { settings.stance = stance.value === 'hold' ? 'hold' : 'toggle'; change(); };
    addOption('蹲伏模式', stance);
    const quality = document.createElement('select');
    quality.id = 'quality';
    for (const [key, title] of [['balanced', '均衡'], ['high', '高'], ['low', '低']])
      quality.add(new Option(title, key));
    quality.value = settings.quality;
    quality.onchange = () => { settings.quality = quality.value; change(); };
    addOption('画质', quality);
    const map = document.createElement('input');
    map.type = 'checkbox'; map.checked = settings.minimap;
    map.onchange = () => { settings.minimap = map.checked; change(); };
    addOption('显示小地图', map);
    bindings.replaceChildren();
    for (const action of inputActions) {
      const row = document.createElement('div');
      row.className = 'binding-row';
      row.append(actions[action][0]);
      for (const [index, code] of settings.bindings[action].entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = bindingName(code);
        button.setAttribute('aria-label', actions[action][0] + ' · ' + button.textContent);
        button.dataset.binding = action;
        button.onclick = () => {
          waiting = { action, index, button };
          status.value = '按下新键 · Esc 取消';
        };
        row.append(button);
      }
      bindings.append(row);
    }
  }
  function capture(code: string) {
    if (!waiting) return;
    const { action, index } = waiting;
    if (code === 'Escape') { waiting = undefined; status.value = ''; return; }
    const conflict = inputActions.find(other => settings.bindings[other].some((key, i) =>
      key === code && (other !== action || i !== index)));
    if (conflict || reservedBinding(code)) {
      status.value = conflict ? bindingName(code) + ' 已用于' + actions[conflict][0] : bindingName(code) + ' 为保留键';
      return;
    }
    settings.bindings[action][index] = code;
    waiting = undefined;
    status.value = '';
    change(); render();
    bindings.querySelectorAll<HTMLButtonElement>('[data-binding="' + action + '"]')[index]?.focus();
  }
  window.addEventListener('keydown', event => {
    if (!dialog.open || !waiting) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) capture(event.code);
  }, true);
  window.addEventListener('mousedown', event => {
    if (!dialog.open || !waiting || (event.button === 0 && event.target !== waiting.button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    capture('Mouse' + event.button);
  }, true);
  dialog.oncontextmenu = event => event.preventDefault();
  dialog.addEventListener('close', () => { waiting = undefined; status.value = ''; });
  document.querySelector<HTMLButtonElement>('#settings-open')!.onclick = () => dialog.showModal();
  document.querySelector<HTMLButtonElement>('#settings-close')!.onclick = () => dialog.close();
  document.querySelector<HTMLButtonElement>('#settings-reset')!.onclick = () => {
    waiting = undefined; status.value = '';
    Object.assign(settings, defaultSettings()); change(); render();
  };
  render();
}
