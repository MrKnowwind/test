import type { WeaponId } from '../contracts/demo.ts';

export function createAudio() {
  let context: AudioContext | undefined;
  let noise: AudioBuffer | undefined;
  let ambience: GainNode | undefined;
  let environmentFilter: BiquadFilterNode | undefined;
  let master: GainNode | undefined, effects: GainNode | undefined, background: GainNode | undefined;
  let levels = { master: .85, effects: 1, ambience: .8 };
  function volumes(next: typeof levels) {
    levels = { master: next.master, effects: next.effects, ambience: next.ambience };
    if (!context || !master || !effects || !background) return;
    master.gain.setTargetAtTime(levels.master ** 2, context.currentTime, .025);
    effects.gain.setTargetAtTime(levels.effects ** 2, context.currentTime, .025);
    background.gain.setTargetAtTime(levels.ambience ** 2, context.currentTime, .025);
  }
  function ready() {
    context ??= new AudioContext();
    void context.resume();
    if (!noise) {
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const values = noise.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
    }
    if(!ambience) {
      master = context.createGain(); effects = context.createGain(); background = context.createGain();
      master.gain.value = levels.master ** 2;
      effects.gain.value = levels.effects ** 2;
      background.gain.value = levels.ambience ** 2;
      effects.connect(master);
      background.connect(master);
      master.connect(context.destination);
      const source=context.createBufferSource();source.buffer=noise;source.loop=true;
      environmentFilter=context.createBiquadFilter();environmentFilter.type='lowpass';environmentFilter.frequency.value=450;
      ambience=context.createGain();ambience.gain.value=.003;
      source.connect(environmentFilter).connect(ambience).connect(background);source.start();
    }
    return context;
  }
  function burst(duration: number, volume: number, cutoff: number, tone?: number, pan=0,delay=0) {
    if (!context || context.state !== 'running' || !noise || !effects) return;
    const at = context.currentTime+delay;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    const stereo=context.createStereoPanner();stereo.pan.value=Math.max(-1,Math.min(1,pan));
    source.connect(filter).connect(gain).connect(stereo).connect(effects);
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
    ready, volumes,
    slide() { burst(.48,.042,930); burst(.22,.023,570,90,0,.19); },
    jump() { burst(.08,.025,1050,145); },
    slideJump() { burst(.09, .036, 1160, 135); },
    liftSwitch() { burst(.05,.032,1700,170); burst(.11,.024,940,290,0,.09); },
    grip() { burst(.07,.031,1150,130,0,.08); burst(.055,.018,850,0,0,.13); },
    land(impact = .5) { burst(.10,.026 + impact*.035,680,105); },
    reveal() { burst(.08,.016,1800,620); },
    pickup() { burst(.035,.022,1800,490);burst(.07,.016,2600,780,0,.035); },
    door(open:boolean){burst(.21,.026,open?1150:800,open?190:125);burst(.045,.025,1500,100,0,.34);},
    treat(dressing:boolean){burst(dressing?.14:.065,dressing?.025:.02,dressing?1500:2900,dressing?undefined:450);},
    magazineSeat(){burst(.055,.052,2900,170);},
    shot(id: WeaponId) {
      burst(.023,.10,5600);
      burst(id === 'shotgun' ? .3 : .17, .21, id === 'rifle' ? 5500 : 3300, id === 'shotgun' ? 110 : 165);
    },
    reload() { burst(.14, .055, 3900); },
    slash() { burst(.19, .075, 1500); },
    hit(mechanical=false) {
      if(mechanical){burst(.048,.065,5100,930);burst(.10,.025,2900,520,.12,.028);}
      else {burst(.080,.078,920,115);burst(.036,.036,2500,undefined,0,.018);}
    },
    cover(distance:number){burst(.065,.045/(1+distance*.12),3700,420,0,Math.min(.11,distance/410));},
    footstep(surface: 'metal' | 'concrete' | 'gravel') {
      burst(surface==='metal'?.13:.08,.018,surface==='metal'?2100:surface==='concrete'?1300:700,surface==='metal'?220:undefined);
    },
    warning(mechanical: boolean, distance: number, pan:number) { burst(.17,.04*Math.max(0,1-distance/25),mechanical?2600:600,mechanical?780:90,pan); },
    alert(distance: number, pan: number) {
      const level = Math.max(0, 1-distance/25);
      if (level <= 0) return;
      burst(.23,.035*level,740,145,pan);
      burst(.16,.02*level,480,96,pan,.12);
    },
    environment(active: boolean, underground: boolean, coast: boolean) {
      if(!context||!ambience||!environmentFilter) return;
      ambience.gain.setTargetAtTime(active?(underground?.0018:coast?.008:.003):0,context.currentTime,.5);
      environmentFilter.frequency.setTargetAtTime(underground?130:coast?800:420,context.currentTime,.6);
    },
  };
}
