export function createLoadingView() {
  const screen = document.querySelector<HTMLElement>('#launch-screen')!;
  const title = screen.querySelector<HTMLElement>('#launch-title')!;
  const stage = screen.querySelector<HTMLElement>('#launch-stage')!;
  const percent = screen.querySelector<HTMLElement>('#launch-percent')!;
  const track = screen.querySelector<HTMLElement>('[role=progressbar]')!;
  const game = document.querySelector<HTMLElement>('#game')!;
  const paint = () => new Promise<void>(resolve => setTimeout(resolve, 20));
  function update(value: number, text: string) {
    const progress = Math.round(value);
    track.style.setProperty('--ready', String(progress / 100));
    track.setAttribute('aria-valuenow', String(progress));
    percent.textContent = progress + '%';
    if (stage.textContent !== text) stage.textContent = text;
  }
  function hide() {
    screen.hidden = true;
    screen.classList.remove('leaving');
    game.inert = false;
  }
  return {
    show(mode: 'boot' | 'raid') {
      screen.dataset.mode = mode;
      title.textContent = mode === 'boot' ? '盐港隔离区' : '前往盐港隔离区';
      screen.hidden = false;
      screen.classList.remove('leaving');
      game.inert = true;
      update(0, mode === 'boot' ? '正在建立连接' : '检查出击整备');
    },
    async progress(value: number, text: string) {
      update(value, text);
      await paint();
    },
    async finish() {
      update(100, '准备就绪');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise(resolve => setTimeout(resolve, 180));
        screen.classList.add('leaving');
        await new Promise(resolve => setTimeout(resolve, 440));
      }
      hide();
    },
    hide,
  };
}
