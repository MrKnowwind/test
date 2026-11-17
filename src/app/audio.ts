import type { WeaponId } from '../contracts/demo.ts';

export function createAudio() {
  let context: AudioContext | undefined;
  let noise: AudioBuffer | undefined;
  let ambience: GainNode | undefined;
  let environmentFilter: BiquadFilterNode | undefined;
  function ready() {
    context ??= new AudioContext();
    void context.resume();
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const values = noise.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
    }
    if(!ambience) {
      const source=context.createBufferSource();source.buffer=noise;source.loop=true;
      environmentFilter=context.createBiquadFilter();environmentFilter.type='lowpass';environmentFilter.frequency.value=450;
      ambience=context.createGain();ambience.gain.value=.003;
      source.connect(environmentFilter).connect(ambience).connect(context.destination);source.start();
    }
    return context;
  }
  function burst(duration: number, volume: number, cutoff: number, tone?: number) {
    if (!context || context.state !== 'running' || !noise) return;
    const at = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(at); source.stop(at + duration);
    if (tone) {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(tone, at);
      oscillator.frequency.exponentialRampToValueAtTime(35, at + duration);
      oscillator.connect(gain);
      oscillator.start(at); oscillator.stop(at + duration);
    }
  }
  return {
    ready,
    reveal() { burst(.08,.016,1800,620); },
    pickup() { burst(.07,.022,2200,360); },
    shot(id: WeaponId) {
      burst(id === 'shotgun' ? .3 : .17, .21, id === 'rifle' ? 5500 : 3300, id === 'shotgun' ? 110 : 165);
    },
    reload() { burst(.14, .055, 3900); },
    slash() { burst(.19, .075, 1500); },
    hit() { burst(.07, .045, 950); },
    footstep(surface: 'metal' | 'concrete' | 'gravel') {
      burst(surface==='metal'?.13:.08,.018,surface==='metal'?2100:surface==='concrete'?1300:700,surface==='metal'?220:undefined);
    },
    warning(mechanical: boolean, distance: number) { burst(.17,.04*Math.max(0,1-distance/25),mechanical?2600:600,mechanical?780:90); },
    environment(active: boolean, underground: boolean, coast: boolean) {
      if(!context||!ambience||!environmentFilter) return;
      ambience.gain.setTargetAtTime(active?(underground?.0018:coast?.008:.003):0,context.currentTime,.5);
      environmentFilter.frequency.setTargetAtTime(underground?130:coast?800:420,context.currentTime,.6);
    },
  };
}
